# """
# error_corrector.py
# ==================
# Self-learning Theta (Soil Moisture) Prediction & Correction Module.
# Predicts theta_tomorrow from today's conditions and corrects it
# using real sensor readings as they arrive.

# Three-stage online learning:
#   Stage 1 (Days 1-7)  : Cold start — no prediction yet (need 2 readings minimum)
#   Stage 2 (Days 8-30) : RLS (Recursive Least Squares) — fast learner
#   Stage 3 (Days 30+)  : PA-R (Passive-Aggressive Regression) — drift-resistant

# Day-by-day flow:
#   Day 1 : Save theta_today. No observed tomorrow yet.
#   Day 2+: theta_observed = today's sensor reading (= yesterday's "tomorrow")
#           error = theta_observed - theta_predicted_yesterday
#           Model trains on this error.
#           theta_corrected = theta_predicted + learned_correction

# Author : Smart Irrigation AI Module
# """

# import os
# import json
# import csv
# import math
# import numpy as np
# from datetime import date as date_type
# from typing import Optional


# # ─────────────────────────────────────────────
# # CONSTANTS
# # ─────────────────────────────────────────────

# STAGE_COLD   = 1   # Days 1-7   : no correction
# STAGE_RLS    = 2   # Days 8-30  : Recursive Least Squares
# STAGE_PA     = 3   # Days 30+   : Passive-Aggressive Regression

# COLD_END     = 7   # last day of cold start
# RLS_END      = 30  # last day of RLS stage

# N_FEATURES   = 7   # [DAS, Kc, ET0, Zr, T, RH, theta_today]

# # Normalization constants — scale each feature to ~[0,1] range
# # theta is typically 0.1–0.5 m³/m³, so norm=0.5
# FEATURE_NORMS = np.array([200.0, 1.5, 15.0, 1.0, 50.0, 100.0, 0.5])

# # RLS forgetting factor — 0.95 means recent readings matter more
# RLS_LAMBDA   = 0.95

# # PA-R aggressiveness — max step size per update
# PA_C         = 0.005  # tighter than ETc version — theta changes are small

# # PA-R margin — errors smaller than this are ignored (sensor noise floor)
# PA_EPSILON   = 0.002  # ~0.002 m³/m³ is typical sensor noise

# # Physical bounds for theta (m³/m³)
# THETA_MIN    = 0.05   # bone dry soil
# THETA_MAX    = 0.55   # near saturation

# # Sanity check: max plausible single-day drop in theta
# THETA_DROP_MAX = 0.15  # m³/m³ per day — beyond this is sensor spike


# # ─────────────────────────────────────────────
# # MAIN CLASS
# # ─────────────────────────────────────────────

# class ETcErrorCorrector:
#     """
#     Self-learning soil moisture (theta) predictor and corrector.

#     Predicts theta_tomorrow from [DAS, Kc, ET0, Zr, T, RH, theta_today].
#     Corrects the prediction using real sensor readings each morning.
#     No ETc involved anywhere.

#     Persists state across runs via JSON so learning is never lost.
#     """

#     def __init__(self, log_dir: str = "."):
#         self.log_dir    = log_dir
#         os.makedirs(log_dir, exist_ok=True)

#         self.state_file = os.path.join(log_dir, "error_corrector_state.json")
#         self.log_file   = os.path.join(log_dir, "theta_correction_log.csv")

#         self._load_state()
#         self._init_log_file()


#     # ─────────────────────────────────────────────
#     # PUBLIC API
#     # ─────────────────────────────────────────────

#     def update(
#         self,
#         theta_today:   Optional[float],
#         DAS:           int,
#         Kc:            float,
#         ET0:           float,
#         Zr:            float,
#         T:             float,
#         RH:            float,
#         current_date:  date_type
#     ) -> dict:
#         """
#         Main daily update. Call every morning after sensor reading.

