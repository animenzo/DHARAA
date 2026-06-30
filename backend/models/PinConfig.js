const mongoose = require('mongoose');

const pinConfigSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm'
  },
  pin: {
    type: String, // e.g., "v0", "v1"
    required: true
  },
  label: {
    type: String, // e.g., "Tomato Patch Moisture"
    required: true
  },
  type: {
    type: String,
    enum: ['SENSOR', 'ACTUATOR'], // SENSOR = Read Only, ACTUATOR = Control (Pump)
    default: 'SENSOR'
  },
  dataType: {
    type: String,
    enum: [
      'temperature', 
      'humidity', 
      'moisture', 
      'tank',      // <--- Added
      'switch',    // <--- Added
      'rain',      // <--- Added
      'level',     // <--- Added (just in case)
      'generic'    // <--- Added
    ],
    default: 'generic'
  },
  min: { type: Number, default: 0 }, // For Graph scaling
  max: { type: Number, default: 100 },
  color: { type: String, default: '#10b981' } // For UI graphs
}, { timestamps: true });

// Prevent duplicate pins for the same farm
pinConfigSchema.index({ farmId: 1, pin: 1 }, { unique: true });

module.exports = mongoose.model('PinConfig', pinConfigSchema);