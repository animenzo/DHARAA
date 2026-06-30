
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import API from "../services/api";
import iotApi from "../services/iotApi";
import { useLocation } from "react-router-dom";
// ─── Icons ────────────────────────────────────────────────────────────────────
import {
  FaUserCircle, FaEnvelope, FaIdBadge, FaMicrochip,
  FaWifi, FaKey, FaCopy, FaCheck, FaSync, FaTerminal,
  FaEye, FaEyeSlash, FaCircle, FaLeaf, FaThermometerHalf,
  FaTint, FaCloudRain, FaWater, FaCog,
} from "react-icons/fa";
import { GiValve, GiWaterTank } from "react-icons/gi";

// =============================================================================
// Sub-components
// =============================================================================

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
        <Icon className="text-base" />
      </div>
      <div>
        <h2 className="text-sm font-bold text-slate-800">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border border-slate-100 rounded-2xl p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CopyButton({ text, size = "sm" }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handle}
      title="Copy"
      className={`flex items-center gap-1 rounded-lg font-semibold transition-colors
        ${size === "sm"
          ? "text-[11px] px-2 py-0.5"
          : "text-xs px-3 py-1.5"
        }
        ${copied
          ? "bg-emerald-50 text-emerald-600"
          : "bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
        }`}
    >
      {copied ? <FaCheck className="text-[9px]" /> : <FaCopy className="text-[9px]" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function FieldRow({ label, value, mono = false, secret = false, copyable = false }) {
  const [show, setShow] = useState(false);
  const display = secret && !show
    ? "••••••••••••••••••••••"
    : (value || "—");

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-400 flex-shrink-0 w-32">{label}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
        <span className={`text-xs text-slate-700 break-all text-right ${mono ? "font-mono" : "font-medium"}`}>
          {display}
        </span>
        {secret && (
          <button onClick={() => setShow(v => !v)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            {show ? <FaEyeSlash className="text-[11px]" /> : <FaEye className="text-[11px]" />}
          </button>
        )}
        {copyable && value && <CopyButton text={value} />}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    online: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", label: "Online" },
    offline: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500", label: "Offline" },
    unknown: { bg: "bg-slate-100", text: "text-slate-500", dot: "bg-slate-400", label: "Unknown" },
  };
  const s = map[status] || map.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === "online" ? "animate-pulse" : ""}`} />
      {s.label}
    </span>
  );
}

const SENSOR_MAP = [
  { key: "moisture", label: "Soil Moisture", icon: FaTint, color: "text-emerald-600" },
  { key: "temperature", label: "Temperature", icon: FaThermometerHalf, color: "text-amber-500" },
  { key: "humidity", label: "Humidity", icon: FaWifi, color: "text-blue-500" },
  { key: "rain", label: "Rain Sensor", icon: FaCloudRain, color: "text-sky-500" },
  { key: "waterLevel", label: "Water Level", icon: GiWaterTank, color: "text-blue-600" },
  { key: "pump", label: "Pump", icon: FaWater, color: "text-indigo-500" },
  { key: "valve", label: "Valve", icon: GiValve, color: "text-purple-500" },
];

// =============================================================================
// Main Component
// =============================================================================
export default function UserProfile() {
  // const queryClient = useQueryClient();
  const [showArduino, setShowArduino] = useState(false);

  const location = useLocation();


  const [selectedFarmId, setSelectedFarmId] = useState(location.newFarmId ?? null);

  // 1. User profile
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => (await API.get("/auth/profile")).data,
  });

  // 2. Farm list — each farm has its own device (1:1)
  const { data: farms, isLoading: farmsLoading } = useQuery({
    queryKey: ["farms"],
    queryFn: async () => (await API.get("/farms/farm")).data,
  });
  const currentFarmId = selectedFarmId || (farms?.length > 0 ? farms[0]._id : null);

  // 3. IoT Device for the selected farm (includes template)
  const { data: deviceData, isLoading: deviceLoading } = useQuery({
    queryKey: ["iotDevice", currentFarmId],
    queryFn: () => iotApi.getFarmDevice(currentFarmId),
    enabled: !!currentFarmId,
  });
  // 4. Connection info for the selected farm (broker host, port, arduinoSnippet)
  const { data: connInfo, isLoading: connLoading } = useQuery({
    queryKey: ["connectionInfo", currentFarmId],
    queryFn: () => iotApi.getConnectionInfo(currentFarmId),
    enabled: !!currentFarmId,
  });
  const device = deviceData?.device ?? null;
  const template = device?.template ?? null;
  // Regenerate token mutation


  const loading = userLoading || farmsLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <FaSync className="animate-spin" />
          <span className="text-sm font-medium">Loading profile…</span>
        </div>
      </div>
    );
  }

  const brokerUrl = connInfo?.brokerHost ? `mqtt://${connInfo.brokerHost}` : (import.meta.env.MQTT_URL || "mqtt://");
  const brokerPort = connInfo?.brokerPort ?? 1883;


  const topics = device?.topics || {};

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 font-sans">
      <Toaster position="top-right" />

      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">System Configuration</h1>
            <p className="text-sm text-slate-400 mt-0.5">Manage your IoT device, MQTT credentials, and sensor setup</p>
          </div>
          {device && <StatusPill status={device.status} />}
        </div>

        {/* ── Farm selector — each farm has its own device (1:1) ───────────── */}
        {farms && farms.length > 0 && (
          <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase">Farm</span>
            <select
              value={currentFarmId || ""}
              onChange={(e) => {
                setSelectedFarmId(e.target.value);

              }}
              className="text-sm font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              {farms.map((farm) => (
                <option key={farm._id} value={farm._id}>{farm.name}</option>
              ))}
            </select>
          </div>
        )}

        {farms && farms.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-800 text-sm">
            You don't have any farms yet. Create a farm first to provision a device.
          </div>
        )}



        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── LEFT COLUMN ───────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* User identity */}
            <Card>
              <div className="text-center mb-5">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl text-emerald-400">
                  <FaUserCircle />
                </div>
                <h2 className="text-base font-bold text-slate-800">{user?.name || "—"}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <FaEnvelope className="text-emerald-500" />
                  <span className="truncate">{user?.email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <FaIdBadge className="text-emerald-500" />
                  <span className="font-mono text-[10px] truncate">ID: {user?._id}</span>
                </div>
              </div>
            </Card>

            {/* Device overview */}
            {device && (
              <Card>
                <SectionTitle icon={FaMicrochip} title="Device Overview" />
                <div className="space-y-2">
                  {farms?.map((farm) => (
                    <div
                      key={farm._id}
                      className="flex justify-between items-center p-3 rounded-xl bg-slate-50"
                    >
                      <div>
                        <p className="font-semibold">
                          {farm.name}
                        </p>

                        <p className="text-xs text-slate-500">
                          Device ID:
                          {farm.deviceId || "Not Assigned"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <FieldRow label="Device Name" value={device.name} />
                <FieldRow label="Device ID" value={device.deviceId} mono copyable />
                <FieldRow label="Hardware" value={device.hardwareType || "ESP32"} />
                <FieldRow label="Status" value={device.status} />
                <FieldRow label="Active" value={device.isActive ? "Yes — has connected" : "Not yet connected"} />
                <FieldRow label="Firmware" value={device.firmwareVersion || "unknown"} mono />
                <FieldRow
                  label="Last Seen"
                  value={device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "Never"}
                />
              </Card>
            )}

            {!device && (
              <Card>
                <p className="text-sm text-slate-400 text-center py-4">
                  No device provisioned yet.
                </p>
              </Card>
            )}

          </div>

          {/* ── RIGHT COLUMN ──────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* MQTT Credentials */}
            <Card>
              <SectionTitle
                icon={FaKey}
                title="MQTT Credentials"
                subtitle="Flash these to your ESP32 firmware"
              />


              <FieldRow label="Broker URL" value={brokerUrl} mono copyable />
              <FieldRow label="Broker Port" value={String(brokerPort)} mono copyable />


            </Card>

            {/* MQTT Topics */}
            <Card>
              <SectionTitle
                icon={FaWifi}
                title="MQTT Topic Structure"
                subtitle={`farm/{deviceId}/…`}
              />
              {Object.keys(topics).length > 0 ? (
                <div className="space-y-2">
                  {[
                    { key: "data", desc: "ESP32 → Broker: sensor readings" },
                    { key: "status", desc: "ESP32 → Broker: online/offline (LWT)" },
                    { key: "cmd", desc: "Broker → ESP32: pump/valve commands" },
                    { key: "config", desc: "Broker → ESP32: config updates (retained)" },
                  ].map(({ key, desc }) => (
                    <div key={key} className="bg-slate-50 rounded-xl p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 w-10">{key}</span>
                          <code className="text-[11px] font-mono text-slate-700 break-all">
                            {topics[key] || "—"}
                          </code>
                        </div>
                        <p className="text-[10px] text-slate-400 ml-12">{desc}</p>
                      </div>
                      <CopyButton text={topics[key]} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">Topics not generated yet. Provision a device first.</p>
              )}

              {/* ACK topic info */}
              {topics.cmd && (
                <div className="mt-3 bg-indigo-50 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 w-10">ack</span>
                      <code className="text-[11px] font-mono text-indigo-700 break-all">
                        {topics.cmd}/ack
                      </code>
                    </div>
                    <p className="text-[10px] text-indigo-400 ml-12">ESP32 → Broker: command acknowledgement</p>
                  </div>
                  <CopyButton text={`${topics.cmd}/ack`} />
                </div>
              )}
            </Card>

            {/* Template & Sensors */}
            {template && (
              <Card>
                <SectionTitle
                  icon={FaCog}
                  title="Device Template"
                  subtitle={template.name || "Smart Irrigation Template"}
                />
                <p className="text-xs text-slate-400 mb-4">{template.description || "Auto-generated precision irrigation template"}</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SENSOR_MAP.map(({ key, label, icon: Icon, color }) => {
                    const widget = template.widgets?.find(w =>
                      w.dataStream?.toLowerCase() === key ||
                      w.label?.toLowerCase().includes(key)
                    );
                    const enabled = !template.widgets || widget !== undefined;
                    return (
                      <div
                        key={key}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium
                          ${enabled
                            ? "bg-slate-50 border-slate-200 text-slate-700"
                            : "bg-slate-50 border-slate-100 text-slate-300"
                          }`}
                      >
                        <Icon className={`text-base ${enabled ? color : "text-slate-300"}`} />
                        {label}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* ESP32 Connection Guide */}
            <Card>
              <SectionTitle
                icon={FaTerminal}
                title="ESP32 Connection Guide"
                subtitle="Copy this into your Arduino firmware"
              />

              <button
                onClick={() => setShowArduino(v => !v)}
                className="w-full flex items-center justify-between text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3 mb-4 transition-colors"
              >
                <span>{showArduino ? "Hide" : "Show"} Arduino Config Block</span>
                <span>{showArduino ? "▲" : "▼"}</span>
              </button>

              {showArduino && connInfo?.arduinoSnippet && (
                <div className="relative">
                  <pre className="bg-slate-900 text-emerald-400 text-[11px] font-mono p-4 rounded-xl overflow-x-auto leading-relaxed">
                    {connInfo.arduinoSnippet}
                  </pre>
                  <div className="absolute top-2 right-2">
                    <CopyButton text={connInfo.arduinoSnippet} size="md" />
                  </div>
                </div>
              )}

              {/* Step-by-step guide */}
              <div className="mt-4 space-y-3">
                {[
                  { step: "1", title: "Install PubSubClient", desc: "In Arduino IDE: Sketch → Include Library → Manage Libraries → search 'PubSubClient' by Nick O'Leary" },
                  { step: "2", title: "Configure WiFi", desc: "Set your SSID and password in the firmware constants" },
                  { step: "3", title: "Copy config block", desc: "Paste the Arduino config block above into your .ino file" },
                  { step: "4", title: "Publish sensor data", desc: `Publish JSON to: ${topics.data || "farm/{deviceId}/data"}` },
                  { step: "5", title: "Send status on boot", desc: `Publish {"status":"online"} to: ${topics.status || "farm/{deviceId}/status"}` },
                  { step: "6", title: "Subscribe to commands", desc: `Subscribe to: ${topics.cmd || "farm/{deviceId}/cmd"} to receive pump/valve commands` },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {step}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono break-all">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Payload example */}
              <div className="mt-5">
                <p className="text-xs font-semibold text-slate-600 mb-2">Example Sensor Payload (JSON → MQTT /data)</p>
                <pre className="bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-mono p-4 rounded-xl overflow-x-auto">
                  {`{
  "moisture1": 65,
  "moisture2": 62,
  "temperature": 28.5,
  "humidity": 72,
  "rain": 0,
  "waterLevel": 80,
  "pump": 0,
  "physicalBtn": 0
}`}
                </pre>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
