# ai-service/routers/disease.py

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from typing import Optional
import io, os, json
import numpy as np
from PIL import Image
from services.nvidia_service import (
    llama_disease_diagnosis,
    analyse_disease_image,
    is_available as llama_available,
)
router = APIRouter(prefix="/disease", tags=["Disease Detection"])

# ── Paths ──────────────────────────────────────────────────────────────────
_BASE        = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_MODEL_PATH  = os.path.join(_BASE, "models", "plant_disease_model.h5")
_NAMES_PATH  = os.path.join(_BASE, "models", "disease_class_names.json")

IMG_SIZE = 224

# ── Load Model at Startup ──────────────────────────────────────────────────
_model       = None
_class_names = []

def _load():
    global _model, _class_names
    if os.path.exists(_MODEL_PATH) and os.path.exists(_NAMES_PATH):
        import tensorflow as tf
        _model = tf.keras.models.load_model(_MODEL_PATH)
        with open(_NAMES_PATH) as f:
            _class_names = json.load(f)
        print(f"✅ Disease model loaded — {len(_class_names)} classes.")
    else:
        print("⚠️  plant_disease_model.h5 not found. "
              "Run: python train/train_disease_model.py")

_load()

# ── Disease Treatment Database ─────────────────────────────────────────────
# Covers all 38 PlantVillage classes
# Format: class_name → { en: {...}, hi: {...} }

