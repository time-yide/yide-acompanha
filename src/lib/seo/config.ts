export interface SeedServico { nome: string; slug: string; descricao_base: string; ordem: number }
export interface SeedLocalidade { nome: string; tipo: "cidade" | "estado"; uf: string; slug: string }

export const SEED_SERVICOS: SeedServico[] = [
  { nome: "Gestão de Tráfego Pago", slug: "gestao-de-trafego", ordem: 1,
    descricao_base: "Gestão de anúncios no Google Ads, Meta Ads e Instagram para gerar leads e vendas com performance e dados." },
  { nome: "Criação de Sites e Sistemas", slug: "criacao-de-sites", ordem: 2,
    descricao_base: "Sites, landing pages e sistemas sob medida, rápidos, otimizados para SEO e conversão." },
  { nome: "Gestão de Redes Sociais", slug: "redes-sociais", ordem: 3,
    descricao_base: "Gestão de conteúdo e perfis (Instagram, etc.), calendário editorial e crescimento de audiência." },
  { nome: "CRM, IA e Dados", slug: "crm-ia-dados", ordem: 4,
    descricao_base: "Automação comercial, CRM, inteligência de dados e IA para escalar o comercial." },
];

export const SEED_LOCALIDADES: SeedLocalidade[] = [
  { nome: "Cuiabá", tipo: "cidade", uf: "MT", slug: "cuiaba" },
  { nome: "Várzea Grande", tipo: "cidade", uf: "MT", slug: "varzea-grande" },
  { nome: "Salvador", tipo: "cidade", uf: "BA", slug: "salvador" },
  { nome: "Vila Velha", tipo: "cidade", uf: "ES", slug: "vila-velha" },
  { nome: "Mato Grosso", tipo: "estado", uf: "MT", slug: "mato-grosso" },
  { nome: "Bahia", tipo: "estado", uf: "BA", slug: "bahia" },
  { nome: "Espírito Santo", tipo: "estado", uf: "ES", slug: "espirito-santo" },
];

export const YIDE_NAP = {
  nome: "Yide Digital", telefone: "+55 65 98144-7380", email: "yidedigital@gmail.com",
  cidade: "Cuiabá", uf: "MT", pais: "BR", site: "https://yidedigital.com.br",
};
