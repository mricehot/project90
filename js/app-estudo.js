/* ═══════════════════════════════════════════════
   APP MOBILE — Faculdade e Trabalho (módulo de app.js)
═══════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.P90App;
  if (!A) return;
  const { esc, rowHTML, section, openSheet, closeSheet, undoable, note, after, shortDate } = A;
  const iso = A.todayISO;
  const val = (form, sel) => (form.querySelector(sel) || {}).value || '';

  function dueMeta(daysFn, a) {
    if (a.done) return { text: 'entregue', warn: false };
    const n = daysFn(a);
    if (n == null) return { text: '', warn: false };
    if (n < 0) return { text: 'atrasada · ' + shortDate(a.dueOn), warn: true };
    if (n === 0) return { text: 'hoje', warn: false };
    if (n === 1) return { text: 'amanhã', warn: false };
    return { text: shortDate(a.dueOn), warn: false };
  }
  const dateField = (id, v) => `<label for="${id}">Prazo</label><input id="${id}" type="date" value="${esc(v || '')}">`;

  /* ══════════ FACULDADE ══════════ */
  const fac = {
    title: 'Faculdade', group: 'Estudo e trabalho', order: 0,
    meta() { const n = Store.getStudyActivities().filter(a => !a.done && Store.getStudySubjects().some(s => s.id === a.subjectId)).length; return n ? n + (n === 1 ? ' pendente' : ' pendentes') : ''; },
    view() {
      const subs = Store.getStudySubjects(), acts = Store.getStudyActivities();
      let html = '', pendTotal = 0;
      if (!subs.length) html = '<div class="empty">Nenhuma disciplina ainda. Toque em + para criar a primeira.</div>';
      subs.forEach(s => {
        const pend = acts.filter(a => a.subjectId === s.id && !a.done);
        pendTotal += pend.length;
        html += `<button class="h2" type="button" data-act="fac-subj" data-id="${s.id}"><span>${esc(s.name)}</span><b>${pend.length ? pend.length + ' pendente' + (pend.length === 1 ? '' : 's') : 'em dia'}</b></button>`;
        html += pend.length ? pend.map(a => {
          const m = dueMeta(Store.studyDaysUntil, a);
          return rowHTML({ act: 'fac-tog', txAct: 'fac-edit', id: a.id, text: a.title, meta: m.text, warn: m.warn });
        }).join('') : '<div class="hint" style="padding:6px 0 10px">Nada pendente.</div>';
      });
      const done = acts.filter(a => a.done && subs.some(s => s.id === a.subjectId));
      if (done.length) html += section('facdone', 'Entregues', String(done.length), !!A.open.facdone,
        done.slice(0, 30).map(a => rowHTML({ act: 'fac-untog', id: a.id, text: a.title, done: true })).join(''));
      return { sub: pendTotal + (pendTotal === 1 ? ' atividade pendente' : ' atividades pendentes'), html };
    },
    fab() {
      const subs = Store.getStudySubjects();
      openSheet(`<h3>Nova atividade</h3><form data-form="fac-add">
        <label for="f-subj">Disciplina</label>
        <select id="f-subj" onchange="document.getElementById('f-newwrap').hidden = this.value !== '__new'">
          ${subs.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}<option value="__new"${subs.length ? '' : ' selected'}>＋ Nova disciplina…</option></select>
        <div id="f-newwrap" ${subs.length ? 'hidden' : ''}><label for="f-newsubj">Nome da disciplina</label><input id="f-newsubj" maxlength="60" autocomplete="off"></div>
        <label for="f-title">Atividade</label><input id="f-title" maxlength="120" placeholder="Ex.: Lista 3 de cálculo" autocomplete="off">
        ${dateField('f-date', '')}
        <div class="acts"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn main" type="submit">Adicionar</button></div></form>`);
    },
    actions: {
      'fac-tog': (el) => after(() => Store.toggleStudyDone(Number(el.dataset.id)), el.closest('.row')),
      'fac-untog': (el) => after(() => Store.toggleStudyDone(Number(el.dataset.id))),
      'fac-edit': (el) => {
        const a = Store.getStudyActivities().find(x => x.id === Number(el.dataset.id)); if (!a) return;
        openSheet(`<h3>Atividade</h3><form data-form="fac-edit" data-id="${a.id}">
          <label for="f-title">Título</label><input id="f-title" maxlength="120" value="${esc(a.title)}" autocomplete="off">
          ${dateField('f-date', a.dueOn)}
          <label for="f-link">Link (opcional)</label><input id="f-link" type="url" value="${esc(a.link || '')}" placeholder="https://" autocomplete="off">
          <div class="acts"><button class="btn bad" type="button" data-act="fac-del" data-id="${a.id}">Excluir</button><button class="btn main" type="submit">Salvar</button></div></form>`);
      },
      'fac-del': (el) => {
        const id = Number(el.dataset.id), a = Store.getStudyActivities().find(x => x.id === id); if (!a) return;
        const snap = { title: a.title, dueOn: a.dueOn, link: a.link, notes: a.notes, subjectId: a.subjectId, done: a.done };
        Store.deleteStudyActivity(id); closeSheet(); A.render();
        undoable('Atividade excluída', () => { const n = Store.addStudyActivity(snap.subjectId, snap); if (n && snap.done) Store.toggleStudyDone(n.id); A.render(); });
      },
      'fac-subj': (el) => {
        const s = Store.getStudySubjects().find(x => x.id === Number(el.dataset.id)); if (!s) return;
        openSheet(`<h3>Disciplina</h3><form data-form="fac-subj" data-id="${s.id}">
          <label for="f-name">Nome</label><input id="f-name" maxlength="60" value="${esc(s.name)}" autocomplete="off">
          <div class="hint">Arquivar esconde a disciplina daqui; ela continua no app completo.</div>
          <div class="acts"><button class="btn" type="button" data-act="fac-arch" data-id="${s.id}">Arquivar</button><button class="btn main" type="submit">Salvar</button></div></form>`);
      },
      'fac-arch': (el) => { Store.setStudySubjectArchived(Number(el.dataset.id), true); closeSheet(); A.render(); note('Disciplina arquivada'); },
    },
    forms: {
      'fac-add'(form) {
        const title = val(form, '#f-title').trim(); if (!title) { note('Informe a atividade'); return; }
        let sid = val(form, '#f-subj');
        if (sid === '__new') {
          const nm = val(form, '#f-newsubj').trim(); if (!nm) { note('Informe a disciplina'); return; }
          const s = Store.addStudySubject(nm); sid = s && s.id;
        }
        Store.addStudyActivity(Number(sid), { title, dueOn: val(form, '#f-date') || null });
        closeSheet(); A.render(); note('Atividade criada');
      },
      'fac-edit'(form, id) {
        const title = val(form, '#f-title').trim(); if (!title) return;
        Store.updateStudyActivity(id, { title, dueOn: val(form, '#f-date') || null, link: val(form, '#f-link') || null });
        closeSheet(); A.render();
      },
      'fac-subj'(form, id) {
        const nm = val(form, '#f-name').trim(); if (!nm) return;
        Store.renameStudySubject(id, nm); closeSheet(); A.render();
      },
    },
  };

  /* ══════════ TRABALHO ══════════ */
  const wk = { mode: 'P', addKind: 'tarefa', leque: null };
  const KIND_LABEL = { avulsa: 'tarefas', realce: 'leques' };

  function holeText(taskId) {
    const p = Store.workHoleProgress(taskId);
    return p.total ? `P ${p.profiled}/${p.total} · T ${p.surveyed}/${p.total}` : 'sem furos';
  }
  function sheetLeque(taskId) {
    const t = Store.getWorkTasks().find(x => x.id === taskId); if (!t) return;
    wk.leque = taskId;
    const holes = Store.getWorkTaskHoles(taskId), p = Store.workHoleProgress(taskId);
    const f = wk.mode === 'P' ? 'profiled' : 'surveyed', o = wk.mode === 'P' ? 'surveyed' : 'profiled';
    const pct = p.total ? Math.round((wk.mode === 'P' ? p.profiled : p.surveyed) / p.total * 100) : 0;
    openSheet(`<h3>${esc(t.title)}</h3>
      <div class="sub2">${esc(Store.workProjectName(t.projectId))} · P ${p.profiled}/${p.total} · T ${p.surveyed}/${p.total}</div>
      <div class="chips">
        <button class="chip ${wk.mode === 'P' ? 'on' : ''}" type="button" data-act="wk-mode" data-m="P">Perfilar</button>
        <button class="chip ${wk.mode === 'T' ? 'on' : ''}" type="button" data-act="wk-mode" data-m="T">Topografar</button>
      </div>
      <div class="prog"><i style="width:${pct}%"></i></div>
      ${holes.length ? `<div class="cells">${holes.map(h => `<button class="cell ${h[f] ? 'on' : (h[o] ? 'half' : '')}" type="button" data-act="wk-hole" data-id="${h.id}" aria-pressed="${!!h[f]}">${h.number}</button>`).join('')}</div>
        <div class="acts"><button class="btn" type="button" data-act="wk-all" data-v="1">Marcar todos</button><button class="btn" type="button" data-act="wk-all" data-v="0">Limpar todos</button></div>`
        : '<div class="empty">Nenhum furo ainda. Informe o intervalo abaixo.</div>'}
      <form data-form="wk-holes" data-id="${t.id}"><label for="f-from">Adicionar furos (de – até)</label>
        <div style="display:flex;gap:10px"><input id="f-from" inputmode="numeric" placeholder="1" autocomplete="off"><input id="f-to" inputmode="numeric" placeholder="30" autocomplete="off"></div>
        <div class="acts"><button class="btn" type="button" data-act="wk-edit" data-id="${t.id}">Editar leque</button><button class="btn main" type="submit">Adicionar</button></div></form>`);
  }
  function sheetTask(id) {
    const t = Store.getWorkTasks().find(x => x.id === id); if (!t) return;
    openSheet(`<h3>Tarefa</h3><form data-form="wk-edit" data-id="${t.id}">
      <label for="f-title">Título</label><input id="f-title" maxlength="120" value="${esc(t.title)}" autocomplete="off">
      ${dateField('f-date', t.dueOn)}
      <label for="f-link">Link (opcional)</label><input id="f-link" type="url" value="${esc(t.link || '')}" placeholder="https://" autocomplete="off">
      <div class="acts"><button class="btn bad" type="button" data-act="wk-del" data-id="${t.id}">Excluir</button><button class="btn main" type="submit">Salvar</button></div></form>`);
  }
  function sheetWkAdd() {
    const projs = Store.getWorkProjects();
    if (!projs.length && wk.addKind !== 'projeto') wk.addKind = 'projeto';
    const chips = [['tarefa', 'Tarefa'], ['lembrete', 'Lembrete'], ['projeto', 'Projeto']].map(c =>
      `<button class="chip ${wk.addKind === c[0] ? 'on' : ''}" type="button" data-act="wk-kind" data-k="${c[0]}">${c[1]}</button>`).join('');
    let form = '';
    if (wk.addKind === 'tarefa') {
      form = `<form data-form="wk-add-tarefa"><label for="f-proj">Projeto</label>
        <select id="f-proj">${projs.map(p => `<option value="${p.id}">${esc(p.name)} · ${KIND_LABEL[p.kind] || 'tarefas'}</option>`).join('')}</select>
        <label for="f-title">O que fazer</label><input id="f-title" maxlength="120" placeholder="Ex.: Entregar relatório" autocomplete="off">
        ${dateField('f-date', '')}
        <div class="acts"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn main" type="submit">Adicionar</button></div></form>`;
    } else if (wk.addKind === 'lembrete') {
      const open = Store.getWorkTasks().filter(t => !t.done);
      form = `<form data-form="wk-add-lembrete"><label for="f-text">Lembrete</label><input id="f-text" maxlength="140" placeholder="Ex.: Pedir acesso ao servidor" autocomplete="off">
        <label for="f-task">Ligado a (opcional)</label><select id="f-task"><option value="">Nenhuma tarefa</option>${open.map(t => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}</select>
        <div class="acts"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn main" type="submit">Adicionar</button></div></form>`;
    } else {
      form = `<form data-form="wk-add-projeto"><label for="f-name">Nome</label><input id="f-name" maxlength="60" placeholder="Ex.: Realce 12" autocomplete="off">
        <label for="f-kind">Tipo</label><select id="f-kind"><option value="avulsa">Tarefas com prazo</option><option value="realce">Realce (leques e furos)</option></select>
        <div class="acts"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn main" type="submit">Criar</button></div></form>`;
    }
    openSheet(`<h3>Trabalho</h3><div class="chips" style="margin-top:0">${chips}</div>${form}`);
  }

  const trab = {
    title: 'Trabalho', group: 'Estudo e trabalho', order: 1,
    meta() {
      const live = new Set(Store.getWorkProjects().map(p => p.id));
      const n = Store.getWorkTasks().filter(t => !t.done && live.has(t.projectId)).length;
      return n ? n + (n === 1 ? ' pendente' : ' pendentes') : '';
    },
    view() {
      const projs = Store.getWorkProjects(), tasks = Store.getWorkTasks();
      const byId = new Map(tasks.map(t => [t.id, t]));
      const rems = Store.getWorkReminders().filter(r => { const t = r.taskId != null ? byId.get(r.taskId) : null; return !(t && t.done); });
      let html = '', pendTotal = 0;
      if (rems.length) {
        html += `<h2>Lembretes <b>${rems.length}</b></h2>` + rems.map(r => {
          const t = r.taskId != null ? byId.get(r.taskId) : null;
          return rowHTML({ act: 'wk-rem', id: r.id, text: r.text, meta: t ? t.title : '' });
        }).join('');
      }
      if (!projs.length) html += '<div class="empty">Nenhum projeto ainda. Toque em + para criar o primeiro.</div>';
      projs.forEach(p => {
        const pend = tasks.filter(t => t.projectId === p.id && !t.done);
        pendTotal += pend.length;
        html += `<h2><span>${esc(p.name)}</span><b>${esc(KIND_LABEL[p.kind] || 'tarefas')} · ${pend.length}</b></h2>`;
        html += pend.length ? pend.map(t => {
          if (p.kind === 'realce') return rowHTML({ act: 'wk-tog', txAct: 'wk-leque', id: t.id, text: t.title, meta: holeText(t.id) });
          const m = dueMeta(Store.workTaskDaysUntil, t);
          return rowHTML({ act: 'wk-tog', txAct: 'wk-edit', id: t.id, text: t.title, meta: m.text, warn: m.warn });
        }).join('') : '<div class="hint" style="padding:6px 0 10px">Nada pendente.</div>';
      });
      const live = new Set(projs.map(p => p.id));
      const done = tasks.filter(t => t.done && live.has(t.projectId));
      if (done.length) html += section('wkdone', 'Entregues', String(done.length), !!A.open.wkdone,
        done.slice(0, 30).map(t => rowHTML({ act: 'wk-untog', id: t.id, text: t.title, done: true })).join(''));
      return { sub: pendTotal + (pendTotal === 1 ? ' tarefa pendente' : ' tarefas pendentes'), html };
    },
    fab() { wk.addKind = 'tarefa'; sheetWkAdd(); },
    actions: {
      'wk-tog': (el) => after(() => Store.toggleWorkTaskDone(Number(el.dataset.id)), el.closest('.row')),
      'wk-untog': (el) => after(() => Store.toggleWorkTaskDone(Number(el.dataset.id))),
      'wk-edit': (el) => sheetTask(Number(el.dataset.id)),
      'wk-leque': (el) => sheetLeque(Number(el.dataset.id)),
      'wk-mode': (el) => { wk.mode = el.dataset.m; sheetLeque(wk.leque); },
      'wk-hole': (el) => {
        const id = Number(el.dataset.id);
        if (wk.mode === 'P') Store.toggleWorkHoleProfiled(id); else Store.toggleWorkHoleSurveyed(id);
        sheetLeque(wk.leque); A.render();
      },
      'wk-all': (el) => { Store.setWorkTaskHolesAll(wk.leque, wk.mode === 'P' ? 'profiled' : 'surveyed', el.dataset.v === '1'); sheetLeque(wk.leque); A.render(); },
      'wk-del': (el) => {
        const id = Number(el.dataset.id), t = Store.getWorkTasks().find(x => x.id === id); if (!t) return;
        const snap = { title: t.title, dueOn: t.dueOn, link: t.link, notes: t.notes, projectId: t.projectId, done: t.done };
        Store.deleteWorkTask(id); closeSheet(); A.render();
        undoable('Tarefa excluída', () => { const n = Store.addWorkTask(snap.projectId, snap); if (n && snap.done) Store.toggleWorkTaskDone(n.id); A.render(); });
      },
      'wk-rem': (el) => {
        const id = Number(el.dataset.id), removed = Store.deleteWorkReminder(id); A.render();
        if (removed) undoable('Lembrete resolvido', () => { Store.restoreWorkReminder(removed); A.render(); });
      },
      'wk-kind': (el) => { wk.addKind = el.dataset.k; sheetWkAdd(); },
    },
    forms: {
      'wk-add-tarefa'(form) {
        const title = val(form, '#f-title').trim(); if (!title) { note('Informe a tarefa'); return; }
        Store.addWorkTask(Number(val(form, '#f-proj')), { title, dueOn: val(form, '#f-date') || null });
        closeSheet(); A.render(); note('Tarefa criada');
      },
      'wk-add-lembrete'(form) {
        const text = val(form, '#f-text').trim(); if (!text) return;
        const t = val(form, '#f-task');
        Store.addWorkReminder(text, t ? Number(t) : null); closeSheet(); A.render(); note('Lembrete criado');
      },
      'wk-add-projeto'(form) {
        const name = val(form, '#f-name').trim(); if (!name) return;
        Store.addWorkProject(name, val(form, '#f-kind') || 'avulsa'); closeSheet(); A.render(); note('Projeto criado');
      },
      'wk-edit'(form, id) {
        const title = val(form, '#f-title').trim(); if (!title) return;
        Store.updateWorkTask(id, { title, dueOn: val(form, '#f-date') || null, link: val(form, '#f-link') || null });
        closeSheet(); A.render();
      },
      'wk-holes'(form, id) {
        const from = val(form, '#f-from').trim(), to = val(form, '#f-to').trim();
        if (!from) { note('Informe o furo inicial'); return; }
        const r = Store.addWorkTaskHoles(id, from, to || from);
        if (r.error) { note(r.error === 'toobig' ? 'No máximo 200 furos por vez' : 'Intervalo inválido'); return; }
        sheetLeque(id); A.render();
        note(r.added + ' furo' + (r.added === 1 ? '' : 's') + ' adicionado' + (r.added === 1 ? '' : 's') + (r.duplicated ? ' · ' + r.duplicated + ' já existiam' : ''));
      },
    },
  };

  A.register('faculdade', fac);
  A.register('trabalho', trab);
})();
