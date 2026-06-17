<template>
  <div>
    <el-row :gutter="16" style="margin-bottom: 16px">
      <el-col :span="6">
        <div class="stat-card">
          <div class="icon" style="background: #ede9fe">
            <el-icon color="#7c3aed"><Collection /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ planSummary.total }}</div>
            <div class="label">预案总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="icon" style="background: #fef3c7">
            <el-icon color="#d97706"><View /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ planSummary.total_used }}</div>
            <div class="label">累计复用次数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="icon" style="background: #dbeafe">
            <el-icon color="#1d4ed8"><Check /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ planSummary.types_count }}</div>
            <div class="label">覆盖类型数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="icon" style="background: #d1fae5">
            <el-icon color="#059669"><TrendCharts /></el-icon>
          </div>
          <div class="info">
            <div class="value">{{ planSummary.avg_used }}%</div>
            <div class="label">平均复用率</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <div class="detail-card">
      <div class="table-toolbar">
        <div class="filter-group">
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
            placeholder="适用医院"
            style="width: 180px"
            @change="fetchList"
            filterable
            allow-create
          >
            <el-option label="全部医院" value="" />
            <el-option
              v-for="h in hospitals"
              :key="h.name"
              :label="h.name"
              :value="h.name"
            />
          </el-select>

          <el-input
            v-model="filter.keyword"
            placeholder="搜索预案标题/定性/处置要点..."
            style="width: 260px"
            clearable
            @keyup.enter="fetchList"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <div
        v-if="planList.length === 0"
        style="color: #9ca3af; text-align: center; padding: 40px"
      >
        暂无匹配的预案数据
      </div>
      <div v-else style="display: flex; flex-direction: column; gap: 12px">
        <div
          v-for="plan in planList"
          :key="plan.id"
          class="plan-card"
          @click="viewPlan(plan)"
        >
          <div class="plan-head">
            <div
              style="
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
                min-width: 0;
              "
            >
              <el-tag size="small" type="primary" effect="light">
                {{ plan.plan_no }}
              </el-tag>
              <span
                :class="['type-tag', 'type-' + plan.type]"
                style="font-size: 11px; padding: 2px 6px"
              >
                {{ plan.type_text }}
              </span>
              <span class="plan-title">{{ plan.title }}</span>
            </div>
            <div
              style="
                display: flex;
                align-items: center;
                gap: 10px;
                flex-shrink: 0;
              "
            >
              <el-tag size="small" type="info" effect="plain">
                复用 {{ plan.use_count || 0 }} 次
              </el-tag>
              <el-button
                type="primary"
                link
                size="small"
                @click.stop="viewPlan(plan)"
              >
                <el-icon><View /></el-icon>查看详情
              </el-button>
            </div>
          </div>

          <div class="plan-body">
            <div class="plan-section">
              <span class="plan-section-label">定性结论：</span>
              <span class="plan-section-value qualitative">{{
                plan.qualitative
              }}</span>
            </div>
            <div class="plan-section">
              <span class="plan-section-label">核心处置要点：</span>
              <span class="plan-section-value" style="white-space: pre-line">
                {{ plan.key_points }}
              </span>
            </div>
            <div class="plan-meta">
              <span v-if="plan.reference_incident_no">
                参考案例：<el-tag size="small" effect="plain" type="success">
                  {{ plan.reference_incident_no }}
                </el-tag>
              </span>
              <span v-if="plan.applicable_hospitals">
                适用医院：{{ plan.applicable_hospitals }}
              </span>
              <span v-if="plan.applicable_departments">
                适用科室：{{ plan.applicable_departments }}
              </span>
              <span
                >创建时间：{{
                  String(plan.created_at || "").slice(0, 16)
                }}</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>

    <el-drawer
      v-model="detailVisible"
      :title="'预案详情 - ' + (currentPlan?.plan_no || '')"
      direction="rtl"
      size="55%"
    >
      <div v-if="currentPlan" style="padding-right: 8px">
        <div
          style="
            margin-bottom: 16px;
            display: flex;
            align-items: center;
            gap: 10px;
          "
        >
          <span :class="['type-tag', 'type-' + currentPlan.type]">{{
            currentPlan.type_text
          }}</span>
          <el-tag type="info" effect="plain"
            >复用 {{ currentPlan.use_count || 0 }} 次</el-tag
          >
        </div>

        <h3
          style="
            font-size: 18px;
            color: #111827;
            margin-bottom: 16px;
            font-weight: 700;
          "
        >
          {{ currentPlan.title }}
        </h3>

        <div class="pd-card">
          <div class="pd-label">定性结论</div>
          <div class="pd-content qualitative">
            {{ currentPlan.qualitative }}
          </div>
        </div>

        <div class="pd-card">
          <div class="pd-label">核心处置要点</div>
          <div class="pd-content keypoints" style="white-space: pre-line">
            {{ currentPlan.key_points }}
          </div>
        </div>

        <div class="pd-card">
          <div class="pd-label">建议处置步骤</div>
          <div class="pd-content">
            <ol class="pd-steps">
              <li v-for="(step, idx) in currentPlan.suggested_steps" :key="idx">
                {{ step }}
              </li>
            </ol>
          </div>
        </div>

        <div class="pd-card">
          <div class="pd-label">适用范围</div>
          <div class="pd-content" style="font-size: 13px">
            <div v-if="currentPlan.applicable_hospitals">
              <strong>适用医院：</strong>{{ currentPlan.applicable_hospitals }}
            </div>
            <div
              v-if="currentPlan.applicable_departments"
              style="margin-top: 4px"
            >
              <strong>适用科室：</strong
              >{{ currentPlan.applicable_departments }}
            </div>
            <div
              v-if="currentPlan.reference_incident_no"
              style="margin-top: 4px"
            >
              <strong>参考案例：</strong>
              <el-link type="primary" style="font-family: monospace">
                {{ currentPlan.reference_incident_no }}
              </el-link>
            </div>
            <div style="margin-top: 4px">
              <strong>创建时间：</strong
              >{{ String(currentPlan.created_at || "").slice(0, 19) }}
            </div>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import api from "../utils/api";

