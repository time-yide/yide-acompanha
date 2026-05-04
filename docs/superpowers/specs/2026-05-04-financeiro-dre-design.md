# Financeiro — DRE + Despesas (Phase 1)

**Status:** Aprovado, pronto pra implementar.
**Escopo:** Nova aba `/financeiro` (só sócio) com DRE mensal e CRUD/bulk-import de despesas. Combina dados já existentes (receita de clientes, comissões, salários, tráfego pago) com despesas manuais cadastradas.
**Fora do escopo:** Cálculo automático de impostos, integração contábil/ERP, fluxo de caixa, projeções, exportação de DRE pra PDF.

## Motivação

Sócio precisa fechar o mês com visão clara: receita, custos diretos (comissões + tráfego), salários, despesas operacionais, lucro. Hoje os dados estão espalhados (clientes, comissões, painel mensal) e despesas tipo aluguel/software/impostos não existem em lugar nenhum.

## Modelo de dados

### Novas tabelas

#### `expenses`

Catálogo de despesas — uma linha por despesa fixa OR uma linha por lançamento avulso.

```sql
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  descricao text not null,
  categoria text not null check (categoria in (
    'aluguel', 'software', 'contabilidade', 'impostos',
    'marketing_proprio', 'equipamento', 'pro_labore', 'outros'
  )),
  tipo text not null check (tipo in ('fixa', 'avulsa')),

  -- Pra fixa: valor padrão mensal (pode ser overrideado por mês via expense_overrides)
  -- Pra avulsa: valor único do lançamento
  valor numeric(14, 2) not null check (valor >= 0),

  -- Só pra avulsa: mês do lançamento (formato 'YYYY-MM')
  mes_referencia text null check (
    (tipo = 'avulsa' and mes_referencia ~ '^\d{4}-\d{2}$')
    or (tipo = 'fixa' and mes_referencia is null)
  ),

  -- Pra fixa: data de início (default = data de criação) e fim (null = ainda ativa)
  -- Mês de início inclusivo, mês de fim exclusivo
  inicio_mes text null check (inicio_mes is null or inicio_mes ~ '^\d{4}-\d{2}$'),
  fim_mes text null check (fim_mes is null or fim_mes ~ '^\d{4}-\d{2}$'),

  notas text null,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_org_tipo on public.expenses(organization_id, tipo);
create index expenses_avulsa_mes on public.expenses(organization_id, mes_referencia) where tipo = 'avulsa';
```

Constraints:
- Avulsa exige `mes_referencia`, fixa exige `mes_referencia is null`
- Fixa pode ter `inicio_mes`/`fim_mes` pra delimitar período (ex.: aluguel novo entra em 2026-09)
- Sem unique constraint forte — agência pode ter "Aluguel sede" e "Aluguel filial" como duas fixas separadas

#### `expense_overrides`

Overrides de valor de uma despesa fixa num mês específico (ajuste pontual sem mudar o padrão).

```sql
create table public.expense_overrides (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  mes_referencia text not null check (mes_referencia ~ '^\d{4}-\d{2}$'),
  valor numeric(14, 2) not null check (valor >= 0),
  motivo text null,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (expense_id, mes_referencia)
);

create index expense_overrides_mes on public.expense_overrides(mes_referencia);
```

Só faz sentido pra `tipo = 'fixa'` — schema não trava por simplicidade, mas action valida.

### RLS

Ambas as tabelas: SELECT/INSERT/UPDATE/DELETE só pra `current_user_role() = 'socio'`. Nenhum outro role lê.

```sql
alter table public.expenses enable row level security;
alter table public.expense_overrides enable row level security;

create policy "socio rw expenses" on public.expenses
  for all to authenticated
  using (current_user_role() = 'socio'::user_role)
  with check (current_user_role() = 'socio'::user_role);

create policy "socio rw expense_overrides" on public.expense_overrides
  for all to authenticated
  using (current_user_role() = 'socio'::user_role)
  with check (current_user_role() = 'socio'::user_role);
```

Server actions reforçam o check (defesa em profundidade).

## Categorias (canonical)

```ts
// src/lib/financeiro/schema.ts
export const EXPENSE_CATEGORIAS = [
  "aluguel",
  "software",
  "contabilidade",
  "impostos",
  "marketing_proprio",
  "equipamento",
  "pro_labore",
  "outros",
] as const;

export const CATEGORIA_LABEL: Record<typeof EXPENSE_CATEGORIAS[number], string> = {
  aluguel: "Aluguel",
  software: "Software",
  contabilidade: "Contabilidade",
  impostos: "Impostos",
  marketing_proprio: "Marketing próprio",
  equipamento: "Equipamento",
  pro_labore: "Pró-labore",
  outros: "Outros",
};
```

Categorias livres dentro de "Outros" são representadas via `descricao` — não criamos categoria nova no enum (mantém DRE estável).

## DRE — composição

### Linhas e fontes de dado

