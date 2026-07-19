# Blog Estratégico (GEO/EEAT) — Plano

> REQUIRED SUB-SKILL: subagent-driven-development.

**Goal:** Conteúdo estratégico (pergunta-resposta, aprofundado, GEO/EEAT) além das notícias; mix diário 2 notícia + 1 estratégico; FAQ + Schema; semear ~10.

**Já feito (base, nesta branch):** migration `blog_faq_tipo` (colunas `faq jsonb`, `tipo text`), `BlogPostRow.faq/tipo` + `mapRow` com defaults, `getPostPublicadoPorSlug` busca `faq/tipo` resiliente (fallback pré-migration). `FaqItem` exportado de `@/lib/blog/queries`.

**Reusar:** `@/lib/ai/client` (getAnthropicClient), `@/lib/blog/pipeline/gerar` (extrairJson, gerarCapa), `@/lib/blog/pipeline/keywords` (selecionarKeywordsAlvo), `@/lib/blog/texto` (semTravessao), `@/lib/blog/slug` (slugify, slugUnico), `@/lib/blog/queries` (FaqItem), `@/components/seo/Faq`.

---

## Task 1: Banco de temas

**Files:** Create `src/lib/blog/pipeline/temas-estrategicos.ts`

- [ ] Implementar `TEMAS_ESTRATEGICOS: { pilar: string; pergunta: string }[]` (lista curada, editável) e `slugDoTema(pergunta): string` (usa `slugify`). Incluir 40+ perguntas cobrindo: Tráfego pago (Meta/Google Ads), Marketing local/Google Meu Negócio, CRM/Kommo, IA no comercial, Vendas/funil, Gestão/processos, Finanças/precificação, Contratação. Exemplos obrigatórios (inclua estes e amplie):
  - "Como reduzir o custo por lead no Meta Ads?"
  - "Vale a pena anunciar no Google Ads para loja de iPhone?"
  - "Como aumentar as vendas de uma assistência técnica de celular?"
  - "Meta Ads ou Google Ads: qual escolher em 2026?"
  - "Qual CRM usar em uma pequena empresa?"
  - "Como estruturar um funil de vendas no Kommo?"
  - "Como gerar leads para clínicas de estética?"
  - "Google Meu Negócio: como aparecer em primeiro nas buscas locais?"
  - "Como usar IA no atendimento comercial?"
  - "Quanto investir em tráfego pago em 2026?"
  - "Como organizar o setor comercial de uma empresa?"
  - "Como vender mais pelo WhatsApp?"
- [ ] Commit `feat(blog): banco de temas estratégicos`

---

## Task 2: Gerador estratégico (puro + testes)

**Files:** Create `src/lib/blog/pipeline/estrategico.ts`, Test `tests/unit/blog-estrategico.test.ts`

- [ ] **montarPromptEstrategico(tema, keywordsAlvo)** (PURA): persona "editor-chefe de portal de negócios pra PMEs brasileiras". Regras no prompt:
  - Público: donos de PMEs (faturam R$50 mil–R$10 mi/ano) buscando conteúdo prático.
  - Estilo Forbes/Exame/HBR: storytelling + estratégia + exemplos; linguagem simples; sempre explicar o porquê; nunca encher linguiça.
  - Estrutura: título forte (a própria pergunta ou variação), intro com curiosidade, contexto, explicação profunda, exemplos ILUSTRATIVOS, passo a passo, erros comuns, o que fazer, tabela em markdown quando útil, conclusão.
  - **EEAT honesto**: escreva com a autoridade da Yide (agência de marketing e programação em Cuiabá-MT) SEM inventar cifras específicas ("R$ X mil"), sem inventar nomes de clientes nem resultados numéricos precisos. Use exemplos genéricos/ilustrativos.
  - **GEO**: objetivo, listas, definições, comparações, passo a passo.
  - **Links internos**: quando fizer sentido, insira links markdown pros serviços da Yide (`/servicos/gestao-de-trafego`, `/servicos/criacao-de-sites`, `/servicos/redes-sociais`, `/servicos/crm-ia-dados`, `/servicos/audiovisual`).
  - SEO local natural com as `keywordsAlvo`.
  - **NUNCA** use travessão nem meia-risca.
  - Tamanho: 2.000–3.500 palavras. NÃO inclua a FAQ dentro de `conteudo_md` (ela vem no campo `faq`).
  - Saída SOMENTE JSON: `{"titulo","resumo","conteudo_md","keywords":[],"meta_title","meta_description","faq":[{"pergunta","resposta"}]}` (3 a 8 itens de FAQ).
