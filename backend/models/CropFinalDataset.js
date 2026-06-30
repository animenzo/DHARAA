const mongoose = require("mongoose");

const CropFinalDatasetSchema = new mongoose.Schema(
{
    "Crop": {
        type: String,
        required: true,
        unique: true
    },

    "Init. (Lini)": Number,
    "Dev. (Ldev)": Number,
    "Mid (Lmid)": Number,
    "Late (Llate)": Number,
    "Total_days": Number,

    "Kc ini": Number,
    "Kc mid": Number,
    "Kc end": Number,

    "Maximum Crop Height (h) (m)": Number,

    "Plant Date": String,

    "Min_Root": Number,
    "Mid-Dev Root Depth": Number,
    "Max_Root": Number,

    "p (MAD)": Number
},
{
    collection: "crop_final_dataset",
    strict: false,
    timestamps: false
}
);

module.exports = mongoose.model(
    "CropFinalDataset",
    CropFinalDatasetSchema
);