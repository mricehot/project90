/* ═══════════════════════════════════════════════
   PROJECT 90 — Service Worker (PWA)
   App shell cacheado pra abrir offline. Dados vêm do
   Supabase (rede) com fallback no espelho localStorage
   do Store — o SW não cacheia chamadas de API.
   Bump CACHE pra invalidar tudo.
═══════════════════════════════════════════════ */
const CACHE = 'p90-shell-v1';
const FONTS = 'p90-fonts-v1';

const ASSETS = [
  './',
  'index.html', 'login.html',
  'dashboard.html', 'habitos.html', 'metricas.html', 'diario.html', 'conquistas.html',
  'vocabulario.html', 'diccao.html', 'biblia.html', 'tarefas.html',
  'css/base.css', 'css/components.css',
  'js/store.js', 'js/ui.js', 'js/achievements.js', 'js/quotes.js',
  'js/supabase.js', 'js/supabase-config.js', 'js/speech-library.js',
  'js/bible-plan.js', 'js/journal-prompts.js', 'js/pwa.js',
  'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(
        ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Outro domínio: Supabase / CDNs passam direto. Fontes do Google → cache runtime.
  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
      event.respondWith(
        caches.open(FONTS).then((cache) =>
          cache.match(req).then((hit) =>
            hit || fetch(req).then((res) => { cache.put(req, res.clone()); return res; })
          )
        )
      );
    }
    return;
  }

  // Navegação (HTML): rede primeiro, cache como fallback offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('dashboard.html')))
    );
    return;
  }

  // Estáticos mesmo domínio: stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        const fetching = fetch(req)
          .then((res) => { cache.put(req, res.clone()); return res; })
          .catch(() => hit);
        return hit || fetching;
      })
    )
  );
});
