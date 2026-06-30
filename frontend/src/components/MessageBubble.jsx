// frontend/src/components/MessageBubble.jsx

import { motion } from "framer-motion";

// Confidence bar sub-component
const ConfidenceBar = ({ value }) => {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-yellow-400" : "bg-red-400";
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Confidence</span>
        <span className="font-bold">{pct}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

// Crop Result Card
// Replace CropResultCard in frontend/src/components/MessageBubble.jsx

const CropResultCard = ({ meta, language }) => (
  <div className="mt-2 bg-white border border-emerald-200 rounded-xl p-4 shadow-sm min-w-[240px]">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-2xl">🌾</span>
      <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
        {language === "hi" ? "फसल सिफारिश" : "Crop Recommendation"}
      </span>
    </div>

    {/* Best crop */}
    <p className="text-xl font-bold text-gray-800 capitalize mb-1">
      {meta.recommended_crop}
    </p>
    <ConfidenceBar value={meta.confidence} />

    {/* Top 3 alternatives */}
    {meta.top3 && meta.top3.length > 1 && (
      <div className="mt-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">
          {language === "hi" ? "अन्य विकल्प" : "Alternatives"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {meta.top3.slice(1).map((c) => (
            <span
              key={c.crop}
              className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs
                rounded-full border border-emerald-100 font-medium"
            >
              {c.crop} · {Math.round(c.confidence * 100)}%
            </span>
          ))}
        </div>
      </div>
    )}

    {/* Advice text */}
    {meta.advice && (
      <p className="mt-3 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-2">
        {meta.advice.replace(/\*\*/g, "")}
      </p>
    )}
    {meta.llama_insight && (
  <div className="mt-3 bg-purple-50 rounded-lg p-3 border border-purple-100">
    <p className="text-[10px] font-semibold text-purple-600 uppercase mb-1 flex items-center gap-1">
      <span>✨</span>
      {language === "hi" ? "Llama AI विश्लेषण" : "Llama AI Insight"}
    </p>
    <p className="text-sm text-gray-700 leading-relaxed">
      {meta.llama_insight}
    </p>
  </div>
)}

{/* Powered by badge */}
{meta.powered_by && (
  <p className="text-[9px] text-gray-300 text-right mt-2">
    {meta.powered_by === "llama+ml" ? "✨ Llama + ML Model" : "🤖 ML Model"}
  </p>
)}
  </div>
);

// Disease Result Card
const SEVERITY_COLOR = {
  None: "bg-green-100 text-green-700",
  Mild: "bg-yellow-100 text-yellow-700",
  Moderate: "bg-orange-100 text-orange-700",
  High: "bg-red-100 text-red-700",
  Severe: "bg-red-200 text-red-800",
  Unknown: "bg-gray-100 text-gray-600",
};

const DiseaseResultCard = ({ meta, language }) => (
  <div className="mt-2 bg-white border border-orange-200 rounded-xl p-4 shadow-sm min-w-[240px]">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{meta.is_healthy ? "✅" : "🔬"}</span>
        <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">
          {language === "hi" ? "रोग पहचान" : "Disease Detected"}
        </span>
      </div>
      {meta.severity && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SEVERITY_COLOR[meta.severity] || SEVERITY_COLOR.Unknown}`}>
          {meta.severity}
        </span>
      )}
    </div>

    <p className="text-lg font-bold text-gray-800">{meta.disease}</p>
    <ConfidenceBar value={meta.confidence} />

    {meta.symptoms && (
      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
          {language === "hi" ? "लक्षण" : "Symptoms Observed"}
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">{meta.symptoms}</p>
      </div>
    )}

    {meta.treatment && (
      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
          {language === "hi" ? "उपचार" : "Treatment"}
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">
          {meta.treatment.replace(/\*\*/g, "")}
        </p>
      </div>
    )}

    {meta.organic_remedy && (
      <div className="mt-2 bg-green-50 rounded-lg p-2 border border-green-100">
        <p className="text-[10px] font-semibold text-green-600 uppercase mb-0.5">
          🌱 {language === "hi" ? "जैविक/देसी उपाय" : "Organic Remedy"}
        </p>
        <p className="text-xs text-gray-600">{meta.organic_remedy}</p>
      </div>
    )}

    {meta.prevention && (
      <div className="mt-2">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
          {language === "hi" ? "रोकथाम" : "Prevention"}
        </p>
        <p className="text-sm text-gray-600 leading-relaxed">{meta.prevention}</p>
      </div>
    )}

    {meta.powered_by && (
      <p className="text-[9px] text-gray-300 text-right mt-2">
        {meta.powered_by === "llama" ? "✨ Llama AI Vision" : "🤖 ML Model (CNN)"}
      </p>
    )}
  </div>
);

// Add to MessageBubble.jsx

const URGENCY_STYLE = {
  critical: "border-red-300 bg-red-50",
  high:     "border-orange-300 bg-orange-50",
  medium:   "border-yellow-300 bg-yellow-50",
  low:      "border-green-300 bg-green-50",
};

const IrrigationResultCard = ({ meta, language }) => (
  <div className={`mt-2 border rounded-xl p-4 shadow-sm min-w-[240px]
    ${URGENCY_STYLE[meta.urgency] || "border-blue-200 bg-blue-50"}`}
  >
    <div className="flex items-center gap-2 mb-2">
      <span className="text-2xl">💧</span>
      <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
        {language === "hi" ? "सिंचाई सलाह" : "Irrigation Advice"}
      </span>
      {meta.urgency && (
        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
          ${meta.urgency === "critical" ? "bg-red-200 text-red-700"
            : meta.urgency === "high" ? "bg-orange-200 text-orange-700"
            : meta.urgency === "medium" ? "bg-yellow-200 text-yellow-700"
            : "bg-green-200 text-green-700"}`}
        >
          {meta.urgency}
        </span>
      )}
    </div>

    {meta.recommendation && (
      <p className="text-sm text-gray-700 leading-relaxed mb-3">
        {meta.recommendation.replace(/\*\*/g, "")}
      </p>
    )}

    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="bg-white rounded-lg p-2 border border-blue-100">
        <p className="text-gray-400 font-semibold uppercase text-[10px] mb-0.5">
          {language === "hi" ? "अनुशंसित अवधि" : "Suggested Duration"}
        </p>
        <p className="text-blue-700 font-bold">
          {meta.suggested_duration} {language === "hi" ? "मिनट" : "min"}
        </p>
      </div>
      <div className="bg-white rounded-lg p-2 border border-blue-100">
        <p className="text-gray-400 font-semibold uppercase text-[10px] mb-0.5">
          {language === "hi" ? "अगली सिंचाई" : "Next Irrigation"}
        </p>
        <p className="text-blue-700 font-bold text-[11px]">{meta.next_irrigation}</p>
      </div>
    </div>

    {meta.water_saving_tip && (
      <div className="mt-3 bg-white rounded-lg p-2 border border-blue-100">
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
          💡 {language === "hi" ? "जल बचत सुझाव" : "Water Saving Tip"}
        </p>
        <p className="text-xs text-gray-600">{meta.water_saving_tip}</p>
      </div>
    )}
  </div>
);

