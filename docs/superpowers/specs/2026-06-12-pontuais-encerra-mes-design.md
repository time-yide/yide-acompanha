# Serviço pontual encerra no fim do mês de entrada

**Data:** 2026-06-12
**Status:** aprovado (design)

## Problema

Um **serviço pontual** (`clients.modalidade = 'pontual'`) é um serviço único (vídeo
avulso, projeto fechado). Hoje ele é criado com `status = 'ativo'` e **nunca é
encerrado automaticamente** — só se alguém rodar o churn manual, o que não faz
sentido conceitual (pontual "encerra sem virar churn").

Consequências do pontual ficar `ativo` pra sempre:

- **Carteira ativa** (`_getKpisImpl`) soma o `valor_mensal` do pontual em todos os
  meses seguintes ao da entrada.
- **Clientes ativos** conta o pontual indefinidamente (via `isActiveOn`, que é
  baseado em datas e hoje retorna `true` porque `data_churn` é `null`).
- **`getClienteStats`** (header da lista de clientes) conta `status = 'ativo'`,
  incluindo pontuais antigos.
- O KPI **"Serviços pontuais → X concluídos no mês"** conta por `data_churn`, que
  nunca é setado → fica sempre `0`.

A migration original (`20260508000064_clients_modalidade.sql`) já previa que
"pontual em status=ativo continua somando enquanto estiver **vigente**" — mas
"vigente" nunca foi limitado. **Este trabalho define vigente = apenas o mês de
entrada.**

## Comportamento desejado

Um pontual pertence ao **mês em que entrou** (`data_entrada`):

- **Durante o mês de entrada:** segue como hoje — `status = 'ativo'`, conta na
  Carteira ativa, em Clientes ativos e no card de Serviços Pontuais daquele mês.
- **A partir do 1º dia do mês seguinte:** vira **`concluido`**:
  - Sai da Carteira ativa e de Clientes ativos.
  - Na lista de clientes aparece com selo "Concluído" e filtro próprio.
  - **Não** entra em nenhuma métrica de churn (continua como hoje).
- O card **"Serviços Pontuais"** passa a contar pelo **mês de entrada**
  (quantidade + valor), no mês selecionado no dashboard. Remove a divisão
  "ativos vs concluídos no mês".

## Solução

### 1. Novo status `concluido`

Adicionar valor ao enum `public.client_status`:

```sql
ALTER TYPE public.client_status ADD VALUE 'concluido';
```

Restrição do Postgres: `ALTER TYPE ... ADD VALUE` **não pode** ser usado na mesma
transação em que o valor é referenciado. Aplicação manual via SQL Editor
(padrão do projeto), em **dois passos separados**:

1. `ALTER TYPE` (sozinho, primeiro).
2. Backfill (depois, já podendo usar `'concluido'`).

### 2. Data de conclusão = último dia do mês de entrada

A conclusão é ancorada em `data_churn = lastDayOfMonth(data_entrada)`. Isso, por
si só, já faz o pontual sair da Carteira/Clientes ativos na virada do mês,
porque `isActiveOn` é baseado em datas (`data_churn <= hoje → inativo`). O status
`concluido` é a **etiqueta visível**; a saída das métricas é automática pela data.

- **Cadastro/edição** (`src/lib/clientes/actions.ts`): ao salvar um cliente
  `modalidade = 'pontual'`, gravar `data_churn = lastDayOfMonth(data_entrada)`.
  Se o mês de entrada **já passou** (backdate), gravar também `status = 'concluido'`.
- Fuso: usar o fuso da app (Cuiabá) pra decidir "mês atual" — helpers de
  `src/lib/datetime/timezone.ts` + `lastDayOfMonth` de `src/lib/dashboard/date-utils.ts`.

### 3. Cron diário de transição

Nova rota `src/app/api/cron/pontuais-concluir/route.ts`, registrada em
`vercel.json` (diário, ex.: `0 4 * * *`). Espelha o padrão de
`audiovisual-auto-marcar-entregue`.

Ação (service-role): para todo cliente `modalidade = 'pontual'` com
`status = 'ativo'` cujo **mês de entrada já terminou**:

```sql
UPDATE public.clients
SET status = 'concluido',
    data_churn = COALESCE(data_churn, <último dia do mês de data_entrada>)
WHERE modalidade = 'pontual'
  AND status = 'ativo'
  AND <mês de data_entrada < mês atual>;
```

Idempotente (só pega `status = 'ativo'`). Daily em vez de mensal pra robustez
(barato, e não depende do snapshot mensal rodar).

### 4. Migration de backfill

Após o `ALTER TYPE`:

