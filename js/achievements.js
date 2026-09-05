/* ═══════════════════════════════════════════════
   PROJECT 90 — CATÁLOGO DE CONQUISTAS

   Fonte única da lista de conquistas. conquistas.html usa
   window.P90_ACHIEVEMENTS para renderizar o progresso completo (com seu
   próprio modal de desbloqueio). As demais páginas (dashboard, hábitos,
   métricas, diário, vocabulário) só precisam saber se algo foi desbloqueado
   desde a última visita — checkAchievementUnlocks() faz isso e devolve a
   lista de novidades; showAchievementToasts() avisa com um toast global,
   clicável, que leva para conquistas.html.
═══════════════════════════════════════════════ */

window.P90_ACHIEVEMENTS = [
  {
    id: 'jornada', name: 'Jornada', icon: '◈',
    achievements: [
      { id:'day1',    icon:'🌱', name:'Primeiro passo',    points:50,   target:1,  req:'Completar o dia 1',       desc:'Você iniciou o desafio. A jornada começa com um único dia.' },
      { id:'week1',   icon:'🔥', name:'Primeira semana',   points:100,  target:7,  req:'7 dias seguidos',         desc:'7 dias consecutivos. O início é sempre o mais difícil.' },
      { id:'week2',   icon:'⚡', name:'Quinzena sólida',   points:150,  target:15, req:'15 dias seguidos',        desc:'Duas semanas sem quebrar. O hábito começa a se formar.' },
      { id:'day30',   icon:'💎', name:'Um mês inteiro',    points:250,  target:30, req:'30 dias seguidos',        desc:'30 dias consecutivos. Você está no 1% dos que chegam aqui.' },
      { id:'halfway', icon:'🌗', name:'Metade do caminho', points:300,  target:45, req:'45 dias completos',       desc:'45 dias completos. A reta final começa a aparecer.' },
      { id:'day60',   icon:'🌕', name:'Dois terços',       points:400,  target:60, req:'60 dias seguidos',        desc:'60 dias. O comportamento já está instalado.' },
      { id:'day90',   icon:'🏆', name:'Project Complete',  points:1000, target:90, req:'90 dias completos',       desc:'90 dias. Você não completou apenas um desafio — tornou-se outra pessoa.' },
    ],
  },
  {
    id: 'habitos', name: 'Hábitos', icon: '◉',
    achievements: [
      { id:'perfect_week', icon:'🎯', name:'Semana perfeita',    points:150, target:7,   req:'7 dias 100%',          desc:'Todos os hábitos concluídos por 7 dias seguidos.' },
      { id:'early_bird',   icon:'🌅', name:'Madrugador',         points:200, target:25,  req:'25× "Acordar cedo"',   desc:'Cumpriu o hábito fixo "Acordar cedo" em 25 dias do desafio.' },
      { id:'athlete',      icon:'🏋️', name:'Atleta',            points:200, target:20,  req:'20× "Exercitar-se"',   desc:'Concluiu o hábito fixo "Exercitar-se" 20 vezes no desafio.' },
      { id:'no_scroll',    icon:'📵', name:'Desintoxicado',      points:250, target:30,  req:'30 dias "Sem redes sociais"', desc:'Manteve o hábito fixo "Sem redes sociais" por 30 dias seguidos.' },
      { id:'reader',       icon:'📚', name:'Leitor voraz',       points:200, target:21,  req:'21× "Ler"',            desc:'Concluiu o hábito fixo "Ler" 21 vezes.' },
      { id:'zen',          icon:'🧘', name:'Mente zen',          points:150, target:21,  req:'21× "Meditar / refletir"', desc:'Concluiu o hábito fixo "Meditar / refletir" 21 vezes.' },
      { id:'bible_reader', icon:'📖', name:'Palavra diária',     points:250, target:30,  req:'30× "Ler a Bíblia"',   desc:'Concluiu o hábito fixo "Ler a Bíblia" 30 vezes.' },
    ],
  },
  {
    id: 'diario', name: 'Diário', icon: '◻',
    achievements: [
      { id:'first_entry',  icon:'✍️', name:'Primeira reflexão',    points:50,  target:1,  req:'1 entrada no diário',      desc:'Escreveu a primeira entrada no diário.' },
      { id:'journal7',     icon:'📓', name:'Uma semana escrita',   points:150, target:7,  req:'7 entradas seguidas',      desc:'7 entradas consecutivas no diário de reflexão.' },
      { id:'diary_streak', icon:'🖋️', name:'Escritor diário',      points:250, target:21, req:'21 dias seguidos no diário', desc:'Cumpriu o hábito fixo "Escrever no diário" por 21 dias sem falhar.' },
      { id:'journal30',    icon:'📔', name:'Cronista do desafio',  points:350, target:30, req:'30 entradas',              desc:'Registrou 30 dias no diário. Isso é um tesouro.' },
      { id:'first_review',    icon:'🧭', name:'Primeira revisão',      points:80,  target:1,  req:'1 revisão semanal',     desc:'Fez a primeira revisão de semana.' },
      { id:'weekly_reviewer', icon:'📆', name:'Estrategista',          points:250, target:6,  req:'6 revisões semanais',   desc:'Revisou 6 semanas do desafio.' },
      { id:'weekly_all',      icon:'🗺️', name:'Cartógrafo do progresso', points:450, target:12, req:'12 revisões semanais',  desc:'Revisou todas as 12 semanas completas do desafio.' },
    ],
  },
  {
    id: 'vocabulario', name: 'Vocabulário', icon: '▤',
    achievements: [
      { id:'vocab_first',      icon:'🔤', name:'Primeira palavra',     points:50,  target:1,   req:'1 palavra cadastrada',   desc:'Cadastrou a primeira palavra no seu vocabulário.' },
      { id:'vocab_10',         icon:'📗', name:'Colecionador',         points:120, target:10,  req:'10 palavras cadastradas', desc:'Já são 10 palavras novas para incorporar ao seu vocabulário.' },
      { id:'vocab_50',         icon:'📘', name:'Vocabulário rico',     points:280, target:50,  req:'50 palavras cadastradas', desc:'50 palavras cadastradas. Seu repertório está crescendo de verdade.' },
      { id:'vocab_100',        icon:'📙', name:'Léxico vivo',          points:450, target:100, req:'100 palavras cadastradas', desc:'100 palavras. Um vocabulário assim não se constrói por acaso.' },
      { id:'vocab_quiz1',      icon:'🎮', name:'Primeiro teste',       points:60,  target:1,   req:'1 rodada do jogo',       desc:'Testou o vocabulário pela primeira vez no modo jogo.' },
      { id:'vocab_correct25',  icon:'🧠', name:'Memória afiada',       points:200, target:25,  req:'25 acertos no jogo',     desc:'25 respostas certas somadas no "Testar meu vocabulário".' },
      { id:'vocab_correct100', icon:'🏅', name:'Sabedoria acumulada',  points:400, target:100, req:'100 acertos no jogo',    desc:'100 acertos. O vocabulário virou conhecimento de verdade.' },
    ],
  },
  {
    id: 'especial', name: 'Especial', icon: '◆',
    achievements: [
      { id:'comeback',   icon:'🔄', name:'Volta por cima',       points:100, target:1,  req:'Retomar após uma falha',  desc:'Falhou um dia e voltou no seguinte sem desistir.' },
      { id:'discipline', icon:'🗿', name:'Disciplina de ferro',  points:400, target:14, req:'14 dias perfeitos',       desc:'14 dias consecutivos com todos os hábitos 100%.' },
      { id:'all5',       icon:'⭐', name:'Mestre dos hábitos',   points:300, target:7,  req:'7x todos os hábitos',     desc:'Todos os hábitos concluídos no mesmo dia, 7 vezes.' },
    ],
  },
];

