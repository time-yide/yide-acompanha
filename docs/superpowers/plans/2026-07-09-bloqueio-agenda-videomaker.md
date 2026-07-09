# Bloqueio de Agenda do Videomaker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Videomaker solicita bloqueio de agenda (1 dia + faixa de horário + motivo); coordenador audiovisual aprova/recusa; bloqueio aprovado aparece na agenda e impede (com "confirmar mesmo assim") delegar o videomaker no horário.

**Architecture:** Nova tabela `agenda_bloqueios` com workflow pendente→aprovada/rejeitada. Server actions (solicitar/aprovar/rejeitar/cancelar) + notificações por role. A checagem de colisão entra no `validateVideomakerAssignment` (calendário), devolvendo um sinal `blockWarning` que a UI transforma em "confirmar mesmo assim" (mesmo padrão do `requiresDelivery` das tarefas). UI dentro do módulo `/audiovisual` (tabs).

**Tech Stack:** Next.js App Router (server actions), Supabase (Postgres + RLS), Zod, vitest.

**Convenções do projeto (ler antes de começar):**
- Branch a partir de `origin/main` (main local vive ~300 commits atrás).
- Migrations são aplicadas **manualmente** no SQL Editor do Supabase após o merge — NÃO rodam no deploy.
- Ao adicionar valor ao enum `notification_event`, o `src/types/database.ts` precisa incluir o valor novo **no mesmo PR**, senão o type-check quebra.
- RLS deny em UPDATE é **silencioso** (`error:null`, 0 rows) — actions checam role explicitamente.
- Timezone da aplicação: `America/Cuiaba` (UTC-4). Comparações de horário no mesmo dia local são feitas em wall-clock (HH:MM), sem conversão UTC.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/<ts>_notification_event_bloqueio_agenda.sql` | Adiciona 2 valores ao enum `notification_event` (migration isolada) |
| `supabase/migrations/<ts>_agenda_bloqueios.sql` | Tabela `agenda_bloqueios` + RLS + seed de 2 regras de notificação |
| `src/types/database.ts` | Adiciona os 2 enum values ao union `notification_event` (manual) |
| `src/lib/audiovisual/bloqueios/schema.ts` | Zod: criar / rejeitar |
| `src/lib/audiovisual/bloqueios/queries.ts` | Leituras: meus / pendentes / colisão |
| `src/lib/audiovisual/bloqueios/actions.ts` | solicitar / aprovar / rejeitar / cancelar + notificações |
| `src/lib/audiovisual/bloqueios/overlap.ts` | Função pura `bloqueiosColidem` (testável isolada) |
| `src/lib/calendario/actions.ts` | `validateVideomakerAssignment` + create/update event: checagem de bloqueio + override |
| `src/components/audiovisual/MeusBloqueiosAba.tsx` | Videomaker: botão solicitar + lista |
| `src/components/audiovisual/SolicitarBloqueioModal.tsx` | Modal do formulário |
| `src/components/audiovisual/SolicitacoesBloqueioAba.tsx` | Coordenador: fila de aprovação |
| `src/app/(authed)/audiovisual/page.tsx` | Novas tabs |
| `tests/unit/bloqueio-overlap.test.ts` | Testa `bloqueiosColidem` |
| `tests/unit/bloqueio-actions.test.ts` | Testa actions |
| `tests/unit/bloqueio-schema.test.ts` | Testa Zod |

**Setup inicial (uma vez):**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
git fetch origin -q
git checkout -b feat/bloqueio-agenda-videomaker origin/main   # se ainda não estiver nela
```

> Nota: a branch `feat/bloqueio-agenda-videomaker` já existe (contém os specs). Continue nela.

---

## Task 1: Migration — enum de notificação

**Files:**
- Create: `supabase/migrations/<timestamp>_notification_event_bloqueio_agenda.sql`

Use timestamp maior que a última migration (`ls supabase/migrations | tail -1`), ex.: `20260709000100`.

- [ ] **Step 1: Criar a migration do enum (isolada)**

`alter type ... add value` não pode coexistir com o uso do valor na mesma transação — por isso fica num arquivo separado, aplicado primeiro.

```sql
-- supabase/migrations/20260709000100_notification_event_bloqueio_agenda.sql
-- Novos eventos de notificação pro fluxo de bloqueio de agenda do videomaker.
alter type public.notification_event add value if not exists 'bloqueio_agenda_solicitado';
alter type public.notification_event add value if not exists 'bloqueio_agenda_respondido';
```

- [ ] **Step 2: Refletir no database.ts (senão o type-check quebra)**

Em `src/types/database.ts`, encontre o union `notification_event:` dentro de `Enums` e adicione os dois valores ao final da lista de strings (mantendo o padrão de aspas/vírgulas do arquivo):

```ts
        | "bloqueio_agenda_solicitado"
        | "bloqueio_agenda_respondido"
```

Run para achar a linha:
```bash
grep -n "notification_event:" src/types/database.ts
```

- [ ] **Step 3: Type-check**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260709000100_notification_event_bloqueio_agenda.sql src/types/database.ts
git commit -m "feat(notif): eventos de bloqueio de agenda no enum"
```

---

## Task 2: Migration — tabela agenda_bloqueios + RLS + regras

**Files:**
- Create: `supabase/migrations/20260709000200_agenda_bloqueios.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260709000200_agenda_bloqueios.sql
-- Solicitações de bloqueio de agenda do videomaker (1 dia + faixa de horário),
-- aprovadas/recusadas pelo coordenador audiovisual.

create table public.agenda_bloqueios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),

  criado_por uuid not null references public.profiles(id),
  criado_por_nome text not null,

  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  motivo text not null,

  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'rejeitada')),
  respondido_por uuid references public.profiles(id) on delete set null,
  respondido_em timestamptz,
  motivo_recusa text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),

  constraint agenda_bloqueios_horario_valido check (hora_fim > hora_inicio)
);

create index idx_agenda_bloqueios_criado_por on public.agenda_bloqueios(criado_por);
create index idx_agenda_bloqueios_status on public.agenda_bloqueios(status);
create index idx_agenda_bloqueios_data on public.agenda_bloqueios(data);
create index idx_agenda_bloqueios_deleted on public.agenda_bloqueios(deleted_at)
  where deleted_at is not null;

