const express = require('express');
const router = express.Router();
const { navigationBack } = require('../controllers/navigationController');

// POST /api/navigation/back
router.post('/back', navigationBack);

module.exports = router;
