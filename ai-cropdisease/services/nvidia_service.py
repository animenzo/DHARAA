# ai-service/services/nvidia_service.py
#
# NVIDIA NIM — Llama 4 Maverick integration
# Multimodal: handles text + images
# OpenAI-compatible API
# Free endpoint — no credits consumed

import os
import base64
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")

_client    = None
_available = False

# ── Text model (chat, crop, weather) ──────────────────────────

TEXT_MODEL   = "meta/llama-4-maverick-17b-128e-instruct"
VISION_MODEL = "meta/llama-4-maverick-17b-128e-instruct"
# ── Vision model (disease image analysis) ─────────────────────



def _init():
    global _client, _available
    if not NVIDIA_API_KEY:
        print("⚠️  NVIDIA_API_KEY not set — AI features disabled.")
        return
    try:
        _client = OpenAI(
            base_url = "https://integrate.api.nvidia.com/v1",
            api_key  = NVIDIA_API_KEY,
        )
        # Quick test
        _available = True
        print("✅ NVIDIA NIM (Llama 4 Maverick) ready.")
    except Exception as e:
        print(f"⚠️  NVIDIA NIM init failed: {e}")

_init()


def is_available() -> bool:
    return _available


# ── "I want to grow X" intent detector (keyword-based, fast) ───
# Runs in Express/FastAPI BEFORE calling the LLM — cheap and
# instant, so we don't waste an API call deciding intent.
_GROW_VERBS_EN = ["grow", "plant", "cultivate", "sow", "planting", "growing"]
_GROW_VERBS_HI = ["उगाना", "उगाऊं", "लगाना", "लगाऊं", "बोना", "बोऊं", "उगा सकते", "लगा सकते"]

# Common Indian crops/plants — including local names — so we can
# pull out *what* they want to grow from a casual sentence.
_KNOWN_CROPS = [
    "tomato", "टमाटर", "potato", "आलू", "onion", "प्याज़", "प्याज",
    "wheat", "गेहूं", "rice", "चावल", "धान", "maize", "मक्का",
    "cotton", "कपास", "sugarcane", "गन्ना", "mint", "पुदीना", "podhina",
    "chilli", "मिर्च", "chili", "brinjal", "बैंगन", "eggplant",
    "cabbage", "पत्ता गोभी", "cauliflower", "फूल गोभी", "garlic", "लहसुन",
    "ginger", "अदरक", "spinach", "पालक", "okra", "भिंडी", "bhindi",
    "cucumber", "खीरा", "carrot", "गाजर", "peas", "मटर", "mango", "आम",
    "banana", "केला", "papaya", "पपीता", "grapes", "अंगूर",
    "groundnut", "मूंगफली", "soybean", "सोयाबीन", "mustard", "सरसों",
    "gram", "चना", "lentil", "मसूर", "turmeric", "हल्दी",
]


def detect_grow_intent(message: str) -> Optional[str]:
    """
    Lightweight keyword check — does this message express intent
    to grow/plant a specific crop? Returns the matched crop name
    (as typed by the user) or None. This is intentionally simple
    and fast; the actual advice generation is delegated to Llama
    via crop_intent_guidance().
    """
    msg = message.lower()
    has_verb = any(v in msg for v in _GROW_VERBS_EN) or \
               any(v in message for v in _GROW_VERBS_HI)
    if not has_verb:
        return None

    for crop in _KNOWN_CROPS:
        if crop.lower() in msg or crop in message:
            return crop

    # Verb present but no known crop matched — still worth asking
    # Llama, just without a pre-identified crop name.
    return "the crop they mentioned"


# ── System prompts ─────────────────────────────────────────────
def _system(lang: str) -> str:
    if lang == "hi":
        return (
            "आप DHARAA AI के भारतीय कृषि सहायक हैं। "
            "आप एक अनुभवी कृषि वैज्ञानिक की तरह बात करते हैं। "
            "हमेशा सरल हिंदी में, किसान को समझ आने वाली भाषा में उत्तर दें। "
            "उत्तर 3-5 वाक्यों में संक्षिप्त रखें।"
        )
    return (
        "You are DHARAA AI, an expert agricultural advisor for Indian farmers. "
        "Speak like a practical agronomist — clear, specific, farmer-friendly. "
        "Keep responses concise (3-5 sentences). Always respond in English."
    )


