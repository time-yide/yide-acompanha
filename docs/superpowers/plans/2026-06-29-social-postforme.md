# TikTok/YouTube/LinkedIn via Post for Me — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Publicar/agendar em TikTok, YouTube e LinkedIn via Post for Me, reusando compositor/cron, com camada trocável e contas conectadas por cliente.

**Architecture:** Cliente HTTP `postforme.ts` (server-only) → publisher por rede em `publish-actions` (Meta nativo p/ IG/FB; Post for Me p/ TikTok/YT/LinkedIn) → contas por cliente em `client_postforme_accounts` → conectar/desconectar no `AccountsModal` (auth-url + re-list). Sem verificação live aqui (mocked); validação real no preview.

**Tech Stack:** Next 16/React 19, Supabase, `fetch`, zod, vitest.

> ⚠️ **Campos da API fixados por melhor-esforço (Go SDK: `caption`, `social_accounts`, `media`).** O `auth-url` e a captura da conta usam abordagem robusta (re-list após autorizar). Ajustes finos no preview com erro real.

---

## File Structure

| Arquivo | Papel |
|---|---|
| `supabase/migrations/20260629120000_client_postforme_accounts.sql` (novo) | Tabela contas por cliente+rede. Manual. |
| `src/lib/social-media/postforme.ts` (novo) | Cliente HTTP: pfmFetch, gerarAuthUrl, listarContas, publicar, getResultado. |
| `src/lib/social-media/postforme-validate.ts` (novo) | `validarFormatoPorRede(redes, midias)` (puro). |
| `tests/unit/social-postforme.test.ts` (novo) | Testa publicar (mock fetch) + validação. |
| `src/lib/social-media/tipos.ts` (mod) | + `tiktok`,`youtube`; ativar `linkedin`. |
| `src/lib/social-media/postforme-actions.ts` (novo) | actions: conectar (auth-url), capturar/listar, desconectar (service-role). |
| `src/lib/social-media/publish-actions.ts` (mod) | fan-out: redes PFM → publicar via Post for Me. |
| `src/components/social-media/AccountsModal.tsx` (mod) | seção "Outras redes (Post for Me)". |
| `src/lib/social-media/queries.ts` (mod) | carregar contas PFM do cliente pro modal. |

---

## Task 1: Migration

- Create: `supabase/migrations/20260629120000_client_postforme_accounts.sql`

```sql
create table if not exists public.client_postforme_accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  plataforma text not null check (plataforma in ('tiktok','youtube','linkedin')),
  account_id text not null,
  username text,
  conectado_em timestamptz not null default now(),
  unique (client_id, plataforma)
);
create index if not exists client_pfm_client_idx on public.client_postforme_accounts(client_id);
alter table public.client_postforme_accounts enable row level security;
drop policy if exists client_pfm_select on public.client_postforme_accounts;
create policy client_pfm_select on public.client_postforme_accounts for select to authenticated using (true);
drop policy if exists client_pfm_insert on public.client_postforme_accounts;
create policy client_pfm_insert on public.client_postforme_accounts for insert to authenticated with check (true);
drop policy if exists client_pfm_update on public.client_postforme_accounts;
create policy client_pfm_update on public.client_postforme_accounts for update to authenticated using (true);
drop policy if exists client_pfm_delete on public.client_postforme_accounts;
create policy client_pfm_delete on public.client_postforme_accounts for delete to authenticated using (true);
```

Commit: `feat(social-media): migration client_postforme_accounts`.

---

## Task 2: Cliente HTTP + validação + testes

- Create `src/lib/social-media/postforme.ts`:

```ts
// SERVER ONLY
const PFM_BASE = "https://api.postforme.dev/v1";

function getKey(): string | null {
  return process.env.POST_FOR_ME_API_KEY || null;
}

export interface PfmResult<T> { data?: T; error?: string; }

export async function pfmFetch<T = unknown>(
  path: string,
  opts: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {},
): Promise<PfmResult<T>> {
  const key = getKey();
  if (!key) return { error: "POST_FOR_ME_API_KEY não configurado no Vercel" };
  try {
    const res = await fetch(`${PFM_BASE}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const msg = (json?.error as string) || (json?.message as string) || `HTTP ${res.status}`;
      return { error: msg };
    }
    return { data: json as T };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro de rede (Post for Me)" };
  }
}

export type PfmPlatform = "tiktok" | "youtube" | "linkedin";

export interface PfmAccount { id: string; platform: string; username?: string | null; }

/** Gera URL de OAuth pra conectar uma conta da plataforma. */
export async function gerarAuthUrl(platform: PfmPlatform, externalId: string): Promise<PfmResult<{ url: string }>> {
  return pfmFetch<{ url: string }>("/social-accounts/auth-url", {
    method: "POST",
    body: { platform, external_id: externalId },
  });
}

/** Lista contas conectadas (opcional filtro por plataforma). */
export async function listarContas(): Promise<PfmResult<{ data: PfmAccount[] }>> {
  return pfmFetch<{ data: PfmAccount[] }>("/social-accounts");
}

/** Publica nas contas dadas. */
export async function publicarPostforme(args: {
  accountIds: string[];
  caption: string;
  mediaUrls: string[];
}): Promise<PfmResult<{ id: string }>> {
  if (args.accountIds.length === 0) return { error: "Sem contas conectadas" };
  return pfmFetch<{ id: string }>("/social-posts", {
    method: "POST",
    body: {
      caption: args.caption,
      social_accounts: args.accountIds,
      media: args.mediaUrls.map((url) => ({ url })),
    },
  });
}
```

- Create `src/lib/social-media/postforme-validate.ts`:

```ts
const SO_VIDEO = new Set(["tiktok", "youtube"]);

