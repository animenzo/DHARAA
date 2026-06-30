
const mqtt = require("mqtt");

const mqttConfig = require("../config/mqtt");

const Device = require("../models/Device");
const SensorData = require("../models/SensorData");
const Farm = require("../models/Farm");

const { parseAndValidate, parseStatusPayload, parseTopic } = require("./payloadValidator");
const { calculateTankReading } = require("../utils/tankCalculations");
const { checkThresholds } = require("./thresholdService");
const { getDevice, invalidate } = require("./deviceCacheService");
const { emitToUser } = require("./socketService");
const {
  markOnline,
  markOffline,
  runHeartbeatCheck,
  getStatusSummary,
} = require("./deviceStatusService");
function _getCommandService() {
  return require("./commandService");
}
// ─── Module-level state ───────────────────────────────────────────────────────
let _client = null;
let _io = null;
let _heartbeatInterval = null;
let _connectedAt = null;
const RETAINED_IGNORE_WINDOW_MS = 3000;
// Live power status of each device
const devicePowerStatus = new Map();

function initMqttService(io) {
  _io = io;

  console.log(`🔄 MQTT connecting to: ${mqttConfig.brokerUrl}`);

  const connectOptions = {
    clientId: mqttConfig.clientId,
    reconnectPeriod: mqttConfig.options.reconnectPeriod,
    connectTimeout: mqttConfig.options.connectTimeout,
    clean: mqttConfig.options.clean,
    will: mqttConfig.options.will,
  };

  if (mqttConfig.username) {
    connectOptions.username = mqttConfig.username;
    connectOptions.password = mqttConfig.password;
  }

  _client = mqtt.connect(mqttConfig.brokerUrl, connectOptions);

  // ── CONNECT ─────────────────────────────────────────────────────────────────
  _client.on("connect", () => {
    console.log("✅ MQTT broker connected");
    _connectedAt = Date.now();
    _client.publish(
      "cropsense/backend/status",
      JSON.stringify({ status: "online", service: "cropsense_backend", ts: Date.now() }),
      { qos: 1, retain: true }
    );

    _client.subscribe(mqttConfig.topics.subscribeAll, { qos: 1 }, (err, granted) => {
      if (err) {
        console.error("❌ MQTT subscription failed:", err.message);
        return;
      }
      console.log("📡 MQTT subscribed to:", granted.map((g) => `${g.topic} (QoS ${g.qos})`).join(", "));
    });

    _startHeartbeatMonitor();
  });

  // ── MESSAGE ──────────────────────────────────────────────────────────────────
  _client.on("message", async (topic, payloadBuffer) => {
    try {
      await _routeMessage(topic, payloadBuffer);
    } catch (err) {
      console.error(`❌ MQTT message handler error [${topic}]:`, err.message);
    }
  });

  _client.on("reconnect", () => console.warn("🔄 MQTT reconnecting..."));
  _client.on("error", (err) => console.error("❌ MQTT error:", err.message));
  _client.on("close", () => { console.warn("🔌 MQTT connection closed"); _stopHeartbeatMonitor(); });
  _client.on("offline", () => console.warn("📴 MQTT broker offline — retrying..."));
}

// =============================================================================
// _routeMessage
// =============================================================================
async function _routeMessage(topic, payloadBuffer) {
  if (topic.startsWith("cropsense/")) return;

  const parsed = parseTopic(topic);
  if (!parsed) {
    console.warn(`⚠️  MQTT: unrecognised topic format: ${topic}`);
    return;
  }

  const { deviceId, subtopic } = parsed;

  switch (subtopic) {
    case "data":
      await handleDataMessage(deviceId, payloadBuffer);
      break;
    case "status":
      await handleStatusMessage(deviceId, payloadBuffer);
      break;
    case "cmd/ack":
      await handleAckMessage(deviceId, payloadBuffer);
      break;
    default:
      console.log(`📨 MQTT [${topic}] — subtopic "${subtopic}" not handled`);
  }
}

