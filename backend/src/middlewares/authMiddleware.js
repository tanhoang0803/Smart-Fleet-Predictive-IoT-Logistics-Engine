// Smart-Fleet IoT — JWT Auth Middleware
// TanQHoang © 2026

const { jwtVerify } = require('jose');
const logger = require('../utils/logger');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

async function authMiddleware(req, res, next) {
  const token = req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
    });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    logger.warn(`[${req.requestId}] Invalid token: ${err.message}`);
    return res.status(401).json({
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      error: { code: 'UNAUTHORIZED', message: 'Token is invalid or expired.' },
    });
  }
}

module.exports = authMiddleware;
