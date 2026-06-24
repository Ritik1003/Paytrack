const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

dotenv.config();
// Log which Mongo URI will be used (helps debugging when MONGO_URI is missing)
if (process.env.MONGO_URI) {
  console.log('MONGO_URI provided in environment (will attempt to connect to this URI)');
} else {
  console.log('MONGO_URI not provided — server will attempt to connect to local fallback if available');
}
// Optionally skip DB connection for quick local testing
if (!process.env.SKIP_DB || process.env.SKIP_DB === "false") {
  connectDB();
} else {
  console.log("⚠️ SKIP_DB is set, skipping MongoDB connection (useful for local debug)");
}

const app = express();
app.use(express.json());
app.use(cors());
// If the app runs behind a proxy/load-balancer that sets X-Forwarded-For,
// tell Express to trust the proxy so req.ip and X-Forwarded-For are usable.
app.set('trust proxy', true);

// Session middleware (required for Passport OAuth flow)
const session = require('express-session');
app.use(session({
  secret: process.env.SESSION_SECRET || 'scam_session_fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Passport initialization
const passport = require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// Serve the frontend static files so you can open the app from the same origin
const path = require("path");
const frontendPath = path.join(__dirname, "..", "Frontend");
app.use(express.static(frontendPath));

// Routes
const attendanceRoutes = require("./routes/attendanceRoutes");
app.use("/api/attendance", attendanceRoutes);

// Auth routes (signup / login)
const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

// User management (for manager dashboard)
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// Task routes (manual trigger)
const taskRoutes = require('./routes/tasksRoutes');
app.use('/api/tasks', taskRoutes);

// Salary routes (calculate and reset)
const salaryRoutes = require('./routes/salaryRoutes');
app.use('/api/salary', salaryRoutes);

// Navigation callbacks from frontend (e.g., Back button analytics/cleanup)
const navigationRoutes = require('./routes/navigationRoutes');
app.use('/api/navigation', navigationRoutes);

// Schedule daily tasks (if node-cron available)
try {
  const { scheduleDailyJob } = require('./tasks/dailyAttendance');
  scheduleDailyJob();
} catch (e) {
  console.warn('Daily task scheduling not initialized:', e.message || e);
}

// Log allowed office IPs for debugging (if configured)
try {
  const officeCfg = require('./config/office');
  if (officeCfg && officeCfg.allowed && officeCfg.allowed.length) {
    console.log('🔒 Office IP restriction enabled. Allowed IPs:', officeCfg.allowed.join(', '));
  } else {
    console.log('🔓 No office IP restriction configured (OFFICE_IPS empty)');
  }
} catch (e) {}

app.get("/", (req, res) => {
  // serve the frontend signup if present, otherwise a simple string
  const signupFile = path.join(frontendPath, "signup.html");
  res.sendFile(signupFile, (err) => {
    if (err) {
      res.send("Backend Running Successfully");
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
