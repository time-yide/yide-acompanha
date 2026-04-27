# Fase 6 — Notificações Completa (Yide Digital) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema completo de notificações com cron diário (Vercel Hobby), email via Resend, regras configuráveis pelo Sócio (`notification_rules`), preferências por usuário (`notification_preferences`), e integração nos 16 tipos de eventos previstos. Refatora o módulo da Fase 4 pra usar dispatcher central.

**Architecture:** Função central `dispatchNotification(args)` que consulta `notification_rules` (controle Sócio) e `notification_preferences` (controle user), resolve destinatários (roles + user_ids + extras passados pelo caller), e envia por dois canais independentes (in-app via tabela `notifications`, email via Resend). Cron diário (`/api/cron/daily-digest` chamado às 8h BRT pelo Vercel Cron) detecta eventos temporais e chama o mesmo dispatcher. Triggers nas actions existentes (tarefas Fase 4 + leads Fase 2) também chamam o dispatcher.

**Tech Stack:** Next.js 16 + Supabase + Vercel Cron (Hobby — 1 daily) + Resend (free tier 3.000/mês) + Base UI + Zod + Vitest + Playwright.

**Spec:** [docs/superpowers/specs/2026-04-27-fase-6-notificacoes-design.md](../specs/2026-04-27-fase-6-notificacoes-design.md)

**Plano anterior:** [Fase 5 — Colaboradores](2026-04-27-fase-5-colaboradores.md)

**Fora do escopo:**
- Snapshot mensal de comissão → Fase 7 (slot 2 do cron Hobby reservado)
- Cliente perto do churn (precisa IA) → Fase 8
- Notificações "1h antes" granular (cortado pelo limite Hobby) → futuro
- Push notifications mobile → futuro

**Pré-requisitos manuais (usuário faz fora do código):**
- Configurar `CRON_SECRET` no Vercel (Settings → Environment Variables) — string aleatória 32+ chars; sem isso o cron retorna 401 mas app não quebra
- (Opcional) Configurar conta Resend + verificar domínio + atualizar `RESEND_API_KEY`/`RESEND_FROM` no Vercel; emails falham silenciosamente sem isso

**Estado atual no repositório:**
- `src/lib/notificacoes/` (Fase 4): schema, queries, actions (mark read), trigger (`notifyTaskAssigned/Completed`)
- `src/components/notificacoes/`: NotificationBell, NotificationItem
- Tabela `notifications` (id, user_id, tipo, titulo, mensagem, link, lida, created_at) já existe
- `src/lib/leads/actions.ts:149` tem `moveStageAction` — vai ganhar 3 triggers nesta fase
- `src/app/(authed)/configuracoes/page.tsx` existe — vamos adicionar link pra `/configuracoes/notificacoes`

**Estrutura final esperada (delta):**

```
supabase/migrations/
├── 20260427000012_notification_rules.sql          [NEW]
├── 20260427000013_notification_preferences.sql    [NEW]
└── 20260427000014_cron_runs.sql                   [NEW]

src/
├── app/
│   ├── api/cron/daily-digest/route.ts             [NEW — endpoint cron]
│   └── (authed)/
│       ├── configuracoes/
│       │   ├── page.tsx                           [MODIFY — link p/ /notificacoes]
│       │   └── notificacoes/page.tsx              [NEW]
│
├── components/
│   └── notificacoes/
│       ├── RuleCard.tsx                           [NEW — admin view]
│       ├── PreferenceToggle.tsx                   [NEW — user view]
│       └── RecipientsSelector.tsx                 [NEW — popover]
│
├── lib/
│   ├── env.ts                                     [MODIFY — CRON_SECRET opcional]
│   ├── email/
│   │   ├── client.ts                              [NEW — Resend wrapper]
│   │   └── templates/notification.ts              [NEW]
│   ├── notificacoes/
│   │   ├── dispatch.ts                            [NEW — função central]
│   │   ├── rule-actions.ts                        [NEW — server actions]
│   │   ├── trigger.ts                             [DELETE — substituído por dispatch]
│   │   └── (schema/queries/actions existentes da Fase 4 ficam)
│   ├── cron/
│   │   ├── daily-digest.ts                        [NEW — orquestrador]
│   │   └── detectors/
│   │       ├── task-overdue.ts                    [NEW]
│   │       ├── task-prazo-amanha.ts               [NEW]
│   │       ├── evento-calendario-hoje.ts          [NEW]
│   │       ├── marco-zero-24h.ts                  [NEW]
│   │       ├── aniversario-socio-cliente.ts       [NEW]
│   │       ├── aniversario-colaborador.ts         [NEW]
│   │       ├── renovacao-contrato.ts              [NEW]
│   │       └── satisfacao-pendente.ts             [NEW — stub p/ Fase 8]
│   ├── leads/actions.ts                           [MODIFY — 3 triggers novos]
│   └── tarefas/actions.ts                         [MODIFY — usar dispatch]
│
└── types/database.ts                              [REGENERATE]

vercel.json                                        [NEW — cron config]
package.json                                       [MODIFY — +resend]

tests/
├── unit/
│   ├── notificacoes-dispatch.test.ts              [NEW — 8 cases]
│   ├── email-template.test.ts                     [NEW — 4 cases]
│   ├── cron-daily-digest.test.ts                  [NEW — 3 cases]
│   └── cron-detectors.test.ts                     [NEW — 1 case por detector]
└── e2e/
    └── notificacoes-config.spec.ts                [NEW]
```

**Total estimado:** ~14 commits.

---

## Bloco A — Migrations + Setup

### Task A1: Migration `notification_rules` + enum + seed

**Files:**
- Create: `supabase/migrations/20260427000012_notification_rules.sql`

- [ ] **Step A1.1: Escrever SQL**

```sql
-- supabase/migrations/20260427000012_notification_rules.sql
-- Enum dos 16 tipos de eventos notificáveis + tabela de regras editadas por Sócio/ADM.

create type public.notification_event as enum (
  'task_assigned',
  'task_completed',
  'kanban_moved',
  'prospeccao_agendada',
  'deal_fechado',
  'mes_aguardando_aprovacao',
  'mes_aprovado',
  'cliente_perto_churn',
  'task_prazo_amanha',
  'task_overdue',
  'evento_calendario_hoje',
  'marco_zero_24h',
  'aniversario_socio_cliente',
  'aniversario_colaborador',
  'renovacao_contrato',
  'satisfacao_pendente'
);

create table public.notification_rules (
  evento_tipo public.notification_event primary key,
  ativo boolean not null default true,
  mandatory boolean not null default false,
  email_default boolean not null default false,
  permite_destinatarios_extras boolean not null default true,
  default_roles text[] not null default array[]::text[],
  default_user_ids uuid[] not null default array[]::uuid[],
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.notification_rules enable row level security;

create policy "anyone authenticated reads rules"
  on public.notification_rules for select to authenticated using (true);

create policy "manage:users role updates rules"
  on public.notification_rules for update to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

-- Seed inicial das 16 regras
insert into public.notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles)
values
  ('task_assigned',             true, false, false, true,  array[]::text[]),
  ('task_completed',            true, false, false, true,  array[]::text[]),
  ('kanban_moved',              true, false, true,  true,  array['adm']),
  ('prospeccao_agendada',       true, false, false, true,  array['adm']),
  ('deal_fechado',              true, false, true,  false, array['adm','socio']),
  ('mes_aguardando_aprovacao',  true, true,  true,  false, array['socio']),
  ('mes_aprovado',              true, true,  true,  false, array[]::text[]),
  ('cliente_perto_churn',       true, false, true,  true,  array['socio']),
  ('task_prazo_amanha',         true, false, false, true,  array[]::text[]),
  ('task_overdue',              true, false, true,  true,  array[]::text[]),
  ('evento_calendario_hoje',    true, false, false, true,  array[]::text[]),
  ('marco_zero_24h',            true, false, true,  true,  array[]::text[]),
  ('aniversario_socio_cliente', true, false, false, true,  array['coordenador','assessor']),
  ('aniversario_colaborador',   true, false, false, true,  array['adm','socio','comercial','coordenador','assessor','videomaker','designer','editor','audiovisual_chefe']),
  ('renovacao_contrato',        true, false, true,  true,  array[]::text[]),
  ('satisfacao_pendente',       true, false, false, false, array['coordenador','assessor']);
```

