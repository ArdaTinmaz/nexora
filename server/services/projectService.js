const mongoose = require('mongoose');
const Project = require('../models/Project');
const Team = require('../models/Team');

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

const createProject = async ({ name, ownerId, parentProjectId = null, endDate = null }) => {
  if (!name || !name.trim()) {
    const error = new Error('Proje adı zorunlu');
    error.statusCode = 400;
    throw error;
  }

  const ownerObjectId = toObjectIdSafe(ownerId) || new mongoose.Types.ObjectId();
  if (parentProjectId && !mongoose.Types.ObjectId.isValid(parentProjectId)) {
    const error = new Error('parentProjectId geçersiz');
    error.statusCode = 400;
    throw error;
  }

  const project = await Project.create({
    name: name.trim(),
    ownerId: ownerObjectId,
    parentProjectId: parentProjectId ? toObjectId(parentProjectId) : null,
    endDate: endDate || null,
    createdAt: Date.now(),
  });

  return {
    id: project._id.toString(),
    name: project.name,
    ownerId: project.ownerId.toString(),
    parentProjectId: project.parentProjectId ? project.parentProjectId.toString() : null,
    endDate: project.endDate,
    createdAt: project.createdAt,
  };
};

const listProjects = async (ownerId) => {
  const projects = await Project.find({ ownerId: toObjectId(ownerId) }).lean();
  return projects.map((project) => ({
    id: project._id.toString(),
    name: project.name,
    ownerId: project.ownerId.toString(),
    parentProjectId: project.parentProjectId ? project.parentProjectId.toString() : null,
    endDate: project.endDate,
    createdAt: project.createdAt,
  }));
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

  // leader ekle
  const leaderObject = { userId: toObjectId(leaderId), role: 'team_leader' };
  const mergedMembers = [leaderObject, ...sanitizedMembers].filter(
    (member, index, self) =>
      self.findIndex((m) => m.userId.toString() === member.userId.toString()) === index
  );

  const team = await Team.create({
    name: name.trim(),
    projectId: toObjectId(projectId),
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
  const teams = await Team.find({ projectId: toObjectId(projectId) }).lean();
  return teams.map((team) => ({
    id: team._id.toString(),
    name: team.name,
    projectId: team.projectId.toString(),
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

  const update = await Team.findOneAndUpdate(
    { _id: teamId, projectId: toObjectId(projectId), 'members.userId': { $ne: toObjectId(userId) } },
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
    projectId: update.projectId.toString(),
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
  createTeamForProject,
  listTeamsByProject,
  addMemberToTeam,
  ensureProjectOwner,
};
