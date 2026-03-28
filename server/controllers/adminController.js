const mongoose = require('mongoose');
const UserModel = require('../models/User');
const Team = require('../models/Team');
const Project = require('../models/Project');
const Board = require('../models/Board');
const BoardColumn = require('../models/BoardColumn');
const Card = require('../models/Card');
const AdminUserProfile = require('../models/AdminUserProfile');
const Channel = require('../models/Channel');
const { createProject } = require('../services/projectService');
const normalizeAvatarUrl = require('../utils/normalizeAvatarUrl');
const { logSecurityEvent } = require('../services/auditLogService');
const { extractClientIpFromRequest, getUserAgentFromRequest } = require('../security/requestMeta');

const toObjectId = (id) => new mongoose.Types.ObjectId(id);
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const normalizeStatus = (status) =>
  String(status || '').toLowerCase() === 'passive' ? 'Passive' : 'Active';

const mapMembers = (members = []) =>
  members
    .filter((m) => m?.userId)
    .map((m) => ({
      userId: m.userId.toString ? m.userId.toString() : String(m.userId),
      role: m.role || 'developer',
    }));

const ensureLeaderMember = (team) => {
  const leaderId = team?.leaderId?.toString ? team.leaderId.toString() : team?.leaderId;
  let members = mapMembers(team?.members || []);
  const seen = new Set();
  members = members.filter((m) => {
    if (!m.userId || seen.has(m.userId)) return false;
    seen.add(m.userId);
    return true;
  });

  if (!leaderId) return members;

  const leaderIndex = members.findIndex((m) => m.userId === leaderId);
  if (leaderIndex === -1) {
    members = [{ userId: leaderId, role: 'team_leader' }, ...members];
  } else if (members[leaderIndex].role !== 'team_leader') {
    members = members.map((m, idx) => (idx === leaderIndex ? { ...m, role: 'team_leader' } : m));
  }

  return members;
};

const membersEqual = (a = [], b = []) =>
  a.length === b.length && a.every((m, idx) => m.userId === b[idx].userId && m.role === b[idx].role);

const collectAssignedUserIds = async (userIds = [], excludeTeamId = null) => {
  const uniqueIds = [...new Set((userIds || []).filter(Boolean).map((id) => String(id)))];
  const validIds = uniqueIds.filter((id) => isValidObjectId(id));
  if (!validIds.length) return new Set();
  const objectIds = validIds.map((id) => toObjectId(id));
  const query = {
    $or: [{ leaderId: { $in: objectIds } }, { 'members.userId': { $in: objectIds } }],
  };
  if (excludeTeamId && isValidObjectId(excludeTeamId)) {
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

const applyNormalizedMembers = async (team) => {
  const normalizedMembers = ensureLeaderMember(team);
  const currentMembers = mapMembers(team?.members || []);
  if (team?._id && !membersEqual(currentMembers, normalizedMembers)) {
    await Team.updateOne(
      { _id: team._id },
      { $set: { members: normalizedMembers.map((m) => ({ userId: toObjectId(m.userId), role: m.role })) } }
    );
  }
  return normalizedMembers;
};

const mapUser = (user, meta) => {
  const safeMeta = meta || {};
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarURL: normalizeAvatarUrl(user.avatarURL),
    theme: user.theme,
    meta: {
      role: safeMeta.role || 'developer',
      languages: safeMeta.languages || [],
      experienceYears: safeMeta.experienceYears || 0,
      skills: safeMeta.skills || [],
      status: safeMeta.status || 'Active',
    },
  };
};

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
    const payload = req.body || {};
    const hasField = (field) => Object.prototype.hasOwnProperty.call(payload, field);
    const existing = await AdminUserProfile.findOne({ userId: toObjectId(userId) }).lean();

    const nextMeta = {
      role: hasField('role') ? payload.role || 'developer' : existing?.role || 'developer',
      languages: hasField('languages')
        ? Array.isArray(payload.languages)
          ? payload.languages
          : []
        : existing?.languages || [],
      experienceYears: hasField('experienceYears')
        ? Number(payload.experienceYears) || 0
        : existing?.experienceYears || 0,
      skills: hasField('skills')
        ? Array.isArray(payload.skills)
          ? payload.skills
          : []
        : existing?.skills || [],
      status: hasField('status') ? normalizeStatus(payload.status) : existing?.status || 'Active',
      updatedAt: Date.now(),
    };

    const updated = await AdminUserProfile.findOneAndUpdate(
      { userId: toObjectId(userId) },
      {
        $set: nextMeta,
        $setOnInsert: { userId: toObjectId(userId), createdAt: Date.now() },
      },
      { upsert: true, new: true }
    ).lean();

    await UserModel.updateUserFields(userId, { role: updated.role || 'developer' });

    const previousRole = existing?.role || 'developer';
    const nextRole = updated.role || 'developer';
    if (previousRole !== nextRole) {
      await logSecurityEvent({
        eventType: 'admin.role_changed',
        category: 'admin',
        severity: 'high',
        outcome: 'success',
        actorType: 'admin',
        actorId: req.admin?.username || 'admin',
        actorName: req.admin?.username || 'admin',
        targetType: 'user',
        targetId: userId,
        resource: `/api/admin/users/${userId}/meta`,
        ip: extractClientIpFromRequest(req),
        userAgent: getUserAgentFromRequest(req),
        message: 'User role updated by admin',
        metadata: {
          previousRole,
          nextRole,
        },
      });
    }

    res.json({
      userId,
      role: updated.role,
      languages: updated.languages,
      experienceYears: updated.experienceYears,
      skills: updated.skills,
      status: updated.status || 'Active',
    });
  } catch (error) {
    next(error);
  }
};

