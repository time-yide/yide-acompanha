// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  montarProspectosCadencia,
  type ProspectoCadencia,
  type LeadGeradoLite,
  type LeadLite,
  type AttemptLite,
  type LigacaoLite,
} from "./aggregate";

export const BATIDAS_TAG = "batidas" as const;
const REVALIDATE_SECONDS = 60;

export async function getOrganizationId(userId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.organization_id as string | undefined) ?? null;
}

interface RawSources {
  leadsGerados: LeadGeradoLite[];
  leads: LeadLite[];
  attempts: AttemptLite[];
  ligacoes: LigacaoLite[];
}

async function _fetchSources(orgId: string, responsavelId: string | null): Promise<RawSources> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  let qg = sb
    .from("leads_gerados")
    .select(
      "id, empresa, status, fonte, visita_id, responsavel_id, lead_onboarding_id, created_at, decisor_nome, telefone, whatsapp",
    )
    .eq("organization_id", orgId)
    .is("arquivado_em", null);
  if (responsavelId) qg = qg.eq("responsavel_id", responsavelId);

  let ql = sb
    .from("leads")
    .select("id, nome_prospect, stage, canal, comercial_id, motivo_perdido, created_at")
    .eq("organization_id", orgId);
  if (responsavelId) ql = ql.eq("comercial_id", responsavelId);

  const [{ data: lg }, { data: ld }] = await Promise.all([qg, ql]);

  const leadsGerados = (lg ?? []) as LeadGeradoLite[];
  const leads = (ld ?? []) as LeadLite[];

  const geradoIds = leadsGerados.map((g) => g.id);
  const leadIds = leads.map((l) => l.id);

  const attempts = await fetchAttempts(sb, geradoIds, leadIds);
  const ligacoes = await fetchLigacoes(sb, geradoIds, leadIds);

  return { leadsGerados, leads, attempts, ligacoes };
}

async function fetchAttempts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  geradoIds: string[],
  leadIds: string[],
): Promise<AttemptLite[]> {
  const byId = new Map<string, AttemptLite>();
  const collect = (rows: unknown[] | null) => {
    for (const r of (rows ?? []) as Array<AttemptLite & { id: string }>) byId.set(r.id, r);
  };
  if (geradoIds.length) {
    const { data } = await sb
      .from("lead_attempts")
      .select("id, lead_id, lead_gerado_id, resultado, created_at")
      .in("lead_gerado_id", geradoIds);
    collect(data);
  }
  if (leadIds.length) {
    const { data } = await sb
      .from("lead_attempts")
      .select("id, lead_id, lead_gerado_id, resultado, created_at")
      .in("lead_id", leadIds);
    collect(data);
  }
  return [...byId.values()];
}

async function fetchLigacoes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  geradoIds: string[],
  leadIds: string[],
): Promise<LigacaoLite[]> {
  const byId = new Map<string, LigacaoLite>();
  const collect = (rows: unknown[] | null) => {
    for (const r of (rows ?? []) as Array<LigacaoLite & { id: string }>) byId.set(r.id, r);
  };
  const base = () =>
    sb
      .from("ligacoes")
      .select("id, lead_id, lead_gerado_id, direcao, iniciada_em")
      .eq("direcao", "saida")
      .is("arquivado_em", null);
  if (geradoIds.length) {
    const { data } = await base().in("lead_gerado_id", geradoIds);
    collect(data);
  }
  if (leadIds.length) {
    const { data } = await base().in("lead_id", leadIds);
    collect(data);
  }
  return [...byId.values()];
}

export type CadenciaView = "em_cadencia" | "convertidos" | "esgotados" | "todos";

export interface GetProspectosArgs {
  orgId: string;
  responsavelId: string | null; // null = vê tudo
  view?: CadenciaView;
  canal?: "rua" | "ligacao" | "todos";
}

