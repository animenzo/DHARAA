// frontend/src/services/aiApi.js
//
// AI Crop Advisor — service layer
// All methods reuse the existing API axios instance so JWT auth,
// token refresh, and base URL are handled automatically.

import API from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message to the AI chat endpoint.
 *
 * @param {string} message   — the user's text
 * @param {string} language  — "en" | "hi"
 * @param {Array}  history   — [{role: "user"|"ai", content: string}]
 * @param {object} [context] — optional farm context, e.g. { state, farm_name, current_crop }
 * @returns {Promise<{ reply: string, language: string, intent?: string, crop_guidance?: object }>}
 */
export const sendChatMessage = async (message, language = "en", history = [], context = {}) => {
  const response = await API.post("/api/ai/chat", {
    message,
    language,
    history,
    context,
  });
  return response.data; // { success, reply, language, intent, crop_guidance }
};

// ─────────────────────────────────────────────────────────────────────────────
// CROP RECOMMENDATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a crop recommendation based on soil and climate inputs.
 *
 * @param {object} soilData — all values are numbers
 * @param {number} soilData.nitrogen
 * @param {number} soilData.phosphorus
 * @param {number} soilData.potassium
 * @param {number} soilData.temperature
 * @param {number} soilData.humidity
 * @param {number} soilData.ph
 * @param {number} soilData.rainfall
 * @param {string} soilData.language
 * @returns {Promise<{ recommended_crop, confidence, advice, language }>}
 */
export const getCropRecommendation = async (soilData) => {
  const response = await API.post("/api/ai/crop/predict", soilData);
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// EASY MODE CROP RECOMMENDATION (farmer-friendly, no N/P/K needed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a crop recommendation using simple farmer-friendly inputs
 * (state, district, what the soil looks like, water source, season)
 * instead of technical soil-test numbers. Llama answers first;
 * a transparent region-based rule table is the fallback.
 *
 * @param {object} easyData
 * @param {string} easyData.state
 * @param {string} [easyData.district]
 * @param {string} [easyData.soil_look]
 * @param {string} [easyData.water_source]
 * @param {string} [easyData.season]
 * @param {string} [easyData.land_size]
 * @param {string} [easyData.language]
 */
export const getEasyCropRecommendation = async (easyData) => {
  const response = await API.post("/api/ai/crop/easy-predict", easyData);
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// PLANT DISEASE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a plant image for disease detection.
 *
 * @param {File}   imageFile  — browser File object from <input type="file">
 * @param {string} language   — "en" | "hi"
 * @returns {Promise<{ disease, confidence, treatment, language }>}
 */
export const detectPlantDisease = async (imageFile, language = "en") => {
  // Must send as multipart/form-data so Express multer can parse it
  const formData = new FormData();
  formData.append("file", imageFile);
  formData.append("language", language);

  const response = await API.post("/api/ai/disease/predict", formData, {
    headers: {
      // Let the browser set Content-Type with the correct multipart boundary
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY — Message History helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a new message object for the chat history array.
 * Keeps message shape consistent across all components.
 *
 * @param {"user"|"ai"}  role
 * @param {string}       content
 * @param {"text"|"crop-result"|"disease-result"|"image"} type
 * @param {object}       [meta]  — extra data (e.g. crop result payload)
 */
export const createMessage = (role, content, type = "text", meta = {}) => ({
  id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  role,        // "user" | "ai"
  content,     // display text
  type,        // drives rendering in MessageBubble
  meta,        // crop result, disease result, image preview URL, etc.
  timestamp: new Date().toISOString(),
});

/**
 * Trim history to last N exchanges before sending to backend.
 * Prevents hitting token limits when conversations grow long.
 *
 * @param {Array}  history
 * @param {number} maxPairs  — number of user+ai pairs to keep (default 6)
 */
export const trimHistory = (history, maxPairs = 6) => {
  const maxMessages = maxPairs * 2;
  if (history.length <= maxMessages) return history;
  return history.slice(history.length - maxMessages);
};



// ─────────────────────────────────────────────────────────────────────────────
// IRRIGATION ADVICE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get irrigation advice for a specific farm.
 * Express will enrich this with real MongoDB sensor + schedule data.
 *
 * @param {string} farmId
 * @param {string} language
 */
export const getIrrigationAdvice = async (farmId, language = "en") => {
  const response = await API.post("/api/ai/irrigation/advise", {
    farmId,
    language,
  });
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// FERTILIZER ADVICE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get fertilizer recommendation for a farm at a specific growth stage.
 *
 * @param {string} farmId
 * @param {string} growthStage  "sowing"|"vegetative"|"flowering"|"fruiting"
 * @param {number|null} soilPh
 * @param {string} language
 */
export const getFertilizerAdvice = async (
  farmId,
  growthStage = "vegetative",
  soilPh = null,
  language = "en"
) => {
  const response = await API.post("/api/ai/fertilizer/advise", {
    farmId,
    growth_stage: growthStage,
    soil_ph:      soilPh,
    language,
  });
  return response.data;
};


/**
 * Get weather-based farming advice for a specific farm.
 * Express fetches live Open-Meteo forecast and forwards to FastAPI.
 *
 * @param {string} farmId
 * @param {string} language
 * @returns {Promise<{ summary, today_advice, week_advice, alerts, irrigation_impact, forecast }>}
 */
export const getWeatherAdvice = async (farmId, language = "en") => {
  const response = await API.post("/api/ai/weather/advise", {
    farmId,
    language,
  });
  return response.data;
};

export const generateSmartIrrigationRecommendation = async (farmId, options = {}) => {
  const response = await API.post("/api/ai/smart-irrigation/recommendation", {
    farmId,
    ...options,
  });
  return response.data;
};

export const getSmartIrrigationResult = async (farmId) => {
  const response = await API.get(`/api/ai/smart-irrigation/result/${farmId}`);
  return response.data;
};
