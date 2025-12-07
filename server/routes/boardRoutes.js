const express = require('express');
const boardController = require('../controllers/boardController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

router
  .route('/')
  .get(boardController.getBoards)
  .post(boardController.createBoard);

router
  .route('/:boardId')
  .get(boardController.getBoard)
  .patch(boardController.updateBoard)
  .delete(boardController.deleteBoard);

router.patch('/:boardId/background', boardController.updateBoardBackground);

router
  .route('/:boardId/columns')
  .post(boardController.createColumn);

router
  .route('/:boardId/columns/:columnId')
  .patch(boardController.updateColumn)
  .delete(boardController.deleteColumn);

router
  .route('/:boardId/columns/:columnId/cards')
  .post(boardController.createCard);

router
  .route('/:boardId/columns/:columnId/cards/:cardId')
  .patch(boardController.updateCard)
  .delete(boardController.deleteCard);

router.patch('/:boardId/cards/move', boardController.moveCard);

module.exports = router;
