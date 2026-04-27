# Fase 0 — Fundação (Yide Digital) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a base do sistema rodando em produção com login, RBAC, layout, tema claro/escuro e CRUD completo de Colaboradores. Após esta fase, a Yide Digital pode logar, gerenciar a equipe e ver o sistema "vivo" (mesmo sem features de cliente ainda).

**Architecture:** Next.js 15 App Router (Server Components + Server Actions) + Supabase (Postgres + Auth + Row Level Security). Tema/marca via Tailwind CSS variables. Tudo deployado em Vercel com CI no GitHub Actions. TDD para regras de RBAC e server actions; testes E2E (Playwright) para fluxos críticos de auth.

**Tech Stack:** Next.js 15, TypeScript, Tailwind, shadcn/ui, lucide-react, next-themes, Supabase JS v2, Zod, Vitest, Playwright, Resend (apenas envio de convite), Vercel.

**Spec de referência:** [docs/superpowers/specs/2026-04-26-sistema-acompanhamento-design.md](../specs/2026-04-26-sistema-acompanhamento-design.md)

---

## Estrutura de arquivos (final da Fase 0)

```
/
├── .env.local                          # vars locais (não comitar)
├── .env.example                        # template
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── README.md
├── public/
│   └── brand/
│       ├── logo.svg                    # logo Yide completo
│       ├── mark.svg                    # só o símbolo "Y"
│       └── favicon.svg
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # root layout + ThemeProvider
│   │   ├── page.tsx                    # redirect logic
│   │   ├── globals.css                 # tailwind + CSS vars
│   │   ├── (auth)/
│   │   │   ├── layout.tsx              # layout sem sidebar (login etc.)
│   │   │   ├── login/page.tsx
│   │   │   ├── recuperar-senha/page.tsx
│   │   │   └── definir-senha/page.tsx  # pós-convite
│   │   ├── (authed)/
│   │   │   ├── layout.tsx              # sidebar + topbar
│   │   │   ├── page.tsx                # dashboard placeholder
│   │   │   ├── configuracoes/page.tsx
│   │   │   └── colaboradores/
│   │   │       ├── page.tsx
│   │   │       ├── novo/page.tsx
│   │   │       └── [id]/
│   │   │           ├── page.tsx
│   │   │           └── editar/page.tsx
│   │   └── auth/callback/route.ts      # Supabase auth callback
│   ├── components/
│   │   ├── ui/                          # shadcn components (button, input, etc.)
│   │   ├── brand/
│   │   │   ├── BrandMark.tsx
│   │   │   └── BrandWordmark.tsx
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SidebarItem.tsx
│   │   │   ├── TopBar.tsx
│   │   │   ├── ThemeToggle.tsx
│   │   │   └── UserMenu.tsx
│   │   └── colaboradores/
│   │       ├── ColaboradoresTable.tsx
│   │       ├── ColaboradorForm.tsx
│   │       └── ConviteForm.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── service-role.ts          # client com service_role pra invites
│   │   ├── auth/
│   │   │   ├── actions.ts               # signin, signout, recuperar
│   │   │   ├── permissions.ts           # canAccess(role, action)
│   │   │   └── session.ts               # getCurrentUser, requireAuth
│   │   ├── colaboradores/
│   │   │   ├── actions.ts               # invite, edit, deactivate
│   │   │   ├── queries.ts               # list, getById
│   │   │   └── schema.ts                # zod schemas
│   │   ├── audit/
│   │   │   └── log.ts                   # registrar audit_log
│   │   └── env.ts                       # zod-validated env vars
│   ├── middleware.ts                    # auth middleware
│   └── types/
│       └── database.ts                  # gerado pelo Supabase CLI
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20260426000001_organizations.sql
│   │   ├── 20260426000002_profiles.sql
│   │   ├── 20260426000003_profile_trigger.sql
│   │   ├── 20260426000004_profiles_rls.sql
│   │   ├── 20260426000005_audit_log.sql
│   │   └── 20260426000006_audit_log_rls.sql
│   └── seed.sql
├── tests/
│   ├── unit/
│   │   ├── permissions.test.ts
│   │   └── env.test.ts
│   ├── integration/
│   │   └── colaboradores.test.ts
│   └── e2e/
│       ├── login.spec.ts
│       └── colaborador-flow.spec.ts
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Bloco A — Bootstrap do projeto

### Task A1: Inicializar repositório git + Next.js

**Files:**
- Create: `/Users/yasminmonteiro/Documents/Sistema Acompanhamento/`

- [ ] **Step A1.1: Inicializar git no diretório**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
git init -b main
```

- [ ] **Step A1.2: Criar projeto Next.js dentro do diretório atual**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Quando perguntar "directory not empty, override?" responder `y`. Os arquivos `.claude/`, `.serena/`, `docs/` e `public/brand/` que já existem devem ser preservados — verificar depois.

- [ ] **Step A1.3: Verificar arquivos preservados**

```bash
ls -la docs/superpowers/specs/ public/brand/
```

Expected: ambos existem com seus conteúdos prévios.

- [ ] **Step A1.4: Ajustar `.gitignore`**

Adicionar ao final de `.gitignore`:

```
# project-specific
.superpowers/
.serena/
.env.local
.vercel

# Supabase
supabase/.branches
supabase/.temp
```

- [ ] **Step A1.5: Primeiro commit**

```bash
git add -A
git commit -m "chore: bootstrap Next.js 15 project with TypeScript and Tailwind"
```

---

### Task A2: Instalar dependências do projeto

**Files:**
- Modify: `package.json`

- [ ] **Step A2.1: Instalar dependências de runtime**

```bash
npm install @supabase/supabase-js @supabase/ssr next-themes lucide-react zod resend date-fns
```

- [ ] **Step A2.2: Instalar dependências de dev (testes)**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @playwright/test
npm install -D supabase
```

- [ ] **Step A2.3: Adicionar scripts ao `package.json`**

Em `package.json`, na seção `"scripts"`, garantir que existe:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/types/database.ts",
    "db:diff": "supabase db diff",
    "db:push": "supabase db push"
  }
}
```

- [ ] **Step A2.4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install runtime and dev dependencies"
```

---

### Task A3: Configurar shadcn/ui

**Files:**
- Create: `components.json`
- Create: `src/components/ui/*` (button, input, label, dialog, etc.)
- Modify: `src/app/globals.css`

- [ ] **Step A3.1: Inicializar shadcn**

```bash
npx shadcn@latest init -d
```

Quando perguntar:
- Style: `Default`
- Base color: `Neutral`
- CSS variables: `yes`

- [ ] **Step A3.2: Adicionar componentes essenciais da Fase 0**

```bash
npx shadcn@latest add button input label dialog dropdown-menu avatar badge form select toast separator switch table card alert
```

- [ ] **Step A3.3: Commit**

```bash
git add -A
git commit -m "chore: setup shadcn/ui with base components"
```

---

### Task A4: Configurar Tailwind com paleta da marca Yide

**Files:**
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

- [ ] **Step A4.1: Substituir variáveis de tema em `globals.css`**

Reescrever `src/app/globals.css` (preservando a diretiva `@tailwind` no topo):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 4%;

    --card: 0 0% 100%;
    --card-foreground: 240 10% 4%;

    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 4%;

    /* Yide brand teal */
    --primary: 176 53% 51%;          /* #3DC4BC */
    --primary-foreground: 0 0% 100%;

    --secondary: 220 14% 96%;
    --secondary-foreground: 240 10% 4%;

    --muted: 220 14% 96%;
    --muted-foreground: 215 16% 47%;

    --accent: 176 53% 51%;
    --accent-foreground: 0 0% 100%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --success: 160 84% 39%;
    --warning: 38 92% 50%;

    --border: 220 13% 91%;
    --input: 220 13% 91%;
    --ring: 176 53% 51%;

    --radius: 14px;
  }

  .dark {
    --background: 240 10% 4%;        /* #0a0a0f */
    --foreground: 0 0% 98%;

    --card: 240 10% 6%;
    --card-foreground: 0 0% 98%;

    --popover: 240 10% 4%;
    --popover-foreground: 0 0% 98%;

    --primary: 176 60% 60%;          /* lighter teal in dark mode */
    --primary-foreground: 240 10% 4%;

    --secondary: 240 4% 12%;
    --secondary-foreground: 0 0% 98%;

    --muted: 240 4% 12%;
    --muted-foreground: 215 20% 65%;

    --accent: 176 60% 60%;
    --accent-foreground: 240 10% 4%;

    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;

    --success: 160 64% 45%;
    --warning: 38 92% 60%;

    --border: 240 4% 14%;
    --input: 240 4% 14%;
    --ring: 176 60% 60%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground antialiased;
    font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
  h1, h2, h3 { letter-spacing: -0.02em; }
}
```

- [ ] **Step A4.2: Adicionar fonte Inter no layout root**

Editar `src/app/layout.tsx`. No topo, adicionar:

```tsx
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata = {
  title: "Yide Digital",
  description: "Sistema de acompanhamento da Yide Digital",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step A4.3: Verificar build**

```bash
npm run build
```

Expected: build completes sem erro.

- [ ] **Step A4.4: Commit**

```bash
git add -A
git commit -m "feat: setup Yide brand palette and Inter font in Tailwind"
```

---

## Bloco B — Setup do Supabase

### Task B1: Criar projeto Supabase + variáveis de ambiente

**Files:**
- Create: `.env.local`, `.env.example`
- Create: `src/lib/env.ts`

- [ ] **Step B1.1: Criar projeto no Supabase Cloud**

Manualmente:
1. Acessar https://supabase.com/dashboard
2. New Project → nome `yide-acompanha`, região `sa-east-1` (São Paulo), gerar senha forte e salvar
3. Aguardar provisionamento
4. Em Settings → API: copiar `URL`, `anon public key` e `service_role key`

- [ ] **Step B1.2: Criar `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_ID=

RESEND_API_KEY=
RESEND_FROM=Yide Acompanha <noreply@SEUDOMINIO.com>

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step B1.3: Criar `.env.local` com os valores reais**

Mesmas chaves, com os valores copiados do dashboard. **Não commitar.**

- [ ] **Step B1.4: Criar validação de env com Zod em `src/lib/env.ts`**

```ts
import { z } from "zod";

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_PROJECT_ID: z.string().min(1),
  RESEND_API_KEY: z.string().min(10),
  RESEND_FROM: z.string().min(5),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

export const env = (() => {
  if (typeof window === "undefined") {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
      throw new Error("Invalid environment variables");
    }
    return parsed.data;
  } else {
    const parsed = clientSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    });
    if (!parsed.success) throw new Error("Invalid environment variables");
    return parsed.data;
  }
})();
```

- [ ] **Step B1.5: Commit**

```bash
git add .env.example src/lib/env.ts
git commit -m "feat: add env validation with Zod"
```

---

### Task B2: Criar clients do Supabase (browser, server, service role)

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/service-role.ts`

