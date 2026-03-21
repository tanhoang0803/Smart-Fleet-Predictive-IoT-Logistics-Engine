// Smart-Fleet IoT — Alert Banner Component
// TanQHoang © 2026

import { useDispatch, useSelector } from 'react-redux';
import { dismissAlert, selectCriticalAlerts } from '@/redux/alertSlice';

const STATUS_CONFIG = {
  CRITICAL: { bg: 'bg-orange-500/10 border-orange-500', text: 'text-orange-400', icon: '⚠️', label: 'Critical' },
  OVERDUE:  { bg: 'bg-red-500/10 border-red-500',    text: 'text-red-400',    icon: '🚨', label: 'Overdue'  },
};

export function AlertBanner() {
  const dispatch = useDispatch();
  const alerts = useSelector(selectCriticalAlerts);

  if (!alerts.length) return null;

  return (
    <div className="space-y-2 mb-4 animate-fade-in">
      {alerts.map((alert) => {
        const cfg = STATUS_CONFIG[alert.status] || STATUS_CONFIG.CRITICAL;
        return (
          <div
            key={alert.id}
            className={`flex items-center justify-between px-4 py-3 rounded-lg border ${cfg.bg}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{cfg.icon}</span>
              <div>
                <p className={`text-sm font-semibold ${cfg.text}`}>
                  {cfg.label} — {alert.component?.replace('_', ' ')}
                </p>
                <p className="text-xs text-fleet-muted">
                  Vehicle {alert.vehicleId?.slice(-6)} · {new Date(alert.id).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => dispatch(dismissAlert(alert.id))}
              className="text-fleet-muted hover:text-fleet-text ml-4 text-lg leading-none"
              aria-label="Dismiss alert"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
