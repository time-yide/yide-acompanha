# Apresenta Yide — PR 2 (Claude streaming) — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir o mock data do PR 1 por streaming real do Claude. Quando o usuário cria a apresentação, Claude gera os slides um a um e o preview na lateral renderiza ao vivo (sensação Gamma).

**Architecture:** A action de criar agora salva linha com `status='gerando'` e `slides=[]`, redireciona pra `/[id]`. Página detecta status `gerando` → renderiza `StreamingApresentacao` (client) que faz POST pra `/api/apresenta-yide/[id]/gerar`. Endpoint chama Claude com streaming, parseia line-delimited JSON dos slides, persiste cada slide na DB, envia eventos NDJSON pro client. Cliente atualiza state de slides à medida que recebe eventos, renderizando preview em real-time.

**Tech Stack:** Next.js 16 (route handler streaming), `@anthropic-ai/sdk` (já instalado), `claude-sonnet-4-6` model.

**Spec:** [`docs/superpowers/specs/2026-05-14-apresenta-yide-design.md`](../specs/2026-05-14-apresenta-yide-design.md)

---

## Arquivos tocados

| Arquivo | Tipo |
|---|---|
| `src/lib/apresenta-yide/prompt.ts` | Criar |
| `src/lib/apresenta-yide/stream-parser.ts` | Criar |
| `tests/unit/apresenta-yide-prompt.test.ts` | Criar |
| `tests/unit/apresenta-yide-stream-parser.test.ts` | Criar |
| `src/app/api/apresenta-yide/[id]/gerar/route.ts` | Criar |
| `src/lib/apresenta-yide/actions.ts` | Modificar (criar sem mock, status='gerando') |
| `src/lib/apresenta-yide/mock-data.ts` | Deletar (não usado mais) |
| `src/components/apresenta-yide/StreamingApresentacao.tsx` | Criar |
| `src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx` | Modificar (branch por status) |
| `src/components/apresenta-yide/PromptForm.tsx` | Modificar (label/copy) |

---

## Task 1: Prompt builder (TDD)

**Files:**
- Create: `tests/unit/apresenta-yide-prompt.test.ts`
- Create: `src/lib/apresenta-yide/prompt.ts`

- [ ] **Step 1: Escrever testes**

Crie `tests/unit/apresenta-yide-prompt.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildApresentacaoPrompt, APRESENTACAO_SYSTEM } from "@/lib/apresenta-yide/prompt";

describe("APRESENTACAO_SYSTEM", () => {
  it("menciona os 6 templates por nome", () => {
    expect(APRESENTACAO_SYSTEM).toContain("capa");
    expect(APRESENTACAO_SYSTEM).toContain("conteudo");
    expect(APRESENTACAO_SYSTEM).toContain("duas_colunas");
    expect(APRESENTACAO_SYSTEM).toContain("metrica");
    expect(APRESENTACAO_SYSTEM).toContain("topicos_numerados");
    expect(APRESENTACAO_SYSTEM).toContain("encerramento");
  });

  it("instrui a saída line-delimited JSON", () => {
    expect(APRESENTACAO_SYSTEM).toMatch(/uma linha por slide/i);
  });

  it("força pt-BR", () => {
    expect(APRESENTACAO_SYSTEM).toMatch(/pt-?br/i);
  });
});

describe("buildApresentacaoPrompt", () => {
  it("inclui prompt do usuário, objetivo e número de slides", () => {
    const out = buildApresentacaoPrompt({
      prompt: "Apresentar resultados de tráfego",
      objetivo: "fechar venda com cliente novo",
      numSlides: 10,
    });
    expect(out).toContain("Apresentar resultados de tráfego");
    expect(out).toContain("fechar venda com cliente novo");
    expect(out).toContain("10");
  });

  it("omite objetivo quando é null", () => {
    const out = buildApresentacaoPrompt({
      prompt: "Pitch deck",
      objetivo: null,
      numSlides: 6,
    });
    expect(out).toContain("Pitch deck");
    expect(out).not.toMatch(/Objetivo/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- tests/unit/apresenta-yide-prompt.test.ts
```
Esperado: `Cannot find module`.

