# Apresenta Yide — PR 3 (PDF export via Puppeteer) — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Botão "Baixar PDF" gera PDF premium da apresentação. Stack: Puppeteer + @sparticuz/chromium rodando como função Vercel.

**Architecture:** Server action `gerarPdfApresentacaoAction(id)` lança Puppeteer headless, abre uma rota interna `/api/internal/apresenta-yide-pdf/[id]?token=...` que renderiza todas as slides empilhadas com CSS de print (A4 landscape, page-break entre slides). Puppeteer chama `page.pdf()`, faz upload pro Storage, atualiza `pdf_storage_path` na DB e retorna signed URL. Token HMAC protege a rota interna contra acesso direto.

**Tech Stack:** Next.js 16, `puppeteer-core@^21`, `@sparticuz/chromium@^121`, Supabase Storage, Node.js crypto (HMAC).

**Spec:** [`docs/superpowers/specs/2026-05-14-apresenta-yide-design.md`](../specs/2026-05-14-apresenta-yide-design.md)

---

## Arquivos tocados

| Arquivo | Tipo |
|---|---|
| `package.json` | Modificar (+puppeteer-core, +@sparticuz/chromium) |
| `src/lib/apresenta-yide/pdf-token.ts` | Criar |
| `tests/unit/apresenta-yide-pdf-token.test.ts` | Criar |
| `src/components/apresenta-yide/PdfRenderableDeck.tsx` | Criar |
| `src/app/api/internal/apresenta-yide-pdf/[id]/route.ts` | Criar |
| `src/lib/apresenta-yide/pdf-generator.ts` | Criar |
| `src/lib/apresenta-yide/actions.ts` | Modificar (+gerarPdfApresentacaoAction) |
| `src/components/apresenta-yide/DownloadPdfButton.tsx` | Criar |
| `src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx` | Modificar (+botão) |
| `src/lib/env.ts` | Modificar (+APRESENTACAO_PDF_SECRET opcional) |

---

## Task 1: Instalar dependências

- [ ] **Step 1: Instalar pacotes**

```bash
npm install puppeteer-core@^21 @sparticuz/chromium@^121
```

- [ ] **Step 2: Verificar `package.json`**

Confirmar que `dependencies` contém:
- `"puppeteer-core": "^21.x"`
- `"@sparticuz/chromium": "^121.x"`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore(deps): puppeteer-core + @sparticuz/chromium pra geração de PDF

Necessários pra PR 3 do Apresenta Yide: rodar Chromium headless
serverless no Vercel pra exportar slides em PDF.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Token HMAC pra rota interna (TDD)

**Files:**
- Create: `tests/unit/apresenta-yide-pdf-token.test.ts`
- Create: `src/lib/apresenta-yide/pdf-token.ts`

Pra Puppeteer chamar a rota `/api/internal/apresenta-yide-pdf/[id]`, ela precisa ser pública (sem cookies de auth). Mas não pode ser totalmente aberta — qualquer um conseguiria baixar o HTML das apresentações. Solução: HMAC token de curta duração.

- [ ] **Step 1: Adicionar env var opcional**

Em `src/lib/env.ts`, no `serverSchema`, adicionar (mantendo as outras vars):

```typescript
  APRESENTACAO_PDF_SECRET: z.string().min(16).optional(),
```

(Se não setado, geração de PDF falha com erro amigável. Pra testar localmente, gerar com `openssl rand -hex 32` e adicionar no `.env.local`.)

- [ ] **Step 2: Escrever testes**

Crie `tests/unit/apresenta-yide-pdf-token.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { signPdfToken, verifyPdfToken } from "@/lib/apresenta-yide/pdf-token";

const SECRET = "test-secret-1234567890";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-14T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signPdfToken / verifyPdfToken", () => {
  it("token gerado é verificável com mesmo segredo", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    expect(verifyPdfToken("apresentacao-123", token, SECRET)).toBe(true);
  });

  it("rejeita token com segredo diferente", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    expect(verifyPdfToken("apresentacao-123", token, "outro-segredo")).toBe(false);
  });

  it("rejeita token usado com id diferente", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    expect(verifyPdfToken("outra-id", token, SECRET)).toBe(false);
  });

  it("rejeita token expirado (>5 min)", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    vi.advanceTimersByTime(6 * 60 * 1000); // 6 min
    expect(verifyPdfToken("apresentacao-123", token, SECRET)).toBe(false);
  });

  it("aceita token dentro da janela de 5 min", () => {
    const token = signPdfToken("apresentacao-123", SECRET);
    vi.advanceTimersByTime(4 * 60 * 1000); // 4 min
    expect(verifyPdfToken("apresentacao-123", token, SECRET)).toBe(true);
  });

  it("rejeita token malformado", () => {
    expect(verifyPdfToken("apresentacao-123", "lixo", SECRET)).toBe(false);
    expect(verifyPdfToken("apresentacao-123", "", SECRET)).toBe(false);
    expect(verifyPdfToken("apresentacao-123", "a.b", SECRET)).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
npm test -- tests/unit/apresenta-yide-pdf-token.test.ts
```

