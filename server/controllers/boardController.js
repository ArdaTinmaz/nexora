const mongoose = require('mongoose');
const Board = require('../models/Board');
const BoardColumn = require('../models/BoardColumn');
const Card = require('../models/Card');

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
  position: Number.isFinite(doc.position) ? doc.position : 0,
  deadline: doc.deadline,
  completed: Boolean(doc.completed),
  completedAt: doc.completedAt ?? null,
  ownerId: doc.ownerId ? doc.ownerId.toString() : null,
  ownerName: doc.ownerName || '',
  ownerAvatarURL: doc.ownerAvatarURL || '',
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const normalizeDeadlineInput = (value, fallback = null) => {
  if (typeof value === 'undefined') return fallback;
  if (value === null || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw badRequest('deadline geçersiz');
    }
    return parsed.toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const parsed = new Date(Number(trimmed));
      if (Number.isNaN(parsed.getTime())) {
        throw badRequest('deadline geçersiz');
      }
      return parsed.toISOString().slice(0, 10);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  throw badRequest('deadline geçersiz');
};

const clampIndex = (value, min, max) => Math.min(Math.max(value, min), max);

const personalBoardQuery = (boardId, userId) => ({
  _id: boardId,
  userId,
  $or: [{ type: 'personal' }, { type: { $exists: false } }],
});

const ensureBoardForUser = async (boardId, userId) => {
  const board = await Board.findOne(personalBoardQuery(boardId, userId)).lean();

  if (!board) {
    throw notFound('Board bulunamadı');
  }

  return board;
};

const ensureBoardAndColumn = async (boardId, columnId, userId) => {
  await ensureBoardForUser(boardId, userId);
  const column = await BoardColumn.findOne({ _id: columnId, boardId }).lean();
  if (!column) {
    throw notFound('Sütun bulunamadı');
  }
  return column;
};

const getBoards = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    const boards = await Board.find({
      userId: userObjectId,
      $or: [{ type: 'personal' }, { type: { $exists: false } }],
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(boards.map(mapBoard));
  } catch (error) {
    next(error);
  }
};

const createBoard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const { name, icon = 'project', iconName = 'icon-Project', background = '' } = req.body || {};
    if (!name || !name.trim()) {
      throw badRequest('Board adı zorunludur');
    }

    const timestamp = now();
    const board = await Board.create({
      userId: toObjectId(userId, 'Geçersiz kullanıcı'),
      type: 'personal',
      name: name.trim(),
      icon,
      iconName,
      background,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    res.status(201).json(mapBoard(board));
  } catch (error) {
    next(error);
  }
};

const getBoard = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    const boardRow = await ensureBoardForUser(boardId, userObjectId);

    const columns = await BoardColumn.find({ boardId })
      .sort({ position: 1, _id: 1 })
      .lean();

    const columnIds = columns.map((column) => column._id);
    const cards = columnIds.length
      ? await Card.find({ columnId: { $in: columnIds } }).sort({ position: 1, _id: 1 }).lean()
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

    res.json({
      ...mapBoard(boardRow),
      columns: columnsWithCards,
    });
  } catch (error) {
    next(error);
  }
};

const updateBoard = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { name, icon, iconName, background } = req.body || {};
    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');

    const existing = await ensureBoardForUser(boardId, userObjectId);

    const nextBoard = {
      name: name?.trim() || existing.name,
      icon: icon ?? existing.icon,
      iconName: iconName ?? existing.iconName,
      background: background ?? existing.background,
      updatedAt: now(),
    };

    const updated = await Board.findOneAndUpdate(
      personalBoardQuery(boardId, userObjectId),
      nextBoard,
      { new: true }
    ).lean();

    if (!updated) {
      throw notFound('Board bulunamadı');
    }

    res.json({
      ...mapBoard(updated),
    });
  } catch (error) {
    next(error);
  }
};

const deleteBoard = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    const board = await Board.findOneAndDelete(personalBoardQuery(boardId, userObjectId)).lean();
    if (!board) {
      throw notFound('Board bulunamadı');
    }

    const columns = await BoardColumn.find({ boardId }).select('_id').lean();
    const columnIds = columns.map((column) => column._id);
    if (columnIds.length) {
      await Card.deleteMany({ columnId: { $in: columnIds } });
      await BoardColumn.deleteMany({ _id: { $in: columnIds } });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const updateBoardBackground = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { background = '' } = req.body || {};
    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');

    const updatedAt = now();
    const updated = await Board.findOneAndUpdate(
      personalBoardQuery(boardId, userObjectId),
      { background, updatedAt },
      { new: true }
    ).lean();

    if (!updated) {
      throw notFound('Board bulunamadı');
    }

    res.json(mapBoard(updated));
  } catch (error) {
    next(error);
  }
};

