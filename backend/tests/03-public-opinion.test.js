const request = require("supertest");
const {
  createTestApp,
  seedTestData,
  createIncident,
  addOpinion,
} = require("./setup");

describe("专属坎：网络医闹挂舆情功能", () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
    seedTestData(app);
  });

  describe("一、网络医闹事件可以挂上舆情", () => {
    test("网络医闹类型事件可以添加舆情记录", async () => {
      const res = await createIncident(app, {
        type: "online",
        description: "网友发帖称医院过度医疗",
        hospital: "测试医院A",
        department: "门诊部",
      });
      const incidentId = res.body.id;

      const opinionRes = await addOpinion(app, incidentId, {
        title: "医院坑人！感冒花了三千块",
        url: "https://weibo.com/test/123456",
        platform: "微博",
        spread_count: 5000,
        spread_level: "high",
      });

      expect(opinionRes.status).toBe(201);
      expect(opinionRes.body.id).toBeTruthy();
      expect(opinionRes.body.title).toBe("医院坑人！感冒花了三千块");
      expect(opinionRes.body.url).toBe("https://weibo.com/test/123456");
      expect(opinionRes.body.platform).toBe("微博");
      expect(opinionRes.body.spread_count).toBe(5000);
      expect(opinionRes.body.spread_level).toBe("high");
      expect(opinionRes.body.incident_id).toBe(incidentId);
    });

    test("网络医闹事件可以添加多条舆情记录", async () => {
      const res = await createIncident(app, {
        type: "online",
        description: "多平台传播的医院负面舆情",
      });
      const incidentId = res.body.id;

      await addOpinion(app, incidentId, {
        title: "微博爆料",
        url: "https://weibo.com/test/1",
        platform: "微博",
        spread_count: 10000,
        spread_level: "high",
      });

      await addOpinion(app, incidentId, {
        title: "抖音视频",
        url: "https://douyin.com/test/1",
        platform: "抖音",
        spread_count: 50000,
        spread_level: "critical",
      });

      await addOpinion(app, incidentId, {
        title: "本地论坛讨论",
        url: "https://bbs.example.com/thread-123",
        platform: "本地论坛",
        spread_count: 500,
        spread_level: "medium",
      });

      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);
      const opinions = detailRes.body.opinions;

      expect(opinions.length).toBe(3);
      expect(opinions.some((o) => o.platform === "微博")).toBe(true);
      expect(opinions.some((o) => o.platform === "抖音")).toBe(true);
      expect(opinions.some((o) => o.platform === "本地论坛")).toBe(true);
    });
  });

  describe("二、舆情记录完整性校验", () => {
    test("舆情记录有创建时间", async () => {
      const res = await createIncident(app, { type: "online" });
      const incidentId = res.body.id;

      const opinionRes = await addOpinion(app, incidentId, {
        title: "测试舆情",
        url: "https://example.com/test",
      });

      expect(opinionRes.body.created_at).toBeTruthy();
    });

    test("缺少标题时无法添加舆情", async () => {
      const res = await createIncident(app, { type: "online" });
      const incidentId = res.body.id;

      const failRes = await request(app)
        .post(`/api/incidents/${incidentId}/opinions`)
        .send({
          url: "https://example.com/test",
        });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error).toBeTruthy();
    });

    test("缺少URL时无法添加舆情", async () => {
      const res = await createIncident(app, { type: "online" });
      const incidentId = res.body.id;

      const failRes = await request(app)
        .post(`/api/incidents/${incidentId}/opinions`)
        .send({
          title: "测试舆情",
        });

      expect(failRes.status).toBe(400);
      expect(failRes.body.error).toBeTruthy();
    });
  });

  describe("三、其他类型事件也可以挂舆情（扩展验证）", () => {
    test("暴力伤医事件也能关联舆情（次生舆情）", async () => {
      const res = await createIncident(app, {
        type: "violence",
        description: "暴力伤医事件",
      });
      const incidentId = res.body.id;

      const opinionRes = await addOpinion(app, incidentId, {
        title: "某医院发生暴力伤医事件",
        url: "https://news.example.com/violence",
        platform: "新闻网站",
        spread_count: 8000,
        spread_level: "high",
      });

      expect(opinionRes.status).toBe(201);

      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);
      expect(detailRes.body.opinions.length).toBe(1);
    });
  });

  describe("四、事件详情能正确返回舆情列表", () => {
    test("事件详情接口包含舆情列表", async () => {
      const res = await createIncident(app, {
        type: "online",
        description: "测试网络医闹事件",
      });
      const incidentId = res.body.id;

      await addOpinion(app, incidentId, {
        title: "舆情1",
        url: "https://example.com/1",
        platform: "微博",
        spread_count: 100,
      });

      await addOpinion(app, incidentId, {
        title: "舆情2",
        url: "https://example.com/2",
        platform: "抖音",
        spread_count: 200,
      });

      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.opinions).toBeDefined();
      expect(Array.isArray(detailRes.body.opinions)).toBe(true);
      expect(detailRes.body.opinions.length).toBe(2);

      detailRes.body.opinions.forEach((op) => {
        expect(op.id).toBeTruthy();
        expect(op.title).toBeTruthy();
        expect(op.url).toBeTruthy();
        expect(op.created_at).toBeTruthy();
      });
    });

    test("没有舆情的事件返回空数组", async () => {
      const res = await createIncident(app, { type: "violence" });
      const incidentId = res.body.id;

      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);

      expect(detailRes.body.opinions).toBeDefined();
      expect(Array.isArray(detailRes.body.opinions)).toBe(true);
      expect(detailRes.body.opinions.length).toBe(0);
    });
  });

  describe("五、缺陷检查：网络医闹必须能挂舆情", () => {
    test("网络医闹事件添加舆情后能通过事件详情查到", async () => {
      const res = await createIncident(app, {
        type: "online",
        description: "网络医闹事件，验证舆情挂接",
      });
      const incidentId = res.body.id;

      const opinionData = {
        title: "某医院被指过度医疗 网友直呼坑人",
        url: "https://weibo.com/example/123456789",
        platform: "微博",
        spread_count: 15000,
        spread_level: "high",
        found_time: "2026-06-13 09:00:00",
      };

      const addRes = await addOpinion(app, incidentId, opinionData);
      expect(addRes.status).toBe(201);
      expect(addRes.body.id).toBeGreaterThan(0);

      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.type).toBe("online");
      expect(detailRes.body.opinions.length).toBeGreaterThanOrEqual(1);

      const matchedOpinion = detailRes.body.opinions.find(
        (o) => o.url === opinionData.url,
      );
      expect(matchedOpinion).toBeDefined();
      expect(matchedOpinion.title).toBe(opinionData.title);
      expect(matchedOpinion.platform).toBe(opinionData.platform);
      expect(matchedOpinion.spread_count).toBe(opinionData.spread_count);
      expect(matchedOpinion.spread_level).toBe(opinionData.spread_level);
    });

    test("同一网络医闹事件挂多条舆情都能正确关联", async () => {
      const res = await createIncident(app, {
        type: "online",
        description: "多平台发酵的网络医闹",
      });
      const incidentId = res.body.id;

      const opinions = [
        {
          title: "微博首发",
          url: "https://weibo.com/1",
          platform: "微博",
          spread_count: 3000,
        },
        {
          title: "抖音转载",
          url: "https://douyin.com/1",
          platform: "抖音",
          spread_count: 8000,
        },
        {
          title: "小红书热议",
          url: "https://xhs.com/1",
          platform: "小红书",
          spread_count: 1500,
        },
        {
          title: "本地论坛讨论",
          url: "https://bbs.com/1",
          platform: "本地论坛",
          spread_count: 800,
        },
      ];

      for (const op of opinions) {
        const addRes = await addOpinion(app, incidentId, op);
        expect(addRes.status).toBe(201);
      }

      const detailRes = await request(app).get(`/api/incidents/${incidentId}`);
      const returnedOpinions = detailRes.body.opinions;

      expect(returnedOpinions.length).toBe(opinions.length);

      for (const expectedOp of opinions) {
        const found = returnedOpinions.find((o) => o.url === expectedOp.url);
        expect(found).toBeDefined();
        expect(found.title).toBe(expectedOp.title);
        expect(found.platform).toBe(expectedOp.platform);
      }
    });
  });
});
