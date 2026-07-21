import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { agregarPergunta, type Agregacao } from "./aggregate";
import type { PesquisaRow, PerguntaRow } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface PesquisaComContagem extends PesquisaRow {
  total_destinatarios: number;
  total_respondidos: number;
}

/**
 * Encerra on-read pesquisas cujo prazo já passou (best-effort). Mantém o card e
 * os resultados coerentes mesmo sem cron.
 */
async function fecharVencidas(sb: SB): Promise<void> {
  const agora = new Date().toISOString();
  await sb
    .from("pesquisas")
    .update({ status: "encerrada", encerrada_em: agora })
    .eq("status", "aberta")
    .not("prazo", "is", null)
    .lt("prazo", agora)
    .is("deleted_at", null);
}

async function _listMinhasPesquisasImpl(criadorId: string): Promise<PesquisaComContagem[]> {
  const sb = createServiceRoleClient() as SB;
  await fecharVencidas(sb);
  const { data: pesquisas } = await sb
    .from("pesquisas")
    .select("id, titulo, descricao, anonima, status, criado_por, disparada_em, prazo, encerrada_em, created_at")
    .eq("criado_por", criadorId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const list = (pesquisas ?? []) as PesquisaRow[];
  if (list.length === 0) return [];

  const ids = list.map((p) => p.id);
  const { data: dests } = await sb
    .from("pesquisa_destinatarios")
    .select("pesquisa_id, respondeu_em")
    .in("pesquisa_id", ids);

  const totby = new Map<string, number>();
  const respby = new Map<string, number>();
  for (const d of (dests ?? []) as Array<{ pesquisa_id: string; respondeu_em: string | null }>) {
    totby.set(d.pesquisa_id, (totby.get(d.pesquisa_id) ?? 0) + 1);
    if (d.respondeu_em) respby.set(d.pesquisa_id, (respby.get(d.pesquisa_id) ?? 0) + 1);
  }
  return list.map((p) => ({
    ...p,
    total_destinatarios: totby.get(p.id) ?? 0,
    total_respondidos: respby.get(p.id) ?? 0,
  }));
}

/** Pesquisas que EU criei (cacheado, tag "pesquisas"). */
export async function listMinhasPesquisas(criadorId: string): Promise<PesquisaComContagem[]> {
  const cached = unstable_cache(
    async (id: string) => _listMinhasPesquisasImpl(id),
    ["pesquisas-minhas-v1"],
    { revalidate: 30, tags: ["pesquisas"] },
  );
  return cached(criadorId);
}

/**
 * Pesquisas abertas em que SOU destinatário e ainda não respondi.
 * FORA do cache: é per-usuário (mesmo tratamento dos dados per-user do calendário).
 */
export async function listPesquisasPendentes(userId: string): Promise<PesquisaRow[]> {
  const sb = createServiceRoleClient() as SB;
  await fecharVencidas(sb);
  const { data: dests } = await sb
    .from("pesquisa_destinatarios")
    .select("pesquisa_id")
    .eq("user_id", userId)
    .is("respondeu_em", null);
  const ids = ((dests ?? []) as Array<{ pesquisa_id: string }>).map((d) => d.pesquisa_id);
  if (ids.length === 0) return [];
  const { data } = await sb
    .from("pesquisas")
    .select("id, titulo, descricao, anonima, status, criado_por, disparada_em, prazo, encerrada_em, created_at")
    .in("id", ids)
    .eq("status", "aberta")
    .is("deleted_at", null)
    .order("disparada_em", { ascending: false });
  return (data ?? []) as PesquisaRow[];
}

export async function contarPendentes(userId: string): Promise<number> {
  return (await listPesquisasPendentes(userId)).length;
}

export async function getPesquisaComPerguntas(
  id: string,
): Promise<{ pesquisa: PesquisaRow; perguntas: PerguntaRow[] } | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: pesquisa } = await sb
    .from("pesquisas")
    .select("id, titulo, descricao, anonima, status, criado_por, disparada_em, prazo, encerrada_em, created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!pesquisa) return null;
  const { data: perguntas } = await sb
    .from("pesquisa_perguntas")
    .select("id, pesquisa_id, ordem, tipo, enunciado, opcoes, escala_min, escala_max, obrigatoria")
    .eq("pesquisa_id", id)
    .order("ordem", { ascending: true });
  return { pesquisa: pesquisa as PesquisaRow, perguntas: (perguntas ?? []) as PerguntaRow[] };
}

export interface ResultadoPergunta {
  pergunta: PerguntaRow;
  agregacao: Agregacao;
}

export interface Resultados {
  pesquisa: PesquisaRow;
  perguntas: ResultadoPergunta[];
  total_destinatarios: number;
  total_respondidos: number;
}

export async function getResultados(id: string): Promise<Resultados | null> {
  const sb = createServiceRoleClient() as SB;
  await fecharVencidas(sb);
  const base = await getPesquisaComPerguntas(id);
  if (!base) return null;

  const { data: respostas } = await sb
    .from("pesquisa_respostas")
    .select("pergunta_id, valor")
    .eq("pesquisa_id", id);
  const byPergunta = new Map<string, Array<Record<string, unknown>>>();
  for (const r of (respostas ?? []) as Array<{ pergunta_id: string; valor: Record<string, unknown> }>) {
    const arr = byPergunta.get(r.pergunta_id) ?? [];
    arr.push(r.valor);
    byPergunta.set(r.pergunta_id, arr);
  }

  const { data: dests } = await sb
    .from("pesquisa_destinatarios")
    .select("respondeu_em")
    .eq("pesquisa_id", id);
  const destArr = (dests ?? []) as Array<{ respondeu_em: string | null }>;

  return {
    pesquisa: base.pesquisa,
    perguntas: base.perguntas.map((p) => ({
      pergunta: p,
      agregacao: agregarPergunta(p, byPergunta.get(p.id) ?? []),
    })),
    total_destinatarios: destArr.length,
    total_respondidos: destArr.filter((d) => d.respondeu_em).length,
  };
}

/** O user pode responder? (é destinatário, pesquisa aberta, ainda não respondeu) */
export async function podeResponder(pesquisaId: string, userId: string): Promise<boolean> {
  const sb = createServiceRoleClient() as SB;
  const { data: pesquisa } = await sb
    .from("pesquisas")
    .select("status")
    .eq("id", pesquisaId)
    .is("deleted_at", null)
    .single();
  if (!pesquisa || pesquisa.status !== "aberta") return false;
  const { data: dest } = await sb
    .from("pesquisa_destinatarios")
    .select("respondeu_em")
    .eq("pesquisa_id", pesquisaId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!dest && !dest.respondeu_em;
}
