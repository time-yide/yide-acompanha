# Gerador de Leads — Identificação do decisor via CNPJ + IG-deep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar lookup de CNPJ+sócios via CNPJá e Instagram-deep extension ao pipeline de enriquecimento de leads, com IA usando sócios da Receita como ground truth pra identificar o decisor.

**Architecture:** 2 services novos (`cnpja.ts`, `instagram-deep.ts`) plugados na função `enriquecerLeadAction` existente, sem mudar contrato externo. Migration adiciona 5 colunas em `leads_gerados`. UI ganha 1 card novo + indicador de confiança no card Decisor + 3 botões de ação rápida (tel/WhatsApp/Instagram).

**Tech Stack:** Next.js 16 App Router, Supabase, TypeScript, Zod, Vitest, Tailwind. APIs externas: CNPJá (nova, paga R$99/mês), Anthropic Claude (existente), Apify (existente).

**Spec:** [docs/superpowers/specs/2026-05-26-gerador-leads-decisor-cnpj-design.md](../specs/2026-05-26-gerador-leads-decisor-cnpj-design.md)

---

## File Structure

### Novos
- `supabase/migrations/20260526000000_leads_gerados_cnpj_socios.sql` — colunas novas
- `src/lib/gerador-leads/services/cnpja.ts` — CNPJá API wrapper
- `src/lib/gerador-leads/services/instagram-deep.ts` — extensão Apify pra IG pessoal
- `src/lib/gerador-leads/utils/string-match.ts` — normalize + similarity (Jaro-Winkler)
- `src/lib/gerador-leads/utils/cnpj.ts` — format CNPJ pra exibição
- `src/components/gerador-leads/IdentificacaoOficialCard.tsx` — card UI da Receita
- `tests/unit/gerador-leads-string-match.test.ts` — testes do similarity
- `tests/unit/gerador-leads-cnpj-utils.test.ts` — testes do formatter
- `tests/unit/gerador-leads-cnpja-parser.test.ts` — teste do parser de response
- `tests/unit/gerador-leads-schema.test.ts` — schema (novos campos)

### Modificados
- `src/lib/env.ts` — adicionar `CNPJA_API_KEY`
- `src/lib/gerador-leads/schema.ts` — adicionar campos editáveis (cnpj, decisor_whatsapp, decisor_instagram)
- `src/lib/gerador-leads/queries.ts` — incluir novos campos no SELECT
- `src/lib/gerador-leads/enrichment-actions.ts` — orchestrar 2 novos passos
- `src/lib/gerador-leads/services/ia-enrichment.ts` — input type + prompt
- `src/app/(authed)/gerador-leads/[id]/page.tsx` — renderizar card novo
- `src/components/gerador-leads/LeadEditCard.tsx` — indicador confiança + botões ação

---

## Task 1: Migration + Zod schema

**Files:**
- Create: `supabase/migrations/20260526000000_leads_gerados_cnpj_socios.sql`
- Modify: `src/lib/gerador-leads/schema.ts`
- Create: `tests/unit/gerador-leads-schema.test.ts`

- [ ] **Step 1.1: Criar migration SQL**

Cria `supabase/migrations/20260526000000_leads_gerados_cnpj_socios.sql`:

```sql
-- Adiciona campos pra identificação oficial do decisor via Receita Federal (CNPJá)
-- e contato pessoal do decisor (WhatsApp, Instagram).
--
-- - `cnpj`: CNPJ da empresa (sem formatação, ex: "12345678000190")
-- - `socios`: lista oficial de sócios retornada pelo CNPJá
-- - `socio_principal_qualificacao`: qualificação do sócio "principal" (administrador)
-- - `decisor_whatsapp` / `decisor_instagram`: contato pessoal do decisor

alter table public.leads_gerados
  add column if not exists cnpj text,
  add column if not exists socios jsonb not null default '[]'::jsonb,
  add column if not exists socio_principal_qualificacao text,
  add column if not exists decisor_whatsapp text,
  add column if not exists decisor_instagram text;

create index if not exists leads_gerados_cnpj_idx
  on public.leads_gerados(cnpj)
  where cnpj is not null;
```

- [ ] **Step 1.2: Aplicar migration manualmente no Supabase**

Sistema não roda migrations automaticamente em deploy (memória do usuário). Aplicar no SQL Editor do Supabase production após merge do PR.

Não há comando de teste local pra esse step — apenas documentar no PR description.

- [ ] **Step 1.3: Escrever testes do zod schema (TDD — escreve antes do code)**

Cria `tests/unit/gerador-leads-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { updateLeadSchema } from "@/lib/gerador-leads/schema";

const validUuid = "00000000-0000-0000-0000-000000000000";

describe("updateLeadSchema — novos campos", () => {
  it("aceita cnpj como string", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, cnpj: "12345678000190" });
    expect(r.success).toBe(true);
  });

  it("aceita cnpj null", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, cnpj: null });
    expect(r.success).toBe(true);
  });

  it("rejeita cnpj muito longo", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, cnpj: "x".repeat(50) });
    expect(r.success).toBe(false);
  });

  it("aceita decisor_whatsapp como string", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, decisor_whatsapp: "+5565999999999" });
    expect(r.success).toBe(true);
  });

  it("aceita decisor_instagram como string", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, decisor_instagram: "joaosilva_oficial" });
    expect(r.success).toBe(true);
  });

  it("rejeita decisor_instagram muito longo", () => {
    const r = updateLeadSchema.safeParse({ id: validUuid, decisor_instagram: "x".repeat(100) });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 1.4: Rodar testes pra confirmar que falham**

Run: `npm test -- gerador-leads-schema`
Expected: FAIL com "cnpj is not a known property" ou similar (campos ainda não existem no schema)

- [ ] **Step 1.5: Atualizar `src/lib/gerador-leads/schema.ts`**

Adicionar 3 campos novos no `updateLeadSchema`. Localizar o bloco que define `decisor_email` (linha ~30) e adicionar após:

```typescript
export const updateLeadSchema = z.object({
  id: uuidLike,
  status: z.enum(STATUS_LEAD_VALORES).optional(),
  observacoes: z.string().trim().max(4000).optional().nullable(),
  responsavel_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  empresa: z.string().trim().min(2).max(200).optional(),
  telefone: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(200).email().or(z.literal("")).optional().nullable(),
  website: z.string().trim().max(500).url().or(z.literal("")).optional().nullable(),
  instagram: z.string().trim().max(80).optional().nullable(),
  decisor_nome: z.string().trim().max(200).optional().nullable(),
  decisor_cargo: z.string().trim().max(120).optional().nullable(),
  decisor_email: z.string().trim().max(200).email().or(z.literal("")).optional().nullable(),
  // === Novos campos (PR decisor CNPJ + IG-deep) ===
  cnpj: z.string().trim().max(20).optional().nullable(),
  decisor_whatsapp: z.string().trim().max(40).optional().nullable(),
  decisor_instagram: z.string().trim().max(80).optional().nullable(),
});
```

- [ ] **Step 1.6: Rodar testes pra confirmar que passam**

Run: `npm test -- gerador-leads-schema`
Expected: PASS (todos os 6 it())

- [ ] **Step 1.7: Commit**

```bash
git add supabase/migrations/20260526000000_leads_gerados_cnpj_socios.sql \
        src/lib/gerador-leads/schema.ts \
        tests/unit/gerador-leads-schema.test.ts
