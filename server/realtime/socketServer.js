const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const { Server } = require('socket.io');
const connectDatabase = require('../config/db');
const app = require('../app');
const authenticateSocket = require('./authSocket');
const { verifyRoomAccess } = require('./roomAuth');
const { handleSendMessage } = require('./messageService');
const { createAssignment, updateAssignmentStatus } = require('./taskAssignmentService');
const {
  listChannelsForUser,
  createChannel,
  createInvite,
  acceptInvite,
  ensureChannelMember,
  saveChannelMessage,
  saveChannelSystemMessage,
  updateChannelMessage,
  deleteChannelMessage,
} = require('../services/channelService');
const { createNotification } = require('../services/notificationService');
const { logSecurityEvent } = require('../services/auditLogService');
const { checkSocketEventRateLimit } = require('../security/socketRateLimit');
const { extractClientIpFromSocket, getUserAgentFromSocket } = require('../security/requestMeta');
const {
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
} = require('../security/socketPayloadSchemas');

const getAllowedOrigins = () => {
  if (!process.env.CLIENT_URL) return ['http://localhost:3000'];
  return process.env.CLIENT_URL.split(',').map((item) => item.trim());
};

const SOCKET_EVENT_LIMITS = {
  joinRoom: { maxEvents: 40, windowMs: 60 * 1000 },
  sendMessage: { maxEvents: 30, windowMs: 10 * 1000 },
  assignTask: { maxEvents: 20, windowMs: 60 * 1000 },
  updateTaskStatus: { maxEvents: 30, windowMs: 60 * 1000 },
  listChannels: { maxEvents: 40, windowMs: 60 * 1000 },
  createChannel: { maxEvents: 15, windowMs: 60 * 1000 },
  inviteToChannel: { maxEvents: 20, windowMs: 60 * 1000 },
  acceptChannelInvite: { maxEvents: 20, windowMs: 60 * 1000 },
  joinChannel: { maxEvents: 40, windowMs: 60 * 1000 },
  leaveChannel: { maxEvents: 40, windowMs: 60 * 1000 },
  sendChannelMessage: { maxEvents: 30, windowMs: 10 * 1000 },
  updateChannelMessage: { maxEvents: 30, windowMs: 30 * 1000 },
  deleteChannelMessage: { maxEvents: 30, windowMs: 30 * 1000 },
};

