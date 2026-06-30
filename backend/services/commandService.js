// backend/services/commandService.js
// =============================================================================
// Command Service
// =============================================================================
// Central service for all pump / valve command lifecycle management.
//
// A command moves through these states:
//
//   pending   → created in DB, MQTT publish in progress
//   delivered → broker accepted the publish (QoS 1 ACK from broker)
//   acked     → ESP32 published a cmd/ack message confirming execution
//   failed    → MQTT publish failed (broker unreachable)
//   timeout   → ACK was never received within ACK_TIMEOUT_MS
//   cancelled → user cancelled before the ESP32 executed it
//
// ACK flow:
//   Backend publishes  → farm/{deviceId}/cmd/pump   "1"
//   ESP32 executes     → publishes back to
//                         farm/{deviceId}/cmd/ack   { cmdId: "...", ok: true }
//   mqttService routes → handleAckMessage()
//                      → commandService.acknowledgeCommand()
//                      → emitToUser("commandAck", { ... })
//
// Retry logic:
//   Max 3 attempts.  Each attempt publishes to MQTT and resets the ACK timer.
//   Attempts are tracked in CommandLog.attempts (array of { at, mqttStatus }).
// =============================================================================

const crypto     = require("crypto");
const CommandLog = require("../models/CommandLog");
const { publishCommand } = require("./mqttService");
const { emitToUser }     = require("./socketService");

// ─── Config ───────────────────────────────────────────────────────────────────
const ACK_TIMEOUT_MS = parseInt(process.env.CMD_ACK_TIMEOUT_MS, 10) || 10_000; // 10 s
const MAX_RETRIES    = 3;

// In-memory ACK timeout map:  commandLogId (string) → TimeoutHandle
// Cleared when an ACK arrives or the command is cancelled / timed-out.
const _ackTimers = new Map();

// =============================================================================
// issueCommand
// Creates a CommandLog, publishes to MQTT, and starts the ACK timer.
//
// @param {Object} params
//   userId         — MongoDB ObjectId string
//   device         — lean Device document  (must have .deviceId and ._id)
//   actuator       — "pump" | "valve"
//   value          — 0 | 1
//   source         — "manual" | "schedule" | "ai"
//   targetMoisture — number | null  (only relevant for pump-on commands)
//
// @returns {Object}  { commandLog, cmdId }
// =============================================================================
async function issueCommand({ userId, device, actuator, value, source = "manual", targetMoisture = null }) {
 console.log("STEP 9 : issueCommand()");
  const cmdId = crypto.randomBytes(8).toString("hex");

  // FIX (BUG-3): removed the dead `mqttTopic` local variable.
  // publishCommand() builds the correct topic internally via
  // mqttConfig.topics.cmdPump(deviceId).  Nothing here needs to know the topic.
  //
  // The payload stored in CommandLog now accurately reflects what the ESP32
  // actually receives: { cmdId, action, value, ts, [targetMoisture] }.
  const mqttPayload = {
    cmdId,
    action: actuator,   // "pump" or "valve" — matches publishCommand's action check
    value,
    ts: Date.now(),
    ...(targetMoisture !== null && targetMoisture !== undefined ? { targetMoisture } : {}),
  };

  console.log(`\n📋 [CommandService] issueCommand START`);
  console.log(`   cmdId=${cmdId} actuator=${actuator} value=${value} source=${source}`);
  console.log(`   userId=${userId} deviceId=${device.deviceId} device._id=${device._id}`);
  console.log(`   MQTT payload: ${JSON.stringify(mqttPayload)}`);

  // Create the log document first (status: pending)
  const commandLog = await CommandLog.create({
    user:       userId,
    device:     device._id,
    farm:       device.farm || null,
    actuator,
    value,
    payload:    mqttPayload,
    source,
    cmdId,
    mqttStatus: "pending",
    issuedAt:   new Date(),
    attempts:   [],
  });

  console.log(`   ✅ CommandLog created: _id=${commandLog._id}`);

  // Publish to broker
  try {
    console.log(`   📤 Calling publishCommand(deviceId=${device.deviceId})...`);
    await publishCommand(device.deviceId, mqttPayload);
    console.log(`   ✅ publishCommand succeeded — broker accepted the message`);

    await CommandLog.updateOne(
      { _id: commandLog._id },
      {
        $set:  { mqttStatus: "delivered" },
        $push: { attempts: { at: new Date(), mqttStatus: "delivered" } },
      }
    );

    _startAckTimer(commandLog._id.toString(), userId, device.deviceId, ACK_TIMEOUT_MS);

    console.log(`   🎯 [CommandService] done — cmdId=${cmdId} status=delivered\n`);
    return { commandLog, cmdId };

  } catch (mqttErr) {
    console.error(`   ❌ [CommandService] publishCommand FAILED: ${mqttErr.message}`);

    // Extra diagnostic: print broker state
    try {
      const { isBrokerConnected } = require("./mqttService");
      console.error(`   Broker connected: ${isBrokerConnected()}`);
    } catch (e) { /* ignore */ }

    await CommandLog.updateOne(
      { _id: commandLog._id },
      {
        $set:  { mqttStatus: "failed", errorMessage: mqttErr.message },
        $push: { attempts: { at: new Date(), mqttStatus: "failed", error: mqttErr.message } },
      }
    );
    throw mqttErr;
  }
}

