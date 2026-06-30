import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import API from "../../services/api";
import toast, { Toaster } from "react-hot-toast";
import {
  FaPlus,
  FaTrash,
  FaMicrochip,
  FaThermometerHalf,
  FaTint,
  FaWater,
  FaPowerOff,
  FaLeaf,
  FaSearch,
  FaSpinner,
  FaEdit,
} from "react-icons/fa";
import { MdSensors } from "react-icons/md";

const PIN_OPTIONS = Array.from({ length: 32 }, (_, i) => `v${i}`);

const DATA_TYPES = [
  { value: "temperature", label: "Temperature", icon: <FaThermometerHalf /> },
  { value: "humidity", label: "Humidity", icon: <FaTint /> },
  { value: "moisture", label: "Soil Moisture", icon: <FaLeaf /> },
  { value: "tank", label: "Water Level", icon: <FaWater /> },
  { value: "switch", label: "Switch / Pump", icon: <FaPowerOff /> },
  { value: "generic", label: "Generic Value", icon: <MdSensors /> },
];

const PinManager = ({ farmId }) => {
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  // Form State
  const [newPin, setNewPin] = useState({
    pin: "v0",
    label: "",
    dataType: "temperature",
  });

  // Fetch Existing Pins
  const { data: pins = [], isLoading } = useQuery({
    queryKey: ["pins", farmId],
    queryFn: async () => {
      try {
        return await API.getFarmPins(farmId);
      } catch (e) {
        return [];
      }
    },
    enabled: !!farmId,
  });

  // --- ACTIONS ---

  // 1. Manual Add
  const addMutation = useMutation({
    mutationFn: (data) => API.addPin({ ...data, farmId }),
    onSuccess: () => {
      toast.success("Sensor added!");
      queryClient.invalidateQueries(["pins", farmId]);
      setNewPin({ ...newPin, label: "" });
    },
    onError: (err) =>
      toast.error(err.response?.data?.message || "Failed to add"),
  });

  // 2. Delete
  const deleteMutation = useMutation({
    mutationFn: (id) => API.deletePin(id),
    onSuccess: () => {
      toast.success("Deleted");
      queryClient.invalidateQueries(["pins", farmId]);
    },
  });

  // 3. AUTO-SCAN (The Feature You Want)
  const scanMutation = useMutation({
    mutationFn: () => API.post("/device/discover", { farmId }),
    onMutate: () => setIsScanning(true),
    onSuccess: (data) => {
      setIsScanning(false);
      const count = data.data?.newPins?.length || 0;
      if (count > 0) {
        toast.success(`Found ${count} new sensors! Check the list.`);
        queryClient.invalidateQueries(["pins", farmId]);
      } else {
        toast("Scan complete. No new active pins found.");
      }
    },
    onError: () => {
      setIsScanning(false);
      toast.error("Scan failed. Check if device is online.");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!newPin.label) return toast.error("Please name your sensor");
    addMutation.mutate(newPin);
  };

  if (!farmId) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FaMicrochip className="text-emerald-500" /> Sensor Mapping
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Map your Blynk pins (V0, V1...) to Dashboard widgets.
          </p>
        </div>

        {/* SCAN BUTTON */}
        <button
          onClick={() => scanMutation.mutate()}
          disabled={isScanning}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isScanning ? <FaSpinner className="animate-spin" /> : <FaSearch />}
          {isScanning ? "Scanning Device..." : "Auto-Detect Sensors"}
        </button>
      </div>

      <div className="p-6 space-y-8">
        {/* --- EXISTING PINS LIST --- */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Active Configuration ({pins.length})
            </h3>
          </div>

          {isLoading && (
            <div className="text-center py-4 text-gray-400">Loading...</div>
          )}

          {pins.length === 0 && !isLoading && (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
              <p className="text-gray-500 font-medium">
                No sensors mapped yet.
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Click "Auto-Detect" above or add manually below.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pins.map((pin) => (
              <div
                key={pin._id}
                className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-emerald-200 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-600 flex items-center justify-center text-xl transition-colors">
                    {DATA_TYPES.find((t) => t.value === pin.dataType)?.icon || (
                      <MdSensors />
                    )}
                  </div>

                  <div>
                    {/* Editable-looking label */}
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-800">{pin.label}</h4>
                      {/* Note: In a real app, clicking this would open an edit modal */}
                      <FaEdit
                        className="text-gray-300 text-xs cursor-pointer hover:text-emerald-500"
                        title="Delete and Re-add to rename"
                      />
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                        {pin.pin}
                      </span>
                      <span className="text-xs text-gray-400 capitalize border-l border-gray-300 pl-2">
                        {
                          DATA_TYPES.find((t) => t.value === pin.dataType)
                            ?.label
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteMutation.mutate(pin._id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-all"
                  title="Remove Sensor"
                >
                  <FaTrash size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* --- MANUAL ADD FORM --- */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-50 p-5 rounded-xl border border-slate-200 opacity-80 hover:opacity-100 transition-opacity"
        >
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Manual Add
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Pin
              </label>
              <select
                className="w-full p-2.5 rounded-lg border border-gray-300 bg-white"
                value={newPin.pin}
                onChange={(e) => setNewPin({ ...newPin, pin: e.target.value })}
              >
                {PIN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-5">
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Label
              </label>
              <input
                type="text"
                className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. Moisture Sensor 1"
                value={newPin.label}
                onChange={(e) =>
                  setNewPin({ ...newPin, label: e.target.value })
                }
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-gray-500 mb-1">
                Type
              </label>
              <select
                className="w-full p-2.5 rounded-lg border border-gray-300 bg-white"
                value={newPin.dataType}
                onChange={(e) =>
                  setNewPin({ ...newPin, dataType: e.target.value })
                }
              >
                {DATA_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="w-full p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center justify-center shadow-lg"
              >
                {addMutation.isPending ? "..." : <FaPlus />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinManager;
