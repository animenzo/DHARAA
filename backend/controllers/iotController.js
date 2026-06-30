const Device           = require("../models/Device");
const Template         = require("../models/Template");
const SensorData       = require("../models/SensorData");
const CommandLog       = require("../models/CommandLog");
const Notification     = require("../models/Notification");
const {  buildConnectionGuide } = require("../services/provisioningService");
// publishCommand removed — Phase 7 moved all MQTT publishing into commandService.issueCommand()
const { invalidate }        = require("../services/deviceCacheService");
const { emitToUser }        = require("../services/socketService");
const { generateLwtConfig, isStale, OFFLINE_THRESHOLD_MINUTES } = require("../services/deviceStatusService");
 const Farm              = require("../models/Farm");
// =============================================================================
// HELPERS
// =============================================================================

// Get the authenticated user's primary device (throws if not found)
// Resolve :farmId → its Device, verifying the farm belongs to this user.
// Returns { device, farm } or null if not found / not owned by this user.
// Throws a tagged error if the farm exists but isn't this user's (so
// callers can return 403 instead of a generic 404).
async function _getFarmDevice(userId, farmId) {
  const farm = await Farm.findById(farmId).lean();
  if (!farm) return null;

  if (farm.user.toString() !== userId.toString()) {
    const err = new Error("Not authorized for this farm");
    err.statusCode = 403;
    throw err;
  }

  if (!farm.device) return { farm, device: null };

  const device = await Device.findById(farm.device)
    .populate("template")
    .lean();

  return { farm, device: device || null };
}

// =============================================================================
// DEVICE ENDPOINTS
// =============================================================================

// GET /iot/device
// GET /iot/:farmId/device
exports.getFarmDevice = async (req, res) => {
  try {
    const result = await _getFarmDevice(req.user._id, req.params.farmId);

    if (!result) return res.status(404).json({ message: "Farm not found" });
    if (!result.device) {
      return res.status(404).json({ message: "This farm has no device linked." });
    }

    // Never send the live authToken back on routine fetches — it's the active
    // MQTT credential for this hardware. Strip the hash (defensive, select:
    // false already hides it) and replace the plaintext token with a masked
    // form so the profile UI can confirm what's configured (deviceId, broker
    // info, topics, etc. are not secrets and are returned in full) without
    // re-exposing the secret itself outside its one-time reveal.
    const { authTokenHash, authToken, ...safeDevice } = result.device;


    res.json({ device: safeDevice });

  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 403) console.error("getFarmDevice error:", err.message);
    res.status(status).json({ message: err.message || "Failed to fetch device" });
  }
};

// PATCH /iot/device
// PATCH /iot/:farmId/device
exports.updateDevice = async (req, res) => {
  try {
    const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) {
      return res.status(404).json({ message: "Device not found for this farm" });
    }

    const { name, notes } = req.body;

    const device = await Device.findByIdAndUpdate(
      result.device._id,
      { $set: { ...(name ? { name } : {}), ...(notes ? { notes } : {}) } },
      { new: true, runValidators: true }
    ).select("-authTokenHash").lean();

    invalidate(device.deviceId);

    res.json({ device: { ...device} });

  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 403) console.error("updateDevice error:", err.message);
    res.status(status).json({ message: err.message || "Failed to update device" });
  }
};
// PATCH /iot/:farmId/ai-mode
// Body: { enabled: true|false }
exports.setAiMode = async (req, res) => {
  try {
    const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result) return res.status(404).json({ message: "Farm not found" });

    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "`enabled` must be a boolean" });
    }

    const farm = await Farm.findByIdAndUpdate(
      req.params.farmId,
      { $set: { aiAutoEnabled: enabled } },
      { new: true }
    ).lean();

    // Emit to frontend so other tabs refresh instantly
    const { emitToUser } = require("../services/socketService");
    emitToUser(req.user._id.toString(), "aiModeChanged", {
      farmId: farm._id,
      aiAutoEnabled: farm.aiAutoEnabled,
    });

    // ── Immediate emergency check when AI Auto is switched ON ──────────────
    // Don't wait for the next 60-second polling tick: check moisture right now
    // and start the pump immediately if the soil is dry enough.
    if (enabled) {
      const { triggerEmergencyCheckForFarm } = require("../services/irrigationExecutionManager");
      // Fire-and-forget — the response has already been sent; errors are
      // logged inside triggerEmergencyCheckForFarm.
      triggerEmergencyCheckForFarm(req.params.farmId).catch((err) =>
        console.error("[setAiMode] triggerEmergencyCheckForFarm error:", err.message)
      );
    }

    res.json({ aiAutoEnabled: farm.aiAutoEnabled });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ message: err.message || "Failed to update AI mode" });
  }
};

