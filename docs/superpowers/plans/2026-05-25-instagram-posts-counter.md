# Contagem de posts do Instagram no dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar nos dashboards do sócio e do assessor, por cliente do pacote `yide_360`/`estrategia`/`trafego_estrategia`, quantos posts foram publicados no Instagram hoje, nesta semana e neste mês — via scraping Apify (cron diário + botão on-demand com cache).

**Architecture:** Nova tabela `client_instagram_snapshots` armazena os ~50 posts recentes por cliente. As contagens são derivadas em runtime filtrando por timestamp na janela. Cron diário e server actions on-demand fazem novos snapshots via wrapper Apify. Cache de 1h evita gasto desnecessário.

**Tech Stack:** Next.js 16 (App Router + Server Actions), Supabase (Postgres + RLS), Apify Instagram Profile Scraper (já integrado em `gerador-leads/services/apify-instagram.ts`), Vercel cron, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-25-instagram-posts-counter-design.md`

---

## Phase 1 — Foundation

### Task 1: Migration `client_instagram_snapshots`

**Files:**
- Create: `supabase/migrations/20260609000000_client_instagram_snapshots.sql`

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/20260609000000_client_instagram_snapshots.sql
--
-- Snapshots periódicos do perfil do Instagram do cliente via scraping
-- Apify. As contagens hoje/semana/mês são derivadas em runtime filtrando
-- recent_posts por timestamp.

create table public.client_instagram_snapshots (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),

  scraped_at timestamptz not null default now(),

  -- Total de posts no perfil (vem direto do Apify). Null se scrape falhou.
  total_posts int,

  -- Lista de até ~50 posts recentes: [{ url, timestamp, type: 'feed'|'reel' }].
  -- Vazio se conta privada / scrape falhou.
  recent_posts jsonb not null default '[]'::jsonb,

  scrape_status text not null
    check (scrape_status in ('ok', 'profile_not_found', 'rate_limit', 'error', 'no_url')),

  erro text,

  -- 'cron' | userId (UUID do colaborador que disparou manual)
  triggered_by text not null,

  created_at timestamptz default now()
);

create index idx_client_instagram_snapshots_client_recent
  on public.client_instagram_snapshots (client_id, scraped_at desc);

-- RLS
alter table public.client_instagram_snapshots enable row level security;

-- SELECT: equipe interna (cliente do portal NÃO lê — snapshot é interno).
create policy "ig_snapshots select equipe"
  on public.client_instagram_snapshots for select to authenticated
  using (
    public.current_user_role() in ('socio', 'adm', 'coordenador', 'assessor', 'comercial')
  );

-- INSERT/UPDATE/DELETE: bloqueado pra todos. Server actions e cron usam
-- service-role que bypassa RLS.
create policy "ig_snapshots write service only"
  on public.client_instagram_snapshots for all to authenticated
  using (false) with check (false);

comment on table public.client_instagram_snapshots is
  'Snapshots periódicos do perfil do Instagram do cliente via scraping Apify. '
  'Usado pra contagem de posts no dashboard. Só preenchido pra pacotes '
  'yide_360/estrategia/trafego_estrategia.';
```

- [ ] **Step 2: Aplicar manual no Supabase (após merge, padrão do projeto)**

Migration files são só commitados. Aplicação real é manual via Dashboard SQL Editor. Documentar no PR body.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260609000000_client_instagram_snapshots.sql
git commit -m "feat(instagram-snapshots): migration + RLS"
```

---

### Task 2: Tipos compartilhados

**Files:**
- Create: `src/lib/instagram-snapshots/tipos.ts`

- [ ] **Step 1: Escrever tipos**

```typescript
// src/lib/instagram-snapshots/tipos.ts
//
// Tipos do módulo de snapshots de Instagram. Estritamente tipados pra que
// o resto do código não precise lidar com unknown vindo do JSONB.

export type PostType = "feed" | "reel";

export interface PostRecente {
  url: string;
  /** ISO timestamp em UTC. */
  timestamp: string;
  type: PostType;
}

export type ScrapeStatus =
  | "ok"
  | "profile_not_found"
  | "rate_limit"
  | "error"
  | "no_url";

export interface SnapshotRow {
  id: string;
  client_id: string;
  organization_id: string;
  scraped_at: string;
  total_posts: number | null;
  recent_posts: PostRecente[];
  scrape_status: ScrapeStatus;
  erro: string | null;
  triggered_by: string;
  created_at: string;
}

/** Contagens calculadas em runtime a partir de recent_posts. */
export interface CountsBucket {
  hoje: number;
  semana: number;
  mes: number;
}

/** Pacotes elegíveis pra contagem (clientes com postagem orgânica regular). */
export const PACOTES_ELEGIVEIS = [
  "yide_360",
  "estrategia",
  "trafego_estrategia",
] as const;

export type PacoteElegivel = (typeof PACOTES_ELEGIVEIS)[number];

export function isPacoteElegivel(p: string | null | undefined): p is PacoteElegivel {
  return p !== null && p !== undefined && (PACOTES_ELEGIVEIS as readonly string[]).includes(p);
}
```

- [ ] **Step 2: Test — isPacoteElegivel**

**Files:**
- Test: `tests/unit/instagram-snapshots-tipos.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { isPacoteElegivel, PACOTES_ELEGIVEIS } from "@/lib/instagram-snapshots/tipos";

