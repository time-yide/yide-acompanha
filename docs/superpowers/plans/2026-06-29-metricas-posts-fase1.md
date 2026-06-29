# Métricas dos Posts — Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Coletar métricas (alcance, curtidas, comentários, salvamentos, compartilhamentos, engajamento) dos posts publicados via Meta Graph API, guardar no banco e mostrar um selinho por post + botão "Atualizar".

**Architecture:** Funções de insights puras (reusam `metaFetch`) → camada de sync (service-role, upsert) → cron 3x/dia + action manual → query anexa métricas à lista → selinho no `PostsListView`. Tabela nova `social_media_metricas` (snapshot mais recente).

**Tech Stack:** Next.js (App Router, server actions, route handler cron), Supabase (Postgres + RLS), `metaFetch` (Graph API), zod, vitest.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/20260629000000_social_media_metricas.sql` (novo) | Tabela + RLS + índice. Aplicação manual. |
| `src/lib/social-media/meta-publish.ts` (modificar) | Exportar `metaFetch` pra reaproveitar. |
| `src/lib/social-media/meta-insights.ts` (novo) | `getInstagramMediaInsights`, `getFacebookPostInsights`, tipos, `formatCompact`. Puro. |
| `tests/unit/social-meta-insights.test.ts` (novo) | Testa mapeamento + formatCompact com `metaFetch` mockado. |
| `src/lib/social-media/insights-sync.ts` (novo) | `sincronizarMetricasPost`, `sincronizarMetricasPendentes` (service-role + upsert). |
| `src/app/api/cron/social-media-insights-sync/route.ts` (novo) | Cron (auth CRON_SECRET). |
| `vercel.json` (modificar) | + cron 3x/dia. |
| `src/lib/social-media/actions.ts` (modificar) | `atualizarMetricasPostAction`. |
| `src/lib/social-media/queries.ts` (modificar) | Anexar `metricas` em `SocialPostRow`/`listPostsByCliente`. |
| `src/components/social-media/PostsListView.tsx` (modificar) | Selinho + botão "Atualizar métricas". |

---

## Task 1: Migration `social_media_metricas`

**Files:**
- Create: `supabase/migrations/20260629000000_social_media_metricas.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Métricas dos posts (Fase 1). Snapshot do valor mais recente por (post, rede, métrica).
create table if not exists public.social_media_metricas (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_media_posts(id) on delete cascade,
  rede text not null,                 -- 'instagram' | 'facebook'
  metrica text not null,              -- 'alcance' | 'curtidas' | 'comentarios' | 'salvamentos' | 'compartilhamentos' | 'engajamento'
  valor bigint not null default 0,
  coletado_em timestamptz not null default now(),
  unique (post_id, rede, metrica)
);

create index if not exists social_metricas_post_idx
  on public.social_media_metricas(post_id);

alter table public.social_media_metricas enable row level security;

drop policy if exists social_metricas_select on public.social_media_metricas;
create policy social_metricas_select on public.social_media_metricas
  for select to authenticated using (true);

drop policy if exists social_metricas_insert on public.social_media_metricas;
create policy social_metricas_insert on public.social_media_metricas
  for insert to authenticated with check (true);

drop policy if exists social_metricas_update on public.social_media_metricas;
create policy social_metricas_update on public.social_media_metricas
  for update to authenticated using (true);
```

- [ ] **Step 2: Commit (migration aplicada manualmente depois)**

```bash
git add supabase/migrations/20260629000000_social_media_metricas.sql
git commit -m "feat(social-media): migration tabela social_media_metricas (Fase 1)"
```

> A migration roda MANUALMENTE no Supabase SQL Editor após o merge (Vercel não roda migration no deploy).

---

## Task 2: `meta-insights.ts` + testes

**Files:**
- Modify: `src/lib/social-media/meta-publish.ts` (exportar `metaFetch`)
- Create: `src/lib/social-media/meta-insights.ts`
- Test: `tests/unit/social-meta-insights.test.ts`

- [ ] **Step 1: Export `metaFetch` from meta-publish.ts**

Em `src/lib/social-media/meta-publish.ts`, troque `async function metaFetch<` por `export async function metaFetch<` (apenas adicionar `export`).

- [ ] **Step 2: Write the failing test**

```ts
// tests/unit/social-meta-insights.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const metaFetch = vi.fn();
vi.mock("@/lib/social-media/meta-publish", () => ({ metaFetch }));

