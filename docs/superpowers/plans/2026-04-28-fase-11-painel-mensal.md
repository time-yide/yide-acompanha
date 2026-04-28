# Fase 11 — Painel Mensal do Assessor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar a planilha mensal Excel dos assessores para uma página `/painel` com 11 etapas por cliente, auto-delegação na cadeia principal, etapas paralelas com notificação, prazos D-X com detecção de atrasos, e histórico mensal.

**Architecture:** Adicionar 7 colunas em `clients` + criar 2 tabelas novas (`client_monthly_checklist` + `checklist_step`) com 2 enums novos. Cron mensal (plugado no `daily-digest` existente) cria checklist novo todo dia 1. Auto-delegação dispara notificações (reusa Fase 6). Página tipo planilha com permissões por papel.

**Tech Stack:** Next.js 16 + Supabase + Base UI + Tailwind + Zod + Vitest.

**Spec:** [docs/superpowers/specs/2026-04-28-fase-11-painel-mensal-design.md](../specs/2026-04-28-fase-11-painel-mensal-design.md)

**Plano anterior:** [Fase 10 — Prospecção](2026-04-28-fase-10-prospeccao.md)

**Branch:** `claude/fase-11-painel-mensal` (já criada do `main` no commit `27b6b81`)

**Fora do escopo:**
- Pipeline de Onboarding D0-D30 da entrada inicial → Fase 12 (futuro)
- Customização de prazos por cliente — prazos hardcoded
- Importação automática da planilha Excel atual
- Notificações por email (só in-app inicialmente)
- Reabertura de etapa pronta

**Pré-requisitos:**
- Branch `claude/fase-11-painel-mensal` checked out (já feito)
- Tabelas `clients`, `profiles`, `notifications`, enum `user_role` (já existem)
- `dispatchNotification` em `src/lib/notificacoes/dispatch.ts` (Fase 6)
- `daily-digest` cron em `src/lib/cron/daily-digest.ts` (Fase 6)
- Sidebar em `src/components/layout/Sidebar.tsx` (já existe)

**Estado atual no repositório:**
- `daily-digest.ts` chama 8 detectores via `safeDetect()` (último: `detectSatisfacaoPendente` da Fase 8)
- `DigestCounters` interface lista 8 counters atualmente — vamos adicionar 1 novo
- Sidebar tem 9 items — vamos adicionar 1 novo (`/painel`)
- `ColaboradorForm.tsx` (Fase 5 + ajustes na Fase 10) — pattern de form com seções
- Sem nenhum arquivo em `src/lib/painel/` — diretório novo
- Sem nenhum arquivo em `src/components/painel/` — diretório novo
- Sem rota `/painel` em `src/app/(authed)/`

**Estrutura final esperada:**

```
supabase/migrations/
├── 20260428000018_clients_painel_fields.sql               [NEW]
├── 20260428000019_checklist_tables.sql                    [NEW]
└── 20260428000020_notification_event_painel.sql           [NEW]

src/app/(authed)/painel/
├── page.tsx                                               [NEW]

src/lib/painel/
├── deadlines.ts                                           [NEW — prazos D-X + isAtrasada]
├── chain.ts                                               [NEW — auto-cadeia + paralelas]
├── queries.ts                                             [NEW — listar checklists do mês]
└── actions.ts                                             [NEW — markPronto, updateField, setResponsavel]

src/lib/cron/detectors/
└── checklist-painel.ts                                    [NEW — reset mensal + atrasos]

src/lib/cron/daily-digest.ts                               [MODIFY — add detector]

src/components/painel/
├── PainelTable.tsx                                        [NEW — server, tabela]
├── StatusCell.tsx                                         [NEW — server, célula]
├── StepModal.tsx                                          [NEW — client, modal de etapa]
├── MesSelector.tsx                                        [NEW — client]
└── PainelHeader.tsx                                       [NEW — server, header com filtros]

src/components/layout/Sidebar.tsx                          [MODIFY — add /painel item]

src/components/clientes/ClienteForm.tsx                    [MODIFY — 7 campos novos]
src/lib/clientes/schema.ts                                 [MODIFY — 7 fields novos]
src/lib/clientes/actions.ts                                [MODIFY — propagar campos]

src/types/database.ts                                      [REGENERATE]

tests/unit/
├── painel-deadlines.test.ts                               [NEW]
├── painel-chain.test.ts                                   [NEW]
├── painel-actions.test.ts                                 [NEW]
└── painel-cron.test.ts                                    [NEW]

tests/e2e/
└── painel.spec.ts                                         [NEW]
```

**Total estimado:** ~16 commits.

---

## Bloco A — Migrations + Types

### Task A1: Migration `clients_painel_fields`

**Files:**
- Create: `supabase/migrations/20260428000018_clients_painel_fields.sql`

- [ ] **Step A1.1: Escrever SQL**

```sql
-- supabase/migrations/20260428000018_clients_painel_fields.sql

alter table public.clients
  add column if not exists designer_id uuid references public.profiles(id),
  add column if not exists videomaker_id uuid references public.profiles(id),
  add column if not exists editor_id uuid references public.profiles(id),
  add column if not exists instagram_url text,
  add column if not exists gmn_url text,
  add column if not exists drive_url text,
  add column if not exists pacote_post_padrao integer;

create index if not exists idx_clients_designer on public.clients(designer_id) where designer_id is not null;
create index if not exists idx_clients_videomaker on public.clients(videomaker_id) where videomaker_id is not null;
create index if not exists idx_clients_editor on public.clients(editor_id) where editor_id is not null;
```

- [ ] **Step A1.2: Aplicar e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push --include-all
```

```bash
git add supabase/migrations/20260428000018_clients_painel_fields.sql
git commit -m "feat(db): add team and links fields to clients"
```

---

### Task A2: Migration `checklist_tables`

**Files:**
- Create: `supabase/migrations/20260428000019_checklist_tables.sql`

- [ ] **Step A2.1: Escrever SQL**

```sql
-- supabase/migrations/20260428000019_checklist_tables.sql

-- Enums
create type public.checklist_step_status as enum (
  'pendente',
  'em_andamento',
  'pronto',
  'atrasada'
);

create type public.checklist_step_key as enum (
  'cronograma',
  'design',
  'tpg',
  'tpm',
  'valor_trafego',
  'gmn_post',
  'camera',
  'mobile',
  'edicao',
  'reuniao',
  'postagem'
);

-- =============================================
-- Tabela: client_monthly_checklist
-- =============================================
create table public.client_monthly_checklist (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mes_referencia text not null,
  pacote_post integer,
  quantidade_postada integer,
  valor_trafego_mes numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(client_id, mes_referencia)
);

create index idx_checklist_client_mes on public.client_monthly_checklist(client_id, mes_referencia);
create index idx_checklist_mes on public.client_monthly_checklist(mes_referencia);
create index idx_checklist_org on public.client_monthly_checklist(organization_id);

create trigger trg_checklist_updated_at
  before update on public.client_monthly_checklist
  for each row execute function public.set_updated_at();

alter table public.client_monthly_checklist enable row level security;

create policy "checklist select all authenticated"
  on public.client_monthly_checklist for select to authenticated using (true);

create policy "checklist update by team"
  on public.client_monthly_checklist for update to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador') OR
    exists (
      select 1 from public.clients c
      where c.id = client_id AND (
        c.assessor_id = auth.uid() OR
        c.coordenador_id = auth.uid() OR
        c.designer_id = auth.uid() OR
        c.videomaker_id = auth.uid() OR
        c.editor_id = auth.uid()
      )
    )
  );

-- INSERT/DELETE: só service-role (cron)

-- =============================================
-- Tabela: checklist_step
-- =============================================
create table public.checklist_step (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.client_monthly_checklist(id) on delete cascade,
  step_key public.checklist_step_key not null,
  status public.checklist_step_status not null default 'pendente',
  responsavel_id uuid references public.profiles(id),
  iniciado_em timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  unique(checklist_id, step_key)
);

create index idx_step_checklist on public.checklist_step(checklist_id);
create index idx_step_responsavel_pendente on public.checklist_step(responsavel_id, status) where status != 'pronto';

alter table public.checklist_step enable row level security;

create policy "step select all authenticated"
  on public.checklist_step for select to authenticated using (true);

create policy "step update by responsavel or admin"
  on public.checklist_step for update to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador') OR
    responsavel_id = auth.uid() OR
    exists (
      select 1 from public.client_monthly_checklist cmc
      join public.clients c on c.id = cmc.client_id
      where cmc.id = checklist_id AND c.assessor_id = auth.uid()
    )
  );

-- INSERT/DELETE: só service-role (cron)
```

- [ ] **Step A2.2: Aplicar e commit**

```bash
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push --include-all
git add supabase/migrations/20260428000019_checklist_tables.sql
git commit -m "feat(db): create client_monthly_checklist and checklist_step tables with RLS"
```

---

### Task A3: Migration `notification_event_painel`

**Files:**
- Create: `supabase/migrations/20260428000020_notification_event_painel.sql`

- [ ] **Step A3.1: Escrever SQL**

```sql
-- supabase/migrations/20260428000020_notification_event_painel.sql

