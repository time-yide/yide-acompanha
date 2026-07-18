# FreelaYide — Progressão & Pódio (Sub-projeto 1)

**Data:** 2026-07-18
**Status:** Aprovado (aguardando revisão do spec)

## Objetivo

Deixar o FreelaYide com cara de "joguinho": progressão pessoal permanente (níveis/XP),
pódio visual pro top 3 do mês e uma linha de rivalidade ("faltam X pts pra passar
Fulano"). Tudo derivado de dados que já existem — **sem migration, sem query nova**.

## Escopo

**Neste spec (Sub-projeto 1):**
- Sistema de níveis por XP acumulado (todos os tempos).
- Card do jogador no topo (nível + barra de XP + rivalidade).
- Pódio do top 3 no ranking do mês.

**Fora deste spec (Sub-projeto 2, spec separado):**
- Conquistas/medalhas com desbloqueio + notificação + tabela nova. Não tocar aqui.

## Contexto de dados (já disponível na página)

`src/app/(authed)/freela-yide/page.tsx` já carrega:
- `historico` (`getHistorico`) → `historico.geral: RankingGeralEntry[]`, cada um com
  `user_id` e `pontos` **acumulados de todos os tempos**. É daqui que sai o XP do nível.
- `ranking` (`getRanking`) → `RankingEntry[]` do **mês corrente**, ordenado por pontos
  desc. É daqui que sai a rivalidade.
- `stats` (`getStats`) → `meusPontos`/`meuRank` são **do mês** (não servem pro nível).
- `user.id` (meId).

Regra: o XP do nível **não** é `stats.meusPontos` (mensal). É o `pontos` da entrada de
`historico.geral` cujo `user_id === user.id` (0 se a pessoa não estiver lá ainda).

## Componente 1 — Sistema de níveis (`src/lib/freela-yide/niveis.ts`)

Função pura, testável, sem IO.

**Tabela de faixas (curva difícil, cada nível > 2× o anterior no topo):**

| Nível | Título | XP mínimo |
|------|--------|-----------|
| 1 | Novato | 0 |
| 2 | Promessa | 100 |
| 3 | Craque | 300 |
| 4 | Fera | 700 |
| 5 | Lenda | 1.500 |
| 6 | Mito | 3.500 |

Cada faixa tem uma cor (classe Tailwind) pra dar sensação de evolução:
Novato = zinc, Promessa = emerald, Craque = sky, Fera = violet, Lenda = fuchsia,
Mito = amber/dourado.

**Contrato:**

```ts
export interface Nivel {
  nivel: number;        // 1..6
  titulo: string;       // "Fera"
  cor: string;          // classes tailwind pro selo, ex "border-violet-400/50 bg-violet-500/15 text-violet-200"
  xpAtual: number;      // XP total da pessoa (echo do input, >= 0)
  xpBase: number;       // XP mínimo do nível atual
  xpProximo: number | null;   // XP mínimo do próximo nível; null no Mito (máximo)
  proximoTitulo: string | null; // "Lenda"; null no Mito
  faltam: number;       // pts pro próximo nível; 0 no Mito
  pct: number;          // 0..100 — progresso DENTRO do nível atual; 100 no Mito
}

export function nivelDeXP(xp: number): Nivel;
```

**Regras:**
- `xp` negativo é tratado como 0.
- `pct = round((xpAtual - xpBase) / (xpProximo - xpBase) * 100)`, clampado 0..100.
- No Mito: `xpProximo = null`, `proximoTitulo = null`, `faltam = 0`, `pct = 100`.

## Componente 2 — Rivalidade (`src/lib/freela-yide/rivalidade.ts`)

Função pura sobre o ranking do **mês corrente**.

**Contrato:**

```ts
import type { RankingEntry } from "./queries";

export type Rival =
  | { tipo: "lider" }                              // meId é o 1º
  | { tipo: "foraDoRanking" }                      // meId não está no ranking (0 pts no mês)
  | { tipo: "perseguindo"; nome: string; faltam: number }; // alguém logo acima

export function calcularRival(ranking: RankingEntry[], meId: string): Rival;
```

**Regras:**
- `ranking` já vem ordenado por `pontos` desc (contrato do `getRanking`); a função
  **não** reordena, confia na ordem recebida.
- Acha o índice de `meId`. Se não achar → `foraDoRanking`.
- Se índice 0 → `lider`.
- Senão → `perseguindo` com `nome` = nome do de índice-1 e
  `faltam = max(0, rankingAcima.pontos - meu.pontos)` (pode ser 0 em empate —
  mensagem ainda faz sentido: "faltam 0 pts pra passar Fulano").

## Componente 3 — Card do jogador (`FreelaHero.tsx` refatorado)

Layout novo do topo, mantendo o fundo com gradiente e o título "FreelaYide" + frase do dia.

**Props novas:**
```ts
{ stats: FreelaStats; xpTotal: number; rival: Rival }
```

**Estrutura:**
1. Faixa de cima: badge "OPORTUNIDADES EXTRAS", título "FreelaYide", frase do dia (igual hoje).
2. **Painel do personagem** (destaque): selo de nível grande (`Nv 4 · Fera`, cor da faixa)
   + barra de XP com legenda `1.240 / 1.500 pts · faltam 260 pra Lenda`
   (no Mito: `Nível máximo`), + linha de rivalidade:
   - `lider` → "Você lidera — segura o topo!"
   - `perseguindo` → "Faltam {faltam} pts pra passar {nome}"
   - `foraDoRanking` → "Pega uma freela pra entrar no ranking do mês"
3. Faixa dos 4 stats atuais (Disponíveis, Em jogo, Você ganhou, Seu rank) — menores,
   embaixo. Mantém o componente `Stat` interno.

A barra de XP e o selo podem virar um subcomponente presentacional `NivelBadge`
(no mesmo arquivo ou em `NivelBadge.tsx`) — decisão do plano; sem lógica de negócio
(recebe o `Nivel` já calculado).

## Componente 4 — Pódio (`src/components/freela-yide/Podio.tsx`)

Presentacional. Recebe o top 3 já fatiado e o `meId`.

```ts
export function Podio({ top3, meId }: { top3: RankingEntry[]; meId: string }): JSX.Element | null;
```

- Renderiza 1º ao centro (maior, ícone `Crown` lucide, cor ouro `amber`), 2º à esquerda
  (prata `zinc/slate`), 3º à direita (bronze `orange/amber-700`).
- Cada degrau: posição, nome (com "(você)" se `meId`), pontos (`{pontos} pts`).
- **Sem emoji** — usar ícones lucide (`Crown`, `Medal`) + cores ouro/prata/bronze,
  consistente com o resto da UI.
- Degradação graciosa: com 1 ou 2 pessoas, mostra só os degraus existentes.
  Se `top3` vazio → retorna `null` (o `RankingPainel` já trata "ninguém no ranking").

**Integração no `RankingPainel.tsx` (aba "Por mês"):**
- Quando `mesAtual.ranking.length > 0`: renderiza `<Podio top3={mesAtual.ranking.slice(0,3)} meId={meId} />`
  acima da lista, e a lista passa a mostrar do **4º pra baixo** (`mesAtual.ranking.slice(3)`),
  reaproveitando `LinhaRanking` (posição = índice + 4).
- A aba "Geral" **não muda** (sem pódio) neste sub-projeto.

## Fluxo de dados (`page.tsx`)

Sem nova query. Depois dos `Promise.all` atuais, calcular:
```ts
const xpTotal = historico.geral.find((g) => g.user_id === user.id)?.pontos ?? 0;
const rival = calcularRival(ranking, user.id);
```
E passar `xpTotal` e `rival` pro `<FreelaHero>`.

## Arquivos

**Criar:**
- `src/lib/freela-yide/niveis.ts`
- `src/lib/freela-yide/rivalidade.ts`
- `src/components/freela-yide/Podio.tsx`
- `tests/unit/freelayide-niveis.test.ts`
- `tests/unit/freelayide-rivalidade.test.ts`

**Modificar:**
- `src/components/freela-yide/FreelaHero.tsx` (card do jogador + novas props)
- `src/components/freela-yide/RankingPainel.tsx` (pódio na aba do mês)
- `src/app/(authed)/freela-yide/page.tsx` (calcular xpTotal + rival, passar pro hero)

**Possível criar (decisão do plano):**
- `src/components/freela-yide/NivelBadge.tsx` (selo + barra, presentacional)

## Testes

Cobrir as funções puras (o resto é presentacional):

`freelayide-niveis.test.ts`:
- xp 0 → Novato nv1, faltam 100 pra Promessa, pct 0.
- xp 50 → Novato, pct 50, faltam 50.
- xp 100 → Promessa nv2.
- xp 699 → Craque; xp 700 → Fera (bordas de faixa).
- xp 3.500 → Mito nv6, xpProximo null, faltam 0, pct 100, proximoTitulo null.
- xp negativo → tratado como 0 (Novato).

`freelayide-rivalidade.test.ts`:
- meId no índice 0 → `lider`.
- meId no meio → `perseguindo` com nome do de cima e faltam = diff.
- empate (mesmos pontos do de cima) → `perseguindo`, faltam 0.
- meId ausente → `foraDoRanking`.
- ranking vazio → `foraDoRanking`.

Rodar: `npx vitest run --exclude '**/.claude/**' tests/unit/freelayide-niveis.test.ts tests/unit/freelayide-rivalidade.test.ts`

## Não-objetivos (YAGNI)

- Nenhuma animação/confete/som (a Yasmin não pediu; fica pra depois).
- Nível **não** aparece em cada linha do ranking — só no card do jogador.
- Sem persistência: nível e rivalidade são 100% derivados a cada render.
- Aba "Geral" sem pódio.
- Conquistas/medalhas: Sub-projeto 2.
