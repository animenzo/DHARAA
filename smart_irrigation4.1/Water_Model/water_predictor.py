# """
# water_predictor.py
# ===================
# Self-learning daily irrigation water requirement predictor.

# Predicts daily water need (mm) as:
#     water_predicted = (Kc * ET0) + learned_correction(features)

# The physics term (Kc * ET0) is the FAO-56 baseline, same as the
# static formula in water_crop_pred.py. The learned_correction term
# is a plain online linear regression (SGD), trained one day at a
# time once the actual water applied that day becomes known (from
# the irrigation/flow-sensor model, once integrated).

# No historical dataset required — learns incrementally from scratch,
# starting at correction = 0 (i.e. pure physics) on day 1.

# Log schema (water_prediction_log.csv):
#     timestamp, temperature_c, wind_speed_mps, soil_type,
#     irrigation_method, water_predicted_mm,
#     water_applied_actual_mm, water_error_mm, water_correct_mm

# Note: DAS/Kc/ET0/Zr are still required as inputs to update() because
# they drive the physics + learned-correction math (water_physics =
# Kc * ET0, feature vector = [DAS, Kc, ET0, Zr]). They are simply no
# longer written to the log CSV — only the fields above are persisted.

# Author : Smart Irrigation AI Module
# """

# import os
# import json
# import csv
# import numpy as np
# from datetime import date as date_type, datetime
# from typing import Optional


# # ─────────────────────────────────────────────
# # CONSTANTS
# # ─────────────────────────────────────────────

# N_FEATURES   = 4   # [DAS, Kc, ET0, Zr]

# # Normalization constants — scale each feature to a comparable range
# FEATURE_NORMS = np.array([200.0, 1.5, 15.0, 1.0])

# # SGD learning rate — small, since this updates once per day, not per batch
# LEARNING_RATE = 0.01

# # Physical sanity bound on the learned correction (mm/day) — prevents
# # one bad/noisy data point from blowing up the prediction
# MAX_CORRECTION_MM = 5.0

# # Log CSV columns — single source of truth for header + row order
# LOG_COLUMNS = [
#     "timestamp", "temperature_c", "wind_speed_mps", "soil_type",
#     "irrigation_method", "water_predicted_mm",
#     "water_applied_actual_mm", "water_error_mm", "water_correct_mm"
# ]


# # ─────────────────────────────────────────────
# # MAIN CLASS
# # ─────────────────────────────────────────────

# class WaterPredictor:
#     """
#     Self-learning daily water requirement predictor.

#     Wraps the FAO-56 physics estimate (Kc * ET0) with a linear
#     correction term learned via online SGD from actual water
#     applied each day.
#     """

#     def __init__(self, log_dir: str = "."):
#         self.log_dir    = log_dir
#         os.makedirs(log_dir, exist_ok=True)

#         self.state_file = os.path.join(log_dir, "water_predictor_state.json")
#         self.log_file   = os.path.join(log_dir, "water_prediction_log.csv")

#         self._load_state()
#         self._init_log_file()


#     # ─────────────────────────────────────────────
#     # PUBLIC API
#     # ─────────────────────────────────────────────

#     def update(
#         self,
#         water_applied_actual:  Optional[float],
#         DAS:                   int,
#         Kc:                    float,
#         ET0:                   float,
#         Zr:                    float,
#         temperature_c:         float,
#         wind_speed_mps:        float,
#         soil_type:             str,
#         irrigation_method:     str,
#         timestamp:             Optional[datetime] = None
#     ) -> dict:
#         """
#         Main daily update. Call once per real day once actual water
#         applied is known (from irrigation/flow-sensor model).

#         Steps:
#           1. Predict today's water need using current weights
#           2. If actual water applied is known, compute error and
#              run one SGD step to update weights
#           3. Log and persist state

#         Args:
#             water_applied_actual : Actual water applied today (mm),
#                                     from irrigation/flow-sensor model.
#                                     Pass None if not yet available.
#             DAS                  : Day After Sowing (drives the
#                                     physics + correction math; not
#                                     logged directly anymore).
#             Kc                   : Crop coefficient for today (math only).
#             ET0                  : Reference ET mm/day (math only).
#             Zr                   : Root zone depth in meters (math only).
#             temperature_c        : Mean air temperature today, °C.
#             wind_speed_mps       : Wind speed today, m/s.
#             soil_type            : Soil texture/type (e.g. "Loam").
#             irrigation_method    : Irrigation method used (e.g. "drip").
#             timestamp             : Moment this update is recorded.
#                                     Defaults to datetime.now() if not given.

#         Returns:
#             dict with water_predicted_mm, water_applied_actual_mm,
#                        water_error_mm, water_correct_mm, plus the
#                        logged context fields and sample count.
#         """