alter type public.notification_event add value if not exists 'checklist_step_delegada';
alter type public.notification_event add value if not exists 'checklist_step_atrasada';
alter type public.notification_event add value if not exists 'checklist_step_concluida';

-- Inserir defaults em notification_rules (in-app pra todos os papéis)
insert into public.notification_rules (evento_tipo, role, canal_in_app, canal_email, ativo, organization_id)
select
  evento::public.notification_event,
  role::public.user_role,
  true as canal_in_app,
  false as canal_email,
  true as ativo,
  o.id as organization_id
from public.organizations o
cross join (values
  ('checklist_step_delegada'),
  ('checklist_step_atrasada'),
  ('checklist_step_concluida')
) as e(evento)
cross join (values
  ('socio'),
  ('adm'),
  ('coordenador'),
  ('assessor'),
  ('designer'),
  ('videomaker'),
  ('editor'),
  ('audiovisual_chefe')
) as r(role)
on conflict do nothing;
```

**Note:** PostgreSQL exige que `ALTER TYPE ... ADD VALUE` seja em transações separadas dos usos do enum. O `INSERT ... cross join values` usa o enum acabado de adicionar — pode falhar. Solução: rodar a migração em duas partes ou usar `COMMIT;` no meio. Como Supabase migrations rodam tudo em uma transação por padrão, vamos dividir:

Substitua o SQL acima por essa versão:

```sql
-- supabase/migrations/20260428000020_notification_event_painel.sql

-- Apenas o ALTER TYPE — o INSERT vai numa migração separada
alter type public.notification_event add value if not exists 'checklist_step_delegada';
alter type public.notification_event add value if not exists 'checklist_step_atrasada';
alter type public.notification_event add value if not exists 'checklist_step_concluida';
```

E crie uma segunda migração `20260428000021_notification_rules_painel_seed.sql`:

```sql
-- supabase/migrations/20260428000021_notification_rules_painel_seed.sql

insert into public.notification_rules (evento_tipo, role, canal_in_app, canal_email, ativo, organization_id)
select
  evento::public.notification_event,
  role::public.user_role,
  true as canal_in_app,
  false as canal_email,
  true as ativo,
  o.id as organization_id
from public.organizations o
cross join (values
  ('checklist_step_delegada'),
  ('checklist_step_atrasada'),
  ('checklist_step_concluida')
) as e(evento)
cross join (values
  ('socio'),
  ('adm'),
  ('coordenador'),
  ('assessor'),
  ('designer'),
  ('videomaker'),
  ('editor'),
  ('audiovisual_chefe')
) as r(role)
on conflict do nothing;
```

- [ ] **Step A3.2: Aplicar e commit**

```bash
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push --include-all
git add supabase/migrations/20260428000020_notification_event_painel.sql \
  supabase/migrations/20260428000021_notification_rules_painel_seed.sql
git commit -m "feat(db): add 3 notification events for painel + default rules"
```

---

### Task A4: Regenerar tipos do banco

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step A4.1: Regenerar e verificar**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  SUPABASE_PROJECT_ID=jelvhwbpipawghwufpbc \
  npm run db:types
npm run typecheck
```

Esperar: `clients` ganha 7 campos. `client_monthly_checklist` e `checklist_step` em `Tables`. Enums `checklist_step_status` e `checklist_step_key` em `Enums`. `notification_event` enum tem os 3 valores novos. Typecheck clean.

- [ ] **Step A4.2: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(db): regenerate types after painel migrations"
```

---

## Bloco B — Backend

### Task B1: `deadlines.ts` + `chain.ts` (helpers puros, TDD)

**Files:**
- Create: `src/lib/painel/deadlines.ts`
- Create: `src/lib/painel/chain.ts`
- Create: `tests/unit/painel-deadlines.test.ts`
- Create: `tests/unit/painel-chain.test.ts`

- [ ] **Step B1.1: Criar testes de deadlines**

`tests/unit/painel-deadlines.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { STEP_DEADLINES, isAtrasada, getDeadline } from "@/lib/painel/deadlines";

describe("STEP_DEADLINES", () => {
  it("tem 11 etapas com prazos", () => {
    expect(Object.keys(STEP_DEADLINES)).toHaveLength(11);
  });

  it("cronograma é dia 7", () => {
    expect(STEP_DEADLINES.cronograma).toBe(7);
  });

  it("postagem é dia 30", () => {
    expect(STEP_DEADLINES.postagem).toBe(30);
  });

  it("design/camera/mobile/edicao são dia 23", () => {
    expect(STEP_DEADLINES.design).toBe(23);
    expect(STEP_DEADLINES.camera).toBe(23);
    expect(STEP_DEADLINES.mobile).toBe(23);
    expect(STEP_DEADLINES.edicao).toBe(23);
  });
});

describe("getDeadline", () => {
  it("retorna prazo da etapa", () => {
    expect(getDeadline("cronograma")).toBe(7);
    expect(getDeadline("postagem")).toBe(30);
  });
});

describe("isAtrasada", () => {
  it("retorna false se status é pronto, mesmo passou do prazo", () => {
    const today = new Date(Date.UTC(2026, 4, 15)); // dia 15 de maio
    expect(isAtrasada("cronograma", "pronto", today)).toBe(false);
  });

  it("retorna true se hoje > prazo e status != pronto", () => {
    const today = new Date(Date.UTC(2026, 4, 15)); // dia 15 — cronograma deveria estar pronto até dia 7
    expect(isAtrasada("cronograma", "pendente", today)).toBe(true);
    expect(isAtrasada("cronograma", "em_andamento", today)).toBe(true);
  });

  it("retorna false se hoje <= prazo", () => {
    const today = new Date(Date.UTC(2026, 4, 5)); // dia 5
    expect(isAtrasada("cronograma", "pendente", today)).toBe(false);
  });

  it("postagem prazo dia 30 — dia 30 ainda não é atrasada", () => {
    const today = new Date(Date.UTC(2026, 4, 30));
    expect(isAtrasada("postagem", "pendente", today)).toBe(false);
  });

  it("postagem prazo dia 30 — dia 31 é atrasada", () => {
    const today = new Date(Date.UTC(2026, 4, 31));
    expect(isAtrasada("postagem", "pendente", today)).toBe(true);
  });
});
```

- [ ] **Step B1.2: Rodar testes, esperar falhar**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm run test -- tests/unit/painel-deadlines.test.ts
```

- [ ] **Step B1.3: Criar `src/lib/painel/deadlines.ts`**

```ts
export type StepKey =
  | "cronograma"
  | "design"
  | "tpg"
  | "tpm"
  | "valor_trafego"
  | "gmn_post"
  | "camera"
  | "mobile"
  | "edicao"
  | "reuniao"
  | "postagem";

export type StepStatus = "pendente" | "em_andamento" | "pronto" | "atrasada";

/**
 * Prazos D-X (dia do mês) por etapa.
 * Calculados relativos ao primeiro dia do mês corrente.
 * Hardcoded — pode ser tornar configurável por cliente em fase futura.
 */
export const STEP_DEADLINES: Record<StepKey, number> = {
  cronograma: 7,
  tpg: 12,
  tpm: 12,
  valor_trafego: 12,
  design: 23,
  camera: 23,
  mobile: 23,
  edicao: 23,
  gmn_post: 26,
  reuniao: 26,
  postagem: 30,
};

export function getDeadline(stepKey: StepKey): number {
  return STEP_DEADLINES[stepKey];
}

export function isAtrasada(stepKey: StepKey, status: StepStatus, today: Date = new Date()): boolean {
  if (status === "pronto") return false;
  const dia = today.getUTCDate();
  return dia > STEP_DEADLINES[stepKey];
}
```

- [ ] **Step B1.4: Rodar testes de deadlines, passar**

```bash
npm run test -- tests/unit/painel-deadlines.test.ts
```

Esperar: 8/8 pass.

- [ ] **Step B1.5: Criar testes de chain**