_TREATMENTS = {
    # ── Apple ──────────────────────────────────────────────────────────────
    "Apple___Apple_scab": {
        "en": {
            "severity": "Moderate",
            "treatment": "Apply captan or myclobutanil fungicide at 7–10 day intervals. Rake and destroy fallen leaves to break the disease cycle.",
            "prevention": "Plant scab-resistant varieties. Ensure good canopy air circulation by pruning.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "7–10 दिन के अंतराल पर कैप्टान या माइक्लोबुटानिल फफूंदनाशक लगाएं। गिरी पत्तियां जलाएं।",
            "prevention": "स्कैब-प्रतिरोधी किस्में लगाएं। छंटाई कर हवा का प्रवाह बढ़ाएं।",
        },
    },
    "Apple___Black_rot": {
        "en": {
            "severity": "High",
            "treatment": "Prune and burn all mummified fruits and dead wood. Apply thiophanate-methyl or captan every 10 days during growing season.",
            "prevention": "Avoid wounding fruit. Remove and destroy infected tissue immediately.",
        },
        "hi": {
            "severity": "अधिक",
            "treatment": "सभी सूखे फल और मरी लकड़ी काटकर जलाएं। थायोफेनेट-मिथाइल 10 दिन पर छिड़काव करें।",
            "prevention": "फल को चोट न पहुंचाएं। संक्रमित हिस्से तुरंत हटाएं।",
        },
    },
    "Apple___Cedar_apple_rust": {
        "en": {
            "severity": "Moderate",
            "treatment": "Apply myclobutanil or triadimefon at pink bud stage and every 7–10 days through petal fall.",
            "prevention": "Remove nearby cedar/juniper trees. Plant rust-resistant apple varieties.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "गुलाबी कली अवस्था से माइक्लोबुटानिल 7–10 दिन पर छिड़काव करें।",
            "prevention": "पास के देवदार/जुनिपर पेड़ हटाएं। प्रतिरोधी किस्में लगाएं।",
        },
    },
    "Apple___healthy": {
        "en": {"severity": "None", "treatment": "Plant is healthy. Maintain regular irrigation and balanced fertilisation.", "prevention": "Continue current practices."},
        "hi": {"severity": "कोई नहीं", "treatment": "पौधा स्वस्थ है। नियमित सिंचाई और संतुलित खाद जारी रखें।", "prevention": "वर्तमान देखभाल जारी रखें।"},
    },
    # ── Corn / Maize ───────────────────────────────────────────────────────
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        "en": {
            "severity": "High",
            "treatment": "Apply azoxystrobin or pyraclostrobin fungicide. Rotate crops and till under debris.",
            "prevention": "Plant resistant hybrids. Ensure adequate plant spacing for air flow.",
        },
        "hi": {
            "severity": "अधिक",
            "treatment": "एजोक्सीस्ट्रोबिन फफूंदनाशक छिड़काव करें। फसल चक्र अपनाएं।",
            "prevention": "प्रतिरोधी संकर किस्में लगाएं। पर्याप्त दूरी रखें।",
        },
    },
    "Corn_(maize)___Common_rust_": {
        "en": {
            "severity": "Moderate",
            "treatment": "Apply triazole or strobilurin fungicide at early rust detection. Scout weekly.",
            "prevention": "Plant resistant varieties. Early planting avoids peak spore periods.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "ट्राईज़ोल फफूंदनाशक शुरुआती रोग पर लगाएं। साप्ताहिक जांच करें।",
            "prevention": "प्रतिरोधी किस्में लगाएं। जल्दी बुवाई करें।",
        },
    },
    "Corn_(maize)___Northern_Leaf_Blight": {
        "en": {
            "severity": "High",
            "treatment": "Propiconazole or azoxystrobin at VT/R1 growth stage. Remove crop residue.",
            "prevention": "Resistant hybrids, crop rotation, and residue management.",
        },
        "hi": {
            "severity": "अधिक",
            "treatment": "VT/R1 अवस्था पर प्रोपिकोनाज़ोल छिड़काव। फसल अवशेष हटाएं।",
            "prevention": "प्रतिरोधी संकर, फसल चक्र और अवशेष प्रबंधन।",
        },
    },
    "Corn_(maize)___healthy": {
        "en": {"severity": "None", "treatment": "Crop is healthy. Continue good agronomic practices.", "prevention": "Scout regularly for early pest/disease detection."},
        "hi": {"severity": "कोई नहीं", "treatment": "फसल स्वस्थ है। अच्छी कृषि पद्धतियां जारी रखें।", "prevention": "नियमित निगरानी करें।"},
    },
    # ── Grape ──────────────────────────────────────────────────────────────
    "Grape___Black_rot": {
        "en": {
            "severity": "High",
            "treatment": "Apply myclobutanil or mancozeb from bud swell through veraison at 10-day intervals.",
            "prevention": "Remove mummified berries and infected canes. Improve canopy ventilation.",
        },
        "hi": {
            "severity": "अधिक",
            "treatment": "कली से पकने तक माइक्लोबुटानिल 10 दिन पर छिड़काव।",
            "prevention": "सूखे बेर और संक्रमित टहनी हटाएं। हवा बढ़ाएं।",
        },
    },
    "Grape___Esca_(Black_Measles)": {
        "en": {
            "severity": "Severe",
            "treatment": "No curative treatment. Remove and destroy severely infected vines. Protect pruning wounds with fungicide paste.",
            "prevention": "Use clean pruning tools. Avoid large pruning cuts.",
        },
        "hi": {
            "severity": "गंभीर",
            "treatment": "कोई सीधा उपचार नहीं। गंभीर रोगी बेल हटाएं। छंटाई घावों पर फफूंदनाशक लेप लगाएं।",
            "prevention": "साफ कृषि उपकरण उपयोग करें। बड़ी कटाई से बचें।",
        },
    },
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
        "en": {
            "severity": "Moderate",
            "treatment": "Mancozeb or copper-based fungicide at 10–14 day intervals from bud break.",
            "prevention": "Prune for open canopy. Avoid overhead irrigation.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "कली फटने से मैनकोज़ेब 10–14 दिन पर छिड़काव।",
            "prevention": "खुली छतरी के लिए छंटाई। ऊपर से सिंचाई न करें।",
        },
    },
    "Grape___healthy": {
        "en": {"severity": "None", "treatment": "Vine is healthy. Continue current management.", "prevention": "Regular scouting and canopy management."},
        "hi": {"severity": "कोई नहीं", "treatment": "बेल स्वस्थ है।", "prevention": "नियमित निगरानी जारी रखें।"},
    },
    # ── Potato ─────────────────────────────────────────────────────────────
    "Potato___Early_blight": {
        "en": {
            "severity": "Moderate",
            "treatment": "Apply chlorothalonil or mancozeb at 7–10 day intervals starting at first symptom. Ensure adequate potassium nutrition.",
            "prevention": "Use certified seed. Rotate with non-solanaceous crops.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "पहले लक्षण पर क्लोरोथैलोनिल 7–10 दिन पर छिड़काव। पोटाश खाद पर्याप्त दें।",
            "prevention": "प्रमाणित बीज उपयोग करें। गैर-सोलेनेसी फसलों के साथ चक्र अपनाएं।",
        },
    },
    "Potato___Late_blight": {
        "en": {
            "severity": "Very High",
            "treatment": "Immediately apply metalaxyl + mancozeb (Ridomil Gold) or cymoxanil. Destroy severely infected foliage. Do NOT compost infected material.",
            "prevention": "Plant resistant varieties. Avoid overhead irrigation. Ensure good drainage.",
        },
        "hi": {
            "severity": "बहुत अधिक",
            "treatment": "तुरंत मेटालैक्सिल + मैनकोज़ेब (रिडोमिल गोल्ड) छिड़काव। गंभीर रोगी पत्तियां जलाएं।",
            "prevention": "प्रतिरोधी किस्में, ऊपर से सिंचाई न करें, अच्छी जल निकासी।",
        },
    },
    "Potato___healthy": {
        "en": {"severity": "None", "treatment": "Crop is healthy. Maintain regular hilling and irrigation.", "prevention": "Scout weekly for late blight in humid weather."},
        "hi": {"severity": "कोई नहीं", "treatment": "फसल स्वस्थ है। मिट्टी चढ़ाना और सिंचाई जारी रखें।", "prevention": "नम मौसम में साप्ताहिक जांच करें।"},
    },
    # ── Tomato ─────────────────────────────────────────────────────────────
    "Tomato___Bacterial_spot": {
        "en": {
            "severity": "High",
            "treatment": "Copper-based bactericide (copper hydroxide) + mancozeb every 5–7 days. Remove infected plant material.",
            "prevention": "Use disease-free seed. Avoid overhead irrigation. Rotate crops.",
        },
        "hi": {
            "severity": "अधिक",
            "treatment": "कॉपर हाइड्रॉक्साइड + मैनकोज़ेब 5–7 दिन पर छिड़काव। संक्रमित भाग हटाएं।",
            "prevention": "रोगमुक्त बीज, ऊपर से सिंचाई न करें, फसल चक्र।",
        },
    },
    "Tomato___Early_blight": {
        "en": {
            "severity": "Moderate",
            "treatment": "Chlorothalonil or azoxystrobin every 7 days from first symptom. Remove lower infected leaves.",
            "prevention": "Mulch soil to prevent spore splashing. Use drip irrigation.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "पहले लक्षण पर क्लोरोथैलोनिल 7 दिन पर छिड़काव। निचली संक्रमित पत्तियां हटाएं।",
            "prevention": "मल्च बिछाएं। ड्रिप सिंचाई उपयोग करें।",
        },
    },
    "Tomato___Late_blight": {
        "en": {
            "severity": "Very High",
            "treatment": "Apply metalaxyl + mancozeb immediately. Remove and destroy infected plants. Do not leave debris in field.",
            "prevention": "Avoid dense planting. Never irrigate from above in humid conditions.",
        },
        "hi": {
            "severity": "बहुत अधिक",
            "treatment": "तुरंत मेटालैक्सिल + मैनकोज़ेब छिड़काव। संक्रमित पौधे जलाएं।",
            "prevention": "घना रोपण न करें। नम मौसम में ऊपर से सिंचाई न करें।",
        },
    },
    "Tomato___Leaf_Mold": {
        "en": {
            "severity": "Moderate",
            "treatment": "Apply chlorothalonil or copper fungicide. Improve greenhouse ventilation. Reduce humidity below 85%.",
            "prevention": "Resistant varieties. Prune lower leaves. Avoid leaf wetness.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "क्लोरोथैलोनिल या कॉपर फफूंदनाशक। ग्रीनहाउस हवादार बनाएं। नमी 85% से कम रखें।",
            "prevention": "प्रतिरोधी किस्में। निचली पत्तियां छांटें।",
        },
    },
    "Tomato___Septoria_leaf_spot": {
        "en": {
            "severity": "Moderate",
            "treatment": "Chlorothalonil, mancozeb, or copper fungicide every 7–10 days. Remove infected lower leaves.",
            "prevention": "Mulch. Stake plants for air circulation. Rotate crops 2 years.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "क्लोरोथैलोनिल या मैनकोज़ेब 7–10 दिन पर। निचली पत्तियां हटाएं।",
            "prevention": "मल्च, पौधों को बांधें, 2 वर्ष फसल चक्र।",
        },
    },
    "Tomato___Spider_mites Two-spotted_spider_mite": {
        "en": {
            "severity": "Moderate",
            "treatment": "Apply abamectin or bifenazate miticide. Spray undersides of leaves. Repeat after 5–7 days.",
            "prevention": "Avoid dusty conditions and plant stress. Introduce predatory mites.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "अबामेक्टिन माइटिसाइड पत्तियों की निचली सतह पर छिड़काव। 5–7 दिन बाद दोहराएं।",
            "prevention": "धूल और पौधे का तनाव कम करें। शिकारी कीट छोड़ें।",
        },
    },
    "Tomato___Target_Spot": {
        "en": {
            "severity": "Moderate",
            "treatment": "Chlorothalonil or azoxystrobin every 7 days. Improve plant spacing.",
            "prevention": "Remove crop debris. Use resistant varieties.",
        },
        "hi": {
            "severity": "मध्यम",
            "treatment": "क्लोरोथैलोनिल 7 दिन पर। पौधों के बीच दूरी बढ़ाएं।",
            "prevention": "फसल अवशेष हटाएं। प्रतिरोधी किस्में।",
        },
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        "en": {
            "severity": "Very High",
            "treatment": "No cure. Remove and destroy infected plants immediately to prevent spread. Control whitefly vectors with imidacloprid.",
            "prevention": "Use virus-resistant varieties. Control whiteflies from seedling stage.",
        },
        "hi": {
            "severity": "बहुत अधिक",
            "treatment": "कोई उपचार नहीं। संक्रमित पौधे तुरंत जलाएं। सफेद मक्खी के लिए इमिडाक्लोप्रिड छिड़काव।",
            "prevention": "वायरस-प्रतिरोधी किस्में। पौधशाला से सफेद मक्खी नियंत्रण।",
        },
    },
    "Tomato___Tomato_mosaic_virus": {
        "en": {
            "severity": "High",
            "treatment": "No chemical cure. Remove infected plants. Disinfect tools with 10% bleach solution.",
            "prevention": "Use TMV-resistant varieties and virus-free seed. Wash hands before handling plants.",
        },
        "hi": {
            "severity": "अधिक",
            "treatment": "कोई रासायनिक उपचार नहीं। संक्रमित पौधे हटाएं। उपकरणों को ब्लीच से साफ करें।",
            "prevention": "TMV-प्रतिरोधी किस्में और रोगमुक्त बीज। पौधों को छूने से पहले हाथ धोएं।",
        },
    },
    "Tomato___healthy": {
        "en": {"severity": "None", "treatment": "Plant is healthy. Maintain consistent irrigation and fertilisation.", "prevention": "Scout weekly for early signs of disease or pests."},
        "hi": {"severity": "कोई नहीं", "treatment": "पौधा स्वस्थ है।", "prevention": "साप्ताहिक रोग-कीट जांच।"},
    },
}

