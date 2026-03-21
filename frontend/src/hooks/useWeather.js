// Smart-Fleet IoT — useWeather Hook
// TanQHoang © 2026

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWeather, fetchForecast, selectCurrentWeather, selectForecast, selectHumidityMultiplier, selectWeatherLoading, selectWeatherError } from '@/redux/weatherSlice';

export function useWeather(lat, lon) {
  const dispatch = useDispatch();
  const current           = useSelector(selectCurrentWeather);
  const forecast          = useSelector(selectForecast);
  const humidityMultiplier = useSelector(selectHumidityMultiplier);
  const loading           = useSelector(selectWeatherLoading);
  const error             = useSelector(selectWeatherError);

  useEffect(() => {
    const params = lat && lon ? { lat, lon } : {};
    dispatch(fetchWeather(params));
    dispatch(fetchForecast(params));
  }, [dispatch, lat, lon]);

  return { current, forecast, humidityMultiplier, loading, error };
}