`tests/unit/painel-chain.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveNextStep, isParallelStep, getResponsavelFor } from "@/lib/painel/chain";

const clienteFake = {
  id: "c1",
  assessor_id: "u-assessor",
  coordenador_id: "u-coord",
  designer_id: "u-designer",
  videomaker_id: "u-videomaker",
  editor_id: "u-editor",
};

describe("resolveNextStep", () => {
  it("cronograma → design (com videomaker_id como next responsavel? não — designer_id)", () => {
    const r = resolveNextStep("cronograma", clienteFake);
    expect(r).toEqual({ next: "design", responsavel_id: "u-designer" });
  });

  it("design → camera (videomaker)", () => {
    const r = resolveNextStep("design", clienteFake);
    expect(r).toEqual({ next: "camera", responsavel_id: "u-videomaker" });
  });

  it("edicao → postagem (assessor)", () => {
    const r = resolveNextStep("edicao", clienteFake);
    expect(r).toEqual({ next: "postagem", responsavel_id: "u-assessor" });
  });

  it("postagem é fim da cadeia, retorna null", () => {
    expect(resolveNextStep("postagem", clienteFake)).toBeNull();
  });

  it("etapas paralelas retornam null (não disparam próxima)", () => {
    expect(resolveNextStep("tpg", clienteFake)).toBeNull();
    expect(resolveNextStep("tpm", clienteFake)).toBeNull();
    expect(resolveNextStep("gmn_post", clienteFake)).toBeNull();
    expect(resolveNextStep("reuniao", clienteFake)).toBeNull();
    expect(resolveNextStep("valor_trafego", clienteFake)).toBeNull();
  });

  it("camera quando mobile já pronto → desbloqueia edicao com editor_id", () => {
    const r = resolveNextStep("camera", clienteFake, { mobileAlreadyPronto: true });
    expect(r).toEqual({ next: "edicao", responsavel_id: "u-editor" });
  });

  it("camera quando mobile NÃO pronto → não destrava edição", () => {
    const r = resolveNextStep("camera", clienteFake, { mobileAlreadyPronto: false });
    expect(r).toBeNull();
  });

  it("mobile quando camera já pronto → desbloqueia edicao", () => {
    const r = resolveNextStep("mobile", clienteFake, { cameraAlreadyPronto: true });
    expect(r).toEqual({ next: "edicao", responsavel_id: "u-editor" });
  });

  it("retorna responsavel_id null se cliente não tem o FK definido", () => {
    const sem = { ...clienteFake, designer_id: null };
    const r = resolveNextStep("cronograma", sem);
    expect(r).toEqual({ next: "design", responsavel_id: null });
  });
});

describe("isParallelStep", () => {
  it("identifica etapas paralelas", () => {
    expect(isParallelStep("tpg")).toBe(true);
    expect(isParallelStep("tpm")).toBe(true);
    expect(isParallelStep("gmn_post")).toBe(true);
    expect(isParallelStep("reuniao")).toBe(true);
    expect(isParallelStep("valor_trafego")).toBe(true);
  });

  it("etapas da cadeia principal não são paralelas", () => {
    expect(isParallelStep("cronograma")).toBe(false);
    expect(isParallelStep("design")).toBe(false);
    expect(isParallelStep("camera")).toBe(false);
    expect(isParallelStep("mobile")).toBe(false);
    expect(isParallelStep("edicao")).toBe(false);
    expect(isParallelStep("postagem")).toBe(false);
  });
});

describe("getResponsavelFor", () => {
  it("cronograma → assessor_id", () => {
    expect(getResponsavelFor("cronograma", clienteFake)).toBe("u-assessor");
  });

  it("design → designer_id", () => {
    expect(getResponsavelFor("design", clienteFake)).toBe("u-designer");
  });

  it("camera → videomaker_id", () => {
    expect(getResponsavelFor("camera", clienteFake)).toBe("u-videomaker");
  });

  it("mobile → videomaker_id", () => {
    expect(getResponsavelFor("mobile", clienteFake)).toBe("u-videomaker");
  });

  it("edicao → editor_id", () => {
    expect(getResponsavelFor("edicao", clienteFake)).toBe("u-editor");
  });

  it("paralelas → assessor_id (default)", () => {
    expect(getResponsavelFor("tpg", clienteFake)).toBe("u-assessor");
    expect(getResponsavelFor("tpm", clienteFake)).toBe("u-assessor");
    expect(getResponsavelFor("gmn_post", clienteFake)).toBe("u-assessor");
    expect(getResponsavelFor("reuniao", clienteFake)).toBe("u-assessor");
    expect(getResponsavelFor("valor_trafego", clienteFake)).toBe("u-assessor");
  });
});
```

- [ ] **Step B1.6: Rodar testes de chain, falhar**

```bash
npm run test -- tests/unit/painel-chain.test.ts
```

- [ ] **Step B1.7: Criar `src/lib/painel/chain.ts`**

```ts
import type { StepKey } from "./deadlines";

export interface ClienteRefs {
  id: string;
  assessor_id: string | null;
  coordenador_id: string | null;
  designer_id: string | null;
  videomaker_id: string | null;
  editor_id: string | null;
}

const PARALLEL_STEPS: StepKey[] = ["tpg", "tpm", "valor_trafego", "gmn_post", "reuniao"];

export function isParallelStep(stepKey: StepKey): boolean {
  return PARALLEL_STEPS.includes(stepKey);
}

export function getResponsavelFor(stepKey: StepKey, cliente: ClienteRefs): string | null {
  switch (stepKey) {
    case "design":
      return cliente.designer_id;
    case "camera":
    case "mobile":
      return cliente.videomaker_id;
    case "edicao":
      return cliente.editor_id;
    case "cronograma":
    case "tpg":
    case "tpm":
    case "valor_trafego":
    case "gmn_post":
    case "reuniao":
    case "postagem":
      return cliente.assessor_id;
  }
}

interface ResolveContext {
  cameraAlreadyPronto?: boolean;
  mobileAlreadyPronto?: boolean;
}

export interface NextStepResult {
  next: StepKey;
  responsavel_id: string | null;
}

export function resolveNextStep(
  current: StepKey,
  cliente: ClienteRefs,
  ctx: ResolveContext = {},
): NextStepResult | null {
  if (isParallelStep(current)) return null;

  switch (current) {
    case "cronograma":
      return { next: "design", responsavel_id: cliente.designer_id };
    case "design":
      return { next: "camera", responsavel_id: cliente.videomaker_id };
    case "camera":
      // só destrava edição se mobile já estiver pronto
      if (ctx.mobileAlreadyPronto) {
        return { next: "edicao", responsavel_id: cliente.editor_id };
      }
      return null;
    case "mobile":
      // só destrava edição se camera já estiver pronto
      if (ctx.cameraAlreadyPronto) {
        return { next: "edicao", responsavel_id: cliente.editor_id };
      }
      return null;
    case "edicao":
      return { next: "postagem", responsavel_id: cliente.assessor_id };
    case "postagem":
      return null;
  }
}
```

- [ ] **Step B1.8: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/painel-chain.test.ts
npm run test -- tests/unit/painel-deadlines.test.ts
npm run typecheck
```

Esperar: 8 deadlines + 14 chain = 22 testes passam, typecheck clean.

- [ ] **Step B1.9: Commit**

```bash
git add src/lib/painel/deadlines.ts src/lib/painel/chain.ts \
  tests/unit/painel-deadlines.test.ts tests/unit/painel-chain.test.ts
git commit -m "feat(painel): deadlines and chain helpers (TDD)"
```

---

### Task B2: `queries.ts` (TDD)

**Files:**
- Create: `src/lib/painel/queries.ts`

A função `getMonthlyChecklists` retorna a lista de clientes com seus checklists e steps do mês especificado. Filtros por `assessorId`, `coordenadorId`, ou IDs específicos (designer/videomaker/editor) determinam quem vê o quê.

- [ ] **Step B2.1: Criar `src/lib/painel/queries.ts`**

```ts
// SERVER ONLY: do not import from client components
import { createClient } from "@/lib/supabase/server";
import type { StepKey, StepStatus } from "./deadlines";

export interface ChecklistFilter {
  assessorId?: string;
  coordenadorId?: string;
  designerId?: string;
  videomakerId?: string;
  editorId?: string;
}

export interface ChecklistStepRow {
  id: string;
  step_key: StepKey;
  status: StepStatus;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  iniciado_em: string | null;
  completed_at: string | null;
  completed_by: string | null;
}

export interface ChecklistRow {
  id: string;
  client_id: string;
  client_nome: string;
  client_designer_id: string | null;
  client_videomaker_id: string | null;
  client_editor_id: string | null;
  client_drive_url: string | null;
  client_instagram_url: string | null;
  mes_referencia: string;
  pacote_post: number | null;
  quantidade_postada: number | null;
  valor_trafego_mes: number | null;
  steps: ChecklistStepRow[];
}

