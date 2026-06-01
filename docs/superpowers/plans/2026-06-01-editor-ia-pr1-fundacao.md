# Editor IA — PR1: Fundação (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Base do módulo Editor IA: migration (tabela `editor_ia_jobs` + bucket), env `SHOTSTACK_API_KEY`, feature-flag, tipos (incl. `EditPlan`) e schema — sem UI ainda. Mergeável e inerte (módulo desligado sem as chaves).

**Architecture:** Espelha o padrão do Yori (`src/lib/yori/`). Cria `src/lib/editor-ia/` com feature-flag/tipos/schema e a migration. Define o tipo `EditPlan` que os PRs seguintes (planejador IA, Shotstack, timeline) consomem.

**Tech Stack:** Next.js (customizado — conferir `node_modules/next/dist/docs/` antes de cache/route APIs), TypeScript, Zod, Supabase, Vitest. Migration manual pós-merge.

---

## Task 1: Migration + env var

**Files:**
- Create: `supabase/migrations/20260621000000_editor_ia.sql`
- Modify: `src/lib/env.ts`, `.env.example`

- [ ] **Step 1: Migration**

Create `supabase/migrations/20260621000000_editor_ia.sql`:

```sql
-- supabase/migrations/20260621000000_editor_ia.sql
-- Editor de vídeo com IA (MVP): jobs + bucket de storage.

create table if not exists public.editor_ia_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'enviando'
    check (status in ('enviando','transcrevendo','planejando','aguardando_revisao','renderizando','pronto','erro')),
  instrucao text,
  video_url text,
  video_duracao_segundos int,
  transcricao jsonb,
  edit_plan jsonb,
  shotstack_render_id text,
  output_url text,
  srt_url text,
  erro text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editor_ia_jobs_org_idx
  on public.editor_ia_jobs(organization_id, created_at desc);
create index if not exists editor_ia_jobs_user_idx
  on public.editor_ia_jobs(user_id, created_at desc);

drop trigger if exists editor_ia_jobs_set_updated_at on public.editor_ia_jobs;
create trigger editor_ia_jobs_set_updated_at
  before update on public.editor_ia_jobs
  for each row execute function public.set_updated_at();

alter table public.editor_ia_jobs enable row level security;
drop policy if exists editor_ia_jobs_select on public.editor_ia_jobs;
create policy editor_ia_jobs_select on public.editor_ia_jobs for select to authenticated using (true);
drop policy if exists editor_ia_jobs_insert on public.editor_ia_jobs;
create policy editor_ia_jobs_insert on public.editor_ia_jobs for insert to authenticated with check (true);
drop policy if exists editor_ia_jobs_update on public.editor_ia_jobs;
create policy editor_ia_jobs_update on public.editor_ia_jobs for update to authenticated using (true);

-- Bucket privado pra entrada/saída
insert into storage.buckets (id, name, public)
values ('editor-ia', 'editor-ia', false)
on conflict (id) do nothing;
```

- [ ] **Step 2: env var**

In `src/lib/env.ts`, inside `serverSchema` (after the Yori vars), add:
```typescript
  // Editor de vídeo IA (Shotstack). Sem essa key (+ GROQ_API_KEY) o módulo
  // fica desligado. Cadastro em https://shotstack.io.
  SHOTSTACK_API_KEY: z.string().optional(),
```
(`GROQ_API_KEY` já existe no schema.) READ env.ts to place inside serverSchema (not clientSchema).

- [ ] **Step 3: .env.example**

Append to `.env.example`:
```
# Editor de vídeo IA (Shotstack) - opcional. Cadastro em https://shotstack.io
SHOTSTACK_API_KEY=
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -i env.ts || echo clean`

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20260621000000_editor_ia.sql src/lib/env.ts .env.example
git commit -m "feat(editor-ia): migration editor_ia_jobs + bucket + env SHOTSTACK_API_KEY

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: feature-flag + tipos + schema (TDD)

**Files:**
- Create: `src/lib/editor-ia/tipos.ts`, `src/lib/editor-ia/feature-flag.ts`, `src/lib/editor-ia/schema.ts`
- Test: `tests/unit/editor-ia-schema.test.ts`

- [ ] **Step 1: Failing test**

