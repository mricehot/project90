/* ═══════════════════════════════════════════════
   PROJECT 90 — Service Worker (PWA)
   App shell cacheado pra abrir offline. Dados vêm do
   Supabase (rede) com fallback no espelho localStorage
   do Store — o SW não cacheia chamadas de API.
   Bump CACHE pra invalidar tudo.
═══════════════════════════════════════════════ */
importScripts('js/idb.js');

const CACHE = 'p90-shell-v26';
const FONTS = 'p90-fonts-v1';

const ASSETS = [
  './',
  'index.html', 'login.html',
  'dashboard.html', 'habitos.html', 'metricas.html', 'diario.html', 'conquistas.html',
  'vocabulario.html', 'diccao.html', 'biblia.html', 'tarefas.html', 'faculdade.html', 'treino.html', 'financeiro.html', 'biblioteca.html',
  'css/base.css', 'css/components.css',
  'js/store.js', 'js/ui.js', 'js/achievements.js', 'js/quotes.js',
  'js/supabase.js', 'js/supabase-config.js', 'js/speech-library.js', 'js/reading-texts.js',
  'js/bible-plan.js', 'js/journal-prompts.js', 'js/pwa.js', 'js/idb.js',
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

/* ── LEMBRETE DIÁRIO ──
   O navegador acorda o SW de vez em quando (periodic background sync, só
   em PWA instalado no Chrome/Android). Aqui a gente checa a config
   (gravada em IndexedDB pela página) e dispara a notificação uma vez por
   dia, depois da hora escolhida. Não é pontual — é "mais ou menos". */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'p90-reminder') event.waitUntil(maybeRemind());
});

async function maybeRemind() {
  let cfg;
  try { cfg = await self.p90idb.get('reminder'); } catch (e) { return; }
  if (!cfg || !cfg.enabled) return;

  const now = new Date();
  if (now.getHours() < cfg.hour) return;

  const today = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
  let last;
  try { last = await self.p90idb.get('reminderFired'); } catch (e) { last = null; }
  if (last === today) return;

  try { await self.p90idb.set('reminderFired', today); } catch (e) {}
  await self.registration.showNotification('Project 90', {
    body: 'Hora de fechar o dia — dá uma olhada nos hábitos.',
    tag: 'p90-daily', renotify: true,
    icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    data: { url: 'dashboard.html' },
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || 'dashboard.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.indexOf(url) !== -1 && 'focus' in w) return w.focus();
      }
      if (wins[0] && 'navigate' in wins[0]) { wins[0].navigate(url); return wins[0].focus(); }
      return self.clients.openWindow(url);
    })
  );
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

  // Navegação (HTML) + código (JS/CSS): rede primeiro, cache só como fallback
  // offline. Assim uma correção publicada vale já na próxima abertura — antes,
  // JS/CSS eram stale-while-revalidate e todo deploy ficava "uma abertura
  // atrás" (foi o que segurou os fixes de menu mobile no PWA instalado).
  if (req.mode === 'navigate' || /\.(?:js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) =>
            hit || (req.mode === 'navigate' ? caches.match('dashboard.html') : undefined)
          )
        )
    );
    return;
  }

  // Demais estáticos mesmo domínio (ícones, manifest, imagens): stale-while-revalidate.
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
