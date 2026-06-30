// backend/routes/fertilizerRoutes.js

const express = require("express");
const router  = express.Router();
const { fertilizerAdvice } = require("../controllers/fertilizerController");
const auth = require("../middleware/auth");

router.post("/advise", auth, fertilizerAdvice);

module.exports = router;