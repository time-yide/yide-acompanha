// Queries do módulo D0-D30. Usa service-role pra ler tudo, page-level
// `requireAuth` filtra permissão depois.

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  getDiaAtual,
  addDaysShort,
  type ChecklistItem,
  type EtapaCodigo,
  type StatusEtapa,
} from "./template";

export interface EtapaRow {
  id: string;
  client_id: string;
  etapa_numero: number;
  etapa_codigo: EtapaCodigo;
  status: StatusEtapa;
  dia_inicio_previsto: number | null;
  dia_fim_previsto: number | null;
  iniciado_em: string | null;
  concluido_em: string | null;
  concluido_por: string | null;
  observacoes: string | null;
  fluxo_checklist: ChecklistItem[];
  saidas_checklist: ChecklistItem[];
  d0_date: string;
}

export interface ClienteOnboardingResumo {
  client_id: string;
  client_nome: string;
  assessor_nome: string | null;
  coordenador_nome: string | null;
  d0_date: string;
  dia_atual: number;
  total_etapas_periodo: number;     // só etapas 1-7 (D0-D30)
  concluidas_periodo: number;
  total_itens_periodo: number;       // soma dos fluxo+saidas das etapas 1-7
  concluidos_itens_periodo: number;
  etapa_atual: { numero: number; nome: string } | null;
  /** Status agregado pro semáforo: ok / atencao / atrasado */
  status_visao_geral: "ok" | "atencao" | "atrasado" | "concluido";
}

const NOMES_ETAPAS: Record<string, string> = {
  entrada: "Entrada do lead",
  cadastro: "Cadastro e organização",
  marco_zero: "Reunião marco zero + estratégia",
  trafego: "Tráfego + estratégia",
  producao: "Planejamento e produção",
  apresentacao: "Apresentação ao cliente",
  publicacao: "Publicação + tráfego",
  monitoramento: "Monitoramento e otimização",
  relacionamento: "Relacionamento contínuo",
};

/**
 * Lista todos os clientes que têm onboarding D0-D30 cadastrado, com agregação
 * de progresso e status pro semáforo da UI.
 */
export async function listClientesEmOnboarding(): Promise<ClienteOnboardingResumo[]> {
  const admin = createServiceRoleClient();

  // 1) Todas as etapas com info do cliente + assessor + coordenador
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data: etapasData } = await sb
    .from("client_onboarding_etapas")
    .select(
      "*, cliente:clients!client_id(id, nome, status, assessor_id, coordenador_id)",
    );

  const rows = (etapasData ?? []) as Array<
    EtapaRow & {
      cliente: {
        id: string;
        nome: string;
        status: string;
        assessor_id: string | null;
        coordenador_id: string | null;
      } | null;
    }
  >;

  if (rows.length === 0) return [];

  // 2) Pega nomes dos profiles uma vez
  const profileIds = new Set<string>();
  for (const r of rows) {
    if (r.cliente?.assessor_id) profileIds.add(r.cliente.assessor_id);
    if (r.cliente?.coordenador_id) profileIds.add(r.cliente.coordenador_id);
  }
  const profileNomeById = new Map<string, string>();
  if (profileIds.size > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, nome")
      .in("id", Array.from(profileIds));
    for (const p of (profiles ?? []) as Array<{ id: string; nome: string }>) {
      profileNomeById.set(p.id, p.nome);
    }
  }

  // 3) Agrupa etapas por client_id
  const byClient = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byClient.get(r.client_id) ?? [];
    arr.push(r);
    byClient.set(r.client_id, arr);
  }

  // 4) Monta o resumo
  const resumos: ClienteOnboardingResumo[] = [];
  const hoje = new Date();
  for (const [clientId, etapas] of byClient) {
    const cliente = etapas[0].cliente;
    if (!cliente) continue;

    // Ordena por etapa_numero
    etapas.sort((a, b) => a.etapa_numero - b.etapa_numero);

    const d0 = etapas[0].d0_date;
    const diaAtual = getDiaAtual(d0, hoje);

    // Considera só etapas 1-7 (D0-D30) pra progresso visível.
    const periodo = etapas.filter((e) => e.etapa_numero >= 1 && e.etapa_numero <= 7);
    const concluidas = periodo.filter((e) => e.status === "concluido").length;

    const totalItens = periodo.reduce(
      (sum, e) => sum + e.fluxo_checklist.length + e.saidas_checklist.length,
      0,
    );
    const concluidosItens = periodo.reduce(
      (sum, e) =>
        sum +
        e.fluxo_checklist.filter((i) => i.done).length +
        e.saidas_checklist.filter((i) => i.done).length,
      0,
    );

    // Etapa atual: primeira não concluída do período D0-D30, com lógica de
    // "qual deveria estar acontecendo agora baseado em diaAtual"
    let etapaAtual: { numero: number; nome: string } | null = null;
    for (const e of periodo) {
      if (e.status !== "concluido") {
        etapaAtual = { numero: e.etapa_numero, nome: NOMES_ETAPAS[e.etapa_codigo] ?? e.etapa_codigo };
        break;
      }
    }

    // Status agregado:
    // - "concluido" se todas as 7 etapas concluídas
    // - "atrasado" se tem alguma etapa não concluída com dia_fim_previsto < diaAtual
    // - "atencao" se tem etapa que deveria estar em progresso e ainda não começou
    // - "ok" caso contrário
    let statusVisao: ClienteOnboardingResumo["status_visao_geral"] = "ok";
    if (concluidas === periodo.length && periodo.length > 0) {
      statusVisao = "concluido";
    } else {
      const temAtrasada = periodo.some(
        (e) =>
          e.status !== "concluido" &&
          e.dia_fim_previsto !== null &&
          diaAtual > e.dia_fim_previsto,
      );
      const temAtencao = periodo.some(
        (e) =>
          e.status === "pendente" &&
          e.dia_inicio_previsto !== null &&
          diaAtual >= e.dia_inicio_previsto,
      );
      if (temAtrasada) statusVisao = "atrasado";
      else if (temAtencao) statusVisao = "atencao";
    }

    resumos.push({
      client_id: clientId,
      client_nome: cliente.nome,
      assessor_nome: cliente.assessor_id ? profileNomeById.get(cliente.assessor_id) ?? null : null,
      coordenador_nome: cliente.coordenador_id ? profileNomeById.get(cliente.coordenador_id) ?? null : null,
      d0_date: d0,
      dia_atual: diaAtual,
      total_etapas_periodo: periodo.length,
      concluidas_periodo: concluidas,
      total_itens_periodo: totalItens,
      concluidos_itens_periodo: concluidosItens,
      etapa_atual: etapaAtual,
      status_visao_geral: statusVisao,
    });
  }

  // Ordena: atrasados primeiro, depois atenção, depois ok, depois concluídos
  const statusOrder = { atrasado: 0, atencao: 1, ok: 2, concluido: 3 };
  resumos.sort(
    (a, b) =>
      statusOrder[a.status_visao_geral] - statusOrder[b.status_visao_geral] ||
      a.dia_atual - b.dia_atual,
  );

  return resumos;
}

