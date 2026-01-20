const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getMyTeams, getTeamMembers } = require('../controllers/teamController');

const router = express.Router();

router.use(authMiddleware);
router.get('/my', getMyTeams);
router.get('/:teamId/members', getTeamMembers);

module.exports = router;
