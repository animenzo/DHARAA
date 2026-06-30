// models/Device.js
//
// Represents a physical ESP32 (or any MQTT-capable hardware).
// One device is auto-created per user on signup.
// Multiple devices per user are supported for future scalability.
//
// ─── MQTT Topic Map ───────────────────────────────────────────────
//   data    farm/{deviceId}/data
//   status  farm/{deviceId}/status
//   cmd     farm/{deviceId}/cmd
//   config  farm/{deviceId}/config

const mongoose = require("mongoose");
const crypto = require("crypto");

const deviceSchema = new mongoose.Schema(
  {
    // ─── Ownership ────────────────────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Optional: link device to a specific farm
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Farm",
      default: null,
    },

    // Link to the template that describes this device's widgets
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Template",
      default: null,
    },

    // ─── Identity ─────────────────────────────────────────────────
    // Short human-readable hardware ID  e.g. "esp001"
    // Used as the {deviceId} segment in MQTT topics.
    deviceId: {
      type: String,
      required: [true,"Device ID is required"],
      unique: true,
      trim: true,
    },

    // Friendly display name shown in the UI
    name: {
      type: String,
      trim: true,
      default: "My ESP32",
    },

    // Hardware type label for future multi-device support
    hardwareType: {
      type: String,
      enum: ["ESP32", "ESP8266", "Arduino", "RaspberryPi", "Other"],
      default: "ESP32",
    },

    // ─── Online / Offline ─────────────────────────────────────────
    // Updated by:
    //   • MQTT CONNECT    → "online"
    //   • MQTT LWT        → "offline"   (Last Will and Testament)
    //   • Heartbeat check → "offline"   (if no data for > threshold)
    status: {
      type: String,
      enum: ["online", "offline", "unknown"],
      default: "unknown",
    },

    // Timestamp of the last received MQTT message from this device
    lastSeen: {
      type: Date,
      default: null,
    },

    // ─── MQTT Topics (denormalised for quick lookup) ───────────────
    // Populated by provisioningService at creation time.
    topics: {
      data: { type: String },
      status: { type: String },
      cmd: { type: String },
     
    },


    // ─── Firmware & Meta ──────────────────────────────────────────
    firmwareVersion: {
      type: String,
      default: "unknown",
    },

    // Whether the device has been activated (first connection received)
    isActive: {
      type: Boolean,
      default: false,
    },

    // Optional notes (e.g. "Field sensor – north quadrant")
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
deviceSchema.index({ user: 1 });                  // All devices for a user
deviceSchema.index({ deviceId: 1 }, { unique: true }); // Fast MQTT topic lookup           // Token validation

// ─── Instance helper: build MQTT topic strings ────────────────────────────────
deviceSchema.methods.buildTopics = function () {
  const base = `farm/${this.deviceId}`;
  return {
    data: `${base}/data`,
    status: `${base}/status`,
    cmd: `${base}/cmd`,
    
  };
};

module.exports = mongoose.model("Device", deviceSchema);