# Design Studio de Arte (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar ao módulo Design um Studio de criação de arte por cliente — editor de composição (canvas com camadas) + chat IA que segue o manual de marca do cliente por padrão.

**Architecture:** Estende a base existente do módulo Design (`design_artes`, `design_style_guide`, bucket `design-criativos`, workflow de aprovação). Lógica pura (tipos, parser de comandos da IA, builder de prompt) é testada com vitest e TDD. O chat roda numa server action com o Anthropic SDK (chave nunca no cliente). O editor é client-side React; o export renderiza a canvas em PNG via `html-to-image` e cai na biblioteca de artes.

**Tech Stack:** Next.js (App Router, server actions), TypeScript, Supabase (Postgres + Storage), `@anthropic-ai/sdk`, `html-to-image`, vitest, zod.

**Spec:** `docs/superpowers/specs/2026-06-06-design-studio-arte-fase1-design.md`

---

## File Structure

**Lógica pura / server (testável):**
- `src/lib/design/studio-tipos.ts` — tipos (`Composicao`, `Camada`, `ManualMarca`, `ComandoIA`) + dimensões de formato.
- `src/lib/design/studio-comandos.ts` — parser/validador da resposta da IA → comandos válidos.
- `src/lib/design/studio-prompt.ts` — monta system prompt com manual de marca + estado da canvas.
- `src/lib/design/studio-actions.ts` — salvar/abrir composição, gravar PNG exportado.
- `src/lib/design/marca-actions.ts` — upload de fonte/logo, atualizar manual de marca.
- `src/lib/design/chat-actions.ts` — server action do chat IA (chama Claude, usa parser + prompt).

**UI (client, verificação manual + smoke e2e):**
- `src/components/design/studio/StudioShell.tsx` — layout 3 painéis + tabs Editor/Chat + header.
- `src/components/design/studio/StudioCanvas.tsx` — canvas, render de camadas, drag/resize.
- `src/components/design/studio/StudioLeftPanel.tsx` — foto, fundo, elementos, fontes, logo, camadas.
- `src/components/design/studio/StudioProperties.tsx` — painel direito (propriedades do elemento).
- `src/components/design/studio/StudioChat.tsx` — chat IA.
- `src/components/design/studio/useComposicao.ts` — hook de estado da composição.
- `src/components/design/studio/exportCanvas.ts` — render da canvas → PNG (client-side).
- `src/app/(authed)/design/[clientId]/studio/page.tsx` — nova arte.
- `src/app/(authed)/design/[clientId]/studio/[arteId]/page.tsx` — reabrir arte.

**Banco:**
- `supabase/migrations/20260606000000_design_studio_composicao.sql` — coluna `composicao`.

---

## Task 1: Tipos do Studio + dimensões de formato

**Files:**
- Create: `src/lib/design/studio-tipos.ts`
- Test: `tests/unit/design-studio-tipos.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/design-studio-tipos.test.ts
import { describe, it, expect } from "vitest";
import { FORMAT_DIMS, dimensoesDoFormato } from "@/lib/design/studio-tipos";

describe("FORMAT_DIMS", () => {
  it("feed é 1080x1080", () => {
    expect(FORMAT_DIMS.feed).toEqual({ w: 1080, h: 1080 });
  });
  it("story e reels são 1080x1920", () => {
    expect(FORMAT_DIMS.story).toEqual({ w: 1080, h: 1920 });
    expect(FORMAT_DIMS.reels).toEqual({ w: 1080, h: 1920 });
  });
});

describe("dimensoesDoFormato", () => {
  it("retorna as dimensões do formato conhecido", () => {
    expect(dimensoesDoFormato("story")).toEqual({ w: 1080, h: 1920 });
  });
  it("cai em feed pra formato desconhecido", () => {
    expect(dimensoesDoFormato("xpto")).toEqual({ w: 1080, h: 1080 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/design-studio-tipos.test.ts`
Expected: FAIL — cannot find module `@/lib/design/studio-tipos`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/design/studio-tipos.ts

/** Dimensões reais (px) por formato. A canvas é exibida escalada, mas o estado
 * e o export usam estas medidas. */
export const FORMAT_DIMS: Record<string, { w: number; h: number }> = {
  feed: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
  reels: { w: 1080, h: 1920 },
  carrossel: { w: 1080, h: 1080 },
};

export function dimensoesDoFormato(formato: string): { w: number; h: number } {
  return FORMAT_DIMS[formato] ?? FORMAT_DIMS.feed;
}

export type CamadaBase = {
  id: string;
  x: number;
  y: number;
  opacity: number;
  z: number;
};

export type CamadaTexto = CamadaBase & {
  tipo: "texto";
  text: string;
  w: number;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
  font: string;
  spacing: number;
};

export type CamadaShape = CamadaBase & {
  tipo: "shape";
  subtype: "rect" | "circle" | "line";
  w: number;
  h: number;
  bg: string;
  borderColor: string;
  borderW: number;
  radius: number;
};

export type CamadaImagem = CamadaBase & {
  tipo: "imagem";
  src: string;
  w: number;
  h: number;
};

export type CamadaLogo = CamadaBase & {
  tipo: "logo";
  src: string;
  w: number;
  h: number;
};

export type Camada = CamadaTexto | CamadaShape | CamadaImagem | CamadaLogo;

export interface Composicao {
  formato: string;
  fundo: {
    cor: string;
    foto: { url: string; zoom: number; x: number; y: number; opacidade: number } | null;
    listras: boolean;
  };
  camadas: Camada[];
}

export interface FonteMarca {
  nome: string;
  papel: "titulo" | "corpo";
  url: string;
  format: "truetype" | "opentype" | "woff" | "woff2";
}

export interface ManualMarca {
  fontes: FonteMarca[];
  logo_url: string | null;
  fundo_padrao: string | null;
  paletas: string[];
  mood: string;
  tom_voz: string;
  evitar: string;
}

export const COMPOSICAO_VAZIA: Composicao = {
  formato: "feed",
  fundo: { cor: "#062e10", foto: null, listras: false },
  camadas: [],
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/design-studio-tipos.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/studio-tipos.ts tests/unit/design-studio-tipos.test.ts
git commit -m "feat(design): tipos e dimensões de formato do Studio"
```

---

## Task 2: Parser/validador de comandos da IA

A IA responde uma mensagem + bloco JSON separados por `---JSON---`. Este módulo extrai a mensagem, parseia o JSON (tolerando fences ```json), e valida cada comando contra uma whitelist, descartando comandos inválidos sem quebrar.

