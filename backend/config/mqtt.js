// backend/config/mqtt.js
// ─────────────────────────────────────────────────────────────────────────────
// Central MQTT configuration.
// All values are read from environment variables so that the same code runs
// in local dev (plain TCP to localhost) and production (TLS to a VPS).
//
// Consumed by:  services/mqttService.js
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // ─── Broker connection ──────────────────────────────────────────────────
  // In local dev: mqtt://localhost:1883
  // In production with TLS: mqtts://your-server.com:8883
  brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",

  // ─── Client identity ────────────────────────────────────────────────────
  // The Node.js backend connects as a single privileged client.
  // This ID must be unique on the broker.
  clientId: process.env.MQTT_CLIENT_ID || "cropsense_backend_server",

  // ─── Credentials (required if allow_anonymous false in mosquitto.conf) ──
  username: process.env.MQTT_USERNAME || "",
  password: process.env.MQTT_PASSWORD || "",

  // ─── Connection options ─────────────────────────────────────────────────
  options: {
    // Reconnect automatically if the broker goes down
    reconnectPeriod: 5000,         // ms between reconnect attempts

    // How long to wait for a CONNACK before giving up
    connectTimeout: 10000,         // ms

    // Keep the session alive even if the client disconnects briefly
    clean: true,

    qos: 1,

    // ─── Backend's Last Will and Testament ────────────────────────────────
    // If the Node.js process crashes, the broker publishes this so that
    // any monitoring tools can detect it.
    will: {
      topic: "cropsense/backend/status",
      payload: JSON.stringify({ status: "offline", service: "cropsense_backend" }),
      qos: 1,
      retain: true,
    },
  },

  // ─── Topic patterns ─────────────────────────────────────────────────────
  // Pattern: farm/{deviceId}/{subtopic}  — no userId segment.
  // The backend subscribes to a wildcard that matches every device.
  // Individual device topics are built dynamically when needed.
  topics: {
    // Subscribe to ALL device traffic (+ = single level, # = multi level)
    subscribeAll: "farm/+/#",

    // Subscribe to data from all devices  (sensor readings)
    allData:   "farm/+/data",

    // Subscribe to status from all devices  (online / offline LWT)
    allStatus: "farm/+/status",

    // Builder functions — called with (deviceId) at runtime
    data:   (deviceId) => `farm/${deviceId}/data`,
    status: (deviceId) => `farm/${deviceId}/status`,
    cmd:    (deviceId) => `farm/${deviceId}/cmd`,
    // config: (deviceId) => `farm/${deviceId}/config`,
    cmdPump:        (deviceId) => `farm/${deviceId}/cmd/pump`,
    cmdSetMoisture: (deviceId) => `farm/${deviceId}/cmd/setMoisture`,
    cmdAck:          (deviceId) => `farm/${deviceId}/cmd/ack`,
  },

  // ─── Timeouts / thresholds ──────────────────────────────────────────────
  // If a device hasn't sent data for this many minutes, mark it offline.
  offlineThresholdMinutes: process.env.MQTT_OFFLINE_THRESHOLD_MINUTES
    ? parseInt(process.env.MQTT_OFFLINE_THRESHOLD_MINUTES, 10)
    : 5,
};