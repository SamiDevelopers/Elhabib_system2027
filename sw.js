/* ============================================================
   Service Worker - مركز الحبيب للألحان والدراسات القبطية
   ============================================================ */

const CACHE_NAME = 'habib-center-v1.0.0';
const DYNAMIC_CACHE = 'habib-dynamic-v1.0.0';

// الملفات الأساسية التي يجب تخزينها
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// تنشيط Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// اعتراض الطلبات
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تجاهل الطلبات من Firebase وطلبات API الخارجية
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('cloudflare') ||
      request.method !== 'GET') {
    return;
  }

  // استراتيجية: Cache First مع Fallback للشبكة
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // تحديث الكاش في الخلفية
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }

        const responseClone = networkResponse.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseClone));
        return networkResponse;
      }).catch(() => {
        // في حالة عدم الاتصال، إرجاع الصفحة الرئيسية
        if (request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// استقبال الرسائل من الصفحة الرئيسية
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    });
  }
});

// إشعار Push (اختياري للمستقبل)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'مركز الحبيب';
  const options = {
    body: data.body || 'لديك إشعار جديد',
    icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxOTIgMTkyIj48cmVjdCB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgZmlsbD0iIzBCMUYzQSIgcng9IjI0Ii8+PHRleHQgeD0iOTYiIHk9IjEyMCIgZm9udC1zaXplPSIxMDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiNDOUEyMjciPuKYqTwvdGV4dD48L3N2Zz4=',
    badge: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA5NiA5NiI+PHJlY3Qgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiBmaWxsPSIjMEIxRjNBIiByeD0iMTIiLz48L3N2Zz4=',
    vibrate: [200, 100, 200],
    data: data.url || './'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// عند الضغط على الإشعار
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data || './');
      }
    })
  );
});