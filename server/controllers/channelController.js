const {
  listChannelsForUser,
  createChannel,
  updateChannel: updateChannelService,
  deleteChannel: deleteChannelService,
  getChannelMessages,
  saveChannelMessage,
  updateChannelMessage,
  deleteChannelMessage,
  pinChannelMessage,
  unpinChannelMessage,
  createInvite,
  listInvitesForUser,
  acceptInvite,
  ensureChannelMember,
} = require('../services/channelService');
const { createNotification } = require('../services/notificationService');

exports.getChannels = async (req, res, next) => {
  try {
    const channels = await listChannelsForUser(req.user.id);
    res.json(channels);
  } catch (error) {
    next(error);
  }
};

exports.createChannel = async (req, res, next) => {
  try {
    const { name, teamId } = req.body;
    if (!name || !teamId) {
      return res.status(400).json({ message: 'Kanal adı ve takım zorunlu' });
    }
    const channel = await createChannel({ name, teamId, createdBy: req.user.id });

    const io = req.app.get('io');
    if (io) {
      io.to(`team:${teamId}`).emit('channelCreated', channel);
    }

    res.status(201).json(channel);
  } catch (error) {
    next(error);
  }
};

exports.updateChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Kanal adı zorunlu' });
    }

    const updated = await updateChannelService({
      channelId,
      name: name.trim(),
      userId: req.user.id,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`team:${updated.teamId}`).emit('channelUpdated', updated);
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

exports.deleteChannel = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const deleted = await deleteChannelService({
      channelId,
      userId: req.user.id,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`team:${deleted.teamId}`).emit('channelDeleted', { id: deleted.id, teamId: deleted.teamId });
      io.to(`channel:${deleted.id}`).emit('channelDeleted', { id: deleted.id, teamId: deleted.teamId });
    }

    res.json({ id: deleted.id, teamId: deleted.teamId, name: deleted.name });
  } catch (error) {
    next(error);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    await ensureChannelMember(channelId, req.user.id);
    const messages = await getChannelMessages(channelId, Number(req.query.limit) || 50);
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Mesaj zorunlu' });
    }

    const saved = await saveChannelMessage({
      channelId,
      userId: req.user.id,
      message: message.trim(),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('receiveChannelMessage', saved);
    }

    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
};

exports.updateMessage = async (req, res, next) => {
  try {
    const { channelId, messageId } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Mesaj zorunlu' });
    }

    const updated = await updateChannelMessage({
      channelId,
      messageId,
      userId: req.user.id,
      message: message.trim(),
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('channelMessageUpdated', updated);
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

exports.deleteMessage = async (req, res, next) => {
  try {
    const { channelId, messageId } = req.params;
    const deleted = await deleteChannelMessage({
      channelId,
      messageId,
      userId: req.user.id,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('channelMessageDeleted', deleted);
    }

    res.json(deleted);
  } catch (error) {
    next(error);
  }
};

exports.pinMessage = async (req, res, next) => {
  try {
    const { channelId, messageId } = req.params;
    const updatedChannel = await pinChannelMessage({
      channelId,
      messageId,
      userId: req.user.id,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`team:${updatedChannel.teamId}`).emit('channelUpdated', updatedChannel);
    }

    res.json(updatedChannel);
  } catch (error) {
    next(error);
  }
};

exports.unpinMessage = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const updatedChannel = await unpinChannelMessage({
      channelId,
      userId: req.user.id,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`team:${updatedChannel.teamId}`).emit('channelUpdated', updatedChannel);
    }

    res.json(updatedChannel);
  } catch (error) {
    next(error);
  }
};

exports.listInvites = async (req, res, next) => {
  try {
    const invites = await listInvitesForUser(req.user.id);
    res.json(invites);
  } catch (error) {
    next(error);
  }
};

exports.inviteUser = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId zorunlu' });
    }

    const invite = await createInvite({
      channelId,
      fromUserId: req.user.id,
      toUserId: userId,
    });

    await createNotification({
      userId,
      type: 'channel_invite_received',
      category: 'general',
      title: 'Channel invitation',
      message: 'You have been invited to join a channel.',
      link: `/home/tasks?chat=1&channelId=${channelId}`,
      meta: {
        channelId,
        inviteId: invite._id?.toString() || invite.id || '',
        fromUserId: req.user.id,
      },
      dedupKey: `channel-invite:${channelId}:${userId}`,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('channelInvited', {
        id: invite._id?.toString() || invite.id,
        channelId,
        fromUserId: req.user.id,
      });
    }

    res.status(201).json({
      id: invite._id?.toString() || invite.id,
      channelId,
      fromUserId: req.user.id,
      toUserId: userId,
      status: invite.status,
      createdAt: invite.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

exports.acceptInvite = async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const result = await acceptInvite({ channelId, userId: req.user.id });

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('channelMemberJoined', {
        userId: req.user.id,
        channelId,
        userName: req.user?.name || 'User',
        avatarURL: req.user?.avatarURL || '',
        joinedAt: Date.now(),
      });
      io.to(`user:${req.user.id}`).emit('channelJoined', {
        channelId,
      });
    }

    const inviterId = result?.invite?.fromUserId?.toString?.() || result?.invite?.fromUserId || '';
    if (inviterId && inviterId !== req.user.id) {
      await createNotification({
        userId: inviterId,
        type: 'channel_invite_accepted',
        category: 'general',
        title: 'Invitation accepted',
        message: `${req.user?.name || 'A user'} joined #${result?.channel?.name || 'channel'}.`,
        link: `/home/tasks?chat=1&channelId=${channelId}`,
        meta: {
          channelId,
          joinedUserId: req.user.id,
        },
      });
    }

    res.json({
      channel: result.channel,
      invite: {
        id: result.invite._id?.toString() || result.invite.id,
        status: result.invite.status,
      },
    });
  } catch (error) {
    next(error);
  }
};
