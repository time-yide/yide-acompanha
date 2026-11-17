# Power Dialer — Modo Lucas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Motor dispara 2-3 ligações simultâneas via Twilio Conference; quando um lead atende, Ana segura com TTS e o Lucas entra automaticamente para assumir a conversa.

**Architecture:** Twilio Conference Bridge por batch. Outbound calls usam `<Say>` + `<Conference>`. Quando o primeiro lead entra, o server chama o Twilio Device do Lucas (incoming call auto-aceita). Leads dropados voltam pra fila. Gravação da Conference + Whisper/GPT geram resumo. Push notification via Web Push API (service worker já existe).

**Tech Stack:** Next.js 16 (App Router), Twilio Voice SDK + REST API + TwiML, Supabase (Postgres + service-role), Web Push API, Sonner (toasts)

**Pré-requisito:** `git pull origin main` para pegar PR #943 (fix do motor WPP travando ligações).

---

## File Structure

### Novos arquivos

| Arquivo | Responsabilidade |
|---------|-----------------|
| `supabase/migrations/YYYYMMDD000000_power_dialer.sql` | Migration: tabelas + colunas |
| `src/lib/power-dialer/types.ts` | Tipos e constantes |
| `src/lib/power-dialer/dispatcher.ts` | `dispararPowerDialerBatch()` — cria batch, liga 2-3 leads |
| `src/lib/power-dialer/post-call.ts` | Pós-ligação: gravação, transcrição, resumo IA, espelhamento |
| `src/lib/power-dialer/queries.ts` | Leituras do banco (config, batch ativo, etc.) |
| `src/lib/power-dialer/notify.ts` | Envio de push notification + Realtime broadcast |
| `src/app/api/power-dialer/twiml/[batchId]/lead/route.ts` | TwiML: `<Say>` + `<Conference>` para leads |
| `src/app/api/power-dialer/twiml/[batchId]/agent/route.ts` | TwiML: `<Conference>` para Lucas |
| `src/app/api/power-dialer/conference-event/[batchId]/route.ts` | Webhook: join/leave/end da Conference |
| `src/app/api/power-dialer/recording/[batchId]/route.ts` | Webhook: gravação pronta |
| `src/app/api/power-dialer/status/[batchId]/route.ts` | Webhook: status das outbound calls |
| `src/components/power-dialer/PowerDialerBar.tsx` | Barra flutuante: info do lead, timer, desligar |
| `src/components/power-dialer/PowerDialerConfigSection.tsx` | Seção de config na página /configuracoes/voz-ia |

### Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| `src/lib/ligacoes/twilio.ts:133-136` | `incomingAllow: true` quando user é power dialer agent |
| `src/lib/ligacoes/actions.ts:386-414` | `getTwilioVoiceTokenAction` retorna flag `isPowerDialerAgent` |
| `src/components/ligacoes/TwilioCallProvider.tsx` | Handler `device.on("incoming")` auto-aceita em modo power dialer |
| `src/lib/motor-prospeccao/worker.ts` | Acumular leads de ligação e chamar `dispararPowerDialerBatch()` |
| `src/lib/motor-prospeccao/selecao.ts` | Priorizar `dropado_power_dialer = true` |
| `src/app/(authed)/configuracoes/voz-ia/page.tsx` | Renderizar `PowerDialerConfigSection` |
| `src/lib/env.ts` | Adicionar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| `src/app/(authed)/layout.tsx` | Registrar service worker + subscription push |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260918000000_power_dialer.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Power Dialer: tabelas e colunas

-- 1. Novos campos em ai_voice_configs
ALTER TABLE ai_voice_configs
  ADD COLUMN IF NOT EXISTS power_dialer_ativo boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS power_dialer_batch_size integer DEFAULT 3,
  ADD COLUMN IF NOT EXISTS power_dialer_timeout_s integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS power_dialer_colaborador_id uuid REFERENCES colaboradores(id),
  ADD COLUMN IF NOT EXISTS power_dialer_greeting text DEFAULT 'Olá, tudo bem? Só um momento...',
  ADD COLUMN IF NOT EXISTS power_dialer_goodbye text DEFAULT 'Desculpe, vamos retornar em breve, obrigada!';

-- 2. Flag de prioridade em leads_gerados
ALTER TABLE leads_gerados
  ADD COLUMN IF NOT EXISTS dropado_power_dialer boolean DEFAULT false;

-- 3. Tabela de batches
CREATE TABLE IF NOT EXISTS power_dialer_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  conference_name text NOT NULL,
  status text NOT NULL DEFAULT 'discando'
    CHECK (status IN ('discando','conectado','timeout','concluido','erro')),
  lead_atendeu_id uuid REFERENCES leads_gerados(id),
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  conectado_em timestamptz,
  finalizado_em timestamptz,
  duracao_segundos integer,
  gravacao_url text,
  gravacao_sid text,
  resumo_ia text,
  transcricao jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pd_batches_org_status
  ON power_dialer_batches(organization_id, status);