- [ ] **Step B2.1: Criar `src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

- [ ] **Step B2.2: Criar `src/lib/supabase/server.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* called from Server Component, ignore */ }
        },
      },
    },
  );
}
```

- [ ] **Step B2.3: Criar `src/lib/supabase/service-role.ts`**

```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Cliente admin com service_role. NUNCA usar fora de server actions/route handlers.
 * Não tem RLS — bypassa todas as policies. Usar só para operações privilegiadas
 * (criar usuário, etc.).
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
```

- [ ] **Step B2.4: Criar arquivo placeholder `src/types/database.ts`**

```ts
// Será substituído pelo arquivo gerado por `npm run db:types` após criar as tabelas.
export type Database = Record<string, never>;
```

- [ ] **Step B2.5: Commit**

```bash
git add -A
git commit -m "feat: add Supabase clients (browser, server, service role)"
```

---

### Task B3: Migration — tabela `organizations`

**Files:**
- Create: `supabase/migrations/20260426000001_organizations.sql`

- [ ] **Step B3.1: Criar migration**

```sql
-- supabase/migrations/20260426000001_organizations.sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  logo_url text,
  created_at timestamptz not null default now()
);

-- Estruturado para multi-tenant futuro, mas só uma linha por enquanto
insert into public.organizations (nome) values ('Yide Digital');

alter table public.organizations enable row level security;

-- Todos os usuários autenticados podem ler a única organização
create policy "authenticated can read organizations"
  on public.organizations for select
  to authenticated
  using (true);
```

- [ ] **Step B3.2: Aplicar migration localmente (Supabase CLI)**

```bash
npx supabase login
npx supabase link --project-ref $SUPABASE_PROJECT_ID
npx supabase db push
```

Expected: migration aplicada, tabela visível no dashboard.

- [ ] **Step B3.3: Commit**

```bash
git add supabase/migrations/20260426000001_organizations.sql
git commit -m "feat(db): add organizations table"
```

---

### Task B4: Migration — tabela `profiles` com enum de papéis

**Files:**
- Create: `supabase/migrations/20260426000002_profiles.sql`

- [ ] **Step B4.1: Criar migration**

```sql
-- supabase/migrations/20260426000002_profiles.sql
create type public.user_role as enum ('adm', 'socio', 'comercial', 'coordenador', 'assessor');
create type public.theme_preference as enum ('light', 'dark', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  role public.user_role not null,
  nome text not null,
  email text not null unique,
  telefone text,
  endereco text,
  pix text,
  data_nascimento date,
  data_admissao date,
  fixo_mensal numeric(12, 2) default 0 not null,
  comissao_percent numeric(5, 2) default 0 not null,
  comissao_primeiro_mes_percent numeric(5, 2) default 0 not null,
  tema_preferido public.theme_preference not null default 'system',
  ativo boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_profiles_role on public.profiles(role);
create index idx_profiles_ativo on public.profiles(ativo);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
```

- [ ] **Step B4.2: Aplicar e gerar tipos**

```bash
npx supabase db push
SUPABASE_PROJECT_ID=$(grep SUPABASE_PROJECT_ID .env.local | cut -d= -f2) npm run db:types
```

Expected: `src/types/database.ts` agora contém a tipagem da tabela `profiles`.

- [ ] **Step B4.3: Commit**

```bash
git add supabase/migrations/20260426000002_profiles.sql src/types/database.ts
git commit -m "feat(db): add profiles table with role enum and theme preference"
```

---

### Task B5: Trigger — criar profile automaticamente ao registrar user

**Files:**
- Create: `supabase/migrations/20260426000003_profile_trigger.sql`

- [ ] **Step B5.1: Criar migration com trigger**

```sql
-- supabase/migrations/20260426000003_profile_trigger.sql
create or replace function public.handle_new_user()
returns trigger as $$
declare
  org_id uuid;
  user_role public.user_role;
  user_nome text;
begin
  -- Pega a única organização (single-tenant)
  select id into org_id from public.organizations limit 1;

  -- Lê role e nome dos metadados do convite (passados em raw_user_meta_data)
  user_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::public.user_role,
    'assessor'::public.user_role
  );
  user_nome := coalesce(
    new.raw_user_meta_data ->> 'nome',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, organization_id, role, nome, email)
  values (new.id, org_id, user_role, user_nome, new.email);

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step B5.2: Aplicar**

```bash
npx supabase db push
```

- [ ] **Step B5.3: Commit**

```bash
git add supabase/migrations/20260426000003_profile_trigger.sql
git commit -m "feat(db): auto-create profile on new auth user"
```

---

### Task B6: Migration — RLS policies de `profiles`

**Files:**
- Create: `supabase/migrations/20260426000004_profiles_rls.sql`

- [ ] **Step B6.1: Criar migration de RLS**

```sql
-- supabase/migrations/20260426000004_profiles_rls.sql
alter table public.profiles enable row level security;

-- Helper function: pega role do usuário logado
create or replace function public.current_user_role()
returns public.user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- 1. Qualquer autenticado vê SEU PRÓPRIO perfil
create policy "authenticated can view own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- 2. ADM e Sócio veem TODOS os perfis
create policy "adm/socio can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.current_user_role() in ('adm', 'socio'));

-- 3. Outros papéis (coord, assessor, comercial) veem perfis básicos da equipe
--    para listar (mas NÃO veem fixo, comissao_percent, pix — controlado a nível de aplicação via SELECT específico)
create policy "team members can view active colleagues basic info"
  on public.profiles for select
  to authenticated
  using (ativo = true);

-- 4. Usuário pode atualizar SEU PRÓPRIO perfil em campos não-sensíveis
--    (controle granular fica no app — RLS só permite o update da própria linha)
create policy "user can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 5. ADM e Sócio podem atualizar qualquer perfil
create policy "adm/socio can update any profile"
  on public.profiles for update
  to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

-- 6. ADM e Sócio podem inserir perfis (na prática isso vem do trigger, mas garantia)
create policy "adm/socio can insert profiles"
  on public.profiles for insert
  to authenticated
  with check (public.current_user_role() in ('adm', 'socio'));

-- Não há policy de DELETE — desativação é via flag ativo=false
```

