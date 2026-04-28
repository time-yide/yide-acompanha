# Fase 10 — Prospecção (área exclusiva do Comercial) — Design Spec

**Status:** Aprovado em 2026-04-28
**Spec mãe:** [2026-04-26-sistema-acompanhamento-design.md](./2026-04-26-sistema-acompanhamento-design.md) seção 5.10
**Plano anterior:** Fase 9.1 — Dashboards Coord/Assessor/Comercial (mergeado em main, commit `b4f4eff`)

## 1. Objetivo

Implementar a área `/prospeccao` exclusiva do setor Comercial (visível também para Sócio e ADM), com 5 sub-páginas dedicadas: lista de prospects com filtros, view detalhada com ações, agenda comercial, histórico de fechamentos, tracker de metas e funil de conversão. Adicionar 3 colunas opcionais de meta em `profiles` para configuração pelo Sócio.

Esta é a **última fase do MVP** previsto na spec mãe. Após o merge, todas as funcionalidades das seções 5.1–5.11 estarão entregues.

## 2. Escopo

### 2.1 Dentro do escopo

- 1 nova rota raiz `/prospeccao` com layout próprio + sub-navegação por abas
- 5 sub-páginas: `/prospeccao/prospects`, `/prospeccao/prospects/[id]`, `/prospeccao/agenda`, `/prospeccao/historico`, `/prospeccao/metas`, `/prospeccao/funil`
- Permissão: Comercial vê só os próprios dados; Sócio/ADM vê todos com filtro
- Migração: 3 colunas opcionais em `profiles` (`meta_prospects_mes`, `meta_fechamentos_mes`, `meta_receita_mes`)
- Quando meta = null: fallback automático (3× fixo / comissao_percent — mesma fórmula da Fase 9.1)
- Ações no detalhe do prospect: "Agendar reunião" (modal → cria calendar_event + atualiza lead) e "Marcar como perdido" (modal com motivo)
- Adicionar tentativa de contato (lead_attempt) no detalhe
- Form `/colaboradores/[id]/editar` ganha 3 campos de meta (visíveis só para Sócio/ADM)
- Reuso de `<ChartFunil>` (Fase 9.1) com filtros novos (período, comercial)
- Reuso de `<ProximasReunioesList>` (Fase 9.1) na agenda

### 2.2 Fora do escopo

- Multi-tenancy (uma agência → uma org). Já é assim em outras tabelas, mantém.
- Drill-down em gráficos → futuro
- Notificação automática de meta atingida → futuro (pode usar Fase 6 depois se quiser)
- Importação em massa de prospects → futuro
- Histórico de metas (mudança de meta mês a mês) → futuro
- Page de gestão centralizada de todas as metas → futuro

## 3. Arquitetura

### 3.1 Estrutura de arquivos

```
supabase/migrations/
└── 20260428000017_profile_metas.sql                       [NEW]

src/app/(authed)/prospeccao/
├── layout.tsx                                             [NEW — role check + tabs nav]
├── page.tsx                                               [NEW — redirect to /prospeccao/prospects]
├── prospects/
│   ├── page.tsx                                           [NEW — lista filtrada]
│   └── [id]/page.tsx                                      [NEW — detalhe + ações]
├── agenda/page.tsx                                        [NEW]
├── historico/page.tsx                                     [NEW]
├── metas/page.tsx                                         [NEW]
└── funil/page.tsx                                         [NEW]

src/lib/prospeccao/
├── queries.ts                                             [NEW — list, detail, historico, metas]
├── actions.ts                                             [NEW — agendar, marcar-perdido, add-attempt]
└── schema.ts                                              [NEW — zod schemas para actions]

src/components/prospeccao/
├── TabsNav.tsx                                            [NEW — client, sub-nav]
├── ProspectsTable.tsx                                     [NEW — server, paginated]
├── ProspectsFilters.tsx                                   [NEW — client, with searchParams]
├── ProspectDetailHeader.tsx                               [NEW — server]
├── LeadAttemptsTimeline.tsx                               [NEW — server, list of attempts]
├── AddAttemptForm.tsx                                     [NEW — client]
├── AgendarReuniaoButton.tsx                               [NEW — client, opens dialog]
├── AgendarReuniaoDialog.tsx                               [NEW — client]
├── MarcarPerdidoButton.tsx                                [NEW — client, opens dialog]
├── MarcarPerdidoDialog.tsx                                [NEW — client]
├── HistoricoFechamentosTable.tsx                          [NEW — server]
├── MetasCards.tsx                                         [NEW — server, 3 cards]
└── FunilFilters.tsx                                       [NEW — client, period + comercial]

src/lib/dashboard/
└── comercial-queries.ts                                   [MODIFY — getFunnelData parametrizado]

src/components/colaboradores/
└── ColaboradorForm.tsx                                    [MODIFY — adicionar 3 campos meta]

src/lib/colaboradores/
├── schema.ts                                              [MODIFY — adicionar fields no zod]
└── actions.ts                                             [MODIFY — propagar metas]

tests/unit/
├── prospeccao-queries.test.ts                             [NEW]
├── prospeccao-actions.test.ts                             [NEW]
└── (existing files modified for getFunnelData parametrization)
```

