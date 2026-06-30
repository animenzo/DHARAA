const mongoose = require("mongoose");

const SoilDatasetSchema = new mongoose.Schema(
{
    "Soil type": {
        type: String,
        required: true,
        unique: true
    },

    "FC (v%)": {
        type: Number,
        required: true
    },

    "PWP (v%)": {
        type: Number,
        required: true
    },

    "AWC": {
        type: Number,
        required: true
    }
},
{
    collection: "soil_dataset",
    strict: false,
    timestamps: false
}
);

module.exports = mongoose.model("SoilDataset", SoilDatasetSchema);