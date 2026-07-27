import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { urlDownloadMp4 } from "@/lib/bunny/client";
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
  _req: Request,
  { params }: { params: Promise<{ versaoId: string }> },
) {
  const user = await requireAuth();
  const { versaoId } = await params;

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

  const url = await urlDownloadMp4(v.bunny_video_id as string);
  if (!url) {
    return new Response("Download indisponível — habilite o 'MP4 fallback' na biblioteca do Bunny.", { status: 502 });
  }

  const { data: rv } = await sb
    .from("review_video")
    .select("titulo")
    .eq("id", v.review_video_id)
    .maybeSingle();
  const base = String((rv?.titulo as string | undefined) ?? "video")
    .normalize("NFKD").replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "video";
  const nomeArquivo = `${base}.mp4`;

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return new Response("Falha ao baixar o vídeo do Bunny.", { status: 502 });
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
