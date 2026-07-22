# Frame por Blocos (múltiplos vídeos por tarefa) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Uma tarefa de vídeo (bloco) tem VÁRIOS vídeos; cada vídeo tem player, comentários, versões e **Aprovar/Pedir alteração/Baixar próprios** (status por vídeo). A tarefa lista os vídeos + "X/N aprovados"; o trabalho de review acontece na tela cheia por vídeo.

**Architecture:** Cada vídeo = um `review_video` (task_id). Status por vídeo (`review_video.status`: revisao_interna→aprovado/ajustes). A seção da tarefa vira uma **lista de vídeos**; abrir um vídeo leva à `ReviewView` (tela cheia), onde ficam a trava de assistir + Aprovar/Pedir alteração/Baixar. Substitui o Passo 3 (aprovação por tarefa) por aprovação por vídeo.

**Tech Stack:** Next.js App Router, Supabase service-role, Bunny, vitest.

---

## File structure
- Modify `src/lib/review/schema.ts` (+ `.test.ts`) — transições p/ `aprovado`.
- Modify `src/lib/review/queries.ts` — `getReviewsDaTarefa` (lista) + `carregarReview` ganha `taskId` + `assistidoPctVersaoAtual`.
- Modify `src/lib/review/tarefa-actions.ts` — `adicionarVideoAction` (novo vídeo no bloco).
- Modify `src/lib/review/actions.ts` — `aprovarVideoAction` (status→aprovado).
- Modify `src/components/review/ReviewView.tsx` — trava de assistir + Aprovar/Pedir alteração/Baixar por vídeo.
- Rewrite `src/components/review/VideoDaTarefa.tsx` — lista de vídeos do bloco + "Adicionar vídeo" + progresso.
- Modify `src/app/(authed)/tarefas/[id]/page.tsx` — passar a lista.
- Modify `src/app/(authed)/audiovisual/review/[id]/page.tsx` — calcular `podeAprovar`.

---

## Task 1: Transições p/ "aprovado" (TDD)

**Files:** Modify `src/lib/review/schema.ts` + `.test.ts`

- [ ] **Step 1: Atualizar transições** — em `schema.ts`, o `TRANSICOES`:
```ts
const TRANSICOES: Record<ReviewStatus, ReviewStatus[]> = {
  // Revisão interna: aprova o vídeo OU pede alteração.
  revisao_interna: ["aprovado", "ajustes", "revisao_cliente"],
  revisao_cliente: ["aprovado", "ajustes"],
  // Em ajustes: nova versão volta pra revisão; ou aprova direto.
  ajustes: ["revisao_interna", "aprovado", "revisao_cliente"],
  aprovado: [],
};
```

- [ ] **Step 2: Atualizar o teste** — em `schema.test.ts`, ajustar o teste de "pulos inválidos" (agora `revisao_interna → aprovado` É válido) e adicionar:
```ts
  it("aprovar vídeo direto da revisão interna é válido", () => {
    expect(podeTransicionar("revisao_interna", "aprovado")).toBe(true);
    expect(podeTransicionar("ajustes", "aprovado")).toBe(true);
  });
```
Remover/ajustar a asserção antiga `expect(podeTransicionar("revisao_interna", "aprovado")).toBe(false)` (se existir) pra não conflitar.

- [ ] **Step 3: Rodar**
Run: `npx vitest run src/lib/review/schema.test.ts --exclude '**/.claude/**'` → PASS.

- [ ] **Step 4: Commit**
```bash
git add src/lib/review/schema.ts src/lib/review/schema.test.ts
git commit -m "feat(frame-blocos): transições p/ aprovado (por vídeo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Queries (lista de vídeos + carregarReview enriquecido)

**Files:** Modify `src/lib/review/queries.ts`

- [ ] **Step 1: `getReviewsDaTarefa`** — adicionar ao fim do arquivo:
```ts
import { urlThumbnail } from "@/lib/bunny/client"; // (garantir import; já importa urlPlaylist/statusVideo/bunnyConfigurado)

export interface VideoDoBloco {
  reviewId: string;
  titulo: string;
  status: ReviewStatus;
  thumbUrl: string;
  versaoAtualId: string | null;
  prontoAtual: boolean;
  assistidoPct: number;
}

