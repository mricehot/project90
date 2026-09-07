-- ============================================================================
--  PROJECT 90 — Plano de leitura da Bíblia em 1 ano
--
--  A lista de leituras (dia -> referência) vive no cliente
--  (js/bible-plan.js). Aqui só guardamos o que o usuário já leu.
--
--  bible_days — 1 linha por dia do plano marcado como lido:
--    day_num    número do dia do plano (1..365)
--    done       lido
--    done_date  data (local) em que foi marcado — usada para a sequência
--
--  Começa vazio: nenhuma leitura marcada.
--
--  Aplicar depois de 0012_speech_daily.sql.
-- ============================================================================

create table if not exists public.bible_days (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  day_num    integer not null check (day_num between 1 and 400),
  done       boolean not null default true,
  done_date  date,
  updated_at timestamptz not null default now(),
  primary key (user_id, day_num)
);

alter table public.bible_days enable row level security;

drop policy if exists "bible_days: select own" on public.bible_days;
create policy "bible_days: select own" on public.bible_days
  for select using (auth.uid() = user_id);
drop policy if exists "bible_days: insert own" on public.bible_days;
create policy "bible_days: insert own" on public.bible_days
  for insert with check (auth.uid() = user_id);
drop policy if exists "bible_days: update own" on public.bible_days;
create policy "bible_days: update own" on public.bible_days
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "bible_days: delete own" on public.bible_days;
create policy "bible_days: delete own" on public.bible_days
  for delete using (auth.uid() = user_id);

drop trigger if exists trg_bible_days_updated on public.bible_days;
create trigger trg_bible_days_updated
  before update on public.bible_days
  for each row execute function public.set_updated_at();

-- ============================================================================
--  app_bootstrap() — devolve os dias do plano da Bíblia já lidos
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
    ), '{}'::jsonb)
  );
$$;

-- ============================================================================
--  reset_progress() — também apaga o progresso do plano da Bíblia
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

  insert into public.challenge_meta (user_id, start_date, total_days, timezone, freezes_left, frozen_days)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz, 2, '{}')
  on conflict (user_id) do update
    set start_date = excluded.start_date, total_days = 90, freezes_left = 2, frozen_days = '{}';

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
