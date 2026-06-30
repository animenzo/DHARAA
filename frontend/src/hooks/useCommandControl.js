// frontend/src/hooks/useCommandControl.js
// =============================================================================
// useCommandControl
// =============================================================================
// Manages the full command lifecycle from the React side:
//
//   1. Sends the command via REST POST /iot/{farmId}/command
//   2. Tracks "pending → delivered → acked | timeout | failed" state
//   3. Listens for Socket.IO events:
//        "commandSent"      — optimistic update from server
//        "commandAck"       — ESP32 confirmed execution
//        "commandTimeout"   — ACK window expired
//        "commandCancelled" — user cancelled
//   4. Provides retry() and cancel() helpers
//
// Returns:
//   {
//     sendCommand,    // (actuator, value, source?, meta?) => Promise
//     retry,          // (commandId) => Promise
//     cancel,         // (commandId) => Promise
//     commandState,   // { commandId, cmdId, actuator, value, status, issuedAt, ackedAt }
//     isLoading,      // true while REST call is in flight
//     error,          // string | null
//     clearState,     // reset to idle
//   }
//
// FIX (BUG-6): The previous version destructured `socket` from useSocket()
// which was a stale value captured at render time (always null on first render,
// see BUG-5 in SocketContext).  This meant the useEffect that registers
// commandAck / commandTimeout listeners ran with `socket = null`, the early
// return fired, and NO listeners were ever attached — so the dashboard never
// reacted to ESP32 acks or timeouts.
//
// Fix: now that SocketContext exposes `socket` as reactive state (fixed in
// SocketContext.jsx), we can depend on it directly in the useEffect.  We also
// call `socket.off(...)` in the cleanup so there are never duplicate listeners
// if the socket reconnects.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import axiosInstance from "../services/api";

const IDLE_STATE = {
  commandId: null,
  cmdId:     null,
  actuator:  null,
  value:     null,
  status:    "idle",  // idle | pending | delivered | acked | failed | timeout | cancelled
  issuedAt:  null,
  ackedAt:   null,
  error:     null,
};

export function useCommandControl(farmId) {
  // FIX (BUG-6): `socket` is now reactive state from the fixed SocketContext,
  // so it will be non-null once the connection is established and the
  // useEffect below will re-run to register listeners correctly.
  const { socket, isRoomJoined } = useSocket();

  const [commandState, setCommandState] = useState(IDLE_STATE);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState(null);

  // Keep a ref to the active commandId so event handlers always see the latest
  // value without needing it in their own dependency arrays.
  const activeCommandIdRef = useRef(null);

  // ── Helper ──────────────────────────────────────────────────────────────────
  const applyEvent = useCallback((patch) => {
    setCommandState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Socket.IO event listeners ────────────────────────────────────────────────
  // FIX (BUG-6): `socket` in the dep array is now the live instance (not null),
  // so this effect actually runs and registers the listeners.  The cleanup
  // removes them so reconnects don't stack duplicate handlers.
  useEffect(() => {
    if (!socket || !isRoomJoined) return;

    const onCommandSent = (data) => {
      if (data.commandId !== activeCommandIdRef.current) return;
      applyEvent({ status: "delivered", cmdId: data.cmdId });
    };

    const onCommandAck = (data) => {
      if (data.commandId !== activeCommandIdRef.current?.toString()) return;
      applyEvent({
        status:  data.ok ? "acked" : "failed",
        ackedAt: data.ackedAt,
        error:   data.ok ? null : "ESP32 reported execution failure",
      });
    };

    const onCommandTimeout = (data) => {
      if (data.commandId !== activeCommandIdRef.current?.toString()) return;
      applyEvent({ status: "timeout", error: "ESP32 did not respond in time" });
    };

    const onCommandCancelled = (data) => {
      if (data.commandId !== activeCommandIdRef.current?.toString()) return;
      applyEvent({ status: "cancelled" });
    };

    socket.on("commandSent",      onCommandSent);
    socket.on("commandAck",       onCommandAck);
    socket.on("commandTimeout",   onCommandTimeout);
    socket.on("commandCancelled", onCommandCancelled);

    // Cleanup: remove this exact set of handlers when socket changes or
    // component unmounts.  Prevents duplicate listeners on reconnect.
    return () => {
      socket.off("commandSent",      onCommandSent);
      socket.off("commandAck",       onCommandAck);
      socket.off("commandTimeout",   onCommandTimeout);
      socket.off("commandCancelled", onCommandCancelled);
    };
  }, [socket, isRoomJoined, applyEvent]);

  // ── sendCommand ──────────────────────────────────────────────────────────────
  const sendCommand = useCallback(async (actuator, value, source = "manual", meta = {}) => {
    if (!farmId) {
      const msg = "No farm selected — cannot send command";
      setError(msg);
      throw new Error(msg);
    }

    setIsLoading(true);
    setError(null);
    setCommandState({ ...IDLE_STATE, actuator, value, status: "pending" });

    try {
      const res = await axiosInstance.post(`/iot/${farmId}/command`, {
        actuator,
        value,
        source,
        ...(meta.targetMoisture !== undefined ? { targetMoisture: meta.targetMoisture } : {}),
      });
      const { commandId, cmdId } = res.data;

      activeCommandIdRef.current = commandId;

      setCommandState({
        commandId,
        cmdId,
        actuator,
        value,
        status:   "idle",
        issuedAt: new Date().toISOString(),
        ackedAt:  null,
        error:    null,
      });

      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to send command";
      setError(msg);
      setCommandState((prev) => ({ ...prev, status: "failed", error: msg }));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [farmId]);

  // ── retry ────────────────────────────────────────────────────────────────────
  const retry = useCallback(async (commandId) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.post(`/iot/command/${commandId}/retry`);
      applyEvent({ status: "delivered", error: null });
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || "Retry failed";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [applyEvent]);

  // ── cancel ───────────────────────────────────────────────────────────────────
  const cancel = useCallback(async (commandId) => {
    try {
      const res = await axiosInstance.post(`/iot/command/${commandId}/cancel`);
      applyEvent({ status: "cancelled" });
      activeCommandIdRef.current = null;
      return res.data;
    } catch (err) {
      const msg = err?.response?.data?.message || "Cancel failed";
      setError(msg);
      throw err;
    }
  }, [applyEvent]);

  // ── clearState ───────────────────────────────────────────────────────────────
  const clearState = useCallback(() => {
    setCommandState(IDLE_STATE);
    setError(null);
    activeCommandIdRef.current = null;
  }, []);

  return {
    sendCommand,
    retry,
    cancel,
    commandState,
    isLoading,
    error,
    clearState,
  };
}

export default useCommandControl;