const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Only register Google strategy if real credentials are provided
const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (clientID && clientSecret && !clientID.includes('YOUR_') && !clientSecret.includes('YOUR_')) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: clientID,
        clientSecret: clientSecret,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract email from Google profile
          const email = profile.emails && profile.emails.length > 0
            ? profile.emails[0].value.trim().toLowerCase()
            : null;

          if (!email) {
            return done(null, false, { message: 'No email found in Google profile' });
          }

          // Look up user by email (case-insensitive) — only allow already-registered users
          const user = await User.findOne({
            email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
          });

          if (!user) {
            return done(null, false, { message: 'No account found with this Google email. Please sign up first.' });
          }

          return done(null, user);
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );
  console.log('✅ Google OAuth strategy registered');
} else {
  console.log('⚠️  Google OAuth credentials not configured — Google login disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
}

module.exports = passport;
