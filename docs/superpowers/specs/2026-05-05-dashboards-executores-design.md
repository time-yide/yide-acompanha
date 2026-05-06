# Dashboards de executores (videomaker, designer, editor) — design

**Data:** 2026-05-05
**Escopo:** PR1 de uma sequência de 3 PRs. Os outros são (PR2) Dashboard do audiovisual_chefe e (PR3) Filtro do sócio para impersonar visões.

## Contexto

Hoje, os roles `videomaker`, `designer`, `editor` e `audiovisual_chefe` caem no `StubGreeting` em [src/app/(authed)/page.tsx:23](src/app/(authed)/page.tsx) — placeholder com a frase "O dashboard do seu papel chega na próxima fase." Este spec endereça os 3 primeiros (executores). O `audiovisual_chefe` fica no PR2 porque depende de dados produzidos pelos dashboards de videomaker e editor.

## Decisões de produto (já validadas)

1. **Modal "Quantas artes entregues?"** aparece quando alguém com `role = designer` marca tarefa como concluída. Obrigatório, sem opção de pular. Designer escreve `0` quando a tarefa não foi de arte. Para outros roles, conclusão segue normal sem prompt.
2. **Contadores** (artes do designer, tarefas concluídas do editor) — default mês corrente, com seletor de período permitindo filtrar.
3. **Editor não tem campo extra** — só conta tarefas concluídas no período.
4. **Agendamentos do videomaker** — só eventos com `sub_calendar = videomakers` onde ele é participante. Janela: início desta semana até fim da próxima semana (2 semanas).

## Mudanças por área

### Banco de dados

Migration nova adiciona um único campo:

```sql
alter table public.tasks
  add column if not exists artes_entregues integer null check (artes_entregues is null or artes_entregues >= 0);
```

- **Nullable** porque tarefas existentes não têm valor; e tarefas concluídas por não-designers continuam com `null`.
- **CHECK** garante não-negativo a nível de DB (defesa em profundidade — Zod também valida).
- **Sem default**, sem backfill.

### Server action e modal de conclusão

Hoje a conclusão é o `toggleTaskCompletionAction(taskId)` em [src/lib/tarefas/actions.ts:232](src/lib/tarefas/actions.ts:232) — alterna entre `aberta` e `concluida`. Vamos estender a assinatura:

- `toggleTaskCompletionAction(taskId, artesEntregues?: number | null)` — segundo argumento opcional.
- Server: lê `actor.role`. Se `role === "designer"` E está fechando (não reabrindo) E `artesEntregues === undefined`, retorna `{ requiresArtesPrompt: true }` sem mudar nada.
- Quando o cliente reenviar com `artesEntregues` numérico (≥0, inteiro), action grava `artes_entregues = artesEntregues` + `status = concluida` + `completed_at` na mesma update.
- Reabrir (concluida → aberta): mantém `artes_entregues` como está (não zera). Pra outros roles ou ao reabrir: ignora `artesEntregues` se vier.

**UI:** componente client `<CompleteTaskButton role={user.role} />` que envolve a lógica:
1. Chama action sem argumento.
2. Se voltar `requiresArtesPrompt`, abre `<ArtesPromptModal>` (input number, min 0, integer-only, texto explicativo).
3. Submit do modal chama action de novo com o número.

Substitui o botão de toggle atual em todos os lugares (TaskCard, página de detalhe, etc — identificar todos na implementação via grep de `toggleTaskCompletionAction`).

**Validação Zod:** `z.number().int().min(0)`. NaN, negativo, decimal → erro.

### Widgets reutilizáveis (3 novos componentes)

Vão em `src/components/dashboard/personal/`:

- **`FixoCard`** — KPI card "Seu fixo mensal" mostrando `formatBRL(profiles.fixo_mensal)`. Visual igual ao `KpiCard` existente.
- **`MinhasTarefasPendentes`** — lista (não tabela) das tarefas onde `atribuido_a = userId` **OU** `participantes_ids` contém `userId` (mesmo padrão usado em [src/lib/tarefas/queries.ts:93-95](src/lib/tarefas/queries.ts:93)) com `status != concluida`. Ordenadas por `due_date` ASC (urgentes em cima); tarefas sem due_date no fim. Exibe título, cliente (se houver), prazo, prioridade. Click no item leva para `/tarefas/<id>`. Empty state amigável ("Nenhuma tarefa pendente. ").
- **`PeriodoSelector`** — dropdown URL-driven controlando `?periodo=mes_atual|mes_anterior|dias_7|total`. Default `mes_atual` se ausente. Componente client igual ao padrão de [src/components/prospeccao/ComercialSelector.tsx](src/components/prospeccao/ComercialSelector.tsx).

### Os 3 dashboards

Mesma estrutura visual: header (greeting), grid de cards no topo, lista abaixo.

