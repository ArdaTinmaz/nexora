const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getChannels,
  createChannel,
  getMessages,
  sendMessage,
  listInvites,
  inviteUser,
  acceptInvite,
} = require('../controllers/channelController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getChannels);
router.post('/', createChannel);
router.get('/invites', listInvites);
router.post('/:channelId/invite', inviteUser);
router.post('/:channelId/accept', acceptInvite);
router.get('/:channelId/messages', getMessages);
router.post('/:channelId/messages', sendMessage);

module.exports = router;
