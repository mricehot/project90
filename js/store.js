/* ═══════════════════════════════════════════════
   PROJECT 90 — STORE
   Fonte única de verdade para todos os dados.
   Todas as páginas leem e escrevem por aqui.
   Chaves localStorage:
     p90_habits       → array de hábitos
     p90_journal      → objeto { dayNum: entry }
     p90_achievements → objeto { id: { unlockedDay, seenModal } }
     p90_meta         → { startDate, currentDay, totalDays }
═══════════════════════════════════════════════ */

const Store = (() => {

  /* ──────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────── */
  function read(key)        { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch(e) { return null; } }
  function write(key, val)  { try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {} }

  /* ──────────────────────────────────────────
     META (dia atual, data de início)
  ────────────────────────────────────────── */
  const DEFAULT_META = { currentDay: 34, totalDays: 90 };

  function getMeta() {
    return read('p90_meta') || DEFAULT_META;
  }

  function saveMeta(meta) {
    write('p90_meta', meta);
  }

  /* ──────────────────────────────────────────
     HÁBITOS
  ────────────────────────────────────────── */
  function _defaultHabits() {
    // Histórico determinístico — sem Math.random para evitar dados diferentes a cada acesso
    return [
      { id:1, name:'Acordar às 6h',     pillar:'Corpo', freq:[0,1,2,3,4,5,6], goal:'',       streak:28, maxStreak:28, paused:false, createdDay:1,
        history:['done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done','done'] },
      { id:2, name:'Exercício 30min',   pillar:'Corpo', freq:[0,1,2,3,4],     goal:'30 min', streak:12, maxStreak:18, paused:false, createdDay:1,
        history:['done','done','partial','done','done','done','done','miss','done','done','done','done','done','done','done','done','done','done','done','miss','done','done','done','done','done','done','done','done','done','done','partial','done','done','done'] },
      { id:3, name:'Sem redes sociais', pillar:'Mente', freq:[0,1,2,3,4,5,6], goal:'',       streak:12, maxStreak:22, paused:false, createdDay:1,
        history:['done','done','done','partial','miss','done','done','done','done','done','done','done','partial','done','done','done','done','done','done','done','done','done','done','miss','done','done','done','done','done','done','done','done','done','done'] },
      { id:4, name:'Leitura 20min',     pillar:'Mente', freq:[0,1,2,3,4,5,6], goal:'20 min', streak:4,  maxStreak:14, paused:false, createdDay:1,
        history:['done','miss','done','done','done','done','done','miss','done','done','partial','done','done','done','done','done','miss','done','done','done','done','miss','miss','done','done','done','done','miss','done','done','done','done','done','miss'] },
      { id:5, name:'Meditação',         pillar:'Mente', freq:[0,1,2,3,4,5,6], goal:'10 min', streak:7,  maxStreak:15, paused:false, createdDay:1,
        history:['done','done','done','done','done','miss','done','done','partial','done','done','done','done','miss','done','done','done','done','miss','done','done','done','done','done','miss','done','done','miss','done','done','done','done','done','done'] },
    ];
  }

  function getHabits()       { return read('p90_habits') || _defaultHabits(); }
  function saveHabits(h)     { write('p90_habits', h); }

  /* ──────────────────────────────────────────
     DIÁRIO
  ────────────────────────────────────────── */
  function _defaultJournal() {
    return {
      1:  { mood:'🔥', good:'Primeiro dia do desafio. Energia alta.', improve:'Criar uma rotina melhor para a manhã.', free:'Animado para começar os 90 dias. Sinto que desta vez vai ser diferente.', gratitude:'1. Saúde\n2. Família\n3. Oportunidade de recomeçar' },
      7:  { mood:'💪', good:'Completei a primeira semana sem falhar nenhum hábito.', improve:'Dormir mais cedo.', free:'7 dias seguidos. A streak me motiva mais do que eu esperava.', gratitude:'1. Disciplina crescendo\n2. Amigos que apoiam\n3. Boa leitura esta semana' },
      14: { mood:'💪', good:'Duas semanas completas. O exercício já virou automático.', improve:'Meditar com mais atenção, não só marcar como feito.', free:'Percebi que quando acordo às 6h tenho muito mais foco no resto do dia.', gratitude:'1. Corpo respondendo bem\n2. Livro incrível\n3. Tempo de qualidade sozinho' },
      21: { mood:'😐', good:'Mantive os hábitos mesmo num dia difícil no trabalho.', improve:'Não usar o celular como recompensa.', free:'Dia puxado. Mas completar os hábitos mesmo assim me lembrou por que estou fazendo isso.', gratitude:'1. Resiliência\n2. Café\n3. Música' },
      28: { mood:'💪', good:'Quatro semanas. Melhor streak de todas.', improve:'Aumentar intensidade do treino.', free:'28 dias. A identidade de "pessoa disciplinada" está começando a parecer real.', gratitude:'1. Progresso visível\n2. Sono melhorou muito\n3. Clareza mental' },
    };
  }

  function getJournal()      { return read('p90_journal') || _defaultJournal(); }
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

  // Status de um hábito num dia: 1=done, 0.5=partial, 0=miss
  function habitVal(h, dayIdx) {
    const s = h.history[dayIdx];
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
      return maxStreak(h.history.length, i => habitVal(h, i) === 1);
    }

    function countForHabit(name) {
      const h = active.find(x => x.name === name);
      if (!h) return 0;
      return h.history.filter(s => s === 'done').length;
    }

    function hasComeback() {
      for (const h of active) {
        for (let i = 1; i < h.history.length; i++) {
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
    getMeta, saveMeta,
    getHabits, saveHabits,
    getJournal, saveJournal, getJournalEntry, saveJournalEntry,
    getAchievements, saveAchievements, unlockAchievement, markAchievementSeen,
    // computed
    habitVal, dayCompletionPct, maxStreak, countDays,
    allHabitsDone, currentStreak, computeAchievementProgress,
  };

})();
