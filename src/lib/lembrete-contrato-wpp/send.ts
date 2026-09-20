import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";
import { env } from "@/lib/env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function sendLembreteContratoWpp(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, contato_principal, grupo_wpp_jid")
    .in("status", ["ativo", "em_onboarding"])
    .not("grupo_wpp_jid", "is", null);

  if (!clients || clients.length === 0) return { sent: 0, skipped: 0 };

  interface ClientRow {
    id: string;
    nome: string;
    contato_principal: string | null;
    grupo_wpp_jid: string | null;
  }

  const clientIds = (clients as ClientRow[]).map((c) => c.id);

  const { data: contracts } = await sb
    .from("client_contract_info")
    .select("client_id, razao_social, cnpj_cpf")
    .in("client_id", clientIds);

  interface ContractRow {
    client_id: string;
    razao_social: string | null;
    cnpj_cpf: string | null;
  }
  const contractMap = new Map<string, ContractRow>();
  for (const c of (contracts ?? []) as ContractRow[]) {
    contractMap.set(c.client_id, c);
  }

  const portalUrl = env.NEXT_PUBLIC_APP_URL;

  let sent = 0;
  let skipped = 0;

  for (const client of clients as ClientRow[]) {
    if (!client.grupo_wpp_jid) { skipped++; continue; }

    const contract = contractMap.get(client.id);
    const hasRazao = contract?.razao_social?.trim();
    const hasCnpj = contract?.cnpj_cpf?.trim();

    if (hasRazao && hasCnpj) { skipped++; continue; }

    const nome = client.contato_principal || client.nome;

    const missing: string[] = [];
    if (!hasRazao) missing.push("Razão Social");
    if (!hasCnpj) missing.push("CNPJ/CPF");

    const lines = [
      `📄 *Dados fiscais pendentes*`,
      ``,
      `Olá${nome ? `, *${nome}*` : ""}! Precisamos dos seguintes dados pra emissão de nota fiscal:`,
      ``,
    ];

    for (const m of missing) {
      lines.push(`  ⚠️ ${m}`);
    }

    lines.push(``);
    lines.push(`Por favor, preencha no portal:`);
    lines.push(`🔗 ${portalUrl}/cliente/login`);
    lines.push(``);
    lines.push(`Qualquer dúvida, estamos por aqui! 😊`);

    const result = await sendWhatsAppGroupMessage(client.grupo_wpp_jid, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