- [ ] **Step 3: Criar `src/lib/apresenta-yide/prompt.ts`**

```typescript
/**
 * Prompt do gerador de apresentações Yide. Output STRICT: uma linha JSON
 * por slide, sem markdown wrapping. Cada linha precisa ser parseável
 * independente — sem newlines internas em strings.
 */
export const APRESENTACAO_SYSTEM = `Você é o gerador de apresentações da Yide Digital. Recebe instruções e gera apresentações estruturadas, profissionais, em português do Brasil (pt-BR).

REGRAS DE OUTPUT (CRÍTICAS):
- Você deve produzir UMA LINHA POR SLIDE, e cada linha é UM OBJETO JSON válido.
- NÃO envolva em array — não retorne [ ... ].
- NÃO use markdown. Não envolva em \`\`\`json.
- NÃO escreva NADA além das linhas JSON.
- Cada objeto JSON precisa estar em UMA ÚNICA LINHA (sem quebras de linha internas).
- Se precisar de quebra em string, use \\n literal (string com barra-n).

ESTRUTURA DE CADA SLIDE:
{ "template": "<tipo>", "content": { "template": "<tipo>", ...campos do tipo } }

TEMPLATES disponíveis (6 tipos):

1. capa — APENAS o PRIMEIRO slide
   { "template": "capa", "content": { "template": "capa", "titulo": "...", "subtitulo": "..." (opcional) } }

2. conteudo — texto + bullets opcionais
   { "template": "conteudo", "content": { "template": "conteudo", "titulo": "...", "texto": "..." (opcional), "bullets": ["...", "..."] (opcional, 3-5 itens curtos) } }

3. duas_colunas — comparação lado a lado (ex.: antes/depois)
   { "template": "duas_colunas", "content": { "template": "duas_colunas", "titulo": "...", "coluna_esquerda": { "titulo": "...", "texto": "..." }, "coluna_direita": { "titulo": "...", "texto": "..." } } }

4. metrica — número grande em destaque
   { "template": "metrica", "content": { "template": "metrica", "numero": "+34%", "label": "...", "descricao": "..." (opcional) } }

5. topicos_numerados — 3 a 6 passos/tópicos numerados
   { "template": "topicos_numerados", "content": { "template": "topicos_numerados", "titulo": "...", "topicos": [{ "titulo": "...", "texto": "..." (opcional) }] } }

6. encerramento — APENAS o ÚLTIMO slide
   { "template": "encerramento", "content": { "template": "encerramento", "mensagem": "...", "cta": "..." (opcional) } }

REGRAS DE CONTEÚDO:
- Título de slide: até 60 caracteres
- Parágrafo (texto/descricao): até 250 caracteres
- Bullets: 3 a 5 itens, cada um até 80 caracteres
- Topicos numerados: 3 a 6 itens
- Tom: profissional, direto, sem jargão técnico desnecessário
- NÃO invente números ou dados — use apenas o que o usuário forneceu, ou mantenha genérico
- Sempre em português do Brasil

REGRAS DE ESTRUTURA:
- Primeiro slide DEVE ser "capa"
- Último slide DEVE ser "encerramento"
- Entre eles, varie templates conforme o conteúdo (não use o mesmo template 3+ vezes seguidas)
- Total: exatamente o número de slides pedido pelo usuário`;

interface BuildOptions {
  prompt: string;
  objetivo: string | null;
  numSlides: number;
}

