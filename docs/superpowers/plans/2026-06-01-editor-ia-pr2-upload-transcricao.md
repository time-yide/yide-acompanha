# Editor IA — PR2: Upload + Transcrição (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Subir um vídeo + instrução, criar o job, e transcrever (Groq) via cron worker — chegando ao status `planejando` (PR3 faz o plano). Inclui a página "Novo" e a lista de jobs.

**Architecture:** Espelha o pipeline do Yori (`createYoriJobAction` + `/api/cron/yori-worker`). Reusa `transcribeAudio` (`@/lib/yori/services/groq-whisper`). Storage próprio no bucket `editor-ia`. PR1 já criou tabela/tipos/schema/flag.

**Tech Stack:** Next.js (customizado — conferir `node_modules/next/dist/docs/` p/ route handlers/`revalidatePath`), TS, Zod, Supabase, Vitest. Migration do PR1 deve estar aplicada (a tabela `editor_ia_jobs` é usada aqui).

**Padrões a LER antes:** `src/lib/yori/storage.ts`, `src/lib/yori/actions.ts` (createYoriJobAction, requireYoriAccess), `src/app/api/cron/yori-worker/route.ts`, `src/app/(authed)/audiovisual/yori/novo/page.tsx`, `src/lib/yori/services/groq-whisper.ts` (assinatura `transcribeAudio(buffer, filename)` → `{ok, transcription, cost_brl, error}`).

---

## Task 1: Storage + queries do editor-ia

**Files:** Create `src/lib/editor-ia/storage.ts`, `src/lib/editor-ia/queries.ts`. Test: `tests/unit/editor-ia-storage.test.ts`.

- [ ] **Step 1: failing test (path helper puro)**

`tests/unit/editor-ia-storage.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { videoPath } from "@/lib/editor-ia/storage";

describe("videoPath", () => {
  it("monta caminho org/user/job/arquivo sanitizado", () => {
    expect(videoPath("o1", "u1", "j1", "meu video!.mp4")).toBe("o1/u1/j1/meu_video_.mp4");
  });
});
```
Run → FAIL.

- [ ] **Step 2: `src/lib/editor-ia/storage.ts`** (mirror yori/storage.ts, bucket `editor-ia`)
```typescript
// SERVER ONLY — storage do Editor IA (bucket único 'editor-ia').
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BUCKET = "editor-ia";

export function videoPath(orgId: string, userId: string, jobId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${orgId}/${userId}/${jobId}/${safe}`;
}

export async function uploadVideo(
  orgId: string, userId: string, jobId: string, filename: string, buffer: ArrayBuffer, contentType: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const sb = createServiceRoleClient();
  const path = videoPath(orgId, userId, jobId, filename);
  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function downloadFile(path: string): Promise<Buffer | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function uploadOutput(
  path: string, content: string | ArrayBuffer, contentType: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const sb = createServiceRoleClient();
  const { error } = await sb.storage.from(BUCKET).upload(path, content, { contentType, upsert: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}
```
Run test → PASS.

- [ ] **Step 3: `src/lib/editor-ia/queries.ts`**
```typescript
// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { EditorIaStatus } from "./tipos";

export interface EditorIaJobRow {
  id: string;
  status: EditorIaStatus;
  instrucao: string | null;
  video_url: string | null;
  video_duracao_segundos: number | null;
  transcricao: unknown | null;
  edit_plan: unknown | null;
  output_url: string | null;
  srt_url: string | null;
  erro: string | null;
  created_at: string;
}

const COLS = "id, status, instrucao, video_url, video_duracao_segundos, transcricao, edit_plan, output_url, srt_url, erro, created_at";

export async function listMeusJobs(userId: string, limit = 50): Promise<EditorIaJobRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data, error } = await sb.from("editor_ia_jobs").select(COLS)
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  if (error) { console.error("[editor-ia] listMeusJobs", error.message); return []; }
  return (data ?? []) as EditorIaJobRow[];
}

export async function getJob(id: string): Promise<EditorIaJobRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb.from("editor_ia_jobs").select(COLS).eq("id", id).maybeSingle();
  return (data as EditorIaJobRow | null) ?? null;
}

/** Jobs que o worker deve avançar (transcrevendo/planejando). */
export async function listJobsToProcess(limit = 5): Promise<Array<EditorIaJobRow & { video_path: string | null; user_id: string; organization_id: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb.from("editor_ia_jobs")
    .select(`${COLS}, video_path, user_id, organization_id`)
    .in("status", ["transcrevendo", "planejando"])
    .order("created_at", { ascending: true }).limit(limit);
  return (data ?? []) as Array<EditorIaJobRow & { video_path: string | null; user_id: string; organization_id: string }>;
}
```
> Nota: a tabela do PR1 não tem coluna `video_path` (só `video_url`). **Adicionar `video_path text` à tabela** — incluir um pequeno alter na migration do PR2 (Task 1.5) OU reusar `video_url` pra guardar o path interno. DECISÃO: usar `video_url` pra guardar o **path** do Storage (privado) e gerar signed URL on-demand. Ajustar o select acima: trocar `video_path` por usar `video_url` como path. (O implementador deve alinhar: usar `video_url` como path do storage; remover referências a `video_path`.)

- [ ] **Step 4: type-check + test**

Run: `npx tsc --noEmit 2>&1 | grep -i editor-ia || echo clean` ; `npx vitest run tests/unit/editor-ia-storage.test.ts`

- [ ] **Step 5: commit**
```bash
git add src/lib/editor-ia/storage.ts src/lib/editor-ia/queries.ts tests/unit/editor-ia-storage.test.ts
git commit -m "feat(editor-ia): storage (bucket editor-ia) + queries de jobs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Ação de criar job (upload)

