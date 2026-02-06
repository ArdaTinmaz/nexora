const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getProjects,
  getAssignedProjects,
  createProject,
  listTeams,
  createTeam,
  addMember,
} = require('../controllers/projectController');
const companyBoardController = require('../controllers/companyBoardController');

const router = express.Router();

router.use(authMiddleware);

router.get('/assigned', getAssignedProjects);

router.get('/:projectId/board', companyBoardController.getCompanyBoard);
router.patch('/:projectId/board', companyBoardController.updateBoardSettings);
router.post('/:projectId/board/columns', companyBoardController.createColumn);
router.patch('/:projectId/board/columns/:columnId', companyBoardController.updateColumn);
router.delete('/:projectId/board/columns/:columnId', companyBoardController.deleteColumn);
router.post('/:projectId/board/columns/:columnId/cards', companyBoardController.createCard);
router.patch('/:projectId/board/columns/:columnId/cards/:cardId', companyBoardController.updateCard);
router.delete('/:projectId/board/columns/:columnId/cards/:cardId', companyBoardController.deleteCard);
router.patch('/:projectId/board/cards/move', companyBoardController.moveCard);

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
