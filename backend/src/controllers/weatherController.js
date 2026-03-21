// Smart-Fleet IoT — Weather Controller
// TanQHoang © 2026

const { Router } = require('express');
const weatherService = require('../services/weatherService');
const authMiddleware = require('../middlewares/authMiddleware');
const rateLimiter = require('../middlewares/rateLimiter');

const router = Router();
router.use(authMiddleware, rateLimiter);

const DEFAULT_LAT = parseFloat(process.env.OPENWEATHER_DEFAULT_LAT || '10.8231');
const DEFAULT_LON = parseFloat(process.env.OPENWEATHER_DEFAULT_LON || '106.6297');

const respond = (res, req, data) => res.status(200).json({
  success: true, data,
  meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
  error: null,
});

// GET /api/v1/weather/current
router.get('/current', async (req, res) => {
  const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
  const lon = parseFloat(req.query.lon) || DEFAULT_LON;

  const data = await weatherService.getCurrentConditions(lat, lon);
  respond(res, req, data);
});

// GET /api/v1/weather/forecast
router.get('/forecast', async (req, res) => {
  const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
  const lon = parseFloat(req.query.lon) || DEFAULT_LON;

  const data = await weatherService.getForecast(lat, lon);
  respond(res, req, data);
});

module.exports = router;
