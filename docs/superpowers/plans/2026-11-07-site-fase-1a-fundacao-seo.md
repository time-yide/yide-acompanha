# Site yidedigital.com.br · Fase 1a (Fundação SEO) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar a base de SEO/GEO do site pronta para a troca de domínio: dados da empresa corretos e completos, dados estruturados ricos, os 9 serviços e as cidades de MT no seed, redirecionamentos para o domínio principal (atrás de uma flag), robots liberando os robôs de IA e corrigindo as áreas internas, llms.txt completo e home no sitemap.

**Architecture:** Mudanças em funções puras de `src/lib/seo/*` e numa função pura nova de redirecionamento usada pelo `src/middleware.ts`. Nada visual. Os redirecionamentos só ligam com `SITE_APEX_ATIVO=1`, para não mandar ninguém ao site antigo antes da troca de domínio (fase 1b).

**Tech Stack:** Next.js 16, TypeScript, Vitest.

Spec: `docs/superpowers/specs/2026-11-07-site-yidedigital-seo-geo-design.md`

---

### Task 1: Dados da empresa (NAP) completos

**Files:**
- Modify: `src/lib/seo/config.ts`
- Test: `tests/unit/seo-identidade.test.ts`

- [ ] **Step 1: Atualizar o teste**

Em `tests/unit/seo-identidade.test.ts`, trocar o primeiro `describe` por:

```ts
describe("jsonLdOrganizacao", () => {
  it("traz nome, endereço completo, telefone e perfis", () => {
    const ld = jsonLdOrganizacao();
    expect(ld.name).toBe("Yide Digital");
    expect(ld.telephone).toBe("+55 65 99306-3452");
    expect(ld.address.streetAddress).toBe("R. Martinica, 280 - Jardim das Américas");
    expect(ld.address.addressLocality).toBe("Cuiabá");
    expect(ld.address.postalCode).toBe("78060-644");
    expect(ld.sameAs).toContain("https://www.instagram.com/yide.digital/");
    expect(ld.sameAs).toContain("https://maps.google.com/?cid=14243144777750195365");
    expect(ld.knowsAbout.length).toBeGreaterThan(0);
  });
  it("atende 24h, todos os dias", () => {
    const ld = jsonLdOrganizacao();
    expect(ld.openingHoursSpecification.opens).toBe("00:00");
    expect(ld.openingHoursSpecification.closes).toBe("23:59");
    expect(ld.openingHoursSpecification.dayOfWeek).toHaveLength(7);
  });
  it("área atendida: Cuiabá, Várzea Grande, Mato Grosso e Brasil", () => {
    const nomes = jsonLdOrganizacao().areaServed.map((a: { name: string }) => a.name);
    expect(nomes).toEqual(["Cuiabá", "Várzea Grande", "Mato Grosso", "Brasil"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/seo-identidade.test.ts`
Expected: FAIL (telefone com 8 dígitos, sem streetAddress).

- [ ] **Step 3: Atualizar `YIDE_NAP` e `YIDE_PERFIS` em `src/lib/seo/config.ts`**

```ts
export const YIDE_PERFIS = [
  "https://www.instagram.com/yide.digital/",
  // Perfil da Empresa no Google (YIDE DIGITAL)
  "https://maps.google.com/?cid=14243144777750195365",
];

export const YIDE_NAP = {
  nome: "Yide Digital", telefone: "+55 65 99306-3452", email: "yidedigital@gmail.com",
  rua: "R. Martinica, 280 - Jardim das Américas", cep: "78060-644",
  cidade: "Cuiabá", uf: "MT", pais: "BR", site: "https://yidedigital.com.br",
  geo: { lat: -15.6059688, lng: -56.0671207 },
};
```

- [ ] **Step 4: Atualizar `jsonLdOrganizacao` em `src/lib/seo/schema.ts`**

Adicionar, acima de `jsonLdServicoLocal`:

```ts
const DIAS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function enderecoYide() {
  return { "@type": "PostalAddress", streetAddress: YIDE_NAP.rua, postalCode: YIDE_NAP.cep,
    addressLocality: YIDE_NAP.cidade, addressRegion: YIDE_NAP.uf, addressCountry: YIDE_NAP.pais };
}
```

E substituir `jsonLdOrganizacao` por:

