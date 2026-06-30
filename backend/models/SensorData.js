const mongoose = require("mongoose");

const sensorDataSchema = new mongoose.Schema(
{
    // Relationships
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Device",
        required: true
    },

    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Farm",
        default: null
    },

    // ── Soil Moisture Sensors ────────────────────────────────────────────────
    // Each entry: { sensorId, label, value }
    moistureSensors: [
        {
            sensorId: String,
            label:    String,
            value:    Number,
        }
    ],

    // Average of all moistureSensors values (computed in mqttService before save)
    avgMoisture: {
        type:    Number,
        default: null,
    },

    // ── Environment Sensors ──────────────────────────────────────────────────
    temperature: {
        type:    Number,
        min:     -40,
        max:     85,
        default: null,
    },

    humidity: {
        type:    Number,
        min:     0,
        max:     100,
        default: null,
    },

    rain: {
        type:    Number,
        default: null,
    },

    // ── Water Tank ───────────────────────────────────────────────────────────
    waterLevel: {
        type:    Number,
        min:     0,
        max:     100,
        default: null,
    },

    sensorDistance: {
        type:    Number,
        min:     0,
        default: null,
    },

    waterHeight: {
        type:    Number,
        min:     0,
        default: null,
    },

    currentWaterLiters: {
        type:    Number,
        min:     0,
        default: null,
    },

    waterLevelPercent: {
        type:    Number,
        min:     0,
        max:     100,
        default: null,
    },

    // ── Actuator State Snapshot ──────────────────────────────────────────────
    pump: {
        type:    Number,
        enum:    [0, 1],
        default: 0,
    },

    valve: {
        type:    Number,
        enum:    [0, 1],
        default: 0,
    },

    // ── Physical Button ──────────────────────────────────────────────────────
    // 1 = pump was triggered by the on-device button, 0 = remote / schedule
    physicalBtn: {
        type:    Number,
        enum:    [0, 1],
        default: 0,
    },

    // ── Pump source label ────────────────────────────────────────────────────
    // "OFF" | "MANUAL" | "REMOTE" | "REMOTE_AI"
    // Computed in mqttService from pump + physicalBtn + farm.aiAutoEnabled
    pumpSource: {
        type:    String,
        enum:    ["OFF", "MANUAL", "REMOTE", "REMOTE_AI"],
        default: "OFF",
    },

    // ── Extensibility ─────────────────────────────────────────────────────────
    // FIX (BUG-1): restored `extra` field that was accidentally removed.
    // Without this, Mongoose strict mode silently drops any extra keys the
    // ESP32 sends, so new sensors would lose data with no error.
    extra: {
        type:    Map,
        of:      Number,
        default: undefined,
    },

    // ── Signal Quality ────────────────────────────────────────────────────────
    rssi: {
        type:    Number,
        default: null,
    },

    // ── Timestamp ─────────────────────────────────────────────────────────────
    // Stored explicitly so the ESP32 can optionally supply its own timestamp.
    recordedAt: {
        type:    Date,
        default: Date.now,
    },
},
{
    timestamps: true, // adds createdAt / updatedAt
}
);

// ── Indexes ───────────────────────────────────────────────────────────────────
// Most queries: "last N readings for device X in time range Y"
sensorDataSchema.index({ device: 1, recordedAt: -1 });

// Dashboard overview: "all readings for this user today"
sensorDataSchema.index({ user: 1, recordedAt: -1 });

// Farm-level analytics: "daily moisture average for farm Z"
sensorDataSchema.index({ farm: 1, recordedAt: -1 });

module.exports = mongoose.model("SensorData", sensorDataSchema);
