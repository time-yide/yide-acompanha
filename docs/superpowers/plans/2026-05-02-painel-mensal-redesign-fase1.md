# Painel Mensal — Redesign (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar visualmente o painel mensal aplicando **matriz de pacotes** (cada cliente vê só as colunas do seu tipo de pacote), estados ricos por coluna (delegado/em-andamento/pronto), modais de lançamento manual de Postagens/GMN, popover de TPG/TPM ativo+valor, e badges de tipo de pacote.

**Architecture:** Estende as tabelas existentes (`clients`, `client_monthly_checklist`, `checklist_step`) sem criar novas — adiciona enum `tipo_pacote`, valor `delegado` no enum de status, e campos de GMN/TPG/TPM no checklist mensal. UI reorganizada em células pequenas e compostas pela `PainelTable` que consulta a matriz de aplicabilidade do pacote pra decidir o que renderizar.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), TypeScript, Tailwind v4, shadcn/ui, vitest.

**Spec mãe:** [docs/superpowers/specs/2026-05-02-painel-mensal-redesign-fase1-design.md](../specs/2026-05-02-painel-mensal-redesign-fase1-design.md)

---

## File Structure

**Banco:**
- Create: `supabase/migrations/20260502000029_painel_redesign_pacotes.sql` — enums novos + fields em clients + 'delegado' no status enum
- Create: `supabase/migrations/20260502000030_painel_redesign_extras.sql` — extends `client_monthly_checklist` com TPG/TPM/GMN + adjusta RLS
- Create: `supabase/migrations/20260502000031_clients_servico_to_pacote.sql` — backfill `tipo_pacote` a partir de `servico_contratado`

**Lib:**
- Create: `src/lib/painel/pacote-matrix.ts` — `PACOTE_COLUMNS`, `PACOTES_NO_PAINEL_MENSAL`, helpers `isApplicable(pacote, coluna)`, `tipoPacoteBadge(pacote)`
- Modify: `src/lib/painel/queries.ts` — incluir os novos campos de checklist + tipo_pacote do cliente
- Modify: `src/lib/painel/actions.ts` — novas actions: `setGmnDataAction`, `setTpgTpmAction`, `setMonthlyPostsAction`, `delegarDesignAction`
- Modify: `src/lib/painel/chain.ts` — incluir novo estado `delegado` na transição automática

**Componentes:**
- Create: `src/components/painel/TipoPacoteBadge.tsx`
- Create: `src/components/painel/cells/NaoSeAplicaCell.tsx` — `—` cinza com tooltip
- Create: `src/components/painel/cells/PacotePostadosCell.tsx` — `5/8` + progress + modal
- Create: `src/components/painel/cells/CronoCell.tsx` — pill + opens drive_url
- Create: `src/components/painel/cells/DesignCell.tsx` — 3 estados: não delegado / delegado / pronto
- Create: `src/components/painel/cells/TpgTpmCell.tsx` — popover ativo/inativo + valor
- Create: `src/components/painel/cells/GmnCell.tsx` — pill colorido por nota + modal
- Create: `src/components/painel/cells/CameraMobileCell.tsx` — pendente/pronto (Fase 1)
- Create: `src/components/painel/cells/EdicaoCell.tsx` — 3 estados: ninguém/em andamento/editado
- Create: `src/components/painel/cells/ReuniaoCell.tsx` — pendente/pronto
- Create: `src/components/painel/cells/DriveCell.tsx` — botão 📂
- Create: `src/components/painel/modals/GmnModal.tsx`
- Create: `src/components/painel/modals/PacotePostadosModal.tsx`
- Create: `src/components/painel/modals/TpgTpmPopover.tsx`
- Modify: `src/components/painel/PainelTable.tsx` — usa as novas células + filtro tipo
- Modify: `src/components/painel/PainelHeader.tsx` — adiciona filtro de tipo

**Pages:**
- Modify: `src/app/(authed)/painel/page.tsx` — usa nova query + filtro
- Create: `src/app/(authed)/painel/legacy/page.tsx` — copia da página atual antes da modificação

**Cliente form:**
- Modify: `src/components/clientes/ClienteForm.tsx` (ou similar) — adiciona campos `tipo_pacote`, `cadencia_reuniao`, `numero_unidades`, `valor_trafego_google`, `valor_trafego_meta`, `drive_url` (já existe), `tipo_pacote_revisado`
- Modify: `src/lib/clientes/schema.ts` — zod inclui novos campos
- Modify: `src/lib/clientes/actions.ts` — persiste novos campos

**Testes:**
- Create: `tests/unit/painel-pacote-matrix.test.ts`
- Create: `tests/unit/painel-actions-fase1.test.ts`

**Não dropamos:**
- `servico_contratado` em `clients` (read-only legado, drop fica pra Fase 3)
- Página `/painel/legacy` fica acessível por 1 semana após deploy

---

## Convenções a seguir

- Migrations dividem `alter type ... add value` em arquivo próprio (Postgres não permite usar valor novo na mesma transação).
- Server actions com `"use server"`, retornam `{ success: true } | { error: string }`. Validam com zod.
- `requireAuth()` no início; permissões delegadas a RLS na maioria dos casos.
- `revalidatePath("/painel")` ao final.
- UI compõe via cells pequenas, cada uma cobrindo um tipo de status visual.
- Nomes em PT-BR pra texto da UI; código em EN ou PT consistente com o padrão da pasta (`painel/` usa PT).

---

## Task 1: Migration — enums + fields em clients

**Files:**
- Create: `supabase/migrations/20260502000029_painel_redesign_pacotes.sql`

- [ ] **Step 1: Criar migration**

Create `supabase/migrations/20260502000029_painel_redesign_pacotes.sql`:

```sql
-- supabase/migrations/20260502000029_painel_redesign_pacotes.sql

-- =============================================
-- Enum tipo_pacote
-- =============================================
create type public.tipo_pacote as enum (
  -- Aparecem no Painel Mensal:
  'trafego_estrategia',
  'trafego',
  'estrategia',
  'audiovisual',
  'yide_360',
  -- Pacotes do futuro Painel Dev (não aparecem no Painel Mensal):
  'site',
  'ia',
  'crm',
  'crm_ia'
);

-- =============================================
-- Enum cadencia_reuniao
-- =============================================
create type public.cadencia_reuniao as enum (
  'semanal',
  'quinzenal',
  'mensal',
  'trimestral'
);

-- =============================================
-- Novos campos em clients
-- =============================================
alter table public.clients
  add column if not exists tipo_pacote public.tipo_pacote,
  add column if not exists cadencia_reuniao public.cadencia_reuniao,
  add column if not exists numero_unidades integer not null default 1,
  add column if not exists valor_trafego_google numeric(12,2),
  add column if not exists valor_trafego_meta numeric(12,2),
  add column if not exists tipo_pacote_revisado boolean not null default false;

create index if not exists idx_clients_tipo_pacote on public.clients(tipo_pacote);
```

- [ ] **Step 2: Aplicar via Management API**

```bash
TOKEN=$(grep SUPABASE_ACCESS_TOKEN "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | sed 's/.*=//' | tr -d '\n\r ')
SQL=$(cat supabase/migrations/20260502000029_painel_redesign_pacotes.sql)
curl -s -X POST "https://api.supabase.com/v1/projects/jelvhwbpipawghwufpbc/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data-raw "$(jq -Rs --arg q "$SQL" '{query:$q}' <<<'')"
```

Expected: `[]` (no error). Verifica:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/jelvhwbpipawghwufpbc/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select unnest(enum_range(null::tipo_pacote))::text;"}'
```
Expected: 9 rows com os pacotes.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260502000029_painel_redesign_pacotes.sql
git commit -m "feat(painel): migration — enums tipo_pacote/cadencia + fields em clients"
```

---

## Task 2: Migration — 'delegado' status + extras em client_monthly_checklist

**Files:**
- Create: `supabase/migrations/20260502000030_painel_redesign_extras.sql`

- [ ] **Step 1: Criar migration**

Create `supabase/migrations/20260502000030_painel_redesign_extras.sql`:

```sql
-- supabase/migrations/20260502000030_painel_redesign_extras.sql

-- 'delegado' como status (design e edição usam principalmente)
alter type public.checklist_step_status add value if not exists 'delegado';

-- Extends client_monthly_checklist com fields da Fase 1
alter table public.client_monthly_checklist
  add column if not exists tpg_ativo boolean,
  add column if not exists tpm_ativo boolean,
  add column if not exists gmn_comentarios integer not null default 0,
  add column if not exists gmn_avaliacoes integer not null default 0,
  add column if not exists gmn_nota_media numeric(2,1),
  add column if not exists gmn_observacoes text;

-- Validação da nota
alter table public.client_monthly_checklist
  add constraint chk_gmn_nota_range
  check (gmn_nota_media is null or (gmn_nota_media >= 0 and gmn_nota_media <= 5));
```

- [ ] **Step 2: Aplicar**

Mesmo padrão da Task 1 (curl Management API).

