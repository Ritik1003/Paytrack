// Simple controller to handle navigation-related callbacks from the frontend
const navigationBack = async (req, res) => {
  try {
    // Log minimal info for audit/debugging. Avoid storing PII.
    console.log('Navigation back called from IP:', req.ip || req.headers['x-forwarded-for'] || 'unknown');
    return res.json({ message: 'OK' });
  } catch (err) {
    console.error('navigationBack failed', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  navigationBack
};
