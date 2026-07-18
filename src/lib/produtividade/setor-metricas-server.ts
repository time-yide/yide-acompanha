// SERVER ONLY — fetch/agrega as fontes por setor. Separado do módulo puro
// setor-metricas.ts (que é client-safe) pra não vazar service-role/next-cache
// em client components.
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatIsoDate, getAppTimezoneOffsetMs } from "@/lib/datetime/timezone";
import { computeSince, type PeriodoRange } from "./queries";
import {
  resolveMetricaPessoa,
  pctNoPrazo,
  type Setor,
  type MetricaCrua,
  type MetricaPessoa,
} from "./setor-metricas";

export interface PessoaSetor extends MetricaCrua {
  user_id: string;
  nome: string;
  role: string;
}

export interface BlocoSetor {
  setor: Setor;
  titulo: string;
  pessoas: PessoaSetor[]; // já ordenadas (maior métrica-chave primeiro)
}

export interface ProdutividadeSetorResult {
  /** métrica-chave por usuário, pra coluna da tabela. */
  porUsuario: Record<string, MetricaPessoa>;
  /** blocos pro painel (só setores com gente). */
  setores: BlocoSetor[];
}

const TITULO_SETOR: Record<Setor, string> = {
  comercial: "Comercial",
  ecommerce: "E-commerce",
  assessoria: "Assessoria",
  design: "Design",
  audiovisual: "Audiovisual",
  programacao: "Programação",
};

// Setores mostrados no painel (audiovisual fica de fora — não pedido).
const SETORES_PAINEL: Setor[] = ["comercial", "ecommerce", "assessoria", "design", "programacao"];

// Chave de ordenação DENTRO de um bloco — usa a métrica do setor do bloco
// (não re-resolve por cargo, senão assessor+ecommerce ordenaria errado).
function valorChaveSetor(setor: Setor, p: PessoaSetor): number {
  switch (setor) {
    case "comercial": return p.ligacoes_feitas;
    case "ecommerce": return p.anuncios;
    case "assessoria": return pctNoPrazo(p.tarefas_no_prazo, p.tarefas_com_prazo) ?? -1;
    case "design": return p.artes;
    case "programacao": return p.prog_total;
    default: return -1;
  }
}

