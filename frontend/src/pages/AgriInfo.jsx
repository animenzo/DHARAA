// =============================================================================
// AgriInfo.jsx — Agriculture Information Hub
// =============================================================================
// Smart Irrigation Platform — Agri Information Center
// Theme: Dark Emerald Glassmorphism
// Fonts: 'Playfair Display' (headings) + 'DM Sans' (body) via Google Fonts
// Languages: English / हिन्दी (bilingual toggle, persisted to localStorage)
//
// Sections:
//   1.  Hero + Stats
//   2.  Government News (NewsData.io / GNews fallback)
//   3.  Government Schemes Panel
//   4.  Live Mandi Prices (data.gov.in + Agmarknet external link fallback)
//   5.  Crop Price Trend Chart (Recharts)
//   6.  Weather Forecast (Open-Meteo — no API key needed, GPS auto-detect)
//   7.  District Rainfall Data (data.gov.in)
//   8.  Soil Health Information
//   9.  YouTube Agriculture Videos
//   10. Farmer Query Insights
//   11. Bookmark Crops
//   12. Last Updated Panel
//   13. Auto-Refresh (30 min)
//   14. LocalStorage Caching (30 min)
//   15. Skeleton Loaders + Error Cards
//
// FIXES IN THIS VERSION:
//   • fetchWeather(null) bug fixed — geolocation no longer sends name=null
//     to Open-Meteo geocoding (was causing 400 Bad Request)
//   • data.gov.in CORS issue documented — browsers cannot call
//     api.data.gov.in directly (no Access-Control-Allow-Origin header).
//     Mandi section now shows a clear notice + "Open Agmarknet ↗" /
//     "Open eNAM ↗" external link buttons as the practical workaround.
//   • Added 🏠 Home button (top-left, fixed)
//   • Added 🌐 English/हिन्दी language toggle (top-right, fixed)
//
// ENV VARS required (Vite):
//   VITE_NEWSDATA_API_KEY      — newsdata.io key
//   VITE_GNEWS_API_KEY         — gnews.io key (fallback)
//   VITE_YOUTUBE_API_KEY       — Google YouTube Data API v3 key
//   VITE_DATAGOV_API_KEY       — data.gov.in key (blocked by CORS in-browser;
//                                 kept for future backend-proxy use)
//
// NOTE: VITE_OPENWEATHER_API_KEY is NO LONGER USED — weather is 100% free
//       via Open-Meteo (https://open-meteo.com), no key required.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiRefreshCw, FiBookmark, FiExternalLink, FiSearch,
  FiChevronDown, FiAlertTriangle, FiCheck, FiX,
  FiDroplet, FiWind, FiThermometer, FiCloud,
  FiTrendingUp, FiTrendingDown, FiPlay,
  FiSun, FiMoon, FiActivity, FiFilter,
  FiHome, FiGlobe, FiInfo,
} from "react-icons/fi";
import {
  GiWheat, GiPlantRoots, GiFarmer, GiWateringCan,
  GiSeedling, GiThermometerScale,
} from "react-icons/gi";
import {
  MdWaterDrop, MdGrain,
} from "react-icons/md";
import { BsCloudRainHeavy, BsSunrise } from "react-icons/bs";

