# Produtividade: lucro por colaborador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar, por colaborador do audiovisual, se ele dá lucro (receita atribuída − custo) no `/produtividade`, corrigir a contagem de entregas por cargo, medir o coordenador de audiovisual pelo resultado do time, e arrumar o rótulo "hoje" que não reflete o período.

**Architecture:** Toda a aritmética nova vive num módulo puro `src/lib/produtividade/lucro.ts` (testável com vitest). A wiring de banco em `queries.ts` busca a carteira mensal (MRR), reconta entregas por cargo (concluída p/ operacional, postada p/ resto, + capturas p/ videomaker) e monta o card do time. UI ganha colunas Receita/Lucro, um card "Time Audiovisual" e título dinâmico.

**Tech Stack:** Next.js (App Router, force-dynamic), TypeScript, Supabase service-role, vitest, Tailwind, lucide-react.

**Regra de negócio (decidida no spec `docs/superpowers/specs/2026-07-17-produtividade-lucro-por-colaborador-design.md`):**
- Faturamento do período = `Σ clients.valor_mensal (status='ativo') ÷ 22 × dias úteis do período`.
- Valor por entrega = faturamento ÷ **total de entregas de todos os produtores individuais** (exclui coordenador de audiovisual, que não produz).
- Entrega por cargo: operacional (editor/videomaker/fast_midia/designer) = tarefa em `concluida` ou `postada`; demais = só `postada`; videomaker soma também capturas entregues no período (`audiovisual_capturas`).
- Fora totalmente: `coordenador` (Lucas) e `socio` (Yasmin) — nem linha, nem denominador.
- `audiovisual_chefe` (Duxx): sai da lista individual → vira card "Time Audiovisual" com `lucro = receita dos produtores − (custo dos produtores + salário do coord)`.

---

## File Structure

- **Create** `src/lib/produtividade/lucro.ts` — helpers puros: constantes de cargo, `contaComoEntrega`, `faturamentoPeriodo`, `valorPorEntrega`, `receitaAtribuida`, `lucroPeriodo`, `agregarTimeAudiovisual`.
- **Create** `src/lib/produtividade/lucro.test.ts` — testes vitest dos helpers.
- **Create** `src/components/produtividade/TimeAudiovisualCard.tsx` — card do coordenador medido pelo time.
- **Modify** `src/lib/produtividade/queries.ts` — busca MRR + capturas do período, reconta entregas, calcula receita/lucro, exclui cargos, monta o card; muda o retorno de `getColaboradoresStatus` e a assinatura de `summarizeStatus`.
- **Modify** `src/components/produtividade/ColaboradoresTable.tsx` — colunas Receita/Lucro, rótulo "Custo salário".
- **Modify** `src/components/produtividade/ProdutividadeSummaryCards.tsx` — cards Faturamento/Lucro.
- **Modify** `src/app/(authed)/produtividade/page.tsx` — título dinâmico, novo retorno, render do card do time.

---

## Task 0: Branch a partir de origin/main

**Files:** nenhum (setup).

> A `main` local vive ~300 commits atrás. TODO o código deste plano existe só em `origin/main`. Branchar de lá é obrigatório (senão os arquivos nem existem).

- [ ] **Step 1: Fetch e cria a branch**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento"
git fetch origin
git switch -c feat/produtividade-lucro origin/main
```

- [ ] **Step 2: Confirma que os arquivos-alvo existem agora**

Run: `ls src/lib/produtividade/queries.ts src/components/produtividade/ColaboradoresTable.tsx`
Expected: os dois caminhos listados sem erro.

---

## Task 1: Módulo puro `lucro.ts` + testes (TDD)

**Files:**
- Create: `src/lib/produtividade/lucro.ts`
- Test: `src/lib/produtividade/lucro.test.ts`

- [ ] **Step 1: Escreve os testes que falham**

Create `src/lib/produtividade/lucro.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  contaComoEntrega,
  faturamentoPeriodo,
  valorPorEntrega,
  receitaAtribuida,
  lucroPeriodo,
  agregarTimeAudiovisual,
  isRoleExcluido,
  isRoleTimeAudiovisual,
} from "./lucro";

describe("contaComoEntrega", () => {
  it("operacional entrega em concluida ou postada", () => {
    expect(contaComoEntrega("concluida", "videomaker")).toBe(true);
    expect(contaComoEntrega("postada", "editor")).toBe(true);
    expect(contaComoEntrega("em_andamento", "editor")).toBe(false);
  });
  it("não-operacional só entrega em postada", () => {
    expect(contaComoEntrega("concluida", "assessor")).toBe(false);
    expect(contaComoEntrega("postada", "assessor")).toBe(true);
  });
});