Esperado: `Cannot find module`.

- [ ] **Step 4: Criar `src/lib/apresenta-yide/pdf-token.ts`**

```typescript
import { createHmac, timingSafeEqual } from "crypto";

const TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Assina token HMAC com payload "timestamp.hmac" pra autorizar Puppeteer
 * a buscar a rota interna /api/internal/apresenta-yide-pdf/[id].
 * O token amarra (id, timestamp, secret) — não dá pra reusar com outro id
 * nem fora da janela de 5 min.
 */
export function signPdfToken(apresentacaoId: string, secret: string): string {
  const ts = Date.now().toString();
  const payload = `${apresentacaoId}.${ts}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${ts}.${sig}`;
}

export function verifyPdfToken(
  apresentacaoId: string,
  token: string,
  secret: string,
): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [tsStr, sig] = parts;
  const ts = parseInt(tsStr, 10);
  if (!Number.isFinite(ts)) return false;
  // Verifica janela de validade
  const age = Date.now() - ts;
  if (age < 0 || age > TTL_MS) return false;

  const expectedSig = createHmac("sha256", secret)
    .update(`${apresentacaoId}.${tsStr}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expectedSig, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 5: Rodar testes — passam**

```bash
npm test -- tests/unit/apresenta-yide-pdf-token.test.ts
```

Esperado: 6 testes passando.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/apresenta-yide-pdf-token.test.ts src/lib/apresenta-yide/pdf-token.ts src/lib/env.ts
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): HMAC tokens pra rota interna do PDF

Tokens com TTL de 5min amarrados ao apresentacao_id. Permitem que
Puppeteer (sem cookies) busque a rota interna que renderiza HTML
da apresentação sem que ela vire um endpoint público de leitura.

Env var APRESENTACAO_PDF_SECRET nova (opcional — sem ela, geração
de PDF falha amigavelmente).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: PdfRenderableDeck (componente que vira PDF)

**Files:**
- Create: `src/components/apresenta-yide/PdfRenderableDeck.tsx`

Componente puro de apresentação stack vertical pra Puppeteer imprimir. Reusa os 6 templates de slide existentes, mas wraps cada um numa página com page-break-after pra cada slide virar uma página separada no PDF.

- [ ] **Step 1: Criar componente**

```typescript
import { SlidePreview } from "./SlidePreview";
import type { Slide } from "@/lib/apresenta-yide/tipos";

interface Props {
  slides: Slide[];
}

/**
 * Renderiza todos os slides empilhados verticalmente, cada um numa
 * "página" com page-break-after pra Puppeteer gerar 1 slide = 1 página
 * de PDF. Cada wrapper tem 100% de largura e altura proporcional 16:9 —
 * page CSS abaixo (no api route) força A4 landscape.
 */
export function PdfRenderableDeck({ slides }: Props) {
  return (
    <>
      {slides.map((slide, i) => (
        <div
          key={i}
          className="pdf-page"
          style={{
            width: "100%",
            // O wrapper toma a largura inteira; o slide interno (com
            // aspect-[16/9]) ajusta a altura proporcional.
            pageBreakAfter: i === slides.length - 1 ? "auto" : "always",
            breakAfter: i === slides.length - 1 ? "auto" : "page",
          }}
        >
          <SlidePreview slide={slide} />
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/apresenta-yide/PdfRenderableDeck.tsx
git commit -m "feat(apresenta-yide): PdfRenderableDeck — slides empilhados pra PDF

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Rota interna que renderiza HTML pro Puppeteer

**Files:**
- Create: `src/app/api/internal/apresenta-yide-pdf/[id]/route.ts`

- [ ] **Step 1: Criar route handler**

Crie `src/app/api/internal/apresenta-yide-pdf/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { renderToStaticMarkup } from "react-dom/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyPdfToken } from "@/lib/apresenta-yide/pdf-token";
import { getServerEnv } from "@/lib/env";
import { PdfRenderableDeck } from "@/components/apresenta-yide/PdfRenderableDeck";
import type { Slide } from "@/lib/apresenta-yide/tipos";

export const dynamic = "force-dynamic";

