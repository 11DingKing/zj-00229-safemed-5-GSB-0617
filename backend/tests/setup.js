const request = require("supertest");

process.env.SAFEMED_DB_PATH = ":memory:";
process.env.SAFEMED_SKIP_SEED = "1";

function clearRequireCache() {
  const serverPath = require.resolve("../server");
  const dbPath = require.resolve("../database");
  delete require.cache[serverPath];
  delete require.cache[dbPath];
}

function createTestApp() {
  clearRequireCache();
  const app = require("../server");
  return app;
}

function seedTestData(app) {
  const db = require("../database");

  const hospitals = [
    ["测试医院A", "三甲", "测试地址A"],
    ["测试医院B", "三甲", "测试地址B"],
    ["测试医院C", "二甲", "测试地址C"],
  ];

  const departments = [
    ["急诊科", "medical"],
    ["内科", "medical"],
    ["外科", "medical"],
    ["妇产科", "medical"],
    ["医院安保科", "support"],
    ["医院医务科", "support"],
    ["医院宣传科", "support"],
    ["辖区派出所", "external"],
    ["市卫健局", "external"],
    ["市卫健局宣传处", "external"],
    ["医患纠纷调解中心", "external"],
  ];

  const insertHospital = db.prepare(
    "INSERT INTO hospitals (name, level, address) VALUES (?, ?, ?)",
  );
  const insertDept = db.prepare(
    "INSERT INTO departments (name, type) VALUES (?, ?)",
  );

  hospitals.forEach((h) => insertHospital.run(h[0], h[1], h[2]));
  departments.forEach((d) => insertDept.run(d[0], d[1]));

  return { hospitals, departments };
}

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

async function createIncident(app, overrides = {}) {
  const defaultData = {
    type: "violence",
    hospital: "测试医院A",
    department: "急诊科",
    description: "测试事件描述",
    injury_impact: "测试影响",
    urgency_level: "normal",
    reporter: "测试员",
  };

  const res = await request(app)
    .post("/api/incidents")
    .send({ ...defaultData, ...overrides });

  return res;
}

async function advanceStatus(app, id, status, extra = {}) {
  const actionMap = {
    responding: "联动响应",
    investigating: "调查",
    closed: "处理结案",
  };

  const payload = {
    status,
    action: actionMap[status] || status,
    department: "医院医务科",
    operator: "测试操作员",
    remark: `测试流转到${status}`,
    ...extra,
  };

  if (status === "closed" && !payload.review) {
    payload.review = {
      summary: "测试结案复盘小结",
      qualitative: "测试定性",
      key_points: "测试处置要点",
      reviewer: "测试复盘人",
    };
  }

  const res = await request(app)
    .post(`/api/incidents/${id}/disposition`)
    .send(payload);

  return res;
}

async function fullFlowToClosed(app, overrides = {}) {
  const createRes = await createIncident(app, overrides);
  const incident = createRes.body;

  await advanceStatus(app, incident.id, "responding");
  await advanceStatus(app, incident.id, "investigating");
  await advanceStatus(app, incident.id, "closed");

  const detailRes = await request(app).get(`/api/incidents/${incident.id}`);
  return detailRes.body;
}

async function addOpinion(app, id, overrides = {}) {
  const defaultData = {
    title: "测试舆情标题",
    url: "https://example.com/test",
    platform: "微博",
    spread_count: 100,
    spread_level: "medium",
  };

  const res = await request(app)
    .post(`/api/incidents/${id}/opinions`)
    .send({ ...defaultData, ...overrides });

  return res;
}

module.exports = {
  createTestApp,
  seedTestData,
  createIncident,
  advanceStatus,
  fullFlowToClosed,
  addOpinion,
  INCIDENT_TYPES,
  STATUS_MAP,
  URGENCY_MAP,
};
