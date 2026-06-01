# Editor IA — PR4: Render Shotstack + download + acesso (Implementation Plan)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Fechar o ciclo: do `EditPlan` revisado, montar o edit do Shotstack (com remapeamento de tempo por causa dos cortes), renderizar, baixar o MP4 pro Storage, e disponibilizar download. Habilitar o botão "Renderizar" e dar acesso pelo /audiovisual.

**Architecture:** `shotstack.ts` (puro: `buildShotstackEdit`/`remapTime` testáveis + HTTP `submitRender`/`getRenderStatus` com URL por ambiente). Worker ganha o passo `renderizando` (submete → faz poll → baixa → `pronto`). `renderizarAction` muda status pra `renderizando`. Timeline habilita Renderizar; página de detalhe mostra download quando `pronto`. Botão de entrada no /audiovisual (gated).

**Tech Stack:** Next.js, TS, Zod, Vitest. Shotstack API (`x-api-key`, URL `/edit/{stage|v1}/render`). Key fica em `SHOTSTACK_API_KEY`; ambiente em `SHOTSTACK_ENV` (`sandbox`|`production`, default sandbox).

**LER antes:** `src/lib/editor-ia/{tipos,queries,actions,storage}.ts`, `src/app/api/cron/editor-ia-worker/route.ts`, `src/components/editor-ia/TimelineRevisao.tsx`, `src/app/(authed)/audiovisual/editor-ia/[jobId]/page.tsx`, `src/components/yori/YoriEntryButton.tsx` (+ onde é usado em `src/app/(authed)/audiovisual/page.tsx`).

---

## Task 1: env SHOTSTACK_ENV
- Em `src/lib/env.ts` (serverSchema), adicionar `SHOTSTACK_ENV: z.enum(["sandbox","production"]).optional()`. `.env.example`: `SHOTSTACK_ENV=sandbox`.
- Commit: "feat(editor-ia): env SHOTSTACK_ENV".

## Task 2: serviço shotstack (TDD do builder)

**Files:** Create `src/lib/editor-ia/services/shotstack.ts`. Test: `tests/unit/editor-ia-shotstack.test.ts`.

- [ ] **Step 1: failing test** — `tests/unit/editor-ia-shotstack.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { mapearSegmentos, remapTime, buildShotstackEdit } from "@/lib/editor-ia/services/shotstack";
import type { EditPlan } from "@/lib/editor-ia/tipos";

describe("mapearSegmentos", () => {
  it("calcula posição na timeline de saída só pros keep", () => {
    const segs = [
      { start: 0, end: 2, keep: true },
      { start: 2, end: 5, keep: false },
      { start: 5, end: 6, keep: true },
    ];
    expect(mapearSegmentos(segs)).toEqual([
      { srcStart: 0, srcEnd: 2, outStart: 0, dur: 2 },
      { srcStart: 5, srcEnd: 6, outStart: 2, dur: 1 },
    ]);
  });
});

describe("remapTime", () => {
  const mapped = [
    { srcStart: 0, srcEnd: 2, outStart: 0, dur: 2 },
    { srcStart: 5, srcEnd: 6, outStart: 2, dur: 1 },
  ];
  it("tempo dentro de um keep vira tempo de saída", () => {
    expect(remapTime(1, mapped)).toBe(1);     // dentro do 1º keep
    expect(remapTime(5.5, mapped)).toBe(2.5); // dentro do 2º keep (5.5-5 + 2)
  });
  it("tempo num corte retorna null", () => {
    expect(remapTime(3, mapped)).toBeNull();
  });
});

describe("buildShotstackEdit", () => {
  it("monta tracks de vídeo + legenda remapeadas", () => {
    const plan: EditPlan = {
      segments: [
        { start: 0, end: 2, keep: true },
        { start: 2, end: 5, keep: false },
        { start: 5, end: 6, keep: true },
      ],
      captions: [
        { start: 0, end: 2, text: "oi" },
        { start: 3, end: 4, text: "cortado" },
        { start: 5, end: 6, text: "fim" },
      ],
    };
    const edit = buildShotstackEdit(plan, "https://x/video.mp4");
    const videoClips = edit.timeline.tracks[edit.timeline.tracks.length - 1].clips;
    expect(videoClips).toHaveLength(2);
    expect(videoClips[0]).toMatchObject({ start: 0, length: 2, asset: { type: "video", trim: 0 } });
    expect(videoClips[1]).toMatchObject({ start: 2, length: 1, asset: { type: "video", trim: 5 } });
    // legenda do trecho cortado some; as outras remapeiam
    const capClips = edit.timeline.tracks[0].clips;
    expect(capClips.map((c: { start: number }) => c.start)).toEqual([0, 2]);
    expect(edit.output.format).toBe("mp4");
  });
});
```
Run → FAIL.

