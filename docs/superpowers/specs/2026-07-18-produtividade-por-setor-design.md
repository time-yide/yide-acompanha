# Produtividade por setor no /produtividade (Sub-projeto 1)

**Data:** 2026-07-18
**Módulo:** produtividade (`src/lib/produtividade`, `src/components/produtividade`, `src/app/(authed)/produtividade`)
**Fonte:** código vive em `origin/main` (main local vive atrás — branchar de `origin/main`).

## Contexto e escopo

Pedido: medir a produtividade do time por **output real do cargo**, não por uma contagem genérica. Este é o **Sub-projeto 1** de dois:

- **1 (este):** produtividade por setor pros cargos que já têm dado (comercial, e-commerce, assessor, design) + regra de visibilidade do financeiro.
- **2 (depois):** módulo de lançamento manual da Programação (feature nova) → aí a programadora entra no painel.
- **3 (futuro, opcional):** refazer receita/lucro POR SETOR. **Este spec NÃO toca** no cálculo de receita/lucro/entregas atual.

## Decisões (brainstorming)

- **Formato:** as duas coisas — métrica-chave por pessoa na tabela geral (coluna "Produtividade") **+** painel "Produtividade por setor" com blocos e ranking interno.
- **Unidade por cargo:** a coluna mostra o número-chave do cargo com o rótulo certo (ex.: "45 ligações", "320 anúncios", "92% no prazo", "25 artes").
- **Produtividade é separada do lucro** — não mistura unidades; lucro fica como está.
- **Financeiro só pra quem não é audiovisual_chefe:** o coordenador de audiovisual (Duxx) vê só produtividade; adm/sócio/coordenador geral (Lucas) continuam vendo o financeiro.

## Métrica-chave por cargo

| Setor | Cargos | Métrica (coluna "Produtividade") | Unidade | Fonte |
|---|---|---|---|---|
| Comercial | `comercial` | ligações feitas no período | contagem | `ligacoes` (`direcao='saida'`, `arquivado_em is null`, `iniciada_em` no range, por `colaborador_id`) |
| E-commerce | `assessor_ecommerce`, `assistente_ecommerce`, `assessor`+`especialidade='ecommerce'` | anúncios subidos (soma `quantidade`) | contagem | `anuncios_ecommerce` (`arquivado_em is null`, `data` no range, por `colaborador_id`) |
| Assessoria | `assessor` (não e-commerce) | % no prazo | percentual | `tasks`: entregues no prazo ÷ entregues, entre as com `due_date` |
| Design | `designer` (Valdemir) | artes entregues (aprovadas) | contagem | `design_artes` (`aprovado_em` no range, por `criado_por`, `archived_at is null`) |
| Audiovisual | `videomaker`, `editor`, `fast_midia`, `audiovisual_chefe` | mantém "entregas" atual (concluídas + capturas) | contagem | já existente |
| Gestão/sem setor | `adm`, `socio`, `coordenador`, `programacao` | "—" (programação chega no Sub-projeto 2) | — | — |

Definições precisas:
- **Ligação feita** = de saída (`direcao='saida'`); recebidas não contam. No painel, mostrar feitas + atendidas (`status='atendida'`).
- **% no prazo** = `count(entregues com completed_at::date <= due_date) ÷ count(entregues com due_date)` no período. Só tarefas com `due_date` entram (sem prazo não conta). "Entregue" = `status='postada'` (terminal do assessor) com `completed_at` no range. Null (0 entregues com prazo) → "—".
- **Arte entregue** = `design_artes` com `status='aprovado'` e `aprovado_em` no range, por `criado_por`.

## Painel "Produtividade por setor"

Blocos por setor, cada um com ranking interno (maior primeiro) e as métricas do setor:
- **Comercial:** por pessoa — ligações feitas, atendidas.
- **E-commerce:** por pessoa — anúncios subidos (soma).
- **Assessoria:** por pessoa — % no prazo, entregues, atrasadas, postagens feitas (`social_media_posts` `status='publicado'`, `publicado_em` no range, por `criado_por`).
- **Design:** por pessoa — artes entregues, tarefas no prazo.

Só renderiza blocos que têm pessoas. O painel é visível a todos que acessam a página (inclusive audiovisual_chefe) — é produtividade, não financeiro.

## Arquitetura

