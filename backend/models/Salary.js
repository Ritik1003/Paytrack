const mongoose = require("mongoose");

// userId should match the type used for User._id (string empID)
const salarySchema = new mongoose.Schema({
  userId: { type: String, ref: "User" },
  month: String,
  totalDays: Number,
  presentDays: Number,
  salaryAmount: Number,
});

module.exports = mongoose.model("Salary", salarySchema);
