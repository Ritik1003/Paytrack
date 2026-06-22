const mongoose = require("mongoose");

// Attempt to connect to MongoDB using MONGO_URI. If not set, fall back to a local DB for dev.
const connectDB = async () => {
  const envUri = process.env.MONGO_URI;
  const fallbackUri = 'mongodb://127.0.0.1:27017/Paytrack';
  const uriToUse = envUri && envUri.trim() !== '' ? envUri : fallbackUri;

  try {
    if (!envUri) {
      console.warn('⚠️ MONGO_URI not set. Attempting local fallback:', fallbackUri);
    } else {
      console.log('Using MONGO_URI from environment');
    }

    await mongoose.connect(uriToUse);
    console.log('✅ MongoDB Connected Successfully ->', uriToUse);
  } catch (error) {
    console.error('❌ MongoDB Connection Failed to', uriToUse, error && error.message ? error.message : error);
    // Do not exit; keep server running so the frontend can still be served for debugging.
  }
};

module.exports = connectDB;