/* ─────────────────────────────────────────────
   DETECÇÃO DE NOVOS DESBLOQUEIOS
   Compara o progresso atual (via Store.computeAchievementProgress) com o
   estado salvo, persiste o que for novo e devolve a lista de conquistas
   recém-desbloqueadas (pode ser vazia). Idempotente: uma segunda chamada na
   mesma sessão não repete o que já foi salvo.
───────────────────────────────────────────── */
function checkAchievementUnlocks() {
  if (typeof Store === 'undefined' || !Store.isReady()) return [];

  const day        = Store.getCurrentDay();
  const progress   = Store.computeAchievementProgress(
    Store.getHabits(), Store.getJournal(), day, Store.getWeeklyReviews(),
    Store.getVocabWords(), Store.getVocabQuizStats()
  );
  const savedState = Store.getAchievements();
  const all        = window.P90_ACHIEVEMENTS.flatMap(c => c.achievements);
  const newOnes    = [];

  all.forEach(a => {
    const cur = progress[a.id] ?? 0;
    if (cur >= a.target && !savedState[a.id]) newOnes.push(a);
  });

  if (newOnes.length) {
    newOnes.forEach(a => { savedState[a.id] = { unlockedDay: day, seenModal: false }; });
    Store.saveAchievements(savedState);
  }
  return newOnes;
}

