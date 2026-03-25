// Smart-Fleet IoT — Map View Component
// TanQHoang © 2026
// Leaflet + OpenStreetMap (free, no API key) + haversine routing + live weather

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchVehicleStatus, updateMileage, selectStatusByVehicleId } from '@/redux/fleetSlice';
import { fetchWeather, fetchForecast, setRouteLocation } from '@/redux/weatherSlice';
import axiosClient from '@/api/axiosClient';

let L = null;
const HCM_CENTER = [10.7769, 106.7009];

const CONDITION_ICON = {
  Clear: '☀️', Clouds: '☁️', Rain: '🌧️', Drizzle: '🌦️',
  Thunderstorm: '⛈️', Snow: '❄️', Mist: '🌫️', Fog: '🌫️', default: '🌡️',
};

const WARNING_STYLE = {
  CRITICAL: 'bg-red-500/10 border-red-500/40 text-red-400',
  WARNING:  'bg-yellow-500/10 border-yellow-500/40 text-yellow-400',
  INFO:     'bg-blue-500/10 border-blue-500/40 text-blue-400',
};

const COMPONENT_LABELS = {
  engine_oil: 'Engine Oil', air_filter: 'Air Filter', spark_plug: 'Spark Plug',
  drive_chain: 'Drive Chain', brake_pads: 'Brake Pads', brake_shoes: 'Brake Shoes',
  fuel_filter: 'Fuel Filter', transmission_fluid: 'Transmission Fluid',
};

// Haversine distance in km (client-side, no API needed)
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Query Overpass API for nearest gas station or repair shop near destination.
// Station must be >= 0.1 km from origin (real reachable location).
async function findNearestServiceStation(destLat, destLon, originLat, originLon) {
  const query = `[out:json][timeout:15];(
    node["amenity"="fuel"](around:10000,${destLat},${destLon});
    node["shop"="car_repair"](around:10000,${destLat},${destLon});
    node["amenity"="car_repair"](around:10000,${destLat},${destLon});
  );out body;`;
  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
    );
    const json = await res.json();
    if (!json.elements?.length) return null;

    const nearest = json.elements
      .filter((e) => e.lat && e.lon)
      .map((e) => {
        const isGas = e.tags?.amenity === 'fuel';
        return {
          lat: e.lat,
          lon: e.lon,
          name: e.tags?.name || (isGas ? 'Gas Station' : 'Repair Shop'),
          type: isGas ? 'Gas Station' : 'Repair Shop',
          distFromDest: +haversineKm(destLat, destLon, e.lat, e.lon).toFixed(2),
          distFromOrigin: +haversineKm(originLat, originLon, e.lat, e.lon).toFixed(2),
        };
      })
      // Must be at least 0.1 km from origin (real destination, not trivially same spot)
      .filter((e) => e.distFromOrigin >= 0.1)
      .sort((a, b) => a.distFromDest - b.distFromDest)[0];

    return nearest || null;
  } catch {
    return null;
  }
}

