const mongoose = require('mongoose');
const TaskAssignment = require('../models/TaskAssignment');
const Team = require('../models/Team');
const Project = require('../models/Project');
const UserModel = require('../models/User');
const Board = require('../models/Board');
const BoardColumn = require('../models/BoardColumn');
const Card = require('../models/Card');
const { findUserRoleInTeam } = require('../realtime/roomAuth');

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const forbidden = (message = 'Yetkisiz') => {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
};

const notFound = (message = 'Kaynak bulunamadı') => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

const getTeamForLeader = async ({ teamId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(teamId)) {
    throw badRequest('Geçersiz team');
  }
  const team = await Team.findById(teamId).lean();
  if (!team) {
    throw notFound('Takım bulunamadı');
  }
  if (team.leaderId.toString() !== userId) {
    throw forbidden('Sadece takım lideri görev ekleyebilir');
  }
  return team;
};

const ensureProjectLinkedToTeam = ({ team, projectId }) => {
  const projectKey = String(projectId);
  const matches =
    team.projectId?.toString() === projectKey ||
    (team.projectHistory || []).some((entry) => entry?.toString() === projectKey);
  if (!matches) {
    throw forbidden('Takım bu projeye bağlı değil');
  }
};

const getOrCreateCompanyBoard = async ({ projectId }) => {
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    throw badRequest('Geçersiz proje');
  }
  const projectObjectId = toObjectId(projectId);
  let board = await Board.findOne({ projectId: projectObjectId, type: 'company' }).lean();
  if (board) return board;

  const project = await Project.findById(projectObjectId).lean();
  if (!project) {
    throw notFound('Proje bulunamadı');
  }

  const created = await Board.create({
    projectId: projectObjectId,
    type: 'company',
    name: project.name,
    icon: 'project',
    iconName: 'icon-Project',
    background: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  board = created.toObject ? created.toObject() : created;
  return board;
};

const mapAssignment = (doc, maps) => ({
  id: doc._id.toString(),
  cardId: doc.cardId || null,
  title: doc.title || '',
  description: doc.description || '',
  priority: doc.priority || 'without',
  deadline: doc.deadline,
  assignedBy: doc.assignedBy.toString(),
  assignedByName: maps.userNameMap[doc.assignedBy.toString()] || '',
  assignedTo: doc.assignedTo.toString(),
  teamId: doc.teamId.toString(),
  teamName: maps.teamNameMap[doc.teamId.toString()] || '',
  projectId: doc.projectId.toString(),
  projectName: maps.projectNameMap[doc.projectId.toString()] || '',
  assignedAt: doc.assignedAt,
  status: doc.status,
});

exports.getMyAssignments = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const assignments = await TaskAssignment.find({ assignedTo: toObjectId(userId) })
      .sort({ assignedAt: -1 })
      .lean();

    const userIds = [...new Set(assignments.map((a) => a.assignedBy.toString()))];
    const teamIds = [...new Set(assignments.map((a) => a.teamId.toString()))];
    const projectIds = [...new Set(assignments.map((a) => a.projectId.toString()))];

    const [users, teams, projects] = await Promise.all([
      userIds.length
        ? UserModel.model.find({ _id: { $in: userIds.map(toObjectId) } }).lean()
        : [],
      teamIds.length ? Team.find({ _id: { $in: teamIds.map(toObjectId) } }).lean() : [],
      projectIds.length ? Project.find({ _id: { $in: projectIds.map(toObjectId) } }).lean() : [],
    ]);

    const userNameMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = user.name || user.email || '';
      return acc;
    }, {});

    const teamNameMap = teams.reduce((acc, team) => {
      acc[team._id.toString()] = team.name || '';
      return acc;
    }, {});

    const projectNameMap = projects.reduce((acc, project) => {
      acc[project._id.toString()] = project.name || '';
      return acc;
    }, {});

    const maps = { userNameMap, teamNameMap, projectNameMap };
    res.json(assignments.map((assignment) => mapAssignment(assignment, maps)));
  } catch (error) {
    next(error);
  }
};

