"use strict";

const IrrigationExecution = require("../models/IrrigationExecution");
const Device = require("../models/Device");
const SensorData = require("../models/SensorData");
const DayForecast = require("../models/DayForecast");
const Notification = require("../models/Notification");
const { issueCommand } = require("./commandService");
const { isBrokerConnected } = require("./mqttService");
const { emitToUser } = require("./socketService");
const Farm = require("../models/Farm");

// Resolve this lazily because smartIrrigationFarmSyncService also imports this
// manager to create executions. Loading it here eagerly creates a circular
// dependency and leaves the farm-sync exports only partially initialized.
function calculateMoistureThreshold(farm) {
  return require("./smartIrrigationFarmSyncService").calculateMoistureThreshold(farm);
}

const CHECK_INTERVAL_MS = 6000;
const WEATHER_RECHECK_MS = 15 * 60 * 1000;
const PUMP_ON_MS = (parseInt(process.env.IRRIGATION_PUMP_ON_MINUTES, 10) || 4) * 60 * 1000;
const PUMP_OFF_MS = (parseInt(process.env.IRRIGATION_PUMP_OFF_MINUTES, 10) || 2) * 60 * 1000;
const MAX_RUNTIME_MS = (parseInt(process.env.IRRIGATION_MAX_RUNTIME_MINUTES, 10) || 180) * 60 * 1000;
const MIN_SAFE_TANK_LEVEL = parseFloat(process.env.IRRIGATION_MIN_SAFE_TANK_LEVEL_PERCENT || "0");
const CRITICAL_TANK_LEVEL = parseFloat(process.env.IRRIGATION_CRITICAL_TANK_LEVEL_PERCENT || "5");
const THRESHOLD = parseFloat(process.env.IRRIGATION_EMERGENCY_MARGIN_PERCENT || "10");
const THUNDERSTORM_CODES = new Set([95, 96, 99]);

// Active-status set — used in many places; keep in sync with IrrigationExecution model enum.
const ACTIVE_STATUSES = [
  "PENDING",
  "WAITING_DEVICE",
  "WAITING_RAIN_HOLD",
  "WAITING_WEATHER",
  "WAITING_POWER",   // FIX #6: new status for power-loss hold
  "RUNNING",
  "PULSE_OFF",
  "EMERGENCY",
];

let intervalHandle = null;
let running = false;

// =============================================================================
// Lifecycle
// =============================================================================

function startIrrigationExecutionManager() {
  if (intervalHandle) return;
  console.log("[IrrigationExecutionManager] Started - checking every 6 seconds");
  intervalHandle = setInterval(runExecutionChecks, CHECK_INTERVAL_MS);
  if (intervalHandle.unref) intervalHandle.unref();
  runExecutionChecks();
}

function stopIrrigationExecutionManager() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
  console.log("[IrrigationExecutionManager] Stopped");
}


// =============================================================================
// Main loop
// =============================================================================