describe("faturamentoPeriodo", () => {
  it("prorateia a carteira pelos dias úteis", () => {
    // 22000 ÷ 22 × 13 = 13000
    expect(faturamentoPeriodo(22000, 13, 22)).toBe(13000);
    // 1 dia útil
    expect(faturamentoPeriodo(22000, 1, 22)).toBe(1000);
  });
  it("retorna 0 se diasUteisMes inválido", () => {
    expect(faturamentoPeriodo(22000, 5, 0)).toBe(0);
  });
});

describe("valorPorEntrega", () => {
  it("divide faturamento pelas entregas", () => {
    expect(valorPorEntrega(13000, 10)).toBe(1300);
  });
  it("null quando 0 entregas ou 0 faturamento", () => {
    expect(valorPorEntrega(13000, 0)).toBeNull();
    expect(valorPorEntrega(0, 10)).toBeNull();
  });
});

describe("receitaAtribuida / lucroPeriodo", () => {
  it("receita = valor/entrega × entregas", () => {
    expect(receitaAtribuida(1300, 3)).toBe(3900);
    expect(receitaAtribuida(null, 3)).toBeNull();
  });
  it("lucro = receita − custo; null se faltar parte", () => {
    expect(lucroPeriodo(3900, 1359.09)).toBe(2540.91);
    expect(lucroPeriodo(null, 100)).toBeNull();
    expect(lucroPeriodo(3900, null)).toBeNull();
  });
});

describe("agregarTimeAudiovisual", () => {
  it("soma receita/custo dos produtores + salário do coord", () => {
    const time = agregarTimeAudiovisual(
      [
        { receita_periodo: 3900, custo_periodo: 1359.09, entregas_periodo: 3, tempo_ativo_seg_hoje: 3600, tarefas_atrasadas: 1, capturas_atrasadas: 0 },
        { receita_periodo: 1300, custo_periodo: 1000, entregas_periodo: 1, tempo_ativo_seg_hoje: 1800, tarefas_atrasadas: 0, capturas_atrasadas: 2 },
      ],
      1772.73, // custo do coordenador
    );
    expect(time.receita).toBe(5200);
    expect(time.custo).toBe(4131.82); // 1359.09 + 1000 + 1772.73
    expect(time.lucro).toBe(1068.18);
    expect(time.entregas).toBe(4);
    expect(time.tempo_ativo_seg).toBe(5400);
    expect(time.atrasados).toBe(3);
    expect(time.produtores).toBe(2);
  });
  it("trata custo null (sem salário) como 0", () => {
    const time = agregarTimeAudiovisual(
      [{ receita_periodo: 1000, custo_periodo: null, entregas_periodo: 1, tempo_ativo_seg_hoje: 0, tarefas_atrasadas: 0, capturas_atrasadas: 0 }],
      null,
    );
    expect(time.custo).toBe(0);
    expect(time.lucro).toBe(1000);
  });
});

describe("classificadores de cargo", () => {
  it("exclui coordenador e socio", () => {
    expect(isRoleExcluido("coordenador")).toBe(true);
    expect(isRoleExcluido("socio")).toBe(true);
    expect(isRoleExcluido("videomaker")).toBe(false);
    expect(isRoleExcluido("audiovisual_chefe")).toBe(false);
  });
  it("time audiovisual = produtores (sem o chefe)", () => {
    expect(isRoleTimeAudiovisual("videomaker")).toBe(true);
    expect(isRoleTimeAudiovisual("fast_midia")).toBe(true);
    expect(isRoleTimeAudiovisual("designer")).toBe(true);
    expect(isRoleTimeAudiovisual("editor")).toBe(true);
    expect(isRoleTimeAudiovisual("audiovisual_chefe")).toBe(false);
  });
});
```

- [ ] **Step 2: Roda o teste e confirma que falha**

Run: `npm test -- src/lib/produtividade/lucro.test.ts`
Expected: FAIL — "Failed to resolve import './lucro'" / módulo não existe.

- [ ] **Step 3: Implementa `lucro.ts`**

Create `src/lib/produtividade/lucro.ts`:

```ts
// Módulo puro (sem "use server"/service-role) — pode ser importado por client e
// testado isoladamente. Toda a aritmética de lucro do /produtividade vive aqui.
import { ROLES_ENTREGA_OPERACIONAL } from "@/lib/tarefas/overdue-rules";

/** Cargos fora do cálculo de produtividade (gestão/dona): nem linha, nem denominador. */
export const ROLES_EXCLUIDOS_PRODUTIVIDADE = ["coordenador", "socio"] as const;

