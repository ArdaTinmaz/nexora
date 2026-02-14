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
  updateChannelMessage,
  deleteChannelMessage,
} = require('../services/channelService');

const getAllowedOrigins = () => {
  if (!process.env.CLIENT_URL) return ['http://localhost:3000'];
  return process.env.CLIENT_URL.split(',').map((item) => item.trim());
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
    socket.join(`user:${userId}`);

    socket.on('joinRoom', async ({ roomId, type }, callback = () => {}) => {
      try {
        const { authorized } = await verifyRoomAccess({ roomId, type, userId });
        if (!authorized) {
          return callback({ error: 'Unauthorized' });
        }
        socket.join(roomId);
        return callback({ ok: true });
      } catch (err) {
        return callback({ error: err.message });
      }
    });

    socket.on('leaveRoom', ({ roomId }) => {
      socket.leave(roomId);
    });

    socket.on('sendMessage', async ({ roomId, message, type }, callback = () => {}) => {
      try {
        const saved = await handleSendMessage({ roomId, message, type, userId });
        io.to(roomId).emit('receiveMessage', saved);
        callback({ ok: true, message: saved });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on(
      'assignTask',
      async ({ cardId, teamId, projectId, assignedTo }, callback = () => {}) => {
        try {
          const assignment = await createAssignment({
            cardId,
            teamId,
            projectId,
            assignedBy: userId,
            assignedTo,
          });

          io.to(`user:${assignedTo}`).emit('taskAssigned', assignment);
          io.to(`team:${teamId}`).emit('taskAssigned', assignment);

          callback({ ok: true, assignment });
        } catch (err) {
          callback({ error: err.message });
        }
      }
    );

    socket.on(
      'updateTaskStatus',
      async ({ assignmentId, status }, callback = () => {}) => {
        try {
          const updated = await updateAssignmentStatus({ assignmentId, status, userId });
          io.to(`team:${updated.teamId}`).emit('taskStatusUpdated', updated);
          io.to(`user:${updated.assignedBy}`).emit('taskStatusUpdated', updated);
          io.to(`user:${updated.assignedTo}`).emit('taskStatusUpdated', updated);
          callback({ ok: true, assignment: updated });
        } catch (err) {
          callback({ error: err.message });
        }
      }
    );

    socket.on('disconnect', () => {
      socket.leaveAll();
    });

    // Channel events (Slack-like)
    socket.on('listChannels', async (callback = () => {}) => {
      try {
        const channels = await listChannelsForUser(userId);
        callback({ ok: true, channels });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('createChannel', async ({ name, teamId }, callback = () => {}) => {
      try {
        const channel = await createChannel({ name, teamId, createdBy: userId });
        io.to(`team:${teamId}`).emit('channelCreated', channel);
        callback({ ok: true, channel });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('inviteToChannel', async ({ channelId, userId: targetUserId }, callback = () => {}) => {
      try {
        const invite = await createInvite({
          channelId,
          fromUserId: userId,
          toUserId: targetUserId,
        });
        io.to(`user:${targetUserId}`).emit('channelInvited', {
          id: invite._id?.toString() || invite.id,
          channelId,
          fromUserId: userId,
        });
        callback({ ok: true });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('acceptChannelInvite', async ({ channelId }, callback = () => {}) => {
      try {
        const result = await acceptInvite({ channelId, userId });
        socket.join(`channel:${channelId}`);
        io.to(`channel:${channelId}`).emit('channelMemberJoined', {
          channelId,
          userId,
        });
        callback({ ok: true, channel: result.channel });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('joinChannel', async ({ channelId }, callback = () => {}) => {
      try {
        await ensureChannelMember(channelId, userId);
        socket.join(`channel:${channelId}`);
        callback({ ok: true });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on('leaveChannel', ({ channelId }) => {
      socket.leave(`channel:${channelId}`);
    });

    socket.on('sendChannelMessage', async ({ channelId, message }, callback = () => {}) => {
      try {
        const saved = await saveChannelMessage({ channelId, userId, message });
        io.to(`channel:${channelId}`).emit('receiveChannelMessage', saved);
        callback({ ok: true, message: saved });
      } catch (err) {
        callback({ error: err.message });
      }
    });

    socket.on(
      'updateChannelMessage',
      async ({ channelId, messageId, message }, callback = () => {}) => {
        try {
          if (!message || !message.trim()) {
            return callback({ error: 'Message is required' });
          }
          const updated = await updateChannelMessage({
            channelId,
            messageId,
            userId,
            message: message.trim(),
          });
          io.to(`channel:${channelId}`).emit('channelMessageUpdated', updated);
          callback({ ok: true, message: updated });
        } catch (err) {
          callback({ error: err.message });
        }
      }
    );

    socket.on('deleteChannelMessage', async ({ channelId, messageId }, callback = () => {}) => {
      try {
        const deleted = await deleteChannelMessage({ channelId, messageId, userId });
        io.to(`channel:${channelId}`).emit('channelMessageDeleted', deleted);
        callback({ ok: true, message: deleted });
      } catch (err) {
        callback({ error: err.message });
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
