# ai-service/routers/irrigation.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

router = APIRouter(prefix="/irrigation", tags=["Irrigation Advice"])


# ── Request Model ──────────────────────────────────────────────────────────
class IrrigationInput(BaseModel):
    # Farm context (pulled from MongoDB by Express, forwarded here)
    farm_name:       str
    current_crop:    str
    soil_type:       Optional[str]   = "loam"
    size_acres:      Optional[float] = 1.0

    # Live sensor readings
    soil_moisture:   Optional[float] = Field(None, ge=0, le=100,
                        description="Soil moisture % from DeviceLog")

    # Schedule context
    last_irrigation: Optional[str]   = None   # ISO datetime string
    schedule_days:   Optional[list]  = None   # [Mon..Sun] booleans
    schedule_time:   Optional[str]   = None   # "HH:MM"
    schedule_duration: Optional[int] = None   # minutes

    # Environment
    temperature:     Optional[float] = None
    humidity:        Optional[float] = None
    language:        Optional[str]   = "en"


# ── Response Model ─────────────────────────────────────────────────────────
class IrrigationOutput(BaseModel):
    recommendation:    str
    urgency:           str          # "low" | "medium" | "high" | "critical"
    suggested_duration: int         # minutes
    next_irrigation:   str          # human readable
    water_saving_tip:  str
    language:          str


# ── Crop Water Requirements (litres/acre/day) ──────────────────────────────
_CROP_WATER = {
    "rice":        9000, "wheat":       4500, "maize":       5500,
    "cotton":      7000, "sugarcane":  15000, "soybean":     4500,
    "tomato":      5000, "potato":      5500, "onion":       4000,
    "chickpea":    3000, "lentil":      2500, "mungbean":    3500,
    "banana":      8000, "mango":       5000, "grapes":      5500,
    "default":     5000,
}

_SOIL_RETENTION = {
    "sandy":     0.6,   # drains fast → irrigate more often
    "loam":      1.0,   # baseline
    "clay":      1.4,   # retains water → irrigate less often
    "silt":      1.1,
    "black":     1.3,
    "red":       0.8,
    "default":   1.0,
}

DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
DAY_NAMES_HI = ["सोम", "मंगल", "बुध", "गुरु", "शुक्र", "शनि", "रवि"]