git commit -m "feat(gerador-leads): schema pra CNPJ + decisor whatsapp/instagram"
```

---

## Task 2: Helpers (string-match e cnpj)

**Files:**
- Create: `src/lib/gerador-leads/utils/string-match.ts`
- Create: `src/lib/gerador-leads/utils/cnpj.ts`
- Create: `tests/unit/gerador-leads-string-match.test.ts`
- Create: `tests/unit/gerador-leads-cnpj-utils.test.ts`

- [ ] **Step 2.1: Escrever testes do string-match (TDD)**

Cria `tests/unit/gerador-leads-string-match.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalizeName, similarity } from "@/lib/gerador-leads/utils/string-match";

describe("normalizeName", () => {
  it("remove acentos e baixa case", () => {
    expect(normalizeName("João Da Silva")).toBe("joao da silva");
  });
  it("remove espaços extras", () => {
    expect(normalizeName("  JOÃO   DA  SILVA  ")).toBe("joao da silva");
  });
  it("retorna string vazia pra null", () => {
    expect(normalizeName(null)).toBe("");
  });
});

describe("similarity", () => {
  it("nomes iguais retornam 1.0", () => {
    expect(similarity("João Silva", "João Silva")).toBeCloseTo(1.0);
  });
  it("nomes parecidos retornam alto (>0.8)", () => {
    expect(similarity("João da Silva", "Joao Silva")).toBeGreaterThan(0.8);
  });
  it("nomes diferentes retornam baixo (<0.5)", () => {
    expect(similarity("João Silva", "Pedro Souza")).toBeLessThan(0.5);
  });
  it("um nome null retorna 0", () => {
    expect(similarity(null, "João Silva")).toBe(0);
  });
  it("nome com sobrenome a mais ainda casa bem", () => {
    // "João Silva" vs "João da Silva Santos" — mesma pessoa provavelmente
    expect(similarity("João Silva", "João da Silva Santos")).toBeGreaterThan(0.7);
  });
});
```

- [ ] **Step 2.2: Implementar `string-match.ts`**

Cria `src/lib/gerador-leads/utils/string-match.ts`:

```typescript
/**
 * Helpers de comparação fuzzy de nomes — usados pra cruzar nome do sócio
 * da Receita Federal com nomes detectados no site / Instagram.
 */

/**
 * Normaliza nome pra comparação: lowercase, sem acentos, sem espaços duplicados.
 */
export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove combining marks (acentos)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Similaridade entre dois nomes, 0.0 a 1.0.
 *
 * Estratégia simples e funcional pra nomes BR:
 * 1. Normaliza ambos
 * 2. Tokeniza por espaço, ignora palavras de 1-2 chars (preposições: "da", "de", "do")
 * 3. Conta tokens em comum / total de tokens únicos (Jaccard sobre palavras)
 *
 * Mais robusto que Levenshtein puro pra "João Silva" vs "João da Silva Santos".
 */
export function similarity(a: string | null | undefined, b: string | null | undefined): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const tokensA = new Set(normA.split(" ").filter((t) => t.length >= 3));
  const tokensB = new Set(normB.split(" ").filter((t) => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersect = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersect++;
  }
  const union = tokensA.size + tokensB.size - intersect;
  return intersect / union;
}
```

- [ ] **Step 2.3: Rodar testes do string-match**

Run: `npm test -- gerador-leads-string-match`
Expected: PASS (todos os it())

- [ ] **Step 2.4: Escrever testes do cnpj utils**

Cria `tests/unit/gerador-leads-cnpj-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatCnpj, stripCnpjFormat, isValidCnpjFormat } from "@/lib/gerador-leads/utils/cnpj";

describe("formatCnpj", () => {
  it("formata CNPJ sem máscara", () => {
    expect(formatCnpj("12345678000190")).toBe("12.345.678/0001-90");
  });
  it("retorna input se já vier formatado", () => {
    expect(formatCnpj("12.345.678/0001-90")).toBe("12.345.678/0001-90");
  });
  it("retorna null pra input null", () => {
    expect(formatCnpj(null)).toBe(null);
  });
  it("retorna input original se tiver tamanho errado", () => {
    expect(formatCnpj("123")).toBe("123");
  });
});

describe("stripCnpjFormat", () => {
  it("remove máscara", () => {
    expect(stripCnpjFormat("12.345.678/0001-90")).toBe("12345678000190");
  });
  it("retorna null pra null", () => {
    expect(stripCnpjFormat(null)).toBe(null);
  });
});

describe("isValidCnpjFormat", () => {
  it("aceita CNPJ de 14 dígitos limpo", () => {
    expect(isValidCnpjFormat("12345678000190")).toBe(true);
  });
  it("aceita CNPJ formatado", () => {
    expect(isValidCnpjFormat("12.345.678/0001-90")).toBe(true);
  });
  it("rejeita CNPJ curto", () => {
    expect(isValidCnpjFormat("123")).toBe(false);
  });
  it("rejeita null", () => {
    expect(isValidCnpjFormat(null)).toBe(false);
  });
});
```

- [ ] **Step 2.5: Implementar `cnpj.ts`**

Cria `src/lib/gerador-leads/utils/cnpj.ts`:

```typescript
/**
 * Helpers de formatação e validação de CNPJ (não valida dígitos verificadores —
 * confia no CNPJá; só checa tamanho/formato).
 */

