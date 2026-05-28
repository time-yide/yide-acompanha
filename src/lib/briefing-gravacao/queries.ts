// src/lib/briefing-gravacao/queries.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRoteiroSignedUrl } from "./storage";
import type { BriefingPrintData } from "./tipos";

export async function getBriefingPrintData(
  eventoId: string,
  geradoPorNome: string,
): Promise<BriefingPrintData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select(
      `id, inicio, fim, localizacao_endereco, localizacao_maps_url, observacoes_gravacao,
       link_roteiro, roteiro_tipo, roteiro_pdf_path,
       clients ( nome )`,
    )
    .eq("id", eventoId)
    .single();

  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  let roteiroUrl: string | null = null;
  if (d.roteiro_tipo === "link") roteiroUrl = d.link_roteiro;
  else if (d.roteiro_tipo === "pdf" && d.roteiro_pdf_path) {
    const r = await getRoteiroSignedUrl(d.roteiro_pdf_path);
    if ("url" in r) roteiroUrl = r.url;
  }

  return {
    eventoId: d.id,
    clienteNome: d.clients?.nome ?? null,
    inicio: d.inicio,
    fim: d.fim,
    endereco: d.localizacao_endereco,
    mapsUrl: d.localizacao_maps_url,
    observacoes: d.observacoes_gravacao,
    roteiroUrl,
    roteiroTipo: d.roteiro_tipo,
    geradoPorNome,
  };
}
