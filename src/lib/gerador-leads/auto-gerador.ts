import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  searchGoogleMaps,
  normalizeOutscraperPlace,
} from "./services/outscraper";
import { searchCnpjByName } from "./services/cnpja";
import { NICHOS, CIDADE_PADRAO, montarQueryCompleta } from "./nichos";
import type { NichoConfig } from "./nichos";

function sb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServiceRoleClient() as any;
}

const NICHOS_POR_RODADA = 3;
const DIAS_REUSO = 30;
const RECEITA_BATCH = 5;

interface AutoGeradorResult {
  orgId: string;
  nichosProcessados: string[];
  totalNovos: number;
  erros: string[];
}

export async function executarAutoGerador(): Promise<AutoGeradorResult[]> {
  const { data: orgs } = await sb()
    .from("ai_voice_configs")
    .select("organization_id")
    .eq("ativo", true)
    .eq("motor_ativo", true);

  if (!orgs || orgs.length === 0) return [];

  const resultados: AutoGeradorResult[] = [];

  for (const org of orgs) {
    const orgId = (org as { organization_id: string }).organization_id;
    const resultado = await processarOrg(orgId);
    resultados.push(resultado);
  }

  return resultados;
}

async function processarOrg(orgId: string): Promise<AutoGeradorResult> {
  const result: AutoGeradorResult = {
    orgId,
    nichosProcessados: [],
    totalNovos: 0,
    erros: [],
  };

  const nichosParaBuscar = await selecionarNichos(orgId);
  if (nichosParaBuscar.length === 0) return result;

  for (const nicho of nichosParaBuscar) {
    try {
      const novos = await buscarEInserirNicho(orgId, nicho);
      result.nichosProcessados.push(nicho.query);
      result.totalNovos += novos;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.erros.push(`${nicho.query}: ${msg}`);
    }
  }

  return result;
}

async function selecionarNichos(orgId: string): Promise<NichoConfig[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - DIAS_REUSO);

  const { data: recentes } = await sb()
    .from("leads_gerados_pesquisas")
    .select("nicho")
    .eq("organization_id", orgId)
    .gte("created_at", desde.toISOString())
    .in("status", ["concluido", "processando", "pendente"]);

  const nichosJaBuscados = new Set(
    ((recentes ?? []) as { nicho: string }[]).map((r) =>
      r.nicho.toLowerCase().trim(),
    ),
  );

  const disponiveis = NICHOS.filter(
    (n) => !nichosJaBuscados.has(n.query.toLowerCase().trim()),
  );

  if (disponiveis.length === 0) {
    return NICHOS.slice(0, NICHOS_POR_RODADA);
  }

  return disponiveis.slice(0, NICHOS_POR_RODADA);
}

async function buscarEInserirNicho(
  orgId: string,
  nicho: NichoConfig,
): Promise<number> {
  const pesquisaId = await criarPesquisa(orgId, nicho);

  const query = montarQueryCompleta(nicho);
  const result = await searchGoogleMaps({ query, limit: nicho.limite });

  if (!result.ok) {
    await sb()
      .from("leads_gerados_pesquisas")
      .update({
        status: "erro",
        erro_mensagem: result.error,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", pesquisaId);
    console.error(`[auto-gerador] erro outscraper para "${nicho.query}": ${result.error}`);
    return 0;
  }

  let totalNovos = 0;
  const novosParaReceita: { id: string; empresa: string; cidade: string; estado?: string }[] = [];

  for (const raw of result.results) {
    const norm = normalizeOutscraperPlace(raw);
    if (!norm) continue;

    const { data: existing } = await sb()
      .from("leads_gerados")
      .select("id")
      .eq("organization_id", orgId)
      .eq("google_place_id", norm.google_place_id ?? "")
      .maybeSingle();

    if (existing) continue;

    const cidadeLead = norm.cidade ?? CIDADE_PADRAO;
    const { data: insData, error: insErr } = await sb()
      .from("leads_gerados")
      .insert({
        organization_id: orgId,
        pesquisa_id: pesquisaId,
        empresa: norm.empresa,
        telefone: norm.telefone,
        whatsapp: norm.whatsapp,
        email: norm.email,
        website: norm.website,
        dominio: norm.dominio,
        instagram: norm.instagram,
        endereco: norm.endereco,
        cidade: cidadeLead,
        estado: norm.estado,
        pais: norm.pais,
        categoria: norm.categoria,
        horario_funcionamento: norm.horario_funcionamento,
        google_rating: norm.google_rating,
        google_reviews_count: norm.google_reviews_count,
        google_place_id: norm.google_place_id,
        google_maps_url: norm.google_maps_url,
        latitude: norm.latitude,
        longitude: norm.longitude,
        base_prospeccao: norm.base_prospeccao,
        raw_data: norm.raw_data,
        fonte: "outscraper",
        status: "novo",
      })
      .select("id")
      .single();

    if (!insErr && insData) {
      totalNovos++;
      novosParaReceita.push({
        id: (insData as { id: string }).id,
        empresa: norm.empresa,
        cidade: cidadeLead,
        estado: norm.estado ?? undefined,
      });
    }
  }

  await enriquecerLote(novosParaReceita);

  await sb()
    .from("leads_gerados_pesquisas")
    .update({
      status: "concluido",
      total_resultados: result.results.length,
      total_novos: totalNovos,
      external_request_id: result.requestId,
      concluido_em: new Date().toISOString(),
    })
    .eq("id", pesquisaId);

  console.log(`[auto-gerador] "${nicho.query}": ${totalNovos} novos de ${result.results.length} resultados`);
  return totalNovos;
}

async function criarPesquisa(orgId: string, nicho: NichoConfig): Promise<string> {
  const { data, error } = await sb()
    .from("leads_gerados_pesquisas")
    .insert({
      organization_id: orgId,
      nicho: nicho.query,
      cidade: CIDADE_PADRAO,
      limite: nicho.limite,
      status: "processando",
      iniciado_em: new Date().toISOString(),
      criado_por: null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Erro ao criar pesquisa: ${error?.message}`);
  return (data as { id: string }).id;
}

function isQuotaError(error: string | null): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return e.includes("429") || e.includes("quota") || e.includes("limite") || e.includes("limit") || e.includes("exceeded");
}

async function enriquecerLote(
  leads: { id: string; empresa: string; cidade: string; estado?: string }[],
): Promise<void> {
  if (leads.length === 0) return;

  let cotaEsgotada = false;

  for (let i = 0; i < leads.length; i += RECEITA_BATCH) {
    if (cotaEsgotada) break;
    const batch = leads.slice(i, i + RECEITA_BATCH);

    const resultados = await Promise.all(
      batch.map(async (lead) => {
        const r = await searchCnpjByName(lead.empresa, lead.cidade, lead.estado);
        return { lead, r };
      }),
    );

    for (const { lead, r } of resultados) {
      if (r.skipped) return;
      if (isQuotaError(r.error)) { cotaEsgotada = true; break; }
      if (!r.ok || !r.cnpj) continue;

      const socioPrincipal =
        r.socios.find((s) => s.qualificacao.toLowerCase().includes("administrador")) ??
        r.socios[0] ?? null;

      await sb()
        .from("leads_gerados")
        .update({
          cnpj: r.cnpj,
          socios: r.socios,
          socio_principal_qualificacao: socioPrincipal?.qualificacao ?? null,
          telefone_receita: r.telefone,
          email_receita: r.email,
          porte_empresa: r.porte_empresa,
        })
        .eq("id", lead.id);
    }
  }
}
