
import React, { useState, useEffect, useCallback } from "react";
import {
  getCoordinates,
  getWeatherByCoordinates,
  getWeatherIcon,
} from "../services/weatherService";
import {
  FaMapMarkerAlt,
  FaWind,
  FaTint,
  FaSun,
  FaUmbrella,
  FaLeaf,
  FaChevronDown,
} from "react-icons/fa";
import { WiSunrise, WiSunset } from "react-icons/wi";
import API from "../services/api";
import { formatFarmAreaAcres, getCropLabel } from "../utils/farmDisplay";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve coordinates from a farm object.
 * Priority: farm.coordinates → geocode pincode → India centre
 */
const resolveFarmCoords = async (farm) => {
  if (!farm) return { lat: 22.9734, lng: 78.6569, label: "India" };

  // 1. Direct coordinates stored on farm
  if (farm.coordinates?.lat && farm.coordinates?.lng) {
    return {
      lat: farm.coordinates.lat,
      lng: farm.coordinates.lng,
      label: farm.location || farm.name || "Farm",
    };
  }

  // 2. Geocode pincode via Open-Meteo geocoding
  if (farm.pincode) {
    try {
      const result = await getCoordinates(farm.pincode);
      if (result) {
        return {
          lat: result.latitude,
          lng: result.longitude,
          label: result.name || farm.name || farm.pincode,
        };
      }
    } catch {
      /* fall through */
    }
  }

  // 3. Geocode location string (e.g. "Jaipur, Rajasthan")
  if (farm.location) {
    try {
      const result = await getCoordinates(farm.location);
      if (result) {
        return {
          lat: result.latitude,
          lng: result.longitude,
          label: result.name || farm.location,
        };
      }
    } catch {
      /* fall through */
    }
  }

  // 4. Centre of India fallback
  return { lat: 22.9734, lng: 78.6569, label: "India (Default)" };
};

