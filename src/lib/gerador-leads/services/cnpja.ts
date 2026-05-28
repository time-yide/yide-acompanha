// SERVER ONLY - CNPJá API client (Office Search)
//
// Docs: https://cnpja.com/dev
//
// Endpoint: /office?query.search=...&query.city=... (busca por razão social)
// Retorna CNPJ + razão social + sócios em 1 call no plano Basic.
//
// Free tier: 100 consultas/mês. Sem CNPJA_API_KEY → retorna { skipped: true }.

import { getServerEnv } from "@/lib/env";

const CNPJA_BASE = "https://api.cnpja.com";
const FETCH_TIMEOUT_MS = 15_000;

export interface CnpjaSocio {
  nome: string;
  qualificacao: string;
  data_entrada: string | null;
}

export interface CnpjLookupResult {
  ok: boolean;
  /** True quando CNPJA_API_KEY ausente - não é erro, só skip. */
  skipped: boolean;
  error: string | null;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  /** Telefone oficial cadastrado na Receita (pode ser antigo/do contador). */
  telefone: string | null;
  /** Email oficial cadastrado na Receita. */
  email: string | null;
  socios: CnpjaSocio[];
  /** True quando o endpoint retornou >1 resultado pro nome+cidade. */
  multiplos_resultados: boolean;
}

/**
 * Extrai o primeiro telefone do response da CNPJá. A Receita devolve
 * `phones: [{ area, number }]`. Defensivo: aceita também telefone como
 * string crua, e retorna null se nada utilizável.
 */
function parsePhone(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0];
  if (typeof first === "string") {
    const digits = first.replace(/\D/g, "");
    return digits || null;
  }
  if (first && typeof first === "object") {
    const o = first as { area?: unknown; number?: unknown };
    const area = String(o.area ?? "").replace(/\D/g, "");
    const number = String(o.number ?? "").replace(/\D/g, "");
    const joined = `${area}${number}`;
    return joined || null;
  }
  return null;
}

/**
 * Extrai o primeiro email do response da CNPJá (`emails: [{ address }]`).
 */
function parseEmail(raw: unknown): string | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const first = raw[0];
  if (typeof first === "string") return first.trim() || null;
  if (first && typeof first === "object") {
    const addr = String((first as { address?: unknown }).address ?? "").trim();
    return addr || null;
  }
  return null;
}

/**
 * Parser puro do response da CNPJá. Exportado pra ser testável sem fetch.
 *
 * Estrutura esperada do CNPJá `/office`:
 * ```
 * {
 *   taxId: "12345678000190",
 *   company: { name: "EMPRESA EXEMPLO LTDA" },
 *   alias: "Empresa Exemplo",  // nome fantasia
 *   phones: [{ area: "65", number: "999999999" }],
 *   emails: [{ address: "contato@empresa.com" }],
 *   members: [
 *     { person: { name: "..." }, role: { text: "..." }, since: "YYYY-MM-DD" }
 *   ]
 * }
 * ```
 */
export function parseCnpjaResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
  multiplosResultados: boolean,
): CnpjLookupResult {
  if (!raw || typeof raw !== "object" || !raw.taxId) {
    return {
      ok: false,
      skipped: false,
      error: "Response sem taxId",
      cnpj: null,
      razao_social: null,
      nome_fantasia: null,
      telefone: null,
      email: null,
      socios: [],
      multiplos_resultados: multiplosResultados,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: any[] = Array.isArray(raw.members) ? raw.members : [];
  const socios: CnpjaSocio[] = members
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m: any) => ({
      nome: String(m?.person?.name ?? "").trim(),
      qualificacao: String(m?.role?.text ?? "").trim(),
      data_entrada: m?.since ?? null,
    }))
    .filter((s) => s.nome);

  return {
    ok: true,
    skipped: false,
    error: null,
    cnpj: String(raw.taxId),
    razao_social: raw.company?.name ?? null,
    nome_fantasia: raw.alias ?? null,
    telefone: parsePhone(raw.phones),
    email: parseEmail(raw.emails),
    socios,
    multiplos_resultados: multiplosResultados,
  };
}

/**
 * Busca empresa por razão social + cidade. Retorna o melhor match (primeiro do array)
 * + flag `multiplos_resultados` se houve mais de 1.
 */
export async function searchCnpjByName(
  empresa: string,
  cidade: string,
  estado?: string,
): Promise<CnpjLookupResult> {
  const empty: CnpjLookupResult = {
    ok: false,
    skipped: false,
    error: null,
    cnpj: null,
    razao_social: null,
    nome_fantasia: null,
    telefone: null,
    email: null,
    socios: [],
    multiplos_resultados: false,
  };

  const env = getServerEnv();
  const apiKey = env.CNPJA_API_KEY;
  if (!apiKey) {
    return { ...empty, skipped: true };
  }

  if (!empresa.trim() || !cidade.trim()) {
    return { ...empty, error: "Empresa ou cidade vazia" };
  }

  const url = new URL(`${CNPJA_BASE}/office`);
  url.searchParams.set("query.search", empresa);
  url.searchParams.set("query.city", cidade);
  if (estado) url.searchParams.set("query.state", estado);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: apiKey,
        Accept: "application/json",
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      return { ...empty, error: `HTTP ${resp.status}: ${body.slice(0, 200) || resp.statusText}` };
    }

    const data = await resp.json();

    // CNPJá `/office` pode retornar:
    // - Objeto direto (1 resultado)
    // - { records: [...] } (múltiplos)
    let firstRecord = data;
    let multiplos = false;
    if (Array.isArray(data?.records)) {
      if (data.records.length === 0) {
        return { ...empty, error: "Empresa não encontrada" };
      }
      firstRecord = data.records[0];
      multiplos = data.records.length > 1;
    }

    return parseCnpjaResponse(firstRecord, multiplos);
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