// Generates a new authToken.  The OLD token is immediately invalid.
// The plain token is returned once in this response.
// 
// Generates a new authToken.  The OLD token is immediately invalid.


// POST /iot/device/provision
// For users who signed up before Phase 5 and have no device yet
// exports.manualProvision = async (req, res) => {
//   try {
//     const existingDevice = await Device.findOne({ user: req.user._id }).lean();
//     if (existingDevice) {
//       return res.status(409).json({ message: "Device already provisioned for this account." });
//     }

//     const user = req.user; // set by auth middleware as { id, _id }
//     const result = await provisionDevice({ _id: user._id, ...user });

//     res.status(201).json({
//       message:   "Device provisioned successfully.",
//       deviceId:  result.device.deviceId,
//       authToken: result.plainToken,
//       topics:    result.device.topics,
//       warning:   "Copy the authToken now — it will not be shown again.",
//     });

//   } catch (err) {
//     console.error("manualProvision error:", err.message);
//     res.status(500).json({ message: "Provisioning failed" });
//   }
// };


// =============================================================================
// DEVICE STATUS ENDPOINTS  (Phase 6 — NEW)
// =============================================================================
 
// GET /iot/device/status
// Returns live status, lastSeen, stale flag, and offline threshold for the
// authenticated user's device.  Used by DeviceStatusCard on the frontend.
// GET /iot/:farmId/device/status
// Returns live status, lastSeen, stale flag, and offline threshold for the
// device linked to this farm.  Used by DeviceStatusCard on the frontend.
exports.getDeviceStatus = async (req, res) => {
  try {
    const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) {
      return res.status(404).json({ message: "Device not found for this farm" });
    }
    const device = result.device;

    const stale = device.status === "online" && isStale(device);

    res.json({
      deviceId:               device._id,
      hardwareId:             device.deviceId,
      name:                   device.name,
      status:                 stale ? "stale" : device.status,
      rawStatus:              device.status,
      lastSeen:               device.lastSeen,
      isActive:               device.isActive,
      isStale:                stale,
      offlineThresholdMinutes: OFFLINE_THRESHOLD_MINUTES,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 403) console.error("getDeviceStatus error:", err.message);
    res.status(status).json({ message: err.message || "Failed to fetch device status" });
  }
};
 
// GET /iot/device/lwt-config
// Returns the LWT configuration the user's ESP32 must pre-register with
// Mosquitto.  Shown in the setup wizard "Connection Guide" step.
// GET /iot/:farmId/device/lwt-config
// Returns the LWT configuration the ESP32 must pre-register with the
// broker.  Shown in the setup wizard "Connection Guide" step.
exports.getLwtConfig = async (req, res) => {
  try {
    const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) {
      return res.status(404).json({ message: "Device not found for this farm" });
    }

    // generateLwtConfig previously took (userId, deviceId) to build the
    // 3-segment topic. With the 2-segment "farm/{deviceId}/status" format,
    // it only needs deviceId now — check deviceStatusService.js next.
    const lwtConfig = generateLwtConfig(result.device.deviceId);

    res.json(lwtConfig);
  } catch (err) {
    const status = err.statusCode || 500;
    if (status !== 403) console.error("getLwtConfig error:", err.message);
    res.status(status).json({ message: err.message || "Failed to generate LWT config" });
  }
};
// =============================================================================
// SENSOR DATA ENDPOINTS
// =============================================================================