- [ ] **Step A1.2: Aplicar e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push
git add supabase/migrations/20260427000012_notification_rules.sql
git commit -m "feat(db): notification_rules table with 16-event enum and seed"
```

---

### Task A2: Migration `notification_preferences`

**Files:**
- Create: `supabase/migrations/20260427000013_notification_preferences.sql`

- [ ] **Step A2.1: Escrever SQL**

```sql
-- supabase/migrations/20260427000013_notification_preferences.sql
-- Preferências individuais por (user_id, evento_tipo). Cada user gerencia o seu.

create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  evento_tipo public.notification_event not null,
  in_app boolean not null default true,
  email boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, evento_tipo)
);

alter table public.notification_preferences enable row level security;

create policy "users read own preferences"
  on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

create policy "users insert own preferences"
  on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own preferences"
  on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users delete own preferences"
  on public.notification_preferences for delete to authenticated
  using (user_id = auth.uid());
```

- [ ] **Step A2.2: Aplicar e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push
git add supabase/migrations/20260427000013_notification_preferences.sql
git commit -m "feat(db): notification_preferences table with per-user RLS"
```

---

### Task A3: Migration `cron_runs`

**Files:**
- Create: `supabase/migrations/20260427000014_cron_runs.sql`

- [ ] **Step A3.1: Escrever SQL**

```sql
-- supabase/migrations/20260427000014_cron_runs.sql
-- Idempotência do cron. PK (job_name, run_date) bloqueia re-execução no mesmo dia.

create table public.cron_runs (
  job_name text not null,
  run_date date not null,
  ran_at timestamptz not null default now(),
  details jsonb,
  primary key (job_name, run_date)
);

alter table public.cron_runs enable row level security;
-- Sem policies: acessado só via service-role no endpoint do cron e nos detectors.
```

- [ ] **Step A3.2: Aplicar e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push
git add supabase/migrations/20260427000014_cron_runs.sql
git commit -m "feat(db): cron_runs table for daily-digest idempotency"
```

---

### Task A4: Regenerar tipos + setup Resend + env CRON_SECRET

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/env.ts`
- Modify: `package.json` (add `resend` dep)
- Modify: `.env.example`

- [ ] **Step A4.1: Regenerar tipos**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  SUPABASE_PROJECT_ID=jelvhwbpipawghwufpbc \
  npm run db:types
```

Esperar: `Database["public"]["Enums"]["notification_event"]` agora existe; `notification_rules`, `notification_preferences`, `cron_runs` aparecem em `Tables`.

- [ ] **Step A4.2: Adicionar `CRON_SECRET` opcional ao env.ts**

Substituir `src/lib/env.ts` inteiro:

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
  // Opcional: usado pelo endpoint do cron. Sem isso, o endpoint retorna 401 pra qualquer request.
  CRON_SECRET: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

let serverEnv: z.infer<typeof serverSchema> | null = null;

function getServerEnv() {
  if (!serverEnv) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
      throw new Error("Invalid environment variables");
    }
    serverEnv = parsed.data;
  }
  return serverEnv;
}

export const env = (() => {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!parsed.success) {
    console.error("❌ Invalid client environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
})();

export { getServerEnv };
```

- [ ] **Step A4.3: Atualizar `.env.example`**

Adicionar linha pra CRON_SECRET (sem valor):

```bash
# .env.example (adicionar abaixo do RESEND_FROM)
CRON_SECRET=
```

- [ ] **Step A4.4: Instalar `resend`**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm install resend
npm run typecheck
```

Esperar: instala sem erro, typecheck clean.

- [ ] **Step A4.5: Commit (todos os 4 deltas juntos)**

```bash
git add src/types/database.ts src/lib/env.ts .env.example package.json package-lock.json
git commit -m "chore: regen db types, add CRON_SECRET env, install resend"
```

---

## Bloco B — Backend Core

### Task B1: Email client + template

**Files:**
- Create: `src/lib/email/client.ts`
- Create: `src/lib/email/templates/notification.ts`
- Create: `tests/unit/email-template.test.ts`

- [ ] **Step B1.1: Escrever testes (TDD)**

Crie `tests/unit/email-template.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderNotificationEmail } from "@/lib/email/templates/notification";

describe("renderNotificationEmail", () => {
  it("escapa HTML em titulo e mensagem (segurança)", () => {
    const { html } = renderNotificationEmail({
      recipientName: "Ana",
      titulo: "<script>alert('xss')</script>",
      mensagem: "<img src=x onerror=alert(1)>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onerror=alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("inclui CTA quando ctaUrl é fornecido", () => {
    const { html } = renderNotificationEmail({
      recipientName: "Bruno",
      titulo: "Tarefa atribuída",
      mensagem: "Nova tarefa pra você",
      ctaUrl: "https://yideacompanha.com/tarefas/abc",
      ctaLabel: "Ver tarefa",
    });
    expect(html).toContain("https://yideacompanha.com/tarefas/abc");
    expect(html).toContain("Ver tarefa");
  });

  it("não inclui CTA quando ctaUrl está ausente", () => {
    const { html } = renderNotificationEmail({
      recipientName: "Carla",
      titulo: "Lembrete",
      mensagem: "Algo aconteceu",
    });
    expect(html).not.toMatch(/<a [^>]*href=/);
  });

  it("plain text inclui link absoluto quando há CTA", () => {
    const { text } = renderNotificationEmail({
      recipientName: "Diego",
      titulo: "Marco zero amanhã",
      mensagem: "Reunião com Cliente X",
      ctaUrl: "https://yideacompanha.com/onboarding/xyz",
    });
    expect(text).toContain("https://yideacompanha.com/onboarding/xyz");
    expect(text).toContain("Marco zero amanhã");
  });
});
```

- [ ] **Step B1.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/email-template.test.ts
```

Esperar: falha porque o módulo não existe.

- [ ] **Step B1.3: Criar `src/lib/email/templates/notification.ts`**

```ts
interface TemplateArgs {
  recipientName: string;
  titulo: string;
  mensagem: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]!));
}

export function renderNotificationEmail(args: TemplateArgs): { html: string; text: string } {
  const { recipientName, titulo, mensagem, ctaUrl, ctaLabel } = args;
  const safeTitulo = escapeHtml(titulo);
  const safeMensagem = escapeHtml(mensagem);
  const safeName = escapeHtml(recipientName);
  const safeLabel = escapeHtml(ctaLabel ?? "Acessar");

  const text = `Olá ${recipientName},

${titulo}
${mensagem}
${ctaUrl ? `\nAcessar: ${ctaUrl}\n` : ""}
— Yide Acompanha`;

  const html = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #0a0a0f;">
  <div style="font-size: 18px; font-weight: 600; color: #2BA39C;">Yide Acompanha</div>
  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
  <p style="margin: 0 0 8px 0; color: #64748b; font-size: 13px;">Olá ${safeName},</p>
  <h1 style="margin: 0 0 12px 0; font-size: 18px;">${safeTitulo}</h1>
  <p style="margin: 0 0 20px 0; line-height: 1.5;">${safeMensagem}</p>
  ${ctaUrl
    ? `<a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #3DC4BC, #2BA39C); color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 500;">${safeLabel}</a>`
    : ""}
  <p style="margin-top: 32px; color: #94a3b8; font-size: 12px;">
    Você está recebendo este email porque é colaborador da Yide Digital.
    Para ajustar suas preferências de notificação, acesse o sistema.
  </p>
</div>`;

  return { html, text };
}
```

- [ ] **Step B1.4: Criar `src/lib/email/client.ts`**

```ts
import "server-only";
import { Resend } from "resend";
import { getServerEnv } from "@/lib/env";

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const env = getServerEnv();
    _client = new Resend(env.RESEND_API_KEY);
  }
  return _client;
}

export interface EmailArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(args: EmailArgs): Promise<void> {
  try {
    const env = getServerEnv();
    await getClient().emails.send({
      from: env.RESEND_FROM,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
  } catch (err) {
    // Falha silenciosa: in-app não deve quebrar
    console.error("[email] send failed:", err instanceof Error ? err.message : err);
  }
}
```

- [ ] **Step B1.5: Rodar testes, typecheck**

```bash
npm run test -- tests/unit/email-template.test.ts
npm run typecheck
```

Esperar: 4/4 passa, typecheck OK.

- [ ] **Step B1.6: Commit**

```bash
git add src/lib/email/ tests/unit/email-template.test.ts
git commit -m "feat(email): Resend client wrapper and notification template with HTML escape"
```

---

### Task B2: `dispatchNotification` central

**Files:**
- Create: `src/lib/notificacoes/dispatch.ts`
- Create: `tests/unit/notificacoes-dispatch.test.ts`

- [ ] **Step B2.1: Escrever testes (TDD)**

Crie `tests/unit/notificacoes-dispatch.test.ts`. Os testes mockam supabase + email:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks ANTES dos imports do código
const insertMock = vi.fn();
const selectMock = vi.fn();
const profileSelectMock = vi.fn();

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table === "notification_rules") {
        return { select: () => ({ eq: () => ({ single: selectMock }) }) };
      }
      if (table === "notifications") {
        return { insert: insertMock };
      }
      if (table === "notification_preferences") {
        return {
          select: () => ({
            in: () => ({ eq: () => ({ data: [] }) }),
          }),
        };
      }
      if (table === "profiles") {
        return {
          select: () => ({
            in: () => ({ eq: () => ({ data: [] }) }),
            eq: () => ({ single: profileSelectMock }),
          }),
        };
      }
      return {};
    },
  }),
}));

