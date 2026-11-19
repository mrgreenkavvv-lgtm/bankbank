/* ==========================================================================
   Service worker · Симулятор банка
   Стратегия: cache-first для оболочки, сеть — только как добор.
   Обновление: поднимите VERSION и перезагрузите страницу дважды —
   новый worker поставит новую версию кэша и удалит старую.
   ========================================================================== */

const VERSION = 'v2.8.0';
const CACHE = 'bank-' + VERSION;

const ASSETS = [
  "./",
  "./index.html",
  "./clients.html",
  "./manager.html",
  "./branches.html",
  "./stocks.html",
  "./cbr.html",
  "./more.html",
  "./security.html",
  "./treasury.html",
  "./achievements.html",
  "./onboarding.html",
  "./profile.html",
  "./reports.html",
  "./notifications.html",
  "./css/tokens.css",
  "./css/components.css",
  "./js/state.js",
  "./js/engine.js",
  "./js/ui.js",
  "./js/prototype.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/fonts/fonts.css",
  "./assets/fonts/q5uCsoe9Lv5t7Meb31EcEx18hLxR.woff2",
  "./assets/fonts/q5uCsoe9Lv5t7Meb31EcEx58hLxR.woff2",
  "./assets/fonts/q5uCsoe9Lv5t7Meb31EcExN8hA.woff2",
  "./assets/fonts/q5uCsoe9Lv5t7Meb31EcExd8hLxR.woff2",
  "./assets/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx3cwhsk.woff2",
  "./assets/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx7cwhsk.woff2",
  "./assets/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxDcwg.woff2",
  "./assets/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxPcwhsk.woff2",
  "./assets/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPxTcwhsk.woff2",
  "./assets/fonts/tDbv2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwBNntkaToggR7BYRbKPx_cwhsk.woff2"
];

/* Установка: складываем оболочку в кэш */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* Активация: чистим старые версии */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE && key.indexOf('bank-') === 0) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* Запросы: сначала кэш, потом сеть. Ответ сети кладём в кэш. */
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;

      return fetch(request).then(function (response) {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        var copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        return response;
      }).catch(function () {
        /* оффлайн: навигацию отдаём оболочкой */
        if (request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
