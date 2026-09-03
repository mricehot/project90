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

**Opção B — CLI:**
```bash
supabase link --project-ref SEU_REF
supabase db push
```

Os scripts criam:

| Objeto | O quê |
| --- | --- |
| `profiles` | 1 linha por usuário (nome, avatar, email) |
| `challenge_meta` | data de início + duração (dia atual é calculado) |
| `habits` | hábitos; `freq` e `history` como `jsonb`; `core_key` marca os fixos |
| **hábitos fixos** | os 8 ligados a achievements (`acordar_cedo`, `exercitar`, `ler`, `meditar`, `sem_redes`, `beber_agua`, `escrever_diario`, `ler_biblia`), semeados via `seed_core_habits()`; não podem ser excluídos (só pausados). O resto da rotina é livre. |
| `journal_entries` | 1 entrada por dia do desafio |
| `achievements` | estado de desbloqueio por conquista |
| **RLS** | ligado em tudo — cada usuário só vê as próprias linhas |
| `handle_new_user()` | trigger em `auth.users`: cria profile + meta + hábitos fixos |
| `seed_core_habits(user)` | semeia os hábitos fixos que faltam (idempotente) |
| `challenge_day()` | dia atual do desafio (1-based, limitado ao total) |
| `set_habit_status(habit_id, day_index, status)` | marca um dia e recalcula `streak`/`max_streak` |
| `unlock_achievement(id, day)` / `mark_achievement_seen(id)` | conquistas |
| `reset_progress()` | apaga hábitos + diário + conquistas do usuário, zera o `challenge_meta` e re-semeia os fixos (botão "Resetar progresso" na sidebar) |
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

## Pendências conhecidas

- **Hidratação** foi totalmente removida do app: sem widget de copos, sem card
  em Métricas, sem categoria de achievements. Sobrou só o hábito fixo comum
  `beber_agua` ("Beber água", pilar Corpo).
- **Diário** virou o hábito fixo `escrever_diario` (migration `0004`, pilar
  Mente). O histórico dele não é marcado à mão: `Store._reconcileJournalHabit()`
  deriva de `journal_entries` (dia com entrada = `'done'`) no bootstrap e a cada
  `saveJournal`/`saveJournalEntry`. Em `habitos.html` o check do hábito abre
  `diario.html`. Conquista nova: **Escritor diário** (`diary_streak`, 21 dias
  seguidos — `journalStreak` no cliente).
- `Store.js` (raiz, com S maiúsculo) é a versão **antiga** só-localStorage e
  não é usada por nenhuma página (todas carregam `js/store.js`). Pode apagar.
- **Rollover de dia** (resolvido no cliente): no bootstrap, `Store._rollForward()`
  preenche cada `habits.history` com `'miss'` até o dia atual e recalcula
  `streak`/`maxStreak` a partir do array (mesma lógica de `set_habit_status`).
  A gravação vai junto no fluxo write-through. Os toggles das páginas continuam
  mexendo no último slot (= hoje). A função SQL `set_habit_status(habit_id,
  day_index, status)` continua disponível para marcar um dia retroativo.