-- 4. Tabela de calls individuais do batch
CREATE TABLE IF NOT EXISTS power_dialer_batch_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES power_dialer_batches(id) ON DELETE CASCADE,
  lead_gerado_id uuid NOT NULL REFERENCES leads_gerados(id),
  twilio_call_sid text,
  status text NOT NULL DEFAULT 'discando'
    CHECK (status IN ('discando','atendeu','dropado','nao_atendeu','ocupado','erro')),
  atendeu_em timestamptz,
  finalizado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pd_batch_calls_batch
  ON power_dialer_batch_calls(batch_id);
CREATE INDEX IF NOT EXISTS idx_pd_batch_calls_sid
  ON power_dialer_batch_calls(twilio_call_sid);

-- 5. RLS
ALTER TABLE power_dialer_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_dialer_batch_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_pd_batches" ON power_dialer_batches
  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_full_pd_batch_calls" ON power_dialer_batch_calls
  FOR ALL USING (true) WITH CHECK (true);

-- 6. Push subscriptions (se não existir)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(colaborador_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_full_push_subs" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260918000000_power_dialer.sql
git commit -m "feat(power-dialer): migration — tabelas, colunas, RLS"
```

> **IMPORTANTE:** migration é manual — aplicar no SQL Editor do Supabase após merge.

---

## Task 2: Types e Queries

**Files:**
- Create: `src/lib/power-dialer/types.ts`
- Create: `src/lib/power-dialer/queries.ts`

- [ ] **Step 1: Criar types.ts**

```typescript
import "server-only";

export const PD_BATCH_STATUS = {
  DISCANDO: "discando",
  CONECTADO: "conectado",
  TIMEOUT: "timeout",
  CONCLUIDO: "concluido",
  ERRO: "erro",
} as const;

export const PD_CALL_STATUS = {
  DISCANDO: "discando",
  ATENDEU: "atendeu",
  DROPADO: "dropado",
  NAO_ATENDEU: "nao_atendeu",
  OCUPADO: "ocupado",
  ERRO: "erro",
} as const;

export interface PowerDialerConfig {
  power_dialer_ativo: boolean;
  power_dialer_batch_size: number;
  power_dialer_timeout_s: number;
  power_dialer_colaborador_id: string | null;
  power_dialer_greeting: string;
  power_dialer_goodbye: string;
}

export interface PDHBatch {
  id: string;
  organization_id: string;
  conference_name: string;
  status: string;
  lead_atendeu_id: string | null;
  colaborador_id: string;
  iniciado_em: string;
  conectado_em: string | null;
  finalizado_em: string | null;
}

export interface PDBatchCall {
  id: string;
  batch_id: string;
  lead_gerado_id: string;
  twilio_call_sid: string | null;
  status: string;
}
```

- [ ] **Step 2: Criar queries.ts**

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { PowerDialerConfig, PDHBatch, PDBatchCall } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

export async function getPowerDialerConfig(
  orgId: string,
): Promise<(PowerDialerConfig & { id: string }) | null> {
  const { data } = await sb()
    .from("ai_voice_configs")
    .select("id, power_dialer_ativo, power_dialer_batch_size, power_dialer_timeout_s, power_dialer_colaborador_id, power_dialer_greeting, power_dialer_goodbye")
    .eq("organization_id", orgId)
    .eq("ativo", true)
    .maybeSingle();
  return data ?? null;
}

export async function getActiveBatchForColaborador(
  colaboradorId: string,
): Promise<PDHBatch | null> {
  const { data } = await sb()
    .from("power_dialer_batches")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .in("status", ["discando", "conectado"])
    .order("iniciado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export async function getBatchById(batchId: string): Promise<PDHBatch | null> {
  const { data } = await sb()
    .from("power_dialer_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  return data ?? null;
}

export async function getBatchCalls(batchId: string): Promise<PDBatchCall[]> {
  const { data } = await sb()
    .from("power_dialer_batch_calls")
    .select("*")
    .eq("batch_id", batchId);
  return data ?? [];
}

export async function getBatchCallBySid(
  callSid: string,
): Promise<(PDBatchCall & { batch_id: string }) | null> {
  const { data } = await sb()
    .from("power_dialer_batch_calls")
    .select("*")
    .eq("twilio_call_sid", callSid)
    .maybeSingle();
  return data ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/power-dialer/types.ts src/lib/power-dialer/queries.ts
git commit -m "feat(power-dialer): types e queries base"
```

---

## Task 3: Dispatcher — `dispararPowerDialerBatch()`

**Files:**
- Create: `src/lib/power-dialer/dispatcher.ts`

- [ ] **Step 1: Criar dispatcher.ts**

A função principal que cria o batch e dispara 2-3 ligações simultâneas.

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { getPowerDialerConfig, getActiveBatchForColaborador } from "./queries";
import { PD_BATCH_STATUS } from "./types";
import type { LeadParaProspectar } from "@/lib/motor-prospeccao/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

interface DispatchResult {
  success: true;
  batchId: string;
  callCount: number;
}
interface DispatchError {
  error: string;
}
export type PowerDialerResult = DispatchResult | DispatchError;

export async function dispararPowerDialerBatch(
  orgId: string,
  leads: LeadParaProspectar[],
): Promise<PowerDialerResult> {
  const env = getServerEnv();
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN)
    return { error: "Twilio não configurado" };

  const config = await getPowerDialerConfig(orgId);
  if (!config?.power_dialer_ativo)
    return { error: "Power dialer não ativo" };
  if (!config.power_dialer_colaborador_id)
    return { error: "Sem colaborador definido para power dialer" };

  // Não permitir dois batches simultâneos pro mesmo colaborador
  const active = await getActiveBatchForColaborador(config.power_dialer_colaborador_id);
  if (active) return { error: "Batch ativo em andamento" };

  // Buscar instância Twilio da org
  const { data: instancia } = await sb()
    .from("ligacoes_instancias")
    .select("numero, id, webhook_secret")
    .eq("organization_id", orgId)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .limit(1)
    .maybeSingle();
  if (!instancia?.numero) return { error: "Sem instância Twilio" };

  const conferenceName = `pd-${crypto.randomUUID().slice(0, 8)}`;
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  // Criar batch no banco
  const { data: batch, error: batchErr } = await sb()
    .from("power_dialer_batches")
    .insert({
      organization_id: orgId,
      conference_name: conferenceName,
      status: PD_BATCH_STATUS.DISCANDO,
      colaborador_id: config.power_dialer_colaborador_id,
    })
    .select("id")
    .single();
  if (batchErr || !batch) return { error: batchErr?.message ?? "Erro ao criar batch" };

  const batchId = batch.id;

  // Marcar leads como em_ligacao
  const leadIds = leads.map((l) => l.id);
  await sb()
    .from("leads_gerados")
    .update({ ai_status: "em_ligacao" })
    .in("id", leadIds);

  // Discar todas simultaneamente
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`;
  const authHeader = `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;

  const callPromises = leads.map(async (lead) => {
    const telefone = lead.telefone || lead.whatsapp;
    if (!telefone) return null;

    // Criar registro da call no batch
    const { data: batchCall } = await sb()
      .from("power_dialer_batch_calls")
      .insert({
        batch_id: batchId,
        lead_gerado_id: lead.id,
        status: "discando",
      })
      .select("id")
      .single();
    if (!batchCall) return null;

    const body = new URLSearchParams({
      To: telefone,
      From: instancia.numero,
      Url: `${appUrl}/api/power-dialer/twiml/${batchId}/lead`,
      StatusCallback: `${appUrl}/api/power-dialer/status/${batchId}`,
      StatusCallbackEvent: "initiated ringing answered completed",
    });

    try {
      const resp = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        await sb().from("power_dialer_batch_calls")
          .update({ status: "erro", finalizado_em: new Date().toISOString() })
          .eq("id", batchCall.id);
        console.error("[power-dialer] Twilio call error:", errText);
        return null;
      }

      const twilioData = await resp.json();
      await sb().from("power_dialer_batch_calls")
        .update({ twilio_call_sid: twilioData.sid })
        .eq("id", batchCall.id);
      return batchCall.id;
    } catch (err) {
      console.error("[power-dialer] dispatch error:", err);
      return null;
    }
  });

  const results = await Promise.all(callPromises);
  const successCount = results.filter(Boolean).length;

  if (successCount === 0) {
    await sb().from("power_dialer_batches")
      .update({ status: PD_BATCH_STATUS.ERRO, finalizado_em: new Date().toISOString() })
      .eq("id", batchId);
    await sb().from("leads_gerados").update({ ai_status: null }).in("id", leadIds);
    return { error: "Nenhuma ligação iniciada" };
  }

  // Agendar timeout
  // O timeout é tratado pelo conference-event webhook (verifica elapsed time)

  return { success: true, batchId, callCount: successCount };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/power-dialer/dispatcher.ts
