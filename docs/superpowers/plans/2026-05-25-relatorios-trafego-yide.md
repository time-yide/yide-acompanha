# Relatórios de Tráfego com identidade Yide — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar módulo de geração de relatórios mensais de tráfego pago em PDF com identidade visual Yide, narrativa por IA Claude, fonte de dados Meta API com fallback manual, distribuídos via download direto e via portal do cliente.

**Architecture:** Sub-aba dentro de `/trafego`. Nova tabela `trafego_relatorios` (1:N com `clients`). Reusa templates de slide e pipeline Puppeteer do `apresenta-yide`. Template novo `grafico_barras` em SVG/HTML server-side. RLS dá leitura ao portal do cliente apenas em registros publicados.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + Storage + RLS), Anthropic SDK (Claude) com streaming, Puppeteer/Chromium (já configurado em `apresenta-yide`), React Server Components, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-25-relatorios-trafego-yide-design.md`

---

## Phase 1 — Foundation (DB + tipos)

### Task 1: Migration `trafego_relatorios`

**Files:**
- Create: `supabase/migrations/20260608000000_trafego_relatorios.sql`

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/20260608000000_trafego_relatorios.sql
--
-- Tabela de relatórios de tráfego pago entregues ao cliente final.
-- Cada relatório tem slides JSONB (mesmo shape do apresenta-yide + template
-- novo grafico_barras), dados crus (Meta API e/ou manual) e um PDF salvo
-- no Storage. Cliente só vê quando assessor seta `publicado_em`.

create table public.trafego_relatorios (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  unit_id uuid references public.units(id),

  periodo_inicio date not null,
  periodo_fim date not null,
  constraint trafego_relatorios_periodo_ok check (periodo_fim >= periodo_inicio),

  -- Texto livre do assessor que vira input do prompt IA.
  objetivo text,

  -- meta_api = 100% Meta, manual = 100% form, hibrido = Meta + complemento manual.
  fonte_dados text not null
    check (fonte_dados in ('meta_api', 'manual', 'hibrido')),

  -- Snapshot bruto do que veio da Meta (cache: não re-bate na API ao reabrir).
  dados_meta jsonb,
  -- O que o assessor digitou/editou.
  dados_manuais jsonb,

  -- Array de slides validados em runtime (ver tipos.ts).
  slides jsonb not null default '[]'::jsonb,

  status text not null default 'rascunho'
    check (status in ('rascunho','gerando','pronta','erro')),

  pdf_storage_path text,
  publicado_em timestamptz,

  criado_por uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_trafego_relatorios_cliente_periodo
  on public.trafego_relatorios (cliente_id, periodo_inicio desc);

create index idx_trafego_relatorios_publicado
  on public.trafego_relatorios (cliente_id, publicado_em desc)
  where publicado_em is not null;

create trigger trg_trafego_relatorios_updated_at
  before update on public.trafego_relatorios
  for each row execute function public.set_updated_at();

-- Bucket de Storage pros PDFs gerados. Privado — acesso só via signed URL
-- gerada pela server action.
insert into storage.buckets (id, name, public)
values ('relatorios-trafego', 'relatorios-trafego', false)
on conflict (id) do nothing;

-- ─── RLS ────────────────────────────────────────────────────────────────
alter table public.trafego_relatorios enable row level security;

-- Equipe interna: socio/adm tudo; coord/assessor/comercial filtram pela
-- unit_id do próprio profile. Não usa is_unit_master() aqui porque o filtro
-- por unidade é parte da hierarquia natural (assessor da Matriz não vê
-- relatório de Salvador).
create policy "trafego_relatorios select equipe"
  on public.trafego_relatorios for select to authenticated
  using (
    (
      public.current_user_role() in ('socio', 'adm')
    ) or (
      public.current_user_role() in ('coordenador', 'assessor', 'comercial')
      and (unit_id is null or unit_id = public.current_user_unit_id())
    )
  );

-- Cliente do portal só vê o que está publicado, e só do PRÓPRIO cliente.
-- O JWT do portal carrega cliente_id em raw_user_meta_data.client_id.
create policy "trafego_relatorios select cliente portal"
  on public.trafego_relatorios for select to authenticated
  using (
    publicado_em is not null
    and cliente_id = ((auth.jwt() -> 'user_metadata' ->> 'client_id')::uuid)
  );

create policy "trafego_relatorios insert equipe"
  on public.trafego_relatorios for insert to authenticated
  with check (
    public.current_user_role() in ('socio', 'adm', 'coordenador', 'assessor', 'comercial')
  );

create policy "trafego_relatorios update equipe"
  on public.trafego_relatorios for update to authenticated
  using (public.current_user_role() in ('socio', 'adm', 'coordenador', 'assessor', 'comercial'))
  with check (public.current_user_role() in ('socio', 'adm', 'coordenador', 'assessor', 'comercial'));

create policy "trafego_relatorios delete equipe"
  on public.trafego_relatorios for delete to authenticated
  using (public.current_user_role() in ('socio', 'adm'));

comment on table public.trafego_relatorios is
  'Relatórios mensais de tráfego pago gerados com IA + identidade Yide. '
  'Cliente do portal só lê quando publicado_em is not null.';
```

- [ ] **Step 2: Aplicar a migration (manual no Supabase SQL Editor após merge — padrão do projeto)**

Migration files são apenas commitados; a aplicação real é manual via Dashboard. Documente no PR body.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260608000000_trafego_relatorios.sql
git commit -m "feat(trafego/relatorios): migration + bucket + RLS"
```

---

### Task 2: Permission key

**Files:**
- Modify: `src/lib/auth/permissions.ts`

- [ ] **Step 1: Localizar a union de Permission e o mapa de papéis**

Run: `grep -n "manage:users\|Permission\b" src/lib/auth/permissions.ts | head -10`

- [ ] **Step 2: Adicionar `manage:trafego_relatorios` na union e nos papéis socio/adm/coordenador/assessor**

Adicionar a permission `manage:trafego_relatorios` na union de tipos `Permission` e listar nos arrays de `socio`, `adm`, `coordenador`, `assessor`. NÃO listar em `comercial` (decisão do spec) nem em outros papéis.

- [ ] **Step 3: Rodar typecheck**

Run: `npm run typecheck 2>&1 | grep -v "@sparticuz\|puppeteer-core\|cheerio\|web-push"`
Expected: 0 errors (warnings de pacotes opcionais ignorados).

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/permissions.ts
git commit -m "feat(trafego/relatorios): permission manage:trafego_relatorios"
```

---

### Task 3: Tipos com novo template `grafico_barras`

**Files:**
- Create: `src/lib/trafego/relatorios/tipos.ts`

- [ ] **Step 1: Escrever tipos.ts**

