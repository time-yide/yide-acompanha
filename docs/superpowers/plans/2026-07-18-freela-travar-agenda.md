# Travar agenda ao pegar freela — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Pegar um freela bloqueia o videomaker naquele horário — o coordenador não consegue mais delegar gravação por cima (erro rígido), e o freela pego de videomaker/fast_midia vira "Indisponível" visível no calendário do time.

**Architecture:** Uma função pura de sobreposição de intervalos (`freela-overlap.ts`) + um checker service-role (`freela-check.ts`) usado como hard-error nos dois caminhos de delegação. Uma query unit-wide dos freelas reservados + um mapper por-espectador que rende detalhe pro dono e "Indisponível — Freela" pros outros.

**Tech Stack:** Next.js (Server Actions/Components), TypeScript, Supabase service-role, vitest, Tailwind.

**Branch:** já criada — `feat/freela-travar-agenda` a partir de `origin/main`. Spec commitado. NÃO trocar de branch. Local main vive atrás.

**Nota de testes:** SEMPRE `npx vitest run --exclude '**/.claude/**' <arquivo>`. `freela-overlap.ts` é puro. **Sem migration** (reusa `data_hora`/`duracao_min`/`status`/`pego_por`).

**Definições:** `data_hora` (timestamptz UTC) + `duracao_min` (int) → slot `[data_hora, data_hora + duracao_min)`. Colisão = intervalos se sobrepõem (encostar não colide: `fim == início` → livre). Status que reservam: `pega`, `em_negociacao`, `fechada`.

---

## File Structure

- **Create** `src/lib/calendario/freela-overlap.ts` (+ `freela-overlap.test.ts`) — puro.
- **Create** `src/lib/calendario/freela-check.ts` — `checarFreelaVideomaker` (service-role).
- **Modify** `src/lib/calendario/actions.ts` — hard-check em `validateVideomakerAssignment`.
- **Modify** `src/lib/audiovisual/coord-actions.ts` — hard-check em `delegateVideomakerAction` e `updateDelegacaoAction`.
- **Modify** `src/lib/calendario/queries.ts` — `listFreelasReservadosNoPeriodo`.
- **Modify** `src/lib/calendario/freela-events.ts` (+ `freela-events.test.ts` se existir, senão criar) — `freelaReservadoToEvents`.
- **Modify** `src/lib/calendario/schema.ts` — estende `CalendarEvent.freela`.
- **Modify** `src/app/(authed)/calendario/page.tsx` — merge (semana + mês).
- **Modify** `src/components/calendario/EventCell.tsx` e `MonthView.tsx` — variante "não-dono".

---

## Task 1: Sobreposição pura `freela-overlap.ts` + teste (TDD)

**Files:** Create `src/lib/calendario/freela-overlap.ts`, `src/lib/calendario/freela-overlap.test.ts`.

- [ ] **Step 1: Teste que falha**

Create `src/lib/calendario/freela-overlap.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { freelaColidente, type FreelaSlot } from "./freela-overlap";

const slot = (data_hora: string, duracao_min: number, titulo = "F"): FreelaSlot => ({ titulo, data_hora, duracao_min });

describe("freelaColidente", () => {
  it("colide quando os intervalos se sobrepõem", () => {
    const freelas = [slot("2026-07-20T17:00:00.000Z", 120)]; // 17:00–19:00 UTC
    expect(freelaColidente(freelas, "2026-07-20T18:00:00.000Z", "2026-07-20T18:30:00.000Z"))
      .toEqual(freelas[0]);
  });
  it("encostar não colide (fim == início)", () => {
    const freelas = [slot("2026-07-20T17:00:00.000Z", 120)]; // termina 19:00
    expect(freelaColidente(freelas, "2026-07-20T19:00:00.000Z", "2026-07-20T20:00:00.000Z")).toBeNull();
  });
  it("sem sobreposição → null", () => {
    const freelas = [slot("2026-07-20T17:00:00.000Z", 60)]; // 17:00–18:00
    expect(freelaColidente(freelas, "2026-07-20T15:00:00.000Z", "2026-07-20T16:00:00.000Z")).toBeNull();
  });
  it("duração inválida vira 60min", () => {
    const freelas = [slot("2026-07-20T17:00:00.000Z", 0)];
    expect(freelaColidente(freelas, "2026-07-20T17:30:00.000Z", "2026-07-20T17:45:00.000Z"))
      .toEqual(freelas[0]);
  });
  it("lista vazia → null", () => {
    expect(freelaColidente([], "2026-07-20T17:00:00.000Z", "2026-07-20T18:00:00.000Z")).toBeNull();
  });
});
```
Run `npx vitest run --exclude '**/.claude/**' src/lib/calendario/freela-overlap.test.ts` → FAIL.

