# Fase 7 — Comissões (Yide Digital) — Design

**Data:** 2026-04-27
**Status:** Aprovado pela usuária, aguardando plano de implementação
**Spec mãe:** [2026-04-26-sistema-acompanhamento-design.md](2026-04-26-sistema-acompanhamento-design.md), seção 5.7
**Fases anteriores:** Fundação, Clientes, Kanban Onboarding, Calendário, Tarefas, Colaboradores, Notificações Completa (todas em produção)

---

## 1. Objetivo

Sistema completo de comissões com:
- **Cálculo automático** das fórmulas por papel (Assessor, Coord, Comercial, Audiovisual Chefe, Produtores, ADM)
- **Snapshot mensal** gerado por cron Vercel no dia 1 às 00:00 BRT (slot 2 do Hobby tier)
- **Aprovação Sócio** com revisão linha-a-linha e ajuste manual + justificativa
- **3 sub-páginas** (Visão geral, Minhas comissões, Fechamento) com permissões por papel
- **Previsão em tempo real** durante o mês corrente
- **Detalhamento de carteira/deals** visível pra cada colaborador
- **Integração com Fase 6** (notificações `mes_aguardando_aprovacao` e `mes_aprovado`)

**Princípios:**
- Snapshot é imutável após aprovação (ajustes futuros viram compensação no mês seguinte)
- Snapshot guarda `papel_naquele_mes` e `percentual_aplicado` no momento da geração — sem retroatividade
- Sócios não geram snapshot (não têm comissão pelo sistema; ganho aparece como lucro consolidado)
- Audit log em todas as ações sensíveis (ajuste, aprovação)
- Falha de cron é idempotente (rodar 2x mesmo mês não duplica)

