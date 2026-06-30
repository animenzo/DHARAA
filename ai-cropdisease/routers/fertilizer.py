# ai-service/routers/fertilizer.py

from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/fertilizer", tags=["Fertilizer Recommendation"])


class FertilizerInput(BaseModel):
    crop:         str
    soil_type:    Optional[str]   = "loam"
    growth_stage: Optional[str]   = "vegetative"  # sowing|vegetative|flowering|fruiting
    size_acres:   Optional[float] = 1.0
    soil_ph:      Optional[float] = Field(None, ge=0, le=14)
    nitrogen:     Optional[float] = None   # from soil test if available
    phosphorus:   Optional[float] = None
    potassium:    Optional[float] = None
    language:     Optional[str]   = "en"


class FertilizerOutput(BaseModel):
    primary_fertilizer:   str
    dose_per_acre:        str
    application_method:   str
    timing:               str
    organic_alternative:  str
    caution:              str
    language:             str


# ── Fertilizer database keyed by crop + growth stage ──────────────────────
# Format: crop → stage → { fertilizer, dose, method, timing, organic, caution }

_DB = {
    "rice": {
        "sowing":     dict(f="DAP (18-46-0)",        d="50 kg/acre",  m="Basal application — broadcast and incorporate",       t="At transplanting",            o="FYM 4 tonnes/acre 2 weeks before transplanting", c="Avoid urea near seedlings — causes ammonia burn"),
        "vegetative": dict(f="Urea (46-0-0)",         d="30 kg/acre",  m="Top-dress in standing water",                        t="21–25 days after transplanting",o="Vermicompost 500 kg/acre",                        c="Do not apply during heavy rain — loss by leaching"),
        "flowering":  dict(f="MOP (0-0-60)",           d="20 kg/acre",  m="Broadcast in moist soil",                            t="At panicle initiation",         o="Wood ash 80 kg/acre",                            c="Excess potassium raises pH — retest after harvest"),
        "fruiting":   dict(f="Urea foliar spray 2%",   d="2 kg in 100L water/acre", m="Foliar spray in early morning",           t="At grain filling stage",        o="Seaweed extract spray",                          c="Avoid spraying in direct sunlight"),
    },
    "wheat": {
        "sowing":     dict(f="DAP + MOP",             d="50 + 20 kg/acre", m="Drill with seed",                               t="At sowing",                     o="FYM 5 tonnes/acre",                              c="Keep seed-fertilizer separation to avoid germination damage"),
        "vegetative": dict(f="Urea",                   d="35 kg/acre",  m="Top-dress before irrigation",                       t="Crown root initiation (CRI) stage",o="Neem cake 100 kg/acre",                        c="Split urea into 2 doses for better efficiency"),
        "flowering":  dict(f="Urea foliar 1%",         d="1 kg in 100L/acre", m="Foliar spray",                               t="Flag leaf stage",                o="Panchagavya 3% spray",                           c="Avoid excess nitrogen at this stage — lodging risk"),
        "fruiting":   dict(f="No additional N needed", d="—",           m="—",                                                 t="Grain filling",                 o="Maintain soil moisture only",                    c="Late nitrogen delays maturity and reduces quality"),
    },
    "maize": {
        "sowing":     dict(f="DAP",                    d="55 kg/acre",  m="Place in furrow, 5 cm from seed",                   t="At sowing",                     o="FYM 4 tonnes/acre",                              c="Do not mix DAP directly with seed"),
        "vegetative": dict(f="Urea",                   d="40 kg/acre",  m="Side-dress near root zone",                         t="V4–V6 (knee-high) stage",       o="Vermicompost 600 kg/acre",                       c="Ensure soil moisture before application"),
        "flowering":  dict(f="Urea",                   d="25 kg/acre",  m="Top-dress before tasselling irrigation",             t="At tasselling (VT stage)",      o="Liquid organic manure 200L/acre",                c="Critical timing — missing this dose cuts yield 20%"),
        "fruiting":   dict(f="MOP foliar 0.5%",        d="0.5 kg in 100L/acre", m="Foliar spray",                             t="Silking to dough stage",        o="Seaweed foliar spray",                           c="Avoid heavy irrigation after this point"),
    },
    "tomato": {
        "sowing":     dict(f="SSP (0-16-0) + FYM",    d="80 kg SSP + 2T FYM/acre", m="Mix in transplanting hole",             t="At transplanting",              o="Compost 2 tonnes/acre",                          c="Do not apply urea at transplanting — root burn risk"),
        "vegetative": dict(f="19:19:19 (NPK)",         d="3 kg in 200L water/acre", m="Fertigation or foliar",                 t="Every 10 days until flowering", o="Fish amino acid 3 mL/L spray",                   c="Monitor for over-vegetative growth — reduce N if needed"),
        "flowering":  dict(f="12:61:0 (MKP) + Boron", d="2 kg MKP + 100g Boron/acre", m="Foliar spray",                      t="At first flower bud",           o="Panchagavya 3% + coconut water spray",           c="Boron deficiency causes flower drop — do not skip"),
"fruiting": dict(
    f="0:0:50 (SOP) + Calcium",
    d="3 kg SOP + 1 kg CaNO3/acre",
    m="Fertigation",
    t="At fruit set, every 14 days",
    o="Seaweed + humic acid drench",
    c="Excess nitrogen at fruiting causes blossom end rot"
),    },
    "potato": {
        "sowing":     dict(f="DAP + MOP",             d="60 + 50 kg/acre", m="Incorporated in furrow",                        t="At planting",                   o="FYM 6 tonnes + wood ash 100 kg/acre",            c="High potassium is critical for tuber quality"),
        "vegetative": dict(f="Urea",                   d="40 kg/acre",  m="Side-dress and hill",                               t="3 weeks after emergence",       o="Neem cake 150 kg/acre",                          c="Hilling must accompany fertilizer application"),
        "flowering":  dict(f="MOP foliar 1%",          d="1 kg in 100L/acre", m="Foliar spray",                               t="At tuber initiation",           o="Potassium humate 2 kg/acre drench",              c="Over-irrigation now causes hollow heart in tubers"),
        "fruiting":   dict(f="Calcium + Magnesium",    d="1 kg CaSO4 + 500g MgSO4/acre", m="Foliar spray",                   t="3 weeks before harvest",        o="Dolomite 50 kg/acre",                            c="Stop nitrogen 4 weeks before harvest"),
    },
    "cotton": {
        "sowing":     dict(f="DAP",                    d="50 kg/acre",  m="Band placement",                                    t="At sowing",                     o="FYM 5 tonnes/acre pre-sowing",                   c="Excess phosphorus locks up zinc — apply zinc sulfate separately"),
        "vegetative": dict(f="Urea",                   d="35 kg/acre",  m="Side-dress after first irrigation",                 t="30 days after sowing",          o="Vermicompost 500 kg/acre",                       c="Watch for excess vegetative growth delaying boll set"),
        "flowering":  dict(f="MOP + Urea foliar 1%",   d="30 kg MOP + 1 kg urea in 100L/acre", m="Broadcast + foliar",       t="At square and flower initiation",o="Seaweed extract 3 mL/L spray",                   c="Boron foliar at flowering prevents boll shedding"),
        "fruiting":   dict(f="MOP",                    d="25 kg/acre",  m="Broadcast in moist soil",                           t="At boll development",           o="Wood ash 80 kg/acre",                            c="Stop nitrogen at boll stage — delays maturity"),
    },
    "chickpea": {
        "sowing":     dict(f="DAP + Rhizobium seed treatment", d="25 kg DAP + 200g Rhizobium/acre", m="Furrow application",  t="At sowing",                     o="FYM 2 tonnes + vermicompost 250 kg/acre",        c="Rhizobium inoculation replaces most nitrogen need"),
        "vegetative": dict(f="SSP",                    d="30 kg/acre",  m="Top-dress",                                         t="3 weeks after germination",     o="Neem cake 100 kg/acre",                          c="Avoid excess nitrogen — reduces nodulation"),
        "flowering":  dict(f="MOP foliar 1%",          d="1 kg in 100L/acre", m="Foliar",                                     t="At flower bud",                 o="Panchagavya 3% spray",                           c="No overhead irrigation at flowering — fungal risk"),
        "fruiting":   dict(f="Boron 0.2%",             d="200g in 100L/acre", m="Foliar",                                     t="At pod fill",                   o="Seaweed extract spray",                          c="Excess moisture at pod fill causes Botrytis"),
    },
}

