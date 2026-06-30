// backend/services/scheduleRunner.js
// =============================================================================
// Schedule Runner  (Phase 9)
// =============================================================================
// Evaluates all Active irrigation schedules every minute and fires pump/valve
// commands via MQTT when the scheduled time matches.
//
// How it works:
//   1. Every 60 seconds, query MongoDB for all Active schedules
//   2. For each schedule, check if today's day matches and current time matches
//   3. If so, call issueCommand() for pump ON (source: "schedule")
//   4. After `duration` minutes, automatically issue pump OFF command
//   5. Update schedule.nextRun to the next occurrence
//
// De-duplication:
//   Tracks lastFiredAt per schedule in memory.  A schedule can only fire once
//   per 2-minute window to prevent double-fires from clock drift or restarts.
//
// Called from index.js startServer() after MongoDB connects:
//   const { startScheduleRunner } = require('./services/scheduleRunner');
//   startScheduleRunner();
// =============================================================================

"use strict";

const Schedule = require("../models/Schedule");
const Device   = require("../models/Device");
const Farm     = require("../models/Farm");

// ─── Config ───────────────────────────────────────────────────────────────────
const CHECK_INTERVAL_MS = 60 * 1000;   // Check every 60 seconds
const FIRE_WINDOW_MS    = 2 * 60 * 1000; // De-dupe window: 2 minutes

// In-memory map: scheduleId → lastFiredAt (Date)
const _lastFired = new Map();

// Interval handle
let _intervalHandle = null;

// =============================================================================
// startScheduleRunner
// =============================================================================
function startScheduleRunner() {
  if (_intervalHandle) return; // Already running

  console.log("📅 [ScheduleRunner] Started — checking every 60 seconds");

  _intervalHandle = setInterval(_runChecks, CHECK_INTERVAL_MS);

  // Don't block graceful shutdown
  if (_intervalHandle.unref) _intervalHandle.unref();

  // Run once immediately so we don't wait 60s after boot
  _runChecks();
}

// =============================================================================
// stopScheduleRunner
// =============================================================================
function stopScheduleRunner() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
    console.log("📅 [ScheduleRunner] Stopped.");
  }
}

// =============================================================================
// _runChecks  (private)
// Loads all active schedules and fires any that are due.
// =============================================================================
async function _runChecks() {
  try {
    const now       = new Date();
    const dayOfWeek = _getDayIndex(now); // 0=Mon … 6=Sun (matches Schedule.days)
    const hhmm      = _toHHMM(now);

    // Only load active schedules — sort by user for cache efficiency
    const schedules = await Schedule.find({ status: "Active" })
      .select("user farmId name time duration days nextRun")
      .lean();

    if (schedules.length === 0) return;

    const fired = [];

    for (const schedule of schedules) {
      try {
        await _checkSchedule(schedule, now, dayOfWeek, hhmm, fired);
      } catch (err) {
        console.error(
          `[ScheduleRunner] Error processing schedule ${schedule._id}:`,
          err.message
        );
      }
    }

    if (fired.length > 0) {
      console.log(
        `[ScheduleRunner] ✅ Fired ${fired.length} schedule(s): ${fired.join(", ")}`
      );
    }
  } catch (err) {
    console.error("[ScheduleRunner] _runChecks error:", err.message);
  }
}