#### `DashboardVideomaker`
- Header: "Olá, {primeiroNome}"
- `FixoCard`
- Lista **Próximas gravações** — eventos com `sub_calendar = videomakers` onde user é participante (`participantes_ids` contém `userId`), entre segunda da semana atual e domingo da próxima semana, calculado em fuso `America/Sao_Paulo` (BRT). Cada item mostra: título, data/hora formatada, endereço (`localizacao_endereco`, sempre presente porque é obrigatório no form de videomaker), link "Ver no calendário" → `/calendario` filtrado naquele dia. Empty state: "Nenhuma gravação agendada nas próximas 2 semanas."

#### `DashboardDesigner`
- Header
- `FixoCard` + Card **Artes entregues** com `PeriodoSelector` no canto. Soma de `artes_entregues` das tarefas onde `atribuido_a = userId`, `status = concluida`, `completed_at` dentro do período.
- `MinhasTarefasPendentes` em destaque visual

#### `DashboardEditor`
- Header
- `FixoCard` + Card **Tarefas concluídas no período** com `PeriodoSelector`. Conta de tarefas onde `atribuido_a = userId`, `status = concluida`, `completed_at` dentro do período.
- `MinhasTarefasPendentes` em destaque visual

### Roteamento

Em [src/app/(authed)/page.tsx](src/app/(authed)/page.tsx), antes do return final do `StubGreeting`:

```ts
if (user.role === "videomaker") return <DashboardVideomaker userId={user.id} nome={user.nome} />;
if (user.role === "designer")   return <DashboardDesigner   userId={user.id} nome={user.nome} />;
if (user.role === "editor")     return <DashboardEditor     userId={user.id} nome={user.nome} />;
```

Após PR1, só `audiovisual_chefe` ainda cai no `StubGreeting` (será endereçado em PR2).

### Queries server-side

Arquivo novo: `src/lib/dashboard/personal.ts`

Funções:
- `getMinhasTarefasPendentes(userId): Promise<TaskRow[]>`
- `getProximasGravacoes(userId, fromIso, toIso): Promise<EventoRow[]>`
- `getProducaoNoPeriodo(userId, periodo, kind: "artes" | "tarefas"): Promise<number>`
  - `kind="artes"` → `SELECT sum(artes_entregues) FROM tasks WHERE atribuido_a=$1 AND status='concluida' AND completed_at BETWEEN ...`
  - `kind="tarefas"` → `SELECT count(*) FROM tasks WHERE ...` (mesmo escopo, sem condição de campo).
- `resolvePeriodo(periodo: string): { fromIso: string; toIso: string }` — utilitário que mapeia `mes_atual|mes_anterior|dias_7|total` para par de datas ISO.

Tudo cacheado com `unstable_cache` + tag `dashboard` (mesmo padrão do que já existe em [src/lib/dashboard/queries.ts](src/lib/dashboard/queries.ts)). Mutations de tarefas e eventos invalidam o tag.

## Fluxo de dados (resumo)

```
[user logado, role=designer]
  → Página /
  → page.tsx detecta role → renderiza <DashboardDesigner />
  → Server Component faz: getMinhasTarefasPendentes, getProducaoNoPeriodo
  → Renderiza FixoCard + Counter + Lista

[designer marca tarefa como concluída]
  → Click em <CompleteTaskButton>
  → Detecta role=designer no client → abre <ArtesPromptModal>
  → User digita N → submit chama completeTaskAction(taskId, N)
  → Server action grava + revalida tag 'dashboard' e 'tasks'
  → UI atualiza
```

## Casos de borda

- **Tarefa concluída antes do PR1** (sem `artes_entregues`): conta no contador "Tarefas concluídas no período" do editor (porque conta linhas), mas não soma nada no contador de artes do designer (sum(null)=null tratado como 0).
- **Designer transferindo tarefa**: se um designer recebe e conclui uma tarefa que veio de outra pessoa, o `artes_entregues` é creditado a ele (atribuido_a no momento da conclusão).
- **Período "total"**: query sem WHERE de data, pode ficar lenta com muitas tarefas. Mitigação: index em `(atribuido_a, status, completed_at)` se necessário — avaliar na implementação se já não existe.
- **Videomaker sem gravações**: empty state amigável, sem erro.
- **Mobile**: todos os componentes seguem o padrão de responsividade do dashboard atual (grid 1 col mobile, 2-3 cols desktop).

## Fora de escopo deste PR

- Dashboard do `audiovisual_chefe` (PR2)
- Filtro de impersonate do sócio (PR3)
- Cálculo automático de comissão a partir de `artes_entregues` (PR2 ou depois — esse spec só prepara o dado)
- Histórico/auditoria do campo `artes_entregues` (não há requisito de track de mudanças)
- Backfill de dados antigos

## Risco

- **Baixo**: campo nullable, sem CHECK forte, sem alteração em fluxos existentes (só adiciona caminho novo para designer). Outros roles continuam com fluxo idêntico.
- **Único ponto sensível**: o modal de conclusão para designer. Se quebrar, designer não consegue concluir nenhuma tarefa. Mitigação: teste unitário da `toggleTaskCompletionAction` cobrindo as 3 ramificações (designer fechando sem prompt → requiresArtesPrompt; designer fechando com prompt → grava; outros roles fechando → grava sem campo), e teste E2E Playwright do fluxo completo do designer.