/** Remove pontuação do CNPJ. "12.345.678/0001-90" -> "12345678000190" */
export function stripCnpjFormat(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  return cnpj.replace(/[^\d]/g, "") || null;
}

/** Formata CNPJ pra exibição. "12345678000190" -> "12.345.678/0001-90" */
export function formatCnpj(cnpj: string | null | undefined): string | null {
  if (!cnpj) return null;
  const clean = stripCnpjFormat(cnpj);
  if (!clean || clean.length !== 14) return cnpj; // retorna como veio se tamanho errado
  return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-${clean.slice(12, 14)}`;
}

/** True se string tem o formato de CNPJ (14 dígitos com ou sem máscara). */
export function isValidCnpjFormat(cnpj: string | null | undefined): boolean {
  const clean = stripCnpjFormat(cnpj);
  return clean !== null && clean.length === 14;
}
```

- [ ] **Step 2.6: Rodar testes do cnpj**

Run: `npm test -- gerador-leads-cnpj-utils`
Expected: PASS

- [ ] **Step 2.7: Commit**

```bash
git add src/lib/gerador-leads/utils/string-match.ts \
        src/lib/gerador-leads/utils/cnpj.ts \
        tests/unit/gerador-leads-string-match.test.ts \
        tests/unit/gerador-leads-cnpj-utils.test.ts
git commit -m "feat(gerador-leads): helpers de string-match e formatCnpj"
```

---

## Task 3: Env update

**Files:**
- Modify: `src/lib/env.ts`

- [ ] **Step 3.1: Adicionar `CNPJA_API_KEY` ao serverSchema**

Localizar bloco que define `HUNTER_API_KEY` em `src/lib/env.ts` (~linha 25) e adicionar depois:

```typescript
  // CNPJá - consulta CNPJ + sócios oficiais da Receita Federal.
  // Sem essa key, lookup é skip e enriquecimento usa só site scraping + Hunter + IA.
  // Free tier: 100 consultas/mês. Plano Basic R$99/mês = 15k consultas.
  // Cadastro em https://cnpja.com → Dashboard → API Keys.
  CNPJA_API_KEY: z.string().optional(),
```

- [ ] **Step 3.2: Verificar type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/env.ts
git commit -m "feat(gerador-leads): adiciona CNPJA_API_KEY opcional ao env"
```

---

## Task 4: Service cnpja.ts

**Files:**
- Create: `src/lib/gerador-leads/services/cnpja.ts`
- Create: `tests/unit/gerador-leads-cnpja-parser.test.ts`

- [ ] **Step 4.1: Escrever testes do parser de response (TDD)**

O service cnpja.ts vai exportar uma função pura `parseCnpjaResponse(raw)` que converte response da API pro tipo `CnpjLookupResult`. Esse parser é testável sem fetch.

Cria `tests/unit/gerador-leads-cnpja-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseCnpjaResponse } from "@/lib/gerador-leads/services/cnpja";

describe("parseCnpjaResponse", () => {
  it("extrai CNPJ e sócios do response esperado", () => {
    const raw = {
      taxId: "12345678000190",
      company: { name: "EMPRESA EXEMPLO LTDA" },
      alias: "Empresa Exemplo",
      members: [
        {
          person: { name: "JOÃO DA SILVA" },
          role: { text: "Sócio-Administrador" },
          since: "2020-03-15",
        },
        {
          person: { name: "MARIA SANTOS" },
          role: { text: "Sócio" },
          since: "2022-01-10",
        },
      ],
    };
    const result = parseCnpjaResponse(raw, false);
    expect(result.ok).toBe(true);
    expect(result.cnpj).toBe("12345678000190");
    expect(result.razao_social).toBe("EMPRESA EXEMPLO LTDA");
    expect(result.nome_fantasia).toBe("Empresa Exemplo");
    expect(result.socios).toHaveLength(2);
    expect(result.socios[0]).toEqual({
      nome: "JOÃO DA SILVA",
      qualificacao: "Sócio-Administrador",
      data_entrada: "2020-03-15",
    });
    expect(result.multiplos_resultados).toBe(false);
  });

  it("marca multiplos_resultados=true quando passado", () => {
    const raw = { taxId: "12345678000190", company: { name: "X" }, members: [] };
    const result = parseCnpjaResponse(raw, true);
    expect(result.multiplos_resultados).toBe(true);
  });

  it("retorna erro quando response não tem taxId", () => {
    const result = parseCnpjaResponse({}, false);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("taxId");
  });

  it("retorna socios vazio quando members ausente", () => {
    const raw = { taxId: "12345678000190", company: { name: "X" } };
    const result = parseCnpjaResponse(raw, false);
    expect(result.ok).toBe(true);
    expect(result.socios).toEqual([]);
  });
});
```

- [ ] **Step 4.2: Implementar `cnpja.ts` (parser primeiro, fetch depois)**

Cria `src/lib/gerador-leads/services/cnpja.ts`:

```typescript
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
  socios: CnpjaSocio[];
  /** True quando o endpoint retornou >1 resultado pro nome+cidade. */
  multiplos_resultados: boolean;
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
      return { ...empty, error: `HTTP ${resp.status}: ${resp.statusText}` };
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
```

- [ ] **Step 4.3: Rodar testes do parser**

Run: `npm test -- gerador-leads-cnpja-parser`
Expected: PASS (todos os 4 it())

- [ ] **Step 4.4: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/gerador-leads/services/cnpja.ts \
        tests/unit/gerador-leads-cnpja-parser.test.ts
git commit -m "feat(gerador-leads): service CNPJá pra lookup nome+cidade → sócios"
```

---

## Task 5: Service instagram-deep.ts

**Files:**
- Create: `src/lib/gerador-leads/services/instagram-deep.ts`

- [ ] **Step 5.1: Implementar `instagram-deep.ts`**

Sem teste unitário — depende do Apify (fetch externo) e o codebase não testa esse tipo de service externo.

