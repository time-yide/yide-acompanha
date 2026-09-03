import "server-only";

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface TrendSearchResult {
  query: string;
  results: SearchResult[];
  searched_at: string;
}

export async function searchTrends(
  palavrasChave: string[],
  mesAlvo: string,
  nicho: string,
): Promise<TrendSearchResult[]> {
  const apiKey = process.env.SEARCH_API_KEY;
  if (!apiKey) {
    console.warn("SEARCH_API_KEY not set, skipping web search");
    return [];
  }

  const queries = [
    `tendências ${nicho} ${mesAlvo} redes sociais`,
    `conteúdo viral ${nicho} instagram ${mesAlvo}`,
    ...palavrasChave
      .slice(0, 2)
      .map((kw) => `${kw} ${mesAlvo} marketing digital`),
  ];

  const results: TrendSearchResult[] = [];

  for (const query of queries) {
    try {
      const res = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&search_lang=pt-br`,
        {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": apiKey,
          },
        },
      );

      if (!res.ok) {
        console.error(`Search failed for "${query}": ${res.status}`);
        continue;
      }

      const json = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const webResults: SearchResult[] = (json.web?.results ?? [])
        .slice(0, 5)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any) => ({
          title: r.title,
          snippet: r.description,
          url: r.url,
        }));

      results.push({
        query,
        results: webResults,
        searched_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(`Search error for "${query}":`, err);
    }
  }

  return results;
}
