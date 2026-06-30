# ai-service/routers/weather.py
#
# Receives pre-fetched weather data from Express (which called Open-Meteo)
# and generates crop-specific farming advice.

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/weather", tags=["Weather-Based Advice"])


# ── Request: Express sends farm context + parsed weather ──────────────────
class DayForecast(BaseModel):
    date:            str
    temp_max:        float
    temp_min:        float
    precipitation:   float    # mm
    wind_speed:      float    # km/h
    weather_code:    int      # WMO code


class WeatherInput(BaseModel):
    farm_name:    str
    current_crop: str
    soil_type:    Optional[str]  = "loam"
    size_acres:   Optional[float] = 1.0
    forecast:     list[DayForecast]
    language:     Optional[str]  = "en"


# ── Response ──────────────────────────────────────────────────────────────
class WeatherAlert(BaseModel):
    level:   str    # "info" | "warning" | "danger"
    message: str


class WeatherOutput(BaseModel):
    summary:           str
    today_advice:      str
    week_advice:       str
    alerts:            list[WeatherAlert]
    irrigation_impact: str
    language:          str


# ── WMO Weather Code → description ───────────────────────────────────────
def _wmo_desc(code: int, lang: str) -> str:
    codes_en = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy",
        3: "Overcast", 45: "Foggy", 48: "Icy fog",
        51: "Light drizzle", 53: "Moderate drizzle", 55: "Heavy drizzle",
        61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
        71: "Light snow", 73: "Moderate snow", 75: "Heavy snow",
        80: "Light showers", 81: "Moderate showers", 82: "Heavy showers",
        95: "Thunderstorm", 96: "Thunderstorm with hail",
        99: "Severe thunderstorm",
    }
    codes_hi = {
        0: "साफ आकाश", 1: "मुख्यतः साफ", 2: "आंशिक बादल",
        3: "बादल छाए", 45: "कोहरा", 48: "बर्फीला कोहरा",
        51: "हल्की बूंदाबांदी", 53: "मध्यम बूंदाबांदी", 55: "भारी बूंदाबांदी",
        61: "हल्की बारिश", 63: "मध्यम बारिश", 65: "भारी बारिश",
        71: "हल्की बर्फ", 73: "मध्यम बर्फ", 75: "भारी बर्फ",
        80: "हल्की बौछारें", 81: "मध्यम बौछारें", 82: "भारी बौछारें",
        95: "आंधी-तूफान", 96: "ओलों के साथ तूफान",
        99: "भीषण तूफान",
    }
    codes = codes_hi if lang == "hi" else codes_en
    return codes.get(code, "Unknown" if lang == "en" else "अज्ञात")


# ── Crop heat/cold thresholds (°C) ────────────────────────────────────────
_CROP_THRESHOLDS = {
    "rice":      dict(heat=38, cold=15, rain_ok=True),
    "wheat":     dict(heat=32, cold=5,  rain_ok=True),
    "maize":     dict(heat=38, cold=10, rain_ok=True),
    "cotton":    dict(heat=42, cold=15, rain_ok=False),
    "tomato":    dict(heat=35, cold=10, rain_ok=False),
    "potato":    dict(heat=30, cold=4,  rain_ok=False),
    "chickpea":  dict(heat=33, cold=5,  rain_ok=False),
    "sugarcane": dict(heat=40, cold=15, rain_ok=True),
    "banana":    dict(heat=40, cold=12, rain_ok=True),
    "grapes":    dict(heat=38, cold=5,  rain_ok=False),
    "mango":     dict(heat=44, cold=12, rain_ok=False),
    "default":   dict(heat=38, cold=10, rain_ok=True),
}