# Default treatment for classes not in the database
_DEFAULT_EN = {
    "severity": "Unknown",
    "treatment": "Consult your local agricultural extension officer for specific treatment advice.",
    "prevention": "Maintain good agronomic practices: proper spacing, balanced nutrition, and regular scouting.",
}
_DEFAULT_HI = {
    "severity": "अज्ञात",
    "treatment": "स्थानीय कृषि विस्तार अधिकारी से विशिष्ट उपचार सलाह लें।",
    "prevention": "उचित दूरी, संतुलित पोषण और नियमित निगरानी।",
}

# ── Pydantic Models ────────────────────────────────────────────────────────
class TopDisease(BaseModel):
    disease:    str
    confidence: float


class DiseaseOutput(BaseModel):
    disease:          str
    confidence:       float
    severity:         str
    treatment:        str
    prevention:       str
    language:         str
    top3:             list[TopDisease]
    is_healthy:       bool
    organic_remedy:   Optional[str] = None
    symptoms:         Optional[str] = None
    powered_by:       str = "ml_model"   # "llama" | "ml_model"


# ── Image Preprocessing ────────────────────────────────────────────────────
def _preprocess(image_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32) / 255.0
    return arr[np.newaxis, ...]   # shape: (1, 224, 224, 3)


def _format_class_name(raw: str) -> str:
    """Turn 'Tomato___Early_blight' → 'Tomato — Early Blight'"""
    if "___" in raw:
        plant, disease = raw.split("___", 1)
        plant   = plant.replace("_", " ")
        disease = disease.replace("_", " ").title()
        return f"{plant} — {disease}"
    return raw.replace("_", " ").title()


