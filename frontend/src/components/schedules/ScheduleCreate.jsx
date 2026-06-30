import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createSchedule } from "../../services/scheduleApi";
import ScheduleForm from "../schedules/ScheduleForm";
import toast, { Toaster } from "react-hot-toast";

const ScheduleCreate = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: createSchedule,
    onSuccess: () => {
      toast.success("Schedule created!");
      queryClient.invalidateQueries(["schedules"]);
      setTimeout(() => navigate("/schedules"), 1000); // Redirect to list
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to create");
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <Toaster position="top-right" />
      <ScheduleForm
        onSubmit={(data) => mutation.mutate(data)}
        isSubmitting={mutation.isPending}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
};

export default ScheduleCreate;
