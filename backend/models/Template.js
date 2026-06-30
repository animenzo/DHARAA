// models/Template.js
//
// A Template defines the "shape" of an IoT device:
//   - Which sensors it has (soil moisture, temperature, …)
//   - Which actuators it has (pump, valve, …)
//
// One template is auto-created per user on signup.
// Future: users can create multiple templates for different device types.

const mongoose = require("mongoose");

// ─── Sub-schema: a single sensor or actuator pin ─────────────────────────────
const widgetSchema = new mongoose.Schema(
  {
    // Logical name shown in the UI  e.g. "Soil Moisture"
    label: {
      type: String,
      required: true,
      trim: true,
    },

    // Machine-readable key that matches the JSON key the ESP32 sends
    // e.g. "moisture", "temperature", "humidity", "rain", "waterLevel", "pump", "valve"
    dataKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    // SENSOR  = read-only  (ESP32 → Backend)
    // ACTUATOR = writable  (Backend → ESP32 via MQTT cmd topic)
    widgetType: {
      type: String,
      enum: ["SENSOR", "ACTUATOR"],
      required: true,
    },

    // Fine-grained data type — drives UI rendering (gauge, switch, bar, etc.)
    dataType: {
      type: String,
      enum: [
        "temperature",   // °C / °F
        "humidity",      // %
        "moisture",      // % soil moisture
        "rain",          // boolean / mm
        "waterLevel",    // % or cm
        "switch",        // boolean (pump on/off, valve open/close)
        "generic",       // catch-all for future sensors
      ],
      default: "generic",
    },

    // Unit label shown in the UI  e.g. "°C", "%", "mm"
    unit: {
      type: String,
      default: "",
      trim: true,
    },

    // Gauge / chart Y-axis range
    min: {
      type: Number,
      default: 0,
    },
    max: {
      type: Number,
      default: 100,
    },

    // Hex color used for charts / gauge strokes  e.g. "#10b981"
    color: {
      type: String,
      default: "#10b981",
    },

    // Display order in the dashboard (lower = first)
    order: {
      type: Number,
      default: 0,
    },

    // Whether this widget is visible in the dashboard
    isVisible: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

// ─── Template schema ──────────────────────────────────────────────────────────
const templateSchema = new mongoose.Schema(
  {
    // The user this template belongs to
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Human-readable name  e.g. "Smart Irrigation v1"
    name: {
      type: String,
      required: true,
      trim: true,
      default: "Smart Irrigation Template",
    },

    // Optional description
    description: {
      type: String,
      trim: true,
      default: "Auto-generated precision irrigation template",
    },

    // All widgets (sensors + actuators) defined for this template.
    // The default set covers every sensor/actuator listed in the requirements.
    widgets: {
      type: [widgetSchema],
      default: () => [
        // ── Sensors ──────────────────────────────────────────────
        {
          label: "Soil Moisture",
          dataKey: "moisture",
          widgetType: "SENSOR",
          dataType: "moisture",
          unit: "%",
          min: 0,
          max: 100,
          color: "#10b981",
          order: 1,
        },
        {
          label: "Temperature",
          dataKey: "temperature",
          widgetType: "SENSOR",
          dataType: "temperature",
          unit: "°C",
          min: 0,
          max: 60,
          color: "#f59e0b",
          order: 2,
        },
        {
          label: "Humidity",
          dataKey: "humidity",
          widgetType: "SENSOR",
          dataType: "humidity",
          unit: "%",
          min: 0,
          max: 100,
          color: "#3b82f6",
          order: 3,
        },
        {
          label: "Rain Sensor",
          dataKey: "rain",
          widgetType: "SENSOR",
          dataType: "rain",
          unit: "",
          min: 0,
          max: 1,
          color: "#6366f1",
          order: 4,
        },
        {
          label: "Water Level",
          dataKey: "waterLevel",
          widgetType: "SENSOR",
          dataType: "waterLevel",
          unit: "%",
          min: 0,
          max: 100,
          color: "#0ea5e9",
          order: 5,
        },
        // ── Actuators ────────────────────────────────────────────
        {
          label: "Pump",
          dataKey: "pump",
          widgetType: "ACTUATOR",
          dataType: "switch",
          unit: "",
          min: 0,
          max: 1,
          color: "#ef4444",
          order: 6,
        },
        {
          label: "Valve",
          dataKey: "valve",
          widgetType: "ACTUATOR",
          dataType: "switch",
          unit: "",
          min: 0,
          max: 1,
          color: "#8b5cf6",
          order: 7,
        },
      ],
    },

    // Template version — bump when breaking changes are made
    version: {
      type: String,
      default: "1.0.0",
    },
  },
  { timestamps: true }
);

// One template per user (can be relaxed later for multi-device farms)
templateSchema.index({ user: 1 });

module.exports = mongoose.model("Template", templateSchema);