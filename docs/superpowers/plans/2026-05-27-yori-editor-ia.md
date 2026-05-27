# Yori — Editor de Vídeo com IA (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o Yori v1 — pipeline `upload Reel → Groq Whisper → Claude limpa → Remotion no Lambda renderiza MP4 com legenda` — entregando MP4 + SRT + TXT com 3 templates de sistema + customização híbrida.

**Architecture:** 2 tabelas novas (`yori_templates`, `yori_jobs`) + 2 buckets de Storage + worker via Vercel Cron a cada 30s orquestrando 3 etapas (transcribe/render/done) + UI nova em `/audiovisual/yori` com 4 páginas. Remotion roda em AWS Lambda separado (setup manual).

**Tech Stack:** Next.js 16 App Router, Supabase (DB + Storage), TypeScript, Zod, Vitest, Tailwind, Groq Whisper API, Anthropic Claude (já existe), AWS Lambda + Remotion, react-colorful, @remotion/google-fonts.

**Spec:** [docs/superpowers/specs/2026-05-27-yori-editor-ia-design.md](../specs/2026-05-27-yori-editor-ia-design.md)

---

## File Structure

### Novos arquivos
- `supabase/migrations/20260527000000_yori_templates_jobs.sql` — schema das 2 tabelas + seed dos 3 templates de sistema
- `src/lib/yori/tipos.ts` — types/enums compartilhados (BaseTemplate, FontFamily, Animation, etc)
- `src/lib/yori/schema.ts` — zod schemas (criar template, criar job, etc)
- `src/lib/yori/queries.ts` — listJobs, getJob, listTemplates, etc
- `src/lib/yori/actions.ts` — server actions
- `src/lib/yori/storage.ts` — helpers de upload + signed URL (Supabase Storage)
- `src/lib/yori/services/groq-whisper.ts` — wrapper Groq Whisper
- `src/lib/yori/services/claude-cleanup.ts` — limpeza de pontuação via Claude
- `src/lib/yori/services/remotion-lambda.ts` — wrapper AWS Lambda Remotion
- `src/lib/yori/srt-builder.ts` — converte words[] do Whisper em SRT
- `src/components/yori/YoriEntryButton.tsx` — botão destacado em /audiovisual
- `src/components/yori/YoriJobsList.tsx` — lista de jobs
- `src/components/yori/YoriJobCard.tsx` — card de cada job
- `src/components/yori/YoriQuotaIndicator.tsx` — barra de quota
- `src/components/yori/YoriUploadForm.tsx` — formulário de upload
- `src/components/yori/YoriTemplatePicker.tsx` — grid de templates
- `src/components/yori/YoriTemplateForm.tsx` — modal de criar/editar template
- `src/components/yori/YoriJobStatus.tsx` — status com polling
- `src/components/yori/YoriResultPreview.tsx` — preview + downloads
- `src/components/yori/YoriColorPicker.tsx` — wrapper react-colorful
- `src/components/yori/YoriFontPicker.tsx` — seletor de 8 fontes
- `src/app/(authed)/audiovisual/yori/page.tsx` — lista de jobs
- `src/app/(authed)/audiovisual/yori/novo/page.tsx` — formulário
- `src/app/(authed)/audiovisual/yori/[jobId]/page.tsx` — status/resultado
- `src/app/(authed)/audiovisual/yori/templates/page.tsx` — CRUD de templates
- `src/app/api/cron/yori-worker/route.ts` — worker orchestrator
- `src/app/api/cron/yori-cleanup/route.ts` — cleanup diário
- `remotion/index.ts` — registro de composições
- `remotion/templates/SubmagicTemplate.tsx`
- `remotion/templates/TikTokTemplate.tsx`
- `remotion/templates/ReelsBoxTemplate.tsx`
- `remotion/components/SubtitleWord.tsx`
- `remotion/components/SubtitleBox.tsx`
- `remotion/utils/fonts.ts`
- `remotion/utils/animations.ts`
- `tests/unit/yori-schema.test.ts`
- `tests/unit/yori-srt-builder.test.ts`
- `tests/unit/yori-claude-cleanup-parser.test.ts`
- `docs/yori-aws-lambda-setup.md` — instruções pra Yasmin configurar AWS Lambda

### Arquivos modificados
- `src/lib/env.ts` — `GROQ_API_KEY`, `AWS_*`, `REMOTION_*`, `YORI_ENABLED`
- `src/components/layout/nav-config.ts` — adicionar item Yori
- `src/app/(authed)/audiovisual/page.tsx` — adicionar `YoriEntryButton`
- `vercel.json` — adicionar 2 crons (yori-worker, yori-cleanup)
- `package.json` — novas deps (remotion, @remotion/lambda, @remotion/google-fonts, @remotion/bundler, @remotion/cli, react-colorful, groq-sdk)

---

## Task 1: Migration SQL + zod schemas

**Files:**
- Create: `supabase/migrations/20260527000000_yori_templates_jobs.sql`
- Create: `src/lib/yori/tipos.ts`
- Create: `src/lib/yori/schema.ts`
- Create: `tests/unit/yori-schema.test.ts`

- [ ] **Step 1.1: Criar migration SQL**

Cria `supabase/migrations/20260527000000_yori_templates_jobs.sql`:

```sql
-- Yori: editor de vídeo com IA. Fase 1.
-- 2 tabelas: yori_templates (3 sistema + N customizados/org) e yori_jobs (pipeline).

create table public.yori_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  nome text not null,
  is_system boolean not null default false,
  base_template text not null
    check (base_template in ('submagic','tiktok','reels_box')),
  primary_color text not null,
  highlight_color text,
  font_family text not null
    check (font_family in ('inter','montserrat','bebas','oswald','poppins','roboto','anton','archivo_black')),
  font_size int not null check (font_size between 24 and 80),
  position text not null check (position in ('top','center','bottom')),
  position_y_offset int default 0,
  has_shadow boolean not null default true,
  shadow_intensity int default 50 check (shadow_intensity between 0 and 100),
  animation text not null check (animation in ('pop','fade','slide','none')),
  created_at timestamptz not null default now()
);

create index yori_templates_org_idx
  on public.yori_templates(organization_id, created_at desc)
  where is_system = false;

alter table public.yori_templates enable row level security;

create policy yori_templates_select on public.yori_templates
  for select to authenticated using (
    is_system = true
    or organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy yori_templates_insert on public.yori_templates
  for insert to authenticated with check (
    is_system = false and user_id = auth.uid()
  );

create policy yori_templates_update on public.yori_templates
  for update to authenticated using (
    is_system = false and user_id = auth.uid()
  );

create policy yori_templates_delete on public.yori_templates
  for delete to authenticated using (
    is_system = false and user_id = auth.uid()
  );

-- Seed: 3 templates de sistema (UUIDs fixos pra referência estável)
insert into public.yori_templates
  (id, nome, is_system, base_template, primary_color, highlight_color,
   font_family, font_size, position, has_shadow, shadow_intensity, animation)
values
  ('00000000-0000-0000-0000-000000000001', 'Submagic', true, 'submagic',
   '#FFFFFF', '#FFD600', 'inter', 56, 'center', true, 70, 'pop'),
  ('00000000-0000-0000-0000-000000000002', 'TikTok Clássico', true, 'tiktok',
   '#FFFFFF', null, 'archivo_black', 48, 'bottom', true, 80, 'none'),
  ('00000000-0000-0000-0000-000000000003', 'Reels Box', true, 'reels_box',
   '#FFFFFF', null, 'inter', 42, 'bottom', false, 0, 'fade');

-- Tabela yori_jobs
create table public.yori_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_id uuid not null references public.yori_templates(id),

  video_filename text not null,
  video_path text,
  video_duration_seconds int,
  video_size_bytes bigint,

  status text not null default 'pending'
    check (status in ('pending','transcribing','rendering','done','error','cancelled')),
  progress_pct int default 0,
  error_message text,

  srt_path text,
  txt_path text,
  mp4_path text,
  transcription jsonb,
  downloaded_at timestamptz,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  whisper_cost_brl numeric(10,4),
  lambda_cost_brl numeric(10,4)
);

create index yori_jobs_user_recent_idx
  on public.yori_jobs(user_id, created_at desc);

create index yori_jobs_org_status_idx
  on public.yori_jobs(organization_id, status, created_at desc);

create index yori_jobs_pending_idx
  on public.yori_jobs(created_at)
  where status in ('pending','transcribing','rendering');

create index yori_jobs_undownloaded_idx
  on public.yori_jobs(user_id)
  where status = 'done' and downloaded_at is null;

alter table public.yori_jobs enable row level security;

create policy yori_jobs_select on public.yori_jobs
  for select to authenticated using (
    user_id = auth.uid()
    or organization_id in (
      select organization_id from public.profiles where id = auth.uid()
    )
  );

create policy yori_jobs_insert on public.yori_jobs
  for insert to authenticated with check (user_id = auth.uid());

create policy yori_jobs_update_service on public.yori_jobs
  for update to authenticated using (false);

-- Função pra checar quota da org no mês corrente
create or replace function public.check_yori_quota(p_org_id uuid)
returns boolean
language sql stable as $$
  select count(*) < 100
  from public.yori_jobs
  where organization_id = p_org_id
    and created_at >= date_trunc('month', now())
    and status != 'cancelled';
$$;
```

- [ ] **Step 1.2: Criar tipos compartilhados**

Cria `src/lib/yori/tipos.ts`:

```typescript
export const BASE_TEMPLATES = ["submagic", "tiktok", "reels_box"] as const;
export type BaseTemplate = (typeof BASE_TEMPLATES)[number];

export const FONT_FAMILIES = [
  "inter", "montserrat", "bebas", "oswald", "poppins", "roboto", "anton", "archivo_black"
] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const POSITIONS = ["top", "center", "bottom"] as const;
export type Position = (typeof POSITIONS)[number];

export const ANIMATIONS = ["pop", "fade", "slide", "none"] as const;
export type Animation = (typeof ANIMATIONS)[number];

export const JOB_STATUSES = [
  "pending", "transcribing", "rendering", "done", "error", "cancelled"
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

// UUIDs fixos dos templates de sistema (seed da migration)
export const SYSTEM_TEMPLATE_IDS = {
  submagic: "00000000-0000-0000-0000-000000000001",
  tiktok: "00000000-0000-0000-0000-000000000002",
  reels_box: "00000000-0000-0000-0000-000000000003",
} as const;

export interface YoriTemplate {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  nome: string;
  is_system: boolean;
  base_template: BaseTemplate;
  primary_color: string;
  highlight_color: string | null;
  font_family: FontFamily;
  font_size: number;
  position: Position;
  position_y_offset: number;
  has_shadow: boolean;
  shadow_intensity: number;
  animation: Animation;
  created_at: string;
}

export interface YoriJob {
  id: string;
  organization_id: string;
  unit_id: string | null;
  user_id: string;
  template_id: string;
  video_filename: string;
  video_path: string | null;
  video_duration_seconds: number | null;
  video_size_bytes: number | null;
  status: JobStatus;
  progress_pct: number;
  error_message: string | null;
  srt_path: string | null;
  txt_path: string | null;
  mp4_path: string | null;
  transcription: WhisperTranscription | null;
  downloaded_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  whisper_cost_brl: number | null;
  lambda_cost_brl: number | null;
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export interface WhisperTranscription {
  text: string;
  language: string;
  duration: number;
  words: WhisperWord[];
}
```

- [ ] **Step 1.3: Escrever testes do zod schema (TDD)**

