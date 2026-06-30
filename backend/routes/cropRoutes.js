// backend/routes/cropRoutes.js
// NOTE: This is a NEW file for AI crop prediction.
// Your existing farmRoutes.js is completely untouched.

const express = require("express");
const router = express.Router();
const { predictCrop, predictCropEasy } = require("../controllers/cropController");
const auth = require("../middleware/auth");

// POST /api/ai/crop/predict — Advanced mode (N/P/K/pH/etc.)
router.post("/predict", auth, predictCrop);

// POST /api/ai/crop/easy-predict — Easy mode (state/soil-look/water-source)
router.post("/easy-predict", auth, predictCropEasy);

module.exports = router;