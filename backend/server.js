const express = require("express");
const cors = require("cors");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

const INCIDENT_TYPES = {
  violence: "暴力伤医",
  gathering: "现场聚众医闹",
  online: "网络医闹",
  threat: "扬言威胁",
};

const STATUS_MAP = {
  reported: "已上报",
  responding: "联动响应中",
  investigating: "调查中",
  closed: "已结案",
};

const URGENCY_MAP = {
  critical: "特急",
  high: "紧急",
  medium: "较重",
  normal: "一般",
};

const URGENCY_ORDER = { critical: 0, high: 1, medium: 2, normal: 3 };

const TASK_STATUS_MAP = {
  pending_acknowledge: "待签收",
  acknowledged: "已签收",
  processing: "处置中",
  completed: "已完成",
  overdue: "已超时",
};

const TASK_STATUS_ORDER = {
  pending_acknowledge: 0,
  acknowledged: 1,
  processing: 2,
  completed: 3,
  overdue: 4,
};

const DEADLINE_HOURS = {
  critical: 1,
  high: 4,
  medium: 24,
  normal: 48,
};

app.get("/api/incidents", (req, res) => {
  const { status, type, hospital, keyword, sort } = req.query;

  let sql = "SELECT * FROM incidents WHERE 1=1";
  const params = [];

  if (status && status !== "all") {
    sql += " AND status = ?";
    params.push(status);
  }
  if (type && type !== "all") {
    sql += " AND type = ?";
    params.push(type);
  }
  if (hospital && hospital !== "all") {
    sql += " AND hospital = ?";
    params.push(hospital);
  }
  if (keyword) {
    sql += " AND (description LIKE ? OR incident_no LIKE ? OR hospital LIKE ?)";
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw);
  }

  sql += " ORDER BY report_time DESC";

  const incidents = db.prepare(sql).all(...params);

  if (sort === "urgency") {
    incidents.sort((a, b) => {
      const ua = URGENCY_ORDER[a.urgency_level] ?? 99;
      const ub = URGENCY_ORDER[b.urgency_level] ?? 99;
      if (ua !== ub) return ua - ub;
      return new Date(b.report_time) - new Date(a.report_time);
    });
  }

  const result = incidents.map((inc) => ({
    ...inc,
    type_text: INCIDENT_TYPES[inc.type] || inc.type,
    status_text: STATUS_MAP[inc.status] || inc.status,
    urgency_text: URGENCY_MAP[inc.urgency_level] || inc.urgency_level,
  }));

  res.json({ list: result, total: result.length });
});

app.get("/api/incidents/:id", (req, res) => {
  const { id } = req.params;
  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);

  if (!incident) {
    return res.status(404).json({ error: "事件不存在" });
  }

  const logs = db
    .prepare(
      "SELECT * FROM disposition_logs WHERE incident_id = ? ORDER BY created_at ASC",
    )
    .all(id);
  const opinions = db
    .prepare(
      "SELECT * FROM public_opinions WHERE incident_id = ? ORDER BY created_at DESC",
    )
    .all(id);
  const review = db
    .prepare("SELECT * FROM case_reviews WHERE incident_id = ?")
    .get(id);

  res.json({
    ...incident,
    type_text: INCIDENT_TYPES[incident.type] || incident.type,
    status_text: STATUS_MAP[incident.status] || incident.status,
    urgency_text: URGENCY_MAP[incident.urgency_level] || incident.urgency_level,
    logs: logs.map((l) => ({
      ...l,
      status_text: STATUS_MAP[l.status] || l.status,
    })),
    opinions,
    review: review || null,
  });
});

