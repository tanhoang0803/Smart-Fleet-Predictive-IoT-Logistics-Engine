// Smart-Fleet IoT — Auth Controller
// TanQHoang © 2026

const { Router } = require('express');
const { z } = require('zod');
const authService = require('../services/authService');
const authMiddleware = require('../middlewares/authMiddleware');
const validateRequest = require('../middlewares/validateRequest');

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/v1/auth/register
router.post('/register', validateRequest(registerSchema), async (req, res) => {
  const { email, password, name } = req.body;
  const user = await authService.register(email, password, name);

  res.status(201).json({
    success: true,
    data: { user },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    error: null,
  });
});

// POST /api/v1/auth/login
router.post('/login', validateRequest(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const { user, tokens } = await authService.login(email, password);

  authService.setCookies(res, tokens);

  res.status(200).json({
    success: true,
    data: { user },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    error: null,
  });
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({
      success: false, data: null,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
      error: { code: 'UNAUTHORIZED', message: 'Refresh token missing.' },
    });
  }

  const { userId, email } = await authService.verifyRefreshToken(refreshToken);
  const tokens = await authService.signTokens(userId, email);
  authService.setCookies(res, tokens);

  return res.status(200).json({
    success: true,
    data: { refreshed: true },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    error: null,
  });
});

// POST /api/v1/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
  authService.clearCookies(res);
  res.status(200).json({
    success: true,
    data: { loggedOut: true },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    error: null,
  });
});

module.exports = router;