/**
 * GET /api/internal/apresenta-yide-pdf/[id]?token=...
 *
 * Rota PÚBLICA (sem cookies) protegida por HMAC token. Renderiza HTML
 * estático da apresentação pra Puppeteer fazer print → PDF.
 *
 * Não pode ser usada como bypass de auth pra ler apresentações:
 * - Token tem TTL de 5min
 * - Token amarra ao id específico
 * - Token só é gerado server-side pela server action de PDF (que checa auth)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";

  const env = getServerEnv();
  if (!env.APRESENTACAO_PDF_SECRET) {
    return NextResponse.json({ error: "PDF não configurado" }, { status: 503 });
  }

  if (!verifyPdfToken(id, token, env.APRESENTACAO_PDF_SECRET)) {
    return NextResponse.json({ error: "Token inválido ou expirado" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("titulo, slides, status")
    .eq("id", id)
    .single();
  if (!row) {
    return NextResponse.json({ error: "Apresentação não encontrada" }, { status: 404 });
  }
  if (row.status !== "pronta") {
    return NextResponse.json({ error: "Apresentação ainda não está pronta" }, { status: 409 });
  }

  const slides = (row.slides ?? []) as Slide[];
  const bodyMarkup = renderToStaticMarkup(<PdfRenderableDeck slides={slides} />);

  // HTML mínimo com CSS de print + Tailwind via CDN.
  // CDN evita ter que processar Tailwind aqui — tradeoff: 200ms a mais
  // pra Puppeteer baixar, mas garante styles idênticos ao preview.
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(row.titulo as string)}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #0a0a0a;
      color: white;
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    .pdf-page {
      page-break-after: always;
      break-after: page;
    }
    .pdf-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    /* Tailwind tokens pra primary teal (#3DC4BC) — duplicado aqui porque
       o Tailwind CDN não conhece o tema custom do projeto. */
    :root {
      --primary-hsl: 176 53% 51%;
    }
    .text-primary { color: #3DC4BC; }
    .bg-primary { background-color: #3DC4BC; }
    .border-primary { border-color: #3DC4BC; }
  </style>
</head>
<body>
${bodyMarkup}
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Esperado: 0 erros novos.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/api/internal/apresenta-yide-pdf/[id]/route.ts'
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): rota interna que renderiza HTML pra PDF

GET /api/internal/apresenta-yide-pdf/[id]?token=... — protegida por
HMAC token de 5min. Retorna HTML estático com Tailwind CDN + CSS
de print (A4 landscape) + slides empilhados em PdfRenderableDeck.
Puppeteer chama essa URL e converte pra PDF.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: pdf-generator + server action

**Files:**
- Create: `src/lib/apresenta-yide/pdf-generator.ts`
- Modify: `src/lib/apresenta-yide/actions.ts`

- [ ] **Step 1: Criar `pdf-generator.ts`**

```typescript
// SERVER ONLY: do not import from client components

import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

interface GenerateOptions {
  htmlUrl: string;
}

/**
 * Lança Chromium headless, abre a URL passada, gera PDF A4 landscape.
 * Retorna o PDF como Buffer.
 *
 * Importante: em Vercel, `chromium.executablePath()` retorna o binário
 * empacotado pelo @sparticuz/chromium. Em dev local, retorna o do
 * Puppeteer instalado (mais lento de baixar, mas só uma vez).
 */
export async function generatePdfFromUrl(opts: GenerateOptions): Promise<Buffer> {
  const isVercel = !!process.env.VERCEL;

  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    executablePath: isVercel
      ? await chromium.executablePath()
      : process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath()),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.goto(opts.htmlUrl, {
      waitUntil: "networkidle0",
      timeout: 30_000,
    });
    // Pequeno settle pra Tailwind CDN aplicar todos os estilos.
    await new Promise((r) => setTimeout(r, 500));

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
```

- [ ] **Step 2: Adicionar `gerarPdfApresentacaoAction` no actions.ts**

No final de `src/lib/apresenta-yide/actions.ts`, adicione:

```typescript
import { signPdfToken } from "./pdf-token";
import { generatePdfFromUrl } from "./pdf-generator";
import { getServerEnv } from "@/lib/env";
import { env as publicEnv } from "@/lib/env";

type GerarPdfResult = { error: string } | { signedUrl: string };

/**
 * Gera (ou regenera) o PDF de uma apresentação pronta. Roda Puppeteer
 * server-side, faz upload pro Storage e retorna signed URL pra download.
 */
export async function gerarPdfApresentacaoAction(
  apresentacaoId: string,
): Promise<GerarPdfResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Sem permissão" };
  }

  const serverEnv = getServerEnv();
  if (!serverEnv.APRESENTACAO_PDF_SECRET) {
    return { error: "PDF não configurado no servidor (APRESENTACAO_PDF_SECRET)" };
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("id, status, criado_por, pdf_storage_path")
    .eq("id", apresentacaoId)
    .single();
  if (!row) return { error: "Apresentação não encontrada" };

  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (row.criado_por !== actor.id && !isPriv) {
    return { error: "Sem permissão" };
  }
  if (row.status !== "pronta") {
    return { error: "Apresentação ainda não está pronta" };
  }

  // 1. Se já tem PDF salvo, retorna signed URL direto.
  if (row.pdf_storage_path) {
    const { data: signed } = await admin.storage
      .from("apresentacoes-yide")
      .createSignedUrl(row.pdf_storage_path, 60 * 60);
    if (signed) return { signedUrl: signed.signedUrl };
    // Se signed falhar, segue pra regerar.
  }

  // 2. Gera token e monta URL da rota interna.
  const token = signPdfToken(apresentacaoId, serverEnv.APRESENTACAO_PDF_SECRET);
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const htmlUrl = `${baseUrl}/api/internal/apresenta-yide-pdf/${apresentacaoId}?token=${token}`;

  // 3. Roda Puppeteer.
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generatePdfFromUrl({ htmlUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Falha desconhecida";
    return { error: `Erro ao gerar PDF: ${msg}` };
  }

  // 4. Upload pro Storage.
  const storagePath = `${apresentacaoId}.pdf`;
  const { error: uploadErr } = await admin.storage
    .from("apresentacoes-yide")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) {
    return { error: `Falha no upload: ${uploadErr.message}` };
  }

  // 5. Atualiza DB.
  await sb
    .from("apresentacoes_yide")
    .update({ pdf_storage_path: storagePath })
    .eq("id", apresentacaoId);

  // 6. Retorna signed URL.
  const { data: signed } = await admin.storage
    .from("apresentacoes-yide")
    .createSignedUrl(storagePath, 60 * 60);
  if (!signed) return { error: "Falha ao gerar URL de download" };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: apresentacaoId,
    acao: "update",
    dados_depois: { pdf_storage_path: storagePath },
    ator_id: actor.id,
    justificativa: "PDF gerado",
  });

  revalidatePath(`/social-media/apresenta-yide/${apresentacaoId}`);
  return { signedUrl: signed.signedUrl };
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Esperado: 0 erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/lib/apresenta-yide/pdf-generator.ts src/lib/apresenta-yide/actions.ts
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): gerarPdfApresentacaoAction via Puppeteer

generatePdfFromUrl lança Chromium serverless (sparticuz no Vercel,
local no dev), abre URL da rota interna com token HMAC, captura PDF
A4 landscape.

Server action faz:
1. Auth check + status='pronta'
2. Reusa PDF cacheado se já tem pdf_storage_path
3. Gera token, monta URL interna
4. Lança Puppeteer
5. Upload pro bucket apresentacoes-yide
6. Atualiza DB + retorna signed URL de 1h

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Botão Download + integração na /[id] page

**Files:**
- Create: `src/components/apresenta-yide/DownloadPdfButton.tsx`
- Modify: `src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx`

- [ ] **Step 1: Criar `DownloadPdfButton.tsx`**

```typescript
"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { gerarPdfApresentacaoAction } from "@/lib/apresenta-yide/actions";

interface Props {
  apresentacaoId: string;
  /** Se já tem PDF gerado, mostra "Baixar PDF". Senão, "Gerar PDF". */
  hasExistingPdf: boolean;
}

export function DownloadPdfButton({ apresentacaoId, hasExistingPdf }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const r = await gerarPdfApresentacaoAction(apresentacaoId);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      // Abre em nova aba pra download — signed URL é válido por 1h.
      window.open(r.signedUrl, "_blank", "noopener,noreferrer");
      toast.success("PDF aberto em nova aba");
    });
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Gerando...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          {hasExistingPdf ? "Baixar PDF" : "Gerar PDF"}
        </>
      )}
    </Button>
  );
}
```

- [ ] **Step 2: Adicionar botão na page**

Em `src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx`:

1. Adicione import:

```typescript
import { DownloadPdfButton } from "@/components/apresenta-yide/DownloadPdfButton";
```

2. Encontre o bloco da "nota" que diz `<strong className="text-foreground">Exportar PDF:</strong>` (vinda de PR 2). Substitua o bloco INTEIRO por:

```tsx
{apresentacao.status === "pronta" && (
  <div className="rounded-xl border bg-card p-5">
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Exportar
    </h3>
    <p className="mt-2 text-sm text-foreground/90">
      Gera o PDF da apresentação no padrão visual da Yide, pronto pra mandar pro cliente.
    </p>
    <div className="mt-3">
      <DownloadPdfButton
        apresentacaoId={apresentacao.id}
        hasExistingPdf={!!apresentacao.pdf_storage_path}
      />
    </div>
  </div>
)}
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Esperado: 0 erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/components/apresenta-yide/DownloadPdfButton.tsx 'src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx'
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): botão Download PDF na /[id] page

