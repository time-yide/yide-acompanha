/**
 * Classifica leads automaticamente em 3 bases de prospecção
 * baseado na categoria do Google Places.
 */

export type BaseProspeccao = "ecommerce" | "crm" | "marketing";

const ECOMMERCE_KEYWORDS = [
  "loja", "store", "shop", "varejo", "retail", "boutique",
  "magazine", "atacado", "distribuidora", "distribuidor",
  "marketplace", "e-commerce", "ecommerce", "comércio",
  "comercio", "mercado", "supermercado", "hipermercado",
  "papelaria", "livraria", "floricultura", "pet shop",
  "petshop", "brechó", "brecho", "ótica", "otica",
  "joalheria", "relojoaria", "calçados", "calcados",
  "roupa", "moda", "vestuário", "vestuario", "acessórios",
  "acessorios", "cosméticos", "cosmeticos", "perfumaria",
  "farmácia", "farmacia", "drogaria", "sex shop",
  "bazar", "armarinho", "tecido", "móveis", "moveis",
  "eletrodomésticos", "eletrodomesticos", "eletrônicos",
  "eletronicos", "informática", "informatica", "celular",
  "autopeças", "autopecas", "material de construção",
  "ferragem", "ferreteria", "tintas", "casa e jardim",
  "decoração", "decoracao", "colchões", "colchoes",
  "brinquedo", "artesanato", "artigos esportivos",
  "suplemento", "natural", "empório", "emporio",
  "conveniência", "conveniencia", "tabacaria",
  "antiquário", "antiquario", "galeria de arte",
  "instrumentos musicais", "discos", "games", "jogos",
  "bike", "bicicleta", "pesca", "camping",
  "bebidas", "adega", "vinhos", "cervejas",
];

const CRM_KEYWORDS = [
  "escritório", "escritorio", "consultoria", "assessoria",
  "advocacia", "advogado", "contabilidade", "contador",
  "clínica", "clinica", "consultório", "consultorio",
  "médico", "medico", "dentista", "odontologia",
  "psicólogo", "psicologo", "fisioterapia", "nutricionista",
  "veterinário", "veterinario", "hospital", "laboratório",
  "laboratorio", "diagnóstico", "diagnostico",
  "imobiliária", "imobiliaria", "corretor", "seguros",
  "engenharia", "arquitetura", "construtora",
  "tecnologia", "software", "ti", "saas", "startup",
  "financeira", "investimento", "câmbio", "cambio",
  "despachante", "cartório", "cartorio", "registro",
  "escola", "curso", "faculdade", "universidade",
  "colégio", "colegio", "ensino", "educação", "educacao",
  "treinamento", "coaching", "mentoria",
  "logística", "logistica", "transportadora", "frete",
  "agência de viagens", "turismo", "hotel", "pousada",
  "coworking", "co-working", "espaço compartilhado",
  "auditoria", "perícia", "pericia",
  "recrutamento", "rh", "recursos humanos",
  "tradução", "traducao", "intérprete", "interprete",
  "segurança", "seguranca", "vigilância", "vigilancia",
  "limpeza", "manutenção", "manutencao", "reforma",
  "elétrica", "eletrica", "hidráulica", "hidraulica",
  "ar condicionado", "refrigeração", "refrigeracao",
  "dedetização", "dedetizacao", "controle de pragas",
  "jardinagem", "paisagismo", "piscina",
  "assistência técnica", "assistencia tecnica",
  "oficina", "mecânica", "mecanica", "funilaria",
  "autoescola", "auto escola", "despachante",
];

/**
 * Classifica um lead com base na categoria do Google Places.
 * Retorna null se não conseguir classificar.
 */
export function classificarBase(categoria: string | null): BaseProspeccao | null {
  if (!categoria) return null;

  const lower = categoria.toLowerCase();

  const isEcommerce = ECOMMERCE_KEYWORDS.some((kw) => lower.includes(kw));
  if (isEcommerce) return "ecommerce";

  const isCrm = CRM_KEYWORDS.some((kw) => lower.includes(kw));
  if (isCrm) return "crm";

  return "marketing";
}

export const BASE_PROSPECCAO_DEFS: Record<BaseProspeccao, { label: string; color: string }> = {
  ecommerce: {
    label: "E-commerce",
    color: "border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300",
  },
  crm: {
    label: "CRM (Lyide)",
    color: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  marketing: {
    label: "Marketing",
    color: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
};