// GET /iot/sensor/latest
exports.getLatestReading = async (req, res) => {
  try {
      const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) return res.status(404).json({ message: "Device not found for this farm" });
    const device = result.device;
    const reading = await SensorData.findOne({ device: device._id })
      .sort({ recordedAt: -1 })
      .lean();

    res.json({ reading: reading || null });

  } catch (err) {
    console.error("getLatestReading error:", err.message);
    res.status(500).json({ message: "Failed to fetch latest reading" });
  }
};

// GET /iot/sensor/history?from=ISO&to=ISO&limit=500
exports.getSensorHistory = async (req, res) => {
  try {
       const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) return res.status(404).json({ message: "Device not found for this farm" });
    const device = result.device;
    const limit = Math.min(parseInt(req.query.limit, 10) || 500, 2000);
    const query = { device: device._id };

    if (req.query.from || req.query.to) {
      query.recordedAt = {};
      if (req.query.from) query.recordedAt.$gte = new Date(req.query.from);
      if (req.query.to)   query.recordedAt.$lte = new Date(req.query.to);
    }

    const readings = await SensorData.find(query)
      .sort({ recordedAt: 1 })
      .limit(limit)
      .lean();

    res.json({ readings, count: readings.length });

  } catch (err) {
    console.error("getSensorHistory error:", err.message);
    res.status(500).json({ message: "Failed to fetch sensor history" });
  }
};

// GET /iot/sensor/last24h
// Returns one data point per hour (latest reading per hour bucket)
exports.getLast24Hours = async (req, res) => {
  try {
       const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) return res.status(404).json({ message: "Device not found for this farm" });
    const device = result.device;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const readings = await SensorData.aggregate([
      {
        $match: {
          device:     device._id,
          recordedAt: { $gte: since },
        },
      },
      {
        // Group by hour bucket
        $group: {
          _id: {
            year:  { $year:  "$recordedAt" },
            month: { $month: "$recordedAt" },
            day:   { $dayOfMonth: "$recordedAt" },
            hour:  { $hour: "$recordedAt" },
          },
          avgMoisture: { $avg: "$avgMoisture" },
          temperature: { $avg: "$temperature" },
          humidity:    { $avg: "$humidity" },
          waterLevel:  { $avg: "$waterLevel" },
          currentWaterLiters: { $avg: "$currentWaterLiters" },
          waterLevelPercent:  { $avg: "$waterLevelPercent" },
          rain:        { $max: "$rain" },
          pump:        { $max: "$pump" },
          valve:       { $max: "$valve" },
          recordedAt:  { $last: "$recordedAt" },
          count:       { $sum: 1 },
        },
      },
      { $sort: { recordedAt: 1 } },
    ]);

    // Round averages to 1 decimal place
    const formatted = readings.map((r) => ({
      recordedAt:  r.recordedAt,
      avgMoisture:
      r.avgMoisture != null ? +r.avgMoisture.toFixed(1) : null,
      temperature: r.temperature != null ? +r.temperature.toFixed(1) : null,
      humidity:    r.humidity    != null ? +r.humidity.toFixed(1)    : null,
      waterLevel:  r.waterLevel  != null ? +r.waterLevel.toFixed(1)  : null,
      currentWaterLiters: r.currentWaterLiters != null ? +r.currentWaterLiters.toFixed(1) : null,
      waterLevelPercent:  r.waterLevelPercent  != null ? +r.waterLevelPercent.toFixed(1)  : null,
      rain:        r.rain,
      pump:        r.pump,
      valve:       r.valve,
      count:       r.count,
    }));

    res.json({ readings: formatted });

  } catch (err) {
    console.error("getLast24Hours error:", err.message);
    res.status(500).json({ message: "Failed to fetch last 24h data" });
  }
};