/** Produtores do time audiovisual (o coordenador `audiovisual_chefe` NÃO entra —
 *  ele é medido pelo agregado destes). Espelha PRODUCERS de colaboradores/schema. */
export const ROLES_TIME_AUDIOVISUAL = ["videomaker", "fast_midia", "designer", "editor"] as const;

export function isRoleExcluido(role: string | null | undefined): boolean {
  return (ROLES_EXCLUIDOS_PRODUTIVIDADE as readonly string[]).includes(role ?? "");
}

export function isRoleTimeAudiovisual(role: string | null | undefined): boolean {
  return (ROLES_TIME_AUDIOVISUAL as readonly string[]).includes(role ?? "");
}

/**
 * Uma tarefa conta como entrega da pessoa? Operacional (produção) entrega ao
 * chegar em "Concluído operacional" (`concluida`) — e `postada` implica que
 * passou por lá. Demais cargos só entregam em `postada`.
 */
export function contaComoEntrega(status: string, role: string | null | undefined): boolean {
  const operacional = (ROLES_ENTREGA_OPERACIONAL as readonly string[]).includes(role ?? "");
  if (operacional) return status === "concluida" || status === "postada";
  return status === "postada";
}

/** Faturamento pró-rata do período: (carteira mensal ÷ dias úteis do mês) × dias úteis decorridos. */
export function faturamentoPeriodo(
  carteiraMensal: number,
  diasUteis: number,
  diasUteisMes: number,
): number {
  if (diasUteisMes <= 0) return 0;
  return Number(((carteiraMensal / diasUteisMes) * diasUteis).toFixed(2));
}

/** Valor de 1 entrega no período. Null se não há entregas ou faturamento. */
export function valorPorEntrega(faturamento: number, totalEntregas: number): number | null {
  if (totalEntregas <= 0 || faturamento <= 0) return null;
  return Number((faturamento / totalEntregas).toFixed(2));
}

/** Receita atribuída a quem fez `entregas` entregas. Null se valor/entrega indefinido. */
export function receitaAtribuida(vpe: number | null, entregas: number): number | null {
  if (vpe === null) return null;
  return Number((vpe * entregas).toFixed(2));
}

/** Lucro = receita − custo. Null se faltar receita ou custo. */
export function lucroPeriodo(receita: number | null, custo: number | null): number | null {
  if (receita === null || custo === null) return null;
  return Number((receita - custo).toFixed(2));
}

export interface ProdutorParaTime {
  receita_periodo: number | null;
  custo_periodo: number | null;
  entregas_periodo: number;
  tempo_ativo_seg_hoje: number;
  tarefas_atrasadas: number;
  capturas_atrasadas: number;
}

export interface TimeAudiovisualAgg {
  receita: number;
  custo: number;
  lucro: number;
  entregas: number;
  tempo_ativo_seg: number;
  atrasados: number;
  produtores: number;
}

/**
 * Agrega o time de produção: receita = Σ receita dos produtores; custo = Σ custo
 * dos produtores + salário do coordenador; lucro = receita − custo. Custo null
 * (sem salário cadastrado) conta como 0.
 */
export function agregarTimeAudiovisual(
  produtores: ProdutorParaTime[],
  coordCusto: number | null,
): TimeAudiovisualAgg {
  const receita = produtores.reduce((a, p) => a + (p.receita_periodo ?? 0), 0);
  const custoProdutores = produtores.reduce((a, p) => a + (p.custo_periodo ?? 0), 0);
  const custo = Number((custoProdutores + (coordCusto ?? 0)).toFixed(2));
  const receitaR = Number(receita.toFixed(2));
  return {
    receita: receitaR,
    custo,
    lucro: Number((receitaR - custo).toFixed(2)),
    entregas: produtores.reduce((a, p) => a + p.entregas_periodo, 0),
    tempo_ativo_seg: produtores.reduce((a, p) => a + p.tempo_ativo_seg_hoje, 0),
    atrasados: produtores.reduce((a, p) => a + p.tarefas_atrasadas + p.capturas_atrasadas, 0),
    produtores: produtores.length,
  };
}
```

- [ ] **Step 4: Roda o teste e confirma que passa**

Run: `npm test -- src/lib/produtividade/lucro.test.ts`
Expected: PASS — todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/produtividade/lucro.ts src/lib/produtividade/lucro.test.ts
git commit -m "feat(produtividade): helpers puros de lucro por colaborador + testes"
```

---

## Task 2: Wiring em `queries.ts` — MRR, entregas por cargo, receita/lucro, card do time

**Files:**
- Modify: `src/lib/produtividade/queries.ts`

- [ ] **Step 1: Importa os helpers e o offset já existente**

Em `src/lib/produtividade/queries.ts`, adiciona ao bloco de imports do topo (depois do import de `overdue-rules`):

