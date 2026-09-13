import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  searchGoogleMaps,
  normalizeOutscraperPlace,
} from "./services/outscraper";
import { searchCnpjByName } from "./services/cnpja";

interface NovoLeadParaReceita {
  id: string;
  empresa: string;
  cidade: string;
  estado?: string;
}

const RECEITA_BATCH_SIZE = 5;

function isQuotaError(error: string | null): boolean {
  if (!error) return false;
  const e = error.toLowerCase();
  return (
    e.includes("429") ||
    e.includes("quota") ||
    e.includes("limite") ||
    e.includes("limit") ||
    e.includes("exceeded")
  );
}

async function enriquecerComReceita(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  leads: NovoLeadParaReceita[],
): Promise<void> {
  if (leads.length === 0) return;

  let cotaEsgotada = false;

  for (let i = 0; i < leads.length; i += RECEITA_BATCH_SIZE) {
    if (cotaEsgotada) break;
    const batch = leads.slice(i, i + RECEITA_BATCH_SIZE);

    const resultados = await Promise.all(
      batch.map(async (lead) => {
        const r = await searchCnpjByName(lead.empresa, lead.cidade, lead.estado);
        return { lead, r };
      }),
    );

    for (const { lead, r } of resultados) {
      if (r.skipped) {
        console.warn("[gerador-leads] CNPJA_API_KEY ausente - pulando Receita");
        return;
      }
      if (isQuotaError(r.error)) {
        console.warn("[gerador-leads] cota CNPJá esgotada - parando enriquecimento");
        cotaEsgotada = true;
        break;
      }
      if (!r.ok || !r.cnpj) continue;

      const socioPrincipal =
        r.socios.find((s) => s.qualificacao.toLowerCase().includes("administrador")) ??
        r.socios[0] ??
        null;

      await sb
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

export async function processarPesquisa(args: {
  pesquisaId: string;
  organizationId: string;
  nicho: string;
  cidade: string;
  limite: number;
}): Promise<{ totalNovos: number }> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  await sb
    .from("leads_gerados_pesquisas")
    .update({ status: "processando", iniciado_em: new Date().toISOString() })
    .eq("id", args.pesquisaId);

  try {
    const result = await searchGoogleMaps({
      query: `${args.nicho} em ${args.cidade}`,
      limit: args.limite,
    });

    if (!result.ok) {
      await sb
        .from("leads_gerados_pesquisas")
        .update({
          status: "erro",
          erro_mensagem: result.error,
          concluido_em: new Date().toISOString(),
        })
        .eq("id", args.pesquisaId);
      return { totalNovos: 0 };
    }

    let totalNovos = 0;
    const novosLeads: NovoLeadParaReceita[] = [];

    for (const raw of result.results) {
      const norm = normalizeOutscraperPlace(raw);
      if (!norm) continue;

      const { data: existing } = await sb
        .from("leads_gerados")
        .select("id")
        .eq("organization_id", args.organizationId)
        .eq("google_place_id", norm.google_place_id ?? "")
        .maybeSingle();

      if (existing) {
        await sb
          .from("leads_gerados")
          .update({ raw_data: norm.raw_data })
          .eq("id", (existing as { id: string }).id);
        continue;
      }

      const cidadeLead = norm.cidade ?? args.cidade;
      const { data: insData, error: insErr } = await sb
        .from("leads_gerados")
        .insert({
          organization_id: args.organizationId,
          pesquisa_id: args.pesquisaId,
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
        novosLeads.push({
          id: (insData as { id: string }).id,
          empresa: norm.empresa,
          cidade: cidadeLead,
          estado: norm.estado ?? undefined,
        });
      }
    }

    await enriquecerComReceita(sb, novosLeads);

    await sb
      .from("leads_gerados_pesquisas")
      .update({
        status: "concluido",
        total_resultados: result.results.length,
        total_novos: totalNovos,
        external_request_id: result.requestId,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", args.pesquisaId);

    return { totalNovos };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[gerador-leads] erro processando pesquisa:", msg);
    await sb
      .from("leads_gerados_pesquisas")
      .update({
        status: "erro",
        erro_mensagem: msg,
        concluido_em: new Date().toISOString(),
      })
      .eq("id", args.pesquisaId);
    return { totalNovos: 0 };
  }
}
