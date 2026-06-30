from typing import Any
import traceback
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import (
    CROP_NAME,
    DEFAULT_BUFFER_PERCENT_OF_FC,
    DEFAULT_FIELD_AREA_M2,
    DEFAULT_IRRIGATION_CYCLE_DAYS,
    DEFAULT_IRRIGATION_SEASON,
    DEFAULT_TANK_WATER_LITER,
    FORECAST_DAYS,
    LATITUDE,
    LONGITUDE,
    MOISTURE_THRESHOLD,
    PREDICTION_TODAY,
    SENSOR_VALUE,
    SOIL_TEXTURE,
    SOWING_DATE,
)
from main import run_irrigation_pipeline


app = FastAPI(
    title="Smart Irrigation API",
    description="Backend API for weather, soil moisture, irrigation scheduling, and water requirement prediction.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FarmInput(BaseModel):
    id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    areaM2: float = Field(gt=0)
    sowingDate: str
    irrigationMethod: str
    season: str


class DeviceInput(BaseModel):
    id: str
    deviceId: str
    status: str
    pumpStatus: int = Field(ge=0, le=1)


class SensorInput(BaseModel):
    moistureFraction: float = Field(ge=0, le=1)
    tankWaterLiters: float = Field(ge=0)
    waterLevelPercent: float | None = Field(default=None, ge=0, le=100)
    recordedAt: str | None = None


class WeatherConfig(BaseModel):
    forecastDays: int = Field(default=FORECAST_DAYS, ge=1, le=16)
    provider: str = "open-meteo"


class CalculationConfig(BaseModel):
    predictionDate: str
    moistureThreshold: float = Field(ge=0, le=1)
    irrigationCycleDays: int = Field(ge=1)
    bufferFractionOfFc: float = Field(ge=0, le=1)


class IrrigationRequest(BaseModel):
    schemaVersion: str = "1.0"
    farm: FarmInput
    device: DeviceInput
    sensorData: SensorInput
    crop: dict[str, Any]
    soil: dict[str, Any]
    weatherConfig: WeatherConfig
    calculationConfig: CalculationConfig


def request_data(request: IrrigationRequest) -> dict[str, Any]:
    data = request.model_dump() if hasattr(request, "model_dump") else request.dict()
    farm, sensor = data["farm"], data["sensorData"]
    weather, config = data["weatherConfig"], data["calculationConfig"]
    return {
        "latitude": farm["latitude"], "longitude": farm["longitude"],
        "forecast_days": weather["forecastDays"],
        "crop_name": data["crop"]["Crop"],
        "soil_texture": data["soil"]["Soil type"],
        "sowing_date": farm["sowingDate"],
        "prediction_today": config["predictionDate"],
        "sensor_value": sensor["moistureFraction"],
        "moisture_threshold": config["moistureThreshold"],
        "field_area_m2": farm["areaM2"],
        "tank_water_liter": sensor["tankWaterLiters"],
        "irrigation_cycle_days": config["irrigationCycleDays"],
        "irrigation_season": farm["season"],
        "buffer_percent_of_fc": config["bufferFractionOfFc"],
        "export_csv": False,
        "crop_data": data["crop"], "soil_data": data["soil"],
    }


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {
        "message": "Smart Irrigation API is running",
        "docs": "/docs",
        "health": "/health",
        "recommendation": "/irrigation/recommendation",
    }


@app.get("/health", tags=["system"])
def health() -> dict[str, Any]:
    return {"status": "ok", "databaseAccess": False, "weatherProvider": "open-meteo"}


@app.get("/config", tags=["irrigation"])
def default_config() -> dict[str, Any]:
    return {"schemaVersion": "1.0", "databaseAccess": False}


@app.post("/irrigation/recommendation", tags=["irrigation"])
def irrigation_recommendation(request: IrrigationRequest) -> dict[str, Any]:
    try:
        raw_request = request.model_dump() if hasattr(request, "model_dump") else request.dict()
        print("\n" + "=" * 80, flush=True)
        print("[FASTAPI] RECEIVED SMART-IRRIGATION PAYLOAD", flush=True)
        print(json.dumps(raw_request, indent=2, default=str), flush=True)

        result = run_irrigation_pipeline(**request_data(request))

        print("[FASTAPI] GENERATED SCHEDULE", flush=True)
        print(json.dumps(result.get("schedule"), indent=2, default=str), flush=True)
        print("[FASTAPI] WATER REQUIREMENT", flush=True)
        print(json.dumps(result.get("waterRequirement"), indent=2, default=str), flush=True)
        print("[FASTAPI] RECOMMENDATION / EXECUTION", flush=True)
        print(json.dumps({
            "recommendation": result.get("recommendation"),
            "execution": result.get("execution"),
        }, indent=2, default=str), flush=True)
        print("[FASTAPI] SENDING RESPONSE TO NODE BACKEND", flush=True)
        print(json.dumps(result, indent=2, default=str), flush=True)
        print("=" * 80 + "\n", flush=True)
        return result
    except Exception as exc:
        print(f"[FASTAPI] PIPELINE FAILED: {exc}", flush=True)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/recommendation", tags=["irrigation"], include_in_schema=False)
def recommendation_alias(request: IrrigationRequest) -> dict[str, Any]:
    return irrigation_recommendation(request)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api:app", host="127.0.0.1", port=8001, reload=True)
