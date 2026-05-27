// SERVER ONLY - CNPJá API client (Pesquisa CNPJ / Office Search)
//
// Docs: https://cnpja.com/dev
//
// Endpoint: GET /office com filtros names.in / address.state.in /
// address.country.id.in / status.id.in. Retorna lista paginada em
// `{ records: [...] }`. Custa 1 crédito por 10 registros.
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
  socios: CnpjaSocio[];
  /** True quando o endpoint retornou >1 resultado pro nome+cidade. */
  multiplos_resultados: boolean;
}

/**
 * Parser puro do response da CNPJá. Exportado pra ser testável sem fetch.
 *
 * Estrutura esperada do CNPJá `/office` (Pesquisa CNPJ):
 * ```
 * {
 *   taxId: "12345678000190",
 *   company: {
 *     name: "EMPRESA EXEMPLO LTDA",
 *     members: [
 *       { person: { name: "..." }, role: { text: "..." }, since: "YYYY-MM-DD" }
 *     ]
 *   },
 *   alias: "Empresa Exemplo",  // nome fantasia
 *   address: {...}
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
      socios: [],
      multiplos_resultados: multiplosResultados,
    };
  }

  // Sócios estão em raw.company.members no response real da Pesquisa CNPJ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members: any[] = Array.isArray(raw?.company?.members)
    ? raw.company.members
    : [];
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
  // names.in: termos separados por espaço = AND no mesmo estabelecimento
  url.searchParams.set("names.in", empresa);
  // Filtra por UF (CNPJá não tem filtro por nome de cidade, só por UF ou município IBGE)
  if (estado) url.searchParams.set("address.state.in", estado);
  // Força Brasil (M49 country code = 76) pra evitar matches em empresas estrangeiras
  url.searchParams.set("address.country.id.in", "76");
  // Só empresas ativas (status.id 2 = Ativa)
  url.searchParams.set("status.id.in", "2");
  // Limita a 5 resultados (custo: 1 crédito por 10 registros, então 5 = 1 crédito)
  url.searchParams.set("limit", "5");

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
