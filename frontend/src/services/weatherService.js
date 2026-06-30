// // src/services/weatherService.js
// import axios from 'axios';

// // 1. Convert City Name to Lat/Lon
// export const getCoordinates = async (city) => {
//   try {
//     const url = `https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1&language=en&format=json`;
//     const response = await axios.get(url);
//     if (!response.data.results) throw new Error("City not found");
//     return response.data.results[0]; // Returns { latitude, longitude, name, country }
//   } catch (error) {
//     console.error("Geocoding Error:", error);
//     return null;
//   }
// };

// export const getWeatherByCoordinates = async (
//   latitude,
//   longitude
// ) => {
//   try {
//     const url =
//       `https://api.open-meteo.com/v1/forecast` +
//       `?latitude=${latitude}` +
//       `&longitude=${longitude}` +
//       `&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m` +
//       `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum` +
//       `&timezone=auto`;

//     const response = await axios.get(url);

//     return response.data;
//   } catch (error) {
//     console.error(error);
//     return null;
//   }
// };
// // 2. Get 7-Day Weather
// export const getWeather = async (lat, lon) => {
//   try {
//     const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,rain_sum&timezone=auto`;
//     const response = await axios.get(url);
//     return response.data;
//   } catch (error) {
//     console.error("Weather API Error:", error);
//     return null;
//   }
// };
// // 
// // 3. Helper to map WMO codes to Icons/Labels
// export const getWeatherIcon = (code) => {
//     // WMO Weather interpretation codes (0-99)
//     if (code === 0) return { label: "Clear Sky", icon: "☀️", color: "text-amber-500", bg: "from-blue-400 to-blue-200" };
//     if (code >= 1 && code <= 3) return { label: "Partly Cloudy", icon: "⛅", color: "text-blue-400", bg: "from-blue-500 to-slate-200" };
//     if (code >= 45 && code <= 48) return { label: "Foggy", icon: "🌫️", color: "text-slate-500", bg: "from-slate-400 to-slate-200" };
//     if (code >= 51 && code <= 67) return { label: "Rainy", icon: "Vm🌧️", color: "text-blue-600", bg: "from-slate-700 to-blue-500" };
//     if (code >= 71 && code <= 77) return { label: "Snow", icon: "❄️", color: "text-cyan-500", bg: "from-blue-800 to-blue-300" };
//     if (code >= 80 && code <= 82) return { label: "Heavy Rain", icon: "Vm⛈️", color: "text-indigo-600", bg: "from-slate-800 to-slate-500" };
//     if (code >= 95) return { label: "Thunderstorm", icon: "Vm⚡", color: "text-purple-600", bg: "from-indigo-900 to-slate-700" };
//     return { label: "Unknown", icon: "❓", color: "text-gray-500", bg: "from-gray-400 to-gray-200" };
// };

// src/services/weatherService.js
// =============================================================================
// Weather Service — Open-Meteo (no API key required)
// =============================================================================
// FIXES (Phase 1):
//   1. Removed garbage "Vm" prefix from emoji icons (was "Vm🌧️" etc.)
//   2. getWeatherByCoordinates properly exported and named
//   3. getWeather kept as alias for backward compatibility
// =============================================================================

import axios from "axios";

// ─── 1. Geocode city name → { latitude, longitude, name } ────────────────────
export const getCoordinates = async (city) => {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const response = await axios.get(url);
    if (!response.data.results || response.data.results.length === 0) {
      throw new Error("City not found");
    }
    return response.data.results[0]; // { latitude, longitude, name, country }
  } catch (error) {
    console.error("Geocoding Error:", error);
    return null;
  }
};

// ─── 2. Fetch full weather (current + daily) by coordinates ───────────────────
// Used by WeatherPage, Dashboard weather widget, and anywhere lat/lng is known.
export const getWeatherByCoordinates = async (latitude, longitude) => {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m,relative_humidity_2m,is_day,precipitation,rain,weather_code,wind_speed_10m` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,rain_sum` +
      `&timezone=auto`;

    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Weather by coordinates Error:", error);
    return null;
  }
};

// ─── 3. Alias kept for any legacy call sites ──────────────────────────────────
export const getWeather = getWeatherByCoordinates;

// ─── 4. WMO weather code → icon / label / bg gradient ────────────────────────
// FIX: Removed "Vm" garbage prefix from emoji strings
export const getWeatherIcon = (code) => {
  if (code === 0)
    return {
      label: "Clear Sky",
      icon: "☀️",
      color: "text-amber-500",
      bg: "from-blue-400 to-blue-200",
    };
  if (code >= 1 && code <= 3)
    return {
      label: "Partly Cloudy",
      icon: "⛅",
      color: "text-blue-400",
      bg: "from-blue-500 to-slate-200",
    };
  if (code >= 45 && code <= 48)
    return {
      label: "Foggy",
      icon: "🌫️",
      color: "text-slate-500",
      bg: "from-slate-400 to-slate-200",
    };
  if (code >= 51 && code <= 67)
    return {
      label: "Rainy",
      icon: "🌧️",                          // FIX: was "Vm🌧️"
      color: "text-blue-600",
      bg: "from-slate-700 to-blue-500",
    };
  if (code >= 71 && code <= 77)
    return {
      label: "Snow",
      icon: "❄️",
      color: "text-cyan-500",
      bg: "from-blue-800 to-blue-300",
    };
  if (code >= 80 && code <= 82)
    return {
      label: "Heavy Rain",
      icon: "⛈️",                           // FIX: was "Vm⛈️"
      color: "text-indigo-600",
      bg: "from-slate-800 to-slate-500",
    };
  if (code >= 95)
    return {
      label: "Thunderstorm",
      icon: "⚡",                            // FIX: was "Vm⚡"
      color: "text-purple-600",
      bg: "from-indigo-900 to-slate-700",
    };
  return {
    label: "Unknown",
    icon: "❓",
    color: "text-gray-500",
    bg: "from-gray-400 to-gray-200",
  };
};