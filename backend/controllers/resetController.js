const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Salary = require('../models/Salary');

// Reset all attendance records
const resetAllAttendance = async (req, res) => {
    try {
        await Attendance.deleteMany({});
        res.json({ message: 'All attendance records deleted successfully' });
    } catch (error) {
        console.error('Failed to reset attendance:', error);
        res.status(500).json({ message: 'Failed to reset attendance records' });
    }
};

// Reset all salary records
const resetAllSalary = async (req, res) => {
    try {
        await Salary.deleteMany({});
        res.json({ message: 'All salary records deleted successfully' });
    } catch (error) {
        console.error('Failed to reset salary:', error);
        res.status(500).json({ message: 'Failed to reset salary records' });
    }
};

// Delete salary records for a specific month (month string YYYY-MM)
const resetSalaryByMonth = async (req, res) => {
    try {
        const { month } = req.query;
        if (!month) return res.status(400).json({ message: 'Missing month parameter (YYYY-MM)' });
        const result = await Salary.deleteMany({ month: String(month) });
        res.json({ message: `Deleted ${result.deletedCount} salary record(s) for month ${month}`, deletedCount: result.deletedCount });
    } catch (error) {
        console.error('Failed to reset salary by month:', error);
        res.status(500).json({ message: 'Failed to reset salary records for month' });
    }
};

// Reset all users except admins and managers
const resetAllUsers = async (req, res) => {
    try {
        await User.deleteMany({ role: 'employee' });
        res.json({ message: 'All employee records deleted successfully' });
    } catch (error) {
        console.error('Failed to reset users:', error);
        res.status(500).json({ message: 'Failed to reset user records' });
    }
};

module.exports = {
    resetAllAttendance,
    resetAllSalary,
    resetAllUsers
};