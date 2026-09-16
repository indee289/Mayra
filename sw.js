/* ═══════════════════════════════════════════════════════════
   SERVICE WORKER — Priya ki Dost (Mayra)
   Enables offline app-shell loading and proper PWA install.

   Strategy:
   - App shell (local HTML/CSS/JS/icons/svg): cache-first, so the
     UI opens instantly and works offline.
   - Google Fonts: stale-while-revalidate (nice-to-have, cached).
   - LLM API traffic (Gemini generativelanguage.googleapis.com,
     Groq api.groq.com, OpenAI api.openai.com):
     NEVER cached — always network. (Real-time + privacy.)
   - WebSocket (voice) traffic bypasses the SW entirely by nature.
═══════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'mayra-v2.0.1';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE   = `runtime-${CACHE_VERSION}`;

/* Local assets that make up the app shell. Relative paths so it
   works from any base (root deploy, subpath, or Capacitor file://). */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/storage.js',
  './js/android-bridge.js',
  './js/functions.js',
  './js/gemini-voice.js',
  './js/gemini-chat.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/iconsax/iconsax-sprite.svg',
];

/* ── Install: pre-cache the app shell ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL).catch((err) => {
        /* Don't fail the whole install if one optional asset 404s */
        console.warn('[SW] Some shell assets failed to cache:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: clean up old caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: route by request type ── */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  /* Only handle GET */
  if (req.method !== 'GET') return;

  /* NEVER cache LLM API traffic (Gemini / Groq / OpenAI) or live-info
     APIs (Open-Meteo weather / Google News RSS) — always live network. */
  if (url.hostname.includes('generativelanguage.googleapis.com') ||
      url.hostname.includes('api.groq.com') ||
      url.hostname.includes('api.openai.com') ||
      url.hostname.includes('api.open-meteo.com') ||
      url.hostname.includes('news.google.com')) {
    return; /* let the browser handle it normally */
  }

  /* Google Fonts — stale-while-revalidate */
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  /* Same-origin app shell / assets — cache-first */
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  /* Everything else — network, fall back to cache if offline */
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

/* ── Strategies ── */
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200 && res.type === 'basic') {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    /* Offline and not cached — for navigations, serve the shell */
    if (req.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw e;
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}