export function buildApresentacaoPrompt(opts: BuildOptions): string {
  const lines: string[] = [];
  lines.push(`Gere uma apresentação com EXATAMENTE ${opts.numSlides} slides.`);
  if (opts.objetivo && opts.objetivo.trim()) {
    lines.push(`Objetivo: ${opts.objetivo.trim()}`);
  }
  lines.push("");
  lines.push("Conteúdo/instruções do usuário:");
  lines.push(opts.prompt.trim());
  lines.push("");
  lines.push("Lembre-se: APENAS as linhas JSON, uma por slide, sem nada mais.");
  return lines.join("\n");
}
```

- [ ] **Step 4: Rodar — passa**

```bash
npm test -- tests/unit/apresenta-yide-prompt.test.ts
```
Esperado: 5 testes passando.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/apresenta-yide-prompt.test.ts src/lib/apresenta-yide/prompt.ts
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): system prompt do Claude pra gerar slides

APRESENTACAO_SYSTEM define output strict line-delimited JSON com 6
templates. buildApresentacaoPrompt monta o user prompt com número de
slides, objetivo (opcional) e conteúdo do usuário.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Stream parser (TDD)

**Files:**
- Create: `tests/unit/apresenta-yide-stream-parser.test.ts`
- Create: `src/lib/apresenta-yide/stream-parser.ts`

- [ ] **Step 1: Escrever testes**

Crie `tests/unit/apresenta-yide-stream-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { LineDelimitedSlideParser } from "@/lib/apresenta-yide/stream-parser";

