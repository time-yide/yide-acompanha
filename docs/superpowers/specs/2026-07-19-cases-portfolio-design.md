# Cases / Portfólio — Design (Fase 2)

**Data:** 2026-07-19
**Sub-projeto:** D — Presença/SEO da Yide (Fase 2)
**Objetivo:** Páginas públicas de cases (resultados reais de clientes) com prova social estruturada (Schema Review), pra reforçar autoridade em buscas e recomendações de IA. Dados reais preenchidos pela Yide; IA só "pole" a redação (NÃO inventa números).

## Contexto
Fase 1 (páginas de serviço × localidade) já em produção, com motor de IA + CMS + Schema. A Fase 2 reaproveita os padrões: tabelas + service-role, páginas `force-dynamic`, shell moderno (`/servicos/layout.tsx` como referência), `semTravessao`, gate `podeGerenciarBlog`.

## Modelo de dados (migration manual)

`seo_cases`
- `id uuid pk`, `organization_id uuid`
- `slug text` (único por org)
- `cliente text`, `segmento text`, `localidade text` (livre, ex.: "Cuiabá, MT"; opcional)
- `desafio text`, `solucao text` (dados crus preenchidos pela Yide)
- `resultados jsonb` (lista de `{rotulo, valor}`, ex.: `[{"rotulo":"Vendas","valor":"+180%"}]`)
- `depoimento_texto text`, `depoimento_autor text` (opcionais)
- `cover_image_url text` (opcional)
- `conteudo_md text` (narrativa polida pela IA a partir dos campos acima)
- `meta_title text`, `meta_description text`
- `status text check (rascunho|publicado|arquivado) default 'rascunho'`
- timestamps
- RLS: SELECT público só `status='publicado'`; escrita via service-role.

## IA "pole" (não inventa)
`polirCase(dados)` → Claude recebe cliente/segmento/desafio/solucao/resultados/depoimento e devolve `{conteudo_md, meta_title, meta_description}`.
- Prompt: escrever narrativa pt-br (desafio, solução, resultado) usando **SOMENTE os números fornecidos**; proibido inventar métricas; proibido travessão (saída passa por `semTravessao`).
- A Yide revisa o resultado antes de publicar. Os campos estruturados (resultados, depoimento) continuam como dados (pra Schema e cards), não dependem da IA.

## Páginas públicas (`src/app/cases/`, design moderno, mesmo shell de /servicos)
- `/cases` — vitrine: grid de cards (cliente, segmento, resultado de destaque, capa).
- `/cases/[slug]` — case: hero (cliente/segmento/localidade), narrativa (Markdown light), **cards grandes com os números** (`resultados`), depoimento em destaque, CTA.
- **JSON-LD**: `Article` (headline, about a Yide) + `Review` quando há depoimento (`reviewBody` = depoimento, `author` = autor, `itemReviewed` = Organização Yide) + `BreadcrumbList`. Injeção igual ao padrão do blog (escape de `<`).
- `force-dynamic`.

## Gestão (Programação → Serviços & SEO Local → aba/rota "Cases")
- `/programacao/seo/cases` — lista de cases (status, publicar/despublicar, editar), botão "Novo case".
- `/programacao/seo/cases/[id]` — formulário: campos estruturados + editor de `resultados` (linhas rótulo/valor, adicionar/remover) + depoimento + botão **"Polir com IA"** (preenche `conteudo_md`/meta) + editor da narrativa + Salvar.
- Botão publicar/despublicar na lista.
- Gate `podeGerenciarBlog`.

## Erros/resiliência
- IA best-effort (falha não quebra; retorna erro amigável). Queries com try/catch. RLS nega por padrão.

## Testes (puros, vitest)
- `slugCase(cliente, segmento)` — builder de slug.
- `jsonLdCase(...)` — monta Article + Review (com/sem depoimento).
- `parseCasePolido(...)` — valida/sanitiza saída da IA.

## Fora da Fase 2
Vídeo, filtro por segmento, aprovação do cliente, imagens múltiplas por case.

## Migration manual
`seo_cases` (+ índice + RLS) — rodar no SQL Editor após o merge.