#         Steps:
#           1. theta_today IS the observed theta_tomorrow from yesterday's prediction
#           2. Compute error = theta_today - theta_predicted_yesterday
#           3. Train active model on this error
#           4. Predict theta_tomorrow using today's features + correction
#           5. Save state and log row

#         Args:
#             theta_today   : Soil moisture from sensor today (m³/m³)
#             DAS           : Day After Sowing
#             Kc            : Crop coefficient for today
#             ET0           : Reference ET mm/day (kept as feature — helps prediction)
#             Zr            : Root zone depth in meters
#             T             : Mean temperature °C
#             RH            : Relative humidity %
#             current_date  : Today's date

#         Returns:
#             dict with theta_predicted, theta_observed, theta_error,
#                        theta_corrected, alpha, stage, samples
#         """

#         # ── Edge case: sensor missing ──────────────────────────────────
#         if theta_today is None:
#             print(f"[ThetaCorrector] WARNING: No sensor reading for {current_date}. "
#                   f"Returning last known prediction.")
#             return self._make_result(
#                 theta_predicted  = self.theta_predicted_yesterday,
#                 theta_observed   = None,
#                 theta_error      = None,
#                 theta_corrected  = self.theta_predicted_yesterday,
#                 alpha            = self._get_alpha()
#             )

#         # ── Validate sensor reading ────────────────────────────────────
#         if not (THETA_MIN <= theta_today <= THETA_MAX):
#             print(f"[ThetaCorrector] WARNING: theta_today={theta_today:.4f} out of "
#                   f"physical range [{THETA_MIN}, {THETA_MAX}]. Skipping update.")
#             return self._make_result(
#                 theta_predicted  = self.theta_predicted_yesterday,
#                 theta_observed   = theta_today,
#                 theta_error      = None,
#                 theta_corrected  = self.theta_predicted_yesterday,
#                 alpha            = self._get_alpha()
#             )

#         # ── Increment day count ────────────────────────────────────────
#         self.day_count += 1

#         # ── STEP 1: Compute error against yesterday's prediction ───────
#         # theta_error: how far off the FINAL (blended) prediction was.
#         # Kept for logging/display only — NOT used to train the model.
#         theta_error = None

#         # train_target: the gap between reality and yesterday's PHYSICS-ONLY
#         # estimate. This is what the model is trained on. Using the
#         # physics-only baseline (instead of the already-corrected blended
#         # prediction) avoids double-subtracting the model's own correction
#         # term during training.
#         train_target = None

#         if self.theta_predicted_yesterday is not None:
#             # theta_today is the ground truth for what we predicted yesterday
#             raw_error = theta_today - self.theta_predicted_yesterday

#             # Sanity check — if yesterday's theta isn't stored, skip
#             skip_training = False
#             if self.theta_yesterday is not None:
#                 drop = self.theta_yesterday - theta_today
#                 if abs(drop) > THETA_DROP_MAX:
#                     print(f"[ThetaCorrector] WARNING: Single-day theta drop = {drop:.4f} "
#                           f"exceeds {THETA_DROP_MAX}. Possible sensor spike. Skipping training.")
#                     raw_error = None
#                     skip_training = True

#             if raw_error is not None:
#                 theta_error = raw_error

#             if not skip_training and self.theta_physics_yesterday is not None:
#                 train_target = theta_today - self.theta_physics_yesterday

#         # ── STEP 2: Build normalized feature vector ────────────────────
#         # Features describe TODAY — used to predict theta_tomorrow
#         x_raw = np.array([DAS, Kc, ET0, Zr, T, RH, theta_today], dtype=float)
#         x     = x_raw / FEATURE_NORMS

#         # ── STEP 3: Update stage ───────────────────────────────────────
#         self._update_stage()

#         # ── STEP 4: Train on today's error ────────────────────────────
#         if train_target is not None and self.x_yesterday is not None:
#             # IMPORTANT: train using YESTERDAY's features (x_yesterday),
#             # because that's what generated theta_predicted_yesterday.
#             # train_target is the RAW gap from physics (not the already
#             # corrected/blended prediction) — this prevents the model's
#             # own previous correction from being subtracted twice.
#             if self.stage == STAGE_RLS:
#                 self._rls_update(self.x_yesterday, train_target)
#                 self.samples_collected += 1
#             elif self.stage == STAGE_PA:
#                 self._pa_update(self.x_yesterday, train_target)
#                 self.samples_collected += 1
#             # Stage 1: silent logging only

