// Smart-Fleet IoT — Weather Widget
// TanQHoang © 2026

import { useWeather } from '@/hooks/useWeather';

const MULTIPLIER_LABEL = {
  1.00: { text: 'Normal wear', color: 'text-green-400' },
  0.90: { text: '+10% wear',   color: 'text-yellow-400' },
  0.80: { text: '+20% wear',   color: 'text-yellow-500' },
  0.70: { text: '+30% wear',   color: 'text-orange-400' },
  0.60: { text: '+40% wear',   color: 'text-red-400' },
};

function getMultiplierLabel(multiplier) {
  const key = Object.keys(MULTIPLIER_LABEL)
    .map(Number)
    .sort((a, b) => b - a)
    .find((k) => multiplier >= k);
  return MULTIPLIER_LABEL[key] || { text: 'Elevated wear', color: 'text-orange-400' };
}

function formatDay(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
}

export function WeatherWidget({ lat, lon }) {
  const { current, forecast, loading, error } = useWeather(lat, lon);

  if (loading) {
    return (
      <div className="bg-fleet-surface border border-fleet-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-fleet-border rounded w-3/4 mb-2" />
        <div className="h-8 bg-fleet-border rounded w-1/2" />
      </div>
    );
  }

  if (error || !current) {
    return (
      <div className="bg-fleet-surface border border-fleet-border rounded-xl p-4">
        <p className="text-fleet-muted text-sm">Weather unavailable</p>
      </div>
    );
  }

  const multiplierLabel = getMultiplierLabel(current.humidityMultiplier);

  return (
    <div className="bg-fleet-surface border border-fleet-border rounded-xl p-4 space-y-3">
      {/* Current conditions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fleet-text">Weather Conditions</h3>
        <span className="text-xs text-fleet-muted">{current.city}</span>
      </div>

      <div className="flex items-center gap-4">
        {current.icon && (
          <img
            src={`https://openweathermap.org/img/wn/${current.icon}@2x.png`}
            alt={current.condition}
            className="w-12 h-12"
          />
        )}
        <div>
          <p className="text-2xl font-bold text-fleet-text">{Math.round(current.temperature)}°C</p>
          <p className="text-sm text-fleet-muted">{current.condition}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xl font-bold text-fleet-accent">{current.humidity}%</p>
          <p className="text-xs text-fleet-muted">Humidity</p>
        </div>
      </div>

      <div className="pt-2 border-t border-fleet-border flex items-center justify-between">
        <span className="text-xs text-fleet-muted">Wear multiplier</span>
        <span className={`text-xs font-semibold ${multiplierLabel.color}`}>
          ×{current.humidityMultiplier.toFixed(2)} — {multiplierLabel.text}
        </span>
      </div>

      {/* 5-day forecast */}
      {forecast && forecast.length > 0 && (
        <div className="pt-2 border-t border-fleet-border">
          <p className="text-xs text-fleet-muted mb-2">5-Day Forecast</p>
          <div className="grid grid-cols-5 gap-1">
            {forecast.slice(0, 5).map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-xs text-fleet-muted">{formatDay(day.date)}</span>
                {day.icon && (
                  <img
                    src={`https://openweathermap.org/img/wn/${day.icon}.png`}
                    alt={day.condition}
                    className="w-8 h-8"
                  />
                )}
                <span className="text-xs font-semibold text-fleet-text">{Math.round(day.tempMax)}°</span>
                <span className="text-xs text-fleet-accent">{day.humidity}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
