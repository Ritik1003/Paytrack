const express = require('express');
const { runDailyAttendance } = require('../controllers/tasksController');
const router = express.Router();

router.post('/run-daily-attendance', runDailyAttendance);

module.exports = router;
