// backend/controllers/weatherController.js

const axios = require("axios");
const Farm  = require("../models/Farm");
const { getWeatherAdvice } = require("../services/aiService");

// ── Open-Meteo helpers ─────────────────────────────────────────────────────

/**
 * Geocode an Indian pincode to lat/lng using the free
 * api.zippopotam.us service (no API key required).
 */
const geocodePincode = async (pincode) => {
  try {
    const res = await axios.get(
      `https://api.zippopotam.us/in/${pincode}`,
      { timeout: 5000 }
    );
    const place = res.data?.places?.[0];
    if (place) {
      return {
        lat: parseFloat(place.latitude),
        lng: parseFloat(place.longitude),
      };
    }
  } catch {
    // Fallback to geographic centre of India if geocoding fails
  }
  return { lat: 22.9734, lng: 78.6569 }; // centre of India
};

/**
 * Fetch 7-day weather forecast from Open-Meteo (completely free, no API key).
 * Returns an array of DayForecast objects.
 */
const fetchWeatherForecast = async (lat, lng) => {
  const url = "https://api.open-meteo.com/v1/forecast";
  const params = {
    latitude:  lat,
    longitude: lng,
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "windspeed_10m_max",
      "weathercode",
    ].join(","),
    timezone:    "Asia/Kolkata",
    forecast_days: 7,
  };

  const res = await axios.get(url, { params, timeout: 10000 });
  const d   = res.data.daily;

  return d.time.map((date, i) => ({
    date:          date,
    temp_max:      d.temperature_2m_max[i],
    temp_min:      d.temperature_2m_min[i],
    precipitation: d.precipitation_sum[i] || 0,
    wind_speed:    d.windspeed_10m_max[i]  || 0,
    weather_code:  d.weathercode[i]        || 0,
  }));
};

// ── Controller ─────────────────────────────────────────────────────────────

/**
 * POST /api/ai/weather/advise
 * Body: { farmId, language }
 */
const weatherAdvice = async (req, res) => {
  try {
    const { farmId, language = "en" } = req.body;

    if (!farmId) {
      return res.status(400).json({ error: "farmId is required." });
    }

    // ── 1. Get farm ────────────────────────────────────────────────────
    const farm = await Farm.findOne({ _id: farmId, user: req.user.id });
    if (!farm) {
      return res.status(404).json({ error: "Farm not found." });
    }

    // ── 2. Resolve coordinates ─────────────────────────────────────────
    let lat = farm.coordinates?.lat;
    let lng = farm.coordinates?.lng;

    if (!lat || !lng) {
      if (farm.pincode) {
        const coords = await geocodePincode(farm.pincode);
        lat = coords.lat;
        lng = coords.lng;
      } else {
        // Use Jaipur, Rajasthan as sensible default for Indian farms
        lat = 26.9124;
        lng = 75.7873;
      }
    }

    // ── 3. Fetch live 7-day forecast ───────────────────────────────────
    let forecast;
    try {
      forecast = await fetchWeatherForecast(lat, lng);
    } catch (weatherErr) {
      console.error("[weatherController] Open-Meteo fetch failed:", weatherErr.message);
      return res.status(502).json({
        error: "Could not fetch live weather data. Please try again.",
      });
    }

    // ── 4. Forward to FastAPI for crop-specific advice ─────────────────
    const payload = {
      farm_name:    farm.name,
      current_crop: farm.current_crop,
      soil_type:    farm.soilType   || "loam",
      size_acres:   farm.size_acres || 1.0,
      forecast,
      language,
    };

    const data = await getWeatherAdvice(payload);

    return res.status(200).json({
      success:      true,
      farm_name:    farm.name,
      current_crop: farm.current_crop,
      location:     { lat, lng },
      forecast,     // send raw forecast to frontend for the mini-chart
      ...data,
    });
  } catch (err) {
    console.error("[weatherController] Error:", err.message);

    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
      return res.status(503).json({ error: "AI service temporarily unavailable." });
    }
    return res.status(500).json({ error: "Internal server error." });
  }
};

module.exports = { weatherAdvice };