const FertilizerResultCard = ({ meta, language }) => (
  <div className="mt-2 bg-white border border-amber-200 rounded-xl p-4 shadow-sm min-w-[240px]">
    <div className="flex items-center gap-2 mb-3">
      <span className="text-2xl">🌿</span>
      <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
        {language === "hi" ? "उर्वरक अनुशंसा" : "Fertilizer Recommendation"}
      </span>
    </div>

    <div className="space-y-2">
      {[
        { label: language === "hi" ? "प्राथमिक उर्वरक" : "Primary Fertilizer", value: meta.primary_fertilizer, color: "text-amber-700" },
        { label: language === "hi" ? "मात्रा" : "Dose / Acre", value: meta.dose_per_acre, color: "text-gray-700" },
        { label: language === "hi" ? "प्रयोग विधि" : "Application Method", value: meta.application_method, color: "text-gray-700" },
        { label: language === "hi" ? "समय" : "Timing", value: meta.timing, color: "text-gray-700" },
      ].filter(row => row.value).map(({ label, value, color }) => (
        <div key={label} className="flex gap-2 text-xs border-b border-gray-50 pb-1.5">
          <span className="text-gray-400 font-semibold w-28 flex-shrink-0">{label}</span>
          <span className={`${color} font-medium`}>{value}</span>
        </div>
      ))}
    </div>

    {meta.organic_alternative && (
      <div className="mt-3 bg-green-50 rounded-lg p-2 border border-green-100">
        <p className="text-[10px] font-semibold text-green-600 uppercase mb-0.5">
          🌱 {language === "hi" ? "जैविक विकल्प" : "Organic Alternative"}
        </p>
        <p className="text-xs text-gray-600">{meta.organic_alternative}</p>
      </div>
    )}

    {meta.caution && (
      <div className="mt-2 bg-red-50 rounded-lg p-2 border border-red-100">
        <p className="text-[10px] font-semibold text-red-500 uppercase mb-0.5">
          ⚠️ {language === "hi" ? "सावधानी" : "Caution"}
        </p>
        <p className="text-xs text-gray-600">{meta.caution}</p>
      </div>
    )}
  </div>
);