Verifica que `delegado` está no enum:
```bash
curl -s -X POST "..." -d '{"query":"select unnest(enum_range(null::checklist_step_status))::text;"}'
```
Expected: 5 valores incluindo `delegado`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260502000030_painel_redesign_extras.sql
git commit -m "feat(painel): migration — delegado status + GMN/TPG/TPM em checklist mensal"
```

---

## Task 3: Migration — backfill tipo_pacote

**Files:**
- Create: `supabase/migrations/20260502000031_clients_servico_to_pacote.sql`

- [ ] **Step 1: Criar migration de backfill**

Create `supabase/migrations/20260502000031_clients_servico_to_pacote.sql`:

```sql
-- supabase/migrations/20260502000031_clients_servico_to_pacote.sql
-- Best-effort: infere tipo_pacote a partir de servico_contratado livre.
-- Linhas convertidas ficam tipo_pacote_revisado=false até sócio confirmar.

update public.clients set tipo_pacote = case
  when servico_contratado ilike '%trafego%estrat%'
    or servico_contratado ilike '%tráfego%estrat%'
    or servico_contratado ilike '%estrat%trafego%'
    or servico_contratado ilike '%estrat%tráfego%' then 'trafego_estrategia'::public.tipo_pacote
  when servico_contratado ilike '%yide%360%'
    or servico_contratado ilike '%full%'
    or servico_contratado ilike '%premium%' then 'yide_360'::public.tipo_pacote
  when servico_contratado ilike '%trafego%'
    or servico_contratado ilike '%tráfego%' then 'trafego'::public.tipo_pacote
  when servico_contratado ilike '%estrat%' then 'estrategia'::public.tipo_pacote
  when servico_contratado ilike '%audiovisual%'
    or servico_contratado ilike '%video%'
    or servico_contratado ilike '%vídeo%' then 'audiovisual'::public.tipo_pacote
  when servico_contratado ilike '%site%' then 'site'::public.tipo_pacote
  when servico_contratado ilike '%crm%ia%'
    or servico_contratado ilike '%ia%crm%' then 'crm_ia'::public.tipo_pacote
  when servico_contratado ilike '%crm%' then 'crm'::public.tipo_pacote
  when servico_contratado ilike '%ia%' then 'ia'::public.tipo_pacote
  else 'trafego_estrategia'::public.tipo_pacote
end
where tipo_pacote is null;

-- Garante que ninguém ficou null (caso linha sem servico_contratado)
update public.clients
set tipo_pacote = 'trafego_estrategia'::public.tipo_pacote
where tipo_pacote is null;

