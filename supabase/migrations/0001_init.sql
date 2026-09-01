-- ============================================================================
--  PROJECT 90 — Supabase schema
--  Tabelas, Row Level Security, funções e triggers.
--
--  Como aplicar:
--    a) Painel Supabase  -> SQL Editor -> cole este arquivo -> Run
--    b) CLI              -> supabase db push   (ou supabase migration up)
--
--  Tudo é idempotente (create ... if not exists / create or replace), então
--  pode ser rodado mais de uma vez sem quebrar.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
--  FUNÇÃO AUXILIAR — mantém updated_at sempre atual
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
--  profiles — 1 linha por usuário autenticado
-- ============================================================================
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================================
--  challenge_meta — data de início e duração do desafio (dia atual é calculado)
-- ============================================================================
create table if not exists public.challenge_meta (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  start_date date    not null default current_date,
  total_days integer not null default 90 check (total_days between 1 and 3650),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_challenge_meta_updated on public.challenge_meta;
create trigger trg_challenge_meta_updated
  before update on public.challenge_meta
  for each row execute function public.set_updated_at();

-- ============================================================================
--  habits — hábitos do usuário (history guardado como array jsonb)
--  id é fornecido pelo cliente (inteiro incremental por usuário), por isso a
--  PK é composta (user_id, id).
-- ============================================================================
create table if not exists public.habits (
  id          bigint  not null,
  user_id     uuid    not null references auth.users (id) on delete cascade,
  name        text    not null,
  pillar      text,
  freq        jsonb   not null default '[]'::jsonb,   -- [0..6] dias da semana
  goal        text    not null default '',
  streak      integer not null default 0,
  max_streak  integer not null default 0,
  paused      boolean not null default false,
  created_day integer not null default 1 check (created_day >= 1),
  history     jsonb   not null default '[]'::jsonb,   -- ['done'|'partial'|'miss', ...]
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id),
  constraint habits_freq_is_array    check (jsonb_typeof(freq) = 'array'),
  constraint habits_history_is_array check (jsonb_typeof(history) = 'array')
);

create index if not exists habits_user_idx on public.habits (user_id);

drop trigger if exists trg_habits_updated on public.habits;
create trigger trg_habits_updated
  before update on public.habits
  for each row execute function public.set_updated_at();

-- ============================================================================
--  journal_entries — 1 entrada por dia do desafio
-- ============================================================================
create table if not exists public.journal_entries (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  day_num    integer not null check (day_num >= 1),
  mood       text,
  good       text,
  improve    text,
  free       text,
  gratitude  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day_num)
);

