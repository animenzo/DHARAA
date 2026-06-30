import React, { useState, useEffect, useMemo } from "react";
import {
  getCoordinates,
  getWeather,
  getWeatherIcon,
} from "../services/weatherService";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
// Ensure this path matches where you actually saved the file!
import ConfirmationModal from "../components/dashboard/ConfirmationModal";
import toast, { Toaster } from "react-hot-toast";

// --- REACT ICONS ---
import {
  FaSun,
  FaCloud,
  FaCloudRain,
  FaSnowflake,
  FaBolt,
  FaThermometerHalf,
  FaPowerOff,
  FaCalendarAlt,
  FaSync,
  FaExclamationTriangle,
  FaLeaf,
  FaChevronDown,
  FaMapMarkerAlt,
  FaSeedling,
  FaRulerCombined,
} from "react-icons/fa";
import { WiHumidity, WiRain } from "react-icons/wi";
import { GiWaterTank, GiValve } from "react-icons/gi";

// --- REUSABLE CIRCULAR CHART COMPONENT ---
const CircularChart = ({
  value,
  label,
  icon: Icon,
  colorClass,
  strokeColor,
  unit = "%",
}) => {
  return (
    <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex flex-col items-center h-[340px] relative hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="w-full flex justify-between items-center mb-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <Icon className={`text-xl ${colorClass}`} /> {label}
        </h3>
        <span className="text-[10px] font-bold bg-slate-50 text-slate-400 px-2 py-1 rounded-md uppercase tracking-wider">
          Live
        </span>
      </div>

      {/* Circular Gauge */}
      <div className="relative w-48 h-48 my-auto">
        <svg className="w-full h-full rotate-[135deg]" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className="stroke-slate-100"
            strokeWidth="1.5"
            strokeDasharray="75 100"
            strokeLinecap="round"
          />
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            className={`${strokeColor} transition-all duration-1000 ease-out`}
            strokeWidth="3"
            strokeDasharray={`${(value / 100) * 75} 100`}
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="text-4xl font-black text-slate-800 tracking-tight">
            {value}
            <span className="text-xl text-slate-400 font-bold">{unit}</span>
          </span>
          <span
            className={`text-[10px] font-bold uppercase mt-1 ${colorClass}`}
          >
            Current
          </span>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [liveWeather, setLiveWeather] = useState(null);

  // --- STATE ---
  const [farms, setFarms] = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [sensorData, setSensorData] = useState([]);
  const [schedules, setSchedules] = useState([]);

  // Device & Weather State
  const [deviceStatus, setDeviceStatus] = useState({
    serverStatus: 0,
    status: "offline",
    lastSeen: "N/A",
  });
  const [weather, setWeather] = useState({
    main: "Clear",
    description: "Sunny",
    temperature: 28,
  });
  const [alerts, setAlerts] = useState([]);

  // Control State
  const [mode, setMode] = useState("manual");
  const [loading, setLoading] = useState(false);
  const [showPumpModal, setShowPumpModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [targetMoisture, setTargetMoisture] = useState(30);
  const [pumpAction, setPumpAction] = useState(null);
  const [selectedMoisture, setSelectedMoisture] = useState("average");

  // --- 1. DYNAMIC DATA MAPPING ---
  const activeSensors = useMemo(() => {
    // Helper to extract value safely and ensure it is a Number
    const findVal = (type) => {
      const found = sensorData.find((s) => s.dataType === type);
      return found ? { ...found, value: Number(found.value) } : { value: 0 };
    };

    const moistureSensors = sensorData.filter((s) => s.dataType === "moisture");
    const avgMoisture =
      moistureSensors.length > 0
        ? Math.round(
            moistureSensors.reduce((acc, curr) => acc + Number(curr.value), 0) /
              moistureSensors.length,
          )
        : 0;

    // Pump & Button specific logic (V8/V5)
    const pumpRaw = sensorData.find((s) => s.pin === "v8");
    const btnRaw = sensorData.find((s) => s.pin === "v5");

    return {
      tank: findVal("tank"),
      temp: findVal("temperature"),
      humidity: findVal("humidity"),
      rain: sensorData.find((s) => s.dataType === "rain" || s.pin === "v4") || {
        value: 0,
      },

      // Critical: Ensure these are Numbers for logic checks
      pump: { value: pumpRaw ? Number(pumpRaw.value) : 0 },
      btn: { value: btnRaw ? Number(btnRaw.value) : 0 },

      moistureList: moistureSensors,
      avgMoisture: avgMoisture,
    };
  }, [sensorData]);

  const fetchDashboardData = async () => {
    if (!selectedFarm) return;
    try {
      const response = await API.get(`/device/live/${selectedFarm._id}`);

      // The backend now returns { online: boolean, sensors: [] }
      const { online, sensors } = response.data; // <--- Extract data

      if (Array.isArray(sensors)) {
        setSensorData(sensors);

        // --- NEW STATUS LOGIC ---
        setDeviceStatus({
          serverStatus: online ? 1 : 0, // 1 = Green, 0 = Red
          status: online ? "Online" : "Offline",
          lastSeen: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        });

        // Alerts Logic (Only if online, otherwise just warn it's offline)
        const newAlerts = [];
        if (!online) {
          newAlerts.push("Device Offline - Data may be old");
        } else {
          const tank = sensors.find((s) => s.dataType === "tank");
          if (tank && Number(tank.value) < 20)
            newAlerts.push("Low Water Level");

          const rain = sensors.find(
            (s) => s.dataType === "rain" || s.pin === "v4",
          );
          if (rain && Number(rain.value) === 1) newAlerts.push("Rain Detected");
        }
        setAlerts(newAlerts);
      }
    } catch (error) {
      setDeviceStatus({ serverStatus: 0, status: "Error", lastSeen: "N/A" });
    }
  };
  // --- 2. INITIALIZATION ---
  useEffect(() => {
    const init = async () => {
      try {
        const farmList = await API.getFarms();
        setFarms(farmList);
        if (farmList && farmList.length > 0) {
          setSelectedFarm(farmList[0]);
        }
      } catch (e) {
        console.error("Init Error", e);
      }
    };
    init();
  }, []);

  // --- 3. FETCH DATA ---
  useEffect(() => {
    if (!selectedFarm) return;

    // Update weather location based on farm
    setWeather((prev) => ({
      ...prev,
      city: selectedFarm.location || "Unknown",
    }));

    fetchDashboardData();
    fetchSchedules();

    const interval = setInterval(fetchDashboardData, 2000);
    return () => clearInterval(interval);
  }, [selectedFarm]);

  const fetchSchedules = async () => {
    try {
      const res = await API.getMySchedules();
      setSchedules(res);
    } catch (e) {
      console.error("Schedule Fetch Error", e);
    }
  };

  // --- 4. SCHEDULE LOGIC ---
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

  // --- 5. HANDLERS ---
  const handleFarmChange = (e) => {
    const farmId = e.target.value;
    const farm = farms.find((f) => f._id === farmId);
    setSelectedFarm(farm);
    setSensorData([]);
  };

  const handlePumpToggle = () => {
    if (mode === "ai") {
      toast.error("Switch to Manual Mode first!");
      return;
    }

    const isRunning = activeSensors.pump.value === 1;
    setPumpAction(isRunning ? "stop" : "start");

    if (!isRunning) {
      setShowPumpModal(true);
      console.log("heloojoijsk;ldfj");
    } else {
      setShowConfirmModal(true);
    }
  };

  const handlePumpModalConfirm = () => {
    setShowPumpModal(false);
    setShowConfirmModal(true);
  };

  const handleFinalConfirm = async () => {
    try {
      setLoading(true);
      setShowConfirmModal(false);
      const action = pumpAction === "start";
      await API.post("/device/control", { pin: "v8", value: action ? 1 : 0 });
      if (action)
        await API.post("/device/control", { pin: "v9", value: targetMoisture });
      toast.success(action ? "Pump Started" : "Pump Stopped");
      await fetchDashboardData();
    } catch (error) {
      console.error("Error controlling pump:", error);
      toast.error("Command Failed");
    } finally {
      setLoading(false);
    }
  };

  const getDisplayMoisture = () => {
    if (selectedMoisture === "average") return activeSensors.avgMoisture;
    if (activeSensors.moistureList.length > 0) {
      const index = parseInt(selectedMoisture.replace("moisture", "")) - 1;
      return Number(activeSensors.moistureList[index]?.value || 0);
    }
    return 0;
  };

  useEffect(() => {
    const loadWeather = async () => {
      // Use farm location or default
      const city = selectedFarm?.location || "New Delhi";
      const coords = await getCoordinates(city);
      if (coords) {
        const data = await getWeather(coords.latitude, coords.longitude);
        setLiveWeather(data);
      }
    };
    loadWeather();
  }, [selectedFarm]);
  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-10 text-slate-800">
      <Toaster position="top-right" />

      {/* HEADER */}
      <div className="bg-white  border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center py-4 gap-4">
            {/* Left side - Dynamic Farm Selector */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <FaLeaf className="text-xl" />
                </div>

                {/* FARM DROPDOWN */}
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

              {/* Dynamic Badges (Robust Fallbacks) */}
              {selectedFarm && (
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-slate-200">
                    <FaSeedling className="text-emerald-500" />{" "}
                    {selectedFarm.crop ||
                      selectedFarm.current_crop ||
                      "Mixed Crop"}
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-slate-200">
                    <FaRulerCombined className="text-blue-500" />{" "}
                    {selectedFarm.size || selectedFarm.size_acres || 0} Acres
                  </span>
                  <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-slate-200">
                    <FaMapMarkerAlt className="text-red-400" />{" "}
                    {selectedFarm.location || "Local Farm"}
                  </span>
                </div>
              )}
            </div>

            {/* Right side - Status & Tools */}
            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              {/* Inside your Dashboard Return */}
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
                    Loading Weather...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`flex h-3 w-3 rounded-full ${deviceStatus.serverStatus === 1 ? "bg-emerald-500 shadow-[0_0_10px_#10B981]" : "bg-red-500"}`}
                ></span>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {deviceStatus.serverStatus === 1 ? "Online" : "Offline"}
                </span>
              </div>

              <button
                onClick={fetchDashboardData}
                className="bg-white border border-slate-200 text-slate-400 p-2.5 rounded-xl hover:text-emerald-600 hover:border-emerald-200 hover:shadow-md transition-all active:scale-95"
                disabled={loading}
              >
                <FaSync className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <span className="block py-3 px-4 rounded-full bg-red-500/10 border border-red-500/20  text-red-500 text-sm font-semibold tracking-widest mb-1">
          {deviceStatus.serverStatus === 1
            ? ""
            : "Note: You have to Connect IoT Device/hardware to see the data and functionalities in Dashboard. नोट: डैशबोर्ड पर डेटा और कार्यक्षमता (functionalities) देखने के लिए आपको IoT डिवाइस/हार्डवेयर कनेक्ट करना होगा। "}
        </span>

        {/* Alerts Banner */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div className="bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 w-full sm:w-auto">
            <div
              className={`p-2 rounded-lg ${activeSensors.rain.value === 1 ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-300"}`}
            >
              <WiRain className="text-3xl" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Rain Sensor
              </p>
              <p
                className={`text-lg font-black ${activeSensors.rain.value === 1 ? "text-blue-600" : "text-slate-700"}`}
              >
                {activeSensors.rain.value === 1 ? "DETECTED" : "CLEAR"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={() => setShowAlertsModal(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${alerts.length > 0 ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "text-slate-400 hover:bg-slate-50"}`}
            >
              <FaExclamationTriangle />
              {alerts.length > 0
                ? `${alerts.length} Warnings`
                : "System Normal"}
            </button>
          </div>
        </div>

        {/* --- MAIN GRID --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* 1. Water Tank */}
          <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex flex-col justify-between h-[340px] relative overflow-hidden group hover:shadow-md transition-shadow">
            <div className="z-10 flex justify-between items-start">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <GiWaterTank className="text-blue-500 text-xl" /> Tank Level
              </h3>
              <span className="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-md">
                {activeSensors.tank.value * 10}L
              </span>
            </div>
            {/* Wave Animation */}
            <div className="absolute inset-x-0 bottom-0 w-full z-0 h-full overflow-hidden opacity-20 group-hover:opacity-30 transition-opacity">
              <style>{`@keyframes wave { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }`}</style>
              <div
                className="bg-blue-500 absolute w-[200%] h-[200%] rounded-[40%]"
                style={{
                  bottom: `${activeSensors.tank.value - 110}%`,
                  animation: "wave 10s infinite linear",
                }}
              />
            </div>
            <div className="z-10 mt-auto text-center">
              <span className="text-6xl font-black text-slate-800 tracking-tighter">
                {activeSensors.tank.value}%
              </span>
              <p className="text-xs text-slate-400 font-bold uppercase mt-2">
                Capacity
              </p>
            </div>
          </div>

          {/* 2. Moisture Gauge (Circular with Select) */}
          <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex flex-col items-center h-[340px] relative hover:shadow-md transition-shadow">
            <div className="w-full flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <FaLeaf className="text-emerald-500" /> Moisture
              </h3>
              <select
                value={selectedMoisture}
                onChange={(e) => setSelectedMoisture(e.target.value)}
                className="text-xs font-bold bg-slate-50 text-slate-600 border-none rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                <option value="average">Avg</option>
                {activeSensors.moistureList.map((m, idx) => (
                  <option key={idx} value={`moisture${idx + 1}`}>
                    S-{idx + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-48 h-48 my-auto">
              <svg
                className="w-full h-full rotate-[135deg]"
                viewBox="0 0 36 36"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-slate-100"
                  strokeWidth="1.5"
                  strokeDasharray="75 100"
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  className="stroke-emerald-500 transition-all duration-700 ease-out"
                  strokeWidth="3"
                  strokeDasharray={`${(getDisplayMoisture() / 100) * 75} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                <span className="text-4xl font-black text-slate-800">
                  {getDisplayMoisture()}%
                </span>
                <span className="text-[10px] font-bold text-emerald-500 uppercase">
                  Hydration
                </span>
              </div>
            </div>
          </div>

          {/* 3. Temperature (Circular) */}
          <CircularChart
            value={activeSensors.temp.value}
            label="Temperature"
            icon={FaThermometerHalf}
            colorClass="text-amber-500"
            strokeColor="stroke-amber-500"
            unit="°C"
          />

          {/* 4. Humidity (Circular) */}
          <CircularChart
            value={activeSensors.humidity.value}
            label="Humidity"
            icon={WiHumidity}
            colorClass="text-blue-500"
            strokeColor="stroke-blue-500"
            unit="%"
          />
        </div>

        {/* --- PUMP CONTROLS & SCHEDULE --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3 justify-center md:justify-start">
                  <GiValve className="text-slate-400" /> Master Pump Control
                </h3>
                <p className="text-slate-500 mt-1 font-medium">
                  Mode:{" "}
                  <span className="text-emerald-600 font-bold uppercase">
                    {mode}
                  </span>{" "}
                  • Switch:{" "}
                  <span
                    className={`font-bold ${activeSensors.btn.value === 1 ? "text-green-600" : "text-red-500"}`}
                  >
                    {activeSensors.btn.value === 1 ? "ON" : "OFF"}
                  </span>
                </p>
              </div>

              <div className="lg:flex  items-center gap-4">
                <div className="bg-slate-100 p-1 rounded-xl mb-2 flex">
                  <button
                    onClick={() => setMode("manual")}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === "manual" ? "bg-white shadow-sm text-slate-800" : "text-slate-400"}`}
                  >
                    Manual
                  </button>
                  <button
                    onClick={() => setMode("ai")}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === "ai" ? "bg-indigo-600 text-white shadow-md" : "text-slate-400"}`}
                  >
                    AI Auto
                  </button>
                </div>

                <button
                  onClick={handlePumpToggle}
                  disabled={mode === "ai" || loading}
                  className={`px-8 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 active:scale-95 transition-all
                            ${activeSensors.pump.value === 1 ? "bg-rose-500 shadow-rose-200" : "bg-emerald-500 shadow-emerald-200"}`}
                >
                  <FaPowerOff />{" "}
                  {activeSensors.pump.value === 1 ? "STOP" : "START"}
                </button>
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm flex flex-col justify-center text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 mb-2">
              <FaCalendarAlt />{" "}
              <span className="text-xs font-bold uppercase">Next Run</span>
            </div>
            {nextSchedule ? (
              <div>
                <p className="text-2xl font-black text-emerald-600">
                  {formattedDateString}
                </p>
                <p className="text-xs text-slate-500 font-medium bg-slate-50 inline-block px-3 py-1 rounded-full mt-2">
                  {nextSchedule.name}
                </p>
              </div>
            ) : (
              <p className="text-slate-400 font-bold text-sm">No Schedule</p>
            )}

            <button
              onClick={() => navigate("/schedules/new")}
              className="mt-4 text-xs font-bold text-blue-500 hover:underline"
            >
              Manage Schedules
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <ConfirmationModal
        isOpen={showPumpModal}
        onClose={() => {
          console.log("Confirmed");
          setShowPumpModal(false);
        }}
        onConfirm={handlePumpModalConfirm}
        title="Start Irrigation"
        type="default"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <label className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              <span>Target Moisture</span>
              <span className="text-emerald-600">{targetMoisture}%</span>
            </label>
            <input
              type="range"
              min="20"
              max="80"
              value={targetMoisture}
              onChange={(e) => setTargetMoisture(Number(e.target.value))}
              className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-400 uppercase">
              <span>Dry (20%)</span>
              <span>Optimal</span>
              <span>Wet (80%)</span>
            </div>
          </div>
          <p className="text-sm text-slate-500 text-center">
            Pump will run until soil moisture reaches{" "}
            <strong>{targetMoisture}%</strong>.
          </p>
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleFinalConfirm}
        title={pumpAction === "start" ? "Confirm Start" : "Confirm Stop"}
        type={pumpAction === "start" ? "default" : "warning"}
        message={
          pumpAction === "start"
            ? "Start irrigation sequence?"
            : "Stop pump immediately?"
        }
        confirmText={pumpAction === "start" ? "Start Pump" : "Stop Pump"}
      />

      {showAlertsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-slate-800">
              System Alerts
            </h3>
            {alerts.length > 0 ? (
              <ul className="space-y-2 mb-6">
                {alerts.map((a, i) => (
                  <li
                    key={i}
                    className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 flex items-center gap-3 font-medium text-sm"
                  >
                    <FaExclamationTriangle /> {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-400 mb-6 italic">No active alerts.</p>
            )}
            <button
              onClick={() => setShowAlertsModal(false)}
              className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
