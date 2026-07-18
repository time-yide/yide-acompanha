# FreelaYide — Pontos inversos ao valor

**Data:** 2026-07-18
**Status:** Aprovado

## Objetivo

Motivar o time a pegar as freelas **menos vantajosas** (baixa comissão). Hoje o valor
quase não muda os pontos (base fixa + `floor(valor/50)`), então uma freela de R$1.000 dá
quase os mesmos pontos de uma de R$150. A regra passa a ser **inversa**: freela de valor
**menor** rende **mais** ponto; as gordas, que já são atraentes pelo R$, rendem menos.

## Fórmula

`calcularPontos` continua acumulativo por progresso:
- Pegou (status ≠ `disponivel`): **+5**
- Passou por negociação (`negociacao_em`): **+10**
- Fechou (`fechada`): **+ bônus de fechamento** (inverso ao valor, por faixa)

**Bônus de fechamento por faixa de comissão** (inversão forte, ~4×):

| Comissão | Bônus |
|---|---|
| ≤ R$100 | 80 |
| R$101–300 | 55 |
| R$301–600 | 35 |
| R$601–1000 | 20 |
| > R$1000 | 10 |

Totais de uma fechada que passou por negociação (5 + 10 + bônus):
≤R$100 → 95 · R$101–300 → 70 · R$301–600 → 50 · R$601–1000 → 35 · >R$1000 → 25.

Substitui o antigo `PONTOS.fechar (50) + floor(valor/50)`. As chaves `fechar` e `porReal`
de `PONTOS` saem; ficam `pegar` e `negociacao`.

## Efeito

- Pontos são **derivados** (não persistidos): a mudança recalcula ranking, níveis e
  histórico automaticamente. **Sem migration.**
- O ranking passa a premiar quem **limpa muitas freelas pequenas**, que é o objetivo.

## Escopo / arquivos

- Modificar: `src/lib/freela-yide/pontos.ts` (nova `bonusFechamento` + `calcularPontos`).
- Modificar: `tests/unit/freelayide-pontos.test.ts` (atualizar os casos de fechada +
  cobrir as faixas e as bordas 100/300/600/1000).

## Não-objetivos

- Não mexer no card de disponível (continua mostrando os pontos do progresso atual;
  mostrar "pontos potenciais" antes de pegar é ideia separada, não incluída aqui).
- Não mudar pegar (+5) nem negociação (+10).
