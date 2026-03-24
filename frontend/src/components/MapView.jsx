// Smart-Fleet IoT — Map View Component
// TanQHoang © 2026
// Leaflet + OpenStreetMap (free, no API key) + OSRM routing (free public API)

import { useState, useEffect, useRef } from 'react';
import axiosClient from '@/api/axiosClient';

// Leaflet loaded dynamically to avoid SSR issues with Vite
let L = null;

const HCM_CENTER = [10.7769, 106.7009]; // District 1, Ho Chi Minh City

export function MapView({ vehicleId }) {
  const mapRef      = useRef(null);
  const leafletMap  = useRef(null);
  const routeLayer  = useRef(null);
  const [origin, setOrigin]       = useState('');
  const [destination, setDest]    = useState('');
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // Init Leaflet map once
  useEffect(() => {
    if (leafletMap.current) return;

    import('leaflet').then((leaflet) => {
      L = leaflet.default;

      // Fix default marker icons (Vite asset path issue)
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      leafletMap.current = L.map(mapRef.current).setView(HCM_CENTER, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(leafletMap.current);
    });

    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  async function handleOptimize(e) {
    e.preventDefault();
    if (!origin || !destination) return;

    setLoading(true);
    setError(null);

    try {
      const [oLat, oLon] = origin.split(',').map(Number);
      const [dLat, dLon] = destination.split(',').map(Number);

      if ([oLat, oLon, dLat, dLon].some(isNaN)) {
        throw new Error('Enter coordinates as: lat,lon (e.g. 10.776,106.700)');
      }

      // Backend route optimization (now uses OSRM)
      const { data } = await axiosClient.get('/routes/optimize', {
        params: { origin: `${oLat},${oLon}`, destination: `${dLat},${dLon}`, vehicleId },
      });
      setRouteData(data.data);

      // Draw on map
      if (leafletMap.current && L) {
        if (routeLayer.current) routeLayer.current.remove();

        const oMarker = L.marker([oLat, oLon]).addTo(leafletMap.current).bindPopup('Origin');
        const dMarker = L.marker([dLat, dLon]).addTo(leafletMap.current).bindPopup('Destination');
        const line    = L.polyline([[oLat, oLon], [dLat, dLon]], { color: '#3b82f6', weight: 3, dashArray: '6 4' }).addTo(leafletMap.current);

        routeLayer.current = L.layerGroup([oMarker, dMarker, line]);
        leafletMap.current.fitBounds([[oLat, oLon], [dLat, dLon]], { padding: [40, 40] });
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Route optimization failed.');
    } finally {
      setLoading(false);
    }
  }

  const field = 'bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent';

  return (
    <div className="bg-fleet-surface border border-fleet-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-fleet-border">
        <h3 className="text-sm font-semibold text-fleet-text mb-3">Route Optimizer</h3>
        <form onSubmit={handleOptimize} className="flex flex-col gap-2">
          <input className={field} placeholder="Origin (lat,lon) e.g. 10.776,106.700"
            value={origin} onChange={(e) => setOrigin(e.target.value)} />
          <input className={field} placeholder="Destination (lat,lon) e.g. 10.823,106.629"
            value={destination} onChange={(e) => setDest(e.target.value)} />
          <button type="submit" disabled={loading}
            className="bg-fleet-accent hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2 transition-colors">
            {loading ? 'Calculating…' : 'Optimize Route'}
          </button>
        </form>

        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

        {routeData && (
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
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
            <div>
              <p className="text-sm font-bold text-fleet-text">{routeData.fuelEstimateL} L</p>
              <p className="text-xs text-fleet-muted">Fuel est.</p>
            </div>
          </div>
        )}
      </div>

      {/* Leaflet map container — must import CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: '320px', width: '100%' }} />
    </div>
  );
}
