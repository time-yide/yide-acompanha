// Tipos + funções puras de captura - SEM dependência de server.
// Permite importar de Client Components sem arrastar `next/headers` pro
// bundle do client (que é o que `queries.ts` traz via `supabase/server`).

export interface CapturaRow {
  id: string;
  event_id: string | null;
  client_id: string;
  videomaker_id: string;
  data_captacao: string;
  drive_url: string;
  qtd_videos: number;
  qtd_fotos: number;
  observacoes: string | null;
  rating_organizacao: number | null;
  rating_facilidade: number | null;
  rating_execucao_roteiro: number | null;
  rating_atrasos: number | null;
  rating_comunicacao: number | null;
  rating_retrabalho: number | null;
  rating_colaboracao: number | null;
  pontos_positivos: string | null;
  pontos_dificuldade: string | null;
  sugestoes: string | null;
  created_at: string;
  task_id: string | null;
  concluida_em: string | null;
  cliente?: { id: string; nome: string } | null;
  videomaker?: { id: string; nome: string } | null;
  task?: {
    id: string;
    titulo: string;
    status: string;
    atribuido_a: string;
    editor_nome: string | null;
  } | null;
}

/** Calcula a média (1-5) dos 7 ratings de uma captura. Null se algum faltar. */
export function avgRating(c: Pick<
  CapturaRow,
  | "rating_organizacao"
  | "rating_facilidade"
  | "rating_execucao_roteiro"
  | "rating_atrasos"
  | "rating_comunicacao"
  | "rating_retrabalho"
  | "rating_colaboracao"
>): number | null {
  const values = [
    c.rating_organizacao,
    c.rating_facilidade,
    c.rating_execucao_roteiro,
    c.rating_atrasos,
    c.rating_comunicacao,
    c.rating_retrabalho,
    c.rating_colaboracao,
  ];
  if (values.some((v) => v === null || v === undefined)) return null;
  const sum = values.reduce((s: number, v) => s + (v ?? 0), 0);
  return sum / values.length;
}
