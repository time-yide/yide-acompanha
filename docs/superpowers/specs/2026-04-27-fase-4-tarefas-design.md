# Fase 4 — Tarefas (Yide Digital) — Design

**Data:** 2026-04-27
**Status:** Aprovado pela usuária, aguardando plano de implementação
**Spec mãe:** [2026-04-26-sistema-acompanhamento-design.md](2026-04-26-sistema-acompanhamento-design.md), seção 5.5
**Fases anteriores:** Fundação, Clientes, Kanban Onboarding, Calendário Interno (todas em produção)

---

## 1. Objetivo

Sistema de tarefas tipo Trello/Asana simplificado, com atribuição livre entre os 15 colaboradores, vínculo opcional a cliente, e notificações in-app mínimas (sininho na sidebar). Substitui o controle informal por mensagens.

**Princípios:**
- Atribuição livre — qualquer um atribui a qualquer um (audit log garante transparência)
- Visibilidade total — todos veem todas as tarefas (cultura de transparência da agência, igual `clients`)
- Edição/exclusão restrita por papel
- Notificações enxutas: só "tarefa atribuída a mim" e "minha tarefa foi concluída". Email, cron e demais eventos ficam pra Fase 5

**Fora do escopo:**
- Subtarefas / checklist
- Comentários
- Anexos
- Tags/labels customizáveis
- Recorrência
- Notificação 24h antes do prazo e overdue (precisa Vercel Cron — Fase 5)
- Email via Resend (Fase 5)
- Destinatários customizáveis (`notification_rules` — Fase 5)
- Notificações de outras features além de tarefa (Fase 5)
- Drag & drop

---

## 2. Modelo de dados

### Tabela `tasks` (nova)

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `organization_id` | uuid | FK → `organizations`, not null |
| `titulo` | text | not null, ≥ 2 chars |
| `descricao` | text | nullable |
| `prioridade` | enum `task_priority` | `'alta'\|'media'\|'baixa'`, default `'media'` |
| `status` | enum `task_status` | `'aberta'\|'em_andamento'\|'concluida'`, default `'aberta'` |
| `criado_por` | uuid | FK → `profiles`, not null |
| `atribuido_a` | uuid | FK → `profiles`, not null |
| `client_id` | uuid | FK → `clients` `on delete set null`, nullable |
| `prazo` | timestamptz | nullable |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()` (trigger `set_updated_at`) |
| `completed_at` | timestamptz | nullable (preenchido quando vai pra `'concluida'`) |

**Indexes:**
- `idx_tasks_atribuido_status` em `(atribuido_a, status)` — query "minhas abertas"
- `idx_tasks_client` em `(client_id)` — pasta do cliente
- `idx_tasks_prazo` em `(prazo)` — sort vencidas/próximas

**RLS:**
- `SELECT`: todos autenticados leem todas as tarefas (transparência da agência)
- `INSERT`: qualquer autenticado, com `criado_por = auth.uid()`
- `UPDATE`: criador OR atribuído OR `current_user_role()` ∈ ('adm', 'socio')
- `DELETE`: criador OR `current_user_role()` ∈ ('adm', 'socio')

### Tabela `notifications` (nova — genérica, reusável em fases futuras)

| Campo | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles`, not null (destinatário) |
| `tipo` | text | `'task_assigned'\|'task_completed'` (futuras serão adicionadas sem migration de schema) |
| `titulo` | text | not null |
| `mensagem` | text | not null |
| `link` | text | nullable (ex: `/tarefas/<id>`) |
| `lida` | bool | default `false` |
| `created_at` | timestamptz | default `now()` |

**Indexes:**
- `idx_notifications_user_unread` em `(user_id, lida, created_at desc)` — feed

**RLS:**
- `SELECT`: `user_id = auth.uid()` (cada um vê só as próprias)
- `UPDATE`: `user_id = auth.uid()` (marcar como lida)
- `INSERT`: server-side via service role nas server actions
- `DELETE`: nenhuma policy (sem rota de exclusão)

---

## 3. Estrutura de arquivos

