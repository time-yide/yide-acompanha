# FreelaYide — Painel interno de captação extra (MVP)

**Data:** 2026-05-28
**Status:** Design aprovado (brainstorming) — pronto pra virar plano de implementação.

## Visão geral

Espaço interno da agência onde o time pega **oportunidades extras de captação** e ganha **comissão/bonificação** por contratos fechados. Tom: performance, dinheiro, crescimento e oportunidade. Visual estilo startup/gamificação, clean porém premium.

Entra no menu (grupo **Operação**) **logo abaixo do "Yori"**, rota `/freela-yide`.

## Decisões (do brainstorming)

| Tema | Decisão |
|------|---------|
| Escopo | MVP funcional com banco real |
| Origem das oportunidades | Curado: **adm/sócio** criam |
| Comissão | **Valor fixo em R$** definido por oportunidade |
| Quem pega | **Todo o time** (qualquer role interno) |
| Ranking | **Pontos (gamificado)**, mensal |
| Identidade | **Electric Hype** — roxo elétrico + ciano/magenta (sub-brand distinto do verde do sistema) |

## Identidade visual

Sub-brand próprio, distinto do verde da Yide, pra dar sensação de "modo jogo / arena de performance".

- **Base:** fundo escuro violeta (`#0b0a14` → `#120e1f`) no hero; resto usa os tokens padrão do app (`bg-card`, `ring-foreground/10`) pra funcionar em light/dark.
- **Primária:** violeta `#7c3aed` → `#a855f7`
- **Acento:** ciano `#22d3ee`
- **Destaque/dinheiro:** magenta/rosa `#f0abfc` — usado nos valores em R$
- **Gradiente de marca (wordmark, CTAs, barras):** `linear-gradient(90deg, #7c3aed, #22d3ee)`
- **Status (semânticos, mantidos legíveis):** disponível/fechada = verde `#10b981`; pega = azul `#3b82f6`; negociação = âmbar `#f59e0b`; perdida = cinza.
- **Tipografia:** fonte atual do app, peso forte (800) no wordmark "FreelaYide" com gradiente; números grandes com `tabular-nums`.
- **Wordmark:** `Freela` + `Yide` com o gradiente de marca.

### Emojis / ícones (consistência)

- FreelaYide / menu: ⚡ (ícone `Zap` no nav)
- Oportunidade: 🎯 · Dinheiro/comissão: 💸 🤑 · Pontos: 🔥 · Ranking/troféu: 🏆 · Crescimento: 📈 · Meta/bônus: 🎁 · Fechado: ✅ · Em negociação: 🤝
- Status: 🟢 Disponível · 🔵 Pega · 🟡 Em negociação · 🏆 Fechada · ⚪ Perdida

## Regras (game design)

### Ciclo da oportunidade (status)
`disponivel` → `pega` → `em_negociacao` → `fechada` **ou** `perdida`

- Adm/sócio criam como `disponivel`.
- Qualquer pessoa do time **pega** (`pega`, registra `pego_por` + `pego_em`).
- Quem pegou move pra `em_negociacao`, depois `fechada` ou `perdida`. Adm/sócio também podem.
- "Devolver" (voltar de `pega` → `disponivel`) é permitido a quem pegou e a adm/sócio.

### Pontos (ranking mensal)
- Pegar: **+5**
- Levar pra negociação: **+10** (uma vez por oportunidade)
- Fechar: **+50** + **1 ponto a cada R$ 50** de comissão da oportunidade
- Perdida: **0** (sem punição — incentiva pegar)

Pontos são **derivados** dos timestamps da oportunidade (`pego_em`, `negociacao_em`, `fechada_em`), não um contador mutável — evita divergência: `pega` ⇒ +5, `negociacao_em` preenchido ⇒ +10, `fechada` ⇒ +50 + bônus por R$.

**Atribuição de mês (regra única, sem ambiguidade):** todos os pontos e stats de uma oportunidade contam no mês em que ela foi **pega** (`pego_em`). A oportunidade "pertence" a esse mês pro ranking, mesmo que feche no mês seguinte.

### Comissão
Valor fixo em R$ por oportunidade, exibido como "você ganha R$ X se fechar". É registro/exibição. **Pagamento real fica fora do MVP** (fase 2: integrar com `/comissões`).

### Metas & bônus
- Adm/sócio define **1 meta de equipe ativa por mês**: descrição + alvo (em pontos OU em nº de fechamentos OU R$ de comissão) + descrição do bônus.
- Tela mostra **barra de progresso** da meta do mês + o bônus prometido.

### Frases motivacionais
Lista curada no código, rotaciona (por dia/refresh). Edição via painel fica pra fase 2.

## Permissões

