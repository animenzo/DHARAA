import pandas as pd
from datetime import timedelta
from pathlib import Path


def generate_crop_schedule(params,
                           output_file=None):
    """
    Generates schedule including:

    - Kc (FAO-56)
    - Root depth Zr (FAO-56)
    - TAW

    Root Growth:
    Initial: Zr = Zr_min
    Dev:
    Zr = Zr_min + (Zr_max - Zr_min) *
         ((i - Lini)/Ldev)
    Mid+Late: Zr = Zr_max

    TAW = 1000*(FC - PWP)*Zr
    """

    start_date = pd.to_datetime(params.sowing_date)
    total_days = params.Total_days

    data = []

    for day in range(1, total_days + 1):

        current_date = start_date + timedelta(days=day - 1)

        t_ini_end = params.Lini
        t_dev_end = params.Lini + params.Ldev
        t_mid_end = params.Lini + params.Ldev + params.Lmid

        # -------- Kc --------
        if day <= t_ini_end:
            kc = params.Kc_ini

        elif day <= t_dev_end:
            frac = (day - params.Lini) / params.Ldev
            kc = params.Kc_ini + frac * (
                params.Kc_mid - params.Kc_ini
            )

        elif day <= t_mid_end:
            kc = params.Kc_mid

        else:
            frac = (day - t_mid_end) / params.Llate
            kc = params.Kc_mid - frac * (
                params.Kc_mid - params.Kc_end
            )

        # -------- Root Growth --------
        if day <= t_ini_end:
            Zr = params.Zr_min

        elif day <= t_dev_end:
            frac = (day - params.Lini) / params.Ldev
            Zr = params.Zr_min + frac * (
                params.Zr_max - params.Zr_min
            )

        else:
            Zr = params.Zr_max

        # -------- TAW --------
        TAW = 1000 * (params.FC - params.PWP) * Zr

        data.append([
            current_date.date(),
            day,
            round(kc, 4),
            round(Zr, 4),
            round(TAW, 2),
            params.crop_name,
            params.soil_texture,
            params.sowing_date
        ])

    df = pd.DataFrame(data, columns=[
        "Date",
        "DayAfterSowing",
        "Kc",
        "RootDepth_m",
        "TAW_mm",
        "CropName",
        "SoilTexture",
        "SowingDate"
    ])

    if output_file is not None:
        output_path = Path(output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(output_path, index=False)
    return df
