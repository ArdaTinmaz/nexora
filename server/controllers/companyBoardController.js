const mongoose = require('mongoose');
const Board = require('../models/Board');
const BoardColumn = require('../models/BoardColumn');
const Card = require('../models/Card');
const Project = require('../models/Project');
const Team = require('../models/Team');
const { findUserRoleInTeam } = require('../realtime/roomAuth');

const now = () => Date.now();

const notFound = (message = 'Kaynak bulunamadı') => {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
};

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

const toObjectId = (value, message) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw badRequest(message);
  }
  return new mongoose.Types.ObjectId(value);
};

const mapBoard = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  icon: doc.icon,
  iconName: doc.iconName,
  background: doc.background,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapColumn = (doc) => ({
  id: doc._id.toString(),
  boardId: doc.boardId.toString(),
  title: doc.title,
  position: doc.position,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const mapCard = (doc) => ({
  id: doc._id.toString(),
  columnId: doc.columnId.toString(),
  title: doc.title,
  description: doc.description,
  priority: doc.priority,
  deadline: doc.deadline,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const getUserRoleForProject = async ({ projectId, userId }) => {
  const projectObjectId = toObjectId(projectId, 'Geçersiz proje');
  const teams = await Team.find({
    $or: [{ projectId: projectObjectId }, { projectHistory: projectObjectId }],
  }).lean();

  if (!teams.length) {
    throw forbidden('Projeye erişim yok');
  }

  let role = null;
  let teamId = null;
  teams.forEach((team) => {
    const teamRole = findUserRoleInTeam(team, userId);
    if (!teamRole) return;
    if (teamRole === 'team_leader') {
      role = 'team_leader';
      teamId = team._id.toString();
      return;
    }
    if (role === 'team_leader') {
      return;
    }
    if (teamRole === 'admin') {
      role = 'admin';
      teamId = team._id.toString();
      return;
    }
    if (!role) {
      role = teamRole;
      teamId = team._id.toString();
    }
  });

  if (!role) {
    throw forbidden('Projeye erişim yok');
  }

  return { role, teamId, projectObjectId };
};

const getOrCreateCompanyBoard = async ({ projectId }) => {
  const projectObjectId = toObjectId(projectId, 'Geçersiz proje');
  let board = await Board.findOne({ projectId: projectObjectId, type: 'company' }).lean();
  if (board) return board;

  const project = await Project.findById(projectObjectId).lean();
  if (!project) {
    throw notFound('Proje bulunamadı');
  }

  const timestamp = now();
  const created = await Board.create({
    projectId: projectObjectId,
    type: 'company',
    name: project.name,
    icon: 'project',
    iconName: 'icon-Project',
    background: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  board = created.toObject ? created.toObject() : created;
  return board;
};

const ensureBoardAndColumn = async (boardId, columnId) => {
  const column = await BoardColumn.findOne({ _id: columnId, boardId }).lean();
  if (!column) {
    throw notFound('Sütun bulunamadı');
  }
  return column;
};

const loadBoardWithColumns = async (boardId) => {
  const columns = await BoardColumn.find({ boardId })
    .sort({ position: 1, _id: 1 })
    .lean();

  const columnIds = columns.map((column) => column._id);
  const cards = columnIds.length
    ? await Card.find({ columnId: { $in: columnIds } }).sort({ _id: 1 }).lean()
    : [];

  const cardsByColumn = cards.reduce((acc, card) => {
    const key = card.columnId.toString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(mapCard(card));
    return acc;
  }, {});

  const columnsWithCards = columns.map((column) => ({
    ...mapColumn(column),
    cards: cardsByColumn[column._id.toString()] || [],
  }));

  return columnsWithCards;
};

const getCompanyBoard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { projectId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    const board = await getOrCreateCompanyBoard({ projectId });
    const columnsWithCards = await loadBoardWithColumns(board._id);

    res.json({
      ...mapBoard(board),
      columns: columnsWithCards,
      role,
      projectId,
    });
  } catch (error) {
    next(error);
  }
};

const updateBoardSettings = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { projectId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('Bu işlem için yetkiniz yok');
    }

    const { icon, iconName, background } = req.body || {};
    const board = await getOrCreateCompanyBoard({ projectId });

    const updates = {
      updatedAt: now(),
    };
    if (typeof icon !== 'undefined') updates.icon = icon;
    if (typeof iconName !== 'undefined') updates.iconName = iconName;
    if (typeof background !== 'undefined') updates.background = background;

    const updated = await Board.findOneAndUpdate(
      { _id: board._id },
      updates,
      { new: true }
    ).lean();

    res.json(mapBoard(updated));
  } catch (error) {
    next(error);
  }
};

const createColumn = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { projectId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('Bu işlem için yetkiniz yok');
    }

    const { title } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Sütun başlığı zorunludur');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const timestamp = now();
    const column = await BoardColumn.create({
      boardId: board._id,
      title: title.trim(),
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    res.status(201).json({
      ...mapColumn(column),
      cards: [],
    });
  } catch (error) {
    next(error);
  }
};

const updateColumn = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { projectId, columnId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('Bu işlem için yetkiniz yok');
    }

    const { title } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Sütun başlığı zorunludur');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const updatedAt = now();
    const column = await BoardColumn.findOneAndUpdate(
      { _id: toObjectId(columnId, 'Geçersiz sütun'), boardId: board._id },
      { title: title.trim(), updatedAt },
      { new: true }
    ).lean();

    if (!column) {
      throw notFound('Sütun bulunamadı');
    }

    res.json(mapColumn(column));
  } catch (error) {
    next(error);
  }
};

const deleteColumn = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { projectId, columnId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('Bu işlem için yetkiniz yok');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const column = await BoardColumn.findOneAndDelete({
      _id: toObjectId(columnId, 'Geçersiz sütun'),
      boardId: board._id,
    }).lean();
    if (!column) {
      throw notFound('Sütun bulunamadı');
    }

    await Card.deleteMany({ columnId: column._id });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const createCard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { projectId, columnId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('Bu işlem için yetkiniz yok');
    }

    const { title, description = '', priority = 'without', deadline = null } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Kart başlığı zorunludur');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const columnObjectId = toObjectId(columnId, 'Geçersiz sütun');
    await ensureBoardAndColumn(board._id, columnObjectId);

    const timestamp = now();
    const card = await Card.create({
      columnId: columnObjectId,
      title: title.trim(),
      description,
      priority,
      deadline,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    res.status(201).json(mapCard(card));
  } catch (error) {
    next(error);
  }
};

const updateCard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { projectId, columnId, cardId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('Bu işlem için yetkiniz yok');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const columnObjectId = toObjectId(columnId, 'Geçersiz sütun');
    const cardObjectId = toObjectId(cardId, 'Geçersiz kart');
    await ensureBoardAndColumn(board._id, columnObjectId);

    const existing = await Card.findOne({ _id: cardObjectId, columnId: columnObjectId }).lean();
    if (!existing) {
      throw notFound('Kart bulunamadı');
    }

    const { title, description, priority, deadline } = req.body || {};
    const updatedCard = {
      title: title?.trim() || existing.title,
      description: description ?? existing.description,
      priority: priority ?? existing.priority,
      deadline: deadline ?? existing.deadline,
      updatedAt: now(),
    };

    const updated = await Card.findOneAndUpdate(
      { _id: cardObjectId, columnId: columnObjectId },
      updatedCard,
      { new: true }
    ).lean();

    res.json(mapCard(updated));
  } catch (error) {
    next(error);
  }
};

const deleteCard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { projectId, columnId, cardId } = req.params;
    const { role } = await getUserRoleForProject({ projectId, userId });
    if (!['team_leader', 'admin'].includes(role)) {
      throw forbidden('Bu işlem için yetkiniz yok');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const columnObjectId = toObjectId(columnId, 'Geçersiz sütun');
    const cardObjectId = toObjectId(cardId, 'Geçersiz kart');
    await ensureBoardAndColumn(board._id, columnObjectId);

    const result = await Card.findOneAndDelete({ _id: cardObjectId, columnId: columnObjectId }).lean();
    if (!result) {
      throw notFound('Kart bulunamadı');
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const moveCard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { projectId } = req.params;
    await getUserRoleForProject({ projectId, userId });

    const { fromColumnId, toColumnId, cardId } = req.body || {};
    if (!fromColumnId || !toColumnId || !cardId) {
      throw badRequest('fromColumnId, toColumnId ve cardId zorunludur');
    }

    const board = await getOrCreateCompanyBoard({ projectId });
    const fromColumnObjectId = toObjectId(fromColumnId, 'Geçersiz sütun');
    const toColumnObjectId = toObjectId(toColumnId, 'Geçersiz sütun');
    const cardObjectId = toObjectId(cardId, 'Geçersiz kart');

    await ensureBoardAndColumn(board._id, fromColumnObjectId);
    await ensureBoardAndColumn(board._id, toColumnObjectId);

    const existing = await Card.findOne({ _id: cardObjectId, columnId: fromColumnObjectId }).lean();
    if (!existing) {
      throw notFound('Kart bulunamadı');
    }

    const updatedAt = now();
    const updated = await Card.findOneAndUpdate(
      { _id: cardObjectId },
      { columnId: toColumnObjectId, updatedAt },
      { new: true }
    ).lean();

    res.json(mapCard(updated));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompanyBoard,
  updateBoardSettings,
  createColumn,
  updateColumn,
  deleteColumn,
  createCard,
  updateCard,
  deleteCard,
  moveCard,
};
