export type ReviewStatus = "revisao_interna" | "revisao_cliente" | "ajustes" | "aprovado";
export type AutorTipo = "time" | "cliente";

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  revisao_interna: "Em revisão interna",
  revisao_cliente: "Em revisão do cliente",
  ajustes: "Ajustes solicitados",
  aprovado: "Aprovado",
};

const TRANSICOES: Record<ReviewStatus, ReviewStatus[]> = {
  revisao_interna: ["revisao_cliente"],
  revisao_cliente: ["aprovado", "ajustes"],
  ajustes: ["revisao_cliente"],
  aprovado: [],
};

export function podeTransicionar(de: ReviewStatus, para: ReviewStatus): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
