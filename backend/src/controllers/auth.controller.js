const crypto = require('crypto');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_taskflow_pro_2026_jwt_token_key_segura';

/**
 * Función auxiliar para hashear contraseñas (usa bcryptjs o crypto nativo).
 */
function hashPassword(password) {
  try {
    const bcrypt = require('bcryptjs');
    return bcrypt.hashSync(password, 10);
  } catch (_) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
    return `pbkdf2$${salt}$${hash}`;
  }
}

/**
 * Función auxiliar para comparar contraseñas.
 */
function comparePassword(password, storedHash) {
  if (storedHash.startsWith('pbkdf2$')) {
    const [, salt, originalHash] = storedHash.split('$');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex');
    return hash === originalHash;
  }
  try {
    const bcrypt = require('bcryptjs');
    return bcrypt.compareSync(password, storedHash);
  } catch (_) {
    return false;
  }
}

/**
 * Genera un token JWT de sesión con 30 días de validez.
 */
function generateToken(payload) {
  try {
    const jwt = require('jsonwebtoken');
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  } catch (_) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 días
    const fullPayload = { ...payload, exp };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    return `${headerB64}.${payloadB64}.${signature}`;
  }
}

/**
 * POST /api/auth/register
 */
function register(req, res) {
  const { username, email, name, password } = req.body || {};

  if (!username || !email || !name || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: username, email, name, password' });
  }

  // Verificar si ya existe el usuario o email
  const existing = db.queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (existing) {
    return res.status(409).json({ error: 'El nombre de usuario o correo electrónico ya se encuentra registrado.' });
  }

  const userId = 'u_' + crypto.randomUUID().slice(0, 8);
  const passwordHash = hashPassword(password);
  const now = Date.now();

  db.execute(
    'INSERT INTO users (id, username, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, username, email, name, passwordHash, now]
  );

  const user = { id: userId, username, email, name, createdAt: now };
  const token = generateToken({ id: userId, username, email });

  return res.status(201).json({
    message: 'Usuario registrado exitosamente',
    token,
    user,
  });
}

/**
 * POST /api/auth/login
 */
function login(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ error: 'Debes proporcionar usuario y contraseña' });
  }

  const userRow = db.queryOne(
    'SELECT id, username, email, name, password_hash, created_at FROM users WHERE username = ?',
    [username]
  );

  if (!userRow || !comparePassword(password, userRow.password_hash)) {
    return res.status(401).json({ error: 'Credenciales inválidas. Usuario o contraseña incorrectos.' });
  }

  const user = {
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    name: userRow.name,
    createdAt: userRow.created_at,
  };

  const token = generateToken({ id: user.id, username: user.username, email: user.email });

  return res.json({
    message: 'Inicio de sesión exitoso',
    token,
    user,
  });
}

/**
 * GET /api/auth/profile
 */
function getProfile(req, res) {
  const userRow = db.queryOne(
    'SELECT id, username, email, name, created_at FROM users WHERE id = ?',
    [req.user.id]
  );

  if (!userRow) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  return res.json({
    id: userRow.id,
    username: userRow.username,
    email: userRow.email,
    name: userRow.name,
    createdAt: userRow.created_at,
  });
}

module.exports = {
  register,
  login,
  getProfile,
};
