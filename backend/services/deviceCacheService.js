// backend/services/deviceCacheService.js
// =============================================================================
// Device Lookup Cache
// =============================================================================
// ESP32 publishes sensor data every few seconds.
// Without a cache, every MQTT message would fire a MongoDB query:
//   "SELECT * FROM devices WHERE deviceId = 'esp001'"
// That's potentially hundreds of DB queries per minute per device.
//
// This module maintains an in-process LRU-style Map cache of device documents,
// keyed by hardware deviceId string (e.g. "esp001").
//
// Cache behaviour:
//   • Hit  → returns cached device, no DB call
//   • Miss → queries MongoDB, caches the result for TTL seconds
//   • Invalidate → called when a device is updated/deleted via API
//
// No external package needed — plain Map + timestamps.
// =============================================================================

const Device = require("../models/Device");

// ─── Cache config ─────────────────────────────────────────────────────────────
const CACHE_TTL_MS   = 5 * 60 * 1000; // 5 minutes per entry
const MAX_CACHE_SIZE = 500;            // max devices in memory at once

// Internal cache Map:  deviceId (string) → { device, cachedAt }
const cache = new Map();

// =============================================================================
// getDevice
// Returns the full Device document for a given hardware deviceId.
// Includes authTokenHash (needed for token verification) via .select("+authTokenHash")
// =============================================================================
async function getDevice(hardwareDeviceId) {
  const key = hardwareDeviceId;

  // ── Cache hit ───────────────────────────────────────────────────────────────
  const cached = cache.get(key);
  if (cached) {
    const age = Date.now() - cached.cachedAt;
    if (age < CACHE_TTL_MS) {
      return cached.device;
    }
    // Expired — fall through to DB
    cache.delete(key);
  }

  // ── Cache miss — query MongoDB ───────────────────────────────────────────────
  const device = await Device.findOne({ deviceId: key })
    .select("+authTokenHash")  // authTokenHash is select:false by default
    .lean();

  if (!device) return null;

  // Evict oldest entry if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  cache.set(key, { device, cachedAt: Date.now() });
  return device;
}

// =============================================================================
// invalidate
// Removes a device from the cache.
// Call this from iotController whenever a device is updated or deleted.
// =============================================================================
function invalidate(hardwareDeviceId) {
  cache.delete(hardwareDeviceId);
}

// =============================================================================
// invalidateAll
// Clears the entire cache.  Useful after bulk updates.
// =============================================================================
function invalidateAll() {
  cache.clear();
}

// =============================================================================
// getCacheStats
// Returns diagnostics about the current cache state.
// Used by GET /iot/broker/status
// =============================================================================
function getCacheStats() {
  return {
    size:    cache.size,
    maxSize: MAX_CACHE_SIZE,
    ttlMs:   CACHE_TTL_MS,
  };
}

module.exports = {
  getDevice,
  invalidate,
  invalidateAll,
  getCacheStats,
};