- [ ] **Step 2: Implementa (puro)**

Create `src/lib/calendario/freela-overlap.ts`:
```ts
// Puro/client-safe — sobreposição de slot de freela com um intervalo (UTC).
export interface FreelaSlot {
  titulo: string;
  data_hora: string;   // ISO UTC (início)
  duracao_min: number;
}

/** Retorna o 1º freela cujo slot [data_hora, data_hora+dur) sobrepõe [inicioUtc, fimUtc). Encostar não colide. */
export function freelaColidente(
  freelas: FreelaSlot[],
  inicioUtc: string,
  fimUtc: string,
): FreelaSlot | null {
  const ini = new Date(inicioUtc).getTime();
  const fim = new Date(fimUtc).getTime();
  for (const f of freelas) {
    const fIni = new Date(f.data_hora).getTime();
    const dur = f.duracao_min && f.duracao_min > 0 ? f.duracao_min : 60;
    const fFim = fIni + dur * 60_000;
    if (fIni < fim && fFim > ini) return f;
  }
  return null;
}
```
Run the test again → PASS.

- [ ] **Step 3: Commit**
```bash
git add src/lib/calendario/freela-overlap.ts src/lib/calendario/freela-overlap.test.ts
git commit -m "feat(calendario): freelaColidente (sobreposição de slot de freela) + teste"
```

---

## Task 2: `checarFreelaVideomaker` (service-role)

**Files:** Create `src/lib/calendario/freela-check.ts`.

- [ ] **Step 1: Cria o checker**

Create `src/lib/calendario/freela-check.ts`:
```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";
import { freelaColidente } from "./freela-overlap";

/**
 * Erro RÍGIDO (sem override): se o videomaker tem freela reservado
 * (pega/em_negociacao/fechada, com data_hora) que sobrepõe [inicioUtc, fimUtc),
 * retorna a mensagem; senão null. Usa service-role (independe de RLS).
 */
export async function checarFreelaVideomaker(params: {
  videomakerId: string;
  nome: string;
  inicioUtc: string;
  fimUtc: string;
}): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("freela_oportunidades")
    .select("titulo, data_hora, duracao_min")
    .eq("pego_por", params.videomakerId)
    .in("status", ["pega", "em_negociacao", "fechada"])
    .not("data_hora", "is", null)
    .is("deleted_at", null)
    .lt("data_hora", params.fimUtc);
  const hit = freelaColidente(
    (data ?? []) as { titulo: string; data_hora: string; duracao_min: number }[],
    params.inicioUtc,
    params.fimUtc,
  );
  if (!hit) return null;
  const br = new Date(hit.data_hora).toLocaleString("pt-BR", {
    timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  return `${params.nome} tem freela reservado (${hit.titulo}) às ${br} — não dá pra delegar.`;
}
```

- [ ] **Step 2: Type-check + commit**

Run `npx tsc --noEmit` (limpo). Confirma que `APP_TIMEZONE` é exportado de `@/lib/datetime/timezone` (é usado em `actions.ts`).
```bash
git add src/lib/calendario/freela-check.ts
git commit -m "feat(calendario): checarFreelaVideomaker (erro rígido de freela na delegação)"
```

---

## Task 3: Hard-check nas delegações

**Files:** Modify `src/lib/calendario/actions.ts`, `src/lib/audiovisual/coord-actions.ts`.

- [ ] **Step 1: `validateVideomakerAssignment` (actions.ts)**

