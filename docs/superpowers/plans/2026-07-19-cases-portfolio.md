# Cases / Portfólio (Fase 2) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou executing-plans. Steps com checkbox.

**Goal:** Páginas públicas de cases (resultados reais) com Schema Review, geridas na Programação; a Yide preenche os dados e a IA só pole o texto.

**Architecture:** Reaproveita o subsistema SEO (Fase 1). Tabela `seo_cases` + service-role, IA de "polimento" (Claude), páginas `force-dynamic` com JSON-LD, CMS. Funções puras testadas.

**Tech Stack:** Next.js 16, Supabase, Anthropic (`claude-haiku-4-5`), Tailwind, vitest.

**Referência (reusar):** `@/lib/supabase/service-role`, `@/lib/ai/client` (`getAnthropicClient`), `@/lib/blog/texto` (`semTravessao`), `@/lib/blog/slug` (`slugify`,`slugUnico`), `@/lib/blog/pipeline/gerar` (`extrairJson`), `@/lib/blog/form` (`parseBoolCampo`), `@/lib/auth/session` (`requireAuth`), `@/lib/gerador-leads/queries` (`getOrganizationId`), `@/lib/blog/acesso` (`podeGerenciarBlog`), `@/lib/seo/queries` (`getOrgPadrao`), `@/components/blog/Markdown`. Shell público: `src/app/servicos/layout.tsx` (copiar pra `src/app/cases/layout.tsx`). Molde CMS: `src/app/(authed)/programacao/seo/*` e `src/components/seo/*`.

**Segurança (JSON-LD):** injetar `<script type="application/ld+json">` com o MESMO padrão de `src/app/blog/[slug]/page.tsx` (serializa com `JSON.stringify(obj).replace(/</g, "\\u003c")` e injeta via a prop de innerHTML do React). Conteúdo 100% da nossa função `jsonLdCase`.

---

## Task 1: Migration

**Files:** Create `supabase/migrations/20260719050000_seo_cases.sql`

- [ ] **Step 1:**

```sql
-- Cases/portfólio: resultados reais de clientes (dados da Yide; IA só pole o texto).
create table if not exists public.seo_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null,
  cliente text not null,
  segmento text not null default '',
  localidade text not null default '',
  desafio text not null default '',
  solucao text not null default '',
  resultados jsonb not null default '[]',
  depoimento_texto text not null default '',
  depoimento_autor text not null default '',
  cover_image_url text,
  conteudo_md text not null default '',
  meta_title text,
  meta_description text,
  status text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create index if not exists seo_cases_pub_idx on public.seo_cases (organization_id, status, updated_at desc);
alter table public.seo_cases enable row level security;
drop policy if exists "seo_cases_select_publicado" on public.seo_cases;
create policy "seo_cases_select_publicado" on public.seo_cases for select using (status = 'publicado');
```

- [ ] **Step 2: Commit** — `git add ... && git commit -m "feat(cases): migration seo_cases"`

---

## Task 2: Slug (puro + teste)

**Files:** Create `src/lib/seo/case-slug.ts`, Test `tests/unit/seo-case-slug.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { baseSlugCase } from "@/lib/seo/case-slug";
describe("baseSlugCase", () => {
  it("usa cliente e segmento", () => {
    expect(baseSlugCase("Kumon", "Educação")).toBe("kumon-educacao");
  });
  it("só cliente quando sem segmento", () => {
    expect(baseSlugCase("Nazca", "")).toBe("nazca");
  });
});
```

- [ ] **Step 2: Falhar** — `npx vitest run tests/unit/seo-case-slug.test.ts --exclude '**/.claude/**'`

- [ ] **Step 3: Implementar**

```ts
import { slugify } from "@/lib/blog/slug";
export function baseSlugCase(cliente: string, segmento: string): string {
  const s = segmento.trim() ? `${cliente} ${segmento}` : cliente;
  return slugify(s);
}
```

- [ ] **Step 4: Passar** · **Step 5: Commit**