git commit -m "feat(power-dialer): dispatcher — cria batch e disca 2-3 leads"
```

---

## Task 4: TwiML Routes

**Files:**
- Create: `src/app/api/power-dialer/twiml/[batchId]/lead/route.ts`
- Create: `src/app/api/power-dialer/twiml/[batchId]/agent/route.ts`

- [ ] **Step 1: TwiML do lead (outbound)**

Quando o lead atende: Ana fala cumprimento → lead entra na Conference.

```typescript
// src/app/api/power-dialer/twiml/[batchId]/lead/route.ts
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getBatchById } from "@/lib/power-dialer/queries";
import { getServerEnv } from "@/lib/env";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const env = getServerEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const batch = await getBatchById(batchId);
  if (!batch) return new NextResponse("Not found", { status: 404 });

  const config = await import("@/lib/power-dialer/queries")
    .then((m) => m.getPowerDialerConfig(batch.organization_id));

  const greeting = config?.power_dialer_greeting ?? "Olá, tudo bem? Só um momento...";

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.say({ language: "pt-BR", voice: "Polly.Vitoria-Neural" }, greeting);

  const conference = twiml.dial().conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: false,
    record: "record-from-start",
    recordingStatusCallback: `${appUrl}/api/power-dialer/recording/${batchId}`,
    recordingStatusCallbackEvent: "completed",
    statusCallback: `${appUrl}/api/power-dialer/conference-event/${batchId}`,
    statusCallbackEvent: "join leave end",
    waitUrl: "",
  }, batch.conference_name);

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
```

- [ ] **Step 2: TwiML do agente (Lucas)**

Quando o server chama o Device do Lucas, ele entra na Conference.

```typescript
// src/app/api/power-dialer/twiml/[batchId]/agent/route.ts
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { getBatchById } from "@/lib/power-dialer/queries";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;

  const batch = await getBatchById(batchId);
  if (!batch) return new NextResponse("Not found", { status: 404 });

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  twiml.dial().conference({
    startConferenceOnEnter: true,
    endConferenceOnExit: true,
    beep: false,
  }, batch.conference_name);

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/power-dialer/twiml/
git commit -m "feat(power-dialer): TwiML routes — lead (Say+Conference) e agent"
```

---

## Task 5: Conference Event Webhook

O webhook mais importante — processa join/leave/end.

**Files:**
- Create: `src/app/api/power-dialer/conference-event/[batchId]/route.ts`
- Create: `src/lib/power-dialer/notify.ts`

- [ ] **Step 1: Criar notify.ts** (push + Supabase Realtime)

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import webpush from "web-push";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

interface NotifyPayload {
  type: "power_dialer_lead_answered";
  batchId: string;
  leadNome: string;
  leadEmpresa: string;
  leadCategoria: string | null;
  leadCidade: string | null;
}

export async function notificarAgente(
  colaboradorId: string,
  payload: NotifyPayload,
) {
  // 1. Broadcast via Supabase Realtime (in-app toast + sound)
  await sb().channel(`power-dialer:${colaboradorId}`)
    .send({ type: "broadcast", event: "lead-answered", payload });

  // 2. Web Push (se offline ou outra aba)
  const env = getServerEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;

  webpush.setVapidDetails(
    `mailto:${env.VAPID_CONTACT_EMAIL ?? "contato@yidedigital.com.br"}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );

  const { data: subs } = await sb()
    .from("push_subscriptions")
    .select("endpoint, keys_p256dh, keys_auth")
    .eq("colaborador_id", colaboradorId);

  if (!subs?.length) return;

  const pushPayload = JSON.stringify({
    title: `Lead atendeu: ${payload.leadEmpresa}`,
    body: [payload.leadCategoria, payload.leadCidade].filter(Boolean).join(" — "),
    data: { url: "/", batchId: payload.batchId },
    urgent: true,
  });

  await Promise.allSettled(
    subs.map((s: { endpoint: string; keys_p256dh: string; keys_auth: string }) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.keys_p256dh, auth: s.keys_auth } },
        pushPayload,
      ).catch(() => {
        // Remove subscription inválida
        sb().from("push_subscriptions").delete().eq("endpoint", s.endpoint).then(() => {});
      }),
    ),
  );
}
```

- [ ] **Step 2: Criar conference-event webhook**

```typescript
// src/app/api/power-dialer/conference-event/[batchId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { getBatchById, getBatchCalls, getPowerDialerConfig } from "@/lib/power-dialer/queries";
import { notificarAgente } from "@/lib/power-dialer/notify";
import { PD_BATCH_STATUS } from "@/lib/power-dialer/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const form = await req.formData();
  const event = form.get("StatusCallbackEvent") as string;
  const callSid = form.get("CallSid") as string;

  const batch = await getBatchById(batchId);
  if (!batch) return twimlOk();

  if (event === "participant-join" && batch.status === "discando") {
    await handleFirstAnswer(batchId, batch, callSid);
  } else if (event === "participant-leave" || event === "conference-end") {
    await handleEnd(batchId, batch);
  }

  return twimlOk();
}

