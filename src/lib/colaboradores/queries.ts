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
  /** 'ecommerce' | null — só rótulo, relevante quando role='assessor'. */
  especialidade: string | null;
}

export interface ColaboradorFilters {
  ativo?: boolean;
  role?: string;
  /**
   * Filtro de role múltiplo (OR). Útil pra casos onde "Coordenador" no UI
   * agora cobre tanto `socio` (modelo novo) quanto `coordenador` (legado).
   * Se `role` E `roles` forem passados, `roles` ganha.
   */
  roles?: string[];
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

  // Defense in depth: pega ids de usuários do portal do cliente pra excluir
  // do resultado. O trigger `handle_new_user` agora pula esses (vide migration
  // 20260524000000_fix_handle_new_user_skip_client_portal), mas se algum
  // profile fantasma legacy ainda existir (mesmo inativo) ou se alguém criar
  // um manualmente, esse filtro garante que não vaza pra /colaboradores.
  const { data: portalUsers } = await supabase
    .from("client_portal_users")
    .select("user_id");
  const portalUserIds = (portalUsers ?? []).map((r) => r.user_id as string);

  // Cast via any: coluna `especialidade` ainda não está nos types gerados do
  // Supabase (chega após `npm run db:types` pós-migration).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  let query = sb
    .from("profiles")
    .select(
      "id, nome, email, role, ativo, fixo_mensal, comissao_percent, comissao_primeiro_mes_percent, created_at, data_admissao, avatar_url, especialidade",
    );

  if (portalUserIds.length > 0) {
    query = query.not("id", "in", `(${portalUserIds.join(",")})`);
  }

  if (typeof filters?.ativo === "boolean") query = query.eq("ativo", filters.ativo);
  type RoleEnum =
    | "adm"
    | "socio"
    | "comercial"
    | "coordenador"
    | "assessor"
    | "videomaker"
    | "designer"
    | "editor"
    | "audiovisual_chefe";
  if (filters?.roles && filters.roles.length > 0) {
    query = query.in("role", filters.roles as RoleEnum[]);
  } else if (filters?.role) {
    query = query.eq("role", filters.role as RoleEnum);
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
    // v2: ColaboradorRow ganhou `especialidade`
    ["colaboradores-list-v2"],
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