#         # ── STEP 5: Predict theta_tomorrow ────────────────────────────
#         alpha = self._get_alpha()

#         if self.stage == STAGE_COLD:
#             # Cold start: use simple physics estimate
#             # theta drops by roughly ETc / (Zr * 1000) each day
#             ETc_physics      = Kc * ET0
#             delta_theta_phys = ETc_physics / (Zr * 1000) if Zr > 0 else 0.0
#             theta_predicted  = theta_today - delta_theta_phys
#             theta_physics    = theta_predicted   # no correction exists yet — physics IS the prediction
#         else:
#             # Model predicts a correction to add to today's theta
#             # Base: physics estimate of tomorrow
#             ETc_physics      = Kc * ET0
#             delta_theta_phys = ETc_physics / (Zr * 1000) if Zr > 0 else 0.0
#             theta_physics    = theta_today - delta_theta_phys

#             # Model correction: learned from past errors
#             correction       = float(self.w @ x)
#             theta_corrected  = theta_physics + correction

#             # Blend physics and model
#             theta_predicted  = (1.0 - alpha) * theta_physics + alpha * theta_corrected

#         # Clamp to physical bounds
#         theta_predicted = float(np.clip(theta_predicted, THETA_MIN, THETA_MAX))

#         # ── STEP 6: Save today's state for tomorrow ────────────────────
#         self.theta_yesterday           = theta_today
#         self.theta_predicted_yesterday = theta_predicted
#         self.theta_physics_yesterday   = theta_physics    # NEW — raw physics baseline for tomorrow's training
#         self.x_yesterday               = x.copy()

#         # ── STEP 7: Compute corrected theta for today's log ───────────
#         # "theta_corrected" in the log = what the model says theta_today
#         # should be, given yesterday's prediction + learned correction
#         if self.stage != STAGE_COLD and self.x_yesterday is not None:
#             correction_today = float(self.w @ x)
#         else:
#             correction_today = 0.0

#         theta_corrected_today = theta_today + correction_today

#         # ── STEP 8: Persist state and log ─────────────────────────────
#         self._save_state()
#         self._log_row(
#             current_date, DAS, Kc, ET0, Zr, T, RH,
#             theta_today, self.theta_predicted_yesterday,
#             theta_error, theta_corrected_today, alpha
#         )

#         # ── Print daily status ─────────────────────────────────────────
#         err_str = f"{theta_error:+.4f}" if theta_error is not None else "N/A (Day 1)"
#         print(
#             f"[ThetaCorrector] Day {DAS} | Stage {self.stage} | "
#             f"theta_today={theta_today:.4f} | "
#             f"Error: {err_str} | Alpha: {alpha:.2f} | "
#             f"theta_predicted_tomorrow={theta_predicted:.4f} | "
#             f"Samples: {self.samples_collected}"
#         )

#         return self._make_result(
#             theta_predicted  = theta_predicted,
#             theta_observed   = theta_today,
#             theta_error      = theta_error,
#             theta_corrected  = theta_corrected_today,
#             alpha            = alpha
#         )


#     def get_theta_prediction(
#         self,
#         theta_today: float,
#         DAS:  int,
#         Kc:   float,
#         ET0:  float,
#         Zr:   float,
#         T:    float,
#         RH:   float
#     ) -> float:
#         """
#         Predict theta for tomorrow given today's conditions.
#         Use this in the 10-day forecast loop — no training happens here.

#         Returns:
#             float: predicted theta_tomorrow (m³/m³)
#         """
#         x_raw = np.array([DAS, Kc, ET0, Zr, T, RH, theta_today], dtype=float)
#         x     = x_raw / FEATURE_NORMS

