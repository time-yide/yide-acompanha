import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processarPesquisa } from "./processar-pesquisa";

interface PesquisaAutoResult {
  totalConfigs: number;
  totalLeadsGerados: number;
  erros: string[];
}

export async function executarPesquisasAutomaticas(): Promise<PesquisaAutoResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const { data: configs, error } = await sb
    .from("pesquisas_automaticas")
    .select("id, organization_id, nicho, cidade, quantidade")
    .eq("ativo", true);

  if (error || !configs) {
    console.error("[pesquisa-auto] erro ao buscar configs:", error?.message);
    return { totalConfigs: 0, totalLeadsGerados: 0, erros: [error?.message ?? "unknown"] };
  }

  const result: PesquisaAutoResult = {
    totalConfigs: configs.length,
    totalLeadsGerados: 0,
    erros: [],
  };

  for (const config of configs as { id: string; organization_id: string; nicho: string; cidade: string; quantidade: number }[]) {
    try {
      const { data: pesquisa, error: pesqErr } = await sb
        .from("leads_gerados_pesquisas")
        .insert({
          organization_id: config.organization_id,
          criado_por: null,
          nicho: config.nicho,
          cidade: config.cidade,
          limite: config.quantidade,
          status: "pendente",
        })
        .select("id")
        .single();

      if (pesqErr || !pesquisa) {
        result.erros.push(`${config.nicho}/${config.cidade}: ${pesqErr?.message}`);
        continue;
      }

      const { totalNovos } = await processarPesquisa({
        pesquisaId: (pesquisa as { id: string }).id,
        organizationId: config.organization_id,
        nicho: config.nicho,
        cidade: config.cidade,
        limite: config.quantidade,
      });

      result.totalLeadsGerados += totalNovos;

      await sb
        .from("pesquisas_automaticas")
        .update({
          ultima_execucao: new Date().toISOString(),
          total_leads_gerados: totalNovos,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);

      console.log(`[pesquisa-auto] ${config.nicho} em ${config.cidade}: ${totalNovos} novos leads`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.erros.push(`${config.nicho}/${config.cidade}: ${msg}`);
      console.error(`[pesquisa-auto] erro em ${config.nicho}/${config.cidade}:`, msg);
    }
  }

  return result;
}
