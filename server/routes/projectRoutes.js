const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getProjects,
  createProject,
  listTeams,
  createTeam,
  addMember,
} = require('../controllers/projectController');

const router = express.Router();

router.use(authMiddleware);

router
  .route('/')
  .get(getProjects)
  .post(createProject);

router
  .route('/:projectId/teams')
  .get(listTeams)
  .post(createTeam);

router.post('/:projectId/teams/:teamId/members', addMember);

module.exports = router;
