import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFarms } from "../../services/scheduleApi"; // Adjust path
import iotApi from "../../services/iotApi";
import ConfirmationModal from "../dashboard/ConfirmationModal";
import {
  FaCalendarAlt,
  FaClock,
  FaWater,
  FaSave,
  FaTimes,
} from "react-icons/fa";
import { GiFarmTractor } from "react-icons/gi";
import toast from "react-hot-toast";

// --- Global UI Components (Defined outside to prevent unmounting/character input bug) ---
const InputGroup = ({ label, icon: Icon, children }) => (
  <div className="flex flex-col gap-2">
    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
      {Icon && <Icon className="text-emerald-500" />} {label}
    </label>
    {children}
  </div>
);

const StyledInput = (props) => (
  <input
    {...props}
    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none bg-gray-50 focus:bg-white transition-all"
  />
);

const ScheduleForm = ({ initialData, onSubmit, isSubmitting, onCancel }) => {
  // --- State ---
  const [formData, setFormData] = useState({
    name: "",
    farmId: "",
    zone: "",
    time: "",
    moisture: 30, // Default target moisture
    date: "",     // Single-run Date
    status: "Active",
    notes: "",
  });

  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || "",
        farmId: typeof initialData.farmId === "object" ? initialData.farmId._id : (initialData.farmId || ""),
        zone: initialData.zone || "",
        time: initialData.time || "",
        moisture: initialData.moisture !== undefined && initialData.moisture !== null ? initialData.moisture : 30,
        date: initialData.date || "",
        status: initialData.status || "Active",
        notes: initialData.notes || "",
      });
    }
  }, [initialData]);

  // Fetch Farms for Dropdown
  const { data: farms, isLoading: loadingFarms } = useQuery({
    queryKey: ["farms"],
    queryFn: getFarms,
  });

  // Fetch latest sensor reading for current moisture warning
  const { data: latestReadingData } = useQuery({
    queryKey: ["latestReading", formData.farmId],
    queryFn: () => iotApi.getLatestReading(formData.farmId),
    enabled: !!formData.farmId,
  });

  const currentMoisture = latestReadingData?.reading?.avgMoisture;

  // --- Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.farmId) return toast.error("Please select a farm");
    if (!formData.date) return toast.error("Please select a date");
    if (formData.moisture === undefined || formData.moisture === "") {
      return toast.error("Please select target moisture");
    }

    const moistureVal = Number(formData.moisture);

    // Warning Checks
    const isTargetTooHigh = moistureVal > 95;
    const isCurrentTooHigh = currentMoisture !== undefined && currentMoisture !== null && currentMoisture >= 90;

    if (isTargetTooHigh || isCurrentTooHigh) {
      let msg = "";
      if (isTargetTooHigh && isCurrentTooHigh) {
        msg = `The target moisture is set to ${moistureVal}% (greater than 95%), and the current soil moisture is already ${currentMoisture}% (90% or above). This may lead to severe over-irrigation.`;
      } else if (isTargetTooHigh) {
        msg = `The target moisture is set to ${moistureVal}% (greater than 95%), which is very high and may cause over-irrigation.`;
      } else {
        msg = `The current soil moisture is already ${currentMoisture}% (90% or above). Running irrigation now may cause over-irrigation.`;
      }
      msg += " Do you want to proceed and save this schedule anyway?";
      setWarningMessage(msg);
      setShowWarningModal(true);
      return;
    }

    // Direct submit if no warnings
    onSubmit({
      ...formData,
      moisture: moistureVal,
      duration: undefined // Ensure duration is cleared when submitting
    });
  };

  const handleConfirmSave = () => {
    setShowWarningModal(false);
    onSubmit({
      ...formData,
      moisture: Number(formData.moisture),
      duration: undefined
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-2xl mx-auto"
    >
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <FaCalendarAlt className="text-emerald-600" />
        {initialData ? "Edit Schedule" : "Create New Schedule"}
      </h2>

      <div className="space-y-6">
        {/* Name & Farm */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputGroup label="Schedule Name" icon={FaCalendarAlt}>
            <StyledInput
              name="name"
              placeholder="e.g. Morning Drip"
              value={formData.name}
              onChange={handleChange}
              
            />
          </InputGroup>

          <InputGroup label="Select Farm" icon={GiFarmTractor}>
            <select
              name="farmId"
              value={formData.farmId}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none bg-gray-50"
              required
              disabled={loadingFarms}
            >
              <option value="">
                {loadingFarms ? "Loading farms..." : "Select a Farm"}
              </option>
              {farms?.map((farm) => (
                <option key={farm._id} value={farm._id}>
                  {farm.name}
                </option>
              ))}
            </select>
          </InputGroup>
        </div>

        {/* Zone & Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputGroup label="Zone / Field Area" icon={FaWater}>
            <StyledInput
              name="zone"
              placeholder="e.g. North Sector"
              value={formData.zone}
              onChange={handleChange}
              
            />
          </InputGroup>

          <InputGroup label="Status">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {["Active", "Paused"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, status }))}
                  className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${
                    formData.status === status
                      ? status === "Active"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "bg-amber-500 text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </InputGroup>
        </div>

        {/* Time & Moisture Range */}
        <div className="bg-emerald-50/50 p-6 rounded-xl border border-emerald-100 grid grid-cols-1 md:grid-cols-2 gap-6">
          <InputGroup label="Start Time" icon={FaClock}>
            <StyledInput
              type="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
              required
            />
          </InputGroup>

          <InputGroup label={`Target Moisture (${formData.moisture}%)`} icon={FaWater}>
            <div className="space-y-2 mt-2">
              <input
                type="range"
                name="moisture"
                min="0"
                max="100"
                value={formData.moisture}
                onChange={(e) => setFormData((prev) => ({ ...prev, moisture: Number(e.target.value) }))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                <span>0% (Dry)</span>
                <span>50% (Optimal)</span>
                <span>100% (Wet)</span>
              </div>
            </div>
          </InputGroup>
        </div>

        {/* Schedule Date Selection */}
        <div className="space-y-3">
          <InputGroup label="Schedule Date" icon={FaCalendarAlt}>
            <StyledInput
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </InputGroup>
        </div>

        {/* Notes */}
        <InputGroup label="Notes (Optional)">
          <textarea
            name="notes"
            placeholder="Any special instructions..."
            rows="2"
            value={formData.notes}
            onChange={handleChange}
            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-emerald-500 outline-none bg-gray-50 resize-none"
          />
        </InputGroup>

        {/* Actions */}
        <div className="pt-6 flex justify-end gap-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 rounded-lg text-gray-600 hover:bg-gray-100 font-bold transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              "Saving..."
            ) : (
              <>
                <FaSave /> Save Schedule
              </>
            )}
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onConfirm={handleConfirmSave}
        title="High Moisture Warning"
        message={warningMessage}
        type="warning"
        confirmText="Save Anyway"
        cancelText="Cancel"
      />
    </form>
  );
};

export default ScheduleForm;