export interface ClienteEtapasDetalhe {
  cliente: { id: string; nome: string; data_entrada: string; status: string };
  assessor: { id: string; nome: string } | null;
  coordenador: { id: string; nome: string } | null;
  d0_date: string;
  dia_atual: number;
  etapas: EtapaRow[];
}

export async function getClienteOnboardingDetalhe(
  clientId: string,
): Promise<ClienteEtapasDetalhe | null> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // Roda cliente + etapas em paralelo (não dependem um do outro).
  // Antes era sequencial (cliente → etapas → profiles) = 3 round-trips
  // serializados. Agora cliente+etapas em paralelo, depois profiles.
  const [clienteRes, etapasRes] = await Promise.all([
    sb
      .from("clients")
      .select("id, nome, data_entrada, status, assessor_id, coordenador_id")
      .eq("id", clientId)
      .single(),
    sb
      .from("client_onboarding_etapas")
      .select(
        "id, client_id, etapa_numero, etapa_codigo, status, dia_inicio_previsto, dia_fim_previsto, iniciado_em, concluido_em, concluido_por, observacoes, fluxo_checklist, saidas_checklist, d0_date",
      )
      .eq("client_id", clientId)
      .order("etapa_numero"),
  ]);

  if (!clienteRes.data) return null;
  const cliente = clienteRes.data as {
    id: string;
    nome: string;
    data_entrada: string;
    status: string;
    assessor_id: string | null;
    coordenador_id: string | null;
  };

  const etapas = (etapasRes.data ?? []) as EtapaRow[];
  if (etapas.length === 0) return null;

  const d0 = etapas[0].d0_date;
  const diaAtual = getDiaAtual(d0);

  // Profiles em separado — depende de cliente.assessor_id/coordenador_id.
  let assessor: { id: string; nome: string } | null = null;
  let coordenador: { id: string; nome: string } | null = null;
  const ids = [cliente.assessor_id, cliente.coordenador_id].filter(Boolean) as string[];
  if (ids.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, nome")
      .in("id", ids);
    for (const p of (profiles ?? []) as Array<{ id: string; nome: string }>) {
      if (p.id === cliente.assessor_id) assessor = p;
      if (p.id === cliente.coordenador_id) coordenador = p;
    }
  }

  return {
    cliente: {
      id: cliente.id,
      nome: cliente.nome,
      data_entrada: cliente.data_entrada,
      status: cliente.status,
    },
    assessor,
    coordenador,
    d0_date: d0,
    dia_atual: diaAtual,
    etapas,
  };
}

