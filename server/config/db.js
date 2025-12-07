const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let dbInstance;

const createTables = (db) => {
  const now = Date.now();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      avatarURL TEXT DEFAULT '',
      theme TEXT CHECK(theme IN ('light','dark','violet')) NOT NULL DEFAULT 'light',
      refreshTokenHash TEXT,
      passwordResetTokenHash TEXT,
      passwordResetTokenExpiry INTEGER,
      pendingEmail TEXT,
      emailVerificationTokenHash TEXT,
      emailVerificationTokenExpiry INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT 'project',
      iconName TEXT DEFAULT 'icon-Project',
      background TEXT DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS boardColumns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      boardId INTEGER NOT NULL,
      title TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (boardId) REFERENCES boards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      columnId INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT CHECK(priority IN ('without','low','medium','high')) NOT NULL DEFAULT 'without',
      deadline TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (columnId) REFERENCES boardColumns(id) ON DELETE CASCADE
    );
  `);

  // Ensure at least one timestamp exists for existing rows if they were created before this migration
  db.exec(`
    UPDATE boards SET createdAt = COALESCE(createdAt, ${now}), updatedAt = COALESCE(updatedAt, ${now}) WHERE createdAt IS NULL OR updatedAt IS NULL;
    UPDATE boardColumns SET createdAt = COALESCE(createdAt, ${now}), updatedAt = COALESCE(updatedAt, ${now}) WHERE createdAt IS NULL OR updatedAt IS NULL;
    UPDATE cards SET createdAt = COALESCE(createdAt, ${now}), updatedAt = COALESCE(updatedAt, ${now}) WHERE createdAt IS NULL OR updatedAt IS NULL;
  `);

  // Add new user columns if missing (backwards compatibility)
  const userColumns = db.prepare('PRAGMA table_info(users)').all();
  const hasColumn = (name) => userColumns.some((col) => col.name === name);
  const addColumn = (sql) => {
    try {
      db.exec(sql);
    } catch (err) {
      // ignore if column already exists or error
    }
  };

  if (!hasColumn('pendingEmail')) {
    addColumn('ALTER TABLE users ADD COLUMN pendingEmail TEXT;');
  }
  if (!hasColumn('emailVerificationTokenHash')) {
    addColumn('ALTER TABLE users ADD COLUMN emailVerificationTokenHash TEXT;');
  }
  if (!hasColumn('emailVerificationTokenExpiry')) {
    addColumn('ALTER TABLE users ADD COLUMN emailVerificationTokenExpiry INTEGER;');
  }
};

const connectDatabase = async () => {
  if (dbInstance) {
    return dbInstance;
  }

  const defaultPath = path.join(__dirname, '..', 'nexora', 'nexora.sqlite');
  const dbPath = process.env.SQLITE_DB_PATH || defaultPath;

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  dbInstance = new Database(dbPath);
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('journal_mode = WAL');
  createTables(dbInstance);

  // eslint-disable-next-line no-console
  console.log(`SQLite veritabanı hazır: ${dbPath}`);

  return dbInstance;
};

const getDB = () => {
  if (!dbInstance) {
    throw new Error('SQLite bağlantısı henüz başlatılmadı');
  }

  return dbInstance;
};

module.exports = connectDatabase;
module.exports.getDB = getDB;
