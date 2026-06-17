const request = require("supertest");
const { createTestApp, seedTestData } = require("./setup");

describe("超时判定一致性验证", () => {
  let app;
  let db;
  let incidentId;

  beforeAll(async () => {
    app = createTestApp();
    seedTestData(app);
    db = require("../database");

    const incRes = await request(app).post("/api/incidents").send({
      type: "violence",
      hospital: "测试医院A",
      department: "急诊科",
      description: "测试超时判定事件",
      reporter: "测试员",
      urgency_level: "high",
    });
    incidentId = incRes.body.id;
  });

  function createTask(overrides = {}) {
    const defaultData = {
      title: "测试任务",
      description: "测试任务描述",
      assign_department: "医院医务科",
      assign_user: "测试员",
      receive_department: "医院安保科",
      urgency_level: "high",
    };
    return request(app)
      .post(`/api/incidents/${incidentId}/tasks`)
      .send({ ...defaultData, ...overrides });
  }

  function setTaskDeadline(taskId, deadline) {
    db.prepare("UPDATE collaboration_tasks SET deadline = ? WHERE id = ?").run(
      deadline,
      taskId,
    );
  }

  function setTaskStatus(taskId, status) {
    db.prepare(
      "UPDATE collaboration_tasks SET status = ?, is_overdue = 0, score_deducted = 0 WHERE id = ?",
    ).run(status, taskId);
  }

  describe("一、待签收任务过 deadline 也应判超时", () => {
    let taskId;

    beforeEach(async () => {
      const res = await createTask({
        title: "待签收超时测试任务",
        receive_department: "医院安保科",
        urgency_level: "high",
      });
      taskId = res.body.id;
      setTaskStatus(taskId, "pending_acknowledge");
      setTaskDeadline(taskId, "2020-01-01 00:00:00");
    });

    afterEach(() => {
      db.prepare("DELETE FROM task_receipts").run();
      db.prepare("DELETE FROM collaboration_tasks").run();
    });

    test("待签收且过 deadline 的任务在超时督办列表中能查到", async () => {
      const res = await request(app).get("/api/tasks?overdue_only=1");
      expect(res.status).toBe(200);

      const task = res.body.list.find((t) => t.id === taskId);
      expect(task).toBeDefined();
      expect(task.is_overdue).toBe(1);
      expect(task.status).toBe("overdue");
      expect(task.score_deducted).toBe(5);
    });

    test("待签收且过 deadline 的任务在 deadline-rate 统计中被计入", async () => {
      const res = await request(app).get("/api/stats/tasks/deadline-rate");
      expect(res.status).toBe(200);

      const dept = res.body.departments.find(
        (d) => d.department === "医院安保科",
      );
      expect(dept).toBeDefined();
      expect(dept.overdue).toBe(1);
      expect(dept.total_deduction).toBe(5);
    });

    test("待签收且过 deadline 的任务在部门 summary 中被计入", async () => {
      const res = await request(app).get(
        "/api/tasks/department/医院安保科/summary",
      );
      expect(res.status).toBe(200);
      expect(res.body.overdue).toBe(1);
    });
  });

  describe("二、三个接口超时数和扣分一致", () => {
    beforeEach(async () => {
      const tasks = [
        {
          title: "特急待签收超时",
          receive_department: "医院安保科",
          urgency_level: "critical",
          status: "pending_acknowledge",
          deadline: "2020-01-01 00:00:00",
        },
        {
          title: "紧急处置中超时",
          receive_department: "医院安保科",
          urgency_level: "high",
          status: "processing",
          deadline: "2020-01-01 00:00:00",
        },
        {
          title: "较重已签收超时",
          receive_department: "医院医务科",
          urgency_level: "medium",
          status: "acknowledged",
          deadline: "2020-01-01 00:00:00",
        },
        {
          title: "一般未超时",
          receive_department: "医院安保科",
          urgency_level: "normal",
          status: "pending_acknowledge",
          deadline: "2099-12-31 23:59:59",
        },
        {
          title: "已完成的不算",
          receive_department: "医院安保科",
          urgency_level: "high",
          status: "completed",
          deadline: "2020-01-01 00:00:00",
        },
      ];

      for (const t of tasks) {
        const res = await createTask({
          title: t.title,
          receive_department: t.receive_department,
          urgency_level: t.urgency_level,
        });
        setTaskStatus(res.body.id, t.status);
        setTaskDeadline(res.body.id, t.deadline);
        if (t.status === "completed") {
          db.prepare(
            "UPDATE collaboration_tasks SET completion_time = ?, is_overdue = 0, score_deducted = 0 WHERE id = ?",
          ).run("2020-01-02 00:00:00", res.body.id);
        }
      }
    });

    afterEach(() => {
      db.prepare("DELETE FROM task_receipts").run();
      db.prepare("DELETE FROM collaboration_tasks").run();
    });

    test("超时督办列表统计正确", async () => {
      const res = await request(app).get("/api/tasks?overdue_only=1");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);

      const totalDeduction = res.body.list.reduce(
        (s, t) => s + t.score_deducted,
        0,
      );
      expect(totalDeduction).toBe(10 + 5 + 3);
    });

    test("deadline-rate 统计与督办列表一致", async () => {
      const listRes = await request(app).get("/api/tasks?overdue_only=1");
      const statsRes = await request(app).get("/api/stats/tasks/deadline-rate");

      const listOverdue = listRes.body.total;
      const listDeduction = listRes.body.list.reduce(
        (s, t) => s + t.score_deducted,
        0,
      );

      const statsOverdue = statsRes.body.summary.overdue;
      const statsDeduction = statsRes.body.summary.total_deduction;

      expect(statsOverdue).toBe(listOverdue);
      expect(statsDeduction).toBe(listDeduction);
    });

    test("部门 summary 与督办列表一致", async () => {
      const listRes = await request(app).get(
        "/api/tasks?overdue_only=1&department=医院安保科",
      );
      const summaryRes = await request(app).get(
        "/api/tasks/department/医院安保科/summary",
      );

      expect(summaryRes.body.overdue).toBe(listRes.body.total);
    });

    test("先查统计再查列表，结果一致（与调用顺序无关）", async () => {
      const statsRes1 = await request(app).get(
        "/api/stats/tasks/deadline-rate",
      );
      const summaryRes1 = await request(app).get(
        "/api/tasks/department/医院安保科/summary",
      );
      const listRes = await request(app).get("/api/tasks?overdue_only=1");
      const statsRes2 = await request(app).get(
        "/api/stats/tasks/deadline-rate",
      );
      const summaryRes2 = await request(app).get(
        "/api/tasks/department/医院安保科/summary",
      );

      expect(statsRes1.body.summary.overdue).toBe(listRes.body.total);
      expect(statsRes2.body.summary.overdue).toBe(listRes.body.total);
      expect(summaryRes1.body.overdue).toBe(
        listRes.body.list.filter((t) => t.receive_department === "医院安保科")
          .length,
      );
      expect(summaryRes2.body.overdue).toBe(
        listRes.body.list.filter((t) => t.receive_department === "医院安保科")
          .length,
      );
    });
  });

  describe("三、按 urgency 正确扣分", () => {
    afterEach(() => {
      db.prepare("DELETE FROM task_receipts").run();
      db.prepare("DELETE FROM collaboration_tasks").run();
    });

    test("特急扣 10 分", async () => {
      const res = await createTask({
        title: "特急超时任务",
        urgency_level: "critical",
        receive_department: "医院安保科",
      });
      setTaskStatus(res.body.id, "pending_acknowledge");
      setTaskDeadline(res.body.id, "2020-01-01 00:00:00");

      const listRes = await request(app).get("/api/tasks?overdue_only=1");
      const task = listRes.body.list.find((t) => t.id === res.body.id);
      expect(task.score_deducted).toBe(10);
    });

    test("紧急扣 5 分", async () => {
      const res = await createTask({
        title: "紧急超时任务",
        urgency_level: "high",
        receive_department: "医院安保科",
      });
      setTaskStatus(res.body.id, "processing");
      setTaskDeadline(res.body.id, "2020-01-01 00:00:00");

      const listRes = await request(app).get("/api/tasks?overdue_only=1");
      const task = listRes.body.list.find((t) => t.id === res.body.id);
      expect(task.score_deducted).toBe(5);
    });

    test("较重扣 3 分", async () => {
      const res = await createTask({
        title: "较重超时任务",
        urgency_level: "medium",
        receive_department: "医院安保科",
      });
      setTaskStatus(res.body.id, "acknowledged");
      setTaskDeadline(res.body.id, "2020-01-01 00:00:00");

      const listRes = await request(app).get("/api/tasks?overdue_only=1");
      const task = listRes.body.list.find((t) => t.id === res.body.id);
      expect(task.score_deducted).toBe(3);
    });

    test("一般扣 1 分", async () => {
      const res = await createTask({
        title: "一般超时任务",
        urgency_level: "normal",
        receive_department: "医院安保科",
      });
      setTaskStatus(res.body.id, "pending_acknowledge");
      setTaskDeadline(res.body.id, "2020-01-01 00:00:00");

      const listRes = await request(app).get("/api/tasks?overdue_only=1");
      const task = listRes.body.list.find((t) => t.id === res.body.id);
      expect(task.score_deducted).toBe(1);
    });

    test("已完成的任务不二次判超时", async () => {
      const res = await createTask({
        title: "已完成任务",
        urgency_level: "high",
        receive_department: "医院安保科",
      });
      db.prepare(
        "UPDATE collaboration_tasks SET status = 'completed', completion_time = ?, is_overdue = 0, score_deducted = 0 WHERE id = ?",
      ).run("2020-01-02 00:00:00", res.body.id);
      setTaskDeadline(res.body.id, "2020-01-01 00:00:00");

      const listRes = await request(app).get("/api/tasks?overdue_only=1");
      const task = listRes.body.list.find((t) => t.id === res.body.id);
      expect(task).toBeUndefined();
    });
  });
});
