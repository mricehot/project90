/* ═══════════════════════════════════════════════
   APP MOBILE — Leitura e conhecimento (módulo de app.js)
   Biblioteca · Bíblia · Vocabulário · Reflexões · Dicção · Conversação
═══════════════════════════════════════════════ */
(function () {
  'use strict';
  const A = window.P90App;
  if (!A) return;
  const { esc, rowHTML, section, openSheet, closeSheet, undoable, note, after, shortDate } = A;
  const val = (form, sel) => (form.querySelector(sel) || {}).value || '';
  const loading = { sub: '', html: '<div class="empty">Carregando…</div>' };
  const cancel = '<button class="btn" type="button" data-act="close">Cancelar</button>';

  /* ══════════ BIBLIOTECA ══════════ */
  const STATUS = { lendo: 'Lendo', quero_ler: 'Quero ler', lido: 'Lidos' };
  function bookProgress(b) {
    if (b.progressMode === 'percent') return b.progressPct != null ? b.progressPct + '%' : '';
    if (b.totalPages) return Math.round((b.currentPage || 0) / b.totalPages * 100) + '%';
    return b.currentPage ? 'p. ' + b.currentPage : '';
  }
  const lib = {
    title: 'Biblioteca', group: 'Leitura e conhecimento', order: 0,
    meta() { const s = Store.libStats(); return s.reading.length ? s.reading.length + ' lendo' : ''; },
    view() {
      const books = Store.getLibBooks ? Store.getLibBooks() : Store.getLibrary().books;
      const y = new Date().getFullYear(), g = Store.libGoalProgress(y), today = Store.libReadToday();
      let html = `<div class="kv"><span>Leitura de hoje</span><button class="chip ${today ? 'on' : ''}" type="button" data-act="lib-today">${today ? 'Registrada ✓' : 'Registrar'}</button></div>`;
      if (g.target) html += `<div class="hint" style="padding-top:12px">Meta de ${y}: ${g.read} de ${g.target} livros</div><div class="prog"><i style="width:${g.pct}%"></i></div>`;
      ['lendo', 'quero_ler'].forEach(st => {
        const list = books.filter(b => b.status === st);
        if (!list.length) return;
        html += `<h2>${STATUS[st]} <b>${list.length}</b></h2>` + list.map(b =>
          rowHTML({ act: 'lib-open', id: b.id, text: b.title, meta: st === 'lendo' ? bookProgress(b) : (b.author || '') })).join('');
      });
      const lidos = books.filter(b => b.status === 'lido');
      if (lidos.length) html += section('libdone', 'Lidos', String(lidos.length), !!A.open.libdone,
        lidos.slice(0, 40).map(b => rowHTML({ act: 'lib-open', id: b.id, text: b.title, meta: b.rating ? '★'.repeat(b.rating) : '', done: true })).join(''));
      if (!books.length) html += '<div class="empty">Nenhum livro ainda. Toque em + para adicionar.</div>';
      return { sub: books.length + (books.length === 1 ? ' livro' : ' livros'), html };
    },
    fab() {
      openSheet(`<h3>Novo livro</h3><form data-form="lib-add">
        <label for="f-title">Título</label><input id="f-title" maxlength="120" autocomplete="off">
        <label for="f-author">Autor (opcional)</label><input id="f-author" maxlength="80" autocomplete="off">
        <label for="f-status">Situação</label><select id="f-status"><option value="quero_ler">Quero ler</option><option value="lendo">Lendo agora</option></select>
        <label for="f-pages">Total de páginas (opcional)</label><input id="f-pages" inputmode="numeric" autocomplete="off">
        <div class="acts">${cancel}<button class="btn main" type="submit">Adicionar</button></div></form>`);
    },
    actions: {
      'lib-today': () => { Store.logReadingDay(); A.render(); note('Leitura de hoje registrada'); },
      'lib-open': (el) => {
        const b = Store.getLibBooks().find(x => x.id === Number(el.dataset.id)); if (!b) return;
        const pct = b.progressMode === 'percent';
        openSheet(`<h3>${esc(b.title)}</h3><div class="sub2">${esc(b.author || '')} · ${STATUS[b.status]}</div>
          <form data-form="lib-edit" data-id="${b.id}">
            ${b.status === 'lendo' ? (pct
              ? `<label for="f-pct">Progresso (%)</label><input id="f-pct" inputmode="numeric" value="${b.progressPct || 0}">`
              : `<label for="f-page">Página atual${b.totalPages ? ' (de ' + b.totalPages + ')' : ''}</label><input id="f-page" inputmode="numeric" value="${b.currentPage || 0}">`) : ''}
            <label for="f-rate">Nota</label><select id="f-rate"><option value="">Sem nota</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${b.rating === n ? ' selected' : ''}>${'★'.repeat(n)}</option>`).join('')}</select>
            <div class="acts">${b.status !== 'lendo' ? `<button class="btn" type="button" data-act="lib-st" data-id="${b.id}" data-s="lendo">Começar a ler</button>` : ''}${b.status !== 'lido' ? `<button class="btn" type="button" data-act="lib-st" data-id="${b.id}" data-s="lido">Terminei</button>` : ''}</div>
            <div class="acts"><button class="btn bad" type="button" data-act="lib-del" data-id="${b.id}">Excluir</button><button class="btn main" type="submit">Salvar</button></div></form>`);
      },
      'lib-st': (el) => { Store.setLibStatus(Number(el.dataset.id), el.dataset.s); closeSheet(); A.render(); },
      'lib-del': (el) => {
        const id = Number(el.dataset.id), b = Store.getLibBooks().find(x => x.id === id); if (!b) return;
        const snap = Object.assign({}, b);
        Store.deleteLibBook(id); closeSheet(); A.render();
        undoable('Livro excluído', () => { Store.addLibBook(snap); A.render(); });
      },
    },
    forms: {
      'lib-add'(form) {
        const title = val(form, '#f-title').trim(); if (!title) { note('Informe o título'); return; }
        Store.addLibBook({ title, author: val(form, '#f-author').trim(), status: val(form, '#f-status'), totalPages: val(form, '#f-pages') || null });
        closeSheet(); A.render(); note('Livro adicionado');
      },
      'lib-edit'(form, id) {
        const patch = {}, pg = form.querySelector('#f-page'), pc = form.querySelector('#f-pct'), r = val(form, '#f-rate');
        if (pg) patch.currentPage = pg.value; if (pc) patch.progressPct = pc.value;
        patch.rating = r ? Number(r) : null;
        Store.updateLibBook(id, patch); closeSheet(); A.render();
      },
    },
  };

  /* ══════════ BÍBLIA ══════════ */
  const bib = {
    title: 'Bíblia', group: 'Leitura e conhecimento', order: 1,
    meta() { const plan = Store.getBiblePlan(); const n = Store.bibleNextDay(); const e = plan.find(x => x.d === n); return e ? 'dia ' + n + ' · ' + e.r : ''; },
    view() {
      if (!Store.getBiblePlan().length) { A.load('js/bible-plan.js'); return loading; }
      const plan = Store.getBiblePlan(), days = Store.getBibleDays(), next = Store.bibleNextDay();
      const nextE = plan.find(x => x.d === next);
      let html = nextE ? `<div class="hero"><div class="sub2">Dia ${next} do plano</div><div class="big" style="font-size:34px;margin-top:8px">${esc(nextE.r)}</div>
        <div class="acts"><button class="btn main" type="button" data-act="bib-read" data-d="${next}">Marcar como lida</button></div></div>`
        : '<div class="empty">Plano concluído. Parabéns!</div>';
      const from = Math.max(1, next - 3), list = plan.filter(x => x.d >= from && x.d <= next + 6);
      html += `<h2>Plano <b>${Store.bibleReadCount()} de ${plan.length}</b></h2>` + list.map(x =>
        rowHTML({ act: 'bib-tog', id: x.d, text: 'Dia ' + x.d + ' · ' + x.r, done: !!days[x.d] })).join('');
      const ps = Store.getBiblePassages().slice().sort((a, b) => b.id - a.id);
      html += `<h2>Passagens marcantes <b>${ps.length}</b></h2>` + (ps.length ? ps.slice(0, 20).map(p =>
        `<button class="entry" type="button" data-act="bib-pass" data-id="${p.id}"><div class="d">${esc([p.book, [p.chapter, p.verse].filter(Boolean).join(':')].filter(Boolean).join(' '))}</div>${p.text ? `<div class="p">${esc(p.text)}</div>` : ''}</button>`).join('')
        : '<div class="empty">Nenhuma passagem salva. Toque em + para guardar uma.</div>');
      const s = Store.bibleStreak();
      return { sub: s ? s + (s === 1 ? ' dia seguido' : ' dias seguidos') : 'plano de 1 ano', html };
    },
    fab() {
      openSheet(`<h3>Passagem marcante</h3><form data-form="bib-add">
        <label for="f-book">Livro</label><input id="f-book" maxlength="40" placeholder="Ex.: Salmos" autocomplete="off">
        <div style="display:flex;gap:10px"><div style="flex:1"><label for="f-ch">Capítulo</label><input id="f-ch" inputmode="numeric" autocomplete="off"></div><div style="flex:1"><label for="f-vs">Versículo</label><input id="f-vs" autocomplete="off"></div></div>
        <label for="f-text">Texto</label><textarea id="f-text" style="min-height:90px"></textarea>
        <label for="f-msg">O que isso te diz</label><textarea id="f-msg" style="min-height:70px"></textarea>
        <div class="acts">${cancel}<button class="btn main" type="submit">Salvar</button></div></form>`);
    },
    actions: {
      'bib-read': (el) => { Store.setBibleReading(Number(el.dataset.d), true); A.render(); },
      'bib-tog': (el) => { const d = Number(el.dataset.id); Store.setBibleReading(d, !Store.getBibleDays()[d]); A.render(); },
      'bib-pass': (el) => {
        const p = Store.getBiblePassages().find(x => x.id === Number(el.dataset.id)); if (!p) return;
        openSheet(`<h3>${esc([p.book, [p.chapter, p.verse].filter(Boolean).join(':')].filter(Boolean).join(' '))}</h3>
          ${p.text ? `<p style="line-height:1.6;margin-bottom:14px">${esc(p.text)}</p>` : ''}${p.message ? `<div class="sub2" style="line-height:1.6">${esc(p.message)}</div>` : ''}
          <div class="acts"><button class="btn bad" type="button" data-act="bib-del" data-id="${p.id}">Excluir</button><button class="btn" type="button" data-act="close">Fechar</button></div>`);
      },
      'bib-del': (el) => {
        const id = Number(el.dataset.id), p = Store.getBiblePassages().find(x => x.id === id); if (!p) return;
        const snap = Object.assign({}, p);
        Store.deleteBiblePassage(id); closeSheet(); A.render();
        undoable('Passagem excluída', () => { Store.addBiblePassage(snap); A.render(); });
      },
    },
    forms: {
      'bib-add'(form) {
        const r = Store.addBiblePassage({ book: val(form, '#f-book'), chapter: val(form, '#f-ch'), verse: val(form, '#f-vs'), text: val(form, '#f-text'), message: val(form, '#f-msg') });
        if (!r) { note('Informe o livro ou o texto'); return; }
        closeSheet(); A.render(); note('Passagem salva');
      },
    },
  };

  /* ══════════ VOCABULÁRIO ══════════ */
  const voc = { rev: null };
  const vocab = {
    title: 'Vocabulário', group: 'Leitura e conhecimento', order: 2,
    meta() { const d = Store.vocabDueToday().length; return d ? d + ' para revisar' : ''; },
    view() {
      const words = Store.getVocabWords();
      if (voc.rev) {
        const w = words.find(x => x.id === voc.rev.queue[voc.rev.i]);
        if (!w) { voc.rev = null; } else {
          const r = voc.rev;
          return { sub: `Revisão · ${r.i + 1} de ${r.queue.length}`, html: `<div class="hero" style="padding-top:40px;text-align:center"><div class="big" style="font-size:40px">${esc(w.word)}</div>
            ${r.show ? `<div style="margin-top:24px;font-size:20px;line-height:1.5">${esc(w.meaning)}</div>${w.example ? `<div class="sub2" style="margin-top:12px;font-style:italic">${esc(w.example)}</div>` : ''}
              <div class="acts" style="margin-top:40px"><button class="btn" type="button" data-act="voc-grade" data-g="again">Errei</button><button class="btn main" type="button" data-act="voc-grade" data-g="good">Acertei</button></div>`
              : `<div class="acts" style="margin-top:60px"><button class="btn main" type="button" data-act="voc-show">Mostrar significado</button></div>`}
            <div class="acts"><button class="btn" type="button" data-act="voc-stop" style="border:0;color:var(--mid)">Parar revisão</button></div></div>` };
        }
      }
      const st = Store.vocabSrsStats(), due = Store.vocabDueToday();
      let html = due.length ? `<div class="hero"><div class="big">${due.length}<small>para revisar hoje</small></div><div class="acts"><button class="btn main" type="button" data-act="voc-start">Começar revisão</button></div></div>`
        : `<div class="hero"><div class="empty" style="padding:6px 0">Revisão em dia.</div></div>`;
      html += `<h2>Palavras <b>${st.total} · ${st.mastered} dominadas</b></h2>` + (words.length
        ? words.slice(0, 80).map(w => rowHTML({ act: 'voc-open', id: w.id, text: w.word, meta: w.meaning.length > 28 ? w.meaning.slice(0, 26) + '…' : w.meaning })).join('')
        : '<div class="empty">Nenhuma palavra ainda. Toque em + para adicionar.</div>');
      return { sub: st.total + (st.total === 1 ? ' palavra' : ' palavras'), html };
    },
    fab() {
      openSheet(`<h3>Nova palavra</h3><form data-form="voc-add">
        <label for="f-word">Palavra</label><input id="f-word" maxlength="60" autocomplete="off" autocapitalize="none">
        <label for="f-mean">Significado</label><input id="f-mean" maxlength="200" autocomplete="off">
        <label for="f-ex">Exemplo (opcional)</label><input id="f-ex" maxlength="200" autocomplete="off">
        <div class="acts">${cancel}<button class="btn main" type="submit">Adicionar</button></div></form>`);
    },
    actions: {
      'voc-start': () => { const q = Store.vocabDueToday().map(w => w.id); if (q.length) { voc.rev = { queue: q.slice(0, 30), i: 0, show: false }; A.render(); } },
      'voc-show': () => { voc.rev.show = true; A.render(); },
      'voc-grade': (el) => {
        const id = voc.rev.queue[voc.rev.i];
        Store.reviewVocabWord(id, el.dataset.g);
        voc.rev.i++; voc.rev.show = false;
        if (voc.rev.i >= voc.rev.queue.length) { voc.rev = null; note('Revisão concluída'); }
        A.render();
      },
      'voc-stop': () => { voc.rev = null; A.render(); },
      'voc-open': (el) => {
        const w = Store.getVocabWords().find(x => x.id === Number(el.dataset.id)); if (!w) return;
        openSheet(`<h3>${esc(w.word)}</h3><form data-form="voc-edit" data-id="${w.id}">
          <label for="f-mean">Significado</label><input id="f-mean" value="${esc(w.meaning)}" autocomplete="off">
          <label for="f-ex">Exemplo</label><input id="f-ex" value="${esc(w.example || '')}" autocomplete="off">
          <div class="hint">Caixa ${w.srsBox || 1} de 5 · ${w.srsReviews || 0} revisões</div>
          <div class="acts"><button class="btn bad" type="button" data-act="voc-del" data-id="${w.id}">Excluir</button><button class="btn main" type="submit">Salvar</button></div></form>`);
      },
      'voc-del': (el) => {
        const id = Number(el.dataset.id), w = Store.getVocabWords().find(x => x.id === id); if (!w) return;
        const snap = { word: w.word, meaning: w.meaning, example: w.example };
        Store.deleteVocabWord(id); closeSheet(); A.render();
        undoable('Palavra excluída', () => { Store.addVocabWord(snap); A.render(); });
      },
    },
    forms: {
      'voc-add'(form) {
        const word = val(form, '#f-word').trim(), meaning = val(form, '#f-mean').trim();
        if (!word || !meaning) { note('Informe a palavra e o significado'); return; }
        Store.addVocabWord({ word, meaning, example: val(form, '#f-ex').trim() });
        closeSheet(); A.render(); note('Palavra adicionada');
      },
      'voc-edit'(form, id) {
        Store.updateVocabWord(id, { meaning: val(form, '#f-mean').trim(), example: val(form, '#f-ex').trim() });
        closeSheet(); A.render();
      },
    },
  };

  /* ══════════ REFLEXÕES ══════════ */
  const refl = { day: null };
  const REFL_Q = [['q1', 'O que esse tema significa para você'], ['q2', 'Como ele aparece na sua vida'], ['q3', 'Que dúvida ou contraponto ele levanta'], ['free', 'Reflexão livre']];
  const topics = () => window.P90_STUDY_TOPICS || [];
  const topicIdx = n => topics().length ? (Math.max(1, n) - 1) % topics().length : 0;
  const reflexoes = {
    title: 'Reflexões', group: 'Leitura e conhecimento', order: 3,
    meta() { return Store.getStudyReflection(A.day()) ? 'feita hoje' : ''; },
    view() {
      if (!topics().length) { A.load('js/study-topics.js'); return loading; }
      const today = A.day(), d = refl.day || today, e = Store.getStudyReflection(d) || {};
      const all = Store.getStudyReflections(), days = Object.keys(all).map(Number).filter(k => k !== d).sort((a, b) => b - a).slice(0, 30);
      let html = `<div class="hero"><div class="sub2">${d === today ? 'Tema de hoje' : 'Dia ' + d}</div><div style="font-size:22px;font-weight:500;margin-top:8px;line-height:1.35">${esc(topics()[topicIdx(d)] || '')}</div></div>
        <form data-form="refl-save" data-id="${d}">${REFL_Q.map(q => `<label for="f-${q[0]}">${q[1]}</label><textarea id="f-${q[0]}" style="min-height:96px">${esc(e[q[0]] || '')}</textarea>`).join('')}
        <div class="acts"><button class="btn main" type="submit">Salvar reflexão</button></div></form>`;
      if (Store.getStudyReflection(d)) html += `<div class="acts" style="margin-top:10px"><button class="btn bad" type="button" data-act="refl-del" data-id="${d}" style="flex:0 0 auto;padding:0 18px">Apagar este dia</button></div>`;
      if (d !== today) html = `<button class="h2" type="button" data-act="refl-pick" data-day="${today}"><span>← Voltar para hoje</span></button>` + html;
      if (days.length) html += `<h2>Anteriores <b>${days.length}</b></h2>` + days.map(k =>
        `<button class="entry" type="button" data-act="refl-pick" data-day="${k}"><div class="d">Dia ${k}</div><div class="p">${esc(topics()[all[k].topicIdx] || topics()[topicIdx(k)] || '')}</div></button>`).join('');
      return { sub: 'Dia ' + d + ' de ' + Store.getTotalDays(), html };
    },
    actions: {
      'refl-pick': (el) => { const n = Number(el.dataset.day); refl.day = n === A.day() ? null : n; A.render(true); window.scrollTo(0, 0); },
      'refl-del': (el) => {
        const d = Number(el.dataset.id), snap = Store.deleteStudyReflection(d);
        if (snap) { A.render(true); undoable('Reflexão apagada', () => { Store.saveStudyReflection(d, snap); A.render(true); }); }
      },
    },
    forms: {
      'refl-save'(form, id) {
        const data = { topicIdx: topicIdx(id) };
        REFL_Q.forEach(q => { data[q[0]] = val(form, '#f-' + q[0]).trim(); });
        if (!data.q1 && !data.q2 && !data.q3 && !data.free) { note('Escreva algo antes de salvar'); return; }
        Store.saveStudyReflection(id, data); A.render(true); note('Reflexão salva');
      },
    },
  };

  /* ══════════ DICÇÃO ══════════ */
  const dic = {
    title: 'Dicção', group: 'Leitura e conhecimento', order: 4,
    meta() { const d = Store.getSpeechDay(A.day()); return d && d.done ? 'treino feito' : ''; },
    view() {
      const day = A.day(), plan = Store.speechPlanForDay(day), sd = Store.getSpeechDay(day) || { reps: 0, done: false };
      const texts = Store.getReadingTexts();
      let html = '';
      if (!plan.length) html += '<div class="empty">Sem exercícios na biblioteca. Gere a biblioteca de exercícios no app completo (Dicção).</div>';
      else {
        html += `<div class="kv"><span>Treino de hoje</span><button class="chip ${sd.done ? 'on' : ''}" type="button" data-act="dic-done">${sd.done ? 'Concluído ✓' : 'Concluir'}</button></div>`;
        html += plan.map((e, i) => `<div class="entry"><div class="d">${i + 1}${e.focus ? ' · ' + esc(e.focus) : ''}</div><div class="p" style="-webkit-line-clamp:unset;line-height:1.55">${esc(e.body || e.title)}</div></div>`).join('');
        html += `<div class="kv"><span>Repetições</span><span><button class="pill" type="button" data-act="dic-reps" data-d="-1">−</button> <b style="font-weight:500;margin:0 8px;color:var(--tx)">${sd.reps || 0}</b> <button class="pill" type="button" data-act="dic-reps" data-d="1">+</button></span></div>`;
      }
      const readN = Store.readingTextsReadCount ? Store.readingTextsReadCount() : 0;
      if (texts.length) html += `<h2>Leitura em voz alta <b>${readN} lidos</b></h2>` + texts.slice(0, 40).map(t =>
        rowHTML({ act: 'dic-read', txAct: 'dic-text', id: t.id, text: t.title, meta: t.lastReadDay === day ? 'lido hoje' : (t.category || ''), done: t.lastReadDay === day })).join('');
      return { sub: 'Dia ' + day, html };
    },
    actions: {
      'dic-done': () => { const d = A.day(), sd = Store.getSpeechDay(d) || { done: false }; Store.saveSpeechDay(d, { done: !sd.done }); A.render(); },
      'dic-reps': (el) => { const d = A.day(), sd = Store.getSpeechDay(d) || { reps: 0 }; Store.saveSpeechDay(d, { reps: Math.max(0, (sd.reps || 0) + Number(el.dataset.d)) }); A.render(); },
      'dic-read': (el) => { Store.markReadingText(Number(el.dataset.id)); A.render(); },
      'dic-text': (el) => {
        const t = Store.getReadingTexts().find(x => x.id === Number(el.dataset.id)); if (!t) return;
        openSheet(`<h3>${esc(t.title)}</h3><div style="line-height:1.7;font-size:17px;white-space:pre-wrap">${esc(t.body)}</div>
          <div class="acts"><button class="btn" type="button" data-act="close">Fechar</button><button class="btn main" type="button" data-act="dic-read-close" data-id="${t.id}">Li hoje</button></div>`);
      },
      'dic-read-close': (el) => { Store.markReadingText(Number(el.dataset.id)); closeSheet(); A.render(); },
    },
  };

  /* ══════════ CONVERSAÇÃO ══════════ */
  const tipsList = () => window.P90_CONVERSATION_TIPS || [];
  const conv = {
    title: 'Conversação', group: 'Leitura e conhecimento', order: 5,
    meta() { const n = Object.keys(Store.getConversationTipsRead()).length; return n ? n + ' lidas' : ''; },
    view() {
      const tips = tipsList();
      if (!tips.length) { A.load('js/conversation-tips.js'); return loading; }
      const read = Store.getConversationTipsRead();
      const cats = []; tips.forEach(t => { if (cats.indexOf(t.category) === -1) cats.push(t.category); });
      let html = '';
      cats.forEach(c => {
        const idxs = tips.map((t, i) => i).filter(i => tips[i].category === c), n = idxs.filter(i => read[i] != null).length;
        html += `<h2>${esc(c)} <b>${n} de ${idxs.length}</b></h2>` + idxs.map(i =>
          rowHTML({ act: 'cv-tog', txAct: 'cv-open', id: i, text: tips[i].title, done: read[i] != null })).join('');
      });
      const total = Object.keys(read).length;
      return { sub: total + ' de ' + tips.length + ' lidas', html };
    },
    actions: {
      'cv-tog': (el) => { Store.toggleConversationTipRead(Number(el.dataset.id), A.day()); A.render(); },
      'cv-open': (el) => {
        const i = Number(el.dataset.id), t = tipsList()[i]; if (!t) return;
        const isRead = Store.getConversationTipsRead()[i] != null;
        openSheet(`<div class="sub2">${esc(t.category)}</div><h3 style="margin-top:6px">${esc(t.title)}</h3><p style="line-height:1.65;font-size:17px">${esc(t.body)}</p>
          <div class="acts"><button class="btn" type="button" data-act="close">Fechar</button><button class="btn main" type="button" data-act="cv-read" data-id="${i}">${isRead ? 'Marcar como não lida' : 'Marcar como lida'}</button></div>`);
      },
      'cv-read': (el) => { Store.toggleConversationTipRead(Number(el.dataset.id), A.day()); closeSheet(); A.render(); },
    },
  };

  A.register('biblioteca', lib);
  A.register('biblia', bib);
  A.register('vocabulario', vocab);
  A.register('reflexoes', reflexoes);
  A.register('diccao', dic);
  A.register('conversacao', conv);
})();