```ts
import {
  agregarTimeAudiovisual,
  contaComoEntrega,
  faturamentoPeriodo,
  isRoleExcluido,
  isRoleTimeAudiovisual,
  lucroPeriodo,
  receitaAtribuida,
  valorPorEntrega,
  type TimeAudiovisualAgg,
} from "./lucro";
```

- [ ] **Step 2: Adiciona campos de receita/lucro na interface `ColaboradorStatusRow`**

Substitui o campo `custo_por_entrega` (linhas ~51-55) mantendo-o e adicionando dois campos logo depois dele, dentro da interface:

```ts
  /**
   * Custo por entrega: custo_periodo ÷ entregas_periodo. Quanto de salário
   * fixo cada entrega custou. Null quando não há custo ou 0 entregas.
   */
  custo_por_entrega: number | null;
  /** Receita atribuída no período: valor por entrega × entregas. Null se indefinido. */
  receita_periodo: number | null;
  /** Lucro no período: receita_periodo − custo_periodo. Null se faltar parte. */
  lucro_periodo: number | null;
```

- [ ] **Step 3: Define os tipos de retorno novos (card do time + resultado)**

Logo abaixo da interface `ColaboradorStatusRow` (antes de `interface ProfileRow`), adiciona:

```ts
export interface TimeAudiovisualCard extends TimeAudiovisualAgg {
  coordenador_user_id: string;
  coordenador_nome: string;
}

export interface ColaboradoresStatusResult {
  /** Linhas individuais (sem coordenador geral, sócia nem o coord de audiovisual). */
  rows: ColaboradorStatusRow[];
  /** Faturamento pró-rata do período (carteira ativa ÷ 22 × dias úteis). */
  faturamento_periodo: number;
  /** Valor de 1 entrega no período. Null se 0 entregas. */
  valor_por_entrega: number | null;
  /** Card do coordenador de audiovisual medido pelo time. Null se não há coord ativo. */
  time_audiovisual: TimeAudiovisualCard | null;
}
```

- [ ] **Step 4: Muda a assinatura de `getColaboradoresStatus` pra devolver o resultado rico**

Troca a assinatura (linha ~165):

```ts
export async function getColaboradoresStatus(
  range: PeriodoRange = "dia",
): Promise<ColaboradoresStatusResult> {
```

- [ ] **Step 5: Adiciona as duas queries novas ao `Promise.all`**

No array desestruturado (linhas ~185-194), adiciona duas entradas ao final da lista de nomes:

```ts
  const [
    { data: profilesData, error: profilesError },
    { data: presenceData, error: presenceError },
    { data: eventsData },
    { data: capturesData },
    { data: entregasData },
    { data: overdueTasksData },
    { data: scheduledCapturesData },
    { data: capturesEntregasData },
    { data: clientsData },
    { data: capturasEntreguesData },
  ] = await Promise.all([
```

E no fim do array de queries (depois do bloco `audiovisual_capturas` que seleciona `event_id`, linha ~263), adiciona:

```ts
    // Carteira mensal (MRR) — faturamento base. valor_mensal já é 0 pra
    // parceria/permuta (forçado na escrita), então soma direto os ativos.
    sb.from("clients").select("status, valor_mensal").is("deleted_at", null),
    // Capturas entregues no período (material subido) — entrega de gravação do
    // videomaker. created_at = quando subiu. Some às entregas dele.
    sb
      .from("audiovisual_capturas")
      .select("videomaker_id, created_at")
      .gte("created_at", sinceStartUtc)
      .lt("created_at", tomorrowStartUtc)
      .not("videomaker_id", "is", null),
```

- [ ] **Step 6: Muda a query de entregas pra trazer também `concluida` e o `status`**

Substitui o bloco de entregas (linhas ~230-238) por:

```ts
    // Entregas no período: tarefas que viraram "concluida" (Concluído
    // Operacional) OU "postada". A regra POR CARGO é aplicada em JS via
    // contaComoEntrega (operacional entrega em concluida; resto só em postada).
    // completed_at é carimbado ao entrar em concluida/postada (ver tarefas/actions.ts).
    sb
      .from("tasks")
      .select("atribuido_a, status")
      .in("status", ["concluida", "postada"])
      .gte("completed_at", sinceStartUtc)
      .lt("completed_at", tomorrowStartUtc)
      .not("atribuido_a", "is", null),
```

- [ ] **Step 7: Ajusta a tipagem local de `entregas` e recontagem por cargo**

Troca a interface `DeliveryRow` (linhas ~68-70) por:

```ts
interface DeliveryRow {
  atribuido_a: string;
  status: string;
}
```