**Fora do escopo:**
- Reabrir mês aprovado (decisão #4 = imutável)
- Snapshot retroativo manual (só via cron)
- Comissão pro-rata em meio de mês
- Multi-tenant
- Exportar PDF / contracheque
- Dashboard histórico (vai ser parte da Fase 9)
- Metas comerciais e bônus por meta
- Notificação de cliente perto do churn → Fase 8

---

## 2. Modelo de dados

### Enums novos

```sql
create type public.snapshot_status as enum ('pending_approval', 'aprovado');

create type public.snapshot_item_tipo as enum (
  'fixo',
  'carteira_assessor',
  'carteira_coord_agencia',
  'deal_fechado_comercial'
);
```

### Tabela `commission_snapshots` (NEW)

Uma linha por **(usuário, mês)**. Gerada pelo cron, aprovada pelo Sócio.

| Coluna | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `mes_referencia` | text | not null, formato `YYYY-MM` |
| `user_id` | uuid | FK → profiles, not null |
| `papel_naquele_mes` | text | not null (snapshot do role) |
| `fixo` | numeric(12,2) | default 0 |
| `percentual_aplicado` | numeric(5,2) | default 0 |
| `base_calculo` | numeric(12,2) | default 0 |
| `valor_variavel` | numeric(12,2) | default 0 |
| `ajuste_manual` | numeric(12,2) | default 0 (delta aplicado pelo Sócio) |
| `valor_total` | numeric(12,2) | default 0 (= fixo + valor_variavel + ajuste_manual implícito) |
| `status` | enum snapshot_status | default `'pending_approval'` |
| `aprovado_por` | uuid | FK → profiles, nullable |
| `aprovado_em` | timestamptz | nullable |
| `justificativa_ajuste` | text | nullable |
| `created_at` | timestamptz | default now() |

**Indexes:**
- Unique `(user_id, mes_referencia)` — garante 1 snapshot por user/mês
- `(mes_referencia, status)` — query "snapshots pendentes do mês X"

**RLS:**
- `SELECT`: Sócio/ADM veem todos. Outros papéis veem só `user_id = auth.uid()`.
- `UPDATE/INSERT`: só Sócio (ajuste + aprovar) e service-role (cron).
- `DELETE`: nenhum.

### Tabela `commission_snapshot_items` (NEW — detalhamento)

Permite auditar "essa linha de R$ X veio de qual deal/cliente":

| Coluna | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `snapshot_id` | uuid | FK → commission_snapshots, on delete cascade |
| `tipo` | enum snapshot_item_tipo | not null |
| `descricao` | text | not null |
| `base` | numeric(12,2) | default 0 |
| `percentual` | numeric(5,2) | default 0 |
| `valor` | numeric(12,2) | default 0 |
| `client_id` | uuid | FK → clients, nullable |
| `lead_id` | uuid | FK → leads, nullable |
| `created_at` | timestamptz | default now() |

**Index:** `(snapshot_id)` pra query do detalhamento.

**RLS:** segue snapshot pai (mesma policy aplicada via subquery).

### Quem **não** entra no snapshot

- **Sócios** (per spec — não têm linha)
- **Inativos** (`profiles.ativo = false`)

### Estado das migrations

Migrations existentes irão sequencialmente até `20260427000014`. Esta fase adiciona 1 migration única com tudo (`20260427000015_commission_snapshots.sql`).

---

## 3. Lógica de cálculo

### Fórmulas por papel

```
ASSESSOR:
  fixo = profile.fixo_mensal
  percentual = profile.comissao_percent
  base = Σ valor_mensal de clients onde assessor_id = userId AND status = 'ativo'
  valor_variavel = base × percentual / 100
  items = [
    { tipo: 'fixo', descricao: 'Fixo mensal', valor: fixo },
    { tipo: 'carteira_assessor', descricao: '% sobre carteira (N clientes)', base, percentual, valor: valor_variavel }
  ]

COORDENADOR / AUDIOVISUAL_CHEFE:
  fixo = profile.fixo_mensal
  percentual = profile.comissao_percent
  base = Σ valor_mensal de TODOS clients ativos (carteira agência inteira)
  valor_variavel = base × percentual / 100
  items = [
    { tipo: 'fixo', descricao: 'Fixo mensal', valor: fixo },
    { tipo: 'carteira_coord_agencia', descricao: '% sobre carteira da agência (N clientes)', base, percentual, valor: valor_variavel }
  ]

COMERCIAL:
  fixo = profile.fixo_mensal
  percentual = profile.comissao_primeiro_mes_percent
  deals = leads onde comercial_id = userId AND data_fechamento ∈ [primeiro_dia_mes, ultimo_dia_mes]
  valor_variavel = Σ (deal.valor_proposto × percentual / 100)
  base = Σ deal.valor_proposto
  items = [
    { tipo: 'fixo', descricao: 'Fixo mensal', valor: fixo },
    ...deals.map(d => ({
      tipo: 'deal_fechado_comercial',
      descricao: `${cliente.nome} — 1º mês R$ ${d.valor_proposto}`,
      base: d.valor_proposto,
      percentual,
      valor: d.valor_proposto * percentual / 100,
      lead_id: d.id,
      client_id: d.client_id
    }))
  ]

ADM / VIDEOMAKER / DESIGNER / EDITOR:
  fixo = profile.fixo_mensal
  percentual = 0
  base = 0
  valor_variavel = 0
  items = [{ tipo: 'fixo', descricao: 'Fixo mensal', valor: fixo }]

SÓCIO: NÃO ENTRA — função retorna null
```

`valor_total = fixo + valor_variavel + ajuste_manual` (sempre 0 na geração; só Sócio adiciona depois).

### Helpers (`src/lib/comissoes/calculator.ts`)

```ts
export interface SnapshotCalc {
  fixo: number;
  percentual_aplicado: number;
  base_calculo: number;
  valor_variavel: number;
}

export interface SnapshotItem {
  tipo: 'fixo' | 'carteira_assessor' | 'carteira_coord_agencia' | 'deal_fechado_comercial';
  descricao: string;
  base: number;
  percentual: number;
  valor: number;
  client_id?: string;
  lead_id?: string;
}

export interface CommissionResult {
  snapshot: SnapshotCalc;
  items: SnapshotItem[];
}

export async function calculateCommission(
  userId: string,
  monthRef: string,    // 'YYYY-MM'
): Promise<CommissionResult | null>
```

Retorna `null` para Sócio. Função pura(ish) — recebe userId + mês, faz queries, calcula. Reutilizada por:
- `generateMonthlySnapshots` (cron) — persiste resultado
- `previewMyCommission` (página Minhas comissões) — só lê

### Função `previewMyCommission(userId)` (`src/lib/comissoes/preview.ts`)

Wrapper de `calculateCommission(userId, monthAtual)` — usado no card de previsão:

```ts
export async function previewMyCommission(userId: string) {
  const now = new Date();
  const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return calculateCommission(userId, monthRef);
}
```

---

## 4. Cron mensal

### Schedule

`vercel.json` — adicionar slot 2:

```json
{
  "crons": [
    { "path": "/api/cron/daily-digest", "schedule": "0 11 * * *" },
    { "path": "/api/cron/monthly-snapshot", "schedule": "0 3 1 * *" }
  ]
}
```

`0 3 1 * *` = **03:00 UTC dia 1 = 00:00 BRT dia 1**.

### Endpoint `src/app/api/cron/monthly-snapshot/route.ts`

```ts
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // mes_referencia = mês ANTERIOR (cron roda dia 1, gera referente ao mês que acabou)
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthRef = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const result = await generateMonthlySnapshots(monthRef);
  return NextResponse.json(result);
}
```

### Função `generateMonthlySnapshots` (`src/lib/comissoes/generator.ts`)

```ts
export async function generateMonthlySnapshots(monthRef: string): Promise<{ skipped: true; reason: string } | { count: number }> {
  const supabase = createServiceRoleClient();

  // Idempotência
  const { data: existing } = await supabase
    .from("commission_snapshots")
    .select("id")
    .eq("mes_referencia", monthRef)
    .limit(1);
  if (existing && existing.length > 0) {
    return { skipped: true, reason: "already generated" };
  }

  // Lista colaboradores elegíveis (todos ativos exceto sócios)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("ativo", true)
    .neq("role", "socio");

  let count = 0;
  for (const p of profiles ?? []) {
    const calc = await calculateCommission(p.id, monthRef);
    if (!calc) continue;

    const valor_total = calc.snapshot.fixo + calc.snapshot.valor_variavel;

    const { data: snap } = await supabase
      .from("commission_snapshots")
      .insert({
        mes_referencia: monthRef,
        user_id: p.id,
        papel_naquele_mes: p.role,
        fixo: calc.snapshot.fixo,
        percentual_aplicado: calc.snapshot.percentual_aplicado,
        base_calculo: calc.snapshot.base_calculo,
        valor_variavel: calc.snapshot.valor_variavel,
        valor_total,
      })
      .select("id")
      .single();
    if (!snap) continue;

    if (calc.items.length > 0) {
      await supabase.from("commission_snapshot_items").insert(
        calc.items.map(i => ({ ...i, snapshot_id: snap.id }))
      );
    }
    count++;
  }

  // Notifica via Fase 6 (mes_aguardando_aprovacao, mandatory pra sócio)
  await dispatchNotification({
    evento_tipo: "mes_aguardando_aprovacao",
    titulo: `Comissão de ${formatMonth(monthRef)} aguardando aprovação`,
    mensagem: `${count} snapshots gerados`,
    link: "/comissoes/fechamento",
  });

  return { count };
}
```

---

## 5. Páginas e sub-abas

### Estrutura

```
src/app/(authed)/comissoes/
├── page.tsx                  # redireciona pra /comissoes/minhas (ou visao-geral pra Sócio)
├── minhas/page.tsx           # "Minhas comissões"
├── visao-geral/page.tsx      # "Visão geral" (Sócio/ADM)
└── fechamento/page.tsx       # "Fechamento" (Sócio/ADM)
```

Em cada uma, header com **3 abas** (mesmo padrão de `/tarefas`). Abas que o user não tem permissão **ficam ocultas**.

### `/comissoes/minhas` (todos, exceto Sócio que redireciona)

**Card 1 — Previsão do mês corrente:**

Detalhamento varia por papel:

#### Para **Assessor**
```
Sua carteira (5 clientes ativos)
┌──────────────────────────────────────┐
│ Cliente               Valor mensal   │
├──────────────────────────────────────┤
│ Pizzaria Bella        R$ 4.500       │
│ Restaurante Sabor     R$ 6.200       │
│ Fashion Store         R$ 3.800       │
│ Auto Center           R$ 5.000       │
│ Café Premium          R$ 4.500       │
├──────────────────────────────────────┤
│ Total carteira        R$ 24.000      │
└──────────────────────────────────────┘

Cálculo:
  Fixo:                     R$ 3.500,00
  Variável (5%):            R$ 1.200,00
  ────────────────────────────────────
  Salário previsto:         R$ 4.700,00
```

#### Para **Coordenador / Audiovisual Chefe**
```
Carteira da agência (43 clientes ativos)
[Tabela rolável com nome + valor_mensal de TODOS]
                           Total: R$ 487.500

Cálculo:
  Fixo:                     R$ 5.000,00
  Variável (3%):            R$ 14.625,00
  ────────────────────────────────────
  Salário previsto:         R$ 19.625,00
```

#### Para **Comercial**
```
Deals fechados em Abril 2026 (2)
┌────────────────────────────────────────────────┐
│ Cliente            1º mês     %      Comissão │
├────────────────────────────────────────────────┤
│ Pizzaria Bella     R$ 4.500   25%    R$ 1.125 │
│ Restaurante Sabor  R$ 6.200   25%    R$ 1.550 │
├────────────────────────────────────────────────┤
│                                       R$ 2.675 │
└────────────────────────────────────────────────┘

Cálculo:
  Fixo:                     R$ 4.000,00
  Variável (Σ deals):       R$ 2.675,00
  ────────────────────────────────────
  Salário previsto:         R$ 6.675,00
```

#### Para **Produtores (videomaker/designer/editor) e ADM**
```
Você recebe apenas o fixo mensal.

Cálculo:
  Fixo:                     R$ 3.000,00
  ────────────────────────────────────
  Salário previsto:         R$ 3.000,00
```

#### Para **Sócios**
Página redireciona pra `/comissoes/visao-geral`.

**Card 2 — Histórico (últimos 12 meses):**

Tabela: `mes_referencia | fixo | variável | ajuste | total | status`. Click numa linha aprovada abre detalhe (modal ou expansível) com o **mesmo formato detalhado acima**, mas reconstruído dos items do snapshot daquele mês.

### `/comissoes/visao-geral` (Sócio/ADM)

**Tabela consolidada do mês selecionado:**
- Filtro: dropdown de mês (default = mês passado)
- Colunas: `Avatar | Colaborador | Papel | Fixo | Variável | Ajuste | Total | Status`
- Total geral no rodapé (custo total da agência)
- Indicadores: quantos aprovados / quantos pendentes
- Banner no topo se houver mês `pending_approval`: "⚠ X meses aguardando aprovação" → link Fechamento

### `/comissoes/fechamento` (Sócio/ADM)

**Tela de aprovação detalhada:**
- Filtro: dropdown de mês (default = primeiro mês com pending)
- Tabela igual à Visão geral mas com **edição inline**:
  - Coluna "Variável" com ícone lápis → click → input editável
  - Confirma (Enter) → modal `<AdjustmentModal>` pede justificativa (min 5 chars)
  - Submit → action `adjustSnapshotAction(snapshot_id, novo_valor_variavel, justificativa)`
- Cada linha tem botão "Ver items" → expande detalhamento (linha do fixo, deals do comercial, etc.)
- Botão grande "**Aprovar mês X**" no rodapé:
  - Disabled se algum snapshot do mês tem `valor_total < 0`
  - Click → modal "Aprovar todos os N snapshots de Abril 2026?"
  - Submit → action `approveMonthAction(mes_referencia)` → vira tudo `aprovado`, dispara `mes_aprovado` (Fase 6)

### Componentes novos (`src/components/comissoes/`)

```
CommissionTabs.tsx                  # client; 3 abas com permissões
PreviewCard.tsx                     # server; card de previsão mês corrente
HistoryTable.tsx                    # server; histórico últimos 12 meses
SnapshotItemsDetail.tsx             # server; detalhamento expansível
OverviewTable.tsx                   # server; tabela visão geral
FechamentoTable.tsx                 # server-with-client; tabela fechamento com edit inline
CommissionBreakdown.tsx             # server; renderiza detalhamento por papel (reutilizado preview + histórico)
AdjustmentModal.tsx                 # client; modal de justificativa
ApproveMonthButton.tsx              # client; com confirmação
```

---

## 6. Server actions e regras de negócio

### `src/lib/comissoes/schema.ts` (NEW)

```ts
import { z } from "zod";

export const adjustmentSchema = z.object({
  snapshot_id: z.string().uuid(),
  novo_valor_variavel: z.coerce.number().min(0, "Valor não pode ser negativo"),
  justificativa: z.string().min(5, "Justificativa muito curta (mín. 5 chars)"),
});

export const approveSchema = z.object({
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido (use formato YYYY-MM)"),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type ApproveInput = z.infer<typeof approveSchema>;
```

### `src/lib/comissoes/actions.ts` (NEW)

| Action | Permissão | Comportamento |
|---|---|---|
| `adjustSnapshotAction(formData)` | Sócio | Valida zod → checa snapshot existe e não-aprovado → recalcula `ajuste_manual` (delta vs valor original calculado) → update `valor_variavel`, `ajuste_manual`, `valor_total`, `justificativa_ajuste` → audit log → revalida |
| `approveMonthAction(formData)` | Sócio | Valida zod → carrega snapshots pending do mês → bloqueia se algum tem `valor_total < 0` → update todos pra `aprovado` com `aprovado_por`/`aprovado_em` → audit log (acao=`approve`) → dispatch `mes_aprovado` pra todos os afetados → revalida |

### `src/lib/comissoes/queries.ts` (NEW)

| Função | Para quê |
|---|---|
| `listSnapshotsForUser(userId, limit=12)` | Histórico em /comissoes/minhas |
| `getSnapshotById(id)` | Detalhe do snapshot (com items via join) |
| `listSnapshotsForMonth(monthRef)` | Visão geral / Fechamento |
| `getMonthsAwaitingApproval()` | Lista de meses únicos com `pending_approval` |
| `previewMyCommission(userId)` | Calcula em runtime para previsão (sem persistir) |
| `getCommissionItemsForSnapshot(snapshotId)` | Items detalhados (junção) |

### Audit log

`logAudit` aceita acao: `"create" | "update" | "soft_delete" | "delete" | "complete" | "reopen" | "approve"`. Já tem `"approve"` desde Fase 4 — usado em `approveMonthAction`.

---

## 7. Edge cases

| Caso | Comportamento |
|---|---|
| Cron roda 2x no mesmo mês | `generateMonthlySnapshots` checa existência → retorna `{ skipped: true }` |
| Mudança de role mid-mês (assessor → coord no dia 15) | Snapshot usa `papel_naquele_mes` capturado no momento da geração (1º do mês seguinte) — vira coord |
| Mudança de % mid-mês | Snapshot pega o % atual no momento da geração |
| Comercial sem deal no mês | items = só linha de fixo. valor_variavel = 0. Snapshot existe normalmente. |
| Cliente com `valor_mensal = null` | Filtro `not null` no select; ignora |
| Carteira = 0 (assessor sem clientes) | Cálculo dá variável = 0. Snapshot tem só fixo. |
| Sócio tenta editar snapshot já aprovado | Action rejeita: "Mês já aprovado, não pode ajustar" |
| Sem snapshots pendentes no mês | "Aprovar mês" disabled; Fechamento mostra "Nenhum mês pendente" |
| Ajuste manual reverter pra valor original | Sócio digita `valor_variavel = valor_calculado_original`. Sistema detecta `ajuste_manual = 0`, limpa `justificativa_ajuste` |
| Snapshot com `valor_total < 0` (estorno extremo) | Permitido durante ajuste mas botão "Aprovar mês" fica disabled |
| Auto-notificação no `mes_aprovado` | Sócio aprova → `source_user_id = sócio.id` exclui o próprio se ele estiver na lista (não estará — sócios não têm snapshot) |

---

## 8. Integração com outras fases

| Fase | Como integra |
|---|---|
| **Fase 4 (Audit)** | `logAudit` com acao `"approve"` (já existe). Captura ajuste e aprovação. |
| **Fase 5 (Audiovisual Chefe)** | Calculator usa fórmula igual Coord pra esse role. Permission `view:client_money_all` já permite ver carteira. |
| **Fase 6 (Notificações)** | Triggers `mes_aguardando_aprovacao` (no generator) e `mes_aprovado` (no approveMonthAction). Já estão na seed das `notification_rules` — funcionam imediatamente. |

---

## 9. Testes

### Unit (`tests/unit/`)

**`comissoes-calculator.test.ts`** — fórmulas (8 cases):
- Assessor com carteira de R$ 10.000 e 5% → variável = R$ 500
- Coordenador com agência total R$ 50.000 e 3% → variável = R$ 1.500
- Audiovisual Chefe com agência total R$ 50.000 e 2% → variável = R$ 1.000
- Comercial com 2 deals (R$ 4.500 e R$ 6.200) e 25% → variável = R$ 2.675 + 2 items
- Comercial sem deals no mês → variável = 0, 1 item (fixo)
- ADM → só fixo, 1 item
- Videomaker → só fixo, 1 item
- Sócio → função retorna `null` (não gera snapshot)

**`comissoes-generator.test.ts`** (3 cases):
- Idempotência: rodar 2x mesmo mês não duplica
- Skip Sócio: profile com role=`socio` não vira snapshot
- Skip Inativos: profile.ativo=false não vira snapshot

**`comissoes-actions.test.ts`** (4 cases):
- `adjustSnapshotAction` recalcula `ajuste_manual` corretamente
- `adjustSnapshotAction` rejeita justificativa < 5 chars
- `adjustSnapshotAction` rejeita snapshot já aprovado
- `approveMonthAction` rejeita se algum snapshot tem `valor_total < 0`

### E2E (`tests/e2e/comissoes.spec.ts`)

- 3 rotas redirecionam pra login quando não auth
- Endpoint `/api/cron/monthly-snapshot` retorna 401 sem CRON_SECRET

---

## 10. Cobertura do spec — seção 5.7

| Spec | Coberto por |
|---|---|
| Tabelas `commission_snapshots` + `_items` | Seção 2 |
| 3 fórmulas (assessor, coord, comercial) | Seção 3 (calculator) |
| Audiovisual Chefe = Coordenador | Seção 3 (mesma fórmula) |
| Cron 1º do mês | Seção 4 (vercel.json + endpoint) |
| Sócio aprova em /comissoes/fechamento | Seção 5 (página) + Seção 6 (action) |
| Ajuste manual com motivo | Seção 6 (adjustSnapshotAction + AdjustmentModal) |
| Audit log nas mudanças | Seção 6 (logAudit em adjust + approve) |
| Sub-aba Visão geral | Seção 5 |
| Sub-aba Minhas comissões com detalhamento de carteira | Seção 5 (CommissionBreakdown) |
| Sub-aba Fechamento | Seção 5 |
| Previsão tempo real | Seção 3 (`previewMyCommission`) |
| % atual no momento da geração | Seção 3 (calculator usa profile state) |
| Sócio sem comissão | Seção 2 + 3 (skip explícito) |
| Notificação `mes_aguardando_aprovacao` | Seção 4 (dispatch no fim do generator) |
| Notificação `mes_aprovado` | Seção 6 (dispatch no approveMonthAction) |

---

## 11. Estimativa

- **~14 commits**
- **1 migration** (`20260427000015_commission_snapshots.sql`) com 2 enums + 2 tabelas + RLS
- **1 cron novo** (vercel.json slot 2 + endpoint /api/cron/monthly-snapshot)
- **9 componentes novos**
- **4 páginas** novas (page.tsx redirecionador + minhas + visao-geral + fechamento)
- **2 server actions** (ajustar + aprovar) + 1 calculator + 1 generator + 1 preview
- **3 test suites unit** + 1 e2e
- Sem dependências novas

---

## 12. Aprovação

Brainstorming concluído com a usuária em 2026-04-27. Decisões registradas:
- Fase 7 = Comissões (5.7) com escopo cheio (cron + cálculo + UI + aprovação + audit + integração Fase 6)
- Ajuste manual via inline edit + modal de justificativa
- Cron `0 3 1 * *` (00:00 BRT dia 1)
- Aprovação imutável (sem reabrir; correções viram compensação no mês seguinte)
- Página /comissoes/minhas mostra detalhamento de carteira/deals por papel
- Sócios redirecionam pra /comissoes/visao-geral (não têm comissão própria)

Próximo passo: skill `writing-plans` gera o plano detalhado de execução em `docs/superpowers/plans/2026-04-27-fase-7-comissoes.md`.
