# Freela na agenda de quem pegou — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando alguém do time pega uma oportunidade do FreelaYide com data+hora definida, ela vira um bloco reservado na agenda dessa pessoa (visual próprio "Freela — reservado") e ela recebe uma notificação in-app confirmando a reserva.

**Architecture:** Adiciona `data_hora`+`duracao_min` estruturados na oportunidade. Segue o padrão já existente do **bloqueio de agenda**: uma query própria via service-role (fora do `unstable_cache`, escopada ao usuário logado) buscada em paralelo na página do calendário e mesclada com os demais eventos. Um ramo visual dedicado em `EventCell` (week) e `MonthView` (month) renderiza o bloco, análogo ao ramo `event.bloqueio`. A notificação reusa `dispatchNotification` com um evento novo `freela_reservada`.

**Tech Stack:** Next.js (App Router, RSC), Supabase (Postgres + RLS), TypeScript, Vitest, TailwindCSS, lucide-react.

**Convenções do projeto (ler antes):**
- Migrations são **manuais** (Vercel não roda no deploy). Aplicar via SQL Editor após merge.
- Fuso da app = Cuiabá (UTC-4, sem DST). Converter `datetime-local` ↔ UTC com `brtInputToUtcIso` / `utcIsoToBrtInputValue` (`src/lib/calendario/timezone.ts`).
- Dentro de `unstable_cache` só pode rodar service-role. A query nova NÃO entra no cache — é buscada à parte na página (igual ao bloqueio).
- Texto de UI **sem emoji e sem en-dash** (usar hífen normal / "—" só onde o código já usa).
- Comandos: `npm test`, `npm run typecheck`, `npm run lint`. Path alias `@/` → `src/`.

---

## File Structure

- **Modify** `supabase/migrations/` — 3 migrations novas (colunas; enum value; seed da rule).
- **Modify** `src/lib/freela-yide/schema.ts` — campos `data_hora` + `duracao_min` no schema.
- **Modify** `src/lib/freela-yide/actions.ts` — persistir os campos em criar/editar; disparar notificação em `pegar`.
- **Modify** `src/lib/freela-yide/queries.ts` — `OportunidadeRow`/`SELECT`/`mapRow` ganham os campos.
- **Modify** `src/components/freela-yide/OportunidadeFormFields.tsx` — inputs data+hora e duração.
- **Modify** `src/lib/calendario/schema.ts` — `CalendarEvent.origem` ganha `"freela"` + campo opcional `freela`.
- **Create** `src/lib/calendario/freela-events.ts` — mapper puro `freelaRowsToEvents` (testável).
- **Create** `tests/unit/calendario-freela-events.test.ts` — testes do mapper.
- **Modify** `src/lib/calendario/queries.ts` — `listMeusFreelasNoPeriodo` (query via service-role, fora do cache).
- **Modify** `src/components/calendario/EventCell.tsx` — ramo visual `event.freela` (week).
- **Modify** `src/components/calendario/MonthView.tsx` — ramo visual `e.freela` (month).
- **Modify** `src/app/(authed)/calendario/page.tsx` — merge dos freelas + passar `userId` pra render.
- **Modify** `src/types/database.ts` — valor `freela_reservada` no enum `notification_event` (union + Constants).

---

## Task 1: Migration — `data_hora` + `duracao_min`

**Files:**
- Create: `supabase/migrations/20260717000000_freelayide_data_hora.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/20260717000000_freelayide_data_hora.sql
-- Data+hora estruturada da oportunidade, pra reservar o slot na agenda de
-- quem pegou. `horario` (texto livre) fica mantido por compatibilidade.
alter table public.freela_oportunidades
  add column if not exists data_hora   timestamptz,
  add column if not exists duracao_min integer not null default 60;

-- Query da agenda busca por dono + janela de tempo.
create index if not exists freela_op_agenda_idx
  on public.freela_oportunidades (pego_por, data_hora)
  where data_hora is not null and deleted_at is null;
```

