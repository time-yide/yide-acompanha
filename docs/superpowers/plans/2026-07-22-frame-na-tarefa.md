# Frame na Tarefa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Embutir o Frame na tarefa de vídeo: editor sobe o vídeo pela tarefa, e o **assessor só baixa (MP4) depois de assistir ≥90%** da versão atual (rearma a cada versão nova). Reusa a base da Fase A + o fluxo de status da tarefa.

**Architecture:** `review_video.task_id` liga o review à tarefa. Player reporta progresso → `review_assistido` (pct por usuário/versão). Gate puro (`destravado`) libera o download. Download = MP4 do Bunny. Spec: `docs/superpowers/specs/2026-07-22-frame-na-tarefa-design.md`.

**Tech Stack:** Next.js App Router, Supabase service-role, Bunny Stream, vitest.

> **PRÉ-REQUISITO:** habilitar **MP4 fallback** na biblioteca Bunny (painel → Stream → Yide Reviews → Encoding → "MP4 fallback"/"Allow download"). Sem isso o download volta vazio (a UI avisa). Migration manual no fim.

---

## File structure
- Create `supabase/migrations/20260722100000_frame_na_tarefa.sql` (manual).
- Create `src/lib/review/gate.ts` (+ `.test.ts`) — `destravado(pctMax)`.
- Modify `src/lib/bunny/client.ts` — `urlDownloadMp4(guid)`.
- Create `src/lib/review/tarefa-queries.ts` — `getReviewDaTarefa(taskId, userId)`.
- Create `src/lib/review/tarefa-actions.ts` — criar review da tarefa, registrar assistido, link de download.
- Create `src/components/review/VideoDaTarefa.tsx` — seção embutida na tarefa.
- Modify `src/app/(authed)/tarefas/[id]/page.tsx` — renderizar a seção pra tarefa de vídeo.

---

## Task 1: Migration (manual)

**Files:** Create `supabase/migrations/20260722100000_frame_na_tarefa.sql`

- [ ] **Step 1: Escrever**
```sql
-- Frame na Tarefa. Aplicação MANUAL no SQL Editor após o merge.
alter table public.review_video add column if not exists task_id uuid references public.tasks(id) on delete set null;
create index if not exists review_video_task_idx on public.review_video(task_id) where task_id is not null;

create table if not exists public.review_assistido (
  user_id uuid not null references public.profiles(id) on delete cascade,
  versao_id uuid not null references public.review_versao(id) on delete cascade,
  pct_max int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, versao_id)
);
alter table public.review_assistido enable row level security;
drop policy if exists review_assistido_read on public.review_assistido;
create policy review_assistido_read on public.review_assistido for select to authenticated using (true);
```

- [ ] **Step 2: Commit**
```bash
git add supabase/migrations/20260722100000_frame_na_tarefa.sql
git commit -m "feat(frame-na-tarefa): migration task_id + review_assistido (manual)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Gate de assistido (TDD)

**Files:** Create `src/lib/review/gate.ts` + `.test.ts`

- [ ] **Step 1: Teste que falha** — `src/lib/review/gate.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { destravado, PCT_MINIMO } from "./gate";

