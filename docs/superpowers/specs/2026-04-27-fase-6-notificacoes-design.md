# Fase 6 — Notificações Completa (Yide Digital) — Design

**Data:** 2026-04-27
**Status:** Aprovado pela usuária, aguardando plano de implementação
**Spec mãe:** [2026-04-26-sistema-acompanhamento-design.md](2026-04-26-sistema-acompanhamento-design.md), seção 5.8
**Fases anteriores:** Fundação, Clientes, Kanban Onboarding, Calendário, Tarefas, Colaboradores (todas em produção)

---

## 1. Objetivo

Sistema de notificações completo com:
- **Vercel Cron** (1 daily) para eventos temporais (digest matinal das 8h BRT)
- **Resend (email)** como canal opcional (free tier — 3.000 emails/mês)
- **Tabela `notification_rules`** controlada por Sócio/ADM (defaults, mandatory, email padrão, destinatários)
- **Tabela `notification_preferences`** controlada pelo usuário (opt-in/opt-out por tipo)
- **16 tipos de eventos** notificáveis (8 trigger + 8 cron)
- **3 novos triggers** integrados nas features existentes (kanban, deal, prospecção)
- **Refactor da Fase 4** (substituir `notifyTaskAssigned/Completed` por `dispatchNotification` central)

**Princípios:**
- 3 camadas de customização: sistema (Sócio/ADM) → usuário (cada um) → evento (autor pode adicionar destinatários extras)
- Falha de email nunca interrompe in-app
- Idempotência: cron não reprocessa duplicado no mesmo dia
- Trade-off Hobby tier: cron diário (não horário) → "1h antes" vira digest matinal

**Fora do escopo:**
- Snapshot mensal de comissão → Fase 7 (precisa cron mensal — slot 2 reservado)
- Notificação de churn (precisa IA score) → Fase 8
- Histórico de bounces/complaints do Resend → futuro
- Push notifications mobile / web push → futuro
- Template diferente por tipo de evento → futuro (template único atende)
- Notificação "1h antes" granular → cortada por limitação do Hobby tier (vira digest matinal)
- Mês aguardando aprovação → Fase 7 (depende de snapshot)
- Cliente perto do churn → Fase 8

---

## 2. Modelo de dados

### Enum `notification_event` (NEW)

```sql
create type public.notification_event as enum (
  -- triggers (acontecem na hora da ação)
  'task_assigned',
  'task_completed',
  'kanban_moved',
  'prospeccao_agendada',
  'deal_fechado',
  'mes_aguardando_aprovacao',
  'mes_aprovado',
  'cliente_perto_churn',
  -- cron daily (8h BRT)
  'task_prazo_amanha',
  'task_overdue',
  'evento_calendario_hoje',
  'marco_zero_24h',
  'aniversario_socio_cliente',
  'aniversario_colaborador',
  'renovacao_contrato',
  'satisfacao_pendente'
);
```

### Tabela `notification_rules` (NEW — controle de Sócio/ADM)

```sql
create table public.notification_rules (
  evento_tipo public.notification_event primary key,
  ativo boolean not null default true,
  mandatory boolean not null default false,
  email_default boolean not null default false,
  permite_destinatarios_extras boolean not null default true,
  default_roles text[] not null default array[]::text[],
  default_user_ids uuid[] not null default array[]::uuid[],
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.notification_rules enable row level security;

create policy "anyone authenticated reads rules"
  on public.notification_rules for select to authenticated using (true);

create policy "manage:users role updates rules"
  on public.notification_rules for update to authenticated
  using (public.current_user_role() in ('adm', 'socio'))
  with check (public.current_user_role() in ('adm', 'socio'));
```

**Seed inicial (mesma migration):**

| evento_tipo | ativo | mandatory | email_default | extras | default_roles | default_user_ids |
|---|---|---|---|---|---|---|
| task_assigned | true | false | false | true | — | (atribuído passa via extras) |
| task_completed | true | false | false | true | — | (criador passa via extras) |
| kanban_moved | true | false | true | true | adm | — |
| prospeccao_agendada | true | false | false | true | adm | — |
| deal_fechado | true | false | true | false | adm,socio | — |
| mes_aguardando_aprovacao | true | true | true | false | socio | — |
| mes_aprovado | true | true | true | false | — | (computado por snapshot — Fase 7) |
| cliente_perto_churn | true | false | true | true | socio | — |
| task_prazo_amanha | true | false | false | true | — | (atribuído passa via extras) |
| task_overdue | true | false | true | true | — | (atribuído passa via extras) |
| evento_calendario_hoje | true | false | false | true | — | (participantes_ids passa via extras) |
| marco_zero_24h | true | false | true | true | — | (comercial+coord+assessor via extras) |
| aniversario_socio_cliente | true | false | false | true | coordenador,assessor | — |
| aniversario_colaborador | true | false | false | true | — | (todos ativos via roles[*]) |
| renovacao_contrato | true | false | true | true | — | (coord+assessor do cliente via extras) |
| satisfacao_pendente | true | false | false | false | coordenador,assessor | — |

