// Smart-Fleet IoT — Map View Component
// TanQHoang © 2026
// Google Maps embed via iframe. For richer interactivity, upgrade to Maps JS SDK.

import { useState } from 'react';
import axiosClient from '@/api/axiosClient';

export function MapView({ vehicleId }) {
  const [origin, setOrigin]       = useState('');
  const [destination, setDest]    = useState('');
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const DEFAULT_CENTER = '10.8231,106.6297'; // Ho Chi Minh City

  const mapSrc = routeData
    ? `https://www.google.com/maps/embed/v1/directions?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&origin=${origin}&destination=${destination}&mode=driving`
    : `https://www.google.com/maps/embed/v1/view?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&center=${DEFAULT_CENTER}&zoom=12`;

  async function handleOptimize(e) {
    e.preventDefault();
    if (!origin || !destination) return;

    setLoading(true);
    setError(null);
    try {
      const { data } = await axiosClient.get('/routes/optimize', {
        params: { origin, destination, vehicleId },
      });
      setRouteData(data.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Route optimization failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-fleet-surface border border-fleet-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-fleet-border">
        <h3 className="text-sm font-semibold text-fleet-text mb-3">Route Optimizer</h3>
        <form onSubmit={handleOptimize} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Origin (lat,lon)"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent"
          />
          <input
            type="text"
            placeholder="Destination (lat,lon)"
            value={destination}
            onChange={(e) => setDest(e.target.value)}
            className="bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-fleet-accent hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
          >
            {loading ? 'Optimizing…' : 'Optimize Route'}
          </button>
        </form>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        {routeData && (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm font-bold text-fleet-text">{routeData.distanceKm} km</p>
              <p className="text-xs text-fleet-muted">Distance</p>
            </div>
            <div>
              <p className="text-sm font-bold text-fleet-text">{routeData.durationMin} min</p>
              <p className="text-xs text-fleet-muted">Duration</p>
            </div>
            <div>
              <p className="text-sm font-bold text-fleet-text">×{routeData.loadFactor}</p>
              <p className="text-xs text-fleet-muted">Load factor</p>
            </div>
          </div>
        )}
      </div>

      <iframe
        title="Route Map"
        src={mapSrc}
        className="w-full h-64 border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
