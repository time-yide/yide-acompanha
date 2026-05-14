// SERVER ONLY: do not import from client components

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface MaterialRow {
  id: string;
  nome: string;
  descricao: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string;
  uploaded_by_nome: string | null;
  created_at: string;
}

export async function listMateriais(): Promise<MaterialRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("manual_materiais")
    .select("id, nome, descricao, storage_path, mime_type, size_bytes, uploaded_by, created_at")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Array<{
    id: string;
    nome: string;
    descricao: string | null;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    uploaded_by: string;
    created_at: string;
  }>;
  if (rows.length === 0) return [];

  // Resolve nomes dos uploaders.
  const uploaderIds = Array.from(new Set(rows.map((r) => r.uploaded_by)));
  const { data: profs } = await admin
    .from("profiles")
    .select("id, nome")
    .in("id", uploaderIds);
  const nameById = new Map(
    ((profs ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]),
  );

  return rows.map((r) => ({
    ...r,
    uploaded_by_nome: nameById.get(r.uploaded_by) ?? null,
  }));
}

/**
 * Gera signed URL pra download. Expira em 1h. Como o bucket é privado,
 * essa é a única forma do arquivo chegar no browser.
 */
export async function getMaterialSignedUrl(storagePath: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.storage
    .from("manual-materiais")
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}