create trigger trg_agenda_bloqueios_updated_at
  before update on public.agenda_bloqueios
  for each row execute function public.set_updated_at();

alter table public.agenda_bloqueios enable row level security;

create policy "agenda_bloqueios select"
  on public.agenda_bloqueios for select to authenticated
  using (
    criado_por = auth.uid()
    or public.current_user_role() in ('adm', 'socio', 'audiovisual_chefe', 'coordenador')
  );

create policy "agenda_bloqueios insert"
  on public.agenda_bloqueios for insert to authenticated
  with check (
    criado_por = auth.uid()
    or public.current_user_role() in ('adm', 'socio')
  );

create policy "agenda_bloqueios update"
  on public.agenda_bloqueios for update to authenticated
  using (
    (criado_por = auth.uid() and status = 'pendente')
    or public.current_user_role() in ('audiovisual_chefe', 'adm', 'socio')
  )
  with check (
    (criado_por = auth.uid())
    or public.current_user_role() in ('audiovisual_chefe', 'adm', 'socio')
  );

create policy "agenda_bloqueios delete"
  on public.agenda_bloqueios for delete to authenticated
  using (public.current_user_role() in ('adm', 'socio'));

-- Regras de notificação (o dispatch faz no-op se a regra não existir).
insert into public.notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles)
values
  ('bloqueio_agenda_solicitado', true, false, true,  true, array['audiovisual_chefe']),
  ('bloqueio_agenda_respondido', true, false, false, true, array[]::text[])
on conflict (evento_tipo) do nothing;
```

- [ ] **Step 2: Commit** (migration aplicada manualmente depois do merge)

```bash
git add supabase/migrations/20260709000200_agenda_bloqueios.sql
git commit -m "feat(db): tabela agenda_bloqueios + RLS + regras de notificação"
```

---

## Task 3: Schema Zod + testes

**Files:**
- Create: `src/lib/audiovisual/bloqueios/schema.ts`
- Test: `tests/unit/bloqueio-schema.test.ts`

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
// tests/unit/bloqueio-schema.test.ts
import { describe, it, expect } from "vitest";
import { createBloqueioSchema, rejeitarBloqueioSchema } from "@/lib/audiovisual/bloqueios/schema";

describe("createBloqueioSchema", () => {
  it("aceita bloqueio válido", () => {
    const r = createBloqueioSchema.safeParse({
      data: "2026-07-10", hora_inicio: "14:00", hora_fim: "15:00", motivo: "Consulta médica",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita hora_fim <= hora_inicio", () => {
    const r = createBloqueioSchema.safeParse({
      data: "2026-07-10", hora_inicio: "15:00", hora_fim: "14:00", motivo: "x",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita motivo vazio", () => {
    const r = createBloqueioSchema.safeParse({
      data: "2026-07-10", hora_inicio: "14:00", hora_fim: "15:00", motivo: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("rejeitarBloqueioSchema", () => {
  it("exige motivo_recusa", () => {
    const r = rejeitarBloqueioSchema.safeParse({ id: "11111111-1111-1111-1111-111111111111", motivo_recusa: "" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run tests/unit/bloqueio-schema.test.ts --exclude '**/.claude/**'`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar o schema**

```ts
// src/lib/audiovisual/bloqueios/schema.ts
import { z } from "zod";

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createBloqueioSchema = z
  .object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    hora_inicio: z.string().regex(horaRegex, "Hora início inválida"),
    hora_fim: z.string().regex(horaRegex, "Hora fim inválida"),
    motivo: z.string().trim().min(1, "Informe o motivo").max(500),
  })
  .refine((d) => d.hora_fim > d.hora_inicio, {
    message: "Hora fim deve ser depois da hora início",
    path: ["hora_fim"],
  });

export const rejeitarBloqueioSchema = z.object({
  id: z.string().uuid(),
  motivo_recusa: z.string().trim().min(1, "Informe o motivo da recusa").max(500),
});

export type CreateBloqueioInput = z.infer<typeof createBloqueioSchema>;
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run tests/unit/bloqueio-schema.test.ts --exclude '**/.claude/**'`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audiovisual/bloqueios/schema.ts tests/unit/bloqueio-schema.test.ts
git commit -m "feat(bloqueios): schema de validação + testes"
```

---

## Task 4: Função pura de colisão + testes

Comparação de horários no mesmo dia local em wall-clock (HH:MM), sem timezone.

**Files:**
- Create: `src/lib/audiovisual/bloqueios/overlap.ts`
- Test: `tests/unit/bloqueio-overlap.test.ts`

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
// tests/unit/bloqueio-overlap.test.ts
import { describe, it, expect } from "vitest";
import { bloqueiosColidem } from "@/lib/audiovisual/bloqueios/overlap";

const bloco = (hi: string, hf: string) => ({ hora_inicio: hi, hora_fim: hf, motivo: "x" });

describe("bloqueiosColidem", () => {
  it("detecta sobreposição parcial", () => {
    expect(bloqueiosColidem([bloco("14:00", "15:00")], "14:30", "16:00")).toEqual(
      expect.objectContaining({ hora_inicio: "14:00" }),
    );
  });
  it("horário adjacente não colide (fim == início)", () => {
    expect(bloqueiosColidem([bloco("14:00", "15:00")], "15:00", "16:00")).toBeNull();
  });
  it("sem bloqueios retorna null", () => {
    expect(bloqueiosColidem([], "14:00", "15:00")).toBeNull();
  });
  it("normaliza HH:MM:SS vindo do banco", () => {
    expect(bloqueiosColidem([bloco("14:00:00", "15:00:00")], "14:30", "14:45")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run tests/unit/bloqueio-overlap.test.ts --exclude '**/.claude/**'`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/lib/audiovisual/bloqueios/overlap.ts
export interface BlocoHorario {
  hora_inicio: string; // "HH:MM" ou "HH:MM:SS"
  hora_fim: string;
  motivo: string;
}

const hhmm = (t: string) => t.slice(0, 5);

