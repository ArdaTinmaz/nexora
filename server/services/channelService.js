const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const ChannelMessage = require('../models/ChannelMessage');
const ChannelInvite = require('../models/ChannelInvite');
const Team = require('../models/Team');
const UserModel = require('../models/User');
const AdminUserProfile = require('../models/AdminUserProfile');
const { findUserRoleInTeam } = require('../realtime/roomAuth');
const { createNotificationsForUsers } = require('./notificationService');

const DELETED_MESSAGE_TEXT = 'This message was deleted.';

const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const normalizeRoleLabel = (role) => (role === 'team_leader' ? 'team lead' : String(role || 'member'));

const mapChannelMessage = (msg) => ({
  id: msg._id.toString(),
  channelId: msg.channelId.toString(),
  senderId: msg.senderId.toString(),
  message: msg.message,
  type: msg.type || 'user',
  systemEvent: msg.systemEvent || '',
  systemMeta: msg.systemMeta || null,
  joinedUserName: msg.systemMeta?.joinedUserName || '',
  joinedUserAvatarURL: msg.systemMeta?.joinedUserAvatarURL || '',
  createdAt: msg.createdAt,
  updatedAt: msg.updatedAt || msg.createdAt,
  isDeleted: Boolean(msg.isDeleted),
  deletedAt: msg.deletedAt || null,
});

const mapChannel = (channel, pinnedMessage = null) => ({
  id: channel._id.toString(),
  name: channel.name,
  teamId: channel.teamId.toString(),
  createdBy: channel.createdBy.toString(),
  members: Array.isArray(channel.members)
    ? channel.members
        .map((member) => {
          const userId = member?.userId ? member.userId.toString() : '';
          if (!userId) return null;
          return {
            userId,
            role: member?.role || '',
          };
        })
        .filter(Boolean)
    : [],
  pinnedMessageId: channel.pinnedMessageId ? channel.pinnedMessageId.toString() : null,
  pinnedBy: channel.pinnedBy ? channel.pinnedBy.toString() : null,
  pinnedAt: channel.pinnedAt || null,
  pinnedMessage: pinnedMessage ? mapChannelMessage(pinnedMessage) : null,
});

const getAdminRole = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) return '';
  const profile = await AdminUserProfile.findOne({ userId: toObjectId(userId) }).lean();
  return String(profile?.role || '').toLowerCase();
};

const parseMentionTokens = (message) => {
  const tokens = new Set();
  const input = String(message || '');
  const regex = /@([a-zA-Z0-9_.-]+)/g;
  let match = regex.exec(input);

  while (match) {
    const token = String(match[1] || '').trim().toLowerCase();
    if (token) tokens.add(token);
    match = regex.exec(input);
  }

  return [...tokens];
};

const ensureTeamAndRole = async (teamId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    const error = new Error('Geçersiz team');
    error.statusCode = 400;
    throw error;
  }
  const team = await Team.findById(teamId).lean();
  if (!team) {
    const error = new Error('Team bulunamadı');
    error.statusCode = 404;
    throw error;
  }
  const role = findUserRoleInTeam(team, userId);
  return { team, role };
};

const ensureLeader = async (teamId, userId) => {
  const { team, role } = await ensureTeamAndRole(teamId, userId);
  if (role === 'team_leader') {
    return { team, role };
  }
  const adminRole = await getAdminRole(userId);
  if (adminRole === 'team_leader') {
    return { team, role: 'team_leader' };
  }
  const error = new Error('Yetkisiz');
  error.statusCode = 403;
  throw error;
};

const listTeamsForUser = async (userId) => {
  const adminRole = await getAdminRole(userId);
  const overrideRole = adminRole === 'team_leader' ? 'team_leader' : '';
  const teams = await Team.find({
    $or: [{ leaderId: toObjectId(userId) }, { 'members.userId': toObjectId(userId) }],
  }).lean();

  return teams.map((team) => ({
    id: team._id.toString(),
    name: team.name,
    projectId: team.projectId?.toString(),
    projectHistory: (team.projectHistory || []).map((entry) => entry.toString()),
    role: overrideRole || findUserRoleInTeam(team, userId),
  }));
};