### Tabela `notification_preferences` (NEW — controle do usuário)

```sql
create table public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  evento_tipo public.notification_event not null,
  in_app boolean not null default true,
  email boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, evento_tipo)
);

alter table public.notification_preferences enable row level security;

create policy "users read own preferences"
  on public.notification_preferences for select to authenticated
  using (user_id = auth.uid());

create policy "users insert own preferences"
  on public.notification_preferences for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own preferences"
  on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "users delete own preferences"
  on public.notification_preferences for delete to authenticated
  using (user_id = auth.uid());
```

### Tabela `cron_runs` (NEW — idempotência)

```sql
create table public.cron_runs (
  job_name text not null,
  run_date date not null,
  ran_at timestamptz not null default now(),
  details jsonb,
  primary key (job_name, run_date)
);

alter table public.cron_runs enable row level security;
-- sem policies: acesso só via service-role nas server actions/cron handler
```

### Tabela `notifications` (existente)

Sem mudança de schema. O campo `tipo text` aceita os novos valores do enum `notification_event` automaticamente (estamos guardando como string).

---

## 3. Resolução em runtime + dispatcher

### `dispatchNotification()` — função central

Arquivo: `src/lib/notificacoes/dispatch.ts` (NEW). Substitui o `notify()` privado da Fase 4.

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendEmail } from "@/lib/email/client";
import { renderNotificationEmail } from "@/lib/email/templates/notification";
import { getServerEnv } from "@/lib/env";
import type { Database } from "@/types/database";

type NotificationEvent = Database["public"]["Enums"]["notification_event"];

interface DispatchArgs {
  evento_tipo: NotificationEvent;
  titulo: string;
  mensagem: string;
  link?: string;
  user_ids_extras?: string[];
  source_user_id?: string;
}

export async function dispatchNotification(args: DispatchArgs): Promise<void> {
  const supabase = createServiceRoleClient();

  // 1. Carrega regra
  const { data: rule } = await supabase
    .from("notification_rules")
    .select("*")
    .eq("evento_tipo", args.evento_tipo)
    .single();
  if (!rule || !rule.ativo) return;

  // 2. Resolve destinatários
  let recipientIds = await resolveRecipients(supabase, rule);
  if (rule.permite_destinatarios_extras && args.user_ids_extras) {
    recipientIds = [...new Set([...recipientIds, ...args.user_ids_extras])];
  }
  if (args.source_user_id) {
    recipientIds = recipientIds.filter((id) => id !== args.source_user_id);
  }
  if (recipientIds.length === 0) return;

  // 3. Carrega preferences em batch
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id, in_app, email")
    .in("user_id", recipientIds)
    .eq("evento_tipo", args.evento_tipo);
  const prefMap = new Map((prefs ?? []).map((p) => [p.user_id, p]));

  // 4. Envia para cada um
  for (const userId of recipientIds) {
    const pref = prefMap.get(userId);
    const wantsInApp = rule.mandatory || (pref?.in_app ?? true);
    const wantsEmail = rule.mandatory
      ? rule.email_default
      : pref?.email ?? rule.email_default;

    if (wantsInApp) {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        tipo: args.evento_tipo,
        titulo: args.titulo,
        mensagem: args.mensagem,
        link: args.link ?? null,
      });
      if (error) console.error("[dispatch] in-app insert failed:", error.message);
    }

    if (wantsEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nome, email, ativo")
        .eq("id", userId)
        .single();
      if (!profile || !profile.ativo) continue;
      const env = getServerEnv();
      const fullLink = args.link ? `${env.NEXT_PUBLIC_APP_URL}${args.link}` : undefined;
      const { html, text } = renderNotificationEmail({
        recipientName: profile.nome,
        titulo: args.titulo,
        mensagem: args.mensagem,
        ctaUrl: fullLink,
        ctaLabel: "Acessar",
      });
      await sendEmail({ to: profile.email, subject: args.titulo, html, text });
    }
  }
}

