from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd
import torch

try:
    from .ai_module.model import ResidualNN
    from .ai_module.trainer import OnlineTrainer
    from .config.parameters import Parameters
    from .physics_engine.et0 import calculate_et0
    from .physics_engine.soil_balance import update_soil_moisture
    from .utils.crop_schedule_generator import generate_crop_schedule
except ImportError:
    import sys

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

    from soil_pred.ai_module.model import ResidualNN
    from soil_pred.ai_module.trainer import OnlineTrainer
    from soil_pred.config.parameters import Parameters
    from soil_pred.physics_engine.et0 import calculate_et0
    from soil_pred.physics_engine.soil_balance import update_soil_moisture
    from soil_pred.utils.crop_schedule_generator import generate_crop_schedule


BASE_DIR = Path(__file__).resolve().parents[1]
MOISTURE_PREDICTION_DATASET_DIR = BASE_DIR / "Moisture_Prediction_Dataset"


def _as_date(value):
    if value is None:
        return date.today()
    return pd.to_datetime(value).date()


def _update_today_state(
    prediction_df: pd.DataFrame,
    state_file: Path | None,
    today: date,
    theta_today_sensor: float,
) -> pd.DataFrame | None:
    df_future = prediction_df.copy()
    if len(df_future) < 2:
        print("Not enough prediction data. Skipping today_state update.")
        return None

    tomorrow_prediction = df_future.iloc[1]
    das, et0, etc, kc, root_depth, total_evaporation, physics_value = tomorrow_prediction[
        [
            "DayAfterSowing",
            "ET0",
            "ETc",
            "Kc",
            "RootDepth_m",
            "total_evoporation",
            "Physics_Moisture",
        ]
    ]

    error_value = theta_today_sensor - physics_value
    state_data = {
        "Date": today,
        "Timestamp": datetime.now(),
        "DayAfterSowing": das,
        "ET0": round(et0, 3),
        "Kc": round(kc, 3),
        "ETc": round(etc, 3),
        "RootDepth_m": round(root_depth, 3),
        "total_evoporation": round(total_evaporation, 3),
        "Physics_Moisture": round(physics_value, 4),
        "Sensor_Moisture": round(theta_today_sensor, 4),
        "Error": round(error_value, 5),
    }

    state_df = pd.DataFrame([state_data])

    if state_file is not None:
        state_file.parent.mkdir(parents=True, exist_ok=True)
        if state_file.exists():
            state_df.to_csv(state_file, mode="a", header=False, index=False)
        else:
            state_df.to_csv(state_file, index=False)
        print(f"{state_file.name} updated successfully.")
    return state_df