const sendEmailMock = vi.fn();
vi.mock("@/lib/email/client", () => ({ sendEmail: sendEmailMock }));

vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ NEXT_PUBLIC_APP_URL: "https://test.local" }),
}));

import { dispatchNotification } from "@/lib/notificacoes/dispatch";

beforeEach(() => {
  insertMock.mockReset();
  insertMock.mockResolvedValue({ error: null });
  selectMock.mockReset();
  profileSelectMock.mockReset();
  sendEmailMock.mockReset();
});

describe("dispatchNotification", () => {
  it("não dispatch quando regra está ativa=false", async () => {
    selectMock.mockResolvedValue({
      data: { evento_tipo: "task_assigned", ativo: false, mandatory: false, email_default: false, permite_destinatarios_extras: true, default_roles: [], default_user_ids: [] },
    });
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "X",
      mensagem: "Y",
      user_ids_extras: ["user-1"],
    });
    expect(insertMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("não dispatch quando regra não existe", async () => {
    selectMock.mockResolvedValue({ data: null });
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "X",
      mensagem: "Y",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("excluí source_user_id da lista de destinatários", async () => {
    selectMock.mockResolvedValue({
      data: { evento_tipo: "task_assigned", ativo: true, mandatory: false, email_default: false, permite_destinatarios_extras: true, default_roles: [], default_user_ids: [] },
    });
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "X",
      mensagem: "Y",
      user_ids_extras: ["user-1", "user-2"],
      source_user_id: "user-1",
    });
    // user-1 (source) excluído; user-2 recebe
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-2" }));
  });

  it("ignora user_ids_extras quando permite_destinatarios_extras=false", async () => {
    selectMock.mockResolvedValue({
      data: { evento_tipo: "deal_fechado", ativo: true, mandatory: false, email_default: false, permite_destinatarios_extras: false, default_roles: [], default_user_ids: [] },
    });
    await dispatchNotification({
      evento_tipo: "deal_fechado",
      titulo: "X",
      mensagem: "Y",
      user_ids_extras: ["user-1"],
    });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("retorna early se não há destinatários", async () => {
    selectMock.mockResolvedValue({
      data: { evento_tipo: "task_assigned", ativo: true, mandatory: false, email_default: false, permite_destinatarios_extras: true, default_roles: [], default_user_ids: [] },
    });
    await dispatchNotification({
      evento_tipo: "task_assigned",
      titulo: "X",
      mensagem: "Y",
    });
    expect(insertMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step B2.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/notificacoes-dispatch.test.ts
```

- [ ] **Step B2.3: Criar `src/lib/notificacoes/dispatch.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendEmail } from "@/lib/email/client";
import { renderNotificationEmail } from "@/lib/email/templates/notification";
import { getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export type NotificationEvent = Database["public"]["Enums"]["notification_event"];

interface DispatchArgs {
  evento_tipo: NotificationEvent;
  titulo: string;
  mensagem: string;
  link?: string;
  user_ids_extras?: string[];
  source_user_id?: string;
}

interface Rule {
  evento_tipo: NotificationEvent;
  ativo: boolean;
  mandatory: boolean;
  email_default: boolean;
  permite_destinatarios_extras: boolean;
  default_roles: string[];
  default_user_ids: string[];
}

export async function dispatchNotification(args: DispatchArgs): Promise<void> {
  const supabase = createServiceRoleClient();

  // 1. Carrega rule
  const { data: rule } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("evento_tipo", args.evento_tipo)
    .single();
  if (!rule) return;
  const r = rule as Rule;
  if (!r.ativo) return;

  // 2. Resolve destinatários
  let recipientIds = await resolveRecipients(supabase, r);
  if (r.permite_destinatarios_extras && args.user_ids_extras) {
    recipientIds = [...new Set([...recipientIds, ...args.user_ids_extras])];
  }
  if (args.source_user_id) {
    recipientIds = recipientIds.filter((id) => id !== args.source_user_id);
  }
  if (recipientIds.length === 0) return;

  // 3. Carrega prefs
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id, in_app, email")
    .in("user_id", recipientIds)
    .eq("evento_tipo", args.evento_tipo);
  const prefMap = new Map(((prefs ?? []) as Array<{ user_id: string; in_app: boolean; email: boolean }>).map((p) => [p.user_id, p]));

  // 4. Para cada destinatário, dispatch nos canais habilitados
  for (const userId of recipientIds) {
    const pref = prefMap.get(userId);
    const wantsInApp = r.mandatory || (pref?.in_app ?? true);
    const wantsEmail = r.mandatory ? r.email_default : pref?.email ?? r.email_default;

    if (wantsInApp) {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        tipo: args.evento_tipo,
        titulo: args.titulo,
        mensagem: args.mensagem,
        link: args.link ?? null,
      });
      if (error) console.error("[dispatch] in-app insert failed:", error.message);
    }

    if (wantsEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, email, ativo")
        .eq("id", userId)
        .single();
      if (!profile || !profile.ativo) continue;
      const env = getServerEnv();
      const fullLink = args.link ? `${env.NEXT_PUBLIC_APP_URL}${args.link}` : undefined;
      const { html, text } = renderNotificationEmail({
        recipientName: profile.nome,
        titulo: args.titulo,
        mensagem: args.mensagem,
        ctaUrl: fullLink,
        ctaLabel: "Acessar",
      });
      await sendEmail({ to: profile.email, subject: args.titulo, html, text });
    }
  }
}

async function resolveRecipients(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rule: Rule,
): Promise<string[]> {
  const set = new Set<string>(rule.default_user_ids);
  if (rule.default_roles.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .in("role", rule.default_roles as Database["public"]["Enums"]["user_role"][])
      .eq("ativo", true);
    ((data ?? []) as Array<{ id: string }>).forEach((p) => set.add(p.id));
  }
  return [...set];
}
```

- [ ] **Step B2.4: Rodar testes, typecheck**

```bash
npm run test -- tests/unit/notificacoes-dispatch.test.ts
npm run typecheck
```

Esperar: 5/5 passam.

- [ ] **Step B2.5: Commit**

```bash
git add src/lib/notificacoes/dispatch.ts tests/unit/notificacoes-dispatch.test.ts
git commit -m "feat(notificacoes): central dispatchNotification with rules + preferences"
```

---

### Task B3: Cron orquestrador + endpoint + idempotência

**Files:**
- Create: `src/lib/cron/daily-digest.ts`
- Create: `src/app/api/cron/daily-digest/route.ts`
- Create: `vercel.json`
- Create: `tests/unit/cron-daily-digest.test.ts`

- [ ] **Step B3.1: Escrever testes (TDD)**

Crie `tests/unit/cron-daily-digest.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

// Stubs para todos detectors — não rodam DB real
vi.mock("@/lib/cron/detectors/task-overdue", () => ({ detectOverdueTasks: vi.fn() }));
vi.mock("@/lib/cron/detectors/task-prazo-amanha", () => ({ detectTasksDuesoon: vi.fn() }));
vi.mock("@/lib/cron/detectors/evento-calendario-hoje", () => ({ detectEventsToday: vi.fn() }));
vi.mock("@/lib/cron/detectors/marco-zero-24h", () => ({ detectMarcosZero24h: vi.fn() }));
vi.mock("@/lib/cron/detectors/aniversario-socio-cliente", () => ({ detectClientBirthdays: vi.fn() }));
vi.mock("@/lib/cron/detectors/aniversario-colaborador", () => ({ detectColaboradorBirthdays: vi.fn() }));
vi.mock("@/lib/cron/detectors/renovacao-contrato", () => ({ detectRenovacoes: vi.fn() }));
vi.mock("@/lib/cron/detectors/satisfacao-pendente", () => ({ detectSatisfacaoPendente: vi.fn() }));

import { runDailyDigest } from "@/lib/cron/daily-digest";

beforeEach(() => {
  fromMock.mockReset();
});

describe("runDailyDigest", () => {
  it("retorna skipped quando já rodou hoje", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "cron_runs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { ran_at: "2026-04-27T11:00:00Z" } }) }),
            }),
          }),
          insert: vi.fn(),
          update: vi.fn().mockReturnValue({ eq: () => ({ eq: vi.fn().mockResolvedValue({}) }) }),
        };
      }
      return {};
    });
    const result = await runDailyDigest();
    expect(result).toEqual(expect.objectContaining({ skipped: true }));
  });

  it("retorna counters quando primeira execução do dia", async () => {
    fromMock.mockImplementation((table) => {
      if (table === "cron_runs") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockReturnValue({ eq: () => ({ eq: vi.fn().mockResolvedValue({}) }) }),
        };
      }
      return {};
    });
    const result = await runDailyDigest();
    expect(result).toHaveProperty("counters");
    expect(result).toHaveProperty("ran_at");
  });

  it("safeDetect captura erro de detector individual sem parar os outros", async () => {
    const { detectOverdueTasks } = await import("@/lib/cron/detectors/task-overdue");
    const { detectTasksDuesoon } = await import("@/lib/cron/detectors/task-prazo-amanha");
    vi.mocked(detectOverdueTasks).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(detectTasksDuesoon).mockResolvedValueOnce(undefined);

    fromMock.mockImplementation((table) => {
      if (table === "cron_runs") {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }) }),
          }),
          insert: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockReturnValue({ eq: () => ({ eq: vi.fn().mockResolvedValue({}) }) }),
        };
      }
      return {};
    });

    const result = await runDailyDigest();
    expect(result).toHaveProperty("counters");
    // detectTasksDuesoon foi chamado mesmo após detectOverdueTasks lançar
    expect(detectTasksDuesoon).toHaveBeenCalled();
  });
});
```

- [ ] **Step B3.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/cron-daily-digest.test.ts
```

