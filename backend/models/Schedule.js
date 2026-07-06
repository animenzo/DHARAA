const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  // --- NEW FIELD: Link to User ---
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  // -------------------------------
  name: {
    type: String,
    required: [true, 'Schedule name is required'],
    trim: true
  },
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: [true, 'Farm ID is required']
  },
  zone: {
    type: String,
    
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Paused'],
    default: 'Active'
  },
  time: {
    type: String, // HH:MM format (24hr)
    required: [true, 'Schedule time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM']
  },
  duration: {
    type: Number, // In minutes
    validate: {
      validator: (v) => v === null || v === undefined || v >= 1,
      message: 'Duration must be at least 1 minute'
    }
  },
  moisture: {
    type: Number, // 0 to 100
    validate: {
      validator: (v) => v === null || v === undefined || (v >= 0 && v <= 100),
      message: 'Moisture must be between 0% and 100%'
    }
  },
  date: {
    type: String, // YYYY-MM-DD
    default: null
  },
  days: {
    type: [Boolean], // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    validate: {
      validator: (v) => !v || v.length === 7,
      message: 'Days must be an array of 7 booleans'
    }
  },
  notes: {
    type: String,
    trim: true
  },
  nextRun: {
    type: Date, // Changed to Date object for easier sorting/formatting
    default: null
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Schedule', scheduleSchema);