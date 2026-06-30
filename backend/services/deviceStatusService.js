// backend/services/deviceStatusService.js
// =============================================================================
// Device Status Service  (Phase 6)
// =============================================================================
// Centralises ALL device online/offline transitions so that mqttService,
// heartbeat monitor, and REST endpoints all use one consistent code path.
//
// Responsibilities:
//   • markOnline(device)  — called when a valid /data or /status payload arrives
//   • markOffline(device) — called by LWT handler or heartbeat monitor
//   • getStatusSummary()  — used by brokerRoutes GET /iot/broker/status
//   • generateLwtConfig() — returns the exact LWT object an ESP32 must pre-register
//   • isStale(device)     — returns true if device hasn't reported within threshold
//
// All status transitions:
//   1. Update Device document in MongoDB
//   2. Invalidate device cache entry
//   3. Emit "deviceStatus" Socket.IO event to the user's room
//   4. Create a Notification document (debounced — only on real transitions)
// =============================================================================

const Device       = require("../models/Device");
const { invalidate }                  = require("./deviceCacheService");
const { emitToUser }                  = require("./socketService");
const { createSystemNotification }    = require("./thresholdService");

// ─── Offline threshold (minutes) ─────────────────────────────────────────────
// If a device hasn't published data within this window it is considered stale.
// Matches the value in config/mqtt.js — kept here as a named constant for clarity.
const OFFLINE_THRESHOLD_MINUTES = parseInt(process.env.MQTT_OFFLINE_THRESHOLD_MINUTES, 10) || 5;

// =============================================================================
// markOnline
// Transitions a device to "online" status.
// Safe to call on every incoming message — it no-ops if already online.
//
// @param {Object} device  — lean Device document (from deviceCacheService)
// @param {Object} [meta]  — optional { firmwareVersion }
// =============================================================================
// backend/services/deviceStatusService.js
// =============================================================================
// markOnline — Phase 10 fix: always log lastSeen update, never skip DB write
// REPLACE the existing markOnline function only.
// =============================================================================

async function markOnline(device, meta = {}) {
  const wasOffline = device.status !== "online";

  const updateFields = {
    status:   "online",
    lastSeen: new Date(),
    isActive: true,
  };
  if (meta.firmwareVersion) {
    updateFields.firmwareVersion = meta.firmwareVersion;
  }

  // Always write to DB — never skip this even if already online
  const result = await Device.updateOne({ _id: device._id }, { $set: updateFields });

  // Always invalidate cache so next DB read gets fresh status + lastSeen
  invalidate(device.deviceId);

  console.log(
    `📶 [DeviceStatus] "${device.deviceId}" lastSeen=${updateFields.lastSeen.toISOString()}`,
    `status=online isActive=true`,
    wasOffline ? `(transitioned from "${device.status}")` : "(heartbeat)"
  );

  if (!wasOffline) return; // No status transition — skip notification + Socket.IO

  // Emit real-time status event
  emitToUser(device.user.toString(), "deviceStatus", {
    deviceId:   device._id,
    hardwareId: device.deviceId,
    status:     "online",
    lastSeen:   updateFields.lastSeen,
  });

  // Notification only on offline → online transition
  if (device.status === "offline") {
    await createSystemNotification({
      userId:   device.user,
      deviceId: device._id,
      farmId:   device.farm || null,
      title:    "🟢 Device reconnected",
      message:  `"${device.name || device.deviceId}" is back online.`,
      type:     "device_online",
      severity: "info",
    });
  }
}

// =============================================================================
// markOffline
// Transitions a device to "offline" status.
// Source can be "lwt" (from Mosquitto) or "heartbeat" (from the monitor).
//
// @param {Object} device  — lean Device document
// @param {string} source  — "lwt" | "heartbeat"
// =============================================================================
async function markOffline(device, source = "lwt") {
  if (device.status === "offline") return; // Already offline — no-op

  await Device.updateOne(
    { _id: device._id },
    { $set: { status: "offline" } }
  );
  invalidate(device.deviceId);

  const label = source === "heartbeat" ? "timed out" : "disconnected";
  console.warn(`🔴 [DeviceStatus] "${device.deviceId}" → offline (${source})`);

  // Emit real-time event
  emitToUser(device.user.toString(), "deviceStatus", {
    deviceId:   device._id,
    hardwareId: device.deviceId,
    status:     "offline",
    lastSeen:   device.lastSeen,
    source,
  });

  // Create notification
  const title   = source === "heartbeat"
    ? "🔴 Device timed out"
    : "🔴 Device went offline";
  const message = source === "heartbeat"
    ? `"${device.name || device.deviceId}" stopped sending data and was marked offline.`
    : `"${device.name || device.deviceId}" disconnected from the broker.`;

  await createSystemNotification({
    userId:   device.user,
    deviceId: device._id,
    farmId:   device.farm || null,
    title,
    message,
    type:     "device_offline",
    severity: "warning",
    context:  { source, lastSeen: device.lastSeen },
  });
}

