# Notificações obrigatórias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 3 triggers de notificação obrigatória da spec 2026-05-08: digest 18h pra eventos de amanhã, lembrete 30min antes de cada evento, e push pra cada nova msg do escritório virtual (com destaque pra menções).

**Architecture:** 3 novos `notification_event` (enum) + 1 coluna nova em `calendar_events` (`reminded_30min_at`) + 2 novos crons Vercel + 2 novos detectors em `src/lib/cron/detectors/` + 1 dispatcher custom em `src/lib/notificacoes/dispatch-chat.ts`. Reuso da infra de `dispatchNotification` pra calendário; chat usa dispatcher próprio porque texto varia por destinatário (mencionado vs não).

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + service role), Vercel Cron, vitest.

**Estratégia de PR:** 3 PRs sequenciais e independentemente deployáveis:
- **PR A:** Migrations + regen de types + labels no painel admin (foundation, não dispara nada novo)
- **PR B:** Calendário — digest 18h + lembrete 30min (cron + detectors + reset em edição)
- **PR C:** Chat — custom dispatcher + hook em `sendChatMessageAction`

---

## PR A — Foundation: migrations + types + labels

### Task A.1 — Migration: novos valores no enum `notification_event`

**Files:**
- Create: `supabase/migrations/20260508120000_add_notification_events_calendario_chat.sql`

**Por que migration separada:** `ALTER TYPE ... ADD VALUE` no Postgres não pode rodar dentro do mesmo transaction que **usa** os novos valores. Tem que estar isolada e commitada antes da migration B.

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- supabase/migrations/20260508120000_add_notification_events_calendario_chat.sql
-- Adiciona valores ao enum notification_event. Precisa rodar ANTES da
-- migration que insere notification_rules referenciando esses valores —
-- Postgres exige ALTER TYPE ... ADD VALUE em transação separada.

ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'evento_calendario_amanha';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'evento_calendario_30min';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'chat_mensagem';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260508120000_add_notification_events_calendario_chat.sql
git commit -m "feat(notif): adiciona enum values evento_calendario_amanha/30min e chat_mensagem"
```

### Task A.2 — Migration: coluna `reminded_30min_at` + index parcial + seeds

**Files:**
- Create: `supabase/migrations/20260508120100_event_reminders_and_seed_notif_rules.sql`

- [ ] **Step 1: Criar migration**

```sql
-- supabase/migrations/20260508120100_event_reminders_and_seed_notif_rules.sql
-- Coluna pra impedir lembrete 30min duplicado. Index parcial otimiza o
-- query do cron a cada 5 min: filtra eventos por inicio mas ignora os
-- já lembrados.

ALTER TABLE calendar_events
  ADD COLUMN reminded_30min_at TIMESTAMPTZ;

CREATE INDEX idx_calendar_events_inicio_pending_reminder
  ON calendar_events (inicio)
  WHERE reminded_30min_at IS NULL;

-- Seeds das 3 novas regras como mandatory.
-- email_default=false em todas: notif por email pra cada msg/evento
-- seria spam pesado.
-- permite_destinatarios_extras=true: dispatcher passa participantes_ids
-- (calendário) ou destinatários do canal (chat) via user_ids_extras.
INSERT INTO notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
VALUES
  ('evento_calendario_amanha', true, true, false, true, '{}', '{}'),
  ('evento_calendario_30min',  true, true, false, true, '{}', '{}'),
  ('chat_mensagem',            true, true, false, true, '{}', '{}')
