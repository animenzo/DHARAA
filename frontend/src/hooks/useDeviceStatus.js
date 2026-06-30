
import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../context/SocketContext";
import API from "../services/api";

export function useDeviceStatus(farmId) {
  const { socket, isRoomJoined } = useSocket();

  const [status,    setStatus]    = useState("unknown");
  const [lastSeen,  setLastSeen]  = useState(null);
  const [isStale,   setIsStale]   = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState(null);
  const [offlineThresholdMinutes, setOfflineThresholdMinutes] = useState(5);

  const applyStatus = useCallback((data) => {
    if (!data) return;
    setStatus(data.status   ?? "unknown");
    setLastSeen(data.lastSeen ? new Date(data.lastSeen) : null);
    setIsStale(data.isStale ?? false);
    if (data.offlineThresholdMinutes) {
      setOfflineThresholdMinutes(data.offlineThresholdMinutes);
    }
  }, []);

  // ── 1. Initial REST fetch ──────────────────────────────────────────────────
 // ── 1. Initial REST fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!farmId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const fetchStatus = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const res = await API.get(`/iot/${farmId}/device/status`);
        if (!cancelled) applyStatus(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Failed to fetch device status");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchStatus();
    return () => { cancelled = true; };
  }, [farmId, applyStatus]);// eslint-disable-line react-hooks/exhaustive-deps

  // ── 2. Socket.IO live updates ──────────────────────────────────────────────
  // FIX: handle all status values including "stale"
  // FIX: always update lastSeen when provided in the event
  useEffect(() => {
    if (!socket || !isRoomJoined) return;

    const handleDeviceStatus = (data) => {
      // data shape from deviceStatusService.emitToUser:
      //   { deviceId, hardwareId, status, lastSeen, source? }
      if (!data || !data.status) return;

      setStatus(data.status);
      if (data.lastSeen) setLastSeen(new Date(data.lastSeen));
      // "stale" would come from a REST poll, not a socket event — reset it
      setIsStale(false);
    };

    socket.on("deviceStatus", handleDeviceStatus);
    return () => socket.off("deviceStatus", handleDeviceStatus);
  }, [socket, isRoomJoined]);

  // ── isOnline helper ───────────────────────────────────────────────────────
  // "stale" = device is still registered as online by the broker,
  // just hasn't sent data recently. Commands can still be sent.
  // "unknown" = device has never connected — treat same as offline.
  const isOnline = status === "online" || status === "stale";

  return {
    status,
    isOnline,     // ← use this for actuator enable/disable logic
    lastSeen,
    isStale,
    isLoading,
    error,
    offlineThresholdMinutes,
  };
}

export default useDeviceStatus;
