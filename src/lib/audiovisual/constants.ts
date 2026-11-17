// Constantes e helpers puros (sem zod). Componentes client importam daqui
// em vez de ./schema pra não puxar o zod (~90KB) pro bundle do navegador.
// ./schema re-exporta tudo, então imports do servidor seguem funcionando.

export const RATING_FIELDS = [
  { name: "rating_organizacao", label: "Organização do cliente" },
  { name: "rating_facilidade", label: "Facilidade na gravação" },
  { name: "rating_execucao_roteiro", label: "Execução do roteiro" },
  { name: "rating_atrasos", label: "Pontualidade (sem atrasos)" },
  { name: "rating_comunicacao", label: "Comunicação" },
  { name: "rating_retrabalho", label: "Sem retrabalho" },
  { name: "rating_colaboracao", label: "Colaboração durante a captação" },
] as const;