describe("isPacoteElegivel", () => {
  it("aceita yide_360, estrategia, trafego_estrategia", () => {
    for (const p of PACOTES_ELEGIVEIS) {
      expect(isPacoteElegivel(p)).toBe(true);
    }
  });

  it("rejeita pacotes que não fazem postagem orgânica", () => {
    for (const p of ["trafego", "audiovisual", "site", "ia", "crm", "crm_ia"]) {
      expect(isPacoteElegivel(p)).toBe(false);
    }
  });

  it("rejeita null e undefined", () => {
    expect(isPacoteElegivel(null)).toBe(false);
    expect(isPacoteElegivel(undefined)).toBe(false);
  });

  it("rejeita string aleatória", () => {
    expect(isPacoteElegivel("foobar")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test**

Run: `npx vitest run tests/unit/instagram-snapshots-tipos.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 4: Commit**

```bash
git add src/lib/instagram-snapshots/tipos.ts tests/unit/instagram-snapshots-tipos.test.ts
git commit -m "feat(instagram-snapshots): tipos + guards de pacote elegível"
```

---

## Phase 2 — Lógica pura de contagem

### Task 3: Função `countPostsInWindow`

**Files:**
- Create: `src/lib/instagram-snapshots/counts.ts`
- Test: `tests/unit/instagram-snapshots-counts.test.ts`

- [ ] **Step 1: Escrever test (failing)**

```typescript
// tests/unit/instagram-snapshots-counts.test.ts
import { describe, it, expect } from "vitest";
import { computeCounts } from "@/lib/instagram-snapshots/counts";
import type { PostRecente } from "@/lib/instagram-snapshots/tipos";

// Cuiabá é UTC-4 sempre (APP_TIMEZONE).
// Para os testes, fixamos `now` como sexta 2026-05-15 14:00 UTC = 10:00 Cuiabá.
// → Hoje = 2026-05-15 00:00 Cuiabá em diante (= 2026-05-15T04:00Z em diante)
// → Semana = segunda 2026-05-11 00:00 Cuiabá (= 2026-05-11T04:00Z)
// → Mês = 2026-05-01 00:00 Cuiabá (= 2026-05-01T04:00Z)

const NOW = new Date("2026-05-15T14:00:00.000Z");

function post(timestamp: string, type: "feed" | "reel" = "feed"): PostRecente {
  return { url: `https://instagram.com/p/${timestamp}`, timestamp, type };
}

describe("computeCounts", () => {
  it("retorna zeros pra array vazio", () => {
    expect(computeCounts([], NOW)).toEqual({ hoje: 0, semana: 0, mes: 0 });
  });

  it("conta post de hoje em todos os buckets (hoje, semana, mês)", () => {
    const posts = [post("2026-05-15T13:00:00.000Z")]; // 09h Cuiabá hoje
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 1, semana: 1, mes: 1 });
  });

  it("post de ontem entra em semana e mês mas não em hoje", () => {
    const posts = [post("2026-05-14T20:00:00.000Z")]; // quinta 16h Cuiabá
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 1, mes: 1 });
  });

  it("post de segunda dessa semana entra em semana", () => {
    const posts = [post("2026-05-11T15:00:00.000Z")]; // seg 11h Cuiabá
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 1, mes: 1 });
  });

  it("post de domingo passado NÃO entra em semana (semana começa na segunda)", () => {
    const posts = [post("2026-05-10T15:00:00.000Z")]; // domingo
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 0, mes: 1 });
  });

  it("post do mês anterior NÃO entra em mês", () => {
    const posts = [post("2026-04-30T20:00:00.000Z")]; // 30/04 16h Cuiabá
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 0, mes: 0 });
  });

  it("conta múltiplos posts somando corretamente", () => {
    const posts = [
      post("2026-05-15T13:00:00.000Z"),  // hoje
      post("2026-05-15T15:00:00.000Z"),  // hoje
      post("2026-05-14T20:00:00.000Z"),  // ontem
      post("2026-05-12T20:00:00.000Z"),  // ter, ainda da semana
      post("2026-05-05T20:00:00.000Z"),  // ter passada, mês
      post("2026-04-15T20:00:00.000Z"),  // mês passado
    ];
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 2, semana: 4, mes: 5 });
  });

  it("não conta post futuro (timestamp > now)", () => {
    const posts = [post("2026-05-16T15:00:00.000Z")];
    expect(computeCounts(posts, NOW)).toEqual({ hoje: 0, semana: 0, mes: 0 });
  });

  it("conta corretamente quando now é segunda 00:30 Cuiabá (recém-início da semana)", () => {
    // 2026-05-11T04:30Z = seg 00:30 Cuiabá
    const segMadrugada = new Date("2026-05-11T04:30:00.000Z");
    const posts = [
      post("2026-05-11T04:15:00.000Z"), // seg 00:15 Cuiabá (hoje)
      post("2026-05-10T20:00:00.000Z"), // dom (semana passada)
    ];
    expect(computeCounts(posts, segMadrugada)).toEqual({ hoje: 1, semana: 1, mes: 2 });
  });
});
```

- [ ] **Step 2: Run failing test**

Run: `npx vitest run tests/unit/instagram-snapshots-counts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implementar counts.ts**

```typescript
// src/lib/instagram-snapshots/counts.ts
//
// Funções puras pra computar contagens de posts dentro de janelas de
// tempo no fuso da app (Cuiabá UTC-4). Sem deps externas.
import { getDatePartsInAppTz, APP_TIMEZONE } from "@/lib/datetime/timezone";
import type { CountsBucket, PostRecente } from "./tipos";

/**
 * Retorna o "início do dia" em Cuiabá (00:00 local) como um Date UTC.
 * Ex: now = 2026-05-15T14:00Z → 2026-05-15T04:00Z (00:00 Cuiabá UTC-4).
 */
function startOfDayCuiaba(ref: Date): Date {
  const parts = getDatePartsInAppTz(ref);
  // parts.year/month/day estão no fuso da app. Constrói 00:00 local somando offset.
  // Cuiabá é UTC-4 fixo → 00:00 local = 04:00 UTC do mesmo dia.
  return new Date(`${parts.year}-${parts.month}-${parts.day}T04:00:00.000Z`);
}

/**
 * Início da semana (segunda 00:00 Cuiabá) como Date UTC.
 */
function startOfWeekCuiaba(ref: Date): Date {
  const dayStart = startOfDayCuiaba(ref);
  // getDay no horário Cuiabá: precisamos do dia da semana NO FUSO da app.
  // Como dayStart é 04:00Z e UTC=04:00 não cruza meia-noite Cuiabá nem UTC,
  // dá pra usar getUTCDay direto: a 04:00Z, o dia UTC = dia Cuiabá.
  const dow = dayStart.getUTCDay(); // 0=dom, 1=seg, ..., 6=sab
  const diasDesdeSegunda = dow === 0 ? 6 : dow - 1;
  const seg = new Date(dayStart);
  seg.setUTCDate(seg.getUTCDate() - diasDesdeSegunda);
  return seg;
}

/**
 * Início do mês (dia 1 00:00 Cuiabá) como Date UTC.
 */
function startOfMonthCuiaba(ref: Date): Date {
  const parts = getDatePartsInAppTz(ref);
  return new Date(`${parts.year}-${parts.month}-01T04:00:00.000Z`);
}

export function computeCounts(posts: PostRecente[], now: Date = new Date()): CountsBucket {
  const dayStart = startOfDayCuiaba(now);
  const weekStart = startOfWeekCuiaba(now);
  const monthStart = startOfMonthCuiaba(now);
  const nowMs = now.getTime();

  let hoje = 0, semana = 0, mes = 0;
  for (const p of posts) {
    const t = new Date(p.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    if (t > nowMs) continue; // ignora futuro
    if (t >= dayStart.getTime()) hoje++;
    if (t >= weekStart.getTime()) semana++;
    if (t >= monthStart.getTime()) mes++;
  }
  return { hoje, semana, mes };
}

// Re-exporta pra debug/uso externo se precisar
export { startOfDayCuiaba, startOfWeekCuiaba, startOfMonthCuiaba, APP_TIMEZONE };
```

