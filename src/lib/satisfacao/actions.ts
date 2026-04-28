"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { synthesizeClientSatisfaction } from "./synthesizer";
import { setColorSchema, setCommentSchema, type SynthesisInput, type SatisfactionColor } from "./schema";
import { currentIsoWeek, previousIsoWeek } from "./iso-week";

interface ActionOk { success: true; triggeredSynthesis?: boolean }
interface ActionErr { error: string }
type ActionResult = ActionOk | ActionErr;

export async function setSatisfactionColorAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = setColorSchema.safeParse({
    client_id: formData.get("client_id"),
    cor: formData.get("cor"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const weekIso = currentIsoWeek();
  const supabase = await createClient();

  const { error } = await supabase
    .from("satisfaction_entries")
    .upsert({
      client_id: parsed.data.client_id,
      autor_id: actor.id,
      papel_autor: actor.role,
      semana_iso: weekIso,
      cor: parsed.data.cor,
    }, { onConflict: "client_id,autor_id,semana_iso" });
  if (error) return { error: error.message };

  // Trigger real-time: conta entries preenchidas; se >= 2 e ainda não tem síntese, sintetizar
  const filledCount = await countFilledForClient(parsed.data.client_id, weekIso);
  let triggeredSynthesis = false;

  if (filledCount >= 2) {
    const existing = await getExistingSynthesis(parsed.data.client_id, weekIso);
    if (!existing) {
      await synthesizeAndStore(parsed.data.client_id, weekIso, actor.id);
      triggeredSynthesis = true;
    }
  }

  revalidatePath("/satisfacao/avaliar");
  revalidatePath("/satisfacao");
  revalidatePath(`/clientes/${parsed.data.client_id}/satisfacao`);
  return { success: true, triggeredSynthesis };
}

export async function setSatisfactionCommentAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = setCommentSchema.safeParse({
    client_id: formData.get("client_id"),
    comentario: formData.get("comentario"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const weekIso = currentIsoWeek();
  const supabase = await createClient();
  const { error } = await supabase
    .from("satisfaction_entries")
    .upsert({
      client_id: parsed.data.client_id,
      autor_id: actor.id,
      papel_autor: actor.role,
      semana_iso: weekIso,
      comentario: parsed.data.comentario ?? null,
    }, { onConflict: "client_id,autor_id,semana_iso" });
  if (error) return { error: error.message };

  return { success: true };
}

// =============================================
// Helpers internos (exportados para o detector também usar)
// =============================================

async function countFilledForClient(clientId: string, weekIso: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count } = await supabase
    .from("satisfaction_entries")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .not("cor", "is", null);
  return count ?? 0;
}

async function getExistingSynthesis(clientId: string, weekIso: string): Promise<{ id: string; cor_final: SatisfactionColor } | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("satisfaction_synthesis")
    .select("id, cor_final")
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .maybeSingle();
  return (data as { id: string; cor_final: SatisfactionColor } | null) ?? null;
}

/**
 * Roda IA, persiste síntese, e dispara churn alert se aplicável.
 * Exportada pra o detector (cron quinta-feira) também usar.
 */
export async function synthesizeAndStore(
  clientId: string,
  weekIso: string,
  sourceUserId?: string,
): Promise<void> {
  const supabase = createServiceRoleClient();

  // Carrega cliente
  const { data: client } = await supabase
    .from("clients")
    .select("id, nome, valor_mensal, data_entrada, servico_contratado")
    .eq("id", clientId)
    .single();
  if (!client) return;

  // Entries da semana
  const { data: entriesRows } = await supabase
    .from("satisfaction_entries")
    .select("papel_autor, cor, comentario")
    .eq("client_id", clientId)
    .eq("semana_iso", weekIso)
    .not("cor", "is", null);
  const currentEntries = ((entriesRows ?? []) as Array<{ papel_autor: string; cor: SatisfactionColor; comentario: string | null }>)
    .map((e) => ({ papel: e.papel_autor, cor: e.cor, comentario: e.comentario }));
  if (currentEntries.length === 0) return;

  // Histórico 4 semanas
  const { data: historyRows } = await supabase
    .from("satisfaction_synthesis")
    .select("semana_iso, cor_final, resumo_ia")
    .eq("client_id", clientId)
    .order("semana_iso", { ascending: false })
    .limit(4);

  const input: SynthesisInput = {
    client: {
      id: (client as { id: string }).id,
      nome: (client as { nome: string }).nome,
      valor_mensal: Number((client as { valor_mensal: number }).valor_mensal),
      data_entrada: (client as { data_entrada: string }).data_entrada,
      servico_contratado: (client as { servico_contratado: string | null }).servico_contratado,
    },
    current_week_iso: weekIso,
    current_entries: currentEntries,
    history_4_weeks: ((historyRows ?? []) as Array<{ semana_iso: string; cor_final: SatisfactionColor; resumo_ia: string }>).map((h) => ({
      semana_iso: h.semana_iso,
      cor_final: h.cor_final,
      resumo_ia: h.resumo_ia,
    })),
  };

  const synthesis = await synthesizeClientSatisfaction(input);
  if (!synthesis) return;

  // Persistir
  const { error } = await supabase
    .from("satisfaction_synthesis")
    .upsert({
      client_id: clientId,
      semana_iso: weekIso,
      score_final: synthesis.score_final,
      cor_final: synthesis.cor_final,
      resumo_ia: synthesis.resumo_ia,
      divergencia_detectada: synthesis.divergencia_detectada,
      acao_sugerida: synthesis.acao_sugerida,
      ai_tokens_used: synthesis.ai_tokens_used,
    }, { onConflict: "client_id,semana_iso" });
  if (error) {
    console.error("[satisfacao] failed to persist synthesis:", error.message);
    return;
  }

  // Detector de churn: 2 vermelhos seguidos
  if (synthesis.cor_final === "vermelho") {
    const previous = previousIsoWeek(weekIso);
    const prev = await getExistingSynthesis(clientId, previous);
    if (prev?.cor_final === "vermelho") {
      const clienteData = client as { nome: string };
      await dispatchNotification({
        evento_tipo: "cliente_perto_churn",
        titulo: `Atenção: ${clienteData.nome} em zona vermelha por 2 semanas`,
        mensagem: synthesis.acao_sugerida ?? "Risco de churn — ação urgente recomendada",
        link: `/clientes/${clientId}/satisfacao`,
        source_user_id: sourceUserId,
      });
    }
  }
}
