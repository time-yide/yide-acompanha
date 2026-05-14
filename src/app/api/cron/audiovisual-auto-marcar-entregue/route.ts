import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import {
  AUDIOVISUAL_PENDENTE_TAG,
  AUDIOVISUAL_CAPTURAS_TAG,
} from "@/lib/audiovisual/queries";
import { formatIsoDate, nowInAppTz } from "@/lib/datetime/timezone";

/**
 * Cron: auto-marcar gravações como entregues após N dias sem entrega manual.
 *
 * Política de produto (decisão da Yasmin):
 *  - Eventos `sub_calendar='videomakers'` que aconteceram há **≥ 7 dias**
 *  - Que ainda não têm captura em `audiovisual_capturas`
 *  - Que têm `client_id` e pelo menos 1 participante (videomaker)
 *  - Sistema cria captura mínima com placeholder e tag de auto-conclusão
 *
 * Schedule sugerido (vercel.json): 1x por dia, ex.: `0 5 * * *`
 *   = 5h UTC = 1h Cuiabá (madrugada, fora do horário de trabalho)
 *
 * Janela:
 *  - Limite INFERIOR: now - 7 dias (eventos mais recentes ainda podem ser entregues)
 *  - Limite SUPERIOR: now - 60 dias (não pega coisas antiquíssimas que podem
 *    ter sido canceladas/esquecidas no calendário — limite conservador)
 *
 * Como reverter: usar `deleteCapturaAction` ou DELETE direto na captura.
 * Audit log marca `acao=create` com `ator_id=null` e
 * `justificativa="Auto-conclusão D+7"`, fácil de filtrar.
 */

const DIAS_PARA_AUTO_MARCAR = 7;
const DIAS_LIMITE_SUPERIOR = 60;
const MAX_PER_RUN = 100; // hard limit pra não travar em backlog grande

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Janela temporal: eventos entre 7 e 60 dias atrás (fuso da app)
  const now = nowInAppTz();
  const limiteInferior = new Date(now.getTime() - DIAS_PARA_AUTO_MARCAR * 86_400_000);
  const limiteSuperior = new Date(now.getTime() - DIAS_LIMITE_SUPERIOR * 86_400_000);

  // 1. Busca candidatos: eventos de gravação dentro da janela, com client_id
  //    e ao menos 1 participante. Sem filtrar capturas ainda (deixa pra etapa 2).
  const { data: eventosData, error: eventosError } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, client_id, participantes_ids")
    .eq("sub_calendar", "videomakers")
    .lt("inicio", limiteInferior.toISOString())
    .gt("inicio", limiteSuperior.toISOString())
    .not("client_id", "is", null)
    .order("inicio", { ascending: true })
    .limit(MAX_PER_RUN * 3); // pega mais e filtra app-side (capturas existentes)

  if (eventosError) {
    return NextResponse.json({ error: eventosError.message }, { status: 500 });
  }

  const eventos = (eventosData ?? []) as Array<{
    id: string;
    titulo: string;
    inicio: string;
    client_id: string;
    participantes_ids: string[] | null;
  }>;

  if (eventos.length === 0) {
    return NextResponse.json({ processed: 0, message: "Nenhum evento elegível" });
  }

  // 2. Filtra os que NÃO têm captura (NOT EXISTS via segundo query)
  const eventoIds = eventos.map((e) => e.id);
  const { data: capturasExistentes } = await sb
    .from("audiovisual_capturas")
    .select("event_id")
    .in("event_id", eventoIds);

  const eventIdsComCaptura = new Set(
    (capturasExistentes ?? []).map((c: { event_id: string }) => c.event_id),
  );

  const elegiveis = eventos
    .filter((e) => !eventIdsComCaptura.has(e.id))
    .filter((e) => (e.participantes_ids ?? []).length > 0)
    .slice(0, MAX_PER_RUN);

  if (elegiveis.length === 0) {
    return NextResponse.json({ processed: 0, message: "Todos já têm captura" });
  }

  const resultados: Array<{
    event_id: string;
    ok: boolean;
    captura_id?: string;
    error?: string;
  }> = [];

  for (const evento of elegiveis) {
    try {
      const videomakerId = evento.participantes_ids?.[0];
      if (!videomakerId) {
        resultados.push({ event_id: evento.id, ok: false, error: "sem videomaker" });
        continue;
      }

      const insertPayload = {
        event_id: evento.id,
        client_id: evento.client_id,
        videomaker_id: videomakerId,
        data_captacao: formatIsoDate(evento.inicio),
        drive_url: "(sem link)",
        qtd_videos: 0,
        qtd_fotos: 0,
        observacoes:
          `[AUTO-MARCADA] Entrega presumida após ${DIAS_PARA_AUTO_MARCAR} dias do evento sem registro manual. ` +
          `Se você acabou de entregar, edite essa captação pra adicionar link do drive e feedback.`,
      };

      const { data: created, error: insertErr } = await sb
        .from("audiovisual_capturas")
        .insert(insertPayload)
        .select("id")
        .single();

      if (insertErr) {
        // Pode ter sido criado entre a query e o insert (race) — ignora
        if (insertErr.message?.includes("uq_audiovisual_capturas_event")) {
          resultados.push({ event_id: evento.id, ok: false, error: "captura criada em paralelo" });
          continue;
        }
        resultados.push({ event_id: evento.id, ok: false, error: insertErr.message });
        continue;
      }

      await logAudit({
        entidade: "audiovisual_capturas",
        entidade_id: created.id,
        acao: "create",
        dados_depois: insertPayload as unknown as Record<string, unknown>,
        ator_id: null, // sistema (cron)
        justificativa: `Auto-conclusão D+${DIAS_PARA_AUTO_MARCAR} (cron audiovisual-auto-marcar-entregue)`,
      });

      resultados.push({ event_id: evento.id, ok: true, captura_id: created.id });
    } catch (e) {
      resultados.push({
        event_id: evento.id,
        ok: false,
        error: (e as Error).message,
      });
    }
  }

  const sucessos = resultados.filter((r) => r.ok).length;
  if (sucessos > 0) {
    revalidateTag(AUDIOVISUAL_PENDENTE_TAG, "default");
    revalidateTag(AUDIOVISUAL_CAPTURAS_TAG, "default");
  }

  return NextResponse.json({
    processed: resultados.length,
    auto_marcadas: sucessos,
    erros: resultados.length - sucessos,
    resultados,
  });
}
