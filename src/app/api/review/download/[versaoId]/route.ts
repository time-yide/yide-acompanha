import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { mp4CandidateUrls } from "@/lib/bunny/client";
import { destravado } from "@/lib/review/gate";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/review/download/[versaoId]
 *
 * Baixa o MP4 do Bunny e devolve como ARQUIVO (Content-Disposition: attachment),
 * forçando o download em vez de tocar no navegador. O botão "Baixar" do Frame
 * antes fazia window.open na URL do Bunny — que o CDN serve pra tocar inline,
 * então o vídeo abria e o time não conseguia salvar (salvava a página .htm).
 *
 * Faz o mesmo gate de linkDownloadAction (assistiu >= mínimo) e faz stream do
 * corpo do Bunny direto (sem bufferizar em memória).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ versaoId: string }> },
) {
  const user = await requireAuth();
  const { versaoId } = await params;

  // O pull zone do Bunny tem proteção de HOTLINK/REFERRER: só serve os arquivos
  // (incl. o play_XXX.mp4 de download) pra requests com Referer de um domínio
  // permitido. O navegador tocando o vídeo manda esse Referer e passa; mas ESTA
  // rota busca o MP4 do lado do SERVIDOR — sem Referer, o Bunny devolve 403.
  // Reencaminhamos o Referer do próprio app (o host de onde veio o request, que
  // é um domínio permitido, senão o player nem tocaria). Sem isso o download
  // dava "403" mesmo com o MP4 existindo.
  const appReferer = `https://${req.headers.get("host") ?? ""}/`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: a } = await sb
    .from("review_assistido")
    .select("pct_max")
    .eq("user_id", user.id)
    .eq("versao_id", versaoId)
    .maybeSingle();
  if (!destravado((a?.pct_max as number | undefined) ?? 0)) {
    return new Response("Assista o vídeo até o fim pra liberar o download.", { status: 403 });
  }

  const { data: v } = await sb
    .from("review_versao")
    .select("bunny_video_id, review_video_id")
    .eq("id", versaoId)
    .maybeSingle();
  if (!v) return new Response("Versão não encontrada.", { status: 404 });

  const candidatos = await mp4CandidateUrls(v.bunny_video_id as string);
  if (candidatos.length === 0) {
    return new Response("Download indisponível — habilite o 'MP4 Fallback' na biblioteca do Bunny.", { status: 502 });
  }

  const { data: rv } = await sb
    .from("review_video")
    .select("titulo")
    .eq("id", v.review_video_id)
    .maybeSingle();
  const base = String((rv?.titulo as string | undefined) ?? "video")
    .normalize("NFKD").replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "video";
  const nomeArquivo = `${base}.mp4`;

  // Tenta cada resolução até uma responder OK. Manda o Referer do app pra
  // passar pela proteção de hotlink do Bunny (senão 403 mesmo com o MP4 lá).
  let upstream: Response | null = null;
  let ultimoStatus = 0;
  for (const url of candidatos) {
    try {
      const r = await fetch(url, { headers: { Referer: appReferer } });
      if (r.ok && r.body) { upstream = r; break; }
      ultimoStatus = r.status;
    } catch {
      ultimoStatus = 0;
    }
  }
  if (!upstream || !upstream.body) {
    console.error("[review/download] MP4 indisponível", { versaoId, bunny: v.bunny_video_id, ultimoStatus, appReferer, candidatos });
    return new Response(
      `Não consegui baixar o MP4 deste vídeo (status ${ultimoStatus}). Se persistir, confira no Bunny a proteção de referrer da library (deve permitir ${appReferer}) e o 'MP4 Fallback'.`,
      { status: 502 },
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    "Cache-Control": "no-store",
  };
  const len = upstream.headers.get("content-length");
  if (len) headers["Content-Length"] = len;

  return new Response(upstream.body, { headers });
}
