import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

// Claim clients immediately on activation
self.skipWaiting();
clientsClaim();

// Precache resources compiled by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

cleanupOutdatedCaches();

// Listen to push events
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'DHARAA Alert', message: event.data.text() };
    }
  }

  const options = {
    body: data.message || 'New alert from DHARAA',
    icon: '/pwa-192x192.png',
    badge: '/logo.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/iot',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'DHARAA Alert', options)
  );
});

// Listen to notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a client window is already open and on the iot page, focus it
      for (const client of clientList) {
        if (client.url.includes('/iot') && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data?.url || '/iot');
      }
    })
  );
});
