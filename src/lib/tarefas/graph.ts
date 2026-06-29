export interface GraphTask {
  id: string;
  titulo: string;
  status: string;
  prioridade: string;
  client_id: string | null;
  atribuido_a?: string | null;
  participantes_ids?: string[];
}

export type NodeType = "task" | "cliente" | "pessoa";

export interface GraphNode {
  id: string; // "task:..", "cliente:..", "pessoa:.."
  type: NodeType;
  label: string; // título da tarefa ou nome do hub
  taskId?: string; // só pra type==='task'
  status?: string; // só task
  prioridade?: string; // só task
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface TaskGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Monta o grafo: tarefas como nós, clientes e pessoas como hubs.
 * Hubs só entram se tiverem ao menos 1 tarefa ligada.
 */
export function buildTaskGraph(
  tasks: GraphTask[],
  profiles: Array<{ id: string; nome: string }>,
  clientes: Array<{ id: string; nome: string }>,
): TaskGraph {
  const nomePessoa = new Map(profiles.map((p) => [p.id, p.nome]));
  const nomeCliente = new Map(clientes.map((c) => [c.id, c.nome]));

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const hubAdded = new Set<string>();

  function ensureHub(id: string, type: "cliente" | "pessoa", label: string) {
    if (hubAdded.has(id)) return;
    hubAdded.add(id);
    nodes.push({ id, type, label });
  }

  for (const t of tasks) {
    const taskNodeId = `task:${t.id}`;
    nodes.push({
      id: taskNodeId,
      type: "task",
      label: t.titulo,
      taskId: t.id,
      status: t.status,
      prioridade: t.prioridade,
    });

    if (t.client_id) {
      const cid = `cliente:${t.client_id}`;
      ensureHub(cid, "cliente", nomeCliente.get(t.client_id) ?? "Cliente");
      links.push({ source: taskNodeId, target: cid });
    }
    if (t.atribuido_a) {
      const pid = `pessoa:${t.atribuido_a}`;
      ensureHub(pid, "pessoa", nomePessoa.get(t.atribuido_a) ?? "Pessoa");
      links.push({ source: taskNodeId, target: pid });
    }
    for (const partId of t.participantes_ids ?? []) {
      if (partId === t.atribuido_a) continue; // evita link duplicado
      const pid = `pessoa:${partId}`;
      ensureHub(pid, "pessoa", nomePessoa.get(partId) ?? "Pessoa");
      links.push({ source: taskNodeId, target: pid });
    }
  }

  return { nodes, links };
}