- [ ] **Step 4: Run test — passa**

Run: `npx vitest run tests/unit/instagram-snapshots-counts.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/instagram-snapshots/counts.ts tests/unit/instagram-snapshots-counts.test.ts
git commit -m "feat(instagram-snapshots): computeCounts puro (hoje/semana/mês Cuiabá)"
```

---

## Phase 3 — Scraper

### Task 4: `fetchProfileSnapshot` (Apify wrapper)

**Files:**
- Create: `src/lib/instagram-snapshots/scraper.ts`

- [ ] **Step 1: Inspecionar wrapper Apify existente**

Run: `grep -n "scrapeInstagramProfile\|latestPosts\|ACTOR_ID" src/lib/gerador-leads/services/apify-instagram.ts | head -10`

Confirmar:
- `ACTOR_ID = "apify~instagram-profile-scraper"`
- Actor já retorna `latestPosts` quando solicitado
- Endpoint usado: `run-sync-get-dataset-items`

- [ ] **Step 2: Escrever scraper.ts**

```typescript
// src/lib/instagram-snapshots/scraper.ts
import "server-only";
import { getServerEnv } from "@/lib/env";
import type { PostRecente, PostType, ScrapeStatus } from "./tipos";

const APIFY_BASE = "https://api.apify.com/v2";
const ACTOR_ID = "apify~instagram-profile-scraper";
const FETCH_TIMEOUT_MS = 60_000;

export interface ProfileSnapshotResult {
  status: ScrapeStatus;
  /** Total de posts do perfil. Null em erro. */
  totalPosts: number | null;
  /** Posts recentes processados (máx 50). Vazio em erro. */
  recentPosts: PostRecente[];
  /** Mensagem de erro se status != 'ok'. */
  erro?: string;
}

interface ApifyLatestPost {
  url?: string;
  shortCode?: string;
  timestamp?: string;
  type?: string;          // "Image" | "Video" | "Sidecar"
  productType?: string;   // "clips" pra reel
}

interface ApifyProfile {
  postsCount?: number;
  latestPosts?: ApifyLatestPost[];
}

/**
 * Normaliza username/URL. Aceita "@user", "user", "https://instagram.com/user/".
 * Retorna null se não conseguir extrair username.
 */
export function normalizeUsername(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let user = raw.trim();
  if (!user) return null;
  if (user.startsWith("@")) user = user.slice(1);
  const m = user.match(/instagram\.com\/([^/?#]+)/i);
  if (m) user = m[1];
  user = user.replace(/\/$/, "");
  return user.length > 0 ? user : null;
}

function mapPostType(post: ApifyLatestPost): PostType {
  if (post.productType === "clips") return "reel";
  if (post.type === "Video" && (!post.productType || post.productType === "clips")) {
    return "reel";
  }
  // Image, Sidecar (carrossel) e Video sem clips → feed
  return "feed";
}

function buildPostUrl(post: ApifyLatestPost): string | null {
  if (post.url) return post.url;
  if (post.shortCode) return `https://www.instagram.com/p/${post.shortCode}/`;
  return null;
}

/**
 * Faz scraping de UM perfil. Não persiste — só retorna o resultado.
 * Persistência é responsabilidade do caller (actions / cron).
 */
