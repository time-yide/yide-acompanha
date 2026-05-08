# Ajustes no fluxo de tarefas — entrega + Alteração + Agendado

**Status:** design aprovado, aguardando plano de implementação
**Data:** 2026-05-08

## Objetivo

5 mudanças no kanban de tarefas pra eliminar fricção operacional:

1. **Auto-link de URLs** em texto livre (comentários, descrição, etc.)
2. **Entrega obrigatória** com link do Drive ao concluir trabalho operacional (editor/videomaker/designer/coord audiovisual)
3. **Renomear** "Concluída" → "Concluído Operacional"
4. **Nova coluna "Alteração"** — pra onde tarefa rejeitada na aprovação vai (em vez de cair em "Em andamento" misturada)
5. **Nova coluna "Agendado"** — entre "Aprovado" e "Postado"

Resolve o pedido literal: "facilitar pros assessores pegarem materiais prontos sem precisar pedir no WhatsApp" + visibilidade de tarefas que precisam de ajuste vs as novas + separação entre aprovado e publicado.

## Decisões fechadas com a usuária

1. **Kanban final tem 8 colunas** nesta ordem:
   ```
   A fazer → Em andamento → Concluído Operacional → Aprovação → Alteração → Aprovado → Agendado → Postado
   ```
2. **Bloqueio do Drive link aplica por papel do responsável** (`atribuido_a`). Editor, videomaker, designer e coord audiovisual: link obrigatório. Sócio/adm também são bloqueados se moverem por essas pessoas (rule sticky).
3. **Modal de entrega exige 3 campos** ao mover pra Concluído Op.: Drive link (obrigatório), quantidade entregue (obrigatório, label dinâmico "vídeos" ou "artes" conforme `tipo`), observações (opcional).
4. **A pergunta "quantas artes" vai sair do `submitForApprovalAction`** (que é a etapa Aprovação) e migra pra esta transição mais cedo. Não pergunta 2x.
5. **Auto-link em texto livre** — sem markdown. Só URL plain vira `<a>` clicável. Aplicar em: comentários, descrição, observações de entrega, motivo de alteração.
6. **Sem campo de "anexar link estruturado" novo no comentário** — auto-link cobre 95% dos casos. Adicionar depois se virar dor real.
7. **Não renomear o enum `task_status` no banco** — `concluida` continua `concluida`, só muda o label da UI ("Concluído Operacional"). Refatoração mais barata.
8. **Notificação `task_alteracao_solicitada` é nova, mandatory=true**, dispara pra `atribuido_a` quando a tarefa é movida pra "Alteração" via `requestAdjustmentsAction`. Não notifica `participantes_ids`.
9. **Movimentação Aprovado → Agendado é livre** (qualquer um com permissão de mover). "Postado" continua restrito ao `canMarkPosted` atual.

## Arquitetura

### Mudanças no banco

**Migration A — enum (rodar isolada, antes de B):**

```sql
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'alteracao';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'agendado';
ALTER TYPE notification_event ADD VALUE IF NOT EXISTS 'task_alteracao_solicitada';
```

**Migration B — colunas + seed:**

```sql
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS drive_link TEXT,
  ADD COLUMN IF NOT EXISTS entrega_observacoes TEXT;

INSERT INTO notification_rules
  (evento_tipo, ativo, mandatory, email_default, permite_destinatarios_extras, default_roles, default_user_ids)
VALUES
  ('task_alteracao_solicitada', true, true, false, true, '{}', '{}')
ON CONFLICT (evento_tipo) DO NOTHING;
```

`artes_entregues` já existe — só mudamos onde é coletado.

### Mudanças no schema TypeScript

`src/lib/tarefas/schema.ts`:

```ts
export const TASK_STATUSES = [
  "aberta",
  "em_andamento",
  "concluida",
  "em_aprovacao",
  "alteracao",       // novo
  "aprovada",
  "agendado",        // novo
  "postada",
] as const;
```

Novo schema pra modal de entrega:

```ts
export const concludeOperationalSchema = z.object({
  id: z.string().uuid(),
  drive_link: z.string().url("Link do Drive inválido").max(500),
  artes_entregues: z.coerce.number().int().min(1, "Quantidade obrigatória").max(999),
  entrega_observacoes: z.string().trim().max(2000).optional(),
});
```

