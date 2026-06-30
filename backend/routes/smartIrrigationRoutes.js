const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  smartIrrigationRecommendation,
  listIrrigationExecutions,
  getSmartIrrigationResult,
  manualStopIrrigation,
} = require("../controllers/smartIrrigationController");


router.post("/recommendation", auth, smartIrrigationRecommendation);
router.get("/executions", auth, listIrrigationExecutions);
router.get("/result/:farmId", auth, getSmartIrrigationResult);
router.post("/executions/:executionId/stop", auth, manualStopIrrigation);

module.exports = router;
