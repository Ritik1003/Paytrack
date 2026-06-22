/**
 * Creates today's attendance records for all users (if missing).
 * Uses lazy `node-cron` require so the module still works if the package
 * hasn't been installed yet. Exported functions:
 *  - createTodaysAttendance(): Promise<{createdCount, date}>
 *  - scheduleDailyJob(): sets up cron job if node-cron is available
 */
const User = require('../models/User');
const Attendance = require('../models/Attendance');

async function createTodaysAttendance() {
  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const users = await User.find({ role: { $ne: 'admin' } });
    const toCreate = [];
    for (const u of users) {
      // use empID as string of user _id
      const exists = await Attendance.findOne({ empID: String(u._id), date: dateStr });
      if (!exists) {
        toCreate.push({
          empID: String(u._id),
          empName: u.name || '',
          status: 'Absent',
          date: dateStr,
          startTime: null,
          endTime: null,
        });
      }
    }

    if (toCreate.length) {
      await Attendance.insertMany(toCreate);
    }

    return { createdCount: toCreate.length, date: dateStr };
  } catch (err) {
    console.error('dailyAttendance:createTodaysAttendance error', err);
    throw err;
  }
}

function scheduleDailyJob() {
  try {
    const cron = require('node-cron');
    // run daily at 00:05 server local time
    cron.schedule('5 0 * * *', async () => {
      try {
        console.log('Running scheduled daily attendance task');
        const res = await createTodaysAttendance();
        console.log('Daily attendance created:', res.createdCount);
      } catch (e) {
        console.error('Scheduled daily attendance failed', e);
      }
    });
    console.log('Daily attendance scheduling enabled (node-cron)');
  } catch (e) {
    console.warn('node-cron not available; daily scheduling disabled. You can still trigger createTodaysAttendance() manually.');
  }
}

module.exports = { createTodaysAttendance, scheduleDailyJob };
