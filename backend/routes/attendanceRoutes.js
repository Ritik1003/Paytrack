const express = require("express");
const { addAttendance, getAllAttendance, updateAttendance, resetAttendance, getAttendanceByUser } = require("../controllers/attendanceController");
const { resetAllAttendance } = require("../controllers/resetController");
const router = express.Router();

router.post("/", addAttendance);
router.get("/", getAllAttendance);
// fetch attendance for a single employee (by empID)
router.get('/user/:id', getAttendanceByUser);
router.patch('/:id', updateAttendance);
// Delete attendance records for a given date (query ?date=YYYY-MM-DD) or today's date when not provided
router.delete('/reset', resetAttendance);
// Delete attendance records for a given month (query ?month=YYYY-MM)
router.delete('/reset-month', async (req, res) => {
	try {
		const { month } = req.query;
		if (!month) return res.status(400).json({ message: 'Missing month parameter (YYYY-MM)' });
		// Attendance dates are stored as YYYY-MM-DD strings -> compute start and end
		const startStr = `${month}-01`;
		const startDate = new Date(`${month}-01`);
		const endDateObj = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
		const endStr = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
		const result = await require('../models/Attendance').deleteMany({ date: { $gte: startStr, $lte: endStr } });
		res.json({ message: `Deleted ${result.deletedCount} attendance record(s) for month ${month}`, deletedCount: result.deletedCount });
	} catch (err) {
		console.error('Failed to reset attendance by month', err);
		res.status(500).json({ message: 'Failed to reset attendance for month' });
	}
});
// Delete all attendance records
router.delete('/reset-all', resetAllAttendance);

module.exports = router;
