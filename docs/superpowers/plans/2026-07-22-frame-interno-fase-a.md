# Frame Interno — Fase A (interno) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Review de vídeo interno: editor cria um review e sobe o vídeo (direto pro Bunny Stream), o time assiste num player de qualidade e comenta no tempo, sobem novas versões, e alguém aprova internamente. Substitui o vídeo no grupo do WhatsApp.

**Architecture:** Vídeo hospedado no **Bunny Stream** (upload direto do browser via TUS com assinatura gerada no server; player HLS via `hls.js`). Metadados no Supabase (review, versões, comentários). Máquina de status pura/testada. Spec: `docs/superpowers/specs/2026-07-21-frame-interno-design.md`. **Fase B (cliente) é um plano separado.**

**Tech Stack:** Next.js App Router, Bunny Stream API, `hls.js`, `tus-js-client`, Supabase service-role, vitest.

> **PRÉ-REQUISITO (não bloqueia o build, bloqueia o teste):** conta Bunny Stream → Stream Library → `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_CDN_HOSTNAME`. Guia em Task 1. Sem isso o módulo mostra aviso de setup.

---

## File structure
- Create `docs/frame-interno-bunny-setup.md`.
- Modify `src/lib/env.ts` — vars Bunny.
- Modify `package.json` — `hls.js`, `tus-js-client`.
- Create `supabase/migrations/20260722000000_review_video.sql` (manual).
- Create `src/lib/review/schema.ts` (+ `.test.ts`) — tipos + máquina de status.
- Create `src/lib/bunny/client.ts` — API Bunny + URLs + assinatura de upload.
- Create `src/lib/review/queries.ts` — listar, carregar review.
- Create `src/lib/review/actions.ts` — criar, registrar versão, comentar, resolver, aprovar interno.
- Modify `src/lib/auth/permissions.ts` — `manage:review`.
- Create `src/components/review/UploadVersao.tsx` — upload direto pro Bunny.
- Create `src/components/review/Player.tsx` — player hls.js.
- Create `src/components/review/Comentarios.tsx` — comentários no tempo.
- Create `src/components/review/ReviewView.tsx` — junta player + comentários + versões.
- Create `src/app/(authed)/audiovisual/review/page.tsx` — lista.
- Create `src/app/(authed)/audiovisual/review/[id]/page.tsx` — review.
- Create `src/app/(authed)/audiovisual/review/novo/page.tsx` — criar.

---

## Task 1: env + deps + setup doc

**Files:** Create `docs/frame-interno-bunny-setup.md`; Modify `src/lib/env.ts`, `package.json`

- [ ] **Step 1: Setup doc** — `docs/frame-interno-bunny-setup.md`
```markdown
# Setup — Frame Interno (Bunny Stream)

1. Crie conta em https://bunny.net → menu **Stream** → **Add Video Library** (ex.: "Yide Reviews").
2. Na library → aba **API** → copie a **API Key** e o **Library ID**.
3. Na aba **Encoding/Player**, copie o **CDN Hostname** (ex.: `vz-xxxx.b-cdn.net`).
4. Setar no `.env.local` e no Vercel:
   - `BUNNY_STREAM_API_KEY`
   - `BUNNY_STREAM_LIBRARY_ID`
   - `BUNNY_STREAM_CDN_HOSTNAME`  (só o host, sem https://)
```

- [ ] **Step 2: env** — no `serverSchema` de `src/lib/env.ts`, antes do fechamento:
```ts
  // Frame Interno (review de vídeo) — Bunny Stream. Sem isso, /audiovisual/review
  // mostra aviso de setup. Guia: docs/frame-interno-bunny-setup.md
  BUNNY_STREAM_API_KEY: z.string().optional(),
  BUNNY_STREAM_LIBRARY_ID: z.string().optional(),
  BUNNY_STREAM_CDN_HOSTNAME: z.string().optional(),
```

- [ ] **Step 3: deps**
Run: `npm install hls.js tus-js-client`
Expected: adiciona ambos em dependencies.

- [ ] **Step 4: Type-check**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && echo OK` → `OK`.

- [ ] **Step 5: Commit**
```bash
git add docs/frame-interno-bunny-setup.md src/lib/env.ts package.json package-lock.json
git commit -m "feat(frame-interno): setup Bunny + env + deps (hls.js, tus)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Migration (manual)

