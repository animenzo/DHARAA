const mongoose = require("mongoose");

const irrigationTaskSchema =
new mongoose.Schema({

    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Farm",
        required: true
    },

    deviceId: String,

    executionDate: Date,

    executionTime: String,

    pendingExecution: {
        type: Boolean,
        default: true
    },

    rainHold: {
        type: Boolean,
        default: false
    },

    status: {
        type: String,
        enum: [
            "PENDING",
            "RUNNING",
            "WAITING_DEVICE",
            "WAITING_RAIN_HOLD",
            "COMPLETED",
            "FAILED"
        ],
        default: "PENDING"
    }
},
{
    timestamps: true
});

module.exports =
mongoose.model(
    "IrrigationTask",
    irrigationTaskSchema
);