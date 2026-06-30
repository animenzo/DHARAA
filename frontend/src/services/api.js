import axios from "axios";

/**
 * Main API instance (for normal requests)
 */

// const urls = [
//   import.meta.env.VITE_API_URL, "http://localhost:5000"
// ]

// const API = axios.create({
//   baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
// });
const API = axios.create({
  baseURL:
    window.location.hostname === "localhost"
      ? "http://localhost:5000"
      : import.meta.env.VITE_API_URL,
});
/**
 * Separate instance for refresh token
 * (NO interceptors to avoid infinite loop)
 */
const refreshAPI = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
});
// 
/**
 * Attach access token on every request
 */
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Handle expired token (401)
 */
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only try refresh once
    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const res = await refreshAPI.post("/auth/refresh");

        const newToken = res.data.token;
        localStorage.setItem("token", newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return API(originalRequest);

      } catch (refreshError) {
        // Refresh failed → logout
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        window.location.href = "/home";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// --- FARM METHODS ---
API.getAllCrops = async () => {
  const response = await API.get('/farms/crops');
  return response.data;
};

API.getAllSoils = async () => {
  const response = await API.get('/farms/soils');
  return response.data;
};

API.getFarms = async () => {
  const response = await API.get('/farms/farm');
  return response.data;
};

API.getFarmById = async (id) => {
  const response = await API.get(`/farms/farm/${id}`);
  return response.data;
};

API.createFarm = async (farmData) => {
  const response = await API.post('/farms/farm', farmData);
  return response.data;
};

API.updateFarm = async ({ id, data }) => {
  const response = await API.patch(`/farms/farm/${id}`, data);
  return response.data;
};

API.deleteFarm = async (id) => {
  const response = await API.delete(`/farms/farm/${id}`);
  return response.data;
};

// --- SCHEDULE METHODS ---
API.getMySchedules = async () => {
  const response = await API.get('/schedules/schedule');
  return response.data;
};

API.getSchedule = async (id) => {
  const response = await API.get(`/schedules/schedule/${id}`);
  return response.data;
};

API.createSchedule = async (scheduleData) => {
  const response = await API.post('/schedules/schedule', scheduleData);
  return response.data;
};

API.updateSchedule = async ({ id, data }) => {
  const response = await API.put(`/schedules/schedule/${id}`, data);
  return response.data;
};

API.deleteSchedule = async (id) => {
  const response = await API.delete(`/schedules/schedule/${id}`);
  return response.data;
};

// --- PIN MANAGEMENT ---
// Fetch all pins for a specific farm
API.getFarmPins = async (farmId) => {
  const response = await API.get(`/device/pins/${farmId}`);
  return response.data;
};

// Add a new sensor/actuator mapping
API.addPin = async (pinData) => {
  const response = await API.post('/device/pins', pinData);
  return response.data;
};

// Remove a mapping
API.deletePin = async (pinId) => {
  const response = await API.delete(`/device/pins/${pinId}`);
  return response.data;
};
export default API;