- [ ] **Step 2: Commit** (migration é aplicada manualmente depois; não roda em teste)

```bash
git add supabase/migrations/20260717000000_freelayide_data_hora.sql
git commit -m "feat(freela): coluna data_hora + duracao_min na oportunidade"
```

---

## Task 2: Schema + form + persistência dos campos

**Files:**
- Modify: `src/lib/freela-yide/schema.ts`
- Modify: `src/lib/freela-yide/actions.ts`
- Modify: `src/lib/freela-yide/queries.ts`
- Modify: `src/components/freela-yide/OportunidadeFormFields.tsx`

- [ ] **Step 1: Adicionar campos ao schema**

Em `src/lib/freela-yide/schema.ts`, dentro de `criarOportunidadeSchema`, adicionar (logo após a linha `horario: ...`):

```ts
    data_hora: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, "Data/hora inválida")
      .optional()
      .nullable(),
    duracao_min: z.coerce.number().int().min(15).max(600).default(60),
```

- [ ] **Step 2: Persistir no criar**

Em `src/lib/freela-yide/actions.ts`, dentro de `criarOportunidadeAction`, no objeto passado a `safeParse`, adicionar (após `horario:`):

```ts
    data_hora: fd(formData, "data_hora"),
    duracao_min: fd(formData, "duracao_min") ?? 60,
```

E no `.insert({ ... })`, adicionar (após `horario: parsed.data.horario,`):

```ts
    data_hora: parsed.data.data_hora ? brtInputToUtcIso(parsed.data.data_hora) : null,
    duracao_min: parsed.data.duracao_min,
```

- [ ] **Step 3: Persistir no editar**

Em `editarOportunidadeAction`, no `safeParse` adicionar as mesmas 2 linhas do Step 2 (`data_hora` e `duracao_min`), e no `.update({ ... })` adicionar (após `horario: parsed.data.horario,`):

```ts
      data_hora: parsed.data.data_hora ? brtInputToUtcIso(parsed.data.data_hora) : null,
      duracao_min: parsed.data.duracao_min,
```

- [ ] **Step 4: Expor no OportunidadeRow / SELECT / mapRow**

Em `src/lib/freela-yide/queries.ts`:

Na interface `OportunidadeRow`, após `horario: string | null;` adicionar:

```ts
  data_hora: string | null;
  duracao_min: number;
```

Na const `SELECT`, incluir os campos (adicionar `data_hora, duracao_min` logo após `horario,`):

```ts
const SELECT =
  "id, titulo, descricao, cliente_nome, contato, horario, data_hora, duracao_min, valor_comissao, status, tipo, entrega_urgente, prazo_entrega, pego_por, pego_em, negociacao_em, fechada_em, created_at, responsavel:profiles!freela_oportunidades_pego_por_fkey(nome)";
```

Em `mapRow`, dentro do objeto `base`, após `horario: ...` adicionar:

```ts
    data_hora: (row.data_hora as string | null) ?? null,
    duracao_min: Number(row.duracao_min ?? 60),
```

- [ ] **Step 5: Adicionar inputs no form**

Em `src/components/freela-yide/OportunidadeFormFields.tsx`, importar o helper no topo (já existe `utcIsoToBrtInputValue` importado). Adicionar uma const perto de `prazoDefault`:

```tsx
  const dataHoraDefault = op?.data_hora ? utcIsoToBrtInputValue(op.data_hora) : "";
```

E logo abaixo do bloco do campo `horario` (o `<div>` com `id="horario"`), inserir:

```tsx
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="data_hora">Data e hora (agenda)</Label>
          <Input id="data_hora" name="data_hora" type="datetime-local" defaultValue={dataHoraDefault} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="duracao_min">Duração (min)</Label>
          <Input id="duracao_min" name="duracao_min" type="number" min={15} max={600} step={15} defaultValue={op?.duracao_min ?? 60} />
        </div>
      </div>
```