ON CONFLICT (evento_tipo) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260508120100_event_reminders_and_seed_notif_rules.sql
git commit -m "feat(notif): coluna reminded_30min_at + seeds das 3 regras novas"
```

### Task A.3 — Aplicar migrations no Supabase remoto

- [ ] **Step 1: Push migrations**

Run: `npm run db:push`

Expected output: 2 migrations applied successfully (`20260508120000_*` and `20260508120100_*`).

Se falhar: ler o erro. Se for `value already exists` no enum, é seguro ignorar (a primeira migration usa `IF NOT EXISTS`).

### Task A.4 — Regenerar `src/types/database.ts`

- [ ] **Step 1: Regen types**

Run: `npm run db:types`

Expected: `src/types/database.ts` modificado com `evento_calendario_amanha`, `evento_calendario_30min`, `chat_mensagem` no `Enums.notification_event` e `reminded_30min_at: string | null` no `calendar_events.Row`.

- [ ] **Step 2: Verificar com grep**

Run:
```bash
grep -E "evento_calendario_amanha|reminded_30min_at" src/types/database.ts | head
```
Expected: 4+ matches (enum + Insert + Update + table column).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: Sem erros novos. (O erro pré-existente de `web-push` no env local é OK; ignore.)

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(types): regen database types com notification_event novos + reminded_30min_at"
```

### Task A.5 — Adicionar labels dos 3 novos tipos no painel de admin

**Files:**
- Modify: `src/components/notificacoes/RuleCard.tsx` — bloco `eventLabels` no topo
- Modify: `src/app/(authed)/configuracoes/notificacoes/page.tsx` — bloco `eventLabels` no topo

Esses dois mapas são duplicados (mesma estrutura). Precisamos atualizar ambos.

- [ ] **Step 1: Adicionar 3 entries em `RuleCard.tsx`**

Localizar o objeto `const eventLabels: Record<string, string> = { ... }` (atualmente termina com `satisfacao_pendente: "Satisfação pendente",`).

Adicionar logo antes da chave de fechamento `};`:

```tsx
  evento_calendario_amanha: "Resumo dos eventos de amanhã (18h)",
  evento_calendario_30min: "Lembrete 30 minutos antes do evento",
  chat_mensagem: "Mensagens no escritório virtual",
```

- [ ] **Step 2: Adicionar as MESMAS 3 entries em `page.tsx`**

Mesmo bloco em [`src/app/(authed)/configuracoes/notificacoes/page.tsx`](src/app/(authed)/configuracoes/notificacoes/page.tsx). Cole as mesmas 3 linhas no objeto `eventLabels` lá.

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/notificacoes/RuleCard.tsx 'src/app/(authed)/configuracoes/notificacoes/page.tsx'`

Expected: Sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/components/notificacoes/RuleCard.tsx 'src/app/(authed)/configuracoes/notificacoes/page.tsx'
git commit -m "feat(notif): labels pt-BR pros 3 novos tipos no painel admin"
```

### Task A.6 — Abrir PR A

- [ ] **Step 1: Push e abre PR**

```bash
git push -u origin <BRANCH>
gh pr create --base main --title "feat(notif): foundation pras notificações de calendário+chat (migrations + labels)" --body "$(cat <<'EOF'
## Summary

Foundation do feature pack de notificações obrigatórias (spec [2026-05-08](docs/superpowers/specs/2026-05-08-notificacoes-calendario-e-chat-design.md)). Esse PR é a base que **não dispara nenhuma notificação nova ainda** — só prepara enum, coluna e UI.

- 3 valores novos no enum `notification_event`: \`evento_calendario_amanha\`, \`evento_calendario_30min\`, \`chat_mensagem\`
- Coluna \`calendar_events.reminded_30min_at\` + index parcial pro cron de 5 min
- Seeds das 3 regras como \`mandatory=true\`, \`email_default=false\`
- Regenerou \`src/types/database.ts\`
- Labels pt-BR no painel admin

## Test plan

- [ ] \`npm run db:push\` aplica as 2 migrations sem erro
- [ ] Login como admin → /configuracoes/notificacoes → "Regras do sistema" lista as 3 entradas novas com labels em pt-BR
- [ ] Tipos compilam (\`npx tsc --noEmit\` limpo, exceto erro pré-existente de web-push)

Continuação em PR B (calendário) e PR C (chat).
EOF
)"
```

