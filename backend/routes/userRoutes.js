const express = require('express');
const { getAllUsers, updateUser, deleteUser } = require('../controllers/userController');
const { resetAllUsers } = require('../controllers/resetController');
const router = express.Router();

router.get('/', getAllUsers);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);
// Delete all employee users (preserves admin/manager accounts)
router.delete('/reset-all', resetAllUsers);

module.exports = router;
