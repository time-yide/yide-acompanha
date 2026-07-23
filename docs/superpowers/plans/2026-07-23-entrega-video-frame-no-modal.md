# Entrega de vídeo sobe pro Frame no modal de conclusão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando o responsável conclui/envia pra aprovação uma tarefa de **vídeo**, o modal de entrega sobe o(s) arquivo(s) direto pro Frame (Bunny) em vez de pedir link do Drive.

**Architecture:** O modal `ConcludeOperationalModal` ganha um caminho de vídeo: seletor de arquivos → cria um frame por arquivo via `adicionarVideoAction` → upload TUS pro Bunny → conclui a tarefa via `concludeOperationalAction` (com `drive_link` agora opcional pra vídeo). A decisão vídeo-vs-Drive é um helper puro compartilhado (`isVideoDelivery`); a disponibilidade do Bunny é consultada por uma server action leve. Tarefas de arte/geral não mudam.

**Tech Stack:** Next.js (App Router, server actions), React client components, Supabase, Bunny Stream (TUS via `tus-js-client`), Zod, Vitest.

**Spec:** [docs/superpowers/specs/2026-07-23-entrega-video-frame-no-modal-design.md](../specs/2026-07-23-entrega-video-frame-no-modal-design.md)

---

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `src/lib/tarefas/delivery-roles.ts` | Helper puro `isVideoDelivery(tipo, role)` — fonte única da decisão vídeo-vs-Drive | Modificar |
| `src/lib/tarefas/delivery-roles.test.ts` | Testes do helper | Criar |
| `src/lib/tarefas/schema.ts` | `concludeOperationalSchema` com `drive_link` opcional | Modificar |
| `src/lib/tarefas/schema.test.ts` | Testes do schema | Criar |
| `src/lib/tarefas/actions.ts` | `concludeOperationalAction` — exige Drive só pra não-vídeo | Modificar |
| `src/lib/review/tarefa-actions.ts` | `bunnyDisponivelAction()` server action | Modificar |
| `src/lib/review/upload-tus.ts` | Helper client `uploadVideoTus(...)` (upload TUS reusável) | Criar |
| `src/components/review/UploadVersao.tsx` | Reusa o helper (DRY) | Modificar |
| `src/components/tarefas/ConcludeOperationalModal.tsx` | Ramifica corpo vídeo vs Drive | Modificar |

`TasksBoard.tsx` e `CompleteTaskButton.tsx` **não mudam** (o modal se vira sozinho).

---

## Task 1: Helper `isVideoDelivery`

**Files:**
- Modify: `src/lib/tarefas/delivery-roles.ts`
- Test: `src/lib/tarefas/delivery-roles.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/tarefas/delivery-roles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isVideoDelivery } from "./delivery-roles";

describe("isVideoDelivery", () => {
  it("tipo video → sempre vídeo, qualquer papel", () => {
    expect(isVideoDelivery("video", "assessor")).toBe(true);
    expect(isVideoDelivery("video", null)).toBe(true);
  });
  it("tipo arte → nunca vídeo", () => {
    expect(isVideoDelivery("arte", "videomaker")).toBe(false);
  });
  it("tipo geral → desempata pelo papel de vídeo", () => {
    for (const r of ["editor", "videomaker", "videomaker_mobile", "fast_midia", "audiovisual_chefe"]) {
      expect(isVideoDelivery("geral", r)).toBe(true);
    }
    for (const r of ["designer", "assessor", "coordenador", null]) {
      expect(isVideoDelivery("geral", r)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tarefas/delivery-roles.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `isVideoDelivery is not a function` / not exported.

- [ ] **Step 3: Add the helper**

Append to `src/lib/tarefas/delivery-roles.ts`:

```ts
// Papéis cujo material entregue é VÍDEO (vai pro Frame em vez de link do Drive).
// fast_midia funciona como videomaker (ver memória do projeto), então entra aqui.
export const VIDEO_ROLES = [
  "editor",
  "videomaker",
  "videomaker_mobile",
  "fast_midia",
  "audiovisual_chefe",
] as const;

/**
 * Decide se a entrega de uma tarefa é de vídeo (sobe pro Frame) ou não (link do
 * Drive). tipo 'video' → sempre; 'arte' → nunca; 'geral' → desempata pelo papel.
 * Fonte única usada pelo modal (client) e por concludeOperationalAction (server).
 */
