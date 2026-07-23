# Reunião obrigatória — Fatia A (cliente obrigatório + marcar evento) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Ao marcar reunião nas agendas Assessores/Coordenadores/Comercial, o evento passa a ser "reunião a gravar" (`requer_gravacao`), e cliente vira obrigatório em Assessores/Coordenadores.

**Architecture:** Coluna nova em `calendar_events` (+ colunas já prontas pras Fatias B/C). Helper puro decide `requerGravacao`/`clienteObrigatorio` por sub_calendar. `createEventSchema`/`editEventSchema` ganham refine exigindo cliente; as actions gravam `requer_gravacao`. Sem notificações ainda (Fatia B).

**Tech Stack:** Supabase (migration manual), Zod, Next.js server actions, vitest.

---

## File Structure
- Create: `supabase/migrations/20260723100000_calendar_events_gravacao.sql` — colunas + índice.
- Create: `src/lib/calendario/reuniao-gravacao.ts` — helper puro.
- Create: `src/lib/calendario/reuniao-gravacao.test.ts` — testes.
- Modify: `src/lib/calendario/schema.ts` — refine cliente obrigatório.
- Create: `src/lib/calendario/schema.test.ts` — testa o refine.
- Modify: `src/lib/calendario/actions.ts` — grava `requer_gravacao` no create e no edit.

---

### Task 1: Migration (colunas de gravação no evento)

**Files:** Create `supabase/migrations/20260723100000_calendar_events_gravacao.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260723100000_calendar_events_gravacao.sql
--
-- "Reunião obrigatória + trava pra gravar": liga o evento da agenda ao módulo
-- Reuniões. Aplicação MANUAL no SQL Editor. (meetings já existe.)

alter table public.calendar_events
  add column if not exists requer_gravacao boolean not null default false,
  add column if not exists gravacao_status text not null default 'pendente',
  add column if not exists gravacao_meeting_id uuid references public.meetings(id) on delete set null,
  add column if not exists gravacao_motivo text,           -- cancelada | remarcada | nao_vou_gravar
  add column if not exists gravacao_justificativa text,
  add column if not exists gravacao_resolvido_em timestamptz,
  add column if not exists lembrete_gravar_criacao_em timestamptz,
  add column if not exists lembrete_gravar_10min_em timestamptz,
  add column if not exists lembrete_gravar_inicio_em timestamptz;

-- Índice pra query da "trava" (minhas reuniões pendentes que já começaram).
create index if not exists idx_calendar_events_gravacao_pendente
  on public.calendar_events (criado_por, inicio)
  where requer_gravacao and gravacao_status = 'pendente';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260723100000_calendar_events_gravacao.sql
git commit -m "feat(reunioes): colunas de gravação em calendar_events"
```

---

### Task 2: Helper puro (quem grava / cliente obrigatório) — TDD

**Files:** Create `src/lib/calendario/reuniao-gravacao.ts` + `.test.ts`

- [ ] **Step 1: Teste**

```ts
// src/lib/calendario/reuniao-gravacao.test.ts
import { describe, it, expect } from "vitest";
import { requerGravacao, clienteObrigatorio } from "./reuniao-gravacao";

describe("requerGravacao", () => {
  it("true pra assessores/coordenadores/comercial quando manual", () => {
    for (const s of ["assessores", "coordenadores", "comercial"]) {
      expect(requerGravacao(s, "manual")).toBe(true);
    }
  });
  it("false pra agência/onboarding/programacao/videomakers", () => {
    for (const s of ["agencia", "onboarding", "programacao", "videomakers"]) {
      expect(requerGravacao(s, "manual")).toBe(false);
    }
  });
  it("false quando origem não é manual", () => {
    expect(requerGravacao("assessores", "lead_prospeccao")).toBe(false);
  });
});

describe("clienteObrigatorio", () => {
  it("true pra assessores e coordenadores", () => {
    expect(clienteObrigatorio("assessores")).toBe(true);
    expect(clienteObrigatorio("coordenadores")).toBe(true);
  });
  it("false pra comercial (reunião sem cliente)", () => {
    expect(clienteObrigatorio("comercial")).toBe(false);
  });
  it("false pra agência", () => {
    expect(clienteObrigatorio("agencia")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e falhar** — `npx vitest run src/lib/calendario/reuniao-gravacao.test.ts --exclude '**/.claude/**'`

- [ ] **Step 3: Implementar**

```ts
// src/lib/calendario/reuniao-gravacao.ts
// Fonte única: quais agendas são "reunião a gravar" e onde cliente é obrigatório.