---

## PR B — Calendário: digest 18h + lembrete 30min antes

### Task B.1 — Detector `evento-calendario-amanha`

**Files:**
- Create: `src/lib/cron/detectors/evento-calendario-amanha.ts`

Faz query dos eventos com `inicio` no dia seguinte (timezone BRT), agrupa por usuário (cada participante), monta um resumo único por usuário com até 5 eventos, dispara via `dispatchNotification`.

- [ ] **Step 1: Escrever o detector**

```ts
// src/lib/cron/detectors/evento-calendario-amanha.ts
// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

interface CounterShape { evento_calendario_amanha: number }
interface EventRow {
  id: string;
  titulo: string;
  inicio: string;
  participantes_ids: string[];
  sub_calendar: string;
}

/**
 * Pra cada usuário com 1+ eventos amanhã, dispara UMA notificação resumo
 * com até 5 eventos formatados como "10h — Reunião X · 14h — Gravação Y".
 * Mais que 5 vira "...e mais N".
 *
 * Timezone: usa BRT pra calcular "amanhã" (UTC-3, sem DST). Isso casa com
 * o cron rodando às 21:00 UTC (18:00 BRT).
 */
export async function detectEventsTomorrow(counters: CounterShape): Promise<void> {
  const supabase = createServiceRoleClient();

  // "Amanhã" em BRT — aproximação: 21:00 UTC de hoje + 3h ~ 00:00 BRT amanhã
  // Mas pra ser rigoroso, usamos a data BRT corrente.
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000); // shift -3h
  const tomorrowBRT = new Date(nowBRT.getFullYear(), nowBRT.getMonth(), nowBRT.getDate() + 1);
  // Reconverte pra UTC pra usar nas queries
  const startUTC = new Date(tomorrowBRT.getTime() + 3 * 60 * 60 * 1000);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, participantes_ids, sub_calendar")
    .gte("inicio", startUTC.toISOString())
    .lt("inicio", endUTC.toISOString())
    .order("inicio", { ascending: true });

  const events = (data ?? []) as EventRow[];
  if (events.length === 0) return;

  // Agrupa por usuário
  const byUser = new Map<string, EventRow[]>();
  for (const e of events) {
    if (!e.participantes_ids || e.participantes_ids.length === 0) continue;
    for (const userId of e.participantes_ids) {
      const list = byUser.get(userId) ?? [];
      list.push(e);
      byUser.set(userId, list);
    }
  }

  for (const [userId, userEvents] of byUser) {
    const titulo =
      userEvents.length === 1
        ? "Você tem 1 evento amanhã"
        : `Você tem ${userEvents.length} eventos amanhã`;

    const preview = userEvents.slice(0, 5).map((e) => {
      const hora = new Date(e.inicio).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      });
      const prefix = e.sub_calendar === "videomakers" ? "Gravação" : "Reunião";
      return `${hora} — ${prefix} ${e.titulo}`;
    }).join(" · ");

    const remaining = userEvents.length - 5;
    const mensagem = remaining > 0 ? `${preview} · ...e mais ${remaining}` : preview;

    await dispatchNotification({
      evento_tipo: "evento_calendario_amanha",
      titulo,
      mensagem,
      link: "/calendario",
      user_ids_extras: [userId],
    });
    counters.evento_calendario_amanha++;
  }
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/lib/cron/detectors/evento-calendario-amanha.ts`
Expected: Sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cron/detectors/evento-calendario-amanha.ts
git commit -m "feat(notif): detector evento_calendario_amanha (digest único por usuário)"
```

### Task B.2 — Detector `evento-calendario-30min`

**Files:**
- Create: `src/lib/cron/detectors/evento-calendario-30min.ts`

Cron a cada 5 min. Busca eventos em janela `[agora+25min, agora+35min]` que ainda não foram lembrados (`reminded_30min_at IS NULL`). Pra cada um, dispara notif e marca como lembrado.

- [ ] **Step 1: Escrever**

```ts
// src/lib/cron/detectors/evento-calendario-30min.ts
// SERVER ONLY
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";