// GET /iot/sensor/daily-averages?days=7
exports.getDailyAverages = async (req, res) => {
  try {
       const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) return res.status(404).json({ message: "Device not found for this farm" });
    const device = result.device;
    const days  = Math.min(parseInt(req.query.days, 10) || 7, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const readings = await SensorData.aggregate([
      { $match: { device: device._id, recordedAt: { $gte: since } } },
      {
        $group: {
          _id: {
            year:  { $year:  "$recordedAt" },
            month: { $month: "$recordedAt" },
            day:   { $dayOfMonth: "$recordedAt" },
          },
          avgMoisture: { $avg: "$avgMoisture" },
          temperature: { $avg: "$temperature" },
          humidity:    { $avg: "$humidity" },
          waterLevel:  { $avg: "$waterLevel" },
          currentWaterLiters: { $avg: "$currentWaterLiters" },
          waterLevelPercent:  { $avg: "$waterLevelPercent" },
          pumpOnCount: { $sum: "$pump" },
          date:        { $first: "$recordedAt" },
        },
      },
      { $sort: { date: 1 } },
    ]);

    const formatted = readings.map((r) => ({
      date:        r.date,
      avgMoisture:    r.avgMoisture    != null ? +r.avgMoisture.toFixed(1)    : null,
      temperature: r.temperature != null ? +r.temperature.toFixed(1) : null,
      humidity:    r.humidity    != null ? +r.humidity.toFixed(1)    : null,
      waterLevel:  r.waterLevel  != null ? +r.waterLevel.toFixed(1)  : null,
      currentWaterLiters: r.currentWaterLiters != null ? +r.currentWaterLiters.toFixed(1) : null,
      waterLevelPercent:  r.waterLevelPercent  != null ? +r.waterLevelPercent.toFixed(1)  : null,
      pumpOnCount: r.pumpOnCount || 0,
    }));

    res.json({ readings: formatted, days });

  } catch (err) {
    console.error("getDailyAverages error:", err.message);
    res.status(500).json({ message: "Failed to fetch daily averages" });
  }
};

// =============================================================================
// COMMAND ENDPOINTS
// =============================================================================

