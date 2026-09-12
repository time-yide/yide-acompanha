# Comercial 100% IA — Fase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the AI-powered commercial system: AI responds to WhatsApp leads automatically, schedules meetings, orchestrates multi-channel cadence, and shows everything in a dashboard.

**Architecture:** Webhook-driven — when a lead replies to an automated WhatsApp, the incoming Twilio webhook triggers GPT-4o with function calling to continue the conversation, detect intent, and execute actions (schedule meetings, mark lost, escalate). A multi-channel cadence alternates WPP and voice calls. A dashboard shows funnel metrics.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), GPT-4o via fetch with function calling, Twilio WhatsApp REST API, Recharts, `createServiceRoleClient() as any`, `getServerEnv()` from `@/lib/env`

**Spec:** `docs/superpowers/specs/2026-09-12-comercial-ia-completo-design.md`

---

## Fase 2A: IA Conversacional + Agendamento

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260912400000_comercial_ia_fase2.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Comercial IA Fase 2 — cadência multi-canal + lembrete + índices

-- 1. Cadência multi-canal
CREATE TABLE IF NOT EXISTS public.cadencia_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES ai_voice_configs(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  canal text NOT NULL CHECK (canal IN ('whatsapp', 'ligacao')),
  dias_apos_anterior int NOT NULL DEFAULT 2,
  template_tipo text NOT NULL DEFAULT 'auto'
    CHECK (template_tipo IN ('auto', 'primeiro_contato', 'followup', 'ultimo')),
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE(config_id, ordem)
);

