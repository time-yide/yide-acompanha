import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

export interface AutoCampanhaConfig {
  organization_id: string;
  auto_campanha_ativo: boolean;
  auto_campanha_meta_atendidas: number;
  auto_campanha_horario_inicio: string;
  auto_campanha_horario_fim: string;
  power_dialer_colaborador_id: string | null;
}

export interface CampanhaDiaria {
  id: string;
  organization_id: string;
  data: string;
  status: string;
  colaborador_id: string | null;
  tentativas: number;
  atendidas: number;
}

export async function getOrgsComAutoCampanha(): Promise<AutoCampanhaConfig[]> {
  const { data } = await sb()
    .from("ai_voice_configs")
    .select(
      "organization_id, auto_campanha_ativo, auto_campanha_meta_atendidas, " +
      "auto_campanha_horario_inicio, auto_campanha_horario_fim, power_dialer_colaborador_id",
    )
    .eq("ativo", true)
    .eq("auto_campanha_ativo", true);
  return (data ?? []) as AutoCampanhaConfig[];
}

export async function getCampanhaHoje(orgId: string): Promise<CampanhaDiaria | null> {
  const hoje = getHojeCuiaba();
  const { data } = await sb()
    .from("campanha_discagem_diaria")
    .select("*")
    .eq("organization_id", orgId)
    .eq("data", hoje)
    .maybeSingle();
  return data as CampanhaDiaria | null;
}

export async function criarCampanhaHoje(
  orgId: string,
  colaboradorId: string | null,
): Promise<CampanhaDiaria> {
  const hoje = getHojeCuiaba();
  const { data } = await sb()
    .from("campanha_discagem_diaria")
    .upsert(
      { organization_id: orgId, data: hoje, colaborador_id: colaboradorId, status: "em_andamento" },
      { onConflict: "organization_id,data" },
    )
    .select("*")
    .single();
  return data as CampanhaDiaria;
}

export async function incrementarCampanha(
  campanhaId: string,
  atendida: boolean,
): Promise<CampanhaDiaria> {
  const campanha = await sb()
    .from("campanha_discagem_diaria")
    .select("tentativas, atendidas")
    .eq("id", campanhaId)
    .single();

  const tentativas = ((campanha.data as CampanhaDiaria)?.tentativas ?? 0) + 1;
  const atendidas = ((campanha.data as CampanhaDiaria)?.atendidas ?? 0) + (atendida ? 1 : 0);

  const { data } = await sb()
    .from("campanha_discagem_diaria")
    .update({ tentativas, atendidas })
    .eq("id", campanhaId)
    .select("*")
    .single();

  return data as CampanhaDiaria;
}

export async function finalizarCampanha(campanhaId: string, status = "concluida"): Promise<void> {
  await sb()
    .from("campanha_discagem_diaria")
    .update({ status, finalizada_em: new Date().toISOString() })
    .eq("id", campanhaId);
}

export async function temLigacaoAtivaCampanha(orgId: string): Promise<boolean> {
  const { count } = await sb()
    .from("ligacoes")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("origem", "auto_campanha")
    .eq("status", "em_andamento");
  return (count ?? 0) > 0;
}

function getHojeCuiaba(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Cuiaba" });
}
