from datetime import date, datetime, time
import math
from pathlib import Path
from typing import Any
import pandas as pd
import runpy

from Irrigation_Schedular.irrigation_datetime_scheduler import schedule_irrigation
from Irrigation_Schedular.irrigation_water_requirement import IrrigationWaterRequirementCalculator
from soil_pred.soil_moisture_predicture import soil_moisture_prediction



from config import (
    CROP_NAME,
    CROP_SCHEDULE_CSV,
    DAILY_WEATHER_CSV,
    DEFAULT_BUFFER_PERCENT_OF_FC,
    DEFAULT_FIELD_AREA_M2,
    DEFAULT_IRRIGATION_CYCLE_DAYS,
    DEFAULT_IRRIGATION_SEASON,
    DEFAULT_TANK_WATER_LITER,
    FORECAST_DAYS,
    FUTURE_PREDICTION_CSV,
    HOURLY_WEATHER_CSV,
    LATITUDE,
    LONGITUDE,
    MOISTURE_THRESHOLD,
    PREDICTION_TODAY,
    RAIN_PROBABILITY_COLUMN,
    SENSOR_VALUE,
    SOIL_TEXTURE,
    SOWING_DATE,
    TODAY_STATE_CSV,
    WEATHER_DATE_COLUMN,
    WEATHER_MODEL_SCRIPT,
)


def run_weather_model(latitude: float, longitude: float, forecast_days: int, export_csv: bool = False) -> dict[str, Any]:
    weather_model = runpy.run_path(str(WEATHER_MODEL_SCRIPT))
    return weather_model["main"](
        latitude=latitude,
        longitude=longitude,
        forecast_days=forecast_days,
        export_csv=export_csv,
    )


def get_current_moisture_percent(
    prediction_data: pd.DataFrame,
    moisture_column: str = "Physics_Moisture",
    date_column: str = "Date",
) -> float:
    prediction = prediction_data.copy()
    prediction[date_column] = pd.to_datetime(prediction[date_column], errors="coerce").dt.date
    prediction[moisture_column] = pd.to_numeric(
        prediction[moisture_column],
        errors="coerce",
    )
    prediction = prediction.dropna(subset=[date_column, moisture_column]).sort_values(date_column)

    today = date.today()
    today_rows = prediction.loc[prediction[date_column] == today]
    if not today_rows.empty:
        current_moisture = float(today_rows.iloc[0][moisture_column])
    else:
        current_moisture = float(prediction.iloc[0][moisture_column])

    return round(current_moisture * 100, 2)


def get_current_root_zone_volume_m3(
    prediction_data: pd.DataFrame,
    field_area_m2: float,
    reference_date: str | date | None = None,
    root_depth_column: str = "RootDepth_m",
    date_column: str = "Date",
) -> float:
    prediction = prediction_data.copy()
    prediction[date_column] = pd.to_datetime(prediction[date_column], errors="coerce").dt.date
    prediction[root_depth_column] = pd.to_numeric(
        prediction[root_depth_column],
        errors="coerce",
    )
    prediction = prediction.dropna(subset=[date_column, root_depth_column]).sort_values(date_column)

    today = pd.to_datetime(reference_date).date() if reference_date else date.today()
    today_rows = prediction.loc[prediction[date_column] == today]
    if not today_rows.empty:
        root_depth_m = float(today_rows.iloc[0][root_depth_column])
    else:
        root_depth_m = float(prediction.iloc[0][root_depth_column])

    return round(root_depth_m * field_area_m2, 4)


