# Blog (CMS + páginas públicas SEO) — Sub-projeto A

**Data:** 2026-07-18
**Status:** Aprovado (aguardando revisão do spec)

## Objetivo

Blog gerenciado dentro do sistema (posts no Supabase) com páginas **públicas**
otimizadas pra SEO — pra a Yide virar referência de conteúdo e aparecer melhor em
Google e buscas de IA (ChatGPT etc.). Base pro pipeline automático (sub-projeto B) e
independente do termômetro de SEO (sub-projeto C).

## Escopo (só o Blog)

- Tabela `blog_posts` + migration manual.
- CMS em `/programacao/blog` (lista + editor markdown + publicar).
- Páginas públicas `/blog` e `/blog/[slug]` com SEO completo + sitemap.
- **Fora deste spec:** pipeline de IA (B) e termômetro de SEO (C).

## Decisões

- **Editor:** markdown (com pré-visualização). Casa com a saída da IA do pipeline.
- **Onde as públicas moram:** `src/app/blog/` (rota pública, fora do `(authed)`, igual
  as rotas de aprovação/PDF que já existem no root). Domínio: `sistemaacompanha.
  yidedigital.com.br/blog` — funciona pro Google; apontar pro domínio principal fica
  como follow-up de DNS.
- **Dependência nova:** `react-markdown` + `remark-gfm` (render de markdown → HTML).
- **Acesso ao CMS:** `programacao` + gestão (`adm`, `socio`). Reusa o padrão de acesso
  da programação.

## Banco (migration MANUAL)

```sql
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  titulo text not null,
  resumo text,                         -- excerpt / meta description fallback
  conteudo_md text not null default '',-- markdown
  cover_image_url text,
  status text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  meta_title text,                     -- SEO (fallback = titulo)
  meta_description text,               -- SEO (fallback = resumo)
  keywords text[] not null default '{}',
  autor_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists blog_posts_status_idx on public.blog_posts (organization_id, status, published_at desc);

alter table public.blog_posts enable row level security;
-- Leitura pública dos publicados (páginas públicas usam service-role de qualquer forma,
-- mas a policy deixa explícito). Escrita só via server actions (service-role/cookie).
drop policy if exists "blog_posts_select_publicado" on public.blog_posts;
create policy "blog_posts_select_publicado" on public.blog_posts
  for select using (status = 'publicado');
```

Escrita (create/update/publish/delete) via server actions com `createClient` (cookie) +
checagem de papel; leitura das públicas via service-role (sem cookie, cacheável).

## Módulos puros (testáveis)

`src/lib/blog/slug.ts`:
- `slugify(titulo: string): string` — minúsculas, sem acento, hifens, sem caractere
  especial. (ex: "Título de Teste!" → "titulo-de-teste").
- `slugUnico(base: string, existentes: Set<string>): string` — se colidir, sufixa
  `-2`, `-3`…

`src/lib/blog/seo.ts`:
- `metaDoPost(post): { title, description }` — meta_title||titulo, meta_description||
  resumo|| (primeiros ~155 chars do conteúdo sem markdown).
- `jsonLdArtigo(post, url): object` — schema.org Article (headline, description, image,
  datePublished, dateModified, author, publisher). Renderizado como `<script type=
  "application/ld+json">` na página do post.

## Dados/queries — `src/lib/blog/queries.ts` (SERVER)

- `listPostsAdmin(orgId): Promise<BlogPostRow[]>` — todos (qualquer status), recentes primeiro.
- `getPostAdmin(orgId, id)` — 1 post pra editar.
- `listPostsPublicados(orgId): Promise<BlogPostPublic[]>` — status publicado, published_at desc (índice público).
- `getPostPublicadoPorSlug(orgId, slug)` — 1 post publicado (página pública). Null se não achar.

## Actions — `src/lib/blog/actions.ts` (`"use server"`)

Gate: `requireAuth` + `podeGerenciarBlog(role)` (programacao/adm/socio).
- `criarPostAction(formData)` — cria rascunho; gera slug único a partir do título.
- `atualizarPostAction(formData)` — título, slug, resumo, conteudo_md, cover, meta_*,
  keywords. Slug re-checado por unicidade.
- `publicarPostAction(formData: {id, publicar: boolean})` — status publicado/rascunho;
  seta `published_at` na 1ª publicação.
- `excluirPostAction(id)` — soft? Não há deleted_at aqui; usar status `arquivado`
  (some das públicas e da lista principal, recuperável).
Todas: `revalidatePath("/programacao/blog")` + `revalidatePath("/blog")` +
`revalidatePath("/blog/[slug]")` (ou revalidateTag).

## CMS — `/programacao/blog`

- `src/app/(authed)/programacao/blog/page.tsx`: lista (título, status pill, data,
  autor) + botão "Novo post". Acesso gated; senão `notFound`.
- `src/app/(authed)/programacao/blog/[id]/page.tsx`: editor do post.
- `BlogEditor.tsx` (client): campos título, slug (auto do título, editável), resumo,
  **conteúdo markdown com preview ao lado** (react-markdown), URL da capa, SEO
  (meta title/description, keywords), status. Botões: Salvar, Publicar/Despublicar,
  Arquivar. Preview do markdown ao vivo.
- Botão "Blog →" na página principal da Programação (só quem pode gerenciar).

## Páginas públicas (SEO) — `src/app/blog/`

Sem auth. Usam service-role pra ler publicados. `export const revalidate = 300`
(ISR — rápido e indexável; revalida a cada 5 min ou via revalidatePath ao publicar).

- `src/app/blog/page.tsx`: índice — lista de posts publicados (capa, título, resumo,
  data), link pra cada `/blog/[slug]`. `generateMetadata` com title/description do blog.
- `src/app/blog/[slug]/page.tsx`: post completo — capa, título, data, autor, conteúdo
  markdown renderizado, **`generateMetadata`** (title, description, Open Graph, Twitter
  card, canonical) + **JSON-LD Article** inline. `notFound()` se slug não existe/não
  publicado.
- `src/app/blog/layout.tsx`: layout público simples (header com logo Yide + link "Blog",
  footer). Sem o app shell autenticado.
- `src/app/sitemap.ts`: sitemap incluindo `/blog` + cada `/blog/[slug]` publicado
  (Next.js MetadataRoute.Sitemap).
- `src/app/blog/robots` — na verdade `src/app/robots.ts` permitindo indexação do /blog.

Qual org? O app é single-org na prática (Matriz) mas multi-tenant no schema. Pras
públicas, resolver a org: usar a org "padrão" (a única ativa) — helper
`getOrgPadraoBlog()` que pega a primeira organização. (Documentar a limitação: blog é
por-org; público mostra a org padrão.)

## Testes

`tests/unit/blog-slug.test.ts` — slugify (acentos, especiais, espaços) + slugUnico (colisão).
`tests/unit/blog-seo.test.ts` — metaDoPost (fallbacks) + jsonLdArtigo (campos obrigatórios).

## Não-objetivos

- Sem comentários, sem categorias avançadas (só keywords/tags simples), sem busca no blog.
- Sem editor WYSIWYG (markdown).
- Sem multi-idioma.
- Pipeline de IA e termômetro de SEO são sub-projetos B e C.
