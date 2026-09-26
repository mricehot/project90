-- ============================================================================
--  PROJECT 90 — o dia volta a virar à meia-noite
--
--  Desfaz a 0045 (virada às 5h): challenge_day(), set_timezone() e
--  reset_progress() voltam às definições das migrations 0007 e 0028.
--  Aplicar depois de 0046_idle_state_guard.sql.
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
