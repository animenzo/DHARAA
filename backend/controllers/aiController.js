// backend/controllers/aiController.js

const { sendChatMessage } = require("../services/aiService");

/**
 * POST /api/ai/chat
 * Body: { message: string, language: "en"|"hi", history: [], context: {} }
 */
const chat = async (req, res) => {
  try {
    const { message, language = "en", history = [], context = {} } = req.body;

    if (!message || typeof message !== "string" || message.trim() === "") {
      return res.status(400).json({ error: "message is required." });
    }

    if (message.trim().length > 1000) {
      return res.status(400).json({ error: "Message too long (max 1000 chars)." });
    }

    const data = await sendChatMessage(message.trim(), language, history, context);

    return res.status(200).json({
      success: true,
      reply: data.reply,
      language: data.language,
      intent: data.intent || null,
      crop_guidance: data.crop_guidance || null,
    });
  } catch (err) {
    console.error("[aiController.chat] Error:", err.message);

    // If FastAPI is down, return a graceful fallback
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return res.status(503).json({
        error: "AI service is temporarily unavailable. Please try again shortly.",
      });
    }

    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = { chat };