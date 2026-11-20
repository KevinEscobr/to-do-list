const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_taskflow_pro_2026_jwt_token_key_segura';

/**
 * Valida o decodifica un token JWT (soporta librería 'jsonwebtoken' o fallback nativo crypto).
 */
function verifyToken(token) {
  try {
    const jwt = require('jsonwebtoken');
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }

    // Fallback nativo con crypto en caso de no tener node_modules instalados
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Token JWT inválido');

    const [headerB64, payloadB64, signatureB64] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (signatureB64 !== expectedSig) {
      throw new Error('Firma JWT inválida');
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      throw new Error('Token expirado');
    }
    return payload;
  }
}

/**
 * Middleware que protege las rutas de la API verificando el Bearer Token.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'Acceso no autorizado: Se requiere token de autenticación (Bearer token).',
    });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, username, email }
    next();
  } catch (err) {
    return res.status(403).json({
      error: 'Token inválido o expirado.',
      details: err.message,
    });
  }
}

module.exports = {
  authenticateToken,
  verifyToken,
};
