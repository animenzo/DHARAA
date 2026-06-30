// backend/services/provisioningService.js
// =============================================================================
// Device Provisioning Service
// =============================================================================
// Called once per new user signup.  Automatically creates:
//
//   1. Template   — widget definitions (soil moisture, temperature, pump …)
//   2. Device     — hardware identity (deviceId "esp001", authToken, topics)
//   3. User.iotDevice reference — links User → Device
//
// The plain authToken is returned ONCE and included in the signup API
// response.  It is never stored in plaintext — only its SHA-256 hash lives
// in the DB.  The user must copy it to their ESP32 firmware immediately.
//
// Device ID generation:
//   "esp" + first 3 chars of userId  e.g.  esp507  (guaranteed unique
//   because userId is unique).  If a collision somehow occurs (extremely
//   unlikely) the service appends a random suffix and retries once.
// =============================================================================

const crypto = require("crypto");
const User = require("../models/User");
const Device = require("../models/Device");
const Template = require("../models/Template");

// =============================================================================
// provisionDevice
// Main entry point.  Call this right after User.create() in authController.
//
// @param  {Object} user   — the newly created Mongoose User document
// @returns {Object}       — { device, template, plainToken }
//   plainToken  MUST be sent to the client in the signup response.
//   It is irretrievable after this function returns.
// =============================================================================
async function provisionDeviceForFarm(user, farm, requestedDeviceId) {
  if (!requestedDeviceId || typeof requestedDeviceId !== "string") {
    throw new Error("Device ID is required");
  }

  const deviceId = requestedDeviceId.trim();

  // ── 1. Reject if this deviceId is already taken by ANYONE ───────────────────
  // 1:1 relationship — a deviceId can only ever belong to one farm, ever.
  const existing = await Device.findOne({ deviceId }).lean();
  if (existing) {
    throw new Error(
      `Device ID "${deviceId}" is already in use. Please choose a different ID.`
    );
  }


  // ── 3. Build MQTT topic strings ──────────────────────────────────────────────
  const base   = `farm/${deviceId}`;
  const topics = {
    data:   `${base}/data`,
    status: `${base}/status`,
    cmd:    `${base}/cmd`,
    

  };

  // ── 4. Create Template ───────────────────────────────────────────────────────
  const template = await Template.create({
    user:        user._id,
    name:        "Smart Irrigation Template",
    description: "Auto-generated precision irrigation template",
  });

  // ── 5. Create Device, linked to this farm ────────────────────────────────────
  const device = await Device.create({
    user:          user._id,
    farm:          farm._id,
    template:      template._id,
    deviceId,
    name:          farm.name ? `${farm.name} ESP32` : "My ESP32",
    hardwareType:  "ESP32",
    status:        "unknown",
    isActive:      false,
    topics,
  });

  // ── 5b. Link the farm back to this device ────────────────────────────────────
  // Device → Farm was set above (device.farm), but Farm → Device must also be
  // saved, since _getFarmDevice() resolves a farm's device via farm.device.
  // Without this, the farm is created and the device exists, but every
  // getFarmDevice() lookup returns "no device linked" because farm.device is
  // still null.
  farm.device = device._id;
  await farm.save();

  console.log(
    `🔧 Provisioned device "${deviceId}" for farm "${farm._id}" (user ${user._id})`,
    `| template: ${template._id}`
  );

  return {
    device,
    template,

  };
}

// =============================================================================
// buildConnectionGuide
// Returns the ESP32 Arduino sketch configuration block for a device.
// Shown in the dashboard "Setup Guide" step.
// =============================================================================
function buildConnectionGuide(device, brokerUrl) {
  // Parse host and port from broker URL
  // e.g. "mqtt://192.168.1.10:1883" → host = "192.168.1.10", port = 1883
  let brokerHost = "YOUR_SERVER_IP";
  let brokerPort = 1883;

  try {
    const url = new URL(brokerUrl || process.env.MQTT_BROKER_URL || "mqtt://localhost:1883");
    brokerHost = url.hostname;
    brokerPort = parseInt(url.port, 10) || 1883;
  } catch {
    // keep defaults
  }

  return {
    deviceId: device.deviceId,
    // authToken: device.authToken, // plain token (shown in setup, then should be hidden)
    brokerHost,
    brokerPort,
    topics: {
      data: device.topics.data,
      status: device.topics.status,
      cmd: device.topics.cmd,
     
    },
    // Ready-to-paste Arduino define block
    arduinoSnippet: [
      `// ─── DHARAA IoT Config ─────────────────────────────`,
      `#define MQTT_BROKER    "${brokerHost}"`,
      `#define MQTT_PORT      ${brokerPort}`,
      `#define DEVICE_ID      "${device.deviceId}"`,
     
      `#define TOPIC_DATA     "${device.topics.data}"`,
      `#define TOPIC_STATUS   "${device.topics.status}"`,
      `#define TOPIC_CMD      "${device.topics.cmd}"`,
      `// ─────────────────────────────────────────────────────`,
    ].join("\n"),
  };
}

module.exports = {
  provisionDeviceForFarm,
 
  buildConnectionGuide,
};