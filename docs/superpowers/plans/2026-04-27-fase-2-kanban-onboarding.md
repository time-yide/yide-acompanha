# Fase 2 — Kanban de Onboarding (Yide Digital) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o pipeline de onboarding de novos clientes como kanban visual de 5 estágios (Prospecção → Reunião Comercial → Contrato → Marco Zero → Cliente ativo), com criação automática do registro em `clients` ao chegar no último estágio. Substitui o caos do WhatsApp pra acompanhar quem está em qual etapa.

**Architecture:** Tabela `leads` com enum de 5 estágios + `lead_history` + `lead_attempts`. UI de kanban em colunas verticais, com botões de transição (não drag-and-drop por simplicidade e mobile). Cada movimento valida pré-requisitos (ex.: pra ir pra Marco Zero precisa ter `data_reuniao_marco_zero` preenchida). Quando atinge "ativo", cria registro em `clients` e disparo de cálculo de comissão Comercial vai pra Fase 4.

**Tech Stack:** Next.js 15 + Supabase + shadcn/ui + lucide-react + date-fns. Sem novas dependências.

**Spec:** [docs/superpowers/specs/2026-04-26-sistema-acompanhamento-design.md](../specs/2026-04-26-sistema-acompanhamento-design.md), seção 5.3.

**Plano anterior:** [Fase 1 — Clientes core](2026-04-26-fase-1-clientes-core.md)

**Fora do escopo (Fase 3+):** Calendário Interno, área de Prospecção (Comercial CRM), drag-and-drop, comissão automática do Comercial.

---

## Estrutura de arquivos da Fase 2

```
supabase/migrations/
├── 20260427000005_leads.sql                # leads table + 5-stage enum + RLS
└── 20260427000006_lead_history_attempts.sql # log + follow-ups + RLS

src/
├── app/(authed)/onboarding/
│   ├── page.tsx                            # kanban view
│   ├── novo/page.tsx                       # criar prospect (Comercial)
│   └── [id]/page.tsx                       # detalhes do lead
│
├── components/onboarding/
│   ├── KanbanBoard.tsx                     # 5 colunas
│   ├── KanbanColumn.tsx                    # 1 coluna
│   ├── LeadCard.tsx                        # 1 card com botões de transição
│   ├── StageTransitionButtons.tsx          # botão avançar/marcar perdido
│   ├── LeadForm.tsx                        # criar/editar dados do prospect
│   ├── LeadAttemptsTimeline.tsx            # follow-ups
│   └── AddAttemptForm.tsx
│
└── lib/
    ├── leads/
    │   ├── schema.ts                       # zod
    │   ├── queries.ts                      # listByStage, getById
    │   └── actions.ts                      # create, update, moveStage, markLost
    └── lead-attempts/
        └── actions.ts                      # CRUD follow-ups

tests/
└── unit/
    └── leads-schema.test.ts
```

---

## Bloco A — Migrations

### Task A1: `leads` table + RLS

**Files:**
- Create: `supabase/migrations/20260427000005_leads.sql`

- [ ] **Step A1.1: Criar arquivo SQL**

```sql
-- supabase/migrations/20260427000005_leads.sql
create type public.lead_stage as enum (
  'prospeccao', 'comercial', 'contrato', 'marco_zero', 'ativo'
);
create type public.lead_priority as enum ('alta', 'media', 'baixa');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  nome_prospect text not null,
  site text,
  contato_principal text,
  email text,
  telefone text,
  valor_proposto numeric(12, 2) default 0 not null,
  duracao_meses integer,
  servico_proposto text,
  info_briefing text,
  comercial_id uuid not null references public.profiles(id),
  stage public.lead_stage not null default 'prospeccao',
  prioridade public.lead_priority not null default 'media',
  data_prospeccao_agendada timestamptz,
  data_reuniao_marco_zero timestamptz,
  coord_alocado_id uuid references public.profiles(id) on delete set null,
  assessor_alocado_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  data_fechamento date,
  motivo_perdido text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_leads_stage on public.leads(stage);
create index idx_leads_comercial on public.leads(comercial_id);
create index idx_leads_data_marco on public.leads(data_reuniao_marco_zero);

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- Todos autenticados podem ler leads (visibilidade ampla)
create policy "authenticated read leads"
  on public.leads for select to authenticated using (true);

-- Comercial cria leads (com comercial_id = auth.uid())
create policy "comercial/adm/socio insert leads"
  on public.leads for insert to authenticated
  with check (
    public.current_user_role() in ('adm', 'socio', 'comercial')
    and comercial_id = auth.uid()
  );

-- ADM/Sócio updates qualquer lead
create policy "adm/socio update any lead"
  on public.leads for update to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

-- Comercial só atualiza leads que ele criou
create policy "comercial update own leads"
  on public.leads for update to authenticated
  using (
    public.current_user_role() = 'comercial'
    and comercial_id = auth.uid()
  )
  with check (
    public.current_user_role() = 'comercial'
    and comercial_id = auth.uid()
  );

-- Coord pode atualizar leads em estágio marco_zero (ele conduz a reunião)
create policy "coord update leads in marco_zero"
  on public.leads for update to authenticated
  using (
    public.current_user_role() = 'coordenador'
    and stage = 'marco_zero'
  )
  with check (
    public.current_user_role() = 'coordenador'
    and stage in ('marco_zero', 'ativo')
  );
```

- [ ] **Step A1.2: Aplicar e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2)
npx supabase db push
git add supabase/migrations/20260427000005_leads.sql
git commit -m "feat(db): leads table with 5-stage enum and stage-aware RLS"
```

---

### Task A2: `lead_history` + `lead_attempts` + RLS

**Files:**
- Create: `supabase/migrations/20260427000006_lead_history_attempts.sql`

- [ ] **Step A2.1: Criar arquivo SQL**

```sql
-- supabase/migrations/20260427000006_lead_history_attempts.sql

-- 1) lead_history (audit de mudanças de stage)
create table public.lead_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_stage public.lead_stage,
  to_stage public.lead_stage not null,
  ator_id uuid not null references public.profiles(id),
  observacao text,
  created_at timestamptz not null default now()
);