async function handleFirstAnswer(
  batchId: string,
  batch: { organization_id: string; colaborador_id: string; conference_name: string },
  callSid: string,
) {
  const env = getServerEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  // Identificar qual call atendeu
  const calls = await getBatchCalls(batchId);
  const answeredCall = calls.find((c) => c.twilio_call_sid === callSid);
  if (!answeredCall) return;

  // Marcar batch como conectado
  await sb().from("power_dialer_batches").update({
    status: PD_BATCH_STATUS.CONECTADO,
    lead_atendeu_id: answeredCall.lead_gerado_id,
    conectado_em: new Date().toISOString(),
  }).eq("id", batchId);

  // Marcar essa call como atendeu
  await sb().from("power_dialer_batch_calls").update({
    status: "atendeu",
    atendeu_em: new Date().toISOString(),
  }).eq("id", answeredCall.id);

  // Dropar as outras calls
  const config = await getPowerDialerConfig(batch.organization_id);
  const goodbye = config?.power_dialer_goodbye ?? "Desculpe, vamos retornar em breve, obrigada!";

  const otherCalls = calls.filter((c) => c.id !== answeredCall.id && c.twilio_call_sid);
  for (const other of otherCalls) {
    try {
      // Hangup via Twilio REST API
      await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls/${other.twilio_call_sid}.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ Status: "completed" }).toString(),
        },
      );
      await sb().from("power_dialer_batch_calls").update({
        status: "dropado",
        finalizado_em: new Date().toISOString(),
      }).eq("id", other.id);

      // Lead volta pra fila com prioridade
      await sb().from("leads_gerados").update({
        ai_status: null,
        dropado_power_dialer: true,
        ai_proxima_tentativa: new Date().toISOString(),
      }).eq("id", other.lead_gerado_id);
    } catch (err) {
      console.error("[power-dialer] erro ao dropar call:", err);
    }
  }

  // Buscar dados do lead pra notificação
  const { data: lead } = await sb()
    .from("leads_gerados")
    .select("nome_decisor, empresa, categoria, cidade")
    .eq("id", answeredCall.lead_gerado_id)
    .single();

  // Notificar Lucas (push + Realtime)
  await notificarAgente(batch.colaborador_id, {
    type: "power_dialer_lead_answered",
    batchId,
    leadNome: lead?.nome_decisor ?? "",
    leadEmpresa: lead?.empresa ?? "Lead",
    leadCategoria: lead?.categoria ?? null,
    leadCidade: lead?.cidade ?? null,
  });

  // Chamar o Device do Lucas pra entrar na Conference
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`;
  await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: `client:${batch.colaborador_id}`,
      From: env.TWILIO_CALLER_ID ?? "",
      Url: `${appUrl}/api/power-dialer/twiml/${batchId}/agent`,
    }).toString(),
  });

  // Agendar timeout
  const timeoutS = config?.power_dialer_timeout_s ?? 15;
  setTimeout(async () => {
    const freshBatch = await getBatchById(batchId);
    if (freshBatch?.status !== "conectado") return;
    // Se Lucas não entrou (conference ainda tem só 1 participante), desligar
    // Isso é tratado pelo status callback — se após timeoutS a conference
    // não tem o agent, o status webhook finaliza o batch
  }, timeoutS * 1000);
}

async function handleEnd(batchId: string, batch: { status: string }) {
  if (batch.status === "concluido" || batch.status === "erro") return;

  await sb().from("power_dialer_batches").update({
    status: PD_BATCH_STATUS.CONCLUIDO,
    finalizado_em: new Date().toISOString(),
  }).eq("id", batchId);
}

function twimlOk() {
  return new NextResponse("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/power-dialer/notify.ts src/app/api/power-dialer/conference-event/
git commit -m "feat(power-dialer): conference-event webhook + notify (push + Realtime)"
```

