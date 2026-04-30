import { createClient } from "@/lib/supabase/server";

export interface RecadoRow {
  id: string;
  autor_id: string | null;
  autor_role_snapshot: string;
  titulo: string;
  corpo: string;
  permanente: boolean;
  arquivado: boolean;
  notif_scope: string;
  criado_em: string;
  atualizado_em: string;
  autor: { nome: string; avatar_url: string | null } | null;
  reacoes: Array<{ emoji: string; user_id: string }>;
}

export async function listRecados(arquivado: boolean): Promise<RecadoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recados")
    .select(`
      id, autor_id, autor_role_snapshot, titulo, corpo, permanente, arquivado,
      notif_scope, criado_em, atualizado_em,
      autor:profiles!recados_autor_id_fkey(nome, avatar_url),
      reacoes:recado_reacoes(emoji, user_id)
    `)
    .eq("arquivado", arquivado)
    .order("criado_em", { ascending: false });

  if (error) {
    console.error("[recados/queries] listRecados error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as RecadoRow[];
}

export async function countRecadosNaoLidos(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data: vis } = await supabase
    .from("recado_visualizacoes")
    .select("last_seen_at")
    .eq("user_id", userId)
    .maybeSingle();

  const cutoff = vis?.last_seen_at ?? "1970-01-01T00:00:00Z";

  const { count, error } = await supabase
    .from("recados")
    .select("id", { count: "exact", head: true })
    .eq("arquivado", false)
    .eq("permanente", false)
    .neq("autor_id", userId)
    .gt("criado_em", cutoff);

  if (error) {
    console.error("[recados/queries] countRecadosNaoLidos error:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getMyLastSeen(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recado_visualizacoes")
    .select("last_seen_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.last_seen_at ?? null;
}