/* ─────────────────────────────────────────────
   TOAST GLOBAL DE CONQUISTA DESBLOQUEADA
   Widget leve, independente do HTML de cada página — injeta seu próprio CSS
   e nó no body na primeira chamada. Clicável, leva para conquistas.html.
───────────────────────────────────────────── */
function _ensureAchievementToastStyles() {
  if (document.getElementById('p90-ach-toast-style')) return;
  const style = document.createElement('style');
  style.id = 'p90-ach-toast-style';
  style.textContent = `
    .p90-ach-toast {
      position: fixed; right: 20px; bottom: 20px; z-index: 2147483000;
      display: flex; align-items: center; gap: 14px;
      background: var(--surface, #111); border: 1px solid rgba(134,239,172,0.35);
      padding: 14px 18px; max-width: 340px; cursor: pointer;
      font-family: 'DM Mono', monospace; color: var(--white, #f5f5f0);
      transform: translateY(12px); opacity: 0; pointer-events: none;
      transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.35s;
      box-shadow: 0 12px 32px rgba(0,0,0,0.35);
    }
    .p90-ach-toast.show { transform: translateY(0); opacity: 1; pointer-events: all; }
    .p90-ach-toast:hover { border-color: rgba(134,239,172,0.6); }
    .p90-ach-toast-icon { font-size: 22px; flex-shrink: 0; }
    .p90-ach-toast-body { flex: 1; min-width: 0; }
    .p90-ach-toast-eyebrow { font-size: 8px; letter-spacing: 0.2em; text-transform: uppercase; color: #86efac; margin-bottom: 3px; }
    .p90-ach-toast-name { font-size: 12px; letter-spacing: 0.03em; line-height: 1.4; }
    .p90-ach-toast-pts { font-family: 'Bebas Neue', sans-serif; font-size: 16px; color: #86efac; flex-shrink: 0; }
  `;
  document.head.appendChild(style);
}

function _showAchievementToast(a) {
  _ensureAchievementToastStyles();
  const el = document.createElement('div');
  el.className = 'p90-ach-toast';
  el.innerHTML =
    `<span class="p90-ach-toast-icon">${a.icon}</span>` +
    `<div class="p90-ach-toast-body">` +
      `<div class="p90-ach-toast-eyebrow">Conquista desbloqueada</div>` +
      `<div class="p90-ach-toast-name">${a.name}</div>` +
    `</div>` +
    `<span class="p90-ach-toast-pts">+${a.points}</span>`;
  el.addEventListener('click', () => { location.href = 'conquistas.html'; });
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));

  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 400);
  }, 4200);
}

let _p90AchToastQueue   = [];
let _p90AchToastShowing = false;

function _showNextAchievementToast() {
  if (!_p90AchToastQueue.length) { _p90AchToastShowing = false; return; }
  _p90AchToastShowing = true;
  _showAchievementToast(_p90AchToastQueue.shift());
  setTimeout(_showNextAchievementToast, 4600);
}

// Avisa (em fila, uma de cada vez) sobre as conquistas passadas em `list`.
function showAchievementToasts(list) {
  if (!list || !list.length) return;
  _p90AchToastQueue.push(...list);
  if (!_p90AchToastShowing) _showNextAchievementToast();
}

// Atalho para as páginas que só querem checar e avisar, sem tratar a lista.
function notifyNewAchievements() {
  showAchievementToasts(checkAchievementUnlocks());
}
