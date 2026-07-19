# Páginas de Serviço × Localidade (SEO local) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans para implementar task a task. Steps usam checkbox (`- [ ]`).

**Goal:** Criar páginas públicas de SEO por serviço × localidade (cidade e estado) para a Yide, geradas por IA com aprovação, com Schema.org e design moderno, gerenciadas na Programação.

**Architecture:** Espelha o subsistema do blog: tabelas Supabase + service-role, pipeline de IA (Claude) que gera conteúdo distinto por localidade como rascunho, páginas públicas `force-dynamic` com JSON-LD, CMS na Programação. Funções puras testadas com vitest.

**Tech Stack:** Next.js 16 (App Router, Server Components/Actions), Supabase (service-role, RLS), Anthropic (`claude-haiku-4-5`), Tailwind, next/font (Sora + IBM Plex Sans), vitest.

**Referência de padrões:** `src/lib/blog/*`, `src/app/blog/*`, `src/app/(authed)/programacao/blog/*`. Reusar: `createServiceRoleClient` (`@/lib/supabase/service-role`), `getAnthropicClient` (`@/lib/ai/client`), `semTravessao` (`@/lib/blog/texto`), `slugify`/`slugUnico` (`@/lib/blog/slug`), `requireAuth` (`@/lib/auth/session`), `getOrganizationId` (`@/lib/gerador-leads/queries`), `podeGerenciarBlog` (`@/lib/blog/acesso`), `Markdown` (`@/components/blog/Markdown`).

**Nota de segurança (JSON-LD):** a injeção do `<script type="application/ld+json">` deve seguir EXATAMENTE o padrão já usado e aprovado em `src/app/blog/[slug]/page.tsx`: serializar com `JSON.stringify(obj).replace(/</g, "\\u003c")` (escapa `<`, impede quebra de `</script>`) e injetar via a prop de innerHTML do React. O conteúdo é 100% gerado pela nossa própria função `jsonLdServicoLocal` (sem entrada de usuário externo). Copie esse trecho do post do blog como referência.

---

## File Structure

- `supabase/migrations/20260719040000_seo_servicos.sql` — 3 tabelas + índices + RLS.
- `src/lib/seo/config.ts` — SEED_SERVICOS, SEED_LOCALIDADES, YIDE_NAP.
- `src/lib/seo/slug.ts` — `slugPagina`, `caminhoPagina` (puras).
- `src/lib/seo/schema.ts` — `jsonLdServicoLocal` (puro).
- `src/lib/seo/gerar-parse.ts` — `parsePaginaGerada` (puro).
- `src/lib/seo/queries.ts` — leitura (server).
- `src/lib/seo/seed.ts` — `garantirSeedSeo(orgId)` (server).
- `src/lib/seo/pipeline.ts` — `gerarPaginaLocal`, `gerarPaginasPendentes` (server, IA).
- `src/lib/seo/actions.ts` — server actions.
- `src/app/servicos/layout.tsx` — shell público moderno.
- `src/app/servicos/page.tsx` — índice.
- `src/app/servicos/[servico]/page.tsx` — âncora do serviço.
- `src/app/servicos/[servico]/[localidade]/page.tsx` — página local + JSON-LD.
- `src/components/seo/Faq.tsx` — acordeão (client).
- `src/app/(authed)/programacao/seo/page.tsx` — CMS.
- `src/app/(authed)/programacao/seo/[id]/page.tsx` — editor.
- `src/components/seo/*.tsx` — botões/forms client.
- Testes: `tests/unit/seo-slug.test.ts`, `tests/unit/seo-schema.test.ts`, `tests/unit/seo-parse.test.ts`.

---

## Task 1: Migration (tabelas + RLS)

**Files:** Create `supabase/migrations/20260719040000_seo_servicos.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- SEO local: páginas serviço × localidade (cidade/estado), geradas por IA e aprovadas.
create table if not exists public.seo_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  slug text not null,
  descricao_base text not null default '',
  ordem int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.seo_localidades (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('cidade','estado')),
  uf text not null default '',
  slug text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table if not exists public.seo_paginas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  service_id uuid not null references public.seo_services(id) on delete cascade,
  localidade_id uuid not null references public.seo_localidades(id) on delete cascade,
  slug text not null,
  titulo text not null default '',
  meta_title text,
  meta_description text,
  conteudo_md text not null default '',
  faq jsonb not null default '[]',
  status text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, service_id, localidade_id)
);

create index if not exists seo_paginas_pub_idx on public.seo_paginas (organization_id, status);
create index if not exists seo_paginas_slug_idx on public.seo_paginas (organization_id, slug);

alter table public.seo_services enable row level security;
alter table public.seo_localidades enable row level security;
alter table public.seo_paginas enable row level security;

drop policy if exists "seo_paginas_select_publicado" on public.seo_paginas;
create policy "seo_paginas_select_publicado" on public.seo_paginas
  for select using (status = 'publicado');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260719040000_seo_servicos.sql
git commit -m "feat(seo): migration — tabelas de serviços, localidades e páginas"
```

---

## Task 2: Config e seed (constantes)

**Files:** Create `src/lib/seo/config.ts`

- [ ] **Step 1: Escrever config**