/**
 * Retorna o primeiro bloco que colide com [inicioLocal, fimLocal) (mesmo dia
 * local, wall-clock HH:MM). Adjacência (fim == início) NÃO colide. null se nenhum.
 */
export function bloqueiosColidem(
  blocos: BlocoHorario[],
  inicioLocal: string,
  fimLocal: string,
): BlocoHorario | null {
  const evStart = hhmm(inicioLocal);
  const evEnd = hhmm(fimLocal);
  for (const b of blocos) {
    const bStart = hhmm(b.hora_inicio);
    const bEnd = hhmm(b.hora_fim);
    if (bStart < evEnd && bEnd > evStart) return b;
  }
  return null;
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run tests/unit/bloqueio-overlap.test.ts --exclude '**/.claude/**'`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audiovisual/bloqueios/overlap.ts tests/unit/bloqueio-overlap.test.ts
git commit -m "feat(bloqueios): função de colisão de horário + testes"
```

---

## Task 5: Queries

**Files:**
- Create: `src/lib/audiovisual/bloqueios/queries.ts`

Não há teste unitário isolado (thin wrappers de Supabase); serão exercitados via actions (Task 6). Cache tag pra revalidação.

- [ ] **Step 1: Implementar**

```ts
// src/lib/audiovisual/bloqueios/queries.ts
import { createClient } from "@/lib/supabase/server";

export const BLOQUEIOS_TAG = "agenda_bloqueios";

export interface BloqueioRow {
  id: string;
  criado_por: string;
  criado_por_nome: string;
  data: string;          // YYYY-MM-DD
  hora_inicio: string;   // HH:MM:SS
  hora_fim: string;
  motivo: string;
  status: "pendente" | "aprovada" | "rejeitada";
  respondido_por: string | null;
  respondido_em: string | null;
  motivo_recusa: string | null;
  created_at: string;
}

const SELECT =
  "id, criado_por, criado_por_nome, data, hora_inicio, hora_fim, motivo, status, respondido_por, respondido_em, motivo_recusa, created_at";

export async function listMeusBloqueios(userId: string): Promise<BloqueioRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda_bloqueios")
    .select(SELECT)
    .eq("criado_por", userId)
    .is("deleted_at", null)
    .order("data", { ascending: false });
  return (data ?? []) as BloqueioRow[];
}

export async function listBloqueiosPendentes(): Promise<BloqueioRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda_bloqueios")
    .select(SELECT)
    .eq("status", "pendente")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as BloqueioRow[];
}

export async function listBloqueiosRespondidos(limit = 30): Promise<BloqueioRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda_bloqueios")
    .select(SELECT)
    .neq("status", "pendente")
    .is("deleted_at", null)
    .order("respondido_em", { ascending: false })
    .limit(limit);
  return (data ?? []) as BloqueioRow[];
}

/** Bloqueios APROVADOS de um videomaker numa data local (YYYY-MM-DD). */
export async function listBloqueiosAprovadosNaData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  videomakerId: string,
  dataLocal: string,
): Promise<{ hora_inicio: string; hora_fim: string; motivo: string }[]> {
  const { data } = await sb
    .from("agenda_bloqueios")
    .select("hora_inicio, hora_fim, motivo")
    .eq("criado_por", videomakerId)
    .eq("status", "aprovada")
    .eq("data", dataLocal)
    .is("deleted_at", null);
  return data ?? [];
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npm run typecheck`
```bash
git add src/lib/audiovisual/bloqueios/queries.ts
git commit -m "feat(bloqueios): queries de leitura"
```

---

## Task 6: Actions (solicitar/aprovar/rejeitar/cancelar) + testes

**Files:**
- Create: `src/lib/audiovisual/bloqueios/actions.ts`
- Test: `tests/unit/bloqueio-actions.test.ts`

- [ ] **Step 1: Escrever o teste (falhando)**

Mocks no estilo de `tests/unit/tarefas-toggle-completion.test.ts` (createClient, requireAuth, dispatchNotification, next/cache).

```ts
// tests/unit/bloqueio-actions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());
const coordIdsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: fromMock }) }));
vi.mock("@/lib/auth/session", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/notificacoes/dispatch", () => ({ dispatchNotification: dispatchMock }));
vi.mock("@/lib/tarefas/client-team", () => ({ getCoordenadoresAudiovisualIds: coordIdsMock }));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import {
  solicitarBloqueioAction,
  aprovarBloqueioAction,
  rejeitarBloqueioAction,
} from "@/lib/audiovisual/bloqueios/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  dispatchMock.mockReset();
  coordIdsMock.mockReset().mockResolvedValue(["coord-1"]);
});

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

// Helper: mock de insert que captura o payload
function mockInsert() {
  const insert = vi.fn().mockResolvedValue({ data: [{ id: "b1" }], error: null });
  fromMock.mockImplementation((t: string) => {
    if (t === "agenda_bloqueios") {
      return {
        insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "b1" }, error: null }) }) }),
        // fallback pro update path
      };
    }
    if (t === "profiles") {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { organization_id: "org-1" } }) }) }) };
    }
    return {};
  });
  return { insert };
}

describe("solicitarBloqueioAction", () => {
  it("videomaker cria pendente e notifica coordenadores", async () => {
    requireAuthMock.mockResolvedValue({ id: "vm-1", role: "videomaker", nome: "Hanna" });
    mockInsert();

    const r = await solicitarBloqueioAction(
      fd({ data: "2026-07-10", hora_inicio: "14:00", hora_fim: "15:00", motivo: "Consulta médica" }),
    );

    expect(r?.error).toBeUndefined();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "bloqueio_agenda_solicitado", user_ids_extras: ["coord-1"] }),
    );
  });

  it("rejeita horário inválido sem inserir", async () => {
    requireAuthMock.mockResolvedValue({ id: "vm-1", role: "videomaker", nome: "Hanna" });
    mockInsert();
    const r = await solicitarBloqueioAction(
      fd({ data: "2026-07-10", hora_inicio: "15:00", hora_fim: "14:00", motivo: "x" }),
    );
    expect(r?.error).toBeTruthy();
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe("aprovar/rejeitar", () => {
  function mockUpdateAndFetch(row: Record<string, unknown>) {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });
    fromMock.mockImplementation((t: string) => {
      if (t === "agenda_bloqueios") {
        return {
          update,
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: row }) }) }),
        };
      }
      return {};
    });
    return { update };
  }

  it("audiovisual_chefe aprova e notifica o videomaker", async () => {
    requireAuthMock.mockResolvedValue({ id: "coord-1", role: "audiovisual_chefe", nome: "Coord" });
    mockUpdateAndFetch({ id: "b1", criado_por: "vm-1", data: "2026-07-10", hora_inicio: "14:00:00", hora_fim: "15:00:00" });

    const r = await aprovarBloqueioAction("b1");

    expect(r?.error).toBeUndefined();
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({ evento_tipo: "bloqueio_agenda_respondido", user_ids_extras: ["vm-1"] }),
    );
  });

  it("videomaker NÃO pode aprovar", async () => {
    requireAuthMock.mockResolvedValue({ id: "vm-1", role: "videomaker", nome: "Hanna" });
    mockUpdateAndFetch({ id: "b1", criado_por: "vm-1" });
    const r = await aprovarBloqueioAction("b1");
    expect(r?.error).toBeTruthy();
  });

  it("rejeitar sem motivo falha", async () => {
    requireAuthMock.mockResolvedValue({ id: "coord-1", role: "audiovisual_chefe", nome: "Coord" });
    mockUpdateAndFetch({ id: "b1", criado_por: "vm-1" });
    const r = await rejeitarBloqueioAction(fd({ id: "11111111-1111-1111-1111-111111111111", motivo_recusa: "" }));
    expect(r?.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run tests/unit/bloqueio-actions.test.ts --exclude '**/.claude/**'`
Expected: FAIL.

- [ ] **Step 3: Implementar as actions**

```ts
// src/lib/audiovisual/bloqueios/actions.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { getCoordenadoresAudiovisualIds } from "@/lib/tarefas/client-team";
import { logAudit } from "@/lib/audit/log";
import { createBloqueioSchema, rejeitarBloqueioSchema } from "./schema";
import { BLOQUEIOS_TAG } from "./queries";

type Result = { error?: string; success?: boolean };

const ROLES_APROVAM = ["audiovisual_chefe", "adm", "socio"];

function fmtHora(t: string) {
  return t.slice(0, 5);
}
function fmtDataBR(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function revalidar() {
  revalidatePath("/audiovisual");
  revalidateTag(BLOQUEIOS_TAG, "default");
}

export async function solicitarBloqueioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();

  const parsed = createBloqueioSchema.safeParse({
    data: formData.get("data"),
    hora_inicio: formData.get("hora_inicio"),
    hora_fim: formData.get("hora_fim"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const { data: prof } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!prof) return { error: "Perfil não encontrado" };

  const { data: inserted, error } = await supabase
    .from("agenda_bloqueios")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      organization_id: (prof as any).organization_id,
      criado_por: actor.id,
      criado_por_nome: actor.nome,
      data: parsed.data.data,
      hora_inicio: parsed.data.hora_inicio,
      hora_fim: parsed.data.hora_fim,
      motivo: parsed.data.motivo,
    } as any)
    .select("id")
    .single();
  if (error) return { error: error.message };

  await logAudit({
    entidade: "agenda_bloqueios",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    entidade_id: (inserted as any)?.id ?? "",
    acao: "create",
    ator_id: actor.id,
    dados_depois: parsed.data as unknown as Record<string, unknown>,
  });

  const coordIds = await getCoordenadoresAudiovisualIds();
  await dispatchNotification({
    evento_tipo: "bloqueio_agenda_solicitado",
    titulo: "Nova solicitação de bloqueio de agenda",
    mensagem: `${actor.nome} solicitou bloqueio em ${fmtDataBR(parsed.data.data)} das ${parsed.data.hora_inicio} às ${parsed.data.hora_fim}. Motivo: ${parsed.data.motivo}`,
    link: "/audiovisual",
    user_ids_extras: coordIds,
    source_user_id: actor.id,
  });

  revalidar();
  return { success: true };
}

async function responder(
  actor: { id: string; role: string; nome: string },
  id: string,
  novoStatus: "aprovada" | "rejeitada",
  motivoRecusa?: string,
): Promise<Result> {
  if (!ROLES_APROVAM.includes(actor.role)) {
    return { error: "Apenas coordenador audiovisual, adm ou sócio podem responder" };
  }
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: any = {
    status: novoStatus,
    respondido_por: actor.id,
    respondido_em: new Date().toISOString(),
    motivo_recusa: novoStatus === "rejeitada" ? (motivoRecusa ?? null) : null,
  };

  const { error } = await supabase.from("agenda_bloqueios").update(patch).eq("id", id).eq("status", "pendente");
  if (error) return { error: error.message };

  // Detecta 0 linhas (RLS silenciosa OU já respondido) relendo a linha.
  const { data: row } = await supabase
    .from("agenda_bloqueios")
    .select("id, criado_por, status, data, hora_inicio, hora_fim")
    .eq("id", id)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = row as any;
  if (!r || r.status !== novoStatus) {
    return { error: "Não foi possível responder (já respondido ou sem permissão)" };
  }

  await logAudit({
    entidade: "agenda_bloqueios",
    entidade_id: id,
    acao: "update",
    ator_id: actor.id,
    dados_depois: { status: novoStatus, motivo_recusa: patch.motivo_recusa },
  });

  const msg =
    novoStatus === "aprovada"
      ? `Seu bloqueio de ${fmtDataBR(r.data)} das ${fmtHora(r.hora_inicio)} às ${fmtHora(r.hora_fim)} foi aprovado.`
      : `Seu bloqueio de ${fmtDataBR(r.data)} das ${fmtHora(r.hora_inicio)} às ${fmtHora(r.hora_fim)} foi recusado. Motivo: ${motivoRecusa}`;

  await dispatchNotification({
    evento_tipo: "bloqueio_agenda_respondido",
    titulo: novoStatus === "aprovada" ? "Bloqueio aprovado" : "Bloqueio recusado",
    mensagem: msg,
    link: "/audiovisual",
    user_ids_extras: [r.criado_por],
    source_user_id: actor.id,
  });

  revalidar();
  return { success: true };
}

export async function aprovarBloqueioAction(id: string): Promise<Result> {
  const actor = await requireAuth();
  return responder(actor, id, "aprovada");
}

export async function rejeitarBloqueioAction(formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  const parsed = rejeitarBloqueioSchema.safeParse({
    id: formData.get("id"),
    motivo_recusa: formData.get("motivo_recusa"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return responder(actor, parsed.data.id, "rejeitada", parsed.data.motivo_recusa);
}

export async function cancelarBloqueioAction(id: string): Promise<Result> {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("agenda_bloqueios")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.id } as any)
    .eq("id", id)
    .eq("criado_por", actor.id)
    .eq("status", "pendente");
  if (error) return { error: error.message };
  revalidar();
  return { success: true };
}
```

> **Nota sobre `logAudit`:** confira a assinatura real em `src/lib/audit/log.ts` e ajuste os campos (`entidade`, `entidade_id`, `acao`, `ator_id`, `dados_depois`) pra bater — o teste mocka `logAudit`, então não valida o shape.

- [ ] **Step 4: Rodar os testes (devem passar)**

Run: `npx vitest run tests/unit/bloqueio-actions.test.ts --exclude '**/.claude/**'`
Expected: PASS. Se algum mock não bater com a implementação, ajuste o mock (não a intenção).

- [ ] **Step 5: Type-check + commit**

Run: `npm run typecheck`
```bash
git add src/lib/audiovisual/bloqueios/actions.ts tests/unit/bloqueio-actions.test.ts
git commit -m "feat(bloqueios): actions solicitar/aprovar/rejeitar/cancelar + testes"
```

---

## Task 7: Checagem de bloqueio na atribuição do videomaker

**Files:**
- Modify: `src/lib/calendario/actions.ts` (`validateVideomakerAssignment` ~linha 86; `createEventAction` ~183; `updateEventAction` ~353; type `ActionResult` ~124)
- Test: `tests/unit/videomaker-assignment-bloqueio.test.ts`

- [ ] **Step 1: Escrever o teste (falhando)**

Testa só a lógica de colisão via a função pura já testada + um teste de integração fino do ramo. Como `validateVideomakerAssignment` é `private`, exporte-a para teste OU teste através do comportamento. Exporte um helper testável:

```ts
// tests/unit/videomaker-assignment-bloqueio.test.ts
import { describe, it, expect } from "vitest";
import { checarBloqueioVideomaker } from "@/lib/calendario/bloqueio-check";

const sbWith = (rows: unknown[]) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({ is: () => ({ then: undefined, data: rows }) }),
        }),
      }),
    }),
  }),
});

describe("checarBloqueioVideomaker", () => {
  it("retorna warning quando há bloqueio aprovado colidindo", async () => {
    const rows = [{ hora_inicio: "14:00:00", hora_fim: "15:00:00", motivo: "Consulta" }];
    const r = await checarBloqueioVideomaker(
      { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ is: async () => ({ data: rows }) }) }) }) }) }) } as never,
      { videomakerId: "vm-1", nome: "Hanna", dataLocal: "2026-07-10", horaInicioLocal: "14:30", horaFimLocal: "16:00" },
    );
    expect(r).toMatch(/Hanna/);
    expect(r).toMatch(/consulta/i);
  });

  it("retorna null quando não colide", async () => {
    const r = await checarBloqueioVideomaker(
      { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ is: async () => ({ data: [] }) }) }) }) }) }) } as never,
      { videomakerId: "vm-1", nome: "Hanna", dataLocal: "2026-07-10", horaInicioLocal: "14:30", horaFimLocal: "16:00" },
    );
    expect(r).toBeNull();
  });
});
```

> A cadeia de mock acima é frágil. Para robustez, implemente `checarBloqueioVideomaker` recebendo já a lista de blocos via `listBloqueiosAprovadosNaData` internamente e, no teste, mocke `./bloqueio-check`'s dependency. Alternativa mais limpa: fatiar em duas funções — `buscarBloqueiosAprovados(sb, vm, data)` (I/O) e `bloqueiosColidem` (pura, já testada). Teste só a composição com um stub simples de `buscarBloqueiosAprovados`. Ajuste o teste ao que ficar mais limpo na implementação.

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run tests/unit/videomaker-assignment-bloqueio.test.ts --exclude '**/.claude/**'`
Expected: FAIL.

- [ ] **Step 3: Criar o helper `checarBloqueioVideomaker`**

```ts
// src/lib/calendario/bloqueio-check.ts
import { listBloqueiosAprovadosNaData } from "@/lib/audiovisual/bloqueios/queries";
import { bloqueiosColidem } from "@/lib/audiovisual/bloqueios/overlap";

/**
 * Retorna uma mensagem de aviso se o videomaker tem bloqueio APROVADO colidindo
 * com [horaInicioLocal, horaFimLocal) na dataLocal; null se livre.
 */
export async function checarBloqueioVideomaker(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  params: { videomakerId: string; nome: string; dataLocal: string; horaInicioLocal: string; horaFimLocal: string },
): Promise<string | null> {
  const blocos = await listBloqueiosAprovadosNaData(sb, params.videomakerId, params.dataLocal);
  const hit = bloqueiosColidem(blocos, params.horaInicioLocal, params.horaFimLocal);
  if (!hit) return null;
  return `${params.nome} tem bloqueio aprovado das ${hit.hora_inicio.slice(0, 5)} às ${hit.hora_fim.slice(0, 5)} nesse dia (motivo: ${hit.motivo}).`;
}
```

Ajuste o teste do Step 1 para stubar `listBloqueiosAprovadosNaData` via `vi.mock("@/lib/audiovisual/bloqueios/queries", ...)` retornando os blocos — mais limpo que mockar a cadeia do Supabase:

```ts
// topo do teste
import { vi } from "vitest";
vi.mock("@/lib/audiovisual/bloqueios/queries", () => ({
  listBloqueiosAprovadosNaData: vi.fn(),
}));
import { listBloqueiosAprovadosNaData } from "@/lib/audiovisual/bloqueios/queries";
// nos testes: (listBloqueiosAprovadosNaData as any).mockResolvedValue(rows)
// chame checarBloqueioVideomaker({} as never, {...})
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run tests/unit/videomaker-assignment-bloqueio.test.ts --exclude '**/.claude/**'`
Expected: PASS.

- [ ] **Step 5: Ligar no `validateVideomakerAssignment` e nas actions de evento**

Em `src/lib/calendario/actions.ts`:

1. Import no topo:
```ts
import { checarBloqueioVideomaker } from "./bloqueio-check";
```

2. Estender o tipo de resultado da validação e da action. Trocar a assinatura de `validateVideomakerAssignment` para aceitar os campos locais + flag e poder devolver `blockWarning`:

```ts
async function validateVideomakerAssignment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  params: {
    videomakerId: string;
    inicioUtc: string;
    fimUtc: string;
    excludeEventId?: string;
    dataLocal: string;
    horaInicioLocal: string;
    horaFimLocal: string;
    ignorarBloqueio?: boolean;
  },
): Promise<{ error: string } | { blockWarning: string } | { ok: true; nome: string }> {
```

3. Logo antes do `return { ok: true, nome: vm.nome };` final, inserir a checagem de bloqueio:

```ts
  if (!params.ignorarBloqueio) {
    const warning = await checarBloqueioVideomaker(sb, {
      videomakerId: params.videomakerId,
      nome: vm.nome,
      dataLocal: params.dataLocal,
      horaInicioLocal: params.horaInicioLocal,
      horaFimLocal: params.horaFimLocal,
    });
    if (warning) return { blockWarning: warning };
  }
  return { ok: true, nome: vm.nome };
```

4. Estender `type ActionResult` (~linha 124) para carregar o aviso:
```ts
type ActionResult = { error?: string; blockWarning?: string } | undefined;
```

5. Em `createEventAction` e `updateEventAction`, no ponto onde chamam `validateVideomakerAssignment`, passar os campos locais e o flag, e tratar o `blockWarning`. Os valores locais vêm das strings do form (`inicio`/`fim` são datetime-local, ex. `2026-07-10T14:00`):

```ts
// derivar locais a partir da string de inicio/fim do form (antes da conversão UTC)
const inicioStr = fd(formData, "inicio") ?? "";       // "YYYY-MM-DDTHH:MM"
const fimStr = fd(formData, "fim") ?? "";
const dataLocal = inicioStr.slice(0, 10);
const horaInicioLocal = inicioStr.slice(11, 16);
const horaFimLocal = fimStr.slice(11, 16);
const ignorarBloqueio = fd(formData, "ignorar_bloqueio") === "true";

const check = await validateVideomakerAssignment(sb, {
  videomakerId, inicioUtc, fimUtc, dataLocal, horaInicioLocal, horaFimLocal, ignorarBloqueio,
  // excludeEventId: <id do evento> no updateEventAction
});
if ("error" in check) return { error: check.error };
if ("blockWarning" in check) return { blockWarning: check.blockWarning };
// segue com check.nome
```

> Confira o nome exato do campo de data/hora que o form de evento envia (`inicio`/`fim` vs `data`/`hora_*`). Leia `src/lib/calendario/schema.ts` e o form em `src/components/**` do calendário e ajuste os `slice`/nomes. O objetivo: `dataLocal` (YYYY-MM-DD), `horaInicioLocal`/`horaFimLocal` (HH:MM) em wall-clock local.

- [ ] **Step 6: Rodar testes + type-check**

Run: `npm run typecheck && npx vitest run tests/unit/videomaker-assignment-bloqueio.test.ts tests/unit/bloqueio-overlap.test.ts --exclude '**/.claude/**'`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/calendario/actions.ts src/lib/calendario/bloqueio-check.ts tests/unit/videomaker-assignment-bloqueio.test.ts
git commit -m "feat(calendario): bloqueia atribuição de videomaker em horário bloqueado (com override)"
```

---

## Task 8: UI — form de evento trata "confirmar mesmo assim"

**Files:**
- Modify: o componente client do form de evento do calendário (localizar com o grep abaixo)

```bash
grep -rln "createEventAction\|updateEventAction" src/components src/app
```

- [ ] **Step 1: Ler o componente e o estado de submit**

O form usa `useActionState`/`useFormState` com `ActionResult`. Como agora o resultado pode ter `blockWarning`, trate-o.

- [ ] **Step 2: Implementar o tratamento de `blockWarning`**

Quando `state.blockWarning` estiver setado (e `state.error` não), renderize um alerta e um botão "Confirmar mesmo assim" que reenvia o mesmo form com um input escondido `ignorar_bloqueio=true`. Padrão:

```tsx
// dentro do componente do form
const [ignorar, setIgnorar] = useState(false);

// no <form>, um input escondido controlado:
<input type="hidden" name="ignorar_bloqueio" value={ignorar ? "true" : "false"} />

// abaixo dos campos, quando houver aviso de bloqueio:
{state?.blockWarning && (
  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
    <p className="font-medium text-amber-700 dark:text-amber-400">⚠️ {state.blockWarning}</p>
    <p className="mt-1 text-muted-foreground">
      O videomaker tem um bloqueio aprovado nesse horário. Você pode confirmar assim mesmo.
    </p>
    <Button
      type="submit"
      variant="outline"
      className="mt-2"
      onClick={() => setIgnorar(true)}
    >
      Confirmar mesmo assim
    </Button>
  </div>
)}
```

> `onClick` seta `ignorar=true` antes do submit; como o input escondido lê `ignorar`, o reenvio manda `ignorar_bloqueio=true` e a action pula a checagem. Depois de um submit bem-sucedido, resete `ignorar` para `false` (ex.: no `useEffect` que fecha o modal).

- [ ] **Step 3: Verificação manual + commit**

Type-check: `npm run typecheck`
```bash
git add -A
git commit -m "feat(calendario): UI 'confirmar mesmo assim' pra bloqueio de agenda"
```

---

## Task 9: UI — aba do videomaker (solicitar + meus bloqueios)

**Files:**
- Create: `src/components/audiovisual/SolicitarBloqueioModal.tsx`
- Create: `src/components/audiovisual/MeusBloqueiosAba.tsx`
- Modify: `src/app/(authed)/audiovisual/page.tsx`

Espelhe o padrão de modal de `src/components/tarefas/ConcludeOperationalModal.tsx` (Dialog + form + toast) e de abas `src/components/audiovisual/*Aba.tsx`.

- [ ] **Step 1: Modal de solicitação**

```tsx
// src/components/audiovisual/SolicitarBloqueioModal.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { solicitarBloqueioAction } from "@/lib/audiovisual/bloqueios/actions";

export function SolicitarBloqueioModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState("");
  const [hi, setHi] = useState("");
  const [hf, setHf] = useState("");
  const [motivo, setMotivo] = useState("");

  const valido = data && hi && hf && hf > hi && motivo.trim().length > 0;

  function submit() {
    if (!valido) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("data", data); fd.set("hora_inicio", hi); fd.set("hora_fim", hf); fd.set("motivo", motivo.trim());
      const r = await solicitarBloqueioAction(fd);
      if (r?.error) { toast.error(r.error); return; }
      toast.success("Solicitação enviada pro coordenador");
      setData(""); setHi(""); setHf(""); setMotivo(""); setOpen(false); router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Solicitar bloqueio de agenda</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar bloqueio de agenda</DialogTitle>
            <DialogDescription>Vai pro coordenador audiovisual aprovar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Dia</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div className="flex gap-2">
              <div className="flex-1"><Label>Início</Label><Input type="time" value={hi} onChange={(e) => setHi(e.target.value)} /></div>
              <div className="flex-1"><Label>Fim</Label><Input type="time" value={hf} onChange={(e) => setHf(e.target.value)} /></div>
            </div>
            <div><Label>Motivo</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: consulta médica" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!valido || pending} onClick={submit}>{pending ? "Enviando..." : "Enviar solicitação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Aba "Meus bloqueios" (server component com lista + cancelar)**

```tsx
// src/components/audiovisual/MeusBloqueiosAba.tsx
import { listMeusBloqueios } from "@/lib/audiovisual/bloqueios/queries";
import { SolicitarBloqueioModal } from "./SolicitarBloqueioModal";
import { CancelarBloqueioButton } from "./CancelarBloqueioButton";
import { Card } from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  pendente: "⏳ Pendente", aprovada: "✅ Aprovado", rejeitada: "❌ Recusado",
};
function fmt(d: string) { const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; }

export async function MeusBloqueiosAba({ userId }: { userId: string }) {
  const rows = await listMeusBloqueios(userId);
  return (
    <div className="space-y-4">
      <SolicitarBloqueioModal />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma solicitação ainda.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((b) => (
            <Card key={b.id} className="p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{fmt(b.data)} · {b.hora_inicio.slice(0,5)}–{b.hora_fim.slice(0,5)}</p>
                  <p className="text-muted-foreground">{b.motivo}</p>
                  {b.status === "rejeitada" && b.motivo_recusa && (
                    <p className="mt-1 text-destructive">Motivo da recusa: {b.motivo_recusa}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span>{STATUS_LABEL[b.status]}</span>
                  {b.status === "pendente" && <CancelarBloqueioButton id={b.id} />}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// src/components/audiovisual/CancelarBloqueioButton.tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cancelarBloqueioAction } from "@/lib/audiovisual/bloqueios/actions";

export function CancelarBloqueioButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => start(async () => {
      const r = await cancelarBloqueioAction(id);
      if (r?.error) toast.error(r.error); else { toast.success("Cancelado"); router.refresh(); }
    })}>Cancelar</Button>
  );
}
```

- [ ] **Step 3: Ligar a aba na page**

Em `src/app/(authed)/audiovisual/page.tsx`: adicionar `"meus_bloqueios"` ao `TabKey`, ao `TAB_LABELS` (`"Meus bloqueios"`), e ao `availableTabs` quando `isVideomaker`. Renderizar `<MeusBloqueiosAba userId={user.id} />` quando a tab ativa for essa. Siga exatamente o padrão das abas existentes no arquivo.

- [ ] **Step 4: Type-check + commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(bloqueios): aba do videomaker (solicitar + meus bloqueios)"
```

---

## Task 10: UI — fila de aprovação do coordenador

**Files:**
- Create: `src/components/audiovisual/SolicitacoesBloqueioAba.tsx`
- Create: `src/components/audiovisual/AprovarBloqueioControls.tsx`
- Modify: `src/app/(authed)/audiovisual/page.tsx`

- [ ] **Step 1: Controles de aprovar/recusar (client)**

```tsx
// src/components/audiovisual/AprovarBloqueioControls.tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { aprovarBloqueioAction, rejeitarBloqueioAction } from "@/lib/audiovisual/bloqueios/actions";

export function AprovarBloqueioControls({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");

  function aprovar() {
    start(async () => {
      const r = await aprovarBloqueioAction(id);
      if (r?.error) toast.error(r.error); else { toast.success("Aprovado"); router.refresh(); }
    });
  }
  function recusar() {
    if (!motivo.trim()) { toast.error("Informe o motivo da recusa"); return; }
    start(async () => {
      const fd = new FormData(); fd.set("id", id); fd.set("motivo_recusa", motivo.trim());
      const r = await rejeitarBloqueioAction(fd);
      if (r?.error) toast.error(r.error); else { toast.success("Recusado"); router.refresh(); }
    });
  }

  if (recusando) {
    return (
      <div className="space-y-2">
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo da recusa" />
        <div className="flex gap-2">
          <Button size="sm" variant="destructive" disabled={pending} onClick={recusar}>Confirmar recusa</Button>
          <Button size="sm" variant="ghost" onClick={() => setRecusando(false)}>Voltar</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending} onClick={aprovar}>Aprovar</Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setRecusando(true)}>Recusar</Button>
    </div>
  );
}
```

- [ ] **Step 2: Aba de solicitações (server)**

```tsx
// src/components/audiovisual/SolicitacoesBloqueioAba.tsx
import { listBloqueiosPendentes, listBloqueiosRespondidos } from "@/lib/audiovisual/bloqueios/queries";
import { AprovarBloqueioControls } from "./AprovarBloqueioControls";
import { Card } from "@/components/ui/card";

function fmt(d: string) { const [y, m, dd] = d.split("-"); return `${dd}/${m}/${y}`; }

export async function SolicitacoesBloqueioAba() {
  const [pendentes, respondidos] = await Promise.all([listBloqueiosPendentes(), listBloqueiosRespondidos()]);
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Pendentes</h3>
        {pendentes.length === 0 ? <p className="text-sm text-muted-foreground">Nada pendente.</p> :
          pendentes.map((b) => (
            <Card key={b.id} className="p-3 text-sm">
              <p className="font-medium">{b.criado_por_nome} · {fmt(b.data)} · {b.hora_inicio.slice(0,5)}–{b.hora_fim.slice(0,5)}</p>
              <p className="mb-2 text-muted-foreground">{b.motivo}</p>
              <AprovarBloqueioControls id={b.id} />
            </Card>
          ))}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Histórico</h3>
        {respondidos.map((b) => (
          <Card key={b.id} className="p-2 text-xs text-muted-foreground">
            {b.criado_por_nome} · {fmt(b.data)} · {b.hora_inicio.slice(0,5)}–{b.hora_fim.slice(0,5)} — {b.status}
            {b.status === "rejeitada" && b.motivo_recusa ? ` (${b.motivo_recusa})` : ""}
          </Card>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Ligar a aba na page (só pra gestão)**

Em `src/app/(authed)/audiovisual/page.tsx`: adicionar `"solicitacoes_bloqueio"` ao `TabKey`/`TAB_LABELS` (`"Solicitações de bloqueio"`); incluir em `availableTabs` quando `ROLES_GESTAO.includes(user.role)` (audiovisual_chefe/coordenador/adm/socio); mostrar um badge com `pendentes.length` (opcional, seguindo `pendingCounts`). Renderizar `<SolicitacoesBloqueioAba />`.

- [ ] **Step 4: Type-check + commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(bloqueios): fila de aprovação do coordenador"
```

---

## Task 11: Render "Indisponível" na agenda

**Files:**
- Modify: componentes do calendário interno (localizar) + query de eventos

- [ ] **Step 1: Localizar onde a agenda de videomakers é renderizada**

```bash
grep -rln "sub_calendar\|videomakers\|calendar_events" src/app src/components src/lib/calendario | sort -u
```

- [ ] **Step 2: Buscar bloqueios aprovados do período visível**

Na query que monta a visão do calendário (sub-agenda videomakers), buscar em paralelo os `agenda_bloqueios` com `status='aprovada'` e `data` dentro do range visível, e mapeá-los para "itens" de agenda com rótulo `🔒 Indisponível — {motivo}` (visual distinto de gravação; sem virar `calendar_events`). Reuse `hora_inicio`/`hora_fim` + `criado_por_nome`.

```ts
// exemplo de query auxiliar (ajuste ao formato do módulo)
export async function listBloqueiosAprovadosNoPeriodo(inicio: string, fim: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agenda_bloqueios")
    .select("id, criado_por, criado_por_nome, data, hora_inicio, hora_fim, motivo")
    .eq("status", "aprovada")
    .is("deleted_at", null)
    .gte("data", inicio)
    .lte("data", fim);
  return data ?? [];
}
```

- [ ] **Step 3: Renderizar o marcador**

No componente da grade/lista do calendário, além dos eventos, renderize os bloqueios como blocos "indisponível" no dia/horário do videomaker. Estilo sugerido: borda tracejada + fundo neutro + ícone de cadeado. Siga o design system já usado (Tailwind + `cn`).

- [ ] **Step 4: Type-check + commit**

```bash
npm run typecheck
git add -A
git commit -m "feat(calendario): mostra bloqueios aprovados como Indisponível na agenda"
```

---

## Task 12: Suíte completa + PR

- [ ] **Step 1: Rodar toda a suíte (excluindo worktrees)**

Run: `npx vitest run --exclude '**/.claude/**'`
Expected: todos verdes.

- [ ] **Step 2: Lint + type-check**

Run: `npm run typecheck && npx eslint src/lib/audiovisual/bloqueios src/lib/calendario/bloqueio-check.ts`
Expected: sem erros.

- [ ] **Step 3: Abrir PR**

```bash
git push -u origin feat/bloqueio-agenda-videomaker
gh pr create --base main --title "feat(audiovisual): solicitação de bloqueio de agenda do videomaker" --body "..."
```

Corpo do PR: resumir a feature; **destacar que 2 migrations precisam de apply manual** no SQL Editor após o merge (`20260709000100_notification_event_bloqueio_agenda.sql` PRIMEIRO, depois `20260709000200_agenda_bloqueios.sql`), e que o `database.ts` já foi atualizado no PR.

- [ ] **Step 4: CI verde → merge**

Esperar `ci.yml` verde → `gh pr merge --squash --delete-branch`. Depois aplicar as migrations manualmente (ordem acima).

---

## Self-Review (cobertura do spec)

- ✅ Tabela `agenda_bloqueios` + RLS → Task 2
- ✅ Formato 1 dia + faixa de horário → schema Task 3, tabela Task 2
- ✅ solicitar/aprovar/rejeitar/cancelar → Task 6
- ✅ Notificações (solicitado/respondido) → Task 1 (enum) + Task 6 (dispatch)
- ✅ Impede delegar com "confirmar mesmo assim" → Task 4 (colisão) + Task 7 (validate) + Task 8 (UI override)
- ✅ Aparece na agenda como Indisponível → Task 11
- ✅ UI videomaker → Task 9; UI coordenador → Task 10
- ✅ Aprovador audiovisual_chefe + adm/socio → Task 6 (`ROLES_APROVAM`) + RLS Task 2
- ✅ Não-objetivos (dia-inteiro, multi-dia, retroativo) respeitados

**Pontos que exigem leitura de código na hora (não são placeholders — são integrações a confirmar):**
- Nome exato dos campos de data/hora no form de evento do calendário (Task 7 Step 5, Task 8).
- Assinatura real de `logAudit` (Task 6 Step 3).
- Estrutura exata de tabs em `/audiovisual/page.tsx` (Tasks 9–10).
- Componente do calendário que renderiza a sub-agenda videomakers (Task 11).
