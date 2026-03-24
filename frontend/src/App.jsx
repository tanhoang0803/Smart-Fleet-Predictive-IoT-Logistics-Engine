// Smart-Fleet IoT — App Shell & Routes
// TanQHoang © 2026

import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useState, useEffect } from 'react';
import {
  selectIsAuthenticated, loginUser, registerUser, logoutUser, restoreSession,
  selectUserLoading, selectUserError, selectInitialized, clearError as clearUserError,
} from '@/redux/userSlice';
import {
  fetchFleet, registerVehicle, fetchVehicleStatus, updateMileage, logMaintenance,
  selectAllVehicles, selectFleetLoading, selectSelectedStatus, selectVehicle,
  selectStatusByVehicleId,
} from '@/redux/fleetSlice';
import { AlertBanner } from '@/components/AlertBanner';
import { FleetCard } from '@/components/FleetCard';
import { MaintenanceGauge } from '@/components/MaintenanceGauge';
import { WeatherWidget } from '@/components/WeatherWidget';
import { MapView } from '@/components/MapView';

const FUEL_TYPES = ['E10', 'E5', 'RON92', 'RON95'];
const COMPONENTS = [
  'engine_oil', 'air_filter', 'spark_plug', 'drive_chain',
  'brake_pads', 'brake_shoes', 'fuel_filter', 'transmission_fluid',
];

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-fleet-surface border border-fleet-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-fleet-text">{title}</h2>
          <button onClick={onClose} className="text-fleet-muted hover:text-fleet-text text-xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Add Vehicle Modal ────────────────────────────────────────────────────────
function AddVehicleModal({ onClose }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({
    model: 'Honda Wave RSX', plateNumber: '', mileageCurrent: '', fuelType: 'E10', lat: '', lon: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await dispatch(registerVehicle({
      model: form.model,
      plateNumber: form.plateNumber || undefined,
      mileageCurrent: Number(form.mileageCurrent) || 0,
      fuelType: form.fuelType,
      lat: form.lat ? Number(form.lat) : undefined,
      lon: form.lon ? Number(form.lon) : undefined,
    }));
    setLoading(false);
    if (!result.error) onClose();
    else setError(result.payload?.message || 'Failed to register vehicle.');
  }

  const field = 'w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent';

  return (
    <Modal title="Register Vehicle" onClose={onClose}>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <input className={field} placeholder="Model (e.g. Honda Wave RSX)" value={form.model}
          onChange={(e) => setForm({ ...form, model: e.target.value })} required />
        <input className={field} placeholder="Plate number (optional)" value={form.plateNumber}
          onChange={(e) => setForm({ ...form, plateNumber: e.target.value })} />
        <input className={field} type="number" placeholder="Current mileage (km)" value={form.mileageCurrent}
          onChange={(e) => setForm({ ...form, mileageCurrent: e.target.value })} min="0" required />
        <select className={field} value={form.fuelType} onChange={(e) => setForm({ ...form, fuelType: e.target.value })}>
          {FUEL_TYPES.map((f) => <option key={f}>{f}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input className={field} type="number" step="any" placeholder="Latitude (optional)" value={form.lat}
            onChange={(e) => setForm({ ...form, lat: e.target.value })} />
          <input className={field} type="number" step="any" placeholder="Longitude (optional)" value={form.lon}
            onChange={(e) => setForm({ ...form, lon: e.target.value })} />
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-fleet-accent hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
          {loading ? 'Registering…' : 'Register Vehicle'}
        </button>
      </form>
    </Modal>
  );
}

// ─── Maintenance Log Modal ────────────────────────────────────────────────────
function LogMaintenanceModal({ vehicleId, onClose, onLogged }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ component: 'engine_oil', mileageAtService: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await dispatch(logMaintenance({
      vehicleId,
      component: form.component,
      mileageAtService: Number(form.mileageAtService),
      notes: form.notes || undefined,
    }));
    setLoading(false);
    if (!result.error) {
      dispatch(fetchVehicleStatus(vehicleId));
      onLogged?.();
      onClose();
    } else {
      setError(result.payload?.message || 'Failed to log service.');
    }
  }

  const field = 'w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent';

  return (
    <Modal title="Log Service" onClose={onClose}>
      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <select className={field} value={form.component} onChange={(e) => setForm({ ...form, component: e.target.value })}>
          {COMPONENTS.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>
          ))}
        </select>
        <input className={field} type="number" placeholder="Mileage at service (km)" value={form.mileageAtService}
          onChange={(e) => setForm({ ...form, mileageAtService: e.target.value })} min="0" required />
        <textarea className={`${field} resize-none h-20`} placeholder="Notes (optional)" value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit" disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
          {loading ? 'Saving…' : 'Save Service Record'}
        </button>
      </form>
    </Modal>
  );
}