Substitui o bloco de `entregasByUser` (linhas ~306-313) por:

```ts
  // Entregas por user_id. Tarefas: aplica regra por cargo (concluida p/
  // operacional; postada p/ resto). Depois soma capturas entregues (videomaker).
  const entregasByUser = new Map<string, number>();
  for (const t of entregas) {
    if (!contaComoEntrega(t.status, roleByUser.get(t.atribuido_a))) continue;
    entregasByUser.set(t.atribuido_a, (entregasByUser.get(t.atribuido_a) ?? 0) + 1);
  }
  const capturasEntregues = (capturasEntreguesData ?? []) as Array<{
    videomaker_id: string;
    created_at: string;
  }>;
  for (const c of capturasEntregues) {
    entregasByUser.set(c.videomaker_id, (entregasByUser.get(c.videomaker_id) ?? 0) + 1);
  }
```

- [ ] **Step 8: Calcula o faturamento do período (logo após `const diasUteis = ...`)**

Depois da linha `const diasUteis = diasUteisDecorridos(since, today);` (~286), adiciona:

```ts
  // Faturamento pró-rata do período: carteira ativa ÷ 22 dias úteis × dias
  // decorridos — mesma base do custo, pra numerador e denominador baterem.
  const carteiraMensal = ((clientsData ?? []) as Array<{ status: string; valor_mensal: number | string }>)
    .filter((c) => c.status === "ativo")
    .reduce((acc, c) => acc + Number(c.valor_mensal), 0);
  const faturamento_periodo = faturamentoPeriodo(carteiraMensal, diasUteis, DIAS_UTEIS_MES);
```

- [ ] **Step 9: Refaz o `return profiles.map(...)` em duas passadas (base → receita/lucro → filtro → time)**

Substitui o bloco `return profiles.map((p) => { ... });` inteiro (linhas ~385-436) por:

```ts
  // Passada 1: métricas base por perfil (sem receita/lucro ainda — precisam do
  // valor por entrega, que depende do total de entregas dos produtores).
  const baseRows = profiles.map((p) => {
    const lastSeen = p.last_seen_at ? new Date(p.last_seen_at).getTime() : 0;
    const lastActive = p.last_active_event_at
      ? new Date(p.last_active_event_at).getTime()
      : 0;
    const online = lastSeen > 0 && now - lastSeen < ONLINE_WINDOW_SECONDS * 1000;
    const ativo = lastActive > 0 && now - lastActive < ATIVO_WINDOW_SECONDS * 1000;

    const userEvents = eventsByUser.get(p.id) ?? [];
    const tempoPresenca = presenceAvailable
      ? (presenceByUser.get(p.id) ?? 0)
      : tempoAtivoFromEvents(userEvents);
    const tempoExterno = tempoExternoByUser.get(p.id) ?? 0;
    const tempo_ativo_seg_hoje = tempoPresenca + tempoExterno;

    const fixo = p.fixo_mensal !== null ? Number(p.fixo_mensal) : 0;
    const custo_hora = fixo > 0 ? Number((fixo / HORAS_UTEIS_MES).toFixed(2)) : null;
    const custo_periodo =
      fixo > 0 ? Number(((fixo / DIAS_UTEIS_MES) * diasUteis).toFixed(2)) : null;

    const entregas_periodo = entregasByUser.get(p.id) ?? 0;
    const custo_por_entrega =
      custo_periodo !== null && entregas_periodo > 0
        ? Number((custo_periodo / entregas_periodo).toFixed(2))
        : null;

    return {
      user_id: p.id,
      nome: p.nome,
      role: p.role,
      avatar_url: p.avatar_url,
      last_seen_at: p.last_seen_at,
      last_active_event_at: p.last_active_event_at,
      online,
      ativo,
      tempo_ativo_seg_hoje,
      tempo_externo_seg_hoje: tempoExterno,
      eventos_hoje: userEvents.length,
      tarefas_atrasadas: tarefasAtrasadasByUser.get(p.id) ?? 0,
      capturas_atrasadas: capturasAtrasadasByUser.get(p.id) ?? 0,
      custo_hora,
      custo_periodo,
      entregas_periodo,
      custo_por_entrega,
      receita_periodo: null as number | null,
      lucro_periodo: null as number | null,
    };
  });

  // Denominador do valor por entrega: entregas dos indivíduos que produzem —
  // exclui cargos de gestão/dona (coordenador, socio) e o coord de audiovisual
  // (audiovisual_chefe, que não produz direto; ele é medido pelo time).
  const individuais = baseRows.filter(
    (r) => !isRoleExcluido(r.role) && r.role !== "audiovisual_chefe",
  );
  const totalEntregas = individuais.reduce((acc, r) => acc + r.entregas_periodo, 0);
  const valor_por_entrega = valorPorEntrega(faturamento_periodo, totalEntregas);

  // Preenche receita/lucro nas linhas base (usado tanto nas individuais quanto
  // no agregado do time — produtores são um subconjunto das individuais).
  for (const r of baseRows) {
    r.receita_periodo = receitaAtribuida(valor_por_entrega, r.entregas_periodo);
    r.lucro_periodo = lucroPeriodo(r.receita_periodo, r.custo_periodo);
  }

  const rows: ColaboradorStatusRow[] = individuais;

  // Card do time audiovisual: agrega os produtores + salário do coordenador.
  const produtores = baseRows.filter((r) => isRoleTimeAudiovisual(r.role));
  const coord = baseRows.find((r) => r.role === "audiovisual_chefe");
  const time_audiovisual: TimeAudiovisualCard | null = coord
    ? {
        coordenador_user_id: coord.user_id,
        coordenador_nome: coord.nome,
        ...agregarTimeAudiovisual(produtores, coord.custo_periodo),
      }
    : null;

  return { rows, faturamento_periodo, valor_por_entrega, time_audiovisual };
}
```

