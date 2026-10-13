// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

export const CATEGORIAS = ["alteracao", "trafego", "reuniao", "duvida", "outro"] as const;
export type Categoria = typeof CATEGORIAS[number];

export const STATUSES = ["aberta", "em_andamento", "concluida", "cancelada"] as const;
export type Status = typeof STATUSES[number];

export const PRIORIDADES = ["normal", "urgente"] as const;
export type Prioridade = typeof PRIORIDADES[number];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  alteracao: "Alteração em arte/vídeo",
  trafego: "Pedido de tráfego",
  reuniao: "Reunião / estratégia",
  duvida: "Dúvida geral",
  outro: "Outro",
};

export const STATUS_LABEL: Record<Status, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  normal: "Normal",
  urgente: "Urgente",
};
