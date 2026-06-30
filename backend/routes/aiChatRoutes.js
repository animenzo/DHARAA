// backend/routes/aiChatRoutes.js

const express = require("express");
const router = express.Router();
const { chat } = require("../controllers/aiController");
const auth = require("../middleware/auth");

// POST /api/ai/chat  — protected: user must be logged in
router.post("/", auth, chat);

module.exports = router;