// models/PushSubscription.js
const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscription: {
      endpoint: {
        type: String,
        required: true,
      },
      keys: {
        p256dh: {
          type: String,
          required: true,
        },
        auth: {
          type: String,
          required: true,
        },
      },
    },
  },
  { timestamps: true }
);

// Prevent duplicate subscriptions for same endpoint
pushSubscriptionSchema.index({ "subscription.endpoint": 1 }, { unique: true });
pushSubscriptionSchema.index({ user: 1 });

module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);
