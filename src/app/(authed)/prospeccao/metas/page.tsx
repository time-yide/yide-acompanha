import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMetasComercial } from "@/lib/prospeccao/queries";
import { MetasCards } from "@/components/prospeccao/MetasCards";
import { MetasEditDialog } from "@/components/prospeccao/MetasEditDialog";
import { ComercialSelector } from "@/components/prospeccao/ComercialSelector";

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ comercial_id?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const isComercial = user.role === "comercial";
  const canEditMetas = user.role === "socio" || user.role === "adm";

  // Sócio/adm: busca a lista de comerciais primeiro pra usar como default
  // quando não há ?comercial_id (antes caía em user.id do sócio, que não
  // bate com nenhum comercial → o botão de editar metas nunca aparecia).
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

  const comercialId = isComercial
    ? user.id
    : (params.comercial_id || comerciais[0]?.id || user.id);

  const metas = await getMetasComercial(comercialId);

  let comercialAtualNome = "";
  let metasDefaults = { meta_prospects_mes: null, meta_fechamentos_mes: null, meta_receita_mes: null } as {
    meta_prospects_mes: number | null;
    meta_fechamentos_mes: number | null;
    meta_receita_mes: number | null;
  };
  if (!isComercial) {
    comercialAtualNome = comerciais.find((c) => c.id === comercialId)?.nome ?? "";

    if (canEditMetas && comercialAtualNome) {
      const supabase = await createClient();
      const { data: prof } = await supabase
        .from("profiles")
        .select("meta_prospects_mes, meta_fechamentos_mes, meta_receita_mes")
        .eq("id", comercialId)
        .maybeSingle();
      if (prof) {
        metasDefaults = {
          meta_prospects_mes: (prof as { meta_prospects_mes: number | null }).meta_prospects_mes,
          meta_fechamentos_mes: (prof as { meta_fechamentos_mes: number | null }).meta_fechamentos_mes,
          meta_receita_mes: (prof as { meta_receita_mes: number | null }).meta_receita_mes,
        };
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Metas</h2>
          <p className="text-xs text-muted-foreground">
            {comercialAtualNome
              ? `Progresso de ${comercialAtualNome} no mês corrente`
              : "Progresso do mês corrente"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isComercial && (
            <>
              <span className="text-xs text-muted-foreground">Comercial:</span>
              <ComercialSelector comerciais={comerciais} current={comercialId} />
              {canEditMetas && comercialAtualNome && (
                <MetasEditDialog
                  comercialId={comercialId}
                  comercialNome={comercialAtualNome}
                  defaults={metasDefaults}
                />
              )}
            </>
          )}
        </div>
      </div>

      <MetasCards metas={metas} />
    </div>
  );
}
