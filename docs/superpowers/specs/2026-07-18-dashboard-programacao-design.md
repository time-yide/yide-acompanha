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

## Casos de borda

- Migration `lancamentos_programacao` não aplicada / sem org → `listLancamentos` cai em `[]` (catch + log); cards mostram 0 e "Nenhum lançamento este mês". Não quebra.
- Sem salário cadastrado → `FixoCard` mostra R$ 0 (comportamento atual dele).
- Só a programadora vê esse dashboard (o page despacha por cargo); adm/sócio impersonando ela também veem (fluxo `?as=` existente).

## Testes

- Unit (`resumoLancamentos.test.ts`, vitest, `--exclude '**/.claude/**'`): agrega por tipo (crm/usuarios/sistemas/total), soma `quantidade`, ignora tipos desconhecidos, `[]` → tudo 0.
- UI verificada por type-check/lint (padrão do projeto).

## Arquivos

- **Novos:** `src/components/dashboard/DashboardProgramacao.tsx`; a função pura `resumoLancamentos` + seu teste (em `src/lib/programacao/resumo.ts` + `resumo.test.ts`, ou co-localizada — ver plano).
- **Editado:** `src/app/(authed)/page.tsx` (caso do cargo `programacao`).
- **Sem migration.**

## Fora de escopo

- Editar/arquivar lançamento pelo dashboard (a lista é read-only; gestão fica na `/programacao`).
- Gráficos/tendência (é resumo + lista).
- Tarefas/outros módulos no dashboard (ela não tem acesso a eles).
