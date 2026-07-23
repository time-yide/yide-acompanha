# Reuniões — Fatia 1 (Gravar + Guardar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir gravar uma reunião de cliente (presencial ou online) pelo navegador, guardar o áudio no sistema e ver/ouvir no cadastro do cliente e na lista central `/reunioes` — sem transcrição ainda (Fatia 2).

**Architecture:** Reusa o módulo `reunioes` já existente (schema SQL pronto, UI shell). Grava no browser com `MediaRecorder` (mic + opcional áudio da aba via `getDisplayMedia`), sobe o `.webm` direto pro bucket privado `meeting-recordings` via URL assinada (padrão idêntico ao Editor IA), e registra linhas em `meetings` + `meeting_recordings`. As queries trocam mock por Supabase service-role com regra de visibilidade (dono + gestão). Sem cache per-user (dado é por usuário).

**Tech Stack:** Next.js (App Router), Supabase (service-role + Storage signed upload), TypeScript, vitest, Tailwind, lucide-react, browser MediaRecorder + Web Audio API.

---

## Pré-requisitos (fora do plano de código)

As migrations base do módulo **ainda não foram aplicadas**. Antes de tudo, aplicar no SQL Editor, nesta ordem:
1. `supabase/migrations/20260513000000_reunioes_fase1.sql` (tabelas base)
2. `supabase/migrations/20260515000000_reunioes_retencao.sql` (retenção)
3. A migration nova criada na Task 1 abaixo.

Depois: `npm run db:types` pra regenerar `src/types/database.ts`.

## File Structure

- Create: `supabase/migrations/20260723000000_reunioes_app_recording.sql` — enum `app_recording` + bucket `meeting-recordings` + storage policies.
- Create: `src/lib/reunioes/permissions.ts` — quem grava / quem vê. Fonte única.
- Create: `src/lib/reunioes/permissions.test.ts` — testes.
- Create: `src/lib/reunioes/storage.ts` — path + signed upload + signed playback + remove.
- Create: `src/lib/reunioes/storage.test.ts` — teste do path builder.
- Create: `src/lib/reunioes/gravacao-actions.ts` — server actions criar/registrar gravação.
- Modify: `src/lib/reunioes/queries.ts` — trocar mock por Supabase real + visibilidade + `listMeetingsForClient`.
- Create: `src/lib/reunioes/queries.test.ts` — teste do mapper puro.
- Create: `src/components/reunioes/GravadorReuniao.tsx` — botão + captura + upload.
- Modify: `src/app/(authed)/clientes/[id]/reunioes/page.tsx` — lista de gravações + botão gravar (mantém notas).
- Modify: `src/app/(authed)/reunioes/page.tsx` — libera roles + usa dados reais.

---

### Task 1: Migration (enum `app_recording` + bucket + policies)

**Files:**
- Create: `supabase/migrations/20260723000000_reunioes_app_recording.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/20260723000000_reunioes_app_recording.sql
--
-- Fatia 1 do "Reuniões gravadas do cliente": grava pelo app (navegador).
-- Aplicação MANUAL no SQL Editor, DEPOIS de aplicar as migrations
-- 20260513000000_reunioes_fase1.sql e 20260515000000_reunioes_retencao.sql.

-- 1) Novo source: gravação feita pelo próprio app.
alter type public.meeting_source add value if not exists 'app_recording';

-- 2) Bucket privado pros áudios das reuniões.
insert into storage.buckets (id, name, public)
values ('meeting-recordings', 'meeting-recordings', false)
on conflict (id) do nothing;

-- 3) Policies de Storage: o app sobe/lê via service-role (bypassa RLS), mas
--    o upload direto do browser usa URL assinada (uploadToSignedUrl), que não
--    exige policy de INSERT pra usuário. Mantemos o bucket privado sem policies
--    públicas — acesso só via service-role/URL assinada.
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260723000000_reunioes_app_recording.sql
git commit -m "feat(reunioes): migration app_recording + bucket meeting-recordings"
```

