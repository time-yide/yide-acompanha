import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";
import { formatDateBR, formatTimeBR } from "@/lib/datetime/timezone";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendPautaReuniaoAuto(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).toISOString();
  const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1).toISOString();

  const { data: reunioes } = await sb
    .from("calendar_events")
    .select("id, titulo, inicio, fim, client_id, user_id, clients(nome, assessor_id)")
    .eq("sub_calendar", "agencia")
    .gte("inicio", tomorrowStart)
    .lt("inicio", tomorrowEnd);

  if (!reunioes || reunioes.length === 0) return { sent: 0, skipped: 0 };

  interface ReuniaoRow {
    id: string;
    titulo: string;
    inicio: string;
    fim: string;
    client_id: string | null;
    user_id: string | null;
    clients: { nome: string; assessor_id: string | null } | null;
  }

  let sent = 0;
  let skipped = 0;

  for (const reuniao of reunioes as ReuniaoRow[]) {
    if (!reuniao.client_id) { skipped++; continue; }

    const assessorId = reuniao.clients?.assessor_id ?? reuniao.user_id;
    if (!assessorId) { skipped++; continue; }

    const [tasksRes, postsRes, satRes] = await Promise.all([
      sb
        .from("tasks")
        .select("titulo, status, due_date")
        .eq("client_id", reuniao.client_id)
        .not("status", "in", "(concluida,aprovada,postada,cancelada)")
        .order("due_date", { ascending: true })
        .limit(10),
      sb
        .from("social_media_posts")
        .select("id, status, legenda")
        .eq("client_id", reuniao.client_id)
        .in("status", ["rascunho", "aguardando_aprovacao", "ajustes_solicitados", "agendado"])
        .limit(10),
      sb
        .from("satisfaction_synthesis")
        .select("score_final, cor_final, resumo_ia")
        .eq("client_id", reuniao.client_id)
        .order("semana_iso", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    interface TaskRow { titulo: string; status: string; due_date: string | null }
    interface PostRow { id: string; status: string; legenda: string | null }
    interface SatRow { score_final: number; cor_final: string; resumo_ia: string | null }

    const tarefas = (tasksRes.data ?? []) as TaskRow[];
    const posts = (postsRes.data ?? []) as PostRow[];
    const sat = satRes.data as SatRow | null;

    const clienteNome = reuniao.clients?.nome ?? "Cliente";
    const hora = formatTimeBR(reuniao.inicio);
    const data = formatDateBR(reuniao.inicio.split("T")[0]);

    const lines = [
      `📋 *Pauta da reunião — ${clienteNome}*`,
      `📅 ${data} às ${hora}`,
      ``,
    ];

    if (tarefas.length > 0) {
      lines.push(`*Tarefas pendentes (${tarefas.length}):*`);
      for (const t of tarefas.slice(0, 5)) {
        const prazo = t.due_date ? ` (prazo: ${formatDateBR(t.due_date)})` : "";
        lines.push(`  • ${t.titulo}${prazo}`);
      }
      if (tarefas.length > 5) lines.push(`  … e mais ${tarefas.length - 5}`);
      lines.push(``);
    }

    if (posts.length > 0) {
      const statusCount = new Map<string, number>();
      for (const p of posts) {
        statusCount.set(p.status, (statusCount.get(p.status) ?? 0) + 1);
      }
      lines.push(`*Posts em andamento (${posts.length}):*`);
      for (const [status, count] of statusCount) {
        const label = status.replace(/_/g, " ");
        lines.push(`  • ${count} ${label}`);
      }
      lines.push(``);
    }

    if (sat) {
      const icon = sat.cor_final === "verde" ? "🟢" : sat.cor_final === "amarelo" ? "🟡" : "🔴";
      lines.push(`*Satisfação:* ${icon} ${sat.score_final}/10`);
      if (sat.resumo_ia) {
        const resumo = sat.resumo_ia.length > 80 ? sat.resumo_ia.slice(0, 80) + "…" : sat.resumo_ia;
        lines.push(`  💬 ${resumo}`);
      }
      lines.push(``);
    }

    if (tarefas.length === 0 && posts.length === 0 && !sat) {
      lines.push(`Nenhum dado pendente encontrado.`);
      lines.push(``);
    }

    lines.push(`Boa reunião! 🤝`);

    const { data: profile } = await sb
      .from("profiles")
      .select("telefone")
      .eq("id", assessorId)
      .maybeSingle();

    if (!profile?.telefone) { skipped++; continue; }

    const result = await sendWhatsAppMessage(profile.telefone, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
