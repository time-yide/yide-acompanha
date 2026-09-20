import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatIsoDate, getAppTimezoneOffsetMs } from "@/lib/datetime/timezone";
import { roleParaSetor, type Setor } from "@/lib/produtividade/setor-metricas";

export interface WeeklyPersonMetrics {
  nome: string;
  role: string;
  ligacoes_feitas: number;
  ligacoes_atendidas: number;
  anuncios: number;
  tarefas_entregues: number;
  tarefas_no_prazo: number;
  tarefas_com_prazo: number;
  tarefas_atrasadas: number;
  postagens: number;
  artes: number;
}

export interface WeeklySectorData {
  setor: Setor;
  pessoas: WeeklyPersonMetrics[];
  totals: {
    tarefas_entregues: number;
    tarefas_atrasadas: number;
    ligacoes_feitas: number;
    ligacoes_atendidas: number;
    postagens: number;
    artes: number;
    anuncios: number;
  };
}

export interface WeeklyData {
  de: string;
  ate: string;
  setores: WeeklySectorData[];
  totalGeral: {
    tarefas_entregues: number;
    tarefas_atrasadas: number;
    gravacoes_realizadas: number;
    postagens: number;
    artes: number;
    ligacoes: number;
  };
}

export async function getWeeklyData(orgId: string): Promise<WeeklyData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  const now = new Date();
  const ate = formatIsoDate(now);
  const deDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const de = formatIsoDate(deDate);

  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  const sinceUtc = new Date(`${de}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const tomorrowDate = new Date(`${ate}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrowUtc = new Date(
    `${formatIsoDate(tomorrowDate)}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`,
  ).toISOString();

  const hoje = ate;

  const [
    { data: profilesData },
    { data: ligacoesData },
    { data: anunciosData },
    { data: entreguesData },
    { data: atrasadasData },
    { data: postagensData },
    { data: artesData },
    { data: gravacoesData },
  ] = await Promise.all([
    sb.from("profiles").select("id, nome, role, especialidade")
      .eq("ativo", true).eq("organization_id", orgId),
    sb.from("ligacoes").select("colaborador_id, status, direcao")
      .is("arquivado_em", null).eq("direcao", "saida")
      .gte("iniciada_em", sinceUtc).lt("iniciada_em", tomorrowUtc)
      .not("colaborador_id", "is", null),
    sb.from("anuncios_ecommerce").select("colaborador_id, quantidade")
      .is("arquivado_em", null).gte("data", de).lte("data", ate)
      .not("colaborador_id", "is", null),
    sb.from("tasks").select("atribuido_a, due_date, completed_at")
      .eq("status", "postada").gte("completed_at", sinceUtc).lt("completed_at", tomorrowUtc)
      .not("atribuido_a", "is", null),
    sb.from("tasks").select("atribuido_a")
      .is("deleted_at", null).neq("status", "postada").lt("due_date", hoje)
      .not("atribuido_a", "is", null),
    sb.from("social_media_posts").select("criado_por")
      .is("archived_at", null).eq("status", "publicado")
      .gte("publicado_em", sinceUtc).lt("publicado_em", tomorrowUtc)
      .not("criado_por", "is", null),
    sb.from("design_artes").select("criado_por")
      .is("archived_at", null).eq("status", "aprovado")
      .gte("aprovado_em", sinceUtc).lt("aprovado_em", tomorrowUtc)
      .not("criado_por", "is", null),
    sb.from("calendar_events").select("id")
      .eq("sub_calendar", "videomakers")
      .eq("videomaker_status", "completed")
      .gte("inicio", sinceUtc).lt("inicio", tomorrowUtc),
  ]);

  const profiles = (profilesData ?? []) as Array<{
    id: string; nome: string; role: string; especialidade: string | null;
  }>;
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const metrics = new Map<string, WeeklyPersonMetrics>();
  const getM = (id: string): WeeklyPersonMetrics | null => {
    const prof = profileMap.get(id);
    if (!prof) return null;
    let m = metrics.get(id);
    if (!m) {
      m = {
        nome: prof.nome, role: prof.role,
        ligacoes_feitas: 0, ligacoes_atendidas: 0, anuncios: 0,
        tarefas_entregues: 0, tarefas_no_prazo: 0, tarefas_com_prazo: 0,
        tarefas_atrasadas: 0, postagens: 0, artes: 0,
      };
      metrics.set(id, m);
    }
    return m;
  };

  for (const l of (ligacoesData ?? []) as Array<{ colaborador_id: string; status: string }>) {
    const m = getM(l.colaborador_id);
    if (m) { m.ligacoes_feitas++; if (l.status === "atendida") m.ligacoes_atendidas++; }
  }
  for (const a of (anunciosData ?? []) as Array<{ colaborador_id: string; quantidade: number }>) {
    const m = getM(a.colaborador_id);
    if (m) m.anuncios += Number(a.quantidade ?? 0);
  }
  for (const t of (entreguesData ?? []) as Array<{ atribuido_a: string; due_date: string | null; completed_at: string | null }>) {
    const m = getM(t.atribuido_a);
    if (m) {
      m.tarefas_entregues++;
      if (t.due_date) {
        m.tarefas_com_prazo++;
        if (t.completed_at && t.completed_at.slice(0, 10) <= t.due_date) m.tarefas_no_prazo++;
      }
    }
  }
  for (const t of (atrasadasData ?? []) as Array<{ atribuido_a: string }>) {
    const m = getM(t.atribuido_a);
    if (m) m.tarefas_atrasadas++;
  }
  for (const p of (postagensData ?? []) as Array<{ criado_por: string }>) {
    const m = getM(p.criado_por);
    if (m) m.postagens++;
  }
  for (const a of (artesData ?? []) as Array<{ criado_por: string }>) {
    const m = getM(a.criado_por);
    if (m) m.artes++;
  }

  const bySetor = new Map<Setor, WeeklyPersonMetrics[]>();
  for (const [userId, m] of metrics) {
    const prof = profileMap.get(userId);
    if (!prof) continue;
    const setor = roleParaSetor(prof.role, prof.especialidade);
    if (!setor) continue;
    const arr = bySetor.get(setor) ?? [];
    arr.push(m);
    bySetor.set(setor, arr);
  }

  const setores: WeeklySectorData[] = [];
  for (const [setor, pessoas] of bySetor) {
    const totals = {
      tarefas_entregues: 0, tarefas_atrasadas: 0, ligacoes_feitas: 0,
      ligacoes_atendidas: 0, postagens: 0, artes: 0, anuncios: 0,
    };
    for (const p of pessoas) {
      totals.tarefas_entregues += p.tarefas_entregues;
      totals.tarefas_atrasadas += p.tarefas_atrasadas;
      totals.ligacoes_feitas += p.ligacoes_feitas;
      totals.ligacoes_atendidas += p.ligacoes_atendidas;
      totals.postagens += p.postagens;
      totals.artes += p.artes;
      totals.anuncios += p.anuncios;
    }
    setores.push({ setor, pessoas, totals });
  }

  const gravacoes_realizadas = (gravacoesData ?? []).length;

  const totalGeral = {
    tarefas_entregues: setores.reduce((a, s) => a + s.totals.tarefas_entregues, 0),
    tarefas_atrasadas: setores.reduce((a, s) => a + s.totals.tarefas_atrasadas, 0),
    gravacoes_realizadas,
    postagens: setores.reduce((a, s) => a + s.totals.postagens, 0),
    artes: setores.reduce((a, s) => a + s.totals.artes, 0),
    ligacoes: setores.reduce((a, s) => a + s.totals.ligacoes_feitas, 0),
  };

  return { de, ate, setores, totalGeral };
}
