// src/app/relatorio-trafego-pdf/[id]/page.tsx
//
// Rota PÚBLICA (sem cookies) protegida por HMAC token de 5min. Puppeteer
// abre essa URL pra capturar PDF. Acessível em /relatorio-trafego-pdf/[id]?token=...
//
// Renderiza o dashboard Reportei (RelatorioReportei) em React cru — todos os
// estilos são inline/SVG, sem depender do bundle Tailwind.
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { verifyPdfToken } from "@/lib/apresenta-yide/pdf-token";
import { getServerEnv } from "@/lib/env";
import { getRelatorioParaPdf } from "@/lib/trafego/relatorios/queries";
import { RelatorioReportei, temDadosReportei } from "@/components/trafego/relatorios/RelatorioReportei";
import { dadosEfetivos } from "@/lib/trafego/relatorios/tipos";

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
  if (!rel) notFound();

  const dados = dadosEfetivos(rel);
  if (!temDadosReportei(dados)) notFound();

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
        @page { size: A4 portrait; margin: 12mm; }
        html, body { margin: 0; padding: 0; background: #ffffff; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
      <RelatorioReportei
        dados={dados}
        clienteNome={clienteNome}
        periodoInicio={rel.periodo_inicio}
        periodoFim={rel.periodo_fim}
      />
    </>
  );
}
