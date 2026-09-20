import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWhatsAppGroupMessage } from "@/lib/weekly-reports/evolution-api";

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

export async function sendLembreteEtapasOnboarding(): Promise<{
  sent: number;
  skipped: number;
}> {
  const sb = createServiceRoleClient() as SB;

  const { data: clients } = await sb
    .from("clients")
    .select("id, nome, contato_principal, grupo_wpp_jid")
    .eq("status", "em_onboarding")
    .not("grupo_wpp_jid", "is", null);

  if (!clients || clients.length === 0) return { sent: 0, skipped: 0 };

  interface ClientRow {
    id: string;
    nome: string;
    contato_principal: string | null;
    grupo_wpp_jid: string | null;
  }

  let sent = 0;
  let skipped = 0;

  for (const client of clients as ClientRow[]) {
    if (!client.grupo_wpp_jid) { skipped++; continue; }

    const { data: etapas } = await sb
      .from("client_onboarding_etapas")
      .select("etapa_numero, etapa_codigo, status, d0_date, dia_inicio_previsto, dia_fim_previsto")
      .eq("client_id", client.id)
      .lte("etapa_numero", 7)
      .neq("status", "concluido")
      .order("etapa_numero", { ascending: true });

    if (!etapas || etapas.length === 0) { skipped++; continue; }

    interface Etapa {
      etapa_numero: number;
      etapa_codigo: string;
      status: string;
      d0_date: string | null;
      dia_inicio_previsto: number | null;
      dia_fim_previsto: number | null;
    }

    const pendentes = etapas as Etapa[];
    const now = new Date();

    const atrasadas = pendentes.filter((e) => {
      if (!e.d0_date || e.dia_fim_previsto == null) return false;
      const d0 = new Date(e.d0_date);
      const fimPrevisto = new Date(d0);
      fimPrevisto.setDate(fimPrevisto.getDate() + e.dia_fim_previsto);
      return now > fimPrevisto;
    });

    if (atrasadas.length === 0) { skipped++; continue; }

    const nome = client.contato_principal || client.nome;

    const lines = [
      `📋 *Lembrete de onboarding*`,
      ``,
      `Olá${nome ? `, *${nome}*` : ""}! Algumas etapas do seu onboarding precisam de atenção:`,
      ``,
    ];

    for (const e of atrasadas) {
      const label = ETAPA_NOMES[e.etapa_codigo] ?? e.etapa_codigo;
      const statusIcon = e.status === "em_progresso" ? "🔄" : "⏳";
      lines.push(`${statusIcon} Etapa ${e.etapa_numero}: *${label}*`);
    }

    lines.push(``);
    lines.push(`Precisamos avançar nessas etapas para seguir com seu projeto! 💪`);

    const result = await sendWhatsAppGroupMessage(client.grupo_wpp_jid, lines.join("\n"));
    if (result.success) sent++;
    else skipped++;
  }

  return { sent, skipped };
}