-- A flag tipo_pacote_revisado já vem default false; sócio precisa confirmar manualmente.
```

- [ ] **Step 2: Aplicar e verificar**

Aplicar via curl como nas tasks anteriores.

```bash
curl -s -X POST "..." -d '{"query":"select tipo_pacote, count(*) from clients group by tipo_pacote order by 1;"}'
```
Expected: distribuição de pacotes; nenhuma linha com tipo_pacote null.

- [ ] **Step 3: Regenerar types**

```bash
SUPABASE_ACCESS_TOKEN=$(grep SUPABASE_ACCESS_TOKEN "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | sed 's/.*=//') SUPABASE_PROJECT_ID=jelvhwbpipawghwufpbc npm run db:types
```

Verificar:
```bash
grep -c "tipo_pacote" src/types/database.ts
grep -c "delegado" src/types/database.ts
grep -c "gmn_comentarios" src/types/database.ts
```
Expected: cada um ≥ 2.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260502000031_clients_servico_to_pacote.sql src/types/database.ts
git commit -m "feat(painel): backfill tipo_pacote a partir de servico_contratado"
```

---

## Task 4: Pacote matrix lib + tests

**Files:**
- Create: `src/lib/painel/pacote-matrix.ts`
- Test: `tests/unit/painel-pacote-matrix.test.ts`

- [ ] **Step 1: Escrever testes**

Create `tests/unit/painel-pacote-matrix.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  PACOTE_COLUMNS,
  PACOTES_NO_PAINEL_MENSAL,
  isApplicable,
  tipoPacoteBadge,
  type ColumnKey,
  type TipoPacote,
} from "@/lib/painel/pacote-matrix";

describe("PACOTE_COLUMNS", () => {
  it("trafego_estrategia tem todas as colunas aplicáveis", () => {
    const cols = PACOTE_COLUMNS.trafego_estrategia;
    for (const k of Object.keys(cols) as ColumnKey[]) {
      expect(cols[k]).toBe(1);
    }
  });

  it("trafego não tem GMN nem audiovisual nem postagem", () => {
    expect(PACOTE_COLUMNS.trafego.gmn).toBe(0);
    expect(PACOTE_COLUMNS.trafego.camera).toBe(0);
    expect(PACOTE_COLUMNS.trafego.mobile).toBe(0);
    expect(PACOTE_COLUMNS.trafego.edicao).toBe(0);
    expect(PACOTE_COLUMNS.trafego.pacote_postados).toBe(0);
  });

  it("estrategia não tem TPG/TPM", () => {
    expect(PACOTE_COLUMNS.estrategia.tpg).toBe(0);
    expect(PACOTE_COLUMNS.estrategia.tpm).toBe(0);
  });

  it("audiovisual não tem design, GMN, TPG, TPM, postagem", () => {
    expect(PACOTE_COLUMNS.audiovisual.design).toBe(0);
    expect(PACOTE_COLUMNS.audiovisual.gmn).toBe(0);
    expect(PACOTE_COLUMNS.audiovisual.tpg).toBe(0);
    expect(PACOTE_COLUMNS.audiovisual.tpm).toBe(0);
    expect(PACOTE_COLUMNS.audiovisual.pacote_postados).toBe(0);
  });

  it("yide_360 tem tudo (igual trafego_estrategia)", () => {
    expect(PACOTE_COLUMNS.yide_360).toEqual(PACOTE_COLUMNS.trafego_estrategia);
  });

  it("pacotes do Painel Dev têm tudo zerado", () => {
    for (const p of ["site", "ia", "crm", "crm_ia"] as TipoPacote[]) {
      const cols = PACOTE_COLUMNS[p];
      expect(Object.values(cols).every((v) => v === 0)).toBe(true);
    }
  });
});

describe("PACOTES_NO_PAINEL_MENSAL", () => {
  it("inclui exatamente os 5 pacotes do painel mensal", () => {
    expect([...PACOTES_NO_PAINEL_MENSAL].sort()).toEqual([
      "audiovisual", "estrategia", "trafego", "trafego_estrategia", "yide_360",
    ]);
  });

  it("não inclui pacotes do Painel Dev", () => {
    for (const p of ["site", "ia", "crm", "crm_ia"]) {
      expect((PACOTES_NO_PAINEL_MENSAL as readonly string[]).includes(p)).toBe(false);
    }
  });
});

describe("isApplicable", () => {
  it("retorna true quando coluna se aplica", () => {
    expect(isApplicable("trafego_estrategia", "design")).toBe(true);
  });
  it("retorna false quando não se aplica", () => {
    expect(isApplicable("audiovisual", "design")).toBe(false);
    expect(isApplicable("trafego", "gmn")).toBe(false);
  });
});

describe("tipoPacoteBadge", () => {
  it("retorna label e cor pra cada pacote", () => {
    const b = tipoPacoteBadge("trafego_estrategia");
    expect(b.label).toBe("Tráfego+Estratégia");
    expect(b.classes).toContain("primary");
  });
  it("yide_360 usa gradiente dourado", () => {
    const b = tipoPacoteBadge("yide_360");
    expect(b.label).toBe("Yide 360°");
    expect(b.classes).toContain("gradient");
  });
});
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npx vitest run tests/unit/painel-pacote-matrix.test.ts`
Expected: FAIL com erro de import.

- [ ] **Step 3: Implementar**

Create `src/lib/painel/pacote-matrix.ts`:

```ts
export const TIPOS_PACOTE = [
  "trafego_estrategia",
  "trafego",
  "estrategia",
  "audiovisual",
  "yide_360",
  "site",
  "ia",
  "crm",
  "crm_ia",
] as const;
export type TipoPacote = (typeof TIPOS_PACOTE)[number];

export const COLUMN_KEYS = [
  "crono",
  "design",
  "tpg",
  "tpm",
  "gmn",
  "camera",
  "mobile",
  "edicao",
  "reuniao",
  "pacote_postados",
] as const;
export type ColumnKey = (typeof COLUMN_KEYS)[number];

export type ColumnFlags = Record<ColumnKey, 0 | 1>;

const NOTHING: ColumnFlags = {
  crono: 0, design: 0, tpg: 0, tpm: 0, gmn: 0,
  camera: 0, mobile: 0, edicao: 0, reuniao: 0, pacote_postados: 0,
};

export const PACOTE_COLUMNS: Record<TipoPacote, ColumnFlags> = {
  trafego_estrategia: {
    crono: 1, design: 1, tpg: 1, tpm: 1, gmn: 1,
    camera: 1, mobile: 1, edicao: 1, reuniao: 1, pacote_postados: 1,
  },
  trafego: {
    crono: 0, design: 1, tpg: 1, tpm: 1, gmn: 0,
    camera: 0, mobile: 0, edicao: 0, reuniao: 1, pacote_postados: 0,
  },
  estrategia: {
    crono: 1, design: 1, tpg: 0, tpm: 0, gmn: 1,
    camera: 1, mobile: 1, edicao: 1, reuniao: 1, pacote_postados: 1,
  },
  audiovisual: {
    crono: 1, design: 0, tpg: 0, tpm: 0, gmn: 0,
    camera: 1, mobile: 1, edicao: 1, reuniao: 1, pacote_postados: 0,
  },
  yide_360: {
    crono: 1, design: 1, tpg: 1, tpm: 1, gmn: 1,
    camera: 1, mobile: 1, edicao: 1, reuniao: 1, pacote_postados: 1,
  },
  site: { ...NOTHING },
  ia: { ...NOTHING },
  crm: { ...NOTHING },
  crm_ia: { ...NOTHING },
};

export const PACOTES_NO_PAINEL_MENSAL: readonly TipoPacote[] = [
  "trafego_estrategia",
  "trafego",
  "estrategia",
  "audiovisual",
  "yide_360",
];

export function isApplicable(pacote: TipoPacote, coluna: ColumnKey): boolean {
  return PACOTE_COLUMNS[pacote][coluna] === 1;
}

export interface BadgeMeta {
  label: string;
  /** Tailwind classes p/ background, text, e (opcionalmente) gradient */
  classes: string;
}

export function tipoPacoteBadge(pacote: TipoPacote): BadgeMeta {
  switch (pacote) {
    case "trafego_estrategia":
      return { label: "Tráfego+Estratégia", classes: "bg-primary/15 text-primary border-primary/30" };
    case "trafego":
      return { label: "Tráfego", classes: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" };
    case "estrategia":
      return { label: "Estratégia", classes: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" };
    case "audiovisual":
      return { label: "Audiovisual", classes: "bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30" };
    case "yide_360":
      return { label: "Yide 360°", classes: "bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-amber-500/30" };
    case "site":
      return { label: "Site", classes: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30" };
    case "ia":
      return { label: "IA", classes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" };
    case "crm":
      return { label: "CRM", classes: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30" };
    case "crm_ia":
      return { label: "CRM+IA", classes: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30" };
  }
}
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run tests/unit/painel-pacote-matrix.test.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/painel/pacote-matrix.ts tests/unit/painel-pacote-matrix.test.ts
git commit -m "feat(painel): pacote-matrix lib (matriz de colunas + badges) com testes"
```

---

## Task 5: Atualizar queries pra trazer novos campos

**Files:**
- Modify: `src/lib/painel/queries.ts`

- [ ] **Step 1: Atualizar select de clientes pra incluir tipo_pacote, cadencia, valores**

Edit `src/lib/painel/queries.ts`. Substituir:

```ts
let clientsQuery = supabase
  .from("clients")
  .select("id, nome, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id, drive_url, instagram_url")
  .eq("status", "ativo");
```

por:

```ts
let clientsQuery = supabase
  .from("clients")
  .select(`
    id, nome, assessor_id, coordenador_id, designer_id, videomaker_id, editor_id,
    drive_url, instagram_url,
    tipo_pacote, tipo_pacote_revisado, cadencia_reuniao, numero_unidades,
    valor_trafego_google, valor_trafego_meta
  `)
  .eq("status", "ativo")
  .in("tipo_pacote", [
    "trafego_estrategia", "trafego", "estrategia", "audiovisual", "yide_360",
  ]);
```

E atualizar o tipo do array `clients` pra incluir os novos campos. Atualizar interface `ChecklistRow`:

```ts
export interface ChecklistRow {
  id: string;
  client_id: string;
  client_nome: string;
  client_designer_id: string | null;
  client_videomaker_id: string | null;
  client_editor_id: string | null;
  client_drive_url: string | null;
  client_instagram_url: string | null;
  client_tipo_pacote: TipoPacote;
  client_tipo_pacote_revisado: boolean;
  client_cadencia_reuniao: CadenciaReuniao | null;
  client_numero_unidades: number;
  client_valor_trafego_google: number | null;
  client_valor_trafego_meta: number | null;
  mes_referencia: string;
  pacote_post: number | null;
  quantidade_postada: number | null;
  valor_trafego_mes: number | null;
  tpg_ativo: boolean | null;
  tpm_ativo: boolean | null;
  gmn_comentarios: number;
  gmn_avaliacoes: number;
  gmn_nota_media: number | null;
  gmn_observacoes: string | null;
  steps: ChecklistStepRow[];
}
```

E adicionar imports no topo:

```ts
import type { TipoPacote } from "./pacote-matrix";

type CadenciaReuniao = "semanal" | "quinzenal" | "mensal" | "trimestral";
```

E atualizar o select do `client_monthly_checklist`:

```ts
const { data: checklistsData } = await supabase
  .from("client_monthly_checklist")
  .select(`
    id, client_id, mes_referencia,
    pacote_post, quantidade_postada, valor_trafego_mes,
    tpg_ativo, tpm_ativo,
    gmn_comentarios, gmn_avaliacoes, gmn_nota_media, gmn_observacoes
  `)
  .eq("mes_referencia", mesReferencia)
  .in("client_id", clientIds);
```

E atualizar os retornos pra preencher esses campos novos:

```ts
return clients.map((c) => {
  const cl = checklists.find((x) => x.client_id === c.id);
  return {
    id: cl?.id ?? "",
    client_id: c.id,
    client_nome: c.nome,
    client_designer_id: c.designer_id,
    client_videomaker_id: c.videomaker_id,
    client_editor_id: c.editor_id,
    client_drive_url: c.drive_url,
    client_instagram_url: c.instagram_url,
    client_tipo_pacote: c.tipo_pacote as TipoPacote,
    client_tipo_pacote_revisado: c.tipo_pacote_revisado,
    client_cadencia_reuniao: c.cadencia_reuniao as CadenciaReuniao | null,
    client_numero_unidades: c.numero_unidades,
    client_valor_trafego_google: c.valor_trafego_google,
    client_valor_trafego_meta: c.valor_trafego_meta,
    mes_referencia: mesReferencia,
    pacote_post: cl?.pacote_post ?? null,
    quantidade_postada: cl?.quantidade_postada ?? null,
    valor_trafego_mes: cl?.valor_trafego_mes ?? null,
    tpg_ativo: cl?.tpg_ativo ?? null,
    tpm_ativo: cl?.tpm_ativo ?? null,
    gmn_comentarios: cl?.gmn_comentarios ?? 0,
    gmn_avaliacoes: cl?.gmn_avaliacoes ?? 0,
    gmn_nota_media: cl?.gmn_nota_media ?? null,
    gmn_observacoes: cl?.gmn_observacoes ?? null,
    steps: cl ? (stepsByChecklist.get(cl.id) ?? []) : [],
  };
});
```

(Faça o mesmo no return do early-exit "if checklists.length === 0".)

- [ ] **Step 2: Verificar typecheck**

Run: `npm run typecheck`
Expected: 0 errors. Se reclamar de cast, ajuste com `as unknown as TipoPacote` apenas onde necessário.

- [ ] **Step 3: Commit**

```bash
git add src/lib/painel/queries.ts
git commit -m "feat(painel): queries trazem tipo_pacote + extras (TPG/TPM/GMN) do checklist"
```

---

## Task 6: Server actions novas (GMN, TPG/TPM, postagens, delegar design)

**Files:**
- Modify: `src/lib/painel/actions.ts`
- Test: `tests/unit/painel-actions-fase1.test.ts`

- [ ] **Step 1: Adicionar actions novas**

Edit `src/lib/painel/actions.ts`. Adicionar no fim do arquivo (manter as existentes):

```ts
// =============================================
// Fase 1 — actions novas
// =============================================

const setGmnSchema = z.object({
  checklist_id: uuidLike,
  gmn_comentarios: z.coerce.number().int().min(0),
  gmn_avaliacoes: z.coerce.number().int().min(0),
  gmn_nota_media: z.coerce.number().min(0).max(5).nullable().optional(),
  gmn_observacoes: z.string().max(2000).nullable().optional(),
});

export async function setGmnDataAction(formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = setGmnSchema.safeParse({
    checklist_id: formData.get("checklist_id"),
    gmn_comentarios: formData.get("gmn_comentarios"),
    gmn_avaliacoes: formData.get("gmn_avaliacoes"),
    gmn_nota_media: formData.get("gmn_nota_media") || null,
    gmn_observacoes: formData.get("gmn_observacoes") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_monthly_checklist")
    .update({
      gmn_comentarios: parsed.data.gmn_comentarios,
      gmn_avaliacoes: parsed.data.gmn_avaliacoes,
      gmn_nota_media: parsed.data.gmn_nota_media ?? null,
      gmn_observacoes: parsed.data.gmn_observacoes ?? null,
    })
    .eq("id", parsed.data.checklist_id);
  if (error) return { error: error.message };

  revalidatePath("/painel");
  return { success: true };
}

const setTpgTpmSchema = z.object({
  checklist_id: uuidLike,
  field: z.enum(["tpg_ativo", "tpm_ativo"]),
  ativo: z.coerce.boolean(),
});

export async function setTpgTpmAction(formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = setTpgTpmSchema.safeParse({
    checklist_id: formData.get("checklist_id"),
    field: formData.get("field"),
    ativo: formData.get("ativo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const payload = parsed.data.field === "tpg_ativo"
    ? { tpg_ativo: parsed.data.ativo }
    : { tpm_ativo: parsed.data.ativo };

  const { error } = await supabase
    .from("client_monthly_checklist")
    .update(payload)
    .eq("id", parsed.data.checklist_id);
  if (error) return { error: error.message };

  revalidatePath("/painel");
  return { success: true };
}

const setMonthlyPostsSchema = z.object({
  checklist_id: uuidLike,
  pacote_post: z.coerce.number().int().min(0),
  quantidade_postada: z.coerce.number().int().min(0),
});

export async function setMonthlyPostsAction(formData: FormData): Promise<ActionResult> {
  await requireAuth();
  const parsed = setMonthlyPostsSchema.safeParse({
    checklist_id: formData.get("checklist_id"),
    pacote_post: formData.get("pacote_post"),
    quantidade_postada: formData.get("quantidade_postada"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_monthly_checklist")
    .update({
      pacote_post: parsed.data.pacote_post,
      quantidade_postada: parsed.data.quantidade_postada,
    })
    .eq("id", parsed.data.checklist_id);
  if (error) return { error: error.message };

  revalidatePath("/painel");
  return { success: true };
}

const delegarDesignSchema = z.object({
  step_id: uuidLike,
});

export async function delegarDesignAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireAuth();
  const parsed = delegarDesignSchema.safeParse({ step_id: formData.get("step_id") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: step } = await supabase
    .from("checklist_step")
    .select("id, step_key, status, responsavel_id, client_monthly_checklist(client_id, cliente:clients(designer_id))")
    .eq("id", parsed.data.step_id)
    .single();

  if (!step) return { error: "Etapa não encontrada" };
  const s = step as unknown as {
    id: string;
    step_key: string;
    status: string;
    responsavel_id: string | null;
    client_monthly_checklist: {
      client_id: string;
      cliente: { designer_id: string | null };
    };
  };

  if (s.step_key !== "design") return { error: "Action só para design" };

  const designerId = s.client_monthly_checklist.cliente.designer_id;
  if (!designerId) return { error: "Cliente sem designer cadastrado" };

  const { error } = await supabase
    .from("checklist_step")
    .update({
      status: "delegado",
      responsavel_id: designerId,
      iniciado_em: new Date().toISOString(),
    })
    .eq("id", s.id);
  if (error) return { error: error.message };

  await dispatchNotification({
    evento_tipo: "checklist_step_delegada",
    titulo: `Design delegado pra você`,
    mensagem: `Por ${actor.nome}`,
    link: "/painel",
    user_ids_extras: [designerId],
  });

  revalidatePath("/painel");
  return { success: true };
}
```

- [ ] **Step 2: Escrever testes mocked**

Create `tests/unit/painel-actions-fase1.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const dispatchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireAuth: requireAuthMock,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: fromMock }),
}));
vi.mock("@/lib/notificacoes/dispatch", () => ({
  dispatchNotification: dispatchMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  setGmnDataAction,
  setTpgTpmAction,
  setMonthlyPostsAction,
} from "@/lib/painel/actions";

const ACTOR = { id: "11111111-1111-1111-1111-111111111111", role: "assessor" as const, nome: "x", email: "a@x.com", ativo: true, avatarUrl: null };
const CHECKLIST_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue(ACTOR);
});

describe("setGmnDataAction", () => {
  it("rejeita nota fora de 0..5", async () => {
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("gmn_comentarios", "10");
    fd.set("gmn_avaliacoes", "5");
    fd.set("gmn_nota_media", "7");
    const result = await setGmnDataAction(fd);
    expect(result).toHaveProperty("error");
  });

  it("salva quando válido", async () => {
    fromMock.mockReturnValue({ update: () => ({ eq: async () => ({ error: null }) }) });
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("gmn_comentarios", "10");
    fd.set("gmn_avaliacoes", "5");
    fd.set("gmn_nota_media", "4.7");
    fd.set("gmn_observacoes", "Subiu 3 posições");
    const result = await setGmnDataAction(fd);
    expect(result).toEqual({ success: true });
  });
});

describe("setTpgTpmAction", () => {
  it("rejeita field inválido", async () => {
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("field", "valor_trafego_mes");
    fd.set("ativo", "true");
    const result = await setTpgTpmAction(fd);
    expect(result).toHaveProperty("error");
  });

  it("aceita field válido", async () => {
    fromMock.mockReturnValue({ update: () => ({ eq: async () => ({ error: null }) }) });
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("field", "tpg_ativo");
    fd.set("ativo", "true");
    const result = await setTpgTpmAction(fd);
    expect(result).toEqual({ success: true });
  });
});

describe("setMonthlyPostsAction", () => {
  it("aceita postagens 5/8", async () => {
    fromMock.mockReturnValue({ update: () => ({ eq: async () => ({ error: null }) }) });
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("pacote_post", "8");
    fd.set("quantidade_postada", "5");
    const result = await setMonthlyPostsAction(fd);
    expect(result).toEqual({ success: true });
  });

  it("rejeita números negativos", async () => {
    const fd = new FormData();
    fd.set("checklist_id", CHECKLIST_ID);
    fd.set("pacote_post", "-1");
    fd.set("quantidade_postada", "0");
    const result = await setMonthlyPostsAction(fd);
    expect(result).toHaveProperty("error");
  });
});
```

- [ ] **Step 3: Rodar testes**

Run: `npx vitest run tests/unit/painel-actions-fase1.test.ts`
Expected: 6 tests pass.

- [ ] **Step 4: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/painel/actions.ts tests/unit/painel-actions-fase1.test.ts
git commit -m "feat(painel): actions novas — setGmnData, setTpgTpm, setMonthlyPosts, delegarDesign"
```

---

## Task 7: TipoPacoteBadge + NaoSeAplicaCell

**Files:**
- Create: `src/components/painel/TipoPacoteBadge.tsx`
- Create: `src/components/painel/cells/NaoSeAplicaCell.tsx`

- [ ] **Step 1: TipoPacoteBadge**

Create `src/components/painel/TipoPacoteBadge.tsx`:

```tsx
import { tipoPacoteBadge, type TipoPacote } from "@/lib/painel/pacote-matrix";
import { cn } from "@/lib/utils";

export function TipoPacoteBadge({ pacote, numeroUnidades = 1 }: { pacote: TipoPacote; numeroUnidades?: number }) {
  const meta = tipoPacoteBadge(pacote);
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.classes)}>
        {meta.label}
      </span>
      {numeroUnidades > 1 && (
        <span className="text-[10px] text-muted-foreground">· {numeroUnidades} unidades</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: NaoSeAplicaCell**

Create `src/components/painel/cells/NaoSeAplicaCell.tsx`:

```tsx
export function NaoSeAplicaCell({ tooltip }: { tooltip?: string }) {
  return (
    <span
      title={tooltip ?? "Não se aplica a este pacote"}
      className="inline-flex h-7 w-12 items-center justify-center rounded-md text-[11px] text-muted-foreground/60"
    >
      —
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/painel/TipoPacoteBadge.tsx src/components/painel/cells/NaoSeAplicaCell.tsx
git commit -m "feat(painel): TipoPacoteBadge + NaoSeAplicaCell"
```

---

## Task 8: PacotePostadosCell + Modal

**Files:**
- Create: `src/components/painel/cells/PacotePostadosCell.tsx`
- Create: `src/components/painel/modals/PacotePostadosModal.tsx`

- [ ] **Step 1: Modal**

Create `src/components/painel/modals/PacotePostadosModal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setMonthlyPostsAction } from "@/lib/painel/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId: string;
  clientNome: string;
  initialPacotePost: number;
  initialPostados: number;
}

export function PacotePostadosModal({ open, onOpenChange, checklistId, clientNome, initialPacotePost, initialPostados }: Props) {
  const [pacote, setPacote] = useState(String(initialPacotePost));
  const [postados, setPostados] = useState(String(initialPostados));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("checklist_id", checklistId);
    fd.set("pacote_post", pacote);
    fd.set("quantidade_postada", postados);
    startTransition(async () => {
      const r = await setMonthlyPostsAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Postagens — {clientNome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="pacote_post">Pacote contratado</Label>
            <Input id="pacote_post" type="number" min={0} value={pacote} onChange={(e) => setPacote(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantidade_postada">Postados até agora</Label>
            <Input id="quantidade_postada" type="number" min={0} value={postados} onChange={(e) => setPostados(e.target.value)} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Cell**

Create `src/components/painel/cells/PacotePostadosCell.tsx`:

```tsx
"use client";

import { useState } from "react";
import { PacotePostadosModal } from "../modals/PacotePostadosModal";
import { cn } from "@/lib/utils";

interface Props {
  checklistId: string;
  clientNome: string;
  pacotePost: number | null;
  postados: number | null;
  canEdit: boolean;
}

export function PacotePostadosCell({ checklistId, clientNome, pacotePost, postados, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const total = pacotePost ?? 0;
  const done = postados ?? 0;
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;

  if (!checklistId) {
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  }

  const isComplete = total > 0 && done >= total;

  return (
    <>
      <button
        type="button"
        onClick={() => canEdit && setOpen(true)}
        disabled={!canEdit}
        className={cn(
          "inline-flex w-full flex-col items-stretch gap-1 rounded-md px-2 py-1 text-left text-[11px] transition-colors",
          canEdit ? "hover:bg-muted" : "cursor-default",
        )}
      >
        <span className={cn("font-semibold tabular-nums", isComplete && "text-emerald-600 dark:text-emerald-400")}>
          {done} / {total || "—"}
        </span>
        {total > 0 && (
          <span className="h-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full transition-all", isComplete ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </span>
        )}
      </button>
      {canEdit && (
        <PacotePostadosModal
          open={open}
          onOpenChange={setOpen}
          checklistId={checklistId}
          clientNome={clientNome}
          initialPacotePost={total}
          initialPostados={done}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/painel/cells/PacotePostadosCell.tsx src/components/painel/modals/PacotePostadosModal.tsx
git commit -m "feat(painel): PacotePostadosCell + modal de lançamento mensal"
```

---

## Task 9: GmnCell + Modal

**Files:**
- Create: `src/components/painel/cells/GmnCell.tsx`
- Create: `src/components/painel/modals/GmnModal.tsx`

- [ ] **Step 1: Modal**

Create `src/components/painel/modals/GmnModal.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setGmnDataAction } from "@/lib/painel/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId: string;
  clientNome: string;
  mesReferencia: string;
  initial: {
    comentarios: number;
    avaliacoes: number;
    notaMedia: number | null;
    observacoes: string | null;
  };
}

export function GmnModal({ open, onOpenChange, checklistId, clientNome, mesReferencia, initial }: Props) {
  const [comentarios, setComentarios] = useState(String(initial.comentarios));
  const [avaliacoes, setAvaliacoes] = useState(String(initial.avaliacoes));
  const [nota, setNota] = useState(initial.notaMedia ?? 0);
  const [observacoes, setObservacoes] = useState(initial.observacoes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("checklist_id", checklistId);
    fd.set("gmn_comentarios", comentarios);
    fd.set("gmn_avaliacoes", avaliacoes);
    if (nota > 0) fd.set("gmn_nota_media", String(nota));
    if (observacoes.trim()) fd.set("gmn_observacoes", observacoes.trim());
    startTransition(async () => {
      const r = await setGmnDataAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>GMN — {clientNome} — {mesReferencia}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="gmn_comentarios">Comentários do mês</Label>
              <Input id="gmn_comentarios" type="number" min={0} value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gmn_avaliacoes">Avaliações do mês</Label>
              <Input id="gmn_avaliacoes" type="number" min={0} value={avaliacoes} onChange={(e) => setAvaliacoes(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gmn_nota_media">Nota média (0.0 – 5.0)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="gmn_nota_media"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={nota}
                onChange={(e) => setNota(Number(e.target.value))}
                className="w-24"
              />
              <span className="flex items-center gap-1 text-amber-500">
                <Star className="h-4 w-4 fill-current" />
                <span className="tabular-nums font-semibold">{nota.toFixed(1)}</span>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gmn_observacoes">Observações de posicionamento (opcional)</Label>
            <Textarea
              id="gmn_observacoes"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex.: Cliente subiu 3 posições nas buscas locais"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Cell**

Create `src/components/painel/cells/GmnCell.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { GmnModal } from "../modals/GmnModal";
import { cn } from "@/lib/utils";

interface Props {
  checklistId: string;
  clientNome: string;
  mesReferencia: string;
  comentarios: number;
  avaliacoes: number;
  notaMedia: number | null;
  observacoes: string | null;
  canEdit: boolean;
}

function colorByNota(nota: number | null): string {
  if (nota === null) return "border-muted-foreground/30 text-muted-foreground";
  if (nota >= 4.5) return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (nota >= 3.5) return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

export function GmnCell({ checklistId, clientNome, mesReferencia, comentarios, avaliacoes, notaMedia, observacoes, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  if (!checklistId) {
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  }

  const semDados = notaMedia === null && comentarios === 0 && avaliacoes === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => canEdit && setOpen(true)}
        disabled={!canEdit}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] font-medium transition-colors",
          colorByNota(notaMedia),
          canEdit && "hover:opacity-80 cursor-pointer",
          !canEdit && "cursor-default",
        )}
        title={observacoes ?? undefined}
      >
        {semDados ? (
          "—"
        ) : (
          <>
            <Star className="h-3 w-3 fill-current" />
            <span className="tabular-nums">{(notaMedia ?? 0).toFixed(1)}</span>
          </>
        )}
      </button>
      {canEdit && (
        <GmnModal
          open={open}
          onOpenChange={setOpen}
          checklistId={checklistId}
          clientNome={clientNome}
          mesReferencia={mesReferencia}
          initial={{ comentarios, avaliacoes, notaMedia, observacoes }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/painel/cells/GmnCell.tsx src/components/painel/modals/GmnModal.tsx
git commit -m "feat(painel): GmnCell colorido por nota + modal de lançamento mensal"
```

---

## Task 10: TpgTpmCell + Popover

**Files:**
- Create: `src/components/painel/cells/TpgTpmCell.tsx`
- Create: `src/components/painel/modals/TpgTpmPopover.tsx`

- [ ] **Step 1: Popover**

Create `src/components/painel/modals/TpgTpmPopover.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { setTpgTpmAction } from "@/lib/painel/actions";
import { cn } from "@/lib/utils";

interface Props {
  trigger: React.ReactNode;
  checklistId: string;
  field: "tpg_ativo" | "tpm_ativo";
  initialAtivo: boolean | null;
  valorAcordado: number | null;
  canEdit: boolean;
}

export function TpgTpmPopover({ trigger, checklistId, field, initialAtivo, valorAcordado, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const [ativo, setAtivo] = useState<boolean>(initialAtivo ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const titulo = field === "tpg_ativo" ? "Tráfego Pago Google" : "Tráfego Pago Meta";

  function onSave() {
    setError(null);
    const fd = new FormData();
    fd.set("checklist_id", checklistId);
    fd.set("field", field);
    fd.set("ativo", String(ativo));
    startTransition(async () => {
      const r = await setTpgTpmAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Popover open={open} onOpenChange={canEdit ? setOpen : undefined}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-72 space-y-4 p-4">
        <h3 className="text-sm font-semibold">{titulo}</h3>

        <div className="space-y-2">
          <Label className="text-xs">Status do mês</Label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAtivo(true)}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                ativo ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              Ativo
            </button>
            <button
              type="button"
              onClick={() => setAtivo(false)}
              className={cn(
                "flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                !ativo ? "border-foreground/40 bg-muted text-foreground" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              Inativo
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Valor acordado</Label>
          <p className="text-sm font-semibold tabular-nums">
            {valorAcordado !== null
              ? Number(valorAcordado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
              : "Não cadastrado"}
          </p>
          <p className="text-[10px] text-muted-foreground">Edite no cadastro do cliente (só sócio/coord)</p>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
          <Button type="button" size="sm" onClick={onSave} disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Cell**

Create `src/components/painel/cells/TpgTpmCell.tsx`:

```tsx
"use client";

import { TpgTpmPopover } from "../modals/TpgTpmPopover";
import { cn } from "@/lib/utils";

interface Props {
  checklistId: string;
  field: "tpg_ativo" | "tpm_ativo";
  ativo: boolean | null;
  valorAcordado: number | null;
  canEdit: boolean;
}

export function TpgTpmCell({ checklistId, field, ativo, valorAcordado, canEdit }: Props) {
  if (!checklistId) {
    return <span className="text-[11px] text-muted-foreground/60">—</span>;
  }

  const label = ativo === null ? "—" : ativo ? "ATIVO" : "INATIVO";
  const colorClass =
    ativo === null
      ? "border-muted-foreground/30 text-muted-foreground"
      : ativo
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "border-muted-foreground/40 bg-muted text-muted-foreground";

  const trigger = (
    <button
      type="button"
      disabled={!canEdit}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full border px-3 text-[10px] font-bold tracking-wider transition-colors",
        colorClass,
        canEdit ? "cursor-pointer hover:opacity-80" : "cursor-default",
      )}
    >
      {label}
    </button>
  );

  if (!canEdit) return trigger;

  return (
    <TpgTpmPopover
      trigger={trigger}
      checklistId={checklistId}
      field={field}
      initialAtivo={ativo}
      valorAcordado={valorAcordado}
      canEdit={canEdit}
    />
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/painel/cells/TpgTpmCell.tsx src/components/painel/modals/TpgTpmPopover.tsx
git commit -m "feat(painel): TpgTpmCell com popover de ativo/inativo + valor acordado"
```

---

## Task 11: Demais cells (Crono, Design, Camera/Mobile, Edicao, Reuniao, Drive)

**Files:**
- Create: `src/components/painel/cells/CronoCell.tsx`
- Create: `src/components/painel/cells/DesignCell.tsx`
- Create: `src/components/painel/cells/CameraMobileCell.tsx`
- Create: `src/components/painel/cells/EdicaoCell.tsx`
- Create: `src/components/painel/cells/ReuniaoCell.tsx`
- Create: `src/components/painel/cells/DriveCell.tsx`

- [ ] **Step 1: CronoCell**

Create `src/components/painel/cells/CronoCell.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { Check, FolderOpen } from "lucide-react";
import { markStepProntoAction } from "@/lib/painel/actions";
import { cn } from "@/lib/utils";

interface Props {
  stepId: string | null;
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  driveUrl: string | null;
  canEdit: boolean;
}

export function CronoCell({ stepId, status, driveUrl, canEdit }: Props) {
  const [pending, startTransition] = useTransition();

  if (!stepId) return <span className="text-[11px] text-muted-foreground/60">—</span>;

  const isPronto = status === "pronto";

  function marcarPronto() {
    if (!stepId) return;
    const fd = new FormData();
    fd.set("step_id", stepId);
    startTransition(async () => {
      await markStepProntoAction(fd);
      if (driveUrl) window.open(driveUrl, "_blank", "noopener,noreferrer");
    });
  }

  if (isPronto) {
    return (
      <a
        href={driveUrl ?? "#"}
        target={driveUrl ? "_blank" : undefined}
        rel="noopener noreferrer"
        className="inline-flex h-7 items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
      >
        <Check className="h-3 w-3" />
        <FolderOpen className="h-3 w-3" />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={marcarPronto}
      disabled={!canEdit || pending}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground transition-colors",
        canEdit && !pending && "cursor-pointer hover:bg-muted",
        (!canEdit || pending) && "cursor-default opacity-60",
      )}
    >
      {pending ? "..." : "Pendente"}
    </button>
  );
}
```

- [ ] **Step 2: DesignCell**

Create `src/components/painel/cells/DesignCell.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markStepProntoAction, delegarDesignAction } from "@/lib/painel/actions";
import { cn } from "@/lib/utils";

interface Props {
  stepId: string | null;
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  responsavelNome: string | null;
  designerCadastrado: boolean;
  /** Atual user pode marcar como pronto (designer atribuído ou socio/adm/coord) */
  canMarkPronto: boolean;
  /** Atual user pode delegar (assessor/coord do cliente, socio/adm) */
  canDelegate: boolean;
}

export function DesignCell({ stepId, status, responsavelNome, designerCadastrado, canMarkPronto, canDelegate }: Props) {
  const [pending, startTransition] = useTransition();

  if (!stepId) return <span className="text-[11px] text-muted-foreground/60">—</span>;

  function marcarPronto() {
    if (!stepId) return;
    const fd = new FormData();
    fd.set("step_id", stepId);
    startTransition(async () => {
      await markStepProntoAction(fd);
    });
  }

  function delegar() {
    if (!stepId) return;
    const fd = new FormData();
    fd.set("step_id", stepId);
    startTransition(async () => {
      await delegarDesignAction(fd);
    });
  }

  if (status === "pronto") {
    return (
      <span className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <Check className="h-3 w-3" />
      </span>
    );
  }

  if (status === "delegado" || status === "em_andamento") {
    return (
      <button
        type="button"
        onClick={canMarkPronto ? marcarPronto : undefined}
        disabled={!canMarkPronto || pending}
        title={responsavelNome ? `Delegado a ${responsavelNome}` : undefined}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 text-[10px] font-medium text-amber-700 dark:text-amber-300",
          canMarkPronto && !pending && "cursor-pointer hover:bg-amber-500/20",
        )}
      >
        Delegado
      </button>
    );
  }

  // pendente
  return (
    <button
      type="button"
      onClick={canDelegate && designerCadastrado ? delegar : undefined}
      disabled={!canDelegate || !designerCadastrado || pending}
      title={!designerCadastrado ? "Cadastre um designer no cliente" : "Delegar pro designer"}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground",
        canDelegate && designerCadastrado && !pending && "cursor-pointer hover:bg-muted",
        (!canDelegate || !designerCadastrado || pending) && "cursor-default opacity-60",
      )}
    >
      Delegar
    </button>
  );
}
```

- [ ] **Step 3: CameraMobileCell**

Create `src/components/painel/cells/CameraMobileCell.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markStepProntoAction } from "@/lib/painel/actions";
import { cn } from "@/lib/utils";

interface Props {
  stepId: string | null;
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  canEdit: boolean;
}

export function CameraMobileCell({ stepId, status, canEdit }: Props) {
  const [pending, startTransition] = useTransition();

  if (!stepId) return <span className="text-[11px] text-muted-foreground/60">—</span>;

  function marcarPronto() {
    if (!stepId) return;
    const fd = new FormData();
    fd.set("step_id", stepId);
    startTransition(async () => {
      await markStepProntoAction(fd);
    });
  }

  if (status === "pronto") {
    return (
      <span className="inline-flex h-7 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <Check className="h-3 w-3" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={canEdit ? marcarPronto : undefined}
      disabled={!canEdit || pending}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground",
        canEdit && !pending && "cursor-pointer hover:bg-muted",
        (!canEdit || pending) && "cursor-default opacity-60",
      )}
    >
      Pendente
    </button>
  );
}
```

- [ ] **Step 4: EdicaoCell**

Create `src/components/painel/cells/EdicaoCell.tsx`:

Mesma anatomia do `DesignCell`, mas labels diferentes (em andamento → editado, sem flow de "delegar").

```tsx
"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markStepProntoAction } from "@/lib/painel/actions";
import { cn } from "@/lib/utils";

interface Props {
  stepId: string | null;
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  responsavelNome: string | null;
  canEdit: boolean;
}

export function EdicaoCell({ stepId, status, responsavelNome, canEdit }: Props) {
  const [pending, startTransition] = useTransition();

  if (!stepId) return <span className="text-[11px] text-muted-foreground/60">—</span>;

  function marcarPronto() {
    if (!stepId) return;
    const fd = new FormData();
    fd.set("step_id", stepId);
    startTransition(async () => {
      await markStepProntoAction(fd);
    });
  }

  if (status === "pronto") {
    return (
      <span className="inline-flex h-7 items-center justify-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <Check className="h-3 w-3" />
      </span>
    );
  }

  if (status === "em_andamento" || status === "delegado") {
    return (
      <button
        type="button"
        onClick={canEdit ? marcarPronto : undefined}
        disabled={!canEdit || pending}
        title={responsavelNome ? `Editor: ${responsavelNome}` : undefined}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 text-[10px] font-medium text-amber-700 dark:text-amber-300",
          canEdit && !pending && "cursor-pointer hover:bg-amber-500/20",
        )}
      >
        Em andamento
      </button>
    );
  }

  return (
    <span className="inline-flex h-7 items-center justify-center rounded-full border border-border px-3 text-[10px] font-medium text-muted-foreground">
      Ninguém pegou
    </span>
  );
}
```

- [ ] **Step 5: ReuniaoCell**

Same pattern as CameraMobileCell. Create `src/components/painel/cells/ReuniaoCell.tsx`:

```tsx
"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { markStepProntoAction } from "@/lib/painel/actions";
import { cn } from "@/lib/utils";

interface Props {
  stepId: string | null;
  status: "pendente" | "delegado" | "em_andamento" | "pronto" | "atrasada";
  canEdit: boolean;
}

export function ReuniaoCell({ stepId, status, canEdit }: Props) {
  const [pending, startTransition] = useTransition();

  if (!stepId) return <span className="text-[11px] text-muted-foreground/60">—</span>;

  function marcarPronto() {
    if (!stepId) return;
    const fd = new FormData();
    fd.set("step_id", stepId);
    startTransition(async () => {
      await markStepProntoAction(fd);
    });
  }

  if (status === "pronto") {
    return (
      <span className="inline-flex h-7 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <Check className="h-3 w-3" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={canEdit ? marcarPronto : undefined}
      disabled={!canEdit || pending}
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground",
        canEdit && !pending && "cursor-pointer hover:bg-muted",
        (!canEdit || pending) && "cursor-default opacity-60",
      )}
    >
      Pendente
    </button>
  );
}
```

- [ ] **Step 6: DriveCell**

Create `src/components/painel/cells/DriveCell.tsx`:

```tsx
import { FolderOpen } from "lucide-react";

