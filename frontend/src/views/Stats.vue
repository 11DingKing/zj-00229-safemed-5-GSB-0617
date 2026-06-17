<template>
  <div>
    <el-alert
      v-if="
        highRisk.summary &&
        (highRisk.summary.total_high_risk_hospitals > 0 ||
          highRisk.summary.total_high_risk_departments > 0)
      "
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom: 20px"
    >
      <template #title>
        <div
          style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap"
        >
          <span>
            <strong style="font-size: 15px; color: #991b1b">
              <el-icon style="vertical-align: -2px"><WarningFilled /></el-icon>
              风险预警看板（近30天）：
            </strong>
          </span>
          <span>
            高发单位
            <el-tag
              type="danger"
              effect="dark"
              size="small"
              style="margin-left: 6px"
            >
              {{ highRisk.summary.total_high_risk_hospitals }} 家
            </el-tag>
          </span>
          <span>
            高发科室
            <el-tag
              type="warning"
              effect="dark"
              size="small"
              style="margin-left: 6px"
            >
              {{ highRisk.summary.total_high_risk_departments }} 个
            </el-tag>
          </span>
          <span v-if="highRisk.summary.recent_week_count !== undefined">
            近7天接报
            <el-tag type="danger" size="small" style="margin-left: 6px">
              {{ highRisk.summary.recent_week_count }} 起
            </el-tag>
          </span>
          <span v-if="highRisk.summary.week_growth_rate > 0">
            周环比
            <el-tag
              type="danger"
              effect="plain"
              size="small"
              style="margin-left: 6px"
            >
              ↑ {{ highRisk.summary.week_growth_rate }}%
            </el-tag>
          </span>
          <span v-else-if="highRisk.summary.week_growth_rate < 0">
            周环比
            <el-tag
              type="success"
              effect="plain"
              size="small"
              style="margin-left: 6px"
            >
              ↓ {{ Math.abs(highRisk.summary.week_growth_rate) }}%
            </el-tag>
          </span>
        </div>
      </template>
    </el-alert>

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
          <div class="icon" style="background: #d1fae5">
            <el-icon color="#059669"><CircleCheck /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ overview.closed }}</div>
            <div class="label">已结案</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="icon" style="background: #ede9fe">
            <el-icon color="#7c3aed"><Timer /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ overview.avg_hours }}h</div>
            <div class="label">平均处置时长</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom: 20px">
      <el-col :span="4">
        <div class="stat-card task-stat-mini">
          <div class="icon" style="background: #e0e7ff">
            <el-icon color="#4338ca"><List /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ taskOverview.total }}</div>
            <div class="label">协同任务总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card task-stat-mini">
          <div class="icon" style="background: #fef3c7">
            <el-icon color="#b45309"><Bell /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ taskOverview.pending_acknowledge }}</div>
            <div class="label">待签收</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card task-stat-mini">
          <div class="icon" style="background: #dbeafe">
            <el-icon color="#1d4ed8"><Loading /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ taskOverview.processing }}</div>
            <div class="label">处置中</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card task-stat-mini">
          <div class="icon" style="background: #fee2e2">
            <el-icon color="#dc2626"><WarnTriangleFilled /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ taskOverview.overdue }}</div>
            <div class="label">超时任务</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card task-stat-mini">
          <div class="icon" style="background: #d1fae5">
            <el-icon color="#059669"><CircleCheck /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ taskOverview.completed }}</div>
            <div class="label">已完成</div>
          </div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card task-stat-mini">
          <div class="icon" style="background: #fce7f3">
            <el-icon color="#be185d"><Minus /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ taskOverview.total_deduction }}</div>
            <div class="label">累计扣分</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <div class="detail-card">
          <h3 class="detail-section-title">按事件类型统计</h3>
          <el-table :data="byTypeData" stripe>
            <el-table-column prop="type_text" label="事件类型" width="140">
              <template #default="{ row }">
                <span :class="['type-tag', 'type-' + row.type]">{{
                  row.type_text
                }}</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="count"
              label="发生数"
              width="100"
              align="center"
            />
            <el-table-column label="占比" width="120">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 8px">
                  <el-progress
                    :percentage="getPercentage(row.count, totalCount)"
                    :stroke-width="8"
                    :show-text="false"
                    style="flex: 1"
                  />
                  <span
                    style="font-size: 12px; color: #6b7280; min-width: 40px"
                  >
                    {{ getPercentage(row.count, totalCount) }}%
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="avg_hours"
              label="平均处置时长(h)"
              align="center"
            />
          </el-table>

          <div style="margin-top: 20px">
            <h4 style="font-size: 14px; color: #374151; margin-bottom: 12px">
              类型分布
            </h4>
            <div
              style="
                display: flex;
                align-items: flex-end;
                height: 180px;
                gap: 24px;
                padding: 0 20px;
              "
            >
              <div
                v-for="item in byTypeData"
                :key="item.type"
                style="
                  flex: 1;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 8px;
                "
              >
                <div
                  :style="{
                    height: getBarHeight(item.count, maxTypeCount) + 'px',
                    width: '100%',
                    background: getTypeColor(item.type),
                    borderRadius: '4px 4px 0 0',
                  }"
                ></div>
                <span style="font-size: 12px; color: #6b7280">{{
                  item.type_text
                }}</span>
                <span
                  style="font-size: 13px; font-weight: 600; color: #1f2937"
                  >{{ item.count }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="detail-card">
          <h3 class="detail-section-title">按医院统计</h3>
          <el-table :data="byHospitalData" stripe>
            <el-table-column prop="hospital" label="医院名称" />
            <el-table-column
              prop="count"
              label="发生数"
              width="100"
              align="center"
            />
            <el-table-column label="占比" width="140">
              <template #default="{ row }">
                <div style="display: flex; align-items: center; gap: 8px">
                  <el-progress
                    :percentage="getPercentage(row.count, totalCount)"
                    :stroke-width="8"
                    :show-text="false"
                    style="flex: 1"
                    status="success"
                  />
                  <span
                    style="font-size: 12px; color: #6b7280; min-width: 40px"
                  >
                    {{ getPercentage(row.count, totalCount) }}%
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="avg_hours"
              label="平均处置时长(h)"
              width="120"
              align="center"
            />
          </el-table>

          <div style="margin-top: 20px">
            <h4 style="font-size: 14px; color: #374151; margin-bottom: 12px">
              医院分布
            </h4>
            <div style="display: flex; flex-direction: column; gap: 12px">
              <div
                v-for="item in byHospitalData"
                :key="item.hospital"
                style="display: flex; align-items: center; gap: 12px"
              >
                <span
                  style="
                    width: 140px;
                    font-size: 13px;
                    color: #374151;
                    text-align: right;
                  "
                >
                  {{ item.hospital }}
                </span>
                <div
                  style="
                    flex: 1;
                    height: 24px;
                    background: #f3f4f6;
                    border-radius: 4px;
                    overflow: hidden;
                  "
                >
                  <div
                    :style="{
                      width: getPercentage(item.count, maxHospitalCount) + '%',
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                    }"
                  ></div>
                </div>
                <span
                  style="
                    width: 60px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #1f2937;
                  "
                >
                  {{ item.count }}件
                </span>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="12">
        <div class="detail-card">
          <h3 class="detail-section-title">
            <el-icon
              style="vertical-align: -2px; margin-right: 4px; color: #dc2626"
              ><WarningFilled
            /></el-icon>
            高发单位预警（近30天）
          </h3>
          <div
            v-if="highRisk.high_risk_hospitals.length === 0"
            style="color: #6b7280; text-align: center; padding: 20px"
          >
            暂无高发单位预警
          </div>
          <div v-else style="display: flex; flex-direction: column; gap: 10px">
            <div
              v-for="h in highRisk.high_risk_hospitals"
              :key="h.hospital"
              class="risk-card rc-hospital"
            >
              <div class="risk-head">
                <span class="risk-name">{{ h.hospital }}</span>
                <el-tag type="danger" effect="dark" size="small">
                  {{ h.count }} 起
                </el-tag>
              </div>
              <div class="risk-sub">
                <span v-if="h.critical_count">
                  <el-tag size="small" type="danger" effect="plain">
                    特急 {{ h.critical_count }}
                  </el-tag>
                </span>
                <span v-if="h.high_count" style="margin-left: 6px">
                  <el-tag size="small" type="warning" effect="plain">
                    紧急 {{ h.high_count }}
                  </el-tag>
                </span>
              </div>
            </div>
          </div>
        </div>
      </el-col>

      <el-col :span="12">
        <div class="detail-card">
          <h3 class="detail-section-title">
            <el-icon
              style="vertical-align: -2px; margin-right: 4px; color: #d97706"
              ><AlarmClock
            /></el-icon>
            高发科室预警（近30天）
          </h3>
          <div
            v-if="highRisk.high_risk_departments.length === 0"
            style="color: #6b7280; text-align: center; padding: 20px"
          >
            暂无高发科室预警
          </div>
          <div v-else style="display: flex; flex-direction: column; gap: 10px">
            <div
              v-for="d in highRisk.high_risk_departments.slice(0, 8)"
              :key="d.hospital + d.department"
              class="risk-card rc-department"
            >
              <div class="risk-head">
                <span class="risk-name">
                  <span style="color: #64748b; font-weight: 400">{{
                    d.hospital
                  }}</span>
                  {{ d.department }}
                </span>
                <el-tag type="warning" effect="dark" size="small">
                  {{ d.count }} 起
                </el-tag>
              </div>
              <div class="risk-sub">
                <span v-if="d.critical_count">
                  <el-tag size="small" type="danger" effect="plain">
                    特急 {{ d.critical_count }}
                  </el-tag>
                </span>
                <span v-if="d.high_count" style="margin-left: 6px">
                  <el-tag size="small" type="warning" effect="plain">
                    紧急 {{ d.high_count }}
                  </el-tag>
                </span>
              </div>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <div class="detail-card" style="margin-top: 16px">
      <h3 class="detail-section-title">各部门任务时限达标率</h3>

      <div class="deadline-summary">
        <div class="dl-summary-item">
          <span class="dl-s-label">总任务</span>
          <span class="dl-s-value">{{ deadlineSummary.total }}</span>
        </div>
        <div class="dl-summary-item">
          <span class="dl-s-label">已完成</span>
          <span class="dl-s-value" style="color: #059669">{{
            deadlineSummary.completed
          }}</span>
        </div>
        <div class="dl-summary-item">
          <span class="dl-s-label">按时完成</span>
          <span class="dl-s-value" style="color: #1d4ed8">{{
            deadlineSummary.on_time
          }}</span>
        </div>
        <div class="dl-summary-item">
          <span class="dl-s-label">超时</span>
          <span class="dl-s-value" style="color: #dc2626">{{
            deadlineSummary.overdue
          }}</span>
        </div>
        <div class="dl-summary-item">
          <span class="dl-s-label">总扣分</span>
          <span class="dl-s-value" style="color: #be185d">{{
            deadlineSummary.total_deduction
          }}</span>
        </div>
        <div class="dl-summary-item">
          <span class="dl-s-label">总达标率</span>
          <span class="dl-s-value" style="color: #059669; font-size: 22px"
            >{{ deadlineSummary.deadline_rate }}%</span
          >
        </div>
        <div class="dl-summary-item">
          <span class="dl-s-label">总完成率</span>
          <span class="dl-s-value" style="color: #1d4ed8; font-size: 22px"
            >{{ deadlineSummary.completion_rate }}%</span
          >
        </div>
      </div>

      <el-table
        :data="deadlineRateData"
        stripe
        style="margin-top: 16px"
        @row-click="drilldownDept"
        class="clickable-table"
      >
        <el-table-column prop="department" label="部门" width="180" />
        <el-table-column
          prop="total"
          label="任务总数"
          width="90"
          align="center"
        />
        <el-table-column
          prop="completed"
          label="已完成"
          width="90"
          align="center"
        />
        <el-table-column
          prop="on_time"
          label="按时完成"
          width="90"
          align="center"
        >
          <template #default="{ row }">
            <span style="color: #059669; font-weight: 600">{{
              row.on_time
            }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="overdue" label="超时" width="80" align="center">
          <template #default="{ row }">
            <span
              :style="{
                color: row.overdue > 0 ? '#dc2626' : '#6b7280',
                fontWeight: row.overdue > 0 ? '600' : '400',
              }"
            >
              {{ row.overdue }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="时限达标率" width="160">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px">
              <el-progress
                :percentage="row.deadline_rate"
                :stroke-width="10"
                :show-text="false"
                :color="getRateColor(row.deadline_rate)"
                style="flex: 1"
              />
              <span
                :style="{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: getRateTextColor(row.deadline_rate),
                  minWidth: '45px',
                }"
              >
                {{ row.deadline_rate }}%
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="完成率" width="140">
          <template #default="{ row }">
            <div style="display: flex; align-items: center; gap: 8px">
              <el-progress
                :percentage="row.completion_rate"
                :stroke-width="10"
                :show-text="false"
                style="flex: 1"
              />
              <span style="font-size: 13px; color: #6b7280; min-width: 45px">
                {{ row.completion_rate }}%
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="avg_completion_hours"
          label="平均用时(h)"
          width="110"
          align="center"
        >
          <template #default="{ row }">
            <span>{{ row.avg_completion_hours || "-" }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="total_deduction"
          label="累计扣分"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <span
              :style="{
                color: row.total_deduction > 0 ? '#dc2626' : '#6b7280',
                fontWeight: row.total_deduction > 0 ? '600' : '400',
              }"
            >
              {{ row.total_deduction > 0 ? "-" + row.total_deduction : 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              @click.stop="drilldownDept(row)"
            >
              下钻
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer
      v-model="drilldownVisible"
      :title="'处置时长下钻 - ' + drilldownDeptName"
      direction="rtl"
      size="65%"
    >
      <div v-if="drilldownVisible">
        <div class="drilldown-filters">
          <el-select
            v-model="drilldownStatus"
            placeholder="任务状态"
            style="width: 140px"
            clearable
            @change="fetchDrilldown"
          >
            <el-option label="全部状态" value="all" />
            <el-option label="待签收" value="pending_acknowledge" />
            <el-option label="处置中" value="processing" />
            <el-option label="已完成" value="completed" />
            <el-option label="已超时" value="overdue" />
          </el-select>
        </div>

        <el-table :data="drilldownList" stripe style="margin-top: 12px">
          <el-table-column prop="task_no" label="任务编号" width="150">
            <template #default="{ row }">
              <span style="font-family: monospace; font-size: 13px">{{
                row.task_no
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="title"
            label="任务标题"
            min-width="160"
            show-overflow-tooltip
          />
          <el-table-column label="关联事件" width="130">
            <template #default="{ row }">
              <span style="font-family: monospace; font-size: 12px">{{
                row.incident_no
              }}</span>
            </template>
          </el-table-column>
          <el-table-column label="事件类型" width="100">
            <template #default="{ row }">
              <span style="font-size: 12px">{{ row.incident_type }}</span>
            </template>
          </el-table-column>
          <el-table-column label="医院" width="120" show-overflow-tooltip>
            <template #default="{ row }">
              <span style="font-size: 12px">{{ row.hospital }}</span>
            </template>
          </el-table-column>
          <el-table-column label="紧急程度" width="90">
            <template #default="{ row }">
              <span
                :class="['urgency-tag', 'urgency-' + row.urgency_level]"
                style="font-size: 11px; padding: 2px 6px"
              >
                {{ row.urgency_text }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <span :class="['drilldown-status', 'ds-' + row.status]">{{
                row.status_text
              }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="assign_time" label="派发时间" width="140">
            <template #default="{ row }">
              <span style="font-size: 12px">{{
                formatTime(row.assign_time)
              }}</span>
            </template>
          </el-table-column>
          <el-table-column label="时限" width="140">
            <template #default="{ row }">
              <span style="font-size: 12px">{{
                formatTime(row.deadline)
              }}</span>
            </template>
          </el-table-column>
          <el-table-column label="用时/剩余" width="100" align="center">
            <template #default="{ row }">
              <span
                v-if="row.status === 'completed'"
                style="color: #059669; font-weight: 600"
                >{{ row.elapsed_hours }}h</span
              >
              <span
                v-else-if="row.remaining_hours !== null"
                :style="{
                  color: row.is_overdue
                    ? '#dc2626'
                    : row.remaining_hours <= 1
                      ? '#ea580c'
                      : '#6b7280',
                }"
              >
                {{ row.is_overdue ? "已超时" : row.remaining_hours + "h" }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="扣分" width="70" align="center">
            <template #default="{ row }">
              <span
                v-if="row.score_deducted > 0"
                style="color: #dc2626; font-weight: 600"
                >-{{ row.score_deducted }}</span
              >
              <span v-else style="color: #6b7280">0</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import api from "../utils/api";

const overview = ref({
  total: 0,
  pending: 0,
  critical: 0,
  closed: 0,
  avg_hours: 0,
});
const byTypeData = ref([]);
const byHospitalData = ref([]);

const highRisk = ref({
  high_risk_hospitals: [],
  high_risk_departments: [],
  summary: null,
});

const taskOverview = ref({
  total: 0,
  pending_acknowledge: 0,
  processing: 0,
  completed: 0,
  overdue: 0,
  total_deduction: 0,
});

const deadlineRateData = ref([]);
const deadlineSummary = ref({
  total: 0,
  completed: 0,
  on_time: 0,
  overdue: 0,
  total_deduction: 0,
  deadline_rate: 0,
  completion_rate: 0,
});

const drilldownVisible = ref(false);
const drilldownDeptName = ref("");
const drilldownStatus = ref("all");
const drilldownList = ref([]);

const totalCount = computed(() => overview.value.total);

const maxTypeCount = computed(() => {
  if (byTypeData.value.length === 0) return 1;
  return Math.max(...byTypeData.value.map((d) => d.count));
});

const maxHospitalCount = computed(() => {
  if (byHospitalData.value.length === 0) return 1;
  return Math.max(...byHospitalData.value.map((d) => d.count));
});

const getPercentage = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};

const getBarHeight = (value, max) => {
  if (!max) return 0;
  return Math.round((value / max) * 140);
};

const getTypeColor = (type) => {
  const colors = {
    violence: "#ef4444",
    gathering: "#f97316",
    online: "#3b82f6",
    threat: "#8b5cf6",
  };
  return colors[type] || "#6b7280";
};

const getRateColor = (rate) => {
  if (rate >= 90) return "#059669";
  if (rate >= 70) return "#d97706";
  return "#dc2626";
};

const getRateTextColor = (rate) => {
  if (rate >= 90) return "#059669";
  if (rate >= 70) return "#d97706";
  return "#dc2626";
};

const formatTime = (t) => {
  if (!t) return "-";
  return String(t).replace("T", " ").slice(0, 16);
};

const fetchOverview = () => {
  api.getStatsOverview().then((res) => {
    overview.value = res;
  });
};

const fetchByType = () => {
  api.getStatsByType().then((res) => {
    byTypeData.value = res;
  });
};

const fetchByHospital = () => {
  api.getStatsByHospital().then((res) => {
    byHospitalData.value = res;
  });
};

const fetchTaskOverview = () => {
  api.getTaskStatsOverview().then((res) => {
    taskOverview.value = res;
  });
};

const fetchDeadlineRate = () => {
  api.getTaskDeadlineRate().then((res) => {
    deadlineRateData.value = res.departments || [];
    deadlineSummary.value = res.summary || {};
  });
};

const fetchHighRisk = () => {
  api
    .getHighRiskStats({ threshold_hospital: 3, threshold_dept: 2, days: 30 })
    .then((res) => {
      highRisk.value = {
        high_risk_hospitals: res.high_risk_hospitals || [],
        high_risk_departments: res.high_risk_departments || [],
        summary: res.summary || null,
      };
    });
};

const drilldownDept = (row) => {
  drilldownDeptName.value = row.department;
  drilldownStatus.value = "all";
  drilldownVisible.value = true;
  fetchDrilldown();
};

const fetchDrilldown = () => {
  const params = { department: drilldownDeptName.value };
  if (drilldownStatus.value && drilldownStatus.value !== "all") {
    params.status = drilldownStatus.value;
  }
  api.getTaskDrilldown(params).then((res) => {
    drilldownList.value = res.list || [];
  });
};

onMounted(() => {
  fetchOverview();
  fetchByType();
  fetchByHospital();
  fetchTaskOverview();
  fetchDeadlineRate();
  fetchHighRisk();
});
</script>

<style scoped>
.task-stat-mini .info .value {
  font-size: 22px;
}

.deadline-summary {
  display: flex;
  gap: 24px;
  padding: 16px 20px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.dl-summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.dl-s-label {
  font-size: 12px;
  color: #6b7280;
}

.dl-s-value {
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.clickable-table {
  cursor: pointer;
}

.drilldown-filters {
  display: flex;
  gap: 12px;
  align-items: center;
}

.drilldown-status {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.ds-pending_acknowledge {
  background: #fef3c7;
  color: #92400e;
}

.ds-processing {
  background: #dbeafe;
  color: #1e40af;
}

.ds-completed {
  background: #d1fae5;
  color: #065f46;
}

.ds-overdue {
  background: #fee2e2;
  color: #b91c1c;
}

.ds-acknowledged {
  background: #dbeafe;
  color: #1e40af;
}

.risk-card {
  padding: 12px 14px;
  border-radius: 8px;
  border-left: 4px solid;
}

.rc-hospital {
  background: #fef2f2;
  border-left-color: #ef4444;
  border: 1px solid #fecaca;
  border-left-width: 1px;
  border-left-width: 4px;
}

.rc-department {
  background: #fff7ed;
  border-left-color: #f97316;
  border: 1px solid #fed7aa;
  border-left-width: 4px;
}

.risk-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.risk-name {
  font-weight: 600;
  font-size: 14px;
  color: #111827;
}

.risk-sub {
  font-size: 12px;
}
</style>
