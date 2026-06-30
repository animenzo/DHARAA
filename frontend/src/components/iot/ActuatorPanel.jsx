import { useState, useCallback, useEffect } from "react";
import ConfirmationModal from "../dashboard/ConfirmationModal";
import { useCommandControl } from "../../hooks/useCommandControl";
import { useSocket } from "../../context/SocketContext";
import API from "../../services/api";
// ─── Sub-component: single actuator toggle ───────────────────────────────────
function ActuatorToggle({
  label,
  icon,
  currentValue,
  actuator,
  disabled,
  onRequest,
  commandState,
  isLoading,
  retry,
  cancel,
  clearState,
  physicalBtn,
  isOnline
}) {
  const { status, error, commandId, value: cmdValue } = commandState;
  const isWaiting = status === "pending";
  const nextValue = currentValue === 1 ? 0 : 1;

  const theme = actuator === "pump"
    ? { on: "bg-emerald-500 hover:bg-emerald-600", indicator: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    : { on: "bg-sky-500 hover:bg-sky-600", indicator: "bg-sky-500", badge: "bg-sky-50 text-sky-700 border-sky-200" };

  const offLabels = { pump: "Turn OFF", valve: "Close" };
  const onLabels = { pump: "Turn ON", valve: "Open" };
  const stateLabel = currentValue === 1
    ? { pump: "ON", valve: "OPEN" }[actuator]
    : { pump: "OFF", valve: "CLOSED" }[actuator];

  let btnClass = "";
  let btnText = currentValue === 1 ? offLabels[actuator] : onLabels[actuator];

  if (disabled) {
  btnClass = "bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200";
  btnText = physicalBtn === 1 ? "Physical Control Active" : !isOnline ? "Device Offline" : "Unavailable";
} else if (isWaiting || isLoading) {
    btnClass = "bg-blue-50 text-blue-600 border-blue-200 cursor-wait";
    btnText = "Sending…";
  } else if (currentValue === 1) {
    btnClass = "bg-red-500 hover:bg-red-600 active:bg-red-700 text-white border-transparent shadow-sm";
  } else {
    btnClass = `${theme.on} active:opacity-80 text-white border-transparent shadow-sm`;
  }

  const statusStrips = {
    pending: "bg-blue-50 text-blue-700 border-blue-200",
    delivered: "bg-blue-50 text-blue-700 border-blue-200",
    acked: "bg-emerald-50 text-emerald-700 border-emerald-200",
    timeout: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-gray-50 text-gray-500 border-gray-200",
  };
  const statusIcons = { pending: "🔄", delivered: "📡", acked: "✅", timeout: "⏱", failed: "❌", cancelled: "🚫" };
  const statusLabels = {
    pending: "Sending…",
    delivered: "Waiting for ESP32…",
    acked: `${label} ${cmdValue ? (actuator === "valve" ? "OPEN" : "ON") : (actuator === "valve" ? "CLOSED" : "OFF")} — confirmed`,
    timeout: "No response from ESP32",
    failed: error || "Command failed",
    cancelled: "Cancelled",
  };

  return (
    <div className="flex-1 min-w-0">
      {/* Label + state badge */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-semibold text-gray-700">{label}</span>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${currentValue === 1 ? theme.badge : "bg-gray-100 text-gray-500 border-gray-200"}`}>
          {currentValue === 1 ? `● ${stateLabel}` : `○ ${stateLabel}`}
        </span>
      </div>

      {/* Toggle button */}
      <button
        onClick={() => !isWaiting && !disabled && !isLoading && onRequest(actuator, nextValue)}
        disabled={isWaiting || disabled || isLoading}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
          border text-sm font-semibold transition-all duration-150 ${btnClass}`}
      >
        {(isWaiting || isLoading) && (
          <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        )}
        {btnText}
      </button>

      {/* Status strip */}
      {status !== "idle" && (
        <div className={`mt-2 rounded-lg border px-2.5 py-2 text-xs flex items-center gap-1.5 ${statusStrips[status] ?? ""}`}>
          <span className="text-sm">{statusIcons[status]}</span>
          <span className="flex-1 truncate">{statusLabels[status]}</span>
          <div className="flex gap-1 flex-shrink-0">
            {status === "delivered" && (
              <button onClick={() => cancel(commandId)} className="text-[10px] underline opacity-70 hover:opacity-100">Cancel</button>
            )}
            {(status === "timeout" || status === "failed") && commandId && (
              <button onClick={() => retry(commandId)} className="text-[10px] underline opacity-70 hover:opacity-100">Retry</button>
            )}
            {["acked", "timeout", "failed", "cancelled"].includes(status) && (
              <button onClick={clearState} className="text-[10px] opacity-50 hover:opacity-80">✕</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ActuatorPanel
// =============================================================================
// Props:
//   latest        object  — latest sensor reading { pump, valve, ... }
//   isOnline      bool    — from useDeviceStatus().isOnline  ← FIXED PROP
//   deviceStatus  string  — "online"|"offline"|"stale"|"unknown" (display only)
// =============================================================================
export default function ActuatorPanel({
  farmId,
  latest,
  isOnline = false,    // ← NEW: single bool from useDeviceStatus().isOnline
  deviceStatus = "unknown", // kept for header badge display
}) {
    const physicalBtn = latest?.physicalBtn ?? 0;
  const [mode, setMode] = useState("manual");
  const [pumpState, setPumpState] = useState(latest?.pump ?? 0);
  const { socket, isRoomJoined } = useSocket();

  const isDisabled = !isOnline || !farmId || mode === "ai" || physicalBtn === 1;
 
  const pump = useCommandControl(farmId);
  
  const [showPumpModal, setShowPumpModal] = useState(false);
  const [targetMoisture, setTargetMoisture] = useState(30);
  const [confirm, setConfirm] = useState({
    open: false,
    actuator: null,
    value: null,
    meta: {},
  });

 const _dispatch = useCallback((actuator, value, meta = {}) => {
  setConfirm({ open: false, actuator: null, value: null, meta: {} });

  if (actuator === "pump") {
    setPumpState(value); // Update UI immediately
    pump.sendCommand("pump", value, "manual", meta);
  }

  console.log("Sending command:", actuator, value);
}, [pump]);
const handleRequest = useCallback((actuator, nextValue) => {
  // Turn OFF directly
  if (nextValue === 0) {
    _dispatch(actuator, nextValue);
    return;
  }

  // Pump ON → open moisture modal first
  if (actuator === "pump" && nextValue === 1) {
    setShowPumpModal(true);
    return;
  }

  // Valve ON → normal confirmation
  
}, [_dispatch]); // eslint-disable-line react-hooks/exhaustive-deps
const handlePumpModalConfirm = () => {
  setShowPumpModal(false);

  setConfirm({
    open: true,
    actuator: "pump",
    value: 1,
    meta: { targetMoisture },
  });
};


  const confirmLabel = confirm.actuator === "pump"
    ? confirm.value === 1 ? "Turn Pump ON" : "Turn Pump OFF"
    : confirm.value === 1 ? "Open Valve" : "Close Valve";

  const confirmMsg = confirm.actuator === "pump"
    ? confirm.value === 1
      ? "This will start the irrigation pump. "
      : "This will stop the irrigation pump."
    : confirm.value === 1
      ? "This will open the main irrigation valve. Ensure the pump is ready."
      : "This will close the main irrigation valve.";

  // Status badge for the header
  const statusBadge = {
    online: { text: "Online", cls: "text-emerald-600" },
    stale: { text: "Stale", cls: "text-amber-500" },
    offline: { text: "Offline", cls: "text-red-500" },
    unknown: { text: "Unknown", cls: "text-gray-400" },
  }[deviceStatus] ?? { text: deviceStatus, cls: "text-gray-400" };

 const handleModeChange = async (newMode) => {
  // Optimistically update the UI immediately.
  setMode(newMode);
  try {
    await API.patch(`/iot/${farmId}/ai-mode`, {
      enabled: newMode === "ai",
    });
    // On success the backend emits "aiModeChanged" via socket,
    // which the effect above picks up — no extra setMode() needed here.
  } catch (err) {
    console.error("Failed to persist AI mode:", err);
    // Revert to whichever mode was active before this click.
    // Using functional form avoids stale-closure over `mode`.
    setMode(prev => (prev === "ai" ? "manual" : "ai"));
  }
};

  // ── Load persisted AI mode on mount / farm change ──────────────────────────
  useEffect(() => {
    if (!farmId) return;
    API.get(`/farms/farm/${farmId}`)
      .then(res => {
        // res.data may be the farm directly or { farm: ... } depending on controller
        const farm = res.data?.farm ?? res.data;
        setMode(farm?.aiAutoEnabled ? "ai" : "manual");
      })
      .catch(() => {});
  }, [farmId]);
  useEffect(() => {
  setPumpState(latest?.pump ?? 0);
}, [latest?.pump]);

  // ── Cross-tab / cross-device AI mode sync via Socket.IO ────────────────────
  // The backend emits "aiModeChanged" whenever PATCH /iot/:farmId/ai-mode runs,
  // so a second browser tab (or the mobile app) toggling AI mode is reflected
  // here immediately without a page reload.
  useEffect(() => {
    if (!socket || !isRoomJoined || !farmId) return;

    const onAiModeChanged = ({ farmId: changedFarmId, aiAutoEnabled }) => {
      // Only update if the event is for the farm this panel is showing.
      if (changedFarmId?.toString() !== farmId?.toString()) return;
      setMode(aiAutoEnabled ? "ai" : "manual");
    };

    socket.on("aiModeChanged", onAiModeChanged);
    return () => socket.off("aiModeChanged", onAiModeChanged);
  }, [socket, isRoomJoined, farmId]);

  console.log(latest?.pump, typeof latest?.pump);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">
            Actuator Control
          </h3>

          <p className="text-xs text-gray-500 mt-1">
            Mode:
            <span
              className={`ml-1 font-semibold ${mode === "ai"
                  ? "text-indigo-600"
                  : "text-emerald-600"
                }`}
            >
              {mode === "ai" ? "AI AUTO" : "MANUAL"}
            </span>
          </p>
        </div>
        <span className={`text-xs font-medium flex items-center gap-1 ${statusBadge.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full inline-block ${isDisabled ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
          {statusBadge.text}
        </span>
      </div>
      <div className="mb-4 flex justify-center">
        <div className="bg-gray-100 p-1 rounded-xl flex">
          <button
            onClick={() => handleModeChange("manual")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === "manual"
                ? "bg-white shadow-sm text-gray-800"
                : "text-gray-500"
              }`}
          >
            Manual
          </button>

          <button
            onClick={() => handleModeChange("ai")}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === "ai"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-gray-500"
              }`}
          >
            AI Auto
          </button>
        </div>
      </div>

      {/* Two side-by-side actuator toggles */}
      <div className="flex gap-4">
        <ActuatorToggle
          label="Pump"
          icon="💧"
          actuator="pump"
          currentValue={pumpState}
          disabled={isDisabled}
          onRequest={handleRequest}
          commandState={pump.commandState}
          isLoading={pump.isLoading}
          retry={pump.retry}
          cancel={pump.cancel}
          clearState={pump.clearState}
          physicalBtn={physicalBtn}
          isOnline={isOnline}
        />
        <div className="w-px bg-gray-100 self-stretch" />
{/* Physical button status */}
<div className={`mb-4 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium
  ${physicalBtn === 1
    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
    : "bg-gray-50 border-gray-200 text-gray-400"
  }`}>
  <span className={`w-2 h-2 rounded-full flex-shrink-0
    ${physicalBtn === 1 ? "bg-emerald-500 animate-pulse" : "bg-gray-300"}`}
  />
  <span>
    Physical Button:&nbsp;
    <strong>{physicalBtn === 1 ? "ON" : "OFF"}</strong>
  </span>
</div>
      </div>


      <ConfirmationModal
        isOpen={showPumpModal}
        onClose={() => setShowPumpModal(false)}
        onConfirm={handlePumpModalConfirm}
        title="Start Irrigation"
        type="default"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <label className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              <span>Target Moisture</span>
              <span className="text-emerald-600">
                {targetMoisture}%
              </span>
            </label>

            <input
              type="range"
              min="20"
              max="80"
              value={targetMoisture}
              onChange={(e) =>
                setTargetMoisture(Number(e.target.value))
              }
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
      {/* Confirmation dialog */}
      <ConfirmationModal
        isOpen={confirm.open}
        onClose={() => setConfirm({ open: false, actuator: null, value: null, meta: {} })}
        onConfirm={() => _dispatch(confirm.actuator, confirm.value, confirm.meta)}
        title={confirmLabel}
        message={confirmMsg}
        confirmText={confirmLabel}
        cancelText="Cancel"
        type={confirm.value === 1 ? "warning" : "default"}
      />
    </div>
  );
}