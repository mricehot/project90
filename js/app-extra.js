/* ═══════════════════════════════════════════════
   APP MOBILE — Treino · Métricas · Calendário · Jornada (módulo de app.js)
═══════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.P90App;
  if (!A) return;
  const { esc, rowHTML, section, openSheet, closeSheet, undoable, note, after, shortDate, fmt0 } = A;
  const val = (form, sel) => (form.querySelector(sel) || {}).value || '';
  const cancel = '<button class="btn" type="button" data-act="close">Cancelar</button>';
  const fmtKg = n => (Math.round(n * 10) / 10).toString().replace('.', ',');

  /* ══════════ TREINO ══════════ */
  const tr = { addKind: 'exercicio' };
  const treino = {
    title: 'Treino', group: 'Corpo', order: 0,
    meta() { return Store.trainingLoggedToday() ? 'registrado hoje' : 'treino ' + Store.getTrainingSession().split; },
    view() {
      const sess = Store.getTrainingSession(), split = sess.split, exs = Store.getTrainingExercises(split);
      const doneN = exs.filter(e => sess.entries[e.id] && sess.entries[e.id].done).length;
      let html = `<div class="chips" style="margin-top:6px">${['A', 'B', 'C'].map(s =>
        `<button class="chip ${s === split ? 'on' : ''}" type="button" data-act="tr-split" data-s="${s}">Treino ${s}</button>`).join('')}</div>`;
      if (!Store.getTrainingExercises().length) {
        html += `<div class="empty">Nenhum exercício cadastrado.</div><div class="acts"><button class="btn main" type="button" data-act="tr-seed">Montar treino padrão</button></div>`;
      } else if (!exs.length) {
        html += '<div class="empty">Este treino está vazio. Toque em + para adicionar exercícios.</div>';
      } else {
        html += exs.map(e => {
          const en = sess.entries[e.id] || {}, last = Store.lastTrainingWeight(e.id);
          const kg = en.kg != null ? fmtKg(en.kg) + ' kg' : (last != null ? 'último ' + fmtKg(last) + ' kg' : e.sets + '×' + e.reps);
          return rowHTML({ act: 'tr-tog', txAct: 'tr-edit', id: e.id, text: e.name, meta: kg, done: !!en.done });
        }).join('');
        if (doneN === exs.length) html += '<div class="hint" style="padding-top:12px">Treino completo hoje ✓</div>';
      }
      // alimentação
      const meals = Store.getMealItems(), mDone = new Set(Store.getMealDay());
      if (meals.length) {
        html += `<h2>Alimentação <b>${mDone.size} de ${meals.length}</b></h2>` + meals.map(m =>
          rowHTML({ act: 'tr-meal', id: m.id, text: m.label, done: mDone.has(m.id) })).join('');
        if (mDone.size < meals.length) html += '<div class="acts"><button class="btn" type="button" data-act="tr-meals-all">Marcar todas</button></div>';
      }
      // peso
      const w = Store.getBodyWeight(), last = Store.latestBodyWeight(), delta = Store.bodyWeightDelta();
      html += `<h2>Peso corporal <b>${last ? fmtKg(last.kg) + ' kg' + (delta ? ' · ' + (delta.kg > 0 ? '+' : '') + fmtKg(delta.kg) : '') : ''}</b></h2>
        <button class="navrow" type="button" data-act="tr-weight"><span class="nm">${w != null ? 'Hoje: ' + fmtKg(w) + ' kg' : 'Registrar peso de hoje'}</span><span class="mt">›</span></button>`;
      return { sub: `${doneN} de ${exs.length} exercícios · treino ${split}`, html };
    },
    fab() {
      tr.addKind = 'exercicio';
      const split = Store.getTrainingSession().split;
      openSheet(`<h3>Treino</h3><div class="chips" style="margin-top:0">
          <button class="chip on" type="button" data-act="tr-kind" data-k="exercicio">Exercício</button>
          <button class="chip" type="button" data-act="tr-kind" data-k="refeicao">Refeição</button></div>
        <form data-form="tr-add-ex"><label for="f-name">Exercício</label><input id="f-name" maxlength="60" placeholder="Ex.: Supino reto" autocomplete="off">
          <label for="f-split">Treino</label><select id="f-split">${['A', 'B', 'C'].map(s => `<option${s === split ? ' selected' : ''}>${s}</option>`).join('')}</select>
          <div style="display:flex;gap:10px"><div style="flex:1"><label for="f-sets">Séries</label><input id="f-sets" inputmode="numeric" value="3"></div><div style="flex:1"><label for="f-reps">Repetições</label><input id="f-reps" value="8-12"></div></div>
          <div class="acts">${cancel}<button class="btn main" type="submit">Adicionar</button></div></form>`);
    },
    actions: {
      'tr-split': (el) => { Store.setTrainingSplit(el.dataset.s); A.render(); },
      'tr-seed': () => { Store.seedDefaultTraining(); A.render(); },
      'tr-tog': (el) => after(() => Store.toggleTrainingExercise(Number(el.dataset.id)), el.closest('.row')),
      'tr-edit': (el) => {
        const e = Store.getTrainingExercises().find(x => x.id === Number(el.dataset.id)); if (!e) return;
        const en = (Store.getTrainingSession().entries[e.id]) || {}, last = Store.lastTrainingWeight(e.id);
        openSheet(`<h3>${esc(e.name)}</h3><div class="sub2">${e.sets}×${esc(e.reps)}${last != null ? ' · último ' + fmtKg(last) + ' kg' : ''}</div>
          <form data-form="tr-kg" data-id="${e.id}"><label for="f-kg">Carga de hoje (kg)</label>
          <input id="f-kg" inputmode="decimal" value="${en.kg != null ? fmtKg(en.kg) : ''}" placeholder="${last != null ? fmtKg(last) : '0'}" autocomplete="off">
          <div class="acts"><button class="btn bad" type="button" data-act="tr-del" data-id="${e.id}">Excluir</button><button class="btn main" type="submit">Salvar</button></div></form>`);
      },
      'tr-del': (el) => {
        const id = Number(el.dataset.id), e = Store.getTrainingExercises().find(x => x.id === id); if (!e) return;
        const snap = { split: e.split, name: e.name, sets: e.sets, reps: e.reps };
        Store.deleteTrainingExercise(id); closeSheet(); A.render();
        undoable('Exercício excluído', () => { Store.addTrainingExercise(snap.split, snap); A.render(); });
      },
      'tr-meal': (el) => { Store.toggleMeal(Number(el.dataset.id)); A.render(); },
      'tr-meals-all': () => { Store.markAllMeals(); A.render(); },
      'tr-weight': () => {
        const w = Store.getBodyWeight();
        openSheet(`<h3>Peso de hoje</h3><form data-form="tr-peso"><label for="f-kg">Peso (kg)</label>
          <input id="f-kg" inputmode="decimal" value="${w != null ? fmtKg(w) : ''}" placeholder="0,0" autocomplete="off">
          <div class="hint">Deixe vazio para remover o registro de hoje.</div>
          <div class="acts">${cancel}<button class="btn main" type="submit">Salvar</button></div></form>`);
      },
      'tr-kind': (el) => {
        tr.addKind = el.dataset.k;
        document.querySelectorAll('#sheet .chip').forEach(c => c.classList.toggle('on', c === el));
        const form = document.querySelector('#sheet form');
        const split = Store.getTrainingSession().split;
        form.outerHTML = tr.addKind === 'refeicao'
          ? `<form data-form="tr-add-meal"><label for="f-name">Refeição</label><input id="f-name" maxlength="60" placeholder="Ex.: Café da manhã" autocomplete="off">
              <div class="acts">${cancel}<button class="btn main" type="submit">Adicionar</button></div></form>`
          : `<form data-form="tr-add-ex"><label for="f-name">Exercício</label><input id="f-name" maxlength="60" placeholder="Ex.: Supino reto" autocomplete="off">
              <label for="f-split">Treino</label><select id="f-split">${['A', 'B', 'C'].map(s => `<option${s === split ? ' selected' : ''}>${s}</option>`).join('')}</select>
              <div style="display:flex;gap:10px"><div style="flex:1"><label for="f-sets">Séries</label><input id="f-sets" inputmode="numeric" value="3"></div><div style="flex:1"><label for="f-reps">Repetições</label><input id="f-reps" value="8-12"></div></div>
              <div class="acts">${cancel}<button class="btn main" type="submit">Adicionar</button></div></form>`;
      },
    },
    forms: {
      'tr-add-ex'(form) {
        const name = val(form, '#f-name').trim(); if (!name) { note('Informe o exercício'); return; }
        Store.addTrainingExercise(val(form, '#f-split') || 'A', { name, sets: val(form, '#f-sets'), reps: val(form, '#f-reps') });
        closeSheet(); A.render(); note('Exercício adicionado');
      },
      'tr-add-meal'(form) {
        const t = val(form, '#f-name').trim(); if (!t) return;
        Store.addMealItem(t); closeSheet(); A.render(); note('Refeição adicionada');
      },
      'tr-kg'(form, id) { Store.setTrainingWeight(id, val(form, '#f-kg')); closeSheet(); A.render(); },
      'tr-peso'(form) { Store.setBodyWeight(val(form, '#f-kg')); closeSheet(); A.render(); },
    },
  };

  /* ══════════ MÉTRICAS ══════════ */
  const metricas = {
    title: 'Métricas', group: 'Acompanhar', order: 0,
    meta() { return ''; },
    view() {
      const d = A.day(), days = Store.getTotalDays(), hs = Store.getHabits(), act = hs.filter(h => !h.paused);
      const pct = [];
      for (let i = 0; i < d; i++) pct.push(Store.dayCompletionPct(hs, i));
      const avg = pct.length ? Math.round(pct.reduce((a, b) => a + b, 0) / pct.length) : 0;
      const perfect = pct.filter((p, i) => Store.allHabitsDone(hs, i)).length;
      const streak = Store.currentStreak(hs, d), best = Math.max(0, ...hs.map(h => h.maxStreak || 0));
      const last14 = pct.slice(-14);
      let html = `<div class="hero"><div class="big">${avg}%<small>disciplina geral</small></div></div>
        <div class="stats">
          <div class="stat"><div class="k">Sequência</div><div class="v">${streak} d</div></div>
          <div class="stat"><div class="k">Melhor sequência</div><div class="v">${best} d</div></div>
          <div class="stat"><div class="k">Dias perfeitos</div><div class="v">${perfect}</div></div>
          <div class="stat"><div class="k">Dia</div><div class="v">${d} de ${days}</div></div>
        </div>`;
      html += `<h2>Últimos ${last14.length} dias</h2><div style="display:flex;align-items:flex-end;gap:5px;height:84px;margin-top:8px">${last14.map(p =>
        `<div style="flex:1;height:${Math.max(4, p)}%;background:${p >= 100 ? 'var(--tx)' : 'var(--dim)'};border-radius:3px" title="${p}%"></div>`).join('')}</div>`;
      let cells = '';
      for (let i = 0; i < days; i++) {
        const p = i < d ? pct[i] : null;
        const bg = p == null ? 'transparent' : p >= 100 ? 'var(--tx)' : p >= 60 ? 'rgba(242,242,238,.6)' : p > 0 ? 'rgba(242,242,238,.28)' : 'var(--line)';
        cells += `<span style="aspect-ratio:1;border-radius:3px;border:1px solid ${p == null ? 'var(--line)' : 'transparent'};background:${bg};${i === d - 1 ? 'outline:1.5px solid var(--warn)' : ''}"></span>`;
      }
      html += `<h2>Seus ${days} dias</h2><div style="display:grid;grid-template-columns:repeat(15,1fr);gap:4px;margin-top:8px">${cells}</div>`;
      const rates = act.map(h => {
        const base = (h.createdDay || 1) - 1; let sched = 0, done = 0;
        h.history.forEach((s, i) => { if (Store.scheduledOn(h, base + i)) { sched++; if (s === 'done') done++; } });
        return { name: h.name, p: sched ? Math.round(done / sched * 100) : 0 };
      }).sort((a, b) => b.p - a.p);
      if (rates.length) html += '<h2>Por hábito</h2>' + rates.map(r =>
        `<div class="kv" style="display:block"><div style="display:flex;justify-content:space-between"><span style="color:var(--tx)">${esc(r.name)}</span><span>${r.p}%</span></div><div class="prog"><i style="width:${r.p}%"></i></div></div>`).join('');
      return { sub: 'Dia ' + d + ' de ' + days, html };
    },
  };

  /* ══════════ CALENDÁRIO ══════════ */
  const cal = { ym: null, sel: null };
  function calItems(ym) {
    const map = {}, push = (iso, o) => { if (String(iso).slice(0, 7) === ym) (map[iso] = map[iso] || []).push(o); };
    Store.getTasks().filter(t => !t.archived).forEach(t => { const due = Store.taskNextDue(t); if (due) push(due, { k: 'Tarefa', t: t.title }); });
    Store.getStudyActivities().filter(a => !a.done && a.dueOn).forEach(a => push(a.dueOn, { k: 'Faculdade', t: a.title, s: Store.studySubjectName(a.subjectId) }));
    Store.getWorkTasks().filter(t => !t.done && t.dueOn).forEach(t => push(t.dueOn, { k: 'Trabalho', t: t.title, s: Store.workProjectName(t.projectId) }));
    (Store.getFinance().fixed || []).filter(f => f.active && f.dueDay).forEach(f => {
      const [y, m] = ym.split('-').map(Number), last = new Date(y, m, 0).getDate();
      push(ym + '-' + String(Math.min(f.dueDay, last)).padStart(2, '0'), { k: 'Conta', t: f.label, s: fmt0(f.amount) });
    });
    return map;
  }
  const calendario = {
    title: 'Calendário', group: 'Acompanhar', order: 1,
    meta() { return ''; },
    view() {
      const ym = cal.ym || Store.finYm(), today = A.todayISO();
      const [y, m] = ym.split('-').map(Number), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate();
      const items = calItems(ym), sel = cal.sel && cal.sel.slice(0, 7) === ym ? cal.sel : (today.slice(0, 7) === ym ? today : ym + '-01');
      let cells = '';
      for (let i = 0; i < first.getDay(); i++) cells += '<span></span>';
      for (let d = 1; d <= n; d++) {
        const iso = ym + '-' + String(d).padStart(2, '0'), has = (items[iso] || []).length;
        cells += `<button class="cell ${iso === sel ? 'on' : (iso === today ? 'half' : '')}" type="button" data-act="cal-pick" data-d="${iso}" style="height:50px;position:relative">${d}${has ? `<i style="position:absolute;bottom:6px;left:50%;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:${iso === sel ? 'var(--bg)' : 'var(--tx)'}"></i>` : ''}</button>`;
      }
      const list = items[sel] || [];
      return { sub: 'Prazos, contas e entregas', html: `<div class="mnav"><button type="button" data-act="cal-nav" data-d="-1" aria-label="Mês anterior">‹</button><span>${esc(Store.finYmLabel(ym))}</span><button type="button" data-act="cal-nav" data-d="1" aria-label="Próximo mês">›</button></div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:10px;text-align:center;color:var(--dim);font-size:12px">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(x => `<span>${x}</span>`).join('')}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:8px">${cells}</div>
        <h2>${esc(shortDate(sel))} <b>${list.length || 'nada'}</b></h2>` +
        (list.length ? list.map(x => `<div class="row plain"><span class="tx">${esc(x.t)}${x.s ? `<span class="sub2" style="display:block">${esc(x.s)}</span>` : ''}</span><span class="mt">${esc(x.k)}</span></div>`).join('') : '<div class="empty">Nada neste dia.</div>') };
    },
    actions: {
      'cal-nav': (el) => { cal.ym = Store.finYmAdd(cal.ym || Store.finYm(), Number(el.dataset.d)); cal.sel = null; A.render(); },
      'cal-pick': (el) => { cal.sel = el.dataset.d; A.render(); },
    },
  };

  /* ══════════ JORNADA ══════════ */
  const jornada = {
    title: 'Jornada', group: 'Acompanhar', order: 2,
    meta() { return ''; },
    view() {
      const by = {}, add = (d, o) => { (by[d] = by[d] || []).push(o); };
      const j = Store.getJournal(), r = Store.getStudyReflections(), ach = Store.getAchievements(), cats = window.P90_ACHIEVEMENTS || [];
      Object.keys(j).forEach(d => { const e = j[d]; const t = e.free || e.good || e.improve || e.gratitude; if (t || e.mood) add(Number(d), { k: 'Diário', t: (e.mood ? e.mood + ' ' : '') + (t || '') }); });
      Store.getWins().forEach(w => add(w.dayNum, { k: 'Vitória', t: w.text }));
      Object.keys(r).forEach(d => add(Number(d), { k: 'Reflexão', t: (window.P90_STUDY_TOPICS || [])[r[d].topicIdx] || 'Reflexão do dia' }));
      cats.forEach(c => c.achievements.forEach(a => { if (ach[a.id] && ach[a.id].unlockedDay) add(ach[a.id].unlockedDay, { k: 'Conquista', t: a.name }); }));
      const days = Object.keys(by).map(Number).filter(d => d <= A.day()).sort((a, b) => b - a).slice(0, 45);
      let html = days.length ? '' : '<div class="empty">Sua jornada aparece aqui conforme você registra diário, vitórias e reflexões.</div>';
      days.forEach(d => {
        html += `<h2>${d === A.day() ? 'Hoje' : 'Dia ' + d}</h2>` + by[d].map(x =>
          `<div class="entry"><div class="d">${esc(x.k)}</div><div class="p" style="-webkit-line-clamp:3">${esc(x.t)}</div></div>`).join('');
      });
      return { sub: days.length + (days.length === 1 ? ' dia com registros' : ' dias com registros'), html };
    },
  };

  A.register('treino', treino);
  A.register('metricas', metricas);
  A.register('calendario', calendario);
  A.register('jornada', jornada);
})();
