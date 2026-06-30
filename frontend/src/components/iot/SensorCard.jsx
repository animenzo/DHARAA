// frontend/src/components/iot/SensorCard.jsx
// =============================================================================
// SensorCard  — single sensor reading tile
// =============================================================================
// Displays a sensor value with a large number, unit, label, icon and
// an optional colour-coded severity band.
//
// Props:
//   label      string       e.g. "Temperature"
//   value      number|null  Current reading
//   unit       string       e.g. "°C"
//   icon       string       Emoji icon
//   color      string       Tailwind bg colour class  e.g. "bg-amber-50"
//   textColor  string       Tailwind text colour       e.g. "text-amber-600"
//   borderColor string      Tailwind border colour     e.g. "border-amber-200"
//   isLoading  boolean
//   className  string       Extra wrapper classes
// =============================================================================

export default function SensorCard({
  label       = "Sensor",
  value       = null,
  unit        = "",
  icon        = "📡",
  color       = "bg-gray-50",
  textColor   = "text-gray-700",
  borderColor = "border-gray-200",
  isLoading   = false,
  className   = "",
}) {
  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm animate-pulse ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-gray-200" />
          <div className="h-3 w-24 bg-gray-200 rounded" />
        </div>
        <div className="h-8 w-16 bg-gray-200 rounded mt-1" />
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 shadow-sm transition-colors ${color} ${borderColor} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl" aria-hidden="true">{icon}</span>
        <span className={`text-xs font-medium ${textColor} opacity-70`}>{label}</span>
      </div>

      {/* Value */}
      <div className="flex items-end gap-1">
        <span className={`text-3xl font-bold leading-none ${textColor}`}>
          {value == null ? "—" : typeof value === "number" ? value.toFixed(value % 1 === 0 ? 0 : 1) : value}
        </span>
        {unit && (
          <span className={`text-sm font-medium mb-0.5 ${textColor} opacity-70`}>{unit}</span>
        )}
      </div>
    </div>
  );
}