export async function getMonthlyChecklists(
  mesReferencia: string,
  filter: ChecklistFilter = {},
): Promise<ChecklistRow[]> {
  const supabase = await createClient();

  // 1) Lista clientes filtrados
  let clientsQuery = supabase
    .from("clients")
    .select("id, nome, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id, drive_url, instagram_url")
    .eq("status", "ativo");

  if (filter.assessorId) clientsQuery = clientsQuery.eq("assessor_id", filter.assessorId);
  if (filter.coordenadorId) clientsQuery = clientsQuery.eq("coordenador_id", filter.coordenadorId);
  if (filter.designerId) clientsQuery = clientsQuery.eq("designer_id", filter.designerId);
  if (filter.videomakerId) clientsQuery = clientsQuery.eq("videomaker_id", filter.videomakerId);
  if (filter.editorId) clientsQuery = clientsQuery.eq("editor_id", filter.editorId);

  const { data: clientsData } = await clientsQuery.order("nome");
  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    assessor_id: string | null;
    coordenador_id: string | null;
    designer_id: string | null;
    videomaker_id: string | null;
    editor_id: string | null;
    drive_url: string | null;
    instagram_url: string | null;
  }>;

  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);

  // 2) Carrega checklists do mês
  const { data: checklistsData } = await supabase
    .from("client_monthly_checklist")
    .select("id, client_id, mes_referencia, pacote_post, quantidade_postada, valor_trafego_mes")
    .eq("mes_referencia", mesReferencia)
    .in("client_id", clientIds);

  const checklists = (checklistsData ?? []) as Array<{
    id: string;
    client_id: string;
    mes_referencia: string;
    pacote_post: number | null;
    quantidade_postada: number | null;
    valor_trafego_mes: number | null;
  }>;

  if (checklists.length === 0) {
    // Cliente ativo mas sem checklist ainda: retorna client sem steps
    return clients.map((c) => ({
      id: "",
      client_id: c.id,
      client_nome: c.nome,
      client_designer_id: c.designer_id,
      client_videomaker_id: c.videomaker_id,
      client_editor_id: c.editor_id,
      client_drive_url: c.drive_url,
      client_instagram_url: c.instagram_url,
      mes_referencia: mesReferencia,
      pacote_post: null,
      quantidade_postada: null,
      valor_trafego_mes: null,
      steps: [],
    }));
  }

  const checklistIds = checklists.map((cl) => cl.id);

  // 3) Carrega steps de todos os checklists com nome do responsável
  const { data: stepsData } = await supabase
    .from("checklist_step")
    .select("id, checklist_id, step_key, status, responsavel_id, iniciado_em, completed_at, completed_by, responsavel:profiles!checklist_step_responsavel_id_fkey(nome)")
    .in("checklist_id", checklistIds);

  const steps = (stepsData ?? []) as unknown as Array<{
    id: string;
    checklist_id: string;
    step_key: StepKey;
    status: StepStatus;
    responsavel_id: string | null;
    responsavel: { nome: string } | null;
    iniciado_em: string | null;
    completed_at: string | null;
    completed_by: string | null;
  }>;

  // 4) Agrupa steps por checklist
  const stepsByChecklist = new Map<string, ChecklistStepRow[]>();
  for (const s of steps) {
    const arr = stepsByChecklist.get(s.checklist_id) ?? [];
    arr.push({
      id: s.id,
      step_key: s.step_key,
      status: s.status,
      responsavel_id: s.responsavel_id,
      responsavel_nome: s.responsavel?.nome ?? null,
      iniciado_em: s.iniciado_em,
      completed_at: s.completed_at,
      completed_by: s.completed_by,
    });
    stepsByChecklist.set(s.checklist_id, arr);
  }

  // 5) Mapeia clientes → ChecklistRow (alguns podem não ter checklist do mês)
  return clients.map((c) => {
    const cl = checklists.find((x) => x.client_id === c.id);
    return {
      id: cl?.id ?? "",
      client_id: c.id,
      client_nome: c.nome,
      client_designer_id: c.designer_id,
      client_videomaker_id: c.videomaker_id,
      client_editor_id: c.editor_id,
      client_drive_url: c.drive_url,
      client_instagram_url: c.instagram_url,
      mes_referencia: mesReferencia,
      pacote_post: cl?.pacote_post ?? null,
      quantidade_postada: cl?.quantidade_postada ?? null,
      valor_trafego_mes: cl?.valor_trafego_mes ?? null,
      steps: cl ? (stepsByChecklist.get(cl.id) ?? []) : [],
    };
  });
}
```

- [ ] **Step B2.2: Typecheck**

```bash
npm run typecheck
```

Esperar: clean.

- [ ] **Step B2.3: Commit**

```bash
git add src/lib/painel/queries.ts
git commit -m "feat(painel): getMonthlyChecklists query with filters"
```

---

### Task B3: `actions.ts` (TDD)

**Files:**
- Create: `src/lib/painel/actions.ts`
- Create: `tests/unit/painel-actions.test.ts`

- [ ] **Step B3.1: Escrever testes**

`tests/unit/painel-actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { markStepProntoAction, updateChecklistFieldAction } from "@/lib/painel/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  dispatchMock.mockReset();
  requireAuthMock.mockResolvedValue({ id: "u1", role: "assessor", nome: "Maria", organization_id: "org1" });
});

describe("markStepProntoAction", () => {
  it("rejeita stepId inválido", async () => {
    const fd = new FormData();
    fd.set("step_id", "not-a-uuid");
    const r = await markStepProntoAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });

  it("marca etapa cronograma como pronto e cria/atualiza próxima (design) com responsavel = designer_id", async () => {
    const updateStepMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const upsertNextStepMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table) => {
      if (table === "checklist_step") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "step-cronograma",
                  checklist_id: "cl1",
                  step_key: "cronograma",
                  status: "em_andamento",
                  responsavel_id: "u1",
                  client_monthly_checklist: {
                    id: "cl1",
                    client_id: "c1",
                    cliente: {
                      id: "c1",
                      assessor_id: "u-assessor",
                      coordenador_id: "u-coord",
                      designer_id: "u-designer",
                      videomaker_id: "u-vm",
                      editor_id: "u-ed",
                    },
                  },
                },
              }),
            }),
          }),
          update: updateStepMock,
          upsert: upsertNextStepMock,
        };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("step_id", "00000000-0000-0000-0000-000000000001");
    const r = await markStepProntoAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(updateStepMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pronto", completed_by: "u1" }),
    );
    expect(upsertNextStepMock).toHaveBeenCalledWith(
      expect.objectContaining({
        step_key: "design",
        responsavel_id: "u-designer",
        status: "em_andamento",
      }),
      expect.any(Object),
    );
    // Notifica delegação
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "checklist_step_delegada" }),
    );
  });

  it("marca paralela (tpg) como pronto e dispara notificação 'checklist_step_concluida' (não cria próxima)", async () => {
    const updateStepMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    fromMock.mockImplementation((table) => {
      if (table === "checklist_step") {
        return {
          select: () => ({
            eq: () => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: "step-tpg",
                  checklist_id: "cl1",
                  step_key: "tpg",
                  status: "em_andamento",
                  responsavel_id: "u1",
                  client_monthly_checklist: {
                    id: "cl1",
                    client_id: "c1",
                    cliente: {
                      id: "c1",
                      assessor_id: "u-assessor",
                      coordenador_id: "u-coord",
                      designer_id: "u-designer",
                      videomaker_id: "u-vm",
                      editor_id: "u-ed",
                    },
                  },
                },
              }),
            }),
          }),
          update: updateStepMock,
        };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("step_id", "00000000-0000-0000-0000-000000000002");
    const r = await markStepProntoAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "checklist_step_concluida" }),
    );
  });

  it("camera quando mobile já pronto → desbloqueia edição com editor_id", async () => {
    const updateStepMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const upsertNextStepMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table) => {
      if (table === "checklist_step") {
        // 1ª chamada: select do step camera
        // 2ª chamada: select do step mobile (pra ver se já está pronto)
        // 3ª: update camera
        // 4ª: upsert edicao
        let selectCalls = 0;
        return {
          select: (cols: string) => {
            selectCalls++;
            if (cols.includes("client_monthly_checklist")) {
              return {
                eq: () => ({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "step-camera",
                      checklist_id: "cl1",
                      step_key: "camera",
                      status: "em_andamento",
                      responsavel_id: "u1",
                      client_monthly_checklist: {
                        id: "cl1",
                        client_id: "c1",
                        cliente: {
                          id: "c1",
                          assessor_id: "u-assessor",
                          coordenador_id: "u-coord",
                          designer_id: "u-designer",
                          videomaker_id: "u-vm",
                          editor_id: "u-editor",
                        },
                      },
                    },
                  }),
                }),
              };
            }
            // Lookup de mobile_status no mesmo checklist
            return {
              eq: () => ({
                eq: vi.fn().mockResolvedValue({
                  data: [{ status: "pronto" }],
                }),
              }),
            };
          },
          update: updateStepMock,
          upsert: upsertNextStepMock,
        };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("step_id", "00000000-0000-0000-0000-000000000003");
    const r = await markStepProntoAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(upsertNextStepMock).toHaveBeenCalledWith(
      expect.objectContaining({ step_key: "edicao", responsavel_id: "u-editor" }),
      expect.any(Object),
    );
  });
});