async function runExecutionChecks() {
  if (running) return;
  running = true;
  try {
    await createEmergencyExecutions();
    console.log("STEP 4 : runExecutionChecks()");
    const executions = await IrrigationExecution.find({ status: { $in: ACTIVE_STATUSES } })
      .sort({ emergency: -1, scheduledAt: 1, createdAt: 1 })
      .limit(100)
      .lean();
    console.log("Found executions:", executions.length);
    for (const execution of executions) {
      try {
        await processExecution(execution);
      } catch (err) {
        console.error(`[IrrigationExecutionManager] ${execution._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[IrrigationExecutionManager] run error:", err.message);
  } finally {
    running = false;
  }
}

// =============================================================================
// Create execution from AI recommendation
// =============================================================================

async function createExecutionFromRecommendation({ farm, device, result }) {
  const schedule = result.schedule || {};
  const water = result.water_requirement || {};
  const inputs = result.inputs || {};

  const scheduledAt = buildScheduledAt(schedule.selected_date, schedule.selected_time);
  const requiredTheta = normalizePercent(water.required_theta ?? inputs.moisture_threshold, 35);
  const stopMoisture = normalizePercent(requiredTheta * 1.10, requiredTheta);
  const thresholdMoisture = normalizePercent(inputs.moisture_threshold, null);
 

  if (!scheduledAt && !schedule.rain_hold) return null;
  const execution =  IrrigationExecution.findOneAndUpdate(
    {
      farm: farm._id,
      device: device._id,
      scheduledAt,
      emergency: false,
      status: { $in: ["PENDING", "WAITING_DEVICE", "WAITING_RAIN_HOLD", "WAITING_WEATHER", "WAITING_POWER"] },
    },
    {
      $set: {
        user: farm.user,
        farm: farm._id,
        device: device._id,
        deviceId: device.deviceId,
        scheduledDate: schedule.selected_date ? new Date(`${schedule.selected_date}T00:00:00.000Z`) : null,
        scheduledTime: schedule.selected_time || null,
        scheduledAt,
        rainHold: Boolean(schedule.rain_hold),
        rainHoldUntil: schedule.rain_hold_until ? new Date(`${schedule.rain_hold_until}T23:59:59.999Z`) : null,
        requiredTheta,
        stopMoisture,
        thresholdMoisture,
        waterSufficient: water.water_sufficient ?? null,
        status: schedule.rain_hold ? "WAITING_RAIN_HOLD" : "PENDING",
        reason: schedule.rain_hold ? "Rain Hold Active" : "Waiting for scheduled time",
        sourceSchedule: schedule,
        sourceWaterRequirement: water,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log("Saved execution")
  // console.log(execution)
  return execution;
  // return IrrigationExecution.findOneAndUpdate(
  //   {
  //     farm: farm._id,
  //     device: device._id,
  //     scheduledAt,
  //     emergency: false,
  //     status: { $in: ["PENDING", "WAITING_DEVICE", "WAITING_RAIN_HOLD", "WAITING_WEATHER", "WAITING_POWER"] },
  //   },
  //   {
  //     $set: {
  //       user: farm.user,
  //       farm: farm._id,
  //       device: device._id,
  //       deviceId: device.deviceId,
  //       scheduledDate: schedule.selected_date ? new Date(`${schedule.selected_date}T00:00:00.000Z`) : null,
  //       scheduledTime: schedule.selected_time || null,
  //       scheduledAt,
  //       rainHold: Boolean(schedule.rain_hold),
  //       rainHoldUntil: schedule.rain_hold_until ? new Date(`${schedule.rain_hold_until}T23:59:59.999Z`) : null,
  //       requiredTheta,
  //       stopMoisture,
  //       thresholdMoisture,
  //       waterSufficient: water.water_sufficient ?? null,
  //       status: schedule.rain_hold ? "WAITING_RAIN_HOLD" : "PENDING",
  //       reason: schedule.rain_hold ? "Rain Hold Active" : "Waiting for scheduled time",
  //       sourceSchedule: schedule,
  //       sourceWaterRequirement: water,
  //     },
  //   },
  //   { upsert: true, new: true, setDefaultsOnInsert: true }
  // );
}

// =============================================================================
// Process one execution
// =============================================================================

async function processExecution(execution) {
  // console.log("STEP 5 : processExecution()");
  // console.log("Execution Status:", execution.status);
  // console.log("Execution ID:", execution._id);
  // console.log("Actual Start:", execution.actualStartTime);
  // console.log("Phase Started:", execution.phaseStartedAt);
  // console.log("Emergency:", execution.emergency);
  const now = new Date();
  const context = await buildContext(execution);
  // console.log("STEP 6 : Context");

  console.log(JSON.stringify(context, null, 2));
  const patch = { lastCheckedAt: now, deviceStatus: context.deviceStatus };

  // Wait until scheduled time for non-emergency executions.
  if (!execution.emergency && execution.scheduledAt && now < new Date(execution.scheduledAt)) {
    await IrrigationExecution.updateOne({ _id: execution._id }, { $set: patch });
    return;
  }

  // Continue an already-running / pulse-cycling / emergency execution.
  if (["RUNNING", "PULSE_OFF", "EMERGENCY"].includes(execution.status)) {
    await continueActiveExecution(execution, context, now, patch);
    return;
  }

  // Handle rain hold gate before start.
  if (!execution.emergency && execution.rainHold) {
    const released = await handleRainHold(execution, context, now, patch);
    if (!released) return;
  }

  // FIX #4: AI Auto check moved here, before evaluateStartConditions.
  // This avoids proceeding into start-condition evaluation for cancelled executions.
  if (!execution.emergency) {
    const farm = await Farm.findById(execution.farm).select("aiAutoEnabled").lean();
    if (!farm?.aiAutoEnabled) {
      console.warn(`[IEM] AI Auto is OFF for farm ${execution.farm} — cancelling execution ${execution._id}`);
      await IrrigationExecution.updateOne(
        { _id: execution._id },
        { $set: { status: "CANCELLED", reason: "AI Auto Disabled by farmer", lastCheckedAt: now } }
      );
      return;
    }
  }
  console.log("STEP 7 : evaluating...");

  const startDecision = evaluateStartConditions(execution, context);

  console.log("START DECISION =", startDecision);

  if (!startDecision.ok) {
    console.log("Blocked here");
    await setWaitingStatus(execution, startDecision, patch);
    return;
  }

  console.log("Calling startExecution()");

  await startExecution(
    execution,
    context,
    now,
    execution.emergency ? "Emergency Irrigation Started" : "Irrigation Started"
  );
}

// =============================================================================
// Continue an active (RUNNING / PULSE_OFF / EMERGENCY) execution
// =============================================================================

async function continueActiveExecution(execution, context, now, patch) {
  console.log("STEP CONTINUE ACTIVE");
  const stopDecision = evaluateStopConditions(execution, context, now);
  if (stopDecision.stop) {
    await stopExecution(execution, context, stopDecision.status, stopDecision.reason);
    return;
  }

  if (execution.status === "PULSE_OFF") {
    const elapsed = now.getTime() - new Date(execution.phaseStartedAt || execution.actualStartTime).getTime();
    if (elapsed >= PUMP_OFF_MS) {
      await sendPumpCommand(execution, context.device, 1, "schedule");
      await IrrigationExecution.updateOne(
        { _id: execution._id },
        { $set: { status: execution.emergency ? "EMERGENCY" : "RUNNING", phaseStartedAt: now, ...patch } }
      );
      return;
    }
    await IrrigationExecution.updateOne({ _id: execution._id }, { $set: patch });
    return;
  }

  const phaseElapsed = now.getTime() - new Date(execution.phaseStartedAt || execution.actualStartTime).getTime();
  if (phaseElapsed >= PUMP_ON_MS) {
    await sendPumpCommand(execution, context.device, 0, "schedule");
    await IrrigationExecution.updateOne(
      { _id: execution._id },
      { $set: { status: "PULSE_OFF", phaseStartedAt: now, ...patch } }
    );
    return;
  }

  await IrrigationExecution.updateOne({ _id: execution._id }, { $set: patch });
}

// =============================================================================
// Start execution  (AI Auto check removed from here — now done in processExecution)
// =============================================================================

async function startExecution(execution, context, now, notificationTitle) {
  console.log("STEP 8 : startExecution()");
  if (execution.waterSufficient === false) {
    await notifyOnce(execution, "water-insufficient", {
      title: "Available water may be insufficient",
      message: "Irrigation will continue until target moisture is achieved or the tank reaches the critical level.",
      severity: "warning",
    });
  }
console.log("STEP 8 : startExecution()");

console.log("Before sendPumpCommand");
  const command = await sendPumpCommand(
    execution,
    context.device,
    1,
    execution.emergency ? "ai" : "schedule"
  );
console.log("After sendPumpCommand");
  await IrrigationExecution.updateOne(
    { _id: execution._id },
    {
      $set: {
        status: execution.emergency ? "EMERGENCY" : "RUNNING",
        reason: execution.emergency ? "Emergency Irrigation Executed" : "Irrigation Started",
        actualStartTime: execution.actualStartTime || now,
        phaseStartedAt: now,
        moistureBefore: execution.moistureBefore || context.moisture,
        tankLevelBefore: context.tankLevel,
        deviceStatus: context.deviceStatus,
        lastCheckedAt: now,
      },
      $addToSet: command ? { commandLogs: command.commandLog._id } : {},
    }
  );

  await notifyOnce(execution, `started-${execution._id}`, {
    title: notificationTitle,
    message: "Pump started for farm irrigation.",
    severity: execution.emergency ? "critical" : "info",
  });
}

// =============================================================================
// Stop execution
// =============================================================================

async function stopExecution(execution, context, status, reason) {
  const now = new Date();
  let command = null;
  if (context.device && context.device.status === "online" && isBrokerConnected()) {
    command = await sendPumpCommand(execution, context.device, 0, "schedule");
  }

  const runtimeMinutes = execution.actualStartTime
    ? Math.round((now.getTime() - new Date(execution.actualStartTime).getTime()) / 60000)
    : 0;

  await IrrigationExecution.updateOne(
    { _id: execution._id },
    {
      $set: {
        status,
        reason,
        actualEndTime: now,
        moistureAfter: context.moisture,
        tankLevelAfter: context.tankLevel,
        runtimeMinutes,
        deviceStatus: context.deviceStatus,
        lastCheckedAt: now,
      },
      $addToSet: command ? { commandLogs: command.commandLog._id } : {},
    }
  );

  const titleByStatus = {
    COMPLETED: "Irrigation Completed",
    PARTIAL: "Irrigation Partially Completed",
    FAILED: reason === "Safety Timeout" ? "Safety Timeout" : "Irrigation Failed",
    CANCELLED: "Manual Stop",
    SKIPPED: "Irrigation Skipped",
  };

  await notifyOnce(execution, `terminal-${status}-${reason}`, {
    title: titleByStatus[status] || "Irrigation Updated",
    message: reason,
    severity: status === "COMPLETED" || status === "SKIPPED" ? "info" : "warning",
  });
}

// =============================================================================
// Manual stop
// =============================================================================

async function manualStopExecution(executionId, userId) {
  const execution = await IrrigationExecution.findOne({
    _id: executionId,
    user: userId,
    status: { $in: ACTIVE_STATUSES },
  }).lean();

  if (!execution) throw new Error("Active irrigation execution not found.");

  const context = await buildContext(execution);
  await stopExecution(execution, context, "CANCELLED", "Manual Stop");
  return IrrigationExecution.findById(executionId).lean();
}

// =============================================================================
// Rain hold
// =============================================================================

async function handleRainHold(execution, context, now, patch) {
  const holdUntil = execution.rainHoldUntil ? new Date(execution.rainHoldUntil) : null;
  if (holdUntil && now < holdUntil) {
    await setWaitingStatus(
      execution,
      { status: "WAITING_RAIN_HOLD", reason: "Rain Hold Active", notification: "Rain Hold Activated" },
      patch
    );
    return false;
  }

  const rainOccurred = await didRainOccur(execution);
  if (rainOccurred) {
    await IrrigationExecution.updateOne(
      { _id: execution._id },
      { $set: { status: "CANCELLED", reason: "Rain occurred during hold window", actualEndTime: now, ...patch } }
    );
    await notifyOnce(execution, "rain-hold-cancelled", {
      title: "Rain Hold Cancelled Irrigation",
      message: "Rain occurred during the hold window. Scheduler should recalculate.",
      severity: "info",
    });
    return false;
  }

  await IrrigationExecution.updateOne(
    { _id: execution._id },
    {
      $set: {
        rainHold: false,
        rainHoldReleasedAt: now,
        status: "PENDING",
        reason: "Rain Hold Released",
        ...patch,
      },
    }
  );
  await notifyOnce(execution, "rain-hold-released", {
    title: "Rain Hold Released",
    message: "No actual rain was detected in the hold window. Irrigation can proceed.",
    severity: "info",
  });
  return true;
}

// =============================================================================
// Waiting status helper
// =============================================================================

async function setWaitingStatus(execution, decision, patch) {
  const updates = { status: decision.status, reason: decision.reason, ...patch };

  if (decision.status === "WAITING_WEATHER") {
    updates.lastCheckedAt = new Date();
    updates.nextWeatherCheckAt = new Date(Date.now() + WEATHER_RECHECK_MS);
  }

  await IrrigationExecution.updateOne({ _id: execution._id }, { $set: updates });

  if (decision.notification) {
    await notifyOnce(execution, `${decision.status}-${decision.reason}`, {
      title: decision.notification,
      message: decision.reason,
      severity: decision.status === "WAITING_DEVICE" ? "warning" : "info",
    });
  }
}

// =============================================================================
// FIX #1 + #2 + #3 + #5(partial): evaluateStartConditions
// Additions:
//   #1 — power check   → WAITING_POWER
//   #2 — pump already ON guard (no duplicate Pump ON command)
//   #3 — physical button active before start → block
// =============================================================================

function evaluateStartConditions(execution, context) {
  // --- Device / MQTT online ---
  if (!context.deviceOnline || !context.mqttConnected) {
    return { ok: false, status: "WAITING_DEVICE", reason: "Device Offline", notification: "Device Offline" };
  }

  // FIX #1: Power availability check.
  // context.powerAvailable is derived from latest.powerStatus in buildContext().
  // If the sensor has never reported power at all (undefined/null) we treat it
  // as available so farms without a power sensor keep working normally.
  if (context.powerAvailable === false) {
    return {
      ok: false,
      status: "WAITING_POWER",
      reason: "No Power — waiting for electricity",
      notification: "Power Unavailable",
    };
  }

  // FIX #3: Block start if the on-device physical button is already active.
  // The farmer is controlling the pump physically — don't issue a competing command.
  if (context.latest?.physicalBtn === 1) {
    return {
      ok: false,
      status: "WAITING_DEVICE",
      reason: "Physical Button Active — farmer controlling pump manually",
      notification: "Physical Button Active",
    };
  }

  // FIX #2: Pump is already running — avoid sending a duplicate ON command.
  // pumpSource values: "OFF" | "MANUAL" | "REMOTE" | "REMOTE_AI"
  if (context.latest?.pump === 1) {
    return {
      ok: false,
      status: "WAITING_DEVICE",
      reason: "Pump Already Running",
    };
  }

  // --- Tank level ---
  if (!execution.emergency && context.tankLevel <= MIN_SAFE_TANK_LEVEL) {
    return { ok: false, status: "PARTIAL", reason: "Tank below minimum safe level" };
  }
  if (execution.emergency && context.tankLevel <= MIN_SAFE_TANK_LEVEL) {
    return { ok: false, status: "WAITING_DEVICE", reason: "Tank below minimum safe level" };
  }

  // --- Moisture already sufficient (scheduled only) ---
  if (!execution.emergency && moistureReached(context.moisture, execution.stopMoisture)) {
    return { ok: false, status: "SKIPPED", reason: "Moisture Already Sufficient" };
  }

  // --- Weather gate ---
  if (context.rainActive || context.thunderstorm) {
    return {
      ok: false,
      status: "WAITING_WEATHER",
      reason: context.rainActive ? "Rain Started" : "Thunderstorm Detected",
    };
  }

  return { ok: true };
}

// =============================================================================
// evaluateStopConditions
// FIX #1 (continued): stop running pump if power is lost
// =============================================================================

function evaluateStopConditions(execution, context, now) {
  if (moistureReached(context.moisture, execution.requiredTheta)) {
    return { stop: true, status: "COMPLETED", reason: "Target Moisture Achieved" };
  }
  if (context.latest?.physicalBtn === 1) {
    return { stop: true, status: "CANCELLED", reason: "Manual Farmer Override" };
  }
  if (context.tankLevel <= CRITICAL_TANK_LEVEL) {
    return { stop: true, status: "PARTIAL", reason: "Tank Empty" };
  }
  if (context.rainActive) {
    return { stop: true, status: "PARTIAL", reason: "Rain Started" };
  }
  if (context.thunderstorm) {
    return { stop: true, status: "PARTIAL", reason: "Thunderstorm Detected" };
  }
  // FIX #1: Pause/stop if power is lost during active irrigation.
  if (context.powerAvailable === false) {
    return { stop: true, status: "PARTIAL", reason: "Power Lost During Irrigation" };
  }
  if (!context.deviceOnline) {
    return { stop: true, status: "FAILED", reason: "Device Offline" };
  }
  if (
    execution.actualStartTime &&
    now.getTime() - new Date(execution.actualStartTime).getTime() >= MAX_RUNTIME_MS
  ) {
    return { stop: true, status: "FAILED", reason: "Safety Timeout" };
  }
  return { stop: false };
}

// =============================================================================
// buildContext
// FIX #1: add powerAvailable derived from latest.powerStatus
// =============================================================================

async function buildContext(execution) {
  const device = await Device.findById(execution.device).lean();
  const latest = await SensorData.findOne({ device: execution.device }).sort({ recordedAt: -1 }).lean();
  const currentForecast = await getCurrentForecast(execution.farm);

  const moisture = extractMoisture(latest);
  const tankLevel = normalizePercent(latest?.waterLevel, 100);
  const rainActive = Number(latest?.rain) > 0;
  const weatherCode = Number(currentForecast?.WeatherCode);
  const thunderstorm = THUNDERSTORM_CODES.has(weatherCode);

  // FIX #1: powerAvailable
  // latest.powerStatus === 0 means no electricity.
  // If the field is absent (undefined/null), treat as available (backward-compat).
const powerStatus = latest?.extra?.get
    ? latest.extra.get("power_status")
    : latest?.extra?.power_status;

const powerAvailable =
    powerStatus === undefined || powerStatus === null
        ? true
        : Number(powerStatus) !== 0;
console.log("Extra:", latest?.extra);
console.log("Power Status:", powerStatus);
console.log("Power Available:", powerAvailable);
  return {
    device,
    latest,
    moisture,
    tankLevel,
    rainActive,
    weatherCode,
    thunderstorm,
    powerAvailable,
    manualOverride: latest?.physicalBtn === 1,
    pumpSource:     latest?.pumpSource || "OFF",
    deviceOnline:   device?.status === "online",
    mqttConnected:  isBrokerConnected(),
    deviceStatus: {
      esp32:    device?.status  || "unknown",
      mqtt:     isBrokerConnected() ? "connected" : "disconnected",
      lastSeen: device?.lastSeen || null,
    },
  };
  // return {
  //   device,
  //   latest,
  //   "moisture": {
  //     "sensor1": 0,
  //     "sensor2": 0,
  //     "sensor3": null,
  //     "average": 0
  //   },
  //   tankLevel: 80,

  //   rainActive: false,
  //   thunderstorm: false,

  //   powerAvailable: true,

  //   manualOverride: false,

  //   pumpSource: "OFF",

  //   deviceOnline: true,

  //   mqttConnected: true,

  //   deviceStatus: {
  //     esp32: "online",
  //     mqtt: "connected",
  //     lastSeen: new Date()
  //   }
  // };

}

// =============================================================================
// createEmergencyExecutions  (60-second polling loop)
// FIX #7: create emergency executions even for offline devices
// FIX #5: skip when thresholdMoisture is 0 (disabled) or negative
// =============================================================================

async function createEmergencyExecutions() {
  // FIX #7: Query ALL devices with a farm (not just online ones).
  // evaluateStartConditions will put it into WAITING_DEVICE until ESP32 reconnects.
  const devices = await Device.find({ farm: { $ne: null } })
    .select("_id user farm deviceId status")
    .lean();

  for (const device of devices) {
    const latest = await SensorData.findOne({ device: device._id }).sort({ recordedAt: -1 }).lean();
    if (!latest) continue;

    // AI Auto gate.
    const farm = await Farm.findById(device.farm).select("aiAutoEnabled").lean();
    if (!farm?.aiAutoEnabled) continue;

    // Skip if an active execution already exists.
    const active = await IrrigationExecution.exists({
      device: device._id,
      status: { $in: ACTIVE_STATUSES },
    });
    if (active) continue;

    const mostRecentPlan = await IrrigationExecution.findOne({
      device: device._id,
      thresholdMoisture: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!mostRecentPlan?.thresholdMoisture) continue;

    // FIX #5: Treat thresholdMoisture <= 0 as "emergency irrigation disabled".
    if (mostRecentPlan.thresholdMoisture <= 0) {
      console.log(`[IEM] thresholdMoisture=0 for device ${device.deviceId} — emergency irrigation disabled`);
      continue;
    }

    const moisture = extractMoisture(latest);

    // Skip only when sensor data is missing (null). A real 0% reading is valid.
    if (moisture.average === null) continue;

    const trigger = mostRecentPlan.thresholdMoisture * (1 - THRESHOLD / 100);
    if (moisture.average > trigger) continue;

    await IrrigationExecution.create({
      user: device.user,
      farm: device.farm,
      device: device._id,
      deviceId: device.deviceId,
      scheduledAt: new Date(),
      requiredTheta: mostRecentPlan.requiredTheta,
      stopMoisture: normalizePercent(
        mostRecentPlan.stopMoisture ?? mostRecentPlan.requiredTheta * 1.10,
        mostRecentPlan.requiredTheta
      ),
      thresholdMoisture: mostRecentPlan.thresholdMoisture,
      waterSufficient: mostRecentPlan.waterSufficient,
      // FIX #7: if device is offline, start as WAITING_DEVICE so it resumes on reconnect.
      status: device.status === "online" ? "PENDING" : "WAITING_DEVICE",
      reason: device.status === "online"
        ? "Emergency moisture threshold reached"
        : "Emergency threshold reached — waiting for device to come online",
      emergency: true,
      moistureBefore: moisture,
      tankLevelBefore: normalizePercent(latest.waterLevel, 100),
      sourceSchedule: { emergencyTrigger: trigger },
      sourceWaterRequirement: mostRecentPlan.sourceWaterRequirement,
    });

    console.log(
      `[IEM] Emergency execution created for device ${device.deviceId}` +
      ` (moisture=${moisture.average.toFixed(1)}% ≤ trigger=${trigger.toFixed(1)}%,` +
      ` deviceStatus=${device.status})`
    );
  }
}

// =============================================================================
// didRainOccur
// =============================================================================

async function didRainOccur(execution) {
  const start = execution.updatedAt || execution.createdAt;
  const rainReading = await SensorData.exists({
    device: execution.device,
    recordedAt: { $gte: start, $lte: new Date() },
    rain: { $gt: 0 },
  });
  return Boolean(rainReading);
}

// =============================================================================
// getCurrentForecast
// =============================================================================

async function getCurrentForecast(farmId) {
  const forecastDoc = await DayForecast.findOne({ farm: farmId }).sort({ generatedAt: -1 }).lean();
  if (!forecastDoc?.forecast?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  return forecastDoc.forecast.find(
    (row) => new Date(row.date).toISOString().slice(0, 10) === today
  ) || null;
}

// =============================================================================
// sendPumpCommand
// =============================================================================

async function sendPumpCommand(execution, device, value, source) {
  if (!device) return null;

  // Older/emergency execution records may predate stopMoisture. Derive and
  // persist it here so they still send a usable target to the ESP32.
  const stopMoisture = normalizePercent(
    execution.stopMoisture ?? execution.requiredTheta * 1.10,
    execution.requiredTheta
  );

  if (execution.stopMoisture == null) {
    execution.stopMoisture = stopMoisture;
    await IrrigationExecution.updateOne(
      { _id: execution._id, stopMoisture: null },
      { $set: { stopMoisture } }
    );
  }

  console.log("requiredTheta :", execution.requiredTheta);
  console.log("stopMoisture  :", stopMoisture);
  return issueCommand({
    userId: execution.user.toString(),
    device,
    actuator: "pump",
    value,
    source,
    targetMoisture: stopMoisture,
  });
}

// =============================================================================
// notifyOnce
// =============================================================================

async function notifyOnce(execution, key, { title, message, severity = "info" }) {
  const updated = await IrrigationExecution.findOneAndUpdate(
    { _id: execution._id, notificationKeys: { $ne: key } },
    { $addToSet: { notificationKeys: key } },
    { new: true }
  ).lean();
  if (!updated) return;

  const notification = await Notification.create({
    user: execution.user,
    device: execution.device,
    farm: execution.farm,
    title,
    message,
    type: "system",
    severity,
    context: { executionId: execution._id, status: execution.status },
  });

  emitToUser(execution.user.toString(), "notification", notification);
  emitToUser(execution.user.toString(), "irrigationExecution", {
    executionId: execution._id,
    title,
    message,
    severity,
  });
}

// =============================================================================
// Moisture helpers
// =============================================================================

function extractMoisture(reading) {
  const sensors = reading?.moistureSensors || [];
  const sensor1 = sensors.find((s) => s.sensorId === "sensor_1")?.value ?? null;
  const sensor2 = sensors.find((s) => s.sensorId === "sensor_2")?.value ?? null;
  const sensor3 = sensors.find((s) => s.sensorId === "sensor_3")?.value ?? null;
  const values = sensors.map((s) => Number(s.value)).filter((v) => Number.isFinite(v));

  return {
    sensor1,
    sensor2,
    sensor3,
    average:
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : reading?.avgMoisture ?? null,
    recordedAt: reading?.recordedAt || null,
  };
}

 function moistureReached(moisture, stopMoisture) {
    const values = [
        moisture.sensor1,
        moisture.sensor2,
        moisture.sensor3
    ].filter(Number.isFinite);

    if (values.length === 0) {
        return false;
    }

    return values.every(v => v >= stopMoisture);
}

// =============================================================================
// Numeric helpers
// =============================================================================

function normalizePercent(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (number <= 1) return number * 100;
  return Math.min(Math.max(number, 0), 100);
}

function buildScheduledAt(dateText, timeText) {
  if (!dateText || !timeText) return null;
  const date = new Date(`${dateText}T${timeText}:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

// =============================================================================
// triggerEmergencyCheckForFarm  (called immediately when AI Auto is switched ON)
// FIX #7: includes offline devices — same as createEmergencyExecutions
// FIX #5: skip when thresholdMoisture <= 0
// =============================================================================

async function triggerEmergencyCheckForFarm(farmId) {

  try {
    console.log("STEP 1 : triggerEmergencyCheckForFarm()");
    const devices = await Device.find({
      farm: farmId
    }).lean();

    for (const device of devices) {
      //-----------------------------------------------------
      // Ignore if already irrigating
      //-----------------------------------------------------
      const active = await IrrigationExecution.exists({
        device: device._id,
        status: { $in: ACTIVE_STATUSES }
      });
      if (active)
        continue;
      //-----------------------------------------------------
      // Latest Sensor Reading
      //-----------------------------------------------------
      const latest = await SensorData.findOne({
        device: device._id
      })
        .sort({ recordedAt: -1 })
        .lean();
      if (!latest)
        continue;
      //-----------------------------------------------------
      // Load Farm
      //-----------------------------------------------------

      const farm = await Farm.findById(device.farm)
        .populate("soilType")
        .populate("current_crop")
        .lean();

      if (!farm)
        continue;

      //-----------------------------------------------------
      // Calculate Threshold
      //-----------------------------------------------------

      const thresholdMoisture =
        calculateMoistureThreshold(farm) * 100;

      const requiredTheta = thresholdMoisture;
const stopMoisture = requiredTheta * 1.10;
      //-----------------------------------------------------
      // Emergency Trigger
      //-----------------------------------------------------

      const trigger =
        thresholdMoisture -
        Number(process.env.IRRIGATION_EMERGENCY_MARGIN_PERCENT || 10);

      //-----------------------------------------------------
      // Current Moisture
      //-----------------------------------------------------

      const moisture = extractMoisture(latest);

      const currentMoisture = moisture.average;

      if (currentMoisture == null)
        continue;

      console.log("--------------------------------");
      console.log("Current Moisture :", currentMoisture);
      console.log("Threshold        :", thresholdMoisture);
      console.log("Emergency Trigger:", trigger);
      console.log("--------------------------------");

      if (currentMoisture > trigger)
        continue;

      //-----------------------------------------------------
      // Create Emergency Execution
      //-----------------------------------------------------

      const execution = await IrrigationExecution.create({

        user: device.user,

        farm: device.farm,

        device: device._id,

        deviceId: device.deviceId,

        scheduledAt: new Date(),

        requiredTheta,
        stopMoisture,

        thresholdMoisture,

        waterSufficient: true,

        status:
          device.status === "online"
            ? "PENDING"
            : "WAITING_DEVICE",

        reason:
          "Emergency Threshold Crossed",

        emergency: true,

        moistureBefore: moisture,

        tankLevelBefore:
          normalizePercent(latest.waterLevel, 100),

        sourceSchedule: {
          emergencyTrigger: trigger
        }

      });

      console.log("STEP 2 : Execution Created");

      //-----------------------------------------------------
      // NO WAITING
      //-----------------------------------------------------

      console.log("STEP 3 : Processing Immediately");

      const executionDoc =
        await IrrigationExecution.findById(execution._id).lean();

      await processExecution(executionDoc);

    }

  }
  catch (err) {

    console.error(err);

  }

}

// =============================================================================
// Exports
// =============================================================================

module.exports = {
  startIrrigationExecutionManager,
  stopIrrigationExecutionManager,
  runExecutionChecks,
  createExecutionFromRecommendation,
  manualStopExecution,
  triggerEmergencyCheckForFarm,

  evaluateStartConditions,
};
