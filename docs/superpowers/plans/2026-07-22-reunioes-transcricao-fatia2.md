# Reuniões — Fatia 2 (Transcrição automática) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Depois que uma reunião é gravada (Fatia 1), transcrever o áudio automaticamente via Groq Whisper e mostrar a transcrição na tela de detalhe.

**Architecture:** `registrarGravacaoAction` passa a enfileirar um job (`meeting_processing_jobs`, step `transcription`) e deixa o meeting em `processing`. Um cron worker (`/api/cron/reunioes-worker`, a cada 2 min, padrão idêntico ao `editor-ia-worker`) pega jobs pendentes, baixa o áudio do bucket, chama `transcribeAudio` (Groq — já existe), grava `meeting_transcripts` (texto + segmentos) e marca `transcript_ready` + meeting `completed`. `getMeetingById` passa a carregar a transcrição.

**Tech Stack:** Next.js API route (cron), Supabase service-role + Storage, Groq Whisper (`src/lib/yori/services/groq-whisper.ts`), vitest.

---

## File Structure
- Modify: `src/lib/reunioes/storage.ts` — add `downloadRecording(path)`.
- Create: `src/lib/reunioes/transcript.ts` — `wordsToSegments(words)` (puro).
- Create: `src/lib/reunioes/transcript.test.ts`.
- Modify: `src/lib/reunioes/gravacao-actions.ts` — `registrarGravacaoAction` enfileira job + status `processing`.
- Create: `src/app/api/cron/reunioes-worker/route.ts` — worker de transcrição.
- Modify: `vercel.json` — registrar o cron.
- Modify: `src/lib/reunioes/queries.ts` — `getMeetingById` carrega `meeting_transcripts`.

---

### Task 1: `downloadRecording` no storage

**Files:** Modify `src/lib/reunioes/storage.ts`

- [ ] **Step 1: Adicionar a função** (depois de `getSignedPlaybackUrl`)

```ts
/** Baixa o arquivo do bucket como Buffer (pro worker transcrever). */
export async function downloadRecording(path: string): Promise<Buffer | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit 2>&1 | grep -i storage` limpo.
- [ ] **Step 3: Commit** — `feat(reunioes): downloadRecording no storage`

---

### Task 2: `wordsToSegments` (TDD)

**Files:** Create `src/lib/reunioes/transcript.ts` + `src/lib/reunioes/transcript.test.ts`

- [ ] **Step 1: Teste**

```ts
// src/lib/reunioes/transcript.test.ts
import { describe, it, expect } from "vitest";
import { wordsToSegments } from "./transcript";

describe("wordsToSegments", () => {
  it("agrupa palavras em segmentos por janela de tempo", () => {
    const words = [
      { word: "Oi", start: 0, end: 0.5 },
      { word: "tudo", start: 0.6, end: 1.0 },
      { word: "bem", start: 1.1, end: 1.5 },
      { word: "então", start: 20, end: 20.4 },
      { word: "vamos", start: 20.5, end: 21 },
    ];
    const segs = wordsToSegments(words, 12);
    expect(segs.length).toBe(2);
    expect(segs[0].text).toBe("Oi tudo bem");
    expect(segs[0].start).toBe(0);
    expect(segs[1].text).toBe("então vamos");
    expect(segs[1].start).toBe(20);
    expect(segs[0].speaker_id).toBeNull();
  });
  it("lista vazia → []", () => {
    expect(wordsToSegments([], 12)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e falhar** — `npx vitest run src/lib/reunioes/transcript.test.ts --exclude '**/.claude/**'`

- [ ] **Step 3: Implementar**

```ts
// src/lib/reunioes/transcript.ts
import type { TranscriptSegment } from "./tipos";
import type { WhisperWord } from "@/lib/yori/tipos";

/**
 * Agrupa palavras (com timestamps do Whisper) em segmentos de até `maxSeg`
 * segundos, pra timeline. Sem diarização (speaker genérico) — Fatia 2.
 */