// =============================================================================
// handleDataMessage
// =============================================================================
async function handleDataMessage(hardwareDeviceId, payloadBuffer) {
  // Step 1: Parse
  const result = parseAndValidate(payloadBuffer);
  if (!result.valid) {
    console.warn(`⚠️  MQTT /data [${hardwareDeviceId}]: invalid payload — ${result.reason}`);
    return;
  }
  const { clean, extra, meta, warnings } = result;
  // Store latest power status (ESP32 sends 0 or 1 in bool)
  console.log("ESP32 Payload:", clean);
  const to01 = (value) => Number(Boolean(value));

  clean.pump = to01(clean.pump);
  clean.valve = to01(clean.valve);
  clean.physicalBtn = to01(clean.physicalBtn);
  clean.power_status = to01(clean.power_status);
  devicePowerStatus.set(
    hardwareDeviceId,
    clean.power_status === 1
  );

  if (warnings.length > 0) {
    console.warn(`⚠️  MQTT /data [${hardwareDeviceId}] warnings:`, warnings.join("; "));
  }

  // Step 2: Look up device
  const device = await getDevice(hardwareDeviceId);
  if (!device) {
    console.warn(`⚠️  MQTT /data: unknown deviceId "${hardwareDeviceId}" — rejected`);
    return;
  }




  const moistureSensors = [];

  if (clean.moisture1 !== undefined) {
    moistureSensors.push({
      sensorId: "sensor_1",
      label: "Sensor 1",
      value: clean.moisture1,
    });
  }

  if (clean.moisture2 !== undefined) {
    moistureSensors.push({
      sensorId: "sensor_2",
      label: "Sensor 2",
      value: clean.moisture2,
    });
  }

  // Average moisture
  const avgMoisture =
    moistureSensors.length > 0
      ? moistureSensors.reduce((sum, s) => sum + s.value, 0) /
      moistureSensors.length
      : null;

  const farm = device.farm
    ? await Farm.findById(device.farm)
      .select("aiAutoEnabled tankDetails totalCapacityLiters")
      .lean()
    : null;
console.log("Tank dimensions:", farm.tankDetails);
console.log("Total Capacity:", farm.totalCapacityLiters);
  const tankReading = calculateTankReading(farm, clean.waterLevel/100);
  // const directWaterLevel = Number(clean.waterLevel);
  // const waterLevelPercent = tankReading.waterLevelPercent;

  // const currentWaterLiters = tankReading.currentWaterLiters;

  // Physical button logic
  console.log("Raw distance:", clean.waterLevel);

console.log("Tank calculation:", tankReading);

console.log("Saved values:", {
  currentWaterLiters: tankReading.currentWaterLiters,
  waterLevelPercent: tankReading.waterLevelPercent,
});
  const physicalBtn = clean.physicalBtn || 0;

  // AFTER:
  let pumpSource = "OFF";
  if (clean.pump === 1) {
    if (physicalBtn === 1) {
      pumpSource = "MANUAL";
    } else {
      // Check if farm has AI Auto enabled
      pumpSource = farm?.aiAutoEnabled ? "REMOTE_AI" : "REMOTE";
    }
  }

  const sensorDoc = await SensorData.create({
    user: device.user,
    device: device._id,
    farm: device.farm || null,

    moistureSensors,
    avgMoisture,

    temperature: clean.temperature,
    humidity: clean.humidity,
    rain: clean.rain,
    waterLevel: clean.waterLevel,          // raw ultrasonic distance
    sensorDistance: clean.waterLevel/100,      // optional alias
    waterHeight: tankReading.waterHeight,
    currentWaterLiters: tankReading.currentWaterLiters,
    waterLevelPercent: tankReading.waterLevelPercent,

    pump: clean.pump,
    valve: clean.valve,

    physicalBtn,
    pumpSource,

    extra: Object.keys(extra).length > 0 ? extra : undefined,

    rssi: meta.rssi ?? clean.rssi ?? null,
    recordedAt: meta.recordedAt || new Date(),
  });
  // Step 5: Update device status via deviceStatusService
  await markOnline(device, meta);

  // Step 6: Threshold checks
  await checkThresholds({
    userId: device.user,
    deviceId: device._id,
    farmId: device.farm,
    reading: sensorDoc,
  });

  // Step 7: Emit real-time sensor data
  emitToUser(device.user.toString(), "sensorData", {
    deviceId: device._id,
    hardwareId: hardwareDeviceId,
    recordedAt: sensorDoc.recordedAt,
    moistureSensors: sensorDoc.moistureSensors,
    avgMoisture: sensorDoc.avgMoisture,
    physicalBtn: sensorDoc.physicalBtn,
    pumpSource: sensorDoc.pumpSource,
    temperature: sensorDoc.temperature,
    humidity: sensorDoc.humidity,
    rain: sensorDoc.rain,
    waterLevel: sensorDoc.waterLevel,
    sensorDistance: sensorDoc.sensorDistance,
    waterHeight: sensorDoc.waterHeight,
    currentWaterLiters: sensorDoc.currentWaterLiters,
    waterLevelPercent: sensorDoc.waterLevelPercent,
    pump: sensorDoc.pump,
    valve: sensorDoc.valve,
    rssi: sensorDoc.rssi,
    powerStatus: Number(clean.power_status) === 1 ? 1 : 0,
  });

  console.log(
    `📊 MQTT /data saved [${hardwareDeviceId}]`,
    `avgMoisture=${avgMoisture ?? "-"}%`,
    `temp=${clean.temperature ?? "-"}°C`,
    `pump=${clean.pump ?? "-"} `,
    `source=${pumpSource}`
  );
}