- [ ] **Step B3.3: Criar `src/lib/cron/daily-digest.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { detectOverdueTasks } from "./detectors/task-overdue";
import { detectTasksDuesoon } from "./detectors/task-prazo-amanha";
import { detectEventsToday } from "./detectors/evento-calendario-hoje";
import { detectMarcosZero24h } from "./detectors/marco-zero-24h";
import { detectClientBirthdays } from "./detectors/aniversario-socio-cliente";
import { detectColaboradorBirthdays } from "./detectors/aniversario-colaborador";
import { detectRenovacoes } from "./detectors/renovacao-contrato";
import { detectSatisfacaoPendente } from "./detectors/satisfacao-pendente";

export interface DigestCounters {
  task_overdue: number;
  task_prazo_amanha: number;
  evento_calendario_hoje: number;
  marco_zero_24h: number;
  aniversario_socio_cliente: number;
  aniversario_colaborador: number;
  renovacao_contrato: number;
  satisfacao_pendente: number;
}

type DigestResult =
  | { counters: DigestCounters; ran_at: string }
  | { skipped: true; reason: string };

export async function runDailyDigest(): Promise<DigestResult> {
  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("cron_runs")
    .select("ran_at")
    .eq("job_name", "daily-digest")
    .eq("run_date", today)
    .maybeSingle();
  if (existing) return { skipped: true, reason: "already ran today" };

  await supabase.from("cron_runs").insert({ job_name: "daily-digest", run_date: today });

  const counters: DigestCounters = {
    task_overdue: 0,
    task_prazo_amanha: 0,
    evento_calendario_hoje: 0,
    marco_zero_24h: 0,
    aniversario_socio_cliente: 0,
    aniversario_colaborador: 0,
    renovacao_contrato: 0,
    satisfacao_pendente: 0,
  };

  await safeDetect(() => detectOverdueTasks(counters));
  await safeDetect(() => detectTasksDuesoon(counters));
  await safeDetect(() => detectEventsToday(counters));
  await safeDetect(() => detectMarcosZero24h(counters));
  await safeDetect(() => detectClientBirthdays(counters));
  await safeDetect(() => detectColaboradorBirthdays(counters));
  await safeDetect(() => detectRenovacoes(counters));

  if (new Date().getUTCDay() === 1) {
    await safeDetect(() => detectSatisfacaoPendente(counters));
  }

  await supabase
    .from("cron_runs")
    .update({ details: counters as unknown as Record<string, unknown> })
    .eq("job_name", "daily-digest")
    .eq("run_date", today);

  return { counters, ran_at: new Date().toISOString() };
}

async function safeDetect(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error("[daily-digest] detector failed:", err instanceof Error ? err.message : err);
  }
}
```

- [ ] **Step B3.4: Criar stubs dos 8 detectors (vazios — preenchidos em B4)**

Crie cada um destes arquivos com a função exportada vazia (apenas pra typecheck passar):

`src/lib/cron/detectors/task-overdue.ts`:
```ts
import "server-only";

export async function detectOverdueTasks(counters: { task_overdue: number }): Promise<void> {
  void counters;
}
```

`src/lib/cron/detectors/task-prazo-amanha.ts`:
```ts
import "server-only";

export async function detectTasksDuesoon(counters: { task_prazo_amanha: number }): Promise<void> {
  void counters;
}
```

`src/lib/cron/detectors/evento-calendario-hoje.ts`:
```ts
import "server-only";

export async function detectEventsToday(counters: { evento_calendario_hoje: number }): Promise<void> {
  void counters;
}
```

`src/lib/cron/detectors/marco-zero-24h.ts`:
```ts
import "server-only";

export async function detectMarcosZero24h(counters: { marco_zero_24h: number }): Promise<void> {
  void counters;
}
```

`src/lib/cron/detectors/aniversario-socio-cliente.ts`:
```ts
import "server-only";

export async function detectClientBirthdays(counters: { aniversario_socio_cliente: number }): Promise<void> {
  void counters;
}
```

`src/lib/cron/detectors/aniversario-colaborador.ts`:
```ts
import "server-only";

export async function detectColaboradorBirthdays(counters: { aniversario_colaborador: number }): Promise<void> {
  void counters;
}
```

`src/lib/cron/detectors/renovacao-contrato.ts`:
```ts
import "server-only";

export async function detectRenovacoes(counters: { renovacao_contrato: number }): Promise<void> {
  void counters;
}
```

`src/lib/cron/detectors/satisfacao-pendente.ts`:
```ts
import "server-only";

export async function detectSatisfacaoPendente(counters: { satisfacao_pendente: number }): Promise<void> {
  void counters;
}
```

- [ ] **Step B3.5: Criar endpoint `/api/cron/daily-digest`**

`src/app/api/cron/daily-digest/route.ts`:

```ts
import { NextResponse } from "next/server";
import { runDailyDigest } from "@/lib/cron/daily-digest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDailyDigest();
  return NextResponse.json(result);
}
```

- [ ] **Step B3.6: Criar `vercel.json` na raiz**

```json
{
  "crons": [
    { "path": "/api/cron/daily-digest", "schedule": "0 11 * * *" }
  ]
}
```

`0 11 * * *` = 11:00 UTC = 08:00 BRT diário.

- [ ] **Step B3.7: Rodar testes + typecheck**

```bash
npm run test -- tests/unit/cron-daily-digest.test.ts
npm run typecheck
```

- [ ] **Step B3.8: Commit**

```bash
git add src/lib/cron/ src/app/api/cron/ vercel.json tests/unit/cron-daily-digest.test.ts
git commit -m "feat(cron): daily-digest orchestrator with idempotency, endpoint and Vercel cron config"
```

---

### Task B4: Implementar os 8 detectors

**Files:** os 8 arquivos em `src/lib/cron/detectors/` (substituir stubs).

- [ ] **Step B4.1: Substituir `task-overdue.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { localIsoDate } from "@/lib/utils/date";

export async function detectOverdueTasks(counters: { task_overdue: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const today = localIsoDate();

  const { data } = await supabase
    .from("tasks")
    .select("id, titulo, atribuido_a, status, due_date")
    .lt("due_date", today)
    .neq("status", "concluida");

  for (const t of (data ?? []) as Array<{ id: string; titulo: string; atribuido_a: string }>) {
    await dispatchNotification({
      evento_tipo: "task_overdue",
      titulo: "Tarefa atrasada",
      mensagem: `"${t.titulo}" está atrasada`,
      link: `/tarefas/${t.id}`,
      user_ids_extras: [t.atribuido_a],
    });
    counters.task_overdue++;
  }
}
```