// POST /iot/command
// Body: { actuator: "pump"|"valve", value: 0|1, source?: "manual" }
// GET /iot/:farmId/device/connection-info
// Returns the ESP32 Arduino config snippet + MQTT topic map.
// NOTE: this is fetched routinely (e.g. every UserProfile page load), so the
// authToken/arduinoSnippet here use the masked token, not the live secret —
// the plaintext is only ever shown once, right after provisioning or
// regeneration (see regenerateToken below).
exports.getConnectionInfo = async (req, res) => {
  try {
    const result = await _getFarmDevice(
      req.user._id,
      req.params.farmId
    );

    if (!result || !result.device) {
      return res.status(404).json({
        message: "Device not found for this farm",
      });
    }

    const guide = buildConnectionGuide(
      result.device,
      process.env.MQTT_BROKER_URL
    );

    res.json({
      ...guide,
    });

  } catch (err) {
    const status = err.statusCode || 500;

    if (status !== 403) {
      console.error(
        "getConnectionInfo error:",
        err.message
      );
    }

    res.status(status).json({
      message:
        err.message ||
        "Failed to build connection info",
    });
  }
};
exports.sendCommand = async (req, res) => {
  try {
    const { actuator, value, source = "manual", targetMoisture } = req.body;

    // ── Input validation ────────────────────────────────────────────────────
    if (actuator !== "pump") {
      return res.status(400).json({ message: "actuator must be 'pump' " });
    }
    // Coerce value to integer in case frontend sends "1" as a string
    const numValue = Number(value);
    if (numValue !== 0 && numValue !== 1) {
      return res.status(400).json({ message: "value must be 0 (OFF) or 1 (ON)" });
    }

    // ── Optional targetMoisture (sent when pump is turned ON) ───────────────
    let targetMoistureValue = null;
    if (targetMoisture !== undefined && targetMoisture !== null && targetMoisture !== "") {
      const numTarget = Number(targetMoisture);
      if (Number.isNaN(numTarget) || numTarget < 0 || numTarget > 100) {
        return res.status(400).json({ message: "targetMoisture must be a number between 0 and 100" });
      }
      targetMoistureValue = numTarget;
    }

const result = await _getFarmDevice(req.user._id, req.params.farmId);
    const device = result?.device;

    console.log(`\n🎛️  [sendCommand] user=${req.user._id} farm=${req.params.farmId} actuator=${actuator} value=${numValue}`);
    console.log(`   Device: id=${device?._id} hardwareId=${device?.deviceId} status=${device?.status} isActive=${device?.isActive}`);

    if (!device) {
      console.error("   ❌ No device found for this farm");
      return res.status(404).json({ message: "Device not found for this farm" });
    }

    // ── Status guard: only block if EXPLICITLY offline ──────────────────────
    // "unknown" = never connected, still allow command (broker decides)
    // "stale"   = may still be reachable, allow command
    if (device.status === "offline") {
      console.warn(`   ⚠️  Blocked: device is offline`);
      return res.status(503).json({
        message: "Device is offline. Connect your ESP32 before sending commands.",
        deviceStatus: "offline",
      });
    }

    const { issueCommand } = require("../services/commandService");

    try {
      console.log(`   📤 Calling issueCommand...`);

const { commandLog, mqttTopic, cmdId } = await issueCommand({
        userId:   req.user._id.toString(),
        device,
        actuator,
        value:    numValue,   // use coerced integer
        source,
        targetMoisture: targetMoistureValue,
      });

      console.log(`   ✅ Command issued: cmdId=${cmdId} topic=${mqttTopic} logId=${commandLog._id}`);

      emitToUser(req.user._id.toString(), "commandSent", {
        commandId:  commandLog._id,
        cmdId,
        actuator,
        value:      numValue,
        source,
        issuedAt:   commandLog.issuedAt,
        mqttStatus: "delivered",
      });

      res.status(201).json({
        message:      `${actuator} command sent. Waiting for ESP32 acknowledgement.`,
        commandId:    commandLog._id,
        cmdId,
        actuator,
        value:        numValue,
        targetMoisture: targetMoistureValue,
        mqttTopic,
        mqttStatus:   "delivered",
        ackTimeoutMs: parseInt(process.env.CMD_ACK_TIMEOUT_MS, 10) || 10000,
      });

    } catch (mqttErr) {
      console.error(`   ❌ MQTT publish failed: ${mqttErr.message}`);
      res.status(503).json({
        message: "Command logged but MQTT delivery failed. Is the broker running?",
        error:   mqttErr.message,
      });
    }

  } catch (err) {
    console.error("sendCommand error:", err.message, err.stack);
    res.status(500).json({ message: "Failed to send command" });
  }
};

// GET /iot/command/history?limit=50&actuator=pump&status=acked
exports.getCommandHistory = async (req, res) => {
  try {
   const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) return res.status(404).json({ message: "Device not found for this farm" });
    const device = result.device;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const query = { device: device._id };

    // Optional filters
    if (req.query.actuator) query.actuator  = req.query.actuator;
    if (req.query.status)   query.mqttStatus = req.query.status;

    const commands = await CommandLog.find(query)
      .sort({ issuedAt: -1 })
      .limit(limit)
      .lean();

    res.json({ commands, count: commands.length });

  } catch (err) {
    console.error("getCommandHistory error:", err.message);
    res.status(500).json({ message: "Failed to fetch command history" });
  }
};

