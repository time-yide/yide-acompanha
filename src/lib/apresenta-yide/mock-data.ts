import type { Slide } from "./tipos";

/**
 * Conjunto de slides de exemplo, usado em PR 1 pra popular apresentação
 * recém-criada (sem AI ainda). PR 2 substitui isso por Claude streaming.
 */
export const MOCK_APRESENTACAO_SLIDES: Slide[] = [
  {
    template: "capa",
    content: {
      template: "capa",
      titulo: "Apresentação Yide",
      subtitulo: "Crescimento digital com previsibilidade",
    },
  },
  {
    template: "conteudo",
    content: {
      template: "conteudo",
      titulo: "Quem somos",
      texto: "A Yide é uma agência de marketing digital focada em performance e gestão de presença online pra empresas que querem crescer com previsibilidade.",
      bullets: [
        "+ de 100 clientes ativos",
        "Time multidisciplinar e dedicado",
        "Acompanhamento em tempo real",
      ],
    },
  },
  {
    template: "metrica",
    content: {
      template: "metrica",
      numero: "+34%",
      label: "Crescimento médio em 6 meses",
      descricao: "Dados reais dos clientes ativos da Yide em 2026",
    },
  },
  {
    template: "duas_colunas",
    content: {
      template: "duas_colunas",
      titulo: "Antes vs. depois com a Yide",
      coluna_esquerda: {
        titulo: "Antes",
        texto: "Sem dados centralizados, decisões no escuro, ROI difícil de medir.",
      },
      coluna_direita: {
        titulo: "Depois",
        texto: "Painel próprio em tempo real, decisões baseadas em dados, ROI claro mês a mês.",
      },
    },
  },
  {
    template: "topicos_numerados",
    content: {
      template: "topicos_numerados",
      titulo: "Nossa metodologia",
      topicos: [
        { titulo: "Diagnóstico", texto: "Entendemos seu negócio e seus números" },
        { titulo: "Estratégia", texto: "Plano sob medida com metas claras" },
        { titulo: "Execução", texto: "Time dedicado entrega no ritmo certo" },
        { titulo: "Mensuração", texto: "Painel em tempo real e ajustes contínuos" },
      ],
    },
  },
  {
    template: "encerramento",
    content: {
      template: "encerramento",
      mensagem: "Vamos crescer juntos?",
      cta: "Fale com a gente",
    },
  },
];
