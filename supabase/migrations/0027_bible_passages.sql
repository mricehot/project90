-- ============================================================================
--  PROJECT 90 — Passagens bíblicas marcantes (página Bíblia)
--
--  Painel lateral direito na Bíblia com as principais passagens lidas.
--  Cada uma guarda a referência (livro, capítulo, versículo), o texto e a
--  mensagem que ela passa. Só texto do usuário — nada é buscado de fora.
--
--    bible_passages — user_id, id (cliente), book, chapter, verse, text,
--                     message, created_at
--
--  Aplicar depois de 0026_reading_texts.sql.
--  (0021 continua reservada pra feature "Sistema"/RPG.)
-- ============================================================================

create table if not exists public.bible_passages (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         bigint      not null,
  book       text        not null default '',
  chapter    text        not null default '',
  verse      text        not null default '',
  text       text        not null default '',
  message    text        not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists bible_passages_user_idx on public.bible_passages (user_id);

alter table public.bible_passages enable row level security;

drop policy if exists "bible_passages: select own" on public.bible_passages;
create policy "bible_passages: select own" on public.bible_passages
  for select using (auth.uid() = user_id);
drop policy if exists "bible_passages: insert own" on public.bible_passages;
create policy "bible_passages: insert own" on public.bible_passages
  for insert with check (auth.uid() = user_id);
drop policy if exists "bible_passages: update own" on public.bible_passages;
create policy "bible_passages: update own" on public.bible_passages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "bible_passages: delete own" on public.bible_passages;
create policy "bible_passages: delete own" on public.bible_passages
  for delete using (auth.uid() = user_id);

-- ============================================================================
--  app_bootstrap() — devolve também 'biblePassages'
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
               'timezone',  m.timezone,
               'freezesLeft', m.freezes_left,
               'frozenDays',  coalesce(to_jsonb(m.frozen_days), '[]'::jsonb),
               'nightRoutineActive', coalesce(m.night_routine_active, 1)
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
               jsonb_build_object('mood', j.mood, 'good', j.good, 'improve', j.improve,
                                  'free', j.free, 'gratitude', j.gratitude,
                                  'promptReply', j.prompt_reply))
      from public.journal_entries j where j.user_id = auth.uid()
    ), '{}'::jsonb),
    'weeklyReviews', coalesce((
      select jsonb_object_agg(w.week_num::text,
               jsonb_build_object('wins', w.wins, 'friction', w.friction, 'focus', w.focus, 'score', w.score))
      from public.weekly_reviews w where w.user_id = auth.uid()
    ), '{}'::jsonb),
    'achievements', coalesce((
      select jsonb_object_agg(a.achievement_id,
               jsonb_build_object('unlockedDay', a.unlocked_day, 'seenModal', a.seen_modal))
      from public.achievements a where a.user_id = auth.uid()
    ), '{}'::jsonb),
    'vocabWords', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', v.id, 'word', v.word, 'meaning', v.meaning,
                 'example', v.example, 'createdAt', v.created_at,
                 'srsBox', v.srs_box, 'srsDue', v.srs_due, 'srsReviews', v.srs_reviews,
                 'srsLapses', v.srs_lapses, 'srsLast', v.srs_last
               ) order by v.created_at desc, v.id desc
             )
      from public.vocab_words v where v.user_id = auth.uid()
    ), '[]'::jsonb),
    'vocabQuiz', coalesce((
      select jsonb_build_object(
               'roundsPlayed', q.rounds_played, 'totalAnswered', q.total_answered,
               'totalCorrect', q.total_correct, 'bestStreak', q.best_streak
             )
      from public.vocab_quiz_stats q where q.user_id = auth.uid()
    ), jsonb_build_object('roundsPlayed', 0, 'totalAnswered', 0, 'totalCorrect', 0, 'bestStreak', 0)),
    'speechExercises', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', s.id, 'title', s.title, 'body', s.body,
                 'kind', s.kind, 'focus', s.focus, 'createdAt', s.created_at
               ) order by s.created_at desc, s.id desc
             )
      from public.speech_exercises s where s.user_id = auth.uid()
    ), '[]'::jsonb),
    'speechStats', coalesce((
      select jsonb_build_object(
               'sessionsPlayed', p.sessions_played, 'repsTotal', p.reps_total,
               'ratingSum', p.rating_sum, 'ratingCount', p.rating_count, 'bestStreak', p.best_streak
             )
      from public.speech_practice_stats p where p.user_id = auth.uid()
    ), jsonb_build_object('sessionsPlayed', 0, 'repsTotal', 0, 'ratingSum', 0, 'ratingCount', 0, 'bestStreak', 0)),
    'speechDays', coalesce((
      select jsonb_object_agg(d.day_num::text,
               jsonb_build_object('reps', d.reps, 'ratingSum', d.rating_sum,
                                  'ratingCount', d.rating_count, 'done', d.done))
      from public.speech_days d where d.user_id = auth.uid()
    ), '{}'::jsonb),
    'bibleDays', coalesce((
      select jsonb_object_agg(b.day_num::text,
               jsonb_build_object('done', b.done, 'doneDate', b.done_date))
      from public.bible_days b where b.user_id = auth.uid() and b.done
    ), '{}'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', t.id, 'title', t.title, 'notes', t.notes, 'sched', t.sched,
                 'intervalDays', t.interval_days, 'weekdays', t.weekdays, 'overdue', t.overdue,
                 'anchor', t.anchor, 'archived', t.archived, 'createdAt', t.created_at
               ) order by t.sort_order, t.id
             )
      from public.tasks t where t.user_id = auth.uid()
    ), '[]'::jsonb),
    'taskDone', coalesce((
      select jsonb_object_agg(k.task_id::text, k.dates)
      from (
        select c.task_id, jsonb_agg(c.done_date order by c.done_date) as dates
        from public.task_completions c where c.user_id = auth.uid()
        group by c.task_id
      ) k
    ), '{}'::jsonb),
    'wins', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', w.id, 'text', w.text, 'dayNum', w.day_num, 'createdAt', w.created_at
               ) order by w.created_at desc, w.id desc
             )
      from public.wins w where w.user_id = auth.uid()
    ), '[]'::jsonb),
    'streakCounters', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', s.id, 'label', s.label, 'lastSlip', s.last_slip,
                 'startDate', s.start_date, 'bestRun', s.best_run, 'createdAt', s.created_at
               ) order by s.created_at, s.id
             )
      from public.streak_counters s where s.user_id = auth.uid()
    ), '[]'::jsonb),
    'nightHabits', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', n.id, 'label', n.label,
                                  'routine', coalesce(n.routine, 1), 'createdAt', n.created_at)
               order by n.created_at, n.id
             )
      from public.night_habits n where n.user_id = auth.uid()
    ), '[]'::jsonb),
    'nightRoutineDays', coalesce((
      select jsonb_object_agg(r.day_num::text,
               jsonb_build_object('ids', r.done_ids, 'routine', coalesce(r.routine, 1)))
      from public.night_routine_days r where r.user_id = auth.uid()
    ), '{}'::jsonb),
    'studySubjects', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', s.id, 'name', s.name,
                                  'archived', s.archived, 'createdAt', s.created_at)
               order by s.sort_order, s.id
             )
      from public.study_subjects s where s.user_id = auth.uid()
    ), '[]'::jsonb),
    'studyActivities', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', a.id, 'subjectId', a.subject_id, 'title', a.title,
                                  'dueOn', a.due_on, 'status', coalesce(a.status, 'a_fazer'),
                                  'done', a.done, 'doneOn', a.done_on,
                                  'link', a.link, 'notes', a.notes,
                                  'createdAt', a.created_at)
               order by a.due_on nulls last, a.id
             )
      from public.study_activities a where a.user_id = auth.uid()
    ), '[]'::jsonb),
    'trainingExercises', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', e.id, 'split', e.split, 'name', e.name,
                                  'sets', e.sets, 'reps', e.reps, 'createdAt', e.created_at)
               order by e.split, e.sort_order, e.id
             )
      from public.training_exercises e where e.user_id = auth.uid()
    ), '[]'::jsonb),
    'trainingDays', coalesce((
      select jsonb_object_agg(t.day_num::text,
               jsonb_build_object('split', t.split, 'entries', t.entries))
      from public.training_days t where t.user_id = auth.uid()
    ), '{}'::jsonb),
    'mealItems', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', mi.id, 'label', mi.label, 'createdAt', mi.created_at)
               order by mi.sort_order, mi.id
             )
      from public.meal_items mi where mi.user_id = auth.uid()
    ), '[]'::jsonb),
    'mealDays', coalesce((
      select jsonb_object_agg(md.day_num::text, md.done_ids)
      from public.meal_days md where md.user_id = auth.uid()
    ), '{}'::jsonb),
    'bodyWeights', coalesce((
      select jsonb_object_agg(bw.day_num::text, bw.kg)
      from public.body_weights bw where bw.user_id = auth.uid()
    ), '{}'::jsonb),
    'readingTexts', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', rt.id, 'title', rt.title, 'body', rt.body,
                                  'category', rt.category, 'source', rt.source,
                                  'lastReadDay', rt.last_read_day, 'createdAt', rt.created_at)
               order by rt.created_at, rt.id
             )
      from public.reading_texts rt where rt.user_id = auth.uid()
    ), '[]'::jsonb),
    'biblePassages', coalesce((
      select jsonb_agg(
               jsonb_build_object('id', bp.id, 'book', bp.book, 'chapter', bp.chapter,
                                  'verse', bp.verse, 'text', bp.text, 'message', bp.message,
                                  'createdAt', bp.created_at)
               order by bp.created_at, bp.id
             )
      from public.bible_passages bp where bp.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;

-- ============================================================================
--  reset_progress() — apaga também as passagens bíblicas
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

  delete from public.habits                where user_id = auth.uid();
  delete from public.journal_entries       where user_id = auth.uid();
  delete from public.weekly_reviews        where user_id = auth.uid();
  delete from public.achievements          where user_id = auth.uid();
  delete from public.vocab_words           where user_id = auth.uid();
  delete from public.vocab_quiz_stats      where user_id = auth.uid();
  delete from public.speech_exercises      where user_id = auth.uid();
  delete from public.speech_practice_stats where user_id = auth.uid();
  delete from public.speech_days           where user_id = auth.uid();
  delete from public.bible_days            where user_id = auth.uid();
  delete from public.task_completions      where user_id = auth.uid();
  delete from public.tasks                 where user_id = auth.uid();
  delete from public.wins                  where user_id = auth.uid();
  delete from public.streak_counters       where user_id = auth.uid();
  delete from public.night_routine_days    where user_id = auth.uid();
  delete from public.night_habits          where user_id = auth.uid();
  delete from public.study_activities      where user_id = auth.uid();
  delete from public.study_subjects        where user_id = auth.uid();
  delete from public.training_days         where user_id = auth.uid();
  delete from public.training_exercises    where user_id = auth.uid();
  delete from public.meal_days             where user_id = auth.uid();
  delete from public.meal_items            where user_id = auth.uid();
  delete from public.body_weights          where user_id = auth.uid();
  delete from public.reading_texts         where user_id = auth.uid();
  delete from public.bible_passages        where user_id = auth.uid();

  insert into public.challenge_meta (user_id, start_date, total_days, timezone, freezes_left, frozen_days)
  values (auth.uid(), (now() at time zone tz)::date, 90, tz, 2, '{}')
  on conflict (user_id) do update
    set start_date = excluded.start_date, total_days = 90, freezes_left = 2,
        frozen_days = '{}', night_routine_active = 1;

  perform public.seed_core_habits(auth.uid());
end;
$$;

revoke all on function public.reset_progress() from public;
grant execute on function public.reset_progress() to authenticated;
