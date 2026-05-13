# Push notifications no portal do cliente — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Liberar Web Push pro portal externo `/cliente` com 1 trigger ativo em v1 (autoavaliação semanal) + infraestrutura pronta pros outros 2 triggers ligarem quando os módulos pais maturarem.

**Architecture:** Relaxa FK de `push_subscriptions` pra `auth.users(id)` (ativa portal users). Cria server actions no namespace `cliente-portal` que reusam o `sendWebPushToUser` existente. Helper `sendPushToClient(clientId, payload)` envia pro leque de portal users ativos. Detector novo no daily-digest cron dispara o trigger semanal de self-satisfaction.

**Tech Stack:** Next.js 16 (App Router), Supabase (auth.users + RLS), Web Push (web-push lib + VAPID), Vitest, Tailwind, lucide-react.

**Spec:** [`docs/superpowers/specs/2026-05-13-cliente-portal-push-notifications-design.md`](../specs/2026-05-13-cliente-portal-push-notifications-design.md)

---

## Arquivos tocados

| Arquivo | Tipo | Responsabilidade |
|---|---|---|
| `supabase/migrations/20260521000000_push_subscriptions_relax_fk.sql` | Criar | Relaxa FK `push_subscriptions.user_id` pra `auth.users(id)` |
| `tests/unit/cliente-portal-push-actions.test.ts` | Criar | Testes das 3 actions do portal (subscribe/unsubscribe/test) |
| `src/lib/cliente-portal/push-actions.ts` | Criar | Server actions com `requireClientPortalAuth` |
| `tests/unit/cliente-portal-push.test.ts` | Criar | Teste do helper `sendPushToClient` |
| `src/lib/cliente-portal/push.ts` | Criar | Helper `sendPushToClient(clientId, payload)` |
| `tests/unit/cron-cliente-self-satisfaction-semanal.test.ts` | Criar | Teste do detector semanal |
| `src/lib/cron/detectors/cliente-self-satisfaction-semanal.ts` | Criar | Detector — segunda-feira, push pra clientes sem entry da semana |
| `src/lib/cron/daily-digest.ts` | Modificar | Registrar o novo detector no orquestrador |
| `src/components/cliente-portal/EnablePushButton.tsx` | Criar | Botão de ativar push pro portal (port adaptado) |
| `src/components/cliente-portal/NotificacoesSection.tsx` | Criar | Card no portal que renderiza o botão |
| `src/app/(cliente)/cliente/page.tsx` | Modificar | Adiciona `NotificacoesSection` entre Hero e Pasta |