exports.createAssignment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const {
      title,
      description = '',
      priority = 'without',
      deadline = null,
      teamId,
      projectId,
      assignedTo,
    } = req.body || {};

    if (!title || !title.trim()) {
      throw badRequest('Görev başlığı zorunlu');
    }
    if (!teamId || !projectId || !assignedTo) {
      throw badRequest('teamId, projectId ve assignedTo zorunludur');
    }
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      throw badRequest('projectId geçersiz');
    }
    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      throw badRequest('assignedTo geçersiz');
    }

    const team = await getTeamForLeader({ teamId, userId });
    ensureProjectLinkedToTeam({ team, projectId });

    const role = findUserRoleInTeam(team, assignedTo);
    if (!role) {
      throw forbidden('Kullanıcı takımda değil');
    }

    const assignment = await TaskAssignment.create({
      title: title.trim(),
      description,
      priority,
      deadline,
      teamId: toObjectId(teamId),
      projectId: toObjectId(projectId),
      assignedBy: toObjectId(userId),
      assignedTo: toObjectId(assignedTo),
      assignedAt: Date.now(),
      status: 'pending',
    });

    res.status(201).json({
      id: assignment._id.toString(),
      title: assignment.title,
      description: assignment.description,
      priority: assignment.priority,
      deadline: assignment.deadline,
      teamId: assignment.teamId.toString(),
      projectId: assignment.projectId.toString(),
      assignedBy: assignment.assignedBy.toString(),
      assignedTo: assignment.assignedTo.toString(),
      assignedAt: assignment.assignedAt,
      status: assignment.status,
      cardId: assignment.cardId || null,
    });
  } catch (error) {
    next(error);
  }
};

exports.transferAssignment = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const { assignmentId } = req.params;
    const { columnId } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      throw badRequest('assignmentId geçersiz');
    }
    if (!columnId || !mongoose.Types.ObjectId.isValid(columnId)) {
      throw badRequest('columnId geçersiz');
    }

    const assignment = await TaskAssignment.findById(assignmentId).lean();
    if (!assignment) {
      throw notFound('Görev bulunamadı');
    }
    if (assignment.assignedTo.toString() !== userId) {
      throw forbidden('Bu görev size ait değil');
    }
    if (assignment.cardId) {
      throw badRequest('Görev zaten boarda aktarılmış');
    }

    const board = await getOrCreateCompanyBoard({ projectId: assignment.projectId });
    const column = await BoardColumn.findOne({
      _id: toObjectId(columnId),
      boardId: board._id,
    }).lean();
    if (!column) {
      throw notFound('Sütun bulunamadı');
    }

    const timestamp = Date.now();
    const card = await Card.create({
      columnId: column._id,
      title: assignment.title || 'Untitled task',
      description: assignment.description || '',
      priority: assignment.priority || 'without',
      deadline: assignment.deadline ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    await TaskAssignment.updateOne(
      { _id: assignment._id },
      { status: 'in-progress', cardId: card._id.toString() }
    );

    res.json({
      assignmentId: assignment._id.toString(),
      status: 'in-progress',
      card: {
        id: card._id.toString(),
        columnId: card.columnId.toString(),
        title: card.title,
        description: card.description,
        priority: card.priority,
        deadline: card.deadline,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateAssignmentStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { assignmentId } = req.params;
    const { status } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      throw badRequest('assignmentId geçersiz');
    }
    if (!['pending', 'in-progress', 'completed'].includes(status)) {
      throw badRequest('status geçersiz');
    }

    const assignment = await TaskAssignment.findById(assignmentId).lean();
    if (!assignment) {
      throw notFound('Görev bulunamadı');
    }
    if (
      assignment.assignedTo.toString() !== userId &&
      assignment.assignedBy.toString() !== userId
    ) {
      throw forbidden('Yetkisiz');
    }

    await TaskAssignment.updateOne({ _id: assignment._id }, { status });
    res.json({ id: assignment._id.toString(), status });
  } catch (error) {
    next(error);
  }
};
