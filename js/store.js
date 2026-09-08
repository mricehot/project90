/* ═══════════════════════════════════════════════
   PROJECT 90 — STORE (backend: Supabase)

   Fonte única de verdade para todos os dados. As páginas continuam
   lendo/gravando pelos MESMOS métodos síncronos de antes
   (Store.getHabits(), Store.saveHabits(), …). Por baixo:

     • No carregamento, hidrata um cache em memória a partir de
       localStorage['p90_cache'] (espelho offline) — leitura síncrona.
     • Store.bootstrap() (dispara sozinho) confere a sessão do Supabase,
       redireciona para login.html se não houver, e recarrega o cache
       via RPC app_bootstrap(). Ao terminar, emite o evento
       window 'p90:synced' para as páginas re-renderizarem.
     • Cada save atualiza o cache na hora (UI responsiva) e envia a
       gravação para o Supabase em segundo plano.

   Espelho localStorage:  p90_cache  → { meta, currentDay, habits,
                                         journal, weeklyReviews, achievements,
                                         vocabWords, vocabQuiz }
═══════════════════════════════════════════════ */

const Store = (() => {

  const MIRROR_KEY        = 'p90_cache';
  const DEFAULT_TOTAL_DAYS = 90;

  /* ──────────────────────────────────────────
     CACHE
  ────────────────────────────────────────── */
  function _emptyCache() {
    return {
      meta:          { totalDays: DEFAULT_TOTAL_DAYS, freezesLeft: 2, frozenDays: [] },
      currentDay:    null,
      habits:        [],
      journal:       {},
      weeklyReviews: {},
      achievements:  {},
      vocabWords:    [],
      vocabQuiz:     { roundsPlayed: 0, totalAnswered: 0, totalCorrect: 0, bestStreak: 0 },
      speechExercises: [],
      speechStats:   { sessionsPlayed: 0, repsTotal: 0, ratingSum: 0, ratingCount: 0, bestStreak: 0 },
      speechDays:    {},
      bibleDays:     {},
      tasks:         [],
      taskDone:      {},
      wins:          [],
      streakCounters: [],
      closeouts:     {},
    };
  }

  let cache = _hydrateMirror();
  let _uid  = null;
  let _ready = false;
  let _readyPromise = null;

  function _hydrateMirror() {
    try {
      const raw = localStorage.getItem(MIRROR_KEY);
      if (raw) return Object.assign(_emptyCache(), JSON.parse(raw));
    } catch (e) {}
    return _emptyCache();
  }

  function _saveMirror() {
    try { localStorage.setItem(MIRROR_KEY, JSON.stringify(cache)); } catch (e) {}
  }

  // Atualiza o cache SEM trocar as referências de cache.habits / cache.journal /
  // cache.achievements — as páginas guardam essas referências em variáveis locais
  // no carregamento, então mutamos no lugar em vez de reatribuir.
  function _applyServerData(data) {
    if (!data) return;

    if (data.meta) {
      cache.meta.startDate    = data.meta.startDate || cache.meta.startDate;
      cache.meta.totalDays    = data.meta.totalDays || DEFAULT_TOTAL_DAYS;
      cache.meta.timezone     = data.meta.timezone || cache.meta.timezone || 'UTC';
      cache.meta.freezesLeft  = data.meta.freezesLeft != null ? data.meta.freezesLeft : 2;
      cache.meta.frozenDays   = Array.isArray(data.meta.frozenDays) ? data.meta.frozenDays : [];
    }
    if (data.currentDay) cache.currentDay = data.currentDay;

    if (Array.isArray(data.habits)) {
      cache.habits.length = 0;
      data.habits.map(_rowToHabit).forEach(h => cache.habits.push(h));
    }
    if (data.journal && typeof data.journal === 'object') {
      Object.keys(cache.journal).forEach(k => delete cache.journal[k]);
      Object.assign(cache.journal, data.journal);
    }
    if (data.weeklyReviews && typeof data.weeklyReviews === 'object') {
      Object.keys(cache.weeklyReviews).forEach(k => delete cache.weeklyReviews[k]);
      Object.assign(cache.weeklyReviews, data.weeklyReviews);
    }
    if (data.achievements && typeof data.achievements === 'object') {
      Object.keys(cache.achievements).forEach(k => delete cache.achievements[k]);
      Object.assign(cache.achievements, data.achievements);
    }
    if (Array.isArray(data.vocabWords)) {
      cache.vocabWords.length = 0;
      data.vocabWords.map(_rowToVocabWord).forEach(w => cache.vocabWords.push(w));
    }
    if (data.vocabQuiz && typeof data.vocabQuiz === 'object') {
      cache.vocabQuiz.roundsPlayed  = data.vocabQuiz.roundsPlayed  || 0;
      cache.vocabQuiz.totalAnswered = data.vocabQuiz.totalAnswered || 0;
      cache.vocabQuiz.totalCorrect  = data.vocabQuiz.totalCorrect  || 0;
      cache.vocabQuiz.bestStreak    = data.vocabQuiz.bestStreak    || 0;
    }
    if (Array.isArray(data.speechExercises)) {
      cache.speechExercises.length = 0;
      data.speechExercises.map(_rowToSpeechExercise).forEach(s => cache.speechExercises.push(s));
    }
    if (data.speechStats && typeof data.speechStats === 'object') {
      cache.speechStats.sessionsPlayed = data.speechStats.sessionsPlayed || 0;
      cache.speechStats.repsTotal      = data.speechStats.repsTotal      || 0;
      cache.speechStats.ratingSum      = data.speechStats.ratingSum      || 0;
      cache.speechStats.ratingCount    = data.speechStats.ratingCount    || 0;
      cache.speechStats.bestStreak     = data.speechStats.bestStreak     || 0;
    }
    if (data.speechDays && typeof data.speechDays === 'object') {
      Object.keys(cache.speechDays).forEach(k => delete cache.speechDays[k]);
      Object.assign(cache.speechDays, data.speechDays);
    }
    if (data.bibleDays && typeof data.bibleDays === 'object') {
      Object.keys(cache.bibleDays).forEach(k => delete cache.bibleDays[k]);
      Object.assign(cache.bibleDays, data.bibleDays);
    }
    if (Array.isArray(data.tasks)) {
      cache.tasks.length = 0;
      data.tasks.map(_rowToTask).forEach(t => cache.tasks.push(t));
    }
    if (data.taskDone && typeof data.taskDone === 'object') {
      Object.keys(cache.taskDone).forEach(k => delete cache.taskDone[k]);
      Object.keys(data.taskDone).forEach(k => {
        cache.taskDone[k] = (data.taskDone[k] || []).map(d => String(d).slice(0, 10)).sort();
      });
    }
    if (Array.isArray(data.wins)) {
      cache.wins.length = 0;
      data.wins.map(_rowToWin).forEach(w => cache.wins.push(w));
    }
    if (Array.isArray(data.streakCounters)) {
      cache.streakCounters.length = 0;
      data.streakCounters.map(_rowToCounter).forEach(c => cache.streakCounters.push(c));
    }
    if (data.closeouts && typeof data.closeouts === 'object') {
      _replaceObject(cache.closeouts, data.closeouts);
    }
  }

  function _rowToWin(w) {
    return {
      id:        w.id,
      text:      w.text || '',
      dayNum:    w.dayNum != null ? w.dayNum : (w.day_num != null ? w.day_num : null),
      createdAt: w.createdAt || w.created_at || new Date().toISOString(),
    };
  }

  function _rowToCounter(c) {
    const ls = c.lastSlip  != null ? c.lastSlip  : c.last_slip;
    const sd = c.startDate != null ? c.startDate : c.start_date;
    return {
      id:        c.id,
      label:     c.label || '',
      lastSlip:  ls ? String(ls).slice(0, 10) : null,
      startDate: sd ? String(sd).slice(0, 10) : null,
      bestRun:   c.bestRun != null ? c.bestRun : (c.best_run != null ? c.best_run : 0),
      createdAt: c.createdAt || c.created_at || new Date().toISOString(),
    };
  }

  function _rowToTask(t) {
    return {
      id:           t.id,
      title:        t.title || '',
      notes:        t.notes || '',
      sched:        t.sched || 'once',
      intervalDays: t.intervalDays != null ? t.intervalDays : (t.interval_days != null ? t.interval_days : null),
      weekdays:     Array.isArray(t.weekdays) ? t.weekdays : [],
      overdue:      t.overdue || 'accumulate',
      anchor:       t.anchor ? String(t.anchor).slice(0, 10) : null,
      archived:     !!t.archived,
      createdAt:    t.createdAt || t.created_at || new Date().toISOString(),
    };
  }

  function _rowToVocabWord(w) {
    const due  = w.srsDue  != null ? w.srsDue  : w.srs_due;
    const last = w.srsLast != null ? w.srsLast : w.srs_last;
    return {
      id:        w.id,
      word:      w.word,
      meaning:   w.meaning,
      example:   w.example || '',
      createdAt: w.createdAt || w.created_at || new Date().toISOString(),
      srsBox:     w.srsBox     != null ? w.srsBox     : (w.srs_box     != null ? w.srs_box     : 1),
      srsDue:     due  ? String(due).slice(0, 10)  : _localDate(0),
      srsReviews: w.srsReviews != null ? w.srsReviews : (w.srs_reviews != null ? w.srs_reviews : 0),
      srsLapses:  w.srsLapses  != null ? w.srsLapses  : (w.srs_lapses  != null ? w.srs_lapses  : 0),
      srsLast:    last ? String(last).slice(0, 10) : null,
    };
  }

  function _rowToSpeechExercise(s) {
    return {
      id:        s.id,
      title:     s.title,
      body:      s.body,
      kind:      s.kind || 'trava-lingua',
      focus:     s.focus || '',
      createdAt: s.createdAt || s.created_at || new Date().toISOString(),
    };
  }

  function _rowToHabit(h) {
    return {
      id:         h.id,
      name:       h.name,
      pillar:     h.pillar,
      freq:       Array.isArray(h.freq) ? h.freq : [],
      goal:       h.goal || '',
      streak:     h.streak || 0,
      maxStreak:  h.maxStreak != null ? h.maxStreak : (h.max_streak || 0),
      paused:     !!h.paused,
      createdDay: h.createdDay != null ? h.createdDay : (h.created_day || 1),
      history:    Array.isArray(h.history) ? h.history : [],
      coreKey:    h.coreKey != null ? h.coreKey : (h.core_key != null ? h.core_key : null),
    };
  }

  function _habitToRow(h, idx) {
    return {
      id:          h.id,
      user_id:     _uid,
      name:        h.name,
      pillar:      h.pillar || null,
      freq:        Array.isArray(h.freq) ? h.freq : [],
      goal:        h.goal || '',
      streak:      h.streak || 0,
      max_streak:  h.maxStreak || 0,
      paused:      !!h.paused,
      created_day: h.createdDay || 1,
      history:     Array.isArray(h.history) ? h.history : [],
      sort_order:  idx,
      core_key:    h.coreKey != null ? h.coreKey : null,
    };
  }

  /* ──────────────────────────────────────────
     PUSH — envia gravações para o Supabase em 2º plano
  ────────────────────────────────────────── */
  let _chain = Promise.resolve();

  function _push(fn) {
    _chain = _chain.then(async () => {
      try { await _readyPromise; } catch (e) {}  // espera o bootstrap resolver _uid
      if (!window.sb || !_uid) return;            // sem sessão → fica só no cache/espelho
      try { await fn(); }
      catch (e) {
        console.error('[Project 90] falha ao sincronizar com o Supabase:', e);
        if (typeof toast === 'function') toast('Falha ao salvar online — tentando de novo depois.');
      }
    });
    return _chain;
  }

  /* ──────────────────────────────────────────
     BOOTSTRAP — sessão + carga inicial
  ────────────────────────────────────────── */
  function _redirectToLogin() {
    if (/login\.html$/.test(location.pathname)) return;
    location.replace('login.html');
  }

  function _wireLogout() {
    document.querySelectorAll('.sb-logout').forEach(el => {
      el.addEventListener('click', async (e) => {
        e.preventDefault();
        try { await window.sb.auth.signOut(); } catch (err) {}
        try { localStorage.removeItem(MIRROR_KEY); } catch (err) {}
        location.replace('login.html');
      });
    });
  }

  // Injeta a barra superior mobile (logo + hambúrguer) e transforma a sidebar
  // num drawer lateral abaixo de 900px. Sem tocar no HTML das páginas — o CSS
  // do drawer mora em css/components.css e só vale no breakpoint mobile.
  function _wireMobileNav() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar || document.querySelector('.mobile-topbar')) return;

    if (!sidebar.id) sidebar.id = 'p90-sidebar';

    // nome da seção atual (sem a sidebar visível no mobile, é a única pista de "onde estou")
    const activeItem = sidebar.querySelector('.sb-item.active');
    const section = activeItem
      ? activeItem.textContent.replace(/^[^A-Za-zÀ-ÿ]+/, '').trim()
      : (document.title.split('—')[1] || '').trim();

    const bar = document.createElement('div');
    bar.className = 'mobile-topbar';
    bar.innerHTML =
      '<button class="hamburger" type="button" aria-label="Abrir menu" ' +
        'aria-expanded="false" aria-controls="' + sidebar.id + '">☰</button>' +
      '<a class="mt-logo" href="index.html">Project 90</a>' +
      (section ? '<span class="mt-page">' + section + '</span>' : '');

    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';

    // A barra e o backdrop ficam DENTRO de `.app`: a `.sidebar` mora ali e
    // `.app` tem `position:relative;z-index:1` (contexto de empilhamento p/
    // o canvas de fundo). Se o backdrop ficasse no <body>, ele cobriria o
    // drawer inteiro — menu escuro e links não clicáveis no mobile.
    const shell = sidebar.parentElement || document.body;
    shell.insertBefore(bar, shell.firstChild);
    shell.appendChild(backdrop);

    const btn = bar.querySelector('.hamburger');
    const open = () => {
      document.body.classList.add('nav-open');
      sidebar.classList.add('open');
      backdrop.classList.add('show');
      btn.setAttribute('aria-expanded', 'true');
      btn.textContent = '✕';
    };
    const close = () => {
      document.body.classList.remove('nav-open');
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '☰';
    };

    btn.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
    backdrop.addEventListener('click', close);
    sidebar.querySelectorAll('.sb-item').forEach(a => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('open')) close();
    });
  }

  // Apaga todo o progresso e recomeça do zero (chama a RPC reset_progress).
  async function resetProgress() {
    try { await _readyPromise; } catch (e) {}
    if (!window.sb || !_uid) throw new Error('sem sessão');
    const { error } = await window.sb.rpc('reset_progress');
    if (error) throw error;
    try { localStorage.removeItem(MIRROR_KEY); } catch (e) {}
    location.reload();
  }

  // Injeta o botão "Resetar progresso" na sidebar e o modal de confirmação
  // (estilo da página, via CSS vars). Não precisa mexer no HTML das páginas.
  function _wireReset() {
    const bottom = document.querySelector('.sb-bottom');
    if (!bottom || bottom.querySelector('.sb-reset')) return;

    const btn = document.createElement('a');
    btn.className = 'sb-reset';
    btn.textContent = '↺ Resetar progresso';
    btn.style.cssText =
      'display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:10px;' +
      'font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mid);' +
      'transition:color .2s;text-decoration:none;';
    btn.addEventListener('mouseover', () => { btn.style.color = 'var(--red)'; });
    btn.addEventListener('mouseout',  () => { btn.style.color = 'var(--mid)'; });
    btn.addEventListener('click', _openResetModal);
    bottom.appendChild(btn);
  }

  function _openResetModal() {
    if (document.getElementById('p90-reset-modal')) return;

    const ov = document.createElement('div');
    ov.id = 'p90-reset-modal';
    ov.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;background:rgba(8,8,8,.85);' +
      'display:flex;align-items:center;justify-content:center;padding:24px;' +
      'font-family:\'DM Mono\',monospace;';
    ov.innerHTML =
      '<div style="background:var(--surface,#111);border:1px solid var(--border2,rgba(245,245,240,.16));' +
      'max-width:440px;width:100%;padding:36px 40px;">' +
        '<div style="font-family:\'DM Serif Display\',serif;font-size:24px;color:var(--white,#f5f5f0);margin-bottom:16px;">' +
          'Resetar tudo?' +
        '</div>' +
        '<p style="font-size:12px;line-height:1.9;color:var(--mid,#999);margin-bottom:8px;">' +
          'Isso apaga <b style="color:var(--white,#f5f5f0)">todo o seu progresso</b> — hábitos, ' +
          'histórico, entradas do diário, revisões semanais, vocabulário, dicção, plano da Bíblia, tarefas, banco de provas, contadores e conquistas — e reinicia ' +
          'o desafio no dia 1. Os hábitos fixos voltam ao estado inicial.' +
        '</p>' +
        '<p style="font-size:11px;letter-spacing:.06em;color:var(--red,#fca5a5);margin-bottom:24px;">' +
          'Esta ação não pode ser desfeita.' +
        '</p>' +
        '<div id="p90-reset-err" style="font-size:11px;color:var(--red,#fca5a5);margin-bottom:14px;display:none;"></div>' +
        '<div style="display:flex;gap:10px;">' +
          '<button id="p90-reset-cancel" style="flex:1;padding:12px;font-family:inherit;font-size:11px;' +
            'letter-spacing:.14em;text-transform:uppercase;cursor:pointer;background:none;' +
            'border:1px solid var(--border2,rgba(245,245,240,.16));color:var(--mid,#999);">Cancelar</button>' +
          '<button id="p90-reset-confirm" style="flex:1;padding:12px;font-family:inherit;font-size:11px;' +
            'letter-spacing:.14em;text-transform:uppercase;cursor:pointer;border:none;' +
            'background:var(--red,#fca5a5);color:#080808;">Sim, apagar tudo</button>' +
        '</div>' +
      '</div>';

    function close() { ov.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }

    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);

    ov.querySelector('#p90-reset-cancel').addEventListener('click', close);
    const confirm = ov.querySelector('#p90-reset-confirm');
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      confirm.textContent = 'Apagando…';
      try {
        await resetProgress();
      } catch (err) {
        console.error('[Project 90] reset_progress falhou:', err);
        confirm.disabled = false;
        confirm.textContent = 'Sim, apagar tudo';
        const el = ov.querySelector('#p90-reset-err');
        el.textContent = 'Não foi possível resetar agora. Tente de novo.';
        el.style.display = 'block';
      }
    });
  }

  // Recalcula streak (corrida de 'done') e maxStreak (nunca diminui) a partir
  // do array. Dias fora da frequência do hábito são ignorados — não quebram
  // nem contam. Devolve true se mudou algo.
  function _recalcStreak(h) {
    const base = (h.createdDay || 1) - 1;
    let cur = 0, best = 0;
    for (let i = 0; i < h.history.length; i++) {
      if (!scheduledOn(h, base + i)) continue;
      if (h.history[i] === 'done') { cur++; if (cur > best) best = cur; }
      else cur = 0;
    }
    let changed = false;
    if (h.streak !== cur) { h.streak = cur; changed = true; }
    if ((h.maxStreak || 0) < best) { h.maxStreak = best; changed = true; }
    return changed;
  }

  // Avança o histórico de cada hábito até o dia atual (preenche com 'miss' os
  // dias não registrados) e recalcula os streaks. Devolve true se mudou algo.
  function _rollForward() {
    const today = getCurrentDay();
    let changed = false;
    cache.habits.forEach(h => {
      const want = today - ((h.createdDay || 1) - 1);
      if (want < 1) return;
      if (!Array.isArray(h.history)) h.history = [];
      while (h.history.length < want) { h.history.push('miss'); changed = true; }
      if (_recalcStreak(h)) changed = true;
    });
    return changed;
  }

  // "Escrever no diário" (core_key = escrever_diario) não é marcado à mão: o
  // histórico dele é derivado de journal — todo dia com entrada vira 'done'.
  // Só adiciona 'done'; nunca remove. Devolve true se mudou algo.
  function _reconcileJournalHabit() {
    const h = cache.habits.find(x => x.coreKey === 'escrever_diario');
    if (!h) return false;
    if (!Array.isArray(h.history)) h.history = [];
    const start = (h.createdDay || 1) - 1;
    let changed = false;
    Object.keys(cache.journal).forEach(k => {
      const dayNum = Number(k);
      if (!dayNum) return;
      const idx = (dayNum - 1) - start;
      if (idx < 0) return;
      while (h.history.length <= idx) h.history.push('miss');
      if (h.history[idx] !== 'done') { h.history[idx] = 'done'; changed = true; }
    });
    if (changed) _recalcStreak(h);
    return changed;
  }

  // "Praticar dicção" (core_key = praticar_diccao) também não é marcado à mão:
  // o histórico dele é derivado de speechDays — todo dia com o plano concluído
  // (done) vira 'done'. Só adiciona; nunca remove. Devolve true se mudou algo.
  function _reconcileSpeechHabit() {
    const h = cache.habits.find(x => x.coreKey === 'praticar_diccao');
    if (!h) return false;
    if (!Array.isArray(h.history)) h.history = [];
    const start = (h.createdDay || 1) - 1;
    let changed = false;
    Object.keys(cache.speechDays).forEach(k => {
      const dayNum = Number(k);
      if (!dayNum || !cache.speechDays[k] || !cache.speechDays[k].done) return;
      const idx = (dayNum - 1) - start;
      if (idx < 0) return;
      while (h.history.length <= idx) h.history.push('miss');
      if (h.history[idx] !== 'done') { h.history[idx] = 'done'; changed = true; }
    });
    if (changed) _recalcStreak(h);
    return changed;
  }

  // Upsert de todos os hábitos no Supabase (usado quando roll-forward /
  // reconcile mexeram no cache fora de um saveHabits explícito).
  function _persistHabits() {
    _push(async () => {
      const rows = cache.habits.map(_habitToRow);
      if (!rows.length) return;
      const { error } = await window.sb.from('habits').upsert(rows, { onConflict: 'user_id,id' });
      if (error) throw error;
    });
  }

  // Envia o fuso do navegador para o servidor quando ele difere do gravado.
  // challenge_day() no Postgres passa a calcular o dia no fuso do usuário; o
  // valor certo chega no próximo load. Enquanto isso, zeramos cache.currentDay
  // para getCurrentDay() usar o cálculo local (que já é no fuso do navegador).
  function _syncTimezone() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (!tz || tz === cache.meta.timezone) return;
    cache.meta.timezone = tz;
    cache.currentDay = null;
    _push(async () => {
      const { error } = await window.sb.rpc('set_timezone', { p_tz: tz });
      if (error) throw error;
    });
  }

  function bootstrap() {
    if (_readyPromise) return _readyPromise;

    // Chrome da navegação (topbar/hambúrguer no mobile, logout, reset) é só
    // DOM — não depende de sessão nem de rede. Fica FORA do caminho autenticado
    // pra não sumir quando o Supabase demora, falha ou o app abre offline
    // (era o motivo do hambúrguer não aparecer no PWA instalado).
    const wireSidebar = () => { _wireLogout(); _wireReset(); _wireMobileNav(); };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', wireSidebar, { once: true });
    } else {
      wireSidebar();
    }

    _readyPromise = (async () => {
      if (!window.sb) {
        console.error('[Project 90] cliente Supabase indisponível (js/supabase.js).');
        return;
      }

      let session = null;
      try {
        const r = await window.sb.auth.getSession();
        session = (r && r.data && r.data.session) || null;
      } catch (e) {
        console.error('[Project 90] getSession falhou:', e);
        return;
      }
      if (!session) { _redirectToLogin(); return; }
      _uid = session.user.id;

      const { data, error } = await window.sb.rpc('app_bootstrap');
      if (error) {
        console.error('[Project 90] app_bootstrap falhou:', error);
        if (typeof toast === 'function') toast('Erro ao carregar seus dados.');
        return;
      }

      _applyServerData(data);
      _syncTimezone();
      const dirty = _rollForward();
      const dirty2 = _reconcileJournalHabit();
      const dirty3 = _reconcileSpeechHabit();
      _saveMirror();
      _ready = true;
      window.dispatchEvent(new Event('p90:synced'));
      if (dirty || dirty2 || dirty3) _persistHabits();
    })();

    return _readyPromise;
  }

  function isReady() { return _ready; }

  // dispara sozinho assim que o script carrega
  bootstrap();

  /* ──────────────────────────────────────────
     META (data de início, total de dias, dia atual)
  ────────────────────────────────────────── */
  function getMeta() {
    return {
      startDate:   cache.meta.startDate,
      totalDays:   cache.meta.totalDays || DEFAULT_TOTAL_DAYS,
      currentDay:  getCurrentDay(),
      freezesLeft: cache.meta.freezesLeft != null ? cache.meta.freezesLeft : 2,
      frozenDays:  cache.meta.frozenDays || [],
    };
  }

  // Consome 1 dia de folga: protege a sequência de hoje sem exigir que
  // nenhum hábito seja marcado. currentStreak()/computeAchievementProgress
  // tratam dias em frozenDays como "mantidos" em vez de quebra.
  async function useFreeze() {
    try { await _readyPromise; } catch (e) {}
    if (!window.sb || !_uid) throw new Error('sem sessão');
    const { data, error } = await window.sb.rpc('use_freeze');
    if (error) throw error;
    cache.meta.freezesLeft = data.freezesLeft;
    if (!cache.meta.frozenDays.includes(data.day)) cache.meta.frozenDays.push(data.day);
    _saveMirror();
    return data;
  }

  function saveMeta(meta) {
    cache.meta = Object.assign({}, cache.meta, {
      startDate: meta.startDate || cache.meta.startDate,
      totalDays: meta.totalDays || cache.meta.totalDays || DEFAULT_TOTAL_DAYS,
    });
    _saveMirror();
    _push(async () => {
      const row = { user_id: _uid, total_days: cache.meta.totalDays };
      if (cache.meta.startDate) row.start_date = String(cache.meta.startDate).slice(0, 10);
      await window.sb.from('challenge_meta').upsert(row, { onConflict: 'user_id' });
    });
  }

  function getTotalDays() { return cache.meta.totalDays || DEFAULT_TOTAL_DAYS; }

  function getStartDate() {
    if (cache.meta.startDate) return new Date(cache.meta.startDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return today;
  }

  function getCurrentDay() {
    if (cache.currentDay) return Math.min(Math.max(cache.currentDay, 1), getTotalDays());
    const start = getStartDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - start) / 86400000) + 1;
    return Math.min(Math.max(diffDays, 1), getTotalDays());
  }

  /* ──────────────────────────────────────────
     HÁBITOS
  ────────────────────────────────────────── */
  function getHabits() { return cache.habits; }

  // Mantém a MESMA referência de array (as páginas guardam cache.habits em
  // variáveis locais), só troca o conteúdo.
  function _replaceArray(target, next) {
    if (target === next) return;
    target.length = 0;
    (next || []).forEach(v => target.push(v));
  }
  function _replaceObject(target, next) {
    if (target === next) return;
    Object.keys(target).forEach(k => delete target[k]);
    Object.assign(target, next || {});
  }

  function saveHabits(list) {
    _replaceArray(cache.habits, Array.isArray(list) ? list : []);
    _saveMirror();
    _push(async () => {
      const rows = cache.habits.map(_habitToRow);
      if (rows.length) {
        const { error } = await window.sb.from('habits').upsert(rows, { onConflict: 'user_id,id' });
        if (error) throw error;
      }
      const ids = cache.habits.map(h => h.id).filter(v => v != null);
      let q = window.sb.from('habits').delete().eq('user_id', _uid);
      if (ids.length) q = q.not('id', 'in', '(' + ids.join(',') + ')');
      const { error: delErr } = await q;
      if (delErr) throw delErr;
    });
  }

  /* ──────────────────────────────────────────
     DIÁRIO
  ────────────────────────────────────────── */
  function getJournal() { return cache.journal; }

  function saveJournal(j) {
    _replaceObject(cache.journal, j && typeof j === 'object' ? j : {});
    if (_reconcileJournalHabit()) _persistHabits();
    _saveMirror();
    _push(async () => {
      const rows = Object.keys(cache.journal).map(k => {
        const e = cache.journal[k] || {};
        return {
          user_id: _uid, day_num: Number(k),
          mood: e.mood ?? null, good: e.good ?? null, improve: e.improve ?? null,
          free: e.free ?? null, gratitude: e.gratitude ?? null,
          prompt_reply: e.promptReply ?? null,
        };
      });
      if (rows.length) {
        const { error } = await window.sb.from('journal_entries').upsert(rows, { onConflict: 'user_id,day_num' });
        if (error) throw error;
      }
    });
  }

  function getJournalEntry(dayNum) { return cache.journal[dayNum] || null; }

  function saveJournalEntry(dayNum, entry) {
    cache.journal[dayNum] = entry;
    if (_reconcileJournalHabit()) _persistHabits();
    _saveMirror();
    _push(async () => {
      const e = entry || {};
      const { error } = await window.sb.from('journal_entries').upsert({
        user_id: _uid, day_num: Number(dayNum),
        mood: e.mood ?? null, good: e.good ?? null, improve: e.improve ?? null,
        free: e.free ?? null, gratitude: e.gratitude ?? null,
        prompt_reply: e.promptReply ?? null,
      }, { onConflict: 'user_id,day_num' });
      if (error) throw error;
    });
  }

  /* ──────────────────────────────────────────
     REVISÃO SEMANAL
  ────────────────────────────────────────── */
  function getWeeklyReviews() { return cache.weeklyReviews; }
  function getWeeklyReview(weekNum) { return cache.weeklyReviews[weekNum] || null; }

  function saveWeeklyReview(weekNum, review) {
    cache.weeklyReviews[weekNum] = review;
    _saveMirror();
    _push(async () => {
      const r = review || {};
      const { error } = await window.sb.from('weekly_reviews').upsert({
        user_id: _uid, week_num: Number(weekNum),
        wins: r.wins ?? null, friction: r.friction ?? null,
        focus: r.focus ?? null, score: r.score ?? null,
      }, { onConflict: 'user_id,week_num' });
      if (error) throw error;
    });
  }

  /* ──────────────────────────────────────────
     FECHAMENTO DO DIA (ritual noturno)
     cache.closeouts: { [dayNum]: { closedAt, tomorrowPriority, priorityDone } }
  ────────────────────────────────────────── */
  function getCloseout(dayNum) { return cache.closeouts[dayNum] || null; }
  function getTodayCloseout() { return getCloseout(getCurrentDay()); }
  function isDayClosed(dayNum) { return !!cache.closeouts[dayNum]; }

  function _pushCloseout(dayNum, c) {
    _push(async () => {
      const { error } = await window.sb.from('daily_closeouts').upsert({
        user_id: _uid, day_num: Number(dayNum),
        closed_at: c.closedAt, tomorrow_priority: c.tomorrowPriority ?? null,
        priority_done: !!c.priorityDone,
      }, { onConflict: 'user_id,day_num' });
      if (error) throw error;
    });
  }

  // Grava (ou atualiza) o fechamento do dia. Mantém closedAt do primeiro
  // fechamento; só a prioridade de amanhã pode ser reeditada depois.
  function saveCloseout(dayNum, fields) {
    const prev = cache.closeouts[dayNum] || {};
    const c = {
      closedAt: prev.closedAt || new Date().toISOString(),
      tomorrowPriority: (fields && 'tomorrowPriority' in fields)
        ? (String(fields.tomorrowPriority || '').trim() || null)
        : (prev.tomorrowPriority ?? null),
      priorityDone: prev.priorityDone || false,
    };
    cache.closeouts[dayNum] = c;
    _saveMirror();
    _pushCloseout(dayNum, c);
    return c;
  }

  // Marca/desmarca a prioridade de um dia como cumprida (feito no dia seguinte).
  function setPriorityDone(dayNum, val) {
    const c = cache.closeouts[dayNum];
    if (!c) return;
    c.priorityDone = !!val;
    _saveMirror();
    _pushCloseout(dayNum, c);
  }

  // Reabre o dia: apaga o fechamento (o usuário quer refazer o ritual).
  function reopenDay(dayNum) {
    if (!cache.closeouts[dayNum]) return;
    delete cache.closeouts[dayNum];
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('daily_closeouts')
        .delete().eq('user_id', _uid).eq('day_num', Number(dayNum));
      if (error) throw error;
    });
  }

  // A prioridade definida ontem (para hoje), se houver — pra fixar no dashboard.
  function priorityForToday() {
    const d = getCurrentDay() - 1;
    const c = cache.closeouts[d];
    if (!c || !c.tomorrowPriority) return null;
    return { dayNum: d, text: c.tomorrowPriority, done: !!c.priorityDone };
  }

  /* ──────────────────────────────────────────
     CONQUISTAS
  ────────────────────────────────────────── */
  function getAchievements() { return cache.achievements; }

  function saveAchievements(a) {
    _replaceObject(cache.achievements, a && typeof a === 'object' ? a : {});
    _saveMirror();
    _push(async () => {
      const rows = Object.keys(cache.achievements).map(id => {
        const s = cache.achievements[id] || {};
        return {
          user_id: _uid, achievement_id: id,
          unlocked_day: s.unlockedDay ?? null,
          seen_modal: !!s.seenModal,
        };
      });
      if (rows.length) {
        const { error } = await window.sb.from('achievements').upsert(rows, { onConflict: 'user_id,achievement_id' });
        if (error) throw error;
      }
    });
  }

  function unlockAchievement(id, dayNum) {
    if (cache.achievements[id]) return false;
    cache.achievements[id] = { unlockedDay: dayNum, seenModal: false };
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.rpc('unlock_achievement', { p_achievement_id: id, p_day: dayNum ?? null });
      if (error) throw error;
    });
    return true;
  }

  function markAchievementSeen(id) {
    if (!cache.achievements[id]) return;
    cache.achievements[id].seenModal = true;
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.rpc('mark_achievement_seen', { p_achievement_id: id });
      if (error) throw error;
    });
  }

  /* ──────────────────────────────────────────
     VOCABULÁRIO
  ────────────────────────────────────────── */
  function getVocabWords() { return cache.vocabWords; }

  function addVocabWord(word) {
    const id = (cache.vocabWords.reduce((m, w) => Math.max(m, w.id), 0) || 0) + 1;
    const today = _localDate(0);
    const row = {
      id,
      word:      (word.word || '').trim(),
      meaning:   (word.meaning || '').trim(),
      example:   (word.example || '').trim(),
      createdAt: new Date().toISOString(),
      srsBox: 1, srsDue: today, srsReviews: 0, srsLapses: 0, srsLast: null,
    };
    cache.vocabWords.unshift(row);
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('vocab_words').upsert({
        id: row.id, user_id: _uid, word: row.word, meaning: row.meaning,
        example: row.example || null, created_at: row.createdAt,
        srs_box: 1, srs_due: today, srs_reviews: 0, srs_lapses: 0, srs_last: null,
      }, { onConflict: 'user_id,id' });
      if (error) throw error;
    });
    return row;
  }

  function updateVocabWord(id, patch) {
    const w = cache.vocabWords.find(x => x.id === id);
    if (!w) return;
    if (patch.word    != null) w.word    = String(patch.word).trim();
    if (patch.meaning != null) w.meaning = String(patch.meaning).trim();
    if (patch.example != null) w.example = String(patch.example).trim();
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('vocab_words').update({
        word: w.word, meaning: w.meaning, example: w.example || null,
      }).eq('user_id', _uid).eq('id', id);
      if (error) throw error;
    });
  }

  function deleteVocabWord(id) {
    const idx = cache.vocabWords.findIndex(w => w.id === id);
    if (idx !== -1) cache.vocabWords.splice(idx, 1);
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('vocab_words').delete().eq('user_id', _uid).eq('id', id);
      if (error) throw error;
    });
  }

  function getVocabQuizStats() { return cache.vocabQuiz; }

  // Registra o resultado de uma rodada do jogo (soma ao placar acumulado).
  function recordVocabQuizRound(result) {
    const correct = Math.max(0, result.correct || 0);
    const total   = Math.max(0, result.total || 0);
    cache.vocabQuiz.roundsPlayed++;
    cache.vocabQuiz.totalAnswered += total;
    cache.vocabQuiz.totalCorrect  += correct;
    if (result.bestStreak > cache.vocabQuiz.bestStreak) cache.vocabQuiz.bestStreak = result.bestStreak;
    _saveMirror();
    _push(async () => {
      const q = cache.vocabQuiz;
      const { error } = await window.sb.from('vocab_quiz_stats').upsert({
        user_id: _uid, rounds_played: q.roundsPlayed, total_answered: q.totalAnswered,
        total_correct: q.totalCorrect, best_streak: q.bestStreak,
      }, { onConflict: 'user_id' });
      if (error) throw error;
    });
  }

  /* ──────────────────────────────────────────
     VOCABULÁRIO — repetição espaçada (Leitner)
  ────────────────────────────────────────── */
  // Dias até a próxima revisão, indexado pela caixa alvo (1..5).
  var VOCAB_SRS_INTERVALS = [0, 1, 3, 7, 14, 30];
  function _vocabInterval(box) {
    return VOCAB_SRS_INTERVALS[Math.max(1, Math.min(5, box))] || 1;
  }

  // Palavras vencidas para revisão hoje (srsDue <= hoje).
  function vocabDueToday() {
    const today = _localDate(0);
    return cache.vocabWords.filter(w => (w.srsDue || today) <= today);
  }

  // Registra uma revisão. grade: 'good' (lembrou) | 'again' (esqueceu).
  function reviewVocabWord(id, grade) {
    const w = cache.vocabWords.find(x => x.id === id);
    if (!w) return;
    const today = _localDate(0);
    if (grade === 'again') {
      w.srsBox    = 1;
      w.srsLapses = (w.srsLapses || 0) + 1;
      w.srsDue    = _addDaysISO(today, 1);
    } else {
      w.srsBox = Math.min(5, (w.srsBox || 1) + 1);
      w.srsDue = _addDaysISO(today, _vocabInterval(w.srsBox));
    }
    w.srsReviews = (w.srsReviews || 0) + 1;
    w.srsLast    = today;
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('vocab_words').update({
        srs_box: w.srsBox, srs_due: w.srsDue, srs_reviews: w.srsReviews,
        srs_lapses: w.srsLapses, srs_last: w.srsLast,
      }).eq('user_id', _uid).eq('id', id);
      if (error) throw error;
    });
  }

  function vocabSrsStats() {
    const today = _localDate(0);
    const boxes = [0, 0, 0, 0, 0];   // contagem por caixa (índice 0 = caixa 1)
    let due = 0, mastered = 0, learning = 0, fresh = 0, reviews = 0, lapses = 0;
    cache.vocabWords.forEach(w => {
      const box = Math.max(1, Math.min(5, w.srsBox || 1));
      boxes[box - 1]++;
      reviews += w.srsReviews || 0;
      lapses  += w.srsLapses  || 0;
      if ((w.srsDue || today) <= today) due++;
      if (box >= 5)                 mastered++;
      else if ((w.srsReviews || 0)) learning++;
      else                          fresh++;
    });
    const retention = reviews > 0 ? Math.round((reviews - lapses) / reviews * 100) : null;
    return { due, mastered, learning, fresh, reviews, lapses, retention, boxes, total: cache.vocabWords.length };
  }

  /* ──────────────────────────────────────────
     DICÇÃO (exercícios de fala)
  ────────────────────────────────────────── */
  function getSpeechExercises() { return cache.speechExercises; }

  function _nextSpeechId() {
    return (cache.speechExercises.reduce((m, s) => Math.max(m, s.id), 0) || 0) + 1;
  }

  function _speechRow(s) {
    return {
      id: s.id, user_id: _uid, title: s.title, body: s.body,
      kind: s.kind || 'trava-lingua', focus: s.focus || null, created_at: s.createdAt,
    };
  }

  function addSpeechExercise(ex) {
    const row = {
      id:        _nextSpeechId(),
      title:     (ex.title || '').trim(),
      body:      (ex.body || '').trim(),
      kind:      (ex.kind || 'trava-lingua').trim(),
      focus:     (ex.focus || '').trim(),
      createdAt: new Date().toISOString(),
    };
    cache.speechExercises.unshift(row);
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('speech_exercises').upsert(_speechRow(row), { onConflict: 'user_id,id' });
      if (error) throw error;
    });
    return row;
  }

  // Adiciona vários de uma vez (usado para carregar a biblioteca inicial).
  function addSpeechExercises(list) {
    if (!Array.isArray(list) || !list.length) return [];
    let id = _nextSpeechId();
    const now = Date.now();
    const rows = list.map((ex, i) => ({
      id:        id++,
      title:     (ex.title || '').trim(),
      body:      (ex.body || '').trim(),
      kind:      (ex.kind || 'trava-lingua').trim(),
      focus:     (ex.focus || '').trim(),
      createdAt: new Date(now + i).toISOString(),
    }));
    cache.speechExercises.unshift(...rows);
    _saveMirror();
    _push(async () => {
      const payload = rows.map(_speechRow);
      const CHUNK = 250;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const { error } = await window.sb.from('speech_exercises')
          .upsert(payload.slice(i, i + CHUNK), { onConflict: 'user_id,id' });
        if (error) throw error;
      }
    });
    return rows;
  }

  function updateSpeechExercise(id, patch) {
    const s = cache.speechExercises.find(x => x.id === id);
    if (!s) return;
    if (patch.title != null) s.title = String(patch.title).trim();
    if (patch.body  != null) s.body  = String(patch.body).trim();
    if (patch.kind  != null) s.kind  = String(patch.kind).trim();
    if (patch.focus != null) s.focus = String(patch.focus).trim();
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('speech_exercises').update({
        title: s.title, body: s.body, kind: s.kind, focus: s.focus || null,
      }).eq('user_id', _uid).eq('id', id);
      if (error) throw error;
    });
  }

  function deleteSpeechExercise(id) {
    const idx = cache.speechExercises.findIndex(s => s.id === id);
    if (idx !== -1) cache.speechExercises.splice(idx, 1);
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('speech_exercises').delete().eq('user_id', _uid).eq('id', id);
      if (error) throw error;
    });
  }

  function getSpeechStats() { return cache.speechStats; }

  // Registra o resultado de uma sessão de prática (soma ao placar acumulado).
  // result: { reps, ratingSum, ratingCount, bestStreak }
  function recordSpeechSession(result) {
    const st = cache.speechStats;
    st.sessionsPlayed++;
    st.repsTotal   += Math.max(0, result.reps || 0);
    st.ratingSum   += Math.max(0, result.ratingSum || 0);
    st.ratingCount += Math.max(0, result.ratingCount || 0);
    if ((result.bestStreak || 0) > st.bestStreak) st.bestStreak = result.bestStreak;
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('speech_practice_stats').upsert({
        user_id: _uid, sessions_played: st.sessionsPlayed, reps_total: st.repsTotal,
        rating_sum: st.ratingSum, rating_count: st.ratingCount, best_streak: st.bestStreak,
      }, { onConflict: 'user_id' });
      if (error) throw error;
    });
  }

  /* ──────────────────────────────────────────
     DICÇÃO — PLANO DIÁRIO (hábito fixo praticar_diccao)
  ────────────────────────────────────────── */
  const SPEECH_PER_DAY_MIN = 10, SPEECH_PER_DAY_MAX = 20;

  // Quantos exercícios o sistema atribui por dia — derivado do tamanho da
  // biblioteca e do total de dias, entre 10 e 20. O usuário não escolhe.
  function speechPerDay() {
    const lib = cache.speechExercises.length;
    if (!lib) return SPEECH_PER_DAY_MIN;
    const raw = Math.ceil(lib / (cache.meta.totalDays || DEFAULT_TOTAL_DAYS));
    return Math.min(SPEECH_PER_DAY_MAX, Math.max(SPEECH_PER_DAY_MIN, raw));
  }

  // Permutação estável dos exercícios da biblioteca (Fisher-Yates + LCG com
  // semente fixa). Assim o "plano de hoje" é o mesmo a cada recarga do dia.
  function _speechPerm() {
    const ids = cache.speechExercises.map(e => e.id).sort((a, b) => a - b);
    let s = 987654321 >>> 0;
    for (let i = ids.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    }
    return ids;
  }

  // Exercícios do plano de um dia do desafio (array de objetos exercício).
  // Se a biblioteca for menor que a cota do dia, o plano é a biblioteca toda.
  function speechPlanForDay(dayNum) {
    const perm = _speechPerm();
    if (!perm.length) return [];
    const per = Math.min(speechPerDay(), perm.length);
    const byId = {};
    cache.speechExercises.forEach(e => { byId[e.id] = e; });
    const out = [];
    const startBase = ((dayNum - 1) * per) % perm.length;
    for (let k = 0; k < per; k++) {
      const id = perm[(startBase + k) % perm.length];
      if (byId[id]) out.push(byId[id]);
    }
    return out;
  }

  function getSpeechDays() { return cache.speechDays; }
  function getSpeechDay(dayNum) { return cache.speechDays[dayNum] || null; }

  // Grava o progresso do plano de um dia. patch: { reps, ratingSum, ratingCount, done }
  // (valores absolutos, não incrementos). Marca o hábito fixo praticar_diccao.
  function saveSpeechDay(dayNum, patch) {
    const cur = cache.speechDays[dayNum] || { reps: 0, ratingSum: 0, ratingCount: 0, done: false };
    const next = {
      reps:        patch.reps        != null ? patch.reps        : cur.reps,
      ratingSum:   patch.ratingSum   != null ? patch.ratingSum   : cur.ratingSum,
      ratingCount: patch.ratingCount != null ? patch.ratingCount : cur.ratingCount,
      done:        patch.done        != null ? !!patch.done       : cur.done,
    };
    cache.speechDays[dayNum] = next;
    if (_reconcileSpeechHabit()) _persistHabits();
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('speech_days').upsert({
        user_id: _uid, day_num: Number(dayNum),
        reps: next.reps, rating_sum: next.ratingSum, rating_count: next.ratingCount, done: next.done,
      }, { onConflict: 'user_id,day_num' });
      if (error) throw error;
    });
    return next;
  }

  // Dias de plano concluídos (total) e sequência atual (dias seguidos com o
  // plano feito, terminando em hoje ou ontem — não quebra por "ainda é hoje").
  function speechDaysDone() {
    return Object.keys(cache.speechDays).filter(k => cache.speechDays[k] && cache.speechDays[k].done).length;
  }
  function speechDayStreak() {
    const today = getCurrentDay();
    let streak = 0;
    for (let d = today; d >= 1; d--) {
      const rec = cache.speechDays[d];
      if (rec && rec.done) streak++;
      else if (d === today) continue;   // hoje ainda não feito não quebra
      else break;
    }
    return streak;
  }

  /* ──────────────────────────────────────────
     PLANO DE LEITURA DA BÍBLIA (js/bible-plan.js)
  ────────────────────────────────────────── */
  function _localDate(offsetDays) {
    const d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getBiblePlan() { return (typeof window !== 'undefined' && window.P90_BIBLE_PLAN) || []; }
  function getBibleDays() { return cache.bibleDays; }
  function bibleReadCount() { return Object.keys(cache.bibleDays).length; }

  // Primeiro dia do plano ainda não lido (1..N). N+1 se já leu tudo.
  function bibleNextDay() {
    const total = getBiblePlan().length || 365;
    for (let d = 1; d <= total; d++) if (!cache.bibleDays[d]) return d;
    return total + 1;
  }

  // Sequência de dias-calendário seguidos com pelo menos uma leitura marcada,
  // terminando hoje ou ontem.
  function bibleStreak() {
    const dates = new Set();
    Object.keys(cache.bibleDays).forEach(k => {
      const dd = cache.bibleDays[k] && cache.bibleDays[k].doneDate;
      if (dd) dates.add(String(dd).slice(0, 10));
    });
    if (!dates.size) return 0;
    let streak = 0, cur = 0;
    if (dates.has(_localDate(0))) { streak = 1; cur = -1; }
    else if (dates.has(_localDate(-1))) { streak = 1; cur = -2; }
    else return 0;
    while (dates.has(_localDate(cur))) { streak++; cur--; }
    return streak;
  }

  // Marca (done=true) ou desmarca (done=false) um dia do plano.
  function setBibleReading(dayNum, done) {
    dayNum = Number(dayNum);
    if (!dayNum) return;
    if (done) {
      const prev = cache.bibleDays[dayNum];
      cache.bibleDays[dayNum] = { done: true, doneDate: (prev && prev.doneDate) || _localDate(0) };
    } else {
      delete cache.bibleDays[dayNum];
    }
    _saveMirror();
    _push(async () => {
      if (done) {
        const { error } = await window.sb.from('bible_days').upsert({
          user_id: _uid, day_num: dayNum, done: true, done_date: cache.bibleDays[dayNum].doneDate,
        }, { onConflict: 'user_id,day_num' });
        if (error) throw error;
      } else {
        const { error } = await window.sb.from('bible_days').delete().eq('user_id', _uid).eq('day_num', dayNum);
        if (error) throw error;
      }
    });
  }

  /* ──────────────────────────────────────────
     TAREFAS
  ────────────────────────────────────────── */
  function _addDaysISO(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function _isoWeekdayApp(iso) {           // 0=Seg..6=Dom
    const js = new Date(iso + 'T00:00:00').getDay();
    return js === 0 ? 6 : js - 1;
  }

  function getTasks() { return cache.tasks; }
  function getTaskDone(id) { return cache.taskDone[id] || []; }
  function taskLastDone(id) {
    const arr = cache.taskDone[id];
    return (arr && arr.length) ? arr[arr.length - 1] : null;
  }

  function _taskRow(t) {
    return {
      id: t.id, user_id: _uid, title: t.title, notes: t.notes || null,
      sched: t.sched,
      interval_days: t.sched === 'everyN' ? (t.intervalDays || null) : null,
      weekdays: t.sched === 'weekdays' ? (t.weekdays || []) : null,
      overdue: t.overdue, anchor: t.anchor || null, archived: !!t.archived,
      sort_order: 0, created_at: t.createdAt,
    };
  }

  function addTask(input) {
    const id = (cache.tasks.reduce((m, t) => Math.max(m, t.id), 0) || 0) + 1;
    const t = {
      id,
      title:        (input.title || '').trim(),
      notes:        (input.notes || '').trim(),
      sched:        input.sched || 'once',
      intervalDays: input.intervalDays != null ? Number(input.intervalDays) : null,
      weekdays:     Array.isArray(input.weekdays) ? input.weekdays.slice() : [],
      overdue:      input.overdue || 'accumulate',
      anchor:       input.anchor || null,
      archived:     false,
      createdAt:    new Date().toISOString(),
    };
    cache.tasks.push(t);
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('tasks').upsert(_taskRow(t), { onConflict: 'user_id,id' });
      if (error) throw error;
    });
    return t;
  }

  function updateTask(id, patch) {
    const t = cache.tasks.find(x => x.id === id);
    if (!t) return;
    ['title', 'notes', 'sched', 'overdue', 'anchor'].forEach(k => { if (patch[k] !== undefined) t[k] = patch[k]; });
    if (patch.intervalDays !== undefined) t.intervalDays = patch.intervalDays != null ? Number(patch.intervalDays) : null;
    if (patch.weekdays !== undefined) t.weekdays = Array.isArray(patch.weekdays) ? patch.weekdays.slice() : [];
    if (patch.archived !== undefined) t.archived = !!patch.archived;
    t.title = (t.title || '').trim();
    t.notes = (t.notes || '').trim();
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('tasks').update(_taskRow(t)).eq('user_id', _uid).eq('id', id);
      if (error) throw error;
    });
  }

  function setTaskArchived(id, val) { updateTask(id, { archived: !!val }); }

  function deleteTask(id) {
    const idx = cache.tasks.findIndex(t => t.id === id);
    if (idx !== -1) cache.tasks.splice(idx, 1);
    delete cache.taskDone[id];
    _saveMirror();
    _push(async () => {
      const { error: e1 } = await window.sb.from('task_completions').delete().eq('user_id', _uid).eq('task_id', id);
      if (e1) throw e1;
      const { error: e2 } = await window.sb.from('tasks').delete().eq('user_id', _uid).eq('id', id);
      if (e2) throw e2;
    });
  }

  function completeTask(id, dateStr) {
    const d = dateStr || _localDate(0);
    if (!cache.taskDone[id]) cache.taskDone[id] = [];
    if (cache.taskDone[id].indexOf(d) === -1) { cache.taskDone[id].push(d); cache.taskDone[id].sort(); }
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('task_completions').upsert({
        user_id: _uid, task_id: id, done_date: d,
      }, { onConflict: 'user_id,task_id,done_date' });
      if (error) throw error;
    });
  }

  function uncompleteTask(id, dateStr) {
    const d = dateStr || _localDate(0);
    const arr = cache.taskDone[id];
    if (arr) { const i = arr.indexOf(d); if (i !== -1) arr.splice(i, 1); }
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('task_completions').delete()
        .eq('user_id', _uid).eq('task_id', id).eq('done_date', d);
      if (error) throw error;
    });
  }

  // Próximo vencimento (ISO) de uma tarefa. null = once sem data / once concluída.
  function taskNextDue(task) {
    const today = _localDate(0);
    const done  = cache.taskDone[task.id] || [];

    if (task.sched === 'once') {
      if (done.length) return null;
      return task.anchor || null;
    }

    const base = taskLastDone(task.id) || task.anchor || String(task.createdAt).slice(0, 10);

    if (task.sched === 'everyN') {
      const n = Math.max(1, task.intervalDays || 1);
      let due = _addDaysISO(base, n);
      if (task.overdue === 'skip') { while (due < today) due = _addDaysISO(due, n); }
      return due;
    }

    // weekdays
    const wds = (task.weekdays && task.weekdays.length) ? task.weekdays : [0, 1, 2, 3, 4, 5, 6];
    let scan = base;
    const floor = _addDaysISO(today, -180);
    if (scan < floor) scan = floor;
    for (let k = 0; k <= 400; k++) {
      const iso = _addDaysISO(scan, k);
      if (wds.indexOf(_isoWeekdayApp(iso)) === -1) continue;
      if (done.indexOf(iso) !== -1) continue;
      if (task.overdue === 'skip' && iso < today) continue;
      return iso;
    }
    return null;
  }

  // 'done-today' | 'due' | 'overdue' | 'upcoming' | 'backlog' | 'done'
  function taskStatus(task) {
    const today = _localDate(0);
    const done  = cache.taskDone[task.id] || [];
    if (task.sched === 'once') {
      if (done.length) return 'done';
      if (!task.anchor) return 'backlog';
      if (task.anchor === today) return 'due';
      return task.anchor < today ? 'overdue' : 'upcoming';
    }
    if (done.indexOf(today) !== -1) return 'done-today';
    const due = taskNextDue(task);
    if (!due) return 'upcoming';
    if (due === today) return 'due';
    return due < today ? 'overdue' : 'upcoming';
  }

  function tasksForToday() {
    return cache.tasks.filter(t => {
      if (t.archived) return false;
      const s = taskStatus(t);
      return s === 'due' || s === 'overdue' || s === 'backlog';
    });
  }

  // Sequência de dias-calendário seguidos (terminando hoje ou ontem) com ≥1
  // conclusão de tarefa.
  function taskStreak() {
    const dates = new Set();
    Object.keys(cache.taskDone).forEach(id => (cache.taskDone[id] || []).forEach(d => dates.add(d)));
    if (!dates.size) return 0;
    let streak = 0, cur = 0;
    if (dates.has(_localDate(0))) { streak = 1; cur = -1; }
    else if (dates.has(_localDate(-1))) { streak = 1; cur = -2; }
    else return 0;
    while (dates.has(_localDate(cur))) { streak++; cur--; }
    return streak;
  }

  function taskDoneTotal() {
    return Object.keys(cache.taskDone).reduce((s, k) => s + (cache.taskDone[k] || []).length, 0);
  }

  // Índices de dia do desafio (1-based) com ≥1 conclusão de tarefa —
  // integração "mista": esses dias contam como "dia ativo".
  function _taskActiveChallengeDays() {
    const set = new Set();
    const start = getStartDate();
    const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const total = getTotalDays();
    Object.keys(cache.taskDone).forEach(id => (cache.taskDone[id] || []).forEach(d => {
      const idx = Math.round((new Date(d + 'T00:00:00') - startMid) / 86400000) + 1;
      if (idx >= 1 && idx <= total) set.add(idx);
    }));
    return set;
  }

  /* ──────────────────────────────────────────
     BANCO DE PROVAS (registro de vitórias)
  ────────────────────────────────────────── */
  function getWins() { return cache.wins; }
  function winsCount() { return cache.wins.length; }

  function addWin(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const id  = (cache.wins.reduce((m, w) => Math.max(m, w.id), 0) || 0) + 1;
    const row = { id, text: t, dayNum: getCurrentDay(), createdAt: new Date().toISOString() };
    cache.wins.unshift(row);
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('wins').upsert({
        id: row.id, user_id: _uid, text: row.text, day_num: row.dayNum, created_at: row.createdAt,
      }, { onConflict: 'user_id,id' });
      if (error) throw error;
    });
    return row;
  }

  function deleteWin(id) {
    const idx = cache.wins.findIndex(w => w.id === id);
    if (idx !== -1) cache.wins.splice(idx, 1);
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('wins').delete().eq('user_id', _uid).eq('id', id);
      if (error) throw error;
    });
  }

  /* ──────────────────────────────────────────
     CONTADORES "DIAS DESDE"
  ────────────────────────────────────────── */
  function getStreakCounters() { return cache.streakCounters; }

  function _counterBaseISO(c) {
    return c.lastSlip || c.startDate || String(c.createdAt).slice(0, 10) || _localDate(0);
  }

  // Dias limpos até hoje + recorde. daysNegative nunca: mín 0.
  function counterDaysSince(c) {
    const base = _counterBaseISO(c);
    const diff = Math.round((new Date(_localDate(0) + 'T00:00:00') - new Date(base + 'T00:00:00')) / 86400000);
    const days = Math.max(0, diff);
    return { days, best: Math.max(c.bestRun || 0, days) };
  }

  function _pushCounter(c) {
    _push(async () => {
      const { error } = await window.sb.from('streak_counters').upsert({
        id: c.id, user_id: _uid, label: c.label,
        last_slip: c.lastSlip, start_date: c.startDate,
        best_run: c.bestRun || 0, created_at: c.createdAt,
      }, { onConflict: 'user_id,id' });
      if (error) throw error;
    });
  }

  function addStreakCounter(label) {
    const t = String(label || '').trim();
    if (!t) return null;
    const id  = (cache.streakCounters.reduce((m, c) => Math.max(m, c.id), 0) || 0) + 1;
    const row = { id, label: t, lastSlip: null, startDate: _localDate(0), bestRun: 0,
                  createdAt: new Date().toISOString() };
    cache.streakCounters.push(row);
    _saveMirror();
    _pushCounter(row);
    return row;
  }

  function renameStreakCounter(id, label) {
    const c = cache.streakCounters.find(x => x.id === id);
    if (!c) return;
    c.label = String(label || '').trim() || c.label;
    _saveMirror();
    _pushCounter(c);
  }

  // Registra um deslize: fecha o ciclo atual (atualiza o recorde) e zera.
  function registerCounterSlip(id, dateStr) {
    const c = cache.streakCounters.find(x => x.id === id);
    if (!c) return;
    const slip = dateStr || _localDate(0);
    const base = _counterBaseISO(c);
    const run  = Math.max(0, Math.round((new Date(slip + 'T00:00:00') - new Date(base + 'T00:00:00')) / 86400000));
    c.bestRun  = Math.max(c.bestRun || 0, run);
    c.lastSlip = slip;
    _saveMirror();
    _pushCounter(c);
  }

  // Desfaz o deslize de hoje (misclique): volta o marcador pro estado anterior.
  function undoCounterSlip(id) {
    const c = cache.streakCounters.find(x => x.id === id);
    if (!c || c.lastSlip !== _localDate(0)) return;
    c.lastSlip = null;
    _saveMirror();
    _pushCounter(c);
  }

  function deleteStreakCounter(id) {
    const idx = cache.streakCounters.findIndex(c => c.id === id);
    if (idx !== -1) cache.streakCounters.splice(idx, 1);
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('streak_counters').delete().eq('user_id', _uid).eq('id', id);
      if (error) throw error;
    });
  }

  /* ──────────────────────────────────────────
     COMPUTED HELPERS
  ────────────────────────────────────────── */

  // Status de um hábito num dia: 1=done, 0.5=partial, 0=miss.
  // dayIdx é o índice absoluto do dia no desafio (0 = dia 1); convertido
  // para o índice relativo ao histórico do próprio hábito (createdDay).
  function habitVal(h, dayIdx) {
    const idx = dayIdx - ((h.createdDay || 1) - 1);
    if (idx < 0 || idx >= h.history.length) return 0;
    const s = h.history[idx];
    return s === 'done' ? 1 : s === 'partial' ? 0.5 : 0;
  }

  // Um hábito só conta num dado dia se aquele dia da semana está na sua
  // frequência. freq: 0=Seg..6=Dom; Date.getDay(): 0=Dom..6=Sáb.
  // freq vazia ou com os 7 dias = todo dia.
  function scheduledOn(h, dayIdx) {
    const f = h.freq;
    if (!Array.isArray(f) || f.length === 0 || f.length >= 7) return true;
    const jsDay   = (getStartDate().getDay() + dayIdx) % 7;   // 0=Dom..6=Sáb
    const freqIdx = jsDay === 0 ? 6 : jsDay - 1;              // 0=Seg..6=Dom
    return f.includes(freqIdx);
  }

  function dayCompletionPct(habits, dayIdx) {
    const active = habits.filter(h => !h.paused && h.createdDay - 1 <= dayIdx && scheduledOn(h, dayIdx));
    if (!active.length) return 0;
    const sum = active.reduce((acc, h) => acc + habitVal(h, dayIdx), 0);
    return Math.round((sum / active.length) * 100);
  }

  function maxStreak(totalDays, condFn) {
    let best = 0, cur = 0;
    for (let i = 0; i < totalDays; i++) {
      if (condFn(i)) { cur++; best = Math.max(best, cur); } else cur = 0;
    }
    return best;
  }

  function countDays(totalDays, condFn) {
    let n = 0;
    for (let i = 0; i < totalDays; i++) if (condFn(i)) n++;
    return n;
  }

  function allHabitsDone(habits, dayIdx) {
    const due = habits.filter(h => !h.paused && h.createdDay - 1 <= dayIdx && scheduledOn(h, dayIdx));
    return due.length > 0 && due.every(h => habitVal(h, dayIdx) === 1);
  }

  function currentStreak(habits, currentDay) {
    const active   = habits.filter(h => !h.paused);
    const frozen   = cache.meta.frozenDays || [];
    const taskDays = _taskActiveChallengeDays();      // integração "mista"
    let streak = 0;
    for (let i = currentDay - 1; i >= 0; i--) {
      const hasTask = taskDays.has(i + 1);
      const due = active.filter(h => scheduledOn(h, i));
      if (!due.length) {                              // sem hábito devido nesse dia
        if (hasTask) streak++;                        // ...mas fez uma tarefa: conta
        continue;                                     // ...senão descanso, não quebra
      }
      if (frozen.includes(i + 1)) { streak++; continue; } // dia de folga: mantém
      if (hasTask || due.some(h => habitVal(h, i) > 0)) streak++; else break;
    }
    return streak;
  }

  function computeAchievementProgress(habits, journal, currentDay, weeklyReviews, vocabWords, vocabQuiz, speechExercises, speechStats, speechDays) {
    weeklyReviews = weeklyReviews || {};
    vocabWords = vocabWords || [];
    vocabQuiz  = vocabQuiz || { roundsPlayed: 0, totalCorrect: 0 };
    speechExercises = speechExercises || [];
    speechStats = speechStats || { sessionsPlayed: 0, repsTotal: 0 };
    speechDays = speechDays || {};
    const speechPlanDone = Object.keys(speechDays).filter(k => speechDays[k] && speechDays[k].done).length;
    const active = habits.filter(h => !h.paused);

    // As conquistas ligadas a um hábito específico agora casam pela CHAVE
    // estável (coreKey), não pelo nome exibido — ver supabase 0002_core_habits.
    function _core(key) { return active.find(x => x.coreKey === key); }
    function streakForKey(key) {
      const h = _core(key);
      if (!h) return 0;
      let cur = 0, best = 0;
      for (let i = 0; i < currentDay; i++) {
        if (!scheduledOn(h, i)) continue;            // dia fora da frequência: ignora
        if (habitVal(h, i) === 1) { cur++; if (cur > best) best = cur; } else cur = 0;
      }
      return best;
    }
    function countForKey(key) {
      const h = _core(key);
      if (!h) return 0;
      return h.history.filter(s => s === 'done').length;
    }
    function hasComeback() {
      for (const h of active) {
        for (let i = 1; i < currentDay; i++) {
          if (habitVal(h, i - 1) === 0 && habitVal(h, i) === 1) return 1;
        }
      }
      return 0;
    }

    const frozenSet    = new Set(cache.meta.frozenDays || []);
    const taskSet      = _taskActiveChallengeDays();                       // integração "mista"
    const dayActive    = i => taskSet.has(i + 1) || active.some(h => habitVal(h, i) > 0);
    const dayStreak    = maxStreak(currentDay, i => frozenSet.has(i + 1) || dayActive(i));
    const daysActive   = countDays(currentDay, dayActive);
    const allDoneCount = countDays(currentDay, i => allHabitsDone(habits, i));
    const perfStreak   = maxStreak(currentDay, i => allHabitsDone(habits, i));

    const taskTotal    = taskDoneTotal();
    const taskStk      = taskStreak();

    const vocabReviews  = vocabWords.reduce((s, w) => s + (w.srsReviews || 0), 0);
    const vocabMastered = vocabWords.filter(w => (w.srsBox || 1) >= 5).length;

    const journalEntries = Object.keys(journal).length;
    const journalStreak  = (() => {
      let best = 0, cur = 0;
      for (let d = 1; d <= currentDay; d++) {
        if (journal[d]) { cur++; best = Math.max(best, cur); } else cur = 0;
      }
      return best;
    })();

    return {
      day1:         Math.min(1, daysActive),
      week1:        dayStreak,
      week2:        dayStreak,
      day30:        dayStreak,
      halfway:      daysActive,
      day60:        dayStreak,
      day90:        dayStreak,
      perfect_week: perfStreak,
      early_bird:   countForKey('acordar_cedo'),
      athlete:      countForKey('exercitar'),
      no_scroll:    streakForKey('sem_redes'),
      reader:       countForKey('ler'),
      zen:          countForKey('meditar'),
      bible_reader: countForKey('ler_biblia'),
      first_entry:  Math.min(1, journalEntries),
      journal7:     journalStreak,
      journal30:    journalEntries,
      diary_streak: journalStreak,
      first_review:    Math.min(1, Object.keys(weeklyReviews).length),
      weekly_reviewer: Object.keys(weeklyReviews).length,
      weekly_all:      Object.keys(weeklyReviews).length,
      comeback:     hasComeback(),
      discipline:   perfStreak,
      all5:         allDoneCount,
      vocab_first:      Math.min(1, vocabWords.length),
      vocab_10:         vocabWords.length,
      vocab_50:         vocabWords.length,
      vocab_100:        vocabWords.length,
      vocab_quiz1:      Math.min(1, vocabQuiz.roundsPlayed || 0),
      vocab_correct25:  vocabQuiz.totalCorrect || 0,
      vocab_correct100: vocabQuiz.totalCorrect || 0,
      vocab_srs_first:   Math.min(1, vocabReviews),
      vocab_srs_100:     vocabReviews,
      vocab_mastered_10: vocabMastered,
      speech_first:     Math.min(1, speechExercises.length),
      speech_10:        speechExercises.length,
      speech_25:        speechExercises.length,
      speech_session1:  Math.min(1, speechStats.sessionsPlayed || 0),
      speech_sessions10: speechStats.sessionsPlayed || 0,
      speech_reps50:    speechStats.repsTotal || 0,
      speech_reps200:   speechStats.repsTotal || 0,
      speech_plan7:    speechPlanDone,
      speech_plan30:   speechPlanDone,
      task_first:   Math.min(1, taskTotal),
      task_10:      taskTotal,
      task_50:      taskTotal,
      task_streak7: taskStk,
    };
  }

  /* ──────────────────────────────────────────
     XP / NÍVEIS POR PILAR
     Cada hábito-dia concluído vale XP (done=10, partial=5), acumulado por
     pilar (h.pillar). Custo do nível L = 50·L, então o XP mínimo para chegar
     ao nível L é 25·L·(L−1). Nível geral = soma dos 4 pilares.
  ────────────────────────────────────────── */
  const XP_DONE = 10, XP_PARTIAL = 5;

  function _wrapLevel(xp) {
    let level = 1;
    while (25 * (level + 1) * level <= xp) level++;
    const floor = 25 * level * (level - 1);
    const need  = 50 * level;                 // 25·(L+1)·L − 25·L·(L−1)
    return { xp, level, into: xp - floor, need };
  }

  function computeLevels(habits, currentDay) {
    const per = {};
    habits.filter(h => !h.paused).forEach(h => {
      const p = h.pillar || 'Outros';
      if (per[p] == null) per[p] = 0;
      for (let i = 0; i < currentDay; i++) {
        const v = habitVal(h, i);
        if (v === 1) per[p] += XP_DONE;
        else if (v === 0.5) per[p] += XP_PARTIAL;
      }
    });
    const pillars = {};
    let totalXp = 0;
    Object.keys(per).forEach(p => { pillars[p] = _wrapLevel(per[p]); totalXp += per[p]; });
    return { pillars, total: _wrapLevel(totalXp) };
  }

  /* ──────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────── */
  return {
    // ciclo de vida
    bootstrap, isReady, resetProgress,
    // meta
    getMeta, saveMeta, getTotalDays, getStartDate, getCurrentDay, useFreeze,
    // dados
    getHabits, saveHabits,
    getJournal, saveJournal, getJournalEntry, saveJournalEntry,
    getWeeklyReviews, getWeeklyReview, saveWeeklyReview,
    getAchievements, saveAchievements, unlockAchievement, markAchievementSeen,
    getVocabWords, addVocabWord, updateVocabWord, deleteVocabWord,
    getVocabQuizStats, recordVocabQuizRound,
    vocabDueToday, reviewVocabWord, vocabSrsStats,
    getSpeechExercises, addSpeechExercise, addSpeechExercises, updateSpeechExercise, deleteSpeechExercise,
    getSpeechStats, recordSpeechSession,
    speechPerDay, speechPlanForDay, getSpeechDays, getSpeechDay, saveSpeechDay,
    speechDaysDone, speechDayStreak,
    getBiblePlan, getBibleDays, setBibleReading, bibleReadCount, bibleNextDay, bibleStreak,
    getTasks, getTaskDone, taskLastDone, addTask, updateTask, deleteTask, setTaskArchived,
    completeTask, uncompleteTask, taskNextDue, taskStatus, tasksForToday, taskStreak, taskDoneTotal,
    getWins, winsCount, addWin, deleteWin,
    getStreakCounters, counterDaysSince, addStreakCounter, renameStreakCounter,
    registerCounterSlip, undoCounterSlip, deleteStreakCounter,
    getCloseout, getTodayCloseout, isDayClosed, saveCloseout, setPriorityDone,
    reopenDay, priorityForToday,
    // computed
    habitVal, scheduledOn, dayCompletionPct, maxStreak, countDays,
    allHabitsDone, currentStreak, computeAchievementProgress, computeLevels,
  };

})();

