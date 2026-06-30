const CropSchedule = require("../models/CropSchedule");
const FutureMoisturePrediction = require("../models/FutureMoisturePrediction");
const DayForecast = require("../models/DayForecast");
const HourlyWeatherForecast = require("../models/HourlyWeatherForecast");
const FarmIrrigationSchedule = require("../models/FarmIrrigationSchedule");
const IrrigationWaterRequirement = require("../models/IrrigationWaterRequirement");
const TodayState = require("../models/TodayState");
const Farm = require("../models/Farm");
const Device = require("../models/Device");
const SensorData = require("../models/SensorData");
// Register populate targets regardless of route/module load order.
require("../models/CropFinalDataset");
require("../models/SoilDataset");
const { getIrrigationRecommendation } = require("./smartIrrigationService");
const { createExecutionFromRecommendation } = require("./irrigationExecutionManager");
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

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
    100;
}

function normalizeMoistureFraction(value) {
  const moisture = Number(value);
  if (!Number.isFinite(moisture)) return 0.35;
  if (moisture > 1) return Math.min(moisture, 100) / 100;
  return Math.min(Math.max(moisture, 0), 1);
}

function valuesChanged(left, right) {
  return String(left ?? "") !== String(right ?? "");
}

function sameDate(left, right) {
  const leftDate = toDate(left);
  const rightDate = toDate(right);
  if (!leftDate || !rightDate) return leftDate === rightDate;
  return leftDate.toISOString().slice(0, 10) === rightDate.toISOString().slice(0, 10);
}

function compact(items) {
  return items.filter(Boolean);
}

function calculateMoistureThreshold(farm) {
    const fc = Number(
        farm.soilType?.["FC (v%)"]
    );

    const pwp = Number(
        farm.soilType?.["PWP (v%)"]
    );

    const mad = Number(
        farm.current_crop?.["p (MAD)"]
    );

    if (
        !Number.isFinite(fc) ||
        !Number.isFinite(pwp) ||
        !Number.isFinite(mad)
    ) {
        return 0.35;
    }

    const awc = fc - pwp;

    const thresholdPercent =
        fc - (mad * awc);

    return thresholdPercent / 100;
}

async function findFarmDevice(farm, deviceId = null) {
  if (farm.device && farm.device._id) return farm.device;

  if (deviceId) {
    return Device.findOne({ deviceId }).lean();
  }

  return Device.findOne({ farm: farm._id }).lean();
}

async function getLatestSensorReading(farm, device = null) {
  const farmDevice = device || await findFarmDevice(farm);

  if (!farmDevice?._id) {
    console.log("SENSOR_DATA_NOT_FOUND");
    return null;
  }

  const latestSensorReading = await SensorData.findOne({ device: farmDevice._id })
    .sort({ recordedAt: -1 })
    .lean();

  if (!latestSensorReading) {
    console.log("SENSOR_DATA_NOT_FOUND");
  }

  return latestSensorReading;
}

