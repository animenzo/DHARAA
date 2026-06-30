const mongoose = require("mongoose");

const moistureSnapshotSchema = new mongoose.Schema(
  {
    sensor1: { type: Number, default: null },
    sensor2: { type: Number, default: null },
    sensor3: { type: Number, default: null },
    average: { type: Number, default: null },
    recordedAt: { type: Date, default: null },
  },
  { _id: false }
);

const deviceStatusSnapshotSchema = new mongoose.Schema(
  {
    esp32: { type: String, default: "unknown" },
    mqtt: { type: String, default: "unknown" },
    lastSeen: { type: Date, default: null },
  },
  { _id: false }
);

const irrigationExecutionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: "Farm", required: true },
    device: { type: mongoose.Schema.Types.ObjectId, ref: "Device", required: true },
    deviceId: { type: String, required: true, index: true },

    scheduledDate: { type: Date, default: null },
    scheduledTime: { type: String, default: null },
    scheduledAt: { type: Date, default: null, index: true },

    rainHold: { type: Boolean, default: false },
    rainHoldUntil: { type: Date, default: null },
    rainHoldReleasedAt: { type: Date, default: null },

    requiredTheta: { type: Number, required: true },
    stopMoisture: {
    type: Number,
    default: null,
},
    thresholdMoisture: { type: Number, default: null },
    waterSufficient: { type: Boolean, default: null },

    status: {
      type: String,
      enum: [
        "PENDING",
        "WAITING_DEVICE",
        "WAITING_RAIN_HOLD",
        "WAITING_WEATHER",
        "RUNNING",
        "PULSE_OFF",
        "COMPLETED",
        "PARTIAL",
        "FAILED",
        "SKIPPED",
        "CANCELLED",
        "EMERGENCY",
        "WAITING_POWER"
      ],
      default: "PENDING",
      index: true,
    },

    reason: { type: String, default: null },
    emergency: { type: Boolean, default: false },

    actualStartTime: { type: Date, default: null },
    actualEndTime: { type: Date, default: null },
    phaseStartedAt: { type: Date, default: null },
    runtimeMinutes: { type: Number, default: 0 },

    moistureBefore: { type: moistureSnapshotSchema, default: null },
    moistureAfter: { type: moistureSnapshotSchema, default: null },
    tankLevelBefore: { type: Number, default: null },
    tankLevelAfter: { type: Number, default: null },
    deviceStatus: { type: deviceStatusSnapshotSchema, default: null },

    commandLogs: [{ type: mongoose.Schema.Types.ObjectId, ref: "CommandLog" }],
    notificationKeys: { type: [String], default: [] },

    sourceSchedule: { type: mongoose.Schema.Types.Mixed, default: null },
    sourceWaterRequirement: { type: mongoose.Schema.Types.Mixed, default: null },
    lastCheckedAt: { type: Date, default: null },
  },
  {
    collection: "irrigation_execution",
    timestamps: true,
  }
);

irrigationExecutionSchema.index({ farm: 1, status: 1, scheduledAt: 1 });
irrigationExecutionSchema.index({ device: 1, status: 1 });
irrigationExecutionSchema.index({ emergency: 1, status: 1 });

module.exports = mongoose.model("IrrigationExecution", irrigationExecutionSchema);
