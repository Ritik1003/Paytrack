const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Salary = require("../models/Salary");

// Get all users (exclude password)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

// Update a user's editable fields
exports.updateUser = async (req, res) => {
  try {
    const id = req.params.id;
    // Accept editable fields. empID may be provided to rename the user (primary key change).
    const { empID, department, basicSalary, pf, status } = req.body;

    // Build other updates first
    const update = {};
    if (department !== undefined) update.department = department;
    if (basicSalary !== undefined) update.basicSalary = basicSalary;
    if (pf !== undefined) update.pf = pf;
    if (status !== undefined) update.status = status;

    // If empID provided and different, perform a rename/migrate so the primary key becomes the new empID
    let targetId = id;
    if (empID !== undefined && empID !== null && String(empID).trim() !== '' && String(empID) !== String(id)) {
      const newId = String(empID);
      // ensure newId isn't already used
      const exists = await User.findById(newId);
      if (exists) return res.status(400).json({ message: 'Target empID already exists' });

      // Load old user
      const oldUser = await User.findById(id).lean();
      if (!oldUser) return res.status(404).json({ message: 'User not found' });

      // Prepare new document (preserve password and other fields)
      const newDoc = Object.assign({}, oldUser);
      newDoc._id = newId;
      // Remove mongoose internal fields
      delete newDoc.__v;

      // Insert new document
      await User.create(newDoc);

      // Migrate related collections: Attendance.empID and Salary.userId
      try {
        await Attendance.updateMany({ empID: String(id) }, { $set: { empID: newId } });
      } catch (e) {
        // log and continue
        console.warn('Failed to migrate attendance empID for user rename', e && e.message ? e.message : e);
      }
      try {
        await Salary.updateMany({ userId: String(id) }, { $set: { userId: newId } });
      } catch (e) {
        console.warn('Failed to migrate salary userId for user rename', e && e.message ? e.message : e);
      }

      // Remove old user document
      await User.deleteOne({ _id: id });

      targetId = newId;
    }

    // Apply other updates to the (possibly renamed) user
    const user = await User.findByIdAndUpdate(targetId, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User updated', user });
  } catch (error) {
    console.error('updateUser error:', error && error.stack ? error.stack : error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// Delete a user by id (empID). Also remove or migrate related records.
exports.deleteUser = async (req, res) => {
  try {
    const id = req.params.id;
    // Ensure user exists
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Remove attendance records tied to this empID
    try {
      await Attendance.deleteMany({ empID: String(id) });
    } catch (e) {
      console.warn('Failed to delete attendance for user', id, e && e.message ? e.message : e);
    }

    // Remove salary records tied to this userId
    try {
      await Salary.deleteMany({ userId: String(id) });
    } catch (e) {
      console.warn('Failed to delete salary records for user', id, e && e.message ? e.message : e);
    }

    // Finally, delete the user document
    await User.deleteOne({ _id: id });
    res.json({ message: 'User and related records deleted' });
  } catch (error) {
    console.error('deleteUser error:', error && error.stack ? error.stack : error);
    res.status(500).json({ message: 'Server error', error });
  }
};
