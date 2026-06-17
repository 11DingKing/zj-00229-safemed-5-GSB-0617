const Database = require("better-sqlite3");
const path = require("path");

const dbPath =
  process.env.SAFEMED_DB_PATH || path.join(__dirname, "data", "safemed.db");
const isMemoryDb = dbPath === ":memory:";
const db = new Database(dbPath);

if (!isMemoryDb) {
  db.pragma("journal_mode = WAL");
}
db.pragma("foreign_keys = ON");

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      hospital TEXT NOT NULL,
      department TEXT NOT NULL,
      description TEXT NOT NULL,
      injury_impact TEXT,
      urgency_level TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'reported',
      reporter TEXT NOT NULL,
      report_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      response_time DATETIME,
      investigate_time DATETIME,
      close_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS disposition_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      action TEXT NOT NULL,
      department TEXT NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS public_opinions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      platform TEXT,
      spread_count INTEGER DEFAULT 0,
      spread_level TEXT,
      found_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      level TEXT,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'medical'
    );

    CREATE TABLE IF NOT EXISTS collaboration_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_no TEXT UNIQUE NOT NULL,
      incident_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      assign_department TEXT NOT NULL,
      assign_user TEXT NOT NULL,
      assign_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      receive_department TEXT NOT NULL,
      deadline DATETIME NOT NULL,
      urgency_level TEXT DEFAULT 'normal',
      status TEXT DEFAULT 'pending_acknowledge',
      receive_user TEXT,
      receive_time DATETIME,
      receive_remark TEXT,
      completion_result TEXT,
      completion_time DATETIME,
      is_overdue INTEGER DEFAULT 0,
      score_deducted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      department TEXT NOT NULL,
      operator TEXT NOT NULL,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES collaboration_tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS case_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      incident_id INTEGER UNIQUE NOT NULL,
      summary TEXT NOT NULL,
      qualitative TEXT NOT NULL,
      key_points TEXT NOT NULL,
      reviewer TEXT NOT NULL,
      reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS preparedness_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      qualitative TEXT NOT NULL,
      key_points TEXT NOT NULL,
      suggested_steps TEXT NOT NULL,
      applicable_hospitals TEXT,
      applicable_departments TEXT,
      reference_incident_no TEXT,
      use_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function seedInitialData() {
  const hospitalCount = db
    .prepare("SELECT COUNT(*) as count FROM hospitals")
    .get().count;
  if (hospitalCount > 0) return;

  const insertHospital = db.prepare(
    "INSERT INTO hospitals (name, level, address) VALUES (?, ?, ?)",
  );
  const hospitals = [
    ["市第一人民医院", "三甲", "市中心区人民路1号"],
    ["市第二人民医院", "三甲", "城东区建设路88号"],
    ["市中医院", "三甲", "城西区健康路56号"],
    ["区妇幼保健院", "二甲", "南区滨河大道12号"],
    ["社区卫生服务中心", "一甲", "北区文化路33号"],
  ];
  const insertDept = db.prepare(
    "INSERT INTO departments (name, type) VALUES (?, ?)",
  );
  const departments = [
    ["急诊科", "medical"],
    ["内科", "medical"],
    ["外科", "medical"],
    ["儿科", "medical"],
    ["妇产科", "medical"],
    ["骨科", "medical"],
    ["神经内科", "medical"],
    ["心内科", "medical"],
    ["门诊部", "medical"],
    ["住院部", "medical"],
    ["医院安保科", "support"],
    ["医院医务科", "support"],
    ["医院宣传科", "support"],
    ["医院纪委", "support"],
    ["辖区派出所", "external"],
    ["市卫健局", "external"],
    ["市卫健局宣传处", "external"],
    ["市卫健局纪检组", "external"],
    ["医患纠纷调解中心", "external"],
  ];

  const insertIncident = db.prepare(`
    INSERT INTO incidents 
    (incident_no, type, hospital, department, description, injury_impact, urgency_level, status, reporter, report_time, response_time, investigate_time, close_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertLog = db.prepare(`
    INSERT INTO disposition_logs (incident_id, status, action, department, operator, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertOpinion = db.prepare(`
    INSERT INTO public_opinions (incident_id, title, url, platform, spread_count, spread_level, found_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTask = db.prepare(`
    INSERT INTO collaboration_tasks 
    (task_no, incident_id, title, description, assign_department, assign_user, assign_time, receive_department, deadline, urgency_level, status, receive_user, receive_time, receive_remark, completion_result, completion_time, is_overdue, score_deducted)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReceipt = db.prepare(`
    INSERT INTO task_receipts (task_id, action, department, operator, remark)
    VALUES (?, ?, ?, ?, ?)
  `);

  hospitals.forEach((h) => insertHospital.run(h[0], h[1], h[2]));
  departments.forEach((d) => insertDept.run(d[0], d[1]));

  const incidents = [
    {
      no: "YL20260601001",
      type: "violence",
      hospital: "市第一人民医院",
      dept: "急诊科",
      desc: "患者家属因对抢救结果不满，殴打值班医生，致医生头部受伤",
      injury: "值班医生头部裂伤，轻度脑震荡",
      urgency: "critical",
      status: "closed",
      reporter: "张护士",
      reportTime: "2026-06-01 08:30:00",
      responseTime: "2026-06-01 08:35:00",
      investigateTime: "2026-06-01 09:10:00",
      closeTime: "2026-06-01 16:30:00",
      logs: [
        {
          status: "reported",
          action: "接报",
          dept: "医院安保科",
          operator: "李安保",
          remark: "急诊科护士电话报警",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "医院安保科",
          operator: "李安保",
          remark: "保安3分钟到达现场控制局面",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "辖区派出所",
          operator: "王警官",
          remark: "民警10分钟到达现场",
        },
        {
          status: "investigating",
          action: "调查",
          dept: "辖区派出所",
          operator: "王警官",
          remark: "调取监控，询问证人，固定证据",
        },
        {
          status: "investigating",
          action: "调查",
          dept: "医院医务科",
          operator: "赵主任",
          remark: "组织专家评估医疗行为",
        },
        {
          status: "closed",
          action: "处理结案",
          dept: "辖区派出所",
          operator: "王警官",
          remark: "对打人者处以行政拘留10日，罚款500元",
        },
      ],
      opinions: [],
    },
    {
      no: "YL20260602001",
      type: "gathering",
      hospital: "市第二人民医院",
      dept: "外科",
      desc: "患者术后并发症死亡，家属组织20余人在医院大厅拉横幅、烧纸钱",
      injury: "造成门诊大厅秩序混乱，部分诊疗活动暂停",
      urgency: "critical",
      status: "investigating",
      reporter: "刘主任",
      reportTime: "2026-06-02 10:15:00",
      responseTime: "2026-06-02 10:25:00",
      investigateTime: "2026-06-02 14:00:00",
      closeTime: null,
      logs: [
        {
          status: "reported",
          action: "接报",
          dept: "医院医务科",
          operator: "刘主任",
          remark: "外科主任电话报告",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "医院安保科",
          operator: "陈队长",
          remark: "组织保安维持秩序",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "市卫健局",
          operator: "孙科长",
          remark: "医政科人员赶赴现场",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "辖区派出所",
          operator: "周警官",
          remark: "民警到达现场劝导",
        },
        {
          status: "investigating",
          action: "调查",
          dept: "市卫健局",
          operator: "孙科长",
          remark: "组织专家讨论病例",
        },
      ],
      opinions: [],
    },
    {
      no: "YL20260603001",
      type: "online",
      hospital: "市中医院",
      dept: "门诊部",
      desc: '网友在微博发帖称中医院"小病大治"，短短半天转发5000+',
      injury: "医院声誉受损，咨询投诉电话激增",
      urgency: "high",
      status: "responding",
      reporter: "舆情监测员",
      reportTime: "2026-06-03 09:00:00",
      responseTime: "2026-06-03 09:30:00",
      investigateTime: null,
      closeTime: null,
      logs: [
        {
          status: "reported",
          action: "接报",
          dept: "医院宣传科",
          operator: "舆情监测员",
          remark: "日常舆情监测发现",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "市卫健局宣传处",
          operator: "吴处长",
          remark: "启动舆情应对预案",
        },
      ],
      opinions: [
        {
          title: "中医院坑人！感冒花了三千块",
          url: "https://weibo.com/123456789/abcdef",
          platform: "微博",
          count: 5680,
          level: "high",
          foundTime: "2026-06-03 08:45:00",
        },
        {
          title: "曝光市中医院过度医疗",
          url: "https://bbs.example.com/thread-12345",
          platform: "本地论坛",
          count: 1200,
          level: "medium",
          foundTime: "2026-06-03 09:10:00",
        },
      ],
    },
    {
      no: "YL20260604001",
      type: "threat",
      hospital: "市第二人民医院",
      dept: "外科",
      desc: '产妇家属因对分娩过程不满，扬言要"找医生算账"',
      injury: "当事医生心理受影响，暂时停岗",
      urgency: "high",
      status: "investigating",
      reporter: "护士长",
      reportTime: "2026-06-11 15:20:00",
      responseTime: "2026-06-11 15:35:00",
      investigateTime: "2026-06-11 17:00:00",
      closeTime: null,
      logs: [
        {
          status: "reported",
          action: "接报",
          dept: "妇产科",
          operator: "护士长",
          remark: "家属在护士站大声争吵时出言威胁",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "医院安保科",
          operator: "保安队长",
          remark: "加强妇产科安保力量",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "辖区派出所",
          operator: "社区民警",
          remark: "上门约谈家属",
        },
        {
          status: "investigating",
          action: "调查",
          dept: "医院医务科",
          operator: "医务科主任",
          remark: "核查诊疗过程是否规范",
        },
      ],
      opinions: [],
    },
    {
      no: "YL20260605001",
      type: "violence",
      hospital: "市第一人民医院",
      dept: "急诊科",
      desc: "醉酒患者因排队问题推搡医生，摔砸办公物品",
      injury: "医生手臂擦伤，电脑显示器损坏",
      urgency: "medium",
      status: "reported",
      reporter: "导诊护士",
      reportTime: "2026-06-10 19:45:00",
      responseTime: null,
      investigateTime: null,
      closeTime: null,
      logs: [
        {
          status: "reported",
          action: "接报",
          dept: "市第一人民医院",
          operator: "导诊护士",
          remark: "患者醉酒后滋事",
        },
      ],
      opinions: [],
    },
    {
      no: "YL20260606001",
      type: "online",
      hospital: "市第一人民医院",
      dept: "心内科",
      desc: "抖音视频称心内科医生收红包，点赞过万",
      injury: "涉事医生名誉受损，科室工作受影响",
      urgency: "high",
      status: "investigating",
      reporter: "宣传科",
      reportTime: "2026-06-06 11:00:00",
      responseTime: "2026-06-06 11:20:00",
      investigateTime: "2026-06-06 14:30:00",
      closeTime: null,
      logs: [
        {
          status: "reported",
          action: "接报",
          dept: "医院宣传科",
          operator: "宣传干事",
          remark: "抖音短视频平台监测到",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "市卫健局",
          operator: "纪检组",
          remark: "介入调查",
        },
        {
          status: "investigating",
          action: "调查",
          dept: "医院纪委",
          operator: "纪委书记",
          remark: "调取相关记录，约谈当事人",
        },
      ],
      opinions: [
        {
          title: "实拍市一院心内科医生收红包",
          url: "https://www.douyin.com/video/1234567890",
          platform: "抖音",
          count: 15200,
          level: "high",
          foundTime: "2026-06-06 10:30:00",
        },
      ],
    },
    {
      no: "YL20260607001",
      type: "gathering",
      hospital: "市中医院",
      dept: "住院部",
      desc: "老年患者病逝，家属十余人群聚住院部讨说法",
      injury: "住院部秩序受影响，其他患者家属有意见",
      urgency: "medium",
      status: "closed",
      reporter: "住院部主任",
      reportTime: "2026-06-07 08:00:00",
      responseTime: "2026-06-07 08:15:00",
      investigateTime: "2026-06-07 10:00:00",
      closeTime: "2026-06-07 18:00:00",
      logs: [
        {
          status: "reported",
          action: "接报",
          dept: "住院部",
          operator: "住院部主任",
          remark: "患者凌晨病逝，早晨家属聚集",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "医院安保科",
          operator: "安保科长",
          remark: "到场维持秩序",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "辖区派出所",
          operator: "民警",
          remark: "到场劝导疏散",
        },
        {
          status: "investigating",
          action: "调查",
          dept: "医务科",
          operator: "医务科长",
          remark: "向家属解释病情和治疗过程",
        },
        {
          status: "closed",
          action: "处理结案",
          dept: "医患纠纷调解中心",
          operator: "调解员",
          remark: "家属理解病情，达成和解，离开医院",
        },
      ],
      opinions: [],
    },
    {
      no: "YL20260608001",
      type: "threat",
      hospital: "市第二人民医院",
      dept: "骨科",
      desc: "患者对手术效果不满意，短信威胁主治医生",
      injury: "医生收到威胁短信，情绪紧张",
      urgency: "normal",
      status: "responding",
      reporter: "主治医生",
      reportTime: "2026-06-12 14:30:00",
      responseTime: "2026-06-12 15:00:00",
      investigateTime: null,
      closeTime: null,
      logs: [
        {
          status: "reported",
          action: "接报",
          dept: "骨科",
          operator: "主治医生",
          remark: "收到患者威胁短信已截图保存",
        },
        {
          status: "responding",
          action: "联动响应",
          dept: "医院安保科",
          operator: "安保人员",
          remark: "加强医生上下班安保",
        },
      ],
      opinions: [],
    },
  ];

  incidents.forEach((inc) => {
    const info = insertIncident.run(
      inc.no,
      inc.type,
      inc.hospital,
      inc.dept,
      inc.desc,
      inc.injury,
      inc.urgency,
      inc.status,
      inc.reporter,
      inc.reportTime,
      inc.responseTime,
      inc.investigateTime,
      inc.closeTime,
    );
    const incidentId = info.lastInsertRowid;

    inc.logs.forEach((log) => {
      insertLog.run(
        incidentId,
        log.status,
        log.action,
        log.dept,
        log.operator,
        log.remark,
      );
    });

    inc.opinions.forEach((op) => {
      insertOpinion.run(
        incidentId,
        op.title,
        op.url,
        op.platform,
        op.count,
        op.level,
        op.foundTime,
      );
    });

    inc._tasks = [];
  });

  const taskSeedData = [
    {
      incidentNo: "YL20260601001",
      tasks: [
        {
          taskNo: "RW2026060100101",
          title: "现场控制与人员救治",
          description: "立即到达现场控制局面，救治受伤医生",
          assignDept: "医院值班室",
          assignUser: "李值班",
          assignTime: "2026-06-01 08:31:00",
          receiveDept: "医院安保科",
          deadline: "2026-06-01 09:00:00",
          urgency: "critical",
          status: "completed",
          receiveUser: "李安保",
          receiveTime: "2026-06-01 08:32:00",
          receiveRemark: "收到，立即带领3名保安赶赴现场",
          completionResult:
            "已控制打人者，将受伤医生送往外科救治，现场秩序恢复",
          completionTime: "2026-06-01 08:55:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
        {
          taskNo: "RW2026060100102",
          title: "案件调查取证",
          description: "调取监控录像，询问目击证人，固定相关证据",
          assignDept: "医院值班室",
          assignUser: "李值班",
          assignTime: "2026-06-01 08:31:00",
          receiveDept: "辖区派出所",
          deadline: "2026-06-01 12:00:00",
          urgency: "critical",
          status: "completed",
          receiveUser: "王警官",
          receiveTime: "2026-06-01 08:40:00",
          receiveRemark: "民警已出警，正在赶赴现场",
          completionResult:
            "已完成调查取证，调取监控3段，询问证人5名，形成询问笔录5份",
          completionTime: "2026-06-01 11:30:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
        {
          taskNo: "RW2026060100103",
          title: "医疗行为评估",
          description: "组织专家对抢救过程进行评估，判断医疗行为是否规范",
          assignDept: "医院医务科",
          assignUser: "赵主任",
          assignTime: "2026-06-01 09:30:00",
          receiveDept: "医院医务科",
          deadline: "2026-06-01 16:00:00",
          urgency: "high",
          status: "completed",
          receiveUser: "赵主任",
          receiveTime: "2026-06-01 09:35:00",
          receiveRemark: "立即组织外科、急诊科专家会诊",
          completionResult: "专家评估认为抢救过程符合诊疗规范，无医疗过错",
          completionTime: "2026-06-01 15:00:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
      ],
    },
    {
      incidentNo: "YL20260602001",
      tasks: [
        {
          taskNo: "RW2026060200101",
          title: "现场秩序维护",
          description: "组织足够安保力量到现场维持秩序，防止事态扩大",
          assignDept: "医院值班室",
          assignUser: "李值班",
          assignTime: "2026-06-02 10:16:00",
          receiveDept: "医院安保科",
          deadline: "2026-06-02 10:45:00",
          urgency: "critical",
          status: "completed",
          receiveUser: "陈队长",
          receiveTime: "2026-06-02 10:20:00",
          receiveRemark: "已调集10名保安赶赴现场",
          completionResult: "已在现场设置隔离带，维护大厅秩序，未发生肢体冲突",
          completionTime: "2026-06-02 10:40:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
        {
          taskNo: "RW2026060200102",
          title: "家属劝导疏散",
          description: "安排民警和工作人员对家属进行劝导，引导合法维权",
          assignDept: "市卫健局",
          assignUser: "孙科长",
          assignTime: "2026-06-02 10:30:00",
          receiveDept: "辖区派出所",
          deadline: "2026-06-02 12:00:00",
          urgency: "critical",
          status: "processing",
          receiveUser: "周警官",
          receiveTime: "2026-06-02 10:50:00",
          receiveRemark: "正在现场对家属进行法制宣传和劝导",
          completionResult: null,
          completionTime: null,
          isOverdue: 1,
          scoreDeducted: 5,
        },
        {
          taskNo: "RW2026060200103",
          title: "病例讨论与医疗评估",
          description: "组织专家对患者术后并发症进行讨论，明确死亡原因",
          assignDept: "市卫健局",
          assignUser: "孙科长",
          assignTime: "2026-06-02 14:00:00",
          receiveDept: "市卫健局",
          deadline: "2026-06-02 18:00:00",
          urgency: "high",
          status: "processing",
          receiveUser: "孙科长",
          receiveTime: "2026-06-02 14:05:00",
          receiveRemark: "已联系普外科、麻醉科、病理科专家",
          completionResult: null,
          completionTime: null,
          isOverdue: 0,
          scoreDeducted: 0,
        },
      ],
    },
    {
      incidentNo: "YL20260603001",
      tasks: [
        {
          taskNo: "RW2026060300101",
          title: "舆情监测与分析",
          description: "持续监测该舆情的传播态势，每2小时报告一次数据",
          assignDept: "医院宣传科",
          assignUser: "舆情监测员",
          assignTime: "2026-06-03 09:05:00",
          receiveDept: "医院宣传科",
          deadline: "2026-06-03 18:00:00",
          urgency: "high",
          status: "completed",
          receiveUser: "舆情监测员",
          receiveTime: "2026-06-03 09:06:00",
          receiveRemark: "已启动舆情应急监测",
          completionResult:
            "舆情最高峰转发量达8500次，目前已呈下降趋势，未出现主流媒体报道",
          completionTime: "2026-06-03 17:30:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
        {
          taskNo: "RW2026060300102",
          title: "官方回应起草",
          description: "根据调查结果起草官方回应，经审核后发布",
          assignDept: "市卫健局宣传处",
          assignUser: "吴处长",
          assignTime: "2026-06-03 09:30:00",
          receiveDept: "市卫健局宣传处",
          deadline: "2026-06-03 12:00:00",
          urgency: "high",
          status: "pending_acknowledge",
          receiveUser: null,
          receiveTime: null,
          receiveRemark: null,
          completionResult: null,
          completionTime: null,
          isOverdue: 1,
          scoreDeducted: 10,
        },
      ],
    },
    {
      incidentNo: "YL20260604001",
      tasks: [
        {
          taskNo: "RW2026060400101",
          title: "涉事医生安全保护",
          description: "加强对当事医生的安全保护，必要时安排临时住所",
          assignDept: "医院值班室",
          assignUser: "李值班",
          assignTime: "2026-06-04 15:25:00",
          receiveDept: "医院安保科",
          deadline: "2026-06-04 16:00:00",
          urgency: "high",
          status: "completed",
          receiveUser: "保安队长",
          receiveTime: "2026-06-04 15:30:00",
          receiveRemark: "已安排2名保安24小时值守",
          completionResult: "已落实安保措施，医生情绪稳定，暂时安排在家休息",
          completionTime: "2026-06-04 15:55:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
        {
          taskNo: "RW2026060400102",
          title: "家属约谈",
          description: "上门约谈家属，进行法制教育，明确法律后果",
          assignDept: "医院值班室",
          assignUser: "李值班",
          assignTime: "2026-06-04 15:25:00",
          receiveDept: "辖区派出所",
          deadline: "2026-06-04 20:00:00",
          urgency: "high",
          status: "completed",
          receiveUser: "社区民警",
          receiveTime: "2026-06-04 15:40:00",
          receiveRemark: "已联系社区民警，下午上门",
          completionResult: "已约谈家属，家属表示会冷静处理，不再发表威胁言论",
          completionTime: "2026-06-04 19:30:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
        {
          taskNo: "RW2026060400103",
          title: "诊疗过程核查",
          description: "核查产妇分娩过程，确认诊疗行为是否规范",
          assignDept: "医院医务科",
          assignUser: "医务科主任",
          assignTime: "2026-06-04 17:00:00",
          receiveDept: "医院医务科",
          deadline: "2026-06-05 12:00:00",
          urgency: "medium",
          status: "processing",
          receiveUser: "医务科主任",
          receiveTime: "2026-06-04 17:05:00",
          receiveRemark: "正在调取病历资料",
          completionResult: null,
          completionTime: null,
          isOverdue: 0,
          scoreDeducted: 0,
        },
      ],
    },
    {
      incidentNo: "YL20260605001",
      tasks: [
        {
          taskNo: "RW2026060500101",
          title: "醉酒患者控制",
          description: "立即派人到现场控制醉酒患者，防止造成更大伤害",
          assignDept: "社区卫生服务中心",
          assignUser: "导诊护士",
          assignTime: "2026-06-05 19:46:00",
          receiveDept: "医院安保科",
          deadline: "2026-06-05 20:15:00",
          urgency: "high",
          status: "pending_acknowledge",
          receiveUser: null,
          receiveTime: null,
          receiveRemark: null,
          completionResult: null,
          completionTime: null,
          isOverdue: 1,
          scoreDeducted: 5,
        },
        {
          taskNo: "RW2026060500102",
          title: "财产损失定损",
          description: "对损坏的办公设备进行清点定损，保留索赔证据",
          assignDept: "社区卫生服务中心",
          assignUser: "导诊护士",
          assignTime: "2026-06-05 19:46:00",
          receiveDept: "医院医务科",
          deadline: "2026-06-06 12:00:00",
          urgency: "medium",
          status: "pending_acknowledge",
          receiveUser: null,
          receiveTime: null,
          receiveRemark: null,
          completionResult: null,
          completionTime: null,
          isOverdue: 0,
          scoreDeducted: 0,
        },
      ],
    },
    {
      incidentNo: "YL20260606001",
      tasks: [
        {
          taskNo: "RW2026060600101",
          title: "视频证据固定",
          description: "获取抖音原始视频，固定证据，联系平台要求下架",
          assignDept: "医院宣传科",
          assignUser: "宣传干事",
          assignTime: "2026-06-06 11:05:00",
          receiveDept: "医院宣传科",
          deadline: "2026-06-06 14:00:00",
          urgency: "high",
          status: "completed",
          receiveUser: "宣传干事",
          receiveTime: "2026-06-06 11:10:00",
          receiveRemark: "已联系抖音平台投诉",
          completionResult:
            "已下载保存原始视频，平台已受理投诉，视频正在审核中",
          completionTime: "2026-06-06 13:30:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
        {
          taskNo: "RW2026060600102",
          title: "纪检调查",
          description: "对涉事医生是否存在收红包行为进行调查核实",
          assignDept: "市卫健局纪检组",
          assignUser: "纪检组",
          assignTime: "2026-06-06 11:20:00",
          receiveDept: "医院纪委",
          deadline: "2026-06-06 20:00:00",
          urgency: "high",
          status: "processing",
          receiveUser: "纪委书记",
          receiveTime: "2026-06-06 14:30:00",
          receiveRemark: "正在调取相关记录，约谈当事人",
          completionResult: null,
          completionTime: null,
          isOverdue: 0,
          scoreDeducted: 0,
        },
      ],
    },
    {
      incidentNo: "YL20260607001",
      tasks: [
        {
          taskNo: "RW2026060700101",
          title: "现场秩序维护",
          description: "到住院部维持秩序，劝导家属理性维权",
          assignDept: "医院值班室",
          assignUser: "李值班",
          assignTime: "2026-06-07 08:05:00",
          receiveDept: "医院安保科",
          deadline: "2026-06-07 08:30:00",
          urgency: "medium",
          status: "completed",
          receiveUser: "安保科长",
          receiveTime: "2026-06-07 08:08:00",
          receiveRemark: "带5名保安到现场",
          completionResult: "现场秩序已恢复，未影响其他患者诊疗",
          completionTime: "2026-06-07 08:25:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
        {
          taskNo: "RW2026060700102",
          title: "医患调解",
          description: "安排调解员与家属沟通，解释病情，争取达成共识",
          assignDept: "医院医务科",
          assignUser: "医务科长",
          assignTime: "2026-06-07 10:00:00",
          receiveDept: "医患纠纷调解中心",
          deadline: "2026-06-07 18:00:00",
          urgency: "high",
          status: "completed",
          receiveUser: "调解员",
          receiveTime: "2026-06-07 10:15:00",
          receiveRemark: "已准备好病历资料和专家意见",
          completionResult:
            "家属理解病情发展，达成和解，已离开医院，不追究责任",
          completionTime: "2026-06-07 17:30:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
      ],
    },
    {
      incidentNo: "YL20260608001",
      tasks: [
        {
          taskNo: "RW2026060800101",
          title: "医生安全保护",
          description: "加强主治医生上下班途中和工作期间的安全保卫",
          assignDept: "医院值班室",
          assignUser: "李值班",
          assignTime: "2026-06-08 14:35:00",
          receiveDept: "医院安保科",
          deadline: "2026-06-08 15:30:00",
          urgency: "medium",
          status: "completed",
          receiveUser: "安保人员",
          receiveTime: "2026-06-08 14:40:00",
          receiveRemark: "已安排专人护送",
          completionResult: "已落实安保措施，医生正常工作",
          completionTime: "2026-06-08 15:20:00",
          isOverdue: 0,
          scoreDeducted: 0,
        },
        {
          taskNo: "RW2026060800102",
          title: "手术效果评估",
          description: "组织专家对患者手术效果进行评估，解答患者疑问",
          assignDept: "医院医务科",
          assignUser: "医务科主任",
          assignTime: "2026-06-08 16:00:00",
          receiveDept: "医院医务科",
          deadline: "2026-06-09 12:00:00",
          urgency: "normal",
          status: "pending_acknowledge",
          receiveUser: null,
          receiveTime: null,
          receiveRemark: null,
          completionResult: null,
          completionTime: null,
          isOverdue: 0,
          scoreDeducted: 0,
        },
      ],
    },
  ];

  const incidentIdMap = {};
  db.prepare("SELECT id, incident_no FROM incidents")
    .all()
    .forEach((row) => {
      incidentIdMap[row.incident_no] = row.id;
    });

  taskSeedData.forEach((item) => {
    const incidentId = incidentIdMap[item.incidentNo];
    if (!incidentId) return;

    item.tasks.forEach((task) => {
      const info = insertTask.run(
        task.taskNo,
        incidentId,
        task.title,
        task.description || "",
        task.assignDept,
        task.assignUser,
        task.assignTime,
        task.receiveDept,
        task.deadline,
        task.urgency,
        task.status,
        task.receiveUser,
        task.receiveTime,
        task.receiveRemark,
        task.completionResult,
        task.completionTime,
        task.isOverdue,
        task.scoreDeducted,
      );

      const taskId = info.lastInsertRowid;

      if (task.receiveTime && task.receiveUser) {
        insertReceipt.run(
          taskId,
          "签收",
          task.receiveDept,
          task.receiveUser,
          task.receiveRemark || "",
        );
      }

      if (task.completionTime && task.completionResult) {
        insertReceipt.run(
          taskId,
          "完成",
          task.receiveDept,
          task.receiveUser,
          task.completionResult,
        );
      }
    });
  });

  const insertReview = db.prepare(`
    INSERT INTO case_reviews (incident_id, summary, qualitative, key_points, reviewer, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const reviewSeedData = [
    {
      incidentNo: "YL20260601001",
      summary:
        "患者家属因抢救结果不满殴打值班医生，保安3分钟到达现场控制局面，民警10分钟内到达。经调查，医疗行为无过错，打人者被行政拘留10日。",
      qualitative:
        "典型暴力伤医事件，因患者死亡引发家属情绪失控，无医疗过错，应依法从严处置。",
      key_points:
        "1. 第一时间启动安保联动，保安必须在5分钟内到达现场控制打人者并隔离；\n2. 同步拨打110报警，保留完整监控录像、伤情照片等证据；\n3. 组织专家进行医疗行为评估，确认无过错后配合公安依法处理；\n4. 对受伤医护人员进行救治和心理疏导，做好家属安抚。",
      reviewer: "李值班",
      reviewedAt: "2026-06-01 17:00:00",
    },
    {
      incidentNo: "YL20260607001",
      summary:
        "老年患者病逝，家属10余人群聚住院部讨说法。安保、民警、调解员三方联动，经耐心解释病情后家属理解，达成和解离开医院。",
      qualitative:
        "患者病逝引发的聚集性医闹，家属存在非理性维权行为，经调解化解，无医疗过错。",
      key_points:
        "1. 现场安保维持秩序，设置隔离区，避免影响其他患者；\n2. 民警到场劝导，明确告知合法维权途径和违法行为后果；\n3. 医务科组织专家准备病例资料和诊疗经过说明；\n4. 医患纠纷调解中心介入，一对一沟通，用通俗语言解释病情发展；\n5. 引导家属通过尸检、医疗鉴定等合法途径解决争议。",
      reviewer: "赵主任",
      reviewedAt: "2026-06-07 18:30:00",
    },
  ];

  reviewSeedData.forEach((r) => {
    const incidentId = incidentIdMap[r.incidentNo];
    if (!incidentId) return;
    insertReview.run(
      incidentId,
      r.summary,
      r.qualitative,
      r.key_points,
      r.reviewer,
      r.reviewedAt,
    );
  });

  const insertPlan = db.prepare(`
    INSERT INTO preparedness_plans 
    (plan_no, type, title, qualitative, key_points, suggested_steps, applicable_hospitals, applicable_departments, reference_incident_no, use_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const planSeedData = [
    {
      planNo: "YA-V-001",
      type: "violence",
      title: "暴力伤医事件处置预案（急诊科/抢救场景）",
      qualitative:
        "患者或家属因对诊疗结果不满，对医护人员实施殴打、推搡等暴力行为的恶性事件，性质恶劣，必须立即制止并依法从严处理。",
      key_points:
        "【现场控制】5分钟内安保到场隔离施暴者；【报警留证】第一时间拨打110，固定监控/伤情/证人证据；【医疗评估】组织专家评估诊疗过程是否规范；【人员安抚】救治受伤医护，心理疏导；【舆情防控】留意网络传播动态。",
      suggestedSteps: JSON.stringify([
        "第一步（0-5分钟）：值班室接报→立即通知安保科派3人以上保安→拨打110报警→通知医务科介入",
        "第二步（5-15分钟）：保安到达现场控制施暴者、保护医护人员安全→封锁现场保全监控录像→拍摄伤情照片",
        "第三步（15-60分钟）：民警到场制作笔录、带走嫌疑人→医务科组织专家调阅病历→评估医疗行为是否规范",
        "第四步（1-24小时）：对受伤医护进行救治和心理疏导→医务科准备医疗情况说明→配合公安机关调查取证",
        "第五步（后续）：依法依规处理→宣传科关注舆情→内部通报，加强安保培训",
      ]),
      applicableHospitals:
        "市第一人民医院,市第二人民医院,市中医院,区妇幼保健院,社区卫生服务中心",
      applicableDepartments: "急诊科,内科,外科,儿科,妇产科,骨科,门诊部,住院部",
      referenceIncidentNo: "YL20260601001",
      useCount: 3,
    },
    {
      planNo: "YA-G-001",
      type: "gathering",
      title: "现场聚众医闹处置预案（患者病逝/手术并发症场景）",
      qualitative:
        "患者家属组织多人在医院公共区域拉横幅、设灵堂、聚集滋事，扰乱正常医疗秩序的群体性事件，需多部门联动快速化解。",
      key_points:
        "【秩序维护】设置隔离带，避免事态蔓延；【法律劝导】民警到场进行法制宣传；【病例准备】医务科快速准备诊疗说明；【调解介入】调解员一对一沟通；【分流引导】引导合法维权途径。",
      suggestedSteps: JSON.stringify([
        "第一步（0-10分钟）：接报→安保科派足够人手→通知辖区派出所→通知市卫健局→通知医患纠纷调解中心",
        "第二步（10-30分钟）：保安现场维持秩序，设置隔离区，保护医护安全→民警到场劝导，宣传法律后果",
        "第三步（30分钟-2小时）：医务科组织专家整理病历，出具诊疗经过说明→调解员介入，与家属代表沟通",
        "第四步（2-8小时）：一对一解释病情→引导尸检/医疗鉴定等合法途径→争取家属理解配合",
        "第五步（后续）：达成和解疏散→总结复盘→加强纠纷早期排查预警",
      ]),
      applicableHospitals:
        "市第一人民医院,市第二人民医院,市中医院,区妇幼保健院",
      applicableDepartments: "住院部,外科,妇产科,骨科,神经内科,心内科,门诊部",
      referenceIncidentNo: "YL20260607001",
      useCount: 2,
    },
    {
      planNo: "YA-O-001",
      type: "online",
      title: "网络医闹舆情处置预案（微博/抖音/论坛不实传言）",
      qualitative:
        "网络平台出现不实言论恶意中伤医院或医护，短时间大量传播引发负面舆论，需快速响应、精准处置。",
      key_points:
        "【监测预警】建立7×24舆情监测；【证据固定】下载保存视频/截图/链接；【平台投诉】联系平台下架删帖；【调查核实】同步核查事实真相；【官方回应】拟定通稿统一口径发布；【正向引导】必要时联系媒体正面报道。",
      suggestedSteps: JSON.stringify([
        "第一步（0-30分钟）：舆情监测发现→宣传科启动应急响应→固定证据（截图、录屏、链接）→向领导报告",
        "第二步（30分钟-2小时）：联系平台提交投诉，申请下架/限流→同步启动内部调查，核实事实真相",
        "第三步（2-4小时）：拟定官方回应稿件→多部门审核把关→在官方渠道发布说明",
        "第四步（4-24小时）：持续监测舆情走向→对恶意造谣账号保留追责权利→必要时联系网信部门协调",
        "第五步（后续）：形成舆情处置报告→完善监测预警机制→加强正面宣传",
      ]),
      applicableHospitals:
        "市第一人民医院,市第二人民医院,市中医院,区妇幼保健院,社区卫生服务中心",
      applicableDepartments: "全部科室",
      referenceIncidentNo: "YL20260603001",
      useCount: 1,
    },
    {
      planNo: "YA-T-001",
      type: "threat",
      title: "扬言威胁类事件处置预案（短信/电话/当面威胁）",
      qualitative:
        "患者或家属通过短信、电话、当面等方式扬言要对医护人员实施报复，虽未实际发生暴力，但存在潜在安全风险，需重视并提前干预。",
      key_points:
        "【安全保护】加强当事医生上下班和工作期间安保；【证据留存】保存威胁短信/录音；【约谈警示】社区民警上门约谈；【矛盾化解】同步核查医疗行为，正面沟通消除误解。",
      suggestedSteps: JSON.stringify([
        "第一步（0-1小时）：接报→了解威胁内容和方式→保存威胁短信/录音截图→通知安保科加强保护",
        "第二步（1-4小时）：安保科安排24小时值守→派专人护送上下班→调整排班必要时临时停岗",
        "第三步（4-24小时）：辖区派出所/社区民警上门约谈→进行法制教育，明确法律后果",
        "第四步（1-3天）：医务科核查诊疗过程是否规范→与当事方正面沟通，消除误解化解矛盾",
        "第五步（后续）：持续关注动态→定期回访评估风险→加强医护安全防护培训",
      ]),
      applicableHospitals:
        "市第一人民医院,市第二人民医院,市中医院,区妇幼保健院,社区卫生服务中心",
      applicableDepartments: "妇产科,骨科,外科,心内科,神经内科,急诊科,门诊部",
      referenceIncidentNo: "YL20260604001",
      useCount: 1,
    },
  ];

  planSeedData.forEach((p) => {
    insertPlan.run(
      p.planNo,
      p.type,
      p.title,
      p.qualitative,
      p.key_points,
      p.suggestedSteps,
      p.applicableHospitals,
      p.applicableDepartments,
      p.referenceIncidentNo,
      p.useCount,
    );
  });
}

initDatabase();
if (!process.env.SAFEMED_SKIP_SEED) {
  seedInitialData();
}

module.exports = db;