async function buildSmartIrrigationPayload(farm, options = {}) {
  const device = await findFarmDevice(farm, options.deviceId);
  const latestSensorReading = await getLatestSensorReading(farm, device);
  if (!device) throw new Error(`No device is linked to farm ${farm._id}.`);
  if (!latestSensorReading) throw new Error(`No sensor data is available for device ${device.deviceId}.`);
  if (!farm.current_crop || typeof farm.current_crop !== "object") {
    throw new Error("Farm crop master data was not populated.");
  }
  if (!farm.soilType || typeof farm.soilType !== "object") {
    throw new Error("Farm soil master data was not populated.");
  }

  const tankCapacityLiters = calculateTankWaterLiter(farm);
  const waterLevelPercent = Number(latestSensorReading.waterLevelPercent ?? latestSensorReading.waterLevel);
  const currentWaterLiters = Number(latestSensorReading.currentWaterLiters);
  const tankWaterLiters = Number.isFinite(currentWaterLiters)
    ? currentWaterLiters
    : Number.isFinite(waterLevelPercent)
    ? tankCapacityLiters * Math.min(Math.max(waterLevelPercent, 0), 100) / 100
    : tankCapacityLiters;

  return {
    schemaVersion: "1.0",
    farm: {
      id: farm._id.toString(),
      latitude: Number(farm.coordinates?.lat) || DEFAULT_LOCATION.latitude,
      longitude: Number(farm.coordinates?.lng) || DEFAULT_LOCATION.longitude,
      areaM2: calculateFieldAreaM2(farm),
      sowingDate: toIsoDate(farm.dateOfSowing),
      irrigationMethod: farm.irrigationMethod,
      season: farm.season || "kharif",
    },
    device: {
      id: device._id.toString(),
      deviceId: device.deviceId,
      status: device.status || "unknown",
      pumpStatus: Number(latestSensorReading.pump) || 0,
    },
    sensorData: {
      moistureFraction: normalizeMoistureFraction(latestSensorReading.avgMoisture),
      tankWaterLiters,
      waterLevelPercent: Number.isFinite(waterLevelPercent) ? waterLevelPercent : null,
      recordedAt: latestSensorReading.recordedAt?.toISOString?.() || null,
    },
    crop: farm.current_crop,
    soil: farm.soilType,
    weatherConfig: {
      forecastDays: Number(options.forecastDays || 14),
      provider: "open-meteo",
    },
    calculationConfig: {
      predictionDate: toIsoDate(null),
      moistureThreshold: options.moistureThreshold ?? calculateMoistureThreshold(farm),
      irrigationCycleDays: Number(options.irrigationCycleDays || 4),
      bufferFractionOfFc: Number(options.bufferFractionOfFc ?? 0.25),
    },
  };
}

function mapCropSchedule(rows) {
  return compact((rows || []).map((row) => {
    const Date = toDate(row.Date);
    if (!Date) return null;

    return {
      Date,
      DayAfterSowing: Number(row.DayAfterSowing),
      Kc: Number(row.Kc),
      RootDepth_m: Number(row.RootDepth_m),
      TAW_mm: Number(row.TAW_mm),
    };
  }));
}

function mapFutureMoisturePrediction(rows) {
  return compact((rows || []).map((row) => {
    const Date = toDate(row.Date);
    if (!Date) return null;

    return {
      Date,
      DayAfterSowing: Number(row.DayAfterSowing),
      ET0: row.ET0 === null || row.ET0 === undefined ? null : Number(row.ET0),
      ETc: row.ETc === null || row.ETc === undefined ? null : Number(row.ETc),
      Kc: row.Kc === null || row.Kc === undefined ? null : Number(row.Kc),
      RootDepth_m: row.RootDepth_m === null || row.RootDepth_m === undefined ? null : Number(row.RootDepth_m),
      total_evoporation:
        row.total_evoporation === null || row.total_evoporation === undefined
          ? null
          : Number(row.total_evoporation),
      Physics_Moisture:
        row.Physics_Moisture === null || row.Physics_Moisture === undefined
          ? null
          : Number(row.Physics_Moisture),
    };
  }));
}

function mapDayForecast(rows) {
  return compact((rows || []).map((row) => {
    const date = toDate(row.date);
    if (!date) return null;

    return {
      date,
      Tmin: Number(row.Tmin),
      Tmax: Number(row.Tmax),
      T_mean: Number(row.T_mean),
      ET0: Number(row.ET0),
      u2: Number(row.u2),
      Rain_Prob: Number(row.Rain_Prob),
      WeatherCode: Number(row.WeatherCode),
      Status: row.Status || "Forecast",
    };
  }));
}

function mapHourlyForecast(rows) {
  return compact((rows || []).map((row) => {
    const Date = toDate(row.Date);
    if (!Date) return null;

    return {
      Date,
      Time: String(row.Time),
      temperature: Number(row.temperature),
      Wind_10m_kmh: Number(row.Wind_10m_kmh),
      Rainfall_mm: Number(row.Rainfall_mm),
      "Rain_Probability_%": Number(row["Rain_Probability_%"]),
    };
  }));
}

function shouldRegenerateCropSchedule(existingSchedule, farm, deviceId) {
  if (!existingSchedule) return true;

  return (
    valuesChanged(existingSchedule.CropName, getCropName(farm.current_crop)) ||
    valuesChanged(existingSchedule.SoilTexture, getSoilTexture(farm.soilType)) ||
    !sameDate(existingSchedule.SowingDate, farm.dateOfSowing) ||
    valuesChanged(existingSchedule.deviceId, deviceId)
  );
}

