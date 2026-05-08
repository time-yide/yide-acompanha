# Ajustes no fluxo de tarefas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as 5 mudanças do spec [2026-05-08-fluxo-tarefas-ajustes-design](../specs/2026-05-08-fluxo-tarefas-ajustes-design.md): auto-link de URLs, modal de entrega obrigatório, rename de label, nova coluna "Alteração" + notificação, nova coluna "Agendado".

**Architecture:** 2 valores novos no enum `task_status` (`alteracao`, `agendado`) + 1 em `notification_event`. 2 colunas novas em `tasks` (`drive_link`, `entrega_observacoes`). 1 modal client-side intercepta drag pra "Concluído Op." quando responsável é dos 4 papéis. 1 helper `Linkify` aplicado em texto livre. `requestAdjustmentsAction` muda status pra `alteracao` + dispara notif `task_alteracao_solicitada`.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + service role), Zod, Tailwind, vitest.

**PR strategy:** 3 PRs sequenciais:
- **PR D:** Foundation (migrations + types + schema TS + labels admin)
- **PR E:** UI (rename labels + 8 colunas + Linkify nos comentários/descrição)
- **PR F:** Actions (modal de entrega + alteração + cleanup ArtesPromptModal)

---

## PR D — Foundation: migrations + types + schema

### Task D.1 — Migration A: enum values

**Files:**
- Create: `supabase/migrations/20260508130000_add_task_workflow_enum_values.sql`

- [ ] **Step 1: Criar migration**

```sql
-- Valores novos pra suportar:
-- - "Alteração" coluna do kanban (tarefa rejeitada na aprovação)
-- - "Agendado" coluna entre aprovado e postado
-- - Notif quando tarefa entra em alteração
-- ALTER TYPE ... ADD VALUE precisa rodar isolada (regra Postgres).

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'alteracao';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'agendado';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'task_alteracao_solicitada';
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/20260508130000_add_task_workflow_enum_values.sql
git commit -m "feat(tarefas): adiciona enum values alteracao, agendado, task_alteracao_solicitada"
```

### Task D.2 — Migration B: colunas de entrega + seed

**Files:**
- Create: `supabase/migrations/20260508130100_add_task_entrega_fields_and_seed.sql`

- [ ] **Step 1: Criar migration**

```sql
-- Campos de entrega obrigatórios pra editor/videomaker/designer/audiovisual_chefe
-- ao mover tarefa pra "Concluído Operacional" (ex-"Concluída"). Por enquanto
-- nullables — tarefas antigas em "concluida" não são afetadas. Validação
-- acontece no server action, não no schema (pra permitir update legado).

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS drive_link TEXT,
  ADD COLUMN IF NOT EXISTS entrega_observacoes TEXT;

INSERT INTO notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
VALUES
  ('task_alteracao_solicitada', true, true, false, true, '{}', '{}')
ON CONFLICT (evento_tipo) DO NOTHING;
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/20260508130100_add_task_entrega_fields_and_seed.sql
git commit -m "feat(tarefas): drive_link + entrega_observacoes em tasks + seed da regra task_alteracao_solicitada"
```

### Task D.3 — Apply migrations on remote DB

Este step depende de o usuário aplicar via **Supabase Dashboard SQL Editor** (controller passa o SQL pra usuário copiar). Não rodar `npm run db:push` (CLI não está autenticada).

- [ ] **Step 1: Aplicar Migration A (em query separada)**

Bloco de SQL pra colar no Dashboard. Aguardar "Success".

- [ ] **Step 2: Aplicar Migration B (segunda query)**

Outra query separada. Aguardar "Success".

### Task D.4 — Regenerar `src/types/database.ts`

