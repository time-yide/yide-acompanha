// Funções PURAS pras métricas do blog (testáveis, sem I/O).

const BOT_UA = [
  "bot", "crawl", "spider", "slurp", "bingpreview", "facebookexternalhit",
  "whatsapp", "telegrambot", "preview", "headless", "curl", "wget",
  "python-requests", "axios", "httpclient", "pingdom", "lighthouse", "gtmetrix",
];

/** Heurística simples pra não contar robôs/crawlers/prévias como visita. */
export function ehBot(ua: string): boolean {
  const s = (ua || "").toLowerCase();
  if (!s) return true; // requisição sem user-agent = provável bot/health-check
  return BOT_UA.some((b) => s.includes(b));
}

const DIA_MS = 86_400_000;
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // BRT = UTC-3

/** Data (YYYY-MM-DD) no fuso de Brasília a partir de um timestamp em ms. */
export function diaBRT(ms: number): string {
  return new Date(ms - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Agrupa timestamps de visita em baldes diários (fuso BRT), do dia mais antigo
 * ao mais recente, cobrindo os últimos `dias` dias terminando em `hojeMs`.
 * Dias sem visita entram com total 0 (bom pro gráfico não ter buracos).
 */
export function agruparVisitasPorDia(
  datasIso: string[],
  hojeMs: number,
  dias: number,
): { dia: string; total: number }[] {
  const baldes = new Map<string, number>();
  for (let i = dias - 1; i >= 0; i--) {
    baldes.set(diaBRT(hojeMs - i * DIA_MS), 0);
  }
  for (const iso of datasIso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) continue;
    const d = diaBRT(t);
    if (baldes.has(d)) baldes.set(d, (baldes.get(d) ?? 0) + 1);
  }
  return [...baldes.entries()].map(([dia, total]) => ({ dia, total }));
}

/** Conta quantas visitas cada post recebeu, a partir de uma lista de post_id. */
export function contarVisitasPorPost(postIds: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const id of postIds) m[id] = (m[id] ?? 0) + 1;
  return m;
}

/**
 * Ranqueia as palavras-chave mais usadas nos posts (case-insensitive),
 * ordenando por frequência e, no empate, alfabeticamente.
 */
export function rankearKeywords(
  listas: string[][],
  limite = 15,
): { keyword: string; total: number }[] {
  const m = new Map<string, number>();
  for (const lista of listas) {
    for (const kRaw of lista) {
      const k = kRaw.trim().toLowerCase();
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limite)
    .map(([keyword, total]) => ({ keyword, total }));
}