def _run_ml_model(image_bytes: bytes, lang: str) -> dict:
    """
    Runs the local CNN (.h5) model and returns a normalised result
    dict in the SAME shape as the Llama path, so the endpoint can
    treat both sources identically. Used only as a FALLBACK when
    Llama is unavailable or fails.
    """
    if _model and _class_names:
        try:
            arr   = _preprocess(image_bytes)
            preds = _model.predict(arr, verbose=0)[0]

            top_idx = preds.argsort()[::-1][:3]
            top3 = [
                {
                    "disease":    _format_class_name(_class_names[i]),
                    "confidence": round(float(preds[i]), 4),
                }
                for i in top_idx
            ]
            best_key  = _class_names[top_idx[0]]
            best_conf = round(float(preds[top_idx[0]]), 4)
        except Exception as e:
            print(f"[ML disease model error] {e}")
            best_key, best_conf, top3 = _mock_result()
    else:
        best_key, best_conf, top3 = _mock_result()

    display_name = _format_class_name(best_key)
    is_healthy   = "healthy" in best_key.lower()

    info      = _TREATMENTS.get(best_key, {})
    lang_info = info.get(lang, info.get("en", _DEFAULT_EN if lang == "en" else _DEFAULT_HI))

    return {
        "disease":        display_name,
        "confidence":     best_conf,
        "severity":       lang_info.get("severity", "Unknown"),
        "treatment":      lang_info.get("treatment", ""),
        "prevention":     lang_info.get("prevention", ""),
        "organic_remedy": None,
        "symptoms":       None,
        "language":       lang,
        "top3":           top3,
        "is_healthy":     is_healthy,
        "powered_by":     "ml_model",
    }


