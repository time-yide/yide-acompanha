// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

export const PESQUISA_STATUS = ["rascunho", "aberta", "encerrada"] as const;
export type PesquisaStatus = (typeof PESQUISA_STATUS)[number];

export const PESQUISA_STATUS_LABEL: Record<PesquisaStatus, string> = {
  rascunho: "Rascunho",
  aberta: "Aberta",
  encerrada: "Encerrada",
};

export const PERGUNTA_TIPOS = ["multipla_escolha", "escala", "sim_nao", "texto"] as const;
export type PerguntaTipo = (typeof PERGUNTA_TIPOS)[number];

export const PERGUNTA_TIPO_LABEL: Record<PerguntaTipo, string> = {
  multipla_escolha: "Múltipla escolha",
  escala: "Escala / nota",
  sim_nao: "Sim / Não",
  texto: "Texto aberto",
};
