
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useSensorData } from "../hooks/useSensorData";
import { useDeviceStatus } from "../hooks/useDeviceStatus";

import DeviceStatusCard from "../components/iot/DeviceStatusCard";
import DeviceStatusBanner from "../components/iot/DeviceStatusBanner";
import SensorDashboard from "../components/iot/SensorDashboard";
import RealtimeChart from "../components/iot/RealtimeChart";
import DeviceInfo from "../components/iot/DeviceInfo";
import MqttStatusBadge from "../components/iot/MqttStatusBadge";
import ActuatorPanel from "../components/iot/ActuatorPanel";
import CommandHistoryPanel from "../components/iot/CommandHistoryPanel";
import MqttCredentialsCard from "../components/iot/MqttCredentialsCard";
import WaterTankCard from "../components/iot/WaterTankCard";

import axiosInstance from "../services/api";
import { FaCalendarAlt, FaChevronDown, FaExclamationTriangle, FaLeaf, FaMapMarkerAlt, FaRulerCombined, FaSeedling, FaSync } from "react-icons/fa";
import {
  getCoordinates,
  getWeatherByCoordinates,
  getWeatherIcon,
} from "../services/weatherService";
import { Navigate, useNavigate } from "react-router-dom";
import API from "../services/api";
import { WiRain } from "react-icons/wi";
import { useMemo } from "react";
import iotApi from "../services/iotApi";
import { formatFarmAreaAcres, getCropLabel } from "../utils/farmDisplay";
import { getSmartIrrigationResult } from "../services/aiApi";
import SmartIrrigationCard from "../components/irrigation/SmartIrrigationCard";

