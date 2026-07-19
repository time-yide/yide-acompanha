# Blog Estratégico (GEO/EEAT) — Design

**Data:** 2026-07-19
**Sub-projeto:** Blog (evolução da estratégia de conteúdo)
**Objetivo:** Além das notícias quentes, produzir conteúdo ESTRATÉGICO (pergunta-resposta, evergreen, aprofundado) otimizado pra Google e LLMs (GEO/EEAT), com FAQ + Schema, virando referência pro público de PMEs. Mix diário: 2 notícia + 1 estratégico. Semear ~10 de cara.

## Princípios (GEO/EEAT)
- Título em forma de pergunta específica ("Como reduzir o custo por lead no Meta Ads?").
- Aprofundado (mira 2.000–3.500 palavras), com contexto, explicação, exemplos, passo a passo, erros comuns, tabelas, conclusão e FAQ.
- Autoridade da Yide de forma VERDADEIRA: NÃO inventar cifras específicas nem nomes de clientes. Exemplos ilustrativos e claros. Casos reais com números ficam no módulo Cases (linkáveis).
- Estrutura H1/H2/H3, listas, definições, comparações. Links internos pros serviços (`/servicos/...`).
- Sem travessão (reusa `semTravessao`).

## Modelo de dados (migration manual — colunas novas em `blog_posts`)
- `faq jsonb not null default '[]'` (lista `{pergunta, resposta}`).
- `tipo text not null default 'noticia' check (tipo in ('noticia','estrategico'))`.

### Resiliência (CRÍTICO — evita quebrar o blog antes da migration)
- `SELECT_FULL` (compartilhado por todas as queries do blog) **NÃO muda**.
- `getPostPublicadoPorSlug` busca `faq`/`tipo` numa **query secundária** com checagem de `error`: se as colunas ainda não existem (pré-migration), ignora e usa defaults (`faq: []`, `tipo: 'noticia'`). Assim o blog funciona com e sem as colunas.
- Insert de post estratégico inclui `faq`/`tipo`; pré-migration o insert falha graciosamente (loga, gera 0) — rodar a migration antes de gerar.

## Banco de temas (`src/lib/blog/pipeline/temas-estrategicos.ts`)
- `TEMAS_ESTRATEGICOS: { pilar: string; pergunta: string }[]` — lista curada e editável, agrupada por pilar (Tráfego, Gestão, CRM/IA, Finanças, Vendas, Marketing local, etc.).
- Dedup: cada tema vira um slug (via `slugify` da pergunta); gera só os que ainda não existem em `blog_posts`.

## Gerador estratégico (`src/lib/blog/pipeline/estrategico.ts`)
- `montarPromptEstrategico(tema, keywordsAlvo)` (PURA, testável): persona editor-chefe de portal de negócios pra PMEs; estrutura completa; EEAT honesto (sem inventar números/clientes); GEO; links internos; 2.000–3.500 palavras; FAQ separada.
- `parseArtigoEstrategico(json)` (PURA, testável): valida `{titulo, resumo, conteudo_md, keywords, meta_title, meta_description, faq}`, sanitiza (semTravessao), FAQ 3–8 itens.
- `gerarArtigoEstrategico(tema, keywordsAlvo)`: Claude (`claude-haiku-4-5`, max_tokens ~8000) → parse. Capa via `gerarCapa`.
- Insere como rascunho com `tipo='estrategico'`, `faq`, keywords (inclui SEO local).

## Pipeline
- `executarPipelineEstrategico(orgId, quantos)`: pega temas não usados, gera, insere. Best-effort.
- Cron `/api/cron/blog-gerar`: passa a fazer **2 notícia + 1 estratégico** por dia.
- Manual: mantém "Gerar com IA" (notícia, 1) + novo **"Gerar estratégicos (lote)"** (gera 3 por clique, pra chegar aos ~10 clicando 3–4x).

## Página do post (`/blog/[slug]`)
- Renderiza seção **FAQ** (do campo `faq`) ao final, com o componente `Faq` (reusa `@/components/seo/Faq`).
- Emite **FAQPage (JSON-LD)** quando há `faq` (além do Article já existente), com escape de `<` (padrão do blog).
- `conteudo_md` NÃO inclui a FAQ (vem do campo estruturado, evita duplicar).

## UI/CMS
- Botão "Gerar estratégicos (lote)" no topo do `/programacao/blog` (ao lado de "Gerar com IA").
- (Opcional) badge de `tipo` na lista do CMS — fora do v1 se apertar.

## Funções puras testadas
`montarPromptEstrategico`, `parseArtigoEstrategico`, e o dedup de temas (`temasNaoUsados`).

## Fora do v1
Página-pilar automática, linkagem post↔post automática garantida, atualização automática de artigos antigos, distribuição multi-rede.

## Migration manual
Colunas `faq` + `tipo` em `blog_posts` — rodar no SQL Editor após o merge (ANTES de gerar estratégicos).
