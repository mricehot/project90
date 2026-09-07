-- ============================================================================
--  PROJECT 90 — Repetição espaçada no Vocabulário (Leitner)
--
--  Cada palavra ganha um estado de revisão espaçada: caixa (1..5), data da
--  próxima revisão, contadores de revisões e de "esquecimentos". A palavra
--  reaparece para revisão quando srs_due <= hoje. Ao acertar, sobe uma caixa
--  e a próxima revisão é adiada (1 / 3 / 7 / 14 / 30 dias). Ao errar, volta
--  para a caixa 1 e revisa no dia seguinte.
--
--  Palavras já cadastradas entram na caixa 1 e vencem hoje (default das
--  colunas), então aparecem na primeira revisão sem precisar de backfill.
--
--  Aplicar depois de 0014_tasks.sql.
-- ============================================================================

alter table public.vocab_words
  add column if not exists srs_box     smallint not null default 1,
  add column if not exists srs_due     date     not null default current_date,
  add column if not exists srs_reviews integer  not null default 0,
  add column if not exists srs_lapses  integer  not null default 0,
  add column if not exists srs_last    date;

create index if not exists vocab_words_due_idx on public.vocab_words (user_id, srs_due);

-- ============================================================================
--  app_bootstrap() — vocabWords passa a devolver o estado de revisão espaçada
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
               'frozenDays',  coalesce(to_jsonb(m.frozen_days), '[]'::jsonb)
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
               jsonb_build_object('mood', j.mood, 'good', j.good, 'improve', j.improve, 'free', j.free, 'gratitude', j.gratitude))
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
    ), '{}'::jsonb)
  );
$$;
