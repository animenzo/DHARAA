
import { useDeviceStatus } from "../../hooks/useDeviceStatus";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(date) {
  if (!date) return "Never";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60)   return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

function StatusDot({ status }) {
  const classes = {
    online:  "bg-emerald-500 animate-pulse",
    offline: "bg-red-500",
    stale:   "bg-amber-400 animate-pulse",
    unknown: "bg-gray-400",
  };
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${classes[status] ?? classes.unknown}`}
    />
  );
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  online: {
    label:       "Online",
    badgeClass:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
    cardClass:   "border-emerald-200 bg-emerald-50/30",
    description: "Device is connected and sending data.",
  },
  offline: {
    label:       "Offline",
    badgeClass:  "bg-red-50 text-red-700 border border-red-200",
    cardClass:   "border-red-200 bg-red-50/30",
    description: "Device is disconnected. Check power and Wi-Fi.",
  },
  stale: {
    label:       "No Heartbeat",
    badgeClass:  "bg-amber-50 text-amber-700 border border-amber-200",
    cardClass:   "border-amber-200 bg-amber-50/30",
    description: "Device is overdue. It may be stuck or losing connectivity.",
  },
  unknown: {
    label:       "Never Connected",
    badgeClass:  "bg-gray-100 text-gray-600 border border-gray-200",
    cardClass:   "border-gray-200 bg-gray-50/30",
    description: "Flash the authToken to your ESP32 to get started.",
  },
};

// =============================================================================
// DeviceStatusCard
// =============================================================================
export default function DeviceStatusCard({farmId, className = "" }) {
  const { status, lastSeen, isLoading, error, offlineThresholdMinutes } = useDeviceStatus(farmId);

  // ── Loading state ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 rounded-full bg-gray-200" />
          <div className="h-4 w-28 bg-gray-200 rounded" />
          <div className="ml-auto h-6 w-16 bg-gray-200 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm ${className}`}>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unknown;

  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition-colors ${cfg.cardClass} ${className}`}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-4">
        <StatusDot status={status} />
        <span className="text-sm font-semibold text-gray-800">Device Status</span>
        <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full ${cfg.badgeClass}`}>
          {cfg.label}
        </span>
      </div>

      {/* ── Description ────────────────────────────────────────────────────── */}
      <p className="text-xs text-gray-500 mb-4">{cfg.description}</p>

      {/* ── Meta ───────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5 text-xs text-gray-600">
        <div className="flex justify-between">
          <span className="text-gray-400">Last seen</span>
          <span className="font-medium">{formatRelativeTime(lastSeen)}</span>
        </div>
        {lastSeen && (
          <div className="flex justify-between">
            <span className="text-gray-400">Exact time</span>
            <span className="font-mono text-[10px]">
              {new Date(lastSeen).toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-400">Offline after</span>
          <span className="font-medium">{offlineThresholdMinutes} min silence</span>
        </div>
      </div>

      {/* ── Offline reconnect hint ──────────────────────────────────────────── */}
      {status === "offline" && (
        <div className="mt-4 rounded-lg bg-red-100/60 border border-red-200 px-3 py-2.5 text-xs text-red-700">
          <p className="font-semibold mb-1">Reconnect steps:</p>
          <ol className="list-decimal list-inside space-y-0.5 text-red-600">
            <li>Check device power supply</li>
            <li>Verify Wi-Fi credentials on ESP32</li>
            <li>Confirm MQTT broker is reachable</li>
            <li>Re-flash firmware if needed</li>
          </ol>
        </div>
      )}

      {/* ── Stale hint ─────────────────────────────────────────────────────── */}
      {status === "stale" && (
        <div className="mt-4 rounded-lg bg-amber-100/60 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
          Device is registered as online but hasn't reported in over{" "}
          {offlineThresholdMinutes} minutes. It will be marked offline automatically.
        </div>
      )}
    </div>
  );
}
