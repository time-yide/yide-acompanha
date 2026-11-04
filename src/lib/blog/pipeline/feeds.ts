// Fontes RSS de marketing, mídia e busca: o público do blog é dono de PME que quer vender mais.
export interface Feed {
  url: string;
  nome: string;
}

export const FEEDS: Feed[] = [
  { url: "https://searchengineland.com/feed", nome: "Search Engine Land" },
  { url: "https://www.marketingdive.com/feeds/news/", nome: "Marketing Dive" },
  { url: "https://www.socialmediatoday.com/feeds/news/", nome: "Social Media Today" },
  { url: "https://www.meioemensagem.com.br/feed", nome: "Meio & Mensagem" },
  { url: "https://propmark.com.br/feed/", nome: "Propmark" },
];
