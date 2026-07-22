// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { PerguntaRow } from "./schema";

export const PESQUISA_LOCK_TAG = "pesquisa-lock";

export interface PesquisaLockState {
  blocked: boolean;
  pesquisa: { id: string; titulo: string; descricao: string | null } | null;
  perguntas: PerguntaRow[];
}

const EMPTY: PesquisaLockState = { blocked: false, pesquisa: null, perguntas: [] };

/**
 * Verifica se o usuário tem uma pesquisa BLOQUEANTE aberta ainda não respondida.
 * Layout authed chama a cada navegação — cacheado 30s por usuário; a action de
 * responder revalida a tag pra o gate sumir na hora.
 */
export async function checkPesquisaLock(userId: string): Promise<PesquisaLockState> {
  const cached = unstable_cache(
    async (uid: string) => _checkPesquisaLockImpl(uid),
    ["pesquisa-lock"],
    { revalidate: 30, tags: [PESQUISA_LOCK_TAG] },
  );
  return cached(userId);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

async function _checkPesquisaLockImpl(userId: string): Promise<PesquisaLockState> {
  const admin = createServiceRoleClient() as SB;

  // 1) Destinatários pendentes do usuário, juntando a pesquisa (aberta + bloqueante).
  //    !inner garante que só volta linha se a pesquisa casar com os filtros.
  const { data: dests } = await admin
    .from("pesquisa_destinatarios")
    .select(
      "pesquisa_id, respondeu_em, pesquisas!inner(id, titulo, descricao, status, bloqueante, deleted_at, disparada_em)",
    )
    .eq("user_id", userId)
    .is("respondeu_em", null)
    .eq("pesquisas.status", "aberta")
    .eq("pesquisas.bloqueante", true)
    .is("pesquisas.deleted_at", null);

  type Row = {
    pesquisa_id: string;
    pesquisas: {
      id: string;
      titulo: string;
      descricao: string | null;
      disparada_em: string | null;
    };
  };
  const rows = (dests ?? []) as unknown as Row[];
  if (rows.length === 0) return EMPTY;

  // Mais antiga primeiro (disparada_em asc; null/inválido por último).
  const ts = (v: string | null) => {
    if (!v) return Infinity;
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? Infinity : t;
  };
  rows.sort((a, b) => ts(a.pesquisas.disparada_em) - ts(b.pesquisas.disparada_em));
  const alvo = rows[0].pesquisas;

  // 2) Carrega as perguntas na ordem.
  const { data: perguntasRaw } = await admin
    .from("pesquisa_perguntas")
    .select("id, pesquisa_id, ordem, tipo, enunciado, opcoes, escala_min, escala_max, obrigatoria")
    .eq("pesquisa_id", alvo.id)
    .order("ordem");

  const perguntas = (perguntasRaw ?? []) as PerguntaRow[];

  return {
    blocked: true,
    pesquisa: { id: alvo.id, titulo: alvo.titulo, descricao: alvo.descricao },
    perguntas,
  };
}