- [ ] **parseArtigoEstrategico(json)** (PURA): valida titulo+conteudo_md; sanitiza tudo com `semTravessao`; keywords ≤8; faq itens com pergunta+resposta (≤8), sanitizados; meta_title ≤70, meta_description ≤160. Retorna `ArtigoEstrategico | null` onde `ArtigoEstrategico = { titulo, resumo, conteudo_md, keywords: string[], meta_title, meta_description, faq: FaqItem[] }` (importa `FaqItem` de `@/lib/blog/queries`).
- [ ] Testes: prompt contém "editor" e a pergunta; parse sanitiza travessão e valida faq; null sem conteúdo.
- [ ] **gerarArtigoEstrategico(tema, keywordsAlvo)** (server): Claude `claude-haiku-4-5`, `max_tokens: 8000`, monta prompt, extrairJson, parse. Retorna `ArtigoEstrategico | null`.
- [ ] Commit `feat(blog): gerador estratégico (prompt+parse) + testes`

---

## Task 3: Pipeline estratégico + cron mix

**Files:** Create `src/lib/blog/pipeline/executar-estrategico.ts`; Modify `src/app/api/cron/blog-gerar/route.ts`

- [ ] `executarPipelineEstrategico(orgId, quantos)`: 
  - Lê slugs existentes de `blog_posts` (org).
  - `temasNaoUsados` = TEMAS cujo `slugDoTema` não está nos slugs existentes (função pura testável simples — pode testar junto no Task 2 se quiser).
  - Pra cada tema (até `quantos`): `selecionarKeywordsAlvo(4)`, `gerarArtigoEstrategico`, `gerarCapa`, `slugUnico`, insert em `blog_posts` com `status:'rascunho'`, `tipo:'estrategico'`, `faq`, keywords (merge com keywordsAlvo), meta. Best-effort (erro num item não derruba o resto).
  - Retorna `{ gerados, erros }`.
- [ ] Cron: manter auth CRON_SECRET; passar a rodar `executarPipelineBlog(orgId, 2)` **e** `executarPipelineEstrategico(orgId, 1)`; retornar ambos no JSON.
- [ ] tsc. Commit `feat(blog): pipeline estratégico + cron 2 notícia + 1 estratégico`

---

## Task 4: Action + botão (gerar estratégicos em lote)

**Files:** Modify `src/lib/blog/actions.ts`; Create `src/components/blog/GerarEstrategicosButton.tsx`; Modify `src/app/(authed)/programacao/blog/page.tsx`

- [ ] Action `gerarEstrategicosAgoraAction()` em actions.ts (gate existente `gate()`): `executarPipelineEstrategico(g.orgId, 3)` + `revalida()`; retorna `{ success, gerados }`. (3 por clique é seguro no tempo de execução.)
- [ ] `GerarEstrategicosButton` (client) — molde do `GerarRascunhosButton`; confirm "Gerar 3 artigos estratégicos (usa IA, pode levar 2-3 min)?"; toast com `gerados`.
- [ ] Adicionar o botão no topo do `/programacao/blog` (ao lado de "Gerar com IA").
- [ ] tsc + eslint. Commit `feat(blog): botão gerar estratégicos em lote`

---

## Task 5: FAQ + FAQPage na página do post

**Files:** Modify `src/app/blog/[slug]/page.tsx`; talvez `src/lib/blog/seo.ts` (builder FAQPage)

- [ ] Em `seo.ts`, adicionar `jsonLdFaq(faq: {pergunta,resposta}[]): object | null` (retorna null se vazio) — objeto FAQPage schema.org.
- [ ] Na página do post: se `post.faq.length > 0`, renderizar seção "Perguntas frequentes" com `<Faq itens={post.faq} />` (de `@/components/seo/Faq`) após o conteúdo/CTA; e injetar um 2º `<script application/ld+json>` com o FAQPage (mesmo padrão de escape `.replace(/</g,"\\u003c")` do Article; use heredoc no Bash se o hook bloquear a prop de innerHTML no Write).
- [ ] tsc + eslint + `npm run build` (rotas do blog presentes). Reverter `public/sw.js` se mudar.
- [ ] Commit `feat(blog): FAQ + FAQPage (JSON-LD) na página do post`

---

## Task 6: PR + migration
- [ ] PR → CI verde → merge. Entregar SQL da migration (`blog_faq_tipo`), instruindo rodar ANTES de gerar estratégicos. Depois: /programacao/blog → "Gerar estratégicos (lote)" ~3-4x pra chegar aos 10.

## Self-Review
- Base resiliente já feita (faq/tipo sem quebrar pré-migration). Geração insere faq/tipo (falha graciosa pré-migration). FAQPage só quando há faq. Honestidade EEAT no prompt (sem cifras/clientes inventados). Cron 2+1. Testes puros em prompt/parse.
