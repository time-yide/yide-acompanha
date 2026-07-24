# Review (Frame) inline na tarefa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na tarefa de vídeo, um botão "Review" abre o Frame (player + comentários) num modal sem sair da tarefa; o Audiovisual vira atalho (lista linka pra tarefa).

**Architecture:** Reusa o `ReviewView` existente dentro de um `Dialog`, carregando os dados do review via uma server action ao abrir. Extrai as permissões de review pra um helper único (usado pela tela atual e pela action). A lista do Audiovisual passa a linkar pra tarefa.

**Tech Stack:** Next.js (App Router, server actions), React client components, shadcn Dialog, Supabase, Vitest.

**Spec:** [docs/superpowers/specs/2026-07-24-review-inline-na-tarefa-design.md](../specs/2026-07-24-review-inline-na-tarefa-design.md)

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/lib/review/permissions.ts` | Helpers de permissão (ver/gerenciar/aprovar review) — fonte única | Criar |
| `src/lib/review/permissions.test.ts` | Testes dos helpers | Criar |
| `src/lib/review/nav.ts` | `reviewHref(taskId, reviewId)` — destino do link da lista | Criar |
| `src/lib/review/nav.test.ts` | Teste do helper de link | Criar |
| `src/app/(authed)/audiovisual/review/[id]/page.tsx` | Usa os helpers (sem mudar comportamento) | Modificar |
| `src/lib/review/tarefa-actions.ts` | `carregarReviewAction(reviewId)` pro modal | Modificar |
| `src/components/review/ReviewModal.tsx` | Dialog que carrega e mostra o `ReviewView` | Criar |
| `src/components/review/VideoDaTarefa.tsx` | Vídeo vira botão "Review" que abre o modal | Modificar |
| `src/lib/review/queries.ts` | `ReviewListItem` ganha `taskId`; `listarReviews` inclui `task_id` | Modificar |
| `src/app/(authed)/audiovisual/review/page.tsx` | Item linka pra tarefa; remove "Novo review" | Modificar |

---

## Task 1: Helpers de permissão de review (fonte única)

**Files:**
- Create: `src/lib/review/permissions.ts`
- Test: `src/lib/review/permissions.test.ts`
- Modify: `src/app/(authed)/audiovisual/review/[id]/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/lib/review/permissions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { podeGerenciarReview, podeVerReview, podeAprovarReview } from "./permissions";