// =============================================================================
// _checkSchedule  (private)
// Decides whether a single schedule should fire right now.
// =============================================================================
async function _checkSchedule(schedule, now, dayOfWeek, hhmm, fired) {
  const schedId = schedule._id.toString();

  // ── 1. Does today match one of the schedule's active days? ──────────────────
  if (!schedule.days || !schedule.days[dayOfWeek]) return;

  // ── 2. Does current HH:MM match? ────────────────────────────────────────────
  if (schedule.time !== hhmm) return;

  // ── 3. De-duplicate: did we fire this schedule within the last 2 minutes? ───
  const lastFiredAt = _lastFired.get(schedId);
  if (lastFiredAt && now.getTime() - lastFiredAt.getTime() < FIRE_WINDOW_MS) {
    return; // Already fired in this window
  }

  // ── 4. Guard: skip if AI Auto is managing this farm ─────────────────────────
  // IrrigationExecutionManager owns irrigation when aiAutoEnabled=true.
  // Firing a schedule on top of it risks double-running the pump or fighting
  // the AI's stop signal.
  if (schedule.farmId) {
    const farm = await Farm.findById(schedule.farmId).select("aiAutoEnabled").lean();
    if (farm?.aiAutoEnabled) {
      console.log(
        `[ScheduleRunner] AI Auto is ON for farm ${schedule.farmId} — skipping "${schedule.name}"`
      );
      return;
    }
  }

  // ── 5. Find the device linked to THIS farm, not just any device for the user ─
  // Using schedule.farmId prevents misfires when a user has multiple farms with
  // separate devices: the wrong device would receive the pump command otherwise.
  let device;
  if (schedule.farmId) {
    const farmDoc = await Farm.findById(schedule.farmId).select("device").lean();
    if (farmDoc?.device) {
      device = await Device.findById(farmDoc.device).lean();
    }
  }
  // Fallback: legacy schedules created before farmId was required
  if (!device) {
    device = await Device.findOne({ user: schedule.user, isActive: true }).lean();
  }
  if (!device) {
    console.warn(
      `[ScheduleRunner] No active device for farm ${schedule.farmId} (user ${schedule.user}) — skipping "${schedule.name}"`
    );
    return;
  }

  if (device.status === "offline") {
    console.warn(
      `[ScheduleRunner] Device ${device.deviceId} is offline — skipping "${schedule.name}"`
    );
    return;
  }

  // ── 6. Issue pump ON command ─────────────────────────────────────────────────
  const { issueCommand } = require("./commandService");

  await issueCommand({
    userId:   schedule.user.toString(),
    device,
    actuator: "pump",
    value:    1,
    source:   "schedule",
  });

  console.log(
    `[ScheduleRunner] 🌱 Schedule "${schedule.name}" fired → pump ON for user ${schedule.user}`
  );

  // Record fire time
  _lastFired.set(schedId, now);
  fired.push(schedule.name);

  // ── 7. Auto-stop pump after duration minutes ──────────────────────────────
  const durationMs = (schedule.duration || 5) * 60 * 1000;

  setTimeout(async () => {
    try {
      // Re-fetch device status — it may have gone offline during irrigation
      const freshDevice = await Device.findById(device._id).lean();
      if (!freshDevice || freshDevice.status === "offline") {
        console.warn(
          `[ScheduleRunner] Auto-stop skipped — device ${device.deviceId} went offline during irrigation`
        );
        return;
      }

      await issueCommand({
        userId:   schedule.user.toString(),
        device:   freshDevice,
        actuator: "pump",
        value:    0,
        source:   "schedule",
      });
      console.log(payload);
      console.log(
        `[ScheduleRunner] 🛑 Auto-stop: pump OFF for schedule "${schedule.name}" after ${schedule.duration}min`
      );

      // Update nextRun on the schedule document
      await _updateNextRun(schedule._id);

    } catch (err) {
      console.error(
        `[ScheduleRunner] Auto-stop error for schedule "${schedule.name}":`,
        err.message
      );
    }
  }, durationMs);
}

// =============================================================================
// _updateNextRun  (private)
// Recalculates and saves the nextRun date for a schedule.
// =============================================================================
async function _updateNextRun(scheduleId) {
  try {
    const schedule = await Schedule.findById(scheduleId).lean();
    if (!schedule) return;

    const [hour, minute] = schedule.time.split(":").map(Number);
    const now = new Date();
    let nextRun = null;

    for (let i = 1; i <= 7; i++) {
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + i);
      candidate.setHours(hour, minute, 0, 0);

      const dayIdx = _getDayIndex(candidate);
      if (schedule.days[dayIdx]) {
        nextRun = candidate;
        break;
      }
    }

    await Schedule.findByIdAndUpdate(scheduleId, { nextRun });
  } catch (err) {
    console.error("[ScheduleRunner] _updateNextRun error:", err.message);
  }
}

// =============================================================================
// Helpers
// =============================================================================

// Returns 0=Mon … 6=Sun to match Schedule.days array
function _getDayIndex(date) {
  return (date.getDay() + 6) % 7;
}

// Returns "HH:MM" string in 24hr format matching Schedule.time field
function _toHHMM(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

// =============================================================================
// Exports
// =============================================================================
module.exports = {
  startScheduleRunner,
  stopScheduleRunner,
};