| Linha | Fonte | Cálculo |
|---|---|---|
| **Receita Bruta** | `clients` | `Σ valor_mensal` de clientes ativos no mês (status='ativo' OR (status='churn' AND data_churn está no mês)) com `tipo_relacao='comum'` |
| **(-) Comissões** | `commission_snapshots` | `Σ valor_total` do mês. Se snapshot não fechado, usa `previewAllForMonth` (já existe em `lib/comissoes/preview`) |
| **(-) Tráfego pago** | `clients` | `Σ (valor_trafego_google + valor_trafego_meta)` de clientes ativos no mês |
| **= Lucro Bruto** | calculado | Receita − Comissões − Tráfego |
| **(-) Salários fixos** | `profiles` | `Σ fixo_mensal` de colaboradores ativos no fim do mês (excl. role='socio' — pró-labore vai à parte) |
| **(-) Despesas operacionais** (uma linha por categoria) | `expenses` + `expense_overrides` | Soma de despesas fixas vigentes no mês (com override aplicado, se houver) + avulsas com `mes_referencia` igual ao mês |
| **= Lucro Operacional** | calculado | Lucro Bruto − Salários − Despesas |

### Vigência de despesa fixa num mês

Função pura `expenseAplicaNoMes(expense, mesRef)`:
1. Se `tipo = 'avulsa'`: aplica somente quando `mes_referencia === mesRef`
2. Se `tipo = 'fixa'`:
   - Se `inicio_mes !== null` e `mesRef < inicio_mes`: não aplica
   - Se `fim_mes !== null` e `mesRef >= fim_mes`: não aplica
   - Senão: aplica
3. Se aplica e tem override pra esse mês: usa `valor_override`. Senão: usa `expense.valor`

### Margens

- Margem bruta = `Lucro Bruto / Receita Bruta`
- Margem operacional = `Lucro Operacional / Receita Bruta`
- Mostradas como `(XX.X% margem)` ao lado de cada total

## Páginas e componentes

### `/financeiro` (DRE)

Default view: **mês corrente**, com coluna `Δ vs mês anterior` (absoluto + %).

Toggles na header:
- **Mês corrente** (default)
- **Últimos 6 meses** (tabela com 6 colunas, uma por mês)
- **YTD** (acumulado do ano até o mês corrente)

Cada linha de despesa operacional tem botão `[✎]` que abre dialog de override pra o mês visualizado (descrito na seção "Override").

Seletor de mês na header: `[← Abr/2026  Mai/2026  Jun/2026 →]` (ou dropdown completo).

### `/financeiro/despesas`

Lista todas as despesas em duas seções:
- **Fixas vigentes** — linhas com `descricao`, `categoria`, `valor padrão`, `início — fim`, ações `[Editar] [Desativar]`
- **Avulsas** — agrupadas por `mes_referencia` desc, com `descricao`, `categoria`, `valor`, ações `[Editar] [Excluir]`

Filtros: categoria, tipo, mês (avulsas).

Botão `[+ Nova despesa]` abre dialog com:
- Tipo (fixa / avulsa) — radio
- Descrição — input
- Categoria — select
- Valor — input numérico
- (Se fixa) Início (mês) — input month, default = mês atual; Fim (mês) — opcional
- (Se avulsa) Mês de referência — input month, default = mês atual
- Notas — textarea opcional

Botão `[Importar em lote]` → navega pra `/financeiro/despesas/importar`.

### `/financeiro/despesas/importar`

Mesmo padrão de `/clientes/importar` (tem `BulkImportForm` que aceita CSV ou texto colado).

Colunas:
- `descricao` (obrigatório)
- `categoria` (obrigatório, deve ser uma das canônicas; falha o row inteiro se inválida)
- `valor` (obrigatório, número)
- `tipo` (obrigatório, "fixa" ou "avulsa")
- `mes_referencia` (obrigatório se tipo=avulsa, formato YYYY-MM; ignorado se tipo=fixa)
- `inicio_mes` (opcional, só fixa)
- `fim_mes` (opcional, só fixa)
- `notas` (opcional)

Preview com tabela validada (linhas inválidas em vermelho com motivo). Botão `Importar X linhas válidas` faz insert em batch.

### Override de despesa fixa num mês

Botão `[✎]` na DRE abre dialog:
```
Aluguel — Mai/2026
Valor padrão: R$ 5.000,00
[ Valor neste mês: R$ 5.500,00 ]
[ Motivo (opcional): _________ ]
[Cancelar] [Salvar override]   [Remover override]
```

Salvar = upsert em `expense_overrides`. Remover = delete. DRE re-renderiza com o novo valor.

### Sidebar

Adicionar item:
```ts
// src/components/layout/Sidebar.tsx
{ href: "/financeiro", icon: TrendingUp, label: "Financeiro", roles: ["socio"], badgeKey: null },
```

Posição: depois de "Comissões", antes de "Satisfação".

## Server actions

`src/lib/financeiro/actions.ts`:

- `createExpenseAction(formData)` — valida + insert
- `updateExpenseAction(formData)` — valida + update
- `deactivateExpenseAction(id)` — seta `fim_mes = mes_corrente` (não deleta, preserva histórico)
- `deleteExpenseAction(id)` — hard delete (avulsa, ou fixa nunca usada). Audit antes de deletar.
- `setOverrideAction(formData)` — upsert `expense_overrides` (expense_id + mes_referencia + valor)
- `removeOverrideAction(expenseId, mesRef)` — delete
- `bulkImportExpensesAction(formData)` — valida CSV inteiro, insere em batch (todas ou nenhuma — transação)

