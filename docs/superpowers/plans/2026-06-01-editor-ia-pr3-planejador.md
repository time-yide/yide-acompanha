# Editor IA — PR3: Planejador IA (Implementation Plan)

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** No passo `planejando` do worker, gerar o `EditPlan` (cortes de silêncio + legendas) a partir da transcrição + instrução, e avançar pra `aguardando_revisao`. Núcleo determinístico e testável.

**Architecture:** `src/lib/editor-ia/services/ia-plano.ts` com funções puras (`parametrosDaInstrucao`, `gerarPlanoBase`). O worker chama isso no passo `planejando`. Reusa `groupWordsIntoLines` (`@/lib/yori/srt-builder`) e `WhisperWord` (`@/lib/yori/tipos`). EditPlan já definido em `src/lib/editor-ia/tipos.ts`.

**Tech Stack:** TS, Vitest. Sem novas deps externas (LLM fica pra refino futuro; MVP usa heurística por keywords + gaps).

---

## Task 1: Serviço ia-plano (TDD)

**Files:** Create `src/lib/editor-ia/services/ia-plano.ts`. Test: `tests/unit/editor-ia-plano.test.ts`.

- [ ] **Step 1: failing test**

`tests/unit/editor-ia-plano.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parametrosDaInstrucao, gerarPlanoBase } from "@/lib/editor-ia/services/ia-plano";
import type { WhisperWord } from "@/lib/yori/tipos";

const W = (word: string, start: number, end: number): WhisperWord => ({ word, start, end });

describe("parametrosDaInstrucao", () => {
  it("dinâmico/rápido = corte agressivo (0.5s)", () => {
    expect(parametrosDaInstrucao("deixa dinâmico").silencioMinSegundos).toBe(0.5);
    expect(parametrosDaInstrucao("corta rápido").silencioMinSegundos).toBe(0.5);
  });
  it("suave = corte leve (1.5s)", () => {
    expect(parametrosDaInstrucao("deixa suave").silencioMinSegundos).toBe(1.5);
  });
  it("default 0.8s", () => {
    expect(parametrosDaInstrucao("põe legenda").silencioMinSegundos).toBe(0.8);
  });
});

describe("gerarPlanoBase", () => {
  it("corta o gap grande e mantém as falas", () => {
    const words = [W("oi", 0, 1), W("tudo", 1.1, 2), W("bem", 5, 6)];
    const plan = gerarPlanoBase(words, { silencioMinSegundos: 0.8 });
    expect(plan.segments).toEqual([
      { start: 0, end: 2, keep: true },
      { start: 2, end: 5, keep: false },
      { start: 5, end: 6, keep: true },
    ]);
    expect(plan.captions.length).toBeGreaterThan(0);
    expect(plan.captions[0].text.length).toBeGreaterThan(0);
  });
  it("sem palavras = plano vazio", () => {
    expect(gerarPlanoBase([], { silencioMinSegundos: 0.8 })).toEqual({ segments: [], captions: [] });
  });
  it("sem gaps grandes = um único segmento keep", () => {
    const words = [W("a", 0, 1), W("b", 1.1, 2), W("c", 2.1, 3)];
    const plan = gerarPlanoBase(words, { silencioMinSegundos: 0.8 });
    expect(plan.segments).toEqual([{ start: 0, end: 3, keep: true }]);
  });
});
```
Run → FAIL.