create index idx_lead_history_lead on public.lead_history(lead_id, created_at desc);

alter table public.lead_history enable row level security;

create policy "authenticated read lead_history"
  on public.lead_history for select to authenticated using (true);

create policy "authenticated insert lead_history"
  on public.lead_history for insert to authenticated
  with check (ator_id = auth.uid());

-- imutável: sem update/delete

-- 2) lead_attempts (follow-ups do Comercial)
create type public.attempt_channel as enum ('whatsapp', 'email', 'ligacao', 'presencial', 'outro');
create type public.attempt_result as enum ('sem_resposta', 'agendou', 'recusou', 'pediu_proposta', 'outro');

create table public.lead_attempts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  canal public.attempt_channel not null default 'whatsapp',
  resultado public.attempt_result not null default 'sem_resposta',
  observacao text,
  proximo_passo text,
  data_proximo_passo date,
  created_at timestamptz not null default now()
);

create index idx_lead_attempts_lead on public.lead_attempts(lead_id, created_at desc);

alter table public.lead_attempts enable row level security;

create policy "authenticated read lead_attempts"
  on public.lead_attempts for select to authenticated using (true);

create policy "authenticated insert lead_attempts"
  on public.lead_attempts for insert to authenticated
  with check (autor_id = auth.uid());

create policy "author updates own lead_attempts"
  on public.lead_attempts for update to authenticated
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

create policy "author or adm/socio delete lead_attempts"
  on public.lead_attempts for delete to authenticated
  using (autor_id = auth.uid() or public.current_user_role() in ('adm', 'socio'));
```

- [ ] **Step A2.2: Aplicar e commit**

```bash
npx supabase db push
git add supabase/migrations/20260427000006_lead_history_attempts.sql
git commit -m "feat(db): lead_history and lead_attempts tables with RLS"
```

---

### Task A3: Regenerar tipos

- [ ] **Step A3.1: Gerar e commitar**

```bash
SUPABASE_PROJECT_ID=jelvhwbpipawghwufpbc npm run db:types
npm run typecheck
git add src/types/database.ts
git commit -m "chore(db): regenerate types after fase 2 migrations"
```

---

## Bloco B — Backend

### Task B1: Schemas Zod e queries de leads

**Files:**
- Create: `src/lib/leads/schema.ts`
- Create: `src/lib/leads/queries.ts`
- Create: `tests/unit/leads-schema.test.ts`

- [ ] **Step B1.1: schema.ts**

```ts
// src/lib/leads/schema.ts
import { z } from "zod";

export const STAGES = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"] as const;
export const PRIORITIES = ["alta", "media", "baixa"] as const;
export type Stage = typeof STAGES[number];

export const createLeadSchema = z.object({
  nome_prospect: z.string().min(2, "Nome do prospect muito curto"),
  site: z.string().url("Site inválido").optional().or(z.literal("")).nullable(),
  contato_principal: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  telefone: z.string().optional().nullable(),
  valor_proposto: z.coerce.number().min(0).default(0),
  duracao_meses: z.coerce.number().int().min(0).optional().nullable(),
  servico_proposto: z.string().optional().nullable(),
  info_briefing: z.string().optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  data_prospeccao_agendada: z.string().optional().nullable(),
});

export const editLeadSchema = createLeadSchema.extend({
  id: z.string().uuid(),
  data_reuniao_marco_zero: z.string().optional().nullable(),
  coord_alocado_id: z.string().uuid().optional().nullable(),
  assessor_alocado_id: z.string().uuid().optional().nullable(),
});

export const moveStageSchema = z.object({
  id: z.string().uuid(),
  to_stage: z.enum(STAGES),
  observacao: z.string().optional(),
});

