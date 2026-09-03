-- ============================================================================
--  PROJECT 90 — fuso horário do usuário
--
--  challenge_day() usava `current_date` do servidor (UTC). Um usuário em
--  UTC-3 virava o dia às 21h. Agora o dia é calculado no fuso do próprio
--  usuário, guardado em challenge_meta.timezone (nome IANA, ex.:
--  'America/Sao_Paulo'). O cliente envia o fuso via set_timezone() no load.
--
--  Aplicar depois de 0006_bible_habit.sql.
-- ============================================================================

alter table public.challenge_meta
  add column if not exists timezone text not null default 'UTC';

-- ============================================================================
--  challenge_day() — dia atual no fuso do usuário
-- ============================================================================
create or replace function public.challenge_day(p_user uuid default auth.uid())
returns integer
language sql
stable
as $$
  select greatest(1, least(
           ((now() at time zone coalesce(nullif(m.timezone, ''), 'UTC'))::date - m.start_date) + 1,
           m.total_days
         ))
  from public.challenge_meta m
  where m.user_id = p_user;
$$;

grant execute on function public.challenge_day(uuid) to authenticated;

-- ============================================================================
--  set_timezone(tz) — define o fuso do usuário. Se o desafio ainda está no
--  dia 1, ancora start_date na data local (corrige cadastro perto da
--  meia-noite, quando o start_date ficou gravado em UTC).
-- ============================================================================
create or replace function public.set_timezone(p_tz text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  local_today date;
begin
  if p_tz is null or length(p_tz) = 0 then
    return;
  end if;

  begin
    local_today := (now() at time zone p_tz)::date;   -- erro se o fuso for inválido
  exception when others then
    return;
  end;

  update public.challenge_meta
  set timezone = p_tz,
      start_date = case
        when ((local_today - start_date) + 1) <= 1 then local_today
        else start_date
      end
  where user_id = auth.uid();
end;
$$;

revoke all on function public.set_timezone(text) from public;
grant execute on function public.set_timezone(text) to authenticated;

-- ============================================================================
--  app_bootstrap() — devolve o timezone no meta
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
    'achievements', coalesce((
      select jsonb_object_agg(a.achievement_id,
               jsonb_build_object('unlockedDay', a.unlocked_day, 'seenModal', a.seen_modal))
      from public.achievements a where a.user_id = auth.uid()
    ), '{}'::jsonb)
  );
$$;

-- ============================================================================
--  reset_progress() — start_date na data local do usuário
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
