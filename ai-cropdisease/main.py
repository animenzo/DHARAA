from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from routers import chat, crop, disease, irrigation, fertilizer, weather

load_dotenv()

app = FastAPI(
    title="DHARAA AI Service",
    description="AI microservice for crop recommendation, disease detection, and multilingual chat.",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:5000,http://localhost:5173")
origins = [o.strip() for o in origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(chat.router,    prefix="/api")
app.include_router(crop.router,    prefix="/api")
app.include_router(disease.router, prefix="/api")
app.include_router(irrigation.router, prefix="/api")
app.include_router(fertilizer.router, prefix="/api")
app.include_router(weather.router, prefix="/api")

@app.get("/")
def root():
    return {
        "service": "DHARAA AI",
        "status": "running",
        "endpoints": ["/api/chat", "/api/crop/predict", "/api/disease/predict"],
    }


@app.get("/health")
def health():
    return {"status": "ok"}