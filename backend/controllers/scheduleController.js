const Schedule = require('../models/Schedule');
const Farm = require('../models/Farm');

// Helper: Calculate the next run date based on days array/date and time
const calculateNextRun = (days, time, dateStr = null) => {
    const [hour, minute] = time.split(':').map(Number);

    if (dateStr) {
        // Specific date, e.g. "2026-07-06"
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day, hour, minute, 0, 0);
    }

    if (!days) return null;
    const now = new Date();
    const todayIndex = (now.getDay() + 6) % 7; // Adjust so 0=Mon, 6=Sun

    for (let i = 0; i < 7; i++) {
        // Check days starting from today
        const dayCheckIndex = (todayIndex + i) % 7;
        
        if (days[dayCheckIndex]) {
            const nextDate = new Date();
            nextDate.setDate(now.getDate() + i);
            nextDate.setHours(hour, minute, 0, 0);

            // If it's today, ensure the time hasn't passed yet
            if (i === 0 && nextDate <= now) continue;

            return nextDate;
        }
    }
    return null; // No days selected
};

// @desc    Create a new irrigation schedule
// @route   POST /api/schedules
// @access  Private
const createSchedule = async (req, res) => {
    try {
        const { name, farmId, zone, time, duration, days, notes, date, moisture } = req.body;

        // Custom validation
        if (!duration && (moisture === undefined || moisture === null || moisture === "")) {
            return res.status(400).json({ message: 'Either duration or moisture is required' });
        }
        if (!date && (!days || !days.includes(true))) {
            return res.status(400).json({ message: 'Either date or active days must be selected' });
        }

        // 1. Check if Farm exists and belongs to user
        const farm = await Farm.findById(farmId);
        if (!farm) {
            return res.status(404).json({ message: 'Farm not found' });
        }
        if (farm.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Unauthorized access to this farm' });
        }

        // 2. Calculate next run
        const nextRun = calculateNextRun(days, time, date);

        // 3. Create Schedule
        const schedule = await Schedule.create({
            user: req.user.id,
            name,
            farmId,
            zone,
            time,
            duration: duration || null,
            moisture: moisture !== undefined && moisture !== "" ? Number(moisture) : null,
            days: date ? undefined : days,
            date: date || null,
            notes,
            nextRun
        });

        res.status(201).json(schedule);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all schedules for the logged-in user
// @route   GET /api/schedules
// @access  Private
const getMySchedules = async (req, res) => {
    try {
        // Optional: Filter by specific farm if query param exists (?farmId=123)
        const filter = { user: req.user.id };
        if (req.query.farmId) filter.farmId = req.query.farmId;

        const schedules = await Schedule.find(filter)
            .populate('farmId', 'name') // Include Farm Name in response
            .sort({ nextRun: 1 }); // Show upcoming tasks first

        res.status(200).json(schedules);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Get schedule by ID
// @route   GET /api/schedules/schedule/:id
// @access  Private
const getSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);
        if (!schedule) {
            return res.status(404).json({ message: 'Schedule not found' });
        }
        if (schedule.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }
        res.status(200).json(schedule);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update / Reschedule a task
// @route   PATCH /api/schedules/schedule/:id
// @access  Private
const updateSchedule = async (req, res) => {
    try {
        let schedule = await Schedule.findById(req.params.id);

        if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

        // Check ownership
        if (schedule.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        // If time, days, or date changed, recalculate nextRun
        if (req.body.time || req.body.days !== undefined || req.body.date !== undefined) {
            const newDays = req.body.days !== undefined ? req.body.days : schedule.days;
            const newTime = req.body.time || schedule.time;
            const newDate = req.body.date !== undefined ? req.body.date : schedule.date;
            req.body.nextRun = calculateNextRun(newDays, newTime, newDate);
        }

        const updatePayload = { ...req.body };
        const unsetPayload = {};

        // Clean up fields if switching between recurring/one-time
        if (updatePayload.date) {
            unsetPayload.days = "";
            delete updatePayload.days;
        } else if (updatePayload.days) {
            unsetPayload.date = "";
            delete updatePayload.date;
        }

        // Clean up fields if switching between duration/moisture
        if (updatePayload.moisture !== undefined && updatePayload.moisture !== "") {
            unsetPayload.duration = "";
            delete updatePayload.duration;
        } else if (updatePayload.duration) {
            unsetPayload.moisture = "";
            delete updatePayload.moisture;
        }

        if (Object.keys(unsetPayload).length > 0) {
            updatePayload.$unset = unsetPayload;
        }

        schedule = await Schedule.findByIdAndUpdate(req.params.id, updatePayload, { new: true });

        res.status(200).json(schedule);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete a schedule
// @route   DELETE /api/schedules/:id
// @access  Private
const deleteSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);

        if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

        if (schedule.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        await schedule.deleteOne();
        res.status(200).json({ id: req.params.id, message: 'Schedule removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    createSchedule,
    getMySchedules,
    getSchedule,
    updateSchedule,
    deleteSchedule
};