---

## Task 6: Status + Recording Webhooks

**Files:**
- Create: `src/app/api/power-dialer/status/[batchId]/route.ts`
- Create: `src/app/api/power-dialer/recording/[batchId]/route.ts`
- Create: `src/lib/power-dialer/post-call.ts`

- [ ] **Step 1: Status webhook**

Recebe status das outbound calls (ringing, answered, completed, no-answer, busy).

```typescript
// src/app/api/power-dialer/status/[batchId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getBatchCallBySid, getBatchById } from "@/lib/power-dialer/queries";
import { processPowerDialerPostCall } from "@/lib/power-dialer/post-call";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const form = await req.formData();
  const callSid = form.get("CallSid") as string;
  const callStatus = form.get("CallStatus") as string;
  const duration = form.get("CallDuration") as string | null;

  const batchCall = await getBatchCallBySid(callSid);
  if (!batchCall) return twimlOk();

  if (callStatus === "no-answer" || callStatus === "busy" || callStatus === "failed") {
    const statusMap: Record<string, string> = {
      "no-answer": "nao_atendeu",
      busy: "ocupado",
      failed: "erro",
    };
    await sb().from("power_dialer_batch_calls").update({
      status: statusMap[callStatus] ?? "erro",
      finalizado_em: new Date().toISOString(),
    }).eq("id", batchCall.id);

    // Limpar ai_status do lead
    await sb().from("leads_gerados")
      .update({ ai_status: null })
      .eq("id", batchCall.lead_gerado_id);
  }

  if (callStatus === "completed" && batchCall.status === "atendeu") {
    await sb().from("power_dialer_batch_calls").update({
      finalizado_em: new Date().toISOString(),
    }).eq("id", batchCall.id);

    const batch = await getBatchById(batchId);
    if (batch) {
      const durationSec = duration ? parseInt(duration, 10) : 0;
      await sb().from("power_dialer_batches").update({
        status: "concluido",
        finalizado_em: new Date().toISOString(),
        duracao_segundos: durationSec,
      }).eq("id", batchId);

      await processPowerDialerPostCall(batchId, batch.organization_id, batchCall.lead_gerado_id, durationSec);
    }
  }

  return twimlOk();
}

function twimlOk() {
  return new NextResponse("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
```