export function DriveCell({ driveUrl }: { driveUrl: string | null }) {
  if (!driveUrl) {
    return (
      <span title="Sem drive cadastrado" className="text-[11px] text-muted-foreground/60">
        —
      </span>
    );
  }

  return (
    <a
      href={driveUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10 px-2 text-primary transition-colors hover:bg-primary/20"
      title="Abrir drive em nova aba"
    >
      <FolderOpen className="h-3.5 w-3.5" />
    </a>
  );
}
```

- [ ] **Step 7: Typecheck e commit**

```bash
npm run typecheck
git add src/components/painel/cells/
git commit -m "feat(painel): cells Crono/Design/CameraMobile/Edicao/Reuniao/Drive (Fase 1 manual)"
```

---

## Task 12: PainelTable + PainelHeader (filtro tipo) reorganizados

**Files:**
- Modify: `src/components/painel/PainelHeader.tsx`
- Modify: `src/components/painel/PainelTable.tsx`

- [ ] **Step 1: PainelHeader com filtro de tipo**

Edit `src/components/painel/PainelHeader.tsx`. Substituir conteúdo por:

```tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TIPOS_PACOTE, PACOTES_NO_PAINEL_MENSAL, tipoPacoteBadge, type TipoPacote } from "@/lib/painel/pacote-matrix";
import { cn } from "@/lib/utils";

