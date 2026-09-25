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
      if (c.idleState && G.ahead(c.idleState, gs)) {
        gs = G.normalize(c.idleState, Date.now()); recalc();
        arenas.forEach(a => a.restore()); emit({ type: 'pull' });
      }
    } catch (e) {}
  }

  /* ── ciclo de vida ── */
  /* ── espera o carregamento do servidor ──
     Iniciar antes do bootstrap criava um jogo novo (cache local vazio) que depois
     sobrescrevia o progresso salvo no servidor. Por isso o jogo só começa depois
     que o Store termina de carregar (com sucesso ou não — offline usa o espelho). */
  let settled = false; const waiters = [];
  function whenReady(fn) { if (settled) fn(); else waiters.push(fn); }
  (function () {
    const done = () => { settled = true; waiters.splice(0).forEach(f => { try { f(); } catch (e) { console.error(e); } }); };
    try { Promise.resolve(Store.bootstrap()).then(done, done); } catch (e) { done(); }
  })();

  function init() {
    if (inited) return lastSum;
    if (!settled) return null;
    gs = G.normalize(Store.getIdleState(), Date.now());
    refreshSys();
    lastSum = G.catchUp(gs, { stats: C.stats, exp: C.exp, now: Date.now(), recalc: () => G.playerStats(C.S, gs) });
    recalc();
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
    if (srv && G.ahead(srv, gs)) gs = G.normalize(srv, Date.now());
    refreshSys();
    lastSum = G.catchUp(gs, { stats: C.stats, exp: C.exp, now: Date.now(), recalc: () => G.playerStats(C.S, gs) });
    recalc();
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
    try {
      if (document.hidden || !anyVisible()) { timer = setTimeout(tick, 1000); return; }   // segue de olho: nenhum evento perdido mata o laço
      if (running) {
        if (holdLock()) {
          const now = Date.now();
          const ev = G.stepRound(gs, { stats: C.stats, exp: C.exp, now });
          gs.last = now;
          if (ev && ev.pet && !ev.pet.sold) recalc();
          if (ev) save();
          arenas.forEach(a => { try { a.play(ev); } catch (e) { console.error('[Masmorra] animação:', e); } });
          emit({ type: 'round', ev });
        } else pullMirror();
      }
    } catch (e) { console.error('[Masmorra] rodada:', e); }
    if (!timer) timer = setTimeout(tick, G.ROUND_MS);
  }
  function start() { if (inited && !timer) timer = setTimeout(tick, 600); }
  function stop() { if (timer) { clearTimeout(timer); timer = null; } }
  function setRunning(v) { running = !!v; if (running) gs.last = Date.now(); }

  /* ── guerreiro: SVG em camadas, cada peça equipada muda o visual ──
     Cor da peça = cor do conjunto (se tiver) ou da raridade. Épico+ brilha;
     4+ peças de um conjunto acendem uma aura; 6+ ganham uma capa. */
  const RC = ['#9a8b7a', '#a9b2ba', '#d5dfef', '#a07ee8', '#f2c744'];
  let svgN = 0;
  function shade(hex, a) {
    const n = parseInt(hex.slice(1), 16), t = a < 0 ? 0 : 255, p = Math.abs(a);
    const m = v => Math.round((t - v) * p + v);
    return 'rgb(' + m(n >> 16) + ',' + m((n >> 8) & 255) + ',' + m(n & 255) + ')';
  }
  function warriorSVG(eq, sb) {
    const col = it => it ? (it.set ? G.SETS[it.set].color : RC[it.rarity]) : null;
    const gl = it => it && it.rarity >= 3 ? ' style="filter:drop-shadow(0 0 1.8px ' + col(it) + ')"' : '';
    const skin = '#c9b7a3', skinD = shade(skin, -0.22), cloth = '#5a5a62';
    const top = sb.active.slice().sort((a, b) => b.n - a.n)[0], setCol = top && top.n >= 4 ? G.SETS[top.key].color : null;
    const gid = 'gaura' + (++svgN);
    let o = '<svg class="gm-warrior" viewBox="0 0 60 92" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
    if (setCol) o += '<defs><radialGradient id="' + gid + '"><stop offset="0" stop-color="' + setCol + '" stop-opacity=".45"/><stop offset="1" stop-color="' + setCol + '" stop-opacity="0"/></radialGradient></defs><circle class="aura" cx="30" cy="52" r="34" fill="url(#' + gid + ')"/>';
    if (top && top.n >= 6) o += '<path d="M20 32L10 78Q30 88 50 78L40 32z" fill="' + shade(setCol, -0.35) + '"/><path d="M20 32L10 78Q30 88 50 78L40 32z" fill="none" stroke="' + setCol + '" stroke-width=".8" opacity=".7"/>';
    o += '<ellipse cx="30" cy="88.5" rx="15" ry="2.2" fill="#000" opacity=".35"/>';

    // pernas + calça + botas
    const P = eq.calca, B = eq.botas;
    o += '<rect x="21" y="56" width="8" height="28" rx="2" fill="' + skin + '"/><rect x="31" y="56" width="8" height="28" rx="2" fill="' + skin + '"/>';
    if (P) { const c = col(P); o += '<g' + gl(P) + '><rect x="20.4" y="54" width="9.2" height="25" rx="2" fill="' + c + '"/><rect x="30.4" y="54" width="9.2" height="25" rx="2" fill="' + c + '"/>' +
      '<circle cx="25" cy="67" r="2.2" fill="' + shade(c, 0.28) + '"/><circle cx="35" cy="67" r="2.2" fill="' + shade(c, 0.28) + '"/><path d="M30 54v11" stroke="' + shade(c, -0.4) + '" stroke-width=".8"/></g>'; }
    else o += '<rect x="20" y="54" width="20" height="9" rx="2" fill="#3c3c42"/>';
    if (B) { const c = col(B); o += '<g' + gl(B) + '><rect x="19" y="78" width="11" height="10" rx="2.2" fill="' + c + '"/><rect x="30" y="78" width="11" height="10" rx="2.2" fill="' + c + '"/>' +
      '<rect x="19" y="78" width="11" height="2.4" rx="1" fill="' + shade(c, 0.3) + '"/><rect x="30" y="78" width="11" height="2.4" rx="1" fill="' + shade(c, 0.3) + '"/></g>'; }
    else o += '<rect x="20" y="83" width="10" height="5" rx="2" fill="' + skinD + '"/><rect x="30" y="83" width="10" height="5" rx="2" fill="' + skinD + '"/>';

    // tronco + braços
    const A = eq.armadura, ac = col(A);
    o += '<rect x="12.6" y="33" width="6" height="19" rx="3" fill="' + skin + '"/><rect x="41.4" y="33" width="6" height="19" rx="3" fill="' + skin + '"/>';
    o += '<rect x="19" y="31" width="22" height="25" rx="4" fill="' + cloth + '"/>';
    if (A) {
      o += '<g' + gl(A) + '><rect x="12.2" y="32" width="6.6" height="12" rx="3" fill="' + shade(ac, -0.15) + '"/><rect x="41.2" y="32" width="6.6" height="12" rx="3" fill="' + shade(ac, -0.15) + '"/>' +
        '<rect x="19" y="31" width="22" height="25" rx="4" fill="' + ac + '"/><rect x="22" y="33" width="6" height="11" rx="2" fill="' + shade(ac, 0.3) + '" opacity=".55"/>' +
        '<path d="M30 31v25M21 44h18" stroke="' + shade(ac, -0.4) + '" stroke-width=".8" fill="none"/>' +
        '<circle cx="17.6" cy="34.5" r="5.4" fill="' + shade(ac, 0.1) + '"/><circle cx="42.4" cy="34.5" r="5.4" fill="' + shade(ac, 0.1) + '"/>' +
        '<circle cx="17.6" cy="34.5" r="2.2" fill="' + shade(ac, 0.35) + '"/><circle cx="42.4" cy="34.5" r="2.2" fill="' + shade(ac, 0.35) + '"/></g>';
    }
    o += '<rect x="19" y="52" width="22" height="4" fill="#2a2a2e"/><rect x="28" y="51.4" width="4" height="5.2" rx=".8" fill="#c9a84a"/>';
    o += '<circle cx="15.6" cy="53" r="3.1" fill="' + skin + '"/><circle cx="44.4" cy="53" r="3.1" fill="' + skin + '"/>';

    // cabeça, cabelo/elmo
    const E = eq.elmo, ec = col(E);
    o += '<rect x="27" y="26" width="6" height="6" fill="' + skinD + '"/><circle cx="30" cy="20" r="8.2" fill="' + skin + '"/>';
    o += '<rect x="26" y="19.6" width="2" height="2.4" rx=".8" fill="#222"/><rect x="32" y="19.6" width="2" height="2.4" rx=".8" fill="#222"/><path d="M27.5 25.2q2.5 1.4 5 0" stroke="#7a6555" stroke-width=".9" fill="none"/>';
    const hair = '<path d="M21.6 19.5c0-6.4 4-10 8.4-10s8.4 3.6 8.4 10c-2-3.4-4.3-4.6-8.4-4.6s-6.4 1.2-8.4 4.6z" fill="#3a2e27"/>';
    if (!E) o += hair;
    else if (/^Coroa/.test(E.name)) o += '<g' + gl(E) + '>' + hair + '<rect x="21.4" y="12.6" width="17.2" height="3.4" rx="1" fill="' + ec + '"/><path d="M21.6 13l2.2-6 2.2 6zM27.9 13l2.1-7 2.1 7zM34 13l2.2-6 2.2 6z" fill="' + ec + '"/></g>';
    else if (/^Capuz/.test(E.name)) o += '<g' + gl(E) + '><path d="M20.4 24c-1.4-10 3.4-16.2 9.6-16.2S41 14 39.6 24c-1.2-3-3-4.4-4.6-8.4H25c-1.6 4-3.4 5.4-4.6 8.4z" fill="' + ec + '"/><path d="M25 15.6h10" stroke="' + shade(ec, -0.4) + '" stroke-width=".8"/></g>';
    else o += '<g' + gl(E) + '><path d="M20.8 22v-5c0-5.8 4-9.4 9.2-9.4s9.2 3.6 9.2 9.4v5h-3.2v-3.6H24v3.6z" fill="' + ec + '"/><rect x="29" y="17" width="2" height="7.5" fill="' + shade(ec, -0.2) + '"/>' +
      '<rect x="20.8" y="15" width="18.4" height="2.2" fill="' + shade(ec, 0.25) + '"/>' + (E.rarity >= 3 ? '<path d="M30 8.2c-2-4.4 2-6.4 6.4-5.4-2.2 1-3.2 3.2-3.2 5.4z" fill="' + shade(ec, 0.15) + '"/>' : '') + '</g>';

    // amuleto
    const M = eq.amuleto;
    if (M) { const c = col(M); o += '<g' + gl(M) + '><path d="M23.6 30.6q6.4 13.4 12.8 0" fill="none" stroke="' + shade(c, 0.3) + '" stroke-width=".9"/><circle cx="30" cy="41.4" r="2.6" fill="' + c + '"/><circle cx="29.3" cy="40.7" r=".8" fill="' + shade(c, 0.6) + '"/></g>'; }

    // arma (mão direita, gira ao atacar)
    const W = eq.arma;
    if (W) {
      const c = col(W), bl = shade(c, 0.12), wood = '#7a5a3a';
      let w;
      if (/^Adaga/.test(W.name)) w = '<path d="M43.4 50.5V39.5l1.6-3.4 1.6 3.4v11z" fill="' + bl + '"/><rect x="41.6" y="50" width="6.8" height="1.8" rx=".6" fill="' + shade(c, -0.3) + '"/>';
      else if (/^Espada/.test(W.name)) w = '<path d="M43.4 50V25l1.6-4.4 1.6 4.4v25z" fill="' + bl + '"/><path d="M45 21v29" stroke="' + shade(c, 0.5) + '" stroke-width=".5"/><rect x="40.6" y="49.4" width="8.8" height="2.2" rx=".8" fill="' + shade(c, -0.3) + '"/><rect x="44" y="51.4" width="2" height="7" rx=".8" fill="' + wood + '"/>';
      else if (/^Machado/.test(W.name)) w = '<rect x="44" y="26" width="2" height="34" rx=".8" fill="' + wood + '"/><path d="M46 26c9-1.4 10.4 12 0 13z" fill="' + bl + '"/><path d="M46 28c5 .4 6 7 0 8.4z" fill="' + shade(c, 0.35) + '" opacity=".6"/>';
      else if (/^Lança/.test(W.name)) w = '<rect x="44" y="14" width="2" height="48" rx=".8" fill="' + wood + '"/><path d="M42.4 15.4L45 5l2.6 10.4z" fill="' + bl + '"/>';
      else w = '<rect x="44" y="17" width="2" height="45" rx=".8" fill="' + wood + '"/><circle cx="45" cy="13.4" r="3.8" fill="' + c + '" style="filter:drop-shadow(0 0 2.6px ' + c + ')"/><circle cx="44" cy="12.4" r="1" fill="' + shade(c, 0.6) + '"/>';
      o += '<g class="wp" style="transform-origin:44.4px 53px' + (W.rarity >= 3 ? ';filter:drop-shadow(0 0 1.8px ' + c + ')' : '') + '">' + w + '</g>';
      o += '<circle cx="44.4" cy="53" r="3.1" fill="' + skin + '"/>';
    }
    // anéis (um em cada mão)
    [['anel1', 44.4], ['anel2', 15.6]].forEach(r => { const it = eq[r[0]]; if (it) o += '<circle cx="' + r[1] + '" cy="53" r="3.4" fill="none" stroke="' + col(it) + '" stroke-width="1.3"' + gl(it) + '/>'; });
    return o + '</svg>';
  }

  /* ── arena (DOM + animações) ── */
  function mount(root, opts) {
    opts = opts || {};
    root.innerHTML =
      (opts.hud ? '<div class="ia-hud"><span class="en">Energia<b data-k="energy">0</b></span><span>Ouro<b data-k="gold">0</b></span><span>Abates<b data-k="kills">0</b></span><span>Recorde<b data-k="best">0</b></span></div>' : '') +
      '<div class="gm-stage">' +
        '<div class="gm-floor"></div>' +
        '<div class="gm-actor gm-hero"><div class="gm-sprite gm-body"></div><div class="gm-hp"><i></i></div><div class="gm-name">Você</div></div>' +
        '<div class="gm-actor gm-pet" hidden><div class="gm-sprite"></div></div>' +
        '<div class="gm-actor gm-mon"><div class="gm-sprite"></div><div class="gm-hp"><i></i></div><div class="gm-name"></div></div>' +
        '<div class="gm-fx"></div>' +
        '<div class="gm-rest"><div><b>zzz</b><br>Sem energia — o herói descansa.<br>Cumpra seus hábitos para recarregar.</div></div>' +
      '</div>' +
      '<div class="ia-info">' +
        '<div class="ia-row"><span class="ia-k">Você</span><span class="ia-v" data-k="hero"></span></div>' +
        '<div class="ia-row"><span class="ia-k" data-k="monk">Monstro</span><span class="ia-v" data-k="mon"></span></div>' +
        '<div class="ia-row"><span class="ia-k">Luta</span><span class="ia-v" data-k="pace"></span></div>' +
        '<div class="ia-row"><span class="ia-k">Drops</span><span class="ia-v" data-k="drop"></span></div>' +
        '<div class="ia-row"><span class="ia-k">Pet</span><span class="ia-v" data-k="pet"></span></div>' +
      '</div>' +
      '<div class="gm-log ia-log"></div>';
    const q = s => root.querySelector(s), k = n => root.querySelector('[data-k="' + n + '"]');
    const el = {
      stage: q('.gm-stage'), hero: q('.gm-hero'), pet: q('.gm-pet'), petSprite: q('.gm-pet .gm-sprite'), body: q('.gm-body'), mon: q('.gm-mon'), sprite: q('.gm-mon .gm-sprite'),
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
    // Redesenha o guerreiro quando o equipamento muda (e dá um flash de "trocou de roupa").
    let heroSig = '';
    function heroView() {
      const sig = G.EQ_POS.map(p => gs.eq[p] ? gs.eq[p].id : 0).join(',');
      if (sig === heroSig) return;
      const first = !heroSig; heroSig = sig;
      el.body.innerHTML = warriorSVG(gs.eq, G.setBonus(gs.eq));
      if (!first) anim(el.hero, 'flash', 700);
    }
    function petInfo() {
      const ap = G.activePet(gs), d = ap && G.PET_BY_KEY[ap.sp];
      el.pet.hidden = !d;
      if (!d) { k('pet').innerHTML = '<em>nenhum · ' + String(G.PET_CHANCE * 100).replace('.', ',') + '% por abate, chefe ' + Math.round(G.PET_BOSS_CHANCE * 100) + '%</em>'; return; }
      el.petSprite.textContent = d.emoji;
      const p = G.petPct(ap.sp, ap.lv), parts = [];
      [['atk', 'ATQ'], ['hp', 'VIDA'], ['gold', 'OURO']].forEach(a => { if (p[a[0]]) parts.push('+' + String(p[a[0]]).replace('.', ',') + '% ' + a[1]); });
      k('pet').innerHTML = d.emoji + ' <b>' + d.name + '</b> <em>nv ' + ap.lv + ' · ' + parts.join(' · ') + '</em>';
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
      heroView();
      petInfo();
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
      if (!el.pet.hidden) later(() => anim(el.pet, 'atk', 450), 140);
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
        if (ev.pet) later(() => {
          const pt = ev.pet, d = G.PET_BY_KEY[pt.sp];
          if (pt.sold) { setLog('Pet repetido no nível máximo — <b>' + d.name + '</b> vendido por <b>+' + fmt(pt.sold) + '</b> ouro.'); return; }
          float(d.emoji + (pt.isNew ? ' novo pet!' : ' nv ' + pt.lv), 'drop r' + d.r, 40, 4);
          setLog(pt.isNew ? '<b>Novo pet!</b> ' + d.emoji + ' ' + d.name + ' <em>(' + G.RARITIES[d.r].label + ')</em> agora luta ao seu lado.' : '<b>' + d.name + '</b> subiu para o <b>nível ' + pt.lv + '</b>!');
        }, 800);
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
    init, whenReady, mount, start, stop, on, emit, save, recalc, refreshSys, setRunning, resync, warriorSVG,
    gs: () => gs, cache: () => C, away: () => lastSum, isRunning: () => running,
  };
})();