/* ──────────────────────────────────────────
   p90confirm(msg, opts?) — modal de confirmação no lugar do confirm() nativo.
   Retorna Promise<boolean>. opts: { okText, cancelText, danger (default true) }
   Enter = confirmar, Esc / clique no fundo = cancelar.
────────────────────────────────────────── */
window.p90confirm = function (message, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    if (document.getElementById('p90-confirm-modal')) { resolve(false); return; }
    var danger = opts.danger !== false;
    var esc = String(message).replace(/[&<>]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c];
    });
    var ov = document.createElement('div');
    ov.id = 'p90-confirm-modal';
    ov.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;background:rgba(8,8,8,.85);' +
      'display:flex;align-items:center;justify-content:center;padding:24px;' +
      "font-family:'DM Mono',monospace;";
    ov.innerHTML =
      '<div role="alertdialog" aria-modal="true" style="background:var(--surface,#111);' +
      'border:1px solid var(--border2,rgba(245,245,240,.16));max-width:400px;width:100%;padding:32px 34px;">' +
        '<p style="font-size:13px;line-height:1.75;color:var(--white,#f5f5f0);margin-bottom:24px;">' + esc + '</p>' +
        '<div style="display:flex;gap:10px;">' +
          '<button id="p90c-no" style="flex:1;padding:12px;font-family:inherit;font-size:11px;' +
            'letter-spacing:.14em;text-transform:uppercase;cursor:pointer;background:none;' +
            'border:1px solid var(--border2,rgba(245,245,240,.16));color:var(--mid,#999);">' +
            (opts.cancelText || 'Cancelar') + '</button>' +
          '<button id="p90c-yes" style="flex:1;padding:12px;font-family:inherit;font-size:11px;' +
            'letter-spacing:.14em;text-transform:uppercase;cursor:pointer;border:none;color:#080808;' +
            (danger ? 'background:var(--red,#fca5a5);' : 'background:var(--white,#f5f5f0);') + '">' +
            (opts.okText || 'Confirmar') + '</button>' +
        '</div>' +
      '</div>';
    function done(v) {
      ov.remove();
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      else if (e.key === 'Enter') { e.stopPropagation(); done(true); }
    }
    ov.addEventListener('click', function (e) { if (e.target === ov) done(false); });
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(ov);
    ov.querySelector('#p90c-no').addEventListener('click', function () { done(false); });
    ov.querySelector('#p90c-yes').addEventListener('click', function () { done(true); });
    ov.querySelector('#p90c-yes').focus();
  });
};

