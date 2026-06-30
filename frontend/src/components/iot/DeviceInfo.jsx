// frontend/src/components/iot/DeviceInfo.jsx
// =============================================================================
// DeviceInfo  — device metadata + MQTT connection details card
// =============================================================================
// Shows deviceId, firmware version, MQTT topics, and last-seen timestamp.
// Also surfaces the Arduino config snippet from GET /iot/device/connection-info.
//
// Props:
//   device     object | null   Device document from GET /iot/device
//   isLoading  boolean
// =============================================================================

import { useState } from "react";

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
      <span className={`text-xs font-medium text-gray-700 text-right break-all ${mono ? "font-mono" : ""}`}>
        {value ?? <span className="text-gray-300">—</span>}
      </span>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export default function DeviceInfo({ device = null, isLoading = false }) {
  const [showTopics, setShowTopics] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm animate-pulse">
        <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-3 w-full bg-gray-100 rounded mb-2" />
        ))}
      </div>
    );
  }

  if (!device) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-400 text-center">No device provisioned yet.</p>
      </div>
    );
  }

  const topics = device.topics || {};

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Device Info
        </p>
        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {device.deviceId}
        </span>
      </div>

      <div className="space-y-0">
        <InfoRow label="Name"         value={device.name} />
        <InfoRow label="Hardware"     value={device.hardwareType || "ESP32"} />
        <InfoRow label="Status"       value={device.status} />
        <InfoRow label="Active"       value={device.isActive ? "Yes" : "Not yet connected"} />
        <InfoRow label="Firmware"     value={device.firmwareVersion || "unknown"} mono />
        <InfoRow
          label="Last Seen"
          value={device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "Never"}
        />
      </div>

      {/* MQTT Topics section (collapsible) */}
      <button
        onClick={() => setShowTopics((v) => !v)}
        className="mt-4 w-full flex items-center justify-between text-xs font-medium text-emerald-600 hover:text-emerald-700"
      >
        <span>MQTT Topics</span>
        <span className="text-gray-400">{showTopics ? "▲" : "▼"}</span>
      </button>

      {showTopics && (
        <div className="mt-2 space-y-1.5 bg-gray-50 rounded-xl p-3">
          {Object.entries(topics).map(([key, topic]) => (
            <div key={key} className="flex items-start justify-between gap-2">
              <span className="text-[10px] text-gray-400 uppercase w-12 flex-shrink-0 mt-0.5">
                {key}
              </span>
              <span className="text-[10px] font-mono text-gray-600 flex-1 break-all">
                {topic}
              </span>
              <CopyButton text={topic} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}