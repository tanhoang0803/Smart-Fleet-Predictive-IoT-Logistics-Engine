// Smart-Fleet IoT — Maintenance Controller
// TanQHoang © 2026

const { Router } = require('express');
const { z } = require('zod');
const maintenanceModel = require('../models/maintenanceModel');
const authMiddleware = require('../middlewares/authMiddleware');
const rateLimiter = require('../middlewares/rateLimiter');
const validateRequest = require('../middlewares/validateRequest');

const router = Router();
router.use(authMiddleware, rateLimiter);

const VALID_COMPONENTS = [
  'engine_oil', 'air_filter', 'spark_plug', 'drive_chain',
  'brake_pads', 'brake_shoes', 'fuel_filter', 'transmission_fluid',
];

const logSchema = z.object({
  vehicleId: z.string().uuid(),
  component: z.enum(VALID_COMPONENTS),
  mileageAtService: z.number().int().min(0),
  notes: z.string().max(500).optional(),
});

const respond = (res, req, data, status = 200) => res.status(status).json({
  success: true, data,
  meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
  error: null,
});

// POST /api/v1/maintenance/log
router.post('/log', validateRequest(logSchema), async (req, res) => {
  const log = await maintenanceModel.createLog({
    vehicleId: req.body.vehicleId,
    component: req.body.component,
    mileageAtService: req.body.mileageAtService,
    notes: req.body.notes,
  });
  respond(res, req, { log }, 201);
});

// GET /api/v1/maintenance/:vehicleId
router.get('/:vehicleId', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const { items, total } = await maintenanceModel.findLogsByVehicle(req.params.vehicleId, { page, limit });
  respond(res, req, {
    items,
    pagination: { page, limit, total, hasNext: page * limit < total },
  });
});

// GET /api/v1/maintenance/:vehicleId/schedule
router.get('/:vehicleId/schedule', async (req, res) => {
  const schedule = await maintenanceModel.findScheduleByVehicle(req.params.vehicleId);
  respond(res, req, { schedule });
});

module.exports = router;