**Files:** Create `supabase/migrations/20260722000000_review_video.sql`

- [ ] **Step 1: Escrever**
```sql
-- Frame Interno (Fase A). Aplicação MANUAL no SQL Editor após o merge.
create type public.review_status as enum ('revisao_interna', 'revisao_cliente', 'ajustes', 'aprovado');
create type public.review_autor_tipo as enum ('time', 'cliente');

create table public.review_video (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  cliente_id uuid references public.clientes(id),
  titulo text not null,
  status public.review_status not null default 'revisao_interna',
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index review_video_cliente_idx on public.review_video(cliente_id);
create index review_video_status_idx on public.review_video(status);

create table public.review_versao (
  id uuid primary key default gen_random_uuid(),
  review_video_id uuid not null references public.review_video(id) on delete cascade,
  numero int not null,
  bunny_video_id text not null,
  pronto boolean not null default false,
  duracao_seg int,
  criado_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (review_video_id, numero)
);
create index review_versao_review_idx on public.review_versao(review_video_id);

create table public.review_comentario (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.review_versao(id) on delete cascade,
  autor_tipo public.review_autor_tipo not null,
  autor_id uuid references public.profiles(id),
  autor_nome text not null,
  tempo_seg int not null default 0,
  corpo text not null,
  resolvido boolean not null default false,
  created_at timestamptz not null default now()
);
create index review_comentario_versao_idx on public.review_comentario(versao_id);

alter table public.review_video enable row level security;
alter table public.review_versao enable row level security;
alter table public.review_comentario enable row level security;
create policy review_video_read on public.review_video for select to authenticated using (true);
create policy review_versao_read on public.review_versao for select to authenticated using (true);
create policy review_comentario_read on public.review_comentario for select to authenticated using (true);
```

- [ ] **Step 2: Commit**
```bash
git add supabase/migrations/20260722000000_review_video.sql
git commit -m "feat(frame-interno): migration review_video/versao/comentario (manual)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Máquina de status (TDD)

**Files:** Create `src/lib/review/schema.ts` + `.test.ts`

- [ ] **Step 1: Teste que falha** — `src/lib/review/schema.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { podeTransicionar, type ReviewStatus } from "./schema";