describe("LineDelimitedSlideParser", () => {
  it("parseia uma linha completa numa única feed", () => {
    const parser = new LineDelimitedSlideParser();
    const slide = JSON.stringify({
      template: "capa",
      content: { template: "capa", titulo: "Yide" },
    });
    const out = parser.feed(slide + "\n");
    expect(out).toHaveLength(1);
    expect(out[0].template).toBe("capa");
  });

  it("buffer entre chunks até receber newline", () => {
    const parser = new LineDelimitedSlideParser();
    const slide = JSON.stringify({
      template: "capa",
      content: { template: "capa", titulo: "Y" },
    });
    expect(parser.feed(slide.slice(0, 10))).toHaveLength(0);
    expect(parser.feed(slide.slice(10))).toHaveLength(0);
    expect(parser.feed("\n")).toHaveLength(1);
  });

  it("parseia múltiplos slides num só chunk", () => {
    const parser = new LineDelimitedSlideParser();
    const s1 = JSON.stringify({ template: "capa", content: { template: "capa", titulo: "A" } });
    const s2 = JSON.stringify({ template: "encerramento", content: { template: "encerramento", mensagem: "Fim" } });
    const out = parser.feed(`${s1}\n${s2}\n`);
    expect(out).toHaveLength(2);
    expect(out[0].template).toBe("capa");
    expect(out[1].template).toBe("encerramento");
  });

  it("descarta linhas vazias", () => {
    const parser = new LineDelimitedSlideParser();
    expect(parser.feed("\n\n\n")).toHaveLength(0);
  });

  it("descarta linhas que não parseiam como JSON válido", () => {
    const parser = new LineDelimitedSlideParser();
    expect(parser.feed("invalid line\n")).toHaveLength(0);
    expect(parser.feed("{ broken\n")).toHaveLength(0);
  });

  it("descarta slides que não passam na validação de shape", () => {
    const parser = new LineDelimitedSlideParser();
    expect(parser.feed('{"template":"capa","content":{}}\n')).toHaveLength(0);
    expect(parser.feed('{"template":"invalido","content":{"template":"invalido"}}\n')).toHaveLength(0);
  });

  it("flush() retorna slide pendente sem newline final", () => {
    const parser = new LineDelimitedSlideParser();
    const slide = JSON.stringify({
      template: "capa",
      content: { template: "capa", titulo: "Y" },
    });
    expect(parser.feed(slide)).toHaveLength(0);
    expect(parser.flush()).toHaveLength(1);
  });

  it("flush() em buffer vazio é no-op", () => {
    const parser = new LineDelimitedSlideParser();
    expect(parser.flush()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- tests/unit/apresenta-yide-stream-parser.test.ts
```
Esperado: `Cannot find module`.

- [ ] **Step 3: Criar `src/lib/apresenta-yide/stream-parser.ts`**

```typescript
import { isValidSlide, type Slide } from "./tipos";

/**
 * Acumula chunks de texto do stream do Claude e emite slides à medida
 * que linhas completas chegam. Cada linha esperada é um JSON object
 * válido representando um Slide. Linhas inválidas (mal formatadas ou
 * que falham validação de shape) são silenciosamente descartadas —
 * tipicamente isso indica chunk parcial ou ruído do modelo.
 */
export class LineDelimitedSlideParser {
  private buffer = "";

  /** Alimenta um chunk de texto. Retorna slides completos extraídos. */
  feed(chunk: string): Slide[] {
    this.buffer += chunk;
    const slides: Slide[] = [];
    let newlineIdx: number;
    while ((newlineIdx = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, newlineIdx).trim();
      this.buffer = this.buffer.slice(newlineIdx + 1);
      if (line.length === 0) continue;
      const parsed = this.tryParse(line);
      if (parsed) slides.push(parsed);
    }
    return slides;
  }

  /** Drena o buffer final (linha sem \n no fim). Use após o stream terminar. */
  flush(): Slide[] {
    const line = this.buffer.trim();
    this.buffer = "";
    if (line.length === 0) return [];
    const parsed = this.tryParse(line);
    return parsed ? [parsed] : [];
  }

  private tryParse(line: string): Slide | null {
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      return null;
    }
    if (!isValidSlide(obj)) return null;
    return obj;
  }
}
```

- [ ] **Step 4: Rodar — passa**

```bash
npm test -- tests/unit/apresenta-yide-stream-parser.test.ts
```
Esperado: 8 testes passando.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/apresenta-yide-stream-parser.test.ts src/lib/apresenta-yide/stream-parser.ts
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): parser stateful de stream line-delimited JSON

LineDelimitedSlideParser acumula chunks até encontrar newlines,
parseia cada linha como JSON, valida shape via isValidSlide e
retorna só slides válidos. flush() drena o buffer final caso
o stream termine sem \\n.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update actions — drop mock, status='gerando'

**Files:**
- Modify: `src/lib/apresenta-yide/actions.ts`
- Delete: `src/lib/apresenta-yide/mock-data.ts`

- [ ] **Step 1: Editar `actions.ts`**

Encontre no `actions.ts`:

```typescript
import { MOCK_APRESENTACAO_SLIDES } from "./mock-data";
```

Remova essa linha.

Encontre o bloco `criarApresentacaoMockAction` e substitua INTEIRO por:

```typescript
/**
 * Cria apresentação com slides vazios + status='gerando'. O streaming
 * via Claude começa quando a /[id] page detecta esse status e dispara
 * POST pra /api/apresenta-yide/[id]/gerar.
 */
export async function criarApresentacaoAction(formData: FormData): Promise<CreateResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Seu papel não tem acesso ao Apresenta Yide" };
  }

  const parsed = createSchema.safeParse({
    titulo: formData.get("titulo"),
    prompt: formData.get("prompt"),
    objetivo: formData.get("objetivo") || null,
    num_slides_alvo: formData.get("num_slides_alvo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: prof } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!prof?.organization_id) return { error: "Organização não encontrada" };

  const { data: inserted, error } = await sb
    .from("apresentacoes_yide")
    .insert({
      titulo: parsed.data.titulo,
      prompt: parsed.data.prompt,
      objetivo: parsed.data.objetivo,
      num_slides_alvo: parsed.data.num_slides_alvo,
      slides: [],
      status: "gerando",
      criado_por: actor.id,
      organization_id: prof.organization_id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: error?.message ?? "Falha ao criar" };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: inserted.id,
    acao: "create",
    dados_depois: { titulo: parsed.data.titulo, prompt_length: parsed.data.prompt.length },
    ator_id: actor.id,
  });

  revalidatePath("/social-media/apresenta-yide");
  return { redirect: `/social-media/apresenta-yide/${inserted.id}` };
}
```

- [ ] **Step 2: Atualizar referência no `PromptForm.tsx`**

No `src/components/apresenta-yide/PromptForm.tsx`, encontre:

```typescript
import { criarApresentacaoMockAction } from "@/lib/apresenta-yide/actions";
```

Substitua por:

```typescript
import { criarApresentacaoAction } from "@/lib/apresenta-yide/actions";
```

E onde está sendo chamado (`criarApresentacaoMockAction(fd)`), troque por `criarApresentacaoAction(fd)`.

Também, no `PromptForm.tsx`, encontre o botão "Gerar apresentação" e o aviso:

```tsx
      <p className="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
        <strong className="text-foreground">PR 1:</strong> v1 cria a apresentação com slides
        de exemplo pra você ver o design. A geração via IA real entra na próxima fase.
      </p>
```

Substitua por:

```tsx
      <p className="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
        Após clicar, a IA vai gerar os slides ao vivo no preview à direita. Costuma levar 15-30 segundos pra um deck de 8 slides.
      </p>
```

- [ ] **Step 3: Deletar `mock-data.ts`**

```bash
rm src/lib/apresenta-yide/mock-data.ts
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```
Esperado: 0 erros novos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/apresenta-yide/actions.ts src/components/apresenta-yide/PromptForm.tsx
git rm src/lib/apresenta-yide/mock-data.ts
git commit -m "$(cat <<'EOF'
refactor(apresenta-yide): drop mock data — criação agora deixa em 'gerando'

criarApresentacaoAction (renomeada de criarApresentacaoMockAction)
salva slides=[] e status='gerando'. O streaming real começa quando
a página /[id] detecta esse status e dispara o endpoint de geração.

PromptForm atualizado com copy correto (sem nota de "v1 mock").

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: API route de streaming

**Files:**
- Create: `src/app/api/apresenta-yide/[id]/gerar/route.ts`

- [ ] **Step 1: Criar route handler**

Crie `src/app/api/apresenta-yide/[id]/gerar/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import { APRESENTACAO_SYSTEM, buildApresentacaoPrompt } from "@/lib/apresenta-yide/prompt";
import { LineDelimitedSlideParser } from "@/lib/apresenta-yide/stream-parser";
import { logAudit } from "@/lib/audit/log";
import type { Slide } from "@/lib/apresenta-yide/tipos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";

/**
 * POST /api/apresenta-yide/[id]/gerar
 *
 * Stream NDJSON. Cada linha é um evento JSON:
 *   { type: "slide", slide: Slide }
 *   { type: "done", status: "pronta" }
 *   { type: "error", message: string }
 *
 * Idempotente em status='pronta' (retorna done direto sem chamar Claude).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const actor = await requireAuth();

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("id, prompt, objetivo, num_slides_alvo, status, criado_por")
    .eq("id", id)
    .single();
  if (!row) {
    return NextResponse.json({ error: "Apresentação não encontrada" }, { status: 404 });
  }

  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (row.criado_por !== actor.id && !isPriv) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Idempotência: se já tá pronta, responde com done direto.
  if (row.status === "pronta") {
    const encoder = new TextEncoder();
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "done", status: "pronta" }) + "\n"));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "application/x-ndjson" } },
    );
  }

  const client = getAnthropicClient();
  if (!client) {
    await sb.from("apresentacoes_yide").update({ status: "erro" }).eq("id", id);
    return NextResponse.json({ error: "Claude não configurado no servidor" }, { status: 503 });
  }

  const userPrompt = buildApresentacaoPrompt({
    prompt: row.prompt,
    objetivo: row.objetivo,
    numSlides: row.num_slides_alvo,
  });

  const encoder = new TextEncoder();
  const parser = new LineDelimitedSlideParser();
  const collected: Slide[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: object) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      async function persistSlides(slides: Slide[], finalStatus: "gerando" | "pronta" | "erro") {
        await sb
          .from("apresentacoes_yide")
          .update({ slides, status: finalStatus })
          .eq("id", id);
      }

      try {
        const claudeStream = client.messages.stream({
          model: MODEL,
          max_tokens: 8192,
          system: APRESENTACAO_SYSTEM,
          messages: [{ role: "user", content: userPrompt }],
        });

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const newSlides = parser.feed(event.delta.text);
            for (const slide of newSlides) {
              collected.push(slide);
              emit({ type: "slide", slide });
              // Persiste no DB a cada slide pra robustez se conexão cair.
              await persistSlides(collected, "gerando");
            }
          }
        }

        const final = parser.flush();
        for (const slide of final) {
          collected.push(slide);
          emit({ type: "slide", slide });
        }

        await persistSlides(collected, "pronta");
        emit({ type: "done", status: "pronta" });

        await logAudit({
          entidade: "apresentacoes_yide",
          entidade_id: id,
          acao: "update",
          dados_depois: { slides_gerados: collected.length, status: "pronta" },
          ator_id: actor.id,
          justificativa: "Streaming Claude concluído",
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha desconhecida";
        await persistSlides(collected, "erro");
        emit({ type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Esperado: 0 erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/apresenta-yide/
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): endpoint POST de streaming /api/.../gerar

Route handler chama Claude Sonnet 4.6 com streaming, parseia
line-delimited JSON dos slides via LineDelimitedSlideParser, persiste
cada slide na DB à medida que chega (robusto contra desconexão), e
envia eventos NDJSON pro cliente:
  - { type: "slide", slide }
  - { type: "done", status: "pronta" }
  - { type: "error", message }

Idempotente: se status já é 'pronta' retorna done direto. maxDuration=60s
pra Vercel não cortar no meio.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: StreamingApresentacao client component

**Files:**
- Create: `src/components/apresenta-yide/StreamingApresentacao.tsx`

- [ ] **Step 1: Criar componente**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertCircle, CheckCircle2 } from "lucide-react";
import { ApresentacaoEditor } from "./ApresentacaoEditor";
import type { Slide } from "@/lib/apresenta-yide/tipos";

interface Props {
  apresentacaoId: string;
  titulo: string;
  /** Slides já persistidos quando o user reabre a página mid-stream. */
  initialSlides: Slide[];
  numSlidesAlvo: number;
}

type StreamState =
  | { kind: "iniciando" }
  | { kind: "gerando"; slides: Slide[] }
  | { kind: "pronta"; slides: Slide[] }
  | { kind: "erro"; mensagem: string; slides: Slide[] };

/**
 * Inicia (ou retoma) o streaming da geração ao montar. Faz POST pro
 * endpoint e consome resposta NDJSON, atualizando state de slides ao
 * vivo. Quando recebe "done", chama router.refresh() pra a página
 * server-rendered substituir esse client component pelo ApresentacaoEditor
 * estático.
 */
export function StreamingApresentacao({
  apresentacaoId,
  titulo,
  initialSlides,
  numSlidesAlvo,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<StreamState>({
    kind: "gerando",
    slides: initialSlides,
  });
  // Evita chamadas duplicadas em StrictMode dev.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function run() {
      try {
        const res = await fetch(`/api/apresenta-yide/${apresentacaoId}/gerar`, {
          method: "POST",
        });
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const json = await res.json();
            if (json.error) msg = json.error;
          } catch { /* body não é JSON */ }
          if (!cancelled) setState((prev) => ({ kind: "erro", mensagem: msg, slides: getSlides(prev) }));
          return;
        }
        if (!res.body) throw new Error("Sem body de resposta");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let slidesAtuais = initialSlides.slice();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let nlIdx: number;
          while ((nlIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, nlIdx).trim();
            buffer = buffer.slice(nlIdx + 1);
            if (!line) continue;

            let event: { type: string; [k: string]: unknown };
            try {
              event = JSON.parse(line);
            } catch {
              continue;
            }

            if (event.type === "slide") {
              slidesAtuais = [...slidesAtuais, event.slide as Slide];
              if (!cancelled) setState({ kind: "gerando", slides: slidesAtuais });
            } else if (event.type === "done") {
              if (!cancelled) setState({ kind: "pronta", slides: slidesAtuais });
              // Refresh server-side pra trocar pro ApresentacaoEditor estático
              router.refresh();
              return;
            } else if (event.type === "error") {
              if (!cancelled) setState({
                kind: "erro",
                mensagem: (event.message as string) ?? "Erro desconhecido",
                slides: slidesAtuais,
              });
              return;
            }
          }
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Falha desconhecida";
        setState((prev) => ({ kind: "erro", mensagem: msg, slides: getSlides(prev) }));
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [apresentacaoId, initialSlides, router]);

  const slides = getSlides(state);

  return (
    <div className="space-y-4">
      <StatusBanner state={state} numSlidesAlvo={numSlidesAlvo} />
      {slides.length > 0 ? (
        <ApresentacaoEditor slides={slides} titulo={titulo} />
      ) : (
        <SkeletonPreview />
      )}
    </div>
  );
}

function getSlides(s: StreamState): Slide[] {
  if (s.kind === "iniciando") return [];
  return s.slides;
}

function StatusBanner({ state, numSlidesAlvo }: { state: StreamState; numSlidesAlvo: number }) {
  if (state.kind === "iniciando" || state.kind === "gerando") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
        <Sparkles className="h-4 w-4 animate-pulse" />
        Gerando slides com IA… ({state.kind === "gerando" ? state.slides.length : 0}/{numSlidesAlvo})
      </div>
    );
  }
  if (state.kind === "pronta") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        Apresentação pronta. {state.slides.length} slides gerados.
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>
        <strong>Erro ao gerar:</strong> {state.mensagem}
      </div>
    </div>
  );
}

