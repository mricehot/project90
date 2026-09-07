# Project 90 — Supabase

Backend do app: Postgres + Auth do Supabase. O front continua 100% estático
(sem build), agora falando com o Supabase pelo `@supabase/supabase-js` (UMD via CDN).

## 1. Criar o projeto

1. https://supabase.com → **New project**.
2. Guarde a senha do banco.

## 2. Aplicar o schema

**Opção A — painel (mais rápido):**
Dashboard → **SQL Editor** → **New query** → rode os arquivos **na ordem**:
1. `supabase/migrations/0001_init.sql` → **Run**
2. `supabase/migrations/0002_core_habits.sql` → **Run**
3. `supabase/migrations/0003_water_as_habit.sql` → **Run**
4. `supabase/migrations/0004_journal_habit.sql` → **Run**
5. `supabase/migrations/0005_reset_progress.sql` → **Run**
6. `supabase/migrations/0006_bible_habit.sql` → **Run**
7. `supabase/migrations/0007_timezone.sql` → **Run**
8. `supabase/migrations/0008_weekly_review.sql` → **Run**
9. `supabase/migrations/0009_vocabulary.sql` → **Run**
10. `supabase/migrations/0010_streak_freeze.sql` → **Run**
11. `supabase/migrations/0011_speech.sql` → **Run**
12. `supabase/migrations/0012_speech_daily.sql` → **Run**
13. `supabase/migrations/0013_bible_plan.sql` → **Run**
14. `supabase/migrations/0014_tasks.sql` → **Run**
15. `supabase/migrations/0015_vocab_srs.sql` → **Run**

**Opção B — CLI:**
```bash
supabase link --project-ref SEU_REF
supabase db push
```

Os scripts criam:

| Objeto | O quê |
| --- | --- |
| `profiles` | 1 linha por usuário (nome, avatar, email) |
| `challenge_meta` | data de início + duração (dia atual é calculado); `freezes_left`/`frozen_days` (`0010`) guardam os dias de folga |
| `habits` | hábitos; `freq` e `history` como `jsonb`; `core_key` marca os fixos |
| **hábitos fixos** | os 9 ligados a achievements (`acordar_cedo`, `exercitar`, `ler`, `meditar`, `sem_redes`, `beber_agua`, `escrever_diario`, `ler_biblia`, `praticar_diccao`), semeados via `seed_core_habits()`; não podem ser excluídos (só pausados). `escrever_diario` e `praticar_diccao` têm o histórico **derivado** (diário / plano de dicção). O resto da rotina é livre. |
| `journal_entries` | 1 entrada por dia do desafio |
| `weekly_reviews` | 1 revisão por semana do desafio (`0008`): o que funcionou, o que ajustar, foco da semana seguinte, nota 1–5. Editável no `diario.html`. |
| `achievements` | estado de desbloqueio por conquista |
| `vocab_words` | palavras do vocabulário pessoal (`0009`): palavra, significado, exemplo, data. Id gerado pelo cliente, mesmo padrão de `habits.id`. Gerenciado em `vocabulario.html`. Colunas de **repetição espaçada** (`0015`): `srs_box` (caixa Leitner 1–5), `srs_due` (data da próxima revisão), `srs_reviews`, `srs_lapses`, `srs_last`. |
| `vocab_quiz_stats` | placar acumulado do jogo "Testar meu vocabulário" (`0009`): rodadas jogadas, respostas certas/totais, maior sequência de acertos. 1 linha por usuário. |
| `speech_exercises` | biblioteca de exercícios de fala/dicção (`0011`): título, texto, tipo (trava-língua/articulação/respiração/projeção/ritmo), foco. Id gerado pelo cliente. Gerenciado em `diccao.html`. |
| `speech_practice_stats` | placar acumulado das sessões de dicção (`0011`): sessões, repetições, soma/contagem das auto-avaliações 1–5, maior sequência de notas boas. 1 linha por usuário. |
| `speech_days` | progresso do **plano diário** de dicção (`0012`): 1 linha por dia do desafio com `reps`/`rating_sum`/`rating_count`/`done`. `done` marca o hábito fixo `praticar_diccao` naquele dia (histórico derivado). |
| `bible_days` | plano de leitura da Bíblia em 1 ano (`0013`): 1 linha por dia do plano marcado como lido (`day_num` 1–365, `done`, `done_date`). A lista dia→referência mora no cliente (`js/bible-plan.js`); só o que foi lido fica no banco. Começa vazio. |
| `tasks` | sistema de tarefas (`0014`): título, notas, `sched` (`once`/`everyN`/`weekdays`), `interval_days`, `weekdays` jsonb (0=Seg..6=Dom), `overdue` (`accumulate`/`skip`), `anchor` (data de vencimento p/ `once` ou data-base), `archived`. Id gerado pelo cliente. |
| `task_completions` | 1 linha por `(tarefa, data concluída)`. Sem FK para `tasks` — `deleteTask` apaga as duas. O agendamento/atraso é calculado no cliente (`Store.taskNextDue`/`taskStatus`). |
| **RLS** | ligado em tudo — cada usuário só vê as próprias linhas |
| `handle_new_user()` | trigger em `auth.users`: cria profile + meta + hábitos fixos |
| `seed_core_habits(user)` | semeia os hábitos fixos que faltam (idempotente) |
| `challenge_day()` | dia atual do desafio (1-based, limitado ao total), **no fuso do usuário** (`challenge_meta.timezone`) |
| `set_timezone(tz)` | grava o fuso do usuário; ancora `start_date` na data local se ainda no dia 1 (o cliente envia via `js/store.js` no load) |
| `set_habit_status(habit_id, day_index, status)` | marca um dia e recalcula `streak`/`max_streak` |
| `use_freeze()` | consome 1 dia de folga (de 2 por desafio) e protege a sequência do dia atual, sem exigir nenhum hábito marcado (`0010`) |
| `unlock_achievement(id, day)` / `mark_achievement_seen(id)` | conquistas |
| `reset_progress()` | apaga hábitos + diário + revisões semanais + conquistas + vocabulário + dicção + plano da Bíblia + tarefas do usuário, zera o `challenge_meta` (inclusive `freezes_left`/`frozen_days`) e re-semeia os fixos (botão "Resetar progresso" na sidebar) |
| `app_bootstrap()` | devolve todo o estado do usuário num JSON só (usado no load) |

