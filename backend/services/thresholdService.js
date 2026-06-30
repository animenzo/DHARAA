// backend/services/thresholdService.js
// =============================================================================
// Threshold Alert Service
// =============================================================================
// After every sensor reading is saved, this service inspects the values and
// creates Notification documents when thresholds are breached.
//
// Thresholds are currently hardcoded constants.
// Future: move them to a per-user / per-device settings collection.
//
// Called by:  mqttService.js → handleDataMessage()
// =============================================================================

const Notification = require("../models/Notification");
const { emitToUser } = require("./socketService");

// ─── Default alert thresholds ─────────────────────────────────────────────────
const THRESHOLDS = {
  moisture: {
    low:      { value: 20,  severity: "warning",  type: "low_moisture" },
    critical: { value: 10,  severity: "critical", type: "low_moisture" },
  },
  temperature: {
    high:     { value: 42,  severity: "warning",  type: "high_temperature" },
    critical: { value: 50,  severity: "critical", type: "high_temperature" },
  },
  waterLevel: {
    low:      { value: 20,  severity: "warning",  type: "low_water_level" },
    critical: { value: 10,  severity: "critical", type: "low_water_level" },
  },
  rain: {
    detected: { value: 1,   severity: "info",     type: "rain_detected" },
  },
};

// De-bounce window: don't fire the same alert twice within this many minutes
const DEBOUNCE_MINUTES = 30;

