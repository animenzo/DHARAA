// frontend/src/services/aiApi.js
//
// AI Crop Advisor — service layer
// All methods reuse the existing API axios instance so JWT auth,
// token refresh, and base URL are handled automatically.

import API from "./api";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";

const compressImageForDiseaseScan = (imageFile) =>
  new Promise((resolve) => {
    if (!imageFile?.type?.startsWith("image/")) return resolve(imageFile);

    const image = new Image();
    const objectUrl = URL.createObjectURL(imageFile);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxSide = 1024;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));

      if (scale >= 1 && imageFile.size <= 900 * 1024) {
        resolve(imageFile);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(imageFile);
            return;
          }

          resolve(
            new File([blob], imageFile.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            })
          );
        },
        "image/jpeg",
        0.82
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(imageFile);
    };

    image.src = objectUrl;
  });

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };

    reader.onerror = () => reject(reader.error || new Error("Failed to read image."));
    reader.readAsDataURL(file);
  });

const extractJsonObject = (text) => {
  if (!text || typeof text !== "string") return null;

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
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
    success: true,
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
    powered_by: "gemini_frontend",
  };
};

const detectPlantDiseaseWithGemini = async (imageFile, language = "en") => {
  if (!GEMINI_API_KEY) {
    throw new Error("VITE_GEMINI_API_KEY is not configured.");
  }

  const imageBase64 = await fileToBase64(imageFile);
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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: imageFile.type || "image/jpeg",
                  data: imageBase64,
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
      }),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini failed with ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = extractJsonObject(text);

  if (!parsed) {
    throw new Error("Gemini returned an unreadable disease diagnosis.");
  }

  return normalizeGeminiDiseaseResult(parsed, language);
};

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
  const uploadFile = await compressImageForDiseaseScan(imageFile);
  let geminiFailure = null;

  try {
    return await detectPlantDiseaseWithGemini(uploadFile, language);
  } catch (geminiError) {
    geminiFailure = geminiError;
    console.warn(
      "[aiApi.detectPlantDisease] Gemini failed, falling back to backend:",
      geminiError.message
    );
  }

  const formData = new FormData();
  formData.append("file", uploadFile);
  formData.append("language", language);

  try {
    const response = await API.post("/api/ai/disease/predict", formData, {
      headers: {
        // Let the browser set Content-Type with the correct multipart boundary
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (backendError) {
    const backendMessage =
      backendError?.response?.data?.details
        ? JSON.stringify(backendError.response.data.details)
        : backendError?.response?.data?.error || backendError.message;
    throw new Error(
      `Gemini failed: ${geminiFailure?.message || "unknown"}. Backend failed: ${backendMessage}`
    );
  }
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
