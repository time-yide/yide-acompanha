# Ligações por Twilio (webphone no navegador) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar a Twilio como provedor de voz do módulo `/ligacoes` — a comercial liga pelo navegador (WebRTC), a chamada é gravada, e o sistema salva status + link da gravação — sem remover a Zenvia.

**Architecture:** Aditivo. O navegador usa `@twilio/voice-sdk` com um Access Token de vida curta gerado pelo servidor. Ao discar, a Twilio chama nossa rota TwiML de voz, que cria a linha em `ligacoes` e devolve um `<Dial record>` com o caller ID verificado. Webhooks de status/gravação atualizam a linha por `CallSid`. A gravação (protegida por auth na Twilio) é servida por uma rota proxy nossa, então o player `<audio>` existente continua funcionando. Sem migration (o valor `twilio` já está nos CHECK de `provedor`/`origem`).

**Tech Stack:** Next.js 16 (App Router, route handlers), `twilio` (Node SDK, servidor), `@twilio/voice-sdk` (navegador), Supabase service-role, Zod, Vitest.

---

## Convenções deste plano

- Trabalhe no worktree `feat/ligacoes-twilio` (branch a partir de `origin/main`).
- Espelhe o estilo do `src/lib/ligacoes/zenvia.ts` e da rota `src/app/api/webhooks/ligacoes/zenvia/route.ts`.
- O banco usa o cliente service-role com `as any` (padrão do módulo). Mantenha.
- Caller ID verificado fica no campo `numero` da `ligacoes_instancias` (já existe).
- Commits frequentes, um por task.
- AGENTS.md avisa: este Next.js tem mudanças. Para route handlers, confirme a assinatura em `node_modules/next/dist/docs/` se algo divergir — mas a rota Zenvia já usa `export async function POST(req: NextRequest)` retornando `NextResponse`, então siga esse padrão comprovado.

---

## File Structure

**Criar:**
- `src/lib/ligacoes/twilio.ts` — helpers puros (status map, parse de webhook, identidade) + geração de Access Token + montagem de TwiML.
- `src/lib/ligacoes/twilio.test.ts` — testes unitários das funções puras.
- `src/app/api/ligacoes/twilio/voice/route.ts` — rota TwiML de voz (Twilio chama ao discar).
- `src/app/api/ligacoes/twilio/recording/route.ts` — proxy autenticado da gravação.
- `src/app/api/webhooks/ligacoes/twilio/route.ts` — webhook de status + gravação.
- `src/components/ligacoes/DiscadorTwilio.tsx` — webphone WebRTC.

**Modificar:**
- `src/lib/env.ts` — novas envs Twilio.
- `src/lib/ligacoes/actions.ts` — `getTwilioVoiceTokenAction`; `getWebphoneUrlAction` passa a reportar o provedor.
- `src/components/ligacoes/Discador.tsx` — escolhe webphone Twilio vs iframe Zenvia.
- `src/components/ligacoes/InstanciaFormModal.tsx` — bloco de webhook/caller ID Twilio.
- `src/lib/ligacoes/instancias.ts` — Twilio vira `status: "pronto"` com campo de caller ID.
- `src/components/ligacoes/LigarButton.tsx` — texto genérico (hoje diz "Zenvia").
- `package.json` — deps `twilio`, `@twilio/voice-sdk`.

---

## Task 1: Dependências + variáveis de ambiente

**Files:**
- Modify: `package.json`
- Modify: `src/lib/env.ts`

- [ ] **Step 1: Instalar as dependências**

Run:
```bash
npm install twilio @twilio/voice-sdk
```
Expected: `package.json` ganha `twilio` e `@twilio/voice-sdk` em `dependencies`; sem erros.

- [ ] **Step 2: Adicionar as envs no schema do servidor**

Em `src/lib/env.ts`, logo após a linha `ZENVIA_VOICE_TOKEN: z.string().optional(),` (≈ linha 70), adicione:

```ts
  // Twilio Voice — ligações pelo navegador no módulo /ligacoes (opcional).
  // Sem essas envs o caminho Twilio fica inerte (botão desabilitado), igual à
  // Zenvia. Pegar no console.twilio.com: Account SID + API Key (SID/Secret) +
  // TwiML App SID.
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_API_KEY_SID: z.string().optional(),
  TWILIO_API_KEY_SECRET: z.string().optional(),
  TWILIO_TWIML_APP_SID: z.string().optional(),
```

- [ ] **Step 3: Propagar no objeto lido de `process.env`**

Ainda em `src/lib/env.ts`, dentro do objeto que monta o env do servidor (perto de `NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,`, ≈ linha 106), adicione:

