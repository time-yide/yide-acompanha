# FreelaYide — Subpágina "Todas lançadas"

**Data:** 2026-07-18
**Status:** Aprovado

## Objetivo

Tirar a seção "Todas lançadas" (resumo + grade completa de cards) da página principal
do FreelaYide, que ficou poluída, movendo-a para uma subpágina dedicada. Na principal
fica só um botão de acesso.

## Escopo

- Nova rota `/freela-yide/lancadas`.
- Remover a seção "Todas lançadas" inteira da página principal (resumo **e** grade).
- Botão "Todas lançadas →" na principal, ao lado do "+ Nova oportunidade".
- Sem migration, sem query nova (reusa `listOportunidades(orgId, false)`).

## Acesso

Igual a quem hoje enxerga a seção: só quem **pode criar** freela
(`adm, socio, audiovisual_chefe, assessor`). Quem não pode → `notFound()`.

Hoje as listas de papéis (`ALLOWED`, `GESTAO`, `PODE_CRIAR`) vivem **inline** em
`page.tsx`. Como a subpágina precisa das mesmas, extrair pra um módulo compartilhado
`src/lib/freela-yide/acesso.ts` (DRY) e as duas páginas importam de lá.

## Componentes

Nenhum componente novo de UI. A subpágina reusa `ResumoSubidos` e `OportunidadesGrid`
(inalterados). O botão é um `next/link` estilizado como botão outline pequeno,
inline na `page.tsx` (server component).

## Subpágina `/freela-yide/lancadas`

- `requireAuth()`; se `role` não está em `ROLES_ALLOWED` **ou** não está em
  `ROLES_PODE_CRIAR` → `notFound()`.
- `getOrganizationId`; se null → `notFound()`.
- `gestao = ROLES_GESTAO.includes(role)`; `podePegar = role !== "adm"`.
- Carrega `todasLancadas = await listOportunidades(orgId, false)`.
- Renderiza: link "← Voltar" pra `/freela-yide`, título "Todas lançadas",
  `<ResumoSubidos ops={todasLancadas} />` e
  `<OportunidadesGrid ops={todasLancadas} gestao={gestao} podePegar={podePegar} />`.

## Página principal (mudanças)

- Importa `ROLES_ALLOWED, ROLES_GESTAO, ROLES_PODE_CRIAR` de `acesso.ts` (remove os
  `const` inline).
- **Remove** `todasLancadas` do `Promise.all` (não é mais usado na principal → menos
  dado carregado).
- **Remove** a `<section>` "Todas lançadas".
- Adiciona, ao lado do `<NovaOportunidadeButton />`, um botão-link
  "Todas lançadas →" pra `/freela-yide/lancadas` (só quando `podeCriar`).

## Não-objetivos (YAGNI)

- Sem paginação/busca/filtro na subpágina (a grade continua igual à de hoje).
- Sem mexer em `ResumoSubidos`, `OportunidadesGrid` ou nas actions.
- Sem mudar quem pode criar/pegar/ver.
