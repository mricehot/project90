/* Registra o service worker (PWA). Sem efeito onde não há suporte. */
(function () {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // se uma versão nova ficou "waiting", ativa na próxima navegação
      if (reg.waiting) reg.waiting.postMessage('skipWaiting');
      reg.addEventListener('updatefound', function () {
        var sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', function () {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            sw.postMessage('skipWaiting');
          }
        });
      });
    }).catch(function (e) {
      console.warn('[Project 90] service worker não registrou:', e);
    });
  });

  // recarrega só quando um SW NOVO assume (update) — não no primeiro claim
  var hadController = !!navigator.serviceWorker.controller;
  var reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
})();

/* Barra de rolagem acende no branco enquanto rola e volta pro cinza ao parar.
   O CSS (css/base.css + páginas self-contained) faz a cor; aqui só a classe. */
(function () {
  try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  var root = document.documentElement, timer;
  function onScroll() {
    root.classList.add('sb-scrolling');
    clearTimeout(timer);
    timer = setTimeout(function () { root.classList.remove('sb-scrolling'); }, 500);
  }
  window.addEventListener('scroll', onScroll, { capture: true, passive: true });
})();