interface CounterShape { evento_calendario_30min: number }
interface EventRow {
  id: string;
  titulo: string;
  inicio: string;
  participantes_ids: string[];
  sub_calendar: string;
}

/**
 * Janela de 10 min em volta do "30 antes" pra absorver atrasos do cron.
 * O index parcial idx_calendar_events_inicio_pending_reminder otimiza
 * essa query (filtra reminded_30min_at IS NULL no escopo do index).
 *
 * Dispatch e UPDATE rodam serial por evento — race condition entre runs
 * paralelos é improvável (cron Vercel não overlapa) mas o UPDATE protege
 * com WHERE reminded_30min_at IS NULL caso aconteça.
 */
export async function detectEventsIn30Min(counters: CounterShape): Promise<void> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const lo = new Date(now.getTime() + 25 * 60 * 1000).toISOString();
  const hi = new Date(now.getTime() + 35 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("calendar_events")
    .select("id, titulo, inicio, participantes_ids, sub_calendar")
    .gte("inicio", lo)
    .lt("inicio", hi)
    .is("reminded_30min_at", null);

  const events = (data ?? []) as EventRow[];
  for (const e of events) {
    if (!e.participantes_ids || e.participantes_ids.length === 0) {
      // Marca como lembrado mesmo sem participantes pra não voltar nas próximas runs
      await supabase
        .from("calendar_events")
        .update({ reminded_30min_at: new Date().toISOString() })
        .eq("id", e.id)
        .is("reminded_30min_at", null);
      continue;
    }

    const prefix = e.sub_calendar === "videomakers" ? "Gravação" : "Reunião";
    await dispatchNotification({
      evento_tipo: "evento_calendario_30min",
      titulo: `Em 30 min: ${prefix} ${e.titulo}`,
      mensagem: `Começa às ${new Date(e.inicio).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })}`,
      link: `/calendario/${e.id}`,
      user_ids_extras: e.participantes_ids,
    });

    // Marca como lembrado APÓS o dispatch. Se o dispatch lançar exceção,
    // marcamos mesmo assim no catch externo? Não: deixa NULL e tenta de novo
    // no próximo cron (até a janela passar — depois disso fica órfão, mas
    // raro). Aqui só marcamos no caminho feliz.
    await supabase
      .from("calendar_events")
      .update({ reminded_30min_at: new Date().toISOString() })
      .eq("id", e.id)
      .is("reminded_30min_at", null);

    counters.evento_calendario_30min++;
  }
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/lib/cron/detectors/evento-calendario-30min.ts`
Expected: Sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cron/detectors/evento-calendario-30min.ts
git commit -m "feat(notif): detector evento_calendario_30min com janela 25-35 min e idempotência"
```

### Task B.3 — Cron handler `evening-digest`

**Files:**
- Create: `src/app/api/cron/evening-digest/route.ts`

Análogo ao `daily-digest` existente em [`src/app/api/cron/daily-digest/route.ts`](src/app/api/cron/daily-digest/route.ts).

- [ ] **Step 1: Escrever handler**

```ts
// src/app/api/cron/evening-digest/route.ts
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { detectEventsTomorrow } from "@/lib/cron/detectors/evento-calendario-amanha";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";

interface Counters { evento_calendario_amanha: number }

/**
 * Roda 1x/dia às 21:00 UTC (18:00 BRT). Idempotente: registra em cron_runs
 * com run_date = hoje em BRT. Re-execução no mesmo dia retorna skipped.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: existing } = await supabase
    .from("cron_runs")
    .select("ran_at")
    .eq("job_name", "evening-digest")
    .eq("run_date", today)
    .maybeSingle();
  if (existing) return NextResponse.json({ skipped: true, reason: "already ran today" });

  await supabase.from("cron_runs").insert({ job_name: "evening-digest", run_date: today });

  const counters: Counters = { evento_calendario_amanha: 0 };
  try {
    await detectEventsTomorrow(counters);
  } catch (e) {
    console.error("[evening-digest] failure:", e);
  }

  await supabase
    .from("cron_runs")
    .update({ details: counters as unknown as Json })
    .eq("job_name", "evening-digest")
    .eq("run_date", today);

  return NextResponse.json({ counters, ran_at: new Date().toISOString() });
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/app/api/cron/evening-digest/route.ts`
Expected: Sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/evening-digest/route.ts
git commit -m "feat(notif): cron evening-digest (18h BRT) chama detectEventsTomorrow"
```

### Task B.4 — Cron handler `event-reminders`

**Files:**
- Create: `src/app/api/cron/event-reminders/route.ts`

Roda a cada 5 min. **Não** usa `cron_runs` pra idempotência (esse cron roda múltiplas vezes/dia); idempotência é feita pela coluna `reminded_30min_at` por evento.

- [ ] **Step 1: Escrever handler**

```ts
// src/app/api/cron/event-reminders/route.ts
import { NextResponse } from "next/server";
import { detectEventsIn30Min } from "@/lib/cron/detectors/evento-calendario-30min";

export const dynamic = "force-dynamic";

/**
 * Roda a cada 5 min (Vercel cron */5 * * * *).
 * Idempotência por evento via reminded_30min_at, não por dia — então
 * não usamos cron_runs aqui.
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const counters = { evento_calendario_30min: 0 };
  try {
    await detectEventsIn30Min(counters);
  } catch (e) {
    console.error("[event-reminders] failure:", e);
    return NextResponse.json({ error: "internal", counters }, { status: 500 });
  }

  return NextResponse.json({ counters, ran_at: new Date().toISOString() });
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint src/app/api/cron/event-reminders/route.ts`
Expected: Sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/event-reminders/route.ts
git commit -m "feat(notif): cron event-reminders (a cada 5 min) com idempotência por evento"
```

