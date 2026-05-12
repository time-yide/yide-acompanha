// Queries específicas do painel do cliente (lado externo). Usa service-role
// — clientId vem da sessão validada por requireClientPortalAuth(), nunca
// confiamos em valor do form.

import { createServiceRoleClient } from "@/lib/supabase/service-role";

export interface SelfSatisfactionRow {
  score: number;
  comentario: string | null;
  submitted_at: string;
}

export async function getLastSelfSatisfaction(
  clientId: string,
): Promise<SelfSatisfactionRow | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("client_self_satisfaction")
    .select("score, comentario, submitted_at")
    .eq("client_id", clientId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as SelfSatisfactionRow | null) ?? null;
}

export interface AgencyPerceptionRow {
  score_final: number;
  cor_final: "verde" | "amarelo" | "vermelho";
  semana_iso: string;
}

/**
 * Percepção da equipe sobre o cliente. Pega a última `satisfaction_synthesis`
 * gerada (cada uma cobre uma semana). Versão "sanitizada" — não devolve
 * `resumo_ia` nem `acao_sugerida` (são internos), só o score e a cor.
 */
export async function getLastAgencyPerception(
  clientId: string,
): Promise<AgencyPerceptionRow | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("satisfaction_synthesis")
    .select("score_final, cor_final, semana_iso")
    .eq("client_id", clientId)
    .order("semana_iso", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as AgencyPerceptionRow | null) ?? null;
}

export interface ReuniaoListItem {
  id: string;
  titulo: string;
  starts_at: string;
  duracao_segundos: number | null;
  resumo_preview: string | null;
  summary_ready: boolean;
}

/**
 * Últimas reuniões do cliente. Retorna até `limit` itens com resumo curto.
 * Filtra apenas reuniões com status terminal ou em progresso de pós-call
 * (pra não mostrar reunião que ainda nem aconteceu, ou cancelada).
 */
export async function getLastMeetingsForClient(
  clientId: string,
  limit = 5,
): Promise<ReuniaoListItem[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("meetings")
    .select("id, titulo, starts_at, duracao_segundos, resumo_preview, summary_ready, status")
    .eq("client_id", clientId)
    // "completed" = reunião finalizada com resumo pronto.
    // "processing" = transcrição/AI rodando — mostra mesmo assim, com flag
    // `summary_ready` o componente decide se renderiza o preview ou um placeholder.
    .in("status", ["completed", "processing"])
    .order("starts_at", { ascending: false })
    .limit(limit);

  const rows = (data ?? []) as Array<{
    id: string;
    titulo: string;
    starts_at: string;
    duracao_segundos: number | null;
    resumo_preview: string | null;
    summary_ready: boolean;
  }>;

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    starts_at: r.starts_at,
    duracao_segundos: r.duracao_segundos,
    resumo_preview: r.resumo_preview,
    summary_ready: r.summary_ready,
  }));
}
