// Smart-Fleet IoT — App Shell & Routes
// TanQHoang © 2026

import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useState, useEffect } from 'react';
import { selectIsAuthenticated, loginUser, registerUser, selectUserLoading, selectUserError, clearError } from '@/redux/userSlice';
import { fetchFleet, selectAllVehicles, selectFleetLoading, selectSelectedStatus, selectVehicle } from '@/redux/fleetSlice';
import { AlertBanner } from '@/components/AlertBanner';
import { FleetCard } from '@/components/FleetCard';
import { MaintenanceGauge } from '@/components/MaintenanceGauge';
import { WeatherWidget } from '@/components/WeatherWidget';
import { MapView } from '@/components/MapView';

// ─── Auth Guard ───────────────────────────────────────────────────────────────
function AuthGuard({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loading = useSelector(selectUserLoading);
  const error   = useSelector(selectUserError);
  const [form, setForm] = useState({ email: '', password: '' });

  useEffect(() => () => dispatch(clearError()), [dispatch]);

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(loginUser(form));
    if (!result.error) navigate('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-fleet-surface border border-fleet-border rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-fleet-text mb-1">Smart-Fleet</h1>
        <p className="text-sm text-fleet-muted mb-6">Predictive Maintenance Engine</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500 rounded-lg px-3 py-2 mb-4">
            <p className="text-red-400 text-sm">{error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent"
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-fleet-accent hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-xs text-fleet-muted text-center mt-4">
          No account? <a href="/register" className="text-fleet-accent hover:underline">Register</a>
        </p>
      </div>
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

  async function handleSubmit(e) {
    e.preventDefault();
    const result = await dispatch(registerUser(form));
    if (!result.error) navigate('/login');
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
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
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent" />
          <input type="email" placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent" />
          <input type="password" placeholder="Password (8+ chars)" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full bg-fleet-bg border border-fleet-border rounded-lg px-3 py-2.5 text-sm text-fleet-text placeholder-fleet-muted focus:outline-none focus:border-fleet-accent" />
          <button type="submit" disabled={loading}
            className="w-full bg-fleet-accent hover:bg-blue-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 transition-colors">
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>
        <p className="text-xs text-fleet-muted text-center mt-4">
          Have an account? <a href="/login" className="text-fleet-accent hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage() {
  const dispatch  = useDispatch();
  const vehicles  = useSelector(selectAllVehicles);
  const loading   = useSelector(selectFleetLoading);
  const selected  = useSelector(selectSelectedStatus);
  const [activeTab, setActiveTab] = useState('fleet');

  useEffect(() => { dispatch(fetchFleet()); }, [dispatch]);

  return (
    <div className="min-h-screen bg-fleet-bg">
      <header className="border-b border-fleet-border px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-fleet-text">Smart-Fleet IoT</h1>
        <p className="text-xs text-fleet-muted">TanQHoang © 2026</p>
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
                <FleetCard key={v.id} vehicle={v} alertStatus={v.alert_status}
                  onSelect={(id) => dispatch(selectVehicle(id))} />
              ))}
              {!loading && !vehicles.length && (
                <p className="text-fleet-muted text-sm">No vehicles registered yet.</p>
              )}
            </div>

            {selected && (
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-sm font-semibold text-fleet-muted uppercase tracking-wider">
                  Maintenance Schedule — {selected.vehicle?.model}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {selected.schedule?.map((item) => (
                    <MaintenanceGauge key={item.component} {...item} />
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
          © 2026 TanQHoang — Smart-Fleet IoT | Predictive Maintenance Engine
        </p>
      </footer>
    </div>
  );
}

// ─── App Routes ───────────────────────────────────────────────────────────────
export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
