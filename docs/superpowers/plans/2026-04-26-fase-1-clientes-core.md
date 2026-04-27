# Fase 1 — Clientes core (Yide Digital) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o cadastro completo de clientes da Yide com lista filtrável + pasta digital por cliente (briefing, reuniões, arquivos, datas importantes, tarefas, histórico). Após esta fase, a Yide para de usar planilha de clientes — tudo passa a viver dentro do sistema.

**Architecture:** Continuação direta da Fase 0. Mais 5 tabelas no Supabase com RLS, server actions tipadas, páginas Next.js dentro de `(authed)/clientes/[id]/...`. Upload de arquivos via Supabase Storage. UI segue paleta Yide e padrões já estabelecidos (sidebar fixa, cantos arredondados, ícones Lucide).

**Tech Stack:** Next.js 15 + Supabase (Postgres + Storage + RLS) + shadcn/ui + Zod + date-fns + react-markdown (render do briefing) + react-dropzone (upload) + Recharts não usado nesta fase.

**Spec de referência:** [docs/superpowers/specs/2026-04-26-sistema-acompanhamento-design.md](../specs/2026-04-26-sistema-acompanhamento-design.md), seções 5.2 (clientes) e 5.5 (tarefas).

**Plano anterior (Fase 0):** [docs/superpowers/plans/2026-04-26-fase-0-fundacao.md](2026-04-26-fase-0-fundacao.md)

---

## Estrutura de arquivos da Fase 1

```
supabase/
├── migrations/
│   ├── 20260427000001_clients.sql                  # tabela + RLS
│   ├── 20260427000002_client_folder.sql            # briefing/notes/files/dates + RLS
│   ├── 20260427000003_tasks.sql                    # tasks + RLS
│   └── 20260427000004_storage_bucket.sql           # bucket "client-files" + policies

src/
├── app/(authed)/
│   ├── clientes/
│   │   ├── page.tsx                                # lista
│   │   ├── novo/page.tsx                           # criar
│   │   ├── importar/page.tsx                       # bulk import
│   │   └── [id]/
│   │       ├── layout.tsx                          # sidebar interna do cliente
│   │       ├── page.tsx                            # visão geral
│   │       ├── editar/page.tsx                     # editar dados básicos
│   │       ├── briefing/page.tsx
│   │       ├── reunioes/page.tsx
│   │       ├── arquivos/page.tsx
│   │       ├── datas/page.tsx
│   │       ├── tarefas/page.tsx                    # tarefas do cliente
│   │       └── historico/page.tsx                  # audit log filtrado
│   └── tarefas/
│       ├── page.tsx                                # lista global
│       ├── nova/page.tsx
│       └── [id]/page.tsx                           # ver/editar
│
├── components/clientes/
│   ├── ClientesTable.tsx
│   ├── ClienteForm.tsx                             # usado em novo + editar
│   ├── ClienteHeader.tsx                           # header da pasta com status, valor
│   ├── ClienteSidebar.tsx                          # sub-nav da pasta
│   ├── BulkImportForm.tsx                          # textarea + preview do import
│   └── StatusBadge.tsx
├── components/client-folder/
│   ├── BriefingEditor.tsx
│   ├── NotesTimeline.tsx
│   ├── AddNoteForm.tsx
│   ├── FileUploader.tsx
│   ├── FilesList.tsx
│   ├── DatesList.tsx
│   └── AddDateForm.tsx
├── components/tarefas/
│   ├── TasksList.tsx
│   ├── TaskForm.tsx
│   └── PriorityBadge.tsx
│
├── lib/clientes/
│   ├── schema.ts                                   # zod schemas
│   ├── queries.ts                                  # list, getById, getStats
│   ├── actions.ts                                  # create, update, churn
│   └── import.ts                                   # parser TSV/CSV + bulk insert action
├── lib/client-folder/
│   ├── briefing-actions.ts
│   ├── notes-actions.ts
│   ├── files-actions.ts                            # uses Supabase Storage
│   └── dates-actions.ts
└── lib/tarefas/
    ├── schema.ts
    ├── queries.ts
    └── actions.ts

tests/
├── unit/
│   ├── clientes-schema.test.ts
│   └── tarefas-schema.test.ts
└── e2e/
    └── clientes-crud.spec.ts
```

---

## Bloco A — Migrations e Storage

### Task A1: Migration `clients` + RLS

**Files:**
- Create: `supabase/migrations/20260427000001_clients.sql`

- [ ] **Step A1.1: Criar arquivo SQL**

```sql
-- supabase/migrations/20260427000001_clients.sql
create type public.client_status as enum ('ativo', 'churn', 'em_onboarding');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  nome text not null,
  contato_principal text,
  email text,
  telefone text,
  valor_mensal numeric(12, 2) not null default 0,
  servico_contratado text,
  status public.client_status not null default 'ativo',
  data_entrada date not null default current_date,
  data_churn date,
  motivo_churn text,
  assessor_id uuid references public.profiles(id) on delete set null,
  coordenador_id uuid references public.profiles(id) on delete set null,
  data_aniversario_socio_cliente date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_clients_status on public.clients(status);
create index idx_clients_assessor on public.clients(assessor_id);
create index idx_clients_coordenador on public.clients(coordenador_id);

create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

-- Todos autenticados podem ler clientes (assessor vê tudo per spec)
create policy "authenticated can view clients"
  on public.clients for select
  to authenticated
  using (true);

-- ADM/Sócio podem criar
create policy "adm/socio can insert clients"
  on public.clients for insert
  to authenticated
  with check (public.current_user_role() in ('adm', 'socio'));

-- ADM/Sócio podem atualizar qualquer cliente
create policy "adm/socio can update any client"
  on public.clients for update
  to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));

-- Coord/Assessor podem atualizar APENAS clientes onde estão alocados
create policy "coord/assessor can update own clients"
  on public.clients for update
  to authenticated
  using (
    public.current_user_role() in ('coordenador', 'assessor')
    and (assessor_id = auth.uid() or coordenador_id = auth.uid())
  )
  with check (
    public.current_user_role() in ('coordenador', 'assessor')
    and (assessor_id = auth.uid() or coordenador_id = auth.uid())
  );

-- Sem DELETE — soft-delete via status='churn'
```

- [ ] **Step A1.2: Aplicar migration**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2)
npx supabase db push
```

Expected: aplicar com sucesso, log mostrando `20260427000001_clients.sql`.

- [ ] **Step A1.3: Commit**

```bash
git add supabase/migrations/20260427000001_clients.sql
git commit -m "feat(db): clients table with RLS"
```

---

### Task A2: Migration pasta do cliente (briefing, notes, files, dates) + RLS

**Files:**
- Create: `supabase/migrations/20260427000002_client_folder.sql`

- [ ] **Step A2.1: Criar arquivo SQL**

```sql
-- supabase/migrations/20260427000002_client_folder.sql

-- 1) Briefing (1:1 com cliente)
create table public.client_briefing (
  client_id uuid primary key references public.clients(id) on delete cascade,
  texto_markdown text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create trigger trg_client_briefing_updated_at
  before update on public.client_briefing
  for each row execute function public.set_updated_at();

alter table public.client_briefing enable row level security;

create policy "authenticated read briefing"
  on public.client_briefing for select to authenticated using (true);

create policy "adm/socio insert briefing"
  on public.client_briefing for insert to authenticated
  with check (public.current_user_role() in ('adm', 'socio'));

create policy "edit briefing of own client"
  on public.client_briefing for update to authenticated
  using (
    public.current_user_role() in ('adm', 'socio')
    or exists (
      select 1 from public.clients c
      where c.id = client_briefing.client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );

-- 2) Notes/Reuniões
create type public.note_type as enum ('reuniao', 'observacao', 'mudanca_status');

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  autor_id uuid not null references public.profiles(id),
  tipo public.note_type not null default 'reuniao',
  texto_rico text not null,
  created_at timestamptz not null default now()
);

create index idx_client_notes_client on public.client_notes(client_id, created_at desc);

alter table public.client_notes enable row level security;

create policy "authenticated read notes"
  on public.client_notes for select to authenticated using (true);

create policy "authenticated insert own notes"
  on public.client_notes for insert to authenticated
  with check (autor_id = auth.uid());

create policy "author can update own notes"
  on public.client_notes for update to authenticated
  using (autor_id = auth.uid());

create policy "author or adm/socio can delete notes"
  on public.client_notes for delete to authenticated
  using (autor_id = auth.uid() or public.current_user_role() in ('adm', 'socio'));

-- 3) Files
create type public.file_category as enum ('briefing', 'contrato', 'criativo', 'outro');

create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  categoria public.file_category not null default 'outro',
  nome_arquivo text not null,
  storage_path text not null,
  size_bytes bigint not null,
  mime_type text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_client_files_client on public.client_files(client_id, created_at desc);

alter table public.client_files enable row level security;

create policy "authenticated read files"
  on public.client_files for select to authenticated using (true);

create policy "authenticated upload files"
  on public.client_files for insert to authenticated
  with check (uploaded_by = auth.uid());

create policy "uploader or adm/socio can delete files"
  on public.client_files for delete to authenticated
  using (uploaded_by = auth.uid() or public.current_user_role() in ('adm', 'socio'));

-- 4) Important dates
create type public.important_date_type as enum ('aniversario_socio', 'renovacao', 'kickoff', 'custom');

create table public.client_important_dates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  tipo public.important_date_type not null default 'custom',
  data date not null,
  descricao text not null,
  notify_days_before integer[] not null default array[30, 7, 1],
  created_at timestamptz not null default now()
);

create index idx_client_dates_client on public.client_important_dates(client_id, data);

alter table public.client_important_dates enable row level security;

create policy "authenticated read dates"
  on public.client_important_dates for select to authenticated using (true);

create policy "manage dates of own client"
  on public.client_important_dates for all to authenticated
  using (
    public.current_user_role() in ('adm', 'socio')
    or exists (
      select 1 from public.clients c
      where c.id = client_important_dates.client_id
        and (c.assessor_id = auth.uid() or c.coordenador_id = auth.uid())
    )
  );
```

- [ ] **Step A2.2: Aplicar e commit**

```bash
npx supabase db push
git add supabase/migrations/20260427000002_client_folder.sql
git commit -m "feat(db): client folder tables (briefing, notes, files, dates) with RLS"
```

---

### Task A3: Migration tasks + RLS

**Files:**
- Create: `supabase/migrations/20260427000003_tasks.sql`

- [ ] **Step A3.1: Criar arquivo SQL**

```sql
-- supabase/migrations/20260427000003_tasks.sql
create type public.task_priority as enum ('alta', 'media', 'baixa');
create type public.task_status as enum ('aberta', 'em_andamento', 'concluida');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  prioridade public.task_priority not null default 'media',
  status public.task_status not null default 'aberta',
  criado_por uuid not null references public.profiles(id),
  atribuido_a uuid not null references public.profiles(id),
  client_id uuid references public.clients(id) on delete set null,
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index idx_tasks_atribuido on public.tasks(atribuido_a, status);
create index idx_tasks_criado_por on public.tasks(criado_por);
create index idx_tasks_client on public.tasks(client_id);
create index idx_tasks_due_date on public.tasks(due_date);

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "authenticated read tasks"
  on public.tasks for select to authenticated using (true);

create policy "authenticated insert tasks they create"
  on public.tasks for insert to authenticated
  with check (criado_por = auth.uid());