const listChannelsForUser = async (userId) => {
  const channels = await Channel.find({
    'members.userId': toObjectId(userId),
  }).lean();

  const pinnedIds = channels
    .map((channel) => channel.pinnedMessageId?.toString())
    .filter(Boolean);

  const pinnedMessages = pinnedIds.length
    ? await ChannelMessage.find({
        _id: { $in: pinnedIds.map((id) => toObjectId(id)) },
      }).lean()
    : [];

  const pinnedMap = new Map(pinnedMessages.map((msg) => [msg._id.toString(), msg]));

  return channels.map((channel) => {
    const pinnedMessage = channel.pinnedMessageId
      ? pinnedMap.get(channel.pinnedMessageId.toString()) || null
      : null;
    return mapChannel(channel, pinnedMessage);
  });
};

const createChannel = async ({ name, teamId, createdBy }) => {
  await ensureLeader(teamId, createdBy);

  const channel = await Channel.create({
    name: name.trim(),
    teamId: toObjectId(teamId),
    createdBy: toObjectId(createdBy),
    members: [{ userId: toObjectId(createdBy), role: 'team_leader' }],
    pinnedMessageId: null,
    pinnedBy: null,
    pinnedAt: null,
    createdAt: Date.now(),
  });

  return mapChannel(channel);
};