/**
 * Lista clientes ativos que AINDA NÃO têm onboarding criado — pra modal de
 * adição manual.
 */
export async function listClientesElegiveisParaOnboarding(): Promise<
  Array<{ id: string; nome: string; data_entrada: string }>
> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // 1) Clientes ativos
  const { data: clientes } = await sb
    .from("clients")
    .select("id, nome, data_entrada, status")
    .eq("status", "ativo")
    .is("deleted_at", null)
    .order("nome");

  const rows = (clientes ?? []) as Array<{
    id: string;
    nome: string;
    data_entrada: string;
  }>;

  // 2) Quais já têm onboarding
  const { data: ja } = await sb
    .from("client_onboarding_etapas")
    .select("client_id");
  const jaTem = new Set(((ja ?? []) as Array<{ client_id: string }>).map((r) => r.client_id));

  return rows.filter((c) => !jaTem.has(c.id));
}

// ─── Etapas atrasadas (pra alerta no dashboard) ──────────────────────────────

export interface EtapaAtrasadaResumo {
  etapa_id: string;
  client_id: string;
  client_nome: string;
  etapa_numero: number;
  etapa_nome: string;
  date_range: string;       // "29/04–01/05"
  dias_atrasado: number;    // quantos dias passou do fim_previsto
}

const NOMES_ETAPAS_COMPLETO: Record<string, string> = {
  entrada: "Entrada do lead",
  cadastro: "Cadastro e organização",
  marco_zero: "Reunião marco zero",
  trafego: "Tráfego + estratégia",
  producao: "Planejamento e produção",
  apresentacao: "Apresentação ao cliente",
  publicacao: "Publicação + tráfego",
  monitoramento: "Monitoramento e otimização",
  relacionamento: "Relacionamento contínuo",
};

/**
 * Lista etapas atrasadas (não concluídas e que já passaram do `dia_fim_previsto`)
 * filtradas pelo escopo do user:
 *  - adm / socio: tudo
 *  - coordenador: tudo (eles supervisionam onboarding)
 *  - assessor / comercial: apenas onde é responsável (assessor_id ou coordenador_id)
 *
 * Etapas contínuas (8 e 9) com dia_fim null nunca aparecem.
 */
export async function getEtapasAtrasadasParaUser(
  userId: string,
  role: string,
): Promise<EtapaAtrasadaResumo[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // Pega TODAS as etapas não concluídas + join com cliente (pra filtrar
  // responsabilidade e pegar nome). Filtra "atrasada" em memória pra simplificar
  // (poucos clientes em onboarding ao mesmo tempo, custo desprezível).
  const { data } = await sb
    .from("client_onboarding_etapas")
    .select(
      "id, client_id, etapa_numero, etapa_codigo, status, dia_fim_previsto, d0_date, " +
        "cliente:clients!client_id(id, nome, assessor_id, coordenador_id)",
    )
    .neq("status", "concluido")
    .not("dia_fim_previsto", "is", null);

  const rows = (data ?? []) as Array<{
    id: string;
    client_id: string;
    etapa_numero: number;
    etapa_codigo: string;
    status: string;
    dia_fim_previsto: number;
    d0_date: string;
    cliente: {
      id: string;
      nome: string;
      assessor_id: string | null;
      coordenador_id: string | null;
    } | null;
  }>;

  const hoje = new Date();
  const isPriv = ["adm", "socio", "coordenador"].includes(role);

  const out: EtapaAtrasadaResumo[] = [];
  for (const r of rows) {
    if (!r.cliente) continue;

    // Filtro de permissão
    if (!isPriv) {
      const isResp =
        r.cliente.assessor_id === userId || r.cliente.coordenador_id === userId;
      if (!isResp) continue;
    }

    const diaAtual = getDiaAtual(r.d0_date, hoje);
    if (diaAtual <= r.dia_fim_previsto) continue; // ainda no prazo
    const diasAtrasado = diaAtual - r.dia_fim_previsto;

    out.push({
      etapa_id: r.id,
      client_id: r.client_id,
      client_nome: r.cliente.nome,
      etapa_numero: r.etapa_numero,
      etapa_nome: NOMES_ETAPAS_COMPLETO[r.etapa_codigo] ?? r.etapa_codigo,
      // Pra alerta mostramos só o prazo final ("vencia em DD/MM")
      date_range: addDaysShort(r.d0_date, r.dia_fim_previsto),
      dias_atrasado: diasAtrasado,
    });
  }

  // Ordena por dias_atrasado desc (pior primeiro)
  out.sort((a, b) => b.dias_atrasado - a.dias_atrasado);
  return out;
}