- [ ] **Step B6.2: Aplicar**

```bash
npx supabase db push
```

- [ ] **Step B6.3: Commit**

```bash
git add supabase/migrations/20260426000004_profiles_rls.sql
git commit -m "feat(db): add RLS policies for profiles"
```

---

### Task B7: Migration — tabela `audit_log`

**Files:**
- Create: `supabase/migrations/20260426000005_audit_log.sql`
- Create: `supabase/migrations/20260426000006_audit_log_rls.sql`

- [ ] **Step B7.1: Criar migration de tabela**

```sql
-- supabase/migrations/20260426000005_audit_log.sql
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entidade text not null,           -- nome da tabela (ex: 'profiles')
  entidade_id uuid not null,
  acao text not null,                -- 'create', 'update', 'soft_delete'
  dados_antes jsonb,
  dados_depois jsonb,
  ator_id uuid references auth.users(id),
  justificativa text,
  created_at timestamptz not null default now()
);

create index idx_audit_log_entidade on public.audit_log(entidade, entidade_id);
create index idx_audit_log_ator on public.audit_log(ator_id);
create index idx_audit_log_created_at on public.audit_log(created_at desc);
```

- [ ] **Step B7.2: Criar migration de RLS**

```sql
-- supabase/migrations/20260426000006_audit_log_rls.sql
alter table public.audit_log enable row level security;

-- Apenas ADM e Sócio leem audit log
create policy "adm/socio can read audit log"
  on public.audit_log for select
  to authenticated
  using (public.current_user_role() in ('adm', 'socio'));

-- Qualquer autenticado pode inserir (server actions usam service_role então isso é defesa em profundidade)
create policy "authenticated can insert audit log"
  on public.audit_log for insert
  to authenticated
  with check (true);

-- Sem update/delete — log é imutável
```

- [ ] **Step B7.3: Aplicar e regerar tipos**

```bash
npx supabase db push
SUPABASE_PROJECT_ID=$(grep SUPABASE_PROJECT_ID .env.local | cut -d= -f2) npm run db:types
```

- [ ] **Step B7.4: Commit**

```bash
git add supabase/migrations/20260426000005_audit_log.sql supabase/migrations/20260426000006_audit_log_rls.sql src/types/database.ts
git commit -m "feat(db): add immutable audit_log table"
```

---

### Task B8: Seed — primeiro sócio (manual via dashboard)

- [ ] **Step B8.1: Criar primeiro usuário sócio no Supabase Auth**

Pelo dashboard do Supabase: **Authentication → Users → Add user → Create new user**

- Email: o email da Yasmin (ou outro sócio)
- Password: senha forte temporária
- Auto Confirm User: **yes**

- [ ] **Step B8.2: Promover esse user a sócio editando o profile**

Como o trigger criou o profile com role default `assessor`, atualizar manualmente via SQL Editor do Supabase:

```sql
update public.profiles
set role = 'socio', nome = 'Yasmin Monteiro'
where email = 'EMAIL_DA_YASMIN_AQUI';
```

- [ ] **Step B8.3: Verificar**

```sql
select id, email, role, nome from public.profiles;
```

Expected: 1 linha com role='socio'.

---

## Bloco C — Auth, sessão e permissões

### Task C1: Helpers de sessão e RBAC (com TDD)

**Files:**
- Create: `src/lib/auth/permissions.ts`
- Create: `src/lib/auth/session.ts`
- Create: `tests/unit/permissions.test.ts`

- [ ] **Step C1.1: Escrever os testes primeiro (TDD)**

Criar `tests/unit/permissions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canAccess, type Action } from "@/lib/auth/permissions";

describe("permissions.canAccess", () => {
  it("socio can do everything", () => {
    const all: Action[] = [
      "manage:users", "edit:commission_percent", "view:all_clients",
      "view:financial_consolidated", "approve:monthly_closing",
      "access:prospeccao", "edit:colaboradores",
    ];
    for (const action of all) {
      expect(canAccess("socio", action), action).toBe(true);
    }
  });

  it("adm cannot edit commission percent (only socio can)", () => {
    expect(canAccess("adm", "edit:commission_percent")).toBe(false);
  });

  it("adm can manage users", () => {
    expect(canAccess("adm", "manage:users")).toBe(true);
  });

  it("comercial can access prospeccao but not edit colaboradores", () => {
    expect(canAccess("comercial", "access:prospeccao")).toBe(true);
    expect(canAccess("comercial", "edit:colaboradores")).toBe(false);
  });

  it("coordenador and assessor cannot access prospeccao", () => {
    expect(canAccess("coordenador", "access:prospeccao")).toBe(false);
    expect(canAccess("assessor", "access:prospeccao")).toBe(false);
  });

  it("only socio can approve monthly closing", () => {
    expect(canAccess("socio", "approve:monthly_closing")).toBe(true);
    expect(canAccess("adm", "approve:monthly_closing")).toBe(false);
    expect(canAccess("coordenador", "approve:monthly_closing")).toBe(false);
  });

  it("returns false for unknown role/action combo", () => {
    // @ts-expect-error testing invalid input
    expect(canAccess("invalid", "manage:users")).toBe(false);
  });
});
```

- [ ] **Step C1.2: Configurar Vitest**

Criar `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step C1.3: Rodar testes (devem falhar)**

```bash
npm run test -- tests/unit/permissions.test.ts
```

Expected: FAIL com "cannot find module '@/lib/auth/permissions'".

- [ ] **Step C1.4: Implementar `src/lib/auth/permissions.ts`**

```ts
export type Role = "adm" | "socio" | "comercial" | "coordenador" | "assessor";

export type Action =
  // Gestão de usuários
  | "manage:users"
  | "edit:commission_percent"
  | "edit:colaboradores"
  // Visualizações
  | "view:all_clients"
  | "view:client_money_all"
  | "view:financial_consolidated"
  | "view:own_commission"
  | "view:other_commissions"
  // Onboarding / Comercial
  | "access:prospeccao"
  | "kanban:move_prospeccao_to_comercial"
  | "kanban:move_comercial_to_contrato"
  | "kanban:move_contrato_to_marco_zero"
  | "kanban:move_marco_zero_to_ativo"
  // Aprovações
  | "approve:monthly_closing"
  // Tarefas e calendário
  | "create:tasks"
  | "create:calendar_event"
  | "customize:notification_recipients"
  // Satisfação
  | "feed:satisfaction"
  // Sistema
  | "system:support";

const matrix: Record<Role, Action[]> = {
  socio: [
    "manage:users", "edit:commission_percent", "edit:colaboradores",
    "view:all_clients", "view:client_money_all", "view:financial_consolidated",
    "view:own_commission", "view:other_commissions",
    "access:prospeccao",
    "kanban:move_prospeccao_to_comercial", "kanban:move_comercial_to_contrato",
    "kanban:move_contrato_to_marco_zero", "kanban:move_marco_zero_to_ativo",
    "approve:monthly_closing",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  adm: [
    "manage:users", "edit:colaboradores",
    "view:all_clients", "view:client_money_all", "view:financial_consolidated",
    "view:own_commission", "view:other_commissions",
    "access:prospeccao",
    "kanban:move_prospeccao_to_comercial", "kanban:move_comercial_to_contrato",
    "kanban:move_contrato_to_marco_zero", "kanban:move_marco_zero_to_ativo",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "system:support",
  ],
  comercial: [
    "view:all_clients",
    "view:own_commission",
    "access:prospeccao",
    "kanban:move_prospeccao_to_comercial", "kanban:move_comercial_to_contrato",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
  ],
  coordenador: [
    "view:all_clients",
    "view:own_commission",
    "kanban:move_marco_zero_to_ativo",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  assessor: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
};

export function canAccess(role: Role | string, action: Action): boolean {
  const allowed = matrix[role as Role];
  if (!allowed) return false;
  return allowed.includes(action);
}
```

- [ ] **Step C1.5: Rodar testes (devem passar)**

```bash
npm run test -- tests/unit/permissions.test.ts
```

Expected: PASS, 7 testes verdes.

- [ ] **Step C1.6: Implementar `src/lib/auth/session.ts`**

```ts
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role, Action } from "@/lib/auth/permissions";
import { canAccess } from "@/lib/auth/permissions";

export type CurrentUser = {
  id: string;
  email: string;
  role: Role;
  nome: string;
  ativo: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, nome, ativo")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.ativo) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role as Role,
    nome: profile.nome,
    ativo: profile.ativo,
  };
}