Cria `src/lib/gerador-leads/services/instagram-deep.ts`:

```typescript
// SERVER ONLY - Instagram-deep: tenta inferir o perfil pessoal do dono
// da empresa, usando os dados do perfil corporativo do Instagram + nome
// do sócio da Receita Federal pra cruzar.
//
// Estratégia:
// 1. Pega últimos posts/tags do @empresaUsername (via mesma actor do Apify já usado)
// 2. Extrai @ mencionados com frequência
// 3. Pra cada candidato, compara nome do perfil com `decisorNome` via similarity()
// 4. Retorna melhor match com confidence baseado em similaridade + frequência
//
// Sem APIFY_API_TOKEN ou sem empresaUsername → retorna { username: null }.

import { getServerEnv } from "@/lib/env";
import { similarity, normalizeName } from "../utils/string-match";

const APIFY_BASE = "https://api.apify.com/v2";
const FETCH_TIMEOUT_MS = 60_000;

export interface OwnerInstagramResult {
  username: string | null;
  bio: string | null;
  telefone_no_bio: string | null;
  link_no_bio: string | null;
  confidence: "alta" | "media" | "baixa" | null;
}

const EMPTY: OwnerInstagramResult = {
  username: null,
  bio: null,
  telefone_no_bio: null,
  link_no_bio: null,
  confidence: null,
};

/**
 * Tenta encontrar o Instagram pessoal do decisor da empresa.
 *
 * @param empresaUsername - Username do IG corporativo (sem @)
 * @param decisorNome - Nome do decisor (do CNPJá idealmente; pode ser null)
 */
export async function findOwnerInstagram(
  empresaUsername: string | null | undefined,
  decisorNome: string | null | undefined,
): Promise<OwnerInstagramResult> {
  if (!empresaUsername || !decisorNome) return EMPTY;

  const env = getServerEnv();
  const apifyToken = env.APIFY_API_TOKEN;
  if (!apifyToken) return EMPTY;

  // Apify actor "apify/instagram-profile-scraper" pode buscar perfil +
  // últimos posts. Usa POST sync com payload simples.
  const actorId = "apify~instagram-profile-scraper";
  const url = `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${apifyToken}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        usernames: [empresaUsername],
        resultsLimit: 10,
        resultsType: "posts",
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!resp.ok) return EMPTY;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = await resp.json();
    if (!Array.isArray(items) || items.length === 0) return EMPTY;

    // Coleta candidatos: @ mencionados em captions + taggedUsers + ownerUsername
    const mentionCounts = new Map<string, number>();
    for (const post of items) {
      const caption: string = post?.caption ?? "";
      const matches = caption.match(/@([a-zA-Z0-9._]+)/g) ?? [];
      for (const m of matches) {
        const handle = m.slice(1).toLowerCase();
        if (handle === empresaUsername.toLowerCase()) continue;
        mentionCounts.set(handle, (mentionCounts.get(handle) ?? 0) + 1);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tagged: any[] = post?.taggedUsers ?? [];
      for (const t of tagged) {
        const handle = String(t?.username ?? "").toLowerCase();
        if (!handle || handle === empresaUsername.toLowerCase()) continue;
        mentionCounts.set(handle, (mentionCounts.get(handle) ?? 0) + 1);
      }
    }

    if (mentionCounts.size === 0) return EMPTY;

    // Pra cada candidato, busca o perfil dele pra pegar nome real
    const sorted = [...mentionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

    let bestMatch: { username: string; similarityScore: number; mentions: number; bio: string; fullName: string } | null = null;

    for (const [handle, mentions] of sorted) {
      const profileResp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          usernames: [handle],
          resultsLimit: 1,
          resultsType: "details",
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!profileResp.ok) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileData: any[] = await profileResp.json();
      const profile = profileData?.[0];
      if (!profile) continue;
      const fullName: string = profile?.fullName ?? "";
      const bio: string = profile?.biography ?? "";
      const score = similarity(fullName, decisorNome);
      if (!bestMatch || score > bestMatch.similarityScore) {
        bestMatch = { username: handle, similarityScore: score, mentions, bio, fullName };
      }
    }

    if (!bestMatch) return EMPTY;

    // Confidence baseado em similarity + mentions
    let confidence: OwnerInstagramResult["confidence"] = "baixa";
    if (bestMatch.similarityScore >= 0.8 && bestMatch.mentions >= 3) {
      confidence = "alta";
    } else if (bestMatch.similarityScore >= 0.5 || bestMatch.mentions >= 3) {
      confidence = "media";
    }

    // Tenta extrair telefone do bio (formato BR comum: (XX) XXXXX-XXXX ou +55...)
    const phoneMatch = bestMatch.bio.match(/(\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}/);
    const telefone_no_bio = phoneMatch ? phoneMatch[0].replace(/[^\d+]/g, "") : null;

    // Link no bio: pega primeira URL completa
    const linkMatch = bestMatch.bio.match(/https?:\/\/[^\s)]+/);
    const link_no_bio = linkMatch ? linkMatch[0] : null;

    return {
      username: bestMatch.username,
      bio: bestMatch.bio || null,
      telefone_no_bio,
      link_no_bio,
      confidence,
    };
  } catch {
    return EMPTY;
  }
}