> `0003` removeu o módulo de água dedicado (`water_config`, `water_logs`,
> `add_water`, `reset_water`). "Beber água" é apenas um hábito fixo comum
> (`beber_agua`, pilar Corpo). Não há mais categoria/feature de "Hidratação"
> no app.

## 3. Ativar o login com Google

1. Dashboard → **Authentication → Providers → Google** → habilite.
2. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   crie um **OAuth Client ID** (tipo *Web application*):
   - **Authorized redirect URI**: `https://SEU-PROJETO.supabase.co/auth/v1/callback`
3. Cole **Client ID** e **Client Secret** no provider do Supabase.
4. Dashboard → **Authentication → URL Configuration**:
   - **Site URL**: a origem onde o app roda (ex.: `http://localhost:5173`)
   - **Redirect URLs**: adicione `http://localhost:5173/dashboard.html`
     (e a URL de produção equivalente).

> O app usa fluxo **PKCE** e volta para `dashboard.html` depois do login.

## 4. Configurar o front

Edite `js/supabase-config.js` (na raiz do projeto, pasta `js/`):

```js
window.SUPABASE_URL      = "https://SEU-PROJETO.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGci...";   // Project Settings → API → anon public
```

A chave **anon** é pública por design — o acesso é barrado pelo RLS.
**Nunca** coloque a `service_role` aqui.

## 5. Rodar

Precisa ser servido por HTTP (OAuth não funciona em `file://`):

```bash
npx serve .
```

Abra `http://localhost:3000/login.html`, entre com o Google e você cai no
dashboard. Um usuário novo começa no **dia 1** com **5 hábitos fixos** (os que
alimentam achievements) e monta o resto da rotina livremente. Os 5 fixos não
podem ser excluídos, só pausados.

## Como o front usa isso

- `js/supabase.js` cria `window.sb`.
- `js/store.js` mantém a API síncrona de sempre (`Store.getHabits()`, etc.):
  - no load, hidrata um cache a partir de `localStorage['p90_cache']`;
  - `Store.bootstrap()` (dispara sozinho) confere a sessão — **sem sessão → redireciona para `login.html`** — e recarrega tudo via `app_bootstrap()`;
  - ao terminar, emite `window` `'p90:synced'` e cada página re-renderiza;
  - todo `save*` grava no cache na hora e envia pro Supabase em segundo plano (fila serializada, com espelho offline).
