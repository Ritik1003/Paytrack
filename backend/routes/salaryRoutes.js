const express = require("express");
const { calculateSalary } = require("../controllers/salaryController");
const { resetAllSalary } = require("../controllers/resetController");
const router = express.Router();

// Endpoint to calculate salary
router.post("/calculate", calculateSalary);

// Delete all salary records
router.delete('/reset-all', resetAllSalary);

// Delete salary records for a specific month (query ?month=YYYY-MM)
router.delete('/reset-month', (req, res, next) => {
	// forward to controller method defined in resetController
	const { resetSalaryByMonth } = require('../controllers/resetController');
	return resetSalaryByMonth(req, res, next);
});

module.exports = router;
