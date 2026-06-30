// backend/routes/irrigationRoutes.js

const express = require("express");
const router  = express.Router();
const { irrigationAdvice } = require("../controllers/irrigationController");
const auth = require("../middleware/auth");

router.post("/advise", auth, irrigationAdvice);

module.exports = router;