/** Todos os vídeos (review_video) de uma tarefa/bloco, com o essencial pra listar. */
export async function getReviewsDaTarefa(taskId: string, userId: string): Promise<VideoDoBloco[]> {
  const sb = createServiceRoleClient() as SB;
  const { data: rvs } = await sb
    .from("review_video")
    .select("id, titulo, status")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  const lista = (rvs ?? []) as Array<{ id: string; titulo: string; status: ReviewStatus }>;
  const out: VideoDoBloco[] = [];
  for (const rv of lista) {
    const { data: versoes } = await sb
      .from("review_versao")
      .select("id, bunny_video_id, pronto")
      .eq("review_video_id", rv.id)
      .order("numero", { ascending: false })
      .limit(1);
    const atual = (versoes ?? [])[0] as { id: string; bunny_video_id: string; pronto: boolean } | undefined;
    let assistidoPct = 0;
    if (atual) {
      const { data: a } = await sb.from("review_assistido").select("pct_max").eq("user_id", userId).eq("versao_id", atual.id).maybeSingle();
      assistidoPct = (a?.pct_max as number | undefined) ?? 0;
    }
    out.push({
      reviewId: rv.id, titulo: rv.titulo, status: rv.status,
      thumbUrl: atual ? urlThumbnail(atual.bunny_video_id) : "",
      versaoAtualId: atual?.id ?? null, prontoAtual: atual?.pronto ?? false, assistidoPct,
    });
  }
  return out;
}
```

- [ ] **Step 2: `carregarReview` ganha `taskId` + `assistidoPctVersaoAtual`** — na interface `ReviewFull` e na função:
1. Interface: `export interface ReviewFull { id: string; titulo: string; status: ReviewStatus; clienteNome: string | null; taskId: string | null; assistidoPctVersaoAtual: number; versoes: Versao[] }`
2. No SELECT do review, incluir `task_id`.
3. Depois de montar `vs`, calcular o assistido do usuário na versão atual (última) — MAS `carregarReview` não recebe userId hoje. **Mudar a assinatura** pra `carregarReview(id: string, userId: string)` e, no fim, buscar `review_assistido` da última versão pro `userId`. Atualizar o call-site em `src/app/(authed)/audiovisual/review/[id]/page.tsx` pra passar `user.id`.
4. Retornar `taskId: rv.task_id ?? null` e `assistidoPctVersaoAtual`.

- [ ] **Step 3: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "review/queries" | head; echo done` → só `done` (o call-site será ajustado no Task 6).

- [ ] **Step 4: Commit**
```bash
git add src/lib/review/queries.ts
git commit -m "feat(frame-blocos): lista de vídeos do bloco + carregarReview com assistido

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Actions (adicionar vídeo + aprovar vídeo)

**Files:** Modify `src/lib/review/tarefa-actions.ts` e `src/lib/review/actions.ts`

- [ ] **Step 1: `adicionarVideoAction`** — em `tarefa-actions.ts`, adicionar (SEMPRE cria um novo review_video no bloco):
```ts
export async function adicionarVideoAction(taskId: string, titulo: string): Promise<Res<{ reviewId: string; upload: UploadTus }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: task } = await sb.from("tasks").select("id, titulo, client_id").eq("id", taskId).maybeSingle();
  if (!task) return { error: "Tarefa não encontrada" };
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();
  const nome = titulo.trim() || task.titulo;
  const { data: rv, error } = await sb.from("review_video").insert({ organization_id: org?.id, cliente_id: task.client_id, task_id: taskId, titulo: nome, status: "revisao_interna", criado_por: user.id }).select("id").single();
  if (error || !rv) return { error: "Falha ao criar o vídeo" };
  let guid: string;
  try { guid = await criarVideo(nome); } catch { return { error: "Falha ao criar vídeo no Bunny (configuração?)" }; }
  await sb.from("review_versao").insert({ review_video_id: rv.id, numero: 1, bunny_video_id: guid, criado_por: user.id });
  revalidatePath(`/tarefas/${taskId}`);
  return { reviewId: rv.id, upload: assinaturaUpload(guid) };
}
```

- [ ] **Step 2: `aprovarVideoAction`** — em `actions.ts` (perto de `pedirAlteracaoAction`):
```ts
/** Aprova UM vídeo (review) — status vira "aprovado". */
export async function aprovarVideoAction(reviewId: string): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!pode(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;
  const { data: rv } = await sb.from("review_video").select("status").eq("id", reviewId).maybeSingle();
  if (!rv) return { error: "Vídeo não encontrado" };
  if (!podeTransicionar(rv.status as ReviewStatus, "aprovado")) return { error: "Não dá pra aprovar agora" };
  await sb.from("review_video").update({ status: "aprovado", updated_at: new Date().toISOString() }).eq("id", reviewId);
  revalidatePath(`/audiovisual/review/${reviewId}`);
  return { ok: true };
}
```

- [ ] **Step 3: Type-check + lint + testes**
Run:
```
npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && echo TYPECHECK_OK
npx eslint src/lib/review && echo LINT_OK
npx vitest run src/lib/review --exclude '**/.claude/**'
```

- [ ] **Step 4: Commit**
```bash
git add src/lib/review/tarefa-actions.ts src/lib/review/actions.ts
git commit -m "feat(frame-blocos): adicionar vídeo ao bloco + aprovar vídeo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: ReviewView — trava + Aprovar/Pedir alteração/Baixar por vídeo

