const Attendance = require("../models/Attendance");
const Salary = require("../models/Salary");

exports.calculateSalary = async (req, res) => {
  try {
    const { userId, basicSalary, month } = req.body; // get user, month, and basic salary

    // Step 1: Get attendance for the month
    // NOTE: Attendance.date is stored as a string (YYYY-MM-DD). Also
    // attendance records use empID (string) rather than a Mongo ObjectId
    // userId field. Support both by querying empID === userId and using
    // lexicographic date range on the YYYY-MM-DD strings.
    if (!userId || !month) {
      return res.status(400).json({ message: 'Missing userId or month' });
    }

    const startStr = `${month}-01`;
    // compute last day of month
    const startDate = new Date(`${month}-01`);
    const endDateObj = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    const endStr = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;

    const attendances = await Attendance.find({
      empID: String(userId),
      date: { $gte: startStr, $lte: endStr },
    });

    if (attendances.length === 0) {
      return res.status(400).json({ message: "No attendance found for this month" });
    }

    // Step 2: Count present days
    const presentDays = attendances.filter(a => a.status === "Present").length;

    // Step 3: Calculate salary
    const totalDays = attendances.length;
    const salaryAmount = (basicSalary / totalDays) * presentDays;

    // Step 4: Save in Salary collection
    const salary = await Salary.create({
      userId,
      month,
      totalDays,
      presentDays,
      salaryAmount,
    });

    res.status(201).json({ message: "Salary calculated", salary });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
