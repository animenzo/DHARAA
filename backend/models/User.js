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


 iotDevice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      default: null,
    },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
