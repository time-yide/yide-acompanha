# Fase 9 — Dashboard (Yide Digital) — Design Spec

**Status:** Aprovado em 2026-04-28
**Spec mãe:** [2026-04-26-sistema-acompanhamento-design.md](./2026-04-26-sistema-acompanhamento-design.md) seção 5.9
**Plano anterior:** Fase 8 — Satisfação + IA (mergeado em main, commit `5d86138`)

## 1. Objetivo

Substituir o stub atual em `src/app/(authed)/page.tsx` por um Dashboard funcional para os papéis **Sócio** e **ADM**. Demais papéis (Coordenador, Assessor, Comercial) ficam para uma fase posterior — recebem o mesmo stub de saudação atual com aviso de "em breve".

O Dashboard agrega dados que já existem no banco (clientes, commission_snapshots, satisfaction_synthesis, calendar_events) em uma única tela: 4 KPIs no topo, 2 gráficos, e 3 painéis-lista. Sem novas tabelas.

## 2. Escopo

### 2.1 Dentro do escopo

- 1 nova rota: `/` (substitui o stub) — renderização condicional por papel
- Para `socio` e `adm`: dashboard completo
- Para outros papéis: mantém o stub atual (saudação + aviso "em breve")
- 4 KPIs com deltas mês-a-mês
- 2 gráficos (linha 12 meses, barras agrupadas 6 meses)
- 3 painéis-lista (carteira por assessor, ranking satisfação, próximos eventos)
- Alerta condicional no topo (mês de comissão aguardando aprovação)
- Biblioteca de gráficos: `recharts`

### 2.2 Fora do escopo (para fases futuras)

- Dashboard do Coordenador → Fase 9.1
- Dashboard do Assessor → Fase 9.1
- Dashboard do Comercial → Fase 9.1 (junto com Fase 10 Prospecção)
- Drill-down ao clicar em KPIs/gráficos
- Customização da ordem ou visibilidade dos blocos
- Export PDF/Excel do dashboard
- Datas customizadas (sempre últimos 12/6 meses, hoje, etc.)
- Alertas além do "mês aguardando aprovação"

## 3. Arquitetura

### 3.1 Estrutura de arquivos

```
src/app/(authed)/page.tsx                                  [REPLACE]
src/lib/dashboard/
  queries.ts                                               [NEW]
src/components/dashboard/
  KpiCard.tsx                                              [NEW]
  KpiRow.tsx                                               [NEW]
  ChartCarteiraTimeline.tsx                                [NEW — client]
  ChartEntradaChurn.tsx                                    [NEW — client]
  CarteiraPorAssessorList.tsx                              [NEW]
  RankingResumo.tsx                                        [NEW]
  ProximosEventosList.tsx                                  [NEW]
  AlertaAprovacao.tsx                                      [NEW]
tests/unit/
  dashboard-queries.test.ts                                [NEW]
package.json                                               [MODIFY — +recharts]
```

### 3.2 Permissão e roteamento

- `/` continua sendo a rota inicial após login.
- A page faz `requireAuth()` e checa `user.role`:
  - Se `socio` ou `adm`: renderiza `<SocioAdmDashboard />` (todo o conteúdo descrito abaixo).
  - Senão: renderiza o `<StubGreeting />` (componente extraído do código atual com texto "Dashboard do seu papel chega na próxima fase").
- Não cria policy nova de RLS — todas as queries usam o cliente Supabase com cookie do usuário (RLS existente cuida do escopo). Para Sócio/ADM, RLS atual já permite leitura ampla.

### 3.3 Queries — `src/lib/dashboard/queries.ts`

Todas as funções são `async`. Server-only. Rodam em paralelo via `Promise.all` na page.

**`getKpis(): Promise<KpiData>`**
Retorna os 4 KPIs e seus deltas:
```ts
interface KpiData {
  carteiraAtiva: { valor: number; deltaValor: number };          // soma valor_mensal status='ativo' e delta vs mês anterior
  clientesAtivos: { quantidade: number; deltaQuantidade: number };
  churnMes: { quantidade: number; valorPerdido: number };        // count + soma valor_mensal de clientes com data_churn no mês corrente
  custoComissaoPct: { pct: number };                             // soma do último commission_snapshot / soma valor_mensal carteira ativa
}
```