import {
  getInstagramMediaInsights,
  getFacebookPostInsights,
  formatCompact,
} from "@/lib/social-media/meta-insights";

beforeEach(() => metaFetch.mockReset());

describe("getInstagramMediaInsights", () => {
  it("mapeia a resposta do IG pras chaves em português", async () => {
    metaFetch.mockResolvedValueOnce({
      data: {
        data: [
          { name: "reach", values: [{ value: 1200 }] },
          { name: "likes", values: [{ value: 234 }] },
          { name: "comments", values: [{ value: 12 }] },
          { name: "saved", values: [{ value: 18 }] },
          { name: "shares", values: [{ value: 5 }] },
          { name: "total_interactions", values: [{ value: 269 }] },
        ],
      },
    });
    const r = await getInstagramMediaInsights("media1");
    expect(r).toEqual({
      metricas: { alcance: 1200, curtidas: 234, comentarios: 12, salvamentos: 18, compartilhamentos: 5, engajamento: 269 },
    });
  });

  it("tolera métricas ausentes (grava só as que vieram)", async () => {
    metaFetch.mockResolvedValueOnce({
      data: { data: [{ name: "reach", values: [{ value: 100 }] }] },
    });
    const r = await getInstagramMediaInsights("media1");
    expect(r).toEqual({ metricas: { alcance: 100 } });
  });

  it("repassa erro do Meta", async () => {
    metaFetch.mockResolvedValueOnce({ error: "permissão faltando" });
    const r = await getInstagramMediaInsights("media1");
    expect(r).toHaveProperty("error");
  });
});

describe("getFacebookPostInsights", () => {
  it("mapeia reações/comentários/compartilhamentos + alcance", async () => {
    // 1ª chamada: fields do post
    metaFetch.mockResolvedValueOnce({
      data: {
        reactions: { summary: { total_count: 80 } },
        comments: { summary: { total_count: 9 } },
        shares: { count: 4 },
      },
    });
    // 2ª chamada: insights de alcance
    metaFetch.mockResolvedValueOnce({
      data: { data: [{ name: "post_impressions_unique", values: [{ value: 900 }] }] },
    });
    const r = await getFacebookPostInsights("post1");
    expect(r).toEqual({
      metricas: { curtidas: 80, comentarios: 9, compartilhamentos: 4, alcance: 900 },
    });
  });
});