- [ ] **Step 2: Recording webhook**

```typescript
// src/app/api/power-dialer/recording/[batchId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;
  const form = await req.formData();
  const recordingSid = form.get("RecordingSid") as string;
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  if (recordingSid) {
    const gravacaoUrl = `${appUrl}/api/ligacoes/twilio/recording?sid=${recordingSid}`;
    await sb().from("power_dialer_batches").update({
      gravacao_url: gravacaoUrl,
      gravacao_sid: recordingSid,
    }).eq("id", batchId);
  }

  return new NextResponse("<Response/>", {
    headers: { "Content-Type": "text/xml" },
  });
}
```

- [ ] **Step 3: Post-call processing**

```typescript
// src/lib/power-dialer/post-call.ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb() { return createServiceRoleClient() as any; }

export async function processPowerDialerPostCall(
  batchId: string,
  orgId: string,
  leadGeradoId: string,
  durationSeconds: number,
) {
  const env = getServerEnv();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  // Buscar batch pra gravação
  const { data: batch } = await sb()
    .from("power_dialer_batches")
    .select("gravacao_url, gravacao_sid, colaborador_id")
    .eq("id", batchId)
    .single();

  // Limpar ai_status do lead
  await sb().from("leads_gerados").update({
    ai_status: null,
    dropado_power_dialer: false,
  }).eq("id", leadGeradoId);

  // Registrar tentativa
  try {
    await sb().from("lead_attempts").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      tipo: "ligacao",
      canal: "telefone",
      notas: "Power Dialer — ligação com agente",
    });
  } catch { /* ignora */ }

  // Espelhar na tabela de ligações
  const { data: lead } = await sb()
    .from("leads_gerados")
    .select("telefone, empresa")
    .eq("id", leadGeradoId)
    .single();

  if (lead?.telefone) {
    const now = new Date();
    try {
      await sb().from("ligacoes").insert({
        organization_id: orgId,
        colaborador_id: batch?.colaborador_id ?? null,
        tipo: "telefone",
        numero: lead.telefone,
        contato_nome: lead.empresa ?? null,
        direcao: "saida",
        status: durationSeconds > 5 ? "atendida" : "perdida",
        iniciada_em: new Date(now.getTime() - durationSeconds * 1000).toISOString(),
        finalizada_em: now.toISOString(),
        duracao_segundos: durationSeconds,
        gravacao_url: batch?.gravacao_url ?? null,
        origem: "power_dialer",
        lead_gerado_id: leadGeradoId,
        tags: ["power_dialer"],
      });
    } catch (err) {
      console.error("[power-dialer] erro ao espelhar ligação:", err);
    }
  }

  // TODO (fase 2): transcrever gravação via Whisper e gerar resumo via GPT
  // Por enquanto salva gravação e deixa pra ouvir manualmente
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/power-dialer/status/ src/app/api/power-dialer/recording/ src/lib/power-dialer/post-call.ts
git commit -m "feat(power-dialer): status + recording webhooks + post-call processing"
```

---

## Task 7: Motor Integration

**Files:**
- Modify: `src/lib/motor-prospeccao/worker.ts`
- Modify: `src/lib/motor-prospeccao/selecao.ts`

- [ ] **Step 1: Priorizar leads dropados na seleção**

Em `selecao.ts`, adicionar `dropado_power_dialer` no ORDER BY:

```typescript
// Na query de selecionarLeads, adicionar ao .order():
.order("dropado_power_dialer", { ascending: false, nullsFirst: false })
```

Colocar ANTES dos outros `.order()` pra dar prioridade máxima.

- [ ] **Step 2: Modificar worker.ts pra acumular batch de ligações**

No loop de `executarMotor()`, quando `config.power_dialer_ativo`, acumular leads cujo step é "ligacao" e disparar como batch:

