-- ============================================================================
--  PROJECT 90 — reset_progress()
--
--  Apaga TODO o progresso do usuário atual e recomeça do zero:
--    • remove hábitos, entradas de diário e conquistas
--    • zera challenge_meta (start_date = hoje, total_days = 90)
--    • re-semeia os hábitos fixos
--
--  Chamada pelo botão "Resetar progresso" na sidebar (js/store.js).
--  SECURITY DEFINER + só toca em auth.uid(), então um usuário só consegue
--  apagar os próprios dados.
--
--  Aplicar depois de 0004_journal_habit.sql.
-- ============================================================================

create or replace function public.reset_progress()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.habits          where user_id = auth.uid();
  delete from public.journal_entries where user_id = auth.uid();
  delete from public.achievements    where user_id = auth.uid();

  insert into public.challenge_meta (user_id, start_date, total_days)
  values (auth.uid(), current_date, 90)
  on conflict (user_id) do update
    set start_date = current_date, total_days = 90;

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
