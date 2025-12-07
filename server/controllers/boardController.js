const { getDB } = require('../config/db');

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

const mapBoard = (row) => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  iconName: row.iconName,
  background: row.background,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const getBoards = (req, res, next) => {
  try {
    const db = getDB();
    const rows = db
      .prepare(
        `SELECT id, name, icon, iconName, background, createdAt, updatedAt
         FROM boards
         ORDER BY createdAt ASC`
      )
      .all();
    res.json(rows.map(mapBoard));
  } catch (error) {
    next(error);
  }
};

const createBoard = (req, res, next) => {
  try {
    const { name, icon = 'project', iconName = 'icon-Project', background = '' } = req.body || {};
    if (!name || !name.trim()) {
      throw badRequest('Board adı zorunludur');
    }

    const db = getDB();
    const timestamp = now();
    const result = db
      .prepare(
        `INSERT INTO boards (name, icon, iconName, background, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(name.trim(), icon, iconName, background, timestamp, timestamp);

    const board = mapBoard({
      id: result.lastInsertRowid,
      name: name.trim(),
      icon,
      iconName,
      background,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    res.status(201).json(board);
  } catch (error) {
    next(error);
  }
};

const getBoard = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const db = getDB();

    const boardRow = db
      .prepare(
        `SELECT id, name, icon, iconName, background, createdAt, updatedAt
         FROM boards
         WHERE id = ?`
      )
      .get(boardId);

    if (!boardRow) {
      throw notFound('Board bulunamadı');
    }

    const columns = db
      .prepare(
        `SELECT id, boardId, title, position, createdAt, updatedAt
         FROM boardColumns
         WHERE boardId = ?
         ORDER BY position ASC, id ASC`
      )
      .all(boardId);

    const columnIds = columns.map((c) => c.id);
    const cards = columnIds.length
      ? db
          .prepare(
            `SELECT id, columnId, title, description, priority, deadline, createdAt, updatedAt
             FROM cards
             WHERE columnId IN (${columnIds.map(() => '?').join(',')})
             ORDER BY id ASC`
          )
          .all(...columnIds)
      : [];

    const columnsWithCards = columns.map((column) => ({
      ...column,
      cards: cards.filter((card) => card.columnId === column.id),
    }));

    res.json({
      ...mapBoard(boardRow),
      columns: columnsWithCards,
    });
  } catch (error) {
    next(error);
  }
};

const updateBoard = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const { name, icon, iconName, background } = req.body || {};
    const db = getDB();

    const existing = db
      .prepare('SELECT * FROM boards WHERE id = ?')
      .get(boardId);
    if (!existing) {
      throw notFound('Board bulunamadı');
    }

    const nextBoard = {
      name: name?.trim() || existing.name,
      icon: icon ?? existing.icon,
      iconName: iconName ?? existing.iconName,
      background: background ?? existing.background,
      updatedAt: now(),
    };

    db.prepare(
      `UPDATE boards
       SET name = ?, icon = ?, iconName = ?, background = ?, updatedAt = ?
       WHERE id = ?`
    ).run(
      nextBoard.name,
      nextBoard.icon,
      nextBoard.iconName,
      nextBoard.background,
      nextBoard.updatedAt,
      boardId
    );

    res.json({
      id: boardId,
      ...nextBoard,
      createdAt: existing.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

const deleteBoard = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const db = getDB();
    const result = db.prepare('DELETE FROM boards WHERE id = ?').run(boardId);
    if (!result.changes) {
      throw notFound('Board bulunamadı');
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const updateBoardBackground = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const { background = '' } = req.body || {};
    const db = getDB();

    const existing = db
      .prepare('SELECT * FROM boards WHERE id = ?')
      .get(boardId);
    if (!existing) {
      throw notFound('Board bulunamadı');
    }

    const updatedAt = now();
    db.prepare(
      `UPDATE boards
       SET background = ?, updatedAt = ?
       WHERE id = ?`
    ).run(background, updatedAt, boardId);

    res.json({
      id: boardId,
      name: existing.name,
      icon: existing.icon,
      iconName: existing.iconName,
      background,
      createdAt: existing.createdAt,
      updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

const ensureBoardAndColumn = (boardId, columnId) => {
  const db = getDB();
  const column = db
    .prepare('SELECT * FROM boardColumns WHERE id = ? AND boardId = ?')
    .get(columnId, boardId);
  if (!column) {
    throw notFound('Sütun bulunamadı');
  }
  return column;
};

const createColumn = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const { title } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Sütun başlığı zorunludur');
    }

    const db = getDB();
    const boardExists = db
      .prepare('SELECT id FROM boards WHERE id = ?')
      .get(boardId);
    if (!boardExists) {
      throw notFound('Board bulunamadı');
    }

    const timestamp = now();
    const result = db
      .prepare(
        `INSERT INTO boardColumns (boardId, title, position, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(boardId, title.trim(), 0, timestamp, timestamp);

    res.status(201).json({
      id: result.lastInsertRowid,
      boardId,
      title: title.trim(),
      position: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      cards: [],
    });
  } catch (error) {
    next(error);
  }
};

const updateColumn = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const columnId = Number(req.params.columnId);
    const { title } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Sütun başlığı zorunludur');
    }

    const column = ensureBoardAndColumn(boardId, columnId);
    const db = getDB();
    const updatedAt = now();

    db.prepare(
      `UPDATE boardColumns
       SET title = ?, updatedAt = ?
       WHERE id = ? AND boardId = ?`
    ).run(title.trim(), updatedAt, columnId, boardId);

    res.json({
      ...column,
      title: title.trim(),
      updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

const deleteColumn = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const columnId = Number(req.params.columnId);
    ensureBoardAndColumn(boardId, columnId);

    const db = getDB();
    db.prepare('DELETE FROM boardColumns WHERE id = ? AND boardId = ?').run(columnId, boardId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const createCard = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const columnId = Number(req.params.columnId);
    const { title, description = '', priority = 'without', deadline = null } = req.body || {};
    if (!title || !title.trim()) {
      throw badRequest('Kart başlığı zorunludur');
    }

    ensureBoardAndColumn(boardId, columnId);
    const db = getDB();
    const timestamp = now();

    const result = db
      .prepare(
        `INSERT INTO cards (columnId, title, description, priority, deadline, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(columnId, title.trim(), description, priority, deadline, timestamp, timestamp);

    res.status(201).json({
      id: result.lastInsertRowid,
      columnId,
      title: title.trim(),
      description,
      priority,
      deadline,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  } catch (error) {
    next(error);
  }
};

const updateCard = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const columnId = Number(req.params.columnId);
    const cardId = Number(req.params.cardId);
    const { title, description, priority, deadline } = req.body || {};

    ensureBoardAndColumn(boardId, columnId);
    const db = getDB();
    const existing = db
      .prepare('SELECT * FROM cards WHERE id = ? AND columnId = ?')
      .get(cardId, columnId);
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

    db.prepare(
      `UPDATE cards
       SET title = ?, description = ?, priority = ?, deadline = ?, updatedAt = ?
       WHERE id = ? AND columnId = ?`
    ).run(
      updatedCard.title,
      updatedCard.description,
      updatedCard.priority,
      updatedCard.deadline,
      updatedCard.updatedAt,
      cardId,
      columnId
    );

    res.json({
      id: cardId,
      columnId,
      createdAt: existing.createdAt,
      ...updatedCard,
    });
  } catch (error) {
    next(error);
  }
};

const deleteCard = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const columnId = Number(req.params.columnId);
    const cardId = Number(req.params.cardId);

    ensureBoardAndColumn(boardId, columnId);
    const db = getDB();

    const result = db
      .prepare('DELETE FROM cards WHERE id = ? AND columnId = ?')
      .run(cardId, columnId);
    if (!result.changes) {
      throw notFound('Kart bulunamadı');
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

const moveCard = (req, res, next) => {
  try {
    const boardId = Number(req.params.boardId);
    const { fromColumnId, toColumnId, cardId } = req.body || {};
    if (!fromColumnId || !toColumnId || !cardId) {
      throw badRequest('fromColumnId, toColumnId ve cardId zorunludur');
    }

    ensureBoardAndColumn(boardId, fromColumnId);
    ensureBoardAndColumn(boardId, toColumnId);

    const db = getDB();
    const existing = db
      .prepare('SELECT * FROM cards WHERE id = ? AND columnId = ?')
      .get(cardId, fromColumnId);
    if (!existing) {
      throw notFound('Kart bulunamadı');
    }

    const updatedAt = now();
    db.prepare(
      `UPDATE cards
       SET columnId = ?, updatedAt = ?
       WHERE id = ?`
    ).run(toColumnId, updatedAt, cardId);

    res.json({
      ...existing,
      columnId: toColumnId,
      updatedAt,
    });
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