#         ETc_physics      = Kc * ET0
#         delta_theta_phys = ETc_physics / (Zr * 1000) if Zr > 0 else 0.0
#         theta_physics    = theta_today - delta_theta_phys

#         if self.stage == STAGE_COLD:
#             return float(np.clip(theta_physics, THETA_MIN, THETA_MAX))

#         correction      = float(self.w @ x)
#         alpha           = self._get_alpha()
#         theta_corrected = theta_physics + correction
#         theta_predicted = (1.0 - alpha) * theta_physics + alpha * theta_corrected

#         return float(np.clip(theta_predicted, THETA_MIN, THETA_MAX))


#     # ─────────────────────────────────────────────
#     # STAGE MANAGEMENT
#     # ─────────────────────────────────────────────

#     def _update_stage(self):
#         if self.day_count <= COLD_END:
#             self.stage = STAGE_COLD
#         elif self.day_count <= RLS_END:
#             self.stage = STAGE_RLS
#         else:
#             if self.stage != STAGE_PA:
#                 print(f"[ThetaCorrector] Transitioning to Stage 3 (PA-R) "
#                       f"with {self.samples_collected} samples collected.")
#             self.stage = STAGE_PA


#     def _get_alpha(self) -> float:
#         if self.stage == STAGE_COLD:
#             return 0.0
#         elif self.stage == STAGE_RLS:
#             return float(np.clip(
#                 (self.day_count - COLD_END) / (RLS_END - COLD_END), 0.0, 1.0
#             ))
#         else:
#             return 1.0


#     # ─────────────────────────────────────────────
#     # RLS ALGORITHM
#     # ─────────────────────────────────────────────

#     def _rls_update(self, x: np.ndarray, y: float):
#         """
#         RLS update where y = theta_error (observed - predicted).
#         x = yesterday's feature vector (what generated the prediction).
#         """
#         lam   = RLS_LAMBDA
#         denom = lam + x.T @ self.P @ x
#         K     = (self.P @ x) / denom
#         self.P = (1.0 / lam) * (self.P - np.outer(K, x.T @ self.P))

#         y_pred  = float(x.T @ self.w)
#         self.w  = self.w + K * (y - y_pred)


#     # ─────────────────────────────────────────────
#     # PASSIVE-AGGRESSIVE ALGORITHM
#     # ─────────────────────────────────────────────

#     def _pa_update(self, x: np.ndarray, y: float):
#         """
#         PA-R update where y = theta_error.
#         Ignores tiny errors within sensor noise floor (PA_EPSILON).
#         """
#         y_pred    = float(self.w @ x)
#         loss      = abs(y - y_pred) - PA_EPSILON

#         if loss <= 0:
#             return

#         x_norm_sq = float(x @ x)
#         if x_norm_sq < 1e-10:
#             return

#         tau       = min(loss / x_norm_sq, PA_C)
#         direction = math.copysign(1.0, y - y_pred)
#         self.w    = self.w + tau * direction * x


#     # ─────────────────────────────────────────────
#     # STATE PERSISTENCE
#     # ─────────────────────────────────────────────

#     def _load_state(self):
#         if os.path.exists(self.state_file):
#             try:
#                 with open(self.state_file, "r") as f:
#                     state = json.load(f)

#                 self.stage                     = state["stage"]
#                 self.samples_collected         = state["samples_collected"]
#                 self.day_count                 = state["day_count"]
#                 self.w                         = np.array(state["w"], dtype=float)
#                 self.P                         = np.array(state["P"], dtype=float)
#                 self.theta_yesterday           = state["theta_yesterday"]
#                 self.theta_predicted_yesterday = state["theta_predicted_yesterday"]
#                 self.theta_physics_yesterday   = state.get("theta_physics_yesterday")  # NEW (backward-compatible)
#                 self.x_yesterday               = (
#                     np.array(state["x_yesterday"], dtype=float)
#                     if state["x_yesterday"] is not None else None
#                 )

