// Smart-Fleet IoT — Notification Controller
// TanQHoang © 2026

const { Router } = require('express');
const { z } = require('zod');
const userModel = require('../models/userModel');
const authMiddleware = require('../middlewares/authMiddleware');
const rateLimiter = require('../middlewares/rateLimiter');
const validateRequest = require('../middlewares/validateRequest');

const router = Router();
router.use(authMiddleware, rateLimiter);

const fcmTokenSchema = z.object({
  fcmToken: z.string().min(10),
});

// POST /api/v1/notifications/fcm-token
router.post('/fcm-token', validateRequest(fcmTokenSchema), async (req, res) => {
  await userModel.updateFcmToken(req.user.id, req.body.fcmToken);

  res.status(200).json({
    success: true,
    data: { registered: true },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    error: null,
  });
});

module.exports = router;
