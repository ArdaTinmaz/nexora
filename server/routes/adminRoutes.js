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
  updateTeam,
  deleteTeam,
  listProjects,
  createProject,
  updateProject,
  updateTeamProject,
  deleteProject,
  removeTeamFromProject,
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
router.patch('/teams/:teamId', updateTeam);
router.delete('/teams/:teamId', deleteTeam);

router.get('/projects', listProjects);
router.post('/projects', createProject);
router.patch('/projects/:projectId', updateProject);
router.post('/projects/:projectId/teams/:teamId', updateTeamProject);
router.post('/projects/:projectId/teams/:teamId/remove', removeTeamFromProject);
router.delete('/projects/:projectId', deleteProject);

module.exports = router;
