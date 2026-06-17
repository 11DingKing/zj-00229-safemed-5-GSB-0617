<template>
  <div>
    <el-row :gutter="16" style="margin-bottom: 20px">
      <el-col :span="6">
        <div class="stat-card">
          <div class="icon" style="background: #dbeafe">
            <el-icon color="#1d4ed8"><Document /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ overview.total }}</div>
            <div class="label">事件总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="icon" style="background: #fef3c7">
            <el-icon color="#d97706"><Clock /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ overview.pending }}</div>
            <div class="label">处置中</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="icon" style="background: #fee2e2">
            <el-icon color="#dc2626"><Warning /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ overview.critical }}</div>
            <div class="label">特急事件</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="icon" style="background: #d1fae5">
            <el-icon color="#059669"><CircleCheck /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ overview.closed }}</div>
            <div class="label">已结案</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-alert
      v-if="
        highRisk.summary &&
        (highRisk.summary.total_high_risk_hospitals > 0 ||
          highRisk.summary.total_high_risk_departments > 0)
      "
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    >
      <template #title>
        <div
          style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap"
        >
          <strong style="font-size: 14px">
            <el-icon style="vertical-align: -2px"><Warning /></el-icon>
            风险提示：
          </strong>
          <span v-if="highRisk.summary.total_high_risk_hospitals > 0">
            近30天高发单位：
            <el-tag
              v-for="h in highRisk.high_risk_hospitals.slice(0, 3)"
              :key="h.hospital"
              type="danger"
              size="small"
              effect="dark"
              style="margin-right: 6px"
            >
              {{ h.hospital }}（{{ h.count }}件）
            </el-tag>
          </span>
          <span v-if="highRisk.summary.total_high_risk_departments > 0">
            高发科室（前3）：
            <el-tag
              v-for="d in highRisk.high_risk_departments.slice(0, 3)"
              :key="d.hospital + d.department"
              type="warning"
              size="small"
              style="margin-right: 6px"
            >
              {{ d.hospital }}{{ d.department }}（{{ d.count }}件）
            </el-tag>
          </span>
          <span v-if="highRisk.summary.week_growth_rate > 0">
            <el-tag size="small" type="danger" effect="plain">
              周环比 ↑{{ highRisk.summary.week_growth_rate }}%
            </el-tag>
          </span>
        </div>
      </template>
    </el-alert>

    <div class="detail-card">
      <div class="table-toolbar">
        <div class="filter-group">
          <el-select
            v-model="filter.status"
            placeholder="状态筛选"
            style="width: 140px"
            @change="fetchList"
          >
            <el-option label="全部状态" value="all" />
            <el-option
              v-for="s in dict.statuses"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>

          <el-select
            v-model="filter.type"
            placeholder="类型筛选"
            style="width: 160px"
            @change="fetchList"
          >
            <el-option label="全部类型" value="all" />
            <el-option
              v-for="t in dict.types"
              :key="t.value"
              :label="t.label"
              :value="t.value"
            />
          </el-select>

          <el-select
            v-model="filter.hospital"
            placeholder="医院筛选"
            style="width: 180px"
            @change="fetchList"
          >
            <el-option label="全部医院" value="all" />
            <el-option
              v-for="h in hospitals"
              :key="h.name"
              :label="h.name"
              :value="h.name"
            />
          </el-select>

          <el-input
            v-model="filter.keyword"
            placeholder="搜索事件编号、描述..."
            style="width: 240px"
            clearable
            @keyup.enter="fetchList"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <div style="display: flex; gap: 10px">
          <el-radio-group v-model="sortBy" @change="fetchList">
            <el-radio-button value="time">按时间排序</el-radio-button>
            <el-radio-button value="urgency">按紧急程度</el-radio-button>
          </el-radio-group>
          <el-button type="primary" @click="openReportDialog">
            <el-icon><Plus /></el-icon>
            接报登记
          </el-button>
        </div>
      </div>

      <el-table
        :data="incidentList"
        stripe
        style="width: 100%"
        @row-click="handleRowClick"
      >
        <el-table-column prop="incident_no" label="事件编号" width="140">
          <template #default="{ row }">
            <span style="font-family: monospace; color: #374151">{{
              row.incident_no
            }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="type_text" label="类型" width="110">
          <template #default="{ row }">
            <span :class="['type-tag', 'type-' + row.type]">{{
              row.type_text
            }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="urgency_text" label="紧急程度" width="90">
          <template #default="{ row }">
            <span :class="['urgency-tag', 'urgency-' + row.urgency_level]">{{
              row.urgency_text
            }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="hospital" label="医院" width="160" />
        <el-table-column prop="department" label="科室" width="100" />
        <el-table-column
          prop="description"
          label="事件简述"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column prop="status_text" label="状态" width="110">
          <template #default="{ row }">
            <span :class="['status-tag', 'status-' + row.status]">{{
              row.status_text
            }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="report_time" label="接报时间" width="160" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click.stop="handleView(row)"
              >查看</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="reportDialogVisible"
      title="事件接报登记"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        :model="reportForm"
        label-width="100px"
        :rules="reportRules"
        ref="reportFormRef"
      >
        <el-form-item label="事件类型" prop="type">
          <el-select
            v-model="reportForm.type"
            placeholder="请选择事件类型"
            style="width: 100%"
          >
            <el-option
              v-for="t in dict.types"
              :key="t.value"
              :label="t.label"
              :value="t.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="发生医院" prop="hospital">
          <el-select
            v-model="reportForm.hospital"
            placeholder="请选择医院"
            style="width: 100%"
          >
            <el-option
              v-for="h in hospitals"
              :key="h.name"
              :label="h.name"
              :value="h.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="涉事科室" prop="department">
          <el-select
            v-model="reportForm.department"
            placeholder="请选择科室"
            style="width: 100%"
          >
            <el-option
              v-for="d in departments"
              :key="d.name"
              :label="d.name"
              :value="d.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="事件经过" prop="description">
          <el-input
            v-model="reportForm.description"
            type="textarea"
            :rows="3"
            placeholder="请简述事件经过"
          />
        </el-form-item>
        <el-form-item label="伤情/影响">
          <el-input
            v-model="reportForm.injury_impact"
            type="textarea"
            :rows="2"
            placeholder="请描述人员伤情或造成的影响"
          />
        </el-form-item>
        <el-form-item label="紧急程度" prop="urgency_level">
          <el-radio-group v-model="reportForm.urgency_level">
            <el-radio
              v-for="u in dict.urgencies"
              :key="u.value"
              :value="u.value"
              >{{ u.label }}</el-radio
            >
          </el-radio-group>
        </el-form-item>
        <el-form-item label="接报人" prop="reporter">
          <el-input
            v-model="reportForm.reporter"
            placeholder="请输入接报人姓名"
          />
        </el-form-item>

        <template v-if="matchedData.risk_tip || matchedData.matches.length > 0">
          <el-divider content-position="left">
            <strong style="color: #1d4ed8; font-size: 14px">
              <el-icon style="vertical-align: -2px"><MagicStick /></el-icon>
              智能参考
            </strong>
          </el-divider>

          <el-alert
            v-if="matchedData.risk_tip"
            type="warning"
            show-icon
            :closable="false"
            style="margin-bottom: 12px"
          >
            <template #title>
              <strong>
                <el-icon style="vertical-align: -2px"><Warning /></el-icon>
                风险预警：
              </strong>
              {{ matchedData.risk_tip }}，请重点关注并加派力量！
            </template>
          </el-alert>

          <div
            v-if="matchedData.matches.length > 0"
            style="
              margin-bottom: 10px;
              font-size: 13px;
              font-weight: 600;
              color: #1e40af;
            "
          >
            <el-icon style="vertical-align: -2px"><Collection /></el-icon>
            为您匹配到
            {{ matchedData.matches.length }} 条同类历史处置预案，供参考：
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px">
            <div
              v-for="m in matchedData.matches"
              :key="m.id"
              class="plan-match-card"
            >
              <div class="pmc-head">
                <div style="display: flex; align-items: center; gap: 8px">
                  <el-tag size="small" type="primary">{{ m.type_text }}</el-tag>
                  <span class="pmc-title">{{ m.title }}</span>
                </div>
                <el-tag size="small" type="info" effect="plain">
                  匹配度 {{ Math.max(60, Math.min(98, 60 + m.score * 2)) }}%
                </el-tag>
              </div>
              <div class="pmc-reasons">
                <el-tag
                  v-for="r in m.match_reasons"
                  :key="r"
                  size="small"
                  type="success"
                  effect="light"
                  style="margin-right: 4px"
                  >{{ r }}</el-tag
                >
              </div>
              <div class="pmc-block">
                <span class="pmc-label">定性结论：</span>
                {{ m.qualitative }}
              </div>
              <div class="pmc-block" style="white-space: pre-line">
                <span class="pmc-label">处置要点：</span>
                {{ m.key_points }}
              </div>
              <div
                v-if="m.suggested_steps && m.suggested_steps.length > 0"
                class="pmc-block"
              >
                <span class="pmc-label">建议步骤：</span>
                <ol class="pmc-steps">
                  <li v-for="(step, idx) in m.suggested_steps" :key="idx">
                    {{ step }}
                  </li>
                </ol>
              </div>
              <div v-if="m.reference_incident_no" class="pmc-ref">
                参考案例：
                <el-link type="primary" style="font-family: monospace">
                  {{ m.reference_incident_no }}
                </el-link>
                ｜已被复用 {{ m.use_count }} 次
              </div>
            </div>
          </div>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="reportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitReport">提交登记</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import api from "../utils/api";

const emit = defineEmits(["view-detail"]);

const incidentList = ref([]);
const hospitals = ref([]);
const departments = ref([]);
const dict = ref({ types: [], statuses: [], urgencies: [] });
const overview = ref({ total: 0, pending: 0, critical: 0, closed: 0 });

const highRisk = reactive({
  high_risk_hospitals: [],
  high_risk_departments: [],
  summary: null,
});

const matchedData = reactive({
  matches: [],
  suggestions: [],
  risk_tip: null,
});

const filter = reactive({
  status: "all",
  type: "all",
  hospital: "all",
  keyword: "",
});

const sortBy = ref("time");

const reportDialogVisible = ref(false);
const reportFormRef = ref(null);
const reportForm = reactive({
  type: "",
  hospital: "",
  department: "",
  description: "",
  injury_impact: "",
  urgency_level: "normal",
  reporter: "",
});

const reportRules = {
  type: [{ required: true, message: "请选择事件类型", trigger: "change" }],
  hospital: [{ required: true, message: "请选择医院", trigger: "change" }],
  department: [{ required: true, message: "请选择科室", trigger: "change" }],
  description: [{ required: true, message: "请输入事件经过", trigger: "blur" }],
  reporter: [{ required: true, message: "请输入接报人", trigger: "blur" }],
  urgency_level: [
    { required: true, message: "请选择紧急程度", trigger: "change" },
  ],
};

const fetchList = () => {
  const params = {
    status: filter.status,
    type: filter.type,
    hospital: filter.hospital,
    keyword: filter.keyword,
    sort: sortBy.value === "urgency" ? "urgency" : "time",
  };
  api.getIncidents(params).then((res) => {
    incidentList.value = res.list;
  });
};

const fetchOverview = () => {
  api.getStatsOverview().then((res) => {
    overview.value = res;
  });
};

const fetchHighRisk = () => {
  api
    .getHighRiskStats({ threshold_hospital: 3, threshold_dept: 2, days: 30 })
    .then((res) => {
      highRisk.high_risk_hospitals = res.high_risk_hospitals || [];
      highRisk.high_risk_departments = res.high_risk_departments || [];
      highRisk.summary = res.summary || null;
    });
};

const fetchMatchPlans = () => {
  if (!reportForm.type) {
    matchedData.matches = [];
    matchedData.suggestions = [];
    matchedData.risk_tip = null;
    return;
  }
  const params = {
    type: reportForm.type,
  };
  if (reportForm.hospital) params.hospital = reportForm.hospital;
  if (reportForm.department) params.department = reportForm.department;
  if (reportForm.description) params.description = reportForm.description;
  api.matchPlans(params).then((res) => {
    matchedData.matches = res.matches || [];
    matchedData.suggestions = res.suggestions || [];
    matchedData.risk_tip = res.risk_tip || null;
  });
};

let matchTimer = null;
watch(
  () => [
    reportForm.type,
    reportForm.hospital,
    reportForm.department,
    reportForm.description,
  ],
  () => {
    if (matchTimer) clearTimeout(matchTimer);
    matchTimer = setTimeout(fetchMatchPlans, 200);
  },
);

const fetchDict = () => {
  api.getDict().then((res) => {
    dict.value = res;
  });
};

const fetchHospitals = () => {
  api.getHospitals().then((res) => {
    hospitals.value = res;
  });
};

const fetchDepartments = () => {
  api.getDepartments().then((res) => {
    departments.value = res;
  });
};

const openReportDialog = () => {
  reportForm.type = "";
  reportForm.hospital = "";
  reportForm.department = "";
  reportForm.description = "";
  reportForm.injury_impact = "";
  reportForm.urgency_level = "normal";
  reportForm.reporter = "";
  matchedData.matches = [];
  matchedData.suggestions = [];
  matchedData.risk_tip = null;
  reportDialogVisible.value = true;
};

const submitReport = () => {
  reportFormRef.value.validate((valid) => {
    if (valid) {
      api
        .createIncident(reportForm)
        .then(() => {
          ElMessage.success("接报登记成功");
          reportDialogVisible.value = false;
          fetchList();
          fetchOverview();
        })
        .catch(() => {
          ElMessage.error("登记失败，请重试");
        });
    }
  });
};

const handleRowClick = (row) => {
  emit("view-detail", row.id);
};

const handleView = (row) => {
  emit("view-detail", row.id);
};

onMounted(() => {
  fetchDict();
  fetchHospitals();
  fetchDepartments();
  fetchList();
  fetchOverview();
  fetchHighRisk();
});
</script>

<style scoped>
.plan-match-card {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 12px 14px;
}

.pmc-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.pmc-title {
  font-weight: 600;
  font-size: 14px;
  color: #0c4a6e;
}

.pmc-reasons {
  margin-bottom: 8px;
}

.pmc-block {
  font-size: 13px;
  line-height: 1.7;
  color: #374151;
  margin-bottom: 6px;
}

.pmc-label {
  font-weight: 600;
  color: #0369a1;
}

.pmc-steps {
  margin: 4px 0 0 18px;
  padding: 0;
  color: #334155;
}

.pmc-steps li {
  line-height: 1.8;
  font-size: 13px;
}

.pmc-ref {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #7dd3fc;
  font-size: 12px;
  color: #64748b;
}
</style>
