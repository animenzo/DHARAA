import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFarms } from "../../services/scheduleApi"; // Adjust path
import {
  FaCalendarAlt,
  FaClock,
  FaWater,
  FaSave,
  FaTimes,
} from "react-icons/fa";
import { GiFarmTractor } from "react-icons/gi";
import toast from "react-hot-toast";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ScheduleForm = ({ initialData, onSubmit, isSubmitting, onCancel }) => {
  // --- State ---
  const [formData, setFormData] = useState({
    name: "",
    farmId: "",
    zone: "",
    time: "",
    duration: "",
    days: [false, false, false, false, false, false, false], // 7 Booleans
    status: "Active",
    notes: "",
  });

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  // Fetch Farms for Dropdown
  const { data: farms, isLoading: loadingFarms } = useQuery({
    queryKey: ["farms"],
    queryFn: getFarms,
  });

  // --- Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleDay = (index) => {
    const newDays = [...formData.days];
    newDays[index] = !newDays[index];
    setFormData((prev) => ({ ...prev, days: newDays }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    if (!formData.farmId) return toast.error("Please select a farm");
    if (!formData.days.includes(true))
      return toast.error("Select at least one day");

    onSubmit(formData);
  };

  // --- UI Components ---
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
              required
            />
          </InputGroup>

          <InputGroup label="Select Farm" icon={GiFarmTractor}>
            <select
              name="farmId"
              value={formData.farmId} // Ensure ID matches exactly
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
              required
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

        {/* Time & Duration */}
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

          <InputGroup label="Duration (Minutes)" icon={FaClock}>
            <StyledInput
              type="number"
              name="duration"
              min="1"
              placeholder="30"
              value={formData.duration}
              onChange={handleChange}
              required
            />
          </InputGroup>
        </div>

        {/* Days Selection */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-gray-700">Days Active</label>
          <div className="flex flex-wrap justify-between gap-2">
            {DAYS.map((day, index) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(index)}
                className={`
                  w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all
                  ${
                    formData.days[index]
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                  }
                `}
              >
                {day}
              </button>
            ))}
          </div>
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
    </form>
  );
};

export default ScheduleForm;