function normalizeSchedulePayload(schedule) {
  if (!schedule || typeof schedule !== "object") return null;

  return {
    ...schedule,
    trigger_date: toDate(schedule.trigger_date),
    selected_date: toDate(schedule.selected_date),
    rain_hold_until: toDate(schedule.rain_hold_until),
    generatedAt: new Date(),
  };
}

function normalizeWaterRequirementPayload(waterRequirement) {
  if (!waterRequirement || typeof waterRequirement !== "object") return null;

  return {
    ...waterRequirement,
    generatedAt: new Date(),
  };
}

async function createTodayState({ farm, deviceId, futureMoisturePrediction, sensorMoisture }) {
  const physicsRow = futureMoisturePrediction[1];
  if (!physicsRow) return null;

  const physicsMoisture =
    physicsRow.Physics_Moisture === null || physicsRow.Physics_Moisture === undefined
      ? null
      : Number(physicsRow.Physics_Moisture);
  const normalizedSensorMoisture =
    sensorMoisture === null || sensorMoisture === undefined
      ? null
      : normalizeMoistureFraction(sensorMoisture);

  return TodayState.create({
    farm: farm._id,
    deviceId,
    Date: physicsRow.Date || new Date(),
    Timestamp: new Date(),
    DayAfterSowing: Number(physicsRow.DayAfterSowing),
    ET0: physicsRow.ET0,
    Kc: physicsRow.Kc,
    ETc: physicsRow.ETc,
    RootDepth_m: physicsRow.RootDepth_m,
    total_evoporation: physicsRow.total_evoporation,
    Physics_Moisture: physicsMoisture,
    Sensor_Moisture: normalizedSensorMoisture,
    Error:
      normalizedSensorMoisture !== null && physicsMoisture !== null
        ? normalizedSensorMoisture - physicsMoisture
        : null,
  });
}

