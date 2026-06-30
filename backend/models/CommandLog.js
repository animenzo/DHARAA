// backend/models/CommandLog.js
// Updated Phase 7: adds cmdId, attempts, ackedAt, cancelledAt fields
const mongoose = require("mongoose");

const attemptSchema = new mongoose.Schema(
  {
    at:         { type: Date, default: Date.now },
    mqttStatus: { type: String },
    error:      { type: String, default: null },
    retry:      { type: Number, default: 0 },
  },
  { _id: false }
);

const commandLogSchema = new mongoose.Schema(
  {
    user:   { type: mongoose.Schema.Types.ObjectId, ref: "User",   required: true },
    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true },
    farm:   { type: mongoose.Schema.Types.ObjectId, ref: "Farm",   default: null },

    actuator: { type: String, required: true, trim: true, lowercase: true },
    value:    { type: Number, required: true, enum: [0, 1] },
    payload:  { type: mongoose.Schema.Types.Mixed, required: true },

    // Phase 7: unique short command ID embedded in MQTT payload
    // ESP32 echoes it back in cmd/ack so we can match the acknowledgement
    cmdId: { type: String, default: null },

    source: {
      type: String,
      enum: ["manual", "schedule", "ai", "threshold", "api"],
      default: "manual",
    },

    mqttStatus: {
      type: String,
      enum: ["pending", "delivered", "acked", "failed", "timeout", "cancelled"],
      default: "pending",
    },

    errorMessage: { type: String, default: null },

    // Phase 7: attempt history — each publish attempt is pushed here
    attempts: { type: [attemptSchema], default: [] },

    acknowledged:    { type: Boolean, default: false },
    acknowledgedAt:  { type: Date, default: null },

    // Phase 7: explicit ACK timestamp from ESP32 cmd/ack message
    ackedAt:         { type: Date, default: null },

    // Phase 7: cancellation timestamp
    cancelledAt:     { type: Date, default: null },

    durationSeconds: { type: Number, default: null },
    issuedAt:        { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

commandLogSchema.index({ device: 1, issuedAt: -1 });
commandLogSchema.index({ user: 1, issuedAt: -1 });
commandLogSchema.index({ farm: 1, issuedAt: -1 });
commandLogSchema.index({ device: 1, actuator: 1, value: 1, issuedAt: -1 });

commandLogSchema.index(
    { createdAt: 1 },
  { expireAfterSeconds: 5 * 24 * 60 * 60 }
);
module.exports = mongoose.model("CommandLog", commandLogSchema);