// Re-export pra IA enrichment usar
export { normalizeName };
```

- [ ] **Step 5.2: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 5.3: Commit**

```bash
git add src/lib/gerador-leads/services/instagram-deep.ts
git commit -m "feat(gerador-leads): service Instagram-deep pra inferir IG pessoal do dono"
```

---

## Task 6: IA enrichment update

**Files:**
- Modify: `src/lib/gerador-leads/services/ia-enrichment.ts`

- [ ] **Step 6.1: Ler ia-enrichment.ts atual pra preservar contrato**

Run: `cat src/lib/gerador-leads/services/ia-enrichment.ts | head -100`

Olhar especificamente:
- A interface `IaAnalysisInput` (vai ganhar 2 campos novos)
- A função que monta o prompt — vai ganhar 2 blocos de texto novos
- A função que parseia o response — não muda (output da IA tem os mesmos campos: decisor_*)

- [ ] **Step 6.2: Adicionar campos ao IaAnalysisInput**

Em `src/lib/gerador-leads/services/ia-enrichment.ts`, localizar `interface IaAnalysisInput` e adicionar:

```typescript
export interface IaAnalysisInput {
  empresa: string;
  categoria: string | null;
  cidade: string | null;
  telefone: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  endereco: string | null;
  // Dados enriquecidos
  site: SiteScrapingResult | null;
  hunter: HunterDomainSearchResult | null;
  instagram_data: InstagramProfileResult | null;
  // === Novos (PR decisor CNPJ + IG-deep) ===
  cnpja: CnpjLookupResult | null;
  owner_instagram: OwnerInstagramResult | null;
}
```

E adicionar imports no topo do arquivo:

```typescript
import type { CnpjLookupResult } from "./cnpja";
import type { OwnerInstagramResult } from "./instagram-deep";
```

- [ ] **Step 6.3: Atualizar output type pra incluir decisor_whatsapp/instagram**

Localizar `interface IaAnalysisOk` e adicionar:

```typescript
export interface IaAnalysisOk {
  ok: true;
  decisor_nome: string | null;
  decisor_cargo: string | null;
  decisor_email: string | null;
  decisor_telefone: string | null;     // (já pode existir, confirmar)
  decisor_whatsapp: string | null;     // NOVO
  decisor_instagram: string | null;    // NOVO
  outros_decisores: Array<{ nome: string; cargo: string | null; email: string | null }>;
  score: number;
  qualificado: boolean;
  potencial_comercial: "alto" | "medio" | "baixo";
  observacoes_ia: string;
  diagnostico: {
    sem_site: boolean;
    sem_instagram: boolean;
    instagram_inativo: boolean;
    site_desatualizado: boolean;
    marketing_fraco: boolean;
    sem_resposta_avaliacoes: boolean;
    poucas_avaliacoes: boolean;
    pontos_fortes: string[];
    pontos_fracos: string[];
    abordagem_sugerida: string;
  };
}
```

Verificar se `decisor_telefone` já estava lá; se não, adicionar também.

- [ ] **Step 6.4: Atualizar a função que monta o prompt**

Localizar a função que constrói o prompt (provavelmente `buildPrompt` ou `analyze`). Adicionar 2 blocos novos antes do "INSTRUÇÕES" / formato de saída:

```typescript
// Bloco a inserir após os dados básicos do lead, antes das instruções:
const sociosBlock = input.cnpja?.ok && input.cnpja.socios.length > 0
  ? `\nDADOS OFICIAIS DA RECEITA FEDERAL (CNPJá):
CNPJ: ${input.cnpja.cnpj}
Razão social: ${input.cnpja.razao_social ?? "—"}
Sócios oficiais:
${input.cnpja.socios.map((s, i) => `  ${i + 1}. ${s.nome} — ${s.qualificacao}${s.data_entrada ? ` (desde ${s.data_entrada})` : ""}`).join("\n")}

REGRA: Se houver sócios listados acima, o \`decisor_nome\` DEVE ser o
sócio-administrador (ou primeiro sócio se não houver administrador
explícito). Use os outros sinais (site, Hunter, Instagram) APENAS pra
encontrar o CONTATO dessa pessoa específica (email, telefone, WhatsApp,
Instagram pessoal) — não pra adivinhar quem é o decisor.
`
  : "";

const ownerInstagramBlock = input.owner_instagram?.username
  ? `\nPOSSÍVEL INSTAGRAM PESSOAL DO DECISOR:
Username: @${input.owner_instagram.username}
Bio: ${input.owner_instagram.bio ?? "—"}
Confidence: ${input.owner_instagram.confidence}
${input.owner_instagram.telefone_no_bio ? `Telefone no bio: ${input.owner_instagram.telefone_no_bio}` : ""}

Se confidence é "alta", use o username como \`decisor_instagram\` e o
telefone do bio como \`decisor_whatsapp\` (se existir).
`
  : "";

// Inserir esses 2 blocos no prompt entre dados do lead e instruções:
const prompt = `...dados do lead...
${sociosBlock}
${ownerInstagramBlock}
...instruções...`;
```

- [ ] **Step 6.5: Atualizar o "formato de saída" do prompt**

Onde o prompt instrui a IA a retornar JSON, adicionar `decisor_whatsapp` e `decisor_instagram` aos campos esperados. Localizar bloco que diz algo como:

```
Retorne JSON com:
  decisor_nome: ...
  decisor_cargo: ...
  decisor_email: ...
```

E adicionar:

```
  decisor_telefone: telefone direto do decisor se identificado (null caso contrário)
  decisor_whatsapp: WhatsApp pessoal do decisor (null se não identificado)
  decisor_instagram: @ pessoal do Instagram do decisor (null se não identificado)
```

- [ ] **Step 6.6: Atualizar zod schema do response da IA (se houver)**

Se `ia-enrichment.ts` tiver um zod schema validando o JSON que volta do Claude, adicionar os 2 campos novos. Localizar e adicionar:

```typescript
decisor_telefone: z.string().nullable(),
decisor_whatsapp: z.string().nullable(),
decisor_instagram: z.string().nullable(),
```

- [ ] **Step 6.7: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 6.8: Commit**

```bash
git add src/lib/gerador-leads/services/ia-enrichment.ts
git commit -m "feat(gerador-leads): IA usa sócios da Receita como ground truth"
```

---

## Task 7: Enrichment actions update

**Files:**
- Modify: `src/lib/gerador-leads/enrichment-actions.ts`

- [ ] **Step 7.1: Ler enrichment-actions.ts atual**

Run: `cat src/lib/gerador-leads/enrichment-actions.ts`

Observar:
- Onde `enriquecerLeadAction` orquestra os calls (`siteScraper`, `hunterDomainSearch`, etc)
- Como ele grava o resultado no DB (UPDATE em `leads_gerados`)
- Onde inserir os 2 novos passos

- [ ] **Step 7.2: Adicionar imports**

No topo de `src/lib/gerador-leads/enrichment-actions.ts`:

```typescript
import { searchCnpjByName } from "./services/cnpja";
import { findOwnerInstagram } from "./services/instagram-deep";
```

- [ ] **Step 7.3: Adicionar CNPJá lookup após dados básicos**

Localizar o ponto onde já existem chamadas em paralelo (`Promise.all` com siteScraper + hunter + apify) ou sequenciais. Adicionar CNPJá ANTES do `Promise.all` (precisa antes pra alimentar a IA com sócios):

```typescript
// Lookup oficial CNPJá - precisa rodar antes pra alimentar a IA com sócios
const cnpjaResult = await searchCnpjByName(
  lead.empresa,
  lead.cidade ?? "",
  lead.estado ?? undefined,
);

