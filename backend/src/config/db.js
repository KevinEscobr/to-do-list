const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ruta del archivo SQLite
const dbFilePath = process.env.DATABASE_FILE || path.join(__dirname, '../../data/database.sqlite');
const dbDir = path.dirname(dbFilePath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Cargar motor SQLite (node:sqlite disponible nativamente en Node.js 22+)
let dbInstance = null;

try {
  const { DatabaseSync } = require('node:sqlite');
  dbInstance = new DatabaseSync(dbFilePath);
} catch (err) {
  try {
    const Database = require('better-sqlite3');
    dbInstance = new Database(dbFilePath);
  } catch (err2) {
    console.error('Error al inicializar SQLite:', err.message, err2.message);
    throw new Error('No se pudo inicializar la base de datos SQLite.');
  }
}

// Habilitar claves foráneas
try {
  dbInstance.exec('PRAGMA foreign_keys = ON;');
} catch (_) {}

/**
 * Inicializa las tablas e índices si no existen.
 */
function initDatabase() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Personal',
      priority TEXT NOT NULL DEFAULT 'Media',
      completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER,
      image_url TEXT,
      image_format TEXT,
      location_json TEXT,
      weather_json TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
  `;

  dbInstance.exec(schema);
}

// Ejecutar inicialización de tablas
initDatabase();

module.exports = {
  db: dbInstance,

  /**
   * Ejecuta una consulta que retorna múltiples filas.
   */
  queryAll(sql, params = []) {
    const stmt = dbInstance.prepare(sql);
    return stmt.all(...params);
  },

  /**
   * Ejecuta una consulta que retorna una única fila o null.
   */
  queryOne(sql, params = []) {
    const stmt = dbInstance.prepare(sql);
    const rows = stmt.all(...params);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Ejecuta una sentencia INSERT, UPDATE o DELETE.
   */
  execute(sql, params = []) {
    const stmt = dbInstance.prepare(sql);
    return stmt.run(...params);
  },
};
