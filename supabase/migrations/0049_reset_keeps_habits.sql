-- ============================================================================
--  PROJECT 90 — "Resetar progresso" não apaga mais nenhum hábito
--
--  Antes, reset_progress() deletava TODOS os hábitos e re-semeava os fixos —
--  os hábitos criados pelo usuário (e as edições) sumiam. Agora só o
--  progresso do dia 1 ao 90 é zerado:
--    · habits: histórico e sequências zerados; created_day volta a 1 (o
--      calendário recomeça, então todo hábito vale desde o dia 1).
--      Nome, pilar, frequência, meta, pausa e ordem ficam como estão.
--    · challenge_meta: início = hoje, 90 dias, folgas renovadas.
--  Não recria hábitos fixos (quem apagou um continua sem ele).
--  Diário, tarefas, treino etc. continuam intactos, como antes.
--
--  Aplicar depois de 0048_work_reminders_policies.sql.
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

  -- só o progresso: nenhum hábito é removido
  update public.habits
  set history      = '[]'::jsonb,
      streak       = 0,
      max_streak   = 0,
      created_day  = 1,
      updated_at   = now()
  where user_id = auth.uid();

  -- calendário volta pro dia 1: início = hoje, 90 dias, folgas renovadas
  insert into public.challenge_meta (user_id, start_date, total_days, timezone, freezes_left, frozen_days)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz, 2, '{}')
  on conflict (user_id) do update
    set start_date   = excluded.start_date,
        total_days   = 90,
        freezes_left = 2,
        frozen_days  = '{}';
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
