// frontend/src/services/iotApi.js
// =============================================================================
// IoT REST API Methods
// =============================================================================
// All HTTP calls for the IoT platform.
// Follows the same pattern as the existing api.js (axios instance with JWT).
//
// IMPORTANT: every farm now has its own device (1:1). Every method below
// takes `farmId` as its first argument so the backend knows which farm's
// device to operate on. Routes are shaped /iot/:farmId/...
//
// Import and call from React Query hooks or components:
//   import iotApi from '../services/iotApi';
//   const { device } = await iotApi.getFarmDevice(farmId);
// =============================================================================

import API from "./api";

const iotApi = {
  // ===========================================================================
  // DEVICE
  // ===========================================================================

  /**
   * Get the device linked to a specific farm.
   * Returns: { device }
   */
  getFarmDevice: async (farmId) => {
    const res = await API.get(`/iot/${farmId}/device`);
    return res.data;
  },

  /**
   * Update device display name / notes for a given farm's device.
   * @param {string} farmId
   * @param {Object} data  { name, notes }
   */
  updateDevice: async (farmId, data) => {
    const res = await API.patch(`/iot/${farmId}/device`, data);
    return res.data;
  },

  /**
   * Regenerate the device authToken (used when token is compromised).
   * Returns the new plainToken — shown once, then irretrievable.
   */


  /**
   * Get MQTT connection details for the device (topics, broker URL).
   * Used to display the ESP32 setup guide in the UI.
   */
  getConnectionInfo: async (farmId) => {
    const res = await API.get(`/iot/${farmId}/device/connection-info`);
    return res.data;
  },

  /**
   * Get live online/offline/stale status for this farm's device.
   */
  getDeviceStatus: async (farmId) => {
    const res = await API.get(`/iot/${farmId}/device/status`, { params: { farmId } });
    return res.data;
  },

  // ===========================================================================
  // SENSOR DATA
  // ===========================================================================

  /**
   * Get the most recent sensor reading for a farm's device.
   * Returns: { reading }
   */
  getLatestReading: async (farmId) => {
    const res = await API.get(`/iot/${farmId}/sensor/latest`);
    return res.data;
  },

  /**
   * Get sensor readings within a time range.
   * @param {string} farmId
   * @param {Object} opts  { from, to, limit }
   */
  getSensorHistory: async (farmId, { from, to, limit = 500 } = {}) => {
    const params = { limit };
    if (from) params.from = from;
    if (to) params.to = to;
    const res = await API.get(`/iot/${farmId}/sensor/history`, { params });
    return res.data;
  },

  /**
   * Get hourly aggregated sensor data for the last 24 hours.
   * Used for the dashboard chart.
   */
  getLast24Hours: async (farmId) => {
    const res = await API.get(`/iot/${farmId}/sensor/last24h`);
    return res.data;
  },

  /**
   * Get daily average sensor data for the last N days.
   * @param {string} farmId
   * @param {number} days  Number of days (default 7)
   */
  getDailyAverages: async (farmId, days = 7) => {
    const res = await API.get(`/iot/${farmId}/sensor/daily-averages`, {
      params: { days },
    });
    return res.data;
  },

  // ===========================================================================
  // PUMP / ACTUATOR CONTROL
  // ===========================================================================

  /**
   * Send a command to an actuator (pump, valve) on a farm's device.
   * @param {string} farmId
   * @param {Object} command  { actuator: "pump", value: 1, source: "manual" }
   */
  sendCommand: async (farmId, command) => {
    const res = await API.post(`/iot/${farmId}/command`, command);
    return res.data;
  },

  /** Turn the pump ON. */
  pumpOn: async (farmId) => {
    const res = await API.post(`/iot/${farmId}/command`, {
      actuator: "pump",
      value: 1,
      source: "manual",
    });
    return res.data;
  },

  /** Turn the pump OFF. */
  pumpOff: async (farmId) => {
    const res = await API.post(`/iot/${farmId}/command`, {
      actuator: "pump",
      value: 0,
      source: "manual",
    });
    return res.data;
  },

  /** Open the valve. */
  valveOpen: async (farmId) => {
    const res = await API.post(`/iot/${farmId}/command`, {
      actuator: "valve",
      value: 1,
      source: "manual",
    });
    return res.data;
  },

  /** Close the valve. */
  valveClose: async (farmId) => {
    const res = await API.post(`/iot/${farmId}/command`, {
      actuator: "valve",
      value: 0,
      source: "manual",
    });
    return res.data;
  },

  /**
   * Get command history for a farm's device.
   * @param {string} farmId
   * @param {number} limit  Max records (default 50)
   */
  getCommandHistory: async (farmId, limit = 50) => {
    const res = await API.get(`/iot/${farmId}/command/history`, { params: { limit } });
    return res.data;
  },

  // NOTE: getCommandStatus / retryCommand / cancelCommand are NOT farm-scoped
  // on the backend (they're looked up by command ID + user ownership), so
  // they don't take farmId. Add them here only if/when you wire up retry UI:
  //
  // getCommandStatus: async (commandId) => {
  //   const res = await API.get(`/iot/command/${commandId}/status`);
  //   return res.data;
  // },
  // retryCommand: async (commandId) => {
  //   const res = await API.post(`/iot/command/${commandId}/retry`);
  //   return res.data;
  // },
  // cancelCommand: async (commandId) => {
  //   const res = await API.post(`/iot/command/${commandId}/cancel`);
  //   return res.data;
  // },

  // ===========================================================================
  // NOTIFICATIONS  (NOT farm-scoped — same for the whole account)
  // ===========================================================================

  getNotifications: async () => {
    const res = await API.get("/iot/notifications");
    return res.data;
  },

  markNotificationRead: async (notificationId) => {
    const res = await API.patch(`/iot/notifications/${notificationId}/read`);
    return res.data;
  },

  markAllNotificationsRead: async () => {
    const res = await API.patch("/iot/notifications/read-all");
    return res.data;
  },

  // ===========================================================================
  // ANALYTICS
  // ===========================================================================

  getMoistureAnalytics: async (farmId, days = 30) => {
    const res = await API.get(`/iot/${farmId}/analytics/moisture`, { params: { days } });
    return res.data;
  },

  getTemperatureAnalytics: async (farmId, days = 30) => {
    const res = await API.get(`/iot/${farmId}/analytics/temperature`, {
      params: { days },
    });
    return res.data;
  },

  getPumpUsageAnalytics: async (farmId, days = 30) => {
    const res = await API.get(`/iot/${farmId}/analytics/pump-usage`, {
      params: { days },
    });
    return res.data;
  },

  // ===========================================================================
  // BROKER STATUS  (global — not farm-scoped)
  // ===========================================================================

  getBrokerStatus: async () => {
    const res = await API.get("/iot/broker/status");
    return res.data;
  },
};

export default iotApi;