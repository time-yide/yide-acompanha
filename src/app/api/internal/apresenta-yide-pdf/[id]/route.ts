import { createElement } from "react";
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
  const bodyMarkup = renderToStaticMarkup(createElement(PdfRenderableDeck, { slides }));

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
