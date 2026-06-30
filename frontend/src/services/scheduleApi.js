// Add these to your API object or service file
import API from "./api"; // Adjust the path as needed
export const getFarms = async () => (await API.get('/farms')).data;
export const getMySchedules = async () => {
    const response = await API.get('/schedules/schedule');
    return response.data;
};
export const getSchedule = async (id) => (await API.get(`/schedules/schedule/${id}`)).data;
export const createSchedule = async (data) => (await API.post('/schedules/schedule', data)).data;
export const updateSchedule = async ({ id, data }) => (await API.patch(`/schedules/schedule/${id}`, data)).data;
export const deleteSchedule = async (id) => (await API.delete(`/schedules/schedule${id}`)).data;
// 