#         if timestamp is None:
#             timestamp = datetime.now()

#         # ── Build normalized feature vector ─────────────────────────
#         x_raw = np.array([DAS, Kc, ET0, Zr], dtype=float)
#         x     = x_raw / FEATURE_NORMS

#         # ── Physics baseline ─────────────────────────────────────────
#         water_physics = Kc * ET0

#         # ── Predict using current weights ───────────────────────────
#         correction      = float(np.clip(self.w @ x, -MAX_CORRECTION_MM, MAX_CORRECTION_MM))
#         water_predicted = max(water_physics + correction, 0.0)

#         # ── Train if ground truth is available ──────────────────────
#         water_error = None
#         if water_applied_actual is not None:
#             water_error = water_applied_actual - water_predicted
#             self._sgd_update(x, water_applied_actual - water_physics)
#             self.samples_collected += 1

#         self.day_count += 1

#         # ── Persist + log ────────────────────────────────────────────
#         self._save_state()
#         self._log_row(
#             timestamp             = timestamp,
#             temperature_c         = temperature_c,
#             wind_speed_mps        = wind_speed_mps,
#             soil_type             = soil_type,
#             irrigation_method     = irrigation_method,
#             water_predicted_mm    = water_predicted,
#             water_applied_actual_mm = water_applied_actual,
#             water_error_mm        = water_error,
#             water_correct_mm      = correction
#         )

#         err_str = f"{water_error:+.3f}" if water_error is not None else "N/A (no actual yet)"
#         print(
#             f"[WaterPredictor] Day {DAS} | water_physics={water_physics:.3f} mm | "
#             f"correction={correction:+.3f} mm | water_predicted={water_predicted:.3f} mm | "
#             f"Error: {err_str} | Samples: {self.samples_collected}"
#         )

#         return {
#             "water_predicted_mm":      water_predicted,
#             "water_applied_actual_mm": water_applied_actual,
#             "water_error_mm":          water_error,
#             "water_correct_mm":        correction,
#             "water_physics_mm":        water_physics,
#             "temperature_c":           temperature_c,
#             "wind_speed_mps":          wind_speed_mps,
#             "soil_type":               soil_type,
#             "irrigation_method":       irrigation_method,
#             "timestamp":               timestamp,
#             "samples":                 self.samples_collected
#         }


#     def predict_water(
#         self,
#         DAS:  int,
#         Kc:   float,
#         ET0:  float,
#         Zr:   float
#     ) -> float:
#         """
#         Predict water need for a day WITHOUT training and WITHOUT
#         touching day_count/state. Use this for future-day forecasts
#         (e.g. the 10-day-ahead loop) where no ground truth exists yet —
#         calling update() instead would wrongly advance day_count once
#         per forecast day instead of once per real day.

#         Returns:
#             float: predicted water need (mm) for that day
#         """
#         x_raw = np.array([DAS, Kc, ET0, Zr], dtype=float)
#         x     = x_raw / FEATURE_NORMS

#         water_physics = Kc * ET0
#         correction    = float(np.clip(self.w @ x, -MAX_CORRECTION_MM, MAX_CORRECTION_MM))

#         return max(water_physics + correction, 0.0)


#     def predict_remaining_season(
#         self,
#         crop_schedule_df,
#         days_since_sowing: int = 0
#     ) -> dict:
#         """
#         Predicts total remaining water requirement for the rest of
#         the season, using the learned correction on top of physics
#         for every remaining day — replaces the static sum in
#         water_crop_pred.py's calculate_remaining_water_requirement().

#         Args:
#             crop_schedule_df   : DataFrame from crop_schedule.csv,
#                                   must have DayAfterSowing, Kc columns
#                                   and an ET0 column already merged in
#                                   (e.g. from weather forecast / season avg).
#             days_since_sowing  : Skip days up to and including this value.

#         Returns:
#             dict with remaining_days, total_water_required_mm,
#                        average_daily_water_mm
#         """
#         remaining = crop_schedule_df[
#             crop_schedule_df["DayAfterSowing"] > days_since_sowing
#         ].copy()

#         if remaining.empty:
#             return {"error": "No remaining days in season."}

#         predicted_mm = []
#         for _, row in remaining.iterrows():
#             x_raw = np.array(
#                 [row["DayAfterSowing"], row["Kc"], row["ET0"], row["Zr"]],
#                 dtype=float
#             )
#             x = x_raw / FEATURE_NORMS
#             correction = float(np.clip(self.w @ x, -MAX_CORRECTION_MM, MAX_CORRECTION_MM))
#             water_physics = row["Kc"] * row["ET0"]
#             predicted_mm.append(max(water_physics + correction, 0.0))

#         total_water_mm = float(np.sum(predicted_mm))
#         remaining_days = len(remaining)