describe("podeTransicionar", () => {
  it("interno → cliente é válido (aprovação interna)", () => {
    expect(podeTransicionar("revisao_interna", "revisao_cliente")).toBe(true);
  });
  it("cliente → aprovado e cliente → ajustes são válidos", () => {
    expect(podeTransicionar("revisao_cliente", "aprovado")).toBe(true);
    expect(podeTransicionar("revisao_cliente", "ajustes")).toBe(true);
  });
  it("ajustes → cliente (nova versão reenviada) é válido", () => {
    expect(podeTransicionar("ajustes", "revisao_cliente")).toBe(true);
  });
  it("aprovado é final — não sai dele", () => {
    expect(podeTransicionar("aprovado", "revisao_interna")).toBe(false);
  });
  it("pulos inválidos são bloqueados", () => {
    expect(podeTransicionar("revisao_interna", "aprovado")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**
Run: `npx vitest run src/lib/review/schema.test.ts --exclude '**/.claude/**'` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/review/schema.ts`
```ts
export type ReviewStatus = "revisao_interna" | "revisao_cliente" | "ajustes" | "aprovado";
export type AutorTipo = "time" | "cliente";

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  revisao_interna: "Em revisão interna",
  revisao_cliente: "Em revisão do cliente",
  ajustes: "Ajustes solicitados",
  aprovado: "Aprovado",
};

const TRANSICOES: Record<ReviewStatus, ReviewStatus[]> = {
  revisao_interna: ["revisao_cliente"],
  revisao_cliente: ["aprovado", "ajustes"],
  ajustes: ["revisao_cliente"],
  aprovado: [],
};

export function podeTransicionar(de: ReviewStatus, para: ReviewStatus): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
```

- [ ] **Step 4: Rodar e ver passar**
Run: `npx vitest run src/lib/review/schema.test.ts --exclude '**/.claude/**'` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/review/schema.ts src/lib/review/schema.test.ts
git commit -m "feat(frame-interno): máquina de status (transições)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Cliente Bunny

**Files:** Create `src/lib/bunny/client.ts`

- [ ] **Step 1: Implementar**
```ts
import { createHash } from "node:crypto";
import { getServerEnv } from "@/lib/env";

const BASE = "https://video.bunnycdn.com";

function creds() {
  const env = getServerEnv();
  if (!env.BUNNY_STREAM_API_KEY || !env.BUNNY_STREAM_LIBRARY_ID || !env.BUNNY_STREAM_CDN_HOSTNAME) {
    throw new Error("BUNNY_NAO_CONFIGURADO");
  }
  return {
    apiKey: env.BUNNY_STREAM_API_KEY,
    libraryId: env.BUNNY_STREAM_LIBRARY_ID,
    cdn: env.BUNNY_STREAM_CDN_HOSTNAME,
  };
}

/** Cria um vídeo (vazio) no Bunny e devolve o GUID. */
export async function criarVideo(titulo: string): Promise<string> {
  const { apiKey, libraryId } = creds();
  const resp = await fetch(`${BASE}/library/${libraryId}/videos`, {
    method: "POST",
    headers: { AccessKey: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ title: titulo }),
  });
  if (!resp.ok) throw new Error(`BUNNY_CRIAR_FALHOU:${resp.status}`);
  const data = (await resp.json()) as { guid: string };
  return data.guid;
}

export interface UploadTus {
  endpoint: string;
  libraryId: string;
  videoId: string;
  signature: string;
  expiration: number;
}

/** Gera os parâmetros de upload TUS assinados pro browser enviar direto ao Bunny. */
export function assinaturaUpload(videoId: string): UploadTus {
  const { apiKey, libraryId } = creds();
  // expira em 2h
  const expiration = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  const signature = createHash("sha256")
    .update(libraryId + apiKey + expiration + videoId)
    .digest("hex");
  return { endpoint: `${BASE}/tusupload`, libraryId, videoId, signature, expiration };
}

/** Status do vídeo (4 = pronto pra tocar). */
export async function statusVideo(videoId: string): Promise<{ pronto: boolean; duracaoSeg: number }> {
  const { apiKey, libraryId } = creds();
  const resp = await fetch(`${BASE}/library/${libraryId}/videos/${videoId}`, {
    headers: { AccessKey: apiKey },
  });
  if (!resp.ok) throw new Error(`BUNNY_STATUS_FALHOU:${resp.status}`);
  const data = (await resp.json()) as { status: number; length: number };
  return { pronto: data.status >= 4, duracaoSeg: Math.round(data.length ?? 0) };
}

export function urlPlaylist(videoId: string): string {
  return `https://${creds().cdn}/${videoId}/playlist.m3u8`;
}
export function urlThumbnail(videoId: string): string {
  return `https://${creds().cdn}/${videoId}/thumbnail.jpg`;
}
```

- [ ] **Step 2: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/lib/bunny/client.ts && echo OK` → `OK`.

- [ ] **Step 3: Commit**
```bash
git add src/lib/bunny/client.ts
git commit -m "feat(frame-interno): cliente Bunny (criar/assinar/status/urls)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Permissão + queries + actions

**Files:** Modify `src/lib/auth/permissions.ts`; Create `src/lib/review/queries.ts`, `src/lib/review/actions.ts`

- [ ] **Step 1: Permissão** — em `permissions.ts`: adicionar `"manage:review"` ao union `Action` e incluir nos roles `adm, socio, coordenador, audiovisual_chefe, videomaker, editor, fast_midia, designer`.

- [ ] **Step 2: queries** — `src/lib/review/queries.ts`
```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { urlPlaylist, urlThumbnail } from "@/lib/bunny/client";
import type { ReviewStatus, AutorTipo } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface ReviewListItem { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; created_at: string }
export interface Comentario { id: string; autor_tipo: AutorTipo; autor_nome: string; tempo_seg: number; corpo: string; resolvido: boolean; created_at: string }
export interface Versao { id: string; numero: number; bunny_video_id: string; pronto: boolean; playlistUrl: string; thumbUrl: string; comentarios: Comentario[] }
export interface ReviewFull { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; versoes: Versao[] }

export async function listarReviews(): Promise<ReviewListItem[]> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("review_video")
    .select("id, titulo, status, created_at, clientes(nome)")
    .order("created_at", { ascending: false });
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, titulo: r.titulo, status: r.status, created_at: r.created_at,
    clienteNome: r.clientes?.nome ?? null,
  }));
}

