// Smart-Fleet IoT — weatherSlice reducer tests
// TanQHoang © 2026

import { describe, it, expect } from 'vitest';
import reducer, { clearError, fetchWeather, fetchForecast } from '@/redux/weatherSlice';

const initial = { current: null, forecast: [], loading: false, error: null };

const mockCurrent = {
  city: 'Ho Chi Minh City', temperature: 33, humidity: 82,
  condition: 'Partly cloudy', icon: '02d', humidityMultiplier: 0.8,
};

const mockForecast = [
  { date: '2026-03-25', maxTemp: 34, minTemp: 28, avgHumidity: 80, condition: 'Sunny' },
  { date: '2026-03-26', maxTemp: 32, minTemp: 26, avgHumidity: 85, condition: 'Rain' },
];

describe('weatherSlice', () => {
  it('returns initial state', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual(initial);
  });

  it('clearError resets error', () => {
    const state = reducer({ ...initial, error: { message: 'fail' } }, clearError());
    expect(state.error).toBeNull();
  });

  it('fetchWeather.pending sets loading', () => {
    const state = reducer(initial, { type: fetchWeather.pending.type });
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('fetchWeather.fulfilled stores current weather', () => {
    const state = reducer(
      { ...initial, loading: true },
      { type: fetchWeather.fulfilled.type, payload: mockCurrent }
    );
    expect(state.loading).toBe(false);
    expect(state.current).toEqual(mockCurrent);
  });

  it('fetchWeather.rejected stores error', () => {
    const error = { message: 'API error' };
    const state = reducer(
      { ...initial, loading: true },
      { type: fetchWeather.rejected.type, payload: error }
    );
    expect(state.loading).toBe(false);
    expect(state.error).toEqual(error);
    expect(state.current).toBeNull();
  });

  it('fetchForecast.fulfilled stores forecast array', () => {
    const state = reducer(
      initial,
      { type: fetchForecast.fulfilled.type, payload: mockForecast }
    );
    expect(state.forecast).toHaveLength(2);
    expect(state.forecast[0].date).toBe('2026-03-25');
  });

  it('fetchForecast.fulfilled replaces previous forecast', () => {
    const withOld = { ...initial, forecast: [{ date: '2026-03-20' }] };
    const state = reducer(
      withOld,
      { type: fetchForecast.fulfilled.type, payload: mockForecast }
    );
    expect(state.forecast).toHaveLength(2);
    expect(state.forecast[0].date).toBe('2026-03-25');
  });
});