```
supabase/migrations/
└── 20260427000008_tasks_and_notifications.sql

src/
├── app/(authed)/
│   ├── tarefas/
│   │   ├── page.tsx                    # listagem com abas + filtros
│   │   ├── novo/page.tsx               # criar tarefa
│   │   └── [id]/page.tsx               # detalhe + editar
│   ├── notificacoes/
│   │   └── page.tsx                    # lista completa de notificações
│   └── clientes/[id]/tarefas/
│       └── page.tsx                    # tarefas dentro da pasta do cliente
│
├── components/tarefas/
│   ├── TaskList.tsx                    # tabela compacta com status, prioridade, prazo, atribuído
│   ├── TaskRow.tsx                     # linha individual + toggle "concluir" inline
│   ├── TaskForm.tsx                    # form criar/editar
│   ├── TaskFilters.tsx                 # client component (status, prioridade, prazo, cliente, atribuído)
│   ├── TaskTabs.tsx                    # "Atribuídas a mim" | "Criadas por mim" | "Todas"
│   └── PriorityBadge.tsx               # badge visual da prioridade
│
├── components/notificacoes/
│   ├── NotificationBell.tsx            # sininho + dropdown (client component)
│   └── NotificationItem.tsx            # 1 linha do feed
│
├── lib/tarefas/
│   ├── schema.ts                       # zod (createTaskSchema, editTaskSchema)
│   ├── queries.ts                      # listTasksFor, getTaskById, listTasksForClient
│   └── actions.ts                      # createTask, updateTask, completeTask, reopenTask, deleteTask
│
└── lib/notificacoes/
    ├── queries.ts                      # listNotifications, countUnread
    ├── actions.ts                      # markAsRead, markAllAsRead
    └── trigger.ts                      # notifyTaskAssigned, notifyTaskCompleted (server-only helpers)

tests/
├── unit/
│   ├── tarefas-schema.test.ts          # validação zod
│   ├── tarefas-queries.test.ts         # filtros e ordenação
│   └── notificacoes-trigger.test.ts    # idempotência (assignee == creator)
└── e2e/
    └── tarefas.spec.ts                 # auth-redirect das 4 rotas
```

**Atualizações em arquivos existentes:**
- Sidebar do layout `(authed)`: item "Tarefas" passa a apontar pra `/tarefas`
- Header do layout `(authed)`: monta `<NotificationBell />`
- Pasta do cliente (`/clientes/[id]/layout.tsx` ou nav lateral): adiciona "Tarefas" no menu lateral

---

## 4. Telas e fluxo

### `/tarefas`

**Header:** H1 "Tarefas" + contagem ("23 atribuídas a você, 5 vencidas") + botão "+ Nova tarefa"

**Abas:**
- **Atribuídas a mim** (default) — `atribuido_a = me`, exclui `concluida` por default
- **Criadas por mim** — `criado_por = me`
- **Todas** — sem filtro (transparência)

**Filtros (client component):**
- Status (multi-select): aberta, em_andamento, concluída (default exclui concluída)
- Prioridade (multi-select): alta, média, baixa
- Prazo (radio): hoje / esta semana / vencidas / sem prazo / qualquer
- Cliente: combobox searchable
- Atribuído: combobox searchable (visível só na aba "Todas")

**Tabela `TaskList`:**
| ☐ | Prioridade | Título | Cliente | Prazo | Atribuído |
|---|---|---|---|---|---|

- Checkbox conclui inline (server action `completeTask`)
- Prioridade: badge cor (alta vermelho, média âmbar, baixa cinza)
- Prazo: data relativa + alerta visual se vencida (cor destrutiva)
- Atribuído: avatar + nome
- **Sort default:** prazo asc (`nulls last`), depois prioridade desc

### `/tarefas/novo`

Form `TaskForm` com:
- Título* (≥ 2)
- Descrição (≤ 4000)
- Prioridade* (default média)
- Atribuído_a* (combobox searchable de `profiles.ativo=true`)
- Cliente (combobox searchable, opcional)
- Prazo (datetime opcional)

Submit: cria → redireciona pra `/tarefas`. Se vier de `?client=<id>`, pré-popula cliente.

### `/tarefas/[id]`

- Vista detalhada
- Botões respeitam permissões:
  - "Marcar como concluída" / "Reabrir": atribuído OR criador OR ADM/Sócio
  - "Editar": criador OR atribuído OR ADM/Sócio
  - "Excluir": criador OR ADM/Sócio
- Edição abre o mesmo `TaskForm` com defaults

### `/clientes/[id]/tarefas`

- Mesma `TaskList` filtrada por `client_id`
- Botão "+ Nova tarefa" → `/tarefas/novo?client=<id>`
- Aba/item "Tarefas" no menu lateral da pasta do cliente

### `/notificacoes`

- Lista cronológica reversa
- Botão "Marcar todas como lidas"
- Cada item: título + mensagem + tempo relativo + link (clicar marca como lida + navega)

### `<NotificationBell />` (header)

- Ícone `Bell` (lucide) + badge vermelho com contador de não lidas
- Click abre dropdown com últimas 10 notificações
- Link "Ver todas" → `/notificacoes`
- Click em notificação: marca como lida + navega
- Refresh: re-fetch ao focar a janela e a cada 60s (polling client-side simples — sem realtime nessa fase)

---

## 5. Server actions e regras de negócio

### `src/lib/tarefas/actions.ts`

| Action | Permissão | Comportamento |
|---|---|---|
| `createTask(formData)` | Qualquer autenticado | Valida zod + `assignee.ativo=true` → insert → audit log → `notifyTaskAssigned` se `assignee ≠ creator` → revalida `/tarefas` e `/clientes/<id>/tarefas` se houver `client_id` |
| `updateTask(formData)` | Criador OR atribuído OR ADM/Sócio (RLS + check explícito) | Valida → diff antes/depois → audit log → se mudou `atribuido_a`, dispara `notifyTaskAssigned` → revalida |
| `completeTask(id)` | Atribuído OR criador OR ADM/Sócio | `status='concluida'`, `completed_at=now()` → audit log → `notifyTaskCompleted` se concluinte ≠ criador → revalida |
| `reopenTask(id)` | Atribuído OR criador OR ADM/Sócio | `status='aberta'`, `completed_at=null` → audit log → revalida (sem notificação) |
| `deleteTask(id)` | Criador OR ADM/Sócio | Hard delete → audit log com `dados_antes` → revalida |