// ── Easy Mode Crop Result Card (farmer-friendly, no N/P/K) ─────────────
const EasyCropResultCard = ({ meta, language }) => (
  <div className="mt-2 bg-white border border-emerald-200 rounded-xl p-4 shadow-sm min-w-[240px]">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl">🌾</span>
        <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">
          {language === "hi" ? "फसल सुझाव" : "Crop Suggestion"}
        </span>
      </div>
      {meta.confidence_label && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
          {meta.confidence_label}
        </span>
      )}
    </div>

    <p className="text-xl font-bold text-gray-800 capitalize mb-2">
      {meta.recommended_crop}
    </p>

    {meta.reason && (
      <p className="text-sm text-gray-600 leading-relaxed mb-3">{meta.reason}</p>
    )}

    {meta.soil_type_guess && (
      <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 mb-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
          {language === "hi" ? "मिट्टी का प्रकार" : "Soil Type"}
        </p>
        <p className="text-xs text-gray-700">{meta.soil_type_guess}</p>
      </div>
    )}

    {meta.fertilizer_tip && (
      <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 mb-2">
        <p className="text-[10px] font-semibold text-amber-600 uppercase mb-0.5">
          🌿 {language === "hi" ? "खाद सुझाव" : "Fertilizer Tip"}
        </p>
        <p className="text-xs text-gray-700">{meta.fertilizer_tip}</p>
      </div>
    )}

    {meta.water_tip && (
      <div className="bg-blue-50 rounded-lg p-2 border border-blue-100 mb-2">
        <p className="text-[10px] font-semibold text-blue-600 uppercase mb-0.5">
          💧 {language === "hi" ? "पानी सुझाव" : "Water Tip"}
        </p>
        <p className="text-xs text-gray-700">{meta.water_tip}</p>
      </div>
    )}

    {meta.alternatives && meta.alternatives.length > 0 && (
      <div className="mt-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">
          {language === "hi" ? "अन्य विकल्प" : "Alternatives"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {meta.alternatives.map((c) => (
            <span key={c} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs
              rounded-full border border-emerald-100 font-medium">
              {c}
            </span>
          ))}
        </div>
      </div>
    )}

    {meta.powered_by && (
      <p className="text-[9px] text-gray-300 text-right mt-2">
        {meta.powered_by === "llama" ? "✨ Llama AI" : "📋 Region Guide"}
      </p>
    )}
  </div>
);