async function _getProdutividadeSetorImpl(range: PeriodoRange): Promise<ProdutividadeSetorResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const today = formatIsoDate(new Date());
  const since = computeSince(range, today);
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  const sinceStartUtc = new Date(`${since}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = formatIsoDate(tomorrowDate);
  const tomorrowStartUtc = new Date(`${tomorrow}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();

  const [
    { data: profilesData },
    { data: ligacoesData },
    { data: anunciosData },
    { data: entreguesData },
    { data: atrasadasData },
    { data: postagensData },
    { data: artesData },
    { data: progData },
  ] = await Promise.all([
    sb.from("profiles").select("id, nome, role, especialidade").eq("ativo", true).order("nome"),
    sb.from("ligacoes").select("colaborador_id, status, direcao")
      .is("arquivado_em", null).eq("direcao", "saida")
      .gte("iniciada_em", sinceStartUtc).lt("iniciada_em", tomorrowStartUtc)
      .not("colaborador_id", "is", null),
    sb.from("anuncios_ecommerce").select("colaborador_id, quantidade")
      .is("arquivado_em", null).gte("data", since).lte("data", today)
      .not("colaborador_id", "is", null),
    sb.from("tasks").select("atribuido_a, due_date, completed_at")
      .eq("status", "postada").gte("completed_at", sinceStartUtc).lt("completed_at", tomorrowStartUtc)
      .not("atribuido_a", "is", null),
    sb.from("tasks").select("atribuido_a")
      .is("deleted_at", null).neq("status", "postada").lt("due_date", today)
      .not("atribuido_a", "is", null),
    sb.from("social_media_posts").select("criado_por")
      .is("archived_at", null).eq("status", "publicado")
      .gte("publicado_em", sinceStartUtc).lt("publicado_em", tomorrowStartUtc)
      .not("criado_por", "is", null),
    sb.from("design_artes").select("criado_por")
      .is("archived_at", null).eq("status", "aprovado")
      .gte("aprovado_em", sinceStartUtc).lt("aprovado_em", tomorrowStartUtc)
      .not("criado_por", "is", null),
    sb.from("lancamentos_programacao").select("colaborador_id, tipo, quantidade")
      .is("arquivado_em", null).gte("data", since).lte("data", today)
      .not("colaborador_id", "is", null),
  ]);

  const profiles = (profilesData ?? []) as Array<{ id: string; nome: string; role: string; especialidade: string | null }>;

  const zero = (): MetricaCrua => ({
    ligacoes_feitas: 0, ligacoes_atendidas: 0, anuncios: 0,
    tarefas_entregues: 0, tarefas_no_prazo: 0, tarefas_com_prazo: 0,
    tarefas_atrasadas: 0, postagens: 0, artes: 0,
    prog_crm: 0, prog_usuarios: 0, prog_sistemas: 0, prog_total: 0,
  });
  const cruas = new Map<string, MetricaCrua>();
  const get = (id: string) => { let m = cruas.get(id); if (!m) { m = zero(); cruas.set(id, m); } return m; };

  for (const l of (ligacoesData ?? []) as Array<{ colaborador_id: string; status: string }>) {
    const m = get(l.colaborador_id); m.ligacoes_feitas++; if (l.status === "atendida") m.ligacoes_atendidas++;
  }
  for (const a of (anunciosData ?? []) as Array<{ colaborador_id: string; quantidade: number }>) {
    get(a.colaborador_id).anuncios += Number(a.quantidade ?? 0);
  }
  for (const t of (entreguesData ?? []) as Array<{ atribuido_a: string; due_date: string | null; completed_at: string | null }>) {
    const m = get(t.atribuido_a); m.tarefas_entregues++;
    if (t.due_date) {
      m.tarefas_com_prazo++;
      if (t.completed_at && t.completed_at.slice(0, 10) <= t.due_date) m.tarefas_no_prazo++;
    }
  }
  for (const t of (atrasadasData ?? []) as Array<{ atribuido_a: string }>) {
    get(t.atribuido_a).tarefas_atrasadas++;
  }
  for (const p of (postagensData ?? []) as Array<{ criado_por: string }>) {
    get(p.criado_por).postagens++;
  }
  for (const a of (artesData ?? []) as Array<{ criado_por: string }>) {
    get(a.criado_por).artes++;
  }
  for (const l of (progData ?? []) as Array<{ colaborador_id: string; tipo: string; quantidade: number }>) {
    const m = get(l.colaborador_id);
    const qtd = Number(l.quantidade ?? 0);
    m.prog_total += qtd;
    if (l.tipo === "crm_conectado") m.prog_crm += qtd;
    else if (l.tipo === "usuario_criado") m.prog_usuarios += qtd;
    else if (l.tipo === "sistema_feito") m.prog_sistemas += qtd;
  }

  const porUsuario: Record<string, MetricaPessoa> = {};
  const pessoasPorSetor = new Map<Setor, PessoaSetor[]>();
  for (const prof of profiles) {
    const crua = cruas.get(prof.id) ?? zero();
    const metrica = resolveMetricaPessoa(prof.role, prof.especialidade, crua);
    porUsuario[prof.id] = metrica;
    if (metrica.setor && SETORES_PAINEL.includes(metrica.setor)) {
      const arr = pessoasPorSetor.get(metrica.setor) ?? [];
      arr.push({ user_id: prof.id, nome: prof.nome, role: prof.role, ...crua });
      pessoasPorSetor.set(metrica.setor, arr);
    }
  }

  const setores: BlocoSetor[] = SETORES_PAINEL.filter((s) => pessoasPorSetor.has(s)).map((setor) => ({
    setor,
    titulo: TITULO_SETOR[setor],
    pessoas: (pessoasPorSetor.get(setor) ?? []).sort((a, b) => valorChaveSetor(setor, b) - valorChaveSetor(setor, a)),
  }));

  return { porUsuario, setores };
}

/** Produtividade por setor no período (cacheado 5min, tag dashboard). */
export async function getProdutividadeSetor(range: PeriodoRange = "dia"): Promise<ProdutividadeSetorResult> {
  const cached = unstable_cache(
    async (r: string) => _getProdutividadeSetorImpl(r as PeriodoRange),
    ["produtividade-setor-v2"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(range);
}
