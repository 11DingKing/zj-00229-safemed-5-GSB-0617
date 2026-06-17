<template>
  <div v-if="incident">
    <div
      class="detail-header"
      style="
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      "
    >
      <div style="display: flex; align-items: center; gap: 12px">
        <span style="font-size: 18px; font-weight: 600">{{
          incident.incident_no
        }}</span>
        <span :class="['type-tag', 'type-' + incident.type]">{{
          incident.type_text
        }}</span>
        <span :class="['urgency-tag', 'urgency-' + incident.urgency_level]">{{
          incident.urgency_text
        }}</span>
        <span :class="['status-tag', 'status-' + incident.status]">{{
          incident.status_text
        }}</span>
      </div>
    </div>

    <div class="detail-card">
      <h3 class="detail-section-title">基本信息</h3>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">发生医院：</span>
          <span class="value">{{ incident.hospital }}</span>
        </div>
        <div class="info-item">
          <span class="label">涉事科室：</span>
          <span class="value">{{ incident.department }}</span>
        </div>
        <div class="info-item">
          <span class="label">接报人：</span>
          <span class="value">{{ incident.reporter }}</span>
        </div>
        <div class="info-item">
          <span class="label">接报时间：</span>
          <span class="value">{{ incident.report_time }}</span>
        </div>
      </div>
    </div>

    <div class="detail-card">
      <h3 class="detail-section-title">事件详情</h3>
      <div style="margin-bottom: 12px">
        <div style="color: #6b7280; margin-bottom: 6px">事件经过：</div>
        <div style="color: #1f2937; line-height: 1.6">
          {{ incident.description }}
        </div>
      </div>
      <div v-if="incident.injury_impact">
        <div style="color: #6b7280; margin-bottom: 6px">伤情/影响：</div>
        <div style="color: #1f2937; line-height: 1.6">
          {{ incident.injury_impact }}
        </div>
      </div>
    </div>

    <div v-if="incident.type === 'online'" class="detail-card">
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        "
      >
        <h3
          class="detail-section-title"
          style="margin-bottom: 0; border: none; padding: 0"
        >
          相关舆情
        </h3>
        <el-button type="primary" size="small" @click="openOpinionDialog">
          <el-icon><Plus /></el-icon>添加舆情
        </el-button>
      </div>
      <div
        v-if="opinions.length === 0"
        style="color: #9ca3af; text-align: center; padding: 20px"
      >
        暂无舆情信息
      </div>
      <div v-else>
        <div v-for="op in opinions" :key="op.id" class="opinion-card">
          <div class="op-title">{{ op.title }}</div>
          <div class="op-meta">
            <span>平台：{{ op.platform || "-" }}</span>
            <span>扩散量：{{ op.spread_count || 0 }}</span>
            <span>等级：{{ spreadLevelText(op.spread_level) }}</span>
            <span>发现时间：{{ op.found_time || "-" }}</span>
          </div>
          <div style="margin-top: 6px">
            <el-link :href="op.url" target="_blank" type="primary"
              >查看链接</el-link
            >
          </div>
        </div>
      </div>
    </div>

    <div class="detail-card">
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        "
      >
        <h3
          class="detail-section-title"
          style="margin-bottom: 0; border: none; padding: 0"
        >
          协同任务
          <el-badge
            v-if="incidentTasks.length > 0"
            :value="incidentTasks.length"
            style="margin-left: 8px; vertical-align: middle"
          />
        </h3>
        <el-button
          type="primary"
          size="small"
          @click="openTaskDialog"
          :disabled="incident.status === 'closed'"
        >
          <el-icon><Plus /></el-icon>派发任务
        </el-button>
      </div>

      <div
        v-if="incidentTasks.length === 0"
        style="color: #9ca3af; text-align: center; padding: 20px"
      >
        暂无协同任务，点击上方按钮派发
      </div>
      <div v-else class="inc-task-list">
        <div
          v-for="task in incidentTasks"
          :key="task.id"
          :class="['inc-task-card', task.is_overdue ? 'inc-task-overdue' : '']"
        >
          <div class="inc-task-head">
            <span class="inc-task-no">{{ task.task_no }}</span>
            <div style="display: flex; gap: 6px; align-items: center">
              <span
                v-if="task.is_overdue"
                class="inc-task-badge inc-badge-overdue"
                >超时 -{{ task.score_deducted }}分</span
              >
              <span :class="['inc-task-badge', 'inc-badge-' + task.status]">{{
                task.status_text
              }}</span>
              <span
                :class="['urgency-tag', 'urgency-' + task.urgency_level]"
                style="font-size: 11px; padding: 2px 6px"
                >{{ task.urgency_text }}</span
              >
            </div>
          </div>
          <div class="inc-task-title">{{ task.title }}</div>
          <div v-if="task.description" class="inc-task-desc">
            {{ task.description }}
          </div>
          <div class="inc-task-meta">
            <span>承办: {{ task.receive_department }}</span>
            <span v-if="task.receive_user"
              >签收人: {{ task.receive_user }}</span
            >
            <span>时限: {{ formatTime(task.deadline) }}</span>
            <span
              v-if="
                task.remaining_hours !== null && task.status !== 'completed'
              "
            >
              (剩{{ task.remaining_hours }}h)
            </span>
            <span
              v-if="task.elapsed_hours !== null && task.status === 'completed'"
            >
              用时{{ task.elapsed_hours }}h
            </span>
          </div>
          <div v-if="task.completion_result" class="inc-task-result">
            <strong>完成情况:</strong> {{ task.completion_result }}
          </div>
        </div>
      </div>
    </div>

    <div class="detail-card">
      <div
        style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        "
      >
        <h3
          class="detail-section-title"
          style="margin-bottom: 0; border: none; padding: 0"
        >
          处置流水
        </h3>
        <el-button
          type="success"
          size="small"
          @click="openDispositionDialog"
          :disabled="incident.status === 'closed'"
        >
          <el-icon><Edit /></el-icon>添加处置记录
        </el-button>
      </div>

      <div
        v-if="logs.length === 0"
        style="color: #9ca3af; text-align: center; padding: 20px"
      >
        暂无处置记录
      </div>
      <div v-else>
        <div v-for="log in logs" :key="log.id" class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-content">
            <div class="timeline-header">
              <span class="timeline-action">
                <span :class="['status-tag', 'status-' + log.status]">{{
                  log.status_text
                }}</span>
                <span style="margin-left: 8px">{{ log.action }}</span>
              </span>
              <span class="timeline-time">{{ log.created_at }}</span>
            </div>
            <div class="timeline-meta">
              执行部门：{{ log.department }} | 操作人：{{ log.operator }}
            </div>
            <div v-if="log.remark" class="timeline-remark">
              {{ log.remark }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="incident.review" class="detail-card">
      <h3 class="detail-section-title">
        <el-icon style="vertical-align: -2px; margin-right: 4px"
          ><Read
        /></el-icon>
        结案复盘
      </h3>
      <div class="review-meta">
        <span><strong>复盘人：</strong>{{ incident.review.reviewer }}</span>
        <span
          ><strong>复盘时间：</strong>{{ incident.review.reviewed_at }}</span
        >
      </div>
      <div class="review-block">
        <div class="review-label">复盘小结</div>
        <div class="review-content">{{ incident.review.summary }}</div>
      </div>
      <div class="review-block">
        <div class="review-label">定性结论</div>
        <div class="review-content review-qualitative">
          {{ incident.review.qualitative }}
        </div>
      </div>
      <div class="review-block">
        <div class="review-label">处置要点</div>
        <div
          class="review-content review-keypoints"
          style="white-space: pre-line"
        >
          {{ incident.review.key_points }}
        </div>
      </div>
      <div style="margin-top: 12px; text-align: right">
        <el-tag type="success" size="small"
          >已沉淀为预案，可在「预案库」中查阅</el-tag
        >
      </div>
    </div>

    <el-dialog
      v-model="dispositionDialogVisible"
      :title="
        dispositionForm.status === 'closed'
          ? '结案登记（含复盘）'
          : '添加处置记录'
      "
      :width="dispositionForm.status === 'closed' ? '720px' : '500px'"
      :close-on-click-modal="false"
    >
      <el-form
        :model="dispositionForm"
        label-width="100px"
        :rules="dispositionRules"
        ref="dispositionFormRef"
      >
        <el-form-item label="处置状态" prop="status">
          <el-select
            v-model="dispositionForm.status"
            placeholder="请选择状态"
            style="width: 100%"
            disabled
          >
            <el-option
              v-for="s in availableStatuses"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="处置动作" prop="action">
          <el-select
            v-model="dispositionForm.action"
            placeholder="请选择处置动作"
            style="width: 100%"
          >
            <el-option
              v-for="a in availableActions"
              :key="a.value"
              :label="a.label"
              :value="a.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="执行部门" prop="department">
          <el-select
            v-model="dispositionForm.department"
            placeholder="请选择或输入"
            style="width: 100%"
            filterable
            allow-create
          >
            <el-option label="医院安保科" value="医院安保科" />
            <el-option label="医院医务科" value="医院医务科" />
            <el-option label="辖区派出所" value="辖区派出所" />
            <el-option label="市卫健局" value="市卫健局" />
            <el-option label="医患纠纷调解中心" value="医患纠纷调解中心" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作人" prop="operator">
          <el-input
            v-model="dispositionForm.operator"
            placeholder="请输入操作人姓名"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="dispositionForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请输入处置详情备注"
          />
        </el-form-item>

        <template v-if="dispositionForm.status === 'closed'">
          <el-divider content-position="left">
            <strong style="color: #b91c1c; font-size: 15px">
              <el-icon style="vertical-align: -2px"><Warning /></el-icon>
              结案复盘（必填）
            </strong>
          </el-divider>
          <el-form-item label="复盘小结" prop="review.summary">
            <el-input
              v-model="dispositionForm.review.summary"
              type="textarea"
              :rows="3"
              placeholder="请简要复盘整个事件的处置经过，总结经验教训"
            />
          </el-form-item>
          <el-form-item label="定性结论" prop="review.qualitative">
            <el-input
              v-model="dispositionForm.review.qualitative"
              type="textarea"
              :rows="2"
              placeholder="请对事件性质进行定性，如：典型暴力伤医事件/患者病逝引发聚集性医闹等"
            />
          </el-form-item>
          <el-form-item label="处置要点" prop="review.key_points">
            <el-input
              v-model="dispositionForm.review.key_points"
              type="textarea"
              :rows="4"
              placeholder="请分点列出关键处置要点，作为今后同类事件参考（换行分隔每点）"
            />
          </el-form-item>
          <el-form-item label="复盘人" prop="review.reviewer">
            <el-input
              v-model="dispositionForm.review.reviewer"
              placeholder="请输入复盘人姓名"
            />
          </el-form-item>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="复盘内容将自动沉淀到系统预案库，新接报同类事件时系统将智能推送本案例处置要点"
          />
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dispositionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDisposition">
          {{
            dispositionForm.status === "closed" ? "提交结案并沉淀预案" : "提交"
          }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="opinionDialogVisible"
      title="添加舆情信息"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        :model="opinionForm"
        label-width="100px"
        :rules="opinionRules"
        ref="opinionFormRef"
      >
        <el-form-item label="标题" prop="title">
          <el-input v-model="opinionForm.title" placeholder="请输入舆情标题" />
        </el-form-item>
        <el-form-item label="链接" prop="url">
          <el-input v-model="opinionForm.url" placeholder="请输入舆情链接" />
        </el-form-item>
        <el-form-item label="平台">
          <el-select
            v-model="opinionForm.platform"
            placeholder="请选择平台"
            style="width: 100%"
            filterable
            allow-create
          >
            <el-option label="微博" value="微博" />
            <el-option label="抖音" value="抖音" />
            <el-option label="微信" value="微信" />
            <el-option label="本地论坛" value="本地论坛" />
            <el-option label="今日头条" value="今日头条" />
          </el-select>
        </el-form-item>
        <el-form-item label="扩散量">
          <el-input-number
            v-model="opinionForm.spread_count"
            :min="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="扩散等级">
          <el-radio-group v-model="opinionForm.spread_level">
            <el-radio value="low">低</el-radio>
            <el-radio value="medium">中</el-radio>
            <el-radio value="high">高</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="opinionDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitOpinion">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="taskDialogVisible"
      title="派发协同任务"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form
        :model="taskForm"
        label-width="100px"
        :rules="taskRules"
        ref="taskFormRef"
      >
        <el-form-item label="任务标题" prop="title">
          <el-input v-model="taskForm.title" placeholder="请输入任务标题" />
        </el-form-item>
        <el-form-item label="任务描述">
          <el-input
            v-model="taskForm.description"
            type="textarea"
            :rows="3"
            placeholder="请描述任务内容和要求"
          />
        </el-form-item>
        <el-form-item label="派发部门" prop="assign_department">
          <el-select
            v-model="taskForm.assign_department"
            placeholder="请选择派发部门"
            style="width: 100%"
            filterable
          >
            <el-option
              v-for="d in deptList"
              :key="d.name"
              :label="d.name"
              :value="d.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="派发人" prop="assign_user">
          <el-input
            v-model="taskForm.assign_user"
            placeholder="请输入派发人姓名"
          />
        </el-form-item>
        <el-form-item label="承办部门" prop="receive_department">
          <el-select
            v-model="taskForm.receive_department"
            placeholder="请选择承办部门"
            style="width: 100%"
            filterable
          >
            <el-option
              v-for="d in deptList"
              :key="d.name"
              :label="d.name"
              :value="d.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="紧急程度" prop="urgency_level">
          <el-radio-group v-model="taskForm.urgency_level">
            <el-radio
              v-for="u in dict.urgencies"
              :key="u.value"
              :value="u.value"
              >{{ u.label }}</el-radio
            >
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处置时限">
          <el-date-picker
            v-model="taskForm.deadline"
            type="datetime"
            placeholder="留空则按紧急程度自动计算"
            style="width: 100%"
            value-format="YYYY-MM-DD HH:mm:ss"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="taskDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTask">确认派发</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from "vue";
import { ElMessage } from "element-plus";
import api from "../utils/api";

const props = defineProps({
  id: {
    type: [Number, String],
    required: true,
  },
});

const emit = defineEmits(["refresh", "close"]);

const incident = ref(null);
const logs = ref([]);
const opinions = ref([]);
const incidentTasks = ref([]);
const deptList = ref([]);
const dict = ref({ types: [], statuses: [], urgencies: [], task_statuses: [] });

const dispositionDialogVisible = ref(false);
const dispositionFormRef = ref(null);
const dispositionForm = reactive({
  status: "",
  action: "",
  department: "",
  operator: "",
  remark: "",
  review: {
    summary: "",
    qualitative: "",
    key_points: "",
    reviewer: "",
  },
});

const buildDispositionRules = () => ({
  status: [{ required: true, message: "请选择处置状态", trigger: "change" }],
  action: [{ required: true, message: "请输入处置动作", trigger: "blur" }],
  department: [{ required: true, message: "请输入执行部门", trigger: "blur" }],
  operator: [{ required: true, message: "请输入操作人", trigger: "blur" }],
  "review.summary": [
    {
      required: true,
      message: "结案必填复盘小结",
      trigger: "blur",
    },
  ],
  "review.qualitative": [
    {
      required: true,
      message: "结案必填定性结论",
      trigger: "blur",
    },
  ],
  "review.key_points": [
    {
      required: true,
      message: "结案必填处置要点",
      trigger: "blur",
    },
  ],
  "review.reviewer": [
    {
      required: true,
      message: "结案必填复盘人",
      trigger: "blur",
    },
  ],
});

const dispositionRules = computed(buildDispositionRules);

const opinionDialogVisible = ref(false);
const opinionFormRef = ref(null);
const opinionForm = reactive({
  title: "",
  url: "",
  platform: "",
  spread_count: 0,
  spread_level: "medium",
});

const opinionRules = {
  title: [{ required: true, message: "请输入舆情标题", trigger: "blur" }],
  url: [{ required: true, message: "请输入舆情链接", trigger: "blur" }],
};

const taskDialogVisible = ref(false);
const taskFormRef = ref(null);
const taskForm = reactive({
  title: "",
  description: "",
  assign_department: "",
  assign_user: "",
  receive_department: "",
  urgency_level: "high",
  deadline: "",
});

const taskRules = {
  title: [{ required: true, message: "请输入任务标题", trigger: "blur" }],
  assign_department: [
    { required: true, message: "请选择派发部门", trigger: "change" },
  ],
  assign_user: [{ required: true, message: "请输入派发人", trigger: "blur" }],
  receive_department: [
    { required: true, message: "请选择承办部门", trigger: "change" },
  ],
  urgency_level: [
    { required: true, message: "请选择紧急程度", trigger: "change" },
  ],
};

const NEXT_STATUS = {
  reported: "responding",
  responding: "investigating",
  investigating: "closed",
};

const availableStatuses = computed(() => {
  if (!incident.value) return [];
  const nextStatus = NEXT_STATUS[incident.value.status];
  if (!nextStatus) return [];
  return dict.value.statuses.filter((s) => s.value === nextStatus);
});

const STATUS_ACTION_MAP = {
  responding: [
    { label: "联动响应", value: "联动响应" },
    { label: "现场处置", value: "现场处置" },
    { label: "舆情引导", value: "舆情引导" },
  ],
  investigating: [
    { label: "调查", value: "调查" },
    { label: "现场处置", value: "现场处置" },
    { label: "舆情引导", value: "舆情引导" },
  ],
  closed: [{ label: "处理结案", value: "处理结案" }],
};

const availableActions = computed(() => {
  return STATUS_ACTION_MAP[dispositionForm.status] || [];
});

const spreadLevelText = (level) => {
  const map = { low: "低", medium: "中", high: "高" };
  return map[level] || level;
};

const formatTime = (t) => {
  if (!t) return "-";
  return String(t).replace("T", " ").slice(0, 16);
};

const fetchDetail = () => {
  api.getIncident(props.id).then((res) => {
    incident.value = res;
    logs.value = res.logs || [];
    opinions.value = res.opinions || [];
  });
};

const fetchTasks = () => {
  api.getIncidentTasks(props.id).then((res) => {
    incidentTasks.value = res.list || [];
  });
};

const fetchDict = () => {
  api.getDict().then((res) => {
    dict.value = res;
  });
};

const fetchDepartments = () => {
  api.getDepartments().then((res) => {
    deptList.value = res;
  });
};

const openDispositionDialog = () => {
  if (!incident.value) return;
  const nextStatus = NEXT_STATUS[incident.value.status];
  if (!nextStatus) return;
  dispositionForm.status = nextStatus;
  dispositionForm.action = "";
  dispositionForm.department = "";
  dispositionForm.operator = "";
  dispositionForm.remark = "";
  dispositionForm.review = {
    summary: incident.value.review?.summary || "",
    qualitative: incident.value.review?.qualitative || "",
    key_points: incident.value.review?.key_points || "",
    reviewer: incident.value.review?.reviewer || "",
  };
  dispositionDialogVisible.value = true;
};

const submitDisposition = () => {
  dispositionFormRef.value.validate((valid) => {
    if (valid) {
      const payload = {
        status: dispositionForm.status,
        action: dispositionForm.action,
        department: dispositionForm.department,
        operator: dispositionForm.operator,
        remark: dispositionForm.remark,
      };
      if (dispositionForm.status === "closed") {
        payload.review = { ...dispositionForm.review };
      }
      api
        .addDisposition(props.id, payload)
        .then((res) => {
          ElMessage.success(
            dispositionForm.status === "closed"
              ? "结案成功！复盘内容已沉淀为预案"
              : "处置记录添加成功",
          );
          dispositionDialogVisible.value = false;
          incident.value = res;
          logs.value = res.logs || [];
          emit("refresh");
        })
        .catch((e) => {
          ElMessage.error(e?.response?.data?.error || "添加失败，请重试");
        });
    }
  });
};

const openOpinionDialog = () => {
  opinionForm.title = "";
  opinionForm.url = "";
  opinionForm.platform = "";
  opinionForm.spread_count = 0;
  opinionForm.spread_level = "medium";
  opinionDialogVisible.value = true;
};

const submitOpinion = () => {
  opinionFormRef.value.validate((valid) => {
    if (valid) {
      api
        .addOpinion(props.id, opinionForm)
        .then((res) => {
          ElMessage.success("舆情信息添加成功");
          opinionDialogVisible.value = false;
          opinions.value.unshift(res);
        })
        .catch(() => {
          ElMessage.error("添加失败，请重试");
        });
    }
  });
};

const openTaskDialog = () => {
  taskForm.title = "";
  taskForm.description = "";
  taskForm.assign_department = "医院值班室";
  taskForm.assign_user = "李值班";
  taskForm.receive_department = "";
  taskForm.urgency_level = incident.value?.urgency_level || "high";
  taskForm.deadline = "";
  taskDialogVisible.value = true;
};

const submitTask = () => {
  taskFormRef.value.validate((valid) => {
    if (valid) {
      const data = { ...taskForm };
      if (!data.deadline) delete data.deadline;
      api
        .createTask(props.id, data)
        .then(() => {
          ElMessage.success("任务派发成功");
          taskDialogVisible.value = false;
          fetchTasks();
          emit("refresh");
        })
        .catch((e) => {
          ElMessage.error(e?.response?.data?.error || "派发失败，请重试");
        });
    }
  });
};

watch(
  () => props.id,
  () => {
    if (props.id) {
      fetchDetail();
      fetchTasks();
    }
  },
);

onMounted(() => {
  fetchDict();
  fetchDepartments();
  fetchDetail();
  fetchTasks();
});
</script>

<style scoped>
.inc-task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.inc-task-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px 16px;
  transition: border-color 0.2s;
}

.inc-task-card:hover {
  border-color: #93c5fd;
}

.inc-task-overdue {
  background: #fef2f2;
  border-color: #fecaca;
}

.inc-task-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.inc-task-no {
  font-family: monospace;
  font-size: 13px;
  color: #6b7280;
}

.inc-task-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.inc-badge-pending_acknowledge {
  background: #fef3c7;
  color: #92400e;
}

.inc-badge-acknowledged,
.inc-badge-processing {
  background: #dbeafe;
  color: #1e40af;
}

.inc-badge-completed {
  background: #d1fae5;
  color: #065f46;
}

.inc-badge-overdue {
  background: #fee2e2;
  color: #b91c1c;
}

.inc-task-title {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
  margin-bottom: 4px;
}

.inc-task-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 6px;
  line-height: 1.5;
}

.inc-task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: #6b7280;
}

.inc-task-result {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
}

.review-meta {
  display: flex;
  gap: 24px;
  margin-bottom: 16px;
  padding: 10px 14px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
}

.review-block {
  margin-bottom: 14px;
}

.review-label {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  margin-bottom: 6px;
  padding-left: 8px;
  border-left: 3px solid #3b82f6;
}

.review-content {
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.7;
  color: #1f2937;
  border: 1px solid #e2e8f0;
}

.review-qualitative {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #9a3412;
}

.review-keypoints {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #14532d;
}
</style>
