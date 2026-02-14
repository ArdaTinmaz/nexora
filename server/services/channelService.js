const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const ChannelMessage = require('../models/ChannelMessage');
const ChannelInvite = require('../models/ChannelInvite');
const Team = require('../models/Team');
const AdminUserProfile = require('../models/AdminUserProfile');
const { findUserRoleInTeam } = require('../realtime/roomAuth');

const DELETED_MESSAGE_TEXT = 'This message was deleted.';

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const mapChannelMessage = (msg) => ({
  id: msg._id.toString(),
  channelId: msg.channelId.toString(),
  senderId: msg.senderId.toString(),
  message: msg.message,
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
  await ensureChannelMember(channelId, userId);

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

const createInvite = async ({ channelId, fromUserId, toUserId }) => {
  const channel = await Channel.findById(channelId).lean();
  if (!channel) {
    const error = new Error('Kanal bulunamadı');
    error.statusCode = 404;
    throw error;
  }

  // only team leader can invite
  await ensureLeader(channel.teamId, fromUserId);

  const existing = await ChannelInvite.findOne({
    channelId,
    toUserId,
    status: 'pending',
  }).lean();
  if (existing) {
    return existing;
  }

  const invite = await ChannelInvite.create({
    channelId,
    fromUserId: toObjectId(fromUserId),
    toUserId: toObjectId(toUserId),
    status: 'pending',
    createdAt: Date.now(),
  });

  return invite.toObject();
};

const listInvitesForUser = async (userId) => {
  const invites = await ChannelInvite.find({
    toUserId: toObjectId(userId),
    status: 'pending',
  }).lean();

  return invites.map((invite) => ({
    id: invite._id.toString(),
    channelId: invite.channelId.toString(),
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
  updateChannelMessage,
  deleteChannelMessage,
  pinChannelMessage,
  unpinChannelMessage,
  createInvite,
  listInvitesForUser,
  acceptInvite,
  ensureTeamAndRole,
};