_STAGE_LABELS_EN = {"sowing": "Sowing/Transplanting", "vegetative": "Vegetative Growth", "flowering": "Flowering", "fruiting": "Fruiting/Grain Fill"}
_STAGE_LABELS_HI = {"sowing": "बुवाई/रोपाई", "vegetative": "वानस्पतिक वृद्धि", "flowering": "फूल आना", "fruiting": "फल/दाना भरना"}

# pH correction advice
def _ph_note(ph, lang):
    if ph is None:
        return ""
    if ph < 5.5:
        return ("Soil is highly acidic (pH {:.1f}) — apply lime 200 kg/acre to correct before fertilising.".format(ph)
                if lang == "en" else
                "मिट्टी बहुत अम्लीय है (pH {:.1f}) — उर्वरक से पहले 200 kg/acre चूना डालें।".format(ph))
    elif ph > 8.0:
        return ("Soil is alkaline (pH {:.1f}) — apply gypsum 100 kg/acre and organic matter to lower pH.".format(ph)
                if lang == "en" else
                "मिट्टी क्षारीय है (pH {:.1f}) — 100 kg/acre जिप्सम और जैव पदार्थ डालें।".format(ph))
    return ""


@router.post("/advise", response_model=FertilizerOutput)
async def fertilizer_advice(data: FertilizerInput):
    lang  = data.language or "en"
    crop  = data.crop.lower().strip()
    stage = (data.growth_stage or "vegetative").lower().strip()
    acres = data.size_acres or 1.0

    crop_db = _DB.get(crop)

    if not crop_db:
        # Graceful generic fallback for unlisted crops
        if lang == "en":
            return FertilizerOutput(
                primary_fertilizer  = "NPK 19:19:19",
                dose_per_acre       = f"3 kg dissolved in 200L water × {acres:.1f} acre(s)",
                application_method  = "Foliar spray or fertigation",
                timing              = "Every 15 days during growing season",
                organic_alternative = "Vermicompost 500 kg/acre + FYM 2 tonnes/acre",
                caution             = "Get a soil test for precise recommendations for your crop.",
                language            = lang,
            )
        else:
            return FertilizerOutput(
                primary_fertilizer  = "NPK 19:19:19",
                dose_per_acre       = f"3 kg 200L पानी में × {acres:.1f} एकड़",
                application_method  = "पत्तियों पर छिड़काव या फर्टिगेशन",
                timing              = "उगने के मौसम में हर 15 दिन",
                organic_alternative = "वर्मीकम्पोस्ट 500 kg/acre + FYM 2 टन/acre",
                caution             = "सटीक सलाह के लिए मिट्टी परीक्षण करवाएं।",
                language            = lang,
            )

    rec = crop_db.get(stage, crop_db.get("vegetative"))
    ph_note = _ph_note(data.soil_ph, lang)

    crop_display  = data.crop.capitalize()
    stage_display = (_STAGE_LABELS_HI if lang == "hi" else _STAGE_LABELS_EN).get(stage, stage)

    # Scale dose string — add acreage context
    dose_display = f"{rec['d']} (for {acres:.1f} acre)" if lang == "en" else f"{rec['d']} ({acres:.1f} एकड़ के लिए)"

    caution_full = rec["c"]
    if ph_note:
        caution_full = f"{ph_note} | {caution_full}" if lang == "en" else f"{ph_note} | {caution_full}"

    if lang == "hi":
        return FertilizerOutput(
            primary_fertilizer  = rec["f"],
            dose_per_acre       = dose_display,
            application_method  = rec["m"],
            timing              = f"{stage_display} चरण: {rec['t']}",
            organic_alternative = rec["o"],
            caution             = caution_full,
            language            = lang,
        )
    else:
        return FertilizerOutput(
            primary_fertilizer  = rec["f"],
            dose_per_acre       = dose_display,
            application_method  = rec["m"],
            timing              = f"{stage_display} stage: {rec['t']}",
            organic_alternative = rec["o"],
            caution             = caution_full,
            language            = lang,
        )