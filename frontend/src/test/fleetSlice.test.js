// Smart-Fleet IoT — fleetSlice reducer tests
// TanQHoang © 2026

import { describe, it, expect } from 'vitest';
import reducer, { selectVehicle, clearError, fetchFleet, registerVehicle, fetchVehicleStatus, updateMileage } from '@/redux/fleetSlice';

const initial = {
  vehicles: [],
  pagination: null,
  selectedVehicleId: null,
  statusByVehicleId: {},
  loading: false,
  statusLoading: false,
  error: null,
};

const mockVehicle = { id: 'v1', model: 'Honda Wave RSX', mileage_current: 5000, fuel_type: 'E10' };

describe('fleetSlice', () => {
  it('returns initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual(initial);
  });

  it('selectVehicle sets selectedVehicleId', () => {
    const state = reducer(initial, selectVehicle('v1'));
    expect(state.selectedVehicleId).toBe('v1');
  });

  it('clearError resets error', () => {
    const state = reducer({ ...initial, error: { message: 'err' } }, clearError());
    expect(state.error).toBeNull();
  });

  it('fetchFleet.pending sets loading', () => {
    const state = reducer(initial, { type: fetchFleet.pending.type });
    expect(state.loading).toBe(true);
  });

  it('fetchFleet.fulfilled populates vehicles', () => {
    const payload = { items: [mockVehicle], pagination: { total: 1, page: 1, limit: 20 } };
    const state = reducer(
      { ...initial, loading: true },
      { type: fetchFleet.fulfilled.type, payload }
    );
    expect(state.loading).toBe(false);
    expect(state.vehicles).toHaveLength(1);
    expect(state.vehicles[0]).toEqual(mockVehicle);
    expect(state.pagination).toEqual(payload.pagination);
  });

  it('fetchFleet.rejected sets error', () => {
    const error = { message: 'Network error' };
    const state = reducer(
      { ...initial, loading: true },
      { type: fetchFleet.rejected.type, payload: error }
    );
    expect(state.loading).toBe(false);
    expect(state.error).toEqual(error);
  });

  it('registerVehicle.fulfilled prepends vehicle to list', () => {
    const existing = { ...initial, vehicles: [mockVehicle] };
    const newVehicle = { id: 'v2', model: 'Honda Wave RSX', mileage_current: 0, fuel_type: 'E10' };
    const state = reducer(existing, { type: registerVehicle.fulfilled.type, payload: newVehicle });
    expect(state.vehicles[0]).toEqual(newVehicle);
    expect(state.vehicles).toHaveLength(2);
  });

  it('fetchVehicleStatus.fulfilled stores status by vehicleId', () => {
    const status = { vehicle: mockVehicle, schedule: [] };
    const state = reducer(
      initial,
      { type: fetchVehicleStatus.fulfilled.type, payload: { vehicleId: 'v1', status } }
    );
    expect(state.statusByVehicleId['v1']).toEqual(status);
    expect(state.statusLoading).toBe(false);
  });

  it('updateMileage.fulfilled updates mileage in vehicles array', () => {
    const state = reducer(
      { ...initial, vehicles: [mockVehicle] },
      { type: updateMileage.fulfilled.type, payload: { vehicleId: 'v1', mileageCurrent: 6000 } }
    );
    expect(state.vehicles[0].mileage_current).toBe(6000);
  });

  it('updateMileage.fulfilled does nothing if vehicleId not found', () => {
    const state = reducer(
      { ...initial, vehicles: [mockVehicle] },
      { type: updateMileage.fulfilled.type, payload: { vehicleId: 'v99', mileageCurrent: 9999 } }
    );
    expect(state.vehicles[0].mileage_current).toBe(5000);
  });
});
