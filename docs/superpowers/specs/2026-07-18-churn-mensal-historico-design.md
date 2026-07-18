# Churn mensal — histórico ao clicar no card "Tempo médio de casa"

**Data:** 2026-07-18
**Módulo:** dashboard (`src/lib/dashboard`, `src/components/dashboard`)
**Fonte:** código vive em `origin/main` (main local vive atrás — branchar de `origin/main`).

## Problema

O card **"Tempo médio de casa"** (`KpiRow.tsx`) mostra `14 meses` + `Churn mensal: 7.3%`, um valor único do mês corrente vindo de `kpis.ltv.churnRatePct`. Não dá pra comparar a tendência do churn ao longo dos meses. A Yasmin quer clicar no card e ver a **% de churn de todos os meses** lado a lado.

## Decisões (brainstorming)

- **Formato:** modal/popup ao clicar no card.
- **Período:** todo o histórico (do cliente mais antigo até o mês atual).
- **Colunas:** Mês · % de churn · Nº que saíram · R$ perdido no mês.

## Definição do churn (idêntica ao card, pra bater com o 7,3%)

Espelha `_getKpisImpl` em `src/lib/dashboard/queries.ts`:

Para cada mês `M`:
- `churns` = clientes **mensais** (`modalidade` ausente ou `"mensal"`) **comum** (`tipo_relacao` ausente ou `"comum"`) com `data_churn` dentro de `M`.
- `base` = mensais comum **ativos no fim de `M−1`** (`isActiveOn` no último dia do mês anterior).
- `churnPct` = `base > 0 ? (churns / base) × 100 : null`.
- `valorPerdido` = soma do `valor_mensal` dos `churns`.

Consistência: a entrada do mês corrente **deve** igualar `kpis.ltv.churnRatePct` (mesma definição, mesma fonte).

## Camada de dados

**Novo arquivo `src/lib/dashboard/churn-historico.ts`:**

```ts
export interface ChurnMensalPoint {
  mes: string;            // "YYYY-MM"
  churnPct: number | null; // null quando base = 0
  churns: number;
  valorPerdido: number;
}

// Pura e testável: recebe as linhas de cliente já filtradas + a lista de meses.
export function computeChurnMensal(
  clients: ChurnClientRow[],
  meses: string[],
): ChurnMensalPoint[];

// Busca (service-role) + monta o range + delega ao puro. Cacheada.
export async function getChurnMensalHistorico(
  filter?: ClientFilter,
  ateMes?: string,
): Promise<ChurnMensalPoint[]>;
```

- `getChurnMensalHistorico`:
  - Busca `clients`: `id, data_entrada, data_churn, valor_mensal, modalidade, tipo_relacao`, `deleted_at is null`, `tipo_relacao = 'comum'`, aplica `buildClientFilterQuery(..., filter)` (unitId multi-tenant, igual aos outros).
  - Range de meses: do mês de `min(data_entrada)` até `ateMes ?? mês corrente` (ascendente), via helpers de `date-utils.ts` (`monthRange`/`lastDayOfMonth`/`isInMonth`). Sem clientes → `[]`.
  - Delega a `computeChurnMensal` e devolve ascendente.
  - `unstable_cache` com tag `["dashboard"]` e key própria (bumpar key se o shape mudar — regra do projeto).
- `computeChurnMensal` reusa a mesma lógica de `isActiveOn` (ativo em uma data) — replicada localmente de forma pura (pequena, sem service-role), já que `isActiveOn` em `queries.ts` é privada.

## UI

1. **`KpiCard.tsx`** — adiciona prop opcional `onClick?: () => void`. Quando presente (e sem `href`), renderiza como `<button>` com o mesmo `containerClasses` clicável. Continua puro/presentacional; sem `onClick` nem `href` → `<div>` como hoje.

2. **Novo `src/components/dashboard/ChurnMensalCard.tsx`** (client):
   - Props: `{ tempoNode: ReactNode; helper: ReactNode; historico: ChurnMensalPoint[] }`.
   - Renderiza `<KpiCard label="Tempo médio de casa" valor={tempoNode} helperText={helper} icon={Clock} onClick={abrir} />`.
   - Modal (mesmo padrão de overlay `fixed inset-0 z-50 ...` usado no projeto, ex.: `NovoAnuncioButton`), com tabela: **Mês · Churn % · Saíram · R$ perdido**, ordem **mais recente no topo**, mês corrente destacado.
   - `churnPct === null` → célula `"—"`. `R$ perdido` usa `<Money>` (respeita o toggle de esconder valores). Histórico vazio → "Sem histórico ainda".
   - Fecha por clique fora / Esc / botão.

3. **`KpiRow.tsx`** — recebe nova prop `churnHistorico: ChurnMensalPoint[]`; troca o `<KpiCard label="Tempo médio de casa" ...>` estático por `<ChurnMensalCard tempoNode={tempoDisplay.node} helper={tempoDisplay.helper} historico={churnHistorico} />`.

4. **`sections.tsx` (`KpiRowSection`)** — busca `getChurnMensalHistorico({ unitId }, mes)` em paralelo com `getKpis({ unitId }, mes)` e passa `churnHistorico` ao `KpiRow`.

## Casos de borda

- `base = 0` (meses iniciais do histórico) → `churnPct = null` → "—".
- Sem clientes / histórico vazio → modal mostra "Sem histórico ainda".
- Pontuais (`modalidade = 'pontual'`) e parceria/permuta (`tipo_relacao != 'comum'`) ficam **fora** — igual à definição do card.
- `R$ perdido` via `<Money>` respeita o toggle de valores escondidos do dashboard.
- Escopo: usa o mesmo `{ unitId }` do `KpiRowSection` (é a visão sócio/adm).

## Testes

Unit (`churn-historico.test.ts`, vitest) sobre `computeChurnMensal` com fixtures de clientes cruzando alguns meses:
- churn% correto num mês com churn; `null` quando base 0.
- contagem de `churns` e `valorPerdido` (só comum/mensal).
- pontual e parceria não entram.
- o mês corrente bate com a fórmula do KPI.

Rodar excluindo worktrees stale: `npx vitest run --exclude '**/.claude/**' src/lib/dashboard/churn-historico.test.ts`.

## Arquivos

- **Novos:** `src/lib/dashboard/churn-historico.ts`, `src/lib/dashboard/churn-historico.test.ts`, `src/components/dashboard/ChurnMensalCard.tsx`.
- **Editados:** `src/components/dashboard/KpiCard.tsx` (onClick), `src/components/dashboard/KpiRow.tsx` (prop + card clicável), `src/components/dashboard/sections.tsx` (fetch no `KpiRowSection`).
- **Sem migration.**

## Fora de escopo

- Churn por assessor/coordenador (o card é a visão sócio/adm; mantém `{ unitId }`).
- Gráfico/linha de tendência (é uma tabela; a série visual já existe em "Entrada × Churn").
- Alterar a definição de churn existente.
