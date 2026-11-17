import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

function getCurrentWeekIso(): string {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - jan1.getTime()) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function sendSatisfacaoBaixaAlerta(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;
  const semana = getCurrentWeekIso();

  const { data: syntheses } = await sb
    .from("satisfaction_synthesis")
    .select("id, client_id, score_final, cor_final, resumo_ia, acao_sugerida, clients(nome, assessor_id)")
    .eq("semana_iso", semana)
    .eq("cor_final", "vermelho");

  if (!syntheses || syntheses.length === 0) return { sent: 0, skipped: 0 };

  interface SynthRow {
    id: string;
    client_id: string;
    score_final: number;
    cor_final: string;
    resumo_ia: string;
    acao_sugerida: string | null;
    clients: { nome: string; assessor_id: string | null } | null;
  }
  const rows = syntheses as SynthRow[];

  const { data: admins } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("role", ["adm", "socio"])
    .eq("ativo", true)
    .not("telefone", "is", null);

  if (!admins || admins.length === 0) return { sent: 0, skipped: rows.length };

  const lines = [
    `🔴 *Alerta de satisfação!*`,
    ``,
    `*${rows.length}* cliente(s) com avaliação vermelha esta semana:`,
    ``,
  ];

  for (const s of rows.slice(0, 10)) {
    lines.push(`• *${s.clients?.nome ?? "Cliente"}* — nota ${s.score_final}`);
    if (s.resumo_ia) {
      const resumo = s.resumo_ia.length > 80 ? s.resumo_ia.slice(0, 80) + "…" : s.resumo_ia;
      lines.push(`  💬 ${resumo}`);
    }
  }

  if (rows.length > 10) {
    lines.push(`  … e mais ${rows.length - 10} cliente(s)`);
  }

  lines.push(``);
  lines.push(`Atenção urgente necessária! ⚡`);

  const msg = lines.join("\n");
  let sent = 0;
  let skipped = 0;

  interface Admin { id: string; nome: string; telefone: string | null }
  for (const adm of admins as Admin[]) {
    if (!adm.telefone) { skipped++; continue; }
    const result = await sendWhatsAppMessage(adm.telefone, msg);
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
