// Smart-Fleet IoT — Route Service
// TanQHoang © 2026
// OSRM public API (free, no key) + Redis cache (1h TTL)

const axios = require('axios');
const crypto = require('crypto');
const redisClient = require('../utils/redisClient');
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const CACHE_TTL_ROUTE = 3600; // 1 hour
const DEFAULT_LOAD_FACTOR = 0.90;

// Source: .claude/skills/environmental-logic.md — Load Factor Multiplier
// mechanic-pro-reviewed
function computeLoadFactor(distanceKm, durationMin, estimatedPayloadKg = 0) {
  const avgSpeedKmh = durationMin > 0 ? (distanceKm / durationMin) * 60 : 30;

  if (distanceKm > 50 || estimatedPayloadKg > 50) return 0.75;
  if (avgSpeedKmh < 20 || estimatedPayloadKg > 20) return 0.80;
  if (distanceKm > 20 || estimatedPayloadKg > 10) return 0.90;
  return 1.00;
}

function hashCoord(lat, lon) {
  return crypto.createHash('md5').update(`${lat}:${lon}`).digest('hex').slice(0, 8);
}

const routeService = {
  async optimizeRoute(originLat, originLon, destLat, destLon) {
    const cacheKey = `route:${hashCoord(originLat, originLon)}:${hashCoord(destLat, destLon)}`;

    const cached = await redisClient.getJSON(cacheKey);
    if (cached) {
      logger.debug(`Route cache HIT: ${cacheKey}`);
      return cached;
    }

    try {
      // OSRM format: /route/v1/driving/{lon},{lat};{lon},{lat}
      const { data } = await axios.get(
        `${OSRM_BASE}/${originLon},${originLat};${destLon},${destLat}`,
        {
          params: { overview: 'false', steps: 'false' },
          timeout: 8000,
        }
      );

      if (data.code !== 'Ok' || !data.routes?.[0]) {
        throw new Error(`OSRM returned code: ${data.code}`);
      }

      const route = data.routes[0];
      const distanceKm = +(route.distance / 1000).toFixed(2);
      const durationMin = Math.round(route.duration / 60);
      const loadFactor = computeLoadFactor(distanceKm, durationMin);
      const fuelEstimateL = +(distanceKm * 0.02).toFixed(2); // ~2L/100km Honda Wave RSX

      const result = {
        distanceKm,
        durationMin,
        loadFactor,
        fuelEstimateL,
        cachedAt: new Date().toISOString(),
      };

      await redisClient.set(cacheKey, result, CACHE_TTL_ROUTE);
      return result;
    } catch (err) {
      logger.error(`OSRM API error: ${err.message}`);
      const apiErr = new Error('Route optimization service unavailable.');
      apiErr.status = 500;
      apiErr.code = 'ROUTE_FETCH_FAILED';
      throw apiErr;
    }
  },

  async getLatestLoadFactor(vehicleId) {
    try {
      const { data } = await supabase
        .from('route_logs')
        .select('load_factor')
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return data?.load_factor ?? DEFAULT_LOAD_FACTOR;
    } catch {
      return DEFAULT_LOAD_FACTOR;
    }
  },

  computeLoadFactor,
};

module.exports = routeService;
