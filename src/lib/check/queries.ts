import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CheckOrigem, CheckResultado, CheckStatus } from "./core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface CheckResumoAssessor {
  assessor_id: string;
  assessor_nome: string;
  avatar_url: string | null;
  check_id: string | null;
  status: CheckStatus | null;
  total: number;
  feitos: number;
}

export interface CheckItem {
  id: string;
  texto: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  origem: CheckOrigem;
  citacao: string | null;
  ordem: number;
  feito_assessor_em: string | null;
  resultado: CheckResultado | null;
  motivo: string | null;
}

export interface CheckDetalhe {
  assessor: { id: string; nome: string };
  check: {
    id: string;
    status: CheckStatus;
    meeting_id: string | null;
    meeting_status: string | null;
    liberado_em: string | null;
    fechado_em: string | null;
  } | null;
  itens: CheckItem[];
  carteira: Array<{ id: string; nome: string }>;
  /** Migration ainda não aplicada (tabelas não existem). */
  semTabela: boolean;
}

function isFeito(i: { resultado: string | null; feito_assessor_em: string | null }): boolean {
  return i.resultado ? i.resultado === "feito" : !!i.feito_assessor_em;
}

export async function listResumoSemana(semana: string): Promise<{ rows: CheckResumoAssessor[]; semTabela: boolean }> {
  const sb = createServiceRoleClient() as SB;
  const { data: assessores } = await sb
    .from("profiles")
    .select("id, nome, avatar_url")
    .eq("role", "assessor")
    .eq("ativo", true)
    .order("nome");
  const lista = (assessores ?? []) as Array<{ id: string; nome: string; avatar_url: string | null }>;

  const { data: checks, error } = await sb
    .from("check_semanais")
    .select("id, assessor_id, status, check_itens(resultado, feito_assessor_em)")
    .eq("semana_inicio", semana);
  const semTabela = !!error;
  const porAssessor = new Map<string, { id: string; status: CheckStatus; itens: Array<{ resultado: string | null; feito_assessor_em: string | null }> }>();
  for (const c of (checks ?? []) as Array<{ id: string; assessor_id: string; status: CheckStatus; check_itens: Array<{ resultado: string | null; feito_assessor_em: string | null }> }>) {
    porAssessor.set(c.assessor_id, { id: c.id, status: c.status, itens: c.check_itens ?? [] });
  }

  return {
    semTabela,
    rows: lista.map((a) => {
      const c = porAssessor.get(a.id);
      return {
        assessor_id: a.id,
        assessor_nome: a.nome,
        avatar_url: a.avatar_url,
        check_id: c?.id ?? null,
        status: c?.status ?? null,
        total: c?.itens.length ?? 0,
        feitos: c ? c.itens.filter(isFeito).length : 0,
      };
    }),
  };
}

export async function getCheckDetalhe(assessorId: string, semana: string): Promise<CheckDetalhe | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: assessor } = await sb.from("profiles").select("id, nome").eq("id", assessorId).maybeSingle();
  if (!assessor) return null;

  const [{ data: check, error }, { data: carteira }] = await Promise.all([
    sb
      .from("check_semanais")
      .select("id, status, meeting_id, liberado_em, fechado_em, meeting:meetings(status)")
      .eq("assessor_id", assessorId)
      .eq("semana_inicio", semana)
      .maybeSingle(),
    sb
      .from("clients")
      .select("id, nome")
      .eq("assessor_id", assessorId)
      .in("status", ["ativo", "em_onboarding"])
      .order("nome"),
  ]);

  let itens: CheckItem[] = [];
  if (check) {
    const { data } = await sb
      .from("check_itens")
      .select("id, texto, cliente_id, origem, citacao, ordem, feito_assessor_em, resultado, motivo, cliente:clients(nome)")
      .eq("check_id", check.id)
      .order("ordem")
      .order("created_at");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itens = ((data ?? []) as any[]).map((i) => ({
      id: i.id,
      texto: i.texto,
      cliente_id: i.cliente_id,
      cliente_nome: i.cliente?.nome ?? null,
      origem: i.origem,
      citacao: i.citacao,
      ordem: i.ordem,
      feito_assessor_em: i.feito_assessor_em,
      resultado: i.resultado,
      motivo: i.motivo,
    }));
  }

  return {
    assessor,
    check: check
      ? {
          id: check.id,
          status: check.status,
          meeting_id: check.meeting_id,
          meeting_status: check.meeting?.status ?? null,
          liberado_em: check.liberado_em,
          fechado_em: check.fechado_em,
        }
      : null,
    itens,
    carteira: (carteira ?? []) as Array<{ id: string; nome: string }>,
    semTabela: !!error,
  };
}