// =============================================================================
// checkThresholds
// Evaluates a clean sensor reading object and creates notifications as needed.
//
// @param {Object} params
//   userId    - MongoDB ObjectId (string)
//   deviceId  - MongoDB ObjectId (string)  ← the _id, not the hardware ID
//   farmId    - MongoDB ObjectId | null
//   reading   - clean sensor object { moisture, temperature, ... }
// =============================================================================
async function checkThresholds({ userId, deviceId, farmId, reading }) {
  const alerts = [];
const moisture = reading.avgMoisture;

  // ── Soil moisture ──────────────────────────────────────────────────────────
  if (moisture != null) {
    if (moisture <= THRESHOLDS.moisture.critical.value) {
      alerts.push({
        type:     THRESHOLDS.moisture.critical.type,
        severity: THRESHOLDS.moisture.critical.severity,
        title:    "🚨 Critical: Soil moisture extremely low",
        message:  `Avg Soil moisture is at ${moisture}% — immediate irrigation required.`,
        context:  { sensor: "avgMoisture", value: moisture, threshold: THRESHOLDS.moisture.critical.value },
      });
    } else if (moisture <= THRESHOLDS.moisture.low.value) {
      alerts.push({
        type:     THRESHOLDS.moisture.low.type,
        severity: THRESHOLDS.moisture.low.severity,
        title:    "⚠️  Soil moisture is low",
        message:  `Soil moisture dropped to ${moisture}% — consider irrigating soon.`,
        context:  { sensor: "avgMoisture", value: moisture, threshold: THRESHOLDS.moisture.low.value },
      });
    }
  }

  // ── Temperature ────────────────────────────────────────────────────────────
  if (reading.temperature != null) {
    if (reading.temperature >= THRESHOLDS.temperature.critical.value) {
      alerts.push({
        type:     THRESHOLDS.temperature.critical.type,
        severity: THRESHOLDS.temperature.critical.severity,
        title:    "🚨 Critical: Extreme temperature",
        message:  `Temperature reached ${reading.temperature}°C — plants may be at risk.`,
        context:  { sensor: "temperature", value: reading.temperature, threshold: THRESHOLDS.temperature.critical.value },
      });
    } else if (reading.temperature >= THRESHOLDS.temperature.high.value) {
      alerts.push({
        type:     THRESHOLDS.temperature.high.type,
        severity: THRESHOLDS.temperature.high.severity,
        title:    "⚠️  High temperature detected",
        message:  `Temperature is ${reading.temperature}°C — monitor crop stress.`,
        context:  { sensor: "temperature", value: reading.temperature, threshold: THRESHOLDS.temperature.high.value },
      });
    }
  }

  // ── Water level ────────────────────────────────────────────────────────────
  if (reading.waterLevel != null) {
    if (reading.waterLevel <= THRESHOLDS.waterLevel.critical.value) {
      alerts.push({
        type:     THRESHOLDS.waterLevel.critical.type,
        severity: THRESHOLDS.waterLevel.critical.severity,
        title:    "🚨 Critical: Water tank nearly empty",
        message:  `Water tank level is at ${reading.waterLevel}% — refill immediately.`,
        context:  { sensor: "waterLevel", value: reading.waterLevel, threshold: THRESHOLDS.waterLevel.critical.value },
      });
    } else if (reading.waterLevel <= THRESHOLDS.waterLevel.low.value) {
      alerts.push({
        type:     THRESHOLDS.waterLevel.low.type,
        severity: THRESHOLDS.waterLevel.low.severity,
        title:    "⚠️  Water tank level is low",
        message:  `Water tank is at ${reading.waterLevel}% — plan a refill soon.`,
        context:  { sensor: "waterLevel", value: reading.waterLevel, threshold: THRESHOLDS.waterLevel.low.value },
      });
    }
  }

  // ── Rain detected ──────────────────────────────────────────────────────────
  if (reading.rain != null && reading.rain >= THRESHOLDS.rain.detected.value) {
    alerts.push({
      type:     THRESHOLDS.rain.detected.type,
      severity: THRESHOLDS.rain.detected.severity,
      title:    "🌧  Rain detected",
      message:  "Rain sensor triggered — consider pausing scheduled irrigation.",
      context:  { sensor: "rain", value: reading.rain },
    });
  }

  if (alerts.length === 0) return;

  // ── De-bounce: skip alerts that were sent recently ─────────────────────────
  const debounceFrom = new Date(Date.now() - DEBOUNCE_MINUTES * 60 * 1000);

  for (const alert of alerts) {
    try {
      const recent = await Notification.findOne({
        user:      userId,
        device:    deviceId,
        type:      alert.type,
        createdAt: { $gte: debounceFrom },
      }).lean();

      if (recent) {
        // Already sent this alert recently — skip
        continue;
      }

      // Create notification document
      const notification = await Notification.create({
        user:     userId,
        device:   deviceId,
        farm:     farmId || null,
        title:    alert.title,
        message:  alert.message,
        type:     alert.type,
        severity: alert.severity,
        context:  alert.context,
      });

      // Push to React dashboard in real-time
      emitToUser(userId.toString(), "notification", {
        _id:      notification._id,
        title:    notification.title,
        message:  notification.message,
        type:     notification.type,
        severity: notification.severity,
        context:  notification.context,
        createdAt: notification.createdAt,
      });

    } catch (err) {
      console.error("❌ ThresholdService: failed to create notification:", err.message);
    }
  }
}

// =============================================================================
// createSystemNotification
// Creates a generic notification that does not come from a sensor threshold.
// E.g. device offline, command failed.
// =============================================================================
async function createSystemNotification({ userId, deviceId, farmId, title, message, type, severity, context }) {
  try {
    const notification = await Notification.create({
      user:     userId,
      device:   deviceId || null,
      farm:     farmId   || null,
      title,
      message,
      type:     type     || "system",
      severity: severity || "info",
      context:  context  || null,
    });

    emitToUser(userId.toString(), "notification", {
      _id:       notification._id,
      title:     notification.title,
      message:   notification.message,
      type:      notification.type,
      severity:  notification.severity,
      context:   notification.context,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (err) {
    console.error("❌ ThresholdService: failed to create system notification:", err.message);
    return null;
  }
}

module.exports = {
  checkThresholds,
  createSystemNotification,
  THRESHOLDS,
};