- [ ] **Step 10: Atualiza `ProdutividadeSummary` e `summarizeStatus` pra incluir faturamento/lucro**

Na interface `ProdutividadeSummary` (linhas ~439-459), adiciona três campos antes de `tarefas_atrasadas_total`:

```ts
  /** Faturamento pró-rata do período (carteira ativa). */
  faturamento_periodo: number;
  /** Receita atribuída somada das linhas individuais. */
  receita_total: number;
  /** Lucro do time individual: receita_total − custo_periodo_total. */
  lucro_total: number;
```

Troca a assinatura e o corpo de `summarizeStatus` (linha ~461) pra receber o faturamento. Usa o nome `faturamento` no parâmetro pra **não** colidir com a função importada `faturamentoPeriodo`:

```ts
export function summarizeStatus(
  rows: ColaboradorStatusRow[],
  faturamento = 0,
): ProdutividadeSummary {
```

E dentro dela, logo após `const custo_por_entrega = ...` (~471-474), adiciona:

```ts
  const receita_total = Number(
    rows.reduce((acc, r) => acc + (r.receita_periodo ?? 0), 0).toFixed(2),
  );
  const lucro_total = Number((receita_total - custo_periodo_total).toFixed(2));
```

E no objeto retornado (linha ~491-504), adiciona os três campos:

```ts
    custo_por_entrega,
    faturamento_periodo: Number(faturamento.toFixed(2)),
    receita_total,
    lucro_total,
    tarefas_atrasadas_total,
```

- [ ] **Step 11: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros em `queries.ts`. (A page.tsx ainda vai acusar erro — é esperado, corrigido na Task 5.)

- [ ] **Step 12: Commit**

```bash
git add src/lib/produtividade/queries.ts
git commit -m "feat(produtividade): faturamento, entregas por cargo, receita/lucro e card do time"
```

---

## Task 3: Colunas Receita e Lucro na tabela

**Files:**
- Modify: `src/components/produtividade/ColaboradoresTable.tsx`

- [ ] **Step 1: Adiciona chaves de ordenação novas**

Troca o tipo `SortKey` (linha ~13):

```ts
type SortKey = "nome" | "ativo" | "tempo" | "eventos" | "custo_periodo" | "custo_hora" | "atrasados" | "entregas" | "receita" | "lucro";
```

E adiciona dois `case` no `switch` do `sorted` (depois do `case "entregas":`, linha ~65-67):

```ts
        case "receita":
          cmp = (b.receita_periodo ?? 0) - (a.receita_periodo ?? 0);
          break;
        case "lucro":
          cmp = (b.lucro_periodo ?? 0) - (a.lucro_periodo ?? 0);
          break;
```

- [ ] **Step 2: Renomeia o header "Custo (per.)" pra "Custo salário" e adiciona headers Receita/Lucro**

Troca o `<th>` de `Custo (per.)` (linhas ~115-120) por:

```tsx
              <th
                className="px-4 py-2.5 text-right"
                title="Salário fixo no período: (salário mensal ÷ 22 dias úteis) × dias úteis decorridos. É o que se paga, independente de atividade."
              >
                <SortBtn label="Custo salário" k="custo_periodo" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
```

E logo depois do `<th>` de `Entregas` (fecha na linha ~126), adiciona dois headers:

```tsx
              <th
                className="px-4 py-2.5 text-right"
                title="Receita atribuída: valor médio por entrega × entregas da pessoa."
              >
                <SortBtn label="Receita" k="receita" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
              <th
                className="px-4 py-2.5 text-right"
                title="Lucro no período: receita atribuída − custo do salário."
              >
                <SortBtn label="Lucro" k="lucro" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
```