- [ ] **Step B4.2: Substituir `task-prazo-amanha.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { localIsoDate } from "@/lib/utils/date";

export async function detectTasksDuesoon(counters: { task_prazo_amanha: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const tomorrow = localIsoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const { data } = await supabase
    .from("tasks")
    .select("id, titulo, atribuido_a, status")
    .eq("due_date", tomorrow)
    .neq("status", "concluida");

  for (const t of (data ?? []) as Array<{ id: string; titulo: string; atribuido_a: string }>) {
    await dispatchNotification({
      evento_tipo: "task_prazo_amanha",
      titulo: "Tarefa vence amanhã",
      mensagem: `"${t.titulo}" tem prazo amanhã`,
      link: `/tarefas/${t.id}`,
      user_ids_extras: [t.atribuido_a],
    });
    counters.task_prazo_amanha++;
  }
}
```

- [ ] **Step B4.3: Substituir `evento-calendario-hoje.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

export async function detectEventsToday(counters: { evento_calendario_hoje: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);

  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, participantes_ids")
    .gte("inicio", startOfToday.toISOString())
    .lt("inicio", startOfTomorrow.toISOString());

  for (const e of (data ?? []) as Array<{ id: string; titulo: string; inicio: string; participantes_ids: string[] }>) {
    if (!e.participantes_ids || e.participantes_ids.length === 0) continue;
    const horario = new Date(e.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    await dispatchNotification({
      evento_tipo: "evento_calendario_hoje",
      titulo: "Evento hoje",
      mensagem: `${e.titulo} às ${horario}`,
      link: `/calendario/${e.id}`,
      user_ids_extras: e.participantes_ids,
    });
    counters.evento_calendario_hoje++;
  }
}
```

- [ ] **Step B4.4: Substituir `marco-zero-24h.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { localIsoDate } from "@/lib/utils/date";

export async function detectMarcosZero24h(counters: { marco_zero_24h: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const tomorrowStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(Date.now() + 48 * 60 * 60 * 1000);
  void localIsoDate;

  const { data } = await supabase
    .from("leads")
    .select("id, nome_prospect, data_reuniao_marco_zero, comercial_id, coord_alocado_id, assessor_alocado_id")
    .gte("data_reuniao_marco_zero", tomorrowStart.toISOString())
    .lt("data_reuniao_marco_zero", tomorrowEnd.toISOString())
    .neq("stage", "ativo");

  for (const l of (data ?? []) as Array<{
    id: string;
    nome_prospect: string;
    data_reuniao_marco_zero: string;
    comercial_id: string | null;
    coord_alocado_id: string | null;
    assessor_alocado_id: string | null;
  }>) {
    const recipients: string[] = [];
    if (l.comercial_id) recipients.push(l.comercial_id);
    if (l.coord_alocado_id) recipients.push(l.coord_alocado_id);
    if (l.assessor_alocado_id) recipients.push(l.assessor_alocado_id);
    if (recipients.length === 0) continue;

    await dispatchNotification({
      evento_tipo: "marco_zero_24h",
      titulo: "Marco Zero amanhã",
      mensagem: `Reunião de marco zero com ${l.nome_prospect}`,
      link: `/onboarding/${l.id}`,
      user_ids_extras: recipients,
    });
    counters.marco_zero_24h++;
  }
}
```

- [ ] **Step B4.5: Substituir `aniversario-socio-cliente.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { localIsoDate } from "@/lib/utils/date";

const WINDOWS = [30, 7, 1];

export async function detectClientBirthdays(counters: { aniversario_socio_cliente: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const today = new Date();

  for (const days of WINDOWS) {
    const target = new Date(today);
    target.setDate(target.getDate() + days);
    const monthDay = `${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;

    const { data } = await supabase
      .from("client_important_dates")
      .select("id, descricao, data, client_id, tipo, cliente:clients(nome, assessor_id, coordenador_id)")
      .eq("tipo", "aniversario_socio");

    for (const d of (data ?? []) as Array<{
      id: string;
      descricao: string | null;
      data: string;
      client_id: string;
      cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null;
    }>) {
      const dataDate = d.data.slice(5); // MM-DD
      if (dataDate !== monthDay) continue;

      const recipients: string[] = [];
      if (d.cliente?.assessor_id) recipients.push(d.cliente.assessor_id);
      if (d.cliente?.coordenador_id) recipients.push(d.cliente.coordenador_id);
      if (recipients.length === 0) continue;

      await dispatchNotification({
        evento_tipo: "aniversario_socio_cliente",
        titulo: `Aniversário em ${days} dia${days === 1 ? "" : "s"}`,
        mensagem: `${d.cliente?.nome ?? "Cliente"} — ${d.descricao ?? "aniversário do sócio"}`,
        link: `/clientes/${d.client_id}`,
        user_ids_extras: recipients,
      });
      counters.aniversario_socio_cliente++;
    }
  }
  void localIsoDate;
}
```

- [ ] **Step B4.6: Substituir `aniversario-colaborador.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

