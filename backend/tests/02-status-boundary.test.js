const request = require("supertest");
const {
  createTestApp,
  seedTestData,
  createIncident,
  advanceStatus,
} = require("./setup");

describe("专属坎：状态流转边界校验", () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
    seedTestData(app);
  });

  describe("一、状态不许跳级", () => {
    test("已上报不能直接到调查中（跳过响应）", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;

      const jumpRes = await advanceStatus(app, incidentId, "investigating");

      expect(jumpRes.status).toBe(400);
      expect(jumpRes.body.error).toBeTruthy();
      expect(jumpRes.body.error).toContain("状态流转不合法");
    });

    test("已上报不能直接到已结案（跳两级）", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;

      const jumpRes = await advanceStatus(app, incidentId, "closed");

      expect(jumpRes.status).toBe(400);
      expect(jumpRes.body.error).toContain("状态流转不合法");
    });

    test("联动响应中不能直接到已结案（跳过调查）", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;
      await advanceStatus(app, incidentId, "responding");

      const jumpRes = await advanceStatus(app, incidentId, "closed");

      expect(jumpRes.status).toBe(400);
      expect(jumpRes.body.error).toContain("状态流转不合法");
    });

    test("跳级后状态保持不变", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;

      await advanceStatus(app, incidentId, "investigating");

      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);
      expect(detailRes.body.status).toBe("reported");
      expect(detailRes.body.status_text).toBe("已上报");
    });
  });

  describe("二、状态不许往回退", () => {
    test("联动响应中不能退回到已上报", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;
      await advanceStatus(app, incidentId, "responding");

      const revertRes = await advanceStatus(app, incidentId, "reported");

      expect(revertRes.status).toBe(400);
      expect(revertRes.body.error).toContain("状态流转不合法");
    });

    test("调查中不能退回到联动响应中", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;
      await advanceStatus(app, incidentId, "responding");
      await advanceStatus(app, incidentId, "investigating");

      const revertRes = await advanceStatus(app, incidentId, "responding");

      expect(revertRes.status).toBe(400);
      expect(revertRes.body.error).toContain("状态流转不合法");
    });

    test("已结案不能退回到调查中", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;
      await advanceStatus(app, incidentId, "responding");
      await advanceStatus(app, incidentId, "investigating");
      await advanceStatus(app, incidentId, "closed");

      const revertRes = await advanceStatus(app, incidentId, "investigating");

      expect(revertRes.status).toBe(400);
      expect(revertRes.body.error).toContain("状态流转不合法");
    });

    test("已结案不能退回到联动响应中", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;
      await advanceStatus(app, incidentId, "responding");
      await advanceStatus(app, incidentId, "investigating");
      await advanceStatus(app, incidentId, "closed");

      const revertRes = await advanceStatus(app, incidentId, "responding");

      expect(revertRes.status).toBe(400);
    });

    test("回退失败后状态和痕迹都不变", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;
      await advanceStatus(app, incidentId, "responding");

      const beforeRes = await request(app).get(`/api/incidents/${incidentId}`);
      const beforeStatus = beforeRes.body.status;
      const beforeLogCount = beforeRes.body.logs.length;

      await advanceStatus(app, incidentId, "reported");

      const afterRes = await request(app).get(`/api/incidents/${incidentId}`);
      expect(afterRes.body.status).toBe(beforeStatus);
      expect(afterRes.body.logs.length).toBe(beforeLogCount);
    });
  });

  describe("三、错误信息包含当前状态和允许的流转方向", () => {
    test("错误信息中能看到当前状态和目标状态", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;

      const failRes = await advanceStatus(app, incidentId, "investigating");

      expect(failRes.body.error).toContain("已上报");
      expect(failRes.body.error).toContain("调查中");
    });

    test("错误信息中提示允许的流转方向", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;

      const failRes = await advanceStatus(app, incidentId, "closed");

      expect(failRes.body.error).toContain("联动响应中");
    });
  });

  describe("四、已结案后不能再流转到任何状态", () => {
    test("已结案事件再次提交流转会报错", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;
      await advanceStatus(app, incidentId, "responding");
      await advanceStatus(app, incidentId, "investigating");
      await advanceStatus(app, incidentId, "closed");

      const extraRes = await advanceStatus(app, incidentId, "responding");

      expect(extraRes.status).toBe(400);
      expect(extraRes.body.error).toContain("状态流转不合法");
    });
  });
});
