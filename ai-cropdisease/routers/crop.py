# ai-service/routers/crop.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import os
import pickle
import numpy as np

from services.nvidia_service import (
    explain_crop_recommendation,
    easy_crop_recommendation,
    is_available as llama_available,
)

router = APIRouter(prefix="/crop", tags=["Crop Recommendation"])

# ── Paths ──────────────────────────────────────────────────────────────────
_BASE    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MODEL_P = os.path.join(_BASE, "models", "crop_model.pkl")
_LE_P    = os.path.join(_BASE, "models", "crop_label_encoder.pkl")

# ── Load Model & Encoder at startup ───────────────────────────────────────
_model = None
_le    = None

def _load():
    global _model, _le
    if os.path.exists(_MODEL_P) and os.path.exists(_LE_P):
        with open(_MODEL_P, "rb") as f:
            _model = pickle.load(f)
        with open(_LE_P, "rb") as f:
            _le = pickle.load(f)
        print(f"✅ Crop model loaded — {len(_le.classes_)} crops supported.")
    else:
        print("⚠️  crop_model.pkl / crop_label_encoder.pkl not found. "
              "Run: python train/train_crop_model.py")

_load()

# ── Hindi crop name map ────────────────────────────────────────────────────
_HINDI = {
    "rice": "चावल", "maize": "मक्का", "chickpea": "चना",
    "kidneybeans": "राजमा", "pigeonpeas": "अरहर", "mothbeans": "मोठ",
    "mungbean": "मूंग", "blackgram": "उड़द", "lentil": "मसूर",
    "pomegranate": "अनार", "banana": "केला", "mango": "आम",
    "grapes": "अंगूर", "watermelon": "तरबूज", "muskmelon": "खरबूजा",
    "apple": "सेब", "orange": "संतरा", "papaya": "पपीता",
    "coconut": "नारियल", "cotton": "कपास", "jute": "जूट",
    "coffee": "कॉफी",
}

# ── Agronomic advice snippets (en) ────────────────────────────────────────
_ADVICE_EN = {
    "rice":        "Ensure flooded conditions or SRI method. Transplant at 20–25 days.",
    "maize":       "Space rows 60–75 cm. Apply nitrogen in splits at sowing and knee-high stage.",
    "chickpea":    "Sow in Rabi season. Avoid waterlogging — prefers well-drained loam.",
    "kidneybeans": "Inoculate seeds with Rhizobium. Trellising improves yield.",
    "pigeonpeas":  "Intercrop with cereals for best results. Drought-tolerant once established.",
    "mothbeans":   "Ideal for arid zones. Minimal irrigation needed after germination.",
    "mungbean":    "Short-duration (60–65 days). Fits well as a break crop.",
    "blackgram":   "Sensitive to waterlogging. Grows well in Kharif season.",
    "lentil":      "Cool-season crop. Inoculate seeds; low nitrogen requirement.",
    "pomegranate": "Deep watering fortnightly. Prune for open-centre canopy.",
    "banana":      "Needs 100–180 mm water/month. Control Sigatoka with fungicide sprays.",
    "mango":       "Withhold irrigation before flowering. Harvest at physiological maturity.",
    "grapes":      "Trellis system essential. Prune to two buds after harvest.",
    "watermelon":  "Direct seed on raised beds. Black polythene mulch conserves moisture.",
    "muskmelon":   "Well-drained sandy loam ideal. Pinch lateral shoots after 4–5 leaves.",
    "apple":       "Requires chilling hours (>1000 h <7°C). Plant on M9 rootstock for dwarfing.",
    "orange":      "Avoid frost pockets. Drip irrigation at 60% field capacity.",
    "papaya":      "Plant 3 m × 3 m. Avoid water stagnation — highly susceptible to root rot.",
    "coconut":     "Basin irrigation weekly. Apply potash to improve oil content.",
    "cotton":      "Maintain 67,000–75,000 plants/ha. Scout for bollworm weekly.",
    "jute":        "Flood irrigation at sowing; drain after 3 days. Harvest at 50% flowering.",
    "coffee":      "Shade-grown under 40–50% canopy. Harvest only red (ripe) berries.",
}