const planList = ref([]);
const hospitals = ref([]);
const dict = ref({ types: [] });

const filter = reactive({
  type: "all",
  hospital: "",
  keyword: "",
});

const detailVisible = ref(false);
const currentPlan = ref(null);

const planSummary = computed(() => {
  const total = planList.value.length;
  const totalUsed = planList.value.reduce((s, p) => s + (p.use_count || 0), 0);
  const typeSet = new Set(planList.value.map((p) => p.type));
  const avgRate =
    total > 0
      ? Math.round(
          (planList.value.filter((p) => p.use_count > 0).length / total) * 100,
        )
      : 0;
  return {
    total,
    total_used: totalUsed,
    types_count: typeSet.size,
    avg_used: avgRate,
  };
});

const fetchList = () => {
  const params = {};
  if (filter.type && filter.type !== "all") params.type = filter.type;
  if (filter.hospital) params.hospital = filter.hospital;
  if (filter.keyword) params.keyword = filter.keyword;
  api.getPlans(params).then((res) => {
    planList.value = res.list || [];
  });
};

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

const viewPlan = (plan) => {
  api.getPlan(plan.id).then((res) => {
    currentPlan.value = res;
    detailVisible.value = true;
  });
};

onMounted(() => {
  fetchDict();
  fetchHospitals();
  fetchList();
});
</script>

<style scoped>
.plan-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.plan-card:hover {
  border-color: #93c5fd;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.08);
}

.plan-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  gap: 12px;
}

.plan-title {
  font-weight: 600;
  font-size: 15px;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-body {
  padding-top: 10px;
  border-top: 1px dashed #e5e7eb;
}

.plan-section {
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.7;
}

.plan-section-label {
  font-weight: 600;
  color: #2563eb;
}

.plan-section-value.qualitative {
  color: #9a3412;
  background: #fff7ed;
  padding: 6px 10px;
  border-radius: 4px;
  display: inline-block;
}

.plan-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: #6b7280;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #f3f4f6;
}

.pd-card {
  margin-bottom: 16px;
}

.pd-label {
  font-size: 13px;
  font-weight: 600;
  color: #3b82f6;
  margin-bottom: 6px;
  padding-left: 8px;
  border-left: 3px solid #3b82f6;
}

.pd-content {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.8;
  color: #1f2937;
}

.pd-content.qualitative {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #9a3412;
}

.pd-content.keypoints {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #14532d;
}

.pd-steps {
  margin: 0;
  padding-left: 20px;
}

.pd-steps li {
  margin-bottom: 4px;
  line-height: 1.8;
}
</style>
