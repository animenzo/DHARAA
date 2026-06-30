const cron = require("node-cron");
const Farm = require("../models/Farm");
const {
  buildSmartIrrigationPayload,
  generateAndStoreForFarm,
} = require("./smartIrrigationFarmSyncService");

const DAILY_CRON = "33 10 * * *";
const DEFAULT_TIMEZONE = process.env.DHARAA_CRON_TIMEZONE || "Asia/Kolkata";

let dailyGenerationTask = null;
let isRunning = false;

async function getActiveFarms() {
  return Farm.find({ status: "Active" })
    .populate("current_crop")
    .populate("soilType")
    .populate("device")
    .lean();
}

async function generateForActiveFarm(farm) {
  if (!farm.device || !farm.device.deviceId) {
    return {
      farmId: farm._id,
      skipped: true,
      reason: "No device linked to farm",
    };
  }

  const payloadPreview = await buildSmartIrrigationPayload(farm, {
    deviceId: farm.device.deviceId,
  });
  const result = await generateAndStoreForFarm({
    farmId: farm._id,
    deviceId: farm.device.deviceId,
  });

  return {
    farmId: farm._id,
    deviceId: farm.device.deviceId,
    skipped: false,
    moistureThreshold: payloadPreview.moisture_threshold,
    sensorValue: payloadPreview.sensor_value,
    storedCounts: result.storedCounts,
  };
}

async function runDailyGeneration() {
  if (isRunning) {
    return {
      skipped: true,
      reason: "Daily DHARAA generation is already running",
    };
  }

  isRunning = true;
  const startedAt = new Date();
  const summary = {
    startedAt,
    completedAt: null,
    totalFarms: 0,
    processed: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  try {
    const farms = await getActiveFarms();
    summary.totalFarms = farms.length;

    for (const farm of farms) {
      try {
        const result = await generateForActiveFarm(farm);
        summary.results.push(result);

        if (result.skipped) {
          summary.skipped += 1;
        } else {
          summary.processed += 1;
        }
      } catch (error) {
        summary.failed += 1;
        summary.results.push({
          farmId: farm._id,
          skipped: false,
          error: error.message,
        });
        console.error(
          `[dharaaDailyGenerationManager] Farm ${farm._id} failed:`,
          error.message
        );
      }
    }

    return summary;
  } finally {
    summary.completedAt = new Date();
    isRunning = false;
    console.log("[dharaaDailyGenerationManager] Daily generation summary:", summary);
  }
}

function startDharaaDailyGenerationManager() {
  if (dailyGenerationTask) return dailyGenerationTask;

  dailyGenerationTask = cron.schedule(
    DAILY_CRON,
    () => {
      runDailyGeneration().catch((error) => {
        console.error("[dharaaDailyGenerationManager] Daily generation failed:", error.message);
      });
    },
    {
      scheduled: true,
      timezone: DEFAULT_TIMEZONE,
    }
  );

  console.log(
    `[dharaaDailyGenerationManager] Scheduled DHARAA daily generation at 6:00 AM (${DEFAULT_TIMEZONE})`
  );

  return dailyGenerationTask;
}

function stopDharaaDailyGenerationManager() {
  if (!dailyGenerationTask) return;

  dailyGenerationTask.stop();
  dailyGenerationTask = null;
}

module.exports = {
  runDailyGeneration,
  startDharaaDailyGenerationManager,
  stopDharaaDailyGenerationManager,
};