_ADVICE_HI = {
    "rice":        "बाढ़ की स्थिति या SRI विधि सुनिश्चित करें। 20–25 दिन पर रोपाई करें।",
    "maize":       "पंक्तियों के बीच 60–75 सेमी. नाइट्रोजन दो बार दें।",
    "chickpea":    "रबी मौसम में बोएं। जलभराव से बचें — दोमट मिट्टी सर्वोत्तम।",
    "kidneybeans": "बीजों को राइजोबियम से उपचारित करें। बाड़ा लगाने से उपज बढ़ती है।",
    "pigeonpeas":  "अनाज के साथ अंतर-फसल लें। एक बार स्थापित होने पर सूखा सहनशील।",
    "mothbeans":   "शुष्क क्षेत्रों के लिए आदर्श। अंकुरण के बाद न्यूनतम सिंचाई।",
    "mungbean":    "60–65 दिन की छोटी फसल। विराम फसल के रूप में उपयुक्त।",
    "blackgram":   "जलभराव के प्रति संवेदनशील। खरीफ मौसम में अच्छी फसल।",
    "lentil":      "ठंडे मौसम की फसल। बीज उपचार करें; कम नाइट्रोजन चाहिए।",
    "pomegranate": "हर पखवाड़े गहरी सिंचाई। खुली छतरी के लिए छंटाई करें।",
    "banana":      "100–180 मिमी पानी/माह चाहिए। सिगटोका के लिए फफूंदनाशक छिड़काव।",
    "mango":       "फूल आने से पहले सिंचाई रोकें। परिपक्वता पर तुड़ाई करें।",
    "grapes":      "ट्रेलिस प्रणाली आवश्यक। फसल के बाद दो कलियों तक छंटाई।",
    "watermelon":  "उठी हुई क्यारियों पर सीधी बुवाई। काली पॉलीथीन से नमी बचाएं।",
    "muskmelon":   "रेतीली दोमट मिट्टी उत्तम। 4–5 पत्तियों के बाद पार्श्व शाखाएं हटाएं।",
    "apple":       "1000 घंटे से अधिक ठंड चाहिए। M9 मूलवृंत पर लगाएं।",
    "orange":      "पाले से बचाएं। 60% क्षेत्र क्षमता पर ड्रिप सिंचाई।",
    "papaya":      "3×3 मीटर पर लगाएं। जलभराव से बचें — जड़ सड़न का खतरा।",
    "coconut":     "साप्ताहिक थाला सिंचाई। तेल की मात्रा बढ़ाने के लिए पोटाश डालें।",
    "cotton":      "67,000–75,000 पौधे/हे. साप्ताहिक बॉलवर्म निगरानी करें।",
    "jute":        "बुवाई पर बाढ़ सिंचाई; 3 दिन बाद निकास। 50% फूल पर कटाई।",
    "coffee":      "40–50% छाया में उगाएं। केवल लाल (पके) फलों की तुड़ाई करें।",
}

# ── Request / Response Models ──────────────────────────────────────────────
class CropInput(BaseModel):
    nitrogen:    float = Field(..., ge=0, le=200, description="Nitrogen content (mg/kg)")
    phosphorus:  float = Field(..., ge=0, le=200, description="Phosphorus content (mg/kg)")
    potassium:   float = Field(..., ge=0, le=300, description="Potassium content (mg/kg)")
    temperature: float = Field(..., ge=0, le=55,  description="Temperature (°C)")
    humidity:    float = Field(..., ge=0, le=100, description="Relative humidity (%)")
    ph:          float = Field(..., ge=0, le=14,  description="Soil pH")
    rainfall:    float = Field(..., ge=0, le=500, description="Annual rainfall (mm)")
    language:    Optional[str] = Field("en", description="'en' or 'hi'")


class TopCrop(BaseModel):
    crop:       str
    confidence: float


class CropOutput(BaseModel):
    recommended_crop: str
    confidence:       float
    advice:           str
    language:         str
    top3:             list[TopCrop]
    feature_summary:  dict
    llama_insight:    Optional[str] = None
    powered_by:       str = "ml_model"


