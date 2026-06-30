const mongoose = require("mongoose");

const DailyForecastSchema = new mongoose.Schema(
{
    "date": {
        type: Date,
        required: true
    },

    "Tmin": {
        type: Number,
        required: true
    },

    "Tmax": {
        type: Number,
        required: true
    },

    "T_mean": {
        type: Number,
        required: true
    },

    "ET0": {
        type: Number,
        required: true
    },

    "u2": {
        type: Number,
        required: true
    },

    "Rain_Prob": {
        type: Number,
        required: true
    },

    "WeatherCode": {
        type: Number,
        required: true
    },

    "Status": {
        type: String,
        required: true
    }
},
{
    _id: false
});

const DayForecastSchema = new mongoose.Schema(
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

    generatedAt: {
        type: Date,
        default: Date.now
    },

    forecast: {
        type: [DailyForecastSchema],
        default: []
    }
},
{
    collection: "day_forecast",
    timestamps: true
});

module.exports = mongoose.model(
    "DayForecast",
    DayForecastSchema
);