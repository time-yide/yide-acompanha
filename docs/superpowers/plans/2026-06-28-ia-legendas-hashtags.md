# IA de Legendas e Hashtags — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão "✨ Gerar com IA" no compositor de post que gera (ou melhora) legenda + hashtags na voz da marca do cliente.

**Architecture:** Gerador puro (sem DB) testável isoladamente + server action que busca o contexto da marca e chama o gerador + UI controlada no `PostFormModal`. Reusa a IA Anthropic já integrada (`getAnthropicClient`, modelo Haiku).

**Tech Stack:** Next.js (App Router, server actions), `@anthropic-ai/sdk`, zod, vitest, React.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/lib/social-media/caption-generator.ts` (novo) | Função pura `gerarLegenda(ctx)`: monta prompt, chama Anthropic, valida JSON. Sem DB. |
| `tests/unit/social-caption-generator.test.ts` (novo) | Testa o gerador com Anthropic mockado. |
| `src/lib/social-media/actions.ts` (modificar) | Nova action `gerarLegendaIaAction`: permissão + busca contexto do cliente + chama gerador. |
| `src/components/social-media/PostFormModal.tsx` (modificar) | Bloco IA (brief + botões), legenda/hashtags controladas. |

---

## Task 1: Gerador de legenda (puro, testável)

**Files:**
- Create: `src/lib/social-media/caption-generator.ts`
- Test: `tests/unit/social-caption-generator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/social-caption-generator.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@/lib/ai/client", () => ({
  getAnthropicClient: () => ({ messages: { create } }),
}));

import { gerarLegenda, type CaptionContext } from "@/lib/social-media/caption-generator";

const baseCtx: CaptionContext = {
  clientNome: "Loja X", servico: "Estratégia", tomVoz: "Descontraído",
  mood: null, evitar: null, formato: "feed", redes: ["instagram"],
  brief: "promoção 20% off", rascunho: null,
};

function aiReturns(obj: unknown) {
  create.mockResolvedValueOnce({
    content: [{ type: "text", text: JSON.stringify(obj) }],
    usage: { input_tokens: 10, output_tokens: 20 },
  });
}

