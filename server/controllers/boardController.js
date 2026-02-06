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
  deadline: doc.deadline,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

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

    const timestamp = now();
    const column = await BoardColumn.create({
      boardId,
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

    const timestamp = now();
    const card = await Card.create({
      columnId,
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
    const boardId = toObjectId(req.params.boardId, 'Geçersiz board');
    const columnId = toObjectId(req.params.columnId, 'Geçersiz sütun');
    const cardId = toObjectId(req.params.cardId, 'Geçersiz kart');
    const userId = req.user?.id;
    if (!userId) {
      throw badRequest('Kullanıcı bilgisi eksik');
    }
    const { title, description, priority, deadline } = req.body || {};

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
      deadline: deadline ?? existing.deadline,
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
    const { fromColumnId, toColumnId, cardId } = req.body || {};
    if (!fromColumnId || !toColumnId || !cardId) {
      throw badRequest('fromColumnId, toColumnId ve cardId zorunludur');
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
  getBoards,
  createBoard,
  getBoard,
  updateBoard,
  deleteBoard,
  updateBoardBackground,
  createColumn,
  updateColumn,
  deleteColumn,
  createCard,
  updateCard,
  deleteCard,
  moveCard,
};
