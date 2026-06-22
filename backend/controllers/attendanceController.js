const Attendance = require("../models/Attendance");
const User = require("../models/User");

// Add attendance
exports.addAttendance = async (req, res) => {
  try {
  const { empID, empName, department: rawDept, status: rawStatus, date, startTime: rawStart, endTime: rawEnd } = req.body;

    // Basic required field checks
    // department may be omitted by the client; try to auto-fill from User collection later
    if (!empID || !empName || !date) {
      return res.status(400).json({ message: 'empID, empName and date are required' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!date || !dateRegex.test(date)) {
      return res.status(400).json({ message: 'date must be in YYYY-MM-DD format' });
    }
    const [y, m, d] = date.split('-').map(Number);
    const inputDate = new Date(y, m - 1, d);
    if (isNaN(inputDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }
    // Enforce a reasonable year range to avoid obviously-bad dates
    if (y < 2000 || y > 2100) {
      return res.status(400).json({ message: 'date out of allowed range' });
    }

    // Start time must be present (login time captured by frontend)
    if (!rawStart) {
      return res.status(400).json({ message: 'startTime is required' });
    }

    // Office hours enforcement
    const OFFICE_START = '08:00';
    const OFFICE_END = '18:00';

    // Helper to validate HH:MM format and compare
    const isValidTime = (t) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(t);
    if (!isValidTime(rawStart)) {
      return res.status(400).json({ message: 'startTime must be in HH:MM format' });
    }

    // Ensure provided startTime is within allowed office window (>= OFFICE_START)
    if (rawStart < OFFICE_START) {
      return res.status(400).json({ message: `Attendance can be marked only from ${OFFICE_START}` });
    }

    // Clamp startTime to office window; endTime may be captured separately later
    let startTime = rawStart;
    if (startTime < OFFICE_START) startTime = OFFICE_START;

    // endTime is optional — save rawEnd if provided and valid, else null
    let endTime = null;
    if (rawEnd) {
      if (!isValidTime(rawEnd)) {
        return res.status(400).json({ message: 'endTime must be in HH:MM format' });
      }
      endTime = rawEnd;
      if (endTime > OFFICE_END) endTime = OFFICE_END;
      // optional: if endTime < startTime after clamping, reject
      if (endTime < startTime) {
        return res.status(400).json({ message: 'endTime must be the same or after startTime within office hours' });
      }
    }

    // Default status when missing -> Absent by default unless explicitly set
    let status = rawStatus || 'Absent';

    // Auto-fill department when not provided by looking up the User by empID or name
    let department = rawDept;
    if (!department) {
      try {
        if (empID) {
          const user = await User.findById(String(empID)).select('department');
          if (user && user.department) department = user.department;
        }
        // fallback: try to find by name
        if (!department && empName) {
          const userByName = await User.findOne({ name: empName }).select('department _id');
          if (userByName) {
            department = userByName.department;
          }
        }
      } catch (e) {
        // non-fatal; if lookup fails we'll proceed and let the schema accept empty department
        console.warn('User lookup failed when auto-filling department', e && e.message ? e.message : e);
      }
    }

    // Check if attendance for this employee and date already exists
    const existing = await Attendance.findOne({ empID, date });
    if (existing) {
      return res.status(400).json({ message: "Attendance already marked for today" });
    }

    const newAttendance = new Attendance({
      empID,
      empName,
      department,
      status,
      date,
      startTime,
      endTime,
    });

    await newAttendance.save();

    res.status(201).json({ message: "Attendance saved successfully", data: newAttendance });
  } catch (error) {
    console.error("Error saving attendance:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Get all attendance records (optional)
exports.getAllAttendance = async (req, res) => {
  try {
    const data = await Attendance.find();
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Get attendance records for a single employee by empID
exports.getAttendanceByUser = async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: 'Missing employee id' });
    const records = await Attendance.find({ empID: String(id) }).sort({ date: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Reset (delete) attendance records for a given date, or for today if no date provided
exports.resetAttendance = async (req, res) => {
  try {
    // If caller provides a date query param use it, otherwise use today's date in YYYY-MM-DD
    let { date } = req.query;
    if (!date) {
      const t = new Date();
      const yyyy = t.getFullYear();
      const mm = String(t.getMonth() + 1).padStart(2, '0');
      const dd = String(t.getDate()).padStart(2, '0');
      date = `${yyyy}-${mm}-${dd}`;
    }

    const result = await Attendance.deleteMany({ date });
    res.json({ message: `Deleted ${result.deletedCount} attendance record(s) for date ${date}`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error resetting attendance:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// Update attendance status by id (e.g., manager marking correction)
exports.updateAttendance = async (req, res) => {
  try {
    const id = req.params.id;
    const { status, startTime, endTime } = req.body;
    const update = {};
    if (status) update.status = status;
    if (startTime) update.startTime = startTime;
    if (endTime) update.endTime = endTime;

    const att = await Attendance.findByIdAndUpdate(id, update, { new: true });
    if (!att) return res.status(404).json({ message: 'Attendance not found' });
    res.json({ message: 'Attendance updated', data: att });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