### 3.2 Migração

`supabase/migrations/20260428000017_profile_metas.sql`:

```sql
alter table public.profiles
  add column if not exists meta_prospects_mes integer,
  add column if not exists meta_fechamentos_mes integer,
  add column if not exists meta_receita_mes numeric(12,2);

-- Sem default. Null = fallback automático (3× fixo / comissao_percent).
-- Sócio/ADM atualiza via /colaboradores/[id]/editar (RLS existente cobre).
```

Sem mudança de RLS — a tabela `profiles` já tem policies existentes que limitam quem pode UPDATE (próprio user ou Sócio/ADM).

### 3.3 Layout `/prospeccao/layout.tsx`

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { TabsNav } from "@/components/prospeccao/TabsNav";

export default async function ProspeccaoLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  if (!["socio", "adm", "comercial"].includes(user.role)) notFound();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Prospecção</h1>
        <p className="text-sm text-muted-foreground">Ferramentas do setor Comercial</p>
      </header>
      <TabsNav />
      <div>{children}</div>
    </div>
  );
}
```

`/prospeccao/page.tsx` redireciona pra `/prospeccao/prospects` (default).

`<TabsNav>`: client component que renderiza 5 abas com `usePathname()` pra destacar a ativa.

### 3.4 Sub-página: Prospects (`/prospeccao/prospects`)

Server page recebe `searchParams`:
- `status` — multi-select (`prospeccao`, `comercial`, `contrato`, `marco_zero`, `ativo`, `perdido` — onde "perdido" = motivo_perdido != null)
- `comercial_id` — só Sócio/ADM (Comercial sempre filtra pelo próprio)
- `valor_min`, `valor_max` — range de valor_proposto
- `ultimo_contato_apos` — data mínima do último lead_attempt

Query: `getProspectsList({ comercialId, status?, valorMin?, valorMax?, ultimoContatoApos? })`

`<ProspectsFilters>`: client component que controla filtros via URL searchParams (Next.js padrão).
`<ProspectsTable>`: tabela com colunas: Nome | Site | Stage | Valor proposto | Comercial | Último contato | Ações.

Cada linha clica → `/prospeccao/prospects/[id]`.

### 3.5 Sub-página: Detalhe do Prospect (`/prospeccao/prospects/[id]`)

Layout vertical:

```tsx
<ProspectDetailHeader prospect={lead} />     // dados + stage badge + valor + comercial
<div className="flex gap-2">
  <AgendarReuniaoButton leadId={lead.id} />
  <MarcarPerdidoButton leadId={lead.id} />
