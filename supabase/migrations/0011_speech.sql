-- ============================================================================
--  PROJECT 90 — Dicção (exercícios de fala)
--
--  Biblioteca de exercícios de fala (trava-línguas, articulação, respiração,
--  projeção, ritmo) que o usuário pratica em voz alta, mais o placar
--  acumulado das sessões de prática.
--
--  speech_exercises      — 1 linha por exercício (id gerado pelo cliente,
--                           mesmo padrão de habits.id / vocab_words.id).
--  speech_practice_stats — 1 linha por usuário com o placar acumulado
--                           (sessões, repetições, soma/contagem das
--                           auto-avaliações 1–5, maior sequência).
--
--  Aplicar depois de 0010_streak_freeze.sql.
-- ============================================================================

create table if not exists public.speech_exercises (
  id         bigint  not null,
  user_id    uuid    not null references auth.users (id) on delete cascade,
  title      text    not null,
  body       text    not null,
  kind       text    not null default 'trava-lingua',
  focus      text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists speech_exercises_user_idx on public.speech_exercises (user_id);

alter table public.speech_exercises enable row level security;

drop policy if exists "speech_exercises: select own" on public.speech_exercises;
create policy "speech_exercises: select own" on public.speech_exercises
  for select using (auth.uid() = user_id);
drop policy if exists "speech_exercises: insert own" on public.speech_exercises;
create policy "speech_exercises: insert own" on public.speech_exercises
  for insert with check (auth.uid() = user_id);
drop policy if exists "speech_exercises: update own" on public.speech_exercises;
create policy "speech_exercises: update own" on public.speech_exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "speech_exercises: delete own" on public.speech_exercises;
create policy "speech_exercises: delete own" on public.speech_exercises
  for delete using (auth.uid() = user_id);

create table if not exists public.speech_practice_stats (
  user_id         uuid    primary key references auth.users (id) on delete cascade,
  sessions_played integer not null default 0,
  reps_total      integer not null default 0,
  rating_sum      integer not null default 0,
  rating_count    integer not null default 0,
  best_streak     integer not null default 0,
  updated_at      timestamptz not null default now()
);

alter table public.speech_practice_stats enable row level security;

drop policy if exists "speech_practice_stats: select own" on public.speech_practice_stats;
create policy "speech_practice_stats: select own" on public.speech_practice_stats
  for select using (auth.uid() = user_id);
drop policy if exists "speech_practice_stats: insert own" on public.speech_practice_stats;
create policy "speech_practice_stats: insert own" on public.speech_practice_stats
  for insert with check (auth.uid() = user_id);
drop policy if exists "speech_practice_stats: update own" on public.speech_practice_stats;
create policy "speech_practice_stats: update own" on public.speech_practice_stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_speech_practice_stats_updated on public.speech_practice_stats;
create trigger trg_speech_practice_stats_updated
  before update on public.speech_practice_stats
  for each row execute function public.set_updated_at();

-- ============================================================================
--  app_bootstrap() — devolve os exercícios de fala + placar de prática
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
               jsonb_build_object('mood', j.mood, 'good', j.good, 'improve', j.improve, 'free', j.free, 'gratitude', j.gratitude))
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
                 'example', v.example, 'createdAt', v.created_at
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
    ), jsonb_build_object('sessionsPlayed', 0, 'repsTotal', 0, 'ratingSum', 0, 'ratingCount', 0, 'bestStreak', 0))
  );
$$;

-- ============================================================================
--  reset_progress() — também apaga a biblioteca de dicção e o placar
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

  insert into public.challenge_meta (user_id, start_date, total_days, timezone, freezes_left, frozen_days)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz, 2, '{}')
  on conflict (user_id) do update
    set start_date = excluded.start_date, total_days = 90, freezes_left = 2, frozen_days = '{}';

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
