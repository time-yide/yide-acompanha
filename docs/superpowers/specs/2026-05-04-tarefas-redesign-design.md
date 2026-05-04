# Tarefas — Redesign Phase 1

**Status:** Aprovado, pronto pra implementar.
**Escopo:** Página `/tarefas` ganha view dual (Quadro Kanban + Lista agrupada), cards mais densos, edição inline de status, agrupamento configurável.
**Fora do escopo (Phase 2):** Calendário/timeline, edição inline de prazo/responsável/cliente, drag pra reordenar, subtasks, comentários.

## Motivação

Página atual é uma lista flat com filtros (status, prioridade, prazo, cliente). Sem visualização de pipeline, sem agrupamento, sem edição inline. Difícil "ver o fluxo da agência" — quem está fazendo o quê, o que está atrasado, o que falta.

Inspiração: ClickUp/Asana — multi-view, grouping flexível, ações rápidas no card.

## Modelo de dados

Sem mudanças. Reutiliza `tasks` existente:
- `id`, `titulo`, `descricao`
- `prioridade`: `alta` | `media` | `baixa`
- `status`: `aberta` | `em_andamento` | `concluida`
- `due_date`, `client_id`, `atribuido_a`, `criado_por`, `created_at`, `completed_at`

## Layout

```
Tarefas                                         [+ Nova tarefa]
[Atribuídas a mim · Criadas por mim · Todas]
[🗂 Quadro | ☰ Lista]      [Prioridade] [Cliente] [Responsável¹]

[CONTEÚDO conforme view]
```
¹ filtro de Responsável só aparece na aba "Todas".

View atual e agrupamento controlados via URL params (`?view=board|list&groupBy=prazo|cliente|responsavel|prioridade`) pra preservar via reload e compartilhar links.

## Quadro (default)

3 colunas, mesma estética do `KanbanBoard` de Onboarding (drag-drop nativo HTML5):

| Coluna | Status |
|---|---|
| A fazer | `aberta` |
| Em andamento | `em_andamento` |
| Concluídas | `concluida` |

- Header de coluna: label + contador (`A fazer · 5`)
- Drag entre colunas → server action `moveTaskStatusAction(taskId, toStatus)` → atualiza `status` (e `completed_at` quando vai pra "concluida")
- Filtro de Status some da header (colunas já são o status)
- Cards arrastáveis usam o componente `TaskCard` compartilhado

## Card visual (compartilhado entre Quadro e Lista)

```
● Título da tarefa
👤 YM   🏢 CCR   📅 Hoje                    [✓]
```

Componentes:
- **Dot de prioridade** à esquerda do título: 🔴 alta / 🟡 média / ⚪ baixa
- **Título** truncado em 2 linhas
- **Avatar** 24px com iniciais do `atribuido.nome` (placeholder colorido determinístico baseado no userId)
- **Badge cliente** sutil — `cliente.nome` truncado, omitido se sem cliente
- **Pill prazo** colorida por urgência:
  - 🔴 vermelho = atrasada (`due_date < hoje`)
  - 🟡 amarelo = hoje (`due_date == hoje`)
  - 🔵 azul = próximos 7d (`hoje < due_date <= hoje+7d`)
  - ⚪ cinza = futuro (`> hoje+7d`) ou sem prazo
- **Quick-complete** ✓ aparece à direita no hover. Click → marca como `concluida` (sem confirmação). Não aparece em cards já concluídos.
- **Click no card (fora dos elementos interativos)** → navega pra `/tarefas/[id]`

## Lista

Header ganha seletor "Agrupar por": **Prazo** (default) / Cliente / Responsável / Prioridade.

### Lógica de agrupamento

**Por prazo** (default):
- "Atrasadas" — `due_date < hoje` AND `status != concluida`
- "Hoje" — `due_date == hoje` AND `status != concluida`
- "Esta semana" — `hoje < due_date <= hoje+7d` AND `status != concluida`
- "Sem prazo" — `due_date == null` AND `status != concluida`
- "Futuras" — `due_date > hoje+7d` AND `status != concluida`
- "Concluídas" — `status == concluida` (sempre por último, sempre colapsada por padrão)

**Por cliente:** agrupa por `cliente.nome`. Sem cliente vai pra "(Sem cliente)" no fim.

**Por responsável:** agrupa por `atribuido.nome`.

**Por prioridade:** Alta / Média / Baixa.

### UI da seção

```
▼ Atrasadas · 3
  ○ Tarefa A   👤 YM  🏢 CCR  📅 Venceu há 2d
  ○ Tarefa B   ...
▶ Concluídas · 12  (colapsada)
```

- Header da seção é clicável → toggle expand/collapse (estado em React state, perdido ao recarregar — OK pra MVP)
- Click no ○ marca como concluída inline (mesma action do quick-complete do card)
- "Concluídas" sempre inicia colapsada
- Tasks dentro da seção ordenadas por: prazo asc (null por último), depois prioridade desc

## Filtros (header)

| Filtro | Comportamento |
|---|---|
| Prioridade | mantém — `alta` / `media` / `baixa` / qualquer |
| Cliente | mantém — dropdown com clientes ativos |
| Responsável | mantém — só visível quando aba = "Todas" |
| Status | **removido** — redundante com Quadro; em Lista, "Concluídas" tem seção própria |
| Prazo | **removido** — redundante com agrupamento "Por prazo" da Lista |

## Server actions

### Nova: `moveTaskStatusAction(taskId, toStatus)`

