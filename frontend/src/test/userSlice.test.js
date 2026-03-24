// Smart-Fleet IoT — userSlice reducer tests
// TanQHoang © 2026

import { describe, it, expect } from 'vitest';
import reducer, { clearError, loginUser, registerUser, logoutUser } from '@/redux/userSlice';

const initial = { profile: null, isAuthenticated: false, initialized: false, loading: false, error: null };

describe('userSlice', () => {
  it('returns initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual(initial);
  });

  it('clearError resets error', () => {
    const state = { ...initial, error: { message: 'fail' } };
    expect(reducer(state, clearError()).error).toBeNull();
  });

  it('loginUser.pending sets loading', () => {
    const state = reducer(initial, { type: loginUser.pending.type });
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('loginUser.fulfilled sets profile and isAuthenticated', () => {
    const user = { id: '1', email: 'a@b.com', name: 'Test' };
    const state = reducer(
      { ...initial, loading: true },
      { type: loginUser.fulfilled.type, payload: user }
    );
    expect(state.loading).toBe(false);
    expect(state.isAuthenticated).toBe(true);
    expect(state.profile).toEqual(user);
  });

  it('loginUser.rejected sets error', () => {
    const error = { message: 'Invalid credentials' };
    const state = reducer(
      { ...initial, loading: true },
      { type: loginUser.rejected.type, payload: error }
    );
    expect(state.loading).toBe(false);
    expect(state.error).toEqual(error);
    expect(state.isAuthenticated).toBe(false);
  });

  it('registerUser.pending sets loading', () => {
    const state = reducer(initial, { type: registerUser.pending.type });
    expect(state.loading).toBe(true);
  });

  it('registerUser.fulfilled clears loading', () => {
    const state = reducer(
      { ...initial, loading: true },
      { type: registerUser.fulfilled.type }
    );
    expect(state.loading).toBe(false);
  });

  it('logoutUser.fulfilled resets to initial state', () => {
    const loggedIn = { profile: { id: '1' }, isAuthenticated: true, initialized: true, loading: false, error: null };
    const state = reducer(loggedIn, { type: logoutUser.fulfilled.type });
    expect(state).toEqual({ ...initial, initialized: true });
  });
});