### Componentes UI

**`src/components/tarefas/TasksColumn.tsx`** — atualizar `Status` type e `COLUMN_LABEL`:

```ts
type Status = "aberta" | "em_andamento" | "concluida" | "em_aprovacao"
            | "alteracao" | "aprovada" | "agendado" | "postada";

const COLUMN_LABEL: Record<Status, string> = {
  aberta: "A fazer",
  em_andamento: "Em andamento",
  concluida: "Concluído Operacional",   // renomeado
  em_aprovacao: "Aprovação",
  alteracao: "Alteração",                // novo
  aprovada: "Aprovado",
  agendado: "Agendado",                  // novo
  postada: "Postado",
};
```

**`src/components/tarefas/TasksBoard.tsx`** — atualizar array `STATUSES`:

```ts
const STATUSES: Status[] = [
  "aberta", "em_andamento", "concluida",
  "em_aprovacao", "alteracao",
  "aprovada", "agendado", "postada",
];
```

**Novo: `src/components/tarefas/ConcludeOperationalModal.tsx`** (client component):
- Aparece quando responsável move tarefa pra `concluida` E `actor.role` ∈ {editor, videomaker, designer, audiovisual_chefe}
- Disparado pelo handler de drop em `TasksBoard` antes de chamar `moveTaskStatusAction`
- Campos:
  - Link do Drive (input url, obrigatório)
  - Quantidade entregue (input number, obrigatório, label = `tipo === "video" ? "Quantos vídeos?" : "Quantas artes?"`)
  - Observações da entrega (textarea, opcional)
- Botões: Cancelar (fecha sem mover) / Confirmar entrega (chama nova action `concludeOperationalAction`)

**Novo: `src/lib/utils/linkify.tsx`** — utilitário de renderização:

```tsx
const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,;!?:'")\]])/g;

export function Linkify({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
```

Aplicado em (substituir renders de texto cru):
- `CommentsPanel.tsx` (corpo do comentário)
- Página de detalhe da tarefa: descrição, observações de entrega, motivo de alteração

### Server actions

**`src/lib/tarefas/actions.ts`** — modificações:

1. **Nova: `concludeOperationalAction(formData)`**
   - Valida com `concludeOperationalSchema`
   - Verifica que `actor.id === task.atribuido_a` OU é admin/sócio
   - Verifica que `task.atribuido_a`'s role ∈ {editor, videomaker, designer, audiovisual_chefe} (se não for um desses, redireciona pra `moveTaskStatusAction` sem o modal)
   - Atualiza `tasks SET status='concluida', drive_link=?, entrega_observacoes=?, artes_entregues=?`
   - Audit log
   - Revalidate paths

2. **`moveTaskStatusAction`** — mudança pequena:
   - Quando target é `concluida` E responsável é dos 4 papéis: rejeitar com erro pedindo pra usar o modal
   - Mensagem: "Use o modal de entrega pra concluir operacionalmente"
   - O TasksBoard intercepta no client antes de chamar essa action — server-side é defense in depth

3. **`requestAdjustmentsAction`** — 2 mudanças:
   - Linha que faz `update({ status: "em_andamento", ... })` vira `update({ status: "alteracao", ... })`
   - Adicionar dispatch de notificação:
     ```ts
     await dispatchNotification({
       evento_tipo: "task_alteracao_solicitada",
       titulo: `Ajustes solicitados: ${task.titulo}`,
       mensagem: parsed.data.observacoes.slice(0, 200),
       link: `/tarefas/${parsed.data.id}`,
       user_ids_extras: [task.atribuido_a],
     });
     ```

4. **`submitForApprovalAction`** — limpar:
   - Remover o branch `if (isDesigner)` que abre `setArtesPromptOpen(true)` (move pra `concludeOperationalAction`)
   - `artesEntregues` parameter sai da signature
   - O retorno `requiresArtesPrompt` deixa de existir
   - `ApprovalCard.tsx` — remove o `<ArtesPromptModal />` e a lógica de `submitWithArtes(undefined)`

