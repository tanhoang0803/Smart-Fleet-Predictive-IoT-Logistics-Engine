// Smart-Fleet IoT — Server Entry Point
// TanQHoang © 2026

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('express-async-errors');

const { validateEnv } = require('./src/utils/validateEnv');
validateEnv(); // Fail fast if any required env var is missing

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');

const logger = require('./src/utils/logger');

// Route imports
const authRoutes = require('./src/controllers/authController');
const fleetRoutes = require('./src/controllers/fleetController');
const maintenanceRoutes = require('./src/controllers/maintenanceController');
const weatherRoutes = require('./src/controllers/weatherController');
const routeRoutes = require('./src/controllers/routeController');
const notificationRoutes = require('./src/controllers/notificationController');

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));

// ─── Request Middleware ───────────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Attach requestId to every request
app.use((req, _res, next) => {
  req.requestId = uuidv4();
  next();
});

// ─── Health Check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/fleet', fleetRoutes);
app.use('/api/v1/maintenance', maintenanceRoutes);
app.use('/api/v1/weather', weatherRoutes);
app.use('/api/v1/routes', routeRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
  });
});

// ─── Global Error Handler ────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  logger.error(`[${req.requestId}] ${err.message}`, { stack: err.stack });

  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';

  res.status(status).json({
    success: false,
    data: null,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId },
    error: {
      code,
      message: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : err.message,
      details: err.details || {},
    },
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Smart-Fleet API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app; // For testing with supertest