export function isVideoDelivery(
  tipo: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (tipo === "video") return true;
  if (tipo === "arte") return false;
  return (VIDEO_ROLES as readonly string[]).includes(role ?? "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tarefas/delivery-roles.test.ts --exclude '**/.claude/**'`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarefas/delivery-roles.ts src/lib/tarefas/delivery-roles.test.ts
git commit -m "feat(tarefas): helper isVideoDelivery (fonte única vídeo-vs-Drive)"
```

---

## Task 2: `drive_link` opcional no schema

**Files:**
- Modify: `src/lib/tarefas/schema.ts:118-128`
- Test: `src/lib/tarefas/schema.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/lib/tarefas/schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { concludeOperationalSchema } from "./schema";

const base = { id: "11111111-1111-1111-1111-111111111111", to_status: "concluida", artes_entregues: 2 };

describe("concludeOperationalSchema", () => {
  it("aceita sem drive_link (caminho de vídeo)", () => {
    const r = concludeOperationalSchema.safeParse({ ...base });
    expect(r.success).toBe(true);
  });
  it("aceita com drive_link válido", () => {
    const r = concludeOperationalSchema.safeParse({ ...base, drive_link: "https://drive.google.com/x" });
    expect(r.success).toBe(true);
  });
  it("rejeita drive_link não-url quando presente", () => {
    const r = concludeOperationalSchema.safeParse({ ...base, drive_link: "nao-e-url" });
    expect(r.success).toBe(false);
  });
  it("exige artes_entregues >= 1", () => {
    const r = concludeOperationalSchema.safeParse({ ...base, artes_entregues: 0 });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tarefas/schema.test.ts --exclude '**/.claude/**'`
Expected: FAIL no primeiro caso — hoje `drive_link` é obrigatório (`z.string().url().max(500)`).

- [ ] **Step 3: Make `drive_link` optional**

In `src/lib/tarefas/schema.ts`, change the `drive_link` line inside `concludeOperationalSchema` from:

```ts
  drive_link: z.string().url("Link do Drive inválido").max(500),
```

to:

```ts
  drive_link: z.string().url("Link do Drive inválido").max(500).optional(),
```

Also update the doc comment above the schema (lines 112-117), replacing "Drive link e quantidade entregue obrigatórios" with:

```ts
 * Quantidade entregue obrigatória. Drive link obrigatório só pra entrega que
 * NÃO é vídeo (arte/geral); pra vídeo o material é o Frame — ver isVideoDelivery
 * e concludeOperationalAction.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/tarefas/schema.test.ts --exclude '**/.claude/**'`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarefas/schema.ts src/lib/tarefas/schema.test.ts
git commit -m "feat(tarefas): drive_link opcional em concludeOperationalSchema"
```

---

## Task 3: `concludeOperationalAction` exige Drive só pra não-vídeo

**Files:**
- Modify: `src/lib/tarefas/actions.ts:957-1042`

Contexto: hoje a action grava `drive_link: parsed.data.drive_link` sempre. Precisa: (a) buscar `tipo` da tarefa, (b) se for vídeo, aceitar Drive vazio e gravar `null`; se não for vídeo, exigir Drive.

- [ ] **Step 1: Import the helper**

At the top of `src/lib/tarefas/actions.ts`, add to the existing import from delivery-roles. Find the line importing `isRoleQueEntrega` (or similar) from `"./delivery-roles"` and add `isVideoDelivery`. If there is no such import line, add:

```ts
import { isVideoDelivery } from "./delivery-roles";
```

- [ ] **Step 2: Accept null drive_link in the parse**

In `concludeOperationalAction`, change the parse block (lines 960-966) so `drive_link` becomes `undefined` when absent/empty:

```ts
  const parsed = concludeOperationalSchema.safeParse({
    id: formData.get("id"),
    to_status: formData.get("to_status") || "concluida",
    drive_link: formData.get("drive_link") || undefined,
    artes_entregues: formData.get("artes_entregues"),
    entrega_observacoes: formData.get("entrega_observacoes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
```

- [ ] **Step 3: Fetch `tipo` and enforce Drive only for non-video**

Change the task select (line 973-977) to include `tipo`:

```ts
  const { data: task } = await sb
    .from("tasks")
    .select("id, tipo, atribuido_a, status, criado_por, participantes_ids")
    .eq("id", parsed.data.id)
    .single();
  if (!task) return { error: "Tarefa não encontrada" };
```

Then, right after the `assignee` fetch + `isRoleQueEntrega` guard (after line 989), add:

```ts
  // Entrega de vídeo sobe pro Frame (drive_link opcional); as demais exigem link.
  const videoDelivery = isVideoDelivery(task.tipo, assignee.role);
  const driveLink = (parsed.data.drive_link ?? "").trim();
  if (!videoDelivery && !driveLink) {
    return { error: "Informe o link do Drive do material entregue" };
  }
```

- [ ] **Step 4: Persist null drive_link when empty**

Change the `updatePayload` (lines 1008-1013) and the audit `dados_depois` (lines 1030-1035) to use `driveLink || null` instead of `parsed.data.drive_link`:

```ts
  const updatePayload: Record<string, unknown> = {
    status: parsed.data.to_status,
    drive_link: driveLink || null,
    artes_entregues: parsed.data.artes_entregues,
    entrega_observacoes: parsed.data.entrega_observacoes ?? null,
  };
```

and in `logAudit(... dados_depois ...)`:

```ts
    dados_depois: {
      status: parsed.data.to_status,
      drive_link: driveLink || null,
      artes_entregues: parsed.data.artes_entregues,
      entrega_observacoes: parsed.data.entrega_observacoes ?? null,
    } as unknown as Record<string, unknown>,
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tarefas/actions.ts
git commit -m "feat(tarefas): concludeOperationalAction exige Drive só pra não-vídeo"
```

---

## Task 4: Server action `bunnyDisponivelAction`

**Files:**
- Modify: `src/lib/review/tarefa-actions.ts`

- [ ] **Step 1: Import `bunnyConfigurado`**

In `src/lib/review/tarefa-actions.ts`, extend the existing import from `"@/lib/bunny/client"` (currently `import { criarVideo, assinaturaUpload, urlDownloadMp4, type UploadTus } from "@/lib/bunny/client";`) to also import `bunnyConfigurado`:

```ts
import { criarVideo, assinaturaUpload, urlDownloadMp4, bunnyConfigurado, type UploadTus } from "@/lib/bunny/client";
```

- [ ] **Step 2: Add the action**

Append to `src/lib/review/tarefa-actions.ts`:

```ts
/** true se o Bunny está configurado — o modal usa pra decidir upload vs link do Drive. */
export async function bunnyDisponivelAction(): Promise<boolean> {
  await requireAuth();
  return bunnyConfigurado();
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/review/tarefa-actions.ts
git commit -m "feat(review): bunnyDisponivelAction pro modal de entrega"
```

---

## Task 5: Helper client `uploadVideoTus` + reuso no `UploadVersao`

**Files:**
- Create: `src/lib/review/upload-tus.ts`
- Modify: `src/components/review/UploadVersao.tsx`

- [ ] **Step 1: Create the helper**

Create `src/lib/review/upload-tus.ts`:

```ts
"use client";

import * as tus from "tus-js-client";
import type { UploadTus } from "@/lib/bunny/client";

/**
 * Sobe um arquivo pro Bunny via TUS. Resolve quando o upload dos BYTES termina
 * (não espera o Bunny processar). Rejeita em erro de upload.
 */
export function uploadVideoTus(
  file: File,
  upload: UploadTus,
  titulo: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
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
      onError: (err) => reject(err),
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    up.start();
  });
}
```

- [ ] **Step 2: Refactor `UploadVersao` to use it**

In `src/components/review/UploadVersao.tsx`, replace the `enviar` function (lines 17-44) with:

```ts
  async function enviar(file: File) {
    setProg(0);
    try {
      await uploadVideoTus(file, upload, titulo, setProg);
    } catch {
      setProg(null);
      toast.error("Falha no upload.");
      return;
    }
    setProg(null);
    toast.success("Enviado! Processando o vídeo…");
    // Poll status até ficar pronto (até ~2 min).
    for (let i = 0; i < 40; i++) {
      const r = await confirmarProntoAction(reviewId, upload.videoId);
      if (!("error" in r) && r.pronto) break;
      await new Promise((res) => setTimeout(res, 3000));
    }
    router.refresh();
  }
```

Then update the imports at the top of the file: remove `import * as tus from "tus-js-client";` and add `import { uploadVideoTus } from "@/lib/review/upload-tus";`. Keep the `confirmarProntoAction`, `type UploadTus`, `toast`, icon, and `Button` imports.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/review/upload-tus.ts src/components/review/UploadVersao.tsx
git commit -m "refactor(review): extrai uploadVideoTus reusável"
```

---

## Task 6: Ramificar `ConcludeOperationalModal` (vídeo vs Drive)

**Files:**
- Modify: `src/components/tarefas/ConcludeOperationalModal.tsx`

Reescreve o componente mantendo os mesmos props. Adiciona: detecção de vídeo (`isVideoDelivery`), checagem de Bunny (`bunnyDisponivelAction`), seletor multi-arquivo, upload por arquivo (`adicionarVideoAction` + `uploadVideoTus`) e, no fim, `concludeOperationalAction` sem drive_link. O caminho Drive (arte/geral, ou vídeo sem Bunny) fica igual ao de hoje.

- [ ] **Step 1: Replace the file**

Replace the entire contents of `src/components/tarefas/ConcludeOperationalModal.tsx` with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { concludeOperationalAction } from "@/lib/tarefas/actions";
import { isVideoDelivery } from "@/lib/tarefas/delivery-roles";
import { adicionarVideoAction, bunnyDisponivelAction } from "@/lib/review/tarefa-actions";
import { uploadVideoTus } from "@/lib/review/upload-tus";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTipo: "geral" | "video" | "arte";
  /**
   * Role do atribuído. Desempata quando `taskTipo === "geral"`: papéis de vídeo
   * (editor/videomaker/fast_midia/audiovisual_chefe) → sobe pro Frame; designer
   * → artes (link do Drive).
   */
  atribuidoRole?: string | null;
  /** Pra qual status estamos movendo. Default: "concluida". */
  toStatus?: "concluida" | "em_aprovacao";
  onSuccess: () => void;
}

const TITLE: Record<"concluida" | "em_aprovacao", string> = {
  concluida: "Concluir entrega operacional",
  em_aprovacao: "Enviar pra aprovação",
};

const DESCRIPTION: Record<"concluida" | "em_aprovacao", string> = {
  concluida: 'Antes de mover pra "Concluído Operacional", informe onde estão os materiais finais.',
  em_aprovacao: "Antes de enviar pra aprovação, informe onde estão os materiais pro cliente revisar.",
};

const SUCCESS_MSG: Record<"concluida" | "em_aprovacao", string> = {
  concluida: "Tarefa concluída e materiais registrados",
  em_aprovacao: "Tarefa enviada pra aprovação com materiais registrados",
};

/** Label de quantidade pro caminho Drive (arte/itens). */
function resolveQtdLabel(taskTipo: "geral" | "video" | "arte", atribuidoRole: string | null | undefined): string {
  if (isVideoDelivery(taskTipo, atribuidoRole)) return "Quantos vídeos foram entregues?";
  if (taskTipo === "arte" || atribuidoRole === "designer") return "Quantas artes foram entregues?";
  return "Quantos itens foram entregues?";
}

export function ConcludeOperationalModal({ open, onOpenChange, taskId, taskTipo, atribuidoRole, toStatus = "concluida", onSuccess }: Props) {
  const isVideo = isVideoDelivery(taskTipo, atribuidoRole);

  // Caminho Drive (arte/geral, ou vídeo sem Bunny)
  const [driveLink, setDriveLink] = useState("");
  const [qtd, setQtd] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Caminho vídeo (Frame)
  const [bunnyOk, setBunnyOk] = useState<boolean | null>(isVideo ? null : false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [sending, setSending] = useState(false);

  // Ao abrir uma tarefa de vídeo, descobre se o Bunny está disponível.
  useEffect(() => {
    if (!open || !isVideo) return;
    let vivo = true;
    setBunnyOk(null);
    bunnyDisponivelAction().then((ok) => { if (vivo) setBunnyOk(ok); });
    return () => { vivo = false; };
  }, [open, isVideo]);

  const useVideoFlow = isVideo && bunnyOk === true;

  function reset() {
    setDriveLink("");
    setQtd("");
    setObservacoes("");
    setFiles([]);
    setProgress({});
  }

  const driveValid = driveLink.trim().length > 0 && qtd.trim().length > 0 && /^\d+$/.test(qtd) && Number(qtd) >= 1;
  const videoValid = files.length > 0 && !sending;

  async function handleConfirmVideo() {
    if (files.length === 0 || sending) return;
    setSending(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const titulo = files.length > 1 ? `Vídeo ${i + 1}` : "";
        const r = await adicionarVideoAction(taskId, titulo);
        if ("error" in r) throw new Error(r.error);
        await uploadVideoTus(files[i], r.upload, titulo || `Vídeo ${i + 1}`, (pct) =>
          setProgress((p) => ({ ...p, [i]: pct })),
        );
      }
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("to_status", toStatus);
      fd.set("artes_entregues", String(files.length));
      if (observacoes.trim()) fd.set("entrega_observacoes", observacoes.trim());
      const c = await concludeOperationalAction(fd);
      if (c.error) throw new Error(c.error);
      toast.success(SUCCESS_MSG[toStatus]);
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao subir os vídeos");
    } finally {
      setSending(false);
    }
  }

  function handleConfirmDrive() {
    if (!driveValid || sending) return;
    setSending(true);
    (async () => {
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("to_status", toStatus);
      fd.set("drive_link", driveLink);
      fd.set("artes_entregues", qtd);
      if (observacoes.trim()) fd.set("entrega_observacoes", observacoes.trim());
      const r = await concludeOperationalAction(fd);
      setSending(false);
      if (r.error) { toast.error(r.error); return; }
      toast.success(SUCCESS_MSG[toStatus]);
      reset();
      onOpenChange(false);
      onSuccess();
    })();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!sending) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLE[toStatus]}</DialogTitle>
          <DialogDescription>
            {useVideoFlow ? "Suba o(s) vídeo(s) desta tarefa — vão pro Frame pra revisão interna." : DESCRIPTION[toStatus]}
          </DialogDescription>
        </DialogHeader>

        {isVideo && bunnyOk === null ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
          </div>
        ) : useVideoFlow ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="videos">Vídeos da entrega *</Label>
              <Input
                id="videos"
                type="file"
                accept="video/*"
                multiple
                disabled={sending}
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                  {files.map((f, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">{f.name}</span>
                      <span>{sending ? `${progress[i] ?? 0}%` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações da entrega</Label>
              <Textarea
                id="obs"
                placeholder="Algo importante pro assessor saber? (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={sending}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="drive_link">Link do Drive *</Label>
              <Input
                id="drive_link"
                type="url"
                placeholder="https://drive.google.com/..."
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                disabled={sending}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qtd">{resolveQtdLabel(taskTipo, atribuidoRole)} *</Label>
              <Input
                id="qtd"
                type="number"
                min="1"
                max="999"
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                disabled={sending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações da entrega</Label>
              <Textarea
                id="obs"
                placeholder="Algo importante pro assessor saber? (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={sending}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={useVideoFlow ? handleConfirmVideo : handleConfirmDrive}
            disabled={(useVideoFlow ? !videoValid : !driveValid) || sending || (isVideo && bunnyOk === null)}
          >
            {sending ? "Enviando…" : toStatus === "em_aprovacao" ? "Enviar pra aprovação" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors in the touched files.

- [ ] **Step 4: Commit**

```bash
git add src/components/tarefas/ConcludeOperationalModal.tsx
git commit -m "feat(tarefas): modal de entrega sobe vídeo pro Frame (fallback Drive)"
```

---

## Task 7: Verificação final + PR

- [ ] **Step 1: Full test run**

Run: `npx vitest run --exclude '**/.claude/**'`
Expected: PASS (incluindo os novos `delivery-roles.test.ts` e `schema.test.ts`).

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/entrega-video-frame
gh pr create --title "feat(tarefas): entrega de vídeo sobe pro Frame no modal de conclusão" \
  --body "Ver spec docs/superpowers/specs/2026-07-23-entrega-video-frame-no-modal-design.md. Sem migration. Requer Bunny configurado; sem Bunny, o modal cai no formato antigo (link do Drive)."
```

- [ ] **Step 4: Aguardar CI verde e mergear** (conforme prática do projeto)

```bash
gh pr checks <n> --watch --interval 15
gh pr merge <n> --squash --delete-branch
```

---

## Notas de risco / follow-up

- **Bunny em produção:** se as envs `BUNNY_STREAM_*` não estiverem setadas em prod, o modal usa o caminho Drive — o objetivo do design só vale com Bunny ligado. Confirmar com a Yasmin.
- **Ator sem `manage:review`:** se um assessor (que não tem `manage:review`) concluir uma tarefa de vídeo, `adicionarVideoAction` retorna "Sem permissão" e o toast mostra. Caso real de vídeo é o assignee (editor/videomaker), que tem permissão. Fora de escopo tratar diferente.
- **Falha parcial:** se um upload falhar no meio, os frames já criados ficam visíveis na página da tarefa e a tarefa NÃO move. Reabrir o modal e confirmar de novo cria frames adicionais (aceito — "sempre pede upload").
- **Processamento do Bunny:** o modal fecha ao terminar os bytes; o "pronto" é confirmado depois, ao abrir o Frame (mecanismo existente em `UploadVersao`/`confirmarProntoAction`).