Cria `tests/unit/yori-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createTemplateSchema, createJobSchema } from "@/lib/yori/schema";

const validUuid = "00000000-0000-0000-0000-000000000001";

describe("createTemplateSchema", () => {
  it("aceita template válido", () => {
    const r = createTemplateSchema.safeParse({
      nome: "Meu template",
      base_template: "submagic",
      primary_color: "#FFFFFF",
      highlight_color: "#FFD600",
      font_family: "inter",
      font_size: 56,
      position: "center",
      position_y_offset: 0,
      has_shadow: true,
      shadow_intensity: 70,
      animation: "pop",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita base_template inválido", () => {
    const r = createTemplateSchema.safeParse({
      nome: "X",
      base_template: "invalido",
      primary_color: "#FFFFFF",
      font_family: "inter",
      font_size: 56,
      position: "center",
      has_shadow: true,
      animation: "pop",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita font_size fora do range", () => {
    const r = createTemplateSchema.safeParse({
      nome: "X",
      base_template: "submagic",
      primary_color: "#FFFFFF",
      font_family: "inter",
      font_size: 200,
      position: "center",
      has_shadow: true,
      animation: "pop",
    });
    expect(r.success).toBe(false);
  });

  it("rejeita cor hex malformada", () => {
    const r = createTemplateSchema.safeParse({
      nome: "X",
      base_template: "submagic",
      primary_color: "naoehex",
      font_family: "inter",
      font_size: 56,
      position: "center",
      has_shadow: true,
      animation: "pop",
    });
    expect(r.success).toBe(false);
  });

  it("aceita highlight_color null", () => {
    const r = createTemplateSchema.safeParse({
      nome: "X",
      base_template: "tiktok",
      primary_color: "#FFFFFF",
      highlight_color: null,
      font_family: "archivo_black",
      font_size: 48,
      position: "bottom",
      has_shadow: true,
      shadow_intensity: 80,
      animation: "none",
    });
    expect(r.success).toBe(true);
  });
});

describe("createJobSchema", () => {
  it("aceita job válido", () => {
    const r = createJobSchema.safeParse({
      template_id: validUuid,
      video_filename: "reel.mp4",
      video_duration_seconds: 60,
      video_size_bytes: 1024 * 1024 * 50,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita duração maior que 90s", () => {
    const r = createJobSchema.safeParse({
      template_id: validUuid,
      video_filename: "reel.mp4",
      video_duration_seconds: 120,
      video_size_bytes: 1024,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita tamanho maior que 200MB", () => {
    const r = createJobSchema.safeParse({
      template_id: validUuid,
      video_filename: "reel.mp4",
      video_duration_seconds: 60,
      video_size_bytes: 1024 * 1024 * 300,
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 1.4: Implementar zod schemas**

Cria `src/lib/yori/schema.ts`:

```typescript
import { z } from "zod";
import { BASE_TEMPLATES, FONT_FAMILIES, POSITIONS, ANIMATIONS } from "./tipos";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor hex inválida (use #RRGGBB)");

export const createTemplateSchema = z.object({
  nome: z.string().trim().min(2).max(60),
  base_template: z.enum(BASE_TEMPLATES),
  primary_color: hexColor,
  highlight_color: hexColor.nullable().optional(),
  font_family: z.enum(FONT_FAMILIES),
  font_size: z.coerce.number().int().min(24).max(80),
  position: z.enum(POSITIONS),
  position_y_offset: z.coerce.number().int().min(-200).max(200).default(0),
  has_shadow: z.coerce.boolean(),
  shadow_intensity: z.coerce.number().int().min(0).max(100).default(50),
  animation: z.enum(ANIMATIONS),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.extend({
  id: z.string().uuid(),
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const createJobSchema = z.object({
  template_id: z.string().uuid(),
  video_filename: z.string().min(1).max(200),
  video_duration_seconds: z.coerce.number().int().min(1).max(90, "Vídeo deve ter no máximo 90 segundos"),
  video_size_bytes: z.coerce.number().int().min(1).max(200 * 1024 * 1024, "Arquivo maior que 200MB"),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const markDownloadSchema = z.object({
  jobId: z.string().uuid(),
  type: z.enum(["mp4", "srt", "txt"]),
});
```

- [ ] **Step 1.5: Rodar testes**

Run: `npm test -- yori-schema`
Expected: 8 passed

- [ ] **Step 1.6: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 1.7: Commit**

```bash
git add supabase/migrations/20260527000000_yori_templates_jobs.sql \
        src/lib/yori/tipos.ts \
        src/lib/yori/schema.ts \
        tests/unit/yori-schema.test.ts
git commit -m "feat(yori): schema do banco + tipos + zod (templates e jobs)"
```

---

## Task 2: Env vars + feature flag

**Files:**
- Modify: `src/lib/env.ts`

- [ ] **Step 2.1: Adicionar vars novas em `src/lib/env.ts`**

Localiza bloco do `serverSchema` e adiciona após `OUTSCRAPER_API_KEY` (ou outra var opcional):

```typescript
  // Yori — editor de vídeo com IA. Sem essas vars, /audiovisual/yori
  // redireciona pra /audiovisual com mensagem "Yori indisponível".
  // Setup do AWS Lambda: ver docs/yori-aws-lambda-setup.md.
  YORI_ENABLED: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  REMOTION_LAMBDA_FUNCTION_NAME: z.string().optional(),
  REMOTION_LAMBDA_SITE_NAME: z.string().optional(),
```

- [ ] **Step 2.2: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/env.ts
git commit -m "feat(yori): env vars (YORI_ENABLED, GROQ, AWS, REMOTION_*)"
```

---

## Task 3: Helper `isYoriEnabled` + redirect

**Files:**
- Create: `src/lib/yori/feature-flag.ts`

- [ ] **Step 3.1: Implementar feature flag helper**

Cria `src/lib/yori/feature-flag.ts`:

```typescript
import { getServerEnv } from "@/lib/env";

/**
 * Retorna true se o Yori está disponível pra uso (todas as vars setadas + YORI_ENABLED=true).
 * Roles que tentam acessar /audiovisual/yori sem o flag ligado são redirecionados.
 */
export function isYoriEnabled(): boolean {
  const env = getServerEnv();
  return (
    env.YORI_ENABLED === "true"
    && !!env.GROQ_API_KEY
    && !!env.AWS_ACCESS_KEY_ID
    && !!env.AWS_SECRET_ACCESS_KEY
    && !!env.AWS_REGION
    && !!env.REMOTION_LAMBDA_FUNCTION_NAME
    && !!env.REMOTION_LAMBDA_SITE_NAME
  );
}

export const YORI_ALLOWED_ROLES = [
  "videomaker", "editor", "audiovisual_chefe", "assessor", "socio", "adm"
] as const;

export function canUseYori(role: string): boolean {
  return (YORI_ALLOWED_ROLES as readonly string[]).includes(role);
}
```

- [ ] **Step 3.2: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/yori/feature-flag.ts
git commit -m "feat(yori): helper isYoriEnabled + lista de roles permitidos"
```

---

## Task 4: Service Groq Whisper

**Files:**
- Create: `src/lib/yori/services/groq-whisper.ts`

- [ ] **Step 4.1: Instalar groq-sdk**

Run: `npm install groq-sdk`

Expected: instala sem erro, atualiza `package.json` e `package-lock.json`

- [ ] **Step 4.2: Implementar service**

Cria `src/lib/yori/services/groq-whisper.ts`:

```typescript
// SERVER ONLY — Groq Whisper API wrapper.
//
// Docs: https://console.groq.com/docs/speech-to-text
// Modelo: whisper-large-v3 (rápido + barato, ~10x speed)
// Custo: ~US$0.005/min de áudio (~R$0.025/min)
//
// Sem GROQ_API_KEY → retorna { ok: false, skipped: true }.

import Groq from "groq-sdk";
import { getServerEnv } from "@/lib/env";
import type { WhisperTranscription, WhisperWord } from "../tipos";

const FETCH_TIMEOUT_MS = 120_000; // 2min — vídeos curtos transcrevem em <30s mas dá margem

export interface WhisperResult {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  transcription: WhisperTranscription | null;
  cost_brl: number;
}

const EMPTY: WhisperResult = {
  ok: false,
  skipped: false,
  error: null,
  transcription: null,
  cost_brl: 0,
};

/**
 * Transcreve um vídeo/áudio via Groq Whisper Large-v3 com timestamps por palavra.
 *
 * @param videoBuffer - buffer do arquivo (baixado do Supabase Storage)
 * @param filename - nome original (extensão importa pro Groq detectar formato)
 */
export async function transcribeAudio(
  videoBuffer: Buffer,
  filename: string,
): Promise<WhisperResult> {
  const env = getServerEnv();
  if (!env.GROQ_API_KEY) {
    return { ...EMPTY, skipped: true };
  }

  const client = new Groq({ apiKey: env.GROQ_API_KEY });

  try {
    const file = new File([new Uint8Array(videoBuffer)], filename, { type: "video/mp4" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await Promise.race([
      client.audio.transcriptions.create({
        file,
        model: "whisper-large-v3",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
        language: "pt",
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Groq timeout")), FETCH_TIMEOUT_MS),
      ),
    ]) as { text: string; language?: string; duration?: number; words?: Array<{ word: string; start: number; end: number }> };

    const words: WhisperWord[] = (response.words ?? []).map((w) => ({
      word: w.word,
      start: w.start,
      end: w.end,
    }));

    const transcription: WhisperTranscription = {
      text: response.text,
      language: response.language ?? "pt",
      duration: response.duration ?? 0,
      words,
    };

    // Custo aproximado: R$0.025/min — calcula proporcional ao duration
    const cost_brl = (transcription.duration / 60) * 0.025;

    return {
      ok: true,
      skipped: false,
      error: null,
      transcription,
      cost_brl,
    };
  } catch (err) {
    console.warn("[groq-whisper] falhou:", err instanceof Error ? err.message : err);
    return {
      ...EMPTY,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
```

- [ ] **Step 4.3: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 4.4: Commit**

```bash
git add src/lib/yori/services/groq-whisper.ts package.json package-lock.json
git commit -m "feat(yori): service Groq Whisper pra transcrição com timestamps"
```

---

## Task 5: SRT builder + testes

**Files:**
- Create: `src/lib/yori/srt-builder.ts`
- Create: `tests/unit/yori-srt-builder.test.ts`

- [ ] **Step 5.1: Escrever testes (TDD)**

Cria `tests/unit/yori-srt-builder.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSrt, buildTxt, groupWordsIntoLines } from "@/lib/yori/srt-builder";

describe("groupWordsIntoLines", () => {
  it("agrupa palavras em linhas de até 7 palavras", () => {
    const words = Array.from({ length: 15 }, (_, i) => ({
      word: `palavra${i}`, start: i * 0.5, end: (i + 1) * 0.5,
    }));
    const lines = groupWordsIntoLines(words, 7);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[0].words.length).toBeLessThanOrEqual(7);
  });

  it("respeita pausas (>1s) como quebra de linha", () => {
    const words = [
      { word: "frase", start: 0, end: 0.5 },
      { word: "um", start: 0.5, end: 1 },
      { word: "frase", start: 5, end: 5.5 },  // 4s de pausa
      { word: "dois", start: 5.5, end: 6 },
    ];
    const lines = groupWordsIntoLines(words, 7);
    expect(lines).toHaveLength(2);
    expect(lines[0].words.map((w) => w.word).join(" ")).toBe("frase um");
    expect(lines[1].words.map((w) => w.word).join(" ")).toBe("frase dois");
  });

  it("retorna array vazio se sem palavras", () => {
    expect(groupWordsIntoLines([], 7)).toEqual([]);
  });
});

describe("buildSrt", () => {
  it("gera SRT válido com timestamps", () => {
    const words = [
      { word: "Olá", start: 0, end: 0.5 },
      { word: "mundo", start: 0.5, end: 1 },
    ];
    const srt = buildSrt(words);
    expect(srt).toContain("1\n");
    expect(srt).toContain("00:00:00,000 --> 00:00:01,000");
    expect(srt).toContain("Olá mundo");
  });

  it("formata timestamps no padrão SRT (HH:MM:SS,mmm)", () => {
    const words = [{ word: "x", start: 75.5, end: 76 }];
    const srt = buildSrt(words);
    expect(srt).toContain("00:01:15,500 --> 00:01:16,000");
  });

  it("numera blocos sequencialmente", () => {
    // Cria 2 linhas (pausa entre elas)
    const words = [
      { word: "primeira", start: 0, end: 0.5 },
      { word: "linha", start: 0.5, end: 1 },
      { word: "segunda", start: 5, end: 5.5 },
      { word: "linha", start: 5.5, end: 6 },
    ];
    const srt = buildSrt(words);
    expect(srt).toMatch(/^1\n/);
    expect(srt).toMatch(/\n2\n/);
  });
});

describe("buildTxt", () => {
  it("retorna texto puro sem timestamps", () => {
    const words = [
      { word: "Olá,", start: 0, end: 0.5 },
      { word: "mundo!", start: 0.5, end: 1 },
    ];
    expect(buildTxt(words)).toBe("Olá, mundo!");
  });
});
```

- [ ] **Step 5.2: Implementar `srt-builder.ts`**

Cria `src/lib/yori/srt-builder.ts`:

```typescript
import type { WhisperWord } from "./tipos";

/**
 * Quebra palavras em linhas de legenda (lines of subtitle).
 *
 * Heurística:
 * - Máximo `maxWords` por linha
 * - Quebra também em pausas > PAUSE_THRESHOLD_S
 * - Preserva ordem temporal
 */
const PAUSE_THRESHOLD_S = 1.0;

export interface SubtitleLine {
  start: number;
  end: number;
  words: WhisperWord[];
}

export function groupWordsIntoLines(
  words: WhisperWord[],
  maxWords: number = 7,
): SubtitleLine[] {
  if (words.length === 0) return [];

  const lines: SubtitleLine[] = [];
  let current: WhisperWord[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];

    const shouldBreak =
      current.length >= maxWords
      || (prev && w.start - prev.end > PAUSE_THRESHOLD_S);

    if (shouldBreak && current.length > 0) {
      lines.push({
        start: current[0].start,
        end: current[current.length - 1].end,
        words: current,
      });
      current = [];
    }
    current.push(w);
  }

  if (current.length > 0) {
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current,
    });
  }

  return lines;
}

/** Formata segundos como HH:MM:SS,mmm (formato SRT). */
function formatSrtTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

/** Constrói arquivo .srt a partir das palavras do Whisper. */
export function buildSrt(words: WhisperWord[]): string {
  const lines = groupWordsIntoLines(words);
  return lines
    .map((line, i) => {
      const text = line.words.map((w) => w.word).join(" ");
      return `${i + 1}\n${formatSrtTimestamp(line.start)} --> ${formatSrtTimestamp(line.end)}\n${text}`;
    })
    .join("\n\n");
}

/** Texto puro (concatena todas as palavras com espaço). */
export function buildTxt(words: WhisperWord[]): string {
  return words.map((w) => w.word).join(" ").trim();
}
```

- [ ] **Step 5.3: Rodar testes**

Run: `npm test -- yori-srt-builder`
Expected: PASS (8 testes)

- [ ] **Step 5.4: Commit**

```bash
git add src/lib/yori/srt-builder.ts tests/unit/yori-srt-builder.test.ts
git commit -m "feat(yori): SRT/TXT builder a partir dos words do Whisper"
```

---

## Task 6: Service Claude cleanup

**Files:**
- Create: `src/lib/yori/services/claude-cleanup.ts`
- Create: `tests/unit/yori-claude-cleanup-parser.test.ts`

- [ ] **Step 6.1: Escrever teste do parser (TDD)**

Cria `tests/unit/yori-claude-cleanup-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseCleanupResponse } from "@/lib/yori/services/claude-cleanup";

describe("parseCleanupResponse", () => {
  it("extrai array de palavras do response", () => {
    const raw = `[
      {"word": "Olá,", "start": 0, "end": 0.5},
      {"word": "mundo!", "start": 0.5, "end": 1}
    ]`;
    const result = parseCleanupResponse(raw);
    expect(result.ok).toBe(true);
    expect(result.words).toHaveLength(2);
    expect(result.words[0].word).toBe("Olá,");
  });

  it("aceita response com texto extra antes/depois do JSON", () => {
    const raw = `Aqui está o resultado:

[{"word": "ok", "start": 0, "end": 1}]

Espero que ajude.`;
    const result = parseCleanupResponse(raw);
    expect(result.ok).toBe(true);
    expect(result.words[0].word).toBe("ok");
  });

  it("retorna erro quando JSON malformado", () => {
    const raw = "isso não é JSON";
    const result = parseCleanupResponse(raw);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("retorna erro quando array vazio", () => {
    const raw = "[]";
    const result = parseCleanupResponse(raw);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("vazio");
  });
});
```

- [ ] **Step 6.2: Implementar service**

Cria `src/lib/yori/services/claude-cleanup.ts`:

```typescript
// SERVER ONLY — Claude limpa pontuação e capitalização da transcrição.
//
// Whisper às vezes erra: "ola mundo como vai" → "Olá, mundo! Como vai?"
// Mantém timestamps exatos das palavras originais — só ajusta texto.

import Anthropic from "@anthropic-ai/sdk";
import { getServerEnv } from "@/lib/env";
import type { WhisperWord } from "../tipos";

export interface CleanupResult {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  words: WhisperWord[];
}

const EMPTY: CleanupResult = {
  ok: false,
  skipped: false,
  error: null,
  words: [],
};

/**
 * Parser puro do response do Claude. Exportado pra testes.
 * Tenta extrair JSON do response (Claude às vezes adiciona texto extra).
 */
export function parseCleanupResponse(raw: string): CleanupResult {
  // Tenta achar o array JSON no response
  const match = raw.match(/\[\s*{[\s\S]*}\s*\]/);
  if (!match) {
    return { ...EMPTY, error: "Resposta sem JSON array" };
  }

  try {
    const parsed = JSON.parse(match[0]) as Array<{ word: string; start: number; end: number }>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { ...EMPTY, error: "Array vazio" };
    }
    const words: WhisperWord[] = parsed
      .filter((w) => typeof w?.word === "string" && typeof w?.start === "number" && typeof w?.end === "number")
      .map((w) => ({ word: w.word, start: w.start, end: w.end }));
    if (words.length === 0) {
      return { ...EMPTY, error: "Nenhuma palavra válida" };
    }
    return { ok: true, skipped: false, error: null, words };
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : "JSON parse error" };
  }
}

/**
 * Limpa pontuação e capitalização de uma transcrição do Whisper.
 * Mantém timestamps exatos.
 */
export async function cleanupTranscription(words: WhisperWord[]): Promise<CleanupResult> {
  const env = getServerEnv();
  if (!env.ANTHROPIC_API_KEY) {
    // Sem Claude, retorna palavras como vieram (não bloqueia fluxo)
    return { ok: true, skipped: true, error: null, words };
  }
  if (words.length === 0) {
    return { ...EMPTY, error: "Nenhuma palavra pra limpar" };
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const userMsg = `Recebi uma transcrição automática em português brasileiro com timestamps por palavra. Limpe pontuação e capitalização (vírgulas, pontos finais, ?, !, primeiras letras maiúsculas após ponto).

REGRAS:
1. Não mude o conteúdo das palavras — só ajuste pontuação/capitalização.
2. NÃO mude os timestamps (start/end). Preserve exatos.
3. Mantenha o mesmo número de itens no array.
4. Responda APENAS com o JSON array. Sem texto adicional.

Transcrição:
${JSON.stringify(words)}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: userMsg }],
    });
    const text = response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("");
    return parseCleanupResponse(text);
  } catch (err) {
    console.warn("[claude-cleanup] falhou:", err instanceof Error ? err.message : err);
    // Fallback: retorna palavras originais (não bloqueia fluxo)
    return { ok: true, skipped: false, error: null, words };
  }
}
```

- [ ] **Step 6.3: Rodar testes**

Run: `npm test -- yori-claude-cleanup-parser`
Expected: PASS (4 testes)

- [ ] **Step 6.4: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 6.5: Commit**

```bash
git add src/lib/yori/services/claude-cleanup.ts tests/unit/yori-claude-cleanup-parser.test.ts
git commit -m "feat(yori): service Claude pra limpar pontuação preservando timestamps"
```

---

## Task 7: Storage helpers (Supabase Storage)

**Files:**
- Create: `src/lib/yori/storage.ts`

- [ ] **Step 7.1: Implementar helpers**

Cria `src/lib/yori/storage.ts`:

```typescript
// SERVER ONLY — Helpers de upload/download/signed URLs pros buckets do Yori.
//
// Buckets (criar manualmente no Supabase Dashboard ou via migration):
// - yori-videos: vídeos brutos, retenção 24h
// - yori-outputs: MP4 + SRT + TXT, retenção 30 dias

import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BUCKET_VIDEOS = "yori-videos";
const BUCKET_OUTPUTS = "yori-outputs";

/** Path: {org_id}/{user_id}/{job_id}/video.mp4 */
export function videoPath(orgId: string, userId: string, jobId: string, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${orgId}/${userId}/${jobId}/${safeName}`;
}

/** Path pros outputs (srt/txt/mp4): {org_id}/{user_id}/{job_id}/{type}.{ext} */
export function outputPath(orgId: string, userId: string, jobId: string, type: "mp4" | "srt" | "txt"): string {
  const ext = type === "mp4" ? "mp4" : type;
  return `${orgId}/${userId}/${jobId}/output.${ext}`;
}

/** Upload de bytes pro bucket de vídeos (chamado dentro do action createYoriJob). */
export async function uploadVideo(
  orgId: string,
  userId: string,
  jobId: string,
  filename: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient();
  const path = videoPath(orgId, userId, jobId, filename);
  const { error } = await supabase.storage
    .from(BUCKET_VIDEOS)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

/** Upload de output (srt/txt/mp4). */
export async function uploadOutput(
  orgId: string,
  userId: string,
  jobId: string,
  type: "mp4" | "srt" | "txt",
  content: string | ArrayBuffer,
  contentType: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const supabase = createServiceRoleClient();
  const path = outputPath(orgId, userId, jobId, type);
  const { error } = await supabase.storage
    .from(BUCKET_OUTPUTS)
    .upload(path, content, { contentType, upsert: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

/** Gera signed URL temporário (1h por padrão). */
export async function getSignedUrl(
  bucket: "yori-videos" | "yori-outputs",
  path: string,
  expiresInSeconds: number = 3600,
): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Baixa arquivo do storage como Buffer (usado pelo worker pra mandar pro Whisper). */
export async function downloadFile(
  bucket: "yori-videos" | "yori-outputs",
  path: string,
): Promise<Buffer | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** Deleta arquivo (usado pelo cleanup cron). */
export async function deleteFile(
  bucket: "yori-videos" | "yori-outputs",
  path: string,
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return !error;
}
```

- [ ] **Step 7.2: Criar buckets manualmente no Supabase**

(Esse step não é automatizado — faz parte da setup pós-merge. Documentar no PR description.)

No Supabase Dashboard:
1. Storage → Create new bucket: `yori-videos` (Private)
2. Storage → Create new bucket: `yori-outputs` (Private)
3. Settings → Buckets → ambos marcados como "Public access: OFF"

- [ ] **Step 7.3: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 7.4: Commit**

```bash
git add src/lib/yori/storage.ts
git commit -m "feat(yori): helpers de Storage (upload/download/signed URL)"
```

---

## Task 8: Queries (listJobs, listTemplates, etc)

**Files:**
- Create: `src/lib/yori/queries.ts`

- [ ] **Step 8.1: Implementar queries**

Cria `src/lib/yori/queries.ts`:

```typescript
// SERVER ONLY
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { YoriJob, YoriTemplate } from "./tipos";

/** Lista os últimos N jobs do user atual. */
export async function listMyJobs(userId: string, limit: number = 30): Promise<YoriJob[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("yori_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[yori/queries] listMyJobs:", error.message);
    return [];
  }
  return (data ?? []) as YoriJob[];
}

/** Busca 1 job pelo id (pra polling). */
export async function getJob(jobId: string): Promise<YoriJob | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb.from("yori_jobs").select("*").eq("id", jobId).maybeSingle();
  return (data as YoriJob | null) ?? null;
}

/** Lista templates: sistema (3) + customizados da org do user. */
export async function listTemplates(orgId: string): Promise<YoriTemplate[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("yori_templates")
    .select("*")
    .or(`is_system.eq.true,organization_id.eq.${orgId}`)
    .order("is_system", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as YoriTemplate[];
}

export async function getTemplate(templateId: string): Promise<YoriTemplate | null> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb.from("yori_templates").select("*").eq("id", templateId).maybeSingle();
  return (data as YoriTemplate | null) ?? null;
}

/** Conta quantos jobs a org criou no mês corrente (pra quota). */
export async function countJobsThisMonth(orgId: string): Promise<number> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const firstOfMonth = new Date();
  firstOfMonth.setUTCDate(1);
  firstOfMonth.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("yori_jobs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .neq("status", "cancelled")
    .gte("created_at", firstOfMonth.toISOString());
  return count ?? 0;
}

/** Conta jobs prontos não baixados do user (pra badge no nav lateral). */
export async function countUndownloadedJobs(userId: string): Promise<number> {
  // Service role pra rodar dentro do layout (cacheado)
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { count } = await sb
    .from("yori_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "done")
    .is("downloaded_at", null);
  return count ?? 0;
}

/** Jobs pendentes/em processamento (pro worker pegar). */
export async function listJobsToProcess(limit: number = 5): Promise<YoriJob[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("yori_jobs")
    .select("*")
    .in("status", ["pending", "transcribing", "rendering"])
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as YoriJob[];
}
```

- [ ] **Step 8.2: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 8.3: Commit**

```bash
git add src/lib/yori/queries.ts
git commit -m "feat(yori): queries (listMyJobs, listTemplates, countQuota, etc)"
```

---

## Task 9: Server Actions

**Files:**
- Create: `src/lib/yori/actions.ts`

- [ ] **Step 9.1: Implementar actions**

Cria `src/lib/yori/actions.ts`:

```typescript
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getEffectiveUnitId } from "@/lib/units/session";
import { createTemplateSchema, updateTemplateSchema, createJobSchema, markDownloadSchema } from "./schema";
import { isYoriEnabled, canUseYori } from "./feature-flag";
import { uploadVideo, deleteFile } from "./storage";
import { countJobsThisMonth, getJob } from "./queries";

type ActionOk<T = void> = { success: true; data?: T };
type ActionErr = { error: string };
type ActionResult<T = void> = ActionOk<T> | ActionErr;

async function requireYoriAccess() {
  const user = await requireAuth();
  if (!canUseYori(user.role)) redirect("/audiovisual");
  if (!isYoriEnabled()) redirect("/audiovisual");
  return user;
}

// === Templates ===

export async function createYoriTemplateAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await requireYoriAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = Object.fromEntries(formData);
  // Boolean coerce: vem como "true"/"false"/"on"
  raw.has_shadow = raw.has_shadow === "true" || raw.has_shadow === "on";
  const parsed = createTemplateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // Busca organization_id do user
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return { error: "Organização não encontrada" };

  const { data, error } = await sb.from("yori_templates").insert({
    ...parsed.data,
    user_id: user.id,
    organization_id: profile.organization_id,
    is_system: false,
  }).select("id").single();
  if (error) return { error: error.message };

  revalidatePath("/audiovisual/yori/templates");
  return { success: true, data: { id: data.id as string } };
}

export async function updateYoriTemplateAction(formData: FormData): Promise<ActionResult> {
  const user = await requireYoriAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = Object.fromEntries(formData);
  raw.has_shadow = raw.has_shadow === "true" || raw.has_shadow === "on";
  const parsed = updateTemplateSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  // Verifica que template é do user e não é system
  const { data: existing } = await sb.from("yori_templates").select("user_id, is_system").eq("id", parsed.data.id).maybeSingle();
  if (!existing) return { error: "Template não encontrado" };
  if (existing.is_system) return { error: "Templates de sistema não podem ser editados" };
  if (existing.user_id !== user.id) return { error: "Você não pode editar template de outro usuário" };

  const { id, ...updateData } = parsed.data;
  const { error } = await sb.from("yori_templates").update(updateData).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/audiovisual/yori/templates");
  return { success: true };
}

export async function deleteYoriTemplateAction(templateId: string): Promise<ActionResult> {
  const user = await requireYoriAccess();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: existing } = await sb.from("yori_templates").select("user_id, is_system").eq("id", templateId).maybeSingle();
  if (!existing) return { error: "Template não encontrado" };
  if (existing.is_system) return { error: "Templates de sistema não podem ser deletados" };
  if (existing.user_id !== user.id) return { error: "Você não pode deletar template de outro usuário" };

  const { error } = await sb.from("yori_templates").delete().eq("id", templateId);
  if (error) return { error: error.message };

  revalidatePath("/audiovisual/yori/templates");
  return { success: true };
}

// === Jobs ===

export async function createYoriJobAction(formData: FormData): Promise<ActionResult<{ jobId: string }>> {
  const user = await requireYoriAccess();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = Object.fromEntries(formData);
  const parsed = createJobSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const file = formData.get("video") as File | null;
  if (!file || file.size === 0) return { error: "Vídeo não enviado" };
  if (file.size !== parsed.data.video_size_bytes) {
    return { error: "Tamanho do arquivo não bate com declarado" };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) return { error: "Organização não encontrada" };

  // Check quota
  const count = await countJobsThisMonth(profile.organization_id);
  if (count >= 100) return { error: "Quota mensal de 100 vídeos atingida. Reset no dia 1." };

  const unitId = await getEffectiveUnitId();

  // Cria row primeiro (sem video_path), depois sobe arquivo, depois atualiza com path
  const { data: job, error: insertError } = await sb.from("yori_jobs").insert({
    organization_id: profile.organization_id,
    unit_id: unitId,
    user_id: user.id,
    template_id: parsed.data.template_id,
    video_filename: parsed.data.video_filename,
    video_duration_seconds: parsed.data.video_duration_seconds,
    video_size_bytes: parsed.data.video_size_bytes,
    status: "pending",
  }).select("id").single();
  if (insertError || !job) return { error: insertError?.message ?? "Erro ao criar job" };

  // Upload
  const buffer = await file.arrayBuffer();
  const uploadResult = await uploadVideo(
    profile.organization_id,
    user.id,
    job.id as string,
    parsed.data.video_filename,
    buffer,
    file.type || "video/mp4",
  );
  if (!uploadResult.ok) {
    // Marca job como erro
    await sb.from("yori_jobs").update({
      status: "error",
      error_message: `Upload falhou: ${uploadResult.error}`,
    }).eq("id", job.id);
    return { error: uploadResult.error };
  }

  // Atualiza com path
  await sb.from("yori_jobs").update({ video_path: uploadResult.path }).eq("id", job.id);

  revalidatePath("/audiovisual/yori");
  revalidateTag("yori-undownloaded");
  return { success: true, data: { jobId: job.id as string } };
}

export async function markYoriJobDownloadedAction(formData: FormData): Promise<ActionResult> {
  const user = await requireYoriAccess();
  const parsed = markDownloadSchema.safeParse({
    jobId: formData.get("jobId"),
    type: formData.get("type"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const job = await getJob(parsed.data.jobId);
  if (!job) return { error: "Job não encontrado" };
  if (job.user_id !== user.id) return { error: "Acesso negado" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({ downloaded_at: new Date().toISOString() }).eq("id", parsed.data.jobId);

  revalidatePath("/audiovisual/yori");
  revalidateTag("yori-undownloaded");
  return { success: true };
}

export async function cancelYoriJobAction(jobId: string): Promise<ActionResult> {
  const user = await requireYoriAccess();
  const job = await getJob(jobId);
  if (!job) return { error: "Job não encontrado" };
  if (job.user_id !== user.id) return { error: "Acesso negado" };
  if (job.status !== "pending") return { error: "Só dá pra cancelar jobs pendentes" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({ status: "cancelled" }).eq("id", jobId);

  // Deleta vídeo bruto pra liberar storage cedo
  if (job.video_path) {
    await deleteFile("yori-videos", job.video_path);
  }

  revalidatePath("/audiovisual/yori");
  return { success: true };
}
```

- [ ] **Step 9.2: Type-check**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 9.3: Lint**

Run: `npm run lint -- src/lib/yori/actions.ts`
Expected: zero errors

- [ ] **Step 9.4: Commit**

```bash
git add src/lib/yori/actions.ts
git commit -m "feat(yori): server actions (CRUD templates, criar/cancelar/baixar jobs)"
```

---

## Task 10: Componente `YoriEntryButton` + `YoriQuotaIndicator`

**Files:**
- Create: `src/components/yori/YoriEntryButton.tsx`
- Create: `src/components/yori/YoriQuotaIndicator.tsx`
- Modify: `src/app/(authed)/audiovisual/page.tsx`

- [ ] **Step 10.1: Criar YoriEntryButton**

Cria `src/components/yori/YoriEntryButton.tsx`:

```typescript
import Link from "next/link";
import { Sparkles } from "lucide-react";

export function YoriEntryButton() {
  return (
    <Link
      href="/audiovisual/yori"
      // prefetch={false} pra alinhar com SidebarItem (evita prefetch eager)
      prefetch={false}
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary/80 px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:from-primary/90 hover:to-primary/70 transition-colors"
    >
      <Sparkles className="h-4 w-4" />
      Yori — Editor IA
    </Link>
  );
}
```

- [ ] **Step 10.2: Criar YoriQuotaIndicator**

Cria `src/components/yori/YoriQuotaIndicator.tsx`:

```typescript
interface Props {
  used: number;
  total: number;
}

export function YoriQuotaIndicator({ used, total }: Props) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const isWarning = pct >= 80;
  const isFull = used >= total;

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Vídeos este mês</span>
        <span className={isFull ? "font-semibold text-destructive" : isWarning ? "font-semibold text-amber-600 dark:text-amber-400" : "font-medium"}>
          {used} / {total}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${
            isFull ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-primary"
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {isFull && (
        <p className="mt-2 text-[11px] text-destructive">
          Quota atingida. Reset no dia 1 do próximo mês.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 10.3: Renderizar YoriEntryButton em /audiovisual**

Em `src/app/(authed)/audiovisual/page.tsx`, adicionar import:

```typescript
import { YoriEntryButton } from "@/components/yori/YoriEntryButton";
import { isYoriEnabled, canUseYori } from "@/lib/yori/feature-flag";
```

Localizar o `<h1>` "Audiovisual" (ou similar no topo da página) e adicionar logo após:

```typescript
{isYoriEnabled() && canUseYori(user.role) && (
  <div className="mb-3">
    <YoriEntryButton />
  </div>
)}
```

(Posicionar conforme estrutura real do arquivo — meta: botão visível no topo.)

- [ ] **Step 10.4: Type-check + lint**

```
npm run typecheck
npm run lint -- src/components/yori src/app/"(authed)"/audiovisual/page.tsx
```
Expected: zero errors

- [ ] **Step 10.5: Commit**

```bash
git add src/components/yori/YoriEntryButton.tsx \
        src/components/yori/YoriQuotaIndicator.tsx \
        src/app/"(authed)"/audiovisual/page.tsx
git commit -m "feat(yori): YoriEntryButton em /audiovisual + YoriQuotaIndicator"
```

---

## Task 11: Página principal `/audiovisual/yori`

**Files:**
- Create: `src/app/(authed)/audiovisual/yori/page.tsx`
- Create: `src/components/yori/YoriJobsList.tsx`
- Create: `src/components/yori/YoriJobCard.tsx`

- [ ] **Step 11.1: Criar YoriJobCard**

Cria `src/components/yori/YoriJobCard.tsx`:

```typescript
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react";
import type { YoriJob } from "@/lib/yori/tipos";

interface Props {
  job: YoriJob;
}

const STATUS_LABELS: Record<YoriJob["status"], string> = {
  pending: "Na fila",
  transcribing: "Transcrevendo",
  rendering: "Renderizando",
  done: "Pronto",
  error: "Erro",
  cancelled: "Cancelado",
};

function StatusBadge({ status }: { status: YoriJob["status"] }) {
  const map: Record<YoriJob["status"], { icon: typeof Clock; cls: string }> = {
    pending: { icon: Clock, cls: "border-muted bg-muted/30 text-muted-foreground" },
    transcribing: { icon: Loader2, cls: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
    rendering: { icon: Loader2, cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    done: { icon: CheckCircle2, cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    error: { icon: AlertCircle, cls: "border-destructive/40 bg-destructive/10 text-destructive" },
    cancelled: { icon: XCircle, cls: "border-muted bg-muted/30 text-muted-foreground" },
  };
  const { icon: Icon, cls } = map[status];
  const isSpinning = status === "transcribing" || status === "rendering";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      <Icon className={`h-3 w-3 ${isSpinning ? "animate-spin" : ""}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function YoriJobCard({ job }: Props) {
  return (
    <Link
      href={`/audiovisual/yori/${job.id}`}
      prefetch={false}
      className="block rounded-lg border bg-card p-3 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{job.video_filename}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(job.created_at).toLocaleString("pt-BR")}
            {job.video_duration_seconds ? ` · ${job.video_duration_seconds}s` : ""}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      {job.status === "error" && job.error_message && (
        <p className="mt-2 text-[11px] text-destructive truncate">{job.error_message}</p>
      )}
      {(job.status === "transcribing" || job.status === "rendering") && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${job.progress_pct}%` }} />
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 11.2: Criar YoriJobsList**

Cria `src/components/yori/YoriJobsList.tsx`:

```typescript
import type { YoriJob } from "@/lib/yori/tipos";
import { YoriJobCard } from "./YoriJobCard";

interface Props {
  jobs: YoriJob[];
}

export function YoriJobsList({ jobs }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhum vídeo gerado ainda. Clica em &quot;Novo&quot; pra começar.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <YoriJobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
```

- [ ] **Step 11.3: Criar página `/audiovisual/yori/page.tsx`**

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Settings2 } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canUseYori, isYoriEnabled } from "@/lib/yori/feature-flag";
import { listMyJobs, countJobsThisMonth } from "@/lib/yori/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { YoriJobsList } from "@/components/yori/YoriJobsList";
import { YoriQuotaIndicator } from "@/components/yori/YoriQuotaIndicator";

export const dynamic = "force-dynamic";

export default async function YoriPage() {
  const user = await requireAuth();
  if (!canUseYori(user.role)) redirect("/audiovisual");
  if (!isYoriEnabled()) redirect("/audiovisual");

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) redirect("/audiovisual");

  const [jobs, used] = await Promise.all([
    listMyJobs(user.id, 30),
    countJobsThisMonth(profile.organization_id),
  ]);

  return (
    <div className="space-y-4 max-w-4xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yori — Editor IA</h1>
          <p className="text-sm text-muted-foreground">
            Sobe um Reel, escolha o estilo, recebe MP4 com legenda + SRT + transcrição.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/audiovisual/yori/templates"
            prefetch={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
          >
            <Settings2 className="h-3.5 w-3.5" /> Templates
          </Link>
          <Link
            href="/audiovisual/yori/novo"
            prefetch={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" /> Novo
          </Link>
        </div>
      </header>

      <YoriQuotaIndicator used={used} total={100} />

      <YoriJobsList jobs={jobs} />
    </div>
  );
}
```

- [ ] **Step 11.4: Type-check + lint**

```
npm run typecheck
npm run lint -- src/app/"(authed)"/audiovisual/yori/page.tsx src/components/yori
```
Expected: zero errors

- [ ] **Step 11.5: Commit**

```bash
git add src/app/"(authed)"/audiovisual/yori/page.tsx \
        src/components/yori/YoriJobsList.tsx \
        src/components/yori/YoriJobCard.tsx
git commit -m "feat(yori): página principal /audiovisual/yori com lista de jobs"
```

---

## Task 12: Color picker + Font picker

**Files:**
- Create: `src/components/yori/YoriColorPicker.tsx`
- Create: `src/components/yori/YoriFontPicker.tsx`

- [ ] **Step 12.1: Instalar react-colorful**

Run: `npm install react-colorful`
Expected: instala sem erro

- [ ] **Step 12.2: Criar YoriColorPicker**

Cria `src/components/yori/YoriColorPicker.tsx`:

```typescript
"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";

interface Props {
  value: string;
  onChange: (color: string) => void;
  label: string;
}

export function YoriColorPicker({ value, onChange, label }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-2 text-xs hover:bg-muted"
      >
        <div className="h-5 w-5 rounded border" style={{ backgroundColor: value }} />
        <span className="font-mono">{value.toUpperCase()}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-2 rounded-lg border bg-popover p-3 shadow-lg">
          <HexColorPicker color={value} onChange={onChange} />
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChange(v);
            }}
            className="mt-2 block w-full rounded border bg-background px-2 py-1 text-xs font-mono"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 12.3: Criar YoriFontPicker**

Cria `src/components/yori/YoriFontPicker.tsx`:

```typescript
"use client";

import type { FontFamily } from "@/lib/yori/tipos";

const FONT_LABELS: Record<FontFamily, string> = {
  inter: "Inter",
  montserrat: "Montserrat",
  bebas: "Bebas Neue",
  oswald: "Oswald",
  poppins: "Poppins",
  roboto: "Roboto",
  anton: "Anton",
  archivo_black: "Archivo Black",
};

const FONT_PREVIEW_STYLE: Record<FontFamily, string> = {
  inter: "font-sans",
  montserrat: "font-sans",
  bebas: "tracking-wide uppercase",
  oswald: "tracking-wide",
  poppins: "font-sans",
  roboto: "font-sans",
  anton: "tracking-wide uppercase",
  archivo_black: "font-black",
};

interface Props {
  value: FontFamily;
  onChange: (font: FontFamily) => void;
}

export function YoriFontPicker({ value, onChange }: Props) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">Fonte</label>
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(FONT_LABELS) as FontFamily[]).map((font) => (
          <button
            key={font}
            type="button"
            onClick={() => onChange(font)}
            className={`rounded-md border px-2 py-1.5 text-xs ${FONT_PREVIEW_STYLE[font]} ${
              value === font
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:bg-muted"
            }`}
          >
            {FONT_LABELS[font]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 12.4: Type-check + lint**

```
npm run typecheck
npm run lint -- src/components/yori/YoriColorPicker.tsx src/components/yori/YoriFontPicker.tsx
```
Expected: zero errors

- [ ] **Step 12.5: Commit**

```bash
git add src/components/yori/YoriColorPicker.tsx \
        src/components/yori/YoriFontPicker.tsx \
        package.json package-lock.json
git commit -m "feat(yori): YoriColorPicker (react-colorful) + YoriFontPicker (8 Google Fonts)"
```

---

## Task 13: Página de upload `/audiovisual/yori/novo`

**Files:**
- Create: `src/app/(authed)/audiovisual/yori/novo/page.tsx`
- Create: `src/components/yori/YoriUploadForm.tsx`
- Create: `src/components/yori/YoriTemplatePicker.tsx`

- [ ] **Step 13.1: Criar YoriTemplatePicker**

Cria `src/components/yori/YoriTemplatePicker.tsx`:

```typescript
"use client";

import type { YoriTemplate } from "@/lib/yori/tipos";

interface Props {
  templates: YoriTemplate[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function YoriTemplatePicker({ templates, selectedId, onSelect }: Props) {
  const system = templates.filter((t) => t.is_system);
  const custom = templates.filter((t) => !t.is_system);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
          Templates do sistema
        </p>
        <div className="grid grid-cols-3 gap-2">
          {system.map((t) => (
            <TemplateCard key={t.id} template={t} selected={selectedId === t.id} onSelect={onSelect} />
          ))}
        </div>
      </div>
      {custom.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
            Meus templates
          </p>
          <div className="grid grid-cols-3 gap-2">
            {custom.map((t) => (
              <TemplateCard key={t.id} template={t} selected={selectedId === t.id} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template, selected, onSelect,
}: {
  template: YoriTemplate;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className={`rounded-lg border p-3 text-left transition-colors ${
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted"
      }`}
    >
      <div
        className="mb-2 flex h-10 items-center justify-center rounded text-xs font-bold"
        style={{
          backgroundColor: template.has_shadow ? "rgba(0,0,0,0.2)" : "transparent",
          color: template.primary_color,
        }}
      >
        Preview
        {template.highlight_color && (
          <span style={{ color: template.highlight_color, marginLeft: 4 }}>★</span>
        )}
      </div>
      <p className="text-xs font-medium truncate">{template.nome}</p>
      <p className="text-[10px] text-muted-foreground">{template.base_template}</p>
    </button>
  );
}
```

- [ ] **Step 13.2: Criar YoriUploadForm**

Cria `src/components/yori/YoriUploadForm.tsx`:

```typescript
"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { createYoriJobAction } from "@/lib/yori/actions";
import type { YoriTemplate } from "@/lib/yori/tipos";
import { YoriTemplatePicker } from "./YoriTemplatePicker";

interface Props {
  templates: YoriTemplate[];
}

interface VideoMetadata {
  file: File;
  durationSeconds: number;
  sizeBytes: number;
}

const MAX_DURATION_S = 90;
const MAX_SIZE_BYTES = 200 * 1024 * 1024;

async function readVideoMetadata(file: File): Promise<VideoMetadata | { error: string }> {
  if (file.size > MAX_SIZE_BYTES) {
    return { error: `Arquivo maior que ${(MAX_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB` };
  }
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = Math.ceil(video.duration);
      URL.revokeObjectURL(video.src);
      if (duration > MAX_DURATION_S) {
        resolve({ error: `Vídeo tem ${duration}s. Máximo: ${MAX_DURATION_S}s.` });
        return;
      }
      resolve({ file, durationSeconds: duration, sizeBytes: file.size });
    };
    video.onerror = () => resolve({ error: "Arquivo não reconhecido como vídeo" });
    video.src = URL.createObjectURL(file);
  });
}

export function YoriUploadForm({ templates }: Props) {
  const router = useRouter();
  const [video, setVideo] = useState<VideoMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    const result = await readVideoMetadata(file);
    if ("error" in result) {
      setError(result.error);
      setVideo(null);
      return;
    }
    setVideo(result);
  }

  function handleSubmit() {
    if (!video || !templateId) return;
    setError(null);

    const fd = new FormData();
    fd.set("video", video.file);
    fd.set("video_filename", video.file.name);
    fd.set("video_duration_seconds", String(video.durationSeconds));
    fd.set("video_size_bytes", String(video.sizeBytes));
    fd.set("template_id", templateId);

    startTransition(async () => {
      const r = await createYoriJobAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      if (r.success && r.data) {
        router.push(`/audiovisual/yori/${r.data.jobId}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) void handleFile(file);
        }}
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/20 p-8 cursor-pointer hover:bg-muted/30 transition-colors"
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          {video ? video.file.name : "Arraste o vídeo aqui ou clique pra escolher"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          MP4 até 200MB e até 90 segundos
          {video && ` · ${video.durationSeconds}s · ${(video.sizeBytes / 1024 / 1024).toFixed(1)}MB`}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
          className="hidden"
        />
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Escolha o template</p>
        <YoriTemplatePicker templates={templates} selectedId={templateId} onSelect={setTemplateId} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <button
        type="button"
        disabled={!video || !templateId || pending}
        onClick={handleSubmit}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {pending ? "Subindo..." : "Gerar"}
      </button>
    </div>
  );
}
```

- [ ] **Step 13.3: Criar página `/yori/novo`**

Cria `src/app/(authed)/audiovisual/yori/novo/page.tsx`:

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canUseYori, isYoriEnabled } from "@/lib/yori/feature-flag";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { listTemplates } from "@/lib/yori/queries";
import { YoriUploadForm } from "@/components/yori/YoriUploadForm";

export const dynamic = "force-dynamic";

export default async function NovoYoriJobPage() {
  const user = await requireAuth();
  if (!canUseYori(user.role)) redirect("/audiovisual");
  if (!isYoriEnabled()) redirect("/audiovisual");

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) redirect("/audiovisual");

  const templates = await listTemplates(profile.organization_id);

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href="/audiovisual/yori"
        prefetch={false}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Novo vídeo</h1>

      <YoriUploadForm templates={templates} />
    </div>
  );
}
```

- [ ] **Step 13.4: Type-check + lint**

```
npm run typecheck
npm run lint -- src/app/"(authed)"/audiovisual/yori/novo src/components/yori
```
Expected: zero errors

- [ ] **Step 13.5: Commit**

```bash
git add src/app/"(authed)"/audiovisual/yori/novo \
        src/components/yori/YoriUploadForm.tsx \
        src/components/yori/YoriTemplatePicker.tsx
git commit -m "feat(yori): página /yori/novo com upload form + template picker"
```

---

## Task 14: Página de status `/yori/[jobId]`

**Files:**
- Create: `src/app/(authed)/audiovisual/yori/[jobId]/page.tsx`
- Create: `src/components/yori/YoriJobStatus.tsx`
- Create: `src/components/yori/YoriResultPreview.tsx`

- [ ] **Step 14.1: Criar YoriJobStatus**

Cria `src/components/yori/YoriJobStatus.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import type { YoriJob } from "@/lib/yori/tipos";

interface Props {
  initialJob: YoriJob;
}

const STATUS_MESSAGES: Record<YoriJob["status"], string> = {
  pending: "Na fila, aguardando começar...",
  transcribing: "Transcrevendo áudio com Whisper IA...",
  rendering: "Aplicando legendas no vídeo...",
  done: "Pronto!",
  error: "Algo deu errado.",
  cancelled: "Cancelado.",
};

export function YoriJobStatus({ initialJob }: Props) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);

  useEffect(() => {
    if (job.status === "done" || job.status === "error" || job.status === "cancelled") return;
    const interval = setInterval(() => {
      router.refresh();
    }, 3000);
    return () => clearInterval(interval);
  }, [job.status, router]);

  // Atualiza state quando router.refresh() puxa novos dados
  useEffect(() => {
    setJob(initialJob);
  }, [initialJob]);

  if (job.status === "error") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">Erro no processamento</p>
            <p className="mt-1 text-xs text-destructive/80">{job.error_message ?? "Erro desconhecido"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <p className="text-sm font-medium">{STATUS_MESSAGES[job.status]}</p>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${job.progress_pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {job.progress_pct}% · Tempo estimado: 30-90 segundos
      </p>
    </div>
  );
}
```

- [ ] **Step 14.2: Criar YoriResultPreview**

Cria `src/components/yori/YoriResultPreview.tsx`:

```typescript
"use client";

import { useTransition } from "react";
import { Download, FileText, FileVideo } from "lucide-react";
import { markYoriJobDownloadedAction } from "@/lib/yori/actions";
import type { YoriJob } from "@/lib/yori/tipos";

interface Props {
  job: YoriJob;
  signedUrls: {
    mp4: string | null;
    srt: string | null;
    txt: string | null;
  };
}

export function YoriResultPreview({ job, signedUrls }: Props) {
  const [, startTransition] = useTransition();

  function handleDownload(type: "mp4" | "srt" | "txt") {
    const fd = new FormData();
    fd.set("jobId", job.id);
    fd.set("type", type);
    startTransition(async () => {
      await markYoriJobDownloadedAction(fd);
    });
  }

  return (
    <div className="space-y-3">
      {signedUrls.mp4 && (
        <video src={signedUrls.mp4} controls className="w-full rounded-lg border" />
      )}
      <div className="flex flex-wrap gap-2">
        {signedUrls.mp4 && (
          <a
            href={signedUrls.mp4}
            download={`${job.video_filename}-yori.mp4`}
            onClick={() => handleDownload("mp4")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            <FileVideo className="h-3.5 w-3.5" /> Baixar MP4
          </a>
        )}
        {signedUrls.srt && (
          <a
            href={signedUrls.srt}
            download={`${job.video_filename}.srt`}
            onClick={() => handleDownload("srt")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Baixar .srt
          </a>
        )}
        {signedUrls.txt && (
          <a
            href={signedUrls.txt}
            download={`${job.video_filename}.txt`}
            onClick={() => handleDownload("txt")}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
          >
            <FileText className="h-3.5 w-3.5" /> Baixar transcrição
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 14.3: Criar página `/yori/[jobId]`**

Cria `src/app/(authed)/audiovisual/yori/[jobId]/page.tsx`:

```typescript
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canUseYori, isYoriEnabled } from "@/lib/yori/feature-flag";
import { getJob } from "@/lib/yori/queries";
import { getSignedUrl } from "@/lib/yori/storage";
import { YoriJobStatus } from "@/components/yori/YoriJobStatus";
import { YoriResultPreview } from "@/components/yori/YoriResultPreview";

export const dynamic = "force-dynamic";

export default async function YoriJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const user = await requireAuth();
  if (!canUseYori(user.role)) redirect("/audiovisual");
  if (!isYoriEnabled()) redirect("/audiovisual");

  const job = await getJob(jobId);
  if (!job) notFound();
  if (job.user_id !== user.id) redirect("/audiovisual/yori");

  const signedUrls = job.status === "done"
    ? {
        mp4: job.mp4_path ? await getSignedUrl("yori-outputs", job.mp4_path) : null,
        srt: job.srt_path ? await getSignedUrl("yori-outputs", job.srt_path) : null,
        txt: job.txt_path ? await getSignedUrl("yori-outputs", job.txt_path) : null,
      }
    : { mp4: null, srt: null, txt: null };

  return (
    <div className="max-w-3xl space-y-4">
      <Link
        href="/audiovisual/yori"
        prefetch={false}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>
      <div>
        <h1 className="text-xl font-bold tracking-tight">{job.video_filename}</h1>
        <p className="text-xs text-muted-foreground">
          Criado em {new Date(job.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      {job.status === "done" ? (
        <YoriResultPreview job={job} signedUrls={signedUrls} />
      ) : (
        <YoriJobStatus initialJob={job} />
      )}
    </div>
  );
}
```

- [ ] **Step 14.4: Type-check + lint**

```
npm run typecheck
npm run lint -- src/app/"(authed)"/audiovisual/yori/"[jobId]" src/components/yori
```
Expected: zero errors

- [ ] **Step 14.5: Commit**

```bash
git add src/app/"(authed)"/audiovisual/yori/"[jobId]" \
        src/components/yori/YoriJobStatus.tsx \
        src/components/yori/YoriResultPreview.tsx
git commit -m "feat(yori): página de status do job com polling + preview/downloads"
```

---

## Task 15: Página de templates CRUD `/yori/templates`

**Files:**
- Create: `src/app/(authed)/audiovisual/yori/templates/page.tsx`
- Create: `src/components/yori/YoriTemplateForm.tsx`

- [ ] **Step 15.1: Criar YoriTemplateForm**

Cria `src/components/yori/YoriTemplateForm.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createYoriTemplateAction, updateYoriTemplateAction } from "@/lib/yori/actions";
import type { YoriTemplate, BaseTemplate, FontFamily, Position, Animation } from "@/lib/yori/tipos";
import { BASE_TEMPLATES, POSITIONS, ANIMATIONS } from "@/lib/yori/tipos";
import { YoriColorPicker } from "./YoriColorPicker";
import { YoriFontPicker } from "./YoriFontPicker";

interface Props {
  initial?: YoriTemplate;
  onClose: () => void;
}

export function YoriTemplateForm({ initial, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [baseTemplate, setBaseTemplate] = useState<BaseTemplate>(initial?.base_template ?? "submagic");
  const [primaryColor, setPrimaryColor] = useState(initial?.primary_color ?? "#FFFFFF");
  const [highlightColor, setHighlightColor] = useState(initial?.highlight_color ?? "#FFD600");
  const [fontFamily, setFontFamily] = useState<FontFamily>(initial?.font_family ?? "inter");
  const [fontSize, setFontSize] = useState(initial?.font_size ?? 56);
  const [position, setPosition] = useState<Position>(initial?.position ?? "center");
  const [hasShadow, setHasShadow] = useState(initial?.has_shadow ?? true);
  const [shadowIntensity, setShadowIntensity] = useState(initial?.shadow_intensity ?? 50);
  const [animation, setAnimation] = useState<Animation>(initial?.animation ?? "pop");
  const [positionYOffset, setPositionYOffset] = useState(initial?.position_y_offset ?? 0);

  function handleSubmit() {
    setError(null);
    const fd = new FormData();
    if (initial) fd.set("id", initial.id);
    fd.set("nome", nome);
    fd.set("base_template", baseTemplate);
    fd.set("primary_color", primaryColor);
    if (baseTemplate === "submagic") fd.set("highlight_color", highlightColor);
    fd.set("font_family", fontFamily);
    fd.set("font_size", String(fontSize));
    fd.set("position", position);
    fd.set("position_y_offset", String(positionYOffset));
    fd.set("has_shadow", hasShadow ? "true" : "false");
    fd.set("shadow_intensity", String(shadowIntensity));
    fd.set("animation", animation);

    startTransition(async () => {
      const r = initial ? await updateYoriTemplateAction(fd) : await createYoriTemplateAction(fd);
      if ("error" in r) {
        setError(r.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium mb-1">Nome</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={60}
          className="block w-full rounded-md border bg-background px-2 py-1.5 text-xs"
          placeholder="ex: Estilo Cliente X"
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Estilo base</label>
        <div className="grid grid-cols-3 gap-1.5">
          {BASE_TEMPLATES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setBaseTemplate(t)}
              className={`rounded-md border px-2 py-1.5 text-xs ${
                baseTemplate === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <YoriColorPicker value={primaryColor} onChange={setPrimaryColor} label="Cor principal" />
        {baseTemplate === "submagic" && (
          <YoriColorPicker value={highlightColor} onChange={setHighlightColor} label="Cor destaque" />
        )}
      </div>

      <YoriFontPicker value={fontFamily} onChange={setFontFamily} />

      <div>
        <label className="block text-xs font-medium mb-1">Tamanho ({fontSize}px)</label>
        <input
          type="range"
          min={24}
          max={80}
          value={fontSize}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Posição</label>
        <div className="grid grid-cols-3 gap-1.5">
          {POSITIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPosition(p)}
              className={`rounded-md border px-2 py-1.5 text-xs ${
                position === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={hasShadow} onChange={(e) => setHasShadow(e.target.checked)} />
          Sombra ({shadowIntensity}%)
        </label>
        {hasShadow && (
          <input
            type="range"
            min={0}
            max={100}
            value={shadowIntensity}
            onChange={(e) => setShadowIntensity(Number(e.target.value))}
            className="w-full mt-1"
          />
        )}
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Animação</label>
        <div className="grid grid-cols-4 gap-1.5">
          {ANIMATIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAnimation(a)}
              className={`rounded-md border px-2 py-1.5 text-xs ${
                animation === a ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-muted"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Ajuste vertical ({positionYOffset}px)</label>
        <input
          type="range"
          min={-200}
          max={200}
          value={positionYOffset}
          onChange={(e) => setPositionYOffset(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !nome}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {initial ? "Atualizar" : "Criar"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 15.2: Criar página `/yori/templates`**

Cria `src/app/(authed)/audiovisual/yori/templates/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { canUseYori, isYoriEnabled } from "@/lib/yori/feature-flag";
import { listTemplates } from "@/lib/yori/queries";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { YoriTemplatesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function YoriTemplatesPage() {
  const user = await requireAuth();
  if (!canUseYori(user.role)) redirect("/audiovisual");
  if (!isYoriEnabled()) redirect("/audiovisual");

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: profile } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  if (!profile?.organization_id) redirect("/audiovisual");

  const templates = await listTemplates(profile.organization_id);

  return (
    <div className="max-w-4xl space-y-4">
      <Link
        href="/audiovisual/yori"
        prefetch={false}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Voltar
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Templates do Yori</h1>
      <YoriTemplatesClient templates={templates} currentUserId={user.id} />
    </div>
  );
}
```

- [ ] **Step 15.3: Criar client wrapper pra page de templates**

Cria `src/app/(authed)/audiovisual/yori/templates/client.tsx`:

```typescript
"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
import type { YoriTemplate } from "@/lib/yori/tipos";
import { deleteYoriTemplateAction } from "@/lib/yori/actions";
import { YoriTemplateForm } from "@/components/yori/YoriTemplateForm";

interface Props {
  templates: YoriTemplate[];
  currentUserId: string;
}

export function YoriTemplatesClient({ templates, currentUserId }: Props) {
  const [editing, setEditing] = useState<YoriTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Deletar este template?")) return;
    startTransition(() => deleteYoriTemplateAction(id));
  }

  const system = templates.filter((t) => t.is_system);
  const myCustom = templates.filter((t) => !t.is_system && t.user_id === currentUserId);
  const orgCustom = templates.filter((t) => !t.is_system && t.user_id !== currentUserId);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-3.5 w-3.5" /> Novo template
      </button>

      <Section title="Sistema (não editáveis)">
        {system.map((t) => <TemplateRow key={t.id} template={t} canEdit={false} />)}
      </Section>

      <Section title="Meus templates">
        {myCustom.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum template próprio ainda.</p>
        ) : (
          myCustom.map((t) => (
            <TemplateRow
              key={t.id}
              template={t}
              canEdit={true}
              onEdit={() => setEditing(t)}
              onDelete={() => handleDelete(t.id)}
            />
          ))
        )}
      </Section>

      {orgCustom.length > 0 && (
        <Section title="Templates da equipe">
          {orgCustom.map((t) => <TemplateRow key={t.id} template={t} canEdit={false} />)}
        </Section>
      )}

      {(creating || editing) && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-card p-4">
            <h2 className="text-sm font-semibold mb-3">{editing ? "Editar template" : "Novo template"}</h2>
            <YoriTemplateForm
              initial={editing ?? undefined}
              onClose={() => { setCreating(false); setEditing(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function TemplateRow({
  template, canEdit, onEdit, onDelete,
}: {
  template: YoriTemplate;
  canEdit: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-card p-2 text-xs">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="h-6 w-10 rounded flex-shrink-0 border"
          style={{ backgroundColor: template.primary_color }}
        />
        <div className="min-w-0">
          <p className="font-medium truncate">{template.nome}</p>
          <p className="text-[10px] text-muted-foreground">
            {template.base_template} · {template.font_family} · {template.font_size}px
          </p>
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1">
          <button type="button" onClick={onEdit} className="rounded p-1 hover:bg-muted">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onDelete} className="rounded p-1 hover:bg-destructive/10 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 15.4: Type-check + lint**

```
npm run typecheck
npm run lint
```
Expected: zero errors

- [ ] **Step 15.5: Commit**

```bash
git add src/app/"(authed)"/audiovisual/yori/templates \
        src/components/yori/YoriTemplateForm.tsx
git commit -m "feat(yori): página de templates com CRUD (sistema + meus + equipe)"
```

---

## Task 16: Nav lateral + badge

**Files:**
- Modify: `src/components/layout/nav-config.ts`
- Modify: `src/app/(authed)/layout.tsx`

- [ ] **Step 16.1: Adicionar item Yori no nav-config**

Em `src/components/layout/nav-config.ts`:

Adicionar import:
```typescript
import { Sparkles } from "lucide-react";
```

Atualizar tipo `NavBadgeKey`:
```typescript
export type NavBadgeKey = "recados" | "escritorio" | "yoriProntos";
```

Adicionar item no array `NAV_ITEMS` após o item "/audiovisual":
```typescript
{
  href: "/audiovisual/yori",
  icon: Sparkles,
  label: "Yori",
  roles: ["videomaker", "editor", "audiovisual_chefe", "assessor", "socio", "adm"],
  badgeKey: "yoriProntos",
},
```

- [ ] **Step 16.2: Adicionar badge no layout authed**

Em `src/app/(authed)/layout.tsx`:

Adicionar import:
```typescript
import { countUndownloadedJobs } from "@/lib/yori/queries";
import { isYoriEnabled } from "@/lib/yori/feature-flag";
```

No `Promise.all` que busca badges (procurar `countRecadosNaoLidos`), adicionar:
```typescript
isYoriEnabled() ? countUndownloadedJobs(user.id) : Promise.resolve(0),
```

E destructure o valor (`yoriProntos`).

Passar pro `Sidebar` e `TopBar` no objeto `badges`:
```typescript
badges={{
  recados: recadosNaoLidos,
  escritorio: escritorioUnread,
  yoriProntos,
}}
```

(Adaptar nomes exatos conforme o código atual do layout.)

- [ ] **Step 16.3: Atualizar interface `SidebarBadges`**

Em `src/components/layout/Sidebar.tsx`, atualizar:
```typescript
export interface SidebarBadges {
  recados?: number;
  escritorio?: number;
  yoriProntos?: number;
}
```

- [ ] **Step 16.4: Type-check + lint**

```
npm run typecheck
npm run lint -- src/components/layout src/app/"(authed)"/layout.tsx
```
Expected: zero errors

- [ ] **Step 16.5: Commit**

```bash
git add src/components/layout/nav-config.ts \
        src/components/layout/Sidebar.tsx \
        src/app/"(authed)"/layout.tsx
git commit -m "feat(yori): item no nav lateral com badge de jobs prontos não baixados"
```

---

## Task 17: Setup Remotion (composições + templates)

**Files:**
- Create: `remotion/index.ts`
- Create: `remotion/utils/fonts.ts`
- Create: `remotion/utils/animations.ts`
- Create: `remotion/components/SubtitleWord.tsx`
- Create: `remotion/templates/SubmagicTemplate.tsx`
- Create: `remotion/templates/TikTokTemplate.tsx`
- Create: `remotion/templates/ReelsBoxTemplate.tsx`

- [ ] **Step 17.1: Instalar Remotion**

Run:
```
npm install remotion @remotion/cli @remotion/bundler @remotion/lambda @remotion/google-fonts
```

Expected: instala sem erro

- [ ] **Step 17.2: Criar `remotion/utils/fonts.ts`**

```typescript
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadOswald } from "@remotion/google-fonts/Oswald";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadArchivoBlack } from "@remotion/google-fonts/ArchivoBlack";

export type FontKey = "inter" | "montserrat" | "bebas" | "oswald" | "poppins" | "roboto" | "anton" | "archivo_black";

const LOADERS: Record<FontKey, () => { fontFamily: string }> = {
  inter: loadInter,
  montserrat: loadMontserrat,
  bebas: loadBebas,
  oswald: loadOswald,
  poppins: loadPoppins,
  roboto: loadRoboto,
  anton: loadAnton,
  archivo_black: loadArchivoBlack,
};

export function getFontFamily(key: FontKey): string {
  return LOADERS[key]().fontFamily;
}
```

- [ ] **Step 17.3: Criar `remotion/utils/animations.ts`**

```typescript
import { spring, interpolate } from "remotion";

export type AnimationKey = "pop" | "fade" | "slide" | "none";

export function getEntryStyle(
  animation: AnimationKey,
  frame: number,
  fps: number,
  startFrame: number,
): { transform: string; opacity: number } {
  const relFrame = frame - startFrame;
  if (animation === "none") {
    return { transform: "scale(1)", opacity: 1 };
  }
  if (animation === "pop") {
    const scale = spring({ frame: relFrame, fps, config: { damping: 12, stiffness: 200 }, from: 0.6, to: 1 });
    return { transform: `scale(${scale})`, opacity: 1 };
  }
  if (animation === "fade") {
    const opacity = interpolate(relFrame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
    return { transform: "scale(1)", opacity };
  }
  if (animation === "slide") {
    const y = interpolate(relFrame, [0, 10], [20, 0], { extrapolateRight: "clamp" });
    return { transform: `translateY(${y}px)`, opacity: 1 };
  }
  return { transform: "scale(1)", opacity: 1 };
}
```

- [ ] **Step 17.4: Criar `remotion/components/SubtitleWord.tsx`**

```typescript
import { useCurrentFrame, useVideoConfig } from "remotion";
import { getEntryStyle, type AnimationKey } from "../utils/animations";

interface Props {
  word: string;
  start: number;
  end: number;
  isHighlighted: boolean;
  primaryColor: string;
  highlightColor: string | null;
  fontFamily: string;
  fontSize: number;
  hasShadow: boolean;
  shadowIntensity: number;
  animation: AnimationKey;
}

export function SubtitleWord(props: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const startFrame = props.start * fps;
  const endFrame = props.end * fps;
  const isActive = frame >= startFrame && frame < endFrame;
  if (frame < startFrame) return null;

  const color = props.isHighlighted && props.highlightColor && isActive
    ? props.highlightColor
    : props.primaryColor;

  const entry = getEntryStyle(props.animation, frame, fps, startFrame);

  const shadowAlpha = props.shadowIntensity / 100;
  const textShadow = props.hasShadow
    ? `2px 2px 4px rgba(0,0,0,${shadowAlpha}), -1px -1px 2px rgba(0,0,0,${shadowAlpha * 0.5})`
    : "none";

  return (
    <span
      style={{
        display: "inline-block",
        margin: "0 6px",
        color,
        fontFamily: props.fontFamily,
        fontSize: `${props.fontSize}px`,
        fontWeight: 700,
        textShadow,
        transform: entry.transform,
        opacity: entry.opacity,
      }}
    >
      {props.word}
    </span>
  );
}
```

- [ ] **Step 17.5: Criar `remotion/templates/SubmagicTemplate.tsx`**

```typescript
import { AbsoluteFill, OffthreadVideo } from "remotion";
import { SubtitleWord } from "../components/SubtitleWord";
import { getFontFamily, type FontKey } from "../utils/fonts";
import type { AnimationKey } from "../utils/animations";

export interface SubmagicProps {
  videoUrl: string;
  words: Array<{ word: string; start: number; end: number }>;
  config: {
    primary_color: string;
    highlight_color: string | null;
    font_family: FontKey;
    font_size: number;
    position: "top" | "center" | "bottom";
    position_y_offset: number;
    has_shadow: boolean;
    shadow_intensity: number;
    animation: AnimationKey;
  };
}

const POSITION_STYLE = {
  top: { top: "10%" },
  center: { top: "50%", transform: "translateY(-50%)" },
  bottom: { bottom: "15%" },
};

export const SubmagicTemplate: React.FC<SubmagicProps> = ({ videoUrl, words, config }) => {
  const fontFamily = getFontFamily(config.font_family);
  const positionStyle = POSITION_STYLE[config.position];

  return (
    <AbsoluteFill>
      <OffthreadVideo src={videoUrl} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          padding: "0 10%",
          ...positionStyle,
          marginTop: `${config.position_y_offset}px`,
        }}
      >
        {words.map((w, i) => (
          <SubtitleWord
            key={i}
            word={w.word}
            start={w.start}
            end={w.end}
            isHighlighted={true /* todas palavras destacam quando ativas */}
            primaryColor={config.primary_color}
            highlightColor={config.highlight_color}
            fontFamily={fontFamily}
            fontSize={config.font_size}
            hasShadow={config.has_shadow}
            shadowIntensity={config.shadow_intensity}
            animation={config.animation}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 17.6: Criar `remotion/templates/TikTokTemplate.tsx`**

```typescript
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { getFontFamily, type FontKey } from "../utils/fonts";

export interface TikTokProps {
  videoUrl: string;
  words: Array<{ word: string; start: number; end: number }>;
  config: {
    primary_color: string;
    font_family: FontKey;
    font_size: number;
    position: "top" | "center" | "bottom";
    position_y_offset: number;
    has_shadow: boolean;
    shadow_intensity: number;
  };
}

const POSITION_STYLE = {
  top: { top: "10%" },
  center: { top: "50%", transform: "translateY(-50%)" },
  bottom: { bottom: "15%" },
};

interface Line { start: number; end: number; text: string }

function groupIntoLines(words: TikTokProps["words"], maxWordsPerLine: number = 6): Line[] {
  const lines: Line[] = [];
  let current: typeof words = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (current.length >= maxWordsPerLine || (prev && w.start - prev.end > 1.0)) {
      if (current.length > 0) {
        lines.push({
          start: current[0].start,
          end: current[current.length - 1].end,
          text: current.map((c) => c.word).join(" "),
        });
        current = [];
      }
    }
    current.push(w);
  }
  if (current.length > 0) {
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text: current.map((c) => c.word).join(" "),
    });
  }
  return lines;
}

export const TikTokTemplate: React.FC<TikTokProps> = ({ videoUrl, words, config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const fontFamily = getFontFamily(config.font_family);
  const positionStyle = POSITION_STYLE[config.position];

  const lines = groupIntoLines(words);
  const active = lines.find((l) => time >= l.start && time < l.end);

  const shadowAlpha = config.shadow_intensity / 100;
  const textShadow = config.has_shadow
    ? `3px 3px 0px rgba(0,0,0,${shadowAlpha}), -1px -1px 0px rgba(0,0,0,${shadowAlpha})`
    : "none";

  return (
    <AbsoluteFill>
      <OffthreadVideo src={videoUrl} />
      {active && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            textAlign: "center",
            padding: "0 10%",
            ...positionStyle,
            marginTop: `${config.position_y_offset}px`,
            color: config.primary_color,
            fontFamily,
            fontSize: `${config.font_size}px`,
            fontWeight: 900,
            textShadow,
          }}
        >
          {active.text}
        </div>
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 17.7: Criar `remotion/templates/ReelsBoxTemplate.tsx`**

```typescript
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { getFontFamily, type FontKey } from "../utils/fonts";

export interface ReelsBoxProps {
  videoUrl: string;
  words: Array<{ word: string; start: number; end: number }>;
  config: {
    primary_color: string;
    font_family: FontKey;
    font_size: number;
    position: "top" | "center" | "bottom";
    position_y_offset: number;
  };
}

const POSITION_STYLE = {
  top: { top: "10%" },
  center: { top: "50%", transform: "translateY(-50%)" },
  bottom: { bottom: "15%" },
};

function groupIntoLines(words: ReelsBoxProps["words"], maxWordsPerLine: number = 8) {
  const lines: Array<{ start: number; end: number; text: string }> = [];
  let current: typeof words = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = words[i - 1];
    if (current.length >= maxWordsPerLine || (prev && w.start - prev.end > 1.0)) {
      if (current.length > 0) {
        lines.push({
          start: current[0].start,
          end: current[current.length - 1].end,
          text: current.map((c) => c.word).join(" "),
        });
        current = [];
      }
    }
    current.push(w);
  }
  if (current.length > 0) {
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text: current.map((c) => c.word).join(" "),
    });
  }
  return lines;
}

export const ReelsBoxTemplate: React.FC<ReelsBoxProps> = ({ videoUrl, words, config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const time = frame / fps;
  const fontFamily = getFontFamily(config.font_family);
  const positionStyle = POSITION_STYLE[config.position];

  const lines = groupIntoLines(words);
  const active = lines.find((l) => time >= l.start && time < l.end);

  return (
    <AbsoluteFill>
      <OffthreadVideo src={videoUrl} />
      {active && (
        <div
          style={{
            position: "absolute",
            left: "10%",
            right: "10%",
            textAlign: "center",
            ...positionStyle,
            marginTop: `${config.position_y_offset}px`,
          }}
        >
          <div
            style={{
              display: "inline-block",
              backgroundColor: "rgba(0,0,0,0.75)",
              borderRadius: 8,
              padding: "12px 20px",
              color: config.primary_color,
              fontFamily,
              fontSize: `${config.font_size}px`,
              fontWeight: 500,
            }}
          >
            {active.text}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
```

- [ ] **Step 17.8: Criar `remotion/index.ts` (registry)**

```typescript
import { Composition, registerRoot } from "remotion";
import { SubmagicTemplate } from "./templates/SubmagicTemplate";
import { TikTokTemplate } from "./templates/TikTokTemplate";
import { ReelsBoxTemplate } from "./templates/ReelsBoxTemplate";

// Dimensões: 1080x1920 (vertical Reels) a 30fps
const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;
const VIDEO_FPS = 30;
// Duration calculada via calculateMetadata pra cada job (vídeo de 90s = 2700 frames)

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="submagic"
        component={SubmagicTemplate}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={VIDEO_FPS}
        durationInFrames={VIDEO_FPS * 90}
        defaultProps={{
          videoUrl: "",
          words: [],
          config: {
            primary_color: "#FFFFFF",
            highlight_color: "#FFD600",
            font_family: "inter" as const,
            font_size: 56,
            position: "center" as const,
            position_y_offset: 0,
            has_shadow: true,
            shadow_intensity: 70,
            animation: "pop" as const,
          },
        }}
      />
      <Composition
        id="tiktok"
        component={TikTokTemplate}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={VIDEO_FPS}
        durationInFrames={VIDEO_FPS * 90}
        defaultProps={{
          videoUrl: "",
          words: [],
          config: {
            primary_color: "#FFFFFF",
            font_family: "archivo_black" as const,
            font_size: 48,
            position: "bottom" as const,
            position_y_offset: 0,
            has_shadow: true,
            shadow_intensity: 80,
          },
        }}
      />
      <Composition
        id="reels_box"
        component={ReelsBoxTemplate}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        fps={VIDEO_FPS}
        durationInFrames={VIDEO_FPS * 90}
        defaultProps={{
          videoUrl: "",
          words: [],
          config: {
            primary_color: "#FFFFFF",
            font_family: "inter" as const,
            font_size: 42,
            position: "bottom" as const,
            position_y_offset: 0,
          },
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
```

- [ ] **Step 17.9: Type-check**

Run: `npm run typecheck`
Expected: zero errors (Remotion adiciona types via instalação)

- [ ] **Step 17.10: Commit**

```bash
git add remotion/ package.json package-lock.json
git commit -m "feat(yori): composições Remotion (Submagic, TikTok, Reels Box) + utils"
```

---

## Task 18: Service Remotion Lambda + worker

**Files:**
- Create: `src/lib/yori/services/remotion-lambda.ts`
- Create: `src/app/api/cron/yori-worker/route.ts`

- [ ] **Step 18.1: Implementar service Remotion Lambda**

Cria `src/lib/yori/services/remotion-lambda.ts`:

```typescript
// SERVER ONLY — wrapper de chamada ao AWS Lambda do Remotion.
//
// Pré-requisito: docs/yori-aws-lambda-setup.md
// - Função Lambda deployada via `npx remotion lambda functions deploy`
// - Site composiçoes deployado via `npx remotion lambda sites create`
//
// Sem AWS_* + REMOTION_* env vars → retorna { skipped: true }.

import { renderMediaOnLambda, getRenderProgress } from "@remotion/lambda/client";
import { getServerEnv } from "@/lib/env";
import type { BaseTemplate, FontFamily, Position, Animation, WhisperWord } from "../tipos";

export interface RenderConfig {
  baseTemplate: BaseTemplate;
  videoUrl: string;
  words: WhisperWord[];
  durationSeconds: number;
  primary_color: string;
  highlight_color: string | null;
  font_family: FontFamily;
  font_size: number;
  position: Position;
  position_y_offset: number;
  has_shadow: boolean;
  shadow_intensity: number;
  animation: Animation;
}

export interface RenderStartResult {
  ok: boolean;
  skipped: boolean;
  error: string | null;
  renderId: string | null;
  bucketName: string | null;
}

export interface RenderProgressResult {
  ok: boolean;
  done: boolean;
  progress: number;     // 0-1
  outputUrl: string | null;
  error: string | null;
  costsBrl: number;     // só preenchido quando done
}

export async function startRender(config: RenderConfig): Promise<RenderStartResult> {
  const env = getServerEnv();
  if (
    !env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY || !env.AWS_REGION
    || !env.REMOTION_LAMBDA_FUNCTION_NAME || !env.REMOTION_LAMBDA_SITE_NAME
  ) {
    return { ok: false, skipped: true, error: null, renderId: null, bucketName: null };
  }

  try {
    const { renderId, bucketName } = await renderMediaOnLambda({
      region: env.AWS_REGION as "us-east-1",
      functionName: env.REMOTION_LAMBDA_FUNCTION_NAME,
      serveUrl: env.REMOTION_LAMBDA_SITE_NAME,
      composition: config.baseTemplate,
      inputProps: {
        videoUrl: config.videoUrl,
        words: config.words,
        config: {
          primary_color: config.primary_color,
          highlight_color: config.highlight_color,
          font_family: config.font_family,
          font_size: config.font_size,
          position: config.position,
          position_y_offset: config.position_y_offset,
          has_shadow: config.has_shadow,
          shadow_intensity: config.shadow_intensity,
          animation: config.animation,
        },
      },
      codec: "h264",
      imageFormat: "jpeg",
      maxRetries: 1,
      framesPerLambda: 100,
    });
    return { ok: true, skipped: false, error: null, renderId, bucketName };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      error: err instanceof Error ? err.message : String(err),
      renderId: null,
      bucketName: null,
    };
  }
}

export async function checkRenderProgress(
  renderId: string,
  bucketName: string,
): Promise<RenderProgressResult> {
  const env = getServerEnv();
  if (!env.AWS_ACCESS_KEY_ID) {
    return { ok: false, done: false, progress: 0, outputUrl: null, error: "AWS não configurado", costsBrl: 0 };
  }
  try {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: env.REMOTION_LAMBDA_FUNCTION_NAME!,
      region: env.AWS_REGION as "us-east-1",
    });
    return {
      ok: true,
      done: progress.done,
      progress: progress.overallProgress,
      outputUrl: progress.outputFile ?? null,
      error: progress.fatalErrorEncountered ? (progress.errors[0]?.message ?? "Erro Lambda") : null,
      costsBrl: progress.costs.accruedSoFar * 5.7,  // USD * 5.7 BRL
    };
  } catch (err) {
    return {
      ok: false,
      done: false,
      progress: 0,
      outputUrl: null,
      error: err instanceof Error ? err.message : String(err),
      costsBrl: 0,
    };
  }
}
```

- [ ] **Step 18.2: Criar worker `/api/cron/yori-worker/route.ts`**

Cria `src/app/api/cron/yori-worker/route.ts`:

```typescript
// Cron: Vercel chama a cada 30s. Pega jobs pendentes e avança 1 step de cada.
//
// Pipeline:
// - pending → transcribing (baixa vídeo, chama Whisper, salva transcription)
// - transcribing → rendering (Claude limpa, gera SRT/TXT, dispara Lambda)
// - rendering → done (Lambda terminou, salva MP4)

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { listJobsToProcess, getTemplate } from "@/lib/yori/queries";
import { downloadFile, uploadOutput, getSignedUrl } from "@/lib/yori/storage";
import { transcribeAudio } from "@/lib/yori/services/groq-whisper";
import { cleanupTranscription } from "@/lib/yori/services/claude-cleanup";
import { startRender, checkRenderProgress } from "@/lib/yori/services/remotion-lambda";
import { buildSrt, buildTxt } from "@/lib/yori/srt-builder";
import type { YoriJob, WhisperWord } from "@/lib/yori/tipos";

export async function GET(req: Request) {
  // Auth
  const auth = req.headers.get("authorization");
  const env = getServerEnv();
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobs = await listJobsToProcess(5);
  const results = [];
  for (const job of jobs) {
    try {
      const result = await processJob(job);
      results.push({ id: job.id, ok: true, status: result });
    } catch (err) {
      results.push({ id: job.id, ok: false, error: err instanceof Error ? err.message : String(err) });
      await markJobError(job.id, err instanceof Error ? err.message : String(err));
    }
  }
  return NextResponse.json({ processed: results.length, results });
}

async function processJob(job: YoriJob): Promise<string> {
  if (job.status === "pending") return processPending(job);
  if (job.status === "transcribing") return processTranscribing(job);
  if (job.status === "rendering") return processRendering(job);
  return `noop:${job.status}`;
}

async function processPending(job: YoriJob): Promise<string> {
  if (!job.video_path) throw new Error("video_path ausente");
  const buffer = await downloadFile("yori-videos", job.video_path);
  if (!buffer) throw new Error("falha ao baixar vídeo");

  const result = await transcribeAudio(buffer, job.video_filename);
  if (!result.ok || !result.transcription) {
    throw new Error(result.error ?? "Whisper falhou");
  }

  // Salva transcription + atualiza status
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({
    status: "transcribing",
    progress_pct: 33,
    started_at: new Date().toISOString(),
    transcription: result.transcription,
    whisper_cost_brl: result.cost_brl,
  }).eq("id", job.id);

  return "advanced:pending→transcribing";
}

async function processTranscribing(job: YoriJob): Promise<string> {
  if (!job.transcription?.words) throw new Error("transcription ausente");

  // Limpa pontuação via Claude
  const cleanup = await cleanupTranscription(job.transcription.words as WhisperWord[]);
  const words = cleanup.ok ? cleanup.words : (job.transcription.words as WhisperWord[]);

  // Gera SRT + TXT
  const srt = buildSrt(words);
  const txt = buildTxt(words);

  const srtUpload = await uploadOutput(job.organization_id, job.user_id, job.id, "srt", srt, "text/plain");
  const txtUpload = await uploadOutput(job.organization_id, job.user_id, job.id, "txt", txt, "text/plain");

  if (!srtUpload.ok || !txtUpload.ok) {
    throw new Error("falha ao subir SRT/TXT");
  }

  // Busca template
  const template = await getTemplate(job.template_id);
  if (!template) throw new Error("template não encontrado");

  // Signed URL do vídeo bruto pro Lambda baixar
  const videoUrl = job.video_path ? await getSignedUrl("yori-videos", job.video_path, 3600) : null;
  if (!videoUrl) throw new Error("não consegui gerar signed URL do vídeo");

  // Dispara render Lambda
  const render = await startRender({
    baseTemplate: template.base_template,
    videoUrl,
    words,
    durationSeconds: job.video_duration_seconds ?? 90,
    primary_color: template.primary_color,
    highlight_color: template.highlight_color,
    font_family: template.font_family,
    font_size: template.font_size,
    position: template.position,
    position_y_offset: template.position_y_offset,
    has_shadow: template.has_shadow,
    shadow_intensity: template.shadow_intensity,
    animation: template.animation,
  });
  if (!render.ok || !render.renderId || !render.bucketName) {
    throw new Error(render.error ?? "render Lambda falhou ao iniciar");
  }

  // Salva renderId + bucketName na transcription jsonb (pra checkar progress no próximo tick)
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const enrichedTranscription = { ...job.transcription, _render: { renderId: render.renderId, bucketName: render.bucketName } };
  await sb.from("yori_jobs").update({
    status: "rendering",
    progress_pct: 66,
    transcription: enrichedTranscription,
    srt_path: srtUpload.path,
    txt_path: txtUpload.path,
  }).eq("id", job.id);

  return "advanced:transcribing→rendering";
}

async function processRendering(job: YoriJob): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderMeta = (job.transcription as any)?._render;
  if (!renderMeta?.renderId || !renderMeta?.bucketName) throw new Error("render metadata ausente");

  const progress = await checkRenderProgress(renderMeta.renderId, renderMeta.bucketName);
  if (!progress.ok) throw new Error(progress.error ?? "checkRenderProgress falhou");

  if (!progress.done) {
    // Atualiza progress (66% → 99% conforme Lambda avança)
    const supabase = createServiceRoleClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    const pct = 66 + Math.floor(progress.progress * 33);
    await sb.from("yori_jobs").update({ progress_pct: pct }).eq("id", job.id);
    return `still_rendering:${pct}%`;
  }

  if (progress.error) throw new Error(`Lambda erro: ${progress.error}`);
  if (!progress.outputUrl) throw new Error("Lambda terminou sem outputUrl");

  // Baixa o MP4 do output do Lambda e sobe pro Supabase Storage
  const resp = await fetch(progress.outputUrl);
  if (!resp.ok) throw new Error(`falha ao baixar output: ${resp.statusText}`);
  const mp4Buffer = await resp.arrayBuffer();

  const mp4Upload = await uploadOutput(job.organization_id, job.user_id, job.id, "mp4", mp4Buffer, "video/mp4");
  if (!mp4Upload.ok) throw new Error("falha ao subir MP4 final");

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({
    status: "done",
    progress_pct: 100,
    completed_at: new Date().toISOString(),
    mp4_path: mp4Upload.path,
    lambda_cost_brl: progress.costsBrl,
  }).eq("id", job.id);

  return "advanced:rendering→done";
}

async function markJobError(jobId: string, message: string): Promise<void> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  await sb.from("yori_jobs").update({
    status: "error",
    error_message: message.slice(0, 500),
  }).eq("id", jobId);
}
```

- [ ] **Step 18.3: Type-check + lint**

```
npm run typecheck
npm run lint -- src/lib/yori/services/remotion-lambda.ts src/app/api/cron/yori-worker/route.ts
```
Expected: zero errors

- [ ] **Step 18.4: Commit**

```bash
git add src/lib/yori/services/remotion-lambda.ts \
        src/app/api/cron/yori-worker/route.ts
git commit -m "feat(yori): worker cron orquestra pipeline (Whisper → Claude → Lambda)"
```

---

## Task 19: Cleanup cron

**Files:**
- Create: `src/app/api/cron/yori-cleanup/route.ts`

- [ ] **Step 19.1: Implementar cleanup**

Cria `src/app/api/cron/yori-cleanup/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { deleteFile } from "@/lib/yori/storage";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const env = getServerEnv();
  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const stats = {
    videos_deleted: 0,
    outputs_deleted: 0,
    orphan_jobs_errored: 0,
  };

  // 1. Deleta vídeos brutos > 24h
  const cutoffVideos = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: oldVideos } = await sb
    .from("yori_jobs")
    .select("id, video_path")
    .lt("created_at", cutoffVideos)
    .not("video_path", "is", null);
  for (const row of (oldVideos ?? []) as Array<{ id: string; video_path: string }>) {
    const ok = await deleteFile("yori-videos", row.video_path);
    if (ok) {
      await sb.from("yori_jobs").update({ video_path: null }).eq("id", row.id);
      stats.videos_deleted++;
    }
  }

  // 2. Deleta outputs > 30 dias
  const cutoffOutputs = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: oldOutputs } = await sb
    .from("yori_jobs")
    .select("id, mp4_path, srt_path, txt_path")
    .lt("completed_at", cutoffOutputs)
    .not("mp4_path", "is", null);
  for (const row of (oldOutputs ?? []) as Array<{ id: string; mp4_path: string; srt_path: string; txt_path: string }>) {
    if (row.mp4_path) await deleteFile("yori-outputs", row.mp4_path);
    if (row.srt_path) await deleteFile("yori-outputs", row.srt_path);
    if (row.txt_path) await deleteFile("yori-outputs", row.txt_path);
    await sb.from("yori_jobs").update({
      mp4_path: null, srt_path: null, txt_path: null,
    }).eq("id", row.id);
    stats.outputs_deleted++;
  }

  // 3. Marca jobs órfãos (stuck > 30min)
  const cutoffOrphans = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: orphans } = await sb
    .from("yori_jobs")
    .select("id")
    .in("status", ["pending", "transcribing", "rendering"])
    .lt("created_at", cutoffOrphans);
  for (const row of (orphans ?? []) as Array<{ id: string }>) {
    await sb.from("yori_jobs").update({
      status: "error",
      error_message: "Job órfão (>30min sem progresso). Tente de novo.",
    }).eq("id", row.id);
    stats.orphan_jobs_errored++;
  }

  return NextResponse.json(stats);
}
```

- [ ] **Step 19.2: Type-check + lint**

```
npm run typecheck
npm run lint -- src/app/api/cron/yori-cleanup/route.ts
```
Expected: zero errors

- [ ] **Step 19.3: Commit**

```bash
git add src/app/api/cron/yori-cleanup/route.ts
git commit -m "feat(yori): cron diário de cleanup (vídeos 24h, outputs 30d, órfãos)"
```

---

## Task 20: Vercel cron config + docs de setup AWS

**Files:**
- Modify: `vercel.json`
- Create: `docs/yori-aws-lambda-setup.md`

- [ ] **Step 20.1: Adicionar crons em vercel.json**

Em `vercel.json`, adicionar 2 crons na seção `crons` (criar se não existir):

```json
{
  "crons": [
    {
      "path": "/api/cron/yori-worker",
      "schedule": "*/1 * * * *"
    },
    {
      "path": "/api/cron/yori-cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

(Vercel Hobby plan tem mínimo de 1 minuto; Vercel Pro permite a cada segundo. Yori usa a cada 1min.)

> Se já existirem outros crons em `vercel.json`, adiciona os 2 novos ao array existente (não substitui).

- [ ] **Step 20.2: Criar docs/yori-aws-lambda-setup.md**

Cria `docs/yori-aws-lambda-setup.md`:

```markdown
# Yori — Setup AWS Lambda Remotion

Documento pra você (Yasmin) executar UMA VEZ antes de ativar o Yori em produção.

## 1. Criar conta AWS (se ainda não tem)

- https://aws.amazon.com → Create an AWS Account
- Validar cartão de crédito (a região mais barata é `us-east-1`)

## 2. Criar IAM user pra Remotion

1. AWS Console → IAM → Users → Add users
2. Username: `remotion-yori`
3. Access type: marca "Programmatic access"
4. Permissions: clica em "Attach policies directly"
5. Cria policy nova (JSON) com o conteúdo de:
   https://www.remotion.dev/docs/lambda/permissions
6. Anexa essa policy ao user
7. Clica "Create user" → salva o **Access Key ID** e **Secret Access Key** (vão pro Vercel env)

## 3. Deploy da função Lambda

No diretório raiz do projeto (no seu Mac):

```bash
# Exporta credenciais temporariamente
export AWS_ACCESS_KEY_ID=<sua key>
export AWS_SECRET_ACCESS_KEY=<seu secret>
export AWS_REGION=us-east-1

# Deploy da função
npx remotion lambda functions deploy
```

Output esperado:
```
✅ Successfully deployed function "remotion-render-..." (~2 minutos)
```

Anota o **nome da função** (algo tipo `remotion-render-4-0-X-mem2048mb-disk2048mb-timeout120s`).

## 4. Deploy do site (composições)

```bash
npx remotion lambda sites create remotion/index.ts --site-name=yori-v1
```

Output esperado:
```
Site uploaded to: https://remotionlambda-USEAST1-XXXXX.s3.us-east-1.amazonaws.com/sites/yori-v1/index.html
```

Anota a **URL completa do site** (essa URL vai pro env como `REMOTION_LAMBDA_SITE_NAME`).

## 5. Adicionar env vars no Vercel

No Vercel → Settings → Environment Variables, adicionar:

| Nome | Valor |
|---|---|
| `YORI_ENABLED` | `true` |
| `GROQ_API_KEY` | (cadastrar em https://console.groq.com → API Keys) |
| `AWS_ACCESS_KEY_ID` | (do passo 2) |
| `AWS_SECRET_ACCESS_KEY` | (do passo 2) |
| `AWS_REGION` | `us-east-1` |
| `REMOTION_LAMBDA_FUNCTION_NAME` | (do passo 3, sem prefixo `aws:`) |
| `REMOTION_LAMBDA_SITE_NAME` | (URL completa do passo 4) |

Marca todas como **Production** e **Preview**.

Depois: **Deployments → Redeploy** o último deploy.

## 6. Aplicar migration no Supabase

SQL Editor → New query → cola o conteúdo de `supabase/migrations/20260527000000_yori_templates_jobs.sql` → Run.

## 7. Criar buckets no Supabase Storage

Dashboard Supabase → Storage:
1. Create new bucket → Name: `yori-videos` → Public: OFF → Create
2. Create new bucket → Name: `yori-outputs` → Public: OFF → Create

## 8. Validar

1. Abre `/audiovisual` no app → deve aparecer o botão "✨ Yori — Editor IA"
2. Clica → vai pra `/audiovisual/yori` (lista vazia + quota 0/100)
3. Clica "Novo" → arrasta um Reel de teste → escolhe template "Submagic" → Gerar
4. Aguarda 30-90s → MP4 + SRT + TXT prontos pra download

## Custo esperado

| Item | Custo mensal estimado |
|---|---|
| AWS Lambda (~100 renders) | R$ 60-100 |
| Groq Whisper | R$ 5 |
| Claude (limpeza) | R$ 1 |
| Total | **R$ 70-110** |

## Troubleshooting

- **Job stuck em "Renderizando":** AWS Lambda pode estar com cota Free Tier estourada → checar https://us-east-1.console.aws.amazon.com/billing
- **"AWS credentials invalid":** rotacionar o Access Key no IAM e atualizar no Vercel
- **"Site não encontrado":** redeployer com `npx remotion lambda sites create`
```

- [ ] **Step 20.3: Commit**

```bash
git add vercel.json docs/yori-aws-lambda-setup.md
git commit -m "docs(yori): setup AWS Lambda + cron Vercel"
```

---

## Task 21: Verificação final + PR

- [ ] **Step 21.1: Type-check completo**

Run: `npm run typecheck`
Expected: zero errors

- [ ] **Step 21.2: Lint completo**

Run: `npm run lint`
Expected: zero errors (warnings pre-existentes em outros arquivos = OK)

- [ ] **Step 21.3: Tests completos**

Run: `npm test`
Expected: todos passam, incluindo os 3 novos arquivos de teste:
- `yori-schema.test.ts` (8 testes)
- `yori-srt-builder.test.ts` (8 testes)
- `yori-claude-cleanup-parser.test.ts` (4 testes)

- [ ] **Step 21.4: Push e abrir PR**

```bash
git push -u origin feat/yori-editor-ia

gh pr create --title "feat(yori): editor de vídeo com IA — Fase 1 (Reels com legenda automática)" --body "$(cat <<'EOF'
## Por que

Equipe de audiovisual gasta tempo transcrevendo + sincronizando + estilizando legenda em cada Reel. Yori v1 automatiza esse fluxo: equipe sobe vídeo → IA transcreve → sistema renderiza MP4 com legenda estilizada + SRT + TXT.

## O que muda

- Nova subpágina `/audiovisual/yori` (botão destacado em `/audiovisual` + ícone no nav lateral)
- Pipeline async: upload → Whisper (Groq) → Claude limpa → Remotion Lambda renderiza → MP4 + SRT + TXT
- 3 templates de sistema (Submagic, TikTok, Reels Box) + customização híbrida (color picker + 8 fontes Google + posição/tamanho/animação/sombra)
- User salva templates próprios reutilizáveis pela equipe
- Quota 100 jobs/org/mês
- Roles: videomaker, editor, audiovisual_chefe, assessor, sócio, adm
- Feature flag `YORI_ENABLED` (off por padrão — ativa quando setup AWS estiver feito)

## Custo extra mensal estimado

R$ 70-110 (Lambda Remotion + Groq Whisper + Claude limpeza)

## Setup pós-merge (manual)

Ver `docs/yori-aws-lambda-setup.md`:
1. Criar conta AWS + IAM user
2. `npx remotion lambda functions deploy`
3. `npx remotion lambda sites create remotion/index.ts --site-name=yori-v1`
4. Adicionar env vars no Vercel (`YORI_ENABLED=true`, `GROQ_API_KEY`, AWS, REMOTION)
5. Aplicar migration no Supabase
6. Criar 2 buckets de Storage (`yori-videos`, `yori-outputs`)
7. Redeploy

## Test plan

- [ ] Aplicar migration + criar buckets
- [ ] Deploy AWS Lambda Remotion
- [ ] Configurar env vars no Vercel + redeploy
- [ ] Abrir `/audiovisual` → confirmar botão "Yori" aparece
- [ ] Subir vídeo de teste (Reel ~30s) → escolher template "Submagic"
- [ ] Aguardar 30-90s → verificar MP4 com legenda + SRT + TXT
- [ ] Testar template "TikTok Clássico" e "Reels Box"
- [ ] Criar template customizado em `/yori/templates` → usar num novo job
- [ ] Cancelar um job pendente
- [ ] Validar que sem `YORI_ENABLED=true` o nav lateral esconde o item e rotas redirecionam

## Cobertura

- **Testes:** 20 testes novos (schema, srt-builder, claude-cleanup-parser)
- **Typecheck:** zero errors
- **Lint:** zero errors

## Spec & Plan

- [docs/superpowers/specs/2026-05-27-yori-editor-ia-design.md](docs/superpowers/specs/2026-05-27-yori-editor-ia-design.md)
- [docs/superpowers/plans/2026-05-27-yori-editor-ia.md](docs/superpowers/plans/2026-05-27-yori-editor-ia.md)

## Follow-ups (futuras fases)

- Chat conversacional ("muda cor da legenda", "corta os silêncios") — Fase 2
- Cortes automáticos de vídeo longo em vários Reels — Fase 3
- Geração from-scratch via Google Veo — Fase 4
- Notificações push quando job fica pronto

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Métricas pós-deploy (medir em 60 dias)

1. **Volume:** ≥ 50 jobs/mês criados
2. **Taxa de sucesso:** ≥ 90% jobs em `status=done`
3. **Tempo médio:** ≤ 90s pra Reel de 60s
4. **Adoção:** ≥ 70% do time autorizado (videomaker/editor/etc) usou ao menos 1 vez
5. **Custo real vs estimado:** monitorar e ajustar