const createColumn = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { title } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Sütun başlığı zorunludur');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    await ensureBoardForUser(boardId, userObjectId);

    const latestColumn = await BoardColumn.findOne({ boardId })
      .sort({ position: -1, _id: -1 })
      .lean();
    const nextPosition = Number.isFinite(latestColumn?.position) ? latestColumn.position + 1 : 0;

    const timestamp = now();
    const column = await BoardColumn.create({
      boardId,
      title: title.trim(),
      position: nextPosition,
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
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const columnId = toObjectId(req.params.columnId, 'Geçersiz sütun');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { title } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Sütun başlığı zorunludur');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    await ensureBoardForUser(boardId, userObjectId);

    const updatedAt = now();
    const column = await BoardColumn.findOneAndUpdate(
      { _id: columnId, boardId },
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

const reorderColumns = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const { columnIds } = req.body || {};
    if (!Array.isArray(columnIds) || !columnIds.length) {
      throw badRequest('columnIds zorunludur');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    await ensureBoardForUser(boardId, userObjectId);

    const existingColumns = await BoardColumn.find({ boardId }).lean();
    if (existingColumns.length !== columnIds.length) {
      throw badRequest('Sütun listesi geçersiz');
    }

    const existingSet = new Set(existingColumns.map((column) => column._id.toString()));
    const providedSet = new Set(columnIds);
    if (
      providedSet.size !== columnIds.length ||
      existingSet.size !== providedSet.size ||
      [...providedSet].some((id) => !existingSet.has(id))
    ) {
      throw badRequest('Sütun listesi geçersiz');
    }

    await BoardColumn.bulkWrite(
      columnIds.map((id, index) => ({
        updateOne: {
          filter: { _id: toObjectId(id, 'Geçersiz sütun'), boardId },
          update: { position: index, updatedAt: now() },
        },
      }))
    );

    const updated = await BoardColumn.find({ boardId })
      .sort({ position: 1, _id: 1 })
      .lean();

    res.json({ columns: updated.map(mapColumn) });
  } catch (error) {
    next(error);
  }
};

const deleteColumn = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const columnId = toObjectId(req.params.columnId, 'Geçersiz sütun');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    await ensureBoardForUser(boardId, userObjectId);

    const column = await BoardColumn.findOneAndDelete({ _id: columnId, boardId }).lean();
    if (!column) {
      throw notFound('Sütun bulunamadı');
    }

    await Card.deleteMany({ columnId });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const createCard = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const columnId = toObjectId(req.params.columnId, 'Geçersiz sütun');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { title, description = '', priority = 'without', deadline = null } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Kart başlığı zorunludur');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    await ensureBoardAndColumn(boardId, columnId, userObjectId);

    const latestCard = await Card.findOne({ columnId })
      .sort({ position: -1, _id: -1 })
      .lean();
    const nextPosition = Number.isFinite(latestCard?.position) ? latestCard.position + 1 : 0;

    const timestamp = now();
    const card = await Card.create({
      columnId,
      title: title.trim(),
      description,
      priority,
      position: nextPosition,
      deadline: normalizeDeadlineInput(deadline, null),
      completed: false,
      completedAt: null,
      ownerId: userObjectId,
      ownerName: req.user?.name || req.user?.email || '',
      ownerAvatarURL: req.user?.avatarURL || '',
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
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const columnId = toObjectId(req.params.columnId, 'Geçersiz sütun');
    const cardId = toObjectId(req.params.cardId, 'Geçersiz kart');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { title, description, priority, deadline, completed } = req.body || {};

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    await ensureBoardAndColumn(boardId, columnId, userObjectId);

    const existing = await Card.findOne({ _id: cardId, columnId }).lean();
    if (!existing) {
      throw notFound('Kart bulunamadı');
    }

    const updatedCard = {
      title: title?.trim() || existing.title,
      description: description ?? existing.description,
      priority: priority ?? existing.priority,
      deadline: normalizeDeadlineInput(deadline, existing.deadline),
      completed: typeof completed === 'boolean' ? completed : Boolean(existing.completed),
      completedAt:
        typeof completed === 'boolean'
          ? (completed ? now() : null)
          : (existing.completedAt ?? null),
      updatedAt: now(),
    };

    const updated = await Card.findOneAndUpdate(
      { _id: cardId, columnId },
      updatedCard,
      { new: true }
    ).lean();

    res.json(mapCard(updated));
  } catch (error) {
    next(error);
  }
};

const setCardCompletion = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const columnId = toObjectId(req.params.columnId, 'Geçersiz sütun');
    const cardId = toObjectId(req.params.cardId, 'Geçersiz kart');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const { completed } = req.body || {};
    if (typeof completed !== 'boolean') {
      throw badRequest('completed zorunludur');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    await ensureBoardAndColumn(boardId, columnId, userObjectId);

    const updated = await Card.findOneAndUpdate(
      { _id: cardId, columnId },
      { completed, completedAt: completed ? now() : null, updatedAt: now() },
      { new: true }
    ).lean();

    if (!updated) {
      throw notFound('Kart bulunamadı');
    }

    res.json(mapCard(updated));
  } catch (error) {
    next(error);
  }
};

const deleteCard = async (req, res, next) => {
  try {
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const columnId = toObjectId(req.params.columnId, 'Geçersiz sütun');
    const cardId = toObjectId(req.params.cardId, 'Geçersiz kart');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }

    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');
    await ensureBoardAndColumn(boardId, columnId, userObjectId);

    const result = await Card.findOneAndDelete({ _id: cardId, columnId }).lean();
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
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { fromColumnId, toColumnId, cardId, toIndex } = req.body || {};
    if (!fromColumnId || !toColumnId || !cardId) {
      throw badRequest('fromColumnId, toColumnId ve cardId zorunludur');
    }
    if (typeof toIndex !== 'undefined' && (!Number.isInteger(toIndex) || toIndex < 0)) {
      throw badRequest('toIndex geçersiz');
    }

    const fromColumnObjectId = toObjectId(fromColumnId, 'Geçersiz sütun');
    const toColumnObjectId = toObjectId(toColumnId, 'Geçersiz sütun');
    const cardObjectId = toObjectId(cardId, 'Geçersiz kart');
    const userObjectId = toObjectId(userId, 'Geçersiz kullanıcı');

    await ensureBoardAndColumn(boardId, fromColumnObjectId, userObjectId);
    await ensureBoardAndColumn(boardId, toColumnObjectId, userObjectId);

    const existing = await Card.findOne({ _id: cardObjectId, columnId: fromColumnObjectId }).lean();
    if (!existing) {
      throw notFound('Kart bulunamadı');
    }

    const timestamp = now();
    const sourceCards = await Card.find({ columnId: fromColumnObjectId })
      .sort({ position: 1, _id: 1 })
      .lean();

    const fromIndex = sourceCards.findIndex((card) => card._id.toString() === cardId);
    if (fromIndex === -1) {
      throw notFound('Kart bulunamadı');
    }

    const movingCard = sourceCards[fromIndex];

    if (fromColumnId === toColumnId) {
      const list = [...sourceCards];
      list.splice(fromIndex, 1);
      const insertionIndex = clampIndex(
        typeof toIndex === 'number' ? toIndex : list.length,
        0,
        list.length
      );
      list.splice(insertionIndex, 0, movingCard);

      const updates = list.map((card, index) => ({
        updateOne: {
          filter: { _id: card._id },
          update: { position: index, updatedAt: timestamp },
        },
      }));

      if (updates.length) {
        await Card.bulkWrite(updates);
      }

      const updated = await Card.findById(cardObjectId).lean();
      res.json(mapCard(updated));
      return;
    }

    const targetCards = await Card.find({ columnId: toColumnObjectId })
      .sort({ position: 1, _id: 1 })
      .lean();

    const sourceRemaining = sourceCards.filter((card) => card._id.toString() !== cardId);
    const insertionIndex = clampIndex(
      typeof toIndex === 'number' ? toIndex : targetCards.length,
      0,
      targetCards.length
    );
    const targetNext = [...targetCards];
    targetNext.splice(insertionIndex, 0, { ...movingCard, columnId: toColumnObjectId });

    const bulkOperations = [
      ...sourceRemaining.map((card, index) => ({
        updateOne: {
          filter: { _id: card._id },
          update: { position: index, updatedAt: timestamp },
        },
      })),
      ...targetNext.map((card, index) => ({
        updateOne: {
          filter: { _id: card._id },
          update: {
            columnId: toColumnObjectId,
            position: index,
            updatedAt: timestamp,
          },
        },
      })),
    ];

    if (bulkOperations.length) {
      await Card.bulkWrite(bulkOperations);
    }

    const updated = await Card.findById(cardObjectId).lean();
    res.json(mapCard(updated));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBoards,
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
  updateBoardBackground,
  createColumn,
  updateColumn,
  reorderColumns,
  deleteColumn,
  createCard,
  updateCard,
  setCardCompletion,
  deleteCard,
  moveCard,
};