Não muda: nenhum arquivo de reuniões ou summarizer (triggers #1/#2 são deferidos).

---

## Task 1: Migration — relaxar FK de `push_subscriptions`

**Files:**
- Create: `supabase/migrations/20260521000000_push_subscriptions_relax_fk.sql`

- [ ] **Step 1: Criar a migration**

Crie `supabase/migrations/20260521000000_push_subscriptions_relax_fk.sql`:

```sql
-- Permite que client_portal_users (que vivem em auth.users mas NÃO em
-- profiles) salvem subscriptions de Web Push. Antes a FK estreita pra
-- profiles bloqueava — agora aceita qualquer auth.user.
--
-- Backward-compatible: profiles.id é FK pra auth.users.id, então todos
-- os user_id atuais (que apontavam pra profiles) continuam válidos
-- apontando pra auth.users.

alter table public.push_subscriptions
  drop constraint push_subscriptions_user_id_fkey;

alter table public.push_subscriptions
  add constraint push_subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
```

- [ ] **Step 2: Lint/typecheck (sem efeito esperado, SQL não compila no TS)**

Execute:
```bash
npm run typecheck
```
Esperado: 5 erros pré-existentes (cheerio/web-push). Sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260521000000_push_subscriptions_relax_fk.sql
git commit -m "$(cat <<'EOF'
feat(push): relaxa FK de push_subscriptions pra auth.users

Permite que client_portal_users (auth.users sem linha em profiles)
salvem subscriptions de Web Push. Backward-compatible: todos os
user_id atuais continuam válidos.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

> **Atenção operacional:** A migration precisa rodar no Supabase remoto antes do deploy do código que depende dela (Task 2 em diante). Pode aplicar via `npx supabase db push` ou colando o SQL no SQL Editor.

---

## Task 2: Server actions — subscribe/unsubscribe/test do portal

**Files:**
- Create: `tests/unit/cliente-portal-push-actions.test.ts`
- Create: `src/lib/cliente-portal/push-actions.ts`

- [ ] **Step 1: Escrever os testes (vão falhar — arquivo ainda não existe)**

Crie `tests/unit/cliente-portal-push-actions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireClientPortalAuthMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());
const deleteEqEndpointMock = vi.hoisted(() => vi.fn());
const countSelectMock = vi.hoisted(() => vi.fn());
const sendWebPushToUserMock = vi.hoisted(() => vi.fn());
const getServerEnvMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/client-portal-session", () => ({
  requireClientPortalAuth: requireClientPortalAuthMock,
}));

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => {
      if (table !== "push_subscriptions") throw new Error(`unexpected table ${table}`);
      return {
        upsert: upsertMock,
        delete: () => ({
          eq: (_col1: string, _val1: string) => ({
            eq: (_col2: string, _val2: string) =>
              deleteEqEndpointMock(_col1, _val1, _col2, _val2),
          }),
        }),
        select: () => ({
          eq: (col: string, val: string) => countSelectMock(col, val),
        }),
      };
    },
  }),
}));

vi.mock("@/lib/push/server", () => ({
  sendWebPushToUser: sendWebPushToUserMock,
}));

vi.mock("@/lib/env", () => ({
  getServerEnv: getServerEnvMock,
}));

import {
  subscribeClientPortalPushAction,
  unsubscribeClientPortalPushAction,
  sendTestClientPortalPushAction,
} from "@/lib/cliente-portal/push-actions";

const PORTAL_USER_ID = "11111111-1111-1111-1111-111111111111";
const CLIENT_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  requireClientPortalAuthMock.mockReset();
  upsertMock.mockReset();
  deleteEqEndpointMock.mockReset();
  countSelectMock.mockReset();
  sendWebPushToUserMock.mockReset();
  getServerEnvMock.mockReset();
  requireClientPortalAuthMock.mockResolvedValue({
    id: PORTAL_USER_ID,
    clientId: CLIENT_ID,
    nomeContato: "Sócio Teste",
  });
  getServerEnvMock.mockReturnValue({
    VAPID_PUBLIC_KEY: "pubk",
    VAPID_PRIVATE_KEY: "privk",
    VAPID_SUBJECT: "mailto:ops@yide.com",
  });
});

function makeSubscribeFormData() {
  const fd = new FormData();
  fd.set("endpoint", "https://fcm.googleapis.com/fcm/send/abc123");
  fd.set("p256dh", "p256dh-key-base64");
  fd.set("auth", "auth-key-base64");
  fd.set("user_agent", "Mozilla/5.0 (iPhone)");
  return fd;
}

describe("subscribeClientPortalPushAction", () => {
  it("salva subscription pro portal user logado", async () => {
    upsertMock.mockResolvedValue({ error: null });
    const r = await subscribeClientPortalPushAction(makeSubscribeFormData());
    expect(r).toEqual({ success: true });
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: PORTAL_USER_ID,
        endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
        p256dh: "p256dh-key-base64",
        auth: "auth-key-base64",
        user_agent: "Mozilla/5.0 (iPhone)",
      }),
      { onConflict: "user_id,endpoint" },
    );
  });

  it("retorna erro de validação se endpoint não for URL", async () => {
    const fd = new FormData();
    fd.set("endpoint", "not-a-url");
    fd.set("p256dh", "p256dh");
    fd.set("auth", "auth");
    const r = await subscribeClientPortalPushAction(fd);
    expect(r).toMatchObject({ error: expect.any(String) });
    expect(upsertMock).not.toHaveBeenCalled();
  });
});

describe("unsubscribeClientPortalPushAction", () => {
  it("apaga subscription pelo endpoint do user logado", async () => {
    deleteEqEndpointMock.mockResolvedValue({ error: null });
    const fd = new FormData();
    fd.set("endpoint", "https://fcm.googleapis.com/fcm/send/abc123");
    const r = await unsubscribeClientPortalPushAction(fd);
    expect(r).toEqual({ success: true });
    expect(deleteEqEndpointMock).toHaveBeenCalledWith(
      "user_id",
      PORTAL_USER_ID,
      "endpoint",
      "https://fcm.googleapis.com/fcm/send/abc123",
    );
  });
});

describe("sendTestClientPortalPushAction", () => {
  it("retorna erro se VAPID não configurado", async () => {
    getServerEnvMock.mockReturnValue({});
    const r = await sendTestClientPortalPushAction();
    expect(r).toMatchObject({ error: expect.stringContaining("VAPID") });
  });

  it("retorna erro se user ainda não tem subscription", async () => {
    countSelectMock.mockReturnValue({ count: 0 });
    const r = await sendTestClientPortalPushAction();
    expect(r).toMatchObject({ error: expect.stringContaining("Nenhum dispositivo") });
    expect(sendWebPushToUserMock).not.toHaveBeenCalled();
  });

  it("dispara push pro user quando tudo ok", async () => {
    countSelectMock.mockReturnValue({ count: 1 });
    sendWebPushToUserMock.mockResolvedValue(undefined);
    const r = await sendTestClientPortalPushAction();
    expect(r).toEqual({ success: true });
    expect(sendWebPushToUserMock).toHaveBeenCalledWith(
      PORTAL_USER_ID,
      expect.objectContaining({
        title: expect.stringContaining("Yide"),
        body: expect.stringContaining("Push"),
        url: "/cliente",
        tag: "test",
      }),
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- tests/unit/cliente-portal-push-actions.test.ts
```

Esperado: erro tipo `Cannot find module '@/lib/cliente-portal/push-actions'`.

- [ ] **Step 3: Criar `src/lib/cliente-portal/push-actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireClientPortalAuth } from "@/lib/auth/client-portal-session";
import { getServerEnv } from "@/lib/env";
import { sendWebPushToUser } from "@/lib/push/server";

type ActionResult = { error?: string; success?: boolean };

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  user_agent: z.string().optional().nullable(),
});

/**
 * Salva a Push Subscription criada pelo browser pra um cliente final.
 * Usa requireClientPortalAuth (sessão do portal externo) — NUNCA a
 * sessão de colaborador interno.
 *
 * Idempotente: re-subscribe do mesmo endpoint atualiza chaves.
 */
export async function subscribeClientPortalPushAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireClientPortalAuth();
  const parsed = subscribeSchema.safeParse({
    endpoint: formData.get("endpoint"),
    p256dh: formData.get("p256dh"),
    auth: formData.get("auth"),
    user_agent: formData.get("user_agent") ?? null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.user_agent || null,
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) return { error: error.message };
  return { success: true };
}

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

/**
 * Remove a subscription pra esse endpoint do portal user logado.
 */
export async function unsubscribeClientPortalPushAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireClientPortalAuth();
  const parsed = unsubscribeSchema.safeParse({
    endpoint: formData.get("endpoint"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { error } = await sb
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", parsed.data.endpoint);
  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Dispara push de teste pro portal user logado — pra validar
 * end-to-end no celular instalado.
 */
export async function sendTestClientPortalPushAction(): Promise<ActionResult> {
  const user = await requireClientPortalAuth();
  const env = getServerEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return { error: "VAPID não configurado no servidor." };
  }

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { count } = await sb
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (!count || count === 0) {
    return { error: "Nenhum dispositivo inscrito. Ative as notificações primeiro." };
  }

  await sendWebPushToUser(user.id, {
    title: "Yide — Teste",
    body: "Push está funcionando neste dispositivo ✓",
    url: "/cliente",
    tag: "test",
  });
  return { success: true };
}
```

- [ ] **Step 4: Rodar — testes devem passar**

```bash
npm test -- tests/unit/cliente-portal-push-actions.test.ts
```

Esperado: 5 testes passando.

- [ ] **Step 5: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Esperado: 0 erros novos.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/cliente-portal-push-actions.test.ts src/lib/cliente-portal/push-actions.ts
git commit -m "$(cat <<'EOF'
feat(cliente-portal): server actions de subscribe/unsubscribe/test pra push

Mesma lógica das actions internas (src/lib/push/actions.ts) mas usando
requireClientPortalAuth — só portal user logado salva/remove subscription
no próprio user_id.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Helper `sendPushToClient`

**Files:**
- Create: `tests/unit/cliente-portal-push.test.ts`
- Create: `src/lib/cliente-portal/push.ts`

- [ ] **Step 1: Escrever os testes**

Crie `tests/unit/cliente-portal-push.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const sendWebPushToUserMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/push/server", () => ({
  sendWebPushToUser: sendWebPushToUserMock,
}));

import { sendPushToClient } from "@/lib/cliente-portal/push";

const CLIENT_ID = "22222222-2222-2222-2222-222222222222";
const PAYLOAD = { title: "T", body: "B", url: "/cliente" };

function setupPortalUsers(rows: Array<{ user_id: string; ativo: boolean }>) {
  fromMock.mockImplementation((table: string) => {
    if (table !== "client_portal_users") throw new Error(`unexpected ${table}`);
    return {
      select: () => ({
        eq: (col1: string, val1: string) => ({
          eq: (col2: string, val2: string) => {
            const filtered = rows.filter(
              (r) =>
                (col1 === "client_id" ? CLIENT_ID === val1 : true) &&
                (col2 === "ativo" ? r.ativo === val2 : true),
            );
            return Promise.resolve({ data: filtered, error: null });
          },
        }),
      }),
    };
  });
}

beforeEach(() => {
  fromMock.mockReset();
  sendWebPushToUserMock.mockReset();
  sendWebPushToUserMock.mockResolvedValue(undefined);
});

describe("sendPushToClient", () => {
  it("envia push pra todos os portal users ATIVOS do cliente", async () => {
    setupPortalUsers([
      { user_id: "u1", ativo: true },
      { user_id: "u2", ativo: true },
      { user_id: "u3", ativo: false },
    ]);
    await sendPushToClient(CLIENT_ID, PAYLOAD);
    expect(sendWebPushToUserMock).toHaveBeenCalledTimes(2);
    expect(sendWebPushToUserMock).toHaveBeenCalledWith("u1", PAYLOAD);
    expect(sendWebPushToUserMock).toHaveBeenCalledWith("u2", PAYLOAD);
    expect(sendWebPushToUserMock).not.toHaveBeenCalledWith("u3", PAYLOAD);
  });

  it("não chama push quando cliente não tem portal user ativo", async () => {
    setupPortalUsers([{ user_id: "u1", ativo: false }]);
    await sendPushToClient(CLIENT_ID, PAYLOAD);
    expect(sendWebPushToUserMock).not.toHaveBeenCalled();
  });

  it("falha de um device não impede os outros", async () => {
    setupPortalUsers([
      { user_id: "u1", ativo: true },
      { user_id: "u2", ativo: true },
    ]);
    sendWebPushToUserMock.mockImplementationOnce(() =>
      Promise.reject(new Error("device offline")),
    );
    sendWebPushToUserMock.mockImplementationOnce(() => Promise.resolve());
    await expect(sendPushToClient(CLIENT_ID, PAYLOAD)).resolves.toBeUndefined();
    expect(sendWebPushToUserMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- tests/unit/cliente-portal-push.test.ts
```

Esperado: erro `Cannot find module`.

- [ ] **Step 3: Criar `src/lib/cliente-portal/push.ts`**

```typescript
// SERVER ONLY: do not import from client components

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWebPushToUser } from "@/lib/push/server";

export interface ClientPushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Envia push pra TODOS os portal users ativos de um cliente.
 *
 * Cliente pode ter até 5 portal users (ex.: sócios). Todos recebem o
 * push — cada um decide se desliga no próprio device. Best-effort:
 * falha em um device não impede os outros.
 *
 * Use de código server (server actions, cron, route handlers) — nunca
 * de input direto do user (não autorizamos cliente disparar push pra
 * outro cliente).
 */
export async function sendPushToClient(
  clientId: string,
  payload: ClientPushPayload,
): Promise<void> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("client_portal_users")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("ativo", true);

  const rows = (data ?? []) as Array<{ user_id: string }>;
  if (rows.length === 0) return;

  // Promise.allSettled — se um device falhar, os outros continuam.
  // sendWebPushToUser já é best-effort por device, mas aqui paralelizamos
  // entre users também pra latência ficar O(1) em vez de O(N).
  await Promise.allSettled(
    rows.map((r) => sendWebPushToUser(r.user_id, payload)),
  );
}
```

- [ ] **Step 4: Rodar — passa**

```bash
npm test -- tests/unit/cliente-portal-push.test.ts
```

Esperado: 3 testes passando.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/cliente-portal-push.test.ts src/lib/cliente-portal/push.ts
git commit -m "$(cat <<'EOF'
feat(cliente-portal): helper sendPushToClient

Envia push pra todos os portal users ativos de um cliente (até 5).
Best-effort com Promise.allSettled — falha em um device não impede
os outros. Pra usar em server actions/crons que precisam notificar
o cliente final.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Detector semanal de self-satisfaction

**Files:**
- Create: `tests/unit/cron-cliente-self-satisfaction-semanal.test.ts`
- Create: `src/lib/cron/detectors/cliente-self-satisfaction-semanal.ts`
- Modify: `src/lib/cron/daily-digest.ts`

- [ ] **Step 1: Escrever testes do detector**

Crie `tests/unit/cron-cliente-self-satisfaction-semanal.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const sendPushToClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/cliente-portal/push", () => ({
  sendPushToClient: sendPushToClientMock,
}));

vi.mock("@/lib/satisfacao/iso-week", () => ({
  currentIsoWeek: () => "2026-W20",
}));

import { detectClienteSelfSatisfactionSemanal } from "@/lib/cron/detectors/cliente-self-satisfaction-semanal";

function setupDB(clients: Array<{ id: string }>, satisfacoesDaSemana: Array<{ client_id: string }>) {
  fromMock.mockImplementation((table: string) => {
    if (table === "clients") {
      return {
        select: () => ({
          eq: () => ({
            is: () => Promise.resolve({ data: clients, error: null }),
          }),
        }),
      };
    }
    if (table === "client_self_satisfaction") {
      return {
        select: () => ({
          gte: () => Promise.resolve({ data: satisfacoesDaSemana, error: null }),
        }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
}

beforeEach(() => {
  fromMock.mockReset();
  sendPushToClientMock.mockReset();
  sendPushToClientMock.mockResolvedValue(undefined);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("detectClienteSelfSatisfactionSemanal", () => {
  it("não dispara nada fora de segunda-feira", async () => {
    // Domingo (UTC day 0)
    vi.setSystemTime(new Date("2026-05-17T10:00:00Z"));
    const counters = { cliente_self_satisfaction_semanal: 0 };
    await detectClienteSelfSatisfactionSemanal(counters);
    expect(sendPushToClientMock).not.toHaveBeenCalled();
    expect(counters.cliente_self_satisfaction_semanal).toBe(0);
  });

  it("na segunda, dispara push pros clientes sem entry da semana atual", async () => {
    // Segunda (UTC day 1)
    vi.setSystemTime(new Date("2026-05-18T10:00:00Z"));
    setupDB(
      [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
      [{ client_id: "c2" }], // só c2 já avaliou
    );
    const counters = { cliente_self_satisfaction_semanal: 0 };
    await detectClienteSelfSatisfactionSemanal(counters);
    expect(sendPushToClientMock).toHaveBeenCalledTimes(2);
    expect(sendPushToClientMock).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ title: expect.stringContaining("Yide"), url: "/cliente" }),
    );
    expect(sendPushToClientMock).toHaveBeenCalledWith(
      "c3",
      expect.any(Object),
    );
    expect(sendPushToClientMock).not.toHaveBeenCalledWith("c2", expect.any(Object));
    expect(counters.cliente_self_satisfaction_semanal).toBe(2);
  });

  it("na segunda, se todos já avaliaram, não dispara nada", async () => {
    vi.setSystemTime(new Date("2026-05-18T10:00:00Z"));
    setupDB(
      [{ id: "c1" }, { id: "c2" }],
      [{ client_id: "c1" }, { client_id: "c2" }],
    );
    const counters = { cliente_self_satisfaction_semanal: 0 };
    await detectClienteSelfSatisfactionSemanal(counters);
    expect(sendPushToClientMock).not.toHaveBeenCalled();
    expect(counters.cliente_self_satisfaction_semanal).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar — ver falhar**

```bash
npm test -- tests/unit/cron-cliente-self-satisfaction-semanal.test.ts
```

Esperado: `Cannot find module`.

- [ ] **Step 3: Criar o detector**

Crie `src/lib/cron/detectors/cliente-self-satisfaction-semanal.ts`:

```typescript
// SERVER ONLY: do not import from client components

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendPushToClient } from "@/lib/cliente-portal/push";
import { currentIsoWeek } from "@/lib/satisfacao/iso-week";

