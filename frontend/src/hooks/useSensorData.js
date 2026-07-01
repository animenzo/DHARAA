// frontend/src/hooks/useSensorData.js
// =============================================================================
// useSensorData
// =============================================================================
// Single source of truth for all sensor readings in the dashboard.
//
// Merges:
//   1. REST — GET /iot/sensor/latest  (initial load, page-refresh recovery)
//   2. REST — GET /iot/sensor/last24h (chart data, fetched once on mount)
//   3. Socket.IO — "sensorData" event  (live updates, appended to chart buffer)
//
// Returns:
//   {
//     latest,          // most recent SensorData object | null
//     chartData,       // array of last N readings for the line chart
//     isLoading,       // true while initial REST fetch is in flight
//     error,           // string | null
//     lastUpdated,     // Date | null — timestamp of last received reading
//     isLive,          // boolean — true if receiving Socket.IO updates
//   }
//
// Chart buffer: capped at MAX_CHART_POINTS.
// When a Socket.IO reading arrives it is appended and the oldest entry removed.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import axiosInstance from "../services/api";

const MAX_CHART_POINTS = 30; // keep last 30 readings in the live chart

export function useSensorData(farmId) {
  const { socket, isRoomJoined } = useSocket();

  const [latest, setLatest] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive, setIsLive] = useState(false);

  // Track if we've received at least one Socket.IO event
  const liveTimeoutRef = useRef(null);

  // ── Helper: normalise a reading for chart/display ──────────────────────────
  const normalise = (r = {}) => ({
    recordedAt: r.recordedAt
      ? new Date(r.recordedAt)
      : new Date(),

    avgMoisture: r.avgMoisture ?? null,

    moistureSensors: Array.isArray(r.moistureSensors)
      ? r.moistureSensors
      : [],

    temperature: r.temperature ?? null,
    humidity: r.humidity ?? null,
    rain: r.rain ?? null,
    waterLevel: r.waterLevel ?? null,
    sensorDistance: r.sensorDistance ?? null,
    waterHeight: r.waterHeight ?? null,
    currentWaterLiters: r.currentWaterLiters ?? null,
    waterLevelPercent: r.waterLevelPercent ?? r.waterLevel ?? null,

    pump: r.pump ?? null,
    valve: r.valve ?? null,

    physicalBtn:
      r.physicalBtn ?? 0,

    pumpSource:
      r.pumpSource ?? "OFF",

    rssi: r.rssi ?? null,
    powerStatus:     r.powerStatus     ?? null,
  });
  // ── 1. Initial REST fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!farmId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const fetchInitial = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch latest reading and last 24h chart data in parallel
        const [latestRes, chartRes] = await Promise.all([
          axiosInstance.get(`/iot/${farmId}/sensor/latest`),
          axiosInstance.get(`/iot/${farmId}/sensor/last24h`),
        ]);

        if (cancelled) return;

        const latestReading = latestRes.data.reading;
        const chartReadings = Array.isArray(chartRes.data?.readings)
          ? chartRes.data.readings
          : [];

        if (latestReading) {
          setLatest(normalise(latestReading));
          setLastUpdated(new Date(latestReading.recordedAt));
        }

        // Seed the chart with up to MAX_CHART_POINTS historical readings
        setChartData(
          chartReadings.slice(-MAX_CHART_POINTS).map(normalise)
        );

      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.message || "Failed to load sensor data");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchInitial();
    return () => { cancelled = true; };
  }, [farmId]);

  // ── 2. Socket.IO live updates ──────────────────────────────────────────────
  const handleSensorData = useCallback((data) => {
    const reading = normalise(data);

    // Update the latest reading displayed on gauges/cards
    setLatest(reading);
    setLastUpdated(reading.recordedAt);

    // Append to chart buffer, drop oldest if over the cap
    setChartData((prev) => {
      const next = [...prev, reading];
      return next.length > MAX_CHART_POINTS
        ? next.slice(next.length - MAX_CHART_POINTS)
        : next;
    });

    // Mark as live — reset a 30-second "dead" timer
    setIsLive(true);
    if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
    liveTimeoutRef.current = setTimeout(() => setIsLive(false), 30_000);
  }, []);

  useEffect(() => {
    if (!socket || !isRoomJoined) return;

    socket.on("sensorData", handleSensorData);
    return () => {
      socket.off("sensorData", handleSensorData);
      if (liveTimeoutRef.current) clearTimeout(liveTimeoutRef.current);
    };
  }, [socket, isRoomJoined, handleSensorData]);

  return { latest, chartData, isLoading, error, lastUpdated, isLive };
}

export default useSensorData;
