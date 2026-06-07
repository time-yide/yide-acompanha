# Design Studio Fase 2 (Geração de imagem por IA) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o chat do Studio gere uma imagem por IA sob demanda (Claude escreve o prompt na marca, GPT-Image-1 renderiza) e a entregue como fundo do editor.

**Architecture:** Estende o protocolo de comandos do chat com `gerarImagem`. O Claude (já no chat) decide quando gerar e escreve o prompt; o cliente chama uma rota dedicada (`maxDuration=60`) que renderiza no GPT-Image-1 server-side, sobe o PNG pro bucket e devolve a URL, que vira `fundo.foto`. Lógica pura (validação de comando, mapa de tamanhos, schema, prompt) é testada com vitest/TDD; rota/serviço/UI verificam via tsc+build.

**Tech Stack:** Next.js (App Router, route handlers), TypeScript, OpenAI SDK (`openai`, `gpt-image-1`), Supabase Storage, Anthropic SDK (já existente, pro chat), vitest, zod.

**Spec:** `docs/superpowers/specs/2026-06-06-design-studio-arte-fase2-geracao-ia-design.md`

---

## Contexto da Fase 1 (já existe — reaproveitar)

- `src/lib/design/studio-comandos.ts` — `ACOES_VALIDAS`, `validarComando` (switch por ação), `parseRespostaIA`, tipos `Acao`/`Comando`. Helpers `num`/`str`.
- `src/lib/design/studio-prompt.ts` — `buildStudioSystemPrompt(manual, comp)`.
- `src/lib/design/studio-schema.ts` — `salvarComposicaoSchema` (+ `.refine` de tamanho), `SalvarComposicaoInput`.
- `src/lib/design/studio-actions.ts` — `salvarComposicaoAction`, `uploadStudioAssetAction` (padrão de upload no bucket `design-criativos`).
- `src/lib/design/studio-tipos.ts` — `dimensoesDoFormato`, `FORMAT_DIMS`, `Composicao`.
- `src/lib/design/roles.ts` — `isDesignRole`.
- `src/lib/env.ts` — `getServerEnv()` (zod). `src/lib/auth/session.ts` — `requireAuth()` → `{id, role, ...}`.
- `src/components/design/studio/StudioChat.tsx` — recebe `{ clientId, composicao, logoUrl, aplicarIA, onAplicado }`; chama `chatStudioAction`, e em `r.comandos.length > 0` faz `aplicarIA(r.comandos, logoUrl)`.
- `src/components/design/studio/StudioShell.tsx` — dono de `useComposicao` (`composicao`, `dispatch`, `aplicarIA`), passa props pro StudioChat.
- Rota síncrona de referência com `maxDuration`: `src/app/api/apresenta-yide/[id]/gerar/route.ts` (usa `export const maxDuration = 60`).

## File Structure

**Novos:**
- `src/lib/design/image-gen/tipos.ts` — `GerarImagemParams`, `GerarImagemResult`, `sizeParaFormato` (puro).
- `src/lib/design/image-gen/openai.ts` — `gerarImagemOpenAI` (SERVER ONLY; chama GPT-Image-1).
- `src/app/api/design/studio/gerar-imagem/route.ts` — POST, `maxDuration=60`, gera + sobe + devolve URL.

**Modificados:**
- `src/lib/design/studio-comandos.ts` — `gerarImagem` na whitelist + validação.
- `src/lib/design/studio-prompt.ts` — regra de geração no system prompt.
- `src/lib/design/studio-schema.ts` + `studio-actions.ts` — `iaInfo` opcional no save → grava `fonte_origem/ai_modelo/ai_prompt`.
- `src/lib/env.ts` — `OPENAI_API_KEY`.
- `src/lib/design/tipos.ts` — `ia_openai` deixa de ser `comingSoon`.
- `src/components/design/studio/StudioChat.tsx` + `StudioShell.tsx` — fluxo de geração (loading, set fundo, iaInfo).

---

## Task 1: Comando `gerarImagem` no parser

