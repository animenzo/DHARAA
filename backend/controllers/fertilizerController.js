// backend/controllers/fertilizerController.js

const Farm = require("../models/Farm");
const { getFertilizerAdvice } = require("../services/aiService");

/**
 * POST /api/ai/fertilizer/advise
 * Body: { farmId, growth_stage, soil_ph, language }
 */
const fertilizerAdvice = async (req, res) => {
  try {
    const {
      farmId,
      growth_stage = "vegetative",
      soil_ph,
      language = "en",
    } = req.body;

    if (!farmId) {
      return res.status(400).json({ error: "farmId is required." });
    }

    const farm = await Farm.findOne({ _id: farmId, user: req.user.id });
    if (!farm) {
      return res.status(404).json({ error: "Farm not found." });
    }

    const payload = {
      crop:         farm.current_crop,
      soil_type:    farm.soilType   || "loam",
      size_acres:   farm.size_acres || 1.0,
      growth_stage,
      soil_ph:      soil_ph ? parseFloat(soil_ph) : null,
      language,
    };

    const data = await getFertilizerAdvice(payload);

    return res.status(200).json({
      success:      true,
      farm_name:    farm.name,
      current_crop: farm.current_crop,
      growth_stage,
      ...data,
    });
  } catch (err) {
    console.error("[fertilizerController] Error:", err.message);

    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return res.status(503).json({ error: "AI service temporarily unavailable." });
    }
    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = { fertilizerAdvice };