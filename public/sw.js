/* Hisaabook service worker — push-only (no offline caching in v1). */
/* eslint-disable no-restricted-globals */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'Hisaabook', body: event.data ? event.data.text() : 'New activity in your books' }; }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Hisaabook';
  const options = {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: typeof data.tag === 'string' ? data.tag.slice(0, 32) : 'hisaabook',
    data: { href: typeof data.href === 'string' ? data.href : '/' },
    vibrate: [100, 40, 100],
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const href = (event.notification.data && event.notification.data.href) || '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        try { if ('navigate' in client) await client.navigate(href); } catch { /* cross-origin guard */ }
        return client.focus();
      }
    }
    return self.clients.openWindow(href);
  })());
});