// =============================================================================
// acknowledgeCommand
// Called by mqttService when it receives a cmd/ack message from the ESP32.
// Marks the command as "acked" and emits a Socket.IO event to the dashboard.
//
// @param {string}  cmdId      — the cmdId echoed back by the ESP32
// @param {string}  hardwareId — the hardware device ID (for logging)
// @param {boolean} ok         — whether the ESP32 reports success
// =============================================================================
async function acknowledgeCommand(cmdId, hardwareId, ok = true) {
  // Clear the ACK timeout so we don't also mark it as timed-out
  _clearAckTimer(cmdId);

  const cmd = await CommandLog.findOneAndUpdate(
    { cmdId, mqttStatus: { $in: ["pending", "delivered"] } },
    {
      $set: {
        mqttStatus: ok ? "acked" : "failed",
        ackedAt:    new Date(),
        ...(ok ? {} : { errorMessage: "ESP32 reported execution failure" }),
      },
    },
    { new: true }
  ).lean();

  if (!cmd) {
    // Already timed out or cancelled — safe to ignore
    console.warn(`⚠️  [CommandService] ACK for unknown/stale cmdId=${cmdId}`);
    return;
  }

  console.log(`${ok ? "✅" : "❌"} [CommandService] ACK received cmdId=${cmdId} ok=${ok}`);

  // Emit to the user's Socket.IO room so the React dashboard updates instantly
  emitToUser(cmd.user.toString(), "commandAck", {
    commandId:  cmd._id,
    cmdId,
    actuator:   cmd.actuator,
    value:      cmd.value,
    mqttStatus: cmd.mqttStatus,
    ackedAt:    cmd.ackedAt,
    ok,
  });
}
async function acknowledgeLatestCommand(hardwareId, ok = true) {
  const Device = require("../models/Device");

  const device = await Device.findOne({ deviceId: hardwareId }).lean();
  if (!device) return;

  const cmd = await CommandLog.findOneAndUpdate(
    {
      device: device._id,
      mqttStatus: { $in: ["pending", "delivered"] },
    },
    {
      $set: {
        mqttStatus: ok ? "acked" : "failed",
        ackedAt: new Date(),
      },
    },
    {
      new: true,
      sort: { createdAt: -1 },
    }
  ).lean();

  if (!cmd) return;

  emitToUser(cmd.user.toString(), "commandAck", {
    commandId: cmd._id,
    actuator: cmd.actuator,
    value: cmd.value,
    mqttStatus: cmd.mqttStatus,
    ackedAt: cmd.ackedAt,
    ok,
  });
}

