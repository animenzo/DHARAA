// frontend/src/components/iot/SensorDashboard.jsx
// =============================================================================
// SensorDashboard  — grid of live sensor readings
// =============================================================================
// Renders all sensor cards and gauges.
// Receives `latest` (a SensorData object) and `isLoading` from useSensorData().
//
// Props:
//   latest     object | null   Latest sensor reading
//   isLoading  boolean
// =============================================================================

import SensorCard from "./SensorCard";
import SensorGauge from "./SensorGauge";

// ─── Sensor card config ───────────────────────────────────────────────────────
// Each entry maps a dataKey to display options.
const SENSOR_CARDS = [
  // {
  //   key: "temperature",
  //   label: "Temperature",
  //   unit: "°C",
  //   icon: "🌡️",
  //   color: "bg-amber-50",
  //   textColor: "text-amber-700",
  //   borderColor: "border-amber-200",
  // },
  {
    key: "rain",
    label: "Rain Sensor",
    unit: "",
    icon: "🌧️",
    color: "bg-indigo-50",
    textColor: "text-indigo-700",
    borderColor: "border-indigo-200",
    format: (v) => (v == null ? null : v >= 1 ? "Rain" : "Clear"),
  },
  {
    key: "pump",
    label: "Pump Status",
    unit: "",
    icon: "💧",
    color: "bg-cyan-50",
    textColor: "text-cyan-700",
    borderColor: "border-cyan-200",
    format: (v) => (v == null ? null : v === 1 ? "ON" : "OFF"),
  },
  {
    key: "valve",
    label: "Valve Status",
    unit: "",
    icon: "🔧",
    color: "bg-violet-50",
    textColor: "text-violet-700",
    borderColor: "border-violet-200",
    format: (v) => (v == null ? null : v === 1 ? "Open" : "Closed"),
  },
  {
  key:         "pumpSource",
  label:       "Pump Source",
  unit:        "",
  icon:        "⚡",
  color:       "bg-emerald-50",
  textColor:   "text-emerald-700",
  borderColor: "border-emerald-200",
  format: (v) => v || "OFF",
},
];

// ─── Gauge config ─────────────────────────────────────────────────────────────
const GAUGES = [
  { key: "avgMoisture", label: "Soil Moisture", unit: "%", color: "#10b981" },
  { key: "humidity", label: "Humidity", unit: "%", color: "#3b82f6" },
  { key: "temperature", label: "temperature", unit: "%", color: "#e90e0eff" },
];

export default function SensorDashboard({ latest = null, isLoading = false, selectedSensor = "avg",
  setSelectedSensor, }) {
  const get = (key) => latest?.[key] ?? null;

  const moistureSensors = Array.isArray(latest?.moistureSensors)
    ? latest.moistureSensors
    : [];

  const selectedMoisture =
    selectedSensor === "avg"
      ? latest?.avgMoisture
      : moistureSensors.find(
        s => s.sensorId === selectedSensor
      )?.value ?? null;

      
  return (
    <div className="space-y-4">
      {/* ── Gauges row ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Levels
        </p>
        <div className="mb-4 flex justify-end">
          <select
            value={selectedSensor}
            onChange={(e) =>
              setSelectedSensor?.(e.target.value)
            }
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="avg">
              Average Moisture
            </option>

            {moistureSensors.map((sensor) => (
              <option
                key={sensor.sensorId}
                value={sensor.sensorId}
              >
                {sensor.label || sensor.sensorId}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-around flex-wrap gap-4">
          {GAUGES.map((g) => (
            <SensorGauge
              key={g.key}
              value={g.key === "avgMoisture"
                ? selectedMoisture
                : get(g.key)}
              label={g.label}
              unit={g.unit}
              color={g.color}
              size={200}
              isLoading={isLoading}
            />
          ))}
        </div>
        {/* Manual Override Banner */}
{latest?.physicalBtn === 1 && (
  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 text-sm text-yellow-800 font-medium">
    <span>⚠️</span>
    <span>Physical Button Override Active — AI irrigation paused</span>
  </div>
)}
{latest?.powerStatus !== null && latest?.powerStatus !== undefined && (
  <div
    className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium mt-2 ${
      latest.powerStatus === 1
        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
        : "bg-red-50 border-red-300 text-red-800"
    }`}
  >
    <span>{latest.powerStatus === 1 ? "⚡" : "🔌"}</span>
    <span>
      {latest.powerStatus === 1
        ? "Electricity On — pump can operate normally"
        : "No Electricity — irrigation paused until power is restored"}
    </span>
  </div>
)}

      </div>

      {/* ── Sensor cards grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {SENSOR_CARDS.map((s) => {
          const raw = get(s.key);
          const value = s.format ? s.format(raw) : raw;
          return (
            <SensorCard
              key={s.key}
              label={s.label}
              value={value}
              unit={s.unit}
              icon={s.icon}
              color={s.color}
              textColor={s.textColor}
              borderColor={s.borderColor}
              isLoading={isLoading}
            />
          );
        })}
      </div>
    </div>
  );
}