```ts
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID,
    TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET,
    TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID,
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "env\.ts" || echo OK`
Expected: `OK` (sem erros no env.ts).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/env.ts
git commit -m "chore(ligacoes): deps twilio + envs do provedor de voz"
```

---

## Task 2: Helpers puros + token (`twilio.ts`) com testes

**Files:**
- Create: `src/lib/ligacoes/twilio.ts`
- Test: `src/lib/ligacoes/twilio.test.ts`

- [ ] **Step 1: Escrever os testes (falhando)**

Crie `src/lib/ligacoes/twilio.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  mapStatusTwilio,
  parseEventoWebhookTwilio,
  buildTwilioWebhookUrl,
  buildRecordingProxyUrl,
} from "./twilio";

describe("mapStatusTwilio", () => {
  it("completed com duração vira atendida", () => {
    expect(mapStatusTwilio("completed", 12)).toBe("atendida");
  });
  it("completed curtíssima vira rejeitada", () => {
    expect(mapStatusTwilio("completed", 2)).toBe("rejeitada");
  });
  it("busy vira ocupada", () => {
    expect(mapStatusTwilio("busy", 0)).toBe("ocupada");
  });
  it("no-answer vira perdida", () => {
    expect(mapStatusTwilio("no-answer", 0)).toBe("perdida");
  });
  it("failed/canceled vira cancelada", () => {
    expect(mapStatusTwilio("failed", 0)).toBe("cancelada");
    expect(mapStatusTwilio("canceled", 0)).toBe("cancelada");
  });
  it("desconhecido vira perdida", () => {
    expect(mapStatusTwilio("seila", 0)).toBe("perdida");
  });
});

describe("parseEventoWebhookTwilio", () => {
  it("extrai status final do callback de Dial", () => {
    const ev = parseEventoWebhookTwilio({
      CallSid: "CA123",
      DialCallStatus: "completed",
      DialCallDuration: "30",
    });
    expect(ev.externalId).toBe("CA123");
    expect(ev.statusInterno).toBe("atendida");
    expect(ev.duracaoSegundos).toBe(30);
    expect(ev.recordingSid).toBeNull();
  });

  it("extrai RecordingSid do callback de gravação", () => {
    const ev = parseEventoWebhookTwilio({
      CallSid: "CA123",
      RecordingSid: "RE999",
      RecordingDuration: "27",
    });
    expect(ev.externalId).toBe("CA123");
    expect(ev.recordingSid).toBe("RE999");
    expect(ev.duracaoSegundos).toBe(27);
  });
});

describe("buildTwilioWebhookUrl / buildRecordingProxyUrl", () => {
  it("monta a URL do webhook sem barra dupla", () => {
    expect(buildTwilioWebhookUrl("https://app.com/", "sek")).toBe(
      "https://app.com/api/webhooks/ligacoes/twilio?secret=sek",
    );
  });
  it("monta a URL do proxy de gravação", () => {
    expect(buildRecordingProxyUrl("https://app.com", "RE1", "sek")).toBe(
      "https://app.com/api/ligacoes/twilio/recording?sid=RE1&secret=sek",
    );
  });
});
```

- [ ] **Step 2: Rodar os testes (devem falhar)**

Run: `npx vitest run src/lib/ligacoes/twilio.test.ts`
Expected: FAIL com "Cannot find module './twilio'" (ou export ausente).

- [ ] **Step 3: Implementar `src/lib/ligacoes/twilio.ts`**

```ts
// SERVER ONLY - cliente/helpers da Twilio Voice pro módulo /ligacoes.
import twilio from "twilio";
import { getServerEnv } from "@/lib/env";
import type { StatusLigacao } from "./tipos";

interface TwilioCreds {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  twimlAppSid: string;
}

/** Lê as credenciais; null quando não configurado (caminho fica inerte). */
export function getTwilioCreds(): TwilioCreds | null {
  const e = getServerEnv();
  if (
    !e.TWILIO_ACCOUNT_SID ||
    !e.TWILIO_API_KEY_SID ||
    !e.TWILIO_API_KEY_SECRET ||
    !e.TWILIO_TWIML_APP_SID
  ) {
    return null;
  }
  return {
    accountSid: e.TWILIO_ACCOUNT_SID,
    apiKeySid: e.TWILIO_API_KEY_SID,
    apiKeySecret: e.TWILIO_API_KEY_SECRET,
    twimlAppSid: e.TWILIO_TWIML_APP_SID,
  };
}

