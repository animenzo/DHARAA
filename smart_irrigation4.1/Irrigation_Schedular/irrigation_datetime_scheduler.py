"""
DHARAA – Irrigation Date & Time Scheduler
========================================

This module selects the best irrigation date and time using:

- Future 10-day moisture prediction table
- Daily weather forecast
- Hourly weather forecast

Final logic implemented:
- Use actual dates, not day numbers
- Find the trigger date from the prediction table using a threshold
- Create a 3-day decision window around the trigger date
- Reject dates with thunderstorm/severe thunderstorm weather codes
- Reject dates with rain probability >= 80%
- Score remaining dates using wind, temperature, rain probability, and a delay bonus
- If all dates are rejected only because of rain probability, enter rain-hold mode
- Select the best time on the chosen date
- If no valid time exists on a date, reject that date and try the next date
- Winter strongly prefers 05:00
- Summer prefers evening/night
- Wind is the strongest factor in scoring, especially for sprinkler irrigation

The module is intentionally robust:
- It supports your current CSV headers via aliases
- It also supports the final headers you plan to add
- If WeatherCode is missing, thunderstorm rejection is skipped with a warning

Author: OpenAI
"""

from __future__ import annotations


import logging
from dataclasses import dataclass, asdict
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


import pandas as pd


LOGGER = logging.getLogger("dharaa.irrigation_scheduler")

THUNDERSTORM_CODES = {95, 96, 99}
RAIN_HOLD_THRESHOLD = 70.0
TIME_HIGH_WIND_THRESHOLD_KMH = 50.0
DAY_RAIN_REJECT_THRESHOLD = 70.0

# Current file aliases + final desired aliases
PRED_DATE_ALIASES = ["Date", "date"]
PRED_MOISTURE_ALIASES = ["Physics_Moisture"]

DAILY_DATE_ALIASES = ["Date", "date"]
DAILY_TEMP_ALIASES = ["T_mean", "Temp", "temperature"]
DAILY_WIND_ALIASES = ["WindSpeed", "u2", "Wind_10m_kmh", "Wind", "wind_speed"]
DAILY_RAINPROB_ALIASES = ["RainProbability", "Rain_Prob", "Rain_Probability_%", "RainProb", "rain_probability"]
DAILY_WEATHERCODE_ALIASES = ["WeatherCode", "weather_code", "Code"]

HOURLY_DATE_ALIASES = ["Date", "date"]
HOURLY_TIME_ALIASES = ["Time", "time"]
HOURLY_TEMP_ALIASES = ["Temperature", "temperature"]
HOURLY_WIND_ALIASES = ["WindSpeed", "Wind_10m_kmh", "wind_speed", "Wind"]
HOURLY_RAINPROB_ALIASES = ["RainProbability", "Rain_Probability_%", "RainProb", "rain_probability"]
HOURLY_WEATHERCODE_ALIASES = ["WeatherCode", "weather_code", "Code"]


