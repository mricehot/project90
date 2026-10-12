/* ═══════════════════════════════════════════════
   APP MOBILE — Jogo (módulo de app.js)
   Sistema (nível/rank) · Masmorra (idle) · Conquistas · Vitórias
═══════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.P90App;
  if (!A) return;
  const { esc, openSheet, closeSheet, undoable, note } = A;
  const val = (form, sel) => (form.querySelector(sel) || {}).value || '';
  const fmt = n => Math.round(n || 0).toLocaleString('pt-BR');
  const loading = { sub: '', html: '<div class="empty">Carregando…</div>' };

  /* ══════════ SISTEMA ══════════ */
  const ATTRS = [['forca', 'Força'], ['vigor', 'Vigor'], ['foco', 'Foco'], ['mente', 'Mente'], ['espirito', 'Espírito']];
  const sistema = {
    title: 'Sistema', group: 'Jogo', order: 0,
    meta() { const S = Store.computeSystem(); return 'rank ' + S.rank + ' · nível ' + S.level; },
    view() {
      const S = Store.computeSystem();
      const pct = S.expForNext ? Math.round(S.expIntoLevel / S.expForNext * 100) : 0;
      const max = Math.max(40, ...ATTRS.map(a => S.attributes[a[0]]));
      let html = `<div class="hero"><div class="big">${esc(S.rank)}<small>${esc(S.className)} · nível ${S.level}</small></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="hint">${fmt(S.expIntoLevel)} de ${fmt(S.expForNext)} EXP para o próximo nível</div></div>`;
      html += `<h2>Missão do dia <b>${S.quest.done} de ${S.quest.total}</b></h2>`;
      html += S.quest.items.length
        ? S.quest.items.map(i => `<div class="row plain ${i.done ? 'done' : ''}"><span class="ck">${i.done ? '✓' : ''}</span><span class="tx">${esc(i.name)}</span></div>`).join('')
        : '<div class="empty">Nenhum hábito previsto para hoje.</div>';
      if (S.quest.total) html += `<div class="hint">+${S.quest.rewardExp} EXP hoje${S.quest.complete ? ' · missão completa' : ' · +25 se fechar todas'}</div>`;
      html += '<h2>Atributos</h2>' + ATTRS.map(a => {
        const v = S.attributes[a[0]];
        return `<div class="kv" style="display:block"><div style="display:flex;justify-content:space-between"><span style="color:var(--tx)">${a[1]}</span><span>${v}</span></div><div class="prog"><i style="width:${Math.round(v / max * 100)}%"></i></div></div>`;
      }).join('');
      if (S.rankNext) {
        const need = [];
        if (S.rankNext.needLevel) need.push('nível ' + S.rankNext.needLevel);
        if (S.rankNext.needConsistency) need.push(S.rankNext.needConsistency + '% de consistência (hoje ' + S.consistency + '%)');
        html += `<h2>Próximo rank <b>${esc(S.rankNext.rank)}</b></h2><div class="hint" style="padding-top:2px">${need.length ? esc(need.join(' e ')) : 'Continue assim.'}</div>`;
      }
      const top = S.breakdown.slice(0, 6);
      if (top.length) html += '<h2>De onde vem seu EXP</h2>' + top.map(b => `<div class="kv"><span>${esc(b.label)}</span><span>+${fmt(b.exp)}</span></div>`).join('');
      return { sub: 'Nível ' + S.level + ' · ' + fmt(S.exp) + ' EXP', html };
    },
  };

  /* ══════════ MASMORRA ══════════ */
  const mz = { active: false, arena: null, listening: false };
  const SLOT_ORDER = ['arma', 'elmo', 'armadura', 'calca', 'botas', 'anel1', 'anel2', 'amuleto'];

  function ensureIdle() {
    if (!window.P90Idle) { A.load('js/idle-game.js'); return false; }
    if (!window.P90IdleView) { A.load('js/idle-view.js'); return false; }
    return true;
  }
  function statText(it) {
    return [['atk', 'ATQ', ''], ['hp', 'VIDA', ''], ['gold', 'OURO', '%']].filter(a => it[a[0]]).map(a => a[1] + ' +' + it[a[0]] + a[2]).join(' · ');
  }
  function panelHTML() {
    const V = window.P90IdleView, G = window.P90Idle, gs = V.gs(), C = V.cache();
    let html = '<h2>Melhorias</h2>' + Object.keys(G.UPGRADES).map(k => {
      const u = G.UPGRADES[k], lvl = gs.up[k], cost = G.upgradeCost(k, lvl), ok = gs.gold >= cost;
      return `<div class="row plain"><span class="tx">${esc(u.name)} <span style="color:var(--dim);font-size:13px">nível ${lvl} · ${esc(u.desc)}</span></span>
        <button class="pill" type="button" data-act="mz-up" data-k="${k}" ${ok ? '' : 'disabled style="opacity:.4"'}>${fmt(cost)}</button></div>`;
    }).join('');
    const eq = gs.eq, equipped = SLOT_ORDER.filter(s => eq[s]);
    html += `<h2>Equipamento <b>+${C.stats.bonus.atk} atq · +${C.stats.bonus.hp} vida</b></h2>`;
    html += equipped.length ? equipped.map(s => `<div class="kv"><span style="color:var(--tx)">${esc(eq[s].name)}</span><span>${esc(statText(eq[s]))}</span></div>`).join('')
      : '<div class="empty">Nada equipado. Monstros soltam itens.</div>';
    const better = gs.inv.filter(it => G.itemScore(it) > G.itemScore(G.replaced(gs, it.slot))).length;
    html += `<div class="kv"><span>Mochila</span><span>${gs.inv.length} de ${G.BAG_MAX}</span></div>
      <div class="acts"><button class="btn" type="button" data-act="mz-best" ${better ? '' : 'disabled style="opacity:.4"'}>Equipar melhores${better ? ' (' + better + ')' : ''}</button>
      <button class="btn" type="button" data-act="mz-sell" ${gs.inv.length ? '' : 'disabled style="opacity:.4"'}>Vender piores</button></div>`;
    if (gs.pets.length) {
      html += '<h2>Pet</h2>' + gs.pets.map(p => {
        const d = G.PET_BY_KEY[p.sp]; if (!d) return '';
        const on = gs.pet === p.sp;
        return `<div class="row ${on ? 'done' : ''}"><button class="ck" type="button" data-act="mz-pet" data-k="${p.sp}" aria-label="Usar">${on ? '✓' : ''}</button>
          <button class="tx" type="button" data-act="mz-pet" data-k="${p.sp}">${esc(d.emoji + ' ' + d.name)}</button><span class="mt">nv ${p.lv}</span></div>`;
      }).join('');
    }
    const wb = G.worldBoss(Date.now(), gs), hp = wb.hp || Math.round(G.BOSS_ROUNDS * C.stats.atk), pct = Math.min(100, wb.mine / hp * 100);
    const claimed = gs.week.key === wb.key && gs.week.claimed;
    html += `<h2>Chefe da semana <b>${esc(wb.name)}</b></h2><div class="prog"><i style="width:${pct}%"></i></div>
      <div class="hint">${fmt(wb.mine)} de ${fmt(hp)} de dano · recompensa ${fmt(wb.reward)} ouro</div>`;
    if (wb.defeated && !claimed) html += '<div class="acts"><button class="btn main" type="button" data-act="mz-claim">Resgatar recompensa</button></div>';
    else if (claimed) html += '<div class="hint">Recompensa resgatada ✓</div>';
    return html;
  }
  function refreshPanel() {
    const p = document.getElementById('mz-panel');
    if (p && mz.active) p.innerHTML = panelHTML();
  }
  const masmorra = {
    title: 'Masmorra', group: 'Jogo', order: 1,
    meta() {
      if (!window.P90Idle) return '';
      try { const gs = window.P90Idle.normalize(Store.getIdleState(), Date.now()); return gs.best ? 'andar ' + gs.best : ''; } catch (e) { return ''; }
    },
    view() {
      if (!ensureIdle()) return loading;
      const V = window.P90IdleView;
      if (!V.init()) { V.whenReady(() => A.render(true)); return loading; }
      return { sub: 'O herói luta com a energia dos seus hábitos', html: '<div id="mz-arena"></div><div id="mz-panel"></div>' };
    },
    after() {
      const V = window.P90IdleView; if (!V || !document.getElementById('mz-arena')) return;
      mz.active = true;
      mz.arena = V.mount(document.getElementById('mz-arena'), { hud: true });
      if (!mz.listening) {
        mz.listening = true;
        V.on(e => { if (mz.active && e.type === 'round' && e.ev && (e.ev.killed || e.ev.drop || e.ev.pet)) refreshPanel(); });
      }
      refreshPanel();
      V.start();
      return () => { mz.active = false; if (mz.arena) V.unmount(mz.arena); mz.arena = null; };
    },
    actions: {
      'mz-up': (el) => {
        const V = window.P90IdleView, G = window.P90Idle;
        if (G.buyUpgrade(V.gs(), el.dataset.k)) { V.recalc(); V.save(); if (mz.arena) mz.arena.refreshInfo(); refreshPanel(); }
      },
      'mz-best': () => {
        const V = window.P90IdleView, G = window.P90Idle, gs = V.gs();
        let n = 0, guard = 0;
        for (let moved = true; moved && guard++ < 40;) {
          moved = false;
          for (const it of gs.inv.slice()) {
            if (G.itemScore(it) > G.itemScore(G.replaced(gs, it.slot)) && G.equipItem(gs, it.id)) { n++; moved = true; break; }
          }
        }
        V.recalc(); V.save(); if (mz.arena) mz.arena.refreshInfo(); refreshPanel();
        note(n ? n + (n === 1 ? ' item equipado' : ' itens equipados') : 'Nada melhor para equipar');
      },
      'mz-sell': () => {
        const V = window.P90IdleView, G = window.P90Idle, g = G.sellWorse(V.gs());
        V.save(); refreshPanel(); note(g ? 'Vendidos por +' + fmt(g) + ' de ouro' : 'Nenhum item pior que o equipado');
      },
      'mz-pet': (el) => {
        const V = window.P90IdleView, G = window.P90Idle;
        if (G.setPet(V.gs(), el.dataset.k)) { V.recalc(); V.save(); if (mz.arena) mz.arena.refreshInfo(); refreshPanel(); }
      },
      'mz-claim': () => {
        const V = window.P90IdleView, G = window.P90Idle, got = G.claimWorldBoss(V.gs(), Date.now());
        if (got) { V.save(); refreshPanel(); note('+' + fmt(got) + ' de ouro'); }
      },
    },
  };

  /* ══════════ CONQUISTAS ══════════ */
  const conquistas = {
    title: 'Conquistas', group: 'Jogo', order: 2,
    meta() {
      const cats = window.P90_ACHIEVEMENTS || [], all = cats.reduce((n, c) => n + c.achievements.length, 0);
      const got = Object.keys(Store.getAchievements()).length; return all ? got + ' de ' + all : got + '';
    },
    view() {
      const cats = window.P90_ACHIEVEMENTS || [], saved = Store.getAchievements();
      if (!cats.length) return loading;
      const all = cats.reduce((n, c) => n + c.achievements.length, 0), got = Object.keys(saved).length;
      const pts = cats.reduce((n, c) => n + c.achievements.filter(a => saved[a.id]).reduce((s, a) => s + a.points, 0), 0);
      let html = `<div class="hero"><div class="big">${got}<small>de ${all} · ${fmt(pts)} pontos</small></div><div class="bar"><i style="width:${Math.round(got / all * 100)}%"></i></div></div>`;
      cats.forEach(c => {
        const list = c.achievements, n = list.filter(a => saved[a.id]).length;
        html += `<h2>${esc(c.name)} <b>${n} de ${list.length}</b></h2>` + list.map(a => {
          const on = !!saved[a.id];
          return `<div class="row plain" style="opacity:${on ? 1 : .55}"><span class="ck" style="${on ? 'background:var(--tx);border-color:var(--tx)' : ''}">${on ? '✓' : ''}</span>
            <span class="tx" style="text-decoration:none;color:var(--tx)">${esc(a.name)}<span class="sub2" style="display:block">${esc(a.req)}</span></span><span class="mt">${a.points}</span></div>`;
        }).join('');
      });
      return { sub: got + ' desbloqueadas', html };
    },
  };

  /* ══════════ VITÓRIAS ══════════ */
  const vit = {
    title: 'Vitórias', group: 'Jogo', order: 3,
    meta() { const n = Store.winsCount(); return n ? n + '' : ''; },
    view() {
      const wins = Store.getWins().slice().sort((a, b) => b.id - a.id), today = A.day();
      let html = '', cur = null;
      if (!wins.length) html = '<div class="empty">Registre pequenas vitórias do dia. Toque em + para a primeira.</div>';
      wins.forEach(w => {
        if (w.dayNum !== cur) { cur = w.dayNum; html += `<h2>${w.dayNum === today ? 'Hoje' : 'Dia ' + w.dayNum}</h2>`; }
        html += `<div class="row plain"><span class="tx">${esc(w.text)}</span><button class="x" type="button" data-act="win-del" data-id="${w.id}" aria-label="Apagar">✕</button></div>`;
      });
      return { sub: wins.length + (wins.length === 1 ? ' vitória' : ' vitórias'), html };
    },
    fab() {
      openSheet(`<h3>Nova vitória</h3><form data-form="win-add"><label for="f-text">O que você conseguiu hoje?</label>
        <input id="f-text" maxlength="160" autocomplete="off"><div class="acts"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn main" type="submit">Registrar</button></div></form>`);
    },
    actions: {
      'win-del': (el) => {
        const id = Number(el.dataset.id), w = Store.getWins().find(x => x.id === id); if (!w) return;
        const snap = Object.assign({}, w);
        Store.deleteWin(id); A.render();
        undoable('Vitória apagada', () => { Store.restoreWin(snap); A.render(); });
      },
    },
    forms: {
      'win-add'(form) {
        const t = val(form, '#f-text').trim(); if (!t) return;
        Store.addWin(t); closeSheet(); A.render(); note('Vitória registrada');
      },
    },
  };

  A.register('sistema', sistema);
  A.register('masmorra', masmorra);
  A.register('conquistas', conquistas);
  A.register('vitorias', vit);
})();
