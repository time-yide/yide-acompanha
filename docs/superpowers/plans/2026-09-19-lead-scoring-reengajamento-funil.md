# Lead Scoring + Reengajamento + Funil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add lead scoring, automatic re-engagement cadence, and improved motor dashboard funnel.

**Architecture:** Three independent features sharing one migration. Lead scoring adds a `score` column updated by event handlers. Re-engagement adds a second pass in the motor worker for `esgotado` leads. Dashboard improves existing `/prospeccao/motor` with period filters and complete funnel.

**Tech Stack:** Supabase (migration), Next.js App Router (server components, server actions), Recharts (chart), existing motor infrastructure.

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260919000000_lead_scoring_reengajamento.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- Lead Scoring + Reengajamento

-- 1. Score column
ALTER TABLE leads_gerados
  ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;

-- 2. Reengajamento columns
ALTER TABLE leads_gerados
  ADD COLUMN IF NOT EXISTS reengajamento_tentativas integer DEFAULT 0;
ALTER TABLE leads_gerados
  ADD COLUMN IF NOT EXISTS reengajamento_proxima timestamptz;

-- 3. Backfill score from existing data
UPDATE leads_gerados SET score =
  CASE WHEN google_rating >= 4.0 THEN 10 ELSE 0 END +
  CASE WHEN website IS NOT NULL AND website != '' THEN 5 ELSE 0 END;

-- 4. Add descartado_definitivo to ai_status CHECK constraint
ALTER TABLE leads_gerados DROP CONSTRAINT IF EXISTS leads_gerados_ai_status_check;
ALTER TABLE leads_gerados ADD CONSTRAINT leads_gerados_ai_status_check
  CHECK (ai_status IN (
    'aguardando', 'em_ligacao', 'followup_wpp',
    'reuniao_agendada', 'sem_interesse', 'esgotado',
    'escalado_humano', 'descartado_definitivo'
  ));

-- 5. Index for reengajamento selection
CREATE INDEX IF NOT EXISTS idx_leads_reengajamento
  ON leads_gerados(organization_id, ai_status, reengajamento_proxima)
  WHERE ai_status = 'esgotado' AND reengajamento_tentativas < 4;

-- 6. Index for score ordering
CREATE INDEX IF NOT EXISTS idx_leads_score
  ON leads_gerados(organization_id, score DESC);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260919000000_lead_scoring_reengajamento.sql
git commit -m "feat: migration for lead scoring + reengajamento columns"
```

---

### Task 2: Lead Scoring — Types and Selection

**Files:**
- Modify: `src/lib/motor-prospeccao/types.ts` — add score to LeadParaProspectar
- Modify: `src/lib/motor-prospeccao/selecao.ts` — add score to select, change ORDER BY

- [ ] **Step 1: Add `score` to LeadParaProspectar interface**

In `src/lib/motor-prospeccao/types.ts`, add `score: number;` to the `LeadParaProspectar` interface.

- [ ] **Step 2: Update selecionarLeads**

In `src/lib/motor-prospeccao/selecao.ts`:
1. Add `score` to the `.select()` string
2. Add `.order("score", { ascending: false })` between `dropado_power_dialer` and `ai_tentativas` orders:

```typescript
.order("dropado_power_dialer", { ascending: false, nullsFirst: false })
.order("score", { ascending: false })
.order("ai_tentativas", { ascending: true })
.order("google_rating", { ascending: false, nullsFirst: false })
.order("created_at", { ascending: true })
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/motor-prospeccao/types.ts src/lib/motor-prospeccao/selecao.ts
git commit -m "feat: lead scoring — add score to selection ordering"
```

---

### Task 3: Lead Scoring — Event Handlers

**Files:**
- Create: `src/lib/motor-prospeccao/lead-score.ts` — helper to increment score
- Modify: `src/app/api/webhooks/wpp/twilio/incoming/route.ts` — +30 on lead reply
- Modify: `src/lib/voz-ia/post-call.ts` — +20 on answered call
- Modify: `src/app/api/power-dialer/conference-event/[batchId]/route.ts` — +20 answered, +15 dropado

- [ ] **Step 1: Create lead-score helper**

Create `src/lib/motor-prospeccao/lead-score.ts`:

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function sb() {
  return createServiceRoleClient() as any;
}

export async function incrementLeadScore(leadGeradoId: string, points: number): Promise<void> {
  await sb().rpc("increment_lead_score", {
    lead_id: leadGeradoId,
    points,
  });
}
```