/**
 * Toda segunda-feira: dispara Web Push pros clientes que ainda não
 * registraram autoavaliação na semana ISO atual. Cliente sem portal
 * user ativo não recebe nada (sendPushToClient já é no-op nesse caso).
 *
 * Counter incrementa pra cada cliente notificado.
 */
export async function detectClienteSelfSatisfactionSemanal(
  counters: { cliente_self_satisfaction_semanal: number },
): Promise<void> {
  const dayOfWeek = new Date().getUTCDay(); // 1 = segunda
  if (dayOfWeek !== 1) return;

  const admin = createServiceRoleClient();

  // 1. Clientes ativos.
  const { data: clientsData } = await admin
    .from("clients")
    .select("id")
    .eq("status", "ativo")
    .is("deleted_at", null);
  const clients = (clientsData ?? []) as Array<{ id: string }>;
  if (clients.length === 0) return;

  // 2. Quem já submeteu nesta semana ISO.
  //    Como currentIsoWeek é string tipo "2026-W20" e a tabela guarda
  //    submitted_at timestamptz, calculamos cutoff da semana (segunda 00:00 UTC).
  const weekStart = startOfIsoWeek(new Date()).toISOString();
  const { data: satisfData } = await admin
    .from("client_self_satisfaction")
    .select("client_id")
    .gte("submitted_at", weekStart);
  const submetidos = new Set(
    ((satisfData ?? []) as Array<{ client_id: string }>).map((s) => s.client_id),
  );

  // 3. Pra quem falta, dispara push.
  const payload = {
    title: "Yide — Como tá a parceria essa semana?",
    body: "Manda sua nota rapidinho pra gente saber como melhorar 👋",
    url: "/cliente",
    tag: "self-satisfaction-semanal",
  };
  for (const c of clients) {
    if (submetidos.has(c.id)) continue;
    await sendPushToClient(c.id, payload);
    counters.cliente_self_satisfaction_semanal++;
  }

  // `currentIsoWeek` import só pra documentar a semântica de "semana atual"
  // — não usamos diretamente, mas garante consistência com /satisfacao.
  void currentIsoWeek;
}

