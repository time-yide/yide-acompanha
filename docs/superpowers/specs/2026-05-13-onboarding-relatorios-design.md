# Dashboard de relatórios do onboarding

**Data:** 2026-05-13
**Status:** Aprovado, em execução autônoma

## Contexto

`/onboarding` hoje é só o Kanban + leads perdidos. Falta uma visão
analítica do funil de aquisição (do gasto em tráfego até a venda
fechada e seu valor) com visual premium SaaS.

## Estado atual

- `/onboarding/page.tsx` — header + KanbanBoard, sem sub-navegação.
- `/onboarding/perdidos/page.tsx` — lista de perdidos, navegada via botão no header da página principal.
- Tabelas existentes: `leads` (com `stage`, `created_at`, `data_fechamento`, `valor_proposto`), `clients` (com `valor_trafego_google`, `valor_trafego_meta`), `meetings` (com `starts_at`, `status` — mas módulo em Fase 0/1 sem inserts produtivos).

## Mudanças

### Rotas

- **Nova:** `/onboarding/relatorios` — server component que monta o dashboard.
- **Sub-nav** (tabs) renderizadas nas 3 páginas: `/onboarding`, `/onboarding/perdidos`, `/onboarding/relatorios`. Item ativo destacado com glow teal.
- `/onboarding/novo` e `/onboarding/[id]` continuam sem tabs (são fluxos de detalhe, não da sub-seção).
- Permissão herdada do `/onboarding`: `adm, socio, comercial, assessor, coordenador, audiovisual_chefe`.

### Data layer

**Novo:** `src/lib/onboarding-relatorios/queries.ts`.

Tipos públicos:
```ts
type PeriodKey = "este_mes" | "mes_passado" | "ultimos_3_meses" | "este_ano";

interface FunilStep {
  key: "gasto_total" | "leads_pagos" | "leads_organicos" | "leads_gerados"
       | "reunioes" | "vendas_fechadas" | "valor_vendas";
  label: string;
  valor: number;
  formato: "moeda" | "numero";
  placeholder?: boolean; // true = origem não classificada ainda
}

interface MetricCards {
  cpl: number | null;
  cac: number | null;
  conversao: number | null; // %
  roi: number | null;       // %
  ticket_medio: number | null;
}

interface RelatorioData {
  funil: FunilStep[];
  metricas: MetricCards;
  period: { from: Date; to: Date };
}

async function getOnboardingRelatorios(period: PeriodKey): Promise<RelatorioData>;
function periodToRange(period: PeriodKey): { from: Date; to: Date };
function isValidPeriodKey(s: unknown): s is PeriodKey;
```

Cálculos:
- **Gasto total**: `SUM(valor_trafego_google + valor_trafego_meta)` dos `clients` ativos (status='ativo', deleted_at null). NOTA: esse valor é mensal por cliente; pra `ultimos_3_meses`/`este_ano` multiplicamos pelo número de meses do período. Pra `este_mes`/`mes_passado` é direto.
- **Leads pagos** = 0 (placeholder, sem campo `origem` em `leads`).
- **Leads orgânicos** = 0 (mesmo).
- **Leads gerados** = `COUNT(leads WHERE created_at IN period)`.
- **Reuniões realizadas** = `COUNT(meetings WHERE starts_at IN period AND status='realizada')` — provavelmente 0 enquanto módulo não está produtivo.
- **Vendas fechadas** = `COUNT(leads WHERE stage='ativo' AND data_fechamento IN period)`.
- **Valor em vendas** = `SUM(leads.valor_proposto)` do mesmo set.
- **CPL** = gasto / leads_gerados (null se leads_gerados=0).
- **CAC** = gasto / vendas_fechadas (null se vendas=0).
- **Conversão** = vendas / leads_gerados × 100.
- **ROI** = (valor_vendas − gasto) / gasto × 100. Pode ser negativo.
- **Ticket médio** = valor_vendas / vendas_fechadas.

