// frontend/src/components/iot/CommandHistoryPanel.jsx
// =============================================================================
// CommandHistoryPanel  (Phase 9)
// =============================================================================
// Live audit log of all pump/valve commands.
//
// Features:
//   - Loads last 20 commands from GET /iot/command/history on mount
//   - Prepends new commands in real-time via Socket.IO "commandSent" event
//   - Updates command status when "commandAck" / "commandTimeout" arrives
//   - Shows source badge: Manual / Schedule / AI
//   - Color-codes by status: delivered (blue), acked (green), timeout (amber),
//     failed (red), cancelled (gray)
//   - "Retry" button for failed/timeout commands
// =============================================================================

import { useState, useEffect, useCallback }  from "react";
import { useSocket }                          from "../../context/SocketContext";
import iotApi                                 from "../../services/iotApi";
import axiosInstance                          from "../../services/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  if (!dateStr) return "—";
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 5)    return "just now";
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const STATUS_STYLES = {
  pending:   "bg-blue-50 text-blue-600 border-blue-100",
  delivered: "bg-blue-50 text-blue-700 border-blue-100",
  acked:     "bg-emerald-50 text-emerald-700 border-emerald-100",
  timeout:   "bg-amber-50 text-amber-700 border-amber-100",
  failed:    "bg-red-50 text-red-700 border-red-100",
  cancelled: "bg-gray-50 text-gray-500 border-gray-100",
};

const STATUS_ICONS = {
  pending:   "🔄",
  delivered: "📡",
  acked:     "✅",
  timeout:   "⏱",
  failed:    "❌",
  cancelled: "🚫",
};

const SOURCE_BADGES = {
  manual:   { label: "Manual",   cls: "bg-gray-100 text-gray-600" },
  schedule: { label: "Schedule", cls: "bg-purple-100 text-purple-700" },
  ai:       { label: "AI",       cls: "bg-orange-100 text-orange-700" },
  threshold:{ label: "Auto",     cls: "bg-teal-100 text-teal-700" },
};

// ─── Single row ───────────────────────────────────────────────────────────────
function CommandRow({ cmd, onRetry }) {
  const badge  = SOURCE_BADGES[cmd.source] ?? SOURCE_BADGES.manual;
  const style  = STATUS_STYLES[cmd.mqttStatus] ?? STATUS_STYLES.pending;
  const icon   = STATUS_ICONS[cmd.mqttStatus]  ?? "🔄";
  const isRetryable = cmd.mqttStatus === "failed" || cmd.mqttStatus === "timeout";

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 ">
      {/* Actuator icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-base">
        {cmd.actuator === "pump" ? "💧" : "🔧"}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold text-gray-700 capitalize">
            {cmd.actuator}
          </span>
          <span className={`text-xs font-bold ${cmd.value === 1 ? "text-emerald-600" : "text-red-500"}`}>
            {cmd.actuator === "valve"
              ? (cmd.value === 1 ? "OPEN" : "CLOSE")
              : (cmd.value === 1 ? "ON"   : "OFF")}
          </span>
          {/* Source badge */}
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          {relativeTime(cmd.issuedAt)}
        </p>
      </div>

      {/* Status badge + retry */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 ${style}`}>
          <span>{icon}</span>
          <span className="hidden sm:inline">{cmd.mqttStatus}</span>
        </span>
        {isRetryable && (
          <button
            onClick={() => onRetry(cmd._id)}
            className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CommandHistoryPanel
// =============================================================================
export default function CommandHistoryPanel({farmId}) {
  const { socket, isRoomJoined } = useSocket();
  const [commands,  setCommands]  = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState(null);

  // ── Initial load ────────────────────────────────────────────────────────────
  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!farmId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        const data = await iotApi.getCommandHistory(farmId, 20);
        if (!cancelled) setCommands(data.commands || []);
      } catch (err) {
        if (!cancelled) setError("Failed to load command history");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [farmId]);

  // ── Retry handler ────────────────────────────────────────────────────────────
  const handleRetry = useCallback(async (commandId) => {
    try {
      await axiosInstance.post(`/iot/command/${commandId}/retry`);
      // Status update will arrive via Socket.IO commandSent event
    } catch (err) {
      console.error("Retry failed:", err.message);
    }
  }, []);

  // ── Socket.IO live updates ────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !isRoomJoined) return;

    // New command sent → prepend to list
    const onCommandSent = (data) => {
      setCommands((prev) => {
        const entry = {
          _id:        data.commandId,
          cmdId:      data.cmdId,
          actuator:   data.actuator,
          value:      data.value,
          source:     data.source || "manual",
          mqttStatus: "delivered",
          issuedAt:   data.issuedAt || new Date().toISOString(),
        };
        // Avoid duplicates
        const exists = prev.some((c) => c._id === data.commandId);
        return exists ? prev : [entry, ...prev].slice(0, 50);
      });
    };

    // ACK or timeout → update existing entry status
    const patchCommand = (data) => {
      setCommands((prev) =>
        prev.map((c) =>
          c._id === data.commandId || c._id?.toString() === data.commandId
            ? { ...c, mqttStatus: data.mqttStatus || (data.ok ? "acked" : "failed"), ackedAt: data.ackedAt }
            : c
        )
      );
    };

    socket.on("commandSent",      onCommandSent);
    socket.on("commandAck",       patchCommand);
    socket.on("commandTimeout",   patchCommand);
    socket.on("commandCancelled", patchCommand);

    return () => {
      socket.off("commandSent",      onCommandSent);
      socket.off("commandAck",       patchCommand);
      socket.off("commandTimeout",   patchCommand);
      socket.off("commandCancelled", patchCommand);
    };
  }, [socket, isRoomJoined]);

  return (
    <div className="bg-white rounded-2xl border overflow-y-auto h-64 border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Command History</h3>
        <span className="text-xs text-gray-400">Last 20 commands</span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2.5">
          {[1,2,3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2 animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-gray-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-32" />
                <div className="h-2.5 bg-gray-100 rounded w-16" />
              </div>
              <div className="w-16 h-5 bg-gray-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-red-500 py-4 text-center">{error}</p>
      ) : commands.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm text-gray-400">No commands sent yet.</p>
          <p className="text-xs text-gray-300 mt-1">Use the pump or valve controls above.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {commands.map((cmd) => (
            <CommandRow key={cmd._id} cmd={cmd} onRetry={handleRetry} />
          ))}
        </div>
      )}
    </div>
  );
}