// =============================================================================
// handleStatusMessage
// =============================================================================
async function handleStatusMessage(hardwareDeviceId, payloadBuffer) {
  const result = parseStatusPayload(payloadBuffer);

  if (!result.valid) {
    console.warn(`⚠️  MQTT /status [${hardwareDeviceId}]: ${result.reason}`);
    return;
  }

  const { status } = result;
  const ageMs = _connectedAt ? Date.now() - _connectedAt : Infinity;
  if (ageMs < RETAINED_IGNORE_WINDOW_MS) {
    console.log(`[MQTT] Ignoring likely retained /status message for "${hardwareDeviceId}" (arrived ${ageMs}ms after connect)`);
    return;
  }

  const device = await getDevice(hardwareDeviceId);
  if (!device) {
    console.warn(`⚠️  MQTT /status: unknown deviceId "${hardwareDeviceId}"`);
    return;
  }

  // Delegate to deviceStatusService
  if (status === "online") {
    await markOnline(device);
  } else {
    await markOffline(device, "lwt");
  }
}

async function handleAckMessage(hardwareDeviceId, payloadBuffer) {
  let raw;

  try {
    raw = JSON.parse(payloadBuffer.toString());
  } catch {
    console.warn(`⚠️ MQTT cmd/ack [${hardwareDeviceId}]: invalid JSON`);
    return;
  }

  const { cmdId, ok = true } = raw;

  if (!cmdId || typeof cmdId !== "string") {
    console.warn(`⚠️ MQTT cmd/ack [${hardwareDeviceId}]: missing cmdId`);
    return;
  }

  console.log(`📬 MQTT cmd/ack received [${hardwareDeviceId}] cmdId=${cmdId} ok=${ok}`);

  try {
    await _getCommandService().acknowledgeCommand(
      cmdId,
      hardwareDeviceId,
      ok
    );
  } catch (err) {
    console.error(`❌ MQTT cmd/ack handler error:`, err.message);
  }
}
// =============================================================================
// Heartbeat — delegates to deviceStatusService.runHeartbeatCheck()
// =============================================================================
function _startHeartbeatMonitor() {
  _stopHeartbeatMonitor();

  // Run immediately on connect — catches stale "online" devices in MongoDB
  // that never sent a proper LWT (e.g. power cut while backend was down)
  runHeartbeatCheck().then((count) => {
    if (count > 0) {
      console.warn(`💤 [Heartbeat] Startup sweep: marked ${count} device(s) offline`);
    }
  });

  _heartbeatInterval = setInterval(async () => {
    const count = await runHeartbeatCheck();
    if (count > 0) {
      console.warn(`💤 [Heartbeat] Marked ${count} device(s) offline`);
    }
  }, 60 * 1000);
}

function _stopHeartbeatMonitor() {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
}

// =============================================================================
// publishCommand
// =============================================================================
// AFTER
function publishCommand(hardwareDeviceId, payload) {
  return new Promise((resolve, reject) => {
    if (!_client || !_client.connected)
      return reject(new Error("MQTT client is not connected"));

    if (payload.action !== "pump") {
      return reject(new Error(`Unknown action: ${payload.action}`));
    }

    const pumpTopic = mqttConfig.topics.cmdPump(hardwareDeviceId);

    _client.publish(pumpTopic, JSON.stringify(payload), { qos: 1 }, async (err) => {
      if (err) return reject(err);
      console.log(`📤 MQTT cmd → [${pumpTopic}]: ${payload.value}`);

      // Second publish: setMoisture target (only when provided)
      if (payload.targetMoisture !== null && payload.targetMoisture !== undefined) {
        const moistureTopic = mqttConfig.topics.cmdSetMoisture(hardwareDeviceId);
        await new Promise((res, rej) =>
          _client.publish(moistureTopic, String(payload.targetMoisture), { qos: 1 }, (e) => {
            if (e) return rej(e);
            console.log(`📤 MQTT cmd → [${moistureTopic}]: ${payload.targetMoisture}%`);
            res();
          })
        );
      }

      resolve({ topic: pumpTopic, payload });
    });
  });
}


// =============================================================================
// Status helpers (used by brokerRoutes)
// =============================================================================
function isBrokerConnected() {
  return _client ? _client.connected : false;
}

function getMqttClient() {
  return _client;
}

function getDevicePowerStatus(hardwareDeviceId) {
  // Default to true (power on) if we have never received a status yet,
  // so that devices which don't send power_status are not blocked.
  return devicePowerStatus.has(hardwareDeviceId)
    ? devicePowerStatus.get(hardwareDeviceId)
    : true;
}

// getDeviceStatusSummary — now delegates to deviceStatusService
async function getDeviceStatusSummary() {
  return getStatusSummary();
}

module.exports = {
  initMqttService,
  handleDataMessage,
  handleStatusMessage,
  handleAckMessage,
  publishCommand,

  isBrokerConnected,
  getMqttClient,
  getDeviceStatusSummary,
  getDevicePowerStatus,
};