describe("destravado", () => {
  it(`libera com pct >= ${PCT_MINIMO}`, () => {
    expect(destravado(90)).toBe(true);
    expect(destravado(100)).toBe(true);
  });
  it("bloqueia abaixo do mínimo", () => {
    expect(destravado(89)).toBe(false);
    expect(destravado(0)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**
Run: `npx vitest run src/lib/review/gate.test.ts --exclude '**/.claude/**'` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/review/gate.ts`
```ts
/** % mínimo assistido pra liberar baixar/aprovar/pedir alteração. */
export const PCT_MINIMO = 90;

export function destravado(pctMax: number): boolean {
  return pctMax >= PCT_MINIMO;
}
```

- [ ] **Step 4: Rodar e ver passar**
Run: `npx vitest run src/lib/review/gate.test.ts --exclude '**/.claude/**'` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/review/gate.ts src/lib/review/gate.test.ts
git commit -m "feat(frame-na-tarefa): gate de assistido (>=90%)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Bunny MP4 de download

**Files:** Modify `src/lib/bunny/client.ts`

- [ ] **Step 1: Adicionar `urlDownloadMp4`** ao final de `src/lib/bunny/client.ts`
```ts
/**
 * URL do MP4 pra download da melhor resolução disponível. Requer "MP4 fallback"
 * habilitado na library. Retorna null se o Bunny não está configurado ou sem MP4.
 */
export async function urlDownloadMp4(videoId: string): Promise<string | null> {
  if (!bunnyConfigurado()) return null;
  const { apiKey, libraryId, cdn } = creds();
  const resp = await fetch(`${BASE}/library/${libraryId}/videos/${videoId}`, { headers: { AccessKey: apiKey } });
  if (!resp.ok) return null;
  const data = (await resp.json()) as { availableResolutions?: string | null };
  const res = (data.availableResolutions ?? "").split(",").map((r) => r.trim()).filter(Boolean);
  const ordem = ["2160p", "1440p", "1080p", "720p", "480p", "360p", "240p"];
  const melhor = ordem.find((r) => res.includes(r)) ?? res[0];
  if (!melhor) return null;
  return `https://${cdn}/${videoId}/play_${melhor}.mp4`;
}
```
> Obs: `creds()` e `BASE`/`bunnyConfigurado` já existem no arquivo. Se `creds` não estiver exportado, use-o internamente (já é usado por `criarVideo`).

- [ ] **Step 2: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/lib/bunny/client.ts && echo OK` → `OK`.

- [ ] **Step 3: Commit**
```bash
git add src/lib/bunny/client.ts
git commit -m "feat(frame-na-tarefa): URL de download MP4 (Bunny)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Queries + actions da tarefa

**Files:** Create `src/lib/review/tarefa-queries.ts` e `src/lib/review/tarefa-actions.ts`

- [ ] **Step 1: `tarefa-queries.ts`**
```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { urlPlaylist, statusVideo, bunnyConfigurado } from "@/lib/bunny/client";
import type { Comentario } from "./queries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface VersaoTarefa { id: string; numero: number; bunny_video_id: string; pronto: boolean; playlistUrl: string; comentarios: Comentario[] }
export interface ReviewDaTarefa {
  reviewId: string;
  status: string;
  versoes: VersaoTarefa[];
  /** % que ESTE usuário assistiu da versão ATUAL (última). */
  assistidoPctVersaoAtual: number;
}

/** Review ligado a uma tarefa (ou null). Inclui o quanto o usuário assistiu da versão atual. */
export async function getReviewDaTarefa(taskId: string, userId: string): Promise<ReviewDaTarefa | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb
    .from("review_video")
    .select("id, status")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rv) return null;

  const { data: versoes } = await sb
    .from("review_versao")
    .select("id, numero, bunny_video_id, pronto")
    .eq("review_video_id", rv.id)
    .order("numero", { ascending: true });
  const vs = (versoes ?? []) as Array<{ id: string; numero: number; bunny_video_id: string; pronto: boolean }>;

  // Self-heal do status (igual carregarReview).
  if (bunnyConfigurado()) {
    await Promise.all(vs.filter((v) => !v.pronto).map(async (v) => {
      try { const st = await statusVideo(v.bunny_video_id); if (st.pronto) { v.pronto = true; await sb.from("review_versao").update({ pronto: true, duracao_seg: st.duracaoSeg }).eq("id", v.id); } } catch {}
    }));
  }

  const versaoIds = vs.map((v) => v.id);
  const { data: coments } = versaoIds.length
    ? await sb.from("review_comentario").select("id, versao_id, autor_tipo, autor_nome, tempo_seg, corpo, resolvido, created_at").in("versao_id", versaoIds).order("tempo_seg", { ascending: true })
    : { data: [] };
  const porVersao = new Map<string, Comentario[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (coments ?? []) as any[]) { const arr = porVersao.get(c.versao_id) ?? []; arr.push(c); porVersao.set(c.versao_id, arr); }

  const atual = vs[vs.length - 1];
  let assistidoPctVersaoAtual = 0;
  if (atual) {
    const { data: a } = await sb.from("review_assistido").select("pct_max").eq("user_id", userId).eq("versao_id", atual.id).maybeSingle();
    assistidoPctVersaoAtual = (a?.pct_max as number | undefined) ?? 0;
  }

  return {
    reviewId: rv.id,
    status: rv.status,
    versoes: vs.map((v) => ({ id: v.id, numero: v.numero, bunny_video_id: v.bunny_video_id, pronto: v.pronto, playlistUrl: urlPlaylist(v.bunny_video_id), comentarios: porVersao.get(v.id) ?? [] })),
    assistidoPctVersaoAtual,
  };
}
```

- [ ] **Step 2: `tarefa-actions.ts`**
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { criarVideo, assinaturaUpload, urlDownloadMp4, type UploadTus } from "@/lib/bunny/client";
import { destravado } from "./gate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

function pode(role: string) { return canAccess(role, "manage:review"); }

/** Cria (ou reusa) o review da tarefa e prepara o upload da 1ª versão. */
export async function criarReviewDaTarefaAction(taskId: string): Promise<Res<{ reviewId: string; upload: UploadTus }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: task } = await sb.from("tasks").select("id, titulo, client_id").eq("id", taskId).maybeSingle();
  if (!task) return { error: "Tarefa não encontrada" };
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();

  // reusa review existente da tarefa, se houver
  let reviewId: string;
  const { data: existente } = await sb.from("review_video").select("id").eq("task_id", taskId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existente) reviewId = existente.id;
  else {
    const { data: rv, error } = await sb.from("review_video").insert({ organization_id: org?.id, cliente_id: task.client_id, task_id: taskId, titulo: task.titulo, status: "revisao_interna", criado_por: user.id }).select("id").single();
    if (error || !rv) return { error: "Falha ao criar review" };
    reviewId = rv.id;
  }

  let guid: string;
  try { guid = await criarVideo(task.titulo); } catch { return { error: "Falha ao criar vídeo no Bunny (configuração?)" }; }
  const { data: ult } = await sb.from("review_versao").select("numero").eq("review_video_id", reviewId).order("numero", { ascending: false }).limit(1);
  const prox = ((ult?.[0]?.numero as number | undefined) ?? 0) + 1;
  await sb.from("review_versao").insert({ review_video_id: reviewId, numero: prox, bunny_video_id: guid, criado_por: user.id });
  revalidatePath(`/tarefas/${taskId}`);
  return { reviewId, upload: assinaturaUpload(guid) };
}

/** Registra o progresso assistido (guarda o máximo). */
export async function registrarAssistidoAction(versaoId: string, pct: number): Promise<{ ok: true } | { error: string }> {
  const user = await requireAuth();
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const sb = createServiceRoleClient() as SB;
  const { data: atual } = await sb.from("review_assistido").select("pct_max").eq("user_id", user.id).eq("versao_id", versaoId).maybeSingle();
  const novo = Math.max(p, (atual?.pct_max as number | undefined) ?? 0);
  await sb.from("review_assistido").upsert({ user_id: user.id, versao_id: versaoId, pct_max: novo, updated_at: new Date().toISOString() }, { onConflict: "user_id,versao_id" });
  return { ok: true };
}

/** Link de download do MP4 — só libera se assistiu >= mínimo. */
export async function linkDownloadAction(versaoId: string): Promise<Res<{ url: string }>> {
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;
  const { data: a } = await sb.from("review_assistido").select("pct_max").eq("user_id", user.id).eq("versao_id", versaoId).maybeSingle();
  if (!destravado((a?.pct_max as number | undefined) ?? 0)) return { error: "Assista o vídeo até o fim pra liberar o download." };
  const { data: v } = await sb.from("review_versao").select("bunny_video_id").eq("id", versaoId).maybeSingle();
  if (!v) return { error: "Versão não encontrada" };
  const url = await urlDownloadMp4(v.bunny_video_id);
  if (!url) return { error: "Download indisponível — habilite o 'MP4 fallback' na biblioteca do Bunny." };
  return { url };
}
```

- [ ] **Step 3: Type-check + lint + testes**
Run:
```
npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && echo TYPECHECK_OK
npx eslint src/lib/review src/lib/bunny && echo LINT_OK
npx vitest run src/lib/review --exclude '**/.claude/**'
```

- [ ] **Step 4: Commit**
```bash
git add src/lib/review/tarefa-queries.ts src/lib/review/tarefa-actions.ts
git commit -m "feat(frame-na-tarefa): queries + actions (review da tarefa, assistido, download)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Componente `VideoDaTarefa`

**Files:** Create `src/components/review/VideoDaTarefa.tsx`

- [ ] **Step 1: Implementar** (client) — player + comentários + trava de download
```tsx
"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Player, type PlayerHandle } from "./Player";
import { Comentarios } from "./Comentarios";
import { UploadVersao } from "./UploadVersao";
import { criarReviewDaTarefaAction, registrarAssistidoAction, linkDownloadAction } from "@/lib/review/tarefa-actions";
import { PCT_MINIMO, destravado } from "@/lib/review/gate";
import type { ReviewDaTarefa } from "@/lib/review/tarefa-queries";
import type { UploadTus } from "@/lib/bunny/client";
import { Download, Lock, Upload, Video } from "lucide-react";

export function VideoDaTarefa({ taskId, review, podeGerenciar }: { taskId: string; review: ReviewDaTarefa | null; podeGerenciar: boolean }) {
  const router = useRouter();
  const playerRef = useRef<PlayerHandle>(null);
  const [tempo, setTempo] = useState(0);
  const [upload, setUpload] = useState<UploadTus | null>(null);
  const [pending, start] = useTransition();
  const versao = review?.versoes[review.versoes.length - 1];
  const [pctVisto, setPctVisto] = useState(review?.assistidoPctVersaoAtual ?? 0);
  const salvoRef = useRef(review?.assistidoPctVersaoAtual ?? 0);

  // Salva o progresso (máximo) de forma throttled quando cresce.
  useEffect(() => {
    if (!versao) return;
    if (pctVisto - salvoRef.current >= 5 || (pctVisto >= PCT_MINIMO && salvoRef.current < PCT_MINIMO)) {
      salvoRef.current = pctVisto;
      registrarAssistidoAction(versao.id, pctVisto);
    }
  }, [pctVisto, versao]);

  function onTime(seg: number, dur: number) {
    setTempo(seg);
    if (dur > 0) setPctVisto((p) => Math.max(p, Math.round((seg / dur) * 100)));
  }

  function novaVersao() {
    start(async () => {
      const r = await criarReviewDaTarefaAction(taskId);
      if ("error" in r) { toast.error(r.error); return; }
      setUpload(r.upload); setPctVisto(0); salvoRef.current = 0; router.refresh();
    });
  }
  function baixar() {
    if (!versao) return;
    start(async () => {
      const r = await linkDownloadAction(versao.id);
      if ("error" in r) { toast.error(r.error); return; }
      window.open(r.url, "_blank");
    });
  }

  const liberado = destravado(pctVisto);

  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><Video className="h-4 w-4" />Vídeo (Frame)</p>

      {!review || !versao ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Nenhum vídeo enviado ainda.</p>
          {podeGerenciar && (upload ? (
            <UploadVersao reviewId={review?.reviewId ?? ""} upload={upload} titulo="video" />
          ) : (
            <Button type="button" size="sm" onClick={novaVersao} disabled={pending}><Upload className="mr-2 h-4 w-4" />Subir vídeo</Button>
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-white/10 bg-neutral-950">
            <div className="grid md:grid-cols-[1fr_300px]">
              <div className="aspect-video bg-black">
                {versao.pronto && versao.playlistUrl ? (
                  <Player ref={playerRef} playlistUrl={versao.playlistUrl} marcadores={versao.comentarios.map((c) => c.tempo_seg)} onTime={onTime} onMarcadorClick={(s) => playerRef.current?.seek(s)} />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/50">Processando o vídeo…</div>
                )}
              </div>
              <div className="h-[240px] border-t border-white/10 md:h-auto md:border-l md:border-t-0">
                <Comentarios reviewId={review.reviewId} versaoId={versao.id} comentarios={versao.comentarios} playerRef={playerRef} tempoAtual={tempo} podeComentar />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {podeGerenciar && (upload ? (
              <UploadVersao reviewId={review.reviewId} upload={upload} titulo="video" />
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={novaVersao} disabled={pending}><Upload className="mr-2 h-4 w-4" />Nova versão</Button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {!liberado && (
                <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <Lock className="h-3.5 w-3.5" />Assista até o fim ({pctVisto}%/{PCT_MINIMO}%) pra baixar
                </span>
              )}
              <Button type="button" size="sm" onClick={baixar} disabled={pending || !liberado}>
                <Download className="mr-2 h-4 w-4" />Baixar vídeo
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/components/review/VideoDaTarefa.tsx && echo OK` → `OK`.

- [ ] **Step 3: Commit**
```bash
git add src/components/review/VideoDaTarefa.tsx
git commit -m "feat(frame-na-tarefa): componente VideoDaTarefa (player + trava de download)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Integrar na página da tarefa

**Files:** Modify `src/app/(authed)/tarefas/[id]/page.tsx`

- [ ] **Step 1:** No topo, importar:
```tsx
import { getReviewDaTarefa } from "@/lib/review/tarefa-queries";
import { VideoDaTarefa } from "@/components/review/VideoDaTarefa";
```

- [ ] **Step 2:** Depois de carregar `task` e `user` (onde `isApprovalTask` é definido, ~linha 94), buscar o review só pra tarefa de vídeo:
```tsx
  const reviewDaTarefa = task.tipo === "video" ? await getReviewDaTarefa(task.id, user.id) : null;
  const podeVideo = canAccess(user.role, "manage:review");
```
(garantir `canAccess` importado — hoje o arquivo importa `canManageAnyTask` de `@/lib/auth/permissions`; adicionar `canAccess` ao mesmo import.)

- [ ] **Step 3:** Renderizar a seção logo **após** o `<ApprovalCard .../>` (por volta da linha 246-258), só pra tarefa de vídeo:
```tsx
          {task.tipo === "video" && (
            <VideoDaTarefa taskId={task.id} review={reviewDaTarefa} podeGerenciar={podeVideo} />
          )}
```

- [ ] **Step 4: Type-check + lint + testes**
Run:
```
npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && echo TYPECHECK_OK
npx eslint "src/app/(authed)/tarefas/[id]/page.tsx" src/components/review src/lib/review && echo LINT_OK
npx vitest run src/lib/review --exclude '**/.claude/**'
```

- [ ] **Step 5: Commit + PR (segurar merge)**
```bash
git add "src/app/(authed)/tarefas/[id]/page.tsx"
git commit -m "feat(frame-na-tarefa): seção de vídeo na página da tarefa

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push -u origin feat/frame-na-tarefa
gh pr create --base main --head feat/frame-na-tarefa --title "feat: Frame na Tarefa (entrega ao assessor + trava de assistir)" --body "Embute o Frame na tarefa de vídeo + trava de download (assistir >=90%). Migration manual (task_id + review_assistido). Requer MP4 fallback ligado no Bunny. Spec/plan em docs/superpowers/."
```
> **NÃO auto-mergear:** precisa da migration aplicada + MP4 fallback no Bunny + smoke-test (a Yasmin testa a trava/download).

---

## Self-review (cobertura do spec)
- `task_id` liga review↔tarefa; `review_assistido` (trava) → Task 1 ✓
- Gate `destravado(>=90)` testado → Task 2 ✓
- Download MP4 do Bunny → Task 3 ✓
- Criar review pela tarefa + registrar assistido + link de download gated → Task 4 ✓
- Seção embutida (player + comentários + subir/baixar com trava) → Tasks 5, 6 ✓
- Reusa a base da Fase A + fluxo de status da tarefa (não duplica aprovação) → Task 6 ✓
- Rearma a cada versão (pctVisto zera na nova versão) → Task 5 ✓
- **Fora do escopo v1 (nota):** gate de Aprovar/Pedir-alteração da própria tarefa fica pra refinamento; o núcleo (assistir→baixar) está entregue. Aprovar/Pedir-ajuste seguem pelo `ApprovalCard` atual.
