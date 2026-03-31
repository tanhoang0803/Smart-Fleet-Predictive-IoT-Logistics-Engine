// Smart-Fleet IoT — User Slice
// TanQHoang © 2026

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import axiosClient from '@/api/axiosClient';

export const loginUser = createAsyncThunk('user/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const { data } = await axiosClient.post('/auth/login', { email, password });
    return data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Login failed.' });
  }
});

export const registerUser = createAsyncThunk('user/register', async ({ email, password, name }, { rejectWithValue }) => {
  try {
    const { data } = await axiosClient.post('/auth/register', { email, password, name });
    return data.data.user;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Registration failed.' });
  }
});

export const restoreSession = createAsyncThunk('user/restoreSession', async (_, { rejectWithValue }) => {
  try {
    const { data } = await axiosClient.get('/auth/me');
    return data.data.user;
  } catch {
    return rejectWithValue(null);
  }
});

export const logoutUser = createAsyncThunk('user/logout', async (_, { rejectWithValue }) => {
  try {
    await axiosClient.post('/auth/logout');
  } catch (err) {
    return rejectWithValue(err.response?.data?.error);
  }
});

const initialState = {
  profile: null,
  isAuthenticated: false,
  initialized: false,
  loading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
        state.isAuthenticated = true;
        state.initialized = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(registerUser.fulfilled, (state) => { state.loading = false; })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.profile = action.payload;
        state.isAuthenticated = true;
        state.initialized = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.initialized = true;
      })
      .addCase(logoutUser.fulfilled, () => ({ ...initialState, initialized: true }));
  },
});

export const { clearError } = userSlice.actions;
export default userSlice.reducer;

// ─── Selectors ────────────────────────────────────────────────────────────────
const selectUserState = (state) => state.user;
export const selectProfile       = createSelector(selectUserState, (u) => u.profile);
export const selectIsAuthenticated = createSelector(selectUserState, (u) => u.isAuthenticated);
export const selectUserLoading   = createSelector(selectUserState, (u) => u.loading);
export const selectUserError     = createSelector(selectUserState, (u) => u.error);
export const selectInitialized   = createSelector(selectUserState, (u) => u.initialized);
