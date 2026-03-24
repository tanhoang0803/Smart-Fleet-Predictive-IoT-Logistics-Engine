// Smart-Fleet IoT — alertSlice reducer tests
// TanQHoang © 2026

import { describe, it, expect } from 'vitest';
import reducer, { addAlert, dismissAlert, markAllRead, clearAlerts } from '@/redux/alertSlice';

const initial = { queue: [], unreadCount: 0, fcmToken: null, loading: false, error: null };

const mockAlert = { vehicleId: 'v1', component: 'engine_oil', status: 'CRITICAL', message: 'Critical' };

describe('alertSlice', () => {
  it('returns initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toMatchObject({ queue: [], unreadCount: 0 });
  });

  it('addAlert adds alert and increments unreadCount', () => {
    const state = reducer(initial, addAlert(mockAlert));
    expect(state.queue).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
    expect(state.queue[0].vehicleId).toBe('v1');
    expect(state.queue[0].read).toBe(false);
  });

  it('addAlert deduplicates by vehicleId + component', () => {
    let state = reducer(initial, addAlert(mockAlert));
    state = reducer(state, addAlert(mockAlert));
    expect(state.queue).toHaveLength(1);
    expect(state.unreadCount).toBe(1);
  });

  it('addAlert allows different components on same vehicle', () => {
    let state = reducer(initial, addAlert(mockAlert));
    state = reducer(state, addAlert({ ...mockAlert, component: 'air_filter' }));
    expect(state.queue).toHaveLength(2);
    expect(state.unreadCount).toBe(2);
  });

  it('dismissAlert removes alert by id', () => {
    let state = reducer(initial, addAlert(mockAlert));
    const id = state.queue[0].id;
    state = reducer(state, dismissAlert(id));
    expect(state.queue).toHaveLength(0);
  });

  it('markAllRead sets all alerts to read and resets unreadCount', () => {
    let state = reducer(initial, addAlert(mockAlert));
    state = reducer(state, addAlert({ ...mockAlert, component: 'air_filter' }));
    state = reducer(state, markAllRead());
    expect(state.unreadCount).toBe(0);
    expect(state.queue.every((a) => a.read)).toBe(true);
  });

  it('clearAlerts empties queue and resets unreadCount', () => {
    let state = reducer(initial, addAlert(mockAlert));
    state = reducer(state, clearAlerts());
    expect(state.queue).toHaveLength(0);
    expect(state.unreadCount).toBe(0);
  });
});
