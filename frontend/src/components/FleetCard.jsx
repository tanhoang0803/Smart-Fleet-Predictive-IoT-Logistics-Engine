// Smart-Fleet IoT — Fleet Card Component
// TanQHoang © 2026

import { useDispatch } from 'react-redux';
import { selectVehicle } from '@/redux/fleetSlice';

const STATUS_CONFIG = {
  NORMAL:   { dot: 'bg-green-500',  text: 'text-green-400',  label: 'Normal'   },
  WARNING:  { dot: 'bg-yellow-500', text: 'text-yellow-400', label: 'Warning'  },
  CRITICAL: { dot: 'bg-orange-500', text: 'text-orange-400', label: 'Critical' },
  OVERDUE:  { dot: 'bg-red-500',    text: 'text-red-400',    label: 'Overdue'  },
};

export function FleetCard({ vehicle, alertStatus = 'NORMAL', onSelect }) {
  const dispatch = useDispatch();
  const cfg = STATUS_CONFIG[alertStatus] || STATUS_CONFIG.NORMAL;

  function handleClick() {
    dispatch(selectVehicle(vehicle.id));
    onSelect?.(vehicle.id);
  }

  return (
    <button
      onClick={handleClick}
      className="w-full text-left bg-fleet-surface border border-fleet-border hover:border-fleet-accent rounded-xl p-4 transition-colors duration-150"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-fleet-text">{vehicle.model}</p>
          {vehicle.plate_number && (
            <p className="text-xs text-fleet-muted mt-0.5">{vehicle.plate_number}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse-slow`} />
          <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div>
          <p className="text-xl font-bold text-fleet-text">
            {vehicle.mileage_current?.toLocaleString()}
            <span className="text-xs text-fleet-muted font-normal ml-1">km</span>
          </p>
          <p className="text-xs text-fleet-muted">Current mileage</p>
        </div>

        <div className="text-right">
          <p className="text-xs text-fleet-muted">{vehicle.fuel_type || 'E10'}</p>
          <p className="text-xs text-fleet-muted opacity-60">Fuel</p>
        </div>
      </div>
    </button>
  );
}