// ── Google Fonts injection ────────────────────────────────────────────────────
if (!document.getElementById("agriinfo-fonts")) {
  const link = document.createElement("link");
  link.id = "agriinfo-fonts";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

// =============================================================================
// SECTION 0: BILINGUAL (EN / HI) TRANSLATION DICTIONARY
// =============================================================================
const TRANSLATIONS = {
  en: {
    liveTag: "Live · Auto-Refreshing Every 30 Minutes",
    heroTitle1: "Agri Information",
    heroTitle2: " Center",
    heroSubtitle: "Live Government Schemes · Market Prices · Weather Advisories · Agricultural Updates",
    statNews: "News Articles",
    statSchemes: "Govt Schemes",
    statCrops: "Crops Tracked",
    statUpdated: "Last Updated",
    loading: "Loading…",

    newsTitle: "Agriculture News & Schemes",
    newsSubtitle: "Latest updates from government portals and agricultural news sources",
    updated: "Updated",
    readMore: "Read More",
    prev: "← Prev",
    next: "Next →",

    schemesTitle: "Government Schemes",
    schemesSubtitle: "Active schemes for farmers — eligibility, benefits, and direct apply links",
    eligibility: "Eligibility",
    benefits: "Benefits",
    applyNow: "Apply Now",

    mandiTitle: "Live Mandi Prices",
    mandiSubtitle: "Government commodity price data (CORS-restricted in-browser)",
    mandiCorsNotice: "Browser security (CORS) blocks direct calls to api.data.gov.in. Showing representative sample data. For live prices, use the official portals below:",
    openAgmarknet: "Open Agmarknet",
    openEnam: "Open eNAM",
    searchPlaceholder: "Search crop, district…",
    noResults: "No results found",
    results: "results",
    commodity: "Commodity",
    stateDistrict: "State/District",
    market: "Market",
    minPrice: "Min ₹",
    maxPrice: "Max ₹",
    modalPrice: "Modal ₹",

    trendTitle: "Crop Price Trends",
    trendSubtitle: "7-day modal price movement",
    weekChange: "7-Day Change",
    weeklyAvg: "Weekly Avg",
    today: "Today",

    weatherTitle: "Weather Forecast",
    weatherSubtitle: "Powered by Open-Meteo · No API key required · Auto-detects your location",
    enterCity: "Enter city…",
    myLocation: "📍 My Location",
    humidity: "Humidity",
    wind: "Wind",
    rainChance: "Rain Chance",
    feelsLike: "Feels Like",
    rainAlert: "High rain probability ({pct}%) today. Plan field activities accordingly.",

    rainfallTitle: "District Rainfall Data",
    rainfallSubtitle: "Weekly, monthly, and seasonal rainfall accumulation",
    weekly: "Weekly",
    monthly: "Monthly",
    seasonal: "Seasonal",
    mmThisWeek: "mm this week",

    soilTitle: "Soil Health Summary",
    soilSubtitle: "Nutrient status and recommendations for your district",
    recommendation: "💡 Recommendation",
    soilRecommendationText: "Phosphorus levels are low. Apply 60 kg/ha of DAP before sowing. Soil organic carbon is at medium level — consider adding farmyard manure to improve water retention.",

    videosTitle: "Doordarshan Kisan — Latest Videos",
    videosSubtitle: "Agriculture programs, advisories, and farmer success stories",
    noVideos: "No videos available. Configure VITE_YOUTUBE_API_KEY.",
    visitChannel: "Visit Doordarshan Kisan Channel",

    queryTitle: "Farmer Query Insights",
    querySubtitle: "Most common topics raised by farmers",

    bookmarkTitle: "Bookmark Crops",
    bookmarkSubtitle: "Track crops you care about (saved locally)",
    addCropPlaceholder: "Add crop… e.g. Jowar",
    add: "+ Add",
    noBookmarks: "No bookmarked crops yet",

    freshnessTitle: "Data Freshness",
    freshnessSubtitle: "Cache status for all data sources",
    newsLabel: "Agriculture News",
    mandiLabel: "Mandi Prices",
    weatherLabel: "Weather Forecast",
    rainfallLabel: "Rainfall Data",
    videosLabel: "YouTube Videos",
    notLoaded: "Not loaded",
    refreshAll: "Refresh All Data Now",
    autoRefreshNote: "Auto-refresh every 30 minutes",

    footerLine1: "AgriInfo Hub · DHARAA Smart Irrigation Platform · Data: NewsData.io, Open-Meteo, YouTube",
    footerLine2: "Cache TTL: 30 min · Auto-refresh: 30 min · All prices in ₹/quintal",

    home: "Home",
    tryAgain: "Try Again",
  },

  hi: {
    liveTag: "लाइव · हर 30 मिनट में ऑटो-रिफ्रेश",
    heroTitle1: "कृषि सूचना",
    heroTitle2: " केंद्र",
    heroSubtitle: "लाइव सरकारी योजनाएं · बाज़ार भाव · मौसम सलाह · कृषि समाचार",
    statNews: "समाचार लेख",
    statSchemes: "सरकारी योजनाएं",
    statCrops: "ट्रैक की गई फसलें",
    statUpdated: "अंतिम अपडेट",
    loading: "लोड हो रहा है…",

    newsTitle: "कृषि समाचार और योजनाएं",
    newsSubtitle: "सरकारी पोर्टल और कृषि समाचार स्रोतों से नवीनतम जानकारी",
    updated: "अपडेट किया गया",
    readMore: "अधिक पढ़ें",
    prev: "← पिछला",
    next: "आगे →",

    schemesTitle: "सरकारी योजनाएं",
    schemesSubtitle: "किसानों के लिए सक्रिय योजनाएं — पात्रता, लाभ, और सीधा आवेदन लिंक",
    eligibility: "पात्रता",
    benefits: "लाभ",
    applyNow: "अभी आवेदन करें",

    mandiTitle: "लाइव मंडी भाव",
    mandiSubtitle: "सरकारी कमोडिटी मूल्य डेटा (ब्राउज़र में CORS प्रतिबंधित)",
    mandiCorsNotice: "ब्राउज़र सुरक्षा (CORS) के कारण api.data.gov.in को सीधे कॉल करना संभव नहीं है। यहाँ नमूना डेटा दिखाया जा रहा है। लाइव भाव के लिए कृपया नीचे दिए गए आधिकारिक पोर्टल खोलें:",
    openAgmarknet: "एगमार्कनेट खोलें",
    openEnam: "ई-नाम खोलें",
    searchPlaceholder: "फसल, जिला खोजें…",
    noResults: "कोई परिणाम नहीं मिला",
    results: "परिणाम",
    commodity: "जिंस",
    stateDistrict: "राज्य/जिला",
    market: "मंडी",
    minPrice: "न्यूनतम ₹",
    maxPrice: "अधिकतम ₹",
    modalPrice: "मोडल ₹",

    trendTitle: "फसल मूल्य रुझान",
    trendSubtitle: "7-दिन का मोडल मूल्य परिवर्तन",
    weekChange: "7-दिन परिवर्तन",
    weeklyAvg: "साप्ताहिक औसत",
    today: "आज",

    weatherTitle: "मौसम पूर्वानुमान",
    weatherSubtitle: "Open-Meteo द्वारा संचालित · कोई API कुंजी आवश्यक नहीं · आपका स्थान स्वतः पहचानता है",
    enterCity: "शहर दर्ज करें…",
    myLocation: "📍 मेरा स्थान",
    humidity: "नमी",
    wind: "हवा",
    rainChance: "वर्षा संभावना",
    feelsLike: "महसूस हो रहा",
    rainAlert: "आज भारी वर्षा की संभावना ({pct}%) है। खेत के कार्यों की योजना अनुसार बनाएं।",

    rainfallTitle: "जिला वर्षा डेटा",
    rainfallSubtitle: "साप्ताहिक, मासिक और मौसमी वर्षा संचय",
    weekly: "साप्ताहिक",
    monthly: "मासिक",
    seasonal: "मौसमी",
    mmThisWeek: "मिमी इस सप्ताह",

    soilTitle: "मिट्टी स्वास्थ्य सारांश",
    soilSubtitle: "आपके जिले के लिए पोषक तत्व स्थिति और सिफारिशें",
    recommendation: "💡 सिफारिश",
    soilRecommendationText: "फॉस्फोरस का स्तर कम है। बुवाई से पहले 60 किग्रा/हेक्टेयर DAP डालें। मिट्टी में जीवांश कार्बन मध्यम स्तर पर है — जल धारण क्षमता बढ़ाने के लिए गोबर की खाद डालने पर विचार करें।",

    videosTitle: "दूरदर्शन किसान — नवीनतम वीडियो",
    videosSubtitle: "कृषि कार्यक्रम, सलाह और किसानों की सफलता की कहानियां",
    noVideos: "कोई वीडियो उपलब्ध नहीं। VITE_YOUTUBE_API_KEY सेट करें।",
    visitChannel: "दूरदर्शन किसान चैनल देखें",

    queryTitle: "किसान प्रश्न विश्लेषण",
    querySubtitle: "किसानों द्वारा सबसे अधिक पूछे जाने वाले विषय",

    bookmarkTitle: "फसल बुकमार्क",
    bookmarkSubtitle: "अपनी पसंदीदा फसलों को ट्रैक करें (स्थानीय रूप से सहेजा गया)",
    addCropPlaceholder: "फसल जोड़ें… जैसे ज्वार",
    add: "+ जोड़ें",
    noBookmarks: "अभी तक कोई फसल बुकमार्क नहीं की गई",

    freshnessTitle: "डेटा ताज़गी",
    freshnessSubtitle: "सभी डेटा स्रोतों की कैश स्थिति",
    newsLabel: "कृषि समाचार",
    mandiLabel: "मंडी भाव",
    weatherLabel: "मौसम पूर्वानुमान",
    rainfallLabel: "वर्षा डेटा",
    videosLabel: "यूट्यूब वीडियो",
    notLoaded: "लोड नहीं हुआ",
    refreshAll: "सभी डेटा अभी रिफ्रेश करें",
    autoRefreshNote: "हर 30 मिनट में ऑटो-रिफ्रेश",

    footerLine1: "AgriInfo Hub · DHARAA स्मार्ट सिंचाई प्लेटफॉर्म · डेटा: NewsData.io, Open-Meteo, YouTube",
    footerLine2: "कैश अवधि: 30 मिनट · ऑटो-रिफ्रेश: 30 मिनट · सभी मूल्य ₹/क्विंटल में",

    home: "होम",
    tryAgain: "पुनः प्रयास करें",
  },
};

// =============================================================================
// SECTION 14: CACHING UTILITIES
// Cache duration: 30 minutes
// =============================================================================
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in ms
const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes auto-refresh

function getCachedData(key) {
  try {
    const raw = localStorage.getItem(`agriinfo_${key}`);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > CACHE_TTL) {
      localStorage.removeItem(`agriinfo_${key}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedData(key, data) {
  try {
    localStorage.setItem(
      `agriinfo_${key}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {
    // localStorage quota exceeded — ignore
  }
}

function getCacheAge(key) {
  try {
    const raw = localStorage.getItem(`agriinfo_${key}`);
    if (!raw) return null;
    const { timestamp } = JSON.parse(raw);
    return timestamp;
  } catch {
    return null;
  }
}

function timeAgo(ts, lang = "en") {
  if (!ts) return lang === "hi" ? "कभी नहीं" : "Never";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (lang === "hi") {
    if (diff < 60) return `${diff} सेकंड पहले`;
    if (diff < 3600) return `${Math.floor(diff / 60)} मिनट पहले`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} घंटे पहले`;
    return new Date(ts).toLocaleDateString("hi-IN");
  }
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString("en-IN");
}

// =============================================================================
// API SERVICE FUNCTIONS
// =============================================================================

// ── Agri News (NewsData.io → GNews fallback) ─────────────────────────────────
async function fetchAgriNews() {
  const cached = getCachedData("news");
  if (cached) return cached;

  const keywords = ["agriculture india", "kisan", "PM-KISAN", "crop insurance", "irrigation"];
  const ndKey = import.meta.env.VITE_NEWSDATA_API_KEY;
  const gnKey = import.meta.env.VITE_GNEWS_API_KEY;

  // Primary: NewsData.io
  if (ndKey) {
    try {
      const res = await axios.get("https://newsdata.io/api/1/news", {
        params: {
          apikey: ndKey,
          q: keywords.join(" OR "),
          country: "in",
          language: "en",
          category: "business,science,top",
        },
        timeout: 8000,
      });
      const articles = (res.data?.results || []).slice(0, 10).map((a) => ({
        id: a.article_id || Math.random().toString(36),
        title: a.title,
        description: a.description || a.content?.substring(0, 140) + "…",
        source: a.source_name || a.source_id,
        publishedAt: a.pubDate,
        image: a.image_url,
        url: a.link,
        category: a.category?.[0] || "agriculture",
      }));
      setCachedData("news", articles);
      return articles;
    } catch (err) {
      console.warn("NewsData.io failed:", err.message);
    }
  }

  // Fallback: GNews
  if (gnKey) {
    try {
      const res = await axios.get("https://gnews.io/api/v4/search", {
        params: {
          q: "agriculture india OR kisan OR PM-KISAN",
          token: gnKey,
          lang: "en",
          country: "in",
          max: 10,
        },
        timeout: 8000,
      });
      const articles = (res.data?.articles || []).slice(0, 10).map((a) => ({
        id: a.url,
        title: a.title,
        description: a.description?.substring(0, 140) + "…",
        source: a.source?.name,
        publishedAt: a.publishedAt,
        image: a.image,
        url: a.url,
        category: "agriculture",
      }));
      setCachedData("news", articles);
      return articles;
    } catch (err) {
      console.warn("GNews failed:", err.message);
    }
  }

  // Demo fallback when no API keys configured
  const demo = DEMO_NEWS;
  setCachedData("news", demo);
  return demo;
}

// ── Mandi Prices ──────────────────────────────────────────────────────────────
// IMPORTANT: api.data.gov.in does NOT send Access-Control-Allow-Origin headers.
// Browsers will ALWAYS block this request with a CORS error, regardless of
// whether the API key is valid. This is a server-side limitation that cannot
// be fixed from frontend code — it would require a backend proxy.
//
// This function still ATTEMPTS the call (in case a proxy/CORS-extension is in
// place, or Anthropic/your backend later proxies it), but gracefully falls
// back to realistic demo data. The UI separately shows direct links to
// Agmarknet/eNAM for users who need live prices right now.
async function fetchMandiPrices() {
  const cached = getCachedData("mandi");
  if (cached) return cached;

  const key = import.meta.env.VITE_DATAGOV_API_KEY;
  if (key) {
    try {
      const res = await axios.get(
        "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
        {
          params: {
            "api-key": key,
            format: "json",
            limit: 100,
            offset: 0,
          },
          timeout: 10000,
        }
      );
      const rows = (res.data?.records || []).map((r, i) => ({
        id: i,
        commodity: r.commodity || r.Commodity || "—",
        state: r.state || r.State || "—",
        district: r.district || r.District || "—",
        market: r.market || r.Market || "—",
        minPrice: parseFloat(r.min_price || r.Min_Price || 0),
        maxPrice: parseFloat(r.max_price || r.Max_Price || 0),
        modalPrice: parseFloat(r.modal_price || r.Modal_Price || 0),
        date: r.arrival_date || r.Arrival_Date || r.date || "",
      }));
      if (rows.length > 0) {
        setCachedData("mandi", rows);
        return rows;
      }
    } catch (err) {
      // Expected in-browser: CORS error (net::ERR_FAILED / Network Error)
      console.warn("Mandi API failed (likely CORS — see comments):", err.message);
    }
  }

  const demo = DEMO_MANDI;
  setCachedData("mandi", demo);
  return demo;
}

// ── Weather (Open-Meteo — 100% free, no API key required) ───────────────────
// Open-Meteo docs: https://open-meteo.com/en/docs

// Step A: Geocode a city name → { lat, lon, city, country }
async function geocodeCity(cityName) {
  const res = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
    params: { name: cityName, count: 1, language: "en", format: "json" },
    timeout: 6000,
  });
  const r = res.data?.results?.[0];
  if (!r) throw new Error(`City not found: ${cityName}`);
  return { lat: r.latitude, lon: r.longitude, city: r.name, country: r.country };
}

// Step B: Fetch current + 7-day forecast for given coordinates
async function fetchWeatherByCoords(lat, lon, cityLabel) {
  const cacheKey = `weather_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const res = await axios.get("https://api.open-meteo.com/v1/forecast", {
    params: {
      latitude: lat,
      longitude: lon,
      current: [
        "temperature_2m", "apparent_temperature", "relative_humidity_2m",
        "wind_speed_10m", "weather_code", "precipitation_probability",
      ].join(","),
      daily: [
        "weather_code", "temperature_2m_max", "temperature_2m_min",
        "precipitation_probability_max",
      ].join(","),
      timezone: "Asia/Kolkata",
      forecast_days: 7,
    },
    timeout: 8000,
  });

  const c = res.data.current;
  const d = res.data.daily;

  const daily = (d.time || []).map((dateStr, i) => {
    const dt = new Date(dateStr);
    const day = dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
    return {
      day,
      min: Math.round(d.temperature_2m_min[i]),
      max: Math.round(d.temperature_2m_max[i]),
      rain: d.precipitation_probability_max[i] ?? 0,
      weatherCode: d.weather_code[i],
    };
  });

  const weather = {
    city: cityLabel,
    lat, lon,
    temp: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    windSpeed: Math.round(c.wind_speed_10m),
    weatherCode: c.weather_code,
    description: wmoDesc(c.weather_code),
    rainChance: c.precipitation_probability ?? 0,
    daily,
    alerts: [],
  };

  setCachedData(cacheKey, weather);
  return weather;
}

// Step C: Main entry point.
// fetchWeather(undefined)  → try browser GPS geolocation first
// fetchWeather(null)       → same as undefined (explicit "use GPS" request)
// fetchWeather("Jaipur")   → geocode the named city
//
// FIX: previously, calling fetchWeather(null) (e.g. via the "My Location"
// button, or on initial mount where weatherCity state starts as null) would
// pass `city = null` straight to geocodeCity(), which sent
// `?name=null&...` to Open-Meteo's geocoding API → 400 Bad Request.
// JS default parameters (`city = "Delhi"`) only apply for `undefined`,
// NOT for `null`, so the default never kicked in.
// This version explicitly treats BOTH null and undefined as "use GPS".
async function fetchWeather(city) {
  const useGeolocation = city === null || city === undefined;

  // 1. Try browser geolocation
  if (useGeolocation) {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 8000, maximumAge: 300000,
        })
      );
      const { latitude: lat, longitude: lon } = pos.coords;

      // Reverse geocode for a human-readable label
      let label = "Your Location";
      try {
        const rev = await axios.get("https://nominatim.openstreetmap.org/reverse", {
          params: { lat, lon, format: "json" },
          headers: { "Accept-Language": "en" },
          timeout: 4000,
        });
        label = rev.data?.address?.city
          || rev.data?.address?.town
          || rev.data?.address?.district
          || rev.data?.address?.state
          || "Your Location";
      } catch { /* keep default label */ }

      return await fetchWeatherByCoords(lat, lon, label);
    } catch (err) {
      console.warn("Geolocation unavailable/denied:", err.message);
      // Fall through to default city below
    }
  }

  // 2. Geocode the named city (or default to Delhi if geolocation failed/denied)
  const target = (typeof city === "string" && city.trim()) ? city.trim() : "Delhi";
  try {
    const { lat, lon, city: resolvedCity } = await geocodeCity(target);
    return await fetchWeatherByCoords(lat, lon, resolvedCity);
  } catch (err) {
    console.warn("Open-Meteo geocode failed:", err.message);
    // Last resort: demo data
    return { ...DEMO_WEATHER, city: target };
  }
}

