// Smart-Fleet IoT — Predictive Maintenance Service (CORE)
// TanQHoang © 2026
//
// ⚠️  MECHANIC-PRO ZONE ⚠️
// Any changes to base intervals, multipliers, or alert thresholds
// MUST be reviewed by the mechanic-pro agent and tagged: # mechanic-pro-reviewed
// See: .claude/agents/mechanic-pro.md

const weatherService = require('./weatherService');
const routeService = require('./routeService');
const notificationService = require('./notificationService');
const maintenanceModel = require('../models/maintenanceModel');
const vehicleModel = require('../models/vehicleModel');
const userModel = require('../models/userModel');
const logger = require('../utils/logger');

// ─── Base Intervals (Honda Wave RSX) ────────────────────────────────────────
// Source: Honda Wave RSX Service Manual (2020 edition) p.47–52
// mechanic-pro-reviewed
const BASE_INTERVALS = {
  engine_oil:          2000,  // km — mineral oil. Source: Honda service manual p.47
  air_filter:          3000,  // km — wet/foam type. Source: Honda service manual p.49
  spark_plug:          8000,  // km — standard NGK CPR6EA-9. Source: Honda service manual p.50
  drive_chain:         500,   // km — inspection/lube interval (wet season). Source: manual p.51
  brake_pads:          15000, // km — front disc. Source: Honda service manual p.52
  brake_shoes:         20000, // km — rear drum. Source: Honda service manual p.52
  fuel_filter:         12000, // km — PGM-FI models. Source: Honda service manual p.48
  transmission_fluid:  8000,  // km — CVT variants. Source: Honda service manual p.53
};

// Components where humidity multiplier does NOT apply (sealed systems)
// Source: .claude/skills/environmental-logic.md — Component-Multiplier Matrix
// mechanic-pro-reviewed
const HUMIDITY_EXEMPT = new Set(['spark_plug', 'fuel_filter', 'transmission_fluid']);

// Components where fuel multiplier applies
// Source: .claude/skills/environmental-logic.md
// mechanic-pro-reviewed
const FUEL_APPLIES_TO = new Set(['engine_oil', 'air_filter', 'spark_plug', 'fuel_filter']);

// Components where load factor applies
// Source: .claude/skills/environmental-logic.md
// mechanic-pro-reviewed
const LOAD_APPLIES_TO = new Set(['engine_oil', 'drive_chain', 'brake_pads', 'brake_shoes', 'transmission_fluid']);

// Minimum cap: never reduce below 45% of base interval (safety floor)
// Source: .claude/skills/environmental-logic.md
// mechanic-pro-reviewed
const MIN_MULTIPLIER_FLOOR = 0.45;

// ─── Fuel Multiplier ─────────────────────────────────────────────────────────
// Source: Vietnam national E10 fuel standard (QCVN 1:2015/BKHCN)
// mechanic-pro-reviewed
function getFuelMultiplier(fuelType) {
  const multipliers = { RON95: 1.00, RON92: 0.95, E5: 0.95, E10: 0.90 };
  return multipliers[fuelType] ?? 0.90; // Default E10 for Vietnam market
}

// ─── Alert Status ─────────────────────────────────────────────────────────────
// Source: .claude/skills/environmental-logic.md
// mechanic-pro-reviewed
function getAlertStatus(kmCurrent, kmDue, adjustedInterval, humidity, sustainedHumidityHours = 0) {
  if (kmCurrent >= kmDue) return 'OVERDUE';
  if (humidity >= 85 && sustainedHumidityHours >= 72) return 'CRITICAL'; // humidity override
  const percentRemaining = ((kmDue - kmCurrent) / adjustedInterval) * 100;
  if (percentRemaining < 10) return 'CRITICAL';
  if (percentRemaining < 20) return 'WARNING';
  return 'NORMAL';
}