interface Props {
  mesAtual: string;
  mesesDisponiveis: string[];
  tipoFiltro: TipoPacote | "todos";
}

function formatMonthLabel(monthRef: string): string {
  const [y, m] = monthRef.split("-");
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

export function PainelHeader({ mesAtual, mesesDisponiveis, tipoFiltro }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function setTipo(tipo: string) {
    const sp = new URLSearchParams(params.toString());
    if (tipo === "todos") sp.delete("tipo"); else sp.set("tipo", tipo);
    router.push(`/painel?${sp.toString()}`);
  }

  function setMes(mes: string) {
    const sp = new URLSearchParams(params.toString());
    sp.set("mes", mes);
    router.push(`/painel?${sp.toString()}`);
  }

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel mensal</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento de etapas por cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/painel/legacy"
            className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          >
            Versão antiga →
          </Link>
          <select
            value={mesAtual}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-md border bg-card px-2 py-1.5 text-sm"
          >
            {mesesDisponiveis.map((m) => (
              <option key={m} value={m}>{formatMonthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setTipo("todos")}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
            tipoFiltro === "todos" ? "border-foreground/30 bg-foreground/5" : "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
          )}
        >
          Todos
        </button>
        {(PACOTES_NO_PAINEL_MENSAL as readonly TipoPacote[]).map((p) => {
          const meta = tipoPacoteBadge(p);
          const active = tipoFiltro === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setTipo(p)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                active ? meta.classes : "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
              )}
            >
              {meta.label}
            </button>
          );
        })}
      </div>
    </header>
  );
}
```

- [ ] **Step 2: PainelTable redesenhada**

Edit `src/components/painel/PainelTable.tsx`. Substituir conteúdo por:

```tsx
"use client";

