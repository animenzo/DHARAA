// backend/routes/weatherRoutes.js

const express = require("express");
const router  = express.Router();
const { weatherAdvice } = require("../controllers/weatherController");
const auth = require("../middleware/auth");

router.post("/advise", auth, weatherAdvice);

module.exports = router;