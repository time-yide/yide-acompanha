import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { isTarefaAtrasadaParaCargo } from "@/lib/tarefas/overdue-rules";
import { normalizeTelefone } from "@/lib/dispatch/render-template";
import { getTodayDate } from "@/lib/datetime/timezone";

export interface TarefaAtrasada {
  id: string;
  titulo: string;
  prioridade: string;
  status: string;
  due_date: string;
  cliente_nome: string | null;
}

export interface UserOverdueTasks {
  userId: string;
  nome: string;
  telefone: string;
  role: string;
  tarefas: TarefaAtrasada[];
}

export async function getOverdueTasksByUser(orgId: string): Promise<UserOverdueTasks[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const today = getTodayDate();

  const { data } = await sb
    .from("tasks")
    .select(`
      id, titulo, prioridade, status, due_date,
      atribuido:profiles!tasks_atribuido_a_fkey(id, nome, role, telefone, organization_id),
      cliente:clients(nome)
    `)
    .lt("due_date", today)
    .not("status", "eq", "postada")
    .is("deleted_at", null);

  if (!data || data.length === 0) return [];

  type Row = {
    id: string;
    titulo: string;
    prioridade: string;
    status: string;
    due_date: string;
    atribuido: { id: string; nome: string; role: string; telefone: string | null; organization_id: string } | null;
    cliente: { nome: string } | null;
  };

  const byUser = new Map<string, UserOverdueTasks>();

  for (const row of data as Row[]) {
    const p = row.atribuido;
    if (!p) continue;
    if (p.organization_id !== orgId) continue;
    if (!p.telefone) continue;

    if (!isTarefaAtrasadaParaCargo(row.status, p.role)) continue;

    const tel = normalizeTelefone(p.telefone);
    if (!tel) continue;

    let entry = byUser.get(p.id);
    if (!entry) {
      entry = { userId: p.id, nome: p.nome, telefone: tel, role: p.role, tarefas: [] };
      byUser.set(p.id, entry);
    }

    entry.tarefas.push({
      id: row.id,
      titulo: row.titulo,
      prioridade: row.prioridade,
      status: row.status,
      due_date: row.due_date,
      cliente_nome: row.cliente?.nome ?? null,
    });
  }

  return [...byUser.values()];
}