def _mock_result():
    """Used only if NEITHER Llama NOR the .h5 model are available."""
    best_key  = "Tomato___Early_blight"
    best_conf = 0.91
    top3 = [
        {"disease": "Tomato — Early Blight", "confidence": 0.91},
        {"disease": "Tomato — Late Blight",  "confidence": 0.06},
        {"disease": "Tomato — Target Spot",  "confidence": 0.03},
    ]
    return best_key, best_conf, top3


# ── Endpoint ───────────────────────────────────────────────────────────────
@router.post("/predict", response_model=DiseaseOutput)
async def predict_disease(
    file:     UploadFile = File(...),
    language: Optional[str] = Form("en"),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted.")

    image_bytes = await file.read()
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB.")

    lang = language or "en"

    # ── 1. PRIMARY PATH — Llama Vision diagnoses the image directly ───────
    result = None
    if llama_available():
        llama_result = await llama_disease_diagnosis(
            image_bytes = image_bytes,
            mime_type   = file.content_type,
            language    = lang,
        )
        if llama_result and llama_result.get("disease_name"):
            crop_name    = llama_result.get("crop_name", "").strip()
            disease_name = llama_result.get("disease_name", "").strip()
            full_name    = f"{crop_name} — {disease_name}" if crop_name else disease_name

            conf_label = (llama_result.get("confidence_label") or "Medium").lower()
            conf_map   = {"high": 0.92, "medium": 0.75, "low": 0.55}
            confidence = conf_map.get(conf_label, 0.75)

            result = {
                "disease":        full_name,
                "confidence":     confidence,
                "severity":       llama_result.get("severity", "Unknown"),
                "treatment":      llama_result.get("treatment", ""),
                "prevention":     llama_result.get("prevention", ""),
                "organic_remedy": llama_result.get("organic_remedy"),
                "symptoms":       llama_result.get("symptoms_observed"),
                "language":       lang,
                "top3": [
                    {"disease": full_name, "confidence": confidence}
                ],
                "is_healthy": bool(llama_result.get("is_healthy", False)),
                "powered_by": "llama",
            }

    # ── 2. FALLBACK PATH — local CNN (.h5) model ────────────────────────────
    if result is None:
        result = _run_ml_model(image_bytes, lang)

    return DiseaseOutput(**result)