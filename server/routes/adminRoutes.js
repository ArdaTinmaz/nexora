const express = require('express');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');
const { login } = require('../controllers/adminAuthController');
const {
  listUsers,
  updateUserMeta,
  listTeams,
  createTeam,
  addMemberToTeam,
  removeMemberFromTeam,
  deleteTeam,
  listProjects,
  createProject,
} = require('../controllers/adminController');

const router = express.Router();

router.post('/login', login);

router.use(adminAuthMiddleware);

router.get('/users', listUsers);
router.post('/users/:userId/meta', updateUserMeta);

router.get('/teams', listTeams);
router.post('/teams', createTeam);
router.post('/teams/:teamId/members', addMemberToTeam);
router.delete('/teams/:teamId/members/:userId', removeMemberFromTeam);
router.delete('/teams/:teamId', deleteTeam);

router.get('/projects', listProjects);
router.post('/projects', createProject);

module.exports = router;
