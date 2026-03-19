const Message = require('../models/Message');
const { verifyRoomAccess } = require('./roomAuth');
const { encryptText } = require('../security/dataEncryption');
const { sanitizePlainText } = require('../security/validation');

const saveMessage = async ({ roomId, senderId, senderRole, message, type }) => {
  const normalizedMessage = sanitizePlainText(message, { maxLength: 4000 });
  const entry = await Message.create({
    roomId,
    senderId,
    senderRole,
    message: encryptText(normalizedMessage),
    type,
    createdAt: Date.now(),
  });

  return {
    id: entry._id.toString(),
    roomId,
    senderId,
    senderRole,
    message: normalizedMessage,
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