Em `src/lib/calendario/actions.ts`, adiciona ao import block:
```ts
import { checarFreelaVideomaker } from "./freela-check";
```
Dentro de `validateVideomakerAssignment`, LOGO APÓS o bloco que checa conflito de `calendar_events` (o `if (conflict) { ... return { error: ... } }`) e ANTES do `if (!params.ignorarBloqueio) {` (checagem de bloqueio), adiciona:
```ts
  const freelaMsg = await checarFreelaVideomaker({
    videomakerId: params.videomakerId,
    nome: vm.nome,
    inicioUtc: params.inicioUtc,
    fimUtc: params.fimUtc,
  });
  if (freelaMsg) return { error: freelaMsg };
```
(Erro rígido — vem antes do bloqueio soft, não tem override.)

- [ ] **Step 2: `delegateVideomakerAction` + `updateDelegacaoAction` (coord-actions.ts)**

Em `src/lib/audiovisual/coord-actions.ts`, adiciona ao import block:
```ts
import { checarFreelaVideomaker } from "@/lib/calendario/freela-check";
```
Em `delegateVideomakerAction`, LOGO APÓS o bloco que checa colisão de `calendar_events` (o passo 3, que termina com o `return { error }` de conflito), adiciona:
```ts
  const freelaMsg = await checarFreelaVideomaker({
    videomakerId,
    nome: videomaker.nome,
    inicioUtc: event.inicio,
    fimUtc: event.fim,
  });
  if (freelaMsg) return { error: freelaMsg };
```
> Use o mesmo nome de variável do videomaker que a função já tem (o objeto com `.nome`). Se o nome do videomaker não estiver numa variável ali, busque-o: `const { data: vmRow } = await sb.from("profiles").select("nome").eq("id", videomakerId).single(); const vmNome = vmRow?.nome ?? "Videomaker";` e use `nome: vmNome`.

Em `updateDelegacaoAction` (re-delegar), LOGO APÓS a checagem de colisão de `calendar_events`, adiciona o MESMO bloco (com o `event.inicio`/`event.fim` e o nome do videomaker daquele escopo).

- [ ] **Step 3: Type-check + commit**

Run `npx tsc --noEmit` (limpo).
```bash
git add src/lib/calendario/actions.ts src/lib/audiovisual/coord-actions.ts
git commit -m "feat(freela): bloqueia delegar gravação quando o videomaker tem freela no horário"
```

---

## Task 4: Query unit-wide + mapper por-espectador + tipo

**Files:** Modify `src/lib/calendario/queries.ts`, `src/lib/calendario/freela-events.ts`, `src/lib/calendario/schema.ts`; Create/Modify `src/lib/calendario/freela-events.test.ts`.

- [ ] **Step 1: Estende o tipo `CalendarEvent.freela` (schema.ts)**

Em `src/lib/calendario/schema.ts`, no sub-tipo `freela?: { ... }`, adiciona dois campos opcionais:
```ts
    /** true quando o freela é de OUTRA pessoa (renderiza como "Indisponível", sem detalhe). */
    reservadoDeOutro?: boolean;
    /** nome de quem reservou (usado quando reservadoDeOutro). */
    dono_nome?: string | null;
```

- [ ] **Step 2: `listFreelasReservadosNoPeriodo` (queries.ts)**

