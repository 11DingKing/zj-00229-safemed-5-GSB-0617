const request = require("supertest");
const {
  createTestApp,
  seedTestData,
  createIncident,
} = require("./setup");

describe("超时判定一致性：pending_acknowledge + 三接口口径统一", () => {
  let app;
  let db;

  beforeAll(() => {
    app = createTestApp();
    seedTestData(app);
    db = require("../database");
  });

  beforeEach(() => {
    db.prepare("DELETE FROM task_receipts").run();
    db.prepare("DELETE FROM collaboration_tasks").run();
    db.prepare("DELETE FROM disposition_logs").run();
    db.prepare("DELETE FROM public_opinions").run();
    db.prepare("DELETE FROM case_reviews").run();
    db.prepare("DELETE FROM incidents").run();
  });

  async function createTask(app, incidentId, overrides = {}) {
    const defaultData = {
      title: "测试任务",
      description: "测试任务描述",
      assign_department: "医院医务科",
      assign_user: "测试员",
      receive_department: "医院安保科",
      urgency_level: "high",
    };
    const res = await request(app)
      .post(`/api/incidents/${incidentId}/tasks`)
      .send({ ...defaultData, ...overrides });
    return res;
  }

  function setTaskDeadline(taskId, deadline) {
    db.prepare(
      "UPDATE collaboration_tasks SET deadline = ?, is_overdue = 0, score_deducted = 0, status = ? WHERE id = ?",
    ).run(deadline, "pending_acknowledge", taskId);
  }

  function setTaskStatusAndDeadline(taskId, status, deadline) {
    db.prepare(
      "UPDATE collaboration_tasks SET deadline = ?, is_overdue = 0, score_deducted = 0, status = ? WHERE id = ?",
    ).run(deadline, status, taskId);
  }

  describe("一、pending_acknowledge 状态过 deadline 也要判超时", () => {
    test("待签收且已过 deadline 的任务应被判超时并扣分", async () => {
      const incRes = await createIncident(app, { type: "violence" });
      const incidentId = incRes.body.id;

      const taskRes = await createTask(app, incidentId, {
        urgency_level: "high",
        receive_department: "医院安保科",
      });
      const taskId = taskRes.body.id;

      const pastDeadline = "2020-01-01 00:00:00";
      setTaskDeadline(taskId, pastDeadline);

      const detailRes = await request(app).get(`/api/tasks/${taskId}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.is_overdue).toBe(1);
      expect(detailRes.body.status).toBe("overdue");
      expect(detailRes.body.score_deducted).toBe(5);
    });

    test("不同 urgency 等级的待签收超时扣分正确", async () => {
      const testCases = [
        { urgency: "critical", expectedDeduction: 10 },
        { urgency: "high", expectedDeduction: 5 },
        { urgency: "medium", expectedDeduction: 3 },
        { urgency: "normal", expectedDeduction: 1 },
      ];

      for (const tc of testCases) {
        const incRes = await createIncident(app, { type: "violence" });
        const incidentId = incRes.body.id;

        const taskRes = await createTask(app, incidentId, {
          urgency_level: tc.urgency,
          title: `测试${tc.urgency}任务`,
        });
        const taskId = taskRes.body.id;

        const pastDeadline = "2020-01-01 00:00:00";
        setTaskDeadline(taskId, pastDeadline);

        const detailRes = await request(app).get(`/api/tasks/${taskId}`);
        expect(detailRes.body.is_overdue).toBe(1);
        expect(detailRes.body.score_deducted).toBe(tc.expectedDeduction);
      }
    });

    test("completed 状态不二次判超时", async () => {
      const incRes = await createIncident(app, { type: "violence" });
      const incidentId = incRes.body.id;

      const taskRes = await createTask(app, incidentId, {
        urgency_level: "high",
      });
      const taskId = taskRes.body.id;

      db.prepare(
        "UPDATE collaboration_tasks SET deadline = ?, status = 'completed', is_overdue = 0, score_deducted = 0, completion_time = ? WHERE id = ?",
      ).run("2020-01-01 00:00:00", "2020-01-02 00:00:00", taskId);

      const detailRes = await request(app).get(`/api/tasks/${taskId}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.is_overdue).toBe(0);
      expect(detailRes.body.status).toBe("completed");
      expect(detailRes.body.score_deducted).toBe(0);
    });
  });

  describe("二、三接口超时口径一致（与调用顺序无关）", () => {
    function setupOverdueTasks() {
      const insertTask = db.prepare(`
        INSERT INTO collaboration_tasks 
        (task_no, incident_id, title, description, assign_department, assign_user, assign_time, receive_department, deadline, urgency_level, status, is_overdue, score_deducted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      `);

      const incInfo = db
        .prepare(
          "INSERT INTO incidents (incident_no, type, hospital, department, description, urgency_level, reporter) VALUES (?, 'violence', '测试医院A', '急诊科', '测试', 'high', '测试员')",
        )
        .run("YLTEST001");
      const incidentId = incInfo.lastInsertRowid;

      const tasks = [
        {
          taskNo: "RWTEST001",
          dept: "医院安保科",
          urgency: "high",
          status: "pending_acknowledge",
          deadline: "2020-01-01 00:00:00",
        },
        {
          taskNo: "RWTEST002",
          dept: "医院安保科",
          urgency: "critical",
          status: "processing",
          deadline: "2020-01-01 00:00:00",
        },
        {
          taskNo: "RWTEST003",
          dept: "医院医务科",
          urgency: "medium",
          status: "acknowledged",
          deadline: "2020-01-01 00:00:00",
        },
        {
          taskNo: "RWTEST004",
          dept: "医院医务科",
          urgency: "normal",
          status: "pending_acknowledge",
          deadline: "2099-01-01 00:00:00",
        },
        {
          taskNo: "RWTEST005",
          dept: "医院安保科",
          urgency: "high",
          status: "completed",
          deadline: "2020-01-01 00:00:00",
        },
      ];

      tasks.forEach((t, i) => {
        insertTask.run(
          t.taskNo,
          incidentId,
          `测试任务${i + 1}`,
          "描述",
          "医院值班室",
          "测试员",
          "2026-06-01 00:00:00",
          t.dept,
          t.deadline,
          t.urgency,
          t.status,
        );
      });

      return {
        totalOverdue: 3,
        securityOverdue: 2,
        medicalOverdue: 1,
        totalDeduction: 5 + 10 + 3,
        securityDeduction: 5 + 10,
        medicalDeduction: 3,
      };
    }

    test("先查 overdue_only 列表，再查 deadline-rate，结果一致", async () => {
      const expected = setupOverdueTasks();

      const overdueListRes = await request(app).get(
        "/api/tasks?overdue_only=1",
      );
      expect(overdueListRes.status).toBe(200);
      const listOverdueCount = overdueListRes.body.total;
      const listTotalDeduction = overdueListRes.body.list.reduce(
        (s, t) => s + (t.score_deducted || 0),
        0,
      );

      const deadlineRateRes = await request(app).get(
        "/api/stats/tasks/deadline-rate",
      );
      expect(deadlineRateRes.status).toBe(200);
      const statsOverdueCount = deadlineRateRes.body.summary.overdue;
      const statsTotalDeduction = deadlineRateRes.body.summary.total_deduction;

      expect(listOverdueCount).toBe(expected.totalOverdue);
      expect(statsOverdueCount).toBe(expected.totalOverdue);
      expect(listTotalDeduction).toBe(expected.totalDeduction);
      expect(statsTotalDeduction).toBe(expected.totalDeduction);
    });

    test("先查 deadline-rate，再查 overdue_only 列表，结果一致", async () => {
      const expected = setupOverdueTasks();

      const deadlineRateRes = await request(app).get(
        "/api/stats/tasks/deadline-rate",
      );
      expect(deadlineRateRes.status).toBe(200);
      const statsOverdueCount = deadlineRateRes.body.summary.overdue;
      const statsTotalDeduction = deadlineRateRes.body.summary.total_deduction;

      const overdueListRes = await request(app).get(
        "/api/tasks?overdue_only=1",
      );
      expect(overdueListRes.status).toBe(200);
      const listOverdueCount = overdueListRes.body.total;
      const listTotalDeduction = overdueListRes.body.list.reduce(
        (s, t) => s + (t.score_deducted || 0),
        0,
      );

      expect(listOverdueCount).toBe(expected.totalOverdue);
      expect(statsOverdueCount).toBe(expected.totalOverdue);
      expect(listTotalDeduction).toBe(expected.totalDeduction);
      expect(statsTotalDeduction).toBe(expected.totalDeduction);
    });

    test("部门 summary 与 overdue_only 列表按部门核对一致", async () => {
      const expected = setupOverdueTasks();

      const summaryRes = await request(app).get(
        "/api/tasks/department/医院安保科/summary",
      );
      expect(summaryRes.status).toBe(200);
      const deptSummaryOverdue = summaryRes.body.overdue;

      const listRes = await request(app).get(
        "/api/tasks?overdue_only=1&department=医院安保科",
      );
      expect(listRes.status).toBe(200);
      const deptListOverdue = listRes.body.total;
      const deptListDeduction = listRes.body.list.reduce(
        (s, t) => s + (t.score_deducted || 0),
        0,
      );

      expect(deptSummaryOverdue).toBe(expected.securityOverdue);
      expect(deptListOverdue).toBe(expected.securityOverdue);
      expect(deptListDeduction).toBe(expected.securityDeduction);
    });

    test("deadline-rate 按部门与部门 summary 核对一致", async () => {
      const expected = setupOverdueTasks();

      const deadlineRateRes = await request(app).get(
        "/api/stats/tasks/deadline-rate?department=医院医务科",
      );
      expect(deadlineRateRes.status).toBe(200);
      const statsDeptOverdue = deadlineRateRes.body.summary.overdue;
      const statsDeptDeduction = deadlineRateRes.body.summary.total_deduction;

      const summaryRes = await request(app).get(
        "/api/tasks/department/医院医务科/summary",
      );
      expect(summaryRes.status).toBe(200);
      const deptSummaryOverdue = summaryRes.body.overdue;

      expect(statsDeptOverdue).toBe(expected.medicalOverdue);
      expect(deptSummaryOverdue).toBe(expected.medicalOverdue);
      expect(statsDeptDeduction).toBe(expected.medicalDeduction);
    });

    test("三接口全量核对：overdue_only + deadline-rate + dept summary 三者一致", async () => {
      const expected = setupOverdueTasks();

      const listRes = await request(app).get("/api/tasks?overdue_only=1");
      const statsRes = await request(app).get("/api/stats/tasks/deadline-rate");
      const secSummaryRes = await request(app).get(
        "/api/tasks/department/医院安保科/summary",
      );
      const medSummaryRes = await request(app).get(
        "/api/tasks/department/医院医务科/summary",
      );

      const listOverdue = listRes.body.total;
      const listDeduction = listRes.body.list.reduce(
        (s, t) => s + (t.score_deducted || 0),
        0,
      );

      const statsOverdue = statsRes.body.summary.overdue;
      const statsDeduction = statsRes.body.summary.total_deduction;

      const secSummaryOverdue = secSummaryRes.body.overdue;
      const medSummaryOverdue = medSummaryRes.body.overdue;
      const totalSummaryOverdue = secSummaryOverdue + medSummaryOverdue;

      expect(listOverdue).toBe(expected.totalOverdue);
      expect(statsOverdue).toBe(expected.totalOverdue);
      expect(totalSummaryOverdue).toBe(expected.totalOverdue);

      expect(listDeduction).toBe(expected.totalDeduction);
      expect(statsDeduction).toBe(expected.totalDeduction);

      expect(secSummaryOverdue).toBe(expected.securityOverdue);
      expect(medSummaryOverdue).toBe(expected.medicalOverdue);
    });
  });

  describe("三、overview 与 drilldown 也保持一致", () => {
    test("overview 的 overdue 数与 deadline-rate 一致", async () => {
      const insertTask = db.prepare(`
        INSERT INTO collaboration_tasks 
        (task_no, incident_id, title, description, assign_department, assign_user, assign_time, receive_department, deadline, urgency_level, status, is_overdue, score_deducted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      `);

      const incInfo = db
        .prepare(
          "INSERT INTO incidents (incident_no, type, hospital, department, description, urgency_level, reporter) VALUES (?, 'violence', '测试医院A', '急诊科', '测试', 'high', '测试员')",
        )
        .run("YLTEST002");
      const incidentId = incInfo.lastInsertRowid;

      for (let i = 0; i < 3; i++) {
        insertTask.run(
          `RWTEST0${i}`,
          incidentId,
          `任务${i}`,
          "",
          "医院值班室",
          "测试员",
          "2026-06-01 00:00:00",
          "医院安保科",
          "2020-01-01 00:00:00",
          "high",
          i % 2 === 0 ? "pending_acknowledge" : "processing",
        );
      }

      const overviewRes = await request(app).get("/api/stats/tasks/overview");
      const deadlineRes = await request(app).get(
        "/api/stats/tasks/deadline-rate",
      );

      expect(overviewRes.body.overdue).toBe(3);
      expect(deadlineRes.body.summary.overdue).toBe(3);
      expect(overviewRes.body.total_deduction).toBe(15);
      expect(deadlineRes.body.summary.total_deduction).toBe(15);
    });
  });
});