| Ação | Quem |
|------|------|
| Ver painel + ranking | Todo o time interno |
| Criar/editar/excluir oportunidade | adm, sócio |
| Definir/editar meta do mês | adm, sócio |
| Pegar / devolver / mover status / fechar | quem pegou + adm/sócio |

Roles do link no menu: todo o time interno (adm, socio, comercial, coordenador, assessor, designer, videomaker, editor, audiovisual_chefe).

## Modelo de dados (Supabase — migration manual)

### `freela_oportunidades`
- `id` uuid pk
- `organization_id` uuid (RLS por org, padrão do projeto)
- `titulo` text
- `descricao` text null
- `cliente_nome` text null · `contato` text null (a "pista" do lead)
- `valor_comissao` numeric (R$ fixo)
- `status` text check (`disponivel`|`pega`|`em_negociacao`|`fechada`|`perdida`) default `disponivel`
- `pego_por` uuid null (→ profiles) · `pego_em` timestamptz null
- `negociacao_em` timestamptz null · `fechada_em` timestamptz null
- `criado_por` uuid (→ profiles)
- `created_at` / `updated_at` timestamptz · `deleted_at` timestamptz null (soft delete, padrão do projeto)

### `freela_metas`
- `id` uuid pk · `organization_id` uuid
- `mes` date (1º dia do mês) — único por org
- `descricao` text · `tipo_alvo` text (`pontos`|`fechamentos`|`comissao`) · `alvo` numeric
- `bonus_descricao` text
- `criado_por` uuid · `created_at` / `updated_at`

RLS: seguir o padrão das outras tabelas do projeto (restrição por organização). Pontos e ranking são **calculados em query** a partir de `freela_oportunidades`, sem tabela de pontos.

## Estrutura da página `/freela-yide`

1. **Hero** — wordmark FreelaYide + stats do usuário: oportunidades disponíveis, comissão em jogo, R$ que você ganhou no mês, seu rank. Frase motivacional rotativa.
2. **Meta do mês & bônus** — card com barra de progresso + bônus prometido.
3. **Oportunidades disponíveis** — grid de cards (título, cliente, R$ comissão em destaque, pontos, botão "Pegar"). Adm/sócio veem botão "+ Nova oportunidade".
4. **Minhas oportunidades** — as que o usuário pegou, com ações de mover status (negociação / fechar / perder / devolver).
5. **Ranking do time** — pódio/lista do mês por pontos (🥇🥈🥉 + R$ ganho + nº fechamentos). Troféu dourado no topo.

Server actions: `criarOportunidade`, `pegarOportunidade`, `moverStatus` (negociacao/fechada/perdida/devolver), `excluirOportunidade`, `definirMeta`. Queries: `listOportunidades`, `listMinhas`, `getRanking(mes)`, `getMetaAtual`, `getStatsUsuario`.

## Fora de escopo (fase 2)

- Integração com `/comissões` (pagamento real / lançamento financeiro)
- Criar oportunidade automaticamente a partir do gerador de leads
- Frases motivacionais editáveis pelo painel
- Notificações (push/recado) quando surge oportunidade nova
- Histórico/auditoria detalhada por oportunidade

---

## Estrutura ideal no Notion (paralelo / fallback manual)

Caso o time queira rodar/espelhar no Notion antes ou junto do painel:

**Base principal — "FreelaYide · Oportunidades" (database):**
- Propriedades: `Oportunidade` (título), `Cliente`, `Contato`, `Comissão (R$)` (number), `Status` (select: 🟢 Disponível / 🔵 Pega / 🟡 Negociação / 🏆 Fechada / ⚪ Perdida), `Responsável` (person), `Pontos` (formula), `Pego em` (date), `Fechado em` (date), `Mês` (formula a partir de Pego em).
- Views: **Board por Status** (kanban), **Disponíveis** (filtro Status=Disponível), **Minhas** (filtro Responsável = me), **Fechadas do mês**.

**Base secundária — "FreelaYide · Metas & Bônus":** `Mês`, `Meta`, `Tipo`, `Alvo`, `Bônus`, `Progresso` (rollup/formula).

**Página dashboard (home):** embed das views + um bloco "🏆 Ranking do mês" (tabela ordenada por pontos) + callout com a frase motivacional da semana.

## Organização prática (uso diário do time)

- **Adm/sócio (manhã):** publica as oportunidades do dia (curadoria) e confirma a meta do mês.
- **Time (durante o dia):** abre o FreelaYide, pega o que faz sentido pro seu perfil, move o status conforme avança (negociação → fechou/perdeu).
- **Ritual semanal (ex: segunda):** olhar o ranking, comemorar o top 3, relembrar a meta/bônus do mês.
- **Fechamento do mês:** ranking final define o bônus; reseta o ciclo (oportunidades fechadas/perdidas saem do "ativo", ranking zera no mês novo).