export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(action: Action): Promise<CurrentUser> {
  const user = await requireAuth();
  if (!canAccess(user.role, action)) {
    redirect("/?error=forbidden");
  }
  return user;
}
```

- [ ] **Step C1.7: Commit**

```bash
git add src/lib/auth/ tests/unit/permissions.test.ts vitest.config.ts
git commit -m "feat(auth): RBAC permissions matrix and session helpers"
```

---

### Task C2: Middleware de auth do Next.js

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step C2.1: Criar middleware**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/definir-senha", "/auth/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon|public|.*\\.svg|.*\\.png).*)"],
};
```

- [ ] **Step C2.2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(auth): add Supabase auth middleware"
```

---

### Task C3: Server actions de auth (signin, signout, recuperar)

**Files:**
- Create: `src/lib/auth/actions.ts`

- [ ] **Step C3.1: Criar server actions**

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { z } from "zod";

const signinSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres"),
});

export async function signinAction(formData: FormData) {
  const parsed = signinSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "Email ou senha incorretos" };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = formData.get("email") as string;
  if (!email || !email.includes("@")) {
    return { error: "Email inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/definir-senha`,
  });

  if (error) {
    return { error: "Não foi possível enviar o email de recuperação" };
  }

  return { success: "Se esse email estiver cadastrado, você receberá um link em alguns minutos." };
}

const setPasswordSchema = z.object({
  password: z.string().min(8, "Senha precisa ter ao menos 8 caracteres"),
});

export async function setPasswordAction(formData: FormData) {
  const parsed = setPasswordSchema.safeParse({
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: "Não foi possível atualizar a senha" };
  }

  revalidatePath("/", "layout");
  redirect("/");
}
```

- [ ] **Step C3.2: Criar route handler de callback**

Criar `src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
```

- [ ] **Step C3.3: Commit**

```bash
git add src/lib/auth/actions.ts src/app/auth/callback/
git commit -m "feat(auth): server actions for signin/signout/password reset"
```

---

## Bloco D — Marca, tema e layout

### Task D1: Componentes da marca Yide

**Files:**
- Create: `src/components/brand/BrandMark.tsx`
- Create: `src/components/brand/BrandWordmark.tsx`

- [ ] **Step D1.1: BrandMark (versão compacta — só o símbolo)**

```tsx
// src/components/brand/BrandMark.tsx
import Image from "next/image";

export function BrandMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <Image
      src="/brand/mark.svg"
      alt="Yide Digital"
      width={32}
      height={32}
      className={className}
      priority
    />
  );
}
```

- [ ] **Step D1.2: BrandWordmark (logo completo)**

```tsx
// src/components/brand/BrandWordmark.tsx
import Image from "next/image";

export function BrandWordmark({
  className = "h-12 w-auto",
}: { className?: string }) {
  return (
    <Image
      src="/brand/logo.svg"
      alt="Yide Digital"
      width={240}
      height={120}
      className={className}
      priority
    />
  );
}
```

- [ ] **Step D1.3: Verificar arquivos da marca**

```bash
ls -la public/brand/
```

Expected: pelo menos `logo.svg` e `mark.svg` existem. Se não, criar placeholders SVG temporários:

```bash
cat > public/brand/logo.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 120" fill="none">
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
        font-family="Inter, sans-serif" font-size="48" font-weight="700"
        fill="#3DC4BC">Yide</text>
  <text x="50%" y="80%" text-anchor="middle" font-family="Inter, sans-serif"
        font-size="18" font-weight="700" letter-spacing="4" fill="#3DC4BC">DIGITAL</text>
</svg>
EOF

cat > public/brand/mark.svg <<'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
        font-family="Inter, sans-serif" font-size="42" font-weight="800"
        fill="#3DC4BC">Y</text>
</svg>
EOF
```

(A usuária substitui pelos arquivos reais quando enviar.)

- [ ] **Step D1.4: Commit**

```bash
git add src/components/brand/ public/brand/
git commit -m "feat(brand): Yide BrandMark and BrandWordmark components"
```

---

### Task D2: ThemeProvider e ThemeToggle

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/layout/ThemeToggle.tsx`
- Create: `src/components/providers/theme-provider.tsx`

- [ ] **Step D2.1: ThemeProvider wrapper**

Criar `src/components/providers/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step D2.2: Adicionar ThemeProvider ao root layout**

Editar `src/app/layout.tsx`:

```tsx
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "Yide Digital",
  description: "Sistema de acompanhamento da Yide Digital",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step D2.3: Criar ThemeToggle**

```tsx
// src/components/layout/ThemeToggle.tsx
"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled aria-label="Tema" />;
  }

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step D2.4: Verificar visualmente**

```bash
npm run dev
```

Acessar http://localhost:3000 — deve renderizar sem erro (página inicial vazia ainda, ok).

- [ ] **Step D2.5: Commit**

```bash
git add -A
git commit -m "feat(theme): add next-themes provider and ThemeToggle"
```

---

### Task D3: Sidebar com 9 itens (filtrada por papel)

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/SidebarItem.tsx`

- [ ] **Step D3.1: Criar SidebarItem**

```tsx
// src/components/layout/SidebarItem.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface Props {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

export function SidebarItem({ href, icon: Icon, label, badge }: Props) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {typeof badge === "number" && badge > 0 && (
        <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step D3.2: Criar Sidebar com lista filtrada por papel**

```tsx
// src/components/layout/Sidebar.tsx
import {
  LayoutGrid, Users, Briefcase, KanbanSquare, ListChecks,
  DollarSign, Smile, Calendar, UserCog, Settings,
} from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { BrandMark } from "@/components/brand/BrandMark";
import type { Role } from "@/lib/auth/permissions";

const navItems = [
  { href: "/", icon: LayoutGrid, label: "Dashboard", roles: "all" },
  { href: "/clientes", icon: Users, label: "Clientes", roles: "all" },
  { href: "/prospeccao", icon: Briefcase, label: "Prospecção", roles: ["adm", "socio", "comercial"] },
  { href: "/onboarding", icon: KanbanSquare, label: "Onboarding", roles: "all" },
  { href: "/tarefas", icon: ListChecks, label: "Tarefas", roles: "all" },
  { href: "/comissoes", icon: DollarSign, label: "Comissões", roles: "all" },
  { href: "/satisfacao", icon: Smile, label: "Satisfação", roles: "all" },
  { href: "/calendario", icon: Calendar, label: "Calendário Interno", roles: "all" },
  { href: "/colaboradores", icon: UserCog, label: "Colaboradores", roles: "all" },
] as const;