### Task B.5 — Adicionar crons no `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Editar**

Atualizar o array `crons` pra incluir os 2 novos. O arquivo final fica:

```json
{
  "crons": [
    { "path": "/api/cron/daily-digest", "schedule": "0 11 * * *" },
    { "path": "/api/cron/evening-digest", "schedule": "0 21 * * *" },
    { "path": "/api/cron/event-reminders", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/monthly-snapshot", "schedule": "0 3 1 * *" },
    { "path": "/api/cron/recados-arquivar", "schedule": "0 6 * * *" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(notif): registra crons evening-digest e event-reminders no Vercel"
```

### Task B.6 — Reset de `reminded_30min_at` em edição de evento

**Files:**
- Modify: `src/lib/calendario/actions.ts` — função `updateEventAction`

Quando o evento é editado e o `inicio` muda, o lembrete já enviado deixa de ser válido. Resetar a coluna pra `NULL` faz o cron de 30 min re-disparar pro novo horário.

- [ ] **Step 1: Localizar a função e o ponto certo**

Run:
```bash
grep -n "updateEventAction\|update.*calendar_events\|inicio" src/lib/calendario/actions.ts | head -15
```

A função `updateEventAction` faz:
1. Busca evento atual (`before`)
2. Calcula novo payload (`update`)
3. UPDATE no DB

Vamos adicionar lógica: se `before.inicio !== novoInicio`, incluir `reminded_30min_at: null` no payload do update.

- [ ] **Step 2: Aplicar a edit**

Encontrar o trecho onde `update` é construído. A struct deve ter algo como:
```ts
const update = {
  titulo: ...,
  inicio: novoInicio,
  fim: novoFim,
  ...
};
```

