// backend/routes/brokerRoutes.js
// =============================================================================
// Broker & System Health Routes  (Phase 3 → enhanced in Phase 4)
// =============================================================================
// Mounted in index.js as:  app.use("/iot/broker", brokerRoutes)
// =============================================================================

const router = require("express").Router();
const auth   = require("../middleware/auth");
const { isBrokerConnected } = require("../services/mqttService");
const { getConnectedCount } = require("../services/socketService");
const { getCacheStats }     = require("../services/deviceCacheService");

// =============================================================================
// GET /iot/broker/status
// Returns MQTT broker, Socket.IO, and device cache health.
// =============================================================================
router.get("/status", auth, async (req, res) => {
  try {
    const [socketClients, cacheStats] = await Promise.all([
      getConnectedCount(),
      Promise.resolve(getCacheStats()),
    ]);

    res.json({
      mqtt: {
        connected: isBrokerConnected(),
        brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
        clientId:  process.env.MQTT_CLIENT_ID  || "cropsense_backend_server",
      },
      socketio: {
        connectedClients: socketClients,
      },
      deviceCache: cacheStats,
      server: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryMB:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        nodeVersion:   process.version,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch broker status", error: err.message });
  }
});

module.exports = router;