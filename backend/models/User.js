const mongoose = require("mongoose");

// Use empID as the document _id (string). Keep a virtual `empID` for compatibility
const userSchema = new mongoose.Schema({
  // Primary key: employee identifier (string)
  _id: { type: String },
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, enum: ["employee", "manager", "admin"], default: "employee" },
  // Employee-specific fields (used by manager dashboard)
  department: { type: String },
  basicSalary: { type: Number, default: 0 },
  pf: { type: Number, default: 0 },
  status: { type: String, default: 'Active' },
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Provide `empID` virtual that mirrors `_id` for backward compatibility with frontend
userSchema.virtual('empID').get(function() {
  return this._id;
});

module.exports = mongoose.model("User", userSchema);