const updateChannel = async ({ channelId, name, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    const error = new Error('Geçersiz kanal');
    error.statusCode = 400;
    throw error;
  }

  const existing = await Channel.findById(channelId).lean();
  if (!existing) {
    const error = new Error('Kanal bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  await ensureLeader(existing.teamId, userId);

  const updated = await Channel.findByIdAndUpdate(
    channelId,
    { name: name.trim() },
    { new: true, runValidators: true }
  ).lean();
  const pinnedMessage = updated?.pinnedMessageId
    ? await ChannelMessage.findById(updated.pinnedMessageId).lean()
    : null;

  return mapChannel(updated, pinnedMessage);
};

const deleteChannel = async ({ channelId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    const error = new Error('Geçersiz kanal');
    error.statusCode = 400;
    throw error;
  }

  const existing = await Channel.findById(channelId).lean();
  if (!existing) {
    const error = new Error('Kanal bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  await ensureLeader(existing.teamId, userId);

  await Promise.all([
    Channel.deleteOne({ _id: toObjectId(channelId) }),
    ChannelMessage.deleteMany({ channelId: toObjectId(channelId) }),
    ChannelInvite.deleteMany({ channelId: toObjectId(channelId) }),
  ]);

  return mapChannel(existing);
};

const getChannel = async (channelId) => Channel.findById(channelId).lean();

const ensureChannelMember = async (channelId, userId) => {
  const channel = await Channel.findOne({
    _id: channelId,
    'members.userId': toObjectId(userId),
  }).lean();

  if (!channel) {
    const error = new Error('Kanal erişimi yok');
    error.statusCode = 403;
    throw error;
  }
  return channel;
};

const getChannelMessages = async (channelId, limit = 50) => {
  const messages = await ChannelMessage.find({ channelId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return messages.reverse().map(mapChannelMessage);
};

const saveChannelMessage = async ({ channelId, userId, message }) => {
  const channel = await ensureChannelMember(channelId, userId);

  const now = Date.now();
  const entry = await ChannelMessage.create({
    channelId: toObjectId(channelId),
    senderId: toObjectId(userId),
    message,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
    deletedAt: null,
  });

  const mappedEntry = mapChannelMessage(entry);
  const memberUserIds = [
    ...new Set((channel?.members || []).map((member) => member.userId?.toString()).filter(Boolean)),
  ];

  const recipients = memberUserIds.filter((memberId) => memberId !== userId);
  if (recipients.length) {
    const sender = await UserModel.model.findById(toObjectId(userId)).lean();
    const senderName = sender?.name || sender?.email || 'A teammate';
    const preview = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 140);

    await createNotificationsForUsers(recipients, {
      type: 'channel_message',
      category: 'message',
      title: `New message in #${channel.name}`,
      message: preview ? `${senderName}: ${preview}` : `${senderName} sent a message.`,
      link: `/home/tasks?chat=1&channelId=${channelId.toString()}`,
      meta: {
        channelId: channelId.toString(),
        messageId: mappedEntry.id,
        senderId: userId,
      },
    });
  }

  const mentionTokens = parseMentionTokens(message);
  if (mentionTokens.length && memberUserIds.length) {
    const users = await UserModel.model
      .find({ _id: { $in: memberUserIds.map((id) => toObjectId(id)) } })
      .lean();

    const tokenToUserId = new Map();
    users.forEach((user) => {
      const token = String(user?.name || '')
        .trim()
        .split(/\s+/)[0]
        ?.toLowerCase();
      if (!token || tokenToUserId.has(token)) return;
      tokenToUserId.set(token, user._id.toString());
    });

    const mentionRecipients = [
      ...new Set(
        mentionTokens
          .map((token) => tokenToUserId.get(token))
          .filter(Boolean)
          .filter((memberId) => memberId !== userId)
      ),
    ];

    if (mentionRecipients.length) {
      await createNotificationsForUsers(mentionRecipients, {
        type: 'channel_mention',
        category: 'general',
        title: 'You were mentioned',
        message: `You were mentioned in #${channel.name}.`,
        link: `/home/tasks?chat=1&channelId=${channelId.toString()}`,
        meta: {
          channelId: channelId.toString(),
          messageId: mappedEntry.id,
          senderId: userId,
        },
        dedupKey: `mention:${mappedEntry.id}`,
      });
    }
  }

  return mappedEntry;
};

const saveChannelSystemMessage = async ({
  channelId,
  userId,
  message,
  systemEvent = '',
  systemMeta = null,
  skipMembershipCheck = false,
}) => {
  if (!skipMembershipCheck) {
    await ensureChannelMember(channelId, userId);
  }

  const now = Date.now();
  const normalizedMessage = String(message || '').trim() || 'A teammate joined the channel.';
  const entry = await ChannelMessage.create({
    channelId: toObjectId(channelId),
    senderId: toObjectId(userId),
    message: normalizedMessage,
    type: 'system',
    systemEvent: String(systemEvent || ''),
    systemMeta: systemMeta && typeof systemMeta === 'object' ? systemMeta : null,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
    deletedAt: null,
  });

  return mapChannelMessage(entry);
};

const updateChannelMessage = async ({ channelId, messageId, userId, message }) => {
  await ensureChannelMember(channelId, userId);

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    const error = new Error('Geçersiz mesaj');
    error.statusCode = 400;
    throw error;
  }

  const entry = await ChannelMessage.findOne({
    _id: toObjectId(messageId),
    channelId: toObjectId(channelId),
  });

  if (!entry) {
    const error = new Error('Mesaj bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  if (entry.senderId.toString() !== userId) {
    const error = new Error('Bu mesajı düzenleyemezsiniz');
    error.statusCode = 403;
    throw error;
  }

  if (entry.type === 'system') {
    const error = new Error('Sistem mesajları düzenlenemez');
    error.statusCode = 400;
    throw error;
  }

  if (entry.isDeleted) {
    const error = new Error('Silinmiş mesaj düzenlenemez');
    error.statusCode = 400;
    throw error;
  }

  entry.message = message.trim();
  entry.updatedAt = Date.now();
  await entry.save();

  return mapChannelMessage(entry);
};

const deleteChannelMessage = async ({ channelId, messageId, userId }) => {
  await ensureChannelMember(channelId, userId);

  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    const error = new Error('Geçersiz mesaj');
    error.statusCode = 400;
    throw error;
  }

  const entry = await ChannelMessage.findOne({
    _id: toObjectId(messageId),
    channelId: toObjectId(channelId),
  });

  if (!entry) {
    const error = new Error('Mesaj bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  if (entry.senderId.toString() !== userId) {
    const error = new Error('Bu mesajı silemezsiniz');
    error.statusCode = 403;
    throw error;
  }

  if (entry.type === 'system') {
    const error = new Error('Sistem mesajları silinemez');
    error.statusCode = 400;
    throw error;
  }

  if (!entry.isDeleted) {
    const now = Date.now();
    entry.message = DELETED_MESSAGE_TEXT;
    entry.isDeleted = true;
    entry.deletedAt = now;
    entry.updatedAt = now;
    await entry.save();
  }

  return mapChannelMessage(entry);
};

const pinChannelMessage = async ({ channelId, messageId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(channelId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    const error = new Error('Geçersiz kanal veya mesaj');
    error.statusCode = 400;
    throw error;
  }

  const channel = await Channel.findById(channelId).lean();
  if (!channel) {
    const error = new Error('Kanal bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  await ensureLeader(channel.teamId, userId);

  const message = await ChannelMessage.findOne({
    _id: toObjectId(messageId),
    channelId: toObjectId(channelId),
  }).lean();

  if (!message) {
    const error = new Error('Mesaj bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  if (message.type === 'system') {
    const error = new Error('Sistem mesajları sabitlenemez');
    error.statusCode = 400;
    throw error;
  }

  const now = Date.now();
  const updated = await Channel.findByIdAndUpdate(
    channelId,
    {
      pinnedMessageId: toObjectId(messageId),
      pinnedBy: toObjectId(userId),
      pinnedAt: now,
    },
    { new: true }
  ).lean();

  return mapChannel(updated, message);
};

const unpinChannelMessage = async ({ channelId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    const error = new Error('Geçersiz kanal');
    error.statusCode = 400;
    throw error;
  }

  const channel = await Channel.findById(channelId).lean();
  if (!channel) {
    const error = new Error('Kanal bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  await ensureLeader(channel.teamId, userId);

  const updated = await Channel.findByIdAndUpdate(
    channelId,
    {
      pinnedMessageId: null,
      pinnedBy: null,
      pinnedAt: null,
    },
    { new: true }
  ).lean();

  return mapChannel(updated);
};

const addMemberToChannel = async ({ channelId, userId, role }) => {
  const channel = await Channel.findOneAndUpdate(
    { _id: channelId, 'members.userId': { $ne: toObjectId(userId) } },
    { $push: { members: { userId: toObjectId(userId), role } } },
    { new: true }
  ).lean();

  return channel;
};

const removeMemberFromChannel = async ({ channelId, userId }) => {
  const channel = await Channel.findOneAndUpdate(
    { _id: channelId, 'members.userId': toObjectId(userId) },
    { $pull: { members: { userId: toObjectId(userId) } } },
    { new: true }
  ).lean();

  return channel;
};

const createInvite = async ({ channelId, fromUserId, toUserId }) => {
  const channel = await Channel.findById(channelId).lean();
  if (!channel) {
    const error = new Error('Kanal bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  // only team leader can invite
  await ensureLeader(channel.teamId, fromUserId);

  const alreadyMember = (channel.members || []).some(
    (member) => member?.userId?.toString() === String(toUserId)
  );
  if (alreadyMember) {
    const error = new Error('User is already in the channel.');
    error.statusCode = 400;
    throw error;
  }

  const existing = await ChannelInvite.findOne({
    channelId,
    toUserId,
    status: 'pending',
  }).lean();
  if (existing) {
    return {
      ...existing,
      channelName: channel.name,
    };
  }

  const invite = await ChannelInvite.create({
    channelId,
    fromUserId: toObjectId(fromUserId),
    toUserId: toObjectId(toUserId),
    status: 'pending',
    createdAt: Date.now(),
  });

  return {
    ...invite.toObject(),
    channelName: channel.name,
  };
};

const listInvitesForUser = async (userId) => {
  const invites = await ChannelInvite.find({
    toUserId: toObjectId(userId),
    status: 'pending',
  }).lean();

  const channelIds = [...new Set(invites.map((invite) => invite.channelId?.toString()).filter(Boolean))];
  const channels = channelIds.length
    ? await Channel.find({ _id: { $in: channelIds.map((id) => toObjectId(id)) } })
        .select('name')
        .lean()
    : [];
  const channelNameById = new Map(
    channels.map((channel) => [channel._id.toString(), channel.name || channel._id.toString()])
  );

  return invites.map((invite) => ({
    id: invite._id.toString(),
    channelId: invite.channelId.toString(),
    channelName: channelNameById.get(invite.channelId.toString()) || invite.channelId.toString(),
    fromUserId: invite.fromUserId.toString(),
    toUserId: invite.toUserId.toString(),
    status: invite.status,
    createdAt: invite.createdAt,
  }));
};

const acceptInvite = async ({ channelId, userId }) => {
  const invite = await ChannelInvite.findOneAndUpdate(
    { channelId, toUserId: toObjectId(userId), status: 'pending' },
    { status: 'accepted' },
    { new: true }
  ).lean();

  if (!invite) {
    const error = new Error('Geçersiz davet');
    error.statusCode = 400;
    throw error;
  }

  const channel = await Channel.findById(channelId).lean();
  if (!channel) {
    const error = new Error('Kanal bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  const { team, role } = await ensureTeamAndRole(channel.teamId, userId);
  if (!role) {
    const error = new Error('Takım üyesi değilsiniz');
    error.statusCode = 403;
    throw error;
  }

  await addMemberToChannel({ channelId, userId, role });

  return {
    invite,
    channel: {
      id: channel._id.toString(),
      name: channel.name,
      teamId: team._id.toString(),
    },
  };
};

const leaveChannel = async ({ channelId, userId }) => {
  const channel = await ensureChannelMember(channelId, userId);
  const member = (channel.members || []).find((entry) => entry?.userId?.toString() === String(userId));

  const updated = await removeMemberFromChannel({ channelId, userId });
  if (!updated) {
    const error = new Error('Kanal üyeliği güncellenemedi');
    error.statusCode = 400;
    throw error;
  }

  return {
    channel: mapChannel(updated),
    channelName: updated.name || channel.name || '',
    teamId: updated.teamId?.toString() || channel.teamId?.toString() || '',
    userRole: member?.role || '',
  };
};

const removeChannelMember = async ({ channelId, actorUserId, targetUserId }) => {
  if (String(actorUserId) === String(targetUserId)) {
    const error = new Error('Use leave action to leave the channel.');
    error.statusCode = 400;
    throw error;
  }

  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    const error = new Error('Geçersiz kanal');
    error.statusCode = 400;
    throw error;
  }

  const channel = await Channel.findById(channelId).lean();
  if (!channel) {
    const error = new Error('Kanal bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  const actorMember = (channel.members || []).find(
    (entry) => entry?.userId?.toString() === String(actorUserId)
  );
  if (!actorMember) {
    const error = new Error('Kanal erişimi yok');
    error.statusCode = 403;
    throw error;
  }

  await ensureLeader(channel.teamId, actorUserId);

  const targetMember = (channel.members || []).find(
    (entry) => entry?.userId?.toString() === String(targetUserId)
  );
  if (!targetMember) {
    const error = new Error('User is not in channel.');
    error.statusCode = 404;
    throw error;
  }

  const updated = await removeMemberFromChannel({ channelId, userId: targetUserId });
  if (!updated) {
    const error = new Error('Kanal üyeliği güncellenemedi');
    error.statusCode = 400;
    throw error;
  }

  return {
    channel: mapChannel(updated),
    channelName: updated.name || channel.name || '',
    teamId: updated.teamId?.toString() || channel.teamId?.toString() || '',
    actorRole: actorMember.role || '',
    actorRoleLabel: normalizeRoleLabel(actorMember.role),
    targetRole: targetMember.role || '',
  };
};

module.exports = {
  listTeamsForUser,
  listChannelsForUser,
  createChannel,
  updateChannel,
  deleteChannel,
  getChannel,
  ensureChannelMember,
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
  leaveChannel,
  removeChannelMember,
  ensureTeamAndRole,
};
