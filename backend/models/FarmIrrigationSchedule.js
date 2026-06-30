const mongoose = require("mongoose");

const farmIrrigationScheduleSchema = new mongoose.Schema({
    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Farm",
        required: true,
        unique: true
    },

    deviceId: {
        type: String,
        required: true
    },

    trigger_date: Date,
    selected_date: Date,

    selected_time: String,

    status: String,

    rain_hold: Boolean,

    rain_hold_until: Date,

    candidate_dates: [String],

    rejected_dates: [String],

    reasons: [String],

    selected_date_score: Number,

    selected_time_score: Number,

    debug: mongoose.Schema.Types.Mixed,

    generatedAt: {
        type: Date,
        default: Date.now
    }
},
{
    timestamps: true,
    strict: false
});

farmIrrigationScheduleSchema.index({ farm: 1, deviceId: 1 });

module.exports = mongoose.model(
    "FarmIrrigationSchedule",
    farmIrrigationScheduleSchema
);