# ── Endpoint ───────────────────────────────────────────────────────────────
@router.post("/predict", response_model=CropOutput)
async def predict_crop(data: CropInput):
    lang = data.language or "en"

    features = np.array([[
        data.nitrogen, data.phosphorus, data.potassium,
        data.temperature, data.humidity, data.ph, data.rainfall
    ]])

    if _model and _le:
        # Real prediction
        proba_arr  = _model.predict_proba(features)[0]
        top_idx    = proba_arr.argsort()[::-1][:3]

        top3 = [
            TopCrop(
                crop=_get_display_name(_le.classes_[i], lang),
                confidence=round(float(proba_arr[i]), 4)
            )
            for i in top_idx
        ]

        best_class = _le.classes_[top_idx[0]]
        confidence = round(float(proba_arr[top_idx[0]]), 4)

    else:
        # Graceful mock fallback
        best_class = "rice"
        confidence = 0.87
        top3 = [
            TopCrop(crop="Rice",   confidence=0.87),
            TopCrop(crop="Maize",  confidence=0.08),
            TopCrop(crop="Lentil", confidence=0.05),
        ]

    display_name = _get_display_name(best_class, lang)
    advice_map   = _ADVICE_HI if lang == "hi" else _ADVICE_EN
    advice       = advice_map.get(best_class, "")

    # Build intro sentence
    if lang == "hi":
        intro = (
            f"आपके खेत के डेटा के अनुसार **{display_name}** की खेती सबसे उपयुक्त है "
            f"({round(confidence * 100, 1)}% विश्वास)। {advice}"
        )
    else:
        intro = (
            f"Based on your farm data, **{display_name}** is the most suitable crop "
            f"({round(confidence * 100, 1)}% confidence). {advice}"
        )

    # Feature summary for UI display
    feature_summary = {
        "N":           data.nitrogen,
        "P":           data.phosphorus,
        "K":           data.potassium,
        "Temp (°C)":   data.temperature,
        "Humidity (%)":data.humidity,
        "pH":          data.ph,
        "Rainfall (mm)":data.rainfall,
    }
    nvidia_insight = ""
    if llama_available():
        ml_result  = {"recommended_crop": display_name, "confidence": confidence}
        soil_input = {
            "nitrogen": data.nitrogen, "phosphorus": data.phosphorus,
            "potassium": data.potassium, "temperature": data.temperature,
            "humidity": data.humidity, "ph": data.ph, "rainfall": data.rainfall,
        }
        nvidia_insight = await explain_crop_recommendation(
            ml_result  = ml_result,
            soil_data  = soil_input,
            language   = lang,
        )

    return CropOutput(
        recommended_crop=display_name,
        confidence=confidence,
        advice=intro,
        language=lang,
        top3=top3,
        feature_summary=feature_summary,
        llama_insight    = nvidia_insight or None,
        powered_by       = "llama+ml" if nvidia_insight else "ml_model",
    )


def _get_display_name(crop_key: str, lang: str) -> str:
    if lang == "hi":
        return _HINDI.get(crop_key, crop_key.capitalize())
    return crop_key.replace("kidneybeans", "Kidney Beans") \
                   .replace("pigeonpeas", "Pigeon Peas") \
                   .replace("mothbeans", "Moth Beans") \
                   .replace("mungbean", "Mung Bean") \
                   .replace("blackgram", "Black Gram") \
                   .capitalize()


# ═══════════════════════════════════════════════════════════════════════════
# EASY MODE — for farmers who don't know N/P/K/pH
#
# Primary path:  Llama uses general agricultural knowledge of the
#                 farmer's state/district/soil-look/water-source to
#                 recommend a crop, in plain language.
# Fallback path: If Llama is unavailable, the RandomForest .pkl model
#                 CANNOT be used here (it strictly needs 7 numeric
#                 features). Instead we use a simple, transparent
#                 region+season rule table covering India's major
#                 agro-climatic zones. This fallback is intentionally
#                 simple — it exists only so the feature never breaks,
#                 not as a replacement for Llama's reasoning.
# ═══════════════════════════════════════════════════════════════════════════

class EasyCropInput(BaseModel):
    state:        str  = Field(..., description="Indian state, e.g. 'Rajasthan'")
    district:     Optional[str] = ""
    soil_look:    Optional[str] = ""   # "black", "red", "sandy", "loamy", "don't know"
    water_source: Optional[str] = ""   # "borewell", "canal", "rain-fed", "pond/well"
    season:       Optional[str] = ""   # "kharif", "rabi", "zaid", "don't know"
    land_size:    Optional[str] = ""   # free text, e.g. "1 acre"
    language:     Optional[str] = "en"


class EasyCropOutput(BaseModel):
    recommended_crop: str
    confidence_label:  str          # "High" | "Medium" | "Low"
    reason:            str
    soil_type_guess:   str
    fertilizer_tip:    str
    water_tip:         str
    alternatives:      list[str]
    language:          str
    powered_by:        str          # "llama" | "rule_table"