async function _getProspectosImpl(args: GetProspectosArgs): Promise<ProspectoCadencia[]> {
  const sources = await _fetchSources(args.orgId, args.responsavelId);
  let lista = montarProspectosCadencia(sources);

  const view = args.view ?? "em_cadencia";
  if (view === "em_cadencia") lista = lista.filter((p) => p.statusCadencia === "em_cadencia" || p.statusCadencia === "esgotou");
  else if (view === "convertidos") lista = lista.filter((p) => p.temSucesso);
  else if (view === "esgotados") lista = lista.filter((p) => p.esgotou);

  if (args.canal && args.canal !== "todos") lista = lista.filter((p) => p.canal === args.canal);

  lista.sort((a, b) => {
    if (a.esgotou !== b.esgotou) return a.esgotou ? -1 : 1;
    const ua = a.ultimaBatida ?? "";
    const ub = b.ultimaBatida ?? "";
    if (ua !== ub) return ua < ub ? -1 : 1;
    return a.nome.localeCompare(b.nome);
  });

  return lista;
}

export async function getProspectosEmCadencia(args: GetProspectosArgs): Promise<ProspectoCadencia[]> {
  const cached = unstable_cache(
    async () => _getProspectosImpl(args),
    ["batidas-cadencia", args.orgId, args.responsavelId ?? "all", args.view ?? "em_cadencia", args.canal ?? "todos"],
    { revalidate: REVALIDATE_SECONDS, tags: [BATIDAS_TAG] },
  );
  return cached();
}

// ---- Timeline de um prospecto (para o drawer) ----

export interface BatidaTimelineItem {
  tipo: "tentativa" | "ligacao" | "visita";
  canal: string;
  rotulo: string;
  observacao: string | null;
  autorNome: string | null;
  data: string;
  conta: boolean;
  numero: number | null;
}

export async function getBatidasTimeline(args: {
  leadGeradoId: string | null;
  leadId: string | null;
  visitaId: string | null;
  visitaData: string | null;
}): Promise<BatidaTimelineItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const items: BatidaTimelineItem[] = [];

  const orFilter: string[] = [];
  if (args.leadGeradoId) orFilter.push(`lead_gerado_id.eq.${args.leadGeradoId}`);
  if (args.leadId) orFilter.push(`lead_id.eq.${args.leadId}`);

  if (orFilter.length) {
    const { data: at } = await sb
      .from("lead_attempts")
      .select("canal, resultado, observacao, created_at, autor:profiles!lead_attempts_autor_id_fkey(nome)")
      .or(orFilter.join(","));
    for (const a of (at ?? []) as Array<Record<string, unknown>>) {
      items.push({
        tipo: "tentativa",
        canal: String(a.canal),
        rotulo: String(a.resultado),
        observacao: (a.observacao as string | null) ?? null,
        autorNome: ((a.autor as { nome?: string } | null)?.nome) ?? null,
        data: String(a.created_at),
        conta: true,
        numero: null,
      });
    }

    const { data: lg } = await sb
      .from("ligacoes")
      .select("tipo, direcao, status, observacoes, iniciada_em, colaborador:profiles!ligacoes_colaborador_id_fkey(nome)")
      .is("arquivado_em", null)
      .or(orFilter.join(","));
    for (const c of (lg ?? []) as Array<Record<string, unknown>>) {
      const entrada = String(c.direcao) === "entrada";
      items.push({
        tipo: "ligacao",
        canal: String(c.tipo),
        rotulo: String(c.status),
        observacao: (c.observacoes as string | null) ?? null,
        autorNome: ((c.colaborador as { nome?: string } | null)?.nome) ?? null,
        data: String(c.iniciada_em),
        conta: !entrada,
        numero: null,
      });
    }
  }

  if (args.visitaId && args.visitaData) {
    items.push({
      tipo: "visita",
      canal: "presencial",
      rotulo: "Visita (origem)",
      observacao: null,
      autorNome: null,
      data: args.visitaData,
      conta: true,
      numero: null,
    });
  }

  items.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  let n = 0;
  for (const it of items) {
    if (it.conta) it.numero = ++n;
  }
  return items;
}