// ─── Core: Adjusted Interval ──────────────────────────────────────────────────
// Formula: Base × H × F × L (capped at Base × 0.45 minimum)
// Source: .claude/skills/environmental-logic.md — Master Formula
// mechanic-pro-reviewed
function calculateAdjustedInterval(component, baseKm, humidityMultiplier, fuelType, loadFactor) {
  let multiplier = 1.0;

  if (!HUMIDITY_EXEMPT.has(component)) {
    multiplier *= humidityMultiplier;
  }
  if (FUEL_APPLIES_TO.has(component)) {
    multiplier *= getFuelMultiplier(fuelType);
  }
  if (LOAD_APPLIES_TO.has(component)) {
    multiplier *= loadFactor;
  }

  // Apply safety floor
  const effectiveMultiplier = Math.max(multiplier, MIN_MULTIPLIER_FLOOR);
  return Math.round(baseKm * effectiveMultiplier);
}

// ─── Main: Recalculate Full Schedule for a Vehicle ────────────────────────────
const maintenanceService = {
  async recalculateSchedule(vehicleId, ownerId) {
    const vehicle = await vehicleModel.findById(vehicleId, ownerId);
    if (!vehicle) {
      const err = new Error('Vehicle not found.');
      err.status = 404;
      err.code = 'VEHICLE_NOT_FOUND';
      throw err;
    }

    const lat = vehicle.lat || parseFloat(process.env.OPENWEATHER_DEFAULT_LAT);
    const lon = vehicle.lon || parseFloat(process.env.OPENWEATHER_DEFAULT_LON);

    // Fetch weather and route data in parallel
    const [weatherData, loadFactor, sustainedHumidity] = await Promise.all([
      weatherService.getCurrentConditions(lat, lon),
      routeService.getLatestLoadFactor(vehicleId),
      weatherService.checkSustainedHighHumidity(lat, lon),
    ]);

    const { humidityMultiplier, humidity } = weatherData;
    const schedule = [];

    for (const [component, baseKm] of Object.entries(BASE_INTERVALS)) {
      const lastLog = await maintenanceModel.findLastLog(vehicleId, component);
      const lastServicedKm = lastLog?.mileage_at_service ?? 0;

      const adjustedIntervalKm = calculateAdjustedInterval(
        component, baseKm, humidityMultiplier, vehicle.fuel_type, loadFactor
      );

      const kmDue = lastServicedKm + adjustedIntervalKm;
      const alertStatus = getAlertStatus(
        vehicle.mileage_current, kmDue, adjustedIntervalKm,
        humidity, sustainedHumidity.sustained ? 72 : 0
      );

      const row = await maintenanceModel.upsertSchedule({
        vehicleId,
        component,
        lastServicedKm,
        baseIntervalKm: baseKm,
        adjustedIntervalKm,
        kmDue,
        alertStatus,
        humidityAtCalc: humidity,
      });

      schedule.push({
        component,
        baseIntervalKm: baseKm,
        adjustedIntervalKm,
        kmDue,
        kmRemaining: Math.max(0, kmDue - vehicle.mileage_current),
        percentRemaining: Math.max(0, Math.round(((kmDue - vehicle.mileage_current) / adjustedIntervalKm) * 100)),
        alertStatus,
      });

      // Trigger notification for critical/overdue
      if (alertStatus === 'CRITICAL' || alertStatus === 'OVERDUE') {
        const user = await userModel.findById(ownerId);
        if (user?.fcm_token) {
          notificationService.sendAlert(user.fcm_token, vehicle, component, alertStatus)
            .catch((e) => logger.error(`FCM send failed: ${e.message}`));
        }
      }
    }

    const worstStatus = schedule.reduce((worst, s) => {
      const order = { OVERDUE: 3, CRITICAL: 2, WARNING: 1, NORMAL: 0 };
      return order[s.alertStatus] > order[worst] ? s.alertStatus : worst;
    }, 'NORMAL');

    logger.info(`Schedule recalculated for vehicle ${vehicleId} — worst: ${worstStatus}`);

    return { vehicle, weather: weatherData, schedule, worstStatus };
  },

  // Exposed for testing
  calculateAdjustedInterval,
  getAlertStatus,
  getFuelMultiplier,
  BASE_INTERVALS,
};

module.exports = maintenanceService;
