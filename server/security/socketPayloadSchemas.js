const {
  ValidationError,
  requireString,
  requireObjectId,
  requireEnum,
  sanitizePlainText,
} = require('./validation');

const ROOM_TYPES = ['team', 'direct'];
const ASSIGNMENT_STATUS = ['pending', 'in-progress', 'completed'];

const normalizeAssignmentStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'in_progress') return 'in-progress';
  if (raw === 'done') return 'completed';
  return raw;
};

const ensureObject = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ValidationError('Payload is invalid');
  }
  return payload;
};

const validateJoinRoomPayload = (payload) => {
  const source = ensureObject(payload);
  return {
    roomId: requireString(source.roomId, 'roomId', { max: 160 }),
    type: requireEnum(source.type, 'type', ROOM_TYPES),
  };
};

const validateLeaveRoomPayload = (payload) => {
  const source = ensureObject(payload);
  return {
    roomId: requireString(source.roomId, 'roomId', { max: 160 }),
  };
};

const validateSendMessagePayload = (payload) => {
  const source = ensureObject(payload);
  return {
    roomId: requireString(source.roomId, 'roomId', { max: 160 }),
    type: requireEnum(source.type, 'type', ROOM_TYPES),
    message: requireString(source.message, 'message', { max: 4000 }),
  };
};

const validateAssignTaskPayload = (payload) => {
  const source = ensureObject(payload);
  return {
    cardId: requireString(source.cardId, 'cardId', { max: 120 }),
    teamId: requireObjectId(source.teamId, 'teamId'),
    projectId: requireObjectId(source.projectId, 'projectId'),
    assignedTo: requireObjectId(source.assignedTo, 'assignedTo'),
  };
};

const validateUpdateTaskStatusPayload = (payload) => {
  const source = ensureObject(payload);
  const normalizedStatus = normalizeAssignmentStatus(source.status);
  return {
    assignmentId: requireObjectId(source.assignmentId, 'assignmentId'),
    status: requireEnum(normalizedStatus, 'status', ASSIGNMENT_STATUS),
  };
};

const validateCreateChannelPayload = (payload) => {
  const source = ensureObject(payload);
  return {
    name: requireString(source.name, 'name', { max: 120 }),
    teamId: requireObjectId(source.teamId, 'teamId'),
  };
};

const validateInvitePayload = (payload) => {
  const source = ensureObject(payload);
  return {
    channelId: requireObjectId(source.channelId, 'channelId'),
    userId: requireObjectId(source.userId, 'userId'),
  };
};

const validateAcceptInvitePayload = (payload) => {
  const source = ensureObject(payload);
  return {
    channelId: requireObjectId(source.channelId, 'channelId'),
  };
};

const validateJoinChannelPayload = (payload) => {
  const source = ensureObject(payload);
  return {
    channelId: requireObjectId(source.channelId, 'channelId'),
  };
};

const validateLeaveChannelPayload = (payload) => {
  const source = ensureObject(payload);
  return {
    channelId: requireObjectId(source.channelId, 'channelId'),
  };
};

const validateSendChannelMessagePayload = (payload) => {
  const source = ensureObject(payload);
  return {
    channelId: requireObjectId(source.channelId, 'channelId'),
    message: requireString(source.message, 'message', { max: 4000 }),
  };
};

const validateUpdateChannelMessagePayload = (payload) => {
  const source = ensureObject(payload);
  return {
    channelId: requireObjectId(source.channelId, 'channelId'),
    messageId: requireObjectId(source.messageId, 'messageId'),
    message: requireString(source.message, 'message', { max: 4000 }),
  };
};

const validateDeleteChannelMessagePayload = (payload) => {
  const source = ensureObject(payload);
  return {
    channelId: requireObjectId(source.channelId, 'channelId'),
    messageId: requireObjectId(source.messageId, 'messageId'),
  };
};

const sanitizeSocketError = (error) =>
  sanitizePlainText(error?.message || 'Request validation failed', { maxLength: 200 });

module.exports = {
  ValidationError,
  validateJoinRoomPayload,
  validateLeaveRoomPayload,
  validateSendMessagePayload,
  validateAssignTaskPayload,
  validateUpdateTaskStatusPayload,
  validateCreateChannelPayload,
  validateInvitePayload,
  validateAcceptInvitePayload,
  validateJoinChannelPayload,
  validateLeaveChannelPayload,
  validateSendChannelMessagePayload,
  validateUpdateChannelMessagePayload,
  validateDeleteChannelMessagePayload,
  sanitizeSocketError,
};
