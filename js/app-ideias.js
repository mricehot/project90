/* ═══════════════════════════════════════════════
   APP MOBILE — Ideias (módulo de app.js)
   Banco de ideias ainda não implementadas: capture rápido, organize por
   etiqueta e status, e transforme em tarefa quando for hora de fazer.
═══════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.P90App;
  if (!A) return;
  const { esc, rowHTML, openSheet, closeSheet, undoable, note } = A;
  const val = (form, sel) => (form.querySelector(sel) || {}).value || '';
  const STATUS = [['ideia', 'Ideias'], ['andamento', 'Em andamento'], ['feita', 'Feitas'], ['descartada', 'Descartadas']];
  const st = { filter: 'ideia', tag: '' };
  const tagsOf = list => Array.from(new Set(list.map(i => i.tag).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  function sheetIdea(i) {
    const tags = tagsOf(Store.getIdeas());
    openSheet(`<h3>${i ? 'Ideia' : 'Nova ideia'}</h3><form data-form="${i ? 'ide-edit' : 'ide-add'}"${i ? ` data-id="${i.id}"` : ''}>
      <label for="f-title">Ideia</label><input id="f-title" maxlength="140" value="${esc(i ? i.title : '')}" placeholder="Ex.: Ler sobre investimentos em FII" autocomplete="off">
      <label for="f-note">Detalhes (opcional)</label><textarea id="f-note" style="min-height:90px">${esc(i ? i.note : '')}</textarea>
      <label for="f-tag">Etiqueta (opcional)</label><input id="f-tag" maxlength="30" list="ide-tags" value="${esc(i ? i.tag : '')}" placeholder="Ex.: Casa, Trabalho, Estudo" autocomplete="off">
      <datalist id="ide-tags">${tags.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      ${i ? `<label for="f-status">Situação</label><select id="f-status">${STATUS.map(s => `<option value="${s[0]}"${i.status === s[0] ? ' selected' : ''}>${s[1]}</option>`).join('')}</select>
      <div class="acts">${i.status === 'ideia' || i.status === 'andamento' ? `<button class="btn" type="button" data-act="ide-task" data-id="${i.id}">Virar tarefa</button>` : ''}</div>
      <div class="acts"><button class="btn bad" type="button" data-act="ide-del" data-id="${i.id}">Excluir</button><button class="btn main" type="submit">Salvar</button></div>`
      : `<div class="acts"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn main" type="submit">Guardar</button></div>`}</form>`);
  }

  const ideias = {
    title: 'Ideias', group: 'Organização', order: 0,
    meta() { const n = Store.getIdeas().filter(i => i.status === 'ideia' || i.status === 'andamento').length; return n ? n + (n === 1 ? ' ideia' : ' ideias') : ''; },
    view() {
      const all = Store.getIdeas(), counts = {};
      STATUS.forEach(s => { counts[s[0]] = all.filter(i => i.status === s[0]).length; });
      const inFilter = all.filter(i => i.status === st.filter);
      const tags = tagsOf(inFilter);
      if (st.tag && tags.indexOf(st.tag) === -1) st.tag = '';
      const list = inFilter.filter(i => !st.tag || i.tag === st.tag);

      let html = `<div class="chips" style="margin-top:6px">${STATUS.filter(s => s[0] !== 'descartada' || counts.descartada || st.filter === 'descartada').map(s =>
        `<button class="chip ${st.filter === s[0] ? 'on' : ''}" type="button" data-act="ide-filter" data-s="${s[0]}">${s[1]} ${counts[s[0]]}</button>`).join('')}</div>`;
      if (tags.length) html += `<div class="chips" style="margin-top:0"><button class="chip ${!st.tag ? 'on' : ''}" type="button" data-act="ide-tag" data-t="">Todas</button>${tags.slice(0, 14).map(t =>
        `<button class="chip ${st.tag === t ? 'on' : ''}" type="button" data-act="ide-tag" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>`;
      html += '<div style="margin-top:6px"></div>';
      html += list.length ? list.map(i => rowHTML({
        act: 'ide-done', txAct: 'ide-open', id: i.id, text: i.title, meta: i.tag, done: i.status === 'feita',
      })).join('') : `<div class="empty">${all.length ? 'Nada aqui.' : 'Anote aqui o que você ainda não implementou — uma ideia por vez. Toque em + para a primeira.'}</div>`;
      const open = counts.ideia + counts.andamento;
      return { sub: open + (open === 1 ? ' ideia em aberto' : ' ideias em aberto'), html };
    },
    fab() { sheetIdea(null); },
    actions: {
      'ide-filter': (el) => { st.filter = el.dataset.s; st.tag = ''; A.render(); },
      'ide-tag': (el) => { st.tag = el.dataset.t || ''; A.render(); },
      'ide-done': (el) => {
        const id = Number(el.dataset.id), i = Store.getIdeas().find(x => x.id === id); if (!i) return;
        A.after(() => Store.updateIdea(id, { status: i.status === 'feita' ? 'ideia' : 'feita' }), i.status === 'feita' ? null : el.closest('.row'));
      },
      'ide-open': (el) => { const i = Store.getIdeas().find(x => x.id === Number(el.dataset.id)); if (i) sheetIdea(i); },
      'ide-task': (el) => {
        const id = Number(el.dataset.id), i = Store.getIdeas().find(x => x.id === id); if (!i) return;
        Store.addTask({ title: i.title, notes: i.note, sched: 'once', anchor: null });
        Store.updateIdea(id, { status: 'andamento' });
        closeSheet(); A.render(); note('Virou tarefa · veja em Tarefas › Sem data');
      },
      'ide-del': (el) => {
        const snap = Store.deleteIdea(Number(el.dataset.id)); if (!snap) return;
        closeSheet(); A.render();
        undoable('Ideia excluída', () => { Store.restoreIdea(snap); A.render(); });
      },
    },
    forms: {
      'ide-add'(form) {
        const title = val(form, '#f-title').trim(); if (!title) { note('Escreva a ideia'); return; }
        Store.addIdea({ title, note: val(form, '#f-note'), tag: val(form, '#f-tag') });
        st.filter = 'ideia'; closeSheet(); A.render(); note('Ideia guardada');
      },
      'ide-edit'(form, id) {
        const title = val(form, '#f-title').trim(); if (!title) return;
        Store.updateIdea(id, { title, note: val(form, '#f-note'), tag: val(form, '#f-tag'), status: val(form, '#f-status') });
        closeSheet(); A.render();
      },
    },
  };

  A.register('ideias', ideias);
})();
