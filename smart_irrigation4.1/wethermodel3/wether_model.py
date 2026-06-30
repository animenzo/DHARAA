import os
from pathlib import Path

import requests
import pandas as pd

# --- Configuration ---
DEFAULT_LATITUDE = 24.5887106
DEFAULT_LONGITUDE = 73.734616
DEFAULT_FORECAST_DAYS = 14
BASE_DIR = Path(__file__).resolve().parents[1]
EXPORT_DIR = BASE_DIR / "weather_model" / "exports"
BASE_URL = "https://api.open-meteo.com/v1/forecast"

def fetch_weather_data(lat, lon, days):
    """Fetches hourly forecast data including rainfall probability from Open-Meteo."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": [
            "temperature_2m",
            "wind_speed_10m",
            "precipitation",
            "precipitation_probability", 
            "et0_fao_evapotranspiration",
            "weather_code"
        ],
        "forecast_days": days,
        "timezone": "auto"
    }

    print(f"Fetching {days}-day forecast from Open-Meteo...")
    response = requests.get(BASE_URL, params=params)
    response.raise_for_status() 

    data = response.json()

    df = pd.DataFrame({
        "time": pd.to_datetime(data["hourly"]["time"]),
        "temperature": data["hourly"]["temperature_2m"],
        "wind10m": data["hourly"]["wind_speed_10m"],
        "rainfall": data["hourly"]["precipitation"],
        "rain_prob_hourly": data["hourly"]["precipitation_probability"],
        "et0_hourly": data["hourly"]["et0_fao_evapotranspiration"],
        "weather_code": data["hourly"]["weather_code"]
    })
    
    return df

def process_daily_data(hourly_df):
    """Aggregates hourly data into daily summaries."""
    print("Processing daily aggregations...")
    
    hourly_df["date"] = hourly_df["time"].dt.date

    daily_df = hourly_df.groupby("date").agg(
        Tmax=("temperature", "max"),
        Tmin=("temperature", "min"),
        T_mean=("temperature", "mean"),
        wind10m=("wind10m", "mean"), 
        Rain_Prob=("rain_prob_hourly", "max"), 
        ET0=("et0_hourly", "sum"),
        WeatherCode=("weather_code", "max")
    ).reset_index()

    print("Applying wind physics conversions...")
    # Calculate 2m wind for agricultural standard
    daily_df["u2"] = daily_df["wind10m"] * 0.748

    daily_df["Status"] = "Forecast"

    # Reorder columns for the final daily summary
    final_df = daily_df[["date", "Tmin", "Tmax", "T_mean", "ET0", "u2", "Rain_Prob", "WeatherCode", "Status"]].copy()

    # Round numeric columns for clean output
    numeric_cols = ["Tmin", "Tmax", "T_mean", "ET0", "u2"]
    final_df[numeric_cols] = final_df[numeric_cols].round(2)

    return final_df

def build_forecast_payload(daily_df, hourly_df):
    """Builds the processed daily and hourly forecast tables in memory."""
    hourly_combined_df = hourly_df.copy()
    
    hourly_combined_df["Date"] = hourly_combined_df["time"].dt.date
    hourly_combined_df["Time"] = hourly_combined_df["time"].dt.time
    hourly_combined_df["wind10m"] = hourly_combined_df["wind10m"].round(2)
    
    hourly_combined_df = hourly_combined_df[["Date", "Time", "temperature", "wind10m", "rainfall", "rain_prob_hourly"]]
    
    hourly_combined_df.rename(columns={
        "wind10m": "Wind_10m_kmh",
        "rainfall": "Rainfall_mm", 
        "rain_prob_hourly": "Rain_Probability_%"
    }, inplace=True)
    
    return {
        "day_forecast": daily_df.to_dict(orient="records"),
        "hourly_forecast": hourly_combined_df.to_dict(orient="records"),
        "day_forecast_df": daily_df,
        "hourly_forecast_df": hourly_combined_df,
    }


def export_forecast(daily_df, hourly_df):
    """Exports the processed dataframes to static CSV file names for debugging."""
    print("Exporting CSV files...")
    os.makedirs(EXPORT_DIR, exist_ok=True)

    daily_file_path = f"{EXPORT_DIR}/weather_10day_forecast.csv"
    daily_df.to_csv(daily_file_path, index=False)
    print(f" -> Daily summary saved to: {daily_file_path}")

    hourly_combined_df = build_forecast_payload(daily_df, hourly_df)["hourly_forecast_df"]
    hourly_combined_path = f"{EXPORT_DIR}/hourly_weather_10day.csv"
    hourly_combined_df.to_csv(hourly_combined_path, index=False)
    print(f" -> Combined hourly data saved to: {hourly_combined_path}")

    return build_forecast_payload(daily_df, hourly_df)

def main(
    latitude=DEFAULT_LATITUDE,
    longitude=DEFAULT_LONGITUDE,
    forecast_days=DEFAULT_FORECAST_DAYS,
    export_csv=False,
):
    """Main execution block."""
    try:
        # 1. Fetch the data using dynamic location and forecast days
        hourly_data = fetch_weather_data(latitude, longitude, days=forecast_days)
        
        # 2. Process and aggregate the data
        daily_data = process_daily_data(hourly_data)
        
        print(f"\n--- {forecast_days} Day Forecast Summary ---")
        print(daily_data[["date", "T_mean", "ET0", "Rain_Prob"]])
        print("-" * 35, "\n")
        
        forecast_result = (
            export_forecast(daily_data, hourly_data)
            if export_csv
            else build_forecast_payload(daily_data, hourly_data)
        )
        
        print("Weather pipeline completed successfully!")
        return forecast_result
        
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from API: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
