// src/lib/batidas/aggregate.ts
import {
  BATIDAS_META,
  leadGeradoEmSucesso,
  leadGeradoDescartado,
  leadOnboardingEmSucesso,
  leadOnboardingDescartado,
} from "./config";

export interface LeadGeradoLite {
  id: string;
  empresa: string;
  status: string;
  fonte: string;
  visita_id: string | null;
  responsavel_id: string | null;
  lead_onboarding_id: string | null;
  created_at: string;
  decisor_nome: string | null;
  telefone: string | null;
  whatsapp: string | null;
}

export interface LeadLite {
  id: string;
  nome_prospect: string;
  stage: string;
  canal: string;
  comercial_id: string | null;
  motivo_perdido: string | null;
  created_at: string;
}

export interface AttemptLite {
  lead_id: string | null;
  lead_gerado_id: string | null;
  resultado: string;
  created_at: string;
}

export interface LigacaoLite {
  lead_id: string | null;
  lead_gerado_id: string | null;
  direcao: string;
  iniciada_em: string;
}

export interface AggInput {
  leadsGerados: LeadGeradoLite[];
  leads: LeadLite[];
  attempts: AttemptLite[];
  ligacoes: LigacaoLite[];
}

export type StatusCadencia = "em_cadencia" | "convertido" | "esgotou" | "descartado";

export interface ProspectoCadencia {
  key: string;
  leadGeradoId: string | null;
  leadId: string | null;
  nome: string;
  canal: "rua" | "ligacao";
  responsavelId: string | null;
  totalBatidas: number;
  meta: number;
  ultimaBatida: string | null;
  temSucesso: boolean;
  descartado: boolean;
  esgotou: boolean;
  statusCadencia: StatusCadencia;
}

function maisRecente(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/**
 * Agrega as fontes de batida (lead_attempts + ligações de saída + visita de origem)
 * em uma lista de prospectos, resolvendo a identidade lead_gerado <-> lead de Onboarding.
 * Função PURA: não faz I/O.
 */
export function montarProspectosCadencia(input: AggInput): ProspectoCadencia[] {
  const { leadsGerados, leads, attempts, ligacoes } = input;

  const leadById = new Map(leads.map((l) => [l.id, l]));
  const linkedLeadIds = new Set<string>();

  const prospectos: ProspectoCadencia[] = [];

  // 1) Prospectos a partir dos leads_gerados (podem trazer junto o lead ligado).
  for (const g of leadsGerados) {
    const lead = g.lead_onboarding_id ? leadById.get(g.lead_onboarding_id) ?? null : null;
    if (lead) linkedLeadIds.add(lead.id);
    prospectos.push(
      construir({
        key: `g:${g.id}`,
        leadGeradoId: g.id,
        leadId: lead?.id ?? null,
        nome: lead?.nome_prospect || g.empresa,
        canal: g.fonte === "visita" || lead?.canal === "rua" ? "rua" : "ligacao",
        responsavelId: g.responsavel_id ?? lead?.comercial_id ?? null,
        contaVisita: !!g.visita_id,
        visitaData: g.created_at,
        leadGerado: g,
        lead,
        attempts,
        ligacoes,
      }),
    );
  }

  // 2) Leads de Onboarding standalone (não referenciados por nenhum lead_gerado).
  for (const l of leads) {
    if (linkedLeadIds.has(l.id)) continue;
    prospectos.push(
      construir({
        key: `l:${l.id}`,
        leadGeradoId: null,
        leadId: l.id,
        nome: l.nome_prospect,
        canal: l.canal === "rua" ? "rua" : "ligacao",
        responsavelId: l.comercial_id ?? null,
        contaVisita: false,
        visitaData: null,
        leadGerado: null,
        lead: l,
        attempts,
        ligacoes,
      }),
    );
  }

  return prospectos;
}

function construir(args: {
  key: string;
  leadGeradoId: string | null;
  leadId: string | null;
  nome: string;
  canal: "rua" | "ligacao";
  responsavelId: string | null;
  contaVisita: boolean;
  visitaData: string | null;
  leadGerado: LeadGeradoLite | null;
  lead: LeadLite | null;
  attempts: AttemptLite[];
  ligacoes: LigacaoLite[];
}): ProspectoCadencia {
  const { leadGeradoId, leadId } = args;

  const matchAttempt = (a: AttemptLite) =>
    (leadGeradoId && a.lead_gerado_id === leadGeradoId) || (leadId && a.lead_id === leadId);
  const matchLig = (c: LigacaoLite) =>
    c.direcao === "saida" &&
    ((leadGeradoId && c.lead_gerado_id === leadGeradoId) || (leadId && c.lead_id === leadId));

  const meusAttempts = args.attempts.filter(matchAttempt);
  const minhasLig = args.ligacoes.filter(matchLig);

  const total = meusAttempts.length + minhasLig.length + (args.contaVisita ? 1 : 0);

  let ultima: string | null = args.contaVisita ? args.visitaData : null;
  for (const a of meusAttempts) ultima = maisRecente(ultima, a.created_at);
  for (const c of minhasLig) ultima = maisRecente(ultima, c.iniciada_em);

  const temAgendou = meusAttempts.some((a) => a.resultado === "agendou");
  const temSucesso =
    temAgendou ||
    (args.leadGerado ? leadGeradoEmSucesso(args.leadGerado.status) : false) ||
    (args.lead ? leadOnboardingEmSucesso(args.lead.stage, args.lead.motivo_perdido) : false);

  const descartado =
    (args.leadGerado ? leadGeradoDescartado(args.leadGerado.status) : false) ||
    (args.lead ? leadOnboardingDescartado(args.lead.motivo_perdido) : false);

  const esgotou = !temSucesso && !descartado && total >= BATIDAS_META;

  const statusCadencia: StatusCadencia = descartado
    ? "descartado"
    : temSucesso
      ? "convertido"
      : esgotou
        ? "esgotou"
        : "em_cadencia";

  return {
    key: args.key,
    leadGeradoId,
    leadId,
    nome: args.nome,
    canal: args.canal,
    responsavelId: args.responsavelId,
    totalBatidas: total,
    meta: BATIDAS_META,
    ultimaBatida: ultima,
    temSucesso,
    descartado,
    esgotou,
    statusCadencia,
  };
}
