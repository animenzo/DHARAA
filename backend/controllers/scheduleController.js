const Schedule = require('../models/Schedule');
const Farm = require('../models/Farm');

// Helper: Calculate the next run date based on days array and time
const calculateNextRun = (days, time) => {
    const [hour, minute] = time.split(':').map(Number);
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
        const { name, farmId, zone, time, duration, days, notes } = req.body;

        // 1. Check if Farm exists and belongs to user
        const farm = await Farm.findById(farmId);
        if (!farm) {
            return res.status(404).json({ message: 'Farm not found' });
        }
        if (farm.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'Unauthorized access to this farm' });
        }

        // 2. Calculate next run
        const nextRun = calculateNextRun(days, time);

        // 3. Create Schedule
        const schedule = await Schedule.create({
            user: req.user.id,
            name,
            farmId,
            zone,
            time,
            duration,
            days,
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

// @desc    Update / Reschedule a task
// @route   PUT /api/schedules/:id
// @access  Private
const updateSchedule = async (req, res) => {
    try {
        let schedule = await Schedule.findById(req.params.id);

        if (!schedule) return res.status(404).json({ message: 'Schedule not found' });

        // Check ownership
        if (schedule.user.toString() !== req.user.id) {
            return res.status(401).json({ message: 'User not authorized' });
        }

        // If time or days changed, recalculate nextRun
        if (req.body.time || req.body.days) {
            const newDays = req.body.days || schedule.days;
            const newTime = req.body.time || schedule.time;
            req.body.nextRun = calculateNextRun(newDays, newTime);
        }

        schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });

        res.status(200).json(schedule);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
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
    updateSchedule,
    deleteSchedule
};