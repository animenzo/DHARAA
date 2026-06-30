import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getSchedule, updateSchedule } from "../../services/scheduleApi";
import ScheduleForm from "./ScheduleForm";
import toast, { Toaster } from "react-hot-toast";

const ScheduleEdit = () => {
  const { id } = useParams(); // Get ID from URL (/schedules/:id/edit)
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Fetch Existing Data
  const {
    data: scheduleData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["schedule", id],
    queryFn: () => getSchedule(id),
    enabled: !!id, // Only fetch if ID exists
  });

  // 2. Setup Update Mutation
  const mutation = useMutation({
    mutationFn: updateSchedule,
    onSuccess: () => {
      toast.success("Schedule updated!");
      queryClient.invalidateQueries(["schedules"]);
      queryClient.invalidateQueries(["schedule", id]);
      setTimeout(() => navigate("/schedules"), 1000);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Update failed");
    },
  });

  if (isLoading)
    return (
      <div className="text-center mt-20 text-gray-500">
        Loading schedule details...
      </div>
    );
  if (isError)
    return (
      <div className="text-center mt-20 text-red-500">
        Error loading schedule.
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Toaster position="top-right" />

      {/* We pass 'initialData'. 
        Note: The backend might return 'farmId' as an object populated with name.
        If your backend does .populate('farmId'), you might need to flatten it here:
        initialData={{ ...scheduleData, farmId: scheduleData.farmId._id || scheduleData.farmId }}
      */}
      <ScheduleForm
        initialData={{
          ...scheduleData,
          // Handle case where farmId is populated object vs string ID
          farmId:
            typeof scheduleData.farmId === "object"
              ? scheduleData.farmId._id
              : scheduleData.farmId,
        }}
        onSubmit={(formData) => mutation.mutate({ id, data: formData })}
        isSubmitting={mutation.isPending}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
};

export default ScheduleEdit;