- [ ] **Step 6: Verificar type-check**

Run: `npm run typecheck`
Expected: PASS (sem erros).

- [ ] **Step 7: Commit**

```bash
git add src/lib/freela-yide/schema.ts src/lib/freela-yide/actions.ts src/lib/freela-yide/queries.ts src/components/freela-yide/OportunidadeFormFields.tsx
git commit -m "feat(freela): campo data+hora e duracao no form/schema/actions"
```

---

## Task 3: `CalendarEvent` ganha origem "freela" + campo `freela`

**Files:**
- Modify: `src/lib/calendario/schema.ts`

- [ ] **Step 1: Estender a interface CalendarEvent**

Em `src/lib/calendario/schema.ts`, no tipo `CalendarEvent`:

Alterar a linha `origem` para incluir `"freela"`:

```ts
  origem: "manual" | "lead_prospeccao" | "lead_marco_zero" | "client_birthday" | "colab_birthday" | "client_date" | "bloqueio_agenda" | "freela";
```

E adicionar, logo após o campo `bloqueio?: {...}` (antes do fechamento da interface), o campo:

```ts
  /** Oportunidade do FreelaYide reservada na agenda de quem pegou. Read-only,
   * renderizado por ramo dedicado no EventCell/MonthView (cor esmeralda). */
  freela?: {
    /** disponivel|pega|em_negociacao|fechada|perdida (string livre pra não
     * acoplar o tipo do calendário ao do FreelaYide). */
    status: string;
    /** captacao|modelo|edicao. */
    tipo: string;
    valor_comissao: number;
    /** true = edição urgente (mostra pontinho laranja). */
    urgente: boolean;
  };
```

- [ ] **Step 2: Verificar type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calendario/schema.ts
git commit -m "feat(calendario): tipo CalendarEvent suporta evento de freela"
```

---

## Task 4: Mapper puro `freelaRowsToEvents` (TDD)

**Files:**
- Create: `src/lib/calendario/freela-events.ts`
- Test: `tests/unit/calendario-freela-events.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/unit/calendario-freela-events.test.ts
import { describe, it, expect } from "vitest";
import { freelaRowsToEvents, type FreelaAgendaRow } from "@/lib/calendario/freela-events";

const OWNER = "11111111-1111-1111-1111-111111111111";

function row(overrides: Partial<FreelaAgendaRow> = {}): FreelaAgendaRow {
  return {
    id: "aaaa",
    titulo: "Captação Loja X",
    data_hora: "2026-07-20T17:00:00.000Z", // 13:00 Cuiabá
    duracao_min: 90,
    status: "pega",
    tipo: "captacao",
    valor_comissao: 600,
    entrega_urgente: false,
    ...overrides,
  };
}

