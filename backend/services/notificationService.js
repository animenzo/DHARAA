// backend/services/notificationService.js
// =============================================================================
// Centralized Notification Service
// =============================================================================
// Sends notifications in real-time via Socket.IO and in the background via
// PWA Web Push notifications using VAPID keys.
// =============================================================================

const webpush = require("web-push");
const PushSubscription = require("../models/PushSubscription");
const { emitToUser } = require("./socketService");

// Initialize web-push if keys are available
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL || "mailto:piyush.tailor.5076@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log("✅ Web Push service configured");
} else {
  console.warn("⚠️  Web Push VAPID keys are not configured. Background push notifications will be disabled.");
}

/**
 * Send a notification to a specific user via Socket.IO and Web Push.
 *
 * @param {string|ObjectId} userId - The user ID to send the notification to.
 * @param {Object} notification - The notification object/document.
 */
async function sendNotification(userId, notification) {
  if (!userId) return;
  const userIdStr = userId.toString();

  // 1. Send real-time Socket.IO event (for active browser sessions)
  emitToUser(userIdStr, "notification", {
    _id: notification._id,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    severity: notification.severity,
    context: notification.context,
    createdAt: notification.createdAt,
  });

  // 2. Send Web Push Notification (for background/closed PWA app)
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return;
  }

  try {
    const subscriptions = await PushSubscription.find({ user: userIdStr }).lean();
    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: notification.title,
      message: notification.message,
      id: notification._id,
      url: "/iot",
    });

    const sendPromises = subscriptions.map((sub) => {
      return webpush
        .sendNotification(
          {
            endpoint: sub.subscription.endpoint,
            keys: {
              auth: sub.subscription.keys.auth,
              p256dh: sub.subscription.keys.p256dh,
            },
          },
          payload
        )
        .catch(async (err) => {
          // If subscription is expired or no longer valid, delete it
          if (err.statusCode === 404 || err.statusCode === 410) {
            console.log(`[PushService] Removing expired subscription for endpoint: ${sub.subscription.endpoint}`);
            await PushSubscription.deleteOne({ _id: sub._id });
          } else {
            console.error("[PushService] Failed to send push notification:", err.message);
          }
        });
    });

    await Promise.all(sendPromises);
  } catch (err) {
    console.error("[PushService] Error in sendNotification:", err.message);
  }
}

module.exports = {
  sendNotification,
};