**Files:**
- Create: `src/lib/design/studio-comandos.ts`
- Test: `tests/unit/design-studio-comandos.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/design-studio-comandos.test.ts
import { describe, it, expect } from "vitest";
import { parseRespostaIA, ACOES_VALIDAS } from "@/lib/design/studio-comandos";

describe("parseRespostaIA", () => {
  it("separa mensagem e comandos pelo marcador ---JSON---", () => {
    const raw = `Vou criar um post simples.\n---JSON---\n{"commands":[{"action":"setBg","color":"#000000"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.mensagem).toBe("Vou criar um post simples.");
    expect(out.comandos).toEqual([{ action: "setBg", color: "#000000" }]);
  });

  it("tolera fences de markdown no JSON", () => {
    const raw = "ok\n---JSON---\n```json\n{\"commands\":[{\"action\":\"clearAll\"}]}\n```";
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([{ action: "clearAll" }]);
  });

  it("descarta comando com action desconhecida", () => {
    const raw = `x\n---JSON---\n{"commands":[{"action":"hackTheGibson"},{"action":"clearAll"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([{ action: "clearAll" }]);
  });

  it("descarta addTexto sem campo text", () => {
    const raw = `x\n---JSON---\n{"commands":[{"action":"addTexto","x":10,"y":10}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toEqual([]);
  });

  it("mantém addTexto válido com defaults preenchidos", () => {
    const raw = `x\n---JSON---\n{"commands":[{"action":"addTexto","text":"OI"}]}`;
    const out = parseRespostaIA(raw);
    expect(out.comandos).toHaveLength(1);
    const cmd = out.comandos[0] as Record<string, unknown>;
    expect(cmd.action).toBe("addTexto");
    expect(cmd.text).toBe("OI");
    expect(typeof cmd.x).toBe("number");
    expect(typeof cmd.color).toBe("string");
  });

  it("sem marcador, mensagem é o texto todo e comandos vazios", () => {
    const out = parseRespostaIA("Só uma resposta de texto.");
    expect(out.mensagem).toBe("Só uma resposta de texto.");
    expect(out.comandos).toEqual([]);
  });

  it("JSON inválido não quebra — retorna comandos vazios", () => {
    const raw = `x\n---JSON---\n{isso não é json}`;
    const out = parseRespostaIA(raw);
    expect(out.mensagem).toBe("x");
    expect(out.comandos).toEqual([]);
  });

  it("ACOES_VALIDAS cobre o contrato da Fase 1", () => {
    expect(ACOES_VALIDAS).toEqual(
      expect.arrayContaining([
        "setBg", "setFormato", "toggleStripes", "addTexto",
        "addShape", "addLogo", "updateLayer", "removeLayer", "clearAll",
      ]),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/design-studio-comandos.test.ts`
Expected: FAIL — cannot find module `@/lib/design/studio-comandos`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/design/studio-comandos.ts

export const ACOES_VALIDAS = [
  "setBg", "setFormato", "toggleStripes", "addTexto",
  "addShape", "addLogo", "updateLayer", "removeLayer", "clearAll",
] as const;

export type Acao = (typeof ACOES_VALIDAS)[number];
export type Comando = Record<string, unknown> & { action: Acao };

export interface RespostaIA {
  mensagem: string;
  comandos: Comando[];
}

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v : fallback;

/** Valida 1 comando bruto. Retorna o comando normalizado ou null se inválido. */
function validarComando(raw: unknown): Comando | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const action = c.action;
  if (typeof action !== "string" || !(ACOES_VALIDAS as readonly string[]).includes(action)) {
    return null;
  }
  switch (action) {
    case "clearAll":
      return { action };
    case "setBg":
      if (typeof c.color !== "string") return null;
      return { action, color: c.color };
    case "setFormato":
      if (typeof c.formato !== "string") return null;
      return { action, formato: c.formato };
    case "toggleStripes":
      return { action, show: c.show !== false };
    case "addTexto":
      if (typeof c.text !== "string" || c.text.trim() === "") return null;
      return {
        action, text: c.text,
        x: num(c.x, 80), y: num(c.y, 200), w: num(c.w, 250),
        fontSize: num(c.fontSize, 40), fontWeight: num(c.fontWeight, 700),
        color: str(c.color, "#ffffff"), align: str(c.align, "center"),
        font: str(c.font, ""), spacing: num(c.spacing, 0),
      };
    case "addShape": {
      const subtype = str(c.subtype, "rect");
      if (!["rect", "circle", "line"].includes(subtype)) return null;
      return {
        action, subtype,
        x: num(c.x, 80), y: num(c.y, 180), w: num(c.w, 220), h: num(c.h, 60),
        bg: str(c.bg, "#009c3b"), borderColor: str(c.borderColor, "transparent"),
        borderW: num(c.borderW, 0), radius: num(c.radius, 0),
      };
    }
    case "addLogo":
      return { action, x: num(c.x, 880), y: num(c.y, 940), w: num(c.w, 140), h: num(c.h, 100) };
    case "updateLayer":
      if (typeof c.id !== "string") return null;
      return { action, id: c.id, props: (c.props && typeof c.props === "object") ? c.props : {} };
    case "removeLayer":
      if (typeof c.id !== "string") return null;
      return { action, id: c.id };
    default:
      return null;
  }
}

export function parseRespostaIA(raw: string): RespostaIA {
  const parts = raw.split("---JSON---");
  const mensagem = (parts[0] ?? "").trim();
  const jsonPart = parts[1]?.trim();
  if (!jsonPart) return { mensagem, comandos: [] };

  const limpo = jsonPart.replace(/```json|```/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(limpo);
  } catch {
    return { mensagem, comandos: [] };
  }
  const lista = (parsed as { commands?: unknown })?.commands;
  if (!Array.isArray(lista)) return { mensagem, comandos: [] };

  const comandos = lista
    .map(validarComando)
    .filter((c): c is Comando => c !== null);
  return { mensagem, comandos };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/design-studio-comandos.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/studio-comandos.ts tests/unit/design-studio-comandos.test.ts
git commit -m "feat(design): parser/validador de comandos da IA do Studio"
```

---

## Task 3: Builder do system prompt (segue a marca por padrão)

**Files:**
- Create: `src/lib/design/studio-prompt.ts`
- Test: `tests/unit/design-studio-prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/design-studio-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildStudioSystemPrompt } from "@/lib/design/studio-prompt";
import type { ManualMarca, Composicao } from "@/lib/design/studio-tipos";

const manual: ManualMarca = {
  fontes: [
    { nome: "Marca Sans", papel: "titulo", url: "u1", format: "opentype" },
    { nome: "Marca Text", papel: "corpo", url: "u2", format: "truetype" },
  ],
  logo_url: "logo.png",
  fundo_padrao: "#062e10",
  paletas: ["#009c3b", "#ffdf00"],
  mood: "Esportivo, vibrante",
  tom_voz: "Direto e empolgado",
  evitar: "Nada de marrom",
};

const comp: Composicao = {
  formato: "feed",
  fundo: { cor: "#062e10", foto: null, listras: true },
  camadas: [],
};

describe("buildStudioSystemPrompt", () => {
  const out = buildStudioSystemPrompt(manual, comp);

  it("inclui as fontes da marca com papel", () => {
    expect(out).toContain("Marca Sans");
    expect(out).toContain("Marca Text");
  });
  it("inclui a paleta em hex", () => {
    expect(out).toContain("#009c3b");
    expect(out).toContain("#ffdf00");
  });
  it("inclui tom de voz e regras de evitar", () => {
    expect(out).toContain("Direto e empolgado");
    expect(out).toContain("Nada de marrom");
  });
  it("instrui a seguir a marca por padrão e só desviar se pedido", () => {
    expect(out).toMatch(/por padr[ãa]o/i);
    expect(out).toMatch(/s[óo].*(pedir|solicitar|pedido)/i);
  });
  it("documenta o contrato de saída com o marcador ---JSON---", () => {
    expect(out).toContain("---JSON---");
    expect(out).toContain("commands");
  });
  it("inclui as dimensões reais do formato atual", () => {
    expect(out).toContain("1080");
  });
  it("informa o número de camadas atuais da canvas", () => {
    const comComCamadas = buildStudioSystemPrompt(manual, {
      ...comp,
      camadas: [{ id: "a", tipo: "texto", text: "X", x: 0, y: 0, w: 10,
        fontSize: 10, fontWeight: 400, color: "#fff", align: "left",
        font: "Marca Sans", spacing: 0, opacity: 1, z: 1 }],
    });
    expect(comComCamadas).toMatch(/1 (elemento|camada)/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/design-studio-prompt.test.ts`
Expected: FAIL — cannot find module `@/lib/design/studio-prompt`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/design/studio-prompt.ts
import type { ManualMarca, Composicao } from "./studio-tipos";
import { dimensoesDoFormato } from "./studio-tipos";

function resumoCanvas(comp: Composicao): string {
  const dims = dimensoesDoFormato(comp.formato);
  const n = comp.camadas.length;
  const lista = comp.camadas
    .map((c) => c.tipo + (c.tipo === "texto" ? `("${c.text.slice(0, 20)}")` : ""))
    .join(", ");
  return `Formato: ${comp.formato} (${dims.w}x${dims.h}px). Fundo: ${comp.fundo.cor}. ` +
    `${n} elemento(s) na canvas${lista ? `: ${lista}` : ""}.`;
}

export function buildStudioSystemPrompt(manual: ManualMarca, comp: Composicao): string {
  const fontes = manual.fontes.length
    ? manual.fontes.map((f) => `- "${f.nome}" (${f.papel})`).join("\n")
    : "- (nenhuma fonte de marca cadastrada; use 'Inter')";
  const paleta = manual.paletas.length ? manual.paletas.join(", ") : "(sem paleta definida)";
  const dims = dimensoesDoFormato(comp.formato);

  return `Você é a IA do Studio de Arte da Yide Digital. Você monta e edita artes para redes
sociais de um cliente específico, emitindo COMANDOS que o editor executa (você não desenha
imagens — você compõe camadas: textos, formas, foto e logo).

MANUAL DE MARCA DO CLIENTE (use por padrão):
Fontes disponíveis:
${fontes}
Paleta de cores (hex): ${paleta}
Cor de fundo padrão: ${manual.fundo_padrao ?? "#111111"}
Logo: ${manual.logo_url ? "disponível (use o comando addLogo)" : "não cadastrada"}
Mood: ${manual.mood || "(livre)"}
Tom de voz da copy: ${manual.tom_voz || "(livre)"}
Evitar: ${manual.evitar || "(nada específico)"}

REGRA PRINCIPAL: use as fontes e cores da marca POR PADRÃO. Só desvie da marca se o usuário
pedir explicitamente nesta conversa (ex.: "dessa vez usa vermelho").

CANVAS ATUAL: ${resumoCanvas(comp)}
Dimensões reais: ${dims.w}x${dims.h}px. Distribua os elementos pensando nessas medidas.

FORMATO DA RESPOSTA:
1) Uma mensagem curta e amigável em pt-BR explicando o que vai fazer.
2) O marcador numa linha isolada: ---JSON---
3) Um objeto JSON (sem markdown) com a lista de comandos.

Exemplo de JSON:
{"commands":[
  {"action":"setBg","color":"#062e10"},
  {"action":"addTexto","text":"BRASIL","x":80,"y":180,"w":900,"fontSize":120,"fontWeight":900,"color":"#ffdf00","align":"center","font":"Marca Sans","spacing":5},
  {"action":"addLogo","x":880,"y":940,"w":140,"h":100}
]}

Comandos válidos: setBg{color}, setFormato{formato}, toggleStripes{show},
addTexto{text,x,y,w,fontSize,fontWeight,color,align,font,spacing},
addShape{subtype:rect|circle|line,x,y,w,h,bg,borderColor,borderW,radius},
addLogo{x,y,w,h}, updateLayer{id,props}, removeLayer{id}, clearAll.
Use SOMENTE nomes de fonte da lista do manual (ou "Inter"). Cores sempre em hex.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/design-studio-prompt.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/studio-prompt.ts tests/unit/design-studio-prompt.test.ts
git commit -m "feat(design): system prompt do Studio com manual de marca"
```

---

## Task 4: Migration — coluna `composicao`

**Files:**
- Create: `supabase/migrations/20260606000000_design_studio_composicao.sql`

- [ ] **Step 1: Write the migration**

```sql
-- =====================================================
-- DESIGN STUDIO — FASE 1
-- Composição editável da arte (camadas + fundo + formato).
-- midias[0] continua sendo a URL do PNG exportado (o que o cliente aprova).
-- =====================================================
alter table public.design_artes
  add column if not exists composicao jsonb;

comment on column public.design_artes.composicao is
  'Estado reabrível da canvas do Studio: { formato, fundo, camadas[] }. NULL para artes de cadastro manual.';
```

- [ ] **Step 2: Verify SQL parses locally (dry, sem aplicar)**

Run: `git diff --stat` e revise o arquivo. (Migrations são aplicadas manualmente no SQL Editor do Supabase após o merge — ver nota de deploy no fim do plano. Não aplicar agora.)
Expected: arquivo criado, sem erros de sintaxe óbvios.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260606000000_design_studio_composicao.sql
git commit -m "feat(design): migration coluna composicao em design_artes"
```

---

## Task 5: Server actions do manual de marca (fonte/logo/paleta)

Reusa o padrão de `uploadDesignMidiaAction` (bucket `design-criativos`, signed URL, `requireAuth`, `canManage`). O manual é persistido em `clients.design_style_guide`.

**Files:**
- Create: `src/lib/design/marca-actions.ts`
- Modify: `src/lib/design/queries.ts` (adicionar `getManualMarca`)
- Test: `tests/unit/design-marca-schema.test.ts`

- [ ] **Step 1: Write the failing test (validação de upload de fonte)**

```typescript
// tests/unit/design-marca-schema.test.ts
import { describe, it, expect } from "vitest";
import { fonteFormatFromName, MARCA_FONT_EXTS } from "@/lib/design/marca-actions";

describe("fonteFormatFromName", () => {
  it("mapeia extensão pra format de @font-face", () => {
    expect(fonteFormatFromName("Marca.ttf")).toBe("truetype");
    expect(fonteFormatFromName("Marca.otf")).toBe("opentype");
    expect(fonteFormatFromName("Marca.woff")).toBe("woff");
    expect(fonteFormatFromName("Marca.woff2")).toBe("woff2");
  });
  it("retorna null pra extensão não suportada", () => {
    expect(fonteFormatFromName("Marca.png")).toBeNull();
  });
  it("MARCA_FONT_EXTS lista as extensões aceitas", () => {
    expect(MARCA_FONT_EXTS).toEqual([".ttf", ".otf", ".woff", ".woff2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/design-marca-schema.test.ts`
Expected: FAIL — cannot find module `@/lib/design/marca-actions`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/design/marca-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import type { FonteMarca, ManualMarca } from "./studio-tipos";

interface Ok { success: true }
interface Err { error: string }
type Result = Ok | Err;

const ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];
function canManage(role: string): boolean {
  return ROLES.includes(role);
}

export const MARCA_FONT_EXTS = [".ttf", ".otf", ".woff", ".woff2"] as const;

export function fonteFormatFromName(name: string): FonteMarca["format"] | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ttf")) return "truetype";
  if (lower.endsWith(".otf")) return "opentype";
  if (lower.endsWith(".woff2")) return "woff2";
  if (lower.endsWith(".woff")) return "woff";
  return null;
}

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

async function orgIdDoCliente(sb: ReturnType<typeof createServiceRoleClient>, clientId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("clients").select("organization_id, design_style_guide")
    .eq("id", clientId).single();
  return data as { organization_id: string; design_style_guide: Record<string, unknown> | null } | null;
}

async function salvarStyleGuide(clientId: string, patch: Record<string, unknown>): Promise<Result> {
  const sb = createServiceRoleClient();
  const cli = await orgIdDoCliente(sb, clientId);
  if (!cli) return { error: "Cliente não encontrado" };
  const atual = (cli.design_style_guide ?? {}) as Record<string, unknown>;
  const novo = { ...atual, ...patch };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any)
    .from("clients").update({ design_style_guide: novo }).eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath(`/design/${clientId}/studio`);
  return { success: true };
}

export async function uploadFonteMarcaAction(
  clientId: string, papel: "titulo" | "corpo", formData: FormData,
): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  const format = fonteFormatFromName(file.name);
  if (!format) return { error: "Use .ttf, .otf, .woff ou .woff2" };
  if (file.size > MAX_BYTES) return { error: "Fonte grande demais (max 10MB)" };

  const sb = createServiceRoleClient();
  const cli = await orgIdDoCliente(sb, clientId);
  if (!cli) return { error: "Cliente não encontrado" };

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${cli.organization_id}/${clientId}/marca/${Date.now()}-${safe}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (sb as any).storage
    .from("design-criativos").upload(path, file, { contentType: file.type || "font/ttf", upsert: false });
  if (upErr) return { error: upErr.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: signed } = await (sb as any).storage
    .from("design-criativos").createSignedUrl(path, 365 * 24 * 60 * 60);
  if (!signed?.signedUrl) return { error: "Erro ao gerar URL da fonte" };

  const nome = file.name.replace(/\.[^.]+$/, "");
  const atual = (cli.design_style_guide?.fontes as FonteMarca[] | undefined) ?? [];
  const fontes = [...atual.filter((f) => f.nome !== nome), { nome, papel, url: signed.signedUrl, format }];
  return salvarStyleGuide(clientId, { fontes });
}

export async function uploadLogoMarcaAction(clientId: string, formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!file.type.startsWith("image/")) return { error: "Logo precisa ser imagem" };
  if (file.size > MAX_BYTES) return { error: "Logo grande demais (max 10MB)" };

  const sb = createServiceRoleClient();
  const cli = await orgIdDoCliente(sb, clientId);
  if (!cli) return { error: "Cliente não encontrado" };
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${cli.organization_id}/${clientId}/marca/logo-${Date.now()}-${safe}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (sb as any).storage
    .from("design-criativos").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return { error: upErr.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: signed } = await (sb as any).storage
    .from("design-criativos").createSignedUrl(path, 365 * 24 * 60 * 60);
  if (!signed?.signedUrl) return { error: "Erro ao gerar URL da logo" };
  return salvarStyleGuide(clientId, { logo_url: signed.signedUrl });
}

export async function updateManualMarcaAction(
  clientId: string,
  patch: { paletas?: string[]; fundo_padrao?: string | null; mood?: string; tom_voz?: string; evitar?: string },
): Promise<Result> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };
  return salvarStyleGuide(clientId, patch);
}
```

- [ ] **Step 4: Add `getManualMarca` to queries**

Adicione o import no topo de `src/lib/design/queries.ts` (junto dos imports existentes):

```typescript
import type { ManualMarca, FonteMarca } from "./studio-tipos";
```

E adicione a função no fim do arquivo:

```typescript
export async function getManualMarca(clientId: string): Promise<ManualMarca> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("clients").select("design_style_guide").eq("id", clientId).single();
  const sg = (data?.design_style_guide ?? {}) as Record<string, unknown>;
  return {
    fontes: Array.isArray(sg.fontes) ? (sg.fontes as FonteMarca[]) : [],
    logo_url: typeof sg.logo_url === "string" ? sg.logo_url : null,
    fundo_padrao: typeof sg.fundo_padrao === "string" ? sg.fundo_padrao : null,
    paletas: Array.isArray(sg.paletas) ? (sg.paletas as string[]) : [],
    mood: typeof sg.mood === "string" ? sg.mood : "",
    tom_voz: typeof sg.tom_voz === "string" ? sg.tom_voz : "",
    evitar: typeof sg.evitar === "string" ? sg.evitar : "",
  };
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `npx vitest run tests/unit/design-marca-schema.test.ts && npx tsc --noEmit`
Expected: testes PASS (3); tsc sem erros nos arquivos novos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/design/marca-actions.ts src/lib/design/queries.ts tests/unit/design-marca-schema.test.ts
git commit -m "feat(design): server actions do manual de marca (fonte/logo/paleta)"
```

---

## Task 6: Server actions de salvar/abrir composição

**Files:**
- Create: `src/lib/design/studio-actions.ts`
- Test: `tests/unit/design-studio-actions-schema.test.ts`

- [ ] **Step 1: Write the failing test (validação do payload)**

```typescript
// tests/unit/design-studio-actions-schema.test.ts
import { describe, it, expect } from "vitest";
import { salvarComposicaoSchema } from "@/lib/design/studio-actions";

describe("salvarComposicaoSchema", () => {
  it("aceita payload válido com composição e pngBase64", () => {
    const r = salvarComposicaoSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      arteId: null,
      titulo: "Post jogo",
      formato: "feed",
      composicao: { formato: "feed", fundo: { cor: "#000", foto: null, listras: false }, camadas: [] },
      pngBase64: "data:image/png;base64,iVBOR",
    });
    expect(r.success).toBe(true);
  });
  it("rejeita titulo vazio", () => {
    const r = salvarComposicaoSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      arteId: null, titulo: "", formato: "feed",
      composicao: { formato: "feed", fundo: { cor: "#000", foto: null, listras: false }, camadas: [] },
      pngBase64: "data:image/png;base64,iVBOR",
    });
    expect(r.success).toBe(false);
  });
  it("rejeita pngBase64 que não é data:image/png", () => {
    const r = salvarComposicaoSchema.safeParse({
      clientId: "11111111-1111-1111-1111-111111111111",
      arteId: null, titulo: "X", formato: "feed",
      composicao: { formato: "feed", fundo: { cor: "#000", foto: null, listras: false }, camadas: [] },
      pngBase64: "not-a-data-url",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/design-studio-actions-schema.test.ts`
Expected: FAIL — cannot find module `@/lib/design/studio-actions`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/design/studio-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import type { Composicao } from "./studio-tipos";

interface Err { error: string }
type SaveResult = { success: true; arteId: string } | Err;

const ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];

const uuid = z.string().uuid();

export const salvarComposicaoSchema = z.object({
  clientId: uuid,
  arteId: uuid.nullable(),
  titulo: z.string().min(1, "Dê um título à arte"),
  formato: z.string().min(1),
  composicao: z.object({
    formato: z.string(),
    fundo: z.object({
      cor: z.string(),
      foto: z.any().nullable(),
      listras: z.boolean(),
    }),
    camadas: z.array(z.any()),
  }),
  pngBase64: z.string().regex(/^data:image\/png;base64,/, "PNG inválido"),
});

export type SalvarComposicaoInput = z.infer<typeof salvarComposicaoSchema>;

function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function salvarComposicaoAction(input: SalvarComposicaoInput): Promise<SaveResult> {
  const actor = await requireAuth();
  if (!ROLES.includes(actor.role)) return { error: "Sem permissão" };
  const parsed = salvarComposicaoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const { clientId, arteId, titulo, formato, composicao, pngBase64 } = parsed.data;

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: cli } = await sbAny
    .from("clients").select("organization_id").eq("id", clientId).single();
  if (!cli) return { error: "Cliente não encontrado" };

  // 1) upsert da arte (cria se arteId null)
  const row = {
    organization_id: cli.organization_id,
    client_id: clientId,
    titulo,
    formato,
    composicao: composicao as unknown as Composicao,
    fonte_origem: "manual" as const,
    criado_por: actor.id,
  };
  let id = arteId;
  if (id) {
    const { error } = await sbAny.from("design_artes")
      .update({ titulo, formato, composicao }).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await sbAny.from("design_artes")
      .insert(row).select("id").single();
    if (error || !data) return { error: error?.message ?? "Falha ao criar arte" };
    id = data.id as string;
  }

  // 2) sobe o PNG exportado e grava em midias[0]
  const path = `${cli.organization_id}/${clientId}/${id}/export.png`;
  const buffer = dataUrlToBuffer(pngBase64);
  const { error: upErr } = await sbAny.storage
    .from("design-criativos")
    .upload(path, buffer, { contentType: "image/png", upsert: true });
  if (upErr) return { error: upErr.message };
  const { data: signed } = await sbAny.storage
    .from("design-criativos").createSignedUrl(path, 7 * 24 * 60 * 60);
  const midias = signed?.signedUrl ? [signed.signedUrl] : [];
  await sbAny.from("design_artes").update({ midias }).eq("id", id);

  revalidatePath(`/design/${clientId}`);
  return { success: true, arteId: id! };
}

export async function getComposicaoAction(arteId: string): Promise<{ composicao: Composicao; titulo: string; formato: string } | Err> {
  await requireAuth();
  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any)
    .from("design_artes").select("composicao, titulo, formato").eq("id", arteId).single();
  if (!data?.composicao) return { error: "Arte sem composição (foi cadastro manual?)" };
  return { composicao: data.composicao as Composicao, titulo: data.titulo, formato: data.formato };
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/unit/design-studio-actions-schema.test.ts && npx tsc --noEmit`
Expected: testes PASS (3); tsc sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/studio-actions.ts tests/unit/design-studio-actions-schema.test.ts
git commit -m "feat(design): salvar/abrir composição do Studio"
```

---

## Task 7: Server action do chat IA

**Files:**
- Create: `src/lib/design/chat-actions.ts`
- Test: `tests/unit/design-chat-mensagens.test.ts`

- [ ] **Step 1: Write the failing test (montagem das mensagens, sem chamar a API)**

```typescript
// tests/unit/design-chat-mensagens.test.ts
import { describe, it, expect } from "vitest";
import { montarMensagensChat } from "@/lib/design/chat-actions";

describe("montarMensagensChat", () => {
  it("converte histórico + nova mensagem no formato da Anthropic", () => {
    const msgs = montarMensagensChat(
      [{ role: "user", content: "oi" }, { role: "assistant", content: "olá" }],
      "cria um post",
    );
    expect(msgs).toEqual([
      { role: "user", content: "oi" },
      { role: "assistant", content: "olá" },
      { role: "user", content: "cria um post" },
    ]);
  });
  it("ignora roles inválidas do histórico", () => {
    const msgs = montarMensagensChat(
      // @ts-expect-error teste de runtime
      [{ role: "system", content: "x" }, { role: "user", content: "oi" }],
      "vai",
    );
    expect(msgs).toEqual([
      { role: "user", content: "oi" },
      { role: "user", content: "vai" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/design-chat-mensagens.test.ts`
Expected: FAIL — cannot find module `@/lib/design/chat-actions`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/design/chat-actions.ts
"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";
import { requireAuth } from "@/lib/auth/session";
import { getManualMarca } from "./queries";
import { buildStudioSystemPrompt } from "./studio-prompt";
import { parseRespostaIA, type Comando } from "./studio-comandos";
import type { Composicao } from "./studio-tipos";

export interface ChatMsg { role: "user" | "assistant"; content: string }

interface ChatErr { error: string }
type ChatResult = { mensagem: string; comandos: Comando[] } | ChatErr;

const ROLES = [
  "adm", "socio", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];

/** Pure: monta o array de mensagens da Anthropic a partir do histórico + nova msg. */
export function montarMensagensChat(historico: ChatMsg[], nova: string): ChatMsg[] {
  const limpo = historico.filter((m) => m.role === "user" || m.role === "assistant");
  return [...limpo, { role: "user", content: nova }];
}

export async function chatStudioAction(
  clientId: string,
  historico: ChatMsg[],
  mensagem: string,
  composicao: Composicao,
): Promise<ChatResult> {
  const actor = await requireAuth();
  if (!ROLES.includes(actor.role)) return { error: "Sem permissão" };

  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return { error: "IA não configurada (ANTHROPIC_API_KEY ausente)" };

  const manual = await getManualMarca(clientId);
  const system = buildStudioSystemPrompt(manual, composicao);
  const messages = montarMensagensChat(historico, mensagem);

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system,
      messages,
    });
    const raw = resp.content
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("");
    const { mensagem: msg, comandos } = parseRespostaIA(raw);
    return { mensagem: msg || "Pronto!", comandos };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao chamar a IA" };
  }
}
```

> Nota de modelo: confirme o ID do modelo Sonnet vigente no projeto (grep por `claude-sonnet` em `src/`). Se o app já padroniza um helper de modelo, use-o em vez do literal.

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/unit/design-chat-mensagens.test.ts && npx tsc --noEmit`
Expected: testes PASS (2); tsc sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design/chat-actions.ts tests/unit/design-chat-mensagens.test.ts
git commit -m "feat(design): server action do chat IA do Studio"
```

---

## Task 8: Hook de estado da composição (`useComposicao`)

**Files:**
- Create: `src/components/design/studio/useComposicao.ts`
- Test: `tests/unit/design-studio-usecomposicao.test.ts`

O hook é uma store pura sobre `useReducer`; o reducer é exportado e testado isolado.

- [ ] **Step 1: Write the failing test (reducer puro)**

```typescript
// tests/unit/design-studio-usecomposicao.test.ts
import { describe, it, expect } from "vitest";
import { composicaoReducer, aplicarComandos } from "@/components/design/studio/useComposicao";
import { COMPOSICAO_VAZIA } from "@/lib/design/studio-tipos";

describe("composicaoReducer", () => {
  it("addTexto adiciona uma camada de texto", () => {
    const st = composicaoReducer(COMPOSICAO_VAZIA, {
      type: "addCamada",
      camada: { tipo: "texto", text: "OI", x: 0, y: 0, w: 100, fontSize: 20, fontWeight: 700, color: "#fff", align: "center", font: "Inter", spacing: 0, opacity: 1 },
    });
    expect(st.camadas).toHaveLength(1);
    expect(st.camadas[0].tipo).toBe("texto");
    expect(st.camadas[0].id).toBeTruthy();
  });

  it("removeCamada remove pelo id", () => {
    const add = composicaoReducer(COMPOSICAO_VAZIA, {
      type: "addCamada",
      camada: { tipo: "shape", subtype: "rect", x: 0, y: 0, w: 10, h: 10, bg: "#000", borderColor: "transparent", borderW: 0, radius: 0, opacity: 1 },
    });
    const id = add.camadas[0].id;
    const rem = composicaoReducer(add, { type: "removeCamada", id });
    expect(rem.camadas).toHaveLength(0);
  });

  it("setBg muda a cor de fundo", () => {
    const st = composicaoReducer(COMPOSICAO_VAZIA, { type: "setBg", cor: "#123456" });
    expect(st.fundo.cor).toBe("#123456");
  });
});

describe("aplicarComandos", () => {
  it("executa setBg + addTexto vindos da IA", () => {
    const st = aplicarComandos(COMPOSICAO_VAZIA, [
      { action: "setBg", color: "#000000" },
      { action: "addTexto", text: "BRASIL", x: 10, y: 10, w: 100, fontSize: 40, fontWeight: 900, color: "#ffdf00", align: "center", font: "Inter", spacing: 0 },
    ], "logo.png");
    expect(st.fundo.cor).toBe("#000000");
    expect(st.camadas).toHaveLength(1);
    expect((st.camadas[0] as { text: string }).text).toBe("BRASIL");
  });

  it("clearAll esvazia as camadas", () => {
    const com = aplicarComandos(COMPOSICAO_VAZIA, [
      { action: "addTexto", text: "X", x: 0, y: 0, w: 1, fontSize: 1, fontWeight: 1, color: "#000", align: "left", font: "Inter", spacing: 0 },
    ], null);
    const limpo = aplicarComandos(com, [{ action: "clearAll" }], null);
    expect(limpo.camadas).toHaveLength(0);
  });

  it("addLogo usa a logoUrl do cliente", () => {
    const st = aplicarComandos(COMPOSICAO_VAZIA, [{ action: "addLogo", x: 1, y: 2, w: 3, h: 4 }], "logo.png");
    expect(st.camadas).toHaveLength(1);
    expect(st.camadas[0].tipo).toBe("logo");
    expect((st.camadas[0] as { src: string }).src).toBe("logo.png");
  });

  it("addLogo é ignorado se não há logo do cliente", () => {
    const st = aplicarComandos(COMPOSICAO_VAZIA, [{ action: "addLogo", x: 1, y: 2, w: 3, h: 4 }], null);
    expect(st.camadas).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/design-studio-usecomposicao.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/design/studio/useComposicao.ts
"use client";

import { useReducer, useCallback } from "react";
import type { Camada, Composicao } from "@/lib/design/studio-tipos";
import { COMPOSICAO_VAZIA } from "@/lib/design/studio-tipos";
import type { Comando } from "@/lib/design/studio-comandos";

let zCounter = 10;
function uid(): string {
  zCounter += 1;
  return "e" + Math.random().toString(36).slice(2, 10);
}

export type Acao =
  | { type: "reset"; composicao: Composicao }
  | { type: "addCamada"; camada: Omit<Camada, "id" | "z"> }
  | { type: "updateCamada"; id: string; patch: Partial<Camada> }
  | { type: "removeCamada"; id: string }
  | { type: "reordenar"; id: string; dir: "up" | "down" }
  | { type: "setBg"; cor: string }
  | { type: "setFormato"; formato: string }
  | { type: "setFoto"; foto: Composicao["fundo"]["foto"] }
  | { type: "toggleListras"; show: boolean }
  | { type: "limpar" };

export function composicaoReducer(state: Composicao, acao: Acao): Composicao {
  switch (acao.type) {
    case "reset":
      return acao.composicao;
    case "addCamada": {
      zCounter += 1;
      const camada = { ...acao.camada, id: uid(), z: zCounter } as Camada;
      return { ...state, camadas: [...state.camadas, camada] };
    }
    case "updateCamada":
      return {
        ...state,
        camadas: state.camadas.map((c) => (c.id === acao.id ? ({ ...c, ...acao.patch } as Camada) : c)),
      };
    case "removeCamada":
      return { ...state, camadas: state.camadas.filter((c) => c.id !== acao.id) };
    case "reordenar":
      return {
        ...state,
        camadas: state.camadas.map((c) =>
          c.id === acao.id ? { ...c, z: acao.dir === "up" ? c.z + 2 : Math.max(1, c.z - 2) } : c,
        ),
      };
    case "setBg":
      return { ...state, fundo: { ...state.fundo, cor: acao.cor } };
    case "setFormato":
      return { ...state, formato: acao.formato };
    case "setFoto":
      return { ...state, fundo: { ...state.fundo, foto: acao.foto } };
    case "toggleListras":
      return { ...state, fundo: { ...state.fundo, listras: acao.show } };
    case "limpar":
      return { ...state, camadas: [] };
    default:
      return state;
  }
}

/** Pure: aplica uma lista de comandos da IA sobre uma composição. */
export function aplicarComandos(state: Composicao, comandos: Comando[], logoUrl: string | null): Composicao {
  let s = state;
  for (const cmd of comandos) {
    switch (cmd.action) {
      case "clearAll":
        s = composicaoReducer(s, { type: "limpar" });
        break;
      case "setBg":
        s = composicaoReducer(s, { type: "setBg", cor: String(cmd.color) });
        break;
      case "setFormato":
        s = composicaoReducer(s, { type: "setFormato", formato: String(cmd.formato) });
        break;
      case "toggleStripes":
        s = composicaoReducer(s, { type: "toggleListras", show: cmd.show !== false });
        break;
      case "addTexto": {
        const { action, ...rest } = cmd;
        s = composicaoReducer(s, { type: "addCamada", camada: { tipo: "texto", opacity: 1, ...(rest as object) } as Omit<Camada, "id" | "z"> });
        break;
      }
      case "addShape": {
        const { action, ...rest } = cmd;
        s = composicaoReducer(s, { type: "addCamada", camada: { tipo: "shape", opacity: 1, ...(rest as object) } as Omit<Camada, "id" | "z"> });
        break;
      }
      case "addLogo": {
        if (!logoUrl) break;
        const { action, ...rest } = cmd;
        s = composicaoReducer(s, { type: "addCamada", camada: { tipo: "logo", src: logoUrl, opacity: 1, ...(rest as object) } as Omit<Camada, "id" | "z"> });
        break;
      }
      case "updateLayer":
        s = composicaoReducer(s, { type: "updateCamada", id: String(cmd.id), patch: (cmd.props ?? {}) as Partial<Camada> });
        break;
      case "removeLayer":
        s = composicaoReducer(s, { type: "removeCamada", id: String(cmd.id) });
        break;
    }
  }
  return s;
}

export function useComposicao(inicial: Composicao = COMPOSICAO_VAZIA) {
  const [composicao, dispatch] = useReducer(composicaoReducer, inicial);
  const aplicarIA = useCallback(
    (comandos: Comando[], logoUrl: string | null) =>
      dispatch({ type: "reset", composicao: aplicarComandos(composicao, comandos, logoUrl) }),
    [composicao],
  );
  return { composicao, dispatch, aplicarIA };
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx vitest run tests/unit/design-studio-usecomposicao.test.ts && npx tsc --noEmit`
Expected: testes PASS (7); tsc sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/design/studio/useComposicao.ts tests/unit/design-studio-usecomposicao.test.ts
git commit -m "feat(design): hook/reducer de composição do Studio"
```

---

## Task 9: Export da canvas → PNG (`exportCanvas.ts`)

Componente client-side. Verificação manual (DOM/canvas não é unit-testável de forma confiável).

**Files:**
- Create: `src/components/design/studio/exportCanvas.ts`
- Modify: `package.json` (adiciona `html-to-image`)

- [ ] **Step 1: Instalar a dependência**

Run: `npm install html-to-image`
Expected: adiciona `html-to-image` em `dependencies`.

- [ ] **Step 2: Implementar o helper**

```typescript
// src/components/design/studio/exportCanvas.ts
"use client";

import { toPng } from "html-to-image";

/**
 * Renderiza o elemento da canvas (já no tamanho real do formato) em PNG.
 * Espera as fontes custom carregarem antes de capturar, pra não exportar
 * com fonte fallback.
 */
export async function exportarCanvasPng(el: HTMLElement, dims: { w: number; h: number }): Promise<string> {
  if (typeof document !== "undefined" && "fonts" in document) {
    try { await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready; } catch { /* ignore */ }
  }
  return toPng(el, {
    width: dims.w,
    height: dims.h,
    pixelRatio: 1,
    cacheBust: true,
    style: { transform: "none", transformOrigin: "top left" },
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/design/studio/exportCanvas.ts
git commit -m "feat(design): export da canvas do Studio em PNG"
```

---

## Task 10: Componentes de UI do Studio

Componentes React client-side. São verificados manualmente no app (Task 13) e por um smoke e2e (Task 14). Cada componente tem responsabilidade única.

**Files:**
- Create: `src/components/design/studio/StudioCanvas.tsx`
- Create: `src/components/design/studio/StudioProperties.tsx`
- Create: `src/components/design/studio/StudioLeftPanel.tsx`
- Create: `src/components/design/studio/StudioChat.tsx`
- Create: `src/components/design/studio/StudioShell.tsx`

- [ ] **Step 1: `StudioCanvas.tsx` — renderiza camadas + drag/resize**

Renderiza `composicao` num wrapper de tamanho real (`dimensoesDoFormato`), exibido escalado via `transform: scale()` para caber na viewport. Cada camada vira um `div` posicionável; mousedown inicia drag; alça inferior-direita inicia resize; `onSelect(id)` no clique. Recebe props:

```typescript
// assinatura esperada
interface StudioCanvasProps {
  composicao: import("@/lib/design/studio-tipos").Composicao;
  selId: string | null;
  onSelect: (id: string | null) => void;
  dispatch: import("./useComposicao").Acao extends never ? never : (a: import("./useComposicao").Acao) => void;
  canvasRef: React.RefObject<HTMLDivElement>; // usado pelo export (tamanho real)
  escala: number; // ex.: 0.4 pra caber na tela
}
```

Regras de render por tipo de camada (espelha o protótipo `yide_studio_final.html` linhas 458–493): texto (`font-family`, `font-size`, `font-weight`, `color`, `text-align`, `letter-spacing`), shape (`background`, `border`, `border-radius`; `circle` = radius alto; `line` = altura pequena), imagem/logo (`<img>` com `object-fit:contain`). Listras topo/base quando `fundo.listras`. Foto de fundo com zoom/opacidade quando `fundo.foto`. O `canvasRef` aponta para o wrapper de tamanho real (sem o `scale`) — o export usa ele.

- [ ] **Step 2: `StudioProperties.tsx` — painel direito**

Espelha o painel direito do protótipo (linhas 294–337). Recebe a camada selecionada e `dispatch`. Campos: texto (conteúdo, cor, tamanho, peso, alinhamento, espaçamento), shape (cor fundo, borda cor/px, radius), opacidade (todos), ações (subir/descer camada, deletar). Cada alteração chama `dispatch({type:"updateCamada", id, patch})` ou `reordenar`/`removeCamada`. Sem seleção, mostra "Selecione um elemento".

- [ ] **Step 3: `StudioLeftPanel.tsx` — painel esquerdo**

Espelha o painel esquerdo (linhas 183–249) + manual de marca:
- Foto de fundo: upload (vira data URL → `dispatch setFoto`), sliders zoom/mover/opacidade.
- Fundo: color picker + presets + paleta da marca (botões com `manual.paletas`); listras mostrar/ocultar.
- Adicionar elementos: texto, rect, circle, line, imagem (upload), **logo** (só habilitado se `manual.logo_url`), badge.
- Fontes: `<select>` com `manual.fontes` (marca) no topo + fontes web; botão "carregar fonte" → `uploadFonteMarcaAction(clientId, papel, fd)` (persiste no cliente) e injeta `@font-face`.
- Camadas: lista clicável (espelha `updLayers`, linhas 559–578), com deletar.

Props incluem `clientId`, `manual: ManualMarca`, `dispatch`, `onSelect`.

- [ ] **Step 4: `StudioChat.tsx` — chat IA**

Espelha o chat (linhas 267–289) mas chamando a server action `chatStudioAction(clientId, historico, msg, composicao)`. Mantém `historico: ChatMsg[]` em estado. Ao receber `{mensagem, comandos}`: adiciona a mensagem ao chat e chama `aplicarIA(comandos, manual.logo_url)`; depois troca pra aba Editor. Pills de exemplo. Trata `{error}` mostrando aviso no chat.

- [ ] **Step 5: `StudioShell.tsx` — layout + header + salvar**

Orquestra tudo: usa `useComposicao(inicial)`, mantém `selId` e a aba ativa (`editor`/`chat`). Layout 3 colunas (esquerda/centro/direita). Header: nome do cliente, seletor de formato (`FORMATOS`), tabs Editor/Chat, botão **Salvar**. Ao abrir, injeta `@font-face` de `manual.fontes`. Botão Salvar:
1. chama `exportarCanvasPng(canvasRef.current, dimensoesDoFormato(composicao.formato))`,
2. chama `salvarComposicaoAction({clientId, arteId, titulo, formato, composicao, pngBase64})`,
3. em sucesso, redireciona pra `/design/[clientId]` (ou atualiza `arteId`).

Props: `clientId`, `manual`, `arteInicial?: { id, titulo, composicao }`, `nomeCliente`.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/design/studio/
git commit -m "feat(design): componentes de UI do Studio (canvas, painéis, chat, shell)"
```

---

## Task 11: Páginas do Studio + botão de entrada

**Files:**
- Create: `src/app/(authed)/design/[clientId]/studio/page.tsx`
- Create: `src/app/(authed)/design/[clientId]/studio/[arteId]/page.tsx`
- Modify: `src/app/(authed)/design/[clientId]/page.tsx` (botão "Criar no Studio")

- [ ] **Step 1: Página de nova arte**

```tsx
// src/app/(authed)/design/[clientId]/studio/page.tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getManualMarca } from "@/lib/design/queries";
import { StudioShell } from "@/components/design/studio/StudioShell";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const ALLOWED = ["adm","socio","coordenador","assessor","designer","videomaker","editor","audiovisual_chefe"];

export default async function StudioNovoPage({ params }: { params: Promise<{ clientId: string }> }) {
  const user = await requireAuth();
  if (!ALLOWED.includes(user.role)) notFound();
  const { clientId } = await params;
  const manual = await getManualMarca(clientId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cli } = await (createServiceRoleClient() as any)
    .from("clients").select("nome").eq("id", clientId).single();
  if (!cli) notFound();
  return <StudioShell clientId={clientId} nomeCliente={cli.nome} manual={manual} />;
}
```

- [ ] **Step 2: Página de reabrir arte**

```tsx
// src/app/(authed)/design/[clientId]/studio/[arteId]/page.tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getManualMarca } from "@/lib/design/queries";
import { getComposicaoAction } from "@/lib/design/studio-actions";
import { StudioShell } from "@/components/design/studio/StudioShell";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const ALLOWED = ["adm","socio","coordenador","assessor","designer","videomaker","editor","audiovisual_chefe"];

export default async function StudioEditarPage({ params }: { params: Promise<{ clientId: string; arteId: string }> }) {
  const user = await requireAuth();
  if (!ALLOWED.includes(user.role)) notFound();
  const { clientId, arteId } = await params;
  const manual = await getManualMarca(clientId);
  const arte = await getComposicaoAction(arteId);
  if ("error" in arte) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cli } = await (createServiceRoleClient() as any)
    .from("clients").select("nome").eq("id", clientId).single();
  if (!cli) notFound();
  return (
    <StudioShell
      clientId={clientId}
      nomeCliente={cli.nome}
      manual={manual}
      arteInicial={{ id: arteId, titulo: arte.titulo, composicao: arte.composicao }}
    />
  );
}
```

- [ ] **Step 3: Botão "Criar no Studio" na página do cliente**

Em `src/app/(authed)/design/[clientId]/page.tsx`, adicione um link/botão pro Studio no cabeçalho da página (perto de onde se cria arte manual):

```tsx
import Link from "next/link";
import { Palette } from "lucide-react";
// ...
<Link
  href={`/design/${clientId}/studio`}
  className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
>
  <Palette className="h-4 w-4" /> Criar no Studio
</Link>
```

> Localize o `clientId`/`params` reais dessa página antes de inserir (ela já existe; siga o padrão dela). O cadastro manual permanece.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build OK.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authed)/design/[clientId]/studio" "src/app/(authed)/design/[clientId]/page.tsx"
git commit -m "feat(design): páginas do Studio + botão de entrada"
```

---

## Task 12: Suíte completa de testes + lint

- [ ] **Step 1: Rodar tudo**

Run: `npx vitest run && npx tsc --noEmit && npm run lint`
Expected: todos os testes unit do Studio PASS; tsc e lint limpos.

- [ ] **Step 2: Commit (se houver ajustes de lint)**

```bash
git add -A
git commit -m "chore(design): ajustes de lint do Studio" || echo "nada a commitar"
```

---

## Task 13: Verificação manual no app

> Migration precisa estar aplicada num ambiente de teste OU rode com a coluna `composicao` criada localmente. Se não houver banco local, valide o máximo possível e marque o que depende da migration.

- [ ] **Step 1: Subir o dev e abrir o Studio**

Run: `npm run dev` e acesse `/design` → escolha um cliente → "Criar no Studio".
Verifique: layout 3 painéis carrega; formato selecionável; fontes da marca aparecem no select.

- [ ] **Step 2: Editor manual**

Adicione texto, mova/redimensione, troque cor/fonte/tamanho no painel direito; adicione shape e logo (se cadastrada). Camadas listam e deletam.

- [ ] **Step 3: Chat IA**

Na aba Chat, peça "cria um post de promoção". Confirme: volta mensagem + a canvas é montada com as cores/fontes da marca; troca pra aba Editor.

- [ ] **Step 4: Salvar**

Clique Salvar com um título. Confirme: arte aparece na biblioteca `/design/[clientId]`; reabrir via `/studio/[arteId]` restaura a composição; o PNG abre.

- [ ] **Step 5: Manual de marca persiste**

Suba uma fonte e uma logo; recarregue o Studio do mesmo cliente e confirme que reaparecem.

---

## Task 14: Smoke e2e (Playwright)

**Files:**
- Create: `tests/e2e/design-studio.spec.ts`

- [ ] **Step 1: Escrever um smoke test**

Siga o padrão dos specs existentes em `tests/e2e/` (login helper, navegação). O teste deve: logar, ir a `/design`, abrir um cliente, clicar "Criar no Studio", verificar que o header do Studio e a canvas renderizam, adicionar um texto pelo painel e confirmar que a camada aparece. (Não testar a chamada real da IA — opcionalmente mockar a server action ou pular esse passo no smoke.)

```typescript
// tests/e2e/design-studio.spec.ts — esqueleto; complete seguindo tests/e2e/painel.spec.ts
import { test, expect } from "@playwright/test";
// reaproveite o helper de login do projeto (ver outros specs)

test("abre o Studio e adiciona um texto", async ({ page }) => {
  // login (copie do helper existente)
  await page.goto("/design");
  // abrir primeiro cliente
  // clicar "Criar no Studio"
  await expect(page.getByText(/Studio/i)).toBeVisible();
  // adicionar texto e verificar camada
});
```

- [ ] **Step 2: Rodar o smoke**

Run: `npx playwright test tests/e2e/design-studio.spec.ts`
Expected: PASS (ou ajuste seletores até passar).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/design-studio.spec.ts
git commit -m "test(design): smoke e2e do Studio"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** onde vive (Task 11), modelo de dados/`composicao` (Task 4,6), manual de marca persistido com fontes/logo (Task 5,10), editor multi-formato (Task 1,10), chat server-side seguindo a marca (Task 3,7,8), salvar/export/aprovação (Task 6,9 — aprovação reusa o existente), segurança/roles (todas as actions checam `requireAuth`+roles). ✔
- **Fase 2 e fix de churn:** explicitamente fora deste plano (ver spec). ✔
- **Consistência de tipos:** `Composicao`/`Camada`/`ManualMarca`/`Comando` definidos na Task 1/2 e reusados nas Tasks 3,5,6,7,8,10,11. `parseRespostaIA`/`aplicarComandos`/`buildStudioSystemPrompt`/`salvarComposicaoAction`/`chatStudioAction`/`getManualMarca` com nomes estáveis em todo o plano. ✔

---

## Notas de deploy (pós-merge)

1. **Migration manual:** após o merge, aplicar `supabase/migrations/20260606000000_design_studio_composicao.sql` no SQL Editor do Supabase (o deploy da Vercel não roda migrations).
2. **`ANTHROPIC_API_KEY`** já deve existir no projeto (usada por yori/apresenta-yide). Confirmar que está nas env vars de produção.
3. **Modelo da IA:** confirmar o ID do modelo Sonnet vigente (Task 7) com o padrão já usado no app.
4. **Cache:** se a listagem do Design usar `unstable_cache`, não é afetada (composição é leitura direta); sem bump necessário.