- [ ] **Step 2: implement `src/lib/editor-ia/services/shotstack.ts`**
```typescript
// SERVER ONLY — cliente Shotstack (edit API).
import { getServerEnv } from "@/lib/env";
import type { EditPlan, EditSegment } from "../tipos";

export interface MappedSeg { srcStart: number; srcEnd: number; outStart: number; dur: number; }

/** Keep-segments com a posição correspondente na timeline de saída (comprimida). */
export function mapearSegmentos(segments: EditSegment[]): MappedSeg[] {
  const out: MappedSeg[] = [];
  let cursor = 0;
  for (const s of segments) {
    if (!s.keep) continue;
    const dur = Math.max(0, s.end - s.start);
    if (dur <= 0) continue;
    out.push({ srcStart: s.start, srcEnd: s.end, outStart: cursor, dur });
    cursor += dur;
  }
  return out;
}

/** Tempo do vídeo original → tempo na saída; null se cair num corte. */
export function remapTime(t: number, mapped: MappedSeg[]): number | null {
  for (const m of mapped) {
    if (t >= m.srcStart && t < m.srcEnd) return m.outStart + (t - m.srcStart);
  }
  return null;
}

function baseUrl(): string {
  const env = getServerEnv();
  const ambiente = env.SHOTSTACK_ENV === "production" ? "v1" : "stage";
  return `https://api.shotstack.io/edit/${ambiente}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildShotstackEdit(plan: EditPlan, videoUrl: string): any {
  const mapped = mapearSegmentos(plan.segments);

  const videoClips = mapped.map((m) => ({
    asset: { type: "video", src: videoUrl, trim: m.srcStart },
    start: m.outStart,
    length: m.dur,
  }));

  const captionClips = plan.captions
    .map((c) => {
      const outStart = remapTime(c.start, mapped);
      if (outStart === null) return null;
      const outEnd = remapTime(Math.max(c.start, c.end - 0.001), mapped);
      const length = outEnd !== null ? Math.max(0.3, outEnd - outStart) : 1;
      return {
        asset: { type: "caption", text: c.text },
        start: outStart,
        length,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return {
    timeline: { background: "#000000", tracks: [{ clips: captionClips }, { clips: videoClips }] },
    output: { format: "mp4", size: { width: 1080, height: 1920 } },
  };
}

export interface SubmitResult { ok: boolean; renderId?: string; error?: string; }

export async function submitRender(edit: unknown): Promise<SubmitResult> {
  const env = getServerEnv();
  const key = env.SHOTSTACK_API_KEY;
  if (!key) return { ok: false, error: "Shotstack não configurada" };
  try {
    const res = await fetch(`${baseUrl()}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(edit),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!res.ok) return { ok: false, error: `Shotstack ${res.status}: ${JSON.stringify(data).slice(0, 200)}` };
    const id = data?.response?.id ?? data?.id;
    return { ok: true, renderId: id ? String(id) : undefined };
  } catch (e) {
    return { ok: false, error: `Falha Shotstack: ${(e as Error).message}` };
  }
}

export interface RenderStatus { status: "queued" | "rendering" | "done" | "failed" | "unknown"; url: string | null; }

export async function getRenderStatus(renderId: string): Promise<RenderStatus> {
  const env = getServerEnv();
  const key = env.SHOTSTACK_API_KEY;
  if (!key) return { status: "unknown", url: null };
  try {
    const res = await fetch(`${baseUrl()}/render/${renderId}`, { headers: { "x-api-key": key } });
    const data = (await res.json().catch(() => ({}))) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const r = data?.response ?? data;
    const s = String(r?.status ?? "unknown");
    const map: Record<string, RenderStatus["status"]> = { queued: "queued", fetching: "rendering", rendering: "rendering", saving: "rendering", done: "done", failed: "failed" };
    return { status: map[s] ?? "unknown", url: (r?.url as string) ?? null };
  } catch {
    return { status: "unknown", url: null };
  }
}
```
Run test → PASS. tsc clean.
- Commit: "feat(editor-ia): serviço Shotstack (build edit + remap + render)".

## Task 3: worker passo renderizando + renderizarAction

- [ ] **queries.ts**: add `"renderizando"` to the `.in("status", [...])` of `listJobsToProcess`.
- [ ] **worker**: dispatcher `if (job.status === "renderizando") return processRenderizando(job);`. `processRenderizando`:
  - se NÃO tem `shotstack_render_id`: gerar signed URL do vídeo (`getSignedUrl(job.video_url)`), `buildShotstackEdit(job.edit_plan, signedUrl)`, `submitRender(edit)`; em ok grava `shotstack_render_id`; em erro → throw.
  - se TEM `shotstack_render_id`: `getRenderStatus(id)`; `done` → baixa o MP4 da URL (`fetch(url).arrayBuffer()`), `uploadOutput(outputPath, buffer, "video/mp4")` (criar `outputPath(orgId,userId,jobId)` no storage), grava `output_url` + status `pronto`; `failed` → throw; senão (rendering/queued) → noop (próximo tick).
  - (Adicionar helper `outputPath` em storage.ts: `${orgId}/${userId}/${jobId}/output.mp4`.)
- [ ] **actions.ts** `renderizarAction(formData)`: `requireEditorIaAccess`; pega `id`; valida job é do user/org e status `aguardando_revisao` com `edit_plan`; update status `renderizando`; revalidatePath. (Worker assume a partir daí.)
- tsc/lint/vitest. Commit: "feat(editor-ia): worker renderiza via Shotstack + renderizarAction".

## Task 4: UI — habilitar Renderizar + download + acesso

- [ ] **TimelineRevisao.tsx**: trocar o botão "Renderizar" `disabled` por um que chama `renderizarAction(jobId)` (useTransition + router.refresh). Mantém o "Salvar". (Renderizar só some o disabled.)
- [ ] **[jobId]/page.tsx**: quando `status === "pronto"` e `output_url`: gerar signed URL e mostrar **botão de download** (link). Quando `renderizando`: mensagem "Renderizando... (atualiza sozinho)".
- [ ] **Acesso pelo menu**: criar `src/components/editor-ia/EditorIaEntryButton.tsx` (client/link) e renderizar em `src/app/(authed)/audiovisual/page.tsx` **gated** por `isEditorIaEnabled() && canUseEditorIa(user.role)` (espelha o `YoriEntryButton`). Link pra `/audiovisual/editor-ia`.
- tsc/lint/build. Commit: "feat(editor-ia): habilita Renderizar + download + botão no /audiovisual".

## Verificação final + PR
- [ ] tsc/lint/vitest verdes. push + PR. Corpo: env `SHOTSTACK_ENV` (sandbox default); sem migration nova; fluxo completo (upload→transcrição→plano→revisão→render→download); validar em prod (key sandbox = watermark).

## Notas / riscos
- **Shotstack JSON a confirmar na prática**: `caption` asset e shape do `output.size` podem precptar ajuste fino contra a API real (codado pelo doc). `submitRender`/`getStatus` leem campos com fallback.
- Caption que cruza um corte: mantida só se o `start` cai num keep (simplificação MVP).
- Sandbox = watermark; trocar `SHOTSTACK_ENV=production` + key Production pra saída limpa.
- Worker `maxDuration` já é 300; render é assíncrono (poll a cada tick do cron).
