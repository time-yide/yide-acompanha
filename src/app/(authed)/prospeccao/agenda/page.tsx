import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getProximasReunioes } from "@/lib/dashboard/comercial-queries";
import { getLeadsAgendaveis } from "@/lib/prospeccao/queries";
import { ProximasReunioesList } from "@/components/dashboard/ProximasReunioesList";
import { ComercialSelector } from "@/components/prospeccao/ComercialSelector";
import { CriarAgendaButton } from "@/components/prospeccao/CriarAgendaButton";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ comercial_id?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const isComercial = user.role === "comercial";

  const comercialId = isComercial ? user.id : (params.comercial_id || user.id);

  const [reunioes, leadsAgendaveis] = await Promise.all([
    getProximasReunioes(comercialId, 14),
    getLeadsAgendaveis(comercialId),
  ]);

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Próximas reuniões</h2>
          <p className="text-xs text-muted-foreground">Próximos 14 dias</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!isComercial && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Comercial:</span>
              <ComercialSelector comerciais={comerciais} current={comercialId} />
            </div>
          )}
          <CriarAgendaButton leads={leadsAgendaveis} />
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <ProximasReunioesList reunioes={reunioes} />
      </div>
    </div>
  );
}
