// Smart-Fleet IoT — Route Service
// TanQHoang © 2026
// Haversine distance (zero-dependency, always available) + Redis cache (1h TTL)

const crypto = require('crypto');
const redisClient = require('../utils/redisClient');
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

const CACHE_TTL_ROUTE = 3600; // 1 hour
const DEFAULT_LOAD_FACTOR = 0.90;
const AVG_SPEED_KMH = 25; // Ho Chi Minh City urban average

// Haversine formula — straight-line distance between two GPS points
// mechanic-pro-reviewed
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2);
}

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

    // Haversine straight-line distance (×1.3 urban road factor for HCMC)
    const straightKm = haversineKm(originLat, originLon, destLat, destLon);
    const distanceKm = +(straightKm * 1.3).toFixed(2);
    const durationMin = Math.round((distanceKm / AVG_SPEED_KMH) * 60);
    const loadFactor = computeLoadFactor(distanceKm, durationMin);
    const fuelEstimateL = +(distanceKm * 0.02).toFixed(2); // ~2L/100km Honda Wave RSX

    const result = {
      distanceKm,
      durationMin,
      loadFactor,
      fuelEstimateL,
      source: 'haversine',
      cachedAt: new Date().toISOString(),
    };

    await redisClient.set(cacheKey, result, CACHE_TTL_ROUTE);
    logger.info(`Route calculated: ${distanceKm}km, ${durationMin}min, load×${loadFactor}`);
    return result;
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
