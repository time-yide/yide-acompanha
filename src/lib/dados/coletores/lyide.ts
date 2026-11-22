// SERVER ONLY
import "server-only";
import type { ResumoCrm } from "../regras";
import type { Periodo } from "../tipos";

/** Mesma env do /conversas: LYIDE_API_URL + LYIDE_API_SECRET. Endpoints da Parte 1. */
function cfg() {
  const url = process.env.LYIDE_API_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.LYIDE_API_SECRET?.trim();
  return url && secret ? { url, secret } : null;
}
async function lget<T>(path: string): Promise<T | null> {
  const c = cfg();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}${path}`, { headers: { authorization: `Bearer ${c.secret}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) { console.error("[dados/lyide]", path.split("?")[0], res.status); return null; }
    return (await res.json()) as T;
  } catch (e) { console.error("[dados/lyide]", e); return null; }
}

export async function coletarCrmLyide(slug: string, p: Periodo): Promise<{ atual: ResumoCrm; anterior: ResumoCrm } | null> {
  const qs = new URLSearchParams({ de: p.de, ate: p.ate });
  const j = await lget<{ atual: ResumoCrm; anterior: ResumoCrm }>(`/api/external/empresas/${encodeURIComponent(slug)}/resumo?${qs.toString()}`);
  return j ? { atual: j.atual, anterior: j.anterior } : null;
}

export async function listarEmpresasLyide(): Promise<Array<{ slug: string; name: string }>> {
  const j = await lget<{ empresas: Array<{ slug: string; name: string }> }>("/api/external/empresas");
  return j?.empresas ?? [];
}