drop trigger if exists trg_journal_updated on public.journal_entries;
create trigger trg_journal_updated
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- ============================================================================
--  achievements — estado de desbloqueio de cada conquista
-- ============================================================================
create table if not exists public.achievements (
  user_id        uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  unlocked_day   integer,
  seen_modal     boolean not null default false,
  unlocked_at    timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ============================================================================
--  water_config + water_logs — widget de hidratação
-- ============================================================================
create table if not exists public.water_config (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  cups       integer not null default 8   check (cups between 1 and 30),
  ml         integer not null default 250 check (ml between 50 and 2000),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_water_config_updated on public.water_config;
create trigger trg_water_config_updated
  before update on public.water_config
  for each row execute function public.set_updated_at();

create table if not exists public.water_logs (
  user_id    uuid    not null references auth.users (id) on delete cascade,
  log_date   date    not null default current_date,
  cups       integer not null default 0 check (cups >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

drop trigger if exists trg_water_logs_updated on public.water_logs;
create trigger trg_water_logs_updated
  before update on public.water_logs
  for each row execute function public.set_updated_at();

-- ============================================================================
--  ROW LEVEL SECURITY — cada usuário só enxerga as próprias linhas
-- ============================================================================
alter table public.profiles         enable row level security;
alter table public.challenge_meta   enable row level security;
alter table public.habits           enable row level security;
alter table public.journal_entries  enable row level security;
alter table public.achievements     enable row level security;
alter table public.water_config     enable row level security;
alter table public.water_logs       enable row level security;

-- profiles (dono = id)
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- macro para as demais tabelas (dono = user_id): select / insert / update / delete
do $$
declare
  t text;
begin
  foreach t in array array[
    'challenge_meta','habits','journal_entries','achievements','water_config','water_logs'
  ]
  loop
    execute format('drop policy if exists "%1$s: select own" on public.%1$I', t);
    execute format('create policy "%1$s: select own" on public.%1$I for select using (auth.uid() = user_id)', t);

    execute format('drop policy if exists "%1$s: insert own" on public.%1$I', t);
    execute format('create policy "%1$s: insert own" on public.%1$I for insert with check (auth.uid() = user_id)', t);

    execute format('drop policy if exists "%1$s: update own" on public.%1$I', t);
    execute format('create policy "%1$s: update own" on public.%1$I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);

    execute format('drop policy if exists "%1$s: delete own" on public.%1$I', t);
    execute format('create policy "%1$s: delete own" on public.%1$I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ============================================================================
--  TRIGGER — cria as linhas base quando um usuário se cadastra
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

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  FUNÇÃO — dia atual do desafio (1-based, limitado ao total de dias)
-- ============================================================================
create or replace function public.challenge_day(p_user uuid default auth.uid())
returns integer
language sql
stable
as $$
  select greatest(1, least(
           (current_date - m.start_date) + 1,
           m.total_days
         ))
  from public.challenge_meta m
  where m.user_id = p_user;
$$;

-- ============================================================================
--  FUNÇÃO — marca o status de um hábito num dia e recalcula os streaks
--    p_day_index é 0-based (0 = dia 1 do desafio), igual ao índice de history.
--    O array é preenchido com 'miss' até o índice alvo, se necessário.
--    streak     = sequência de 'done' terminando no último dia
--    max_streak = maior sequência de 'done' já registrada (nunca diminui)
-- ============================================================================
create or replace function public.set_habit_status(
  p_habit_id   bigint,
  p_day_index  integer,
  p_status     text
)
returns public.habits
language plpgsql
as $$
declare
  h    public.habits;
  arr  text[];
  i    integer;
  cur  integer := 0;
  best integer := 0;
begin
  if p_status not in ('done', 'partial', 'miss') then
    raise exception 'status inválido: % (use done | partial | miss)', p_status;
  end if;
  if p_day_index < 0 then
    raise exception 'p_day_index não pode ser negativo';
  end if;

  select * into h
  from public.habits
  where id = p_habit_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'hábito % não encontrado para o usuário atual', p_habit_id;
  end if;

  arr := array(select jsonb_array_elements_text(h.history));

  while coalesce(array_length(arr, 1), 0) < p_day_index + 1 loop
    arr := arr || 'miss';
  end loop;

  arr[p_day_index + 1] := p_status;

  for i in 1 .. array_length(arr, 1) loop
    if arr[i] = 'done' then
      cur  := cur + 1;
      best := greatest(best, cur);
    else
      cur := 0;
    end if;
  end loop;

  update public.habits
  set history    = to_jsonb(arr),
      streak     = cur,
      max_streak = greatest(best, h.max_streak)
  where id = p_habit_id and user_id = auth.uid()
  returning * into h;

  return h;
end;
$$;

-- ============================================================================
--  FUNÇÃO — desbloqueia uma conquista (retorna true se foi agora)
-- ============================================================================
create or replace function public.unlock_achievement(
  p_achievement_id text,
  p_day            integer default null
)
returns boolean
language plpgsql
as $$
declare
  affected integer;
begin
  insert into public.achievements (user_id, achievement_id, unlocked_day)
  values (auth.uid(), p_achievement_id, p_day)
  on conflict (user_id, achievement_id) do nothing;

  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

-- ============================================================================
--  FUNÇÃO — marca o modal da conquista como já visto
-- ============================================================================
create or replace function public.mark_achievement_seen(p_achievement_id text)
returns void
language sql
as $$
  update public.achievements
  set seen_modal = true
  where user_id = auth.uid() and achievement_id = p_achievement_id;
$$;

-- ============================================================================
--  FUNÇÃO — soma copos de água no dia (p_delta pode ser negativo). Retorna
--  o novo total do dia (nunca abaixo de 0).
-- ============================================================================
create or replace function public.add_water(p_delta integer default 1)
returns integer
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into public.water_logs (user_id, log_date, cups)
  values (auth.uid(), current_date, greatest(0, p_delta))
  on conflict (user_id, log_date) do update
    set cups = greatest(0, public.water_logs.cups + p_delta)
  returning cups into new_count;

  return new_count;
end;
$$;

-- ============================================================================
--  FUNÇÃO — zera os copos de água de hoje
-- ============================================================================
create or replace function public.reset_water()
returns void
language sql
as $$
  insert into public.water_logs (user_id, log_date, cups)
  values (auth.uid(), current_date, 0)
  on conflict (user_id, log_date) do update set cups = 0;
$$;

-- ============================================================================
--  FUNÇÃO — carrega todo o estado do app numa chamada só (usada no boot)
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
               'totalDays', m.total_days
             )
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
                 'history',    h.history
               )
               order by h.sort_order, h.id
             )
      from public.habits h
      where h.user_id = auth.uid()
    ), '[]'::jsonb),
    'journal', coalesce((
      select jsonb_object_agg(
               j.day_num::text,
               jsonb_build_object(
                 'mood',      j.mood,
                 'good',      j.good,
                 'improve',   j.improve,
                 'free',      j.free,
                 'gratitude', j.gratitude
               )
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
--  PERMISSÕES — as funções rodam como o usuário autenticado (RLS continua
--  valendo). Apenas garantimos o EXECUTE para a role authenticated.
-- ============================================================================
grant execute on function public.challenge_day(uuid)                      to authenticated;
grant execute on function public.set_habit_status(bigint, integer, text)  to authenticated;
grant execute on function public.unlock_achievement(text, integer)        to authenticated;
grant execute on function public.mark_achievement_seen(text)              to authenticated;
grant execute on function public.add_water(integer)                       to authenticated;
grant execute on function public.reset_water()                            to authenticated;
grant execute on function public.app_bootstrap()                          to authenticated;