const startSocketServer = async () => {
  await connectDatabase();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
  });

  app.set('io', io);

  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    const socketIp = extractClientIpFromSocket(socket);
    const socketUserAgent = getUserAgentFromSocket(socket);
    socket.join(`user:${userId}`);

    const getCallback = (callback) => (typeof callback === 'function' ? callback : () => {});

    const enforceRateLimit = (eventName, callback) => {
      const callbackSafe = getCallback(callback);
      const limit = SOCKET_EVENT_LIMITS[eventName];
      if (!limit) return { allowed: true };

      const key = `${userId}:${eventName}`;
      const result = checkSocketEventRateLimit({
        key,
        windowMs: limit.windowMs,
        maxEvents: limit.maxEvents,
      });

      if (result.allowed) {
        return { allowed: true };
      }

      const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));
      callbackSafe({
        error: 'Too many requests. Please wait and try again.',
        retryAfterSeconds,
      });
      return { allowed: false };
    };

    const handleSocketError = (callback, err) => {
      const callbackSafe = getCallback(callback);
      const message =
        err instanceof ValidationError ? sanitizeSocketError(err) : sanitizeSocketError(err);
      callbackSafe({ error: message });
    };

    socket.on('joinRoom', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('joinRoom', callback).allowed) return;

      try {
        const { roomId, type } = validateJoinRoomPayload(payload);
        const { authorized } = await verifyRoomAccess({ roomId, type, userId });
        if (!authorized) {
          return getCallback(callback)({ error: 'Unauthorized' });
        }
        socket.join(roomId);
        return getCallback(callback)({ ok: true });
      } catch (err) {
        return handleSocketError(callback, err);
      }
    });

    socket.on('leaveRoom', (payload, callback = () => {}) => {
      try {
        const { roomId } = validateLeaveRoomPayload(payload);
        socket.leave(roomId);
        getCallback(callback)({ ok: true });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('sendMessage', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('sendMessage', callback).allowed) return;

      try {
        const { roomId, message, type } = validateSendMessagePayload(payload);
        const saved = await handleSendMessage({ roomId, message, type, userId });
        io.to(roomId).emit('receiveMessage', saved);
        getCallback(callback)({ ok: true, message: saved });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('assignTask', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('assignTask', callback).allowed) return;

      try {
        const { cardId, teamId, projectId, assignedTo } = validateAssignTaskPayload(payload);
        const assignment = await createAssignment({
          cardId,
          teamId,
          projectId,
          assignedBy: userId,
          assignedTo,
        });

        if (assignment.assignedTo !== userId) {
          await createNotification({
            userId: assignment.assignedTo,
            type: 'task_assigned',
            category: 'general',
            title: 'New task assigned',
            message: 'A task has been assigned to you.',
            link: '/home/tasks',
            meta: {
              assignmentId: assignment.id,
              cardId: assignment.cardId || null,
              projectId: assignment.projectId || '',
              teamId: assignment.teamId || '',
            },
          });
        }

        io.to(`user:${assignedTo}`).emit('taskAssigned', assignment);
        io.to(`team:${teamId}`).emit('taskAssigned', assignment);

        getCallback(callback)({ ok: true, assignment });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('updateTaskStatus', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('updateTaskStatus', callback).allowed) return;

      try {
        const { assignmentId, status } = validateUpdateTaskStatusPayload(payload);
        const updated = await updateAssignmentStatus({ assignmentId, status, userId });
        io.to(`team:${updated.teamId}`).emit('taskStatusUpdated', updated);
        io.to(`user:${updated.assignedBy}`).emit('taskStatusUpdated', updated);
        io.to(`user:${updated.assignedTo}`).emit('taskStatusUpdated', updated);
        getCallback(callback)({ ok: true, assignment: updated });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('disconnect', () => {
      socket.leaveAll();
    });

    // Channel events (Slack-like)
    socket.on('listChannels', async (callback = () => {}) => {
      if (!enforceRateLimit('listChannels', callback).allowed) return;

      try {
        const channels = await listChannelsForUser(userId);
        getCallback(callback)({ ok: true, channels });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('createChannel', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('createChannel', callback).allowed) return;

      try {
        const { name, teamId } = validateCreateChannelPayload(payload);
        const channel = await createChannel({ name, teamId, createdBy: userId });
        io.to(`team:${teamId}`).emit('channelCreated', channel);
        getCallback(callback)({ ok: true, channel });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('inviteToChannel', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('inviteToChannel', callback).allowed) return;

      try {
        const { channelId, userId: targetUserId } = validateInvitePayload(payload);
        const invite = await createInvite({
          channelId,
          fromUserId: userId,
          toUserId: targetUserId,
        });
        await createNotification({
          userId: targetUserId,
          type: 'channel_invite_received',
          category: 'general',
          title: 'Channel invitation',
          message: 'You have been invited to join a channel.',
          link: `/home/tasks?chat=1&channelId=${channelId}`,
          meta: {
            channelId,
            inviteId: invite._id?.toString() || invite.id || '',
            fromUserId: userId,
          },
          dedupKey: `channel-invite:${invite._id?.toString() || invite.id || channelId}:${targetUserId}`,
        });
        io.to(`user:${targetUserId}`).emit('channelInvited', {
          id: invite._id?.toString() || invite.id,
          channelId,
          channelName: invite.channelName || '',
          fromUserId: userId,
        });
        await logSecurityEvent({
          eventType: 'channel.invite_created',
          category: 'channel',
          severity: 'medium',
          outcome: 'success',
          actorType: 'user',
          actorId: userId,
          actorName: socket.user?.name || '',
          targetType: 'user',
          targetId: targetUserId,
          resource: 'socket:inviteToChannel',
          ip: socketIp,
          userAgent: socketUserAgent,
          message: 'Channel invite created via socket',
          metadata: { channelId },
        });
        getCallback(callback)({ ok: true });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('acceptChannelInvite', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('acceptChannelInvite', callback).allowed) return;

      try {
        const { channelId } = validateAcceptInvitePayload(payload);
        const result = await acceptInvite({ channelId, userId });
        const joinedAt = Date.now();
        const joinedUserName = socket.user?.name || 'User';
        const joinedUserAvatarURL = socket.user?.avatarURL || '';
        const systemMessage = await saveChannelSystemMessage({
          channelId,
          userId,
          message: `${joinedUserName} joined.`,
          systemEvent: 'member_joined',
          systemMeta: {
            joinedUserId: userId,
            joinedUserName,
            joinedUserAvatarURL,
          },
        });
        socket.join(`channel:${channelId}`);
        io.to(`channel:${channelId}`).emit('channelMemberJoined', {
          channelId,
          userId,
          userName: joinedUserName,
          avatarURL: joinedUserAvatarURL,
          joinedAt,
        });
        io.to(`channel:${channelId}`).emit('receiveChannelMessage', systemMessage);
        const inviterId = result?.invite?.fromUserId?.toString?.() || result?.invite?.fromUserId || '';
        if (inviterId && inviterId !== userId) {
          await createNotification({
            userId: inviterId,
            type: 'channel_invite_accepted',
            category: 'general',
            title: 'Invitation accepted',
            message: `${socket.user?.name || 'A user'} joined #${result?.channel?.name || 'channel'}.`,
            link: `/home/tasks?chat=1&channelId=${channelId}`,
            meta: {
              channelId,
              joinedUserId: userId,
            },
          });
        }
        await logSecurityEvent({
          eventType: 'channel.invite_accepted',
          category: 'channel',
          severity: 'low',
          outcome: 'success',
          actorType: 'user',
          actorId: userId,
          actorName: socket.user?.name || '',
          resource: 'socket:acceptChannelInvite',
          ip: socketIp,
          userAgent: socketUserAgent,
          message: 'Channel invite accepted via socket',
          metadata: { channelId },
        });
        getCallback(callback)({ ok: true, channel: result.channel });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('joinChannel', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('joinChannel', callback).allowed) return;

      try {
        const { channelId } = validateJoinChannelPayload(payload);
        await ensureChannelMember(channelId, userId);
        socket.join(`channel:${channelId}`);
        getCallback(callback)({ ok: true });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('leaveChannel', (payload, callback = () => {}) => {
      if (!enforceRateLimit('leaveChannel', callback).allowed) return;

      try {
        const { channelId } = validateLeaveChannelPayload(payload);
        socket.leave(`channel:${channelId}`);
        getCallback(callback)({ ok: true });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('sendChannelMessage', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('sendChannelMessage', callback).allowed) return;

      try {
        const { channelId, message } = validateSendChannelMessagePayload(payload);
        const saved = await saveChannelMessage({ channelId, userId, message });
        io.to(`channel:${channelId}`).emit('receiveChannelMessage', saved);
        getCallback(callback)({ ok: true, message: saved });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('updateChannelMessage', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('updateChannelMessage', callback).allowed) return;

      try {
        const { channelId, messageId, message } = validateUpdateChannelMessagePayload(payload);
        const updated = await updateChannelMessage({
          channelId,
          messageId,
          userId,
          message,
        });
        io.to(`channel:${channelId}`).emit('channelMessageUpdated', updated);
        getCallback(callback)({ ok: true, message: updated });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });

    socket.on('deleteChannelMessage', async (payload, callback = () => {}) => {
      if (!enforceRateLimit('deleteChannelMessage', callback).allowed) return;

      try {
        const { channelId, messageId } = validateDeleteChannelMessagePayload(payload);
        const deleted = await deleteChannelMessage({ channelId, messageId, userId });
        io.to(`channel:${channelId}`).emit('channelMessageDeleted', deleted);
        getCallback(callback)({ ok: true, message: deleted });
      } catch (err) {
        handleSocketError(callback, err);
      }
    });
  });

  const PORT = process.env.SOCKET_PORT || 5002;
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Socket.io sunucusu ${PORT} portunda çalışıyor`);
  });
};

if (require.main === module) {
  startSocketServer();
}

module.exports = startSocketServer;
