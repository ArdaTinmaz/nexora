const mongoose = require('mongoose');
const Project = require('../models/Project');
const Team = require('../models/Team');
const Board = require('../models/Board');

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const toObjectIdSafe = (id) => (mongoose.Types.ObjectId.isValid(id) ? toObjectId(id) : null);

const assertValidObjectId = (id, fieldName) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    const error = new Error(`${fieldName || 'Id'} geçersiz`);
    error.statusCode = 400;
    throw error;
  }
  return toObjectId(id);
};

const ensureProjectOwner = async (projectId, ownerId) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    const error = new Error('Geçersiz proje');
    error.statusCode = 400;
    throw error;
  }
  if (!mongoose.Types.ObjectId.isValid(ownerId)) {
    const error = new Error('Geçersiz owner');
    error.statusCode = 400;
    throw error;
  }
  const project = await Project.findOne({ _id: projectId, ownerId: toObjectId(ownerId) }).lean();
  if (!project) {
    const error = new Error('Proje bulunamadı veya yetkisiz');
    error.statusCode = 404;
    throw error;
  }
  return project;
};

const collectAssignedUserIds = async (userIds = [], excludeTeamId = null) => {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean).map((id) => String(id)))];
  const validIds = uniqueIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) return new Set();
  const objectIds = validIds.map((id) => toObjectId(id));
  const query = {
    $or: [{ leaderId: { $in: objectIds } }, { 'members.userId': { $in: objectIds } }],
  };
  if (excludeTeamId && mongoose.Types.ObjectId.isValid(excludeTeamId)) {
    query._id = { $ne: toObjectId(excludeTeamId) };
  }
  const teams = await Team.find(query).lean();
  const assigned = new Set();
  teams.forEach((team) => {
    const leaderId = team.leaderId?.toString ? team.leaderId.toString() : String(team.leaderId || '');
    if (validIds.includes(leaderId)) {
      assigned.add(leaderId);
    }
    (team.members || []).forEach((member) => {
      const memberId = member.userId?.toString ? member.userId.toString() : String(member.userId || '');
      if (validIds.includes(memberId)) {
        assigned.add(memberId);
      }
    });
  });
  return assigned;
};

const createProject = async ({
  name,
  ownerId,
  ownerName = '',
  parentProjectId = null,
  endDate = null,
  status = 'Active',
}) => {
  if (!name || !name.trim()) {
    const error = new Error('Proje adı zorunlu');
    error.statusCode = 400;
    throw error;
  }

  const ownerObjectId = toObjectIdSafe(ownerId);
  if (parentProjectId && !mongoose.Types.ObjectId.isValid(parentProjectId)) {
    const error = new Error('parentProjectId geçersiz');
    error.statusCode = 400;
    throw error;
  }

  const project = await Project.create({
    name: name.trim(),
    ownerId: ownerObjectId || null,
    ownerName: ownerName || '',
    parentProjectId: parentProjectId ? toObjectId(parentProjectId) : null,
    status,
    endDate: endDate || null,
    createdAt: Date.now(),
  });

  return {
    id: project._id.toString(),
    name: project.name,
    ownerId: project.ownerId ? project.ownerId.toString() : null,
    ownerName: project.ownerName || '',
    parentProjectId: project.parentProjectId ? project.parentProjectId.toString() : null,
    status: project.status || 'Active',
    endDate: project.endDate,
    createdAt: project.createdAt,
  };
};

const listProjects = async (ownerId) => {
  const projects = await Project.find({ ownerId: toObjectId(ownerId) }).lean();
  return projects.map((project) => ({
    id: project._id.toString(),
    name: project.name,
    ownerId: project.ownerId ? project.ownerId.toString() : null,
    ownerName: project.ownerName || '',
    parentProjectId: project.parentProjectId ? project.parentProjectId.toString() : null,
    status: project.status || 'Active',
    endDate: project.endDate,
    createdAt: project.createdAt,
  }));
};