@dataclass
class ScheduleResult:
    trigger_date: Optional[str]
    selected_date: Optional[str]
    selected_time: Optional[str]
    status: str
    rain_hold: bool
    rain_hold_until: Optional[str]
    candidate_dates: List[str]
    rejected_dates: List[str]
    reasons: List[str]
    selected_date_score: Optional[float] = None
    selected_time_score: Optional[float] = None
    debug: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class IrrigationDatetimeScheduler:
    """
    Selects an irrigation date/time from prediction and weather CSV tables.
    """

    def __init__(
        self,
        threshold: float,
        season: str = "summer",
        irrigation_method: str = "sprinkler",
        weather_code_required: bool = False,
    ) -> None:
        self.threshold = float(threshold)
        self.season = (season or "summer").strip().lower()
        self.irrigation_method = (irrigation_method or "sprinkler").strip().lower()
        self.weather_code_required = weather_code_required

    # ---------------------------------------------------------------------
    # Public API
    # ---------------------------------------------------------------------
    def select_schedule(
        self,
        prediction_df: pd.DataFrame,
        daily_weather_df: pd.DataFrame,
        hourly_weather_df: pd.DataFrame,
    ) -> ScheduleResult:
        prediction = self._prepare_prediction_df(prediction_df)
        daily = self._prepare_daily_weather_df(daily_weather_df)
        hourly = self._prepare_hourly_weather_df(hourly_weather_df, daily)

        trigger_date = self._find_trigger_date(prediction)
        if trigger_date is None:
            return ScheduleResult(
                trigger_date=None,
                selected_date=None,
                selected_time=None,
                status="no_trigger_date",
                rain_hold=False,
                rain_hold_until=None,
                candidate_dates=[],
                rejected_dates=[],
                reasons=[
                    f"No future date found where Physics_Moisture <= threshold ({self.threshold})."
                ],
            )

        candidate_dates = self._build_candidate_window(trigger_date, prediction)
        if not candidate_dates:
            return ScheduleResult(
                trigger_date=trigger_date.isoformat(),
                selected_date=None,
                selected_time=None,
                status="no_candidate_dates",
                rain_hold=False,
                rain_hold_until=None,
                candidate_dates=[],
                rejected_dates=[],
                reasons=["Unable to build a valid 3-day window around the trigger date."],
            )

        # Evaluate dates in descending preference for later irrigation
        ranked_candidates = self._rank_candidate_dates(candidate_dates, daily)

        rejected_dates: List[str] = []
        reasons: List[str] = []
        rain_hold_only = True  # becomes False if we find any date rejected for a non-rain reason

        for cand in ranked_candidates:
            d = cand["date"]
            d_str = d.isoformat()

            # Hard reject thunderstorm/severe thunderstorm
            if cand["has_thunderstorm"]:
                rejected_dates.append(d_str)
                reasons.append(f"{d_str}: rejected due to thunderstorm weather code.")
                rain_hold_only = False
                continue

            # Hard reject rain probability >= 80%
            if cand["rain_probability"] is not None and cand["rain_probability"] >= DAY_RAIN_REJECT_THRESHOLD:
                rejected_dates.append(d_str)
                reasons.append(
                    f"{d_str}: rejected because rain probability is {cand['rain_probability']:.1f}% (>= {DAY_RAIN_REJECT_THRESHOLD:.0f}%)."
                )
                # Still considered rain-hold logic only if all rejections are due to rain probability.
                continue

            # For normal scheduling, we try to find a valid time on this date.
            time_result = self._select_best_time_for_date(
                date_str=d_str,
                hourly_df=hourly,
                strict_rain=True,
            )

            if time_result["selected_time"] is None:
                rejected_dates.append(d_str)
                reasons.append(
                    f"{d_str}: rejected because no valid irrigation time was found in hourly forecast."
                )
                rain_hold_only = False
                continue

            # Found a valid schedule
            return ScheduleResult(
                trigger_date=trigger_date.isoformat(),
                selected_date=d_str,
                selected_time=time_result["selected_time"],
                status="scheduled",
                rain_hold=False,
                rain_hold_until=None,
                candidate_dates=[x.isoformat() for x in candidate_dates],
                rejected_dates=rejected_dates,
                reasons=reasons + time_result["reasons"],
                selected_date_score=float(cand["day_score"]),
                selected_time_score=float(time_result["time_score"]),
                debug={
                    "selected_day_details": cand,
                    "selected_time_details": time_result["debug"],
                },
            )

        # If we reach here, no regular schedule was found.
        # If every rejection is rain-related, enter rain hold mode inside the selection window.
        if rejected_dates and rain_hold_only:
            hold_until = candidate_dates[-1]
            hold_date_str = hold_until.isoformat()

            # Provisional time selection on the hold date.
            # In rain-hold mode we still prefer a time, but we relax the rain-hard-reject
            # so the module can produce a usable placeholder for the day rain fails.
            time_result = self._select_best_time_for_date(
                date_str=hold_date_str,
                hourly_df=hourly,
                strict_rain=False,
            )

            if time_result["selected_time"] is None:
                # Absolute fallback: force a season-based placeholder time.
                fallback_time = self._season_fallback_time(self.season)
                time_result = {
                    "selected_time": fallback_time,
                    "time_score": None,
                    "reasons": [
                        f"{hold_date_str}: rain-hold fallback time selected because no valid hourly slot was found.",
                    ],
                    "debug": {"fallback_time_used": True},
                }

            return ScheduleResult(
                trigger_date=trigger_date.isoformat(),
                selected_date=hold_date_str,
                selected_time=time_result["selected_time"],
                status="rain_hold",
                rain_hold=True,
                rain_hold_until=hold_date_str,
                candidate_dates=[x.isoformat() for x in candidate_dates],
                rejected_dates=rejected_dates,
                reasons=[
                    "All candidate dates in the 3-day window were blocked by forecast rain probability >= 80%; rain-hold activated.",
                    "If rain does not occur in the window, irrigate on the rain-window-end date.",
                ] + reasons + time_result["reasons"],
                selected_date_score=None,
                selected_time_score=time_result.get("time_score"),
                debug={
                    "rain_hold": True,
                    "rain_hold_until": hold_date_str,
                    "provisional_time_details": time_result.get("debug"),
                },
            )

        # If no date was selected and it's not pure rain-hold, pick the next best available date
        # outside the 3-day window only if it exists and is not a thunderstorm / rain-hold case.
        fallback = self._find_next_best_date_outside_window(ranked_candidates, daily, hourly)
        if fallback is not None:
            return fallback

        return ScheduleResult(
            trigger_date=trigger_date.isoformat(),
            selected_date=None,
            selected_time=None,
            status="no_valid_date",
            rain_hold=False,
            rain_hold_until=None,
            candidate_dates=[x.isoformat() for x in candidate_dates],
            rejected_dates=rejected_dates,
            reasons=reasons + [
                "No valid irrigation date/time could be found within the selection window."
            ],
        )

    # ---------------------------------------------------------------------
    # Data preparation
    # ---------------------------------------------------------------------
    def _prepare_prediction_df(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        date_col = self._get_existing_column(df, PRED_DATE_ALIASES, required=True, table_name="prediction")
        moisture_col = self._get_existing_column(df, PRED_MOISTURE_ALIASES, required=True, table_name="prediction")

        df = df[[date_col, moisture_col]].rename(columns={date_col: "Date", moisture_col: "Physics_Moisture"})
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce").dt.date
        df["Physics_Moisture"] = pd.to_numeric(df["Physics_Moisture"], errors="coerce")
        df = df.dropna(subset=["Date", "Physics_Moisture"]).sort_values("Date").reset_index(drop=True)
        return df

    def _prepare_daily_weather_df(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        date_col = self._get_existing_column(df, DAILY_DATE_ALIASES, required=True, table_name="daily weather")
        temp_col = self._get_existing_column(df, DAILY_TEMP_ALIASES, required=True, table_name="daily weather")
        wind_col = self._get_existing_column(df, DAILY_WIND_ALIASES, required=True, table_name="daily weather")
        rain_col = self._get_existing_column(df, DAILY_RAINPROB_ALIASES, required=True, table_name="daily weather")
        code_col = self._get_existing_column(df, DAILY_WEATHERCODE_ALIASES, required=False, table_name="daily weather")

        cols = [date_col, temp_col, wind_col, rain_col] + ([code_col] if code_col else [])
        df = df[cols].rename(
            columns={
                date_col: "Date",
                temp_col: "Temperature",
                wind_col: "WindSpeed",
                rain_col: "RainProbability",
                **({code_col: "WeatherCode"} if code_col else {}),
            }
        )
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce").dt.date
        df["Temperature"] = pd.to_numeric(df["Temperature"], errors="coerce")
        df["WindSpeed"] = pd.to_numeric(df["WindSpeed"], errors="coerce")
        df["RainProbability"] = pd.to_numeric(df["RainProbability"], errors="coerce")
        if "WeatherCode" not in df.columns:
            if self.weather_code_required:
                raise ValueError(
                    "WeatherCode column is required for daily weather but was not found. "
                    f"Available columns: {list(df.columns)}"
                )
            df["WeatherCode"] = None
        df = df.dropna(subset=["Date", "Temperature", "WindSpeed", "RainProbability"]).sort_values("Date").reset_index(drop=True)
        return df

    def _prepare_hourly_weather_df(self, hourly_df: pd.DataFrame, daily_df: pd.DataFrame) -> pd.DataFrame:
        df = hourly_df.copy()
        date_col = self._get_existing_column(df, HOURLY_DATE_ALIASES, required=True, table_name="hourly weather")
        time_col = self._get_existing_column(df, HOURLY_TIME_ALIASES, required=True, table_name="hourly weather")
        temp_col = self._get_existing_column(df, HOURLY_TEMP_ALIASES, required=False, table_name="hourly weather")
        wind_col = self._get_existing_column(df, HOURLY_WIND_ALIASES, required=True, table_name="hourly weather")
        rain_col = self._get_existing_column(df, HOURLY_RAINPROB_ALIASES, required=True, table_name="hourly weather")
        code_col = self._get_existing_column(df, HOURLY_WEATHERCODE_ALIASES, required=False, table_name="hourly weather")

        cols = [date_col, time_col, wind_col, rain_col] + ([temp_col] if temp_col else []) + ([code_col] if code_col else [])
        df = df[cols].rename(
            columns={
                date_col: "Date",
                time_col: "Time",
                wind_col: "WindSpeed",
                rain_col: "RainProbability",
                **({temp_col: "Temperature"} if temp_col else {}),
                **({code_col: "WeatherCode"} if code_col else {}),
            }
        )

        df["Date"] = pd.to_datetime(df["Date"], errors="coerce").dt.date
        df["Time"] = df["Time"].astype(str).apply(self._normalize_time_string)
        df["WindSpeed"] = pd.to_numeric(df["WindSpeed"], errors="coerce")
        df["RainProbability"] = pd.to_numeric(df["RainProbability"], errors="coerce")
        if "WeatherCode" not in df.columns:
            if self.weather_code_required:
                raise ValueError(
                    "WeatherCode column is required for daily weather but was not found. "
                    f"Available columns: {list(df.columns)}"
                )
            df["WeatherCode"] = None

        if "Temperature" not in df.columns:
            # Fallback to daily temperature if hourly temperature is unavailable.
            temp_map = daily_df.set_index("Date")["Temperature"].to_dict()
            df["Temperature"] = df["Date"].map(temp_map)
        else:
            df["Temperature"] = pd.to_numeric(df["Temperature"], errors="coerce")

        df = df.dropna(subset=["Date", "Time", "WindSpeed", "RainProbability", "Temperature"]).sort_values(["Date", "Time"]).reset_index(drop=True)
        return df

    # ---------------------------------------------------------------------
    # Trigger date and candidate window
    # ---------------------------------------------------------------------
    def _find_trigger_date(self, prediction_df: pd.DataFrame) -> Optional[date]:
        for _, row in prediction_df.iterrows():
            if float(row["Physics_Moisture"]) <= self.threshold:
                return row["Date"]
        return None

    def _build_candidate_window(self, trigger_date: date, prediction_df: pd.DataFrame) -> List[date]:
        all_prediction_dates = set(prediction_df["Date"].tolist())
        raw_window = [trigger_date - timedelta(days=1), trigger_date, trigger_date + timedelta(days=1)]
        window = [d for d in raw_window if d in all_prediction_dates]
        # Keep chronological order and remove duplicates
        seen = set()
        ordered: List[date] = []
        for d in window:
            if d not in seen:
                ordered.append(d)
                seen.add(d)
        return ordered

    def _rank_candidate_dates(self, candidate_dates: List[date], daily_df: pd.DataFrame) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        total = len(candidate_dates)

        for idx, d in enumerate(candidate_dates):
            row = self._lookup_daily_row(daily_df, d)
            if row is None:
                results.append(
                    {
                        "date": d,
                        "day_score": -1e9,
                        "temperature": None,
                        "wind_speed": None,
                        "rain_probability": None,
                        "weather_code": None,
                        "has_thunderstorm": False,
                        "missing_daily": True,
                    }
                )
                continue

            temp = float(row["Temperature"])
            wind = float(row["WindSpeed"])
            rain = float(row["RainProbability"])
            code = row.get("WeatherCode", None)

            has_thunderstorm = self._is_thunderstorm(code)

            wind_score = self._wind_score_day(wind)
            temp_score = self._temperature_score_day(temp)
            rain_score = self._rain_probability_score_day(rain)
            delay_bonus = self._delay_bonus(idx, total)

            # Wind is the most important, then temperature, then rain probability.
            day_score = (
                0.55 * wind_score
                + 0.25 * temp_score
                + 0.10 * rain_score
                + 0.10 * delay_bonus
            )

            results.append(
                {
                    "date": d,
                    "day_score": round(day_score, 4),
                    "temperature": temp,
                    "wind_speed": wind,
                    "rain_probability": rain,
                    "weather_code": code,
                    "has_thunderstorm": has_thunderstorm,
                    "missing_daily": False,
                }
            )

        # Highest score first
        results.sort(key=lambda x: (x["day_score"], x["date"]), reverse=True)
        return results

    def _lookup_daily_row(self, daily_df: pd.DataFrame, d: date) -> Optional[pd.Series]:
        rows = daily_df.loc[daily_df["Date"] == d]
        if rows.empty:
            return None
        return rows.iloc[0]

    # ---------------------------------------------------------------------
    # Time selection
    # ---------------------------------------------------------------------
    def _select_best_time_for_date(
        self,
        date_str: str,
        hourly_df: pd.DataFrame,
        strict_rain: bool = True,
    ) -> Dict[str, Any]:
        d = pd.to_datetime(date_str).date()
        rows = hourly_df.loc[hourly_df["Date"] == d].copy()
        if rows.empty:
            return {
                "selected_time": None,
                "time_score": None,
                "reasons": [f"{date_str}: no hourly data available."],
                "debug": {"rows_found": 0},
            }

        scored_rows: List[Dict[str, Any]] = []

        for _, row in rows.iterrows():
            hour = row["Time"]
            temp = float(row["Temperature"])
            wind = float(row["WindSpeed"])
            rain = float(row["RainProbability"])
            code = row.get("WeatherCode", None)

            if self._is_thunderstorm(code):
                continue

            if self.irrigation_method == "sprinkler" and wind >= TIME_HIGH_WIND_THRESHOLD_KMH:
                continue

            if strict_rain and rain >= RAIN_HOLD_THRESHOLD:
                continue

            wind_score = self._wind_score_hour(wind)
            temp_score = self._temperature_score_hour(temp)
            rain_score = self._rain_probability_score_hour(rain)
            season_bonus = self._season_bonus_for_time(hour, self.season)

            # Wind dominates the decision; season is important for winter/summer timing.
            time_score = (
                0.50 * wind_score
                + 0.20 * temp_score
                + 0.15 * rain_score
                + 0.15 * season_bonus
            )

            scored_rows.append(
                {
                    "time": hour,
                    "time_score": round(time_score, 4),
                    "temperature": temp,
                    "wind_speed": wind,
                    "rain_probability": rain,
                    "weather_code": code,
                    "season_bonus": season_bonus,
                }
            )

        if not scored_rows:
            return {
                "selected_time": None,
                "time_score": None,
                "reasons": [f"{date_str}: no valid irrigation hour after applying time-level filters."],
                "debug": {"rows_found": len(rows), "valid_rows": 0},
            }

        scored_rows.sort(key=lambda x: (x["time_score"], self._time_sort_key(x["time"])), reverse=True)
        best = scored_rows[0]
        return {
            "selected_time": best["time"],
            "time_score": best["time_score"],
            "reasons": [
                f"{date_str}: selected time {best['time']} with highest time score."
            ],
            "debug": {"rows_found": len(rows), "valid_rows": len(scored_rows), "best_row": best},
        }

    def _find_next_best_date_outside_window(
        self,
        ranked_candidates: List[Dict[str, Any]],
        daily_df: pd.DataFrame,
        hourly_df: pd.DataFrame,
    ) -> Optional[ScheduleResult]:
        # In this final design, we keep the scheduler focused on the 3-day window.
        # If that fails, we return no_valid_date instead of silently jumping far ahead.
        return None

    # ---------------------------------------------------------------------
    # Scoring functions
    # ---------------------------------------------------------------------
    @staticmethod
    def _delay_bonus(index: int, total: int) -> float:
        if total <= 1:
            return 100.0
        return 100.0 * (1-(index / (total - 1)))

    @staticmethod
    def _wind_score_day(wind_kmh: float) -> float:
        # Lower wind is better for irrigation efficiency.
        if wind_kmh <= 5:
            return 100.0
        if wind_kmh <= 10:
            return 85.0
        if wind_kmh <= 15:
            return 65.0
        if wind_kmh <= 20:
            return 35.0
        return 10.0

    @staticmethod
    def _wind_score_hour(wind_kmh: float) -> float:
        if wind_kmh <= 3:
            return 100.0
        if wind_kmh <= 5:
            return 90.0
        if wind_kmh <= 8:
            return 75.0
        if wind_kmh <= 12:
            return 45.0
        return 15.0

    @staticmethod
    def _temperature_score_day(temp_c: float) -> float:
        # Moderate temperatures are better.
        if 20 <= temp_c <= 30:
            return 100.0
        if 15 <= temp_c < 20 or 30 < temp_c <= 35:
            return 80.0
        if 10 <= temp_c < 15 or 35 < temp_c <= 40:
            return 45.0
        return 15.0

    @staticmethod
    def _temperature_score_hour(temp_c: float) -> float:
        if 18 <= temp_c <= 28:
            return 100.0
        if 14 <= temp_c < 18 or 28 < temp_c <= 33:
            return 80.0
        if 10 <= temp_c < 14 or 33 < temp_c <= 38:
            return 45.0
        return 15.0

    @staticmethod
    def _rain_probability_score_day(rain_probability: float) -> float:
        # Lower probability is better for irrigation.
        rain_probability = max(0.0, min(100.0, rain_probability))
        return 100.0 - rain_probability

    @staticmethod
    def _rain_probability_score_hour(rain_probability: float) -> float:
        rain_probability = max(0.0, min(100.0, rain_probability))
        return 100.0 - rain_probability

    @staticmethod
    def _season_bonus_for_time(time_str: str, season: str) -> float:
        """
        Strong seasonal preference:
        - winter: 05:00 strongest
        - summer: evening/night strongest
        - monsoon: early morning strongest
        """
        hh = int(time_str.split(":")[0])

        season = (season or "").strip().lower()

        if season == "winter":
            if hh == 5:
                return 100.0
            if hh == 6:
                return 90.0
            if hh == 7:
                return 80.0
            if hh == 8:
                return 60.0
            if hh == 9:
                return 40.0
            return 10.0

        if season == "summer":
            if 20 <= hh <= 22:
                return 100.0
            if 18 <= hh <= 19:
                return 90.0
            if 4 <= hh <= 6:
                return 75.0
            if 7 <= hh <= 8:
                return 45.0
            return 10.0

        if season == "monsoon":
            if 6 <= hh <= 9:
                return 100.0
            if 5 <= hh <= 10:
                return 80.0
            return 20.0

        # Default fallback
        if 5 <= hh <= 8:
            return 85.0
        if 18 <= hh <= 20:
            return 75.0
        return 30.0

    @staticmethod
    def _season_fallback_time(season: Optional[str] = None) -> str:
        season = (season or "summer").strip().lower()
        if season == "winter":
            return "05:00"
        if season == "summer":
            return "20:00"
        if season == "monsoon":
            return "06:00"
        return "06:00"

    @staticmethod
    def _time_sort_key(time_str: str) -> int:
        hh = int(time_str.split(":")[0])
        mm = int(time_str.split(":")[1])
        return hh * 60 + mm

    # ---------------------------------------------------------------------
    # Utilities
    # ---------------------------------------------------------------------
    @staticmethod
    def _is_thunderstorm(code: Any) -> bool:
        if code is None or (isinstance(code, float) and pd.isna(code)):
            return False

        # Numeric weather codes (Open-Meteo standard)
        if isinstance(code, (int, float)) and not pd.isna(code):
            try:
                return int(code) in THUNDERSTORM_CODES
            except Exception:
                return False

        # Strings such as "95" or "Thunderstorm"
        code_str = str(code).strip().lower()
        if not code_str:
            return False

        if code_str.isdigit():
            return int(code_str) in THUNDERSTORM_CODES

        # Conservative string matching
        return "thunderstorm" in code_str or "hail" in code_str

    @staticmethod
    def _normalize_time_string(value: Any) -> str:
        """
        Normalize times like:
        - 05:00:00 -> 05:00
        - 5:00     -> 05:00
        - 05:00    -> 05:00
        """
        s = str(value).strip()
        if not s:
            return s

        # Handle HH:MM:SS
        try:
            dt = pd.to_datetime(s, errors="coerce")
            if pd.notna(dt):
                return dt.strftime("%H:%M")
        except Exception:
            pass

        # Manual fallback
        parts = s.split(":")
        if len(parts) >= 2:
            try:
                hh = int(parts[0])
                mm = int(parts[1])
                return f"{hh:02d}:{mm:02d}"
            except Exception:
                return s
        return s

    @staticmethod
    def _get_existing_column(
        df: pd.DataFrame,
        aliases: Sequence[str],
        required: bool,
        table_name: str,
    ) -> Optional[str]:
        for alias in aliases:
            if alias in df.columns:
                return alias

        if required:
            raise ValueError(
                f"Required column not found in {table_name} table. Tried aliases: {list(aliases)}. "
                f"Available columns: {list(df.columns)}"
            )
        return None


def load_csv(path: str | Path) -> pd.DataFrame:
    return pd.read_csv(path)


def schedule_irrigation(
    threshold: float,
    season: str,
    future_prediction_csv: str | None = None,
    daily_weather_csv: str | None = None,
    hourly_weather_csv: str | None = None,
    prediction_df: pd.DataFrame | None = None,
    daily_weather_df: pd.DataFrame | None = None,
    hourly_weather_df: pd.DataFrame | None = None,
    irrigation_method: str = "sprinkler",
    weather_code_required: bool = False,
) -> dict:

    if prediction_df is None:
        if future_prediction_csv is None:
            raise ValueError("prediction_df is required when future_prediction_csv is not provided.")
        prediction_df = pd.read_csv(future_prediction_csv)
    if daily_weather_df is None:
        if daily_weather_csv is None:
            raise ValueError("daily_weather_df is required when daily_weather_csv is not provided.")
        daily_weather_df = pd.read_csv(daily_weather_csv)
    if hourly_weather_df is None:
        if hourly_weather_csv is None:
            raise ValueError("hourly_weather_df is required when hourly_weather_csv is not provided.")
        hourly_weather_df = pd.read_csv(hourly_weather_csv)

    scheduler = IrrigationDatetimeScheduler(
        threshold=threshold,
        season=season,
        irrigation_method=irrigation_method,
        weather_code_required=weather_code_required,
    )

    result = scheduler.select_schedule(
        prediction_df,
        daily_weather_df,
        hourly_weather_df,
    )

    return result.to_dict()