**Camada de dados — novo `src/lib/produtividade/setor-metricas.ts`:**
- Mapeamento `role → setor` e `setor → definição de métrica` (fonte, contagem, rótulo, unidade).
- `getProdutividadeSetor(range, filter?)`:
  1. Busca perfis ativos (id, nome, role, especialidade).
  2. Em paralelo (service-role), agrega por pessoa no período: ligações (saída/atendidas), anúncios (soma), tasks (entregues/no prazo/atrasadas), postagens publicadas, artes aprovadas.
  3. Resolve a métrica-chave de cada pessoa pelo cargo → `{ user_id, setor, valor: number|null, unidade: 'contagem'|'percentual', rotulo: string }`.
  4. Monta os agregados por setor pro painel.
  - Retorna `{ porUsuario: Map<user_id, MetricaPessoa>, setores: BlocoSetor[] }`.
  - Cacheável (`unstable_cache`, tag `produtividade` se existir, senão sem cache no MVP) com service-role (regra do projeto: nunca cookies dentro de unstable_cache).
- Parte de resolução (role→setor, formatação do rótulo, cálculo de %) extraída em funções puras testáveis.

**UI:**
- **Coluna "Produtividade"** na `ColaboradoresTable` — mostra `rotulo` da pessoa (ex.: "45 ligações", "92% no prazo") ou "—". Ordenável pelo `valor`.
- **Seção "Produtividade por setor"** (novo componente `ProdutividadeSetorSection`) na página, com os blocos + ranking.
- **Gate financeiro:** `podeVerFinanceiro = user.role !== "audiovisual_chefe"`. Quando `false`, a página **não** renderiza: colunas Custo/h, Custo salário, Custo por entrega, Receita, Lucro; os cards de Faturamento/Custo/Lucro; nem o card "Time Audiovisual". Passado como prop (`mostrarFinanceiro`) pra `ColaboradoresTable`, `ProdutividadeSummaryCards` e à renderização do `TimeAudiovisualCard` na page. A coluna "Entregas" (contagem) permanece, mas sem o subtexto "R$/entrega" quando `mostrarFinanceiro=false`.

## Casos de borda

- Pessoa cujo cargo não tem setor mapeado (adm/socio/coordenador/programacao) → "Produtividade" mostra "—".
- Assessor sem tarefas com prazo no período → % no prazo = "—".
- Setor sem ninguém ativo → bloco não aparece.
- audiovisual_chefe: nenhuma informação financeira renderizada (nem via toggle) — é gate por cargo, não o toggle de esconder valores.
- Fonte indisponível (ex.: tabela ausente) → o fetch cai em vazio e loga, não quebra a página (padrão dos outros fetches de produtividade).

## Testes

- Unit (`setor-metricas.test.ts`, vitest, `--exclude '**/.claude/**'`) das funções puras:
  - `roleParaSetor(role, especialidade)` mapeia certo (inclusive assessor+ecommerce → ecommerce; assessor puro → assessoria).
  - `pctNoPrazo(entreguesNoPrazo, entreguesComPrazo)` → % correto; null quando 0.
  - `formatRotulo(setor, valores)` → "45 ligações" / "92% no prazo" / "25 artes" / "320 anúncios".
- UI/gate: verificado por type-check/lint (padrão do projeto).

## Arquivos

- **Novos:** `src/lib/produtividade/setor-metricas.ts`, `src/lib/produtividade/setor-metricas.test.ts`, `src/components/produtividade/ProdutividadeSetorSection.tsx`.
- **Editados:** `src/components/produtividade/ColaboradoresTable.tsx` (coluna Produtividade + prop `mostrarFinanceiro` escondendo as colunas de $), `src/components/produtividade/ProdutividadeSummaryCards.tsx` (esconder cards de $ quando `mostrarFinanceiro=false`), `src/app/(authed)/produtividade/page.tsx` (busca setor-métricas, calcula `mostrarFinanceiro`, renderiza a seção e passa props; esconde o `TimeAudiovisualCard`).
- **Sem migration.**

## Fora de escopo

- Programação (Sub-projeto 2).
- Receita/lucro por setor (Sub-projeto 3).
- Métrica de "tarefas agendadas no período" (falta carimbo `agendado_em` — não pedido como chave).
- Novas fontes de dado; usa só o que já existe.
