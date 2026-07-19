// Banco de temas estratégicos (GEO/EEAT) — perguntas curadas que viram artigos
// aprofundados pergunta-resposta. Editável à vontade: some perguntas por pilar.
import { slugify } from "../slug";

export interface TemaEstrategico {
  pilar: string;
  pergunta: string;
}

/**
 * Perguntas reais que donos de PMEs pesquisam, agrupadas por pilar. O pipeline
 * transforma cada uma num artigo. Slug derivado da pergunta (ver `slugDoTema`)
 * garante que um mesmo tema não seja gerado duas vezes.
 */
export const TEMAS_ESTRATEGICOS: TemaEstrategico[] = [
  // Tráfego pago (Meta/Google Ads)
  { pilar: "Tráfego pago", pergunta: "Como reduzir o custo por lead no Meta Ads?" },
  { pilar: "Tráfego pago", pergunta: "Vale a pena anunciar no Google Ads para loja de iPhone?" },
  { pilar: "Tráfego pago", pergunta: "Meta Ads ou Google Ads: qual escolher em 2026?" },
  { pilar: "Tráfego pago", pergunta: "Quanto investir em tráfego pago em 2026?" },
  { pilar: "Tráfego pago", pergunta: "Por que meus anúncios no Meta Ads não estão vendendo?" },
  { pilar: "Tráfego pago", pergunta: "Como estruturar campanhas no Meta Ads para gerar vendas?" },
  { pilar: "Tráfego pago", pergunta: "O que é ROAS e qual é um bom ROAS para pequenas empresas?" },
  { pilar: "Tráfego pago", pergunta: "Como fazer remarketing no Meta Ads sem gastar muito?" },

  // Marketing local / Google Meu Negócio
  { pilar: "Marketing local", pergunta: "Google Meu Negócio: como aparecer em primeiro nas buscas locais?" },
  { pilar: "Marketing local", pergunta: "Como conseguir mais avaliações no Google para minha empresa?" },
  { pilar: "Marketing local", pergunta: "Como fazer marketing para uma empresa que atende só uma cidade?" },
  { pilar: "Marketing local", pergunta: "O que é SEO local e como ranquear no Google Maps?" },
  { pilar: "Marketing local", pergunta: "Como atrair clientes para uma loja física usando marketing digital?" },

  // CRM / Kommo
  { pilar: "CRM", pergunta: "Qual CRM usar em uma pequena empresa?" },
  { pilar: "CRM", pergunta: "Como estruturar um funil de vendas no Kommo?" },
  { pilar: "CRM", pergunta: "Vale a pena ter um CRM se minha empresa é pequena?" },
  { pilar: "CRM", pergunta: "Como integrar o WhatsApp ao CRM da minha empresa?" },
  { pilar: "CRM", pergunta: "Como acompanhar as vendas da equipe usando um CRM?" },

  // IA no comercial
  { pilar: "IA no comercial", pergunta: "Como usar IA no atendimento comercial?" },
  { pilar: "IA no comercial", pergunta: "Como usar inteligência artificial para vender mais?" },
  { pilar: "IA no comercial", pergunta: "Vale a pena usar chatbot com IA no WhatsApp da empresa?" },
  { pilar: "IA no comercial", pergunta: "Como a IA pode qualificar leads automaticamente?" },
  { pilar: "IA no comercial", pergunta: "Quais tarefas do comercial dá para automatizar com IA?" },

  // Vendas / funil
  { pilar: "Vendas", pergunta: "Como vender mais pelo WhatsApp?" },
  { pilar: "Vendas", pergunta: "Como aumentar as vendas de uma assistência técnica de celular?" },
  { pilar: "Vendas", pergunta: "Como gerar leads para clínicas de estética?" },
  { pilar: "Vendas", pergunta: "Como montar um funil de vendas do zero?" },
  { pilar: "Vendas", pergunta: "Por que meus leads não viram clientes?" },
  { pilar: "Vendas", pergunta: "Como criar um script de vendas que converte?" },
  { pilar: "Vendas", pergunta: "Como fazer follow up de vendas sem ser chato?" },

  // Gestão / processos
  { pilar: "Gestão", pergunta: "Como organizar o setor comercial de uma empresa?" },
  { pilar: "Gestão", pergunta: "Como padronizar o atendimento ao cliente na minha empresa?" },
  { pilar: "Gestão", pergunta: "Quais indicadores acompanhar no comercial de uma PME?" },
  { pilar: "Gestão", pergunta: "Como criar processos numa empresa que depende só do dono?" },
  { pilar: "Gestão", pergunta: "Como fazer reunião de vendas semanal que funciona?" },

  // Finanças / precificação
  { pilar: "Finanças", pergunta: "Como precificar meus produtos e serviços corretamente?" },
  { pilar: "Finanças", pergunta: "Quanto uma pequena empresa deve investir em marketing por mês?" },
  { pilar: "Finanças", pergunta: "Como calcular o custo de aquisição de cliente (CAC)?" },
  { pilar: "Finanças", pergunta: "Como saber se meu marketing está dando lucro?" },
  { pilar: "Finanças", pergunta: "Como separar as finanças da empresa das finanças pessoais?" },

  // Contratação
  { pilar: "Contratação", pergunta: "Como contratar um bom vendedor para minha empresa?" },
  { pilar: "Contratação", pergunta: "Vale a pena contratar uma agência de marketing ou montar time interno?" },
  { pilar: "Contratação", pergunta: "Como remunerar vendedores com comissão de forma justa?" },
  { pilar: "Contratação", pergunta: "Como treinar um vendedor iniciante rapidamente?" },
];

/** Slug estável derivado da pergunta do tema (mesma regra dos títulos). */
export function slugDoTema(pergunta: string): string {
  return slugify(pergunta);
}