```ts
export function jsonLdOrganizacao() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${YIDE_NAP.site}/#organizacao`,
    name: YIDE_NAP.nome,
    url: YIDE_NAP.site,
    logo: `${YIDE_NAP.site}/brand/logo-yide.png`,
    image: `${YIDE_NAP.site}/brand/logo-yide.png`,
    telephone: YIDE_NAP.telefone,
    email: YIDE_NAP.email,
    address: enderecoYide(),
    geo: { "@type": "GeoCoordinates", latitude: YIDE_NAP.geo.lat, longitude: YIDE_NAP.geo.lng },
    openingHoursSpecification: { "@type": "OpeningHoursSpecification", dayOfWeek: DIAS, opens: "00:00", closes: "23:59" },
    areaServed: [
      { "@type": "City", name: "Cuiabá" },
      { "@type": "City", name: "Várzea Grande" },
      { "@type": "State", name: "Mato Grosso" },
      { "@type": "Country", name: "Brasil" },
    ],
    knowsAbout: SEED_SERVICOS.map((s) => s.nome),
    sameAs: YIDE_PERFIS,
  };
}
```

Em `jsonLdServicoLocal`, trocar o `address` do nó `ProfessionalService` por `address: enderecoYide(),` e acrescentar `"@id": \`${YIDE_NAP.site}/#organizacao\``.

- [ ] **Step 5: Rodar os testes de SEO**

Run: `npx vitest run tests/unit/seo-identidade.test.ts tests/unit/seo-schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/seo/config.ts src/lib/seo/schema.ts tests/unit/seo-identidade.test.ts
git commit -m "feat(seo): NAP completo, 24h e área atendida no JSON-LD da Yide"
```

### Task 2: 9 serviços e cidades de MT no seed

**Files:**
- Modify: `src/lib/seo/config.ts`
- Test: `tests/unit/seo-config.test.ts` (novo)

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from "vitest";
import { SEED_SERVICOS, SEED_LOCALIDADES } from "@/lib/seo/config";

