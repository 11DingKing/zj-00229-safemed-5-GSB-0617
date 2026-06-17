const request = require("supertest");
const {
  createTestApp,
  seedTestData,
  createIncident,
  advanceStatus,
  INCIDENT_TYPES,
} = require("./setup");

describe("专属坎：统计和排序", () => {
  let app;
  let db;

  beforeAll(() => {
    app = createTestApp();
    seedTestData(app);
    db = require("../database");
  });

  function setIncidentTimes(id, fields) {
    const sets = [];
    const params = [];
    for (const [key, value] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      params.push(value);
    }
    params.push(id);
    const sql = `UPDATE incidents SET ${sets.join(", ")} WHERE id = ?`;
    db.prepare(sql).run(...params);
  }

  describe("一、按事件类型统计", () => {
    beforeEach(() => {
      db.prepare("DELETE FROM disposition_logs").run();
      db.prepare("DELETE FROM public_opinions").run();
      db.prepare("DELETE FROM case_reviews").run();
      db.prepare("DELETE FROM incidents").run();
    });

    test("统计各类型的发生数量", async () => {
      await createIncident(app, { type: "violence", hospital: "测试医院A" });
      await createIncident(app, { type: "violence", hospital: "测试医院B" });
      await createIncident(app, { type: "violence", hospital: "测试医院C" });
      await createIncident(app, { type: "online", hospital: "测试医院A" });
      await createIncident(app, { type: "online", hospital: "测试医院B" });
      await createIncident(app, { type: "gathering", hospital: "测试医院A" });
      await createIncident(app, { type: "threat", hospital: "测试医院A" });

      const res = await request(app).get("/api/stats/by-type");

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const violenceStat = res.body.find((s) => s.type === "violence");
      const onlineStat = res.body.find((s) => s.type === "online");
      const gatheringStat = res.body.find((s) => s.type === "gathering");
      const threatStat = res.body.find((s) => s.type === "threat");

      expect(violenceStat.count).toBe(3);
      expect(violenceStat.type_text).toBe("暴力伤医");
      expect(onlineStat.count).toBe(2);
      expect(onlineStat.type_text).toBe("网络医闹");
      expect(gatheringStat.count).toBe(1);
      expect(threatStat.count).toBe(1);
    });

    test("平均处置时长只计算已结案的事件", async () => {
      const inc1Res = await createIncident(app, { type: "violence" });
      const inc2Res = await createIncident(app, { type: "violence" });
      const inc3Res = await createIncident(app, { type: "violence" });

      setIncidentTimes(inc1Res.body.id, {
        report_time: "2026-06-13 08:00:00",
        status: "closed",
        close_time: "2026-06-13 16:00:00",
      });
      setIncidentTimes(inc2Res.body.id, {
        report_time: "2026-06-13 09:00:00",
        status: "closed",
        close_time: "2026-06-13 17:00:00",
      });

      const res = await request(app).get("/api/stats/by-type");
      const violenceStat = res.body.find((s) => s.type === "violence");

      expect(violenceStat.count).toBe(3);
      expect(violenceStat.avg_hours).toBeCloseTo(8, 0);
    });

    test("未结案的事件不纳入平均时长计算", async () => {
      const inc1Res = await createIncident(app, { type: "online" });
      const inc2Res = await createIncident(app, { type: "online" });

      setIncidentTimes(inc1Res.body.id, {
        report_time: "2026-06-13 08:00:00",
        status: "closed",
        close_time: "2026-06-13 20:00:00",
      });

      setIncidentTimes(inc2Res.body.id, {
        report_time: "2026-06-13 10:00:00",
        status: "investigating",
      });

      const res = await request(app).get("/api/stats/by-type");
      const onlineStat = res.body.find((s) => s.type === "online");

      expect(onlineStat.count).toBe(2);
      expect(onlineStat.avg_hours).toBeCloseTo(12, 0);
    });

    test("全部未结案时平均时长为0", async () => {
      await createIncident(app, { type: "threat" });
      await createIncident(app, { type: "threat" });

      const res = await request(app).get("/api/stats/by-type");
      const threatStat = res.body.find((s) => s.type === "threat");

      expect(threatStat.count).toBe(2);
      expect(threatStat.avg_hours).toBe(0);
    });

    test("处置时长单位为小时", async () => {
      const incRes = await createIncident(app, { type: "gathering" });

      setIncidentTimes(incRes.body.id, {
        report_time: "2026-06-13 00:00:00",
        status: "closed",
        close_time: "2026-06-13 06:30:00",
      });

      const res = await request(app).get("/api/stats/by-type");
      const gatheringStat = res.body.find((s) => s.type === "gathering");

      expect(gatheringStat.avg_hours).toBeCloseTo(6.5, 1);
    });
  });

  describe("二、按医院统计", () => {
    beforeEach(() => {
      db.prepare("DELETE FROM disposition_logs").run();
      db.prepare("DELETE FROM public_opinions").run();
      db.prepare("DELETE FROM case_reviews").run();
      db.prepare("DELETE FROM incidents").run();
    });

    test("各医院发生数量统计正确", async () => {
      await createIncident(app, { type: "violence", hospital: "测试医院A" });
      await createIncident(app, { type: "online", hospital: "测试医院A" });
      await createIncident(app, { type: "threat", hospital: "测试医院A" });
      await createIncident(app, { type: "violence", hospital: "测试医院B" });
      await createIncident(app, { type: "gathering", hospital: "测试医院B" });
      await createIncident(app, { type: "violence", hospital: "测试医院C" });

      const res = await request(app).get("/api/stats/by-hospital");

      const hospA = res.body.find((h) => h.hospital === "测试医院A");
      const hospB = res.body.find((h) => h.hospital === "测试医院B");
      const hospC = res.body.find((h) => h.hospital === "测试医院C");

      expect(hospA.count).toBe(3);
      expect(hospB.count).toBe(2);
      expect(hospC.count).toBe(1);
    });

    test("按医院统计平均处置时长（只算结案的）", async () => {
      const inc1 = await createIncident(app, {
        type: "violence",
        hospital: "测试医院A",
      });
      const inc2 = await createIncident(app, {
        type: "violence",
        hospital: "测试医院A",
      });
      const inc3 = await createIncident(app, {
        type: "violence",
        hospital: "测试医院A",
      });

      setIncidentTimes(inc1.body.id, {
        report_time: "2026-06-13 08:00:00",
        status: "closed",
        close_time: "2026-06-13 16:00:00",
      });
      setIncidentTimes(inc2.body.id, {
        report_time: "2026-06-13 09:00:00",
        status: "closed",
        close_time: "2026-06-13 13:00:00",
      });

      const res = await request(app).get("/api/stats/by-hospital");
      const hospA = res.body.find((h) => h.hospital === "测试医院A");

      expect(hospA.count).toBe(3);
      expect(hospA.avg_hours).toBeCloseTo(6, 0);
    });
  });

  describe("三、按紧急程度排序", () => {
    beforeEach(() => {
      db.prepare("DELETE FROM disposition_logs").run();
      db.prepare("DELETE FROM public_opinions").run();
      db.prepare("DELETE FROM case_reviews").run();
      db.prepare("DELETE FROM incidents").run();
    });

    test("事件列表按紧急程度排序：特急 > 紧急 > 较重 > 一般", async () => {
      await createIncident(app, {
        type: "violence",
        urgency_level: "normal",
        description: "一般紧急度",
        hospital: "测试医院A",
      });
      await createIncident(app, {
        type: "violence",
        urgency_level: "critical",
        description: "特急事件",
        hospital: "测试医院A",
      });
      await createIncident(app, {
        type: "violence",
        urgency_level: "medium",
        description: "较重事件",
        hospital: "测试医院A",
      });
      await createIncident(app, {
        type: "violence",
        urgency_level: "high",
        description: "紧急事件",
        hospital: "测试医院A",
      });

      const res = await request(app).get("/api/incidents?sort=urgency");

      expect(res.status).toBe(200);
      const list = res.body.list;

      expect(list.length).toBe(4);
      expect(list[0].urgency_level).toBe("critical");
      expect(list[0].urgency_text).toBe("特急");
      expect(list[1].urgency_level).toBe("high");
      expect(list[1].urgency_text).toBe("紧急");
      expect(list[2].urgency_level).toBe("medium");
      expect(list[2].urgency_text).toBe("较重");
      expect(list[3].urgency_level).toBe("normal");
      expect(list[3].urgency_text).toBe("一般");
    });

    test("相同紧急程度的按时间倒序排列", async () => {
      const inc1 = await createIncident(app, {
        type: "violence",
        urgency_level: "high",
        description: "较早的紧急事件",
        hospital: "测试医院A",
      });
      const inc2 = await createIncident(app, {
        type: "violence",
        urgency_level: "high",
        description: "较新的紧急事件",
        hospital: "测试医院A",
      });

      setIncidentTimes(inc1.body.id, { report_time: "2026-06-13 08:00:00" });
      setIncidentTimes(inc2.body.id, { report_time: "2026-06-13 10:00:00" });

      const res = await request(app).get("/api/incidents?sort=urgency");
      const list = res.body.list;

      expect(list[0].description).toBe("较新的紧急事件");
      expect(list[1].description).toBe("较早的紧急事件");
    });

    test("混合紧急程度排序与医院筛选结合使用", async () => {
      await createIncident(app, {
        type: "violence",
        urgency_level: "critical",
        hospital: "测试医院A",
      });
      await createIncident(app, {
        type: "violence",
        urgency_level: "normal",
        hospital: "测试医院A",
      });
      await createIncident(app, {
        type: "violence",
        urgency_level: "high",
        hospital: "测试医院B",
      });

      const res = await request(app).get(
        "/api/incidents?sort=urgency&hospital=测试医院A",
      );
      const list = res.body.list;

      expect(list.length).toBe(2);
      expect(list[0].urgency_level).toBe("critical");
      expect(list[1].urgency_level).toBe("normal");
    });
  });

  describe("四、概览统计", () => {
    beforeEach(() => {
      db.prepare("DELETE FROM disposition_logs").run();
      db.prepare("DELETE FROM public_opinions").run();
      db.prepare("DELETE FROM case_reviews").run();
      db.prepare("DELETE FROM incidents").run();
    });

    test("概览统计数据正确", async () => {
      const inc1 = await createIncident(app, {
        type: "violence",
        urgency_level: "critical",
      });
      const inc2 = await createIncident(app, {
        type: "online",
        urgency_level: "high",
      });
      const inc3 = await createIncident(app, {
        type: "threat",
        urgency_level: "normal",
      });
      const inc4 = await createIncident(app, {
        type: "gathering",
        urgency_level: "medium",
      });

      setIncidentTimes(inc3.body.id, {
        report_time: "2026-06-13 08:00:00",
        status: "closed",
        close_time: "2026-06-13 16:00:00",
      });

      const res = await request(app).get("/api/stats/overview");

      expect(res.body.total).toBe(4);
      expect(res.body.pending).toBe(3);
      expect(res.body.closed).toBe(1);
      expect(res.body.critical).toBe(1);
      expect(res.body.avg_hours).toBeCloseTo(8, 0);
    });

    test("平均处置时长只统计已结案事件", async () => {
      const inc1 = await createIncident(app, { type: "violence" });
      const inc2 = await createIncident(app, { type: "violence" });

      setIncidentTimes(inc1.body.id, {
        report_time: "2026-06-13 00:00:00",
        status: "closed",
        close_time: "2026-06-13 10:00:00",
      });

      const res = await request(app).get("/api/stats/overview");
      expect(res.body.avg_hours).toBeCloseTo(10, 0);
    });
  });
});
