const mongoose = require("mongoose");

const irrigationLogSchema =
new mongoose.Schema({

    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Farm",
        required: true
    },

    deviceId: String,

    scheduledDate: Date,

    scheduledTime: String,

    actualStartTime: Date,

    actualEndTime: Date,

    moistureBefore: Number,

    moistureAfter: Number,

    sensor1Final: Number,

    sensor2Final: Number,

    sensor3Final: Number,

    requiredTheta: Number,

    waterSufficient: Boolean,

    tankBefore: Number,

    tankAfter: Number,

    rainHoldStatus: Boolean,

    emergencyTriggered: Boolean,

    runtimeMinutes: Number,

    deviceStatus: String,

    status: {
        type: String,
        enum: [
            "COMPLETED",
            "PARTIAL",
            "WAITING_RAIN_HOLD",
            "WAITING_DEVICE",
            "FAILED",
            "SKIPPED",
            "CANCELLED",
            "EMERGENCY"
        ]
    },

    reason: String
},
{
    timestamps: true
});

module.exports =
mongoose.model(
    "IrrigationLog",
    irrigationLogSchema
);