/* ──────────────────────────────────────────
   Focus-trap global pros modais. Sem fio por página: um MutationObserver
   olha as classes de overlay conhecidas; enquanto um estiver aberto, o Tab
   circula dentro dele e o foco volta pro gatilho ao fechar.
────────────────────────────────────────── */
(function p90ModalFocusGuard() {
  var OPEN = '.modal-overlay.open, .quiz-overlay.show, .prac-overlay.show, ' +
             '.jm-overlay.open, .bpm-overlay.open, #p90-confirm-modal, #p90-reset-modal';
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), ' +
                  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var trapped = null, lastFocus = null;

  function items() {
    return trapped ? Array.prototype.filter.call(
      trapped.querySelectorAll(FOCUSABLE),
      function (el) { return el.offsetWidth || el.offsetHeight || el.getClientRects().length; }
    ) : [];
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !trapped) return;
    var f = items();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!trapped.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }, true);

  function scan() {
    var open = document.querySelector(OPEN);
    if (open === trapped) return;
    if (open) {
      if (!trapped) lastFocus = document.activeElement;
      trapped = open;
      var f = items();
      if (f.length && !open.contains(document.activeElement)) { try { f[0].focus(); } catch (e) {} }
    } else {
      trapped = null;
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
      lastFocus = null;
    }
  }
  if (typeof MutationObserver === 'function') {
    new MutationObserver(scan).observe(document.documentElement, {
      attributes: true, attributeFilter: ['class'], subtree: true, childList: true,
    });
  }
})();
