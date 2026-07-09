# FreelaYide — Histórico de ranking + Ranking geral + Editar oportunidade

**Data:** 2026-07-09
**Status:** aprovado

## Problema

Na tela `/freela-yide`, o "RANKING DO MÊS" só mostra o mês corrente e não há como:
1. Ver o ranking de meses passados (retrovisor).
2. Ver quem pegou mais freelas no acumulado ("de todos os tempos").
3. Editar uma oportunidade já publicada (só existia criar/pegar/mover/excluir).

## Decisão

Sem tabela nova nem migration — os dados de todos os meses já existem em
`freela_oportunidades` (`pego_em`, `fechada_em`, etc.). O histórico é calculado
sob demanda.

### 1. Histórico do ranking (`getHistorico`)

Uma única query lê todas as oportunidades pegas (`pego_em not null`) da org e
agrupa em memória:
- **Por mês** (`chave` = `AAAA-MM`, `label` = "Julho 2026"), ordenado do mais
  recente pro mais antigo. O mês corrente é sempre incluído (mesmo vazio).
- **Geral**: por pessoa, total de `pegas`, `fechamentos`, `comissao`, `pontos`.
  Ordena por freelas pegas (desc), desempate por pontos.

Pontuação reaproveita `calcularPontos` (nada muda no cálculo).

### 2. UI — `RankingPainel` (client)

Substitui `RankingTime` na sidebar. Toggle **Por mês / Geral**:
- **Por mês**: seletor `◀ Julho 2026 ▶` (setas desabilitam nas pontas) + lista.
- **Geral**: lista acumulada, destaque = "N freelas".

Todos os meses vêm pré-calculados do servidor; a troca é client-side (instantânea,
sem navegação). `getRanking` (mês corrente) continua alimentando `MetaCard`/stats.

### 3. Editar oportunidade

- `editarOportunidadeSchema` = `criarOportunidadeSchema` + `id` (uuid).
- `editarOportunidadeAction`: gestão (adm/sócio), edita campos de conteúdo
  (título, tipo, cliente, valor, contato, horário, urgência, descrição). Não
  mexe em status/pego_por. Usa `.select("id")` + checagem de length (RLS silencioso).
- `OportunidadeFormFields`: campos compartilhados entre criar e editar (DRY).
- `EditarOportunidadeButton` (lápis) + botão Excluir (usa `excluirOportunidadeAction`
  que já existia sem UI), ambos só para gestão, no `OportunidadeCard`.

## Fora de escopo

- Gráficos de evolução / linha do tempo.
- Editar oportunidade já pega por alguém (grid mostra só disponíveis).
- Mudança no cálculo de pontos.

## Risco

Baixo. Mudança contida em `queries.ts` + componentes do FreelaYide. Sem migration.
