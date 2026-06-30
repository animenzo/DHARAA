// backend/services/aiService.js

const axios = require("axios");

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

// Shared axios instance pointing at FastAPI
const aiClient = axios.create({
  baseURL: FASTAPI_URL,
  timeout: 30000, // 30s — ML inference can be slow
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Chat ──────────────────────────────────────────────────────────────────

/**
 * Send a chat message to the FastAPI chat endpoint.
 * @param {string} message
 * @param {string} language  "en" | "hi"
 * @param {Array}  history   [{role, content}]
 * @param {object} context   optional farm context, e.g. { state, farm_name, current_crop }
 */
const sendChatMessage = async (message, language = "en", history = [], context = {}) => {
  const response = await aiClient.post("/api/chat/", {
    message,
    language,
    history,
    context,
  });
  return response.data; // { reply, language, intent, crop_guidance }
};

// ─── Crop Recommendation ───────────────────────────────────────────────────

/**
 * Request a crop recommendation from FastAPI.
 * @param {object} soilData  { nitrogen, phosphorus, potassium, temperature, humidity, ph, rainfall, language }
 */
const getCropRecommendation = async (soilData) => {
  const response = await aiClient.post("/api/crop/predict", soilData);
  return response.data; // { recommended_crop, confidence, advice, language }
};

/**
 * Easy Mode crop recommendation — farmer-friendly inputs, no N/P/K needed.
 * @param {object} easyData  { state, district, soil_look, water_source, season, land_size, language }
 */
const getEasyCropRecommendation = async (easyData) => {
  const response = await aiClient.post("/api/crop/easy-predict", easyData);
  return response.data;
};

// ─── Disease Detection ─────────────────────────────────────────────────────

/**
 * Forward a plant image to FastAPI for disease detection.
 * @param {Buffer} imageBuffer  Raw image bytes
 * @param {string} mimeType     e.g. "image/jpeg"
 * @param {string} language     "en" | "hi"
 */
const detectPlantDisease = async (imageBuffer, mimeType, language = "en") => {
  // We must send as multipart/form-data to FastAPI
  const FormData = require("form-data");
  const form = new FormData();

  form.append("file", imageBuffer, {
    filename: "plant.jpg",
    contentType: mimeType || "image/jpeg",
  });
  form.append("language", language);

  const response = await aiClient.post("/api/disease/predict", form, {
    headers: form.getHeaders(), // sets correct multipart boundary
  });

  return response.data; // { disease, confidence, treatment, language }
};

// ─── Irrigation Advice ─────────────────────────────────────────────────────

/**
 * Get irrigation advice based on farm + sensor context.
 * @param {object} farmContext  — assembled by irrigationController from MongoDB
 */
const getIrrigationAdvice = async (farmContext) => {
  const response = await aiClient.post("/api/irrigation/advise", farmContext);
  return response.data;
};

// ─── Fertilizer Recommendation ─────────────────────────────────────────────

/**
 * Get fertilizer recommendation.
 * @param {object} fertContext  — { crop, soil_type, growth_stage, size_acres, soil_ph, language }
 */
const getFertilizerAdvice = async (fertContext) => {
  const response = await aiClient.post("/api/fertilizer/advise", fertContext);
  return response.data;
};

const getWeatherAdvice = async (weatherPayload) => {
  const response = await aiClient.post("/api/weather/advise", weatherPayload);
  return response.data;
};

module.exports = {
  sendChatMessage,
  getCropRecommendation,
  getEasyCropRecommendation,
  detectPlantDisease,
  getIrrigationAdvice,
  getFertilizerAdvice,
  getWeatherAdvice
};