### Componentes

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `src/components/onboarding/TabsOnboarding.tsx` | Server | Sub-nav reusável (Kanban / Perdidos / Relatórios), item ativo destacado |
| `src/components/onboarding-relatorios/PeriodSelector.tsx` | Client | Dropdown de período, atualiza search param via `useRouter` |
| `src/components/onboarding-relatorios/FunilConversao.tsx` | Server | 7 barras horizontais com gradiente teal, larguras proporcionais com mínimo monotônico, taxa de conversão entre etapas, animação CSS de entrada |
| `src/components/onboarding-relatorios/MetricCards.tsx` | Server | Grid 5 cards (CPL, CAC, Conversão, ROI, Ticket médio) com glow teal sutil |

### Visual — premium dark + glow teal

- Background da página: padrão (já dark do projeto)
- Cards: `bg-card` + `border-primary/20` + glow sutil `shadow-[0_0_24px_-12px] shadow-primary/40`
- Barras do funil: `bg-gradient-to-r from-primary via-primary/85 to-primary/40` + leve `shadow-primary/30`
- Glow ativo no item de tab atual
- Tipografia: header `text-3xl font-bold tracking-tight`, métricas grandes `tabular-nums`
- Espaçamento generoso: `gap-6`, `p-6`/`p-8` nos cards

### Animações

CSS `@keyframes` em uma classe utilitária:
- `.animate-funil-grow` — width 0 → final em 800ms ease-out, com `animation-delay` em incrementos de 80ms por barra (stagger).
- `.animate-card-rise` — opacity 0 → 1 + translateY 8px → 0, 400ms, stagger 60ms.
- Sem animação infinita (pulse, etc.) — só entrada elegante.

### Largura proporcional do funil

- Maior valor do funil = 100% de largura.
- Cada barra abaixo tem largura proporcional ao seu valor, **mas com floor monotônico**: largura nunca cresce com a etapa seguinte (mesmo que dado real cresça, ex.: valor de vendas > gasto, a barra abaixo é capada pra ≤ etapa anterior, mantendo a forma de funil).
- Largura mínima visível: 10% (pra valores muito baixos não sumirem).

### Taxa de conversão entre etapas

- Pequeno chip cinza entre cada par de barras consecutivas: `↓ {(menor/maior * 100).toFixed(1)}%`
- Se etapa anterior é zero, mostra `—` em vez do chip.

### Placeholder pra etapas não-coletadas

Pras 3 etapas que vão sempre vir zeradas em produção hoje (leads pagos, orgânicos, reuniões):
- Mostrar barra mínima visível (10%)
- Badge `Em breve` em cinza ao lado do label, com tooltip explicando que a fonte de dados está em construção.

### Permissões

Mesma `ROLES_PERMITIDOS` da `/onboarding`.

### Edge cases

- Cliente sem `valor_trafego_*` → contribuição zero (não quebra SUM).
- Sem nenhum lead/cliente no período → funil renderiza com zeros + estrutura intacta.
- Divisão por zero nas métricas → `null`, card mostra `—`.
- ROI negativo → mostra com sinal e cor vermelha sutil.

### Testes

Unit em `tests/unit/onboarding-relatorios-queries.test.ts`:
- `periodToRange` retorna ranges corretos pros 4 presets (mock data).
- `isValidPeriodKey` valida os 4 + rejeita lixo.
- Cálculo de CPL/CAC/Conversão/ROI/Ticket — casos normais + div/0 → null.

## Fora de escopo (v2+)

- Classificação de origem dos leads (pagos vs orgânicos) — precisa nova coluna em `leads` + UI de cadastro.
- Reuniões realizadas reais — depende do módulo de reuniões maturar.
- Filtro custom de período (date range picker).
- Comparação com período anterior (ex.: "+12% vs mês passado").
- Drill-down por origem/canal/campanha.
- Export PDF/CSV.