A CLI do Supabase não está disponível neste setup (vide PR #165). Se a MCP Supabase estiver autenticada, usar `mcp__supabase__generate_typescript_types`. Se não, **patchar manualmente** os 2 lugares:

- [ ] **Step 1: Adicionar enum values em `task_status`**

Localizar (~linha 1612):
```ts
      task_status: "aberta" | "em_andamento" | "concluida"
```
Substituir por:
```ts
      task_status:
        | "aberta"
        | "em_andamento"
        | "concluida"
        | "alteracao"
        | "agendado"
```

E o array correspondente (~linha 1850):
```ts
      task_status: ["aberta", "em_andamento", "concluida"],
```
→
```ts
      task_status: ["aberta", "em_andamento", "concluida", "alteracao", "agendado"],
```

- [ ] **Step 2: Adicionar `task_alteracao_solicitada` em `notification_event`**

Localizar (~linha 1591) o union `notification_event:` e adicionar `| "task_alteracao_solicitada"` no final, antes do próximo enum. Mesma adição no array `notification_event: [...]`.

- [ ] **Step 3: Adicionar `drive_link` e `entrega_observacoes` em `tasks`**

Em `Database["public"]["Tables"]["tasks"]`, adicionar nos 3 blocos (Row, Insert, Update):

```ts
        Row: {
          // ... campos existentes ...
          drive_link: string | null
          entrega_observacoes: string | null
        }
        Insert: {
          // ... campos existentes ...
          drive_link?: string | null
          entrega_observacoes?: string | null
        }
        Update: {
          // ... campos existentes ...
          drive_link?: string | null
          entrega_observacoes?: string | null
        }
```

Manter ordem alfabética conforme padrão do arquivo.

- [ ] **Step 4: Typecheck**

Run: `npx --no-install tsc --noEmit`
Expected: limpo (filtra `web-push` se aparecer — pré-existente).

- [ ] **Step 5: Commit**

```
git add src/types/database.ts
git commit -m "chore(types): regen com task_status novos + drive_link/entrega_observacoes + task_alteracao_solicitada"
```

### Task D.5 — Atualizar `TASK_STATUSES` + adicionar `concludeOperationalSchema`

**Files:**
- Modify: `src/lib/tarefas/schema.ts`

- [ ] **Step 1: Editar TASK_STATUSES**

Localizar:
```ts
export const TASK_STATUSES = [
  "aberta",
  "em_andamento",
  "concluida",
  "em_aprovacao",
  "aprovada",
  "postada",
] as const;
```

Substituir por:
```ts
export const TASK_STATUSES = [
  "aberta",
  "em_andamento",
  "concluida",
  "em_aprovacao",
  "alteracao",
  "aprovada",
  "agendado",
  "postada",
] as const;
```

- [ ] **Step 2: Adicionar `concludeOperationalSchema`**

No final do arquivo (depois dos schemas existentes):

```ts
/**
 * Schema do modal "Concluir Operacionalmente" — exigido pra editor,
 * videomaker, designer e audiovisual_chefe ao mover tarefa pra
 * status `concluida`. Drive link e quantidade entregue obrigatórios;
 * observações livres opcional.
 */
export const concludeOperationalSchema = z.object({
  id: z.string().uuid(),
  drive_link: z.string().url("Link do Drive inválido").max(500),
  artes_entregues: z.coerce
    .number({ invalid_type_error: "Quantidade obrigatória" })
    .int("Use número inteiro")
    .min(1, "Mínimo 1")
    .max(999, "Máximo 999"),
  entrega_observacoes: z.string().trim().max(2000).optional(),
});

export type ConcludeOperationalInput = z.infer<typeof concludeOperationalSchema>;
```

- [ ] **Step 3: Typecheck**

Run: `npx --no-install tsc --noEmit`
Expected: limpo.

- [ ] **Step 4: Commit**

```
git add src/lib/tarefas/schema.ts
git commit -m "feat(tarefas): TASK_STATUSES com alteracao+agendado + concludeOperationalSchema"
```

### Task D.6 — Label do novo evento de notif no painel admin

**Files:**
- Modify: `src/components/notificacoes/RuleCard.tsx`
- Modify: `src/app/(authed)/configuracoes/notificacoes/page.tsx`

Os dois arquivos têm um mapa duplicado `eventLabels`. Adicionar a mesma entrada em ambos.

- [ ] **Step 1: Edit RuleCard.tsx**

Localizar o objeto `const eventLabels: Record<string, string> = { ... }`. Adicionar antes do `}`:

```ts
  task_alteracao_solicitada: "Ajustes solicitados na sua tarefa",
```

- [ ] **Step 2: Edit page.tsx**

Mesma adição em `src/app/(authed)/configuracoes/notificacoes/page.tsx`.

- [ ] **Step 3: Lint**

Run: `npx --no-install eslint src/components/notificacoes/RuleCard.tsx 'src/app/(authed)/configuracoes/notificacoes/page.tsx'`
Expected: limpo.

- [ ] **Step 4: Commit**

```
git add src/components/notificacoes/RuleCard.tsx 'src/app/(authed)/configuracoes/notificacoes/page.tsx'
git commit -m "feat(notif): label pt-BR pra task_alteracao_solicitada no painel"
```

### Task D.7 — Push branch

- [ ] **Step 1: Push**

```
git push -u origin feat/tarefas-foundation
```

Não abrir PR ainda — controller revisa e abre.

---

## PR E — UI: 8 colunas + auto-link

Esta PR pode ser mergeada depois da D porque depende de `TASK_STATUSES` expandido. Mas não dispara comportamento novo de actions — só atualiza o que aparece no kanban e adiciona linkificação.

### Task E.1 — Helper `Linkify`

**Files:**
- Create: `src/lib/utils/linkify.tsx`

- [ ] **Step 1: Criar componente**

```tsx
import * as React from "react";

// Captura URLs http/https. Para de capturar em pontuação final comum
// (vírgula, ponto, parênteses) pra não engolir o texto que veio depois.
const URL_REGEX = /(https?:\/\/[^\s<>"]+[^\s<>".,;!?:'")\]])/g;

/**
 * Renderiza texto plain transformando URLs em <a> clicáveis. Sem
 * parsing de markdown — só URL. Usado em campos de texto livre
 * (comentários, descrição, observações de entrega, motivo de alteração).
 *
 * Quebra de linha (\n) é preservada via white-space: pre-wrap no
 * container que renderiza o componente.
 */
export function Linkify({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          // Reset regex.lastIndex (regex global mantém estado)
          URL_REGEX.lastIndex = 0;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 break-all hover:text-primary/80"
            >
              {part}
            </a>
          );
        }
        URL_REGEX.lastIndex = 0;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/lib/utils/linkify.tsx
git commit -m "feat(utils): Linkify component pra auto-link de URLs em texto livre"
```

### Task E.2 — Aplicar Linkify em CommentsPanel

**Files:**
- Modify: `src/components/tarefas/CommentsPanel.tsx`

Localizar o ponto onde o corpo do comentário é renderizado (procurar por `comment.body` ou `comment.conteudo` ou `comment.texto` no JSX).

- [ ] **Step 1: Investigar onde o corpo é renderizado**

Run:
```bash
grep -nE "comment\.(body|conteudo|texto)" src/components/tarefas/CommentsPanel.tsx
```

A linha que renderiza o texto plain do comentário (provavelmente algo como `<p className="...">{comment.body}</p>` ou similar) precisa virar `<p><Linkify text={comment.body} /></p>`.

- [ ] **Step 2: Adicionar import**

No topo do arquivo:
```ts
import { Linkify } from "@/lib/utils/linkify";
```

- [ ] **Step 3: Substituir a renderização**

Trocar:
```tsx
{comment.body}
```
por:
```tsx
<Linkify text={comment.body} />
```

(Adaptar pro nome real do campo encontrado no Step 1.)

- [ ] **Step 4: Garantir whitespace preservado**

O parágrafo que envolve o `<Linkify>` precisa ter `className` com `whitespace-pre-wrap` (ou `whitespace-pre-line`). Se ainda não tem, adicionar.

- [ ] **Step 5: Lint**

Run: `npx --no-install eslint src/components/tarefas/CommentsPanel.tsx`
Expected: limpo.

- [ ] **Step 6: Commit**

```
git add src/components/tarefas/CommentsPanel.tsx
git commit -m "feat(tarefas): URLs nos comentários ficam clicáveis (Linkify)"
```

### Task E.3 — Aplicar Linkify em descrição/observações da tarefa

**Files:**
- Modify: `src/app/(authed)/tarefas/[id]/page.tsx`

- [ ] **Step 1: Investigar render de descrição**

Run:
```bash
grep -n "descricao\|entrega_observacoes\|observacoes" src/app/\(authed\)/tarefas/\[id\]/page.tsx
```

- [ ] **Step 2: Adicionar import**

```ts
import { Linkify } from "@/lib/utils/linkify";
```

- [ ] **Step 3: Substituir renders de texto cru**

Onde a descrição da tarefa é renderizada (provavelmente algo como `<p>{task.descricao}</p>` ou `<div>{task.descricao}</div>`), envolver com `<Linkify>`:

```tsx
<p className="whitespace-pre-wrap"><Linkify text={task.descricao} /></p>
```

Mesma coisa pra `entrega_observacoes` se já estiver renderizando (pode ainda não estar — campo é novo). Pular se não existir ainda; adicionamos no PR F.

- [ ] **Step 4: Typecheck + lint**

```
npx --no-install tsc --noEmit
npx --no-install eslint 'src/app/(authed)/tarefas/[id]/page.tsx'
```
Expected: limpos.

- [ ] **Step 5: Commit**

```
git add 'src/app/(authed)/tarefas/[id]/page.tsx'
git commit -m "feat(tarefas): descrição da tarefa ganha auto-link (Linkify)"
```

### Task E.4 — Atualizar TasksColumn (8 colunas + rename)

**Files:**
- Modify: `src/components/tarefas/TasksColumn.tsx`

- [ ] **Step 1: Substituir tipo Status e label map**

Localizar (linha 8-17):
```tsx
type Status = "aberta" | "em_andamento" | "concluida" | "em_aprovacao" | "aprovada" | "postada";

const COLUMN_LABEL: Record<Status, string> = {
  aberta: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluídas",
  em_aprovacao: "Aprovação",
  aprovada: "Aprovado",
  postada: "Postado",
};
```

Substituir por:
```tsx
type Status =
  | "aberta"
  | "em_andamento"
  | "concluida"
  | "em_aprovacao"
  | "alteracao"
  | "aprovada"
  | "agendado"
  | "postada";

const COLUMN_LABEL: Record<Status, string> = {
  aberta: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluído Operacional",
  em_aprovacao: "Aprovação",
  alteracao: "Alteração",
  aprovada: "Aprovado",
  agendado: "Agendado",
  postada: "Postado",
};
```

- [ ] **Step 2: Lint**

Run: `npx --no-install eslint src/components/tarefas/TasksColumn.tsx`
Expected: limpo.

- [ ] **Step 3: Commit**

```
git add src/components/tarefas/TasksColumn.tsx
git commit -m "feat(tarefas): rename 'Concluídas' → 'Concluído Operacional' + colunas Alteração/Agendado"
```

### Task E.5 — Atualizar TasksBoard (8 statuses + groups)

**Files:**
- Modify: `src/components/tarefas/TasksBoard.tsx`

- [ ] **Step 1: Substituir Status type, STATUSES array, e groups**

Localizar (linhas 9-23):

```tsx
type Status = "aberta" | "em_andamento" | "concluida" | "em_aprovacao" | "aprovada" | "postada";
const STATUSES: Status[] = ["aberta", "em_andamento", "concluida", "em_aprovacao", "aprovada", "postada"];

export function TasksBoard({ tasks, userRole }: { tasks: TaskRow[]; userRole: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups: Record<Status, TaskRow[]> = {
    aberta: [],
    em_andamento: [],
    concluida: [],
    em_aprovacao: [],
    aprovada: [],
    postada: [],
  };
```

Substituir por:

```tsx
type Status =
  | "aberta"
  | "em_andamento"
  | "concluida"
  | "em_aprovacao"
  | "alteracao"
  | "aprovada"
  | "agendado"
  | "postada";

const STATUSES: Status[] = [
  "aberta",
  "em_andamento",
  "concluida",
  "em_aprovacao",
  "alteracao",
  "aprovada",
  "agendado",
  "postada",
];

export function TasksBoard({ tasks, userRole }: { tasks: TaskRow[]; userRole: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups: Record<Status, TaskRow[]> = {
    aberta: [],
    em_andamento: [],
    concluida: [],
    em_aprovacao: [],
    alteracao: [],
    aprovada: [],
    agendado: [],
    postada: [],
  };
```

- [ ] **Step 2: Typecheck**

Run: `npx --no-install tsc --noEmit`
Expected: limpo (TasksColumn já foi atualizado em E.4 — types batem).

- [ ] **Step 3: Commit**

```
git add src/components/tarefas/TasksBoard.tsx
git commit -m "feat(tarefas): TasksBoard com 8 colunas (Alteração + Agendado)"
```

### Task E.6 — Atualizar STATUS_LABEL na página de detalhe

**Files:**
- Modify: `src/app/(authed)/tarefas/[id]/page.tsx`

- [ ] **Step 1: Localizar STATUS_LABEL**

Procurar `STATUS_LABEL` ou `concluida: "Concluída"` (vimos que existe). Atualizar pra:

```ts
const STATUS_LABEL: Record<string, string> = {
  aberta: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluído Operacional",
  em_aprovacao: "Aprovação",
  alteracao: "Alteração",
  aprovada: "Aprovado",
  agendado: "Agendado",
  postada: "Postado",
};
```

(Manter o `Record<string, string>` ou tipo equivalente que já está no arquivo.)

- [ ] **Step 2: Typecheck**

Run: `npx --no-install tsc --noEmit`

- [ ] **Step 3: Commit**

```
git add 'src/app/(authed)/tarefas/[id]/page.tsx'
git commit -m "feat(tarefas): STATUS_LABEL com Concluído Operacional + Alteração + Agendado"
```

### Task E.7 — Atualizar TaskCard se necessário

**Files:**
- Modify: `src/components/tarefas/TaskCard.tsx` (se precisar)

`TaskCard.tsx` referencia `task.status === "concluida" || task.status === "postada"` (vi no grep). Pra "isCompleted", **adicionar `agendado` e `aprovada`** se faz sentido (tarefa "feita" do ponto de vista visual).

Ou manter como está — `concluida || postada` continua válido (são os terminais).

- [ ] **Step 1: Investigar uso atual de `isCompleted`**

Run:
```bash
grep -n "isCompleted\|status === " src/components/tarefas/TaskCard.tsx | head -10
```

- [ ] **Step 2: Decidir se precisa mudar**

Se `isCompleted` é usado pra dar opacidade/strikethrough no card, manter como está — só `concluida` e `postada` são terminais visuais. "alteracao" e "agendado" são intermediários, não devem aparecer "completed".

Provavelmente nenhuma mudança necessária. Se for o caso, **pular pro próximo task**.

- [ ] **Step 3: Se mudou, commit**

```
git add src/components/tarefas/TaskCard.tsx
git commit -m "feat(tarefas): TaskCard reconhece statuses novos"
```

### Task E.8 — Push branch

- [ ] **Step 1: Push**

```
git push -u origin feat/tarefas-ui-colunas-linkify
```

Não abrir PR — controller faz a review.

---

## PR F — Actions: modal de entrega + alteração

Depende de PR D (schema) e PR E (UI). Após mergeados, esta PR completa o feature pack.

### Task F.1 — Server action `concludeOperationalAction`

**Files:**
- Modify: `src/lib/tarefas/actions.ts`

Adicionar nova action no final do arquivo (antes de `unsubscribePushAction` se aplicável, ou só no final):

- [ ] **Step 1: Adicionar imports se faltarem**

Verificar se `concludeOperationalSchema` já importa do schema:

```bash
grep -n "concludeOperationalSchema\|from \"./schema\"" src/lib/tarefas/actions.ts | head
```

Se não, adicionar ao import existente:
```ts
import { /* ...existentes */, concludeOperationalSchema } from "./schema";
```

- [ ] **Step 2: Adicionar a action**

```ts
const ROLES_QUE_ENTREGAM = ["editor", "videomaker", "designer", "audiovisual_chefe"] as const;
type RoleQueEntrega = (typeof ROLES_QUE_ENTREGAM)[number];

function isRoleQueEntrega(role: string): role is RoleQueEntrega {
  return (ROLES_QUE_ENTREGAM as readonly string[]).includes(role);
}

/**
 * Conclui operacionalmente uma tarefa (move pra status='concluida') E
 * persiste os campos de entrega obrigatórios (drive_link + artes_entregues
 * + observações opcional).
 *
 * Quem chama: o ConcludeOperationalModal no client, antes do drag virar
 * efetivo. Server-side é defense in depth: revalida que o responsável é
 * dos 4 papéis (rule sticky), valida payload, e atualiza atomicamente.
 */
export async function concludeOperationalAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();

  const parsed = concludeOperationalSchema.safeParse({
    id: formData.get("id"),
    drive_link: formData.get("drive_link"),
    artes_entregues: formData.get("artes_entregues"),
    entrega_observacoes: formData.get("entrega_observacoes") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, atribuido_a, status, criado_por")
    .eq("id", parsed.data.id)
    .single();
  if (!task) return { error: "Tarefa não encontrada" };

  // Carrega o role do responsável
  const { data: assignee } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", task.atribuido_a)
    .single();
  if (!assignee) return { error: "Responsável não encontrado" };

  if (!isRoleQueEntrega(assignee.role)) {
    return { error: "Esta tarefa não exige entrega via modal — use a movimentação normal" };
  }

  // Permissão: actor é o responsável OU é privileged (admin/sócio movendo
  // pelo subordinado). Outros não podem.
  const isAssignee = actor.id === task.atribuido_a;
  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (!isAssignee && !isPriv) {
    return { error: "Sem permissão pra concluir esta tarefa" };
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "concluida",
      drive_link: parsed.data.drive_link,
      artes_entregues: parsed.data.artes_entregues,
      entrega_observacoes: parsed.data.entrega_observacoes ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "tasks",
    entidade_id: parsed.data.id,
    acao: "conclude_operational",
    dados_depois: {
      drive_link: parsed.data.drive_link,
      artes_entregues: parsed.data.artes_entregues,
      entrega_observacoes: parsed.data.entrega_observacoes ?? null,
    } as unknown as Record<string, unknown>,
    ator_id: actor.id,
  });

  revalidatePath("/tarefas");
  revalidatePath(`/tarefas/${parsed.data.id}`);
  return { success: true };
}
```

(`logAudit` provavelmente já importa no arquivo — verificar.)

- [ ] **Step 3: Typecheck**

Run: `npx --no-install tsc --noEmit`
Expected: limpo.

- [ ] **Step 4: Commit**

```
git add src/lib/tarefas/actions.ts
git commit -m "feat(tarefas): concludeOperationalAction (entrega obrigatória pra editor/videomaker/designer/audiovisual_chefe)"
```

### Task F.2 — Guard em `moveTaskStatusAction` pra evitar bypass do modal

**Files:**
- Modify: `src/lib/tarefas/actions.ts`

`moveTaskStatusAction` é o que o drag-and-drop chama hoje. Quando target é `concluida` E responsável é dos 4 papéis, rejeitar com erro pedindo pra usar o modal.

- [ ] **Step 1: Localizar o body da função**

Run:
```bash
grep -nA 30 "export async function moveTaskStatusAction" src/lib/tarefas/actions.ts | head -35
```

- [ ] **Step 2: Adicionar guard antes do UPDATE**

Após o ponto onde a tarefa atual é carregada (`task`) e antes do UPDATE em `tasks`, inserir:

```ts
// Guard: tarefas atribuídas a editor/videomaker/designer/audiovisual_chefe
// devem usar concludeOperationalAction (com modal) pra ir pra "concluida".
// Esse path serve de defense in depth caso o client burle.
if (toStatus === "concluida") {
  const { data: assignee } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", task.atribuido_a)
    .single();
  if (assignee && (["editor", "videomaker", "designer", "audiovisual_chefe"] as const).includes(assignee.role as never)) {
    return { error: "Use o modal de entrega pra concluir essa tarefa" };
  }
}
```

(Adaptar nome da variável `toStatus` ao que está usado dentro da função — pode ser `parsed.data.to_status` ou similar.)

- [ ] **Step 3: Typecheck**

Run: `npx --no-install tsc --noEmit`

- [ ] **Step 4: Commit**

```
git add src/lib/tarefas/actions.ts
git commit -m "feat(tarefas): guard em moveTaskStatusAction redireciona pra modal de entrega"
```

### Task F.3 — `requestAdjustmentsAction`: status → `alteracao` + dispatch notif

**Files:**
- Modify: `src/lib/tarefas/actions.ts`

- [ ] **Step 1: Localizar o UPDATE**

Procurar a linha que atualmente faz:
```ts
.update({ status: "em_andamento", status_aprovacao: "ajustes_solicitados" })
```

dentro de `requestAdjustmentsAction`.

- [ ] **Step 2: Mudar status alvo**

Trocar `"em_andamento"` por `"alteracao"`:

```ts
.update({ status: "alteracao", status_aprovacao: "ajustes_solicitados" })
```

- [ ] **Step 3: Adicionar dispatch da notificação após o UPDATE bem-sucedido**

Onde a action retorna sucesso, antes do `return { success: true }`, adicionar:

```ts
// Notifica o responsável que a tarefa precisa de ajustes. Mandatory por
// design — usuário não pode perder isso.
await dispatchNotification({
  evento_tipo: "task_alteracao_solicitada",
  titulo: `Ajustes solicitados: ${task.titulo}`,
  mensagem: parsed.data.observacoes.slice(0, 200),
  link: `/tarefas/${parsed.data.id}`,
  user_ids_extras: [task.atribuido_a],
  source_user_id: actor.id,
});
```

(Confirmar que `dispatchNotification` já está importado no topo. Se não, adicionar:
```ts
import { dispatchNotification } from "@/lib/notificacoes/dispatch";
```
)

- [ ] **Step 4: Typecheck**

```
npx --no-install tsc --noEmit
```

- [ ] **Step 5: Commit**

```
git add src/lib/tarefas/actions.ts
git commit -m "feat(tarefas): requestAdjustments move pra alteracao + dispara task_alteracao_solicitada"
```

### Task F.4 — `submitForApprovalAction`: remover prompt "quantas artes"

**Files:**
- Modify: `src/lib/tarefas/actions.ts`

A pergunta de quantidade migrou pra concludeOperationalAction. `submitForApprovalAction` não precisa mais perguntar.

- [ ] **Step 1: Localizar a função**

```bash
grep -nA 20 "export async function submitForApprovalAction" src/lib/tarefas/actions.ts
```

- [ ] **Step 2: Remover o branch `requiresArtesPrompt`**

Procurar e remover qualquer trecho como:
```ts
if (isArtType && actor.role === "designer" && artesEntregues === undefined) {
  return { requiresArtesPrompt: true };
}
```

E também remover o `artesEntregues` do parâmetro/payload + qualquer validação relacionada (`artesEntreguesSchema`).

- [ ] **Step 3: Atualizar tipo do retorno**

Remover `requiresArtesPrompt?: boolean` do tipo `ApprovalResult` ou similar.

- [ ] **Step 4: Typecheck**

```
npx --no-install tsc --noEmit
```

Se reclamar de chamadores em ApprovalCard, isso é esperado — fix no F.5.

- [ ] **Step 5: Commit (mesmo com possíveis erros de tsc; resolveremos no F.5)**

NÃO commit ainda. Vai junto com F.5.

### Task F.5 — `ApprovalCard`: remover ArtesPromptModal + simplificar

**Files:**
- Modify: `src/components/tarefas/ApprovalCard.tsx`
- Delete: `src/components/tarefas/ArtesPromptModal.tsx`

- [ ] **Step 1: Editar ApprovalCard.tsx**

Remover:
- Import de `ArtesPromptModal`
- State `[artesPromptOpen, setArtesPromptOpen]`
- Função `submitWithArtes`
- Branch `if (isDesigner) { setArtesPromptOpen(true); return; }`
- O JSX `<ArtesPromptModal ... />` no render

A função `handleSubmit` deve ficar simples:

```ts
function handleSubmit() {
  setError(null);
  startTransition(async () => {
    const r = await submitForApprovalAction(taskId);
    if (r?.error) {
      setError(r.error);
      toast.error(r.error);
      return;
    }
    toast.success("Enviado para análise");
  });
}
```

- [ ] **Step 2: Deletar ArtesPromptModal.tsx**

```
git rm src/components/tarefas/ArtesPromptModal.tsx
```

- [ ] **Step 3: Typecheck**

```
npx --no-install tsc --noEmit
```
Expected: limpo agora (removemos os usos).

- [ ] **Step 4: Lint**

```
npx --no-install eslint src/components/tarefas/ApprovalCard.tsx src/lib/tarefas/actions.ts
```

- [ ] **Step 5: Commit (combinado com F.4)**

```
git add src/lib/tarefas/actions.ts src/components/tarefas/ApprovalCard.tsx
git commit -m "refactor(tarefas): remove prompt 'quantas artes' do submit (migrou pra concludeOperationalAction)"
```

### Task F.6 — `ConcludeOperationalModal` (client component)

**Files:**
- Create: `src/components/tarefas/ConcludeOperationalModal.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { concludeOperationalAction } from "@/lib/tarefas/actions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  taskTipo: "geral" | "video" | "arte";
  onSuccess: () => void;
}

/**
 * Modal de entrega obrigatório quando responsável (editor/videomaker/
 * designer/audiovisual_chefe) move tarefa pra "Concluído Operacional".
 *
 * Campos:
 * - drive_link: URL do material final (obrigatório)
 * - artes_entregues: quantidade entregue (obrigatório, label dinâmico)
 * - entrega_observacoes: notas livres (opcional)
 *
 * Confirma chama concludeOperationalAction. Onsuccess fecha modal e
 * dispara onSuccess (TasksBoard atualiza visual via revalidate path).
 */
export function ConcludeOperationalModal({ open, onOpenChange, taskId, taskTipo, onSuccess }: Props) {
  const [driveLink, setDriveLink] = useState("");
  const [qtd, setQtd] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pending, startTransition] = useTransition();

  const qtdLabel = taskTipo === "video" ? "Quantos vídeos foram entregues?" : "Quantas artes foram entregues?";
  const isValid = driveLink.trim().length > 0 && qtd.trim().length > 0 && /^\d+$/.test(qtd) && Number(qtd) >= 1;

  function handleConfirm() {
    if (!isValid) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", taskId);
      fd.set("drive_link", driveLink);
      fd.set("artes_entregues", qtd);
      if (observacoes.trim()) fd.set("entrega_observacoes", observacoes.trim());
      const r = await concludeOperationalAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Tarefa concluída e materiais registrados");
      // Reset
      setDriveLink("");
      setQtd("");
      setObservacoes("");
      onOpenChange(false);
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir entrega operacional</DialogTitle>
          <DialogDescription>
            Antes de mover pra "Concluído Operacional", informe onde estão os materiais finais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="drive_link">Link do Drive *</Label>
            <Input
              id="drive_link"
              type="url"
              placeholder="https://drive.google.com/..."
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              disabled={pending}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qtd">{qtdLabel} *</Label>
            <Input
              id="qtd"
              type="number"
              min="1"
              max="999"
              value={qtd}
              onChange={(e) => setQtd(e.target.value)}
              disabled={pending}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações da entrega</Label>
            <Textarea
              id="obs"
              placeholder="Algo importante pro assessor saber? (opcional)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={pending}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || pending}>
            {pending ? "Confirmando…" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar componentes shadcn disponíveis**

Run:
```bash
ls src/components/ui/ | grep -E "dialog|textarea|input"
```
Expected: dialog.tsx, textarea.tsx, input.tsx, label.tsx existem. Se não, criar via shadcn ou adaptar.

- [ ] **Step 3: Lint + typecheck**

```
npx --no-install eslint src/components/tarefas/ConcludeOperationalModal.tsx
npx --no-install tsc --noEmit
```

- [ ] **Step 4: Commit**

```
git add src/components/tarefas/ConcludeOperationalModal.tsx
git commit -m "feat(tarefas): ConcludeOperationalModal com drive_link + qtd + observações"
```

### Task F.7 — `TasksBoard`: interceptar drop pra "concluida" e abrir modal

**Files:**
- Modify: `src/components/tarefas/TasksBoard.tsx`

Quando o drop é em "concluida" E o responsável é dos 4 papéis, abrir o modal em vez de chamar `moveTaskStatusAction`.

- [ ] **Step 1: Imports adicionais**

```ts
import { useRouter } from "next/navigation";
import { ConcludeOperationalModal } from "./ConcludeOperationalModal";
```

- [ ] **Step 2: State pro modal**

Dentro do componente:
```ts
const router = useRouter();
const [conclModalOpen, setConclModalOpen] = useState(false);
const [conclModalTask, setConclModalTask] = useState<{ id: string; tipo: "geral" | "video" | "arte" } | null>(null);
```

- [ ] **Step 3: Adaptar handleDrop**

```tsx
function handleDrop(taskId: string, _fromStatus: Status, toStatus: Status) {
  setError(null);

  // Se está movendo pra "concluida" e o responsável é dos 4 papéis,
  // abrir modal em vez de mover direto.
  if (toStatus === "concluida") {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const requiresModal = (
        ["editor", "videomaker", "designer", "audiovisual_chefe"] as const
      ).includes(task.atribuido_a_role as never);
      if (requiresModal) {
        setConclModalTask({ id: taskId, tipo: (task.tipo as "geral" | "video" | "arte") ?? "geral" });
        setConclModalOpen(true);
        return;
      }
    }
  }

  startTransition(async () => {
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("to_status", toStatus);
    const r = await moveTaskStatusAction(fd);
    if (r && "error" in r && r.error) setError(r.error);
  });
}
```

**Importante:** este código assume que `TaskRow` tem um campo `atribuido_a_role` (role do responsável da tarefa). Se não tiver, precisa estender `listTasks` em `src/lib/tarefas/queries.ts` pra incluir esse campo via join com `profiles`.

- [ ] **Step 4: Verificar se `atribuido_a_role` existe em TaskRow**

Run:
```bash
grep -nA 20 "export type TaskRow\|export interface TaskRow" src/lib/tarefas/queries.ts
```

Se NÃO existir o campo `atribuido_a_role`:
- Adicionar ao `select(...)` em `listTasks` (e `getTaskById` se relevante) com join: `atribuido:profiles!atribuido_a(role)`
- Adicionar ao tipo `TaskRow`: `atribuido_a_role: string`
- No mapping da query, expor como `atribuido_a_role: row.atribuido?.role`

Esse step pode ser maior. Avaliar e fazer com cuidado, com 1 commit dedicado se for substancial.

- [ ] **Step 5: Renderizar modal no JSX**

Antes do fechamento do componente, depois do `<div className="overflow-x-auto pb-4">`:

```tsx
{conclModalTask && (
  <ConcludeOperationalModal
    open={conclModalOpen}
    onOpenChange={setConclModalOpen}
    taskId={conclModalTask.id}
    taskTipo={conclModalTask.tipo}
    onSuccess={() => router.refresh()}
  />
)}
```

- [ ] **Step 6: Typecheck + lint**

```
npx --no-install tsc --noEmit
npx --no-install eslint src/components/tarefas/TasksBoard.tsx
```

- [ ] **Step 7: Commit**

```
git add src/components/tarefas/TasksBoard.tsx src/lib/tarefas/queries.ts
git commit -m "feat(tarefas): TasksBoard intercepta drop em 'concluida' e abre modal de entrega"
```

### Task F.8 — Aplicar Linkify em entrega_observacoes na página de detalhe

**Files:**
- Modify: `src/app/(authed)/tarefas/[id]/page.tsx`

Render do campo novo `entrega_observacoes` (se já estiver renderizado, aplicar Linkify; se não, mostrar quando preenchido).

- [ ] **Step 1: Adicionar bloco condicional**

Em algum ponto razoável da página (ex: junto com a descrição), adicionar:

```tsx
{task.entrega_observacoes && (
  <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Observações da entrega
    </p>
    <p className="text-sm whitespace-pre-wrap">
      <Linkify text={task.entrega_observacoes} />
    </p>
    {task.drive_link && (
      <p className="text-sm">
        <a
          href={task.drive_link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 break-all"
        >
          {task.drive_link}
        </a>
      </p>
    )}
  </div>
)}
```

(Adaptar o estilo pro padrão visual da página.)

- [ ] **Step 2: Typecheck**

```
npx --no-install tsc --noEmit
```

Se `task.entrega_observacoes` ou `task.drive_link` não existem no tipo retornado pela query, adicionar ao `select(...)` em `getTaskById` (ou query equivalente).

- [ ] **Step 3: Commit**

```
git add 'src/app/(authed)/tarefas/[id]/page.tsx' src/lib/tarefas/queries.ts
git commit -m "feat(tarefas): página de detalhe mostra entrega_observacoes + drive_link com Linkify"
```

### Task F.9 — Push branch

- [ ] **Step 1: Push**

```
git push -u origin feat/tarefas-actions-modal-alteracao
```

Não abrir PR — controller faz a review.

---

## Self-review

**Spec coverage:**
- ✅ Auto-link URLs em texto livre → E.1, E.2, E.3, F.8
- ✅ Modal de entrega obrigatório → F.6
- ✅ Action `concludeOperationalAction` → F.1
- ✅ Guard em `moveTaskStatusAction` → F.2
- ✅ Intercept de drop no client → F.7
- ✅ Rename "Concluída" → "Concluído Operacional" → E.4, E.6
- ✅ Coluna "Alteração" → D.1, D.5, E.4, E.5, E.6
- ✅ Coluna "Agendado" → D.1, D.5, E.4, E.5, E.6
- ✅ Notif `task_alteracao_solicitada` → D.1, D.2, D.6, F.3
- ✅ `requestAdjustments` muda pra `alteracao` + dispatch → F.3
- ✅ Cleanup ArtesPromptModal → F.4, F.5
- ✅ Migrations idempotentes → D.1, D.2 (`IF NOT EXISTS` e `ON CONFLICT`)

**Placeholder scan:** Sem TBD/TODO. Códigos completos. Comandos com expected output.

**Type consistency:**
- `concludeOperationalSchema` definido em D.5, usado em F.1 ✓
- `Status` type em E.4 (TasksColumn) e E.5 (TasksBoard) ✓
- `taskTipo` prop do modal (F.6) bate com `tipo` em TasksBoard (F.7) ✓

**Branch + PR strategy:** 3 PRs sequenciais (D → E → F). PR D não muda comportamento (DDL + types). PR E não dispara action novo (só visual). PR F completa o feature.

**Riscos identificados:**
- F.7 step 4: pode precisar estender `TaskRow` com `atribuido_a_role`. Se a query atual não tem esse campo, é commit extra dentro do PR F.
- D.4 (regen types): controller faz manual se MCP Supabase não autenticado. Mesmo padrão do PR #165.
