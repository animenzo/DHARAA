// backend/controllers/cropController.js

const { getCropRecommendation, getEasyCropRecommendation } = require("../services/aiService");

/**
 * POST /api/ai/crop/predict
 * Body: { nitrogen, phosphorus, potassium, temperature, humidity, ph, rainfall, language }
 */
const predictCrop = async (req, res) => {
  try {
    const {
      nitrogen,
      phosphorus,
      potassium,
      temperature,
      humidity,
      ph,
      rainfall,
      language = "en",
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    const fields = { nitrogen, phosphorus, potassium, temperature, humidity, ph, rainfall };
    const missing = Object.entries(fields)
      .filter(([, v]) => v === undefined || v === null || v === "")
      .map(([k]) => k);

    if (missing.length > 0) {
      return res.status(400).json({
        error: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // Check all values are valid numbers
    const parsed = {};
    for (const [key, val] of Object.entries(fields)) {
      const num = parseFloat(val);
      if (isNaN(num)) {
        return res.status(400).json({ error: `${key} must be a number.` });
      }
      parsed[key] = num;
    }

    // Basic range guards
    if (parsed.ph < 0 || parsed.ph > 14) {
      return res.status(400).json({ error: "pH must be between 0 and 14." });
    }
    if (parsed.humidity < 0 || parsed.humidity > 100) {
      return res.status(400).json({ error: "Humidity must be between 0 and 100." });
    }

    const data = await getCropRecommendation({ ...parsed, language });

    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    console.error("[cropController.predictCrop] Error:", err.message);

    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return res.status(503).json({
        error: "AI service is temporarily unavailable.",
      });
    }

    return res.status(500).json({ error: "Internal server error." });
  }
};

/**
 * POST /api/ai/crop/easy-predict
 * Body: { state, district, soil_look, water_source, season, land_size, language }
 *
 * Farmer-friendly crop recommendation — no soil-test numbers required.
 * Only `state` is mandatory; everything else helps Llama reason better
 * but the endpoint degrades gracefully if left blank.
 */
const predictCropEasy = async (req, res) => {
  try {
    const {
      state,
      district = "",
      soil_look = "",
      water_source = "",
      season = "",
      land_size = "",
      language = "en",
    } = req.body;

    if (!state || typeof state !== "string" || state.trim() === "") {
      return res.status(400).json({
        error: language === "hi" ? "कृपया राज्य चुनें।" : "Please select your state.",
      });
    }

    const data = await getEasyCropRecommendation({
      state: state.trim(),
      district,
      soil_look,
      water_source,
      season,
      land_size,
      language,
    });

    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    console.error("[cropController.predictCropEasy] Error:", err.message);

    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return res.status(503).json({
        error: "AI service is temporarily unavailable.",
      });
    }

    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = { predictCrop, predictCropEasy };