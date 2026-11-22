export interface EditorCandidato {
  id: string;
  nome: string;
  role: string;
  /** Tarefas abertas (aberta/em_andamento/alteracao) atribuídas a ele. */
  tarefasAbertas: number;
  /** Tem gravação marcada nos próximos dias. */
  temGravacaoProxima: boolean;
}

/**
 * PURA. Escolhe quem recebe a edição: rodízio por carga.
 *
 * Ninguém fica de fora por ter gravação marcada (antes isso tirava todos os
 * videomakers da roda e a captação ficava parada em "Pendente edição").
 * Ordem: menos tarefas abertas → sem gravação próxima → editor dedicado → nome.
 */
export function escolherEditor(candidatos: EditorCandidato[]): EditorCandidato | null {
  if (candidatos.length === 0) return null;
  const ordenados = [...candidatos].sort((a, b) => {
    if (a.tarefasAbertas !== b.tarefasAbertas) return a.tarefasAbertas - b.tarefasAbertas;
    if (a.temGravacaoProxima !== b.temGravacaoProxima) return a.temGravacaoProxima ? 1 : -1;
    const aEditor = a.role === "editor" ? 0 : 1;
    const bEditor = b.role === "editor" ? 0 : 1;
    if (aEditor !== bEditor) return aEditor - bEditor;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
  return ordenados[0];
}