describe("updateChecklistFieldAction", () => {
  it("atualiza valor_trafego_mes", async () => {
    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    fromMock.mockImplementation((table) => {
      if (table === "client_monthly_checklist") {
        return { update: updateMock };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("checklist_id", "00000000-0000-0000-0000-000000000010");
    fd.set("field", "valor_trafego_mes");
    fd.set("value", "2500");
    const r = await updateChecklistFieldAction(fd);
    expect(r).toEqual(expect.objectContaining({ success: true }));
    expect(updateMock).toHaveBeenCalledWith({ valor_trafego_mes: 2500 });
  });

  it("rejeita campo não permitido", async () => {
    const fd = new FormData();
    fd.set("checklist_id", "00000000-0000-0000-0000-000000000010");
    fd.set("field", "client_id"); // campo não permitido
    fd.set("value", "anything");
    const r = await updateChecklistFieldAction(fd);
    expect(r).toEqual(expect.objectContaining({ error: expect.any(String) }));
  });
});
```

- [ ] **Step B3.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/painel-actions.test.ts
```

- [ ] **Step B3.3: Criar `src/lib/painel/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { resolveNextStep, isParallelStep, type ClienteRefs } from "./chain";
import type { StepKey } from "./deadlines";

interface ActionOk { success: true }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

const markProntoSchema = z.object({
  step_id: z.string().uuid(),
});

const ALLOWED_FIELDS = ["pacote_post", "quantidade_postada", "valor_trafego_mes"] as const;
const updateFieldSchema = z.object({
  checklist_id: z.string().uuid(),
  field: z.enum(ALLOWED_FIELDS),
  value: z.string(),
});

export async function markStepProntoAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = markProntoSchema.safeParse({ step_id: formData.get("step_id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  // Carrega step + checklist + cliente refs
  const { data: stepData } = await supabase
    .from("checklist_step")
    .select("id, checklist_id, step_key, status, responsavel_id, client_monthly_checklist:client_monthly_checklist(id, client_id, cliente:clients(id, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id))")
    .eq("id", parsed.data.step_id)
    .single();

  if (!stepData) return { error: "Etapa não encontrada" };

  const step = stepData as unknown as {
    id: string;
    checklist_id: string;
    step_key: StepKey;
    status: string;
    responsavel_id: string | null;
    client_monthly_checklist: {
      id: string;
      client_id: string;
      cliente: ClienteRefs;
    };
  };

  const cliente = step.client_monthly_checklist.cliente;

  // Atualiza step atual como pronto
  const { error: updateErr } = await supabase
    .from("checklist_step")
    .update({
      status: "pronto",
      completed_at: new Date().toISOString(),
      completed_by: actor.id,
    })
    .eq("id", step.id);
  if (updateErr) return { error: updateErr.message };

  // Caso especial: camera ou mobile pronto → checa se o outro já está pronto pra desbloquear edição
  let nextCtx: { cameraAlreadyPronto?: boolean; mobileAlreadyPronto?: boolean } = {};
  if (step.step_key === "camera" || step.step_key === "mobile") {
    const otherKey = step.step_key === "camera" ? "mobile" : "camera";
    const { data: otherSteps } = await supabase
      .from("checklist_step")
      .select("status")
      .eq("checklist_id", step.checklist_id)
      .eq("step_key", otherKey);
    const isOtherPronto = (otherSteps ?? []).some((s) => (s as { status: string }).status === "pronto");
    if (step.step_key === "camera") nextCtx.mobileAlreadyPronto = isOtherPronto;
    else nextCtx.cameraAlreadyPronto = isOtherPronto;
  }

  // Resolve próxima etapa (cadeia)
  const nextStep = resolveNextStep(step.step_key, cliente, nextCtx);

  if (nextStep) {
    // Cria/atualiza próxima etapa via upsert (caso não exista, cria; caso exista, atualiza)
    await supabase.from("checklist_step").upsert(
      {
        checklist_id: step.checklist_id,
        step_key: nextStep.next,
        status: "em_andamento",
        responsavel_id: nextStep.responsavel_id,
        iniciado_em: new Date().toISOString(),
      },
      { onConflict: "checklist_id,step_key" },
    );

    // Notifica delegação se temos responsável
    if (nextStep.responsavel_id) {
      await dispatchNotification({
        evento_tipo: "checklist_step_delegada",
        titulo: `Etapa "${nextStep.next}" delegada pra você`,
        mensagem: `Cliente — fase ${nextStep.next} aguardando você`,
        link: "/painel",
        target_user_id: nextStep.responsavel_id,
      });
    } else {
      // Sem responsável → notifica Coord+Sócios pra definir
      if (cliente.coordenador_id) {
        await dispatchNotification({
          evento_tipo: "checklist_step_delegada",
          titulo: `Defina ${nextStep.next} pra cliente`,
          mensagem: `Cliente sem ${nextStep.next === "design" ? "designer" : nextStep.next === "edicao" ? "editor" : "videomaker"} cadastrado`,
          link: "/painel",
          target_user_id: cliente.coordenador_id,
        });
      }
    }
  } else if (isParallelStep(step.step_key)) {
    // Paralela concluída → notifica Coord+Sócios+ADM
    await dispatchNotification({
      evento_tipo: "checklist_step_concluida",
      titulo: `Etapa "${step.step_key}" concluída`,
      mensagem: `Por ${actor.nome}`,
      link: "/painel",
      // target_role broadcast: implementação fica do lado do dispatch
      target_role: "coordenador",
    });
    // Adicionalmente, despachar pra sócio/adm: implementer deve ler dispatch.ts e iterar
    // sobre os papéis, OU usar broadcast por role se a signature suportar
  }

  revalidatePath("/painel");
  return { success: true };
}

export async function updateChecklistFieldAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = updateFieldSchema.safeParse({
    checklist_id: formData.get("checklist_id"),
    field: formData.get("field"),
    value: formData.get("value"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const numericValue = Number(parsed.data.value);
  if (Number.isNaN(numericValue)) return { error: "Valor inválido" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_monthly_checklist")
    .update({ [parsed.data.field]: numericValue })
    .eq("id", parsed.data.checklist_id);

  if (error) return { error: error.message };

  revalidatePath("/painel");
  return { success: true };
}
```

**Note:** essa implementação assume que `dispatchNotification` aceita `target_user_id` ou `target_role`. Ler a assinatura real em `src/lib/notificacoes/dispatch.ts` e ajustar se necessário. Se não houver `target_role`, pode iterar e enviar individualmente. Implementer deve ler dispatch.ts antes.

- [ ] **Step B3.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/painel-actions.test.ts
npm run typecheck
```

Esperar: 5/5 pass, typecheck clean.

- [ ] **Step B3.5: Commit**

```bash
git add src/lib/painel/actions.ts tests/unit/painel-actions.test.ts
git commit -m "feat(painel): markStepProntoAction with auto-chain delegation (TDD)"
```

---

### Task B4: Detector cron `checklist-painel` (TDD)

**Files:**
- Create: `src/lib/cron/detectors/checklist-painel.ts`
- Create: `tests/unit/painel-cron.test.ts`
- Modify: `src/lib/cron/daily-digest.ts`

- [ ] **Step B4.1: Escrever testes**

`tests/unit/painel-cron.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));

import { detectChecklistPainel } from "@/lib/cron/detectors/checklist-painel";

beforeEach(() => {
  fromMock.mockReset();
  dispatchMock.mockReset();
});

describe("detectChecklistPainel — reset mensal (dia 1)", () => {
  it("dia 1 do mês: cria checklist + 11 steps por cliente ativo (idempotente)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 1, 12, 0, 0))); // 1º maio

    const upsertChecklistMock = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "cl1", client_id: "c1" }],
        error: null,
      }),
    });
    const upsertStepsMock = vi.fn().mockResolvedValue({ error: null });

    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: "c1", assessor_id: "u-assessor", organization_id: "org1", pacote_post_padrao: 12 },
              ],
            }),
          }),
        };
      }
      if (table === "client_monthly_checklist") {
        return { upsert: upsertChecklistMock };
      }
      if (table === "checklist_step") {
        return { upsert: upsertStepsMock };
      }
      return {};
    });

    const counters = { checklist_painel: 0 };
    await detectChecklistPainel(counters);

    expect(upsertChecklistMock).toHaveBeenCalled();
    expect(upsertStepsMock).toHaveBeenCalled();
    // Aceita ser chamada com qualquer payload — o importante é que rodou
    expect(counters.checklist_painel).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});

describe("detectChecklistPainel — atrasos", () => {
  it("dia 15 do mês: marca cronograma (deadline dia 7) como atrasada se não pronto", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 15, 12, 0, 0))); // dia 15 maio

    const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    fromMock.mockImplementation((table) => {
      if (table === "clients") {
        return {
          select: () => ({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
        };
      }
      if (table === "checklist_step") {
        return {
          select: () => ({
            eq: () => ({
              neq: vi.fn().mockResolvedValue({
                data: [
                  // step cronograma pendente, mes_referencia atual
                  { id: "s1", step_key: "cronograma", status: "em_andamento", responsavel_id: "u-ass", checklist_id: "cl1" },
                  // step postagem pendente mas dia 15 < deadline 30 → não atrasada
                  { id: "s2", step_key: "postagem", status: "pendente", responsavel_id: "u-ass", checklist_id: "cl1" },
                ],
              }),
            }),
          }),
          update: updateMock,
        };
      }
      return {};
    });

    const counters = { checklist_painel: 0 };
    await detectChecklistPainel(counters);

    // Cronograma deveria virar atrasada
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "atrasada" }));
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "checklist_step_atrasada" }),
    );

    vi.useRealTimers();
  });
});
```

- [ ] **Step B4.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/painel-cron.test.ts
```

- [ ] **Step B4.3: Criar `src/lib/cron/detectors/checklist-painel.ts`**

