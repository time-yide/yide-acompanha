# Editor IA — Timeline de revisão (Implementation Plan)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Tela `/audiovisual/editor-ia/[jobId]` onde a usuária vê o `EditPlan` que a IA gerou (cortes + legendas) e ajusta manualmente: liga/desliga trechos, edita texto da legenda, salva. Inclui player do vídeo original pra referência. O botão "Renderizar" fica desabilitado (render = PR4/Shotstack). Sem dependência de Shotstack.

**Architecture:** Página de detalhe (server, guard) + `TimelineRevisao` (client) editando o `EditPlan` (PR1) e salvando via `salvarPlanoAction` (novo, valida `salvarPlanoSchema` do PR1). `getJob` passa a expor `user_id`/`organization_id` pro check de dono.

**Tech Stack:** Next.js (customizado), TS, Zod, Supabase, Vitest.

**LER antes:** `src/lib/editor-ia/{queries,actions,tipos,schema}.ts`, `src/lib/editor-ia/storage.ts` (`getSignedUrl`), `src/app/(authed)/audiovisual/yori/[jobId]/page.tsx` (padrão de guard + params Promise).

---

## Task 1: getJob com dono + salvarPlanoAction

**Files:** Modify `src/lib/editor-ia/queries.ts`, `src/lib/editor-ia/actions.ts`. Test: `tests/unit/editor-ia-salvar-plano.test.ts`.

- [ ] **Step 1: getJob expõe user_id + organization_id**

Em `src/lib/editor-ia/queries.ts`, mudar `getJob` pra selecionar e retornar `user_id` e `organization_id`:
- Trocar a assinatura pra `export async function getJob(id: string): Promise<(EditorIaJobRow & { user_id: string; organization_id: string }) | null>`.
- `.select(\`${COLS}, user_id, organization_id\`)`.
- O cast/retorno inclui os dois campos.

- [ ] **Step 2: failing test do schema do salvar (sanidade)**

`tests/unit/editor-ia-salvar-plano.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { salvarPlanoSchema } from "@/lib/editor-ia/schema";

const ID = "11111111-1111-1111-1111-111111111111";
describe("salvarPlanoSchema (timeline)", () => {
  it("aceita plano editado", () => {
    const r = salvarPlanoSchema.safeParse({
      id: ID,
      edit_plan: { segments: [{ start: 0, end: 2, keep: true }, { start: 2, end: 5, keep: false }], captions: [{ start: 0, end: 2, text: "oi" }] },
    });
    expect(r.success).toBe(true);
  });
  it("rejeita keep não-booleano", () => {
    const r = salvarPlanoSchema.safeParse({
      id: ID, edit_plan: { segments: [{ start: 0, end: 2, keep: "sim" }], captions: [] },
    });
    expect(r.success).toBe(false);
  });
});
```
Run → deve PASSAR já (salvarPlanoSchema existe do PR1). (Se passar de primeira, ok — é teste de regressão do contrato.)

- [ ] **Step 3: `salvarPlanoAction` em actions.ts**

Adicionar (seguindo o estilo do arquivo, `ActionResult`, `requireEditorIaAccess`, `createServiceRoleClient`):
```typescript
export async function salvarPlanoAction(formData: FormData): Promise<ActionResult> {
  const user = await requireEditorIaAccess();
  let edit_plan: unknown = null;
  const raw = formData.get("edit_plan");
  if (typeof raw === "string") { try { edit_plan = JSON.parse(raw); } catch { /* ignore */ } }

  const parsed = salvarPlanoSchema.safeParse({ id: formData.get("id"), edit_plan });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return { error: "Organização não encontrada" };

  // Só salva no próprio job da org
  const { data: upd, error } = await sb.from("editor_ia_jobs")
    .update({ edit_plan: parsed.data.edit_plan })
    .eq("id", parsed.data.id)
    .eq("organization_id", profile.organization_id)
    .select("id");
  if (error) return { error: error.message };
  if (!upd || upd.length === 0) return { error: "Job não encontrado" };

  revalidatePath(`/audiovisual/editor-ia/${parsed.data.id}`);
  return { success: true };
}
```
Adicionar `import { salvarPlanoSchema } from "./schema";` se faltar.

- [ ] **Step 4: tsc + lint + test**

