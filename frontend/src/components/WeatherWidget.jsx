// Smart-Fleet IoT — Weather Widget
// TanQHoang © 2026

import { useWeather } from '@/hooks/useWeather';

const MULTIPLIER_LABEL = {
  1.00: { text: 'Normal wear',  color: 'text-emerald-400' },
  0.90: { text: '+10% wear',    color: 'text-yellow-400' },
  0.80: { text: '+20% wear',    color: 'text-yellow-500' },
  0.70: { text: '+30% wear',    color: 'text-orange-400' },
  0.60: { text: '+40% wear',    color: 'text-red-400' },
};

function getMultiplierLabel(multiplier) {
  const key = Object.keys(MULTIPLIER_LABEL)
    .map(Number)
    .sort((a, b) => b - a)
    .find((k) => multiplier >= k);
  return MULTIPLIER_LABEL[key] || { text: 'Elevated wear', color: 'text-orange-400' };
}

function formatDay(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

function formatFullDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(unix) {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function titleCase(str) {
  return str ? str.replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

function StatCard({ icon, value, label }) {
  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
      <span className="text-2xl leading-none">{icon}</span>
      <div>
        <p className="text-sm font-bold text-white leading-tight">{value}</p>
        <p className="text-xs text-blue-200">{label}</p>
      </div>
    </div>
  );
}

export function WeatherWidget({ lat, lon }) {
  const { current, forecast, loading, error } = useWeather(lat, lon);

  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #2563eb 100%)' }}>
        <div className="p-6 space-y-4">
          <div className="h-5 bg-white/10 rounded w-1/3" />
          <div className="h-16 bg-white/10 rounded w-1/2" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-white/10 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !current) {
    return (
      <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #2563eb 100%)' }}>
        <p className="text-blue-200 text-sm">Weather unavailable</p>
      </div>
    );
  }

  const multiplierLabel = getMultiplierLabel(current.humidityMultiplier);
  const cityLabel = [current.city, current.country].filter(Boolean).join(', ');

  const stats = [
    { icon: '💧', value: `${current.humidity}%`,                      label: 'Humidity' },
    { icon: '🌬️', value: `${current.windSpeed ?? '—'} km/h`,          label: 'Wind Speed' },
    { icon: '👁️',  value: `${current.visibility ?? '—'} km`,          label: 'Visibility' },
    { icon: '🔵', value: `${current.pressure ?? '—'} hPa`,            label: 'Pressure' },
    { icon: '🌅', value: formatTime(current.sunrise),                  label: 'Sunrise' },
    { icon: '🌇', value: formatTime(current.sunset),                   label: 'Sunset' },
  ];

  return (
    <div className="space-y-3">

      {/* Main weather card */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a3a6b 0%, #1e56c4 100%)' }}>
        <div className="p-5 space-y-4">

          {/* City + date */}
          <div>
            <h3 className="text-lg font-bold text-white">{cityLabel}</h3>
            <p className="text-sm text-blue-200">{formatFullDate()}</p>
          </div>

          {/* Temperature + icon */}
          <div className="flex items-center gap-4">
            {current.icon && (
              <img
                src={`https://openweathermap.org/img/wn/${current.icon}@2x.png`}
                alt={current.condition}
                className="w-20 h-20 drop-shadow-lg"
              />
            )}
            <div>
              <p className="text-6xl font-bold text-white leading-none">{Math.round(current.temperature)}°C</p>
              <p className="text-base font-semibold text-white mt-1">{titleCase(current.description || current.condition)}</p>
              {current.feelsLike != null && (
                <p className="text-sm text-blue-200">Feels like {current.feelsLike}°C</p>
              )}
            </div>
          </div>

          {/* Stats grid 3×2 */}
          <div className="grid grid-cols-3 gap-2">
            {stats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>

          {/* Wear multiplier */}
          <div className="flex items-center justify-between pt-1 border-t border-white/10">
            <span className="text-xs text-blue-200">Wear multiplier</span>
            <span className={`text-xs font-bold ${multiplierLabel.color}`}>
              ×{current.humidityMultiplier.toFixed(2)} — {multiplierLabel.text}
            </span>
          </div>
        </div>
      </div>

      {/* 5-day forecast card */}
      {forecast && forecast.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #16305a 0%, #1a4a9e 100%)' }}>
          <div className="p-5">
            <p className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-4">5-Day Forecast</p>
            <div className="grid grid-cols-5 gap-2">
              {forecast.slice(0, 5).map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1 bg-white/10 rounded-xl py-3 px-1">
                  <span className="text-xs font-semibold text-blue-200">{formatDay(day.date)}</span>
                  {day.icon ? (
                    <img
                      src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`}
                      alt={day.condition}
                      className="w-10 h-10"
                    />
                  ) : (
                    <span className="text-2xl">🌤️</span>
                  )}
                  <span className="text-xs font-bold text-white text-center leading-tight">
                    {day.maxTemp}° / {day.minTemp}°
                  </span>
                  <span className="text-xs text-blue-200 text-center leading-tight">
                    {titleCase(day.description || day.condition)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