function ehVideo(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

/** Retorna erro (string) se a combinação rede+mídia for inválida, ou null se ok. */
export function validarFormatoPorRede(redes: string[], midias: string[]): string | null {
  const temVideo = midias.some(ehVideo);
  for (const r of redes) {
    if (SO_VIDEO.has(r) && !temVideo) {
      return `${r === "tiktok" ? "TikTok" : "YouTube"} exige um vídeo no post.`;
    }
  }
  return null;
}
```

- Create `tests/unit/social-postforme.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { validarFormatoPorRede } from "@/lib/social-media/postforme-validate";

describe("validarFormatoPorRede", () => {
  it("TikTok sem vídeo → erro", () => {
    expect(validarFormatoPorRede(["tiktok"], ["a.jpg"])).toMatch(/TikTok/);
  });
  it("YouTube com vídeo → ok", () => {
    expect(validarFormatoPorRede(["youtube"], ["v.mp4"])).toBeNull();
  });
  it("LinkedIn com imagem → ok", () => {
    expect(validarFormatoPorRede(["linkedin"], ["a.jpg"])).toBeNull();
  });
});

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); process.env.POST_FOR_ME_API_KEY = "k"; });

describe("publicarPostforme", () => {
  it("monta o request certo e retorna id", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: "sp_1" }) });
    const { publicarPostforme } = await import("@/lib/social-media/postforme");
    const r = await publicarPostforme({ accountIds: ["sa_1"], caption: "oi", mediaUrls: ["v.mp4"] });
    expect(r.data?.id).toBe("sp_1");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.social_accounts).toEqual(["sa_1"]);
    expect(body.media).toEqual([{ url: "v.mp4" }]);
  });
  it("erro da API → retorna error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "bad" }) });
    const { publicarPostforme } = await import("@/lib/social-media/postforme");
    const r = await publicarPostforme({ accountIds: ["sa_1"], caption: "x", mediaUrls: [] });
    expect(r.error).toBeTruthy();
  });
});
```

Run: `npx vitest run tests/unit/social-postforme.test.ts` → PASS. Commit.

---

## Task 3: tipos.ts — novas redes

Em `src/lib/social-media/tipos.ts`:
- `export type Rede = "instagram" | "facebook" | "linkedin" | "gmn" | "tiktok" | "youtube";`
- No array `REDES`, tirar `comingSoon: true` do `linkedin`; adicionar entradas pra `tiktok` e `youtube` (sem comingSoon). Manter `gmn` com `comingSoon: true`.

```ts
  { value: "tiktok", label: "TikTok", color: "border-foreground/30 bg-foreground/10 text-foreground" },
  { value: "youtube", label: "YouTube", color: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" },
```

Também atualizar `REDES_VALIDAS` em `actions.ts` (se existir lista separada) pra incluir tiktok/youtube.

Commit.

---

## Task 4: Conectar/desconectar (actions) + carregar no modal

- Create `src/lib/social-media/postforme-actions.ts` (`"use server"`):
  - `iniciarConexaoAction(clientId, plataforma)` → `gerarAuthUrl(plataforma, clientId)` → retorna `{ url }`.
  - `capturarConexaoAction(clientId, plataforma)` → `listarContas()` → acha a conta da plataforma recém-conectada (por plataforma; se a API devolver `external_id`=clientId, casa por isso) → upsert em `client_postforme_accounts` (service-role) → revalida.
  - `desconectarPfmAction(clientId, plataforma)` → disconnect na API + delete na tabela.
  - Permissão `canManage` em todas.
- `queries.ts`: em `getClienteSocial`, também buscar `client_postforme_accounts` do cliente e devolver `pfmAccounts: {plataforma, username}[]`.

Commit.

---

## Task 5: Publish fan-out (Post for Me)

Em `publish-actions.ts` (`publishPostById`): depois do bloco Meta (IG/FB), adicionar bloco pras redes PFM:
- Pra cada rede em `['tiktok','youtube','linkedin']` presente em `p.redes`:
  - Busca a conta do cliente em `client_postforme_accounts` (service-role). Se faltar → erro "conecte o {rede} do cliente".
  - Junta os account_ids das redes PFM marcadas → chama `publicarPostforme({ accountIds, caption: legenda+hashtags, mediaUrls: midias })` UMA vez.
  - Marca sucesso/erro por rede no resultado.
- `qualquerSucesso` considera também as redes PFM.

Commit.

---

## Task 6: UI no AccountsModal

Em `AccountsModal.tsx`, seção nova "Outras redes (via Post for Me)":
- Pra cada rede (TikTok/YouTube/LinkedIn): se conectada (vem em `initial.pfmAccounts`), mostra "✓ @user" + botão "Desconectar"; senão botão "Conectar".
- "Conectar" → chama `iniciarConexaoAction` → `window.open(url)` → após o usuário voltar, botão "Já autorizei → confirmar" que chama `capturarConexaoAction` (re-list). (Abordagem robusta sem depender de callback.)
- "Desconectar" → `desconectarPfmAction`.

Commit.

---

## Task 7: Verificação + PR

- `npx vitest run tests/unit/social-postforme.test.ts`; `npx tsc --noEmit | grep <arquivos>`; `npx eslint <arquivos>`.
- Push + PR com corpo destacando: **migration manual**, **POST_FOR_ME_API_KEY já no Vercel**, e **validação live no preview (pode precisar de ajuste fino de campos)**.
- Merge fica com a usuária.

---

## Self-Review
- Cobre: 3 redes (tipos), conectar (auth-url+relist), publicar (fan-out), validação formato, tabela, sem-key→erro. ✓
- Risco live: auth-url params / captura — mitigado por re-list + confirmação manual; ajuste no preview. ✓
- Tipos: PfmPlatform/PfmAccount consistentes; redes string casam com checks da migration. ✓