describe("freelaRowsToEvents", () => {
  it("mapeia uma oportunidade pega para CalendarEvent com origem freela", () => {
    const [e] = freelaRowsToEvents([row()], OWNER);
    expect(e.id).toBe("freela-aaaa");
    expect(e.origem).toBe("freela");
    expect(e.titulo).toBe("Captação Loja X");
    expect(e.link).toBe("/freela-yide");
    expect(e.inicio).toBe("2026-07-20T17:00:00.000Z");
    // fim = inicio + 90min
    expect(e.fim).toBe("2026-07-20T18:30:00.000Z");
    expect(e.participantes_ids).toEqual([OWNER]);
    expect(e.freela).toEqual({ status: "pega", tipo: "captacao", valor_comissao: 600, urgente: false });
  });

  it("marca urgente quando entrega_urgente=true", () => {
    const [e] = freelaRowsToEvents([row({ entrega_urgente: true, tipo: "edicao" })], OWNER);
    expect(e.freela?.urgente).toBe(true);
  });

  it("ignora linhas sem data_hora", () => {
    expect(freelaRowsToEvents([row({ data_hora: null })], OWNER)).toEqual([]);
  });

  it("usa duração default de 60min quando duracao_min inválida (0)", () => {
    const [e] = freelaRowsToEvents([row({ data_hora: "2026-07-20T17:00:00.000Z", duracao_min: 0 })], OWNER);
    expect(e.fim).toBe("2026-07-20T18:00:00.000Z");
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npm test -- calendario-freela-events`
Expected: FAIL (módulo `@/lib/calendario/freela-events` não existe).

- [ ] **Step 3: Implementar o mapper**

```ts
// src/lib/calendario/freela-events.ts
// Mapper puro: linha de freela_oportunidades -> CalendarEvent, pra a agenda de
// quem pegou. Sem IO (testável). A query fica em queries.ts.
import type { CalendarEvent } from "./schema";

export interface FreelaAgendaRow {
  id: string;
  titulo: string;
  data_hora: string | null;
  duracao_min: number;
  status: string;
  tipo: string;
  valor_comissao: number;
  entrega_urgente: boolean;
}

/**
 * Converte oportunidades pegas (com data_hora) em eventos de calendário.
 * `ownerId` entra em participantes_ids pra o filtro "meus" da agenda pegar.
 * Linhas sem data_hora são ignoradas (não há slot pra reservar).
 */
export function freelaRowsToEvents(rows: FreelaAgendaRow[], ownerId: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const r of rows) {
    if (!r.data_hora) continue;
    const dur = r.duracao_min && r.duracao_min > 0 ? r.duracao_min : 60;
    const inicio = new Date(r.data_hora);
    const fim = new Date(inicio.getTime() + dur * 60_000);
    out.push({
      id: `freela-${r.id}`,
      origem: "freela",
      titulo: r.titulo,
      descricao: null,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      // sub_calendar audiovisual só pra satisfazer o tipo fechado; a cor vem do
      // ramo `event.freela` no EventCell/MonthView, não do sub_calendar.
      sub_calendar: "videomakers",
      participantes_ids: [ownerId],
      link: "/freela-yide",
      freela: {
        status: r.status,
        tipo: r.tipo,
        valor_comissao: r.valor_comissao,
        urgente: !!r.entrega_urgente,
      },
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- calendario-freela-events`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendario/freela-events.ts tests/unit/calendario-freela-events.test.ts
git commit -m "feat(calendario): mapper freelaRowsToEvents + testes"
```

---

## Task 5: Query `listMeusFreelasNoPeriodo`

**Files:**
- Modify: `src/lib/calendario/queries.ts`

- [ ] **Step 1: Adicionar a query (via service-role, fora do unstable_cache)**

Em `src/lib/calendario/queries.ts`, adicionar após a função `listBloqueiosAprovadosNoPeriodo` (importar o tipo no topo do arquivo: `import type { FreelaAgendaRow } from "./freela-events";`):

```ts
/**
 * Oportunidades do FreelaYide que o usuário pegou e têm data_hora dentro do
 * intervalo [inicioIso, fimIso). Escopo por usuário de propósito: cada pessoa
 * só vê os próprios freelas na agenda. Fora do unstable_cache (seria per-user)
 * — mesmo tratamento dos bloqueios. Ignora disponivel/perdida.
 */
export async function listMeusFreelasNoPeriodo(
  userId: string,
  inicioIso: string,
  fimIso: string,
): Promise<FreelaAgendaRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("freela_oportunidades")
    .select("id, titulo, data_hora, duracao_min, status, tipo, valor_comissao, entrega_urgente")
    .eq("pego_por", userId)
    .not("data_hora", "is", null)
    .gte("data_hora", inicioIso)
    .lt("data_hora", fimIso)
    .in("status", ["pega", "em_negociacao", "fechada"])
    .is("deleted_at", null);
  if (error) {
    console.error("[calendario] freelas do usuário fetch failed:", error);
    return [];
  }
  return (data ?? []) as FreelaAgendaRow[];
}
```

- [ ] **Step 2: Verificar type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/calendario/queries.ts
git commit -m "feat(calendario): query listMeusFreelasNoPeriodo"
```

---

## Task 6: Ramo visual do freela no `EventCell` (week)

**Files:**
- Modify: `src/components/calendario/EventCell.tsx`

- [ ] **Step 1: Importar o ícone**

Na linha de import do lucide-react, adicionar `Briefcase`:

```tsx
import { Video, User, UserPlus, Lock, Briefcase } from "lucide-react";
```

- [ ] **Step 2: Adicionar o ramo `event.freela`**

Logo após o bloco `if (event.bloqueio) { ... }` (antes de `const isVm = ...`), inserir:

```tsx
  // Freela reservado: bloco esmeralda com ícone Briefcase. Read-only pro slot
  // (link leva pro /freela-yide). Distinto de gravação (fuchsia) e bloqueio
  // (cinza tracejado). Sem emoji.
  if (event.freela) {
    const inner = (
      <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-100 p-2 text-xs leading-tight text-emerald-950 shadow-sm ring-1 ring-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-100 sm:p-1.5 sm:text-[11px]">
        <div className="flex items-center gap-1 truncate font-semibold">
          <Briefcase className="h-3.5 w-3.5 flex-shrink-0 sm:h-3 sm:w-3" />
          {event.freela.urgente && (
            <span className="mr-1 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-orange-500" title="Entrega urgente" />
          )}
          <span className="truncate">Freela — reservado</span>
        </div>
        <div className="opacity-80">
          {formatBrtTime(event.inicio)} · {event.titulo}
        </div>
      </div>
    );
    return event.link ? <Link href={event.link}>{inner}</Link> : inner;
  }
```

- [ ] **Step 3: Verificar type-check + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendario/EventCell.tsx
git commit -m "feat(calendario): visual de freela reservado na week view"
```

---

## Task 7: Ramo visual do freela no `MonthView` (month)

**Files:**
- Modify: `src/components/calendario/MonthView.tsx`

- [ ] **Step 1: Importar o ícone**

Alterar o import do lucide-react:

```tsx
import { Video, Lock, Briefcase } from "lucide-react";
```

- [ ] **Step 2: Adicionar o ramo `e.freela`**

Dentro de `dayEvents.slice(0, MAX_PER_CELL).map((e) => { ... })`, logo após o bloco `if (e.bloqueio) { ... }`, inserir:

```tsx
                  if (e.freela) {
                    const inner = (
                      <div
                        className="flex items-center gap-1 rounded border-l-2 border-emerald-500 bg-emerald-500/80 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-white"
                        title={`${formatBrtTime(e.inicio)} · Freela: ${e.titulo}`}
                      >
                        <Briefcase className="h-2.5 w-2.5 flex-shrink-0" />
                        {e.freela.urgente && (
                          <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-300" />
                        )}
                        <span className="tabular-nums opacity-90">{formatBrtTime(e.inicio)}</span>
                        <span className="truncate">{e.titulo}</span>
                      </div>
                    );
                    return e.link ? (
                      <Link key={e.id} href={e.link} className="block">
                        {inner}
                      </Link>
                    ) : (
                      <div key={e.id}>{inner}</div>
                    );
                  }
```

- [ ] **Step 3: Verificar type-check + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/calendario/MonthView.tsx
git commit -m "feat(calendario): visual de freela reservado na month view"
```

---

## Task 8: Mesclar freelas na página do calendário

**Files:**
- Modify: `src/app/(authed)/calendario/page.tsx`

- [ ] **Step 1: Importar a query e o mapper**

No import de `@/lib/calendario/queries`, adicionar `listMeusFreelasNoPeriodo`:

```tsx
import {
  listEventsForWeek,
  listBloqueiosAprovadosNoPeriodo,
  listMeusFreelasNoPeriodo,
  getWeekRange,
  getMonthGridRange,
} from "@/lib/calendario/queries";
```

E adicionar um import novo:

```tsx
import { freelaRowsToEvents } from "@/lib/calendario/freela-events";
```

- [ ] **Step 2: Passar `userId` pra renderWeek/renderMonth**

Em `CalendarioPage`, nas duas chamadas finais, adicionar `userId: user.id`:

```tsx
  if (view === "month") {
    return renderMonth({ params, subQuery, sub, applySubFilter, unitClientIds, unitProfileIds, userId: user.id });
  }
  return renderWeek({ params, subQuery, sub, applySubFilter, unitClientIds, unitProfileIds, userId: user.id });
```

- [ ] **Step 3: Aceitar e usar `userId` em renderWeek**

Na assinatura de `renderWeek`, adicionar ao tipo do parâmetro `userId: string;` e ao destructuring `userId`. Trocar o bloco `const [rawEvents, bloqueios] = await Promise.all([...])` e o `const events = ...` por:

```tsx
  const [rawEvents, bloqueios, freelas] = await Promise.all([
    listEventsForWeek(start, end, unitClientIds, unitProfileIds),
    listBloqueiosAprovadosNoPeriodo(
      start.toISOString().slice(0, 10),
      new Date(end.getTime() - 1).toISOString().slice(0, 10),
      unitProfileIds,
    ),
    listMeusFreelasNoPeriodo(userId, start.toISOString(), end.toISOString()),
  ]);
  const events = applySubFilter([
    ...rawEvents,
    ...bloqueiosToEvents(bloqueios),
    ...freelaRowsToEvents(freelas, userId),
  ]);
```

- [ ] **Step 4: Aceitar e usar `userId` em renderMonth**

Na assinatura de `renderMonth`, adicionar `userId: string;` ao tipo e `userId` ao destructuring. Trocar o `Promise.all` e o `const events = ...` por:

```tsx
  const [rawEvents, bloqueios, freelas] = await Promise.all([
    listEventsForWeek(grid.start, grid.end, unitClientIds, unitProfileIds),
    listBloqueiosAprovadosNoPeriodo(
      grid.start.toISOString().slice(0, 10),
      new Date(grid.end.getTime() - 1).toISOString().slice(0, 10),
      unitProfileIds,
    ),
    listMeusFreelasNoPeriodo(userId, grid.start.toISOString(), grid.end.toISOString()),
  ]);
  const events = applySubFilter([
    ...rawEvents,
    ...bloqueiosToEvents(bloqueios),
    ...freelaRowsToEvents(freelas, userId),
  ]);
```

- [ ] **Step 5: Verificar type-check + lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(authed)/calendario/page.tsx"
git commit -m "feat(calendario): mescla freelas reservados na agenda de quem pegou"
```

---

## Task 9: Notificação `freela_reservada`

**Files:**
- Create: `supabase/migrations/20260717000100_notification_event_freela_reservada.sql`
- Create: `supabase/migrations/20260717000200_notification_rules_freela_reservada_seed.sql`
- Modify: `src/types/database.ts`
- Modify: `src/lib/freela-yide/actions.ts`

- [ ] **Step 1: Migration do valor do enum**

```sql
-- supabase/migrations/20260717000100_notification_event_freela_reservada.sql
-- Novo evento: pessoa reservou um freela na própria agenda.
alter type public.notification_event add value if not exists 'freela_reservada';
```

- [ ] **Step 2: Migration do seed da rule**

```sql
-- supabase/migrations/20260717000200_notification_rules_freela_reservada_seed.sql
-- Rule do evento freela_reservada: notificação in-app pro próprio ator (via
-- user_ids_extras). Sem roles default, sem e-mail.
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'freela_reservada', true, false, false,
  true, ARRAY[]::text[], ARRAY[]::uuid[]
) on conflict (evento_tipo) do nothing;
```

- [ ] **Step 3: Adicionar o valor ao enum nos tipos TS**

Em `src/types/database.ts`, no **union** do enum `notification_event` (perto da linha com `"freela_nova_oportunidade"`), adicionar logo após ela:

```ts
        | "freela_reservada"
```

E no array **Constants** `notification_event: [ ... ]` (perto da linha ~3006, também com `"freela_nova_oportunidade"`), adicionar `"freela_reservada",` na lista.

- [ ] **Step 4: Disparar no `pegarOportunidadeAction`**

Em `src/lib/freela-yide/actions.ts`:

Adicionar ao import de timezone os formatadores (a linha atual importa `brtInputToUtcIso`):

```ts
import { brtInputToUtcIso, formatBrtDate, formatBrtTime } from "@/lib/calendario/timezone";
```

Na função `pegarOportunidadeAction`, trocar o select inicial pra trazer `titulo` e `data_hora`:

```ts
  const { data: op } = await sb.from("freela_oportunidades").select("status, pego_por, titulo, data_hora").eq("id", id).single();
```

E logo antes de `revalidatePath("/freela-yide");` (após confirmar `upd.length > 0`), inserir:

```ts
  // Confirma pra própria pessoa que o horário foi reservado na agenda dela.
  // Só quando há data_hora (sem horário não há slot). Best-effort.
  if (op.data_hora) {
    try {
      await dispatchNotification({
        evento_tipo: "freela_reservada",
        titulo: `Você reservou: ${op.titulo}`,
        mensagem: `Reservado na sua agenda para ${formatBrtDate(op.data_hora)} às ${formatBrtTime(op.data_hora)}. Abra o calendário.`,
        link: "/calendario",
        user_ids_extras: [actor.id],
      });
    } catch (e) {
      console.error("[freelayide] dispatch freela_reservada falhou:", e);
    }
  }
```

> Nota: NÃO passar `source_user_id` aqui — o dispatch remove o `source_user_id` da lista de destinatários, e neste caso o destinatário É o ator.

- [ ] **Step 5: Verificar type-check + lint + testes**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS (inclui os testes do mapper).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260717000100_notification_event_freela_reservada.sql supabase/migrations/20260717000200_notification_rules_freela_reservada_seed.sql src/types/database.ts src/lib/freela-yide/actions.ts
git commit -m "feat(freela): notifica quem reservou um freela na agenda"
```

---

## Task 10: Verificação final

- [ ] **Step 1: Rodar tudo**

Run: `npm run typecheck && npm run lint && npm test`
Expected: PASS em tudo.

- [ ] **Step 2: Conferir manualmente os 3 arquivos de migration**

Confirmar que existem e estão na ordem correta:
- `20260717000000_freelayide_data_hora.sql`
- `20260717000100_notification_event_freela_reservada.sql`
- `20260717000200_notification_rules_freela_reservada_seed.sql`

(Aplicar via SQL Editor **nesta ordem** após o merge — enum value antes do seed.)

---

## Migrations manuais (ordem de aplicação no SQL Editor)

1. `20260717000000_freelayide_data_hora.sql`
2. `20260717000100_notification_event_freela_reservada.sql`
3. `20260717000200_notification_rules_freela_reservada_seed.sql`

## Notas de verificação de comportamento (pós-deploy)

- Criar oportunidade com data+hora → pegar com outro usuário → o bloco "Freela — reservado" (esmeralda) aparece na agenda **desse** usuário, na semana e no mês, no slot certo (fuso Cuiabá). Não aparece pra quem não pegou.
- Notificação in-app chega pra quem pegou (sino), com link pro `/calendario`.
- Marcar como **fechada** → continua na agenda daquele dia. Marcar **perdida** (devolver) → some.
- Oportunidade sem data+hora → não entra na agenda e não dispara notificação.
```