ALTER TABLE cadencia_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cadencia_steps_select" ON cadencia_steps
  FOR SELECT USING (
    config_id IN (
      SELECT id FROM ai_voice_configs
      WHERE organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "cadencia_steps_all_service" ON cadencia_steps
  FOR ALL USING (true) WITH CHECK (true);

-- 2. Lembrete de reunião IA
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS lembrete_ia_enviado boolean DEFAULT false;

-- 3. Índice pra dashboard
CREATE INDEX IF NOT EXISTS motor_log_acao_criado_idx
  ON motor_prospeccao_log(organization_id, acao, criado_em DESC);

-- 4. Índice pra buscar conversas com IA ativa
CREATE INDEX IF NOT EXISTS wpp_conv_ai_ativa_idx
  ON wpp_conversations(organization_id, ai_ativa)
  WHERE ai_ativa = true;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260912400000_comercial_ia_fase2.sql
git commit -m "chore(db): migration comercial IA fase 2 — cadencia_steps + lembrete + índices"
```

---

### Task 2: Types for conversational AI

**Files:**
- Create: `src/lib/motor-prospeccao/conversa-ia-types.ts`
- Modify: `src/lib/conversas/types.ts`

- [ ] **Step 1: Create conversa-ia-types.ts**

```typescript
export interface ConversaIAContext {
  conversationId: string;
  orgId: string;
  leadGeradoId: string | null;
  configId: string | null;
  systemPrompt: string;
  leadContext: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface ToolCallResult {
  action: "agendar_reuniao" | "marcar_sem_interesse" | "escalar_humano" | "encerrar_conversa";
  success: boolean;
  message?: string;
}

export const CONVERSA_IA_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "agendar_reuniao",
      description: "Agenda reunião quando o lead confirma data e horário.",
      parameters: {
        type: "object",
        properties: {
          data: { type: "string", description: "Data no formato YYYY-MM-DD" },
          horario: { type: "string", description: "Horário no formato HH:MM" },
          duracao_minutos: { type: "number", description: "Duração em minutos (padrão 30)" },
        },
        required: ["data", "horario"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "marcar_sem_interesse",
      description: "Lead não tem interesse. Usa quando lead recusa explicitamente.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Motivo dado pelo lead" },
        },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "escalar_humano",
      description: "Transfere pra humano. Usa quando lead pede pessoa real ou IA não sabe responder.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "Motivo da escalação" },
        },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "encerrar_conversa",
      description: "Conversa concluída (reunião marcada ou lead se despediu).",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
] as const;

export const OPT_OUT_KEYWORDS = [
  "sair", "parar", "cancelar", "pare", "não quero mais",
  "nao quero mais", "para de mandar", "me tire", "me tira",
  "remover", "remova", "desinscrever", "stop",
];

export const DEFAULT_WPP_SYSTEM_PROMPT = `Você é uma consultora da Yide Digital, agência de marketing digital, ecommerce e automação.
Conversa informal pelo WhatsApp (sem formalidade, pode usar "vc", "pra", "tbm").
Máximo 3 linhas por mensagem — ninguém lê textão no WhatsApp.

Seu objetivo: entender as dores do lead e agendar uma reunião de apresentação.

Adapte o pitch ao nicho:
- Restaurante/delivery → redes sociais + cardápio digital + iFood
- Loja/ecommerce → loja virtual + tráfego pago + CRM
- Clínica/saúde → Google Meu Negócio + agendamento online
- Escritório/serviços → site + automação de processos + CRM
- Salão/barbearia → Instagram + agendamento + fidelização

Regras:
- Se o lead demonstrar interesse, proponha horários pra reunião
- Se o lead disser "não quero" ou pedir pra parar, respeite IMEDIATAMENTE chamando marcar_sem_interesse
- Se o lead pedir pra falar com uma pessoa, chame escalar_humano
- NUNCA minta sobre preços ou serviços
- NUNCA invente cases ou números falsos
- Se não souber responder algo técnico, chame escalar_humano
- Não responda áudios ou imagens (peça pra digitar)`;
```

- [ ] **Step 2: Add `ia` to AutorMensagem in conversas/types.ts**

In `src/lib/conversas/types.ts`, update line 3:

```typescript
export type AutorMensagem = "lead" | "comercial" | "sistema" | "ia";
```

And add the `ai_ativa` and `ai_config_id` fields to `WppConversation`:

```typescript
export interface WppConversation {
  id: string;
  organization_id: string;
  contato_nome: string;
  contato_telefone: string;
  canal: CanalConversa;
  lead_gerado_id: string | null;
  lead_nome: string | null;
  ultimo_texto: string | null;
  ultima_msg_em: string | null;
  nao_lidas: number;
  arquivada: boolean;
  fixada: boolean;
  twilio_from: string | null;
  ai_ativa: boolean;
  ai_config_id: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/motor-prospeccao/conversa-ia-types.ts src/lib/conversas/types.ts
git commit -m "feat(motor): types para IA conversacional WPP + tools GPT-4o"
```

---

### Task 3: Opt-out checker

**Files:**
- Create: `src/lib/motor-prospeccao/opt-out.ts`

- [ ] **Step 1: Create opt-out module**

```typescript
import { OPT_OUT_KEYWORDS } from "./conversa-ia-types";

export function isOptOut(texto: string): boolean {
  const normalized = texto.toLowerCase().trim();
  return OPT_OUT_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function isMediaOnly(params: Record<string, string>): boolean {
  const numMedia = parseInt(params.NumMedia ?? "0", 10);
  const body = (params.Body ?? "").trim();
  return numMedia > 0 && body.length === 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/motor-prospeccao/opt-out.ts
git commit -m "feat(motor): opt-out checker + detecção de mídia"
```

---

### Task 4: Tool handlers (agendar, sem_interesse, escalar, encerrar)

**Files:**
- Create: `src/lib/motor-prospeccao/tool-handlers.ts`

These handlers execute the side effects when GPT-4o calls a function. They use `createServiceRoleClient()` because they run server-side from the webhook.

- [ ] **Step 1: Create tool-handlers.ts**

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ToolCallResult } from "./conversa-ia-types";

function sb() {
  return createServiceRoleClient() as any;
}

export async function handleAgendarReuniao(
  orgId: string,
  leadGeradoId: string | null,
  conversationId: string,
  args: { data: string; horario: string; duracao_minutos?: number },
): Promise<ToolCallResult> {
  const duracao = args.duracao_minutos ?? 30;
  const inicio = new Date(`${args.data}T${args.horario}:00-04:00`);
  const fim = new Date(inicio.getTime() + duracao * 60000);

  // Create calendar event
  await sb().from("calendar_events").insert({
    organization_id: orgId,
    titulo: "Reunião de apresentação (IA)",
    descricao: "Reunião agendada automaticamente pela IA via WhatsApp",
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
    sub_calendar: "comercial",
    origem: "lead_prospeccao",
    dia_inteiro: false,
  });

  // Update lead_gerado stage
  if (leadGeradoId) {
    await sb()
      .from("leads_gerados")
      .update({
        status: "reuniao_marcada",
        ai_status: "reuniao_agendada",
      })
      .eq("id", leadGeradoId);

    // Register attempt
    await sb().from("lead_attempts").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      tipo: "whatsapp",
      canal: "whatsapp",
      resultado: "agendou",
      notas: `Reunião agendada pela IA: ${args.data} às ${args.horario}`,
    }).catch(() => {});

    // Log
    await sb().from("motor_prospeccao_log").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      acao: "reuniao_agendada",
      modelo: "wpp_direto",
      detalhes: { data: args.data, horario: args.horario, duracao, conversation_id: conversationId },
    });
  }

  // Deactivate AI on this conversation (goal achieved)
  await sb()
    .from("wpp_conversations")
    .update({ ai_ativa: false })
    .eq("id", conversationId);

  return { action: "agendar_reuniao", success: true, message: "Reunião agendada" };
}

export async function handleMarcarSemInteresse(
  orgId: string,
  leadGeradoId: string | null,
  conversationId: string,
  args: { motivo: string },
): Promise<ToolCallResult> {
  if (leadGeradoId) {
    await sb()
      .from("leads_gerados")
      .update({
        status: "descartado",
        ai_status: "sem_interesse",
        motivo_descarte: args.motivo,
      })
      .eq("id", leadGeradoId);

    await sb().from("lead_attempts").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      tipo: "whatsapp",
      canal: "whatsapp",
      resultado: "recusou",
      notas: `Sem interesse: ${args.motivo}`,
    }).catch(() => {});

    await sb().from("motor_prospeccao_log").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      acao: "sem_interesse",
      modelo: "wpp_direto",
      detalhes: { motivo: args.motivo, conversation_id: conversationId },
    });
  }

  await sb()
    .from("wpp_conversations")
    .update({ ai_ativa: false })
    .eq("id", conversationId);

  return { action: "marcar_sem_interesse", success: true };
}

export async function handleEscalarHumano(
  orgId: string,
  leadGeradoId: string | null,
  conversationId: string,
  args: { motivo: string },
): Promise<ToolCallResult> {
  // Deactivate AI
  await sb()
    .from("wpp_conversations")
    .update({ ai_ativa: false })
    .eq("id", conversationId);

  // Create notification for admins/sócios
  const { data: admins } = await sb()
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .in("role", ["adm", "socio"]);

  if (admins && admins.length > 0) {
    const { data: conv } = await sb()
      .from("wpp_conversations")
      .select("contato_nome")
      .eq("id", conversationId)
      .single();

    const nome = conv?.contato_nome ?? "Lead";

    const notifs = (admins as { id: string }[]).map((a) => ({
      user_id: a.id,
      organization_id: orgId,
      tipo: "wpp_escalacao",
      titulo: `${nome} pediu pra falar com humano`,
      mensagem: args.motivo,
      link: `/conversas`,
    }));

    await sb().from("notifications").insert(notifs).catch(() => {});
  }

  if (leadGeradoId) {
    await sb()
      .from("leads_gerados")
      .update({ ai_status: "escalado_humano" })
      .eq("id", leadGeradoId);

    await sb().from("motor_prospeccao_log").insert({
      organization_id: orgId,
      lead_gerado_id: leadGeradoId,
      acao: "escalado_humano",
      modelo: "wpp_direto",
      detalhes: { motivo: args.motivo, conversation_id: conversationId },
    });
  }

  return { action: "escalar_humano", success: true };
}

export async function handleEncerrarConversa(
  conversationId: string,
): Promise<ToolCallResult> {
  await sb()
    .from("wpp_conversations")
    .update({ ai_ativa: false })
    .eq("id", conversationId);

  return { action: "encerrar_conversa", success: true };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/motor-prospeccao/tool-handlers.ts
git commit -m "feat(motor): tool handlers — agendar reunião, sem interesse, escalar, encerrar"
```

---

### Task 5: Conversational AI core (GPT-4o with function calling)

**Files:**
- Create: `src/lib/motor-prospeccao/conversa-ia.ts`

This is the core module that builds context, calls GPT-4o, processes tool calls, and returns the AI's text response.

- [ ] **Step 1: Create conversa-ia.ts**

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import {
  CONVERSA_IA_TOOLS,
  DEFAULT_WPP_SYSTEM_PROMPT,
} from "./conversa-ia-types";
import type { ConversaIAContext } from "./conversa-ia-types";
import {
  handleAgendarReuniao,
  handleMarcarSemInteresse,
  handleEscalarHumano,
  handleEncerrarConversa,
} from "./tool-handlers";

function sb() {
  return createServiceRoleClient() as any;
}

export async function buildConversaContext(
  conversationId: string,
): Promise<ConversaIAContext | null> {
  // Load conversation with AI config
  const { data: conv } = await sb()
    .from("wpp_conversations")
    .select("id, organization_id, lead_gerado_id, ai_config_id, contato_nome")
    .eq("id", conversationId)
    .single();

  if (!conv) return null;

  // Load AI config (if exists)
  let systemPrompt = DEFAULT_WPP_SYSTEM_PROMPT;
  if (conv.ai_config_id) {
    const { data: config } = await sb()
      .from("ai_voice_configs")
      .select("wpp_system_prompt")
      .eq("id", conv.ai_config_id)
      .single();

    if (config?.wpp_system_prompt?.trim()) {
      systemPrompt = config.wpp_system_prompt;
    }
  }

  // Load lead context
  let leadContext = "";
  if (conv.lead_gerado_id) {
    const { data: lead } = await sb()
      .from("leads_gerados")
      .select("empresa, categoria, cidade, estado, website, google_rating, google_reviews_count, porte_empresa, decisor_nome")
      .eq("id", conv.lead_gerado_id)
      .single();

    if (lead) {
      const parts = [`Empresa: ${lead.empresa}`];
      if (lead.categoria) parts.push(`Categoria: ${lead.categoria}`);
      if (lead.cidade) parts.push(`Cidade: ${lead.cidade}${lead.estado ? `-${lead.estado}` : ""}`);
      parts.push(`Tem site: ${lead.website ? "sim" : "não"}`);
      if (lead.google_rating) parts.push(`Rating Google: ${lead.google_rating} (${lead.google_reviews_count ?? 0} avaliações)`);
      if (lead.porte_empresa) parts.push(`Porte: ${lead.porte_empresa}`);
      if (lead.decisor_nome) parts.push(`Contato: ${lead.decisor_nome}`);
      leadContext = parts.join("\n");
    }
  }

  // Load message history (last 20)
  const { data: msgs } = await sb()
    .from("wpp_messages")
    .select("autor, texto")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(20);

  const messages = (msgs ?? []).map((m: { autor: string; texto: string }) => ({
    role: (m.autor === "lead" ? "user" : "assistant") as "user" | "assistant",
    content: m.texto,
  }));

  return {
    conversationId: conv.id,
    orgId: conv.organization_id,
    leadGeradoId: conv.lead_gerado_id,
    configId: conv.ai_config_id,
    systemPrompt,
    leadContext,
    messages,
  };
}

export async function gerarRespostaIA(
  ctx: ConversaIAContext,
): Promise<{ texto: string; toolCalled?: string } | { error: string }> {
  const env = getServerEnv();
  if (!env.OPENAI_API_KEY) return { error: "OPENAI_API_KEY não configurada" };

  const systemContent = ctx.leadContext
    ? `${ctx.systemPrompt}\n\n--- Dados do lead ---\n${ctx.leadContext}`
    : ctx.systemPrompt;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemContent },
        ...ctx.messages,
      ],
      tools: CONVERSA_IA_TOOLS,
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { error: `OpenAI ${resp.status}: ${text.slice(0, 200)}` };
  }

  const data = await resp.json();
  const choice = data.choices?.[0];
  if (!choice) return { error: "OpenAI retornou resposta vazia" };

  const msg = choice.message;

  // Process tool calls if any
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const toolCall = msg.tool_calls[0];
    const fnName = toolCall.function.name;
    const fnArgs = JSON.parse(toolCall.function.arguments || "{}");

    switch (fnName) {
      case "agendar_reuniao":
        await handleAgendarReuniao(ctx.orgId, ctx.leadGeradoId, ctx.conversationId, fnArgs);
        break;
      case "marcar_sem_interesse":
        await handleMarcarSemInteresse(ctx.orgId, ctx.leadGeradoId, ctx.conversationId, fnArgs);
        break;
      case "escalar_humano":
        await handleEscalarHumano(ctx.orgId, ctx.leadGeradoId, ctx.conversationId, fnArgs);
        break;
      case "encerrar_conversa":
        await handleEncerrarConversa(ctx.conversationId);
        break;
    }

    // GPT-4o may return text alongside the tool call
    const texto = msg.content?.trim() || "";
    return { texto, toolCalled: fnName };
  }

  return { texto: msg.content?.trim() || "" };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/motor-prospeccao/conversa-ia.ts
git commit -m "feat(motor): core da IA conversacional — context builder + GPT-4o com tools"
```

---

### Task 6: Modify incoming webhook to trigger AI

**Files:**
- Modify: `src/app/api/webhooks/wpp/twilio/incoming/route.ts`

After the message is saved and `increment_nao_lidas` is called, add the AI response logic. The webhook must return within 15s (Twilio timeout), and GPT-4o typically responds in 1-3s.

- [ ] **Step 1: Add AI imports at the top of route.ts**

After the existing imports, add:

```typescript
import { isOptOut, isMediaOnly } from "@/lib/motor-prospeccao/opt-out";
import { buildConversaContext, gerarRespostaIA } from "@/lib/motor-prospeccao/conversa-ia";
import { handleMarcarSemInteresse } from "@/lib/motor-prospeccao/tool-handlers";
import { isHorarioComercial } from "@/lib/motor-prospeccao/categorias";
```

- [ ] **Step 2: Add AI response block after `increment_nao_lidas` call**

After the line `await sb.rpc("increment_nao_lidas", ...)` and before `return twimlResponse()`, add:

```typescript
  // --- IA Conversacional ---
  // Check if AI is active on this conversation
  const { data: convAI } = await sb
    .from("wpp_conversations")
    .select("ai_ativa, ai_config_id")
    .eq("id", convId)
    .single();

  if (convAI?.ai_ativa) {
    try {
      // Opt-out check (before AI — mandatory)
      if (isOptOut(body)) {
        await handleMarcarSemInteresse(orgId, null, convId, {
          motivo: "Lead pediu pra parar (opt-out)",
        });
        // Find lead_gerado_id for the opt-out
        const { data: convLead } = await sb
          .from("wpp_conversations")
          .select("lead_gerado_id")
          .eq("id", convId)
          .single();
        if (convLead?.lead_gerado_id) {
          await handleMarcarSemInteresse(orgId, convLead.lead_gerado_id, convId, {
            motivo: "Lead pediu pra parar (opt-out)",
          });
        }
        const optOutMsg = "Sem problema, não vou mais te enviar mensagens. Desculpa o incômodo!";
        await enviarRespostaIA(sb, convId, orgId, optOutMsg, env);
        return twimlResponse();
      }

      // Media-only check
      if (isMediaOnly(params)) {
        const mediaMsg = "Desculpa, por enquanto só consigo ler mensagens de texto! Pode digitar pra mim?";
        await enviarRespostaIA(sb, convId, orgId, mediaMsg, env);
        return twimlResponse();
      }

      // Business hours check — if outside hours, don't respond (lead will get response next morning)
      const now = new Date();
      const { data: aiConfig } = await sb
        .from("ai_voice_configs")
        .select("horario_inicio, horario_fim, horario_inicio_fds, horario_fim_fds")
        .eq("id", convAI.ai_config_id)
        .single();

      if (aiConfig && !isHorarioComercial(now, aiConfig)) {
        return twimlResponse();
      }

      // Build context and generate AI response
      const ctx = await buildConversaContext(convId);
      if (ctx) {
        const result = await gerarRespostaIA(ctx);
        if ("texto" in result && result.texto) {
          await enviarRespostaIA(sb, convId, orgId, result.texto, env);
        }
      }
    } catch (err) {
      console.error("[wpp-webhook] Erro na IA conversacional:", err);
    }
  }
```

- [ ] **Step 3: Add the `enviarRespostaIA` helper function before `twimlResponse`**

```typescript
async function enviarRespostaIA(
  supabase: any,
  conversationId: string,
  orgId: string,
  texto: string,
  env: ReturnType<typeof getServerEnv>,
) {
  // Get conversation's twilio_from and contato_telefone
  const { data: conv } = await supabase
    .from("wpp_conversations")
    .select("contato_telefone, twilio_from")
    .eq("id", conversationId)
    .single();

  if (!conv?.twilio_from || !conv?.contato_telefone) return;

  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return;

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    From: `whatsapp:${conv.twilio_from}`,
    To: `whatsapp:${conv.contato_telefone}`,
    Body: texto,
    StatusCallback: `${appUrl}/api/webhooks/wpp/twilio/status`,
  });

  const resp = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  let twilioSid: string | null = null;
  if (resp.ok) {
    const result = await resp.json();
    twilioSid = result.sid ?? null;
  }

  // Save AI message
  await supabase.from("wpp_messages").insert({
    conversation_id: conversationId,
    organization_id: orgId,
    autor: "ia",
    texto,
    twilio_sid: twilioSid,
    status: twilioSid ? "enviada" : "falhou",
  });

  // Update conversation preview
  await supabase
    .from("wpp_conversations")
    .update({
      ultimo_texto: texto.slice(0, 200),
      ultima_msg_em: new Date().toISOString(),
    })
    .eq("id", conversationId);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/wpp/twilio/incoming/route.ts
