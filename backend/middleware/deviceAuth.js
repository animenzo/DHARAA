// backend/middleware/deviceAuth.js
// =============================================================================
// Device Authentication Middleware
// =============================================================================
// Used to protect REST API endpoints that an ESP32 calls directly
// (e.g. HTTP-based fallback or firmware OTA endpoint).
//
// The ESP32 sends:
//   Header:  X-Device-Id: esp001
//   Header:  X-Auth-Token: <plain token>
//
// This middleware:
//   1. Reads deviceId and authToken from headers
//   2. Looks up the Device document (cache-first)
//   3. Hashes the token and compares to stored hash
//   4. Attaches req.device to the request on success
//   5. Returns 401 on any failure
//
// Note: MQTT-based authentication is handled entirely inside mqttService.js.
// This middleware is for the few REST endpoints an ESP32 might call.
// =============================================================================

const crypto = require("crypto");
const { getDevice } = require("../services/deviceCacheService");

const deviceAuth = async (req, res, next) => {
  const deviceId  = req.headers["x-device-id"];
  const authToken = req.headers["x-auth-token"];

  if (!deviceId || !authToken) {
    return res.status(401).json({
      message: "Device authentication required. Provide X-Device-Id and X-Auth-Token headers.",
    });
  }

  const device = await getDevice(deviceId.trim());

  if (!device) {
    return res.status(401).json({ message: "Unknown device ID." });
  }

  const tokenHash = crypto
    .createHash("sha256")
    .update(authToken.trim())
    .digest("hex");

  if (tokenHash !== device.authTokenHash) {
    return res.status(401).json({ message: "Invalid device auth token." });
  }

  // Attach the verified device to the request
  req.device = device;
  next();
};

module.exports = deviceAuth;