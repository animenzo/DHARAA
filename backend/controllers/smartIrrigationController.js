const Farm = require("../models/Farm");
const SensorData = require("../models/SensorData");
const Device = require("../models/Device");
const IrrigationExecution = require("../models/IrrigationExecution");
const CropSchedule = require("../models/CropSchedule");
const FutureMoisturePrediction = require("../models/FutureMoisturePrediction");
const DayForecast = require("../models/DayForecast");
const HourlyWeatherForecast = require("../models/HourlyWeatherForecast");
const FarmIrrigationSchedule = require("../models/FarmIrrigationSchedule");
const IrrigationWaterRequirement = require("../models/IrrigationWaterRequirement");
const { getIrrigationRecommendation } = require("../services/smartIrrigationService");
const { manualStopExecution } = require("../services/irrigationExecutionManager");
const {
  buildSmartIrrigationPayload,
  storeSmartIrrigationResult,
} = require("../services/smartIrrigationFarmSyncService");
const { calculateTankCapacityLiters } = require("../utils/tankCalculations");

const DEFAULT_LOCATION = {
  latitude: 26.9124,
  longitude: 75.7873,
};

function toIsoDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  if (Number.isNaN(date.getTime())) {
    return fallback.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function getCropName(crop) {
  if (!crop) return "Wheat";
  if (typeof crop === "string") return crop;
  return crop.Crop || crop.name || "Wheat";
}

function getSoilTexture(soil) {
  if (!soil) return "Loamy";
  if (typeof soil === "string") return soil;
  return soil["Soil type"] || soil.name || "Loamy";
}

function calculateFieldAreaM2(farm) {
  const dimensions = farm.farmDimensions || {};

  if (farm.farmShape === "rectangle") {
    const length = Number(dimensions.length);
    const width = Number(dimensions.width);
    if (length > 0 && width > 0) return length * width;
  }

  if (farm.farmShape === "circle") {
    const diameter = Number(dimensions.diameter);
    if (diameter > 0) {
      const radius = diameter / 2;
      return Math.PI * radius * radius;
    }
  }

  return 1000;
}

function calculateTankWaterLiter(farm) {
  return Number(farm.totalCapacityLiters) ||
    calculateTankCapacityLiters(farm.tankDetails) ||
    1000;
}

function normalizeMoistureFraction(value) {
  const moisture = Number(value);
  if (!Number.isFinite(moisture)) return 0.35;
  if (moisture > 1) return Math.min(moisture, 100) / 100;
  return Math.min(Math.max(moisture, 0), 1);
}

/**
 * POST /api/ai/smart-irrigation/recommendation
 * Body: { farmId, forecast_days?, moisture_threshold?, irrigation_cycle_days?, buffer_percent_of_fc? }
 */
const smartIrrigationRecommendation = async (req, res) => {
  try {
    const {
      farmId,
      forecast_days = 10,
      moisture_threshold = 0,
      irrigation_cycle_days = 1,
      buffer_percent_of_fc = 10,
    } = req.body;

    if (!farmId) {
      return res.status(400).json({ error: "farmId is required." });
    }

    const farm = await Farm.findOne({ _id: farmId, user: req.user.id })
      .populate("current_crop")
      .populate("soilType")
      .lean();

    if (!farm) {
      return res.status(404).json({ error: "Farm not found." });
    }

    const device = await Device.findOne({ farm: farm._id, user: req.user.id }).lean();
    const latestReading = device
      ? await SensorData.findOne({ device: device._id })
        .sort({ recordedAt: -1 })
        .lean()
      : null;

    const payload = await buildSmartIrrigationPayload(farm, {
      deviceId: device?.deviceId,
      forecastDays: Number(forecast_days),
      moistureThreshold: Number(moisture_threshold) > 0
        ? normalizeMoistureFraction(moisture_threshold)
        : undefined,
      irrigationCycleDays: Number(irrigation_cycle_days),
      bufferFractionOfFc: Number(buffer_percent_of_fc) > 1
        ? Number(buffer_percent_of_fc) / 100
        : Number(buffer_percent_of_fc),
    });

    const recommendation = await getIrrigationRecommendation(payload);
    const storedCounts = device
      ? await storeSmartIrrigationResult({
        farm,
        deviceId: device.deviceId,
        result: recommendation,
        latestSensorReading: latestReading,
      })
      : null;

    return res.status(200).json({
      success: true,
      farmId: farm._id,
      farm_name: farm.name,
      sensor_used: Boolean(
        latestReading?.moistureSensors?.length
      ),
      request_payload: payload,
      storedCounts,
      recommendation,
    });
  } catch (err) {
    console.error("[smartIrrigationController] Error:", err.message);

    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return res.status(503).json({
        error: "Smart irrigation service temporarily unavailable.",
      });
    }

    if (err.response) {
      return res.status(err.response.status || 502).json({
        error: "Smart irrigation service returned an error.",
        detail: err.response.data,
      });
    }

    return res.status(500).json({ error: "Internal server error." });
  }
};

const listIrrigationExecutions = async (req, res) => {
  try {
    const { farmId, status } = req.query;
    const query = { user: req.user.id };
    if (farmId) query.farm = farmId;
    if (status) query.status = status;

    const executions = await IrrigationExecution.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({ success: true, executions });
  } catch (err) {
    console.error("[smartIrrigationController] list executions:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const getSmartIrrigationResult = async (req, res) => {
  try {
    const farm = await Farm.findOne({ _id: req.params.farmId, user: req.user.id }).select("_id name").lean();
    if (!farm) return res.status(404).json({ error: "Farm not found." });
    const selector = { farm: farm._id };
    const [cropSchedule, prediction, dayForecast, hourlyForecast, schedule, waterRequirement, execution] =
      await Promise.all([
        CropSchedule.findOne(selector).lean(),
        FutureMoisturePrediction.findOne(selector).lean(),
        DayForecast.findOne(selector).lean(),
        HourlyWeatherForecast.findOne(selector).lean(),
        FarmIrrigationSchedule.findOne(selector).lean(),
        IrrigationWaterRequirement.findOne(selector).lean(),
        IrrigationExecution.findOne(selector).sort({ createdAt: -1 }).lean(),
      ]);
    return res.json({
      success: true,
      farm: { id: farm._id, name: farm.name },
      prediction: { cropSchedule, futureMoisture: prediction, dayForecast, hourlyForecast },
      schedule,
      waterRequirement,
      execution,
    });
  } catch (err) {
    console.error("[smartIrrigationController] get result:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }
};

const manualStopIrrigation = async (req, res) => {
  try {
    const execution = await manualStopExecution(req.params.executionId, req.user.id);
    return res.status(200).json({ success: true, execution });
  } catch (err) {
    console.error("[smartIrrigationController] manual stop:", err.message);
    return res.status(400).json({ error: err.message });
  }
};

module.exports = {
  smartIrrigationRecommendation,
  listIrrigationExecutions,
  getSmartIrrigationResult,
  manualStopIrrigation,
};
