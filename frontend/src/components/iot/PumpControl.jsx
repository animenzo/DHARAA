// frontend/src/components/iot/PumpControl.jsx
// =============================================================================
// PumpControl
// =============================================================================
// One-tap pump on/off button with full ACK lifecycle feedback.
//
// Visual states:
//   idle        — "Turn ON" / "Turn OFF" button ready
//   pending     — spinner, "Sending…"
//   delivered   — spinner, "Waiting for ESP32…" + cancel button
//   acked       — green flash, "Pump ON / OFF — confirmed"  auto-resets 3 s
//   timeout     — amber warning, "No response" + retry button
//   failed      — red warning, message + retry button
//   cancelled   — grey, "Cancelled" auto-resets 2 s
//
// Props:
//   currentPumpValue   number  0 | 1   — current pump state from live sensor data
//   disabled           bool            — true while device is offline
// =============================================================================

import { useEffect } from "react";
import { useCommandControl } from "../../hooks/useCommandControl";

// ─── Sub-components ───────────────────────────────────────────────────────────

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

// ─── Status feedback bar ──────────────────────────────────────────────────────
function StatusBar({ commandState, onRetry, onCancel, onClear }) {
  const { status, error, commandId, actuator, value } = commandState;

  if (status === "idle") return null;

  const configs = {
    pending:   { color: "bg-blue-50 border-blue-200 text-blue-700",   icon: "🔄", label: "Sending command…" },
    delivered: { color: "bg-blue-50 border-blue-200 text-blue-700",   icon: "📡", label: "Waiting for ESP32 acknowledgement…" },
    acked:     { color: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: "✅", label: `${actuator === "pump" ? "Pump" : "Valve"} ${value ? "ON" : "OFF"} — confirmed by device` },
    timeout:   { color: "bg-amber-50 border-amber-200 text-amber-700", icon: "⏱", label: "No response from ESP32" },
    failed:    { color: "bg-red-50 border-red-200 text-red-700",       icon: "❌", label: error || "Command failed" },
    cancelled: { color: "bg-gray-50 border-gray-200 text-gray-600",   icon: "🚫", label: "Command cancelled" },
  };

  const cfg = configs[status] ?? configs.pending;

  return (
    <div className={`mt-3 rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2 ${cfg.color}`}>
      <span className="flex-shrink-0 text-base leading-none">{cfg.icon}</span>
      <span className="flex-1">{cfg.label}</span>
      <div className="flex gap-1.5 flex-shrink-0">
        {/* Cancel — available while waiting for ACK */}
        {status === "delivered" && (
          <button
            onClick={() => onCancel(commandId)}
            className="text-[10px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            Cancel
          </button>
        )}
        {/* Retry — available after timeout or failure */}
        {(status === "timeout" || status === "failed") && commandId && (
          <button
            onClick={() => onRetry(commandId)}
            className="text-[10px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            Retry
          </button>
        )}
        {/* Dismiss — available when terminal */}
        {["acked", "timeout", "failed", "cancelled"].includes(status) && (
          <button
            onClick={onClear}
            className="text-[10px] font-semibold opacity-50 hover:opacity-80"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PumpControl
// =============================================================================
export default function PumpControl({ currentPumpValue = 0, disabled = false }) {
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

  // Auto-reset after ACK or cancel
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

  // Desired next value — the opposite of current state
  const nextValue  = currentPumpValue === 1 ? 0 : 1;
  const actionLabel = currentPumpValue === 1 ? "Turn Pump OFF" : "Turn Pump ON";

  const handleToggle = async () => {
    if (isWaiting || disabled) return;
    try {
      await sendCommand("pump", nextValue);
    } catch {
      // error already captured in commandState
    }
  };

  // ── Button style by state ───────────────────────────────────────────────────
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
  } else if (currentPumpValue === 1) {
    // Pump is ON → show OFF button
    btnClass = "bg-red-500 hover:bg-red-600 active:bg-red-700 text-white border-transparent shadow-sm";
  } else {
    // Pump is OFF → show ON button
    btnClass = "bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white border-transparent shadow-sm";
  }

  return (
    <div className="w-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-700">Pump Control</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border
          ${currentPumpValue === 1
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-gray-100 text-gray-500 border-gray-200"}`}
        >
          {currentPumpValue === 1 ? "● ON" : "○ OFF"}
        </span>
      </div>

      {/* ── Toggle button ──────────────────────────────────────────────────── */}
      <button
        onClick={handleToggle}
        disabled={isWaiting || disabled || isLoading}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
          border text-sm font-semibold transition-all duration-150 ${btnClass}`}
      >
        {btnIcon}
        {btnLabel}
      </button>

      {/* ── ACK status feedback ────────────────────────────────────────────── */}
      <StatusBar
        commandState={commandState}
        onRetry={retry}
        onCancel={cancel}
        onClear={clearState}
      />
    </div>
  );
}