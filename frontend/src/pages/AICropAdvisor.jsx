// frontend/src/pages/AICropAdvisor.jsx

import { useState, useCallback,useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

// Components
import ChatWindow from "../components/ChatWindow";
import LanguageSelector from "../components/LanguageSelector";
import VoiceButton from "../components/VoiceButton";
import ImageUploader from "../components/ImageUploader";

// Service layer
import {
  sendChatMessage,
  getCropRecommendation,
  getEasyCropRecommendation,
  detectPlantDisease,
  createMessage,
  trimHistory,
  getIrrigationAdvice,
  getFertilizerAdvice,
  getWeatherAdvice
} from "../services/aiApi";
import API from "../services/api";
import { getCropLabel, getSoilLabel } from "../utils/farmDisplay";
// ─── Crop Form Field Config ────────────────────────────────────────────────
const CROP_FIELDS = [
  { key: "nitrogen", label: "Nitrogen (N)", labelHi: "नाइट्रोजन", unit: "mg/kg", min: 0, max: 200 },
  { key: "phosphorus", label: "Phosphorus (P)", labelHi: "फास्फोरस", unit: "mg/kg", min: 0, max: 200 },
  { key: "potassium", label: "Potassium (K)", labelHi: "पोटेशियम", unit: "mg/kg", min: 0, max: 300 },
  { key: "temperature", label: "Temperature", labelHi: "तापमान", unit: "°C", min: 0, max: 55 },
  { key: "humidity", label: "Humidity", labelHi: "आर्द्रता", unit: "%", min: 0, max: 100 },
  { key: "ph", label: "Soil pH", labelHi: "मिट्टी pH", unit: "", min: 0, max: 14 },
  { key: "rainfall", label: "Rainfall", labelHi: "वर्षा", unit: "mm", min: 0, max: 500 },
];

// ─── Easy Mode Field Options (farmer-friendly, no soil-test numbers) ──────
const INDIAN_STATES = [
  "Andhra Pradesh", "Assam", "Bihar", "Chhattisgarh", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

const SOIL_LOOK_OPTIONS = [
  { key: "black",  en: "Black / Dark soil",   hi: "काली / गहरे रंग की मिट्टी" },
  { key: "red",    en: "Red / Brown soil",    hi: "लाल / भूरी मिट्टी" },
  { key: "sandy",  en: "Sandy soil",          hi: "रेतीली मिट्टी" },
  { key: "loamy",  en: "Loamy / Soft soil",   hi: "दोमट / मुलायम मिट्टी" },
  { key: "clayey", en: "Clayey / Sticky soil",hi: "चिकनी मिट्टी" },
  { key: "unknown",en: "I don't know",        hi: "मुझे नहीं पता" },
];

const WATER_SOURCE_OPTIONS = [
  { key: "borewell", en: "Borewell / Tubewell", hi: "बोरवेल / ट्यूबवेल" },
  { key: "canal",     en: "Canal / River",        hi: "नहर / नदी" },
  { key: "pond",      en: "Pond / Well",           hi: "तालाब / कुआं" },
  { key: "rainfed",   en: "Rain-fed only",         hi: "केवल वर्षा पर निर्भर" },
];

const SEASON_OPTIONS = [
  { key: "kharif",  en: "Kharif (Monsoon, Jun–Oct)", hi: "खरीफ (मानसून, जून–अक्टूबर)" },
  { key: "rabi",    en: "Rabi (Winter, Oct–Mar)",     hi: "रबी (सर्दी, अक्टूबर–मार्च)" },
  { key: "zaid",    en: "Zaid (Summer, Mar–Jun)",     hi: "जायद (गर्मी, मार्च–जून)" },
  { key: "unknown", en: "Not sure",                    hi: "पता नहीं" },
];

const EMPTY_EASY_CROP = {
  state: "", district: "", soil_look: "", water_source: "", season: "", land_size: "",
};

const GROWTH_STAGES = [
  { key: "sowing", en: "Sowing / Transplanting", hi: "बुवाई / रोपाई" },
  { key: "vegetative", en: "Vegetative Growth", hi: "वानस्पतिक वृद्धि" },
  { key: "flowering", en: "Flowering", hi: "फूल आना" },
  { key: "fruiting", en: "Fruiting / Grain Fill", hi: "फल / दाना भरना" },
];

const EMPTY_SOIL = Object.fromEntries(CROP_FIELDS.map((f) => [f.key, ""]));

// ─── Active Tool Panel IDs ─────────────────────────────────────────────────
const TOOLS = {
  NONE: null,
  CROP: "crop",
  DISEASE: "disease",
  IRRIGATION: "irrigation",   
  FERTILIZER: "fertilizer",
  WEATHER:    "weather",     
};

// ══════════════════════════════════════════════════════════════════════════════
export default function AICropAdvisor() {
  // ── State ──────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("en");
  const [isTyping, setIsTyping] = useState(false);
  const [activeTool, setActiveTool] = useState(TOOLS.NONE);

  // Image state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Crop form state
  const [soilData, setSoilData] = useState(EMPTY_SOIL);
  const [cropLoading, setCropLoading] = useState(false);

  // Easy Mode crop state — DEFAULT mode for farmers (no N/P/K needed)
  const [cropMode, setCropMode] = useState("easy");   // "easy" | "advanced"
  const [easyCropData, setEasyCropData] = useState(EMPTY_EASY_CROP);
  const [easyCropLoading, setEasyCropLoading] = useState(false);

  // Disease loading
  const [diseaseLoading, setDiseaseLoading] = useState(false);
  const [farms, setFarms] = useState([]);
  const [selectedFarmId, setSelectedFarmId] = useState("");
  const [growthStage, setGrowthStage] = useState("vegetative");
  const [soilPh, setSoilPh] = useState("");
  const [irrLoading, setIrrLoading] = useState(false);
  const [fertLoading, setFertLoading] = useState(false);

  const [weatherLoading, setWeatherLoading] = useState(false);
  // ── Helpers ────────────────────────────────────────────────────────────
  const pushMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const toggleTool = (tool) =>
    setActiveTool((prev) => (prev === tool ? TOOLS.NONE : tool));

  // ── Chat Send ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text && !imageFile) return;
    if (isTyping) return;

    // 1. Add user text message
    if (text) {
      pushMessage(createMessage("user", text, "text"));
      setInput("");
    }

    // 2. If image attached — add image message + run disease detection
    if (imageFile) {
      pushMessage(
        createMessage("user", language === "hi" ? "पौधे की फोटो भेजी" : "Plant photo sent", "image", {
          previewUrl: imagePreview,
        })
      );
      await handleDiseaseDetect(imageFile);
      return;
    }

    // 3. Normal chat
    setIsTyping(true);
    try {
      const history = trimHistory(
        messages.map((m) => ({ role: m.role, content: m.content }))
      );
      const selectedFarm = farms.find((f) => f._id === selectedFarmId);
      const context = selectedFarm
        ? {
            farm_name: selectedFarm.name,
            current_crop: getCropLabel(selectedFarm.current_crop),
            soil_type: getSoilLabel(selectedFarm.soilType, "loam"),
          }
        : {};

      const data = await sendChatMessage(text, language, history, context);

      if (data.intent === "grow_crop" && data.crop_guidance) {
        pushMessage(createMessage("ai", data.reply, "crop-guidance-result", data.crop_guidance));
      } else {
        pushMessage(createMessage("ai", data.reply, "text"));
      }
    } catch {
      pushMessage(
        createMessage(
          "ai",
          language === "hi"
            ? "माफ़ करें, कुछ गड़बड़ हो गई। दोबारा कोशिश करें।"
            : "Sorry, something went wrong. Please try again.",
          "text"
        )
      );
    } finally {
      setIsTyping(false);
    }
  };

  // ── Crop Recommendation Submit ─────────────────────────────────────────
  const handleCropSubmit = async () => {
    const hasEmpty = CROP_FIELDS.some((f) => soilData[f.key] === "");
    if (hasEmpty) {
      toast.error(
        language === "hi" ? "सभी फ़ील्ड भरें" : "Please fill in all fields"
      );
      return;
    }

    // Add user summary message
    const summaryLines = CROP_FIELDS.map(
      (f) => `${language === "hi" ? f.labelHi : f.label}: ${soilData[f.key]}${f.unit}`
    );
    pushMessage(
      createMessage(
        "user",
        (language === "hi" ? "मेरे खेत का डेटा:\n" : "My farm data:\n") +
        summaryLines.join(" | "),
        "text"
      )
    );

    setActiveTool(TOOLS.NONE);
    setCropLoading(true);
    setIsTyping(true);

    try {
      const payload = {
        ...Object.fromEntries(
          CROP_FIELDS.map((f) => [f.key, parseFloat(soilData[f.key])])
        ),
        language,
      };
      const data = await getCropRecommendation(payload);

      pushMessage(
        createMessage(
          "ai",
          language === "hi"
            ? `आपके लिए सबसे अच्छी फसल: ${data.recommended_crop}`
            : `Best crop for your farm: ${data.recommended_crop}`,
          "crop-result",
          data
        )
      );
      setSoilData(EMPTY_SOIL);
    } catch {
      pushMessage(
        createMessage(
          "ai",
          language === "hi"
            ? "फसल अनुशंसा प्राप्त करने में त्रुटि हुई।"
            : "Failed to get crop recommendation. Please try again.",
          "text"
        )
      );
    } finally {
      setCropLoading(false);
      setIsTyping(false);
    }
  };

  // ── Easy Mode Crop Recommendation Submit ───────────────────────────────
  const handleEasyCropSubmit = async () => {
    if (!easyCropData.state) {
      toast.error(
        language === "hi" ? "कृपया अपना राज्य चुनें" : "Please select your state"
      );
      return;
    }

    const soilLabel = SOIL_LOOK_OPTIONS.find(s => s.key === easyCropData.soil_look);
    const waterLabel = WATER_SOURCE_OPTIONS.find(w => w.key === easyCropData.water_source);
    const seasonLabel = SEASON_OPTIONS.find(s => s.key === easyCropData.season);

    const summaryParts = [
      easyCropData.state,
      easyCropData.district,
      soilLabel ? (language === "hi" ? soilLabel.hi : soilLabel.en) : "",
      waterLabel ? (language === "hi" ? waterLabel.hi : waterLabel.en) : "",
      seasonLabel ? (language === "hi" ? seasonLabel.hi : seasonLabel.en) : "",
    ].filter(Boolean);

    pushMessage(
      createMessage(
        "user",
        (language === "hi" ? "मेरे खेत की जानकारी: " : "My farm info: ") +
        summaryParts.join(" | "),
        "text"
      )
    );

    setActiveTool(TOOLS.NONE);
    setEasyCropLoading(true);
    setIsTyping(true);

    try {
      const data = await getEasyCropRecommendation({
        ...easyCropData,
        language,
      });

      pushMessage(
        createMessage(
          "ai",
          language === "hi"
            ? `आपके लिए सुझाई गई फसल: ${data.recommended_crop}`
            : `Suggested crop for your farm: ${data.recommended_crop}`,
          "easy-crop-result",
          data
        )
      );
      setEasyCropData(EMPTY_EASY_CROP);
    } catch {
      pushMessage(
        createMessage(
          "ai",
          language === "hi"
            ? "फसल सुझाव प्राप्त करने में त्रुटि हुई। कृपया पुनः प्रयास करें।"
            : "Failed to get a crop suggestion. Please try again.",
          "text"
        )
      );
    } finally {
      setEasyCropLoading(false);
      setIsTyping(false);
    }
  };

  // ── Disease Detection ──────────────────────────────────────────────────
  const handleDiseaseDetect = async (file) => {
    setDiseaseLoading(true);
    setIsTyping(true);
    // Clear image state immediately after send
    setImageFile(null);
    setImagePreview(null);

    try {
      const data = await detectPlantDisease(file, language);
      pushMessage(
        createMessage(
          "ai",
          language === "hi"
            ? `रोग की पहचान: ${data.disease}`
            : `Disease identified: ${data.disease}`,
          "disease-result",
          data
        )
      );
    } catch {
      pushMessage(
        createMessage(
          "ai",
          language === "hi"
            ? "रोग पहचान में त्रुटि हुई। कृपया दूसरी फोटो आज़माएं।"
            : "Disease detection failed. Please try another image.",
          "text"
        )
      );
    } finally {
      setDiseaseLoading(false);
      setIsTyping(false);
    }
  };

  // ── Voice transcript handler ───────────────────────────────────────────
  const handleTranscript = (text) => {
    setInput((prev) => (prev ? prev + " " + text : text));
  };

  // ── Image select / clear ───────────────────────────────────────────────
  const handleImageSelect = (file, url) => {
    setImageFile(file);
    setImagePreview(url);
    setActiveTool(TOOLS.NONE); // close any open tool panel
  };

  const handleImageClear = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // ── Irrigation Advice ──────────────────────────────────────────────────
  const handleIrrigationAdvice = async () => {
    if (!selectedFarmId) {
      toast.error(language === "hi" ? "पहले खेत चुनें" : "Please select a farm first");
      return;
    }

    const farm = farms.find((f) => f._id === selectedFarmId);
    pushMessage(
      createMessage(
        "user",
        language === "hi"
          ? `${farm?.name || "मेरे खेत"} के लिए सिंचाई सलाह चाहिए`
          : `Irrigation advice for ${farm?.name || "my farm"}`,
        "text"
      )
    );

    setActiveTool(TOOLS.NONE);
    setIrrLoading(true);
    setIsTyping(true);

    try {
      const data = await getIrrigationAdvice(selectedFarmId, language);

      const urgencyEmoji = {
        critical: "🔴", high: "🟠", medium: "🟡", low: "🟢"
      }[data.urgency] || "🟡";

      pushMessage(
        createMessage(
          "ai",
          `${urgencyEmoji} ${data.recommendation}`,
          "irrigation-result",
          data
        )
      );
    } catch {
      pushMessage(
        createMessage("ai",
          language === "hi"
            ? "सिंचाई सलाह लेने में त्रुटि हुई।"
            : "Failed to get irrigation advice. Please try again.",
          "text"
        )
      );
    } finally {
      setIrrLoading(false);
      setIsTyping(false);
    }
  };

  // ── Fertilizer Advice ──────────────────────────────────────────────────
  const handleFertilizerAdvice = async () => {
    if (!selectedFarmId) {
      toast.error(language === "hi" ? "पहले खेत चुनें" : "Please select a farm first");
      return;
    }

    const farm = farms.find((f) => f._id === selectedFarmId);
    pushMessage(
      createMessage(
        "user",
        language === "hi"
          ? `${farm?.name || "मेरे खेत"} के लिए उर्वरक सलाह — ${GROWTH_STAGES.find(s => s.key === growthStage)?.[language] || growthStage}`
          : `Fertilizer advice for ${farm?.name || "my farm"} — ${GROWTH_STAGES.find(s => s.key === growthStage)?.en || growthStage} stage`,
        "text"
      )
    );

    setActiveTool(TOOLS.NONE);
    setFertLoading(true);
    setIsTyping(true);

    try {
      const data = await getFertilizerAdvice(
        selectedFarmId,
        growthStage,
        soilPh ? parseFloat(soilPh) : null,
        language
      );
      pushMessage(
        createMessage(
          "ai",
          language === "hi"
            ? `🌿 ${farm?.name} के लिए उर्वरक अनुशंसा`
            : `🌿 Fertilizer recommendation for ${farm?.name}`,
          "fertilizer-result",
          data
        )
      );
    } catch {
      pushMessage(
        createMessage("ai",
          language === "hi"
            ? "उर्वरक सलाह लेने में त्रुटि हुई।"
            : "Failed to get fertilizer advice. Please try again.",
          "text"
        )
      );
    } finally {
      setFertLoading(false);
      setIsTyping(false);
    }
  };
// ── Weather Advice ─────────────────────────────────────────────────────
const handleWeatherAdvice = async () => {
  if (!selectedFarmId) {
    toast.error(language === "hi" ? "पहले खेत चुनें" : "Please select a farm first");
    return;
  }

  const farm = farms.find((f) => f._id === selectedFarmId);
  pushMessage(
    createMessage(
      "user",
      language === "hi"
        ? `${farm?.name || "मेरे खेत"} के लिए मौसम आधारित सलाह चाहिए`
        : `Weather-based advice for ${farm?.name || "my farm"}`,
      "text"
    )
  );

  setActiveTool(TOOLS.NONE);
  setWeatherLoading(true);
  setIsTyping(true);

  try {
    const data = await getWeatherAdvice(selectedFarmId, language);
    pushMessage(
      createMessage(
        "ai",
        `🌤️ ${data.summary}`,
        "weather-result",
        data
      )
    );
  } catch {
    pushMessage(
      createMessage(
        "ai",
        language === "hi"
          ? "मौसम डेटा प्राप्त करने में त्रुटि हुई। कृपया पुनः प्रयास करें।"
          : "Could not fetch weather data. Please try again.",
        "text"
      )
    );
  } finally {
    setWeatherLoading(false);
    setIsTyping(false);
  }
};
  // ── Enter key ─────────────────────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };


  useEffect(() => {
    API.get("/farm")
      .then((res) => {
        const list = res.data?.farms || res.data || [];
        setFarms(list);
        if (list.length > 0) setSelectedFarmId(list[0]._id);
      })
      .catch(() => { });
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-xl">
            🌾
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800">
              {language === "hi" ? "AI कृषि सहायक" : "AI Crop Advisor"}
            </h1>
            <p className="text-xs text-emerald-600 font-medium">
              {language === "hi" ? "ऑनलाइन" : "Online"} · DHARAA AI
            </p>
          </div>
        </div>
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>

      {/* ── Tool Panel (Crop Form / Disease Hint) ────────────────────── */}
      <AnimatePresence>
        {activeTool === TOOLS.CROP && (
          <motion.div
            key="crop-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-white border-b border-gray-100 shadow-sm flex-shrink-0"
          >
            <div className="px-4 py-4">
              {/* Mode toggle */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🌱</span>
                  <h2 className="text-sm font-bold text-gray-700">
                    {cropMode === "easy"
                      ? (language === "hi" ? "आसान फसल सुझाव" : "Easy Crop Suggestion")
                      : (language === "hi" ? "मिट्टी और जलवायु डेटा" : "Soil & Climate Data")}
                  </h2>
                </div>
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setCropMode("easy")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all
                      ${cropMode === "easy" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"}`}
                  >
                    {language === "hi" ? "आसान" : "Easy"}
                  </button>
                  <button
                    onClick={() => setCropMode("advanced")}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all
                      ${cropMode === "advanced" ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500"}`}
                  >
                    {language === "hi" ? "उन्नत (N/P/K)" : "Advanced (N/P/K)"}
                  </button>
                </div>
              </div>

              {/* ── EASY MODE — default, farmer-friendly ── */}
              {cropMode === "easy" && (
                <>
                  <p className="text-xs text-gray-400 mb-3">
                    {language === "hi"
                      ? "कोई मिट्टी परीक्षण नंबर नहीं चाहिए — बस अपने क्षेत्र की जानकारी दें।"
                      : "No soil-test numbers needed — just tell us about your area."}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {/* State (required) */}
                    <div>
                      <label className="text-[10px] text-gray-500 font-semibold uppercase block mb-0.5">
                        {language === "hi" ? "राज्य *" : "State *"}
                      </label>
                      <select
                        value={easyCropData.state}
                        onChange={(e) => setEasyCropData((p) => ({ ...p, state: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                      >
                        <option value="">{language === "hi" ? "चुनें" : "Select"}</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* District (optional) */}
                    <div>
                      <label className="text-[10px] text-gray-500 font-semibold uppercase block mb-0.5">
                        {language === "hi" ? "जिला (वैकल्पिक)" : "District (optional)"}
                      </label>
                      <input
                        type="text"
                        value={easyCropData.district}
                        onChange={(e) => setEasyCropData((p) => ({ ...p, district: e.target.value }))}
                        placeholder={language === "hi" ? "जैसे उदयपुर" : "e.g. Udaipur"}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                      />
                    </div>

                    {/* Soil look */}
                    <div>
                      <label className="text-[10px] text-gray-500 font-semibold uppercase block mb-0.5">
                        {language === "hi" ? "मिट्टी कैसी दिखती है?" : "What does your soil look like?"}
                      </label>
                      <select
                        value={easyCropData.soil_look}
                        onChange={(e) => setEasyCropData((p) => ({ ...p, soil_look: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                      >
                        <option value="">{language === "hi" ? "चुनें" : "Select"}</option>
                        {SOIL_LOOK_OPTIONS.map((o) => (
                          <option key={o.key} value={o.key}>{language === "hi" ? o.hi : o.en}</option>
                        ))}
                      </select>
                    </div>

                    {/* Water source */}
                    <div>
                      <label className="text-[10px] text-gray-500 font-semibold uppercase block mb-0.5">
                        {language === "hi" ? "पानी का स्रोत" : "Water source"}
                      </label>
                      <select
                        value={easyCropData.water_source}
                        onChange={(e) => setEasyCropData((p) => ({ ...p, water_source: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                      >
                        <option value="">{language === "hi" ? "चुनें" : "Select"}</option>
                        {WATER_SOURCE_OPTIONS.map((o) => (
                          <option key={o.key} value={o.key}>{language === "hi" ? o.hi : o.en}</option>
                        ))}
                      </select>
                    </div>

                    {/* Season */}
                    <div>
                      <label className="text-[10px] text-gray-500 font-semibold uppercase block mb-0.5">
                        {language === "hi" ? "मौसम/सीजन" : "Season"}
                      </label>
                      <select
                        value={easyCropData.season}
                        onChange={(e) => setEasyCropData((p) => ({ ...p, season: e.target.value }))}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                      >
                        <option value="">{language === "hi" ? "चुनें" : "Select"}</option>
                        {SEASON_OPTIONS.map((o) => (
                          <option key={o.key} value={o.key}>{language === "hi" ? o.hi : o.en}</option>
                        ))}
                      </select>
                    </div>

                    {/* Land size (optional, free text) */}
                    <div>
                      <label className="text-[10px] text-gray-500 font-semibold uppercase block mb-0.5">
                        {language === "hi" ? "खेत का आकार (वैकल्पिक)" : "Land size (optional)"}
                      </label>
                      <input
                        type="text"
                        value={easyCropData.land_size}
                        onChange={(e) => setEasyCropData((p) => ({ ...p, land_size: e.target.value }))}
                        placeholder={language === "hi" ? "जैसे 1 बीघा" : "e.g. 1 acre"}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg
                          focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleEasyCropSubmit}
                      disabled={easyCropLoading}
                      className="flex-1 py-2 bg-emerald-600 text-white text-sm font-semibold
                        rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {easyCropLoading
                        ? (language === "hi" ? "सोच रहे हैं..." : "Thinking...")
                        : (language === "hi" ? "फसल सुझाएं" : "Suggest a Crop")}
                    </button>
                    <button
                      onClick={() => { setEasyCropData(EMPTY_EASY_CROP); setActiveTool(TOOLS.NONE); }}
                      className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-semibold
                        rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      {language === "hi" ? "रद्द करें" : "Cancel"}
                    </button>
                  </div>
                </>
              )}

              {/* ── ADVANCED MODE — N/P/K, for researchers/precise soil-test data ── */}
              {cropMode === "advanced" && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {CROP_FIELDS.map((field) => (
                      <div key={field.key}>
                        <label className="text-[10px] text-gray-500 font-semibold uppercase block mb-0.5">
                          {language === "hi" ? field.labelHi : field.label}
                          {field.unit && (
                            <span className="text-gray-400 ml-1">({field.unit})</span>
                          )}
                        </label>
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          step="0.1"
                          placeholder={`${field.min}–${field.max}`}
                          value={soilData[field.key]}
                          onChange={(e) =>
                            setSoilData((prev) => ({
                              ...prev,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg
                            focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-gray-50"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCropSubmit}
                      disabled={cropLoading}
                      className="flex-1 py-2 bg-emerald-600 text-white text-sm font-semibold
                        rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    >
                      {cropLoading
                        ? (language === "hi" ? "विश्लेषण हो रहा है..." : "Analysing...")
                        : (language === "hi" ? "फसल सुझाएं" : "Get Recommendation")}
                    </button>
                    <button
                      onClick={() => { setSoilData(EMPTY_SOIL); setActiveTool(TOOLS.NONE); }}
                      className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-semibold
                        rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      {language === "hi" ? "रद्द करें" : "Cancel"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {activeTool === TOOLS.DISEASE && (
          <motion.div
            key="disease-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-orange-50 border-b border-orange-100 flex-shrink-0"
          >
            <div className="px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">🔬</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-700">
                  {language === "hi"
                    ? "पौधे की फोटो अपलोड करें"
                    : "Upload a photo of the affected plant"}
                </p>
                <p className="text-xs text-orange-500">
                  {language === "hi"
                    ? "नीचे कैमरा आइकन से फोटो चुनें, फिर भेजें दबाएं"
                    : "Use the camera icon below to select a photo, then press Send"}
                </p>
              </div>
              <button
                onClick={() => setActiveTool(TOOLS.NONE)}
                className="text-orange-400 hover:text-orange-600 text-lg"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Irrigation Panel ── */}
        {activeTool === TOOLS.IRRIGATION && (
          <motion.div
            key="irrigation-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-blue-50 border-b border-blue-100 flex-shrink-0"
          >
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">💧</span>
                <h2 className="text-sm font-bold text-blue-700">
                  {language === "hi" ? "सिंचाई सलाह" : "Irrigation Advice"}
                </h2>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-blue-200 rounded-xl
            bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  {farms.length === 0 && (
                    <option value="">
                      {language === "hi" ? "कोई खेत नहीं मिला" : "No farms found"}
                    </option>
                  )}
                  {farms.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} — {getCropLabel(f.current_crop)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleIrrigationAdvice}
                  disabled={irrLoading || !selectedFarmId}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold
            rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {irrLoading
                    ? (language === "hi" ? "विश्लेषण हो रहा है..." : "Analysing...")
                    : (language === "hi" ? "सिंचाई सलाह लें" : "Get Irrigation Advice")}
                </button>
                <button
                  onClick={() => setActiveTool(TOOLS.NONE)}
                  className="px-4 py-2 bg-white text-blue-600 text-sm font-semibold
            rounded-xl border border-blue-200 hover:bg-blue-50 transition-colors"
                >
                  {language === "hi" ? "रद्द करें" : "Cancel"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Fertilizer Panel ── */}
        {activeTool === TOOLS.FERTILIZER && (
          <motion.div
            key="fertilizer-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden bg-amber-50 border-b border-amber-100 flex-shrink-0"
          >
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🌿</span>
                <h2 className="text-sm font-bold text-amber-700">
                  {language === "hi" ? "उर्वरक अनुशंसा" : "Fertilizer Recommendation"}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                {/* Farm selector */}
                <select
                  value={selectedFarmId}
                  onChange={(e) => setSelectedFarmId(e.target.value)}
                  className="px-3 py-2 text-sm border border-amber-200 rounded-xl
            bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {farms.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} — {getCropLabel(f.current_crop)}
                    </option>
                  ))}
                </select>

                {/* Growth stage */}
                <select
                  value={growthStage}
                  onChange={(e) => setGrowthStage(e.target.value)}
                  className="px-3 py-2 text-sm border border-amber-200 rounded-xl
            bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {GROWTH_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {language === "hi" ? s.hi : s.en}
                    </option>
                  ))}
                </select>

                {/* Optional soil pH */}
                <input
                  type="number"
                  min="0"
                  max="14"
                  step="0.1"
                  placeholder={language === "hi" ? "मिट्टी pH (वैकल्पिक)" : "Soil pH (optional)"}
                  value={soilPh}
                  onChange={(e) => setSoilPh(e.target.value)}
                  className="px-3 py-2 text-sm border border-amber-200 rounded-xl
            bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleFertilizerAdvice}
                  disabled={fertLoading || !selectedFarmId}
                  className="flex-1 py-2 bg-amber-600 text-white text-sm font-semibold
            rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {fertLoading
                    ? (language === "hi" ? "विश्लेषण हो रहा है..." : "Analysing...")
                    : (language === "hi" ? "उर्वरक सलाह लें" : "Get Fertilizer Advice")}
                </button>
                <button
                  onClick={() => setActiveTool(TOOLS.NONE)}
                  className="px-4 py-2 bg-white text-amber-600 text-sm font-semibold
            rounded-xl border border-amber-200 hover:bg-amber-50 transition-colors"
                >
                  {language === "hi" ? "रद्द करें" : "Cancel"}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTool === TOOLS.WEATHER && (
  <motion.div
    key="weather-panel"
    initial={{ height: 0, opacity: 0 }}
    animate={{ height: "auto", opacity: 1 }}
    exit={{ height: 0, opacity: 0 }}
    transition={{ duration: 0.25 }}
    className="overflow-hidden bg-sky-50 border-b border-sky-100 flex-shrink-0"
  >
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🌤️</span>
        <div>
          <h2 className="text-sm font-bold text-sky-700">
            {language === "hi" ? "मौसम आधारित सलाह" : "Weather-Based Advice"}
          </h2>
          <p className="text-[11px] text-sky-500">
            {language === "hi"
              ? "7 दिनों का लाइव पूर्वानुमान — Open-Meteo"
              : "Live 7-day forecast via Open-Meteo (no API key needed)"}
          </p>
        </div>
      </div>

      <select
        value={selectedFarmId}
        onChange={(e) => setSelectedFarmId(e.target.value)}
        className="w-full px-3 py-2 mb-3 text-sm border border-sky-200 rounded-xl
          bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
      >
        {farms.map((f) => (
          <option key={f._id} value={f._id}>
            {f.name} — {getCropLabel(f.current_crop)}
            {f.pincode ? ` (${f.pincode})` : ""}
          </option>
        ))}
      </select>

      <div className="flex gap-2">
        <button
          onClick={handleWeatherAdvice}
          disabled={weatherLoading || !selectedFarmId}
          className="flex-1 py-2 bg-sky-600 text-white text-sm font-semibold
            rounded-xl hover:bg-sky-700 transition-colors disabled:opacity-50"
        >
          {weatherLoading
            ? (language === "hi" ? "मौसम डेटा ला रहे हैं..." : "Fetching forecast...")
            : (language === "hi" ? "मौसम सलाह लें" : "Get Weather Advice")}
        </button>
        <button
          onClick={() => setActiveTool(TOOLS.NONE)}
          className="px-4 py-2 bg-white text-sky-600 text-sm font-semibold
            rounded-xl border border-sky-200 hover:bg-sky-50 transition-colors"
        >
          {language === "hi" ? "रद्द करें" : "Cancel"}
        </button>
      </div>
    </div>
  </motion.div>
)}
      </AnimatePresence>

      {/* ── Chat Window ───────────────────────────────────────────────── */}
      <ChatWindow messages={messages} isTyping={isTyping} language={language} />

      {/* ── Input Bar ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100 px-3 py-3 shadow-sm">

        {/* Tool trigger buttons */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => toggleTool(TOOLS.CROP)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              transition-all border
              ${activeTool === TOOLS.CROP
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              }`}
          >
            🌱 {language === "hi" ? "फसल सिफारिश" : "Crop Recommend"}
          </button>

          <button
            onClick={() => toggleTool(TOOLS.DISEASE)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              transition-all border
              ${activeTool === TOOLS.DISEASE
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-orange-600 border-orange-200 hover:bg-orange-50"
              }`}
          >
            🔬 {language === "hi" ? "रोग पहचान" : "Disease Detect"}
          </button>

          <button
            onClick={() => toggleTool(TOOLS.IRRIGATION)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
    transition-all border
    ${activeTool === TOOLS.IRRIGATION
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-blue-700 border-blue-200 hover:bg-blue-50"
              }`}
          >
            💧 {language === "hi" ? "सिंचाई सलाह" : "Irrigation"}
          </button>

          <button
            onClick={() => toggleTool(TOOLS.FERTILIZER)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
    transition-all border
    ${activeTool === TOOLS.FERTILIZER
                ? "bg-amber-600 text-white border-amber-600"
                : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
              }`}
          >
            🌿 {language === "hi" ? "उर्वरक" : "Fertilizer"}
          </button>

          <button
  onClick={() => toggleTool(TOOLS.WEATHER)}
  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
    transition-all border
    ${activeTool === TOOLS.WEATHER
      ? "bg-sky-600 text-white border-sky-600"
      : "bg-white text-sky-700 border-sky-200 hover:bg-sky-50"
    }`}
>
  🌤️ {language === "hi" ? "मौसम" : "Weather"}
</button>
        </div>

        {/* Input row */}
        <div className="flex items-end gap-2">

          {/* Image uploader / preview */}
          <ImageUploader
            onImageSelect={handleImageSelect}
            onClear={handleImageClear}
            previewUrl={imagePreview}
            disabled={isTyping || diseaseLoading}
            language={language}
          />

          {/* Text input */}
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              placeholder={
                language === "hi"
                  ? "अपना सवाल लिखें..."
                  : "Ask about crops, diseases, irrigation..."
              }
              className="w-full resize-none px-4 py-2.5 pr-12 text-sm border border-gray-200
                rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-400
                bg-gray-50 placeholder-gray-400 leading-relaxed
                disabled:opacity-60 max-h-28 overflow-y-auto"
              style={{ minHeight: "42px" }}
            />
          </div>

          {/* Voice button */}
          <VoiceButton
            onTranscript={handleTranscript}
            language={language}
            disabled={isTyping}
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={isTyping || (!input.trim() && !imageFile)}
            className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700
              transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center flex-shrink-0"
          >
            <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

        <p className="text-[10px] text-gray-400 text-center mt-2">
          {language === "hi"
            ? "AI सलाह है — कृषि विशेषज्ञ से भी परामर्श लें"
            : "AI guidance only — always consult a local agronomist"}
        </p>
      </div>
    </div>
  );
}