export async function carregarReview(id: string): Promise<ReviewFull | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb
    .from("review_video")
    .select("id, titulo, status, clientes(nome)")
    .eq("id", id)
    .maybeSingle();
  if (!rv) return null;
  const { data: versoes } = await sb
    .from("review_versao")
    .select("id, numero, bunny_video_id, pronto")
    .eq("review_video_id", id)
    .order("numero", { ascending: true });
  const vs = (versoes ?? []) as any[];
  const versaoIds = vs.map((v) => v.id);
  const { data: coments } = versaoIds.length
    ? await sb.from("review_comentario").select("id, versao_id, autor_tipo, autor_nome, tempo_seg, corpo, resolvido, created_at").in("versao_id", versaoIds).order("tempo_seg", { ascending: true })
    : { data: [] };
  const porVersao = new Map<string, Comentario[]>();
  for (const c of (coments ?? []) as any[]) {
    const arr = porVersao.get(c.versao_id) ?? [];
    arr.push(c);
    porVersao.set(c.versao_id, arr);
  }
  return {
    id: rv.id, titulo: rv.titulo, status: rv.status, clienteNome: (rv as any).clientes?.nome ?? null,
    versoes: vs.map((v) => ({
      id: v.id, numero: v.numero, bunny_video_id: v.bunny_video_id, pronto: v.pronto,
      playlistUrl: urlPlaylist(v.bunny_video_id), thumbUrl: urlThumbnail(v.bunny_video_id),
      comentarios: porVersao.get(v.id) ?? [],
    })),
  };
}
```

- [ ] **Step 3: actions** — `src/lib/review/actions.ts`
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { criarVideo, assinaturaUpload, statusVideo, type UploadTus } from "@/lib/bunny/client";
import { podeTransicionar, type ReviewStatus } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

function pode(role: string) { return canAccess(role, "manage:review"); }

/** Cria o review + o primeiro vídeo no Bunny; devolve os dados de upload TUS. */
export async function criarReviewAction(titulo: string, clienteId: string | null): Promise<Res<{ reviewId: string; upload: UploadTus }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  if (!titulo.trim()) return { error: "Dê um título ao review" };
  const sb = createServiceRoleClient() as SB;
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  let guid: string;
  try { guid = await criarVideo(titulo.trim()); }
  catch (e) { return { error: msgBunny(e) }; }

  const { data: rv, error } = await sb
    .from("review_video")
    .insert({ organization_id: org.id, cliente_id: clienteId, titulo: titulo.trim(), status: "revisao_interna", criado_por: user.id })
    .select("id").single();
  if (error || !rv) return { error: "Falha ao criar review" };

  await sb.from("review_versao").insert({ review_video_id: rv.id, numero: 1, bunny_video_id: guid, criado_por: user.id });
  return { reviewId: rv.id, upload: assinaturaUpload(guid) };
}

/** Sobe nova versão: cria vídeo no Bunny e registra a versão. Devolve upload TUS. */
export async function novaVersaoAction(reviewId: string, titulo: string): Promise<Res<UploadTus>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: ultimas } = await sb.from("review_versao").select("numero").eq("review_video_id", reviewId).order("numero", { ascending: false }).limit(1);
  const prox = ((ultimas?.[0]?.numero as number | undefined) ?? 0) + 1;
  let guid: string;
  try { guid = await criarVideo(`${titulo} v${prox}`); }
  catch (e) { return { error: msgBunny(e) }; }
  await sb.from("review_versao").insert({ review_video_id: reviewId, numero: prox, bunny_video_id: guid, criado_por: user.id });
  revalidatePath(`/audiovisual/review/${reviewId}`);
  return assinaturaUpload(guid);
}

/** Marca a versão como pronta (chamado após o Bunny terminar de processar). */
export async function confirmarProntoAction(reviewId: string, bunnyVideoId: string): Promise<Res<{ pronto: boolean }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  let st: { pronto: boolean; duracaoSeg: number };
  try { st = await statusVideo(bunnyVideoId); }
  catch (e) { return { error: msgBunny(e) }; }
  if (st.pronto) {
    const sb = createServiceRoleClient() as SB;
    await sb.from("review_versao").update({ pronto: true, duracao_seg: st.duracaoSeg }).eq("bunny_video_id", bunnyVideoId);
    revalidatePath(`/audiovisual/review/${reviewId}`);
  }
  return { pronto: st.pronto };
}

export async function comentarAction(reviewId: string, versaoId: string, tempoSeg: number, corpo: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  if (!corpo.trim()) return { error: "Escreva um comentário" };
  const sb = createServiceRoleClient() as SB;
  await sb.from("review_comentario").insert({
    versao_id: versaoId, autor_tipo: "time", autor_id: user.id, autor_nome: user.nome,
    tempo_seg: Math.max(0, Math.round(tempoSeg)), corpo: corpo.trim(),
  });
  revalidatePath(`/audiovisual/review/${reviewId}`);
  return { ok: true };
}

export async function resolverComentarioAction(reviewId: string, comentarioId: string, resolvido: boolean): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  await sb.from("review_comentario").update({ resolvido }).eq("id", comentarioId);
  revalidatePath(`/audiovisual/review/${reviewId}`);
  return { ok: true };
}

export async function aprovarInternoAction(reviewId: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb.from("review_video").select("status").eq("id", reviewId).maybeSingle();
  if (!rv) return { error: "Review não encontrado" };
  if (!podeTransicionar(rv.status as ReviewStatus, "revisao_cliente")) return { error: "Esse review não está em revisão interna" };
  await sb.from("review_video").update({ status: "revisao_cliente", updated_at: new Date().toISOString() }).eq("id", reviewId);
  revalidatePath(`/audiovisual/review/${reviewId}`);
  revalidatePath("/audiovisual/review");
  return { ok: true };
}

function msgBunny(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m === "BUNNY_NAO_CONFIGURADO") return "Player de vídeo (Bunny) não configurado. Veja docs/frame-interno-bunny-setup.md.";
  return "Falha ao falar com o Bunny Stream.";
}
```

