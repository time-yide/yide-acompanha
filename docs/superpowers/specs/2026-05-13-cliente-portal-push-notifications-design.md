# Push notifications no portal do cliente

**Data:** 2026-05-13
**Status:** Aprovado, pronto pra plano de implementação

## Contexto

Hoje o sistema tem Web Push funcional, mas só pra colaboradores internos
(role em `profiles`). Cliente final loga no portal externo `/cliente`
via `client_portal_users` (linkado a `auth.users`, isolado de `profiles`).

A `subscribePushAction` chama `requireAuth()` (que rejeita portal user),
e a tabela `push_subscriptions` tem FK pra `profiles(id)` — bloqueia
cliente de salvar subscription. Resultado: push é inacessível pro portal.

Vamos liberar push pra cliente nos 3 eventos mais relevantes:

1. 📅 Nova reunião agendada com a equipe
2. 📝 Resumo de reunião pronto
3. 🟢 Autoavaliação semanal pedida

## Estado atual

- `push_subscriptions(user_id, endpoint, p256dh, auth, user_agent, created_at)` — FK `user_id → profiles(id)`.
- `subscribePushAction` / `unsubscribePushAction` / `sendTestPushAction` em `src/lib/push/actions.ts` — todos chamam `requireAuth()`.
- `sendWebPushToUser(user_id, payload)` em `src/lib/push/server.ts` — agnóstico de auth, funciona pra qualquer `auth.users.id`.
- `EnablePushButton` em `src/components/pwa/EnablePushButton.tsx` — usado em `/configuracoes`, hardcoded nas actions internas.
- Portal cliente em `src/app/(cliente)/cliente/page.tsx` — usa `requireClientPortalAuth()`.
- VAPID já configurado (`VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT`).

## Mudanças

### DB — migration

Relaxar FK de `push_subscriptions.user_id`: de `profiles(id)` pra
`auth.users(id)`. Backward-compatible (profiles já é FK de auth.users,
então todos os user_id atuais continuam válidos).

```sql
alter table public.push_subscriptions
  drop constraint push_subscriptions_user_id_fkey;
alter table public.push_subscriptions
  add constraint push_subscriptions_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
```

RLS atual (`user_id = auth.uid()`) já é genérico — sem mudança.

### Server actions

**Novo:** `src/lib/cliente-portal/push-actions.ts` — três actions com a
mesma lógica das internas, mas chamando `requireClientPortalAuth()`:
- `subscribeClientPortalPushAction(formData)` → upsert em
  `push_subscriptions` com `user_id = portalUser.id`.
- `unsubscribeClientPortalPushAction(formData)` → delete.
- `sendTestClientPortalPushAction()` → dispara push de teste pro
  próprio user. Mensagem: "Yide — Teste · Push está funcionando ✓".

### Helper de dispatch

**Novo:** `src/lib/cliente-portal/push.ts` — uma função pública:

```ts
sendPushToClient(clientId: string, payload: { title, body, url?, tag? })
```

Busca todos os `client_portal_users` ativos do cliente (`ativo=true`)
e chama `sendWebPushToUser(userId, payload)` pra cada um. Best-effort —
falha em um device não impede os outros.

Cliente pode ter até 5 portal users — todos recebem o push.

### UI no portal — botão de ativar

**Componente novo:** `src/components/cliente-portal/EnablePushButton.tsx`.
Cópia adaptada do `src/components/pwa/EnablePushButton.tsx`, com as
actions internas trocadas pelas do portal e textos amigáveis pro cliente.

(Não generalizamos o componente original via props porque ele tem 8+
state branches e várias chamadas hardcoded — duplicar 250 linhas é mais
seguro que tentar parametrizar tudo. Ambos compartilham a mesma lógica
de feature-detection, permissão e service-worker registration.)

**Onde renderizar:** `src/app/(cliente)/cliente/page.tsx` — novo
componente `NotificacoesSection` entre `HeroSection` e `PastaSection`.
Card discreto. Some silenciosamente se `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
não estiver setado (mesmo padrão do interno).

### Triggers

**1. Nova reunião agendada com cliente**

Quando uma `reuniao` é criada com `client_id != null`, dispara
`sendPushToClient(client_id, ...)`. Local exato: onde quer que seja o
ponto canônico de criação de reunião (server action, cron de
agendamento, ou trigger DB). Plano vai identificar e plugar.

Payload:
```
title: "Yide — Nova reunião agendada"
body:  "[DD/MM] às [HH:mm] — [título da reunião]"
url:   "/cliente"
```

**2. Resumo de reunião pronto**

Quando `reunioes.summary_ready` transiciona de `false` pra `true` e
`client_id != null`. Plano vai identificar o ponto (provavelmente
`syntheseizer` ou cron que processa transcrições).

Payload:
```
title: "Yide — Resumo da reunião disponível"
body:  "O resumo da reunião [título/data] tá pronto pra você ler"
url:   "/cliente"
```

**3. Autoavaliação semanal pedida**

Quando o cron/lógica que cria a satisfação semanal roda. Existe
`src/lib/cron/detectors/satisfacao-pendente.ts` — o detector já
identifica clientes elegíveis. Plugar push aí pros clientes que vão
receber o pedido.

Payload:
```
title: "Yide — Como tá a parceria essa semana?"
body:  "Manda sua nota rapidinho pra gente saber como melhorar 👋"
url:   "/cliente"
```

### Texto do botão "Ativar notificações"

Estado padrão: "Ativar notificações no celular"
Após ativar: "Notificações ativas neste dispositivo ✓ · Desativar"
Erro "permission denied": "Você negou as notificações. Habilita no menu do navegador → Permissões → Notificações."
iOS sem PWA instalado: "No iPhone, instale o app antes (Safari → Compartilhar → Adicionar à Tela de Início)."

### Permissões

- Push subscription: só o próprio portal user salva a sua (RLS atual).
- Dispatch: server-side via service-role, autorizado pelo trigger
  origin (action interna ou cron).
- Cliente não pode gatilhar push pra outro cliente — `sendPushToClient`
  é chamado só de código server, nunca via input do user.

### Privacidade / LGPD

Payload do push pode aparecer em tela de bloqueio do celular. Não
incluir dados sensíveis (números financeiros, conteúdo de reunião,
nomes de outros clientes). Os 3 payloads acima são neutros — só
"reunião agendada", "resumo pronto", "manda sua nota".

## Fora de escopo (v2+)

- Inbox de notificações dentro do portal (histórico).
- Preferências granulares (cliente escolhe quais eventos quer receber).
- Notificação por email/SMS como fallback.
- Deep links pra páginas específicas dentro do portal (hoje tudo abre `/cliente`).
- Push pra "cobrança próxima do vencimento", "arte pra aprovar",
  "relatório mensal pronto" — entram em fases futuras quando esses
  módulos existirem.

## Testes

**Manual (smoke pós-deploy):**
- Cliente instala PWA no iPhone/Android → "Ativar notificações" aparece → ativa → recebe teste.
- Equipe agenda reunião com cliente → push chega no celular dele.
- Forçar synthesizer a marcar resumo como pronto → push chega.
- Rodar cron de satisfação na 2ª-feira → push chega.

**Unit (mínimo viável):**
- `subscribeClientPortalPushAction` rejeita user não-portal e aceita portal user válido.
- `sendPushToClient` busca todos os portals ativos do cliente e chama `sendWebPushToUser` N vezes.
- Cada trigger só dispara quando a condição correta acontece (reunião com client_id != null, etc.).
