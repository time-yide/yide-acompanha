# Painel Dados — Parte 1: API de CRM no Lyide — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor no Lyide (repo crm-yide) dois endpoints só-leitura que o Sistema Acompanhamento usa pra mostrar o CRM de cada cliente no painel Dados.

**Architecture:** Mesmo padrão de `apps/web/app/api/external/conversas`: Bearer `ACOMPANHA_API_SECRET`, Prisma bypass. A agência Yide é descoberta pela conexão já configurada (`ACOMPANHA_WA_CONNECTION_ID` → `companyId`). Só empresas com `agencyId` = agência Yide são expostas. A lógica de agregação fica numa função pura testável (`resumo-crm.ts`). A rota só busca dados e chama essa função.

**Tech Stack:** Next.js (apps/web), Prisma (`@crm/db`), vitest.

**Spec:** `Sistema Acompanhamento/docs/superpowers/specs/2026-11-22-painel-dados-design.md` (seção "CRM pelo Lyide").

**Repo:** `/Users/yasminmonteiro/Documents/meu-novo-sistema`. O checkout local está muito atrás, então trabalhe num worktree a partir de `origin/main`:

```bash
cd /Users/yasminmonteiro/Documents/meu-novo-sistema
git fetch origin
git worktree add ../lyide-dados-api -b feat/api-externa-resumo-crm origin/main
cd ../lyide-dados-api && pnpm install
```

---

## Arquivos

- Create: `apps/web/lib/external-resumo-crm.ts` (funções puras: período anterior, balde de origem, agregação)
- Create: `apps/web/lib/external-resumo-crm.test.ts`
- Modify: `apps/web/lib/external-conversas.ts` (exportar `resolveAgencyId`)
- Create: `apps/web/app/api/external/empresas/route.ts`
- Create: `apps/web/app/api/external/empresas/[slug]/resumo/route.ts`

---

### Task 1: Funções puras do resumo

**Files:**
- Create: `apps/web/lib/external-resumo-crm.ts`
- Test: `apps/web/lib/external-resumo-crm.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, expect, it } from "vitest";
import { bucketOrigem, parsePeriodo, periodoAnterior, agregarResumo } from "./external-resumo-crm";

describe("external-resumo-crm", () => {
  it("valida período", () => {
    expect(parsePeriodo("2026-11-01", "2026-11-30")).toEqual({
      de: new Date("2026-11-01T00:00:00-03:00"),
      ate: new Date("2026-11-30T23:59:59.999-03:00"),
    });
    expect(parsePeriodo("x", "2026-11-30")).toBeNull();
    expect(parsePeriodo("2026-11-30", "2026-11-01")).toBeNull();
  });

  it("período anterior tem o mesmo tamanho e termina antes do início", () => {
    const p = parsePeriodo("2026-11-01", "2026-11-30")!;
    const a = periodoAnterior(p);
    expect(a.ate.getTime()).toBe(p.de.getTime() - 1);
    expect(a.ate.getTime() - a.de.getTime()).toBe(p.ate.getTime() - p.de.getTime());
  });

  it("agrupa origem", () => {
    expect(bucketOrigem("google_ads", "WHATSAPP")).toBe("google");
    expect(bucketOrigem("google_organic", "FORM")).toBe("google");
    expect(bucketOrigem("meta_ig_ads", "WHATSAPP")).toBe("meta_ads");
    expect(bucketOrigem("instagram_story", "INSTAGRAM")).toBe("instagram");
    expect(bucketOrigem(null, "INSTAGRAM")).toBe("instagram");
    expect(bucketOrigem(null, "WHATSAPP")).toBe("whatsapp");
    expect(bucketOrigem("referral", "MANUAL")).toBe("outros");
  });

  it("agrega", () => {
    const r = agregarResumo({
      leadsNovos: [
        { sourceChannel: "google_ads", origin: "WHATSAPP" },
        { sourceChannel: null, origin: "INSTAGRAM" },
        { sourceChannel: null, origin: "INSTAGRAM" },
      ],
      vendas: [{ value: "100.50" }, { value: null }],
      semResposta24h: 4,
    });
    expect(r).toEqual({
      leadsNovos: 3,
      vendas: 2,
      valorVendas: 100.5,
      conversao: 2 / 3,
      semResposta24h: 4,
      origens: { google: 1, instagram: 2 },
    });
  });

  it("conversão é null sem leads", () => {
    expect(agregarResumo({ leadsNovos: [], vendas: [], semResposta24h: 0 }).conversao).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && pnpm vitest run lib/external-resumo-crm.test.ts`
Expected: FAIL (`Cannot find module './external-resumo-crm'`)

- [ ] **Step 3: Implementar**