function SkeletonPreview() {
  return (
    <div className="aspect-[16/9] w-full animate-pulse rounded-xl border border-dashed bg-muted/20" />
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Esperado: 0 erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/apresenta-yide/StreamingApresentacao.tsx
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): StreamingApresentacao — consome stream NDJSON ao vivo

Client component dispara POST /api/.../gerar ao montar (idempotente
guard pra StrictMode dev), lê resposta NDJSON, decodifica chunks,
parseia eventos { type: 'slide' | 'done' | 'error' } e atualiza state.
Quando recebe 'done', chama router.refresh() pra a página server
substituir esse componente pelo editor estático.

StatusBanner mostra progresso (X/N), erros ou conclusão. Renderiza
ApresentacaoEditor com slides recebidos até agora.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Branch a /[id] page por status

**Files:**
- Modify: `src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx`

- [ ] **Step 1: Adicionar import**

No topo do arquivo, adicione:

```typescript
import { StreamingApresentacao } from "@/components/apresenta-yide/StreamingApresentacao";
```

- [ ] **Step 2: Branch o render**

Encontre o JSX que renderiza `<ApresentacaoEditor slides={apresentacao.slides} titulo={apresentacao.titulo} />`.

Substitua por uma branch baseado em status:

```tsx
{apresentacao.status === "gerando" ? (
  <StreamingApresentacao
    apresentacaoId={apresentacao.id}
    titulo={apresentacao.titulo}
    initialSlides={apresentacao.slides}
    numSlidesAlvo={apresentacao.num_slides_alvo}
  />
) : apresentacao.status === "erro" ? (
  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
    Falha ao gerar essa apresentação. Tente criar uma nova com prompt diferente.
  </div>
) : (
  <ApresentacaoEditor slides={apresentacao.slides} titulo={apresentacao.titulo} />
)}
```

- [ ] **Step 3: Atualizar texto da "nota" lateral**

No mesmo arquivo, encontre o bloco da nota:

```tsx
<div className="rounded-xl border border-dashed bg-muted/10 p-5 text-xs text-muted-foreground">
  <p>
    <strong className="text-foreground">PR 1:</strong> o PDF e a geração via
    IA real entram nas próximas fases. Por enquanto você consegue ver o
    design dos slides com conteúdo de exemplo.
  </p>
</div>
```

Substitua por:

```tsx
<div className="rounded-xl border border-dashed bg-muted/10 p-5 text-xs text-muted-foreground">
  <p>
    <strong className="text-foreground">Exportar PDF:</strong> em breve. Por
    enquanto dá pra ver a apresentação aqui e fazer screenshot pra mandar
    pro cliente.
  </p>
</div>
```

- [ ] **Step 4: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```
Esperado: 0 erros novos.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx'
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): /[id] branch por status — streaming live ou static

Quando status='gerando', renderiza StreamingApresentacao (client) que
conecta ao endpoint e atualiza ao vivo. status='pronta' usa o
ApresentacaoEditor estático normal. status='erro' mostra mensagem.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Push + PR + smoke

- [ ] **Step 1: Push**

```bash
git push -u origin claude/apresenta-yide-pr2-streaming
```

- [ ] **Step 2: Criar PR via curl**

```bash
curl -s --resolve api.github.com:443:140.82.112.6 \
  -H "Authorization: Bearer $(gh auth token)" \
  -H "Accept: application/vnd.github+json" \
  -X POST https://api.github.com/repos/time-yide/yide-acompanha/pulls \
  -d '{"title":"feat(apresenta-yide): PR 2 — Claude streaming gera slides ao vivo","head":"claude/apresenta-yide-pr2-streaming","base":"main","body":"## Summary\nSubstitui mock data do PR 1 por geração real via Claude Sonnet 4.6 com streaming line-delimited JSON.\n\n### Como funciona\n1. User cria apresentação → action salva `status="gerando", slides=[]` e redireciona pra `/[id]`\n2. Página detecta status `gerando` → renderiza `StreamingApresentacao` (client)\n3. Componente dispara `POST /api/apresenta-yide/[id]/gerar`\n4. Endpoint chama Claude com prompt rígido pedindo NDJSON\n5. À medida que cada linha chega, parseia + valida shape + persiste no DB + envia evento `{ type: "slide" }` pro cliente\n6. Cliente atualiza state, renderiza slide novo no preview\n7. Quando termina, status vira `pronta` e `router.refresh()` troca pro editor estático\n\n### Robustez\n- Slides parciais ficam salvos no DB se conexão cair (user reabre e continua de onde parou)\n- Endpoint idempotente em `status=pronta` (retorna `done` direto)\n- Parser descarta linhas inválidas (Claude às vezes mete \"```json\" no início — ignorado)\n- maxDuration=60s pra Vercel não cortar\n- StrictMode dev guard pra evitar dois starts\n\n### Tests\n- 5 unit cobrem o prompt builder\n- 8 unit cobrem LineDelimitedSlideParser\n- Total novo: 13 testes verdes\n\n### Próxima fase\n- PR 3: Exportar PDF via Puppeteer + @sparticuz/chromium\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"}'
```

- [ ] **Step 3: Reportar URL do PR**

---

## Self-review checklist

- [x] **Spec coverage v1 PR 2:**
  - Claude streaming → live preview ✓ Tasks 4-6
  - Status transitions (rascunho → gerando → pronta/erro) ✓ Tasks 3-4
  - Parser tolerante a JSON parcial ✓ Task 2
  - Slides parciais persistem no DB ✓ Task 4 (persistSlides incremental)
  - Mock data removido ✓ Task 3
- [x] **Sem placeholders:** todo código completo.
- [x] **Type consistency:** `Slide`, `LineDelimitedSlideParser`, evento `{type:"slide"|"done"|"error"}` consistente entre server e client.
- [x] **Commits frequentes:** 6 commits.