// Resto do enrichment em paralelo (mantém o que já existe)
const [siteResult, hunterResult, instagramResult] = await Promise.all([
  // ... chamadas existentes
]);
```

- [ ] **Step 7.4: Adicionar Instagram-deep após Instagram da empresa**

Após o `Promise.all` que retorna `instagramResult`, e antes de chamar a IA:

```typescript
// Tenta achar IG pessoal do dono, usando nome do sócio principal da Receita
const socioPrincipal = cnpjaResult.socios.find(
  (s) => s.qualificacao.toLowerCase().includes("administrador"),
) ?? cnpjaResult.socios[0] ?? null;

const ownerInstagramResult = await findOwnerInstagram(
  lead.instagram,
  socioPrincipal?.nome ?? null,
);
```

- [ ] **Step 7.5: Passar os novos resultados pra IA**

Localizar a chamada `analyzeLead(...)` ou similar pra IA. Adicionar os 2 novos campos no objeto passado:

```typescript
const iaResult = await analyzeLead({
  empresa: lead.empresa,
  categoria: lead.categoria,
  cidade: lead.cidade,
  telefone: lead.telefone,
  whatsapp: lead.whatsapp,
  website: lead.website,
  instagram: lead.instagram,
  google_rating: lead.google_rating,
  google_reviews_count: lead.google_reviews_count,
  endereco: lead.endereco,
  site: siteResult,
  hunter: hunterResult,
  instagram_data: instagramResult,
  // === Novos ===
  cnpja: cnpjaResult,
  owner_instagram: ownerInstagramResult,
});
```

- [ ] **Step 7.6: Persistir novos campos no UPDATE final**

Localizar o `supabase.from("leads_gerados").update({...})` ao final da action. Adicionar:

```typescript
const socioPrincipalForDb = cnpjaResult.socios.find(
  (s) => s.qualificacao.toLowerCase().includes("administrador"),
) ?? cnpjaResult.socios[0] ?? null;

await supabase
  .from("leads_gerados")
  .update({
    // ... campos existentes
    // === Novos ===
    cnpj: cnpjaResult.cnpj,
    socios: cnpjaResult.socios,
    socio_principal_qualificacao: socioPrincipalForDb?.qualificacao ?? null,
    decisor_whatsapp: iaResult.ok ? iaResult.decisor_whatsapp : null,
    decisor_instagram: iaResult.ok ? iaResult.decisor_instagram : null,
  })
  .eq("id", leadId);
```

- [ ] **Step 7.7: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 7.8: Lint**

Run: `npm run lint -- src/lib/gerador-leads/enrichment-actions.ts`
Expected: zero errors (warnings ok)

- [ ] **Step 7.9: Commit**

```bash
git add src/lib/gerador-leads/enrichment-actions.ts
git commit -m "feat(gerador-leads): pipeline enriquecimento usa CNPJá + IG-deep"
```

---

## Task 8: Queries update

**Files:**
- Modify: `src/lib/gerador-leads/queries.ts`

- [ ] **Step 8.1: Adicionar novos campos ao SELECT do getLeadGerado**

Em `src/lib/gerador-leads/queries.ts`, localizar `getLeadGerado` ou função similar. Adicionar os campos novos ao SELECT:

```typescript
// Localizar string de select e adicionar:
.select(`
  id, organization_id, pesquisa_id,
  empresa, telefone, whatsapp, email, website, dominio, instagram,
  endereco, cidade, estado, pais, categoria,
  google_rating, google_reviews_count, google_place_id, google_maps_url,
  decisor_nome, decisor_cargo, decisor_email, decisor_telefone, decisor_linkedin,
  outros_decisores,
  instagram_seguidores, instagram_seguindo, instagram_posts, instagram_bio, instagram_ativo,
  score, qualificado, observacoes_ia, potencial_comercial, diagnostico,
  status, tags, observacoes, responsavel_id,
  cnpj, socios, socio_principal_qualificacao, decisor_whatsapp, decisor_instagram,
  created_at, updated_at, arquivado_em
`)
```

- [ ] **Step 8.2: Adicionar tipos no return type**

Localizar a interface `LeadGerado` (ou similar) usada pelo `getLeadGerado` e adicionar:

```typescript
export interface LeadGerado {
  // ... campos existentes
  cnpj: string | null;
  socios: Array<{ nome: string; qualificacao: string; data_entrada: string | null }>;
  socio_principal_qualificacao: string | null;
  decisor_whatsapp: string | null;
  decisor_instagram: string | null;
}
```

- [ ] **Step 8.3: Atualizar listLeadsGerados (se ele retorna o lead completo)**

Mesmo trabalho do Step 8.1, na função que lista leads pra tabela principal. Se ela retorna projeção reduzida (sem decisor), ignorar.

- [ ] **Step 8.4: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 8.5: Commit**

```bash
git add src/lib/gerador-leads/queries.ts
git commit -m "feat(gerador-leads): queries retornam novos campos (cnpj, socios, etc)"
```

---

## Task 9: UI — Card "Identificação oficial (Receita Federal)"

**Files:**
- Create: `src/components/gerador-leads/IdentificacaoOficialCard.tsx`
- Modify: `src/app/(authed)/gerador-leads/[id]/page.tsx`

- [ ] **Step 9.1: Criar IdentificacaoOficialCard**

Cria `src/components/gerador-leads/IdentificacaoOficialCard.tsx`:

```typescript
import { Building2, AlertTriangle, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCnpj } from "@/lib/gerador-leads/utils/cnpj";

interface Socio {
  nome: string;
  qualificacao: string;
  data_entrada: string | null;
}

interface Props {
  cnpj: string | null;
  socios: Socio[];
  multiplos_resultados?: boolean;
}