Run: `npx tsc --noEmit 2>&1 | grep -i editor-ia || echo clean` ; `npx next lint 2>&1 | grep -i editor-ia || echo "lint clean"` ; `npx vitest run tests/unit/editor-ia-salvar-plano.test.ts`

- [ ] **Step 5: commit**
```bash
git add src/lib/editor-ia/queries.ts src/lib/editor-ia/actions.ts tests/unit/editor-ia-salvar-plano.test.ts
git commit -m "feat(editor-ia): salvarPlanoAction + getJob com dono/org

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Página de detalhe + TimelineRevisao

**Files:** Create `src/app/(authed)/audiovisual/editor-ia/[jobId]/page.tsx`, `src/components/editor-ia/TimelineRevisao.tsx`.

- [ ] **Step 1: `[jobId]/page.tsx` (server)**

Padrão do Yori `[jobId]`: `params: Promise<{ jobId }>`, `requireAuth`, `if (!canUseEditorIa(user.role)) redirect("/audiovisual")`, `if (!isEditorIaEnabled()) redirect("/audiovisual")`. `const job = await getJob(jobId)`; `if (!job) notFound()`; **check de dono**: `if (job.user_id !== user.id) redirect("/audiovisual/editor-ia")`. Gerar signed URL do vídeo original: `const videoUrl = job.video_url ? await getSignedUrl(job.video_url) : null`. Render:
- header com back link + status (`EDITOR_IA_STATUS_LABELS[job.status]`).
- se `job.status === "aguardando_revisao"` e `job.edit_plan`: `<TimelineRevisao jobId={job.id} videoUrl={videoUrl} editPlan={job.edit_plan as EditPlan} />`.
- senão: mensagem do estado atual (ex.: "Transcrevendo...", "Planejando...", "Pronto" com futuro download). Sem emoji/em-dash.
`export const dynamic = "force-dynamic";`

- [ ] **Step 2: `TimelineRevisao.tsx` (client)**

Props: `{ jobId: string; videoUrl: string | null; editPlan: EditPlan }`. Estado local do plano (segments/captions). UI simples (não precisa ser timeline gráfica):
- Se `videoUrl`: um `<video src={videoUrl} controls className="w-full max-h-[40vh]" />` pra referência.
- **Trechos** (segments): lista; cada item mostra `start–end` (formatado mm:ss) + um toggle "Manter / Cortar" (checkbox/botão) que altera `keep`. Trechos `keep=false` aparecem riscados/esmaecidos.
- **Legendas** (captions): lista; cada item com `start–end` + um `<input>`/`<textarea>` editável pro `text`.
- Botão **"Salvar"** → monta FormData (`id`, `edit_plan` = JSON.stringify do estado) → `salvarPlanoAction` → `router.refresh()` + feedback "Salvo".
- Botão **"Renderizar"** DESABILITADO com title "Disponível quando a conta Shotstack estiver configurada" (render = PR4).
- `useTransition` pro salvar; mostra erro inline. Sem emoji/em-dash.
Helper local `fmt(s: number)` → "m:ss".

- [ ] **Step 3: tsc + lint + build**

Run: `npx tsc --noEmit 2>&1 | grep -i editor-ia | grep -v web-push || echo clean` ; `npx next lint 2>&1 | grep -i editor-ia || echo "lint clean"` ; `npx next build 2>&1 | tail -20` (build pode falhar só por deps ausentes do worktree — confirmar que não é dos arquivos novos).

- [ ] **Step 4: commit**
```bash
git add "src/app/(authed)/audiovisual/editor-ia/[jobId]/" src/components/editor-ia/TimelineRevisao.tsx
git commit -m "feat(editor-ia): timeline de revisão (ajustar cortes + legenda)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final + PR
- [ ] tsc/lint/vitest verdes. push + PR (base main). Corpo: sem migration; a tela de revisão funciona; render fica desabilitado até Shotstack (PR4); menu ainda não (PR5/quando ligar).

## Notas
- Edita o mesmo `EditPlan` que o planejador gerou; o render (PR4) vai consumir esse `edit_plan` final.
- Check de dono via `job.user_id === user.id` (igual Yori) + salvar escopado por org.
- A lista da página `/audiovisual/editor-ia` já linka pra `[jobId]` (PR2), então a navegação fecha.