</div>
<AddAttemptForm leadId={lead.id} />          // form pra adicionar tentativa
<LeadAttemptsTimeline attempts={attempts} /> // lista cronológica
```

**Permissão:** Comercial vê só os seus próprios; Sócio/ADM vê tudo. Em produção: 404 se Comercial tentar acessar lead que não é dele.

**`<AgendarReuniaoDialog>`** — client component:
- Tipo: `"prospeccao_agendada"` ou `"marco_zero"` (radio)
- Data e hora (input datetime-local)
- Descrição opcional (textarea)
- Submit chama action `agendarReuniaoAction`:
  - Cria `calendar_events` com `sub_calendar='agencia'`, `criado_por=user.id`, `participantes_ids=[user.id]`, `lead_id=lead.id`, `titulo="Reunião com [nome_prospect]"`, descrição custom
  - Atualiza `leads.data_prospeccao_agendada` ou `data_reuniao_marco_zero` conforme tipo
  - Move stage: se atual='prospeccao' e tipo='prospeccao_agendada' → mantém prospeccao (já está em prospecção). Se tipo='marco_zero' → move pra `marco_zero`. (Stages avançam manualmente; não force.)
  - Logs em `audit_log`

**`<MarcarPerdidoDialog>`** — client component:
- Textarea: motivo
- Submit chama `marcarPerdidoAction`:
  - Atualiza `leads.motivo_perdido = motivo`
  - **Não** muda o stage (a spec diz "perdido" mas não tem stage 'perdido'; usa `motivo_perdido` como flag)
  - Logs em audit_log

**`<AddAttemptForm>`** — client component:
- Canal (select de `attempt_channel`)
- Resultado (select de `attempt_result`)
- Próximo passo (textarea curto)
- Data próximo passo (date)
- Observação (textarea)
- Submit chama `addLeadAttemptAction` que insere em `lead_attempts`

### 3.6 Sub-página: Agenda (`/prospeccao/agenda`)

Reusa diretamente `<ProximasReunioesList>` da Fase 9.1. Lista das próximas 14 dias (configurável via searchParam `?days=30`).

Sócio/ADM tem dropdown de comercial (default: nada selecionado = "todos os comerciais").
Comercial: lista as próprias.

### 3.7 Sub-página: Histórico de fechamentos (`/prospeccao/historico`)

Query nova `getHistoricoFechamentos(comercialId, monthsBack=12)`:
- Lê leads onde `stage='ativo'` AND `data_fechamento >= hoje-12meses` AND `comercial_id = comercialId`
- Pra cada lead: join com `clients` (via `client_id`) pra pegar `nome` e `valor_mensal` atual
- Pra cada lead: lookup em `commission_snapshots` pelo `mes_referencia = data_fechamento.slice(0,7)` AND `user_id = comercialId` pra pegar `valor_total` (comissão recebida no mês do fechamento)

Retorna:
```ts
interface HistoricoFechamento {
  leadId: string;
  clienteId: string | null;
  clienteNome: string;
  valorMensal: number;
  dataFechamento: string; // 'YYYY-MM-DD'
  comissaoRecebida: number; // pode ser 0 se snapshot não existir ainda
}
```

Sócio/ADM: dropdown de comercial. Comercial: só os próprios.

`<HistoricoFechamentosTable>`: tabela com 4 colunas (Cliente, Valor mensal, Data fechamento, Comissão recebida) + total acumulado de comissão no topo.

### 3.8 Sub-página: Metas (`/prospeccao/metas`)

Query `getMetasComercial(userId, now=new Date())`:
- Lê `profiles.meta_prospects_mes`, `meta_fechamentos_mes`, `meta_receita_mes`, `fixo_mensal`, `comissao_percent`
- Calcula realizado no mês corrente:
  - `realizadoProspects` = count de leads onde `comercial_id=userId AND created_at` no mês corrente
  - `realizadoFechamentos` = count de leads onde `comercial_id=userId AND stage='ativo' AND data_fechamento` no mês corrente
  - `realizadoReceita` = soma de `valor_proposto` desses leads fechados
- Pra cada métrica:
  - Se meta configurada (não null) → usa
  - Senão fallback automático:
    - Prospects abordados: 20/mês (constante razoável)
    - Fechamentos: 3/mês (constante)
    - Receita: `(3 × fixo) / (comissao_percent / 100)` (mesma fórmula da Fase 9.1)
- Calcula `pctMeta` e `status` (abaixo/no-caminho/perto/atingido) pra cada métrica

Retorna estrutura com 3 metas:
```ts
interface MetasComercial {
  prospects: { meta: number; realizado: number; pctMeta: number; status: "abaixo" | "no-caminho" | "perto" | "atingido"; configurada: boolean };
  fechamentos: { meta: number; realizado: number; pctMeta: number; status: "abaixo" | "no-caminho" | "perto" | "atingido"; configurada: boolean };
  receita: { meta: number; realizado: number; pctMeta: number; status: "abaixo" | "no-caminho" | "perto" | "atingido"; configurada: boolean };
}
```

`<MetasCards>`: 3 cards lado a lado (grid 1col mobile / 3col desktop). Cada card mostra:
- Label da métrica
- Valor realizado (grande)
- Texto: "Meta: X · Y% atingido"
- Barra de progresso colorida por status
- Footer: "Configurada pelo sócio" se configurada=true, senão "Automática"

Sócio/ADM: dropdown de comercial. Comercial: só os próprios.

### 3.9 Sub-página: Funil (`/prospeccao/funil`)

Query `getFunnelData` da Fase 9.1 — refator para aceitar:
- `comercialId?: string` (não passado = todos)
- `periodMonths?: number` (default 12) — só conta leads criados nos últimos N meses

Retorna o mesmo formato (5 stages com count + totalValor) + adicional `taxaConversao` entre cada par consecutivo.

Nova interface:
```ts
interface FunnelStageWithConversion extends FunnelStage {
  taxaConversaoAposEsta: number | null; // % que avançou pra próxima
}
```

Calcula `taxaConversaoAposEsta`: pra cada estágio i, % = (leads no estágio i+1 ou superior) / (leads no estágio i ou superior) × 100. Stage `ativo` (último) → null.

`<ChartFunil>` da Fase 9.1 reusa direto. Adicionar abaixo:
- Tabela de "Taxa de conversão entre estágios" (4 linhas, uma por par consecutivo)
- Card no topo: "Ticket médio fechado no período"

`<FunilFilters>`: client component com dropdown de período (3/6/12 meses) + dropdown de comercial (só Sócio/ADM).

### 3.10 Atualização do form `/colaboradores/[id]/editar`

Adicionar 3 inputs no `<ColaboradorForm>` em uma nova seção "Metas comerciais (opcional)":
- Meta de prospects abordados/mês (number, opcional)
- Meta de fechamentos/mês (number, opcional)
- Meta de receita/mês (R$, opcional)

Visíveis sempre, mas editáveis só se `user.role` ∈ {`socio`, `adm`} (input `disabled` para Comercial vendo o próprio perfil).

Atualizar zod schema do form (`src/lib/colaboradores/schema.ts`) com 3 fields opcionais.

Atualizar `updateColaboradorAction` (`src/lib/colaboradores/actions.ts`) pra propagar os 3 campos novos. Permission check existente já cobre.

## 4. Considerações não-funcionais

### 4.1 Performance

- Lista de prospects: query única com filtros aplicados no Supabase (não em memória). Paginação: limit 50 por padrão.
- Detalhe do prospect: 3 queries em paralelo (lead + lead_attempts + profiles do comercial).
- Histórico: 1 query nos leads + N queries em commission_snapshots (até 12, uma por mês). Aceitável.
- Funil com filtros: query única filtrada.

### 4.2 Mobile

- Tabs viram dropdown em mobile (responsive — `md:flex` pros tabs, dropdown em mobile).
- Tabela de prospects vira cards empilhados em mobile.
- Modais são full-screen em mobile.

### 4.3 Acessibilidade

- Modais com focus trap (já é o padrão do Base UI Dialog).
- Filtros têm labels explícitos.
- Status de meta tem texto + cor (não só cor).

## 5. Tests

### 5.1 Unit (TDD onde possível)

`tests/unit/prospeccao-queries.test.ts`:
- `getProspectsList` filtra por `comercialId` corretamente
- `getProspectsList` aplica filtros de status/valor/último contato
- `getHistoricoFechamentos` une leads com clients e commission_snapshots
- `getHistoricoFechamentos` retorna comissão 0 quando snapshot não existe
- `getMetasComercial` usa meta configurada quando não-null
- `getMetasComercial` usa fallback automático quando meta é null
- `getMetasComercial` calcula pctMeta e status corretamente
- `getFunnelData` parametrizado: filtra por comercialId + period
- `getFunnelData` calcula taxaConversaoAposEsta corretamente

`tests/unit/prospeccao-actions.test.ts`:
- `agendarReuniaoAction` cria evento e atualiza lead.data_prospeccao_agendada
- `agendarReuniaoAction` valida tipo e data
- `marcarPerdidoAction` atualiza lead.motivo_perdido
- `addLeadAttemptAction` insere em lead_attempts

Total: ~13 testes novos.

### 5.2 E2E (auth)

3 e2e tests novos: redirect pra login quando não autenticado nas rotas `/prospeccao`, `/prospeccao/prospects`, `/prospeccao/historico`.

## 6. Plano de execução resumido (~17 commits)

- **A1**: migração `profile_metas`
- **A2**: regenerar tipos
- **B1**: refator `getFunnelData` com filtros (TDD)
- **B2**: `getProspectsList` query (TDD)
- **B3**: `getProspectDetail` + `getLeadAttempts` queries (TDD)
- **B4**: `getHistoricoFechamentos` (TDD)
- **B5**: `getMetasComercial` (TDD)
- **B6**: server actions: agendarReuniao, marcarPerdido, addLeadAttempt (TDD)
- **C1**: layout + TabsNav + redirect page
- **C2**: ProspectsTable + ProspectsFilters + lista
- **C3**: ProspectDetailHeader + LeadAttemptsTimeline + AddAttemptForm
- **C4**: AgendarReuniaoDialog + MarcarPerdidoDialog (botões + modais)
- **C5**: agenda page
- **C6**: histórico page (HistoricoFechamentosTable)
- **C7**: metas page (MetasCards)
- **C8**: funil page (com filtros + conversão entre estágios)
- **D1**: ColaboradorForm com 3 campos de meta + e2e tests + push + PR

Plano detalhado virá no documento de implementação.

## 7. Lacunas conhecidas (intencionais)

- Sem histórico de mudanças de meta (snapshot mês a mês) → futuro
- Sem alerta automático quando meta atingida → pode usar Fase 6 depois
- Sem importação em massa de prospects → futuro
- Sem comparação entre comerciais → futuro
- "Marcar como perdido" não muda o stage do lead — só seta `motivo_perdido`. Stage continua sendo o que era. Filtros incluem "perdido" como pseudo-status (motivo_perdido != null).