Em `src/lib/calendario/queries.ts`, adiciona (junto de `listMeusFreelasNoPeriodo`):
```ts
export interface FreelaReservadoRow {
  id: string;
  titulo: string;
  data_hora: string | null;
  duracao_min: number;
  status: string;
  tipo: string;
  valor_comissao: number;
  entrega_urgente: boolean;
  pego_por: string;
  pego_por_nome: string | null;
  pego_por_role: string | null;
}

/** Todos os freelas reservados (pega/em_negociacao/fechada, com data_hora) da unidade
 *  no período. Traz quem pegou (nome + role) pro mapper decidir visibilidade. */
export async function listFreelasReservadosNoPeriodo(
  inicioIso: string,
  fimIso: string,
  unitProfileIds: string[] | null = null,
): Promise<FreelaReservadoRow[]> {
  if (unitProfileIds !== null && unitProfileIds.length === 0) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let q = sb
    .from("freela_oportunidades")
    .select("id, titulo, data_hora, duracao_min, status, tipo, valor_comissao, entrega_urgente, pego_por, taker:profiles!freela_oportunidades_pego_por_fkey(nome, role)")
    .not("pego_por", "is", null)
    .not("data_hora", "is", null)
    .gte("data_hora", inicioIso)
    .lt("data_hora", fimIso)
    .in("status", ["pega", "em_negociacao", "fechada"])
    .is("deleted_at", null);
  if (unitProfileIds !== null) q = q.in("pego_por", unitProfileIds);
  const { data, error } = await q;
  if (error) {
    console.error("[calendario] listFreelasReservadosNoPeriodo", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    titulo: r.titulo as string,
    data_hora: (r.data_hora as string | null) ?? null,
    duracao_min: Number(r.duracao_min ?? 60),
    status: r.status as string,
    tipo: r.tipo as string,
    valor_comissao: Number(r.valor_comissao ?? 0),
    entrega_urgente: !!r.entrega_urgente,
    pego_por: r.pego_por as string,
    pego_por_nome: ((r.taker as { nome?: string } | null) ?? null)?.nome ?? null,
    pego_por_role: ((r.taker as { role?: string } | null) ?? null)?.role ?? null,
  }));
}
```

- [ ] **Step 3: Teste do mapper (freela-events.test.ts)**

Create (ou adiciona a) `src/lib/calendario/freela-events.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { freelaReservadoToEvents } from "./freela-events";
import type { FreelaReservadoRow } from "./queries";

const base: FreelaReservadoRow = {
  id: "1", titulo: "Gravação X", data_hora: "2026-07-20T17:00:00.000Z", duracao_min: 120,
  status: "pega", tipo: "captacao", valor_comissao: 300, entrega_urgente: false,
  pego_por: "u1", pego_por_nome: "Ryan", pego_por_role: "videomaker",
};

describe("freelaReservadoToEvents", () => {
  it("dono vê detalhe (título + link)", () => {
    const [ev] = freelaReservadoToEvents([base], "u1");
    expect(ev.titulo).toBe("Gravação X");
    expect(ev.link).toBe("/freela-yide");
    expect(ev.freela?.reservadoDeOutro).toBeFalsy();
  });
  it("outro vê 'Indisponível' sem título/link, com nome de quem reservou", () => {
    const [ev] = freelaReservadoToEvents([base], "u2");
    expect(ev.link).toBeNull();
    expect(ev.freela?.reservadoDeOutro).toBe(true);
    expect(ev.freela?.dono_nome).toBe("Ryan");
    expect(ev.freela?.valor_comissao).toBe(0);
  });
  it("freela de não-videomaker de outra pessoa é privado (não aparece)", () => {
    const assessor = { ...base, pego_por: "u3", pego_por_role: "assessor" };
    expect(freelaReservadoToEvents([assessor], "u2")).toEqual([]);
  });
  it("mas o próprio dono não-videomaker vê o seu", () => {
    const assessor = { ...base, pego_por: "u3", pego_por_role: "assessor" };
    expect(freelaReservadoToEvents([assessor], "u3").length).toBe(1);
  });
  it("sem data_hora é ignorado", () => {
    expect(freelaReservadoToEvents([{ ...base, data_hora: null }], "u1")).toEqual([]);
  });
});
```
Run `npx vitest run --exclude '**/.claude/**' src/lib/calendario/freela-events.test.ts` → FAIL (função nova).

- [ ] **Step 4: `freelaReservadoToEvents` (freela-events.ts)**