Wait — there's no RPC for this yet. Use a raw update instead:

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function sb() {
  return createServiceRoleClient() as any;
}

export async function incrementLeadScore(leadGeradoId: string, points: number): Promise<void> {
  const { data } = await sb()
    .from("leads_gerados")
    .select("score")
    .eq("id", leadGeradoId)
    .single();
  const currentScore = data?.score ?? 0;
  await sb()
    .from("leads_gerados")
    .update({ score: currentScore + points })
    .eq("id", leadGeradoId);
}
```

- [ ] **Step 2: Hook into WPP incoming webhook**

In `src/app/api/webhooks/wpp/twilio/incoming/route.ts`, after the message is inserted (around line 136), if the conversation has a `lead_gerado_id`:

```typescript
// Score: lead respondeu WPP
if (conv && convId) {
  const { data: convLead } = await sb
    .from("wpp_conversations")
    .select("lead_gerado_id")
    .eq("id", convId)
    .single();
  if (convLead?.lead_gerado_id) {
    const { incrementLeadScore } = await import("@/lib/motor-prospeccao/lead-score");
    await incrementLeadScore(convLead.lead_gerado_id, 30);
  }
}
```

Note: only increment once per lead (check if score already has the +30). Simplest approach: just increment every time — repeated responses mean even more engagement, higher score is fine.

- [ ] **Step 3: Hook into voz-ia post-call**

In `src/lib/voz-ia/post-call.ts`, when the call result is `atendida` and the lead_gerado_id is known:

```typescript
import { incrementLeadScore } from "@/lib/motor-prospeccao/lead-score";
// After determining the call was answered:
if (leadGeradoId) {
  await incrementLeadScore(leadGeradoId, 20);
}
```

- [ ] **Step 4: Hook into PD conference-event**

In `src/app/api/power-dialer/conference-event/[batchId]/route.ts`:

In `handleFirstAnswer`, after marking the answered call:
```typescript
await incrementLeadScore(answeredCall.lead_gerado_id, 20);
```

For dropped leads (in the otherCalls loop):
```typescript
await incrementLeadScore(other.lead_gerado_id, 15);
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/motor-prospeccao/lead-score.ts src/app/api/webhooks/wpp/twilio/incoming/route.ts src/lib/voz-ia/post-call.ts src/app/api/power-dialer/conference-event/\[batchId\]/route.ts
git commit -m "feat: lead scoring — increment score on WPP reply, call answered, PD events"
```

---

### Task 4: Reengajamento — Motor Worker

**Files:**
- Create: `src/lib/motor-prospeccao/reengajamento.ts` — selection + dispatch logic
- Modify: `src/lib/motor-prospeccao/worker.ts` — call reengajamento after main loop, set reengajamento_proxima when esgotado

- [ ] **Step 1: Create reengajamento module**

Create `src/lib/motor-prospeccao/reengajamento.ts`:

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function sb() { return createServiceRoleClient() as any; }

const REENGAJAMENTO_INTERVALOS_DIAS = [10, 25, 45, 10];
const MAX_REENGAJAMENTO = 4;
const MAX_REENGAJAMENTO_POR_RUN = 5;

export interface LeadReengajamento {
  id: string;
  empresa: string | null;
  telefone: string | null;
  whatsapp: string | null;
  reengajamento_tentativas: number;
}

export async function selecionarLeadsReengajamento(
  orgId: string,
): Promise<LeadReengajamento[]> {
  const now = new Date().toISOString();
  const { data } = await sb()
    .from("leads_gerados")
    .select("id, empresa, telefone, whatsapp, reengajamento_tentativas")
    .eq("organization_id", orgId)
    .eq("ai_status", "esgotado")
    .lt("reengajamento_tentativas", MAX_REENGAJAMENTO)
    .not("reengajamento_proxima", "is", null)
    .lte("reengajamento_proxima", now)
    .is("arquivado_em", null)
    .order("reengajamento_proxima", { ascending: true })
    .limit(MAX_REENGAJAMENTO_POR_RUN);

  return (data ?? []) as LeadReengajamento[];
}

export function calcularProximoReengajamento(tentativaAtual: number): number | null {
  if (tentativaAtual >= MAX_REENGAJAMENTO - 1) return null;
  return REENGAJAMENTO_INTERVALOS_DIAS[tentativaAtual + 1] ?? null;
}

export async function processarReengajamento(
  orgId: string,
  lead: LeadReengajamento,
  config: any,
  statusUrl: string,
): Promise<{ sucesso: boolean; erro?: string }> {
  const telefone = lead.whatsapp || lead.telefone;
  if (!telefone) return { sucesso: false, erro: "Sem telefone" };

  // Generate re-engagement message using a specific prompt
  const { gerarMensagemReengajamento } = await import("./gerar-mensagem");
  const msg = await gerarMensagemReengajamento(lead.empresa ?? "");

  // Send via Twilio WPP (same pattern as worker.ts primo contato)
  const { enviarViaTwilioWpp } = await import("./enviar-wpp");
  const result = await enviarViaTwilioWpp(telefone, config.twilio_wpp_from, msg, statusUrl);

  if ("error" in result) return { sucesso: false, erro: result.error };

  const tentativa = lead.reengajamento_tentativas + 1;
  const proximoDias = calcularProximoReengajamento(lead.reengajamento_tentativas);

  const updates: Record<string, any> = {
    reengajamento_tentativas: tentativa,
  };

  if (proximoDias !== null) {
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + proximoDias);
    updates.reengajamento_proxima = proxima.toISOString();
  } else {
    updates.ai_status = "descartado_definitivo";
    updates.reengajamento_proxima = null;
  }

  await sb().from("leads_gerados").update(updates).eq("id", lead.id);

  await sb().from("motor_prospeccao_log").insert({
    organization_id: orgId,
    lead_gerado_id: lead.id,
    acao: "reengajamento_wpp",
    modelo: "wpp_direto",
    detalhes: { mensagem: msg, telefone, tentativa },
  });

  return { sucesso: true };
}
```