// GET /iot/command/:id/status
// Polls the live status of a single command.
// Used as a fallback when Socket.IO ACK events are missed.
exports.getCommandStatus = async (req, res) => {
  try {
    const cmd = await CommandLog.findOne({
      _id:  req.params.id,
      user: req.user._id,
    }).lean();

    if (!cmd) return res.status(404).json({ message: "Command not found" });

    res.json({
      commandId:  cmd._id,
      cmdId:      cmd.cmdId,
      actuator:   cmd.actuator,
      value:      cmd.value,
      mqttStatus: cmd.mqttStatus,
      issuedAt:   cmd.issuedAt,
      ackedAt:    cmd.ackedAt   || null,
      attempts:   cmd.attempts  || [],
    });

  } catch (err) {
    console.error("getCommandStatus error:", err.message);
    res.status(500).json({ message: "Failed to fetch command status" });
  }
};

// POST /iot/command/:id/retry
exports.retryCommand = async (req, res) => {
  try {
    const { retryCommand } = require("../services/commandService");

    const updated = await retryCommand(req.params.id, req.user._id.toString());

    emitToUser(req.user._id.toString(), "commandSent", {
      commandId:  updated._id,
      cmdId:      updated.cmdId,
      actuator:   updated.actuator,
      value:      updated.value,
      mqttStatus: "delivered",
      issuedAt:   updated.issuedAt,
      retry:      true,
    });

    res.json({
      message:    "Command retried successfully.",
      commandId:  updated._id,
      cmdId:      updated.cmdId,
      mqttStatus: updated.mqttStatus,
      attempts:   updated.attempts?.length || 0,
    });

  } catch (err) {
    // Distinguish client errors (max retries, already acked) from server errors
    const isClientError = [
      "Maximum retry attempts",
      "already acknowledged",
      "Cannot retry a cancelled",
      "Command not found",
    ].some((msg) => err.message.includes(msg));

    const status = isClientError ? 400 : 500;
    res.status(status).json({ message: err.message });
  }
};

// POST /iot/command/:id/cancel
exports.cancelCommand = async (req, res) => {
  try {
    const { cancelCommand } = require("../services/commandService");

    const cmd = await cancelCommand(req.params.id, req.user._id.toString());

    res.json({
      message:    "Command cancelled.",
      commandId:  cmd._id,
      mqttStatus: "cancelled",
    });

  } catch (err) {
    const isClientError = err.message.includes("not found") || err.message.includes("terminal state");
    res.status(isClientError ? 400 : 500).json({ message: err.message });
  }
};

// =============================================================================
// NOTIFICATION ENDPOINTS
// =============================================================================

// GET /iot/notifications?unreadOnly=true
exports.getNotifications = async (req, res) => {
  try {
    const query = { user: req.user._id };
    if (req.query.unreadOnly === "true") query.isRead = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      user:   req.user._id,
      isRead: false,
    });

    res.json({ notifications, unreadCount });

  } catch (err) {
    console.error("getNotifications error:", err.message);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

// PATCH /iot/notifications/:id/read
exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    ).lean();

    if (!notification) return res.status(404).json({ message: "Notification not found" });

    res.json({ notification });

  } catch (err) {
    console.error("markNotificationRead error:", err.message);
    res.status(500).json({ message: "Failed to update notification" });
  }
};

// PATCH /iot/notifications/read-all
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.json({ message: `Marked ${result.modifiedCount} notifications as read` });

  } catch (err) {
    console.error("markAllNotificationsRead error:", err.message);
    res.status(500).json({ message: "Failed to mark notifications as read" });
  }
};

// =============================================================================
// ANALYTICS ENDPOINTS  (Phase 11 — full aggregation logic ready now)
// =============================================================================

