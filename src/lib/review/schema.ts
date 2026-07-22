export type ReviewStatus = "revisao_interna" | "revisao_cliente" | "ajustes" | "aprovado";
export type AutorTipo = "time" | "cliente";

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  revisao_interna: "Em revisão interna",
  revisao_cliente: "Em revisão do cliente",
  ajustes: "Ajustes solicitados",
  aprovado: "Aprovado",
};

const TRANSICOES: Record<ReviewStatus, ReviewStatus[]> = {
  // Da revisão interna: aprova (vai pro cliente) OU pede alteração (volta pro editor).
  revisao_interna: ["revisao_cliente", "ajustes"],
  revisao_cliente: ["aprovado", "ajustes"],
  // Em ajustes: o editor sobe nova versão → volta pra revisão interna (ou cliente).
  ajustes: ["revisao_interna", "revisao_cliente"],
  aprovado: [],
};

export function podeTransicionar(de: ReviewStatus, para: ReviewStatus): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