**`getCarteiraTimeline(months: number = 12): Promise<TimelinePoint[]>`**
Para cada um dos últimos N meses, calcula:
- `mes`: `'YYYY-MM'`
- `valorTotal`: soma de `valor_mensal` de clientes onde `data_entrada <= último_dia_do_mês AND (data_churn IS NULL OR data_churn > último_dia_do_mês)`

**`getEntradaChurn(months: number = 6): Promise<EntradaChurnPoint[]>`**
Para cada um dos últimos N meses:
- `mes`: `'YYYY-MM'`
- `entradas`: count de clientes onde `data_entrada` está no mês
- `churns`: count de clientes onde `data_churn` está no mês

**`getCarteiraPorAssessor(): Promise<AssessorCarteira[]>`**
Para cada assessor com pelo menos 1 cliente ativo:
- `assessorId`, `assessorNome`
- `qtdClientes`, `valorTotal`, `pctDoTotal`
Ordenado por `valorTotal` decrescente.

**`getRankingSatisfacao(): Promise<{ top: SynthesisRow[]; bottom: SynthesisRow[] }>`**
Reusa `getSynthesisForWeek()` da Fase 8. Se a semana atual ainda não tem síntese, usa a anterior. Top = 3 com cor 'verde' ordenado por score desc. Bottom = 2 priorizando 'vermelho' depois 'amarelo' por score asc.

**`getProximosEventos(days: number = 30, limit: number = 10): Promise<EventoRow[]>`**
Próximos N eventos do calendário entre hoje e hoje+30. Inclui o sub-calendário e o título.

**`getMesAguardandoAprovacao(): Promise<{ mes: string } | null>`**
Retorna o `mes_referencia` do snapshot mais recente com `aprovado=false`, ou null.

### 3.4 Componentes UI

**`<KpiCard>`** (server component)
- Props: `label`, `valor` (formatado), `delta?` (formatado com seta ▲/▼ e cor), `icon`
- Card com tag de KPI no topo, valor grande, delta pequeno embaixo

**`<KpiRow>`** (server component)
- Renderiza 4 `<KpiCard>` em grid responsivo (1 col mobile, 2 col tablet, 4 col desktop)
- Recebe a lista de KPIs como prop

**`<ChartCarteiraTimeline>`** (`"use client"`)
- Recebe array `TimelinePoint[]`
- Renderiza `<LineChart>` do `recharts` com tooltip, eixos, gradient fill leve sob a linha
- Cores: linha primária (verde teal Yide), eixos com classe Tailwind `text-muted-foreground`

**`<ChartEntradaChurn>`** (`"use client"`)
- Recebe `EntradaChurnPoint[]`
- Renderiza `<BarChart>` com 2 séries agrupadas (Entradas verde, Churns vermelho)
- Tooltip mostra ambos valores

**`<CarteiraPorAssessorList>`** (server)
- Recebe `AssessorCarteira[]`
- Para cada item: nome, count clientes, valor total formatado, barra horizontal de progresso (% do total)
- Caso vazio: mensagem "Sem assessores com clientes ativos"

**`<RankingResumo>`** (server)
- Recebe `{ top, bottom }`
- 2 colunas: "Mais satisfeitos" (verde) e "Menos satisfeitos" (vermelho)
- Cada linha: medal emoji + nome + score + sparkline mini (reusa `<SatisfactionSparkline>` da Fase 8)
- Link "Ver completo →" no final pra `/satisfacao`
- Caso sem dados: "Sem sínteses disponíveis ainda"

**`<ProximosEventosList>`** (server)
- Recebe `EventoRow[]`
- Para cada item: ícone do sub-calendário (cor), data formatada (Hoje, Amanhã, ou DD/MMM), título, sub-calendário em texto pequeno
- Link "Ver agenda →" no final
- Caso vazio: "Sem eventos nos próximos 30 dias"

