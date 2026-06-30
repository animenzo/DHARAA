// frontend/src/components/iot/RealtimeChart.jsx
// =============================================================================
// RealtimeChart  — live scrolling line chart
// =============================================================================
// Renders a Recharts LineChart that updates in real-time as Socket.IO
// sensorData events arrive via useSensorData().
//
// Props:
//   chartData   array    Array of normalised SensorData objects
//   isLoading   boolean
//   height      number   Chart height in px (default 200)
// =============================================================================

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// Which series to show and their colours
const STATIC_SERIES = [
  { key: "humidity", label: "Humidity %", color: "#3b82f6", yAxisId: "pct" },
  { key: "temperature", label: "Temp °C", color: "#f59e0b", yAxisId: "temp" },
  { key: "waterLevel", label: "Water Level %", color: "#0ea5e9", yAxisId: "pct" },
];

function formatTime(date) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="text-gray-400 mb-1.5 font-medium">{formatTime(label)}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-0.5">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: p.color }}
          />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-semibold text-gray-800">{p.value?.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

export default function RealtimeChart({
  chartData = [],
  isLoading = false,
  height    = 200,
  selectedSensor = "avg",
}) {
      const processedData = chartData.map((row) => {
  let moistureValue = row.avgMoisture;

  if (
    selectedSensor !== "avg" &&
    row.moistureSensors
  ) {
    moistureValue =
      row.moistureSensors.find(
        (s) => s.sensorId === selectedSensor
      )?.value ?? null;
  }

  return {
    ...row,
    moistureValue,
  };
});
  if (isLoading) {

    return (
      <div
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse"
        style={{ height: height + 60 }}
      >
        <div className="h-4 w-40 bg-gray-200 rounded mb-4" />
        <div className="h-full bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm flex items-center justify-center" style={{ height: height + 60 }}>
        <p className="text-sm text-gray-400">Waiting for sensor data…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Live Sensor Data
        </p>
        <span className="text-[10px] text-gray-400">{chartData.length} readings</span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={processedData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis
            dataKey="recordedAt"
            tickFormatter={formatTime}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            yAxisId="pct"
            domain={[0, 100]}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <YAxis
            yAxisId="temp"
            orientation="right"
            domain={[0, 60]}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
          />
          <Line
  yAxisId="pct"
  type="monotone"
  dataKey="moistureValue"
  name={
    selectedSensor === "avg"
      ? "Average Moisture %"
      : `${selectedSensor} %`
  }
  stroke="#10b981"
  dot={false}
  strokeWidth={2}
  connectNulls
  isAnimationActive={false}
/>
          {STATIC_SERIES.map((s) => (
            <Line
              key={s.key}
              yAxisId={s.yAxisId}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              dot={false}
              strokeWidth={1.8}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}