export function MapView({ vehicleId, vehicle }) {
  const dispatch   = useDispatch();
  const statusMap  = useSelector(selectStatusByVehicleId);
  const mapRef     = useRef(null);
  const leafletMap = useRef(null);
  const routeLayer = useRef(null);

  const [origin, setOrigin]             = useState('');
  const [destination, setDest]          = useState('');
  const [routeData, setRouteData]       = useState(null);
  const [loading, setLoading]           = useState(false);
  const [accepting, setAccepting]       = useState(false);
  const [accepted, setAccepted]         = useState(false);
  const [error, setError]               = useState(null);

  // Store original dest coords so we can search near them even after dest field changes
  const originalDestRef = useRef(null);

  // Maintenance alert state
  const [addResourcesAlerts, setAddResourcesAlerts] = useState([]); // CRITICAL, 0 < km < 10
  const [cannotDriveAlerts, setCannotDriveAlerts]   = useState([]); // OVERDUE, km <= 0
  const [overdueBlocked, setOverdueBlocked]         = useState(false);
  const [adjustedInfo, setAdjustedInfo]             = useState(null);
  const [findingStation, setFindingStation]         = useState(false);

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

  function drawRoute(oLat, oLon, dLat, dLon, destLabel) {
    if (!leafletMap.current || !L) return;
    if (routeLayer.current) routeLayer.current.remove();
    const oMarker = L.marker([oLat, oLon]).addTo(leafletMap.current).bindPopup('Origin');
    const dMarker = L.marker([dLat, dLon]).addTo(leafletMap.current)
      .bindPopup(destLabel || 'Destination');
    const line = L.polyline([[oLat, oLon], [dLat, dLon]], {
      color: '#3b82f6', weight: 3, dashArray: '6 4',
    }).addTo(leafletMap.current);
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
    drawRoute(oLat, oLon, dLat, dLon, 'Destination');
    return data.data;
  }

  function updateWeatherForOrigin() {
    const [oLat, oLon] = origin.split(',').map(Number);
    if (!isNaN(oLat) && !isNaN(oLon)) {
      dispatch(setRouteLocation({ lat: oLat, lon: oLon }));
      dispatch(fetchWeather({ lat: oLat, lon: oLon }));
      dispatch(fetchForecast({ lat: oLat, lon: oLon }));
    }
  }

  function resetToDefault() {
    setOrigin('');
    setDest('');
    setRouteData(null);
    setAccepted(false);
    setError(null);
    setAddResourcesAlerts([]);
    setCannotDriveAlerts([]);
    setOverdueBlocked(false);
    setAdjustedInfo(null);
    originalDestRef.current = null;
    if (routeLayer.current) { routeLayer.current.remove(); routeLayer.current = null; }
    if (leafletMap.current) leafletMap.current.setView(HCM_CENTER, 13);
    dispatch(setRouteLocation(null));
    dispatch(fetchWeather({}));
    dispatch(fetchForecast({}));
  }

  async function handleOptimize(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAccepted(false);
    setAddResourcesAlerts([]);
    setCannotDriveAlerts([]);
    setOverdueBlocked(false);
    setAdjustedInfo(null);

    // Capture original destination coords before any auto-adjustment
    const [oLat, oLon] = origin.split(',').map(Number);
    const [dLat, dLon] = destination.split(',').map(Number);
    originalDestRef.current = { lat: dLat, lon: dLon };

    try {
      const result = await optimize();
      setRouteData(result);
      updateWeatherForOrigin();

      if (vehicleId) {
        const statusAction = await dispatch(fetchVehicleStatus(vehicleId));
        const schedule = statusAction.payload?.status?.schedule || [];

        // CRITICAL with 0 < kmRemaining < 10 → "You have to add resources"
        const addRes = schedule.filter(
          (s) => s.alertStatus === 'CRITICAL' && s.kmRemaining > 0 && s.kmRemaining < 10
        );
        // OVERDUE (kmRemaining <= 0) → "You cannot drive this trip"
        const cannotDrive = schedule.filter(
          (s) => s.alertStatus === 'OVERDUE' || s.kmRemaining <= 0
        );

        setAddResourcesAlerts(addRes);
        setCannotDriveAlerts(cannotDrive);

        if (cannotDrive.length > 0) {
          setOverdueBlocked(true);
          setFindingStation(true);
          // Find service station near the ORIGINAL destination (not origin)
          const station = await findNearestServiceStation(
            dLat, dLon, oLat, oLon
          );
          setFindingStation(false);
          if (station) {
            setAdjustedInfo(station);
            setDest(`${station.lat.toFixed(6)},${station.lon.toFixed(6)}`);
            drawRoute(oLat, oLon, station.lat, station.lon, `${station.type}: ${station.name}`);
          }
        }
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Route optimization failed.');
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    resetToDefault();
  }

  async function handleAccept() {
    if (!vehicleId || !routeData || overdueBlocked) return;
    setAccepting(true);
    setError(null);
    try {
      await dispatch(updateMileage({ vehicleId, mileageCurrent: newMileage }));
      await dispatch(fetchVehicleStatus(vehicleId));
      setAccepted(true);
      resetToDefault();
    } catch {
      setError('Failed to update mileage. Try again.');
    } finally {
      setAccepting(false);
    }
  }

  const field = 'bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent';

  const w = routeData?.weather;
  const conditionIcon = w ? (CONDITION_ICON[w.condition] ?? CONDITION_ICON.default) : null;


  return (
    <div className="bg-fleet-surface border border-fleet-border rounded-xl overflow-hidden">

      {/* Top panel — form */}
      <div className="p-4 border-b border-fleet-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-fleet-text">Route Optimizer</h3>
          {vehicle && (
            <span className="text-xs bg-fleet-accent/10 text-fleet-accent border border-fleet-accent/30 rounded-lg px-2 py-1">
              {vehicle.model} · {currentMileage?.toLocaleString()} km
            </span>
          )}
        </div>

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
      </div>

      {/* Map */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: '320px', width: '100%' }} />

      {/* Below-map panel — appears after Optimize Route */}
      {(routeData || accepted) && (
        <div className="p-4 border-t border-fleet-border space-y-3">

          {/* ── OVERDUE: "You cannot drive this trip" ─────────────────── */}
          {cannotDriveAlerts.length > 0 && (
            <div className="border border-red-500/60 bg-red-500/10 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-base">🚫</span>
                <p className="text-red-400 text-xs font-bold uppercase tracking-wide">
                  You Cannot Drive This Trip
                </p>
              </div>
              <div className="space-y-1.5">
                {cannotDriveAlerts.map((s) => (
                  <div key={s.component} className="flex items-center justify-between text-xs bg-red-500/10 rounded-lg px-2 py-1.5">
                    <span className="text-red-300 font-semibold">
                      {COMPONENT_LABELS[s.component] ?? s.component}
                    </span>
                    <span className="text-red-400 font-bold">You cannot drive this trip</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CRITICAL < 10 km: "You have to add resources" ─────────── */}
          {addResourcesAlerts.length > 0 && (
            <div className="border border-orange-500/50 bg-orange-500/10 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-base">⚠️</span>
                <p className="text-orange-400 text-xs font-bold uppercase tracking-wide">
                  Critical — Add Resources Before Departure
                </p>
              </div>
              <div className="space-y-1.5">
                {addResourcesAlerts.map((s) => (
                  <div key={s.component} className="flex items-center justify-between text-xs bg-orange-500/10 rounded-lg px-2 py-1.5">
                    <span className="text-orange-300 font-semibold">
                      {COMPONENT_LABELS[s.component] ?? s.component}
                    </span>
                    <span className="text-orange-400 font-bold">
                      You have to add resources · {s.kmRemaining} km left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Destination adjusted notification ────────────────────── */}
          {adjustedInfo && (
            <div className="border border-blue-500/50 bg-blue-500/10 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-blue-400 text-base">📍</span>
                <p className="text-blue-300 text-xs font-bold uppercase tracking-wide">
                  Destination Adjusted
                </p>
              </div>
              <p className="text-blue-200 text-xs">
                Destination adjusted since does not meet the requirements.
              </p>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-blue-500/20">
                <span className="text-blue-300 font-semibold">
                  {adjustedInfo.type}: {adjustedInfo.name}
                </span>
                <span className="text-blue-400">{adjustedInfo.distFromDest} km from original destination</span>
              </div>
            </div>
          )}

          {/* Finding station loading indicator */}
          {findingStation && (
            <div className="flex items-center gap-2 text-xs text-fleet-muted">
              <div className="w-3 h-3 border border-fleet-accent border-t-transparent rounded-full animate-spin" />
              Finding nearest service station…
            </div>
          )}

          {/* Route stats */}
          {routeData && (
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-sm font-bold text-fleet-text">{routeData.distanceKm} km</p>
                <p className="text-xs text-fleet-muted">Distance</p>
              </div>
              <div>
                <p className="text-sm font-bold text-fleet-text">{routeData.durationMin} min</p>
                <p className="text-xs text-fleet-muted">Duration</p>
              </div>
              <div>
                <p className="text-sm font-bold text-fleet-text">×{routeData.weatherLoadFactor ?? routeData.loadFactor}</p>
                <p className="text-xs text-fleet-muted">Load factor</p>
              </div>
              <div>
                <p className="text-sm font-bold text-fleet-text">{routeData.adjustedFuelL ?? routeData.fuelEstimateL} L</p>
                <p className="text-xs text-fleet-muted">Fuel est.</p>
              </div>
            </div>
          )}

          {/* Mileage preview */}
          {routeData && (
            <div className="flex items-center justify-between bg-fleet-bg rounded-lg px-3 py-2 text-xs">
              <span className="text-fleet-muted">Mileage after route</span>
              <span className="text-fleet-text font-semibold">
                {currentMileage?.toLocaleString()} → <span className="text-fleet-accent">{newMileage?.toLocaleString()} km</span>
              </span>
            </div>
          )}

          {/* Weather at origin */}
          {routeData && w && (
            <div className="bg-fleet-bg border border-fleet-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-fleet-text">
                  {conditionIcon} Weather at Origin — {w.city}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  w.isRainy ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' : 'bg-green-500/10 border-green-500/40 text-green-400'
                }`}>
                  {w.condition}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm font-bold text-fleet-text">{w.temperature}°C</p>
                  <p className="text-xs text-fleet-muted">Temp</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-fleet-text">{w.humidity}%</p>
                  <p className="text-xs text-fleet-muted">Humidity</p>
                </div>
                <div>
                  <p className={`text-sm font-bold ${w.humidityMultiplier < 0.80 ? 'text-red-400' : w.humidityMultiplier < 1.00 ? 'text-yellow-400' : 'text-green-400'}`}>
                    ×{w.humidityMultiplier}
                  </p>
                  <p className="text-xs text-fleet-muted">Maint. mult.</p>
                </div>
              </div>

              {routeData.adjustedFuelL !== routeData.fuelEstimateL && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-fleet-border">
                  <span className="text-fleet-muted">Humidity fuel impact</span>
                  <span className="text-fleet-text">
                    <span className="line-through text-fleet-muted mr-1">{routeData.fuelEstimateL} L</span>
                    <span className="text-yellow-400 font-semibold">{routeData.adjustedFuelL} L</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Weather-based maintenance warnings */}
          {routeData && routeData.maintenanceWarnings?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-fleet-muted uppercase tracking-wide">Weather Maintenance Alerts</p>
              {routeData.maintenanceWarnings.map((w, i) => (
                <div key={i} className={`border rounded-lg px-3 py-2 text-xs ${WARNING_STYLE[w.level] ?? WARNING_STYLE.INFO}`}>
                  <span className="font-bold mr-1">[{w.level}]</span>{w.message}
                </div>
              ))}
            </div>
          )}

          {/* Accepted confirmation */}
          {accepted && (
            <div className="bg-green-500/10 border border-green-500/40 rounded-lg px-3 py-2">
              <p className="text-green-400 text-xs font-semibold">✓ Route accepted — mileage updated. Maintenance schedule recalculated.</p>
            </div>
          )}

          {/* Action buttons */}
          {routeData && (
            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleRefresh} disabled={loading}
                className="border border-fleet-border hover:border-fleet-accent text-fleet-muted hover:text-fleet-text text-sm font-semibold rounded-lg py-2 transition-colors disabled:opacity-50">
                {loading ? 'Refreshing…' : '↺ Refresh Route'}
              </button>
              <button
                onClick={handleAccept}
                disabled={accepting || overdueBlocked}
                title={overdueBlocked ? 'Service required before accepting route' : ''}
                className={`text-white text-sm font-semibold rounded-lg py-2 transition-colors disabled:opacity-50 ${
                  overdueBlocked
                    ? 'bg-red-800 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {accepting ? 'Applying…' : overdueBlocked ? '🚫 Service Required' : '✓ Accept Route'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