/** Agendas que disparam gravação + trava. */
export const AGENDAS_GRAVAR = ["assessores", "coordenadores", "comercial"] as const;
/** Agendas onde selecionar cliente é obrigatório (comercial é sem cliente). */
export const AGENDAS_CLIENTE_OBRIGATORIO = ["assessores", "coordenadores"] as const;

export function requerGravacao(subCalendar: string, origem: string = "manual"): boolean {
  return origem === "manual" && (AGENDAS_GRAVAR as readonly string[]).includes(subCalendar);
}

export function clienteObrigatorio(subCalendar: string): boolean {
  return (AGENDAS_CLIENTE_OBRIGATORIO as readonly string[]).includes(subCalendar);
}
```

- [ ] **Step 4: Rodar e passar.**
- [ ] **Step 5: Commit** — `feat(reunioes): helper requerGravacao/clienteObrigatorio`

---

### Task 3: Refine no schema (cliente obrigatório) — TDD

**Files:** Modify `src/lib/calendario/schema.ts` + Create `src/lib/calendario/schema.test.ts`

- [ ] **Step 1: Teste**

```ts
// src/lib/calendario/schema.test.ts
import { describe, it, expect } from "vitest";
import { createEventSchema } from "./schema";

const base = {
  titulo: "Reunião X",
  inicio: "2026-07-25T14:00",
  fim: "2026-07-25T15:00",
  participantes_ids: [],
};