**Files:** Modify `src/components/review/ReviewView.tsx`

- [ ] **Step 1:** Ajustar `ReviewView` pra receber `podeAprovar: boolean` além de `podeGerenciar`, e implementar:
  - **Watch tracking:** usar `onTime` do Player → guardar `pctVisto` (máx), salvar via `registrarAssistidoAction(versao.id, pct)` (throttle igual VideoDaTarefa), sementeando de `review.assistidoPctVersaoAtual`. Rearmar ao trocar versão.
  - **Trava:** `liberado = destravado(pctVisto)`.
  - **Botões (quando `podeAprovar` && `review.status !== "aprovado"`):** **Aprovar** (`aprovarVideoAction`), **Pedir alteração** (`pedirAlteracaoAction` — já existe; se em revisao_interna vai pra ajustes), ambos **disabled se `!liberado`**. Trocar o antigo "Aprovar internamente".
  - **Baixar:** botão que chama `linkDownloadAction(versao.id)` (de `tarefa-actions`), disabled se `!liberado`.
  - Manter versões + "Nova versão" (que já existe via `novaVersaoAction`).
  - Mostrar o aviso "Assista até o fim (X%/90%)" quando travado.
  - Importar de `@/lib/review/tarefa-actions`: `registrarAssistidoAction`, `linkDownloadAction`; de `@/lib/review/actions`: `aprovarVideoAction`, `pedirAlteracaoAction`, `novaVersaoAction`; de `@/lib/review/gate`: `PCT_MINIMO`, `destravado`.
  - A prop `review: ReviewFull` agora tem `assistidoPctVersaoAtual` — usar como semente.
  - Reusar o mesmo padrão de rearme (versão anterior) e throttle do `VideoDaTarefa`.

- [ ] **Step 2: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/components/review/ReviewView.tsx && echo OK`

- [ ] **Step 3: Commit**
```bash
git add src/components/review/ReviewView.tsx
git commit -m "feat(frame-blocos): ReviewView com trava + aprovar/pedir alteração/baixar por vídeo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: VideoDaTarefa — lista de vídeos do bloco

**Files:** Rewrite `src/components/review/VideoDaTarefa.tsx`

- [ ] **Step 1:** Reescrever como uma **lista** (não mais um player embutido):
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { UploadVersao } from "./UploadVersao";
import { adicionarVideoAction } from "@/lib/review/tarefa-actions";
import { STATUS_LABEL } from "@/lib/review/schema";
import type { VideoDoBloco } from "@/lib/review/queries";
import type { UploadTus } from "@/lib/bunny/client";
import { Plus, Video, Play } from "lucide-react";

export function VideoDaTarefa({ taskId, videos, podeGerenciar }: { taskId: string; videos: VideoDoBloco[]; podeGerenciar: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [upload, setUpload] = useState<{ reviewId: string; upload: UploadTus } | null>(null);

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
          <Link key={v.reviewId} href={`/audiovisual/review/${v.reviewId}`} className="flex items-center gap-3 rounded-lg border p-2 hover:bg-muted/40">
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
          </Link>
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
    </Card>
  );
}
```
> Nota: usa `<img>` pro thumb (eslint-disable já no lugar). `Image` do import pode sair se não usado — remover `import Image` se o lint reclamar.

- [ ] **Step 2: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/components/review/VideoDaTarefa.tsx && echo OK`

