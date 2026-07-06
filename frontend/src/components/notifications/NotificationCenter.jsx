import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  FaBell,
  FaCheckDouble,
  FaExclamationTriangle,
  FaInfoCircle,
  FaTimes,
} from "react-icons/fa";
import iotApi from "../../services/iotApi";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function areArraysEqual(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  return a.every((val, i) => val === b[i]);
}

const severityStyles = {
  critical: {
    icon: FaExclamationTriangle,
    toastClass: "border-red-200 bg-red-50 text-red-900",
    badgeClass: "bg-red-100 text-red-700",
    dotClass: "bg-red-500",
  },
  warning: {
    icon: FaExclamationTriangle,
    toastClass: "border-amber-200 bg-amber-50 text-amber-900",
    badgeClass: "bg-amber-100 text-amber-700",
    dotClass: "bg-amber-500",
  },
  info: {
    icon: FaInfoCircle,
    toastClass: "border-sky-200 bg-sky-50 text-sky-900",
    badgeClass: "bg-sky-100 text-sky-700",
    dotClass: "bg-sky-500",
  },
};

function getNotificationId(notification) {
  return notification?._id || notification?.id || `${notification?.title}-${notification?.createdAt}`;
}

function formatNotificationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificationToast({ notification, onDismiss }) {
  const style = severityStyles[notification.severity] || severityStyles.info;
  const Icon = style.icon;

  return (
    <div className={`flex w-full max-w-sm gap-3 rounded-lg border p-3 shadow-lg ${style.toastClass}`}>
      <Icon className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5">{notification.title}</p>
        <p className="mt-1 text-sm leading-5 opacity-90">{notification.message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 opacity-70 transition hover:bg-white/60 hover:opacity-100"
        aria-label="Close notification"
      >
        <FaTimes size={12} />
      </button>
    </div>
  );
}

export default function NotificationCenter() {
  const { user, isAuthenticated } = useAuth();
  const { socket, isRoomJoined } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const seenToastIds = useRef(new Set());

  // ── Web Push Notification Registration ─────────────────────────────────────
  useEffect(() => {
    const registerPush = async () => {
      if (!isAuthenticated || !user) return;

      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          console.warn("[Push] Push notifications not supported in this browser.");
          return;
        }

        // 1. Request permission if not already granted
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }

        if (permission !== "granted") {
          console.warn("[Push] Notification permission not granted.");
          return;
        }

        // 2. Wait for Service Worker registration to be ready
        const reg = await navigator.serviceWorker.ready;
        if (!reg) {
          console.warn("[Push] Service worker registration not ready.");
          return;
        }

        // 3. Fetch VAPID key
        const vapidData = await iotApi.getVapidPublicKey();
        const publicKey = vapidData?.publicKey;
        if (!publicKey) {
          console.warn("[Push] VAPID public key not found on server.");
          return;
        }

        // 4. Get current subscription
        let sub = await reg.pushManager.getSubscription();

        // If subscription exists, verify it uses same VAPID key
        if (sub) {
          const currentKey = sub.options.applicationServerKey;
          const newKey = urlBase64ToUint8Array(publicKey);
          const keysMatch = areArraysEqual(new Uint8Array(currentKey), newKey);

          if (!keysMatch) {
            console.log("[Push] VAPID key mismatch. Resubscribing...");
            await sub.unsubscribe();
            sub = null;
          }
        }

        // 5. Subscribe if no valid subscription exists
        if (!sub) {
          const newKey = urlBase64ToUint8Array(publicKey);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: newKey,
          });
        }

        // 6. Save subscription on backend
        const subJson = sub.toJSON();
        await iotApi.subscribePush(subJson);
        console.log("🚀 [Push] Web Push subscription successfully saved!");
      } catch (err) {
        console.error("❌ [Push] Error registering Web Push:", err);
      }
    };

    registerPush();
  }, [isAuthenticated, user]);

  const showNativeNotification = useCallback((notification) => {
    // Only show native browser notification if tab is in the background
    if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(notification.title, {
          body: notification.message,
          icon: "/pwa-192x192.png",
          tag: getNotificationId(notification),
        });
      } catch (err) {
        console.error("Failed to trigger native browser notification:", err);
      }
    }
  }, []);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.isRead),
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    try {
      const data = await iotApi.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const showPopup = useCallback((notification) => {
    const id = getNotificationId(notification);
    if (!id || seenToastIds.current.has(id)) return;

    seenToastIds.current.add(id);
    toast.custom(
      (toastInstance) => (
        <NotificationToast
          notification={notification}
          onDismiss={() => toast.dismiss(toastInstance.id)}
        />
      ),
      {
        id,
        duration: notification.severity === "critical" ? 9000 : 6000,
        position: "top-right",
      }
    );
  }, []);

  useEffect(() => {
    if (!socket || !isRoomJoined) return;

    const handleNotification = (notification) => {
      const normalized = { ...notification, isRead: false };

      setNotifications((current) => {
        const id = getNotificationId(normalized);
        if (current.some((item) => getNotificationId(item) === id)) return current;
        return [normalized, ...current].slice(0, 50);
      });
      setUnreadCount((count) => count + 1);
      showPopup(normalized);
      showNativeNotification(normalized);
    };

    socket.on("notification", handleNotification);
    return () => socket.off("notification", handleNotification);
  }, [socket, isRoomJoined, showPopup]);

  const markRead = async (notificationId) => {
    if (!notificationId) return;

    setNotifications((current) =>
      current.map((notification) =>
        getNotificationId(notification) === notificationId
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification
      )
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    try {
      await iotApi.markNotificationRead(notificationId);
    } catch (err) {
      console.error("Failed to mark notification read:", err);
      loadNotifications();
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        isRead: true,
        readAt: notification.readAt || new Date().toISOString(),
      }))
    );
    setUnreadCount(0);

    try {
      await iotApi.markAllNotificationsRead();
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
      loadNotifications();
    }
  };

  return (
    <>
      <Toaster position="top-right" />

      <div className="fixed right-16 top-2.5 lg:right-6 lg:top-4 z-40">
        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700"
          aria-label="Open notifications"
        >
          <FaBell />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-bold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <section className="absolute right-0 mt-3 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
                <p className="text-xs text-gray-500">{unreadCount} unread</p>
              </div>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-gray-300"
              >
                <FaCheckDouble size={12} />
                Mark all
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500">
                  No notifications yet.
                </div>
              ) : (
                notifications.map((notification) => {
                  const id = getNotificationId(notification);
                  const style =
                    severityStyles[notification.severity] || severityStyles.info;

                  return (
                    <button
                      type="button"
                      key={id}
                      onClick={() => markRead(id)}
                      className="flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-gray-50"
                    >
                      <span
                        className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                          notification.isRead ? "bg-gray-200" : style.dotClass
                        }`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-sm font-semibold text-gray-900">
                            {notification.title}
                          </span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${style.badgeClass}`}>
                            {notification.severity || "info"}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-gray-600">
                          {notification.message}
                        </span>
                        <span className="mt-2 block text-xs text-gray-400">
                          {formatNotificationTime(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {unreadNotifications.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
                Tap a notification to mark it as read.
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