# ── 1. Smart Chat ──────────────────────────────────────────────
async def smart_chat(
    message:  str,
    language: str  = "en",
    history:  list = [],
    context:  dict = {},
) -> str:
    if not _available:
        return None

    # Build farm context string
    ctx = ""
    if context:
        parts = []
        if context.get("farm_name"):
            parts.append(f"Farm: {context['farm_name']}")
        if context.get("current_crop"):
            parts.append(f"Crop: {context['current_crop']}")
        if context.get("soil_type"):
            parts.append(f"Soil: {context['soil_type']}")
        if parts:
            ctx = f"[Context: {', '.join(parts)}]\n\n"

    # Build message history
    messages = [{"role": "system", "content": _system(language)}]

    for msg in history[-6:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("content", "")})

    messages.append({"role": "user", "content": f"{ctx}{message}"})

    try:
        resp = _client.chat.completions.create(
            model      = TEXT_MODEL,
            messages   = messages,
            max_tokens = 512,
            temperature= 0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[NVIDIA chat error] {e}")
        return None


# ── 2. Disease Image Analysis (Vision) ────────────────────────
async def analyse_disease_image(
    image_bytes: bytes,
    mime_type:   str,
    ml_result:   dict,
    language:    str = "en",
) -> dict:
    if not _available:
        return {}

    disease    = ml_result.get("disease", "unknown")
    confidence = ml_result.get("confidence", 0)
    is_healthy = ml_result.get("is_healthy", False)

    # Encode image to base64 data URL
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    mime = mime_type or "image/jpeg"
    image_url = f"data:{mime};base64,{b64}"

    if is_healthy:
        prompt = (
            "पौधा स्वस्थ दिखता है। रोकथाम के लिए 2 सुझाव दें। हिंदी में।"
            if language == "hi" else
            "The plant looks healthy. Give 2 preventive care tips. Be brief."
        )
    else:
        if language == "hi":
            prompt = f"""यह पौधे की बीमार पत्ती है।
हमारे ML मॉडल ने पहचाना: **{disease}** ({round(confidence*100)}% विश्वास)

कृपया बताएं:
1. इस रोग की पहचान के 2 मुख्य लक्षण
2. सबसे प्रभावी रासायनिक उपचार (दवा का नाम + मात्रा)
3. एक देसी/जैविक उपाय
4. किसान को अभी क्या करना चाहिए?

4-5 वाक्यों में, सरल हिंदी में।"""
        else:
            prompt = f"""This is a diseased plant leaf.
Our ML model identified: **{disease}** ({round(confidence*100)}% confidence)

Please provide:
1. 2 key symptoms confirming this diagnosis
2. Best chemical treatment (product name + dose)
3. One organic/natural remedy
4. Immediate action the farmer should take

Keep to 4-5 sentences. Be specific and practical."""

    try:
        resp = _client.chat.completions.create(
            model = VISION_MODEL,
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text",      "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ]
                }
            ],
            max_tokens  = 600,
            temperature = 0.4,
        )
        text = resp.choices[0].message.content.strip()
        return {
            "enhanced_treatment": text,
            "powered_by":         "nvidia-llama4"
        }
    except Exception as e:
        print(f"[NVIDIA vision error] {e}")
        return {}


