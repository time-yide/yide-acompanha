// SERVER ONLY
import "server-only";
import type { Periodo } from "../tipos";

/**
 * Leitura via System User Token da BM Yide. Env: META_SYSTEM_USER_TOKEN
 * (só leitura; a coleta antiga foi removida no #988, este é o substituto enxuto).
 * O token vai no header Authorization, nunca na URL.
 */
const V = process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";
const BASE = `https://graph.facebook.com/${V}`;

export const idMetaValido = (id: string) => /^\d{1,25}$/.test(id);
export const contaAnunciosValida = (id: string) => /^(act_)?\d{1,25}$/.test(id);

/** `caminho` já vem montado (ids passam por encodeURIComponent em quem chama). */
async function graphCaminho<T>(caminho: string, rotulo: string, params: Record<string, string>, token = process.env.META_SYSTEM_USER_TOKEN?.trim()): Promise<T | null> {
  if (!token) return null;
  try {
    const qs = new URLSearchParams(params);
    const url = `${BASE}/${caminho}?${qs.toString()}`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      let detalhe = "";
      try {
        const j = (await res.json()) as { error?: { code?: number; message?: string } };
        detalhe = [j.error?.code, j.error?.message].filter(Boolean).join(" ");
      } catch { /* corpo não-JSON */ }
      console.error("[dados/meta]", rotulo, res.status, detalhe);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.error("[dados/meta]", e instanceof Error ? `${e.name}: ${e.message}` : "erro");
    return null;
  }
}

function graph<T>(id: string, sufixo: string, params: Record<string, string>, token = process.env.META_SYSTEM_USER_TOKEN?.trim()): Promise<T | null> {
  return graphCaminho<T>(`${encodeURIComponent(id)}${sufixo}`, sufixo || "node", params, token);
}

type Pagina<T> = { data?: T[]; paging?: { cursors?: { after?: string }; next?: string } };
const MAX_PAGINAS = 10;

/** Percorre `/me/<edge>` pelo cursor `after` (100 por página, até 10 páginas). null = falha em qualquer página. */
async function listarMe<T>(edge: string, fields: string): Promise<T[] | null> {
  const itens: T[] = [];
  let after: string | undefined;
  for (let i = 0; i < MAX_PAGINAS; i++) {
    const params: Record<string, string> = { fields, limit: "100" };
    if (after) params.after = after;
    const j = await graphCaminho<Pagina<T>>(`me/${edge}`, `/me/${edge}`, params);
    if (!j) return null;
    itens.push(...(j.data ?? []));
    after = j.paging?.cursors?.after;
    if (!j.paging?.next || !after) return itens;
  }
  console.warn("[dados/meta]", `/me/${edge}`, `parou em ${MAX_PAGINAS} páginas (${itens.length} itens); pode haver mais`);
  return itens;
}

export interface PaginaMeta { pageId: string; nome: string; igId: string | null; igUsername: string | null }
export interface ContaAnuncioMeta { id: string; nome: string; empresa: string | null }

/** Páginas que o System User enxerga + Instagram ligado a cada uma. null = falha/sem token. */
export async function listarPaginasMeta(): Promise<PaginaMeta[] | null> {
  type R = { id: string; name?: string; instagram_business_account?: { id?: string; username?: string } };
  const r = await listarMe<R>("accounts", "id,name,instagram_business_account{id,username}");
  if (!r) return null;
  return r.filter((p) => idMetaValido(p.id)).map((p) => {
    const igId = p.instagram_business_account?.id;
    return {
      pageId: p.id, nome: p.name ?? "",
      igId: igId && idMetaValido(igId) ? igId : null,
      igUsername: p.instagram_business_account?.username?.toLowerCase() ?? null,
    };
  });
}

/** Contas de anúncio que o System User enxerga. null = falha/sem token. */
export async function listarContasAnunciosMeta(): Promise<ContaAnuncioMeta[] | null> {
  type R = { id: string; name?: string; business_name?: string; account_status?: number };
  const r = await listarMe<R>("adaccounts", "id,name,business_name,account_status");
  if (!r) return null;
  // account_status 1 = ativa (2 desativada, 3 sem pagamento, 101 fechada…).
  return r.filter((c) => c.account_status === 1 && contaAnunciosValida(c.id)).map((c) => ({
    id: c.id.startsWith("act_") ? c.id : `act_${c.id}`, nome: c.name ?? "", empresa: c.business_name || null,
  }));
}

function contarNoPeriodo(datas: string[], p: Periodo): number {
  const de = new Date(`${p.de}T00:00:00-03:00`).getTime();
  const ate = new Date(`${p.ate}T23:59:59-03:00`).getTime();
  return datas.filter((d) => { const t = new Date(d).getTime(); return t >= de && t <= ate; }).length;
}

export async function coletarInstagram(igId: string, p: Periodo) {
  if (!idMetaValido(igId)) return null;
  const j = await graph<{ data?: Array<{ timestamp: string }> }>(igId, "/media", { fields: "timestamp", limit: "50" });
  if (!j) return null;
  const datas = (j.data ?? []).map((m) => m.timestamp);
  return { ultimoPost: datas[0] ?? null, postsPeriodo: contarNoPeriodo(datas, p) };
}

export async function coletarFacebook(pageId: string, p: Periodo) {
  if (!idMetaValido(pageId)) return null;
  const page = await graph<{ access_token?: string }>(pageId, "", { fields: "access_token" });
  if (!page?.access_token) return null;
  const j = await graph<{ data?: Array<{ created_time: string }> }>(pageId, "/published_posts", { fields: "created_time", limit: "50" }, page.access_token);
  if (!j) return null;
  const datas = (j.data ?? []).map((m) => m.created_time);
  return { ultimoPost: datas[0] ?? null, postsPeriodo: contarNoPeriodo(datas, p) };
}

export async function coletarAnuncios(adAccountId: string, p: Periodo, ultimos7: Periodo) {
  if (!contaAnunciosValida(adAccountId)) return null;
  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  type R = { data?: Array<{ spend?: string; clicks?: string; impressions?: string }> };
  const [a, b] = await Promise.all([
    graph<R>(act, "/insights", { fields: "spend,clicks,impressions", time_range: JSON.stringify({ since: p.de, until: p.ate }) }),
    graph<R>(act, "/insights", { fields: "spend", time_range: JSON.stringify({ since: ultimos7.de, until: ultimos7.ate }) }),
  ]);
  if (!a || !b) return null;
  return {
    gasto: Number(a.data?.[0]?.spend ?? 0),
    cliques: Number(a.data?.[0]?.clicks ?? 0),
    impressoes: Number(a.data?.[0]?.impressions ?? 0),
    gasto7d: Number(b.data?.[0]?.spend ?? 0),
  };
}