describe("createEventSchema — cliente obrigatório", () => {
  it("rejeita assessores sem cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "assessores" });
    expect(r.success).toBe(false);
  });
  it("aceita assessores com cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "assessores", client_id: "11111111-1111-1111-1111-111111111111" });
    expect(r.success).toBe(true);
  });
  it("aceita comercial sem cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "comercial" });
    expect(r.success).toBe(true);
  });
  it("aceita agência sem cliente", () => {
    const r = createEventSchema.safeParse({ ...base, sub_calendar: "agencia" });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e falhar** — `npx vitest run src/lib/calendario/schema.test.ts --exclude '**/.claude/**'`

- [ ] **Step 3: Implementar** — em `src/lib/calendario/schema.ts`:

Adicionar o import no topo:
```ts
import { clienteObrigatorio } from "./reuniao-gravacao";
```

Trocar as duas linhas de export dos schemas:
```ts
export const createEventSchema = z.object(baseEventFields);
export const editEventSchema = z.object({ ...baseEventFields, id: z.string().uuid() });
```
por (com o refine compartilhado):
```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function refineClienteObrigatorio(data: any, ctx: z.RefinementCtx) {
  if (clienteObrigatorio(data.sub_calendar) && !data.client_id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["client_id"], message: "Selecione o cliente desta reunião" });
  }
}

export const createEventSchema = z.object(baseEventFields).superRefine(refineClienteObrigatorio);
export const editEventSchema = z.object({ ...baseEventFields, id: z.string().uuid() }).superRefine(refineClienteObrigatorio);
```

- [ ] **Step 4: Rodar e passar.**
- [ ] **Step 5: Type-check** — `npx tsc --noEmit 2>&1 | grep -i calendario` limpo (os tipos `CreateEventInput`/`EditEventInput` via `z.infer` continuam válidos com superRefine).
- [ ] **Step 6: Commit** — `feat(reunioes): cliente obrigatório em reunião de assessor/coord`

---

### Task 4: Actions gravam `requer_gravacao`

**Files:** Modify `src/lib/calendario/actions.ts`

- [ ] **Step 1:** Adicionar o import (junto aos outros de calendario):

```ts
import { requerGravacao } from "./reuniao-gravacao";
```

- [ ] **Step 2:** No `createEventAction`, no objeto que é inserido em `calendar_events` (o payload `semAvulso` / o `.insert(...)` por volta da linha 400), incluir o campo:

```ts
      requer_gravacao: requerGravacao(parsed.data.sub_calendar, "manual"),
```

LEIA o trecho do insert antes de editar. O payload é montado a partir de `parsed.data`; adicione a chave `requer_gravacao` nele (mesmo nível de `client_id`, `sub_calendar`). Se o insert usa um objeto intermediário (ex.: `semAvulso`), adicione lá.

- [ ] **Step 3:** No `editEventAction` (update), recalcular `requer_gravacao` a partir do novo `sub_calendar` e incluir no payload de update. LEIA o update; adicione:

```ts
      requer_gravacao: requerGravacao(parsed.data.sub_calendar, "manual"),
```

(Não mexa em `gravacao_status` no edit — quem resolve isso é a Fatia C.)

- [ ] **Step 4: Type-check** — `npx tsc --noEmit 2>&1 | grep -i calendario` limpo.
- [ ] **Step 5: Commit** — `feat(reunioes): eventos de reunião marcam requer_gravacao`

---

### Task 5: Marcar cliente como obrigatório no formulário (UI leve)

**Files:** Modify `src/components/calendario/EventForm.tsx`

- [ ] **Step 1:** LEIA o `EventForm.tsx` pra achar (a) o state do `sub_calendar` selecionado e (b) o campo de seleção de cliente. Adicionar:
  - Import: `import { clienteObrigatorio } from "@/lib/calendario/reuniao-gravacao";`
  - Uma const derivada do sub selecionado: `const clienteReq = clienteObrigatorio(subSelecionado);` (usar o nome real do state do sub).
  - No rótulo do campo de cliente, quando `clienteReq`, mostrar um asterisco/indicação "obrigatório" (ex.: `Cliente {clienteReq && <span className="text-red-500">*</span>}`).
  - Best-effort: se o form já tem `required` nativo em inputs, adicionar `required={clienteReq}` no seletor de cliente. NÃO refatore o form; só o mínimo. A validação autoritativa é a do servidor (Task 3), então se algo no form for complexo, apenas o asterisco já basta.

- [ ] **Step 2: Type-check + lint** — `npx tsc --noEmit 2>&1 | grep -i EventForm` e `npx eslint src/components/calendario/EventForm.tsx` limpos.
- [ ] **Step 3: Commit** — `feat(reunioes): marca cliente obrigatório no formulário de evento`

---

### Task 6: Verificação final + PR

- [ ] **Step 1:** `npx vitest run src/lib/calendario --exclude '**/.claude/**'` → PASS.
- [ ] **Step 2:** `npx tsc --noEmit` (limpo) + `npx eslint src/lib/calendario src/components/calendario/EventForm.tsx`.
- [ ] **Step 3:** Push + PR. Corpo: explica que é a Fatia A (base), lista a **migration manual** `20260723100000_calendar_events_gravacao.sql`, e nota que notificações (Fatia B) e trava (Fatia C) vêm depois.
- [ ] **Step 4:** CI verde → merge (squash + delete-branch).

---

## Self-review (feito)
- **Cobertura (Fatia A do spec):** cliente obrigatório em assessores/coord ✅ (Task 3/5); comercial sem cliente ✅ (helper); evento marca requer_gravacao ✅ (Task 4); colunas pras Fatias B/C já criadas ✅ (Task 1). Notificação ao criar foi movida pra Fatia B (evita puxar o sistema de regras de notificação pra cá) — anotado.
- **Sem placeholders:** código completo; Task 4/5 pedem leitura do arquivo antes de editar (payload/estado com nome real), com o campo exato a inserir.
- **Consistência:** `requerGravacao(sub, origem)` e `clienteObrigatorio(sub)` usados igual em schema/actions/form; colunas batem com o que a Fatia C vai consumir (`requer_gravacao`, `gravacao_status='pendente'`).
- **Risco:** o insert/update do `createEventAction` tem payload próprio — a task manda LER antes de inserir a chave, evitando adivinhação.