// ── Crop Guidance Card (from "I want to grow tomato" chat intent) ──────
const CropGuidanceCard = ({ meta, language }) => (
  <div className="mt-2 bg-white border border-teal-200 rounded-xl p-4 shadow-sm min-w-[240px]">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-2xl">🌿</span>
      <span className="text-xs font-semibold text-teal-600 uppercase tracking-wide">
        {language === "hi" ? "खेती मार्गदर्शन" : "Growing Guidance"}
      </span>
    </div>

    <p className="text-lg font-bold text-gray-800 capitalize mb-2">
      {meta.crop_name}
    </p>

    {meta.is_suitable_advice && (
      <p className="text-sm text-gray-600 leading-relaxed mb-3">{meta.is_suitable_advice}</p>
    )}

    <div className="space-y-2">
      {[
        { icon: "🟫", label: language === "hi" ? "मिट्टी" : "Soil", value: meta.soil_type },
        { icon: "🌿", label: language === "hi" ? "खाद" : "Fertilizer", value: meta.fertilizer_tip },
        { icon: "💧", label: language === "hi" ? "पानी" : "Water", value: meta.water_tip },
        { icon: "☀️", label: language === "hi" ? "धूप/दूरी" : "Sunlight/Spacing", value: meta.sunlight_tip },
      ].filter(row => row.value).map((row) => (
        <div key={row.label} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">
            {row.icon} {row.label}
          </p>
          <p className="text-xs text-gray-700">{row.value}</p>
        </div>
      ))}
    </div>

    {meta.powered_by && (
      <p className="text-[9px] text-gray-300 text-right mt-2">
        {meta.powered_by === "llama" ? "✨ Llama AI" : ""}
      </p>
    )}
  </div>
);

const ALERT_STYLE = {
  info:    "bg-blue-50  border-blue-200  text-blue-700",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
  danger:  "bg-red-50   border-red-200   text-red-700",
};

