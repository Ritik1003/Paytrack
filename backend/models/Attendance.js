const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  empID: { type: String, required: true },
  empName: { type: String, required: true },
  department: { type: String },
  status: { type: String, enum: ["Present", "Absent", "Leave"], required: true },
  date: { type: String, required: true },
  startTime: String,
  endTime: String,
});

module.exports = mongoose.model("Attendance", attendanceSchema);
