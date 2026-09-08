-- ============================================================================
--  PROJECT 90 — Faculdade (controle de prazos)
--
--  Uma lista simples pra se organizar com datas de entrega da faculdade:
--  disciplinas → atividades com data de entrega e um check de "entregue".
--  Nada de nota, tipo, recorrência ou timeline — só datas limites.
--
--    study_subjects    — disciplinas (id gerado pelo cliente)
--    study_activities   — atividades: título, due_on, done
--
--  Status "atrasada" é derivado no cliente (venceu e não entregue).
--  O aviso do que está vencendo mora no card do dashboard.
--
--  Aplicar depois de 0020_night_routine.sql.
--  (0021 fica reservada pra feature "Sistema"/RPG, ainda não construída.)
-- ============================================================================

create table if not exists public.study_subjects (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         bigint      not null,
  name       text        not null,
  sort_order integer     not null default 0,
  archived   boolean     not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists study_subjects_user_idx on public.study_subjects (user_id);

create table if not exists public.study_activities (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         bigint      not null,
  subject_id bigint      not null,
  title      text        not null,
  due_on     date,
  done       boolean     not null default false,
  done_on    date,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists study_activities_user_idx     on public.study_activities (user_id);
create index if not exists study_activities_due_idx      on public.study_activities (user_id, due_on);
create index if not exists study_activities_subject_idx  on public.study_activities (user_id, subject_id);

alter table public.study_subjects   enable row level security;
alter table public.study_activities enable row level security;

drop policy if exists "study_subjects: select own" on public.study_subjects;
create policy "study_subjects: select own" on public.study_subjects
  for select using (auth.uid() = user_id);
drop policy if exists "study_subjects: insert own" on public.study_subjects;
create policy "study_subjects: insert own" on public.study_subjects
  for insert with check (auth.uid() = user_id);
drop policy if exists "study_subjects: update own" on public.study_subjects;
create policy "study_subjects: update own" on public.study_subjects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "study_subjects: delete own" on public.study_subjects;
create policy "study_subjects: delete own" on public.study_subjects
  for delete using (auth.uid() = user_id);

drop policy if exists "study_activities: select own" on public.study_activities;
create policy "study_activities: select own" on public.study_activities
  for select using (auth.uid() = user_id);
drop policy if exists "study_activities: insert own" on public.study_activities;
create policy "study_activities: insert own" on public.study_activities
  for insert with check (auth.uid() = user_id);
drop policy if exists "study_activities: update own" on public.study_activities;
create policy "study_activities: update own" on public.study_activities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "study_activities: delete own" on public.study_activities;
create policy "study_activities: delete own" on public.study_activities
  for delete using (auth.uid() = user_id);

-- ============================================================================
--  app_bootstrap() — devolve também 'studySubjects' + 'studyActivities'
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
                                  'dueOn', a.due_on, 'done', a.done, 'doneOn', a.done_on,
                                  'createdAt', a.created_at)
               order by a.due_on nulls last, a.id
             )
      from public.study_activities a where a.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

-- ============================================================================
--  reset_progress() — apaga também disciplinas e atividades da faculdade
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

  delete from public.habits                where user_id = auth.uid();
  delete from public.journal_entries       where user_id = auth.uid();
  delete from public.weekly_reviews        where user_id = auth.uid();
  delete from public.achievements          where user_id = auth.uid();
  delete from public.vocab_words           where user_id = auth.uid();
  delete from public.vocab_quiz_stats      where user_id = auth.uid();
  delete from public.speech_exercises      where user_id = auth.uid();
  delete from public.speech_practice_stats where user_id = auth.uid();
  delete from public.speech_days           where user_id = auth.uid();
  delete from public.bible_days            where user_id = auth.uid();
  delete from public.task_completions      where user_id = auth.uid();
  delete from public.tasks                 where user_id = auth.uid();
  delete from public.wins                  where user_id = auth.uid();
  delete from public.streak_counters       where user_id = auth.uid();
  delete from public.night_routine_days    where user_id = auth.uid();
  delete from public.night_habits          where user_id = auth.uid();
  delete from public.study_activities      where user_id = auth.uid();
  delete from public.study_subjects        where user_id = auth.uid();

  insert into public.challenge_meta (user_id, start_date, total_days, timezone, freezes_left, frozen_days)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz, 2, '{}')
  on conflict (user_id) do update
    set start_date = excluded.start_date, total_days = 90, freezes_left = 2,
        frozen_days = '{}', night_routine_active = 1;

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
