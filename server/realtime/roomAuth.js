const mongoose = require('mongoose');
const Team = require('../models/Team');

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const findUserRoleInTeam = (team, userId) =>
  team.leaderId.toString() === userId
    ? 'team_leader'
    : team.members.find((member) => member.userId.toString() === userId)?.role;

const authorizeTeamRoom = async ({ roomId, userId }) => {
  const teamId = roomId.split(':')[1];
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    return { authorized: false };
  }

  const team = await Team.findById(teamId).lean();
  if (!team) {
    return { authorized: false };
  }

  const role = findUserRoleInTeam(team, userId);
  if (!role) {
    return { authorized: false };
  }

  return { authorized: true, team, role };
};

const authorizeAdminRoom = async ({ roomId, userId }) => {
  const projectId = roomId.split(':')[1];
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    return { authorized: false };
  }

  const projectObjectId = toObjectId(projectId);
  const teams = await Team.find({
    $or: [{ projectId: projectObjectId }, { projectHistory: projectObjectId }],
  }).lean();
  if (!teams.length) {
    return { authorized: false };
  }

  const hasAdminRole = teams.some((team) =>
    team.members.some(
      (member) => member.userId.toString() === userId && member.role === 'admin'
    )
  );

  const isTeamLeader = teams.some((team) => team.leaderId.toString() === userId);

  if (!hasAdminRole && !isTeamLeader) {
    return { authorized: false };
  }

  const role = hasAdminRole ? 'admin' : 'team_leader';

  return { authorized: true, teams, role };
};

const verifyRoomAccess = async ({ roomId, type, userId }) => {
  if (type === 'team' && roomId.startsWith('team:')) {
    return authorizeTeamRoom({ roomId, userId });
  }

  if (type === 'direct' && roomId.startsWith('admin:')) {
    return authorizeAdminRoom({ roomId, userId });
  }

  return { authorized: false };
};

module.exports = {
  verifyRoomAccess,
  findUserRoleInTeam,
};
