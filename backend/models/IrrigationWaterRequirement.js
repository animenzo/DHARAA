const mongoose = require("mongoose");

const irrigationWaterRequirementSchema =
new mongoose.Schema({

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

    required_theta: Number,

    irrigation_percent: Number,

    required_water_liter: Number,

    water_sufficient: Boolean,

    future_rain_probability: Number,

    reason: String,

    generatedAt: {
        type: Date,
        default: Date.now
    }
},
{
    timestamps: true,
    strict: false
});

irrigationWaterRequirementSchema.index({ farm: 1, deviceId: 1 });

module.exports = mongoose.model(
    "IrrigationWaterRequirement",
    irrigationWaterRequirementSchema
);
