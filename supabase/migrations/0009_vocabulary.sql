-- ============================================================================
--  PROJECT 90 — Vocabulário
--
--  Palavras que o usuário quer aprender: palavra, significado, exemplo de uso
--  e data. Alimenta a seção "Vocabulário" (lista + jogo "Testar meu
--  vocabulário") e uma nova categoria de conquistas.
--
--  vocab_words   — 1 linha por palavra cadastrada (id gerado pelo cliente,
--                   mesmo padrão de habits.id).
--  vocab_quiz_stats — 1 linha por usuário com o placar acumulado do jogo
--                   (rounds_played / total_answered / total_correct).
--
--  Aplicar depois de 0008_weekly_review.sql.
-- ============================================================================

create table if not exists public.vocab_words (
  id         bigint  not null,
  user_id    uuid    not null references auth.users (id) on delete cascade,
  word       text    not null,
  meaning    text    not null,
  example    text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists vocab_words_user_idx on public.vocab_words (user_id);

alter table public.vocab_words enable row level security;

drop policy if exists "vocab_words: select own" on public.vocab_words;
create policy "vocab_words: select own" on public.vocab_words
  for select using (auth.uid() = user_id);
drop policy if exists "vocab_words: insert own" on public.vocab_words;
create policy "vocab_words: insert own" on public.vocab_words
  for insert with check (auth.uid() = user_id);
drop policy if exists "vocab_words: update own" on public.vocab_words;
create policy "vocab_words: update own" on public.vocab_words
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "vocab_words: delete own" on public.vocab_words;
create policy "vocab_words: delete own" on public.vocab_words
  for delete using (auth.uid() = user_id);

create table if not exists public.vocab_quiz_stats (
  user_id        uuid    primary key references auth.users (id) on delete cascade,
  rounds_played  integer not null default 0,
  total_answered integer not null default 0,
  total_correct  integer not null default 0,
  best_streak    integer not null default 0,
  updated_at     timestamptz not null default now()
);

alter table public.vocab_quiz_stats enable row level security;

drop policy if exists "vocab_quiz_stats: select own" on public.vocab_quiz_stats;
create policy "vocab_quiz_stats: select own" on public.vocab_quiz_stats
  for select using (auth.uid() = user_id);
drop policy if exists "vocab_quiz_stats: insert own" on public.vocab_quiz_stats;
create policy "vocab_quiz_stats: insert own" on public.vocab_quiz_stats
  for insert with check (auth.uid() = user_id);
drop policy if exists "vocab_quiz_stats: update own" on public.vocab_quiz_stats;
create policy "vocab_quiz_stats: update own" on public.vocab_quiz_stats
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_vocab_quiz_stats_updated on public.vocab_quiz_stats;
create trigger trg_vocab_quiz_stats_updated
  before update on public.vocab_quiz_stats
  for each row execute function public.set_updated_at();

-- ============================================================================
--  app_bootstrap() — devolve palavras + placar do quiz
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
               'timezone',  m.timezone
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
    ), jsonb_build_object('roundsPlayed', 0, 'totalAnswered', 0, 'totalCorrect', 0, 'bestStreak', 0))
  );
$$;

-- ============================================================================
--  reset_progress() — também apaga o vocabulário e o placar do quiz
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

  delete from public.habits          where user_id = auth.uid();
  delete from public.journal_entries where user_id = auth.uid();
  delete from public.weekly_reviews  where user_id = auth.uid();
  delete from public.achievements    where user_id = auth.uid();
  delete from public.vocab_words     where user_id = auth.uid();
  delete from public.vocab_quiz_stats where user_id = auth.uid();

  insert into public.challenge_meta (user_id, start_date, total_days, timezone)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz)
  on conflict (user_id) do update
    set start_date = excluded.start_date, total_days = 90;

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
