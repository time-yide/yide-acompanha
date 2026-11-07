export interface SeedServico { nome: string; slug: string; descricao_base: string; ordem: number }
export interface SeedLocalidade { nome: string; tipo: "cidade" | "estado"; uf: string; slug: string }

export const SEED_SERVICOS: SeedServico[] = [
  { nome: "Gestão de Tráfego Pago", slug: "gestao-de-trafego", ordem: 1,
    descricao_base: "Anúncios no Google Ads, Meta Ads e Instagram para gerar leads e vendas, com acompanhamento de custo por venda." },
  { nome: "CRM com IA (Lyide)", slug: "crm-ia-dados", ordem: 2,
    descricao_base: "CRM com IA que responde seus leads no WhatsApp em segundos, organiza o funil e mostra qual anúncio trouxe cada venda." },
  { nome: "Gravação e Audiovisual", slug: "audiovisual", ordem: 3,
    descricao_base: "Produção de vídeos, reels e gravações para redes sociais e anúncios, do roteiro à edição." },
  { nome: "Gestão de Redes Sociais", slug: "redes-sociais", ordem: 4,
    descricao_base: "Conteúdo e gestão de perfis no Instagram e outras redes, com calendário editorial e foco em vendas." },
  { nome: "Criação de Sites e Landing Pages", slug: "criacao-de-sites", ordem: 5,
    descricao_base: "Sites, landing pages e sistemas rápidos, otimizados para Google e para conversão." },
  { nome: "E-commerce e Loja Virtual", slug: "ecommerce", ordem: 6,
    descricao_base: "Criação e gestão de loja virtual, do catálogo ao checkout, com tráfego e recuperação de vendas." },
  { nome: "Marketplaces e Mercado Livre", slug: "marketplaces", ordem: 7,
    descricao_base: "Venda no Mercado Livre, Shopee e Amazon: cadastro, anúncios, reputação e Mercado Ads." },
  { nome: "Assessoria de Marketing e Vendas", slug: "assessoria-de-marketing", ordem: 8,
    descricao_base: "Planejamento e acompanhamento de marketing e vendas para empresas que querem crescer com método." },
  { nome: "SEO e Perfil da Empresa no Google", slug: "seo-google", ordem: 9,
    descricao_base: "Posicionamento no Google e nas respostas de IA: SEO, Perfil da Empresa, avaliações e conteúdo." },
];

export const SEED_LOCALIDADES: SeedLocalidade[] = [
  { nome: "Cuiabá", tipo: "cidade", uf: "MT", slug: "cuiaba" },
  { nome: "Várzea Grande", tipo: "cidade", uf: "MT", slug: "varzea-grande" },
  { nome: "Rondonópolis", tipo: "cidade", uf: "MT", slug: "rondonopolis" },
  { nome: "Sinop", tipo: "cidade", uf: "MT", slug: "sinop" },
  { nome: "Sorriso", tipo: "cidade", uf: "MT", slug: "sorriso" },
  { nome: "Tangará da Serra", tipo: "cidade", uf: "MT", slug: "tangara-da-serra" },
  { nome: "Lucas do Rio Verde", tipo: "cidade", uf: "MT", slug: "lucas-do-rio-verde" },
  { nome: "Primavera do Leste", tipo: "cidade", uf: "MT", slug: "primavera-do-leste" },
  { nome: "Salvador", tipo: "cidade", uf: "BA", slug: "salvador" },
  { nome: "Vila Velha", tipo: "cidade", uf: "ES", slug: "vila-velha" },
  { nome: "Mato Grosso", tipo: "estado", uf: "MT", slug: "mato-grosso" },
  { nome: "Bahia", tipo: "estado", uf: "BA", slug: "bahia" },
  { nome: "Espírito Santo", tipo: "estado", uf: "ES", slug: "espirito-santo" },
];

export const YIDE_PERFIS = [
  "https://www.instagram.com/yide.digital/",
  // Perfil da Empresa no Google (YIDE DIGITAL)
  "https://maps.google.com/?cid=14243144777750195365",
];

export const YIDE_NAP = {
  nome: "Yide Digital", telefone: "+55 65 99306-3452", email: "yidedigital@gmail.com",
  rua: "R. Martinica, 280 - Jardim das Américas", cep: "78060-644",
  cidade: "Cuiabá", uf: "MT", pais: "BR", site: "https://yidedigital.com.br",
  geo: { lat: -15.6059688, lng: -56.0671207 },
};