- O link **“← Sair”** (`.sb-logout`) agora faz `signOut()` de verdade.
- **Navegação mobile** (`js/store.js` `_wireMobileNav` + `css/components.css`):
  abaixo de 900px o `js/store.js` injeta uma barra superior com logo +
  hambúrguer em toda página (sem tocar no HTML) e a `.sidebar` vira um drawer
  lateral com backdrop; fecha ao tocar num item, no backdrop ou em `Esc`.

## Pendências conhecidas

- **Frequência dos hábitos** (`0007` + `js/store.js`): dias fora da `freq` de um
  hábito (ex.: exercício só seg–sex) não contam mais contra ele — `dayCompletionPct`,
  "dia perfeito" (`allHabitsDone`), streak do hábito (`_recalcStreak`) e streak
  geral (`currentStreak`) ignoram esses dias. Os 8 fixos são diários (`freq` = 7),
  então nada muda para eles; só afeta hábitos que o usuário deixou parciais.
- **Fuso horário** (`0007`): `challenge_day()` calcula o dia no fuso do usuário
  (`challenge_meta.timezone`, enviado pelo cliente via `set_timezone` no load).
  Enquanto o servidor não tem o valor certo, `Store.getCurrentDay()` cai no
  cálculo local do navegador.
- **Hidratação** foi totalmente removida do app: sem widget de copos, sem card
  em Métricas, sem categoria de achievements. Sobrou só o hábito fixo comum
  `beber_agua` ("Beber água", pilar Corpo).
- **Diário** virou o hábito fixo `escrever_diario` (migration `0004`, pilar
  Mente). O histórico dele não é marcado à mão: `Store._reconcileJournalHabit()`
  deriva de `journal_entries` (dia com entrada = `'done'`) no bootstrap e a cada
  `saveJournal`/`saveJournalEntry`. Em `habitos.html` o check do hábito abre
  `diario.html`. Conquista nova: **Escritor diário** (`diary_streak`, 21 dias
  seguidos — `journalStreak` no cliente).
- **Praticar dicção** virou o hábito fixo `praticar_diccao` (`0012`, pilar
  Mente), no mesmo esquema: `Store._reconcileSpeechHabit()` deriva de
  `speechDays` (dia com `done` = `'done'`) e o check em `habitos.html` abre
  `diccao.html` (ambos via `DERIVED_HABITS`).
- **Vocabulário** (`0009` + `vocabulario.html`): seção nova e independente do desafio de
  90 dias — lista de palavras (palavra/significado/exemplo/data) com CRUD completo e o
  jogo "Testar meu vocabulário" (3 alternativas, 2 erradas geradas a partir dos
  significados das outras palavras cadastradas, com um banco de significados-fallback
  genéricos para quando houver poucas palavras). Alimenta 7 conquistas novas na categoria
  "Vocabulário". O botão "Resetar progresso" também apaga o vocabulário e o placar do jogo.
- **Dicção** (`0011` + `diccao.html` + `js/speech-library.js`): seção nova e
  independente do desafio — biblioteca de exercícios de fala (CRUD + busca +
  filtro por tipo). O botão "carregar biblioteca" adiciona **~1000 exercícios**
  gerados por `window.buildSpeechLibrary()` (2/3 focados em palavras com
  **se/ce** — som /s/ no ataque; 1/3 em outros sons: R/RR, encontros
  consonantais, LH/NH, pares mínimos, CH/J, respiração/projeção/ritmo); a
  inserção é chunked (250/lote) e a lista renderiza no máximo 150 por vez.
  A prática é um **hábito diário** (`0012`): o sistema atribui automaticamente
  uma cota fixa de exercícios por dia — `Store.speechPerDay()` =
  `clamp(ceil(biblioteca / 90), 10, 20)`, o usuário não escolhe — e o "Plano
  de hoje" é uma fatia estável (permutação com semente) da biblioteca. Concluir
  o plano marca o hábito fixo `praticar_diccao` naquele dia. Cada exercício tem
  gravador de áudio opcional **só em memória** via `MediaRecorder` (nada é
  enviado, some se o navegador não suportar/permitir) e auto-avaliação 1–5.
  "Treino livre" continua existindo (5 exercícios aleatórios, não conta pro
  plano). Alimenta 9 conquistas na categoria "Dicção" (inclui planos concluídos).
  "Resetar progresso" também apaga a biblioteca, o placar e o progresso diário.