def make_json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        if value.get("__class__") == "DataFrame":
            return None
        return {str(make_json_safe(key)): make_json_safe(item) for key, item in value.items()}
    if isinstance(value, pd.DataFrame):
        return value.to_dict(orient="records")
    if isinstance(value, list):
        return [make_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [make_json_safe(item) for item in value]
    if isinstance(value, (date, datetime, time, pd.Timestamp)):
        return value.isoformat()
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        return make_json_safe(value.item())
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def run_irrigation_pipeline(
    latitude: float = LATITUDE,
    longitude: float = LONGITUDE,
    forecast_days: int = FORECAST_DAYS,
    crop_name: str = CROP_NAME,
    soil_texture: str = SOIL_TEXTURE,
    sowing_date: str = SOWING_DATE,
    prediction_today: str = PREDICTION_TODAY,
    sensor_value: float = SENSOR_VALUE,
    moisture_threshold: float = MOISTURE_THRESHOLD,
    field_area_m2: float = DEFAULT_FIELD_AREA_M2,
    tank_water_liter: float = DEFAULT_TANK_WATER_LITER,
    irrigation_cycle_days: int = DEFAULT_IRRIGATION_CYCLE_DAYS,
    irrigation_season: str = DEFAULT_IRRIGATION_SEASON,
    buffer_percent_of_fc: float = DEFAULT_BUFFER_PERCENT_OF_FC,
    export_csv: bool = False,
    crop_data: dict | None = None,
    soil_data: dict | None = None,
) -> dict[str, Any]:
    weather_data = run_weather_model(
        latitude=latitude,
        longitude=longitude,
        forecast_days=forecast_days,
        export_csv=export_csv,
    )
    daily_weather_df = weather_data["day_forecast_df"]
    hourly_weather_df = weather_data["hourly_forecast_df"]

    prediction_result = soil_moisture_prediction(
        crop_name=crop_name,
        soil_texture=soil_texture,
        sowing_date=sowing_date,
        today=prediction_today,
        theta_today_sensor=sensor_value,
        crop_schedule_file=CROP_SCHEDULE_CSV if export_csv else None,
        weather_df=daily_weather_df,
        prediction_file=FUTURE_PREDICTION_CSV if export_csv else None,
        state_file=TODAY_STATE_CSV if export_csv else None,
        export_csv=export_csv,
        crop_data=crop_data,
        soil_data=soil_data,
    )
    prediction_df = pd.DataFrame(prediction_result["future_prediction"])
    crop_schedule_df = pd.DataFrame(prediction_result["crop_schedule"])

    schedule = schedule_irrigation(
        threshold=moisture_threshold,
        season=irrigation_season,
        prediction_df=prediction_df,
        daily_weather_df=daily_weather_df,
        hourly_weather_df=hourly_weather_df,
    )

    selected_date = schedule["selected_date"]
    water_result = None
    current_moisture = None
    field_capacity = None
    soil_volume = None

    if selected_date is not None:
        current_moisture = round(sensor_value * 100, 2)
        field_capacity = float(prediction_result["master_data"]["field_capacity_fraction"]) * 100
        required_moisture = moisture_threshold * 100
        soil_volume = get_current_root_zone_volume_m3(
            crop_schedule_df,
            field_area_m2=field_area_m2,
            reference_date=prediction_today,
        )

        water_calculator = IrrigationWaterRequirementCalculator(
            weather_df=daily_weather_df,
            rain_probability_column=RAIN_PROBABILITY_COLUMN,
            date_column=WEATHER_DATE_COLUMN,
        )
        water_result = water_calculator.calculate(
            current_moisture=current_moisture,
            fc=field_capacity,
            threshold_moisture=required_moisture,
            soil_volume=soil_volume,
            available_water_liter=tank_water_liter,
            irrigation_date=selected_date,
            irrigation_cycle_days=irrigation_cycle_days,
            buffer_percent_of_fc=buffer_percent_of_fc,
        )

    irrigation_required = selected_date is not None and bool(water_result and water_result["required_water_liter"] > 0)
    stop_moisture = water_result["required_theta"] if water_result else None
    return make_json_safe({
        "schemaVersion": "1.0",
        "calculationVersion": "1.0",
        "prediction": {
            "futureMoisture": prediction_result["future_prediction"],
            "cropSchedule": prediction_result["crop_schedule"],
            "dayForecast": weather_data["day_forecast"],
            "hourlyForecast": weather_data["hourly_forecast"],
            "currentMoisturePercent": current_moisture,
            "fieldCapacityPercent": field_capacity,
            "rootZoneVolumeM3": soil_volume,
        },
        "schedule": {**schedule, "stop_moisture": stop_moisture},
        "waterRequirement": water_result,
        "recommendation": {
            "irrigationRequired": irrigation_required,
            "reason": schedule.get("reasons", ["No irrigation date selected."])[0],
        },
        "execution": {
            "status": "PENDING" if irrigation_required else "SKIPPED",
            "targetMoisturePercent": stop_moisture,
        },
    })


if __name__ == "__main__":
    result = run_irrigation_pipeline()
    print(result["schedule"])
    if result["waterRequirement"] is None:
        print("Water requirement skipped because no irrigation date was selected.")
    else:
        print(result["waterRequirement"])