```ts
// src/lib/tarefas/actions.ts
export async function moveTaskStatusAction(formData: FormData): Promise<ActionResult>
```

- Valida `taskId` (UUID) e `toStatus` (enum `aberta` | `em_andamento` | `concluida`)
- Permissão: usuário precisa ser `atribuido_a` OU `criado_por` OU role `socio`/`adm` (mesma regra do `updateTaskAction` existente)
- Atualiza `status`. Se `toStatus == concluida`, seta `completed_at = now()`. Se sai de `concluida`, seta `completed_at = null`.
- Audit log
- `revalidatePath("/tarefas")` e `revalidatePath("/tarefas/[id]")`

### Reuso

`updateTaskAction` existente (página de edição) continua funcionando. Detalhe da tarefa fica intocado.

## Componentes novos

- `src/components/tarefas/TasksBoard.tsx` (client) — Kanban com 3 colunas + drag-drop
- `src/components/tarefas/TasksColumn.tsx` (client) — Coluna do Kanban (similar ao `KanbanColumn` de onboarding mas tipada pra tasks)
- `src/components/tarefas/TaskCard.tsx` (client) — Card visual reutilizado entre Board e Lista. Inclui quick-complete e drag handlers.
- `src/components/tarefas/TasksGroupedList.tsx` (client) — Lista com grouping configurável + collapse de seções
- `src/components/tarefas/ViewToggle.tsx` (client) — Toggle Quadro/Lista (URL-driven via `?view=`)
- `src/components/tarefas/GroupBySelector.tsx` (client) — Dropdown de agrupamento (URL-driven via `?groupBy=`)

## Componentes modificados

- `src/app/(authed)/tarefas/page.tsx` — orquestra: lê `?view`, renderiza `TasksBoard` ou `TasksGroupedList`. Remove filtros `Status` e `Prazo` do `TaskFilters`.
- `src/components/tarefas/TaskFilters.tsx` — remove props/inputs de `status` e `prazo`.
- `src/components/tarefas/TasksList.tsx` — **deprecated**. Substituído por `TasksGroupedList`. Removido após migração.

## Estado de URL

```
?aba=minhas|criadas|todas        (existente)
?view=board|list                 (novo, default=board)
?groupBy=prazo|cliente|responsavel|prioridade  (novo, só Lista, default=prazo)
?prioridade=alta|media|baixa     (existente)
?client=<uuid>                   (existente)
?atribuido=<uuid>                (existente, só "Todas")
```

Removidos: `?status`, `?prazo`.

## Helpers / utils

- `src/lib/tarefas/grouping.ts` (novo) — pure functions:
  - `groupTasksByPrazo(tasks, today)` → `Record<string, TaskRow[]>` (chaves fixas: atrasadas/hoje/semana/sem_prazo/futuras/concluidas)
  - `groupTasksByCliente(tasks)` → `Record<string, TaskRow[]>`
  - `groupTasksByResponsavel(tasks)` → `Record<string, TaskRow[]>`
  - `groupTasksByPrioridade(tasks)` → `Record<string, TaskRow[]>`
  - `prazoUrgency(due_date, today)` → `'overdue' | 'today' | 'week' | 'future' | 'none'` (usado no card)
  - `formatPrazoLabel(due_date, today)` → `'Venceu há 2d'` / `'Hoje'` / `'Em 3d'` / `'15 mai'`

## Estilo / cores

- Reusa tokens existentes: `bg-emerald-500/15`, `bg-rose-500/15`, etc.
- Avatar bg color determinístico: hash do userId → indexa em paleta de 8 cores
- Card hover: `bg-card → bg-card/80` + sombra sutil
- Drag visual: opacity 50% (mesmo padrão do Onboarding)

## Estado vazio

- Quadro: cada coluna mostra `Vazio` se não tem tarefas
- Lista: se nenhuma seção tem tasks, mostra mensagem central `Nenhuma tarefa.`
- Mantém comportamento atual

## Permissions

Sem mudança no modelo. Quem pode mover/marcar concluída = quem podia editar antes (atribuído, criador, sócio/adm). RLS de `tasks` já cobre.

## Testes

Unit tests novos (`tests/unit/tarefas-grouping.test.ts`):
- `groupTasksByPrazo`: classifica corretamente atrasada/hoje/semana/futura/sem_prazo/concluída
- `prazoUrgency`: retorna a categoria certa pros 5 casos + null
- `formatPrazoLabel`: formata "Venceu há 2d" / "Hoje" / "Em 3d" / "15 mai" / "—"

Sem novo e2e — feature é interativa, fica fora do escopo de testes.

## Migração / rollout

Sem migration de schema. URL params antigos (`?status`, `?prazo`) ignorados silenciosamente. Bookmarks antigos funcionam parcialmente (só perdem o filtro removido).

## Plano de implementação (alto nível)

1. Helpers de grouping + prazo (`src/lib/tarefas/grouping.ts`) + tests
2. `moveTaskStatusAction` em `src/lib/tarefas/actions.ts`
3. `TaskCard` (compartilhado)
4. `TasksBoard` + `TasksColumn` (Quadro)
5. `TasksGroupedList` (Lista)
6. `ViewToggle` + `GroupBySelector`
7. Atualiza `TaskFilters` (remove Status/Prazo)
8. Atualiza `tarefas/page.tsx` — orquestração
9. Remove `TasksList.tsx` antigo

Detalhamento de cada passo na fase de plan (próximo skill).
