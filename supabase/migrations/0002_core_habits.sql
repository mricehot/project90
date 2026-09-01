-- ============================================================================
--  PROJECT 90 — Hábitos fixos (core habits)
--
--  Todo usuário nasce com um conjunto fixo de hábitos, organizados nos 4
--  pilares (Corpo / Mente / Produção / Conexão). Eles alimentam os
--  achievements que dependem de um hábito específico. O usuário adiciona
--  os hábitos dele por cima; os fixos não podem ser excluídos.
--
--  O vínculo com os achievements agora é por CHAVE estável (`core_key`),
--  não pelo nome exibido — então dá pra renomear um hábito fixo sem quebrar
--  as conquistas.
--
--  Aplicar depois de 0001_init.sql (SQL Editor -> Run, ou supabase db push).
-- ============================================================================

-- 1) coluna de chave estável nos hábitos ------------------------------------
alter table public.habits
  add column if not exists core_key text;

-- um hábito fixo aparece no máximo uma vez por usuário
create unique index if not exists habits_user_core_key_idx
  on public.habits (user_id, core_key)
  where core_key is not null;

-- ============================================================================
--  2) FUNÇÃO — semeia os hábitos fixos que ainda faltam para um usuário
--     (idempotente: só insere o que não existe, comparando por core_key)
--     ids fixos na faixa 101..199 para não colidir com os hábitos que o
--     usuário cria (o cliente usa max(id)+1).
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
      -- id ,  core_key             ,  pilar      ,  nome                        ,  freq                      ,  meta
      (101, 'acordar_cedo',       'Corpo',    'Acordar cedo',                 '[0,1,2,3,4,5,6]'::jsonb, ''),
      (102, 'exercitar',          'Corpo',    'Exercitar-se',                 '[0,1,2,3,4,5,6]'::jsonb, '30 min'),
      (103, 'beber_agua',         'Corpo',    'Beber água',                   '[0,1,2,3,4,5,6]'::jsonb, '2 L'),
      (104, 'dormir_bem',         'Corpo',    'Dormir bem',                   '[0,1,2,3,4,5,6]'::jsonb, '7-8 h'),
      (105, 'alimentar_bem',      'Corpo',    'Alimentar-se bem',             '[0,1,2,3,4,5,6]'::jsonb, ''),

      (106, 'ler',                'Mente',    'Ler',                          '[0,1,2,3,4,5,6]'::jsonb, '20 min'),
      (107, 'meditar',            'Mente',    'Meditar / refletir',           '[0,1,2,3,4,5,6]'::jsonb, '10 min'),
      (108, 'estudar',            'Mente',    'Estudar',                      '[0,1,2,3,4,5,6]'::jsonb, '30 min'),
      (109, 'aprender_novo',      'Mente',    'Aprender algo novo',           '[0,1,2,3,4,5,6]'::jsonb, ''),
      (110, 'sem_redes',          'Mente',    'Sem redes sociais',            '[0,1,2,3,4,5,6]'::jsonb, ''),

      (111, 'planejar_dia',       'Produção', 'Planejar o dia',               '[0,1,2,3,4,5,6]'::jsonb, ''),
      (112, 'tarefa_importante',  'Produção', 'Concluir tarefa importante',   '[0,1,2,3,4,5,6]'::jsonb, ''),
      (113, 'organizar_ambiente', 'Produção', 'Organizar o ambiente',         '[0,1,2,3,4,5,6]'::jsonb, ''),
      (114, 'cumprir_rotina',     'Produção', 'Cumprir a rotina',             '[0,1,2,3,4,5,6]'::jsonb, ''),

      (115, 'manter_contato',     'Conexão',  'Manter contato com alguém',    '[0,1,2,3,4,5,6]'::jsonb, ''),
      (116, 'ajudar_alguem',      'Conexão',  'Ajudar alguém',                '[0,1,2,3,4,5,6]'::jsonb, ''),
      (117, 'gratidao',           'Conexão',  'Praticar gratidão',            '[0,1,2,3,4,5,6]'::jsonb, '')
  ) as c(id, key, pillar, name, freq, goal)
  where not exists (
    select 1 from public.habits h
    where h.user_id = p_user and h.core_key = c.key
  );
end;
$$;

-- Não concedido a `authenticated`: só o trigger de cadastro e o backfill
-- abaixo chamam esta função (evita um usuário semear linhas para outro).

-- ============================================================================
--  3) TRIGGER de cadastro — também semeia os hábitos fixos
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
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.challenge_meta (user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.water_config (user_id) values (new.id)
  on conflict (user_id) do nothing;

  perform public.seed_core_habits(new.id);

  return new;
end;
$$;

-- ============================================================================
--  4) app_bootstrap — expõe core_key em cada hábito
-- ============================================================================
create or replace function public.app_bootstrap()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'meta', (
      select jsonb_build_object('startDate', m.start_date, 'totalDays', m.total_days)
      from public.challenge_meta m
      where m.user_id = auth.uid()
    ),
    'currentDay', public.challenge_day(),
    'habits', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id',         h.id,
                 'name',       h.name,
                 'pillar',     h.pillar,
                 'freq',       h.freq,
                 'goal',       h.goal,
                 'streak',     h.streak,
                 'maxStreak',  h.max_streak,
                 'paused',     h.paused,
                 'createdDay', h.created_day,
                 'history',    h.history,
                 'coreKey',    h.core_key
               )
               order by h.sort_order, h.id
             )
      from public.habits h
      where h.user_id = auth.uid()
    ), '[]'::jsonb),
    'journal', coalesce((
      select jsonb_object_agg(
               j.day_num::text,
               jsonb_build_object('mood', j.mood, 'good', j.good, 'improve', j.improve, 'free', j.free, 'gratitude', j.gratitude)
             )
      from public.journal_entries j
      where j.user_id = auth.uid()
    ), '{}'::jsonb),
    'achievements', coalesce((
      select jsonb_object_agg(
               a.achievement_id,
               jsonb_build_object('unlockedDay', a.unlocked_day, 'seenModal', a.seen_modal)
             )
      from public.achievements a
      where a.user_id = auth.uid()
    ), '{}'::jsonb),
    'waterConfig', (
      select jsonb_build_object('cups', w.cups, 'ml', w.ml)
      from public.water_config w
      where w.user_id = auth.uid()
    ),
    'waterToday', coalesce((
      select cups from public.water_logs
      where user_id = auth.uid() and log_date = current_date
    ), 0)
  );
$$;

-- ============================================================================
--  5) BACKFILL — semeia os hábitos fixos para quem já existe
-- ============================================================================
do $$
declare
  u uuid;
begin
  for u in select id from auth.users loop
    perform public.seed_core_habits(u);
  end loop;
end $$;
