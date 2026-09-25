-- ============================================================================
--  PROJECT 90 — Masmorra: proteção do progresso no próprio banco
--
--  Um cliente com cache vazio/atrasado já sobrescreveu o jogo salvo com um
--  jogo zerado. O app foi corrigido, mas o banco também passa a se defender:
--
--   1) Trigger BEFORE UPDATE em idle_state: se o novo estado tem MENOS
--      progresso que o salvo (energySpent, que só cresce), a gravação é
--      ignorada em silêncio (o app não recebe erro; no próximo carregamento
--      ele adota o estado do servidor, que está à frente).
--   2) Histórico: no máximo 1 snapshot por hora do estado anterior, guardando
--      os últimos 48 — dá para restaurar manualmente se algo der errado.
--
--  Não muda app_bootstrap(). Aplicar depois de 0045_day_starts_at_5am.sql.
-- ============================================================================

create table if not exists public.idle_state_history (
  id       bigint generated always as identity primary key,
  user_id  uuid        not null references auth.users (id) on delete cascade,
  state    jsonb       not null,
  saved_at timestamptz not null default now()
);

create index if not exists idle_state_history_user_idx
  on public.idle_state_history (user_id, saved_at desc);

alter table public.idle_state_history enable row level security;

drop policy if exists "idle_state_history: select own" on public.idle_state_history;
create policy "idle_state_history: select own" on public.idle_state_history
  for select using (auth.uid() = user_id);

create or replace function public.idle_state_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_spent numeric;
  new_spent numeric;
begin
  old_spent := case when jsonb_typeof(old.state -> 'energySpent') = 'number'
                    then (old.state ->> 'energySpent')::numeric else 0 end;
  new_spent := case when jsonb_typeof(new.state -> 'energySpent') = 'number'
                    then (new.state ->> 'energySpent')::numeric else 0 end;

  -- menos progresso que o salvo: ignora a gravação (não dá erro)
  if new_spent < old_spent then
    return null;
  end if;

  -- snapshot horário do estado anterior (guarda os 48 mais recentes)
  if old_spent > 0 and not exists (
    select 1 from public.idle_state_history h
    where h.user_id = old.user_id and h.saved_at > now() - interval '1 hour'
  ) then
    insert into public.idle_state_history (user_id, state) values (old.user_id, old.state);
    delete from public.idle_state_history
    where user_id = old.user_id
      and id not in (
        select id from public.idle_state_history
        where user_id = old.user_id
        order by saved_at desc
        limit 48
      );
  end if;

  return new;
end;
$$;

revoke all on function public.idle_state_guard() from public;

drop trigger if exists idle_state_guard on public.idle_state;
create trigger idle_state_guard
  before update on public.idle_state
  for each row execute function public.idle_state_guard();
