-- ============================================================================
--  PROJECT 90 — Ler a Bíblia vira hábito fixo
--
--  `ler_biblia` (pilar Mente) entra como 8º hábito fixo. Marcado à mão como
--  qualquer outro hábito.
--
--  Nova conquista: "Palavra diária" (30× "Ler a Bíblia") — calculada no
--  cliente (js/store.js computeAchievementProgress: countForKey('ler_biblia')).
--
--  Aplicar depois de 0005_reset_progress.sql.
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
      -- id ,  core_key         ,  pilar   ,  nome                  ,  freq                      ,  meta        ,  achievement
      (101, 'acordar_cedo',    'Corpo', 'Acordar cedo',        '[0,1,2,3,4,5,6]'::jsonb, ''),      -- Madrugador
      (102, 'exercitar',       'Corpo', 'Exercitar-se',        '[0,1,2,3,4,5,6]'::jsonb, '30 min'), -- Atleta
      (103, 'ler',             'Mente', 'Ler',                 '[0,1,2,3,4,5,6]'::jsonb, '20 min'), -- Leitor voraz
      (104, 'meditar',         'Mente', 'Meditar / refletir',  '[0,1,2,3,4,5,6]'::jsonb, '10 min'), -- Mente zen
      (105, 'sem_redes',       'Mente', 'Sem redes sociais',   '[0,1,2,3,4,5,6]'::jsonb, ''),      -- Desintoxicado
      (106, 'beber_agua',      'Corpo', 'Beber água',          '[0,1,2,3,4,5,6]'::jsonb, '2 L'),   -- Hidratação
      (107, 'escrever_diario', 'Mente', 'Escrever no diário',  '[0,1,2,3,4,5,6]'::jsonb, ''),      -- Escritor diário
      (108, 'ler_biblia',      'Mente', 'Ler a Bíblia',        '[0,1,2,3,4,5,6]'::jsonb, '')       -- Palavra diária
  ) as c(id, key, pillar, name, freq, goal)
  where not exists (
    select 1 from public.habits h where h.user_id = p_user and h.core_key = c.key
  );
end;
$$;

-- ============================================================================
--  BACKFILL — semeia ler_biblia p/ quem já existe; poda hábitos fixos fora
--  da lista
-- ============================================================================
delete from public.habits
where core_key is not null
  and core_key <> all (array[
    'acordar_cedo','exercitar','ler','meditar','sem_redes','beber_agua','escrever_diario','ler_biblia'
  ]::text[]);

do $$
declare u uuid;
begin
  for u in select id from auth.users loop
    perform public.seed_core_habits(u);
  end loop;
end $$;
