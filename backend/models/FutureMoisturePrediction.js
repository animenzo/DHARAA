const mongoose = require("mongoose");

const PredictionDaySchema = new mongoose.Schema(
{
    "Date": {
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

    "ETc": {
        type: Number,
        default: null
    },

    "Kc": {
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
    }
},
{
    _id: false
});

const FutureMoisturePredictionSchema = new mongoose.Schema(
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

    predictions: {
        type: [PredictionDaySchema],
        default: []
    }
},
{
    collection: "future_moisture_prediction",
    timestamps: true
});

module.exports = mongoose.model(
    "FutureMoisturePrediction",
    FutureMoisturePredictionSchema
);