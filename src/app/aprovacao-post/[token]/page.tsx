import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ApprovalClient } from "./ApprovalClient";

interface PostData {
  id: string;
  titulo: string | null;
  legenda: string | null;
  hashtags: string | null;
  primeiro_comentario: string | null;
  formato: string;
  redes: string[];
  status: string;
  midias: string[];
  ajuste_observacoes: string | null;
  agendar_para: string | null;
  client_nome: string;
  organization_nome: string | null;
}

async function fetchPost(token: string): Promise<PostData | null> {
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(token)) {
    return null;
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("social_media_posts")
    .select(
      "id, titulo, legenda, hashtags, primeiro_comentario, formato, redes, status, midias, ajuste_observacoes, agendar_para, archived_at, client:clients!social_media_posts_client_id_fkey(nome, organization:organizations!clients_organization_id_fkey(nome))",
    )
    .eq("aprovacao_token", token)
    .maybeSingle();

  if (!data) return null;
  const row = data as {
    id: string;
    titulo: string | null;
    legenda: string | null;
    hashtags: string | null;
    primeiro_comentario: string | null;
    formato: string;
    redes: unknown;
    status: string;
    midias: unknown;
    ajuste_observacoes: string | null;
    agendar_para: string | null;
    archived_at: string | null;
    client?: {
      nome: string;
      organization?: { nome: string } | null;
    } | null;
  };

  if (row.archived_at) return null;

  return {
    id: row.id,
    titulo: row.titulo,
    legenda: row.legenda,
    hashtags: row.hashtags,
    primeiro_comentario: row.primeiro_comentario,
    formato: row.formato,
    redes: Array.isArray(row.redes) ? (row.redes as string[]) : [],
    status: row.status,
    midias: Array.isArray(row.midias) ? (row.midias as string[]) : [],
    ajuste_observacoes: row.ajuste_observacoes,
    agendar_para: row.agendar_para,
    client_nome: row.client?.nome ?? "Cliente",
    organization_nome: row.client?.organization?.nome ?? null,
  };
}

export default async function PublicSocialApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const post = await fetchPost(token);
  if (!post) notFound();

  return <ApprovalClient token={token} post={post} />;
}