exports.listTeams = async (_req, res, next) => {
  try {
    const teams = await Team.find().lean();
    const normalized = await Promise.all(
      teams.map(async (team) => ({
        team,
        members: await applyNormalizedMembers(team),
      }))
    );

    res.json(
      normalized.map(({ team, members }) => ({
        id: team._id.toString(),
        name: team.name,
        projectId: team.projectId?.toString(),
        projectHistory: team.projectHistory?.map((p) => p.toString()) || [],
        leaderId: team.leaderId?.toString(),
        members,
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

    const requestedUserIds = [
      leaderId,
      ...sanitizedMembers.map((m) => (m.userId?.toString ? m.userId.toString() : String(m.userId))),
    ];
    const assigned = await collectAssignedUserIds(requestedUserIds);
    if (assigned.size) {
      return res.status(400).json({ message: 'User already assigned to another team.' });
    }

    const leaderObject = { userId: toObjectId(leaderId), role: 'team_leader' };
    const mergedMembers = [leaderObject, ...sanitizedMembers].filter(
      (member, index, self) =>
        self.findIndex((m) => m.userId.toString() === member.userId.toString()) === index
    );

    const team = await Team.create({
      name: name.trim(),
      projectId: projectId ? toObjectId(projectId) : null,
      projectHistory: projectId ? [toObjectId(projectId)] : [],
      leaderId: toObjectId(leaderId),
      members: mergedMembers,
      createdAt: Date.now(),
    });

    const normalizedMembers = await applyNormalizedMembers(team);

    res.status(201).json({
      id: team._id.toString(),
      name: team.name,
      projectId: team.projectId ? team.projectId.toString() : null,
      leaderId: team.leaderId.toString(),
      members: normalizedMembers,
      createdAt: team.createdAt,
      projectHistory: team.projectHistory?.map((p) => p.toString()) || [],
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

    const assigned = await collectAssignedUserIds([userId], teamId);
    if (assigned.size) {
      return res.status(400).json({ message: 'User already assigned to another team.' });
    }

    const team = await Team.findOneAndUpdate(
      { _id: teamId, 'members.userId': { $ne: toObjectId(userId) } },
      { $push: { members: { userId: toObjectId(userId), role } } },
      { new: true }
    ).lean();

    if (!team) {
      return res.status(400).json({ message: 'Takım bulunamadı veya üye zaten ekli' });
    }

    const normalizedMembers = await applyNormalizedMembers(team);

    res.json({
      id: team._id.toString(),
      members: normalizedMembers,
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

    const existingTeam = await Team.findById(teamId).lean();
    if (!existingTeam) {
      return res.status(404).json({ message: 'Takım bulunamadı' });
    }
    if (existingTeam.leaderId?.toString() === userId) {
      return res.status(400).json({ message: 'Team leader cannot be removed.' });
    }

    const team = await Team.findOneAndUpdate(
      { _id: teamId },
      { $pull: { members: { userId: toObjectId(userId) } } },
      { new: true }
    ).lean();

    if (!team) {
      return res.status(404).json({ message: 'Takım bulunamadı' });
    }

    const normalizedMembers = await applyNormalizedMembers(team);

    res.json({
      id: team._id.toString(),
      members: normalizedMembers,
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
        ownerId: p.ownerId ? p.ownerId.toString() : null,
        ownerName: p.ownerName || '',
        parentProjectId: p.parentProjectId ? p.parentProjectId.toString() : null,
        status: p.status || 'Active',
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
    const { name, ownerId, ownerName, parentProjectId, endDate, status } = req.body || {};
    if (ownerId && !mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(400).json({ message: 'ownerId geçersiz' });
    }
    const project = await createProject({
      name,
      ownerId: ownerId || null,
      ownerName: ownerName || '',
      parentProjectId,
      endDate,
      status,
    });

    const existingBoard = await Board.findOne({
      projectId: project.id,
      type: 'company',
    }).lean();

    if (!existingBoard) {
      await Board.create({
        projectId: project.id,
        type: 'company',
        name: project.name,
        icon: 'project',
        iconName: 'icon-Project',
        background: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
};

exports.updateProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { name, ownerId, ownerName, endDate, status } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'projectId geçersiz' });
    }
    const updates = {};
    if (name) updates.name = name.trim();
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'ownerId')) {
      if (!ownerId) {
        updates.ownerId = null;
        updates.ownerName = '';
      } else {
        if (!mongoose.Types.ObjectId.isValid(ownerId)) {
          return res.status(400).json({ message: 'ownerId geçersiz' });
        }
        updates.ownerId = ownerId;
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, 'ownerName') &&
      !Object.prototype.hasOwnProperty.call(updates, 'ownerName')
    ) {
      updates.ownerName = ownerName || '';
    }
    if (typeof endDate !== 'undefined') updates.endDate = endDate;
    if (status) updates.status = status;

    const updated = await Project.findByIdAndUpdate(projectId, updates, { new: true }).lean();
    if (!updated) {
      return res.status(404).json({ message: 'Project bulunamadı' });
    }

    if (updates.name) {
      await Board.updateOne(
        { projectId: updated._id, type: 'company' },
        { name: updated.name, updatedAt: Date.now() }
      );
    }

    res.json({
      id: updated._id.toString(),
      name: updated.name,
      ownerId: updated.ownerId?.toString(),
      ownerName: updated.ownerName || '',
      parentProjectId: updated.parentProjectId ? updated.parentProjectId.toString() : null,
      status: updated.status || 'Active',
      endDate: updated.endDate,
      createdAt: updated.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'projectId geçersiz' });
    }
    await Project.deleteOne({ _id: projectId });
    await Team.updateMany(
      { projectHistory: toObjectId(projectId) },
      { $pull: { projectHistory: toObjectId(projectId) } }
    );
    await Team.updateMany({ projectId: toObjectId(projectId) }, { projectId: null });

    const board = await Board.findOne({ projectId: toObjectId(projectId), type: 'company' }).lean();
    if (board) {
      const columns = await BoardColumn.find({ boardId: board._id }).select('_id').lean();
      const columnIds = columns.map((column) => column._id);
      if (columnIds.length) {
        await Card.deleteMany({ columnId: { $in: columnIds } });
        await BoardColumn.deleteMany({ _id: { $in: columnIds } });
      }
      await Board.deleteOne({ _id: board._id });
    }

    res.status(204).end();
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
    const existing = await Team.findById(teamId).lean();
    if (!existing) {
      return res.status(404).json({ message: 'Team bulunamadı' });
    }
    const updates = { $addToSet: { projectHistory: toObjectId(projectId) } };
    if (!existing.projectId) {
      updates.$set = { projectId: toObjectId(projectId) };
    }
    const team = await Team.findByIdAndUpdate(teamId, updates, { new: true }).lean();
    if (!team) {
      return res.status(404).json({ message: 'Team bulunamadı' });
    }
    res.json({
      id: team._id.toString(),
      name: team.name,
      projectId: team.projectId ? team.projectId.toString() : null,
      projectHistory: team.projectHistory?.map((p) => p.toString()) || [],
    });
  } catch (error) {
    next(error);
  }
};

exports.updateTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { name, leaderId } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: 'teamId geçersiz' });
    }
    const updates = {};
    if (name) updates.name = name.trim();
    if (leaderId) updates.leaderId = toObjectId(leaderId);

    if (leaderId) {
      const assigned = await collectAssignedUserIds([leaderId], teamId);
      if (assigned.size) {
        return res.status(400).json({ message: 'User already assigned to another team.' });
      }
    }

    const team = await Team.findByIdAndUpdate(teamId, updates, { new: true }).lean();
    if (!team) {
      return res.status(404).json({ message: 'Team bulunamadı' });
    }

    const normalizedMembers = await applyNormalizedMembers(team);

    res.json({
      id: team._id.toString(),
      name: team.name,
      leaderId: team.leaderId?.toString(),
      projectId: team.projectId ? team.projectId.toString() : null,
      projectHistory: team.projectHistory?.map((p) => p.toString()) || [],
      members: normalizedMembers,
    });
  } catch (error) {
    next(error);
  }
};

exports.removeTeamFromProject = async (req, res, next) => {
  try {
    const { projectId, teamId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: 'projectId veya teamId geçersiz' });
    }
    const team = await Team.findById(teamId).lean();
    if (!team) {
      return res.status(404).json({ message: 'Team bulunamadı' });
    }
    const projectKey = String(projectId);
    const historyIds = (team.projectHistory || []).map((p) => p.toString());
    const inHistory = historyIds.includes(projectKey);
    const isPrimary = team.projectId?.toString() === projectKey;
    if (!inHistory && !isPrimary) {
      return res.status(404).json({ message: 'Team bulunamadı veya bu projede değil' });
    }
    const nextHistory = historyIds.filter((id) => id !== projectKey);
    const updates = {
      projectHistory: nextHistory.map((id) => toObjectId(id)),
    };
    if (isPrimary) {
      updates.projectId = nextHistory.length ? toObjectId(nextHistory[0]) : null;
    }
    const updated = await Team.findByIdAndUpdate(teamId, { $set: updates }, { new: true }).lean();

    res.json({
      id: updated._id.toString(),
      projectId: updated.projectId ? updated.projectId.toString() : null,
      projectHistory: updated.projectHistory?.map((p) => p.toString()) || [],
    });
  } catch (error) {
    next(error);
  }
};