export async function fetchProfileSnapshot(
  instagramUrlOrUser: string | null | undefined,
): Promise<ProfileSnapshotResult> {
  const username = normalizeUsername(instagramUrlOrUser);
  if (!username) {
    return { status: "no_url", totalPosts: null, recentPosts: [] };
  }

  const env = getServerEnv();
  const token = env.APIFY_API_TOKEN;
  if (!token) {
    return {
      status: "error",
      totalPosts: null,
      recentPosts: [],
      erro: "APIFY_API_TOKEN não configurado",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `${APIFY_BASE}/acts/${ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [username],
        resultsLimit: 1,
        // resultsType controla o que vem. "details" inclui latestPosts.
        resultsType: "details",
        addParentData: false,
      }),
      signal: controller.signal,
    });

    if (resp.status === 429) {
      return { status: "rate_limit", totalPosts: null, recentPosts: [], erro: "Rate limit Apify" };
    }
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return {
        status: "error",
        totalPosts: null,
        recentPosts: [],
        erro: `HTTP ${resp.status}: ${text.slice(0, 200)}`,
      };
    }

    const items = (await resp.json()) as ApifyProfile[];
    if (!Array.isArray(items) || items.length === 0) {
      return {
        status: "profile_not_found",
        totalPosts: null,
        recentPosts: [],
        erro: "Perfil não encontrado ou privado",
      };
    }

    const profile = items[0];
    const totalPosts = typeof profile.postsCount === "number" ? profile.postsCount : null;

    const recentPosts: PostRecente[] = (profile.latestPosts ?? [])
      .filter((p) => p.timestamp)
      .slice(0, 50)
      .map((p) => {
        const url = buildPostUrl(p);
        return url
          ? { url, timestamp: p.timestamp!, type: mapPostType(p) }
          : null;
      })
      .filter((p): p is PostRecente => p !== null);

    return { status: "ok", totalPosts, recentPosts };
  } catch (err) {
    return {
      status: "error",
      totalPosts: null,
      recentPosts: [],
      erro: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 3: Test do normalizeUsername e mapPostType (não chama Apify real)**

**Files:**
- Test: `tests/unit/instagram-snapshots-scraper.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { normalizeUsername } from "@/lib/instagram-snapshots/scraper";

describe("normalizeUsername", () => {
  it("aceita username puro", () => {
    expect(normalizeUsername("yidedigital")).toBe("yidedigital");
  });
  it("remove @", () => {
    expect(normalizeUsername("@yidedigital")).toBe("yidedigital");
  });
  it("extrai de URL", () => {
    expect(normalizeUsername("https://instagram.com/yidedigital/")).toBe("yidedigital");
  });
  it("extrai de URL com query", () => {
    expect(normalizeUsername("https://www.instagram.com/yidedigital/?utm=1")).toBe("yidedigital");
  });
  it("retorna null para string vazia", () => {
    expect(normalizeUsername("")).toBeNull();
    expect(normalizeUsername("   ")).toBeNull();
  });
  it("retorna null para null/undefined", () => {
    expect(normalizeUsername(null)).toBeNull();
    expect(normalizeUsername(undefined)).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/instagram-snapshots-scraper.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/instagram-snapshots/scraper.ts tests/unit/instagram-snapshots-scraper.test.ts
git commit -m "feat(instagram-snapshots): wrapper Apify + normalize username"
```

---

## Phase 4 — Queries e Actions

### Task 5: Queries

**Files:**
- Create: `src/lib/instagram-snapshots/queries.ts`

- [ ] **Step 1: Escrever queries**

```typescript
// src/lib/instagram-snapshots/queries.ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { SnapshotRow, PostRecente } from "./tipos";
import { PACOTES_ELEGIVEIS } from "./tipos";

export interface ClienteComSnapshot {
  cliente_id: string;
  cliente_nome: string;
  tipo_pacote: string;
  instagram_url: string | null;
  assessor_id: string | null;
  unit_id: string | null;
  ultimo_snapshot: SnapshotRow | null;
}

/**
 * Lista clientes elegíveis (pacote yide_360/estrategia/trafego_estrategia) +
 * último snapshot de cada. Filtra por unidade e (opcionalmente) por assessor.
 */
export async function listClientesComUltimoSnapshot(opts: {
  unitId?: string | null;
  assessorId?: string | null;
}): Promise<ClienteComSnapshot[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let q = sb
    .from("clients")
    .select("id, nome, tipo_pacote, instagram_url, assessor_id, unit_id")
    .eq("status", "ativo")
    .in("tipo_pacote", PACOTES_ELEGIVEIS as readonly string[])
    .is("deleted_at", null);

  if (opts.unitId) q = q.eq("unit_id", opts.unitId);
  if (opts.assessorId) q = q.eq("assessor_id", opts.assessorId);

  const { data: clientes } = await q.order("nome");
  const rows = (clientes ?? []) as Array<{
    id: string;
    nome: string;
    tipo_pacote: string;
    instagram_url: string | null;
    assessor_id: string | null;
    unit_id: string | null;
  }>;

  if (rows.length === 0) return [];

  // Busca último snapshot por cliente em UMA query usando window function.
  // Trick: ordena por scraped_at desc, distinct on cliente_id.
  const clienteIds = rows.map((r) => r.id);
  const { data: snaps } = await sb
    .from("client_instagram_snapshots")
    .select("*")
    .in("client_id", clienteIds)
    .order("client_id")
    .order("scraped_at", { ascending: false });

  // Mantém só o primeiro de cada client_id (já vem ordenado por scraped_at desc).
  const ultimoPorCliente = new Map<string, SnapshotRow>();
  for (const s of (snaps ?? []) as SnapshotRow[]) {
    if (!ultimoPorCliente.has(s.client_id)) {
      ultimoPorCliente.set(s.client_id, s);
    }
  }

  return rows.map((c) => ({
    cliente_id: c.id,
    cliente_nome: c.nome,
    tipo_pacote: c.tipo_pacote,
    instagram_url: c.instagram_url,
    assessor_id: c.assessor_id,
    unit_id: c.unit_id,
    ultimo_snapshot: ultimoPorCliente.get(c.id) ?? null,
  }));
}

/**
 * Retorna se o cliente tem snapshot recente o suficiente pra dispensar
 * chamar Apify de novo. Usado pra cache de 1h/5min.
 */
export async function getSnapshotSeRecente(
  clienteId: string,
  maxAgeMs: number,
): Promise<SnapshotRow | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const { data } = await sb
    .from("client_instagram_snapshots")
    .select("*")
    .eq("client_id", clienteId)
    .eq("scrape_status", "ok")
    .gte("scraped_at", cutoff)
    .order("scraped_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SnapshotRow | null) ?? null;
}

/** Lista clientes elegíveis pro cron (passou pela elegibilidade + tem URL). */
export async function listClientesParaCron(): Promise<Array<{
  id: string;
  organization_id: string;
  instagram_url: string;
}>> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("clients")
    .select("id, organization_id, instagram_url")
    .eq("status", "ativo")
    .in("tipo_pacote", PACOTES_ELEGIVEIS as readonly string[])
    .not("instagram_url", "is", null)
    .is("deleted_at", null);
  return ((data ?? []) as Array<{
    id: string;
    organization_id: string;
    instagram_url: string;
  }>).filter((c) => c.instagram_url && c.instagram_url.trim().length > 0);
}

// Re-export pra usar no cliente quando precisar (parsing JSON do snapshot)
export type { PostRecente, SnapshotRow };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/instagram-snapshots/queries.ts
git commit -m "feat(instagram-snapshots): queries (lista clientes + último snapshot)"
```

---

### Task 6: Server action `refreshSnapshotsAction`

**Files:**
- Create: `src/lib/instagram-snapshots/actions.ts`

- [ ] **Step 1: Escrever actions.ts**

```typescript
// src/lib/instagram-snapshots/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchProfileSnapshot } from "./scraper";
import { getSnapshotSeRecente } from "./queries";
import { isPacoteElegivel } from "./tipos";

type ActionErr = { error: string };
export interface RefreshResult {
  refreshed: number;
  cached: number;
  errors: number;
  total: number;
}

const CACHE_MASSA_MS = 60 * 60 * 1000;     // 1h
const CACHE_INDIVIDUAL_MS = 5 * 60 * 1000;  // 5min

const ROLES_PERMITIDOS = ["socio", "adm", "coordenador", "assessor"];

/**
 * Refresh sob demanda. Pode ser chamado com 1 ou N clientIds. Usa cache:
 * - Single (1 client): 5min
 * - Massa (N clients): 1h
 *
 * Sócio/adm/coordenador podem refresh qualquer cliente. Assessor só os
 * onde `assessor_id = self`.
 */
export async function refreshSnapshotsAction(
  clientIds: string[],
): Promise<ActionErr | RefreshResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }
  if (clientIds.length === 0) {
    return { refreshed: 0, cached: 0, errors: 0, total: 0 };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Busca metadados dos clientes (pacote, URL, assessor) pra validar.
  const { data: clientesRaw } = await sb
    .from("clients")
    .select("id, organization_id, tipo_pacote, instagram_url, assessor_id")
    .in("id", clientIds);
  const clientes = (clientesRaw ?? []) as Array<{
    id: string;
    organization_id: string;
    tipo_pacote: string;
    instagram_url: string | null;
    assessor_id: string | null;
  }>;

  // Filtra:
  // - Assessor: só clientes onde assessor_id = self
  // - Todos: só pacotes elegíveis
  // - Todos: só com instagram_url cadastrado
  const elegiveis = clientes.filter((c) => {
    if (!isPacoteElegivel(c.tipo_pacote)) return false;
    if (!c.instagram_url) return false;
    if (actor.role === "assessor" && c.assessor_id !== actor.id) return false;
    return true;
  });

  const cacheMs = clientIds.length === 1 ? CACHE_INDIVIDUAL_MS : CACHE_MASSA_MS;
  let refreshed = 0, cached = 0, errors = 0;

  // Roda em batches de 5 paralelos pra não estourar Apify rate limit.
  const batchSize = 5;
  for (let i = 0; i < elegiveis.length; i += batchSize) {
    const batch = elegiveis.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (c) => {
        const recente = await getSnapshotSeRecente(c.id, cacheMs);
        if (recente) return "cached" as const;

        const snap = await fetchProfileSnapshot(c.instagram_url);

        const { error } = await sb.from("client_instagram_snapshots").insert({
          client_id: c.id,
          organization_id: c.organization_id,
          total_posts: snap.totalPosts,
          recent_posts: snap.recentPosts,
          scrape_status: snap.status,
          erro: snap.erro ?? null,
          triggered_by: actor.id,
        });
        if (error) return "error" as const;
        return snap.status === "ok" ? "refreshed" : "error";
      }),
    );
    for (const r of results) {
      if (r === "cached") cached++;
      else if (r === "refreshed") refreshed++;
      else errors++;
    }
  }

  revalidatePath("/");
  return { refreshed, cached, errors, total: elegiveis.length };
}
```

- [ ] **Step 2: Test de integração**

**Files:**
- Test: `tests/unit/instagram-snapshots-actions.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const fetchProfileSnapshotMock = vi.hoisted(() => vi.fn());
const getSnapshotSeRecenteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));
vi.mock("@/lib/auth/session", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/instagram-snapshots/scraper", () => ({
  fetchProfileSnapshot: fetchProfileSnapshotMock,
}));
vi.mock("@/lib/instagram-snapshots/queries", () => ({
  getSnapshotSeRecente: getSnapshotSeRecenteMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { refreshSnapshotsAction } from "@/lib/instagram-snapshots/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  fetchProfileSnapshotMock.mockReset();
  getSnapshotSeRecenteMock.mockReset();
});

describe("refreshSnapshotsAction", () => {
  it("rejeita sem permissão", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "videomaker" });
    const r = await refreshSnapshotsAction(["00000000-0000-0000-0000-000000000001"]);
    expect("error" in r ? r.error : null).toMatch(/permissão/i);
  });

  it("filtra pacotes inelegíveis", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    fromMock.mockImplementation(() => ({
      select: () => ({
        in: vi.fn().mockResolvedValue({
          data: [
            { id: "c1", organization_id: "org1", tipo_pacote: "trafego", instagram_url: "x", assessor_id: null },
            { id: "c2", organization_id: "org1", tipo_pacote: "audiovisual", instagram_url: "y", assessor_id: null },
          ],
        }),
      }),
    }));

    const r = await refreshSnapshotsAction(["c1", "c2"]);
    expect("total" in r ? r.total : -1).toBe(0);
    expect(fetchProfileSnapshotMock).not.toHaveBeenCalled();
  });

  it("usa cache 5min quando 1 client", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    fromMock.mockImplementation(() => ({
      select: () => ({
        in: vi.fn().mockResolvedValue({
          data: [{ id: "c1", organization_id: "org1", tipo_pacote: "yide_360", instagram_url: "@x", assessor_id: null }],
        }),
      }),
    }));
    getSnapshotSeRecenteMock.mockResolvedValue({ id: "snap1" });

    const r = await refreshSnapshotsAction(["c1"]);
    expect("cached" in r ? r.cached : -1).toBe(1);
    expect(fetchProfileSnapshotMock).not.toHaveBeenCalled();
  });

  it("assessor só refresha clientes próprios", async () => {
    requireAuthMock.mockResolvedValue({ id: "u_assessor", role: "assessor" });
    fromMock.mockImplementation(() => ({
      select: () => ({
        in: vi.fn().mockResolvedValue({
          data: [
            { id: "c1", organization_id: "org1", tipo_pacote: "yide_360", instagram_url: "@x", assessor_id: "u_assessor" },
            { id: "c2", organization_id: "org1", tipo_pacote: "yide_360", instagram_url: "@y", assessor_id: "outro" },
          ],
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }));
    getSnapshotSeRecenteMock.mockResolvedValue(null);
    fetchProfileSnapshotMock.mockResolvedValue({ status: "ok", totalPosts: 100, recentPosts: [] });

    const r = await refreshSnapshotsAction(["c1", "c2"]);
    expect("total" in r ? r.total : -1).toBe(1);
    expect(fetchProfileSnapshotMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/instagram-snapshots-actions.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 4: Commit**

```bash
git add src/lib/instagram-snapshots/actions.ts tests/unit/instagram-snapshots-actions.test.ts
git commit -m "feat(instagram-snapshots): refreshSnapshotsAction com cache + filtros"
```

---

## Phase 5 — Cron diário

### Task 7: Endpoint cron

**Files:**
- Create: `src/app/api/cron/instagram-snapshots/route.ts`

- [ ] **Step 1: Inspecionar padrão dos crons existentes**

Run: `ls src/app/api/cron/`

Anotar como autenticam (provavelmente via `CRON_SECRET` header).

Run: `cat src/app/api/cron/$(ls src/app/api/cron/ | head -1)/route.ts | head -30`

- [ ] **Step 2: Escrever route.ts**

```typescript
// src/app/api/cron/instagram-snapshots/route.ts
//
// Cron diário (00:00 Cuiabá = 04:00 UTC) que cria snapshot de cada
// cliente elegível com instagram_url cadastrado.

import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchProfileSnapshot } from "@/lib/instagram-snapshots/scraper";
import { listClientesParaCron, getSnapshotSeRecente } from "@/lib/instagram-snapshots/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5min — bate Apify pra dezenas de perfis

const SKIP_IF_FRESHER_THAN_MS = 6 * 60 * 60 * 1000; // 6h: idempotência

export async function GET(req: Request) {
  const env = getServerEnv();
  if (env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const clientes = await listClientesParaCron();
  if (clientes.length === 0) {
    return NextResponse.json({ ok: true, total: 0, refreshed: 0, skipped: 0, errors: 0 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  let refreshed = 0, skipped = 0, errors = 0;
  const batchSize = 5;
  for (let i = 0; i < clientes.length; i += batchSize) {
    const batch = clientes.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (c) => {
        // Idempotência: se cron rodou hoje há menos de 6h, pula.
        const recente = await getSnapshotSeRecente(c.id, SKIP_IF_FRESHER_THAN_MS);
        if (recente) return "skipped" as const;

        const snap = await fetchProfileSnapshot(c.instagram_url);
        const { error } = await sb.from("client_instagram_snapshots").insert({
          client_id: c.id,
          organization_id: c.organization_id,
          total_posts: snap.totalPosts,
          recent_posts: snap.recentPosts,
          scrape_status: snap.status,
          erro: snap.erro ?? null,
          triggered_by: "cron",
        });
        if (error) return "error" as const;
        return snap.status === "ok" ? "refreshed" : "error";
      }),
    );
    for (const r of results) {
      if (r === "skipped") skipped++;
      else if (r === "refreshed") refreshed++;
      else errors++;
    }
  }

  return NextResponse.json({
    ok: true,
    total: clientes.length,
    refreshed,
    skipped,
    errors,
  });
}
```

- [ ] **Step 3: Adicionar cron schedule no `vercel.json`**

Inspecionar arquivo atual:

Run: `cat vercel.json 2>/dev/null || echo "{}"`

Se já existe array `crons`, adicionar nova entrada. Schedule **04:00 UTC** (= 00:00 Cuiabá UTC-4):

```json
{
  "crons": [
    { "path": "/api/cron/instagram-snapshots", "schedule": "0 4 * * *" }
  ]
}
```

Se já tem outros crons, manter os existentes e adicionar este ao array.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/instagram-snapshots/route.ts vercel.json
git commit -m "feat(instagram-snapshots): cron diário 00:00 Cuiabá"
```

---

## Phase 6 — UI: card no dashboard

### Task 8: Componente `InstagramPostsCard`

**Files:**
- Create: `src/components/dashboard/InstagramPostsCard.tsx`

- [ ] **Step 1: Escrever componente**

```tsx
// src/components/dashboard/InstagramPostsCard.tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Instagram, Loader2, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { refreshSnapshotsAction } from "@/lib/instagram-snapshots/actions";
import { computeCounts } from "@/lib/instagram-snapshots/counts";
import type { ClienteComSnapshot } from "@/lib/instagram-snapshots/queries";
import type { PostRecente, ScrapeStatus } from "@/lib/instagram-snapshots/tipos";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

const STATUS_LABEL: Record<ScrapeStatus, { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  profile_not_found: { label: "Perfil privado/não encontrado", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  rate_limit: { label: "Tente em 5min", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  error: { label: "Erro", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  no_url: { label: "Sem perfil cadastrado", cls: "bg-muted text-muted-foreground" },
};

interface Props {
  clientes: ClienteComSnapshot[];
  /** Título customizável. Sócio vê "Postagens no Instagram (Geral)", assessor "Suas postagens". */
  titulo?: string;
}

export function InstagramPostsCard({ clientes, titulo = "Postagens no Instagram" }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastRun, setLastRun] = useState<string | null>(null);

  function refreshTodos() {
    const ids = clientes.filter((c) => c.instagram_url).map((c) => c.cliente_id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const r = await refreshSnapshotsAction(ids);
      if ("error" in r) {
        setLastRun(`Erro: ${r.error}`);
      } else {
        setLastRun(`Atualizado: ${r.refreshed} · Cache: ${r.cached} · Erros: ${r.errors}`);
      }
      router.refresh();
    });
  }

  function refreshUm(clienteId: string) {
    startTransition(async () => {
      await refreshSnapshotsAction([clienteId]);
      router.refresh();
    });
  }

  if (clientes.length === 0) {
    return null; // sem clientes elegíveis → não renderiza
  }

  return (
    <Card className="overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-pink-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">{titulo}</h2>
          <span className="text-xs text-muted-foreground">
            ({clientes.length} {clientes.length === 1 ? "cliente" : "clientes"})
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && <span className="text-xs text-muted-foreground">{lastRun}</span>}
          <button
            type="button"
            onClick={refreshTodos}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
        </div>
      </header>

      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2">Cliente</th>
            <th className="px-4 py-2 text-center">Hoje</th>
            <th className="px-4 py-2 text-center">Semana</th>
            <th className="px-4 py-2 text-center">Mês</th>
            <th className="px-4 py-2">Atualizado</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {clientes.map((c) => {
            const snap = c.ultimo_snapshot;
            const posts: PostRecente[] = snap?.recent_posts ?? [];
            const status: ScrapeStatus = snap?.scrape_status ?? (c.instagram_url ? "ok" : "no_url");
            const counts = status === "ok" ? computeCounts(posts) : null;
            const statusInfo = STATUS_LABEL[status];

            return (
              <tr key={c.cliente_id} className="hover:bg-muted/30">
                <td className="px-4 py-2">
                  <Link href={`/clientes/${c.cliente_id}`} className="font-medium hover:underline">
                    {c.cliente_nome}
                  </Link>
                  {c.instagram_url && (
                    <a
                      href={c.instagram_url.startsWith("http") ? c.instagram_url : `https://instagram.com/${c.instagram_url.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 inline-block text-muted-foreground hover:text-pink-500"
                      aria-label="Abrir Instagram"
                    >
                      <ExternalLink className="inline h-3 w-3" />
                    </a>
                  )}
                </td>
                {counts ? (
                  <>
                    <td className="px-4 py-2 text-center font-medium tabular-nums">{counts.hoje}</td>
                    <td className="px-4 py-2 text-center font-medium tabular-nums">{counts.semana}</td>
                    <td className="px-4 py-2 text-center font-medium tabular-nums">{counts.mes}</td>
                  </>
                ) : (
                  <td colSpan={3} className="px-4 py-2 text-center">
                    <Badge variant="outline" className={statusInfo.cls}>
                      {status !== "ok" && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                      {statusInfo.label}
                    </Badge>
                    {status === "no_url" && (
                      <Link href={`/clientes/${c.cliente_id}`} className="ml-2 text-xs text-primary hover:underline">
                        Cadastrar
                      </Link>
                    )}
                  </td>
                )}
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {snap ? timeAgo(snap.scraped_at) : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {c.instagram_url && (
                    <button
                      type="button"
                      onClick={() => refreshUm(c.cliente_id)}
                      disabled={pending}
                      className="text-xs text-primary hover:underline disabled:opacity-50"
                    >
                      Atualizar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/InstagramPostsCard.tsx
git commit -m "feat(instagram-snapshots): InstagramPostsCard (UI da tabela)"
```

---

### Task 9: Integrar no `DashboardSocioAdm`

**Files:**
- Modify: `src/components/dashboard/DashboardSocioAdm.tsx`

- [ ] **Step 1: Inspecionar estrutura atual do dashboard**

Run: `grep -n "export function\|export default\|<Card" src/components/dashboard/DashboardSocioAdm.tsx | head -20`

- [ ] **Step 2: Buscar dados no server e passar pro card**

O dashboard é renderizado em `src/app/(authed)/page.tsx`. Adicionar lá:

Run: `grep -n "DashboardSocioAdm\b" src/app/\(authed\)/page.tsx`

Editar `src/app/(authed)/page.tsx` pra buscar clientes elegíveis e passar como prop quando o role for sócio/adm:

```typescript
// Adicione perto dos outros imports:
import { listClientesComUltimoSnapshot } from "@/lib/instagram-snapshots/queries";

// Dentro do block que renderiza DashboardSocioAdm:
const unitCtx = await getUnitContext();
const instagramClientes = await listClientesComUltimoSnapshot({
  unitId: unitCtx?.activeUnit.id ?? null,
});

return (
  <DashboardSocioAdm
    /* ...props existentes... */
    instagramClientes={instagramClientes}
  />
);
```

E no `DashboardSocioAdm.tsx`, adicionar a prop e renderizar:

```typescript
import { InstagramPostsCard } from "./InstagramPostsCard";
import type { ClienteComSnapshot } from "@/lib/instagram-snapshots/queries";

interface Props {
  /* ...props existentes... */
  instagramClientes: ClienteComSnapshot[];
}

// dentro do JSX, em alguma seção apropriada:
{props.instagramClientes.length > 0 && (
  <InstagramPostsCard
    clientes={props.instagramClientes}
    titulo="Postagens no Instagram (Geral)"
  />
)}
```

> **Nota:** os nomes exatos das props/imports atuais do `DashboardSocioAdm` precisam ser checados antes de editar — siga o padrão dos outros cards já passados como prop. Não inventar.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardSocioAdm.tsx 'src/app/(authed)/page.tsx'
git commit -m "feat(instagram-snapshots): card no DashboardSocioAdm"
```

---

### Task 10: Integrar no `DashboardAssessor`

**Files:**
- Modify: `src/components/dashboard/DashboardAssessor.tsx`
- Modify: `src/app/(authed)/page.tsx`

- [ ] **Step 1: No `page.tsx`, no block que renderiza DashboardAssessor**

Importar o query helper se ainda não importou:

```typescript
import { listClientesComUltimoSnapshot } from "@/lib/instagram-snapshots/queries";
```

Buscar dados filtrando por unit ativa E pelo próprio assessor:

```typescript
const unitCtx = await getUnitContext();
const instagramClientes = await listClientesComUltimoSnapshot({
  unitId: unitCtx?.activeUnit.id ?? null,
  assessorId: user.id,
});
```

Passar `instagramClientes` como prop pro `<DashboardAssessor>`.

- [ ] **Step 2: No `DashboardAssessor.tsx`, adicionar a prop e renderizar o card**

```typescript
import { InstagramPostsCard } from "./InstagramPostsCard";
import type { ClienteComSnapshot } from "@/lib/instagram-snapshots/queries";

// Na interface de props existente:
interface DashboardAssessorProps {
  /* ...props existentes da assinatura atual... */
  instagramClientes: ClienteComSnapshot[];
}

// Dentro do JSX, em seção apropriada (após KPIs, antes de tarefas — siga convenção do arquivo):
{props.instagramClientes.length > 0 && (
  <InstagramPostsCard
    clientes={props.instagramClientes}
    titulo="Suas postagens no Instagram"
  />
)}
```

> **Nota:** o nome exato da interface de props do `DashboardAssessor` precisa ser conferido no arquivo antes de editar. Seguir convenção dos outros props já passados (provavelmente `user`, `kpis`, `tarefas` etc.).

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/DashboardAssessor.tsx 'src/app/(authed)/page.tsx'
git commit -m "feat(instagram-snapshots): card no DashboardAssessor (filtra por assessor)"
```

---

## Phase 7 — Tests de integração + PR

### Task 11: Test do endpoint cron

**Files:**
- Create: `tests/integration/instagram-snapshots-cron.test.ts`

- [ ] **Step 1: Test do GET handler**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const fetchProfileSnapshotMock = vi.hoisted(() => vi.fn());
const listClientesParaCronMock = vi.hoisted(() => vi.fn());
const getSnapshotSeRecenteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));
vi.mock("@/lib/instagram-snapshots/scraper", () => ({
  fetchProfileSnapshot: fetchProfileSnapshotMock,
}));
vi.mock("@/lib/instagram-snapshots/queries", () => ({
  listClientesParaCron: listClientesParaCronMock,
  getSnapshotSeRecente: getSnapshotSeRecenteMock,
}));

import { GET } from "@/app/api/cron/instagram-snapshots/route";

beforeEach(() => {
  fromMock.mockReset();
  fetchProfileSnapshotMock.mockReset();
  listClientesParaCronMock.mockReset();
  getSnapshotSeRecenteMock.mockReset();
});

function makeReq(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("https://test.local/api/cron/instagram-snapshots", { headers });
}

describe("cron /api/cron/instagram-snapshots", () => {
  it("retorna 401 se CRON_SECRET configurado e auth não bate", async () => {
    process.env.CRON_SECRET = "secret-abc";
    const res = await GET(makeReq("Bearer wrong"));
    expect(res.status).toBe(401);
    delete process.env.CRON_SECRET;
  });

  it("retorna ok:true sem clientes elegíveis", async () => {
    listClientesParaCronMock.mockResolvedValue([]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body).toEqual({ ok: true, total: 0, refreshed: 0, skipped: 0, errors: 0 });
  });

  it("skipa clientes com snapshot < 6h", async () => {
    listClientesParaCronMock.mockResolvedValue([
      { id: "c1", organization_id: "org1", instagram_url: "@x" },
    ]);
    getSnapshotSeRecenteMock.mockResolvedValue({ id: "snap1" });
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.skipped).toBe(1);
    expect(fetchProfileSnapshotMock).not.toHaveBeenCalled();
  });

  it("scrapeia e insere quando sem snapshot recente", async () => {
    listClientesParaCronMock.mockResolvedValue([
      { id: "c1", organization_id: "org1", instagram_url: "@x" },
    ]);
    getSnapshotSeRecenteMock.mockResolvedValue(null);
    fetchProfileSnapshotMock.mockResolvedValue({ status: "ok", totalPosts: 100, recentPosts: [] });
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation(() => ({ insert: insertMock }));

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.refreshed).toBe(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: "c1",
        organization_id: "org1",
        scrape_status: "ok",
        triggered_by: "cron",
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/integration/instagram-snapshots-cron.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 3: Suite completa + lint + typecheck**

Run: `npx vitest run`
Expected: PASS (todos os testes — incluindo os novos).

Run: `npm run typecheck 2>&1 | grep -v "@sparticuz\|puppeteer-core\|cheerio\|web-push" | grep "error TS" | grep -v "site-scraper"`
Expected: vazio (0 errors).

Run: `npm run lint 2>&1 | grep "error " | grep -v "warning"`
Expected: vazio (0 errors).

- [ ] **Step 4: Commit**

```bash
git add tests/integration/instagram-snapshots-cron.test.ts
git commit -m "test(instagram-snapshots): integration test do cron"
```

---

### Task 12: PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/instagram-posts-counter
```

- [ ] **Step 2: Criar PR via gh**

Título: `feat(dashboard): contagem de posts do Instagram (yide_360/estrategia)`

Body:
```
## Resumo

Adiciona seção "Postagens no Instagram" nos dashboards de sócio e assessor, mostrando hoje/semana/mês de posts publicados por cliente (apenas pacotes `yide_360`, `estrategia` e `trafego_estrategia`).

- Sócio vê todos os clientes elegíveis da unidade ativa
- Assessor vê só os onde é responsável
- Cron diário 00:00 Cuiabá atualiza automaticamente
- Botão "Atualizar" on-demand com cache de 1h (massa) / 5min (individual)
- Scraping via Apify (sem Meta API)

## Spec
docs/superpowers/specs/2026-05-25-instagram-posts-counter-design.md

## Migration manual (após merge)
Aplicar `supabase/migrations/20260609000000_client_instagram_snapshots.sql` no SQL Editor.

## Custo
~R$ 26/mês (Apify) — provavelmente cabe no free tier $5.

## Test plan
- [ ] Aplicar migration
- [ ] Cron manual: `curl -H "Authorization: Bearer $CRON_SECRET" https://sistemaacompanha.yidedigital.com.br/api/cron/instagram-snapshots`
- [ ] Sócio: abrir dashboard, ver tabela com clientes elegíveis
- [ ] Apertar "Atualizar" → confere se contagens batem com Instagram real
- [ ] Assessor: dashboard mostra só clientes próprios
- [ ] Cliente sem `instagram_url`: aparece badge "Cadastrar"
- [ ] Cliente de pacote `trafego` NÃO aparece
```

- [ ] **Step 3: Verificar CI**

Aguardar CI verde.

---

## Notas finais

- **Não inventar nomes**: antes de mexer em `DashboardSocioAdm` / `DashboardAssessor`, abrir o arquivo, ver shape das props existentes, seguir convenção.
- **Cron schedule**: `0 4 * * *` em UTC = 00:00 BRT/Cuiabá (UTC-4). Confirmar no `vercel.json`.
- **APIFY_API_TOKEN**: já está cadastrado no Vercel (usado pelo gerador-leads). Não precisa novo.
- **Cache key**: sem `unstable_cache` aqui — queries são server-side direto e revalidam por `router.refresh()`.
- Pacotes elegíveis estão em `PACOTES_ELEGIVEIS` em `tipos.ts`. Pra adicionar mais (ex: futuro `social_only`), alterar lá.