describe("gerarLegenda", () => {
  beforeEach(() => create.mockReset());

  it("retorna legenda e hashtags de um JSON válido", async () => {
    aiReturns({ legenda: "Aproveite!", hashtags: "#promo #loja" });
    const r = await gerarLegenda(baseCtx);
    expect(r).toEqual({ legenda: "Aproveite!", hashtags: "#promo #loja" });
  });

  it("aceita JSON dentro de cercas markdown ```json", async () => {
    create.mockResolvedValueOnce({
      content: [{ type: "text", text: "```json\n{\"legenda\":\"Oi\",\"hashtags\":\"#a\"}\n```" }],
      usage: {},
    });
    const r = await gerarLegenda(baseCtx);
    expect(r).toEqual({ legenda: "Oi", hashtags: "#a" });
  });

  it("erro amigável quando a resposta não é JSON", async () => {
    create.mockResolvedValueOnce({ content: [{ type: "text", text: "não sei" }], usage: {} });
    const r = await gerarLegenda(baseCtx);
    expect(r).toHaveProperty("error");
  });

  it("exige brief ou rascunho (não chama a IA sem nada)", async () => {
    const r = await gerarLegenda({ ...baseCtx, brief: null, rascunho: null });
    expect(r).toHaveProperty("error");
    expect(create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/social-caption-generator.test.ts`
Expected: FAIL — cannot find module `@/lib/social-media/caption-generator`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/social-media/caption-generator.ts
// SERVER ONLY: do not import from client components
import { z } from "zod";
import { getAnthropicClient } from "@/lib/ai/client";

const CAPTION_MODEL = "claude-haiku-4-5";
const CAPTION_MAX_TOKENS = 800;

export interface CaptionContext {
  clientNome: string;
  servico: string | null;
  tomVoz: string | null;
  mood: string | null;
  evitar: string | null;
  formato: string;        // feed | carrossel | story | reels
  redes: string[];        // ["instagram", "facebook", ...]
  brief: string | null;   // ideia do post (modo gerar)
  rascunho: string | null; // legenda atual (modo melhorar)
}

export const captionOutputSchema = z.object({
  legenda: z.string(),
  hashtags: z.string(),
});

export type CaptionResult =
  | { legenda: string; hashtags: string }
  | { error: string };

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (block && typeof block === "object" && "type" in block && (block as { type: string }).type === "text") {
      const text = (block as { text?: string }).text;
      if (typeof text === "string") return text;
    }
  }
  return "";
}

function cleanJson(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function buildSystemPrompt(ctx: CaptionContext): string {
  return `Você é redator(a) de social media da agência Yide Digital, especialista em legendas que engajam.

Cliente: ${ctx.clientNome}
Serviço: ${ctx.servico ?? "não informado"}
Tom de voz da marca: ${ctx.tomVoz?.trim() ? ctx.tomVoz : "profissional, claro e próximo"}
Mood/estilo: ${ctx.mood?.trim() ? ctx.mood : "não informado"}
Evitar: ${ctx.evitar?.trim() ? ctx.evitar : "nada específico"}

Regras:
- Escreva SEMPRE na voz da marca acima.
- Não invente dados, preços, datas ou promessas que não foram passados.
- Ajuste o tamanho ao formato: story/reels = curto e direto; feed/carrossel = pode desenvolver mais.
- Hashtags relevantes ao segmento (misture amplas e de nicho), entre 8 e 15.
- Português do Brasil.`;
}

function buildUserPrompt(ctx: CaptionContext): string {
  const tarefa = ctx.rascunho?.trim()
    ? `Melhore o rascunho de legenda abaixo, deixando mais envolvente e fiel à voz da marca (mantenha a intenção):\n\n"""${ctx.rascunho.trim()}"""`
    : `Crie a legenda para este post a partir da ideia:\n\n"""${(ctx.brief ?? "").trim()}"""`;

  return `${tarefa}

Formato do post: ${ctx.formato}
Redes: ${ctx.redes.join(", ") || "instagram"}

Responda APENAS com um JSON válido, sem texto antes ou depois:
{
  "legenda": "a legenda pronta (sem as hashtags)",
  "hashtags": "as hashtags numa única linha, ex: #marketing #cuiaba #promocao"
}`;
}

export async function gerarLegenda(ctx: CaptionContext): Promise<CaptionResult> {
  const client = getAnthropicClient();
  if (!client) {
    return { error: "IA não configurada (sem ANTHROPIC_API_KEY)" };
  }
  if (!ctx.rascunho?.trim() && !ctx.brief?.trim()) {
    return { error: "Escreva uma ideia pra IA gerar (ou um rascunho pra melhorar)" };
  }

  try {
    const response = await client.messages.create({
      model: CAPTION_MODEL,
      max_tokens: CAPTION_MAX_TOKENS,
      system: [{ type: "text", text: buildSystemPrompt(ctx), cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
    });

    const raw = extractText(response.content);
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJson(raw));
    } catch {
      return { error: "Não consegui gerar agora, tente de novo" };
    }
    const validated = captionOutputSchema.safeParse(parsed);
    if (!validated.success) {
      return { error: "Não consegui gerar agora, tente de novo" };
    }
    return { legenda: validated.data.legenda, hashtags: validated.data.hashtags };
  } catch (err) {
    console.error("[caption-generator] AI call failed:", err instanceof Error ? err.message : err);
    return { error: "Erro ao chamar a IA, tente de novo" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/social-caption-generator.test.ts`
Expected: PASS (4 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/social-media/caption-generator.ts tests/unit/social-caption-generator.test.ts
git commit -m "feat(social-media): gerador de legenda/hashtags com IA (puro + testes)"
```

---

## Task 2: Server action `gerarLegendaIaAction`

**Files:**
- Modify: `src/lib/social-media/actions.ts` (adicionar import no topo + nova action no fim)

- [ ] **Step 1: Add import near other social-media imports**

No topo de `src/lib/social-media/actions.ts`, depois do import de `./tipos`, adicione:

```ts
import { gerarLegenda, type CaptionResult } from "./caption-generator";
```

- [ ] **Step 2: Add the action at the end of the file**

Acrescente no fim de `src/lib/social-media/actions.ts`:

```ts
// ===========================================================================
// IA: gerar/melhorar legenda + hashtags (opt-in, só roda no clique)
// ===========================================================================

const gerarLegendaSchema = z.object({
  client_id: uuidLike,
  brief: z.string().trim().max(500).optional().nullable(),
  rascunho: z.string().trim().max(4000).optional().nullable(),
  formato: z.enum(FORMATOS_VALIDOS).default("feed"),
  redes: z.array(z.enum(REDES_VALIDAS)).max(4).default([]),
});

export async function gerarLegendaIaAction(input: {
  client_id: string;
  brief?: string | null;
  rascunho?: string | null;
  formato?: string;
  redes?: string[];
}): Promise<CaptionResult> {
  const actor = await requireAuth();
  if (!canManage(actor.role)) return { error: "Sem permissão" };

  const parsed = gerarLegendaSchema.safeParse({
    client_id: input.client_id,
    brief: input.brief ?? null,
    rascunho: input.rascunho ?? null,
    formato: input.formato ?? "feed",
    redes: (input.redes ?? []) as ("instagram" | "facebook" | "linkedin" | "gmn")[],
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Busca contexto da marca. design_style_guide pode não existir no schema cache → fallback.
  let nome = "Cliente";
  let servico: string | null = null;
  let sg: Record<string, unknown> = {};

  const full = await sb
    .from("clients")
    .select("nome, servico_contratado, design_style_guide")
    .eq("id", parsed.data.client_id)
    .single();
  if (full.error) {
    const msg = full.error.message ?? "";
    if (msg.includes("design_style_guide") || msg.includes("schema cache")) {
      const basic = await sb
        .from("clients")
        .select("nome, servico_contratado")
        .eq("id", parsed.data.client_id)
        .single();
      if (!basic.data) return { error: "Cliente não encontrado" };
      nome = basic.data.nome ?? "Cliente";
      servico = basic.data.servico_contratado ?? null;
    } else {
      return { error: "Cliente não encontrado" };
    }
  } else if (full.data) {
    nome = full.data.nome ?? "Cliente";
    servico = full.data.servico_contratado ?? null;
    sg = (full.data.design_style_guide ?? {}) as Record<string, unknown>;
  }

  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

  return gerarLegenda({
    clientNome: nome,
    servico,
    tomVoz: str(sg.tom_voz),
    mood: str(sg.mood),
    evitar: str(sg.evitar),
    formato: parsed.data.formato,
    redes: parsed.data.redes,
    brief: parsed.data.brief ?? null,
    rascunho: parsed.data.rascunho ?? null,
  });
}
```

> Nota: `uuidLike`, `canManage`, `FORMATOS_VALIDOS`, `REDES_VALIDAS`, `createClient` e `z` já existem no arquivo (usados pelas actions atuais).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "social-media/(actions|caption-generator)" || echo "OK sem erros nos arquivos tocados"`
Expected: `OK sem erros nos arquivos tocados`

- [ ] **Step 4: Commit**

```bash
git add src/lib/social-media/actions.ts
git commit -m "feat(social-media): action gerarLegendaIaAction (contexto da marca + fallback)"
```

---

## Task 3: UI no PostFormModal (bloco IA + campos controlados)

**Files:**
- Modify: `src/components/social-media/PostFormModal.tsx`

- [ ] **Step 1: Add imports (Sparkles + action)**

Em `src/components/social-media/PostFormModal.tsx`:
- Na linha do import de `lucide-react`, troque `import { Upload, X } from "lucide-react";` por:

```ts
import { Upload, X, Sparkles } from "lucide-react";
```

- Na desestruturação do import de actions, adicione `gerarLegendaIaAction`:

```ts
import {
  createSocialPostAction, updateSocialPostAction, uploadSocialMidiaAction,
  gerarLegendaIaAction,
} from "@/lib/social-media/actions";
```

- [ ] **Step 2: Add state (legenda, hashtags controladas + IA)**

Logo após `const [redes, setRedes] = useState<string[]>(post?.redes ?? ["instagram"]);` adicione:

```ts
  const [legenda, setLegenda] = useState<string>(post?.legenda ?? "");
  const [hashtags, setHashtags] = useState<string>(post?.hashtags ?? "");
  const [briefIa, setBriefIa] = useState<string>("");
  const [gerandoIa, setGerandoIa] = useState(false);
```

- [ ] **Step 3: Add the IA handler**

Logo antes de `function onSubmit(` adicione:

```ts
  async function onGerarIa(modo: "gerar" | "melhorar") {
    setError(null);
    setGerandoIa(true);
    try {
      const r = await gerarLegendaIaAction({
        client_id: clientId,
        brief: modo === "gerar" ? briefIa : null,
        rascunho: modo === "melhorar" ? legenda : null,
        formato,
        redes,
      });
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setLegenda(r.legenda);
      setHashtags(r.hashtags);
    } finally {
      setGerandoIa(false);
    }
  }
```

- [ ] **Step 4: Insert the IA block above the Legenda field**

Substitua o bloco da Legenda (o comentário `{/* Legenda */}` e seu `<div>`) por:

```tsx
          {/* IA: gerar/melhorar legenda */}
          <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Gerar com IA
            </div>
            <Input
              value={briefIa}
              onChange={(e) => setBriefIa(e.target.value)}
              placeholder="Conte a ideia. Ex: promoção de Dia das Mães, 20% off até domingo"
              maxLength={500}
              disabled={gerandoIa}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => onGerarIa("gerar")} disabled={gerandoIa || !briefIa.trim()}>
                {gerandoIa ? "Gerando..." : "✨ Gerar legenda"}
              </Button>
              {legenda.trim() && (
                <Button type="button" size="sm" variant="outline" onClick={() => onGerarIa("melhorar")} disabled={gerandoIa}>
                  {gerandoIa ? "Gerando..." : "Melhorar rascunho"}
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Usa o tom de voz do cliente. Você edita o resultado à vontade.
            </p>
          </div>

          {/* Legenda */}
          <div className="space-y-1.5">
            <Label htmlFor="legenda">Legenda</Label>
            <Textarea
              id="legenda"
              name="legenda"
              rows={5}
              value={legenda}
              onChange={(e) => setLegenda(e.target.value)}
              placeholder="Texto principal do post..."
              maxLength={4000}
            />
          </div>
```

- [ ] **Step 5: Make the Hashtags textarea controlled**

Troque o `<Textarea>` de `id="hashtags"` (que usa `defaultValue={post?.hashtags ?? ""}`) por:

```tsx
              <Textarea
                id="hashtags"
                name="hashtags"
                rows={2}
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#blackfriday #marketing"
                maxLength={2000}
              />
```

- [ ] **Step 6: Disable the IA buttons while saving too**

(opcional de segurança) Nada a fazer além do já feito — `gerandoIa` controla os botões da IA; `pending` controla salvar. Sem conflito.

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "PostFormModal" || echo "tsc OK"`
Run: `npx eslint src/components/social-media/PostFormModal.tsx src/lib/social-media/actions.ts src/lib/social-media/caption-generator.ts`
Expected: `tsc OK` e lint sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/components/social-media/PostFormModal.tsx
git commit -m "feat(social-media): botão Gerar com IA no compositor (legenda + hashtags)"
```

---

## Task 4: Verificação final + PR

- [ ] **Step 1: Rodar a suíte de testes do gerador**

Run: `npx vitest run tests/unit/social-caption-generator.test.ts`
Expected: 4 passed.

- [ ] **Step 2: Lint geral dos arquivos tocados**

Run: `npx eslint src/lib/social-media/caption-generator.ts src/lib/social-media/actions.ts src/components/social-media/PostFormModal.tsx`
Expected: sem erros.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/social-ia-legendas
gh pr create --title "feat(social-media): IA pra gerar legenda e hashtags" --body "Botão opt-in '✨ Gerar com IA' no compositor de post. Gera do zero (a partir de uma ideia) ou melhora rascunho, na voz da marca do cliente (style guide). 1 resultado, modelo Haiku, sem migration. Spec em docs/superpowers/specs/2026-06-28-ia-legendas-hashtags-design.md."
```

- [ ] **Step 4: Esperar CI verde e mergear**

```bash
gh pr checks <NUM> --watch
gh pr merge <NUM> --squash --delete-branch
```

---

## Self-Review (preenchido)

- **Spec coverage:** dois modos (gerar/melhorar) → Task 3 handler; 1 resultado → gerador; tom automático → Task 2 busca style guide; 1 legenda p/ todas redes → gerador recebe `redes` mas gera uma; erros/sem-key → gerador retorna `{error}`; sem migration → confirmado. ✓
- **Placeholders:** nenhum — todo código presente. ✓
- **Type consistency:** `CaptionContext`/`CaptionResult` definidos na Task 1 e usados nas Tasks 2/3; `gerarLegendaIaAction` retorna `CaptionResult`; component checa `"error" in r`. ✓
