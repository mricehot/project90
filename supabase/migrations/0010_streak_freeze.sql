-- ============================================================================
--  PROJECT 90 — Dia de folga (streak freeze)
--
--  Cada desafio dá 2 "dias de folga": usar um protege a sequência atual sem
--  exigir que nenhum hábito seja marcado naquele dia. Sempre se aplica ao dia
--  de hoje (challenge_day()), no momento em que a streak está em risco.
--
--  challenge_meta.freezes_left — quantas folgas ainda restam (começa em 2).
--  challenge_meta.frozen_days  — dias (número do desafio, 1-based) já usados
--                                 como folga; currentStreak() no cliente trata
--                                 esses dias como "mantidos" em vez de quebra.
--
--  Aplicar depois de 0009_vocabulary.sql.
-- ============================================================================

alter table public.challenge_meta
  add column if not exists freezes_left integer not null default 2,
  add column if not exists frozen_days  integer[] not null default '{}';

-- ============================================================================
--  use_freeze() — consome 1 folga e protege o dia de hoje
-- ============================================================================
create or replace function public.use_freeze()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day    int;
  v_left   int;
  v_frozen int[];
begin
  v_day := public.challenge_day();

  select freezes_left, frozen_days into v_left, v_frozen
  from public.challenge_meta where user_id = auth.uid();

  if v_left is null or v_left <= 0 then
    raise exception 'Sem dias de folga disponíveis';
  end if;
  if v_frozen is not null and v_day = any(v_frozen) then
    raise exception 'O dia de hoje já está protegido';
  end if;

  update public.challenge_meta
    set freezes_left = freezes_left - 1,
        frozen_days  = array_append(coalesce(frozen_days, '{}'), v_day)
    where user_id = auth.uid();

  return jsonb_build_object('day', v_day, 'freezesLeft', v_left - 1);
end;
$$;

revoke all on function public.use_freeze() from public;
grant execute on function public.use_freeze() to authenticated;

-- ============================================================================
--  app_bootstrap() — devolve freezes_left / frozen_days
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
    ), jsonb_build_object('roundsPlayed', 0, 'totalAnswered', 0, 'totalCorrect', 0, 'bestStreak', 0))
  );
$$;

-- ============================================================================
--  reset_progress() — também zera as folgas
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

  delete from public.habits           where user_id = auth.uid();
  delete from public.journal_entries  where user_id = auth.uid();
  delete from public.weekly_reviews   where user_id = auth.uid();
  delete from public.achievements     where user_id = auth.uid();
  delete from public.vocab_words      where user_id = auth.uid();
  delete from public.vocab_quiz_stats where user_id = auth.uid();

  insert into public.challenge_meta (user_id, start_date, total_days, timezone, freezes_left, frozen_days)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz, 2, '{}')
  on conflict (user_id) do update
    set start_date = excluded.start_date, total_days = 90, freezes_left = 2, frozen_days = '{}';

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
