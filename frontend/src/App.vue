<template>
  <div>
    <div class="app-header">
      <h1>
        <el-icon size="24"><Warning /></el-icon>
        伤医闹医事件联动处置系统
      </h1>
      <div class="user-info">
        <el-icon><User /></el-icon>
        <span>值班员：李值班</span>
      </div>
    </div>

    <div class="app-main">
      <div class="page-container">
        <el-tabs v-model="activeTab" @tab-change="handleTabChange">
          <el-tab-pane label="事件列表" name="list">
            <div class="list-layout">
              <div class="list-main">
                <IncidentList ref="listRef" @view-detail="viewDetail" />
              </div>
              <div class="list-side">
                <TaskPanel
                  :department="currentDept"
                  @view-incident="viewDetail"
                  @task-updated="onTaskUpdated"
                />
              </div>
            </div>
          </el-tab-pane>
          <el-tab-pane label="统计分析" name="stats">
            <Stats />
          </el-tab-pane>
          <el-tab-pane label="预案库" name="plans">
            <PlanLibrary />
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>

    <el-drawer
      v-model="detailVisible"
      title="事件详情"
      direction="rtl"
      size="60%"
      :before-close="closeDetail"
    >
      <IncidentDetail
        v-if="detailVisible && currentId"
        :id="currentId"
        @refresh="refreshList"
        @close="closeDetail"
      />
    </el-drawer>
  </div>
</template>

<script setup>
import { ref } from "vue";
import IncidentList from "./views/IncidentList.vue";
import IncidentDetail from "./views/IncidentDetail.vue";
import Stats from "./views/Stats.vue";
import TaskPanel from "./views/TaskPanel.vue";
import PlanLibrary from "./views/PlanLibrary.vue";

const activeTab = ref("list");
const detailVisible = ref(false);
const currentId = ref(null);
const currentDept = ref("医院安保科");
const listRef = ref(null);

const handleTabChange = () => {};

const viewDetail = (id) => {
  currentId.value = id;
  detailVisible.value = true;
};

const closeDetail = () => {
  detailVisible.value = false;
};

const refreshList = () => {
  activeTab.value = "list";
};

const onTaskUpdated = () => {};
</script>

<style scoped>
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.list-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.list-main {
  flex: 1;
  min-width: 0;
}

.list-side {
  width: 420px;
  flex-shrink: 0;
}
</style>