# ── 3. Crop Recommendation Explanation ────────────────────────
async def explain_crop_recommendation(
    ml_result: dict,
    soil_data: dict,
    language:  str = "en",
) -> str:
    if not _available:
        return ""

    crop = ml_result.get("recommended_crop", "")
    conf = ml_result.get("confidence", 0)

    if language == "hi":
        prompt = f"""खेत का डेटा:
नाइट्रोजन: {soil_data.get('nitrogen')}, फास्फोरस: {soil_data.get('phosphorus')},
पोटेशियम: {soil_data.get('potassium')}, तापमान: {soil_data.get('temperature')}°C,
pH: {soil_data.get('ph')}, वर्षा: {soil_data.get('rainfall')}mm

AI मॉडल ने सिफारिश की: **{crop}** ({round(conf*100)}% विश्वास)

2-3 वाक्यों में बताएं इस खेत के लिए {crop} क्यों सबसे अच्छा है।
सरल हिंदी में।"""
    else:
        prompt = f"""Soil data: N={soil_data.get('nitrogen')} P={soil_data.get('phosphorus')} \
K={soil_data.get('potassium')} Temp={soil_data.get('temperature')}°C \
pH={soil_data.get('ph')} Rainfall={soil_data.get('rainfall')}mm

ML model recommended: **{crop}** ({round(conf*100)}% confidence)

In 2-3 sentences, explain WHY {crop} suits these exact conditions.
Be specific and farmer-friendly."""

    try:
        resp = _client.chat.completions.create(
            model    = TEXT_MODEL,
            messages = [
                {"role": "system", "content": _system(language)},
                {"role": "user",   "content": prompt},
            ],
            max_tokens  = 300,
            temperature = 0.5,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[NVIDIA crop explain error] {e}")
        return ""


# ── 4. Weather Farming Advice ──────────────────────────────────
async def weather_farming_advice(
    crop:          str,
    today_weather: dict,
    language:      str = "en",
) -> str:
    if not _available:
        return ""

    temp = today_weather.get("temp_max", 30)
    rain = today_weather.get("precipitation", 0)
    wind = today_weather.get("wind_speed", 0)
    date = today_weather.get("date", "today")

    if language == "hi":
        prompt = f"""{date}: तापमान {temp}°C, बारिश {rain}mm, हवा {wind}km/h।
फसल: {crop}
आज खेत में एक विशिष्ट कार्य बताएं। 2 वाक्य, हिंदी में।"""
    else:
        prompt = f"""Date: {date} | Temp: {temp}°C | Rain: {rain}mm | Wind: {wind}km/h
Crop: {crop}
What ONE specific action should the farmer take today? 2 sentences."""

    try:
        resp = _client.chat.completions.create(
            model    = TEXT_MODEL,
            messages = [
                {"role": "system", "content": _system(language)},
                {"role": "user",   "content": prompt},
            ],
            max_tokens  = 150,
            temperature = 0.6,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[NVIDIA weather advice error] {e}")
        return ""


# ── 5. EASY MODE Crop Recommendation (Llama-FIRST) ─────────────
# For farmers who don't know N/P/K/pH — they only know their
# state, district, what their soil looks/feels like, and water
# availability. Llama uses its general agricultural knowledge of
# Indian regions to recommend a crop. The RandomForest .pkl model
# is NOT usable here (it requires exact N/P/K numbers), so when
# Llama is unavailable we fall back to a simple rule-based table
# in crop.py — not the ML model.
EASY_CROP_SCHEMA_HINT = (
    "Respond ONLY with valid JSON, no markdown, no backticks, "
    "in exactly this shape: "
    '{"recommended_crop": "<crop name>", '
    '"confidence_label": "<High|Medium|Low>", '
    '"reason": "<2-3 sentence explanation in the requested language>", '
    '"soil_type_guess": "<likely soil type name>", '
    '"fertilizer_tip": "<one practical fertilizer suggestion in the requested language>", '
    '"water_tip": "<one practical irrigation suggestion in the requested language>", '
    '"alternatives": ["<crop2>", "<crop3>"]}'
)


async def easy_crop_recommendation(
    state:        str,
    district:     str = "",
    soil_look:    str = "",     # e.g. "black/dark", "red/brown", "sandy", "don't know"
    water_source: str = "",     # e.g. "borewell", "canal/river", "rain-fed only", "pond"
    season:       str = "",     # e.g. "kharif", "rabi", "zaid", "don't know"
    land_size:    str = "",     # e.g. "1 acre", "less than 1 acre"
    language:     str = "en",
) -> dict:
    """
    Llama-FIRST crop recommendation for farmers with little/no
    technical soil data. Returns parsed JSON dict, or {} on failure
    so the caller (crop.py) can fall back to the simple rule table.
    """
    if not _available:
        return {}

    if language == "hi":
        prompt = f"""एक भारतीय किसान निम्नलिखित जानकारी देता है:
राज्य: {state or "नहीं बताया"}
जिला: {district or "नहीं बताया"}
मिट्टी कैसी दिखती है: {soil_look or "नहीं पता"}
पानी का स्रोत: {water_source or "नहीं बताया"}
मौसम/सीजन: {season or "नहीं बताया"}
खेत का आकार: {land_size or "नहीं बताया"}

इस जानकारी के आधार पर, भारत के इस क्षेत्र के लिए सबसे उपयुक्त फसल सुझाएं।
अपने सामान्य कृषि ज्ञान का उपयोग करें (जलवायु, मिट्टी, क्षेत्र की परंपरा)।
सरल हिंदी में उत्तर दें, किसान को समझ आए।

{EASY_CROP_SCHEMA_HINT}
सभी टेक्स्ट फील्ड हिंदी में लिखें।"""
    else:
        prompt = f"""An Indian farmer gives the following information:
State: {state or "not specified"}
District: {district or "not specified"}
What the soil looks/feels like: {soil_look or "unknown"}
Water source: {water_source or "not specified"}
Season: {season or "not specified"}
Land size: {land_size or "not specified"}

Based on this, recommend the single best crop for this region of India.
Use your general agricultural knowledge of Indian states, typical soil
types per region, and climate. Be practical and farmer-friendly.

{EASY_CROP_SCHEMA_HINT}"""

    try:
        resp = _client.chat.completions.create(
            model    = TEXT_MODEL,
            messages = [
                {"role": "system", "content": _system(language)},
                {"role": "user",   "content": prompt},
            ],
            max_tokens  = 500,
            temperature = 0.4,
        )
        text = resp.choices[0].message.content.strip()
        # Strip markdown code fences if the model adds them anyway
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()

        import json as _json
        parsed = _json.loads(text)
        parsed["powered_by"] = "llama"
        return parsed
    except Exception as e:
        print(f"[NVIDIA easy-crop error] {e}")
        return {}


# ── 6. "I want to grow X" chat-intent crop guidance ────────────
CROP_INTENT_SCHEMA_HINT = (
    "Respond ONLY with valid JSON, no markdown, no backticks, "
    "in exactly this shape: "
    '{"crop_name": "<the crop they mentioned, normalised>", '
    '"is_suitable_advice": "<2-3 sentence note on suitability/season in requested language>", '
    '"soil_type": "<best soil type for this crop, in requested language>", '
    '"fertilizer_tip": "<practical fertilizer/nutrient suggestion in requested language>", '
    '"water_tip": "<irrigation frequency/method suggestion in requested language>", '
    '"sunlight_tip": "<sunlight/spacing suggestion in requested language>", '
    '"next_step_tool": "<one of: crop|disease|irrigation|fertilizer|weather>"}'
)


async def crop_intent_guidance(
    crop_mentioned: str,
    language:       str = "en",
    context:        dict = {},
) -> dict:
    """
    Used when a farmer says something like "I want to grow tomato"
    or "podhina laga sakte hai kya" in chat. Llama gives soil,
    fertilizer, and water guidance for that specific crop, in
    plain farmer language, without requiring any form to be filled.
    Returns {} on failure (caller falls back to a generic chat reply).
    """
    if not _available:
        return {}

    region_note = ""
    if context.get("state"):
        region_note = (
            f" किसान {context['state']} क्षेत्र से है।"
            if language == "hi" else
            f" The farmer is in the {context['state']} region of India."
        )

    if language == "hi":
        prompt = f"""एक भारतीय किसान कहता है: "मैं {crop_mentioned} उगाना चाहता हूं।"
{region_note}

इस फसल के लिए सरल, व्यावहारिक सलाह दें:
1. क्या यह सही समय/मौसम है (संक्षेप में)
2. कैसी मिट्टी चाहिए (सरल भाषा में, जैसे 'काली मिट्टी' या 'दोमट')
3. कौन सी खाद डालें (आम उपलब्ध खाद का नाम)
4. पानी कितनी बार दें
5. धूप/दूरी की जरूरत

हर बिंदु को एक सरल वाक्य में बताएं। किसान को तकनीकी शब्द (N/P/K/pH) न पूछें।

{CROP_INTENT_SCHEMA_HINT}
सभी टेक्स्ट फील्ड हिंदी में लिखें।"""
    else:
        prompt = f"""An Indian farmer says: "I want to grow {crop_mentioned}."
{region_note}

Give simple, practical guidance for this crop:
1. Is this the right season (brief note)
2. What soil type is needed (plain language, e.g. 'black soil' or 'loamy')
3. What fertilizer to apply (common, locally available product names)
4. How often to water
5. Sunlight/spacing needs

Each point in one simple sentence. Do NOT ask the farmer for technical
values like N/P/K or pH — speak in plain, practical terms.

{CROP_INTENT_SCHEMA_HINT}"""

    try:
        resp = _client.chat.completions.create(
            model    = TEXT_MODEL,
            messages = [
                {"role": "system", "content": _system(language)},
                {"role": "user",   "content": prompt},
            ],
            max_tokens  = 450,
            temperature = 0.5,
        )
        text = resp.choices[0].message.content.strip().strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()

        import json as _json
        parsed = _json.loads(text)
        parsed["powered_by"] = "llama"
        return parsed
    except Exception as e:
        print(f"[NVIDIA crop-intent error] {e}")
        return {}


# ── 7. Disease detection — FULL Llama vision (primary path) ────
async def llama_disease_diagnosis(
    image_bytes: bytes,
    mime_type:   str,
    language:    str = "en",
) -> dict:
    """
    Llama-FIRST disease diagnosis. Unlike analyse_disease_image()
    (which only adds commentary on top of an ML prediction), this
    function asks Llama to independently diagnose the plant from
    the photo. Used as the PRIMARY path; the CNN .h5 model is the
    fallback if this returns {}.
    """
    if not _available:
        return {}

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    mime = mime_type or "image/jpeg"
    image_url = f"data:{mime};base64,{b64}"

    schema_hint = (
        "Respond ONLY with valid JSON, no markdown, no backticks, "
        "in exactly this shape: "
        '{"crop_name": "<plant/crop name visible in image>", '
        '"disease_name": "<disease name, or \\"Healthy\\" if no disease visible>", '
        '"is_healthy": <true or false>, '
        '"confidence_label": "<High|Medium|Low>", '
        '"severity": "<None|Mild|Moderate|High|Severe>", '
        '"symptoms_observed": "<1-2 sentences describing what is visible in the requested language>", '
        '"treatment": "<practical chemical or cultural treatment in the requested language>", '
        '"organic_remedy": "<one organic/desi remedy in the requested language>", '
        '"prevention": "<one prevention tip in the requested language>"}'
    )

    if language == "hi":
        prompt = f"""यह एक पौधे की पत्ती/फसल की फोटो है।
फोटो को ध्यान से देखें और बताएं कि क्या यह पौधा स्वस्थ है या किसी रोग से ग्रस्त है।

{schema_hint}
सभी टेक्स्ट फील्ड सरल हिंदी में लिखें, किसान को समझ आए।"""
    else:
        prompt = f"""This is a photo of a plant leaf/crop.
Examine the image carefully and determine if the plant is healthy
or affected by a disease.

{schema_hint}
Use simple, farmer-friendly language in all text fields."""

    try:
        resp = _client.chat.completions.create(
            model = VISION_MODEL,
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text",      "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ]
                }
            ],
            max_tokens  = 600,
            temperature = 0.3,
        )
        text = resp.choices[0].message.content.strip().strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()

        import json as _json
        parsed = _json.loads(text)
        parsed["powered_by"] = "llama"
        return parsed
    except Exception as e:
        print(f"[NVIDIA llama-disease error] {e}")
        return {}