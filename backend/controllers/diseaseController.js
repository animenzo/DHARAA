// backend/controllers/diseaseController.js

const { detectPlantDisease } = require("../services/aiService");

/**
 * POST /api/ai/disease/predict
 * multipart/form-data: file (image), language ("en"|"hi")
 */
const predictDisease = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file uploaded." });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res
        .status(400)
        .json({ error: "Only JPEG, PNG, and WEBP images are accepted." });
    }

    // 5MB limit check (multer config also enforces this)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: "Image must be under 5MB." });
    }

    const language = req.body.language || "en";

    const data = await detectPlantDisease(
      req.file.buffer,
      req.file.mimetype,
      language
    );

    return res.status(200).json({ success: true, ...data });
  } catch (err) {
    console.error("[diseaseController.predictDisease] Error:", err.message);

    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return res.status(503).json({
        error: "AI service is temporarily unavailable.",
      });
    }

    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = { predictDisease };