export function wordsToSegments(words: WhisperWord[], maxSeg = 12): TranscriptSegment[] {
  const segs: TranscriptSegment[] = [];
  let cur: WhisperWord[] = [];
  let inicio = 0;
  const flush = () => {
    if (cur.length === 0) return;
    segs.push({
      speaker: "Reunião",
      speaker_id: null,
      start: inicio,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.word).join(" ").replace(/\s+([,.!?])/g, "$1").trim(),
    });
    cur = [];
  };
  for (const w of words) {
    if (cur.length === 0) inicio = w.start;
    else if (w.end - inicio > maxSeg) flush();
    if (cur.length === 0) inicio = w.start;
    cur.push(w);
  }
  flush();
  return segs;
}
```

- [ ] **Step 4: Rodar e passar.**
- [ ] **Step 5: Commit** — `feat(reunioes): wordsToSegments pra timeline da transcrição`

---

### Task 3: `registrarGravacaoAction` enfileira transcrição

**Files:** Modify `src/lib/reunioes/gravacao-actions.ts`

- [ ] **Step 1:** Trocar o bloco final de `registrarGravacaoAction` (o `update` que setava `status: "completed"`) por: status `processing` + criar job de transcrição.

Substituir:
```ts
  await sb.from("meetings").update({
    status: "completed",
    recording_ready: true,
    duracao_segundos: Math.round(input.duracaoSeg) || null,
    ends_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", input.meetingId);
```
por:
```ts
  await sb.from("meetings").update({
    status: "processing",
    recording_ready: true,
    duracao_segundos: Math.round(input.duracaoSeg) || null,
    ends_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", input.meetingId);

  // Enfileira a transcrição (worker /api/cron/reunioes-worker processa).
  await sb.from("meeting_processing_jobs").insert({
    meeting_id: input.meetingId,
    step: "transcription",
    status: "pending",
  });
```

- [ ] **Step 2: Type-check** limpo.
- [ ] **Step 3: Commit** — `feat(reunioes): registrar gravação enfileira transcrição`

---

### Task 4: Worker cron de transcrição

**Files:** Create `src/app/api/cron/reunioes-worker/route.ts`

- [ ] **Step 1: Implementar**

```ts
// Cron: transcreve reuniões gravadas (job step 'transcription').
// Padrão idêntico ao editor-ia-worker. Roda a cada 2 min.
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { downloadRecording } from "@/lib/reunioes/storage";
import { wordsToSegments } from "@/lib/reunioes/transcript";
import { transcribeAudio } from "@/lib/yori/services/groq-whisper";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const env = getServerEnv();
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = createServiceRoleClient() as SB;
  const { data: jobs } = await sb
    .from("meeting_processing_jobs")
    .select("id, meeting_id, step, status, attempts")
    .eq("step", "transcription")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(3);

  const results: Array<{ id: string; ok: boolean; msg: string }> = [];
  for (const job of (jobs ?? [])) {
    try {
      const msg = await processarTranscricao(sb, job);
      results.push({ id: job.id, ok: true, msg });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await sb.from("meeting_processing_jobs").update({
        status: "failed", last_error: message, attempts: (job.attempts ?? 0) + 1, finished_at: new Date().toISOString(),
      }).eq("id", job.id);
      await sb.from("meetings").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", job.meeting_id);
      results.push({ id: job.id, ok: false, msg: message });
    }
  }
  return NextResponse.json({ processed: results.length, results });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processarTranscricao(sb: SB, job: any): Promise<string> {
  // Marca running.
  await sb.from("meeting_processing_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", job.id);

  const { data: rec } = await sb
    .from("meeting_recordings")
    .select("audio_url")
    .eq("meeting_id", job.meeting_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!rec?.audio_url) throw new Error("gravação sem audio_url");

  const buffer = await downloadRecording(rec.audio_url);
  if (!buffer) throw new Error("falha ao baixar áudio do storage");

  const filename = rec.audio_url.split("/").pop() ?? "audio.webm";
  const result = await transcribeAudio(buffer, filename);

  if (result.skipped) {
    // GROQ_API_KEY ausente: devolve o job pra pending, tenta na próxima run.
    await sb.from("meeting_processing_jobs").update({ status: "pending", started_at: null }).eq("id", job.id);
    return "skip:groq-nao-configurado";
  }
  if (!result.ok || !result.transcription) throw new Error(result.error ?? "Whisper falhou");

  const t = result.transcription;
  const segments = wordsToSegments(t.words ?? [], 12);

  await sb.from("meeting_transcripts").insert({
    meeting_id: job.meeting_id,
    provider: "whisper",
    modelo: "whisper-large-v3",
    idioma: t.language || "pt-BR",
    texto_completo: t.text,
    segments,
    custo_estimado_centavos: Math.round((result.cost_brl || 0) * 100),
  });

  await sb.from("meeting_processing_jobs").update({ status: "done", finished_at: new Date().toISOString() }).eq("id", job.id);
  await sb.from("meetings").update({
    transcript_ready: true,
    status: "completed", // Fatia 3 troca por encadear resumo/insights/tarefas
    updated_at: new Date().toISOString(),
  }).eq("id", job.meeting_id);

  return "transcrito";
}
```

- [ ] **Step 2: Type-check** — `npx tsc --noEmit 2>&1 | grep -i reunioes-worker` limpo.
- [ ] **Step 3: Commit** — `feat(reunioes): worker cron de transcrição (Groq Whisper)`

---

### Task 5: Registrar o cron no vercel.json

**Files:** Modify `vercel.json`

- [ ] **Step 1:** Adicionar dentro do array `crons` (perto dos outros `*/N` workers):

```json
    { "path": "/api/cron/reunioes-worker", "schedule": "*/2 * * * *" },
```

- [ ] **Step 2:** Validar JSON — `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
- [ ] **Step 3: Commit** — `feat(reunioes): agenda cron reunioes-worker (2min)`

---

### Task 6: `getMeetingById` carrega a transcrição

**Files:** Modify `src/lib/reunioes/queries.ts`

- [ ] **Step 1:** Em `getMeetingById`, depois de carregar `rec`, carregar o transcript e devolvê-lo no lugar de `transcript: null`.

Adicionar antes do `return`:
```ts
  const { data: tr } = await sb
    .from("meeting_transcripts")
    .select("texto_completo, segments, idioma, provider")
    .eq("meeting_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
```
E trocar `transcript: null,` por:
```ts
    transcript: tr
      ? { texto_completo: tr.texto_completo, segments: (tr.segments ?? []) as MeetingDetail["transcript"] extends null ? never : never, idioma: tr.idioma, provider: tr.provider }
      : null,
```
NOTA ao implementador: o cast acima é feio — use o tipo real. O correto é:
```ts
    transcript: tr
      ? { texto_completo: tr.texto_completo, segments: (tr.segments ?? []), idioma: tr.idioma, provider: tr.provider }
      : null,
```
Se o TS reclamar do shape de `segments` (jsonb → tipo), faça `segments: (tr.segments ?? []) as unknown as TranscriptSegment[]` e importe `TranscriptSegment` de `./tipos`. Garanta `npx tsc --noEmit` limpo.

- [ ] **Step 2: Type-check** — `npx tsc --noEmit 2>&1 | grep -i reunioes` limpo.
- [ ] **Step 3: Commit** — `feat(reunioes): detalhe carrega a transcrição`

---

### Task 7: Verificação final + PR

- [ ] **Step 1:** `npx vitest run src/lib/reunioes --exclude '**/.claude/**'` → PASS.
- [ ] **Step 2:** `npx tsc --noEmit` (limpo) + `npx eslint src/lib/reunioes src/app/api/cron/reunioes-worker/route.ts`.
- [ ] **Step 3:** Push + PR. Corpo: explica o fluxo, **exige `GROQ_API_KEY` no Vercel** pra transcrever, e lembra que as migrations da Fatia 1 precisam estar aplicadas (o cron usa `meeting_processing_jobs`).
- [ ] **Step 4:** Esperar CI verde e mergear (squash + delete-branch).

---

## Self-review (feito)
- **Cobertura:** enfileirar (Task 3) → worker transcreve (Task 4) → agenda (Task 5) → UI mostra (Task 6). ✅
- **Sem placeholders:** código completo; a única nota é o cast de `segments` na Task 6, com a forma correta explicitada.
- **Consistência:** `transcribeAudio(buffer, filename)` retorna `{ ok, skipped, error, transcription:{text,language,duration,words}, cost_brl }` — usado igual ao editor-ia-worker. `meeting_processing_jobs` step `transcription`/status `pending|running|done|failed` batem com os enums da migration base. `wordsToSegments(words, maxSeg)` idem Task 2.
- **Risco:** áudio > limite do Groq (25MB) falha o job (last_error) — chunking fica pra melhoria futura; webm/opus mono típico de 1h fica ~10MB, ok. Documentar no PR.