// =============================================================================
// retryCommand
// Re-publishes an existing failed/timeout command.
// Creates a fresh attempt entry and resets the ACK timer.
// Returns the updated CommandLog.
//
// @param {string} commandLogId  — MongoDB ObjectId of the CommandLog document
// @param {string} userId        — for auth / ownership check
// =============================================================================
async function retryCommand(commandLogId, userId) {
  const cmd = await CommandLog.findOne({
    _id:  commandLogId,
    user: userId,
  }).lean();

  if (!cmd) throw new Error("Command not found");

  const attemptCount = (cmd.attempts || []).length;
  if (attemptCount >= MAX_RETRIES) {
    throw new Error(`Maximum retry attempts (${MAX_RETRIES}) reached`);
  }
  if (cmd.mqttStatus === "acked") {
    throw new Error("Command already acknowledged — retry not needed");
  }
  if (cmd.mqttStatus === "cancelled") {
    throw new Error("Cannot retry a cancelled command");
  }

  // FIX (BUG-4): publishCommand only supports action="pump" today.
  // Guard here so a valve retry gives a clear error instead of a silent wrong publish.
  if (cmd.actuator !== "pump") {
    throw new Error(`Retry not supported for actuator "${cmd.actuator}" — publishCommand only handles "pump"`);
  }

  // Fetch device for its hardware deviceId
  const Device = require("../models/Device");
  const device = await Device.findById(cmd.device).lean();
  if (!device) throw new Error("Device not found");

  // FIX (BUG-4): restored targetMoisture from the original payload so the retry
  // sends exactly the same effective command as the first attempt.
  const mqttPayload = {
    cmdId:   cmd.cmdId,
    action:  cmd.actuator,
    value:   cmd.value,
    ts:      Date.now(),
    retry:   attemptCount + 1,
    ...(cmd.payload?.targetMoisture != null
      ? { targetMoisture: cmd.payload.targetMoisture }
      : {}),
  };

  try {
    await publishCommand(device.deviceId, mqttPayload);

    const updated = await CommandLog.findByIdAndUpdate(
      commandLogId,
      {
        $set:  { mqttStatus: "delivered" },
        $push: { attempts: { at: new Date(), mqttStatus: "delivered", retry: attemptCount + 1 } },
      },
      { new: true }
    ).lean();

    _startAckTimer(commandLogId, userId, device.deviceId, ACK_TIMEOUT_MS);

    console.log(`🔁 [CommandService] retry #${attemptCount + 1} for cmdId=${cmd.cmdId}`);
    return updated;

  } catch (mqttErr) {
    await CommandLog.findByIdAndUpdate(commandLogId, {
      $set:  { mqttStatus: "failed", errorMessage: mqttErr.message },
      $push: { attempts: { at: new Date(), mqttStatus: "failed", error: mqttErr.message } },
    });
    throw mqttErr;
  }
}

// =============================================================================
// cancelCommand
// Marks a pending/delivered command as cancelled.
// Clears any pending ACK timer.
// =============================================================================
async function cancelCommand(commandLogId, userId) {
  _clearAckTimer(commandLogId);

  const cmd = await CommandLog.findOneAndUpdate(
    {
      _id:        commandLogId,
      user:       userId,
      mqttStatus: { $in: ["pending", "delivered"] },
    },
    { $set: { mqttStatus: "cancelled", cancelledAt: new Date() } },
    { new: true }
  ).lean();

  if (!cmd) throw new Error("Command not found or already in a terminal state");

  console.log(`🚫 [CommandService] cancelled cmdId=${cmd.cmdId}`);

  emitToUser(userId.toString(), "commandCancelled", {
    commandId:  cmd._id,
    cmdId:      cmd.cmdId,
    mqttStatus: "cancelled",
  });

  return cmd;
}

// =============================================================================
// _startAckTimer  (private)
// Marks a command as "timeout" if no ACK arrives within ACK_TIMEOUT_MS.
// =============================================================================
function _startAckTimer(commandLogId, userId, hardwareDeviceId, timeoutMs) {
  _clearAckTimer(commandLogId);

  const handle = setTimeout(async () => {
    _ackTimers.delete(commandLogId);
    try {
      const cmd = await CommandLog.findOneAndUpdate(
        { _id: commandLogId, mqttStatus: { $in: ["pending", "delivered"] } },
        { $set: { mqttStatus: "timeout" } },
        { new: true }
      ).lean();

      if (!cmd) return; // Already acked or cancelled

      console.warn(`⏱  [CommandService] ACK timeout for cmdId=${cmd.cmdId}`);

      emitToUser(cmd.user.toString(), "commandTimeout", {
        commandId:  cmd._id,
        cmdId:      cmd.cmdId,
        actuator:   cmd.actuator,
        value:      cmd.value,
        mqttStatus: "timeout",
      });
    } catch (err) {
      console.error("❌ [CommandService] ACK timer error:", err.message);
    }
  }, timeoutMs);

  _ackTimers.set(commandLogId, handle);
}

function _clearAckTimer(key) {
  const handle = _ackTimers.get(key);
  if (handle) {
    clearTimeout(handle);
    _ackTimers.delete(key);
  }
}

module.exports = {
  issueCommand,
  acknowledgeCommand,
  acknowledgeLatestCommand,
  retryCommand,
  cancelCommand,
  ACK_TIMEOUT_MS,
  MAX_RETRIES,
};