**`<AlertaAprovacao>`** (server)
- Recebe `{ mes: string } | null`
- Se null, retorna null (não renderiza)
- Se com mês: banner amarelo full-width com texto "Mês de [Março/2026] aguardando aprovação" + botão "Revisar agora →" pra `/comissoes/fechamento`

### 3.5 Layout final da page

```tsx
<div className="space-y-6">
  <header>
    <h1>Olá, {user.nome.split(" ")[0]}</h1>
    <p>Visão geral da agência</p>
  </header>

  <AlertaAprovacao mes={mesAprovacao} />

  <KpiRow kpis={kpis} />

  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <Section title="Evolução da carteira" subtitle="Últimos 12 meses">
      <ChartCarteiraTimeline data={carteiraTimeline} />
    </Section>
    <Section title="Entrada vs Churn" subtitle="Últimos 6 meses">
      <ChartEntradaChurn data={entradaChurn} />
    </Section>
  </div>

  <Section title="Carteira por assessor">
    <CarteiraPorAssessorList items={carteiraPorAssessor} />
  </Section>

  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <Section title="Satisfação" cta={{ href: "/satisfacao", label: "Ver completo →" }}>
      <RankingResumo top={topSatisfacao} bottom={bottomSatisfacao} />
    </Section>
    <Section title="Próximos eventos" cta={{ href: "/calendario", label: "Ver agenda →" }}>
      <ProximosEventosList eventos={proximosEventos} />
    </Section>
  </div>
</div>
```

`<Section>` é um wrapper visual leve — pode ser inline ou pequeno componente compartilhado.

## 4. Considerações não-funcionais

### 4.1 Performance

- Todas as queries rodam em paralelo via `Promise.all`. Tempo de render esperado: <500ms para volumes de até 500 clientes / 50 colaboradores.
- Sem cache adicional. Se o volume crescer, considerar `unstable_cache` com revalidate de 5 min em uma fase futura.
- Charts renderizam client-side via dynamic import — não bloqueiam SSR inicial.

### 4.2 Acessibilidade

- Todos os charts têm `aria-label` descritivo + tabela alternativa em screen reader (`<VisuallyHidden>` com os dados).
- Cores não são o único indicador (ícones + texto também).

### 4.3 Mobile

- Grid responsivo: 1 col mobile → 2 col tablet → 4 col desktop nos KPIs.
- Charts com `<ResponsiveContainer>` do recharts.
- Painéis-lista empilham normalmente.

### 4.4 Tema dark/light

- recharts respeita CSS vars do projeto via classes Tailwind.
- Cores das séries: usar `var(--color-primary)`, `var(--color-success)`, `var(--color-destructive)`.

## 5. Tests

### 5.1 Unit (TDD)

`tests/unit/dashboard-queries.test.ts`:
- `getKpis` calcula soma de `valor_mensal` correto + delta mês-a-mês
- `getKpis` retorna 0/0 quando sem clientes
- `getCarteiraTimeline` inclui clientes ativos e exclui churnados no mês X
- `getCarteiraTimeline` retorna 12 pontos mesmo se meses passados estiverem vazios
- `getEntradaChurn` separa entradas de churns no mesmo mês
- `getCarteiraPorAssessor` agrupa corretamente e calcula pct
- `getMesAguardandoAprovacao` retorna null se todos snapshots aprovados

Total: 7-8 testes.

### 5.2 E2E (auth)

Já existe e2e pra `/` (auth-redirect) — não precisa adicionar nada novo.

## 6. Plano de execução resumido (~12 commits)

- **A1**: install `recharts` + commit
- **B1-B7**: queries com TDD (1 commit por função, ~7 commits)
- **C1-C3**: componentes UI compostos (KpiRow + KpiCard, gráficos, listas) — ~3 commits
- **D1**: page.tsx + AlertaAprovacao + Section wrapper — 1 commit
- **D2**: typecheck + push + PR

Plano detalhado virá no documento de implementação.

## 7. Lacunas conhecidas (intencionais)

- Sem testes de integração end-to-end com banco real — mocks de Supabase nas queries
- Sem internacionalização — strings em português hardcoded (consistente com fases anteriores)
- Sem datas customizáveis — sempre últimos 12/6 meses, hoje, etc.
- Sem export — visualização apenas
