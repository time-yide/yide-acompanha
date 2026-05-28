# Briefing & confirmação de gravação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que o videomaker designado pra uma gravação leia o roteiro **e** imprima um briefing antes de sair pro cliente, com bloqueio do endereço/Maps até confirmar leitura, botão pra gerar capa printável e notificações escalonadas 24h/3h/2h.

**Architecture:** Camadas finas em `lib/briefing-gravacao/` (tipos puros, status, permissões, storage, actions). UI nova em `components/calendario/RoteiroToggle.tsx` e `components/calendario/BriefingChecklist.tsx`. Página print-friendly em `app/(authed)/calendario/[id]/briefing`. Cron de 5min reusa o pipeline `lib/cron/detectors/` + `dispatchNotification` existente. Bucket Supabase `roteiros` privado pra upload de PDF.

**Tech Stack:** Next.js 16 (App Router + Server Actions), Supabase (Postgres + RLS + Storage), Vercel cron, Vitest, lib `qrcode` (PNG data URL).

**Spec:** `docs/superpowers/specs/2026-05-27-briefing-gravacao-design.md`

**⚠️ Correção do spec:** o spec se refere à tabela como `events` por simplicidade — o nome real é `calendar_events`. Use `calendar_events` no código.

---

## Phase 1 — Foundation

### Task 1: Migration de schema (colunas, bucket, RLS, enum, regras)

**Files:**
- Create: `supabase/migrations/20260528000000_briefing_gravacao.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- supabase/migrations/20260528000000_briefing_gravacao.sql
--
-- Briefing & confirmação de gravação:
--  1. Tipa roteiro (link OU pdf, exclusivos)
--  2. Timestamps de leitura/impressão pelo videomaker designado
--  3. Idempotência de notificações 24h/3h/2h/sem-roteiro
--  4. Opt-in adm/sócio pra alerta de 2h
--  5. Bucket privado 'roteiros' + policies de upload/leitura
--  6. Novos eventos no enum notification_event + 4 notification_rules

-- 1) Roteiro tipado --------------------------------------------------------
alter table public.calendar_events
  add column roteiro_tipo text
    check (roteiro_tipo in ('link','pdf')),
  add column roteiro_pdf_path text;

-- Backfill: eventos existentes com link_roteiro preenchido viram tipo='link'
update public.calendar_events
   set roteiro_tipo = 'link'
 where link_roteiro is not null
   and link_roteiro <> '';

-- Consistência: se tipo='pdf', path obrigatório; se tipo='link', link obrigatório
alter table public.calendar_events
  add constraint calendar_events_roteiro_consistencia check (
    roteiro_tipo is null
    or (roteiro_tipo = 'link' and link_roteiro is not null and link_roteiro <> '')
    or (roteiro_tipo = 'pdf'  and roteiro_pdf_path is not null)
  );

-- 2) Confirmação pelo videomaker -------------------------------------------
alter table public.calendar_events
  add column videomaker_leu_em       timestamptz,
  add column briefing_gerado_em      timestamptz,
  add column videomaker_imprimiu_em  timestamptz,
  add column confirmacao_marcada_por uuid references public.profiles(id);

-- 3) Idempotência de notificações ------------------------------------------
alter table public.calendar_events
  add column notif_24h_enviada_em         timestamptz,
  add column notif_3h_enviada_em          timestamptz,
  add column notif_2h_alert_enviada_em    timestamptz,
  add column notif_sem_roteiro_enviada_em timestamptz;

-- Index parcial pro cron: só eventos de videomakers, futuros, pendentes em
-- qualquer um dos triggers. Reduz scan do cron de 5min.
create index idx_calendar_events_briefing_cron
  on public.calendar_events (inicio)
  where sub_calendar = 'videomakers'
    and (
      notif_24h_enviada_em is null
      or notif_3h_enviada_em is null
      or notif_2h_alert_enviada_em is null
      or notif_sem_roteiro_enviada_em is null
    );

-- 4) Opt-in adm/sócio -------------------------------------------------------
alter table public.profiles
  add column notif_alerta_gravacao_pendente boolean not null default true;

-- 5) Storage bucket --------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('roteiros', 'roteiros', false)
on conflict (id) do nothing;

-- Upload: assessor / coordenador / audiovisual_chefe / adm / sócio
create policy "roteiros_upload"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'roteiros'
    and (select role from public.profiles where id = auth.uid())
        in ('assessor','coordenador','audiovisual_chefe','adm','socio')
  );

-- Leitura: roles acima OU videomaker designado no evento dono do path
create policy "roteiros_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'roteiros'
    and (
      (select role from public.profiles where id = auth.uid())
          in ('assessor','coordenador','audiovisual_chefe','adm','socio')
      or exists (
        select 1
          from public.calendar_events e
         where e.roteiro_pdf_path = storage.objects.name
           and auth.uid() = any(e.participantes_ids)
      )
    )
  );

-- Delete: mesmas roles de upload
create policy "roteiros_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'roteiros'
    and (select role from public.profiles where id = auth.uid())
        in ('assessor','coordenador','audiovisual_chefe','adm','socio')
  );

-- 6) Enum + notification_rules ---------------------------------------------
alter type public.notification_event add value if not exists 'gravacao_pendente_24h';
alter type public.notification_event add value if not exists 'gravacao_pendente_3h';
alter type public.notification_event add value if not exists 'gravacao_alerta_2h';
alter type public.notification_event add value if not exists 'gravacao_sem_roteiro';

-- Rule: 24h pra videomaker (mandatory pro videomaker — sem opt-out)
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'gravacao_pendente_24h', true, true, false,
  true, array[]::text[], array[]::uuid[]
) on conflict (evento_tipo) do nothing;

-- Rule: 3h pra videomaker
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'gravacao_pendente_3h', true, true, false,
  true, array[]::text[], array[]::uuid[]
) on conflict (evento_tipo) do nothing;

-- Rule: 2h alert pra assessor + audiovisual_chefe (mandatory) + opt-in adm/sócio
-- Default_roles inclui audiovisual_chefe; destinatários extras (assessor criador,
-- adm/sócio com opt-in) entram via user_ids_extras na chamada do dispatch.
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'gravacao_alerta_2h', true, true, false,
  true, array['audiovisual_chefe']::text[], array[]::uuid[]
) on conflict (evento_tipo) do nothing;

-- Rule: sem roteiro 24h antes — pra audiovisual_chefe + criador via extras
insert into public.notification_rules (
  evento_tipo, ativo, mandatory, email_default,
  permite_destinatarios_extras, default_roles, default_user_ids
) values (
  'gravacao_sem_roteiro', true, true, false,
  true, array['audiovisual_chefe']::text[], array[]::uuid[]
) on conflict (evento_tipo) do nothing;
```

- [ ] **Step 2: Aplicar migration localmente (se houver setup) e regenerar tipos**

