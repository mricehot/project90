-- ============================================================================
--  PROJECT 90 — Financeiro: histórico do patrimônio (gráficos)
--
--  Guarda o valor da carteira de FII mês a mês, pra desenhar a curva de
--  crescimento do patrimônio na página Financeiro. Toda vez que o usuário
--  atualiza "valor atual da carteira" no config, o mês corrente também é
--  gravado aqui (e ele pode preencher meses passados à mão).
--
--    fin_snapshots — user_id, ym ('YYYY-MM'), portfolio_value
--
--  Aplicar depois de 0029_financeiro.sql.
--  reset_progress() continua NÃO tocando no financeiro.
--  (0021 continua reservada pra feature "Sistema"/RPG.)
-- ============================================================================

create table if not exists public.fin_snapshots (
  user_id         uuid          not null references auth.users (id) on delete cascade,
  ym              text          not null,
  portfolio_value numeric(12,2) not null default 0,
  updated_at      timestamptz   not null default now(),
  primary key (user_id, ym)
);

alter table public.fin_snapshots enable row level security;
drop policy if exists "fin_snapshots: select own" on public.fin_snapshots;
create policy "fin_snapshots: select own" on public.fin_snapshots for select using (auth.uid() = user_id);
drop policy if exists "fin_snapshots: insert own" on public.fin_snapshots;
create policy "fin_snapshots: insert own" on public.fin_snapshots for insert with check (auth.uid() = user_id);
drop policy if exists "fin_snapshots: update own" on public.fin_snapshots;
create policy "fin_snapshots: update own" on public.fin_snapshots for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "fin_snapshots: delete own" on public.fin_snapshots;
create policy "fin_snapshots: delete own" on public.fin_snapshots for delete using (auth.uid() = user_id);