Note: `enviarViaTwilioWpp` and `gerarMensagemReengajamento` need to be extracted/created. The implementer should:
1. Extract `enviarViaTwilio` from `worker.ts` into a shared `enviar-wpp.ts` (it's currently a local function in worker.ts)
2. Create `gerarMensagemReengajamento` in `gerar-mensagem.ts` — a simpler prompt that generates a fresh hook message for re-engagement

- [ ] **Step 2: Extract enviarViaTwilio to shared module**

Move the `enviarViaTwilio` function from `worker.ts` into a new file `src/lib/motor-prospeccao/enviar-wpp.ts` (export as `enviarViaTwilioWpp`). Update `worker.ts` to import from it instead.

- [ ] **Step 3: Add gerarMensagemReengajamento**

In `src/lib/motor-prospeccao/gerar-mensagem.ts`, add:

```typescript
export async function gerarMensagemReengajamento(empresa: string): Promise<string> {
  // Use a simpler prompt focused on re-engagement
  // Calls the same AI but with a different system prompt
  // Template: "Oi! Faz um tempinho que conversamos... [fresh hook]"
}
```

The implementer should look at the existing `gerarMensagemPrimeiroContato` for the pattern and adapt the prompt.

- [ ] **Step 4: Integrate into worker.ts**

In `executarMotor`, after the existing PD dispatch block and before `result.totalProcessados += ...`:

```typescript
// --- Reengajamento ---
if (wppRestante - wppEnviadosNoBatch > 0) {
  const { selecionarLeadsReengajamento, processarReengajamento } =
    await import("./reengajamento");
  const leadsReeng = await selecionarLeadsReengajamento(orgId);
  for (const lead of leadsReeng) {
    if ((wppRestante - wppEnviadosNoBatch) <= 0) break;
    const res = await processarReengajamento(orgId, lead, config, statusUrl);
    if (res.sucesso) wppEnviadosNoBatch++;
  }
}
```

- [ ] **Step 5: Set reengajamento_proxima when lead becomes esgotado**

In `processarLead` (worker.ts), where `ai_status` is set to `'esgotado'`:

```typescript
await sb()
  .from("leads_gerados")
  .update({
    ai_status: "esgotado",
    reengajamento_proxima: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    reengajamento_tentativas: 0,
  })
  .eq("id", lead.id);
```

- [ ] **Step 6: Handle lead response during reengajamento**

In `src/app/api/webhooks/wpp/twilio/incoming/route.ts`, after inserting the message, check if the lead's `ai_status` is `esgotado`:

```typescript
if (convAI && !convAI.ai_ativa) {
  // Check if this lead is in re-engagement
  const { data: leadData } = await sb
    .from("wpp_conversations")
    .select("lead_gerado_id")
    .eq("id", convId)
    .single();
  if (leadData?.lead_gerado_id) {
    const { data: lead } = await sb
      .from("leads_gerados")
      .select("ai_status")
      .eq("id", leadData.lead_gerado_id)
      .single();
    if (lead?.ai_status === "esgotado") {
      await sb
        .from("leads_gerados")
        .update({ ai_status: "aguardando" })
        .eq("id", leadData.lead_gerado_id);
      // Re-activate AI on this conversation
      await sb
        .from("wpp_conversations")
        .update({ ai_ativa: true })
        .eq("id", convId);
    }
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/motor-prospeccao/reengajamento.ts src/lib/motor-prospeccao/enviar-wpp.ts src/lib/motor-prospeccao/gerar-mensagem.ts src/lib/motor-prospeccao/worker.ts src/app/api/webhooks/wpp/twilio/incoming/route.ts
git commit -m "feat: automatic re-engagement cadence for exhausted leads"
```

---

### Task 5: Dashboard — Improved Funnel Queries

**Files:**
- Modify: `src/lib/motor-prospeccao/dashboard-queries.ts` — new `getFunilMotorPorPeriodo`, `getReengajamentoStats`

- [ ] **Step 1: Add period-filtered funnel query**

Replace `getFunilMotor` with `getFunilMotorPorPeriodo(orgId, dias)`:

Query `motor_prospeccao_log` with `criado_em >= now - dias` for:
- WPP enviados: `acao = 'wpp_primeiro_contato'`
- Ligações feitas: `acao IN ('ligacao_ia')` + count from `ligacoes` with `origem IN ('voz_ia', 'power_dialer')`
- Reuniões: `acao = 'reuniao_agendada'`
- Escalados: `acao = 'escalado_humano'`
- Sem interesse: `acao = 'sem_interesse'`
- Reengajamento: `acao = 'reengajamento_wpp'`

For "Responderam": count distinct `lead_gerado_id` from `wpp_conversations` where a `wpp_messages` with `autor = 'lead'` exists in the period.

For "Atenderam ligação": count from `ligacoes` with `status = 'atendida'` and `origem IN ('voz_ia', 'power_dialer')` in period.

For "Virou cliente": count from `leads_gerados` where `status = 'cliente'` and `updated_at` in period.

Return typed `FunilCompleto` with all stages + conversion rates calculated.

- [ ] **Step 2: Add reengajamento stats query**

```typescript
export async function getReengajamentoStats(orgId: string, dias: number) {
  // Count reengajamento_wpp logs in period
  // Count leads that responded during reengajamento (ai_status changed from esgotado to aguardando)
  // Return { enviados, responderam, taxa }
}
```

- [ ] **Step 3: Update getMotorStats to also accept period**

Make `getMotorStats` optionally accept `dias` parameter for period-filtered KPIs.

- [ ] **Step 4: Commit**

```bash
git add src/lib/motor-prospeccao/dashboard-queries.ts
git commit -m "feat: period-filtered funnel queries + reengajamento stats"
```

---

### Task 6: Dashboard — UI Components

**Files:**
- Modify: `src/app/(authed)/prospeccao/motor/page.tsx` — add period filter, pass to queries
- Modify: `src/components/motor-prospeccao/MotorFunil.tsx` — complete funnel with conversion rates
- Create: `src/components/motor-prospeccao/MotorPeriodoFilter.tsx` — client component for period toggle

- [ ] **Step 1: Create period filter component**

```typescript
"use client";
// Tabs or button group: 7d / 30d / 90d / Tudo
// Uses searchParams to persist selection
```

- [ ] **Step 2: Update MotorFunil**

Show horizontal bar chart with conversion rates between steps:
- Each bar shows the count
- Between bars, show the conversion rate percentage
- Use different colors for positive outcomes (reunião, cliente) vs negative (sem interesse)

- [ ] **Step 3: Add reengajamento card**

New card below the funnel showing:
- "Reengajados: X" / "Responderam: Y" / "Taxa: Z%"

- [ ] **Step 4: Update page.tsx**

Read `searchParams.dias` (default 30), pass to all query functions. Render period filter at top.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(authed\)/prospeccao/motor/page.tsx src/components/motor-prospeccao/MotorFunil.tsx src/components/motor-prospeccao/MotorPeriodoFilter.tsx
git commit -m "feat: improved motor dashboard with period filter and complete funnel"
```