```typescript
// No início do loop da org (antes do for de leads), adicionar:
import { dispararPowerDialerBatch } from "@/lib/power-dialer/dispatcher";

// Dentro do for-loop da org, APÓS processar todos os leads:
// Acumular leads de ligação pro power dialer
const leadsParaPD: LeadParaProspectar[] = [];

// No processarLead, quando step.canal === "ligacao" e config.power_dialer_ativo:
// retornar { acao: "power_dialer_pendente" } em vez de chamar dispararLigacaoIA

// Após o for-loop:
if (config.power_dialer_ativo && leadsParaPD.length > 0) {
  const pdResult = await dispararPowerDialerBatch(orgId, leadsParaPD);
  if ("success" in pdResult) {
    orgResult.ligacoesDisparadas += leadsParaPD.length;
  }
}
```

A implementação exata requer refatorar o loop — o subagent/executor terá o contexto do worker.ts atual pra fazer as edições corretas.

- [ ] **Step 3: Commit**

```bash
git add src/lib/motor-prospeccao/worker.ts src/lib/motor-prospeccao/selecao.ts
git commit -m "feat(power-dialer): integração motor — batch de leads + prioridade dropados"
```

---

## Task 8: VoiceGrant + TwilioCallProvider (Incoming Calls)

**Files:**
- Modify: `src/lib/ligacoes/twilio.ts:133-136`
- Modify: `src/lib/ligacoes/actions.ts:386-414`
- Modify: `src/components/ligacoes/TwilioCallProvider.tsx`

- [ ] **Step 1: VoiceGrant — habilitar incoming**

Em `twilio.ts`, função `gerarVoiceToken`:

```typescript
// Mudar de:
const grant = new VoiceGrant({
  outgoingApplicationSid: c.twimlAppSid,
  incomingAllow: false,
});
// Para:
export function gerarVoiceToken(identity: string, incomingAllow = false): string | null {
  // ...
  const grant = new VoiceGrant({
    outgoingApplicationSid: c.twimlAppSid,
    incomingAllow,
  });
  // ...
}
```

- [ ] **Step 2: Action — detectar se é power dialer agent**

Em `actions.ts`, `getTwilioVoiceTokenAction`:

```typescript
// Após buscar instância, checar se é power dialer agent:
const { data: pdConfig } = await sb
  .from("ai_voice_configs")
  .select("power_dialer_colaborador_id")
  .eq("organization_id", actor.organizationId)
  .eq("ativo", true)
  .eq("power_dialer_ativo", true)
  .maybeSingle();

const isPDAgent = pdConfig?.power_dialer_colaborador_id === actor.id;
const token = gerarVoiceToken(actor.id, isPDAgent);

return { token, callerId, instanciaId, isPowerDialerAgent: isPDAgent };
```

- [ ] **Step 3: TwilioCallProvider — auto-aceitar incoming calls**

Adicionar ao `useEffect` que inicializa o Device:

```typescript
// Após device.register():
device.on("incoming", (call: Call) => {
  // Auto-aceitar em modo power dialer
  if (isPowerDialerAgent) {
    call.accept();
    callRef.current = call;
    setStatus("in_call");
    setActiveNumber("Power Dialer");
    // Tocar som de alerta
    try { new Audio("/sounds/power-dialer-ring.mp3").play(); } catch {}

    call.on("disconnect", () => {
      setStatus("idle");
      setActiveNumber(null);
      callRef.current = null;
      router.refresh();
    });
  }
});
```