// ── Rainfall (data.gov.in — also CORS-blocked in-browser, demo fallback) ─────
async function fetchRainfallData() {
  const cached = getCachedData("rainfall");
  if (cached) return cached;

  const key = import.meta.env.VITE_DATAGOV_API_KEY;
  if (key) {
    try {
      const res = await axios.get(
        "https://api.data.gov.in/resource/735a6779-a6a4-4c6c-b43b-0f8e09866474",
        {
          params: { "api-key": key, format: "json", limit: 20 },
          timeout: 8000,
        }
      );
      const data = res.data?.records;
      if (data && data.length > 0) {
        setCachedData("rainfall", data);
        return data;
      }
    } catch {
      /* fall through — likely CORS, same as mandi */
    }
  }

  setCachedData("rainfall", DEMO_RAINFALL);
  return DEMO_RAINFALL;
}

// ── YouTube Videos (Doordarshan Kisan) ───────────────────────────────────────
async function fetchYoutubeVideos() {
  const cached = getCachedData("youtube");
  if (cached) return cached;

  const key = import.meta.env.VITE_YOUTUBE_API_KEY;
  // Doordarshan Kisan channel ID
  const channelId = "UCiSVpKvHAjuZBN9lTFQECfQ";

  if (key) {
    try {
      const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: {
          key,
          channelId,
          part: "snippet",
          order: "date",
          maxResults: 6,
          type: "video",
        },
        timeout: 8000,
      });
      const videos = (res.data?.items || []).map((item) => ({
        id: item.id?.videoId,
        title: item.snippet?.title,
        thumbnail: item.snippet?.thumbnails?.medium?.url,
        publishedAt: item.snippet?.publishedAt,
        channelTitle: item.snippet?.channelTitle,
        url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
      }));
      if (videos.length > 0) {
        setCachedData("youtube", videos);
        return videos;
      }
    } catch (err) {
      console.warn("YouTube API failed:", err.message);
    }
  }

  setCachedData("youtube", DEMO_VIDEOS);
  return DEMO_VIDEOS;
}

// =============================================================================
// DEMO / FALLBACK DATA
// (shown when API keys are not configured, or APIs are unreachable/CORS-blocked)
// =============================================================================
const DEMO_NEWS = [
  { id: "1", title: "PM-KISAN 17th Installment Released: ₹2,000 Directly Transferred to 9.5 Crore Farmers", description: "The government released the 17th installment of PM-KISAN Samman Nidhi, crediting ₹2,000 directly into bank accounts of eligible farmers.", source: "PIB India", publishedAt: new Date(Date.now() - 2 * 3600000).toISOString(), image: null, url: "https://pib.gov.in", category: "scheme" },
  { id: "2", title: "PMFBY Crop Insurance: 5 Crore Farmers Enrolled for Kharif 2025 Season", description: "Pradhan Mantri Fasal Bima Yojana reaches record enrollment for Kharif season with simplified application process via PM Kisan app.", source: "AgriNews", publishedAt: new Date(Date.now() - 5 * 3600000).toISOString(), image: null, url: "#", category: "insurance" },
  { id: "3", title: "Soil Health Card 3.0: New Mobile App Launched for Real-time Soil Testing Reports", description: "New Soil Health Card mobile application allows farmers to get soil test results within 24 hours with crop-specific fertilizer recommendations.", source: "ICAR", publishedAt: new Date(Date.now() - 8 * 3600000).toISOString(), image: null, url: "#", category: "technology" },
  { id: "4", title: "Drip Irrigation Subsidy 2025: 90% Subsidy for Small and Marginal Farmers", description: "Under Micro Irrigation Fund, small farmers can now avail up to 90% subsidy on drip and sprinkler irrigation systems.", source: "NABARD", publishedAt: new Date(Date.now() - 12 * 3600000).toISOString(), image: null, url: "#", category: "irrigation" },
  { id: "5", title: "MSP Hike 2025: Cabinet Approves Increased Minimum Support Price for 14 Kharif Crops", description: "The Union Cabinet approved MSP hike ranging from 3% to 8% for 14 kharif crops including paddy, maize, cotton, and groundnut.", source: "Ministry of Agriculture", publishedAt: new Date(Date.now() - 18 * 3600000).toISOString(), image: null, url: "#", category: "policy" },
  { id: "6", title: "Kisan Credit Card: Interest Subvention Extended, Loan Limit Raised to ₹3 Lakh", description: "Government extends 2% interest subvention on KCC short-term crop loans and increases credit limit for farm inputs and allied activities.", source: "RBI", publishedAt: new Date(Date.now() - 24 * 3600000).toISOString(), image: null, url: "#", category: "credit" },
];

const DEMO_MANDI = [
  { id: 0, commodity: "Wheat", state: "Punjab", district: "Ludhiana", market: "Ludhiana Mandi", minPrice: 2100, maxPrice: 2250, modalPrice: 2180, date: "2025-06-07" },
  { id: 1, commodity: "Rice", state: "Haryana", district: "Karnal", market: "Karnal APMC", minPrice: 2050, maxPrice: 2200, modalPrice: 2130, date: "2025-06-07" },
  { id: 2, commodity: "Cotton", state: "Gujarat", district: "Rajkot", market: "Rajkot Mandi", minPrice: 6200, maxPrice: 6800, modalPrice: 6520, date: "2025-06-07" },
  { id: 3, commodity: "Maize", state: "Karnataka", district: "Davanagere", market: "Davangere APMC", minPrice: 1750, maxPrice: 1950, modalPrice: 1850, date: "2025-06-07" },
  { id: 4, commodity: "Soybean", state: "MP", district: "Indore", market: "Indore Mandi", minPrice: 4000, maxPrice: 4400, modalPrice: 4200, date: "2025-06-07" },
  { id: 5, commodity: "Mustard", state: "Rajasthan", district: "Bharatpur", market: "Bharatpur APMC", minPrice: 5200, maxPrice: 5600, modalPrice: 5400, date: "2025-06-07" },
  { id: 6, commodity: "Groundnut", state: "Gujarat", district: "Junagadh", market: "Junagadh Mandi", minPrice: 5500, maxPrice: 6100, modalPrice: 5800, date: "2025-06-07" },
  { id: 7, commodity: "Tomato", state: "Maharashtra", district: "Nashik", market: "Nashik APMC", minPrice: 1200, maxPrice: 2400, modalPrice: 1800, date: "2025-06-07" },
  { id: 8, commodity: "Onion", state: "Maharashtra", district: "Nashik", market: "Lasalgaon APMC", minPrice: 800, maxPrice: 1600, modalPrice: 1200, date: "2025-06-07" },
  { id: 9, commodity: "Potato", state: "UP", district: "Agra", market: "Agra Mandi", minPrice: 600, maxPrice: 950, modalPrice: 780, date: "2025-06-07" },
];

const DEMO_WEATHER = {
  city: "New Delhi", lat: 28.61, lon: 77.20,
  temp: 38, feelsLike: 42, humidity: 45, windSpeed: 18,
  description: "Haze", weatherCode: 3, rainChance: 12, alerts: [],
  daily: [
    { day: "Fri 7", min: 32, max: 42, rain: 5, weatherCode: 0 },
    { day: "Sat 8", min: 31, max: 41, rain: 10, weatherCode: 1 },
    { day: "Sun 9", min: 30, max: 39, rain: 25, weatherCode: 61 },
    { day: "Mon 10", min: 29, max: 38, rain: 40, weatherCode: 61 },
    { day: "Tue 11", min: 28, max: 36, rain: 60, weatherCode: 63 },
    { day: "Wed 12", min: 27, max: 35, rain: 35, weatherCode: 61 },
    { day: "Thu 13", min: 29, max: 37, rain: 15, weatherCode: 2 },
  ],
};

const DEMO_RAINFALL = [
  { district: "Ludhiana", weekly_mm: 18, monthly_mm: 62, seasonal_mm: 210 },
  { district: "Karnal", weekly_mm: 22, monthly_mm: 78, seasonal_mm: 245 },
  { district: "Nashik", weekly_mm: 45, monthly_mm: 180, seasonal_mm: 620 },
  { district: "Indore", weekly_mm: 38, monthly_mm: 145, seasonal_mm: 480 },
  { district: "Rajkot", weekly_mm: 12, monthly_mm: 48, seasonal_mm: 175 },
];

