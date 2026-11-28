// Vistoria — regras puras (client-safe): categorias, permissões, código do QR e resumos.

export const CATEGORIAS_EQUIPAMENTO = [
  "computador",
  "camera",
  "lente",
  "audio",
  "iluminacao",
  "suporte",
  "armazenamento",
  "acessorio",
  "outro",
] as const;
export type CategoriaEquipamento = (typeof CATEGORIAS_EQUIPAMENTO)[number];

export const CATEGORIA_LABEL: Record<CategoriaEquipamento, string> = {
  computador: "Computador",
  camera: "Câmera",
  lente: "Lente",
  audio: "Áudio (microfone/gravador)",
  iluminacao: "Iluminação",
  suporte: "Tripé / suporte",
  armazenamento: "Cartão / HD / SSD",
  acessorio: "Acessório / cabo",
  outro: "Outro",
};

export const STATUS_EQUIPAMENTO = ["ativo", "manutencao", "baixado"] as const;
export type StatusEquipamento = (typeof STATUS_EQUIPAMENTO)[number];

export const STATUS_EQUIPAMENTO_LABEL: Record<StatusEquipamento, string> = {
  ativo: "Ativo",
  manutencao: "Em manutenção",
  baixado: "Baixado",
};

/** Quem gerencia o estoque (cadastra, atribui, imprime etiquetas). */
export const ROLES_GERENCIAM_VISTORIA = ["adm", "socio", "audiovisual_chefe"] as const;

export function podeGerenciarVistoria(role: string): boolean {
  return (ROLES_GERENCIAM_VISTORIA as readonly string[]).includes(role);
}

// Sem I, O, 0, 1 — pra quem digita o código à mão não se confundir.
const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TAMANHO_CODIGO = 6;

/** Gera código tipo "YD-7K3QP2". `rand` é injetável pra teste. */
export function gerarCodigoEquipamento(rand: () => number = Math.random): string {
  let sufixo = "";
  for (let i = 0; i < TAMANHO_CODIGO; i++) {
    sufixo += ALFABETO_CODIGO[Math.floor(rand() * ALFABETO_CODIGO.length)];
  }
  return `YD-${sufixo}`;
}

/**
 * Normaliza o que veio do scanner ou do campo de digitação.
 * Aceita "yd-7k3qp2", " YD-7K3QP2 " ou uma URL que termina no código.
 */
export function normalizarCodigo(entrada: string): string {
  const limpo = entrada.trim();
  const ultimoSegmento = limpo.split(/[/?#=]/).filter(Boolean).pop() ?? "";
  return ultimoSegmento.trim().toUpperCase();
}

export interface EquipamentoParaResumo {
  categoria: CategoriaEquipamento | string;
  status: StatusEquipamento | string;
  responsavel_id: string | null;
}

export interface ResumoEstoque {
  total: number;
  /** Ativos e sem responsável: guardados no estoque. */
  noEstoque: number;
  /** Ativos e com alguém. */
  comResponsavel: number;
  emManutencao: number;
  baixados: number;
  porCategoria: Record<string, number>;
}

/** Contagens do estoque. Baixados entram no total, mas não contam como disponíveis. */
export function resumoEstoque(itens: EquipamentoParaResumo[]): ResumoEstoque {
  const resumo: ResumoEstoque = {
    total: itens.length,
    noEstoque: 0,
    comResponsavel: 0,
    emManutencao: 0,
    baixados: 0,
    porCategoria: {},
  };
  for (const it of itens) {
    resumo.porCategoria[it.categoria] = (resumo.porCategoria[it.categoria] ?? 0) + 1;
    if (it.status === "baixado") resumo.baixados++;
    else if (it.status === "manutencao") resumo.emManutencao++;
    else if (it.responsavel_id) resumo.comResponsavel++;
    else resumo.noEstoque++;
  }
  return resumo;
}

export interface ProgressoVistoria {
  total: number;
  conferidos: number;
  faltando: number;
  completa: boolean;
}

/** Quanto da lista da pessoa já foi conferido nesta semana. */
export function progressoVistoria(total: number, conferidos: number): ProgressoVistoria {
  const conferidosLimitado = Math.min(Math.max(conferidos, 0), total);
  return {
    total,
    conferidos: conferidosLimitado,
    faltando: total - conferidosLimitado,
    completa: total > 0 && conferidosLimitado === total,
  };
}