describe("seed de SEO", () => {
  it("tem os 9 serviços com slugs únicos, mantendo os 5 antigos", () => {
    const slugs = SEED_SERVICOS.map((s) => s.slug);
    expect(slugs).toEqual([
      "gestao-de-trafego", "crm-ia-dados", "audiovisual", "redes-sociais", "criacao-de-sites",
      "ecommerce", "marketplaces", "assessoria-de-marketing", "seo-google",
    ]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("ordem segue a lista", () => {
    expect(SEED_SERVICOS.map((s) => s.ordem)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("inclui as cidades de MT do nível 2", () => {
    const slugs = SEED_LOCALIDADES.map((l) => l.slug);
    for (const s of ["rondonopolis", "sinop", "sorriso", "tangara-da-serra", "lucas-do-rio-verde", "primavera-do-leste"]) {
      expect(slugs).toContain(s);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/seo-config.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

Substituir `SEED_SERVICOS` por:

```ts
export const SEED_SERVICOS: SeedServico[] = [
  { nome: "Gestão de Tráfego Pago", slug: "gestao-de-trafego", ordem: 1,
    descricao_base: "Anúncios no Google Ads, Meta Ads e Instagram para gerar leads e vendas, com acompanhamento de custo por venda." },
  { nome: "CRM com IA (Lyide)", slug: "crm-ia-dados", ordem: 2,
    descricao_base: "CRM com IA que responde seus leads no WhatsApp em segundos, organiza o funil e mostra qual anúncio trouxe cada venda." },
  { nome: "Gravação e Audiovisual", slug: "audiovisual", ordem: 3,
    descricao_base: "Produção de vídeos, reels e gravações para redes sociais e anúncios, do roteiro à edição." },
  { nome: "Gestão de Redes Sociais", slug: "redes-sociais", ordem: 4,
    descricao_base: "Conteúdo e gestão de perfis no Instagram e outras redes, com calendário editorial e foco em vendas." },
  { nome: "Criação de Sites e Landing Pages", slug: "criacao-de-sites", ordem: 5,
    descricao_base: "Sites, landing pages e sistemas rápidos, otimizados para Google e para conversão." },
  { nome: "E-commerce e Loja Virtual", slug: "ecommerce", ordem: 6,
    descricao_base: "Criação e gestão de loja virtual, do catálogo ao checkout, com tráfego e recuperação de vendas." },
  { nome: "Marketplaces e Mercado Livre", slug: "marketplaces", ordem: 7,
    descricao_base: "Venda no Mercado Livre, Shopee e Amazon: cadastro, anúncios, reputação e Mercado Ads." },
  { nome: "Assessoria de Marketing e Vendas", slug: "assessoria-de-marketing", ordem: 8,
    descricao_base: "Planejamento e acompanhamento de marketing e vendas para empresas que querem crescer com método." },
  { nome: "SEO e Perfil da Empresa no Google", slug: "seo-google", ordem: 9,
    descricao_base: "Posicionamento no Google e nas respostas de IA: SEO, Perfil da Empresa, avaliações e conteúdo." },
];
```

Em `SEED_LOCALIDADES`, acrescentar depois de Várzea Grande:

```ts
  { nome: "Rondonópolis", tipo: "cidade", uf: "MT", slug: "rondonopolis" },
  { nome: "Sinop", tipo: "cidade", uf: "MT", slug: "sinop" },
  { nome: "Sorriso", tipo: "cidade", uf: "MT", slug: "sorriso" },
  { nome: "Tangará da Serra", tipo: "cidade", uf: "MT", slug: "tangara-da-serra" },
  { nome: "Lucas do Rio Verde", tipo: "cidade", uf: "MT", slug: "lucas-do-rio-verde" },
  { nome: "Primavera do Leste", tipo: "cidade", uf: "MT", slug: "primavera-do-leste" },
```

Nota: `garantirSeedSeo` usa `ignoreDuplicates`, então serviços que já existem no banco (os 5 antigos) mantêm nome e ordem do banco; os 4 novos entram. A ordem e os nomes novos dos antigos são ajustados no CMS ou num passo de dados da fase 1b.

- [ ] **Step 4: Rodar** `npx vitest run tests/unit/seo-config.test.ts tests/unit/seo-identidade.test.ts` → PASS.

- [ ] **Step 5: Commit** `git commit -am "feat(seo): 9 serviços e cidades de MT no seed"` (incluindo o teste novo com `git add`).

### Task 3: Redirecionamentos para o domínio principal

**Files:**
- Create: `src/lib/site/dominio.ts`
- Modify: `src/middleware.ts`
- Test: `tests/unit/site-dominio.test.ts`

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from "vitest";
import { destinoCanonico } from "@/lib/site/dominio";

const ativo = true;

describe("destinoCanonico", () => {
  it("não faz nada com a flag desligada", () => {
    expect(destinoCanonico("blog.yidedigital.com.br", "/blog/x", "", false)).toBeNull();
  });
  it("blog. vai para o apex mantendo o caminho", () => {
    expect(destinoCanonico("blog.yidedigital.com.br", "/blog/x", "?a=1", ativo)).toBe("https://yidedigital.com.br/blog/x?a=1");
    expect(destinoCanonico("blog.yidedigital.com.br", "/servicos", "", ativo)).toBe("https://yidedigital.com.br/servicos");
  });
  it("raiz do blog. vai para /blog", () => {
    expect(destinoCanonico("blog.yidedigital.com.br", "/", "", ativo)).toBe("https://yidedigital.com.br/blog");
  });
  it("conteúdo público no host do sistema vai para o apex", () => {
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/blog/x", "", ativo)).toBe("https://yidedigital.com.br/blog/x");
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/cases", "", ativo)).toBe("https://yidedigital.com.br/cases");
  });
  it("/site vira a home do apex", () => {
    expect(destinoCanonico("yidedigital.com.br", "/site", "", ativo)).toBe("https://yidedigital.com.br/");
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/site", "", ativo)).toBe("https://yidedigital.com.br/");
  });
  it("não mexe no sistema nem no próprio apex", () => {
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/clientes", "", ativo)).toBeNull();
    expect(destinoCanonico("sistemaacompanha.yidedigital.com.br", "/blogueiros", "", ativo)).toBeNull();
    expect(destinoCanonico("yidedigital.com.br", "/blog/x", "", ativo)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar** → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/lib/site/dominio.ts`**

```ts
// Domínio principal do site público. Antes da troca de domínio na Vercel, a flag
// SITE_APEX_ATIVO fica desligada e nada é redirecionado (o apex ainda é o site antigo).
export const APEX = "yidedigital.com.br";
const BLOG_HOST = "blog.yidedigital.com.br";
const SISTEMA_HOST = "sistemaacompanha.yidedigital.com.br";
const PREFIXOS_PUBLICOS = ["/blog", "/servicos", "/cases"];

function ehPrefixo(pathname: string, p: string): boolean {
  return pathname === p || pathname.startsWith(`${p}/`);
}

/** URL de destino (308) para levar conteúdo público ao domínio principal, ou null. */
export function destinoCanonico(host: string, pathname: string, search: string, ativo: boolean): string | null {
  if (!ativo) return null;
  const apex = (path: string) => `https://${APEX}${path}${search}`;
  if (pathname === "/site" && (host === APEX || host === SISTEMA_HOST || host === BLOG_HOST)) return apex("/");
  if (host === BLOG_HOST) return apex(pathname === "/" ? "/blog" : pathname);
  if (host === SISTEMA_HOST && PREFIXOS_PUBLICOS.some((p) => ehPrefixo(pathname, p))) return apex(pathname);
  return null;
}

export function apexAtivo(): boolean {
  return process.env.SITE_APEX_ATIVO === "1";
}
```

- [ ] **Step 4: Usar no middleware**

Em `src/middleware.ts`, importar `import { destinoCanonico, apexAtivo } from "@/lib/site/dominio";` e, logo depois do bloco `LEGACY_HOST` e do `const { pathname } = request.nextUrl;`, inserir:

```ts
  const destino = destinoCanonico(host, pathname, request.nextUrl.search, apexAtivo());
  if (destino) return NextResponse.redirect(destino, { status: 308 });
```

O bloco existente `if (host === BLOG_HOST && pathname === "/")` continua (vale com a flag desligada).

- [ ] **Step 5: Rodar** `npx vitest run tests/unit/site-dominio.test.ts` → PASS.

- [ ] **Step 6: Commit** `git add src/lib/site/dominio.ts src/middleware.ts tests/unit/site-dominio.test.ts && git commit -m "feat(site): redirecionar conteúdo público para yidedigital.com.br (atrás de flag)"`

### Task 4: robots com robôs de IA e áreas internas corrigidas

**Files:**
- Create: `src/lib/site/robots.ts`
- Modify: `src/app/robots.ts`
- Test: `tests/unit/site-robots.test.ts`

Bug atual: em `src/app/robots.ts` o comentário da linha `"/site$", "/programacao", // ...` engole `"/clientes", "/cliente", "/login", "/api", "/auth"`, que deixam de ser bloqueados.

- [ ] **Step 1: Teste**

```ts
import { describe, it, expect } from "vitest";
import { regrasRobots } from "@/lib/site/robots";

describe("regrasRobots", () => {
  it("host do sistema bloqueia tudo", () => {
    const r = regrasRobots("sistemaacompanha.yidedigital.com.br", "https://yidedigital.com.br");
    expect(r.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    expect(r.sitemap).toBeUndefined();
  });
  it("host público bloqueia as áreas internas", () => {
    const r = regrasRobots("yidedigital.com.br", "https://yidedigital.com.br");
    const geral = r.rules.find((x) => x.userAgent === "*")!;
    for (const p of ["/clientes", "/cliente", "/login", "/api", "/auth", "/programacao"]) {
      expect(geral.disallow).toContain(p);
    }
    expect(r.sitemap).toBe("https://yidedigital.com.br/sitemap.xml");
  });
  it("libera explicitamente os robôs de busca e de IA", () => {
    const r = regrasRobots("yidedigital.com.br", "https://yidedigital.com.br");
    const agentes = r.rules.map((x) => x.userAgent);
    for (const a of ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Google-Extended"]) {
      expect(agentes).toContain(a);
    }
  });
});
```

- [ ] **Step 2: Rodar** → FAIL.

- [ ] **Step 3: Implementar `src/lib/site/robots.ts`**

```ts
import type { MetadataRoute } from "next";

export const MARKETING_HOSTS = new Set(["blog.yidedigital.com.br", "yidedigital.com.br", "www.yidedigital.com.br"]);

// "/site$": sem o "$", "/site" bloquearia também o /sitemap.xml.
const INTERNO = [
  "/site$", "/programacao", "/clientes", "/cliente", "/login", "/api", "/auth",
  "/aprovacao-design", "/aprovacao-post", "/definir-senha", "/recuperar-senha",
  "/relatorio-redes-sociais-pdf", "/relatorio-trafego-pdf", "/apresenta-yide-pdf",
];

// Robôs de busca e de IA liberados de forma explícita (o ChatGPT busca via Bing e OAI-SearchBot).
const ROBOS_BUSCA_E_IA = [
  "Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User",
  "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Google-Extended", "Applebot-Extended",
];

export function regrasRobots(host: string, siteUrl: string): MetadataRoute.Robots & { rules: { userAgent: string; allow?: string; disallow: string | string[] }[] } {
  if (!MARKETING_HOSTS.has(host)) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: INTERNO },
      ...ROBOS_BUSCA_E_IA.map((userAgent) => ({ userAgent, allow: "/", disallow: INTERNO })),
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

- [ ] **Step 4: `src/app/robots.ts` passa a usar a função**

```ts
import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SITE_URL } from "@/lib/blog/config";
import { regrasRobots } from "@/lib/site/robots";

// Robots ciente do host: domínio público libera o conteúdo e bloqueia as áreas
// internas; o subdomínio do sistema fica fora do índice.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host") ?? "";
  return regrasRobots(host, SITE_URL);
}
```

- [ ] **Step 5: Rodar** `npx vitest run tests/unit/site-robots.test.ts` → PASS.

- [ ] **Step 6: Commit** `git add src/lib/site/robots.ts src/app/robots.ts tests/unit/site-robots.test.ts && git commit -m "fix(seo): robots bloqueia áreas internas e libera robôs de IA"`

### Task 5: llms.txt completo

**Files:**
- Modify: `src/lib/seo/llms.ts`, `src/app/llms.txt/route.ts`
- Test: `tests/unit/seo-identidade.test.ts`

- [ ] **Step 1: Teste** — no `describe("montarLlmsTxt")`, passar `cases: [{ cliente: "Kai Poke", segmento: "Restaurante", slug: "kai" }]` no input e acrescentar:

```ts
  it("traz endereço, horário, áreas atendidas e cases", () => {
    expect(txt).toContain("Endereço: R. Martinica, 280 - Jardim das Américas, Cuiabá - MT, 78060-644");
    expect(txt).toContain("WhatsApp: +55 65 99306-3452");
    expect(txt).toContain("Atendimento: 24 horas, todos os dias");
    expect(txt).toContain("Atende: Cuiabá, Várzea Grande, Mato Grosso e todo o Brasil");
    expect(txt).toContain("- [Kai Poke (Restaurante)](https://blog.exemplo.com.br/cases/kai)");
  });
```

- [ ] **Step 2: Rodar** → FAIL.

- [ ] **Step 3: Implementar** — `LlmsInput` ganha `cases: { cliente: string; segmento: string | null; slug: string }[]`; o cabeçalho vira:

```ts
    `# ${YIDE_NAP.nome}`,
    "",
    "> Agência de marketing, vendas e IA em Cuiabá, MT. Atende Cuiabá, Várzea Grande, Mato Grosso e todo o Brasil.",
    "",
    `Site: ${YIDE_NAP.site}`,
    `WhatsApp: ${YIDE_NAP.telefone}`,
    `E-mail: ${YIDE_NAP.email}`,
    `Endereço: ${YIDE_NAP.rua}, ${YIDE_NAP.cidade} - ${YIDE_NAP.uf}, ${YIDE_NAP.cep}`,
    "Atendimento: 24 horas, todos os dias",
    "Atende: Cuiabá, Várzea Grande, Mato Grosso e todo o Brasil",
```

e, entre Serviços e Artigos, uma seção (só se houver cases):

```ts
    ...(cases.length ? ["## Cases", "", ...cases.map((c) => linha(c.segmento ? `${c.cliente} (${c.segmento})` : c.cliente, `${siteUrl}/cases/${c.slug}`)), ""] : []),
```

Na rota, buscar `listCasesPublicados(orgId)` (de `@/lib/seo/case-queries`) e passar `cases`.

- [ ] **Step 4: Rodar** `npx vitest run tests/unit/seo-identidade.test.ts` → PASS.

- [ ] **Step 5: Commit** `git commit -am "feat(seo): llms.txt com endereço, horário, áreas e cases"`

### Task 6: Home no sitemap

**Files:** Modify `src/app/sitemap.ts`

- [ ] **Step 1:** Primeiro item do array: `{ url: \`${SITE_URL}/\`, changeFrequency: "weekly", priority: 1 },`
- [ ] **Step 2:** `git commit -am "feat(seo): home no sitemap"`

### Task 7: Verificação final

- [ ] `npm run test` → todos PASS
- [ ] `npm run typecheck` → sem erros
- [ ] `npm run lint` → sem erros novos
- [ ] Abrir PR para `main` com o checklist de troca de domínio abaixo (executado só depois da fase 1b).

## Checklist da troca de domínio (fase 1b, manual)

1. Vercel: remover `yidedigital.com.br` e `www` do projeto do site antigo e adicionar ao projeto `yide-acompanha`.
2. Variáveis no projeto `yide-acompanha`: `NEXT_PUBLIC_SITE_URL=https://yidedigital.com.br`, `SITE_APEX_ATIVO=1`. Redeploy.
3. Search Console (propriedade de domínio) e Bing Webmaster Tools: verificar e enviar `https://yidedigital.com.br/sitemap.xml`.
4. Conferir: `blog.yidedigital.com.br/blog` → 308 para `yidedigital.com.br/blog`; páginas do sistema exigem login.
