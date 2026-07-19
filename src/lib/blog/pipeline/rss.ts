// SERVER — busca e normaliza notícias dos feeds RSS.
import Parser from "rss-parser";
import { FEEDS } from "./feeds";

export interface NoticiaItem {
  titulo: string;
  link: string;
  resumo: string;
  publicadoEm: string | null; // ISO
  fonteNome: string;
}

/** Ordena por data (recentes primeiro); itens sem data vão pro fim. */
export function ordenarPorData(itens: NoticiaItem[]): NoticiaItem[] {
  return [...itens].sort((a, b) => (b.publicadoEm ?? "").localeCompare(a.publicadoEm ?? ""));
}

/** Remove notícias cujo link já foi usado (dedup contra fonte_url dos posts). */
export function filtrarNovas(itens: NoticiaItem[], jaUsados: Set<string>): NoticiaItem[] {
  const vistos = new Set<string>();
  return itens.filter((it) => {
    if (!it.link || jaUsados.has(it.link) || vistos.has(it.link)) return false;
    vistos.add(it.link);
    return true;
  });
}

/** Busca as notícias de todos os feeds (best-effort: feed que falha é ignorado). */
export async function buscarNoticias(limitePorFeed = 5): Promise<NoticiaItem[]> {
  const parser = new Parser({ timeout: 12000 });
  const out: NoticiaItem[] = [];
  await Promise.all(
    FEEDS.map(async (feed) => {
      try {
        const r = await parser.parseURL(feed.url);
        for (const it of (r.items ?? []).slice(0, limitePorFeed)) {
          if (!it.link || !it.title) continue;
          out.push({
            titulo: it.title.trim(),
            link: it.link.trim(),
            resumo: ((it.contentSnippet ?? it.content ?? "") as string).replace(/\s+/g, " ").trim().slice(0, 800),
            publicadoEm: it.isoDate ?? null,
            fonteNome: feed.nome,
          });
        }
      } catch (e) {
        console.error("[blog-pipeline] feed falhou:", feed.url, e instanceof Error ? e.message : e);
      }
    }),
  );
  return ordenarPorData(out);
}