/** Mapeia o status da Twilio (DialCallStatus/CallStatus) pro enum interno. */
export function mapStatusTwilio(statusTwilio: string, duracaoSegundos: number): StatusLigacao {
  const s = (statusTwilio || "").toLowerCase();
  if (s === "busy") return "ocupada";
  if (s === "failed" || s === "canceled" || s === "cancelled") return "cancelada";
  if (s === "no-answer" || s === "no_answer") return "perdida";
  if (s === "completed" || s === "answered" || s === "in-progress") {
    return duracaoSegundos < 5 ? "rejeitada" : "atendida";
  }
  return "perdida";
}

/** URL do webhook de status/gravação (vai no TwiML como callback). */
export function buildTwilioWebhookUrl(appUrl: string, webhookSecret: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/webhooks/ligacoes/twilio?secret=${webhookSecret}`;
}

/** URL do proxy autenticado que serve a gravação pro player <audio>. */
export function buildRecordingProxyUrl(appUrl: string, recordingSid: string, webhookSecret: string): string {
  return `${appUrl.replace(/\/$/, "")}/api/ligacoes/twilio/recording?sid=${recordingSid}&secret=${webhookSecret}`;
}

export interface EventoWebhookTwilioParsed {
  externalId: string; // CallSid
  statusInterno: StatusLigacao;
  duracaoSegundos: number;
  recordingSid: string | null;
  raw: Record<string, unknown>;
}

/**
 * Normaliza os dois tipos de callback que recebemos no mesmo endpoint:
 * - action do <Dial>: traz DialCallStatus + DialCallDuration
 * - recordingStatusCallback: traz RecordingSid + RecordingDuration
 */
export function parseEventoWebhookTwilio(payload: Record<string, unknown>): EventoWebhookTwilioParsed {
  const externalId = String(payload.CallSid ?? "");
  const recordingSid = payload.RecordingSid != null ? String(payload.RecordingSid) : null;
  const statusStr = String(payload.DialCallStatus ?? payload.CallStatus ?? "");
  const dur =
    Number(payload.DialCallDuration ?? payload.RecordingDuration ?? payload.CallDuration ?? 0) || 0;
  return {
    externalId,
    statusInterno: mapStatusTwilio(statusStr, dur),
    duracaoSegundos: dur,
    recordingSid,
    raw: payload,
  };
}

/**
 * Gera um Access Token de voz (vida curta) pro navegador. `identity` é o id do
 * colaborador logado. Retorna null se a Twilio não estiver configurada.
 */
export function gerarVoiceToken(identity: string): string | null {
  const c = getTwilioCreds();
  if (!c) return null;
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const token = new AccessToken(c.accountSid, c.apiKeySid, c.apiKeySecret, {
    identity,
    ttl: 3600,
  });
  token.addGrant(
    new VoiceGrant({
      outgoingApplicationSid: c.twimlAppSid,
      incomingAllow: false,
    }),
  );
  return token.toJwt();
}
```

- [ ] **Step 4: Rodar os testes (devem passar)**

Run: `npx vitest run src/lib/ligacoes/twilio.test.ts`
Expected: PASS (todos os testes verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ligacoes/twilio.ts src/lib/ligacoes/twilio.test.ts
git commit -m "feat(ligacoes): helpers + access token Twilio (com testes)"
```

---

## Task 3: Server Action do token de voz

**Files:**
- Modify: `src/lib/ligacoes/actions.ts`

- [ ] **Step 1: Importar os helpers Twilio**

No topo de `src/lib/ligacoes/actions.ts`, junto dos imports do módulo (perto de `import { iniciarChamada, getWebphoneUrl } from "./zenvia";`), adicione:

```ts
import { gerarVoiceToken } from "./twilio";
```

- [ ] **Step 2: Adicionar a action `getTwilioVoiceTokenAction`**

Logo após `getWebphoneUrlAction` (≈ linha 371), adicione:

```ts
/**
 * Retorna o Access Token de voz da Twilio pro colaborador logado, junto do
 * número (caller ID) e do nome da instância. Sem instância Twilio atribuída ou
 * sem env configurada, retorna { token: null }.
 */
export async function getTwilioVoiceTokenAction(): Promise<{
  token: string | null;
  callerId: string | null;
  instanciaId: string | null;
}> {
  const actor = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id, numero, provedor")
    .eq("colaborador_id", actor.id)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .maybeSingle();
  if (!inst) return { token: null, callerId: null, instanciaId: null };
  const token = gerarVoiceToken(actor.id);
  return {
    token,
    callerId: (inst.numero as string | null) ?? null,
    instanciaId: (inst.id as string) ?? null,
  };
}
```

- [ ] **Step 3: Atualizar `getWebphoneUrlAction` pra reportar o provedor**

Substitua o corpo de `getWebphoneUrlAction` (≈ linhas 355-371) por:

```ts
export async function getWebphoneUrlAction(): Promise<{
  url: string | null;
  ramal: string | null;
  provedor: string | null;
}> {
  const actor = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("ramal, provedor")
    .eq("colaborador_id", actor.id)
    .in("provedor", ["totalvoice", "twilio"])
    .is("arquivado_em", null)
    .maybeSingle();
  const provedor = (inst?.provedor as string | null) ?? null;
  if (provedor !== "totalvoice") return { url: null, ramal: null, provedor };
  const ramal = (inst?.ramal as string | null) ?? null;
  if (!ramal) return { url: null, ramal: null, provedor };
  const url = await getWebphoneUrl(ramal);
  return { url, ramal, provedor };
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "ligacoes/actions\.ts" || echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ligacoes/actions.ts
git commit -m "feat(ligacoes): action de access token Twilio + provedor no webphone"
```

---

## Task 4: Rota TwiML de voz (cria a ligação + manda discar gravando)

**Files:**
- Create: `src/app/api/ligacoes/twilio/voice/route.ts`

Contexto: a Twilio chama esta rota (configurada como Voice URL do TwiML App) quando o navegador inicia a chamada. Os `params` do `device.connect()` chegam como campos do form (`To`, `instancia_id`, etc.) junto de `CallSid`. Respondemos com TwiML `text/xml`.

- [ ] **Step 1: Implementar a rota**

```ts
import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { buildTwilioWebhookUrl } from "@/lib/ligacoes/twilio";

const AVISO_GRAVACAO =
  "Esta ligação será gravada para fins de qualidade e treinamento.";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const to = String(form.get("To") ?? "");
  const instanciaId = String(form.get("instancia_id") ?? "");
  const callSid = String(form.get("CallSid") ?? "");
  const contatoNome = form.get("contato_nome") ? String(form.get("contato_nome")) : null;
  const leadId = form.get("lead_id") ? String(form.get("lead_id")) : null;
  const leadGeradoId = form.get("lead_gerado_id") ? String(form.get("lead_gerado_id")) : null;
  const clientId = form.get("client_id") ? String(form.get("client_id")) : null;

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id, organization_id, colaborador_id, numero, webhook_secret, provedor")
    .eq("id", instanciaId)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .maybeSingle();

  if (!inst || !to) {
    twiml.say({ language: "pt-BR" }, "Configuração de ligação inválida.");
    return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
  }

  // Cria a linha já em andamento; webhook casa por external_id = CallSid.
  try {
    await sb.from("ligacoes").insert({
      organization_id: inst.organization_id,
      tipo: "telefone",
      direcao: "saida",
      colaborador_id: inst.colaborador_id,
      instancia_id: inst.id,
      numero: to,
      contato_nome: contatoNome,
      lead_id: leadId,
      lead_gerado_id: leadGeradoId,
      client_id: clientId,
      status: "em_andamento",
      iniciada_em: new Date().toISOString(),
      origem: "twilio",
      external_id: callSid || null,
    });
  } catch (e) {
    console.error("[twilio voice] insert falhou:", (e as Error).message);
  }

  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  const webhookUrl = buildTwilioWebhookUrl(appUrl, inst.webhook_secret as string);

  // Aviso legal de gravação antes de conectar.
  twiml.say({ language: "pt-BR" }, AVISO_GRAVACAO);

  const dial = twiml.dial({
    callerId: (inst.numero as string) || undefined,
    record: "record-from-answer",
    recordingStatusCallback: webhookUrl,
    recordingStatusCallbackEvent: ["completed"],
    action: webhookUrl, // status final do leg (DialCallStatus/DialCallDuration)
    answerOnBridge: true,
  });
  dial.number(to);

  return new NextResponse(twiml.toString(), { headers: { "Content-Type": "text/xml" } });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "twilio/voice/route" || echo OK`
Expected: `OK`.

- [ ] **Step 3: Verificar o XML gerado (smoke manual com curl)**

Run (com o dev server rodando, `npm run dev`):
```bash
curl -s -X POST 'http://localhost:3000/api/ligacoes/twilio/voice' \
  -d 'To=+5511999999999' -d 'instancia_id=inexistente' -d 'CallSid=CAtest'
```
Expected: XML com `<Say>` "Configuração de ligação inválida." (porque a instância não existe). Confirma que a rota responde `text/xml` sem 500.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ligacoes/twilio/voice/route.ts
git commit -m "feat(ligacoes): rota TwiML de voz Twilio (cria ligacao + dial gravando)"
```

---

## Task 5: Proxy autenticado da gravação

**Files:**
- Create: `src/app/api/ligacoes/twilio/recording/route.ts`

Contexto: a mídia de gravação da Twilio exige Basic Auth (não dá pra tocar direto no `<audio>`). Esta rota valida o `?secret=` da instância, busca o mp3 na Twilio com a API Key e faz streaming pro player.

- [ ] **Step 1: Implementar a rota**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTwilioCreds } from "@/lib/ligacoes/twilio";

export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get("sid");
  const secret = req.nextUrl.searchParams.get("secret");
  if (!sid || !secret) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id")
    .eq("webhook_secret", secret)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .maybeSingle();
  if (!inst) return NextResponse.json({ error: "invalid secret" }, { status: 401 });

  const creds = getTwilioCreds();
  if (!creds) return NextResponse.json({ error: "twilio off" }, { status: 503 });

  const mediaUrl = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Recordings/${sid}.mp3`;
  const auth = Buffer.from(`${creds.apiKeySid}:${creds.apiKeySecret}`).toString("base64");
  const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "recording fetch failed" }, { status: 502 });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "twilio/recording/route" || echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ligacoes/twilio/recording/route.ts
git commit -m "feat(ligacoes): proxy autenticado da gravacao Twilio"
```

---

## Task 6: Webhook de status + gravação

**Files:**
- Create: `src/app/api/webhooks/ligacoes/twilio/route.ts`

Contexto: recebe os dois callbacks (action do Dial e recordingStatusCallback) no mesmo endpoint. Atualiza a linha por `external_id = CallSid`. Espelha a rota Zenvia.

- [ ] **Step 1: Implementar a rota**

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getServerEnv } from "@/lib/env";
import { parseEventoWebhookTwilio, buildRecordingProxyUrl } from "@/lib/ligacoes/twilio";

// Webhook público autenticado por ?secret= (= ligacoes_instancias.webhook_secret).
// Recebe Content-Type application/x-www-form-urlencoded da Twilio.
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret) return NextResponse.json({ error: "missing secret" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: inst } = await sb
    .from("ligacoes_instancias")
    .select("id")
    .eq("webhook_secret", secret)
    .eq("provedor", "twilio")
    .is("arquivado_em", null)
    .maybeSingle();
  if (!inst) return NextResponse.json({ error: "invalid secret" }, { status: 401 });

  let payload: Record<string, unknown> = {};
  try {
    const form = await req.formData();
    payload = Object.fromEntries(form.entries());
  } catch {
    return NextResponse.json({ ok: true });
  }

  const ev = parseEventoWebhookTwilio(payload);
  if (!ev.externalId) return NextResponse.json({ ok: true });

  try {
    const { data: existing } = await sb
      .from("ligacoes")
      .select("id, gravacao_url, duracao_segundos")
      .eq("origem", "twilio")
      .eq("external_id", ev.externalId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ ok: true });

    // Monta o patch só com o que este callback traz (não sobrescreve com vazio).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: Record<string, any> = {
      finalizada_em: new Date().toISOString(),
      raw_data: ev.raw,
    };
    if (ev.recordingSid) {
      const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
      patch.gravacao_url = buildRecordingProxyUrl(appUrl, ev.recordingSid, secret);
    }
    if (ev.duracaoSegundos > 0) patch.duracao_segundos = ev.duracaoSegundos;
    // Status só do callback de Dial (o de gravação não traz status de chamada).
    if (payload.DialCallStatus != null || payload.CallStatus != null) {
      patch.status = ev.statusInterno;
    }

    await sb.from("ligacoes").update(patch).eq("id", (existing as { id: string }).id);
    return NextResponse.json({ ok: true, updated: true });
  } catch (e) {
    console.error("[webhook twilio] erro:", (e as Error).message);
    return NextResponse.json({ ok: true });
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "webhooks/ligacoes/twilio/route" || echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/ligacoes/twilio/route.ts
git commit -m "feat(ligacoes): webhook de status + gravacao Twilio"
```

---

## Task 7: Componente webphone `DiscadorTwilio`

**Files:**
- Create: `src/components/ligacoes/DiscadorTwilio.tsx`

Contexto: usa `@twilio/voice-sdk` (Device). Pega o token via `getTwilioVoiceTokenAction`, registra o Device, e expõe um campo de número + botões ligar/desligar. Pede permissão de microfone.

- [ ] **Step 1: Implementar o componente**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { Device, type Call } from "@twilio/voice-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getTwilioVoiceTokenAction } from "@/lib/ligacoes/actions";

type Estado = "carregando" | "indisponivel" | "pronto" | "chamando" | "em_chamada";

export function DiscadorTwilio() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const instanciaIdRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await getTwilioVoiceTokenAction();
        if (!alive) return;
        if (!r.token || !r.instanciaId) {
          setEstado("indisponivel");
          return;
        }
        instanciaIdRef.current = r.instanciaId;
        const device = new Device(r.token, { logLevel: "error" });
        await device.register();
        deviceRef.current = device;
        setEstado("pronto");
      } catch (e) {
        if (alive) {
          setErro((e as Error).message);
          setEstado("indisponivel");
        }
      }
    })();
    return () => {
      alive = false;
      callRef.current?.disconnect();
      deviceRef.current?.destroy();
    };
  }, []);

  async function ligar() {
    setErro(null);
    const device = deviceRef.current;
    if (!device || !numero.trim()) return;
    try {
      setEstado("chamando");
      const call = await device.connect({
        params: { To: numero.trim(), instancia_id: instanciaIdRef.current ?? "" },
      });
      callRef.current = call;
      call.on("accept", () => setEstado("em_chamada"));
      call.on("disconnect", () => {
        setEstado("pronto");
        callRef.current = null;
      });
      call.on("error", (e: { message: string }) => {
        setErro(e.message);
        setEstado("pronto");
      });
    } catch (e) {
      setErro((e as Error).message);
      setEstado("pronto");
    }
  }

  function desligar() {
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
  }

  if (estado === "carregando" || estado === "indisponivel") {
    return null; // não polui a tela; DiscadorRapido cobre o resto
  }

  const emChamada = estado === "chamando" || estado === "em_chamada";

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium">
        <Phone className="h-3.5 w-3.5 text-emerald-500" /> Discador (Twilio)
      </div>
      <div className="space-y-2 p-3">
        <Input
          placeholder="+5511999999999"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          disabled={emChamada}
        />
        {!emChamada ? (
          <Button onClick={ligar} disabled={!numero.trim()} className="w-full gap-2">
            <Phone className="h-4 w-4" /> Ligar
          </Button>
        ) : (
          <Button onClick={desligar} variant="destructive" className="w-full gap-2">
            <PhoneOff className="h-4 w-4" />
            {estado === "chamando" ? "Chamando…" : "Desligar"}
          </Button>
        )}
        {erro && <p className="text-xs text-destructive">{erro}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "DiscadorTwilio" || echo OK`
Expected: `OK`. (Se o tipo `Call` divergir na versão instalada, troque `type Call` por `any` com `// eslint-disable-next-line` e confirme o lint.)

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/ligacoes/DiscadorTwilio.tsx`
Expected: sem erros (warnings ok).

- [ ] **Step 4: Commit**

```bash
git add src/components/ligacoes/DiscadorTwilio.tsx
git commit -m "feat(ligacoes): webphone WebRTC Twilio (DiscadorTwilio)"
```

---

## Task 8: Escolher o webphone certo no `Discador`

**Files:**
- Modify: `src/components/ligacoes/Discador.tsx`

Contexto: hoje o `Discador` só renderiza o iframe Zenvia. Passa a decidir: se a instância do colaborador é `twilio`, renderiza `DiscadorTwilio`; se `totalvoice` com url, o iframe; senão, nada.

- [ ] **Step 1: Substituir o conteúdo de `Discador.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { getWebphoneUrlAction } from "@/lib/ligacoes/actions";
import { DiscadorTwilio } from "./DiscadorTwilio";

export function Discador() {
  const [state, setState] = useState<{
    url: string | null;
    ramal: string | null;
    provedor: string | null;
    loading: boolean;
  }>({ url: null, ramal: null, provedor: null, loading: true });

  useEffect(() => {
    let alive = true;
    getWebphoneUrlAction()
      .then((r) => {
        if (alive) setState({ url: r.url, ramal: r.ramal, provedor: r.provedor, loading: false });
      })
      .catch(() => {
        if (alive) setState({ url: null, ramal: null, provedor: null, loading: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (state.loading) return null;

  // Twilio: webphone WebRTC (ele mesmo decide se aparece).
  if (state.provedor === "twilio") return <DiscadorTwilio />;

  // Zenvia: iframe pré-configurado.
  if (state.provedor === "totalvoice" && state.ramal && state.url) {
    return (
      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs font-medium">
          <Phone className="h-3.5 w-3.5 text-emerald-500" /> Discador (ramal {state.ramal})
        </div>
        <iframe
          title="Discador Zenvia"
          src={state.url}
          allow="microphone"
          className="h-[420px] w-full border-0"
        />
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "Discador\.tsx" || echo OK && npx eslint src/components/ligacoes/Discador.tsx`
Expected: `OK` e lint sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/ligacoes/Discador.tsx
git commit -m "feat(ligacoes): Discador escolhe webphone Twilio vs Zenvia"
```

---

## Task 9: Configuração da instância (form + provedor "pronto")

**Files:**
- Modify: `src/lib/ligacoes/instancias.ts`
- Modify: `src/components/ligacoes/InstanciaFormModal.tsx`

- [ ] **Step 1: Marcar Twilio como `pronto` e ajustar campos**

Em `src/lib/ligacoes/instancias.ts`, substitua o objeto do provedor `twilio` (≈ linhas 48-58) por:

```ts
  {
    value: "twilio",
    label: "Twilio (ligar pelo sistema)",
    tipo: "telefone",
    status: "pronto",
    webhookHint:
      "No Twilio: crie um TwiML App e aponte a Voice URL pra rota /api/ligacoes/twilio/voice. As chaves (Account SID, API Key SID/Secret, TwiML App SID) vão nas envs do Vercel.",
    campos: [],
  },
```

Observação: o caller ID verificado é informado no campo **Número** da instância (já existente no form), não em `campos`.

- [ ] **Step 2: Mostrar o bloco de ajuda Twilio no form**

Em `src/components/ligacoes/InstanciaFormModal.tsx`, logo após o bloco condicional da Zenvia (o `{tipo === "telefone" && provedor === "totalvoice" && ...}`, ≈ linha 174-185), adicione um bloco irmão pra Twilio:

```tsx
          {tipo === "telefone" && provedor === "twilio" && isEdit && instancia?.webhook_secret && (
            <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
              <p className="text-sm font-medium">Webhook de status/gravação (cole no TwiML App da Twilio)</p>
              <code className="block break-all text-[11px]">
                {`${appUrl}/api/webhooks/ligacoes/twilio?secret=${instancia.webhook_secret}`}
              </code>
              <p className="text-[11px] text-muted-foreground">
                A Voice URL do TwiML App é <code>{`${appUrl}/api/ligacoes/twilio/voice`}</code>. No
                campo <strong>Número</strong> acima, informe o caller ID verificado na Twilio (o
                número que aparece pro lead). As chaves da conta ficam nas envs do Vercel.
              </p>
            </div>
          )}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "InstanciaFormModal|instancias\.ts" || echo OK && npx eslint src/components/ligacoes/InstanciaFormModal.tsx src/lib/ligacoes/instancias.ts`
Expected: `OK` e lint sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ligacoes/instancias.ts src/components/ligacoes/InstanciaFormModal.tsx
git commit -m "feat(ligacoes): config de instancia Twilio (caller ID + webhook hint)"
```

---

## Task 10: Texto do LigarButton + verificação final + doc de setup

**Files:**
- Modify: `src/components/ligacoes/LigarButton.tsx`
- Create: `docs/superpowers/specs/2026-06-30-ligacoes-twilio-setup.md`

- [ ] **Step 1: Trocar o texto preso à Zenvia**

Em `src/components/ligacoes/LigarButton.tsx`, localize a mensagem "Sem instancia Zenvia" e troque por "Sem instância de ligação configurada". (Se houver outras strings "Zenvia" hardcoded neste componente, generalize do mesmo jeito.)

Run pra localizar: `grep -n "Zenvia" src/components/ligacoes/LigarButton.tsx`

- [ ] **Step 2: Escrever o passo a passo de setup da Yasmin**

Crie `docs/superpowers/specs/2026-06-30-ligacoes-twilio-setup.md`:

```markdown
# Setup operacional — Ligações por Twilio

Faça uma vez. ~20-30 min.

1. Criar conta em twilio.com e **adicionar crédito** (sai do trial → libera ligar
   pra qualquer número).
2. Console → **Voice → Settings → Geographic Permissions** → habilitar **Brasil**.
3. Console → **Phone Numbers → Verified Caller IDs** → verificar um número que
   vocês já têm (recebe um código por ligação). Esse vira o número que aparece
   pro lead. (Não precisa comprar número nem fazer o cadastro regulatório.)
4. Console → **Account → API keys & tokens** → criar uma **API Key (Standard)**:
   anote o **SID** e o **Secret**. Anote também o **Account SID** (dashboard).
5. Console → **Voice → TwiML Apps** → criar um app. Na **Voice Request URL**, cole
   `https://sistemaacompanha.yidedigital.com.br/api/ligacoes/twilio/voice` (POST).
   Anote o **TwiML App SID**.
6. No **Vercel** → Project → Settings → Environment Variables, adicionar:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_API_KEY_SID`
   - `TWILIO_API_KEY_SECRET`
   - `TWILIO_TWIML_APP_SID`
   Redeploy.
7. No sistema → **Ligações → Configurações** → nova instância de **telefone**:
   provedor **Twilio**, campo **Número** = o caller ID verificado, atribuir à
   comercial e salvar. Reabra a instância e **cole a URL de webhook** mostrada no
   TwiML App da Twilio (Recording/Status — já vai automática no TwiML, mas deixe
   configurada também se a Twilio pedir).
8. Avisar a equipe e os clientes que as ligações são **gravadas** (o sistema já
   toca um aviso no início, mas o combinado verbal é recomendado).

Pronto: a comercial abre /ligacoes no PC com fone, clica Ligar, e a chamada sai
gravada. Você ouve depois no detalhe da ligação.
```

- [ ] **Step 3: Verificação final (type-check + lint + testes)**

Run:
```bash
npx tsc --noEmit 2>&1 | grep -E "ligacoes|twilio" || echo "TYPECHECK OK (ligacoes/twilio)"
npx eslint src/lib/ligacoes src/components/ligacoes src/app/api/ligacoes src/app/api/webhooks/ligacoes 2>&1 | tail -5
npx vitest run src/lib/ligacoes/twilio.test.ts
```
Expected: nenhum erro de type nos arquivos do módulo; lint sem erros; testes verdes.

- [ ] **Step 4: Commit**

```bash
git add src/components/ligacoes/LigarButton.tsx docs/superpowers/specs/2026-06-30-ligacoes-twilio-setup.md
git commit -m "feat(ligacoes): texto generico no LigarButton + doc de setup Twilio"
```

- [ ] **Step 5: Push + PR**

```bash
git push -u origin feat/ligacoes-twilio
gh pr create --base main --title "feat(ligacoes): provedor de voz Twilio (webphone no navegador + gravacao)" \
  --body "Adiciona a Twilio como provedor de voz do /ligacoes (liga pelo navegador, grava, webhook salva status + gravacao). Aditivo: Zenvia segue funcionando. Sem migration (twilio já nos CHECK de provedor/origem). Requer setup operacional + envs (ver docs/superpowers/specs/2026-06-30-ligacoes-twilio-setup.md). 🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Depois: esperar CI (`ci.yml`) verde e, se ok, `gh pr merge --squash --delete-branch`.

---

## Self-Review (preenchido)

**Cobertura do spec:**
- Liga pelo navegador → Tasks 6-8 (token, DiscadorTwilio, wiring). ✓
- Grava + webhook salva status/gravacao_url → Tasks 4, 6. ✓
- Player de áudio continua funcionando (gravação protegida) → Task 5 (proxy). ✓
- Opção "Twilio" na config + caller ID → Task 9. ✓
- Sem migration → confirmado (CHECK já tem `twilio`). ✓
- Zenvia segue funcionando → caminho `totalvoice` preservado em actions/Discador. ✓
- Envs + inerte sem config → Tasks 1-2 (`getTwilioCreds` null-safe). ✓
- Aviso legal de gravação → Task 4 (`<Say>` antes do Dial). ✓
- Setup operacional → Task 10 (doc). ✓

**Placeholders:** nenhum "TBD/TODO"; todo passo com código completo e comando + saída esperada.

**Consistência de tipos:** `mapStatusTwilio`, `parseEventoWebhookTwilio`, `buildTwilioWebhookUrl`, `buildRecordingProxyUrl`, `getTwilioCreds`, `gerarVoiceToken` definidos na Task 2 e usados com a mesma assinatura nas Tasks 3-6. `getTwilioVoiceTokenAction` retorna `{ token, callerId, instanciaId }` (Task 3) e é consumido igual no DiscadorTwilio (Task 7). `getWebphoneUrlAction` passa a retornar `{ url, ramal, provedor }` (Task 3) e é lido com esse shape no Discador (Task 8).

**Riscos conhecidos / a validar na execução:**
- Tipo `Call` do `@twilio/voice-sdk` pode variar por versão → fallback documentado na Task 7.
- `record="record-from-answer"` grava só após atender (evita gravar toca-toca); confirme que é o comportamento desejado.
- Validação de assinatura `X-Twilio-Signature` ficou de fora (defense-in-depth) — o `?secret=` por instância já autentica; pode entrar num PR seguinte.
