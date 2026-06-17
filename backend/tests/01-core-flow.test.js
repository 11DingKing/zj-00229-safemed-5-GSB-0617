const request = require("supertest");
const {
  createTestApp,
  seedTestData,
  createIncident,
  advanceStatus,
  INCIDENT_TYPES,
  STATUS_MAP,
} = require("./setup");

describe("核心链路：接报登记 → 联动处置 → 结案", () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
    seedTestData(app);
  });

  describe("一、四类接报登记", () => {
    const incidentTypes = [
      { key: "violence", label: "暴力伤医" },
      { key: "gathering", label: "现场聚众医闹" },
      { key: "online", label: "网络医闹" },
      { key: "threat", label: "扬言威胁" },
    ];

    test.each(incidentTypes)(
      "可以登记 $label 类型的事件",
      async ({ key, label }) => {
        const res = await createIncident(app, {
          type: key,
          description: `测试${label}事件`,
          reporter: "测试登记员",
        });

        expect(res.status).toBe(201);
        expect(res.body.type).toBe(key);
        expect(res.body.type_text).toBe(label);
        expect(res.body.status).toBe("reported");
        expect(res.body.status_text).toBe("已上报");
        expect(res.body.incident_no).toBeTruthy();
        expect(res.body.incident_no.startsWith("YL")).toBe(true);
      },
    );

    test("接报登记后自动生成第一条处置痕迹（接报）", async () => {
      const res = await createIncident(app, {
        type: "violence",
        reporter: "张护士",
      });

      const incidentId = res.body.id;
      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);

      expect(detailRes.status).toBe(200);
      const logs = detailRes.body.logs;

      expect(logs.length).toBeGreaterThanOrEqual(1);

      const firstLog = logs[0];
      expect(firstLog.status).toBe("reported");
      expect(firstLog.status_text).toBe("已上报");
      expect(firstLog.action).toBe("接报");
      expect(firstLog.operator).toBe("张护士");
      expect(firstLog.created_at).toBeTruthy();
    });

    test("缺少必要字段时返回 400 错误", async () => {
      const res = await request(app).post("/api/incidents").send({
        type: "violence",
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeTruthy();
    });
  });

  describe("二、状态流转：已上报 → 联动响应中", () => {
    let incidentId;

    beforeEach(async () => {
      const res = await createIncident(app, { type: "violence" });
      incidentId = res.body.id;
    });

    test("可以从已上报流转到联动响应中", async () => {
      const res = await advanceStatus(app, incidentId, "responding", {
        department: "医院安保科",
        operator: "李安保",
        remark: "保安3分钟到达现场",
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("responding");
      expect(res.body.status_text).toBe("联动响应中");
      expect(res.body.response_time).toBeTruthy();
    });

    test("流转后新增一条处置痕迹", async () => {
      const beforeRes = await request(app).get(`/api/incidents/${incidentId}`);
      const beforeLogs = beforeRes.body.logs;

      await advanceStatus(app, incidentId, "responding", {
        department: "医院安保科",
        operator: "李安保",
        remark: "保安到达现场",
      });

      const afterRes = await request(app).get(`/api/incidents/${incidentId}`);
      const afterLogs = afterRes.body.logs;

      expect(afterLogs.length).toBe(beforeLogs.length + 1);

      const latestLog = afterLogs[afterLogs.length - 1];
      expect(latestLog.status).toBe("responding");
      expect(latestLog.status_text).toBe("联动响应中");
      expect(latestLog.action).toBe("联动响应");
      expect(latestLog.department).toBe("医院安保科");
      expect(latestLog.operator).toBe("李安保");
      expect(latestLog.remark).toBe("保安到达现场");
      expect(latestLog.created_at).toBeTruthy();
    });
  });

  describe("三、状态流转：联动响应中 → 调查中", () => {
    let incidentId;

    beforeEach(async () => {
      const res = await createIncident(app, { type: "violence" });
      incidentId = res.body.id;
      await advanceStatus(app, incidentId, "responding");
    });

    test("可以从联动响应中流转到调查中", async () => {
      const res = await advanceStatus(app, incidentId, "investigating", {
        department: "辖区派出所",
        operator: "王警官",
        remark: "调取监控，询问证人",
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("investigating");
      expect(res.body.status_text).toBe("调查中");
      expect(res.body.investigate_time).toBeTruthy();
    });

    test("流转后新增调查阶段的处置痕迹", async () => {
      const beforeRes = await request(app).get(`/api/incidents/${incidentId}`);
      const beforeLogs = beforeRes.body.logs;

      await advanceStatus(app, incidentId, "investigating", {
        department: "辖区派出所",
        operator: "王警官",
        remark: "开始调查取证",
      });

      const afterRes = await request(app).get(`/api/incidents/${incidentId}`);
      const afterLogs = afterRes.body.logs;

      expect(afterLogs.length).toBe(beforeLogs.length + 1);

      const latestLog = afterLogs[afterLogs.length - 1];
      expect(latestLog.status).toBe("investigating");
      expect(latestLog.status_text).toBe("调查中");
      expect(latestLog.action).toBe("调查");
      expect(latestLog.department).toBe("辖区派出所");
      expect(latestLog.operator).toBe("王警官");
    });
  });

  describe("四、状态流转：调查中 → 已结案", () => {
    let incidentId;

    beforeEach(async () => {
      const res = await createIncident(app, { type: "violence" });
      incidentId = res.body.id;
      await advanceStatus(app, incidentId, "responding");
      await advanceStatus(app, incidentId, "investigating");
    });

    test("结案必须填写结案复盘信息", async () => {
      const res = await request(app)
        .post(`/api/incidents/${incidentId}/disposition`)
        .send({
          status: "closed",
          action: "处理结案",
          department: "医院医务科",
          operator: "赵主任",
          remark: "事件处理完毕",
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("结案必须填写结案复盘");
    });

    test("填写完整复盘信息后可以正常结案", async () => {
      const res = await advanceStatus(app, incidentId, "closed", {
        department: "医院医务科",
        operator: "赵主任",
        remark: "事件处理完毕，已结案",
        review: {
          summary:
            "测试事件复盘小结：患者家属因不满治疗结果滋事，经多方联动妥善处理",
          qualitative: "典型暴力伤医事件，无医疗过错",
          key_points:
            "1. 第一时间启动安保联动；2. 同步报警留证；3. 组织专家评估",
          reviewer: "李主任",
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("closed");
      expect(res.body.status_text).toBe("已结案");
      expect(res.body.close_time).toBeTruthy();
    });

    test("结案后生成复盘记录和结案痕迹", async () => {
      await advanceStatus(app, incidentId, "closed", {
        review: {
          summary: "测试复盘小结",
          qualitative: "测试定性结论",
          key_points: "测试处置要点",
          reviewer: "测试复盘人",
        },
      });

      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);
      const { logs, review } = detailRes.body;

      const latestLog = logs[logs.length - 1];
      expect(latestLog.status).toBe("closed");
      expect(latestLog.action).toBe("处理结案");

      expect(review).toBeTruthy();
      expect(review.summary).toBe("测试复盘小结");
      expect(review.qualitative).toBe("测试定性结论");
      expect(review.key_points).toBe("测试处置要点");
      expect(review.reviewer).toBe("测试复盘人");
      expect(review.reviewed_at).toBeTruthy();
    });
  });

  describe("五、完整链路走通 + 痕迹完整性", () => {
    test("完整走完全流程后，状态正确且每步都有痕迹", async () => {
      const createRes = await createIncident(app, {
        type: "violence",
        reporter: "测试员A",
      });
      const incidentId = createRes.body.id;

      const step1 = await advanceStatus(app, incidentId, "responding", {
        department: "医院安保科",
        operator: "李安保",
        remark: "保安到达现场",
      });
      expect(step1.status).toBe(200);
      expect(step1.body.status).toBe("responding");

      const step2 = await advanceStatus(app, incidentId, "investigating", {
        department: "辖区派出所",
        operator: "王警官",
        remark: "开展调查",
      });
      expect(step2.status).toBe(200);
      expect(step2.body.status).toBe("investigating");

      const step3 = await advanceStatus(app, incidentId, "closed", {
        department: "医院医务科",
        operator: "赵主任",
        remark: "处理完毕结案",
      });
      expect(step3.status).toBe(200);
      expect(step3.body.status).toBe("closed");

      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);
      const logs = detailRes.body.logs;

      const statusesInLogs = logs.map((l) => l.status);
      expect(statusesInLogs).toContain("reported");
      expect(statusesInLogs).toContain("responding");
      expect(statusesInLogs).toContain("investigating");
      expect(statusesInLogs).toContain("closed");

      logs.forEach((log) => {
        expect(log.action).toBeTruthy();
        expect(log.department).toBeTruthy();
        expect(log.operator).toBeTruthy();
        expect(log.created_at).toBeTruthy();
      });

      expect(detailRes.body.report_time).toBeTruthy();
      expect(detailRes.body.response_time).toBeTruthy();
      expect(detailRes.body.investigate_time).toBeTruthy();
      expect(detailRes.body.close_time).toBeTruthy();
    });
  });
});
