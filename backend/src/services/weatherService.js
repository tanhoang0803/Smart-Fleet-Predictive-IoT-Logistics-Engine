// Smart-Fleet IoT — Weather Service
// TanQHoang © 2026
// OpenWeather API + Redis cache (30m current / 3h forecast)

const axios = require('axios');
const redisClient = require('../utils/redisClient');
const { supabase } = require('../utils/supabaseClient');
const logger = require('../utils/logger');

const OPENWEATHER_BASE = 'https://api.openweathermap.org/data/2.5';
const CACHE_TTL_CURRENT = 1800;   // 30 minutes
const CACHE_TTL_FORECAST = 10800; // 3 hours
const SAFE_DEFAULT_HUMIDITY = 75; // Used when all sources fail

// Source: .claude/skills/environmental-logic.md
// mechanic-pro-reviewed
function getHumidityMultiplier(humidity) {
  if (humidity < 70) return 1.00;
  if (humidity < 80) return 0.90;
  if (humidity < 85) return 0.80;
  if (humidity < 90) return 0.70;
  return 0.60;
}

const weatherService = {
  async getCurrentConditions(lat, lon) {
    const cacheKey = `weather:current:${lat}:${lon}`;

    // 1. Try Redis cache
    const cached = await redisClient.getJSON(cacheKey);
    if (cached) {
      logger.debug(`Weather cache HIT: ${cacheKey}`);
      return cached;
    }

    // 2. Fetch from OpenWeather
    try {
      const { data } = await axios.get(`${OPENWEATHER_BASE}/weather`, {
        params: {
          lat,
          lon,
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric',
        },
        timeout: 5000,
      });

      const result = {
        city: data.name,
        country: data.sys?.country || '',
        humidity: data.main.humidity,
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        condition: data.weather[0]?.main || 'Clear',
        description: data.weather[0]?.description || 'clear sky',
        icon: data.weather[0]?.icon || '01d',
        windSpeed: Math.round((data.wind?.speed ?? 0) * 3.6), // m/s → km/h
        visibility: data.visibility ? +((data.visibility / 1000).toFixed(1)) : null, // m → km
        pressure: data.main.pressure,
        sunrise: data.sys?.sunrise ?? null, // unix timestamp
        sunset: data.sys?.sunset ?? null,   // unix timestamp
        humidityMultiplier: getHumidityMultiplier(data.main.humidity),
        cachedAt: new Date().toISOString(),
      };

      await redisClient.set(cacheKey, result, CACHE_TTL_CURRENT);

      // DB snapshot for sustained humidity tracking
      await supabase.from('weather_cache').insert({
        lat,
        lon,
        humidity: result.humidity,
        temperature: result.temperature,
        condition: result.condition,
      });

      return result;
    } catch (err) {
      logger.error(`OpenWeather API error: ${err.message}`);

      // 3. DB fallback
      const { data: dbData } = await supabase
        .from('weather_cache')
        .select('humidity, temperature, condition')
        .eq('lat', lat)
        .eq('lon', lon)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (dbData) {
        logger.warn('Using DB weather fallback');
        return {
          city: 'Ho Chi Minh City',
          humidity: dbData.humidity,
          temperature: dbData.temperature,
          condition: dbData.condition,
          humidityMultiplier: getHumidityMultiplier(dbData.humidity),
          cachedAt: new Date().toISOString(),
          source: 'db_fallback',
        };
      }

      // 4. Safe default
      logger.warn('Using safe default weather values');
      return {
        city: 'Unknown',
        humidity: SAFE_DEFAULT_HUMIDITY,
        temperature: 30,
        condition: 'Unknown',
        humidityMultiplier: getHumidityMultiplier(SAFE_DEFAULT_HUMIDITY),
        cachedAt: new Date().toISOString(),
        source: 'default',
      };
    }
  },

  async getForecast(lat, lon) {
    const cacheKey = `weather:forecast:${lat}:${lon}`;

    const cached = await redisClient.getJSON(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await axios.get(`${OPENWEATHER_BASE}/forecast`, {
        params: {
          lat,
          lon,
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric',
          cnt: 40, // 5 days × 8 (3h intervals)
        },
        timeout: 5000,
      });

      // Group by day
      const byDay = {};
      data.list.forEach((item) => {
        const date = item.dt_txt.split(' ')[0];
        if (!byDay[date]) byDay[date] = { humidities: [], temps: [], conditions: [], icons: [], descriptions: [] };
        byDay[date].humidities.push(item.main.humidity);
        byDay[date].temps.push(item.main.temp);
        byDay[date].conditions.push(item.weather[0]?.main);
        byDay[date].icons.push(item.weather[0]?.icon);
        byDay[date].descriptions.push(item.weather[0]?.description);
      });

      const forecast = Object.entries(byDay).map(([date, vals]) => {
        const mid = Math.floor(vals.conditions.length / 2);
        return {
          date,
          avgHumidity: Math.round(vals.humidities.reduce((a, b) => a + b, 0) / vals.humidities.length),
          minTemp: Math.round(Math.min(...vals.temps)),
          maxTemp: Math.round(Math.max(...vals.temps)),
          condition: vals.conditions[mid],
          description: vals.descriptions[mid] || '',
          icon: vals.icons[mid] || '01d',
        };
      });

      await redisClient.set(cacheKey, { forecast }, CACHE_TTL_FORECAST);
      return { forecast };
    } catch (err) {
      logger.error(`OpenWeather forecast error: ${err.message}`);
      const apiErr = new Error('Weather forecast service unavailable.');
      apiErr.status = 500;
      apiErr.code = 'WEATHER_FETCH_FAILED';
      throw apiErr;
    }
  },

  // Check if humidity has been >= 85% for 72+ hours (CRITICAL override trigger)
  async checkSustainedHighHumidity(lat, lon) {
    const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('weather_cache')
      .select('humidity, recorded_at')
      .eq('lat', lat)
      .eq('lon', lon)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true });

    if (!data || data.length < 3) return { sustained: false, hours: 0 };

    const allHigh = data.every((r) => r.humidity >= 85);
    return { sustained: allHigh, hours: allHigh ? 72 : 0 };
  },

  getHumidityMultiplier,
};

module.exports = weatherService;
