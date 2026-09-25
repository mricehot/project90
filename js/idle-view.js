/* ═══════════════════════════════════════════════
   PROJECT 90 — Masmorra: runtime + arena animada (compartilhado)

   Uma única "runtime" por página (estado do jogo, energia, loop de rodadas)
   e N "arenas" montadas em elementos da página — hoje: aba Masmorra do
   Sistema e o card do Dashboard. As regras do jogo ficam em idle-game.js;
   aqui é só o que roda ao vivo e o que aparece na tela.

   Se o jogo estiver aberto em duas abas, só a que segura o "lock" (batida
   no localStorage a cada rodada) luta; a outra apenas espelha o estado.
═══════════════════════════════════════════════ */
(function () {
  const G = window.P90Idle;
  let gs = null, C = { S: null, stats: null, exp: 0 };
  let inited = false, running = true, timer = null, lastSum = null;
  const arenas = [], listeners = [];
  const LOCK = 'p90_idle_lock', TAB = Math.random().toString(36).slice(2);

  const fmt = n => Math.round(n).toLocaleString('pt-BR');
  function on(fn) { listeners.push(fn); }
  function emit(e) { listeners.forEach(fn => { try { fn(e); } catch (x) { console.error(x); } }); }

  function refreshSys() { const S = Store.computeSystem(); C.S = S; C.exp = S.exp; C.stats = G.playerStats(S, gs); }
  function recalc() { if (C.S) C.stats = G.playerStats(C.S, gs); }
  function save() { Store.saveIdleState(gs); }

  /* ── lock entre abas ── */
  function holdLock() {
    const now = Date.now();
    try {
      const l = JSON.parse(localStorage.getItem(LOCK) || 'null');
      if (l && l.id !== TAB && now - l.ts < 6000) return false;
      localStorage.setItem(LOCK, JSON.stringify({ id: TAB, ts: now }));
    } catch (e) {}
    return true;
  }
  function pullMirror() {
    try {
      const c = JSON.parse(localStorage.getItem('p90_cache') || '{}');
      if (c.idleState && c.idleState.last > gs.last) {
        gs = G.normalize(c.idleState, Date.now()); recalc();
        arenas.forEach(a => a.restore()); emit({ type: 'pull' });
      }
    } catch (e) {}
  }

  /* ── ciclo de vida ── */
  function init() {
    if (inited) return lastSum;
    gs = G.normalize(Store.getIdleState(), Date.now());
    refreshSys();
    lastSum = G.catchUp(gs, { stats: C.stats, exp: C.exp, now: Date.now() });
    save(); inited = true;
    window.addEventListener('p90:synced', resync);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', () => { save(); Store.flushIdleState(); });
    setInterval(() => { if (!document.hidden && anyVisible()) { refreshSys(); emit({ type: 'sys' }); } }, 30000);
    return lastSum;
  }
  function resync() {
    if (!inited) return;
    const srv = Store.getIdleState();
    if (srv && srv.last > gs.last) gs = G.normalize(srv, Date.now());
    refreshSys();
    lastSum = G.catchUp(gs, { stats: C.stats, exp: C.exp, now: Date.now() });
    save();
    arenas.forEach(a => a.restore());
    emit({ type: 'sync', sum: lastSum });
  }
  function onVis() {
    if (!inited) return;
    if (document.hidden) { save(); Store.flushIdleState(); stop(); }
    else if (anyVisible()) { resync(); start(); }
  }
  function anyVisible() { return arenas.some(a => a.visible()); }

  function tick() {
    timer = null;
    if (document.hidden || !anyVisible()) return;
    if (running) {
      if (holdLock()) {
        const now = Date.now();
        const ev = G.stepRound(gs, { stats: C.stats, exp: C.exp, now });
        gs.last = now;
        arenas.forEach(a => a.play(ev));
        if (ev) save();
        emit({ type: 'round', ev });
      } else pullMirror();
    }
    timer = setTimeout(tick, G.ROUND_MS);
  }
  function start() { if (inited && !timer) timer = setTimeout(tick, 600); }
  function stop() { if (timer) { clearTimeout(timer); timer = null; } }
  function setRunning(v) { running = !!v; if (running) gs.last = Date.now(); }

  /* ── arena (DOM + animações) ── */
  function mount(root, opts) {
    opts = opts || {};
    root.innerHTML =
      (opts.hud ? '<div class="ia-hud"><span class="en">Energia<b data-k="energy">0</b></span><span>Ouro<b data-k="gold">0</b></span><span>Abates<b data-k="kills">0</b></span><span>Recorde<b data-k="best">0</b></span></div>' : '') +
      '<div class="gm-stage">' +
        '<div class="gm-floor"></div>' +
        '<div class="gm-actor gm-hero"><div class="gm-sprite">🥷</div><div class="gm-hp"><i></i></div><div class="gm-name">Você</div></div>' +
        '<div class="gm-actor gm-mon"><div class="gm-sprite"></div><div class="gm-hp"><i></i></div><div class="gm-name"></div></div>' +
        '<div class="gm-fx"></div>' +
        '<div class="gm-rest"><div><b>zzz</b><br>Sem energia — o herói descansa.<br>Cumpra seus hábitos para recarregar.</div></div>' +
      '</div>' +
      '<div class="ia-info">' +
        '<div class="ia-row"><span class="ia-k">Você</span><span class="ia-v" data-k="hero"></span></div>' +
        '<div class="ia-row"><span class="ia-k" data-k="monk">Monstro</span><span class="ia-v" data-k="mon"></span></div>' +
        '<div class="ia-row"><span class="ia-k">Luta</span><span class="ia-v" data-k="pace"></span></div>' +
        '<div class="ia-row"><span class="ia-k">Drops</span><span class="ia-v" data-k="drop"></span></div>' +
      '</div>' +
      '<div class="gm-log ia-log"></div>';
    const q = s => root.querySelector(s), k = n => root.querySelector('[data-k="' + n + '"]');
    const el = {
      stage: q('.gm-stage'), hero: q('.gm-hero'), mon: q('.gm-mon'), sprite: q('.gm-mon .gm-sprite'),
      heroHp: q('.gm-hero .gm-hp i'), monHp: q('.gm-mon .gm-hp i'), name: q('.gm-mon .gm-name'),
      floor: q('.gm-floor'), fx: q('.gm-fx'), log: q('.ia-log'),
    };
    let curFloor = 1, timers = [];

    function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); }
    function anim(node, cls, ms) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); setTimeout(() => node.classList.remove(cls), ms); }
    function float(text, cls, x, y) {
      const d = document.createElement('div');
      d.className = 'gm-float ' + (cls || '');
      d.textContent = text; d.style.left = x + '%'; d.style.top = y + 'px';
      el.fx.appendChild(d); setTimeout(() => d.remove(), 1050);
    }
    function setLog(html) { el.log.innerHTML = html; }

    function hud() {
      const avail = G.energyAvail(gs, C.exp);
      el.stage.classList.toggle('resting', avail <= 0);
      if (!opts.hud) return;
      k('energy').textContent = fmt(avail); k('gold').textContent = fmt(gs.gold);
      k('kills').textContent = fmt(gs.kills); k('best').textContent = gs.best;
    }
    // Linhas de informação da luta para o andar/rodada atuais.
    function info(f, done) {
      const m = G.monsterFor(f), st = C.stats, need = G.roundsToKill(st, m);
      done = Math.min(done, need);
      const heroHp = Math.max(1, st.hp - m.atk * done), monHp = Math.max(0, m.hp - st.atk * done);
      k('hero').innerHTML = 'ATQ <b>' + st.atk + '</b> · VIDA <b>' + fmt(heroHp) + '</b><em>/' + fmt(st.hp) + '</em>';
      k('monk').textContent = m.boss ? 'Chefe' : 'Monstro';
      k('mon').innerHTML = 'ATQ <b>' + m.atk + '</b> · VIDA <b>' + fmt(monHp) + '</b><em>/' + fmt(m.hp) + '</em>';
      k('pace').innerHTML = (need - done) + ' rodada' + (need - done === 1 ? '' : 's') + ' para abater · <b>+' + fmt(m.gold * st.goldMul) + ' ouro</b> · ' + (f <= gs.best ? 'farmando' : 'avançando');
      k('drop').innerHTML = m.boss ? '<b>100%</b> <em>(chefe · raridade maior)</em>' : '<b>' + Math.round(G.DROP_CHANCE * 100) + '%</b> <em>por abate</em>';
      el.heroHp.style.width = Math.round(heroHp / st.hp * 100) + '%';
      return { need, heroHp, monHp, m };
    }
    function showMonster(f, done) {
      const m = G.monsterFor(f); curFloor = f;
      el.sprite.textContent = m.emoji; el.name.textContent = m.name;
      el.mon.classList.toggle('boss', m.boss); el.stage.classList.toggle('boss', m.boss);
      el.floor.innerHTML = 'Andar <b>' + f + '</b>' + (m.boss ? '<span class="bossTag">CHEFE</span>' : '') + (f <= gs.best ? ' · farmando' : '');
      const r = info(f, done || 0);
      el.monHp.style.width = Math.round(r.monHp / m.hp * 100) + '%';
    }
    function restore() {
      timers.forEach(clearTimeout); timers = [];
      const f = gs.enc ? gs.enc.f : G.pickFloor(C.stats, gs);
      showMonster(f, gs.enc ? gs.enc.done : 0);
      hud();
    }

    function play(ev) {
      hud();
      if (!ev) return;
      const m = ev.monster;
      el.stage.classList.remove('resting');
      anim(el.hero, 'atk', 450);
      later(() => {
        anim(el.mon, 'hit', 360);
        float('-' + ev.dmg, '', 66 + Math.random() * 8, 40 + Math.random() * 30);
        const r = info(m.floor, ev.killed ? ev.need : ev.done);
        el.monHp.style.width = ev.killed ? '0%' : Math.round(r.monHp / m.hp * 100) + '%';
      }, 200);
      if (!ev.killed) {
        later(() => { anim(el.hero, 'hurt', 320); float('-' + m.atk, '', 20 + Math.random() * 8, 50 + Math.random() * 30); }, 620);
      } else {
        later(() => {
          anim(el.mon, 'die', 460);
          float('+' + fmt(ev.gold) + ' ouro', 'gold', 62, 20);
          setLog((m.boss ? '<b>Chefe derrotado!</b> ' : '') + m.name + ' abatido · <b>+' + fmt(ev.gold) + ' ouro</b>' + (ev.newFloor ? ' · <b>novo andar!</b>' : ''));
        }, 300);
        if (ev.drop) later(() => {
          const it = ev.drop, ic = G.SLOT_INFO[it.slot].icon;
          float(ic + ' ' + it.name, 'drop r' + it.rarity, 38, 14);
          setLog('<b>Drop!</b> ' + it.name + ' <em>(' + G.RARITIES[it.rarity].label + ')</em> foi para a mochila.');
        }, 600);
        if (ev.sold) later(() => {
          setLog('Mochila cheia — <b>' + ev.sold.item.name + '</b> vendido por <b>+' + fmt(ev.sold.gold) + '</b> ouro.');
        }, 600);
        later(() => { showMonster(G.pickFloor(C.stats, gs), 0); el.heroHp.style.width = '100%'; }, 900);
      }
    }

    const a = {
      root, restore, play, log: setLog, visible: () => root.isConnected && root.offsetParent !== null, hud,
      refreshInfo: () => { const cur = gs.enc ? gs.enc.f : curFloor; info(cur, gs.enc ? gs.enc.done : 0); },
    };
    arenas.push(a);
    restore();
    return a;
  }

  window.P90IdleView = {
    init, mount, start, stop, on, emit, save, recalc, refreshSys, setRunning, resync,
    gs: () => gs, cache: () => C, away: () => lastSum, isRunning: () => running,
  };
})();
