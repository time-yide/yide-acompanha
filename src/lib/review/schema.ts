export type ReviewStatus = "revisao_interna" | "revisao_cliente" | "ajustes" | "aprovado";
export type AutorTipo = "time" | "cliente";

export const STATUS_LABEL: Record<ReviewStatus, string> = {
  revisao_interna: "Em revisão interna",
  revisao_cliente: "Em revisão do cliente",
  ajustes: "Ajustes solicitados",
  aprovado: "Aprovado",
};

const TRANSICOES: Record<ReviewStatus, ReviewStatus[]> = {
  // Revisão interna: aprova o vídeo OU pede alteração.
  revisao_interna: ["aprovado", "ajustes", "revisao_cliente"],
  revisao_cliente: ["aprovado", "ajustes"],
  // Em ajustes: nova versão volta pra revisão; ou aprova direto.
  ajustes: ["revisao_interna", "aprovado", "revisao_cliente"],
  aprovado: [],
};

export function podeTransicionar(de: ReviewStatus, para: ReviewStatus): boolean {
  return TRANSICOES[de]?.includes(para) ?? false;
}