const listProjectsForUser = async (userId) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    const error = new Error('Geçersiz kullanıcı');
    error.statusCode = 400;
    throw error;
  }

  const userObjectId = toObjectId(userId);
  const teams = await Team.find({
    $or: [{ leaderId: userObjectId }, { 'members.userId': userObjectId }],
  }).lean();

  const rolePriority = {
    team_leader: 5,
    admin: 4,
    product_manager: 3,
    scrum_master: 3,
    developer: 2,
    designer: 2,
  };

  const roleByProject = new Map();

  const projectIds = new Set();
  teams.forEach((team) => {
    const isLeader = team.leaderId?.toString() === userId;
    const memberRole = isLeader
      ? 'team_leader'
      : (team.members || []).find((member) => member.userId.toString() === userId)?.role;

    const updateRole = (projectId) => {
      if (!projectId || !memberRole) return;
      const prev = roleByProject.get(projectId);
      if (!prev || (rolePriority[memberRole] || 0) > (rolePriority[prev] || 0)) {
        roleByProject.set(projectId, memberRole);
      }
    };

    if (team.projectId) {
      const projectKey = team.projectId.toString();
      projectIds.add(projectKey);
      updateRole(projectKey);
    }
    (team.projectHistory || []).forEach((entry) => {
      if (!entry) return;
      const projectKey = entry.toString();
      projectIds.add(projectKey);
      updateRole(projectKey);
    });
  });

  const validIds = [...projectIds].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validIds.length) return [];

  const projects = await Project.find({ _id: { $in: validIds.map(toObjectId) } })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const boards = await Board.find({
    projectId: { $in: validIds.map(toObjectId) },
    type: 'company',
  }).lean();

  const boardByProject = boards.reduce((acc, board) => {
    if (board.projectId) {
      acc[board.projectId.toString()] = board;
    }
    return acc;
  }, {});

  return projects.map((project) => {
    const role = roleByProject.get(project._id.toString()) || '';
    const canEdit = ['team_leader', 'admin'].includes(role);
    return {
    id: project._id.toString(),
    name: project.name,
    ownerId: project.ownerId ? project.ownerId.toString() : null,
    ownerName: project.ownerName || '',
    parentProjectId: project.parentProjectId ? project.parentProjectId.toString() : null,
    status: project.status || 'Active',
    endDate: project.endDate,
    createdAt: project.createdAt,
    role,
    canEdit,
    icon: boardByProject[project._id.toString()]?.icon || 'project',
    iconName: boardByProject[project._id.toString()]?.iconName || 'icon-Project',
    background: boardByProject[project._id.toString()]?.background || '',
    };
  });
};

const createTeamForProject = async ({ projectId, name, leaderId, members = [], ownerId }) => {
  await ensureProjectOwner(projectId, ownerId);

  const sanitizedMembers = Array.isArray(members)
    ? members
        .filter((m) => m?.userId)
        .map((m) => ({
          userId: toObjectId(m.userId),
          role: m.role || 'developer',
        }))
    : [];

  const requestedUserIds = [
    leaderId,
    ...sanitizedMembers.map((m) => (m.userId?.toString ? m.userId.toString() : String(m.userId))),
  ];
  const assigned = await collectAssignedUserIds(requestedUserIds);
  if (assigned.size) {
    const error = new Error('User already assigned to another team.');
    error.statusCode = 400;
    throw error;
  }

  // leader ekle
  const leaderObject = { userId: toObjectId(leaderId), role: 'team_leader' };
  const mergedMembers = [leaderObject, ...sanitizedMembers].filter(
    (member, index, self) =>
      self.findIndex((m) => m.userId.toString() === member.userId.toString()) === index
  );

  const team = await Team.create({
    name: name.trim(),
    projectId: toObjectId(projectId),
    projectHistory: [toObjectId(projectId)],
    leaderId: toObjectId(leaderId),
    members: mergedMembers,
    createdAt: Date.now(),
  });

  return {
    id: team._id.toString(),
    name: team.name,
    projectId: team.projectId.toString(),
    leaderId: team.leaderId.toString(),
    members: team.members.map((m) => ({
      userId: m.userId.toString(),
      role: m.role,
    })),
    createdAt: team.createdAt,
  };
};

const listTeamsByProject = async ({ projectId, ownerId }) => {
  await ensureProjectOwner(projectId, ownerId);
  const projectObjectId = toObjectId(projectId);
  const teams = await Team.find({
    $or: [{ projectId: projectObjectId }, { projectHistory: projectObjectId }],
  }).lean();
  return teams.map((team) => ({
    id: team._id.toString(),
    name: team.name,
    projectId: team.projectId ? team.projectId.toString() : null,
    leaderId: team.leaderId.toString(),
    members: (team.members || []).map((m) => ({
      userId: m.userId.toString(),
      role: m.role,
    })),
    createdAt: team.createdAt,
  }));
};

const addMemberToTeam = async ({ projectId, teamId, ownerId, userId, role = 'developer' }) => {
  await ensureProjectOwner(projectId, ownerId);
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    const error = new Error('Geçersiz takım');
    error.statusCode = 400;
    throw error;
  }

  const assigned = await collectAssignedUserIds([userId], teamId);
  if (assigned.size) {
    const error = new Error('User already assigned to another team.');
    error.statusCode = 400;
    throw error;
  }

  const projectObjectId = toObjectId(projectId);
  const update = await Team.findOneAndUpdate(
    {
      _id: teamId,
      $or: [{ projectId: projectObjectId }, { projectHistory: projectObjectId }],
      'members.userId': { $ne: toObjectId(userId) },
    },
    { $push: { members: { userId: toObjectId(userId), role } } },
    { new: true }
  ).lean();

  if (!update) {
    const error = new Error('Takım bulunamadı veya üye zaten ekli');
    error.statusCode = 400;
    throw error;
  }

  return {
    id: update._id.toString(),
    name: update.name,
    projectId: update.projectId ? update.projectId.toString() : null,
    leaderId: update.leaderId.toString(),
    members: update.members.map((m) => ({
      userId: m.userId.toString(),
      role: m.role,
    })),
    createdAt: update.createdAt,
  };
};

module.exports = {
  createProject,
  listProjects,
  listProjectsForUser,
  createTeamForProject,
  listTeamsByProject,
  addMemberToTeam,
  ensureProjectOwner,
};