// GET /iot/analytics/moisture?days=30
exports.getMoistureAnalytics = async (req, res) => {
  try {
    const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) return res.status(404).json({ message: "Device not found for this farm" });
    const device = result.device;
    const days  = Math.min(parseInt(req.query.days, 10) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await SensorData.aggregate([
      { $match: { device: device._id, recordedAt: { $gte: since }, avgMoisture: { $ne: null } } },
      {
        $group: {
          _id:     { year: { $year: "$recordedAt" }, month: { $month: "$recordedAt" }, day: { $dayOfMonth: "$recordedAt" } },
          avg:     { $avg: "$avgMoisture" },
          min:     { $min: "$avgMoisture" },
          max:     { $max: "$avgMoisture" },
          date:    { $first: "$recordedAt" },
          samples: { $sum: 1 },
        },
      },
      { $sort: { date: 1 } },
    ]);

    res.json({
      sensor: "moisture",
      unit:   "%",
      days,
      data:   data.map((d) => ({
        date:    d.date,
        avg:     +d.avg.toFixed(1),
        min:     +d.min.toFixed(1),
        max:     +d.max.toFixed(1),
        samples: d.samples,
      })),
    });

  } catch (err) {
    console.error("getMoistureAnalytics error:", err.message);
    res.status(500).json({ message: "Failed to fetch moisture analytics" });
  }
};

// GET /iot/analytics/temperature?days=30
exports.getTemperatureAnalytics = async (req, res) => {
  try {
    const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) return res.status(404).json({ message: "Device not found for this farm" });
    const device = result.device;
    const days  = Math.min(parseInt(req.query.days, 10) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const data = await SensorData.aggregate([
      { $match: { device: device._id, recordedAt: { $gte: since }, temperature: { $ne: null } } },
      {
        $group: {
          _id:     { year: { $year: "$recordedAt" }, month: { $month: "$recordedAt" }, day: { $dayOfMonth: "$recordedAt" } },
          avg:     { $avg: "$temperature" },
          min:     { $min: "$temperature" },
          max:     { $max: "$temperature" },
          date:    { $first: "$recordedAt" },
          samples: { $sum: 1 },
        },
      },
      { $sort: { date: 1 } },
    ]);

    res.json({
      sensor: "temperature",
      unit:   "°C",
      days,
      data:   data.map((d) => ({
        date:    d.date,
        avg:     +d.avg.toFixed(1),
        min:     +d.min.toFixed(1),
        max:     +d.max.toFixed(1),
        samples: d.samples,
      })),
    });

  } catch (err) {
    console.error("getTemperatureAnalytics error:", err.message);
    res.status(500).json({ message: "Failed to fetch temperature analytics" });
  }
};

// GET /iot/analytics/pump-usage?days=30
exports.getPumpUsageAnalytics = async (req, res) => {
  try {
   const result = await _getFarmDevice(req.user._id, req.params.farmId);
    if (!result || !result.device) return res.status(404).json({ message: "Device not found for this farm" });
    const device = result.device;
    const days  = Math.min(parseInt(req.query.days, 10) || 30, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Count manual pump ON commands per day
    const data = await CommandLog.aggregate([
      {
        $match: {
          device:    device._id,
          actuator:  "pump",
          value:     1,
          issuedAt:  { $gte: since },
          mqttStatus: "delivered",
        },
      },
      {
        $group: {
          _id:   { year: { $year: "$issuedAt" }, month: { $month: "$issuedAt" }, day: { $dayOfMonth: "$issuedAt" } },
          count: { $sum: 1 },
          date:  { $first: "$issuedAt" },
          sources: { $addToSet: "$source" },
        },
      },
      { $sort: { date: 1 } },
    ]);

    res.json({
      metric: "pump_on_commands",
      days,
      data: data.map((d) => ({
        date:    d.date,
        count:   d.count,
        sources: d.sources,
      })),
    });

  } catch (err) {
    console.error("getPumpUsageAnalytics error:", err.message);
    res.status(500).json({ message: "Failed to fetch pump usage analytics" });
  }
};
