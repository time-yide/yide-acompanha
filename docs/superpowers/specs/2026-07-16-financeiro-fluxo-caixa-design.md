# Financeiro — Fluxo de caixa + aportes de capital (peça C)

**Data:** 2026-07-16
**Rota nova:** `/financeiro/caixa` (só sócio)
**Contexto:** 3ª e última peça da melhoria visual do Financeiro (A: gráfico receita×custo×lucro ✅; B: card inadimplência ✅).

## Problema

O `/financeiro` mostra o DRE por **competência** (receita/custo/lucro reconhecidos no mês). Falta a visão de **caixa**: quanto dinheiro de fato entrou e saiu, incluindo **aportes de capital** dos sócios (dinheiro colocado na empresa, que não é receita). A Yasmin quer acompanhar o fluxo de caixa porque o caixa "está meio ruim".

## Decisões (brainstorming)

- **Aportes: detalhado** — data exata, valor, sócio responsável, tipo (capital/empréstimo), descrição.
- **Entrada de caixa = Recebido (pago) + Aportes** (caixa de verdade, não contratado).
- **Local: nova aba `/financeiro/caixa`**, com botão no `/financeiro`.

## Modelo de dados — nova tabela `capital_aportes`

Migration **manual** (Supabase migrations são manuais):

```sql
create table public.capital_aportes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  data date not null,
  valor numeric(12,2) not null check (valor > 0),
  socio_id uuid not null references public.profiles(id),
  tipo text not null default 'capital' check (tipo in ('capital', 'emprestimo')),
  descricao text null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_capital_aportes_org_data on public.capital_aportes(organization_id, data);
create trigger trg_capital_aportes_updated_at
  before update on public.capital_aportes
  for each row execute function public.set_updated_at();
alter table public.capital_aportes enable row level security;
create policy "capital_aportes rw socio" on public.capital_aportes for all to authenticated
  using (public.current_user_role() = 'socio')
  with check (public.current_user_role() = 'socio');
```

## Cálculo — `getFluxoCaixa(meses: string[])`

Server-only, service-role (padrão das queries do financeiro). Para cada mês:

- **Recebido** = soma de `clients.valor_mensal` dos clientes com `client_payments.status = 'pago'` naquele `mes_referencia` (ativos/comuns; a tabela só guarda status, então usa valor_mensal como valor do mês — aproximação, mesma do card de inadimplência).
- **Aportes** = soma de `capital_aportes.valor` cuja `data` cai no mês. **Resiliente**: se a tabela ainda não existe (migration não aplicada), aportes = 0.
- **Entradas** = Recebido + Aportes.
- **Saídas** = custo total do DRE do mês = `custo_servicos.total + salarios + total_despesas` (reusa `getDRE(mes)`, cacheado).
- **Saldo do mês** = Entradas − Saídas.
- **Saldo acumulado** = soma corrente dos saldos, na ordem dos meses.

Tipo de retorno:
```ts
export interface FluxoCaixaPonto {
  mesRef: string;
  recebido: number;
  aportes: number;
  entradas: number;
  saidas: number;
  saldoMes: number;
  saldoAcumulado: number;
}
```

**Caveat:** "recebido" só existe onde há marcação em `client_payments` (hoje 2026 jan–jun backfillado + daqui pra frente). Meses sem marcação → recebido 0. A tela deixa isso claro num aviso e foca na janela recente.

## Server actions — `aportes-actions.ts`

Padrão dos financeiro actions (`"use server"`, `requireSocio()`, zod, `createClient` RLS, `revalidatePath`/`revalidateTag`):

- `createAporteAction(formData)` — campos: data (YYYY-MM-DD), valor (>0), socio_id (uuid), tipo (capital|emprestimo), descricao (opcional). Insere em `capital_aportes` (organization_id do actor, created_by=actor.id).
- `deleteAporteAction(formData)` — id (uuid). Deleta.
- Schemas em `schema.ts` (ou no próprio arquivo).
- Revalida `/financeiro/caixa`.

Nota RLS: a policy libera só `socio`. As actions usam `createClient` (RLS) + `requireSocio()`. Como RLS deny em UPDATE/DELETE é silencioso (memória do projeto), o create/delete usa `.select()` e checa retorno pra detectar bloqueio.

## Tela `/financeiro/caixa`

`src/app/(authed)/financeiro/caixa/page.tsx` — server component, só sócio (redirect senão, igual `/financeiro`).

- Busca `getFluxoCaixa` de 12 meses + lista de aportes + lista de sócios (pro select do form).
- **`FluxoCaixaChart`** (client, recharts ComposedChart): barras Entradas (verde) × Saídas (vermelho) por mês + **linha de Saldo acumulado** (2º eixo ou mesmo eixo). Seletor 6m/12m.
- **Tabela mensal**: mês | recebido | aportes | entradas | saídas | saldo do mês | saldo acumulado.
- **Aportes**: `AporteForm` (data, valor, sócio, tipo, descrição) + `AporteTable` (lista com botão excluir).
- Aviso do caveat de "recebido".
- Botão "Fluxo de caixa" adicionado ao header do `/financeiro`.

## Componentes/arquivos

- **Create migration:** `supabase/migrations/20260716120000_capital_aportes.sql`
- **Create:** `src/lib/financeiro/caixa.ts` (getFluxoCaixa + listAportes + FluxoCaixaPonto/AporteRow)
- **Create:** `src/lib/financeiro/aportes-actions.ts` (create/delete)
- **Create:** `src/app/(authed)/financeiro/caixa/page.tsx`
- **Create:** `src/components/financeiro/FluxoCaixaChart.tsx`
- **Create:** `src/components/financeiro/AporteForm.tsx`
- **Create:** `src/components/financeiro/AporteTable.tsx`
- **Modify:** `src/app/(authed)/financeiro/page.tsx` — botão "Fluxo de caixa" no header.

## Testes

- Unit da action (`createAporteAction`): gate de sócio; valida valor>0 e tipo; insere com organization_id/created_by corretos; delete.
- Verificação: typecheck + eslint dos arquivos alterados. UI conferida no PR.

## Deploy

- **1 migration manual** (`20260716120000_capital_aportes.sql`) via SQL Editor. Graças ao fallback resiliente (aportes=0 se tabela ausente), a tela funciona antes mesmo do SQL — só não mostra aportes até aplicar.
- Branch → PR → CI → merge. Depois, aplicar o SQL.
