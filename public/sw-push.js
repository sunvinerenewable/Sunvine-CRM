// Sunvine Solar EPC - Web Push Notification & Deep-Linking Service Worker Script
// Handles OS-level Push events and notification click navigation across Desktop and Mobile

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: 'Sunvine Portal Notification',
        body: event.data.text()
      };
    }
  } else {
    payload = {
      title: '📁 Sunvine Solar EPC',
      body: 'New solar customer application created.'
    };
  }

  const title = payload.title || '📁 Sunvine Solar EPC Alert';
  const fileId = payload.fileId || payload.data?.fileId || '';
  const targetUrl = payload.url || payload.data?.url || (fileId ? `/?openFile=${fileId}&tab=applications` : '/?tab=applications');

  const options = {
    body: payload.body || 'A new customer file has been registered.',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/favicon.ico',
    image: payload.image || undefined,
    tag: payload.tag || (fileId ? `sunvine-file-${fileId}` : `sunvine-alert-${Date.now()}`),
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      fileId,
      url: targetUrl,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open_file', title: 'Open Application' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const clickData = event.notification.data || {};
  const targetUrl = clickData.url || '/?tab=applications';
  const targetFileId = clickData.fileId;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          if (targetFileId) {
            client.postMessage({
              type: 'SUNVINE_OPEN_FILE',
              fileId: targetFileId
            });
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