/** Segunda-feira 00:00 UTC da semana ISO da data passada. */
function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // domingo=0 vira 7
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d;
}
```

- [ ] **Step 4: Rodar — passa**

```bash
npm test -- tests/unit/cron-cliente-self-satisfaction-semanal.test.ts
```

Esperado: 3 testes passando.

- [ ] **Step 5: Registrar no daily-digest**

Em `src/lib/cron/daily-digest.ts`, encontre este trecho no topo:

```typescript
import { detectChecklistPainel } from "./detectors/checklist-painel";
```

Adicione embaixo:

```typescript
import { detectClienteSelfSatisfactionSemanal } from "./detectors/cliente-self-satisfaction-semanal";
```

Encontre a interface `DigestCounters`:

```typescript
export interface DigestCounters {
  task_overdue: number;
  task_prazo_amanha: number;
  evento_calendario_hoje: number;
  marco_zero_24h: number;
  aniversario_socio_cliente: number;
  aniversario_colaborador: number;
  renovacao_contrato: number;
  satisfacao_pendente: number;
  checklist_painel: number;
}
```

Adicione o campo novo no fim:

```typescript
export interface DigestCounters {
  task_overdue: number;
  task_prazo_amanha: number;
  evento_calendario_hoje: number;
  marco_zero_24h: number;
  aniversario_socio_cliente: number;
  aniversario_colaborador: number;
  renovacao_contrato: number;
  satisfacao_pendente: number;
  checklist_painel: number;
  cliente_self_satisfaction_semanal: number;
}
```

Encontre a inicialização dos counters dentro de `runDailyDigest` (logo após `cron_runs.insert`):

```typescript
  const counters: DigestCounters = {
    task_overdue: 0,
    task_prazo_amanha: 0,
    evento_calendario_hoje: 0,
    marco_zero_24h: 0,
    aniversario_socio_cliente: 0,
    aniversario_colaborador: 0,
```

Adicione o novo campo no objeto (no fim do bloco, antes de `};`):

```typescript
    renovacao_contrato: 0,
    satisfacao_pendente: 0,
    checklist_painel: 0,
    cliente_self_satisfaction_semanal: 0,
  };
