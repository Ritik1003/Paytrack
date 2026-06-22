const express = require("express");
const { registerUser, loginUser, logoutUser } = require("../controllers/authController");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);

// Google OAuth: initiate login — redirects user to Google's consent/account-selection screen
router.get("/google", passport.authenticate("google", {
  scope: ["profile", "email"],
  prompt: "select_account"   // always show account chooser
}));

// Google OAuth: callback — Google redirects here after user selects an account
router.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html?error=google_auth_failed", session: false }),
  (req, res) => {
    try {
      const user = req.user;
      // Generate JWT just like the normal login flow
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET || "dev_secret",
        { expiresIn: "1d" }
      );

      // Build a safe user payload to pass to the frontend via query string
      const userPayload = encodeURIComponent(JSON.stringify({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        empID: user._id,
        department: user.department || ""
      }));

      // Redirect to the appropriate page based on role
      const role = (user.role || "").toString().trim().toLowerCase();
      let redirectPage = "/attendance.html";
      if (role === "manager") redirectPage = "/manager.html";

      res.redirect(`${redirectPage}?token=${token}&user=${userPayload}`);
    } catch (err) {
      console.error("Google OAuth callback error:", err);
      res.redirect("/login.html?error=google_auth_failed");
    }
  }
);

module.exports = router;

