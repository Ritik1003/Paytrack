const { createTodaysAttendance } = require('../tasks/dailyAttendance');

exports.runDailyAttendance = async (req, res) => {
  try {
    const result = await createTodaysAttendance();
    res.json({ message: 'Daily attendance run', result });
  } catch (err) {
    res.status(500).json({ message: 'Failed to run daily attendance', error: err.message });
  }
};