- Pontuais com mês de entrada **já encerrado**: `status = 'concluido'`,
  `data_churn = COALESCE(data_churn, último dia do mês de data_entrada)`.
- Pontuais do **mês corrente** (ainda `ativo`): apenas
  `data_churn = COALESCE(data_churn, último dia do mês de data_entrada)`
  (mantém `ativo`).

Cálculo do último dia do mês em SQL:
`(date_trunc('month', data_entrada) + interval '1 month - 1 day')::date`.

### 5. Dashboard — redefinição do KPI

`src/lib/dashboard/queries.ts` → `_getKpisImpl`:

- `servicosPontuais` passa a contar por **mês de entrada**:
  - `quantidade` = pontuais com `isInMonth(data_entrada, monthRef)`.
  - `valorTotal` = soma do `valor_mensal` desses.
- **Shape muda** → bump da cache key `dashboard-kpis-v6` → `dashboard-kpis-v7`.
- Carteira/Clientes ativos não mudam de fórmula: passam a excluir pontuais
  encerrados naturalmente, porque agora os pontuais têm `data_churn` setado
  (via backfill + cadastro).

Interface `KpiData.servicosPontuais`:

```ts
// antes
servicosPontuais: { ativos: number; concluidosMes: number; valorTotal: number };
// depois
servicosPontuais: { quantidade: number; valorTotal: number };
```

Componentes de card:

- `src/components/dashboard/KpiRow.tsx` (sócio): card "Serviços pontuais" =
  `quantidade` (helper "no mês"); card "Valor pontuais" = `valorTotal`.
- `src/components/dashboard/adm/KpiRowAdm.tsx`: "Serviços pontuais" = `quantidade`
  (helper "no mês", sem "X concluídos").

### 6. Lista de clientes — selo e filtro "Concluído"

- `STATUSES` em `src/lib/clientes/schema.ts` ganha `'concluido'`.
- Badge/label de status (cor + texto "Concluído") onde status é exibido.
- Filtro por status na lista (`src/app/(authed)/clientes/page.tsx` +
  `src/lib/clientes/queries.ts`) ganha a opção.
- `getClienteStats`: pontuais `concluido` ficam fora de `total_ativos`
  (já ficam, por `status != 'ativo'`); confirmar que não entram em `total_churn`
  (já ficam fora, `status != 'churn'`).

## Surfaces e arquivos

| Camada | Arquivo | Mudança |
|---|---|---|
| DB | migration `ALTER TYPE` | adiciona `concluido` ao enum |
| DB | migration backfill | seta status/data_churn dos pontuais existentes |
| Cron | `vercel.json` + `api/cron/pontuais-concluir/route.ts` | transição diária |
| Cadastro | `lib/clientes/actions.ts` | grava `data_churn` (e `status` se mês passou) |
| Schema TS | `lib/clientes/schema.ts` | `STATUSES` += `concluido` |
| Dashboard | `lib/dashboard/queries.ts` | KPI por mês de entrada + cache v7 |
| Dashboard | `KpiRow.tsx`, `adm/KpiRowAdm.tsx` | labels do card |
| Clientes | `app/(authed)/clientes/page.tsx`, `lib/clientes/queries.ts` | filtro |
| Clientes | badge de status (componente de exibição) | label/cor "Concluído" |

## Não-objetivos (YAGNI)

- Não mexer na definição de Carteira ativa além de excluir pontuais encerrados.
- Não criar UI de "reabrir" pontual concluído (churnClienteAction já cobre
  reativação genérica se necessário no futuro).
- Não tocar nos gráficos de timeline/entrada-churn (o "avulsos" da entrada-churn
  já é por mês de entrada — consistente com a nova definição).

## Plano de entrega

Dois PRs, a partir de `origin/main`:

- **PR 1 — Lifecycle:** enum + backfill (SQL aplicado manual) + cron + cadastro
  grava `data_churn` + `STATUSES` + selo/filtro "Concluído" na lista.
- **PR 2 — Dashboard:** redefine KPI de pontuais por mês de entrada + cache v7 +
  labels dos cards.

Migrations aplicadas manualmente no SQL Editor (Vercel não roda no deploy).
O `ALTER TYPE` roda **antes** do backfill, em execução separada.

## Riscos / atenção

- **Enum ADD VALUE em transação:** aplicar em dois passos.
- **Cache shape:** bump `dashboard-kpis-v7` no mesmo PR que muda o shape.
- **Fallback do fullSelect / RLS:** seguir os padrões já documentados (coluna nova
  no whitelist de fallback; checar retorno de `.update()` por número de linhas).
- **Fuso:** "mês atual" sempre via helpers de timezone (Cuiabá), nunca `new Date()` cru.
