/* ═══════════════════════════════════════════════
   PROJECT 90 — STORE
   Fonte única de verdade para todos os dados.
   Todas as páginas leem e escrevem por aqui.
   Chaves localStorage:
     p90_habits       → array de hábitos
     p90_journal      → objeto { dayNum: entry }
     p90_achievements → objeto { id: { unlockedDay, seenModal } }
     p90_meta         → { startDate, totalDays } (dia atual é calculado
                          a partir de startDate, não fica salvo aqui)
═══════════════════════════════════════════════ */

const Store = (() => {

  /* ──────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────── */
  function read(key)        { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch(e) { return null; } }
  function write(key, val)  { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} }

  /* ──────────────────────────────────────────
     META (data de início, total de dias)
     O dia atual do desafio NÃO é mais um número fixo: é calculado a
     partir da data real de início (gravada no primeiro acesso do app).
  ────────────────────────────────────────── */
  const DEFAULT_TOTAL_DAYS = 90;

  function getMeta() {
    return read('p90_meta') || { totalDays: DEFAULT_TOTAL_DAYS };
  }

  function saveMeta(meta) {
    write('p90_meta', meta);
  }

  function getTotalDays() {
    return getMeta().totalDays || DEFAULT_TOTAL_DAYS;
  }

  // Data em que o usuário começou o desafio. Gravada automaticamente na
  // primeira vez que qualquer página chama esta função.
  function getStartDate() {
    const meta = getMeta();
    if (meta.startDate) return new Date(meta.startDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    saveMeta({ ...meta, startDate: today.toISOString() });
    return today;
  }

  // Dia atual do desafio (1-based), calculado a partir da data de início
  // real — não é mais um valor fixo. Limitado ao total de dias.
  function getCurrentDay() {
    const start = getStartDate();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today - start) / 86400000) + 1;
    return Math.min(Math.max(diffDays, 1), getTotalDays());
  }

  /* ──────────────────────────────────────────
     HÁBITOS — sem dados de exemplo: o usuário começa sem nenhum
     hábito cadastrado e adiciona os seus pelo próprio app.
  ────────────────────────────────────────── */
  function getHabits()       { return read('p90_habits') || []; }
  function saveHabits(h)     { write('p90_habits', h); }

  /* ──────────────────────────────────────────
     DIÁRIO — sem entradas de exemplo.
  ────────────────────────────────────────── */
  function getJournal()      { return read('p90_journal') || {}; }
  function saveJournal(j)    { write('p90_journal', j); }
  function getJournalEntry(dayNum) { const j = getJournal(); return j[dayNum] || null; }
  function saveJournalEntry(dayNum, entry) {
    const j = getJournal();
    j[dayNum] = entry;
    saveJournal(j);
  }

  /* ──────────────────────────────────────────
     CONQUISTAS
  ────────────────────────────────────────── */
  function getAchievements()      { return read('p90_achievements') || {}; }
  function saveAchievements(a)    { write('p90_achievements', a); }
  function unlockAchievement(id, dayNum) {
    const state = getAchievements();
    if (!state[id]) {
      state[id] = { unlockedDay: dayNum, seenModal: false };
      saveAchievements(state);
      return true; // foi desbloqueada agora
    }
    return false;
  }
  function markAchievementSeen(id) {
    const state = getAchievements();
    if (state[id]) { state[id].seenModal = true; saveAchievements(state); }
  }

  /* ──────────────────────────────────────────
     COMPUTED HELPERS (usados por múltiplas páginas)
  ────────────────────────────────────────── */

  // Status de um hábito num dia: 1=done, 0.5=partial, 0=miss.
  // dayIdx é o índice absoluto do dia no desafio (0 = dia 1); convertido
  // aqui para o índice relativo ao próprio histórico do hábito, já que um
  // hábito pode ter sido criado depois do dia 1 (history mais curto).
  function habitVal(h, dayIdx) {
    const idx = dayIdx - ((h.createdDay || 1) - 1);
    if (idx < 0 || idx >= h.history.length) return 0;
    const s = h.history[idx];
    return s === 'done' ? 1 : s === 'partial' ? 0.5 : 0;
  }

  // % de conclusão de um dia (média de todos os hábitos ativos)
  function dayCompletionPct(habits, dayIdx) {
    const active = habits.filter(h => !h.paused && h.createdDay - 1 <= dayIdx);
    if (!active.length) return 0;
    const sum = active.reduce((acc, h) => acc + habitVal(h, dayIdx), 0);
    return Math.round((sum / active.length) * 100);
  }

  // Maior streak consecutivo onde condFn(dayIdx) === true
  function maxStreak(totalDays, condFn) {
    let best = 0, cur = 0;
    for (let i = 0; i < totalDays; i++) {
      if (condFn(i)) { cur++; best = Math.max(best, cur); } else cur = 0;
    }
    return best;
  }

  // Contagem de dias onde condFn(dayIdx) === true
  function countDays(totalDays, condFn) {
    let n = 0;
    for (let i = 0; i < totalDays; i++) if (condFn(i)) n++;
    return n;
  }

  // Todos os hábitos ativos concluídos num dado dia
  function allHabitsDone(habits, dayIdx) {
    const active = habits.filter(h => !h.paused && h.createdDay - 1 <= dayIdx);
    return active.length > 0 && active.every(h => habitVal(h, dayIdx) === 1);
  }

  // Streak atual (dias consecutivos com ≥1 hábito feito, a partir de hoje para trás)
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

  // Progresso de cada conquista calculado dos dados reais
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
          if (habitVal(h, i-1) === 0 && habitVal(h, i) === 1) return 1;
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
    getMeta, saveMeta, getTotalDays, getStartDate, getCurrentDay,
    getHabits, saveHabits,
    getJournal, saveJournal, getJournalEntry, saveJournalEntry,
    getAchievements, saveAchievements, unlockAchievement, markAchievementSeen,
    // computed
    habitVal, dayCompletionPct, maxStreak, countDays,
    allHabitsDone, currentStreak, computeAchievementProgress,
  };

})();