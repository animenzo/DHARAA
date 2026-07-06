const express = require('express');
const router = express.Router();
const { 
    createSchedule, 
    getMySchedules, 
    updateSchedule, 
    deleteSchedule,
    getSchedule
} = require('../controllers/scheduleController');
const auth = require("../middleware/auth");

router.get("/schedule",auth,getMySchedules);
router.get("/schedule/:id",auth,getSchedule);
router.post("/schedule",auth,createSchedule);
router.patch("/schedule/:id",auth,updateSchedule);
router.delete("/schedule/:id",auth,deleteSchedule);

module.exports = router;