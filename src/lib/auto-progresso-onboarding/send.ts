import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppMessage } from "@/lib/weekly-reports/evolution-api";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

const ETAPA_NOMES: Record<string, string> = {
  entrada: "Entrada do lead",
  cadastro: "Cadastro e organização",
  marco_zero: "Reunião marco zero + estratégia",
  trafego: "Tráfego + estratégia",
  producao: "Planejamento e produção",
  apresentacao: "Apresentação ao cliente",
  publicacao: "Publicação + tráfego",
};

export async function sendAutoProgressoOnboarding(): Promise<{
  updated: number;
  notified: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: etapas } = await sb
    .from("client_onboarding_etapas")
    .select("id, client_id, etapa_numero, etapa_codigo, status, d0_date, dia_inicio_previsto, clients(nome, assessor_id, status)")
    .eq("status", "pendente")
    .lte("etapa_numero", 7)
    .not("d0_date", "is", null)
    .not("dia_inicio_previsto", "is", null);

  if (!etapas || etapas.length === 0) return { updated: 0, notified: 0, skipped: 0 };

  interface EtapaRow {
    id: string;
    client_id: string;
    etapa_numero: number;
    etapa_codigo: string;
    status: string;
    d0_date: string;
    dia_inicio_previsto: number;
    clients: { nome: string; assessor_id: string | null; status: string } | null;
  }

  const now = new Date();
  let updated = 0;
  let skipped = 0;

  interface UpdatedInfo {
    clienteNome: string;
    etapaLabel: string;
    etapaNumero: number;
  }
  const updatesByAssessor = new Map<string, UpdatedInfo[]>();

  for (const etapa of etapas as EtapaRow[]) {
    if (etapa.clients?.status !== "em_onboarding") { skipped++; continue; }

    const d0 = new Date(etapa.d0_date);
    const inicioPrevisto = new Date(d0);
    inicioPrevisto.setDate(inicioPrevisto.getDate() + etapa.dia_inicio_previsto);

    if (now < inicioPrevisto) { skipped++; continue; }

    const { error } = await sb
      .from("client_onboarding_etapas")
      .update({ status: "em_progresso", iniciado_em: now.toISOString() })
      .eq("id", etapa.id);

    if (error) { skipped++; continue; }

    updated++;

    const assessorId = etapa.clients?.assessor_id;
    if (assessorId) {
      const list = updatesByAssessor.get(assessorId) ?? [];
      list.push({
        clienteNome: etapa.clients?.nome ?? "Cliente",
        etapaLabel: ETAPA_NOMES[etapa.etapa_codigo] ?? etapa.etapa_codigo,
        etapaNumero: etapa.etapa_numero,
      });
      updatesByAssessor.set(assessorId, list);
    }
  }

  if (updatesByAssessor.size === 0) return { updated, notified: 0, skipped };

  const assessorIds = [...updatesByAssessor.keys()];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, nome, telefone")
    .in("id", assessorIds);

  interface Profile { id: string; nome: string; telefone: string | null }

  let notified = 0;

  for (const prof of (profiles ?? []) as Profile[]) {
    if (!prof.telefone) continue;

    const updates = updatesByAssessor.get(prof.id);
    if (!updates || updates.length === 0) continue;

    const lines = [
      `🔄 *Onboarding — etapas iniciadas*`,
      ``,
      `${prof.nome?.split(" ")[0] ?? ""}, essas etapas entraram em andamento automaticamente:`,
      ``,
    ];

    for (const u of updates) {
      lines.push(`• *${u.clienteNome}* — Etapa ${u.etapaNumero}: ${u.etapaLabel}`);
    }

    lines.push(``);
    lines.push(`Acompanhe o progresso no sistema! 📊`);

    const result = await sendWhatsAppMessage(prof.telefone, lines.join("\n"));
    if (result.success) notified++;
  }

  return { updated, notified, skipped };
}