Toda action checa `actor.role === 'socio'` antes de qualquer query (defesa em profundidade vs RLS).

## Queries (server-only)

`src/lib/financeiro/queries.ts`:

- `getDRE(mesRef: string)` — retorna objeto estruturado:
  ```ts
  interface DRELine {
    expenseId: string;        // pra [✎] abrir override
    descricao: string;
    categoria: ExpenseCategoria;
    valor: number;
    overrideAplicado: boolean; // true se valor veio de expense_overrides
  }
  interface DREData {
    mesRef: string;
    receita_bruta: number;
    custo_servicos: { comissoes: number; trafego: number; total: number };
    lucro_bruto: number;
    margem_bruta_pct: number;
    salarios: number;
    /** Lista flat de despesas individuais. UI agrupa por categoria via headers. */
    despesas: DRELine[];
    lucro_operacional: number;
    margem_operacional_pct: number;
  }
  ```

- `getDRESeries(meses: string[])` — array de `DREData` pros últimos N meses
- `listExpenses(filters?)` — lista catálogo de despesas
- `getExpenseById(id)` — single

Cache: `unstable_cache` com tag `'financeiro'` e revalidate 300s. Mutations invalidam tag.

## Helpers

`src/lib/financeiro/dre-calc.ts` (pure functions, testáveis):

- `expenseAplicaNoMes(expense, mesRef)` → boolean
- `valorNoMes(expense, mesRef, overrides[])` → number
- `agruparPorCategoria(linhas)` → array agrupado pra DRE
- `calcMargem(num, denom)` → number (0 se denom=0)

## Componentes

`src/components/financeiro/`:

- `DREView.tsx` — renderiza um mês ou múltiplos meses (recebe `data: DREData[]`)
- `DRELine.tsx` — uma linha do DRE com botão override
- `OverrideDialog.tsx` — dialog de edição de valor mensal
- `MesSelector.tsx` — seletor de mês com setas + dropdown
- `ViewModeToggle.tsx` — toggle Mês / 6 meses / YTD
- `ExpenseForm.tsx` — form unificado pra create + edit
- `ExpenseTable.tsx` — tabela de despesas (fixas + avulsas separadas)
- `ExpenseFilters.tsx` — filtros da listagem
- `BulkExpenseImportForm.tsx` — bulk CSV (reusa padrão do `BulkImportForm` de clientes)

## Permissões — defesa em profundidade

| Camada | Check |
|---|---|
| Sidebar | item escondido se role ≠ socio |
| Page (server) | `requireAuth()` + early return 403 se role ≠ socio |
| Server actions | `actor.role === 'socio'` no início de cada |
| RLS | `current_user_role() = 'socio'` em todas as policies das 2 tabelas |

## Audit log

Toda mutation de `expenses` e `expense_overrides` loga via `logAudit` existente:
- entidade = `'expenses'` ou `'expense_overrides'`
- acao = `create|update|delete`
- dados_antes / dados_depois
- ator_id

## Testes

Unit (`tests/unit/financeiro-dre-calc.test.ts`):
- `expenseAplicaNoMes`: avulsa só no mês, fixa entre início e fim, fixa sem início/fim aplica sempre
- `valorNoMes`: usa override quando existe, senão usa valor padrão
- `calcMargem`: retorna 0 quando denom=0
- `agruparPorCategoria`: agrega corretamente

Sem e2e.

## Migração / rollout

- Migration nova com schema das 2 tabelas + RLS
- Sem dados retroativos automáticos — sócio cadastra/importa ao começar a usar

## Plano de implementação (alto nível)

Será detalhado pela skill writing-plans. Esboço:

1. Migration SQL: tabelas + RLS
2. Schema Zod + categorias canônicas
3. Helpers `dre-calc.ts` + tests
4. Queries `getDRE`, `getDRESeries`, `listExpenses`, `getExpenseById`
5. Server actions (create/update/delete/deactivate/override/bulkImport)
6. Componentes: `DREView`, `DRELine`, `OverrideDialog`, `MesSelector`, `ViewModeToggle`
7. Página `/financeiro` (DRE)
8. Componentes de despesas: `ExpenseForm`, `ExpenseTable`, `ExpenseFilters`
9. Página `/financeiro/despesas`
10. Página `/financeiro/despesas/importar` + `BulkExpenseImportForm`
11. Sidebar entry
12. Smoke test e PR

## Open questions (resolvidas)

- ✅ Categorias = pré-definidas com "Outros" pra livre
- ✅ Recorrência = fixa/avulsa
- ✅ Visualização padrão = mês corrente com Δ vs anterior; toggles 6m e YTD
- ✅ Impostos = lançamento manual (sem cálculo automático)
- ✅ Bulk import = CSV
- ✅ Edição na DRE = override só do mês; edição na lista = muda padrão a partir dali
- ✅ Permissão = só sócio em todas as camadas