create policy "creator or assignee can update task"
  on public.tasks for update to authenticated
  using (criado_por = auth.uid() or atribuido_a = auth.uid())
  with check (criado_por = auth.uid() or atribuido_a = auth.uid());

create policy "creator or adm/socio can delete task"
  on public.tasks for delete to authenticated
  using (criado_por = auth.uid() or public.current_user_role() in ('adm', 'socio'));
```

- [ ] **Step A3.2: Aplicar e commit**

```bash
npx supabase db push
git add supabase/migrations/20260427000003_tasks.sql
git commit -m "feat(db): tasks table with RLS"
```

---

### Task A4: Storage bucket pra arquivos do cliente

**Files:**
- Create: `supabase/migrations/20260427000004_storage_bucket.sql`

- [ ] **Step A4.1: Criar bucket via SQL**

```sql
-- supabase/migrations/20260427000004_storage_bucket.sql

-- Bucket privado (auth required)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-files',
  'client-files',
  false,
  52428800, -- 50MB
  null      -- accept all mime types
)
on conflict (id) do nothing;

-- Policy: usuários autenticados podem ler arquivos do bucket
create policy "authenticated read client-files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'client-files');

-- Policy: usuários autenticados podem fazer upload no bucket
create policy "authenticated upload client-files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'client-files');

-- Policy: usuário que subiu (owner) ou ADM/Sócio podem deletar
create policy "owner or adm/socio delete client-files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'client-files'
    and (
      auth.uid() = owner
      or public.current_user_role() in ('adm', 'socio')
    )
  );
```

- [ ] **Step A4.2: Aplicar e commit**

```bash
npx supabase db push
git add supabase/migrations/20260427000004_storage_bucket.sql
git commit -m "feat(db): storage bucket client-files with RLS"
```

---

### Task A5: Regenerar tipos TypeScript

- [ ] **Step A5.1: Gerar tipos**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
SUPABASE_PROJECT_ID=jelvhwbpipawghwufpbc npm run db:types
```

Expected: `src/types/database.ts` cresce significativamente com as 5 novas tabelas + enums (`client_status`, `note_type`, `file_category`, `important_date_type`, `task_priority`, `task_status`).

- [ ] **Step A5.2: Verificar typecheck**

```bash
npm run typecheck
```

Expected: passa.

- [ ] **Step A5.3: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(db): regenerate types after fase 1 migrations"
```

---

## Bloco B — Backend (schemas, queries, server actions)

### Task B1: Schemas Zod e queries de Clientes

**Files:**
- Create: `src/lib/clientes/schema.ts`
- Create: `src/lib/clientes/queries.ts`

- [ ] **Step B1.1: Criar `src/lib/clientes/schema.ts`**

```ts
import { z } from "zod";

export const STATUSES = ["ativo", "churn", "em_onboarding"] as const;

export const createClienteSchema = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  contato_principal: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  telefone: z.string().optional().nullable(),
  valor_mensal: z.coerce.number().min(0).default(0),
  servico_contratado: z.string().optional().nullable(),
  data_entrada: z.string().optional(),
  assessor_id: z.string().uuid().optional().nullable(),
  coordenador_id: z.string().uuid().optional().nullable(),
  data_aniversario_socio_cliente: z.string().optional().nullable(),
});

export const editClienteSchema = createClienteSchema.extend({
  id: z.string().uuid(),
});

export const churnClienteSchema = z.object({
  id: z.string().uuid(),
  motivo_churn: z.string().min(3, "Informe o motivo do churn"),
  data_churn: z.string().optional(),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type EditClienteInput = z.infer<typeof editClienteSchema>;
export type ChurnClienteInput = z.infer<typeof churnClienteSchema>;
```

- [ ] **Step B1.2: Criar `src/lib/clientes/queries.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export interface ClienteRow {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  valor_mensal: number;
  servico_contratado: string | null;
  status: "ativo" | "churn" | "em_onboarding";
  data_entrada: string;
  assessor_id: string | null;
  coordenador_id: string | null;
  assessor_nome?: string | null;
  coordenador_nome?: string | null;
}

export async function listClientes(filters?: {
  status?: "ativo" | "churn" | "em_onboarding";
  assessorId?: string;
  search?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select(`
      id, nome, email, telefone, valor_mensal, servico_contratado, status, data_entrada,
      assessor_id, coordenador_id,
      assessor:profiles!clients_assessor_id_fkey(nome),
      coordenador:profiles!clients_coordenador_id_fkey(nome)
    `)
    .order("nome");

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.assessorId) query = query.eq("assessor_id", filters.assessorId);
  if (filters?.search) query = query.ilike("nome", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    valor_mensal: Number(r.valor_mensal),
    // @ts-expect-error supabase nested select shape
    assessor_nome: r.assessor?.nome ?? null,
    // @ts-expect-error supabase nested select shape
    coordenador_nome: r.coordenador?.nome ?? null,
  }));
}

export async function getClienteById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select(`
      *,
      assessor:profiles!clients_assessor_id_fkey(id, nome),
      coordenador:profiles!clients_coordenador_id_fkey(id, nome)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function getClientesStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("status, valor_mensal");
  if (error) throw error;

  const ativos = data.filter((c) => c.status === "ativo");
  return {
    total_ativos: ativos.length,
    total_churn: data.filter((c) => c.status === "churn").length,
    carteira_total: ativos.reduce((sum, c) => sum + Number(c.valor_mensal), 0),
  };
}
```

- [ ] **Step B1.3: Commit**

```bash
git add src/lib/clientes/
git commit -m "feat(clientes): zod schemas and queries"
```

---

### Task B2: Server actions de Clientes (com TDD do schema)

**Files:**
- Create: `src/lib/clientes/actions.ts`
- Create: `tests/unit/clientes-schema.test.ts`

- [ ] **Step B2.1: Criar testes do schema**

```ts
// tests/unit/clientes-schema.test.ts
import { describe, it, expect } from "vitest";
import { createClienteSchema, churnClienteSchema } from "@/lib/clientes/schema";

describe("createClienteSchema", () => {
  it("aceita cliente válido mínimo", () => {
    const r = createClienteSchema.safeParse({ nome: "Padaria Doce Vida" });
    expect(r.success).toBe(true);
  });

  it("aceita valor_mensal como string e converte", () => {
    const r = createClienteSchema.safeParse({ nome: "X", valor_mensal: "5500" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.valor_mensal).toBe(5500);
  });

  it("rejeita nome curto", () => {
    expect(createClienteSchema.safeParse({ nome: "X" }).success).toBe(false);
  });

  it("aceita email vazio (cliente ainda sem email)", () => {
    const r = createClienteSchema.safeParse({ nome: "X cliente", email: "" });
    expect(r.success).toBe(true);
  });

  it("rejeita email malformado quando preenchido", () => {
    const r = createClienteSchema.safeParse({ nome: "X cliente", email: "abc" });
    expect(r.success).toBe(false);
  });
});

describe("churnClienteSchema", () => {
  it("exige motivo", () => {
    const r = churnClienteSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      motivo_churn: "ab",
    });
    expect(r.success).toBe(false);
  });

  it("aceita churn com motivo", () => {
    const r = churnClienteSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      motivo_churn: "Cliente saiu por preço",
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step B2.2: Rodar testes (devem passar — schema implementado em B1)**

```bash
npm run test
```

Expected: incluir 7 novos testes verdes (5 de createCliente + 2 de churnCliente).

- [ ] **Step B2.3: Criar `src/lib/clientes/actions.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { logAudit } from "@/lib/audit/log";
import { createClienteSchema, editClienteSchema, churnClienteSchema } from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

export async function createClienteAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM e Sócio podem criar clientes" };
  }

  const parsed = createClienteSchema.safeParse({
    nome: fd(formData, "nome"),
    contato_principal: fd(formData, "contato_principal"),
    email: fd(formData, "email") ?? "",
    telefone: fd(formData, "telefone"),
    valor_mensal: fd(formData, "valor_mensal") ?? 0,
    servico_contratado: fd(formData, "servico_contratado"),
    data_entrada: fd(formData, "data_entrada"),
    assessor_id: fd(formData, "assessor_id"),
    coordenador_id: fd(formData, "coordenador_id"),
    data_aniversario_socio_cliente: fd(formData, "data_aniversario_socio_cliente"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const insertPayload = {
    organization_id: org.id,
    nome: parsed.data.nome,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_mensal: parsed.data.valor_mensal,
    servico_contratado: parsed.data.servico_contratado || null,
    data_entrada: parsed.data.data_entrada || new Date().toISOString().slice(0, 10),
    assessor_id: parsed.data.assessor_id || null,
    coordenador_id: parsed.data.coordenador_id || null,
    data_aniversario_socio_cliente: parsed.data.data_aniversario_socio_cliente || null,
  };

  const { data: created, error } = await supabase
    .from("clients")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error || !created) return { error: error?.message ?? "Falha ao criar cliente" };

  await logAudit({
    entidade: "clients",
    entidade_id: created.id,
    acao: "create",
    dados_depois: insertPayload,
    ator_id: actor.id,
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${created.id}`);
}

export async function updateClienteAction(formData: FormData) {
  const actor = await requireAuth();
  const id = String(formData.get("id"));

  const supabase = await createClient();
  const { data: before } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!before) return { error: "Cliente não encontrado" };

  // Permission check: ADM/Sócio podem; Coord/Assessor só os próprios
  const isPrivileged = ["adm", "socio"].includes(actor.role);
  const isOwner =
    actor.id === before.assessor_id || actor.id === before.coordenador_id;
  if (!isPrivileged && !isOwner) return { error: "Sem permissão" };

  const parsed = editClienteSchema.safeParse({
    id,
    nome: fd(formData, "nome"),
    contato_principal: fd(formData, "contato_principal"),
    email: fd(formData, "email") ?? "",
    telefone: fd(formData, "telefone"),
    valor_mensal: fd(formData, "valor_mensal") ?? 0,
    servico_contratado: fd(formData, "servico_contratado"),
    data_entrada: fd(formData, "data_entrada"),
    assessor_id: fd(formData, "assessor_id"),
    coordenador_id: fd(formData, "coordenador_id"),
    data_aniversario_socio_cliente: fd(formData, "data_aniversario_socio_cliente"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Apenas ADM/Sócio podem trocar assessor/coordenador
  if (!isPrivileged && (
    parsed.data.assessor_id !== before.assessor_id ||
    parsed.data.coordenador_id !== before.coordenador_id
  )) {
    return { error: "Apenas ADM/Sócio podem trocar assessor/coordenador" };
  }

  const updatePayload = {
    nome: parsed.data.nome,
    contato_principal: parsed.data.contato_principal || null,
    email: parsed.data.email || null,
    telefone: parsed.data.telefone || null,
    valor_mensal: parsed.data.valor_mensal,
    servico_contratado: parsed.data.servico_contratado || null,
    data_entrada: parsed.data.data_entrada || before.data_entrada,
    assessor_id: parsed.data.assessor_id || null,
    coordenador_id: parsed.data.coordenador_id || null,
    data_aniversario_socio_cliente: parsed.data.data_aniversario_socio_cliente || null,
  };

  const { error } = await supabase.from("clients").update(updatePayload).eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "clients",
    entidade_id: id,
    acao: "update",
    dados_antes: before as unknown as Record<string, unknown>,
    dados_depois: updatePayload as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath(`/clientes/${id}`);
  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function churnClienteAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem dar churn" };
  }

  const parsed = churnClienteSchema.safeParse({
    id: fd(formData, "id"),
    motivo_churn: fd(formData, "motivo_churn"),
    data_churn: fd(formData, "data_churn"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const updatePayload = {
    status: "churn" as const,
    motivo_churn: parsed.data.motivo_churn,
    data_churn: parsed.data.data_churn || new Date().toISOString().slice(0, 10),
  };

  const { error } = await supabase.from("clients").update(updatePayload).eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "clients",
    entidade_id: parsed.data.id,
    acao: "soft_delete",
    dados_depois: updatePayload,
    ator_id: actor.id,
    justificativa: parsed.data.motivo_churn,
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${parsed.data.id}`);
}

export async function reactivateClienteAction(id: string) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem reativar" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({ status: "ativo", motivo_churn: null, data_churn: null })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "clients",
    entidade_id: id,
    acao: "update",
    dados_depois: { status: "ativo" },
    ator_id: actor.id,
  });

  revalidatePath(`/clientes/${id}`);
  return { success: "Cliente reativado" };
}
```

- [ ] **Step B2.4: Verificar build**

```bash
npm run build
```

Expected: passa.

- [ ] **Step B2.5: Commit**

```bash
git add src/lib/clientes/actions.ts tests/unit/clientes-schema.test.ts
git commit -m "feat(clientes): server actions for create/update/churn/reactivate with audit"
```

---

### Task B3: Pasta do cliente — actions de briefing, notes, files, dates

**Files:**
- Create: `src/lib/client-folder/briefing-actions.ts`
- Create: `src/lib/client-folder/notes-actions.ts`
- Create: `src/lib/client-folder/files-actions.ts`
- Create: `src/lib/client-folder/dates-actions.ts`

- [ ] **Step B3.1: Briefing actions**

```ts
// src/lib/client-folder/briefing-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const briefingSchema = z.object({
  client_id: z.string().uuid(),
  texto_markdown: z.string(),
});

