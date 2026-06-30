import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import API from "../../services/api";
import FarmForm from "./FarmForm"; // Reusing your existing form!
import toast, { Toaster } from "react-hot-toast";

const FarmEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // 1. Fetch Existing Farm Data
  const {
    data: farm,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["farm", id],
    queryFn: () => API.get(`/farms/farm/${id}`).then(r => r.data),
    enabled: !!id, // Only run if ID exists
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Farm not found
        </h2>
        <button
          onClick={() => navigate("/farms")}
          className="text-emerald-600 underline"
        >
          Go back to list
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      {/* 2. Render the Form with Initial Data */}
      <FarmForm initialData={farm} isEditMode={true} />
    </div>
  );
};

export default FarmEdit;