Em `src/lib/calendario/freela-events.ts`, adiciona (mantém o `freelaRowsToEvents` existente pra não quebrar outros usos):
```ts
import type { FreelaReservadoRow } from "./queries";

const ROLES_VIDEOMAKER = new Set(["videomaker", "fast_midia"]);

/**
 * Freelas reservados → eventos de calendário, por espectador:
 *  - dono → detalhe "Freela — reservado" (título, valor, link).
 *  - outro + taker videomaker/fast_midia → "Indisponível — Freela" (nome, sem valor/link).
 *  - outro + taker de outro cargo → omitido (privado ao dono).
 */
export function freelaReservadoToEvents(rows: FreelaReservadoRow[], viewerId: string): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const r of rows) {
    if (!r.data_hora) continue;
    const dono = r.pego_por === viewerId;
    const ehVideomaker = ROLES_VIDEOMAKER.has(r.pego_por_role ?? "");
    if (!dono && !ehVideomaker) continue;
    const dur = r.duracao_min && r.duracao_min > 0 ? r.duracao_min : 60;
    const inicio = new Date(r.data_hora);
    const fim = new Date(inicio.getTime() + dur * 60_000);
    out.push({
      id: `freela-${r.id}`,
      origem: "freela",
      titulo: dono ? r.titulo : "Reservado (freela)",
      descricao: null,
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      sub_calendar: "videomakers",
      participantes_ids: [r.pego_por],
      link: dono ? "/freela-yide" : null,
      freela: {
        status: r.status,
        tipo: r.tipo,
        valor_comissao: dono ? r.valor_comissao : 0,
        urgente: !!r.entrega_urgente,
        reservadoDeOutro: !dono,
        dono_nome: dono ? null : r.pego_por_nome,
      },
    });
  }
  return out;
}
```
> `CalendarEvent` já é importado no topo de `freela-events.ts`. `link` aceita `string | null` (o tipo já tem `link?`). Se `link` for `string | undefined` no tipo, use `undefined` no lugar de `null` no ramo não-dono.

Run o teste de novo → PASS.

- [ ] **Step 5: Type-check + commit**

Run `npx tsc --noEmit` (limpo).
```bash
git add src/lib/calendario/queries.ts src/lib/calendario/freela-events.ts src/lib/calendario/freela-events.test.ts src/lib/calendario/schema.ts
git commit -m "feat(calendario): freelas reservados unit-wide + mapper por-espectador"
```

---

## Task 5: Wire na página + rendering "não-dono"

**Files:** Modify `src/app/(authed)/calendario/page.tsx`, `src/components/calendario/EventCell.tsx`, `src/components/calendario/MonthView.tsx`.

- [ ] **Step 1: page.tsx — troca o fetch/mapper (semana e mês)**

Em `src/app/(authed)/calendario/page.tsx`, no import de queries, troca `listMeusFreelasNoPeriodo` por `listFreelasReservadosNoPeriodo`; e no import de `freela-events`, troca `freelaRowsToEvents` por `freelaReservadoToEvents`.

Nos DOIS blocos (semana e mês), troca a chamada do freela no `Promise.all`:
```ts
    listMeusFreelasNoPeriodo(userId, start.toISOString(), end.toISOString()),
```
por (semana usa `start`/`end`, mês usa `grid.start`/`grid.end`):
```ts
    listFreelasReservadosNoPeriodo(start.toISOString(), end.toISOString(), unitProfileIds),
```
E no `applySubFilter([...])`, troca:
```ts
    ...freelaRowsToEvents(freelas, userId),
```
por:
```ts
    ...freelaReservadoToEvents(freelas, userId),
```
> `unitProfileIds` e `userId` já estão no escopo das funções `renderWeek`/`renderMonth`. Passar `unitProfileIds` (pode ser `null` = sem filtro de unidade). O mapper já restringe visibilidade por dono/role.

- [ ] **Step 2: EventCell.tsx — variante "não-dono"**

Em `src/components/calendario/EventCell.tsx`, dentro do `if (event.freela) { ... }`, ANTES do bloco atual (emerald "Freela — reservado"), adiciona o ramo de reservado-de-outro:
```tsx
  if (event.freela?.reservadoDeOutro) {
    const nome = event.freela.dono_nome ?? "Videomaker";
    return (
      <div
        className="rounded-md border border-dashed border-muted-foreground/50 bg-muted/40 p-2 text-xs"
        title={`${nome} indisponível — freela`}
      >
        <div className="flex items-center gap-1 font-semibold">
          <Briefcase className="h-3.5 w-3.5 flex-shrink-0 sm:h-3 sm:w-3" />
          <span className="truncate">Indisponível — Freela</span>
        </div>
        <div className="opacity-80">{formatBrtTime(event.inicio)}</div>
        <div className="mt-0.5 truncate font-medium opacity-90">{nome}</div>
      </div>
    );
  }
```
(Usa `Briefcase` e `formatBrtTime` que o arquivo já importa. Sem `<Link>` — reservado de outro não é clicável.)