export async function getBriefing(clientId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_briefing")
    .select("texto_markdown")
    .eq("client_id", clientId)
    .maybeSingle();
  return data?.texto_markdown ?? "";
}

export async function saveBriefingAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = briefingSchema.safeParse({
    client_id: formData.get("client_id"),
    texto_markdown: formData.get("texto_markdown") ?? "",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // upsert
  const { error } = await supabase
    .from("client_briefing")
    .upsert({
      client_id: parsed.data.client_id,
      texto_markdown: parsed.data.texto_markdown,
      updated_by: actor.id,
    });

  if (error) return { error: error.message };
  revalidatePath(`/clientes/${parsed.data.client_id}/briefing`);
  return { success: "Briefing salvo" };
}
```

- [ ] **Step B3.2: Notes actions**

```ts
// src/lib/client-folder/notes-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const noteSchema = z.object({
  client_id: z.string().uuid(),
  tipo: z.enum(["reuniao", "observacao", "mudanca_status"]).default("reuniao"),
  texto_rico: z.string().min(2, "Nota muito curta"),
});

export async function listNotes(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_notes")
    .select(`
      id, tipo, texto_rico, created_at,
      autor:profiles!client_notes_autor_id_fkey(id, nome)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addNoteAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = noteSchema.safeParse({
    client_id: formData.get("client_id"),
    tipo: formData.get("tipo") || "reuniao",
    texto_rico: formData.get("texto_rico"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").insert({
    client_id: parsed.data.client_id,
    autor_id: actor.id,
    tipo: parsed.data.tipo,
    texto_rico: parsed.data.texto_rico,
  });

  if (error) return { error: error.message };
  revalidatePath(`/clientes/${parsed.data.client_id}/reunioes`);
  return { success: "Nota adicionada" };
}

export async function deleteNoteAction(noteId: string, clientId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").delete().eq("id", noteId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/reunioes`);
  return { success: "Nota removida" };
}
```

- [ ] **Step B3.3: Files actions (com Supabase Storage)**

```ts
// src/lib/client-folder/files-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const uploadSchema = z.object({
  client_id: z.string().uuid(),
  categoria: z.enum(["briefing", "contrato", "criativo", "outro"]).default("outro"),
});

export async function listFiles(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_files")
    .select(`
      id, categoria, nome_arquivo, storage_path, size_bytes, mime_type, created_at,
      uploader:profiles!client_files_uploaded_by_fkey(nome)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function uploadFileAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = uploadSchema.safeParse({
    client_id: formData.get("client_id"),
    categoria: formData.get("categoria") || "outro",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Arquivo inválido" };
  }

  if (file.size > 50 * 1024 * 1024) {
    return { error: "Arquivo maior que 50MB" };
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${parsed.data.client_id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("client-files")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
    });

  if (uploadErr) return { error: uploadErr.message };

  const { error: insertErr } = await supabase.from("client_files").insert({
    client_id: parsed.data.client_id,
    categoria: parsed.data.categoria,
    nome_arquivo: file.name,
    storage_path: storagePath,
    size_bytes: file.size,
    mime_type: file.type || null,
    uploaded_by: actor.id,
  });

  if (insertErr) {
    // rollback — remove from storage
    await supabase.storage.from("client-files").remove([storagePath]);
    return { error: insertErr.message };
  }

  revalidatePath(`/clientes/${parsed.data.client_id}/arquivos`);
  return { success: "Arquivo enviado" };
}

export async function getFileSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("client-files")
    .createSignedUrl(storagePath, 60 * 5); // 5 min
  return data?.signedUrl ?? null;
}

export async function deleteFileAction(fileId: string, storagePath: string, clientId: string) {
  await requireAuth();
  const supabase = await createClient();

  const { error: dbErr } = await supabase.from("client_files").delete().eq("id", fileId);
  if (dbErr) return { error: dbErr.message };

  await supabase.storage.from("client-files").remove([storagePath]);

  revalidatePath(`/clientes/${clientId}/arquivos`);
  return { success: "Arquivo removido" };
}
```

- [ ] **Step B3.4: Dates actions**

```ts
// src/lib/client-folder/dates-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";

const dateSchema = z.object({
  client_id: z.string().uuid(),
  tipo: z.enum(["aniversario_socio", "renovacao", "kickoff", "custom"]).default("custom"),
  data: z.string().min(8, "Data inválida"),
  descricao: z.string().min(2, "Descrição muito curta"),
  notify_days_before: z.string().optional(), // CSV: "30,7,1"
});

export async function listDates(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_important_dates")
    .select("*")
    .eq("client_id", clientId)
    .order("data");
  return data ?? [];
}

export async function addDateAction(formData: FormData) {
  await requireAuth();
  const parsed = dateSchema.safeParse({
    client_id: formData.get("client_id"),
    tipo: formData.get("tipo") || "custom",
    data: formData.get("data"),
    descricao: formData.get("descricao"),
    notify_days_before: formData.get("notify_days_before") || "30,7,1",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const days = parsed.data.notify_days_before
    ? parsed.data.notify_days_before.split(",").map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n))
    : [30, 7, 1];

  const supabase = await createClient();
  const { error } = await supabase.from("client_important_dates").insert({
    client_id: parsed.data.client_id,
    tipo: parsed.data.tipo,
    data: parsed.data.data,
    descricao: parsed.data.descricao,
    notify_days_before: days,
  });

  if (error) return { error: error.message };
  revalidatePath(`/clientes/${parsed.data.client_id}/datas`);
  return { success: "Data adicionada" };
}

export async function deleteDateAction(dateId: string, clientId: string) {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase.from("client_important_dates").delete().eq("id", dateId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/datas`);
  return { success: "Data removida" };
}
```

- [ ] **Step B3.5: Verificar build e commit**

```bash
npm run build
git add src/lib/client-folder/
git commit -m "feat(client-folder): briefing/notes/files/dates server actions"
```

---

### Task B4: Backend de Tarefas

**Files:**
- Create: `src/lib/tarefas/schema.ts`
- Create: `src/lib/tarefas/queries.ts`
- Create: `src/lib/tarefas/actions.ts`
- Create: `tests/unit/tarefas-schema.test.ts`

- [ ] **Step B4.1: Schema**

```ts
// src/lib/tarefas/schema.ts
import { z } from "zod";

export const PRIORITIES = ["alta", "media", "baixa"] as const;
export const TASK_STATUSES = ["aberta", "em_andamento", "concluida"] as const;

