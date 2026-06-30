# ai-service/train/train_disease_model.py
#
# Run once:  python train/train_disease_model.py
# Output:    models/plant_disease_model.h5
#            models/disease_class_names.json
#
# Training time: ~20–40 min on CPU, ~5 min on GPU
# Expected accuracy: ~98–99% on PlantVillage

import os
import json
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, Model
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import (
    EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
)

# ── Config ─────────────────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR    = os.path.join(BASE_DIR, "train", "plantvillage")
MODEL_DIR   = os.path.join(BASE_DIR, "models")
MODEL_PATH  = os.path.join(MODEL_DIR, "plant_disease_model.h5")
NAMES_PATH  = os.path.join(MODEL_DIR, "disease_class_names.json")

IMG_SIZE    = 224
BATCH_SIZE  = 32
EPOCHS      = 20          # EarlyStopping will cut this short
FINE_TUNE_AT = 100        # Unfreeze MobileNetV2 layers from this index onward

os.makedirs(MODEL_DIR, exist_ok=True)

print(f"📂 Data directory : {DATA_DIR}")
print(f"💾 Model will be saved to: {MODEL_PATH}")
print(f"🖥️  TensorFlow version: {tf.__version__}")
print(f"🔧 GPUs available: {len(tf.config.list_physical_devices('GPU'))}")

# ── Data Generators ────────────────────────────────────────────────────────
print("\n📊 Setting up data generators...")

train_datagen = ImageDataGenerator(
    rescale=1.0 / 255,
    validation_split=0.2,
    rotation_range=30,
    width_shift_range=0.2,
    height_shift_range=0.2,
    shear_range=0.2,
    zoom_range=0.2,
    horizontal_flip=True,
    fill_mode="nearest",
)

train_gen = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    subset="training",
    shuffle=True,
    seed=42,
)

val_gen = train_datagen.flow_from_directory(
    DATA_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode="categorical",
    subset="validation",
    shuffle=False,
    seed=42,
)

NUM_CLASSES = len(train_gen.class_indices)
print(f"✅ Found {NUM_CLASSES} classes")
print(f"   Training samples  : {train_gen.samples}")
print(f"   Validation samples: {val_gen.samples}")

# Save class names ordered by index
class_names = [None] * NUM_CLASSES
for name, idx in train_gen.class_indices.items():
    class_names[idx] = name

with open(NAMES_PATH, "w") as f:
    json.dump(class_names, f, indent=2)
print(f"💾 Class names saved → {NAMES_PATH}")

# ── Build Model — Transfer Learning with MobileNetV2 ──────────────────────
print("\n🏗️  Building MobileNetV2 model...")

base_model = MobileNetV2(
    input_shape=(IMG_SIZE, IMG_SIZE, 3),
    include_top=False,
    weights="imagenet",
)
base_model.trainable = False   # Freeze base initially

inputs  = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
x       = base_model(inputs, training=False)
x       = layers.GlobalAveragePooling2D()(x)
x       = layers.BatchNormalization()(x)
x       = layers.Dense(256, activation="relu")(x)
x       = layers.Dropout(0.3)(x)
outputs = layers.Dense(NUM_CLASSES, activation="softmax")(x)

model = Model(inputs, outputs)
model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)
model.summary()

# ── Phase 1: Train top layers only ────────────────────────────────────────
print("\n🚀 Phase 1: Training top layers (base frozen)...")

callbacks_phase1 = [
    EarlyStopping(patience=5, restore_best_weights=True, verbose=1),
    ModelCheckpoint(MODEL_PATH, save_best_only=True, verbose=1),
    ReduceLROnPlateau(factor=0.5, patience=2, min_lr=1e-6, verbose=1),
]

history1 = model.fit(
    train_gen,
    epochs=EPOCHS,
    validation_data=val_gen,
    callbacks=callbacks_phase1,
    verbose=1,
)

# ── Phase 2: Fine-tune — unfreeze upper layers of base ────────────────────
print(f"\n🔧 Phase 2: Fine-tuning from layer {FINE_TUNE_AT} onward...")

base_model.trainable = True
for layer in base_model.layers[:FINE_TUNE_AT]:
    layer.trainable = False

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),  # lower LR
    loss="categorical_crossentropy",
    metrics=["accuracy"],
)

callbacks_phase2 = [
    EarlyStopping(patience=5, restore_best_weights=True, verbose=1),
    ModelCheckpoint(MODEL_PATH, save_best_only=True, verbose=1),
    ReduceLROnPlateau(factor=0.5, patience=2, min_lr=1e-7, verbose=1),
]

history2 = model.fit(
    train_gen,
    epochs=EPOCHS,
    validation_data=val_gen,
    callbacks=callbacks_phase2,
    verbose=1,
)

# ── Final Evaluation ───────────────────────────────────────────────────────
print("\n📋 Final evaluation on validation set:")
loss, acc = model.evaluate(val_gen, verbose=0)
print(f"   Validation Loss    : {loss:.4f}")
print(f"   Validation Accuracy: {acc * 100:.2f}%")

print(f"\n✅ Model saved → {MODEL_PATH}")
print(f"✅ Class names  → {NAMES_PATH}")
print("\n🎉 Training complete. Restart FastAPI to load the real model.")