async function resolveRecipients(
  supabase: ReturnType<typeof createServiceRoleClient>,
  rule: { default_roles: string[]; default_user_ids: string[] },
): Promise<string[]> {
  const set = new Set<string>(rule.default_user_ids);
  if (rule.default_roles.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .in("role", rule.default_roles as Database["public"]["Enums"]["user_role"][])
      .eq("ativo", true);
    (data ?? []).forEach((p) => set.add(p.id));
  }
  return [...set];
}
```

---

## 4. Cron job + Vercel Cron

### Configuração `vercel.json` (NEW na raiz do worktree)

```json
{
  "crons": [
    { "path": "/api/cron/daily-digest", "schedule": "0 11 * * *" }
  ]
}
```

`0 11 * * *` = **11:00 UTC = 08:00 BRT** todo dia. Hobby tier permite só daily. **Slot 2 reservado pra Fase 7** (snapshot mensal de comissão).

### Endpoint `src/app/api/cron/daily-digest/route.ts` (NEW)

```ts
import { NextResponse } from "next/server";
import { runDailyDigest } from "@/lib/cron/daily-digest";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runDailyDigest();
  return NextResponse.json(result);
}
```

`CRON_SECRET` precisa ser configurado em **Vercel → Settings → Environment Variables** antes do primeiro deploy. Vercel Cron envia esse header automaticamente.

### Orquestrador `src/lib/cron/daily-digest.ts` (NEW)

```ts
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { detectOverdueTasks } from "./detectors/task-overdue";
import { detectTasksDuesoon } from "./detectors/task-prazo-amanha";
import { detectEventsToday } from "./detectors/evento-calendario-hoje";
import { detectMarcosZero24h } from "./detectors/marco-zero-24h";
import { detectClientBirthdays } from "./detectors/aniversario-socio-cliente";
import { detectColaboradorBirthdays } from "./detectors/aniversario-colaborador";
import { detectRenovacoes } from "./detectors/renovacao-contrato";
import { detectSatisfacaoPendente } from "./detectors/satisfacao-pendente";

interface Counters {
  task_overdue: number;
  task_prazo_amanha: number;
  evento_calendario_hoje: number;
  marco_zero_24h: number;
  aniversario_socio_cliente: number;
  aniversario_colaborador: number;
  renovacao_contrato: number;
  satisfacao_pendente: number;
}

export async function runDailyDigest(): Promise<{ counters: Counters; ran_at: string } | { skipped: true; reason: string }> {
  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  // Idempotência: já rodou hoje?
  const { data: existing } = await supabase
    .from("cron_runs")
    .select("ran_at")
    .eq("job_name", "daily-digest")
    .eq("run_date", today)
    .maybeSingle();
  if (existing) return { skipped: true, reason: "already ran today" };

  await supabase.from("cron_runs").insert({ job_name: "daily-digest", run_date: today });

  const counters: Counters = {
    task_overdue: 0,
    task_prazo_amanha: 0,
    evento_calendario_hoje: 0,
    marco_zero_24h: 0,
    aniversario_socio_cliente: 0,
    aniversario_colaborador: 0,
    renovacao_contrato: 0,
    satisfacao_pendente: 0,
  };

  await safeDetect(() => detectOverdueTasks(counters));
  await safeDetect(() => detectTasksDuesoon(counters));
  await safeDetect(() => detectEventsToday(counters));
  await safeDetect(() => detectMarcosZero24h(counters));
  await safeDetect(() => detectClientBirthdays(counters));
  await safeDetect(() => detectColaboradorBirthdays(counters));
  await safeDetect(() => detectRenovacoes(counters));

  // Segunda-feira (UTC day 1) — preparação para Fase 8
  if (new Date().getUTCDay() === 1) {
    await safeDetect(() => detectSatisfacaoPendente(counters));
  }

  // Persiste counters em cron_runs.details
  await supabase
    .from("cron_runs")
    .update({ details: counters })
    .eq("job_name", "daily-digest")
    .eq("run_date", today);

  return { counters, ran_at: new Date().toISOString() };
}

async function safeDetect(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error("[daily-digest] detector failed:", err);
  }
}
```

### Detectors (1 por evento) em `src/lib/cron/detectors/`

Cada detector é uma função pura(ish) que lê DB, identifica matches, chama `dispatchNotification`. Padrão idêntico:

```ts
// task-prazo-amanha.ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
import { localIsoDate } from "@/lib/utils/date";

