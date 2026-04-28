import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getProspectsList, type ProspectStatus } from "@/lib/prospeccao/queries";
import { ProspectsTable } from "@/components/prospeccao/ProspectsTable";
import { ProspectsFilters } from "@/components/prospeccao/ProspectsFilters";

export default async function ProspectsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; comercial_id?: string; valor_min?: string; valor_max?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const isComercial = user.role === "comercial";

  const comercialId = isComercial ? user.id : (params.comercial_id || undefined);

  const statuses = params.status ? (params.status.split(",") as ProspectStatus[]) : undefined;
  const valorMin = params.valor_min ? Number(params.valor_min) : undefined;
  const valorMax = params.valor_max ? Number(params.valor_max) : undefined;

  const rows = await getProspectsList({
    comercialId,
    status: statuses,
    valorMin,
    valorMax,
  });

  let comerciais: Array<{ id: string; nome: string }> = [];
  if (!isComercial) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, nome")
      .eq("role", "comercial")
      .eq("ativo", true)
      .order("nome");
    comerciais = (data ?? []) as Array<{ id: string; nome: string }>;
  }

  return (
    <div className="space-y-4">
      <ProspectsFilters comerciais={comerciais} showComercialFilter={!isComercial} />
      <ProspectsTable rows={rows} />
    </div>
  );
}
