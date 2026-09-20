import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

/**
 * NFS-e via ABRASF v2.04 — Prefeitura de Cuiabá/MT
 *
 * PENDENTE de configuração:
 * 1. Certificado A1 (.pfx) — env NFSE_CERT_PATH + NFSE_CERT_PASSWORD
 * 2. CNPJ + Inscrição Municipal da Yide — preenchidos na tabela organizations
 * 3. Endpoint SOAP da prefeitura — env NFSE_ENDPOINT_URL
 * 4. npm install xml-crypto xmlbuilder2 (assinatura + geração XML)
 *
 * Quando tiver tudo: descomentar a chamada SOAP e testar em homologação.
 */

export async function emitirNfseAutomatico(): Promise<{
  emitted: number;
  skipped: number;
  errors: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const endpointUrl = process.env.NFSE_ENDPOINT_URL;
  const certPath = process.env.NFSE_CERT_PATH;
  const certPassword = process.env.NFSE_CERT_PASSWORD;

  if (!endpointUrl || !certPath || !certPassword) {
    console.log("[nfse] NFS-e não configurada (faltam env vars NFSE_ENDPOINT_URL, NFSE_CERT_PATH, NFSE_CERT_PASSWORD)");
    return { emitted: 0, skipped: 0, errors: 0 };
  }

  const { data: org } = await sb
    .from("organizations")
    .select("id, cnpj, razao_social, inscricao_municipal, codigo_servico, aliquota_iss")
    .limit(1)
    .maybeSingle();

  if (!org?.cnpj || !org?.razao_social || !org?.inscricao_municipal) {
    console.log("[nfse] Dados fiscais da organização incompletos");
    return { emitted: 0, skipped: 0, errors: 0 };
  }

  const now = new Date();
  const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mesRef = `${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth() + 1).padStart(2, "0")}`;

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, valor_mensal, client_contract_info(razao_social, cnpj_cpf, endereco, email)")
    .eq("status", "ativo")
    .gt("valor_mensal", 0);

  if (!clients || clients.length === 0) return { emitted: 0, skipped: 0, errors: 0 };

  interface ClientRow {
    id: string;
    nome: string;
    valor_mensal: number;
    client_contract_info: {
      razao_social: string | null;
      cnpj_cpf: string | null;
      endereco: string | null;
      email: string | null;
    } | null;
  }

  let emitted = 0;
  let skipped = 0;
  let errors = 0;

  for (const client of clients as ClientRow[]) {
    const info = client.client_contract_info;
    if (!info?.cnpj_cpf || !info?.razao_social) {
      skipped++;
      continue;
    }

    const { data: existing } = await sb
      .from("nfse_emitidas")
      .select("id")
      .eq("client_id", client.id)
      .eq("mes_referencia", mesRef)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    const valorServico = Number(client.valor_mensal);
    const aliquota = Number(org.aliquota_iss ?? 5);
    const valorIss = valorServico * (aliquota / 100);

    // TODO: quando certificado A1 estiver configurado:
    // 1. Gerar XML ABRASF (EnviarLoteRpsEnvio)
    // 2. Assinar com certificado A1
    // 3. Enviar via SOAP pro endpoint da prefeitura
    // 4. Parsear resposta e salvar numero_nfse + codigo_verificacao
    //
    // Por enquanto, registra como pendente pra emissão manual

    const { error } = await sb
      .from("nfse_emitidas")
      .insert({
        organization_id: org.id,
        client_id: client.id,
        mes_referencia: mesRef,
        valor_servico: valorServico,
        valor_iss: valorIss,
        status: "pendente",
      });

    if (error) {
      errors++;
      console.error(`[nfse] Erro ao registrar NFS-e para ${client.nome}:`, error.message);
    } else {
      emitted++;
    }
  }

  if (emitted > 0) {
    const { data: financeiros } = await sb
      .from("profiles")
      .select("id, nome, telefone")
      .in("role", ["financeiro", "adm"])
      .eq("ativo", true)
      .not("telefone", "is", null);

    if (financeiros && financeiros.length > 0) {
      const mesLabel = mesAnterior.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

      const msg = [
        `🧾 *NFS-e — ${mesLabel}*`,
        ``,
        `*${emitted}* nota(s) fiscal(is) registrada(s) pra emissão.`,
        ``,
        `⚠️ Emissão automática pendente (certificado A1 não configurado).`,
        `Emita manualmente ou configure o certificado no sistema.`,
      ].join("\n");

      interface Profile { id: string; nome: string; telefone: string | null }
      for (const f of financeiros as Profile[]) {
        if (f.telefone) await sendWhatsAppMessage(f.telefone, msg);
      }
    }
  }

  return { emitted, skipped, errors };
}