const DEMO_VIDEOS = [
  { id: "dQw4w9WgXcQ", title: "खरीफ 2025: धान की उन्नत खेती और सिंचाई प्रबंधन", thumbnail: null, publishedAt: new Date(Date.now() - 2 * 86400000).toISOString(), channelTitle: "Doordarshan Kisan", url: "https://www.youtube.com/@DDKisan" },
  { id: "xvFZjo5PgG0", title: "PM-KISAN Samman Nidhi: पात्रता और आवेदन प्रक्रिया", thumbnail: null, publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(), channelTitle: "Doordarshan Kisan", url: "https://www.youtube.com/@DDKisan" },
  { id: "abc123", title: "ड्रिप सिंचाई: पानी बचाएं, उपज बढ़ाएं — किसानों की सफलता गाथा", thumbnail: null, publishedAt: new Date(Date.now() - 6 * 86400000).toISOString(), channelTitle: "Doordarshan Kisan", url: "https://www.youtube.com/@DDKisan" },
  { id: "def456", title: "फसल बीमा 2025: PMFBY के तहत नुकसान का दावा कैसे करें", thumbnail: null, publishedAt: new Date(Date.now() - 8 * 86400000).toISOString(), channelTitle: "Doordarshan Kisan", url: "https://www.youtube.com/@DDKisan" },
  { id: "ghi789", title: "मिट्टी स्वास्थ्य कार्ड: मिट्टी परीक्षण से कैसे बढ़ाएं आय", thumbnail: null, publishedAt: new Date(Date.now() - 10 * 86400000).toISOString(), channelTitle: "Doordarshan Kisan", url: "https://www.youtube.com/@DDKisan" },
  { id: "jkl012", title: "कृषि ड्रोन: छोटे किसानों के लिए बड़ा बदलाव", thumbnail: null, publishedAt: new Date(Date.now() - 12 * 86400000).toISOString(), channelTitle: "Doordarshan Kisan", url: "https://www.youtube.com/@DDKisan" },
];

// ── Government Schemes (static, authoritative; name/dept not translated) ─────
const GOV_SCHEMES = [
  { id: 1, name: "PM-KISAN", dept: "Ministry of Agriculture", color: "from-emerald-600 to-emerald-800", icon: "💰",
    eligibility: { en: "All landholding farmers with valid Aadhaar & bank account", hi: "वैध आधार और बैंक खाते वाले सभी भूमिधारक किसान" },
    benefits: { en: "₹6,000/year in 3 equal installments directly to bank account", hi: "₹6,000/वर्ष, 3 समान किस्तों में सीधे बैंक खाते में" },
    url: "https://pmkisan.gov.in", tag: { en: "Income Support", hi: "आय सहायता" } },
  { id: 2, name: "PMFBY", dept: "Dept. of Agriculture & Farmers' Welfare", color: "from-teal-600 to-teal-800", icon: "🛡️",
    eligibility: { en: "All farmers growing notified crops in notified areas", hi: "अधिसूचित क्षेत्रों में अधिसूचित फसलें उगाने वाले सभी किसान" },
    benefits: { en: "Crop insurance at very low premium (2% Kharif, 1.5% Rabi)", hi: "बहुत कम प्रीमियम पर फसल बीमा (2% खरीफ, 1.5% रबी)" },
    url: "https://pmfby.gov.in", tag: { en: "Crop Insurance", hi: "फसल बीमा" } },
  { id: 3, name: "Soil Health Card", dept: "ICAR / State Agriculture Depts", color: "from-green-700 to-green-900", icon: "🌱",
    eligibility: { en: "All farmers across India", hi: "भारत के सभी किसान" },
    benefits: { en: "Free soil testing + nutrient recommendations every 2 years", hi: "हर 2 साल में मुफ्त मिट्टी परीक्षण + पोषक तत्व सिफारिशें" },
    url: "https://soilhealth.dac.gov.in", tag: { en: "Soil Health", hi: "मिट्टी स्वास्थ्य" } },
  { id: 4, name: "Kisan Credit Card", dept: "NABARD / Banks", color: "from-cyan-700 to-cyan-900", icon: "💳",
    eligibility: { en: "Farmers, sharecroppers, tenant farmers with landholding proof", hi: "भूमि प्रमाण के साथ किसान, बंटाईदार, किरायेदार किसान" },
    benefits: { en: "Short-term credit up to ₹3L at 4% effective interest rate", hi: "4% प्रभावी ब्याज दर पर ₹3 लाख तक की अल्पकालिक ऋण सुविधा" },
    url: "https://kcc.nic.in", tag: { en: "Credit", hi: "ऋण" } },
  { id: 5, name: "Micro Irrigation Fund", dept: "Ministry of Jal Shakti / NABARD", color: "from-emerald-800 to-slate-800", icon: "💧",
    eligibility: { en: "Small & marginal farmers with valid land documents", hi: "वैध भूमि दस्तावेज़ों वाले छोटे और सीमांत किसान" },
    benefits: { en: "Drip & sprinkler subsidy up to 90% for small/marginal farmers", hi: "छोटे/सीमांत किसानों के लिए ड्रिप व स्प्रिंकलर पर 90% तक सब्सिडी" },
    url: "https://midh.gov.in", tag: { en: "Irrigation", hi: "सिंचाई" } },
  { id: 6, name: "eNAM", dept: "SFAC / Ministry of Agriculture", color: "from-teal-800 to-emerald-900", icon: "📱",
    eligibility: { en: "Farmers registered at APMC markets linked to eNAM", hi: "eNAM से जुड़े APMC बाज़ारों में पंजीकृत किसान" },
    benefits: { en: "Online mandi access, better price discovery, online payment", hi: "ऑनलाइन मंडी पहुंच, बेहतर मूल्य खोज, ऑनलाइन भुगतान" },
    url: "https://enam.gov.in", tag: { en: "Market", hi: "बाज़ार" } },
];

// Crop price trend data (demo)
const CROP_PRICE_DEMO = {
  Wheat: [2080, 2100, 2120, 2095, 2150, 2180, 2160],
  Rice: [2000, 2050, 2030, 2080, 2130, 2100, 2090],
  Maize: [1720, 1750, 1780, 1800, 1850, 1820, 1860],
  Cotton: [6100, 6250, 6400, 6300, 6520, 6480, 6600],
  Mustard: [5100, 5200, 5350, 5280, 5400, 5450, 5380],
  Soybean: [3900, 4000, 4100, 4050, 4200, 4180, 4250],
};

// Bilingual crop names for the trend-chart selector
const CROP_NAMES_HI = {
  Wheat: "गेहूं", Rice: "चावल", Maize: "मक्का",
  Cotton: "कपास", Mustard: "सरसों", Soybean: "सोयाबीन",
};

const CROP_OPTIONS = Object.keys(CROP_PRICE_DEMO);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_HI = ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"];

const SOIL_HEALTH = [
  { nutrient: { en: "Nitrogen (N)", hi: "नाइट्रोजन (N)" }, value: 68, unit: "kg/ha", status: { en: "Medium", hi: "मध्यम" }, statusKey: "Medium", color: "emerald" },
  { nutrient: { en: "Phosphorus (P)", hi: "फॉस्फोरस (P)" }, value: 42, unit: "kg/ha", status: { en: "Low", hi: "कम" }, statusKey: "Low", color: "amber" },
  { nutrient: { en: "Potassium (K)", hi: "पोटैशियम (K)" }, value: 85, unit: "kg/ha", status: { en: "High", hi: "उच्च" }, statusKey: "High", color: "teal" },
  { nutrient: { en: "Organic Carbon", hi: "जीवांश कार्बन" }, value: 55, unit: "%", status: { en: "Medium", hi: "मध्यम" }, statusKey: "Medium", color: "green" },
];

const FARMER_QUERIES = [
  { category: { en: "Irrigation Management", hi: "सिंचाई प्रबंधन" }, pct: 34, icon: "💧" },
  { category: { en: "Fertilizer & Nutrients", hi: "खाद और पोषक तत्व" }, pct: 26, icon: "🌿" },
  { category: { en: "Pest & Disease Control", hi: "कीट और रोग नियंत्रण" }, pct: 20, icon: "🐛" },
  { category: { en: "Market Prices", hi: "बाज़ार भाव" }, pct: 12, icon: "📊" },
  { category: { en: "Crop Selection", hi: "फसल चयन" }, pct: 8, icon: "🌾" },
];

// Open-Meteo uses WMO weather codes — map them to emoji + description
// Full code table: https://open-meteo.com/en/docs#weathervariables
const WMO_CODE_MAP = {
  0: { emoji: "☀️", desc: { en: "Clear Sky", hi: "साफ आसमान" } },
  1: { emoji: "🌤️", desc: { en: "Mainly Clear", hi: "ज्यादातर साफ" } },
  2: { emoji: "⛅", desc: { en: "Partly Cloudy", hi: "आंशिक रूप से बादल" } },
  3: { emoji: "☁️", desc: { en: "Overcast", hi: "बादल छाए हुए" } },
  45: { emoji: "🌫️", desc: { en: "Foggy", hi: "धुंध" } },
  48: { emoji: "🌫️", desc: { en: "Icy Fog", hi: "बर्फीली धुंध" } },
  51: { emoji: "🌦️", desc: { en: "Light Drizzle", hi: "हल्की बारिश" } },
  53: { emoji: "🌦️", desc: { en: "Drizzle", hi: "बूंदाबांदी" } },
  55: { emoji: "🌧️", desc: { en: "Heavy Drizzle", hi: "घनी बूंदाबांदी" } },
  61: { emoji: "🌧️", desc: { en: "Slight Rain", hi: "हल्की बारिश" } },
  63: { emoji: "🌧️", desc: { en: "Moderate Rain", hi: "मध्यम बारिश" } },
  65: { emoji: "🌧️", desc: { en: "Heavy Rain", hi: "भारी बारिश" } },
  71: { emoji: "🌨️", desc: { en: "Light Snow", hi: "हल्की बर्फबारी" } },
  73: { emoji: "❄️", desc: { en: "Moderate Snow", hi: "मध्यम बर्फबारी" } },
  75: { emoji: "❄️", desc: { en: "Heavy Snow", hi: "भारी बर्फबारी" } },
  77: { emoji: "🌨️", desc: { en: "Snow Grains", hi: "बर्फ के कण" } },
  80: { emoji: "🌦️", desc: { en: "Slight Showers", hi: "हल्की बौछारें" } },
  81: { emoji: "🌧️", desc: { en: "Rain Showers", hi: "बारिश की बौछारें" } },
  82: { emoji: "⛈️", desc: { en: "Violent Showers", hi: "तेज़ बौछारें" } },
  85: { emoji: "🌨️", desc: { en: "Snow Showers", hi: "बर्फ की बौछारें" } },
  95: { emoji: "⛈️", desc: { en: "Thunderstorm", hi: "आंधी-तूफान" } },
  96: { emoji: "⛈️", desc: { en: "Thunderstorm w/ Hail", hi: "तूफान के साथ बर्फबारी" } },
  99: { emoji: "⛈️", desc: { en: "Heavy Thunderstorm", hi: "भारी तूफान" } },
};

