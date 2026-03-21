// Smart-Fleet IoT — Alert Slice
// TanQHoang © 2026

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import axiosClient from '@/api/axiosClient';

export const registerFcmToken = createAsyncThunk('alert/registerFcm', async (fcmToken, { rejectWithValue }) => {
  try {
    await axiosClient.post('/notifications/fcm-token', { fcmToken });
    return fcmToken;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Failed to register FCM token.' });
  }
});

const initialState = {
  queue: [],          // Active alerts shown in UI
  unreadCount: 0,
  fcmToken: null,
  loading: false,
  error: null,
};

const alertSlice = createSlice({
  name: 'alert',
  initialState,
  reducers: {
    addAlert: (state, action) => {
      // Deduplicate by vehicleId + component
      const exists = state.queue.find(
        (a) => a.vehicleId === action.payload.vehicleId && a.component === action.payload.component
      );
      if (!exists) {
        state.queue.unshift({ ...action.payload, id: Date.now(), read: false });
        state.unreadCount += 1;
      }
    },
    dismissAlert: (state, action) => {
      state.queue = state.queue.filter((a) => a.id !== action.payload);
    },
    markAllRead: (state) => {
      state.queue.forEach((a) => { a.read = true; });
      state.unreadCount = 0;
    },
    clearAlerts: (state) => {
      state.queue = [];
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(registerFcmToken.fulfilled, (state, action) => {
        state.fcmToken = action.payload;
      })
      .addCase(registerFcmToken.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { addAlert, dismissAlert, markAllRead, clearAlerts } = alertSlice.actions;
export default alertSlice.reducer;

// ─── Selectors ────────────────────────────────────────────────────────────────
const selectAlertState = (state) => state.alert;
export const selectAlertQueue    = createSelector(selectAlertState, (a) => a.queue);
export const selectUnreadCount   = createSelector(selectAlertState, (a) => a.unreadCount);
export const selectFcmToken      = createSelector(selectAlertState, (a) => a.fcmToken);
export const selectCriticalAlerts = createSelector(
  selectAlertState,
  (a) => a.queue.filter((x) => x.status === 'CRITICAL' || x.status === 'OVERDUE')
);