```ts
export interface SeedServico { nome: string; slug: string; descricao_base: string; ordem: number }
export interface SeedLocalidade { nome: string; tipo: "cidade" | "estado"; uf: string; slug: string }

export const SEED_SERVICOS: SeedServico[] = [
  { nome: "Gestão de Tráfego Pago", slug: "gestao-de-trafego", ordem: 1,
    descricao_base: "Gestão de anúncios no Google Ads, Meta Ads e Instagram para gerar leads e vendas com performance e dados." },
  { nome: "Criação de Sites e Sistemas", slug: "criacao-de-sites", ordem: 2,
    descricao_base: "Sites, landing pages e sistemas sob medida, rápidos, otimizados para SEO e conversão." },
  { nome: "Gestão de Redes Sociais", slug: "redes-sociais", ordem: 3,
    descricao_base: "Gestão de conteúdo e perfis (Instagram, etc.), calendário editorial e crescimento de audiência." },
  { nome: "CRM, IA e Dados", slug: "crm-ia-dados", ordem: 4,
    descricao_base: "Automação comercial, CRM, inteligência de dados e IA para escalar o comercial." },
];

export const SEED_LOCALIDADES: SeedLocalidade[] = [
  { nome: "Cuiabá", tipo: "cidade", uf: "MT", slug: "cuiaba" },
  { nome: "Várzea Grande", tipo: "cidade", uf: "MT", slug: "varzea-grande" },
  { nome: "Salvador", tipo: "cidade", uf: "BA", slug: "salvador" },
  { nome: "Vila Velha", tipo: "cidade", uf: "ES", slug: "vila-velha" },
  { nome: "Mato Grosso", tipo: "estado", uf: "MT", slug: "mato-grosso" },
  { nome: "Bahia", tipo: "estado", uf: "BA", slug: "bahia" },
  { nome: "Espírito Santo", tipo: "estado", uf: "ES", slug: "espirito-santo" },
];

export const YIDE_NAP = {
  nome: "Yide Digital", telefone: "+55 65 98144-7380", email: "yidedigital@gmail.com",
  cidade: "Cuiabá", uf: "MT", pais: "BR", site: "https://yidedigital.com.br",
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/seo/config.ts
git commit -m "feat(seo): config com serviços/localidades seed e NAP"
```

---

## Task 3: Slugs (puro + teste)

**Files:** Create `src/lib/seo/slug.ts`, Test `tests/unit/seo-slug.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { slugPagina, caminhoPagina } from "@/lib/seo/slug";

describe("slugPagina", () => {
  it("combina serviço e localidade", () => {
    expect(slugPagina("gestao-de-trafego", "salvador")).toBe("gestao-de-trafego-salvador");
  });
});
describe("caminhoPagina", () => {
  it("monta o caminho público", () => {
    expect(caminhoPagina("gestao-de-trafego", "salvador")).toBe("/servicos/gestao-de-trafego/salvador");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run tests/unit/seo-slug.test.ts --exclude '**/.claude/**'` → FAIL

- [ ] **Step 3: Implementar**

```ts
export function slugPagina(slugServico: string, slugLocalidade: string): string {
  return `${slugServico}-${slugLocalidade}`;
}
export function caminhoPagina(slugServico: string, slugLocalidade: string): string {
  return `/servicos/${slugServico}/${slugLocalidade}`;
}
```

- [ ] **Step 4: Rodar e passar** — mesmo comando → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/slug.ts tests/unit/seo-slug.test.ts
git commit -m "feat(seo): helpers de slug/caminho + testes"
```

---

## Task 4: JSON-LD (puro + teste)

**Files:** Create `src/lib/seo/schema.ts`, Test `tests/unit/seo-schema.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { jsonLdServicoLocal } from "@/lib/seo/schema";

const base = { servicoNome: "Gestão de Tráfego Pago", descricao: "Anúncios que vendem",
  url: "https://yidedigital.com.br/servicos/gestao-de-trafego/salvador",
  faq: [{ pergunta: "Quanto custa?", resposta: "Depende do projeto." }] };

