import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface ColaboradorRow {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
  created_at: string;
  data_admissao: string | null;
  avatar_url: string | null;
}

export interface ColaboradorFilters {
  ativo?: boolean;
  role?: string;
  admissionAfter?: string | null;
}

export function sortColaboradoresByName<T extends Pick<ColaboradorRow, "nome">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function filterColaboradoresByAdmissionAfter<T extends Pick<ColaboradorRow, "data_admissao">>(
  rows: T[],
  admissionAfter: string | null | undefined,
): T[] {
  if (!admissionAfter) return rows;
  return rows.filter((r) => r.data_admissao !== null && r.data_admissao >= admissionAfter);
}

async function _listColaboradoresImpl(filters?: ColaboradorFilters): Promise<ColaboradorRow[]> {
  const supabase = createServiceRoleClient();
  let query = supabase
    .from("profiles")
    .select(
      "id, nome, email, role, ativo, fixo_mensal, comissao_percent, comissao_primeiro_mes_percent, created_at, data_admissao, avatar_url",
    );

  if (typeof filters?.ativo === "boolean") query = query.eq("ativo", filters.ativo);
  if (filters?.role) {
    query = query.eq(
      "role",
      filters.role as
        | "adm"
        | "socio"
        | "comercial"
        | "coordenador"
        | "assessor"
        | "videomaker"
        | "designer"
        | "editor"
        | "audiovisual_chefe",
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as ColaboradorRow[];
  rows = sortColaboradoresByName(rows);
  rows = filterColaboradoresByAdmissionAfter(rows, filters?.admissionAfter);
  return rows;
}

export async function listColaboradores(filters?: ColaboradorFilters): Promise<ColaboradorRow[]> {
  const cached = unstable_cache(
    async (filtersJson: string) => {
      const f = filtersJson !== "null" ? (JSON.parse(filtersJson) as ColaboradorFilters) : undefined;
      return _listColaboradoresImpl(f);
    },
    ["colaboradores-list"],
    { revalidate: 60, tags: ["colaboradores"] },
  );
  return cached(JSON.stringify(filters ?? null));
}

export async function getColaboradorById(id: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
