const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  getChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  pinMessage,
  unpinMessage,
  listInvites,
  inviteUser,
  acceptInvite,
  leaveChannel,
  removeMember,
} = require('../controllers/channelController');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getChannels);
router.post('/', createChannel);
router.get('/invites', listInvites);
router.post('/:channelId/invite', inviteUser);
router.post('/:channelId/accept', acceptInvite);
router.post('/:channelId/leave', leaveChannel);
router.delete('/:channelId/members/:userId', removeMember);
router.patch('/:channelId', updateChannel);
router.delete('/:channelId', deleteChannel);
router.post('/:channelId/pin/:messageId', pinMessage);
router.delete('/:channelId/pin', unpinMessage);
router.get('/:channelId/messages', getMessages);
router.post('/:channelId/messages', sendMessage);
router.patch('/:channelId/messages/:messageId', updateMessage);
router.delete('/:channelId/messages/:messageId', deleteMessage);

module.exports = router;
