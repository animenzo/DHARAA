// backend/routes/diseaseRoutes.js

const express = require("express");
const router = express.Router();
const multer = require("multer");
const { predictDisease } = require("../controllers/diseaseController");
const auth = require("../middleware/auth");

// Store image in memory (no disk I/O) — we stream it straight to FastAPI
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"), false);
    }
  },
});

// POST /api/ai/disease/predict  — protected
router.post("/predict", auth, upload.single("file"), predictDisease);

module.exports = router;