export async function detectColaboradorBirthdays(counters: { aniversario_colaborador: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const target = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const monthDay = `${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;

  const { data } = await supabase
    .from("profiles")
    .select("id, nome, data_nascimento, ativo")
    .eq("ativo", true);

  for (const p of (data ?? []) as Array<{ id: string; nome: string; data_nascimento: string | null }>) {
    if (!p.data_nascimento) continue;
    const dn = p.data_nascimento.slice(5);
    if (dn !== monthDay) continue;

    await dispatchNotification({
      evento_tipo: "aniversario_colaborador",
      titulo: `Aniversário em 3 dias: ${p.nome}`,
      mensagem: `${p.nome} faz aniversário em 3 dias`,
      // Sem link — colaborador não é página principal pra todos
      source_user_id: p.id, // não notifica o aniversariante
    });
    counters.aniversario_colaborador++;
  }
}
```

- [ ] **Step B4.7: Substituir `renovacao-contrato.ts`**

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

const WINDOWS = [45, 15, 5];

export async function detectRenovacoes(counters: { renovacao_contrato: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const today = new Date();

  for (const days of WINDOWS) {
    const target = new Date(today);
    target.setDate(target.getDate() + days);
    const targetIso = target.toISOString().slice(0, 10);

    const { data } = await supabase
      .from("client_important_dates")
      .select("id, descricao, data, client_id, tipo, cliente:clients(nome, assessor_id, coordenador_id)")
      .eq("tipo", "renovacao")
      .eq("data", targetIso);

    for (const d of (data ?? []) as Array<{
      id: string;
      descricao: string | null;
      data: string;
      client_id: string;
      cliente: { nome: string; assessor_id: string | null; coordenador_id: string | null } | null;
    }>) {
      const recipients: string[] = [];
      if (d.cliente?.assessor_id) recipients.push(d.cliente.assessor_id);
      if (d.cliente?.coordenador_id) recipients.push(d.cliente.coordenador_id);
      if (recipients.length === 0) continue;

      await dispatchNotification({
        evento_tipo: "renovacao_contrato",
        titulo: `Renovação em ${days} dias`,
        mensagem: `${d.cliente?.nome ?? "Cliente"} — ${d.descricao ?? "renovação de contrato"}`,
        link: `/clientes/${d.client_id}`,
        user_ids_extras: recipients,
      });
      counters.renovacao_contrato++;
    }
  }
}
```

- [ ] **Step B4.8: Substituir `satisfacao-pendente.ts` (stub Fase 8)**

```ts
import "server-only";

// Stub para Fase 8. Por enquanto não cria pendências; será implementado quando a feature de satisfação for desenvolvida.
export async function detectSatisfacaoPendente(counters: { satisfacao_pendente: number }): Promise<void> {
  void counters;
  // No-op até Fase 8.
}
```

- [ ] **Step B4.9: Typecheck + tests**

```bash
npm run typecheck
npm run test
```

Esperar: clean + todos os tests anteriores ainda passam.

- [ ] **Step B4.10: Commit**

```bash
git add src/lib/cron/detectors/
git commit -m "feat(cron): implement 8 detectors (overdue, prazo, eventos, marco zero, aniversarios, renovacao)"
```

---

## Bloco C — Refactor + Triggers + UI

### Task C1: Refactor Fase 4 — substituir `trigger.ts` por `dispatchNotification`

**Files:**
- Modify: `src/lib/tarefas/actions.ts`
- Delete: `src/lib/notificacoes/trigger.ts`
- Delete: `tests/unit/notificacoes-trigger.test.ts` (não é mais relevante — a função `shouldNotify` foi absorvida pelo `dispatchNotification` que filtra `source_user_id`)

- [ ] **Step C1.1: Editar `src/lib/tarefas/actions.ts`**

Substituir o import de `notificacoes/trigger` por `notificacoes/dispatch`:

Linha do import (atual):
```ts
import { notifyTaskAssigned, notifyTaskCompleted } from "@/lib/notificacoes/trigger";
```

Trocar para:
```ts
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
```

Substituir cada chamada de `notifyTaskAssigned`:

Antes:
```ts
await notifyTaskAssigned({
  taskId: created.id,
  assigneeId: parsed.data.atribuido_a,
  creatorId: actor.id,
  taskTitle: created.titulo,
  creatorName: actor.nome,
});
```

Depois:
```ts
await dispatchNotification({
  evento_tipo: "task_assigned",
  titulo: "Nova tarefa atribuída a você",
  mensagem: `${actor.nome} atribuiu: "${created.titulo}"`,
  link: `/tarefas/${created.id}`,
  user_ids_extras: [parsed.data.atribuido_a],
  source_user_id: actor.id,
});
```

Idem em `updateTaskAction` (quando atribuído muda):
```ts
await dispatchNotification({
  evento_tipo: "task_assigned",
  titulo: "Nova tarefa atribuída a você",
  mensagem: `${actor.nome} atribuiu: "${parsed.data.titulo}"`,
  link: `/tarefas/${parsed.data.id}`,
  user_ids_extras: [parsed.data.atribuido_a],
  source_user_id: actor.id,
});
```

E o `notifyTaskCompleted` (em `updateTaskAction` e `toggleTaskCompletionAction`):

Antes:
```ts
await notifyTaskCompleted({
  taskId: parsed.data.id,
  completerId: actor.id,
  creatorId: before.criado_por,
  taskTitle: parsed.data.titulo,
  completerName: actor.nome,
});
```

Depois:
```ts
await dispatchNotification({
  evento_tipo: "task_completed",
  titulo: "Tarefa concluída",
  mensagem: `${actor.nome} concluiu: "${parsed.data.titulo}"`,
  link: `/tarefas/${parsed.data.id}`,
  user_ids_extras: [before.criado_por],
  source_user_id: actor.id,
});
```

E o equivalente em `toggleTaskCompletionAction` (usar `t.titulo` e `t.criado_por` nos campos).

- [ ] **Step C1.2: Deletar `src/lib/notificacoes/trigger.ts` e seu test**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
rm src/lib/notificacoes/trigger.ts
rm tests/unit/notificacoes-trigger.test.ts
```

- [ ] **Step C1.3: Typecheck + tests**

```bash
npm run typecheck
npm run test
```

Esperar: typecheck clean. Testes relevantes ainda passam (os 2 cases de `shouldNotify` deixam de existir — testabilidade equivalente está em `notificacoes-dispatch.test.ts`).

- [ ] **Step C1.4: Commit**

```bash
git add src/lib/tarefas/actions.ts src/lib/notificacoes/trigger.ts tests/unit/notificacoes-trigger.test.ts
git commit -m "refactor(notificacoes): replace trigger.ts with dispatchNotification in tarefas"
```

---

### Task C2: Triggers em `src/lib/leads/actions.ts` (kanban_moved, prospeccao_agendada, deal_fechado)

**Files:**
- Modify: `src/lib/leads/actions.ts`

- [ ] **Step C2.1: Adicionar import**

No topo de `src/lib/leads/actions.ts`:

```ts
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
```

- [ ] **Step C2.2: Helper `prettyStage`**

Adicionar função no início do arquivo (depois dos imports):

```ts
function prettyStage(stage: string): string {
  switch (stage) {
    case "prospeccao": return "Prospecção";
    case "comercial": return "Reunião Comercial";
    case "contrato": return "Contrato";
    case "marco_zero": return "Marco Zero";
    case "ativo": return "Cliente Ativo";
    default: return stage;
  }
}
```

- [ ] **Step C2.3: Adicionar dispatch no final de `moveStageAction`**

Localizar o final de `moveStageAction` (após `revalidatePath`/`revalidatePath`, antes do `redirect` ou `return`). Adicionar:

```ts
// kanban_moved (sempre)
const nextResponsibleId =
  toStage === "comercial" ? lead.comercial_id :
  toStage === "marco_zero" ? lead.coord_alocado_id :
  toStage === "ativo" ? lead.assessor_alocado_id :
  null;

await dispatchNotification({
  evento_tipo: "kanban_moved",
  titulo: `Card movido para "${prettyStage(toStage)}"`,
  mensagem: `${actor.nome} moveu "${lead.nome_prospect}"`,
  link: `/onboarding/${parsed.data.id}`,
  source_user_id: actor.id,
  user_ids_extras: nextResponsibleId ? [nextResponsibleId] : undefined,
});

// deal_fechado (só quando move pra ativo)
if (toStage === "ativo") {
  await dispatchNotification({
    evento_tipo: "deal_fechado",
    titulo: `Deal fechado: ${lead.nome_prospect}`,
    mensagem: `${actor.nome} marcou ${lead.nome_prospect} como cliente ativo`,
    link: `/clientes/${updatePayload.client_id}`,
    source_user_id: actor.id,
  });
}
```

- [ ] **Step C2.4: Adicionar dispatch em `createLeadAction` para `prospeccao_agendada`**

Localizar o final de `createLeadAction` (após audit log, antes de `redirect`). Adicionar:

```ts
// Se já vem com data agendada, notifica prospeccao_agendada
if (parsed.data.data_prospeccao_agendada) {
  await dispatchNotification({
    evento_tipo: "prospeccao_agendada",
    titulo: "Prospecção agendada",
    mensagem: `${parsed.data.nome_prospect} — ${new Date(parsed.data.data_prospeccao_agendada).toLocaleDateString("pt-BR")}`,
    link: `/onboarding/${created.id}`,
    source_user_id: actor.id,
  });
}
```

- [ ] **Step C2.5: Typecheck + tests**

```bash
npm run typecheck
npm run test
```

- [ ] **Step C2.6: Commit**

```bash
git add src/lib/leads/actions.ts
git commit -m "feat(leads): trigger notifications on kanban_moved, prospeccao_agendada, deal_fechado"
```

---

### Task C3: Server actions de regras + preferences

**Files:**
- Create: `src/lib/notificacoes/rule-actions.ts`

- [ ] **Step C3.1: Criar arquivo**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import type { Database } from "@/types/database";

type EventType = Database["public"]["Enums"]["notification_event"];

export async function updateRuleAction(formData: FormData) {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:users")) {
    return { error: "Sem permissão" };
  }

  const evento_tipo = String(formData.get("evento_tipo") ?? "") as EventType;
  if (!evento_tipo) return { error: "Tipo de evento inválido" };

  const ativo = formData.get("ativo") === "on";
  const mandatory = formData.get("mandatory") === "on";
  const email_default = formData.get("email_default") === "on";
  const permite_destinatarios_extras = formData.get("permite_destinatarios_extras") === "on";
  const default_roles = (formData.getAll("default_roles") as string[]).filter(Boolean);
  const default_user_ids = (formData.getAll("default_user_ids") as string[]).filter(Boolean);

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("evento_tipo", evento_tipo)
    .single();
  if (!before) return { error: "Regra não encontrada" };

  const updatePayload = {
    ativo,
    mandatory,
    email_default,
    permite_destinatarios_extras,
    default_roles,
    default_user_ids,
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("notification_rules")
    .update(updatePayload)
    .eq("evento_tipo", evento_tipo);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "notification_rules",
    entidade_id: evento_tipo,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/configuracoes/notificacoes");
  return { success: true };
}

export async function setPreferenceAction(formData: FormData) {
  const actor = await requireAuth();
  const evento_tipo = String(formData.get("evento_tipo") ?? "") as EventType;
  const in_app = formData.get("in_app") === "on";
  const email = formData.get("email") === "on";

  if (!evento_tipo) return { error: "Tipo de evento inválido" };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("notification_preferences")
    .upsert(
      { user_id: actor.id, evento_tipo, in_app, email, updated_at: new Date().toISOString() },
      { onConflict: "user_id,evento_tipo" },
    );
  if (error) return { error: error.message };

  revalidatePath("/configuracoes/notificacoes");
  return { success: true };
}

export async function getMyPreferencesAction() {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("evento_tipo, in_app, email")
    .eq("user_id", actor.id);
  const map = new Map<EventType, { in_app: boolean; email: boolean }>();
  ((data ?? []) as Array<{ evento_tipo: EventType; in_app: boolean; email: boolean }>).forEach((p) => {
    map.set(p.evento_tipo, { in_app: p.in_app, email: p.email });
  });
  return map;
}
```

- [ ] **Step C3.2: Typecheck**

```bash
npm run typecheck
```

- [ ] **Step C3.3: Commit**

```bash
git add src/lib/notificacoes/rule-actions.ts
git commit -m "feat(notificacoes): server actions for rule updates and user preferences"
```

---

### Task C4: Componentes (`RecipientsSelector`, `RuleCard`, `PreferenceToggle`)

**Files:**
- Create: `src/components/notificacoes/RecipientsSelector.tsx`
- Create: `src/components/notificacoes/RuleCard.tsx`
- Create: `src/components/notificacoes/PreferenceToggle.tsx`

- [ ] **Step C4.1: Criar `RecipientsSelector.tsx` (client)**

```tsx
"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";

interface RoleOption { value: string; label: string; }
interface ProfileOption { id: string; nome: string; }

interface Props {
  initialRoles: string[];
  initialUserIds: string[];
  roleOptions: RoleOption[];
  profileOptions: ProfileOption[];
}

export function RecipientsSelector({ initialRoles, initialUserIds, roleOptions, profileOptions }: Props) {
  const [roles, setRoles] = useState<string[]>(initialRoles);
  const [userIds, setUserIds] = useState<string[]>(initialUserIds);

  function toggleRole(r: string) {
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }
  function toggleUser(id: string) {
    setUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-[11px]">Papéis padrão</Label>
        <div className="flex flex-wrap gap-1.5">
          {roleOptions.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => toggleRole(r.value)}
              className={`text-xs rounded-full border px-2 py-1 transition-colors ${
                roles.includes(r.value)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {roles.map((r) => <input key={r} type="hidden" name="default_roles" value={r} />)}
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Usuários específicos</Label>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {profileOptions.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleUser(p.id)}
              className={`text-xs rounded-full border px-2 py-1 transition-colors ${
                userIds.includes(p.id)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {p.nome}
            </button>
          ))}
        </div>
        {userIds.map((u) => <input key={u} type="hidden" name="default_user_ids" value={u} />)}
      </div>
    </div>
  );
}
```

- [ ] **Step C4.2: Criar `RuleCard.tsx` (server component contém form, com action)**

```tsx
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RecipientsSelector } from "./RecipientsSelector";
import { updateRuleAction } from "@/lib/notificacoes/rule-actions";

const eventLabels: Record<string, string> = {
  task_assigned: "Tarefa atribuída a mim",
  task_completed: "Tarefa concluída",
  kanban_moved: "Card kanban movido",
  prospeccao_agendada: "Prospecção agendada",
  deal_fechado: "Deal fechado",
  mes_aguardando_aprovacao: "Mês aguardando aprovação",
  mes_aprovado: "Mês aprovado",
  cliente_perto_churn: "Cliente perto do churn",
  task_prazo_amanha: "Tarefa vence amanhã",
  task_overdue: "Tarefa atrasada",
  evento_calendario_hoje: "Evento do calendário hoje",
  marco_zero_24h: "Marco zero amanhã",
  aniversario_socio_cliente: "Aniversário sócio cliente",
  aniversario_colaborador: "Aniversário colaborador",
  renovacao_contrato: "Renovação de contrato",
  satisfacao_pendente: "Satisfação pendente",
};

const ROLE_OPTIONS = [
  { value: "socio", label: "Sócio" },
  { value: "adm", label: "ADM" },
  { value: "comercial", label: "Comercial" },
  { value: "coordenador", label: "Coordenador" },
  { value: "assessor", label: "Assessor" },
  { value: "audiovisual_chefe", label: "Audiovisual Chefe" },
  { value: "videomaker", label: "Videomaker" },
  { value: "designer", label: "Designer" },
  { value: "editor", label: "Editor" },
];

interface Rule {
  evento_tipo: string;
  ativo: boolean;
  mandatory: boolean;
  email_default: boolean;
  permite_destinatarios_extras: boolean;
  default_roles: string[];
  default_user_ids: string[];
}

interface Profile { id: string; nome: string; }

export function RuleCard({ rule, profiles }: { rule: Rule; profiles: Profile[] }) {
  return (
    <Card className="p-4 space-y-3">
      <form action={updateRuleAction} className="space-y-3">
        <input type="hidden" name="evento_tipo" value={rule.evento_tipo} />

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{eventLabels[rule.evento_tipo] ?? rule.evento_tipo}</h3>
          <div className="flex items-center gap-2">
            <Label htmlFor={`ativo-${rule.evento_tipo}`} className="text-xs">Ativo</Label>
            <Switch id={`ativo-${rule.evento_tipo}`} name="ativo" defaultChecked={rule.ativo} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Switch id={`mandatory-${rule.evento_tipo}`} name="mandatory" defaultChecked={rule.mandatory} />
            <Label htmlFor={`mandatory-${rule.evento_tipo}`}>Obrigatório</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={`email-${rule.evento_tipo}`} name="email_default" defaultChecked={rule.email_default} />
            <Label htmlFor={`email-${rule.evento_tipo}`}>Email padrão</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id={`extras-${rule.evento_tipo}`} name="permite_destinatarios_extras" defaultChecked={rule.permite_destinatarios_extras} />
            <Label htmlFor={`extras-${rule.evento_tipo}`}>Permite extras</Label>
          </div>
        </div>

        <RecipientsSelector
          initialRoles={rule.default_roles}
          initialUserIds={rule.default_user_ids}
          roleOptions={ROLE_OPTIONS}
          profileOptions={profiles}
        />

        <Button type="submit" size="sm" variant="outline">Salvar</Button>
      </form>
    </Card>
  );
}
```

- [ ] **Step C4.3: Criar `PreferenceToggle.tsx` (client)**

```tsx
"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setPreferenceAction } from "@/lib/notificacoes/rule-actions";

interface Props {
  evento_tipo: string;
  label: string;
  initialInApp: boolean;
  initialEmail: boolean;
}

export function PreferenceToggle({ evento_tipo, label, initialInApp, initialEmail }: Props) {
  const [pending, startTransition] = useTransition();

  function update(field: "in_app" | "email", value: boolean) {
    const fd = new FormData();
    fd.set("evento_tipo", evento_tipo);
    fd.set("in_app", field === "in_app" ? (value ? "on" : "") : (initialInApp ? "on" : ""));
    fd.set("email", field === "email" ? (value ? "on" : "") : (initialEmail ? "on" : ""));
    startTransition(async () => {
      await setPreferenceAction(fd);
    });
  }

  return (
    <div className="flex items-center justify-between rounded-md border bg-card p-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Switch
            id={`inapp-${evento_tipo}`}
            defaultChecked={initialInApp}
            disabled={pending}
            onCheckedChange={(v) => update("in_app", v)}
          />
          <Label htmlFor={`inapp-${evento_tipo}`} className="text-[11px]">In-app</Label>
        </div>
        <div className="flex items-center gap-1">
          <Switch
            id={`email-${evento_tipo}`}
            defaultChecked={initialEmail}
            disabled={pending}
            onCheckedChange={(v) => update("email", v)}
          />
          <Label htmlFor={`email-${evento_tipo}`} className="text-[11px]">Email</Label>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step C4.4: Typecheck**

```bash
npm run typecheck
```

Esperar: clean. (Se `Switch` não tiver `onCheckedChange`, ajustar para usar evento padrão; verificar API do componente em `src/components/ui/switch.tsx` antes — se a API for diferente, adaptar este componente. Se necessário substituir `onCheckedChange` por uma `<form>` separada com botão submit pra cada toggle.)

- [ ] **Step C4.5: Commit**

```bash
git add src/components/notificacoes/RecipientsSelector.tsx \
  src/components/notificacoes/RuleCard.tsx \
  src/components/notificacoes/PreferenceToggle.tsx
git commit -m "feat(notificacoes): RuleCard, PreferenceToggle and RecipientsSelector components"
```

---

### Task C5: Página `/configuracoes/notificacoes` + link na página principal

**Files:**
- Create: `src/app/(authed)/configuracoes/notificacoes/page.tsx`
- Modify: `src/app/(authed)/configuracoes/page.tsx` (adicionar link)

- [ ] **Step C5.1: Criar página `/configuracoes/notificacoes`**

```tsx
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { RuleCard } from "@/components/notificacoes/RuleCard";
import { PreferenceToggle } from "@/components/notificacoes/PreferenceToggle";
import { getMyPreferencesAction } from "@/lib/notificacoes/rule-actions";

const eventLabels: Record<string, string> = {
  task_assigned: "Tarefa atribuída a mim",
  task_completed: "Tarefa concluída",
  kanban_moved: "Card kanban movido",
  prospeccao_agendada: "Prospecção agendada",
  deal_fechado: "Deal fechado",
  mes_aguardando_aprovacao: "Mês aguardando aprovação",
  mes_aprovado: "Mês aprovado",
  cliente_perto_churn: "Cliente perto do churn",
  task_prazo_amanha: "Tarefa vence amanhã",
  task_overdue: "Tarefa atrasada",
  evento_calendario_hoje: "Evento do calendário hoje",
  marco_zero_24h: "Marco zero amanhã",
  aniversario_socio_cliente: "Aniversário sócio cliente",
  aniversario_colaborador: "Aniversário colaborador",
  renovacao_contrato: "Renovação de contrato",
  satisfacao_pendente: "Satisfação pendente",
};

export default async function NotificacoesConfigPage() {
  const user = await requireAuth();
  const isAdmin = canAccess(user.role, "manage:users");

  const supabase = await createClient();
  const { data: rules = [] } = await supabase
    .from("notification_rules")
    .select("evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids")
    .order("evento_tipo");
  const { data: profiles = [] } = await supabase
    .from("profiles")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");

  const prefMap = await getMyPreferencesAction();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Notificações</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin
            ? "Configure as regras do sistema (todos os usuários) e suas preferências pessoais."
            : "Ative ou desative notificações por canal."}
        </p>
      </header>

      {isAdmin && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Regras do sistema</h2>
          <div className="space-y-3">
            {(rules ?? []).map((r) => (
              <RuleCard key={r.evento_tipo} rule={r} profiles={profiles ?? []} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{isAdmin ? "Suas preferências" : "Preferências"}</h2>
        <p className="text-xs text-muted-foreground">
          Tipos marcados como "obrigatórios" pela administração não podem ser desativados.
        </p>
        <div className="space-y-2">
          {(rules ?? [])
            .filter((r) => !r.mandatory)
            .map((r) => {
              const pref = prefMap.get(r.evento_tipo);
              return (
                <PreferenceToggle
                  key={r.evento_tipo}
                  evento_tipo={r.evento_tipo}
                  label={eventLabels[r.evento_tipo] ?? r.evento_tipo}
                  initialInApp={pref?.in_app ?? true}
                  initialEmail={pref?.email ?? r.email_default}
                />
              );
            })}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step C5.2: Adicionar link em `/configuracoes/page.tsx`**

Read primeiro: o arquivo atual mostra perfil + tema. Adicionar uma seção/link extra para "Notificações". Localizar o `</div>` final do JSX e adicionar uma `<Card>` extra com link:

```tsx
import Link from "next/link";
import { Bell } from "lucide-react";
// ... outros imports já existentes

// ... dentro do JSX, após a Card de tema/perfil:
<Card className="p-6">
  <h2 className="mb-4 text-lg font-semibold">Notificações</h2>
  <p className="text-sm text-muted-foreground mb-3">
    Configure quais notificações você recebe e por qual canal.
  </p>
  <Link
    href="/configuracoes/notificacoes"
    className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
  >
    <Bell className="h-4 w-4" />
    Gerenciar notificações →
  </Link>
</Card>
```

- [ ] **Step C5.3: Typecheck + tests**

```bash
npm run typecheck
npm run test
```

- [ ] **Step C5.4: Commit**

```bash
git add "src/app/(authed)/configuracoes/"
git commit -m "feat(notificacoes): /configuracoes/notificacoes page (admin rules + user prefs)"
```

---

## Bloco D — Tests E2E + push final

### Task D1: E2E + push + PR + setup manual do CRON_SECRET

**Files:**
- Create: `tests/e2e/notificacoes-config.spec.ts`

- [ ] **Step D1.1: Criar test e2e**

```ts
import { test, expect } from "@playwright/test";

test("rota /configuracoes/notificacoes redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/configuracoes/notificacoes");
  await expect(page).toHaveURL(/\/login/);
});

test("endpoint /api/cron/daily-digest retorna 401 sem header de autorização", async ({ request }) => {
  const res = await request.get("/api/cron/daily-digest");
  expect(res.status()).toBe(401);
});

test("endpoint /api/cron/daily-digest retorna 401 com bearer errado", async ({ request }) => {
  const res = await request.get("/api/cron/daily-digest", {
    headers: { authorization: "Bearer invalido" },
  });
  expect(res.status()).toBe(401);
});
```

- [ ] **Step D1.2: Rodar tests + typecheck**

```bash
npm run test
npm run typecheck
```

- [ ] **Step D1.3: Commit**

```bash
git add tests/e2e/notificacoes-config.spec.ts
git commit -m "test(e2e): notificacoes-config auth-redirect and cron endpoint 401"
```

- [ ] **Step D1.4: Push**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
git push origin claude/frosty-jang-a815ff
```

- [ ] **Step D1.5: Abrir PR**

```bash
/opt/homebrew/bin/gh pr create --base main --head claude/frosty-jang-a815ff \
  --title "feat: Fase 6 — Notificações Completa (cron + Resend + rules + preferences)" \
  --body "Implementa Fase 6 conforme spec docs/superpowers/specs/2026-04-27-fase-6-notificacoes-design.md. **Antes de mergear:** adicionar CRON_SECRET no Vercel (Settings → Environment Variables → Production)."
```

- [ ] **Step D1.6: Manual — configurar CRON_SECRET no Vercel (USUÁRIO)**

Antes de mergear o PR:
1. Gerar secret: `openssl rand -hex 32` no terminal local
2. Em vercel.com → Project → Settings → Environment Variables
3. Add new: nome `CRON_SECRET`, valor (o output do openssl), environments: Production (e Preview se quiser)
4. Save

Sem isso o cron não roda (endpoint sempre retorna 401), mas app não quebra.

- [ ] **Step D1.7: Verificar Production deploy depois do merge**

```bash
/opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments --jq '.[0].id' \
  | xargs -I {} /opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments/{}/statuses
```

Esperar: `success`. Verificar logs no dia seguinte às 8h BRT pra ver primeiro digest rodando.

---

## Self-Review

### Cobertura do spec — seção 5.8

| Spec | Coberto por |
|---|---|
| 16 tipos de eventos | A1 (enum) |
| Notification_rules controlado por Sócio/ADM | A1 (RLS + seed) + C3 (action) + C4/C5 (UI) |
| Notification_preferences por usuário | A2 (table) + C3 (action) + C4/C5 (UI) |
| dispatchNotification central | B2 |
| Email via Resend (free tier) | B1 |
| Cron daily 8h BRT | B3 (vercel.json + endpoint + orchestrator) |
| Idempotência cron | A3 (cron_runs) + B3 (check) |
| 8 detectors (cron events) | B4 |
| Triggers tarefa (Fase 4) refatorados | C1 |
| Triggers leads novos (kanban_moved, prospeccao_agendada, deal_fechado) | C2 |
| /configuracoes/notificacoes UI | C4 + C5 |
| Tests | B1, B2, B3, D1 |

### Lacunas conhecidas (intencionais)

- mes_aguardando_aprovacao / mes_aprovado → Fase 7 (depende de snapshot)
- cliente_perto_churn → Fase 8 (depende IA)
- satisfacao_pendente → stub agora; Fase 8 implementa real
- "1h antes" granular → cortado pelo Hobby tier

---

## Resumo da entrega

Após executar:

- 16 tipos de notificação no enum + tabela de regras seedada
- Tabela de preferences por usuário
- Tabela cron_runs pra idempotência
- `dispatchNotification` central que respeita rules + preferences + extras
- Email via Resend (free tier) com template HTML escapado
- Cron diário 8h BRT (Vercel Hobby) detectando: tarefas overdue/prazo amanhã, eventos do calendário hoje, marco zero 24h, aniversários (sócio cliente 30/7/1d, colab 3d), renovações 45/15/5d
- Triggers em tarefas (refatorados via dispatch) e em leads (kanban_moved, prospeccao_agendada, deal_fechado)
- Página `/configuracoes/notificacoes` com vista admin (16 regras editáveis) + vista user (preferences pelos não-mandatory)
- Tests: 4 unit suites (template, dispatch, daily-digest, detectors) + 3 e2e auth-redirect/401

Total: **~14 commits** (A1-A4, B1-B4, C1-C5, D1).

**Próximo: Fase 7 (Comissões)** vai usar o slot 2 do cron Hobby pra snapshot mensal e plugar `mes_aguardando_aprovacao` / `mes_aprovado` no dispatcher já existente.
