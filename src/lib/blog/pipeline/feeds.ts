// Fontes RSS confiáveis (marketing / tecnologia / IA). Ajuste a lista à vontade.
export interface Feed {
  url: string;
  nome: string;
}

export const FEEDS: Feed[] = [
  { url: "https://techcrunch.com/feed/", nome: "TechCrunch" },
  { url: "https://www.theverge.com/rss/index.xml", nome: "The Verge" },
  { url: "https://feeds.arstechnica.com/arstechnica/technology-lab", nome: "Ars Technica" },
  { url: "https://searchengineland.com/feed", nome: "Search Engine Land" },
  { url: "https://www.marketingdive.com/feeds/news/", nome: "Marketing Dive" },
  { url: "https://venturebeat.com/category/ai/feed/", nome: "VentureBeat AI" },
  { url: "https://www.artificialintelligence-news.com/feed/", nome: "AI News" },
];