#                 print(f"[ThetaCorrector] State loaded. Day {self.day_count} | "
#                       f"Stage {self.stage} | Samples: {self.samples_collected}")

#             except (json.JSONDecodeError, KeyError, ValueError) as e:
#                 print(f"[ThetaCorrector] WARNING: State file corrupted ({e}). Starting fresh.")
#                 os.remove(self.state_file)
#                 self._init_fresh_state()
#         else:
#             print("[ThetaCorrector] No state file found. Starting from Day 1.")
#             self._init_fresh_state()


#     def _init_fresh_state(self):
#         self.stage                     = STAGE_COLD
#         self.samples_collected         = 0
#         self.day_count                 = 0
#         self.theta_yesterday           = None
#         self.theta_predicted_yesterday = None
#         self.theta_physics_yesterday   = None   # NEW
#         self.x_yesterday               = None

#         # 7 features now (added theta_today)
#         self.w = np.zeros(N_FEATURES, dtype=float)
#         self.P = np.eye(N_FEATURES, dtype=float) * 1000


#     def _save_state(self):
#         state = {
#             "stage":                     self.stage,
#             "samples_collected":         self.samples_collected,
#             "day_count":                 self.day_count,
#             "w":                         self.w.tolist(),
#             "P":                         self.P.tolist(),
#             "theta_yesterday":           self.theta_yesterday,
#             "theta_predicted_yesterday": self.theta_predicted_yesterday,
#             "theta_physics_yesterday":   self.theta_physics_yesterday,   # NEW
#             "x_yesterday":               (
#                 self.x_yesterday.tolist()
#                 if self.x_yesterday is not None else None
#             )
#         }

#         tmp = self.state_file + ".tmp"
#         with open(tmp, "w") as f:
#             json.dump(state, f, indent=2)
#         os.replace(tmp, self.state_file)


#     # ─────────────────────────────────────────────
#     # LOGGING
#     # ─────────────────────────────────────────────

#     def _init_log_file(self):
#         if not os.path.exists(self.log_file):
#             headers = [
#                 "Date", "DAS", "Kc", "ET0", "Zr", "T", "RH",
#                 "theta_observed",
#                 "theta_predicted_tomorrow",
#                 "theta_error",
#                 "theta_corrected",
#                 "stage", "alpha", "samples_collected"
#             ]
#             with open(self.log_file, "w", newline="") as f:
#                 csv.writer(f).writerow(headers)
#             print(f"[ThetaCorrector] Created log file: {self.log_file}")


#     def _log_row(
#         self,
#         current_date, DAS, Kc, ET0, Zr, T, RH,
#         theta_observed, theta_predicted_tomorrow,
#         theta_error, theta_corrected, alpha
#     ):
#         def fmt(val, d=4):
#             return "" if val is None else round(float(val), d)

#         row = [
#             current_date, DAS,
#             fmt(Kc, 4), fmt(ET0, 3), fmt(Zr, 4), fmt(T, 1), fmt(RH, 1),
#             fmt(theta_observed, 4),
#             fmt(theta_predicted_tomorrow, 4),
#             fmt(theta_error, 4),
#             fmt(theta_corrected, 4),
#             self.stage, fmt(alpha, 3), self.samples_collected
#         ]

#         with open(self.log_file, "a", newline="") as f:
#             csv.writer(f).writerow(row)


#     # ─────────────────────────────────────────────
#     # HELPERS
#     # ─────────────────────────────────────────────

#     def _make_result(
#         self,
#         theta_predicted:  Optional[float],
#         theta_observed:   Optional[float],
#         theta_error:      Optional[float],
#         theta_corrected:  Optional[float],
#         alpha:            float = 0.0
#     ) -> dict:
#         return {
#             "theta_predicted":  theta_predicted,
#             "theta_observed":   theta_observed,
#             "theta_error":      theta_error,
#             "theta_corrected":  theta_corrected,
#             "alpha":            alpha,
#             "stage":            self.stage,
#             "samples":          self.samples_collected
#         }