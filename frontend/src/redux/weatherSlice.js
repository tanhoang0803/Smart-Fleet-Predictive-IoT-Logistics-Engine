// Smart-Fleet IoT — Weather Slice
// TanQHoang © 2026

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import axiosClient from '@/api/axiosClient';

export const fetchWeather = createAsyncThunk('weather/fetchCurrent', async ({ lat, lon } = {}, { rejectWithValue }) => {
  try {
    const params = lat && lon ? { lat, lon } : {};
    const { data } = await axiosClient.get('/weather/current', { params });
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Failed to load weather.' });
  }
});

export const fetchForecast = createAsyncThunk('weather/fetchForecast', async ({ lat, lon } = {}, { rejectWithValue }) => {
  try {
    const params = lat && lon ? { lat, lon } : {};
    const { data } = await axiosClient.get('/weather/forecast', { params });
    return data.data.forecast;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Failed to load forecast.' });
  }
});

const initialState = {
  current: null,
  forecast: [],
  loading: false,
  error: null,
  routeLocation: null, // { lat, lon } — set when user accepts a route
};

const weatherSlice = createSlice({
  name: 'weather',
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
    setRouteLocation: (state, action) => { state.routeLocation = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWeather.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchWeather.fulfilled, (state, action) => {
        state.loading = false;
        state.current = action.payload;
      })
      .addCase(fetchWeather.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchForecast.fulfilled, (state, action) => {
        state.forecast = action.payload;
      });
  },
});

export const { clearError, setRouteLocation } = weatherSlice.actions;
export default weatherSlice.reducer;

// ─── Selectors ────────────────────────────────────────────────────────────────
const selectWeatherState = (state) => state.weather;
export const selectCurrentWeather      = createSelector(selectWeatherState, (w) => w.current);
export const selectForecast            = createSelector(selectWeatherState, (w) => w.forecast);
export const selectHumidityMultiplier  = createSelector(selectWeatherState, (w) => w.current?.humidityMultiplier ?? 1.0);
export const selectWeatherLoading      = createSelector(selectWeatherState, (w) => w.loading);
export const selectWeatherError        = createSelector(selectWeatherState, (w) => w.error);
export const selectRouteLocation       = createSelector(selectWeatherState, (w) => w.routeLocation);