```ts
// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { isAtrasada, type StepKey, type StepStatus } from "@/lib/painel/deadlines";

const ALL_STEPS: StepKey[] = [
  "cronograma",
  "design",
  "tpg",
  "tpm",
  "valor_trafego",
  "gmn_post",
  "camera",
  "mobile",
  "edicao",
  "reuniao",
  "postagem",
];

export async function detectChecklistPainel(counters: { checklist_painel: number }): Promise<void> {
  const today = new Date();
  const isFirstDayOfMonth = today.getUTCDate() === 1;
  const monthRef = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;

  // Reset mensal: cria checklist novo se hoje é dia 1
  if (isFirstDayOfMonth) {
    await createChecklistsForActiveClients(monthRef, counters);
  }

  // Sempre: detectar atrasos no checklist do mês corrente
  await markAtrasadas(monthRef, today, counters);
}

async function createChecklistsForActiveClients(
  monthRef: string,
  counters: { checklist_painel: number },
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Lista clientes ativos
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, assessor_id, organization_id, pacote_post_padrao")
    .eq("status", "ativo");

  const clients = (clientsData ?? []) as Array<{
    id: string;
    assessor_id: string | null;
    organization_id: string;
    pacote_post_padrao: number | null;
  }>;

  if (clients.length === 0) return;

  // Cria checklists (upsert pra ser idempotente)
  const checklistsToInsert = clients.map((c) => ({
    client_id: c.id,
    organization_id: c.organization_id,
    mes_referencia: monthRef,
    pacote_post: c.pacote_post_padrao,
  }));

  const { data: insertedChecklists, error: insertErr } = await supabase
    .from("client_monthly_checklist")
    .upsert(checklistsToInsert, { onConflict: "client_id,mes_referencia", ignoreDuplicates: false })
    .select("id, client_id");

  if (insertErr || !insertedChecklists) {
    console.error("[checklist-painel] failed to upsert checklists:", insertErr?.message);
    return;
  }

  const checklists = insertedChecklists as Array<{ id: string; client_id: string }>;

  // Cria 11 steps por checklist
  const stepsToInsert: Array<{
    checklist_id: string;
    step_key: StepKey;
    status: StepStatus;
    responsavel_id: string | null;
    iniciado_em: string | null;
  }> = [];

  for (const checklist of checklists) {
    const cliente = clients.find((c) => c.id === checklist.client_id);
    if (!cliente) continue;

    for (const stepKey of ALL_STEPS) {
      // Cronograma já começa em_andamento com responsável = assessor
      const isCronograma = stepKey === "cronograma";
      stepsToInsert.push({
        checklist_id: checklist.id,
        step_key: stepKey,
        status: isCronograma ? "em_andamento" : "pendente",
        responsavel_id: isCronograma ? cliente.assessor_id : null,
        iniciado_em: isCronograma ? new Date().toISOString() : null,
      });
    }
  }

  await supabase.from("checklist_step").upsert(stepsToInsert, { onConflict: "checklist_id,step_key", ignoreDuplicates: true });

  // Dispara notificação pro assessor de cada cliente: "Cronograma de [mês] aguardando você"
  for (const checklist of checklists) {
    const cliente = clients.find((c) => c.id === checklist.client_id);
    if (!cliente?.assessor_id) continue;
    await dispatchNotification({
      evento_tipo: "checklist_step_delegada",
      titulo: `Cronograma de ${monthRef} aguardando você`,
      mensagem: "Inicie o cronograma do mês no painel",
      link: "/painel",
      target_user_id: cliente.assessor_id,
    });
  }

  counters.checklist_painel += clients.length;
}

async function markAtrasadas(
  monthRef: string,
  today: Date,
  counters: { checklist_painel: number },
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Carrega steps não-prontos do mês corrente
  const { data: stepsData } = await supabase
    .from("checklist_step")
    .select("id, step_key, status, responsavel_id, checklist_id, client_monthly_checklist:client_monthly_checklist(mes_referencia)")
    .eq("client_monthly_checklist.mes_referencia", monthRef)
    .neq("status", "pronto");

  const steps = (stepsData ?? []) as unknown as Array<{
    id: string;
    step_key: StepKey;
    status: StepStatus;
    responsavel_id: string | null;
    checklist_id: string;
  }>;

  for (const s of steps) {
    if (s.status === "atrasada") continue;
    if (isAtrasada(s.step_key, s.status, today)) {
      await supabase
        .from("checklist_step")
        .update({ status: "atrasada" })
        .eq("id", s.id);

      if (s.responsavel_id) {
        await dispatchNotification({
          evento_tipo: "checklist_step_atrasada",
          titulo: `Etapa "${s.step_key}" atrasada`,
          mensagem: "Conclua o quanto antes",
          link: "/painel",
          target_user_id: s.responsavel_id,
        });
      }

      counters.checklist_painel++;
    }
  }
}
```

- [ ] **Step B4.4: Plugar no `daily-digest.ts`**

Adicione import no topo de `src/lib/cron/daily-digest.ts`:

```ts
import { detectChecklistPainel } from "./detectors/checklist-painel";
```

Adicione `checklist_painel: number` ao `DigestCounters` interface.

Adicione `checklist_painel: 0` na inicialização do counters.

Adicione `await safeDetect(() => detectChecklistPainel(counters));` perto dos outros `safeDetect` calls.

- [ ] **Step B4.5: Rodar testes + typecheck**

```bash
npm run test -- tests/unit/painel-cron.test.ts
npm run typecheck
```

Esperar: 2/2 pass, typecheck clean.

- [ ] **Step B4.6: Commit**

```bash
git add src/lib/cron/detectors/checklist-painel.ts \
  src/lib/cron/daily-digest.ts \
  tests/unit/painel-cron.test.ts
git commit -m "feat(cron): checklist-painel detector for monthly reset and atrasos (TDD)"
```

---

## Bloco C — UI

### Task C1: Sidebar + Layout + Page principal

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Create: `src/app/(authed)/painel/page.tsx`
- Create: `src/components/painel/MesSelector.tsx`
- Create: `src/components/painel/PainelHeader.tsx`

- [ ] **Step C1.1: Adicionar item na Sidebar**

Read `src/components/layout/Sidebar.tsx` primeiro pra ver o pattern. Adicionar item `Painel mensal` no array `navItems`. O item deve ter `icon` (escolher do lucide-react, ex `ListChecks` ou `LayoutDashboard`) e `roles` array com:

```ts
{ href: "/painel", icon: ListChecks, label: "Painel mensal", roles: ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"] }
```

Se já tem `ListChecks` importado pra outra coisa (Tarefas), escolha um ícone diferente — ex `ClipboardList`.

- [ ] **Step C1.2: Criar `<MesSelector>` (client)**

`src/components/painel/MesSelector.tsx`:

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  current: string;
  options: string[];
}

const MONTH_LABELS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function format(monthRef: string): string {
  const [y, m] = monthRef.split("-");
  return `${MONTH_LABELS_PT[Number(m) - 1]}/${y}`;
}

export function MesSelector({ current, options }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", value);
    router.push(`?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border bg-card px-2 text-sm"
    >
      {options.map((m) => (
        <option key={m} value={m}>{format(m)}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step C1.3: Criar `<PainelHeader>` (server)**

`src/components/painel/PainelHeader.tsx`:

```tsx
import { MesSelector } from "./MesSelector";

interface Props {
  mesAtual: string;
  mesesDisponiveis: string[];
}

export function PainelHeader({ mesAtual, mesesDisponiveis }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel mensal</h1>
        <p className="text-sm text-muted-foreground">Acompanhamento de etapas por cliente</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Mês:</span>
        <MesSelector current={mesAtual} options={mesesDisponiveis} />
      </div>
    </div>
  );
}
```

- [ ] **Step C1.4: Criar `src/app/(authed)/painel/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getMonthlyChecklists, type ChecklistFilter } from "@/lib/painel/queries";
import { PainelHeader } from "@/components/painel/PainelHeader";
import { PainelTable } from "@/components/painel/PainelTable";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"];