import { TipoPacoteBadge } from "./TipoPacoteBadge";
import { NaoSeAplicaCell } from "./cells/NaoSeAplicaCell";
import { PacotePostadosCell } from "./cells/PacotePostadosCell";
import { CronoCell } from "./cells/CronoCell";
import { DesignCell } from "./cells/DesignCell";
import { TpgTpmCell } from "./cells/TpgTpmCell";
import { GmnCell } from "./cells/GmnCell";
import { CameraMobileCell } from "./cells/CameraMobileCell";
import { EdicaoCell } from "./cells/EdicaoCell";
import { ReuniaoCell } from "./cells/ReuniaoCell";
import { DriveCell } from "./cells/DriveCell";
import { isApplicable, type TipoPacote, type ColumnKey } from "@/lib/painel/pacote-matrix";
import type { ChecklistRow, ChecklistStepRow } from "@/lib/painel/queries";

interface Props {
  checklists: ChecklistRow[];
  userRole: string;
  userId: string;
}

const COLUMNS: Array<{ key: ColumnKey | "drive"; label: string }> = [
  { key: "pacote_postados", label: "Pacote/Post" },
  { key: "crono", label: "Crono" },
  { key: "design", label: "Design" },
  { key: "tpg", label: "TPG" },
  { key: "tpm", label: "TPM" },
  { key: "gmn", label: "GMN" },
  { key: "camera", label: "Câm" },
  { key: "mobile", label: "Mob" },
  { key: "edicao", label: "Ed" },
  { key: "reuniao", label: "Reu" },
  { key: "drive", label: "Drive" },
];

