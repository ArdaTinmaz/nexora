const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.use(authMiddleware);

router.get('/assigned', taskController.getMyAssignments);
router.post('/', taskController.createAssignment);
router.patch('/:assignmentId', taskController.updateAssignment);
router.delete('/:assignmentId', taskController.deleteAssignment);
router.post('/:assignmentId/transfer', taskController.transferAssignment);
router.patch('/:assignmentId/status', taskController.updateAssignmentStatus);

module.exports = router;