describe("formatCompact", () => {
  it("formata números grandes", () => {
    expect(formatCompact(1234)).toBe("1.2K");
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(1500000)).toBe("1.5M");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/social-meta-insights.test.ts`
Expected: FAIL — cannot find module `@/lib/social-media/meta-insights`.

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/social-media/meta-insights.ts
// SERVER ONLY: do not import from client components
import { metaFetch } from "./meta-publish";

export type Metrica =
  | "alcance"
  | "curtidas"
  | "comentarios"
  | "salvamentos"
  | "compartilhamentos"
  | "engajamento";

export type PostMetricas = Partial<Record<Metrica, number>>;

export type InsightsResult = { metricas: PostMetricas } | { error: string };

interface IgInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
}

const IG_METRIC_MAP: Record<string, Metrica> = {
  reach: "alcance",
  likes: "curtidas",
  comments: "comentarios",
  saved: "salvamentos",
  shares: "compartilhamentos",
  total_interactions: "engajamento",
};

export async function getInstagramMediaInsights(mediaId: string): Promise<InsightsResult> {
  const res = await metaFetch<IgInsightsResponse>(`/${mediaId}/insights`, {
    body: { metric: "reach,likes,comments,saved,shares,total_interactions" },
  });
  if (res.error || !res.data) return { error: res.error ?? "Sem dados de insights" };

  const metricas: PostMetricas = {};
  for (const item of res.data.data ?? []) {
    const key = IG_METRIC_MAP[item.name];
    const value = item.values?.[0]?.value;
    if (key && typeof value === "number") metricas[key] = value;
  }
  return { metricas };
}

interface FbFieldsResponse {
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}
interface FbInsightsResponse {
  data?: Array<{ name: string; values?: Array<{ value?: number }> }>;
}

export async function getFacebookPostInsights(postId: string): Promise<InsightsResult> {
  const fields = await metaFetch<FbFieldsResponse>(`/${postId}`, {
    body: { fields: "reactions.summary(true),comments.summary(true),shares" },
  });
  if (fields.error || !fields.data) return { error: fields.error ?? "Sem dados do post" };

  const metricas: PostMetricas = {};
  const reacoes = fields.data.reactions?.summary?.total_count;
  const coments = fields.data.comments?.summary?.total_count;
  const compart = fields.data.shares?.count;
  if (typeof reacoes === "number") metricas.curtidas = reacoes;
  if (typeof coments === "number") metricas.comentarios = coments;
  if (typeof compart === "number") metricas.compartilhamentos = compart;

  // Alcance (post_impressions_unique) - chamada separada; tolera falha.
  const ins = await metaFetch<FbInsightsResponse>(`/${postId}/insights`, {
    body: { metric: "post_impressions_unique" },
  });
  if (ins.data) {
    const alcance = ins.data.data?.find((d) => d.name === "post_impressions_unique")?.values?.[0]?.value;
    if (typeof alcance === "number") metricas.alcance = alcance;
  }
  return { metricas };
}

/** 1234 → "1.2K", 1500000 → "1.5M". */
export function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/social-meta-insights.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/social-media/meta-publish.ts src/lib/social-media/meta-insights.ts tests/unit/social-meta-insights.test.ts
git commit -m "feat(social-media): insights IG/FB + formatCompact (puro + testes)"
```

---

## Task 3: Sync (service-role + upsert)

**Files:**
- Create: `src/lib/social-media/insights-sync.ts`

- [ ] **Step 1: Write the sync module**

```ts
// src/lib/social-media/insights-sync.ts
// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getInstagramMediaInsights, getFacebookPostInsights, type PostMetricas } from "./meta-insights";

interface PostParaSync {
  id: string;
  instagram_post_id: string | null;
  facebook_post_id: string | null;
}

async function upsertMetricas(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  postId: string,
  rede: "instagram" | "facebook",
  metricas: PostMetricas,
): Promise<void> {
  const rows = Object.entries(metricas).map(([metrica, valor]) => ({
    post_id: postId,
    rede,
    metrica,
    valor,
    coletado_em: new Date().toISOString(),
  }));
  if (rows.length === 0) return;
  await sb.from("social_media_metricas").upsert(rows, { onConflict: "post_id,rede,metrica" });
}

/** Sincroniza métricas de 1 post (IG e/ou FB). Retorna quantas redes deram certo. */
export async function sincronizarMetricasPost(postId: string): Promise<{ ok: number; erros: string[] }> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: post } = await sbAny
    .from("social_media_posts")
    .select("id, instagram_post_id, facebook_post_id")
    .eq("id", postId)
    .single();
  if (!post) return { ok: 0, erros: ["Post não encontrado"] };
  const p = post as PostParaSync;

  let ok = 0;
  const erros: string[] = [];

  if (p.instagram_post_id) {
    const r = await getInstagramMediaInsights(p.instagram_post_id);
    if ("error" in r) erros.push(`IG: ${r.error}`);
    else { await upsertMetricas(sbAny, postId, "instagram", r.metricas); ok++; }
  }
  if (p.facebook_post_id) {
    const r = await getFacebookPostInsights(p.facebook_post_id);
    if ("error" in r) erros.push(`FB: ${r.error}`);
    else { await upsertMetricas(sbAny, postId, "facebook", r.metricas); ok++; }
  }
  return { ok, erros };
}

/** Sincroniza posts publicados recentes (últimos 30 dias). Usado pelo cron. */
export async function sincronizarMetricasPendentes(limit = 50): Promise<{ checked: number; ok: number }> {
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: posts } = await sbAny
    .from("social_media_posts")
    .select("id, instagram_post_id, facebook_post_id, publicado_em")
    .eq("status", "publicado")
    .is("archived_at", null)
    .gte("publicado_em", desde)
    .limit(limit);

  const lista = (posts ?? []) as Array<PostParaSync & { publicado_em: string | null }>;
  let ok = 0;
  for (const p of lista) {
    if (!p.instagram_post_id && !p.facebook_post_id) continue;
    const r = await sincronizarMetricasPost(p.id);
    if (r.ok > 0) ok++;
  }
  return { checked: lista.length, ok };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "insights-sync|meta-insights" || echo "OK"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/lib/social-media/insights-sync.ts
git commit -m "feat(social-media): sync de métricas (service-role + upsert)"
```

---

## Task 4: Cron + vercel.json

**Files:**
- Create: `src/app/api/cron/social-media-insights-sync/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write the cron route**

```ts
// src/app/api/cron/social-media-insights-sync/route.ts
import { NextResponse } from "next/server";
import { sincronizarMetricasPendentes } from "@/lib/social-media/insights-sync";

export const dynamic = "force-dynamic";

/**
 * Cron de coleta de métricas dos posts publicados (IG/FB).
 * Roda 3x/dia via vercel.json. Auth: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const r = await sincronizarMetricasPendentes(50);
  return NextResponse.json({ success: true, ...r });
}
```

- [ ] **Step 2: Add cron to vercel.json**

Em `vercel.json`, dentro do array `"crons"`, adicione (depois da linha do `social-media-publish`):

```json
    { "path": "/api/cron/social-media-insights-sync", "schedule": "0 11,17,23 * * *" },
```

(Garanta vírgula correta no JSON.)

- [ ] **Step 3: Typecheck + JSON válido**

Run: `npx tsc --noEmit 2>&1 | grep -E "insights-sync/route" || echo "OK"`
Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('json ok')"`
Expected: `OK` e `json ok`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/social-media-insights-sync/route.ts vercel.json
git commit -m "feat(social-media): cron de métricas 3x/dia"
```

---

## Task 5: Action manual `atualizarMetricasPostAction`

**Files:**
- Modify: `src/lib/social-media/actions.ts`

- [ ] **Step 1: Add import (topo, junto aos outros)**

```ts
import { sincronizarMetricasPost } from "./insights-sync";
```

- [ ] **Step 2: Add the action at the end of the file**

```ts
// ===========================================================================
// Atualizar métricas de um post sob demanda (botão na UI)
// ===========================================================================

const atualizarMetricasSchema = z.object({ post_id: uuidLike });

export async function atualizarMetricasPostAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = atualizarMetricasSchema.safeParse({ post_id: fd(formData, "post_id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const r = await sincronizarMetricasPost(parsed.data.post_id);
  if (r.ok === 0 && r.erros.length > 0) return { error: r.erros.join(" | ") };

  // Descobre o client_id pra revalidar a página certa.
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("social_media_posts")
    .select("client_id")
    .eq("id", parsed.data.post_id)
    .single();
  if (data?.client_id) revalidatePath(`/social-media/${data.client_id}`);
  return { success: true };
}
```

> `ActionResult`, `uuidLike`, `canManage`, `fd`, `createClient`, `requireAuth`, `revalidatePath`, `z` já existem no arquivo.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "social-media/actions" || echo "OK"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/lib/social-media/actions.ts
git commit -m "feat(social-media): action atualizar métricas sob demanda"
```

---

## Task 6: Anexar métricas na lista + selinho na UI

**Files:**
- Modify: `src/lib/social-media/queries.ts`
- Modify: `src/components/social-media/PostsListView.tsx`

- [ ] **Step 1: Add `metricas` ao tipo e à query**

Em `src/lib/social-media/queries.ts`:

1. Logo antes de `export interface SocialPostRow {`, adicione o tipo importado e a interface auxiliar:

```ts
export interface PostMetricasResumo {
  alcance: number;
  curtidas: number;
  comentarios: number;
  salvamentos: number;
  compartilhamentos: number;
  engajamento: number;
}
```

2. Dentro de `interface SocialPostRow {`, adicione antes do fecho `}`:

```ts
  metricas: PostMetricasResumo | null;
```

3. Em `listPostsByCliente`, depois de montar o array mapeado (a const `return (...).map(...)`), troque o `return` direto por: guardar em `const posts = (...).map(...)`, buscar as métricas e anexar. Substitua o bloco `return ((data ?? []) as Array<...>).map((row) => ({ ... }));` por:

```ts
  const posts = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    client_id: row.client_id as string,
    titulo: (row.titulo as string | null) ?? null,
    legenda: (row.legenda as string | null) ?? null,
    primeiro_comentario: (row.primeiro_comentario as string | null) ?? null,
    hashtags: (row.hashtags as string | null) ?? null,
    formato: row.formato as string,
    redes: Array.isArray(row.redes) ? (row.redes as string[]) : [],
    midias: Array.isArray(row.midias) ? (row.midias as string[]) : [],
    agendar_para: (row.agendar_para as string | null) ?? null,
    status: row.status as string,
    observacoes: (row.observacoes as string | null) ?? null,
    ajuste_observacoes: (row.ajuste_observacoes as string | null) ?? null,
    aprovado_em: (row.aprovado_em as string | null) ?? null,
    aprovacao_token: (row.aprovacao_token as string | null) ?? null,
    design_arte_id: (row.design_arte_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    metricas: null as PostMetricasResumo | null,
  }));

  // Anexa métricas (soma das redes por métrica). Tolera tabela ausente (migration não rodada).
  const ids = posts.map((p) => p.id);
  if (ids.length > 0) {
    const { data: mets, error: metErr } = await sb
      .from("social_media_metricas")
      .select("post_id, metrica, valor")
      .in("post_id", ids);
    if (!metErr && mets) {
      const acc: Record<string, PostMetricasResumo> = {};
      for (const m of mets as Array<{ post_id: string; metrica: string; valor: number }>) {
        const r = (acc[m.post_id] ??= {
          alcance: 0, curtidas: 0, comentarios: 0, salvamentos: 0, compartilhamentos: 0, engajamento: 0,
        });
        if (m.metrica in r) (r as unknown as Record<string, number>)[m.metrica] += Number(m.valor) || 0;
      }
      for (const p of posts) p.metricas = acc[p.id] ?? null;
    }
  }

  return posts;
```

- [ ] **Step 2: Add selinho + botão no PostsListView**

Em `src/components/social-media/PostsListView.tsx`:

1. No import do `lucide-react`, troque por:

```ts
import { Pencil, Archive, ImageIcon, BarChart3 } from "lucide-react";
```

2. No import de actions, adicione `atualizarMetricasPostAction`:

```ts
import {
  archiveSocialPostAction, changeSocialPostStatusAction, atualizarMetricasPostAction,
} from "@/lib/social-media/actions";
```

3. Adicione o import do helper:

```ts
import { formatCompact } from "@/lib/social-media/meta-insights";
```

4. Dentro de `PostListItem`, junto dos outros `useTransition`, adicione:

```ts
  const [pendingMetricas, startMetricas] = useTransition();
```

5. Dentro de `PostListItem`, antes do `return (`, adicione o handler:

```ts
  function atualizarMetricas() {
    const fd = new FormData();
    fd.set("post_id", post.id);
    startMetricas(async () => {
      await atualizarMetricasPostAction(fd);
    });
  }
```

6. No bloco de conteúdo, logo DEPOIS do `<p>` da legenda (o `{(post.titulo || post.legenda) && (...)}`) e ainda dentro da `<div className="flex-1 min-w-0 space-y-1">`, adicione o selinho (só pra publicados):

```tsx
        {post.status === "publicado" && (
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {post.metricas ? (
              <span className="inline-flex items-center gap-2">
                <span title="Alcance">👁 {formatCompact(post.metricas.alcance)}</span>
                <span title="Curtidas">❤️ {formatCompact(post.metricas.curtidas)}</span>
                <span title="Comentários">💬 {formatCompact(post.metricas.comentarios)}</span>
                <span title="Salvamentos">🔖 {formatCompact(post.metricas.salvamentos)}</span>
                <span title="Compartilhamentos">🔁 {formatCompact(post.metricas.compartilhamentos)}</span>
              </span>
            ) : (
              <span>Sem métricas ainda —</span>
            )}
            {canManage && (
              <button
                type="button"
                onClick={atualizarMetricas}
                disabled={pendingMetricas}
                className="inline-flex items-center gap-1 rounded-md border bg-card px-1.5 py-0.5 hover:bg-muted disabled:opacity-50"
                title="Atualizar métricas"
              >
                <BarChart3 className="h-3 w-3" />
                {pendingMetricas ? "Atualizando..." : "Atualizar métricas"}
              </button>
            )}
          </div>
        )}
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "queries|PostsListView|meta-insights" || echo "tsc OK"`
Run: `npx eslint src/lib/social-media/queries.ts src/components/social-media/PostsListView.tsx src/lib/social-media/meta-insights.ts src/lib/social-media/insights-sync.ts src/lib/social-media/actions.ts src/app/api/cron/social-media-insights-sync/route.ts`
Expected: `tsc OK` e lint sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/social-media/queries.ts src/components/social-media/PostsListView.tsx
git commit -m "feat(social-media): selinho de métricas no post + botão atualizar"
```

---

## Task 7: Verificação final + PR

- [ ] **Step 1: Testes**

Run: `npx vitest run tests/unit/social-meta-insights.test.ts`
Expected: passa.

- [ ] **Step 2: Lint geral dos arquivos tocados** (ver Task 6 Step 3) — sem erros.

- [ ] **Step 3: Push + PR** (corpo destacando: migration manual + permissão `instagram_manage_insights`).

```bash
git push -u origin feat/social-metricas
gh pr create --title "feat(social-media): métricas dos posts (Fase 1)" --body "..."
```

- [ ] **Step 4: Esperar CI verde. Merge fica com a usuária (preferência dela). Lembrar: rodar a migration no Supabase + adicionar instagram_manage_insights na chave.**

---

## Self-Review (preenchido)

- **Spec coverage:** 6 métricas → IG/FB map; coleta 3x/dia → cron; selinho → Task 6; botão atualizar → Task 5+6; snapshot table → Task 1; interno → RLS authenticated; tolera token sem insights / migration ausente → fallbacks nas queries e sync. ✓
- **Placeholders:** corpo do PR é "..." (preenchido na hora do gh pr create) — único ponto livre, intencional. Resto com código completo. ✓
- **Type consistency:** `PostMetricas` (meta-insights) vs `PostMetricasResumo` (queries, sempre 6 campos preenchidos pra UI) — nomes distintos de propósito; `Metrica` keys batem com as colunas `metrica` da tabela e com IG_METRIC_MAP. ✓