function isAdministrador(qualificacao: string): boolean {
  return qualificacao.toLowerCase().includes("administrador");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  // YYYY-MM-DD → DD/MM/YYYY
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function IdentificacaoOficialCard({ cnpj, socios, multiplos_resultados }: Props) {
  // Não renderiza se não tem CNPJ (evita card vazio)
  if (!cnpj) return null;

  const cnpjFormatted = formatCnpj(cnpj);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="h-4 w-4 text-primary" />
          Identificação oficial
        </h2>
        <Badge variant="outline" className="text-[10px]">Fonte: Receita Federal</Badge>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CNPJ</p>
        <a
          href={`https://cnpj.biz/${cnpj}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-mono hover:underline"
        >
          {cnpjFormatted}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {multiplos_resultados && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>
            Mais de uma empresa com nome parecido foi encontrada. Confirme manualmente se o CNPJ acima é o correto.
          </span>
        </div>
      )}

      {socios.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            Sócios oficiais
          </p>
          <ul className="space-y-2">
            {socios.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">{s.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {formatDate(s.data_entrada)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    isAdministrador(s.qualificacao)
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : ""
                  }
                >
                  {s.qualificacao}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 9.2: Renderizar o card na página do lead**

Em `src/app/(authed)/gerador-leads/[id]/page.tsx`, adicionar import no topo:

```typescript
import { IdentificacaoOficialCard } from "@/components/gerador-leads/IdentificacaoOficialCard";
```

E renderizar o card no fluxo principal, ANTES do `LeadEditCard`. Localizar:

```typescript
<LeadEditCard key={lead.updated_at} lead={lead} canEdit={canEdit} />
```

E adicionar antes:

```typescript
<IdentificacaoOficialCard
  cnpj={lead.cnpj}
  socios={lead.socios ?? []}
  multiplos_resultados={false}
/>
<LeadEditCard key={lead.updated_at} lead={lead} canEdit={canEdit} />
```

> **Nota:** `multiplos_resultados` não é persistido no DB nesta versão (sempre passado como `false` na UI). O CNPJá indica isso no response — se quiser visibilidade futura, adicionar coluna `cnpj_multiplos_resultados boolean` numa migration separada.

- [ ] **Step 9.3: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 9.4: Lint**

Run: `npm run lint -- src/components/gerador-leads/IdentificacaoOficialCard.tsx src/app/"(authed)"/gerador-leads/"[id]"/page.tsx`
Expected: zero errors

- [ ] **Step 9.5: Commit**

```bash
git add src/components/gerador-leads/IdentificacaoOficialCard.tsx \
        src/app/"(authed)"/gerador-leads/"[id]"/page.tsx
git commit -m "feat(gerador-leads): card 'Identificação oficial' com CNPJ + sócios"
```

---

## Task 10: UI — LeadEditCard com botões + indicador de confiança

**Files:**
- Modify: `src/components/gerador-leads/LeadEditCard.tsx`

- [ ] **Step 10.1: Ler LeadEditCard atual**

Run: `cat src/components/gerador-leads/LeadEditCard.tsx | head -80`

Identificar:
- Onde os campos `decisor_*` são renderizados (provavelmente section "Decisor")
- Que props o componente recebe (`lead`, `canEdit`)
- Padrão de estado (`useState` provavelmente)

- [ ] **Step 10.2: Adicionar utility de confiança no topo do arquivo**

Em `src/components/gerador-leads/LeadEditCard.tsx`, abaixo dos imports adicionar:

```typescript
import { normalizeName } from "@/lib/gerador-leads/utils/string-match";

type ConfidenceLevel = "alta" | "media" | "nao_identificado";

interface SocioMin {
  nome: string;
  qualificacao: string;
}

function deriveDecisorConfidence(
  decisorNome: string | null | undefined,
  socios: SocioMin[],
): ConfidenceLevel {
  if (!decisorNome) return "nao_identificado";
  const normDecisor = normalizeName(decisorNome);
  const matched = socios.find((s) => normalizeName(s.nome) === normDecisor);
  return matched ? "alta" : "media";
}
```

- [ ] **Step 10.3: Adicionar indicador de confiança no header da section Decisor**

Localizar onde renderiza o header da section "Decisor". Adicionar antes dos campos:

```typescript
{(() => {
  const conf = deriveDecisorConfidence(lead.decisor_nome, lead.socios ?? []);
  if (conf === "alta") {
    const socioMatch = (lead.socios ?? []).find(
      (s: SocioMin) => normalizeName(s.nome) === normalizeName(lead.decisor_nome ?? ""),
    );
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-300">
        <span className="font-semibold">✓ Identificado via Receita Federal:</span>
        <span>{socioMatch?.nome} ({socioMatch?.qualificacao})</span>
      </div>
    );
  }
  if (conf === "media") {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
        <span className="font-semibold">⚠ Inferido por IA</span>
        <span className="ml-2">— nome não bate com sócios oficiais</span>
      </div>
    );
  }
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
      Decisor não identificado
    </div>
  );
})()}
```

- [ ] **Step 10.4: Adicionar campos editáveis `decisor_whatsapp` e `decisor_instagram`**

Localizar a section que tem inputs editáveis pra `decisor_email` (ou `decisor_telefone`). Replicar 2x — uma pra `decisor_whatsapp`, outra pra `decisor_instagram`. Exemplo (adaptar ao padrão exato do componente):

```typescript
<label className="text-xs">
  <span className="text-muted-foreground">WhatsApp do decisor</span>
  <input
    type="tel"
    name="decisor_whatsapp"
    defaultValue={lead.decisor_whatsapp ?? ""}
    disabled={!canEdit}
    className="..."
    placeholder="+5565999999999"
  />
</label>

<label className="text-xs">
  <span className="text-muted-foreground">Instagram pessoal</span>
  <input
    type="text"
    name="decisor_instagram"
    defaultValue={lead.decisor_instagram ?? ""}
    disabled={!canEdit}
    className="..."
    placeholder="@joaosilva_oficial"
  />
