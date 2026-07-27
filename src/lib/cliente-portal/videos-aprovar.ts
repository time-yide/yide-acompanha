// Vídeos do Frame (review_video) aguardando aprovação do cliente, pro
// painel logado. Usa service-role — mesmo padrão de src/lib/cliente-portal/queries.ts.

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface VideoParaAprovar {
  reviewId: string;
  titulo: string;
  token: string;
}

/** Reviews do cliente em revisao_cliente, com link de aprovação. */
export async function listarVideosParaAprovar(clienteId: string): Promise<VideoParaAprovar[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("review_video")
    .select("id, titulo, aprovacao_token")
    .eq("cliente_id", clienteId)
    .eq("status", "revisao_cliente")
    .order("updated_at", { ascending: false });
  return ((data ?? []) as { id: string; titulo: string; aprovacao_token: string }[])
    .map((r) => ({ reviewId: r.id, titulo: r.titulo, token: r.aprovacao_token }));
}