describe("jsonLdServicoLocal", () => {
  it("cidade vira areaServed City", () => {
    const g = jsonLdServicoLocal({ ...base, localidadeNome: "Salvador", tipo: "cidade", uf: "BA" });
    const s = g["@graph"].find((n: { "@type": string }) => n["@type"] === "Service");
    expect(s.areaServed["@type"]).toBe("City");
    expect(s.areaServed.name).toBe("Salvador");
  });
  it("estado vira AdministrativeArea", () => {
    const g = jsonLdServicoLocal({ ...base, localidadeNome: "Bahia", tipo: "estado", uf: "BA" });
    const s = g["@graph"].find((n: { "@type": string }) => n["@type"] === "Service");
    expect(s.areaServed["@type"]).toBe("AdministrativeArea");
  });
  it("inclui FAQPage quando há faq", () => {
    const g = jsonLdServicoLocal({ ...base, localidadeNome: "Salvador", tipo: "cidade", uf: "BA" });
    expect(g["@graph"].some((n: { "@type": string }) => n["@type"] === "FAQPage")).toBe(true);
  });
  it("sem faq não inclui FAQPage", () => {
    const g = jsonLdServicoLocal({ ...base, faq: [], localidadeNome: "Salvador", tipo: "cidade", uf: "BA" });
    expect(g["@graph"].some((n: { "@type": string }) => n["@type"] === "FAQPage")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL

- [ ] **Step 3: Implementar**

```ts
import { YIDE_NAP } from "./config";

export interface JsonLdInput {
  servicoNome: string; descricao: string; url: string;
  localidadeNome: string; tipo: "cidade" | "estado"; uf: string;
  faq: { pergunta: string; resposta: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonLdServicoLocal(i: JsonLdInput): { "@context": string; "@graph": any[] } {
  const areaServed = i.tipo === "cidade"
    ? { "@type": "City", name: i.localidadeNome }
    : { "@type": "AdministrativeArea", name: i.localidadeNome };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph: any[] = [
    { "@type": "ProfessionalService", name: YIDE_NAP.nome, telephone: YIDE_NAP.telefone, email: YIDE_NAP.email, url: YIDE_NAP.site,
      address: { "@type": "PostalAddress", addressLocality: YIDE_NAP.cidade, addressRegion: YIDE_NAP.uf, addressCountry: YIDE_NAP.pais } },
    { "@type": "Service", name: `${i.servicoNome} em ${i.localidadeNome}`, description: i.descricao, serviceType: i.servicoNome,
      provider: { "@type": "Organization", name: YIDE_NAP.nome, url: YIDE_NAP.site }, areaServed, url: i.url },
  ];
  if (i.faq.length > 0) {
    graph.push({ "@type": "FAQPage", mainEntity: i.faq.map((f) => ({
      "@type": "Question", name: f.pergunta, acceptedAnswer: { "@type": "Answer", text: f.resposta } })) });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
```

- [ ] **Step 4: Rodar e passar** → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/schema.ts tests/unit/seo-schema.test.ts
git commit -m "feat(seo): builder de JSON-LD (Service/LocalBusiness/FAQ) + testes"
```

---

## Task 5: Parse da saída da IA (puro + teste)

**Files:** Create `src/lib/seo/gerar-parse.ts`, Test `tests/unit/seo-parse.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { parsePaginaGerada } from "@/lib/seo/gerar-parse";

describe("parsePaginaGerada", () => {
  it("valida e sanitiza (sem travessão)", () => {
    const r = parsePaginaGerada({ titulo: "Tráfego XX em Salvador".replace("XX", "—"),
      meta_title: "t", meta_description: "d", conteudo_md: "corpo — aqui",
      faq: [{ pergunta: "P?", resposta: "R — sim" }] });
    expect(r).not.toBeNull();
    expect(r!.titulo.includes("—")).toBe(false);
    expect(r!.faq[0].resposta.includes("—")).toBe(false);
  });
  it("retorna null sem título/conteúdo", () => {
    expect(parsePaginaGerada({ titulo: "" })).toBeNull();
    expect(parsePaginaGerada(null)).toBeNull();
  });
  it("faq inválida vira lista vazia", () => {
    const r = parsePaginaGerada({ titulo: "T", conteudo_md: "c", faq: "x" });
    expect(r!.faq).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** → FAIL

- [ ] **Step 3: Implementar**

```ts
import { semTravessao } from "@/lib/blog/texto";

export interface PaginaGerada {
  titulo: string; meta_title: string; meta_description: string;
  conteudo_md: string; faq: { pergunta: string; resposta: string }[];
}

export function parsePaginaGerada(raw: Record<string, unknown> | null): PaginaGerada | null {
  if (!raw || typeof raw.titulo !== "string" || typeof raw.conteudo_md !== "string") return null;
  const titulo = semTravessao(raw.titulo.trim());
  if (!titulo) return null;
  const conteudo_md = semTravessao(String(raw.conteudo_md).trim());
  if (!conteudo_md) return null;
  const faqRaw = Array.isArray(raw.faq) ? raw.faq : [];
  const faq = faqRaw
    .map((f) => (f && typeof f === "object" ? f as Record<string, unknown> : {}))
    .filter((f) => typeof f.pergunta === "string" && typeof f.resposta === "string")
    .map((f) => ({ pergunta: semTravessao(String(f.pergunta).trim()), resposta: semTravessao(String(f.resposta).trim()) }))
    .slice(0, 6);
  return {
    titulo: titulo.slice(0, 160),
    meta_title: typeof raw.meta_title === "string" ? semTravessao(raw.meta_title.trim()).slice(0, 70) : titulo.slice(0, 70),
    meta_description: typeof raw.meta_description === "string" ? semTravessao(raw.meta_description.trim()).slice(0, 160) : "",
    conteudo_md, faq,
  };
}
```

- [ ] **Step 4: Rodar e passar** → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo/gerar-parse.ts tests/unit/seo-parse.test.ts
git commit -m "feat(seo): parse/sanitização da saída da IA + testes"
```

---

## Task 6: Seed (server)

**Files:** Create `src/lib/seo/seed.ts`

- [ ] **Step 1: Implementar**

```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { SEED_SERVICOS, SEED_LOCALIDADES } from "./config";

export async function garantirSeedSeo(orgId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb: any = createServiceRoleClient();
  await sb.from("seo_services").upsert(
    SEED_SERVICOS.map((s) => ({ organization_id: orgId, nome: s.nome, slug: s.slug, descricao_base: s.descricao_base, ordem: s.ordem })),
    { onConflict: "organization_id,slug", ignoreDuplicates: true });
  await sb.from("seo_localidades").upsert(
    SEED_LOCALIDADES.map((l) => ({ organization_id: orgId, nome: l.nome, tipo: l.tipo, uf: l.uf, slug: l.slug })),
    { onConflict: "organization_id,slug", ignoreDuplicates: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/seo/seed.ts
git commit -m "feat(seo): seed idempotente de serviços/localidades"
```

---

## Task 7: Queries (server)

**Files:** Create `src/lib/seo/queries.ts` — tipos `Servico`, `Localidade`, `PaginaLista`, `PaginaPublica` e funções `getOrgPadrao`, `listServicos`, `listLocalidades`, `listPaginas`, `getPaginaAdmin`, `getServicoPublicado`, `getPaginaPublica`, `listPaginasPublicadasDoServico`, `listServicosComPaginas`.

- [ ] **Step 1: Implementar** (usa `createServiceRoleClient`; embeds `seo_services!inner`/`seo_localidades!inner` pra join por slug; `getOrgPadrao` = 1ª org por `created_at`, igual `getOrgPadraoBlog`). Código completo:

```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface Servico { id: string; nome: string; slug: string; descricao_base: string; ordem: number; ativo: boolean }
export interface Localidade { id: string; nome: string; tipo: "cidade" | "estado"; uf: string; slug: string; ativo: boolean }
export interface PaginaLista { id: string; service_id: string; localidade_id: string; slug: string; titulo: string; status: string }
export interface PaginaPublica {
  titulo: string; meta_title: string | null; meta_description: string | null;
  conteudo_md: string; faq: { pergunta: string; resposta: string }[];
  servicoNome: string; servicoSlug: string; localidadeNome: string; localidadeSlug: string; tipo: "cidade" | "estado"; uf: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }

export async function getOrgPadrao(): Promise<string | null> {
  const { data } = await sb().from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}
export async function listServicos(orgId: string): Promise<Servico[]> {
  const { data } = await sb().from("seo_services").select("id, nome, slug, descricao_base, ordem, ativo")
    .eq("organization_id", orgId).order("ordem", { ascending: true });
  return (data ?? []) as Servico[];
}
export async function listLocalidades(orgId: string): Promise<Localidade[]> {
  const { data } = await sb().from("seo_localidades").select("id, nome, tipo, uf, slug, ativo")
    .eq("organization_id", orgId).order("tipo", { ascending: true }).order("nome", { ascending: true });
  return (data ?? []) as Localidade[];
}
export async function listPaginas(orgId: string): Promise<PaginaLista[]> {
  const { data } = await sb().from("seo_paginas").select("id, service_id, localidade_id, slug, titulo, status")
    .eq("organization_id", orgId).neq("status", "arquivado");
  return (data ?? []) as PaginaLista[];
}
export async function getPaginaAdmin(orgId: string, id: string) {
  const { data } = await sb().from("seo_paginas").select("*").eq("organization_id", orgId).eq("id", id).maybeSingle();
  return data ?? null;
}
export async function getServicoPublicado(orgId: string, servicoSlug: string) {
  const { data } = await sb().from("seo_services").select("id, nome, slug, descricao_base")
    .eq("organization_id", orgId).eq("slug", servicoSlug).eq("ativo", true).maybeSingle();
  return data ?? null;
}
export async function getPaginaPublica(orgId: string, servicoSlug: string, localidadeSlug: string): Promise<PaginaPublica | null> {
  const { data } = await sb().from("seo_paginas")
    .select("titulo, meta_title, meta_description, conteudo_md, faq, seo_services!inner(nome, slug), seo_localidades!inner(nome, slug, tipo, uf)")
    .eq("organization_id", orgId).eq("status", "publicado")
    .eq("seo_services.slug", servicoSlug).eq("seo_localidades.slug", localidadeSlug).maybeSingle();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { titulo: d.titulo, meta_title: d.meta_title, meta_description: d.meta_description,
    conteudo_md: d.conteudo_md, faq: Array.isArray(d.faq) ? d.faq : [],
    servicoNome: d.seo_services.nome, servicoSlug: d.seo_services.slug,
    localidadeNome: d.seo_localidades.nome, localidadeSlug: d.seo_localidades.slug,
    tipo: d.seo_localidades.tipo, uf: d.seo_localidades.uf };
}
export async function listPaginasPublicadasDoServico(orgId: string, servicoSlug: string) {
  const { data } = await sb().from("seo_paginas")
    .select("titulo, seo_services!inner(slug), seo_localidades!inner(nome, slug, tipo)")
    .eq("organization_id", orgId).eq("status", "publicado").eq("seo_services.slug", servicoSlug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((d) => ({ titulo: d.titulo, localidadeNome: d.seo_localidades.nome, localidadeSlug: d.seo_localidades.slug, tipo: d.seo_localidades.tipo }));
}
export async function listServicosComPaginas(orgId: string) {
  return (await listServicos(orgId)).filter((s) => s.ativo);
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit 2>&1 | tail -3` → sem erros

- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/queries.ts
git commit -m "feat(seo): queries de serviços/localidades/páginas (server)"
```

---

## Task 8: Pipeline de geração (IA)

**Files:** Create `src/lib/seo/pipeline.ts` — `montarPromptPagina(servico, loc)`, `gerarPaginaLocal(orgId, servico, loc)`, `gerarPaginasPendentes(orgId, servicos, localidades, jaExistem, limite=4)`.

- [ ] **Step 1: Implementar** (importa `extrairJson` de `@/lib/blog/pipeline/gerar`, `parsePaginaGerada`, `slugPagina`; model `claude-haiku-4-5`; upsert por `organization_id,service_id,localidade_id`, status `rascunho`; prompt exige conteúdo distinto por localidade e proíbe travessão). Código:

```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import { extrairJson } from "@/lib/blog/pipeline/gerar";
import { parsePaginaGerada } from "./gerar-parse";
import { slugPagina } from "./slug";
import type { Servico, Localidade } from "./queries";

const SEO_MODEL = "claude-haiku-4-5";

export function montarPromptPagina(servico: Servico, loc: Localidade): string {
  const nivel = loc.tipo === "estado" ? `no estado ${loc.nome} (${loc.uf})` : `na cidade de ${loc.nome} (${loc.uf})`;
  return `Você é redator(a) de SEO da Yide Digital, agência de marketing e programação. Escreva o conteúdo de uma PÁGINA DE SERVIÇO local, ORIGINAL em pt-br, sobre "${servico.nome}" ${nivel}.

Contexto do serviço: ${servico.descricao_base}

Regras:
- Foque em "${servico.nome.toLowerCase()} em ${loc.nome}"; use variações naturais.
- Conteúdo DISTINTO pra esta localidade (realidade local, tipos de negócio da praça). NÃO escreva algo genérico que sirva pra qualquer cidade.
- Tom profissional e acessível. Posicione a Yide como referência local.
- NUNCA use travessão nem meia-risca. Use vírgula, dois-pontos, ponto ou parênteses.

Responda SOMENTE com JSON válido (sem cercas, sem texto fora):
{"titulo": "H1 com serviço e localidade", "meta_title": "SEO até 60 chars", "meta_description": "SEO até 155 chars", "conteudo_md": "600-900 palavras em markdown com ## subtítulos: o que é, por que investir em ${loc.nome}, como a Yide entrega, resultados, CTA", "faq": [{"pergunta": "...", "resposta": "..."}]}
Gere 3 a 5 itens de FAQ específicos da localidade.`;
}

export async function gerarPaginaLocal(orgId: string, servico: Servico, loc: Localidade): Promise<boolean> {
  const client = getAnthropicClient();
  if (!client) { console.error("[seo] Anthropic não configurado"); return false; }
  try {
    const res = await client.messages.create({ model: SEO_MODEL, max_tokens: 3500,
      messages: [{ role: "user", content: montarPromptPagina(servico, loc) }] });
    const txt = res.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    const parsed = parsePaginaGerada(extrairJson(txt));
    if (!parsed) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = createServiceRoleClient();
    const { error } = await sb.from("seo_paginas").upsert({
      organization_id: orgId, service_id: servico.id, localidade_id: loc.id, slug: slugPagina(servico.slug, loc.slug),
      titulo: parsed.titulo, meta_title: parsed.meta_title, meta_description: parsed.meta_description,
      conteudo_md: parsed.conteudo_md, faq: parsed.faq, status: "rascunho", updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,service_id,localidade_id" });
    if (error) { console.error("[seo] upsert página:", error.message); return false; }
    return true;
  } catch (e) { console.error("[seo] gerarPaginaLocal:", e); return false; }
}

export async function gerarPaginasPendentes(orgId: string, servicos: Servico[], localidades: Localidade[], jaExistem: Set<string>, limite = 4): Promise<{ gerados: number; erros: number }> {
  let gerados = 0, erros = 0;
  for (const s of servicos.filter((x) => x.ativo)) {
    for (const l of localidades.filter((x) => x.ativo)) {
      if (gerados >= limite) return { gerados, erros };
      if (jaExistem.has(`${s.id}:${l.id}`)) continue;
      const ok = await gerarPaginaLocal(orgId, s, l);
      if (ok) gerados++; else erros++;
    }
  }
  return { gerados, erros };
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit 2>&1 | tail -3` → sem erros
- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/pipeline.ts
git commit -m "feat(seo): pipeline de geração de páginas por IA (rascunho)"
```

---

## Task 9: Server actions

**Files:** Create `src/lib/seo/actions.ts` — `"use server"`. Actions: `seedSeoAction`, `gerarPendentesAction`, `gerarUmaAction`, `publicarPaginaAction` (usa `parseBoolCampo` — cuidado com o footgun do coerce), `salvarPaginaAction`, `addLocalidadeAction`. Gate = `requireAuth` + `podeGerenciarBlog` + `getOrganizationId`. `revalidatePath("/programacao/seo")` e `"/servicos"`.

- [ ] **Step 1: Implementar** (código completo)

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { parseBoolCampo } from "@/lib/blog/form";
import { slugify, slugUnico } from "@/lib/blog/slug";
import { garantirSeedSeo } from "./seed";
import { listServicos, listLocalidades, listPaginas } from "./queries";
import { gerarPaginasPendentes, gerarPaginaLocal } from "./pipeline";

interface Ok { success: true } interface Err { error: string } type Result = Ok | Err;
const uuidLike = z.string().regex(/^[0-9a-fA-F-]{36}$/, "ID inválido");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }
async function gate(): Promise<{ orgId: string } | Err> {
  const actor = await requireAuth();
  if (!podeGerenciarBlog(actor.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(actor.id);
  if (!orgId) return { error: "Sem organização" };
  return { orgId };
}
function revalida() { revalidatePath("/programacao/seo"); revalidatePath("/servicos"); }

export async function seedSeoAction(): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  await garantirSeedSeo(g.orgId); revalida(); return { success: true };
}
export async function gerarPendentesAction(): Promise<{ success: true; gerados: number; erros: number } | Err> {
  const g = await gate(); if ("error" in g) return g;
  await garantirSeedSeo(g.orgId);
  const [servicos, localidades, paginas] = await Promise.all([listServicos(g.orgId), listLocalidades(g.orgId), listPaginas(g.orgId)]);
  const jaExistem = new Set(paginas.map((p) => `${p.service_id}:${p.localidade_id}`));
  const r = await gerarPaginasPendentes(g.orgId, servicos, localidades, jaExistem, 4);
  revalida(); return { success: true, ...r };
}
export async function gerarUmaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const parsed = z.object({ serviceId: uuidLike, localidadeId: uuidLike }).safeParse({ serviceId: formData.get("serviceId"), localidadeId: formData.get("localidadeId") });
  if (!parsed.success) return { error: "Dados inválidos" };
  const [servicos, localidades] = await Promise.all([listServicos(g.orgId), listLocalidades(g.orgId)]);
  const s = servicos.find((x) => x.id === parsed.data.serviceId); const l = localidades.find((x) => x.id === parsed.data.localidadeId);
  if (!s || !l) return { error: "Serviço/localidade não encontrado" };
  const ok = await gerarPaginaLocal(g.orgId, s, l); revalida();
  return ok ? { success: true } : { error: "Não consegui gerar agora." };
}
export async function publicarPaginaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const parsed = z.object({ id: uuidLike, publicar: z.boolean() }).safeParse({ id: formData.get("id"), publicar: parseBoolCampo(formData.get("publicar")) });
  if (!parsed.success) return { error: "Dados inválidos" };
  const { data, error } = await sb().from("seo_paginas")
    .update({ status: parsed.data.publicar ? "publicado" : "rascunho", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Página não encontrada" };
  revalida(); return { success: true };
}
export async function salvarPaginaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const id = String(formData.get("id") ?? ""); const titulo = String(formData.get("titulo") ?? "").trim();
  const conteudo_md = String(formData.get("conteudo_md") ?? "");
  const meta_title = String(formData.get("meta_title") ?? "").trim();
  const meta_description = String(formData.get("meta_description") ?? "").trim();
  if (!uuidLike.safeParse(id).success || !titulo) return { error: "Dados inválidos" };
  const { data, error } = await sb().from("seo_paginas")
    .update({ titulo, conteudo_md, meta_title, meta_description, updated_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Página não encontrada" };
  revalida(); return { success: true };
}
export async function addLocalidadeAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const nome = String(formData.get("nome") ?? "").trim(); const tipo = String(formData.get("tipo") ?? "");
  const uf = String(formData.get("uf") ?? "").trim().toUpperCase().slice(0, 2);
  if (!nome || (tipo !== "cidade" && tipo !== "estado")) return { error: "Dados inválidos" };
  const existentes = await listLocalidades(g.orgId);
  const slug = slugUnico(slugify(nome), new Set(existentes.map((l) => l.slug)));
  const { error } = await sb().from("seo_localidades").insert({ organization_id: g.orgId, nome, tipo, uf, slug });
  if (error) return { error: error.message };
  revalida(); return { success: true };
}
```

- [ ] **Step 2: Type-check + lint** — `npx tsc --noEmit && npx eslint src/lib/seo` → sem erros
- [ ] **Step 3: Commit**

```bash
git add src/lib/seo/actions.ts
git commit -m "feat(seo): server actions (seed, gerar, publicar, salvar, add localidade)"
```

---

## Task 10: Shell público moderno

**Files:** Create `src/app/servicos/layout.tsx` — reusa Sora + IBM Plex Sans (variáveis `--font-display`/`--font-sans-blog`), masthead/rodapé pretos com logo `public/brand/logo-yide.png`, nav (Serviços/Blog/CTA WhatsApp `https://wa.me/5565981447380`), fio de cor ciano. Base do wrapper: `min-h-screen bg-[#faf9f7] text-neutral-900 [color-scheme:light]`. (Copiar estrutura de `src/app/blog/layout.tsx`, trocando `max-w-5xl`→`max-w-6xl` e adicionando a nav.)

- [ ] **Step 1: Implementar** (ver referência `src/app/blog/layout.tsx`)
- [ ] **Step 2: Commit**

```bash
git add src/app/servicos/layout.tsx
git commit -m "feat(seo): shell público moderno de /servicos"
```

---

## Task 11: FAQ acordeão (client)

**Files:** Create `src/components/seo/Faq.tsx`

- [ ] **Step 1: Implementar**

```tsx
"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
export function Faq({ itens }: { itens: { pergunta: string; resposta: string }[] }) {
  const [aberto, setAberto] = useState<number | null>(0);
  if (itens.length === 0) return null;
  return (
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {itens.map((f, i) => (
        <div key={i}>
          <button type="button" onClick={() => setAberto(aberto === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold [font-family:var(--font-display)] hover:bg-neutral-50">
            {f.pergunta}
            <ChevronDown className={`h-4 w-4 shrink-0 text-teal-600 transition-transform ${aberto === i ? "rotate-180" : ""}`} />
          </button>
          {aberto === i && <p className="px-5 pb-5 text-[15px] leading-relaxed text-neutral-600">{f.resposta}</p>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/seo/Faq.tsx
git commit -m "feat(seo): componente de FAQ acordeão"
```

---

## Task 12: Página pública serviço × localidade

**Files:** Create `src/app/servicos/[servico]/[localidade]/page.tsx` — `force-dynamic`; `generateMetadata` (title/description/canonical de `caminhoPagina`); carrega via `getOrgPadrao`+`getPaginaPublica`, `notFound()` se null; monta o JSON-LD com `jsonLdServicoLocal(...)` e injeta num `<script type="application/ld+json">` **seguindo o padrão de `src/app/blog/[slug]/page.tsx`** (serializa com `JSON.stringify(...).replace(/</g, "\\u003c")` e injeta via innerHTML do React). Layout moderno: hero (chip MapPin localidade+uf, H1 Sora, CTA WhatsApp), corpo `<Markdown light>{conteudo_md}</Markdown>` em `max-w-2xl`, seção FAQ `<Faq itens={p.faq} />`, CTA final. Estrutura de referência abaixo (sem a linha de injeção, que vem do arquivo do blog):

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, MapPin } from "lucide-react";
import { getOrgPadrao, getPaginaPublica } from "@/lib/seo/queries";
import { jsonLdServicoLocal } from "@/lib/seo/schema";
import { caminhoPagina } from "@/lib/seo/slug";
import { Markdown } from "@/components/blog/Markdown";
import { Faq } from "@/components/seo/Faq";

export const dynamic = "force-dynamic";
const SITE = "https://yidedigital.com.br";

async function carregar(servico: string, localidade: string) {
  const orgId = await getOrgPadrao();
  return orgId ? getPaginaPublica(orgId, servico, localidade) : null;
}
export async function generateMetadata({ params }: { params: Promise<{ servico: string; localidade: string }> }): Promise<Metadata> {
  const { servico, localidade } = await params;
  const p = await carregar(servico, localidade);
  if (!p) return { title: "Página não encontrada · Yide Digital" };
  const title = p.meta_title || `${p.servicoNome} em ${p.localidadeNome} · Yide Digital`;
  return { title, description: p.meta_description || undefined,
    alternates: { canonical: caminhoPagina(p.servicoSlug, p.localidadeSlug) },
    openGraph: { title, description: p.meta_description || undefined, type: "website" } };
}
export default async function PaginaServicoLocal({ params }: { params: Promise<{ servico: string; localidade: string }> }) {
  const { servico, localidade } = await params;
  const p = await carregar(servico, localidade);
  if (!p) notFound();
  const url = `${SITE}${caminhoPagina(p.servicoSlug, p.localidadeSlug)}`;
  const jsonld = JSON.stringify(jsonLdServicoLocal({ servicoNome: p.servicoNome, descricao: p.meta_description || p.titulo, url,
    localidadeNome: p.localidadeNome, tipo: p.tipo, uf: p.uf, faq: p.faq })).replace(/</g, "\\u003c");
  return (
    <article>
      {/* injetar aqui o <script type="application/ld+json"> com {jsonld}, IGUAL ao post do blog */}
      <Link href={`/servicos/${p.servicoSlug}`} className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" /> {p.servicoNome}
      </Link>
      <header className="relative mt-6 overflow-hidden rounded-[1.75rem] border border-teal-100/80 bg-gradient-to-br from-teal-50 via-cyan-50/50 to-[#faf9f7] px-7 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-teal-400/15 blur-3xl" />
        <p className="relative inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600">
          <MapPin className="h-3.5 w-3.5" /> {p.localidadeNome} · {p.uf}</p>
        <h1 className="relative mt-3 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl">{p.titulo}</h1>
        <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
          className="relative mt-6 inline-block rounded-full bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700">Solicitar proposta</a>
      </header>
      <div className="mx-auto mt-10 max-w-2xl"><Markdown light>{p.conteudo_md}</Markdown></div>
      {p.faq.length > 0 && (
        <section className="mx-auto mt-12 max-w-2xl">
          <h2 className="mb-4 text-2xl font-bold tracking-tight [font-family:var(--font-display)]">Perguntas frequentes</h2>
          <Faq itens={p.faq} />
        </section>
      )}
      <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-neutral-200 bg-white p-7 text-center">
        <p className="text-xl font-bold [font-family:var(--font-display)]">Vamos crescer sua empresa em {p.localidadeNome}?</p>
        <p className="mt-1 text-sm text-neutral-600">A Yide Digital cuida do seu {p.servicoNome.toLowerCase()} de ponta a ponta.</p>
        <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer"
          className="mt-4 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Falar com a Yide</a>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Adicionar a injeção do JSON-LD** copiando a linha do `<script application/ld+json>` de `src/app/blog/[slug]/page.tsx` (usa a prop de innerHTML do React com `{ __html: jsonld }`).
- [ ] **Step 3: Commit**

```bash
git add "src/app/servicos/[servico]/[localidade]/page.tsx"
git commit -m "feat(seo): página pública serviço×localidade com JSON-LD"
```

---

## Task 13: Índice e âncora de serviço

**Files:** Create `src/app/servicos/page.tsx` (índice: grid de cards dos serviços de `listServicosComPaginas`) e `src/app/servicos/[servico]/page.tsx` (âncora: `getServicoPublicado` + `listPaginasPublicadasDoServico`, agrupando cidades/estados, cards com links `/servicos/[servico]/[localidade]`). Ambos `force-dynamic`, design moderno (cards com sombra/hover, headline Sora). Código completo:

```tsx
// src/app/servicos/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { getOrgPadrao, listServicosComPaginas } from "@/lib/seo/queries";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Serviços · Yide Digital",
  description: "Marketing, tráfego, sites e IA para empresas em Cuiabá, Salvador, Vila Velha e região.",
  alternates: { canonical: "/servicos" } };
export default async function ServicosIndex() {
  const orgId = await getOrgPadrao();
  const servicos = orgId ? await listServicosComPaginas(orgId) : [];
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight [font-family:var(--font-display)] sm:text-5xl">Nossos serviços</h1>
        <p className="mt-3 max-w-xl text-neutral-600">Marketing, tráfego, sites e IA para empresas de Cuiabá, Várzea Grande, Salvador, Vila Velha e além.</p>
      </header>
      <div className="grid gap-6 sm:grid-cols-2">
        {servicos.map((s) => (
          <Link key={s.id} href={`/servicos/${s.slug}`} className="group rounded-2xl border border-neutral-200/90 bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            <h2 className="text-xl font-bold tracking-tight [font-family:var(--font-display)] group-hover:text-teal-700">{s.nome}</h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.descricao_base}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-teal-600">Ver mais →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// src/app/servicos/[servico]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { getOrgPadrao, getServicoPublicado, listPaginasPublicadasDoServico } from "@/lib/seo/queries";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ servico: string }> }): Promise<Metadata> {
  const { servico } = await params;
  const orgId = await getOrgPadrao();
  const s = orgId ? await getServicoPublicado(orgId, servico) : null;
  if (!s) return { title: "Serviço não encontrado · Yide Digital" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sv = s as any;
  return { title: `${sv.nome} · Yide Digital`, description: sv.descricao_base, alternates: { canonical: `/servicos/${sv.slug}` } };
}
export default async function ServicoAncora({ params }: { params: Promise<{ servico: string }> }) {
  const { servico } = await params;
  const orgId = await getOrgPadrao();
  const s = orgId ? await getServicoPublicado(orgId, servico) : null;
  if (!s) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sv = s as any;
  const paginas = await listPaginasPublicadasDoServico(orgId!, servico);
  const cidades = paginas.filter((p) => p.tipo === "cidade");
  const estados = paginas.filter((p) => p.tipo === "estado");
  const grupos: [string, typeof paginas][] = [["Cidades", cidades], ["Estados", estados]];
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h1 className="text-4xl font-bold tracking-tight [font-family:var(--font-display)] sm:text-5xl">{sv.nome}</h1>
        <p className="mt-3 text-lg text-neutral-600">{sv.descricao_base}</p>
      </header>
      {grupos.map(([titulo, lista]) => lista.length > 0 && (
        <section key={titulo}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">{titulo}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((p) => (
              <Link key={p.localidadeSlug} href={`/servicos/${sv.slug}/${p.localidadeSlug}`}
                className="group flex items-center gap-2 rounded-xl border border-neutral-200/90 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <MapPin className="h-4 w-4 text-teal-600" />
                <span className="font-medium group-hover:text-teal-700">{sv.nome} em {p.localidadeNome}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {paginas.length === 0 && <p className="text-neutral-500">Páginas em breve.</p>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/servicos/page.tsx "src/app/servicos/[servico]/page.tsx"
git commit -m "feat(seo): índice de serviços e página-âncora por serviço"
```

---

## Task 14: CMS — botões/form client

**Files:** Create `src/components/seo/GerarPendentesButton.tsx`, `PublicarPaginaButton.tsx`, `AddLocalidadeForm.tsx`. Padrão dos botões do blog: `"use client"`, `useTransition`, `useRouter`, `toast` (sonner), `Button` de `@/components/ui/button`. Confirm no gerar. **Nota:** `PublicarPaginaButton` envia `publicar = String(!publicado)` e a action usa `parseBoolCampo` (não `coerce.boolean`, que tem o footgun de tratar "false" como true).

- [ ] **Step 1: `GerarPendentesButton`** (confirm; chama `gerarPendentesAction`; toast com `r.gerados`)
- [ ] **Step 2: `PublicarPaginaButton`** (FormData `id` + `publicar`; chama `publicarPaginaAction`)
- [ ] **Step 3: `AddLocalidadeForm`** (inputs nome/tipo/uf; chama `addLocalidadeAction`)

(Ver `src/components/blog/GerarRascunhosButton.tsx` e `AprovarPublicarButton.tsx` como molde exato.)

- [ ] **Step 4: Commit**

```bash
git add src/components/seo/
git commit -m "feat(seo): botões/form do CMS (gerar, publicar, add localidade)"
```

---

## Task 15: CMS — página principal e editor

**Files:** Create `src/app/(authed)/programacao/seo/page.tsx` (gate `podeGerenciarBlog`, `garantirSeedSeo(orgId)`, matriz serviço×localidade com status/PublicarPaginaButton/link pro editor, `AddLocalidadeForm`, `GerarPendentesButton`, link "Ver site" → `/servicos`) e `src/app/(authed)/programacao/seo/[id]/page.tsx` (form `salvarPaginaAction`: inputs titulo/meta + textarea `conteudo_md` + preview `<Markdown>`). Ambos `force-dynamic`. (Molde: `src/app/(authed)/programacao/blog/page.tsx` e `[id]/page.tsx`.)

- [ ] **Step 1: CMS principal** (matriz)
- [ ] **Step 2: Editor**
- [ ] **Step 3: Type-check + lint + build** — `npx tsc --noEmit && npx eslint "src/app/servicos" "src/app/(authed)/programacao/seo" src/components/seo && npm run build 2>&1 | tail -6` → build exit 0; rotas `/servicos`, `/servicos/[servico]`, `/servicos/[servico]/[localidade]`, `/programacao/seo`, `/programacao/seo/[id]` presentes
- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/programacao/seo/"
git commit -m "feat(seo): CMS (matriz serviço×localidade) e editor de página"
```

---

## Task 16: Link no menu da Programação

**Files:** Modify a página de índice da Programação.

- [ ] **Step 1:** `grep -rn "href=\"/programacao/blog\"" "src/app/(authed)/programacao/page.tsx"` pra achar o padrão de card/link e adicionar item "Serviços & SEO Local" → `/programacao/seo` (ícone lucide `Globe` ou `MapPin`), no mesmo formato.
- [ ] **Step 2: Build + commit**

```bash
npm run build 2>&1 | tail -3
git add "src/app/(authed)/programacao/page.tsx"
git commit -m "feat(seo): link 'Serviços & SEO Local' no menu da Programação"
```

---

## Task 17: PR + migration

- [ ] **Step 1:** `git push -u origin feat/seo-servicos` + `gh pr create`
- [ ] **Step 2:** esperar CI verde (`gh pr checks --watch`) → `gh pr merge --squash --delete-branch`
- [ ] **Step 3:** entregar o SQL da migration (Task 1) pra Yasmin rodar no Supabase SQL Editor; instruir: abrir `/programacao/seo` (faz o seed automático) → clicar "Gerar pendentes" repetidas vezes (lotes de 4, até cobrir as 28) → revisar rascunhos → publicar. As páginas só aparecem no domínio real quando virarmos o domínio (fase futura).

---

## Self-Review (feito)

- **Cobertura do spec:** tabelas (T1); seed + localidades gerenciáveis com seletor (T2/T6/T9-addLocalidade/T14); IA distinta por localidade (T8); Schema cidade vs estado (T4/T12); páginas públicas modernas (T10-13); CMS + editor (T14-15); sem-travessão (T5 reusa `semTravessao`); testes puros (T3/T4/T5); link no menu (T16). ✓
- **Placeholders:** nenhum código com "TBD". T10/T14/T15/T16 referenciam arquivos-molde reais (blog) em vez de repetir 200 linhas idênticas; a estrutura/nomes exigidos estão explícitos.
- **Consistência de tipos:** `Servico`/`Localidade`/`PaginaLista`/`PaginaPublica` (T7) usados em T8/T9/T12/T13/T15; `PaginaGerada`+`parsePaginaGerada` (T5) em T8; `jsonLdServicoLocal`/`JsonLdInput` (T4) em T12; `slugPagina`/`caminhoPagina` (T3) em T8/T12/T13. Actions (T9) casam com botões (T14).
- **Operação:** "Gerar pendentes" em lotes de 4 (limite por chamada) pra não estourar tempo/limite de função; repetir até cobrir as 28 páginas. Registrado em T14/T17.
- **Segurança:** JSON-LD injetado só com conteúdo próprio (nossa função) e escape de `<`, replicando o padrão já auditado do blog (T12).