async function storeSmartIrrigationResult({ farm, deviceId, result, latestSensorReading = null }) {
  console.log("[Node → MongoDB] STORING SMART-IRRIGATION RESULT", {
    farmId: farm._id.toString(),
    deviceId,
    scheduleStatus: result.schedule?.status,
    selectedDate: result.schedule?.selected_date,
    selectedTime: result.schedule?.selected_time,
    requiredWaterLiter: result.waterRequirement?.required_water_liter,
    executionStatus: result.execution?.status,
  });
  const farmId = farm._id;
  const device = await Device.findOne({ deviceId }).lean();
  if (!device) {
    throw new Error(`Device not found for smart irrigation execution: ${deviceId}`);
  }

  const prediction = result.prediction || {};
  const cropSchedule = mapCropSchedule(prediction.cropSchedule);
  const futureMoisturePrediction = mapFutureMoisturePrediction(prediction.futureMoisture);
  const dayForecast = mapDayForecast(prediction.dayForecast);
  const hourlyForecast = mapHourlyForecast(prediction.hourlyForecast);
  const existingCropSchedule = await CropSchedule.findOne({
    farm: farmId,
    deviceId,
  }).lean();
  const shouldStoreCropSchedule = shouldRegenerateCropSchedule(existingCropSchedule, farm, deviceId);
  const dailySelector = {
    farm: farmId,
    deviceId,
  };
  const schedulePayload = normalizeSchedulePayload(result.schedule);
  const waterRequirementPayload = normalizeWaterRequirementPayload(result.waterRequirement);
  const moistureValues = (latestSensorReading?.moistureSensors || [])
    .map((sensor) => Number(sensor?.value))
    .filter(Number.isFinite);
  const hasStoredAverage = latestSensorReading?.avgMoisture !== null &&
    latestSensorReading?.avgMoisture !== undefined;
  const storedAverage = hasStoredAverage ? Number(latestSensorReading.avgMoisture) : null;
  const sensorMoisture = Number.isFinite(storedAverage)
    ? storedAverage
    : moistureValues.length
      ? moistureValues.reduce((sum, value) => sum + value, 0) / moistureValues.length
      : null;

  const writeTasks = [
    FutureMoisturePrediction.findOneAndUpdate(
      { farm: farmId, deviceId },
      {
        farm: farmId,
        deviceId,
        generatedAt: new Date(),
        predictions: futureMoisturePrediction,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    DayForecast.findOneAndUpdate(
      { farm: farmId, deviceId },
      {
        farm: farmId,
        deviceId,
        generatedAt: new Date(),
        forecast: dayForecast,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    HourlyWeatherForecast.findOneAndUpdate(
      { farm: farmId, deviceId },
      {
        farm: farmId,
        deviceId,
        generatedAt: new Date(),
        forecast: hourlyForecast,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
  ];

  if (shouldStoreCropSchedule) {
    writeTasks.push(
      CropSchedule.findOneAndUpdate(
        { farm: farmId, deviceId },
        {
          farm: farmId,
          deviceId,
          CropName: getCropName(farm.current_crop),
          SoilTexture: getSoilTexture(farm.soilType),
          SowingDate: farm.dateOfSowing,
          schedule: cropSchedule,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    );
  }

  if (schedulePayload) {
    writeTasks.push(
      FarmIrrigationSchedule.findOneAndUpdate(
        dailySelector,
        {
          farm: farmId,
          deviceId,
          ...schedulePayload,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    );
  }

  if (waterRequirementPayload) {
    writeTasks.push(
      IrrigationWaterRequirement.findOneAndUpdate(
        dailySelector,
        {
          farm: farmId,
          deviceId,
          ...waterRequirementPayload,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    );
  }

  writeTasks.push(
    createTodayState({
      farm,
      deviceId,
      futureMoisturePrediction,
      sensorMoisture,
    })
  );

  await Promise.all(writeTasks);

  const execution = await createExecutionFromRecommendation({
    farm,
    device,
    result: {
      schedule: result.schedule,
      water_requirement: result.waterRequirement,
      inputs: {
        moisture_threshold: result.execution?.targetMoisturePercent,
      },
    },
  });

  console.log("[MongoDB → Node] SMART-IRRIGATION RESULT STORED", {
    farmId: farmId.toString(),
    deviceId,
    executionId: execution?._id?.toString() || null,
  });

  return {
    cropSchedule: shouldStoreCropSchedule ? cropSchedule.length : "unchanged",
    futureMoisturePrediction: futureMoisturePrediction.length,
    dayForecast: dayForecast.length,
    hourlyForecast: hourlyForecast.length,
    farmIrrigationSchedule: schedulePayload ? 1 : 0,
    irrigationWaterRequirement: waterRequirementPayload ? 1 : 0,
    todayState: futureMoisturePrediction[1] ? 1 : 0,
    irrigationExecution: execution ? execution._id : null,
  };
}

async function generateAndStoreForFarm({ farmId, deviceId }) {
  const farm = await Farm.findById(farmId)
    .populate("current_crop")
    .populate("soilType")
    .populate("device")
    .lean();

  if (!farm) {
    throw new Error(`Farm not found: ${farmId}`);
  }

  const device =
    farm.device && farm.device.deviceId
      ? farm.device
      : await Device.findOne({ deviceId }).lean();
  const latestSensorReading = await getLatestSensorReading(farm, device);
  const payload = await buildSmartIrrigationPayload(farm, { deviceId });
  console.log(
    "Payload sent to Python:",
    JSON.stringify(payload, null, 2)
);
  const result = await getIrrigationRecommendation(payload);
  const storedCounts = await storeSmartIrrigationResult({
    farm,
    deviceId,
    result,
    latestSensorReading,
  });

  return {
    payload,
    storedCounts,
    hasExpectedShape: Boolean(
      Array.isArray(result.prediction?.cropSchedule) &&
      Array.isArray(result.prediction?.futureMoisture) &&
      Array.isArray(result.prediction?.dayForecast) &&
      Array.isArray(result.prediction?.hourlyForecast) &&
      result.schedule &&
      result.waterRequirement !== undefined
    ),
  };
}

module.exports = {
  buildSmartIrrigationPayload,
  calculateMoistureThreshold,
  generateAndStoreForFarm,
  getLatestSensorReading,
  storeSmartIrrigationResult,
};
