// Smart-Fleet IoT — Maintenance Gauge (SVG arc)
// TanQHoang © 2026

const STATUS_COLOR = {
  NORMAL:   '#22c55e',
  WARNING:  '#eab308',
  CRITICAL: '#f97316',
  OVERDUE:  '#ef4444',
};

const RADIUS = 40;
const CIRCUMFERENCE = Math.PI * RADIUS; // Half-circle arc


export function MaintenanceGauge({ component, percentRemaining, status, adjustedIntervalKm, kmRemaining }) {
  const clampedPct = Math.min(100, Math.max(0, percentRemaining));
  const color = STATUS_COLOR[status] || STATUS_COLOR.NORMAL;

  // Arc length representing remaining percentage of a semicircle
  const fillLength = (clampedPct / 100) * CIRCUMFERENCE;
  const label = component?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex flex-col items-center gap-1 bg-fleet-surface border border-fleet-border rounded-xl p-4 w-full">
      <svg viewBox="0 0 100 60" className="w-full max-w-[140px]">
        {/* Track */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="#334155"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${fillLength} ${CIRCUMFERENCE}`}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.3s ease' }}
        />
        {/* Percentage text */}
        <text x="50" y="46" textAnchor="middle" fontSize="14" fontWeight="bold" fill={color}>
          {status === 'OVERDUE' ? 'DUE' : `${Math.round(clampedPct)}%`}
        </text>
      </svg>

      <p className="text-xs font-semibold text-fleet-text text-center leading-tight">{label}</p>

      <div className="flex items-center gap-1 mt-0.5">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-fleet-muted">{status}</span>
      </div>

      {status !== 'OVERDUE' && (
        <p className="text-xs text-fleet-muted">
          {kmRemaining?.toLocaleString()} km left
        </p>
      )}

      <p className="text-xs text-fleet-muted opacity-60">
        Interval: {adjustedIntervalKm?.toLocaleString()} km
      </p>
    </div>
  );
}