def soil_moisture_prediction(
    crop_name: str = "Maize",
    soil_texture: str = "Loam",
    sowing_date: str = "2026-05-01",
    today=None,
    theta_today_sensor: float = 0.2434,
    crop_schedule_file: str | Path | None = None,
    weather_file: str | Path | None = None,
    weather_df: pd.DataFrame | None = None,
    prediction_file: str | Path | None = None,
    state_file: str | Path | None = None,
    update_state: bool = True,
    export_csv: bool = False,
    show_plot: bool = False,
    crop_data: dict | None = None,
    soil_data: dict | None = None,
) -> pd.DataFrame:
    today_date = _as_date(today)
    today_ts = pd.Timestamp(today_date)

    crop_schedule_path = Path(crop_schedule_file) if crop_schedule_file else None
    weather_path = Path(weather_file) if weather_file else None
    prediction_path = Path(prediction_file) if prediction_file else None
    state_path = Path(state_file) if state_file else None

    params = Parameters(crop_name, soil_texture, sowing_date, crop_data, soil_data)

    regenerate = True
    if crop_schedule_path is not None and crop_schedule_path.exists():
        existing = pd.read_csv(crop_schedule_path)
        if not existing.empty and (
            existing["CropName"].iloc[0] == crop_name
            and existing["SoilTexture"].iloc[0] == soil_texture
            and existing["SowingDate"].iloc[0] == sowing_date
        ):
            regenerate = False
    schedule_df = None

    if regenerate:
        
        print("Crop schedule regenerating.")
        schedule_df = generate_crop_schedule(
            params,
            output_file=crop_schedule_path if export_csv else None,
        )
        schedule = schedule_df.copy()
    else:
        schedule = pd.read_csv(crop_schedule_path)
        schedule_df = schedule.copy()
    schedule["Date"] = pd.to_datetime(schedule["Date"])

    future_dates = [today_ts + timedelta(days=i) for i in range(10)]
    future_schedule = schedule[schedule["Date"].isin(future_dates)].copy()
    if future_schedule.empty:
        raise ValueError("Today's date is outside crop growth period.")

    if weather_df is None:
        if weather_path is None:
            raise ValueError("weather_df is required when weather_file is not provided.")
        weather_df = pd.read_csv(weather_path)

    weather_df = weather_df.copy()
    weather_df["date"] = pd.to_datetime(weather_df["date"])
    weather_df.set_index("date", inplace=True)

    model = ResidualNN(input_size=6)
    trainer = OnlineTrainer(model)

    theta = theta_today_sensor
    log_data = [
        [
            today_date,
            0,
            None,
            None,
            None,
            None,
            None,
            round(theta_today_sensor, 4),
        ]
    ]

    last_etc = None

    for _, row in future_schedule.iterrows():
        sim_date = row["Date"]
        day_number = row["DayAfterSowing"]
        kc = row["Kc"]
        root_depth = row["RootDepth_m"]

        if sim_date in weather_df.index:
            et0 = weather_df.loc[sim_date, "ET0"]
        else:
            print(f"Warning: {sim_date.date()} not found in CSV. Using calculated ET0.")
            et0 = calculate_et0(
                params.Tmean,
                params.Tmin,
                params.Tmax,
                params.RH,
                params.u2,
                params.Rn,
            )

        etc = kc * et0
        theta_physics, total_evaporation = update_soil_moisture(
            theta,
            etc,
            root_depth,
            params.FC,
            params.PWP,
        )

        if sim_date.date() != today_date:
            log_data.append(
                [
                    sim_date.date(),
                    day_number,
                    round(et0, 3),
                    round(etc, 3),
                    round(kc, 3),
                    round(root_depth, 3),
                    round(total_evaporation, 5),
                    round(theta_physics, 4),
                ]
            )

        print(f"Date: {sim_date.date()} | Day {day_number}")
        print("Kc:", round(kc, 3))
        print("Root Depth:", round(root_depth, 3))
        print("ET0:", round(et0, 3))
        print("ETc:", round(etc, 3))
        print("Total_Evoporation:", round(total_evaporation, 3))
        print("Physics Moisture:", round(theta_physics, 4))
        print("Irrigation (mm): 0")
        print("-----------------------------")

        theta = theta_physics
        last_etc = etc

    if last_etc is not None:
        theta_sensor = theta + torch.randn(1).item() * 0.002
        error = theta_sensor - theta

        inputs = torch.tensor(
            [
                params.Tmean,
                params.RH,
                params.u2,
                params.Rn,
                theta,
                last_etc,
            ],
            dtype=torch.float32,
        )

        error_tensor = torch.tensor([error], dtype=torch.float32)
        trainer.train_step(inputs, error_tensor)

        residual = trainer.predict(inputs).item()
        residual = max(min(residual, 0.05), -0.05)

        theta_ai_final = theta + residual
        theta_ai_final = min(theta_ai_final, params.FC)
        theta_ai_final = max(theta_ai_final, params.PWP)

        print("\nAI Final Correction (after 10 days):")
        print("Physics Final Moisture:", round(theta, 4))
        print("AI Corrected Final Moisture:", round(theta_ai_final, 4))

    df = pd.DataFrame(
        log_data,
        columns=[
            "Date",
            "DayAfterSowing",
            "ET0",
            "ETc",
            "Kc",
            "RootDepth_m",
            "total_evoporation",
            "Physics_Moisture",
        ],
    )
    
    today_state_df = None
    if update_state:
        today_state_df = _update_today_state(
            df,
            state_path if export_csv else None,
            today_date,
            theta_today_sensor,
        )

    if export_csv and prediction_path is not None:
        prediction_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(prediction_path, index=False)


    if show_plot:
        import matplotlib.pyplot as plt

        plt.figure()
        plt.plot(df["Date"], df["Physics_Moisture"])
        plt.xlabel("Date")
        plt.ylabel("Soil Moisture")
        plt.title("Next 10 Days Soil Moisture Prediction (Physics)")
        plt.xticks(rotation=45)
        plt.show()

    return {
        "future_prediction":
            df.to_dict(
                 orient="records"
            ),

        "crop_schedule":
            schedule_df.to_dict(
                orient="records"
            ),
        "today_state":
            [] if today_state_df is None else today_state_df.to_dict(orient="records"),
        "master_data": {
            "field_capacity_fraction": params.FC,
            "permanent_wilting_point_fraction": params.PWP,
            "crop": params.crop_name,
            "soil_texture": params.soil_texture,
            "source": "mongodb",
        },
    }


if __name__ == "__main__":
    soil_moisture_prediction(show_plot=True)