- [ ] **Step 3: Adiciona as células Receita e Lucro no corpo**

Logo depois da `<td>` que renderiza `<EntregasCell ... />` (fecha na linha ~194), adiciona:

```tsx
                  <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                    {r.receita_periodo !== null
                      ? formatBRL(r.receita_periodo)
                      : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {r.lucro_periodo !== null ? (
                      <span className={r.lucro_periodo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                        {formatBRL(r.lucro_periodo)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos em `ColaboradoresTable.tsx`.

- [ ] **Step 5: Commit**

```bash
git add src/components/produtividade/ColaboradoresTable.tsx
git commit -m "feat(produtividade): colunas Receita e Lucro + rótulo Custo salário"
```

---

## Task 4: Cards de resumo (Faturamento + Lucro) e card do Time Audiovisual

**Files:**
- Modify: `src/components/produtividade/ProdutividadeSummaryCards.tsx`
- Create: `src/components/produtividade/TimeAudiovisualCard.tsx`

- [ ] **Step 1: Adiciona os cards Faturamento e Lucro ao array `CARDS`**

Em `ProdutividadeSummaryCards.tsx`, adiciona ao final do array `CARDS` (depois do card "Custo por entrega", antes do `] as const;` na linha ~91):

```ts
  {
    label: "Faturamento do período",
    icon: DollarSign,
    tone: "emerald",
    getValue: (s: ProdutividadeSummary) => formatBRL(s.faturamento_periodo),
    getHint: () => "carteira ativa pró-rata dos dias úteis",
  },
  {
    label: "Lucro do time",
    icon: TrendingUp,
    tone: "emerald",
    getValue: (s: ProdutividadeSummary) => formatBRL(s.lucro_total),
    getHint: (s: ProdutividadeSummary) =>
      `${formatBRL(s.receita_total)} receita − ${formatBRL(s.custo_periodo_total)} custo`,
  },
```

> Nota: o grid usa `lg:grid-cols-6`; com 8 cards ele quebra pra segunda linha naturalmente. Sem mudança de layout necessária.

- [ ] **Step 2: Cria o componente `TimeAudiovisualCard`**

Create `src/components/produtividade/TimeAudiovisualCard.tsx`:

```tsx
import { Clapperboard, TrendingUp, TrendingDown } from "lucide-react";
import type { TimeAudiovisualCard as TimeAudiovisualData } from "@/lib/produtividade/queries";
import { formatBRL, formatHours } from "./ProdutividadeSummaryCards";

