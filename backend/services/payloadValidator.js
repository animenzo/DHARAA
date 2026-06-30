// backend/services/payloadValidator.js


const KNOWN_FIELDS = {
  moisture1:   { min: 0, max: 100, type: "number" },
  moisture2:   { min: 0, max: 100, type: "number" },

  temperature: { min: -40, max: 85, type: "number" },
  humidity:    { min: 0, max: 100, type: "number" },

  rain:        { min: 0, max: 1023, type: "number" },

  waterLevel:  { min: 0, max: 100, type: "number" },
  sensorDistance: { min: 0, max: 1000, type: "number" },

  pump:        { min: 0, max: 1, type: "integer", enum: [0,1] },

  valve:       { min: 0, max: 1, type: "integer", enum: [0,1] },

  physical_btn: { min: 0, max: 1, type: "integer", enum: [0,1] },
  physicalBtn: { min: 0, max: 1, type: "integer", enum: [0,1] },
  power_status: { min: 0, max: 1, type: "integer", enum: [0,1] },

  rssi:        { min: -120, max: 0, type: "number" },
};

// Keys that are metadata, not sensor readings — handled separately
const FIELD_ALIASES = {
  water: "waterLevel",
  tank: "waterLevel",
  tankLevel: "waterLevel",
  tank_level: "waterLevel",
  water_level: "waterLevel",
  distance: "sensorDistance",
  tankDistance: "sensorDistance",
  tank_distance: "sensorDistance",
  physical_btn: "physicalBtn",
};

const META_KEYS = new Set([ "deviceId", "ts", "timestamp", "fw", "firmware"]);

// =============================================================================
// parseAndValidate
// Parses a raw MQTT payload Buffer for a /data topic.
//
// Returns:
//   { valid: true,  clean: { moisture, temperature, ... }, authToken, extra, meta }
//   { valid: false, reason: "string explaining why" }
// =============================================================================
function parseAndValidate(payloadBuffer) {
  // ── 1. Parse JSON ───────────────────────────────────────────────────────────
  let raw;
  try {
    raw = JSON.parse(payloadBuffer.toString());
  } catch {
    return { valid: false, reason: "Payload is not valid JSON" };
  }

  if (typeof raw !== "object" || Array.isArray(raw) || raw === null) {
    return { valid: false, reason: "Payload must be a JSON object" };
  }


  // ── 3. Process known fields ─────────────────────────────────────────────────
  const clean = {};
  const extra = {};
  const warnings = [];

  for (const [rawKey, value] of Object.entries(raw)) {
    // Skip meta keys — they are handled outside the sensor object
    if (META_KEYS.has(rawKey)) continue;

    const key = FIELD_ALIASES[rawKey] || rawKey;
    const spec = KNOWN_FIELDS[key];

    if (spec) {
      const num = Number(value);
      if (Number.isNaN(num)) {
        warnings.push(`${key}: expected number, got "${value}" — skipped`);
        continue;
      }

      // Clamp to legal range
      const clamped = Math.min(Math.max(num, spec.min), spec.max);
      if (clamped !== num) {
        warnings.push(`${key}: clamped from ${num} to ${clamped}`);
      }

      // Enum check for binary fields (pump, valve)
      if (spec.enum && !spec.enum.includes(clamped)) {
        warnings.push(`${key}: value ${clamped} not in enum ${spec.enum} — skipped`);
        continue;
      }

      // Round integer fields
      clean[key] = spec.type === "integer" ? Math.round(clamped) : clamped;
    } else {
      // Unknown key → goes into `extra` if it is numeric
      const num = Number(value);
      if (!Number.isNaN(num)) {
        extra[key] = num;
      }
      // Non-numeric unknown fields are silently dropped (security)
    }
  }

  // ── 4. Extract optional meta ────────────────────────────────────────────────
  const meta = {};
  if (raw.fw || raw.firmware) {
    meta.firmwareVersion = String(raw.fw || raw.firmware).slice(0, 32);
  }
  if (raw.rssi !== undefined) {
    const rssi = Number(raw.rssi);
    if (!Number.isNaN(rssi)) meta.rssi = rssi;
  }
  // ESP32 can send its own timestamp; use it if it looks like a Unix ms timestamp
  if (raw.ts || raw.timestamp) {
    const ts = Number(raw.ts || raw.timestamp);
    if (!Number.isNaN(ts) && ts > 1_000_000_000_000) {
      meta.recordedAt = new Date(ts);
    }
  }

  return {
    valid: true,
    clean,
    extra,
    meta,
    warnings,
  };
}


function parseStatusPayload(payloadBuffer) {
  const msg = payloadBuffer.toString().trim();

  // Format 1 — plain string (correct ESP32 format): "online" / "offline"
  if (msg === "online" || msg === "offline") {
    return { valid: true, status: msg };
  }

  // Format 2 — JSON object (what your ESP32 currently sends): {"status":"online"}
  try {
    const parsed = JSON.parse(msg);
    if (parsed.status === "online" || parsed.status === "offline") {
      return { valid: true, status: parsed.status };
    }
  } catch {
    // not JSON
  }

  return { valid: false, reason: `Unknown status value: "${msg}"` };
}

// =============================================================================
// parseTopic
// Extracts { userId, deviceId, subtopic } from a topic string.
//
// Input:  "farm/507f1f77/esp001/data"
// Output: { userId: "507f1f77", deviceId: "esp001", subtopic: "data" }
//
// Returns null if the topic does not match the farm/+/+/# pattern.
// =============================================================================
function parseTopic(topic) {
  // Pattern: farm/{deviceId}/{subtopic}
  // No userId segment — deviceId alone identifies the device. Ownership
  // is resolved by looking up the Device document's `user` field, not
  // from the topic string.
  const parts = topic.split("/");
  if (parts.length < 3 || parts[0] !== "farm") return null;

  const [, deviceId, ...rest] = parts;
  if (!deviceId || rest.length === 0) return null;

  return {
    deviceId: deviceId,
    subtopic: rest.join("/"),   // handles nested subtopics e.g. "cmd/ack"
  };
}

module.exports = {
  parseAndValidate,
  parseStatusPayload,
  parseTopic,
  KNOWN_FIELDS,
};
