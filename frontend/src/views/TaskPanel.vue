<template>
  <div class="task-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        <el-icon color="#3b82f6"><List /></el-icon>
        协同任务
      </h3>
      <el-select
        v-model="currentDept"
        placeholder="选择部门"
        size="small"
        style="width: 180px"
        @change="fetchAll"
      >
        <el-option
          v-for="d in departments"
          :key="d.name"
          :label="d.name"
          :value="d.name"
        />
      </el-select>
    </div>

    <div class="summary-row">
      <div class="summary-badge badge-ack">
        <span class="num">{{ deptSummary.pending_acknowledge }}</span>
        <span class="txt">待签收</span>
      </div>
      <div class="summary-badge badge-handle">
        <span class="num">{{ deptSummary.pending_handle }}</span>
        <span class="txt">处置中</span>
      </div>
      <div class="summary-badge badge-overdue">
        <span class="num">{{ deptSummary.overdue }}</span>
        <span class="txt">超时</span>
      </div>
      <div class="summary-badge badge-done">
        <span class="num">{{ deptSummary.completed }}</span>
        <span class="txt">已完成</span>
      </div>
    </div>

    <el-tabs v-model="activeTab" type="card" class="task-tabs" @tab-change="fetchCurrentTab">
      <el-tab-pane label="待签收" name="pending_acknowledge">
        <div v-if="pendingList.length === 0" class="empty-tip">
          <el-icon size="48" color="#d1d5db"><CircleCheck /></el-icon>
          <span>暂无待签收任务</span>
        </div>
        <div v-else class="task-list">
          <div
            v-for="task in pendingList"
            :key="task.id"
            class="task-card task-ack"
          >
            <div class="task-head">
              <div class="task-no">{{ task.task_no }}</div>
              <span
                :class="[
                  'urgency-tag',
                  'urgency-' + task.urgency_level,
                ]"
                >{{ task.urgency_text }}</span
              >
            </div>
            <div class="task-title">{{ task.title }}</div>
            <div class="task-desc" v-if="task.description">
              {{ task.description }}
            </div>
            <div class="task-meta">
              <div>
                <el-icon><Link /></el-icon>
                <span class="inc-link" @click="$emit('view-incident', task.incident_id)">
                  关联事件: {{ task.incident ? task.incident.incident_no : '#' + task.incident_id }}
                </span>
              </div>
              <div>
                <el-icon><User /></el-icon>
                派发: {{ task.assign_department }} / {{ task.assign_user }}
              </div>
              <div>
                <el-icon><Timer /></el-icon>
                <span :class="{ 'text-danger': isUrgent(task) }">
                  时限: {{ formatTime(task.deadline) }}
                  <span v-if="task.remaining_hours !== null">
                    (剩{{ task.remaining_hours }}h)
                  </span>
                </span>
              </div>
              <div>
                <el-icon><Clock /></el-icon>
                派发时间: {{ formatTime(task.assign_time) }}
              </div>
            </div>
            <div class="task-actions">
              <el-button
                type="primary"
                size="small"
                :icon="Check"
                @click="openAckDialog(task)"
              >
                签收任务
              </el-button>
              <el-button size="small" @click="viewTask(task)">详情</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="处置中" name="processing">
        <div v-if="processingList.length === 0" class="empty-tip">
          <el-icon size="48" color="#d1d5db"><CircleCheck /></el-icon>
          <span>暂无处置中任务</span>
        </div>
        <div v-else class="task-list">
          <div
            v-for="task in processingList"
            :key="task.id"
            :class="['task-card', task.is_overdue ? 'task-overdue' : 'task-proc']"
          >
            <div class="task-head">
              <div class="task-no">{{ task.task_no }}</div>
              <div style="display: flex; gap: 6px">
                <span
                  v-if="task.is_overdue"
                  style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:4px;font-size:12px"
                >已超时 -{{ task.score_deducted }}分</span>
                <span
                  :class="[
                    'urgency-tag',
                    'urgency-' + task.urgency_level,
                  ]"
                  >{{ task.urgency_text }}</span
                >
              </div>
            </div>
            <div class="task-title">{{ task.title }}</div>
            <div class="task-desc" v-if="task.description">
              {{ task.description }}
            </div>
            <div class="task-meta">
              <div>
                <el-icon><Link /></el-icon>
                <span class="inc-link" @click="$emit('view-incident', task.incident_id)">
                  关联事件: {{ task.incident ? task.incident.incident_no : '#' + task.incident_id }}
                </span>
              </div>
              <div>
                <el-icon><UserFilled /></el-icon>
                签收人: {{ task.receive_user || '-' }}
                <span v-if="task.receive_time"> / {{ formatTime(task.receive_time) }}</span>
              </div>
              <div>
                <el-icon><Timer /></el-icon>
                <span :class="{ 'text-danger': task.is_overdue || isUrgent(task) }">
                  时限: {{ formatTime(task.deadline) }}
                  <span v-if="!task.is_overdue && task.remaining_hours !== null">
                    (剩{{ task.remaining_hours }}h)
                  </span>
                  <span v-if="task.is_overdue">
                    (已超时)
                  </span>
                </span>
              </div>
              <div>
                <el-icon><Clock /></el-icon>
                已处置: {{ task.elapsed_hours }}h
              </div>
            </div>
            <div v-if="task.receive_remark" class="task-remark">
              签收备注: {{ task.receive_remark }}
            </div>
            <div class="task-actions">
              <el-button
                type="success"
                size="small"
                :icon="CircleCheck"
                @click="openCompleteDialog(task)"
              >
                回填完成
              </el-button>
              <el-button size="small" @click="viewTask(task)">详情</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="已完成" name="completed">
        <div v-if="completedList.length === 0" class="empty-tip">
          <el-icon size="48" color="#d1d5db"><Document /></el-icon>
          <span>暂无已完成任务</span>
        </div>
        <div v-else class="task-list">
          <div
            v-for="task in completedList"
            :key="task.id"
            :class="['task-card', task.is_overdue ? 'task-overdue' : 'task-done']"
          >
            <div class="task-head">
              <div class="task-no">{{ task.task_no }}</div>
              <div style="display: flex; gap: 6px">
                <span
                  v-if="task.is_overdue"
                  style="background:#fee2e2;color:#b91c1c;padding:2px 8px;border-radius:4px;font-size:12px"
                >超时完成 -{{ task.score_deducted }}分</span>
                <span
                  v-else
                  style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:4px;font-size:12px"
                >按时完成</span>
                <span
                  :class="[
                    'urgency-tag',
                    'urgency-' + task.urgency_level,
                  ]"
                  >{{ task.urgency_text }}</span
                >
              </div>
            </div>
            <div class="task-title">{{ task.title }}</div>
            <div class="task-result">
              <strong>完成情况:</strong>
              {{ task.completion_result }}
            </div>
            <div class="task-meta">
              <div>
                <el-icon><Link /></el-icon>
                <span class="inc-link" @click="$emit('view-incident', task.incident_id)">
                  关联事件: {{ task.incident ? task.incident.incident_no : '#' + task.incident_id }}
                </span>
              </div>
              <div>
                <el-icon><UserFilled /></el-icon>
                签收人: {{ task.receive_user || '-' }}
              </div>
              <div>
                <el-icon><Timer /></el-icon>
                处置用时: {{ task.elapsed_hours }}h
              </div>
              <div>
                <el-icon><Clock /></el-icon>
                完成时间: {{ formatTime(task.completion_time) }}
              </div>
            </div>
            <div class="task-actions">
              <el-button size="small" @click="viewTask(task)">详情</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="ackDialogVisible"
      title="签收回执"
      width="480px"
      :close-on-click-modal="false"
    >
      <div v-if="currentTask" class="dialog-summary">
        <div class="summary-row-title">{{ currentTask.task_no }} - {{ currentTask.title }}</div>
        <div class="summary-row-item">
          <span>关联事件:</span>
          {{ currentTask.incident ? currentTask.incident.incident_no : '#' + currentTask.incident_id }}
        </div>
        <div class="summary-row-item">
          <span>处置时限:</span>
          {{ formatTime(currentTask.deadline) }}
        </div>
      </div>
      <el-form :model="ackForm" label-width="80px">
        <el-form-item label="签收人">
          <el-input v-model="ackForm.receive_user" placeholder="请输入签收人姓名" />
        </el-form-item>
        <el-form-item label="签收备注">
          <el-input
            v-model="ackForm.receive_remark"
            type="textarea"
            :rows="3"
            placeholder="请输入签收备注，如处置计划等"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ackDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAck">确认签收</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="completeDialogVisible"
      title="回填完成情况"
      width="520px"
      :close-on-click-modal="false"
    >
      <div v-if="currentTask" class="dialog-summary">
        <div class="summary-row-title">{{ currentTask.task_no }} - {{ currentTask.title }}</div>
        <div class="summary-row-item">
          <span>签收人:</span>
          {{ currentTask.receive_user || '-' }}
        </div>
        <div class="summary-row-item">
          <span>原定时限:</span>
          {{ formatTime(currentTask.deadline) }}
          <span v-if="currentTask.is_overdue" class="text-danger">(已超时)</span>
        </div>
      </div>
      <el-form :model="completeForm" label-width="80px">
        <el-form-item label="操作人">
          <el-input v-model="completeForm.operator" placeholder="请输入操作人姓名" />
        </el-form-item>
        <el-form-item label="完成情况">
          <el-input
            v-model="completeForm.completion_result"
            type="textarea"
            :rows="5"
            placeholder="请详细描述任务完成情况、处置结果、相关证据等"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitComplete">提交完成</el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailVisible"
      title="任务详情"
      direction="ltr"
      size="480px"
    >
      <div v-if="taskDetail">
        <div class="detail-card-inner">
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">任务编号:</span>
              <span class="value">{{ taskDetail.task_no }}</span>
            </div>
            <div class="detail-item">
              <span class="label">紧急程度:</span>
              <span :class="['urgency-tag', 'urgency-' + taskDetail.urgency_level]">
                {{ taskDetail.urgency_text }}
              </span>
            </div>
            <div class="detail-item">
              <span class="label">状态:</span>
              <span
                :class="['status-tag', 'status-' + taskDetail.status]"
                :style="taskStatusStyle(taskDetail.status)"
              >
                {{ taskDetail.status_text }}
              </span>
            </div>
            <div class="detail-item">
              <span class="label">关联事件:</span>
              <span
                class="inc-link"
                @click="detailVisible = false; $emit('view-incident', taskDetail.incident_id)"
              >
                {{ taskDetail.incident ? taskDetail.incident.incident_no : '#' + taskDetail.incident_id }}
              </span>
            </div>
          </div>

          <h4 class="section-h4">任务描述</h4>
          <div class="desc-block">
            <div><strong>{{ taskDetail.title }}</strong></div>
            <div v-if="taskDetail.description" class="mt-4">
              {{ taskDetail.description }}
            </div>
          </div>

          <h4 class="section-h4">时限信息</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">派发时间:</span>
              <span class="value">{{ formatTime(taskDetail.assign_time) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">处置时限:</span>
              <span :class="{ 'text-danger': taskDetail.is_overdue }">
                {{ formatTime(taskDetail.deadline) }}
              </span>
            </div>
            <div class="detail-item">
              <span class="label">签收时间:</span>
              <span class="value">{{ formatTime(taskDetail.receive_time) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">完成时间:</span>
              <span class="value">{{ formatTime(taskDetail.completion_time) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">剩余/用时:</span>
              <span class="value">
                {{ taskDetail.status === 'completed' 
                  ? taskDetail.elapsed_hours + 'h' 
                  : (taskDetail.remaining_hours !== null ? taskDetail.remaining_hours + 'h' : '-') }}
              </span>
            </div>
            <div class="detail-item" v-if="taskDetail.is_overdue">
              <span class="label">超时扣分:</span>
              <span class="text-danger">-{{ taskDetail.score_deducted }} 分</span>
            </div>
          </div>

          <h4 class="section-h4">参与方</h4>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">派发部门:</span>
              <span class="value">{{ taskDetail.assign_department }}</span>
            </div>
            <div class="detail-item">
              <span class="label">派发人:</span>
              <span class="value">{{ taskDetail.assign_user }}</span>
            </div>
            <div class="detail-item">
              <span class="label">承办部门:</span>
              <span class="value">{{ taskDetail.receive_department }}</span>
            </div>
            <div class="detail-item">
              <span class="label">签收人:</span>
              <span class="value">{{ taskDetail.receive_user || '-' }}</span>
            </div>
          </div>

          <div v-if="taskDetail.receive_remark">
            <h4 class="section-h4">签收备注</h4>
            <div class="desc-block">{{ taskDetail.receive_remark }}</div>
          </div>

          <div v-if="taskDetail.completion_result">
            <h4 class="section-h4">完成情况</h4>
            <div class="desc-block">{{ taskDetail.completion_result }}</div>
          </div>

          <h4 class="section-h4">回执流水</h4>
          <div class="receipt-timeline">
            <div
              v-for="r in taskDetail.receipts || []"
              :key="r.id"
              class="receipt-item"
            >
              <div class="receipt-dot" :class="'dot-' + r.action"></div>
              <div class="receipt-content">
                <div class="receipt-head">
                  <span class="receipt-action">{{ r.action }}</span>
                  <span class="receipt-time">{{ formatTime(r.created_at) }}</span>
                </div>
                <div class="receipt-meta">
                  {{ r.department }} / {{ r.operator }}
                </div>
                <div v-if="r.remark" class="receipt-remark">
                  {{ r.remark }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, inject } from "vue";
import { ElMessage } from "element-plus";
import {
  Check,
  CircleCheck,
  List,
  Link,
  User,
  UserFilled,
  Timer,
  Clock,
  Document,
} from "@element-plus/icons-vue";
import api from "../utils/api";

const props = defineProps({
  department: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["view-incident", "task-updated"]);

const departments = ref([]);
const currentDept = ref(props.department || "医院安保科");
const activeTab = ref("pending_acknowledge");
const pendingList = ref([]);
const processingList = ref([]);
const completedList = ref([]);
const deptSummary = ref({
  pending_acknowledge: 0,
  pending_handle: 0,
  overdue: 0,
  completed: 0,
});

const ackDialogVisible = ref(false);
const completeDialogVisible = ref(false);
const detailVisible = ref(false);
const currentTask = ref(null);
const taskDetail = ref(null);

const ackForm = reactive({
  receive_user: "",
  receive_remark: "",
});

const completeForm = reactive({
  operator: "",
  completion_result: "",
});

const formatTime = (t) => {
  if (!t) return "-";
  return String(t).replace("T", " ").slice(0, 16);
};

const isUrgent = (task) => {
  if (task.is_overdue) return true;
  if (task.remaining_hours === null) return false;
  return task.remaining_hours <= 1;
};

const taskStatusStyle = (status) => {
  const map = {
    pending_acknowledge: { background: "#fef3c7", color: "#92400e" },
    acknowledged: { background: "#dbeafe", color: "#1e40af" },
    processing: { background: "#dbeafe", color: "#1e40af" },
    completed: { background: "#d1fae5", color: "#065f46" },
    overdue: { background: "#fee2e2", color: "#b91c1c" },
  };
  return map[status] || {};
};

const fetchSummary = () => {
  if (!currentDept.value) return;
  api.getTasksByDepartment(currentDept.value).then((res) => {
    deptSummary.value = res;
  });
};

const fetchPending = () => {
  api
    .getTasks({
      status: "pending_acknowledge",
      department: currentDept.value,
      sort: "urgency",
    })
    .then((res) => {
      pendingList.value = res.list;
    });
};

const fetchProcessing = () => {
  api
    .getTasks({
      department: currentDept.value,
      sort: "urgency",
    })
    .then((res) => {
      processingList.value = res.list.filter(
        (t) => t.status === "processing" || t.status === "overdue" || t.status === "acknowledged",
      );
      completedList.value = res.list.filter((t) => t.status === "completed");
    });
};

const fetchCurrentTab = () => {
  if (activeTab.value === "pending_acknowledge") {
    fetchPending();
  } else if (activeTab.value === "processing") {
    fetchProcessing();
  } else {
    fetchProcessing();
  }
};

const fetchAll = () => {
  fetchSummary();
  fetchPending();
  fetchProcessing();
};

const openAckDialog = (task) => {
  currentTask.value = task;
  ackForm.receive_user = "";
  ackForm.receive_remark = "";
  ackDialogVisible.value = true;
};

const submitAck = () => {
  if (!ackForm.receive_user.trim()) {
    ElMessage.warning("请填写签收人姓名");
    return;
  }
  api
    .acknowledgeTask(currentTask.value.id, {
      receive_user: ackForm.receive_user,
      receive_remark: ackForm.receive_remark,
    })
    .then(() => {
      ElMessage.success("签收成功");
      ackDialogVisible.value = false;
      fetchAll();
      emit("task-updated");
    })
    .catch((e) => {
      ElMessage.error(e?.response?.data?.error || "签收失败");
    });
};

const openCompleteDialog = (task) => {
  currentTask.value = task;
  completeForm.operator = task.receive_user || "";
  completeForm.completion_result = "";
  completeDialogVisible.value = true;
};

const submitComplete = () => {
  if (!completeForm.completion_result.trim()) {
    ElMessage.warning("请填写完成情况");
    return;
  }
  if (!completeForm.operator.trim()) {
    ElMessage.warning("请填写操作人");
    return;
  }
  api
    .completeTask(currentTask.value.id, {
      completion_result: completeForm.completion_result,
      operator: completeForm.operator,
    })
    .then((res) => {
      let msg = "提交完成成功";
      if (res.is_overdue) {
        msg += `（该任务已超时，扣考核分 ${res.score_deducted} 分）`;
      }
      ElMessage.success(msg);
      completeDialogVisible.value = false;
      fetchAll();
      emit("task-updated");
    })
    .catch((e) => {
      ElMessage.error(e?.response?.data?.error || "提交失败");
    });
};

const viewTask = async (task) => {
  try {
    const res = await api.getTask(task.id);
    taskDetail.value = res;
    detailVisible.value = true;
  } catch (e) {
    ElMessage.error("获取详情失败");
  }
};

onMounted(() => {
  api.getDepartments().then((res) => {
    departments.value = res;
  });
  fetchAll();
});
</script>

<style scoped>
.task-panel {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 600px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 14px;
}

.summary-badge {
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.badge-ack {
  background: #fffbeb;
  border: 1px solid #fde68a;
}
.badge-ack .num {
  color: #b45309;
  font-size: 24px;
  font-weight: 700;
}
.badge-ack .txt {
  color: #92400e;
  font-size: 12px;
}

.badge-handle {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
}
.badge-handle .num {
  color: #1d4ed8;
  font-size: 24px;
  font-weight: 700;
}
.badge-handle .txt {
  color: #1e40af;
  font-size: 12px;
}

.badge-overdue {
  background: #fef2f2;
  border: 1px solid #fecaca;
}
.badge-overdue .num {
  color: #dc2626;
  font-size: 24px;
  font-weight: 700;
}
.badge-overdue .txt {
  color: #b91c1c;
  font-size: 12px;
}

.badge-done {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}
.badge-done .num {
  color: #059669;
  font-size: 24px;
  font-weight: 700;
}
.badge-done .txt {
  color: #065f46;
  font-size: 12px;
}

.task-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.task-card {
  border-radius: 8px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  transition: border-color 0.2s;
}

.task-card:hover {
  border-color: #93c5fd;
}

.task-ack {
  background: #fffbeb;
  border-color: #fde68a;
}

.task-proc {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.task-overdue {
  background: #fef2f2;
  border-color: #fecaca;
}

.task-done {
  background: #ecfdf5;
  border-color: #a7f3d0;
}

.task-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-no {
  font-family: monospace;
  font-size: 13px;
  color: #6b7280;
}

.task-title {
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
  margin-bottom: 6px;
}

.task-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
  line-height: 1.5;
}

.task-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 10px;
}

.task-meta > div {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-remark {
  font-size: 12px;
  color: #92400e;
  background: #fef3c7;
  padding: 6px 10px;
  border-radius: 4px;
  margin-bottom: 10px;
}

.task-result {
  font-size: 13px;
  color: #065f46;
  margin-bottom: 8px;
  line-height: 1.5;
}

.task-actions {
  display: flex;
  gap: 8px;
}

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: #9ca3af;
  font-size: 14px;
}

.inc-link {
  color: #3b82f6;
  cursor: pointer;
  text-decoration: underline;
}

.inc-link:hover {
  color: #1d4ed8;
}

.text-danger {
  color: #dc2626 !important;
  font-weight: 600;
}

.dialog-summary {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 16px;
}

.summary-row-title {
  font-weight: 600;
  font-size: 15px;
  color: #1f2937;
  margin-bottom: 8px;
}

.summary-row-item {
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 4px;
}

.summary-row-item span {
  color: #6b7280;
  margin-right: 8px;
}

.detail-card-inner {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px 16px;
}

.detail-item {
  display: flex;
  gap: 6px;
  font-size: 13px;
}

.detail-item .label {
  color: #6b7280;
  min-width: 70px;
}

.detail-item .value {
  color: #1f2937;
  font-weight: 500;
}

.section-h4 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px dashed #e5e7eb;
}

.desc-block {
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
  background: #f9fafb;
  padding: 10px;
  border-radius: 6px;
}

.mt-4 {
  margin-top: 4px;
}

.receipt-timeline {
  position: relative;
  padding-left: 20px;
}

.receipt-item {
  position: relative;
  padding-left: 20px;
  padding-bottom: 16px;
  border-left: 2px solid #e5e7eb;
}

.receipt-item:last-child {
  border-left-color: transparent;
  padding-bottom: 0;
}

.receipt-dot {
  position: absolute;
  left: -7px;
  top: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
}

.dot-派发 {
  background: #3b82f6;
  box-shadow: 0 0 0 2px #3b82f6;
}

.dot-签收 {
  background: #059669;
  box-shadow: 0 0 0 2px #059669;
}

.dot-完成 {
  background: #059669;
  box-shadow: 0 0 0 2px #059669;
}

.dot-超时 {
  background: #dc2626;
  box-shadow: 0 0 0 2px #dc2626;
}

.receipt-content {
  background: #f9fafb;
  border-radius: 6px;
  padding: 10px;
}

.receipt-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.receipt-action {
  font-weight: 600;
  font-size: 13px;
  color: #1f2937;
}

.receipt-time {
  font-size: 12px;
  color: #9ca3af;
}

.receipt-meta {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.receipt-remark {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.5;
}
</style>