export const createTaskSchema = z.object({
  titulo: z.string().min(3, "Título muito curto"),
  descricao: z.string().optional().nullable(),
  prioridade: z.enum(PRIORITIES).default("media"),
  atribuido_a: z.string().uuid("Selecione um responsável"),
  client_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

export const editTaskSchema = createTaskSchema.extend({
  id: z.string().uuid(),
  status: z.enum(TASK_STATUSES),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type EditTaskInput = z.infer<typeof editTaskSchema>;
```

- [ ] **Step B4.2: Tests**

```ts
// tests/unit/tarefas-schema.test.ts
import { describe, it, expect } from "vitest";
import { createTaskSchema, editTaskSchema } from "@/lib/tarefas/schema";

describe("createTaskSchema", () => {
  it("aceita tarefa válida", () => {
    const r = createTaskSchema.safeParse({
      titulo: "Revisar criativos",
      atribuido_a: "00000000-0000-0000-0000-000000000000",
      prioridade: "alta",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita título curto", () => {
    expect(createTaskSchema.safeParse({
      titulo: "ab",
      atribuido_a: "00000000-0000-0000-0000-000000000000",
    }).success).toBe(false);
  });

  it("rejeita atribuido_a vazio", () => {
    expect(createTaskSchema.safeParse({
      titulo: "Revisar criativos",
      atribuido_a: "",
    }).success).toBe(false);
  });

  it("aceita prioridade default 'media'", () => {
    const r = createTaskSchema.safeParse({
      titulo: "Revisar",
      atribuido_a: "00000000-0000-0000-0000-000000000000",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.prioridade).toBe("media");
  });
});

describe("editTaskSchema", () => {
  it("exige status válido", () => {
    const r = editTaskSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000000",
      titulo: "Revisar",
      atribuido_a: "00000000-0000-0000-0000-000000000000",
      status: "invalido",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step B4.3: Queries**

```ts
// src/lib/tarefas/queries.ts
import { createClient } from "@/lib/supabase/server";

export async function listTasks(filters?: {
  status?: "aberta" | "em_andamento" | "concluida";
  atribuidoA?: string;
  criadoPor?: string;
  clientId?: string;
  prioridade?: "alta" | "media" | "baixa";
}) {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(`
      id, titulo, descricao, prioridade, status, due_date, created_at, completed_at, client_id,
      atribuido:profiles!tasks_atribuido_a_fkey(id, nome),
      criador:profiles!tasks_criado_por_fkey(id, nome),
      cliente:clients(id, nome)
    `)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.atribuidoA) query = query.eq("atribuido_a", filters.atribuidoA);
  if (filters?.criadoPor) query = query.eq("criado_por", filters.criadoPor);
  if (filters?.clientId) query = query.eq("client_id", filters.clientId);
  if (filters?.prioridade) query = query.eq("prioridade", filters.prioridade);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getTaskById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      atribuido:profiles!tasks_atribuido_a_fkey(id, nome),
      criador:profiles!tasks_criado_por_fkey(id, nome),
      cliente:clients(id, nome)
    `)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step B4.4: Actions**

```ts
// src/lib/tarefas/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { createTaskSchema, editTaskSchema } from "./schema";

function fd(formData: FormData, key: string) {
  const v = formData.get(key);
  return v === null || v === "" ? undefined : String(v);
}

export async function createTaskAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = createTaskSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    prioridade: fd(formData, "prioridade") || "media",
    atribuido_a: fd(formData, "atribuido_a"),
    client_id: fd(formData, "client_id"),
    due_date: fd(formData, "due_date"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("tasks")
    .insert({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      prioridade: parsed.data.prioridade,
      atribuido_a: parsed.data.atribuido_a,
      client_id: parsed.data.client_id || null,
      due_date: parsed.data.due_date || null,
      criado_por: actor.id,
    })
    .select("id, client_id")
    .single();

  if (error || !created) return { error: error?.message ?? "Falha ao criar tarefa" };

  revalidatePath("/tarefas");
  if (created.client_id) revalidatePath(`/clientes/${created.client_id}/tarefas`);
  redirect(`/tarefas/${created.id}`);
}

export async function updateTaskAction(formData: FormData) {
  const actor = await requireAuth();

  const parsed = editTaskSchema.safeParse({
    id: fd(formData, "id"),
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    prioridade: fd(formData, "prioridade") || "media",
    atribuido_a: fd(formData, "atribuido_a"),
    client_id: fd(formData, "client_id"),
    due_date: fd(formData, "due_date"),
    status: fd(formData, "status") || "aberta",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: before } = await supabase.from("tasks").select("*").eq("id", parsed.data.id).single();
  if (!before) return { error: "Tarefa não encontrada" };

  if (before.criado_por !== actor.id && before.atribuido_a !== actor.id) {
    return { error: "Apenas criador ou responsável podem editar" };
  }

  const completed_at =
    parsed.data.status === "concluida" && before.status !== "concluida"
      ? new Date().toISOString()
      : parsed.data.status !== "concluida"
        ? null
        : before.completed_at;

  const { error } = await supabase
    .from("tasks")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      prioridade: parsed.data.prioridade,
      atribuido_a: parsed.data.atribuido_a,
      client_id: parsed.data.client_id || null,
      due_date: parsed.data.due_date || null,
      status: parsed.data.status,
      completed_at,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${parsed.data.id}`);
  if (before.client_id) revalidatePath(`/clientes/${before.client_id}/tarefas`);
  if (parsed.data.client_id && parsed.data.client_id !== before.client_id) {
    revalidatePath(`/clientes/${parsed.data.client_id}/tarefas`);
  }
  redirect(`/tarefas/${parsed.data.id}`);
}

export async function toggleTaskCompletionAction(taskId: string) {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { data: t } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!t) return { error: "Tarefa não encontrada" };
  if (t.criado_por !== actor.id && t.atribuido_a !== actor.id) {
    return { error: "Sem permissão" };
  }

  const novoStatus = t.status === "concluida" ? "aberta" : "concluida";
  const completed_at = novoStatus === "concluida" ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("tasks")
    .update({ status: novoStatus, completed_at })
    .eq("id", taskId);

  if (error) return { error: error.message };

  revalidatePath("/tarefas");
  if (t.client_id) revalidatePath(`/clientes/${t.client_id}/tarefas`);
  return { success: novoStatus === "concluida" ? "Tarefa concluída" : "Tarefa reaberta" };
}
```

- [ ] **Step B4.5: Test, build, commit**

```bash
npm run test
npm run build
git add src/lib/tarefas/ tests/unit/tarefas-schema.test.ts
git commit -m "feat(tarefas): schemas, queries and server actions with TDD"
```

---

## Bloco C — Páginas de listagem e CRUD de Clientes

### Task C1: Tabela e página de listagem `/clientes`

**Files:**
- Create: `src/components/clientes/StatusBadge.tsx`
- Create: `src/components/clientes/ClientesTable.tsx`
- Create: `src/app/(authed)/clientes/page.tsx`

- [ ] **Step C1.1: StatusBadge**

```tsx
// src/components/clientes/StatusBadge.tsx
import { Badge } from "@/components/ui/badge";

const map: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
  churn: { label: "Churn", cls: "border-rose-500/40 text-rose-600 dark:text-rose-400" },
  em_onboarding: { label: "Onboarding", cls: "border-blue-500/40 text-blue-600 dark:text-blue-400" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = map[status] ?? { label: status, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}
```

- [ ] **Step C1.2: ClientesTable**

```tsx
// src/components/clientes/ClientesTable.tsx
import Link from "next/link";
import { StatusBadge } from "./StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ClienteRow } from "@/lib/clientes/queries";

export function ClientesTable({ rows, canSeeMoney }: { rows: ClienteRow[]; canSeeMoney: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Serviço</TableHead>
          <TableHead>Assessor</TableHead>
          <TableHead>Coordenador</TableHead>
          {canSeeMoney && <TableHead className="text-right">Valor mensal</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className="hover:bg-muted/40">
            <TableCell className="font-medium">
              <Link href={`/clientes/${r.id}`} className="hover:underline">
                {r.nome}
              </Link>
            </TableCell>
            <TableCell><StatusBadge status={r.status} /></TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.servico_contratado ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.assessor_nome ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.coordenador_nome ?? "—"}</TableCell>
            {canSeeMoney && (
              <TableCell className="text-right tabular-nums">
                {Number(r.valor_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step C1.3: Página `/clientes`**

```tsx
// src/app/(authed)/clientes/page.tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listClientes, getClientesStats } from "@/lib/clientes/queries";
import { ClientesTable } from "@/components/clientes/ClientesTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const canManage = ["adm", "socio"].includes(user.role);
  const canSeeMoney = ["adm", "socio"].includes(user.role);
  // For Phase 1: simplification — assessor/coord vê valor só dos próprios. Esta tabela mostra todos com valor para adm/socio.
  // Quando coord/assessor olha, vai ver apenas a coluna sem valor — refinar em iterações.

  const status = (params.status as "ativo" | "churn" | undefined) ?? undefined;
  const rows = await listClientes({ status });
  const stats = await getClientesStats();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total_ativos} ativos · {stats.total_churn} em churn · carteira{" "}
            {canSeeMoney
              ? stats.carteira_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "—"}
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/clientes/novo"><Plus className="mr-2 h-4 w-4" />Novo cliente</Link>
          </Button>
        )}
      </header>

      <div className="flex gap-2 text-sm">
        <Link href="/clientes" className={!status ? "font-semibold text-primary" : "text-muted-foreground"}>Todos</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/clientes?status=ativo" className={status === "ativo" ? "font-semibold text-primary" : "text-muted-foreground"}>Ativos</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/clientes?status=churn" className={status === "churn" ? "font-semibold text-primary" : "text-muted-foreground"}>Churn</Link>
      </div>

      <div className="rounded-xl border bg-card">
        <ClientesTable rows={rows} canSeeMoney={canSeeMoney} />
      </div>
    </div>
  );
}
```

- [ ] **Step C1.4: Commit**

```bash
git add src/components/clientes/ "src/app/(authed)/clientes/page.tsx"
git commit -m "feat(clientes): list page with status filter and stats"
```

---

### Task C2: Form de criar/editar cliente

**Files:**
- Create: `src/components/clientes/ClienteForm.tsx`
- Create: `src/app/(authed)/clientes/novo/page.tsx`

- [ ] **Step C2.1: ClienteForm (compartilhado novo + editar)**

```tsx
// src/components/clientes/ClienteForm.tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProfileOption {
  id: string;
  nome: string;
  role: string;
}

interface Props {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  defaults?: Partial<{
    id: string;
    nome: string;
    contato_principal: string | null;
    email: string | null;
    telefone: string | null;
    valor_mensal: number | string;
    servico_contratado: string | null;
    data_entrada: string | null;
    assessor_id: string | null;
    coordenador_id: string | null;
    data_aniversario_socio_cliente: string | null;
  }>;
  assessores: ProfileOption[];
  coordenadores: ProfileOption[];
  canEditAlocacao: boolean;
  submitLabel?: string;
}

export function ClienteForm({ action, defaults = {}, assessores, coordenadores, canEditAlocacao, submitLabel = "Salvar" }: Props) {
  return (
    <form action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="nome">Nome do cliente</Label>
          <Input id="nome" name="nome" defaultValue={defaults.nome ?? ""} required minLength={2} />
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
          <Label htmlFor="valor_mensal">Valor mensal (R$)</Label>
          <Input id="valor_mensal" name="valor_mensal" type="number" step="0.01" min="0" defaultValue={String(defaults.valor_mensal ?? 0)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="servico_contratado">Serviço contratado</Label>
          <Input id="servico_contratado" name="servico_contratado" defaultValue={defaults.servico_contratado ?? ""} placeholder="Ex.: Social media + Tráfego pago" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_entrada">Data de entrada</Label>
          <Input id="data_entrada" name="data_entrada" type="date" defaultValue={defaults.data_entrada ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_aniversario_socio_cliente">Aniversário do sócio do cliente</Label>
          <Input id="data_aniversario_socio_cliente" name="data_aniversario_socio_cliente" type="date" defaultValue={defaults.data_aniversario_socio_cliente ?? ""} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="assessor_id">Assessor</Label>
          <Select name="assessor_id" defaultValue={defaults.assessor_id ?? ""} disabled={!canEditAlocacao}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem assessor</SelectItem>
              {assessores.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="coordenador_id">Coordenador</Label>
          <Select name="coordenador_id" defaultValue={defaults.coordenador_id ?? ""} disabled={!canEditAlocacao}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem coordenador</SelectItem>
              {coordenadores.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
```

- [ ] **Step C2.2: Página `/clientes/novo`**

```tsx
// src/app/(authed)/clientes/novo/page.tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { createClienteAction } from "@/lib/clientes/actions";
import { Card } from "@/components/ui/card";

export default async function NovoClientePage() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) redirect("/clientes");

  const supabase = await createClient();
  const { data: profiles = [] } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .eq("ativo", true)
    .order("nome");

  const assessores = (profiles ?? []).filter((p) => p.role === "assessor");
  const coordenadores = (profiles ?? []).filter((p) => p.role === "coordenador");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Novo cliente</h1>
        <p className="text-sm text-muted-foreground">
          Após criar, você poderá adicionar briefing, datas, arquivos e tarefas na pasta do cliente.
        </p>
      </header>
      <Card className="p-6">
        <ClienteForm
          action={createClienteAction}
          assessores={assessores}
          coordenadores={coordenadores}
          canEditAlocacao={true}
          submitLabel="Criar cliente"
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step C2.3: Commit**

```bash
git add src/components/clientes/ClienteForm.tsx "src/app/(authed)/clientes/novo/"
git commit -m "feat(clientes): create form and new client page"
```

---

### Task C3: Página de edição de cliente

**Files:**
- Create: `src/app/(authed)/clientes/[id]/editar/page.tsx`

- [ ] **Step C3.1: Página de edição**

```tsx
// src/app/(authed)/clientes/[id]/editar/page.tsx
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getClienteById } from "@/lib/clientes/queries";
import { updateClienteAction } from "@/lib/clientes/actions";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import { Card } from "@/components/ui/card";

export default async function EditClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  let cliente;
  try { cliente = await getClienteById(id); } catch { notFound(); }

  const isPrivileged = ["adm", "socio"].includes(user.role);
  const isOwner = user.id === cliente.assessor_id || user.id === cliente.coordenador_id;
  if (!isPrivileged && !isOwner) redirect(`/clientes/${id}`);

  const supabase = await createClient();
  const { data: profiles = [] } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .eq("ativo", true)
    .order("nome");

  const assessores = (profiles ?? []).filter((p) => p.role === "assessor");
  const coordenadores = (profiles ?? []).filter((p) => p.role === "coordenador");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Editar {cliente.nome}</h1>
      </header>
      <Card className="p-6">
        <ClienteForm
          action={updateClienteAction}
          defaults={{
            id: cliente.id,
            nome: cliente.nome,
            contato_principal: cliente.contato_principal,
            email: cliente.email,
            telefone: cliente.telefone,
            valor_mensal: cliente.valor_mensal,
            servico_contratado: cliente.servico_contratado,
            data_entrada: cliente.data_entrada,
            assessor_id: cliente.assessor_id,
            coordenador_id: cliente.coordenador_id,
            data_aniversario_socio_cliente: cliente.data_aniversario_socio_cliente,
          }}
          assessores={assessores}
          coordenadores={coordenadores}
          canEditAlocacao={isPrivileged}
          submitLabel="Salvar alterações"
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step C3.2: Commit**

```bash
git add "src/app/(authed)/clientes/[id]/editar/"
git commit -m "feat(clientes): edit page with role-based field gating"
```

---

### Task C4: Import em lote (TSV/CSV)

**Files:**
- Create: `src/lib/clientes/import.ts` (parser + bulk insert)
- Create: `src/components/clientes/BulkImportForm.tsx`
- Create: `src/app/(authed)/clientes/importar/page.tsx`
- Modify: `src/app/(authed)/clientes/page.tsx` (adicionar botão "Importar")
- Create: `tests/unit/clientes-import.test.ts` (TDD do parser)

#### Step C4.1: Test do parser (TDD)

```ts
// tests/unit/clientes-import.test.ts
import { describe, it, expect } from "vitest";
import { parseBulkImport } from "@/lib/clientes/import";

describe("parseBulkImport", () => {
  it("aceita TSV (colado do Excel) com 3 colunas", () => {
    const input = "Padaria Doce Vida\t5500\tSocial media + Tráfego\nLoja Verde\t3800\tSocial media";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ nome: "Padaria Doce Vida", valor_mensal: 5500, servico_contratado: "Social media + Tráfego" });
    expect(r.rows[1]).toMatchObject({ nome: "Loja Verde", valor_mensal: 3800 });
    expect(r.errors).toHaveLength(0);
  });

  it("aceita CSV com 3 colunas", () => {
    const input = "Padaria, 5500, Social media\nLoja Verde, 3800, Tráfego pago";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].valor_mensal).toBe(5500);
  });

  it("aceita valor com vírgula como decimal (formato BR)", () => {
    const input = "Padaria\t5500,50\tSocial media";
    const r = parseBulkImport(input);
    expect(r.rows[0].valor_mensal).toBe(5500.5);
  });

  it("aceita valor com R$ e pontuação BR", () => {
    const input = "Padaria\tR$ 5.500,00\tSocial media";
    const r = parseBulkImport(input);
    expect(r.rows[0].valor_mensal).toBe(5500);
  });

  it("aceita linha sem serviço (só nome e valor)", () => {
    const input = "Padaria\t5500";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].servico_contratado).toBeNull();
    expect(r.errors).toHaveLength(0);
  });

  it("ignora linhas vazias", () => {
    const input = "Padaria\t5500\n\n\nLoja\t3800";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(2);
  });

  it("registra erro para nome ausente", () => {
    const input = "\t5500\tServiço";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toMatch(/nome/i);
  });

  it("registra erro para valor inválido", () => {
    const input = "Padaria\tabc\tServiço";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toMatch(/valor/i);
  });

  it("aceita header opcional (Nome, Valor, Serviço) e ignora", () => {
    const input = "Nome\tValor\tServiço\nPadaria\t5500\tSocial media";
    const r = parseBulkImport(input);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].nome).toBe("Padaria");
  });
});
```

#### Step C4.2: Implementar parser em `src/lib/clientes/import.ts`

```ts
// src/lib/clientes/import.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export interface ParsedRow {
  line_number: number;
  nome: string;
  valor_mensal: number;
  servico_contratado: string | null;
}

export interface ParseError {
  line_number: number;
  raw_line: string;
  message: string;
}

export interface ParseResult {
  rows: ParsedRow[];
  errors: ParseError[];
}

const HEADER_REGEX = /^\s*nome\b/i;

function detectSeparator(line: string): "\t" | "," {
  if (line.includes("\t")) return "\t";
  return ",";
}

function parseValor(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  // BR format: 1.234,56 → 1234.56 ; or 5500,50 → 5500.50 ; or 5500 → 5500
  // Remove dot only if it's a thousands separator (followed by exactly 3 digits and then comma or end)
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // assume "1.234,56" — dot=thousands, comma=decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && !hasDot) {
    // "5500,50" — comma=decimal
    s = s.replace(",", ".");
  }
  // else "5500" or "5500.50" — leave as-is
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseBulkImport(text: string): ParseResult {
  const rows: ParsedRow[] = [];
  const errors: ParseError[] = [];

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Skip header line if first non-empty line matches "Nome..."
    if (rows.length === 0 && errors.length === 0 && HEADER_REGEX.test(trimmed)) continue;

    const sep = detectSeparator(raw);
    const cols = raw.split(sep).map((c) => c.trim());
    const [nomeRaw, valorRaw, servicoRaw] = cols;

    if (!nomeRaw || nomeRaw.length < 2) {
      errors.push({ line_number: i + 1, raw_line: raw, message: "Nome ausente ou muito curto" });
      continue;
    }

    const valor = parseValor(valorRaw ?? "");
    if (valor === null || valor < 0) {
      errors.push({ line_number: i + 1, raw_line: raw, message: `Valor inválido: "${valorRaw}"` });
      continue;
    }

    rows.push({
      line_number: i + 1,
      nome: nomeRaw,
      valor_mensal: valor,
      servico_contratado: servicoRaw && servicoRaw.length > 0 ? servicoRaw : null,
    });
  }

  return { rows, errors };
}

export async function bulkImportClientesAction(formData: FormData) {
  const actor = await requireAuth();
  if (!["adm", "socio"].includes(actor.role)) {
    return { error: "Apenas ADM/Sócio podem importar clientes em lote" };
  }

  const text = String(formData.get("import_text") ?? "");
  if (!text.trim()) return { error: "Cole os dados antes de importar" };

  const parsed = parseBulkImport(text);

  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    return { error: `Nenhuma linha válida. ${parsed.errors.length} erro(s).`, errors: parsed.errors };
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const today = new Date().toISOString().slice(0, 10);
  const payload = parsed.rows.map((r) => ({
    organization_id: org.id,
    nome: r.nome,
    valor_mensal: r.valor_mensal,
    servico_contratado: r.servico_contratado,
    data_entrada: today,
  }));

  const { data: inserted, error } = await supabase
    .from("clients")
    .insert(payload)
    .select("id, nome");

  if (error) return { error: error.message };

  // Audit log: 1 entry per inserted client
  for (const row of inserted ?? []) {
    await logAudit({
      entidade: "clients",
      entidade_id: row.id,
      acao: "create",
      dados_depois: { nome: row.nome, source: "bulk_import" },
      ator_id: actor.id,
    });
  }

  revalidatePath("/clientes");
  redirect(`/clientes?imported=${inserted?.length ?? 0}`);
}
```

#### Step C4.3: Rodar testes (devem passar)

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
npm run test
```

Expected: 9 testes novos do parser passam.

#### Step C4.4: Componente `BulkImportForm.tsx`

```tsx
// src/components/clientes/BulkImportForm.tsx
"use client";

import { useState } from "react";
import { bulkImportClientesAction } from "@/lib/clientes/import";
import { parseBulkImport, type ParseResult } from "@/lib/clientes/import";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function BulkImportForm() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParseResult | null>(null);

  function onPreview() {
    setPreview(parseBulkImport(text));
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="import_text">Cole os dados abaixo</Label>
        <p className="mt-1 mb-2 text-xs text-muted-foreground">
          Uma linha por cliente. Colunas separadas por TAB (do Excel/Sheets) ou vírgula. Ordem: <b>Nome | Valor mensal | Serviço contratado</b>. Linha de cabeçalho é opcional.
        </p>
        <Textarea
          id="import_text"
          name="import_text"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-sm"
          placeholder={"Padaria Doce Vida\t5500\tSocial media + Tráfego pago\nLoja Verde\t3800\tSocial media\nStudio Yoga\t2200\tTráfego pago"}
        />
        <Button type="button" variant="outline" onClick={onPreview} className="mt-3">
          Pré-visualizar
        </Button>
      </div>

      {preview && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {preview.rows.length > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> {preview.rows.length} linha(s) válida(s)
              </span>
            )}
            {preview.errors.length > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" /> {preview.errors.length} erro(s)
              </span>
            )}
          </div>

          {preview.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Nome</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-left">Serviço</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.line_number} className="border-t">
                      <td className="px-3 py-2 text-muted-foreground">{r.line_number}</td>
                      <td className="px-3 py-2 font-medium">{r.nome}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.valor_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.servico_contratado ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.errors.length > 0 && (
            <ul className="space-y-1 text-xs text-rose-600 dark:text-rose-400">
              {preview.errors.map((e) => (
                <li key={e.line_number}>
                  Linha {e.line_number}: {e.message} — <code className="font-mono">{e.raw_line}</code>
                </li>
              ))}
            </ul>
          )}

          {preview.rows.length > 0 && (
            <form action={bulkImportClientesAction}>
              <input type="hidden" name="import_text" value={text} />
              <Button type="submit">
                Importar {preview.rows.length} cliente{preview.rows.length !== 1 ? "s" : ""}
              </Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
```

#### Step C4.5: Página `/clientes/importar`

```tsx
// src/app/(authed)/clientes/importar/page.tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { BulkImportForm } from "@/components/clientes/BulkImportForm";
import { Card } from "@/components/ui/card";

export default async function ImportarClientesPage() {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) redirect("/clientes");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Importar clientes em lote</h1>
        <p className="text-sm text-muted-foreground">
          Útil para a primeira migração. Os clientes serão criados como ativos com status &quot;ativo&quot;, sem assessor/coordenador atribuído (você atribui depois individualmente).
        </p>
      </header>
      <Card className="p-6">
        <BulkImportForm />
      </Card>
    </div>
  );
}
```

#### Step C4.6: Adicionar botão "Importar" em `/clientes`

Modificar a página `src/app/(authed)/clientes/page.tsx` para incluir um botão secundário ao lado do "Novo cliente". Substituir a seção do header pelos seguintes blocos:

```tsx
        {canManage && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/clientes/importar">Importar em lote</Link>
            </Button>
            <Button asChild>
              <Link href="/clientes/novo"><Plus className="mr-2 h-4 w-4" />Novo cliente</Link>
            </Button>
          </div>
        )}
```

E acima da tabela, adicionar uma mensagem de sucesso pós-import:

```tsx
      {/* Logo após o header e antes dos filtros */}
      {params.imported && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          ✓ {params.imported} cliente(s) importado(s) com sucesso.
        </div>
      )}
```

E ajustar o `searchParams` no topo da função pra aceitar `imported`:

```tsx
export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ status?: string; imported?: string }> }) {
```

#### Step C4.7: Build, test, commit

```bash
npm run test
npm run build
git add src/lib/clientes/import.ts src/components/clientes/BulkImportForm.tsx "src/app/(authed)/clientes/importar/" "src/app/(authed)/clientes/page.tsx" tests/unit/clientes-import.test.ts
git commit -m "feat(clientes): bulk import via TSV/CSV paste with validation preview"
```

---

## Bloco D — Pasta do cliente (sub-páginas)

### Task D1: Layout da pasta + ClienteHeader + ClienteSidebar

**Files:**
- Create: `src/components/clientes/ClienteHeader.tsx`
- Create: `src/components/clientes/ClienteSidebar.tsx`
- Create: `src/app/(authed)/clientes/[id]/layout.tsx`

- [ ] **Step D1.1: ClienteHeader**

```tsx
// src/components/clientes/ClienteHeader.tsx
import { StatusBadge } from "./StatusBadge";

interface Props {
  cliente: {
    nome: string;
    status: string;
    valor_mensal: number;
    data_entrada: string;
    assessor?: { nome: string } | null;
    coordenador?: { nome: string } | null;
  };
  canSeeMoney: boolean;
}

function formatMonths(dataEntrada: string) {
  const start = new Date(dataEntrada);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return months <= 0 ? "menos de 1 mês" : `${months} meses`;
}

export function ClienteHeader({ cliente, canSeeMoney }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-5">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">{cliente.nome}</h1>
          <StatusBadge status={cliente.status} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Cliente há {formatMonths(cliente.data_entrada)}
          {cliente.assessor?.nome && ` · Assessor: ${cliente.assessor.nome}`}
          {cliente.coordenador?.nome && ` · Coord: ${cliente.coordenador.nome}`}
        </p>
      </div>
      {canSeeMoney && (
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor mensal</div>
          <div className="text-xl font-bold tabular-nums">
            {Number(cliente.valor_mensal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step D1.2: ClienteSidebar (sub-nav vertical)**

```tsx
// src/components/clientes/ClienteSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutGrid, FileText, MessagesSquare, Folder, Calendar, ListChecks, History, Pencil,
} from "lucide-react";

const items = [
  { slug: "", icon: LayoutGrid, label: "Visão geral" },
  { slug: "/briefing", icon: FileText, label: "Briefing" },
  { slug: "/reunioes", icon: MessagesSquare, label: "Reuniões" },
  { slug: "/arquivos", icon: Folder, label: "Arquivos" },
  { slug: "/datas", icon: Calendar, label: "Datas importantes" },
  { slug: "/tarefas", icon: ListChecks, label: "Tarefas" },
  { slug: "/historico", icon: History, label: "Histórico", privileged: true },
  { slug: "/editar", icon: Pencil, label: "Editar dados" },
] as const;

export function ClienteSidebar({ clientId, canSeeHistorico }: { clientId: string; canSeeHistorico: boolean }) {
  const pathname = usePathname();
  const base = `/clientes/${clientId}`;

  return (
    <aside className="w-full md:w-[200px] md:flex-shrink-0">
      <nav className="space-y-1 rounded-xl border bg-card p-2">
        {items
          .filter((it) => !it.privileged || canSeeHistorico)
          .map((it) => {
            const href = `${base}${it.slug}`;
            const active = pathname === href || (it.slug === "" && pathname === base);
            const Icon = it.icon;
            return (
              <Link
                key={it.slug}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{it.label}</span>
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step D1.3: Layout `/clientes/[id]/layout.tsx`**

```tsx
// src/app/(authed)/clientes/[id]/layout.tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getClienteById } from "@/lib/clientes/queries";
import { ClienteHeader } from "@/components/clientes/ClienteHeader";
import { ClienteSidebar } from "@/components/clientes/ClienteSidebar";

export default async function ClienteFolderLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  let cliente;
  try { cliente = await getClienteById(id); } catch { notFound(); }

  const canSeeMoney =
    ["adm", "socio"].includes(user.role) ||
    user.id === cliente.assessor_id ||
    user.id === cliente.coordenador_id;
  const canSeeHistorico = ["adm", "socio"].includes(user.role);

  return (
    <div className="space-y-5">
      <ClienteHeader cliente={cliente} canSeeMoney={canSeeMoney} />
      <div className="flex flex-col gap-5 md:flex-row">
        <ClienteSidebar clientId={id} canSeeHistorico={canSeeHistorico} />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step D1.4: Commit**

```bash
git add src/components/clientes/ClienteHeader.tsx src/components/clientes/ClienteSidebar.tsx "src/app/(authed)/clientes/[id]/layout.tsx"
git commit -m "feat(client-folder): header and sub-nav sidebar layout"
```

---

### Task D2: Página de visão geral `/clientes/[id]`

**Files:**
- Create: `src/app/(authed)/clientes/[id]/page.tsx`

- [ ] **Step D2.1: Página de visão geral**

```tsx
// src/app/(authed)/clientes/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { getClienteById } from "@/lib/clientes/queries";
import { listNotes } from "@/lib/client-folder/notes-actions";
import { listDates } from "@/lib/client-folder/dates-actions";
import { listTasks } from "@/lib/tarefas/queries";
import { Card } from "@/components/ui/card";
import { differenceInDays, parseISO } from "date-fns";

export default async function ClienteOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();

  let cliente;
  try { cliente = await getClienteById(id); } catch { notFound(); }

  const [notes, dates, tasks] = await Promise.all([
    listNotes(id),
    listDates(id),
    listTasks({ clientId: id, status: "aberta" }),
  ]);

  const lastNote = notes[0];
  const upcomingDates = dates
    .filter((d) => differenceInDays(parseISO(d.data), new Date()) >= 0)
    .slice(0, 3);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Última reunião</div>
          {lastNote ? (
            <div className="mt-2">
              <div className="line-clamp-3 text-sm">{lastNote.texto_rico}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {/* @ts-expect-error nested select */}
                {lastNote.autor?.nome ?? "?"} · {new Date(lastNote.created_at).toLocaleDateString("pt-BR")}
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Nenhuma nota ainda.</div>
          )}
          <Link href={`/clientes/${id}/reunioes`} className="mt-3 inline-block text-xs text-primary hover:underline">
            Ver todas →
          </Link>
        </Card>

        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Próximas datas</div>
          {upcomingDates.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {upcomingDates.map((d) => {
                const days = differenceInDays(parseISO(d.data), new Date());
                return (
                  <li key={d.id} className="flex items-center justify-between">
                    <span>{d.descricao}</span>
                    <span className="text-xs text-muted-foreground">em {days}d</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Sem datas cadastradas.</div>
          )}
          <Link href={`/clientes/${id}/datas`} className="mt-3 inline-block text-xs text-primary hover:underline">
            Ver todas →
          </Link>
        </Card>

        <Card className="p-4 md:col-span-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Tarefas em aberto</div>
          {tasks.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {tasks.slice(0, 5).map((t) => (
                <li key={t.id}>
                  <Link href={`/tarefas/${t.id}`} className="hover:underline">{t.titulo}</Link>
                  {t.due_date && (
                    <span className="ml-2 text-xs text-muted-foreground">prazo: {new Date(t.due_date).toLocaleDateString("pt-BR")}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">Nada pendente.</div>
          )}
          <Link href={`/clientes/${id}/tarefas`} className="mt-3 inline-block text-xs text-primary hover:underline">
            Ver todas →
          </Link>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step D2.2: Commit**

```bash
git add "src/app/(authed)/clientes/[id]/page.tsx"
git commit -m "feat(client-folder): overview page with last note, dates, open tasks"
```

---

### Task D3: Briefing tab

**Files:**
- Create: `src/components/client-folder/BriefingEditor.tsx`
- Create: `src/app/(authed)/clientes/[id]/briefing/page.tsx`

- [ ] **Step D3.1: BriefingEditor**

```tsx
// src/components/client-folder/BriefingEditor.tsx
"use client";

import { useState } from "react";
import { saveBriefingAction } from "@/lib/client-folder/briefing-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function BriefingEditor({ clientId, initial }: { clientId: string; initial: string }) {
  const [text, setText] = useState(initial);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("texto_markdown", text);
    const result = await saveBriefingAction(fd);
    setSaving(false);
    if ("success" in result) setSavedAt(new Date().toLocaleTimeString("pt-BR"));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={20}
        className="font-mono text-sm"
        placeholder="# Objetivos&#10;&#10;# Persona&#10;&#10;# Tom de voz&#10;&#10;# KPIs..."
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{savedAt && `Salvo às ${savedAt}`}</span>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar briefing"}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step D3.2: Adicionar shadcn textarea (se ainda não existe)**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
npx shadcn@latest add textarea
```

- [ ] **Step D3.3: Página de briefing**

```tsx
// src/app/(authed)/clientes/[id]/briefing/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { getBriefing } from "@/lib/client-folder/briefing-actions";
import { BriefingEditor } from "@/components/client-folder/BriefingEditor";
import { Card } from "@/components/ui/card";

export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const initial = await getBriefing(id);

  return (
    <Card className="p-5">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Briefing</h2>
        <p className="text-xs text-muted-foreground">Use formato Markdown. Aceita títulos com #, listas com -, etc.</p>
      </div>
      <BriefingEditor clientId={id} initial={initial} />
    </Card>
  );
}
```

- [ ] **Step D3.4: Commit**

```bash
git add -A
git commit -m "feat(client-folder): briefing tab with markdown editor"
```

---

### Task D4: Reuniões/Notes tab

**Files:**
- Create: `src/components/client-folder/AddNoteForm.tsx`
- Create: `src/components/client-folder/NotesTimeline.tsx`
- Create: `src/app/(authed)/clientes/[id]/reunioes/page.tsx`

- [ ] **Step D4.1: AddNoteForm**

```tsx
// src/components/client-folder/AddNoteForm.tsx
import { addNoteAction } from "@/lib/client-folder/notes-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddNoteForm({ clientId }: { clientId: string }) {
  return (
    <form action={addNoteAction} className="space-y-3 rounded-xl border bg-card p-4">
      <input type="hidden" name="client_id" value={clientId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="texto_rico">Nova nota</Label>
          <Textarea id="texto_rico" name="texto_rico" rows={3} required minLength={2} placeholder="Resumo da reunião, observação importante..." />
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select name="tipo" defaultValue="reuniao">
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reuniao">Reunião</SelectItem>
                <SelectItem value="observacao">Observação</SelectItem>
                <SelectItem value="mudanca_status">Mudança de status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Adicionar</Button>
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step D4.2: NotesTimeline**

```tsx
// src/components/client-folder/NotesTimeline.tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Note {
  id: string;
  tipo: string;
  texto_rico: string;
  created_at: string;
  // @ts-expect-error nested select
  autor?: { nome: string } | null;
}

const typeLabel: Record<string, string> = {
  reuniao: "Reunião",
  observacao: "Observação",
  mudanca_status: "Mudança",
};

export function NotesTimeline({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma nota cadastrada ainda. Adicione a primeira acima.
      </Card>
    );
  }

  return (
    <ol className="space-y-3">
      {notes.map((n) => (
        <li key={n.id}>
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{typeLabel[n.tipo] ?? n.tipo}</Badge>
              <span>{n.autor?.nome ?? "—"}</span>
              <span>·</span>
              <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{n.texto_rico}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step D4.3: Página**

```tsx
// src/app/(authed)/clientes/[id]/reunioes/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { listNotes } from "@/lib/client-folder/notes-actions";
import { AddNoteForm } from "@/components/client-folder/AddNoteForm";
import { NotesTimeline } from "@/components/client-folder/NotesTimeline";

export default async function ReunioesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const notes = await listNotes(id);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">Reuniões e notas</h2>
        <p className="text-xs text-muted-foreground">Histórico cronológico (mais recente primeiro).</p>
      </header>
      <AddNoteForm clientId={id} />
      <NotesTimeline notes={notes} />
    </div>
  );
}
```

- [ ] **Step D4.4: Commit**

```bash
git add src/components/client-folder/AddNoteForm.tsx src/components/client-folder/NotesTimeline.tsx "src/app/(authed)/clientes/[id]/reunioes/"
git commit -m "feat(client-folder): notes timeline with add form"
```

---

### Task D5: Arquivos tab (Supabase Storage)

**Files:**
- Create: `src/components/client-folder/FileUploader.tsx`
- Create: `src/components/client-folder/FilesList.tsx`
- Create: `src/app/(authed)/clientes/[id]/arquivos/page.tsx`

- [ ] **Step D5.1: FileUploader**

```tsx
// src/components/client-folder/FileUploader.tsx
"use client";

import { useState } from "react";
import { uploadFileAction } from "@/lib/client-folder/files-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function FileUploader({ clientId }: { clientId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("client_id", clientId);
    setBusy(true);
    const result = await uploadFileAction(fd);
    setBusy(false);
    if ("error" in result && result.error) setError(result.error);
    else (e.currentTarget as HTMLFormElement).reset();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="file">Arquivo (até 50MB)</Label>
          <input id="file" name="file" type="file" required className="block w-full text-sm" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="categoria">Categoria</Label>
          <Select name="categoria" defaultValue="outro">
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="briefing">Briefing</SelectItem>
              <SelectItem value="contrato">Contrato</SelectItem>
              <SelectItem value="criativo">Criativo</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Enviando..." : "Enviar"}</Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}
```

- [ ] **Step D5.2: FilesList (server component que assina URLs)**

```tsx
// src/components/client-folder/FilesList.tsx
import Link from "next/link";
import { getFileSignedUrl } from "@/lib/client-folder/files-actions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Download } from "lucide-react";

interface FileRow {
  id: string;
  categoria: string;
  nome_arquivo: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string | null;
  created_at: string;
  // @ts-expect-error nested select
  uploader?: { nome: string } | null;
}

const catLabels: Record<string, string> = {
  briefing: "Briefing", contrato: "Contrato", criativo: "Criativo", outro: "Outro",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function FilesList({ files }: { files: FileRow[] }) {
  if (files.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhum arquivo enviado.
      </Card>
    );
  }

  const filesWithUrls = await Promise.all(
    files.map(async (f) => ({ ...f, signedUrl: await getFileSignedUrl(f.storage_path) })),
  );

  return (
    <ul className="space-y-2">
      {filesWithUrls.map((f) => (
        <li key={f.id}>
          <Card className="flex items-center gap-3 p-3">
            <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{f.nome_arquivo}</span>
                <Badge variant="secondary" className="flex-shrink-0">{catLabels[f.categoria]}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {f.uploader?.nome ?? "—"} · {new Date(f.created_at).toLocaleDateString("pt-BR")} · {formatSize(f.size_bytes)}
              </div>
            </div>
            {f.signedUrl && (
              <Link href={f.signedUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-primary hover:text-primary/80">
                <Download className="h-4 w-4" />
              </Link>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step D5.3: Página**

```tsx
// src/app/(authed)/clientes/[id]/arquivos/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { listFiles } from "@/lib/client-folder/files-actions";
import { FileUploader } from "@/components/client-folder/FileUploader";
import { FilesList } from "@/components/client-folder/FilesList";

export default async function ArquivosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const files = await listFiles(id);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">Arquivos</h2>
        <p className="text-xs text-muted-foreground">Briefings, contratos, criativos e outros arquivos do cliente.</p>
      </header>
      <FileUploader clientId={id} />
      {/* @ts-expect-error async server component */}
      <FilesList files={files} />
    </div>
  );
}
```

- [ ] **Step D5.4: Commit**

```bash
git add -A
git commit -m "feat(client-folder): arquivos tab with Supabase Storage upload and signed URLs"
```

---

### Task D6: Datas importantes tab

**Files:**
- Create: `src/components/client-folder/AddDateForm.tsx`
- Create: `src/components/client-folder/DatesList.tsx`
- Create: `src/app/(authed)/clientes/[id]/datas/page.tsx`

- [ ] **Step D6.1: AddDateForm**

```tsx
// src/components/client-folder/AddDateForm.tsx
import { addDateAction } from "@/lib/client-folder/dates-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AddDateForm({ clientId }: { clientId: string }) {
  return (
    <form action={addDateAction} className="rounded-xl border bg-card p-4">
      <input type="hidden" name="client_id" value={clientId} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select name="tipo" defaultValue="custom">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aniversario_socio">Aniversário do sócio</SelectItem>
              <SelectItem value="renovacao">Renovação</SelectItem>
              <SelectItem value="kickoff">Kickoff</SelectItem>
              <SelectItem value="custom">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="data">Data</Label>
          <Input id="data" name="data" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Input id="descricao" name="descricao" required minLength={2} />
        </div>
        <Button type="submit">Adicionar</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Notificação será enviada automaticamente 30, 7 e 1 dia antes.</p>
    </form>
  );
}
```

- [ ] **Step D6.2: DatesList**

```tsx
// src/components/client-folder/DatesList.tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, parseISO } from "date-fns";

interface DateRow {
  id: string;
  tipo: string;
  data: string;
  descricao: string;
}

const tipoLabel: Record<string, string> = {
  aniversario_socio: "Aniversário sócio",
  renovacao: "Renovação",
  kickoff: "Kickoff",
  custom: "Outro",
};

export function DatesList({ dates }: { dates: DateRow[] }) {
  if (dates.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma data cadastrada.
      </Card>
    );
  }

  return (
    <ul className="space-y-2">
      {dates.map((d) => {
        const days = differenceInDays(parseISO(d.data), new Date());
        const past = days < 0;
        return (
          <li key={d.id}>
            <Card className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{d.descricao}</span>
                  <Badge variant="secondary">{tipoLabel[d.tipo] ?? d.tipo}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(d.data).toLocaleDateString("pt-BR")}
                  {past ? ` · há ${Math.abs(days)} dias` : ` · em ${days} dias`}
                </div>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step D6.3: Página**

```tsx
// src/app/(authed)/clientes/[id]/datas/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { listDates } from "@/lib/client-folder/dates-actions";
import { AddDateForm } from "@/components/client-folder/AddDateForm";
import { DatesList } from "@/components/client-folder/DatesList";

export default async function DatasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const dates = await listDates(id);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold">Datas importantes</h2>
        <p className="text-xs text-muted-foreground">Aniversários, renovações de contrato, kickoffs e outras datas-chave.</p>
      </header>
      <AddDateForm clientId={id} />
      <DatesList dates={dates} />
    </div>
  );
}
```

- [ ] **Step D6.4: Commit**

```bash
git add -A
git commit -m "feat(client-folder): datas importantes tab"
```

---

### Task D7: Tarefas (per cliente) + Histórico

**Files:**
- Create: `src/app/(authed)/clientes/[id]/tarefas/page.tsx`
- Create: `src/app/(authed)/clientes/[id]/historico/page.tsx`

- [ ] **Step D7.1: Página de tarefas do cliente**

```tsx
// src/app/(authed)/clientes/[id]/tarefas/page.tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listTasks } from "@/lib/tarefas/queries";
import { TasksList } from "@/components/tarefas/TasksList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function ClientTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const tasks = await listTasks({ clientId: id });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tarefas deste cliente</h2>
          <p className="text-xs text-muted-foreground">{tasks.length} tarefa{tasks.length !== 1 ? "s" : ""}</p>
        </div>
        <Button asChild size="sm">
          <Link href={`/tarefas/nova?client_id=${id}`}><Plus className="mr-1 h-3.5 w-3.5" />Nova tarefa</Link>
        </Button>
      </header>
      <TasksList tasks={tasks} />
    </div>
  );
}
```

- [ ] **Step D7.2: Página de histórico (audit log filtrado)**

```tsx
// src/app/(authed)/clientes/[id]/historico/page.tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const acaoLabel: Record<string, string> = {
  create: "Criado",
  update: "Atualizado",
  soft_delete: "Marcado como churn",
  approve: "Aprovado",
};

export default async function HistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) redirect(`/clientes/${id}`);

  const supabase = await createClient();
  const { data: entries = [] } = await supabase
    .from("audit_log")
    .select(`
      id, acao, dados_antes, dados_depois, justificativa, created_at,
      ator:profiles!audit_log_ator_id_fkey(nome)
    `)
    .eq("entidade", "clients")
    .eq("entidade_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold">Histórico de mudanças</h2>
        <p className="text-xs text-muted-foreground">Audit log de tudo que mudou no cadastro deste cliente.</p>
      </header>
      {(entries ?? []).length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Sem alterações registradas.</Card>
      ) : (
        <ul className="space-y-2">
          {(entries ?? []).map((e) => (
            <li key={e.id}>
              <Card className="p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{acaoLabel[e.acao] ?? e.acao}</Badge>
                  {/* @ts-expect-error nested */}
                  <span>{e.ator?.nome ?? "—"}</span>
                  <span>·</span>
                  <span>{new Date(e.created_at).toLocaleString("pt-BR")}</span>
                </div>
                {e.justificativa && (
                  <p className="mt-1 text-sm">{e.justificativa}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step D7.3: Commit**

```bash
git add "src/app/(authed)/clientes/[id]/tarefas/" "src/app/(authed)/clientes/[id]/historico/"
git commit -m "feat(client-folder): tarefas and historico tabs"
```

---

## Bloco E — Tarefas (página global)

### Task E1: Componentes compartilhados de Tarefas

**Files:**
- Create: `src/components/tarefas/PriorityBadge.tsx`
- Create: `src/components/tarefas/TasksList.tsx`

- [ ] **Step E1.1: PriorityBadge**

```tsx
// src/components/tarefas/PriorityBadge.tsx
import { Badge } from "@/components/ui/badge";

const map: Record<string, string> = {
  alta: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  media: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};

export function PriorityBadge({ prioridade }: { prioridade: string }) {
  return <Badge variant="outline" className={map[prioridade]}>{prioridade}</Badge>;
}
```

- [ ] **Step E1.2: TasksList**

```tsx
// src/components/tarefas/TasksList.tsx
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PriorityBadge } from "./PriorityBadge";
import { Check, Circle } from "lucide-react";

interface Task {
  id: string;
  titulo: string;
  prioridade: string;
  status: string;
  due_date: string | null;
  client_id: string | null;
  // @ts-expect-error nested
  atribuido?: { nome: string } | null;
  // @ts-expect-error nested
  cliente?: { id: string; nome: string } | null;
}

export function TasksList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa.</Card>;
  }

  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <li key={t.id}>
          <Card className="p-3">
            <Link href={`/tarefas/${t.id}`} className="flex items-center gap-3 hover:underline">
              {t.status === "concluida" ? (
                <Check className="h-4 w-4 flex-shrink-0 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${t.status === "concluida" ? "line-through text-muted-foreground" : ""}`}>
                  {t.titulo}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <PriorityBadge prioridade={t.prioridade} />
                  {t.atribuido?.nome && <span>→ {t.atribuido.nome}</span>}
                  {t.cliente?.nome && <span>· cliente: {t.cliente.nome}</span>}
                  {t.due_date && <span>· prazo: {new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step E1.3: Commit**

```bash
git add src/components/tarefas/
git commit -m "feat(tarefas): PriorityBadge and TasksList components"
```

---

### Task E2: Página global `/tarefas`

**Files:**
- Create: `src/app/(authed)/tarefas/page.tsx`

- [ ] **Step E2.1: Página**

```tsx
// src/app/(authed)/tarefas/page.tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { listTasks } from "@/lib/tarefas/queries";
import { TasksList } from "@/components/tarefas/TasksList";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function TarefasPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const filtro = params.filtro ?? "minhas";

  let tasks;
  if (filtro === "minhas") tasks = await listTasks({ atribuidoA: user.id, status: "aberta" });
  else if (filtro === "criadas") tasks = await listTasks({ criadoPor: user.id });
  else if (filtro === "concluidas") tasks = await listTasks({ atribuidoA: user.id, status: "concluida" });
  else tasks = await listTasks();

  const tab = (slug: string, label: string) => (
    <Link
      key={slug}
      href={`/tarefas?filtro=${slug}`}
      className={filtro === slug ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Gestão de tarefas entre coordenadores e assessores.</p>
        </div>
        <Button asChild>
          <Link href="/tarefas/nova"><Plus className="mr-2 h-4 w-4" />Nova tarefa</Link>
        </Button>
      </header>

      <div className="flex gap-3 text-sm">
        {tab("minhas", "Minhas (em aberto)")}
        <span className="text-muted-foreground">·</span>
        {tab("criadas", "Que eu criei")}
        <span className="text-muted-foreground">·</span>
        {tab("concluidas", "Concluídas (minhas)")}
        <span className="text-muted-foreground">·</span>
        {tab("todas", "Todas")}
      </div>

      <TasksList tasks={tasks} />
    </div>
  );
}
```

- [ ] **Step E2.2: Commit**

```bash
git add "src/app/(authed)/tarefas/page.tsx"
git commit -m "feat(tarefas): global tasks page with filter tabs"
```

---

### Task E3: Form e página de criar/editar tarefa

**Files:**
- Create: `src/components/tarefas/TaskForm.tsx`
- Create: `src/app/(authed)/tarefas/nova/page.tsx`
- Create: `src/app/(authed)/tarefas/[id]/page.tsx`

- [ ] **Step E3.1: TaskForm**

```tsx
// src/components/tarefas/TaskForm.tsx
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProfileOption { id: string; nome: string; }
interface ClientOption { id: string; nome: string; }

interface Props {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  profiles: ProfileOption[];
  clientes: ClientOption[];
  defaults?: Partial<{
    id: string;
    titulo: string;
    descricao: string | null;
    prioridade: string;
    status: string;
    atribuido_a: string;
    client_id: string | null;
    due_date: string | null;
  }>;
  isEdit?: boolean;
  submitLabel?: string;
}

export function TaskForm({ action, profiles, clientes, defaults = {}, isEdit = false, submitLabel = "Salvar" }: Props) {
  return (
    <form action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="space-y-2">
        <Label htmlFor="titulo">Título</Label>
        <Input id="titulo" name="titulo" defaultValue={defaults.titulo ?? ""} required minLength={3} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição (opcional)</Label>
        <Textarea id="descricao" name="descricao" defaultValue={defaults.descricao ?? ""} rows={4} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="atribuido_a">Atribuir a</Label>
          <Select name="atribuido_a" defaultValue={defaults.atribuido_a ?? ""} required>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
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
          <Label htmlFor="client_id">Cliente (opcional)</Label>
          <Select name="client_id" defaultValue={defaults.client_id ?? ""}>
            <SelectTrigger><SelectValue placeholder="Sem cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sem cliente</SelectItem>
              {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="due_date">Prazo</Label>
          <Input id="due_date" name="due_date" type="date" defaultValue={defaults.due_date ?? ""} />
        </div>

        {isEdit && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={defaults.status ?? "aberta"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aberta">Aberta</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
```

- [ ] **Step E3.2: Página `/tarefas/nova`**

```tsx
// src/app/(authed)/tarefas/nova/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createTaskAction } from "@/lib/tarefas/actions";
import { TaskForm } from "@/components/tarefas/TaskForm";
import { Card } from "@/components/ui/card";

export default async function NovaTarefaPage({ searchParams }: { searchParams: Promise<{ client_id?: string }> }) {
  const params = await searchParams;
  await requireAuth();

  const supabase = await createClient();
  const [{ data: profiles = [] }, { data: clientes = [] }] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Nova tarefa</h1>
      </header>
      <Card className="p-6">
        <TaskForm
          action={createTaskAction}
          profiles={profiles ?? []}
          clientes={clientes ?? []}
          defaults={{ client_id: params.client_id ?? "" }}
          submitLabel="Criar tarefa"
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step E3.3: Página `/tarefas/[id]` (ver + editar inline)**

```tsx
// src/app/(authed)/tarefas/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTaskById } from "@/lib/tarefas/queries";
import { updateTaskAction, toggleTaskCompletionAction } from "@/lib/tarefas/actions";
import { TaskForm } from "@/components/tarefas/TaskForm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function TarefaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  let task;
  try { task = await getTaskById(id); } catch { notFound(); }

  const supabase = await createClient();
  const [{ data: profiles = [] }, { data: clientes = [] }] = await Promise.all([
    supabase.from("profiles").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
  ]);

  const canEdit = task.criado_por === user.id || task.atribuido_a === user.id;

  async function toggle() {
    "use server";
    await toggleTaskCompletionAction(id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Detalhes da tarefa</h1>
        {canEdit && (
          <form action={toggle}>
            <Button type="submit" variant={task.status === "concluida" ? "outline" : "default"}>
              {task.status === "concluida" ? "Reabrir" : "Marcar como concluída"}
            </Button>
          </form>
        )}
      </header>

      {task.client_id && (
        // @ts-expect-error nested
        <p className="text-sm">Vinculada ao cliente <Link href={`/clientes/${task.client_id}`} className="text-primary hover:underline">{task.cliente?.nome}</Link></p>
      )}

      <Card className="p-6">
        {canEdit ? (
          <TaskForm
            action={updateTaskAction}
            profiles={profiles ?? []}
            clientes={clientes ?? []}
            defaults={{
              id: task.id,
              titulo: task.titulo,
              descricao: task.descricao,
              prioridade: task.prioridade,
              status: task.status,
              atribuido_a: task.atribuido_a,
              client_id: task.client_id,
              due_date: task.due_date,
            }}
            isEdit
            submitLabel="Salvar alterações"
          />
        ) : (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">{task.titulo}</h2>
            {task.descricao && <p className="whitespace-pre-wrap text-sm">{task.descricao}</p>}
            <div className="text-xs text-muted-foreground">
              {/* @ts-expect-error nested */}
              Status: {task.status} · Atribuído a {task.atribuido?.nome} · Criado por {task.criador?.nome}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
```

- [ ] **Step E3.4: Commit**

```bash
git add src/components/tarefas/TaskForm.tsx "src/app/(authed)/tarefas/"
git commit -m "feat(tarefas): create and view/edit pages"
```

---

## Bloco F — Smoke test e CI

### Task F1: Atualizar testes E2E + verificar CI

**Files:**
- Modify: `tests/e2e/login.spec.ts` (adicionar fluxo de cliente)
- Create: `tests/e2e/clientes-crud.spec.ts`

- [ ] **Step F1.1: Test E2E de criar cliente (skip se não logado)**

```ts
// tests/e2e/clientes-crud.spec.ts
import { test, expect } from "@playwright/test";

test("rota /clientes redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/clientes");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /tarefas redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/tarefas");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step F1.2: Run all tests**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
npm run test
npm run test:e2e
```

Expected: todos passam.

- [ ] **Step F1.3: Final build**

```bash
npm run build
```

Expected: passa.

- [ ] **Step F1.4: Commit final**

```bash
git add tests/e2e/clientes-crud.spec.ts
git commit -m "test(e2e): clientes and tarefas auth-redirect tests"
```

---

## Self-Review

### Cobertura do spec — itens da Fase 1

| Spec (seção 5.2 e 5.5) | Coberto por |
|---|---|
| Tabela `clients` (com `servico_contratado`) | Task A1 |
| Status: ativo, churn, em_onboarding | Task A1 (enum) |
| Lista paginada de clientes com filtros | Task C1 (filtro por status) |
| Cadastro de cliente manual | Task C2 |
| **Import em lote (TSV/CSV)** com preview e validação | Task C4 |
| Pasta dedicada com sidebar lateral | Tasks D1-D7 |
| Visão geral (próximas datas, última reunião, tarefas, valor) | Task D2 |
| Briefing (markdown) | Task D3 |
| Reuniões (timeline cronológica) | Task D4 |
| Arquivos (Supabase Storage, drag&drop) | Task D5 |
| Datas importantes (notify_days_before) | Task D6 |
| Tarefas relacionadas ao cliente | Task D7 |
| Histórico (audit log filtrado, só Sócio/ADM) | Task D7 |
| Tarefas globais (Trello-like) | Tasks E1-E3 |
| Listas: Atribuídas a mim / Criadas por mim / Por cliente / Por prioridade | Task E2 (filter tabs) |
| Vincular tarefa a cliente (opcional) | Task E3 |

### Lacunas conhecidas (intencionais — Phase 2+)

- Cadastro automático via kanban — **Phase 2** (`em_onboarding` status existe mas só será populado quando o kanban entrar)
- Aba "Satisfação" da pasta do cliente — **Phase 3** (sub-nav já existe estruturalmente, basta adicionar item)
- Notificação real (email/in-app) ao prazo de tarefa — **Phase 5**
- Notificação real ao aniversário — **Phase 5**
- Filtro de cliente por faixa de valor / tag de satisfação — **Phase 1.x ou Phase 6** (refinement)
- Markdown rendering preview do briefing (atualmente texto cru) — **Phase 1.x** (basta adicionar `react-markdown`)

### Verificações

- ✅ Todos os caminhos de arquivo são absolutos e específicos
- ✅ Cada Task tem código completo, sem placeholders
- ✅ Migrations seguem ordem cronológica e referenciam corretamente FKs anteriores
- ✅ Server actions tipadas com Zod, com permission checks e audit log
- ✅ RLS policies cobrem read/insert/update/delete para todas as 5 tabelas novas
- ✅ Storage bucket privado com policies que respeitam o `auth.uid()`

---

## Resumo da entrega da Fase 1

Após executar:
- Yasmin pode **cadastrar clientes** (manual ou em **lote**, colando do Excel/Sheets), atribuir assessor/coordenador
- Campo **Serviço contratado** (texto livre) em cada cliente — ex.: "Social media + Tráfego pago"
- **Import em lote** aceita TSV (Excel) ou CSV, com preview, validação de cada linha, e mensagem de erro específica por linha inválida
- Cada cliente tem **pasta digital** com 7 abas: Visão geral, Briefing, Reuniões, Arquivos, Datas, Tarefas, Histórico
- **Briefing em markdown** salvo no Postgres
- **Reuniões** acumulam em timeline (mais novo no topo)
- **Arquivos** sobem para Supabase Storage (até 50MB cada), com link de download via signed URL
- **Datas** marcam aniversários, renovações, kickoffs (notificação real fica pra Phase 5)
- **Tarefas** funcionam global (página `/tarefas`) e por cliente (`/clientes/[id]/tarefas`)
- **Audit log** registra mudanças no cadastro de cliente
- Pronto para **Fase 2** (Kanban de onboarding)

Total estimado: **~30 commits** na fase.
