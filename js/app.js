/* ═══════════════════════════════════════════════
   PROJECT 90 — APP MOBILE (app.html)
   Interface nova e enxuta em cima do MESMO Store/Supabase do app atual:
   Hoje · Hábitos · Tarefas · Diário · Dinheiro. Não guarda dados próprios.
═══════════════════════════════════════════════ */
(function () {
  'use strict';

  const TABS = ['hoje', 'habitos', 'tarefas', 'diario', 'mais'];
  const MODS = {};   // módulos registrados (js/app-*.js): sub-telas de "Mais"
  const TITLES = { hoje: 'Hoje', habitos: 'Hábitos', tarefas: 'Tarefas', diario: 'Diário', mais: 'Mais' };
  const MOODS = ['🔥', '💪', '😐', '😓', '💀'];
  const MOOD_LABEL = { '🔥': 'Em chamas', '💪': 'Forte', '😐': 'Neutro', '😓': 'Difícil', '💀': 'Horrível' };
  const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const st = { tab: 'hoje', open: {}, ym: null, diaryDay: null, mood: null, saveTimer: null };

  /* ── utilidades ── */
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = n => String(n).padStart(2, '0');
  const isoOf = d => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const todayISO = () => isoOf(new Date());
  const day = () => Store.getCurrentDay();
  const fmt0 = n => 'R$ ' + Math.round(n || 0).toLocaleString('pt-BR');
  const fmt2 = n => 'R$ ' + (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const shortDate = iso => { const p = String(iso).slice(0, 10).split('-'); return p.length === 3 ? Number(p[2]) + ' ' + MON[Number(p[1]) - 1] : ''; };
  const lastOf = h => h.history[h.history.length - 1];
  function parseMoney(v) {
    let s = String(v || '').replace(/[^\d,.-]/g, '');
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }
  function note(msg) {
    const el = $('#toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 1800);
  }
  const undoable = (msg, fn) => window.p90toastUndo(msg, fn);

  /* ── hábitos: mesma regra de sequência de habitos.html ── */
  function recalcStreak(h) {
    const base = (h.createdDay || 1) - 1;
    let cur = 0, best = 0;
    for (let i = 0; i < h.history.length; i++) {
      if (!Store.scheduledOn(h, base + i)) continue;
      if (h.history[i] === 'done') { cur++; if (cur > best) best = cur; } else cur = 0;
    }
    h.streak = cur;
    h.maxStreak = Math.max(h.maxStreak || 0, best);
  }
  function toggleHabit(id) {
    const hs = Store.getHabits(), h = hs.find(x => x.id === id);
    if (!h || !h.history.length) return;
    h.history[h.history.length - 1] = lastOf(h) === 'done' ? 'miss' : 'done';
    recalcStreak(h);
    Store.saveHabits(hs);
  }

  /* ── data digitada → ISO ("amanhã", "dia 10", "20/11", "sexta") ── */
  const WD = { domingo: 0, segunda: 1, terca: 2, 'terça': 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6, 'sábado': 6 };
  function parseTask(raw) {
    let s = ' ' + raw.trim() + ' ', iso = null, m;
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const plus = n => { const d = new Date(t0); d.setDate(d.getDate() + n); return d; };
    if ((m = s.match(/\s(amanh[ãa])\s/i))) { iso = isoOf(plus(1)); s = s.replace(m[1], ' '); }
    else if ((m = s.match(/\s(hoje)\s/i))) { iso = isoOf(plus(0)); s = s.replace(m[1], ' '); }
    else if ((m = s.match(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s/))) {
      let y = m[3] ? Number(m[3]) : t0.getFullYear(); if (y < 100) y += 2000;
      let d = new Date(y, Number(m[2]) - 1, Number(m[1]));
      if (!m[3] && d < t0) d = new Date(y + 1, Number(m[2]) - 1, Number(m[1]));
      if (!isNaN(d)) { iso = isoOf(d); s = s.replace(m[0], ' '); }
    } else if ((m = s.match(/\sdia\s+(\d{1,2})\s/i)) && Number(m[1]) >= 1 && Number(m[1]) <= 31) {
      let d = new Date(t0.getFullYear(), t0.getMonth(), Number(m[1]));
      if (d < t0) d = new Date(t0.getFullYear(), t0.getMonth() + 1, Number(m[1]));
      iso = isoOf(d); s = s.replace(m[0], ' ');
    } else if ((m = s.match(/\s(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(?:-feira)?\s/i))) {
      let diff = (WD[m[1].toLowerCase()] - t0.getDay() + 7) % 7; if (diff === 0) diff = 7;
      iso = isoOf(plus(diff)); s = s.replace(m[0], ' ');
    }
    s = s.replace(/\s+(para|pra|em|no|na|at[ée]|de|do|da)\s*$/i, '').replace(/\s{2,}/g, ' ').trim();
    if (!s) s = raw.trim();
    return { title: s.charAt(0).toUpperCase() + s.slice(1), iso: iso || isoOf(t0) };
  }

  /* ── peças de interface ── */
  function rowHTML(o) {
    const ck = `<button class="ck" type="button" data-act="${o.act}" data-id="${o.id}" aria-label="${o.done ? 'Desmarcar' : 'Concluir'}">${o.done ? '✓' : ''}</button>`;
    const tx = `<button class="tx" type="button" data-act="${o.txAct || o.act}" data-id="${o.id}">${esc(o.text)}</button>`;
    const mt = o.meta ? `<span class="mt ${o.warn ? 'warn' : ''}">${esc(o.meta)}</span>` : '';
    return `<div class="row ${o.done ? 'done' : ''}">${ck}${tx}${mt}</div>`;
  }
  const section = (key, label, count, open, inner) =>
    `<button class="h2" type="button" data-act="sec" data-k="${key}"><span>${esc(label)}</span><b>${esc(count)} ${open ? '▾' : '▸'}</b></button>${open ? inner : ''}`;

  /* ══════════ HOJE ══════════ */
  function dueFixedToday() {
    const ym = Store.finYm(), d = new Date().getDate();
    return (Store.getFinance().fixed || [])
      .filter(f => f.active && f.dueDay <= d && !Store.finFixedPaidMark(f.id, ym))
      .sort((a, b) => a.dueDay - b.dueDay);
  }
  function viewHoje() {
    const d = day(), days = Store.getTotalDays(), hs = Store.getHabits(), iso = todayISO();
    const items = [], feitos = [];

    Store.tasksForToday().forEach(t => {
      const s = Store.taskStatus(t);
      if (s === 'backlog' || s === 'done' || s === 'done-today') return;
      items.push({ act: 'tog-tarefa', id: t.id, text: t.title, meta: s === 'overdue' ? 'atrasada' : 'hoje', warn: s === 'overdue', w: s === 'overdue' ? 0 : 1 });
    });
    dueFixedToday().forEach(f => items.push({ act: 'tog-conta', id: f.id, text: f.label, meta: f.dueDay < new Date().getDate() ? 'venceu dia ' + f.dueDay : 'vence hoje', warn: true, w: 0 }));
    hs.filter(h => !h.paused && (h.createdDay || 1) <= d && Store.scheduledOn(h, d - 1)).forEach(h => {
      if (lastOf(h) === 'done') feitos.push({ act: 'tog-habito', id: h.id, text: h.name, done: true });
      else items.push({ act: 'tog-habito', id: h.id, text: h.name, w: 2 });
    });
    Store.getTasks().filter(t => !t.archived && (Store.getTaskDone(t.id) || []).indexOf(iso) !== -1)
      .forEach(t => feitos.push({ act: 'undo-tarefa', id: t.id, text: t.title, done: true }));
    items.sort((a, b) => a.w - b.w);

    const casa = Store.getHomeHabits(), casaOk = new Set(Store.getHomeRoutine());
    const noite = Store.getNightHabits(), noiteOk = new Set(Store.getNightRoutine());
    const casaPend = casa.filter(h => !casaOk.has(h.id)).length, noitePend = noite.filter(h => !noiteOk.has(h.id)).length;
    const restantes = items.length + casaPend + noitePend;

    const hr = new Date().getHours();
    const openCasa = st.open.casa != null ? st.open.casa : (hr >= 17 && hr < 21);
    const openNoite = st.open.noite != null ? st.open.noite : (hr >= 21 || hr < 5);
    const ml = Store.getWaterMl(), goal = Store.waterGoalMl();
    const fmtL = v => v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' L' : v + ' ml';
    const streak = Store.currentStreak(hs, d);

    let html = `<div class="hero"><div class="big">${restantes}<small>${restantes === 1 ? 'restante' : 'restantes'} hoje</small></div>
      <div class="bar"><i style="width:${Math.round(d / days * 100)}%"></i></div></div>`;
    html += items.length
      ? items.map(rowHTML).join('')
      : `<div class="empty">${restantes ? 'Nada pendente agora.' : 'Tudo feito por hoje.'}</div>`;
    if (casa.length) html += section('casa', 'Ao chegar em casa', (casa.length - casaPend) + ' de ' + casa.length, openCasa,
      casa.map(h => rowHTML({ act: 'tog-casa', id: h.id, text: h.label, done: casaOk.has(h.id) })).join(''));
    if (noite.length) html += section('noite', 'Noite', (noite.length - noitePend) + ' de ' + noite.length, openNoite,
      noite.map(h => rowHTML({ act: 'tog-noite', id: h.id, text: h.label, done: noiteOk.has(h.id) })).join(''));
    html += `<div class="water"><span class="w-v">Água · ${fmtL(ml)} de ${fmtL(goal)}</span>
      <span class="w-b"><button class="pill" type="button" data-act="water" data-d="-250" aria-label="Menos 250 ml">−</button><button class="pill" type="button" data-act="water" data-d="250" aria-label="Mais 250 ml">+250</button></span></div>`;
    if (feitos.length) html += section('feitos', 'Feitos hoje', String(feitos.length), !!st.open.feitos, feitos.map(rowHTML).join(''));

    return { sub: `Dia ${d} de ${days}${streak ? ' · ' + streak + (streak === 1 ? ' dia seguido' : ' dias seguidos') : ''}`, html };
  }

  /* ══════════ HÁBITOS ══════════ */
  function habitRow(h) {
    const done = lastOf(h) === 'done', base = (h.createdDay || 1) - 1, n = h.history.length;
    let dots = '';
    for (let i = Math.max(0, n - 7); i < n; i++) {
      const cls = !Store.scheduledOn(h, base + i) ? 'na' : (h.history[i] === 'done' ? 'on' : '');
      dots += `<i class="${cls}"></i>`;
    }
    return `<div class="row ${done ? 'done' : ''}">
      <button class="ck" type="button" data-act="tog-habito" data-id="${h.id}" aria-label="${done ? 'Desmarcar' : 'Concluir'}">${done ? '✓' : ''}</button>
      <div class="name"><button class="tx" type="button" data-act="hab-edit" data-id="${h.id}">${esc(h.name)}</button><div class="dots" aria-hidden="true">${dots}</div></div>
      ${h.streak > 0 ? `<span class="mt">${h.streak} d</span>` : ''}</div>`;
  }
  function viewHabitos() {
    const hs = Store.getHabits(), d = day();
    const act = hs.filter(h => !h.paused), paused = hs.filter(h => h.paused);
    const doneN = act.filter(h => lastOf(h) === 'done').length;
    let html = act.length ? act.map(habitRow).join('') : '<div class="empty">Nenhum hábito ainda. Toque em + para criar o primeiro.</div>';
    if (paused.length) html += section('pausados', 'Pausados', String(paused.length), !!st.open.pausados, paused.map(h =>
      `<div class="row"><span class="tx" style="color:var(--dim)">${esc(h.name)}</span><button class="mt" type="button" data-act="hab-edit" data-id="${h.id}">editar</button></div>`).join(''));
    return { sub: `${doneN} de ${act.length} hoje · dia ${d}`, html };
  }

  /* ══════════ TAREFAS ══════════ */
  function viewTarefas() {
    const iso = todayISO(), g = { overdue: [], due: [], up: [], back: [], done: [] };
    Store.getTasks().filter(t => !t.archived).forEach(t => {
      const s = Store.taskStatus(t), doneToday = (Store.getTaskDone(t.id) || []).indexOf(iso) !== -1;
      if (doneToday) { g.done.push(t); return; }
      if (s === 'overdue') g.overdue.push(t);
      else if (s === 'due') g.due.push(t);
      else if (s === 'upcoming') g.up.push(t);
      else if (s === 'backlog') g.back.push(t);
    });
    g.up.sort((a, b) => String(Store.taskNextDue(a)).localeCompare(String(Store.taskNextDue(b))));
    const row = (t, meta, warn) => rowHTML({ act: 'tog-tarefa', txAct: 'task-edit', id: t.id, text: t.title, meta, warn });
    const rec = t => t.sched === 'once' ? '' : ' ↻';
    let html = '', total = g.overdue.length + g.due.length + g.up.length + g.back.length;
    if (g.overdue.length) html += `<h2>Atrasadas <b>${g.overdue.length}</b></h2>` + g.overdue.map(t => row(t, shortDate(Store.taskNextDue(t)) + rec(t), true)).join('');
    if (g.due.length) html += `<h2>Hoje <b>${g.due.length}</b></h2>` + g.due.map(t => row(t, rec(t).trim(), false)).join('');
    if (g.up.length) html += `<h2>Próximas <b>${g.up.length}</b></h2>` + g.up.map(t => row(t, shortDate(Store.taskNextDue(t)) + rec(t), false)).join('');
    if (g.back.length) html += `<h2>Sem data <b>${g.back.length}</b></h2>` + g.back.map(t => row(t, '', false)).join('');
    if (!total) html += '<div class="empty">Nenhuma tarefa pendente. Toque em + para adicionar.</div>';
    if (g.done.length) html += section('tdone', 'Concluídas hoje', String(g.done.length), !!st.open.tdone,
      g.done.map(t => rowHTML({ act: 'undo-tarefa', id: t.id, text: t.title, done: true })).join(''));
    return { sub: total + (total === 1 ? ' pendente' : ' pendentes'), html };
  }

  /* ══════════ DIÁRIO ══════════ */
  function dayLabel(n) {
    const start = Store.getStartDate(), dt = new Date(start); dt.setDate(dt.getDate() + n - 1);
    return DOW[dt.getDay()] + ', ' + dt.getDate() + ' ' + MON[dt.getMonth()];
  }
  function viewDiario() {
    const today = day(), n = st.diaryDay || today;
    const j = Store.getJournal(), e = j[n] || {};
    st.mood = e.mood || null;
    const legacy = [['O que fiz bem', e.good], ['O que melhorar', e.improve], ['Gratidão', e.gratitude], ['Pergunta do dia', e.promptReply]].filter(x => x[1]);
    const days = Object.keys(j).map(Number).filter(k => k !== n && (j[k] && (j[k].free || j[k].good || j[k].improve || j[k].gratitude || j[k].mood))).sort((a, b) => b - a).slice(0, 40);
    let html = `<div class="moods" role="group" aria-label="Como você está">${MOODS.map(m =>
      `<button class="mood ${e.mood === m ? 'on' : ''}" type="button" data-act="mood" data-m="${m}" aria-label="${MOOD_LABEL[m]}" aria-pressed="${e.mood === m}">${m}</button>`).join('')}</div>
      <textarea id="diary-text" placeholder="Como foi o dia?" aria-label="Diário">${esc(e.free || '')}</textarea>
      <div class="saved" id="diary-saved">${e.free || e.mood ? 'Salvo' : ''}</div>`;
    if (legacy.length) html += `<h2>Também registrado</h2>` + legacy.map(x => `<div class="entry"><div class="d">${esc(x[0])}</div><div class="p" style="-webkit-line-clamp:unset">${esc(x[1])}</div></div>`).join('');
    if (j[n]) html += `<div class="acts" style="margin-top:14px"><button class="btn bad" type="button" data-act="diary-del" style="flex:0 0 auto;padding:0 18px">Apagar este dia</button></div>`;
    if (days.length) html += `<h2>Anteriores <b>${days.length}</b></h2>` + days.map(k => {
      const x = j[k], p = x.free || x.good || x.improve || x.gratitude || '';
      return `<button class="entry" type="button" data-act="diary-pick" data-day="${k}"><div class="d">${(x.mood || '') + ' ' + esc(dayLabel(k))} · dia ${k}</div>${p ? `<div class="p">${esc(p)}</div>` : ''}</button>`;
    }).join('');
    if (n !== today) html = `<button class="h2" type="button" data-act="diary-pick" data-day="${today}"><span>← Voltar para hoje</span></button>` + html;
    return { sub: dayLabel(n) + (n === today ? '' : ' · dia ' + n), html };
  }
  function saveDiary() {
    const n = st.diaryDay || day(), ta = $('#diary-text');
    if (!ta) return;
    const prev = Store.getJournalEntry(n) || {}, free = ta.value.trim();
    if (!free && !st.mood && !Object.keys(prev).length) return;
    Store.saveJournalEntry(n, Object.assign({}, prev, { mood: st.mood, free }));
    const s = $('#diary-saved'); if (s) s.textContent = 'Salvo';
  }

  /* ══════════ MAIS ══════════ */
  const GROUP_ORDER = ['Organização', 'Finanças', 'Estudo e trabalho', 'Leitura e conhecimento', 'Corpo', 'Jogo', 'Acompanhar'];
  function viewMais() {
    const mods = Object.keys(MODS).map(k => Object.assign({ key: k }, MODS[k])).filter(m => m.group);
    let html = '';
    GROUP_ORDER.concat(Array.from(new Set(mods.map(m => m.group))).filter(g => GROUP_ORDER.indexOf(g) === -1)).forEach(g => {
      const list = mods.filter(m => m.group === g).sort((a, b) => (a.order || 0) - (b.order || 0));
      if (!list.length) return;
      html += `<h2>${esc(g)}</h2>` + list.map(m => {
        let meta = ''; try { meta = m.meta ? m.meta() : ''; } catch (e) {}
        return `<button class="navrow" type="button" data-act="goto" data-k="${m.key}"><span class="nm">${esc(m.title)}</span><span class="mt">${esc(meta)} ›</span></button>`;
      }).join('');
    });
    html += `<h2>Conta</h2><a class="navrow" href="hoje.html" data-act="full"><span class="nm">Abrir o app completo</span><span class="mt">›</span></a>
      <button class="navrow" type="button" data-act="logout"><span class="nm">Sair</span><span class="mt"></span></button>`;
    return { sub: 'Todas as áreas', html };
  }

  /* ══════════ DINHEIRO ══════════ */
  function viewDinheiro() {
    const ym = st.ym || Store.finYm(), s = Store.finMonthSummary(ym), fin = Store.getFinance();
    const fixed = (fin.fixed || []).filter(f => f.active).sort((a, b) => a.dueDay - b.dueDay);
    const exps = (fin.expenses || []).filter(e => e.ym === ym).sort((a, b) => String(b.spentOn).localeCompare(String(a.spentOn)) || b.id - a.id);
    let html = `<div class="mnav"><button type="button" data-act="mnav" data-d="-1" aria-label="Mês anterior">‹</button><span>${esc(Store.finYmLabel(ym))}</span><button type="button" data-act="mnav" data-d="1" aria-label="Próximo mês">›</button></div>
      <div class="hero"><div class="big ${s.surplus < 0 ? 'neg' : ''}">${fmt0(s.surplus)}</div><div class="sub" style="margin-top:8px">sobra do mês</div></div>
      <div class="stats">
        <div class="stat"><div class="k">Renda</div><div class="v">${fmt0(s.income)}</div></div>
        <div class="stat"><div class="k">Contas e parcelas</div><div class="v">${fmt0(s.fixedTotal + s.installmentsTotal)}</div></div>
        <div class="stat"><div class="k">Gastos</div><div class="v">${fmt0(s.expensesTotal)}</div></div>
        <div class="stat"><div class="k">Investido</div><div class="v">${fmt0(s.investedTotal)}</div></div>
      </div>`;
    html += fixed.length ? `<h2>Contas fixas <b>${fixed.filter(f => Store.finFixedPaidMark(f.id, ym)).length} de ${fixed.length} pagas</b></h2>` + fixed.map(f => {
      const paid = !!Store.finFixedPaidMark(f.id, ym);
      return rowHTML({ act: 'tog-fixa', id: f.id, text: f.label, meta: 'dia ' + f.dueDay + ' · ' + fmt0(f.amount), done: paid });
    }).join('') : '';
    html += `<h2>Gastos do mês <b>${exps.length}</b></h2>` + (exps.length ? exps.map(e =>
      `<div class="row plain"><span class="tx">${esc(e.label || e.category)}</span><span class="mt">${shortDate(e.spentOn)} · ${fmt2(e.amount)}</span><button class="x" type="button" data-act="exp-del" data-id="${e.id}" aria-label="Apagar gasto">✕</button></div>`).join('')
      : '<div class="empty">Nenhum gasto neste mês. Toque em + para registrar.</div>');
    return { sub: s.income > 0 ? 'poupança ' + s.savingsRate + '%' : 'defina o salário no app completo', html };
  }

  /* ══════════ folha inferior ══════════ */
  function openSheet(html) {
    $('#sheet').innerHTML = '<div class="grab"></div>' + html;
    $('#sheet').hidden = false; $('#scrim').hidden = false;
    const f = $('#sheet input, #sheet textarea'); if (f) setTimeout(() => f.focus(), 60);
  }
  function closeSheet() { $('#sheet').hidden = true; $('#scrim').hidden = true; $('#sheet').innerHTML = ''; }

  function sheetAdd() {
    if (st.tab === 'habitos') {
      openSheet(`<h3>Novo hábito</h3><form data-form="add-habito"><label for="f-name">Nome</label>
        <input id="f-name" maxlength="60" placeholder="Ex.: Ler 20 minutos" autocomplete="off"><div class="hint">Vale todos os dias. Dá para pausar ou excluir depois.</div>
        <div class="acts"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn main" type="submit">Criar</button></div></form>`);
    } else if (st.tab === 'dinheiro') {
      openSheet(`<h3>Novo gasto</h3><form data-form="add-gasto"><label for="f-label">Descrição</label>
        <input id="f-label" maxlength="60" placeholder="Ex.: Mercado" autocomplete="off"><label for="f-val">Valor</label>
        <input id="f-val" inputmode="decimal" placeholder="0,00" autocomplete="off">
        <div class="acts"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn main" type="submit">Registrar</button></div></form>`);
    } else {
      openSheet(`<h3>Nova tarefa</h3><form data-form="add-tarefa"><label for="f-title">O que precisa ser feito?</label>
        <input id="f-title" maxlength="120" placeholder="Ex.: pagar internet dia 10" autocomplete="off"><div class="hint">Entendo “hoje”, “amanhã”, “dia 10”, “20/11” e dias da semana. Sem data, entra para hoje.</div>
        <div class="acts"><button class="btn" type="button" data-act="close">Cancelar</button><button class="btn main" type="submit">Adicionar</button></div></form>`);
    }
  }
  function sheetTask(id) {
    const t = Store.getTasks().find(x => x.id === id); if (!t) return;
    const date = t.sched === 'once'
      ? `<label for="f-date">Quando</label><input id="f-date" type="date" value="${esc(t.anchor || '')}">`
      : '<div class="hint">Tarefa recorrente: o horário de repetição é editado no app completo.</div>';
    openSheet(`<h3>Tarefa</h3><form data-form="edit-tarefa" data-id="${t.id}"><label for="f-title">Título</label>
      <input id="f-title" maxlength="120" value="${esc(t.title)}" autocomplete="off">${date}
      <div class="acts"><button class="btn bad" type="button" data-act="task-del" data-id="${t.id}">Excluir</button><button class="btn main" type="submit">Salvar</button></div></form>`);
  }
  function sheetHabit(id) {
    const h = Store.getHabits().find(x => x.id === id); if (!h) return;
    openSheet(`<h3>Hábito</h3><form data-form="edit-habito" data-id="${h.id}"><label for="f-name">Nome</label>
      <input id="f-name" maxlength="60" value="${esc(h.name)}" autocomplete="off">
      <div class="hint">Maior sequência: ${h.maxStreak || 0} dias.</div>
      <div class="acts"><button class="btn" type="button" data-act="hab-pause" data-id="${h.id}">${h.paused ? 'Retomar' : 'Pausar'}</button><button class="btn bad" type="button" data-act="hab-del" data-id="${h.id}">Excluir</button></div>
      <div class="acts"><button class="btn main" type="submit">Salvar</button></div></form>`);
  }
  function sheetMenu() {
    openSheet(`<h3>Project 90</h3>
      <a class="link" href="hoje.html" data-act="full">Abrir o app completo</a>
      <button class="link" type="button" data-act="logout" style="width:100%">Sair</button>
      <div class="acts"><button class="btn" type="button" data-act="close">Fechar</button></div>`);
  }

  /* ══════════ ações ══════════ */
  function after(fn, rowEl) {
    if (rowEl && rowEl.classList && !rowEl.classList.contains('done')) {
      rowEl.classList.add('leaving');
      setTimeout(() => { fn(); render(); }, 190);
    } else { fn(); render(); }
  }

  function onAction(act, el, ev) {
    const id = Number(el.dataset.id), rowEl = el.closest('.row');
    switch (act) {
      case 'tog-tarefa': after(() => Store.completeTask(id), rowEl); break;
      case 'undo-tarefa': after(() => Store.uncompleteTask(id, todayISO())); break;
      case 'tog-habito': after(() => toggleHabit(id), rowEl); break;
      case 'tog-conta': after(() => Store.setFinFixedPaid(id, Store.finYm(), true), rowEl); break;
      case 'tog-casa': after(() => Store.toggleHomeHabitDone(id)); break;
      case 'tog-noite': after(() => Store.toggleNightHabitDone(id)); break;
      case 'tog-fixa': after(() => { const ym = st.ym || Store.finYm(); Store.setFinFixedPaid(id, ym, !Store.finFixedPaidMark(id, ym)); }); break;
      case 'water': Store.addWater(Number(el.dataset.d)); render(); break;
      case 'sec': {
        const k = el.dataset.k, cur = st.open[k];
        const hr = new Date().getHours();
        const def = k === 'casa' ? (hr >= 17 && hr < 21) : k === 'noite' ? (hr >= 21 || hr < 5) : false;
        st.open[k] = !(cur != null ? cur : def); render(); break;
      }
      case 'hab-edit': sheetHabit(id); break;
      case 'task-edit': sheetTask(id); break;
      case 'hab-pause': {
        const hs = Store.getHabits(), h = hs.find(x => x.id === id); if (!h) break;
        h.paused = !h.paused; if (h.paused) h.streak = 0;
        Store.saveHabits(hs); closeSheet(); render(); note(h.paused ? 'Hábito pausado' : 'Hábito retomado'); break;
      }
      case 'hab-del': {
        const hs = Store.getHabits().slice(), i = hs.findIndex(x => x.id === id); if (i === -1) break;
        const snap = JSON.parse(JSON.stringify(hs[i]));
        hs.splice(i, 1); Store.saveHabits(hs); closeSheet(); render();
        undoable('Hábito excluído', () => { const l = Store.getHabits().slice(); l.splice(Math.min(i, l.length), 0, snap); Store.saveHabits(l); render(); });
        break;
      }
      case 'task-del': {
        const t = Store.getTasks().find(x => x.id === id); if (!t) break;
        const snap = { title: t.title, notes: t.notes, sched: t.sched, intervalDays: t.intervalDays, weekdays: t.weekdays, overdue: t.overdue, anchor: t.anchor };
        Store.deleteTask(id); closeSheet(); render();
        undoable('Tarefa excluída', () => { Store.addTask(snap); render(); });
        break;
      }
      case 'mood': {
        st.mood = st.mood === el.dataset.m ? null : el.dataset.m;
        document.querySelectorAll('.mood').forEach(b => { const on = b.dataset.m === st.mood; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
        saveDiary(); break;
      }
      case 'diary-pick': st.diaryDay = Number(el.dataset.day) === day() ? null : Number(el.dataset.day); render(); window.scrollTo(0, 0); break;
      case 'diary-del': {
        const n = st.diaryDay || day(), snap = Store.deleteJournalEntry(n);
        if (snap) { render(); undoable('Dia apagado', () => { Store.saveJournalEntry(n, snap); render(); }); }
        break;
      }
      case 'mnav': st.ym = Store.finYmAdd(st.ym || Store.finYm(), Number(el.dataset.d)); render(); break;
      case 'exp-del': {
        const e = (Store.getFinance().expenses || []).find(x => x.id === id); if (!e) break;
        const snap = { label: e.label, amount: e.amount, category: e.category, spentOn: e.spentOn };
        Store.deleteFinExpense(id); render();
        undoable('Gasto apagado', () => { Store.addFinExpense(snap); render(); });
        break;
      }
      case 'full': try { localStorage.setItem('p90_ui', 'full'); } catch (e) {} break;   // deixa o link navegar
      case 'goto': location.hash = el.dataset.k; break;
      case 'back': location.hash = 'mais'; break;
      case 'close': closeSheet(); break;
      case 'logout': {
        (async () => {
          try { await window.sb.auth.signOut(); } catch (e) {}
          try { localStorage.removeItem('p90_cache'); } catch (e) {}
          location.replace('login.html');
        })();
        break;
      }
      default: {
        const m = MODS[st.tab];
        if (m && m.actions && m.actions[act]) m.actions[act](el, ev);
      }
    }
  }

  function onSubmit(form) {
    const kind = form.dataset.form, id = Number(form.dataset.id);
    const v = sel => (form.querySelector(sel) || {}).value || '';
    if (kind === 'add-tarefa') {
      const raw = v('#f-title').trim(); if (!raw) return;
      const p = parseTask(raw), t = Store.addTask({ title: p.title, sched: 'once', anchor: p.iso });
      closeSheet(); render();
      undoable('Tarefa criada · ' + (p.iso === todayISO() ? 'hoje' : shortDate(p.iso)), () => { Store.deleteTask(t.id); render(); });
    } else if (kind === 'add-habito') {
      const name = v('#f-name').trim(); if (!name) return;
      const hs = Store.getHabits().slice(), nextId = Math.max.apply(null, hs.map(h => h.id).concat([100])) + 1;
      hs.push({ id: nextId, name, pillar: 'Outros', goal: '', freq: [0, 1, 2, 3, 4, 5, 6], streak: 0, maxStreak: 0, paused: false, history: ['miss'], createdDay: day() });
      Store.saveHabits(hs); closeSheet(); render(); note('Hábito criado');
    } else if (kind === 'add-gasto') {
      const amount = parseMoney(v('#f-val')), label = v('#f-label').trim();
      if (amount <= 0) { note('Informe o valor'); return; }
      const ym = st.ym || Store.finYm();
      Store.addFinExpense({ label: label || 'Gasto', amount, category: 'Outros', spentOn: ym === Store.finYm() ? todayISO() : ym + '-01' });
      closeSheet(); render(); note('Gasto registrado');
    } else if (kind === 'edit-tarefa') {
      const title = v('#f-title').trim(); if (!title) return;
      const patch = { title }, dateEl = form.querySelector('#f-date');
      if (dateEl) patch.anchor = dateEl.value || null;
      Store.updateTask(id, patch); closeSheet(); render();
    } else if (kind === 'edit-habito') {
      const name = v('#f-name').trim(); if (!name) return;
      const hs = Store.getHabits(), h = hs.find(x => x.id === id);
      if (h) { h.name = name; Store.saveHabits(hs); }
      closeSheet(); render();
    } else {
      const m = MODS[st.tab];
      if (m && m.forms && m.forms[kind]) m.forms[kind](form, id);
    }
  }

  /* ══════════ render + eventos ══════════ */
  // Conquistas: quem checa/desbloqueia é js/achievements.js (usado pelas outras páginas).
  let lastAch = 0;
  function maybeAchievements() {
    if (typeof window.notifyNewAchievements !== 'function' || !window.P90_ACHIEVEMENTS) return;
    const now = Date.now(); if (now - lastAch < 3000) return; lastAch = now;
    try { window.notifyNewAchievements(); } catch (e) {}
  }

  const VIEWS = { hoje: viewHoje, habitos: viewHabitos, tarefas: viewTarefas, diario: viewDiario, mais: viewMais };
  const topTab = k => TABS.indexOf(k) !== -1 ? k : 'mais';
  function render(force) {
    if (!VIEWS[st.tab] && !MODS[st.tab]) st.tab = 'hoje';
    if (!force && document.activeElement && document.activeElement.id === 'diary-text') return;   // não mexe no texto que está sendo digitado
    const m = MODS[st.tab];
    let v;
    try { v = m ? m.view() : VIEWS[st.tab](); }
    catch (e) { console.error('[Project 90] tela falhou:', e); v = { sub: '', html: '<div class="empty">Não foi possível abrir esta tela agora. Volte e tente de novo.</div>' }; }
    const title = m ? (m.title || st.tab) : TITLES[st.tab];
    $('#title').textContent = title;
    $('#sub').textContent = v.sub || '';
    if (st.cleanup) { try { st.cleanup(); } catch (e) {} st.cleanup = null; }
    $('#view').innerHTML = v.html;
    $('#back-btn').hidden = TABS.indexOf(st.tab) !== -1;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === topTab(st.tab)));
    $('#fab').hidden = m ? !m.fab : st.tab === 'diario' || st.tab === 'mais';
    document.title = title + ' · Project 90';
    if (m && m.after) { try { const c = m.after(); st.cleanup = typeof c === 'function' ? c : null; } catch (e) { console.error(e); } }
    maybeAchievements();
  }
  function tabFromHash() { const h = (location.hash || '').slice(1); return (TABS.indexOf(h) !== -1 || MODS[h]) ? h : 'hoje'; }
  function go(tab) { if (location.hash.slice(1) !== tab) location.hash = tab; else { st.tab = tab; render(); } }

  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-act], [data-tab], #fab, #menu-btn, #scrim');
    if (!t) return;
    if (t.dataset.tab) { go(t.dataset.tab); return; }
    if (t.id === 'fab') { const m = MODS[st.tab]; if (m && m.fab) m.fab(); else sheetAdd(); return; }
    if (t.id === 'menu-btn') { sheetMenu(); return; }
    if (t.id === 'scrim') { closeSheet(); return; }
    if (t.dataset.act) onAction(t.dataset.act, t, ev);
  });
  document.addEventListener('submit', ev => {
    const f = ev.target.closest('form[data-form]'); if (!f) return;
    ev.preventDefault(); onSubmit(f);
  });
  document.addEventListener('input', ev => {
    if (ev.target.id !== 'diary-text') return;
    const s = $('#diary-saved'); if (s) s.textContent = 'Salvando…';
    clearTimeout(st.saveTimer); st.saveTimer = setTimeout(saveDiary, 600);
  });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  window.addEventListener('hashchange', () => { st.tab = tabFromHash(); closeSheet(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); render(true); window.scrollTo(0, 0); });
  window.addEventListener('p90:synced', () => render());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  window.addEventListener('pagehide', () => { clearTimeout(st.saveTimer); saveDiary(); });

  MODS.dinheiro = { title: 'Dinheiro', group: 'Finanças', order: 0, view: viewDinheiro, fab: sheetAdd,
    meta() { const s = Store.finMonthSummary(Store.finYm()); return 'sobra ' + fmt0(s.surplus); } };

  const loaded = {};
  function load(src) {   // carrega um script de dados uma única vez e redesenha quando chegar
    if (loaded[src]) return; loaded[src] = true;
    const s = document.createElement('script'); s.src = src; s.onload = () => render(true); document.head.appendChild(s);
  }

  window.P90App = {
    esc, pad2, isoOf, todayISO, day, fmt0, fmt2, shortDate, parseMoney, note, undoable, parseTask,
    rowHTML, section, openSheet, closeSheet, render: force => render(force), after, load,
    open: st.open, cur: () => st.tab,
    register(key, mod) { MODS[key] = mod; if (st.tab === key || st.tab === 'mais') render(); },
    MOODS, DOW, MON,
  };

  st.tab = tabFromHash();
  setTimeout(() => { st.tab = tabFromHash(); render(); }, 0);   // depois que os módulos (js/app-*.js) se registrarem
})();