```typescript
// src/lib/trafego/relatorios/tipos.ts
//
// Tipos de slides do relatório de tráfego. Reusa os 6 templates do
// apresenta-yide e adiciona `grafico_barras` (SVG/HTML server-side).
// Mantemos os tipos AQUI (não em apresenta-yide/tipos.ts) pra não
// acoplar dois domínios distintos.

export type SlideTemplate =
  | "capa"
  | "conteudo"
  | "duas_colunas"
  | "metrica"
  | "topicos_numerados"
  | "grafico_barras"
  | "encerramento";

export interface SlideCapa {
  template: "capa";
  titulo: string;
  subtitulo?: string;
}

export interface SlideConteudo {
  template: "conteudo";
  titulo: string;
  texto?: string;
  bullets?: string[];
}

export interface SlideDuasColunas {
  template: "duas_colunas";
  titulo: string;
  coluna_esquerda: { titulo: string; texto: string };
  coluna_direita: { titulo: string; texto: string };
}

export interface SlideMetrica {
  template: "metrica";
  numero: string;
  label: string;
  descricao?: string;
}

export interface SlideTopicosNumerados {
  template: "topicos_numerados";
  titulo: string;
  topicos: Array<{ titulo: string; texto?: string }>;
}

export interface SlideGraficoBarras {
  template: "grafico_barras";
  titulo: string;
  subtitulo?: string;
  unidade: "moeda" | "numero" | "percentual";
  /** Máximo 7 itens — mais que isso fica ilegível no PDF. */
  dados: Array<{ label: string; valor: number }>;
  /** Insight curto abaixo do gráfico. */
  insight?: string;
}

export interface SlideEncerramento {
  template: "encerramento";
  mensagem: string;
  cta?: string;
}

export type SlideContent =
  | SlideCapa
  | SlideConteudo
  | SlideDuasColunas
  | SlideMetrica
  | SlideTopicosNumerados
  | SlideGraficoBarras
  | SlideEncerramento;

export interface Slide {
  template: SlideTemplate;
  content: SlideContent;
}

export type RelatorioStatus = "rascunho" | "gerando" | "pronta" | "erro";
export type FonteDados = "meta_api" | "manual" | "hibrido";

export interface RelatorioRow {
  id: string;
  cliente_id: string;
  organization_id: string;
  unit_id: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  objetivo: string | null;
  fonte_dados: FonteDados;
  dados_meta: DadosTrafego | null;
  dados_manuais: DadosTrafego | null;
  slides: Slide[];
  status: RelatorioStatus;
  pdf_storage_path: string | null;
  publicado_em: string | null;
  criado_por: string | null;
  created_at: string;
}

/**
 * Shape dos dados brutos que alimentam o prompt da IA. Mesmas chaves
 * pra Meta API e form manual — facilita merge no fonte_dados=hibrido.
 */
export interface DadosTrafego {
  spend: number;
  impressoes?: number;
  alcance?: number;
  cliques?: number;
  cpc?: number;
  ctr?: number;
  conversoes?: number;
  custo_por_conversao?: number;
  leads?: number;
  custo_por_lead?: number;
  top_campanhas?: Array<{ nome: string; spend: number; resultados?: number }>;
  periodo_anterior?: {
    spend?: number;
    cliques?: number;
    conversoes?: number;
    leads?: number;
  };
}

// ─── Validação runtime ─────────────────────────────────────────────────

const TEMPLATES: readonly SlideTemplate[] = [
  "capa", "conteudo", "duas_colunas", "metrica",
  "topicos_numerados", "grafico_barras", "encerramento",
];

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function isStr(x: unknown): x is string { return typeof x === "string"; }
function isNonEmpty(x: unknown): x is string { return isStr(x) && x.trim().length > 0; }
function isNum(x: unknown): x is number { return typeof x === "number" && Number.isFinite(x); }

function isCapa(c: unknown): c is SlideCapa {
  if (!isObj(c) || c.template !== "capa") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (c.subtitulo !== undefined && !isStr(c.subtitulo)) return false;
  return true;
}
function isConteudo(c: unknown): c is SlideConteudo {
  if (!isObj(c) || c.template !== "conteudo") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (c.texto !== undefined && !isStr(c.texto)) return false;
  if (c.bullets !== undefined && (!Array.isArray(c.bullets) || !c.bullets.every(isStr))) return false;
  return true;
}
function isDuasColunas(c: unknown): c is SlideDuasColunas {
  if (!isObj(c) || c.template !== "duas_colunas") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (!isObj(c.coluna_esquerda) || !isStr(c.coluna_esquerda.titulo) || !isStr(c.coluna_esquerda.texto)) return false;
  if (!isObj(c.coluna_direita) || !isStr(c.coluna_direita.titulo) || !isStr(c.coluna_direita.texto)) return false;
  return true;
}
function isMetrica(c: unknown): c is SlideMetrica {
  if (!isObj(c) || c.template !== "metrica") return false;
  if (!isNonEmpty(c.numero) || !isNonEmpty(c.label)) return false;
  if (c.descricao !== undefined && !isStr(c.descricao)) return false;
  return true;
}
function isTopicos(c: unknown): c is SlideTopicosNumerados {
  if (!isObj(c) || c.template !== "topicos_numerados") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (!Array.isArray(c.topicos)) return false;
  return c.topicos.every((t) => isObj(t) && isNonEmpty(t.titulo));
}
function isGraficoBarras(c: unknown): c is SlideGraficoBarras {
  if (!isObj(c) || c.template !== "grafico_barras") return false;
  if (!isNonEmpty(c.titulo)) return false;
  if (c.subtitulo !== undefined && !isStr(c.subtitulo)) return false;
  if (!isStr(c.unidade) || !["moeda", "numero", "percentual"].includes(c.unidade)) return false;
  if (!Array.isArray(c.dados) || c.dados.length === 0 || c.dados.length > 7) return false;
  if (!c.dados.every((d) => isObj(d) && isNonEmpty(d.label) && isNum(d.valor))) return false;
  if (c.insight !== undefined && !isStr(c.insight)) return false;
  return true;
}
function isEncerramento(c: unknown): c is SlideEncerramento {
  if (!isObj(c) || c.template !== "encerramento") return false;
  if (!isNonEmpty(c.mensagem)) return false;
  if (c.cta !== undefined && !isStr(c.cta)) return false;
  return true;
}

export function isValidSlide(x: unknown): x is Slide {
  if (!isObj(x)) return false;
  if (!isStr(x.template) || !TEMPLATES.includes(x.template as SlideTemplate)) return false;
  if (!isObj(x.content) || x.content.template !== x.template) return false;
  switch (x.template as SlideTemplate) {
    case "capa": return isCapa(x.content);
    case "conteudo": return isConteudo(x.content);
    case "duas_colunas": return isDuasColunas(x.content);
    case "metrica": return isMetrica(x.content);
    case "topicos_numerados": return isTopicos(x.content);
    case "grafico_barras": return isGraficoBarras(x.content);
    case "encerramento": return isEncerramento(x.content);
  }
}

export function isValidSlides(x: unknown): x is Slide[] {
  return Array.isArray(x) && x.every(isValidSlide);
}
```

- [ ] **Step 2: Test — validators**

**Files:**
- Test: `tests/unit/trafego-relatorios-tipos.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { isValidSlide, isValidSlides } from "@/lib/trafego/relatorios/tipos";

describe("isValidSlide", () => {
  it("aceita slide capa válido", () => {
    expect(isValidSlide({ template: "capa", content: { template: "capa", titulo: "X" } })).toBe(true);
  });

  it("rejeita capa sem titulo", () => {
    expect(isValidSlide({ template: "capa", content: { template: "capa" } })).toBe(false);
  });

  it("aceita grafico_barras com 1-7 itens", () => {
    const slide = {
      template: "grafico_barras",
      content: {
        template: "grafico_barras",
        titulo: "Top campanhas",
        unidade: "moeda",
        dados: [{ label: "C1", valor: 100 }, { label: "C2", valor: 50 }],
      },
    };
    expect(isValidSlide(slide)).toBe(true);
  });

  it("rejeita grafico_barras com 8 itens", () => {
    const slide = {
      template: "grafico_barras",
      content: {
        template: "grafico_barras",
        titulo: "X",
        unidade: "numero",
        dados: Array.from({ length: 8 }, (_, i) => ({ label: `c${i}`, valor: i })),
      },
    };
    expect(isValidSlide(slide)).toBe(false);
  });

  it("rejeita grafico_barras com unidade inválida", () => {
    const slide = {
      template: "grafico_barras",
      content: { template: "grafico_barras", titulo: "X", unidade: "kg", dados: [{ label: "a", valor: 1 }] },
    };
    expect(isValidSlide(slide)).toBe(false);
  });

  it("rejeita slide com template desconhecido", () => {
    expect(isValidSlide({ template: "foobar", content: { template: "foobar" } })).toBe(false);
  });
});

describe("isValidSlides", () => {
  it("aceita array vazio", () => {
    expect(isValidSlides([])).toBe(true);
  });
  it("rejeita não-array", () => {
    expect(isValidSlides("xyz")).toBe(false);
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npx vitest run tests/unit/trafego-relatorios-tipos.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 4: Commit**

```bash
git add src/lib/trafego/relatorios/tipos.ts tests/unit/trafego-relatorios-tipos.test.ts
git commit -m "feat(trafego/relatorios): tipos de slide + validators (com grafico_barras)"
```

---

### Task 4: Schema Zod

**Files:**
- Create: `src/lib/trafego/relatorios/schema.ts`

- [ ] **Step 1: Escrever schema.ts**

```typescript
// src/lib/trafego/relatorios/schema.ts
import { z } from "zod";

const uuid = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID inválido",
);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em YYYY-MM-DD");

export const dadosTrafegoSchema = z.object({
  spend: z.coerce.number().min(0),
  impressoes: z.coerce.number().int().min(0).optional(),
  alcance: z.coerce.number().int().min(0).optional(),
  cliques: z.coerce.number().int().min(0).optional(),
  cpc: z.coerce.number().min(0).optional(),
  ctr: z.coerce.number().min(0).optional(),
  conversoes: z.coerce.number().int().min(0).optional(),
  custo_por_conversao: z.coerce.number().min(0).optional(),
  leads: z.coerce.number().int().min(0).optional(),
  custo_por_lead: z.coerce.number().min(0).optional(),
  top_campanhas: z.array(z.object({
    nome: z.string().max(200),
    spend: z.coerce.number().min(0),
    resultados: z.coerce.number().min(0).optional(),
  })).max(7).optional(),
  periodo_anterior: z.object({
    spend: z.coerce.number().min(0).optional(),
    cliques: z.coerce.number().int().min(0).optional(),
    conversoes: z.coerce.number().int().min(0).optional(),
    leads: z.coerce.number().int().min(0).optional(),
  }).optional(),
});

