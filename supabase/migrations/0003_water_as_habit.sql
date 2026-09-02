-- ============================================================================
--  PROJECT 90 — Água vira hábito fixo
--
--  O módulo de água dedicado (contador de copos) sai. "Beber água" passa a ser
--  o 6º hábito fixo (`core_key = 'beber_agua'`, pilar Corpo, meta no campo
--  objetivo). O tracking diário, streak, rollover e sync vêm de graça da
--  infra de hábitos.
--
--  Os achievements de Hidratação viram streaks do hábito `beber_agua`
--  (ver js/store.js computeAchievementProgress): daily_goal / week_hydrated /
--  hydro_month / hydro_streak. `first_glass` e `two_liters` foram removidos.
--
--  Aplicar depois de 0002_core_habits.sql.
-- ============================================================================

-- ============================================================================
--  1) seed_core_habits — agora com beber_agua (id 106)
-- ============================================================================
create or replace function public.seed_core_habits(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.habits (id, user_id, name, pillar, freq, goal, created_day, history, sort_order, core_key)
  select c.id, p_user, c.name, c.pillar, c.freq, c.goal, 1, '["miss"]'::jsonb, c.id, c.key
  from (
    values
      -- id ,  core_key        ,  pilar   ,  nome                  ,  freq                      ,  meta        ,  achievement
      (101, 'acordar_cedo', 'Corpo', 'Acordar cedo',        '[0,1,2,3,4,5,6]'::jsonb, ''),      -- Madrugador
      (102, 'exercitar',    'Corpo', 'Exercitar-se',        '[0,1,2,3,4,5,6]'::jsonb, '30 min'), -- Atleta
      (103, 'ler',          'Mente', 'Ler',                 '[0,1,2,3,4,5,6]'::jsonb, '20 min'), -- Leitor voraz
      (104, 'meditar',      'Mente', 'Meditar / refletir',  '[0,1,2,3,4,5,6]'::jsonb, '10 min'), -- Mente zen
      (105, 'sem_redes',    'Mente', 'Sem redes sociais',   '[0,1,2,3,4,5,6]'::jsonb, ''),      -- Desintoxicado
      (106, 'beber_agua',   'Corpo', 'Beber água',          '[0,1,2,3,4,5,6]'::jsonb, '2 L')    -- Hidratação
  ) as c(id, key, pillar, name, freq, goal)
  where not exists (
    select 1 from public.habits h where h.user_id = p_user and h.core_key = c.key
  );
end;
$$;

-- ============================================================================
--  2) handle_new_user — sem water_config
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.challenge_meta (user_id) values (new.id) on conflict (user_id) do nothing;
  perform public.seed_core_habits(new.id);
  return new;
end;
$$;

-- ============================================================================
--  3) app_bootstrap — sem waterConfig / waterToday
-- ============================================================================
create or replace function public.app_bootstrap()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'meta', (
      select jsonb_build_object('startDate', m.start_date, 'totalDays', m.total_days)
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
--  4) Remove o módulo de água dedicado
-- ============================================================================
drop function if exists public.add_water(integer);
drop function if exists public.reset_water();
drop table if exists public.water_logs;
drop table if exists public.water_config;

-- ============================================================================
--  5) BACKFILL — semeia beber_agua p/ quem já existe e poda hábitos fixos
--     que não estão mais na lista
-- ============================================================================
delete from public.habits
where core_key is not null
  and core_key <> all (array['acordar_cedo','exercitar','ler','meditar','sem_redes','beber_agua']::text[]);

do $$
declare u uuid;
begin
  for u in select id from auth.users loop
    perform public.seed_core_habits(u);
  end loop;
end $$;