@router.post("/advise", response_model=IrrigationOutput)
async def irrigation_advice(data: IrrigationInput):
    lang  = data.language or "en"
    crop  = data.current_crop.lower().strip()
    soil  = (data.soil_type or "loam").lower().strip()

    # ── 1. Determine urgency from soil moisture ────────────────────────────
    moisture = data.soil_moisture
    if moisture is None:
        urgency = "medium"
        moisture_note = (
            "No live sensor data available — advice based on crop type and schedule."
            if lang == "en" else
            "लाइव सेंसर डेटा उपलब्ध नहीं — फसल प्रकार और शेड्यूल के आधार पर सलाह।"
        )
    elif moisture < 20:
        urgency = "critical"
        moisture_note = (
            f"⚠️ Soil moisture critically low at {moisture:.0f}%. Irrigate immediately."
            if lang == "en" else
            f"⚠️ मिट्टी की नमी {moisture:.0f}% — बहुत कम। तुरंत सिंचाई करें।"
        )
    elif moisture < 40:
        urgency = "high"
        moisture_note = (
            f"Soil moisture at {moisture:.0f}% — below optimal. Irrigation needed soon."
            if lang == "en" else
            f"मिट्टी की नमी {moisture:.0f}% — इष्टतम से कम। जल्द सिंचाई आवश्यक।"
        )
    elif moisture < 65:
        urgency = "medium"
        moisture_note = (
            f"Soil moisture at {moisture:.0f}% — adequate. Monitor and irrigate per schedule."
            if lang == "en" else
            f"मिट्टी की नमी {moisture:.0f}% — पर्याप्त। शेड्यूल अनुसार सिंचाई करें।"
        )
    else:
        urgency = "low"
        moisture_note = (
            f"Soil moisture at {moisture:.0f}% — good. No immediate irrigation needed."
            if lang == "en" else
            f"मिट्टी की नमी {moisture:.0f}% — अच्छी। तत्काल सिंचाई आवश्यक नहीं।"
        )

    # ── 2. Calculate suggested duration ───────────────────────────────────
    base_water    = _CROP_WATER.get(crop, _CROP_WATER["default"])
    soil_factor   = _SOIL_RETENTION.get(soil, 1.0)
    acres         = data.size_acres or 1.0

    # Daily water need (litres) adjusted for soil
    daily_need    = (base_water * acres) / soil_factor

    # Assume 1000 L/min flow rate for standard pump → convert to minutes
    # Urgency multiplier: critical = full, low = 60% of daily need
    urgency_mult  = {"critical": 1.0, "high": 0.85, "medium": 0.65, "low": 0.4}
    flow_rate_lpm = 1000
    suggested_min = int((daily_need * urgency_mult[urgency]) / flow_rate_lpm)
    suggested_min = max(10, min(suggested_min, 120))  # clamp 10–120 min

    # ── 3. Next irrigation timing ──────────────────────────────────────────
    if data.schedule_time and data.schedule_days:
        active_days = [DAY_NAMES_EN[i] if lang == "en" else DAY_NAMES_HI[i]
                       for i, d in enumerate(data.schedule_days) if d]
        days_str    = ", ".join(active_days) if active_days else (
            "No days set" if lang == "en" else "कोई दिन निर्धारित नहीं"
        )
        next_irr    = (
            f"Scheduled at {data.schedule_time} on {days_str}"
            if lang == "en" else
            f"{days_str} को {data.schedule_time} बजे निर्धारित"
        )
    elif urgency in ("critical", "high"):
        next_irr = "Immediately" if lang == "en" else "तुरंत"
    else:
        next_irr = "Within 24 hours" if lang == "en" else "24 घंटों के भीतर"

    # ── 4. Water-saving tip ────────────────────────────────────────────────
    tips_en = {
        "sandy":  "Sandy soil loses water fast — use drip irrigation and mulch to reduce evaporation.",
        "clay":   "Clay soil retains water well — avoid over-watering to prevent root rot.",
        "black":  "Black soil holds moisture — reduce irrigation frequency in cooler months.",
        "loam":   "Loam soil is ideal — maintain consistent moisture with scheduled drip irrigation.",
        "default":"Irrigate early morning (5–7 AM) to minimise evaporation losses by up to 30%.",
    }
    tips_hi = {
        "sandy":  "रेतीली मिट्टी जल्दी सूखती है — ड्रिप सिंचाई और मल्च उपयोग करें।",
        "clay":   "चिकनी मिट्टी पानी रोकती है — अधिक सिंचाई से जड़ सड़न होती है।",
        "black":  "काली मिट्टी नमी बनाए रखती है — ठंडे महीनों में सिंचाई कम करें।",
        "loam":   "दोमट मिट्टी आदर्श है — नियमित ड्रिप सिंचाई से नमी बनाए रखें।",
        "default":"सुबह 5–7 बजे सिंचाई करें — वाष्पीकरण 30% तक कम होता है।",
    }
    tips = tips_hi if lang == "hi" else tips_en
    tip  = tips.get(soil, tips["default"])

    # ── 5. Build recommendation text ──────────────────────────────────────
    crop_display = data.current_crop.capitalize()
    if lang == "en":
        recommendation = (
            f"**{data.farm_name} · {crop_display}**\n\n"
            f"{moisture_note}\n\n"
            f"Recommended irrigation: **{suggested_min} minutes** "
            f"({'drip' if soil in ('sandy','red') else 'flood or drip'} method). "
            f"Daily water requirement for {acres:.1f} acre(s) of {crop_display} "
            f"on {soil} soil: ~{int(daily_need):,} litres."
        )
    else:
        recommendation = (
            f"**{data.farm_name} · {crop_display}**\n\n"
            f"{moisture_note}\n\n"
            f"अनुशंसित सिंचाई: **{suggested_min} मिनट** "
            f"({'ड्रिप' if soil in ('sandy','red') else 'बाढ़ या ड्रिप'} विधि)। "
            f"{soil} मिट्टी पर {acres:.1f} एकड़ {crop_display} के लिए "
            f"दैनिक जल आवश्यकता: ~{int(daily_need):,} लीटर।"
        )

    return IrrigationOutput(
        recommendation     = recommendation,
        urgency            = urgency,
        suggested_duration = suggested_min,
        next_irrigation    = next_irr,
        water_saving_tip   = tip,
        language           = lang,
    )