function findStep(steps: ChecklistStepRow[], stepKey: string): ChecklistStepRow | undefined {
  return steps.find((s) => s.step_key === stepKey);
}

function isPrivileged(role: string): boolean {
  return ["socio", "adm", "coordenador"].includes(role);
}

export function PainelTable({ checklists, userRole, userId }: Props) {
  if (checklists.length === 0) {
    return <p className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum cliente ativo nesse filtro/mês.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">Cliente</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {checklists.map((row) => {
            const pacote = row.client_tipo_pacote as TipoPacote;
            const isPriv = isPrivileged(userRole);
            const isAssessor = userId === row.client_designer_id || isPriv; // simplificação; PainelTable pode receber userIsAssessorOf
            const cronoStep = findStep(row.steps, "cronograma");
            const designStep = findStep(row.steps, "design");
            const cameraStep = findStep(row.steps, "camera");
            const mobileStep = findStep(row.steps, "mobile");
            const edicaoStep = findStep(row.steps, "edicao");
            const reuniaoStep = findStep(row.steps, "reuniao");

            const canEditCommon = isPriv || isAssessor;
            const canMarkDesign = isPriv || (designStep?.responsavel_id === userId);
            const canMarkEdicao = isPriv || (edicaoStep?.responsavel_id === userId);
            const canMarkCamera = isPriv || (cameraStep?.responsavel_id === userId);
            const canMarkMobile = isPriv || (mobileStep?.responsavel_id === userId);

            return (
              <tr key={row.client_id} className="border-t">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 align-top">
                  <div className="font-medium">{row.client_nome}</div>
                  <TipoPacoteBadge pacote={pacote} numeroUnidades={row.client_numero_unidades} />
                  {!row.client_tipo_pacote_revisado && (
                    <p className="mt-0.5 text-[9px] text-amber-600 dark:text-amber-400">⚠ Tipo inferido — revise</p>
                  )}
                </td>

                {/* Pacote/Postados */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "pacote_postados") ? (
                    <PacotePostadosCell
                      checklistId={row.id}
                      clientNome={row.client_nome}
                      pacotePost={row.pacote_post}
                      postados={row.quantidade_postada}
                      canEdit={canEditCommon}
                    />
                  ) : (
                    <NaoSeAplicaCell tooltip="Pacote sem postagem" />
                  )}
                </td>

                {/* Crono */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "crono") ? (
                    <CronoCell stepId={cronoStep?.id ?? null} status={cronoStep?.status ?? "pendente"} driveUrl={row.client_drive_url} canEdit={canEditCommon} />
                  ) : (
                    <NaoSeAplicaCell />
                  )}
                </td>

                {/* Design */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "design") ? (
                    <DesignCell
                      stepId={designStep?.id ?? null}
                      status={designStep?.status ?? "pendente"}
                      responsavelNome={designStep?.responsavel_nome ?? null}
                      designerCadastrado={!!row.client_designer_id}
                      canMarkPronto={canMarkDesign}
                      canDelegate={canEditCommon}
                    />
                  ) : (
                    <NaoSeAplicaCell />
                  )}
                </td>

                {/* TPG */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "tpg") ? (
                    <TpgTpmCell checklistId={row.id} field="tpg_ativo" ativo={row.tpg_ativo} valorAcordado={row.client_valor_trafego_google} canEdit={canEditCommon} />
                  ) : (
                    <NaoSeAplicaCell />
                  )}
                </td>

                {/* TPM */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "tpm") ? (
                    <TpgTpmCell checklistId={row.id} field="tpm_ativo" ativo={row.tpm_ativo} valorAcordado={row.client_valor_trafego_meta} canEdit={canEditCommon} />
                  ) : (
                    <NaoSeAplicaCell />
                  )}
                </td>

                {/* GMN */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "gmn") ? (
                    <GmnCell
                      checklistId={row.id}
                      clientNome={row.client_nome}
                      mesReferencia={row.mes_referencia}
                      comentarios={row.gmn_comentarios}
                      avaliacoes={row.gmn_avaliacoes}
                      notaMedia={row.gmn_nota_media}
                      observacoes={row.gmn_observacoes}
                      canEdit={canEditCommon}
                    />
                  ) : (
                    <NaoSeAplicaCell />
                  )}
                </td>

                {/* Câmera */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "camera") ? (
                    <CameraMobileCell stepId={cameraStep?.id ?? null} status={cameraStep?.status ?? "pendente"} canEdit={canMarkCamera} />
                  ) : (
                    <NaoSeAplicaCell />
                  )}
                </td>

                {/* Mobile */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "mobile") ? (
                    <CameraMobileCell stepId={mobileStep?.id ?? null} status={mobileStep?.status ?? "pendente"} canEdit={canMarkMobile} />
                  ) : (
                    <NaoSeAplicaCell />
                  )}
                </td>

                {/* Edição */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "edicao") ? (
                    <EdicaoCell stepId={edicaoStep?.id ?? null} status={edicaoStep?.status ?? "pendente"} responsavelNome={edicaoStep?.responsavel_nome ?? null} canEdit={canMarkEdicao} />
                  ) : (
                    <NaoSeAplicaCell />
                  )}
                </td>

                {/* Reunião */}
                <td className="px-2 py-2 text-center">
                  {isApplicable(pacote, "reuniao") ? (
                    <ReuniaoCell stepId={reuniaoStep?.id ?? null} status={reuniaoStep?.status ?? "pendente"} canEdit={canEditCommon} />
                  ) : (
                    <NaoSeAplicaCell />
                  )}
                </td>

                {/* Drive */}
                <td className="px-2 py-2 text-center">
                  <DriveCell driveUrl={row.client_drive_url} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck e commit**

```bash
npm run typecheck
git add src/components/painel/PainelHeader.tsx src/components/painel/PainelTable.tsx
git commit -m "feat(painel): PainelTable redesenhada (cells condicionais por pacote) + filtro tipo"
```

---

## Task 13: page.tsx atualizada + legacy preservada

**Files:**
- Create: `src/app/(authed)/painel/legacy/page.tsx` (copia da page.tsx atual antes de modificar)
- Modify: `src/app/(authed)/painel/page.tsx`

- [ ] **Step 1: Salvar a página atual como legacy**

```bash
mkdir -p "src/app/(authed)/painel/legacy"
cp "src/app/(authed)/painel/page.tsx" "src/app/(authed)/painel/legacy/page.tsx"
```

- [ ] **Step 2: Modificar page.tsx**

Edit `src/app/(authed)/painel/page.tsx`. Substituir por:

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getMonthlyChecklists, type ChecklistFilter } from "@/lib/painel/queries";
import { PACOTES_NO_PAINEL_MENSAL, type TipoPacote } from "@/lib/painel/pacote-matrix";
import { PainelHeader } from "@/components/painel/PainelHeader";
import { PainelTable } from "@/components/painel/PainelTable";

