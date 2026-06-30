// models/Notification.js
//
// Stores threshold-based alerts and system notifications.
//
// Examples of notifications this system will generate:
//   • "Soil moisture dropped below 20% — consider irrigating"
//   • "Pump has been running for over 2 hours"
//   • "Water tank level is critically low (< 10%)"
//   • "Device went offline"
//   • "Temperature exceeded 45°C"
//
// Notifications are created by:
//   • mqttService.js    — device offline / data threshold breach
//   • iotController.js  — command failures
//   • Future: AI service — predictive alerts (Phase 12)

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
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
      default: null,
    },
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      default: null,
    },

    // ─── Content ──────────────────────────────────────────────────
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },

    // ─── Classification ───────────────────────────────────────────
    type: {
      type: String,
      enum: [
        "device_offline",       // LWT triggered
        "device_online",        // Device reconnected
        "low_moisture",         // Moisture below threshold
        "high_temperature",     // Temperature above threshold
        "low_water_level",      // Tank nearly empty
        "pump_running_long",    // Pump ON for > configured duration
        "rain_detected",        // Rain sensor triggered
        "command_failed",       // MQTT publish failed
        "ai_recommendation",    // Future: AI suggestion
        "system",               // Generic system message
      ],
      default: "system",
    },

    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
    },

    // ─── State ────────────────────────────────────────────────────
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },

    // ─── Context Data ─────────────────────────────────────────────
    // Stores the raw sensor value that triggered this notification.
    // e.g. { sensor: "moisture", value: 18, threshold: 20 }
    context: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });

// Auto-delete notifications older than 30 days
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

module.exports = mongoose.model("Notification", notificationSchema);