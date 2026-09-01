# Project 90 — Supabase

Backend do app: Postgres + Auth do Supabase. O front continua 100% estático
(sem build), agora falando com o Supabase pelo `@supabase/supabase-js` (UMD via CDN).

## 1. Criar o projeto

1. https://supabase.com → **New project**.
2. Guarde a senha do banco.

## 2. Aplicar o schema

**Opção A — painel (mais rápido):**
Dashboard → **SQL Editor** → **New query** → cole todo o
`supabase/migrations/0001_init.sql` → **Run**.

**Opção B — CLI:**
```bash
supabase link --project-ref SEU_REF
supabase db push
```

O script cria:

| Objeto | O quê |
| --- | --- |
| `profiles` | 1 linha por usuário (nome, avatar, email) |
| `challenge_meta` | data de início + duração (dia atual é calculado) |
| `habits` | hábitos; `freq` e `history` como `jsonb` |
| `journal_entries` | 1 entrada por dia do desafio |
| `achievements` | estado de desbloqueio por conquista |
| `water_config` / `water_logs` | widget de hidratação |
| **RLS** | ligado em tudo — cada usuário só vê as próprias linhas |
| `handle_new_user()` | trigger em `auth.users`: cria profile + meta + water_config |
| `challenge_day()` | dia atual do desafio (1-based, limitado ao total) |
| `set_habit_status(habit_id, day_index, status)` | marca um dia e recalcula `streak`/`max_streak` |
| `unlock_achievement(id, day)` / `mark_achievement_seen(id)` | conquistas |
| `add_water(delta)` / `reset_water()` | copos de água do dia |
| `app_bootstrap()` | devolve todo o estado do usuário num JSON só (usado no load) |

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
dashboard. Um usuário novo começa **sem hábitos** e no **dia 1**.

## Como o front usa isso

- `js/supabase.js` cria `window.sb`.
- `js/store.js` mantém a API síncrona de sempre (`Store.getHabits()`, etc.):
  - no load, hidrata um cache a partir de `localStorage['p90_cache']`;
  - `Store.bootstrap()` (dispara sozinho) confere a sessão — **sem sessão → redireciona para `login.html`** — e recarrega tudo via `app_bootstrap()`;
  - ao terminar, emite `window` `'p90:synced'` e cada página re-renderiza;
  - todo `save*` grava no cache na hora e envia pro Supabase em segundo plano (fila serializada, com espelho offline).
- O link **“← Sair”** (`.sb-logout`) agora faz `signOut()` de verdade.

## Pendências conhecidas

- O widget de **água** nas páginas ainda lê/grava em `localStorage`
  (`p90_water_*`). As tabelas e funções (`water_config`, `water_logs`,
  `add_water`, `reset_water`) e os helpers `Store.getWater*/setWater*` já
  existem — falta só trocar as chamadas nas páginas.
- `Store.js` (raiz, com S maiúsculo) é a versão **antiga** só-localStorage e
  não é usada por nenhuma página (todas carregam `js/store.js`). Pode apagar.
