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
  FaCloudSun,
  FaInfoCircle,
  FaArrowRight,
} from "react-icons/fa";

import API from "../services/api";
import { getSmartIrrigationResult } from "../services/aiApi";
import { getCropLabel, formatFarmAreaAcres } from "../utils/farmDisplay";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractList(payload, key) {
  if (Array.isArray(payload)) return payload;
  return toArray(payload?.[key]);
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

// Custom tooltip for ETc & ET0 Evapotranspiration Chart
const EtcTooltip = ({ active, payload }) => {
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
        <div className="space-y-2">
          <div className="flex justify-between items-center gap-4">
            <span className="text-slate-400 font-medium">Day After Sowing:</span>
            <span className="font-bold text-slate-700">{data.DayAfterSowing}</span>
          </div>
          {payload.map((item) => (
            <div key={item.dataKey} className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-500 font-medium">{item.name}:</span>
              </div>
              <span className="font-bold text-slate-700">
                {Number(item.value).toFixed(2)} mm/day
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
  const [activeTab, setActiveTab] = useState("kc"); // "kc" | "etc" | "combined"

  const farmId = selectedFarm?._id || null;

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

  // Fetch Smart Irrigation Results (which contains future moisture and Kc/ETc prediction details)
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
    const predictions = smartResult?.prediction?.futureMoisture?.predictions;
    if (!predictions || !Array.isArray(predictions)) return [];
    
    // Sort by date to make sure the graph is ordered correctly
    return [...predictions].sort((a, b) => new Date(a.Date) - new Date(b.Date));
  }, [smartResult]);

  // Today's metrics from predictions array
  const todayMetrics = useMemo(() => {
    if (!predictionsData.length) return null;
    
    const todayStr = new Date().toDateString();
    
    // Attempt to match today's date, or fallback to the first element (usually represents nearest/today prediction)
    let match = predictionsData.find((p) => new Date(p.Date).toDateString() === todayStr);
    if (!match) {
      match = predictionsData[0];
    }
    return match;
  }, [predictionsData]);

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
            Visualise crop coefficients and actual evapotranspiration projections
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

          {/* ── Metric Summary Cards ─────────────────────────────────────── */}
          {predictionsData.length > 0 && todayMetrics ? (
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
                    {Number(todayMetrics.Kc).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
                    <FaInfoCircle className="text-emerald-500" /> Today's crop transpiration multiplier
                  </p>
                </div>
              </div>

              {/* Card 2: Evapotranspiration (ETc) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">ETc Demand</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <FaTint />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-800">
                    {Number(todayMetrics.ETc).toFixed(1)} <span className="text-sm font-bold text-slate-500">mm/day</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
                    <FaInfoCircle className="text-blue-500" /> Realised water consumption demand
                  </p>
                </div>
              </div>

              {/* Card 3: Reference Evapotranspiration (ET0) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition duration-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reference ET0</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <FaCloudSun />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-800">
                    {Number(todayMetrics.ET0).toFixed(1)} <span className="text-sm font-bold text-slate-500">mm/day</span>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
                    <FaInfoCircle className="text-amber-500" /> Atmospheric water loss rate
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
                    {todayMetrics.DayAfterSowing} <span className="text-sm font-bold text-slate-500">DAS</span>
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
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/40">
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
                  onClick={() => setActiveTab("etc")}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === "etc"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Water Loss (ETc / ET0)
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
              {predictionsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {activeTab === "kc" ? (
                    // ── KC Area Chart ──
                    <AreaChart
                      data={predictionsData}
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
                  ) : activeTab === "etc" ? (
                    // ── ETc / ET0 Dual Area Chart ──
                    <AreaChart
                      data={predictionsData}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="etcGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="et0Gradient" x1="0" y1="0" x2="0" y2="1">
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
                        unit=" mm"
                      />
                      <Tooltip content={<EtcTooltip />} />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12, fontWeight: "bold", color: "#64748b" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="ETc"
                        name="Crop Evapotranspiration (ETc)"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#etcGradient)"
                      />
                      <Area
                        type="monotone"
                        dataKey="ET0"
                        name="Reference Evapotranspiration (ET0)"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        fillOpacity={1}
                        fill="url(#et0Gradient)"
                      />
                      {todayMetrics && (
                        <ReferenceLine
                          x={todayMetrics.Date}
                          stroke="#3b82f6"
                          strokeDasharray="3 3"
                          label={{
                            value: "Today",
                            position: "top",
                            fill: "#3b82f6",
                            fontSize: 10,
                            fontWeight: "bold",
                          }}
                        />
                      )}
                    </AreaChart>
                  ) : (
                    // ── Combined Multiaxis Line Chart ──
                    <LineChart
                      data={predictionsData}
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
                          value: "Water (mm/day)",
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
                                    <span className="text-slate-500 font-medium text-blue-600">ETc:</span>
                                    <span className="font-bold text-blue-600">{Number(data.ETc).toFixed(2)} mm</span>
                                  </div>
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-slate-500 font-medium text-amber-600">ET0:</span>
                                    <span className="font-bold text-amber-650">{Number(data.ET0).toFixed(2)} mm</span>
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
                        dataKey="ETc"
                        name="Crop Evapotranspiration (ETc)"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="ET0"
                        name="Reference Evapotranspiration (ET0)"
                        stroke="#f59e0b"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
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

            {/* Bottom info section explaining what Kc and ETc are */}
            {predictionsData.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                <div className="text-xs leading-relaxed text-slate-500">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    What is Crop Coefficient (Kc)?
                  </h4>
                  <p>
                    The Crop Coefficient ($K_c$) represents the ratio of crop evapotranspiration to reference evapotranspiration. It represents the structural and physiological differences between the crop and a standard reference grass surface, changing dynamically as the crop grows through initial, mid, and late development stages.
                  </p>
                </div>
                <div className="text-xs leading-relaxed text-slate-500">
                  <h4 className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    What is Crop Evapotranspiration (ETc)?
                  </h4>
                  <p>
                    Crop Evapotranspiration ($ET_c$) measures the actual water evaporated from the soil surface and transpired by the crop canopy per day. Computed as $ET_c = K_c \times ET_0$, it guides precise smart irrigation recommendations by calculating exactly how much water the crop has consumed.
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