function currentMonthRef(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonthRef(monthRef: string): string {
  const [y, m] = monthRef.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const mesAtual = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : currentMonthRef();

  // Filter por papel
  const filter: ChecklistFilter = {};
  if (user.role === "assessor") filter.assessorId = user.id;
  else if (user.role === "coordenador") filter.coordenadorId = user.id;
  else if (user.role === "designer") filter.designerId = user.id;
  else if (user.role === "videomaker") filter.videomakerId = user.id;
  else if (user.role === "editor") filter.editorId = user.id;

  const checklists = await getMonthlyChecklists(mesAtual, filter);

  // 12 últimos meses como opções
  const mesesDisponiveis: string[] = [];
  let cursor = currentMonthRef();
  for (let i = 0; i < 12; i++) {
    mesesDisponiveis.push(cursor);
    cursor = previousMonthRef(cursor);
  }

  return (
    <div className="space-y-5">
      <PainelHeader mesAtual={mesAtual} mesesDisponiveis={mesesDisponiveis} />
      <PainelTable
        checklists={checklists}
        userRole={user.role}
        userId={user.id}
      />
    </div>
  );
}
```

- [ ] **Step C1.5: Typecheck e commit**

```bash
npm run typecheck
git add src/components/layout/Sidebar.tsx \
  "src/app/(authed)/painel/page.tsx" \
  src/components/painel/MesSelector.tsx \
  src/components/painel/PainelHeader.tsx
git commit -m "feat(painel): sidebar item, page route, header with month selector"
```

---

### Task C2: `<PainelTable>` + `<StatusCell>`

**Files:**
- Create: `src/components/painel/PainelTable.tsx`
- Create: `src/components/painel/StatusCell.tsx`

- [ ] **Step C2.1: Criar `<StatusCell>` (server, não interativa — só visual)**

`src/components/painel/StatusCell.tsx`:

```tsx
import type { StepStatus } from "@/lib/painel/deadlines";

interface Props {
  status: StepStatus | null;  // null = etapa não existe ainda
  onClickHref?: string;
}

const STATUS_DISPLAY: Record<StepStatus, { emoji: string; bg: string; label: string }> = {
  pendente: { emoji: "⚪", bg: "bg-slate-100 dark:bg-slate-800", label: "Pendente" },
  em_andamento: { emoji: "🟡", bg: "bg-amber-100 dark:bg-amber-900/30", label: "Em andamento" },
  pronto: { emoji: "🟢", bg: "bg-green-100 dark:bg-green-900/30", label: "Pronto" },
  atrasada: { emoji: "🔴", bg: "bg-red-100 dark:bg-red-900/30", label: "Atrasada" },
};

export function StatusCell({ status }: Props) {
  if (status === null) {
    return (
      <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
        —
      </div>
    );
  }

  const info = STATUS_DISPLAY[status];
  return (
    <div
      title={info.label}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md ${info.bg} text-base`}
    >
      {info.emoji}
    </div>
  );
}
```

- [ ] **Step C2.2: Criar `<PainelTable>` (server)**

`src/components/painel/PainelTable.tsx`:

```tsx
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { StatusCell } from "./StatusCell";
import { StepModal } from "./StepModal";
import type { ChecklistRow } from "@/lib/painel/queries";
import type { StepKey, StepStatus } from "@/lib/painel/deadlines";

interface Props {
  checklists: ChecklistRow[];
  userRole: string;
  userId: string;
}

const STEP_COLUMNS: Array<{ key: StepKey; label: string }> = [
  { key: "cronograma", label: "Crono" },
  { key: "design", label: "Design" },
  { key: "tpg", label: "TPG" },
  { key: "tpm", label: "TPM" },
  { key: "gmn_post", label: "GM" },
  { key: "camera", label: "Câmera" },
  { key: "mobile", label: "Mobile" },
  { key: "edicao", label: "Edição" },
  { key: "reuniao", label: "Reunião" },
  { key: "postagem", label: "Postag." },
];

function formatBRL(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

export function PainelTable({ checklists, userRole, userId }: Props) {
  if (checklists.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
        Nenhum cliente com checklist neste mês.
      </p>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/40 z-10">Cliente</th>
            <th className="px-3 py-2 text-center font-medium">Pacote/Postados</th>
            {STEP_COLUMNS.map((col) => (
              <th key={col.key} className="px-2 py-2 text-center font-medium">{col.label}</th>
            ))}
            <th className="px-3 py-2 text-right font-medium">R$</th>
            <th className="px-3 py-2 text-center font-medium">Drive</th>
          </tr>
        </thead>
        <tbody>
          {checklists.map((cl) => (
            <tr key={cl.client_id} className="border-t hover:bg-muted/20">
              <td className="px-3 py-2 sticky left-0 bg-card z-10">
                <Link href={`/clientes/${cl.client_id}`} className="font-medium hover:underline">
                  {cl.client_nome}
                </Link>
              </td>
              <td className="px-3 py-2 text-center text-xs tabular-nums">
                {cl.pacote_post ?? "—"} / {cl.quantidade_postada ?? "—"}
              </td>
              {STEP_COLUMNS.map((col) => {
                const step = cl.steps.find((s) => s.step_key === col.key);
                const status: StepStatus | null = step?.status ?? null;
                return (
                  <td key={col.key} className="px-2 py-2 text-center">
                    {step ? (
                      <StepModal step={step} clientNome={cl.client_nome} userRole={userRole} userId={userId} clientId={cl.client_id}>
                        <StatusCell status={status} />
                      </StepModal>
                    ) : (
                      <StatusCell status={null} />
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right tabular-nums">{formatBRL(cl.valor_trafego_mes)}</td>
              <td className="px-3 py-2 text-center">
                {cl.client_drive_url ? (
                  <a
                    href={cl.client_drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-primary hover:underline"
                    title="Abrir Drive"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step C2.3: Typecheck e commit**

```bash
npm run typecheck
git add src/components/painel/PainelTable.tsx src/components/painel/StatusCell.tsx
git commit -m "feat(painel): PainelTable and StatusCell components"
```

---

### Task C3: `<StepModal>` (client) + form para R$ inline

**Files:**
- Create: `src/components/painel/StepModal.tsx`

- [ ] **Step C3.1: Criar `<StepModal>`**

`src/components/painel/StepModal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, X } from "lucide-react";
import { markStepProntoAction } from "@/lib/painel/actions";
import type { StepStatus, StepKey } from "@/lib/painel/deadlines";

interface StepInfo {
  id: string;
  step_key: StepKey;
  status: StepStatus;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  iniciado_em: string | null;
  completed_at: string | null;
}

interface Props {
  step: StepInfo;
  clientNome: string;
  clientId: string;
  userRole: string;
  userId: string;
  children: React.ReactNode;
}

const STEP_LABELS: Record<StepKey, string> = {
  cronograma: "Cronograma",
  design: "Design",
  tpg: "Tráfego Pago Google",
  tpm: "Tráfego Pago Meta",
  valor_trafego: "Valor de Tráfego",
  gmn_post: "Google Meu Negócio",
  camera: "Câmera",
  mobile: "Mobile",
  edicao: "Edição",
  reuniao: "Reunião com Cliente",
  postagem: "Postagem",
};

function canMarkPronto(stepKey: StepKey, userRole: string, userId: string, step: StepInfo): boolean {
  if (["socio", "adm", "coordenador"].includes(userRole)) return true;
  // Quem tem o step delegado pode marcar
  return step.responsavel_id === userId;
}

export function StepModal({ step, clientNome, userRole, userId, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleMarkPronto() {
    setError(null);
    const fd = new FormData();
    fd.set("step_id", step.id);
    startTransition(async () => {
      const result = await markStepProntoAction(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        setOpen(false);
      }
    });
  }

  const podeMarcar = canMarkPronto(step.step_key, userRole, userId, step) && step.status !== "pronto";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-block">
        {children}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{STEP_LABELS[step.step_key]}</h3>
                <p className="text-xs text-muted-foreground">{clientNome}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium capitalize">{step.status.replace("_", " ")}</dd>
              </div>
              {step.responsavel_nome && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Responsável</dt>
                  <dd>{step.responsavel_nome}</dd>
                </div>
              )}
              {step.iniciado_em && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Iniciado</dt>
                  <dd>{new Date(step.iniciado_em).toLocaleDateString("pt-BR")}</dd>
                </div>
              )}
              {step.completed_at && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Concluído</dt>
                  <dd>{new Date(step.completed_at).toLocaleDateString("pt-BR")}</dd>
                </div>
              )}
            </dl>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {podeMarcar && (
              <button
                onClick={handleMarkPronto}
                disabled={pending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {pending ? "Marcando..." : "Marcar como pronto"}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step C3.2: Typecheck e commit**

```bash
npm run typecheck
git add src/components/painel/StepModal.tsx
git commit -m "feat(painel): StepModal with mark-pronto action"
```

---

### Task C4: Form `/clientes/[id]/editar` com 7 novos campos

**Files:**
- Modify: `src/lib/clientes/schema.ts`
- Modify: `src/lib/clientes/actions.ts`
- Modify: `src/components/clientes/ClienteForm.tsx`
- Possibly modify: `src/app/(authed)/clientes/[id]/editar/page.tsx`

- [ ] **Step C4.1: Atualizar `src/lib/clientes/schema.ts`**

Read the file first. Find the schema for editing client (probably `editClienteSchema`). Add 7 new optional fields:

```ts
designer_id: z.string().uuid().optional().nullable(),
videomaker_id: z.string().uuid().optional().nullable(),
editor_id: z.string().uuid().optional().nullable(),
instagram_url: z.string().url().or(z.literal("")).optional().nullable(),
gmn_url: z.string().url().or(z.literal("")).optional().nullable(),
drive_url: z.string().url().or(z.literal("")).optional().nullable(),
pacote_post_padrao: z.coerce.number().int().min(0).optional().nullable(),
```

- [ ] **Step C4.2: Atualizar `src/lib/clientes/actions.ts`**

Read the file. Find the update function. Add the 7 new fields to the update payload, normalizing empty strings to null:

```ts
designer_id: parsed.data.designer_id || null,
videomaker_id: parsed.data.videomaker_id || null,
editor_id: parsed.data.editor_id || null,
instagram_url: parsed.data.instagram_url || null,
gmn_url: parsed.data.gmn_url || null,
drive_url: parsed.data.drive_url || null,
pacote_post_padrao: parsed.data.pacote_post_padrao ?? null,
```

- [ ] **Step C4.3: Atualizar `src/components/clientes/ClienteForm.tsx`**

Read the file. Add a new section "Equipe e links" before the submit button:

```tsx
<div className="space-y-3 rounded-lg border bg-muted/10 p-4">
  <h4 className="text-sm font-semibold">Equipe e links (Painel mensal)</h4>

  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <div>
      <label className="text-xs font-medium text-muted-foreground">Designer responsável</label>
      <select
        name="designer_id"
        defaultValue={defaultValues.designer_id ?? ""}
        className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
      >
        <option value="">— Sem designer —</option>
        {designers.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </div>
    <div>
      <label className="text-xs font-medium text-muted-foreground">Videomaker responsável</label>
      <select
        name="videomaker_id"
        defaultValue={defaultValues.videomaker_id ?? ""}
        className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
      >
        <option value="">— Sem videomaker —</option>
        {videomakers.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </div>
    <div>
      <label className="text-xs font-medium text-muted-foreground">Editor responsável</label>
      <select
        name="editor_id"
        defaultValue={defaultValues.editor_id ?? ""}
        className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
      >
        <option value="">— Sem editor —</option>
        {editors.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </div>
  </div>

  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div>
      <label className="text-xs font-medium text-muted-foreground">Instagram URL</label>
      <input
        type="url"
        name="instagram_url"
        defaultValue={defaultValues.instagram_url ?? ""}
        placeholder="https://instagram.com/cliente"
        className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
      />
    </div>
    <div>
      <label className="text-xs font-medium text-muted-foreground">Google Meu Negócio</label>
      <input
        type="url"
        name="gmn_url"
        defaultValue={defaultValues.gmn_url ?? ""}
        placeholder="https://g.page/cliente"
        className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
      />
    </div>
    <div>
      <label className="text-xs font-medium text-muted-foreground">Drive (pasta principal)</label>
      <input
        type="url"
        name="drive_url"
        defaultValue={defaultValues.drive_url ?? ""}
        placeholder="https://drive.google.com/..."
        className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
      />
    </div>
    <div>
      <label className="text-xs font-medium text-muted-foreground">Pacote padrão de posts/mês</label>
      <input
        type="number"
        name="pacote_post_padrao"
        defaultValue={defaultValues.pacote_post_padrao ?? ""}
        min={0}
        placeholder="12"
        className="mt-1 block w-full h-9 rounded-md border bg-card px-2 text-sm"
      />
    </div>
  </div>
</div>
```

**Importante:** o componente precisa receber `designers`, `videomakers`, `editors` como props (arrays de `{ id, nome }`). Adicione na interface de Props.

- [ ] **Step C4.4: Atualizar `src/app/(authed)/clientes/[id]/editar/page.tsx`**

Read the file. Antes de renderizar o `<ClienteForm>`, carregar listas de profiles por role:

```tsx
const supabase = await createClient();
const [designersResp, videomakersResp, editorsResp] = await Promise.all([
  supabase.from("profiles").select("id, nome").eq("role", "designer").eq("ativo", true).order("nome"),
  supabase.from("profiles").select("id, nome").eq("role", "videomaker").eq("ativo", true).order("nome"),
  supabase.from("profiles").select("id, nome").eq("role", "editor").eq("ativo", true).order("nome"),
]);
const designers = (designersResp.data ?? []) as Array<{ id: string; nome: string }>;
const videomakers = (videomakersResp.data ?? []) as Array<{ id: string; nome: string }>;
const editors = (editorsResp.data ?? []) as Array<{ id: string; nome: string }>;
```

E passar esses arrays + os defaults dos 7 campos novos pro form:

```tsx
<ClienteForm
  defaultValues={...}  // existing + 7 new fields from cliente
  designers={designers}
  videomakers={videomakers}
  editors={editors}
  // ... other existing props
/>
```

- [ ] **Step C4.5: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/clientes/schema.ts \
  src/lib/clientes/actions.ts \
  src/components/clientes/ClienteForm.tsx \
  "src/app/(authed)/clientes/[id]/editar/page.tsx"
git commit -m "feat(clientes): add team and links fields to edit form"
```

---

## Bloco D — E2E + push + PR

### Task D1: e2e + push + PR

**Files:**
- Create: `tests/e2e/painel.spec.ts`

- [ ] **Step D1.1: Criar e2e**

`tests/e2e/painel.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("rota /painel redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/painel");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step D1.2: Rodar todos os testes + typecheck**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
npm run test
npm run typecheck
```

Esperar: typecheck clean. ~24 testes novos passam (8 deadlines + 14 chain + 5 actions + 2 cron). 1 falha pré-existente flaky em `tarefas-schema` é OK.

Se um teste de Fase 11 falhar, STOP e BLOCK.

- [ ] **Step D1.3: Commit**

```bash
git add tests/e2e/painel.spec.ts
git commit -m "test(e2e): painel auth-redirect test"
```

- [ ] **Step D1.4: Push e PR**

```bash
git push -u origin claude/fase-11-painel-mensal
```

```bash
/opt/homebrew/bin/gh pr create --base main --head claude/fase-11-painel-mensal \
  --title "feat: Fase 11 — Painel mensal do Assessor (migra planilha pro sistema)" \
  --body "$(cat <<'EOF'
## Summary
- Nova área `/painel` substitui a planilha Excel mensal dos assessores
- 11 etapas mapeadas (cronograma, design, tráfego, gravações, edição, postagem, reunião)
- Cadeia principal com auto-delegação: cronograma → design → câmera+mobile → edição → postagem
- Etapas paralelas (TPG/TPM/GM/Reunião) notificam Coord+Sócios quando concluídas
- Cron diário (no daily-digest existente) cria checklist novo todo dia 1 + detecta atrasos baseado em prazos D-X
- Histórico mensal mantido — navegação entre meses
- Migrações: 7 colunas em clients (designer/videomaker/editor + 3 URLs + pacote padrão), 2 tabelas novas, 3 eventos novos de notificação
- Form `/clientes/[id]/editar` ganha seção "Equipe e links"

## Test plan
- [x] ~24 unit tests novos (deadlines, chain, actions, cron)
- [x] 1 e2e auth-redirect test
- [x] Typecheck clean
- [x] Reusa dispatchNotification (Fase 6) e daily-digest cron (Fase 6)
- [ ] Verificar Production deploy depois do merge
- [ ] Validar visualmente em produção (planilha funciona, delegação dispara, atrasos marcados)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step D1.5: Verificar Production deploy**

```bash
/opt/homebrew/bin/gh api "repos/time-yide/yide-acompanha/deployments?environment=Production" --jq '.[0].id' \
  | xargs -I {} /opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments/{}/statuses --jq '.[0].state'
```

Esperar: `success`.

---

## Self-Review

### Cobertura do spec

| Spec | Coberto por |
|---|---|
| 7 campos novos em `clients` | A1 |
| 2 tabelas novas + 2 enums | A2 |
| 3 eventos novos de notificação + seed rules | A3 |
| Tipos regenerados | A4 |
| Helpers puros (deadlines + chain) com TDD | B1 |
| Query getMonthlyChecklists | B2 |
| markStepProntoAction com auto-cadeia | B3 |
| Detector cron reset mensal + atrasos | B4 |
| Sidebar item + page route | C1 |
| PainelTable + StatusCell | C2 |
| StepModal interativo | C3 |
| ClienteForm com 7 campos novos | C4 |
| E2E + push + PR | D1 |

### Lacunas conhecidas (intencionais)

- Edição do campo R$ (`valor_trafego_mes`) e quantidade postada/pacote precisa de UI inline — não está implementado nessa fase, apenas o backend (`updateChecklistFieldAction`). Implementer pode adicionar inline-edit via input controlado ou modal — fica pra ajuste fino depois.
- "Marcar como atrasada manualmente" não existe — só via cron.
- Reabertura de etapa pronta requer Sócio/ADM via Supabase direto.
- ColaboradorForm `defaultValues` props pode precisar ajuste no caller — engenheiro deve verificar.

---

## Resumo da entrega

Após executar:

- 4 migrações (clients fields + 2 tabelas + 2 enums + 3 eventos + seed rules)
- 4 helpers/queries/actions/cron novos com testes
- Sidebar atualizada
- Página `/painel` completa com tabela tipo planilha
- Form de edição de cliente atualizado
- ~24 testes unitários + 1 e2e
- Reusa dispatchNotification (Fase 6) e daily-digest cron (Fase 6)

Total: **~16 commits** (A1, A2, A3, A4, B1, B2, B3, B4, C1, C2, C3, C4, D1).
