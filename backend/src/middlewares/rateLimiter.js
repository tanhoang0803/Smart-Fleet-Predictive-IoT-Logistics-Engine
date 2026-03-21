// Smart-Fleet IoT — Redis-backed Rate Limiter
// TanQHoang © 2026
// 100 requests per minute per IP on all /api/v1 routes

const redisClient = require('../utils/redisClient');
const logger = require('../utils/logger');

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;

async function rateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const windowStart = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `rl:${ip}:${windowStart}`;

  try {
    const count = await redisClient.incr(key);

    if (count === 1) {
      await redisClient.expire(key, WINDOW_SECONDS);
    }

    if (count > MAX_REQUESTS) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Limit: ${MAX_REQUESTS} per ${WINDOW_SECONDS}s.`,
        },
      });
    }

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - count));
    return next();
  } catch (err) {
    logger.error(`Rate limiter Redis error: ${err.message}`);
    return next(); // Fail open — don't block if Redis is down
  }
}

module.exports = rateLimiter;
