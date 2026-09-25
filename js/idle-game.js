/* ═══════════════════════════════════════════════
   PROJECT 90 — MASMORRA (jogo idle do Sistema)

   Lógica pura, sem DOM. A energia do herói vem dos hábitos de verdade:
   energia ganha = EXP do Sistema × ENERGY_PER_EXP (derivada, retroativa),
   energia gasta fica no estado do jogo. Cada rodada de combate custa 1 de
   energia. Sem energia o herói descansa — não dá pra "farmar" sem cumprir
   a rotina. O progresso offline é recalculado ao abrir (com teto), pelas
   mesmas rodadas do modo ao vivo, então os dois nunca divergem.

   Jogo single player: sem guilda nem outros jogadores. Há um chefe semanal
   solo, cuja vida escala com o seu ataque (então sempre exige esforço real).
   Todos os números ficam nas constantes abaixo — ajuste à vontade.
═══════════════════════════════════════════════ */
(function () {
  const ROUND_MS = 2500;                       // uma rodada de combate
  const OFFLINE_CAP_H = 8;                     // teto do que acumula fora
  const ENERGY_PER_EXP = 5;                    // 1 EXP do Sistema = 5 rodadas
  const OFFLINE_CAP_ROUNDS = Math.floor(OFFLINE_CAP_H * 3600 * 1000 / ROUND_MS);

  const MONSTERS = [
    ['🐀', 'Rato de esgoto'], ['🦇', 'Morcego cego'], ['🐺', 'Lobo faminto'], ['👺', 'Goblin ladrão'],
    ['🧟', 'Zumbi lento'], ['🦂', 'Escorpião'], ['🕷️', 'Aranha gigante'], ['👹', 'Ogro'],
  ];
  const BOSSES = [
    ['🐉', 'Dragão Anão'], ['💀', 'Lich Sombrio'], ['🦑', 'Kraken das Profundezas'], ['😈', 'Demônio de Pedra'],
    ['🗿', 'Golem Ancestral'], ['👁️', 'Olho do Abismo'],
  ];
  const WORLD_BOSSES = [
    ['🐲', 'Dragão Ancestral'], ['☠️', 'Rei Esqueleto'], ['🌑', 'Devorador de Luz'],
    ['🦴', 'Colosso de Ossos'], ['🔥', 'Titã de Magma'], ['🌀', 'Senhor do Vazio'],
  ];

  function defaultState(now) {
    return {
      v: 1, best: 0, gold: 0, kills: 0, bosses: 0, energySpent: 0,
      up: { atk: 0, def: 0, lck: 0 }, enc: null, last: now || Date.now(),
      week: { key: '', dmg: 0, hp: 0, claimed: false }, offline: null,
    };
  }
  function normalize(st, now) {
    const d = defaultState(now);
    if (!st || typeof st !== 'object') return d;
    const s = Object.assign(d, st);
    s.up = Object.assign({ atk: 0, def: 0, lck: 0 }, st.up || {});
    s.week = Object.assign({ key: '', dmg: 0, hp: 0, claimed: false }, st.week || {});
    return s;
  }

  /* ── monstros ── */
  function isBoss(f) { return f % 10 === 0; }
  function monsterFor(f) {
    const boss = isBoss(f);
    const base = boss ? BOSSES[(f / 10 - 1) % BOSSES.length] : MONSTERS[(f - 1) % MONSTERS.length];
    return {
      floor: f, boss, emoji: base[0], name: base[1],
      hp:   Math.round(30 * Math.pow(1 + f, 1.5) * (boss ? 1.5 : 1)),
      atk:  Math.max(1, Math.round(1.5 * Math.pow(1 + f, 1.05) * (boss ? 1.15 : 1))),
      gold: Math.round(3 * Math.pow(1 + f, 1.1) * (boss ? 4 : 1)),
    };
  }

  /* ── herói: poder vem do Sistema (nível + atributos) + melhorias ── */
  function playerStats(sys, up) {
    const attrs = sys && sys.attributes ? Object.keys(sys.attributes).reduce((s, k) => s + sys.attributes[k], 0) : 50;
    const lvl = sys ? sys.level : 0;
    return {
      atk: 6 + lvl * 5 + Math.floor(attrs / 12) + up.atk * 4,
      hp:  60 + lvl * 25 + up.def * 18,
      goldMul: 1 + 0.05 * up.lck,
    };
  }
  const UPGRADES = {
    atk: { name: 'Arma',      icon: '⚔️', desc: '+4 de ataque por nível',  base: 25, growth: 1.09 },
    def: { name: 'Armadura',  icon: '🛡️', desc: '+18 de vida por nível',   base: 25, growth: 1.09 },
    lck: { name: 'Amuleto',   icon: '🍀', desc: '+5% de ouro por nível',   base: 50, growth: 1.09},
  };
  function upgradeCost(kind, lvl) { const u = UPGRADES[kind]; return Math.round(u.base * Math.pow(u.growth, lvl)); }
  function buyUpgrade(st, kind) {
    const u = UPGRADES[kind]; if (!u) return false;
    const cost = upgradeCost(kind, st.up[kind]);
    if (st.gold < cost) return false;
    st.gold -= cost; st.up[kind]++; return true;
  }

  /* ── combate ── */
  function roundsToKill(stats, m) { return Math.max(1, Math.ceil(m.hp / stats.atk)); }
  function canWin(stats, m) { return stats.hp > m.atk * roundsToKill(stats, m); }
  // Tenta o próximo andar; se ainda não dá pra vencer, farma o melhor já vencido.
  function pickFloor(stats, st) {
    const next = st.best + 1;
    if (canWin(stats, monsterFor(next))) return next;
    return Math.max(1, st.best);
  }

  function energyEarned(exp) { return Math.floor((exp || 0) * ENERGY_PER_EXP); }
  function energyAvail(st, exp) { return Math.max(0, energyEarned(exp) - st.energySpent); }

  function weekKey(now) {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));                 // quinta da semana ISO
    const week1 = new Date(d.getFullYear(), 0, 4);
    const wk = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return d.getFullYear() + '-W' + String(wk).padStart(2, '0');
  }
  function weekStart(now) {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));                     // segunda 00:00
    return d.getTime();
  }
  function syncWeek(st, now) {
    const k = weekKey(now);
    if (st.week.key !== k) st.week = { key: k, dmg: 0, hp: 0, claimed: false };
  }

  // Uma rodada. ctx = { stats, exp, now }. Devolve o evento (ou null sem energia).
  function stepRound(st, ctx) {
    if (energyAvail(st, ctx.exp) <= 0) return null;
    syncWeek(st, ctx.now || Date.now());
    if (!st.week.hp) st.week.hp = Math.round(BOSS_ROUNDS * ctx.stats.atk);
    if (!st.enc) {
      const f = pickFloor(ctx.stats, st);
      st.enc = { f, done: 0 };
    }
    const m = monsterFor(st.enc.f);
    const need = roundsToKill(ctx.stats, m);
    st.energySpent++;
    st.enc.done++;
    st.week.dmg += ctx.stats.atk;
    const ev = { monster: m, need, done: st.enc.done, dmg: ctx.stats.atk, killed: false, gold: 0, newFloor: false };
    if (st.enc.done >= need) {
      const gain = Math.round(m.gold * ctx.stats.goldMul);
      st.gold += gain; st.kills++;
      ev.killed = true; ev.gold = gain;
      if (st.enc.f > st.best) { st.best = st.enc.f; ev.newFloor = true; if (m.boss) st.bosses++; }
      st.enc = null;
    }
    return ev;
  }

  // Recalcula o que rolou enquanto o app esteve fechado.
  function catchUp(st, ctx) {
    const now = ctx.now || Date.now();
    const elapsed = Math.max(0, now - st.last);
    const capped = elapsed > OFFLINE_CAP_ROUNDS * ROUND_MS;
    let rounds = Math.min(Math.floor(elapsed / ROUND_MS), OFFLINE_CAP_ROUNDS);
    const before = { gold: st.gold, kills: st.kills, best: st.best, spent: st.energySpent };
    let ran = 0, dry = false;
    while (rounds-- > 0) {
      const ev = stepRound(st, { stats: ctx.stats, exp: ctx.exp, now });
      if (!ev) { dry = true; break; }
      ran++;
    }
    st.last = now;
    const sum = { rounds: ran, kills: st.kills - before.kills, gold: st.gold - before.gold, floors: st.best - before.best, capped, dry, elapsed };
    return sum;
  }

  /* ── chefe semanal (solo) ──
     Um chefe novo por semana. A vida dele é fixada no início da semana em
     BOSS_ROUNDS × seu ataque de então (≈ uma semana inteira de energia
     de um jogador médio), então evoluir não torna o chefe trivial. */
  const BOSS_ROUNDS = 3600;
  function worldBoss(now, st) {
    const key = weekKey(now), start = weekStart(now), end = start + 7 * 86400000;
    const wIdx = Math.abs(Math.round(start / (7 * 86400000)));
    const b = WORLD_BOSSES[wIdx % WORLD_BOSSES.length];
    const cur = st.week.key === key ? st.week : null;
    const hp = cur && cur.hp ? cur.hp : 0;
    const mine = cur ? cur.dmg : 0;
    return {
      key, emoji: b[0], name: b[1], hp, mine, defeated: hp > 0 && mine >= hp, endsAt: end,
      reward: 3000 + st.best * 400,
    };
  }
  function claimWorldBoss(st, now) {
    const wb = worldBoss(now, st);
    if (!wb.defeated || st.week.claimed) return 0;
    st.week.claimed = true; st.gold += wb.reward; return wb.reward;
  }

  window.P90Idle = {
    ROUND_MS, OFFLINE_CAP_H, ENERGY_PER_EXP, UPGRADES,
    defaultState, normalize, monsterFor, playerStats, upgradeCost, buyUpgrade,
    roundsToKill, canWin, pickFloor, energyEarned, energyAvail, stepRound, catchUp, weekKey,
    worldBoss, claimWorldBoss, isBoss, BOSS_ROUNDS,
  };
})();
