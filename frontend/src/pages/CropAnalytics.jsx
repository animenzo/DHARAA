import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  FaChartLine,
  FaLeaf,
  FaChevronDown,
  FaSeedling,
  FaRulerCombined,
  FaMapMarkerAlt,
  FaCalendarAlt,
  FaTint,
  FaInfoCircle,
  FaArrowRight,
} from "react-icons/fa";

import API from "../services/api";
import { getSmartIrrigationResult } from "../services/aiApi";
import { getCropLabel, formatFarmAreaAcres } from "../utils/farmDisplay";
import iotApi from "../services/iotApi";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractList(payload, key) {
  if (Array.isArray(payload)) return payload;
  return toArray(payload?.[key]);
}

function firstArray(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTheta(value) {
  const number = toNumber(value);
  if (number === null) return null;
  return Math.abs(number) <= 1 ? number * 100 : number;
}

function toDateKey(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().split("T")[0];
}

// Helper to format Date for readable X-Axis
const formatChartDate = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Custom tooltip for Crop Coefficient Chart
const KcTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xl p-4 text-xs">
        <p className="font-bold text-slate-700 mb-2 border-b pb-1">
          {new Date(data.Date).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">Day After Sowing:</span>
            <span className="font-bold text-slate-700">{data.DayAfterSowing}</span>
          </div>
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-500 font-medium">Crop Coefficient (Kc):</span>
            </div>
            <span className="font-bold text-emerald-600">{Number(data.Kc).toFixed(2)}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom tooltip for Sensor vs Physics Moisture (Theta) & Error Chart
const TodayStateTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white border border-slate-100 rounded-2xl shadow-xl p-4 text-xs">
        <p className="font-bold text-slate-700 mb-2 border-b pb-1">
          {new Date(data.Date).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
        <div className="space-y-1.5">
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">Day After Sowing:</span>
            <span className="font-bold text-slate-700">{data.DayAfterSowing}</span>
          </div>
          {payload.map((item) => (
            <div key={item.name} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color || item.stroke }}
                />
                <span className="text-slate-500 font-medium">{item.name}:</span>
              </div>
              <span className="font-bold text-slate-700">
                {Number(item.value).toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function CropAnalytics() {
  const navigate = useNavigate();
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [activeTab, setActiveTab] = useState("kc"); // "kc" | "theta" | "error" | "combined"

  const farmId = selectedFarm?._id || null;

  // Fetch latest sensor reading for soil moisture details
  const { data: latestReadingData } = useQuery({
    queryKey: ["latestReading", farmId],
    queryFn: () => iotApi.getLatestReading(farmId),
    enabled: !!farmId,
    refetchInterval: 10_000,
  });

  const reading = latestReadingData?.reading;
  const sensor1Val = reading?.moistureSensors?.[0]?.value;
  const sensor2Val = reading?.moistureSensors?.[1]?.value;
  const avgMoistureVal = reading?.avgMoisture;

  // Set page title for SEO best practices
  useEffect(() => {
    document.title = "Crop Analytics & Water Metrics | DHARAA";
  }, []);

  // Fetch all user farms
  useEffect(() => {
    const loadFarms = async () => {
      try {
        const res = await API.get("/farms/farm");
        const farmList = extractList(res.data, "farms");
        setFarms(farmList);
        if (farmList.length > 0) {
          setSelectedFarm(farmList[0]);
        }
      } catch (err) {
        console.error("Error fetching farms for analytics:", err);
      }
    };
    loadFarms();
  }, []);

  // Fetch Smart Irrigation Results (which contains crop schedule and today-state analytics)
  const { data: smartResult, isLoading: resultsLoading } = useQuery({
    queryKey: ["smartIrrigationResult", farmId],
    queryFn: () => getSmartIrrigationResult(farmId),
    enabled: !!farmId,
    staleTime: 60_000,
  });

  const handleFarmChange = (e) => {
    const farm = farms.find((f) => f._id === e.target.value);
    if (farm) {
      setSelectedFarm(farm);
    }
  };

  // Extract prediction data
  const predictionsData = useMemo(() => {
    const predictions = firstArray(
      smartResult?.prediction?.futureMoisture?.predictions,
      smartResult?.prediction?.futureMoisture,
      smartResult?.futureMoisture?.predictions,
      smartResult?.futureMoisture
    );
    
    // Sort by date to make sure the graph is ordered correctly
    return [...predictions].sort((a, b) => new Date(a.Date) - new Date(b.Date));
  }, [smartResult]);

  // Extract Crop Coefficient Growth Schedule (180 days)
  const kcScheduleData = useMemo(() => {
    const schedule = firstArray(
      smartResult?.prediction?.cropSchedule?.schedule,
      smartResult?.prediction?.cropSchedule,
      smartResult?.cropSchedule?.schedule,
      smartResult?.cropSchedule
    );
    return [...schedule]
      .sort((a, b) => new Date(a.Date) - new Date(b.Date))
      .map((item) => {
        const Date = toDateKey(item.Date);
        const Kc = toNumber(item.Kc);
        return Date && Kc !== null
          ? {
              ...item,
              Date,
              Kc,
              DayAfterSowing: toNumber(item.DayAfterSowing),
            }
          : null;
      })
      .filter(Boolean);
  }, [smartResult]);

  // Extract Sensor vs Physics moisture and error values from TodayState
  const todayStateData = useMemo(() => {
    const todayState = firstArray(
      smartResult?.todayState,
      smartResult?.today_state,
      smartResult?.prediction?.todayState,
      smartResult?.prediction?.today_state
    );
    
    return [...todayState]
      .sort((a, b) => new Date(a.Timestamp || a.Date) - new Date(b.Timestamp || b.Date))
      .map((item) => {
        const Date = item.Timestamp || item.Date;
        const sensorTheta = normalizeTheta(
          item.Sensor_Moisture ?? item.SensorTheta ?? item.sensorTheta ?? item.sensor_moisture
        );
        const physicsTheta = normalizeTheta(
          item.Physics_Moisture ?? item.PhysicsTheta ?? item.physicsTheta ?? item.physics_moisture
        );
        const errorPercent = normalizeTheta(item.Error ?? item.ErrorPercent ?? item.error);
        
        return {
          ...item,
          Date,
          DayAfterSowing: toNumber(item.DayAfterSowing),
          Kc: toNumber(item.Kc),
          SensorTheta: sensorTheta,
          PhysicsTheta: physicsTheta,
          ErrorPercent: errorPercent,
        };
      })
      .filter((item) => item.Date && (item.SensorTheta !== null || item.PhysicsTheta !== null || item.ErrorPercent !== null));
  }, [smartResult]);

  // Merge Kc Schedule data and TodayState data for Combined Multi-axis Chart
  const combinedChartData = useMemo(() => {
    const merged = {};
    
    kcScheduleData.forEach((item) => {
      const d = item.Date;
      merged[d] = {
        Date: d,
        DayAfterSowing: item.DayAfterSowing,
        Kc: item.Kc,
        SensorTheta: null,
        PhysicsTheta: null,
        ErrorPercent: null,
      };
    });
    
    todayStateData.forEach((item) => {
      const d = new Date(item.Date).toISOString().split("T")[0];
      if (!merged[d]) {
        merged[d] = {
          Date: d,
          DayAfterSowing: item.DayAfterSowing,
          Kc: item.Kc,
          SensorTheta: item.SensorTheta,
          PhysicsTheta: item.PhysicsTheta,
          ErrorPercent: item.ErrorPercent,
        };
      } else {
        merged[d].SensorTheta = item.SensorTheta;
        merged[d].PhysicsTheta = item.PhysicsTheta;
        merged[d].ErrorPercent = item.ErrorPercent;
        if (item.Kc !== null && item.Kc !== undefined) {
          merged[d].Kc = item.Kc;
        }
      }
    });
    
    return Object.values(merged).sort((a, b) => new Date(a.Date) - new Date(b.Date));
  }, [kcScheduleData, todayStateData]);

  // Today's metrics from predictions array
  const todayMetrics = useMemo(() => {
    const source = kcScheduleData.length ? kcScheduleData : predictionsData;
    if (!source.length) return null;
    
    const todayStr = new Date().toDateString();
    
    // Attempt to match today's date, or fallback to the first element (usually represents nearest/today prediction)
    let match = source.find((p) => new Date(p.Date).toDateString() === todayStr);
    if (!match) {
      match = source[0];
    }
    return match;
  }, [kcScheduleData, predictionsData]);

  // Loading state skeleton
  const renderSkeleton = () => (
    <div className="space-y-6 animate-pulse">
      <div className="h-24 bg-slate-100 rounded-3xl" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-2xl" />
        ))}
      </div>
      <div className="h-[400px] bg-slate-100 rounded-3xl" />
    </div>
  );

  return (
    <div className="p-2 lg:p-4 max-w-7xl mx-auto space-y-6">
      
      {/* ── Page Header & Farm Selector ──────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 inline-block">
              <FaChartLine />
            </span>
            Crop Analytics
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Visualise crop coefficients, soil moisture theta levels, and model error trends
          </p>
        </div>

        {/* Farm dropdown selector */}
        <div className="relative group w-full md:w-72 bg-slate-50 border border-slate-200/60 rounded-2xl px-4 py-2.5 transition hover:border-emerald-500">
          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
            Select Farm
          </label>
          <div className="flex items-center justify-between">
            <select
              value={selectedFarm?._id || ""}
              onChange={handleFarmChange}
              className="appearance-none w-full bg-transparent font-bold text-slate-700 cursor-pointer outline-none text-sm pr-6"
            >
              {farms.map((farm) => (
                <option key={farm._id} value={farm._id}>
                  {farm.name}
                </option>
              ))}
              {farms.length === 0 && <option>No Farms Found</option>}
            </select>
            <FaChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none group-hover:text-emerald-500" />
          </div>
        </div>
      </div>

      {resultsLoading ? (
        renderSkeleton()
      ) : (
        <>
          {/* ── Farm Context Chips ────────────────────────────────────────── */}
          {selectedFarm && (
            <div className="flex flex-wrap gap-3 bg-slate-50/40 p-1.5 rounded-2xl items-center">
              <span className="bg-emerald-50/70 text-emerald-700 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-emerald-100/50 shadow-sm">
                <FaSeedling className="text-emerald-600" />
                Current Crop: {getCropLabel(selectedFarm.current_crop)}
              </span>
              <span className="bg-blue-50/70 text-blue-700 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-blue-100/50 shadow-sm">
                <FaRulerCombined className="text-blue-500" />
                Size: {formatFarmAreaAcres(selectedFarm)} Meter sq.
              </span>
              <span className="bg-red-50/70 text-red-700 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-red-100/50 shadow-sm">
                <FaMapMarkerAlt className="text-red-500" />
                Location: {selectedFarm.location || "Local Farm"}
              </span>
              {selectedFarm.sowing_date && (
                <span className="bg-amber-50/70 text-amber-700 px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border border-amber-100/50 shadow-sm">
                  <FaCalendarAlt className="text-amber-600" />
                  Sown: {new Date(selectedFarm.sowing_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
          )}

          {/* ── Soil Properties & Real-Time Moisture Card ────────────────── */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 hover:shadow-md transition duration-200">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FaTint className="text-emerald-500" /> Soil Physics & Real-Time Moisture Status
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Soil Constants (FC, PWP, MAD) */}
              <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-2">
                  Soil Water Constants
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Field Capacity (FC)</p>
                    <p className="text-xl font-black text-slate-800 mt-1">
                      {selectedFarm?.soilType?.["FC (v%)"] !== undefined 
                        ? `${selectedFarm.soilType["FC (v%)"]}%` 
                        : "N/A"}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Max water retention</span>
                  </div>
                  <div className="text-center border-x border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Wilting Point (PWP)</p>
                    <p className="text-xl font-black text-slate-800 mt-1">
                      {selectedFarm?.soilType?.["PWP (v%)"] !== undefined 
                        ? `${selectedFarm.soilType["PWP (v%)"]}%` 
                        : "N/A"}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Dry limit for plants</span>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">MAD Threshold</p>
                    <p className="text-xl font-black text-slate-800 mt-1">
                      {selectedFarm?.current_crop?.["p (MAD)"] !== undefined 
                        ? `${(selectedFarm.current_crop["p (MAD)"] * 100).toFixed(0)}%` 
                        : "N/A"}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Max allowed depletion</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Real-Time Moisture (Sensor 1, 2, Average) */}
              <div className="space-y-4 bg-emerald-50/20 p-5 rounded-2xl border border-emerald-100/50">
                <h3 className="text-xs font-bold text-emerald-700/80 uppercase tracking-wider border-b border-emerald-100 pb-2 flex justify-between items-center">
                  <span>Live Moisture Levels</span>
                  {reading ? (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">Live</span>
                  ) : (
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">No Device</span>
                  )}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Moisture 1</p>
                    <p className="text-xl font-black text-slate-800 mt-1">
                      {sensor1Val !== undefined && sensor1Val !== null 
                        ? `${sensor1Val}%` 
                        : "—"}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Topsoil sensor</span>
                  </div>
                  <div className="text-center border-x border-emerald-100/50">
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Moisture 2</p>
                    <p className="text-xl font-black text-slate-800 mt-1">
                      {sensor2Val !== undefined && sensor2Val !== null 
                        ? `${sensor2Val}%` 
                        : "—"}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Rootzone sensor</span>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-emerald-700 font-bold uppercase">Average</p>
                    <p className="text-xl font-black text-emerald-600 mt-1">
                      {avgMoistureVal !== undefined && avgMoistureVal !== null 
                        ? `${avgMoistureVal}%` 
                        : "—"}
                    </p>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Mean soil moisture</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Metric Summary Cards ─────────────────────────────────────── */}
          {(todayMetrics || todayStateData.length > 0) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              
              {/* Card 1: Crop Coefficient (Kc) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Crop Coeff. (Kc)</span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <FaLeaf />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-800">
                    {todayMetrics?.Kc !== null && todayMetrics?.Kc !== undefined
                      ? Number(todayMetrics.Kc).toFixed(2)
                      : "N/A"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
                    <FaInfoCircle className="text-emerald-500" /> Today's crop transpiration multiplier
                  </p>
                </div>
              </div>

              {/* Card 2: Latest Sensor Theta */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sensor Theta</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <FaTint />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-800">
                    {todayStateData.at(-1)?.SensorTheta !== null && todayStateData.at(-1)?.SensorTheta !== undefined
                      ? Number(todayStateData.at(-1).SensorTheta).toFixed(1)
                      : "N/A"} <span className="text-sm font-bold text-slate-500">%</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
                    <FaInfoCircle className="text-blue-500" /> Latest measured soil theta
                  </p>
                </div>
              </div>

              {/* Card 3: Latest Model Error */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Theta Error</span>
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                    <FaChartLine />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-800">
                    {todayStateData.at(-1)?.ErrorPercent !== null && todayStateData.at(-1)?.ErrorPercent !== undefined
                      ? Number(todayStateData.at(-1).ErrorPercent).toFixed(1)
                      : "N/A"} <span className="text-sm font-bold text-slate-500">%</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
                    <FaInfoCircle className="text-rose-500" /> Sensor minus physics moisture
                  </p>
                </div>
              </div>

              {/* Card 4: Age / Sowing Stage */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Crop Age</span>
                  <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                    <FaCalendarAlt />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-800">
                    {todayMetrics?.DayAfterSowing ?? todayStateData.at(-1)?.DayAfterSowing ?? "N/A"} <span className="text-sm font-bold text-slate-500">DAS</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
                    <FaInfoCircle className="text-purple-500" /> Days after sowing progress
                  </p>
                </div>
              </div>

            </div>
          ) : null}

          {/* ── Graph Section ────────────────────────────────────────────── */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
            
            {/* Chart controller headers */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-800">Water Projections Chart</h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Projections for the next 10 days of the crop life cycle
                </p>
              </div>

              {/* Tabs selector */}
              <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl border border-slate-200/40 gap-1">
                <button
                  onClick={() => setActiveTab("kc")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "kc"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Crop Coefficient (Kc)
                </button>
                <button
                  onClick={() => setActiveTab("theta")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "theta"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Soil Moisture (Theta)
                </button>
                <button
                  onClick={() => setActiveTab("error")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "error"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Model Error
                </button>
                <button
                  onClick={() => setActiveTab("combined")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "combined"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Combined Overview
                </button>
              </div>
            </div>

            {/* Graphs container */}
            <div className="h-[360px] w-full min-h-[300px]">
              {kcScheduleData.length > 0 || predictionsData.length > 0 || todayStateData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {activeTab === "kc" ? (
                    // ── KC Area Chart ──
                    <AreaChart
                      data={kcScheduleData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="kcGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="Date"
                        tickFormatter={formatChartDate}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        domain={[0, (dataMax) => Math.max(1.2, Number((dataMax + 0.1).toFixed(1)))]}
                        tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }}
                      />
                      <Tooltip content={<KcTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="Kc"
                        name="Crop Coefficient (Kc)"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#kcGradient)"
                      />
                      {todayMetrics && (
                        <ReferenceLine
                          x={todayMetrics.Date}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                          label={{
                            value: "Today",
                            position: "top",
                            fill: "#10b981",
                            fontSize: 10,
                            fontWeight: "bold",
                          }}
                        />
                      )}
                    </AreaChart>
                  ) : activeTab === "theta" ? (
                    // ── Theta Area Chart ──
                    <AreaChart
                      data={todayStateData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="thetaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="physicsThetaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="Date"
                        tickFormatter={formatChartDate}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }}
                        unit="%"
                      />
                      <Tooltip content={<TodayStateTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, fontWeight: "bold", color: "#64748b" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="SensorTheta"
                        name="Sensor Theta"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#thetaGradient)"
                      />
                      <Area
                        type="monotone"
                        dataKey="PhysicsTheta"
                        name="Physics Theta"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#physicsThetaGradient)"
                      />
                    </AreaChart>
                  ) : activeTab === "error" ? (
                    // ── Error Area Chart ──
                    <AreaChart
                      data={todayStateData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#e11d48" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="Date"
                        tickFormatter={formatChartDate}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }}
                        unit="%"
                      />
                      <Tooltip content={<TodayStateTooltip />} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                      <Area
                        type="monotone"
                        dataKey="ErrorPercent"
                        name="Theta Error"
                        stroke="#e11d48"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#errorGradient)"
                      />
                    </AreaChart>
                  ) : (
                    // ── Combined Multiaxis Line Chart ──
                    <LineChart
                      data={combinedChartData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="Date"
                        tickFormatter={formatChartDate}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: "600" }}
                      />
                      <YAxis
                        yAxisId="left"
                        orientation="left"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#10b981", fontSize: 11, fontWeight: "600" }}
                        label={{
                          value: "Kc Coefficient",
                          angle: -90,
                          position: "insideLeft",
                          offset: 15,
                          style: { fill: "#10b981", fontSize: 11, fontWeight: "bold" },
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#3b82f6", fontSize: 11, fontWeight: "600" }}
                        label={{
                          value: "Theta / Error (%)",
                          angle: 90,
                          position: "insideRight",
                          offset: 15,
                          style: { fill: "#3b82f6", fontSize: 11, fontWeight: "bold" },
                        }}
                      />
                      <Tooltip
                        content={(props) => {
                          if (props.active && props.payload && props.payload.length) {
                            const data = props.payload[0].payload;
                            return (
                              <div className="bg-white border border-slate-100 rounded-2xl shadow-xl p-4 text-xs">
                                <p className="font-bold text-slate-700 mb-2 border-b pb-1">
                                  {new Date(data.Date).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </p>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-slate-400 font-medium">Day After Sowing:</span>
                                    <span className="font-bold text-slate-700">{data.DayAfterSowing}</span>
                                  </div>
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-slate-500 font-medium text-emerald-600">Kc:</span>
                                    <span className="font-bold text-emerald-600">{Number(data.Kc).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-slate-500 font-medium text-blue-600">Sensor theta:</span>
                                    <span className="font-bold text-blue-600">{data.SensorTheta !== null ? `${Number(data.SensorTheta).toFixed(2)}%` : "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-slate-500 font-medium text-amber-600">Physics theta:</span>
                                    <span className="font-bold text-amber-600">{data.PhysicsTheta !== null ? `${Number(data.PhysicsTheta).toFixed(2)}%` : "N/A"}</span>
                                  </div>
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-slate-500 font-medium text-rose-600">Error:</span>
                                    <span className="font-bold text-rose-600">{data.ErrorPercent !== null ? `${Number(data.ErrorPercent).toFixed(2)}%` : "N/A"}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, fontWeight: "bold" }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="Kc"
                        name="Crop Coefficient (Kc)"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="SensorTheta"
                        name="Sensor Theta"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="PhysicsTheta"
                        name="Physics Theta"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="ErrorPercent"
                        name="Theta Error"
                        stroke="#e11d48"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col justify-center items-center text-center p-6 border-2 border-dashed border-slate-100 rounded-3xl">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 mb-4 text-2xl">
                    📊
                  </div>
                  <h3 className="text-base font-bold text-slate-700">No Analytics Data Available</h3>
                  <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4 leading-relaxed">
                    We couldn't find any generated crop coefficients or moisture predictions for this farm. Generative recommendations populate this forecast.
                  </p>
                  <button
                    onClick={() => navigate("/iot")}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow-md transition duration-200"
                  >
                    Go to IoT Dashboard <FaArrowRight />
                  </button>
                </div>
              )}
            </div>

            {/* Bottom info section explaining the visible analytics */}
            {(kcScheduleData.length > 0 || todayStateData.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="text-xs leading-relaxed text-slate-500">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    What is Crop Coefficient (Kc)?
                  </h4>
                  <p>
                    The Crop Coefficient shows how crop water demand changes across growth stages. This graph is generated from the saved crop schedule document for the selected farm.
                  </p>
                </div>
                <div className="text-xs leading-relaxed text-slate-500">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    What are Theta and Error?
                  </h4>
                  <p>
                    Theta compares sensor moisture against the physics model from the today-state table. Error is the difference between those two values, shown as a percentage trend.
                  </p>
                </div>
              </div>
            )}

          </div>
        </>
      )}
    </div>
  );
}
