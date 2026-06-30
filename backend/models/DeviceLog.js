const mongoose = require('mongoose');

const deviceLogSchema = new mongoose.Schema({
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Farm',
    required: true
  },
  // We use a Map to store dynamic pin values: { "v0": 55, "v1": 30.5 }
  readings: {
    type: Map,
    of: Number
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DeviceLog', deviceLogSchema);