const WeatherResultCard = ({ meta, language }) => {
  const forecast = meta.forecast || [];

  return (
    <div className="mt-2 bg-white border border-sky-200 rounded-xl p-4 shadow-sm min-w-[260px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🌤️</span>
        <span className="text-xs font-semibold text-sky-600 uppercase tracking-wide">
          {language === "hi" ? "मौसम आधारित सलाह" : "Weather Advice"}
        </span>
      </div>

      {/* Today's advice */}
      <p className="text-sm text-gray-700 leading-relaxed mb-3 border-b border-gray-100 pb-3">
        {meta.today_advice}
      </p>

      {/* 7-day mini forecast strip */}
      {forecast.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">
            {language === "hi" ? "7 दिनों का पूर्वानुमान" : "7-Day Forecast"}
          </p>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {forecast.slice(0, 7).map((day, i) => {
              const rain = day.precipitation || 0;
              const rainIntensity =
                rain > 20 ? "bg-blue-500" :
                rain > 5  ? "bg-blue-300" :
                            "bg-gray-100";
              return (
                <div
                  key={day.date}
                  className="flex-shrink-0 flex flex-col items-center
                    bg-gray-50 rounded-lg px-2 py-1.5 min-w-[44px]
                    border border-gray-100"
                >
                  <span className="text-[9px] text-gray-400 font-semibold">
                    {i === 0
                      ? (language === "hi" ? "आज" : "Today")
                      : new Date(day.date).toLocaleDateString(
                          language === "hi" ? "hi-IN" : "en-IN",
                          { weekday: "short" }
                        )}
                  </span>
                  <span className="text-base my-0.5">
                    {day.precipitation > 20 ? "🌧️" :
                     day.precipitation > 5  ? "🌦️" :
                     day.temp_max > 38       ? "🌡️" : "☀️"}
                  </span>
                  <span className="text-[10px] font-bold text-gray-700">
                    {Math.round(day.temp_max)}°
                  </span>
                  <span className="text-[9px] text-gray-400">
                    {Math.round(day.temp_min)}°
                  </span>
                  {rain > 0 && (
                    <span className="text-[9px] text-blue-500 font-semibold">
                      {Math.round(rain)}mm
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts */}
      {meta.alerts && meta.alerts.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {meta.alerts.map((alert, i) => (
            <div
              key={i}
              className={`text-xs rounded-lg px-3 py-2 border
                ${ALERT_STYLE[alert.level] || ALERT_STYLE.info}`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Week advice */}
      <div className="bg-sky-50 rounded-lg p-2 border border-sky-100 mb-2">
        <p className="text-[10px] font-semibold text-sky-600 uppercase mb-1">
          📅 {language === "hi" ? "साप्ताहिक सारांश" : "Week Summary"}
        </p>
        <p className="text-xs text-gray-600 leading-relaxed">{meta.week_advice}</p>
      </div>

      {/* Irrigation impact */}
      <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
        <p className="text-[10px] font-semibold text-blue-600 uppercase mb-1">
          💧 {language === "hi" ? "सिंचाई पर प्रभाव" : "Irrigation Impact"}
        </p>
        <p className="text-xs text-gray-600">{meta.irrigation_impact}</p>
      </div>
    </div>
  );
};

// Main MessageBubble
const MessageBubble = ({ message }) => {
  const isUser = message.role === "user";

  const bubbleVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
  };

  return (
    <motion.div
      variants={bubbleVariants}
      initial="hidden"
      animate="visible"
      className={`flex w-full mb-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* AI Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-2 mt-1 flex-shrink-0 text-lg">
          🌱
        </div>
      )}

      <div className={`max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        {/* Image preview */}
        {message.type === "image" && message.meta?.previewUrl && (
          <img
            src={message.meta.previewUrl}
            alt="uploaded plant"
            className="max-w-[200px] rounded-xl mb-1 border border-gray-200 shadow-sm"
          />
        )}

        {/* Text bubble */}
        {message.content && (
          <div
            className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm
              ${isUser
                ? "bg-emerald-600 text-white rounded-br-sm"
                : "bg-white text-gray-800 border border-gray-100 rounded-bl-sm"
              }`}
          >
            {message.content}
          </div>
        )}

        {/* Crop result card */}
        {message.type === "crop-result" && message.meta && (
          <CropResultCard meta={message.meta} language={message.meta.language} />
        )}

        {/* Easy Mode crop result card */}
        {message.type === "easy-crop-result" && message.meta && (
          <EasyCropResultCard meta={message.meta} language={message.meta.language} />
        )}

        {/* Crop guidance card (from "I want to grow X" chat intent) */}
        {message.type === "crop-guidance-result" && message.meta && (
          <CropGuidanceCard meta={message.meta} language={message.meta.language} />
        )}

        {/* Disease result card */}
        {message.type === "disease-result" && message.meta && (
          <DiseaseResultCard meta={message.meta} language={message.meta.language} />
        )}

        {/* Irrigation result card */}
{message.type === "irrigation-result" && message.meta && (
  <IrrigationResultCard meta={message.meta} language={message.meta.language} />
)}

{/* Fertilizer result card */}
{message.type === "fertilizer-result" && message.meta && (
  <FertilizerResultCard meta={message.meta} language={message.meta.language} />
)}
{message.type === "weather-result" && message.meta && (
  <WeatherResultCard meta={message.meta} language={message.meta.language} />
)}
        {/* Timestamp */}
        <span className="text-[10px] text-gray-400 mt-1 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center ml-2 mt-1 flex-shrink-0 text-white text-sm font-bold">
          U
        </div>
      )}
    </motion.div>
  );
};

// Typing indicator shown while AI is thinking
export const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-2 mb-3"
  >
    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-lg flex-shrink-0">
      🌱
    </div>
    <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
      <div className="flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-emerald-400"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

export default MessageBubble;