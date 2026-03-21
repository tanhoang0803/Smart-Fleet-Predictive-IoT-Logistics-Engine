// Smart-Fleet IoT — Predictive Maintenance Service Tests
// TanQHoang © 2026

const {
  calculateAdjustedInterval,
  getAlertStatus,
  getFuelMultiplier,
  BASE_INTERVALS,
} = require('./maintenanceService');

// ─── getFuelMultiplier ────────────────────────────────────────────────────────
describe('getFuelMultiplier', () => {
  test('RON95 returns 1.00', () => expect(getFuelMultiplier('RON95')).toBe(1.00));
  test('E10 returns 0.90',   () => expect(getFuelMultiplier('E10')).toBe(0.90));
  test('E5 returns 0.95',    () => expect(getFuelMultiplier('E5')).toBe(0.95));
  test('RON92 returns 0.95', () => expect(getFuelMultiplier('RON92')).toBe(0.95));
  test('unknown fuel defaults to E10 (0.90)', () => expect(getFuelMultiplier('UNKNOWN')).toBe(0.90));
});

// ─── calculateAdjustedInterval ───────────────────────────────────────────────
describe('calculateAdjustedInterval', () => {
  test('no humidity or load pressure → returns base interval', () => {
    const result = calculateAdjustedInterval('engine_oil', 2000, 1.0, 'RON95', 1.0);
    expect(result).toBe(2000);
  });

  test('monsoon season (H=0.60) + E10 (F=0.90) + heavy load (L=0.80) → ~864 km', () => {
    const result = calculateAdjustedInterval('engine_oil', 2000, 0.60, 'E10', 0.80);
    expect(result).toBe(864); // 2000 × 0.60 × 0.90 × 0.80
  });

  test('spark plug is humidity-exempt — H multiplier not applied', () => {
    const withHumidity    = calculateAdjustedInterval('spark_plug', 8000, 0.60, 'E10', 1.0);
    const withoutHumidity = calculateAdjustedInterval('spark_plug', 8000, 1.00, 'E10', 1.0);
    expect(withHumidity).toBe(withoutHumidity); // same result
    expect(withHumidity).toBe(7200); // 8000 × 0.90 (E10 only)
  });

  test('drive chain — fuel multiplier NOT applied', () => {
    const chainE10   = calculateAdjustedInterval('drive_chain', 500, 0.80, 'E10', 1.0);
    const chainRON95 = calculateAdjustedInterval('drive_chain', 500, 0.80, 'RON95', 1.0);
    expect(chainE10).toBe(chainRON95); // fuel doesn't affect chain
    expect(chainE10).toBe(400); // 500 × 0.80
  });

  test('minimum floor prevents interval below 45% of base', () => {
    // Worst case: H=0.60, F=0.90, L=0.75 → 0.405 → capped at 0.45
    const result = calculateAdjustedInterval('engine_oil', 2000, 0.60, 'E10', 0.75);
    const minimum = Math.round(2000 * 0.45);
    expect(result).toBeGreaterThanOrEqual(minimum);
  });

  test('all base intervals are defined', () => {
    const components = ['engine_oil','air_filter','spark_plug','drive_chain','brake_pads','brake_shoes','fuel_filter','transmission_fluid'];
    components.forEach((c) => expect(BASE_INTERVALS[c]).toBeGreaterThan(0));
  });
});

// ─── getAlertStatus ───────────────────────────────────────────────────────────
describe('getAlertStatus', () => {
  const interval = 2000;

  test('NORMAL when > 20% remaining', () => {
    expect(getAlertStatus(0, 2000, interval, 60, 0)).toBe('NORMAL');
    expect(getAlertStatus(1500, 2000, interval, 60, 0)).toBe('NORMAL'); // 25% left
  });

  test('WARNING when 10–20% remaining', () => {
    expect(getAlertStatus(1700, 2000, interval, 60, 0)).toBe('WARNING'); // 15% left
  });

  test('CRITICAL when < 10% remaining', () => {
    expect(getAlertStatus(1950, 2000, interval, 60, 0)).toBe('CRITICAL'); // 2.5% left
  });

  test('OVERDUE when current >= due', () => {
    expect(getAlertStatus(2000, 2000, interval, 60, 0)).toBe('OVERDUE');
    expect(getAlertStatus(2500, 2000, interval, 60, 0)).toBe('OVERDUE');
  });

  test('CRITICAL override when humidity >= 85% sustained for 72h', () => {
    // Even with 50% remaining, sustained high humidity triggers CRITICAL
    expect(getAlertStatus(1000, 2000, interval, 88, 72)).toBe('CRITICAL');
  });

  test('no override when humidity is high but not sustained 72h', () => {
    expect(getAlertStatus(1000, 2000, interval, 88, 24)).toBe('NORMAL');
  });
});
