// Cases em vídeo (Shorts do canal da Yide no YouTube). Só números já divulgados
// publicamente pela Yide; sem número, o destaque é o que foi feito.
export interface CaseVideo {
  cliente: string;
  segmento: string;
  local: string;
  destaque: string; // número ou frase curta em destaque
  rotulo: string;
  resumo: string;
  youtubeId: string;
  duracao: string; // ISO 8601, para o JSON-LD
}

export const CASES_VIDEO: CaseVideo[] = [
  { cliente: "Nazca Sushi", segmento: "Delivery", local: "Cuiabá-MT", destaque: "R$ 400 mil", rotulo: "por mês, saindo de R$ 20 mil",
    resumo: "Conteúdo que dá fome, anúncio na hora da fome e atendimento rápido no WhatsApp.", youtubeId: "pkGdOf6QeU8", duracao: "PT33S" },
  { cliente: "Kai Poke", segmento: "Delivery", local: "Cuiabá-MT", destaque: "+R$ 50 mil", rotulo: "por mês em 1 ano de delivery",
    resumo: "Começou com pouca verba, mediu tudo e aumentou só o que já vendia.", youtubeId: "1JtkT6MPUtI", duracao: "PT24S" },
  { cliente: "Casa 925", segmento: "Joalheria", local: "Cuiabá-MT", destaque: "7 dígitos", rotulo: "por ano, saindo de R$ 25 mil por mês",
    resumo: "Joia é compra de confiança: cada contato acompanhado do anúncio até a venda.", youtubeId: "xnJH_fl5Ef0", duracao: "PT1M7S" },
  { cliente: "Atena RH", segmento: "RH e recrutamento", local: "Cuiabá-MT", destaque: "1 campanha", rotulo: "para cada vaga aberta",
    resumo: "Anúncios para atrair candidatos e empresas, site e cada contato acompanhado pelo CRM.", youtubeId: "nx0dtPCvbxo", duracao: "PT52S" },
  { cliente: "Porto Motos", segmento: "Concessionária de motos", local: "", destaque: "Google + Instagram", rotulo: "levando interessados para o WhatsApp",
    resumo: "Anúncios no Instagram e no Google, com cada contato acompanhado até a venda.", youtubeId: "qEt1lq8ZnfA", duracao: "PT54S" },
  { cliente: "Bella Forma", segmento: "Clínica de estética", local: "", destaque: "Agenda cheia", rotulo: "com agendamentos pelo WhatsApp",
    resumo: "Anúncios trazendo agendamentos, atendimento rápido e acompanhamento de cada contato.", youtubeId: "VcdZd9unK_o", duracao: "PT1M32S" },
  { cliente: "Pantanal Autopeças", segmento: "Autopeças", local: "", destaque: "Pedidos no WhatsApp", rotulo: "vindos do Google e do Instagram",
    resumo: "Anúncios trazendo pedidos de peças pelo WhatsApp, com cada conversa acompanhada até a venda.", youtubeId: "xYuHB4mJfzM", duracao: "PT44S" },
  { cliente: "CCR", segmento: "Varejo", local: "", destaque: "Loja + WhatsApp", rotulo: "clientes chegando pelo Google",
    resumo: "Anúncios no Google e no Instagram levando clientes para a loja e para o WhatsApp.", youtubeId: "MqLjc4EoY04", duracao: "PT54S" },
  { cliente: "Meira Imports", segmento: "Importados", local: "", destaque: "Direto no WhatsApp", rotulo: "com tráfego pago",
    resumo: "Anúncios no Instagram e no Google levando clientes direto para o WhatsApp.", youtubeId: "P3iIc8usdas", duracao: "PT41S" },
  { cliente: "Centra MT", segmento: "B2B", local: "Mato Grosso", destaque: "Marketing B2B", rotulo: "com cada oportunidade no CRM",
    resumo: "Anúncios, conteúdo e acompanhamento de cada oportunidade para uma empresa B2B.", youtubeId: "NMrQ8VqMsXU", duracao: "PT32S" },
];