---

## Task 3: JSON-LD do case (puro + teste)

**Files:** Create `src/lib/seo/case-schema.ts`, Test `tests/unit/seo-case-schema.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { jsonLdCase } from "@/lib/seo/case-schema";
const base = { titulo: "Case Kumon", descricao: "Resultados", url: "https://yidedigital.com.br/cases/kumon" };
describe("jsonLdCase", () => {
  it("tem Article", () => {
    const g = jsonLdCase({ ...base, depoimentoTexto: "", depoimentoAutor: "" });
    expect(g["@graph"].some((n: { "@type": string }) => n["@type"] === "Article")).toBe(true);
  });
  it("inclui Review quando há depoimento", () => {
    const g = jsonLdCase({ ...base, depoimentoTexto: "Ótimo", depoimentoAutor: "João" });
    const r = g["@graph"].find((n: { "@type": string }) => n["@type"] === "Review");
    expect(r).toBeTruthy();
    expect(r.reviewBody).toBe("Ótimo");
    expect(r.author.name).toBe("João");
  });
  it("sem depoimento não inclui Review", () => {
    const g = jsonLdCase({ ...base, depoimentoTexto: "", depoimentoAutor: "" });
    expect(g["@graph"].some((n: { "@type": string }) => n["@type"] === "Review")).toBe(false);
  });
});
```

- [ ] **Step 2: Falhar**

- [ ] **Step 3: Implementar**

```ts
import { YIDE_NAP } from "./config";
export interface JsonLdCaseInput {
  titulo: string; descricao: string; url: string;
  depoimentoTexto: string; depoimentoAutor: string;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsonLdCase(i: JsonLdCaseInput): { "@context": string; "@graph": any[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graph: any[] = [
    { "@type": "Article", headline: i.titulo, description: i.descricao, url: i.url,
      author: { "@type": "Organization", name: YIDE_NAP.nome, url: YIDE_NAP.site },
      publisher: { "@type": "Organization", name: YIDE_NAP.nome, url: YIDE_NAP.site } },
  ];
  if (i.depoimentoTexto.trim()) {
    graph.push({ "@type": "Review", reviewBody: i.depoimentoTexto,
      author: { "@type": "Person", name: i.depoimentoAutor || "Cliente" },
      itemReviewed: { "@type": "Organization", name: YIDE_NAP.nome, url: YIDE_NAP.site } });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
```

- [ ] **Step 4: Passar** · **Step 5: Commit**

---

## Task 4: Parse do polimento (puro + teste)

**Files:** Create `src/lib/seo/case-parse.ts`, Test `tests/unit/seo-case-parse.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { parseCasePolido } from "@/lib/seo/case-parse";
describe("parseCasePolido", () => {
  it("sanitiza e valida", () => {
    const r = parseCasePolido({ conteudo_md: "texto — aqui", meta_title: "t — x", meta_description: "d" });
    expect(r).not.toBeNull();
    expect(r!.conteudo_md.includes("—")).toBe(false);
  });
  it("null sem conteúdo", () => {
    expect(parseCasePolido({ conteudo_md: "" })).toBeNull();
    expect(parseCasePolido(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Falhar**

- [ ] **Step 3: Implementar**

```ts
import { semTravessao } from "@/lib/blog/texto";
export interface CasePolido { conteudo_md: string; meta_title: string; meta_description: string }
export function parseCasePolido(raw: Record<string, unknown> | null): CasePolido | null {
  if (!raw || typeof raw.conteudo_md !== "string") return null;
  const conteudo_md = semTravessao(raw.conteudo_md.trim());
  if (!conteudo_md) return null;
  return {
    conteudo_md,
    meta_title: typeof raw.meta_title === "string" ? semTravessao(raw.meta_title.trim()).slice(0, 70) : "",
    meta_description: typeof raw.meta_description === "string" ? semTravessao(raw.meta_description.trim()).slice(0, 160) : "",
  };
}
```

- [ ] **Step 4: Passar** · **Step 5: Commit**

---

## Task 5: Queries (server)

**Files:** Create `src/lib/seo/case-queries.ts`

- [ ] **Step 1: Implementar**

```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface Resultado { rotulo: string; valor: string }
export interface CaseLista { id: string; slug: string; cliente: string; segmento: string; status: string; updated_at: string }
export interface CasePublico {
  slug: string; cliente: string; segmento: string; localidade: string;
  desafio: string; solucao: string; conteudo_md: string;
  resultados: Resultado[]; depoimento_texto: string; depoimento_autor: string;
  cover_image_url: string | null; meta_title: string | null; meta_description: string | null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }

