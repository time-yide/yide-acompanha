// SERVER ONLY: do not import from client components
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calculateCommission } from "./calculator";

export async function previewMyCommission(userId: string) {
  const now = new Date();
  const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const result = await calculateCommission(userId, monthRef);
  return { monthRef, result };
}

export interface OverviewPreviewRow {
  id: string;
  fixo: number;
  valor_variavel: number;
  ajuste_manual: number;
  valor_total: number;
  status: "preview";
  papel_naquele_mes: string;
  profile: { id: string; nome: string; role: string } | null;
}

export async function previewAllForMonth(monthRef: string): Promise<OverviewPreviewRow[]> {
  const supabase = createServiceRoleClient();
  const { data: profilesRows } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .eq("ativo", true)
    .neq("role", "socio")
    .order("nome");
  const profiles = (profilesRows ?? []) as Array<{ id: string; nome: string; role: string }>;

  const rows: OverviewPreviewRow[] = [];
  for (const p of profiles) {
    const calc = await calculateCommission(p.id, monthRef);
    if (!calc) continue;
    const fixo = Number(calc.snapshot.fixo) || 0;
    const valor_variavel = Number(calc.snapshot.valor_variavel) || 0;
    rows.push({
      id: `preview:${p.id}`,
      fixo,
      valor_variavel,
      ajuste_manual: 0,
      valor_total: fixo + valor_variavel,
      status: "preview",
      papel_naquele_mes: p.role,
      profile: { id: p.id, nome: p.nome, role: p.role },
    });
  }
  return rows;
}