---

### Task 2: Permissions (quem grava / quem vê)

**Files:**
- Create: `src/lib/reunioes/permissions.ts`
- Test: `src/lib/reunioes/permissions.test.ts`

- [ ] **Step 1: Escrever o teste**

```ts
// src/lib/reunioes/permissions.test.ts
import { describe, it, expect } from "vitest";
import { canRecordMeeting, podeVerReuniao } from "./permissions";

describe("canRecordMeeting", () => {
  it("libera assessor, coordenador, comercial, socio, adm", () => {
    for (const r of ["assessor", "coordenador", "comercial", "socio", "adm"]) {
      expect(canRecordMeeting(r)).toBe(true);
    }
  });
  it("bloqueia videomaker/designer/programacao", () => {
    for (const r of ["videomaker", "designer", "programacao"]) {
      expect(canRecordMeeting(r)).toBe(false);
    }
  });
});

describe("podeVerReuniao", () => {
  const meeting = { owner_user_id: "u1" };
  it("dono vê a própria", () => {
    expect(podeVerReuniao({ id: "u1", role: "assessor" }, meeting)).toBe(true);
  });
  it("assessor não vê reunião de outro dono", () => {
    expect(podeVerReuniao({ id: "u2", role: "assessor" }, meeting)).toBe(false);
  });
  it("gestão (socio/adm/coordenador) vê qualquer uma", () => {
    for (const role of ["socio", "adm", "coordenador"]) {
      expect(podeVerReuniao({ id: "uX", role }, meeting)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/reunioes/permissions.test.ts`
