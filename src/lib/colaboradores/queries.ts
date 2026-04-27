import { createClient } from "@/lib/supabase/server";

export async function listColaboradores(filters?: {
  ativo?: boolean;
  role?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select(
      "id, nome, email, role, ativo, fixo_mensal, comissao_percent, comissao_primeiro_mes_percent, created_at, data_admissao"
    )
    .order("nome");

  if (typeof filters?.ativo === "boolean")
    query = query.eq("ativo", filters.ativo);
  if (filters?.role)
    query = query.eq(
      "role",
      filters.role as "adm" | "socio" | "comercial" | "coordenador" | "assessor"
    );

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getColaboradorById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}
