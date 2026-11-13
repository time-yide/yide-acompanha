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
  // Nichos e cidades da prospecção ativa (vêm primeiro: o pipeline pega os não usados na ordem)
  { pilar: "Alimentação", pergunta: "Quanto custa tráfego pago para restaurante em Cuiabá em 2027?" },
  { pilar: "Alimentação", pergunta: "Vale a pena anunciar no Instagram em Primavera do Leste?" },
  { pilar: "Alimentação", pergunta: "Como uma pizzaria aumenta os pedidos pelo WhatsApp com anúncios?" },
  { pilar: "Alimentação", pergunta: "Hamburgueria em Cuiabá: Instagram, iFood ou WhatsApp, onde investir?" },
  { pilar: "Alimentação", pergunta: "Como um restaurante consegue mais avaliações no Google em Mato Grosso?" },
  { pilar: "Varejo", pergunta: "Como uma loja de roupas vende pelo WhatsApp sem ter site?" },
  { pilar: "Varejo", pergunta: "Quanto investir em anúncios para uma loja física em Cuiabá?" },
  { pilar: "Varejo", pergunta: "Joalheria e semijoias: como vender mais pelo Instagram?" },
  { pilar: "Varejo", pergunta: "Como uma loja de materiais de construção atrai clientes pelo Google?" },
  { pilar: "Automotivo", pergunta: "Google ou Instagram: onde anunciar uma oficina mecânica?" },
  { pilar: "Automotivo", pergunta: "Como uma loja de autopeças aparece no Google Maps em Cuiabá?" },
  { pilar: "Automotivo", pergunta: "Lava jato: como lotar a agenda com marketing digital?" },
  { pilar: "Construção", pergunta: "Como uma construtora gera clientes com tráfego pago em Mato Grosso?" },
  { pilar: "Construção", pergunta: "Energia solar: como conseguir orçamentos pelo WhatsApp com anúncios?" },
  { pilar: "Beleza e fitness", pergunta: "Como uma academia em Cuiabá consegue mais alunos com anúncios?" },
  { pilar: "Beleza e fitness", pergunta: "Studio de pilates: Instagram ou Google para atrair alunas?" },
  { pilar: "Beleza e fitness", pergunta: "Barbearia: como encher a agenda usando o Instagram?" },
  { pilar: "Educação", pergunta: "Escola de idiomas: como captar alunos com tráfego pago?" },
  { pilar: "Educação", pergunta: "Escola particular em Cuiabá: como fazer marketing para matrículas?" },
  { pilar: "Pet e serviços", pergunta: "Pet shop: como vender banho e tosa pelo WhatsApp?" },
  { pilar: "Pet e serviços", pergunta: "Lavanderia: como conseguir clientes no bairro com anúncios locais?" },
  { pilar: "Turismo", pergunta: "Pousada e hotel em Mato Grosso: como vender reservas sem depender de site de reserva?" },
  { pilar: "Agência", pergunta: "Quanto tempo leva para o tráfego pago dar resultado?" },
  { pilar: "Agência", pergunta: "Agência ou freelancer: o que vale mais para uma pequena empresa?" },
  { pilar: "Agência", pergunta: "O que uma agência de marketing faz por uma empresa de Primavera do Leste?" },

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