export async function detectTasksDuesoon(counters: { task_prazo_amanha: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const tomorrow = localIsoDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const { data } = await supabase
    .from("tasks")
    .select("id, titulo, atribuido_a, status")
    .eq("due_date", tomorrow)
    .neq("status", "concluida");

  for (const t of data ?? []) {
    await dispatchNotification({
      evento_tipo: "task_prazo_amanha",
      titulo: "Tarefa vence amanhã",
      mensagem: `"${t.titulo}" tem prazo amanhã`,
      link: `/tarefas/${t.id}`,
      user_ids_extras: [t.atribuido_a],
    });
    counters.task_prazo_amanha++;
  }
}
```

Os 8 detectors seguem mesmo padrão; queries específicas:
- `task_overdue`: `due_date < today AND status != 'concluida'` (e adicionalmente atualiza algum flag interno? não — só notifica)
- `evento_calendario_hoje`: `calendar_events` onde `inicio` está em `[today, tomorrow)`, notifica `participantes_ids`
- `marco_zero_24h`: `leads` onde `data_reuniao_marco_zero` é amanhã
- `aniversario_socio_cliente`: `client_important_dates` (tipo aniversario_socio) com janelas 30/7/1 dia
- `aniversario_colaborador`: `profiles.data_nascimento` com janela 3 dias
- `renovacao_contrato`: `client_important_dates` (tipo renovacao) com janelas 45/15/5 dias
- `satisfacao_pendente`: cria entries pendentes (Fase 8 vai consumir)

---

## 5. Email via Resend

### Setup
- `npm install resend` (1 dependência nova)
- `RESEND_API_KEY` e `RESEND_FROM` já estão em `.env.example`
- Domínio precisa estar verificado no Resend (Sócio/ADM faz uma vez)

### Wrapper `src/lib/email/client.ts` (NEW)

```ts
import "server-only";
import { Resend } from "resend";
import { getServerEnv } from "@/lib/env";

let _client: Resend | null = null;

function getClient(): Resend {
  if (!_client) {
    const env = getServerEnv();
    _client = new Resend(env.RESEND_API_KEY);
  }
  return _client;
}

export interface EmailArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(args: EmailArgs): Promise<void> {
  try {
    const env = getServerEnv();
    await getClient().emails.send({
      from: env.RESEND_FROM,
      to: [args.to],
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
  } catch (err) {
    console.error("[email] send failed:", err);
  }
}
```

### Template `src/lib/email/templates/notification.ts` (NEW)

Template único para todas as notificações, HTML inline minimalista, gradiente da marca, escape de HTML em todo conteúdo dinâmico, link de "ajustar preferências" no rodapé. Conteúdo já apresentado na Seção 4 do brainstorming — não repito aqui.

### Custos

- Resend free tier: 3.000 emails/mês, 100/dia
- Estimativa Yide: ~45 emails/dia → ~1.350/mês → bem dentro do free

### Edge cases
- Falha do Resend (API down) → log no servidor, in-app não falha
- Email do usuário inválido → Resend rejeita, log
- Domínio não verificado → erro claro nos logs
- Usuário desativado → `resolveRecipients` filtra antes; não recebe

---

## 6. UI de configuração

### `/configuracoes/notificacoes` (NEW page)

Server component que carrega:
- Todas as 16 linhas de `notification_rules`
- (Se user é Sócio/ADM) usa `RuleCard` (admin view)
- (Caso contrário) usa `PreferenceToggle` (user view, lista só os tipos não-mandatory)

### Componentes (`src/components/notificacoes/`)

**`RuleCard.tsx`** — admin view, server component que renderiza uma `<form>` com server action `updateRuleAction`:
- Toggle: ativo, mandatory, email_default, permite_destinatarios_extras
- `<RecipientsSelector>`: search-multi-select de papéis e usuários
- Campo "Justificativa" opcional (audit log)

**`PreferenceToggle.tsx`** — user view, client component:
- 2 switches por tipo: in-app, email
- Carrega/persiste via server action `setPreferenceAction(formData)`

**`RecipientsSelector.tsx`** — popover client component:
- Search local sobre lista de papéis (9) + colaboradores ativos
- Multi-select com chips
- Submit popula 2 hidden inputs no form pai (default_roles, default_user_ids)

### Server actions (`src/lib/notificacoes/rule-actions.ts` NEW)

- `updateRuleAction(formData)` — Sócio/ADM only; valida zod; update + audit log
- `setPreferenceAction(formData)` — qualquer user; upsert na tabela `notification_preferences` filtrando `user_id = auth.uid()`
- `getMyPreferencesAction()` — retorna mapa de prefs do user logado pra hidratar UI

---

## 7. Triggers integrados em features existentes

### Refactor da Fase 4

`src/lib/tarefas/actions.ts` — substituir `notifyTaskAssigned/Completed` (do `trigger.ts` da Fase 4) por `dispatchNotification`:

```ts
// antes
await notifyTaskAssigned({ taskId, assigneeId, creatorId, taskTitle, creatorName });

// depois
await dispatchNotification({
  evento_tipo: "task_assigned",
  titulo: "Nova tarefa atribuída a você",
  mensagem: `${creatorName} atribuiu: "${taskTitle}"`,
  link: `/tarefas/${taskId}`,
  user_ids_extras: [assigneeId],
  source_user_id: creatorId,
});
```

`src/lib/notificacoes/trigger.ts` (Fase 4) → remover (substituído por dispatch). Tests da Fase 4 que testam `shouldNotify` movem-se para o equivalente em `dispatch.ts` (suprimir auto-notificação) ou deletam se redundantes.

### Triggers novos em `src/lib/leads/actions.ts`

Onde a action `moveLeadStageAction` (já existe) muda o stage:

```ts
// Sempre que muda stage:
await dispatchNotification({
  evento_tipo: "kanban_moved",
  titulo: `Card movido para "${prettyStage(newStage)}"`,
  mensagem: `${actor.nome} moveu "${lead.nome_prospect}"`,
  link: `/onboarding/${lead.id}`,
  source_user_id: actor.id,
  user_ids_extras: nextResponsibleId ? [nextResponsibleId] : undefined,
});

// Quando muda PARA prospeccao + tem data_prospeccao_agendada:
await dispatchNotification({
  evento_tipo: "prospeccao_agendada",
  titulo: "Prospecção agendada",
  mensagem: `${lead.nome_prospect} — ${formatDate(lead.data_prospeccao_agendada)}`,
  link: `/onboarding/${lead.id}`,
  source_user_id: actor.id,
  user_ids_extras: extras_do_form,
});

// Quando muda PARA ativo (deal_fechado):
await dispatchNotification({
  evento_tipo: "deal_fechado",
  titulo: `Deal fechado: ${lead.nome_prospect}`,
  mensagem: `${actor.nome} marcou como cliente ativo`,
  link: `/clientes/${lead.client_id}`,
  source_user_id: actor.id,
});
```

`prettyStage` é helper existente no projeto (verificar e usar).

### Triggers fora do escopo (Fase 7+)

- `mes_aguardando_aprovacao`, `mes_aprovado` → Fase 7 (depende de snapshot)
- `cliente_perto_churn` → Fase 8 (depende de IA score)

---

## 8. Edge cases consolidados

| Caso | Comportamento |
|---|---|
| Cron roda 2x no mesmo dia | `cron_runs` PK bloqueia segunda execução (retorna `skipped`) |
| Detector individual falha | `safeDetect` captura, log, outros detectores continuam |
| Resend falha em alguns destinatários | Log; outros recebem; in-app sempre tentado primeiro |
| Usuário desativado entre dispatch e envio | `resolveRecipients` filtra `ativo=true`; `dispatchNotification` re-checa `profile.ativo` antes de email |
| Tipo novo de evento sem regra seedada | Migration de seed cobre todos; se faltar, `dispatchNotification` retorna early com log |
| Sócio desativa um tipo (`ativo=false`) | `dispatchNotification` retorna early, ninguém recebe |
| Usuário sem preference registrada | Usa defaults da rule (in_app=true se não-mandatory, email=email_default) |
| Mandatory + usuário com preference desligada | Mandatory vence — usuário recebe in-app sempre, email se `email_default` |
| Auto-notificação (source_user_id == recipient) | Filtrado em `dispatchNotification` |
| Domínio Resend não verificado | Erro claro nos logs do Vercel |
| `CRON_SECRET` não configurado | Endpoint retorna 401 — cron Vercel manda alerta |

---

## 9. Testes

### Unit (`tests/unit/`)

- `notificacoes-dispatch.test.ts` — 8 cases:
  - Rule inativa → não dispatch
  - Mandatory ignora preference
  - Extras só funcionam se `permite_destinatarios_extras=true`
  - `source_user_id` excluído da lista
  - Roles defaults expandidos para user_ids
  - Combinação de roles + user_ids + extras (deduplicado)
  - Email só vai se `wantsEmail = true`
  - Usuário desativado nunca recebe email

- `cron-detectors.test.ts` — 8 cases (1 por detector):
  - `detectTasksDuesoon` encontra task com prazo=amanhã
  - `detectOverdueTasks` ignora tasks concluídas
  - `detectClientBirthdays` aplica janela 30/7/1 dia
  - `detectColaboradorBirthdays` aplica janela 3 dias
  - `detectRenovacoes` aplica janelas 45/15/5
  - `detectMarcosZero24h` encontra leads com reunião amanhã
  - `detectEventsToday` encontra eventos do calendário hoje
  - `detectSatisfacaoPendente` cria pendências (stub que vira Fase 8)

- `email-template.test.ts` — 4 cases:
  - HTML escape (titulo com `<script>` é escapado)
  - CTA aparece quando `ctaUrl` presente
  - CTA NÃO aparece quando `ctaUrl` ausente
  - Plain-text inclui link absoluto

- `daily-digest.test.ts` — 3 cases:
  - Idempotência: segunda execução no mesmo dia é skipped
  - Falha de detector individual não para outros (safeDetect)
  - Counters são acumulados e persistidos em `cron_runs.details`

### E2E (`tests/e2e/notificacoes-config.spec.ts` NEW)

- `/configuracoes/notificacoes` redireciona pra login quando não auth
- `GET /api/cron/daily-digest` sem header → 401
- `GET /api/cron/daily-digest` com header errado → 401

---

## 10. Cobertura do spec mãe — seção 5.8

| Spec | Coberto por |
|---|---|
| Canais: in-app + email | Sininho (Fase 4) + Resend (Seção 5) |
| Destinatários customizáveis | `notification_rules` + `permite_destinatarios_extras` + `<RecipientsSelector>` |
| Sócio/ADM editam regras default | `/configuracoes/notificacoes` admin view + `updateRuleAction` |
| Lista de 16 tipos | Enum `notification_event` + seed |
| 24h antes prazo de tarefa | `detectTasksDuesoon` |
| Tarefa overdue | `detectOverdueTasks` |
| Reunião comercial 1h antes | ⚠ Vira **digest matinal "evento_calendario_hoje"** (limite Hobby) |
| Marco zero 24h | `detectMarcosZero24h` |
| Marco zero 1h antes | ⚠ Vira **digest matinal** |
| Aniversário sócio cliente 30/7/1d | `detectClientBirthdays` |
| Aniversário colaborador 3d | `detectColaboradorBirthdays` |
| Renovação 45/15/5d | `detectRenovacoes` |
| Mês aguardando aprovação | **Fase 7** (depende de snapshot) |
| Cliente perto do churn | **Fase 8** (depende de IA) |
| Tarefa atribuída a mim | Fase 4 → refatorada via `dispatchNotification` nesta fase |
| Tarefa próxima do prazo | `detectTasksDuesoon` |

---

## 11. Estimativa

- **~14 commits**
- **3 migrations** (rules + preferences + cron_runs; ou 1 só com tudo)
- **1 dependência nova** (`resend`)
- **1 cron job** (`vercel.json` + endpoint API)
- **8 detectors**
- **3 triggers novos** integrados (kanban, prospecção, deal)
- **1 refactor** (substituir Fase 4 trigger.ts por dispatch)
- **1 página nova** (`/configuracoes/notificacoes`)
- **3 componentes novos** (RuleCard, PreferenceToggle, RecipientsSelector)
- **4 arquivos de teste novos** (dispatch, detectors, template, daily-digest) + 1 e2e

---

## 12. Aprovação

Brainstorming concluído com a usuária em 2026-04-27. Decisões registradas:
- Fase 6 = Notificações completa (5.8) com escopo cheio (cron + email + rules + preferences + triggers restantes)
- 16 tipos (originais 17 da spec, menos 2 "1h antes" que viram digest matinal por limite Hobby tier)
- Customização total: Sócio define mandatory + email_default + destinatários default; cada usuário opt-in/opt-out dos não-mandatory; autor pode adicionar destinatários extras se a regra permitir
- Cron daily 8h BRT — slot 2 reservado pra Fase 7 (snapshot mensal)
- Email via Resend, free tier suficiente
- Template único de email pra todos os tipos

Próximo passo: skill `writing-plans` gera o plano detalhado de execução em `docs/superpowers/plans/2026-04-27-fase-6-notificacoes.md`.
