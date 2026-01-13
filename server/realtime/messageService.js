const Message = require('../models/Message');
const { verifyRoomAccess } = require('./roomAuth');

const saveMessage = async ({ roomId, senderId, senderRole, message, type }) => {
  const entry = await Message.create({
    roomId,
    senderId,
    senderRole,
    message,
    type,
    createdAt: Date.now(),
  });

  return {
    id: entry._id.toString(),
    roomId,
    senderId,
    senderRole,
    message,
    type,
    createdAt: entry.createdAt,
  };
};

const handleSendMessage = async ({ roomId, message, type, userId }) => {
  const { authorized, role } = await verifyRoomAccess({ roomId, type, userId });
  if (!authorized) {
    const error = new Error('Unauthorized room');
    error.statusCode = 401;
    throw error;
  }

  return saveMessage({
    roomId,
    senderId: userId,
    senderRole: role,
    message,
    type,
  });
};

module.exports = {
  handleSendMessage,
};
