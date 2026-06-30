// frontend/src/components/iot/MqttStatusBadge.jsx
// =============================================================================
// MqttStatusBadge
// =============================================================================
// Displays a live Socket.IO + MQTT broker connection status pill.
// Used in:
//   • SideBar.jsx      — small inline pill below the logo
//   • IoTDashboard.jsx — full badge in the header
//   • IoTPlaceholder   — standalone display before Phase 10
//
// Props:
//   size  "sm" | "md" (default "md")
// =============================================================================

import { useSocket } from "../../context/SocketContext";

const MqttStatusBadge = ({ size = "md" }) => {
  const { isConnected, isRoomJoined } = useSocket();

  // Determine state
  let state, label, dotClass, badgeClass;

  if (isConnected && isRoomJoined) {
    state      = "live";
    label      = "";
    dotClass   = "bg-emerald-500 animate-pulse";
    badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (isConnected && !isRoomJoined) {
    state      = "joining";
    label      = "Joining room…";
    dotClass   = "bg-yellow-400 animate-pulse";
    badgeClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
  } else {
    state      = "offline";
    label      = "";
    dotClass   = "bg-red-400";
    badgeClass = "bg-red-50 text-red-600 border-red-200";
  }

  if (size === "sm") {
    return (
      <div className={`inline-flex items-center gap-1.5  rounded-full  text-xs font-medium ${badgeClass}`}>
        {/* <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} /> */}
        {label}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border font-medium text-sm ${badgeClass}`}>
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
      <span>
        {state === "live"
          ? "Real-time connected"
          : state === "joining"
          ? "Establishing room…"
          : "Socket.IO disconnected — retrying"}
      </span>
    </div>
  );
};

export default MqttStatusBadge;
