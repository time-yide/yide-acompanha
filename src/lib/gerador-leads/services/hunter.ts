// SERVER ONLY - Hunter.io API client (Domain Search)
//
// Docs: https://hunter.io/api-documentation/v2#domain-search
//
// Endpoint usado: /domain-search → dado um domínio, retorna lista de emails
// + nome + cargo + LinkedIn (quando disponível) das pessoas associadas.
//
// Free tier: 25 buscas/mês (sem cartão).
// Sem HUNTER_API_KEY configurada → retorna { skipped: true }, não bloqueia
// o fluxo de enriquecimento (site scraper + IA continuam funcionando).

import { getServerEnv } from "@/lib/env";

const HUNTER_BASE = "https://api.hunter.io/v2";
const FETCH_TIMEOUT_MS = 15_000;

export interface HunterEmailFinding {
  value: string;            // email
  type: "personal" | "generic";
  confidence: number | null; // 0-100 (Hunter retorna null pra alguns)
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  department: string | null;
  linkedin: string | null;
  twitter: string | null;
  phone_number: string | null;
}

export interface HunterDomainSearchResult {
  ok: boolean;
  /** True quando HUNTER_API_KEY ausente - não é erro, só skip */
  skipped: boolean;
  error: string | null;
  organization: string | null;
  emails: HunterEmailFinding[];
}

/**
 * Busca contatos de um domínio no Hunter.io.
 */
export async function hunterDomainSearch(domain: string | null | undefined): Promise<HunterDomainSearchResult> {
  const result: HunterDomainSearchResult = {
    ok: false,
    skipped: false,
    error: null,
    organization: null,
    emails: [],
  };

  if (!domain || !domain.trim()) {
    result.error = "Domínio vazio";
    return result;
  }

  const env = getServerEnv();
  const apiKey = env.HUNTER_API_KEY;
  if (!apiKey) {
    result.skipped = true;
    return result;
  }

  const url = new URL(`${HUNTER_BASE}/domain-search`);
  url.searchParams.set("domain", domain.trim().toLowerCase());
  url.searchParams.set("api_key", apiKey);
  // Limita a 10 emails (suficiente; cada email conta 1 crédito no free tier? Não - domain-search
  // conta como 1 request independente do número retornado).
  url.searchParams.set("limit", "10");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!resp.ok) {
      // 401 = sem créditos; 403 = key inválida; 422 = domínio inválido
      const text = await resp.text().catch(() => "");
      result.error = `HTTP ${resp.status}: ${text.slice(0, 200)}`;
      return result;
    }

    const json = await resp.json() as {
      data?: {
        organization?: string | null;
        emails?: Array<{
          value: string;
          type: "personal" | "generic";
          confidence: number | null;
          first_name: string | null;
          last_name: string | null;
          position: string | null;
          department: string | null;
          linkedin: string | null;
          twitter: string | null;
          phone_number: string | null;
        }>;
      };
    };

    result.ok = true;
    result.organization = json.data?.organization ?? null;
    result.emails = (json.data?.emails ?? []).map((e) => ({
      value: e.value,
      type: e.type,
      confidence: e.confidence,
      first_name: e.first_name,
      last_name: e.last_name,
      position: e.position,
      department: e.department,
      linkedin: e.linkedin,
      twitter: e.twitter,
      phone_number: e.phone_number,
    }));
    return result;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  } finally {
    clearTimeout(timer);
  }
}
