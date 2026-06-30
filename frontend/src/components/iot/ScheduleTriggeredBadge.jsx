// frontend/src/components/iot/ScheduleTriggeredBadge.jsx
// =============================================================================
// ScheduleTriggeredBadge  (Phase 9)
// =============================================================================
// Small visual badge shown when the last pump command was triggered by an
// irrigation schedule rather than a manual user action.
//
// Usage:
//   <ScheduleTriggeredBadge source="schedule" scheduleName="Morning Irrigation" />
//
// Renders nothing when source is "manual" or undefined.
// =============================================================================

export default function ScheduleTriggeredBadge({ source, scheduleName }) {
  if (!source || source === "manual") return null;

  const configs = {
    schedule: {
      icon:  "📅",
      label: scheduleName ? `Schedule: ${scheduleName}` : "Schedule triggered",
      cls:   "bg-purple-50 text-purple-700 border-purple-200",
    },
    ai: {
      icon:  "🤖",
      label: "AI triggered",
      cls:   "bg-orange-50 text-orange-700 border-orange-200",
    },
    threshold: {
      icon:  "⚡",
      label: "Auto-triggered",
      cls:   "bg-teal-50 text-teal-700 border-teal-200",
    },
  };

  const cfg = configs[source] ?? configs.schedule;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}