```

E logo após a chamada de `detectChecklistPainel(counters)` (ou onde os detectores são chamados em sequência), adicione:

```typescript
  await detectClienteSelfSatisfactionSemanal(counters);
```

- [ ] **Step 6: Typecheck + lint + suite completa**

```bash
npm run typecheck && npm run lint && npm test
```

Esperado: 0 erros novos. Pré-existentes (cheerio/web-push e suite de tests não relacionados) continuam.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/cron-cliente-self-satisfaction-semanal.test.ts src/lib/cron/detectors/cliente-self-satisfaction-semanal.ts src/lib/cron/daily-digest.ts
git commit -m "$(cat <<'EOF'
feat(cron): detector semanal pra pedir self-satisfaction do cliente

Segunda-feira: detector identifica clientes ativos sem entry da semana
ISO atual em client_self_satisfaction e dispara push via
sendPushToClient. Counter agregado vai pro retorno do daily-digest.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Componente `EnablePushButton` pro portal

**Files:**
- Create: `src/components/cliente-portal/EnablePushButton.tsx`

> **Por que duplicar (não generalizar):** o componente interno tem 220 linhas com 4 actions diferentes hardcoded e branches de estado. Generalizar via props ia explodir a API. Duplicar a base, manter ambos focados.

- [ ] **Step 1: Criar o componente**

Crie `src/components/cliente-portal/EnablePushButton.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  subscribeClientPortalPushAction,
  unsubscribeClientPortalPushAction,
  sendTestClientPortalPushAction,
} from "@/lib/cliente-portal/push-actions";

