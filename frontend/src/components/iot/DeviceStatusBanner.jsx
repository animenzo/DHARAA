
import { useState, useEffect } from "react";
import { useDeviceStatus }     from "../../hooks/useDeviceStatus";

export default function DeviceStatusBanner({farmId}) {
  const { status, lastSeen, isLoading } = useDeviceStatus(farmId);
  const [dismissed, setDismissed]       = useState(false);

  // Re-show the banner whenever the status changes to a non-online state
  useEffect(() => {
    if (status !== "online") {
      setDismissed(false);
    }
  }, [status]);

  // Don't render while loading or when everything is fine
  if (isLoading || status === "online" || dismissed) return null;

  // ─── Config per status ──────────────────────────────────────────────────────
  const banners = {
    offline: {
      icon:    "🔴",
      title:   "Device Offline",
      message: lastSeen
        ? `Your ESP32 disconnected. Last seen: ${new Date(lastSeen).toLocaleString()}.`
        : "Your ESP32 is not connected to the broker.",
      classes: "bg-red-50 border-red-300 text-red-800",
      btnClass:"text-red-500 hover:text-red-700",
    },
    stale: {
      icon:    "⚠️",
      title:   "No Heartbeat Received",
      message: "The device is registered as online but hasn't sent data recently. It may be stuck.",
      classes: "bg-amber-50 border-amber-300 text-amber-800",
      btnClass:"text-amber-500 hover:text-amber-700",
    },
    unknown: {
      icon:    "ℹ️",
      title:   "Device Not Yet Connected",
      message: "Flash the authToken to your ESP32 and power it on to start receiving sensor data.",
      classes: "bg-blue-50 border-blue-300 text-blue-800",
      btnClass:"text-blue-500 hover:text-blue-700",
    },
  };

  const cfg = banners[status] ?? banners.unknown;

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm mb-4 ${cfg.classes}`}
    >
      {/* Icon */}
      <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">
        {cfg.icon}
      </span>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold">{cfg.title}</p>
        <p className="mt-0.5 text-xs opacity-80">{cfg.message}</p>
      </div>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className={`flex-shrink-0 text-lg leading-none font-bold transition-colors ${cfg.btnClass}`}
        aria-label="Dismiss banner"
      >
        ×
      </button>
    </div>
  );
}