Adicionar logo depois:
```ts
// Se o início mudou, zerar o reminder pra re-disparar pro novo horário
if (before && before.inicio !== novoInicio) {
  (update as { reminded_30min_at: string | null }).reminded_30min_at = null;
}
```

(O cast existe pra contornar o tipo strict — o `update` provavelmente tem tipo derivado.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: Sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/lib/calendario/actions.ts
git commit -m "fix(calendario): zera reminded_30min_at quando inicio do evento muda"
```

### Task B.7 — Abrir PR B

- [ ] **Step 1: Push e abre PR**

```bash
git push -u origin <BRANCH>
gh pr create --base main --title "feat(notif): calendário — digest 18h + lembrete 30 min antes" --body "$(cat <<'EOF'
## Summary

Implementa os 2 triggers de notificação do calendário descritos no spec:

- **Cron \`evening-digest\` (18h BRT):** dispara 1 notificação resumo por usuário com até 5 eventos do dia seguinte. Texto adapta-se a "Reunião" ou "Gravação" baseado em \`sub_calendar\`.
- **Cron \`event-reminders\` (a cada 5 min):** dispara lembrete 30 min antes de cada evento. Idempotência via coluna \`reminded_30min_at\`.
- **Reset em edição:** se o admin editar o \`inicio\` de um evento, \`reminded_30min_at\` é zerado pra re-disparar pro novo horário.

Depende do PR A (foundation).

## Test plan

- [ ] Após deploy, criar evento amanhã às 14h — esperar 18h BRT, deve receber resumo
- [ ] Criar evento daqui 30 min — esperar próximo cron de 5min, deve receber "Em 30 min: Reunião X"
- [ ] Editar o evento mudando início pra +1h — esperar próximo cron, deve receber novo lembrete
- [ ] Endpoint \`/api/cron/evening-digest\` sem auth retorna 401
- [ ] Endpoint \`/api/cron/event-reminders\` sem auth retorna 401
EOF
)"
```

---

## PR C — Chat: dispatcher custom + hook em `sendChatMessageAction`

### Task C.1 — Dispatcher `dispatch-chat.ts`

**Files:**
- Create: `src/lib/notificacoes/dispatch-chat.ts`

- [ ] **Step 1: Escrever**

```ts
// src/lib/notificacoes/dispatch-chat.ts
// SERVER ONLY: do not import from client components
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendWebPushToUser } from "@/lib/push/server";
import { canAccessChannel, type ChannelKind } from "@/lib/escritorio/types";

interface DispatchArgs {
  messageId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  channelKind: ChannelKind;
  channelName: string;
  conteudo: string;
  mentionedUserIds: string[];
}

/**
 * Dispatch custom porque cada destinatário precisa de texto/tag diferente:
 * - Mencionados: título "@você foi mencionado em #canal", tag única (não substitui)
 * - Não-mencionados: título "#canal", tag "chat-{channelId}" (próxima msg do
 *   mesmo canal substitui — evita pilha de notifs duplicadas)
 *
 * Bypass intencional do dispatchNotification central (em dispatch.ts) porque
 * aquele envia mesma mensagem pra todos.
 *
 * Recipients: todos os profiles ativos com role que tem acesso ao canal,
 * exceto o autor.
 */
export async function dispatchChatNotification(args: DispatchArgs): Promise<void> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Resolve destinatários: profiles ativos com acesso ao canal
  const { data: profilesData } = await sb
    .from("profiles")
    .select("id, role, ativo")
    .eq("ativo", true);
  const profiles = (profilesData ?? []) as Array<{ id: string; role: string }>;

  const recipientIds = profiles
    .filter((p) => p.id !== args.authorId)
    .filter((p) => canAccessChannel(p.role, args.channelKind))
    .map((p) => p.id);

  if (recipientIds.length === 0) return;

  const mentionedSet = new Set(args.mentionedUserIds);
  const preview = args.conteudo.length > 100
    ? args.conteudo.slice(0, 100) + "…"
    : args.conteudo;
  const link = `/escritorio/${args.channelKind}`;

  // Insert in-app notifications em batch
  const rows = recipientIds.map((uid) => {
    const isMentioned = mentionedSet.has(uid);
    return {
      user_id: uid,
      tipo: "chat_mensagem" as const,
      titulo: isMentioned
        ? `@você foi mencionado em #${args.channelName}`
        : `#${args.channelName}`,
      mensagem: `${args.authorName}: ${preview}`,
      link,
    };
  });

  const { error } = await sb.from("notifications").insert(rows);
  if (error) console.error("[dispatch-chat] in-app insert failed:", error.message);

  // Web push em paralelo
  await Promise.all(
    recipientIds.map(async (uid) => {
      const isMentioned = mentionedSet.has(uid);
      try {
        await sendWebPushToUser(uid, {
          title: isMentioned
            ? `@você foi mencionado em #${args.channelName}`
            : `#${args.channelName}`,
          body: `${args.authorName}: ${preview}`,
          url: link,
          // Mencionados: tag único pra não substituir notif anterior
          // Não-mencionados: mesmo canal compartilha tag → última msg
          // do canal aparece, anteriores somem (UX limpa pra canal ativo)
          tag: isMentioned ? `chat-mention-${args.messageId}` : `chat-${args.channelId}`,
        });
      } catch (e) {
        console.error("[dispatch-chat] push failed for user", uid, e);
      }
    }),
  );

  // Invalida contador do sininho pros destinatários
  revalidateTag("notifications", "default");
}
```

- [ ] **Step 2: Typecheck + lint**

Run:
```bash
npx tsc --noEmit && npx eslint src/lib/notificacoes/dispatch-chat.ts
```
Expected: Sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notificacoes/dispatch-chat.ts
git commit -m "feat(notif): dispatcher custom de chat com destaque pra mencionados"
```

