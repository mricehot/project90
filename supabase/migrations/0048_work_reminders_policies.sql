-- ============================================================================
--  PROJECT 90 — Trabalho › Lembretes: políticas RLS ausentes
--
--  No banco, work_reminders estava com RLS ligada e ZERO políticas (as
--  policies da 0039 não chegaram a existir), então nenhum lembrete podia ser
--  criado, lido nem apagado. Recria as quatro políticas (idempotente).
--
--  Aplicar depois de 0047_day_starts_at_midnight.sql.
-- ============================================================================

alter table public.work_reminders enable row level security;

drop policy if exists "work_reminders: select own" on public.work_reminders;
create policy "work_reminders: select own" on public.work_reminders
  for select using (auth.uid() = user_id);

drop policy if exists "work_reminders: insert own" on public.work_reminders;
create policy "work_reminders: insert own" on public.work_reminders
  for insert with check (auth.uid() = user_id);

drop policy if exists "work_reminders: update own" on public.work_reminders;
create policy "work_reminders: update own" on public.work_reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "work_reminders: delete own" on public.work_reminders;
create policy "work_reminders: delete own" on public.work_reminders
  for delete using (auth.uid() = user_id);