function wmoEmoji(code) {
  return (WMO_CODE_MAP[code] ?? { emoji: "🌡️" }).emoji;
}
function wmoDesc(code, lang = "en") {
  return (WMO_CODE_MAP[code]?.desc?.[lang]) ?? (lang === "hi" ? "अज्ञात" : "Unknown");
}

const NEWS_CATEGORIES = {
  scheme: { label: { en: "Scheme", hi: "योजना" }, cls: "bg-emerald-900/60 text-emerald-300 border-emerald-700" },
  insurance: { label: { en: "Insurance", hi: "बीमा" }, cls: "bg-teal-900/60 text-teal-300 border-teal-700" },
  technology: { label: { en: "Technology", hi: "तकनीक" }, cls: "bg-cyan-900/60 text-cyan-300 border-cyan-700" },
  irrigation: { label: { en: "Irrigation", hi: "सिंचाई" }, cls: "bg-blue-900/60 text-blue-300 border-blue-700" },
  policy: { label: { en: "Policy", hi: "नीति" }, cls: "bg-purple-900/60 text-purple-300 border-purple-700" },
  credit: { label: { en: "Credit", hi: "ऋण" }, cls: "bg-amber-900/60 text-amber-300 border-amber-700" },
  agriculture: { label: { en: "Agriculture", hi: "कृषि" }, cls: "bg-green-900/60 text-green-300 border-green-700" },
};

// External portal links for live mandi prices (CORS-safe — opens in new tab)
const MANDI_EXTERNAL_LINKS = [
  { label: { en: "Open Agmarknet", hi: "एगमार्कनेट खोलें" }, url: "https://agmarknet.gov.in", icon: "🌾" },
  { label: { en: "Open eNAM", hi: "ई-नाम खोलें" }, url: "https://www.enam.gov.in/web/dashboard/trade-data", icon: "📱" },
];