async function fetchDevice(farmId) {
  if (!farmId) return null;
  const data = await iotApi.getFarmDevice(farmId);
  return data.device;
}
function useRelativeTime(date) {
  const [label, setLabel] = useState("—");
  useEffect(() => {
    if (!date) { setLabel("—"); return; }
    const update = () => {
      const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
      if (s < 5) setLabel("just now");
      else if (s < 60) setLabel(`${s}s ago`);
      else if (s < 3600) setLabel(`${Math.floor(s / 60)}m ago`);
      else setLabel(`${Math.floor(s / 3600)}h ago`);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [date]);
  return label;
}

export default function IoTDashboard() {

  const navigate = useNavigate();
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const farmId = selectedFarm?._id || null;
  const { latest, chartData, isLoading: sensorLoading, isLive, lastUpdated } =
    useSensorData(farmId);
  const [liveWeather, setLiveWeather] = useState(null);

  const [schedules, setSchedules] = useState([]);


  const [loading, setLoading] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);

  const [selectedSensor, setSelectedSensor] = useState("avg");
  useEffect(() => {
    const init = async () => {
      try {
        const res = await API.get("/farms/farm");
        const farmList = res.data;
        setFarms(farmList);
        if (farmList && farmList.length > 0) setSelectedFarm(farmList[0]);
      } catch (e) {
        console.error("Init Error", e);
      }
    };
    init();
  }, []);

  // ── Data fetch loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchSchedules();
  }, [selectedFarm]);
  const fetchSchedules = async () => {
    try {
      const res = await API.get("/schedules/schedule");
      setSchedules(res.data);
    } catch (e) {
      console.error("Schedule Fetch Error", e);
    }
  };
  const handleFarmChange = (e) => {
    const farmId = e.target.value;
    const farm = farms.find((f) => f._id === farmId);
    setSelectedFarm(farm);

  };

  // ── Weather load: FIX — use farm.coordinates instead of geocoding a string ─
  useEffect(() => {
    if (!selectedFarm) return;

    const loadWeather = async () => {
      let lat, lng;

      // 1. Direct coordinates stored on farm (best case — no extra HTTP call)
      if (selectedFarm.coordinates?.lat && selectedFarm.coordinates?.lng) {
        lat = selectedFarm.coordinates.lat;
        lng = selectedFarm.coordinates.lng;

        // 2. Geocode pincode
      } else if (selectedFarm.pincode) {
        try {
          const coords = await getCoordinates(selectedFarm.pincode);
          if (coords) { lat = coords.latitude; lng = coords.longitude; }
        } catch { /* fall through */ }

        // 3. Geocode location string
      } else if (selectedFarm.location) {
        try {
          const coords = await getCoordinates(selectedFarm.location);
          if (coords) { lat = coords.latitude; lng = coords.longitude; }
        } catch { /* fall through */ }
      }

      // 4. Final fallback: geographic centre of India
      if (!lat || !lng) {
        lat = 22.9734;
        lng = 78.6569;
      }

      const data = await getWeatherByCoordinates(lat, lng);
      setLiveWeather(data);
    };

    loadWeather();
  }, [selectedFarm]);

  // ── Schedule helpers (unchanged) ────────────────────────────────────────────
  const getNextRunDate = (schedule) => {
    if (!schedule?.days || !schedule.time) return null;
    const now = new Date();
    const [hour, minute] = schedule.time.split(":").map(Number);
    for (let i = 0; i <= 7; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(now.getDate() + i);
      checkDate.setHours(hour, minute, 0, 0);
      if (i === 0 && checkDate < now) continue;
      const dayIndex = (checkDate.getDay() + 6) % 7;
      if (schedule.days[dayIndex]) return checkDate;
    }
    return null;
  };

  let nextSchedule = null;
  let nextDate = null;
  schedules?.forEach((schedule) => {
    const scheduleDate = getNextRunDate(schedule);
    if (scheduleDate && (!nextDate || scheduleDate < nextDate)) {
      nextDate = scheduleDate;
      nextSchedule = schedule;
    }
  });

  const formattedDateString = nextDate
    ? nextDate.toLocaleString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    })
    : null;

  // ── Device metadata (name, topics, template) ──────────────────────────────
  // staleTime is high — we only need this for display info, not status gating.


  const { data: device, isLoading: deviceLoading } = useQuery({
    queryKey: ["iotDevice", farmId],
    queryFn: () => fetchDevice(farmId),
    enabled: !!farmId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const { data: smartIrrigationResult, isLoading: smartIrrigationLoading } = useQuery({
    queryKey: ["smartIrrigationResult", farmId],
    queryFn: () => getSmartIrrigationResult(farmId),
    enabled: !!farmId,
    refetchInterval: 60_000,
    retry: 1,
  });


  // ── Live device status ────────────────────────────────────────────────────
  // Destructure BOTH status (string for display) AND isOnline (bool for gating).
  // isOnline = true when status is "online" or "stale".
  // This is the single source of truth — DeviceStatusCard uses the same hook.
  const {
    status: liveStatus,
    isOnline,             // ← THE FIX: was never destructured before
  } = useDeviceStatus(farmId);

  const alerts = useMemo(() => {
    const list = [];

    if (!isOnline) {
      list.push("Device Offline");
    }

    if (latest?.waterLevel !== undefined &&
      latest.waterLevel < 20) {
      list.push("Low Water Level");
    }

    if (latest?.rain === 1) {
      list.push("Rain Detected");
    }

    return list;
  }, [latest, isOnline]);

  const lastUpdatedLabel = useRelativeTime(lastUpdated);

  return (
    <div className="p-2 lg:p-2 space-y-2 max-w-7xl mx-auto">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center py-4 gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <FaLeaf className="text-xl" />
                </div>
                <div className="relative group">
                  <select
                    value={selectedFarm?._id || ""}
                    onChange={handleFarmChange}
                    className="appearance-none bg-transparent font-bold text-xl text-slate-800 pr-8 cursor-pointer outline-none hover:text-emerald-700 transition-colors"
                  >
                    {farms.map((farm) => (
                      <option key={farm._id} value={farm._id}>
                        {farm.name}
                      </option>
                    ))}
                    {farms.length === 0 && <option>No Farms Found</option>}
                  </select>
                  <FaChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none group-hover:text-emerald-500" />
                  <p className="text-xs text-slate-400 font-medium">
                    Live Monitoring Dashboard
                  </p>
                </div>
              </div>

              {selectedFarm && (
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-slate-200">
                    <FaSeedling className="text-emerald-500" />{" "}
                    {getCropLabel(selectedFarm.current_crop)}
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-slate-200">
                    <FaRulerCombined className="text-blue-500" />{" "}
                    {formatFarmAreaAcres(selectedFarm)} Acres
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-slate-200">
                    <FaMapMarkerAlt className="text-red-400" />{" "}
                    {selectedFarm.location || "Local Farm"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              {/* Weather widget — click to go to WeatherPage */}
              <div
                className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => navigate("/weather")}
              >
                {liveWeather ? (
                  <>
                    <div className="text-2xl">
                      {getWeatherIcon(liveWeather.current.weather_code).icon}
                    </div>
                    <div className="flex flex-col leading-none">
                      <span className="font-bold text-slate-700 text-sm">
                        {Math.round(liveWeather.current.temperature_2m)}°C
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">
                        {getWeatherIcon(liveWeather.current.weather_code).label}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 animate-pulse">
                    Loading Weather…
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  fetchSchedules();
                }}
                className="bg-white border border-slate-200 text-slate-400 p-2.5 rounded-xl hover:text-emerald-600 hover:border-emerald-200 hover:shadow-md transition-all active:scale-95"
                disabled={loading}
              >
                <FaSync className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">IoT Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {isLive
              ? `Live · last update ${lastUpdatedLabel}`
              : lastUpdated
                ? `Last update ${lastUpdatedLabel}`
                : "Waiting for data…"}
          </p>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          <button
            onClick={() => setShowAlertsModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${alerts.length > 0
              ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
              : "text-slate-400 hover:bg-slate-50"
              }`}
          >
            <FaExclamationTriangle />
            {alerts.length > 0 ? `${alerts.length} Warnings` : "System Normal"}
          </button>
        </div>
        <MqttStatusBadge size="sm" />

      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">


      </div>

      {/* ── Offline banner ────────────────────────────────────────────────── */}
      <DeviceStatusBanner farmId={farmId} />

      {/* ── Main grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-1 space-y-4">

          {/* DeviceStatusCard uses useDeviceStatus() internally */}
          <DeviceStatusCard farmId={farmId} />
          {/* 
          <DeviceInfo device={device} isLoading={deviceLoading} />

          <MqttCredentialsCard farmId={farmId} /> */}


          <ActuatorPanel
            farmId={farmId}
            latest={latest}
            isOnline={isOnline}
            deviceStatus={liveStatus}
          />
          <WaterTankCard
            percent={latest?.waterLevelPercent}
            liters={latest?.currentWaterLiters}
            isLoading={sensorLoading}
          />
          <CommandHistoryPanel farmId={farmId} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-4">
           <SensorDashboard

            latest={latest}
            isLoading={sensorLoading}
            selectedSensor={selectedSensor}
            setSelectedSensor={setSelectedSensor}
          />

          {smartIrrigationLoading ? (
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
          ) : (
            <SmartIrrigationCard
              compact
              farmName={selectedFarm?.name}
              result={smartIrrigationResult}
            />
          )}
         
          <div className="bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm flex flex-col justify-center text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 mb-2">
              <FaCalendarAlt />
              <span className="text-xs font-bold uppercase">Next Run</span>
            </div>
            {nextSchedule ? (
              <div>
                <p className="text-2xl font-black text-emerald-600">{formattedDateString}</p>
                <p className="text-xs text-slate-500 font-medium bg-slate-50 inline-block px-3 py-1 rounded-full mt-2">{nextSchedule.name}</p>
              </div>
            ) : (
              <p className="text-slate-400 font-bold text-sm">No Schedule</p>
            )}
            <button onClick={() => navigate("/schedules/new")} className="mt-4 text-xs font-bold text-blue-500 hover:underline">
              Manage Schedules
            </button>
          </div>

          <RealtimeChart
            chartData={chartData}
            isLoading={sensorLoading}
            height={220}
            selectedSensor={selectedSensor}
          />
        </div>
        {showAlertsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-lg font-bold mb-4 text-slate-800">System Alerts</h3>
              {alerts.length > 0 ? (
                <ul className="space-y-2 mb-6">
                  {alerts.map((a, i) => (
                    <li key={i} className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 flex items-center gap-3 font-medium text-sm">
                      <FaExclamationTriangle /> {a}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 mb-6 italic">No active alerts.</p>
              )}
              <button onClick={() => setShowAlertsModal(false)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors">Close</button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