Expected: FAIL ("canRecordMeeting is not a function" / módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// src/lib/reunioes/permissions.ts
// Fonte única de permissões do módulo Reuniões.

/** Roles que podem INICIAR uma gravação de reunião de cliente. */
export const RECORD_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"] as const;

/** Roles de gestão que veem QUALQUER reunião. */
export const MANAGEMENT_ROLES = ["adm", "socio", "coordenador"] as const;

export function canRecordMeeting(role: string): boolean {
  return (RECORD_ROLES as readonly string[]).includes(role);
}

/**
 * Visibilidade: dono (quem gravou) OU gestão. Assessor não vê reunião de
 * cliente de outro assessor.
 */
export function podeVerReuniao(
  user: { id: string; role: string },
  meeting: { owner_user_id: string },
): boolean {
  if (user.id === meeting.owner_user_id) return true;
  return (MANAGEMENT_ROLES as readonly string[]).includes(user.role);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/reunioes/permissions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reunioes/permissions.ts src/lib/reunioes/permissions.test.ts
git commit -m "feat(reunioes): permissões de gravar/ver reunião"
```

---

### Task 3: Storage helper

**Files:**
- Create: `src/lib/reunioes/storage.ts`
- Test: `src/lib/reunioes/storage.test.ts`

- [ ] **Step 1: Escrever o teste do path builder**

```ts
// src/lib/reunioes/storage.test.ts
import { describe, it, expect } from "vitest";
import { recordingPath } from "./storage";

describe("recordingPath", () => {
  it("monta org/cliente/meeting/audio.<ext>", () => {
    expect(recordingPath("org1", "cli1", "meet1", "webm")).toBe("org1/cli1/meet1/audio.webm");
  });
  it("cai pra webm se ext vazia", () => {
    expect(recordingPath("o", "c", "m", "")).toBe("o/c/m/audio.webm");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/reunioes/storage.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

```ts
// src/lib/reunioes/storage.ts
// SERVER ONLY — storage das gravações de reunião (bucket meeting-recordings).
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const BUCKET = "meeting-recordings";

export function recordingPath(orgId: string, clientId: string, meetingId: string, ext: string): string {
  const safeExt = (ext || "webm").toLowerCase().replace(/[^a-z0-9]/g, "") || "webm";
  return `${orgId}/${clientId}/${meetingId}/audio.${safeExt}`;
}

/** Gera URL assinada de upload (browser sobe direto via uploadToSignedUrl). */
export async function createSignedUpload(
  path: string,
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Falha ao gerar upload" };
  return { ok: true, path, token: data.token };
}

/** URL assinada pra tocar o áudio (privado). */
export async function getSignedPlaybackUrl(path: string, expiresInSeconds = 3600): Promise<string | null> {
  const sb = createServiceRoleClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function removeRecording(path: string): Promise<void> {
  const sb = createServiceRoleClient();
  await sb.storage.from(BUCKET).remove([path]);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/reunioes/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/reunioes/storage.ts src/lib/reunioes/storage.test.ts
git commit -m "feat(reunioes): storage helper do bucket meeting-recordings"
```

---

### Task 4: Queries reais (trocar mock por Supabase + visibilidade)

**Files:**
- Modify: `src/lib/reunioes/queries.ts` (reescrever)
- Test: `src/lib/reunioes/queries.test.ts` (mapper puro)

- [ ] **Step 1: Escrever o teste do mapper**

```ts
// src/lib/reunioes/queries.test.ts
import { describe, it, expect } from "vitest";
import { mapMeetingRow } from "./queries";

describe("mapMeetingRow", () => {
  it("mapeia row do supabase pra MeetingListItem", () => {
    const row = {
      id: "m1", titulo: "Kickoff", status: "completed", source: "app_recording",
      starts_at: "2026-07-20T10:00:00Z", ends_at: "2026-07-20T11:00:00Z",
      duracao_segundos: 3600, owner_user_id: "u1",
      recording_ready: true, transcript_ready: false, summary_ready: false, insights_ready: false,
      lead_id: null, client_id: "c1", tags: ["kickoff"],
      owner: { nome: "Duxx", avatar_url: null },
      client: { nome: "Centra MT" },
    };
    const item = mapMeetingRow(row);
    expect(item.id).toBe("m1");
    expect(item.owner_nome).toBe("Duxx");
    expect(item.client_nome).toBe("Centra MT");
    expect(item.recording_ready).toBe(true);
    expect(item.participantes_count).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/reunioes/queries.test.ts`
Expected: FAIL (`mapMeetingRow` não exportado).

- [ ] **Step 3: Reescrever `queries.ts`**

Substituir TODO o conteúdo por:

```ts
// Queries do módulo Reuniões — dados reais (Supabase service-role).
// SEM unstable_cache: a lista é filtrada por usuário (visibilidade), não pode
// ir pra cache compartilhado (ver memória "dados per-usuário fora do cache").

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { podeVerReuniao, MANAGEMENT_ROLES } from "./permissions";
import type { MeetingDetail, MeetingListItem, MeetingStatus } from "./tipos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export const MEETINGS_CACHE_TAG = "meetings" as const;

const SELECT_LIST = `
  id, titulo, status, source, starts_at, ends_at, duracao_segundos, owner_user_id,
  recording_ready, transcript_ready, summary_ready, insights_ready,
  lead_id, client_id, tags,
  owner:profiles!meetings_owner_user_id_fkey ( nome, avatar_url ),
  client:clients ( nome )
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapMeetingRow(r: any): MeetingListItem {
  return {
    id: r.id,
    titulo: r.titulo,
    status: r.status as MeetingStatus,
    source: r.source,
    starts_at: r.starts_at,
    ends_at: r.ends_at ?? null,
    duracao_segundos: r.duracao_segundos ?? null,
    owner_user_id: r.owner_user_id,
    owner_nome: r.owner?.nome ?? "—",
    owner_avatar: r.owner?.avatar_url ?? null,
    participantes_count: 0,
    participantes_preview: [],
    recording_ready: !!r.recording_ready,
    transcript_ready: !!r.transcript_ready,
    summary_ready: !!r.summary_ready,
    insights_ready: !!r.insights_ready,
    lead_id: r.lead_id ?? null,
    lead_nome: null,
    client_id: r.client_id ?? null,
    client_nome: r.client?.nome ?? null,
    tags: r.tags ?? [],
    resumo_preview: null,
    tasks_geradas_count: 0,
  };
}

export interface ListMeetingsFilter {
  status?: MeetingStatus | "todos";
  searchQuery?: string;
  clientId?: string;
}

/** Lista reuniões visíveis pro usuário (dono + gestão). */
export async function listMeetings(
  user: { id: string; role: string },
  filter: ListMeetingsFilter = {},
): Promise<MeetingListItem[]> {
  const sb = createServiceRoleClient() as SB;
  let q = sb.from("meetings").select(SELECT_LIST).is("deleted_at", null).order("starts_at", { ascending: false });

  // Visibilidade: gestão vê tudo; demais só as próprias (owner).
  if (!(MANAGEMENT_ROLES as readonly string[]).includes(user.role)) {
    q = q.eq("owner_user_id", user.id);
  }
  if (filter.status && filter.status !== "todos") q = q.eq("status", filter.status);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);

  const { data } = await q;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = ((data ?? []) as any[]).map(mapMeetingRow);
  if (filter.searchQuery?.trim()) {
    const s = filter.searchQuery.trim().toLowerCase();
    rows = rows.filter((m) => m.titulo.toLowerCase().includes(s) || (m.client_nome ?? "").toLowerCase().includes(s));
  }
  return rows;
}

/** Reuniões de um cliente específico (respeitando visibilidade). */
export async function listMeetingsForClient(
  user: { id: string; role: string },
  clientId: string,
): Promise<MeetingListItem[]> {
  return listMeetings(user, { clientId });
}

/** Detalhe. Na Fatia 1 traz só o essencial + recording; transcript/summary vêm null. */
export async function getMeetingById(
  user: { id: string; role: string },
  id: string,
): Promise<MeetingDetail | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: r } = await sb.from("meetings").select(SELECT_LIST + ", descricao, external_url").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!r) return null;
  if (!podeVerReuniao(user, { owner_user_id: r.owner_user_id })) return null;

  const base = mapMeetingRow(r);
  const { data: rec } = await sb.from("meeting_recordings").select("id, audio_url, video_url, duracao_segundos, size_bytes, formato, provider").eq("meeting_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();

  return {
    ...base,
    descricao: r.descricao ?? null,
    external_url: r.external_url ?? null,
    participantes: [],
    recording: rec
      ? { id: rec.id, audio_url: rec.audio_url ?? null, video_url: rec.video_url ?? null, duracao_segundos: rec.duracao_segundos ?? null, size_bytes: rec.size_bytes ?? null, formato: rec.formato ?? null, provider: rec.provider ?? null }
      : null,
    transcript: null,
    summary: null,
    extracted_tasks: [],
    processing_jobs: [],
  };
}
```

- [ ] **Step 4: Rodar teste do mapper**

Run: `npx vitest run src/lib/reunioes/queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Remover mock e ajustar chamadas**

Deletar `src/lib/reunioes/mock-data.ts` e remover `getMeetingMetrics`/`getGoogleConnection` do arquivo se ninguém mais usa; senão, ajustar `getMeetingMetrics` pra receber `user` e usar a nova `listMeetings(user)`. Verificar imports quebrados:

Run: `npx tsc --noEmit 2>&1 | grep -i reunioes | head`
Expected: corrigir cada erro apontado (páginas que chamam `listMeetings()`/`getMeetingById()` sem `user` — passar `user`). Ver Tasks 8 e 9.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reunioes/queries.ts src/lib/reunioes/queries.test.ts
git rm src/lib/reunioes/mock-data.ts
git commit -m "feat(reunioes): queries reais com visibilidade (sem mock)"
```

---

### Task 5: Server actions (criar + registrar gravação)

**Files:**
- Create: `src/lib/reunioes/gravacao-actions.ts`

- [ ] **Step 1: Implementar as actions**

```ts
// src/lib/reunioes/gravacao-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { canRecordMeeting } from "./permissions";
import { recordingPath, createSignedUpload } from "./storage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Res<T> = T | { error: string };

/**
 * Cria a reunião (source app_recording, status in_progress) e devolve os dados
 * de upload assinado pro browser subir o áudio direto no bucket.
 */
export async function criarReuniaoGravacaoAction(input: {
  clientId: string;
  titulo: string;
  consentiu: boolean;
  online: boolean;
}): Promise<Res<{ meetingId: string; path: string; token: string }>> {
  const user = await requireAuth();
  if (!canRecordMeeting(user.role)) return { error: "Sem permissão pra gravar reunião" };
  if (!input.consentiu) return { error: "É preciso confirmar o aviso de gravação (LGPD)" };
  if (!input.clientId) return { error: "Escolha o cliente" };

  const sb = createServiceRoleClient() as SB;
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();
  if (!org) return { error: "Organização não encontrada" };

  const titulo = input.titulo.trim() || `Reunião ${new Date().toLocaleDateString("pt-BR")}`;
  const { data: mt, error } = await sb
    .from("meetings")
    .insert({
      organization_id: org.id,
      owner_user_id: user.id,
      client_id: input.clientId,
      source: "app_recording",
      status: "in_progress",
      titulo,
      starts_at: new Date().toISOString(),
      descricao: input.online ? "Gravada online (áudio da aba + microfone)" : "Gravada presencial (microfone)",
    })
    .select("id")
    .single();
  if (error || !mt) return { error: "Falha ao criar a reunião" };

  const path = recordingPath(org.id, input.clientId, mt.id, "webm");
  const up = await createSignedUpload(path);
  if (!up.ok) return { error: up.error };
  return { meetingId: mt.id, path: up.path, token: up.token };
}

/**
 * Registra a gravação após o upload: cria meeting_recordings, marca
 * recording_ready e fecha o meeting como 'completed' (Fatia 1 não transcreve;
 * a Fatia 2 troca isso por enfileirar transcrição + status 'processing').
 */
export async function registrarGravacaoAction(input: {
  meetingId: string;
  path: string;
  sizeBytes: number;
  duracaoSeg: number;
  formato: string;
}): Promise<Res<{ ok: true }>> {
  const user = await requireAuth();
  if (!canRecordMeeting(user.role)) return { error: "Sem permissão" };
  const sb = createServiceRoleClient() as SB;

  // Só o dono registra a própria gravação.
  const { data: mt } = await sb.from("meetings").select("id, owner_user_id, client_id").eq("id", input.meetingId).maybeSingle();
  if (!mt || mt.owner_user_id !== user.id) return { error: "Reunião não encontrada" };

  await sb.from("meeting_recordings").insert({
    meeting_id: input.meetingId,
    audio_url: input.path, // guarda o PATH do storage (view de retenção usa audio_url as storage_path)
    duracao_segundos: Math.round(input.duracaoSeg) || null,
    size_bytes: input.sizeBytes || null,
    formato: input.formato || "webm",
    captured_at: new Date().toISOString(),
    provider: "manual",
  });

  await sb.from("meetings").update({
    status: "completed",
    recording_ready: true,
    duracao_segundos: Math.round(input.duracaoSeg) || null,
    ends_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", input.meetingId);

  revalidatePath(`/clientes/${mt.client_id}/reunioes`);
  revalidatePath("/reunioes");
  return { ok: true };
}

/** URL assinada pra tocar o áudio de uma reunião (checa visibilidade). */
export async function urlAudioReuniaoAction(meetingId: string): Promise<Res<{ url: string }>> {
  const { podeVerReuniao } = await import("./permissions");
  const { getSignedPlaybackUrl } = await import("./storage");
  const user = await requireAuth();
  const sb = createServiceRoleClient() as SB;
  const { data: mt } = await sb.from("meetings").select("owner_user_id").eq("id", meetingId).maybeSingle();
  if (!mt || !podeVerReuniao(user, { owner_user_id: mt.owner_user_id })) return { error: "Sem acesso" };
  const { data: rec } = await sb.from("meeting_recordings").select("audio_url").eq("meeting_id", meetingId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!rec?.audio_url) return { error: "Sem gravação" };
  const url = await getSignedPlaybackUrl(rec.audio_url);
  if (!url) return { error: "Falha ao gerar link" };
  return { url };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -i gravacao-actions | head`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reunioes/gravacao-actions.ts
git commit -m "feat(reunioes): server actions criar/registrar gravação"
```

---

### Task 6: Componente Gravador (browser)

**Files:**
- Create: `src/components/reunioes/GravadorReuniao.tsx`

- [ ] **Step 1: Implementar o componente**

```tsx
// src/components/reunioes/GravadorReuniao.tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, Square, Loader2, Video, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { criarReuniaoGravacaoAction, registrarGravacaoAction } from "@/lib/reunioes/gravacao-actions";

type Modo = "presencial" | "online";

export function GravadorReuniao({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<Modo>("presencial");
  const [titulo, setTitulo] = useState("");
  const [consentiu, setConsentiu] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [pending, start] = useTransition();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inicioRef = useRef<number>(0);

  function pararTudo() {
    if (timerRef.current) clearInterval(timerRef.current);
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    streamsRef.current = [];
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }

  async function iniciar() {
    if (!consentiu) { toast.error("Confirme o aviso de gravação (LGPD)."); return; }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamsRef.current.push(mic);

      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(mic).connect(dest);

      if (modo === "online") {
        // Captura o áudio da aba (a pessoa escolhe a aba do Meet + marca "compartilhar áudio").
        const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        streamsRef.current.push(disp);
        disp.getVideoTracks().forEach((t) => t.stop()); // só queremos o áudio
        if (disp.getAudioTracks().length === 0) {
          toast.error("Não veio áudio da aba. Ao compartilhar, marque 'Compartilhar áudio da guia'.");
          pararTudo();
          return;
        }
        ctx.createMediaStreamSource(disp).connect(dest);
      }

      chunksRef.current = [];
      const rec = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => void finalizar();
      rec.start(1000);
      recorderRef.current = rec;

      inicioRef.current = Date.now();
      setSegundos(0);
      timerRef.current = setInterval(() => setSegundos(Math.round((Date.now() - inicioRef.current) / 1000)), 1000);
      setGravando(true);
    } catch (e) {
      toast.error("Não consegui acessar o áudio: " + (e instanceof Error ? e.message : "erro"));
      pararTudo();
    }
  }

  function parar() {
    recorderRef.current?.stop();
    setGravando(false);
    pararTudo();
  }

  async function finalizar() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    const duracao = Math.round((Date.now() - inicioRef.current) / 1000);
    if (blob.size === 0) { toast.error("Gravação vazia."); return; }

    start(async () => {
      const r = await criarReuniaoGravacaoAction({ clientId, titulo, consentiu: true, online: modo === "online" });
      if ("error" in r) { toast.error(r.error); return; }

      const supabase = createClient();
      const file = new File([blob], "audio.webm", { type: "audio/webm" });
      const { error: upErr } = await supabase.storage.from("meeting-recordings").uploadToSignedUrl(r.path, r.token, file);
      if (upErr) { toast.error("Falha no upload: " + upErr.message); return; }

      const reg = await registrarGravacaoAction({ meetingId: r.meetingId, path: r.path, sizeBytes: blob.size, duracaoSeg: duracao, formato: "webm" });
      if ("error" in reg) { toast.error(reg.error); return; }

      toast.success("Reunião gravada e guardada!");
      setAberto(false); setTitulo(""); setConsentiu(false); setSegundos(0);
      router.refresh();
    });
  }

  const mmss = `${String(Math.floor(segundos / 60)).padStart(2, "0")}:${String(segundos % 60).padStart(2, "0")}`;

  if (!aberto) {
    return (
      <Button type="button" onClick={() => setAberto(true)} size="sm">
        <Mic className="mr-2 h-4 w-4" /> Gravar reunião
      </Button>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {!gravando ? (
        <>
          <div className="flex gap-2">
            <button type="button" onClick={() => setModo("presencial")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${modo === "presencial" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              <MapPin className="mr-1 inline h-4 w-4" /> Presencial
            </button>
            <button type="button" onClick={() => setModo("online")} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${modo === "online" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              <Video className="mr-1 inline h-4 w-4" /> Online
            </button>
          </div>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (opcional)" className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          {modo === "online" && (
            <p className="rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
              No computador (Chrome/Edge): ao começar, escolha a <b>aba do Meet</b> e marque <b>“Compartilhar áudio da guia”</b>.
            </p>
          )}
          <label className="flex items-start gap-2 text-xs">
            <input type="checkbox" checked={consentiu} onChange={(e) => setConsentiu(e.target.checked)} className="mt-0.5" />
            <span>Os participantes foram avisados de que a reunião está sendo gravada.</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="button" size="sm" onClick={iniciar} disabled={!consentiu || pending}>
              <Mic className="mr-2 h-4 w-4" /> Começar a gravar
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> Gravando {mmss}
          </span>
          <Button type="button" size="sm" variant="destructive" onClick={parar} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />} Parar
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -i GravadorReuniao; npx eslint src/components/reunioes/GravadorReuniao.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/reunioes/GravadorReuniao.tsx
git commit -m "feat(reunioes): componente Gravador (mic + áudio da aba) com upload"
```

---

### Task 7: Aba Reuniões do cliente (lista + botão gravar)

**Files:**
- Modify: `src/app/(authed)/clientes/[id]/reunioes/page.tsx`

- [ ] **Step 1: Reescrever a página**

```tsx
import { requireAuth } from "@/lib/auth/session";
import { listNotes } from "@/lib/client-folder/notes-actions";
import { listMeetingsForClient } from "@/lib/reunioes/queries";
import { canRecordMeeting } from "@/lib/reunioes/permissions";
import { AddNoteForm } from "@/components/client-folder/AddNoteForm";
import { NotesTimeline } from "@/components/client-folder/NotesTimeline";
import { GravadorReuniao } from "@/components/reunioes/GravadorReuniao";
import { MeetingCard } from "@/components/reunioes/MeetingCard";

export default async function ReunioesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const [notes, meetings] = await Promise.all([
    listNotes(id),
    listMeetingsForClient(user, id),
  ]);
  const podeGravar = canRecordMeeting(user.role);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Reuniões gravadas</h2>
            <p className="text-xs text-muted-foreground">Grave a reunião (online ou presencial) e ela fica guardada aqui.</p>
          </div>
          {podeGravar && <GravadorReuniao clientId={id} />}
        </header>
        {meetings.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma reunião gravada ainda.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <header>
          <h2 className="text-lg font-semibold">Notas</h2>
          <p className="text-xs text-muted-foreground">Histórico cronológico (mais recente primeiro).</p>
        </header>
        <AddNoteForm clientId={id} />
        <NotesTimeline notes={notes} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Conferir props do MeetingCard**

Run: `sed -n '30,60p' src/components/reunioes/MeetingCard.tsx`
Expected: confirmar que aceita `meeting: MeetingListItem` e linka pra `/reunioes/[id]`. Se o link for pra outro path, ok — o card já existe.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -i "clientes/\[id\]/reunioes" | head`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/clientes/[id]/reunioes/page.tsx"
git commit -m "feat(reunioes): aba do cliente com gravação + lista de reuniões"
```

---

### Task 8: Página central `/reunioes` (dados reais + roles)

**Files:**
- Modify: `src/app/(authed)/reunioes/page.tsx`
- Modify (se preciso): `src/app/(authed)/reunioes/metricas/page.tsx`, `src/app/(authed)/reunioes/[id]/page.tsx`

- [ ] **Step 1: Ajustar roles e chamada de dados**

Em `src/app/(authed)/reunioes/page.tsx`:
- Trocar `const ALLOWED_ROLES = ["adm", "socio", "comercial"];` por incluir gravadores:

```ts
const ALLOWED_ROLES = ["adm", "socio", "comercial", "coordenador", "assessor"];
```

- Trocar a chamada `listMeetings({ status, searchQuery })` por `listMeetings(user, { status: filtroAtivo === "todos" ? undefined : filtroAtivo, searchQuery: params.q })`.
- Remover o uso de `getGoogleConnection` (banner de conectar Google) — fora do escopo desta fatia; remover o `ConnectGoogleBanner` e o import. (Google OAuth é fase futura.)

- [ ] **Step 2: Ajustar `[id]/page.tsx` e `metricas/page.tsx`**

- `[id]/page.tsx`: trocar `getMeetingById(id)` por `getMeetingById(user, id)` (obter `user` via `requireAuth()`), e `notFound()` se retornar null.
- `metricas/page.tsx`: se usa `getMeetingMetrics()`, ajustar assinatura pra `getMeetingMetrics(user)` OU remover a página dos links desta fatia se der muito atrito (métrica não é requisito da Fatia 1). Decisão: manter simples — fazer `getMeetingMetrics` receber `user` e usar `listMeetings(user)` internamente.

- [ ] **Step 3: Type-check geral do módulo**

Run: `npx tsc --noEmit 2>&1 | grep -i reunioes`
Expected: vazio (sem erros).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/reunioes"
git commit -m "feat(reunioes): lista central com dados reais + libera roles"
```

---

### Task 9: Verificação final + PR

- [ ] **Step 1: Suite de testes do módulo**

Run: `npx vitest run src/lib/reunioes --exclude '**/.claude/**'`
Expected: PASS (permissions, storage, queries mapper).

- [ ] **Step 2: Type-check + lint completos**

Run: `npx tsc --noEmit && npx eslint src/lib/reunioes src/components/reunioes "src/app/(authed)/reunioes" "src/app/(authed)/clientes/[id]/reunioes/page.tsx"`
Expected: sem erros.

- [ ] **Step 3: Abrir PR**

```bash
git push -u origin feat/reunioes-gravacao-fatia1
gh pr create --title "feat(reunioes): Fatia 1 — gravar + guardar reunião do cliente" --body "..."
```

Corpo do PR deve incluir o bloco de **migrations manuais** (base fase1 + retenção + app_recording) e o lembrete de `npm run db:types`.

- [ ] **Step 4: Esperar CI verde e mergear**

```bash
gh pr checks <n> --watch && gh pr merge <n> --squash --delete-branch
```

---

## Self-review (feito)

- **Cobertura do spec (Fatia 1):** gravar presencial+online ✅ (Task 6), guardar no sistema ✅ (Tasks 1/3/5), ver no cliente ✅ (Task 7) e na lista central ✅ (Task 8), visibilidade dono+gestão ✅ (Task 2/4), LGPD consentimento ✅ (Task 6). Transcrição/IA/retenção-UI ficam pras Fatias 2-4 (fora do escopo desta).
- **Sem placeholders:** todo código está completo e literal.
- **Consistência de tipos:** `mapMeetingRow`, `listMeetings(user, filter)`, `getMeetingById(user, id)`, `recordingPath(org,client,meeting,ext)`, `createSignedUpload(path)`, `registrarGravacaoAction({...})` usados com as mesmas assinaturas em todas as tasks. `meeting_recordings.audio_url` guarda o PATH (a view de retenção faz `audio_url as storage_path`).
- **Riscos conhecidos:** (1) nome do FK `meetings_owner_user_id_fkey` no embed do select — se o nome real diferir, ajustar pra `owner:profiles!owner_user_id(...)`; validar no type-check/execução. (2) `getDisplayMedia` só funciona em desktop Chrome/Edge — é limitação de produto já combinada; celular usa plano B (upload) que entra em fatia futura.
```
