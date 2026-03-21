// Smart-Fleet IoT — Fleet Controller
// TanQHoang © 2026

const { Router } = require('express');
const { z } = require('zod');
const vehicleModel = require('../models/vehicleModel');
const maintenanceService = require('../services/maintenanceService');
const authMiddleware = require('../middlewares/authMiddleware');
const rateLimiter = require('../middlewares/rateLimiter');
const validateRequest = require('../middlewares/validateRequest');

const router = Router();
router.use(authMiddleware, rateLimiter);

const createVehicleSchema = z.object({
  model: z.string().min(2).max(100).optional().default('Honda Wave RSX'),
  plateNumber: z.string().max(20).optional(),
  mileageCurrent: z.number().int().min(0).optional().default(0),
  fuelType: z.enum(['E10', 'E5', 'RON92', 'RON95']).optional().default('E10'),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

const mileageSchema = z.object({
  mileageCurrent: z.number().int().min(0),
});

const respond = (res, req, data, status = 200) => res.status(status).json({
  success: true, data,
  meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
  error: null,
});

// GET /api/v1/fleet
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const { items, total } = await vehicleModel.findAllByOwner(req.user.id, { page, limit });

  respond(res, req, {
    items,
    pagination: { page, limit, total, hasNext: page * limit < total },
  });
});

// POST /api/v1/fleet
router.post('/', validateRequest(createVehicleSchema), async (req, res) => {
  const vehicle = await vehicleModel.create({ ownerId: req.user.id, ...req.body });
  respond(res, req, { vehicle }, 201);
});

// GET /api/v1/fleet/:id/status
router.get('/:id/status', async (req, res) => {
  const result = await maintenanceService.recalculateSchedule(req.params.id, req.user.id);
  respond(res, req, result);
});

// PATCH /api/v1/fleet/:id/mileage
router.patch('/:id/mileage', validateRequest(mileageSchema), async (req, res) => {
  const updated = await vehicleModel.updateMileage(req.params.id, req.user.id, req.body.mileageCurrent);
  if (!updated) {
    return res.status(404).json({
      success: false, data: null,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      error: { code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found.' },
    });
  }

  // Recalculate schedule in background after mileage update
  maintenanceService.recalculateSchedule(req.params.id, req.user.id)
    .catch((e) => require('../utils/logger').error(`Background recalc failed: ${e.message}`));

  return respond(res, req, { updated: true, mileageCurrent: updated.mileage_current });
});

module.exports = router;