interface Props {
  vapidPublicKey: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64(buffer: ArrayBuffer | ArrayBufferLike | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function EnablePushButton({ vapidPublicKey }: Props) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const t = setTimeout(() => {
      if (cancelled) return;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setSupported(false);
        setSubscribed(false);
        return;
      }
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (!cancelled) setSubscribed(!!sub);
        })
        .catch(() => {
          if (!cancelled) setSubscribed(false);
        });
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  async function handleEnable() {
    setPending(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error(
          "Você precisa permitir notificações. No iPhone, instale o app antes (Safari → Compartilhar → Adicionar à Tela de Início).",
        );
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      });

      const json = sub.toJSON();
      const fd = new FormData();
      fd.set("endpoint", sub.endpoint);
      fd.set("p256dh", json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh")));
      fd.set("auth", json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth")));
      fd.set("user_agent", navigator.userAgent);

      const r = await subscribeClientPortalPushAction(fd);
      if (r.error) {
        toast.error(r.error);
        await sub.unsubscribe().catch(() => {});
        return;
      }
      setSubscribed(true);
      toast.success("Notificações ativadas neste dispositivo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ativar notificações");
    } finally {
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const fd = new FormData();
        fd.set("endpoint", sub.endpoint);
        await unsubscribeClientPortalPushAction(fd);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notificações desativadas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao desativar");
    } finally {
      setPending(false);
    }
  }

