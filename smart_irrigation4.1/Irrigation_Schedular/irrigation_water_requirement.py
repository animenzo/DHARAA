"""
===============================================================================
DHARAA - Irrigation Water Requirement Decision Module
===============================================================================

Purpose:
--------
Determines the optimal irrigation target moisture and required water for a
single irrigation event.

Features:
---------
1. FC + Buffer irrigation strategy
2. Water availability check (120% rule)
3. Future rain adjustment
4. Dynamic reduction below FC when rain is expected
5. Safety moisture limit protection
6. Water sufficiency validation
7. Uses existing water calculation function

Author: DHARAA Project
===============================================================================
"""

from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict

import pandas as pd

from Water_Model.waterUses_Estimator import calculate_irrigation_requirement


BASE_DIR = Path(__file__).resolve().parent


class IrrigationWaterRequirementCalculator:

    def __init__(
        self,
        weather_csv_path: str | None = None,
        weather_df: pd.DataFrame | None = None,
        rain_probability_column: str = "RainProbability",
        date_column: str = "Date"
    ):
        self.weather_csv_path = weather_csv_path
        self.weather_df = weather_df
        self.rain_probability_column = rain_probability_column
        self.date_column = date_column

    # -------------------------------------------------------------------------
    # Existing Water Requirement Function
    # -------------------------------------------------------------------------

    # @staticmethod
    # def calculate_irrigation_requirment(
    #     theta_target: float,
    #     theta_current: float,
    #     soil_volume: float
    # ) -> float:
    #     """
    #     Calculates irrigation water requirement.

    #     Parameters
    #     ----------
    #     theta_target : float
    #         Target moisture (0-1)

    #     theta_current : float
    #         Current moisture (0-1)

    #     soil_volume : float
    #         Root zone soil volume (m³)

    #     Returns
    #     -------
    #     float
    #         Water required (liters)
    #     """

    #     delta_theta = max(0.0, theta_target - theta_current)

    #     water_required_liter = (
    #         delta_theta
    #         * soil_volume
    #         * 1000
    #     )

    #     return round(water_required_liter, 2)

    # -------------------------------------------------------------------------
    # Rain Probability Extraction
    # -------------------------------------------------------------------------

    def _get_future_rain_probability(
        self,
        irrigation_date: str,
        irrigation_cycle_days: int
    ) -> float:
        """
        Finds maximum rain probability after irrigation date.

        Window:
        min(4 days, irrigation_cycle_days)
        """

        if self.weather_df is None:
            if self.weather_csv_path is None:
                raise ValueError("weather_df is required when weather_csv_path is not provided.")
            weather = pd.read_csv(self.weather_csv_path)
        else:
            weather = self.weather_df.copy()

        weather[self.date_column] = pd.to_datetime(
            weather[self.date_column]
        ).dt.date

        irrigation_date = datetime.strptime(
            irrigation_date,
            "%Y-%m-%d"
        ).date()

        window_days = min(
            4,
            irrigation_cycle_days
        )

        start_date = irrigation_date + timedelta(days=1)
        end_date = irrigation_date + timedelta(days=window_days)

        future_weather = weather[
            (weather[self.date_column] >= start_date) &
            (weather[self.date_column] <= end_date)
        ]

        if future_weather.empty:
            return 0.0

        return float(
            future_weather[self.rain_probability_column].max()
        )

    # -------------------------------------------------------------------------
    # Main Calculation
    # -------------------------------------------------------------------------

    def calculate(
        self,
        current_moisture: float,
        fc: float,
        threshold_moisture: float,
        soil_volume: float,
        available_water_liter: float,
        irrigation_date: str,
        irrigation_cycle_days: int,
        buffer_percent_of_fc: float = 0.20
    ) -> Dict:

        reasons = []

        # ---------------------------------------------------------------------
        # STEP 1
        # FC + BUFFER
        # ---------------------------------------------------------------------

        buffer_value = fc * buffer_percent_of_fc

        target_moisture = fc + buffer_value

        reasons.append(
            f"Initial target = FC + buffer ({buffer_percent_of_fc*100:.0f}% FC)"
        )

        # ---------------------------------------------------------------------
        # STEP 2
        # WATER REQUIREMENT WITH BUFFER
        # ---------------------------------------------------------------------

        water_required = calculate_irrigation_requirement(
            theta_target=target_moisture / 100,
            theta_current=current_moisture / 100,
            soil_volume=soil_volume
        )

        # ---------------------------------------------------------------------
        # STEP 3
        # 120% WATER AVAILABILITY RULE
        # ---------------------------------------------------------------------

        if available_water_liter < (water_required * 1.20):

            target_moisture = fc

            reasons.append(
                "Buffer removed due to insufficient water "
                "(120% rule failed)"
            )

            water_required = calculate_irrigation_requirement(
                theta_target=target_moisture / 100,
                theta_current=current_moisture / 100,
                soil_volume=soil_volume
            )

        # ---------------------------------------------------------------------
        # STEP 4
        # FUTURE RAIN CHECK
        # ---------------------------------------------------------------------

        rain_probability = self._get_future_rain_probability(
            irrigation_date=irrigation_date,
            irrigation_cycle_days=irrigation_cycle_days
        )

        # ---------------------------------------------------------------------
        # STEP 5
        # RAIN ADJUSTMENT
        # ---------------------------------------------------------------------

        if rain_probability > 60:

            reasons.append(
                f"Future rain probability detected ({rain_probability:.0f}%)"
            )

            # Remove buffer completely
            target_moisture = fc

            # Safety target
            safety_target = (
                threshold_moisture +
                0.5 * (fc - threshold_moisture)
            )

            # Rain factor
            rain_factor = (
                (rain_probability - 60)
                / 40
            )

            rain_factor = max(
                0.0,
                min(1.0, rain_factor)
            )

            target_moisture = (
                fc -
                (
                    (fc - safety_target)
                    * rain_factor
                )
            )

            reasons.append(
                "Buffer removed and irrigation reduced due to future rain"
            )

        # ---------------------------------------------------------------------
        # STEP 6
        # CALCULATE WATER AGAIN
        # ---------------------------------------------------------------------

        water_required = calculate_irrigation_requirement(
            theta_target=target_moisture / 100,
            theta_current=current_moisture / 100,
            soil_volume=soil_volume
        )

        # ---------------------------------------------------------------------
        # STEP 7
        # FINAL WATER SUFFICIENCY CHECK
        # ---------------------------------------------------------------------

        safety_target = (
            threshold_moisture +
            0.5 * (fc - threshold_moisture)
        )

        if available_water_liter < water_required:

            reasons.append(
                "Water insufficient. Reducing target moisture."
            )

            while (
                available_water_liter < water_required
                and target_moisture > safety_target
            ):

                target_moisture -= 0.5

                water_required = (
                    calculate_irrigation_requirement(
                        theta_target=target_moisture / 100,
                        theta_current=current_moisture / 100,
                        soil_volume=soil_volume
                    )
                )

            water_sufficient = (
                available_water_liter >= water_required
            )

        else:
            water_sufficient = True

        # ---------------------------------------------------------------------
        # STEP 8
        # IRRIGATION PERCENT
        # ---------------------------------------------------------------------

        irrigation_percent = max(
            0.0,
            target_moisture - current_moisture
        )

        # ---------------------------------------------------------------------
        # OUTPUT
        # ---------------------------------------------------------------------

        return {
            "required_theta": round(target_moisture, 2),
            "irrigation_percent": round(irrigation_percent, 2),
            "required_water_liter": round(water_required, 2),
            "water_sufficient": water_sufficient,
            "future_rain_probability": round(rain_probability, 2),
            "reason": " | ".join(reasons)
        }


# =============================================================================
# Example Usage
# =============================================================================

if __name__ == "__main__":

    calculator = IrrigationWaterRequirementCalculator(
        weather_csv_path=BASE_DIR / "weather_model" / "exports" / "weather_10day_forecast.csv",
        rain_probability_column="Rain_Prob",
        date_column="date",
    )

    result = calculator.calculate(
        current_moisture=20,
        fc=30,
        threshold_moisture=20,
        soil_volume=12.5,
        available_water_liter=200,
        irrigation_date="2026-06-25",
        irrigation_cycle_days=4,
        buffer_percent_of_fc=0.20
    )

    print(result)
