import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ApprovalClient } from "./ApprovalClient";

interface ArteData {
  id: string;
  titulo: string;
  descricao: string | null;
  formato: string;
  status: string;
  midias: string[];
  copy: string | null;
  hashtags: string | null;
  ajuste_observacoes: string | null;
  client_nome: string;
  organization_nome: string | null;
}

async function fetchArte(token: string): Promise<ArteData | null> {
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(token)) {
    return null;
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("design_artes")
    .select(
      "id, titulo, descricao, formato, status, midias, copy, hashtags, ajuste_observacoes, archived_at, client:clients!design_artes_client_id_fkey(nome, organization:organizations!clients_organization_id_fkey(nome))",
    )
    .eq("aprovacao_token", token)
    .maybeSingle();

  if (!data) return null;
  const row = data as {
    id: string;
    titulo: string;
    descricao: string | null;
    formato: string;
    status: string;
    midias: unknown;
    copy: string | null;
    hashtags: string | null;
    ajuste_observacoes: string | null;
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
    descricao: row.descricao,
    formato: row.formato,
    status: row.status,
    midias: Array.isArray(row.midias) ? (row.midias as string[]) : [],
    copy: row.copy,
    hashtags: row.hashtags,
    ajuste_observacoes: row.ajuste_observacoes,
    client_nome: row.client?.nome ?? "Cliente",
    organization_nome: row.client?.organization?.nome ?? null,
  };
}

export default async function PublicApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const arte = await fetchArte(token);
  if (!arte) notFound();

  return <ApprovalClient token={token} arte={arte} />;
}
