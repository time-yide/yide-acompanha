import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { CategoriaEquipamento, StatusEquipamento } from "./core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface EquipamentoRow {
  id: string;
  codigo: string;
  nome: string;
  categoria: CategoriaEquipamento;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  status: StatusEquipamento;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  observacao: string | null;
}

export interface PessoaOpcao {
  id: string;
  nome: string;
}

export interface MinhaVistoria {
  vistoriaId: string | null;
  concluidaEm: string | null;
  equipamentos: EquipamentoRow[];
  lidosIds: string[];
}

export interface ConferenciaPessoa {
  responsavel_id: string;
  nome: string;
  total: number;
  conferidos: number;
  concluidaEm: string | null;
}

const COLUNAS_EQUIPAMENTO =
  "id, codigo, nome, categoria, marca, modelo, numero_serie, status, responsavel_id, observacao, responsavel:profiles!equipamentos_responsavel_id_fkey(nome)";

type EquipamentoBruto = Omit<EquipamentoRow, "responsavel_nome"> & { responsavel: { nome: string } | null };

function mapearEquipamento(e: EquipamentoBruto): EquipamentoRow {
  const { responsavel, ...resto } = e;
  return { ...resto, responsavel_nome: responsavel?.nome ?? null };
}

/** Todo o estoque (inclui baixados, pra histórico). */
export async function listEquipamentos(): Promise<EquipamentoRow[]> {
  const sb = createServiceRoleClient() as SB;
  const { data, error } = await sb
    .from("equipamentos")
    .select(COLUNAS_EQUIPAMENTO)
    .order("categoria")
    .order("nome");
  if (error) throw new Error(error.message);
  return ((data ?? []) as EquipamentoBruto[]).map(mapearEquipamento);
}

/** Pessoas ativas pra escolher como responsável. */
export async function listPessoasAtivas(): Promise<PessoaOpcao[]> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb.from("profiles").select("id, nome").eq("ativo", true).order("nome");
  return (data ?? []) as PessoaOpcao[];
}

/** O que está com a pessoa + o que já foi lido nesta semana. */
export async function getMinhaVistoria(userId: string, semana: string): Promise<MinhaVistoria> {
  const sb = createServiceRoleClient() as SB;

  const { data: equipamentos, error } = await sb
    .from("equipamentos")
    .select(COLUNAS_EQUIPAMENTO)
    .eq("responsavel_id", userId)
    .neq("status", "baixado")
    .order("categoria")
    .order("nome");
  if (error) throw new Error(error.message);

  const { data: vistoria } = await sb
    .from("vistorias")
    .select("id, concluida_em")
    .eq("responsavel_id", userId)
    .eq("semana_inicio", semana)
    .maybeSingle();

  let lidosIds: string[] = [];
  if (vistoria) {
    const { data: leituras } = await sb
      .from("vistoria_leituras")
      .select("equipamento_id")
      .eq("vistoria_id", vistoria.id);
    lidosIds = (leituras ?? []).map((l: { equipamento_id: string }) => l.equipamento_id);
  }

  return {
    vistoriaId: vistoria?.id ?? null,
    concluidaEm: vistoria?.concluida_em ?? null,
    equipamentos: ((equipamentos ?? []) as EquipamentoBruto[]).map(mapearEquipamento),
    lidosIds,
  };
}

/** Visão do gestor: quanto cada pessoa com equipamento já conferiu na semana. */
export async function listConferenciaSemana(semana: string): Promise<ConferenciaPessoa[]> {
  const sb = createServiceRoleClient() as SB;

  const { data: itens } = await sb
    .from("equipamentos")
    .select("responsavel_id, responsavel:profiles!equipamentos_responsavel_id_fkey(nome)")
    .not("responsavel_id", "is", null)
    .neq("status", "baixado");

  const porPessoa = new Map<string, ConferenciaPessoa>();
  for (const it of (itens ?? []) as Array<{ responsavel_id: string; responsavel: { nome: string } | null }>) {
    const atual = porPessoa.get(it.responsavel_id);
    if (atual) atual.total++;
    else
      porPessoa.set(it.responsavel_id, {
        responsavel_id: it.responsavel_id,
        nome: it.responsavel?.nome ?? "—",
        total: 1,
        conferidos: 0,
        concluidaEm: null,
      });
  }
  if (porPessoa.size === 0) return [];

  const { data: vistorias } = await sb
    .from("vistorias")
    .select("id, responsavel_id, concluida_em")
    .eq("semana_inicio", semana)
    .in("responsavel_id", [...porPessoa.keys()]);

  for (const v of (vistorias ?? []) as Array<{ id: string; responsavel_id: string; concluida_em: string | null }>) {
    const pessoa = porPessoa.get(v.responsavel_id);
    if (!pessoa) continue;
    pessoa.concluidaEm = v.concluida_em;
    const { count } = await sb
      .from("vistoria_leituras")
      .select("id", { count: "exact", head: true })
      .eq("vistoria_id", v.id);
    pessoa.conferidos = count ?? 0;
  }

  return [...porPessoa.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Etiquetas precisam só de código + nome + categoria. */
export async function listEtiquetas(): Promise<Array<{ codigo: string; nome: string; categoria: string }>> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("equipamentos")
    .select("codigo, nome, categoria")
    .neq("status", "baixado")
    .order("categoria")
    .order("nome");
  return (data ?? []) as Array<{ codigo: string; nome: string; categoria: string }>;
}
