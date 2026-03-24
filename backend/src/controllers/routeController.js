// Smart-Fleet IoT — Route Controller
// TanQHoang © 2026

const { Router } = require('express');
const { z } = require('zod');
const routeService = require('../services/routeService');
const weatherService = require('../services/weatherService');
const { supabase } = require('../utils/supabaseClient');
const authMiddleware = require('../middlewares/authMiddleware');
const rateLimiter = require('../middlewares/rateLimiter');

const router = Router();
router.use(authMiddleware, rateLimiter);

const routeQuerySchema = z.object({
  origin: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*$/, 'Format: lat,lon'),
  destination: z.string().regex(/^-?\d+\.?\d*,-?\d+\.?\d*$/, 'Format: lat,lon'),
  vehicleId: z.string().uuid().optional(),
});

// Build maintenance warnings based on live weather conditions
// mechanic-pro-reviewed
function buildMaintenanceWarnings(weather) {
  const warnings = [];
  const { humidity, temperature, condition } = weather;
  const isRainy = ['Rain', 'Drizzle', 'Thunderstorm'].includes(condition);

  if (humidity >= 90)
    warnings.push({ level: 'CRITICAL', message: 'Extreme humidity (≥90%) — reduce engine oil interval by 40%. Inspect air filter immediately.' });
  else if (humidity >= 85)
    warnings.push({ level: 'CRITICAL', message: 'Very high humidity (≥85%) — reduce oil change interval by 30%. Check spark plug for moisture.' });
  else if (humidity >= 80)
    warnings.push({ level: 'WARNING', message: 'High humidity (≥80%) — reduce air filter service interval by 20%.' });
  else if (humidity >= 70)
    warnings.push({ level: 'INFO', message: 'Moderate humidity — monitor chain lubrication more frequently.' });

  if (isRainy)
    warnings.push({ level: 'WARNING', message: `${condition} detected — lubricate chain after trip. Inspect brake pads for reduced stopping distance.` });

  if (temperature > 37)
    warnings.push({ level: 'WARNING', message: `High temperature (${temperature}°C) — check engine oil level and coolant before departure.` });

  if (condition === 'Thunderstorm')
    warnings.push({ level: 'CRITICAL', message: 'Thunderstorm — avoid travel if possible. Engine electrical components at risk.' });

  return warnings;
}

// GET /api/v1/routes/optimize
router.get('/optimize', async (req, res) => {
  const parsed = routeQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(422).json({
      success: false, data: null,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      error: { code: 'VALIDATION_ERROR', message: 'Invalid query params.', details: parsed.error.flatten() },
    });
  }

  const [originLat, originLon] = parsed.data.origin.split(',').map(Number);
  const [destLat, destLon] = parsed.data.destination.split(',').map(Number);

  // Fetch route + weather in parallel (weather has its own 30-min Redis cache)
  const [result, weather] = await Promise.all([
    routeService.optimizeRoute(originLat, originLon, destLat, destLon),
    weatherService.getCurrentConditions(originLat, originLon),
  ]);

  // Weather-adjusted metrics
  const isRainy = ['Rain', 'Drizzle', 'Thunderstorm'].includes(weather.condition);
  // Rain degrades road traction → lower effective load factor
  const weatherLoadFactor = +(result.loadFactor * (isRainy ? 0.9 : 1.0)).toFixed(2);
  // Humidity reduces fuel efficiency (engine works harder in dense humid air)
  const adjustedFuelL = +(result.fuelEstimateL / weather.humidityMultiplier).toFixed(2);
  const maintenanceWarnings = buildMaintenanceWarnings(weather);

  const enriched = {
    ...result,
    weatherLoadFactor,
    adjustedFuelL,
    weather: {
      city: weather.city,
      condition: weather.condition,
      temperature: weather.temperature,
      humidity: weather.humidity,
      humidityMultiplier: weather.humidityMultiplier,
      isRainy,
    },
    maintenanceWarnings,
  };

  // Persist route log if vehicleId provided
  if (parsed.data.vehicleId) {
    supabase.from('route_logs').insert({
      vehicle_id: parsed.data.vehicleId,
      origin_lat: originLat, origin_lon: originLon,
      dest_lat: destLat, dest_lon: destLon,
      distance_km: result.distanceKm,
      duration_min: result.durationMin,
      load_factor: weatherLoadFactor,
    }).then(() => {}).catch(() => {});
  }

  return res.status(200).json({
    success: true, data: enriched,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    error: null,
  });
});

module.exports = router;