git commit -m "feat(motor): webhook WPP responde com IA quando ai_ativa=true"
```

---

### Task 7: Motor worker sets ai_ativa=true on new conversations

**Files:**
- Modify: `src/lib/motor-prospeccao/worker.ts`

- [ ] **Step 1: In `findOrCreateConversation`, change `ai_ativa: false` to `ai_ativa: true`**

In `src/lib/motor-prospeccao/worker.ts`, find the `.insert` call in `findOrCreateConversation` (around line 33) and change:

```typescript
      ai_ativa: true,
```

Also add `ai_config_id` — it needs to be passed as a parameter. Update the function signature:

```typescript
async function findOrCreateConversation(
  orgId: string,
  telefone: string,
  twilioFrom: string,
  leadId: string,
  empresa: string,
  configId: string | null,
): Promise<string | null> {
```

And the insert:

```typescript
    const { data: conv } = await sb()
      .from("wpp_conversations")
      .insert({
        organization_id: orgId,
        contato_nome: empresa,
        contato_telefone: telefone,
        canal: "whatsapp",
        lead_gerado_id: leadId,
        twilio_from: twilioFrom,
        nao_lidas: 0,
        ai_ativa: true,
        ai_config_id: configId,
      })
      .select("id")
      .single();
```

For existing conversations, also activate AI:

```typescript
  if (existing) {
    // Activate AI on existing conversation too
    await sb()
      .from("wpp_conversations")
      .update({ ai_ativa: true, ai_config_id: configId })
      .eq("id", (existing as any).id);
    return (existing as any).id;
  }
```

- [ ] **Step 2: Update the call to `findOrCreateConversation` in `processarLead`**

In `processarLead`, pass `config.id` as the last argument:

```typescript
  const convId = await findOrCreateConversation(
    orgId, telefone, twilioFrom, lead.id, lead.empresa, config.id,
  );
```

This requires `config` to have an `id` field. Check that `getOrgsComMotorAtivo` returns the config id. In `src/lib/motor-prospeccao/selecao.ts`, the `getOrgsComMotorAtivo` function selects from `ai_voice_configs`. Ensure the `id` field is included in the select.

- [ ] **Step 3: Commit**

```bash
git add src/lib/motor-prospeccao/worker.ts
git commit -m "feat(motor): worker ativa ai_ativa=true nas conversas criadas"
```

---

### Task 8: Badge "IA ativa" + botão "Assumir" no chat

**Files:**
- Create: `src/components/conversas/BadgeIAAtiva.tsx`
- Modify: `src/components/conversas/ChatHeader.tsx`

- [ ] **Step 1: Create BadgeIAAtiva component**

```typescript
"use client";

import { useState } from "react";

interface Props {
  conversationId: string;
  aiAtiva: boolean;
}

export function BadgeIAAtiva({ conversationId, aiAtiva: initialAiAtiva }: Props) {
  const [aiAtiva, setAiAtiva] = useState(initialAiAtiva);
  const [loading, setLoading] = useState(false);

  async function toggleIA() {
    setLoading(true);
    try {
      const resp = await fetch("/api/conversas/toggle-ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, aiAtiva: !aiAtiva }),
      });
      if (resp.ok) setAiAtiva(!aiAtiva);
    } finally {
      setLoading(false);
    }
  }

  if (!aiAtiva) {
    return (
      <button
        onClick={toggleIA}
        disabled={loading}
        className="rounded-full border border-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {loading ? "..." : "Reativar IA"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
        IA ativa
      </span>
      <button
        onClick={toggleIA}
        disabled={loading}
        className="rounded-full border border-muted px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {loading ? "..." : "Assumir"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create the toggle-ia API route**

Create `src/app/api/conversas/toggle-ia/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(req: NextRequest) {
  await requireAuth();

  const { conversationId, aiAtiva } = await req.json();
  if (!conversationId || typeof aiAtiva !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const sb = createServiceRoleClient() as any;
  await sb
    .from("wpp_conversations")
    .update({ ai_ativa: aiAtiva })
    .eq("id", conversationId);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Integrate BadgeIAAtiva into ChatHeader**

Read `src/components/conversas/ChatHeader.tsx` to understand its current props and structure. Add the `BadgeIAAtiva` component next to the contact name. The ChatHeader likely receives the conversation object — add `ai_ativa` to whatever prop type it uses, and render:

```tsx
<BadgeIAAtiva conversationId={conversation.id} aiAtiva={conversation.ai_ativa ?? false} />
```

Place it after the contact name/phone area. Also ensure the conversation query in the chat page includes `ai_ativa` in its select.

- [ ] **Step 4: Commit**

```bash
git add src/components/conversas/BadgeIAAtiva.tsx src/app/api/conversas/toggle-ia/route.ts src/components/conversas/ChatHeader.tsx
git commit -m "feat(conversas): badge 'IA ativa' + botão assumir/reativar no chat"
```

---

### Task 9: Lembrete de reunião (cron addition)

**Files:**
- Create: `src/lib/motor-prospeccao/lembrete-reuniao.ts`
- Modify: `src/app/api/cron/motor-prospeccao/route.ts`

- [ ] **Step 1: Create lembrete-reuniao.ts**

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";

function sb() {
  return createServiceRoleClient() as any;
}

export async function enviarLembretesReuniao(): Promise<number> {
  const env = getServerEnv();
  const accountSid = env.TWILIO_ACCOUNT_SID;
  const authToken = env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return 0;

  // Find meetings in the next 24h that haven't had a reminder sent
  // and were created by the AI (origem = 'lead_prospeccao', sub_calendar = 'comercial')
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: events } = await sb()
    .from("calendar_events")
    .select("id, organization_id, titulo, inicio")
    .eq("origem", "lead_prospeccao")
    .eq("sub_calendar", "comercial")
    .eq("lembrete_ia_enviado", false)
    .gte("inicio", now.toISOString())
    .lte("inicio", in24h.toISOString());

  if (!events || events.length === 0) return 0;

  let sent = 0;

  for (const event of events) {
    // Find the motor_prospeccao_log entry for this meeting to get the conversation
    const { data: log } = await sb()
      .from("motor_prospeccao_log")
      .select("detalhes, lead_gerado_id")
      .eq("organization_id", event.organization_id)
      .eq("acao", "reuniao_agendada")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!log?.detalhes?.conversation_id) continue;

    const convId = log.detalhes.conversation_id;
    const { data: conv } = await sb()
      .from("wpp_conversations")
      .select("contato_telefone, twilio_from, contato_nome")
      .eq("id", convId)
      .single();

    if (!conv?.twilio_from || !conv?.contato_telefone) continue;

    // Format meeting time
    const meetingDate = new Date(event.inicio);
    const hora = meetingDate.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Cuiaba",
    });
    const dia = meetingDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Cuiaba",
    });

    const texto = `Oi${conv.contato_nome ? ` ${conv.contato_nome.split(" ")[0]}` : ""}! Lembrando da nossa reunião ${dia} às ${hora}. Até lá!`;

    const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({
      From: `whatsapp:${conv.twilio_from}`,
      To: `whatsapp:${conv.contato_telefone}`,
      Body: texto,
      StatusCallback: `${appUrl}/api/webhooks/wpp/twilio/status`,
    });

    const resp = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (resp.ok) {
      const result = await resp.json();

      await sb().from("wpp_messages").insert({
        conversation_id: convId,
        organization_id: event.organization_id,
        autor: "sistema",
        texto,
        twilio_sid: result.sid ?? null,
        status: "enviada",
      });

      await sb()
        .from("calendar_events")
        .update({ lembrete_ia_enviado: true })
        .eq("id", event.id);

      sent++;
    }
  }

  return sent;
}
```

- [ ] **Step 2: Add lembrete call to the cron route**

In `src/app/api/cron/motor-prospeccao/route.ts`, import and call `enviarLembretesReuniao` after `executarMotor`:

```typescript
import { enviarLembretesReuniao } from "@/lib/motor-prospeccao/lembrete-reuniao";
```

After the `executarMotor()` call, add:

```typescript
  const lembretes = await enviarLembretesReuniao();
```

Include `lembretes` in the JSON response.

- [ ] **Step 3: Commit**

```bash
git add src/lib/motor-prospeccao/lembrete-reuniao.ts src/app/api/cron/motor-prospeccao/route.ts
git commit -m "feat(motor): lembrete automático de reunião 24h antes via WPP"
```

---

### Task 10: Fase 2A — type-check, lint, PR

- [ ] **Step 1: Type-check**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Only fix errors in NEW/modified files.

- [ ] **Step 3: Commit fixes if any**

- [ ] **Step 4: Push and create PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: IA conversacional WPP + agendamento automático + lembrete (Fase 2A)" --body "..."
```

---

## Fase 2B: Cadência Multi-canal

### Task 11: Cadência types and queries

**Files:**
- Create: `src/lib/motor-prospeccao/cadencia.ts`

- [ ] **Step 1: Create cadencia.ts**

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function sb() {
  return createServiceRoleClient() as any;
}

export interface CadenciaStep {
  id: string;
  config_id: string;
  ordem: number;
  canal: "whatsapp" | "ligacao";
  dias_apos_anterior: number;
  template_tipo: "auto" | "primeiro_contato" | "followup" | "ultimo";
  ativo: boolean;
}

export const CADENCIA_PADRAO: Omit<CadenciaStep, "id" | "config_id">[] = [
  { ordem: 1, canal: "whatsapp", dias_apos_anterior: 0, template_tipo: "primeiro_contato", ativo: true },
  { ordem: 2, canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true },
  { ordem: 3, canal: "ligacao", dias_apos_anterior: 2, template_tipo: "auto", ativo: true },
  { ordem: 4, canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true },
  { ordem: 5, canal: "ligacao", dias_apos_anterior: 3, template_tipo: "auto", ativo: true },
  { ordem: 6, canal: "whatsapp", dias_apos_anterior: 3, template_tipo: "ultimo", ativo: true },
];

export async function getStepsDaCadencia(configId: string): Promise<CadenciaStep[]> {
  const { data } = await sb()
    .from("cadencia_steps")
    .select("*")
    .eq("config_id", configId)
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  if (!data || data.length === 0) return [];
  return data as CadenciaStep[];
}

export function calcularStepAtual(
  aiTentativas: number,
  steps: CadenciaStep[],
): CadenciaStep | null {
  if (steps.length === 0) return null;
  const idx = aiTentativas;
  if (idx >= steps.length) return null;
  return steps[idx];
}

export function calcularDiasDesdeUltimaTentativa(
  aiProximaTentativa: string | null,
): boolean {
  if (!aiProximaTentativa) return true;
  return new Date() >= new Date(aiProximaTentativa);
}

export async function seedCadenciaPadrao(configId: string): Promise<void> {
  const existing = await getStepsDaCadencia(configId);
  if (existing.length > 0) return;

  const rows = CADENCIA_PADRAO.map((step) => ({
    ...step,
    config_id: configId,
  }));

  await sb().from("cadencia_steps").insert(rows);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/motor-prospeccao/cadencia.ts
git commit -m "feat(motor): cadência multi-canal — types, queries, seed padrão"
```

---

### Task 12: Modify worker to use cadência

**Files:**
- Modify: `src/lib/motor-prospeccao/worker.ts`

- [ ] **Step 1: Import cadência functions**

```typescript
import { getStepsDaCadencia, calcularStepAtual, seedCadenciaPadrao } from "./cadencia";
```

- [ ] **Step 2: Modify `processarLead` to check the cadência step**

Before generating the message, determine which step the lead is on:

```typescript
async function processarLead(
  orgId: string,
  lead: LeadParaProspectar,
  config: any,
  statusUrl: string,
): Promise<{ acao: string; erro?: string }> {
  // Seed cadência if none exists
  await seedCadenciaPadrao(config.id);
  const steps = await getStepsDaCadencia(config.id);
  const step = calcularStepAtual(lead.ai_tentativas, steps);

  if (!step) {
    // All steps exhausted
    await sb().from("leads_gerados").update({ ai_status: "esgotado" }).eq("id", lead.id);
    return { acao: "esgotado" };
  }

  if (step.canal === "ligacao") {
    // Trigger voice call via existing Voz IA infrastructure
    return await processarLigacao(orgId, lead, config);
  }

  // WhatsApp flow (existing logic, adapted for template_tipo)
  return await processarWpp(orgId, lead, config, statusUrl, step.template_tipo);
}
```

- [ ] **Step 3: Extract existing WPP logic into `processarWpp`**

Move the existing WPP sending logic into a `processarWpp` function. The `template_tipo` affects the prompt:
- `primeiro_contato` → use existing `gerarMensagemPrimeiroContato`
- `followup` → use a follow-up prompt ("Oi, mandei mensagem alguns dias atrás...")
- `ultimo` → use a final attempt prompt ("Última tentativa de contato...")
- `auto` → use `gerarMensagemPrimeiroContato` (default)

- [ ] **Step 4: Add `processarLigacao` stub**

```typescript
async function processarLigacao(
  orgId: string,
  lead: LeadParaProspectar,
  config: any,
): Promise<{ acao: string; erro?: string }> {
  // TODO Fase 3: integrate with iniciarLigacaoIA from src/lib/voz-ia/actions.ts
  // For now, skip voice calls and log
  await sb().from("motor_prospeccao_log").insert({
    organization_id: orgId,
    lead_gerado_id: lead.id,
    acao: "ligacao_ia",
    modelo: "ligacao_wpp",
    detalhes: { nota: "Ligação IA pendente — integração em Fase 3" },
  });
  return { acao: "ligacao_ia" };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/motor-prospeccao/worker.ts
git commit -m "feat(motor): worker usa cadência multi-canal em vez de WPP fixo"
```

---

### Task 13: Cadência config UI

**Files:**
- Create: `src/components/voz-ia/CadenciaConfig.tsx`
- Modify: `src/components/voz-ia/ConfigVozIAForm.tsx`
- Create: `src/app/api/voz-ia/cadencia/route.ts`

- [ ] **Step 1: Create API route for cadência CRUD**

`src/app/api/voz-ia/cadencia/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(req: NextRequest) {
  await requireAuth();
  const configId = req.nextUrl.searchParams.get("configId");
  if (!configId) return NextResponse.json({ error: "configId obrigatório" }, { status: 400 });

  const sb = createServiceRoleClient() as any;
  const { data } = await sb
    .from("cadencia_steps")
    .select("*")
    .eq("config_id", configId)
    .order("ordem", { ascending: true });

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  await requireAuth();
  const { configId, steps } = await req.json();
  if (!configId || !Array.isArray(steps)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const sb = createServiceRoleClient() as any;

  // Delete existing steps and insert new ones
  await sb.from("cadencia_steps").delete().eq("config_id", configId);

  if (steps.length > 0) {
    const rows = steps.map((s: any, i: number) => ({
      config_id: configId,
      ordem: i + 1,
      canal: s.canal,
      dias_apos_anterior: s.dias_apos_anterior,
      template_tipo: s.template_tipo,
      ativo: s.ativo ?? true,
    }));
    await sb.from("cadencia_steps").insert(rows);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create CadenciaConfig component**

`src/components/voz-ia/CadenciaConfig.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";

interface Step {
  canal: "whatsapp" | "ligacao";
  dias_apos_anterior: number;
  template_tipo: string;
  ativo: boolean;
}

interface Props {
  configId: string | null;
}

const DEFAULT_STEPS: Step[] = [
  { canal: "whatsapp", dias_apos_anterior: 0, template_tipo: "primeiro_contato", ativo: true },
  { canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true },
  { canal: "ligacao", dias_apos_anterior: 2, template_tipo: "auto", ativo: true },
  { canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true },
  { canal: "ligacao", dias_apos_anterior: 3, template_tipo: "auto", ativo: true },
  { canal: "whatsapp", dias_apos_anterior: 3, template_tipo: "ultimo", ativo: true },
];

export function CadenciaConfig({ configId }: Props) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!configId) return;
    fetch(`/api/voz-ia/cadencia?configId=${configId}`)
      .then((r) => r.json())
      .then((data) => {
        setSteps(data.length > 0 ? data : DEFAULT_STEPS);
        setLoaded(true);
      })
      .catch(() => {
        setSteps(DEFAULT_STEPS);
        setLoaded(true);
      });
  }, [configId]);

  async function handleSave() {
    if (!configId) return;
    setSaving(true);
    await fetch("/api/voz-ia/cadencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configId, steps }),
    });
    setSaving(false);
  }

  function addStep() {
    setSteps([...steps, { canal: "whatsapp", dias_apos_anterior: 2, template_tipo: "followup", ativo: true }]);
  }

  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  function updateStep(idx: number, field: string, value: any) {
    const updated = [...steps];
    (updated[idx] as any)[field] = value;
    setSteps(updated);
  }

  function restoreDefault() {
    setSteps([...DEFAULT_STEPS]);
  }

  if (!configId || !loaded) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Steps da cadência</h3>
        <button
          type="button"
          onClick={restoreDefault}
          className="text-xs text-muted-foreground hover:underline"
        >
          Restaurar padrão
        </button>
      </div>

      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2 rounded border p-2">
          <span className="text-xs font-medium text-muted-foreground w-6">{i + 1}.</span>
          <select
            value={step.canal}
            onChange={(e) => updateStep(i, "canal", e.target.value)}
            className="rounded border bg-background px-2 py-1 text-xs"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="ligacao">Ligação</option>
          </select>
          <label className="flex items-center gap-1 text-xs">
            após
            <input
              type="number"
              min={0}
              max={30}
              value={step.dias_apos_anterior}
              onChange={(e) => updateStep(i, "dias_apos_anterior", parseInt(e.target.value) || 0)}
              className="w-12 rounded border bg-background px-1 py-1 text-xs"
            />
            dias
          </label>
          <select
            value={step.template_tipo}
            onChange={(e) => updateStep(i, "template_tipo", e.target.value)}
            className="rounded border bg-background px-2 py-1 text-xs"
          >
            <option value="primeiro_contato">1º contato</option>
            <option value="followup">Follow-up</option>
            <option value="ultimo">Último</option>
            <option value="auto">Auto</option>
          </select>
          <button
            type="button"
            onClick={() => removeStep(i)}
            className="ml-auto text-xs text-red-500 hover:underline"
          >
            Remover
          </button>
        </div>
      ))}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={addStep}
          className="rounded border px-3 py-1 text-xs hover:bg-muted"
        >
          + Adicionar step
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-primary px-3 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar cadência"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add CadenciaConfig to ConfigVozIAForm**