Também: adicionar `isPowerDialerAgent` ao estado do provider e fetch do token action.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ligacoes/twilio.ts src/lib/ligacoes/actions.ts src/components/ligacoes/TwilioCallProvider.tsx
git commit -m "feat(power-dialer): incoming calls — VoiceGrant + auto-accept no Device"
```

---

## Task 9: Push Subscription + Realtime Listener

**Files:**
- Modify: `src/app/(authed)/layout.tsx`
- Modify: `src/lib/env.ts`
- Create: `src/lib/push/subscribe-action.ts`
- Create: `src/components/power-dialer/PowerDialerListener.tsx`

- [ ] **Step 1: Env vars VAPID**

Em `env.ts`, adicionar:

```typescript
VAPID_PUBLIC_KEY: z.string().optional(),
VAPID_PRIVATE_KEY: z.string().optional(),
VAPID_CONTACT_EMAIL: z.string().optional(),
```

- [ ] **Step 2: Server action pra salvar push subscription**

```typescript
// src/lib/push/subscribe-action.ts
"use server";
import { requireAuth } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function savePushSubscriptionAction(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const actor = await requireAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;

  await sb.from("push_subscriptions").upsert({
    colaborador_id: actor.id,
    endpoint: sub.endpoint,
    keys_p256dh: sub.keys.p256dh,
    keys_auth: sub.keys.auth,
  }, { onConflict: "colaborador_id,endpoint" });
}
```

- [ ] **Step 3: PowerDialerListener — Realtime + som + toast**

```typescript
// src/components/power-dialer/PowerDialerListener.tsx
"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function PowerDialerListener({ userId }: { userId: string }) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`power-dialer:${userId}`);

    channel
      .on("broadcast", { event: "lead-answered" }, ({ payload }) => {
        // Som de alerta
        try { new Audio("/sounds/power-dialer-ring.mp3").play(); } catch {}

        // Toast com info do lead
        toast.info(`Lead atendeu: ${payload.leadEmpresa}`, {
          description: [payload.leadCategoria, payload.leadCidade]
            .filter(Boolean).join(" — "),
          duration: 15000,
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return null;
}
```

- [ ] **Step 4: Registrar no layout**

Em `src/app/(authed)/layout.tsx`, dentro do layout autenticado:

```tsx
import { PowerDialerListener } from "@/components/power-dialer/PowerDialerListener";

// Dentro do JSX, junto com TwilioCallProvider:
<PowerDialerListener userId={actor.id} />
```

Também: registrar service worker e push subscription no client (pode ser um `useEffect` no layout client wrapper ou um componente dedicado).

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/lib/push/ src/components/power-dialer/PowerDialerListener.tsx src/app/\(authed\)/layout.tsx
git commit -m "feat(power-dialer): push subscription + Realtime listener + toast"
```

---

## Task 10: Config UI

**Files:**
- Create: `src/components/power-dialer/PowerDialerConfigSection.tsx`
- Modify: `src/app/(authed)/configuracoes/voz-ia/page.tsx`

- [ ] **Step 1: Criar PowerDialerConfigSection**

Formulário com: toggle ativo, seletor de colaborador, batch size, timeout, greeting, goodbye. Usa server actions pra salvar no `ai_voice_configs`.

- [ ] **Step 2: Renderizar na página de config**

Em `configuracoes/voz-ia/page.tsx`, adicionar:

```tsx
<PowerDialerConfigSection config={config} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/power-dialer/PowerDialerConfigSection.tsx src/app/\(authed\)/configuracoes/voz-ia/page.tsx
git commit -m "feat(power-dialer): config UI — toggle, colaborador, batch size, timeout"
```

---

## Task 11: PowerDialerBar (UI flutuante)

**Files:**
- Create: `src/components/power-dialer/PowerDialerBar.tsx`

- [ ] **Step 1: Criar barra flutuante**

Similar à barra do `TwilioCallProvider` mas com mais info: nome do lead, empresa, timer, botão desligar.

Usa o estado do `TwilioCallProvider` (`status === "in_call"` + `activeNumber === "Power Dialer"`) como trigger pra aparecer.

Recebe dados do lead via Realtime broadcast (mesmo canal do `PowerDialerListener`).

- [ ] **Step 2: Adicionar ao layout ou TwilioCallProvider**

Renderizar o `PowerDialerBar` dentro do provider ou no layout autenticado.

- [ ] **Step 3: Commit**

```bash
git add src/components/power-dialer/PowerDialerBar.tsx
git commit -m "feat(power-dialer): barra flutuante com info do lead + timer"
```

---

## Task 12: Som de Alerta + Middleware Auth Exclusion

**Files:**
- Create: `public/sounds/power-dialer-ring.mp3` (gerar ou baixar um som curto de alerta)
- Modify: `src/middleware.ts` (excluir `/api/power-dialer/` do auth)

- [ ] **Step 1: Excluir webhooks do middleware auth**

As rotas `/api/power-dialer/*` são chamadas pelo Twilio e não têm auth header. Adicionar ao matcher/exclusion do middleware, similar a `/api/webhooks/` e `/api/voz-ia/`.

- [ ] **Step 2: Som de alerta**

Criar ou baixar um arquivo MP3 curto (~1s) de ring/alerta e salvar em `public/sounds/power-dialer-ring.mp3`.

- [ ] **Step 3: Instalar web-push**

```bash
npm install web-push
npm install -D @types/web-push
```

- [ ] **Step 4: Commit final**

```bash
git add public/sounds/ src/middleware.ts package.json package-lock.json
git commit -m "feat(power-dialer): som de alerta + middleware exclusion + web-push dep"
```

---

## Env Vars Necessárias (Vercel)

```
VAPID_PUBLIC_KEY=<gerar com web-push generate-vapid-keys>
VAPID_PRIVATE_KEY=<gerar com web-push generate-vapid-keys>
VAPID_CONTACT_EMAIL=contato@yidedigital.com.br
```

Gerar com: `npx web-push generate-vapid-keys`

---

## Migrations Manuais

Após merge do PR, aplicar no SQL Editor do Supabase:
1. `20260918000000_power_dialer.sql`

Também adicionar `'power_dialer'` ao enum/check de `origem` na tabela `ligacoes` se houver constraint.

---

## Ordem de Execução

Tasks 1-6 são backend puro e podem ser feitas em sequência.
Tasks 7-9 dependem de Tasks 1-6.
Tasks 10-12 são UI e podem ser feitas em paralelo com 7-9.

Recomendado: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