describe("review permissions", () => {
  it("podeGerenciarReview: audiovisual tem manage:review; assessor não", () => {
    expect(podeGerenciarReview("audiovisual_chefe")).toBe(true);
    expect(podeGerenciarReview("videomaker")).toBe(true);
    expect(podeGerenciarReview("assessor")).toBe(false);
  });
  it("podeVerReview: gestão de tarefa OU manage:review", () => {
    expect(podeVerReview({ role: "assessor" })).toBe(true); // canManageAnyTask
    expect(podeVerReview({ role: "videomaker" })).toBe(true); // manage:review
    expect(podeVerReview({ role: "programacao" })).toBe(false);
  });
  it("podeAprovarReview: gestor de tarefa OU criador da tarefa", () => {
    expect(podeAprovarReview({ id: "u1", role: "coordenador" }, null)).toBe(true);
    expect(podeAprovarReview({ id: "u1", role: "videomaker" }, "u1")).toBe(true);
    expect(podeAprovarReview({ id: "u1", role: "videomaker" }, "u2")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/review/permissions.test.ts --exclude '**/.claude/**'`
Expected: FAIL — módulo `./permissions` não existe.

- [ ] **Step 3: Create the helpers**

Create `src/lib/review/permissions.ts`:

```ts
import { canAccess, canManageAnyTask } from "@/lib/auth/permissions";

/** Sobe vídeo / comenta / nova versão (time audiovisual). */
export function podeGerenciarReview(role: string): boolean {
  return canAccess(role, "manage:review");
}

/** Pode ABRIR/ver o review: audiovisual (manage:review) OU gestão de tarefa. */
export function podeVerReview(user: { role: string }): boolean {
  return canAccess(user.role, "manage:review") || canManageAnyTask(user);
}

/** Aprova / pede alteração: gestor de tarefa OU criador da tarefa vinculada. */
export function podeAprovarReview(
  user: { id: string; role: string },
  taskCriadoPor: string | null,
): boolean {
  return canManageAnyTask(user) || (taskCriadoPor != null && taskCriadoPor === user.id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/review/permissions.test.ts --exclude '**/.claude/**'`
Expected: PASS (3 tests). Se `podeVerReview({role:"programacao"})` ou algum caso divergir, ajuste a asserção ao que `canAccess`/`canManageAnyTask` de fato retornam (a implementação é a fonte da verdade).

- [ ] **Step 5: Refactor the standalone review page to use the helpers**

In `src/app/(authed)/audiovisual/review/[id]/page.tsx`, replace the body of `ReviewPage` (keep imports of `notFound, redirect, requireAuth, createServiceRoleClient, carregarReview, ReviewView`) with:

```tsx
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { carregarReview } from "@/lib/review/queries";
import { podeVerReview, podeGerenciarReview, podeAprovarReview } from "@/lib/review/permissions";
import { ReviewView } from "@/components/review/ReviewView";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!podeVerReview(user)) redirect("/audiovisual");
  const review = await carregarReview(id, user.id);
  if (!review) notFound();

  let taskCriadoPor: string | null = null;
  if (review.taskId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceRoleClient() as any;
    const { data: t } = await sb.from("tasks").select("criado_por").eq("id", review.taskId).maybeSingle();
    taskCriadoPor = t?.criado_por ?? null;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <ReviewView
        review={review}
        podeGerenciar={podeGerenciarReview(user.role)}
        podeAprovar={podeAprovarReview(user, taskCriadoPor)}
      />
    </div>
  );
}
```

(Remove o import de `canAccess, canManageAnyTask` desta página — agora vêm via helpers.)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/review/permissions.ts src/lib/review/permissions.test.ts "src/app/(authed)/audiovisual/review/[id]/page.tsx"
git commit -m "refactor(review): extrai helpers de permissão (fonte única)"
```

---

## Task 2: Helper de destino do link (`reviewHref`)

**Files:**
- Create: `src/lib/review/nav.ts`
- Test: `src/lib/review/nav.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/review/nav.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { reviewHref } from "./nav";

describe("reviewHref", () => {
  it("leva pra tarefa quando tem taskId", () => {
    expect(reviewHref("t1", "r1")).toBe("/tarefas/t1");
  });
  it("fallback pro review avulso quando sem tarefa", () => {
    expect(reviewHref(null, "r1")).toBe("/audiovisual/review/r1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/review/nav.test.ts --exclude '**/.claude/**'`
Expected: FAIL — módulo `./nav` não existe.

- [ ] **Step 3: Create the helper**

Create `src/lib/review/nav.ts`:

```ts
/**
 * Destino do link de um review na lista do Audiovisual: a TAREFA quando há
 * vínculo (Review abre lá dentro); senão, a tela avulsa (review legado).
 */
export function reviewHref(taskId: string | null, reviewId: string): string {
  return taskId ? `/tarefas/${taskId}` : `/audiovisual/review/${reviewId}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/review/nav.test.ts --exclude '**/.claude/**'`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/review/nav.ts src/lib/review/nav.test.ts
git commit -m "feat(review): helper reviewHref (link da lista vai pra tarefa)"
```

---

## Task 3: `carregarReviewAction` (dados do review pro modal)

**Files:**
- Modify: `src/lib/review/tarefa-actions.ts`

- [ ] **Step 1: Add imports**

At the top of `src/lib/review/tarefa-actions.ts`, add:

```ts
import { carregarReview, type ReviewFull } from "@/lib/review/queries";
import { podeVerReview, podeGerenciarReview, podeAprovarReview } from "@/lib/review/permissions";
```

(`requireAuth`, `createServiceRoleClient`, o tipo `SB` e `type Res<T>` já existem no arquivo.)

- [ ] **Step 2: Add the action**

Append to `src/lib/review/tarefa-actions.ts`:

```ts
/**
 * Carrega um review + permissões pro modal na tarefa. Espelha a lógica da
 * tela /audiovisual/review/[id] via os helpers de permissão (fonte única).
 */
export async function carregarReviewAction(
  reviewId: string,
): Promise<Res<{ review: ReviewFull; podeGerenciar: boolean; podeAprovar: boolean }>> {
  const user = await requireAuth();
  if (!podeVerReview(user)) return { error: "Sem acesso ao review" };
  const review = await carregarReview(reviewId, user.id);
  if (!review) return { error: "Review não encontrado" };

  let taskCriadoPor: string | null = null;
  if (review.taskId) {
    const sb = createServiceRoleClient() as SB;
    const { data: t } = await sb.from("tasks").select("criado_por").eq("id", review.taskId).maybeSingle();
    taskCriadoPor = t?.criado_por ?? null;
  }

  return {
    review,
    podeGerenciar: podeGerenciarReview(user.role),
    podeAprovar: podeAprovarReview(user, taskCriadoPor),
  };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/review/tarefa-actions.ts
git commit -m "feat(review): carregarReviewAction pro modal na tarefa"
```

---

## Task 4: `ReviewModal` (Dialog com o ReviewView)

**Files:**
- Create: `src/components/review/ReviewModal.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/review/ReviewModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { carregarReviewAction } from "@/lib/review/tarefa-actions";
import { ReviewView } from "./ReviewView";
import type { ReviewFull } from "@/lib/review/queries";

type Loaded = { review: ReviewFull; podeGerenciar: boolean; podeAprovar: boolean };

/**
 * Abre o Frame (player + comentários) num modal, dentro da tarefa. Carrega os
 * dados do review ao abrir (server action). Estado guarda o reviewId junto pra
 * não mostrar dado velho ao trocar de vídeo. Sem setState síncrono em effect.
 */
export function ReviewModal({
  reviewId,
  open,
  onOpenChange,
}: {
  reviewId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [state, setState] = useState<{ reviewId: string; data: Loaded } | null>(null);

  useEffect(() => {
    if (!open || !reviewId) return;
    let alive = true;
    (async () => {
      const r = await carregarReviewAction(reviewId);
      if (!alive) return;
      if ("error" in r) {
        toast.error(r.error);
        onOpenChange(false);
        return;
      }
      setState({ reviewId, data: r });
    })();
    return () => {
      alive = false;
    };
  }, [open, reviewId, onOpenChange]);

  const data = state && state.reviewId === reviewId ? state.data : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="sr-only">
          <DialogTitle>Review do vídeo</DialogTitle>
        </DialogHeader>
        {!data ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando review…
          </div>
        ) : (
          <ReviewView review={data.review} podeGerenciar={data.podeGerenciar} podeAprovar={data.podeAprovar} />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/review/ReviewModal.tsx`
Expected: no errors (o setState fica no callback async do effect, não no corpo).

- [ ] **Step 4: Commit**

```bash
git add src/components/review/ReviewModal.tsx
git commit -m "feat(review): ReviewModal — abre o Frame num dialog"
```

---

## Task 5: Vídeo na tarefa vira botão "Review"

**Files:**
- Modify: `src/components/review/VideoDaTarefa.tsx`

- [ ] **Step 1: Replace the file**

Replace the entire contents of `src/components/review/VideoDaTarefa.tsx` with:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadVersao } from "./UploadVersao";
import { ReviewModal } from "./ReviewModal";
import { adicionarVideoAction } from "@/lib/review/tarefa-actions";
import { STATUS_LABEL } from "@/lib/review/schema";
import type { VideoDoBloco } from "@/lib/review/queries";
import type { UploadTus } from "@/lib/bunny/client";
import { Plus, Video, Play } from "lucide-react";

export function VideoDaTarefa({ taskId, videos, podeGerenciar }: { taskId: string; videos: VideoDoBloco[]; podeGerenciar: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [upload, setUpload] = useState<{ reviewId: string; upload: UploadTus } | null>(null);
  const [reviewOpen, setReviewOpen] = useState<string | null>(null);

  function adicionar() {
    start(async () => {
      const r = await adicionarVideoAction(taskId, `Vídeo ${videos.length + 1}`);
      if ("error" in r) { toast.error(r.error); return; }
      setUpload(r); router.refresh();
    });
  }

  const aprovados = videos.filter((v) => v.status === "aprovado").length;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-medium"><Video className="h-4 w-4" />Vídeos (Frame)</p>
        {videos.length > 0 && <span className="text-xs text-muted-foreground">{aprovados}/{videos.length} aprovados</span>}
      </div>

      {videos.length === 0 && !upload && (
        <p className="text-xs text-muted-foreground">Nenhum vídeo ainda.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {videos.map((v) => (
          <button
            key={v.reviewId}
            type="button"
            onClick={() => setReviewOpen(v.reviewId)}
            className="flex items-center gap-3 rounded-lg border p-2 text-left hover:bg-muted/40"
          >
            <span className="relative flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-black">
              {v.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbUrl} alt={v.titulo} className="h-full w-full object-cover opacity-80" />
              ) : null}
              <Play className="absolute h-4 w-4 fill-white text-white" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{v.titulo}</span>
              <span className={`text-[11px] ${v.status === "aprovado" ? "text-emerald-600 dark:text-emerald-400" : v.status === "ajustes" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                {STATUS_LABEL[v.status]}
              </span>
            </span>
            <span className="shrink-0 rounded-md border px-2 py-1 text-xs font-medium">Review</span>
          </button>
        ))}
      </div>

      {podeGerenciar && (upload ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-2 text-xs text-muted-foreground">Envie o arquivo do vídeo:</p>
          <UploadVersao reviewId={upload.reviewId} upload={upload.upload} titulo="video" />
          <Link href={`/audiovisual/review/${upload.reviewId}`} className="mt-2 inline-block text-xs text-primary hover:underline">Abrir o vídeo →</Link>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={adicionar} disabled={pending}><Plus className="mr-2 h-4 w-4" />Adicionar vídeo</Button>
      ))}

      <ReviewModal
        reviewId={reviewOpen ?? ""}
        open={reviewOpen !== null}
        onOpenChange={(o) => { if (!o) setReviewOpen(null); }}
      />
    </Card>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/components/review/VideoDaTarefa.tsx`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/review/VideoDaTarefa.tsx
git commit -m "feat(review): botão Review abre o Frame inline na tarefa"
```

---

## Task 6: Audiovisual vira atalho (lista linka pra tarefa)

**Files:**
- Modify: `src/lib/review/queries.ts`
- Modify: `src/app/(authed)/audiovisual/review/page.tsx`

- [ ] **Step 1: Add `taskId` to `ReviewListItem` + query**

In `src/lib/review/queries.ts`, change the `ReviewListItem` interface (line 8) to include `taskId`:

```ts
export interface ReviewListItem { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; taskId: string | null; created_at: string }
```

Then in `listarReviews`, add `task_id` to the select and map it:

```ts
export async function listarReviews(): Promise<ReviewListItem[]> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("review_video")
    .select("id, titulo, status, task_id, created_at, clients(nome)")
    .order("created_at", { ascending: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, titulo: r.titulo, status: r.status, created_at: r.created_at,
    taskId: r.task_id ?? null,
    clienteNome: r.clients?.nome ?? null,
  }));
}
```

- [ ] **Step 2: List page — link to task + remove "Novo review"**

Replace the entire contents of `src/app/(authed)/audiovisual/review/page.tsx` with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { podeVerReview } from "@/lib/review/permissions";
import { listarReviews } from "@/lib/review/queries";
import { reviewHref } from "@/lib/review/nav";
import { STATUS_LABEL } from "@/lib/review/schema";
import { Badge } from "@/components/ui/badge";

export default async function ReviewListPage() {
  const user = await requireAuth();
  if (!podeVerReview(user)) redirect("/audiovisual");
  const reviews = await listarReviews();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Reviews de vídeo</h1>
        <p className="text-sm text-muted-foreground">Atalho pros vídeos em revisão — clique pra abrir na tarefa.</p>
      </header>
      <div className="space-y-2">
        {reviews.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum review ainda.</p> :
          reviews.map((r) => (
            <Link key={r.id} href={reviewHref(r.taskId, r.id)} className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/40">
              <div><p className="font-medium">{r.titulo}</p><p className="text-xs text-muted-foreground">{r.clienteNome ?? "Sem cliente"}</p></div>
              <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
            </Link>
          ))}
      </div>
    </div>
  );
}
```

(Trocamos o gate `canAccess(...,"manage:review")` por `podeVerReview` pra o assessor/coord que revisa também alcançar a lista; removemos o botão "Novo review" e os imports não usados `buttonVariants`, `Plus`, `canAccess`.)

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/review/queries.ts "src/app/(authed)/audiovisual/review/page.tsx"`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/review/queries.ts "src/app/(authed)/audiovisual/review/page.tsx"
git commit -m "feat(review): audiovisual vira atalho — lista linka pra tarefa"
```

---

## Task 7: Verificação final + PR

- [ ] **Step 1: Full suite**

Run: `npx vitest run --exclude '**/.claude/**'`
Expected: PASS (incluindo `permissions.test.ts` e `nav.test.ts` novos).

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors novos.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/review-inline-tarefa
gh pr create --title "feat(review): Review (Frame) inline na tarefa + audiovisual como atalho" \
  --body "Ver spec docs/superpowers/specs/2026-07-24-review-inline-na-tarefa-design.md. Sem migration. Botão Review abre o Frame num modal na tarefa; lista do audiovisual linka pra tarefa; removido 'Novo review' avulso (rotas legadas mantidas como fallback)."
```

- [ ] **Step 4: Aguardar CI verde + merge**

```bash
gh pr checks <n> --watch --interval 20
gh pr merge <n> --squash --delete-branch
```

---

## Notas

- **Rotas mantidas (fallback):** `/audiovisual/review/[id]` (vídeos sem tarefa) e `/audiovisual/review/novo` (não linkado). Não removidas pra não quebrar dados/links antigos.
- **Mobile:** o `DialogContent` usa `max-h-[92vh]` + scroll; validar visualmente pós-deploy que o player + comentários ficam usáveis no celular.
- **`router.refresh()` do `ReviewView`** (ao subir versão/aprovar) recarrega a página da tarefa por baixo do modal — atualiza o bloco de vídeos, comportamento desejado.