@router.post("/advise", response_model=WeatherOutput)
async def weather_advice(data: WeatherInput):
    lang  = data.language or "en"
    crop  = data.current_crop.lower().strip()
    thresh = _CROP_THRESHOLDS.get(crop, _CROP_THRESHOLDS["default"])

    if not data.forecast:
        msg = ("No forecast data available." if lang == "en"
               else "मौसम डेटा उपलब्ध नहीं।")
        return WeatherOutput(
            summary=msg, today_advice=msg, week_advice=msg,
            alerts=[], irrigation_impact=msg, language=lang
        )

    today   = data.forecast[0]
    week    = data.forecast[:7]
    crop_d  = data.current_crop.capitalize()
    alerts  = []

    # ── Build alerts ──────────────────────────────────────────────────────
    # Heat stress
    for day in week:
        if day.temp_max > thresh["heat"]:
            if lang == "en":
                alerts.append(WeatherAlert(
                    level="danger",
                    message=f"🌡️ Heat stress alert on {day.date}: {day.temp_max:.0f}°C — "
                            f"above safe limit for {crop_d} ({thresh['heat']}°C). "
                            f"Irrigate early morning and provide shade netting."
                ))
            else:
                alerts.append(WeatherAlert(
                    level="danger",
                    message=f"🌡️ {day.date} को ताप तनाव: {day.temp_max:.0f}°C — "
                            f"{crop_d} की सीमा ({thresh['heat']}°C) से अधिक। "
                            f"सुबह सिंचाई करें और छाया जाल लगाएं।"
                ))
            break

    # Cold/frost
    for day in week:
        if day.temp_min < thresh["cold"]:
            if lang == "en":
                alerts.append(WeatherAlert(
                    level="warning",
                    message=f"❄️ Cold stress on {day.date}: {day.temp_min:.0f}°C — "
                            f"below safe minimum for {crop_d} ({thresh['cold']}°C). "
                            f"Use light irrigation at night for frost protection."
                ))
            else:
                alerts.append(WeatherAlert(
                    level="warning",
                    message=f"❄️ {day.date} को शीत तनाव: {day.temp_min:.0f}°C — "
                            f"{crop_d} की न्यूनतम सीमा ({thresh['cold']}°C) से कम। "
                            f"पाले से बचाव के लिए रात को हल्की सिंचाई करें।"
                ))
            break

    # Heavy rain + rain-sensitive crop
    total_rain = sum(d.precipitation for d in week)
    heavy_rain_days = [d for d in week if d.precipitation > 20]
    if heavy_rain_days and not thresh["rain_ok"]:
        if lang == "en":
            alerts.append(WeatherAlert(
                level="warning",
                message=f"🌧️ Heavy rain expected ({heavy_rain_days[0].precipitation:.0f}mm on "
                        f"{heavy_rain_days[0].date}) — {crop_d} is rain-sensitive. "
                        f"Ensure field drainage. Postpone fungicide application."
            ))
        else:
            alerts.append(WeatherAlert(
                level="warning",
                message=f"🌧️ भारी बारिश की संभावना ({heavy_rain_days[0].date} को "
                        f"{heavy_rain_days[0].precipitation:.0f}मिमी) — {crop_d} के लिए "
                        f"जल निकासी सुनिश्चित करें। फफूंदनाशक छिड़काव स्थगित करें।"
            ))

    # Strong wind
    for day in week:
        if day.wind_speed > 40:
            if lang == "en":
                alerts.append(WeatherAlert(
                    level="warning",
                    message=f"💨 Strong winds on {day.date} ({day.wind_speed:.0f} km/h) — "
                            f"avoid spraying. Stake tall crops."
                ))
            else:
                alerts.append(WeatherAlert(
                    level="warning",
                    message=f"💨 {day.date} को तेज हवा ({day.wind_speed:.0f} किमी/घंटा) — "
                            f"छिड़काव न करें। लंबी फसलें बांधें।"
                ))
            break

    # ── Today's summary ───────────────────────────────────────────────────
    today_cond = _wmo_desc(today.weather_code, lang)

    if lang == "en":
        today_advice = (
            f"Today ({today.date}): {today_cond}, "
            f"{today.temp_min:.0f}–{today.temp_max:.0f}°C, "
            f"rain: {today.precipitation:.0f}mm, wind: {today.wind_speed:.0f} km/h. "
        )
        if today.precipitation > 10:
            today_advice += f"Skip irrigation today — {today.precipitation:.0f}mm rain expected. "
        elif today.temp_max > thresh["heat"] - 3:
            today_advice += "Irrigate early morning to reduce heat stress. "
        else:
            today_advice += "Conditions are favourable — proceed with normal farm activities. "
    else:
        today_advice = (
            f"आज ({today.date}): {today_cond}, "
            f"{today.temp_min:.0f}–{today.temp_max:.0f}°C, "
            f"बारिश: {today.precipitation:.0f}मिमी, हवा: {today.wind_speed:.0f} किमी/घंटा। "
        )
        if today.precipitation > 10:
            today_advice += f"आज सिंचाई न करें — {today.precipitation:.0f}मिमी बारिश संभावित। "
        elif today.temp_max > thresh["heat"] - 3:
            today_advice += "ताप तनाव कम करने के लिए सुबह सिंचाई करें। "
        else:
            today_advice += "स्थितियां अनुकूल हैं — सामान्य कृषि कार्य करें। "

    # ── Week summary ──────────────────────────────────────────────────────
    avg_max   = sum(d.temp_max for d in week) / len(week)
    rainy_days = sum(1 for d in week if d.precipitation > 5)

    if lang == "en":
        week_advice = (
            f"7-day outlook for {data.farm_name}: "
            f"Average high {avg_max:.0f}°C, "
            f"{rainy_days} rainy day(s), total rainfall ~{total_rain:.0f}mm. "
        )
        if rainy_days >= 4:
            week_advice += f"Wet week ahead — focus on drainage and disease prevention for {crop_d}."
        elif total_rain < 5 and avg_max > 32:
            week_advice += f"Dry and hot week — increase irrigation frequency for {crop_d}."
        else:
            week_advice += f"Moderate conditions — maintain regular schedule for {crop_d}."
    else:
        week_advice = (
            f"{data.farm_name} के लिए 7 दिनों का पूर्वानुमान: "
            f"औसत अधिकतम {avg_max:.0f}°C, "
            f"{rainy_days} बारिश के दिन, कुल वर्षा ~{total_rain:.0f}मिमी। "
        )
        if rainy_days >= 4:
            week_advice += f"बारिशभरा सप्ताह — {crop_d} के लिए जल निकासी और रोग रोकथाम पर ध्यान दें।"
        elif total_rain < 5 and avg_max > 32:
            week_advice += f"गर्म और शुष्क सप्ताह — {crop_d} की सिंचाई बढ़ाएं।"
        else:
            week_advice += f"सामान्य स्थितियां — {crop_d} का नियमित शेड्यूल बनाए रखें।"

    # ── Irrigation impact ─────────────────────────────────────────────────
    if total_rain > 50:
        irr_impact = (
            f"Rain supplies ~{total_rain:.0f}mm this week — you may skip 2–3 irrigation sessions."
            if lang == "en" else
            f"इस सप्ताह ~{total_rain:.0f}मिमी बारिश — 2–3 सिंचाई सत्र छोड़ सकते हैं।"
        )
    elif total_rain > 20:
        irr_impact = (
            "Partial rainfall this week — reduce irrigation by ~30%."
            if lang == "en" else
            "इस सप्ताह आंशिक वर्षा — सिंचाई ~30% कम करें।"
        )
    else:
        irr_impact = (
            "Dry week — maintain full irrigation schedule."
            if lang == "en" else
            "शुष्क सप्ताह — पूरा सिंचाई शेड्यूल बनाए रखें।"
        )

    # ── Overall summary ───────────────────────────────────────────────────
    alert_count = len(alerts)
    if lang == "en":
        summary = (
            f"Weather forecast for **{data.farm_name}** ({crop_d}): "
            f"{today_cond} today, {avg_max:.0f}°C average high this week."
            + (f" {alert_count} alert(s) require your attention." if alert_count else
               " No critical weather alerts.")
        )
    else:
        summary = (
            f"**{data.farm_name}** ({crop_d}) के लिए मौसम पूर्वानुमान: "
            f"आज {today_cond}, इस सप्ताह औसत अधिकतम {avg_max:.0f}°C।"
            + (f" {alert_count} चेतावनी पर ध्यान दें।" if alert_count else
               " कोई गंभीर मौसम चेतावनी नहीं।")
        )

    return WeatherOutput(
        summary          = summary,
        today_advice     = today_advice,
        week_advice      = week_advice,
        alerts           = alerts,
        irrigation_impact= irr_impact,
        language         = lang,
    )