// =============================================================================
// isStale
// Returns true if the device's lastSeen timestamp is older than the threshold.
// Used by the heartbeat monitor to decide whether to mark a device offline.
//
// @param {Object} device  — lean Device document
// @returns {boolean}
// =============================================================================
function isStale(device) {
  if (!device.lastSeen) return true;
  const thresholdMs = OFFLINE_THRESHOLD_MINUTES * 60 * 1000;
  return Date.now() - new Date(device.lastSeen).getTime() > thresholdMs;
}

// =============================================================================
// generateLwtConfig
// Returns the LWT (Last Will & Testament) configuration object that Mosquitto
// needs to pre-configure for a device.
//
// The ESP32 must send this EXACTLY when it calls mqttClient.connect():
//   willTopic   = "farm/{userId}/{deviceId}/status"
//   willPayload = '{"status":"offline"}'
//   willQoS     = 1
//   willRetain  = false
//
// @param {string} userId          — MongoDB ObjectId string
// @param {string} hardwareDeviceId — e.g. "esp507f1f"
// @returns {Object}
// =============================================================================
function generateLwtConfig( hardwareDeviceId) {
  const topic = `farm/${hardwareDeviceId}/status`;
  return {
    willTopic:   topic,
    willPayload: JSON.stringify({ status: "offline" }),
    willQoS:     1,
    willRetain:  false,
    // ESP32 Arduino snippet comment block:
    arduinoLwtSnippet: [
      `// ─── MQTT LWT (Last Will & Testament) ────────────────────`,
      `// Add these to your mqttClient.connect() call:`,
      `//   Will Topic  : "${topic}"`,
      `//   Will Payload: {"status":"offline"}`,
      `//   Will QoS    : 1`,
      `//   Will Retain : false`,
      `// ─────────────────────────────────────────────────────────`,
    ].join("\n"),
  };
}

// =============================================================================
// getStatusSummary
// Returns a summary of all devices and their current statuses.
// Used by GET /iot/broker/status to enrich the health endpoint.
//
// @returns {Object} { total, online, offline, unknown, staleOnline }
// =============================================================================
async function getStatusSummary() {
  const devices = await Device.find({})
    .select("deviceId status lastSeen user name")
    .lean();

  const summary = {
    total:       devices.length,
    online:      0,
    offline:     0,
    unknown:     0,
    staleOnline: 0, // online but haven't reported within threshold
  };

  for (const d of devices) {
    if (d.status === "online") {
      summary.online++;
      if (isStale(d)) summary.staleOnline++;
    } else if (d.status === "offline") {
      summary.offline++;
    } else {
      summary.unknown++;
    }
  }

  return summary;
}

// =============================================================================
// runHeartbeatCheck
// Scans all "online" devices and marks stale ones as offline.
// Called every 60 seconds by mqttService._startHeartbeatMonitor().
// By delegating here we keep mqttService lean and all status logic in one file.
// =============================================================================
async function runHeartbeatCheck() {
  try {
    const staleDevices = await Device.find({
      status:   "online",
      lastSeen: { $lt: new Date(Date.now() - OFFLINE_THRESHOLD_MINUTES * 60 * 1000) },
    }).lean();

    if (staleDevices.length > 0) {
      console.warn(`💤 [Heartbeat] Found ${staleDevices.length} stale device(s)`);
    }

    for (const device of staleDevices) {
      await markOffline(device, "heartbeat");
    }

    return staleDevices.length;
  } catch (err) {
    console.error("❌ [Heartbeat] Check failed:", err.message);
    return 0;
  }
}

module.exports = {
  markOnline,
  markOffline,
  isStale,
  generateLwtConfig,
  getStatusSummary,
  runHeartbeatCheck,
  OFFLINE_THRESHOLD_MINUTES,
};