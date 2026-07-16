# Financeiro — gráfico Receita × Custo × Lucro (peça A)

**Data:** 2026-07-16
**Rota:** `/financeiro` (só sócio)
**Contexto:** 1ª de 3 peças da melhoria visual do Financeiro. As outras (B: inadimplência com backfill; C: fluxo de caixa + aporte de capital) são ciclos separados.

## Problema

A página `/financeiro` tem o DRE em tabela e um gráfico de composição, mas não tem uma visão **visual da evolução mensal** de receita, custo e lucro. A Yasmin quer ver, de relance, como receita/custo/lucro e a margem evoluem mês a mês.

## Escopo (só peça A)

Um gráfico novo no topo do `/financeiro`:
- Barras de **Receita** e **Custo total** lado a lado por mês.
- Linha de **Margem operacional %** por cima (2º eixo, à direita).
- Tooltip com os 4 números do mês: receita, custo, lucro, margem.
- Seletor **6m / 12m / ano** (ano = ano corrente).
- Indicador de **tendência**: seta ↑/↓ comparando lucro e margem do último mês vs o anterior.

Fora de escopo: inadimplência (peça B), fluxo de caixa/aportes (peça C), qualquer mudança em dado/migração/query de cálculo.

## Dados

Reusa `getDRESeries(meses: string[]): Promise<DREData[]>` (já existe em `src/lib/financeiro/queries.ts`). `DREData` por mês já traz:
- `receita_bruta`
- `custo_servicos.total` (comissões + tráfego)
- `salarios`
- `total_despesas`
- `lucro_operacional`
- `margem_operacional_pct`
- `mesRef` (YYYY-MM)

**Derivações no gráfico:**
- **Custo total** = `custo_servicos.total + salarios + total_despesas`
- **Lucro** = `lucro_operacional`
- **Receita** = `receita_bruta`
- **Margem** = `margem_operacional_pct`

`getDRE(mesRef)` é cacheado por mês (`unstable_cache`), então buscar 12 meses reaproveita o cálculo já feito nos outros modos.

## Componentes e arquivos

### `src/components/financeiro/ChartReceitaCustoLucro.tsx` (novo, client)
- Props: `series: DREData[]` (12 meses, mais antigo → mais recente).
- Estado: `periodo: "6m" | "12m" | "ano"` (default "12m").
- Deriva os pontos: para cada `DREData`, `{ mes: label, Receita, Custo, Lucro, Margem }`.
- Fatia a série conforme o período:
  - `6m` = últimos 6 pontos.
  - `12m` = todos.
  - `ano` = pontos cujo `mesRef` começa com o ano corrente.
- Recharts `ComposedChart`: `Bar` Receita (verde `#22c55e`) + `Bar` Custo (vermelho `#ef4444`) no eixo esquerdo (R$); `Line` Margem (`#6366f1`) no eixo direito (%). Tooltip custom mostrando receita/custo/lucro (R$) e margem (%).
- Seletor de período: botões (mesmo padrão do seletor de ano do dashboard — `ChartEntradaChurn`).
- Tendência: compara o último ponto do recorte com o penúltimo; mostra seta ↑ (verde) / ↓ (vermelho) para lucro e margem, com o delta.
- Estados de borda: se `series` vazia ou recorte vazio, mostra "Sem dados no período".

### `src/app/(authed)/financeiro/page.tsx`
- Em `FinanceiroPage`, calcula os 12 meses terminando em `mesRef`:
  `const meses12 = Array.from({ length: 12 }, (_, i) => shiftMes(mesRef, -(11 - i)));`
- `const serie12 = await getDRESeries(meses12);`
- Renderiza `<ChartReceitaCustoLucro series={serie12} />` no topo do conteúdo do `PageShell`, **em todos os modos** (mês/6m/ytd), acima do conteúdo específico do modo.
- Como o gráfico é sempre renderizado, buscar `serie12` acontece nos 3 modos (cacheado, custo baixo).

## UX

- Gráfico no topo, altura ~`h-56 sm:h-72`, responsivo (`ResponsiveContainer`).
- Seletor 6m/12m/ano centralizado acima do gráfico.
- Cores: receita verde, custo vermelho, margem linha índigo. Segue o tema (hsl vars) como os outros gráficos.
- Tooltip em pt-BR, valores em R$ e % .

## Testes

- Sem lógica de dado nova (reusa query existente). Verificação = `npm run typecheck` + eslint dos arquivos alterados. UI conferida no PR (padrão do projeto).
- Opcional: teste unitário puro da função de fatiar período (6m/12m/ano) se extraída — mas é trivial; typecheck cobre.

## Deploy

- Sem migração. Sem novo dado. Branch → PR → CI → merge.