```ts
/**
 * Resumo de CRM por empresa-cliente da agência, lido pelo Sistema Acompanhamento
 * (painel Dados). Funções puras — a rota só busca e chama `agregarResumo`.
 */
export type Periodo = { de: Date; ate: Date };
export type OrigemBucket = "google" | "meta_ads" | "instagram" | "facebook" | "whatsapp" | "mercado_livre" | "outros";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Datas em horário de Brasília (o painel trabalha em dias de SP). */
export function parsePeriodo(de: string | null, ate: string | null): Periodo | null {
  if (!de || !ate || !DATE_RE.test(de) || !DATE_RE.test(ate)) return null;
  const d = new Date(`${de}T00:00:00-03:00`);
  const a = new Date(`${ate}T23:59:59.999-03:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(a.getTime()) || a < d) return null;
  return { de: d, ate: a };
}

export function periodoAnterior(p: Periodo): Periodo {
  const dur = p.ate.getTime() - p.de.getTime();
  const ate = new Date(p.de.getTime() - 1);
  return { de: new Date(ate.getTime() - dur), ate };
}

export function bucketOrigem(sourceChannel: string | null, origin: string): OrigemBucket {
  const s = (sourceChannel ?? "").toLowerCase();
  if (s.startsWith("google")) return "google";
  if (s.startsWith("meta") || s.endsWith("_ads")) return "meta_ads";
  if (s.startsWith("instagram")) return "instagram";
  if (s.startsWith("messenger") || s.startsWith("facebook")) return "facebook";
  if (s === "mercado_livre") return "mercado_livre";
  if (s) return "outros";
  switch (origin) {
    case "INSTAGRAM": return "instagram";
    case "MESSENGER": return "facebook";
    case "WHATSAPP": return "whatsapp";
    case "MERCADOLIVRE": return "mercado_livre";
    default: return "outros";
  }
}

export type ResumoCrm = {
  leadsNovos: number;
  vendas: number;
  valorVendas: number;
  conversao: number | null;
  semResposta24h: number;
  origens: Partial<Record<OrigemBucket, number>>;
};

