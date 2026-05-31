# Freelayide: tipo "Edição", notificação de nova oportunidade e urgência de entrega

**Data:** 2026-05-30
**Branch base:** `origin/main` (módulo freelayide já mergeado — PRs #468–471)
**Worktree:** `.claude/worktrees/freela-edicao`

## Objetivo

Três incrementos no módulo `/freela-yide`:

1. Adicionar um terceiro tipo de oportunidade: **Edição** (hoje só existem Captação e Modelo).
2. Ao criar qualquer oportunidade, **notificar** automaticamente os cargos que podem pegá-la.
3. Para oportunidades de **Edição**, permitir marcar **entrega urgente + prazo**. Quando urgente, a notificação chega com **cor e som diferentes** dentro do app.

## Decisões de produto (alinhadas com a usuária)

- **Urgência só aparece no tipo Edição.** Captação e Modelo não têm campos de urgência.
- **Formato da urgência:** checkbox "Entrega urgente" **+** campo de prazo (data/hora). Ambos opcionais; o que dispara a notificação urgente é o checkbox marcado.
- **Destinatários da notificação de nova oportunidade:** cargos `assessor`, `videomaker`, `audiovisual_chefe` (coordenador audiovisual). Editores **não** entram por padrão (mas, como o sistema é baseado em regras configuráveis, podem ser incluídos depois pela tela de Configurações → Notificações, sem código).
- **Cor/som diferente:** diferenciação **dentro do app** (sino de notificações). No **push do celular**, urgente leva vibração + `requireInteraction` + ícone/cor de alerta, mas o **som do push é controlado pelo iOS/Android** e não é customizável via navegador.

## Arquitetura

O trabalho toca dois subsistemas, ambos já existentes:

- **Freelayide** (`src/lib/freela-yide/`, `src/components/freela-yide/`) — tipos, schema, action de criação, formulário e card.
- **Notificações** (`src/lib/notificacoes/`, `src/components/notificacoes/`, `public/sw.js`) — evento configurável, dispatch, render no sino e som.

### 1. Tipo "Edição"

- `src/lib/freela-yide/tipos.ts`: adicionar `"edicao"` em `TIPO_OP` e em `TIPO_OP_DEFS` com cor própria (paleta laranja/`orange`, distinta de violet/cyan já usadas).
- `src/lib/freela-yide/schema.ts`: `criarOportunidadeSchema.tipo` passa a aceitar `z.enum(["captacao", "modelo", "edicao"])`.
- `src/components/freela-yide/NovaOportunidadeButton.tsx`: nova `<option value="edicao">Edição</option>`.
- Migration: atualizar o `check` da coluna `tipo` para incluir `'edicao'`.

### 2. Urgência de entrega (campos)

Colunas novas em `freela_oportunidades`:

- `entrega_urgente boolean not null default false`
- `prazo_entrega timestamptz` (nullable)

- `schema.ts`: adicionar `entrega_urgente: z.coerce.boolean().default(false)` e `prazo_entrega` (string datetime opcional, convertida para ISO ou null). Validação: campos só são considerados quando `tipo === "edicao"` (no servidor, ignorar/zerar se o tipo não for edição, para não confiar só no front).
- `NovaOportunidadeButton.tsx`: quando `tipo === "edicao"`, renderizar checkbox "Entrega urgente" + input `datetime-local` "Prazo de entrega". Controlado por estado do select.
- `queries.ts` (`OportunidadeRow`, `fullSelect`, `mapRow`): incluir `entrega_urgente` e `prazo_entrega`. **Atenção:** seguir o padrão de fallback do SELECT do projeto — adicionar as colunas novas à whitelist do catch de fallback, senão a lista esvazia em produção entre o deploy e a migration.
- `src/components/freela-yide/OportunidadeCard.tsx`: badge "Urgente" (vermelho) quando `entrega_urgente`, e exibir `prazo_entrega` formatado quando houver.

### 3. Notificação ao criar oportunidade

- Novo valor no enum `notification_event`: `freela_nova_oportunidade` (migration).
- Seed de uma linha em `notification_rules`:
  - `evento_tipo = 'freela_nova_oportunidade'`
  - `ativo = true`, `mandatory = false`, `email_default = false`, `permite_destinatarios_extras = true`
  - `default_roles = '{assessor,videomaker,audiovisual_chefe}'`
- `src/lib/freela-yide/actions.ts` (`criarOportunidadeAction`): após o insert bem-sucedido, chamar `dispatchNotification` com:
  - `evento_tipo: "freela_nova_oportunidade"`
  - `titulo`/`mensagem` descrevendo a oportunidade (tipo + título + cliente)
  - `link: "/freela-yide"`
  - `prioridade: entrega_urgente ? "urgente" : "normal"` (novo parâmetro — ver item 4)
  - O dispatch não deve quebrar a criação se falhar (best-effort, try/catch e log).

### 4. Cor + som diferente quando urgente

**Coluna nova em `notifications`:** `prioridade text not null default 'normal' check (prioridade in ('normal','urgente'))`.

- `src/lib/notificacoes/dispatch.ts`: aceitar `prioridade?: "normal" | "urgente"` (default `"normal"`), gravar na coluna `prioridade` do insert in-app, e propagar para o payload do push (`urgent: prioridade === "urgente"`).
- `src/lib/notificacoes/schema.ts` / tipo `Notification`: incluir `prioridade`.
- `src/lib/notificacoes/queries.ts`: `listMyNotifications` passa a selecionar `prioridade`. **Bumpar a cache key** do `unstable_cache` no mesmo PR (mudança de shape).
- `src/lib/notificacoes/actions.ts` (`getMyNotificationsAction`): retornar `prioridade` nos itens.

**Dentro do app (`NotificationBell.tsx` + `NotificationItem.tsx`):**
- `Item` interface + props de `NotificationItem` ganham `prioridade`.
- `NotificationItem`: quando `prioridade === "urgente"`, render com destaque vermelho (borda/fundo `destructive`).
- `NotificationBell`: no handler do Realtime, distinguir `payload.eventType === "INSERT"`. Em INSERT, tocar som:
  - `prioridade === "urgente"` → som de alarme insistente (novo).
  - caso contrário → comportamento atual (sem som), para não introduzir som em toda notificação.
- Som: estender `src/lib/escritorio/notification-sound.ts` com `playUrgentSound()` — variação mais insistente (sequência de beeps / frequência mais grave) reusando o mesmo AudioContext e a lógica de unlock já existente. Não criar asset MP3.

**Push (`public/sw.js` + `src/lib/push/server.ts`):**
- `PushPayload` ganha `urgent?: boolean`.
- `sw.js`: quando `payload.urgent`, usar `requireInteraction: true`, `vibrate: [200,100,200,100,200]` e (se aplicável) ícone/badge de alerta. Sem custom sound (limitação do navegador).
- Bumpar a versão do `sw.js` (header de versão) para forçar atualização do service worker.

## Migrations (Supabase — aplicadas manualmente após merge)

Uma migration nova (ou duas, separando freela de notificações — decidir no plano):

1. `alter table freela_oportunidades`: trocar check de `tipo` para incluir `edicao`; `add column entrega_urgente`, `add column prazo_entrega`.
2. `alter type notification_event add value 'freela_nova_oportunidade'` + `insert into notification_rules (...)`.
3. `alter table notifications add column prioridade ...`.

**Observação:** `alter type ... add value` não roda dentro de transação com uso imediato do valor no mesmo bloco em algumas versões do Postgres — separar o `add value` do `insert` que o referencia, se necessário (validar no plano).

As migrations são **aplicadas manualmente no SQL Editor do Supabase após o merge do PR** (Vercel não roda migrations no deploy).

## Testes

- Unit (Vitest, padrão `tests/unit/`): validação do `criarOportunidadeSchema` com `tipo: "edicao"` + `entrega_urgente`/`prazo_entrega`; e que urgência é zerada quando `tipo !== "edicao"`.
- Type-check + lint (gate do projeto antes do PR).
- Sem teste local de UI (vai direto pro PR após type-check/lint passar, conforme preferência da usuária).

## Fora de escopo (YAGNI)

- Notificar editores (pode ser ligado depois via Configurações → Notificações).
- Custom sound no push do celular (limitação do navegador).
- Reordenar/priorizar oportunidades urgentes na grade (só badge + prazo por enquanto).
- Lembrete/escalonamento automático quando o prazo se aproxima.

## Riscos / pontos de atenção

- **Fallback do SELECT do calendário/freela:** colunas novas precisam entrar na whitelist do catch — senão a lista esvazia em prod entre deploy e migration.
- **Cache key:** bumpar no mesmo PR que muda o shape (notifications e, se houver, freela).
- **RLS em UPDATE é silencioso** — não aplicável aqui (é INSERT), mas validar que o insert de notificações via dispatch usa o client correto (service-role onde necessário).
- **Enum `notification_event`:** o `add value` precisa estar aplicado antes de qualquer código em produção referenciar o novo evento.
