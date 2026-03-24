// Smart-Fleet IoT — Fleet Slice
// TanQHoang © 2026

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import axiosClient from '@/api/axiosClient';

export const fetchFleet = createAsyncThunk('fleet/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const { data } = await axiosClient.get('/fleet');
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Failed to load fleet.' });
  }
});

export const registerVehicle = createAsyncThunk('fleet/register', async (vehicleData, { rejectWithValue }) => {
  try {
    const { data } = await axiosClient.post('/fleet', vehicleData);
    return data.data.vehicle;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Failed to register vehicle.' });
  }
});

export const fetchVehicleStatus = createAsyncThunk('fleet/fetchStatus', async (vehicleId, { rejectWithValue }) => {
  try {
    const { data } = await axiosClient.get(`/fleet/${vehicleId}/status`);
    return { vehicleId, status: data.data };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Failed to load vehicle status.' });
  }
});

export const logMaintenance = createAsyncThunk('fleet/logMaintenance', async ({ vehicleId, component, mileageAtService, notes }, { rejectWithValue }) => {
  try {
    const { data } = await axiosClient.post('/maintenance/log', { vehicleId, component, mileageAtService, notes });
    return data.data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Failed to log maintenance.' });
  }
});

export const updateMileage = createAsyncThunk('fleet/updateMileage', async ({ vehicleId, mileageCurrent }, { rejectWithValue }) => {
  try {
    const { data } = await axiosClient.patch(`/fleet/${vehicleId}/mileage`, { mileageCurrent });
    return { vehicleId, mileageCurrent: data.data.mileageCurrent };
  } catch (err) {
    return rejectWithValue(err.response?.data?.error || { message: 'Failed to update mileage.' });
  }
});

const initialState = {
  vehicles: [],
  pagination: null,
  selectedVehicleId: null,
  statusByVehicleId: {},
  loading: false,
  statusLoading: false,
  error: null,
};

const fleetSlice = createSlice({
  name: 'fleet',
  initialState,
  reducers: {
    selectVehicle: (state, action) => { state.selectedVehicleId = action.payload; },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFleet.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchFleet.fulfilled, (state, action) => {
        state.loading = false;
        state.vehicles = action.payload.items;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchFleet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(registerVehicle.fulfilled, (state, action) => {
        state.vehicles.unshift(action.payload);
      })
      .addCase(fetchVehicleStatus.pending, (state) => { state.statusLoading = true; })
      .addCase(fetchVehicleStatus.fulfilled, (state, action) => {
        state.statusLoading = false;
        state.statusByVehicleId[action.payload.vehicleId] = action.payload.status;
      })
      .addCase(fetchVehicleStatus.rejected, (state) => { state.statusLoading = false; })
      .addCase(updateMileage.fulfilled, (state, action) => {
        const v = state.vehicles.find((x) => x.id === action.payload.vehicleId);
        if (v) v.mileage_current = action.payload.mileageCurrent;
      });
  },
});

export const { selectVehicle, clearError } = fleetSlice.actions;
export default fleetSlice.reducer;

// ─── Selectors ────────────────────────────────────────────────────────────────
const selectFleetState = (state) => state.fleet;
export const selectAllVehicles      = createSelector(selectFleetState, (f) => f.vehicles);
export const selectSelectedId       = createSelector(selectFleetState, (f) => f.selectedVehicleId);
export const selectFleetLoading     = createSelector(selectFleetState, (f) => f.loading);
export const selectFleetError       = createSelector(selectFleetState, (f) => f.error);
export const selectStatusByVehicleId = createSelector(selectFleetState, (f) => f.statusByVehicleId);
export const selectSelectedStatus   = createSelector(
  selectFleetState,
  (f) => f.selectedVehicleId ? f.statusByVehicleId[f.selectedVehicleId] : null
);
