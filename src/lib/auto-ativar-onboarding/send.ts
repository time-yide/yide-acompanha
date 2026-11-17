import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendAutoAtivarOnboarding(): Promise<{
  activated: number;
  notified: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: clientesOnb } = await sb
    .from("clients")
    .select("id, nome")
    .eq("status", "em_onboarding");

  if (!clientesOnb || clientesOnb.length === 0) {
    return { activated: 0, notified: 0, skipped: 0 };
  }

  interface ClientRow { id: string; nome: string }
  const clients = clientesOnb as ClientRow[];

  let activated = 0;
  let skipped = 0;
  const activatedNames: string[] = [];

  for (const client of clients) {
    const { data: etapas } = await sb
      .from("client_onboarding_etapas")
      .select("etapa_numero, status")
      .eq("client_id", client.id)
      .lte("etapa_numero", 7);

    if (!etapas || etapas.length === 0) { skipped++; continue; }

    interface Etapa { etapa_numero: number; status: string }
    const rows = etapas as Etapa[];
    const allDone = rows.length >= 7 && rows.every((e) => e.status === "concluido");

    if (!allDone) { skipped++; continue; }

    const { error } = await sb
      .from("clients")
      .update({ status: "ativo" })
      .eq("id", client.id);

    if (!error) {
      activated++;
      activatedNames.push(client.nome);
    } else {
      skipped++;
    }
  }

  if (activatedNames.length === 0) {
    return { activated: 0, notified: 0, skipped };
  }

  const { data: admins } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("role", ["adm", "socio"])
    .eq("ativo", true)
    .not("telefone", "is", null);

  let notified = 0;

  if (admins && admins.length > 0) {
    const lines = [
      `✅ *Onboarding concluído!*`,
      ``,
      `*${activatedNames.length}* cliente(s) ativado(s) automaticamente:`,
      ``,
    ];

    for (const name of activatedNames.slice(0, 10)) {
      lines.push(`• *${name}*`);
    }

    if (activatedNames.length > 10) {
      lines.push(`  … e mais ${activatedNames.length - 10}`);
    }

    lines.push(``);
    lines.push(`Etapas 1-7 concluídas, status atualizado pra ativo! 🎉`);

    const msg = lines.join("\n");

    interface Admin { id: string; nome: string; telefone: string | null }
    for (const adm of admins as Admin[]) {
      if (!adm.telefone) continue;
      const result = await sendWhatsAppMessage(adm.telefone, msg);
      if (result.success) notified++;
    }
  }

  return { activated, notified, skipped };
}
