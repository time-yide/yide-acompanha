import "server-only";

export interface NichoConfig {
  query: string;
  limite: number;
}

const CIDADE = "Cuiabá";

export const NICHOS: NichoConfig[] = [
  // Saúde
  { query: "clínica odontológica", limite: 20 },
  { query: "clínica médica", limite: 20 },
  { query: "clínica de estética", limite: 20 },
  { query: "clínica de fisioterapia", limite: 20 },
  { query: "clínica de psicologia", limite: 20 },
  { query: "clínica veterinária", limite: 20 },
  { query: "nutricionista", limite: 20 },
  { query: "oftalmologista", limite: 15 },
  { query: "dermatologista", limite: 15 },
  { query: "ortopedista", limite: 15 },
  { query: "pediatra", limite: 15 },
  { query: "laboratório de análises clínicas", limite: 15 },
  { query: "farmácia de manipulação", limite: 15 },

  // Jurídico / Contábil
  { query: "escritório de advocacia", limite: 20 },
  { query: "escritório de contabilidade", limite: 20 },
  { query: "consultoria empresarial", limite: 15 },

  // Alimentação
  { query: "restaurante", limite: 20 },
  { query: "pizzaria", limite: 15 },
  { query: "hamburgueria", limite: 15 },
  { query: "cafeteria", limite: 15 },
  { query: "sorveteria", limite: 15 },
  { query: "padaria", limite: 15 },
  { query: "açaí", limite: 15 },
  { query: "churrascaria", limite: 15 },

  // Beleza / Estética
  { query: "salão de beleza", limite: 20 },
  { query: "barbearia", limite: 20 },
  { query: "studio de unhas", limite: 15 },
  { query: "studio de sobrancelha", limite: 15 },
  { query: "spa", limite: 15 },

  // Fitness
  { query: "academia", limite: 20 },
  { query: "studio de pilates", limite: 15 },
  { query: "crossfit", limite: 15 },
  { query: "personal trainer", limite: 15 },

  // Educação
  { query: "escola de idiomas", limite: 15 },
  { query: "autoescola", limite: 15 },
  { query: "escola particular", limite: 15 },
  { query: "curso profissionalizante", limite: 15 },

  // Comércio
  { query: "loja de roupas", limite: 20 },
  { query: "loja de calçados", limite: 15 },
  { query: "joalheria", limite: 15 },
  { query: "ótica", limite: 15 },
  { query: "loja de móveis", limite: 15 },
  { query: "loja de materiais de construção", limite: 15 },
  { query: "pet shop", limite: 20 },
  { query: "floricultura", limite: 15 },
  { query: "loja de eletrônicos", limite: 15 },
  { query: "loja de cosméticos", limite: 15 },
  { query: "papelaria", limite: 15 },
  { query: "loja de suplementos", limite: 15 },

  // Serviços
  { query: "imobiliária", limite: 20 },
  { query: "concessionária de veículos", limite: 15 },
  { query: "oficina mecânica", limite: 20 },
  { query: "lava jato", limite: 15 },
  { query: "hotel", limite: 15 },
  { query: "pousada", limite: 15 },
  { query: "agência de viagens", limite: 15 },
  { query: "construtora", limite: 15 },
  { query: "arquitetura", limite: 15 },
  { query: "engenharia civil", limite: 15 },
  { query: "energia solar", limite: 15 },
  { query: "segurança eletrônica", limite: 15 },
  { query: "empresa de limpeza", limite: 15 },
  { query: "lavanderia", limite: 15 },
  { query: "gráfica", limite: 15 },
  { query: "fotografia", limite: 15 },
  { query: "corretora de seguros", limite: 15 },

  // Automação / Tecnologia
  { query: "empresa de automação", limite: 15 },
  { query: "empresa de tecnologia", limite: 15 },
  { query: "consultoria de TI", limite: 15 },

  // Eventos
  { query: "casa de festas", limite: 15 },
  { query: "buffet", limite: 15 },
  { query: "decoração de festas", limite: 15 },
  { query: "DJ", limite: 15 },
];

export function montarQueryCompleta(nicho: NichoConfig): string {
  return `${nicho.query} em ${CIDADE}`;
}

export const CIDADE_PADRAO = CIDADE;
