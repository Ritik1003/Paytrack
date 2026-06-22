const { createTodaysAttendance } = require('../tasks/dailyAttendance');

exports.runDailyAttendance = async (req, res) => {
  try {
    const result = await createTodaysAttendance();
    res.json({ message: 'Daily attendance executed', result });
  } catch (error) {
    res.status(500).json({ message: 'Task failed', error });
  }
};
