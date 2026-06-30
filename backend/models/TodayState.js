const mongoose = require("mongoose");

const TodayStateSchema = new mongoose.Schema(
{
    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Farm",
        default: null
    },

    deviceId: {
        type: String,
        required: true,
        index: true
    },

    "Date": {
        type: Date,
        required: true
    },

    "Timestamp": {
        type: Date,
        required: true
    },

    "DayAfterSowing": {
        type: Number,
        required: true
    },

    "ET0": {
        type: Number,
        default: null
    },

    "Kc": {
        type: Number,
        default: null
    },

    "ETc": {
        type: Number,
        default: null
    },

    "RootDepth_m": {
        type: Number,
        default: null
    },

    "total_evoporation": {
        type: Number,
        default: null
    },

    "Physics_Moisture": {
        type: Number,
        default: null
    },

    "Sensor_Moisture": {
        type: Number,
        default: null
    },

    "Error": {
        type: Number,
        default: null
    }
},
{
    collection: "today_state",
    timestamps: true
});

module.exports = mongoose.model(
    "TodayState",
    TodayStateSchema
);