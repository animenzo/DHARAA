// frontend/src/components/iot/ValveControl.jsx
// =============================================================================
// ValveControl
// =============================================================================
// Standalone valve open/close widget.
// Mirrors PumpControl exactly in structure — same ACK lifecycle, same states.
//
// Props:
//   currentValveValue   number  0 | 1   — current valve state from sensor data
//   disabled            bool            — true when device is offline
// =============================================================================

import { useEffect } from "react";
import { useCommandControl } from "../../hooks/useCommandControl";

function Spinner({ size = 16 }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function StatusBar({ commandState, onRetry, onCancel, onClear }) {
  const { status, error, commandId, actuator, value } = commandState;
  if (status === "idle") return null;

  const configs = {
    pending:   { color: "bg-blue-50 border-blue-200 text-blue-700",             icon: "🔄", label: "Sending command…" },
    delivered: { color: "bg-blue-50 border-blue-200 text-blue-700",             icon: "📡", label: "Waiting for ESP32 acknowledgement…" },
    acked:     { color: "bg-emerald-50 border-emerald-200 text-emerald-700",    icon: "✅", label: `Valve ${value ? "OPEN" : "CLOSED"} — confirmed by device` },
    timeout:   { color: "bg-amber-50 border-amber-200 text-amber-700",          icon: "⏱", label: "No response from ESP32" },
    failed:    { color: "bg-red-50 border-red-200 text-red-700",                icon: "❌", label: error || "Command failed" },
    cancelled: { color: "bg-gray-50 border-gray-200 text-gray-600",             icon: "🚫", label: "Command cancelled" },
  };

  const cfg = configs[status] ?? configs.pending;

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2 ${cfg.color}`}>
      <span className="flex-shrink-0 text-base leading-none">{cfg.icon}</span>
      <span className="flex-1">{cfg.label}</span>
      <div className="flex gap-1.5 flex-shrink-0">
        {status === "delivered" && (
          <button
            onClick={() => onCancel(commandId)}
            className="text-[10px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            Cancel
          </button>
        )}
        {(status === "timeout" || status === "failed") && commandId && (
          <button
            onClick={() => onRetry(commandId)}
            className="text-[10px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            Retry
          </button>
        )}
        {["acked", "timeout", "failed", "cancelled"].includes(status) && (
          <button onClick={onClear} className="text-[10px] font-semibold opacity-50 hover:opacity-80">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function ValveControl({ currentValveValue = 0, disabled = false }) {
  const {
    sendCommand,
    retry,
    cancel,
    commandState,
    isLoading,
    clearState,
  } = useCommandControl();

  const { status } = commandState;
  const isWaiting  = status === "pending" || status === "delivered";

  useEffect(() => {
    if (status === "acked") {
      const t = setTimeout(clearState, 3000);
      return () => clearTimeout(t);
    }
    if (status === "cancelled") {
      const t = setTimeout(clearState, 2000);
      return () => clearTimeout(t);
    }
  }, [status, clearState]);

  const nextValue    = currentValveValue === 1 ? 0 : 1;
  const actionLabel  = currentValveValue === 1 ? "Close Valve" : "Open Valve";

  const handleToggle = async () => {
    if (isWaiting || disabled) return;
    try {
      await sendCommand("valve", nextValue);
    } catch {
      // error captured in commandState
    }
  };

  let btnClass = "";
  let btnLabel  = actionLabel;
  let btnIcon   = null;

  if (disabled) {
    btnClass = "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200";
    btnLabel  = "Device Offline";
  } else if (isWaiting || isLoading) {
    btnClass = "bg-blue-50 text-blue-600 border-blue-200 cursor-wait";
    btnLabel  = "Sending…";
    btnIcon   = <Spinner size={14} />;
  } else if (currentValveValue === 1) {
    btnClass = "bg-red-500 hover:bg-red-600 active:bg-red-700 text-white border-transparent shadow-sm";
  } else {
    btnClass = "bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white border-transparent shadow-sm";
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">Valve Control</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border
          ${currentValveValue === 1
            ? "bg-sky-50 text-sky-700 border-sky-200"
            : "bg-gray-100 text-gray-500 border-gray-200"}`}
        >
          {currentValveValue === 1 ? "● OPEN" : "○ CLOSED"}
        </span>
      </div>

      {/* Toggle button */}
      <button
        onClick={handleToggle}
        disabled={isWaiting || disabled || isLoading}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
          border text-sm font-semibold transition-all duration-150 ${btnClass}`}
      >
        {btnIcon}
        {btnLabel}
      </button>

      {/* ACK status feedback */}
      <StatusBar
        commandState={commandState}
        onRetry={retry}
        onCancel={cancel}
        onClear={clearState}
      />
    </div>
  );
}