- **Toast global de conquista** (`js/achievements.js`): o catálogo de conquistas
  (nome/ícone/pontos/alvo/descrição) mora só ali agora, em `window.P90_ACHIEVEMENTS`
  — `conquistas.html` usa esse catálogo para o progresso completo e seu próprio
  modal de desbloqueio (sem mudança de comportamento). As outras 5 páginas
  carregam o mesmo arquivo e chamam `notifyNewAchievements()` a cada
  `p90:synced`: ele compara o progresso atual com o estado salvo, persiste o
  que for novo e mostra um toast clicável no canto da tela (sem duplicar o
  modal — `conquistas.html` não chama esse checador).
- **Dia de folga** (`0010` + `js/store.js`): cada desafio dá 2 folgas
  (`challenge_meta.freezes_left`, RPC `use_freeze()`). Usar uma protege o dia
  atual — `Store.currentStreak()` e o `dayStreak` interno de
  `computeAchievementProgress()` tratam dias em `frozen_days` como mantidos em
  vez de quebra, mas não contam como "dia perfeito" nem alimentam contadores
  de hábito específico. Oferecido no alerta de streak em risco do dashboard.
- **Plano da Bíblia** (`0013` + `biblia.html` + `js/bible-plan.js`): seção nova,
  independente do desafio de 90 dias. `js/bible-plan.js` tem a lista `dia →
  referência` (365 dias, transcrita das fotos do plano da Bíblia "Permaneça" da
  JesusCopy — ordem canônica, ~3 caps/dia); a `bible_days` guarda só o que já
  foi lido. `biblia.html` mostra a próxima leitura + um checklist dos 365 dias,
  progresso e sequência de dias-calendário com leitura. Não mexe no hábito fixo
  `ler_biblia` (continua marcado à mão em `habitos.html`). Começa tudo
  desmarcado. **Conferir contra o livro físico:** o dia 331 começa em
  "2Coríntios 4" (pode haver "2Co 1–3" no dia 330) e os dias 361–365
  (Apocalipse 7–22) foram acrescentados para fechar o livro.
- **Sistema de tarefas** (`0014` + `tarefas.html`): seção nova, própria. Cada
  tarefa escolhe um modo — **não repete** (com data de vencimento opcional),
  **a cada N dias** (elástico: conta da última conclusão) ou **dias da semana** —
  e uma política de atraso (**acumular** = fica atrasada até fazer · **pular** =
  só reaparece no próximo dia). Agendamento calculado no cliente
  (`Store.taskNextDue` / `taskStatus`). Integração **mista**: concluir uma tarefa
  num dia do desafio marca esse dia como "ativo" — não quebra a sequência geral
  (`Store.currentStreak`) e conta nas conquistas de dias ativos (`dayStreak` /
  `daysActive`), mas tarefa não é hábito fixo nem entra no XP por pilar.
  Categoria de conquistas "Tarefas" (1ª, 10, 50, 7 dias seguidos com tarefa).
- **Repetição espaçada no Vocabulário** (`0015` + `vocabulario.html`): cada palavra
  tem um estado Leitner (`srs_box` 1–5, `srs_due`). Ao acertar sobe uma caixa e a
  próxima revisão é adiada — 1 / 3 / 7 / 14 / 30 dias (`Store` `VOCAB_SRS_INTERVALS`);
  ao errar volta pra caixa 1 e revisa amanhã. Palavra vence quando `srs_due <= hoje`
  (`Store.vocabDueToday`). Fluxo de estudo = flashcards com autoavaliação
  ("Esqueci" / "Lembrei"), separado do jogo de múltipla escolha, que continua igual.
  `Store.reviewVocabWord(id, 'good'|'again')` grava caixa/data/contadores;
  `Store.vocabSrsStats()` resume vencidas/dominadas/revisões. 3 conquistas novas na
  categoria "Vocabulário" (1ª revisão, 100 revisões, 10 dominadas). Palavras já
  cadastradas entram na caixa 1 vencendo hoje (default das colunas — sem backfill).
- `Store.js` (raiz, com S maiúsculo) é a versão **antiga** só-localStorage e
  não é usada por nenhuma página (todas carregam `js/store.js`). Pode apagar.
- **Rollover de dia** (resolvido no cliente): no bootstrap, `Store._rollForward()`
  preenche cada `habits.history` com `'miss'` até o dia atual e recalcula
  `streak`/`maxStreak` a partir do array (mesma lógica de `set_habit_status`).
  A gravação vai junto no fluxo write-through. Os toggles das páginas continuam
  mexendo no último slot (= hoje). A função SQL `set_habit_status(habit_id,
  day_index, status)` continua disponível para marcar um dia retroativo.