const ALLOWED_ROLES = ["adm", "socio", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"];

function currentMonthRef(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonthRef(monthRef: string): string {
  const [y, m] = monthRef.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tipo?: string }>;
}) {
  const user = await requireAuth();
  if (!ALLOWED_ROLES.includes(user.role)) notFound();
  const params = await searchParams;

  const mesAtual = params.mes && /^\d{4}-\d{2}$/.test(params.mes) ? params.mes : currentMonthRef();
  const tipoFiltro: TipoPacote | "todos" =
    params.tipo && (PACOTES_NO_PAINEL_MENSAL as readonly string[]).includes(params.tipo)
      ? (params.tipo as TipoPacote)
      : "todos";

  const filter: ChecklistFilter = {};
  if (user.role === "assessor") filter.assessorId = user.id;
  else if (user.role === "coordenador") filter.coordenadorId = user.id;
  else if (user.role === "designer") filter.designerId = user.id;
  else if (user.role === "videomaker") filter.videomakerId = user.id;
  else if (user.role === "editor") filter.editorId = user.id;

  let checklists = await getMonthlyChecklists(mesAtual, filter);
  if (tipoFiltro !== "todos") {
    checklists = checklists.filter((c) => c.client_tipo_pacote === tipoFiltro);
  }

  const mesesDisponiveis: string[] = [];
  let cursor = currentMonthRef();
  for (let i = 0; i < 12; i++) {
    mesesDisponiveis.push(cursor);
    cursor = previousMonthRef(cursor);
  }

  return (
    <div className="space-y-5">
      <PainelHeader mesAtual={mesAtual} mesesDisponiveis={mesesDisponiveis} tipoFiltro={tipoFiltro} />
      <PainelTable checklists={checklists} userRole={user.role} userId={user.id} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/painel/page.tsx" "src/app/(authed)/painel/legacy/page.tsx"
git commit -m "feat(painel): page.tsx usa nova UI; antiga preservada em /painel/legacy"
```

---

## Task 14: Atualizar formulário de cliente com novos campos

**Files:**
- Modify: `src/lib/clientes/schema.ts`
- Modify: `src/lib/clientes/actions.ts`
- Modify: form do cliente (descobrir caminho exato — `src/components/clientes/ClienteForm.tsx` ou `src/app/(authed)/clientes/[id]/page.tsx`)

- [ ] **Step 1: Localizar o form do cliente**

Run: `grep -rn "servico_contratado" src/components/clientes/ src/app/\(authed\)/clientes/ 2>/dev/null | head -5`

Anote o arquivo do form. Provavelmente `src/components/clientes/ClienteForm.tsx`. Se não existir, é a `[id]/page.tsx` que renderiza inline.

- [ ] **Step 2: Atualizar zod schema**

Edit `src/lib/clientes/schema.ts`. Adicionar ao schema de criar/editar:

```ts
import { TIPOS_PACOTE } from "@/lib/painel/pacote-matrix";

const TIPO_PACOTE_VALUES = TIPOS_PACOTE;
const CADENCIAS = ["semanal", "quinzenal", "mensal", "trimestral"] as const;

// Adicionar campos ao schema existente:
//   tipo_pacote: z.enum(TIPO_PACOTE_VALUES),
//   cadencia_reuniao: z.enum(CADENCIAS).optional().nullable(),
//   numero_unidades: z.coerce.number().int().min(1).default(1),
//   valor_trafego_google: z.coerce.number().min(0).optional().nullable(),
//   valor_trafego_meta: z.coerce.number().min(0).optional().nullable(),
//   tipo_pacote_revisado: z.coerce.boolean().optional(),
```

- [ ] **Step 3: Atualizar action de salvar cliente**

Edit `src/lib/clientes/actions.ts`. No payload de insert/update, incluir os novos campos. (Se não tinha tipo_pacote antes, agora é obrigatório no insert.)

- [ ] **Step 4: Atualizar o form UI**

Adicionar 6 inputs no form: select tipo_pacote, select cadencia_reuniao, input number numero_unidades, dois inputs currency pra valor_trafego_google/meta, e um botão "Confirmar pacote" que seta tipo_pacote_revisado=true (mostrado apenas se ainda for false).

Pseudocódigo do select de tipo_pacote:

```tsx
import { TIPOS_PACOTE, tipoPacoteBadge } from "@/lib/painel/pacote-matrix";

<Select name="tipo_pacote" defaultValue={cliente?.tipo_pacote ?? "trafego_estrategia"}>
  <SelectTrigger><SelectValue /></SelectTrigger>
  <SelectContent>
    {TIPOS_PACOTE.map((p) => (
      <SelectItem key={p} value={p}>{tipoPacoteBadge(p).label}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

- [ ] **Step 5: Typecheck e commit**

```bash
npm run typecheck
git add src/lib/clientes/schema.ts src/lib/clientes/actions.ts src/components/clientes/ src/app/\(authed\)/clientes/
git commit -m "feat(clientes): formulário ganha tipo_pacote, cadência, unidades, valores trafego"
```

---

## Task 15: Smoke test + PR

- [ ] **Step 1: Build completo**

```bash
npm run typecheck && npm run lint && npx vitest run && npm run build
```
Expected: tudo passa.

- [ ] **Step 2: Push e abrir PR**

```bash
git push -u origin feat/painel-mensal-redesign-fase1
/opt/homebrew/bin/gh pr create --title "feat(painel): redesign Fase 1 — matriz de pacotes + estados ricos + GMN/TPG manuais" --body "$(cat <<'EOF'
## Summary

Painel mensal redesenhado conforme spec [docs/superpowers/specs/2026-05-02-painel-mensal-redesign-fase1-design.md](docs/superpowers/specs/2026-05-02-painel-mensal-redesign-fase1-design.md).

### Banco
- Enums novos: \`tipo_pacote\` (9 valores) e \`cadencia_reuniao\` (4 valores)
- Status \`delegado\` adicionado em \`checklist_step_status\`
- Novos campos em \`clients\`: \`tipo_pacote\`, \`cadencia_reuniao\`, \`numero_unidades\`, \`valor_trafego_google\`, \`valor_trafego_meta\`, \`tipo_pacote_revisado\`
- Extends \`client_monthly_checklist\` com TPG/TPM ativo + GMN (4 campos)
- Backfill best-effort de \`servico_contratado\` → \`tipo_pacote\` (clientes ficam com flag \`tipo_pacote_revisado=false\` até sócio confirmar)

### UI
- Matriz de pacotes: cada cliente vê apenas as colunas do seu tipo (\`—\` cinza no resto)
- Cells novas: PacotePostados (com progress), Crono, Design (3 estados), TPG/TPM (popover), GMN (colorido por nota), Câmera/Mobile/Edição/Reunião, Drive
- Modais: GMN, Pacote/Postados, TPG/TPM popover
- Filtro de tipo no header
- Painel antigo acessível em \`/painel/legacy\` por 1 semana
- Badge "⚠ Tipo inferido — revise" pra clientes que vieram do backfill

### Não entra (Fase 2)
- Multi-unidade (Gallo Man +60)
- Câmera/Mobile puxando do calendário
- Reunião puxando da cadência → URGENTE auto

## Test plan
- [ ] Migration aplica sem erro (verificada via curl à Management API)
- [ ] \`/painel\` renderiza com células condicionais por pacote
- [ ] Clicar em Pacote/Postados abre modal e salva
- [ ] Clicar em GMN abre modal e salva
- [ ] Clicar em TPG/TPM abre popover e salva ativo/inativo
- [ ] Botão "Delegar" no Design dispara notificação pro designer e marca como delegado
- [ ] Designer atribuído consegue clicar e marcar como pronto
- [ ] Filtro por tipo funciona
- [ ] \`/painel/legacy\` acessível
- [ ] Cliente novo ou editado consegue setar tipo_pacote no form
- [ ] vitest, lint, typecheck e build passam

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL.

- [ ] **Step 3: Reportar URL do PR**

---

## Critérios de aceitação (manuais)

- [ ] Migration aplicou (3 arquivos): enums + fields + backfill.
- [ ] Tipos regenerados (`src/types/database.ts`).
- [ ] Matriz `PACOTE_COLUMNS` está fechada e consistente com a spec.
- [ ] `tipo_pacote` aparece como badge sob o nome do cliente.
- [ ] Células renderizam `—` cinza quando coluna não se aplica ao pacote.
- [ ] Modal GMN salva os 4 campos (comentários, avaliações, nota, observações).
- [ ] TPG/TPM popover salva ativo + mostra valor acordado read-only.
- [ ] PacotePostados modal salva pacote_post + quantidade_postada.
- [ ] Design tem 3 estados (não delegado / delegado / pronto) com botão "Delegar".
- [ ] Edição mostra os 3 labels corretamente.
- [ ] Drive button só aparece se `drive_url` setado.
- [ ] Filtro por tipo no header funciona (URL com `?tipo=…`).
- [ ] `/painel/legacy` carrega a versão antiga.
- [ ] Cliente form aceita os 6 campos novos (tipo_pacote, cadência, unidades, valores).
- [ ] Backfill identifica corretamente os clientes existentes (verificar manualmente uma amostra de 5).
