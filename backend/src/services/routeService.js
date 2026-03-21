// Smart-Fleet IoT — Route Service
// TanQHoang © 2026
// Google Maps Distance Matrix API + Redis cache (1h TTL)

const axios = require('axios');
const crypto = require('crypto');
const redisClient = require('../utils/redisClient');
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

const GMAPS_BASE = 'https://maps.googleapis.com/maps/api';
const CACHE_TTL_ROUTE = 3600; // 1 hour
const DEFAULT_LOAD_FACTOR = 0.90; // Fallback when API unavailable

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
      const { data } = await axios.get(`${GMAPS_BASE}/distancematrix/json`, {
        params: {
          origins: `${originLat},${originLon}`,
          destinations: `${destLat},${destLon}`,
          key: process.env.GOOGLE_MAPS_API_KEY,
          units: 'metric',
          departure_time: 'now',
        },
        timeout: 8000,
      });

      const element = data.rows?.[0]?.elements?.[0];
      if (!element || element.status !== 'OK') {
        throw new Error(`Maps API returned status: ${element?.status}`);
      }

      const distanceKm = element.distance.value / 1000;
      const durationMin = Math.round((element.duration_in_traffic?.value || element.duration.value) / 60);
      const loadFactor = computeLoadFactor(distanceKm, durationMin);
      const fuelEstimateL = +(distanceKm * 0.05).toFixed(2); // ~2L/100km Honda Wave RSX

      const result = {
        distanceKm: +distanceKm.toFixed(2),
        durationMin,
        loadFactor,
        fuelEstimateL,
        polyline: data.rows?.[0]?.elements?.[0]?.polyline || null,
        cachedAt: new Date().toISOString(),
      };

      await redisClient.set(cacheKey, result, CACHE_TTL_ROUTE);
      return result;
    } catch (err) {
      logger.error(`Google Maps API error: ${err.message}`);
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
