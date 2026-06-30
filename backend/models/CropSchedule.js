const mongoose = require("mongoose");

const DailyScheduleSchema = new mongoose.Schema(
{
    "Date": {
        type: Date,
        required: true
    },

    "DayAfterSowing": {
        type: Number,
        required: true
    },

    "Kc": {
        type: Number,
        required: true
    },

    "RootDepth_m": {
        type: Number,
        required: true
    },

    "TAW_mm": {
        type: Number,
        required: true
    }
},
{
    _id: false
});

const CropScheduleSchema = new mongoose.Schema(
{
    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Farm",
        required: true,
        unique: true
    },

    deviceId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    "CropName": {
        type: String,
        required: true
    },

    "SoilTexture": {
        type: String,
        required: true
    },

    "SowingDate": {
        type: Date,
        required: true
    },

    schedule: {
        type: [DailyScheduleSchema],
        default: []
    }
},
{
    collection: "crop_schedule",
    timestamps: true
});

module.exports = mongoose.model(
    "CropSchedule",
    CropScheduleSchema
);