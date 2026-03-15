/* ═══════════════════════════════════════════════
   PROJECT 90 — UI
   Comportamentos de UI compartilhados por todas
   as páginas de app. Não contém lógica de negócio.
═══════════════════════════════════════════════ */

/* ── CURSOR ── */
(function initCursor() {
  const cur  = document.getElementById('cur');
  const ring = document.getElementById('cur-ring');
  if (!cur || !ring) return;
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cur.style.transform = `translate(${mx - 3}px, ${my - 3}px)`;
  });
  (function tick() {
    rx += (mx - rx - 15) * 0.1;
    ry += (my - ry - 15) * 0.1;
    ring.style.transform = `translate(${rx}px, ${ry}px)`;
    requestAnimationFrame(tick);
  })();
})();

/* ── NAV SCROLL STATE (landing) ── */
(function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ── SCROLL REVEAL ── */
(function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
})();

/* ── FAQ ACCORDION ── */
(function initFaq() {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
})();

/* ── TOOLTIP ── */
const _tip = document.getElementById('tip');
let _tipVisible = false;

function showTip(e, html) {
  if (!_tip) return;
  _tip.innerHTML = html;
  _tip.classList.add('on');
  _tipVisible = true;
  _moveTip(e);
}
function hideTip() {
  if (!_tip) return;
  _tip.classList.remove('on');
  _tipVisible = false;
}
function _moveTip(e) {
  if (!_tip) return;
  _tip.style.left = (e.clientX + 14) + 'px';
  _tip.style.top  = (e.clientY - 28) + 'px';
}
document.addEventListener('mousemove', e => { if (_tipVisible) _moveTip(e); });

/* ── TOAST ── */
let _toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ── SIDEBAR — init com dados reais ── */
function initSidebar() {
  if (!document.querySelector('.sidebar')) return;

  const meta    = Store.getMeta();
  const habits  = Store.getHabits();
  const DAY     = meta.currentDay;
  const DAYS    = meta.totalDays;
  const pct     = Math.round((DAY / DAYS) * 100);

  // dia e progresso
  const dnEl = document.getElementById('sb-daynum');
  const pctEl = document.getElementById('sb-pct');
  const fillEl = document.getElementById('sb-fill');
  const leftEl = document.getElementById('sb-days-left');
  if (dnEl)   dnEl.textContent   = DAY;
  if (pctEl)  pctEl.textContent  = pct + '%';
  if (leftEl) leftEl.textContent = (DAYS - DAY) + ' restantes';
  if (fillEl) setTimeout(() => { fillEl.style.width = pct + '%'; }, 300);

  // streak
  const streakEl = document.getElementById('sb-streak-val');
  if (streakEl) {
    const streak = Store.currentStreak(habits, DAY);
    streakEl.textContent = streak;
  }
}

/* ── TOPBAR DATE ── */
function initTopbarDate(dateElId, dayElId) {
  const meta    = Store.getMeta();
  const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const MONTHS  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const now     = new Date();

  const dateEl = document.getElementById(dateElId);
  const dayEl  = document.getElementById(dayElId);
  if (dateEl) dateEl.textContent = `${DAYS_PT[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  if (dayEl)  dayEl.textContent  = `Dia ${meta.currentDay} / ${meta.totalDays}`;
}

/* ── PROGRESS BAR ANIMATE ON SCROLL ── */
function animateProgressOnScroll(fillId, targetPct) {
  const fill = document.getElementById(fillId);
  if (!fill) return;
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      setTimeout(() => { fill.style.width = targetPct + '%'; }, 300);
      obs.disconnect();
    }
  }, { threshold: 0.5 });
  obs.observe(fill);
}