**Files:**
- Modify: `src/lib/design/studio-comandos.ts`
- Test: `tests/unit/design-studio-comandos-gerarimagem.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/design-studio-comandos-gerarimagem.test.ts
import { describe, it, expect } from "vitest";
import { parseRespostaIA, ACOES_VALIDAS } from "@/lib/design/studio-comandos";

describe("gerarImagem command", () => {
  it("gerarImagem está na whitelist", () => {
    expect(ACOES_VALIDAS).toContain("gerarImagem");
  });

  it("aceita gerarImagem com prompt e alvo", () => {
    const raw = `ok\n---JSON---\n{"commands":[{"action":"gerarImagem","prompt":"a premium bbq background","alvo":"fundo"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([
      { action: "gerarImagem", prompt: "a premium bbq background", alvo: "fundo" },
    ]);
  });

  it("alvo default é 'fundo' quando ausente", () => {
    const raw = `ok\n---JSON---\n{"commands":[{"action":"gerarImagem","prompt":"x"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos[0]).toEqual({ action: "gerarImagem", prompt: "x", alvo: "fundo" });
  });

  it("descarta gerarImagem sem prompt", () => {
    const raw = `ok\n---JSON---\n{"commands":[{"action":"gerarImagem","alvo":"fundo"}]}`;
    expect(parseRespostaIA(raw).comandos).toEqual([]);
  });

  it("alvo inválido cai pra 'fundo'", () => {
    const raw = `ok\n---JSON---\n{"commands":[{"action":"gerarImagem","prompt":"x","alvo":"banner"}]}`;
    expect(parseRespostaIA(raw).comandos[0]).toEqual({ action: "gerarImagem", prompt: "x", alvo: "fundo" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx vitest run tests/unit/design-studio-comandos-gerarimagem.test.ts`
Expected: FAIL — `gerarImagem` não está na whitelist / comando descartado.

- [ ] **Step 3: Implement**

In `src/lib/design/studio-comandos.ts`, add `"gerarImagem"` to `ACOES_VALIDAS`:

```typescript
export const ACOES_VALIDAS = [
  "setBg", "setFormato", "toggleStripes", "addTexto",
  "addShape", "addLogo", "updateLayer", "removeLayer", "clearAll",
  "gerarImagem",
] as const;
```

And add a case in `validarComando`'s switch (before `default`):

```typescript
    case "gerarImagem": {
      if (typeof c.prompt !== "string" || c.prompt.trim() === "") return null;
      const alvo = c.alvo === "camada" ? "camada" : "fundo";
      return { action: act, prompt: c.prompt, alvo };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx vitest run tests/unit/design-studio-comandos-gerarimagem.test.ts`
Expected: PASS (5 tests). Also run the existing `tests/unit/design-studio-comandos.test.ts` to confirm no regression.

- [ ] **Step 5: Commit**

```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
git add src/lib/design/studio-comandos.ts tests/unit/design-studio-comandos-gerarimagem.test.ts
git commit -m "feat(design): comando gerarImagem no parser do Studio"
```

---

## Task 2: Tipos do gerador + mapa de tamanhos

**Files:**
- Create: `src/lib/design/image-gen/tipos.ts`
- Test: `tests/unit/design-image-gen-tipos.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/design-image-gen-tipos.test.ts
import { describe, it, expect } from "vitest";
import { sizeParaFormato } from "@/lib/design/image-gen/tipos";

describe("sizeParaFormato", () => {
  it("feed é quadrado 1024x1024", () => {
    expect(sizeParaFormato("feed")).toBe("1024x1024");
  });
  it("story e reels são retrato 1024x1536", () => {
    expect(sizeParaFormato("story")).toBe("1024x1536");
    expect(sizeParaFormato("reels")).toBe("1024x1536");
  });
  it("formato desconhecido cai em quadrado", () => {
    expect(sizeParaFormato("xpto")).toBe("1024x1024");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx vitest run tests/unit/design-image-gen-tipos.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implement**

```typescript
// src/lib/design/image-gen/tipos.ts

/** Tamanhos suportados pelo gpt-image-1. */
export type ImageSize = "1024x1024" | "1024x1536" | "1536x1024";

/** Mapeia o formato da canvas pro tamanho de geração. Retrato pra story/reels. */
export function sizeParaFormato(formato: string): ImageSize {
  if (formato === "story" || formato === "reels") return "1024x1536";
  return "1024x1024";
}

export interface GerarImagemParams {
  prompt: string;
  size: ImageSize;
  quality?: "low" | "medium" | "high";
}

export interface GerarImagemResult {
  ok: boolean;
  /** PNG em base64 (sem prefixo data:) quando ok. */
  b64?: string;
  error?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx vitest run tests/unit/design-image-gen-tipos.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
git add src/lib/design/image-gen/tipos.ts tests/unit/design-image-gen-tipos.test.ts
git commit -m "feat(design): tipos e mapa de tamanhos do gerador de imagem"
```

---

## Task 3: Serviço OpenAI (gpt-image-1) + env var

**Files:**
- Create: `src/lib/design/image-gen/openai.ts`
- Modify: `src/lib/env.ts`
- Modify: `package.json` (instala `openai`)

- [ ] **Step 1: Instalar o SDK**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npm install openai`
Expected: adiciona `openai` em `dependencies`.

- [ ] **Step 2: Adicionar OPENAI_API_KEY no env schema**

In `src/lib/env.ts`, add to the server env zod object (junto das outras chaves opcionais como `ANTHROPIC_API_KEY`):

```typescript
  OPENAI_API_KEY: z.string().optional(),
```

- [ ] **Step 3: Implementar o serviço**

```typescript
// src/lib/design/image-gen/openai.ts
// SERVER ONLY — gera imagem com GPT-Image-1.
import OpenAI from "openai";
import { getServerEnv } from "@/lib/env";
import type { GerarImagemParams, GerarImagemResult } from "./tipos";

export async function gerarImagemOpenAI(params: GerarImagemParams): Promise<GerarImagemResult> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) {
    return { ok: false, error: "Geração de imagem não configurada (OPENAI_API_KEY ausente)" };
  }
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  try {
    const res = await client.images.generate({
      model: "gpt-image-1",
      prompt: params.prompt,
      size: params.size,
      quality: params.quality ?? "medium",
      n: 1,
    });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) return { ok: false, error: "A IA não retornou imagem" };
    return { ok: true, b64 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Erro ao gerar imagem" };
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx tsc --noEmit`
Expected: clean. (Se o tipo de `res.data` reclamar, ajuste para `res.data && res.data[0]?.b64_json` — o SDK tipa `data` como opcional.)

- [ ] **Step 5: Commit**

```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
git add package.json package-lock.json src/lib/env.ts src/lib/design/image-gen/openai.ts
git commit -m "feat(design): serviço OpenAI gpt-image-1 + OPENAI_API_KEY"
```

---

## Task 4: Rota de geração `/api/design/studio/gerar-imagem`

**Files:**
- Create: `src/app/api/design/studio/gerar-imagem/route.ts`

- [ ] **Step 1: Implementar a rota**

```typescript
// src/app/api/design/studio/gerar-imagem/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { isDesignRole } from "@/lib/design/roles";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { gerarImagemOpenAI } from "@/lib/design/image-gen/openai";
import { sizeParaFormato } from "@/lib/design/image-gen/tipos";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  clientId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  prompt: z.string().min(1).max(4000),
  formato: z.string().min(1),
});

export async function POST(req: Request) {
  const actor = await requireAuth();
  if (!isDesignRole(actor.role)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 });
  }
  const { clientId, prompt, formato } = parsed.data;

  // Gera
  const ger = await gerarImagemOpenAI({ prompt, size: sizeParaFormato(formato) });
  if (!ger.ok || !ger.b64) {
    return NextResponse.json({ error: ger.error ?? "Falha na geração" }, { status: 502 });
  }

  // Sobe pro bucket (escopo por cliente)
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: cli } = await sbAny.from("clients").select("organization_id").eq("id", clientId).single();
  if (!cli) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const path = `${cli.organization_id}/${clientId}/studio-assets/ia-${Date.now()}.png`;
  const buffer = Buffer.from(ger.b64, "base64");
  const { error: upErr } = await sbAny.storage
    .from("design-criativos").upload(path, buffer, { contentType: "image/png", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: signed } = await sbAny.storage
    .from("design-criativos").createSignedUrl(path, 365 * 24 * 60 * 60);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Erro ao gerar URL da imagem" }, { status: 500 });

  return NextResponse.json({ url: signed.signedUrl });
}
```

- [ ] **Step 2: Typecheck + build (rota aparece no manifest)**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx tsc --noEmit && npm run build`
Expected: build OK; a rota `/api/design/studio/gerar-imagem` aparece como dynamic.
(Se o build exigir env vars, garanta o `.env.local` dummy do worktree — crie-o gitignored se não existir, com placeholders das public env vars, como na Fase 1.)

- [ ] **Step 3: Commit**

```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
git add "src/app/api/design/studio/gerar-imagem/route.ts"
git commit -m "feat(design): rota de geração de imagem (maxDuration 60)"
```

---

## Task 5: Regra de geração no system prompt

**Files:**
- Modify: `src/lib/design/studio-prompt.ts`
- Test: `tests/unit/design-studio-prompt-geracao.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/design-studio-prompt-geracao.test.ts
import { describe, it, expect } from "vitest";
import { buildStudioSystemPrompt } from "@/lib/design/studio-prompt";
import type { ManualMarca, Composicao } from "@/lib/design/studio-tipos";

const manual: ManualMarca = {
  fontes: [], logo_url: null, fundo_padrao: "#111", paletas: ["#009c3b"],
  mood: "", tom_voz: "", evitar: "",
};
const comp: Composicao = {
  formato: "feed", fundo: { cor: "#111", foto: null, listras: false }, camadas: [],
};

describe("prompt — regra de geração de imagem", () => {
  const out = buildStudioSystemPrompt(manual, comp);
  it("documenta o comando gerarImagem", () => {
    expect(out).toContain("gerarImagem");
  });
  it("instrui a preferir foto real e só gerar sob demanda", () => {
    expect(out).toMatch(/foto.*real/i);
    expect(out).toMatch(/(explicit|pedir|pedid|confirm)/i);
  });
  it("instrui a sugerir sem gerar sem confirmação", () => {
    expect(out).toMatch(/sugeri|sugest/i);
  });
  it("instrui prompt em inglês", () => {
    expect(out).toMatch(/ingl[eê]s/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx vitest run tests/unit/design-studio-prompt-geracao.test.ts`
Expected: FAIL — prompt ainda não menciona geração.

- [ ] **Step 3: Implement**

In `src/lib/design/studio-prompt.ts`, append this block to the returned prompt string (antes do fechamento, junto da lista de comandos):

```typescript
`

GERAÇÃO DE IMAGEM POR IA (sob demanda):
Você também pode gerar uma imagem com o comando {"action":"gerarImagem","prompt":"<prompt em inglês>","alvo":"fundo"}.
REGRAS:
1. PREFIRA fotos reais que a usuária já enviou. Só emita gerarImagem quando ela PEDIR explicitamente ("gera/cria um fundo/imagem de…") ou CONFIRMAR uma sugestão sua.
2. Se faltar uma imagem e ela não pediu pra gerar, você PODE sugerir em texto ("quer que eu gere um fundo de X?"), mas NÃO emita gerarImagem nessa resposta — espere a confirmação.
3. Escreva o "prompt" em INGLÊS, detalhado e fiel à marca: incorpore o mood, descreva as cores da paleta, respeite o "evitar". Descreva uma imagem de fundo, SEM texto embutido (texto é camada no editor).
4. "alvo" é "fundo" por padrão; use "camada" só se ela pedir um elemento solto.`
```

(Concatene ao template literal existente — mantenha as instruções de fonte/cor que já existem.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx vitest run tests/unit/design-studio-prompt-geracao.test.ts && npx vitest run tests/unit/design-studio-prompt.test.ts`
Expected: ambos PASS (novo + o existente da Fase 1).

- [ ] **Step 5: Commit**

```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
git add src/lib/design/studio-prompt.ts tests/unit/design-studio-prompt-geracao.test.ts
git commit -m "feat(design): regra de geração de imagem no system prompt"
```

---

## Task 6: Persistir origem IA no save (`iaInfo`)

**Files:**
- Modify: `src/lib/design/studio-schema.ts`
- Modify: `src/lib/design/studio-actions.ts`
- Test: `tests/unit/design-studio-schema-iainfo.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/design-studio-schema-iainfo.test.ts
import { describe, it, expect } from "vitest";
import { salvarComposicaoSchema } from "@/lib/design/studio-schema";

const base = {
  clientId: "11111111-1111-1111-1111-111111111111",
  arteId: null,
  titulo: "Arte IA",
  formato: "feed",
  composicao: { formato: "feed", fundo: { cor: "#000", foto: null, listras: false }, camadas: [] },
  pngBase64: "data:image/png;base64,iVBOR",
};

describe("salvarComposicaoSchema — iaInfo opcional", () => {
  it("aceita sem iaInfo", () => {
    expect(salvarComposicaoSchema.safeParse(base).success).toBe(true);
  });
  it("aceita com iaInfo válido", () => {
    const r = salvarComposicaoSchema.safeParse({
      ...base, iaInfo: { modelo: "gpt-image-1", prompt: "a bbq background" },
    });
    expect(r.success).toBe(true);
  });
  it("rejeita iaInfo sem prompt", () => {
    const r = salvarComposicaoSchema.safeParse({ ...base, iaInfo: { modelo: "gpt-image-1" } });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx vitest run tests/unit/design-studio-schema-iainfo.test.ts`
Expected: FAIL — `iaInfo` ainda não existe no schema.

- [ ] **Step 3: Implement**

In `src/lib/design/studio-schema.ts`, add an optional `iaInfo` field to `salvarComposicaoSchema` (dentro do `z.object({...})`, antes do `.refine`):

```typescript
  iaInfo: z.object({
    modelo: z.string().min(1),
    prompt: z.string().min(1),
  }).optional(),
```

In `src/lib/design/studio-actions.ts`, in `salvarComposicaoAction`, after `const { clientId, arteId, titulo, formato, composicao, pngBase64 } = parsed.data;` also pull `iaInfo`:

```typescript
  const iaInfo = parsed.data.iaInfo;
```

Then, where the row is built for INSERT, include the IA fields when `iaInfo` is present (replace the `fonte_origem: "manual"` literal):

```typescript
  const row = {
    organization_id: cli.organization_id,
    client_id: clientId,
    titulo,
    formato,
    composicao,
    fonte_origem: iaInfo ? ("ia_openai" as const) : ("manual" as const),
    ai_modelo: iaInfo?.modelo ?? null,
    ai_prompt: iaInfo?.prompt ?? null,
    criado_por: actor.id,
  };
```

And in the UPDATE path (existing arte), also persist the IA fields when present:

```typescript
    const { data: upd, error } = await sbAny.from("design_artes")
      .update({
        titulo, formato, composicao,
        ...(iaInfo ? { fonte_origem: "ia_openai", ai_modelo: iaInfo.modelo, ai_prompt: iaInfo.prompt } : {}),
      })
      .eq("id", id).eq("client_id", clientId).select("id");
```

(Mantém o resto do `salvarComposicaoAction` igual — `SaveResult`, upload do PNG, etc.)

- [ ] **Step 4: Run test + typecheck**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx vitest run tests/unit/design-studio-schema-iainfo.test.ts tests/unit/design-studio-actions-schema.test.ts && npx tsc --noEmit`
Expected: testes PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
git add src/lib/design/studio-schema.ts src/lib/design/studio-actions.ts tests/unit/design-studio-schema-iainfo.test.ts
git commit -m "feat(design): persiste origem IA (iaInfo) no save do Studio"
```

---

## Task 7: Wiring do fluxo de geração (StudioShell + StudioChat)

UI client-side. Verificação via tsc + build (sem unit test de DOM).

**Files:**
- Modify: `src/components/design/studio/StudioShell.tsx`
- Modify: `src/components/design/studio/StudioChat.tsx`

- [ ] **Step 1: StudioShell — função de gerar + estado iaInfo**

Em `StudioShell.tsx`:
1. Adicione estado: `const [iaInfo, setIaInfo] = useState<{ modelo: string; prompt: string } | null>(null);` e `const [gerando, setGerando] = useState(false);`
2. Adicione a função que chama a rota e aplica o resultado:

```typescript
const gerarImagem = useCallback(async (prompt: string, alvo: "fundo" | "camada"): Promise<string | null> => {
  setGerando(true);
  try {
    const resp = await fetch("/api/design/studio/gerar-imagem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, prompt, formato: composicao.formato }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.url) return null;
    if (alvo === "camada") {
      dispatch({ type: "addCamada", camada: { tipo: "imagem", src: data.url, x: 100, y: 100, w: 400, h: 400, opacity: 1 } });
    } else {
      dispatch({ type: "setFoto", foto: { url: data.url, zoom: 100, x: 0, y: 0, opacidade: 100 } });
    }
    setIaInfo({ modelo: "gpt-image-1", prompt });
    return data.url as string;
  } catch {
    return null;
  } finally {
    setGerando(false);
  }
}, [clientId, composicao.formato, dispatch]);
```

3. Passe `gerarImagem` e `gerando` como props pro `StudioChat` (`onGerarImagem={gerarImagem}` e `gerando={gerando}`).
4. No Save (`salvarComposicaoAction(...)`), inclua `iaInfo: iaInfo ?? undefined` no objeto de input.

(`addCamada`/`setFoto` são ações já existentes do `useComposicao` — confira os nomes de campos de `setFoto.foto` em `studio-tipos.ts` e ajuste se necessário: `{ url, zoom, x, y, opacidade }`.)

- [ ] **Step 2: StudioChat — separar gerarImagem dos demais comandos**

Em `StudioChat.tsx`, ajuste o trecho que hoje faz `if (r.comandos.length > 0) aplicarIA(r.comandos, logoUrl);`. Receba as novas props `onGerarImagem: (prompt: string, alvo: "fundo"|"camada") => Promise<string|null>` e `gerando: boolean`. Troque por:

```typescript
if (r.comandos.length > 0) {
  const gerar = r.comandos.filter((c) => c.action === "gerarImagem");
  const resto = r.comandos.filter((c) => c.action !== "gerarImagem");
  for (const g of gerar) {
    const alvo = (g.alvo === "camada" ? "camada" : "fundo") as "fundo" | "camada";
    const url = await onGerarImagem(String(g.prompt), alvo);
    if (!url) {
      setLocalMsgs((m) => [...m, { id: nextId(), msg: { role: "assistant", content: "⚠️ Não consegui gerar a imagem. Verifique a configuração (OPENAI_API_KEY) ou tente outro pedido." } }]);
    }
  }
  if (resto.length > 0) aplicarIA(resto, logoUrl);
  onAplicado();
}
```

(Use o mesmo mecanismo de id/mensagem que o StudioChat já usa — `nextId()`/`setLocalMsgs` conforme implementado na Fase 1; adapte aos nomes reais. Enquanto `gerando` for true, desabilite o botão de enviar e mostre um indicador "gerando imagem…".)

- [ ] **Step 3: Typecheck + build**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx tsc --noEmit && npm run build`
Expected: ambos OK.

- [ ] **Step 4: Commit**

```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
git add src/components/design/studio/StudioShell.tsx src/components/design/studio/StudioChat.tsx
git commit -m "feat(design): wira o fluxo de geração de imagem no chat do Studio"
```

---

## Task 8: Marcar `ia_openai` como disponível

**Files:**
- Modify: `src/lib/design/tipos.ts`

- [ ] **Step 1: Implement**

Em `src/lib/design/tipos.ts`, no array `IA_PROVIDERS`, remova `comingSoon: true` do provider `ia_openai` (deixe os outros como estão).

- [ ] **Step 2: Typecheck**

Run: `cd /Users/yasminmonteiro/Documents/sa-studio-fase2 && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
git add src/lib/design/tipos.ts
git commit -m "feat(design): ativa provider ia_openai (GPT-Image-1)"
```

---

## Task 9: Suíte completa (checks de CI)

- [ ] **Step 1: Rodar tudo (igual o CI)**

Run:
```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
npm run lint && npm run typecheck && npm run test && npm run build
```
Expected: lint 0 errors; typecheck clean; todos os testes (incl. os novos) PASS; build OK com a rota nova.

- [ ] **Step 2: Commit (se houver ajuste de lint)**

```bash
cd /Users/yasminmonteiro/Documents/sa-studio-fase2
git add -A
git commit -m "chore(design): fecha checks de CI da Fase 2" || echo "nada a commitar"
```

---

## Self-Review (autor do plano)

- **Cobertura do spec:** comando gerarImagem (Task 1), serviço+env (Task 3), rota maxDuration (Task 4), regra de geração no prompt c/ "preferir foto real / sugerir sem gerar" (Task 5), persistência fonte_origem/ai_prompt (Task 6), fluxo on-demand no chat com fundo/camada e loading (Task 7), provider habilitado (Task 8), tamanhos por formato (Task 2). ✔
- **Sem migration / sem limite:** nenhuma migration; ponto de limite não implementado (decisão da usuária), `iaInfo` é o único acréscimo ao save. ✔
- **Consistência de tipos:** `gerarImagem`/`alvo` definidos na Task 1 e consumidos na Task 7; `sizeParaFormato`/`GerarImagemResult` (Task 2) usados na Task 3/4; `iaInfo {modelo,prompt}` igual no schema (Task 6) e no wiring (Task 7). `setFoto.foto` = `{url,zoom,x,y,opacidade}` conforme `studio-tipos`. ✔
- **Degradação:** sem `OPENAI_API_KEY`, serviço retorna erro amigável → rota 502 → chat mostra aviso; resto do Studio intacto. ✔

## Notas de deploy (pós-merge)

1. **`OPENAI_API_KEY`** nas env vars da Vercel (produção + preview). Sem ela, geração mostra aviso e nada quebra.
2. **Nenhuma migration** nesta fase.
3. Custo por imagem corre na conta OpenAI; sem cota implementada (ponto isolado pra ligar depois).
