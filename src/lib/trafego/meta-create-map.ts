// Mapeamentos PUROS (sem I/O) usados pra criar anúncios no Meta.
// Testados em tests/unit/trafego-meta-criar.test.ts.

/**
 * Resultado do mapeamento de objetivo interno → parâmetros do Meta.
 * `objective` vai na campanha; `optimizationGoal` no ad set; `callToAction`
 * no botão do criativo.
 */
export interface MetaObjetivoMap {
  objective: string;
  optimizationGoal: string;
  callToAction: string;
}

/**
 * Mapeia o objetivo interno da campanha pros parâmetros do Meta.
 * V1 suporta APENAS "trafego" e "engajamento". Outros → null (não suportado).
 */
export function objetivoParaMeta(objetivo: string | null | undefined): MetaObjetivoMap | null {
  switch (objetivo) {
    case "trafego":
      return {
        objective: "OUTCOME_TRAFFIC",
        optimizationGoal: "LINK_CLICKS",
        callToAction: "LEARN_MORE",
      };
    case "engajamento":
      return {
        objective: "OUTCOME_ENGAGEMENT",
        optimizationGoal: "POST_ENGAGEMENT",
        callToAction: "LEARN_MORE",
      };
    default:
      return null;
  }
}

/**
 * Converte um valor em reais (number) pra inteiro em centavos, arredondando.
 * Rejeita valores <= 0 (lança). Ex.: 30 → 3000, 12.5 → 1250.
 */
export function reaisParaCents(valor: number): number {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    throw new Error("Orçamento inválido: informe um valor em reais maior que zero");
  }
  return Math.round(valor * 100);
}

export interface TargetingInput {
  /** Códigos de país ISO-2 (ex.: ["BR"]). Default ["BR"]. */
  paises?: string[];
  /** Idade mínima. Default 18. */
  idadeMin?: number;
  /** Idade máxima. Default 65. */
  idadeMax?: number;
  /** Gêneros no formato Meta: 1=masculino, 2=feminino. Omitir/vazio = todos. */
  generos?: number[];
}

export interface MetaTargeting {
  geo_locations: { countries: string[] };
  age_min: number;
  age_max: number;
  genders?: number[];
}

/**
 * Monta o objeto `targeting` do Meta a partir de segmentação simples.
 * Defaults: países ["BR"], idade 18–65, gêneros ambos (omite `genders`).
 * `generos` só é incluído quando tem exatamente masculino OU feminino (não ambos).
 */
export function montarTargeting(input: TargetingInput = {}): MetaTargeting {
  const paises =
    input.paises && input.paises.length > 0
      ? input.paises.map((p) => p.trim().toUpperCase()).filter(Boolean)
      : ["BR"];

  const idadeMin = input.idadeMin ?? 18;
  const idadeMax = input.idadeMax ?? 65;

  const out: MetaTargeting = {
    geo_locations: { countries: paises.length > 0 ? paises : ["BR"] },
    age_min: idadeMin,
    age_max: idadeMax,
  };

  // Normaliza gêneros: só 1 e/ou 2. Se cobrir ambos (ou vazio), omite = todos.
  const generos = (input.generos ?? []).filter((g) => g === 1 || g === 2);
  const unicos = Array.from(new Set(generos));
  if (unicos.length === 1) {
    out.genders = unicos;
  }

  return out;
}
