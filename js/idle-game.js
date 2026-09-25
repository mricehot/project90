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
      rng: Math.floor(Math.random() * 4294967295) + 1, inv: [], eq: emptyEq(), nextId: 1, pets: [], pet: null,
      week: { key: '', dmg: 0, hp: 0, claimed: false }, offline: null,
    };
  }
  function normalize(st, now) {
    const d = defaultState(now);
    if (!st || typeof st !== 'object') return d;
    const s = Object.assign(d, st);
    s.up = Object.assign({ atk: 0, def: 0, lck: 0 }, st.up || {});
    s.week = Object.assign({ key: '', dmg: 0, hp: 0, claimed: false }, st.week || {});
    s.eq = Object.assign(emptyEq(), st.eq || {});
    if (!Array.isArray(s.inv)) s.inv = [];
    if (!s.rng) s.rng = Math.floor(Math.random() * 4294967295) + 1;
    if (!Array.isArray(s.pets)) s.pets = [];
    s.pets = s.pets.filter(p => p && PET_BY_KEY[p.sp]);
    if (!s.pets.some(p => p.sp === s.pet)) s.pet = s.pets.length ? s.pets[0].sp : null;
    migrateRings(s);
    if (!s.nextId) s.nextId = 1 + s.inv.reduce((m, i) => Math.max(m, i.id || 0), 0);
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
  function playerStats(sys, st) {
    const up = st.up, b = eqBonus(st.eq), pb = petBonus(st), sb = setBonus(st.eq);
    const attrs = sys && sys.attributes ? Object.keys(sys.attributes).reduce((s, k) => s + sys.attributes[k], 0) : 50;
    const lvl = sys ? sys.level : 0;
    return {
      atk: Math.round((6 + lvl * 5 + Math.floor(attrs / 12) + up.atk * 4 + b.atk) * (1 + (pb.atk + sb.atk) / 100)),
      hp:  Math.round((60 + lvl * 25 + up.def * 18 + b.hp) * (1 + (pb.hp + sb.hp) / 100)),
      goldMul: 1 + 0.05 * up.lck + b.gold / 100 + (pb.gold + sb.gold) / 100,
      bonus: b, pet: pb, set: sb,
    };
  }
  const UPGRADES = {
    atk: { name: 'Força',     icon: '⚔️', desc: '+4 de ataque por nível',  base: 25, growth: 1.09 },
    def: { name: 'Vigor',     icon: '🛡️', desc: '+18 de vida por nível',   base: 25, growth: 1.09 },
    lck: { name: 'Sorte',     icon: '🍀', desc: '+5% de ouro por nível',   base: 50, growth: 1.09},
  };
  function upgradeCost(kind, lvl) { const u = UPGRADES[kind]; return Math.round(u.base * Math.pow(u.growth, lvl)); }
  function buyUpgrade(st, kind) {
    const u = UPGRADES[kind]; if (!u) return false;
    const cost = upgradeCost(kind, st.up[kind]);
    if (st.gold < cost) return false;
    st.gold -= cost; st.up[kind]++; return true;
  }

  /* ── equipamentos e drops ──
     8 posições (7 tipos de item; o anel ocupa duas). Monstros comuns têm DROP_CHANCE de soltar um item; chefes
     sempre soltam (nunca comum, raridade melhor). O sorteio usa um PRNG
     semeado guardado no estado (st.rng), então rodadas ao vivo e recalculadas
     offline dão exatamente os mesmos drops. */
  const SLOTS = ['arma', 'elmo', 'armadura', 'calca', 'botas', 'anel', 'amuleto'];   // tipos de item
  const EQ_POS = ['arma', 'elmo', 'armadura', 'calca', 'botas', 'anel1', 'anel2', 'amuleto'];   // posições no herói
  const SLOT_INFO = {
    arma:     { label: 'Arma',     icon: '🗡️', names: ['Adaga', 'Espada', 'Machado', 'Lança', 'Cajado'] },
    elmo:     { label: 'Elmo',     icon: '⛑️', names: ['Capuz', 'Elmo', 'Coroa'] },
    armadura: { label: 'Armadura', icon: '🛡️', names: ['Couraça', 'Cota de malha', 'Manto'] },
    calca:    { label: 'Calça',    icon: '👖', names: ['Calça', 'Calças', 'Saiote'] },
    botas:    { label: 'Botas',    icon: '🥾', names: ['Botas', 'Grevas', 'Sandálias'] },
    anel:     { label: 'Anel',     icon: '💍', names: ['Anel', 'Aliança', 'Sinete'] },
    amuleto:  { label: 'Amuleto',  icon: '📿', names: ['Amuleto', 'Talismã', 'Colar'] },
  };
  const POS_LABEL = { anel1: 'Anel I', anel2: 'Anel II' };
  const RARITIES = [
    { key: 'comum',    label: 'Comum',    mul: 1,    w: 60,  adj: 'Gasto' },
    { key: 'incomum',  label: 'Incomum',  mul: 1.35, w: 28,  adj: 'de Ferro' },
    { key: 'raro',     label: 'Raro',     mul: 1.8,  w: 9,   adj: 'de Prata' },
    { key: 'epico',    label: 'Épico',    mul: 2.5,  w: 2.5, adj: 'Rúnico' },
    { key: 'lendario', label: 'Lendário', mul: 3.5,  w: 0.5, adj: 'do Monarca' },
  ];
  /* ── conjuntos ──
     Itens incomuns+ podem vir de um conjunto. Cada peça equipada do mesmo
     conjunto conta (o anel vale duas); ao atingir 2, 4 e 6 peças, o bônus
     percentual daquele degrau se soma aos anteriores. */
  const SETS = {
    guardiao: { name: 'Guardião',  suffix: 'do Guardião', color: '#5aa0d8', tiers: [
      { n: 2, hp: 10 }, { n: 4, hp: 15, atk: 5 }, { n: 6, hp: 25, atk: 10 } ] },
    carmesim: { name: 'Carmesim',  suffix: 'Carmesim',    color: '#d24a4a', tiers: [
      { n: 2, atk: 8 }, { n: 4, atk: 12, hp: 5 }, { n: 6, atk: 20, hp: 10 } ] },
    fortuna:  { name: 'Fortuna',   suffix: 'da Fortuna',  color: '#e0b23a', tiers: [
      { n: 2, gold: 15 }, { n: 4, gold: 25, atk: 5 }, { n: 6, gold: 50, atk: 8, hp: 8 } ] },
    sombras:  { name: 'Sombras',   suffix: 'das Sombras', color: '#8a5fe0', tiers: [
      { n: 2, atk: 5, hp: 5, gold: 5 }, { n: 4, atk: 10, hp: 10, gold: 10 }, { n: 6, atk: 20, hp: 20, gold: 20 } ] },
  };
  const SET_KEYS = Object.keys(SETS);
  const SET_CHANCE = 0.5, SET_BOSS_CHANCE = 0.85;
  function setCounts(eq) {
    const c = {};
    EQ_POS.forEach(p => { const it = eq && eq[p]; if (it && it.set) c[it.set] = (c[it.set] || 0) + 1; });
    return c;
  }
  // Bônus % somado + estado por conjunto ({ key, n, tier }) dos que têm ao menos 1 peça.
  function setBonus(eq) {
    const b = { atk: 0, hp: 0, gold: 0, active: [] }, c = setCounts(eq);
    SET_KEYS.forEach(k => {
      const n = c[k] || 0; if (!n) return;
      let tier = 0;
      SETS[k].tiers.forEach((t, i) => { if (n >= t.n) { tier = i + 1; b.atk += t.atk || 0; b.hp += t.hp || 0; b.gold += t.gold || 0; } });
      b.active.push({ key: k, n, tier });
    });
    return b;
  }
  const DROP_CHANCE = 0.04, BAG_MAX = 30;
  function emptyEq() { const e = {}; EQ_POS.forEach(p => { e[p] = null; }); return e; }
  // Saves antigos: "Anel" era um tipo de amuleto — passa a ser anel de verdade.
  function migrateRings(st) {
    const fix = it => { if (it && it.slot === 'amuleto' && /^Anel\b/.test(it.name)) it.slot = 'anel'; };
    st.inv.forEach(fix);
    ['amuleto', 'anel1', 'anel2'].forEach(p => fix(st.eq[p]));
    const a = st.eq.amuleto;
    if (a && a.slot === 'anel') { st.eq.amuleto = null; const p = !st.eq.anel1 ? 'anel1' : !st.eq.anel2 ? 'anel2' : null; if (p) st.eq[p] = a; else st.inv.push(a); }
  }

  function rand(st) {                                   // mulberry32, estado em st.rng
    st.rng = (st.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(st.rng ^ (st.rng >>> 15), 1 | st.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function itemStats(slot, ilvl, r) {
    const m = RARITIES[r].mul;
    const atk = Math.round((4 + ilvl * 1.6) * m), hp = Math.round((20 + ilvl * 7) * m), gold = Math.round((2 + ilvl * 0.15) * m);
    if (slot === 'arma')     return { atk, hp: 0, gold: 0 };
    if (slot === 'elmo')     return { atk: 0, hp: Math.round(hp * 0.6), gold: 0 };
    if (slot === 'armadura') return { atk: 0, hp, gold: 0 };
    if (slot === 'calca')    return { atk: Math.round(atk * 0.2), hp: Math.round(hp * 0.7), gold: 0 };
    if (slot === 'botas')    return { atk: Math.round(atk * 0.4), hp: Math.round(hp * 0.4), gold: 0 };
    if (slot === 'anel')     return { atk: Math.round(atk * 0.4), hp: 0, gold: Math.round(gold * 0.5) };
    return { atk: Math.round(atk * 0.3), hp: 0, gold };                                   // amuleto
  }
  function itemValue(it) { return 5 + Math.round(it.ilvl * 3 * Math.pow(it.rarity + 1, 1.5)); }
  function makeItem(st, slot, rarity, ilvl, set) {
    const info = SLOT_INFO[slot], base = info.names[Math.floor(rand(st) * info.names.length)];
    const s = itemStats(slot, ilvl, rarity);
    let adj = set ? SETS[set].suffix : RARITIES[rarity].adj;                        // concorda com o gênero/número do nome-base
    if (!set && /(a|as)$/.test(base) && !/^d[eo] /.test(adj)) adj = adj.replace(/o$/, 'a');
    if (!set && /s$/.test(base) && !/^d[eo] /.test(adj)) adj += 's';
    const it = { id: st.nextId++, slot, rarity, ilvl, name: base + ' ' + adj, atk: s.atk, hp: s.hp, gold: s.gold };
    if (set) it.set = set;
    return it;
  }
  // Sorteia o drop de um abate. Devolve o item ou null.
  function rollDrop(st, floor, boss) {
    if (!boss && rand(st) >= DROP_CHANCE) return null;
    const boost = 1 + floor / 40;
    const ws = RARITIES.map((r, i) => (boss && i === 0) ? 0 : r.w * (i >= 2 ? boost * (boss ? 3 : 1) : 1));
    let x = rand(st) * ws.reduce((a, b) => a + b, 0), r = 0;
    for (; r < ws.length - 1; r++) { if (x < ws[r]) break; x -= ws[r]; }
    const rs = rand(st), rt = rand(st), rw = rand(st), rp = rand(st), rk = rand(st);   // sempre 5 sorteios: o fluxo do PRNG não depende do ramo
    let set = null, slot = SLOTS[Math.floor(rk * SLOTS.length)];
    if (r >= 1 && rs < (boss ? SET_BOSS_CHANCE : SET_CHANCE)) {
      // viés: conjuntos que você já está montando saem mais, e as peças que faltam também
      const held = k => { const c = {}; const add = it => { if (it && it.set === k) c[it.slot] = (c[it.slot] || 0) + 1; }; st.inv.forEach(add); EQ_POS.forEach(p => add(st.eq[p])); return c; };
      const ws2 = SET_KEYS.map(k => 1 + 2 * Object.values(held(k)).reduce((a, b) => a + b, 0));
      let y = rw * ws2.reduce((a, b) => a + b, 0), i = 0;
      for (; i < ws2.length - 1; i++) { if (y < ws2[i]) break; y -= ws2[i]; }
      set = SET_KEYS[i];
      const c = held(set), missing = SLOTS.filter(t => (c[t] || 0) < (t === 'anel' ? 2 : 1));
      if (missing.length && rp < 0.7) slot = missing[Math.floor(rt * missing.length)];
    }
    return makeItem(st, slot, r, floor, set);
  }
  function eqBonus(eq) {
    const b = { atk: 0, hp: 0, gold: 0 };
    EQ_POS.forEach(s => { const it = eq && eq[s]; if (it) { b.atk += it.atk; b.hp += it.hp; b.gold += it.gold; } });
    return b;
  }
  function itemScore(it) { return it ? it.atk + it.hp / 4 + it.gold * 3 : 0; }
  // Posições onde um tipo de item pode ficar (o anel tem duas).
  function posFor(slot) { return slot === 'anel' ? ['anel1', 'anel2'] : [slot]; }
  // Onde o item vai ao equipar: posição vazia, senão a ocupada pelo item mais fraco.
  function targetPos(st, slot) {
    const ps = posFor(slot);
    return ps.find(p => !st.eq[p]) || ps.reduce((a, b) => itemScore(st.eq[b]) < itemScore(st.eq[a]) ? b : a);
  }
  // Item equipado que o novo substituiria (ou null se há posição livre) — para comparar na mochila.
  function replaced(st, slot) { const p = targetPos(st, slot); return st.eq[p] || null; }
  function equipItem(st, id) {
    const i = st.inv.findIndex(x => x.id === id);
    if (i < 0) return false;
    const it = st.inv.splice(i, 1)[0], pos = targetPos(st, it.slot), prev = st.eq[pos];
    st.eq[pos] = it;
    if (prev) st.inv.push(prev);
    return true;
  }
  function unequipItem(st, slot) {
    const it = st.eq[slot];
    if (!it || st.inv.length >= BAG_MAX) return false;
    st.eq[slot] = null; st.inv.push(it); return true;
  }
  function sellItem(st, id) {
    const i = st.inv.findIndex(x => x.id === id);
    if (i < 0) return 0;
    const g = itemValue(st.inv[i]); st.inv.splice(i, 1); st.gold += g; return g;
  }
  // Vende comuns/incomuns que não superam o item equipado no mesmo espaço.
  function sellWorse(st) {
    let g = 0;
    st.inv.slice().forEach(it => {
      if (it.rarity <= 1 && itemScore(it) <= itemScore(replaced(st, it.slot))) g += sellItem(st, it.id);
    });
    return g;
  }

  /* ── pets ──
     Um companheiro ativo luta ao lado do herói e dá bônus percentuais (que
     acompanham o poder do herói). Raros: 0,6% por abate; chefe solta com
     12% e o primeiro chefe derrotado sempre solta um. Repetido = sobe de
     nível (máx. PET_MAX_LV); acima disso é vendido por ouro. */
  const PET_CHANCE = 0.006, PET_BOSS_CHANCE = 0.12, PET_MAX_LV = 10, PET_LV_STEP = 0.2;
  const PETS = [
    { k: 'rato',    emoji: '🐀', name: 'Ratinho Esperto',   r: 0, b: { gold: 4 } },
    { k: 'passaro', emoji: '🐦', name: 'Passarinho',        r: 0, b: { atk: 3 } },
    { k: 'tartaru', emoji: '🐢', name: 'Tartaruga',         r: 0, b: { hp: 5 } },
    { k: 'raposa',  emoji: '🦊', name: 'Raposa Astuta',     r: 1, b: { gold: 6, atk: 2 } },
    { k: 'lobo',    emoji: '🐺', name: 'Lobinho',           r: 1, b: { atk: 5 } },
    { k: 'javali',  emoji: '🐗', name: 'Javali',            r: 1, b: { hp: 8 } },
    { k: 'gato',    emoji: '🐱', name: 'Gato das Sombras',  r: 2, b: { gold: 9, atk: 3 } },
    { k: 'falcao',  emoji: '🦅', name: 'Falcão',            r: 2, b: { atk: 8, hp: 3 } },
    { k: 'urso',    emoji: '🐻', name: 'Urso Guardião',     r: 3, b: { hp: 15, atk: 5 } },
    { k: 'coruja',  emoji: '🦉', name: 'Coruja Arcana',     r: 3, b: { atk: 8, gold: 8 } },
    { k: 'dragao',  emoji: '🐲', name: 'Dragãozinho',       r: 4, b: { atk: 12, hp: 12, gold: 6 } },
    { k: 'unicor',  emoji: '🦄', name: 'Unicórnio',         r: 4, b: { hp: 15, gold: 12, atk: 5 } },
  ];
  const PET_BY_KEY = {}; PETS.forEach(p => { PET_BY_KEY[p.k] = p; });
  function petMul(lv) { return 1 + PET_LV_STEP * (Math.max(1, lv) - 1); }
  // Bônus (em %) de uma espécie num nível.
  function petPct(sp, lv) {
    const d = PET_BY_KEY[sp], m = petMul(lv), o = { atk: 0, hp: 0, gold: 0 };
    if (d) Object.keys(d.b).forEach(k => { o[k] = Math.round(d.b[k] * m * 10) / 10; });
    return o;
  }
  function activePet(st) { return st.pets.find(p => p.sp === st.pet) || null; }
  function petBonus(st) { const p = activePet(st); return p ? petPct(p.sp, p.lv) : { atk: 0, hp: 0, gold: 0 }; }
  function setPet(st, sp) { if (!st.pets.some(p => p.sp === sp)) return false; st.pet = sp; return true; }
  function petValue(sp) { return 100 * Math.pow(PET_BY_KEY[sp].r + 1, 1.5) | 0; }
  // Sorteia o pet de um abate. Devolve { sp, isNew, lv } | { sp, sold } | null e já aplica no estado.
  function rollPet(st, floor, boss) {
    const first = boss && !st.pets.length;
    if (!first && rand(st) >= (boss ? PET_BOSS_CHANCE : PET_CHANCE)) return null;
    const boost = 1 + floor / 40;
    const ws = RARITIES.map((r, i) => (first && i > 1) ? 0 : r.w * (i >= 2 ? boost * (boss ? 3 : 1) : 1));
    let x = rand(st) * ws.reduce((a, b) => a + b, 0), r = 0;
    for (; r < ws.length - 1; r++) { if (x < ws[r]) break; x -= ws[r]; }
    const pool = PETS.filter(p => p.r === r);
    const def = pool[Math.floor(rand(st) * pool.length)];
    const own = st.pets.find(p => p.sp === def.k);
    if (!own) { st.pets.push({ sp: def.k, lv: 1 }); if (!st.pet) st.pet = def.k; return { sp: def.k, isNew: true, lv: 1 }; }
    if (own.lv < PET_MAX_LV) { own.lv++; return { sp: def.k, isNew: false, lv: own.lv }; }
    const g = petValue(def.k); st.gold += g; return { sp: def.k, sold: g };
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
      const drop = rollDrop(st, st.enc.f, m.boss);
      if (drop) {
        if (st.inv.length >= BAG_MAX) { const g = itemValue(drop); st.gold += g; ev.sold = { item: drop, gold: g }; }
        else { st.inv.push(drop); ev.drop = drop; }
      }
      const pet = rollPet(st, st.enc.f, m.boss);
      if (pet) ev.pet = pet;
      st.enc = null;
    }
    return ev;
  }

  // Qual estado está à frente? energySpent só cresce, então é a medida de progresso:
  // um jogo recém-criado (0) nunca ganha de um com progresso, mesmo com "last" mais novo.
  function ahead(a, b) {
    const ea = (a && a.energySpent) || 0, eb = (b && b.energySpent) || 0;
    return ea > eb || (ea === eb && ((a && a.last) || 0) > ((b && b.last) || 0));
  }

  // Recalcula o que rolou enquanto o app esteve fechado.
  function catchUp(st, ctx) {
    const now = ctx.now || Date.now();
    const elapsed = Math.max(0, now - st.last);
    const capped = elapsed > OFFLINE_CAP_ROUNDS * ROUND_MS;
    let rounds = Math.min(Math.floor(elapsed / ROUND_MS), OFFLINE_CAP_ROUNDS);
    const before = { gold: st.gold, kills: st.kills, best: st.best, spent: st.energySpent };
    let ran = 0, dry = false, drops = 0, pets = [];
    while (rounds-- > 0) {
      const ev = stepRound(st, { stats: ctx.stats, exp: ctx.exp, now });
      if (!ev) { dry = true; break; }
      if (ev.drop || ev.sold) drops++;
      if (ev.pet && !ev.pet.sold) pets.push(ev.pet);
      if (ev.pet && !ev.pet.sold && ctx.recalc) ctx.stats = ctx.recalc();   // bônus do pet mudou
      ran++;
    }
    st.last = now;
    const sum = { rounds: ran, kills: st.kills - before.kills, gold: st.gold - before.gold, floors: st.best - before.best, drops, pets, capped, dry, elapsed };
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
    SLOTS, EQ_POS, POS_LABEL, SLOT_INFO, RARITIES, BAG_MAX, DROP_CHANCE, itemValue, itemScore, equipItem, unequipItem, sellItem, sellWorse, replaced,
    SETS, SET_KEYS, setBonus, setCounts, PETS, PET_BY_KEY, PET_CHANCE, PET_BOSS_CHANCE, PET_MAX_LV, petPct, petBonus, activePet, setPet, petValue,
    roundsToKill, canWin, pickFloor, ahead, energyEarned, energyAvail, stepRound, catchUp, weekKey,
    worldBoss, claimWorldBoss, isBoss, BOSS_ROUNDS,
  };
})();