export const markLostSchema = z.object({
  id: z.string().uuid(),
  motivo_perdido: z.string().min(3, "Informe o motivo"),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type EditLeadInput = z.infer<typeof editLeadSchema>;
```

- [ ] **Step B1.2: Tests**

```ts
// tests/unit/leads-schema.test.ts
import { describe, it, expect } from "vitest";
import { createLeadSchema, moveStageSchema, markLostSchema } from "@/lib/leads/schema";

describe("createLeadSchema", () => {
  it("aceita lead mínimo", () => {
    const r = createLeadSchema.safeParse({ nome_prospect: "Pizzaria Bella" });
    expect(r.success).toBe(true);
  });

  it("rejeita nome curto", () => {
    expect(createLeadSchema.safeParse({ nome_prospect: "A" }).success).toBe(false);
  });

  it("aceita site vazio", () => {
    const r = createLeadSchema.safeParse({ nome_prospect: "X cliente", site: "" });
    expect(r.success).toBe(true);
  });

  it("rejeita site malformado", () => {
    const r = createLeadSchema.safeParse({ nome_prospect: "X cliente", site: "abc" });
    expect(r.success).toBe(false);
  });

  it("default priority is media", () => {
    const r = createLeadSchema.safeParse({ nome_prospect: "X cliente" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prioridade).toBe("media");
  });
});

describe("moveStageSchema", () => {
  it("aceita stage válido", () => {
    const r = moveStageSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      to_stage: "comercial",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita stage desconhecido", () => {
    const r = moveStageSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      to_stage: "ganhou_no_dado",
    });
    expect(r.success).toBe(false);
  });
});

describe("markLostSchema", () => {
  it("exige motivo", () => {
    const r = markLostSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      motivo_perdido: "ab",
    });
    expect(r.success).toBe(false);
  });

  it("aceita marcar perdido com motivo", () => {
    const r = markLostSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      motivo_perdido: "Cliente decidiu por outra agência",
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step B1.3: queries.ts**

```ts
// src/lib/leads/queries.ts
import { createClient } from "@/lib/supabase/server";
import type { Stage } from "./schema";

export interface LeadRow {
  id: string;
  nome_prospect: string;
  site: string | null;
  valor_proposto: number;
  servico_proposto: string | null;
  prioridade: "alta" | "media" | "baixa";
  stage: Stage;
  data_prospeccao_agendada: string | null;
  data_reuniao_marco_zero: string | null;
  data_fechamento: string | null;
  comercial_id: string;
  coord_alocado_id: string | null;
  assessor_alocado_id: string | null;
  comercial_nome?: string | null;
  coord_nome?: string | null;
  assessor_nome?: string | null;
}

export async function listLeadsByStage(): Promise<Record<Stage, LeadRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(`
      id, nome_prospect, site, valor_proposto, servico_proposto, prioridade, stage,
      data_prospeccao_agendada, data_reuniao_marco_zero, data_fechamento,
      comercial_id, coord_alocado_id, assessor_alocado_id,
      comercial:profiles!leads_comercial_id_fkey(nome),
      coord:profiles!leads_coord_alocado_id_fkey(nome),
      assessor:profiles!leads_assessor_alocado_id_fkey(nome)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const groups: Record<Stage, LeadRow[]> = {
    prospeccao: [], comercial: [], contrato: [], marco_zero: [], ativo: [],
  };

  for (const r of data ?? []) {
    const row: LeadRow = {
      ...r,
      valor_proposto: Number(r.valor_proposto),
      // @ts-expect-error nested
      comercial_nome: r.comercial?.nome ?? null,
      // @ts-expect-error nested
      coord_nome: r.coord?.nome ?? null,
      // @ts-expect-error nested
      assessor_nome: r.assessor?.nome ?? null,
    };
    groups[r.stage as Stage].push(row);
  }

  return groups;
}

export async function getLeadById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(`
      *,
      comercial:profiles!leads_comercial_id_fkey(id, nome),
      coord:profiles!leads_coord_alocado_id_fkey(id, nome),
      assessor:profiles!leads_assessor_alocado_id_fkey(id, nome),
      cliente:clients(id, nome)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function listLeadHistory(leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_history")
    .select(`
      id, from_stage, to_stage, observacao, created_at,
      ator:profiles!lead_history_ator_id_fkey(nome)
    `)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listLeadAttempts(leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_attempts")
    .select(`
      id, canal, resultado, observacao, proximo_passo, data_proximo_passo, created_at,
      autor:profiles!lead_attempts_autor_id_fkey(nome)
    `)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
```

- [ ] **Step B1.4: Test, build, commit**

```bash
npm run test
npm run build
git add src/lib/leads/ tests/unit/leads-schema.test.ts
git commit -m "feat(leads): zod schemas, queries and TDD tests"
```

---

### Task B2: Leads server actions

**Files:**
- Create: `src/lib/leads/actions.ts`

- [ ] **Step B2.1: Implementar actions com regras de transição**

```ts
// src/lib/leads/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import {
  createLeadSchema,
  editLeadSchema,
  moveStageSchema,
  markLostSchema,
  type Stage,
} from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

const STAGE_ORDER: Stage[] = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"];

function nextStage(current: Stage): Stage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}

function previousStage(current: Stage): Stage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx > 0 ? STAGE_ORDER[idx - 1] : null;
}

export async function createLeadAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio", "comercial"].includes(actor.role)) {
    return { error: "Apenas Comercial, ADM ou Sócio podem criar leads" };
  }

  const parsed = createLeadSchema.safeParse({
    nome_prospect: fd(formData, "nome_prospect"),
    site: fd(formData, "site") ?? "",
    contato_principal: fd(formData, "contato_principal"),
    email: fd(formData, "email") ?? "",
    telefone: fd(formData, "telefone"),
    valor_proposto: fd(formData, "valor_proposto") ?? 0,
    duracao_meses: fd(formData, "duracao_meses"),
    servico_proposto: fd(formData, "servico_proposto"),
    info_briefing: fd(formData, "info_briefing"),
    prioridade: fd(formData, "prioridade") || "media",
    data_prospeccao_agendada: fd(formData, "data_prospeccao_agendada"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  // Determina stage inicial: se data_prospeccao_agendada está preenchida → "prospeccao", senão também "prospeccao"
  // (sempre começa em prospeccao, mas só fica visível com data agendada)
  const initialStage: Stage = "prospeccao";

  const insertPayload = {
    organization_id: org.id,
    nome_prospect: parsed.data.nome_prospect,
    site: parsed.data.site || null,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_proposto: parsed.data.valor_proposto,
    duracao_meses: parsed.data.duracao_meses ?? null,
    servico_proposto: parsed.data.servico_proposto || null,
    info_briefing: parsed.data.info_briefing || null,
    prioridade: parsed.data.prioridade,
    data_prospeccao_agendada: parsed.data.data_prospeccao_agendada || null,
    stage: initialStage,
    comercial_id: actor.id,
  };

  const { data: created, error } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar lead" };

  await supabase.from("lead_history").insert({
    lead_id: created.id,
    from_stage: null,
    to_stage: initialStage,
    ator_id: actor.id,
    observacao: "Lead criado",
  });

  await logAudit({
    entidade: "leads",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload,
    ator_id: actor.id,
  });

  revalidatePath("/onboarding");
  redirect(`/onboarding/${created.id}`);
}

export async function updateLeadAction(formData: FormData) {
  const actor = await requireAuth();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { data: before } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!before) return { error: "Lead não encontrado" };

  const parsed = editLeadSchema.safeParse({
    id,
    nome_prospect: fd(formData, "nome_prospect"),
    site: fd(formData, "site") ?? "",
    contato_principal: fd(formData, "contato_principal"),
    email: fd(formData, "email") ?? "",
    telefone: fd(formData, "telefone"),
    valor_proposto: fd(formData, "valor_proposto") ?? 0,
    duracao_meses: fd(formData, "duracao_meses"),
    servico_proposto: fd(formData, "servico_proposto"),
    info_briefing: fd(formData, "info_briefing"),
    prioridade: fd(formData, "prioridade") || "media",
    data_prospeccao_agendada: fd(formData, "data_prospeccao_agendada"),
    data_reuniao_marco_zero: fd(formData, "data_reuniao_marco_zero"),
    coord_alocado_id: fd(formData, "coord_alocado_id"),
    assessor_alocado_id: fd(formData, "assessor_alocado_id"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const updatePayload = {
    nome_prospect: parsed.data.nome_prospect,
    site: parsed.data.site || null,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_proposto: parsed.data.valor_proposto,
    duracao_meses: parsed.data.duracao_meses ?? null,
    servico_proposto: parsed.data.servico_proposto || null,
    info_briefing: parsed.data.info_briefing || null,
    prioridade: parsed.data.prioridade,
    data_prospeccao_agendada: parsed.data.data_prospeccao_agendada || null,
    data_reuniao_marco_zero: parsed.data.data_reuniao_marco_zero || null,
    coord_alocado_id: parsed.data.coord_alocado_id || null,
    assessor_alocado_id: parsed.data.assessor_alocado_id || null,
  };

  const { error } = await supabase.from("leads").update(updatePayload).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "leads",
    entidade_id: id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath(`/onboarding/${id}`);
  revalidatePath("/onboarding");
  redirect(`/onboarding/${id}`);
}

export async function moveStageAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = moveStageSchema.safeParse({
    id: fd(formData, "id"),
    to_stage: fd(formData, "to_stage"),
    observacao: fd(formData, "observacao") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", parsed.data.id).single();
  if (!lead) return { error: "Lead não encontrado" };

  const fromStage = lead.stage as Stage;
  const toStage = parsed.data.to_stage;

  // Regras de transição
  if (toStage === "marco_zero" && !lead.data_reuniao_marco_zero) {
    return { error: "Preencha 'Data da reunião de marco zero' antes de mover" };
  }

  if (toStage === "ativo") {
    if (!lead.coord_alocado_id || !lead.assessor_alocado_id) {
      return { error: "Aloque coordenador e assessor antes de ativar o cliente" };
    }
    if (lead.stage !== "marco_zero") {
      return { error: "Só é possível ativar a partir do estágio Marco Zero" };
    }
    if (!["adm", "socio", "coordenador"].includes(actor.role)) {
      return { error: "Apenas Coord, ADM ou Sócio ativam o cliente após marco zero" };
    }
  }

  const updatePayload: Record<string, unknown> = { stage: toStage };

  if (toStage === "ativo") {
    // Cria registro em clients
    const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
    if (!org) return { error: "Organização não encontrada" };

    const today = new Date().toISOString().slice(0, 10);
    const { data: newClient, error: clientErr } = await supabase
      .from("clients")
      .insert({
        organization_id: org.id,
        nome: lead.nome_prospect,
        contato_principal: lead.contato_principal,
        email: lead.email,
        telefone: lead.telefone,
        valor_mensal: lead.valor_proposto,
        servico_contratado: lead.servico_proposto,
        status: "ativo",
        data_entrada: today,
        assessor_id: lead.assessor_alocado_id,
        coordenador_id: lead.coord_alocado_id,
      })
      .select("id")
      .single();

    if (clientErr || !newClient) return { error: clientErr?.message ?? "Falha ao criar cliente" };

    updatePayload.client_id = newClient.id;
    updatePayload.data_fechamento = today;
  }

  const { error } = await supabase.from("leads").update(updatePayload).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await supabase.from("lead_history").insert({
    lead_id: parsed.data.id,
    from_stage: fromStage,
    to_stage: toStage,
    ator_id: actor.id,
    observacao: parsed.data.observacao ?? null,
  });

  await logAudit({
    entidade: "leads",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_antes: { stage: fromStage },
    dados_depois: updatePayload,
    ator_id: actor.id,
    justificativa: parsed.data.observacao,
  });

  revalidatePath("/onboarding");
  revalidatePath(`/onboarding/${parsed.data.id}`);
  if (toStage === "ativo") revalidatePath("/clientes");
  return { success: `Movido para ${toStage}` };
}

export async function markLostAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = markLostSchema.safeParse({
    id: fd(formData, "id"),
    motivo_perdido: fd(formData, "motivo_perdido"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", parsed.data.id).single();
  if (!lead) return { error: "Lead não encontrado" };

  // Soft delete: deleta o registro (RLS garante permissão)
  const { error } = await supabase
    .from("leads")
    .update({ motivo_perdido: parsed.data.motivo_perdido })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  // Registra no histórico (mantém visível para auditoria)
  await supabase.from("lead_history").insert({
    lead_id: parsed.data.id,
    from_stage: lead.stage,
    to_stage: lead.stage,
    ator_id: actor.id,
    observacao: `Marcado como perdido: ${parsed.data.motivo_perdido}`,
  });

  await logAudit({
    entidade: "leads",
    entidade_id: parsed.data.id,
    acao: "soft_delete",
    dados_depois: { motivo_perdido: parsed.data.motivo_perdido },
    ator_id: actor.id,
    justificativa: parsed.data.motivo_perdido,
  });

  revalidatePath("/onboarding");
  return { success: "Lead marcado como perdido" };
}
```

- [ ] **Step B2.2: Build, commit**

```bash
npm run build
git add src/lib/leads/actions.ts
git commit -m "feat(leads): server actions for create/update/moveStage/markLost with auto-create client"
```

---

### Task B3: Lead attempts actions

**Files:**
- Create: `src/lib/lead-attempts/actions.ts`

- [ ] **Step B3.1: actions.ts**

```ts
// src/lib/lead-attempts/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const attemptSchema = z.object({
  lead_id: z.string().uuid(),
  canal: z.enum(["whatsapp", "email", "ligacao", "presencial", "outro"]).default("whatsapp"),
  resultado: z.enum(["sem_resposta", "agendou", "recusou", "pediu_proposta", "outro"]).default("sem_resposta"),
  observacao: z.string().optional().nullable(),
  proximo_passo: z.string().optional().nullable(),
  data_proximo_passo: z.string().optional().nullable(),
});

export async function addAttemptAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = attemptSchema.safeParse({
    lead_id: formData.get("lead_id"),
    canal: formData.get("canal") || "whatsapp",
    resultado: formData.get("resultado") || "sem_resposta",
    observacao: formData.get("observacao") || null,
    proximo_passo: formData.get("proximo_passo") || null,
    data_proximo_passo: formData.get("data_proximo_passo") || null,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("lead_attempts").insert({
    lead_id: parsed.data.lead_id,
    autor_id: actor.id,
    canal: parsed.data.canal,
    resultado: parsed.data.resultado,
    observacao: parsed.data.observacao || null,
    proximo_passo: parsed.data.proximo_passo || null,
    data_proximo_passo: parsed.data.data_proximo_passo || null,
  });

  if (error) return { error: error.message };
  revalidatePath(`/onboarding/${parsed.data.lead_id}`);
  return { success: "Registro adicionado" };
}

export async function deleteAttemptAction(attemptId: string, leadId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("lead_attempts").delete().eq("id", attemptId);
  if (error) return { error: error.message };
  revalidatePath(`/onboarding/${leadId}`);
  return { success: "Registro removido" };
}
```

- [ ] **Step B3.2: Commit**

```bash
git add src/lib/lead-attempts/
git commit -m "feat(lead-attempts): CRUD actions for follow-up records"
```

---

## Bloco C — UI (Kanban + Lead Pages)

### Task C1: Componentes de Kanban

**Files:**
- Create: `src/components/onboarding/StageTransitionButtons.tsx`
- Create: `src/components/onboarding/LeadCard.tsx`
- Create: `src/components/onboarding/KanbanColumn.tsx`
- Create: `src/components/onboarding/KanbanBoard.tsx`

- [ ] **Step C1.1: StageTransitionButtons**

```tsx
// src/components/onboarding/StageTransitionButtons.tsx
"use client";

import { useState } from "react";
import { moveStageAction, markLostAction } from "@/lib/leads/actions";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import type { Stage } from "@/lib/leads/schema";

const STAGE_ORDER: Stage[] = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"];

const STAGE_LABEL: Record<Stage, string> = {
  prospeccao: "Prospecção",
  comercial: "Reunião Comercial",
  contrato: "Contrato",
  marco_zero: "Marco Zero",
  ativo: "Cliente ativo",
};

interface Props {
  leadId: string;
  currentStage: Stage;
  compact?: boolean;
}

export function StageTransitionButtons({ leadId, currentStage, compact = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLost, setShowLost] = useState(false);
  const [motivo, setMotivo] = useState("");

  const idx = STAGE_ORDER.indexOf(currentStage);
  const next = idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
  const prev = idx > 0 ? STAGE_ORDER[idx - 1] : null;
  const isActive = currentStage === "ativo";

  async function move(toStage: Stage) {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("id", leadId);
    fd.set("to_stage", toStage);
    const r = await moveStageAction(fd);
    setBusy(false);
    if (r && "error" in r && r.error) setError(r.error);
  }

  async function markLost() {
    if (motivo.length < 3) { setError("Informe o motivo (mín. 3 caracteres)"); return; }
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("id", leadId);
    fd.set("motivo_perdido", motivo);
    const r = await markLostAction(fd);
    setBusy(false);
    if (r && "error" in r && r.error) setError(r.error);
    else { setShowLost(false); setMotivo(""); }
  }

  if (isActive) {
    return <p className="text-xs text-muted-foreground">Lead virou cliente ativo. Veja em /clientes.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {prev && (
          <Button size={compact ? "sm" : "default"} variant="outline" onClick={() => move(prev)} disabled={busy}>
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            {compact ? "" : `Voltar para ${STAGE_LABEL[prev]}`}
          </Button>
        )}
        {next && (
          <Button size={compact ? "sm" : "default"} onClick={() => move(next)} disabled={busy}>
            {compact ? "" : `Avançar para ${STAGE_LABEL[next]}`}
            <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        )}
        {!showLost && (
          <Button size={compact ? "sm" : "default"} variant="ghost" onClick={() => setShowLost(true)} disabled={busy}>
            <X className="mr-1 h-3.5 w-3.5" />
            Marcar perdido
          </Button>
        )}
      </div>

      {showLost && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo (ex.: cliente fechou com concorrente)"
            className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={markLost} disabled={busy}>Confirmar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowLost(false); setMotivo(""); setError(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step C1.2: LeadCard**

```tsx
// src/components/onboarding/LeadCard.tsx
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageTransitionButtons } from "./StageTransitionButtons";
import type { LeadRow } from "@/lib/leads/queries";
import type { Stage } from "@/lib/leads/schema";

const priorityClass: Record<string, string> = {
  alta: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  media: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};

function formatBR(date: string | null) {
  if (!date) return null;
  const d = new Date(date);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function LeadCard({ lead }: { lead: LeadRow }) {
  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/onboarding/${lead.id}`} className="font-semibold hover:underline">
          {lead.nome_prospect}
        </Link>
        <Badge variant="outline" className={priorityClass[lead.prioridade]}>{lead.prioridade}</Badge>
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        {lead.site && <div>🌐 {lead.site.replace(/^https?:\/\//, "")}</div>}
        {lead.servico_proposto && <div>📋 {lead.servico_proposto}</div>}
        <div>💰 R$ {Number(lead.valor_proposto).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês</div>
        {lead.stage === "prospeccao" && lead.data_prospeccao_agendada && (
          <div>📅 Reunião: {formatBR(lead.data_prospeccao_agendada)}</div>
        )}
        {lead.data_reuniao_marco_zero && lead.stage !== "ativo" && (
          <div>🚀 Marco zero: {formatBR(lead.data_reuniao_marco_zero)}</div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 pt-1 text-[10px] text-muted-foreground">
        {lead.comercial_nome && <span>Com: {lead.comercial_nome}</span>}
        {lead.coord_nome && <span>· Coord: {lead.coord_nome}</span>}
        {lead.assessor_nome && <span>· Asses: {lead.assessor_nome}</span>}
      </div>

      <StageTransitionButtons leadId={lead.id} currentStage={lead.stage as Stage} compact />
    </Card>
  );
}
```

- [ ] **Step C1.3: KanbanColumn**

```tsx
// src/components/onboarding/KanbanColumn.tsx
import { LeadCard } from "./LeadCard";
import type { LeadRow } from "@/lib/leads/queries";
import type { Stage } from "@/lib/leads/schema";

const STAGE_LABEL: Record<Stage, string> = {
  prospeccao: "Prospecção",
  comercial: "Reunião Comercial",
  contrato: "Contrato (ADM)",
  marco_zero: "Marco Zero",
  ativo: "Cliente ativo",
};

const STAGE_DESC: Record<Stage, string> = {
  prospeccao: "Reunião agendada",
  comercial: "Em negociação",
  contrato: "Emitir contrato",
  marco_zero: "Coord conduz reunião",
  ativo: "Entrou na carteira",
};

export function KanbanColumn({ stage, leads }: { stage: Stage; leads: LeadRow[] }) {
  return (
    <div className="flex w-[280px] flex-shrink-0 flex-col rounded-xl border bg-muted/20">
      <div className="border-b px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{STAGE_LABEL[stage]}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{leads.length}</span>
        </div>
        <p className="text-[11px] text-muted-foreground">{STAGE_DESC[stage]}</p>
      </div>

      <div className="flex-1 space-y-2 p-2 overflow-y-auto max-h-[calc(100vh-260px)]">
        {leads.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">Vazio</p>
        ) : (
          leads.map((l) => <LeadCard key={l.id} lead={l} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step C1.4: KanbanBoard**

```tsx
// src/components/onboarding/KanbanBoard.tsx
import { KanbanColumn } from "./KanbanColumn";
import type { LeadRow } from "@/lib/leads/queries";
import type { Stage } from "@/lib/leads/schema";

const STAGES: Stage[] = ["prospeccao", "comercial", "contrato", "marco_zero", "ativo"];

export function KanbanBoard({ groups }: { groups: Record<Stage, LeadRow[]> }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3">
        {STAGES.map((s) => (
          <KanbanColumn key={s} stage={s} leads={groups[s]} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step C1.5: Commit**

```bash
git add src/components/onboarding/
git commit -m "feat(onboarding): kanban board with 5 columns and stage transition buttons"
```

---

### Task C2: LeadForm + página `/onboarding/novo`

**Files:**
- Create: `src/components/onboarding/LeadForm.tsx`
- Create: `src/app/(authed)/onboarding/novo/page.tsx`

- [ ] **Step C2.1: LeadForm**

```tsx
// src/components/onboarding/LeadForm.tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProfileOption { id: string; nome: string; }

interface Props {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  defaults?: Partial<{
    id: string;
    nome_prospect: string;
    site: string | null;
    contato_principal: string | null;
    email: string | null;
    telefone: string | null;
    valor_proposto: number | string;
    duracao_meses: number | string | null;
    servico_proposto: string | null;
    info_briefing: string | null;
    prioridade: string;
    data_prospeccao_agendada: string | null;
    data_reuniao_marco_zero: string | null;
    coord_alocado_id: string | null;
    assessor_alocado_id: string | null;
  }>;
  coordenadores?: ProfileOption[];
  assessores?: ProfileOption[];
  isEdit?: boolean;
  submitLabel?: string;
}

export function LeadForm({ action, defaults = {}, coordenadores = [], assessores = [], isEdit = false, submitLabel = "Salvar" }: Props) {
  return (
    <form action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nome_prospect">Nome do prospect</Label>
          <Input id="nome_prospect" name="nome_prospect" defaultValue={defaults.nome_prospect ?? ""} required minLength={2} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="site">Site</Label>
          <Input id="site" name="site" type="url" placeholder="https://..." defaultValue={defaults.site ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contato_principal">Contato principal</Label>
          <Input id="contato_principal" name="contato_principal" defaultValue={defaults.contato_principal ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={defaults.email ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" defaultValue={defaults.telefone ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="valor_proposto">Valor mensal proposto (R$)</Label>
          <Input id="valor_proposto" name="valor_proposto" type="number" step="0.01" min="0" defaultValue={String(defaults.valor_proposto ?? 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duracao_meses">Duração (meses)</Label>
          <Input id="duracao_meses" name="duracao_meses" type="number" min="0" defaultValue={String(defaults.duracao_meses ?? "")} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="servico_proposto">Serviço proposto</Label>
          <Input id="servico_proposto" name="servico_proposto" placeholder="Ex.: Social media + Tráfego pago" defaultValue={defaults.servico_proposto ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prioridade">Prioridade</Label>
          <Select name="prioridade" defaultValue={defaults.prioridade ?? "media"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_prospeccao_agendada">Data da reunião de prospecção</Label>
          <Input
            id="data_prospeccao_agendada" name="data_prospeccao_agendada" type="datetime-local"
            defaultValue={defaults.data_prospeccao_agendada ? defaults.data_prospeccao_agendada.slice(0, 16) : ""}
          />
        </div>

        {isEdit && (
          <>
            <div className="space-y-2">
              <Label htmlFor="data_reuniao_marco_zero">Data da reunião de marco zero</Label>
              <Input
                id="data_reuniao_marco_zero" name="data_reuniao_marco_zero" type="datetime-local"
                defaultValue={defaults.data_reuniao_marco_zero ? defaults.data_reuniao_marco_zero.slice(0, 16) : ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coord_alocado_id">Coordenador alocado</Label>
              <Select name="coord_alocado_id" defaultValue={defaults.coord_alocado_id ?? ""}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem coordenador</SelectItem>
                  {coordenadores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assessor_alocado_id">Assessor alocado</Label>
              <Select name="assessor_alocado_id" defaultValue={defaults.assessor_alocado_id ?? ""}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem assessor</SelectItem>
                  {assessores.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="info_briefing">Info coletada na prospecção</Label>
          <Textarea id="info_briefing" name="info_briefing" rows={4} defaultValue={defaults.info_briefing ?? ""} />
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
```

- [ ] **Step C2.2: Página `/onboarding/novo`**

```tsx
// src/app/(authed)/onboarding/novo/page.tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createLeadAction } from "@/lib/leads/actions";
import { LeadForm } from "@/components/onboarding/LeadForm";
import { Card } from "@/components/ui/card";

export default async function NovoLeadPage() {
  const user = await requireAuth();
  if (!["adm", "socio", "comercial"].includes(user.role)) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo prospect</h1>
        <p className="text-sm text-muted-foreground">
          Adicione um novo prospect ao kanban. Ele entra no estágio &quot;Prospecção&quot; e você pode agendar a reunião comercial.
        </p>
      </header>
      <Card className="p-6">
        <LeadForm action={createLeadAction} submitLabel="Criar prospect" />
      </Card>
    </div>
  );
}
```

- [ ] **Step C2.3: Commit**

```bash
git add src/components/onboarding/LeadForm.tsx "src/app/(authed)/onboarding/novo/"
git commit -m "feat(onboarding): create lead form and new prospect page"
```

---

### Task C3: Kanban view + lead detail page

**Files:**
- Create: `src/app/(authed)/onboarding/page.tsx`
- Create: `src/app/(authed)/onboarding/[id]/page.tsx`
- Create: `src/components/onboarding/AddAttemptForm.tsx`
- Create: `src/components/onboarding/LeadAttemptsTimeline.tsx`

- [ ] **Step C3.1: Página kanban `/onboarding`**

```tsx
// src/app/(authed)/onboarding/page.tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listLeadsByStage } from "@/lib/leads/queries";
import { KanbanBoard } from "@/components/onboarding/KanbanBoard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function OnboardingPage() {
  const user = await requireAuth();
  const groups = await listLeadsByStage();

  const total =
    groups.prospeccao.length + groups.comercial.length +
    groups.contrato.length + groups.marco_zero.length + groups.ativo.length;

  const canCreate = ["adm", "socio", "comercial"].includes(user.role);

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Pipeline de novos clientes · {total} lead{total !== 1 ? "s" : ""} ativo{total !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/onboarding/novo"><Plus className="mr-2 h-4 w-4" />Novo prospect</Link>
          </Button>
        )}
      </header>

      <KanbanBoard groups={groups} />
    </div>
  );
}
```

- [ ] **Step C3.2: AddAttemptForm**

```tsx
// src/components/onboarding/AddAttemptForm.tsx
import { addAttemptAction } from "@/lib/lead-attempts/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddAttemptForm({ leadId }: { leadId: string }) {
  return (
    <form action={addAttemptAction} className="rounded-xl border bg-card p-4 space-y-3">
      <input type="hidden" name="lead_id" value={leadId} />
      <h3 className="text-sm font-semibold">Registrar tentativa de contato</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="canal">Canal</Label>
          <Select name="canal" defaultValue="whatsapp">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="ligacao">Ligação</SelectItem>
              <SelectItem value="presencial">Presencial</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="resultado">Resultado</Label>
          <Select name="resultado" defaultValue="sem_resposta">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sem_resposta">Sem resposta</SelectItem>
              <SelectItem value="agendou">Agendou reunião</SelectItem>
              <SelectItem value="recusou">Recusou</SelectItem>
              <SelectItem value="pediu_proposta">Pediu proposta</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="observacao">Observação</Label>
          <Textarea id="observacao" name="observacao" rows={2} placeholder="O que rolou?" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proximo_passo">Próximo passo</Label>
          <Input id="proximo_passo" name="proximo_passo" placeholder="Ex.: enviar proposta semana que vem" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_proximo_passo">Data do próximo passo</Label>
          <Input id="data_proximo_passo" name="data_proximo_passo" type="date" />
        </div>
      </div>
      <Button type="submit">Adicionar</Button>
    </form>
  );
}
```

- [ ] **Step C3.3: LeadAttemptsTimeline**

```tsx
// src/components/onboarding/LeadAttemptsTimeline.tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Attempt {
  id: string;
  canal: string;
  resultado: string;
  observacao: string | null;
  proximo_passo: string | null;
  data_proximo_passo: string | null;
  created_at: string;
  // @ts-expect-error nested
  autor?: { nome: string } | null;
}

const canalLabel: Record<string, string> = {
  whatsapp: "WhatsApp", email: "Email", ligacao: "Ligação", presencial: "Presencial", outro: "Outro",
};

const resultadoLabel: Record<string, string> = {
  sem_resposta: "Sem resposta", agendou: "Agendou", recusou: "Recusou",
  pediu_proposta: "Pediu proposta", outro: "Outro",
};

export function LeadAttemptsTimeline({ attempts }: { attempts: Attempt[] }) {
  if (attempts.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Nenhuma tentativa registrada.
      </Card>
    );
  }

  return (
    <ol className="space-y-2">
      {attempts.map((a) => (
        <li key={a.id}>
          <Card className="p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{canalLabel[a.canal]}</Badge>
              <Badge variant="outline">{resultadoLabel[a.resultado]}</Badge>
              <span>· {a.autor?.nome ?? "—"}</span>
              <span>· {new Date(a.created_at).toLocaleString("pt-BR")}</span>
            </div>
            {a.observacao && <p className="text-sm">{a.observacao}</p>}
            {a.proximo_passo && (
              <p className="text-xs">
                <strong>Próximo passo:</strong> {a.proximo_passo}
                {a.data_proximo_passo && ` · ${new Date(a.data_proximo_passo).toLocaleDateString("pt-BR")}`}
              </p>
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step C3.4: Página detalhe `/onboarding/[id]`**

```tsx
// src/app/(authed)/onboarding/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLeadById, listLeadHistory, listLeadAttempts } from "@/lib/leads/queries";
import { updateLeadAction } from "@/lib/leads/actions";
import { LeadForm } from "@/components/onboarding/LeadForm";
import { StageTransitionButtons } from "@/components/onboarding/StageTransitionButtons";
import { AddAttemptForm } from "@/components/onboarding/AddAttemptForm";
import { LeadAttemptsTimeline } from "@/components/onboarding/LeadAttemptsTimeline";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Stage } from "@/lib/leads/schema";

const STAGE_LABEL: Record<string, string> = {
  prospeccao: "Prospecção", comercial: "Reunião Comercial",
  contrato: "Contrato", marco_zero: "Marco Zero", ativo: "Cliente ativo",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();

  let lead;
  try { lead = await getLeadById(id); } catch { notFound(); }

  const supabase = await createClient();
  const [{ data: profiles = [] }, history, attempts] = await Promise.all([
    supabase.from("profiles").select("id, nome, role").eq("ativo", true).order("nome"),
    listLeadHistory(id),
    listLeadAttempts(id),
  ]);

  const coordenadores = (profiles ?? []).filter((p) => p.role === "coordenador");
  const assessores = (profiles ?? []).filter((p) => p.role === "assessor");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{lead.nome_prospect}</h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">{STAGE_LABEL[lead.stage]}</Badge>
            {lead.client_id && (
              // @ts-expect-error nested
              <Link href={`/clientes/${lead.client_id}`} className="text-xs text-primary hover:underline">
                → Cliente: {lead.cliente?.nome}
              </Link>
            )}
          </div>
        </div>
      </header>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Mover de estágio</h2>
        <StageTransitionButtons leadId={lead.id} currentStage={lead.stage as Stage} />
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-lg font-semibold">Dados do prospect</h2>
        <LeadForm
          action={updateLeadAction}
          defaults={{
            id: lead.id,
            nome_prospect: lead.nome_prospect,
            site: lead.site,
            contato_principal: lead.contato_principal,
            email: lead.email,
            telefone: lead.telefone,
            valor_proposto: lead.valor_proposto,
            duracao_meses: lead.duracao_meses,
            servico_proposto: lead.servico_proposto,
            info_briefing: lead.info_briefing,
            prioridade: lead.prioridade,
            data_prospeccao_agendada: lead.data_prospeccao_agendada,
            data_reuniao_marco_zero: lead.data_reuniao_marco_zero,
            coord_alocado_id: lead.coord_alocado_id,
            assessor_alocado_id: lead.assessor_alocado_id,
          }}
          coordenadores={coordenadores}
          assessores={assessores}
          isEdit
          submitLabel="Salvar alterações"
        />
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Tentativas de contato</h2>
        <AddAttemptForm leadId={lead.id} />
        <LeadAttemptsTimeline attempts={attempts} />
      </div>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold">Histórico de estágios</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem histórico.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-2">
                <Badge variant="secondary">
                  {h.from_stage ? `${STAGE_LABEL[h.from_stage]} → ` : ""}{STAGE_LABEL[h.to_stage]}
                </Badge>
                {/* @ts-expect-error nested */}
                <span className="text-xs text-muted-foreground">por {h.ator?.nome ?? "—"} · {new Date(h.created_at).toLocaleString("pt-BR")}</span>
                {h.observacao && <span className="text-xs italic">— {h.observacao}</span>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step C3.5: Build, commit**

```bash
npm run build
git add "src/app/(authed)/onboarding/" src/components/onboarding/AddAttemptForm.tsx src/components/onboarding/LeadAttemptsTimeline.tsx
git commit -m "feat(onboarding): kanban page and lead detail with attempts timeline"
```

---

## Bloco D — Tests + smoke

### Task D1: E2E tests + final verification

**Files:**
- Create: `tests/e2e/onboarding.spec.ts`

- [ ] **Step D1.1: Test E2E**

```ts
// tests/e2e/onboarding.spec.ts
import { test, expect } from "@playwright/test";

test("rota /onboarding redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /onboarding/novo redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/onboarding/novo");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step D1.2: Run all + commit**

```bash
npm run test
npm run build
git add tests/e2e/onboarding.spec.ts
git commit -m "test(e2e): onboarding auth-redirect tests"
```

- [ ] **Step D1.3: Push**

```bash
git push origin main
```

(Se push pedir auth, embute token na URL temporariamente, igual fizemos antes.)

---

## Self-Review

### Cobertura do spec — Fase 2 (kanban + leads)

| Spec (5.3) | Coberto por |
|---|---|
| Tabela `leads` com 5 estágios | Task A1 |
| Tabela `lead_history` (audit) | Task A2 |
| Tabela `lead_attempts` (follow-ups) | Task A2 |
| Stage 1: Prospecção (agendada) | Task C1, C2 (data_prospeccao_agendada) |
| Stage 2: Reunião Comercial | Task B2 (moveStage) |
| Stage 3: Contrato (ADM) | Task B2 |
| Stage 4: Marco Zero (Coord conduz) | Task B2 (validation: data_reuniao_marco_zero required) |
| Stage 5: Cliente ativo | Task B2 (auto-cria registro em `clients`) |
| Comercial agenda marco zero | Task B2 (Comercial pode editar lead) |
| Coord conduz marco zero | RLS A1 (Coord update in marco_zero stage) |
| Movimentação dispara automação (cria cliente) | Task B2 (moveStageAction) |
| Validação "data_reuniao_marco_zero" antes de mover | Task B2 |
| Histórico de stages | Task A2 + B2 |
| Tentativas de contato (`lead_attempts`) | Task A2, B3, C3 |

### Lacunas conhecidas (intencionais — Fases 3+)

- Calendário Interno alimentado pelo kanban → Fase 3
- Área Prospecção (CRM Comercial) → Fase 4
- Notificação ao mover stage → Fase 5
- Comissão automática do Comercial ao fechar → Fase 6
- Drag-and-drop no kanban → futuro (botões resolvem)
- Tarefa automática para próximo responsável → Fase 5 (junto com notificações)

---

## Resumo da entrega da Fase 2

Após executar:
- Kanban visual com 5 colunas e contadores em `/onboarding`
- Comercial cria prospect em `/onboarding/novo`
- Cards mostram nome, site, valor, serviço, datas-chave, prioridade e responsáveis
- Botões "Avançar / Voltar / Marcar perdido" em cada card
- Validação automática (não move pra Marco Zero sem data, não ativa sem coord/assessor)
- Página de detalhes com edição completa, registro de tentativas de contato (canal + resultado), e histórico de estágios
- Quando lead vira "ativo": **cria automaticamente o registro em `clients`** com todos os dados (Phase 1 já cuida da gestão dele)
- Audit log de tudo

Total estimado: **~12 commits** na fase.
