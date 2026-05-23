// SERVER ONLY: do not import from client components

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ApresentacaoRow, Slide } from "./tipos";

interface ApresentacaoRaw {
  id: string;
  titulo: string;
  prompt: string;
  objetivo: string | null;
  num_slides_alvo: number;
  slides: Slide[];
  status: string;
  pdf_storage_path: string | null;
  criado_por: string;
  created_at: string;
}

/**
 * Lista apresentações visíveis pro user (próprias + adm/sócio vê tudo).
 * RLS já filtra - service-role aqui só facilita join com profiles.
 */
export async function listApresentacoes(
  userId: string,
  isPrivileged: boolean,
): Promise<ApresentacaoRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  let query = sb
    .from("apresentacoes_yide")
    .select("id, titulo, prompt, objetivo, num_slides_alvo, slides, status, pdf_storage_path, criado_por, created_at")
    .order("created_at", { ascending: false });
  if (!isPrivileged) {
    query = query.eq("criado_por", userId);
  }
  const { data } = await query;
  const rows = (data ?? []) as ApresentacaoRaw[];
  if (rows.length === 0) return [];

  // Resolve nomes dos criadores.
  const userIds = Array.from(new Set(rows.map((r) => r.criado_por)));
  const { data: profs } = await admin
    .from("profiles")
    .select("id, nome")
    .in("id", userIds);
  const nameById = new Map(
    ((profs ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]),
  );

  return rows.map((r) => ({
    ...r,
    status: r.status as ApresentacaoRow["status"],
    criado_por_nome: nameById.get(r.criado_por) ?? null,
  }));
}

export async function getApresentacao(id: string): Promise<ApresentacaoRow | null> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("apresentacoes_yide")
    .select("id, titulo, prompt, objetivo, num_slides_alvo, slides, status, pdf_storage_path, criado_por, created_at")
    .eq("id", id)
    .single();
  if (!data) return null;
  const r = data as ApresentacaoRaw;

  const { data: prof } = await admin
    .from("profiles")
    .select("nome")
    .eq("id", r.criado_por)
    .maybeSingle();

  return {
    ...r,
    status: r.status as ApresentacaoRow["status"],
    criado_por_nome: (prof as { nome: string } | null)?.nome ?? null,
  };
}
