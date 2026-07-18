# Dashboard da Programação

**Data:** 2026-07-18
**Módulo:** dashboard (`src/components/dashboard`, `src/app/(authed)/page.tsx`) + reuso de `src/lib/programacao`.
**Fonte:** código vive em `origin/main` (main local vive atrás — branchar de `origin/main`).

## Problema

O dashboard principal (`/`) despacha por cargo, mas **não tem caso pro cargo `programacao`** — a programadora cai no `<StubGreeting>` (um "oi" vazio). Ela precisa de um dashboard de verdade, girando em torno do trabalho dela (lançamentos de programação), já que não tem acesso a outros módulos.

## Decisões (brainstorming)

Mostrar os quatro: **resumo do mês**, **últimos lançamentos**, **salário (FixoCard)**, **saudação + atalho**.

## Componente — `src/components/dashboard/DashboardProgramacao.tsx` (server)

Segue o padrão dos outros dashboards de cargo (`DashboardDesigner`/`DashboardFastMidia`): envolto em `HiddenValuesProvider`, com `HiddenValueToggle`.

Layout:
1. **Saudação:** "Oi, {primeiro nome} 👋" + `HiddenValueToggle` + botão **"Registrar"** (`<Link href="/programacao">`).
2. **Resumo do mês** — 4 cards: **CRMs · Usuários · Sistemas · Total** (agregado dos lançamentos dela no mês corrente).
3. **`<FixoCard userId={userId} />`** — salário fixo dela (usa `<Money>` sob o toggle).
4. **Últimos lançamentos** — os 5 mais recentes: `cliente · N× tipo · data`; link "Ver todos" → `/programacao`. Vazio → "Nenhum lançamento este mês."

Props: `{ userId: string; nome: string }`.

## Dados

- `orgId = await getOrganizationId(userId)` (de `@/lib/gerador-leads/queries`). Se null → renderiza saudação + FixoCard, com lançamentos vazios.
- `lancamentos = orgId ? await listLancamentos(orgId, "programacao", userId, { de: inicioMes, ate: hoje }) : []` (de `@/lib/programacao/queries`; já escopa pros lançamentos **dela**, pois `programacao` não é chefia). Ordenado por data desc.
- **Agregação** por tipo numa função pura `resumoLancamentos(rows) → { crm, usuarios, sistemas, total }` (soma `quantidade` por `tipo`), testável.
- `inicioMes` = `YYYY-MM-01` do mês corrente; `hoje` = data de hoje (mesmos helpers dos outros dashboards / do page do /programacao).

## Wiring — `src/app/(authed)/page.tsx`

Importa `DashboardProgramacao` e adiciona, ANTES do `return <StubGreeting .../>` final:
```tsx
  if (target.role === "programacao") {
    return <DashboardProgramacao userId={target.id} nome={target.nome} />;
  }
```

## Parte B — página de Clientes (`/programacao/clientes`)

A programadora precisa consultar **quem é o assessor responsável** por cada cliente. Página própria, só-leitura, sem financeiro.

- **Rota:** `src/app/(authed)/programacao/clientes/page.tsx`. Guarda `canAccessProgramacao(user.role)` senão `notFound()`; `getOrganizationId` senão `notFound()`.
- **Conteúdo:** título "Clientes" + campo de busca por nome (`?q=`, server-side) + lista **nome do cliente · assessor responsável**. Sem `valor_mensal`/status/financeiro.
- **Query** (nova em `src/lib/programacao/queries.ts`): `listClientesComAssessor(orgId, q?)` — `clients` (`deleted_at is null`, `nome ilike %q%` quando `q`), embed do assessor (`clients.assessor_id` → `profiles.nome`), ordenado por nome. Retorna `{ id, nome, assessor_nome: string | null }[]`. Sem assessor → mostra "—".
- **Menu:** item "Clientes" (ícone `Users`) apontando pra `/programacao/clientes`, `roles: ["programacao"]` (adm/sócio já têm o `/clientes` real). Como o cargo `programacao` só vê links que listam `"programacao"`, aparece só pra ela.

## Casos de borda

- Migration `lancamentos_programacao` não aplicada / sem org → `listLancamentos` cai em `[]` (catch + log); cards mostram 0 e "Nenhum lançamento este mês". Não quebra.
- Sem salário cadastrado → `FixoCard` mostra R$ 0 (comportamento atual dele).
- Só a programadora vê esse dashboard (o page despacha por cargo); adm/sócio impersonando ela também veem (fluxo `?as=` existente).

## Testes

- Unit (`resumoLancamentos.test.ts`, vitest, `--exclude '**/.claude/**'`): agrega por tipo (crm/usuarios/sistemas/total), soma `quantidade`, ignora tipos desconhecidos, `[]` → tudo 0.
- UI verificada por type-check/lint (padrão do projeto).

## Arquivos

- **Novos:** `src/components/dashboard/DashboardProgramacao.tsx`; função pura `resumoLancamentos` + teste (`src/lib/programacao/resumo.ts` + `resumo.test.ts`); página `src/app/(authed)/programacao/clientes/page.tsx`.
- **Editados:** `src/app/(authed)/page.tsx` (caso do cargo `programacao`); `src/lib/programacao/queries.ts` (`listClientesComAssessor`); `src/components/layout/nav-config.ts` (item "Clientes" pra programacao).
- **Sem migration.**

## Fora de escopo

- Editar/arquivar lançamento pelo dashboard (a lista é read-only; gestão fica na `/programacao`).
- Gráficos/tendência (é resumo + lista).
- Tarefas/outros módulos no dashboard (ela não tem acesso a eles).
