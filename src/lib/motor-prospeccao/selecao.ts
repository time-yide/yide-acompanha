import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { funcionaNoFds, isDiaUtil } from "./categorias";
import type { LeadParaProspectar } from "./types";
import { MOTOR_BATCH_SIZE } from "./types";

function sb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServiceRoleClient() as any;
}

export async function selecionarLeads(
  orgId: string,
  maxTentativas: number,
  batchSize: number = MOTOR_BATCH_SIZE,
): Promise<LeadParaProspectar[]> {
  const now = new Date();
  const isWeekday = isDiaUtil(now);

  const limiteProxTentativa = now.toISOString();

  const { data } = await sb()
    .from("leads_gerados")
    .select(
      "id, empresa, telefone, whatsapp, categoria, cidade, estado, " +
      "google_rating, google_reviews_count, website, porte_empresa, " +
      "ai_tentativas, ai_status, decisor_nome",
    )
    .eq("organization_id", orgId)
    .in("status", ["novo", "em_contato", "qualificado"])
    .is("arquivado_em", null)
    .lt("ai_tentativas", maxTentativas)
    .or("ai_status.is.null,ai_status.eq.aguardando")
    .or(
      "ai_proxima_tentativa.is.null," +
      `ai_proxima_tentativa.lte.${limiteProxTentativa}`,
    )
    .or("telefone.not.is.null,whatsapp.not.is.null")
    .order("ai_tentativas", { ascending: true })
    .order("google_rating", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(isWeekday ? batchSize : batchSize * 10);

  if (!data || data.length === 0) return [];

  let leads = data as LeadParaProspectar[];

  if (!isWeekday) {
    leads = leads.filter((l) => funcionaNoFds(l.categoria));
  }

  return leads.slice(0, batchSize);
}

export async function contarWppEnviadosHoje(orgId: string): Promise<number> {
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);

  const { count } = await sb()
    .from("motor_prospeccao_log")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("acao", "wpp_primeiro_contato")
    .gte("criado_em", hoje.toISOString());

  return count ?? 0;
}

export async function getOrgsComMotorAtivo(): Promise<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { organization_id: string; config: any }[]
> {
  const { data } = await sb()
    .from("ai_voice_configs")
    .select("*")
    .eq("ativo", true)
    .eq("motor_ativo", true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((c: any) => ({
    organization_id: c.organization_id,
    config: c,
  }));
}