// =============================================================================
// FRAMER MOTION VARIANTS
// =============================================================================
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = (delay = 0) => ({
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, delay, ease: "easeOut" } },
});
const scaleIn = {
  hidden: { opacity: 0, scale: 0.93 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
};

// =============================================================================
// SMALL REUSABLE UI PRIMITIVES
// =============================================================================

// Glass card wrapper
function GlassCard({ children, className = "", hover = true }) {
  return (
    <div className={`
      backdrop-blur-md bg-white/[0.04] border border-white/[0.09]
      rounded-2xl shadow-xl shadow-black/30
      ${hover ? "hover:bg-white/[0.07] hover:border-white/[0.14] transition-all duration-300" : ""}
      ${className}
    `}>
      {children}
    </div>
  );
}

// Section title
function SectionTitle({ icon, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="text-emerald-400 text-xl">{icon}</span>
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            {title}
          </h2>
        </div>
        {subtitle && <p className="text-xs text-white/40 ml-9">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

// Skeleton shimmer block
function Skeleton({ className = "" }) {
  return (
    <div className={`animate-pulse rounded-xl bg-white/[0.06] ${className}`} />
  );
}

// Error card with retry
function ErrorCard({ message, onRetry, retryLabel = "Try Again" }) {
  return (
    <GlassCard className="p-6 border-red-900/50 bg-red-950/20" hover={false}>
      <div className="flex items-center gap-3 text-red-400 mb-3">
        <FiAlertTriangle className="text-xl flex-shrink-0" />
        <span className="text-sm font-medium">{message}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
        >
          <FiRefreshCw className="text-xs" /> {retryLabel}
        </button>
      )}
    </GlassCard>
  );
}

// Refresh spin button
function RefreshBtn({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      title="Refresh"
      className="p-2 rounded-xl bg-white/[0.06] hover:bg-emerald-900/40 border border-white/10 hover:border-emerald-500/40 transition-all duration-200 text-white/50 hover:text-emerald-400"
    >
      <FiRefreshCw className={`text-sm ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}

// =============================================================================
// SECTION COMPONENTS
// =============================================================================

// ── Stat Counter Card (Hero) ──────────────────────────────────────────────────
function StatCard({ label, value, icon, delay }) {
  return (
    <motion.div variants={stagger(delay)} initial="hidden" animate="show">
      <GlassCard className="p-4 text-center">
        <div className="text-2xl mb-1">{icon}</div>
        <div className="text-2xl font-bold text-white mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
          {value}
        </div>
        <div className="text-[11px] text-white/40 font-medium uppercase tracking-wider">{label}</div>
      </GlassCard>
    </motion.div>
  );
}

// ── News Card ─────────────────────────────────────────────────────────────────
function NewsCard({ article, delay, lang, t }) {
  const cat = NEWS_CATEGORIES[article.category] || NEWS_CATEGORIES.agriculture;
  const pub = article.publishedAt ? new Date(article.publishedAt) : null;
  const ago = pub ? timeAgo(pub.getTime(), lang) : "";

  return (
    <motion.div variants={stagger(delay)} initial="hidden" animate="show">
      <GlassCard className="overflow-hidden group flex flex-col h-full">
        {/* Image or gradient placeholder */}
        <div className="h-36 bg-gradient-to-br from-emerald-900/50 to-slate-900 overflow-hidden flex-shrink-0 relative">
          {article.image
            ? <img src={article.image} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80" onError={(e) => { e.target.style.display = "none"; }} />
            : <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-20">🌾</div>
          }
          <div className="absolute bottom-2 left-3">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cat.cls}`}>{cat.label[lang]}</span>
          </div>
        </div>
        <div className="p-4 flex flex-col flex-1">
          <p className="text-[11px] text-white/35 mb-1.5 font-medium">
            {article.source} · {ago}
          </p>
          <h3 className="text-sm font-semibold text-white leading-snug mb-2 flex-1 line-clamp-3">
            {article.title}
          </h3>
          <p className="text-[11px] text-white/40 leading-relaxed mb-3 line-clamp-2">
            {article.description}
          </p>
          <a
            href={article.url || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors mt-auto"
          >
            {t.readMore} <FiExternalLink className="text-[10px]" />
          </a>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── Scheme Card ───────────────────────────────────────────────────────────────
function SchemeCard({ scheme, delay, lang, t }) {
  return (
    <motion.div variants={stagger(delay)} initial="hidden" animate="show">
      <GlassCard className="p-5 flex flex-col h-full group">
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${scheme.color} flex items-center justify-center text-lg shadow-lg flex-shrink-0`}>
            {scheme.icon}
          </div>
          <span className="text-[10px] bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 px-2 py-0.5 rounded-full font-semibold">
            {scheme.tag[lang]}
          </span>
        </div>
        <h3 className="text-base font-bold text-white mb-0.5" style={{ fontFamily: "'Playfair Display', serif" }}>
          {scheme.name}
        </h3>
        <p className="text-[10px] text-white/35 font-medium mb-3">{scheme.dept}</p>
        <div className="space-y-2 flex-1 text-[11px] text-white/60">
          <div><span className="text-white/35 font-semibold">{t.eligibility}: </span>{scheme.eligibility[lang]}</div>
          <div><span className="text-white/35 font-semibold">{t.benefits}: </span>{scheme.benefits[lang]}</div>
        </div>
        <a
          href={scheme.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 hover:border-emerald-400/50 text-emerald-300 text-xs font-semibold py-2 rounded-xl transition-all duration-200"
        >
          {t.applyNow} <FiExternalLink className="text-[10px]" />
        </a>
      </GlassCard>
    </motion.div>
  );
}

// ── Mandi Table ───────────────────────────────────────────────────────────────
// Includes a CORS-notice banner + "Open Agmarknet / eNAM" external link buttons
// as the practical workaround for live prices (see fetchMandiPrices comments).
function MandiTable({ data, lang, t }) {
  const [search, setSearch] = useState("");
  const [stateF, setStateF] = useState("All");
  const [sortField, setSortF] = useState("modalPrice");
  const [sortDir, setSortD] = useState("desc");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 8;

  const states = ["All", ...new Set(data.map((r) => r.state))];

  const filtered = data
    .filter((r) => {
      const q = search.toLowerCase();
      return (
        (stateF === "All" || r.state === stateF) &&
        (r.commodity.toLowerCase().includes(q) ||
          r.district.toLowerCase().includes(q) ||
          r.market.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      const v = sortDir === "asc" ? 1 : -1;
      return (a[sortField] - b[sortField]) * v;
    });

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const toggleSort = (field) => {
    if (sortField === field) setSortD((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortF(field); setSortD("desc"); }
  };

  const priceColor = (price, avg) =>
    price > avg * 1.05 ? "text-emerald-400" : price < avg * 0.95 ? "text-red-400" : "text-white/80";

  return (
    <div>
      {/* CORS notice + external portal links */}
      <div className="mb-4 bg-amber-950/30 border border-amber-800/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-2 flex-1">
          <FiInfo className="text-amber-400 flex-shrink-0 mt-0.5 text-sm" />
          <p className="text-[11px] text-amber-200/80 leading-relaxed">{t.mandiCorsNotice}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {MANDI_EXTERNAL_LINKS.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-300 transition-all whitespace-nowrap"
            >
              {link.icon} {link.label[lang]} <FiExternalLink className="text-[9px]" />
            </a>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 flex-1 min-w-[160px]">
          <FiSearch className="text-white/30 flex-shrink-0" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="bg-transparent text-xs text-white placeholder-white/25 outline-none w-full"
          />
        </div>
        <div className="relative">
          <select
            value={stateF}
            onChange={(e) => { setStateF(e.target.value); setPage(0); }}
            className="appearance-none bg-white/[0.05] border border-white/10 text-white/70 text-xs rounded-xl px-3 py-2 pr-8 outline-none cursor-pointer"
          >
            {states.map((s) => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
          </select>
          <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 text-xs pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.07]">
        <table className="w-full text-xs min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.04]">
              {[
                { label: t.commodity, key: null },
                { label: t.stateDistrict, key: null },
                { label: t.market, key: null },
                { label: t.minPrice, key: "minPrice" },
                { label: t.maxPrice, key: "maxPrice" },
                { label: t.modalPrice, key: "modalPrice" },
              ].map(({ label, key }) => (
                <th
                  key={label}
                  onClick={key ? () => toggleSort(key) : undefined}
                  className={`px-4 py-3 text-left font-semibold text-white/40 uppercase tracking-wide text-[10px] select-none ${key ? "cursor-pointer hover:text-emerald-400 transition-colors" : ""}`}
                >
                  {label}
                  {key && sortField === key && (
                    <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={6} className="py-10 text-center text-white/30 text-xs">{t.noResults}</td></tr>
            ) : paged.map((row, i) => {
              const avg = (row.minPrice + row.maxPrice) / 2;
              return (
                <tr key={row.id} className={`border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}>
                  <td className="px-4 py-3 font-semibold text-white">{row.commodity}</td>
                  <td className="px-4 py-3 text-white/50">{row.state}<br /><span className="text-white/30 text-[10px]">{row.district}</span></td>
                  <td className="px-4 py-3 text-white/50">{row.market}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${priceColor(row.minPrice, avg)}`}>₹{row.minPrice.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${priceColor(row.maxPrice, avg)}`}>₹{row.maxPrice.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-mono font-bold ${priceColor(row.modalPrice, avg)}`}>₹{row.modalPrice.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-white/40">
          <span>{filtered.length} {t.results}</span>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">←</button>
            <span className="px-3 py-1 text-white/60">{page + 1} / {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.10] disabled:opacity-30 disabled:cursor-not-allowed transition-colors">→</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Crop Price Trend Chart ────────────────────────────────────────────────────
function CropTrendChart({ mandiData, lang, t }) {
  const [crop, setCrop] = useState("Wheat");
  const days = lang === "hi" ? DAYS_HI : DAYS;

  // Try to build 7-day trend from real mandi data, fallback to demo
  const buildTrend = (cropName) => {
    const cropRows = mandiData?.filter((r) =>
      r.commodity.toLowerCase() === cropName.toLowerCase()
    ) || [];
    if (cropRows.length >= 3) {
      return cropRows.slice(-7).map((r, i) => ({
        day: days[i % 7],
        price: r.modalPrice,
      }));
    }
    // Demo data
    return (CROP_PRICE_DEMO[cropName] || CROP_PRICE_DEMO.Wheat).map((p, i) => ({
      day: days[i], price: p,
    }));
  };

  const data = buildTrend(crop);
  const prices = data.map((d) => d.price);
  const first = prices[0] || 0;
  const last = prices[prices.length - 1] || 0;
  const changePct = first ? (((last - first) / first) * 100).toFixed(2) : "0.00";
  const avg = (prices.reduce((s, v) => s + v, 0) / (prices.length || 1)).toFixed(0);
  const isUp = parseFloat(changePct) >= 0;

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          {CROP_OPTIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCrop(c)}
              className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all duration-200 border ${crop === c
                ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/40"
                : "bg-white/[0.04] text-white/50 border-white/10 hover:bg-white/[0.08] hover:text-white/80"
                }`}
            >
              {lang === "hi" ? (CROP_NAMES_HI[c] || c) : c}
            </button>
          ))}
        </div>
      </div>

      {/* KPI chips */}
      <div className="flex gap-4 mb-5 flex-wrap">
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 flex items-center gap-2">
          {isUp ? <FiTrendingUp className="text-emerald-400" /> : <FiTrendingDown className="text-red-400" />}
          <div>
            <p className="text-[10px] text-white/35">{t.weekChange}</p>
            <p className={`text-sm font-bold ${isUp ? "text-emerald-400" : "text-red-400"}`}>
              {isUp ? "+" : ""}{changePct}%
            </p>
          </div>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5">
          <p className="text-[10px] text-white/35">{t.weeklyAvg}</p>
          <p className="text-sm font-bold text-white">₹{parseInt(avg).toLocaleString()}/qt</p>
        </div>
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5">
          <p className="text-[10px] text-white/35">{t.today}</p>
          <p className="text-sm font-bold text-white">₹{last.toLocaleString()}/qt</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="cropGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} width={58} />
          <Tooltip
            contentStyle={{ background: "rgba(2,28,18,0.95)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, color: "#fff", fontSize: 11 }}
            formatter={(v) => [`₹${v.toLocaleString()}/qt`, lang === "hi" ? (CROP_NAMES_HI[crop] || crop) : crop]}
            labelStyle={{ color: "rgba(255,255,255,0.5)" }}
          />
          <Area type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2.5} fill="url(#cropGrad)" dot={{ fill: "#10b981", r: 3.5, strokeWidth: 0 }} activeDot={{ r: 6, fill: "#34d399" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Weather Card ──────────────────────────────────────────────────────────────
function WeatherSection({ weather, loading, error, onRetry, lang, t }) {
  if (loading) return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="animate-pulse w-16 h-16 rounded-2xl bg-white/[0.06]" />
          <div className="space-y-2 flex-1">
            <div className="animate-pulse h-8 w-24 bg-white/[0.06] rounded-xl" />
            <div className="animate-pulse h-3 w-40 bg-white/[0.06] rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="animate-pulse h-16 rounded-xl bg-white/[0.06]" />)}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {[...Array(7)].map((_, i) => <div key={i} className="animate-pulse h-24 rounded-2xl bg-white/[0.06]" />)}
      </div>
    </div>
  );
  if (error) return <ErrorCard message={error} onRetry={onRetry} retryLabel={t.tryAgain} />;
  if (!weather) return null;

  return (
    <div>
      {/* Current Weather */}
      <GlassCard className="p-5 mb-4" hover={false}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* WMO emoji icon — no external image needed */}
            <div className="w-16 h-16 rounded-2xl bg-white/[0.06] flex items-center justify-center text-4xl select-none">
              {wmoEmoji(weather.weatherCode)}
            </div>
            <div>
              <p className="text-5xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                {weather.temp}°C
              </p>
              <p className="text-white/40 text-sm capitalize mt-1">{wmoDesc(weather.weatherCode, lang)}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-xs text-emerald-400 font-semibold">{weather.city}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <FiDroplet />, label: t.humidity, value: `${weather.humidity}%`, color: "text-blue-400" },
              { icon: <FiWind />, label: t.wind, value: `${weather.windSpeed} km/h`, color: "text-teal-400" },
              { icon: <BsCloudRainHeavy />, label: t.rainChance, value: `${weather.rainChance}%`, color: "text-sky-400" },
              { icon: <FiThermometer />, label: t.feelsLike, value: `${weather.feelsLike}°C`, color: "text-amber-400" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="bg-white/[0.04] rounded-xl px-3 py-2 flex items-center gap-2">
                <span className={`${color} text-sm`}>{icon}</span>
                <div>
                  <p className="text-[10px] text-white/30">{label}</p>
                  <p className="text-xs font-bold text-white">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Rain alert if high probability */}
        {weather.rainChance >= 70 && (
          <div className="mt-4 bg-sky-950/40 border border-sky-700/30 rounded-xl p-3 flex items-start gap-2">
            <BsCloudRainHeavy className="text-sky-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-sky-300">
              {t.rainAlert.replace("{pct}", weather.rainChance)}
            </p>
          </div>
        )}
      </GlassCard>

      {/* 7-Day Forecast */}
      <div className="grid grid-cols-7 gap-2">
        {weather.daily?.map((day, i) => (
          <GlassCard key={i} className="p-2.5 text-center" hover={false}>
            <p className="text-[10px] text-white/35 font-semibold mb-1.5">{day.day}</p>
            <div className="text-xl mb-1 select-none">{wmoEmoji(day.weatherCode)}</div>
            <p className="text-xs font-bold text-white">{day.max}°</p>
            <p className="text-[10px] text-white/35 mb-1">{day.min}°</p>
            <div className="flex items-center justify-center gap-0.5">
              <FiDroplet className="text-blue-400 text-[9px]" />
              <span className="text-[10px] text-blue-400">{day.rain}%</span>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

// ── Rainfall Progress Bars ────────────────────────────────────────────────────
function RainfallSection({ data, lang, t }) {
  if (!data?.length) return <Skeleton className="h-40" />;

  const maxSeasonal = Math.max(...data.map((d) => d.seasonal_mm || 0));

  return (
    <div className="space-y-4">
      {data.map((d, i) => (
        <motion.div key={i} variants={stagger(i * 0.07)} initial="hidden" animate="show">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BsCloudRainHeavy className="text-sky-400" />
                <span className="text-sm font-semibold text-white">{d.district}</span>
              </div>
              <span className="text-[10px] text-sky-300 bg-sky-900/30 border border-sky-700/30 px-2 py-0.5 rounded-full">
                {d.weekly_mm} {t.mmThisWeek}
              </span>
            </div>
            <div className="space-y-2">
              {[
                { label: t.weekly, val: d.weekly_mm, max: 100, color: "bg-sky-500" },
                { label: t.monthly, val: d.monthly_mm, max: 400, color: "bg-teal-500" },
                { label: t.seasonal, val: d.seasonal_mm, max: maxSeasonal || 800, color: "bg-emerald-500" },
              ].map(({ label, val, max, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-[10px] text-white/40 mb-1">
                    <span>{label}</span><span>{val} mm</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((val / max) * 100, 100)}%` }}
                      transition={{ duration: 1.2, delay: i * 0.1, ease: "easeOut" }}
                      className={`h-full ${color} rounded-full`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}

// ── Soil Health Cards ─────────────────────────────────────────────────────────
function SoilHealthSection({ lang }) {
  const statusColor = { Low: "text-red-400", Medium: "text-amber-400", High: "text-emerald-400" };
  const barColor = { Low: "bg-red-500", Medium: "bg-amber-500", High: "bg-emerald-500" };

  return (
    <div className="grid grid-cols-2 gap-3">
      {SOIL_HEALTH.map((s, i) => (
        <motion.div key={s.nutrient.en} variants={stagger(i * 0.08)} initial="hidden" animate="show">
          <GlassCard className="p-4" hover={false}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white">{s.nutrient[lang]}</p>
              <span className={`text-[10px] font-bold ${statusColor[s.statusKey]}`}>{s.status[lang]}</span>
            </div>
            <p className="text-xl font-bold text-white mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
              {s.value} <span className="text-xs text-white/35 font-normal">{s.unit}</span>
            </p>
            <div className="h-1.5 bg-white/[0.07] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${s.value}%` }}
                transition={{ duration: 1.2, delay: i * 0.15, ease: "easeOut" }}
                className={`h-full ${barColor[s.statusKey]} rounded-full`}
              />
            </div>
          </GlassCard>
        </motion.div>
      ))}
    </div>
  );
}

// ── YouTube Video Cards ───────────────────────────────────────────────────────
function VideoCard({ video, delay, lang }) {
  const pub = video.publishedAt ? timeAgo(new Date(video.publishedAt).getTime(), lang) : "";
  return (
    <motion.div variants={stagger(delay)} initial="hidden" animate="show">
      <GlassCard className="overflow-hidden group">
        <a href={video.url || "#"} target="_blank" rel="noopener noreferrer" className="block">
          <div className="relative h-36 bg-gradient-to-br from-red-950/60 to-slate-900 overflow-hidden">
            {video.thumbnail
              ? <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
              : <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-20">📹</div>
            }
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/10 transition-colors">
              <div className="w-10 h-10 rounded-full bg-red-600/90 flex items-center justify-center shadow-xl">
                <FiPlay className="text-white text-base ml-0.5" />
              </div>
            </div>
          </div>
          <div className="p-3">
            <p className="text-[10px] text-white/30 mb-1">{video.channelTitle} · {pub}</p>
            <p className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-emerald-300 transition-colors">
              {video.title}
            </p>
          </div>
        </a>
      </GlassCard>
    </motion.div>
  );
}

// ── Farmer Query Insights ─────────────────────────────────────────────────────
function QueryInsights({ lang }) {
  return (
    <div className="space-y-4">
      {FARMER_QUERIES.map((q, i) => (
        <motion.div key={q.category.en} variants={stagger(i * 0.07)} initial="hidden" animate="show">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-lg">{q.icon}</span>
            <span className="text-xs font-medium text-white/70 flex-1">{q.category[lang]}</span>
            <span className="text-xs font-bold text-emerald-400">{q.pct}%</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden ml-8">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${q.pct}%` }}
              transition={{ duration: 1.2, delay: i * 0.1, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full"
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Bookmark Crops ────────────────────────────────────────────────────────────
function BookmarkCrops({ t }) {
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("agriinfo_bookmarks") || "[]"); }
    catch { return []; }
  });
  const [input, setInput] = useState("");

  const save = (updated) => {
    setBookmarks(updated);
    localStorage.setItem("agriinfo_bookmarks", JSON.stringify(updated));
  };

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || bookmarks.includes(trimmed)) return;
    save([...bookmarks, trimmed]);
    setInput("");
  };

  const remove = (crop) => save(bookmarks.filter((c) => c !== crop));

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder={t.addCropPlaceholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-emerald-500/50 transition-colors"
        />
        <button
          onClick={add}
          className="px-4 py-2 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl transition-all"
        >
          {t.add}
        </button>
      </div>
      {bookmarks.length === 0 ? (
        <p className="text-center py-6 text-xs text-white/25">{t.noBookmarks}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {bookmarks.map((crop) => (
            <span key={crop} className="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-700/40 text-emerald-300 text-xs px-3 py-1.5 rounded-full">
              🌾 {crop}
              <button onClick={() => remove(crop)} className="text-emerald-500/60 hover:text-red-400 transition-colors ml-1">
                <FiX className="text-[10px]" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
export default function AgriInfo() {
  const navigate = useNavigate();

  // ── Language state (persisted) ─────────────────────────────────────────────
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("agriinfo_lang") || "en"; }
    catch { return "en"; }
  });
  const t = TRANSLATIONS[lang];

  const toggleLang = () => {
    const next = lang === "en" ? "hi" : "en";
    setLang(next);
    try { localStorage.setItem("agriinfo_lang", next); } catch {}
  };

  // ── State ──────────────────────────────────────────────────────────────────
  const [news, setNews] = useState([]);
  const [mandi, setMandi] = useState([]);
  const [weather, setWeather] = useState(null);
  const [rainfall, setRainfall] = useState([]);
  const [videos, setVideos] = useState([]);
  // null = "use browser geolocation"; string = named city
  const [weatherCity, setWeatherCity] = useState(null);

  const [loading, setLoading] = useState({
    news: true, mandi: true, weather: true, rainfall: true, videos: true,
  });
  const [errors, setErrors] = useState({
    news: null, mandi: null, weather: null, rainfall: null, videos: null,
  });
  const [lastUpdated, setLastUpdated] = useState({
    news: null, mandi: null, weather: null, rainfall: null, videos: null,
  });

  const [newsPage, setNewsPage] = useState(0);

  // Refs for tracking component mount
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const setL = (key, val) => setLoading((p) => ({ ...p, [key]: val }));
  const setE = (key, val) => setErrors((p) => ({ ...p, [key]: val }));
  const setU = (key) => setLastUpdated((p) => ({ ...p, [key]: Date.now() }));

  // ── Fetch helpers ──────────────────────────────────────────────────────────
  const loadNews = useCallback(async () => {
    setL("news", true); setE("news", null);
    try {
      const d = await fetchAgriNews();
      if (mounted.current) { setNews(d || []); setU("news"); }
    } catch (e) {
      if (mounted.current) setE("news", e.message || "Failed to load news");
    } finally {
      if (mounted.current) setL("news", false);
    }
  }, []);

  const loadMandi = useCallback(async () => {
    setL("mandi", true); setE("mandi", null);
    try {
      const d = await fetchMandiPrices();
      if (mounted.current) { setMandi(d || []); setU("mandi"); }
    } catch (e) {
      if (mounted.current) setE("mandi", e.message || "Failed to load mandi prices");
    } finally {
      if (mounted.current) setL("mandi", false);
    }
  }, []);

  // FIX: explicitly pass `null` (not undefined) when no argument is given,
  // so fetchWeather() always knows whether to use GPS or a named city.
  // city === undefined  → use current weatherCity state
  // city === null       → explicit "use GPS"
  // city === "Jaipur"   → named city
  const loadWeather = useCallback(async (city) => {
    setL("weather", true); setE("weather", null);
    try {
      const target = city !== undefined ? city : weatherCity;
      const d = await fetchWeather(target);
      if (mounted.current) {
        setWeather(d);
        setU("weather");
        // If we resolved a city via GPS, remember its label for the "Refresh" button
        if (target === null && d?.city) setWeatherCity(null);
      }
    } catch (e) {
      if (mounted.current) setE("weather", e.message || "Failed to load weather");
    } finally {
      if (mounted.current) setL("weather", false);
    }
  }, [weatherCity]);

  const loadRainfall = useCallback(async () => {
    setL("rainfall", true);
    try {
      const d = await fetchRainfallData();
      if (mounted.current) { setRainfall(d || []); setU("rainfall"); }
    } catch {
      if (mounted.current) setRainfall(DEMO_RAINFALL);
    } finally {
      if (mounted.current) setL("rainfall", false);
    }
  }, []);

  const loadVideos = useCallback(async () => {
    setL("videos", true); setE("videos", null);
    try {
      const d = await fetchYoutubeVideos();
      if (mounted.current) { setVideos(d || []); setU("videos"); }
    } catch (e) {
      if (mounted.current) setE("videos", e.message || "Failed to load videos");
    } finally {
      if (mounted.current) setL("videos", false);
    }
  }, []);

  const loadAll = useCallback(() => {
    loadNews();
    loadMandi();
    loadWeather(undefined); // undefined → use current weatherCity (null on first load → GPS)
    loadRainfall();
    loadVideos();
  }, [loadNews, loadMandi, loadWeather, loadRainfall, loadVideos]);

  // ── Section 13: Auto-refresh every 30 minutes ─────────────────────────────
  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      // Clear caches so fresh data is fetched
      ["news", "mandi", "rainfall", "youtube"].forEach((k) =>
        localStorage.removeItem(`agriinfo_${k}`)
      );
      loadAll();
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived stats for hero ─────────────────────────────────────────────────
  const newsCount = news.length;
  const schemeCount = GOV_SCHEMES.length;
  const cropsTracked = CROP_OPTIONS.length;
  const lastNews = lastUpdated.news;

  // Paginated news (5 per page)
  const NEWS_PAGE_SIZE = 5;
  const pagedNews = news.slice(newsPage * NEWS_PAGE_SIZE, (newsPage + 1) * NEWS_PAGE_SIZE);
  const newsPageCount = Math.ceil(news.length / NEWS_PAGE_SIZE);

  // =============================================================================
  // RENDER
  // =============================================================================
  return (
    <div
      className="min-h-screen text-white"
      style={{
        fontFamily: lang === "hi" ? "'Noto Sans Devanagari', 'DM Sans', sans-serif" : "'DM Sans', sans-serif",
        background: "radial-gradient(ellipse at 10% 0%, #052e16 0%, #071c12 40%, #020d09 100%)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Decorative mesh blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #065f46, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-1/3 right-0 w-80 h-80 rounded-full opacity-15" style={{ background: "radial-gradient(circle, #047857, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #064e3b, transparent 70%)", filter: "blur(70px)" }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(16,185,129,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.8) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>

      {/* ── Fixed top bar: Home button (left) + Language toggle (right) ────── */}
      <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between pointer-events-none">
        <button
          onClick={() => navigate("/")}
          className="pointer-events-auto flex items-center gap-2 backdrop-blur-md bg-white/[0.06] hover:bg-emerald-900/40 border border-white/10 hover:border-emerald-500/40 text-white/70 hover:text-emerald-300 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-black/30 transition-all duration-200"
          title={t.home}
        >
          <FiHome className="text-sm" />
          <span className="hidden sm:inline">{t.home}</span>
        </button>

        <button
          onClick={toggleLang}
          className="pointer-events-auto flex items-center gap-2 backdrop-blur-md bg-white/[0.06] hover:bg-emerald-900/40 border border-white/10 hover:border-emerald-500/40 text-white/70 hover:text-emerald-300 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-black/30 transition-all duration-200"
          title="Switch language / भाषा बदलें"
        >
          <FiGlobe className="text-sm" />
          <span>{lang === "en" ? "हिन्दी" : "English"}</span>
        </button>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 pt-20 space-y-14">

        {/* ================================================================
            SECTION 1: HERO
        ================================================================ */}
        <motion.div variants={fadeUp} initial="hidden" animate="show">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] text-emerald-400 font-semibold uppercase tracking-widest">{t.liveTag}</span>
          </div>

          <h1
            className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-3"
            style={{ fontFamily: lang === "hi" ? "'Noto Sans Devanagari', serif" : "'Playfair Display', serif", textShadow: "0 0 80px rgba(16,185,129,0.2)" }}
          >
            {t.heroTitle1}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">{t.heroTitle2}</span>
          </h1>
          <p className="text-white/40 text-base max-w-2xl mb-10">
            {t.heroSubtitle}
          </p>

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label={t.statNews} value={newsCount || "…"} icon="📰" delay={0.05} />
            <StatCard label={t.statSchemes} value={schemeCount} icon="🏛️" delay={0.10} />
            <StatCard label={t.statCrops} value={cropsTracked} icon="🌾" delay={0.15} />
            <StatCard
              label={t.statUpdated}
              value={lastNews ? timeAgo(lastNews, lang) : t.loading}
              icon="🕐"
              delay={0.20}
            />
          </div>
        </motion.div>

        {/* ================================================================
            SECTION 2: GOVERNMENT SCHEMES & AGRI NEWS
        ================================================================ */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
          <SectionTitle
            icon="📰"
            title={t.newsTitle}
            subtitle={t.newsSubtitle}
            right={
              <div className="flex items-center gap-2">
                {lastUpdated.news && (
                  <span className="text-[10px] text-white/30">{t.updated} {timeAgo(lastUpdated.news, lang)}</span>
                )}
                <RefreshBtn onClick={loadNews} loading={loading.news} />
              </div>
            }
          />

          {loading.news ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-white/[0.07] bg-white/[0.03]">
                  <Skeleton className="h-36 rounded-none" />
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-2.5 w-3/4" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-2 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : errors.news ? (
            <ErrorCard message={errors.news} onRetry={loadNews} retryLabel={t.tryAgain} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pagedNews.map((a, i) => (
                  <NewsCard key={a.id} article={a} delay={i * 0.06} lang={lang} t={t} />
                ))}
              </div>
              {newsPageCount > 1 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  <button disabled={newsPage === 0} onClick={() => setNewsPage((p) => p - 1)} className="px-4 py-2 text-xs rounded-xl bg-white/[0.05] hover:bg-white/[0.10] disabled:opacity-30 transition-colors border border-white/10 text-white/60">{t.prev}</button>
                  <span className="text-xs text-white/35">{newsPage + 1} / {newsPageCount}</span>
                  <button disabled={newsPage >= newsPageCount - 1} onClick={() => setNewsPage((p) => p + 1)} className="px-4 py-2 text-xs rounded-xl bg-white/[0.05] hover:bg-white/[0.10] disabled:opacity-30 transition-colors border border-white/10 text-white/60">{t.next}</button>
                </div>
              )}
            </>
          )}
        </motion.section>

        {/* ================================================================
            SECTION 3: GOVERNMENT SCHEMES PANEL
        ================================================================ */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
          <SectionTitle
            icon="🏛️"
            title={t.schemesTitle}
            subtitle={t.schemesSubtitle}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GOV_SCHEMES.map((s, i) => (
              <SchemeCard key={s.id} scheme={s} delay={i * 0.07} lang={lang} t={t} />
            ))}
          </div>
        </motion.section>

        {/* ================================================================
            SECTION 4 + 5: MANDI PRICES + CROP TREND CHART
        ================================================================ */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Mandi Table (spans 2 cols) */}
            <div className="lg:col-span-2">
              <SectionTitle
                icon="📊"
                title={t.mandiTitle}
                subtitle={t.mandiSubtitle}
                right={
                  <div className="flex items-center gap-2">
                    {lastUpdated.mandi && <span className="text-[10px] text-white/30">{timeAgo(lastUpdated.mandi, lang)}</span>}
                    <RefreshBtn onClick={loadMandi} loading={loading.mandi} />
                  </div>
                }
              />
              <GlassCard className="p-5" hover={false}>
                {loading.mandi ? (
                  <div className="space-y-3">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8" />)}
                  </div>
                ) : errors.mandi ? (
                  <ErrorCard message={errors.mandi} onRetry={loadMandi} retryLabel={t.tryAgain} />
                ) : (
                  <MandiTable data={mandi} lang={lang} t={t} />
                )}
              </GlassCard>
            </div>

            {/* Crop Price Trend */}
            <div>
              <SectionTitle icon="📈" title={t.trendTitle} subtitle={t.trendSubtitle} />
              <GlassCard className="p-5" hover={false}>
                <CropTrendChart mandiData={mandi} lang={lang} t={t} />
              </GlassCard>
            </div>
          </div>
        </motion.section>

        {/* ================================================================
            SECTION 6: WEATHER FORECAST
        ================================================================ */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}>
          <SectionTitle
            icon="⛅"
            title={t.weatherTitle}
            subtitle={t.weatherSubtitle}
            right={
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* City search input */}
                <div className="flex items-center gap-1.5 bg-white/[0.05] border border-white/10 rounded-xl px-3 py-1.5">
                  <FiSearch className="text-white/30 text-xs flex-shrink-0" />
                  <input
                    type="text"
                    placeholder={t.enterCity}
                    className="bg-transparent text-xs text-white placeholder-white/25 outline-none w-28"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.target.value.trim()) {
                        const city = e.target.value.trim();
                        setWeatherCity(city);
                        loadWeather(city);
                        e.target.value = "";
                      }
                    }}
                  />
                </div>
                {/* Use My Location button */}
                <button
                  onClick={() => { setWeatherCity(null); loadWeather(null); }}
                  title="Use my GPS location"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/30 text-emerald-300 font-semibold transition-all"
                >
                  {t.myLocation}
                </button>
                {lastUpdated.weather && (
                  <span className="text-[10px] text-white/30">{timeAgo(lastUpdated.weather, lang)}</span>
                )}
                <RefreshBtn onClick={() => loadWeather(undefined)} loading={loading.weather} />
              </div>
            }
          />
          <WeatherSection
            weather={weather}
            loading={loading.weather}
            error={errors.weather}
            onRetry={() => loadWeather(undefined)}
            lang={lang}
            t={t}
          />
        </motion.section>

        {/* ================================================================
            SECTION 7 + 8: RAINFALL + SOIL HEALTH (side by side)
        ================================================================ */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <SectionTitle
                icon="🌧️"
                title={t.rainfallTitle}
                subtitle={t.rainfallSubtitle}
                right={<RefreshBtn onClick={loadRainfall} loading={loading.rainfall} />}
              />
              <RainfallSection data={rainfall} lang={lang} t={t} />
            </div>
            <div>
              <SectionTitle icon="🌱" title={t.soilTitle} subtitle={t.soilSubtitle} />
              <SoilHealthSection lang={lang} />
              <GlassCard className="mt-4 p-4 bg-emerald-950/30 border-emerald-800/20" hover={false}>
                <p className="text-xs text-emerald-300 font-semibold mb-1">{t.recommendation}</p>
                <p className="text-[11px] text-white/45 leading-relaxed">
                  {t.soilRecommendationText}
                </p>
              </GlassCard>
            </div>
          </div>
        </motion.section>

        {/* ================================================================
            SECTION 9: YOUTUBE VIDEOS
        ================================================================ */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}>
          <SectionTitle
            icon="📺"
            title={t.videosTitle}
            subtitle={t.videosSubtitle}
            right={
              <div className="flex items-center gap-2">
                {lastUpdated.videos && <span className="text-[10px] text-white/30">{timeAgo(lastUpdated.videos, lang)}</span>}
                <RefreshBtn onClick={loadVideos} loading={loading.videos} />
              </div>
            }
          />
          {loading.videos ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-white/[0.07]">
                  <Skeleton className="h-36 rounded-none" />
                  <div className="p-3 space-y-1.5"><Skeleton className="h-2.5 w-full" /><Skeleton className="h-2 w-2/3" /></div>
                </div>
              ))}
            </div>
          ) : errors.videos ? (
            <ErrorCard message={errors.videos} onRetry={loadVideos} retryLabel={t.tryAgain} />
          ) : videos.length === 0 ? (
            <GlassCard className="p-10 text-center" hover={false}>
              <p className="text-white/30 text-sm">{t.noVideos}</p>
              <a href="https://www.youtube.com/@DDKisan" target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300">
                {t.visitChannel} <FiExternalLink />
              </a>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {videos.map((v, i) => <VideoCard key={v.id || i} video={v} delay={i * 0.07} lang={lang} />)}
            </div>
          )}
        </motion.section>

        {/* ================================================================
            SECTION 10 + 11 + 12: INSIGHTS, BOOKMARK, LAST UPDATED
        ================================================================ */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Query Insights */}
            <div>
              <SectionTitle icon="❓" title={t.queryTitle} subtitle={t.querySubtitle} />
              <GlassCard className="p-5" hover={false}>
                <QueryInsights lang={lang} />
              </GlassCard>
            </div>

            {/* Bookmark Crops */}
            <div>
              <SectionTitle icon="🔖" title={t.bookmarkTitle} subtitle={t.bookmarkSubtitle} />
              <GlassCard className="p-5" hover={false}>
                <BookmarkCrops t={t} />
              </GlassCard>
            </div>

            {/* Last Updated Panel (Section 12) */}
            <div>
              <SectionTitle icon="🕐" title={t.freshnessTitle} subtitle={t.freshnessSubtitle} />
              <GlassCard className="p-5" hover={false}>
                <div className="space-y-3">
                  {[
                    { label: t.newsLabel, key: "news", icon: "📰" },
                    { label: t.mandiLabel, key: "mandi", icon: "📊" },
                    { label: t.weatherLabel, key: "weather", icon: "⛅" },
                    { label: t.rainfallLabel, key: "rainfall", icon: "🌧️" },
                    { label: t.videosLabel, key: "videos", icon: "📺" },
                  ].map(({ label, key, icon }) => {
                    const ts = lastUpdated[key];
                    const fresh = ts && Date.now() - ts < CACHE_TTL;
                    return (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{icon}</span>
                          <span className="text-xs text-white/50">{label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${fresh ? "bg-emerald-500" : "bg-white/20"}`} />
                          <span className="text-[10px] text-white/35">{ts ? timeAgo(ts, lang) : loading[key] ? t.loading : t.notLoaded}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-5 pt-4 border-t border-white/[0.07]">
                  <button
                    onClick={() => {
                      // Clear all weather cache keys (coords-based keys)
                      Object.keys(localStorage)
                        .filter((k) => k.startsWith("agriinfo_weather_"))
                        .forEach((k) => localStorage.removeItem(k));
                      ["news", "mandi", "rainfall", "youtube"].forEach((k) =>
                        localStorage.removeItem(`agriinfo_${k}`)
                      );
                      loadAll();
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-900/30 hover:bg-emerald-800/40 border border-emerald-700/30 text-emerald-300 text-xs font-semibold py-2.5 rounded-xl transition-all"
                  >
                    <FiRefreshCw className="text-xs" />
                    {t.refreshAll}
                  </button>
                  <p className="text-[10px] text-white/25 text-center mt-2">{t.autoRefreshNote}</p>
                </div>
              </GlassCard>
            </div>
          </div>
        </motion.section>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
        <div className="border-t border-white/[0.06] pt-8 text-center">
          <p className="text-[11px] text-white/20">
            {t.footerLine1}
          </p>
          <p className="text-[10px] text-white/15 mt-1">
            {t.footerLine2}
          </p>
        </div>

      </div>
    </div>
  );
}