</label>
```

> Aplicar exatamente o mesmo padrão de classes/onChange que `decisor_email` usa.

- [ ] **Step 10.5: Adicionar 3 botões de ação rápida**

Abaixo dos inputs da section Decisor (e fora do form, pra não submeter), adicionar:

```typescript
<div className="flex flex-wrap gap-2 pt-2 border-t">
  <a
    href={lead.decisor_telefone ? `tel:${lead.decisor_telefone}` : undefined}
    aria-disabled={!lead.decisor_telefone}
    className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium ${
      lead.decisor_telefone
        ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
        : "border-muted bg-muted/30 text-muted-foreground pointer-events-none opacity-50"
    }`}
  >
    📞 Ligar
  </a>
  <a
    href={lead.decisor_whatsapp ? `https://wa.me/${lead.decisor_whatsapp.replace(/[^\d]/g, "")}` : undefined}
    aria-disabled={!lead.decisor_whatsapp}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium ${
      lead.decisor_whatsapp
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
        : "border-muted bg-muted/30 text-muted-foreground pointer-events-none opacity-50"
    }`}
  >
    💬 WhatsApp
  </a>
  <a
    href={lead.decisor_instagram ? `https://instagram.com/${lead.decisor_instagram.replace(/^@/, "")}` : undefined}
    aria-disabled={!lead.decisor_instagram}
    target="_blank"
    rel="noopener noreferrer"
    className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium ${
      lead.decisor_instagram
        ? "border-violet-500/40 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300"
        : "border-muted bg-muted/30 text-muted-foreground pointer-events-none opacity-50"
    }`}
  >
    📷 Instagram
  </a>
</div>
```

- [ ] **Step 10.6: Atualizar zod parse no submit do form (se houver)**

Se `LeadEditCard` faz `updateLeadAction(formData)` no submit, o zod schema atualizado no Task 1 já aceita os novos campos. Confirmar que os `name="decisor_whatsapp"` e `name="decisor_instagram"` dos inputs entram no FormData (estão dentro da `<form>`).

- [ ] **Step 10.7: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 10.8: Lint**

Run: `npm run lint -- src/components/gerador-leads/LeadEditCard.tsx`
Expected: zero errors

- [ ] **Step 10.9: Commit**

```bash
git add src/components/gerador-leads/LeadEditCard.tsx
git commit -m "feat(gerador-leads): card Decisor com indicador de confiança + 3 botões"
```

---

## Task 11: Verificação final + PR

- [ ] **Step 11.1: Rodar typecheck completo**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 11.2: Rodar lint completo**

Run: `npm run lint`
Expected: zero errors (warnings ok, mas não introduzir warnings novos)

- [ ] **Step 11.3: Rodar suite de testes**

Run: `npm test`
Expected: todos os testes passam, incluindo os 4 novos arquivos:
- `gerador-leads-schema.test.ts` (6 it)
- `gerador-leads-string-match.test.ts` (8 it)
- `gerador-leads-cnpj-utils.test.ts` (9 it)
- `gerador-leads-cnpja-parser.test.ts` (4 it)

- [ ] **Step 11.4: Push e abrir PR**

```bash
git push -u origin feat/leads-decisor-cnpj

gh pr create --title "feat(gerador-leads): identifica decisor via CNPJá + Instagram-deep" --body "$(cat <<'EOF'
## Por que

Equipe relatou que o módulo /gerador-leads não consegue identificar quem é o decisor/dono na maioria dos leads. Hoje o sistema chega com nome da empresa e contato genérico, sem nome pessoal — o que trava a abordagem comercial direta.

## O que muda

Pipeline de enriquecimento ganha 2 novos passos + IA passa a usar sócios da Receita Federal como ground truth pra identificar o decisor.

**Antes:** Outscraper → Site Scraper → Hunter → Apify Instagram → IA
**Depois:** Outscraper → **CNPJá (Receita)** → Site Scraper → Hunter → Apify Instagram → **Instagram Deep** → IA

A IA não tenta mais adivinhar quem é o dono — usa o sócio-administrador da Receita como fato. Os outros sinais (site, Hunter, IG) viram busca de **contato** dessa pessoa específica.

## Schema

5 colunas novas em `leads_gerados`:
- `cnpj` — CNPJ da empresa
- `socios` — JSONB com lista oficial de sócios + qualificações
- `socio_principal_qualificacao` — destaque pra UI
- `decisor_whatsapp` — WhatsApp pessoal do decisor
- `decisor_instagram` — IG pessoal do decisor

## UI

- Card novo "Identificação oficial (Receita Federal)" na página do lead — CNPJ + lista de sócios
- Card Decisor ganha indicador de confiança (verde "Identificado via Receita", amarelo "Inferido por IA", cinza "Não identificado")
- 3 botões de ação rápida: 📞 ligar, 💬 WhatsApp, 📷 Instagram

## Custo novo

R$99/mês (CNPJá Basic, 15k consultas/mês). Hunter mantém free tier por enquanto.

## Migration

⚠️ Migration manual após merge:
```sql
-- Aplicar em Supabase SQL Editor
[conteúdo de 20260526000000_leads_gerados_cnpj_socios.sql]
```

## Env nova

`CNPJA_API_KEY` — sem ela, lookup é skip (fallback gracioso ao fluxo atual). Cadastrar em https://cnpja.com.

## Test plan

- [ ] Aplicar migration no Supabase production
- [ ] Cadastrar `CNPJA_API_KEY` no Vercel env vars
- [ ] Gerar lead novo numa pesquisa de teste (nicho conhecido + cidade de Cuiabá)
- [ ] Verificar que card "Identificação oficial" aparece com CNPJ + sócios
- [ ] Verificar que indicador no card Decisor está verde (bate com sócio)
- [ ] Clicar nos 3 botões (tel/WhatsApp/Instagram) — devem abrir corretamente
- [ ] Editar manualmente os campos novos (decisor_whatsapp/instagram) e salvar
- [ ] Verificar que sem CNPJA_API_KEY o fluxo continua funcionando (skip silencioso)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Métricas pós-deploy (medir em 30 dias)

1. **% de leads com `decisor_nome` preenchido** — meta: ~30% → ~70%
2. **% de leads com `decisor_whatsapp` OU `decisor_telefone`** — meta: ~20% → ~50%
3. **Conversão `novo` → `em_contato`** — proxy de qualidade do dado

Se métricas ficarem abaixo do esperado, considerar PR seguinte:
- Hunter pago (upgrade do free tier)
- Google Search direcionado (Abordagem B do brainstorm)
- Filtro "só com decisor identificado" na toolbar