// ─── Update Mileage Modal ─────────────────────────────────────────────────────
function UpdateMileageModal({ vehicle, onClose }) {
  const dispatch = useDispatch();
  const [km, setKm] = useState(String(vehicle.mileage_current));
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    await dispatch(updateMileage({ vehicleId: vehicle.id, mileageCurrent: Number(km) }));
    setLoading(false);
    onClose();
  }

  return (
    <Modal title="Update Mileage" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2 text-sm text-fleet-text focus:outline-none focus:border-fleet-accent"
          type="number" min={vehicle.mileage_current} value={km}
          onChange={(e) => setKm(e.target.value)} required />
        <button type="submit" disabled={loading}
          className="w-full bg-fleet-accent hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
          {loading ? 'Saving…' : 'Update Mileage'}
        </button>
      </form>
    </Modal>
  );
}

// ─── Auth Guard ───────────────────────────────────────────────────────────────
function AuthGuard({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const initialized     = useSelector(selectInitialized);
  if (!initialized) return (
    <div className="min-h-screen flex items-center justify-center bg-fleet-bg">
      <div className="w-8 h-8 border-2 border-fleet-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectUserLoading);
  const error   = useSelector(selectUserError);
  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => () => dispatch(clearUserError()), [dispatch]);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(loginUser(form));
    if (!result.error) navigate('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-fleet-surface border border-fleet-border rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-fleet-text mb-1">Smart-Fleet</h1>
        <p className="text-sm text-fleet-muted mb-6">Predictive Maintenance Engine</p>
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg px-3 py-2 mb-4">
            <p className="text-red-400 text-sm">{error.message}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="email" placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent" />
          <input type="password" placeholder="Password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent" />
          <button type="submit" disabled={loading}
            className="w-full bg-fleet-accent hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-xs text-fleet-muted text-center mt-4">
          No account? <a href="/register" className="text-fleet-accent hover:underline">Register</a>
        </p>
      </div>
      <footer className="mt-6">
        <p className="text-xs text-fleet-muted">Created by &copy; 2026 TanQHoang</p>
      </footer>
    </div>
  );
}

// ─── Register Page ────────────────────────────────────────────────────────────
function RegisterPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectUserLoading);
  const error   = useSelector(selectUserError);
  const [form, setForm] = useState({ email: '', password: '', name: '' });

  useEffect(() => () => dispatch(clearUserError()), [dispatch]);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(registerUser(form));
    if (!result.error) navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm bg-fleet-surface border border-fleet-border rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-fleet-text mb-6">Create Account</h1>
        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg px-3 py-2 mb-4">
            <p className="text-red-400 text-sm">{error.message}</p>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" placeholder="Full Name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent" required />
          <input type="email" placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent" required />
          <input type="password" placeholder="Password (8+ chars)" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent" required minLength={8} />
          <button type="submit" disabled={loading}
            className="w-full bg-fleet-accent hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors">
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>
        <p className="text-xs text-fleet-muted text-center mt-4">
          Have an account? <a href="/login" className="text-fleet-accent hover:underline">Sign in</a>
        </p>
      </div>
      <footer className="mt-6">
        <p className="text-xs text-fleet-muted">Created by &copy; 2026 TanQHoang</p>
      </footer>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage() {
  const dispatch      = useDispatch();
  const vehicles      = useSelector(selectAllVehicles);
  const loading       = useSelector(selectFleetLoading);
  const selected      = useSelector(selectSelectedStatus);
  const statusMap     = useSelector(selectStatusByVehicleId);
  const [activeTab, setActiveTab] = useState('fleet');
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [showLogMaintenance, setShowLogMaintenance] = useState(false);
  const [showUpdateMileage, setShowUpdateMileage] = useState(false);
  const selectedVehicle = vehicles.find((v) => v.id === selected?.vehicle?.id) || null;

  useEffect(() => {
    dispatch(fetchFleet()).then((action) => {
      const items = action.payload?.items || [];
      items.forEach((v) => dispatch(fetchVehicleStatus(v.id)));
    });
  }, [dispatch]);

  function handleSelectVehicle(id) {
    dispatch(selectVehicle(id));
    dispatch(fetchVehicleStatus(id));
  }

  return (
    <div className="min-h-screen bg-fleet-bg">
      {showAddVehicle && <AddVehicleModal onClose={() => setShowAddVehicle(false)} />}
      {showLogMaintenance && selected?.vehicle?.id && (
        <LogMaintenanceModal vehicleId={selected.vehicle.id} onClose={() => setShowLogMaintenance(false)} />
      )}
      {showUpdateMileage && selectedVehicle && (
        <UpdateMileageModal vehicle={selectedVehicle} onClose={() => setShowUpdateMileage(false)} />
      )}

      <header className="border-b border-fleet-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-fleet-text">Smart-Fleet IoT</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAddVehicle(true)}
            className="bg-fleet-accent hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
            + Add Vehicle
          </button>
          <button onClick={() => dispatch(logoutUser())}
            className="text-xs text-fleet-muted hover:text-fleet-text transition-colors">
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <AlertBanner />
        <WeatherWidget />

        <div className="flex gap-2 border-b border-fleet-border pb-1">
          {['fleet', 'map'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm rounded-lg capitalize transition-colors ${activeTab === tab ? 'bg-fleet-accent text-white' : 'text-fleet-muted hover:text-fleet-text'}`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'fleet' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-fleet-muted uppercase tracking-wider">Your Fleet</h2>
              {loading && <p className="text-fleet-muted text-sm">Loading…</p>}
              {vehicles.map((v) => (
                <FleetCard key={v.id} vehicle={v}
                  alertStatus={statusMap[v.id]?.worstStatus || 'NORMAL'}
                  onSelect={handleSelectVehicle} />
              ))}
              {!loading && !vehicles.length && (
                <div className="text-center py-8 border border-dashed border-fleet-border rounded-xl">
                  <p className="text-fleet-muted text-sm mb-3">No vehicles registered yet.</p>
                  <button onClick={() => setShowAddVehicle(true)}
                    className="text-fleet-accent text-sm hover:underline">
                    + Register your first vehicle
                  </button>
                </div>
              )}
            </div>

            {selected && (
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-fleet-muted uppercase tracking-wider">
                    Maintenance — {selected.vehicle?.model}
                  </h2>
                  <div className="flex gap-2">
                    <button onClick={() => setShowUpdateMileage(true)}
                      className="text-xs text-fleet-muted hover:text-fleet-text border border-fleet-border rounded-lg px-2.5 py-1 transition-colors">
                      Update km
                    </button>
                    <button onClick={() => setShowLogMaintenance(true)}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg px-2.5 py-1 transition-colors">
                      Log Service
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {selected.schedule?.map((item) => (
                    <MaintenanceGauge key={item.component} {...item} status={item.alertStatus} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'map' && <MapView />}
      </main>

      <footer className="border-t border-fleet-border mt-8 py-4 text-center">
        <p className="text-xs text-fleet-muted">
          &copy; 2026 TanQHoang — Smart-Fleet IoT | Predictive Maintenance Engine
        </p>
      </footer>
    </div>
  );
}

// ─── App Routes ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route path="/login"     element={<LoginPage />} />
      <Route path="/register"  element={<RegisterPage />} />
      <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
      <Route path="*"          element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
