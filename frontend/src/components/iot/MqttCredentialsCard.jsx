// frontend/src/components/iot/MqttCredentialsCard.jsx
// =============================================================================
// MqttCredentialsCard
// =============================================================================
// Compact card shown on IoTDashboard left column.
// Displays device ID, auth token (masked), broker URL, and topic shortcuts.
// Links to /profile for full details.
//
// Props: none (fetches own data)
// =============================================================================

import { useState } from "react";
import { Link }     from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import iotApi       from "../../services/iotApi";
import { FaKey, FaCopy, FaCheck, FaEye, FaEyeSlash, FaExternalLinkAlt } from "react-icons/fa";

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text || "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handle} className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5">
      {copied ? <FaCheck className="text-[9px]" /> : <FaCopy className="text-[9px]" />}
      {copied ? "✓" : "Copy"}
    </button>
  );
}

export default function MqttCredentialsCard({farmId}) {
  const [showToken, setShowToken] = useState(false);

   const { data, isLoading } = useQuery({
    queryKey:  ["iotDevice", farmId],
    queryFn:   () => iotApi.getFarmDevice(farmId),
    enabled:   !!farmId,
    staleTime: 60_000,
    retry:     1,
  });

  const { data: connInfo } = useQuery({
    queryKey:  ["connectionInfo", farmId],
    queryFn:   () => iotApi.getConnectionInfo(farmId),
    enabled:   !!farmId,
    staleTime: 300_000,
    retry:     1,
  });

  const device = data?.device;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm animate-pulse">
        <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
        {[1,2,3].map(i => <div key={i} className="h-2 w-full bg-gray-100 rounded mb-2" />)}
      </div>
    );
  }

  if (!device) return null;

  const broker = connInfo?.brokerHost
    ? `${connInfo.brokerHost}:${connInfo.brokerPort ?? 1883}`
    : "Not configured";

  const tokenDisplay = showToken
    ? device.authToken
    : device.authToken
      ? `${device.authToken.substring(0, 8)}••••••••`
      : "—";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FaKey className="text-amber-500 text-xs" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">MQTT Credentials</span>
        </div>
        <Link to="/profile" className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1">
          Full Setup <FaExternalLinkAlt className="text-[8px]" />
        </Link>
      </div>

      {/* Device ID */}
      <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
        <span className="text-[11px] text-gray-400">Device ID</span>
        <div className="flex items-center gap-2">
          <code className="text-[11px] font-mono text-gray-700">{device.deviceId}</code>
          <CopyBtn text={device.deviceId} />
        </div>
      </div>

      {/* Auth Token */}
      <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
        <span className="text-[11px] text-gray-400">Auth Token</span>
        <div className="flex items-center gap-2">
          <code className="text-[11px] font-mono text-gray-700">{tokenDisplay}</code>
          <button onClick={() => setShowToken(v => !v)} className="text-gray-400 hover:text-gray-600">
            {showToken ? <FaEyeSlash className="text-[10px]" /> : <FaEye className="text-[10px]" />}
          </button>
          <CopyBtn text={device.authToken} />
        </div>
      </div>

      {/* Broker */}
      <div className="flex items-center justify-between py-1.5">
        <span className="text-[11px] text-gray-400">Broker</span>
        <div className="flex items-center gap-2">
          <code className="text-[11px] font-mono text-gray-600">{broker}</code>
          <CopyBtn text={broker} />
        </div>
      </div>
    </div>
  );
}
