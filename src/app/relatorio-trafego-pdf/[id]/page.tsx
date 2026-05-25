// src/app/relatorio-trafego-pdf/[id]/page.tsx
//
// Rota PÚBLICA (sem cookies) protegida por HMAC token de 5min. Puppeteer
// abre essa URL pra capturar PDF. Acessível em /relatorio-trafego-pdf/[id]?token=...
//
// Mesmo padrão do /apresenta-yide-pdf/[id] — page route renderiza React
// direto, com CSS inline pra Puppeteer não depender de bundle externo.
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyPdfToken } from "@/lib/apresenta-yide/pdf-token";
import { getServerEnv } from "@/lib/env";
import { getRelatorioParaPdf } from "@/lib/trafego/relatorios/queries";
import { PdfRenderableDeck } from "@/components/trafego/relatorios/PdfRenderableDeck";

export const dynamic = "force-dynamic";

export default async function RelatorioTrafegoPdfPage({
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

  const rel = await getRelatorioParaPdf(id);
  if (!rel || rel.status !== "pronta") notFound();

  const sb = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sbAny = sb as any;
  const { data: cliente } = await sbAny
    .from("clients")
    .select("nome")
    .eq("id", rel.cliente_id)
    .single();
  const clienteNome = (cliente as { nome: string } | null)?.nome ?? "Cliente";

  return (
    <>
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        html, body { margin: 0; padding: 0; background: #0a0a0a; }
        .pdf-page { page-break-after: always; break-after: page; }
        .pdf-page:last-child { page-break-after: auto; break-after: auto; }

        /* grafico_barras: estilos próprios pra não depender de Tailwind no PDF */
        .slide-grafico {
          width: 100%;
          aspect-ratio: 16 / 9;
          background: linear-gradient(135deg, #0a0a0a 0%, #0f1419 50%, #0a0a0a 100%);
          color: white;
          padding: 60px 80px;
          box-sizing: border-box;
          font-family: Inter, system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .slide-grafico .slide-titulo {
          font-size: 42px;
          font-weight: 700;
          margin: 0 0 8px;
          color: white;
        }
        .slide-grafico .slide-subtitulo {
          font-size: 18px;
          color: #9ca3af;
          margin: 0 0 32px;
        }
        .slide-grafico .grafico-container {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .slide-grafico .grafico-linha {
          display: grid;
          grid-template-columns: 220px 1fr 140px;
          align-items: center;
          gap: 20px;
        }
        .slide-grafico .grafico-label {
          font-size: 16px;
          font-weight: 600;
          color: #e5e7eb;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .slide-grafico .grafico-track {
          background: rgba(255, 255, 255, 0.08);
          height: 32px;
          border-radius: 6px;
          overflow: hidden;
        }
        .slide-grafico .grafico-barra {
          height: 100%;
          border-radius: 6px;
        }
        .slide-grafico .grafico-valor {
          font-size: 18px;
          font-weight: 700;
          text-align: right;
          color: white;
        }
        .slide-grafico .slide-insight {
          font-size: 16px;
          color: #9ca3af;
          margin-top: 32px;
          font-style: italic;
        }
      `}</style>
      <PdfRenderableDeck
        slides={rel.slides}
        meta={{
          cliente_nome: clienteNome,
          periodo_inicio: rel.periodo_inicio,
          periodo_fim: rel.periodo_fim,
        }}
      />
    </>
  );
}
