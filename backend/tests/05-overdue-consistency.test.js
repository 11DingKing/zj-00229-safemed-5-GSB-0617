const request = require("supertest");
const {
  createTestApp,
  seedTestData,
  createIncident,
} = require("./setup");

describe("超时判定/考核扣分一致性", () => {
  let app;
  let db;

  beforeAll(() => {
    app = createTestApp();
    seedTestData(app);
    db = require("../database");
  });

  function createOverdueTask(incidentId, overrides = {}) {
    const defaults = {
      task_no: `RW-TEST-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      incident_id: incidentId,
      title: "测试超时任务",
      description: "",
      assign_department: "医院值班室",
      assign_user: "测试员",
      assign_time: "2026-06-01 08:00:00",
      receive_department: overrides.receive_department || "医院安保科",
      deadline: "2026-06-01 09:00:00",
      urgency_level: overrides.urgency_level || "high",
      status: overrides.status || "pending_acknowledge",
      receive_user: overrides.receive_user || null,
      receive_time: overrides.receive_time || null,
      receive_remark: null,
      completion_result: null,
      completion_time: null,
      is_overdue: 0,
      score_deducted: 0,
    };
    const task = { ...defaults, ...overrides };
    const info = db
      .prepare(
        `INSERT INTO collaboration_tasks
         (task_no, incident_id, title, description, assign_department, assign_user, assign_time,
          receive_department, deadline, urgency_level, status, receive_user, receive_time,
          receive_remark, completion_result, completion_time, is_overdue, score_deducted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        task.task_no,
        task.incident_id,
        task.title,
        task.description,
        task.assign_department,
        task.assign_user,
        task.assign_time,
        task.receive_department,
        task.deadline,
        task.urgency_level,
        task.status,
        task.receive_user,
        task.receive_time,
        task.receive_remark,
        task.completion_result,
        task.completion_time,
        task.is_overdue,
        task.score_deducted,
      );
    return info.lastInsertRowid;
  }

  beforeEach(() => {
    db.prepare("DELETE FROM task_receipts").run();
    db.prepare("DELETE FROM collaboration_tasks").run();
    db.prepare("DELETE FROM case_reviews").run();
    db.prepare("DELETE FROM disposition_logs").run();
    db.prepare("DELETE FROM public_opinions").run();
    db.prepare("DELETE FROM incidents").run();
  });

  describe("一、pending_acknowledge 过 deadline 也判超时", () => {
    test("待签收且已过 deadline 的任务应被判超时并扣分", async () => {
      const incRes = await createIncident(app);
      const incidentId = incRes.body.id;

      createOverdueTask(incidentId, {
        status: "pending_acknowledge",
        urgency_level: "critical",
        deadline: "2026-06-01 09:00:00",
      });

      const res = await request(app).get("/api/tasks?overdue_only=1");
      expect(res.body.list.length).toBe(1);
      expect(res.body.list[0].status).toBe("overdue");
      expect(res.body.list[0].is_overdue).toBe(1);
      expect(res.body.list[0].score_deducted).toBe(10);
    });

    test("待签收任务按 urgency 扣分与 processing 一致", async () => {
      const incRes = await createIncident(app);
      const incidentId = incRes.body.id;

      const taskId1 = createOverdueTask(incidentId, {
        status: "pending_acknowledge",
        urgency_level: "high",
        receive_department: "医院安保科",
      });
      const taskId2 = createOverdueTask(incidentId, {
        status: "processing",
        urgency_level: "high",
        receive_department: "医院医务科",
        receive_user: "张三",
        receive_time: "2026-06-01 08:10:00",
      });

      const res = await request(app).get("/api/tasks?overdue_only=1");
      const overdue = res.body.list;

      const task1 = overdue.find((t) => t.id === taskId1);
      const task2 = overdue.find((t) => t.id === taskId2);

      expect(task1.score_deducted).toBe(5);
      expect(task2.score_deducted).toBe(5);
    });

    test("completed 任务不二次判超时", async () => {
      const incRes = await createIncident(app);
      const incidentId = incRes.body.id;

      createOverdueTask(incidentId, {
        status: "completed",
        urgency_level: "high",
        deadline: "2026-06-01 09:00:00",
        receive_user: "张三",
        receive_time: "2026-06-01 08:10:00",
        completion_result: "已完成",
        completion_time: "2026-06-01 08:50:00",
        is_overdue: 0,
        score_deducted: 0,
      });

      const res = await request(app).get("/api/tasks?overdue_only=1");
      expect(res.body.list.length).toBe(0);
    });
  });

  describe("二、三处接口超时数/扣分对齐", () => {
    test("overdue_only 列表、deadline-rate、部门 summary 超时数一致", async () => {
      const incRes = await createIncident(app);
      const incidentId = incRes.body.id;

      createOverdueTask(incidentId, {
        status: "pending_acknowledge",
        urgency_level: "critical",
        receive_department: "医院安保科",
      });
      createOverdueTask(incidentId, {
        status: "processing",
        urgency_level: "high",
        receive_department: "医院安保科",
        receive_user: "张三",
        receive_time: "2026-06-01 08:10:00",
      });
      createOverdueTask(incidentId, {
        status: "pending_acknowledge",
        urgency_level: "medium",
        receive_department: "医院医务科",
      });

      const overdueListRes = await request(app).get("/api/tasks?overdue_only=1");
      const deadlineRateRes = await request(app).get("/api/stats/tasks/deadline-rate");
      const summaryRes = await request(app).get("/api/tasks/department/医院安保科/summary");

      const overdueListCount = overdueListRes.body.list.length;
      const deadlineRateOverdue = deadlineRateRes.body.summary.overdue;
      const deptSummaryOverdue = summaryRes.body.overdue;

      expect(overdueListCount).toBe(3);
      expect(deadlineRateOverdue).toBe(3);
      expect(deptSummaryOverdue).toBe(2);
    });

    test("扣分总额在 deadline-rate 和 overdue_only 列表间对齐", async () => {
      const incRes = await createIncident(app);
      const incidentId = incRes.body.id;

      createOverdueTask(incidentId, {
        status: "pending_acknowledge",
        urgency_level: "critical",
        receive_department: "医院安保科",
      });
      createOverdueTask(incidentId, {
        status: "processing",
        urgency_level: "high",
        receive_department: "医院医务科",
        receive_user: "张三",
        receive_time: "2026-06-01 08:10:00",
      });

      const overdueListRes = await request(app).get("/api/tasks?overdue_only=1");
      const deadlineRateRes = await request(app).get("/api/stats/tasks/deadline-rate");

      const listDeduction = overdueListRes.body.list.reduce(
        (sum, t) => sum + (t.score_deducted || 0),
        0,
      );
      const statsDeduction = deadlineRateRes.body.summary.total_deduction;

      expect(listDeduction).toBe(15);
      expect(statsDeduction).toBe(15);
    });

    test("接口调用顺序无关：先调 deadline-rate 再调 overdue_only 结果一致", async () => {
      const incRes = await createIncident(app);
      const incidentId = incRes.body.id;

      createOverdueTask(incidentId, {
        status: "pending_acknowledge",
        urgency_level: "high",
        receive_department: "医院安保科",
      });

      const deadlineRateRes = await request(app).get("/api/stats/tasks/deadline-rate");
      const overdueListRes = await request(app).get("/api/tasks?overdue_only=1");

      expect(deadlineRateRes.body.summary.overdue).toBe(1);
      expect(overdueListRes.body.list.length).toBe(1);
      expect(deadlineRateRes.body.summary.total_deduction).toBe(
        overdueListRes.body.list.reduce((s, t) => s + (t.score_deducted || 0), 0),
      );
    });

    test("overview 接口超时数与 deadline-rate 一致", async () => {
      const incRes = await createIncident(app);
      const incidentId = incRes.body.id;

      createOverdueTask(incidentId, {
        status: "pending_acknowledge",
        urgency_level: "critical",
        receive_department: "医院安保科",
      });
      createOverdueTask(incidentId, {
        status: "processing",
        urgency_level: "medium",
        receive_department: "医院医务科",
        receive_user: "张三",
        receive_time: "2026-06-01 08:10:00",
      });

      const overviewRes = await request(app).get("/api/stats/tasks/overview");
      const deadlineRateRes = await request(app).get("/api/stats/tasks/deadline-rate");

      expect(overviewRes.body.overdue).toBe(2);
      expect(deadlineRateRes.body.summary.overdue).toBe(2);
      expect(overviewRes.body.total_deduction).toBe(
        deadlineRateRes.body.summary.total_deduction,
      );
    });
  });

  describe("三、refreshAllOverdueStatus 不重复扣分", () => {
    test("已标记超时的任务不会重复扣分", async () => {
      const incRes = await createIncident(app);
      const incidentId = incRes.body.id;

      createOverdueTask(incidentId, {
        status: "pending_acknowledge",
        urgency_level: "high",
        receive_department: "医院安保科",
      });

      await request(app).get("/api/tasks?overdue_only=1");
      await request(app).get("/api/tasks?overdue_only=1");

      const res = await request(app).get("/api/stats/tasks/deadline-rate");
      expect(res.body.summary.overdue).toBe(1);
      expect(res.body.summary.total_deduction).toBe(5);
    });
  });
});