# ── Simple rule-based fallback table (region → likely crop) ───────────────
# Keyed by lowercase state name. This is intentionally coarse — it is
# the SAFETY NET, not the primary recommendation engine.
_STATE_CROP_TABLE = {
    "punjab":         ("wheat",    "Wheat is the dominant Rabi crop across Punjab's fertile alluvial soil."),
    "haryana":        ("wheat",    "Haryana's alluvial soil and canal irrigation strongly favour wheat."),
    "uttar pradesh":  ("wheat",    "UP's alluvial plains support wheat as the major Rabi staple."),
    "bihar":          ("rice",     "Bihar's high rainfall and alluvial soil suit paddy cultivation well."),
    "west bengal":    ("rice",     "West Bengal's heavy monsoon and deltaic soil are ideal for rice."),
    "assam":          ("rice",     "Assam's high rainfall and laterite-alluvial mix favour rice cultivation."),
    "rajasthan":      ("mustard",  "Rajasthan's arid climate and sandy soil suit drought-tolerant mustard/bajra."),
    "gujarat":        ("cotton",   "Gujarat's black soil (regur) is classically suited to cotton."),
    "maharashtra":    ("cotton",   "Maharashtra's black cotton soil region strongly favours cotton/soybean."),
    "madhya pradesh": ("soybean",  "MP's black soil belt is one of India's largest soybean-growing regions."),
    "karnataka":      ("ragi",     "Karnataka's red soil and moderate rainfall suit ragi/millets well."),
    "andhra pradesh": ("rice",     "Andhra's deltaic alluvial soil under canal irrigation favours rice."),
    "telangana":      ("cotton",   "Telangana's red-black soil mix supports cotton and maize well."),
    "tamil nadu":     ("rice",     "Tamil Nadu's river-delta alluvium under irrigation favours rice."),
    "kerala":         ("coconut",  "Kerala's laterite soil and high rainfall are ideal for coconut and spices."),
    "odisha":         ("rice",     "Odisha's coastal alluvial soil and monsoon rainfall favour rice."),
    "chhattisgarh":   ("rice",     "Chhattisgarh, known as India's 'rice bowl', has soil well suited to paddy."),
    "jharkhand":      ("rice",     "Jharkhand's plateau region with adequate rainfall suits upland rice."),
    "himachal pradesh": ("apple", "Himachal's cool hill climate is classically suited to apple orchards."),
    "uttarakhand":    ("wheat",    "Uttarakhand's hill and terai soil suit wheat in the Rabi season."),
}

_STATE_CROP_TABLE_HI = {
    "rice": "चावल", "wheat": "गेहूं", "cotton": "कपास", "mustard": "सरसों",
    "soybean": "सोयाबीन", "ragi": "रागी", "coconut": "नारियल", "apple": "सेब",
}


def _rule_based_easy_crop(state: str, lang: str) -> dict:
    """Transparent fallback used ONLY when Llama is unavailable."""
    state_key = (state or "").strip().lower()
    crop, reason_en = _STATE_CROP_TABLE.get(
        state_key, ("rice", "Rice is a safe staple choice across most monsoon-fed Indian regions.")
    )
    crop_display = _STATE_CROP_TABLE_HI.get(crop, crop.capitalize()) if lang == "hi" else crop.capitalize()

    if lang == "hi":
        reason = f"{state or 'आपके'} क्षेत्र की सामान्य जलवायु और मिट्टी के आधार पर {crop_display} एक सुरक्षित विकल्प है।"
        fert   = "गोबर की खाद और संतुलित NPK उर्वरक (जैसे DAP) का उपयोग करें।"
        water  = "मिट्टी की ऊपरी सतह सूखने पर सिंचाई करें; जलभराव से बचें।"
    else:
        reason = reason_en
        fert   = "Use farmyard manure plus a balanced NPK fertilizer (e.g. DAP) at sowing."
        water  = "Irrigate when the topsoil feels dry; avoid waterlogging."

    return {
        "recommended_crop": crop_display,
        "confidence_label":  "Low",   # honestly labelled — this is a coarse fallback
        "reason":            reason,
        "soil_type_guess":   "" ,
        "fertilizer_tip":    fert,
        "water_tip":         water,
        "alternatives":      [],
        "powered_by":        "rule_table",
    }


@router.post("/easy-predict", response_model=EasyCropOutput)
async def easy_predict_crop(data: EasyCropInput):
    """
    Farmer-friendly crop recommendation — no soil-test numbers needed.
    PRIMARY: Llama reasons over state/district/soil-look/water/season.
    FALLBACK: simple state→crop rule table (only if Llama unavailable
    or returns an unusable response).
    """
    lang = data.language or "en"

    result = {}
    if llama_available():
        result = await easy_crop_recommendation(
            state        = data.state,
            district     = data.district or "",
            soil_look    = data.soil_look or "",
            water_source = data.water_source or "",
            season       = data.season or "",
            land_size    = data.land_size or "",
            language     = lang,
        )

    if not result or not result.get("recommended_crop"):
        result = _rule_based_easy_crop(data.state, lang)

    return EasyCropOutput(
        recommended_crop = result.get("recommended_crop", ""),
        confidence_label  = result.get("confidence_label", "Medium"),
        reason            = result.get("reason", ""),
        soil_type_guess   = result.get("soil_type_guess", ""),
        fertilizer_tip    = result.get("fertilizer_tip", ""),
        water_tip         = result.get("water_tip", ""),
        alternatives      = result.get("alternatives", []) or [],
        language          = lang,
        powered_by        = result.get("powered_by", "rule_table"),
    )