// =============================================================================
// WeatherPage
// =============================================================================
const WeatherPage = () => {
  // ── State ────────────────────────────────────────────────────────────────────
  const [farms, setFarms]               = useState([]);
  const [selectedFarm, setSelectedFarm] = useState(null);
  const [locationLabel, setLocationLabel] = useState("Loading…");
  const [weather, setWeather]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [searchInput, setSearchInput]   = useState("");
  const [searchError, setSearchError]   = useState("");

  // ── Step 1: Load user's farms on mount ────────────────────────────────────
  useEffect(() => {
    const fetchFarms = async () => {
      try {
        // Correct route: GET /farms/farm → returns array
        const res = await API.get("/farms/farm");
        const farmList = Array.isArray(res.data) ? res.data : [];
        setFarms(farmList);

        // Default to first farm (most recently created)
        if (farmList.length > 0) {
          setSelectedFarm(farmList[0]);
        } else {
          // No farms — use India centre and stop loading
          await fetchWeatherByCoords(22.9734, 78.6569, "India (No farm set up)");
        }
      } catch (err) {
        console.error("Farm fetch error:", err);
        // Fallback gracefully
        await fetchWeatherByCoords(22.9734, 78.6569, "India (Default)");
      }
    };
    fetchFarms();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Step 2: When selected farm changes, resolve coords + fetch weather ─────
  useEffect(() => {
    if (!selectedFarm) return;

    const loadFarmWeather = async () => {
      setLoading(true);
      setSearchError("");
      try {
        const { lat, lng, label } = await resolveFarmCoords(selectedFarm);
        await fetchWeatherByCoords(lat, lng, label);
      } catch (err) {
        console.error("Farm weather load error:", err);
        setLoading(false);
      }
    };

    loadFarmWeather();
  }, [selectedFarm]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core weather fetcher ──────────────────────────────────────────────────
  const fetchWeatherByCoords = useCallback(async (lat, lng, label) => {
    setLoading(true);
    try {
      const data = await getWeatherByCoordinates(lat, lng);
      if (data) {
        setWeather(data);
        setLocationLabel(label);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Manual city search ────────────────────────────────────────────────────
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearchError("");
    setLoading(true);

    const coords = await getCoordinates(searchInput.trim());
    if (coords) {
      setSelectedFarm(null); // deselect farm so farm useEffect doesn't fire
      await fetchWeatherByCoords(
        coords.latitude,
        coords.longitude,
        `${coords.name}${coords.country ? `, ${coords.country}` : ""}`
      );
      setSearchInput("");
    } else {
      setSearchError("City not found. Try a different name.");
      setLoading(false);
    }
  };

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-400 to-blue-200">
        <div className="text-white text-center">
          <div className="text-6xl mb-4 animate-pulse">🌤️</div>
          <p className="text-xl font-bold animate-pulse">Loading Forecast…</p>
          <p className="text-sm opacity-70 mt-1">
            {selectedFarm ? `Fetching weather for ${selectedFarm.name}` : "Detecting farm location"}
          </p>
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 gap-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-slate-600 font-semibold">Failed to load weather data.</p>
        <button
          onClick={() => selectedFarm
            ? setSelectedFarm({ ...selectedFarm })   // force re-trigger
            : fetchWeatherByCoords(22.9734, 78.6569, "India")
          }
          className="px-6 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ── Derived display data ──────────────────────────────────────────────────
  const current     = weather.current;
  const daily       = weather.daily;
  const weatherInfo = getWeatherIcon(current.weather_code);

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${weatherInfo.bg} p-4 md:p-8 transition-all duration-1000`}
    >
      <div className="max-w-5xl mx-auto">

        {/* ── Header: Location + Farm Selector + Search ─────────────────────── */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div className="text-white drop-shadow-md">
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <FaMapMarkerAlt className="text-2xl opacity-80" />
              {locationLabel}
            </h1>
            <p className="text-lg opacity-90 font-medium mt-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>

            {/* Farm selector (shown when user has farms) */}
            {farms.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <FaLeaf className="opacity-70" />
                <div className="relative">
                  <select
                    value={selectedFarm?._id || ""}
                    onChange={(e) => {
                      const f = farms.find((x) => x._id === e.target.value);
                      if (f) setSelectedFarm(f);
                    }}
                    className="appearance-none bg-white/20 backdrop-blur-sm text-white font-semibold text-sm px-3 py-1.5 pr-8 rounded-full border border-white/30 outline-none cursor-pointer"
                  >
                    <option value="" className="text-slate-800">
                      — Manual search —
                    </option>
                    {farms.map((f) => (
                      <option key={f._id} value={f._id} className="text-slate-800">
                        {f.name}
                        {f.current_crop ? ` (${getCropLabel(f.current_crop)})` : ""}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/70 text-xs pointer-events-none" />
                </div>
                <span className="text-xs opacity-60 font-medium">Select farm</span>
              </div>
            )}
          </div>

          {/* City search */}
          <div className="w-full md:w-96">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search city (e.g. Mumbai, Jaipur)"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full px-6 py-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white placeholder-white/70 outline-none focus:bg-white/30 transition-all shadow-lg font-semibold"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/30 hover:bg-white/40 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all"
              >
                Search
              </button>
            </form>
            {searchError && (
              <p className="text-white/80 text-xs mt-1.5 text-right font-medium">
                ⚠️ {searchError}
              </p>
            )}
          </div>
        </div>

        {/* ── Current Weather Hero ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">

          {/* Main current stats */}
          <div className="bg-white/30 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 text-white shadow-2xl border border-white/20 flex flex-col justify-between relative overflow-hidden group hover:scale-[1.01] transition-transform">
            <div className="z-10">
              <div className="flex items-center gap-4 mb-2">
                <span className="bg-white/20 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                  Now
                </span>
                <span className="text-sm font-bold opacity-80">
                  {weatherInfo.label}
                </span>
              </div>
              <div className="flex items-start">
                <span className="text-[8rem] md:text-[10rem] font-black leading-none tracking-tighter">
                  {Math.round(current.temperature_2m)}
                </span>
                <span className="text-4xl md:text-6xl font-bold mt-4 md:mt-8">°C</span>
              </div>
            </div>

            <div className="z-10 mt-8 grid grid-cols-3 gap-4 text-center">
              <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <FaWind className="mx-auto text-2xl mb-2 opacity-80" />
                <p className="text-sm font-bold">
                  {current.wind_speed_10m}{" "}
                  <span className="text-[10px] opacity-70">km/h</span>
                </p>
                <p className="text-[10px] opacity-60">Wind</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <FaTint className="mx-auto text-2xl mb-2 opacity-80" />
                <p className="text-sm font-bold">
                  {current.relative_humidity_2m}%
                </p>
                <p className="text-[10px] opacity-60">Humidity</p>
              </div>
              <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm">
                <FaUmbrella className="mx-auto text-2xl mb-2 opacity-80" />
                <p className="text-sm font-bold">
                  {current.precipitation ?? current.rain ?? 0}{" "}
                  <span className="text-[10px] opacity-70">mm</span>
                </p>
                <p className="text-[10px] opacity-60">Rain</p>
              </div>
            </div>

            {/* Decorative icon background */}
            <div className="absolute -right-10 -top-10 text-[15rem] opacity-20 pointer-events-none select-none">
              {weatherInfo.icon}
            </div>
          </div>

          {/* Sunrise / Sunset + Farm Advice */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-amber-300 to-orange-400 rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col justify-center items-center relative overflow-hidden">
              <WiSunrise className="text-8xl relative z-10" />
              <p className="text-2xl font-bold relative z-10">
                {new Date(daily.sunrise[0]).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-sm opacity-80 relative z-10">Sunrise</p>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full blur-3xl" />
            </div>

            <div className="bg-gradient-to-br from-indigo-400 to-purple-500 rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col justify-center items-center relative overflow-hidden">
              <WiSunset className="text-8xl relative z-10" />
              <p className="text-2xl font-bold relative z-10">
                {new Date(daily.sunset[0]).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-sm opacity-80 relative z-10">Sunset</p>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-3xl" />
            </div>

            {/* Farm-specific advice */}
            <div className="md:col-span-2 bg-white/40 backdrop-blur-md rounded-[2.5rem] p-6 shadow-lg border border-white/30">
              <h3 className="text-white font-bold text-lg mb-3 flex items-center gap-2">
                <FaSun className="text-yellow-300" /> Field Advisory
              </h3>
              <p className="text-white font-medium opacity-90 leading-relaxed text-sm">
                {current.temperature_2m > 35
                  ? "⚠️ Extreme heat. Irrigate early morning or after sunset to minimise evaporation."
                  : current.temperature_2m > 30
                  ? "☀️ High heat detected. Ensure irrigation systems are active to prevent crop stress."
                  : (current.precipitation ?? current.rain ?? 0) > 0
                  ? "🌧️ Rain detected. Consider pausing scheduled irrigation to save water."
                  : current.wind_speed_10m > 30
                  ? "💨 High winds. Delay sprinkler irrigation to avoid drift losses."
                  : "✅ Conditions are optimal for field work and irrigation."}
              </p>
              {selectedFarm && (
                <p className="text-white/70 text-xs mt-2 font-medium">
                  📍 {selectedFarm.name} — {getCropLabel(selectedFarm.current_crop, "Mixed crop")}
                  {formatFarmAreaAcres(selectedFarm) !== "0" ? ` · ${formatFarmAreaAcres(selectedFarm)} acres` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── 7-Day Forecast ─────────────────────────────────────────────────── */}
        <h2 className="text-white text-2xl font-bold mb-6 ml-2 drop-shadow-sm">
          7-Day Forecast
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {daily.time.map((time, index) => {
            const dayIcon = getWeatherIcon(daily.weather_code[index]);
            const date    = new Date(time);
            const isToday = index === 0;

            return (
              <div
                key={index}
                className={`backdrop-blur-md rounded-3xl p-4 flex flex-col items-center justify-between shadow-lg border border-white/10 transition-all hover:-translate-y-2 ${
                  isToday ? "bg-white/40 ring-4 ring-white/20" : "bg-white/20"
                }`}
              >
                <p className="text-white text-sm font-bold uppercase tracking-wider">
                  {isToday
                    ? "Today"
                    : date.toLocaleDateString("en-US", { weekday: "short" })}
                </p>
                <div className="text-4xl my-3 drop-shadow-lg">{dayIcon.icon}</div>
                <div className="text-white text-center">
                  <p className="font-black text-xl">
                    {Math.round(daily.temperature_2m_max[index])}°
                  </p>
                  <p className="text-xs opacity-80 font-medium">
                    {Math.round(daily.temperature_2m_min[index])}°
                  </p>
                </div>
                {(daily.precipitation_sum?.[index] ?? daily.rain_sum?.[index] ?? 0) > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-100 font-bold bg-blue-500/30 px-2 py-0.5 rounded-full">
                    <FaUmbrella />{" "}
                    {(daily.precipitation_sum?.[index] ?? daily.rain_sum?.[index] ?? 0).toFixed(1)}mm
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default WeatherPage;
