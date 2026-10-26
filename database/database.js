const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const databaseFile = path.resolve(process.env.DATABASE_FILE || './data/tyre-backlog.sqlite');
fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

const db = new sqlite3.Database(databaseFile);
let operationQueue = Promise.resolve();

function exclusive(operation) {
  const previous = operationQueue;
  let release;
  operationQueue = new Promise((resolve) => { release = resolve; });
  return previous.then(operation).finally(release);
}

function rawRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function rawGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}

function rawAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

function run(sql, params = []) {
  return exclusive(() => rawRun(sql, params));
}

function get(sql, params = []) {
  return exclusive(() => rawGet(sql, params));
}

function all(sql, params = []) {
  return exclusive(() => rawAll(sql, params));
}

function transaction(operation) {
  return exclusive(async () => {
    await rawRun('BEGIN IMMEDIATE');
    try {
      const result = await operation({ run: rawRun, get: rawGet, all: rawAll });
      await rawRun('COMMIT');
      return result;
    } catch (error) {
      try {
        await rawRun('ROLLBACK');
      } catch (rollbackError) {
        console.error('Rollback transaksi database gagal:', rollbackError.message);
      }
      throw error;
    }
  });
}

async function initialize() {
  await run('PRAGMA foreign_keys = ON');
  await run('PRAGMA journal_mode = WAL');
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'field')),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL
  )`);
  await run(`CREATE TABLE IF NOT EXISTS tyre_backlogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT NOT NULL,
    unit TEXT NOT NULL,
    manpower TEXT,
    hm_unit TEXT,
    input_datetime TEXT NOT NULL,
    remarks TEXT NOT NULL,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  const backlogColumns = await all('PRAGMA table_info(tyre_backlogs)');
  if (!backlogColumns.some((column) => column.name === 'manpower')) {
    await run('ALTER TABLE tyre_backlogs ADD COLUMN manpower TEXT');
  }
  if (!backlogColumns.some((column) => column.name === 'hm_unit')) {
    await run('ALTER TABLE tyre_backlogs ADD COLUMN hm_unit TEXT');
  }
  await run(`CREATE TABLE IF NOT EXISTS tyre_backlog_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    backlog_id INTEGER NOT NULL REFERENCES tyre_backlogs(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  )`);
  await run('CREATE INDEX IF NOT EXISTS idx_backlogs_created ON tyre_backlogs(created_at DESC)');
  await run('CREATE INDEX IF NOT EXISTS idx_backlogs_serial ON tyre_backlogs(serial_number)');
  await run('CREATE INDEX IF NOT EXISTS idx_backlogs_unit ON tyre_backlogs(unit)');
  await run('CREATE INDEX IF NOT EXISTS idx_backlogs_owner ON tyre_backlogs(created_by)');
}

module.exports = { db, run, get, all, transaction, initialize };
