// backend/routes/iotRoutes.js
// =============================================================================
// IoT REST Routes
// Mounted in index.js as:  app.use("/iot", iotRoutes)
// All routes require JWT authentication via the auth middleware.
// =============================================================================

const router = require("express").Router();
const auth   = require("../middleware/auth");
const {
  // Device
  getFarmDevice,
  updateDevice,
  regenerateToken,
  getConnectionInfo,

   // Phase 6 — Status
  getDeviceStatus,
  getLwtConfig,

  // Sensor data
  getLatestReading,
  getSensorHistory,
  getLast24Hours,
  getDailyAverages,

  // Commands
  sendCommand,
  getCommandHistory,
 getCommandStatus,   // Phase 7
  retryCommand,       // Phase 7
  cancelCommand,  
  // Notifications
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,

  // Analytics
  getMoistureAnalytics,
  getTemperatureAnalytics,
  getPumpUsageAnalytics,
} = require("../controllers/iotController");
const { setAiMode } = require("../controllers/iotController");
// ─── All IoT routes require a valid JWT ──────────────────────────────────────
router.use(auth);

// =============================================================================
// DEVICE
// =============================================================================
router.get("/:farmId/device",                    getFarmDevice);
router.patch("/:farmId/device",                  updateDevice);

router.get("/:farmId/device/connection-info",    getConnectionInfo);

router.get("/:farmId/device/status",     getDeviceStatus);
router.get("/:farmId/device/lwt-config", getLwtConfig);
// =============================================================================
// SENSOR DATA
// =============================================================================
router.get("/:farmId/sensor/latest",         getLatestReading);
router.get("/:farmId/sensor/history",        getSensorHistory);
router.get("/:farmId/sensor/last24h",        getLast24Hours);
router.get("/:farmId/sensor/daily-averages", getDailyAverages);
// =============================================================================
// COMMANDS  (pump / valve control)
// =============================================================================
router.post("/:farmId/command",          sendCommand);
router.get("/:farmId/command/history",   getCommandHistory);

// These three are scoped by CommandLog ownership (user + cmdId), not by
// device, so they don't need :farmId — a command's identity is global to
// the user regardless of which farm issued it.
router.get("/command/:id/status",    getCommandStatus);   // Phase 7
router.post("/command/:id/retry",    retryCommand);        // Phase 7
router.post("/command/:id/cancel",   cancelCommand);
// =============================================================================
// NOTIFICATIONS
// IMPORTANT: /read-all must come BEFORE /:id/read
// otherwise Express matches "read-all" as an :id param
// =============================================================================
router.get("/notifications",              getNotifications);
router.patch("/notifications/read-all",   markAllNotificationsRead);
router.patch("/notifications/:id/read",   markNotificationRead);

// =============================================================================
// ANALYTICS
// =============================================================================
router.get("/:farmId/analytics/moisture",     getMoistureAnalytics);
router.get("/:farmId/analytics/temperature",  getTemperatureAnalytics);
router.get("/:farmId/analytics/pump-usage",   getPumpUsageAnalytics);

router.patch("/:farmId/ai-mode", setAiMode);
module.exports = router;