app.post("/api/incidents", (req, res) => {
  const {
    type,
    hospital,
    department,
    description,
    injury_impact,
    urgency_level,
    reporter,
  } = req.body;

  if (!type || !hospital || !department || !description || !reporter) {
    return res.status(400).json({ error: "缺少必要字段" });
  }

  const dateStr = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")
    .slice(2);
  const prefix = "YL" + dateStr;
  const last = db
    .prepare(
      "SELECT incident_no FROM incidents WHERE incident_no LIKE ? ORDER BY id DESC LIMIT 1",
    )
    .get(prefix + "%");
  let seq = "001";
  if (last) {
    const num = parseInt(last.incident_no.slice(-3)) + 1;
    seq = String(num).padStart(3, "0");
  }
  const incident_no = prefix + seq;

  const info = db
    .prepare(
      `
    INSERT INTO incidents 
    (incident_no, type, hospital, department, description, injury_impact, urgency_level, reporter)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      incident_no,
      type,
      hospital,
      department,
      description,
      injury_impact || "",
      urgency_level || "normal",
      reporter,
    );

  const incidentId = info.lastInsertRowid;

  db.prepare(
    `
    INSERT INTO disposition_logs (incident_id, status, action, department, operator, remark)
    VALUES (?, 'reported', '接报', ?, ?, ?)
  `,
  ).run(incidentId, "值班室", reporter, "值班人员接报登记");

  const newIncident = db
    .prepare("SELECT * FROM incidents WHERE id = ?")
    .get(incidentId);
  res.status(201).json({
    ...newIncident,
    type_text: INCIDENT_TYPES[newIncident.type] || newIncident.type,
    status_text: STATUS_MAP[newIncident.status] || newIncident.status,
    urgency_text:
      URGENCY_MAP[newIncident.urgency_level] || newIncident.urgency_level,
  });
});

const VALID_TRANSITIONS = {
  reported: ["responding"],
  responding: ["investigating"],
  investigating: ["closed"],
  closed: [],
};

app.post("/api/incidents/:id/disposition", (req, res) => {
  const { id } = req.params;
  const { status, action, department, operator, remark, review } = req.body;

  if (!status || !action || !department || !operator) {
    return res.status(400).json({ error: "缺少必要字段" });
  }

  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  if (!incident) {
    return res.status(404).json({ error: "事件不存在" });
  }

  const allowed = VALID_TRANSITIONS[incident.status];
  if (!allowed || !allowed.includes(status)) {
    const statusText = STATUS_MAP[status] || status;
    const currentText = STATUS_MAP[incident.status] || incident.status;
    return res.status(400).json({
      error: `状态流转不合法：当前状态「${currentText}」不可流转至「${statusText}」，仅允许 ${allowed.map((s) => "「" + STATUS_MAP[s] + "」").join("→")}`,
    });
  }

  if (status === "closed") {
    if (
      !review ||
      !review.summary ||
      !review.qualitative ||
      !review.key_points ||
      !review.reviewer
    ) {
      return res.status(400).json({
        error:
          "结案必须填写结案复盘（复盘小结、定性、处置要点、复盘人均为必填项）",
      });
    }
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  let updateSql = "UPDATE incidents SET status = ?, updated_at = ?";
  const updateParams = [status, now];

  if (status === "responding" && !incident.response_time) {
    updateSql += ", response_time = ?";
    updateParams.push(now);
  }
  if (status === "investigating" && !incident.investigate_time) {
    updateSql += ", investigate_time = ?";
    updateParams.push(now);
  }
  if (status === "closed") {
    updateSql += ", close_time = ?";
    updateParams.push(now);
  }

  updateSql += " WHERE id = ?";
  updateParams.push(id);

  const updateTxn = db.transaction(() => {
    db.prepare(updateSql).run(...updateParams);

    db.prepare(
      `
      INSERT INTO disposition_logs (incident_id, status, action, department, operator, remark)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(id, status, action, department, operator, remark || "");

    if (status === "closed" && review) {
      const existing = db
        .prepare("SELECT id FROM case_reviews WHERE incident_id = ?")
        .get(id);
      if (existing) {
        db.prepare(
          `
          UPDATE case_reviews 
          SET summary = ?, qualitative = ?, key_points = ?, reviewer = ?, reviewed_at = ?, updated_at = ?
          WHERE incident_id = ?
        `,
        ).run(
          review.summary,
          review.qualitative,
          review.key_points,
          review.reviewer,
          now,
          now,
          id,
        );
      } else {
        db.prepare(
          `
          INSERT INTO case_reviews (incident_id, summary, qualitative, key_points, reviewer, reviewed_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        ).run(
          id,
          review.summary,
          review.qualitative,
          review.key_points,
          review.reviewer,
          now,
        );
      }

      const planDate = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const prefixPlan = "YA-" + planDate;
      const lastPlan = db
        .prepare(
          "SELECT plan_no FROM preparedness_plans WHERE plan_no LIKE ? ORDER BY id DESC LIMIT 1",
        )
        .get(prefixPlan + "%");
      let seqPlan = "001";
      if (lastPlan) {
        const numMatch = lastPlan.plan_no.match(/(\d{3})$/);
        if (numMatch) {
          seqPlan = String(parseInt(numMatch[1]) + 1).padStart(3, "0");
        }
      }
      const plan_no = prefixPlan + seqPlan;
      const typeInitial = incident.type
        ? incident.type.charAt(0).toUpperCase()
        : "X";
      const title = `【${INCIDENT_TYPES[incident.type] || incident.type}】${incident.hospital}${incident.department}处置预案（参考：${incident.incident_no}）`;
      const suggestedSteps = JSON.stringify([
        "1. 参考同类历史案例处置要点开展工作",
        "2. 第一时间启动多部门联动机制",
        "3. 按规范流程处置并做好记录留证",
        "4. 处置完成后及时进行结案复盘",
      ]);
      db.prepare(
        `
        INSERT INTO preparedness_plans 
        (plan_no, type, title, qualitative, key_points, suggested_steps, applicable_hospitals, applicable_departments, reference_incident_no, use_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `,
      ).run(
        plan_no,
        incident.type,
        title,
        review.qualitative,
        review.key_points,
        suggestedSteps,
        incident.hospital,
        incident.department,
        incident.incident_no,
      );
    }
  });

  try {
    updateTxn();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "保存失败，请重试" });
  }

  const updated = db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  const logs = db
    .prepare(
      "SELECT * FROM disposition_logs WHERE incident_id = ? ORDER BY created_at ASC",
    )
    .all(id);
  const reviewOut = db
    .prepare("SELECT * FROM case_reviews WHERE incident_id = ?")
    .get(id);

  res.json({
    ...updated,
    type_text: INCIDENT_TYPES[updated.type] || updated.type,
    status_text: STATUS_MAP[updated.status] || updated.status,
    urgency_text: URGENCY_MAP[updated.urgency_level] || updated.urgency_level,
    logs: logs.map((l) => ({
      ...l,
      status_text: STATUS_MAP[l.status] || l.status,
    })),
    review: reviewOut || null,
  });
});

app.post("/api/incidents/:id/opinions", (req, res) => {
  const { id } = req.params;
  const { title, url, platform, spread_count, spread_level, found_time } =
    req.body;

  if (!title || !url) {
    return res.status(400).json({ error: "缺少必要字段" });
  }

  const incident = db.prepare("SELECT id FROM incidents WHERE id = ?").get(id);
  if (!incident) {
    return res.status(404).json({ error: "事件不存在" });
  }

  const info = db
    .prepare(
      `
    INSERT INTO public_opinions (incident_id, title, url, platform, spread_count, spread_level, found_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      id,
      title,
      url,
      platform || "",
      spread_count || 0,
      spread_level || "medium",
      found_time || null,
    );

  const newOpinion = db
    .prepare("SELECT * FROM public_opinions WHERE id = ?")
    .get(info.lastInsertRowid);
  res.status(201).json(newOpinion);
});

app.get("/api/hospitals", (req, res) => {
  const hospitals = db.prepare("SELECT * FROM hospitals ORDER BY name").all();
  res.json(hospitals);
});

app.get("/api/departments", (req, res) => {
  const departments = db
    .prepare("SELECT * FROM departments ORDER BY name")
    .all();
  res.json(departments);
});

app.get("/api/stats/by-type", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT type, COUNT(*) as count,
           AVG(CASE WHEN status = 'closed' THEN CAST((julianday(close_time) - julianday(report_time)) * 24 AS REAL) END) as avg_hours
    FROM incidents
    GROUP BY type
    ORDER BY count DESC
  `,
    )
    .all();

  const result = rows.map((r) => ({
    type: r.type,
    type_text: INCIDENT_TYPES[r.type] || r.type,
    count: r.count,
    avg_hours: r.avg_hours ? Number(r.avg_hours.toFixed(1)) : 0,
  }));

  res.json(result);
});

app.get("/api/stats/by-hospital", (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT hospital, COUNT(*) as count,
           AVG(CASE WHEN status = 'closed' THEN CAST((julianday(close_time) - julianday(report_time)) * 24 AS REAL) END) as avg_hours
    FROM incidents
    GROUP BY hospital
    ORDER BY count DESC
  `,
    )
    .all();

  const result = rows.map((r) => ({
    hospital: r.hospital,
    count: r.count,
    avg_hours: r.avg_hours ? Number(r.avg_hours.toFixed(1)) : 0,
  }));

  res.json(result);
});

app.get("/api/stats/overview", (req, res) => {
  const total = db
    .prepare("SELECT COUNT(*) as count FROM incidents")
    .get().count;
  const pending = db
    .prepare("SELECT COUNT(*) as count FROM incidents WHERE status != 'closed'")
    .get().count;
  const critical = db
    .prepare(
      "SELECT COUNT(*) as count FROM incidents WHERE urgency_level = 'critical' AND status != 'closed'",
    )
    .get().count;
  const closed = db
    .prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'closed'")
    .get().count;

  const avgHoursRow = db
    .prepare(
      `
    SELECT AVG(CAST((julianday(close_time) - julianday(report_time)) * 24 AS REAL)) as avg_hours
    FROM incidents WHERE status = 'closed'
  `,
    )
    .get();

  res.json({
    total,
    pending,
    critical,
    closed,
    avg_hours: avgHoursRow.avg_hours
      ? Number(avgHoursRow.avg_hours.toFixed(1))
      : 0,
  });
});

app.get("/api/dict", (req, res) => {
  res.json({
    types: Object.entries(INCIDENT_TYPES).map(([value, label]) => ({
      value,
      label,
    })),
    statuses: Object.entries(STATUS_MAP).map(([value, label]) => ({
      value,
      label,
    })),
    urgencies: Object.entries(URGENCY_MAP).map(([value, label]) => ({
      value,
      label,
    })),
    task_statuses: Object.entries(TASK_STATUS_MAP).map(([value, label]) => ({
      value,
      label,
    })),
  });
});

const checkOverdueAndDeduct = (task, now) => {
  if (
    task.status !== "completed" &&
    !task.is_overdue &&
    new Date(task.deadline) < new Date(now)
  ) {
    const hours = DEADLINE_HOURS[task.urgency_level] || 48;
    let deduction = 0;
    if (task.urgency_level === "critical") deduction = 10;
    else if (task.urgency_level === "high") deduction = 5;
    else if (task.urgency_level === "medium") deduction = 3;
    else deduction = 1;

    db.prepare(
      "UPDATE collaboration_tasks SET is_overdue = 1, score_deducted = ?, status = 'overdue' WHERE id = ?",
    ).run(deduction, task.id);

    db.prepare(
      `INSERT INTO task_receipts (task_id, action, department, operator, remark, created_at)
       VALUES (?, '超时', ?, '系统', ?, ?)`,
    ).run(
      task.id,
      task.receive_department,
      `任务已超过时限，扣考核分 ${deduction} 分`,
      now,
    );

    return { is_overdue: 1, score_deducted: deduction, status: "overdue" };
  }
  return null;
};

const syncOverdueTasks = () => {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const tasks = db
    .prepare(
      "SELECT * FROM collaboration_tasks WHERE status != 'completed' AND is_overdue = 0",
    )
    .all();

  for (const task of tasks) {
    checkOverdueAndDeduct(task, now);
  }
};

const enrichTask = (task) => {
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const updated = checkOverdueAndDeduct(task, now);
  if (updated) {
    task = { ...task, ...updated };
  }

  let remaining_hours = null;
  let elapsed_hours = null;
  if (task.deadline && task.assign_time) {
    const deadlineMs = new Date(task.deadline).getTime();
    const assignMs = new Date(task.assign_time).getTime();
    const nowMs = Date.now();
    if (task.status === "completed" && task.completion_time) {
      elapsed_hours = Number(
        (
          (new Date(task.completion_time).getTime() - assignMs) /
          3600000
        ).toFixed(1),
      );
    } else {
      remaining_hours = Number(((deadlineMs - nowMs) / 3600000).toFixed(1));
      elapsed_hours = Number(((nowMs - assignMs) / 3600000).toFixed(1));
    }
  }

  return {
    ...task,
    status_text: TASK_STATUS_MAP[task.status] || task.status,
    urgency_text: URGENCY_MAP[task.urgency_level] || task.urgency_level,
    remaining_hours,
    elapsed_hours,
  };
};

app.get("/api/tasks", (req, res) => {
  const {
    status,
    department,
    assign_department,
    urgency,
    overdue_only,
    incident_id,
    sort,
  } = req.query;

  syncOverdueTasks();

  let sql = "SELECT * FROM collaboration_tasks WHERE 1=1";
  const params = [];

  if (status && status !== "all") {
    sql += " AND status = ?";
    params.push(status);
  }
  if (department && department !== "all") {
    sql += " AND receive_department = ?";
    params.push(department);
  }
  if (assign_department && assign_department !== "all") {
    sql += " AND assign_department = ?";
    params.push(assign_department);
  }
  if (urgency && urgency !== "all") {
    sql += " AND urgency_level = ?";
    params.push(urgency);
  }
  if (overdue_only === "1") {
    sql += " AND is_overdue = 1";
  }
  if (incident_id) {
    sql += " AND incident_id = ?";
    params.push(incident_id);
  }

  sql += " ORDER BY assign_time DESC";

  const tasks = db.prepare(sql).all(...params);

  if (sort === "urgency") {
    tasks.sort((a, b) => {
      const ua = URGENCY_ORDER[a.urgency_level] ?? 99;
      const ub = URGENCY_ORDER[b.urgency_level] ?? 99;
      if (ua !== ub) return ua - ub;
      const sa = TASK_STATUS_ORDER[a.status] ?? 99;
      const sb = TASK_STATUS_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return new Date(b.assign_time) - new Date(a.assign_time);
    });
  }

  const result = tasks.map(enrichTask);
  res.json({ list: result, total: result.length });
});

app.get("/api/tasks/department/:dept/summary", (req, res) => {
  const { dept } = req.params;

  syncOverdueTasks();

  const pendingAck = db
    .prepare(
      "SELECT COUNT(*) as count FROM collaboration_tasks WHERE receive_department = ? AND status = 'pending_acknowledge'",
    )
    .get(dept).count;

  const pendingHandle = db
    .prepare(
      "SELECT COUNT(*) as count FROM collaboration_tasks WHERE receive_department = ? AND status IN ('acknowledged', 'processing')",
    )
    .get(dept).count;

  const overdue = db
    .prepare(
      "SELECT COUNT(*) as count FROM collaboration_tasks WHERE receive_department = ? AND is_overdue = 1",
    )
    .get(dept).count;

  const completed = db
    .prepare(
      "SELECT COUNT(*) as count FROM collaboration_tasks WHERE receive_department = ? AND status = 'completed'",
    )
    .get(dept).count;

  res.json({
    department: dept,
    pending_acknowledge: pendingAck,
    pending_handle: pendingHandle,
    overdue,
    completed,
  });
});

app.get("/api/tasks/:id", (req, res) => {
  const { id } = req.params;
  const task = db
    .prepare("SELECT * FROM collaboration_tasks WHERE id = ?")
    .get(id);

  if (!task) {
    return res.status(404).json({ error: "任务不存在" });
  }

  const receipts = db
    .prepare(
      "SELECT * FROM task_receipts WHERE task_id = ? ORDER BY created_at ASC",
    )
    .all(id);

  let incident = null;
  if (task.incident_id) {
    const inc = db
      .prepare("SELECT * FROM incidents WHERE id = ?")
      .get(task.incident_id);
    if (inc) {
      incident = {
        id: inc.id,
        incident_no: inc.incident_no,
        type: inc.type,
        type_text: INCIDENT_TYPES[inc.type] || inc.type,
        hospital: inc.hospital,
        description: inc.description,
        status: inc.status,
        status_text: STATUS_MAP[inc.status] || inc.status,
      };
    }
  }

  res.json({
    ...enrichTask(task),
    receipts,
    incident,
  });
});

app.get("/api/incidents/:id/tasks", (req, res) => {
  const { id } = req.params;
  const tasks = db
    .prepare(
      "SELECT * FROM collaboration_tasks WHERE incident_id = ? ORDER BY assign_time ASC",
    )
    .all(id);
  const result = tasks.map(enrichTask);
  res.json({ list: result, total: result.length });
});

app.post("/api/incidents/:id/tasks", (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    assign_department,
    assign_user,
    receive_department,
    deadline,
    urgency_level,
  } = req.body;

  if (!title || !assign_department || !assign_user || !receive_department) {
    return res.status(400).json({ error: "缺少必要字段" });
  }

  const incident = db.prepare("SELECT * FROM incidents WHERE id = ?").get(id);
  if (!incident) {
    return res.status(404).json({ error: "事件不存在" });
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const urgency = urgency_level || incident.urgency_level || "normal";
  const hours = DEADLINE_HOURS[urgency] || 48;
  const finalDeadline =
    deadline ||
    new Date(Date.now() + hours * 3600000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = "RW" + dateStr;
  const last = db
    .prepare(
      "SELECT task_no FROM collaboration_tasks WHERE task_no LIKE ? ORDER BY id DESC LIMIT 1",
    )
    .get(prefix + "%");
  let seq = "001";
  if (last) {
    const num = parseInt(last.task_no.slice(-5)) + 1;
    seq = String(num).padStart(5, "0");
  }
  const task_no = prefix + seq;

  const info = db
    .prepare(
      `
    INSERT INTO collaboration_tasks 
    (task_no, incident_id, title, description, assign_department, assign_user, receive_department, deadline, urgency_level, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      task_no,
      id,
      title,
      description || "",
      assign_department,
      assign_user,
      receive_department,
      finalDeadline,
      urgency,
      now,
      now,
    );

  const taskId = info.lastInsertRowid;

  db.prepare(
    `
    INSERT INTO task_receipts (task_id, action, department, operator, remark, created_at)
    VALUES (?, '派发', ?, ?, ?, ?)
  `,
  ).run(
    taskId,
    assign_department,
    assign_user,
    `派发任务至 ${receive_department}`,
    now,
  );

  const newTask = db
    .prepare("SELECT * FROM collaboration_tasks WHERE id = ?")
    .get(taskId);

  res.status(201).json(enrichTask(newTask));
});

app.post("/api/tasks/:id/acknowledge", (req, res) => {
  const { id } = req.params;
  const { receive_user, receive_remark } = req.body;

  if (!receive_user) {
    return res.status(400).json({ error: "请填写签收人" });
  }

  const task = db
    .prepare("SELECT * FROM collaboration_tasks WHERE id = ?")
    .get(id);
  if (!task) {
    return res.status(404).json({ error: "任务不存在" });
  }
  if (task.status !== "pending_acknowledge" && task.status !== "overdue") {
    return res.status(400).json({ error: "当前任务状态不可签收" });
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);

  db.prepare(
    `
    UPDATE collaboration_tasks 
    SET status = 'processing', receive_user = ?, receive_time = ?, receive_remark = ?, updated_at = ?
    WHERE id = ?
  `,
  ).run(receive_user, now, receive_remark || "", now, id);

  db.prepare(
    `
    INSERT INTO task_receipts (task_id, action, department, operator, remark, created_at)
    VALUES (?, '签收', ?, ?, ?, ?)
  `,
  ).run(
    id,
    task.receive_department,
    receive_user,
    receive_remark || "已签收，开始处置",
    now,
  );

  const updated = db
    .prepare("SELECT * FROM collaboration_tasks WHERE id = ?")
    .get(id);
  const receipts = db
    .prepare(
      "SELECT * FROM task_receipts WHERE task_id = ? ORDER BY created_at ASC",
    )
    .all(id);

  res.json({
    ...enrichTask(updated),
    receipts,
  });
});

app.post("/api/tasks/:id/complete", (req, res) => {
  const { id } = req.params;
  const { completion_result, operator } = req.body;

  if (!completion_result) {
    return res.status(400).json({ error: "请填写完成情况" });
  }

  const task = db
    .prepare("SELECT * FROM collaboration_tasks WHERE id = ?")
    .get(id);
  if (!task) {
    return res.status(404).json({ error: "任务不存在" });
  }
  if (
    task.status !== "processing" &&
    task.status !== "acknowledged" &&
    task.status !== "overdue"
  ) {
    return res.status(400).json({ error: "当前任务状态不可提交完成" });
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  let finalDeduction = task.score_deducted || 0;

  if (!task.is_overdue && new Date(task.deadline) < new Date(now)) {
    if (task.urgency_level === "critical") finalDeduction = 10;
    else if (task.urgency_level === "high") finalDeduction = 5;
    else if (task.urgency_level === "medium") finalDeduction = 3;
    else finalDeduction = 1;
  }

  db.prepare(
    `
    UPDATE collaboration_tasks 
    SET status = 'completed', completion_result = ?, completion_time = ?, 
        is_overdue = CASE WHEN is_overdue = 1 THEN 1 ELSE ? END,
        score_deducted = ?, updated_at = ?
    WHERE id = ?
  `,
  ).run(
    completion_result,
    now,
    finalDeduction > 0 ? 1 : 0,
    finalDeduction,
    now,
    id,
  );

  const finalOperator = operator || task.receive_user || "未知";
  db.prepare(
    `
    INSERT INTO task_receipts (task_id, action, department, operator, remark, created_at)
    VALUES (?, '完成', ?, ?, ?, ?)
  `,
  ).run(id, task.receive_department, finalOperator, completion_result, now);

  if (finalDeduction > 0 && !task.is_overdue) {
    db.prepare(
      `
      INSERT INTO task_receipts (task_id, action, department, operator, remark, created_at)
      VALUES (?, '超时', ?, '系统', ?, ?)
    `,
    ).run(
      id,
      task.receive_department,
      `任务虽完成但已超时，追加扣考核分 ${finalDeduction} 分`,
      now,
    );
  }

  const updated = db
    .prepare("SELECT * FROM collaboration_tasks WHERE id = ?")
    .get(id);
  const receipts = db
    .prepare(
      "SELECT * FROM task_receipts WHERE task_id = ? ORDER BY created_at ASC",
    )
    .all(id);

  res.json({
    ...enrichTask(updated),
    receipts,
  });
});

app.get("/api/stats/tasks/deadline-rate", (req, res) => {
  const { department } = req.query;

  syncOverdueTasks();

  let deptCondition = "";
  const params = [];
  if (department && department !== "all") {
    deptCondition = "WHERE receive_department = ?";
    params.push(department);
  }

  const rows = db
    .prepare(
      `
    SELECT receive_department as department,
           COUNT(*) as total,
           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status = 'completed' AND is_overdue = 0 THEN 1 ELSE 0 END) as on_time,
           SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) as overdue,
           SUM(score_deducted) as total_deduction,
           AVG(CASE 
             WHEN status = 'completed' AND completion_time IS NOT NULL AND assign_time IS NOT NULL
             THEN CAST((julianday(completion_time) - julianday(assign_time)) * 24 AS REAL)
             ELSE NULL 
           END) as avg_completion_hours
    FROM collaboration_tasks
    ${deptCondition}
    GROUP BY receive_department
    ORDER BY total DESC
  `,
    )
    .all(...params);

  const result = rows.map((r) => {
    const deadline_rate =
      r.completed > 0
        ? Number(((r.on_time / r.completed) * 100).toFixed(1))
        : 0;
    const completion_rate =
      r.total > 0 ? Number(((r.completed / r.total) * 100).toFixed(1)) : 0;
    return {
      department: r.department,
      total: r.total,
      completed: r.completed,
      on_time: r.on_time,
      overdue: r.overdue,
      total_deduction: r.total_deduction || 0,
      deadline_rate,
      completion_rate,
      avg_completion_hours: r.avg_completion_hours
        ? Number(r.avg_completion_hours.toFixed(1))
        : 0,
    };
  });

  const summary = {
    total: result.reduce((s, r) => s + r.total, 0),
    completed: result.reduce((s, r) => s + r.completed, 0),
    on_time: result.reduce((s, r) => s + r.on_time, 0),
    overdue: result.reduce((s, r) => s + r.overdue, 0),
    total_deduction: result.reduce((s, r) => s + r.total_deduction, 0),
  };
  summary.deadline_rate =
    summary.completed > 0
      ? Number(((summary.on_time / summary.completed) * 100).toFixed(1))
      : 0;
  summary.completion_rate =
    summary.total > 0
      ? Number(((summary.completed / summary.total) * 100).toFixed(1))
      : 0;

  res.json({ departments: result, summary });
});

app.get("/api/stats/tasks/drilldown", (req, res) => {
  const { department, status } = req.query;

  let sql = `
    SELECT t.*, i.incident_no, i.type as incident_type, i.hospital, i.type as incident_type_raw
    FROM collaboration_tasks t
    LEFT JOIN incidents i ON t.incident_id = i.id
    WHERE 1=1
  `;
  const params = [];

  if (department && department !== "all") {
    sql += " AND t.receive_department = ?";
    params.push(department);
  }
  if (status && status !== "all") {
    sql += " AND t.status = ?";
    params.push(status);
  }

  sql += " ORDER BY t.assign_time DESC";

  const rows = db.prepare(sql).all(...params);
  const result = rows.map((r) => {
    const enriched = enrichTask(r);
    return {
      ...enriched,
      incident_no: r.incident_no,
      incident_type: INCIDENT_TYPES[r.incident_type_raw] || r.incident_type_raw,
      incident_type_raw: r.incident_type_raw,
      hospital: r.hospital,
    };
  });

  res.json({ list: result, total: result.length });
});

app.get("/api/stats/tasks/overview", (req, res) => {
  syncOverdueTasks();
  const total = db
    .prepare("SELECT COUNT(*) as count FROM collaboration_tasks")
    .get().count;
  const pendingAck = db
    .prepare(
      "SELECT COUNT(*) as count FROM collaboration_tasks WHERE status = 'pending_acknowledge'",
    )
    .get().count;
  const processing = db
    .prepare(
      "SELECT COUNT(*) as count FROM collaboration_tasks WHERE status IN ('acknowledged', 'processing')",
    )
    .get().count;
  const completed = db
    .prepare(
      "SELECT COUNT(*) as count FROM collaboration_tasks WHERE status = 'completed'",
    )
    .get().count;
  const overdue = db
    .prepare(
      "SELECT COUNT(*) as count FROM collaboration_tasks WHERE is_overdue = 1",
    )
    .get().count;
  const totalDeduction = db
    .prepare(
      "SELECT COALESCE(SUM(score_deducted), 0) as total FROM collaboration_tasks",
    )
    .get().total;

  res.json({
    total,
    pending_acknowledge: pendingAck,
    processing,
    completed,
    overdue,
    total_deduction: totalDeduction,
  });
});

app.get("/api/reviews/:incidentId", (req, res) => {
  const { incidentId } = req.params;
  const review = db
    .prepare("SELECT * FROM case_reviews WHERE incident_id = ?")
    .get(incidentId);
  if (!review) {
    return res.status(404).json({ error: "复盘不存在" });
  }
  res.json(review);
});

app.post("/api/reviews/:incidentId", (req, res) => {
  const { incidentId } = req.params;
  const { summary, qualitative, key_points, reviewer } = req.body;

  if (!summary || !qualitative || !key_points || !reviewer) {
    return res.status(400).json({ error: "缺少必填字段" });
  }

  const incident = db
    .prepare("SELECT id, status FROM incidents WHERE id = ?")
    .get(incidentId);
  if (!incident) {
    return res.status(404).json({ error: "事件不存在" });
  }

  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  const existing = db
    .prepare("SELECT id FROM case_reviews WHERE incident_id = ?")
    .get(incidentId);

  if (existing) {
    db.prepare(
      `
      UPDATE case_reviews 
      SET summary = ?, qualitative = ?, key_points = ?, reviewer = ?, reviewed_at = ?, updated_at = ?
      WHERE incident_id = ?
    `,
    ).run(summary, qualitative, key_points, reviewer, now, now, incidentId);
  } else {
    db.prepare(
      `
      INSERT INTO case_reviews (incident_id, summary, qualitative, key_points, reviewer, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    ).run(incidentId, summary, qualitative, key_points, reviewer, now);
  }

  const review = db
    .prepare("SELECT * FROM case_reviews WHERE incident_id = ?")
    .get(incidentId);
  res.json(review);
});

app.get("/api/plans", (req, res) => {
  const { type, keyword, hospital, department } = req.query;

  let sql = "SELECT * FROM preparedness_plans WHERE 1=1";
  const params = [];

  if (type && type !== "all") {
    sql += " AND type = ?";
    params.push(type);
  }
  if (keyword) {
    sql +=
      " AND (title LIKE ? OR qualitative LIKE ? OR key_points LIKE ? OR reference_incident_no LIKE ?)";
    const kw = `%${keyword}%`;
    params.push(kw, kw, kw, kw);
  }
  if (hospital) {
    sql += " AND (applicable_hospitals LIKE ? OR applicable_hospitals IS NULL)";
    params.push(`%${hospital}%`);
  }
  if (department) {
    sql +=
      " AND (applicable_departments LIKE ? OR applicable_departments IS NULL)";
    params.push(`%${department}%`);
  }

  sql += " ORDER BY use_count DESC, created_at DESC";

  const rows = db.prepare(sql).all(...params);

  const result = rows.map((r) => ({
    ...r,
    type_text: INCIDENT_TYPES[r.type] || r.type,
    suggested_steps: (() => {
      try {
        return JSON.parse(r.suggested_steps);
      } catch {
        return [];
      }
    })(),
  }));

  res.json({ list: result, total: result.length });
});

app.get("/api/plans/match", (req, res) => {
  const { type, hospital, department, description } = req.query;

  if (!type) {
    return res.json({ matches: [], suggestions: [] });
  }

  const desc = description || "";
  const kwKeywords = [];
  const extractKws = (text) => {
    const patterns = [
      /抢救|死亡|病逝/g,
      /手术|术后/g,
      /家属/g,
      /拉横幅|横幅|灵堂/g,
      /抖音|微博|网络|微信/g,
      /短信|电话|威胁/g,
      /醉酒|酒精/g,
      /红包/g,
      /妇产科|分娩|产妇/g,
      /儿科|儿童/g,
      /急诊科|急诊/g,
      /住院|住院部/g,
    ];
    patterns.forEach((p) => {
      const m = text.match(p);
      if (m) kwKeywords.push(...new Set(m));
    });
  };
  extractKws(desc);

  let sql = `
    SELECT * FROM preparedness_plans 
    WHERE type = ? 
    ORDER BY use_count DESC, created_at DESC 
    LIMIT 10
  `;
  const candidates = db.prepare(sql).all(type);

  const matches = candidates.map((p) => {
    let score = 0;
    const reasons = [];

    score += (p.use_count || 0) * 2;

    if (
      hospital &&
      p.applicable_hospitals &&
      p.applicable_hospitals.includes(hospital)
    ) {
      score += 15;
      reasons.push(`适用医院匹配（${hospital}）`);
    }

    if (
      department &&
      p.applicable_departments &&
      p.applicable_departments.includes(department)
    ) {
      score += 10;
      reasons.push(`适用科室匹配（${department}）`);
    }

    if (p.qualitative) {
      kwKeywords.forEach((kw) => {
        if (p.qualitative.includes(kw)) {
          score += 3;
          reasons.push(`关键词匹配（${kw}）`);
        }
      });
    }
    if (p.key_points) {
      kwKeywords.forEach((kw) => {
        if (p.key_points.includes(kw)) {
          score += 2;
        }
      });
    }

    if (reasons.length === 0) {
      reasons.push(`同类型历史预案（${INCIDENT_TYPES[p.type] || p.type}）`);
    }

    return {
      id: p.id,
      plan_no: p.plan_no,
      type: p.type,
      type_text: INCIDENT_TYPES[p.type] || p.type,
      title: p.title,
      qualitative: p.qualitative,
      key_points: p.key_points,
      reference_incident_no: p.reference_incident_no,
      use_count: p.use_count || 0,
      score,
      match_reasons: reasons,
      suggested_steps: (() => {
        try {
          return JSON.parse(p.suggested_steps);
        } catch {
          return [];
        }
      })(),
    };
  });

  matches.sort((a, b) => b.score - a.score);
  const topMatches = matches.slice(0, 3);

  const suggestions = [];
  if (topMatches.length > 0) {
    const top = topMatches[0];
    suggestions.push({
      type: "primary",
      title: "建议优先参考",
      content: top.title,
      plan_id: top.id,
      plan_no: top.plan_no,
    });
  }

  const highRiskHospitals = db
    .prepare(
      `
      SELECT hospital, COUNT(*) as count FROM incidents 
      WHERE report_time >= DATE('now', '-30 days') 
      GROUP BY hospital HAVING count >= 3
      ORDER BY count DESC
    `,
    )
    .all();
  const highRiskDepts = db
    .prepare(
      `
      SELECT hospital, department, COUNT(*) as count FROM incidents 
      WHERE report_time >= DATE('now', '-30 days') 
      GROUP BY hospital, department HAVING count >= 2
      ORDER BY count DESC
    `,
    )
    .all();

  let riskTip = null;
  const targetHrHospital = highRiskHospitals.find(
    (h) => h.hospital === hospital,
  );
  const targetHrDept = highRiskDepts.find(
    (d) => d.hospital === hospital && d.department === department,
  );
  if (targetHrHospital || targetHrDept) {
    const parts = [];
    if (targetHrHospital) {
      parts.push(
        `【${targetHrHospital.hospital}】近30天发生${targetHrHospital.count}起案事件，属高发单位`,
      );
    }
    if (targetHrDept) {
      parts.push(
        `【${targetHrDept.hospital}${targetHrDept.department}】近30天发生${targetHrDept.count}起，属高发科室`,
      );
    }
    riskTip = parts.join("；");
  }

  res.json({
    matches: topMatches,
    suggestions,
    risk_tip: riskTip,
    high_risk_hospitals: highRiskHospitals,
    high_risk_departments: highRiskDepts,
  });
});

app.post("/api/plans/:id/increment", (req, res) => {
  const { id } = req.params;
  db.prepare(
    "UPDATE preparedness_plans SET use_count = use_count + 1 WHERE id = ?",
  ).run(id);
  const plan = db
    .prepare("SELECT id, use_count FROM preparedness_plans WHERE id = ?")
    .get(id);
  res.json(plan);
});

app.get("/api/plans/:id", (req, res) => {
  const { id } = req.params;
  const plan = db
    .prepare("SELECT * FROM preparedness_plans WHERE id = ?")
    .get(id);
  if (!plan) {
    return res.status(404).json({ error: "预案不存在" });
  }
  db.prepare(
    "UPDATE preparedness_plans SET use_count = use_count + 1 WHERE id = ?",
  ).run(id);
  plan.use_count = (plan.use_count || 0) + 1;

  res.json({
    ...plan,
    type_text: INCIDENT_TYPES[plan.type] || plan.type,
    suggested_steps: (() => {
      try {
        return JSON.parse(plan.suggested_steps);
      } catch {
        return [];
      }
    })(),
  });
});

app.get("/api/stats/high-risk", (req, res) => {
  const { threshold_hospital = 3, threshold_dept = 2, days = 30 } = req.query;

  const hospitalRows = db
    .prepare(
      `
      SELECT hospital, COUNT(*) as count,
             SUM(CASE WHEN urgency_level = 'critical' THEN 1 ELSE 0 END) as critical_count,
             SUM(CASE WHEN urgency_level = 'high' THEN 1 ELSE 0 END) as high_count
      FROM incidents 
      WHERE report_time >= DATE('now', ? || ' days') 
      GROUP BY hospital HAVING count >= ?
      ORDER BY count DESC
    `,
    )
    .all(`-${days}`, Number(threshold_hospital));

  const deptRows = db
    .prepare(
      `
      SELECT hospital, department, COUNT(*) as count,
             SUM(CASE WHEN urgency_level = 'critical' THEN 1 ELSE 0 END) as critical_count,
             SUM(CASE WHEN urgency_level = 'high' THEN 1 ELSE 0 END) as high_count
      FROM incidents 
      WHERE report_time >= DATE('now', ? || ' days') 
      GROUP BY hospital, department HAVING count >= ?
      ORDER BY count DESC
    `,
    )
    .all(`-${days}`, Number(threshold_dept));

  const recentStart = db
    .prepare(
      "SELECT COUNT(*) as count FROM incidents WHERE report_time >= DATE('now', '-7 days')",
    )
    .get().count;
  const prevStart = db
    .prepare(
      "SELECT COUNT(*) as count FROM incidents WHERE report_time >= DATE('now', '-14 days') AND report_time < DATE('now', '-7 days')",
    )
    .get().count;
  const weekGrowth = prevStart
    ? Number((((recentStart - prevStart) / prevStart) * 100).toFixed(1))
    : recentStart > 0
      ? 100
      : 0;

  res.json({
    high_risk_hospitals: hospitalRows,
    high_risk_departments: deptRows,
    summary: {
      total_high_risk_hospitals: hospitalRows.length,
      total_high_risk_departments: deptRows.length,
      recent_week_count: recentStart,
      previous_week_count: prevStart,
      week_growth_rate: weekGrowth,
    },
  });
});

app.get("/api/stats/by-department", (req, res) => {
  const { hospital } = req.query;
  let sql = `
    SELECT hospital, department, COUNT(*) as count,
           AVG(CASE WHEN status = 'closed' THEN CAST((julianday(close_time) - julianday(report_time)) * 24 AS REAL) END) as avg_hours
    FROM incidents WHERE 1=1
  `;
  const params = [];
  if (hospital && hospital !== "all") {
    sql += " AND hospital = ?";
    params.push(hospital);
  }
  sql += " GROUP BY hospital, department ORDER BY count DESC";

  const rows = db.prepare(sql).all(...params);
  const result = rows.map((r) => ({
    ...r,
    avg_hours: r.avg_hours ? Number(r.avg_hours.toFixed(1)) : 0,
  }));
  res.json(result);
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SafeMed 后端服务运行在 http://localhost:${PORT}`);
  });
}

module.exports = app;
