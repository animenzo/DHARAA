const mongoose = require("mongoose");

const HourlyForecastSchema = new mongoose.Schema(
{
    "Date": {
        type: Date,
        required: true
    },

    "Time": {
        type: String,
        required: true
    },

    "temperature": {
        type: Number,
        required: true
    },

    "Wind_10m_kmh": {
        type: Number,
        required: true
    },

    "Rainfall_mm": {
        type: Number,
        required: true
    },

    "Rain_Probability_%": {
        type: Number,
        required: true
    }
},
{
    _id: false
});

const HourlyWeatherForecastSchema = new mongoose.Schema(
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
        type: [HourlyForecastSchema],
        default: []
    }
},
{
    collection: "hourly_weather_forecast",
    timestamps: true
});

module.exports = mongoose.model(
    "HourlyWeatherForecast",
    HourlyWeatherForecastSchema
);