- [ ] **Step 2: implement `src/lib/editor-ia/services/ia-plano.ts`**
```typescript
import type { WhisperWord } from "@/lib/yori/tipos";
import { groupWordsIntoLines } from "@/lib/yori/srt-builder";
import type { EditPlan, EditSegment, CaptionLine } from "../tipos";

export interface PlanoParams {
  /** Silêncio (gap entre palavras) a partir do qual o trecho é cortado. */
  silencioMinSegundos: number;
}

/** Deriva parâmetros do plano a partir da instrução em texto (heurística por keyword). */
export function parametrosDaInstrucao(instrucao: string): PlanoParams {
  const s = (instrucao || "").toLowerCase();
  if (/din[aâ]mic|r[aá]pid|agressiv|corta tudo/.test(s)) return { silencioMinSegundos: 0.5 };
  if (/suave|leve|pouco corte|conservador/.test(s)) return { silencioMinSegundos: 1.5 };
  return { silencioMinSegundos: 0.8 };
}

/**
 * Gera o plano base: mantém trechos falados e corta os silêncios (gaps entre
 * palavras >= silencioMinSegundos). Legendas vêm do agrupamento das palavras.
 * Determinístico — a revisão manual (timeline) ajusta depois.
 */
export function gerarPlanoBase(words: WhisperWord[], params: PlanoParams): EditPlan {
  if (words.length === 0) return { segments: [], captions: [] };

  const segments: EditSegment[] = [];
  let runStart = words[0].start;
  let prevEnd = words[0].end;

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const gap = w.start - prevEnd;
    if (gap >= params.silencioMinSegundos) {
      segments.push({ start: runStart, end: prevEnd, keep: true });
      segments.push({ start: prevEnd, end: w.start, keep: false });
      runStart = w.start;
    }
    prevEnd = w.end;
  }
  segments.push({ start: runStart, end: prevEnd, keep: true });

  const captions: CaptionLine[] = groupWordsIntoLines(words).map((line) => ({
    start: line.start,
    end: line.end,
    text: line.words.map((x) => x.word).join(" ").replace(/\s+/g, " ").trim(),
  }));

  return { segments, captions };
}
```
Run test → PASS (6 testes).

- [ ] **Step 3: type-check + commit**
Run: `npx tsc --noEmit 2>&1 | grep -i editor-ia || echo clean`
```bash
git add src/lib/editor-ia/services/ia-plano.ts tests/unit/editor-ia-plano.test.ts
git commit -m "feat(editor-ia): planejador (heurística de silêncios + legendas)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Worker — passo planejando

**Files:** Modify `src/app/api/cron/editor-ia-worker/route.ts`.

- [ ] **Step 1:** READ the worker. Replace the line `if (job.status === "planejando") return "noop:aguardando-PR3";` with a call to a new `processPlanejando(job)`. Add the function:
```typescript
async function processPlanejando(job: JobWithMeta): Promise<string> {
  const transc = job.transcricao as { words?: import("@/lib/yori/tipos").WhisperWord[] } | null;
  const words = transc?.words ?? [];
  if (words.length === 0) throw new Error("transcrição sem palavras");

  const plano = gerarPlanoBase(words, parametrosDaInstrucao(job.instrucao ?? ""));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  await sb.from("editor_ia_jobs").update({
    edit_plan: plano,
    status: "aguardando_revisao",
  }).eq("id", job.id);
  return "advanced:planejando→aguardando_revisao";
}
```
Add the import at top: `import { gerarPlanoBase, parametrosDaInstrucao } from "@/lib/editor-ia/services/ia-plano";`
And update the dispatcher: `if (job.status === "planejando") return processPlanejando(job);`
(Confirm `JobWithMeta` has `transcricao` and `instrucao` — they come from `listJobsToProcess`'s COLS; if not, add them to the select in `queries.ts` listJobsToProcess.)

- [ ] **Step 2: type-check + lint + suite**
Run: `npx tsc --noEmit 2>&1 | grep -iE "editor-ia|cron/editor" || echo clean` ; `npx next lint 2>&1 | grep -i editor || echo "lint clean"` ; `npx vitest run 2>&1 | tail -3`

- [ ] **Step 3: commit**
```bash
git add src/app/api/cron/editor-ia-worker/route.ts src/lib/editor-ia/queries.ts 2>/dev/null
git commit -m "feat(editor-ia): worker gera plano e avança pra aguardando_revisao

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final + PR (PR3)
- [ ] tsc/lint/vitest verdes. push + PR (base main). Corpo: sem migration nova; descreve o passo de planejamento; nota que a revisão na timeline + render são PR5/PR4.

## Notas
- Núcleo determinístico (gaps + keywords) — refino por LLM fica pra depois (fácil de plugar no `parametrosDaInstrucao`/`gerarPlanoBase`).
- `EditPlan` (PR1) é o contrato; a timeline (PR5) edita esse mesmo objeto; o Shotstack (PR4) consome.
- Próximo: PR4 (render Shotstack) — depende das contas Shotstack+Groq pra validar de verdade.
