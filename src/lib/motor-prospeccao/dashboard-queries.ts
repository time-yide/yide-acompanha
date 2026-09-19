import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function sb() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServiceRoleClient() as any;
}

export interface MotorStats {
  wppEnviadosHoje: number;
  maxWppDia: number;
  conversasAtivas: number;
  reunioesAgendadasSemana: number;
  taxaResposta: number;
}

export interface FunilItem {
  label: string;
  valor: number;
}

export interface FunilCompleto {
  wppEnviados: number;
  responderam: number;
  ligacoesFeitas: number;
  ligacoesAtendidas: number;
  reunioesAgendadas: number;
  semInteresse: number;
  escalados: number;
  viramCliente: number;
  reengajamentoEnviados: number;
  reengajamentoResponderam: number;
}

export interface ConversaAtiva {
  id: string;
  contato_nome: string;
  lead_categoria: string | null;
  ultimo_texto: string | null;
  ultima_msg_em: string | null;
}

function calcDesde(dias: number): string | null {
  if (dias === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function getMotorStats(orgId: string, dias = 0): Promise<MotorStats> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeISO = hoje.toISOString();
  const desde = calcDesde(dias);

  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  inicioSemana.setHours(0, 0, 0, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function filtrarPeriodo(q: any) {
    return desde ? q.gte("criado_em", desde) : q;
  }

  const [wppHoje, config, conversasAtivas, reunioes, totalEnviados, totalResponderam] =
    await Promise.all([
      sb()
        .from("motor_prospeccao_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("acao", "wpp_primeiro_contato")
        .gte("criado_em", hojeISO),
      sb()
        .from("ai_voice_configs")
        .select("max_wpp_dia")
        .eq("organization_id", orgId)
        .eq("ativo", true)
        .maybeSingle(),
      sb()
        .from("wpp_conversations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("ai_ativa", true),
      sb()
        .from("motor_prospeccao_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("acao", "reuniao_agendada")
        .gte("criado_em", inicioSemana.toISOString()),
      filtrarPeriodo(
        sb()
          .from("motor_prospeccao_log")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("acao", "wpp_primeiro_contato"),
      ),
      filtrarPeriodo(
        sb()
          .from("motor_prospeccao_log")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("acao", ["reuniao_agendada", "sem_interesse", "escalado_humano"]),
      ),
    ]);

  const total = totalEnviados.count ?? 0;
  const responderam = totalResponderam.count ?? 0;

  return {
    wppEnviadosHoje: wppHoje.count ?? 0,
    maxWppDia: config?.data?.max_wpp_dia ?? 50,
    conversasAtivas: conversasAtivas.count ?? 0,
    reunioesAgendadasSemana: reunioes.count ?? 0,
    taxaResposta: total > 0 ? Math.round((responderam / total) * 100) : 0,
  };
}

export async function getFunilMotor(orgId: string): Promise<FunilItem[]> {
  const { data: logs } = await sb()
    .from("motor_prospeccao_log")
    .select("acao")
    .eq("organization_id", orgId);

  if (!logs) return [];

  const counts: Record<string, number> = {};
  for (const log of logs as { acao: string }[]) {
    counts[log.acao] = (counts[log.acao] ?? 0) + 1;
  }

  return [
    { label: "Enviados", valor: counts["wpp_primeiro_contato"] ?? 0 },
    { label: "Responderam", valor: (counts["reuniao_agendada"] ?? 0) + (counts["sem_interesse"] ?? 0) + (counts["escalado_humano"] ?? 0) },
    { label: "Reunião agendada", valor: counts["reuniao_agendada"] ?? 0 },
    { label: "Sem interesse", valor: counts["sem_interesse"] ?? 0 },
    { label: "Escalado", valor: counts["escalado_humano"] ?? 0 },
  ];
}

export async function getFunilCompleto(orgId: string, dias: number): Promise<FunilCompleto> {
  const desde = calcDesde(dias);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function logCount(acoes: string | string[]): any {
    const q = sb()
      .from("motor_prospeccao_log")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId);
    const q2 = Array.isArray(acoes) ? q.in("acao", acoes) : q.eq("acao", acoes);
    return desde ? q2.gte("criado_em", desde) : q2;
  }

  const [
    wppEnviados,
    responderam,
    ligacoesFeitas,
    ligacoesAtendidas,
    reunioesAgendadas,
    semInteresse,
    escalados,
    viramCliente,
    reengajamentoEnviados,
    reengajamentoResponderam,
  ] = await Promise.all([
    // 1. WPP enviados (primeiro contato + reengajamento)
    logCount(["wpp_primeiro_contato", "reengajamento_wpp"]),
    // 2. Responderam (qualquer ação que indica engajamento)
    logCount(["reuniao_agendada", "sem_interesse", "escalado_humano", "wpp_resposta_ia"]),
    // 3. Ligações feitas
    (() => {
      const q = sb()
        .from("ligacoes")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("origem", ["voz_ia", "power_dialer"])
        .eq("direcao", "saida");
      return desde ? q.gte("criado_em", desde) : q;
    })(),
    // 4. Ligações atendidas
    (() => {
      const q = sb()
        .from("ligacoes")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .in("origem", ["voz_ia", "power_dialer"])
        .eq("status", "atendida");
      return desde ? q.gte("criado_em", desde) : q;
    })(),
    // 5. Reuniões agendadas
    logCount("reuniao_agendada"),
    // 6. Sem interesse
    logCount("sem_interesse"),
    // 7. Escalados
    logCount("escalado_humano"),
    // 8. Viraram cliente
    (() => {
      const q = sb()
        .from("leads_gerados")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "cliente");
      return desde ? q.gte("updated_at", desde) : q;
    })(),
    // 9. Reengajamento enviados
    logCount("reengajamento_wpp"),
    // 10. Reengajamento responderam (voltaram ao funil)
    (() => {
      const q = sb()
        .from("leads_gerados")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .gt("reengajamento_tentativas", 0)
        .not("ai_status", "in", "(esgotado,descartado_definitivo)");
      return desde ? q.gte("updated_at", desde) : q;
    })(),
  ]);

  return {
    wppEnviados: wppEnviados.count ?? 0,
    responderam: responderam.count ?? 0,
    ligacoesFeitas: ligacoesFeitas.count ?? 0,
    ligacoesAtendidas: ligacoesAtendidas.count ?? 0,
    reunioesAgendadas: reunioesAgendadas.count ?? 0,
    semInteresse: semInteresse.count ?? 0,
    escalados: escalados.count ?? 0,
    viramCliente: viramCliente.count ?? 0,
    reengajamentoEnviados: reengajamentoEnviados.count ?? 0,
    reengajamentoResponderam: reengajamentoResponderam.count ?? 0,
  };
}

export async function getConversasAtivas(orgId: string): Promise<ConversaAtiva[]> {
  const { data } = await sb()
    .from("wpp_conversations")
    .select("id, contato_nome, ultimo_texto, ultima_msg_em, lead_gerado_id")
    .eq("organization_id", orgId)
    .eq("ai_ativa", true)
    .order("ultima_msg_em", { ascending: false })
    .limit(20);

  if (!data) return [];

  const conversas: ConversaAtiva[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of data as any[]) {
    let lead_categoria: string | null = null;
    if (c.lead_gerado_id) {
      const { data: lead } = await sb()
        .from("leads_gerados")
        .select("categoria")
        .eq("id", c.lead_gerado_id)
        .single();
      lead_categoria = lead?.categoria ?? null;
    }
    conversas.push({
      id: c.id,
      contato_nome: c.contato_nome,
      lead_categoria,
      ultimo_texto: c.ultimo_texto,
      ultima_msg_em: c.ultima_msg_em,
    });
  }

  return conversas;
}
