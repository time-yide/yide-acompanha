import type { Pergunta } from "./servicos-conteudo";
import { PRECO_A_PARTIR } from "./preco";

// Perguntas de quem busca "agência de marketing em Cuiabá" (seção local da home).
export const FAQ_LOCAL: Pergunta[] = [
  {
    pergunta: "Quanto custa uma agência de marketing em Cuiabá?",
    resposta: `Na Yide, os planos começam a partir de ${PRECO_A_PARTIR}. A verba de anúncios é paga à parte, direto ao Google e à Meta. O valor exato sai do diagnóstico gratuito, de acordo com os serviços e o tamanho da empresa.`,
  },
  {
    pergunta: "A Yide atende presencialmente em Cuiabá e Várzea Grande?",
    resposta: "Sim. A sede fica na R. Martinica, 267, Jardim das Américas, em Cuiabá. Fazemos reuniões presenciais com empresas de Cuiabá e Várzea Grande e atendemos o resto de Mato Grosso e do Brasil online.",
  },
  {
    pergunta: "O que uma agência de marketing faz pela minha empresa?",
    resposta: "Planeja e roda os anúncios no Google e no Instagram, produz conteúdo e vídeo, cuida do site e organiza o atendimento no WhatsApp com o Lyide, o CRM com IA da Yide. O foco é transformar seguidor e clique em cliente que compra.",
  },
  {
    pergunta: "Em quanto tempo aparecem os resultados?",
    resposta: "Com anúncios, as primeiras conversas costumam chegar já na primeira semana. Os ajustes que baixam o custo por cliente acontecem nos meses seguintes, acompanhados em relatório com custo por conversa e por venda.",
  },
];