5. **Status válido pra `submitForApprovalAction`** muda:
   - Antes: `pendente_envio` ou `ajustes_solicitados`
   - Depois (consistente com nova coluna Alteração): mantém igual — quando tarefa está em `alteracao` o `status_aprovacao` continua `ajustes_solicitados`. A action move o status pra `em_aprovacao`.

### UI labels e i18n

`src/app/(authed)/tarefas/[id]/page.tsx` tem um label map também (saw `concluida: "Concluída"`). Atualizar pra:

```ts
const STATUS_LABEL = {
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

`src/components/notificacoes/RuleCard.tsx` e `src/app/(authed)/configuracoes/notificacoes/page.tsx` — adicionar label do novo evento:

```ts
task_alteracao_solicitada: "Ajustes solicitados na sua tarefa"
```

## Edge cases e decisões

| Cenário | Comportamento |
|---|---|
| Sócio/adm move tarefa de editor pra Concluído Op. | Modal aparece (rule sticky por papel do responsável). Eles podem preencher os campos no lugar do editor. |
| Sócio move tarefa **própria** (de role sócio) pra Concluído Op. | Sem modal — vai direto. Rule só dispara se `task.atribuido_a` é dos 4 papéis. |
| Tarefa em "Alteração" arrastada de volta pra "Em andamento" | Permitido. Status muda, `status_aprovacao` permanece em `ajustes_solicitados`. Próximo submit volta pra Aprovação normal. |
| Tarefa em "Alteração" arrastada direto pra "Aprovação" | Permitido (executor "submeteu de novo" via drag). Aciona `submitForApprovalAction` que muda `status_aprovacao=em_analise`. |
| URL com `)` ou `,` no final | Regex termina antes de pontuação final pra não engolir. Ex: "veja https://drive.google.com/abc, beleza" — link é só `https://drive.google.com/abc`. |
| Drive link vazio em update existente | Sem migração de dados. Tarefas antigas em `concluida` ficam com `drive_link=NULL`. Não bloqueamos retroativamente. |
| Edit de tarefa muda papel do `atribuido_a` (ex: reatribuir a editor) | Próxima movimentação pra Concluído Op. exige modal. Se já está em `concluida`, ok — não força refill. |
| Modal cancelado | Tarefa não muda de status. Frontend volta o card pra coluna anterior visualmente. |

## Mudanças de código resumidas

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<ts1>_add_task_workflow_enum_values.sql` | enum values novos (isolada) |
| `supabase/migrations/<ts2>_add_task_entrega_fields_and_seed.sql` | colunas + seed da regra |
| `src/types/database.ts` | regen via `supabase gen types` |
| `src/lib/tarefas/schema.ts` | TASK_STATUSES + concludeOperationalSchema |
| `src/lib/tarefas/actions.ts` | concludeOperationalAction novo + requestAdjustments muda status + submitForApproval limpa |
| `src/components/tarefas/TasksColumn.tsx` | labels + Status type |
| `src/components/tarefas/TasksBoard.tsx` | STATUSES array + intercept Concluído Op. |
| `src/components/tarefas/ConcludeOperationalModal.tsx` | NOVO |
| `src/components/tarefas/ApprovalCard.tsx` | remove ArtesPromptModal + lógica relacionada |
| `src/components/tarefas/ArtesPromptModal.tsx` | DELETAR (substituído pelo modal de entrega) |
| `src/components/tarefas/CommentsPanel.tsx` | usa Linkify no corpo |
| `src/app/(authed)/tarefas/[id]/page.tsx` | label map + Linkify em descrição/obs |
| `src/lib/utils/linkify.tsx` | NOVO |
| `src/components/notificacoes/RuleCard.tsx` | label do novo evento |
| `src/app/(authed)/configuracoes/notificacoes/page.tsx` | label do novo evento |

## Não-objetivos

- Não vamos adicionar campo "anexar link estruturado" em comentários (só auto-link).
- Não vamos renomear o valor `concluida` no enum do Postgres (só o label da UI).
- Não vamos validar formato específico de URL do Drive (`drive.google.com`) — qualquer URL válida passa. Se quiser validar especificamente, abrimos PR depois.
- Não vamos migrar `drive_link` retroativo pra tarefas já concluídas — campo fica NULL pra histórico.
- Não vamos fazer "Postado" passar a ser drag livre — continua restrito ao `canMarkPosted` atual.