export function agregarResumo(input: {
  leadsNovos: Array<{ sourceChannel: string | null; origin: string }>;
  vendas: Array<{ value: string | number | null }>;
  semResposta24h: number;
}): ResumoCrm {
  const origens: Partial<Record<OrigemBucket, number>> = {};
  for (const l of input.leadsNovos) {
    const b = bucketOrigem(l.sourceChannel, l.origin);
    origens[b] = (origens[b] ?? 0) + 1;
  }
  const valorVendas = input.vendas.reduce((s, v) => s + (v.value == null ? 0 : Number(v.value)), 0);
  const leadsNovos = input.leadsNovos.length;
  return {
    leadsNovos,
    vendas: input.vendas.length,
    valorVendas: Math.round(valorVendas * 100) / 100,
    conversao: leadsNovos > 0 ? input.vendas.length / leadsNovos : null,
    semResposta24h: input.semResposta24h,
    origens,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && pnpm vitest run lib/external-resumo-crm.test.ts`
Expected: PASS (5 testes)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/external-resumo-crm.ts apps/web/lib/external-resumo-crm.test.ts
git commit -m "feat(api-externa): funções puras do resumo de CRM por cliente"
```

---

### Task 2: Descobrir a agência Yide

**Files:**
- Modify: `apps/web/lib/external-conversas.ts` (adicionar ao final)

- [ ] **Step 1: Adicionar `resolveAgencyId`**

```ts
/**
 * A agência é a dona da conexão espelhada (ACOMPANHA_WA_CONNECTION_ID).
 * Evita env nova: só empresas com agencyId = este id são expostas.
 */
export async function resolveAgencyId(
  prisma: { whatsAppConnection: { findUnique: (a: { where: { id: string }; select: { companyId: true } }) => Promise<{ companyId: string } | null> } },
  connectionId: string,
): Promise<string | null> {
  const conn = await prisma.whatsAppConnection.findUnique({ where: { id: connectionId }, select: { companyId: true } });
  return conn?.companyId ?? null;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/external-conversas.ts
git commit -m "feat(api-externa): resolveAgencyId pela conexão espelhada"
```

---

### Task 3: `GET /api/external/empresas`

**Files:**
- Create: `apps/web/app/api/external/empresas/route.ts`

- [ ] **Step 1: Implementar**

```ts
import { NextResponse } from "next/server";
import { createBypassPrisma } from "@crm/db";
import { isAuthorized, readExternalConfig, resolveAgencyId } from "@/lib/external-conversas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = createBypassPrisma();

/** Empresas-cliente da agência Yide: { empresas: [{ slug, name }] }. Bearer ACOMPANHA_API_SECRET. */
export async function GET(req: Request): Promise<Response> {
  const cfg = readExternalConfig();
  if (!cfg) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!isAuthorized(req.headers.get("authorization"), cfg.secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const agencyId = await resolveAgencyId(prisma, cfg.connectionId);
  if (!agencyId) return NextResponse.json({ error: "agency not found" }, { status: 404 });

  const empresas = await prisma.company.findMany({
    where: { agencyId },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });
  return NextResponse.json({ empresas });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: sem erros

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/external/empresas/route.ts
git commit -m "feat(api-externa): lista empresas-cliente da agência"
```

---

### Task 4: `GET /api/external/empresas/[slug]/resumo`

**Files:**
- Create: `apps/web/app/api/external/empresas/[slug]/resumo/route.ts`

- [ ] **Step 1: Implementar**

```ts
import { NextResponse } from "next/server";
import { createBypassPrisma } from "@crm/db";
import { isAuthorized, readExternalConfig, resolveAgencyId } from "@/lib/external-conversas";
import { agregarResumo, parsePeriodo, periodoAnterior, type Periodo } from "@/lib/external-resumo-crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const prisma = createBypassPrisma();
const DIA_MS = 24 * 60 * 60 * 1000;

async function resumoDoPeriodo(companyId: string, p: Periodo) {
  const [leadsNovos, vendas] = await Promise.all([
    prisma.lead.findMany({
      where: { companyId, deletedAt: null, createdAt: { gte: p.de, lte: p.ate } },
      select: { sourceChannel: true, origin: true },
    }),
    prisma.lead.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: "WON",
        OR: [
          { convertedAt: { gte: p.de, lte: p.ate } },
          { convertedAt: null, closedAt: { gte: p.de, lte: p.ate } },
        ],
      },
      select: { value: true },
    }),
  ]);
  return { leadsNovos, vendas: vendas.map((v) => ({ value: v.value == null ? null : v.value.toString() })) };
}

/** Leads abertos cuja última mensagem (não interna) é do cliente e tem mais de 24h. */
async function contarSemResposta24h(companyId: string): Promise<number> {
  const limite = new Date(Date.now() - DIA_MS);
  const conversas = await prisma.conversation.findMany({
    where: {
      companyId,
      lastMessageAt: { lte: limite },
      contact: { isGroup: false, leads: { some: { status: "OPEN", deletedAt: null } } },
    },
    select: {
      messages: {
        where: { isInternal: false },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { direction: true },
      },
    },
    take: 1000,
  });
  return conversas.filter((c) => c.messages[0]?.direction === "IN").length;
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const cfg = readExternalConfig();
  if (!cfg) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!isAuthorized(req.headers.get("authorization"), cfg.secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const periodo = parsePeriodo(url.searchParams.get("de"), url.searchParams.get("ate"));
  if (!periodo) return NextResponse.json({ error: "periodo invalido" }, { status: 400 });

  const agencyId = await resolveAgencyId(prisma, cfg.connectionId);
  if (!agencyId) return NextResponse.json({ error: "agency not found" }, { status: 404 });

  const company = await prisma.company.findFirst({ where: { slug, agencyId }, select: { id: true, name: true } });
  if (!company) return NextResponse.json({ error: "empresa nao encontrada" }, { status: 404 });

  const [atual, anterior, semResposta24h] = await Promise.all([
    resumoDoPeriodo(company.id, periodo),
    resumoDoPeriodo(company.id, periodoAnterior(periodo)),
    contarSemResposta24h(company.id),
  ]);

  return NextResponse.json({
    empresa: { slug, name: company.name },
    atual: agregarResumo({ ...atual, semResposta24h }),
    anterior: agregarResumo({ ...anterior, semResposta24h: 0 }),
  });
}
```

Nota: confira no `schema.prisma` se `Contact.isGroup` e as relações `conversation.contact` e `contact.leads` têm exatamente esses nomes (a rota `external/conversas/route.ts` já usa `contact.isGroup` e `contact.leads`). Se o typecheck reclamar, ajuste os nomes pelos do schema.

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter web typecheck && pnpm --filter web lint`
Expected: sem erros

- [ ] **Step 3: Teste manual contra produção depois do deploy (só leitura)**

```bash
curl -s -H "Authorization: Bearer $ACOMPANHA_API_SECRET" "https://www.lyide.com.br/api/external/empresas" | head -c 400
curl -s -H "Authorization: Bearer $ACOMPANHA_API_SECRET" "https://www.lyide.com.br/api/external/empresas/<slug>/resumo?de=2026-10-23&ate=2026-11-21"
```
Expected: JSON `{ empresas: [...] }` e `{ empresa, atual, anterior }`. Sem o Bearer: 401.

- [ ] **Step 4: Commit + PR**

```bash
git add apps/web/app/api/external/empresas
git commit -m "feat(api-externa): resumo de CRM por empresa-cliente (leads, vendas, sem resposta, origem)"
git push -u origin feat/api-externa-resumo-crm
gh pr create --title "feat(api-externa): resumo de CRM por cliente pro painel Dados do Acompanhamento" --body "..."
```

**Atenção ao deploy:** o CI do crm-yide falha em uns 2s em todo commit por problema de infra, não do código. Quando o redeploy é cancelado pelo `ignoreCommand`, use `vercel deploy --prod` a partir de um worktree limpo de `origin/main`, com o `.vercel/project.json` copiado. Não precisa de env nova: usa `ACOMPANHA_API_SECRET` e `ACOMPANHA_WA_CONNECTION_ID`, que já existem.
