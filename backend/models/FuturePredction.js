// models/FuturePrediction.js
//
// ─────────────────────────────────────────────────────────────────────────────
// AI INTEGRATION PREPARATION — Phase 12 placeholder
// ─────────────────────────────────────────────────────────────────────────────
//
// This model is the data contract between the future AI/ML service and the
// rest of the system.  No ML is implemented yet.  The schema is designed so
// that when the AI service is plugged in, it simply writes documents here and
// the existing backend/frontend code already knows how to read them.
//
// How the future AI loop will work:
//
//   1. AI Service reads SensorData + CommandLog + Weather from MongoDB.
//   2. AI model predicts the optimal irrigation window.
//   3. AI writes a FuturePrediction document with status "pending".
//   4. Backend picks it up, validates it, and publishes the cmd via MQTT.
//   5. Document status updates to "executed" → "acknowledged".
//
// The `source` field distinguishes AI commands from manual commands in
// CommandLog so analytics can measure AI vs human decisions over time.

const mongoose = require("mongoose");

const futurePredictionSchema = new mongoose.Schema(
  {
    // ─── Ownership ────────────────────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      required: true,
    },
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      default: null,
    },

    // ─── Prediction Content ───────────────────────────────────────
    // What the AI recommends
    action: {
      type: String,
      enum: ["irrigate", "skip_irrigation", "reduce_duration", "alert_human"],
      required: true,
    },

    // Which actuator the action targets  e.g. "pump", "valve"
    actuator: {
      type: String,
      trim: true,
      default: "pump",
    },

    // Recommended value  0 or 1
    recommendedValue: {
      type: Number,
      enum: [0, 1],
      default: 1,
    },

    // Recommended irrigation duration in minutes
    recommendedDurationMinutes: {
      type: Number,
      default: null,
    },

    // When the AI recommends executing this action
    scheduledFor: {
      type: Date,
      required: true,
    },

    // ─── AI Confidence ────────────────────────────────────────────
    // Probability score from the model  0.0–1.0
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },

    // Human-readable reason
    // e.g. "Soil moisture predicted to drop below 20% by 06:00 tomorrow
    //        based on last 7-day trend and clear weather forecast."
    reasoning: {
      type: String,
      trim: true,
      default: "",
    },

    // ─── Input Features ───────────────────────────────────────────
    // Snapshot of the data the model used to make this prediction.
    // Stored for reproducibility and model auditing.
    inputFeatures: {
      avgMoistureLast24h: { type: Number, default: null },
      avgTemperatureLast24h: { type: Number, default: null },
      avgHumidityLast24h: { type: Number, default: null },
      rainDetectedLast24h: { type: Boolean, default: false },
      waterLevelCurrent: { type: Number, default: null },
      pumpRunsLast7Days: { type: Number, default: null },
      weatherForecastRain: { type: Boolean, default: false },
      // Extensible: add more features without breaking existing docs
      extra: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    // ─── Model Metadata ───────────────────────────────────────────
    modelVersion: {
      type: String,
      default: "pending", // Updated when the AI service is live
    },

    // ─── Execution Lifecycle ──────────────────────────────────────
    // pending    → AI wrote it, not yet executed
    // approved   → User or auto-approve confirmed it
    // executed   → Backend published the MQTT command
    // acknowledged → ESP32 confirmed the action
    // rejected   → User dismissed it
    // expired    → scheduledFor passed without execution
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "executed",
        "acknowledged",
        "rejected",
        "expired",
      ],
      default: "pending",
    },

    // Link to the CommandLog document created when this prediction executes
    commandLog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CommandLog",
      default: null,
    },

    executedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    // Optional reason if a human rejected this recommendation
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
futurePredictionSchema.index({ user: 1, status: 1, scheduledFor: 1 });
futurePredictionSchema.index({ device: 1, scheduledFor: -1 });
futurePredictionSchema.index({ farm: 1, scheduledFor: -1 });

// Auto-delete fully processed predictions older than 1 year
futurePredictionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 365 * 24 * 60 * 60 }
);

module.exports = mongoose.model("FuturePrediction", futurePredictionSchema);