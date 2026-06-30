import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getMySchedules, deleteSchedule } from '../services/scheduleApi'; // Ensure these export correctly
import toast, { Toaster } from 'react-hot-toast';
import { 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaClock, 
  FaTint, 
  FaCalendarAlt, 
  FaExclamationCircle 
} from 'react-icons/fa';
import { GiFarmTractor } from 'react-icons/gi';
import API from '../services/api';
import { getSmartIrrigationResult } from '../services/aiApi';
import SmartIrrigationCard from '../components/irrigation/SmartIrrigationCard';
// 
// --- Helper: Format Time (24h -> 12h AM/PM) ---
const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const [hour, minute] = timeStr.split(':');
  const date = new Date();
  date.setHours(hour, minute);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

// --- Sub-Component: Schedule Card ---
const ScheduleCard = ({ schedule, onEdit, onDelete }) => {
  const daysMap = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 relative overflow-hidden group transition-all hover:shadow-xl hover:-translate-y-1">
      
      {/* Status Badge */}
      <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
        schedule.status === 'Active' 
          ? 'bg-emerald-100 text-emerald-700' 
          : 'bg-amber-100 text-amber-700'
      }`}>
        {schedule.status}
      </div>

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-800 mb-1">{schedule.name}</h3>
        <div className="flex items-center text-sm text-gray-500 gap-2">
          <GiFarmTractor className="text-emerald-500" />
          <span>{schedule.farmId?.name || 'Unknown Farm'}</span>
          <span className="text-gray-300">•</span>
          <span className="text-emerald-600 font-medium">{schedule.zone}</span>
        </div>
      </div>

      {/* Time & Duration */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
            <FaClock />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Start</p>
            <p className="text-gray-900 font-bold">{formatTime(schedule.time)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
            <FaTint />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase">Duration</p>
            <p className="text-gray-900 font-bold">{schedule.duration} min</p>
          </div>
        </div>
      </div>

      {/* Days Visualizer */}
      <div className="mb-6">
        <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Repeat Days</p>
        <div className="flex justify-between">
          {schedule.days.map((isActive, index) => (
            <div 
              key={index}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive 
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' 
                  : 'bg-gray-100 text-gray-300'
              }`}
            >
              {daysMap[index]}
            </div>
          ))}
        </div>
      </div>

      {/* Actions (Hidden by default, shown on hover/mobile) */}
      <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
        <button 
          onClick={() => onEdit(schedule._id)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 font-semibold transition-colors text-sm"
        >
          <FaEdit /> Edit
        </button>
        <button 
          onClick={() => onDelete(schedule._id)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-600 font-semibold transition-colors text-sm"
        >
          <FaTrash /> Delete
        </button>
      </div>
    </div>
  );
};

// --- Main Page Component ---
const ScheduleList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 1. Fetch Data
  const { data: schedules, isLoading, isError } = useQuery({
    queryKey: ['schedules'],
    queryFn: getMySchedules
  });

  const { data: generatedResults = [], isLoading: generatedLoading } = useQuery({
    queryKey: ['smart-irrigation-results'],
    queryFn: async () => {
      const farms = (await API.get('/farms/farm')).data || [];
      return Promise.all(farms.map(async (farm) => {
        try {
          return { farm, result: await getSmartIrrigationResult(farm._id) };
        } catch {
          return { farm, result: null };
        }
      }));
    },
  });

  // 2. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSchedule,
    onSuccess: () => {
      toast.success('Schedule deleted successfully');
      queryClient.invalidateQueries(['schedules']);
    },
    onError: () => toast.error('Failed to delete schedule')
  });

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      deleteMutation.mutate(id);
    }
  };

  // --- Loading State ---
  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 p-8 flex justify-center items-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-8 font-sans">
      <Toaster position="top-right" />

      {/* Header Section */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Irrigation Schedules</h1>
          <p className="text-gray-500 mt-1">Manage and automate your farm watering cycles.</p>
        </div>
        <button 
          onClick={() => navigate('/schedules/new')}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-1 active:scale-95"
        >
          <FaPlus /> Create New Schedule
        </button>
      </div>

      <section className="max-w-7xl mx-auto mb-10">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Generated Smart Schedules</h2>
          <p className="text-sm text-gray-500">Latest calculation stored by the backend for each farm.</p>
        </div>
        {generatedLoading ? (
          <div className="h-28 animate-pulse rounded-2xl bg-white" />
        ) : generatedResults.length ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {generatedResults.map(({ farm, result }) => (
              <SmartIrrigationCard key={farm._id} farmName={farm.name} result={result} />
            ))}
          </div>
        ) : (
          <SmartIrrigationCard />
        )}
      </section>

      {/* Grid Layout */}
      {isError ? (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-red-100">
           <FaExclamationCircle className="mx-auto text-4xl text-red-400 mb-4" />
           <h3 className="text-lg font-bold text-gray-800">Failed to load schedules</h3>
           <button onClick={() => window.location.reload()} className="text-emerald-600 hover:underline mt-2">Try Again</button>
        </div>
      ) : schedules?.length === 0 ? (
        // Empty State
        <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200">
          <div className="bg-emerald-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <FaCalendarAlt className="text-3xl text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Schedules Yet</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8">
            Create your first irrigation schedule to automate your water cycles and improve crop health.
          </p>
          <button 
            onClick={() => navigate('/schedules/new')}
            className="text-emerald-600 font-bold hover:text-emerald-700 hover:underline"
          >
            + Add your first schedule
          </button>
        </div>
      ) : (
        // List State
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {schedules.map((schedule) => (
            <ScheduleCard 
              key={schedule._id} 
              schedule={schedule} 
              onEdit={(id) => navigate(`/schedules/${id}/edit`)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ScheduleList;