In `src/components/voz-ia/ConfigVozIAForm.tsx`, import and render `CadenciaConfig` inside the "Motor de Prospecção" section, after the `wpp_primeiro_contato_prompt` textarea:

```tsx
import { CadenciaConfig } from "./CadenciaConfig";

// Inside the form, after the wpp_primeiro_contato_prompt textarea:
<div className="border-t pt-4">
  <h3 className="text-sm font-semibold mb-2">Cadência de Prospecção</h3>
  <p className="text-xs text-muted-foreground mb-3">
    Sequência de contatos automáticos. O motor executa cada step no intervalo configurado.
  </p>
  <CadenciaConfig configId={config?.id ?? null} />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/voz-ia/cadencia/route.ts src/components/voz-ia/CadenciaConfig.tsx src/components/voz-ia/ConfigVozIAForm.tsx
git commit -m "feat(motor): UI de configuração da cadência multi-canal"
```

---

### Task 14: Fase 2B — type-check, lint, PR

- [ ] **Step 1: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 2: Fix any issues in new/modified files**

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: cadência multi-canal WPP+ligação configurável (Fase 2B)" --body "..."
```

---

## Fase 2C: Dashboard do Motor

### Task 15: Dashboard queries

**Files:**
- Create: `src/lib/motor-prospeccao/dashboard-queries.ts`

- [ ] **Step 1: Create dashboard-queries.ts**

```typescript
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function sb() {
  return createServiceRoleClient() as any;
}

