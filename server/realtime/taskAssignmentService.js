const mongoose = require('mongoose');
const TaskAssignment = require('../models/TaskAssignment');
const Team = require('../models/Team');
const { findUserRoleInTeam } = require('./roomAuth');

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const getTeamWithMember = async (teamId, userId) => {
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    return null;
  }
  const team = await Team.findById(teamId).lean();
  if (!team) return null;

  const role = findUserRoleInTeam(team, userId);
  if (!role) return null;

  return { team, role };
};

const ensureAssignmentPermissions = async ({ teamId, projectId, assignedBy, assignedTo }) => {
  const teamData = await getTeamWithMember(teamId, assignedBy);
  if (!teamData) {
    const error = new Error('assigner not in team');
    error.statusCode = 403;
    throw error;
  }

  const { team, role } = teamData;

  const projectKey = String(projectId);
  const projectMatch =
    team.projectId?.toString() === projectKey ||
    (team.projectHistory || []).some((entry) => entry?.toString() === projectKey);
  if (!projectMatch) {
    const error = new Error('invalid project');
    error.statusCode = 403;
    throw error;
  }

  const targetMember =
    team.leaderId.toString() === assignedTo
      ? { userId: team.leaderId, role: 'team_leader' }
      : team.members.find((member) => member.userId.toString() === assignedTo);

  if (!targetMember) {
    const error = new Error('assignee not in team');
    error.statusCode = 403;
    throw error;
  }

  const allowedRoles = ['admin', 'team_leader', 'product_manager', 'scrum_master', 'developer', 'designer'];
  if (!allowedRoles.includes(role)) {
    const error = new Error('unauthorized role');
    error.statusCode = 403;
    throw error;
  }

  if (role === 'admin') {
    return { team, role, targetMember };
  }

  if (role === 'team_leader') {
    return { team, role, targetMember };
  }

  // developer/designer/product_manager/scrum_master can assign only if same team
  return { team, role, targetMember };
};

const createAssignment = async ({ cardId, teamId, projectId, assignedBy, assignedTo }) => {
  await ensureAssignmentPermissions({ teamId, projectId, assignedBy, assignedTo });

  const assignment = await TaskAssignment.create({
    cardId,
    teamId,
    projectId,
    assignedBy: toObjectId(assignedBy),
    assignedTo: toObjectId(assignedTo),
    assignedAt: Date.now(),
    status: 'pending',
  });

  return {
    id: assignment._id.toString(),
    cardId,
    teamId,
    projectId,
    assignedBy,
    assignedTo,
    assignedAt: assignment.assignedAt,
    status: assignment.status,
  };
};

const updateAssignmentStatus = async ({ assignmentId, status, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
    const error = new Error('invalid assignment');
    error.statusCode = 400;
    throw error;
  }

  const assignment = await TaskAssignment.findById(assignmentId).lean();
  if (!assignment) {
    const error = new Error('not found');
    error.statusCode = 404;
    throw error;
  }

  // Allow assignee or assigner to update
  if (
    assignment.assignedTo.toString() !== userId &&
    assignment.assignedBy.toString() !== userId
  ) {
    const error = new Error('forbidden');
    error.statusCode = 403;
    throw error;
  }

  assignment.status = status;
  await TaskAssignment.updateOne({ _id: assignmentId }, { status });

  return {
    id: assignmentId,
    ...assignment,
    status,
  };
};

module.exports = {
  createAssignment,
  updateAssignmentStatus,
};