  async function handleTest() {
    setPending(true);
    try {
      const r = await sendTestClientPortalPushAction();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Notificação enviada — confira a tela do celular");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar teste");
    } finally {
      setPending(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Esse navegador não suporta notificações. No iPhone, use Safari e instale o app na tela inicial primeiro.
      </p>
    );
  }

  if (subscribed === null) {
    return <Button variant="outline" disabled>Carregando...</Button>;
  }

  if (subscribed) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={handleTest} disabled={pending}>
          <Send className="mr-1.5 h-4 w-4" />
          {pending ? "Enviando..." : "Enviar teste"}
        </Button>
        <Button type="button" variant="outline" onClick={handleDisable} disabled={pending}>
          <BellOff className="mr-1.5 h-4 w-4" />
          Desativar
        </Button>
      </div>
    );
  }

  return (
    <Button type="button" onClick={handleEnable} disabled={pending}>
      <Bell className="mr-1.5 h-4 w-4" />
      {pending ? "Ativando..." : "Ativar notificações neste dispositivo"}
    </Button>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Esperado: 0 erros novos.

- [ ] **Step 3: Commit (sem testar isolado — vai ser testado via integração na Task 7)**

```bash
git add src/components/cliente-portal/EnablePushButton.tsx
git commit -m "$(cat <<'EOF'
feat(cliente-portal): componente EnablePushButton

Botão de ativar/desativar/testar push pro portal externo. Base
copiada do componente interno (src/components/pwa/EnablePushButton.tsx)
com actions trocadas pras do portal e textos amigáveis pro cliente
final (inclui dica de iOS sobre Adicionar à Tela de Início).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `NotificacoesSection` no portal

**Files:**
- Create: `src/components/cliente-portal/NotificacoesSection.tsx`
- Modify: `src/app/(cliente)/cliente/page.tsx`

- [ ] **Step 1: Criar o card da seção**

Crie `src/components/cliente-portal/NotificacoesSection.tsx`:

```typescript
import { Bell } from "lucide-react";
import { EnablePushButton } from "./EnablePushButton";

interface Props {
  vapidPublicKey: string | undefined;
}

/**
 * Card que oferece ativar push no portal. Some silenciosamente se VAPID
 * não estiver configurado (mesmo padrão do interno em /configuracoes).
 */
export function NotificacoesSection({ vapidPublicKey }: Props) {
  if (!vapidPublicKey) return null;

  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
        <header className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Notificações</h2>
            <p className="text-xs text-muted-foreground">
              Receba avisos da Yide direto no seu celular
            </p>
          </div>
        </header>

        <div className="mt-5">
          <EnablePushButton vapidPublicKey={vapidPublicKey} />
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          No iPhone: instale o app antes (Safari → ícone de compartilhar →
          &quot;Adicionar à Tela de Início&quot;).
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Adicionar no `page.tsx` do portal**

Em `src/app/(cliente)/cliente/page.tsx`, encontre os imports e adicione:

```typescript
import { NotificacoesSection } from "@/components/cliente-portal/NotificacoesSection";
import { env } from "@/lib/env";
```

(Se já existir `import { env } from "@/lib/env";` no arquivo, não duplique.)

Encontre o trecho que renderiza as seções:

```tsx
        <HeroSection
          nomeContato={user.nomeContato}
          clientNome={data.cliente.nome}
        />
        <PastaSection driveUrl={data.cliente.drive_url} />
```

Insira `NotificacoesSection` logo após `HeroSection`:

```tsx
        <HeroSection
          nomeContato={user.nomeContato}
          clientNome={data.cliente.nome}
        />
        <NotificacoesSection vapidPublicKey={env.NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
        <PastaSection driveUrl={data.cliente.drive_url} />
```

- [ ] **Step 3: Typecheck + lint**

```bash
npm run typecheck && npm run lint
```

Esperado: 0 erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/components/cliente-portal/NotificacoesSection.tsx 'src/app/(cliente)/cliente/page.tsx'
git commit -m "$(cat <<'EOF'
feat(cliente-portal): card NotificacoesSection no portal

Adiciona seção "Notificações" logo abaixo do Hero, com botão de ativar
push. Some silenciosamente se VAPID não estiver configurado. Texto de
ajuda lembra usuários de iPhone que precisam instalar o app antes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Push, PR e smoke test

- [ ] **Step 1: Push da branch**

```bash
git push -u origin claude/cliente-portal-push
```

- [ ] **Step 2: Criar PR**

```bash
gh pr create --title "feat(cliente-portal): push notifications (infra + autoavaliação semanal)" --body "$(cat <<'EOF'
## Summary
Liberação de Web Push pro portal externo do cliente.

**V1 ativo:**
- Migration relaxa FK de \`push_subscriptions\` pra aceitar \`auth.users\` (portal users).
- Server actions \`subscribe/unsubscribe/sendTest\` no namespace \`cliente-portal\`.
- Helper \`sendPushToClient(clientId, payload)\` — dispara pros até 5 portal users ativos do cliente.
- Componente \`EnablePushButton\` + card \`NotificacoesSection\` no portal.
- **Trigger ativo:** detector semanal (segunda-feira) que pede autoavaliação aos clientes sem entry da semana.

**Deferido (helpers prontos, falta wire):**
- Push de nova reunião agendada (módulo em Fase 0/1).
- Push de resumo de reunião pronto (summarizer em Fase 3 stub).

Quando esses dois features maturarem, basta 1 linha de \`sendPushToClient(...)\` no ponto certo.

## Deploy
- ⚠️ **Aplicar migração no Supabase remoto** antes do deploy: \`npx supabase db push\` ou cola o SQL de \`supabase/migrations/20260521000000_push_subscriptions_relax_fk.sql\` no SQL Editor.
- VAPID já configurado em produção (\`NEXT_PUBLIC_VAPID_PUBLIC_KEY\`, \`VAPID_PRIVATE_KEY\`, \`VAPID_SUBJECT\`).

## Test plan
- [x] 11 testes unit cobrindo actions, helper e detector.
- [x] \`npm run typecheck\` sem erros novos.
- [x] \`npm run lint\` sem erros.
- [ ] **Smoke pós-deploy:** cliente instala PWA no iPhone → abre portal → "Ativar notificações" → toca "Enviar teste" → notificação chega no celular.
- [ ] **Smoke do cron:** disparar manualmente o endpoint \`/api/cron/daily-digest\` numa segunda-feira (ou mockar a data) e validar que clientes sem entry recebem o push.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Aplicar migração no Supabase remoto (manual)**

Avisar o usuário: depois do PR mergeado, aplicar a migração no SQL Editor do Supabase Studio:

```sql
alter table public.push_subscriptions
  drop constraint push_subscriptions_user_id_fkey;
alter table public.push_subscriptions
  add constraint push_subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
```

Ou via CLI: `npx supabase db push`.

- [ ] **Step 4: Reportar URL do PR e checklist**

---

## Self-review checklist

- [x] **Spec coverage:**
  - Migration FK ✓ (Task 1)
  - Subscribe/unsubscribe/test actions ✓ (Task 2)
  - sendPushToClient helper ✓ (Task 3)
  - Trigger #3 (cron semanal) ✓ (Task 4)
  - Triggers #1/#2 deferidos com helper pronto ✓ (helpers em Task 3, documentação em spec)
  - EnablePushButton portal ✓ (Task 5)
  - NotificacoesSection no /cliente ✓ (Task 6)
  - VAPID hide-when-missing ✓ (NotificacoesSection retorna null)
- [x] **Sem placeholders:** todo step tem código completo, comando exato, output esperado.
- [x] **Type consistency:**
  - `sendPushToClient(clientId, payload)` consistente entre helper, testes, e detector.
  - `ClientPushPayload` exportado e reusado.
  - `DigestCounters.cliente_self_satisfaction_semanal` consistente entre detector + daily-digest.
- [x] **Commits frequentes:** 6 commits (1 por task).