export async function listCasesAdmin(orgId: string): Promise<CaseLista[]> {
  const { data } = await sb().from("seo_cases").select("id, slug, cliente, segmento, status, updated_at")
    .eq("organization_id", orgId).neq("status", "arquivado").order("updated_at", { ascending: false });
  return (data ?? []) as CaseLista[];
}
export async function getCaseAdmin(orgId: string, id: string) {
  const { data } = await sb().from("seo_cases").select("*").eq("organization_id", orgId).eq("id", id).maybeSingle();
  return data ?? null;
}
export async function listCasesPublicados(orgId: string): Promise<CasePublico[]> {
  const { data } = await sb().from("seo_cases")
    .select("slug, cliente, segmento, localidade, desafio, solucao, conteudo_md, resultados, depoimento_texto, depoimento_autor, cover_image_url, meta_title, meta_description")
    .eq("organization_id", orgId).eq("status", "publicado").order("updated_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((d) => ({ ...d, resultados: Array.isArray(d.resultados) ? d.resultados : [] }));
}
export async function getCasePublicado(orgId: string, slug: string): Promise<CasePublico | null> {
  const { data } = await sb().from("seo_cases")
    .select("slug, cliente, segmento, localidade, desafio, solucao, conteudo_md, resultados, depoimento_texto, depoimento_autor, cover_image_url, meta_title, meta_description")
    .eq("organization_id", orgId).eq("slug", slug).eq("status", "publicado").maybeSingle();
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  return { ...d, resultados: Array.isArray(d.resultados) ? d.resultados : [] };
}
```

- [ ] **Step 2: tsc** · **Step 3: Commit**

---

## Task 6: Pipeline de polimento (IA)

**Files:** Create `src/lib/seo/case-pipeline.ts`

- [ ] **Step 1: Implementar**

```ts
import { getAnthropicClient } from "@/lib/ai/client";
import { extrairJson } from "@/lib/blog/pipeline/gerar";
import { parseCasePolido, type CasePolido } from "./case-parse";
import type { Resultado } from "./case-queries";

const CASE_MODEL = "claude-haiku-4-5";

export interface DadosCase {
  cliente: string; segmento: string; localidade: string;
  desafio: string; solucao: string; resultados: Resultado[];
  depoimento_texto: string; depoimento_autor: string;
}

export function montarPromptCase(d: DadosCase): string {
  const res = d.resultados.map((r) => `- ${r.rotulo}: ${r.valor}`).join("\n") || "(sem números informados)";
  return `Você é redator(a) da Yide Digital. Escreva a narrativa de um CASE de sucesso em pt-br, a partir dos DADOS REAIS abaixo. Regras rígidas:
- Use SOMENTE os números fornecidos. NUNCA invente métricas, percentuais ou resultados que não estejam na lista.
- Estruture: contexto do cliente, o desafio, o que a Yide fez, e os resultados (citando os números dados).
- Tom profissional, verdadeiro, sem exagero. NUNCA use travessão nem meia-risca.

DADOS:
Cliente: ${d.cliente}
Segmento: ${d.segmento}
Localidade: ${d.localidade}
Desafio: ${d.desafio}
O que a Yide fez: ${d.solucao}
Resultados (números reais):
${res}
Depoimento: ${d.depoimento_texto ? `"${d.depoimento_texto}" — ${d.depoimento_autor}` : "(nenhum)"}

Responda SOMENTE com JSON válido:
{"conteudo_md": "narrativa em markdown com ## subtítulos", "meta_title": "SEO até 60 chars", "meta_description": "SEO até 155 chars"}`;
}

export async function polirCase(d: DadosCase): Promise<CasePolido | null> {
  const client = getAnthropicClient();
  if (!client) { console.error("[cases] Anthropic não configurado"); return null; }
  try {
    const res = await client.messages.create({ model: CASE_MODEL, max_tokens: 2500,
      messages: [{ role: "user", content: montarPromptCase(d) }] });
    const txt = res.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    return parseCasePolido(extrairJson(txt));
  } catch (e) { console.error("[cases] polirCase:", e); return null; }
}
```

- [ ] **Step 2: tsc** · **Step 3: Commit**

---

## Task 7: Server actions

**Files:** Create `src/lib/seo/case-actions.ts` (`"use server"`)

Actions: `criarCaseAction()` (cria rascunho vazio, retorna id), `salvarCaseAction(formData)` (salva campos + resultados jsonb), `polirCaseAction(formData)` (chama `polirCase`, grava `conteudo_md`/meta), `publicarCaseAction(formData)` (usa `parseBoolCampo`).

- [ ] **Step 1: Implementar** (gate = `requireAuth`+`podeGerenciarBlog`+`getOrganizationId`; `revalidatePath("/programacao/seo/cases")` e `"/cases"`; slug via `baseSlugCase`+`slugUnico` contra os slugs existentes)

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { parseBoolCampo } from "@/lib/blog/form";
import { slugUnico } from "@/lib/blog/slug";
import { baseSlugCase } from "./case-slug";
import { listCasesAdmin, type Resultado } from "./case-queries";
import { polirCase } from "./case-pipeline";

interface Err { error: string } type Result = { success: true } | Err;
const uuidLike = z.string().regex(/^[0-9a-fA-F-]{36}$/, "ID inválido");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }
async function gate(): Promise<{ orgId: string } | Err> {
  const a = await requireAuth();
  if (!podeGerenciarBlog(a.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(a.id);
  if (!orgId) return { error: "Sem organização" };
  return { orgId };
}
function revalida() { revalidatePath("/programacao/seo/cases"); revalidatePath("/cases"); }
function parseResultados(raw: FormDataEntryValue | null): Resultado[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((r) => r && typeof r.rotulo === "string" && typeof r.valor === "string")
      .map((r) => ({ rotulo: String(r.rotulo).trim(), valor: String(r.valor).trim() })).filter((r) => r.rotulo || r.valor);
  } catch { return []; }
}

export async function criarCaseAction(): Promise<{ success: true; id: string } | Err> {
  const g = await gate(); if ("error" in g) return g;
  const existentes = await listCasesAdmin(g.orgId);
  const slug = slugUnico("novo-case", new Set(existentes.map((c) => c.slug)));
  const { data, error } = await sb().from("seo_cases").insert({ organization_id: g.orgId, slug, cliente: "Novo case" }).select("id").maybeSingle();
  if (error) return { error: error.message };
  revalida();
  return { success: true, id: (data as { id: string }).id };
}

export async function salvarCaseAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const id = String(formData.get("id") ?? "");
  if (!uuidLike.safeParse(id).success) return { error: "ID inválido" };
  const cliente = String(formData.get("cliente") ?? "").trim();
  if (!cliente) return { error: "Informe o cliente" };
  const patch = {
    cliente, segmento: String(formData.get("segmento") ?? "").trim(),
    localidade: String(formData.get("localidade") ?? "").trim(),
    desafio: String(formData.get("desafio") ?? ""), solucao: String(formData.get("solucao") ?? ""),
    resultados: parseResultados(formData.get("resultados")),
    depoimento_texto: String(formData.get("depoimento_texto") ?? "").trim(),
    depoimento_autor: String(formData.get("depoimento_autor") ?? "").trim(),
    cover_image_url: String(formData.get("cover_image_url") ?? "").trim() || null,
    conteudo_md: String(formData.get("conteudo_md") ?? ""),
    meta_title: String(formData.get("meta_title") ?? "").trim(),
    meta_description: String(formData.get("meta_description") ?? "").trim(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb().from("seo_cases").update(patch).eq("id", id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Case não encontrado" };
  revalida();
  return { success: true };
}

export async function polirCaseAction(formData: FormData): Promise<{ success: true; conteudo_md: string; meta_title: string; meta_description: string } | Err> {
  const g = await gate(); if ("error" in g) return g;
  const dados = {
    cliente: String(formData.get("cliente") ?? ""), segmento: String(formData.get("segmento") ?? ""),
    localidade: String(formData.get("localidade") ?? ""), desafio: String(formData.get("desafio") ?? ""),
    solucao: String(formData.get("solucao") ?? ""), resultados: parseResultados(formData.get("resultados")),
    depoimento_texto: String(formData.get("depoimento_texto") ?? ""), depoimento_autor: String(formData.get("depoimento_autor") ?? ""),
  };
  const r = await polirCase(dados);
  if (!r) return { error: "Não consegui polir agora. Tente de novo." };
  return { success: true, ...r };
}

export async function publicarCaseAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const parsed = z.object({ id: uuidLike, publicar: z.boolean() }).safeParse({ id: formData.get("id"), publicar: parseBoolCampo(formData.get("publicar")) });
  if (!parsed.success) return { error: "Dados inválidos" };
  const { data, error } = await sb().from("seo_cases")
    .update({ status: parsed.data.publicar ? "publicado" : "rascunho", updated_at: new Date().toISOString() })
    .eq("id", parsed.data.id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Case não encontrado" };
  revalida();
  return { success: true };
}
```

- [ ] **Step 2: tsc + eslint src/lib/seo** · **Step 3: Commit**

---

## Task 8: Shell público /cases

**Files:** Create `src/app/cases/layout.tsx` — copiar `src/app/servicos/layout.tsx` trocando o link ativo (nav pode manter Serviços/Blog; adicionar "Cases"). Mesmo masthead preto + Sora.

- [ ] **Step 1: Copiar e ajustar nav** (adicionar `<Link href="/cases">Cases</Link>` na nav) · **Step 2: Commit**

---

## Task 9: Página pública /cases e /cases/[slug]

**Files:** Create `src/app/cases/page.tsx`, `src/app/cases/[slug]/page.tsx`

- [ ] **Step 1: Índice** `/cases` (grid de cards; usa `getOrgPadrao`+`listCasesPublicados`; card mostra cliente, segmento, 1º resultado em destaque, capa se houver). `force-dynamic`. Design: cards brancos com sombra/hover, headline Sora.

```tsx
import Link from "next/link";
import type { Metadata } from "next";
import { getOrgPadrao } from "@/lib/seo/queries";
import { listCasesPublicados } from "@/lib/seo/case-queries";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cases · Yide Digital", description: "Resultados reais de clientes da Yide Digital.", alternates: { canonical: "/cases" } };
export default async function CasesIndex() {
  const orgId = await getOrgPadrao();
  const cases = orgId ? await listCasesPublicados(orgId) : [];
  return (
    <div className="space-y-10">
      <header><h1 className="text-4xl font-bold tracking-tight [font-family:var(--font-display)] sm:text-5xl">Cases</h1>
        <p className="mt-3 max-w-xl text-neutral-600">Resultados reais de quem confiou na Yide Digital.</p></header>
      {cases.length === 0 ? <p className="text-neutral-500">Em breve.</p> : (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <Link key={c.slug} href={`/cases/${c.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
            {c.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.cover_image_url} alt="" className="aspect-[16/10] w-full object-cover" />
            ) : <div className="aspect-[16/10] w-full bg-gradient-to-br from-teal-100 to-neutral-100" />}
            <div className="flex flex-1 flex-col p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">{c.segmento || "Case"}</span>
              <h2 className="mt-1 text-lg font-bold tracking-tight [font-family:var(--font-display)] group-hover:text-teal-700">{c.cliente}</h2>
              {c.resultados[0] && <p className="mt-2 text-sm text-neutral-600"><span className="font-bold text-neutral-900">{c.resultados[0].valor}</span> {c.resultados[0].rotulo}</p>}
            </div>
          </Link>
        ))}
      </div>)}
    </div>
  );
}
```

- [ ] **Step 2: Case** `/cases/[slug]` (hero cliente/segmento/localidade; narrativa `Markdown light`; grid de cards com `resultados`; bloco de depoimento; CTA; JSON-LD via `jsonLdCase` injetado no padrão do blog). `force-dynamic`. `generateMetadata` com meta_title/description e canonical `/cases/[slug]`.

Estrutura (a injeção do `<script application/ld+json>` copiar de `src/app/blog/[slug]/page.tsx`):

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getOrgPadrao } from "@/lib/seo/queries";
import { getCasePublicado } from "@/lib/seo/case-queries";
import { jsonLdCase } from "@/lib/seo/case-schema";
import { Markdown } from "@/components/blog/Markdown";
export const dynamic = "force-dynamic";
const SITE = "https://yidedigital.com.br";
async function carregar(slug: string) { const o = await getOrgPadrao(); return o ? getCasePublicado(o, slug) : null; }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const c = await carregar(slug);
  if (!c) return { title: "Case não encontrado · Yide Digital" };
  const title = c.meta_title || `${c.cliente} · Case Yide Digital`;
  return { title, description: c.meta_description || undefined, alternates: { canonical: `/cases/${c.slug}` }, openGraph: { title, type: "article", images: c.cover_image_url ? [c.cover_image_url] : undefined } };
}
export default async function CasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const c = await carregar(slug);
  if (!c) notFound();
  const url = `${SITE}/cases/${c.slug}`;
  const jsonld = JSON.stringify(jsonLdCase({ titulo: c.meta_title || `${c.cliente} · Case`, descricao: c.meta_description || c.desafio, url, depoimentoTexto: c.depoimento_texto, depoimentoAutor: c.depoimento_autor })).replace(/</g, "\\u003c");
  return (
    <article>
      {/* injetar <script type="application/ld+json"> com {jsonld}, IGUAL ao post do blog */}
      <Link href="/cases" className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-neutral-900"><ArrowLeft className="h-4 w-4" /> Cases</Link>
      <header className="mt-6">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-600">{c.segmento}{c.localidade ? ` · ${c.localidade}` : ""}</span>
        <h1 className="mt-2 text-4xl font-bold leading-[1.05] tracking-tight [font-family:var(--font-display)] sm:text-5xl">{c.cliente}</h1>
      </header>
      {c.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.cover_image_url} alt="" className="mt-7 aspect-[16/9] w-full rounded-2xl border border-neutral-200 object-cover" />)}
      {c.resultados.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {c.resultados.map((r, i) => (
            <div key={i} className="rounded-2xl border border-teal-100 bg-teal-50/40 p-5 text-center">
              <p className="text-3xl font-bold text-teal-700 [font-family:var(--font-display)]">{r.valor}</p>
              <p className="mt-1 text-sm text-neutral-600">{r.rotulo}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mx-auto mt-10 max-w-2xl"><Markdown light>{c.conteudo_md}</Markdown></div>
      {c.depoimento_texto && (
        <blockquote className="mx-auto mt-10 max-w-2xl rounded-2xl border-l-4 border-teal-500 bg-white p-6">
          <p className="text-lg italic text-neutral-800">&ldquo;{c.depoimento_texto}&rdquo;</p>
          {c.depoimento_autor && <footer className="mt-2 text-sm font-semibold text-neutral-500">{c.depoimento_autor}</footer>}
        </blockquote>
      )}
      <div className="mx-auto mt-12 max-w-2xl rounded-2xl border border-neutral-200 bg-white p-7 text-center">
        <p className="text-xl font-bold [font-family:var(--font-display)]">Quer resultados assim?</p>
        <a href="https://wa.me/5565981447380" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">Falar com a Yide</a>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Adicionar injeção JSON-LD** (copiar linha do `<script application/ld+json>` de `src/app/blog/[slug]/page.tsx`) · **Step 4: Commit**

---

## Task 10: CMS — editor de case (client) + botões

**Files:** Create `src/components/seo/CaseEditor.tsx` (client), `src/components/seo/PublicarCaseButton.tsx`, `src/components/seo/NovoCaseButton.tsx`

- [ ] **Step 1: `NovoCaseButton`** — chama `criarCaseAction`, redireciona pro editor (`useRouter().push('/programacao/seo/cases/'+id)`).
- [ ] **Step 2: `PublicarCaseButton`** — molde de `PublicarPaginaButton`, chama `publicarCaseAction`.
- [ ] **Step 3: `CaseEditor`** (client) — estado dos campos + lista de `resultados` (linhas rótulo/valor, add/remove), botões "Polir com IA" (chama `polirCaseAction`, preenche `conteudo_md`/meta via estado) e "Salvar" (monta FormData com `resultados` como JSON.stringify, chama `salvarCaseAction`). Preview `<Markdown>`. Design limpo do app.

Assinatura: `CaseEditor({ inicial }: { inicial: {...campos do case...} })`.

- [ ] **Step 4: Commit**

---

## Task 11: CMS — rotas de cases

**Files:** Create `src/app/(authed)/programacao/seo/cases/page.tsx` (lista), `src/app/(authed)/programacao/seo/cases/[id]/page.tsx` (editor). Ambos `force-dynamic`, gate `podeGerenciarBlog`.

- [ ] **Step 1: Lista** — `listCasesAdmin`, tabela (cliente, segmento, status, editar, `PublicarCaseButton`), `NovoCaseButton`, link "Ver cases" → `/cases`, voltar pra `/programacao/seo`.
- [ ] **Step 2: Editor page** — `getCaseAdmin(orgId, id)`, passa `inicial` pro `<CaseEditor>`.
- [ ] **Step 3:** adicionar link "Cases" no topo de `/programacao/seo/page.tsx` (junto de "Ver site").
- [ ] **Step 4: tsc + eslint + `npm run build`** (rotas `/cases`, `/cases/[slug]`, `/programacao/seo/cases`, `/programacao/seo/cases/[id]`). Reverter `public/sw.js` se mudar.
- [ ] **Step 5: Commit**

---

## Task 12: PR + migration

- [ ] `git push -u origin feat/seo-cases` → `gh pr create` → CI verde → `gh pr merge --squash --delete-branch`.
- [ ] Entregar SQL da migration (Task 1) e instruir: abrir Programação → Serviços & SEO Local → Cases → "Novo case" → preencher → "Polir com IA" → revisar → publicar.

---

## Self-Review (feito)
- **Cobertura:** tabela (T1); slug/JSON-LD-Review/parse puros+testes (T2-4); queries (T5); polir IA sem inventar número (T6); actions incl. `parseBoolCampo` (T7); shell + páginas públicas com stats/depoimento/Review (T8-9); CMS editor com resultados repetíveis + polir + publicar (T10-11); migration manual (T12). ✓
- **Placeholders:** UI (T8/T10/T11) referencia moldes reais (Fase 1/blog) com estrutura/nomes explícitos; sem código "TBD".
- **Consistência:** `Resultado`/`CaseLista`/`CasePublico` (T5) usados em T6/T7/T9/T10; `CasePolido`/`parseCasePolido` (T4) em T6; `jsonLdCase`/`JsonLdCaseInput` (T3) em T9; `baseSlugCase` (T2) em T7. `resultados` trafega como JSON string no form e vira jsonb via `parseResultados`.
- **Segurança:** JSON-LD só conteúdo próprio + escape de `<` (padrão blog).
