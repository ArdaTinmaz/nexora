const mongoose = require('mongoose');
const Channel = require('../models/Channel');
const ChannelMessage = require('../models/ChannelMessage');
const ChannelInvite = require('../models/ChannelInvite');
const Team = require('../models/Team');
const AdminUserProfile = require('../models/AdminUserProfile');
const { findUserRoleInTeam } = require('../realtime/roomAuth');

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

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

  return channels.map((channel) => ({
    id: channel._id.toString(),
    name: channel.name,
    teamId: channel.teamId.toString(),
    createdBy: channel.createdBy.toString(),
  }));
};

const createChannel = async ({ name, teamId, createdBy }) => {
  await ensureLeader(teamId, createdBy);

  const channel = await Channel.create({
    name: name.trim(),
    teamId: toObjectId(teamId),
    createdBy: toObjectId(createdBy),
    members: [{ userId: toObjectId(createdBy), role: 'team_leader' }],
    createdAt: Date.now(),
  });

  return {
    id: channel._id.toString(),
    name: channel.name,
    teamId: channel.teamId.toString(),
    createdBy: channel.createdBy.toString(),
  };
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

  return messages.reverse().map((msg) => ({
    id: msg._id.toString(),
    channelId: msg.channelId.toString(),
    senderId: msg.senderId.toString(),
    message: msg.message,
    createdAt: msg.createdAt,
  }));
};

const saveChannelMessage = async ({ channelId, userId, message }) => {
  await ensureChannelMember(channelId, userId);

  const entry = await ChannelMessage.create({
    channelId: toObjectId(channelId),
    senderId: toObjectId(userId),
    message,
    createdAt: Date.now(),
  });

  return {
    id: entry._id.toString(),
    channelId,
    senderId: userId,
    message,
    createdAt: entry.createdAt,
  };
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
  getChannel,
  ensureChannelMember,
  getChannelMessages,
  saveChannelMessage,
  createInvite,
  listInvitesForUser,
  acceptInvite,
  ensureTeamAndRole,
};
