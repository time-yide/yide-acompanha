import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendCobrancaPagamentoAlerta(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: pendentes } = await sb
    .from("client_payments")
    .select("id, client_id, mes_referencia, observacao, clients(nome)")
    .eq("mes_referencia", mesAtual)
    .eq("status", "pendente");

  if (!pendentes || pendentes.length === 0) return { sent: 0, skipped: 0 };

  interface PayRow {
    id: string;
    client_id: string;
    mes_referencia: string;
    observacao: string | null;
    clients: { nome: string } | null;
  }
  const rows = pendentes as PayRow[];

  const { data: financeiros } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("role", ["financeiro", "adm", "socio"])
    .eq("ativo", true)
    .not("telefone", "is", null);

  if (!financeiros || financeiros.length === 0) return { sent: 0, skipped: rows.length };

  const mesLabel = new Date(now.getFullYear(), now.getMonth(), 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const lines = [
    `💸 *Cobranças pendentes — ${mesLabel}*`,
    ``,
    `*${rows.length}* cliente(s) com pagamento pendente:`,
    ``,
  ];

  for (const p of rows.slice(0, 15)) {
    lines.push(`• *${p.clients?.nome ?? "Cliente"}*`);
  }

  if (rows.length > 15) {
    lines.push(`  … e mais ${rows.length - 15}`);
  }

  lines.push(``);
  lines.push(`Verifique e atualize o status dos pagamentos! 🏦`);

  const msg = lines.join("\n");
  let sent = 0;
  let skipped = 0;

  interface Fin { id: string; nome: string; telefone: string | null }
  for (const f of financeiros as Fin[]) {
    if (!f.telefone) { skipped++; continue; }
    const result = await sendWhatsAppMessage(f.telefone, msg);
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