export interface MotorStats {
  wppEnviadosHoje: number;
  maxWppDia: number;
  conversasAtivas: number;
  reunioesAgendadasSemana: number;
  taxaResposta: number;
}

export interface FunilItem {
  label: string;
  valor: number;
}

export interface AtividadeDiaria {
  dia: string;
  enviadas: number;
  recebidas: number;
}

export interface NichoPerformance {
  nicho: string;
  enviados: number;
  responderam: number;
  taxaResposta: number;
}

export interface ConversaAtiva {
  id: string;
  contato_nome: string;
  lead_categoria: string | null;
  ultimo_texto: string | null;
  ultima_msg_em: string | null;
  total_mensagens: number;
}

export async function getMotorStats(orgId: string): Promise<MotorStats> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeISO = hoje.toISOString();

  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  inicioSemana.setHours(0, 0, 0, 0);

  const [wppHoje, config, conversasAtivas, reunioes, totalEnviados, totalResponderam] =
    await Promise.all([
      sb()
        .from("motor_prospeccao_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("acao", "wpp_primeiro_contato")
        .gte("criado_em", hojeISO),
      sb()
        .from("ai_voice_configs")
        .select("max_wpp_dia")
        .eq("organization_id", orgId)
        .eq("ativo", true)
        .maybeSingle(),
      sb()
        .from("wpp_conversations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("ai_ativa", true),
      sb()
        .from("motor_prospeccao_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("acao", "reuniao_agendada")
        .gte("criado_em", inicioSemana.toISOString()),
      sb()
        .from("motor_prospeccao_log")
        .select("lead_gerado_id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("acao", "wpp_primeiro_contato"),
      sb()
        .from("wpp_conversations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .not("lead_gerado_id", "is", null)
        .gt("nao_lidas", 0),
    ]);

  const total = totalEnviados.count ?? 0;
  const responderam = totalResponderam.count ?? 0;

  return {
    wppEnviadosHoje: wppHoje.count ?? 0,
    maxWppDia: config?.data?.max_wpp_dia ?? 50,
    conversasAtivas: conversasAtivas.count ?? 0,
    reunioesAgendadasSemana: reunioes.count ?? 0,
    taxaResposta: total > 0 ? Math.round((responderam / total) * 100) : 0,
  };
}

export async function getFunilMotor(orgId: string): Promise<FunilItem[]> {
  const { data: logs } = await sb()
    .from("motor_prospeccao_log")
    .select("acao")
    .eq("organization_id", orgId);

  if (!logs) return [];

  const counts: Record<string, number> = {};
  for (const log of logs) {
    counts[log.acao] = (counts[log.acao] ?? 0) + 1;
  }

  return [
    { label: "Enviados", valor: counts["wpp_primeiro_contato"] ?? 0 },
    { label: "Responderam", valor: counts["wpp_resposta_ia"] ?? 0 },
    { label: "Reunião agendada", valor: counts["reuniao_agendada"] ?? 0 },
    { label: "Sem interesse", valor: counts["sem_interesse"] ?? 0 },
    { label: "Escalado", valor: counts["escalado_humano"] ?? 0 },
  ];
}

export async function getConversasAtivas(orgId: string): Promise<ConversaAtiva[]> {
  const { data } = await sb()
    .from("wpp_conversations")
    .select(`
      id, contato_nome, ultimo_texto, ultima_msg_em,
      leads_gerados!left(categoria)
    `)
    .eq("organization_id", orgId)
    .eq("ai_ativa", true)
    .order("ultima_msg_em", { ascending: false })
    .limit(20);

  if (!data) return [];

  return (data as any[]).map((c) => ({
    id: c.id,
    contato_nome: c.contato_nome,
    lead_categoria: c.leads_gerados?.categoria ?? null,
    ultimo_texto: c.ultimo_texto,
    ultima_msg_em: c.ultima_msg_em,
    total_mensagens: 0,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/motor-prospeccao/dashboard-queries.ts
git commit -m "feat(motor): queries do dashboard — stats, funil, conversas ativas"
```

---

### Task 16: Dashboard page and components

**Files:**
- Create: `src/app/(authed)/prospeccao/motor/page.tsx`
- Create: `src/components/motor-prospeccao/MotorFunil.tsx`
- Create: `src/components/motor-prospeccao/ConversasAtivasTable.tsx`

- [ ] **Step 1: Create MotorFunil chart component**

`src/components/motor-prospeccao/MotorFunil.tsx`:

```typescript
"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { FunilItem } from "@/lib/motor-prospeccao/dashboard-queries";

interface Props {
  data: FunilItem[];
}

export function MotorFunil({ data }: Props) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <XAxis type="number" />
        <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create ConversasAtivasTable**

`src/components/motor-prospeccao/ConversasAtivasTable.tsx`:

```typescript
import Link from "next/link";
import type { ConversaAtiva } from "@/lib/motor-prospeccao/dashboard-queries";

interface Props {
  conversas: ConversaAtiva[];
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "-";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function ConversasAtivasTable({ conversas }: Props) {
  if (conversas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma conversa ativa.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="pb-2">Lead</th>
            <th className="pb-2">Nicho</th>
            <th className="pb-2">Última msg</th>
            <th className="pb-2">Há</th>
          </tr>
        </thead>
        <tbody>
          {conversas.map((c) => (
            <tr key={c.id} className="border-b hover:bg-muted/50">
              <td className="py-2">
                <Link href="/conversas" className="text-primary hover:underline">
                  {c.contato_nome}
                </Link>
              </td>
              <td className="py-2 text-muted-foreground">{c.lead_categoria ?? "-"}</td>
              <td className="py-2 max-w-[200px] truncate">{c.ultimo_texto ?? "-"}</td>
              <td className="py-2 text-muted-foreground">{timeAgo(c.ultima_msg_em)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Create dashboard page**

`src/app/(authed)/prospeccao/motor/page.tsx`:

```typescript
import { requireAuth } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { getMotorStats, getFunilMotor, getConversasAtivas } from "@/lib/motor-prospeccao/dashboard-queries";
import { MotorFunil } from "@/components/motor-prospeccao/MotorFunil";
import { ConversasAtivasTable } from "@/components/motor-prospeccao/ConversasAtivasTable";

export default async function MotorDashboardPage() {
  const user = await requireAuth();

  const [stats, funil, conversas] = await Promise.all([
    getMotorStats(user.orgId),
    getFunilMotor(user.orgId),
    getConversasAtivas(user.orgId),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Motor de Prospecção</h1>
        <p className="text-sm text-muted-foreground">
          Métricas do disparo automático de WhatsApp e IA conversacional.
        </p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">WPP hoje</p>
          <p className="text-2xl font-bold">{stats.wppEnviadosHoje}</p>
          <p className="text-xs text-muted-foreground">de {stats.maxWppDia}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Conversas ativas</p>
          <p className="text-2xl font-bold">{stats.conversasAtivas}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Reuniões (semana)</p>
          <p className="text-2xl font-bold">{stats.reunioesAgendadasSemana}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Taxa resposta</p>
          <p className="text-2xl font-bold">{stats.taxaResposta}%</p>
        </Card>
      </div>

      {/* Funnel */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Funil de conversão</h2>
        <MotorFunil data={funil} />
      </Card>

      {/* Active conversations */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Conversas com IA ativa</h2>
        <ConversasAtivasTable conversas={conversas} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authed\)/prospeccao/motor/page.tsx src/components/motor-prospeccao/MotorFunil.tsx src/components/motor-prospeccao/ConversasAtivasTable.tsx
git commit -m "feat(motor): dashboard — stats, funil, conversas ativas"
```

---

### Task 17: Fase 2C — type-check, lint, PR

- [ ] **Step 1: Type-check and lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 2: Fix any issues**

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin HEAD
gh pr create --title "feat: dashboard do motor de prospecção (Fase 2C)" --body "..."
```

Post-merge: apply migration `20260912400000_comercial_ia_fase2.sql` via Supabase SQL Editor.
