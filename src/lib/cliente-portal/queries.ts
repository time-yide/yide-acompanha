// Queries específicas do painel do cliente (lado externo). Usa service-role
// - clientId vem da sessão validada por requireClientPortalAuth(), nunca
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
 * gerada (cada uma cobre uma semana). Versão "sanitizada" - não devolve
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
    // Opt-in: só reuniões que a equipe liberou explicitamente pro portal.
    // Sem isso, TODA reunião do cliente vazaria (inclusive conversa interna).
    .eq("visivel_cliente", true)
    // Reuniões excluídas (soft-delete) não aparecem pro cliente.
    .is("deleted_at", null)
    // "completed" = reunião finalizada com resumo pronto.
    // "processing" = transcrição/AI rodando - mostra mesmo assim, com flag
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

export interface ReuniaoTopicoCliente {
  titulo: string;
  start_seconds: number;
  resumo: string;
}

/**
 * Detalhe da reunião para o PORTAL DO CLIENTE ("versão cliente"): gravação +
 * resumo + decisões + próximos passos + tópicos + tarefas (só título/prazo).
 * NUNCA inclui a transcrição crua nem os insights internos. Só retorna se a
 * reunião é do próprio cliente E está liberada (visivel_cliente).
 */
export interface ReuniaoDetalheCliente {
  id: string;
  titulo: string;
  starts_at: string;
  duracao_segundos: number | null;
  recording: { audio_url: string | null; formato: string | null; size_bytes: number | null; duracao_segundos: number | null } | null;
  resumo_geral: string | null;
  decisoes: string[];
  proximos_passos: string[];
  topicos: ReuniaoTopicoCliente[];
  tarefas: Array<{ titulo: string; due_date: string | null }>;
}

export async function getMeetingForClientPortal(
  clientId: string,
  meetingId: string,
): Promise<ReuniaoDetalheCliente | null> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  // Gate: pertence ao cliente logado E liberada pra ele. Sem isso, um cliente
  // poderia abrir /cliente/reunioes/<id> de outra reunião pelo id.
  const { data: mt } = await sb
    .from("meetings")
    .select("id, titulo, starts_at, duracao_segundos")
    .eq("id", meetingId)
    .eq("client_id", clientId)
    .eq("visivel_cliente", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!mt) return null;

  const [recRes, smRes, etsRes] = await Promise.all([
    sb.from("meeting_recordings").select("audio_url, formato, size_bytes, duracao_segundos").eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("meeting_summaries").select("resumo_geral, decisoes, proximos_passos, topicos").eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    // Só tarefas não descartadas; expõe apenas título + prazo (resto é interno).
    sb.from("meeting_extracted_tasks").select("titulo_sugerido, due_date_sugestao, estado").eq("meeting_id", meetingId).neq("estado", "descartada").order("created_at", { ascending: true }),
  ]);
  const rec = recRes.data;
  const sm = smRes.data;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ets = (etsRes.data ?? []) as any[];

  return {
    id: mt.id,
    titulo: mt.titulo,
    starts_at: mt.starts_at,
    duracao_segundos: mt.duracao_segundos ?? null,
    recording: rec
      ? { audio_url: rec.audio_url ?? null, formato: rec.formato ?? null, size_bytes: rec.size_bytes ?? null, duracao_segundos: rec.duracao_segundos ?? null }
      : null,
    resumo_geral: sm?.resumo_geral ?? null,
    decisoes: (sm?.decisoes as string[] | null) ?? [],
    proximos_passos: (sm?.proximos_passos as string[] | null) ?? [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    topicos: (((sm?.topicos as any[] | null) ?? []).map((t) => ({ titulo: String(t.titulo ?? ""), start_seconds: Number(t.start_seconds ?? 0), resumo: String(t.resumo ?? "") }))),
    tarefas: ets.map((t) => ({ titulo: String(t.titulo_sugerido ?? ""), due_date: (t.due_date_sugestao as string | null) ?? null })),
  };
}

/**
 * Status simplificado mostrado pro cliente (sem jargão interno).
 * Mapping: status interno → label client-facing.
 */
export type PortalTaskStatus =
  | "em_producao"
  | "em_revisao"
  | "aprovada"
  | "agendada"
  | "publicada"
  | "concluida";

export interface PortalTaskRow {
  id: string;
  titulo: string;
  tipo: "geral" | "video" | "arte";
  status: PortalTaskStatus;
  /** Link de entrega (drive_link), só quando aprovada/publicada/agendada/concluída. */
  drive_link: string | null;
  /** Timestamp da última transição relevante - usado pra ordenar + "há X dias". */
  ultima_atualizacao: string;
}

/**
 * Lista tarefas que o cliente vê no portal - com fields sanitizados (NÃO
 * expõe prazo, prioridade, responsável, descrição, etc). Decisão da
 * Yasmin: cliente vê o que ESTÁ SENDO FEITO e o que FOI ENTREGUE, sem
 * info de gerenciamento interno.
 *
 * Status que NÃO mostra: aberta (ainda não começou), alteracao (problema
 * interno entre time e cliente - não polui o portal).
 * Status concluida só mostra pra tipo geral (vídeo/arte concluida vira
 * em_aprovacao/aprovada/postada - não chega no portal).
 *
 * Retorna até 50 tarefas - primeiro as em andamento, depois as concluídas
 * dos últimos 60 dias.
 */
export async function getTarefasForPortal(clientId: string): Promise<PortalTaskRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const sinceIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await sb
    .from("tasks")
    .select("id, titulo, tipo, status, drive_link, updated_at, completed_at, aprovada_em, created_at")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .in("status", ["em_andamento", "em_aprovacao", "aprovada", "agendado", "postada", "concluida"])
    .gte("updated_at", sinceIso)
    .order("updated_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as Array<{
    id: string;
    titulo: string;
    tipo: "geral" | "video" | "arte" | null;
    status:
      | "em_andamento"
      | "em_aprovacao"
      | "aprovada"
      | "agendado"
      | "postada"
      | "concluida";
    drive_link: string | null;
    updated_at: string;
    completed_at: string | null;
    aprovada_em: string | null;
    created_at: string;
  }>;

  // Mapeia status interno → status portal
  function mapStatus(
    statusInt: typeof rows[number]["status"],
    tipo: typeof rows[number]["tipo"],
  ): PortalTaskStatus | null {
    switch (statusInt) {
      case "em_andamento":
        return "em_producao";
      case "em_aprovacao":
        return "em_revisao";
      case "aprovada":
        return "aprovada";
      case "agendado":
        return "agendada";
      case "postada":
        return "publicada";
      case "concluida":
        // Tarefas tipo "video" ou "arte" não param em concluida no portal -
        // viram em_aprovacao/aprovada/postada. Concluida pro portal só faz
        // sentido pra tipo "geral".
        return tipo === "video" || tipo === "arte" ? null : "concluida";
      default:
        return null;
    }
  }

  const out: PortalTaskRow[] = [];
  for (const r of rows) {
    const status = mapStatus(r.status, r.tipo);
    if (!status) continue;
    out.push({
      id: r.id,
      titulo: r.titulo,
      tipo: r.tipo ?? "geral",
      status,
      drive_link: r.drive_link,
      ultima_atualizacao: r.aprovada_em ?? r.completed_at ?? r.updated_at,
    });
  }
  return out;
}
