// backend/services/aiService.js

const axios = require("axios");

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DISEASE_GEMINI_TIMEOUT_MS = Number(process.env.DISEASE_GEMINI_TIMEOUT_MS) || 90000;

const getAxiosErrorSummary = (err) => {
  if (!err) return "Unknown error";
  if (err.response) {
    const detail =
      typeof err.response.data === "string"
        ? err.response.data
        : JSON.stringify(err.response.data);
    return `HTTP ${err.response.status}: ${detail}`;
  }
  return err.message || "Unknown error";
};

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

const extractJsonObject = (text) => {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch (_err) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch (_nestedErr) {
      return null;
    }
  }
};

const normalizeGeminiDiseaseResult = (raw, language) => {
  const confidenceMap = {
    high: 0.92,
    medium: 0.75,
    low: 0.55,
    unknown: 0.5,
  };

  const cropName = String(raw.crop_name || raw.crop || "").trim();
  const diseaseName = String(raw.disease_name || raw.disease || "Unknown disease").trim();
  const fullName = cropName ? `${cropName} - ${diseaseName}` : diseaseName;
  const confidenceLabel = String(raw.confidence_label || "medium").toLowerCase();
  const confidence =
    typeof raw.confidence === "number"
      ? Math.max(0, Math.min(1, raw.confidence))
      : confidenceMap[confidenceLabel] || 0.75;

  return {
    disease: fullName,
    confidence,
    severity: raw.severity || "Unknown",
    treatment: raw.treatment || raw.recommended_treatment || "",
    prevention: raw.prevention || "",
    organic_remedy: raw.organic_remedy || null,
    symptoms: raw.symptoms_observed || raw.symptoms || null,
    language,
    top3: [{ disease: fullName, confidence }],
    is_healthy: Boolean(raw.is_healthy),
    powered_by: "gemini_2_5_flash_backend",
  };
};

const detectPlantDiseaseWithGemini = async (imageBuffer, mimeType, language = "en") => {
  if (!GEMINI_API_KEY) {
    const err = new Error("GEMINI_API_KEY is not configured.");
    err.code = "GEMINI_NOT_CONFIGURED";
    throw err;
  }

  const languageInstruction =
    language === "hi"
      ? "Reply in simple Hindi for Indian farmers. All JSON string values must be in Hindi, except fixed JSON keys. Use Hindi disease/crop names where commonly known."
      : "Reply in simple English for farmers. All JSON string values must be in English.";
  const prompt =
    `Analyze this crop leaf image for disease. ${languageInstruction} ` +
    "If it appears to be wheat, diagnose wheat diseases instead of forcing PlantVillage labels. " +
    "For confidence_label use High, Medium, or Low. For severity use None, Mild, Moderate, High, or Severe. " +
    "Respond only with valid JSON, no markdown, in exactly this shape: " +
    '{"crop_name":"<plant/crop name visible in image>",' +
    '"disease_name":"<disease name, or Healthy if no disease visible>",' +
    '"is_healthy":<true or false>,' +
    '"confidence_label":"<High|Medium|Low>",' +
    '"severity":"<None|Mild|Moderate|High|Severe>",' +
    '"symptoms_observed":"<1-2 sentences describing visible symptoms>",' +
    '"treatment":"<practical treatment>",' +
    '"organic_remedy":"<one organic remedy>",' +
    '"prevention":"<one prevention tip>"}';

  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType || "image/jpeg",
                data: imageBuffer.toString("base64"),
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
        responseMimeType: "application/json",
      },
    },
    {
      timeout: DISEASE_GEMINI_TIMEOUT_MS,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = extractJsonObject(content);

  if (!parsed) {
    throw new Error("Gemini returned an unreadable disease diagnosis.");
  }

  return normalizeGeminiDiseaseResult(parsed, language);
};

const detectPlantDiseaseWithFastApi = async (imageBuffer, mimeType, language = "en") => {
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

  return response.data;
};

/**
 * Detect plant disease with Gemini first, then FastAPI as fallback.
 * @param {Buffer} imageBuffer  Raw image bytes
 * @param {string} mimeType     e.g. "image/jpeg"
 * @param {string} language     "en" | "hi"
 */
const detectPlantDisease = async (imageBuffer, mimeType, language = "en") => {
  try {
    return await detectPlantDiseaseWithGemini(imageBuffer, mimeType, language);
  } catch (geminiErr) {
    const geminiError = getAxiosErrorSummary(geminiErr);
    console.warn(
      "[aiService.detectPlantDisease] Gemini failed, falling back to FastAPI:",
      geminiError
    );

    try {
      return await detectPlantDiseaseWithFastApi(imageBuffer, mimeType, language);
    } catch (fastApiErr) {
      const err = new Error("Both Gemini and FastAPI disease detection failed.");
      err.code = "AI_DISEASE_UNAVAILABLE";
      err.geminiError = geminiError;
      err.fastApiError = getAxiosErrorSummary(fastApiErr);
      throw err;
    }
  }
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