A Yasmin aplica migrations manualmente via SQL Editor após merge do PR (ver MEMORY: "Migrations Supabase são manuais"). Pro plano: a regeneração de tipos roda **depois** que ela aplicar o SQL no remoto, então neste momento **não regere os types**. O código vai usar `as any` em pontos novos enquanto isso (mesmo padrão de `evento_calendario_marcado` em `lib/calendario/actions.ts`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260528000000_briefing_gravacao.sql
git commit -m "feat(briefing-gravacao): migration de schema + bucket + rules"
```

---

## Phase 2 — Pure helpers (TDD)

### Task 2: Tipos compartilhados

**Files:**
- Create: `src/lib/briefing-gravacao/tipos.ts`

- [ ] **Step 1: Criar tipos**

```ts
// src/lib/briefing-gravacao/tipos.ts
//
// Tipos compartilhados do módulo de briefing/confirmação de gravação.

export type RoteiroTipo = "link" | "pdf";

export type StatusBriefing = "sem_roteiro" | "pendente" | "pronto";

/**
 * Subset dos campos de calendar_events relevantes pro cálculo de status.
 * Usado por status.ts (pura) e pelo componente de badge no calendário.
 */
export interface EventoBriefingInput {
  roteiro_tipo: RoteiroTipo | null;
  videomaker_leu_em: string | null;
  videomaker_imprimiu_em: string | null;
}

export interface BriefingPrintData {
  eventoId: string;
  clienteNome: string | null;
  inicio: string; // ISO
  fim: string;
  endereco: string | null;
  mapsUrl: string | null;
  observacoes: string | null;
  /** URL absoluta do roteiro (link externo OU signed URL do PDF). Null se sem roteiro. */
  roteiroUrl: string | null;
  roteiroTipo: RoteiroTipo | null;
  geradoPorNome: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/briefing-gravacao/tipos.ts
git commit -m "feat(briefing-gravacao): tipos compartilhados"
```

---

### Task 3: `computaStatus` (pura) com TDD

**Files:**
- Create: `src/lib/briefing-gravacao/status.ts`
- Test: `tests/unit/briefing-gravacao-status.test.ts`

- [ ] **Step 1: Escrever testes que falham**

```ts
// tests/unit/briefing-gravacao-status.test.ts
import { describe, it, expect } from "vitest";
import { computaStatus } from "@/lib/briefing-gravacao/status";

describe("computaStatus", () => {
  it("retorna 'sem_roteiro' quando roteiro_tipo é null", () => {
    expect(
      computaStatus({
        roteiro_tipo: null,
        videomaker_leu_em: null,
        videomaker_imprimiu_em: null,
      }),
    ).toBe("sem_roteiro");
  });

  it("'sem_roteiro' mesmo se houver timestamps (caso anômalo)", () => {
    expect(
      computaStatus({
        roteiro_tipo: null,
        videomaker_leu_em: "2026-05-28T10:00:00Z",
        videomaker_imprimiu_em: "2026-05-28T10:05:00Z",
      }),
    ).toBe("sem_roteiro");
  });

  it("'pendente' com roteiro mas sem nenhum check", () => {
    expect(
      computaStatus({
        roteiro_tipo: "link",
        videomaker_leu_em: null,
        videomaker_imprimiu_em: null,
      }),
    ).toBe("pendente");
  });

  it("'pendente' com só 'leu' marcado", () => {
    expect(
      computaStatus({
        roteiro_tipo: "pdf",
        videomaker_leu_em: "2026-05-28T10:00:00Z",
        videomaker_imprimiu_em: null,
      }),
    ).toBe("pendente");
  });

  it("'pendente' com só 'imprimiu' marcado (caso anômalo mas possível)", () => {
    expect(
      computaStatus({
        roteiro_tipo: "pdf",
        videomaker_leu_em: null,
        videomaker_imprimiu_em: "2026-05-28T10:00:00Z",
      }),
    ).toBe("pendente");
  });

  it("'pronto' com leu + imprimiu", () => {
    expect(
      computaStatus({
        roteiro_tipo: "link",
        videomaker_leu_em: "2026-05-28T10:00:00Z",
        videomaker_imprimiu_em: "2026-05-28T10:05:00Z",
      }),
    ).toBe("pronto");
  });
});
```

- [ ] **Step 2: Rodar — esperar falha por módulo não existir**

```bash
npm test -- briefing-gravacao-status
```

Expected: FAIL (`Cannot find module '@/lib/briefing-gravacao/status'`).

- [ ] **Step 3: Implementar `status.ts`**

```ts
// src/lib/briefing-gravacao/status.ts
//
// Função pura: dado os campos relevantes de um calendar_event, retorna o
// status do briefing. Usada pelo badge no calendário, pelo card de detalhe
// e pelo cron de notificações.

import type { EventoBriefingInput, StatusBriefing } from "./tipos";

export function computaStatus(e: EventoBriefingInput): StatusBriefing {
  if (e.roteiro_tipo === null) return "sem_roteiro";
  if (e.videomaker_leu_em && e.videomaker_imprimiu_em) return "pronto";
  return "pendente";
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
npm test -- briefing-gravacao-status
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefing-gravacao/status.ts tests/unit/briefing-gravacao-status.test.ts
git commit -m "feat(briefing-gravacao): computaStatus + testes"
```

---

### Task 4: `podeMarcarCheck` e `podeUploadRoteiro` (TDD)

**Files:**
- Create: `src/lib/briefing-gravacao/permissions.ts`
- Test: `tests/unit/briefing-gravacao-permissions.test.ts`

- [ ] **Step 1: Escrever testes**

```ts
// tests/unit/briefing-gravacao-permissions.test.ts
import { describe, it, expect } from "vitest";
import {
  podeMarcarCheck,
  podeUploadRoteiro,
} from "@/lib/briefing-gravacao/permissions";

describe("podeMarcarCheck", () => {
  const evento = { participantes_ids: ["videomaker-1", "videomaker-2"] };

  it("videomaker designado pode marcar", () => {
    expect(
      podeMarcarCheck({ userId: "videomaker-1", role: "videomaker" }, evento),
    ).toBe(true);
  });

  it("videomaker NÃO designado não pode", () => {
    expect(
      podeMarcarCheck({ userId: "videomaker-outro", role: "videomaker" }, evento),
    ).toBe(false);
  });

  it("audiovisual_chefe pode marcar em nome (override)", () => {
    expect(
      podeMarcarCheck({ userId: "chefe-1", role: "audiovisual_chefe" }, evento),
    ).toBe(true);
  });

  it("adm pode marcar em nome", () => {
    expect(podeMarcarCheck({ userId: "adm-1", role: "adm" }, evento)).toBe(true);
  });

  it("socio pode marcar em nome", () => {
    expect(podeMarcarCheck({ userId: "s-1", role: "socio" }, evento)).toBe(true);
  });

  it("assessor não pode (mesmo sendo criador do evento)", () => {
    expect(podeMarcarCheck({ userId: "ass-1", role: "assessor" }, evento)).toBe(
      false,
    );
  });
});

describe("podeUploadRoteiro", () => {
  it.each([
    ["assessor", true],
    ["coordenador", true],
    ["audiovisual_chefe", true],
    ["adm", true],
    ["socio", true],
    ["videomaker", false],
    ["designer", false],
    ["editor", false],
    ["comercial", false],
  ])("role=%s → %s", (role, esperado) => {
    expect(podeUploadRoteiro(role)).toBe(esperado);
  });
});
```

- [ ] **Step 2: Rodar — esperar falha**

```bash
npm test -- briefing-gravacao-permissions
```

- [ ] **Step 3: Implementar**

```ts
// src/lib/briefing-gravacao/permissions.ts

const ROLES_OVERRIDE_CHECK = ["audiovisual_chefe", "adm", "socio"] as const;
const ROLES_UPLOAD = [
  "assessor",
  "coordenador",
  "audiovisual_chefe",
  "adm",
  "socio",
] as const;

interface Actor {
  userId: string;
  role: string;
}

interface EventoMinimo {
  participantes_ids: string[];
}

/**
 * Pode marcar checks (leu / imprimiu) se:
 *  - É videomaker designado no evento, OU
 *  - É role de override (audiovisual_chefe / adm / sócio) marcando em nome.
 *
 * Quando override, `confirmacao_marcada_por` no DB guardará o userId pro
 * audit trail.
 */
export function podeMarcarCheck(actor: Actor, evento: EventoMinimo): boolean {
  if ((ROLES_OVERRIDE_CHECK as readonly string[]).includes(actor.role)) {
    return true;
  }
  return evento.participantes_ids.includes(actor.userId);
}

export function podeUploadRoteiro(role: string): boolean {
  return (ROLES_UPLOAD as readonly string[]).includes(role);
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
npm test -- briefing-gravacao-permissions
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefing-gravacao/permissions.ts tests/unit/briefing-gravacao-permissions.test.ts
git commit -m "feat(briefing-gravacao): permissoes (marcar check + upload)"
```

---

## Phase 3 — Storage layer

### Task 5: Wrapper de storage pra PDF do roteiro

**Files:**
- Create: `src/lib/briefing-gravacao/storage.ts`
- Test: `tests/unit/briefing-gravacao-storage.test.ts`

- [ ] **Step 1: Implementar storage helpers**

```ts
// src/lib/briefing-gravacao/storage.ts
//
// SERVER-ONLY. Helpers de upload/leitura/delete do PDF do roteiro no
// bucket privado 'roteiros'. Path: eventos/<eventId>/<uuid>.pdf

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const ROTEIROS_BUCKET = "roteiros";
export const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME = "application/pdf";

/** Validação shared por server action E pelo upload direto via storage. */
export function validatePdfFile(file: { size: number; type: string }): {
  ok: boolean;
  erro?: string;
} {
  if (file.type !== ALLOWED_MIME) {
    return { ok: false, erro: "Tipo invalido. Envie um PDF." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, erro: "Arquivo maior que 10MB." };
  }
  return { ok: true };
}

/**
 * Upload do PDF do roteiro. Retorna o storage path salvo (use em
 * calendar_events.roteiro_pdf_path).
 */
export async function uploadRoteiroPdf(params: {
  eventoId: string;
  file: ArrayBuffer;
  contentType: string;
}): Promise<{ path: string } | { erro: string }> {
  const validation = validatePdfFile({
    size: params.file.byteLength,
    type: params.contentType,
  });
  if (!validation.ok) return { erro: validation.erro! };

  const supabase = createServiceRoleClient();
  const path = `eventos/${params.eventoId}/${crypto.randomUUID()}.pdf`;

  const { error } = await supabase.storage
    .from(ROTEIROS_BUCKET)
    .upload(path, params.file, {
      contentType: params.contentType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) return { erro: `Falha no upload: ${error.message}` };
  return { path };
}

/** Signed URL pra download/abertura do PDF — TTL curto (15min). */
export async function getRoteiroSignedUrl(
  path: string,
): Promise<{ url: string } | { erro: string }> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage
    .from(ROTEIROS_BUCKET)
    .createSignedUrl(path, 15 * 60);
  if (error || !data) return { erro: error?.message ?? "Sem URL" };
  return { url: data.signedUrl };
}

/** Remove um PDF do storage (chamado ao trocar de link/pdf ou apagar evento). */
export async function deleteRoteiroPdf(path: string): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.storage.from(ROTEIROS_BUCKET).remove([path]);
}
```

- [ ] **Step 2: Test unit de `validatePdfFile`**

```ts
// tests/unit/briefing-gravacao-storage.test.ts
import { describe, it, expect } from "vitest";
import { validatePdfFile, MAX_PDF_BYTES } from "@/lib/briefing-gravacao/storage";

describe("validatePdfFile", () => {
  it("rejeita tipo diferente de application/pdf", () => {
    const r = validatePdfFile({ size: 100, type: "image/png" });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/PDF/i);
  });

  it("rejeita arquivo maior que 10MB", () => {
    const r = validatePdfFile({ size: MAX_PDF_BYTES + 1, type: "application/pdf" });
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/10MB/);
  });

  it("aceita PDF dentro do limite", () => {
    const r = validatePdfFile({ size: 1024, type: "application/pdf" });
    expect(r.ok).toBe(true);
    expect(r.erro).toBeUndefined();
  });

  it("aceita PDF no limite exato", () => {
    const r = validatePdfFile({ size: MAX_PDF_BYTES, type: "application/pdf" });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Rodar testes — devem passar**

```bash
npm test -- briefing-gravacao-storage
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/briefing-gravacao/storage.ts tests/unit/briefing-gravacao-storage.test.ts
git commit -m "feat(briefing-gravacao): storage helpers + validacao de PDF"
```

---

## Phase 4 — Zod schema + server actions

### Task 6: Schema Zod pro roteiro tipado (TDD)

**Files:**
- Create: `src/lib/briefing-gravacao/schema.ts`
- Test: `tests/unit/briefing-gravacao-schema.test.ts`

- [ ] **Step 1: Escrever testes**

```ts
// tests/unit/briefing-gravacao-schema.test.ts
import { describe, it, expect } from "vitest";
import { roteiroSchema } from "@/lib/briefing-gravacao/schema";

describe("roteiroSchema", () => {
  it("aceita roteiro tipo='link' com URL valida", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "link",
      link_roteiro: "https://docs.google.com/document/d/abc",
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita tipo='link' sem URL", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "link",
      link_roteiro: "",
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita tipo='link' com URL invalida", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "link",
      link_roteiro: "nao-e-url",
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(false);
  });

  it("aceita roteiro tipo='pdf' com path", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "pdf",
      link_roteiro: null,
      roteiro_pdf_path: "eventos/abc/xyz.pdf",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita tipo='pdf' sem path", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: "pdf",
      link_roteiro: null,
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(false);
  });

  it("aceita sem roteiro (todos null)", () => {
    const r = roteiroSchema.safeParse({
      roteiro_tipo: null,
      link_roteiro: null,
      roteiro_pdf_path: null,
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar — falha**

```bash
npm test -- briefing-gravacao-schema
```

- [ ] **Step 3: Implementar schema**

```ts
// src/lib/briefing-gravacao/schema.ts
import { z } from "zod";

/**
 * Discriminated union: tipo='link' exige URL; tipo='pdf' exige path no storage;
 * null = sem roteiro anexado.
 */
export const roteiroSchema = z.discriminatedUnion("roteiro_tipo", [
  z.object({
    roteiro_tipo: z.literal("link"),
    link_roteiro: z.string().url("URL invalida").min(1, "URL obrigatoria"),
    roteiro_pdf_path: z.null(),
  }),
  z.object({
    roteiro_tipo: z.literal("pdf"),
    link_roteiro: z.null(),
    roteiro_pdf_path: z.string().min(1, "Path obrigatorio"),
  }),
  z.object({
    roteiro_tipo: z.null(),
    link_roteiro: z.null(),
    roteiro_pdf_path: z.null(),
  }),
]);

export type RoteiroPayload = z.infer<typeof roteiroSchema>;
```

- [ ] **Step 4: Rodar testes — passar**

```bash
npm test -- briefing-gravacao-schema
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefing-gravacao/schema.ts tests/unit/briefing-gravacao-schema.test.ts
git commit -m "feat(briefing-gravacao): schema Zod do roteiro tipado"
```

---

### Task 7: Server actions de check (leu / imprimiu / briefing gerado)

**Files:**
- Create: `src/lib/briefing-gravacao/actions.ts`

- [ ] **Step 1: Implementar as 3 actions**

```ts
// src/lib/briefing-gravacao/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";
import { podeMarcarCheck } from "./permissions";

type Result = { ok: true } | { error: string };

async function getEventoMinimo(
  eventoId: string,
): Promise<{ participantes_ids: string[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select("participantes_ids")
    .eq("id", eventoId)
    .single();
  return data as { participantes_ids: string[] } | null;
}

/**
 * Registra que o videomaker abriu/leu o roteiro. Idempotente: se já estiver
 * marcado, não sobrescreve.
 */
export async function marcarLeuAction(eventoId: string): Promise<Result> {
  const user = await requireAuth();
  const evento = await getEventoMinimo(eventoId);
  if (!evento) return { error: "Evento nao encontrado" };

  if (!podeMarcarCheck({ userId: user.id, role: user.role }, evento)) {
    return { error: "Sem permissao" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      videomaker_leu_em: new Date().toISOString(),
      confirmacao_marcada_por: user.id,
    } as any)
    .eq("id", eventoId)
    .is("videomaker_leu_em", null); // idempotência: só marca se estava null

  if (error) return { error: error.message };

  await logAudit({
    actor_id: user.id,
    entidade: "calendar_event",
    entidade_id: eventoId,
    acao: "briefing.marcou_leu",
    meta: { override: !evento.participantes_ids.includes(user.id) },
  });

  revalidatePath(`/calendario/${eventoId}`);
  revalidatePath("/calendario");
  return { ok: true };
}

/**
 * Registra que o videomaker imprimiu (clicou no checkbox final).
 */
export async function marcarImprimiuAction(eventoId: string): Promise<Result> {
  const user = await requireAuth();
  const evento = await getEventoMinimo(eventoId);
  if (!evento) return { error: "Evento nao encontrado" };
  if (!podeMarcarCheck({ userId: user.id, role: user.role }, evento)) {
    return { error: "Sem permissao" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      videomaker_imprimiu_em: new Date().toISOString(),
      confirmacao_marcada_por: user.id,
    } as any)
    .eq("id", eventoId)
    .is("videomaker_imprimiu_em", null);

  if (error) return { error: error.message };

  await logAudit({
    actor_id: user.id,
    entidade: "calendar_event",
    entidade_id: eventoId,
    acao: "briefing.marcou_imprimiu",
    meta: { override: !evento.participantes_ids.includes(user.id) },
  });

  revalidatePath(`/calendario/${eventoId}`);
  revalidatePath("/calendario");
  return { ok: true };
}

/**
 * Registra timestamp quando o videomaker (ou alguém autorizado) clicou em
 * "Gerar folha pra imprimir". Sem permissão estrita (qualquer um com acesso
 * ao evento pode gerar).
 */
export async function registrarBriefingGeradoAction(
  eventoId: string,
): Promise<Result> {
  await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("calendar_events")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ briefing_gerado_em: new Date().toISOString() } as any)
    .eq("id", eventoId)
    .is("briefing_gerado_em", null);
  if (error) return { error: error.message };
  return { ok: true };
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "briefing-gravacao" | head -10
```

Esperado: nenhum erro nos arquivos novos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/briefing-gravacao/actions.ts
git commit -m "feat(briefing-gravacao): server actions de leu/imprimiu/briefing-gerado"
```

---

### Task 8: Server action de upload de PDF + integração no fluxo do evento

**Files:**
- Modify: `src/lib/briefing-gravacao/actions.ts` (adiciona `uploadRoteiroPdfAction`)
- Modify: `src/lib/calendario/schema.ts` (incluir campos novos no `baseEventFields`)
- Modify: `src/lib/calendario/actions.ts` (gravar `roteiro_tipo` / `roteiro_pdf_path` no create/update; delete PDF antigo ao trocar)

- [ ] **Step 1: Adicionar `uploadRoteiroPdfAction`**

Append em `src/lib/briefing-gravacao/actions.ts`:

```ts
import { podeUploadRoteiro } from "./permissions";
import { uploadRoteiroPdf } from "./storage";

/**
 * Recebe um File do form e faz upload pro bucket 'roteiros'. Devolve o path
 * pro client preencher no input hidden antes de submitter o EventForm.
 *
 * Por que separado do updateEventAction? Pra evitar re-upload se o usuário
 * editar outros campos do evento depois (o path fica memorizado).
 */
export async function uploadRoteiroPdfAction(
  eventoId: string,
  formData: FormData,
): Promise<{ path: string } | { error: string }> {
  const user = await requireAuth();
  if (!podeUploadRoteiro(user.role)) return { error: "Sem permissao" };

  const file = formData.get("arquivo");
  if (!(file instanceof File)) return { error: "Arquivo invalido" };

  const buffer = await file.arrayBuffer();
  const result = await uploadRoteiroPdf({
    eventoId,
    file: buffer,
    contentType: file.type,
  });
  if ("erro" in result) return { error: result.erro };

  await logAudit({
    actor_id: user.id,
    entidade: "calendar_event",
    entidade_id: eventoId,
    acao: "briefing.upload_pdf",
    meta: { path: result.path, size: file.size },
  });

  return { path: result.path };
}
```

- [ ] **Step 2: Atualizar `baseEventFields` em `schema.ts`**

Edit em `src/lib/calendario/schema.ts`, dentro de `baseEventFields`, logo após a linha `link_roteiro: z.string().optional().nullable(),`:

```ts
  roteiro_tipo: z.enum(["link", "pdf"]).optional().nullable(),
  roteiro_pdf_path: z.string().optional().nullable(),
```

E adicionar na `CalendarEvent` interface (no mesmo arquivo) logo após `link_roteiro?: string | null;`:

```ts
  roteiro_tipo?: "link" | "pdf" | null;
  roteiro_pdf_path?: string | null;
```

- [ ] **Step 3: Atualizar create/update event actions pra gravar os campos novos**

Em `src/lib/calendario/actions.ts`, dentro de `createEventAction` e `updateEventAction`, no objeto passado pro `.insert()` / `.update()`, adicionar:

```ts
  roteiro_tipo: parsed.data.roteiro_tipo ?? null,
  roteiro_pdf_path: parsed.data.roteiro_pdf_path ?? null,
```

Importante: ao **trocar** o tipo (ex: era 'pdf' agora é 'link'), deletar o PDF antigo. Lógica pra `updateEventAction`:

```ts
// ANTES do .update(), buscar o estado atual:
const supabase = await createClient();
const { data: atual } = await supabase
  .from("calendar_events")
  .select("roteiro_tipo, roteiro_pdf_path")
  .eq("id", parsed.data.id)
  .single();

// Se tinha PDF e agora não tem (ou virou link), agendar delete:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const atualAny = atual as any;
const pdfAntigo: string | null = atualAny?.roteiro_pdf_path ?? null;
const trocouTipo = atual && atualAny.roteiro_tipo !== parsed.data.roteiro_tipo;
const trocouPdf = atual && atualAny.roteiro_pdf_path !== parsed.data.roteiro_pdf_path;

if (pdfAntigo && (trocouTipo || trocouPdf)) {
  // import "after" do next/server já existe no arquivo
  const { deleteRoteiroPdf } = await import("@/lib/briefing-gravacao/storage");
  after(deleteRoteiroPdf(pdfAntigo));
}
```

- [ ] **Step 4: Verificar typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | grep -E "(calendario|briefing)" | head -10
npm run lint 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/briefing-gravacao/actions.ts src/lib/calendario/schema.ts src/lib/calendario/actions.ts
git commit -m "feat(briefing-gravacao): upload PDF + integracao no create/update event"
```

---

## Phase 5 — UI: anexar roteiro

### Task 9: Componente `RoteiroToggle` (Link/PDF)

**Files:**
- Create: `src/components/calendario/RoteiroToggle.tsx`
- Modify: `src/components/calendario/EventForm.tsx`
- Modify: `src/lib/calendario/queries.ts` (carregar campos novos em `getEventById`)

- [ ] **Step 1: Criar `RoteiroToggle`**

```tsx
// src/components/calendario/RoteiroToggle.tsx
"use client";

import { useState, useTransition, useRef } from "react";
import { FileText, FileUp, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  MAX_PDF_BYTES,
  ALLOWED_MIME,
  validatePdfFile,
} from "@/lib/briefing-gravacao/storage";
import { uploadRoteiroPdfAction } from "@/lib/briefing-gravacao/actions";

type Tipo = "link" | "pdf";

interface Props {
  eventoId: string | null; // null no create (upload acontece após criar)
  defaultTipo: Tipo | null;
  defaultLink: string | null;
  defaultPdfPath: string | null;
}

export function RoteiroToggle({
  eventoId,
  defaultTipo,
  defaultLink,
  defaultPdfPath,
}: Props) {
  const [tipo, setTipo] = useState<Tipo>(defaultTipo ?? "link");
  const [link, setLink] = useState(defaultLink ?? "");
  const [pdfPath, setPdfPath] = useState(defaultPdfPath ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setErro(null);
    const v = validatePdfFile({ size: file.size, type: file.type });
    if (!v.ok) {
      setErro(v.erro ?? "Arquivo invalido");
      return;
    }
    if (!eventoId) {
      setErro(
        "Salve o evento primeiro (sem roteiro) e edite depois pra anexar o PDF.",
      );
      return;
    }
    const fd = new FormData();
    fd.append("arquivo", file);
    startTransition(async () => {
      const r = await uploadRoteiroPdfAction(eventoId, fd);
      if ("error" in r) setErro(r.error);
      else setPdfPath(r.path);
    });
  }

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" /> Roteiro{" "}
        <span className="text-xs text-muted-foreground">(opcional)</span>
      </Label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipo("link")}
          className={`flex-1 rounded-md border px-3 py-1.5 text-sm ${
            tipo === "link"
              ? "border-primary bg-primary/10 text-primary"
              : "border-input text-muted-foreground hover:border-muted-foreground"
          }`}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => setTipo("pdf")}
          className={`flex-1 rounded-md border px-3 py-1.5 text-sm ${
            tipo === "pdf"
              ? "border-primary bg-primary/10 text-primary"
              : "border-input text-muted-foreground hover:border-muted-foreground"
          }`}
        >
          PDF
        </button>
      </div>

      {tipo === "link" && (
        <>
          <Input
            id="link_roteiro"
            name="link_roteiro"
            type="url"
            placeholder="https://docs.google.com/..."
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <input type="hidden" name="roteiro_tipo" value={link ? "link" : ""} />
          <input type="hidden" name="roteiro_pdf_path" value="" />
        </>
      )}

      {tipo === "pdf" && (
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_MIME}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          {pdfPath ? (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              <span className="flex-1 truncate font-mono text-xs">
                {pdfPath.split("/").pop()}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPdfPath("")}
                title="Remover anexo"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={pending || !eventoId}
              className="w-full"
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              {pending ? "Enviando..." : `Selecionar PDF (max ${MAX_PDF_BYTES / 1024 / 1024}MB)`}
            </Button>
          )}
          <input type="hidden" name="link_roteiro" value="" />
          <input type="hidden" name="roteiro_tipo" value={pdfPath ? "pdf" : ""} />
          <input type="hidden" name="roteiro_pdf_path" value={pdfPath} />
        </div>
      )}

      {erro && <p className="text-xs text-destructive">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Substituir o campo `link_roteiro` no `EventForm`**

Em `src/components/calendario/EventForm.tsx`, localizar o bloco existente com `<Label htmlFor="link_roteiro">` + `<Input id="link_roteiro" name="link_roteiro" defaultValue={defaults.link_roteiro ?? ""} />` e substituir por:

```tsx
<RoteiroToggle
  eventoId={defaults.id ?? null}
  defaultTipo={defaults.roteiro_tipo ?? null}
  defaultLink={defaults.link_roteiro ?? null}
  defaultPdfPath={defaults.roteiro_pdf_path ?? null}
/>
```

E adicionar nos imports do topo:

```ts
import { RoteiroToggle } from "./RoteiroToggle";
```

Atualizar o tipo `defaults` do `EventForm` pra incluir os 2 campos novos:

```ts
  roteiro_tipo: "link" | "pdf" | null;
  roteiro_pdf_path: string | null;
```

- [ ] **Step 3: Atualizar `getEventById` em queries**

Em `src/lib/calendario/queries.ts`, no `.select(...)` dentro de `getEventById`:

```ts
.select(`id, titulo, descricao, inicio, fim, sub_calendar, client_id, lead_id, criado_por, participantes_ids, localizacao_endereco, localizacao_maps_url, link_roteiro, observacoes_gravacao, roteiro_tipo, roteiro_pdf_path, videomaker_leu_em, briefing_gerado_em, videomaker_imprimiu_em`)
```

E no objeto retornado, adicionar:

```ts
roteiro_tipo: m.roteiro_tipo as "link" | "pdf" | null,
roteiro_pdf_path: m.roteiro_pdf_path,
videomaker_leu_em: m.videomaker_leu_em,
briefing_gerado_em: m.briefing_gerado_em,
videomaker_imprimiu_em: m.videomaker_imprimiu_em,
```

- [ ] **Step 4: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | grep -E "(EventForm|RoteiroToggle|calendario)" | head -10
npm run lint 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add src/components/calendario/RoteiroToggle.tsx src/components/calendario/EventForm.tsx src/lib/calendario/queries.ts src/lib/calendario/schema.ts
git commit -m "feat(briefing-gravacao): toggle Link/PDF no anexo do roteiro"
```

---

## Phase 6 — UI: confirmação + página de briefing

### Task 10: Componente `BriefingChecklist` (no card do videomaker)

**Files:**
- Create: `src/components/calendario/BriefingChecklist.tsx`

- [ ] **Step 1: Implementar**

```tsx
// src/components/calendario/BriefingChecklist.tsx
"use client";

import { useTransition } from "react";
import { Check, FileText, Printer, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  marcarLeuAction,
  marcarImprimiuAction,
  registrarBriefingGeradoAction,
} from "@/lib/briefing-gravacao/actions";

interface Props {
  eventoId: string;
  roteiroAbrirUrl: string; // URL externa OU signed URL do PDF
  jaLeu: boolean;
  jaImprimiu: boolean;
  /** Se true, mostra texto cinza explicando que falta produção anexar roteiro. */
  semRoteiro: boolean;
}

export function BriefingChecklist({
  eventoId,
  roteiroAbrirUrl,
  jaLeu,
  jaImprimiu,
  semRoteiro,
}: Props) {
  const [pendingLeu, startLeu] = useTransition();
  const [pendingImpr, startImpr] = useTransition();

  if (semRoteiro) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
        <p className="font-medium text-amber-700 dark:text-amber-300">
          Aguardando produção anexar o roteiro
        </p>
        <p className="mt-1 text-muted-foreground">
          Você não precisa fazer nada agora.
        </p>
      </div>
    );
  }

  function abrirRoteiroEMarcarLido() {
    window.open(roteiroAbrirUrl, "_blank", "noopener");
    startLeu(async () => {
      await marcarLeuAction(eventoId);
    });
  }

  function marcarLidoSemAbrir() {
    startLeu(async () => {
      await marcarLeuAction(eventoId);
    });
  }

  function gerarBriefing() {
    window.open(`/calendario/${eventoId}/briefing`, "_blank", "noopener");
    startImpr(async () => {
      await registrarBriefingGeradoAction(eventoId);
    });
  }

  function marcarImprimiuClick() {
    startImpr(async () => {
      await marcarImprimiuAction(eventoId);
    });
  }

  return (
    <div className="space-y-4">
      {/* Etapa 1: leitura */}
      <div className="rounded-md border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {jaLeu ? (
              <Check className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground text-xs font-bold text-muted-foreground">
                1
              </span>
            )}
            <span className={jaLeu ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}>
              Ler o roteiro
            </span>
          </div>
        </div>
        {!jaLeu && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={abrirRoteiroEMarcarLido} disabled={pendingLeu}>
              {pendingLeu ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Abrir roteiro
            </Button>
            <Button variant="ghost" size="sm" onClick={marcarLidoSemAbrir} disabled={pendingLeu}>
              Já li antes
            </Button>
          </div>
        )}
      </div>

      {/* Etapa 2: imprimir (só habilita após leitura) */}
      <div className={`rounded-md border p-4 ${!jaLeu ? "bg-muted/30 opacity-60" : "bg-card"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {jaImprimiu ? (
              <Check className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-muted-foreground text-xs font-bold text-muted-foreground">
                2
              </span>
            )}
            <span className={jaImprimiu ? "text-sm text-muted-foreground line-through" : "text-sm font-medium"}>
              Gerar e imprimir o briefing
            </span>
          </div>
        </div>
        {jaLeu && !jaImprimiu && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={gerarBriefing} variant="outline">
              <FileText className="mr-2 h-4 w-4" /> Gerar folha pra imprimir
            </Button>
            <Button onClick={marcarImprimiuClick} disabled={pendingImpr}>
              {pendingImpr ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
              Marquei como impresso
            </Button>
          </div>
        )}
      </div>

      {jaLeu && jaImprimiu && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          ✅ Pronto pra gravar
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep "BriefingChecklist" | head -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/calendario/BriefingChecklist.tsx
git commit -m "feat(briefing-gravacao): componente BriefingChecklist (etapas leu/imprimiu)"
```

---

### Task 11: Integrar `BriefingChecklist` na página de detalhe do evento + aplicar bloqueio

**Files:**
- Modify: `src/app/(authed)/calendario/[id]/page.tsx`

- [ ] **Step 1: Adicionar imports + helper no topo**

Adicionar abaixo dos imports existentes em `src/app/(authed)/calendario/[id]/page.tsx`:

```tsx
import { BriefingChecklist } from "@/components/calendario/BriefingChecklist";
import { getRoteiroSignedUrl } from "@/lib/briefing-gravacao/storage";

async function resolveRoteiroUrl(event: {
  roteiro_tipo: "link" | "pdf" | null;
  link_roteiro: string | null;
  roteiro_pdf_path: string | null;
}): Promise<string> {
  if (event.roteiro_tipo === "link" && event.link_roteiro) return event.link_roteiro;
  if (event.roteiro_tipo === "pdf" && event.roteiro_pdf_path) {
    const r = await getRoteiroSignedUrl(event.roteiro_pdf_path);
    if ("url" in r) return r.url;
  }
  return "#";
}
```

- [ ] **Step 2: Computar `roteiroUrl` antes do return JSX**

Logo após a linha `const isVideomaker = event.sub_calendar === "videomakers";`, adicionar:

```tsx
let roteiroUrl = "#";
if (!canEdit && isVideomaker && event.roteiro_tipo) {
  roteiroUrl = await resolveRoteiroUrl(event);
}
```

- [ ] **Step 3: Substituir o card do videomaker**

Localizar `{!canEdit && isVideomaker && (` (o card existente "Detalhes da gravação") e substituir todo o bloco JSX (incluindo o card de link_roteiro) por:

```tsx
{!canEdit && isVideomaker && (() => {
  const temRoteiro = !!event.roteiro_tipo;
  const jaLeu = !!event.videomaker_leu_em;
  const jaImprimiu = !!event.videomaker_imprimiu_em;
  const bloqueado = temRoteiro && !jaLeu;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 border-fuchsia-500/40 bg-fuchsia-500/5 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-700 dark:text-fuchsia-300">
          <Video className="h-4 w-4" />
          Detalhes da gravação
        </div>

        {bloqueado ? (
          <div className="rounded-md border border-fuchsia-500/30 bg-card p-4 text-sm">
            <p className="font-medium">Endereço bloqueado até você confirmar a leitura</p>
            <p className="mt-1 text-muted-foreground">
              Use o botão abaixo pra abrir o roteiro. O endereço e detalhes
              aparecem depois.
            </p>
          </div>
        ) : (
          <>
            {event.localizacao_endereco && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="space-y-0.5">
                  <div>{event.localizacao_endereco}</div>
                  {event.localizacao_maps_url && (
                    <a
                      href={event.localizacao_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Abrir no Google Maps <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            {event.observacoes_gravacao && (
              <div className="rounded-md bg-card p-3 text-sm whitespace-pre-wrap">
                {event.observacoes_gravacao}
              </div>
            )}
          </>
        )}
      </Card>

      <BriefingChecklist
        eventoId={event.id}
        roteiroAbrirUrl={roteiroUrl}
        jaLeu={jaLeu}
        jaImprimiu={jaImprimiu}
        semRoteiro={!temRoteiro}
      />
    </div>
  );
})()}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "\[id\]/page" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authed)/calendario/[id]/page.tsx"
git commit -m "feat(briefing-gravacao): bloqueio de endereco + checklist no card do videomaker"
```

---

### Task 12: Página print-friendly de briefing

**Files:**
- Create: `src/lib/briefing-gravacao/queries.ts`
- Create: `src/components/briefing/PrintButton.tsx`
- Create: `src/components/briefing/BriefingPrintView.tsx`
- Create: `src/app/(authed)/calendario/[id]/briefing/page.tsx`
- Create: `src/app/(authed)/calendario/[id]/briefing/layout.tsx`

- [ ] **Step 1: Instalar `qrcode`**

```bash
npm install qrcode && npm install -D @types/qrcode
```

- [ ] **Step 2: Helper de dados**

```ts
// src/lib/briefing-gravacao/queries.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRoteiroSignedUrl } from "./storage";
import type { BriefingPrintData } from "./tipos";

export async function getBriefingPrintData(
  eventoId: string,
  geradoPorNome: string,
): Promise<BriefingPrintData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("calendar_events")
    .select(
      `id, inicio, fim, localizacao_endereco, localizacao_maps_url, observacoes_gravacao,
       link_roteiro, roteiro_tipo, roteiro_pdf_path,
       clients ( nome )`,
    )
    .eq("id", eventoId)
    .single();

  if (!data) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;
  let roteiroUrl: string | null = null;
  if (d.roteiro_tipo === "link") roteiroUrl = d.link_roteiro;
  else if (d.roteiro_tipo === "pdf" && d.roteiro_pdf_path) {
    const r = await getRoteiroSignedUrl(d.roteiro_pdf_path);
    if ("url" in r) roteiroUrl = r.url;
  }

  return {
    eventoId: d.id,
    clienteNome: d.clients?.nome ?? null,
    inicio: d.inicio,
    fim: d.fim,
    endereco: d.localizacao_endereco,
    mapsUrl: d.localizacao_maps_url,
    observacoes: d.observacoes_gravacao,
    roteiroUrl,
    roteiroTipo: d.roteiro_tipo,
    geradoPorNome,
  };
}
```

- [ ] **Step 3: `PrintButton` (client component)**

```tsx
// src/components/briefing/PrintButton.tsx
"use client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="mr-2 h-4 w-4" /> Imprimir
    </Button>
  );
}
```

- [ ] **Step 4: `BriefingPrintView`** — usa QR code como PNG data URL (sem `dangerouslySetInnerHTML`, evita warning de XSS)

```tsx
// src/components/briefing/BriefingPrintView.tsx
import QRCode from "qrcode";
import type { BriefingPrintData } from "@/lib/briefing-gravacao/tipos";
import { PrintButton } from "./PrintButton";

interface Props {
  data: BriefingPrintData;
}

async function qrPngDataUrl(text: string): Promise<string> {
  // Render server-side como PNG base64 → <img src=...>. Mais seguro que
  // dangerouslySetInnerHTML com SVG (mesmo que o SVG do qrcode seja seguro,
  // evita warning do hook de segurança).
  return QRCode.toDataURL(text, { margin: 0, width: 280 });
}

function fmtData(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Cuiaba",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function BriefingPrintView({ data }: Props) {
  const qrDataUrl = data.mapsUrl ? await qrPngDataUrl(data.mapsUrl) : null;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="mx-auto max-w-[210mm] bg-white p-8 text-black print:p-0">
        <div className="no-print mb-4 flex justify-end">
          <PrintButton />
        </div>

        <header className="border-b-2 border-black pb-3">
          <h1 className="text-2xl font-bold">BRIEFING DE GRAVAÇÃO</h1>
          <p className="text-sm text-gray-600">Yide</p>
        </header>

        <section className="mt-5 space-y-2 text-sm">
          <div>
            <span className="font-semibold">Cliente:</span>{" "}
            {data.clienteNome ?? "—"}
          </div>
          <div>
            <span className="font-semibold">Data/Hora:</span> {fmtData(data.inicio)}
          </div>
          <div>
            <span className="font-semibold">Endereço:</span>{" "}
            {data.endereco ?? "(não informado)"}
          </div>
        </section>

        {qrDataUrl && (
          <section className="mt-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR code do Google Maps" width={140} height={140} />
            <p className="text-xs text-gray-700">
              Scaneie pra abrir o local no Google Maps
            </p>
          </section>
        )}

        {data.observacoes && (
          <section className="mt-6">
            <h2 className="border-b border-black text-sm font-bold uppercase">
              Observações da gravação
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
              {data.observacoes}
            </p>
          </section>
        )}

        <section className="mt-6">
          <h2 className="border-b border-black text-sm font-bold uppercase">
            Roteiro
          </h2>
          {data.roteiroUrl ? (
            <p className="mt-2 text-sm">
              {data.roteiroTipo === "pdf"
                ? "PDF do roteiro: "
                : "Roteiro em: "}
              <a
                href={data.roteiroUrl}
                className="break-all text-blue-700 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {data.roteiroUrl}
              </a>
            </p>
          ) : (
            <p className="mt-2 text-sm italic text-gray-600">
              (Sem roteiro anexado)
            </p>
          )}
        </section>

        <footer className="mt-10 border-t pt-3 text-xs text-gray-500">
          Gerado em {new Date().toLocaleString("pt-BR", { timeZone: "America/Cuiaba" })}{" "}
          por {data.geradoPorNome}
        </footer>
      </div>
    </>
  );
}
```

- [ ] **Step 5: Página `/calendario/[id]/briefing`**

```tsx
// src/app/(authed)/calendario/[id]/briefing/page.tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getBriefingPrintData } from "@/lib/briefing-gravacao/queries";
import { BriefingPrintView } from "@/components/briefing/BriefingPrintView";

export const dynamic = "force-dynamic";

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  const nome = user.nome ?? user.email ?? "Usuário";
  const data = await getBriefingPrintData(id, nome);
  if (!data) notFound();

  return <BriefingPrintView data={data} />;
}
```

- [ ] **Step 6: Layout enxuto pra rota de briefing**

```tsx
// src/app/(authed)/calendario/[id]/briefing/layout.tsx
//
// Sobrescreve o layout (authed) que renderiza sidebar + header. A página
// é só o conteúdo printável.
export default function BriefingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 7: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "briefing" | head -10
```

- [ ] **Step 8: Commit**

```bash
git add "src/app/(authed)/calendario/[id]/briefing" src/components/briefing src/lib/briefing-gravacao/queries.ts package.json package-lock.json
git commit -m "feat(briefing-gravacao): pagina print-friendly de briefing com QR code"
```

---

## Phase 7 — Status visível + configurações

### Task 13: Badge de status no `EventCell`

**Files:**
- Modify: `src/components/calendario/EventCell.tsx`
- Modify: `src/lib/calendario/queries.ts` (listEventsForWeek precisa carregar os campos)

- [ ] **Step 1: Adicionar campos no listEventsForWeek**

No `.select(...)` de `listEventsForWeek` (em `src/lib/calendario/queries.ts`), incluir:

```ts
roteiro_tipo, videomaker_leu_em, videomaker_imprimiu_em
```

E propagar no objeto retornado pelo mapeamento (assumir cast `as any` se os tipos ainda não foram regen).

⚠️ Cache key: bumpar a versão do `unstable_cache` na mesma queries.ts (ver MEMORY: "Cache key bump quando muda shape de dados"). Procurar por `tag: ["calendar-week-v..."]` (ou similar) e incrementar a versão.

- [ ] **Step 2: Adicionar badge no `EventCell`**

Em `src/components/calendario/EventCell.tsx`, na interface da prop do evento, adicionar:

```ts
roteiro_tipo?: "link" | "pdf" | null;
videomaker_leu_em?: string | null;
videomaker_imprimiu_em?: string | null;
```

E no JSX do card, dentro do bloco que renderiza pra `sub_calendar === "videomakers"` (ou no início do título), incluir:

```tsx
{event.sub_calendar === "videomakers" && (() => {
  const status = computaStatus({
    roteiro_tipo: event.roteiro_tipo ?? null,
    videomaker_leu_em: event.videomaker_leu_em ?? null,
    videomaker_imprimiu_em: event.videomaker_imprimiu_em ?? null,
  });
  const meta = {
    sem_roteiro: { bg: "bg-red-500", title: "Sem roteiro" },
    pendente: { bg: "bg-amber-500", title: "Briefing pendente" },
    pronto: { bg: "bg-emerald-500", title: "Pronto pra gravar" },
  }[status];
  return (
    <span
      className={`mr-1 inline-block h-2 w-2 rounded-full ${meta.bg}`}
      title={meta.title}
    />
  );
})()}
```

Import no topo:

```ts
import { computaStatus } from "@/lib/briefing-gravacao/status";
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "EventCell|queries" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add src/components/calendario/EventCell.tsx src/lib/calendario/queries.ts
git commit -m "feat(briefing-gravacao): badge de status no card do calendario"
```

---

### Task 14: Toggle opt-in pra alerta de 2h em `/configuracoes`

**Files:**
- Create: `src/lib/configuracoes/notif-gravacao-actions.ts`
- Create: `src/components/configuracoes/NotificacoesGravacaoToggle.tsx`
- Modify: `src/app/(authed)/configuracoes/page.tsx`

- [ ] **Step 1: Server action de toggle**

```ts
// src/lib/configuracoes/notif-gravacao-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function toggleAlertaGravacaoPendente(
  ativo: boolean,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireAuth();
  if (!["adm", "socio"].includes(user.role)) {
    return { error: "Sem permissao" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ notif_alerta_gravacao_pendente: ativo } as any)
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/configuracoes");
  return { ok: true };
}
```

- [ ] **Step 2: Verificar se existe `<Switch>` no UI kit**

```bash
ls src/components/ui/switch* 2>/dev/null
```

Se existir, usar `<Switch>`. Se não, no componente abaixo trocar `<Switch>` por `<input type="checkbox">` estilizado simples.

- [ ] **Step 3: Componente toggle**

```tsx
// src/components/configuracoes/NotificacoesGravacaoToggle.tsx
"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toggleAlertaGravacaoPendente } from "@/lib/configuracoes/notif-gravacao-actions";

interface Props {
  defaultAtivo: boolean;
}

export function NotificacoesGravacaoToggle({ defaultAtivo }: Props) {
  const [ativo, setAtivo] = useState(defaultAtivo);
  const [pending, start] = useTransition();

  function onChange(v: boolean) {
    setAtivo(v);
    start(async () => {
      const r = await toggleAlertaGravacaoPendente(v);
      if ("error" in r) {
        setAtivo(!v); // reverte em caso de erro
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-md border bg-card p-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">
          Alerta quando videomaker não confirmou gravação
        </Label>
        <p className="text-xs text-muted-foreground">
          Você recebe uma notificação quando faltam 2h pra uma gravação e o
          videomaker ainda não confirmou que leu e imprimiu o roteiro.
          Assessores e coordenadores audiovisuais recebem sempre — isso aqui é
          opt-in pra adm/sócio.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Switch checked={ativo} onCheckedChange={onChange} disabled={pending} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Renderizar em `/configuracoes`**

Em `src/app/(authed)/configuracoes/page.tsx`, dentro da função async do componente, garantir que `profile` seja buscado incluindo o campo novo:

```ts
const { data: profile } = await supabase
  .from("profiles")
  .select("..., notif_alerta_gravacao_pendente")
  .eq("id", user.id)
  .single();
```

E adicionar no JSX, em algum lugar lógico (após outras seções de configuração):

```tsx
{(user.role === "adm" || user.role === "socio") && (
  <section className="space-y-2">
    <h2 className="text-lg font-semibold">Notificações</h2>
    <NotificacoesGravacaoToggle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaultAtivo={(profile as any)?.notif_alerta_gravacao_pendente ?? true}
    />
  </section>
)}
```

Import:

```ts
import { NotificacoesGravacaoToggle } from "@/components/configuracoes/NotificacoesGravacaoToggle";
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "configuracoes|NotificacoesGravacao" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add src/components/configuracoes/NotificacoesGravacaoToggle.tsx src/lib/configuracoes/notif-gravacao-actions.ts "src/app/(authed)/configuracoes/page.tsx"
git commit -m "feat(briefing-gravacao): opt-in adm/socio pra alerta 2h em /configuracoes"
```

---

## Phase 8 — Cron de notificações

### Task 15: Detector + route + vercel.json (TDD do detector)

**Files:**
- Create: `src/lib/cron/detectors/gravacoes-pendentes.ts`
- Create: `src/app/api/cron/gravacoes-pendentes/route.ts`
- Create: `tests/unit/gravacoes-pendentes-detector.test.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Testes da lógica de janela (parte pura testável)**

```ts
// tests/unit/gravacoes-pendentes-detector.test.ts
import { describe, it, expect } from "vitest";
import { dentroDaJanela, calcMinutosAteInicio } from "@/lib/cron/detectors/gravacoes-pendentes";

describe("dentroDaJanela", () => {
  it("aceita 24h00 (centro da janela 24h)", () => {
    expect(dentroDaJanela(24 * 60, "24h")).toBe(true);
  });

  it("aceita 23h55 (borda inferior)", () => {
    expect(dentroDaJanela(23 * 60 + 55, "24h")).toBe(true);
  });

  it("aceita 24h05 (borda superior)", () => {
    expect(dentroDaJanela(24 * 60 + 5, "24h")).toBe(true);
  });

  it("rejeita 23h54 (fora por 1 min)", () => {
    expect(dentroDaJanela(23 * 60 + 54, "24h")).toBe(false);
  });

  it("rejeita 24h06 (fora por 1 min)", () => {
    expect(dentroDaJanela(24 * 60 + 6, "24h")).toBe(false);
  });

  it("janela 3h: aceita 2h55 a 3h05", () => {
    expect(dentroDaJanela(175, "3h")).toBe(true);
    expect(dentroDaJanela(185, "3h")).toBe(true);
    expect(dentroDaJanela(174, "3h")).toBe(false);
  });

  it("janela 2h: aceita 1h55 a 2h05", () => {
    expect(dentroDaJanela(115, "2h")).toBe(true);
    expect(dentroDaJanela(125, "2h")).toBe(true);
    expect(dentroDaJanela(126, "2h")).toBe(false);
  });
});

describe("calcMinutosAteInicio", () => {
  it("retorna positivo pra evento no futuro", () => {
    const now = new Date("2026-05-28T10:00:00Z");
    const inicio = "2026-05-28T13:00:00Z";
    expect(calcMinutosAteInicio(inicio, now)).toBe(180);
  });

  it("retorna negativo pra evento no passado", () => {
    const now = new Date("2026-05-28T10:00:00Z");
    const inicio = "2026-05-28T09:00:00Z";
    expect(calcMinutosAteInicio(inicio, now)).toBe(-60);
  });
});
```

- [ ] **Step 2: Rodar — falha por módulo não existir**

```bash
npm test -- gravacoes-pendentes-detector
```

- [ ] **Step 3: Implementar detector**

```ts
// src/lib/cron/detectors/gravacoes-pendentes.ts
//
// SERVER ONLY. Roda no cron de 5min. Pra cada gravação futura, decide
// se está na janela de notificação 24h / 3h / 2h / sem-roteiro e dispara
// via dispatchNotification (com idempotência por timestamp na linha).

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";

export type Janela = "24h" | "3h" | "2h";

const CENTROS: Record<Janela, number> = { "24h": 24 * 60, "3h": 3 * 60, "2h": 2 * 60 };
const TOLERANCIA_MIN = 5; // ±5 min em torno do centro

export function dentroDaJanela(minutosAteInicio: number, janela: Janela): boolean {
  const centro = CENTROS[janela];
  return Math.abs(minutosAteInicio - centro) <= TOLERANCIA_MIN;
}

export function calcMinutosAteInicio(inicioIso: string, now: Date): number {
  return Math.round((new Date(inicioIso).getTime() - now.getTime()) / 60000);
}

interface CounterShape {
  gravacao_pendente_24h: number;
  gravacao_pendente_3h: number;
  gravacao_alerta_2h: number;
  gravacao_sem_roteiro: number;
}

interface EventoRow {
  id: string;
  titulo: string;
  inicio: string;
  criado_por: string;
  participantes_ids: string[];
  roteiro_tipo: "link" | "pdf" | null;
  videomaker_leu_em: string | null;
  videomaker_imprimiu_em: string | null;
  notif_24h_enviada_em: string | null;
  notif_3h_enviada_em: string | null;
  notif_2h_alert_enviada_em: string | null;
  notif_sem_roteiro_enviada_em: string | null;
}

export async function detectGravacoesPendentes(
  counters: CounterShape,
  nowOverride?: Date,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const now = nowOverride ?? new Date();
  const lo = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
  const hi = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("calendar_events")
    .select(
      `id, titulo, inicio, criado_por, participantes_ids,
       roteiro_tipo, videomaker_leu_em, videomaker_imprimiu_em,
       notif_24h_enviada_em, notif_3h_enviada_em,
       notif_2h_alert_enviada_em, notif_sem_roteiro_enviada_em`,
    )
    .eq("sub_calendar", "videomakers")
    .gte("inicio", lo)
    .lt("inicio", hi);

  const eventos = (data ?? []) as EventoRow[];

  for (const e of eventos) {
    const mins = calcMinutosAteInicio(e.inicio, now);
    const pronto = !!(e.videomaker_leu_em && e.videomaker_imprimiu_em);

    // 24h videomaker
    if (
      dentroDaJanela(mins, "24h") &&
      !e.notif_24h_enviada_em &&
      !pronto &&
      e.roteiro_tipo !== null &&
      e.participantes_ids.length > 0
    ) {
      await dispatchNotification({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evento_tipo: "gravacao_pendente_24h" as any,
        titulo: `Em 24h: gravação ${e.titulo}`,
        mensagem: "Leia o roteiro e marque como impresso pra liberar o endereço.",
        link: `/calendario/${e.id}`,
        user_ids_extras: e.participantes_ids,
      });
      await marcarEnviada(supabase, e.id, "notif_24h_enviada_em");
      counters.gravacao_pendente_24h++;
    }

    // 3h videomaker
    if (
      dentroDaJanela(mins, "3h") &&
      !e.notif_3h_enviada_em &&
      !pronto &&
      e.roteiro_tipo !== null &&
      e.participantes_ids.length > 0
    ) {
      await dispatchNotification({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evento_tipo: "gravacao_pendente_3h" as any,
        titulo: `Em 3h: gravação ${e.titulo}`,
        mensagem: "Última chance de ler e imprimir antes da gravação.",
        link: `/calendario/${e.id}`,
        user_ids_extras: e.participantes_ids,
      });
      await marcarEnviada(supabase, e.id, "notif_3h_enviada_em");
      counters.gravacao_pendente_3h++;
    }

    // 2h alerta produção
    if (
      dentroDaJanela(mins, "2h") &&
      !e.notif_2h_alert_enviada_em &&
      !pronto &&
      e.roteiro_tipo !== null
    ) {
      const optInIds = await getAdmSocioOptInIds(supabase);
      const extras = Array.from(
        new Set([e.criado_por, ...optInIds].filter(Boolean)),
      );
      await dispatchNotification({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evento_tipo: "gravacao_alerta_2h" as any,
        titulo: `Alerta: gravação ${e.titulo} em 2h sem confirmação`,
        mensagem: `O videomaker ainda não confirmou leitura/impressão. Hora ${fmtHora(e.inicio)}.`,
        link: `/calendario/${e.id}`,
        user_ids_extras: extras,
      });
      await marcarEnviada(supabase, e.id, "notif_2h_alert_enviada_em");
      counters.gravacao_alerta_2h++;
    }

    // 24h sem roteiro
    if (
      dentroDaJanela(mins, "24h") &&
      !e.notif_sem_roteiro_enviada_em &&
      e.roteiro_tipo === null
    ) {
      await dispatchNotification({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        evento_tipo: "gravacao_sem_roteiro" as any,
        titulo: `Gravação ${e.titulo} amanhã sem roteiro`,
        mensagem: "Anexe o link ou PDF do roteiro pra liberar a leitura do videomaker.",
        link: `/calendario/${e.id}`,
        user_ids_extras: [e.criado_por],
      });
      await marcarEnviada(supabase, e.id, "notif_sem_roteiro_enviada_em");
      counters.gravacao_sem_roteiro++;
    }
  }
}

async function marcarEnviada(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  eventoId: string,
  campo: string,
): Promise<void> {
  await supabase
    .from("calendar_events")
    .update({ [campo]: new Date().toISOString() })
    .eq("id", eventoId)
    .is(campo, null);
}

async function getAdmSocioOptInIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<string[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["adm", "socio"])
    .eq("notif_alerta_gravacao_pendente", true);
  return (data ?? []).map((r: { id: string }) => r.id);
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  });
}
```

- [ ] **Step 4: Rodar testes — devem passar**

```bash
npm test -- gravacoes-pendentes-detector
```

- [ ] **Step 5: Route do cron**

```ts
// src/app/api/cron/gravacoes-pendentes/route.ts
import { NextResponse } from "next/server";
import { detectGravacoesPendentes } from "@/lib/cron/detectors/gravacoes-pendentes";

export const dynamic = "force-dynamic";

/**
 * Roda a cada 5 min (Vercel cron "*\/5 * * * *").
 * Idempotência por evento via colunas notif_*_enviada_em.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counters = {
    gravacao_pendente_24h: 0,
    gravacao_pendente_3h: 0,
    gravacao_alerta_2h: 0,
    gravacao_sem_roteiro: 0,
  };
  try {
    await detectGravacoesPendentes(counters);
  } catch (e) {
    console.error("[gravacoes-pendentes] failure:", e);
    return NextResponse.json({ error: "internal", counters }, { status: 500 });
  }

  return NextResponse.json({ counters, ran_at: new Date().toISOString() });
}
```

- [ ] **Step 6: Registrar em `vercel.json`**

Adicionar uma entrada na array `crons`:

```json
{ "path": "/api/cron/gravacoes-pendentes", "schedule": "*/5 * * * *" }
```

- [ ] **Step 7: Typecheck + lint**

```bash
npx tsc --noEmit 2>&1 | grep -E "cron|gravacoes" | head -10
npm run lint 2>&1 | tail -10
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/cron/detectors/gravacoes-pendentes.ts src/app/api/cron/gravacoes-pendentes/route.ts tests/unit/gravacoes-pendentes-detector.test.ts vercel.json
git commit -m "feat(briefing-gravacao): cron 5min com notif 24h/3h/2h/sem-roteiro"
```

---

## Phase 9 — Verificação final

### Task 16: Suite completa + lint + build

**Files:** nenhum

- [ ] **Step 1: Rodar todos os testes**

```bash
npm test 2>&1 | tail -20
```

Esperado: 0 falhas. Se algum teste pré-existente falhar por causa das mudanças (ex: shape do CalendarEvent), corrigir o teste.

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | tail -30
```

Esperado: 0 erros. Warnings de `@typescript-eslint/no-explicit-any` em `as any` são esperados nos campos novos (tipos só regeram depois do migration).

- [ ] **Step 3: Build**

```bash
npm run build 2>&1 | tail -30
```

Esperado: build OK. Atenção pra erros de Server Action types ou imports server-only contaminados em client component.

- [ ] **Step 4: Se tudo passou, não commitar nada** — segue pro PR.

---

### Task 17: PR

**Files:** nenhum

- [ ] **Step 1: Confirmar diff**

```bash
git log --oneline origin/main..HEAD
git diff --stat origin/main..HEAD
```

- [ ] **Step 2: Push da branch**

```bash
git push -u origin feat/briefing-gravacao
```

- [ ] **Step 3: Abrir PR**

```bash
gh pr create --title "feat: briefing & confirmacao de gravacao pelo videomaker" --body "$(cat <<'EOF'
## Summary
- Toggle Link/PDF no anexo do roteiro (upload PDF no bucket `roteiros`)
- Card do videomaker em `/calendario/[id]` bloqueia endereço/Maps até confirmar leitura
- Botão "Gerar folha pra imprimir" abre `/calendario/[id]/briefing` (página A4 print-friendly com QR code do Maps)
- Cron a cada 5min: notificações pro videomaker em 24h e 3h se pendente; alerta em 2h pro assessor criador + audiovisual_chefe (mandatórios) + adm/sócio (opt-in); alerta 24h pro criador+chefe se sem roteiro
- Badge vermelho/amarelo/verde no card da semana pro coord enxergar status

## Spec
docs/superpowers/specs/2026-05-27-briefing-gravacao-design.md

## Test plan
- [ ] Aplicar migration `20260528000000_briefing_gravacao.sql` no Supabase via SQL Editor
- [ ] Regenerar tipos: `npm run db:types` (ou comando equivalente do projeto)
- [ ] Subir uma gravação de teste daqui a 24h sem confirmar nada → checar notif na hora exata
- [ ] Criar gravação sem roteiro → 24h antes recebe notif "anexar roteiro"
- [ ] Logado como videomaker designado: abrir evento e tentar acessar endereço sem ler → bloqueado
- [ ] Clicar "Abrir roteiro" → libera endereço, marca timestamp
- [ ] Clicar "Gerar folha" → abre página de briefing em nova aba, vê capa + QR + link
- [ ] Marcar "Imprimi" → badge no calendário vira verde
- [ ] Configurações: desligar opt-in (logado como adm) → não recebe mais alerta de 2h
EOF
)"
```

- [ ] **Step 4: Reportar URL do PR pra Yasmin.**

---

## Lembretes pós-merge (pra Yasmin)

1. Aplicar a migration `20260528000000_briefing_gravacao.sql` no Supabase via SQL Editor
2. Rodar `npm run db:types` pra regerar `src/types/database.ts` (e abrir PR de limpeza dos `as any`)
3. O cron novo herda `CRON_SECRET` existente — sem mudança de env