### Task C.2 — Plugar `dispatchChatNotification` no `sendChatMessageAction`

**Files:**
- Modify: `src/lib/escritorio/actions.ts` — função `sendChatMessageAction`

Hoje o action chama `dispatchNotification({ evento_tipo: "task_assigned", ... })` apenas pros mencionados (workaround). Vamos:
1. Remover esse bloco
2. Chamar `dispatchChatNotification` com TODOS os dados que ele precisa (mencionados E não-mencionados são tratados internamente)

- [ ] **Step 1: Localizar e ler o trecho**

Run:
```bash
grep -n "dispatchNotification\|mencionados\|sendChatMessageAction" src/lib/escritorio/actions.ts | head -10
```

Vai apontar pra um bloco condicional com `if (parsed.data.mentioned_user_ids.length > 0)` que faz dispatch de `task_assigned`. Esse é o bloco a remover.

- [ ] **Step 2: Substituir o bloco antigo pelo novo**

Localizar e remover o bloco completo do `if (parsed.data.mentioned_user_ids.length > 0) { ... }` (incluindo `await dispatchNotification(...)` interno). Substituir por:

```ts
  // Notifica todos os usuários com acesso ao canal (menos o autor).
  // Mencionados ganham destaque visual via dispatch-chat.
  // Best-effort: falha aqui não bloqueia o envio da mensagem.
  try {
    await dispatchChatNotification({
      messageId: created.id,
      channelId: parsed.data.channel_id,
      authorId: actor.id,
      authorName: actor.nome,
      channelKind: channel.kind as ChannelKind,
      channelName: channel.nome,
      conteudo: parsed.data.conteudo,
      mentionedUserIds: parsed.data.mentioned_user_ids.filter((id) => id !== actor.id),
    });
  } catch (e) {
    console.error("[sendChatMessageAction] notification dispatch failed:", e);
  }
```

- [ ] **Step 3: Atualizar imports**

No topo do arquivo:
- Remover: `import { dispatchNotification } from "@/lib/notificacoes/dispatch";` se não tem mais uso
- Adicionar: `import { dispatchChatNotification } from "@/lib/notificacoes/dispatch-chat";`

