const {
  listChannelsForUser,
  createChannel,
  getChannelMessages,
  saveChannelMessage,
  createInvite,
  listInvitesForUser,
  acceptInvite,
  ensureChannelMember,
} = require('../services/channelService');

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
      });
      io.to(`user:${req.user.id}`).emit('channelJoined', {
        channelId,
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
