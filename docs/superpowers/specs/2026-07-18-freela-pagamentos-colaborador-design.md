# FreelaYide — Pagamentos por colaborador

**Data:** 2026-07-18
**Status:** Aprovado

## Objetivo

Dar à gestão uma visão de **quanto pagar cada colaborador por mês** pelas freelas,
como subpágina da página "Todas lançadas".

## Escopo

- Nova rota `/freela-yide/lancadas/pagamentos`.
- Botão "Pagamentos →" na página "Todas lançadas" (só pra gestão).
- Por mês (recente primeiro): colaborador + qtd de freelas + R$ total, subtotal do mês.
- Conta **tudo que a pessoa pegou** no mês, **exceto canceladas** (`status = perdida`),
  igual o "Total lançado" já exclui cancelados.
- Sem migration, sem cache. Reusa `freela_oportunidades`.

## Acesso

Só **gestão** (`ROLES_GESTAO` = adm, socio) — é dado de pagamento. Demais papéis → `notFound()`.

## Agregação (função pura — `src/lib/freela-yide/pagamentos.ts`)

Testável, sem IO. Recebe linhas já filtradas (canceladas fora) e agrupa.

```ts
export interface PagamentoInput { pego_por: string; nome: string; valor_comissao: number; pego_em: string; }
export interface PagamentoColaborador { user_id: string; nome: string; qtd: number; total: number; }
export interface MesPagamentos { chave: string; label: string; total: number; colaboradores: PagamentoColaborador[]; }

export function agregarPagamentos(rows: PagamentoInput[]): MesPagamentos[];
```

**Regras:**
- Bucketiza por mês de `pego_em` (mesma lógica de `chaveMes`/`labelMes` do histórico:
  `AAAA-MM` local, label "Julho 2026"), pra ser consistente com o ranking.
- Soma `valor_comissao` por colaborador; `qtd` = nº de freelas.
- Meses ordenados do mais recente pro mais antigo; dentro do mês, colaboradores do maior
  total pro menor (empate → nome A→Z).
- `total` do mês = soma dos colaboradores.

## Query (`src/lib/freela-yide/queries.ts`)

`getPagamentosPorMes(orgId)`: service-role, seleciona `pego_por, valor_comissao, pego_em`
+ nome via embed, filtra `deleted_at is null`, `pego_por not null`, `pego_em not null`,
`status != perdida`; mapeia pra `PagamentoInput[]` e chama `agregarPagamentos`. Em erro,
loga e retorna `[]`.

## UI (`/freela-yide/lancadas/pagamentos/page.tsx`)

- Link "← Voltar" pra `/freela-yide/lancadas`, título + subtítulo.
- Vazio → Card "Ninguém pegou freela ainda."
- Cada mês = Card: cabeçalho com label + `R$ total`; lista de colaboradores
  (nome, `{qtd} freela(s)`, `R$ total`).

## Página "Todas lançadas" (mudança)

Topo vira uma linha com "Voltar" à esquerda e, quando `gestao`, um botão-link
"Pagamentos →" à direita (`/freela-yide/lancadas/pagamentos`).

## Não-objetivos

- Sem exportar CSV/PDF, sem marcar "pago", sem filtro por pessoa (YAGNI — é só a visão).
- Não altera `getHistorico` nem o ranking.