export const criarRelatorioSchema = z.object({
  cliente_id: uuid,
  periodo_inicio: isoDate,
  periodo_fim: isoDate,
  objetivo: z.string().max(1000).optional().nullable(),
  dados_manuais: dadosTrafegoSchema.partial({ spend: true }).optional().nullable(),
}).refine((d) => d.periodo_fim >= d.periodo_inicio, {
  message: "Data final deve ser >= inicial",
  path: ["periodo_fim"],
});

export const atualizarSlideSchema = z.object({
  id: uuid,
  index: z.coerce.number().int().min(0),
  slide: z.unknown(),
});

export const publicarRelatorioSchema = z.object({ id: uuid });
export const excluirRelatorioSchema = z.object({ id: uuid });

export type CriarRelatorioInput = z.infer<typeof criarRelatorioSchema>;
export type DadosTrafegoInput = z.infer<typeof dadosTrafegoSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trafego/relatorios/schema.ts
git commit -m "feat(trafego/relatorios): zod schema (input validation)"
```

---

## Phase 2 — Backend (server-only)

### Task 5: `meta-fetch.ts` — pré-popular dados via Meta API

**Files:**
- Create: `src/lib/trafego/relatorios/meta-fetch.ts`

- [ ] **Step 1: Inspecionar Meta API existente**

Run: `grep -n "^export\|spend\|impressions\|reach" src/lib/trafego/meta-api.ts | head -20`

Decidir: se já existem wrappers de insights por período, reusar com nomes reais. Senão, implementar/exportar `fetchInsightsRange(accountId, inicio, fim)` e `fetchTopCampanhas(accountId, inicio, fim, limite)` em `meta-api.ts`.

- [ ] **Step 2: Escrever meta-fetch.ts**

```typescript
// src/lib/trafego/relatorios/meta-fetch.ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { DadosTrafego } from "./tipos";

export interface MetaFetchResult {
  ok: boolean;
  /** Quando ok=false: 'no_account' = cliente sem meta_ad_account_id; 'api_error' = Meta falhou. */
  motivo?: "no_account" | "api_error";
  dados?: DadosTrafego;
  erroDetalhe?: string;
}

export async function fetchDadosMeta(
  clienteId: string,
  inicio: string,
  fim: string,
): Promise<MetaFetchResult> {
  const supabase = createServiceRoleClient();
  const { data: client } = await supabase
    .from("clients")
    .select("meta_ad_account_id")
    .eq("id", clienteId)
    .single();

  const accountId = (client as { meta_ad_account_id: string | null } | null)?.meta_ad_account_id;
  if (!accountId) return { ok: false, motivo: "no_account" };

  try {
    const dados = await fetchInsightsRange(accountId, inicio, fim);

    // Período anterior de mesma duração, imediatamente antes.
    const duracaoMs = new Date(fim).getTime() - new Date(inicio).getTime();
    const anteriorFim = new Date(new Date(inicio).getTime() - 86400_000);
    const anteriorInicio = new Date(anteriorFim.getTime() - duracaoMs);
    const anterior = await fetchInsightsRange(
      accountId,
      anteriorInicio.toISOString().slice(0, 10),
      anteriorFim.toISOString().slice(0, 10),
    ).catch(() => null);

    return {
      ok: true,
      dados: {
        ...dados,
        periodo_anterior: anterior ? {
          spend: anterior.spend,
          cliques: anterior.cliques,
          conversoes: anterior.conversoes,
          leads: anterior.leads,
        } : undefined,
      },
    };
  } catch (e) {
    return { ok: false, motivo: "api_error", erroDetalhe: (e as Error).message };
  }
}

async function fetchInsightsRange(
  accountId: string,
  inicio: string,
  fim: string,
): Promise<DadosTrafego> {
  // Adapte estes nomes ao que estiver exportado em meta-api.ts.
  const { fetchMetaInsights, fetchTopCampanhas } = await import("@/lib/trafego/meta-api");
  const insights = await fetchMetaInsights(accountId, inicio, fim);
  const top = await fetchTopCampanhas(accountId, inicio, fim, 5).catch(() => []);
  return {
    spend: insights.spend ?? 0,
    impressoes: insights.impressions,
    alcance: insights.reach,
    cliques: insights.clicks,
    cpc: insights.cpc,
    ctr: insights.ctr,
    conversoes: insights.conversions,
    custo_por_conversao: insights.cost_per_conversion,
    leads: insights.leads,
    custo_por_lead: insights.cost_per_lead,
    top_campanhas: top.map((c) => ({ nome: c.name, spend: c.spend, resultados: c.results })),
  };
}
```

- [ ] **Step 3: Garantir que `fetchMetaInsights` e `fetchTopCampanhas` existem em `src/lib/trafego/meta-api.ts`**

Se ainda não existirem com esses nomes/shapes, criar ou ajustar os imports acima. Não inventar.

- [ ] **Step 4: Commit**

```bash
git add src/lib/trafego/relatorios/meta-fetch.ts src/lib/trafego/meta-api.ts
git commit -m "feat(trafego/relatorios): fetchDadosMeta com fallback no_account/api_error"
```

---

### Task 6: `prompt.ts` — prompt da IA específico de tráfego

**Files:**
- Create: `src/lib/trafego/relatorios/prompt.ts`
- Test: `tests/unit/trafego-relatorios-prompt.test.ts`

- [ ] **Step 1: Escrever prompt.ts**

```typescript
// src/lib/trafego/relatorios/prompt.ts
import type { DadosTrafego } from "./tipos";

export const SYSTEM_PROMPT = `Você é o gerador de relatórios da Yide Digital, uma agência de marketing de Cuiabá-MT. Cria relatórios mensais de tráfego pago em PDF entregues ao cliente final.

DIRETRIZES DE TOM:
- Direto, sem jargão de mídia ("CPM", "ROAS") — explica em PT-BR.
- Números em destaque. Sempre conecta número a resultado de negócio.
  Ex: "R$ 2.300 viraram 47 leads — cada lead custou R$ 49".
- Tom positivo, sem prometer o que os números não mostram.
- Sem hallucinations: SÓ use números que estão no JSON. NÃO calcule novos
  (CPC, CPL, etc. já vêm prontos quando disponíveis).

ESTRUTURA OBRIGATÓRIA (em ordem):
1. capa — "Relatório de Tráfego Pago · {período}"
2. conteudo — Resumo executivo, 2-3 bullets do que aconteceu
3. metrica × 3 (slides separados) — Investimento, alcance, impressões
4. metrica × 3 — Resultados (cliques, conversões/leads, custo)
5. grafico_barras — Top campanhas por spend OU evolução
6. duas_colunas — Período anterior × atual
7. topicos_numerados — Análise + 3 próximos passos
8. encerramento — CTA positivo

REGRAS DE OMISSÃO:
- Se "conversoes" e "leads" forem ambos undefined, slide 4 vira só cliques+CPC+CTR.
- Se "periodo_anterior" for undefined, OMITE o slide 6 e adiciona um conteudo
  "Sobre os números" no lugar.
- Se "top_campanhas" tiver < 2 itens, o gráfico vira evolução agregada (se
  houver pelo menos um número adicional pra plotar).

FORMATO DE SAÍDA:
Stream de objetos JSON Slide[], um por linha, no shape definido em
src/lib/trafego/relatorios/tipos.ts. Sem markdown, sem prosa fora do JSON.`;

export function buildUserPrompt(input: {
  cliente_nome: string;
  periodo_inicio: string;
  periodo_fim: string;
  objetivo: string | null;
  dados: DadosTrafego;
}): string {
  return [
    `Cliente: ${input.cliente_nome}`,
    `Período: ${input.periodo_inicio} a ${input.periodo_fim}`,
    `Objetivo deste relatório: ${input.objetivo || "Não especificado"}`,
    ``,
    `Dados (USE APENAS O QUE ESTÁ AQUI):`,
    "```json",
    JSON.stringify(input.dados, null, 2),
    "```",
  ].join("\n");
}
```

- [ ] **Step 2: Test**

```typescript
// tests/unit/trafego-relatorios-prompt.test.ts
import { describe, it, expect } from "vitest";
import { buildUserPrompt, SYSTEM_PROMPT } from "@/lib/trafego/relatorios/prompt";

describe("buildUserPrompt", () => {
  it("inclui cliente, período, objetivo e dados", () => {
    const p = buildUserPrompt({
      cliente_nome: "Acme",
      periodo_inicio: "2026-04-01",
      periodo_fim: "2026-04-30",
      objetivo: "Mostrar leads de Marco Zero",
      dados: { spend: 1000 },
    });
    expect(p).toContain("Acme");
    expect(p).toContain("2026-04-01");
    expect(p).toContain("Marco Zero");
    expect(p).toContain('"spend": 1000');
  });

  it('usa "Não especificado" quando objetivo é null', () => {
    const p = buildUserPrompt({
      cliente_nome: "X", periodo_inicio: "2026-04-01", periodo_fim: "2026-04-30",
      objetivo: null, dados: { spend: 0 },
    });
    expect(p).toContain("Não especificado");
  });
});

