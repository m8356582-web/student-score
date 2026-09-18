/* ============================================
   📱 Service Worker (PWA)
   ============================================ */

const CACHE_NAME = 'student-scores-v3';
const CACHE_URLS = [
  './',
  './index.html',
  './login.html',
  './admin.html',
  './style.css',
  './supabase.js',
  './app.js',
  './admin.js',
  './import.js',
  './ai-engine.js',
  './dashboard.js',
  './export.js',
  './notifications.js',
  './badges.js',
  './autocomplete.js',
  './manifest.json'
];

/* ============================================
   نصب
   ============================================ */
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker نصب شد');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 کش کردن فایل‌ها...');
        return cache.addAll(CACHE_URLS.map(url => {
          return new Request(url, { cache: 'reload' });
        })).catch(err => {
          console.warn('خطا در کش بعضی فایل‌ها:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

/* ============================================
   فعال‌سازی
   ============================================ */
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker فعال شد');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('🗑️ پاک کردن کش قدیمی:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/* ============================================
   Fetch — استراتژی Cache First
   ============================================ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // درخواست‌های Supabase → Network Only
  if (url.hostname.includes('supabase')) {
    event.respondWith(fetch(request));
    return;
  }

  // درخواست‌های CDN → Cache First
  if (url.hostname.includes('cdn.jsdelivr.net') || 
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // فایل‌های داخلی → Cache First, Network Fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // به‌روزرسانی تو پس‌زمینه
        fetch(request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => {
        // اگه آفلاین بود و صفحه HTML خواست
        if (request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/* ============================================
   پیام‌ها از صفحه
   ============================================ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});
