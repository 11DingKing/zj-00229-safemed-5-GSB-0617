import axios from "axios";

const request = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error("API Error:", error);
    return Promise.reject(error);
  },
);

export default {
  getIncidents(params) {
    return request.get("/incidents", { params });
  },
  getIncident(id) {
    return request.get(`/incidents/${id}`);
  },
  createIncident(data) {
    return request.post("/incidents", data);
  },
  addDisposition(id, data) {
    return request.post(`/incidents/${id}/disposition`, data);
  },
  addOpinion(id, data) {
    return request.post(`/incidents/${id}/opinions`, data);
  },
  getHospitals() {
    return request.get("/hospitals");
  },
  getDepartments() {
    return request.get("/departments");
  },
  getStatsByType() {
    return request.get("/stats/by-type");
  },
  getStatsByHospital() {
    return request.get("/stats/by-hospital");
  },
  getStatsOverview() {
    return request.get("/stats/overview");
  },
  getDict() {
    return request.get("/dict");
  },

  getTasks(params) {
    return request.get("/tasks", { params });
  },
  getTask(id) {
    return request.get(`/tasks/${id}`);
  },
  getTasksByDepartment(dept) {
    return request.get(`/tasks/department/${encodeURIComponent(dept)}/summary`);
  },
  getIncidentTasks(id) {
    return request.get(`/incidents/${id}/tasks`);
  },
  createTask(incidentId, data) {
    return request.post(`/incidents/${incidentId}/tasks`, data);
  },
  acknowledgeTask(id, data) {
    return request.post(`/tasks/${id}/acknowledge`, data);
  },
  completeTask(id, data) {
    return request.post(`/tasks/${id}/complete`, data);
  },

  getTaskStatsOverview() {
    return request.get("/stats/tasks/overview");
  },
  getTaskDeadlineRate(params) {
    return request.get("/stats/tasks/deadline-rate", { params });
  },
  getTaskDrilldown(params) {
    return request.get("/stats/tasks/drilldown", { params });
  },

  getReview(incidentId) {
    return request.get(`/reviews/${incidentId}`);
  },
  saveReview(incidentId, data) {
    return request.post(`/reviews/${incidentId}`, data);
  },

  getPlans(params) {
    return request.get("/plans", { params });
  },
  getPlan(id) {
    return request.get(`/plans/${id}`);
  },
  matchPlans(params) {
    return request.get("/plans/match", { params });
  },
  incrementPlanUse(id) {
    return request.post(`/plans/${id}/increment`);
  },

  getHighRiskStats(params) {
    return request.get("/stats/high-risk", { params });
  },
  getStatsByDepartment(params) {
    return request.get("/stats/by-department", { params });
  },
};
