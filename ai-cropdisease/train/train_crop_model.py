# ai-service/train/train_crop_model.py
#
# Run once:  python train/train_crop_model.py
# Output:    ai-service/models/crop_model.pkl
#            ai-service/models/crop_label_encoder.pkl

import os
import pickle
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, accuracy_score

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH  = os.path.join(BASE_DIR, "train", "Crop_recommendation.csv")
MODEL_DIR  = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

MODEL_PATH = os.path.join(MODEL_DIR, "crop_model.pkl")
LE_PATH    = os.path.join(MODEL_DIR, "crop_label_encoder.pkl")

# ── Load Data ──────────────────────────────────────────────────────────────
print("📂 Loading dataset...")
df = pd.read_csv(DATA_PATH)
print(f"   Shape: {df.shape}")
print(f"   Columns: {list(df.columns)}")
print(f"   Crops: {sorted(df['label'].unique())}")

# ── Features & Target ──────────────────────────────────────────────────────
FEATURE_COLS = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET_COL   = "label"

X = df[FEATURE_COLS].values
y = df[TARGET_COL].values

# Encode string labels → integers
le = LabelEncoder()
y_encoded = le.fit_transform(y)

print(f"\n📊 Classes ({len(le.classes_)}): {list(le.classes_)}")

# ── Train / Test Split ─────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
)

# ── Train RandomForest ─────────────────────────────────────────────────────
print("\n🌲 Training RandomForest...")
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=None,
    min_samples_split=2,
    min_samples_leaf=1,
    random_state=42,
    n_jobs=-1,
)
model.fit(X_train, y_train)

# ── Evaluate ───────────────────────────────────────────────────────────────
y_pred = model.predict(X_test)
acc = accuracy_score(y_test, y_pred)
print(f"\n✅ Test Accuracy: {acc * 100:.2f}%")
print("\n📋 Classification Report:")
print(classification_report(y_test, y_pred, target_names=le.classes_))

# 5-fold cross validation
cv_scores = cross_val_score(model, X, y_encoded, cv=5, scoring="accuracy")
print(f"📊 5-Fold CV Accuracy: {cv_scores.mean() * 100:.2f}% ± {cv_scores.std() * 100:.2f}%")

# ── Feature Importance ─────────────────────────────────────────────────────
importance = dict(zip(FEATURE_COLS, model.feature_importances_))
print("\n🔍 Feature Importances:")
for feat, score in sorted(importance.items(), key=lambda x: -x[1]):
    bar = "█" * int(score * 50)
    print(f"   {feat:15s} {bar} {score:.4f}")

# ── Save Model & Encoder ───────────────────────────────────────────────────
with open(MODEL_PATH, "wb") as f:
    pickle.dump(model, f)

with open(LE_PATH, "wb") as f:
    pickle.dump(le, f)

print(f"\n💾 Model saved  → {MODEL_PATH}")
print(f"💾 Encoder saved → {LE_PATH}")

# ── Smoke Test ─────────────────────────────────────────────────────────────
print("\n🧪 Smoke test (typical rice conditions):")
sample = np.array([[90, 42, 43, 21.0, 82.0, 6.5, 202.9]])
pred_idx = model.predict(sample)[0]
pred_crop = le.inverse_transform([pred_idx])[0]
confidence = float(max(model.predict_proba(sample)[0]))
print(f"   Input : N=90, P=42, K=43, Temp=21°C, Humidity=82%, pH=6.5, Rainfall=202mm")
print(f"   Result: {pred_crop.upper()} (confidence: {confidence * 100:.1f}%)")
print("\n✅ Training complete. You can now start FastAPI.")