export function Sidebar({ role, nome }: { role: Role; nome: string }) {
  const visible = navItems.filter(
    (item) => item.roles === "all" || item.roles.includes(role as never),
  );

  return (
    <aside className="hidden w-[210px] flex-col border-r bg-card md:flex">
      <div className="flex items-center gap-2 px-4 py-5">
        <BrandMark className="h-8 w-8" />
        <span className="text-sm font-bold tracking-tight">Yide</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visible.map((item) => (
          <SidebarItem key={item.href} href={item.href} icon={item.icon} label={item.label} />
        ))}
      </nav>

      <div className="border-t px-3 py-3">
        <SidebarItem href="/configuracoes" icon={Settings} label="Configurações" />
        <div className="mt-3 px-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">{nome}</div>
          <div className="mt-0.5 capitalize">{role}</div>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step D3.3: Verificar `cn` helper existe** (vem com shadcn)

```bash
cat src/lib/utils.ts
```

Expected: existe e exporta `cn`.

- [ ] **Step D3.4: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/SidebarItem.tsx
git commit -m "feat(layout): role-aware Sidebar with 9 nav items"
```

---

### Task D4: TopBar e UserMenu

**Files:**
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/layout/UserMenu.tsx`

- [ ] **Step D4.1: UserMenu com signout**

```tsx
// src/components/layout/UserMenu.tsx
"use client";

import { signoutAction } from "@/lib/auth/actions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";

export function UserMenu({ nome, email }: { nome: string; email: string }) {
  const initial = nome.charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="text-sm font-semibold">{nome}</div>
          <div className="text-xs font-normal text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/configuracoes" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signoutAction}>
          <button type="submit" className="w-full">
            <DropdownMenuItem className="cursor-pointer text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step D4.2: TopBar**

```tsx
// src/components/layout/TopBar.tsx
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopBar({ nome, email }: { nome: string; email: string }) {
  return (
    <header className="flex h-14 items-center justify-end gap-2 border-b bg-card px-6">
      <Button variant="ghost" size="icon" aria-label="Notificações">
        <Bell className="h-4 w-4" />
      </Button>
      <ThemeToggle />
      <UserMenu nome={nome} email={email} />
    </header>
  );
}
```

- [ ] **Step D4.3: Commit**

```bash
git add src/components/layout/TopBar.tsx src/components/layout/UserMenu.tsx
git commit -m "feat(layout): TopBar with notifications, theme toggle, user menu"
```

---

### Task D5: Layouts (auth e authed)

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(authed)/layout.tsx`
- Create: `src/app/page.tsx`

- [ ] **Step D5.1: Layout não-autenticado (login etc.)**

```tsx
// src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      {children}
    </div>
  );
}
```

- [ ] **Step D5.2: Layout autenticado (com sidebar)**

```tsx
// src/app/(authed)/layout.tsx
import { requireAuth } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} nome={user.nome} />
      <div className="flex flex-1 flex-col">
        <TopBar nome={user.nome} email={user.email} />
        <main className="flex-1 overflow-auto bg-muted/20 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step D5.3: Página raiz redireciona**

Substituir `src/app/page.tsx` original pelo abaixo (será o dashboard placeholder dentro de `(authed)`):

```tsx
// src/app/page.tsx -- DELETAR este arquivo se existir
```

```bash
rm -f src/app/page.tsx
```

E criar `src/app/(authed)/page.tsx` (dashboard placeholder):

```tsx
// src/app/(authed)/page.tsx
import { requireAuth } from "@/lib/auth/session";

export default async function DashboardPage() {
  const user = await requireAuth();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {user.nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">
          Bem-vinda ao sistema Yide. KPIs e gráficos chegam na próxima fase.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">KPI {i}</div>
            <div className="mt-2 text-2xl font-bold">—</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step D5.4: Commit**

```bash
git add -A
git commit -m "feat(layout): auth and authed route group layouts with sidebar"
```

---

## Bloco E — Páginas de auth

### Task E1: Página de login

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step E1.1: Criar página de login**

```tsx
// src/app/(auth)/login/page.tsx
import { signinAction } from "@/lib/auth/actions";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center gap-2">
        <BrandWordmark className="h-16 w-auto" />
        <p className="text-sm text-muted-foreground">Sistema de acompanhamento</p>
      </div>

      <form action={signinAction} className="space-y-4 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full">Entrar</Button>
        <Link href="/recuperar-senha" className="block text-center text-xs text-muted-foreground hover:text-primary">
          Esqueceu a senha?
        </Link>
      </form>
    </div>
  );
}
```

- [ ] **Step E1.2: Testar manualmente o login**

```bash
npm run dev
```

Acessar http://localhost:3000/login. Logar com o sócio criado em B8. Deve redirecionar para `/` e ver o dashboard placeholder.

- [ ] **Step E1.3: Commit**

```bash
git add src/app/\(auth\)/login/
git commit -m "feat(auth): login page with Yide branding"
```

---

### Task E2: Página de recuperação de senha

**Files:**
- Create: `src/app/(auth)/recuperar-senha/page.tsx`
- Create: `src/app/(auth)/definir-senha/page.tsx`

- [ ] **Step E2.1: Página de pedir link**

```tsx
// src/app/(auth)/recuperar-senha/page.tsx
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function RecuperarSenhaPage() {
  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center"><BrandWordmark className="h-12 w-auto" /></div>
      <form action={requestPasswordResetAction} className="space-y-4 rounded-2xl border bg-card p-8 shadow-sm">
        <h2 className="text-lg font-semibold">Recuperar senha</h2>
        <p className="text-sm text-muted-foreground">
          Digite seu email e enviaremos um link para redefinir a senha.
        </p>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <Button type="submit" className="w-full">Enviar link</Button>
        <Link href="/login" className="block text-center text-xs text-muted-foreground hover:text-primary">
          Voltar para login
        </Link>
      </form>
    </div>
  );
}
```

- [ ] **Step E2.2: Página de definir nova senha (após convite ou recuperação)**

```tsx
// src/app/(auth)/definir-senha/page.tsx
import { setPasswordAction } from "@/lib/auth/actions";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DefinirSenhaPage() {
  return (
    <div className="w-full max-w-md space-y-8">
      <div className="flex flex-col items-center"><BrandWordmark className="h-12 w-auto" /></div>
      <form action={setPasswordAction} className="space-y-4 rounded-2xl border bg-card p-8 shadow-sm">
        <h2 className="text-lg font-semibold">Definir nova senha</h2>
        <p className="text-sm text-muted-foreground">Mínimo 8 caracteres.</p>
        <div className="space-y-2">
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
        </div>
        <Button type="submit" className="w-full">Salvar</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step E2.3: Configurar URL de redirect no Supabase**

No dashboard do Supabase: **Authentication → URL Configuration → Redirect URLs**, adicionar:
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/definir-senha`
- (URL de produção quando deployar)

- [ ] **Step E2.4: Commit**

```bash
git add src/app/\(auth\)/
git commit -m "feat(auth): password recovery and reset pages"
```

---

## Bloco F — Configurações e tema persistido

### Task F1: Página de configurações (perfil + tema + senha)

**Files:**
- Create: `src/app/(authed)/configuracoes/page.tsx`
- Create: `src/lib/profile/actions.ts`

- [ ] **Step F1.1: Server action para atualizar perfil**

```ts
// src/lib/profile/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const updateProfileSchema = z.object({
  nome: z.string().min(2),
  telefone: z.string().optional(),
  tema_preferido: z.enum(["light", "dark", "system"]),
});

export async function updateOwnProfileAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = updateProfileSchema.safeParse({
    nome: formData.get("nome"),
    telefone: formData.get("telefone") || undefined,
    tema_preferido: formData.get("tema_preferido"),
  });

  if (!parsed.success) return { error: "Dados inválidos" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id);

  if (error) return { error: "Não foi possível atualizar" };

  revalidatePath("/configuracoes");
  return { success: "Perfil atualizado" };
}
```

- [ ] **Step F1.2: Página `/configuracoes`**

```tsx
// src/app/(authed)/configuracoes/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { updateOwnProfileAction } from "@/lib/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";

export default async function ConfiguracoesPage() {
  const user = await requireAuth();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, telefone, tema_preferido")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu perfil e preferências.</p>
      </header>

      <Card className="p-6">
        <form action={updateOwnProfileAction} className="space-y-4">
          <h2 className="text-lg font-semibold">Perfil</h2>
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo</Label>
            <Input id="nome" name="nome" defaultValue={profile?.nome ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" name="telefone" defaultValue={profile?.telefone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tema_preferido">Tema preferido</Label>
            <Select name="tema_preferido" defaultValue={profile?.tema_preferido ?? "system"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">Seguir sistema</SelectItem>
                <SelectItem value="light">Claro</SelectItem>
                <SelectItem value="dark">Escuro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Salvar</Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="text-lg font-semibold">Senha</h2>
        <p className="text-sm text-muted-foreground">Para trocar a senha, use o link em "Esqueceu a senha" da tela de login.</p>
      </Card>
    </div>
  );
}
```

- [ ] **Step F1.3: Commit**

```bash
git add -A
git commit -m "feat(settings): profile editing page with theme preference"
```

---

## Bloco G — Colaboradores (CRUD completo)

### Task G1: Schema Zod e queries de Colaboradores

**Files:**
- Create: `src/lib/colaboradores/schema.ts`
- Create: `src/lib/colaboradores/queries.ts`

- [ ] **Step G1.1: Zod schema**

```ts
// src/lib/colaboradores/schema.ts
import { z } from "zod";

export const ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"] as const;
export type RoleEnum = typeof ROLES[number];

export const inviteSchema = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  email: z.string().email("Email inválido"),
  role: z.enum(ROLES),
  fixo_mensal: z.coerce.number().min(0).default(0),
  comissao_percent: z.coerce.number().min(0).max(100).default(0),
  comissao_primeiro_mes_percent: z.coerce.number().min(0).max(100).default(0),
});

export const editColaboradorSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(2),
  telefone: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  pix: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  data_admissao: z.string().optional().nullable(),
  fixo_mensal: z.coerce.number().min(0),
  comissao_percent: z.coerce.number().min(0).max(100),
  comissao_primeiro_mes_percent: z.coerce.number().min(0).max(100),
  role: z.enum(ROLES),
  ativo: z.coerce.boolean(),
  justificativa: z.string().optional(),
});

export type InviteInput = z.infer<typeof inviteSchema>;
export type EditColaboradorInput = z.infer<typeof editColaboradorSchema>;
```

- [ ] **Step G1.2: Queries**

```ts
// src/lib/colaboradores/queries.ts
import { createClient } from "@/lib/supabase/server";

export async function listColaboradores(filters?: { ativo?: boolean; role?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select("id, nome, email, role, ativo, fixo_mensal, comissao_percent, comissao_primeiro_mes_percent, created_at, data_admissao")
    .order("nome");

  if (typeof filters?.ativo === "boolean") query = query.eq("ativo", filters.ativo);
  if (filters?.role) query = query.eq("role", filters.role);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getColaboradorById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step G1.3: Commit**

```bash
git add src/lib/colaboradores/
git commit -m "feat(colaboradores): zod schemas and queries"
```

---

### Task G2: Helper de audit log

**Files:**
- Create: `src/lib/audit/log.ts`

- [ ] **Step G2.1: Função de log de auditoria**

```ts
// src/lib/audit/log.ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";

interface AuditEntry {
  entidade: string;
  entidade_id: string;
  acao: "create" | "update" | "soft_delete" | "approve";
  dados_antes?: Record<string, unknown>;
  dados_depois?: Record<string, unknown>;
  ator_id: string;
  justificativa?: string;
}

export async function logAudit(entry: AuditEntry) {
  const supabase = createServiceRoleClient();
  await supabase.from("audit_log").insert({
    entidade: entry.entidade,
    entidade_id: entry.entidade_id,
    acao: entry.acao,
    dados_antes: entry.dados_antes ?? null,
    dados_depois: entry.dados_depois ?? null,
    ator_id: entry.ator_id,
    justificativa: entry.justificativa ?? null,
  });
}
```

- [ ] **Step G2.2: Commit**

```bash
git add src/lib/audit/
git commit -m "feat(audit): helper to log audit entries"
```

---

### Task G3: Server action — convidar colaborador (TDD)

**Files:**
- Create: `tests/integration/colaboradores.test.ts`
- Create: `src/lib/colaboradores/actions.ts`

- [ ] **Step G3.1: Escrever teste de validação primeiro**

```ts
// tests/integration/colaboradores.test.ts
import { describe, it, expect } from "vitest";
import { inviteSchema } from "@/lib/colaboradores/schema";

describe("inviteSchema", () => {
  it("aceita convite válido com todos os campos", () => {
    const result = inviteSchema.safeParse({
      nome: "João Silva",
      email: "joao@yide.com",
      role: "assessor",
      fixo_mensal: "3000",
      comissao_percent: "5",
      comissao_primeiro_mes_percent: "0",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita email inválido", () => {
    const result = inviteSchema.safeParse({
      nome: "João Silva",
      email: "não-é-email",
      role: "assessor",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita comissão > 100%", () => {
    const result = inviteSchema.safeParse({
      nome: "João",
      email: "j@y.com",
      role: "assessor",
      comissao_percent: "150",
    });
    expect(result.success).toBe(false);
  });

  it("aceita role 'comercial'", () => {
    const result = inviteSchema.safeParse({
      nome: "Roberta",
      email: "roberta@yide.com",
      role: "comercial",
      comissao_primeiro_mes_percent: "25",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita role inválido", () => {
    const result = inviteSchema.safeParse({
      nome: "X",
      email: "x@y.com",
      role: "papel-inexistente",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step G3.2: Rodar testes (devem passar — schema já existe)**

```bash
npm run test
```

Expected: PASS, 5 testes verdes (schema já implementado em G1.1).

- [ ] **Step G3.3: Implementar server action `inviteColaborador`**

```ts
// src/lib/colaboradores/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { inviteSchema, editColaboradorSchema } from "./schema";
import { env } from "@/lib/env";

export async function inviteColaboradorAction(formData: FormData) {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:users")) {
    return { error: "Sem permissão" };
  }

  const parsed = inviteSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    role: formData.get("role"),
    fixo_mensal: formData.get("fixo_mensal"),
    comissao_percent: formData.get("comissao_percent"),
    comissao_primeiro_mes_percent: formData.get("comissao_primeiro_mes_percent"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Apenas sócio pode definir % de comissão
  if (
    (parsed.data.comissao_percent > 0 || parsed.data.comissao_primeiro_mes_percent > 0)
    && actor.role !== "socio"
  ) {
    return { error: "Apenas sócio pode definir % de comissão" };
  }

  const admin = createServiceRoleClient();

  // Convite por email — Supabase envia link de definição de senha
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
    parsed.data.email,
    {
      data: { role: parsed.data.role, nome: parsed.data.nome },
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/definir-senha`,
    },
  );

  if (inviteErr || !invited.user) {
    return { error: inviteErr?.message ?? "Falha ao enviar convite" };
  }

  // O trigger já criou o profile com role e nome via raw_user_meta_data.
  // Atualiza fixo e percentuais.
  const supabase = await createClient();
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      fixo_mensal: parsed.data.fixo_mensal,
      comissao_percent: parsed.data.comissao_percent,
      comissao_primeiro_mes_percent: parsed.data.comissao_primeiro_mes_percent,
    })
    .eq("id", invited.user.id);

  if (updateErr) {
    return { error: "Convite enviado, mas falha ao atualizar dados financeiros" };
  }

  await logAudit({
    entidade: "profiles",
    entidade_id: invited.user.id,
    acao: "create",
    dados_depois: parsed.data,
    ator_id: actor.id,
  });

  revalidatePath("/colaboradores");
  redirect("/colaboradores");
}
```

- [ ] **Step G3.4: Implementar `editColaboradorAction`**

Adicionar ao mesmo arquivo `src/lib/colaboradores/actions.ts`:

```ts
export async function editColaboradorAction(formData: FormData) {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "edit:colaboradores")) {
    return { error: "Sem permissão" };
  }

  const parsed = editColaboradorSchema.safeParse({
    id: formData.get("id"),
    nome: formData.get("nome"),
    telefone: formData.get("telefone") || null,
    endereco: formData.get("endereco") || null,
    pix: formData.get("pix") || null,
    data_nascimento: formData.get("data_nascimento") || null,
    data_admissao: formData.get("data_admissao") || null,
    fixo_mensal: formData.get("fixo_mensal"),
    comissao_percent: formData.get("comissao_percent"),
    comissao_primeiro_mes_percent: formData.get("comissao_primeiro_mes_percent"),
    role: formData.get("role"),
    ativo: formData.get("ativo") === "on",
    justificativa: formData.get("justificativa") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Sócio é o único que pode mudar % e fixo de outro usuário
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", parsed.data.id)
    .single();

  if (!before) return { error: "Colaborador não encontrado" };

  const sensitiveChanged =
    before.fixo_mensal !== parsed.data.fixo_mensal ||
    before.comissao_percent !== parsed.data.comissao_percent ||
    before.comissao_primeiro_mes_percent !== parsed.data.comissao_primeiro_mes_percent ||
    before.role !== parsed.data.role;

  if (sensitiveChanged && actor.role !== "socio") {
    return { error: "Apenas sócio pode alterar fixo, % de comissão ou papel" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      nome: parsed.data.nome,
      telefone: parsed.data.telefone,
      endereco: parsed.data.endereco,
      pix: parsed.data.pix,
      data_nascimento: parsed.data.data_nascimento,
      data_admissao: parsed.data.data_admissao,
      fixo_mensal: parsed.data.fixo_mensal,
      comissao_percent: parsed.data.comissao_percent,
      comissao_primeiro_mes_percent: parsed.data.comissao_primeiro_mes_percent,
      role: parsed.data.role,
      ativo: parsed.data.ativo,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: "Falha ao atualizar" };

  await logAudit({
    entidade: "profiles",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_antes: before,
    dados_depois: parsed.data,
    ator_id: actor.id,
    justificativa: parsed.data.justificativa,
  });

  revalidatePath("/colaboradores");
  redirect(`/colaboradores/${parsed.data.id}`);
}
```

- [ ] **Step G3.5: Commit**

```bash
git add -A
git commit -m "feat(colaboradores): invite and edit server actions with audit log"
```

---

### Task G4: Página de lista de colaboradores

**Files:**
- Create: `src/app/(authed)/colaboradores/page.tsx`
- Create: `src/components/colaboradores/ColaboradoresTable.tsx`

- [ ] **Step G4.1: Tabela**

```tsx
// src/components/colaboradores/ColaboradoresTable.tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Row {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
}

const roleLabels: Record<string, string> = {
  adm: "ADM", socio: "Sócio", comercial: "Comercial",
  coordenador: "Coordenador", assessor: "Assessor",
};

export function ColaboradoresTable({ rows, canSeeFinance }: { rows: Row[]; canSeeFinance: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          {canSeeFinance && <TableHead className="text-right">Fixo</TableHead>}
          {canSeeFinance && <TableHead className="text-right">% Comissão</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40">
            <TableCell className="font-medium">
              <Link href={`/colaboradores/${r.id}`} className="hover:underline">{r.nome}</Link>
            </TableCell>
            <TableCell><Badge variant="secondary">{roleLabels[r.role] ?? r.role}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
            <TableCell>
              {r.ativo
                ? <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">Ativo</Badge>
                : <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>}
            </TableCell>
            {canSeeFinance && (
              <TableCell className="text-right tabular-nums">
                {r.fixo_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </TableCell>
            )}
            {canSeeFinance && (
              <TableCell className="text-right tabular-nums">
                {r.role === "comercial" ? r.comissao_primeiro_mes_percent : r.comissao_percent}%
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step G4.2: Página de listagem**

```tsx
// src/app/(authed)/colaboradores/page.tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listColaboradores } from "@/lib/colaboradores/queries";
import { ColaboradoresTable } from "@/components/colaboradores/ColaboradoresTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function ColaboradoresPage() {
  const user = await requireAuth();
  const canManage = canAccess(user.role, "manage:users");
  const canSeeFinance = canAccess(user.role, "view:other_commissions");
  const rows = await listColaboradores();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Equipe ativa da Yide Digital ({rows.filter(r => r.ativo).length})</p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/colaboradores/novo"><Plus className="mr-2 h-4 w-4" />Novo colaborador</Link>
          </Button>
        )}
      </header>

      <div className="rounded-xl border bg-card">
        <ColaboradoresTable rows={rows} canSeeFinance={canSeeFinance} />
      </div>
    </div>
  );
}
```

- [ ] **Step G4.3: Commit**

```bash
git add -A
git commit -m "feat(colaboradores): list page with role-aware finance columns"
```

---

### Task G5: Página de novo colaborador (form de convite)

**Files:**
- Create: `src/app/(authed)/colaboradores/novo/page.tsx`
- Create: `src/components/colaboradores/ConviteForm.tsx`

- [ ] **Step G5.1: Form**

```tsx
// src/components/colaboradores/ConviteForm.tsx
import { inviteColaboradorAction } from "@/lib/colaboradores/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ConviteForm({ canSetCommission }: { canSetCommission: boolean }) {
  return (
    <form action={inviteColaboradorAction} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome completo</Label>
          <Input id="nome" name="nome" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Papel</Label>
          <Select name="role" required>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="adm">ADM</SelectItem>
              <SelectItem value="socio">Sócio</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="coordenador">Coordenador</SelectItem>
              <SelectItem value="assessor">Assessor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fixo_mensal">Fixo mensal (R$)</Label>
          <Input id="fixo_mensal" name="fixo_mensal" type="number" step="0.01" min="0" defaultValue="0" />
        </div>
        {canSetCommission && (
          <>
            <div className="space-y-2">
              <Label htmlFor="comissao_percent">% Comissão (assessor / coord)</Label>
              <Input id="comissao_percent" name="comissao_percent" type="number" step="0.01" min="0" max="100" defaultValue="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comissao_primeiro_mes_percent">% sobre 1º mês (comercial)</Label>
              <Input id="comissao_primeiro_mes_percent" name="comissao_primeiro_mes_percent" type="number" step="0.01" min="0" max="100" defaultValue="0" />
            </div>
          </>
        )}
      </div>
      <Button type="submit">Enviar convite</Button>
    </form>
  );
}
```

- [ ] **Step G5.2: Página**

```tsx
// src/app/(authed)/colaboradores/novo/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { ConviteForm } from "@/components/colaboradores/ConviteForm";
import { Card } from "@/components/ui/card";
import { redirect } from "next/navigation";

export default async function NovoColaboradorPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:users")) redirect("/colaboradores");
  const canSetCommission = user.role === "socio";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo colaborador</h1>
        <p className="text-sm text-muted-foreground">
          Um email de convite será enviado. O colaborador define a senha pelo link.
          {!canSetCommission && " % de comissão só pode ser editado pelo sócio."}
        </p>
      </header>
      <Card className="p-6">
        <ConviteForm canSetCommission={canSetCommission} />
      </Card>
    </div>
  );
}
```

- [ ] **Step G5.3: Commit**

```bash
git add -A
git commit -m "feat(colaboradores): invite form for new collaborator"
```

---

### Task G6: Página de visualização e edição

**Files:**
- Create: `src/app/(authed)/colaboradores/[id]/page.tsx`
- Create: `src/app/(authed)/colaboradores/[id]/editar/page.tsx`
- Create: `src/components/colaboradores/ColaboradorForm.tsx`

- [ ] **Step G6.1: View page**

```tsx
// src/app/(authed)/colaboradores/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getColaboradorById } from "@/lib/colaboradores/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

const roleLabels: Record<string, string> = {
  adm: "ADM", socio: "Sócio", comercial: "Comercial",
  coordenador: "Coordenador", assessor: "Assessor",
};

export default async function ColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const canEdit = canAccess(user.role, "edit:colaboradores");
  const canSeeFinance = canAccess(user.role, "view:other_commissions") || user.id === id;

  let colab;
  try { colab = await getColaboradorById(id); } catch { notFound(); }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{colab.nome}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{roleLabels[colab.role] ?? colab.role}</Badge>
            {colab.ativo
              ? <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">Ativo</Badge>
              : <Badge variant="outline">Inativo</Badge>}
          </div>
        </div>
        {canEdit && (
          <Button asChild variant="outline">
            <Link href={`/colaboradores/${id}/editar`}><Pencil className="mr-2 h-4 w-4" />Editar</Link>
          </Button>
        )}
      </header>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Dados pessoais</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Field label="Email" value={colab.email} />
          <Field label="Telefone" value={colab.telefone} />
          <Field label="Endereço" value={colab.endereco} className="md:col-span-2" />
          <Field label="Data de nascimento" value={colab.data_nascimento ? new Date(colab.data_nascimento).toLocaleDateString("pt-BR") : null} />
          <Field label="Data de admissão" value={colab.data_admissao ? new Date(colab.data_admissao).toLocaleDateString("pt-BR") : null} />
        </dl>
      </Card>

      {canSeeFinance && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Dados financeiros</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <Field label="Pix" value={colab.pix} />
            <Field label="Fixo mensal" value={Number(colab.fixo_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
            <Field label="% Comissão (assessor/coord)" value={`${colab.comissao_percent}%`} />
            <Field label="% Comissão 1º mês (comercial)" value={`${colab.comissao_primeiro_mes_percent}%`} />
          </dl>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value: string | null | undefined; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
```

- [ ] **Step G6.2: ColaboradorForm (edição)**

```tsx
// src/components/colaboradores/ColaboradorForm.tsx
import { editColaboradorAction } from "@/lib/colaboradores/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  data: Record<string, any>;
  canEditFinance: boolean;
  canEditRole: boolean;
}

export function ColaboradorForm({ data, canEditFinance, canEditRole }: Props) {
  return (
    <form action={editColaboradorAction} className="space-y-5">
      <input type="hidden" name="id" value={data.id} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" name="nome" defaultValue={data.nome} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" defaultValue={data.telefone ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_nascimento">Data de nascimento</Label>
          <Input id="data_nascimento" name="data_nascimento" type="date" defaultValue={data.data_nascimento ?? ""} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="endereco">Endereço</Label>
          <Input id="endereco" name="endereco" defaultValue={data.endereco ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pix">Chave Pix</Label>
          <Input id="pix" name="pix" defaultValue={data.pix ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_admissao">Data de admissão</Label>
          <Input id="data_admissao" name="data_admissao" type="date" defaultValue={data.data_admissao ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Papel</Label>
          <Select name="role" defaultValue={data.role} disabled={!canEditRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="adm">ADM</SelectItem>
              <SelectItem value="socio">Sócio</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="coordenador">Coordenador</SelectItem>
              <SelectItem value="assessor">Assessor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fixo_mensal">Fixo mensal (R$)</Label>
          <Input id="fixo_mensal" name="fixo_mensal" type="number" step="0.01" min="0"
                 defaultValue={data.fixo_mensal} disabled={!canEditFinance} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="comissao_percent">% Comissão (assessor/coord)</Label>
          <Input id="comissao_percent" name="comissao_percent" type="number" step="0.01" min="0" max="100"
                 defaultValue={data.comissao_percent} disabled={!canEditFinance} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="comissao_primeiro_mes_percent">% Comissão 1º mês (comercial)</Label>
          <Input id="comissao_primeiro_mes_percent" name="comissao_primeiro_mes_percent" type="number" step="0.01" min="0" max="100"
                 defaultValue={data.comissao_primeiro_mes_percent} disabled={!canEditFinance} />
        </div>

        <div className="flex items-center gap-3 md:col-span-2">
          <Switch id="ativo" name="ativo" defaultChecked={data.ativo} />
          <Label htmlFor="ativo">Colaborador ativo</Label>
        </div>

        {canEditFinance && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="justificativa">Justificativa (opcional, fica no histórico)</Label>
            <Input id="justificativa" name="justificativa" placeholder="Ex.: Promoção da Júlia para 8%" />
          </div>
        )}
      </div>

      <Button type="submit">Salvar alterações</Button>
    </form>
  );
}
```

- [ ] **Step G6.3: Página de edição**

```tsx
// src/app/(authed)/colaboradores/[id]/editar/page.tsx
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getColaboradorById } from "@/lib/colaboradores/queries";
import { ColaboradorForm } from "@/components/colaboradores/ColaboradorForm";
import { Card } from "@/components/ui/card";

export default async function EditColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!canAccess(user.role, "edit:colaboradores")) redirect("/colaboradores");

  let colab;
  try { colab = await getColaboradorById(id); } catch { notFound(); }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Editar {colab.nome}</h1>
      </header>
      <Card className="p-6">
        <ColaboradorForm
          data={colab}
          canEditFinance={user.role === "socio"}
          canEditRole={user.role === "socio"}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step G6.4: Commit**

```bash
git add -A
git commit -m "feat(colaboradores): view and edit pages with role-based field gating"
```

---

## Bloco H — Testes E2E e CI

### Task H1: Configurar Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/login.spec.ts`

- [ ] **Step H1.1: Inicializar Playwright**

```bash
npx playwright install chromium
```

- [ ] **Step H1.2: Config**

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step H1.3: Teste de login**

```ts
// tests/e2e/login.spec.ts
import { test, expect } from "@playwright/test";

test("redireciona para /login quando não autenticado", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});

test("mostra erro com credenciais inválidas", async ({ page }) => {
  await page.goto("/login");
  await page.fill("input[name=email]", "naoexiste@yide.com");
  await page.fill("input[name=password]", "senhaerrada123");
  await page.click("button[type=submit]");
  // O server action retorna error mas como é redirect-based, esperar permanecer em /login
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step H1.4: Rodar teste**

```bash
npm run test:e2e
```

Expected: 2 testes verdes.

- [ ] **Step H1.5: Commit**

```bash
git add playwright.config.ts tests/e2e/login.spec.ts
git commit -m "test(e2e): playwright setup with login flow tests"
```

---

### Task H2: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step H2.1: Workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          RESEND_FROM: ${{ secrets.RESEND_FROM }}
          NEXT_PUBLIC_APP_URL: http://localhost:3000
```

- [ ] **Step H2.2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, typecheck, test, build on PR and main"
```

---

### Task H3: Criar repositório remoto e fazer push

- [ ] **Step H3.1: Criar repo no GitHub**

```bash
gh repo create yide-acompanha --private --source=. --remote=origin
```

- [ ] **Step H3.2: Push inicial**

```bash
git push -u origin main
```

- [ ] **Step H3.3: Adicionar secrets do GitHub Actions**

```bash
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2)"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)"
gh secret set SUPABASE_SERVICE_ROLE_KEY --body "$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2)"
gh secret set SUPABASE_PROJECT_ID --body "$(grep SUPABASE_PROJECT_ID .env.local | cut -d= -f2)"
gh secret set RESEND_API_KEY --body "$(grep RESEND_API_KEY .env.local | cut -d= -f2)"
gh secret set RESEND_FROM --body "$(grep RESEND_FROM .env.local | cut -d= -f2)"
```

---

### Task H4: Deploy na Vercel

- [ ] **Step H4.1: Login na Vercel CLI**

```bash
npm i -g vercel
vercel login
```

- [ ] **Step H4.2: Linkar projeto**

```bash
vercel link
```

(Aceitar criar novo projeto, scope = sua conta).

- [ ] **Step H4.3: Configurar env vars na Vercel**

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_PROJECT_ID production
vercel env add RESEND_API_KEY production
vercel env add RESEND_FROM production
vercel env add NEXT_PUBLIC_APP_URL production
```

(Para `NEXT_PUBLIC_APP_URL` em production, usar a URL final do projeto na Vercel — vai aparecer após o primeiro deploy).

- [ ] **Step H4.4: Deploy**

```bash
vercel --prod
```

- [ ] **Step H4.5: Atualizar redirect URLs no Supabase Auth**

No dashboard Supabase → Auth → URL Configuration, adicionar a URL de produção:
- `https://SEU_PROJETO.vercel.app/auth/callback`
- `https://SEU_PROJETO.vercel.app/definir-senha`

E atualizar `NEXT_PUBLIC_APP_URL` na Vercel com a URL real.

- [ ] **Step H4.6: Smoke test pós-deploy**

Acessar a URL de produção, logar com o sócio, navegar pelas páginas:
- `/` (dashboard placeholder)
- `/colaboradores`
- `/colaboradores/novo` (apenas confirmar que abre — não enviar convite real ainda)
- `/configuracoes`
- Toggle de tema funciona
- Sair

---

## Self-Review

### Cobertura do spec — itens da Fase 0

| Spec | Coberto por |
|---|---|
| Stack: Next.js 15 + Supabase + Vercel | Bloco A + B |
| Tabela `organizations` | Task B3 |
| Tabela `profiles` com RBAC | Task B4 |
| Trigger auto-create profile | Task B5 |
| RLS policies em profiles | Task B6 |
| Tabela `audit_log` imutável | Task B7 |
| 5 papéis (adm, socio, comercial, coordenador, assessor) | Task C1 (matrix) + B4 (enum) |
| Auth: login, logout, recuperar | Tasks C3, E1, E2 |
| Middleware de autenticação | Task C2 |
| Tema claro/escuro com toggle por usuário | Tasks D2, F1 |
| Cor da marca Yide `#3DC4BC` | Task A4 |
| Logo na sidebar e tela de login | Tasks D1, D3, E1 |
| Sidebar com 9 itens, Prospecção visível só para Comercial/ADM/Sócio | Task D3 |
| Convite de novo colaborador via email | Task G3 |
| CRUD completo de colaboradores | Tasks G3-G6 |
| Audit log em mudanças sensíveis (% e fixo) | Tasks G2, G3 |
| RBAC server-side (canAccess) | Task C1 |
| Apenas sócio pode editar % e fixo | Tasks G3, G6 |
| Aniversário, data admissão, endereço, Pix nos cadastros | Tasks B4, G6 |
| Tipografia Inter | Task A4 |
| shadcn/ui + lucide-react | Tasks A2, A3 |
| CI no GitHub Actions | Task H2 |
| Deploy Vercel | Task H4 |

### Lacunas conhecidas (intencionais — ficam para fase 1+)

- Sub-calendário "Aniversários" alimentado por `data_nascimento` → Fase 2 (quando o calendário existir)
- Dashboard real com KPIs → Fase 6
- Páginas `/clientes`, `/prospeccao`, `/onboarding`, `/tarefas`, `/comissoes`, `/satisfacao`, `/calendario` → fases 1-6 (apenas placeholder ou 404 nesta fase, com itens da sidebar visíveis mas sem funcionalidade)

> **Nota para o engenheiro:** as 7 rotas acima da sidebar não existem em Fase 0. Como o middleware autentica TUDO, mas as páginas não estão criadas, o usuário verá 404 do Next.js. Isso é esperado e ok. Próxima fase começa criando essas rotas.

### Verificações

- ✅ Sem placeholders TBD/TODO em código
- ✅ Tipos consistentes (`Role`, `Action`, `RoleEnum`)
- ✅ Cada task tem arquivo, código completo e comando exato
- ✅ TDD aplicado em lógica de RBAC (C1) e schemas (G3)
- ✅ Auditoria registrada em mudanças sensíveis

---

## Resumo da entrega da Fase 0

Após executar tudo:
- Site no ar em `https://yide-acompanha.vercel.app` (ou similar)
- Yasmin (sócia) faz login, vê dashboard placeholder
- Cria conta de outros colaboradores com convite por email
- Edita perfil próprio e de outros (com gates de permissão por papel)
- Tema claro/escuro funcional
- Marca Yide aparece em login e sidebar
- CI rodando em cada PR
- Pronto pra começar Fase 1 (Clientes core)