**Files:** Create `src/lib/editor-ia/actions.ts`.

- [ ] **Step 1: `actions.ts`** — `requireEditorIaAccess()` (mirror `requireYoriAccess` do Yori: requireAuth + canUseEditorIa + isEditorIaEnabled, redirect/error se não) e `criarJobAction(formData)`:
  - lê `video` (File) + `instrucao` + `video_duracao_segundos`; valida com `criarJobSchema`.
  - pega orgId do profile.
  - insere `editor_ia_jobs` (status `enviando`, instrucao, video_duracao_segundos).
  - faz upload via `uploadVideo(orgId, user.id, job.id, filename, buffer, type)`.
  - em sucesso: update `video_url = path`, status `transcrevendo`; em falha: status `erro` + erro.
  - `revalidatePath("/audiovisual/editor-ia")`; retorna `{ jobId }`.
  Seguir EXATAMENTE o estilo de `createYoriJobAction` (ler o arquivo). Permissão via `requireEditorIaAccess`.

- [ ] **Step 2: type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -i editor-ia || echo clean` ; `npx next lint 2>&1 | grep -i editor-ia || echo "lint clean"`

- [ ] **Step 3: commit**
```bash
git add src/lib/editor-ia/actions.ts
git commit -m "feat(editor-ia): criarJobAction (upload do vídeo)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Cron worker — passo de transcrição

**Files:** Create `src/app/api/cron/editor-ia-worker/route.ts`. Modify `vercel.json` (se houver cron config) — senão, deixar a rota e a usuária/Vercel agenda depois.

- [ ] **Step 1: route handler** (mirror `yori-worker`):
  - `GET` autenticado por `Bearer CRON_SECRET`.
  - `listJobsToProcess(5)`; pra cada job, `processJob`:
    - status `transcrevendo`: `downloadFile(job.video_url)` → `transcribeAudio(buffer, filename)` → grava `transcricao`, status `planejando`. (filename: derivar do path.)
    - status `planejando`: **no-op por enquanto** (`return "noop:aguardando-PR3"`) — PR3 implementa o plano.
  - try/catch por job → em erro, update status `erro` + `erro`.
  - `export const dynamic = "force-dynamic";`

- [ ] **Step 2: verificar `vercel.json` / agendamento**

READ `vercel.json` na raiz. Se existir bloco de crons do yori-worker, adicionar um cron pro `editor-ia-worker` (ex.: a cada 30-60s) seguindo o mesmo formato. Se não houver `vercel.json`, NÃO criar — só deixar a rota (a usuária agenda no painel Vercel depois); anotar isso no relatório.

- [ ] **Step 3: type-check + lint + suite**

Run: `npx tsc --noEmit 2>&1 | grep -iE "editor-ia|cron/editor" || echo clean` ; `npx next lint 2>&1 | grep -i editor-ia || echo "lint clean"` ; `npx vitest run 2>&1 | tail -3`

- [ ] **Step 4: commit**
```bash
git add src/app/api/cron/editor-ia-worker/route.ts vercel.json 2>/dev/null
git commit -m "feat(editor-ia): cron worker - passo de transcrição (Groq)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Páginas Novo + Lista

**Files:** Create `src/app/(authed)/audiovisual/editor-ia/page.tsx`, `src/app/(authed)/audiovisual/editor-ia/novo/page.tsx`, `src/components/editor-ia/NovoJobForm.tsx`.

Seguir o padrão das páginas do Yori (`src/app/(authed)/audiovisual/yori/page.tsx` e `novo/page.tsx`): guard com `requireEditorIaAccess` (que já checa role + flag + redirect). LER esses arquivos.

- [ ] **Step 1: `/audiovisual/editor-ia/page.tsx`** — lista `listMeusJobs(user.id)` com status (labels de `EDITOR_IA_STATUS_LABELS`) + link pra `/audiovisual/editor-ia/[jobId]` (detalhe vem no PR5) + botão "Novo". Guard `requireEditorIaAccess`.
- [ ] **Step 2: `/audiovisual/editor-ia/novo/page.tsx`** — renderiza `<NovoJobForm />`. Guard.
- [ ] **Step 3: `NovoJobForm.tsx`** (client) — input de arquivo (video/*), textarea de instrução, captura `video.duration` no client (carregando metadata) pra mandar `video_duracao_segundos`, submete via `criarJobAction` (FormData), `router.push('/audiovisual/editor-ia')` no sucesso. Sem emoji/em-dash.

- [ ] **Step 4: type-check + lint + build**

Run: `npx tsc --noEmit 2>&1 | grep -i editor-ia | grep -v web-push || echo clean` ; `npx next lint 2>&1 | grep -i editor-ia || echo "lint clean"` ; `npx next build 2>&1 | tail -20` (build pode falhar só por deps ausentes do worktree).

- [ ] **Step 5: commit**
```bash
git add "src/app/(authed)/audiovisual/editor-ia/" src/components/editor-ia/
git commit -m "feat(editor-ia): páginas Novo + Lista de jobs

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final + PR (PR2)
- [ ] tsc/lint/vitest verdes. push + PR (base main). Corpo: nota que **não tem migration nova** (usa a do PR1, que deve estar aplicada); módulo segue oculto do menu (entra no PR5); cron precisa ser agendado na Vercel.

## Notas
- **Sem coluna `video_path`**: usar `video_url` pra guardar o path do Storage (privado); signed URL on-demand. Alinhar todas as referências.
- Cron: a rota existe; o agendamento real (Vercel cron) a usuária configura — ou adiciona em `vercel.json` se o projeto usa esse padrão.
- Próximo: PR3 (planejador IA — passo `planejando` → `aguardando_revisao`).
