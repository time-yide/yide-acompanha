import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { summarizeMeeting } from "@/lib/reunioes/ai/summarizer";
import { MEETINGS_CACHE_TAG } from "@/lib/reunioes/queries";
import type { TranscriptSegment } from "@/lib/reunioes/tipos";

/**
 * Worker de sumarização — independente do worker de transcrição da Fase 2.
 *
 * Estratégia: detecta transcrições que ainda não têm summary correspondente
 * e processa. Funciona com qualquer transcrição que existir, vinda da Fase 2
 * (cron de transcription) ou de qualquer outra fonte.
 *
 * Cron schedule: every minute (`* * * * *`).
 *
 * Autenticado por CRON_SECRET via Authorization header.
 */

const MAX_PER_RUN = 2; // 2 reuniões por minuto pra caber em 60s timeout Vercel

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ skipped: "no_anthropic_key" });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Pega transcrições sem summary — filtrando via NOT EXISTS no app side
  // porque Supabase JS não suporta WHERE NOT EXISTS direto.
  const { data: transcriptsData, error: transcriptsError } = await sb
    .from("meeting_transcripts")
    .select(`
      id, meeting_id, texto_completo, segments, idioma,
      meeting:meetings!meeting_transcripts_meeting_id_fkey(
        id, titulo, descricao, status, lead_id, client_id,
        lead:leads!meetings_lead_id_fkey(nome_prospect),
        client:clients!meetings_client_id_fkey(nome),
        participantes:meeting_participants(id, nome, email, papel, profile_id),
        summary:meeting_summaries(id)
      )
    `)
    .order("created_at", { ascending: true })
    .limit(MAX_PER_RUN * 4); // pega mais e filtra app-side

  if (transcriptsError) {
    const msg = transcriptsError.message ?? "";
    if (msg.includes("schema cache") || msg.includes("does not exist")) {
      return NextResponse.json({ skipped: "migration_pending" });
    }
    return NextResponse.json({ error: transcriptsError.message }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transcripts = (transcriptsData ?? []) as Array<any>;

  // Filtra os que ainda não têm summary
  const pendentes = transcripts
    .filter((t) => {
      const summaries = (t.meeting?.summary ?? []) as Array<{ id: string }>;
      return summaries.length === 0;
    })
    .slice(0, MAX_PER_RUN);

  if (pendentes.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  const resultados: Array<{ meeting_id: string; ok: boolean; error?: string; custo_brl_centavos?: number }> = [];

  for (const t of pendentes) {
    const meeting = t.meeting;
    if (!meeting) {
      resultados.push({ meeting_id: t.meeting_id, ok: false, error: "meeting null" });
      continue;
    }

    try {
      const result = await summarizeMeeting({
        transcript: {
          texto_completo: t.texto_completo,
          segments: (t.segments ?? []) as TranscriptSegment[],
        },
        meeting: {
          titulo: meeting.titulo,
          descricao: meeting.descricao,
          contexto_lead: meeting.lead?.nome_prospect ?? null,
          contexto_cliente: meeting.client?.nome ?? null,
        },
        participantes: (meeting.participantes ?? []).map(
          (p: { id: string; nome: string; email: string | null; papel: string }) => ({
            id: p.id,
            nome: p.nome,
            email: p.email,
            papel: p.papel,
          }),
        ),
      });

      // 1. Salva summary
      await sb.from("meeting_summaries").insert({
        meeting_id: t.meeting_id,
        provider: result.summary.provider,
        modelo: result.summary.modelo,
        resumo_geral: result.summary.resumo_geral,
        decisoes: result.summary.decisoes,
        proximos_passos: result.summary.proximos_passos,
        topicos: result.summary.topicos,
        insights: result.summary.insights,
        sentimento_score: result.summary.sentimento_score,
        custo_estimado_centavos: result.custo_estimado_centavos,
      });

      // 2. Aplica speaker attribution na transcrição (atualiza segments)
      const attribution = result.speaker_attribution ?? {};
      if (Object.keys(attribution).length > 0) {
        const segments = (t.segments ?? []) as TranscriptSegment[];
        const updatedSegments = segments.map((s) => ({
          ...s,
          speaker: attribution[s.speaker] ?? s.speaker,
        }));
        await sb
          .from("meeting_transcripts")
          .update({ segments: updatedSegments })
          .eq("id", t.id);
      }

      // 3. Resolve atribuido_a_email → profile_id pra cada extracted_task
      const tasksToInsert = await resolveTaskAssignees(sb, t.meeting_id, result.extracted_tasks);
      if (tasksToInsert.length > 0) {
        await sb.from("meeting_extracted_tasks").insert(tasksToInsert);
      }

      // 4. Atualiza flags no meeting
      await sb
        .from("meetings")
        .update({
          summary_ready: true,
          insights_ready: true,
          status: "completed",
        })
        .eq("id", t.meeting_id);

      resultados.push({
        meeting_id: t.meeting_id,
        ok: true,
        custo_brl_centavos: result.custo_estimado_brl_centavos,
      });
    } catch (e) {
      const errMsg = (e as Error).message ?? String(e);
      console.error(`[process-summarization-jobs] meeting=${t.meeting_id}:`, errMsg);
      resultados.push({ meeting_id: t.meeting_id, ok: false, error: errMsg });
    }
  }

  if (resultados.some((r) => r.ok)) {
    revalidateTag(MEETINGS_CACHE_TAG, "default");
  }

  return NextResponse.json({ processed: resultados.length, resultados });
}

/**
 * Pra cada extracted_task com atribuido_a_email, busca o profile_id correspondente.
 * Se não achar, deixa null e a UI mostra "sem responsável" (user pode atribuir manualmente).
 */
async function resolveTaskAssignees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: any,
  meetingId: string,
  tasks: Array<{
    titulo_sugerido: string;
    descricao_sugerida: string | null;
    atribuido_a_sugestao: string | null;
    due_date_sugestao: string | null;
    citacao_origem: string | null;
    timestamp_origem_segundos: number | null;
  }>,
): Promise<Array<Record<string, unknown>>> {
  // Coleta emails únicos
  const emails = [...new Set(tasks.map((t) => t.atribuido_a_sugestao).filter((e): e is string => !!e))];

  let emailToProfileId = new Map<string, string>();
  if (emails.length > 0) {
    const { data: profilesData } = await sb
      .from("profiles")
      .select("id, email")
      .in("email", emails);
    emailToProfileId = new Map(
      ((profilesData ?? []) as Array<{ id: string; email: string }>).map((p) => [p.email.toLowerCase(), p.id]),
    );
  }

  return tasks.map((t) => {
    const email = t.atribuido_a_sugestao?.toLowerCase();
    const profileId = email ? emailToProfileId.get(email) ?? null : null;
    return {
      meeting_id: meetingId,
      titulo_sugerido: t.titulo_sugerido,
      descricao_sugerida: t.descricao_sugerida,
      atribuido_a_sugestao: profileId,
      due_date_sugestao: t.due_date_sugestao,
      citacao_origem: t.citacao_origem,
      timestamp_origem_segundos: t.timestamp_origem_segundos,
      estado: "sugerida",
    };
  });
}
