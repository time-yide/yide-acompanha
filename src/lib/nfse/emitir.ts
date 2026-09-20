import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * NFS-e — lista de clientes pra emissão de nota fiscal
 *
 * Envia pro grupo WPP do financeiro (FINANCEIRO_GRUPO_WPP_JID)
 * a lista de clientes ativos com valor mensal, pra Yasmin confirmar
 * quais quer emitir NF.
 *
 * Emissão automática via ABRASF pendente de:
 * - Certificado A1 (.pfx) — env NFSE_CERT_PATH + NFSE_CERT_PASSWORD
 * - Endpoint SOAP — env NFSE_ENDPOINT_URL
 * - Dados fiscais da org preenchidos no banco
 */

export async function emitirNfseAutomatico(): Promise<{
  registered: number;
  skipped: number;
  notified: boolean;
}> {
  const sb = createServiceRoleClient() as SB;

  const grupoJid = process.env.FINANCEIRO_GRUPO_WPP_JID;
  if (!grupoJid) {
    console.log("[nfse] FINANCEIRO_GRUPO_WPP_JID não configurado");
    return { registered: 0, skipped: 0, notified: false };
  }

  const now = new Date();
  const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mesRef = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;
  const mesLabel = mesAnterior.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, valor_mensal, client_contract_info(razao_social, cnpj_cpf)")
    .eq("status", "ativo")
    .gt("valor_mensal", 0)
    .order("nome", { ascending: true });

  if (!clients || clients.length === 0) return { registered: 0, skipped: 0, notified: false };

  interface ClientRow {
    id: string;
    nome: string;
    valor_mensal: number;
    client_contract_info: {
      razao_social: string | null;
      cnpj_cpf: string | null;
    } | null;
  }

  const { data: jaEmitidas } = await sb
    .from("nfse_emitidas")
    .select("client_id")
    .eq("mes_referencia", mesRef)
    .in("status", ["emitida", "pendente"]);

  const jaEmitidosSet = new Set(
    ((jaEmitidas ?? []) as { client_id: string }[]).map((n) => n.client_id)
  );

  interface ClienteNF {
    nome: string;
    valor: number;
    temDados: boolean;
  }
  const pendentes: ClienteNF[] = [];

  for (const client of clients as ClientRow[]) {
    if (jaEmitidosSet.has(client.id)) continue;

    const info = client.client_contract_info;
    pendentes.push({
      nome: client.nome,
      valor: Number(client.valor_mensal),
      temDados: !!(info?.cnpj_cpf?.trim() && info?.razao_social?.trim()),
    });
  }

  if (pendentes.length === 0) return { registered: 0, skipped: 0, notified: false };

  let totalValor = 0;
  const lines = [
    `🧾 *NFS-e — ${mesLabel}*`,
    ``,
    `*${pendentes.length}* cliente(s) pendente(s) de nota fiscal:`,
    ``,
  ];

  for (const c of pendentes) {
    const icon = c.temDados ? "✅" : "⚠️";
    const valor = `R$ ${c.valor.toFixed(2).replace(".", ",")}`;
    lines.push(`${icon} *${c.nome}* — ${valor}`);
    totalValor += c.valor;
  }

  const semDados = pendentes.filter((c) => !c.temDados);
  if (semDados.length > 0) {
    lines.push(``);
    lines.push(`⚠️ *${semDados.length}* sem dados fiscais (CNPJ/Razão Social)`);
  }

  lines.push(``);
  lines.push(`💰 Total: *R$ ${totalValor.toFixed(2).replace(".", ",")}*`);
  lines.push(``);
  lines.push(`Confirme quais notas devem ser emitidas! 📋`);

  const result = await sendWhatsAppGroupMessage(grupoJid, lines.join("\n"));

  return { registered: pendentes.length, skipped: jaEmitidosSet.size, notified: result.success };
}
