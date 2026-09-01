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
                                         journal, achievements,
                                         waterConfig, waterToday }
═══════════════════════════════════════════════ */

const Store = (() => {

  const MIRROR_KEY        = 'p90_cache';
  const DEFAULT_TOTAL_DAYS = 90;

  /* ──────────────────────────────────────────
     CACHE
  ────────────────────────────────────────── */
  function _emptyCache() {
    return {
      meta:         { totalDays: DEFAULT_TOTAL_DAYS },
      currentDay:   null,
      habits:       [],
      journal:      {},
      achievements: {},
      waterConfig:  null,
      waterToday:   0,
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
      cache.meta.startDate = data.meta.startDate || cache.meta.startDate;
      cache.meta.totalDays = data.meta.totalDays || DEFAULT_TOTAL_DAYS;
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
    if (data.achievements && typeof data.achievements === 'object') {
      Object.keys(cache.achievements).forEach(k => delete cache.achievements[k]);
      Object.assign(cache.achievements, data.achievements);
    }
    if (data.waterConfig) cache.waterConfig = data.waterConfig;
    if (typeof data.waterToday === 'number') cache.waterToday = data.waterToday;
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

  function bootstrap() {
    if (_readyPromise) return _readyPromise;

    _readyPromise = (async () => {
      if (!window.sb) {
        console.error('[Project 90] cliente Supabase indisponível (js/supabase.js).');
        return;
      }

      const { data: { session } } = await window.sb.auth.getSession();
      if (!session) { _redirectToLogin(); return; }
      _uid = session.user.id;

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _wireLogout, { once: true });
      } else {
        _wireLogout();
      }

      const { data, error } = await window.sb.rpc('app_bootstrap');
      if (error) {
        console.error('[Project 90] app_bootstrap falhou:', error);
        if (typeof toast === 'function') toast('Erro ao carregar seus dados.');
        return;
      }

      _applyServerData(data);
      _saveMirror();
      _ready = true;
      window.dispatchEvent(new Event('p90:synced'));
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
      startDate: cache.meta.startDate,
      totalDays: cache.meta.totalDays || DEFAULT_TOTAL_DAYS,
      currentDay: getCurrentDay(),
    };
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
    _saveMirror();
    _push(async () => {
      const rows = Object.keys(cache.journal).map(k => {
        const e = cache.journal[k] || {};
        return {
          user_id: _uid, day_num: Number(k),
          mood: e.mood ?? null, good: e.good ?? null, improve: e.improve ?? null,
          free: e.free ?? null, gratitude: e.gratitude ?? null,
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
    _saveMirror();
    _push(async () => {
      const e = entry || {};
      const { error } = await window.sb.from('journal_entries').upsert({
        user_id: _uid, day_num: Number(dayNum),
        mood: e.mood ?? null, good: e.good ?? null, improve: e.improve ?? null,
        free: e.free ?? null, gratitude: e.gratitude ?? null,
      }, { onConflict: 'user_id,day_num' });
      if (error) throw error;
    });
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
     ÁGUA (hidratação) — opcional, para migrar depois
  ────────────────────────────────────────── */
  function getWaterConfig() { return cache.waterConfig || { cups: 8, ml: 250 }; }

  function saveWaterConfig(cfg) {
    cache.waterConfig = { cups: cfg.cups, ml: cfg.ml };
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.from('water_config')
        .upsert({ user_id: _uid, cups: cfg.cups, ml: cfg.ml }, { onConflict: 'user_id' });
      if (error) throw error;
    });
  }

  function getWaterToday() { return cache.waterToday || 0; }

  function setWaterToday(n) {
    const target = Math.max(0, n | 0);
    const delta = target - (cache.waterToday || 0);
    cache.waterToday = target;
    _saveMirror();
    _push(async () => {
      const { error } = await window.sb.rpc('add_water', { p_delta: delta });
      if (error) throw error;
    });
  }

  /* ──────────────────────────────────────────
     COMPUTED HELPERS (idênticos aos de antes)
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

  function dayCompletionPct(habits, dayIdx) {
    const active = habits.filter(h => !h.paused && h.createdDay - 1 <= dayIdx);
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
    const active = habits.filter(h => !h.paused && h.createdDay - 1 <= dayIdx);
    return active.length > 0 && active.every(h => habitVal(h, dayIdx) === 1);
  }

  function currentStreak(habits, currentDay) {
    const active = habits.filter(h => !h.paused);
    if (!active.length) return 0;
    let streak = 0;
    for (let i = currentDay - 1; i >= 0; i--) {
      const anyDone = active.some(h => habitVal(h, i) > 0);
      if (anyDone) streak++; else break;
    }
    return streak;
  }

  function computeAchievementProgress(habits, journal, currentDay) {
    const active = habits.filter(h => !h.paused);

    function streakForHabit(name) {
      const h = active.find(x => x.name === name);
      if (!h) return 0;
      return maxStreak(currentDay, i => habitVal(h, i) === 1);
    }
    function countForHabit(name) {
      const h = active.find(x => x.name === name);
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

    const dayStreak    = maxStreak(currentDay, i => active.some(h => habitVal(h, i) > 0));
    const daysActive   = countDays(currentDay, i => active.some(h => habitVal(h, i) > 0));
    const allDoneCount = countDays(currentDay, i => allHabitsDone(habits, i));
    const perfStreak   = maxStreak(currentDay, i => allHabitsDone(habits, i));

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
      early_bird:   countForHabit('Acordar às 6h'),
      athlete:      countForHabit('Exercício 30min'),
      no_scroll:    streakForHabit('Sem redes sociais'),
      reader:       countForHabit('Leitura 20min'),
      zen:          countForHabit('Meditação'),
      first_entry:  Math.min(1, journalEntries),
      journal7:     journalStreak,
      journal30:    journalEntries,
      comeback:     hasComeback(),
      discipline:   perfStreak,
      all5:         allDoneCount,
    };
  }

  /* ──────────────────────────────────────────
     PUBLIC API
  ────────────────────────────────────────── */
  return {
    // ciclo de vida
    bootstrap, isReady,
    // meta
    getMeta, saveMeta, getTotalDays, getStartDate, getCurrentDay,
    // dados
    getHabits, saveHabits,
    getJournal, saveJournal, getJournalEntry, saveJournalEntry,
    getAchievements, saveAchievements, unlockAchievement, markAchievementSeen,
    getWaterConfig, saveWaterConfig, getWaterToday, setWaterToday,
    // computed
    habitVal, dayCompletionPct, maxStreak, countDays,
    allHabitsDone, currentStreak, computeAchievementProgress,
  };

})();