export function TimeAudiovisualCard({ time }: { time: TimeAudiovisualData }) {
  const positivo = time.lucro >= 0;
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
          <Clapperboard className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Time Audiovisual · {time.coordenador_nome}</h2>
          <p className="text-[11px] text-muted-foreground">
            {time.produtores} produtor{time.produtores === 1 ? "" : "es"} · resultado do time (já pagando o coordenador)
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Receita do time" value={formatBRL(time.receita)} />
        <Metric label="Custo (+ coord)" value={formatBRL(time.custo)} />
        <Metric
          label="Lucro do time"
          value={formatBRL(time.lucro)}
          tone={positivo ? "pos" : "neg"}
          icon={positivo ? TrendingUp : TrendingDown}
        />
        <Metric label="Entregas / tempo" value={`${time.entregas} · ${formatHours(time.tempo_ativo_seg)}`} />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  icon?: typeof TrendingUp;
}) {
  const color =
    tone === "pos"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "neg"
        ? "text-rose-600 dark:text-rose-400"
        : "";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 flex items-center gap-1 text-lg font-bold tabular-nums ${color}`}>
        {Icon && <Icon className="h-4 w-4" />}
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros novos nesses dois arquivos (a page.tsx ainda erra — corrigido na Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/components/produtividade/ProdutividadeSummaryCards.tsx src/components/produtividade/TimeAudiovisualCard.tsx
git commit -m "feat(produtividade): cards de faturamento/lucro + card do Time Audiovisual"
```

---

## Task 5: Page — título dinâmico, novo retorno, render do card do time

**Files:**
- Modify: `src/app/(authed)/produtividade/page.tsx`

- [ ] **Step 1: Importa o card do time**

Depois do import de `ColaboradoresTable` (linha ~15), adiciona:

```ts
import { TimeAudiovisualCard } from "@/components/produtividade/TimeAudiovisualCard";
```

- [ ] **Step 2: Desestrutura o novo retorno de `getColaboradoresStatus`**

Troca o bloco `const [rows, entregaMaterial, events] = await Promise.all([...]); const summary = summarizeStatus(rows);` (linhas ~40-45) por:

```ts
  const [statusResult, entregaMaterial, events] = await Promise.all([
    getColaboradoresStatus(range),
    getEntregaMaterialStats(range),
    listRecentEvents(30),
  ]);
  const { rows, faturamento_periodo, time_audiovisual } = statusResult;
  const summary = summarizeStatus(rows, faturamento_periodo);
```

- [ ] **Step 3: Título dinâmico da seção de colaboradores**

Troca o `<h2>` fixo (linhas ~131-134) por:

```tsx
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Colaboradores · {PERIODO_LABEL[range]}
        </h2>
        {time_audiovisual && (
          <div className="mb-3">
            <TimeAudiovisualCard time={time_audiovisual} />
          </div>
        )}
        <ColaboradoresTable rows={rows} />
      </section>
```

- [ ] **Step 4: Atualiza o texto "Como funciona" (custo por entrega → lucro)**

Substitui o parágrafo de "Custo por entrega" (linhas ~182-186) por dois parágrafos:

```tsx
            <p>
              <strong className="text-foreground">Receita / Lucro:</strong>{" "}
              faturamento do período (carteira ativa pró-rata) ÷ total de entregas
              = valor por entrega. Receita = valor × entregas da pessoa; lucro =
              receita − custo do salário.
            </p>
            <p>
              <strong className="text-foreground">Time Audiovisual:</strong>{" "}
              o coordenador é medido pelo time — lucro = receita dos produtores −
              (custo deles + salário do coordenador). Coordenador geral e sócia
              ficam fora do cálculo.
            </p>
```

- [ ] **Step 5: Type-check e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS — sem erros.

- [ ] **Step 6: Roda a suíte de testes completa**

Run: `npm test`
Expected: PASS — inclui `lucro.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(authed)/produtividade/page.tsx"
git commit -m "feat(produtividade): título dinâmico por período + render do Time Audiovisual"
```

---

## Task 6: PR

**Files:** nenhum.

- [ ] **Step 1: Push e abre o PR**

```bash
git push -u origin feat/produtividade-lucro
gh pr create --base main --title "feat(produtividade): lucro por colaborador + coord medido pelo time" --body "$(cat <<'EOF'
## O que muda
- **Lucro por colaborador**: cada entrega vale `faturamento do período ÷ total de entregas`; receita = valor × entregas da pessoa; lucro = receita − custo do salário. Colunas Receita e Lucro na tabela.
- **Entregas por cargo** (corrige contagem errada): operacional (videomaker/editor/fast/designer) conta `concluida`; videomaker soma capturas entregues; demais contam `postada`.
- **Coordenador de audiovisual** medido pelo time: card "Time Audiovisual" com `lucro = receita dos produtores − (custo deles + salário do coord)`.
- **Fora do cálculo**: coordenador geral (`coordenador`) e sócia (`socio`).
- **Bugs**: título "hoje" agora reflete o período selecionado; `Custo (per.)` → **Custo salário** com tooltip.

Sem migration nova — reusa `clients`, `tasks`, `audiovisual_capturas`.

Spec: `docs/superpowers/specs/2026-07-17-produtividade-lucro-por-colaborador-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Espera CI verde e mergeia**

Run (depois do CI passar): `gh pr checks --watch` e então `gh pr merge --squash --delete-branch`
Expected: PR mergeado. (Sem migration manual pendente neste PR.)

---

## Notas de verificação manual (pós-merge, em prod)

- Abrir `/produtividade` com filtro **Este mês**: título deve dizer "Colaboradores · Este mês".
- Um videomaker (ex.: Ryan) deve ter Entregas > 0 (capturas + edições), não mais 1.
- Card "Time Audiovisual · Duxx" aparece com receita/custo/lucro; Duxx **não** aparece na lista individual.
- Lucas (coordenador) e Yasmin (sócia) **não** aparecem na tabela.
- Lucro verde/vermelho coerente; pessoas sem salário cadastrado mostram Lucro "—".

## Riscos / suposições

- **Capturas vs edições não se sobrepõem**: capturas vivem em `audiovisual_capturas`/`calendar_events`, edições são `tasks` — contagens independentes, sem duplicar. Se no futuro uma captura virar `task`, revisitar.
- **`completed_at` em tarefas `concluida`**: assume que é carimbado ao entrar em `concluida` (confirmado em `tarefas/actions.ts`). Se uma tarefa pular direto pra `postada` sem passar por `concluida`, ela ainda conta (postada implica entregue).
- **Atribuição de receita é crua** (todas as entregas valem igual) — decisão consciente do spec, não bug.
```
