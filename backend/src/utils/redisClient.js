// Smart-Fleet IoT — Upstash Redis Client
// TanQHoang © 2026
// Key namespaces:
//   weather:current:{lat}:{lon}    TTL 1800s  (30 min)
//   weather:forecast:{lat}:{lon}   TTL 10800s (3 hours)
//   route:{originHash}:{destHash}  TTL 3600s  (1 hour)
//   rl:{ip}:{windowStart}          TTL 60s    (rate limiter)

const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Typed helpers to reduce boilerplate
const redisClient = {
  async get(key) {
    return redis.get(key);
  },

  async set(key, value, ttlSeconds) {
    if (ttlSeconds) {
      return redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
    }
    return redis.set(key, JSON.stringify(value));
  },

  async del(key) {
    return redis.del(key);
  },

  async incr(key) {
    return redis.incr(key);
  },

  async expire(key, ttlSeconds) {
    return redis.expire(key, ttlSeconds);
  },

  async getJSON(key) {
    const val = await redis.get(key);
    if (!val) return null;
    try {
      return typeof val === 'string' ? JSON.parse(val) : val;
    } catch {
      return null;
    }
  },
};

module.exports = redisClient;
