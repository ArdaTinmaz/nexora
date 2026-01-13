const mongoose = require('mongoose');
const UserModel = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const AdminUserProfile = require('../models/AdminUserProfile');
const Channel = require('../models/Channel');
const { createProject } = require('../services/projectService');

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const mapUser = (user, meta) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  avatarURL: user.avatarURL || '',
  theme: user.theme,
  meta: meta || {
    role: 'developer',
    languages: [],
    experienceYears: 0,
    skills: [],
  },
});

exports.listUsers = async (_req, res, next) => {
  try {
    const [users, profiles] = await Promise.all([UserModel.find().lean(), AdminUserProfile.find().lean()]);
    const profileMap = profiles.reduce((acc, prof) => {
      acc[prof.userId.toString()] = prof;
      return acc;
    }, {});
    const response = users.map((u) => mapUser(u, profileMap[u._id.toString()]));
    res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.updateUserMeta = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role, languages = [], experienceYears = 0, skills = [] } = req.body || {};

    const updated = await AdminUserProfile.findOneAndUpdate(
      { userId: toObjectId(userId) },
      {
        role: role || 'developer',
        languages,
        experienceYears,
        skills,
        updatedAt: Date.now(),
      },
      { upsert: true, new: true }
    ).lean();

    res.json({
      userId,
      role: updated.role,
      languages: updated.languages,
      experienceYears: updated.experienceYears,
      skills: updated.skills,
    });
  } catch (error) {
    next(error);
  }
};

exports.listTeams = async (_req, res, next) => {
  try {
    const teams = await Team.find().lean();
    res.json(
      teams.map((team) => ({
        id: team._id.toString(),
        name: team.name,
        projectId: team.projectId?.toString(),
        leaderId: team.leaderId?.toString(),
        members: (team.members || []).map((m) => ({
          userId: m.userId.toString(),
          role: m.role,
        })),
        createdAt: team.createdAt,
      }))
    );
  } catch (error) {
    next(error);
  }
};

exports.createTeam = async (req, res, next) => {
  try {
    const { name, projectId, leaderId, members = [] } = req.body || {};
    if (!name || !projectId || !leaderId) {
      return res.status(400).json({ message: 'name, projectId, leaderId zorunlu' });
    }
    const sanitizedMembers = Array.isArray(members)
      ? members
          .filter((m) => m?.userId)
          .map((m) => ({ userId: toObjectId(m.userId), role: m.role || 'developer' }))
      : [];

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

    res.status(201).json({
      id: team._id.toString(),
      name: team.name,
      projectId: team.projectId.toString(),
      leaderId: team.leaderId.toString(),
      members: mergedMembers.map((m) => ({ userId: m.userId.toString(), role: m.role })),
      createdAt: team.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

exports.addMemberToTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { userId, role = 'developer' } = req.body || {};
    if (!userId) {
      return res.status(400).json({ message: 'userId zorunlu' });
    }

    const team = await Team.findOneAndUpdate(
      { _id: teamId, 'members.userId': { $ne: toObjectId(userId) } },
      { $push: { members: { userId: toObjectId(userId), role } } },
      { new: true }
    ).lean();

    if (!team) {
      return res.status(400).json({ message: 'Takım bulunamadı veya üye zaten ekli' });
    }

    res.json({
      id: team._id.toString(),
      members: team.members.map((m) => ({ userId: m.userId.toString(), role: m.role })),
    });
  } catch (error) {
    next(error);
  }
};

exports.removeMemberFromTeam = async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;
    const team = await Team.findOneAndUpdate(
      { _id: teamId },
      { $pull: { members: { userId: toObjectId(userId) } } },
      { new: true }
    ).lean();

    if (!team) {
      return res.status(404).json({ message: 'Takım bulunamadı' });
    }

    res.json({
      id: team._id.toString(),
      members: team.members.map((m) => ({ userId: m.userId.toString(), role: m.role })),
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    await Team.deleteOne({ _id: teamId });
    await Channel.deleteMany({ teamId });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

exports.listProjects = async (_req, res, next) => {
  try {
    const projects = await Project.find().lean();
    res.json(
      projects.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        ownerId: p.ownerId.toString(),
        parentProjectId: p.parentProjectId ? p.parentProjectId.toString() : null,
        createdAt: p.createdAt,
        endDate: p.endDate,
      }))
    );
  } catch (error) {
    next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const { name, parentProjectId, endDate } = req.body || {};
    const project = await createProject({
      name,
      ownerId: req.admin?.username || 'admin',
      parentProjectId,
      endDate,
    });
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};
