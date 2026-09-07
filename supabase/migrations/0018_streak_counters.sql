-- ============================================================================
--  PROJECT 90 — Contadores "dias desde"
--
--  Marcadores do tipo "sem rede social até tarde", "sem pular treino". Cada um
--  mostra os dias limpos desde o último deslize; registrar um deslize fecha o
--  ciclo (guarda o recorde em `best_run`) e zera. `start_date` é o dia em que
--  o contador foi criado — base da contagem enquanto `last_slip` for nulo.
--
--  Aplicar depois de 0017_wins.sql.
-- ============================================================================

create table if not exists public.streak_counters (
  id         bigint  not null,
  user_id    uuid    not null references auth.users (id) on delete cascade,
  label      text    not null,
  last_slip  date,
  start_date date    not null default current_date,
  best_run   integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists streak_counters_user_idx on public.streak_counters (user_id);

alter table public.streak_counters enable row level security;

drop policy if exists "streak_counters: select own" on public.streak_counters;
create policy "streak_counters: select own" on public.streak_counters
  for select using (auth.uid() = user_id);
drop policy if exists "streak_counters: insert own" on public.streak_counters;
create policy "streak_counters: insert own" on public.streak_counters
  for insert with check (auth.uid() = user_id);
drop policy if exists "streak_counters: update own" on public.streak_counters;
create policy "streak_counters: update own" on public.streak_counters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "streak_counters: delete own" on public.streak_counters;
create policy "streak_counters: delete own" on public.streak_counters
  for delete using (auth.uid() = user_id);

-- ============================================================================
--  app_bootstrap() — devolve também 'streakCounters'
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
               'frozenDays',  coalesce(to_jsonb(m.frozen_days), '[]'::jsonb)
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
    ), '[]'::jsonb)
  );
$$;

-- ============================================================================
--  reset_progress() — também apaga os contadores
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

  insert into public.challenge_meta (user_id, start_date, total_days, timezone, freezes_left, frozen_days)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz, 2, '{}')
  on conflict (user_id) do update
    set start_date = excluded.start_date, total_days = 90, freezes_left = 2, frozen_days = '{}';

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
