# FreelaYide — Bônus de pegar inverso ao valor

**Data:** 2026-07-18
**Status:** Aprovado

## Objetivo

Estender a lógica inversa (freela menor = mais ponto) também ao **pegar**: hoje pegar
dá 5 fixo pra qualquer valor. Passa a render mais ao pegar uma freela pequena, pra
motivar a escolher as menos vantajosas já na hora de pegar (não só ao fechar).

## Fórmula

Novo `bonusPegar(valor)` (inverso, menor que o de fechar — pegar é menos esforço):

| Comissão | Bônus ao pegar |
|---|---|
| ≤ R$100 | 20 |
| R$101–300 | 15 |
| R$301–600 | 10 |
| R$601–1000 | 7 |
| > R$1000 | 5 |

`calcularPontos` passa a somar `bonusPegar(valor)` ao pegar (status ≠ disponivel), no
lugar do antigo `PONTOS.pegar` (5 fixo). Negociação (+10) e `bonusFechamento` seguem
iguais e empilham. `PONTOS` fica só com `negociacao`.

## Efeito

- Derivado (sem migration): recalcula ranking/níveis/histórico na hora.
- Ex.: pegar R$50 → 20 pts; pegar R$1.200 → 5 pts.

## Escopo

- Modificar: `src/lib/freela-yide/pontos.ts` (nova `bonusPegar` + `calcularPontos`).
- Modificar: `tests/unit/freelayide-pontos.test.ts`.

## Não-objetivos

- Card de disponível segue mostrando "vale X pts" = `bonusFechamento` (não muda aqui).
- Negociação e fechamento inalterados.
