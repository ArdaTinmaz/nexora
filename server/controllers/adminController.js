const mongoose = require('mongoose');
const UserModel = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const AdminUserProfile = require('../models/AdminUserProfile');
const Channel = require('../models/Channel');
const { createProject } = require('../services/projectService');

const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

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
    if (!name || !leaderId) {
      return res.status(400).json({ message: 'name ve leaderId zorunlu' });
    }
    if (projectId && !isValidObjectId(projectId)) {
      return res.status(400).json({ message: 'projectId geçersiz' });
    }
    if (!isValidObjectId(leaderId)) {
      return res.status(400).json({ message: 'leaderId geçersiz' });
    }
    const sanitizedMembers = Array.isArray(members)
      ? members
          .filter((m) => m?.userId)
          .map((m) => {
            if (!isValidObjectId(m.userId)) {
              throw Object.assign(new Error('member userId geçersiz'), { statusCode: 400 });
            }
            return { userId: toObjectId(m.userId), role: m.role || 'developer' };
          })
      : [];

    const leaderObject = { userId: toObjectId(leaderId), role: 'team_leader' };
    const mergedMembers = [leaderObject, ...sanitizedMembers].filter(
      (member, index, self) =>
        self.findIndex((m) => m.userId.toString() === member.userId.toString()) === index
    );

    const team = await Team.create({
      name: name.trim(),
      projectId: projectId ? toObjectId(projectId) : null,
      leaderId: toObjectId(leaderId),
      members: mergedMembers,
      createdAt: Date.now(),
    });

    res.status(201).json({
      id: team._id.toString(),
      name: team.name,
      projectId: team.projectId ? team.projectId.toString() : null,
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
    if (!isValidObjectId(teamId)) {
      return res.status(400).json({ message: 'teamId geçersiz' });
    }
    if (!isValidObjectId(userId)) {
      return res.status(400).json({ message: 'userId geçersiz' });
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
    if (!isValidObjectId(teamId) || !isValidObjectId(userId)) {
      return res.status(400).json({ message: 'teamId veya userId geçersiz' });
    }
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
    if (!isValidObjectId(teamId)) {
      return res.status(400).json({ message: 'teamId geçersiz' });
    }
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

exports.updateProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, ownerId, endDate } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'projectId geçersiz' });
    }
    const updates = {};
    if (name) updates.name = name.trim();
    if (ownerId) updates.ownerId = ownerId;
    if (typeof endDate !== 'undefined') updates.endDate = endDate;

    const updated = await Project.findByIdAndUpdate(projectId, updates, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ message: 'Project bulunamadı' });
    }
    res.json({
      id: updated._id.toString(),
      name: updated.name,
      ownerId: updated.ownerId?.toString(),
      parentProjectId: updated.parentProjectId ? updated.parentProjectId.toString() : null,
      endDate: updated.endDate,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTeamProject = async (req, res, next) => {
  try {
    const { projectId, teamId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: 'projectId veya teamId geçersiz' });
    }
    const team = await Team.findByIdAndUpdate(teamId, { projectId }, { new: true }).lean();
    if (!team) {
      return res.status(404).json({ message: 'Team bulunamadı' });
    }
    res.json({
      id: team._id.toString(),
      name: team.name,
      projectId: team.projectId.toString(),
    });
  } catch (error) {
    next(error);
  }
};