### `src/lib/tarefas/schema.ts` (zod)

- `titulo`: string, min 2, max 200
- `descricao`: string, max 4000, nullable
- `prioridade`: enum `'alta'|'media'|'baixa'`
- `atribuido_a`: uuid, validado server-side contra `profiles.ativo=true`
- `client_id`: uuid, nullable
- `prazo`: ISO datetime, nullable. Se preenchido na criação, deve ser ≥ agora (regra de UX; em update, sem essa restrição)

### `src/lib/notificacoes/trigger.ts` (server-only helpers, não exportadas como server actions)

```ts
notifyTaskAssigned(taskId: string, assigneeId: string, creatorId: string, taskTitle: string): Promise<void>
notifyTaskCompleted(taskId: string, completerId: string, creatorId: string, taskTitle: string): Promise<void>
```

- **Idempotência:** se `assigneeId === creatorId` (em assigned) ou `completerId === creatorId` (em completed), não cria notificação.
- Insert em `notifications` com `tipo`, `titulo`, `mensagem`, `link='/tarefas/<taskId>'`.

### `src/lib/notificacoes/actions.ts`

| Action | Quem | Comportamento |
|---|---|---|
| `markNotificationRead(id)` | Dono (RLS valida) | `lida=true` |
| `markAllNotificationsRead()` | Logado | Update em massa filtrando `user_id=me, lida=false` |

### Audit log

Toda operação de tarefa registra em `audit_log` (tabela existente):
- `entidade='tasks'`, `entidade_id=task.id`
- `acao ∈ {'create','update','complete','reopen','delete'}`
- `dados_antes`/`dados_depois` em update/delete
- `ator_id=auth.uid()`

---

## 6. Edge cases

| Caso | Comportamento |
|---|---|
| Atribuir a colaborador desativado (`profiles.ativo=false`) | Bloqueia no zod (validação contra `profiles.ativo=true`) |
| Cliente da tarefa for excluído | FK `on delete set null` — tarefa sobrevive sem vínculo |
| Atribuído é o próprio criador | Não notifica |
| Reabrir tarefa concluída | Permite — limpa `completed_at`, sem notificação |
| Tarefa sem prazo | Aparece no final da lista (sort `nulls last`); categoria "sem prazo" do filtro |
| Concluir tarefa já concluída (double-click) | Silencioso, sem erro |
| Excluir tarefa que tem notificações vinculadas | Notificações ficam órfãs (link ainda aponta pra `/tarefas/<id>`, página retorna 404). Aceitável — caso raro |

---

## 7. Testes

### Unit (`tests/unit/`)

- `tarefas-schema.test.ts` — validação zod (título mínimo, prazo no passado em criação, descrição máxima)
- `tarefas-queries.test.ts` — filtros (status, prioridade, prazo) + ordenação default (prazo asc nulls last, depois prioridade desc)
- `notificacoes-trigger.test.ts` — `notifyTaskAssigned` não cria notificação quando assignee == creator (idempotência)

### E2E (`tests/e2e/tarefas.spec.ts`)

Auth-redirect das 4 rotas (`/tarefas`, `/tarefas/novo`, `/tarefas/[id]`, `/notificacoes`) — segue o padrão das fases anteriores (sem login real, só verifica redirect pra `/login`).

---

## 8. Cobertura do spec mãe — seção 5.5

| Spec | Coberto por |
|---|---|
| Tipo Trello/Asana simplificado | Modelo + UI |
| Listas: "Atribuídas a mim", "Criadas por mim", "Por cliente", "Por prioridade" | TaskTabs + filtro de prioridade + `/clientes/[id]/tarefas` |
| Filtros: status, prioridade, prazo, cliente | TaskFilters |
| Notificação ao ser atribuído | `notifyTaskAssigned` |
| Notificação 24h antes do prazo / overdue | **Fase 5** (cron) |
| Vincular tarefa a cliente (opcional) | `client_id` nullable + combobox |
| Aparece dentro da pasta do cliente | `/clientes/[id]/tarefas` |

---

## 9. Estimativa

- ~12 commits
- 2 migrations (tasks + notifications)
- ~10 componentes novos
- 5 server actions de tarefa + 2 de notificação + 2 helpers de trigger
- Sem dependências novas

---

## 10. Aprovação

Brainstorming concluído com a usuária em 2026-04-27. Todas as 5 seções (modelo, arquivos, telas, actions, testes/edge cases) aprovadas explicitamente. Próximo passo: skill `writing-plans` gera o plano detalhado de execução em `docs/superpowers/plans/2026-04-27-fase-4-tarefas.md`.
