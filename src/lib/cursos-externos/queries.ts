import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CursoExternoRow } from "./schema";

export const CURSOS_EXTERNOS_TAG = "cursos-externos";

async function _listCursosExternosImpl(): Promise<CursoExternoRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("cursos_externos")
    .select(
      "id, nome, plataforma, link, email_acesso, senha_acesso, descricao, criado_por, created_at, updated_at",
    )
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CursoExternoRow[];
}

export async function listCursosExternos(): Promise<CursoExternoRow[]> {
  const cached = unstable_cache(
    async () => _listCursosExternosImpl(),
    ["cursos-externos-list-v1"],
    { revalidate: 60, tags: [CURSOS_EXTERNOS_TAG] },
  );
  return cached();
}

export async function getCursoExternoById(id: string): Promise<CursoExternoRow | null> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("cursos_externos")
    .select(
      "id, nome, plataforma, link, email_acesso, senha_acesso, descricao, criado_por, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as CursoExternoRow | null) ?? null;
}
