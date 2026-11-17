import type { Pergunta } from "./servicos-conteudo";

// Preço de entrada da Yide, mostrado nas páginas de serviço e no FAQ.
export const PRECO_A_PARTIR = "R$ 1.000";

export const FRASE_PRECO = `Os planos da Yide começam a partir de ${PRECO_A_PARTIR}. A verba de anúncios é paga à parte, direto ao Google e à Meta.`;

export function perguntaPreco(nomeServico: string): Pergunta {
  return {
    pergunta: `Quanto custa ${nomeServico.toLowerCase()} com a Yide?`,
    resposta: `${FRASE_PRECO} O valor exato depende do tamanho da operação e é definido no diagnóstico gratuito, sem compromisso.`,
  };
}