Renderiza botão "Gerar PDF" / "Baixar PDF" (texto depende se já tem
PDF gerado) na lateral esquerda da página de detalhe quando status
é 'pronta'. Click → dispara gerarPdfApresentacaoAction, abre URL
em nova aba.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Vercel function config + push + PR

**Files:**
- Create: `src/app/api/internal/apresenta-yide-pdf/[id]/route.ts` já tem config no top
- Pra geração de PDF, a server action precisa rodar como Node (não Edge) e ter maxDuration alto. Server actions em Next.js 16 herdam config da page que os chama, então não conseguimos setar maxDuration direto na action.
- Solução: criar uma rota dedicada `/api/apresenta-yide/[id]/pdf` que dispara a action e tem maxDuration=60. OU configurar via `vercel.json`.

Pra simplificar v1, vou usar `vercel.json` se necessário. Se Vercel der timeout, fazemos follow-up.

- [ ] **Step 1: Push branch**

```bash
git push -u origin claude/apresenta-yide-pr3-pdf
```

- [ ] **Step 2: Abrir PR via curl**

```bash
curl -s --resolve api.github.com:443:140.82.112.6 \
  -H "Authorization: Bearer $(gh auth token)" \
  -H "Accept: application/vnd.github+json" \
  -X POST https://api.github.com/repos/time-yide/yide-acompanha/pulls \
  -d '{"title":"feat(apresenta-yide): PR 3 — exportar PDF via Puppeteer + @sparticuz/chromium","head":"claude/apresenta-yide-pr3-pdf","base":"main","body":"## Summary\nFecha o ciclo do Apresenta Yide: botão \"Gerar PDF\" exporta o deck no formato A4 landscape, com identidade visual idêntica ao preview.\n\n### Stack\n- `puppeteer-core` + `@sparticuz/chromium` rodam Chromium headless serverless no Vercel\n- Rota interna `/api/internal/apresenta-yide-pdf/[id]` renderiza HTML estático do deck (Tailwind CDN + CSS de print + page-break por slide)\n- Server action `gerarPdfApresentacaoAction` orquestra: token HMAC → Puppeteer → upload Storage → signed URL\n- Botão `DownloadPdfButton` na `/[id]` page (só aparece quando status=`pronta`)\n\n### Segurança\n- Rota interna é pública mas exige HMAC token (TTL 5min, amarrado ao id)\n- Token só é gerado server-side pela action de PDF (que já checa auth)\n- PDF salvo em bucket privado, baixado via signed URL de 1h\n\n### Deploy\n⚠️ Adicionar env var no Vercel:\n- `APRESENTACAO_PDF_SECRET` — gerar com `openssl rand -hex 32`\n\nSem essa var, o botão mostra erro amigável.\n\n### Tests\n- 6 unit cobrem HMAC token (sign/verify, expiração, segredo errado, id errado, malformado)\n\n### Riscos conhecidos\n- Function size limit do Vercel: @sparticuz/chromium é ~57MB, fica dentro do limite de 250MB do Pro\n- Cold start: primeira chamada pode levar 8-15s, subsequentes ~3-5s\n- Se Vercel cortar no meio (default maxDuration=10s pra rotas), pode precisar configurar via `vercel.json` em follow-up\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)"}'
```

- [ ] **Step 3: Reportar URL do PR**

---

## Self-review

- [x] **Spec coverage v1 PR 3:**
  - Puppeteer + @sparticuz/chromium ✓ Task 1
  - HMAC token ✓ Task 2
  - Rota interna pra HTML ✓ Task 4
  - Server action gerarPdf ✓ Task 5
  - Botão Download ✓ Task 6
  - Reusa PDF cacheado ✓ Task 5 (se já tem pdf_storage_path, retorna direto)
- [x] **Sem placeholders.**
- [x] **Type consistency:** `Slide`, `gerarPdfApresentacaoAction` returns `{ error }` ou `{ signedUrl }` consistente entre action e botão.
- [x] **Commits frequentes:** 6 commits.
