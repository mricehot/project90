-- ============================================================================
--  PROJECT 90 — Revisão semanal
--
--  A cada 7 dias completos o usuário faz uma revisão da semana (separada do
--  diário diário): o que funcionou, o que atrapalhou, foco da próxima semana
--  e uma nota de 1 a 5. week_num = 1..12 (a semana N cobre os dias
--  (N-1)*7+1 .. N*7 e a revisão abre quando currentDay >= N*7).
--
--  Aplicar depois de 0007_timezone.sql.
-- ============================================================================

create table if not exists public.weekly_reviews (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  week_num   integer not null check (week_num between 1 and 53),
  wins       text,
  friction   text,
  focus      text,
  score      smallint check (score between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_num)
);

alter table public.weekly_reviews enable row level security;

drop policy if exists "weekly_reviews: select own" on public.weekly_reviews;
create policy "weekly_reviews: select own" on public.weekly_reviews
  for select using (auth.uid() = user_id);
drop policy if exists "weekly_reviews: insert own" on public.weekly_reviews;
create policy "weekly_reviews: insert own" on public.weekly_reviews
  for insert with check (auth.uid() = user_id);
drop policy if exists "weekly_reviews: update own" on public.weekly_reviews;
create policy "weekly_reviews: update own" on public.weekly_reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "weekly_reviews: delete own" on public.weekly_reviews;
create policy "weekly_reviews: delete own" on public.weekly_reviews
  for delete using (auth.uid() = user_id);

drop trigger if exists trg_weekly_reviews_updated on public.weekly_reviews;
create trigger trg_weekly_reviews_updated
  before update on public.weekly_reviews
  for each row execute function public.set_updated_at();

-- ============================================================================
--  app_bootstrap() — devolve as revisões semanais
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
    ), '{}'::jsonb)
  );
$$;

-- ============================================================================
--  reset_progress() — também apaga as revisões semanais
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

  insert into public.challenge_meta (user_id, start_date, total_days, timezone)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz)
  on conflict (user_id) do update
    set start_date = excluded.start_date, total_days = 90;

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
