import { FaCalendarAlt, FaClock, FaCloudRain, FaTint, FaWater } from "react-icons/fa";

const value = (input, suffix = "") =>
  input === null || input === undefined || input === "" ? "—" : `${input}${suffix}`;

const dateLabel = (input) => {
  if (!input) return "Not scheduled";
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? input : date.toLocaleDateString();
};

export default function SmartIrrigationCard({ result, farmName, compact = false }) {
  const schedule = result?.schedule;
  const water = result?.waterRequirement;
  const execution = result?.execution;
  const prediction = result?.prediction?.futureMoisture;
  const latestPrediction = prediction?.predictions?.[0] || prediction?.[0];

  if (!schedule && !water && !execution) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-400">
        No generated smart-irrigation result{farmName ? ` for ${farmName}` : ""}.
      </div>
    );
  }

  const stats = [
    [FaCalendarAlt, "Date", dateLabel(schedule?.selected_date)],
    [FaClock, "Start", value(schedule?.selected_time)],
    [FaTint, "Target moisture", value(water?.required_theta ?? schedule?.stop_moisture ?? execution?.stopMoisture, "%")],
    [FaWater, "Required water", value(water?.required_water_liter, " L")],
    [FaCloudRain, "Rain probability", value(water?.future_rain_probability, "%")],
    
  ];

  return (
    <article className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">AI generated schedule</p>
          <h3 className="text-lg font-bold text-slate-800">{farmName || "Smart irrigation"}</h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase text-emerald-700">
          {execution?.status || schedule?.status || "Unknown"}
        </span>
      </div>
      <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3"} gap-3`}>
        {stats.map(([Icon, label, display]) => (
          <div key={label} className="rounded-xl bg-slate-50 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-400"><Icon />{label}</div>
            <p className="font-bold text-slate-700">{display}</p>
          </div>
        ))}
      </div>
      {(schedule?.reasons?.[0] || water?.reason) && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          {schedule?.reasons?.[0] || water.reason}
        </p>
      )}
    </article>
  );
}
