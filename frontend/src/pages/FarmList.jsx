import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import toast, { Toaster } from "react-hot-toast";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaMapMarkerAlt,
  FaSeedling,
  FaRulerCombined,
  FaLeaf,
  FaTractor,
} from "react-icons/fa";
import { GiGroundSprout } from "react-icons/gi";
import { formatFarmAreaAcres, getCropLabel, getSoilLabel } from "../utils/farmDisplay";
const fetchFarms = async () => {
  const res = await API.get("/farms/farm");
  return res.data;
};

const removeFarm = async (id) => {
  const res = await API.delete(`/farms/farm/${id}`);
  return res.data;
};
// --- Sub-Component: Farm Card ---
const FarmCard = ({ farm, onEdit, onDelete }) => {
  return (
    <div className="group bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-100 overflow-hidden transition-all duration-300 hover:-translate-y-1">
      {/* Visual Header (Color coded by active status) */}
      <div
        className={`h-3 w-full ${farm.status === "Active" ? "bg-emerald-500" : "bg-gray-300"}`}
      />

      <div className="p-4">
        {/* Header: Name & Status */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="text-xl font-bold text-gray-800 group-hover:text-emerald-700 transition-colors">
              {farm.name}
            </h3>
            <div className="flex items-center text-sm text-gray-500 gap-1 mt-1">
              <FaMapMarkerAlt className="text-red-400" />
              <span className="truncate max-w-[150px]">
                {farm.location || "Unknown Location"}
              </span>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
              farm.status === "Active"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {farm.status}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-50">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <FaSeedling />
              <span className="text-xs font-bold uppercase">Crop</span>
            </div>
            <p className="font-bold text-gray-800">{getCropLabel(farm.current_crop)}</p>
          </div>

          <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-50">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <FaRulerCombined />
              <span className="text-xs font-bold uppercase">Size</span>
            </div>
            <p className="font-bold text-gray-800">
              {formatFarmAreaAcres(farm)}{" "}
              <span className="text-xs font-normal text-gray-500">Meter Sq.</span>
            </p>
          </div>
        </div>

        {/* Soil Badge */}
        <div className="flex items-center gap-2 mb-2 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg inline-block w-full">
          {/* CHANGE HERE */}
          <GiGroundSprout className="text-amber-600 text-lg" />
          <span className="font-medium">Soil:</span>
          {getSoilLabel(farm.soilType)}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => onEdit(farm._id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 font-semibold transition-all text-sm"
          >
            <FaEdit /> Edit
          </button>
          <button
            onClick={() => onDelete(farm._id)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 font-semibold transition-all text-sm"
          >
            <FaTrash />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main List Component ---
const FarmList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Fetch Farms
  const {
    data: farms,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  // 2. Delete Logic
  const deleteMutation = useMutation({
    mutationFn: removeFarm,
    onSuccess: () => {
      toast.success("Farm removed successfully");
      queryClient.invalidateQueries(["farms"]);
    },
    onError: () => toast.error("Failed to delete farm"),
  });

  const handleDelete = (id) => {
    if (
      window.confirm(
        "Are you sure? All schedules linked to this farm will also be affected.",
      )
    ) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-8 font-sans">
      <Toaster position="top-right" />

      {/* Page Header */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FaLeaf className="text-emerald-500" /> My Farms
            </h1>
            <p className="text-gray-500 mt-1">
              Monitor and manage your land parcels.
            </p>
          </div>

          <button
            onClick={() => navigate("/farms/new")}
            className="group flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold shadow-xl transition-all hover:-translate-y-1 active:scale-95"
          >
            <FaPlus className="group-hover:rotate-90 transition-transform duration-300" />
            Add New Farm
          </button>
        </div>
      </div>

      {/* Content Area */}
      {isError ? (
        <div className="max-w-md mx-auto text-center py-20">
          <p className="text-red-500 font-bold mb-2">Error loading farms.</p>
          <button
            onClick={() => window.location.reload()}
            className="underline"
          >
            Retry
          </button>
        </div>
      ) : farms?.length === 0 ? (
        // Empty State
        <div className="max-w-lg mx-auto text-center py-24 px-6 bg-white rounded-3xl border-2 border-dashed border-gray-200">
          <div className="bg-emerald-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
            <FaTractor className="text-4xl text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            No Farms Added Yet
          </h2>
          <p className="text-gray-500 mb-8">
            Start by adding your first field details. We'll help you track crops
            and irrigation.
          </p>
          <button
            onClick={() => navigate("/farms/new")}
            className="text-emerald-600 font-bold hover:underline"
          >
            + Create your first farm
          </button>
        </div>
      ) : (
        // Grid List
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
          {farms.map((farm) => (
            <FarmCard
              key={farm._id}
              farm={farm}
              onEdit={(id) => navigate(`/farms/${id}/edit`)} // Assuming you will create this route
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FarmList;