(Verificar se `dispatchNotification` é usado em outras funções do arquivo antes de remover. Se sim, manter ambos.)

- [ ] **Step 4: Confirmar `actor.nome` existe**

Run: `grep -A2 "export.*requireAuth\|interface.*User\|type.*User" src/lib/auth/session.ts | head -20`

Expected: `nome` está nos campos do user. Se sim, `actor.nome` funciona. Se for `actor.name`, ajustar.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: Sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/escritorio/actions.ts
git commit -m "feat(notif): chat usa dispatch-chat.ts (cobre todos com acesso, destaca mencionados)"
```

### Task C.3 — Abrir PR C

- [ ] **Step 1: Push e abre PR**

```bash
git push -u origin <BRANCH>
gh pr create --base main --title "feat(notif): chat — push pra todos com acesso ao canal + destaque pra menções" --body "$(cat <<'EOF'
## Summary

Implementa o trigger de notificação do escritório virtual (spec [2026-05-08](docs/superpowers/specs/2026-05-08-notificacoes-calendario-e-chat-design.md)).

- Novo dispatcher custom \`src/lib/notificacoes/dispatch-chat.ts\` que envia push e in-app pra **todos os usuários com acesso ao canal** (menos o autor)
- **Mencionados** (\`@\`) recebem texto destacado: "@você foi mencionado em #canal" + tag único (não substitui notifs anteriores)
- **Não-mencionados** recebem "#canal" + tag compartilhado por canal (próxima msg do mesmo canal substitui — UX limpa em canal ativo)
- Substitui o workaround antigo que disparava \`task_assigned\` só pros mencionados

Depende do PR A (foundation) — usa o \`evento_tipo: chat_mensagem\` introduzido lá.

## Test plan

- [ ] User A envia msg em #geral. User B (sem ser mencionado) recebe push "#geral". User C (mencionado por @C) recebe push "@você foi mencionado em #geral"
- [ ] User A envia 3 msgs seguidas em #geral. User B vê só a mais recente substituindo (mesma tag). User C vê as 3 (tags únicas pra menção)
- [ ] User A envia em canal restrito. Usuários sem role permitido NÃO recebem
- [ ] Sininho da topbar: contador atualiza pra todos que receberam in-app
EOF
)"
```

---

## Self-review

**Spec coverage:**
- ✅ 3 enum values novos → Task A.1
- ✅ Coluna `reminded_30min_at` + index → Task A.2
- ✅ Seeds das regras → Task A.2
- ✅ Cron 18h BRT (`evening-digest`) → Task B.3 + B.5
- ✅ Cron a cada 5 min (`event-reminders`) → Task B.4 + B.5
- ✅ Detector amanhã (digest único por usuário) → Task B.1
- ✅ Detector 30 min (idempotente via coluna) → Task B.2
- ✅ Reset em edição de evento → Task B.6
- ✅ Texto inteligente Reunião/Gravação por sub_calendar → B.1 e B.2
- ✅ Custom dispatcher pra chat → Task C.1
- ✅ Hook no `sendChatMessageAction` → Task C.2
- ✅ Mencionados ganham destaque (título + tag) → C.1
- ✅ Não-mencionados compartilham tag por canal → C.1
- ✅ Labels pt-BR no painel → Task A.5
- ✅ Mandatory + email_default=false → Task A.2

**Placeholder scan:** Sem TBDs, TODOs, "implement later". Cada step tem código concreto ou comando exato.

**Type consistency:** `DispatchArgs` definido em C.1 bate com chamadas em C.2. `Counters` em B.3 e B.4 batem com signature dos detectors.

**Branch e PR strategy:** 3 PRs sequenciais (A → B → C), cada um deployável independentemente. PR A é puro DDL/UI (não dispara nada). PR B começa a disparar calendário. PR C plugua chat.