-- ============================================================================
--  app_bootstrap() — 0029 + finance.snapshots
-- ============================================================================
create or replace function public.app_bootstrap()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'meta', (
      select jsonb_build_object(
               'startDate', m.start_date,
               'totalDays', m.total_days,
               'timezone',  m.timezone,
               'freezesLeft', m.freezes_left,
               'frozenDays',  coalesce(to_jsonb(m.frozen_days), '[]'::jsonb),
               'nightRoutineActive', coalesce(m.night_routine_active, 1)
             )
      from public.challenge_meta m where m.user_id = auth.uid()
    ),
    'currentDay', public.challenge_day(),
    'habits', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', h.id, 'name', h.name, 'pillar', h.pillar, 'freq', h.freq, 'goal', h.goal,
                 'streak', h.streak, 'maxStreak', h.max_streak, 'paused', h.paused,
                 'createdDay', h.created_day, 'history', h.history, 'coreKey', h.core_key
               ) order by h.sort_order, h.id
             )
      from public.habits h where h.user_id = auth.uid()
    ), '[]'::jsonb),
    'journal', coalesce((
      select jsonb_object_agg(j.day_num::text,
               jsonb_build_object('mood', j.mood, 'good', j.good, 'improve', j.improve,
                                  'free', j.free, 'gratitude', j.gratitude,
                                  'promptReply', j.prompt_reply))
      from public.journal_entries j where j.user_id = auth.uid()
    ), '{}'::jsonb),
    'weeklyReviews', coalesce((
      select jsonb_object_agg(w.week_num::text,
               jsonb_build_object('wins', w.wins, 'friction', w.friction, 'focus', w.focus, 'score', w.score))
      from public.weekly_reviews w where w.user_id = auth.uid()
    ), '{}'::jsonb),
    'achievements', coalesce((
      select jsonb_object_agg(a.achievement_id,
               jsonb_build_object('unlockedDay', a.unlocked_day, 'seenModal', a.seen_modal))
      from public.achievements a where a.user_id = auth.uid()
    ), '{}'::jsonb),
    'vocabWords', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', v.id, 'word', v.word, 'meaning', v.meaning,
                 'example', v.example, 'createdAt', v.created_at,
                 'srsBox', v.srs_box, 'srsDue', v.srs_due, 'srsReviews', v.srs_reviews,
                 'srsLapses', v.srs_lapses, 'srsLast', v.srs_last
               ) order by v.created_at desc, v.id desc
             )
      from public.vocab_words v where v.user_id = auth.uid()
    ), '[]'::jsonb),
    'vocabQuiz', coalesce((
      select jsonb_build_object(
               'roundsPlayed', q.rounds_played, 'totalAnswered', q.total_answered,
               'totalCorrect', q.total_correct, 'bestStreak', q.best_streak
             )
      from public.vocab_quiz_stats q where q.user_id = auth.uid()
    ), jsonb_build_object('roundsPlayed', 0, 'totalAnswered', 0, 'totalCorrect', 0, 'bestStreak', 0)),
    'speechExercises', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', s.id, 'title', s.title, 'body', s.body,
                 'kind', s.kind, 'focus', s.focus, 'createdAt', s.created_at
               ) order by s.created_at desc, s.id desc
             )
      from public.speech_exercises s where s.user_id = auth.uid()
    ), '[]'::jsonb),
    'speechStats', coalesce((
      select jsonb_build_object(
               'sessionsPlayed', p.sessions_played, 'repsTotal', p.reps_total,
               'ratingSum', p.rating_sum, 'ratingCount', p.rating_count, 'bestStreak', p.best_streak
             )
      from public.speech_practice_stats p where p.user_id = auth.uid()
    ), jsonb_build_object('sessionsPlayed', 0, 'repsTotal', 0, 'ratingSum', 0, 'ratingCount', 0, 'bestStreak', 0)),
    'speechDays', coalesce((
      select jsonb_object_agg(d.day_num::text,
               jsonb_build_object('reps', d.reps, 'ratingSum', d.rating_sum,
                                  'ratingCount', d.rating_count, 'done', d.done))
      from public.speech_days d where d.user_id = auth.uid()
    ), '{}'::jsonb),
    'bibleDays', coalesce((
      select jsonb_object_agg(b.day_num::text,
               jsonb_build_object('done', b.done, 'doneDate', b.done_date))
      from public.bible_days b where b.user_id = auth.uid() and b.done
    ), '{}'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', t.id, 'title', t.title, 'notes', t.notes, 'sched', t.sched,
                 'intervalDays', t.interval_days, 'weekdays', t.weekdays, 'overdue', t.overdue,
                 'anchor', t.anchor, 'archived', t.archived, 'createdAt', t.created_at
               ) order by t.sort_order, t.id
             )
      from public.tasks t where t.user_id = auth.uid()
    ), '[]'::jsonb),
    'taskDone', coalesce((
      select jsonb_object_agg(k.task_id::text, k.dates)
      from (
        select c.task_id, jsonb_agg(c.done_date order by c.done_date) as dates
        from public.task_completions c where c.user_id = auth.uid()
        group by c.task_id
      ) k
    ), '{}'::jsonb),
    'wins', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', w.id, 'text', w.text, 'dayNum', w.day_num, 'createdAt', w.created_at
               ) order by w.created_at desc, w.id desc
             )
      from public.wins w where w.user_id = auth.uid()
    ), '[]'::jsonb),
    'streakCounters', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', s.id, 'label', s.label, 'lastSlip', s.last_slip,
                 'startDate', s.start_date, 'bestRun', s.best_run, 'createdAt', s.created_at
               ) order by s.created_at, s.id
             )
      from public.streak_counters s where s.user_id = auth.uid()
    ), '[]'::jsonb),
    'nightHabits', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', n.id, 'label', n.label,
                                  'routine', coalesce(n.routine, 1), 'createdAt', n.created_at)
               order by n.created_at, n.id
             )
      from public.night_habits n where n.user_id = auth.uid()
    ), '[]'::jsonb),
    'nightRoutineDays', coalesce((
      select jsonb_object_agg(r.day_num::text,
               jsonb_build_object('ids', r.done_ids, 'routine', coalesce(r.routine, 1)))
      from public.night_routine_days r where r.user_id = auth.uid()
    ), '{}'::jsonb),
    'studySubjects', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', s.id, 'name', s.name,
                                  'archived', s.archived, 'createdAt', s.created_at)
               order by s.sort_order, s.id
             )
      from public.study_subjects s where s.user_id = auth.uid()
    ), '[]'::jsonb),
    'studyActivities', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', a.id, 'subjectId', a.subject_id, 'title', a.title,
                                  'dueOn', a.due_on, 'status', coalesce(a.status, 'a_fazer'),
                                  'done', a.done, 'doneOn', a.done_on,
                                  'link', a.link, 'notes', a.notes,
                                  'createdAt', a.created_at)
               order by a.due_on nulls last, a.id
             )
      from public.study_activities a where a.user_id = auth.uid()
    ), '[]'::jsonb),
    'trainingExercises', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', e.id, 'split', e.split, 'name', e.name,
                                  'sets', e.sets, 'reps', e.reps, 'createdAt', e.created_at)
               order by e.split, e.sort_order, e.id
             )
      from public.training_exercises e where e.user_id = auth.uid()
    ), '[]'::jsonb),
    'trainingDays', coalesce((
      select jsonb_object_agg(t.day_num::text,
               jsonb_build_object('split', t.split, 'entries', t.entries))
      from public.training_days t where t.user_id = auth.uid()
    ), '{}'::jsonb),
    'mealItems', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', mi.id, 'label', mi.label, 'createdAt', mi.created_at)
               order by mi.sort_order, mi.id
             )
      from public.meal_items mi where mi.user_id = auth.uid()
    ), '[]'::jsonb),
    'mealDays', coalesce((
      select jsonb_object_agg(md.day_num::text, md.done_ids)
      from public.meal_days md where md.user_id = auth.uid()
    ), '{}'::jsonb),
    'bodyWeights', coalesce((
      select jsonb_object_agg(bw.day_num::text, bw.kg)
      from public.body_weights bw where bw.user_id = auth.uid()
    ), '{}'::jsonb),
    'readingTexts', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', rt.id, 'title', rt.title, 'body', rt.body,
                                  'category', rt.category, 'source', rt.source,
                                  'lastReadDay', rt.last_read_day, 'createdAt', rt.created_at)
               order by rt.created_at, rt.id
             )
      from public.reading_texts rt where rt.user_id = auth.uid()
    ), '[]'::jsonb),
    'biblePassages', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', bp.id, 'book', bp.book, 'chapter', bp.chapter,
                                  'verse', bp.verse, 'text', bp.text, 'message', bp.message,
                                  'createdAt', bp.created_at)
               order by bp.created_at, bp.id
             )
      from public.bible_passages bp where bp.user_id = auth.uid()
    ), '[]'::jsonb),
    'finance', jsonb_build_object(
      'config', coalesce((
        select jsonb_build_object(
                 'monthlySalary', c.monthly_salary, 'salaryDay', c.salary_day,
                 'investTarget', c.invest_target, 'portfolioValue', c.portfolio_value,
                 'portfolioUpdatedAt', c.portfolio_updated_at, 'updatedAt', c.updated_at)
        from public.fin_config c where c.user_id = auth.uid()
      ), jsonb_build_object('monthlySalary', 0, 'salaryDay', 5, 'investTarget', 0, 'portfolioValue', 0, 'portfolioUpdatedAt', null, 'updatedAt', null)),
      'income', coalesce((
        select jsonb_agg(jsonb_build_object('id', i.id, 'ym', i.ym, 'label', i.label,
                                            'amount', i.amount, 'receivedOn', i.received_on, 'createdAt', i.created_at)
                 order by i.received_on, i.id)
        from public.fin_income i where i.user_id = auth.uid()
      ), '[]'::jsonb),
      'fixed', coalesce((
        select jsonb_agg(jsonb_build_object('id', f.id, 'label', f.label, 'amount', f.amount,
                                            'dueDay', f.due_day, 'category', f.category, 'active', f.active,
                                            'createdAt', f.created_at)
                 order by f.due_day, f.id)
        from public.fin_fixed f where f.user_id = auth.uid()
      ), '[]'::jsonb),
      'fixedPaid', coalesce((
        select jsonb_agg(jsonb_build_object('fixedId', p.fixed_id, 'ym', p.ym, 'paidOn', p.paid_on, 'amount', p.amount))
        from public.fin_fixed_paid p where p.user_id = auth.uid()
      ), '[]'::jsonb),
      'installments', coalesce((
        select jsonb_agg(jsonb_build_object('id', n.id, 'label', n.label, 'total', n.total,
                                            'nInstallments', n.n_installments, 'firstYm', n.first_ym,
                                            'installmentAmount', n.installment_amount, 'category', n.category,
                                            'createdAt', n.created_at)
                 order by n.first_ym, n.id)
        from public.fin_installments n where n.user_id = auth.uid()
      ), '[]'::jsonb),
      'expenses', coalesce((
        select jsonb_agg(jsonb_build_object('id', e.id, 'spentOn', e.spent_on, 'ym', e.ym, 'label', e.label,
                                            'amount', e.amount, 'category', e.category, 'createdAt', e.created_at)
                 order by e.spent_on desc, e.id desc)
        from public.fin_expenses e where e.user_id = auth.uid()
      ), '[]'::jsonb),
      'investments', coalesce((
        select jsonb_agg(jsonb_build_object('id', v.id, 'kind', v.kind, 'onDate', v.on_date, 'ym', v.ym,
                                            'ticker', v.ticker, 'amount', v.amount, 'quantity', v.quantity,
                                            'createdAt', v.created_at)
                 order by v.on_date desc, v.id desc)
        from public.fin_investments v where v.user_id = auth.uid()
      ), '[]'::jsonb),
      'goals', coalesce((
        select jsonb_agg(jsonb_build_object('id', g.id, 'label', g.label, 'target', g.target, 'saved', g.saved,
                                            'monthlyPlan', g.monthly_plan, 'deadline', g.deadline, 'done', g.done,
                                            'createdAt', g.created_at)
                 order by g.done, g.created_at, g.id)
        from public.fin_goals g where g.user_id = auth.uid()
      ), '[]'::jsonb),
      'snapshots', coalesce((
        select jsonb_object_agg(sn.ym, sn.portfolio_value)
        from public.fin_snapshots sn where sn.user_id = auth.uid()
      ), '{}'::jsonb)
    )
  );
$$;

-- ============================================================================
--  reset_progress() — inalterada em relação à 0029 (não toca no financeiro)
-- ============================================================================
create or replace function public.reset_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text;
begin
  select coalesce(nullif(timezone, ''), 'UTC') into tz
  from public.challenge_meta where user_id = auth.uid();
  tz := coalesce(tz, 'UTC');

  -- Só os hábitos: apaga todos (a sequência/streak zera junto, porque o
  -- histórico some) e re-semeia os hábitos-base logo abaixo.
  delete from public.habits where user_id = auth.uid();

  -- Calendário volta pro dia 1: início = hoje, 90 dias, folgas renovadas.
  insert into public.challenge_meta (user_id, start_date, total_days, timezone, freezes_left, frozen_days)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz, 2, '{}')
  on conflict (user_id) do update
    set start_date   = excluded.start_date,
        total_days   = 90,
        freezes_left = 2,
        frozen_days  = '{}';

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