- [ ] **Step 3: MonthView.tsx — variante "não-dono"**

Em `src/components/calendario/MonthView.tsx`, dentro do ramo `event.freela` (o bloco emerald), adiciona no começo:
```tsx
    if (e.freela?.reservadoDeOutro) {
      return (
        <div key={e.id} className="truncate rounded border border-dashed border-muted-foreground/50 bg-muted/60 px-1 text-[10px] text-muted-foreground" title="Indisponível — freela">
          🔒 {e.freela.dono_nome ?? "Freela"}
        </div>
      );
    }
```
> Ajuste o nome da variável do evento (`e` ou `event`) e a estrutura do `return`/`key` pro que o arquivo já usa no ramo freela. Só o visual muda (cinza tracejado "Indisponível", sem link).

- [ ] **Step 4: Type-check + lint**

Run `npx tsc --noEmit && npx eslint "src/app/(authed)/calendario/page.tsx" src/components/calendario/EventCell.tsx src/components/calendario/MonthView.tsx`
Expected: ZERO erros. Se `freelaRowsToEvents` ficou sem uso e o lint reclamar, remova o import dele em page.tsx.

- [ ] **Step 5: Commit**
```bash
git add "src/app/(authed)/calendario/page.tsx" src/components/calendario/EventCell.tsx src/components/calendario/MonthView.tsx
git commit -m "feat(calendario): freela reservado visível pro time como 'Indisponível'"
```

---

## Task 6: PR

- [ ] **Step 1: Verificação final**

Run `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' src/lib/calendario/freela-overlap.test.ts src/lib/calendario/freela-events.test.ts`
Expected: tsc limpo; testes verdes.

- [ ] **Step 2: Push + PR**
```bash
git push -u origin feat/freela-travar-agenda
gh pr create --base main --title "feat(freela): travar agenda do videomaker ao pegar freela" --body "$(cat <<'EOF'
## O que muda
- **Bloqueio total na delegação:** delegar/atribuir uma gravação a um videomaker que tem freela reservado (pega/em_negociacao/fechada) no mesmo horário agora dá **erro rígido** (sem override) — em criar/editar evento (`validateVideomakerAssignment`) e na delegação da fila (`delegateVideomakerAction`/`updateDelegacaoAction`).
- **Freela vira "Indisponível" visível pro time:** freelas pegos por videomaker/fast_midia aparecem no calendário do time como bloco "Indisponível — Freela" (nome + horário, **sem valor**). O dono continua vendo o detalhe "Freela — reservado". Freela de outros cargos segue privado ao dono.

Cálculo de sobreposição puro e testado. Sem migration.

Spec: `docs/superpowers/specs/2026-07-18-freela-travar-agenda-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI verde → merge**

Espera `test` verde, então `gh pr merge --squash --delete-branch`.

---

## Notas de verificação manual (pós-deploy)

- Videomaker pega freela às 14h–16h dia X. Coord tenta delegar gravação 15h dia X → erro "tem freela reservado". 10h dia X → ok.
- No calendário, o coord vê "Indisponível — Freela {nome}" no slot do videomaker (sem valor). O próprio videomaker vê "Freela — reservado {título}".
- Freela de assessor não aparece pro time.

## Riscos / suposições

- `checarFreelaVideomaker` usa service-role (independe de RLS) — coord consegue checar freela de qualquer videomaker.
- Overlap em UTC (freela e gravação já em UTC) — sem conversão de fuso.
- `updateDelegacaoAction`: aplicar o mesmo hard-check; se a assinatura/variáveis diferirem, adaptar o nome do videomaker/inicio/fim ao escopo local (não inventar campos).
- Gap pré-existente (bloqueio de agenda comum não checado no `delegateVideomakerAction`) fica fora do escopo.