describe("SYSTEM_PROMPT", () => {
  it("menciona estrutura obrigatória e identidade Yide", () => {
    expect(SYSTEM_PROMPT).toContain("Yide");
    expect(SYSTEM_PROMPT).toContain("grafico_barras");
    expect(SYSTEM_PROMPT).toContain("encerramento");
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npx vitest run tests/unit/trafego-relatorios-prompt.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 4: Commit**

```bash
git add src/lib/trafego/relatorios/prompt.ts tests/unit/trafego-relatorios-prompt.test.ts
git commit -m "feat(trafego/relatorios): prompt da IA com regras de omissão"
```

---

### Task 7: `queries.ts` — leituras

**Files:**
- Create: `src/lib/trafego/relatorios/queries.ts`

- [ ] **Step 1: Inspecionar padrão das queries de apresenta-yide**

Run: `cat src/lib/apresenta-yide/queries.ts`

- [ ] **Step 2: Escrever queries.ts**

```typescript
// src/lib/trafego/relatorios/queries.ts
import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { RelatorioRow } from "./tipos";

export const RELATORIOS_TRAFEGO_LIST_TAG = "trafego_relatorios:list";
export const RELATORIO_TRAFEGO_TAG_PREFIX = "trafego_relatorios:";

export async function listarRelatorios(opts: {
  clienteId?: string;
  unitId?: string | null;
}): Promise<RelatorioRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("trafego_relatorios")
    .select("*")
    .order("periodo_inicio", { ascending: false });
  if (opts.clienteId) q = q.eq("cliente_id", opts.clienteId);
  const { data } = await q;
  return (data ?? []) as RelatorioRow[];
}

export async function getRelatorio(id: string): Promise<RelatorioRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trafego_relatorios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as RelatorioRow | null) ?? null;
}

/**
 * Service-role: pula RLS porque o HMAC token da rota pública já autoriza
 * o acesso. NUNCA chamar do client.
 */
export async function getRelatorioParaPdf(id: string): Promise<RelatorioRow | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("trafego_relatorios")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as RelatorioRow | null) ?? null;
}

export const listarRelatoriosPublicadosPorCliente = (clienteId: string) =>
  unstable_cache(
    async (): Promise<RelatorioRow[]> => {
      const supabase = await createClient();
      const { data } = await supabase
        .from("trafego_relatorios")
        .select("*")
        .eq("cliente_id", clienteId)
        .not("publicado_em", "is", null)
        .order("publicado_em", { ascending: false });
      return (data ?? []) as RelatorioRow[];
    },
    [`trafego_relatorios:${clienteId}`],
    { tags: [`${RELATORIO_TRAFEGO_TAG_PREFIX}${clienteId}`, RELATORIOS_TRAFEGO_LIST_TAG] },
  )();
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/trafego/relatorios/queries.ts
git commit -m "feat(trafego/relatorios): queries (lista/get/portal)"
```

---

### Task 8: `actions.ts` — criar + excluir

**Files:**
- Create: `src/lib/trafego/relatorios/actions.ts`

- [ ] **Step 1: Escrever criarRelatorioAction + excluirRelatorioAction**

```typescript
// src/lib/trafego/relatorios/actions.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getEffectiveUnitId } from "@/lib/units/session";
import { logAudit } from "@/lib/audit/log";
import {
  criarRelatorioSchema,
  excluirRelatorioSchema,
} from "./schema";
import { fetchDadosMeta } from "./meta-fetch";
import type { FonteDados } from "./tipos";
import {
  RELATORIO_TRAFEGO_TAG_PREFIX,
  RELATORIOS_TRAFEGO_LIST_TAG,
} from "./queries";

type ActionErr = { error: string };
type ActionRedirect = { redirect: string };

export async function criarRelatorioAction(
  formData: FormData,
): Promise<ActionErr | ActionRedirect> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }

  const dadosManuaisRaw = formData.get("dados_manuais");
  const parsed = criarRelatorioSchema.safeParse({
    cliente_id: formData.get("cliente_id"),
    periodo_inicio: formData.get("periodo_inicio"),
    periodo_fim: formData.get("periodo_fim"),
    objetivo: formData.get("objetivo") || null,
    dados_manuais: dadosManuaisRaw ? JSON.parse(String(dadosManuaisRaw)) : null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  const { data: cliente } = await supabase
    .from("clients")
    .select("organization_id, unit_id, nome")
    .eq("id", parsed.data.cliente_id)
    .single();
  if (!cliente) return { error: "Cliente não encontrado" };

  const unitId = (cliente as { unit_id: string | null }).unit_id ?? (await getEffectiveUnitId());

  const metaResult = await fetchDadosMeta(
    parsed.data.cliente_id,
    parsed.data.periodo_inicio,
    parsed.data.periodo_fim,
  );

  let fonteDados: FonteDados;
  if (metaResult.ok && parsed.data.dados_manuais) fonteDados = "hibrido";
  else if (metaResult.ok) fonteDados = "meta_api";
  else fonteDados = "manual";

  const { data: created, error: insertErr } = await supabase
    .from("trafego_relatorios")
    .insert({
      cliente_id: parsed.data.cliente_id,
      organization_id: (cliente as { organization_id: string }).organization_id,
      unit_id: unitId,
      periodo_inicio: parsed.data.periodo_inicio,
      periodo_fim: parsed.data.periodo_fim,
      objetivo: parsed.data.objetivo,
      fonte_dados: fonteDados,
      dados_meta: metaResult.ok ? metaResult.dados : null,
      dados_manuais: parsed.data.dados_manuais ?? null,
      slides: [],
      status: "rascunho",
      criado_por: actor.id,
    })
    .select("id")
    .single();

  if (insertErr || !created) return { error: insertErr?.message ?? "Falha ao criar" };

  await logAudit({
    entidade: "trafego_relatorios",
    entidade_id: (created as { id: string }).id,
    acao: "create",
    dados_depois: { ...parsed.data, fonte_dados: fonteDados } as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidateTag(RELATORIOS_TRAFEGO_LIST_TAG, "default");
  revalidatePath("/trafego/relatorios");
  return { redirect: `/trafego/relatorios/${(created as { id: string }).id}` };
}

export async function excluirRelatorioAction(formData: FormData): Promise<ActionErr | { success: true }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }
  const parsed = excluirRelatorioSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  const { data: before } = await supabase
    .from("trafego_relatorios")
    .select("cliente_id, pdf_storage_path")
    .eq("id", parsed.data.id)
    .single();
  if (!before) return { error: "Relatório não encontrado" };

  const { error } = await supabase
    .from("trafego_relatorios")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  const path = (before as { pdf_storage_path: string | null }).pdf_storage_path;
  if (path) await supabase.storage.from("relatorios-trafego").remove([path]).catch(() => {});

  await logAudit({
    entidade: "trafego_relatorios",
    entidade_id: parsed.data.id,
    acao: "delete",
    ator_id: actor.id,
  });

  const clienteId = (before as { cliente_id: string }).cliente_id;
  revalidateTag(`${RELATORIO_TRAFEGO_TAG_PREFIX}${clienteId}`, "default");
  revalidateTag(RELATORIOS_TRAFEGO_LIST_TAG, "default");
  revalidatePath("/trafego/relatorios");
  return { success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trafego/relatorios/actions.ts
git commit -m "feat(trafego/relatorios): actions criar + excluir"
```

---

### Task 9: `actions.ts` — gerar slides via streaming

**Files:**
- Modify: `src/lib/trafego/relatorios/actions.ts` (adicionar `gerarSlidesAction`)

- [ ] **Step 1: Inspecionar streaming do apresenta-yide**

Run: `grep -n "anthropic\|stream\|parseStream" src/lib/apresenta-yide/actions.ts src/lib/apresenta-yide/stream-parser.ts | head -20`

Verificar a assinatura de `parseStreamingSlides` (ou nome real) — se aceita chunk de texto ou se mantém estado interno. Adaptar a chamada.

- [ ] **Step 2: Adicionar gerarSlidesAction**

```typescript
// adicionar em src/lib/trafego/relatorios/actions.ts

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
// Adapte o nome do export real:
import { parseStreamingSlides } from "@/lib/apresenta-yide/stream-parser";
import { isValidSlide, type Slide } from "./tipos";
import { getServerEnv } from "@/lib/env";

export async function gerarSlidesAction(id: string): Promise<ActionErr | { success: true }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }

  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY não configurada" };

  const supabase = createServiceRoleClient();
  const { data: rel } = await supabase
    .from("trafego_relatorios")
    .select("*, cliente:clients(nome)")
    .eq("id", id)
    .single();
  if (!rel) return { error: "Relatório não encontrado" };

  const r = rel as unknown as {
    status: string;
    dados_meta: Record<string, unknown> | null;
    dados_manuais: Record<string, unknown> | null;
    periodo_inicio: string;
    periodo_fim: string;
    objetivo: string | null;
    cliente: { nome: string };
  };
  if (r.status === "pronta") return { success: true };

  await supabase
    .from("trafego_relatorios")
    .update({ status: "gerando", slides: [] })
    .eq("id", id);

  // Manuais sobrescrevem meta quando ambos existem.
  const dadosFinal = { ...(r.dados_meta ?? {}), ...(r.dados_manuais ?? {}) };

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const slides: Slide[] = [];

  try {
    const stream = await client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: buildUserPrompt({
          cliente_nome: r.cliente.nome,
          periodo_inicio: r.periodo_inicio,
          periodo_fim: r.periodo_fim,
          objetivo: r.objetivo,
          dados: dadosFinal as never,
        }),
      }],
    });

    for await (const evt of stream) {
      if (evt.type === "content_block_delta" && evt.delta.type === "text_delta") {
        const novos = parseStreamingSlides(evt.delta.text);
        for (const s of novos) {
          if (isValidSlide(s)) {
            slides.push(s);
            await supabase
              .from("trafego_relatorios")
              .update({ slides })
              .eq("id", id);
          }
        }
      }
    }

    await supabase
      .from("trafego_relatorios")
      .update({ status: "pronta", slides })
      .eq("id", id);
  } catch (e) {
    await supabase
      .from("trafego_relatorios")
      .update({ status: "erro" })
      .eq("id", id);
    return { error: (e as Error).message };
  }

  revalidatePath(`/trafego/relatorios/${id}`);
  return { success: true };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/trafego/relatorios/actions.ts
git commit -m "feat(trafego/relatorios): gerarSlidesAction com streaming Claude"
```

---

### Task 10: `actions.ts` — atualizar slide + publicar + baixar PDF

**Files:**
- Modify: `src/lib/trafego/relatorios/actions.ts`

- [ ] **Step 1: Adicionar atualizarSlideAction, publicarRelatorioAction, baixarPdfAction**

```typescript
// adicionar em src/lib/trafego/relatorios/actions.ts

import {
  atualizarSlideSchema,
  publicarRelatorioSchema,
} from "./schema";

export async function atualizarSlideAction(formData: FormData): Promise<ActionErr | { success: true }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }
  const parsed = atualizarSlideSchema.safeParse({
    id: formData.get("id"),
    index: formData.get("index"),
    slide: JSON.parse(String(formData.get("slide") ?? "null")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!isValidSlide(parsed.data.slide)) return { error: "Slide inválido" };

  const supabase = createServiceRoleClient();
  const { data: rel } = await supabase
    .from("trafego_relatorios")
    .select("slides")
    .eq("id", parsed.data.id)
    .single();
  if (!rel) return { error: "Não encontrado" };

  const slides = ((rel as { slides: Slide[] }).slides ?? []).slice();
  if (parsed.data.index < 0 || parsed.data.index >= slides.length) {
    return { error: "Índice fora do range" };
  }
  slides[parsed.data.index] = parsed.data.slide;

  const { error } = await supabase
    .from("trafego_relatorios")
    .update({ slides })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  revalidatePath(`/trafego/relatorios/${parsed.data.id}`);
  return { success: true };
}

export async function publicarRelatorioAction(formData: FormData): Promise<ActionErr | { success: true }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return { error: "Sem permissão" };
  }
  const parsed = publicarRelatorioSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  const { data: before } = await supabase
    .from("trafego_relatorios")
    .select("cliente_id, status, pdf_storage_path")
    .eq("id", parsed.data.id)
    .single();
  if (!before) return { error: "Não encontrado" };

  const b = before as { cliente_id: string; status: string; pdf_storage_path: string | null };
  if (b.status !== "pronta") return { error: "Gere os slides antes de publicar" };
  if (!b.pdf_storage_path) return { error: "Gere o PDF antes de publicar" };

  const { error } = await supabase
    .from("trafego_relatorios")
    .update({ publicado_em: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "trafego_relatorios",
    entidade_id: parsed.data.id,
    acao: "update",
    dados_depois: { publicado: true },
    ator_id: actor.id,
  });

  revalidateTag(`${RELATORIO_TRAFEGO_TAG_PREFIX}${b.cliente_id}`, "default");
  revalidatePath(`/trafego/relatorios/${parsed.data.id}`);
  return { success: true };
}

export async function baixarPdfAction(id: string): Promise<ActionErr | { url: string }> {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) return { error: "Sem permissão" };
  const supabase = createServiceRoleClient();
  const { data: rel } = await supabase
    .from("trafego_relatorios")
    .select("pdf_storage_path")
    .eq("id", id)
    .single();
  const path = (rel as { pdf_storage_path: string | null } | null)?.pdf_storage_path;
  if (!path) return { error: "PDF ainda não gerado" };
  const { data: signed } = await supabase.storage
    .from("relatorios-trafego")
    .createSignedUrl(path, 300);
  if (!signed?.signedUrl) return { error: "Falha ao gerar link" };
  return { url: signed.signedUrl };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/trafego/relatorios/actions.ts
git commit -m "feat(trafego/relatorios): atualizarSlide + publicar + baixarPdf"
```

---

## Phase 3 — PDF rendering

### Task 11: Componente `SlideGraficoBarras`

**Files:**
- Create: `src/components/trafego/relatorios/SlideGraficoBarras.tsx`
- Test: `tests/unit/trafego-relatorios-grafico-barras.test.tsx`

- [ ] **Step 1: Escrever test (failing)**

```typescript
// tests/unit/trafego-relatorios-grafico-barras.test.tsx
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SlideGraficoBarras } from "@/components/trafego/relatorios/SlideGraficoBarras";

describe("SlideGraficoBarras", () => {
  const content = {
    template: "grafico_barras" as const,
    titulo: "Top campanhas",
    unidade: "moeda" as const,
    dados: [
      { label: "Campanha A", valor: 1000 },
      { label: "Campanha B", valor: 500 },
    ],
    insight: "Campanha A liderou o investimento",
  };

  it("renderiza titulo e label dos itens", () => {
    const html = renderToStaticMarkup(<SlideGraficoBarras content={content} />);
    expect(html).toContain("Top campanhas");
    expect(html).toContain("Campanha A");
    expect(html).toContain("Campanha B");
  });

  it("formata valores como moeda em pt-BR quando unidade=moeda", () => {
    const html = renderToStaticMarkup(<SlideGraficoBarras content={content} />);
    expect(html).toMatch(/R\$\s*1\.000/);
    expect(html).toMatch(/R\$\s*500/);
  });

  it("inclui insight quando fornecido", () => {
    const html = renderToStaticMarkup(<SlideGraficoBarras content={content} />);
    expect(html).toContain("Campanha A liderou o investimento");
  });
});
```

Run: `npx vitest run tests/unit/trafego-relatorios-grafico-barras.test.tsx`
Expected: FAIL — componente não existe.

- [ ] **Step 2: Implementar componente**

```typescript
// src/components/trafego/relatorios/SlideGraficoBarras.tsx
import type { SlideGraficoBarras as ContentType } from "@/lib/trafego/relatorios/tipos";

const PALETA_YIDE = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"] as const;

function formatar(valor: number, unidade: ContentType["unidade"]): string {
  if (unidade === "moeda") {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  }
  if (unidade === "percentual") return `${valor.toFixed(1).replace(".", ",")}%`;
  return valor.toLocaleString("pt-BR");
}

export function SlideGraficoBarras({ content }: { content: ContentType }) {
  const maxValor = Math.max(...content.dados.map((d) => d.valor), 1);
  return (
    <div className="slide slide-grafico">
      <h2 className="slide-titulo">{content.titulo}</h2>
      {content.subtitulo && <p className="slide-subtitulo">{content.subtitulo}</p>}
      <div className="grafico-container">
        {content.dados.map((d, i) => {
          const pct = (d.valor / maxValor) * 100;
          const cor = PALETA_YIDE[i % PALETA_YIDE.length];
          return (
            <div className="grafico-linha" key={i}>
              <span className="grafico-label">{d.label}</span>
              <div className="grafico-track">
                <div className="grafico-barra" style={{ width: `${pct}%`, background: cor }} />
              </div>
              <span className="grafico-valor">{formatar(d.valor, content.unidade)}</span>
            </div>
          );
        })}
      </div>
      {content.insight && <p className="slide-insight">{content.insight}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Run test, passa**

Run: `npx vitest run tests/unit/trafego-relatorios-grafico-barras.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/trafego/relatorios/SlideGraficoBarras.tsx tests/unit/trafego-relatorios-grafico-barras.test.tsx
git commit -m "feat(trafego/relatorios): SlideGraficoBarras (server-render)"
```

---

### Task 12: Deck renderable pra PDF

**Files:**
- Create: `src/components/trafego/relatorios/PdfRenderableDeck.tsx`

- [ ] **Step 1: Inspecionar deck do apresenta-yide**

Run: `cat src/components/apresenta-yide/PdfRenderableDeck.tsx | head -120`

- [ ] **Step 2: Escrever PdfRenderableDeck.tsx**

Recebe `{ slides: Slide[], meta: { cliente_nome, periodo_inicio, periodo_fim } }` e itera renderizando cada template. Para `grafico_barras` usa o componente da Task 11. Para os outros 6 (`capa`, `conteudo`, `duas_colunas`, `metrica`, `topicos_numerados`, `encerramento`), copia o markup do apresenta-yide (classes com prefix `slide-`).

Importante: capa usa `meta.cliente_nome` e `${meta.periodo_inicio} → ${meta.periodo_fim}` como subtítulo automático se o `content.subtitulo` estiver vazio.

- [ ] **Step 3: Commit**

```bash
git add src/components/trafego/relatorios/PdfRenderableDeck.tsx
git commit -m "feat(trafego/relatorios): PdfRenderableDeck — todos os templates"
```

---

### Task 13: Rota pública `/relatorio-trafego-pdf/[id]`

**Files:**
- Create: `src/app/relatorio-trafego-pdf/[id]/page.tsx`
- Create: `src/app/relatorio-trafego-pdf/[id]/pdf-styles.ts`

- [ ] **Step 1: Reusar HMAC do apresenta-yide**

`src/lib/apresenta-yide/pdf-token.ts` exporta `signPdfToken(id, secret)` e `verifyPdfToken(id, token, secret)`. Reusa sem mudar — o token é genérico.

- [ ] **Step 2: Extrair CSS pra arquivo TS exportando string**

```typescript
// src/app/relatorio-trafego-pdf/[id]/pdf-styles.ts
// CSS inline pra Puppeteer renderizar sem depender de bundle externo.
// Paleta e tipografia Yide — adapte do apresenta-yide se quiser
// idêntico (verificar src/app/apresenta-yide-pdf/[id]/ pra referência).
export const PDF_STYLES = `
  @page { size: A4 landscape; margin: 0; }
  html, body { margin: 0; padding: 0; font-family: Inter, system-ui, sans-serif; color: #0f172a; }
  .slide { width: 100vw; height: 100vh; padding: 60px 80px; box-sizing: border-box; page-break-after: always; display: flex; flex-direction: column; justify-content: center; }
  .slide-titulo { font-size: 36px; font-weight: 700; margin: 0 0 16px; color: #0f172a; }
  .slide-subtitulo { font-size: 18px; color: #64748b; margin: 0 0 24px; }
  .slide-insight { font-size: 16px; color: #475569; margin-top: 24px; font-style: italic; }
  .grafico-container { display: flex; flex-direction: column; gap: 18px; margin-top: 32px; }
  .grafico-linha { display: grid; grid-template-columns: 180px 1fr 120px; align-items: center; gap: 16px; }
  .grafico-label { font-size: 15px; font-weight: 600; }
  .grafico-track { background: #f1f5f9; height: 28px; border-radius: 6px; overflow: hidden; }
  .grafico-barra { height: 100%; border-radius: 6px; transition: none; }
  .grafico-valor { font-size: 15px; font-weight: 700; text-align: right; }
  /* TODO: classes pra capa, metrica, duas_colunas etc — copiar do apresenta-yide-pdf */
`;
```

- [ ] **Step 3: Escrever a page**

```typescript
// src/app/relatorio-trafego-pdf/[id]/page.tsx
import { notFound } from "next/navigation";
import { verifyPdfToken } from "@/lib/apresenta-yide/pdf-token";
import { getServerEnv } from "@/lib/env";
import { getRelatorioParaPdf } from "@/lib/trafego/relatorios/queries";
import { PdfRenderableDeck } from "@/components/trafego/relatorios/PdfRenderableDeck";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { PDF_STYLES } from "./pdf-styles";

export const dynamic = "force-dynamic";

export default async function RelatorioTrafegoPdfPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token = "" } = await searchParams;

  const env = getServerEnv();
  if (!env.APRESENTACAO_PDF_SECRET) notFound();
  if (!verifyPdfToken(id, token, env.APRESENTACAO_PDF_SECRET)) notFound();

  const rel = await getRelatorioParaPdf(id);
  if (!rel) notFound();

  const sb = createServiceRoleClient();
  const { data: cliente } = await sb.from("clients").select("nome").eq("id", rel.cliente_id).single();
  const clienteNome = (cliente as { nome: string } | null)?.nome ?? "Cliente";

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <title>Relatório de Tráfego — {clienteNome}</title>
        <style>{PDF_STYLES}</style>
      </head>
      <body>
        <PdfRenderableDeck
          slides={rel.slides}
          meta={{
            cliente_nome: clienteNome,
            periodo_inicio: rel.periodo_inicio,
            periodo_fim: rel.periodo_fim,
          }}
        />
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Completar PDF_STYLES com classes pros outros templates**

Inspecionar o CSS atual em `src/app/apresenta-yide-pdf/[id]/page.tsx`, copiar classes pertinentes (`.slide-capa`, `.slide-metrica`, `.slide-duas-colunas`, `.slide-topicos`, `.slide-encerramento`) e colar/adaptar em `pdf-styles.ts`. Verificar nomes de classes que o `PdfRenderableDeck` da Task 12 usa.

- [ ] **Step 5: Commit**

```bash
git add src/app/relatorio-trafego-pdf
git commit -m "feat(trafego/relatorios): rota pública /relatorio-trafego-pdf/[id]"
```

---

### Task 14: API `/api/trafego/relatorios/[id]/gerar`

**Files:**
- Create: `src/app/api/trafego/relatorios/[id]/gerar/route.ts`

- [ ] **Step 1: Inspecionar endpoint análogo do apresenta-yide**

Run: `cat src/app/api/apresenta-yide/[id]/gerar/route.ts`

- [ ] **Step 2: Escrever route.ts**

```typescript
// src/app/api/trafego/relatorios/[id]/gerar/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv, env as publicEnv } from "@/lib/env";
import { signPdfToken } from "@/lib/apresenta-yide/pdf-token";
import { generatePdfFromUrl } from "@/lib/apresenta-yide/pdf-generator";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const env = getServerEnv();
  if (!env.APRESENTACAO_PDF_SECRET) {
    return NextResponse.json({ error: "PDF_SECRET não configurada" }, { status: 500 });
  }

  const token = signPdfToken(id, env.APRESENTACAO_PDF_SECRET);
  const url = `${publicEnv.NEXT_PUBLIC_APP_URL}/relatorio-trafego-pdf/${id}?token=${token}`;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generatePdfFromUrl(url);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  const supabase = createServiceRoleClient();
  const { data: rel } = await supabase
    .from("trafego_relatorios")
    .select("organization_id")
    .eq("id", id)
    .single();
  const orgId = (rel as { organization_id: string } | null)?.organization_id;
  if (!orgId) return NextResponse.json({ error: "Relatório não encontrado" }, { status: 404 });

  const path = `${orgId}/${id}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("relatorios-trafego")
    .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  await supabase
    .from("trafego_relatorios")
    .update({ pdf_storage_path: path })
    .eq("id", id);

  return NextResponse.json({ ok: true, path });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/trafego/relatorios
git commit -m "feat(trafego/relatorios): API /gerar (Puppeteer + Storage)"
```

---

## Phase 4 — UI assessor

### Task 15: Tab "Relatórios" em `/trafego`

**Files:**
- Modify: `src/app/(authed)/trafego/page.tsx`

- [ ] **Step 1: Inspecionar estrutura atual**

Run: `cat 'src/app/(authed)/trafego/page.tsx' | head -80`

- [ ] **Step 2: Adicionar tabs**

Wrapper de tabs no topo: "Campanhas" (conteúdo atual) e "Relatórios" (link pra `/trafego/relatorios`). Use o padrão de tabs já existente no projeto (procure outro componente com tabs pra seguir convenção).

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(authed)/trafego/page.tsx'
git commit -m "feat(trafego/relatorios): tab Relatórios em /trafego"
```

---

### Task 16: Página lista `/trafego/relatorios`

**Files:**
- Create: `src/app/(authed)/trafego/relatorios/page.tsx`
- Create: `src/components/trafego/relatorios/RelatoriosListClient.tsx`

- [ ] **Step 1: Server page**

```typescript
// src/app/(authed)/trafego/relatorios/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { listarRelatorios } from "@/lib/trafego/relatorios/queries";
import { RelatoriosListClient } from "@/components/trafego/relatorios/RelatoriosListClient";

export default async function Page({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:trafego_relatorios")) redirect("/trafego");
  const { cliente } = await searchParams;
  const itens = await listarRelatorios({ clienteId: cliente });
  return <RelatoriosListClient itens={itens} />;
}
```

- [ ] **Step 2: RelatoriosListClient**

Tabela: Cliente · Período · Status (badge) · Publicado (sim/não) · Ações (ver/baixar/excluir). Header com "Novo relatório" → `/trafego/relatorios/nova`. Filtro de cliente opcional (dropdown).

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(authed)/trafego/relatorios/page.tsx' src/components/trafego/relatorios/RelatoriosListClient.tsx
git commit -m "feat(trafego/relatorios): página lista /trafego/relatorios"
```

---

### Task 17: API `/api/trafego/relatorios/meta-fetch`

**Files:**
- Create: `src/app/api/trafego/relatorios/meta-fetch/route.ts`

- [ ] **Step 1: Endpoint que pré-popula o form**

```typescript
// src/app/api/trafego/relatorios/meta-fetch/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { fetchDadosMeta } from "@/lib/trafego/relatorios/meta-fetch";

export async function GET(req: Request) {
  const actor = await requireAuth();
  if (!canAccess(actor.role, "manage:trafego_relatorios")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const url = new URL(req.url);
  const clienteId = url.searchParams.get("cliente_id");
  const inicio = url.searchParams.get("inicio");
  const fim = url.searchParams.get("fim");
  if (!clienteId || !inicio || !fim) {
    return NextResponse.json({ error: "Parâmetros faltando" }, { status: 400 });
  }
  const r = await fetchDadosMeta(clienteId, inicio, fim);
  return NextResponse.json(r);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/trafego/relatorios/meta-fetch
git commit -m "feat(trafego/relatorios): API meta-fetch (pré-popular form)"
```

---

### Task 18: Página `/trafego/relatorios/nova` + form

**Files:**
- Create: `src/app/(authed)/trafego/relatorios/nova/page.tsx`
- Create: `src/components/trafego/relatorios/NovoRelatorioForm.tsx`
- Create: `src/components/trafego/relatorios/PreviewDadosMeta.tsx`

- [ ] **Step 1: Server page**

```typescript
// src/app/(authed)/trafego/relatorios/nova/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NovoRelatorioForm } from "@/components/trafego/relatorios/NovoRelatorioForm";

export default async function Page() {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:trafego_relatorios")) redirect("/trafego");
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clients")
    .select("id, nome, meta_ad_account_id")
    .eq("ativo", true)
    .order("nome");
  return <NovoRelatorioForm clientes={(clientes ?? []) as Array<{ id: string; nome: string; meta_ad_account_id: string | null }>} />;
}
```

- [ ] **Step 2: NovoRelatorioForm**

Client component. State:
- `clienteId`, `inicio`, `fim`, `objetivo` (controlados)
- `metaResult` (resposta de `/api/trafego/relatorios/meta-fetch`)
- `dadosManuais` (form com todos os campos de `DadosTrafego`, pré-populado quando Meta responde)
- `fetching` boolean

Fluxo:
1. Usuário escolhe cliente + período. Botão "Buscar dados Meta" chama o endpoint.
2. Render condicional:
   - `metaResult.ok`: badge verde "Dados via Meta", form manual pré-populado, label "ajuste se necessário".
   - `motivo:'no_account'`: aviso "Cliente sem conta Meta cadastrada — preencha manualmente".
   - `motivo:'api_error'`: aviso "Meta API indisponível — preencha manualmente".
3. Submit: serializa `dadosManuais` num hidden input JSON e chama `criarRelatorioAction`. Em redirect, `router.push`. Em erro, mostra inline.

- [ ] **Step 3: PreviewDadosMeta**

Painel read-only mostrando os números que vieram da Meta (spend, impressões, etc.) com formatação. Não-editável.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/(authed)/trafego/relatorios/nova' src/components/trafego/relatorios/NovoRelatorioForm.tsx src/components/trafego/relatorios/PreviewDadosMeta.tsx
git commit -m "feat(trafego/relatorios): /trafego/relatorios/nova com pre-fetch Meta"
```

---

### Task 19: Página detalhe `/trafego/relatorios/[id]`

**Files:**
- Create: `src/app/(authed)/trafego/relatorios/[id]/page.tsx`
- Create: `src/components/trafego/relatorios/RelatorioDetalheClient.tsx`
- Create: `src/components/trafego/relatorios/SlideEditorInline.tsx`

- [ ] **Step 1: Server page**

```typescript
// src/app/(authed)/trafego/relatorios/[id]/page.tsx
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { redirect, notFound } from "next/navigation";
import { getRelatorio } from "@/lib/trafego/relatorios/queries";
import { RelatorioDetalheClient } from "@/components/trafego/relatorios/RelatorioDetalheClient";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!canAccess(user.role, "manage:trafego_relatorios")) redirect("/trafego");
  const { id } = await params;
  const rel = await getRelatorio(id);
  if (!rel) notFound();
  return <RelatorioDetalheClient relatorio={rel} />;
}
```

- [ ] **Step 2: RelatorioDetalheClient**

Lógica:
- Se `status === "rascunho"` e `slides.length === 0`: dispara `gerarSlidesAction` no mount (via `useEffect` + `useTransition`).
- Se `status === "gerando"`: polling de 2s — `router.refresh()` revalida.
- Se `status === "pronta"`: renderiza preview dos slides + botões "Editar" (abre `SlideEditorInline`), "Gerar PDF", "Publicar", "Baixar PDF" (quando `pdf_storage_path` existir), "Excluir".
- Se `status === "erro"`: mostra erro + botão "Tentar de novo".

- [ ] **Step 3: SlideEditorInline**

Modal/drawer com campos por template:
- `capa`: titulo, subtitulo
- `conteudo`: titulo, texto (textarea), bullets (array de strings)
- `metrica`: numero, label, descricao
- `duas_colunas`: titulo, esquerda{titulo,texto}, direita{titulo,texto}
- `topicos_numerados`: titulo, topicos[]
- `grafico_barras`: titulo, subtitulo, unidade, dados[], insight
- `encerramento`: mensagem, cta

Botão "Salvar" → `atualizarSlideAction` (FormData com `id`, `index`, `slide` JSON).

- [ ] **Step 4: Botão "Gerar PDF"**

Fetch `POST /api/trafego/relatorios/[id]/gerar`. Mostra spinner; sucesso → `router.refresh()`; erro → alert inline.

- [ ] **Step 5: Botão "Baixar PDF"**

Chama `baixarPdfAction(id)`. Em sucesso, abre signed URL em nova aba.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(authed)/trafego/relatorios/[id]' src/components/trafego/relatorios/RelatorioDetalheClient.tsx src/components/trafego/relatorios/SlideEditorInline.tsx
git commit -m "feat(trafego/relatorios): página detalhe com editor + gerar/publicar/baixar"
```

---

## Phase 5 — Portal do cliente

### Task 20: Página `/cliente/relatorios-trafego`

**Files:**
- Create: `src/app/(cliente)/cliente/relatorios-trafego/page.tsx`
- Create: `src/components/cliente/RelatoriosTrafegoLista.tsx`
- Modify: `src/lib/trafego/relatorios/actions.ts` (adicionar `baixarPdfClienteAction`)

- [ ] **Step 1: Inspecionar autenticação do portal cliente**

Run: `cat 'src/app/(cliente)/cliente/page.tsx'`

Anotar o helper de auth real do portal (algo como `requireClientePortalAuth`, `getClientePortalSession`, etc.) e como ele expõe `client_id`.

- [ ] **Step 2: Adicionar baixarPdfClienteAction em actions.ts**

```typescript
// adicionar em src/lib/trafego/relatorios/actions.ts

// Adapte o import ao nome real do helper:
import { getClientePortalSession } from "@/lib/cliente-portal/auth";

export async function baixarPdfClienteAction(id: string): Promise<ActionErr | { url: string }> {
  const session = await getClientePortalSession();
  if (!session) return { error: "Não autenticado" };

  const supabase = createServiceRoleClient();
  const { data: rel } = await supabase
    .from("trafego_relatorios")
    .select("cliente_id, pdf_storage_path, publicado_em")
    .eq("id", id)
    .single();
  const r = rel as {
    cliente_id: string;
    pdf_storage_path: string | null;
    publicado_em: string | null;
  } | null;
  if (!r || !r.publicado_em || r.cliente_id !== session.client_id) {
    return { error: "Não encontrado" };
  }
  if (!r.pdf_storage_path) return { error: "PDF não disponível" };
  const { data: signed } = await supabase.storage
    .from("relatorios-trafego")
    .createSignedUrl(r.pdf_storage_path, 300);
  if (!signed?.signedUrl) return { error: "Falha ao gerar link" };
  return { url: signed.signedUrl };
}
```

- [ ] **Step 3: Page do portal**

```typescript
// src/app/(cliente)/cliente/relatorios-trafego/page.tsx
import { requireClientePortalAuth } from "@/lib/cliente-portal/auth";
import { listarRelatoriosPublicadosPorCliente } from "@/lib/trafego/relatorios/queries";
import { RelatoriosTrafegoLista } from "@/components/cliente/RelatoriosTrafegoLista";

export default async function Page() {
  const session = await requireClientePortalAuth();
  const itens = await listarRelatoriosPublicadosPorCliente(session.client_id);
  return <RelatoriosTrafegoLista itens={itens} />;
}
```

- [ ] **Step 4: RelatoriosTrafegoLista**

Tabela: Período · Publicado em · Botão "Visualizar" (link) · Botão "Baixar PDF" (chama `baixarPdfClienteAction`).

- [ ] **Step 5: Item no menu lateral do portal**

Identificar o nav/layout do portal (provável: `src/app/(cliente)/cliente/layout.tsx` ou um componente compartilhado) e adicionar entrada "Relatórios de Tráfego" apontando pra `/cliente/relatorios-trafego`.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(cliente)/cliente/relatorios-trafego' src/components/cliente/RelatoriosTrafegoLista.tsx src/lib/trafego/relatorios/actions.ts
git commit -m "feat(trafego/relatorios): portal cliente — lista publicados"
```

---

### Task 21: Página detalhe `/cliente/relatorios-trafego/[id]`

**Files:**
- Create: `src/app/(cliente)/cliente/relatorios-trafego/[id]/page.tsx`
- Create: `src/components/cliente/RelatorioTrafegoVisualizador.tsx`

- [ ] **Step 1: Page**

```typescript
// src/app/(cliente)/cliente/relatorios-trafego/[id]/page.tsx
import { requireClientePortalAuth } from "@/lib/cliente-portal/auth";
import { getRelatorio } from "@/lib/trafego/relatorios/queries";
import { notFound } from "next/navigation";
import { RelatorioTrafegoVisualizador } from "@/components/cliente/RelatorioTrafegoVisualizador";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireClientePortalAuth();
  const { id } = await params;
  const rel = await getRelatorio(id);
  if (!rel || rel.cliente_id !== session.client_id || !rel.publicado_em) notFound();
  return <RelatorioTrafegoVisualizador relatorio={rel} />;
}
```

- [ ] **Step 2: RelatorioTrafegoVisualizador**

Renderiza os slides inline (não-PDF) reaproveitando os mesmos sub-componentes do `PdfRenderableDeck` (importa direto), mas dentro de um wrapper web responsivo (scroll vertical, não page-break). Botão "Baixar PDF" no topo → `baixarPdfClienteAction` → abre signed URL.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(cliente)/cliente/relatorios-trafego/[id]' src/components/cliente/RelatorioTrafegoVisualizador.tsx
git commit -m "feat(trafego/relatorios): portal cliente — visualizador + baixar PDF"
```

---

## Phase 6 — Teste integração + PR

### Task 22: Test integração e2e

**Files:**
- Create: `tests/integration/trafego-relatorios.test.ts`

- [ ] **Step 1: Test do fluxo principal (action level)**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const removeMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: fromMock,
    storage: { from: () => ({ remove: removeMock, upload: vi.fn(), createSignedUrl: vi.fn() }) },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));
vi.mock("@/lib/auth/session", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/trafego/relatorios/meta-fetch", () => ({
  fetchDadosMeta: vi.fn().mockResolvedValue({ ok: true, dados: { spend: 1000 } }),
}));
vi.mock("@/lib/audit/log", () => ({ logAudit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/units/session", () => ({ getEffectiveUnitId: vi.fn().mockResolvedValue("unit-1") }));

import {
  criarRelatorioAction,
  excluirRelatorioAction,
  publicarRelatorioAction,
} from "@/lib/trafego/relatorios/actions";

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  removeMock.mockClear();
});

describe("trafego_relatorios fluxo", () => {
  it("criarRelatorioAction: cria com fonte_dados='meta_api' quando Meta ok e sem manuais", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    const insertMock = vi.fn().mockReturnValue({
      select: () => ({ single: vi.fn().mockResolvedValue({ data: { id: "rel-1" }, error: null }) }),
    });
    fromMock.mockImplementation((t: string) => {
      if (t === "clients") return {
        select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
          data: { organization_id: "org-1", unit_id: "unit-1", nome: "Acme" }
        }) }) }),
      };
      if (t === "trafego_relatorios") return { insert: insertMock };
      return {};
    });

    const fd = new FormData();
    fd.set("cliente_id", "00000000-0000-0000-0000-000000000001");
    fd.set("periodo_inicio", "2026-04-01");
    fd.set("periodo_fim", "2026-04-30");

    const r = await criarRelatorioAction(fd);
    expect("redirect" in r ? r.redirect : null).toBe("/trafego/relatorios/rel-1");
    const insertArg = insertMock.mock.calls[0][0];
    expect(insertArg.fonte_dados).toBe("meta_api");
    expect(insertArg.status).toBe("rascunho");
  });

  it("publicarRelatorioAction: bloqueia se status != pronta", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
        data: { cliente_id: "c1", status: "rascunho", pdf_storage_path: null }
      }) }) }),
    }));
    const fd = new FormData();
    fd.set("id", "00000000-0000-0000-0000-00000000abcd");
    const r = await publicarRelatorioAction(fd);
    expect("error" in r ? r.error : null).toMatch(/slides antes/);
  });

  it("excluirRelatorioAction: deleta linha e remove PDF do storage", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "socio" });
    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({
        data: { cliente_id: "c1", pdf_storage_path: "org/abc.pdf" }
      }) }) }),
      delete: () => ({ eq: deleteEq }),
    }));

    const fd = new FormData();
    fd.set("id", "00000000-0000-0000-0000-00000000abcd");
    const r = await excluirRelatorioAction(fd);
    expect("success" in r ? r.success : null).toBe(true);
    expect(deleteEq).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalledWith(["org/abc.pdf"]);
  });
});
```

- [ ] **Step 2: Rodar suite completa**

Run: `npx vitest run`
Expected: PASS — todos os testes passam, incluindo novos.

- [ ] **Step 3: Typecheck e lint**

Run: `npm run typecheck 2>&1 | grep -v "@sparticuz\|puppeteer-core\|cheerio\|web-push"`
Expected: 0 errors.

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/trafego-relatorios.test.ts
git commit -m "test(trafego/relatorios): integration test do fluxo principal"
```

---

### Task 23: Abrir PR

- [ ] **Step 1: Push**

```bash
git push -u origin claude/relatorios-trafego-yide
```

- [ ] **Step 2: Criar PR via gh**

Título: `feat(trafego): Relatórios de Tráfego Pago com identidade Yide`

Body:
```
## Resumo
- Novo módulo `/trafego/relatorios` — sub-aba de tráfego
- IA Claude escreve narrativa em cima dos dados Meta (ou manual)
- PDF gerado via Puppeteer com identidade visual Yide
- Cliente vê no portal após assessor publicar
- Template novo `grafico_barras` (SVG/HTML server-side)

## Spec
docs/superpowers/specs/2026-05-25-relatorios-trafego-yide-design.md

## Migrations manuais (após merge)
1. Rodar `supabase/migrations/20260608000000_trafego_relatorios.sql` no SQL Editor
2. Conferir que o bucket `relatorios-trafego` foi criado (privado)

## Test plan
- [ ] Criar relatório de cliente com Meta configurado — preview deve mostrar dados Meta
- [ ] Criar relatório de cliente sem Meta — preview vazio, form manual obrigatório
- [ ] IA gera 5-8 slides com identidade Yide
- [ ] Editar slide funciona (todos os 7 templates)
- [ ] Gerar PDF → baixar funciona
- [ ] Publicar → cliente vê no portal
- [ ] Cliente baixa PDF do portal
- [ ] Excluir limpa do Storage também
```

- [ ] **Step 3: Verificar checks CI**

Aguardar CI verde.

---

## Notas finais

- **Sempre commitar** entre tasks. Nada de bundle.
- **TDD onde fizer sentido**: tipos/validators/prompt/SVG têm testes. Páginas/components não precisam (E2E manual).
- **Não inventar nomes**: antes de reusar `parseStreamingSlides`, `signPdfToken`, `generatePdfFromUrl`, `fetchMetaInsights`, `requireClientePortalAuth`, etc. — abrir o arquivo, ver assinatura real, adaptar a chamada.
- **Cache tags**: `trafego_relatorios:${clienteId}` invalida no portal; `trafego_relatorios:list` invalida na lista da equipe. Sempre revalidar nas mutations.
- **Migration manual**: documentar no PR body que precisa rodar SQL no Supabase + bucket.
