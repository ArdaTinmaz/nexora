const {
  listChannelsForUser,
  createChannel,
  updateChannel: updateChannelService,
  deleteChannel: deleteChannelService,
  getChannelMessages,
  saveChannelMessage,
  saveChannelSystemMessage,
  updateChannelMessage,
  deleteChannelMessage,
  pinChannelMessage,
  unpinChannelMessage,
  createInvite,
  listInvitesForUser,
  acceptInvite,
  leaveChannel: leaveChannelService,
  removeChannelMember,
} = require('../services/channelService');
const { createNotification } = require('../services/notificationService');
const UserModel = require('../models/User');
const { logSecurityEvent } = require('../services/auditLogService');
const { extractClientIpFromRequest, getUserAgentFromRequest } = require('../security/requestMeta');
const { requireString, requireObjectId } = require('../security/validation');

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
    const name = requireString(req.body?.name, 'Kanal adı', { max: 120 });
    const teamId = requireObjectId(req.body?.teamId, 'teamId');
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
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const name = requireString(req.body?.name, 'Kanal adı', { max: 120 });

    const updated = await updateChannelService({
      channelId,
      name,
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
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
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
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const messages = await getChannelMessages({
      channelId,
      userId: req.user.id,
      limit: Number(req.query.limit) || 50,
    });
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const message = requireString(req.body?.message, 'Mesaj', { max: 4000 });

    const saved = await saveChannelMessage({
      channelId,
      userId: req.user.id,
      message,
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
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const messageId = requireObjectId(req.params?.messageId, 'messageId');
    const message = requireString(req.body?.message, 'Mesaj', { max: 4000 });

    const updated = await updateChannelMessage({
      channelId,
      messageId,
      userId: req.user.id,
      message,
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
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const messageId = requireObjectId(req.params?.messageId, 'messageId');
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
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const messageId = requireObjectId(req.params?.messageId, 'messageId');
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
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
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
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const userId = requireObjectId(req.body?.userId, 'userId');

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
      dedupKey: `channel-invite:${invite._id?.toString() || invite.id || channelId}:${userId}`,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('channelInvited', {
        id: invite._id?.toString() || invite.id,
        channelId,
        channelName: invite.channelName || '',
        fromUserId: req.user.id,
      });
    }

    await logSecurityEvent({
      eventType: 'channel.invite_created',
      category: 'channel',
      severity: 'medium',
      outcome: 'success',
      actorType: 'user',
      actorId: req.user.id,
      actorName: req.user?.name || '',
      targetType: 'user',
      targetId: userId,
      resource: `/api/channels/${channelId}/invite`,
      ip: extractClientIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
      message: 'Channel invite created',
      metadata: {
        channelId,
      },
    });

    res.status(201).json({
      id: invite._id?.toString() || invite.id,
      channelId,
      channelName: invite.channelName || '',
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
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const result = await acceptInvite({ channelId, userId: req.user.id });
    const joinedAt = Date.now();
    const joinedUserName = req.user?.name || 'User';
    const joinedUserAvatarURL = req.user?.avatarURL || '';
    const systemMessage = await saveChannelSystemMessage({
      channelId,
      userId: req.user.id,
      message: `${joinedUserName} joined.`,
      systemEvent: 'member_joined',
      systemMeta: {
        joinedUserId: req.user.id,
        joinedUserName,
        joinedUserAvatarURL,
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('channelMemberJoined', {
        userId: req.user.id,
        channelId,
        userName: joinedUserName,
        avatarURL: joinedUserAvatarURL,
        joinedAt,
      });
      io.to(`channel:${channelId}`).emit('receiveChannelMessage', systemMessage);
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

    await logSecurityEvent({
      eventType: 'channel.invite_accepted',
      category: 'channel',
      severity: 'low',
      outcome: 'success',
      actorType: 'user',
      actorId: req.user.id,
      actorName: req.user?.name || '',
      resource: `/api/channels/${channelId}/accept`,
      ip: extractClientIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
      message: 'Channel invite accepted',
      metadata: {
        channelId,
      },
    });

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

exports.leaveChannel = async (req, res, next) => {
  try {
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const leftAt = Date.now();
    const leftUserName = req.user?.name || 'User';
    const leftUserAvatarURL = req.user?.avatarURL || '';

    const result = await leaveChannelService({ channelId, userId: req.user.id });
    const systemMessage = await saveChannelSystemMessage({
      channelId,
      userId: req.user.id,
      message: `${leftUserName} left.`,
      systemEvent: 'member_left',
      systemMeta: {
        leftUserId: req.user.id,
        leftUserName,
        leftUserAvatarURL,
      },
      skipMembershipCheck: true,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('receiveChannelMessage', systemMessage);
      io.to(`channel:${channelId}`).emit('channelMemberLeft', {
        channelId,
        channelName: result.channelName,
        userId: req.user.id,
        userName: leftUserName,
        avatarURL: leftUserAvatarURL,
        reason: 'left',
        leftAt,
      });
      io.to(`user:${req.user.id}`).emit('channelRemovedForUser', {
        channelId,
        channelName: result.channelName,
        reason: 'left',
        message: `You left #${result.channelName}.`,
      });
      io.in(`user:${req.user.id}`).socketsLeave(`channel:${channelId}`);
    }

    await logSecurityEvent({
      eventType: 'channel.member_left',
      category: 'channel',
      severity: 'low',
      outcome: 'success',
      actorType: 'user',
      actorId: req.user.id,
      actorName: req.user?.name || '',
      resource: `/api/channels/${channelId}/leave`,
      ip: extractClientIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
      message: 'User left channel',
      metadata: {
        channelId,
        channelName: result.channelName,
      },
    });

    res.json({
      ok: true,
      channelId,
      channelName: result.channelName,
    });
  } catch (error) {
    next(error);
  }
};

exports.removeMember = async (req, res, next) => {
  try {
    const channelId = requireObjectId(req.params?.channelId, 'channelId');
    const userId = requireObjectId(req.params?.userId, 'userId');
    const removedAt = Date.now();
    const actorName = req.user?.name || 'User';

    const targetUser = await UserModel.findUserById(userId);
    const targetName = targetUser?.name || 'User';
    const targetAvatarURL = targetUser?.avatarURL || '';
    const result = await removeChannelMember({
      channelId,
      actorUserId: req.user.id,
      targetUserId: userId,
    });

    const systemMessage = await saveChannelSystemMessage({
      channelId,
      userId: req.user.id,
      message: `Team Lead ${actorName} removed ${targetName}.`,
      systemEvent: 'member_removed',
      systemMeta: {
        removedUserId: userId,
        removedUserName: targetName,
        removedByUserId: req.user.id,
        removedByName: actorName,
        removedByRole: result.actorRole || 'team_leader',
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`channel:${channelId}`).emit('receiveChannelMessage', systemMessage);
      io.to(`channel:${channelId}`).emit('channelMemberLeft', {
        channelId,
        channelName: result.channelName,
        userId,
        userName: targetName,
        avatarURL: targetAvatarURL,
        reason: 'removed',
        removedByUserId: req.user.id,
        removedByName: actorName,
        removedByRole: result.actorRole || 'team_leader',
        removedAt,
      });
      io.to(`user:${userId}`).emit('channelRemovedForUser', {
        channelId,
        channelName: result.channelName,
        reason: 'removed',
        removedByUserId: req.user.id,
        removedByName: actorName,
        removedByRole: result.actorRole || 'team_leader',
        message: `You were removed from #${result.channelName}.`,
      });
      io.in(`user:${userId}`).socketsLeave(`channel:${channelId}`);
    }

    await createNotification({
      userId,
      type: 'channel_removed',
      category: 'general',
      title: 'Removed from channel',
      message: `You were removed from #${result.channelName}.`,
      link: '/home/tasks?chat=1',
      meta: {
        channelId,
        removedByUserId: req.user.id,
      },
    });

    await logSecurityEvent({
      eventType: 'channel.member_removed',
      category: 'channel',
      severity: 'high',
      outcome: 'success',
      actorType: 'user',
      actorId: req.user.id,
      actorName: req.user?.name || '',
      targetType: 'user',
      targetId: userId,
      resource: `/api/channels/${channelId}/members/${userId}`,
      ip: extractClientIpFromRequest(req),
      userAgent: getUserAgentFromRequest(req),
      message: 'Channel member removed',
      metadata: {
        channelId,
        channelName: result.channelName,
      },
    });

    res.json({
      ok: true,
      channelId,
      channelName: result.channelName,
      removedUserId: userId,
    });
  } catch (error) {
    next(error);
  }
};
