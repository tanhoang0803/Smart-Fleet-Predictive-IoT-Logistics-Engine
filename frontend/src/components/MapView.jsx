// Smart-Fleet IoT — Map View Component
// TanQHoang © 2026
// Leaflet + OpenStreetMap (free, no API key) + haversine routing

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchVehicleStatus, updateMileage, selectStatusByVehicleId } from '@/redux/fleetSlice';
import axiosClient from '@/api/axiosClient';

let L = null;
const HCM_CENTER = [10.7769, 106.7009];

export function MapView({ vehicleId, vehicle }) {
  const dispatch   = useDispatch();
  const statusMap  = useSelector(selectStatusByVehicleId);
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const routeLayer = useRef(null);

  const [origin, setOrigin]         = useState('');
  const [destination, setDest]      = useState('');
  const [routeData, setRouteData]   = useState(null);
  const [loading, setLoading]       = useState(false);
  const [accepting, setAccepting]   = useState(false);
  const [accepted, setAccepted]     = useState(false);
  const [error, setError]           = useState(null);

  // Current mileage from Redux (stays fresh after updates)
  const currentMileage = statusMap[vehicleId]?.vehicle?.mileage_current ?? vehicle?.mileage_current ?? 0;
  const newMileage     = routeData ? currentMileage + Math.ceil(routeData.distanceKm) : null;

  // Init Leaflet map once
  useEffect(() => {
    if (leafletMap.current) return;
    import('leaflet').then((leaflet) => {
      L = leaflet.default;
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
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    };
  }, []);

  function drawRoute(oLat, oLon, dLat, dLon) {
    if (!leafletMap.current || !L) return;
    if (routeLayer.current) routeLayer.current.remove();
    const oMarker = L.marker([oLat, oLon]).addTo(leafletMap.current).bindPopup('Origin');
    const dMarker = L.marker([dLat, dLon]).addTo(leafletMap.current).bindPopup('Destination');
    const line    = L.polyline([[oLat, oLon], [dLat, dLon]], { color: '#3b82f6', weight: 3, dashArray: '6 4' }).addTo(leafletMap.current);
    routeLayer.current = L.layerGroup([oMarker, dMarker, line]);
    leafletMap.current.fitBounds([[oLat, oLon], [dLat, dLon]], { padding: [40, 40] });
  }

  async function optimize() {
    if (!origin || !destination) return;
    const [oLat, oLon] = origin.split(',').map(Number);
    const [dLat, dLon] = destination.split(',').map(Number);
    if ([oLat, oLon, dLat, dLon].some(isNaN))
      throw new Error('Enter coordinates as: lat,lon (e.g. 10.776,106.700)');

    const { data } = await axiosClient.get('/routes/optimize', {
      params: { origin: `${oLat},${oLon}`, destination: `${dLat},${dLon}`, vehicleId },
    });
    drawRoute(oLat, oLon, dLat, dLon);
    return data.data;
  }

  async function handleOptimize(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAccepted(false);
    try {
      const result = await optimize();
      setRouteData(result);
      if (vehicleId) dispatch(fetchVehicleStatus(vehicleId));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Route optimization failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    setAccepted(false);
    try {
      const result = await optimize();
      setRouteData(result);
      if (vehicleId) dispatch(fetchVehicleStatus(vehicleId));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Refresh failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!vehicleId || !routeData) return;
    setAccepting(true);
    setError(null);
    try {
      // Add route distance to current mileage
      await dispatch(updateMileage({ vehicleId, mileageCurrent: newMileage }));
      // Recalculate maintenance schedule with updated km + load factor
      await dispatch(fetchVehicleStatus(vehicleId));
      setAccepted(true);
      setRouteData(null); // clear after accepting
    } catch (err) {
      setError('Failed to update mileage. Try again.');
    } finally {
      setAccepting(false);
    }
  }

  const field = 'bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent';

  return (
    <div className="bg-fleet-surface border border-fleet-border rounded-xl overflow-hidden">
      <div className="p-4 border-b border-fleet-border space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fleet-text">Route Optimizer</h3>
          {vehicle && (
            <span className="text-xs bg-fleet-accent/10 text-fleet-accent border border-fleet-accent/30 rounded-lg px-2 py-1">
              {vehicle.model} · {currentMileage?.toLocaleString()} km
            </span>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleOptimize} className="flex flex-col gap-2">
          <input className={field} placeholder="Origin (lat,lon) e.g. 10.776,106.700"
            value={origin} onChange={(e) => { setOrigin(e.target.value); setRouteData(null); setAccepted(false); }} />
          <input className={field} placeholder="Destination (lat,lon) e.g. 10.823,106.629"
            value={destination} onChange={(e) => { setDest(e.target.value); setRouteData(null); setAccepted(false); }} />
          <button type="submit" disabled={loading}
            className="bg-fleet-accent hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2 transition-colors">
            {loading ? 'Calculating…' : 'Optimize Route'}
          </button>
        </form>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {/* Accepted confirmation */}
        {accepted && (
          <div className="bg-green-500/10 border border-green-500/40 rounded-lg px-3 py-2">
            <p className="text-green-400 text-xs font-semibold">✓ Route accepted — mileage updated to {newMileage?.toLocaleString()} km. Maintenance schedule recalculated.</p>
          </div>
        )}

        {/* Route results */}
        {routeData && (
          <>
            <div className="grid grid-cols-4 gap-2 text-center pt-1">
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

            {/* Mileage preview */}
            <div className="flex items-center justify-between bg-fleet-bg rounded-lg px-3 py-2 text-xs">
              <span className="text-fleet-muted">Mileage after route</span>
              <span className="text-fleet-text font-semibold">
                {currentMileage?.toLocaleString()} → <span className="text-fleet-accent">{newMileage?.toLocaleString()} km</span>
              </span>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleRefresh} disabled={loading}
                className="border border-fleet-border hover:border-fleet-accent text-fleet-muted hover:text-fleet-text text-sm font-semibold rounded-lg py-2 transition-colors disabled:opacity-50">
                {loading ? 'Refreshing…' : '↺ Refresh Route'}
              </button>
              <button onClick={handleAccept} disabled={accepting}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2 transition-colors">
                {accepting ? 'Applying…' : '✓ Accept Route'}
              </button>
            </div>
          </>
        )}
      </div>

      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: '320px', width: '100%' }} />
    </div>
  );
}
