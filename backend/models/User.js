// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
   resetPasswordToken: {
  type: String
},
resetPasswordExpire: {
  type: Date
},
// blynk: {
//     authToken: { type: String, default: '' }, // User pastes their token here
//     server: { type: String, default: 'blynk.cloud' }, // region specific if needed
//     isConfigured: { type: Boolean, default: false }
//   },

 iotDevice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      default: null,
    },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
