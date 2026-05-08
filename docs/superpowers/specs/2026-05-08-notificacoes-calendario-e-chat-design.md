# Notificações obrigatórias — calendário e escritório virtual

**Status:** design aprovado, aguardando plano de implementação
**Data:** 2026-05-08

## Objetivo

Garantir que pessoas envolvidas em eventos do calendário (reuniões e gravações) e em conversas do escritório virtual recebam notificações no momento certo, **sem opção de desativar** (mandatory). Push nativo no iOS já está pronto (PRs #157/#158/#162); aqui plugamos os triggers.

## Decisões já fechadas com a usuária

1. **Reunião** = qualquer `calendar_event` com participantes. **Gravação** = `calendar_event` com `sub_calendar=videomakers` (caso especial visualmente, mesma estrutura).
2. **Uma única regra por trigger** com texto inteligente que muda baseado em `sub_calendar`. Coordenadores que querem ser notificados de gravação precisam ser adicionados como participantes do evento.
3. Três pontos de contato pra eventos:
   - **8h BRT (manhã)** — eventos do dia atual *(já existe: `evento_calendario_hoje`)*
   - **18h BRT (noite anterior)** — preview dos eventos de amanhã, **digest único** por usuário
   - **30 min antes** — lembrete real-time do evento individual (cron a cada 5 min, precisão 25-30 min)
4. **Chat do escritório:** notificação a cada mensagem nova pra todos os usuários com acesso ao canal (menos o autor). Mensagens onde o usuário é mencionado (`@nome`) recebem **destaque** visual.
5. Tudo `mandatory=true` (usuário não pode desativar).
6. `email_default=false` em todas as 3 novas regras — email pra cada msg/evento seria spam.

## Arquitetura

### Novos `notification_event` enum values

```sql
ALTER TYPE notification_event ADD VALUE 'evento_calendario_amanha';
ALTER TYPE notification_event ADD VALUE 'evento_calendario_30min';
ALTER TYPE notification_event ADD VALUE 'chat_mensagem';
```

### Novos crons (vercel.json)

```json
{ "path": "/api/cron/evening-digest",  "schedule": "0 21 * * *" },
{ "path": "/api/cron/event-reminders", "schedule": "*/5 * * * *" }
```

`0 21 * * *` UTC = 18:00 BRT (BRT é UTC-3, sem DST desde 2019).
Existente preservado: `daily-digest` em `0 11 * * *` (8:00 BRT) com fluxos atuais.

### Novos detectors

**`src/lib/cron/detectors/evento-calendario-amanha.ts`**

- Roda dentro do cron `evening-digest`
- Busca eventos com `inicio` no intervalo `[início_de_amanha_BRT, fim_de_amanha_BRT)`
- Agrupa por `participantes_ids` → 1 entrada por usuário
- Pra cada usuário, monta digest único:
  - **título:** `"Você tem N eventos amanhã"` (N=1 → `"Você tem 1 evento amanhã"`)
  - **mensagem:** lista até 5 eventos formatada como `"10h — Reunião X · 14h — Gravação Y · ..."`. Se >5: corta e adiciona `"...e mais N"`
  - **link:** `/calendario` (visão geral, não evento individual — por ser digest)
- Dispara via `dispatchNotification({ evento_tipo: 'evento_calendario_amanha', user_ids_extras: [userId] })` por destinatário (1 dispatch por usuário pra ter 1 push por pessoa, não 1 push por evento×pessoa)

**`src/lib/cron/detectors/evento-calendario-30min.ts`**

- Roda dentro do cron `event-reminders` (a cada 5 min)
- Busca `calendar_events` com `inicio` em `[agora+25min, agora+35min]` AND `reminded_30min_at IS NULL`
- Pra cada evento:
  - Texto: `"Em 30 min: ${prefixo} ${titulo}"` onde `prefixo = sub_calendar === 'videomakers' ? 'Gravação' : 'Reunião'`
  - Link: `/calendario/${eventoId}`
  - Dispara `dispatchNotification` com `user_ids_extras=participantes_ids`
- **Após dispatch bem-sucedido**, faz `UPDATE calendar_events SET reminded_30min_at = now() WHERE id = ?` — garante idempotência mesmo se cron rodar duplicado ou se janela cobrir o mesmo evento 2x

### Custom dispatcher pra chat

**`src/lib/notificacoes/dispatch-chat.ts` (novo)**

```ts
export async function dispatchChatNotification(message: ChatMessage): Promise<void>
```

Fluxo:
1. Busca o canal: `chat_channels` row pelo `channel_id` da mensagem (precisa: `kind`, `nome`)
2. Resolve destinatários: query `profiles WHERE ativo=true AND id != message.user_id`, filtra com `canAccessChannel(profile.role, channel.kind)` (helper que já existe em `src/lib/escritorio/types.ts`)
3. Menções já vêm pré-resolvidas: a UI do chat já popula `chat_messages.mentioned_user_ids` (coluna existente). O dispatcher só lê esse array — sem regex no servidor.
4. Pra cada destinatário:
   - **Mencionado:** `titulo="@você foi mencionado em #${canal.nome}"`, body=`"${autorNome}: ${trim(message.body, 100)}"`, tag=`chat-mention-${message.id}` (único, não substitui)
   - **Não mencionado:** `titulo=`#${canal.nome}`, body=mesma estrutura, tag=`chat-${channel.id}` (mesmo canal substitui)
5. Insert direto em `notifications` (não passa por `dispatchNotification` central porque cada destinatário tem texto próprio):
   - `tipo: 'chat_mensagem'`, `user_id`, `titulo`, `mensagem`, `link: /escritorio/${channel.kind}`, `lida: false`
6. Dispara `sendWebPushToUser(destinatario.id, { title, body, url, tag })` (best-effort, falha não bloqueia)
7. Ao final, `revalidateTag('notifications', 'default')` pra refletir contador no sininho

**Hook de invocação:** `sendChatMessageAction` em [`src/lib/escritorio/actions.ts`](../../../src/lib/escritorio/actions.ts) hoje dispara `dispatchNotification` com `evento_tipo: "task_assigned"` apenas pra mencionados (workaround antigo). Vamos:
1. Remover o dispatch antigo de `task_assigned`
2. Chamar `dispatchChatNotification(messageId)` que internamente cobre TANTO mencionados (com destaque) QUANTO usuários não-mencionados com acesso ao canal

A regra `chat_mensagem` em `notification_rules` existe pro painel admin/listagem, mas o dispatcher não consulta ela em runtime — bypass intencional pra customização per-recipient.

### Migration

**Migration A (transação isolada — `ALTER TYPE` precisa commit antes de uso):**

```sql
ALTER TYPE notification_event ADD VALUE 'evento_calendario_amanha';
ALTER TYPE notification_event ADD VALUE 'evento_calendario_30min';
ALTER TYPE notification_event ADD VALUE 'chat_mensagem';
```

**Migration B (após A commitada):**

```sql
ALTER TABLE calendar_events ADD COLUMN reminded_30min_at TIMESTAMPTZ;

CREATE INDEX idx_calendar_events_reminded_30min
  ON calendar_events (inicio)
  WHERE reminded_30min_at IS NULL;

INSERT INTO notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
VALUES
  ('evento_calendario_amanha', true, true, false, true, '{}', '{}'),
  ('evento_calendario_30min',  true, true, false, true, '{}', '{}'),
  ('chat_mensagem',            true, true, false, true, '{}', '{}');
```

### UI — painel `/configuracoes/notificacoes`

- Os 3 novos tipos aparecem automaticamente em "Regras do sistema" (admin) porque a página lista `notification_rules`. Adicionar labels em pt-BR no `eventLabels` map de `RuleCard.tsx` e `page.tsx`:
  - `evento_calendario_amanha: "Eventos de amanhã (resumo às 18h)"`
  - `evento_calendario_30min: "Lembrete 30 min antes do evento"`
  - `chat_mensagem: "Mensagens no escritório virtual"`
- Em "Suas preferências" os 3 não aparecem porque a página filtra `r.mandatory === false`.

## Edge cases e decisões de tratamento

| Cenário | Comportamento |
|---|---|
| Usuário cria evento DEPOIS das 18h pra amanhã | Não recebe digest às 18h (já passou). Recebe 30-min-antes normalmente. Aceitável. |
| Cron de 5 min atrasa por instabilidade do Vercel | `reminded_30min_at` impede duplicar. Janela larga de 10 min (25-35) absorve atrasos curtos. |
| Evento é editado e horário muda | `reminded_30min_at` permanece setado se já foi enviado. Não re-dispara. **Mitigação:** quando editar evento (server action de update), zerar `reminded_30min_at = NULL` se `inicio` mudou. |
| Evento é deletado | Sem ação — notificação não dispara, dispatch já passou ou ainda não rodou. Notificações in-app já criadas continuam visíveis (esperado, é histórico). |
| Menção com nome composto / homônimos | Resolvido pela UI do chat (já existe — picker que retorna user_id). Servidor confia em `mentioned_user_ids`. |
| Canal com 50+ usuários (ex: #geral) | Dispatch é serial mas push individual em Promise.all. Pra time de 30 pessoas: ~3 segundos no pior caso. Aceitável. |
| Usuário sem device inscrito (sem ativar push) | `sendWebPushToUser` no-op silencioso, mas notificação in-app + sininho funcionam normal. |
| Editar/deletar mensagem do chat | Sem propagação por enquanto. Notificação já enviada permanece. Aceitável (mensagens raramente são editadas). |

## Mudanças de código resumidas

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<TS>_add_notification_events.sql` | Migration A — enum |
| `supabase/migrations/<TS>_add_event_reminders_and_seed_rules.sql` | Migration B — coluna + index + seeds |
| `vercel.json` | Adicionar 2 crons |
| `src/app/api/cron/evening-digest/route.ts` | Novo handler |
| `src/app/api/cron/event-reminders/route.ts` | Novo handler |
| `src/lib/cron/detectors/evento-calendario-amanha.ts` | Novo detector |
| `src/lib/cron/detectors/evento-calendario-30min.ts` | Novo detector |
| `src/lib/notificacoes/dispatch-chat.ts` | Novo dispatcher custom |
| `src/lib/escritorio/actions.ts` (ou onde envia msg) | Plug `dispatchChatNotification` |
| `src/types/database.ts` | Regenerar via `supabase gen types` após migrations |
| `src/components/notificacoes/RuleCard.tsx` | Adicionar 3 labels novos no eventLabels |
| `src/app/(authed)/configuracoes/notificacoes/page.tsx` | Mesma adição de labels |
| `src/lib/calendario/actions.ts` (event update) | Zerar `reminded_30min_at` se `inicio` mudou |

## Custos esperados

- **Vercel:** ~8.700 invocations/mês adicionais. Plano Pro inclui 1M → $0.
- **Web Push:** Apple/Google/Mozilla não cobram → $0.
- **Resend (email):** `email_default=false` em todas → 0 emails extras → $0.
- **Supabase:** queries leves (~10/min no pior caso pelo cron de 5 min) → dentro do free tier.

**Total esperado: $0** incremental.

## Não-objetivos

- Não vamos suportar configuração per-organização (sistema multi-tenant fica pra depois).
- Não vamos adicionar opt-in de email pra usuários individuais — se a equipe quiser, abre PR separado.
- Não vamos propagar edições/deleções de mensagem de chat pras notificações já enviadas (raras na prática).
