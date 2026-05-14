import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyPdfToken } from "@/lib/apresenta-yide/pdf-token";
import { getServerEnv } from "@/lib/env";
import { PdfRenderableDeck } from "@/components/apresenta-yide/PdfRenderableDeck";
import type { Slide } from "@/lib/apresenta-yide/tipos";

export const dynamic = "force-dynamic";

/**
 * Rota PÚBLICA (sem cookies) protegida por HMAC token de 5min. Puppeteer
 * abre essa URL pra capturar PDF. Acessível em /apresenta-yide-pdf/[id]?token=...
 *
 * Convertido de API route → page route porque Next.js 16/Turbopack não
 * deixa importar react-dom/server em API routes. Pages renderizam React
 * nativamente sem precisar de renderToStaticMarkup.
 */
export default async function ApresentacaoPdfRenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token = "" } = await searchParams;

  const env = getServerEnv();
  if (!env.APRESENTACAO_PDF_SECRET) notFound();
  if (!verifyPdfToken(id, token, env.APRESENTACAO_PDF_SECRET)) notFound();

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: row } = await sb
    .from("apresentacoes_yide")
    .select("titulo, slides, status")
    .eq("id", id)
    .single();
  if (!row || row.status !== "pronta") notFound();

  const slides = (row.slides ?? []) as Slide[];

  return (
    <>
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        html, body { margin: 0; padding: 0; background: #0a0a0a; }
        .pdf-page { page-break-after: always; break-after: page; }
        .pdf-page:last-child { page-break-after: auto; break-after: auto; }
      `}</style>
      <PdfRenderableDeck slides={slides} />
    </>
  );
}