- [ ] **Step 3: Commit**
```bash
git add src/components/review/VideoDaTarefa.tsx
git commit -m "feat(frame-blocos): VideoDaTarefa vira lista de vídeos do bloco

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Integração nas páginas

**Files:** Modify `src/app/(authed)/tarefas/[id]/page.tsx` e `src/app/(authed)/audiovisual/review/[id]/page.tsx`

- [ ] **Step 1: página da tarefa** — trocar `getReviewDaTarefa` por `getReviewsDaTarefa` e a render:
```tsx
// import { getReviewsDaTarefa } from "@/lib/review/tarefa-queries";  → mover pra queries.ts
import { getReviewsDaTarefa } from "@/lib/review/queries";
...
const videosDaTarefa = task.tipo === "video" ? await getReviewsDaTarefa(task.id, user.id) : [];
...
{task.tipo === "video" && (
  <VideoDaTarefa taskId={task.id} videos={videosDaTarefa} podeGerenciar={podeVideo} />
)}
```
Remover os props antigos (`review`, `statusAprovacao`, `podeAprovar`, `podeEnviar`) que não existem mais.

- [ ] **Step 2: página do review** — `src/app/(authed)/audiovisual/review/[id]/page.tsx`:
  - Passar `user.id` no `carregarReview(id, user.id)`.
  - Calcular `podeAprovar`: se o review tem `taskId`, buscar a tarefa (`criado_por` / gestão) — reutilizar `canManageAnyTask` + comparar `task.criado_por === user.id`. Se sem task, `podeAprovar = canAccess(user.role,"manage:review")`.
  - Passar `podeAprovar` ao `<ReviewView>`.
```tsx
import { canAccess, canManageAnyTask } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
...
const review = await carregarReview(id, user.id);
if (!review) notFound();
let podeAprovar = canAccess(user.role, "manage:review");
if (review.taskId) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: t } = await sb.from("tasks").select("criado_por").eq("id", review.taskId).maybeSingle();
  podeAprovar = (t?.criado_por === user.id) || canManageAnyTask(user);
}
const podeGerenciar = canAccess(user.role, "manage:review");
return (<div className="mx-auto max-w-4xl"><ReviewView review={review} podeGerenciar={podeGerenciar} podeAprovar={podeAprovar} /></div>);
```

- [ ] **Step 3: Type-check + lint + testes**
Run:
```
npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && echo TYPECHECK_OK
npx eslint "src/app/(authed)/tarefas/[id]/page.tsx" "src/app/(authed)/audiovisual/review/[id]/page.tsx" src/components/review src/lib/review && echo LINT_OK
npx vitest run src/lib/review --exclude '**/.claude/**'
```

- [ ] **Step 4: Commit + PR (segurar merge)**
```bash
git add -A && git commit -m "feat(frame-blocos): integrar lista na tarefa + podeAprovar no review

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
git push -u origin feat/frame-blocos
gh pr create --base main --head feat/frame-blocos --title "feat: Frame por blocos (vários vídeos por tarefa, aprovação por vídeo)" --body "Tarefa (bloco) com vários vídeos; cada vídeo com player/comentários/versões e Aprovar/Pedir alteração/Baixar próprios (trava por vídeo). A tarefa lista os vídeos + X/N aprovados; o review acontece na tela cheia por vídeo. Sem migration nova. Spec/plan em docs/superpowers/."
```
> **Testar antes de usar pra valer** (Yasmin): adicionar 2+ vídeos numa tarefa, aprovar um e pedir alteração noutro, baixar o aprovado.

---

## Self-review (cobertura)
- Vários vídeos por tarefa (bloco) → Tasks 2, 5 ✓
- Aprovação/alteração POR vídeo (status por review) → Tasks 1, 3, 4 ✓
- Trava de assistir por vídeo + baixar por vídeo → Task 4 ✓
- Editor adiciona vários vídeos → Tasks 3, 5 ✓
- Progresso do bloco (X/N aprovados) → Task 5 ✓
- Review na tela cheia (que a Yasmin curtiu) → Task 4 ✓
- `getReviewDaTarefa` antigo (single) e o Passo 3 (aprovação por tarefa) são substituídos → Task 6 remove os usos.
- **Nota:** `tarefa-actions.ts` ainda tem `getReviewDaTarefa`/`criarReviewDaTarefaAction`/download antigos — manter `registrarAssistidoAction`/`linkDownloadAction`; remover só o que ficou órfão (checar imports no build).