- [ ] **Step 4: Type-check + lint + testes**
Run:
```
npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && echo TYPECHECK_OK
npx eslint src/lib/review src/lib/bunny src/lib/auth/permissions.ts && echo LINT_OK
npx vitest run src/lib/review --exclude '**/.claude/**'
```

- [ ] **Step 5: Commit**
```bash
git add src/lib/auth/permissions.ts src/lib/review/queries.ts src/lib/review/actions.ts
git commit -m "feat(frame-interno): queries + actions + permissão

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Upload direto pro Bunny (component)

**Files:** Create `src/components/review/UploadVersao.tsx`

- [ ] **Step 1: Implementar** — usa `tus-js-client` pra enviar o arquivo direto ao Bunny com a assinatura.
```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as tus from "tus-js-client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { confirmarProntoAction } from "@/lib/review/actions";
import type { UploadTus } from "@/lib/bunny/client";

export function UploadVersao({ reviewId, upload, titulo }: { reviewId: string; upload: UploadTus; titulo: string }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<number | null>(null);

  function enviar(file: File) {
    setProg(0);
    const up = new tus.Upload(file, {
      endpoint: upload.endpoint,
      retryDelays: [0, 3000, 6000],
      headers: {
        AuthorizationSignature: upload.signature,
        AuthorizationExpire: String(upload.expiration),
        VideoId: upload.videoId,
        LibraryId: upload.libraryId,
      },
      metadata: { filetype: file.type, title: titulo },
      onError: () => { setProg(null); toast.error("Falha no upload."); },
      onProgress: (sent, total) => setProg(Math.round((sent / total) * 100)),
      onSuccess: async () => {
        setProg(null);
        toast.success("Enviado! Processando o vídeo…");
        // Poll status até ficar pronto (até ~2 min).
        for (let i = 0; i < 40; i++) {
          const r = await confirmarProntoAction(reviewId, upload.videoId);
          if (!("error" in r) && r.pronto) break;
          await new Promise((res) => setTimeout(res, 3000));
        }
        router.refresh();
      },
    });
    up.start();
  }

  return (
    <div>
      <input ref={ref} type="file" accept="video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) enviar(f); }} disabled={prog !== null} />
      <Button type="button" onClick={() => ref.current?.click()} disabled={prog !== null}>
        {prog !== null ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        {prog !== null ? `Enviando ${prog}%` : "Enviar vídeo"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/components/review/UploadVersao.tsx && echo OK` → `OK`.

- [ ] **Step 3: Commit**
```bash
git add src/components/review/UploadVersao.tsx
git commit -m "feat(frame-interno): upload direto pro Bunny (tus)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Player + Comentários

**Files:** Create `src/components/review/Player.tsx`, `src/components/review/Comentarios.tsx`

- [ ] **Step 1: Player** — `src/components/review/Player.tsx` (hls.js; expõe seek via ref imperativo)
```tsx
"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import Hls from "hls.js";

export interface PlayerHandle { seek: (seg: number) => void; tempoAtual: () => number }

export const Player = forwardRef<PlayerHandle, { playlistUrl: string }>(function Player({ playlistUrl }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  useImperativeHandle(ref, () => ({
    seek: (seg) => { if (video.current) { video.current.currentTime = seg; video.current.play().catch(() => {}); } },
    tempoAtual: () => video.current?.currentTime ?? 0,
  }));
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = playlistUrl; return; }
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(playlistUrl);
      hls.attachMedia(v);
      return () => hls.destroy();
    }
  }, [playlistUrl]);
  return <video ref={video} controls controlsList="nodownload" className="aspect-video w-full rounded-lg bg-black" />;
});
```

- [ ] **Step 2: Comentários** — `src/components/review/Comentarios.tsx`
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, MessageSquarePlus } from "lucide-react";
import { comentarAction, resolverComentarioAction } from "@/lib/review/actions";
import type { Comentario } from "@/lib/review/queries";
import type { PlayerHandle } from "./Player";

function fmt(seg: number) { const m = Math.floor(seg / 60), s = Math.floor(seg % 60); return `${m}:${String(s).padStart(2, "0")}`; }

export function Comentarios({ reviewId, versaoId, comentarios, playerRef, podeComentar }: {
  reviewId: string; versaoId: string; comentarios: Comentario[]; playerRef: React.RefObject<PlayerHandle | null>; podeComentar: boolean;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [pending, start] = useTransition();

  function enviar() {
    const tempo = playerRef.current?.tempoAtual() ?? 0;
    start(async () => {
      const r = await comentarAction(reviewId, versaoId, tempo, texto);
      if ("error" in r) { toast.error(r.error); return; }
      setTexto(""); router.refresh();
    });
  }
  function resolver(id: string, val: boolean) {
    start(async () => { await resolverComentarioAction(reviewId, id, val); router.refresh(); });
  }

  return (
    <div className="space-y-3">
      {podeComentar && (
        <div className="flex gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comentar no tempo atual…"
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" onKeyDown={(e) => e.key === "Enter" && texto.trim() && enviar()} />
          <Button type="button" size="sm" onClick={enviar} disabled={pending || !texto.trim()}>
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="space-y-2">
        {comentarios.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>
        ) : comentarios.map((c) => (
          <div key={c.id} className={`rounded-md border p-2 text-sm ${c.resolvido ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => playerRef.current?.seek(c.tempo_seg)} className="font-mono text-xs text-primary hover:underline">{fmt(c.tempo_seg)}</button>
              <span className="text-xs font-medium">{c.autor_nome}</span>
              {podeComentar && (
                <button type="button" onClick={() => resolver(c.id, !c.resolvido)} className="ml-auto text-muted-foreground hover:text-emerald-600" title={c.resolvido ? "Reabrir" : "Resolver"}>
                  <Check className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="mt-1">{c.corpo}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/components/review/Player.tsx src/components/review/Comentarios.tsx && echo OK` → `OK`.

- [ ] **Step 4: Commit**
```bash
git add src/components/review/Player.tsx src/components/review/Comentarios.tsx
git commit -m "feat(frame-interno): player hls.js + comentários no tempo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: ReviewView + páginas + entrada

**Files:** Create `src/components/review/ReviewView.tsx`, `src/app/(authed)/audiovisual/review/page.tsx`, `.../review/[id]/page.tsx`, `.../review/novo/page.tsx`; entrada no Audiovisual.

- [ ] **Step 1: ReviewView** — `src/components/review/ReviewView.tsx` (client; junta player + comentários da versão ativa + botão aprovar + upload nova versão)
```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Player, type PlayerHandle } from "./Player";
import { Comentarios } from "./Comentarios";
import { UploadVersao } from "./UploadVersao";
import { aprovarInternoAction, novaVersaoAction } from "@/lib/review/actions";
import { STATUS_LABEL } from "@/lib/review/schema";
import type { ReviewFull } from "@/lib/review/queries";
import type { UploadTus } from "@/lib/bunny/client";

export function ReviewView({ review, podeGerenciar }: { review: ReviewFull; podeGerenciar: boolean }) {
  const router = useRouter();
  const playerRef = useRef<PlayerHandle>(null);
  const [ativa, setAtiva] = useState(review.versoes.length - 1);
  const [uploadNova, setUploadNova] = useState<UploadTus | null>(null);
  const [pending, start] = useTransition();
  const versao = review.versoes[ativa];

  function aprovar() {
    start(async () => {
      const r = await aprovarInternoAction(review.id);
      if ("error" in r) { toast.error(r.error); return; }
      toast.success("Aprovado internamente!"); router.refresh();
    });
  }
  function pedirNova() {
    start(async () => {
      const r = await novaVersaoAction(review.id, review.titulo);
      if ("error" in r) { toast.error(r.error); return; }
      setUploadNova(r); router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{review.titulo}</h1>
          <p className="text-sm text-muted-foreground">{review.clienteNome ?? "Sem cliente"} · <Badge variant="outline">{STATUS_LABEL[review.status]}</Badge></p>
        </div>
        {podeGerenciar && review.status === "revisao_interna" && (
          <Button type="button" onClick={aprovar} disabled={pending}>Aprovar internamente</Button>
        )}
      </header>

      {review.versoes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Nenhuma versão ainda.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            {versao.pronto ? <Player ref={playerRef} playlistUrl={versao.playlistUrl} />
              : <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">Processando o vídeo…</div>}
            <div className="flex flex-wrap gap-1">
              {review.versoes.map((v, i) => (
                <Button key={v.id} type="button" size="sm" variant={i === ativa ? "default" : "outline"} onClick={() => setAtiva(i)}>v{v.numero}</Button>
              ))}
            </div>
          </div>
          <Card className="p-3">
            <Comentarios reviewId={review.id} versaoId={versao.id} comentarios={versao.comentarios} playerRef={playerRef} podeComentar />
          </Card>
        </div>
      )}

      {podeGerenciar && (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          {uploadNova ? (
            <UploadVersao reviewId={review.id} upload={uploadNova} titulo={review.titulo} />
          ) : (
            <Button type="button" variant="outline" onClick={pedirNova} disabled={pending}>Subir nova versão</Button>
          )}
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Lista** — `src/app/(authed)/audiovisual/review/page.tsx`
```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listarReviews } from "@/lib/review/queries";
import { STATUS_LABEL } from "@/lib/review/schema";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export default async function ReviewListPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:review")) redirect("/audiovisual");
  const reviews = await listarReviews();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Reviews de vídeo</h1><p className="text-sm text-muted-foreground">Aprovação interna e do cliente.</p></div>
        <Link href="/audiovisual/review/novo" className={buttonVariants()}><Plus className="mr-2 h-4 w-4" />Novo review</Link>
      </header>
      <div className="space-y-2">
        {reviews.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum review ainda.</p> :
          reviews.map((r) => (
            <Link key={r.id} href={`/audiovisual/review/${r.id}`} className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/40">
              <div><p className="font-medium">{r.titulo}</p><p className="text-xs text-muted-foreground">{r.clienteNome ?? "Sem cliente"}</p></div>
              <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
            </Link>
          ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Review** — `src/app/(authed)/audiovisual/review/[id]/page.tsx`
```tsx
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { carregarReview } from "@/lib/review/queries";
import { ReviewView } from "@/components/review/ReviewView";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:review")) redirect("/audiovisual");
  const review = await carregarReview(id);
  if (!review) notFound();
  return <div className="mx-auto max-w-4xl"><ReviewView review={review} podeGerenciar /></div>;
}
```

- [ ] **Step 4: Novo** — `src/app/(authed)/audiovisual/review/novo/page.tsx` + um pequeno client form que chama `criarReviewAction` e, ao voltar, mostra o `UploadVersao`. Implementar `src/components/review/NovoReviewForm.tsx`:
```tsx
"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { criarReviewAction } from "@/lib/review/actions";
import { UploadVersao } from "./UploadVersao";
import type { UploadTus } from "@/lib/bunny/client";

export function NovoReviewForm({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const [titulo, setTitulo] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [criado, setCriado] = useState<{ reviewId: string; upload: UploadTus } | null>(null);
  const [pending, start] = useTransition();
  function criar() {
    start(async () => {
      const r = await criarReviewAction(titulo, clienteId || null);
      if ("error" in r) { toast.error(r.error); return; }
      setCriado(r);
    });
  }
  if (criado) return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Review criado. Agora envie o vídeo:</p>
      <UploadVersao reviewId={criado.reviewId} upload={criado.upload} titulo={titulo} />
      <a href={`/audiovisual/review/${criado.reviewId}`} className="text-sm text-primary hover:underline">Abrir o review →</a>
    </div>
  );
  const input = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <div className="space-y-3">
      <div><label className="block text-sm font-medium">Título</label><input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={input} /></div>
      <div><label className="block text-sm font-medium">Cliente</label>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={input}>
          <option value="">Sem cliente</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <Button type="button" onClick={criar} disabled={pending || !titulo.trim()}>Criar e enviar vídeo</Button>
    </div>
  );
}
```
E a página `novo/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NovoReviewForm } from "@/components/review/NovoReviewForm";

export default async function NovoReviewPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:review")) redirect("/audiovisual");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb.from("clientes").select("id, nome").order("nome");
  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header><h1 className="text-2xl font-bold tracking-tight">Novo review</h1></header>
      <NovoReviewForm clientes={(data ?? []) as { id: string; nome: string }[]} />
    </div>
  );
}
```

- [ ] **Step 5: Entrada no Audiovisual** — adicionar um botão/link "Reviews de vídeo" (ícone `Clapperboard`) apontando `/audiovisual/review` no topo da página `/audiovisual`, visível a quem tem `manage:review`, seguindo o padrão de botões de lá.

- [ ] **Step 6: Type-check + lint + testes**
Run:
```
npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && echo TYPECHECK_OK
npx eslint src/components/review "src/app/(authed)/audiovisual/review" && echo LINT_OK
npx vitest run src/lib/review --exclude '**/.claude/**'
```

- [ ] **Step 7: Commit + PR**
```bash
git add -A && git commit -m "feat(frame-interno): ReviewView + páginas + entrada no Audiovisual

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push -u origin feat/frame-interno-fase-a
gh pr create --base main --head feat/frame-interno-fase-a --title "feat: Frame interno Fase A (review de vídeo interno)" --body "Review de vídeo interno: criar review, upload direto pro Bunny, player hls.js, comentários no tempo, versões, aprovação interna. Requer setup Bunny (docs/frame-interno-bunny-setup.md) + migration manual. Spec/plan em docs/superpowers/."
```
> **NÃO auto-mergear sem smoke-test:** precisa das envs Bunny + a migration aplicada pra testar upload/playback de verdade.

---

## Self-review (cobertura do spec — Fase A)
- Bunny setup + env + deps → Task 1 ✓
- Tabelas review_video/versao/comentario → Task 2 ✓
- Máquina de status (testada) → Task 3 ✓
- Cliente Bunny (criar/assinar/status/urls) → Task 4 ✓
- Queries + actions (criar, nova versão, confirmar pronto, comentar, resolver, aprovar interno) + permissão → Task 5 ✓
- Upload direto pro Bunny (tus) → Task 6 ✓
- Player hls.js (seek pro comentário) + comentários no tempo (criar/seek/resolver) → Task 7 ✓
- Lista + review + novo + entrada → Task 8 ✓
- Migration manual + smoke-test obrigatório → Tasks 2, 8 ✓
- **Fora de escopo (Fase B):** link secreto, portal, aprovação do cliente → plano separado.
