const express = require('express');
const adminAuthMiddleware = require('../middleware/adminAuthMiddleware');
const {
  login,
  logout,
  requestPasswordReset,
  verifyPasswordReset,
  resetPassword,
} = require('../controllers/adminAuthController');
const { getAdminProfile, updateAdminProfile } = require('../controllers/adminProfileController');
const { createEndpointRateLimiter } = require('../security/endpointRateLimit');
const adminActionAuditMiddleware = require('../middleware/adminActionAuditMiddleware');
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

const adminLoginRateLimiter = createEndpointRateLimiter({
  scope: 'admin:login',
  windowMs: 60 * 1000,
  maxRequests: Number(process.env.ADMIN_LOGIN_RATE_LIMIT_PER_MINUTE) || 10,
});

router.post('/login', adminLoginRateLimiter, login);
router.post('/logout', logout);
router.post('/forgot-password/request', requestPasswordReset);
router.post('/forgot-password/verify', verifyPasswordReset);
router.post('/forgot-password/reset', resetPassword);

router.use(adminAuthMiddleware);
router.use(adminActionAuditMiddleware);

router.get('/profile', getAdminProfile);
router.patch('/profile', updateAdminProfile);

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
