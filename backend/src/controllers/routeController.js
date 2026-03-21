// Smart-Fleet IoT — Route Controller
// TanQHoang © 2026

const { Router } = require('express');
const { z } = require('zod');
const routeService = require('../services/routeService');
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

  const result = await routeService.optimizeRoute(originLat, originLon, destLat, destLon);

  // Persist route log if vehicleId provided
  if (parsed.data.vehicleId) {
    supabase.from('route_logs').insert({
      vehicle_id: parsed.data.vehicleId,
      origin_lat: originLat, origin_lon: originLon,
      dest_lat: destLat, dest_lon: destLon,
      distance_km: result.distanceKm,
      duration_min: result.durationMin,
      load_factor: result.loadFactor,
    }).then(() => {}).catch(() => {});
  }

  return res.status(200).json({
    success: true, data: result,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    error: null,
  });
});

module.exports = router;
