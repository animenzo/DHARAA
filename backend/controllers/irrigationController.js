// backend/controllers/irrigationController.js

const Farm = require("../models/Farm");
const Schedule = require("../models/Schedule");
const DeviceLog = require("../models/DeviceLog");
const SensorData = require("../models/SensorData");
const Device = require("../models/Device");

const { getIrrigationAdvice } = require("../services/aiService");

/**
 * POST /api/ai/irrigation/advise
 * Body: { farmId, language }
 *
 * Enriches the request with real MongoDB data before calling FastAPI.
 */
const irrigationAdvice = async (req, res) => {
  try {
    const { farmId, language = "en" } = req.body;

    if (!farmId) {
      return res.status(400).json({ error: "farmId is required." });
    }

    // ── 1. Fetch farm (must belong to this user) ───────────────────────
    const farm = await Farm.findOne({ _id: farmId, user: req.user.id });
    if (!farm) {
      return res.status(404).json({ error: "Farm not found." });
    }

    // ── 2. Fetch most recent DeviceLog for live sensor data ────────────
    const device = await Device.findOne({
      farm: farm._id,
      user: req.user.id,
    }).lean();

    const latestReading = device
      ? await SensorData.findOne({
        device: device._id,
      })
        .sort({ recordedAt: -1 })
        .lean()
      : null;

    let soilMoisture = null;

    if (
      latestReading?.avgMoisture !== null &&
      latestReading?.avgMoisture !== undefined
    ) {
      soilMoisture = latestReading.avgMoisture;
    }

    // ── 3. Fetch active schedules for this farm ────────────────────────
    const schedule = await Schedule.findOne({
      farmId: farm._id,
      status: "Active",
    })
      .sort({ updatedAt: -1 })
      .lean();

    // ── 4. Build payload for FastAPI ───────────────────────────────────
    const payload = {
      farm_name: farm.name,
      current_crop: farm.current_crop,
      soil_type: farm.soilType || "loam",
      size_acres: farm.size_acres || 1.0,
      soil_moisture: soilMoisture,
      last_irrigation: farm.lastIrrigation
        ? farm.lastIrrigation.toISOString()
        : null,
      schedule_days: schedule?.days || null,
      schedule_time: schedule?.time || null,
      schedule_duration: schedule?.duration || null,
      language,
    };

    const data = await getIrrigationAdvice(payload);

    return res.status(200).json({
      success: true,
      farm_name: farm.name,
      current_crop: farm.current_crop,
      sensor_used: soilMoisture !== null,
      ...data,
    });
  } catch (err) {
    console.error("[irrigationController] Error:", err.message);

    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return res.status(503).json({ error: "AI service temporarily unavailable." });
    }
    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = { irrigationAdvice };