Create `tests/unit/editor-ia-schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { criarJobSchema, salvarPlanoSchema } from "@/lib/editor-ia/schema";
import { canUseEditorIa } from "@/lib/editor-ia/feature-flag";

describe("criarJobSchema", () => {
  it("aceita instrução + duração", () => {
    expect(criarJobSchema.safeParse({ instrucao: "corta os silêncios e legenda", video_duracao_segundos: 90 }).success).toBe(true);
  });
  it("rejeita instrução curta", () => {
    expect(criarJobSchema.safeParse({ instrucao: "x", video_duracao_segundos: 90 }).success).toBe(false);
  });
});

describe("salvarPlanoSchema", () => {
  it("aceita um EditPlan válido", () => {
    const r = salvarPlanoSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      edit_plan: { segments: [{ start: 0, end: 5, keep: true }], captions: [{ start: 0, end: 5, text: "oi" }] },
    });
    expect(r.success).toBe(true);
  });
  it("rejeita segmento sem end", () => {
    const r = salvarPlanoSchema.safeParse({
      id: "11111111-1111-1111-1111-111111111111",
      edit_plan: { segments: [{ start: 0, keep: true }], captions: [] },
    });
    expect(r.success).toBe(false);
  });
});

describe("canUseEditorIa", () => {
  it("permite papéis de audiovisual/gestão", () => {
    expect(canUseEditorIa("editor")).toBe(true);
    expect(canUseEditorIa("adm")).toBe(true);
  });
  it("nega papel não-autorizado", () => {
    expect(canUseEditorIa("comercial")).toBe(false);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL**

Run: `npx vitest run tests/unit/editor-ia-schema.test.ts` → FAIL (módulos não existem).

- [ ] **Step 3: `src/lib/editor-ia/tipos.ts`**
```typescript
export const EDITOR_IA_STATUS = [
  "enviando", "transcrevendo", "planejando", "aguardando_revisao", "renderizando", "pronto", "erro",
] as const;
export type EditorIaStatus = (typeof EDITOR_IA_STATUS)[number];

export const EDITOR_IA_STATUS_LABELS: Record<EditorIaStatus, string> = {
  enviando: "Enviando",
  transcrevendo: "Transcrevendo",
  planejando: "Planejando (IA)",
  aguardando_revisao: "Aguardando revisão",
  renderizando: "Renderizando",
  pronto: "Pronto",
  erro: "Erro",
};

/** Um trecho do vídeo (em segundos). keep=false significa cortado. */
export interface EditSegment {
  start: number;
  end: number;
  keep: boolean;
}

/** Uma linha de legenda (em segundos, no tempo do vídeo original). */
export interface CaptionLine {
  start: number;
  end: number;
  text: string;
}

/** Plano de edição: o que manter e a legenda. Editável na timeline. */
export interface EditPlan {
  segments: EditSegment[];
  captions: CaptionLine[];
}
```

- [ ] **Step 4: `src/lib/editor-ia/feature-flag.ts`**
```typescript
import { getServerEnv } from "@/lib/env";

/** Editor IA disponível só com Shotstack + Groq configurados. */
export function isEditorIaEnabled(): boolean {
  const env = getServerEnv();
  return !!env.SHOTSTACK_API_KEY && !!env.GROQ_API_KEY;
}

export const EDITOR_IA_ALLOWED_ROLES = [
  "videomaker", "editor", "audiovisual_chefe", "assessor", "socio", "adm",
] as const;

export function canUseEditorIa(role: string): boolean {
  return (EDITOR_IA_ALLOWED_ROLES as readonly string[]).includes(role);
}
```

- [ ] **Step 5: `src/lib/editor-ia/schema.ts`**
```typescript
import { z } from "zod";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID inválido",
);

export const criarJobSchema = z.object({
  instrucao: z.string().trim().min(3).max(1000),
  video_duracao_segundos: z.coerce.number().int().min(1).max(1800),
});

const editSegmentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  keep: z.boolean(),
});
const captionLineSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().max(500),
});
export const editPlanSchema = z.object({
  segments: z.array(editSegmentSchema).max(2000),
  captions: z.array(captionLineSchema).max(5000),
});

export const salvarPlanoSchema = z.object({
  id: uuidLike,
  edit_plan: editPlanSchema,
});

export type CriarJobInput = z.infer<typeof criarJobSchema>;
export type SalvarPlanoInput = z.infer<typeof salvarPlanoSchema>;
```

- [ ] **Step 6: Run, confirm PASS**

Run: `npx vitest run tests/unit/editor-ia-schema.test.ts` → PASS (6 testes).

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -i editor-ia || echo clean` ; `npx next lint 2>&1 | grep -i editor-ia || echo "lint clean"`

- [ ] **Step 8: Commit**
```bash
git add src/lib/editor-ia/ tests/unit/editor-ia-schema.test.ts
git commit -m "feat(editor-ia): feature-flag + tipos (EditPlan) + schema

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final + PR (PR1)
- [ ] `npx tsc --noEmit 2>&1 | grep -iE "editor-ia|env.ts" || echo clean` ; `npx vitest run 2>&1 | tail -3` (tudo verde).
- [ ] push + PR (base main). Corpo: lista a migration `20260621000000_editor_ia.sql` (aplicar manual pós-merge — aditiva, segura) + nota que o módulo fica desligado até `SHOTSTACK_API_KEY`+`GROQ_API_KEY`. `🤖 Generated with [Claude Code]`.

## Notas
- PR1 é inerte: nenhuma rota/menu novo, nenhum comportamento — só base. Migration aditiva, segura de aplicar a qualquer momento.
- `EditPlan` (tipos.ts) é o contrato central pros próximos PRs (planejador IA gera, timeline edita, Shotstack consome).
- Próximo: PR2 (upload + criar job + transcrição reusando `yori/services/groq-whisper`).