#         return {
#             "remaining_days_in_season": remaining_days,
#             "total_water_required_mm": round(total_water_mm, 2),
#             "average_daily_water_mm":  round(total_water_mm / remaining_days, 2),
#             "samples_used_for_learning": self.samples_collected
#         }


#     # ─────────────────────────────────────────────
#     # SGD UPDATE
#     # ─────────────────────────────────────────────

#     def _sgd_update(self, x: np.ndarray, target_correction: float):
#         """
#         One step of online SGD on squared error loss.
#         target_correction = actual_water - water_physics
#         (i.e. what the correction SHOULD have been today)
#         """
#         pred_correction = float(self.w @ x)
#         error           = target_correction - pred_correction

#         # Gradient of 0.5*(error)^2 w.r.t. w is -error*x; step opposite it
#         self.w = self.w + LEARNING_RATE * error * x


#     # ─────────────────────────────────────────────
#     # STATE PERSISTENCE
#     # ─────────────────────────────────────────────

#     def _load_state(self):
#         if os.path.exists(self.state_file):
#             try:
#                 with open(self.state_file, "r") as f:
#                     state = json.load(f)

#                 self.w                  = np.array(state["w"], dtype=float)
#                 self.day_count          = state["day_count"]
#                 self.samples_collected  = state["samples_collected"]

#                 print(f"[WaterPredictor] State loaded. Day {self.day_count} | "
#                       f"Samples: {self.samples_collected}")

#             except (json.JSONDecodeError, KeyError, ValueError) as e:
#                 print(f"[WaterPredictor] WARNING: State file corrupted ({e}). Starting fresh.")
#                 os.remove(self.state_file)
#                 self._init_fresh_state()
#         else:
#             print("[WaterPredictor] No state file found. Starting from Day 1.")
#             self._init_fresh_state()


#     def _init_fresh_state(self):
#         self.w                 = np.zeros(N_FEATURES, dtype=float)
#         self.day_count         = 0
#         self.samples_collected = 0


#     def _save_state(self):
#         state = {
#             "w":                  self.w.tolist(),
#             "day_count":          self.day_count,
#             "samples_collected":  self.samples_collected
#         }
#         tmp = self.state_file + ".tmp"
#         with open(tmp, "w") as f:
#             json.dump(state, f, indent=2)
#         os.replace(tmp, self.state_file)


#     # ─────────────────────────────────────────────
#     # LOGGING
#     # ─────────────────────────────────────────────

#     def _init_log_file(self):
#         """
#         Create water_prediction_log.csv with the new headers if it
#         doesn't exist. If it exists but still has the OLD schema
#         (Date, DAS, Kc, ET0, Zr, water_physics_mm, ...), archive it
#         instead of silently appending mismatched columns.
#         """
#         if not os.path.exists(self.log_file):
#             self._write_log_header()
#             print(f"[WaterPredictor] Created log file: {self.log_file}")
#             return

#         # File exists — check whether its header matches the new schema
#         with open(self.log_file, "r", newline="") as f:
#             first_line = f.readline().strip()

#         existing_header = first_line.split(",") if first_line else []

#         if existing_header != LOG_COLUMNS:
#             archive_path = self.log_file.replace(".csv", "_old_schema.csv")
#             # Avoid clobbering a previous archive
#             n = 1
#             base_archive = archive_path
#             while os.path.exists(archive_path):
#                 archive_path = base_archive.replace(".csv", f"_{n}.csv")
#                 n += 1
#             os.replace(self.log_file, archive_path)
#             print(f"[WaterPredictor] Old-schema log detected. Archived to "
#                   f"'{archive_path}'. Starting fresh '{self.log_file}'.")
#             self._write_log_header()


#     def _write_log_header(self):
#         with open(self.log_file, "w", newline="") as f:
#             csv.writer(f).writerow(LOG_COLUMNS)


#     def _log_row(
#         self,
#         timestamp, temperature_c, wind_speed_mps, soil_type,
#         irrigation_method, water_predicted_mm,
#         water_applied_actual_mm, water_error_mm, water_correct_mm
#     ):
#         def fmt(val, d=3):
#             return "" if val is None else round(float(val), d)

#         row = [
#             timestamp.isoformat(sep=" ", timespec="seconds")
#                 if isinstance(timestamp, datetime) else timestamp,
#             fmt(temperature_c, 1),
#             fmt(wind_speed_mps, 2),
#             soil_type if soil_type is not None else "",
#             irrigation_method if irrigation_method is not None else "",
#             fmt(water_predicted_mm, 3),
#             fmt(water_applied_actual_mm, 3),
#             fmt(water_error_mm, 3),
#             fmt(water_correct_mm, 3),
#         ]
#         with open(self.log_file, "a", newline="") as f:
#             csv.writer(f).writerow(row)