const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const officeConfig = require("../config/office");
const mongoose = require('mongoose');

// Helper: get client's IP address (supports X-Forwarded-For when behind a proxy)
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    // X-Forwarded-For can be a comma-separated list; first is original client
    return xff.split(',')[0].trim();
  }
  // Express may set req.ip (it can be like ::ffff:127.0.0.1)
  if (req.ip) return req.ip.replace('::ffff:', '');
  if (req.connection && req.connection.remoteAddress) return req.connection.remoteAddress.replace('::ffff:', '');
  return null;
}

// Helper: escape text for use in a RegExp
function escapeRegExp(string) {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

exports.registerUser = async (req, res) => {
  try {
  const { name, email, password, role, empID } = req.body;

    // Basic validation: empID required only for employee role
    const missing = [];
    if (!name) missing.push('name');
    if (!email) missing.push('email');
    if (!password) missing.push('password');
    if ((String(role || '').toLowerCase() === 'employee') && !empID) missing.push('empID');
    if (missing.length) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} required` });
    }

    // If the DB isn't connected, return a helpful error rather than attempting operations that will fail
    if (mongoose.connection.readyState !== 1) {
      console.error('Attempted user register while MongoDB is not connected. readyState=', mongoose.connection.readyState);
      return res.status(503).json({ message: 'Database unavailable: please start MongoDB and ensure MONGO_URI is set' });
    }

    // Normalize email to reduce accidental duplicates and comparisons
    const normalizedEmail = (email && String(email).trim().toLowerCase()) || '';
    // Check case-insensitively if a user exists (avoids duplicate variants like Foo@Example.com)
    const userExists = normalizedEmail
      ? await User.findOne({ email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' } })
      : null;
    if (userExists) return res.status(400).json({ message: "User with this email already exists" });

    // Ensure empID (which will become _id) is unique when provided
    if (empID) {
      const idExists = await User.findById(empID);
      if (idExists) return res.status(400).json({ message: "User with this empID already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

  // Persist normalized email. Use empID as _id when provided. For manager
  // accounts (no empID) generate a stable string id so the schema (string
  // _id) is satisfied and Mongoose can save the document.
  let newId = empID ? String(empID) : (`mgr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`);
  const user = await User.create({ _id: newId, name, email: normalizedEmail, password: hashedPassword, role });
    // Do not return password hash to the client
    const safeUser = {
      id: user._id,
      empID: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    res.status(201).json({ message: "User registered successfully", user: safeUser });
  } catch (error) {
    // Log full error server-side for debugging
    console.error('registerUser error:', error && error.stack ? error.stack : error);
    // Send a safe and informative error to the client
    const errMsg = error && error.message ? error.message : 'Server error';
    res.status(500).json({ message: errMsg });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Office IP restriction: if OFFICE_IPS configured, require client IP to match one of them
    const allowed = officeConfig.allowed || [];
    if (allowed.length > 0) {
      const clientIp = getClientIp(req);
      // If we couldn't determine client IP, deny to be safe
      if (!clientIp) return res.status(403).json({ message: 'Access denied: cannot determine client IP (office-only access)' });
      // exact match for now; future improvement: support CIDR/ranges
      const match = allowed.includes(clientIp);
      if (!match) {
        return res.status(403).json({ message: `Access denied: login allowed only from office network (your IP: ${clientIp})` });
      }
    }

    // Use a case-insensitive lookup so users can login regardless of email casing/whitespace
    const normalizedEmail = (email && String(email).trim().toLowerCase()) || '';
    const user = normalizedEmail
      ? await User.findOne({ email: { $regex: `^${escapeRegExp(normalizedEmail)}$`, $options: 'i' } })
      : null;
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'dev_secret', {
      expiresIn: "1d",
    });

    // Return minimal user info to the client (do not expose password hash)
    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      empID: user._id,
      department: user.department || '',
    };

    res.json({ message: "Login successful", token, user: safeUser });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Logout endpoint: for JWT-based stateless auth there's nothing to revoke server-side
// unless you maintain a token blacklist. This endpoint provides a place for the
// frontend to call to complete logout flows (and can be extended later).
exports.logoutUser = async (req, res) => {
  try {
    // If you were using cookies you would clear them here. Example:
    // res.clearCookie('token');
    return res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('logoutUser error:', error);
    return res.status(500).json({ message: 'Logout failed' });
  }
};
