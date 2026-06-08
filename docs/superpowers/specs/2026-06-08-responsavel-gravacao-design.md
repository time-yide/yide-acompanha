# Escolher o videomaker direto na criação da gravação

**Data:** 2026-06-08
**Status:** Em aprovação (re-brainstorming após descobrir o fluxo real em origin/main)
**Base:** `origin/main` (o main local estava 322 commits atrás — a versão antiga não tinha o fluxo de delegação).

## Problema

Hoje, ao criar uma agenda de gravação (`sub_calendar = "videomakers"`), o evento
**sempre** nasce em `videomaker_status = "pending_delegation"` e é jogado pra fila
`/audiovisual?tab=aguardando_videomaker`. Só então o **coordenador do audiovisual**
delega quem grava (via `DelegarVideomakerDialog` → `delegateVideomakerAction`). Ou
seja: toda gravação obrigatoriamente passa pela mão do coordenador.

A pessoa que cria a gravação quer **escolher o videomaker na hora**, pulando a fila
do coordenador.

## Decisão (brainstorming)

- Na criação da gravação, **escolher o videomaker é obrigatório**.
- Com o videomaker escolhido, o evento **já nasce `scheduled`** (delegado), com
  `videomaker_assigned_id` preenchido — **nunca** cai em `pending_delegation`.
- A lista de escolha são **apenas videomakers ativos** (o sistema exige `role =
  "videomaker"` e `ativo` pra atribuição — é o mesmo conjunto do `DelegarVideomakerDialog`).
- O fluxo do coordenador (delegar/trocar/cancelar/reagendar) **continua existindo**
  para reatribuições; só deixa de ser o único caminho.

## Escopo

> **Sem migration.** As colunas `videomaker_assigned_id`, `videomaker_status`,
> `videomaker_delegado_por`, `videomaker_delegado_em` já existem em `origin/main`
> (usadas por `coord-actions.ts`). Só passamos a setá-las na criação/edição.

### 1. Validação — `src/lib/calendario/schema.ts`
- Adicionar `videomaker_assigned_id: z.string().uuid().optional().nullable()` em
  `baseEventFields`.
- `superRefine` (em `createEventSchema` **e** `editEventSchema`): se
  `sub_calendar === "videomakers"` e `videomaker_assigned_id` ausente → erro
  `"Escolha o videomaker responsável pela gravação"` no path `videomaker_assigned_id`.

### 2. Formulário — `src/components/calendario/EventForm.tsx`
- Nova prop `videomakers: { id: string; nome: string }[]`.
- `videomaker_assigned_id` em `Props.defaults`.
- Estado `videomakerId`.
- Dentro do bloco `isVideomaker` ("Detalhes da gravação"), logo após o header,
  adicionar um `SearchableSelect` **"Videomaker responsável"** (lista `videomakers`),
  com `<input type="hidden" name="videomaker_assigned_id" />` — padrão do campo Cliente.
  Label sem "(opcional)" (é obrigatório; a validação real é no servidor).

### 3. Páginas que renderizam o form
- `src/app/(authed)/calendario/novo/page.tsx` e
  `src/app/(authed)/calendario/[id]/page.tsx`: buscar `listVideomakersAtivos()`
  (de `@/lib/audiovisual/coord-queries`) e passar como prop `videomakers`. Na página
  de edição, passar também `videomaker_assigned_id: event.videomaker_assigned_id ?? null`
  nos `defaults`.

### 4. Helper de validação compartilhado — `src/lib/calendario/actions.ts`
Função interna `validateAndResolveVideomaker(sb, { videomakerId, inicio, fim, excludeEventId })`
que espelha a lógica do `delegateVideomakerAction`:
- Confere `role === "videomaker"` e `ativo`. Senão → erro "Videomaker inválido ou inativo".
- Checa colisão de horário: outro evento `videomakers` + `scheduled` + mesmo
  `videomaker_assigned_id` com overlap (`.lt("inicio", fim).gt("fim", inicio)`),
  ignorando `excludeEventId` quando passado. Em colisão → erro amigável com nome +
  horário (igual ao delegate).
- Retorna `{ error }` ou `{ ok: true, nome }`.

### 5. `createEventAction`
- Ler `videomaker_assigned_id` do formData → schema.
- Quando `sub_calendar === "videomakers"`:
  - Rodar `validateAndResolveVideomaker`. Se erro → retorna o erro.
  - Adicionar o videomaker em `participantes_ids` (sem duplicar).
  - `insertPayload`: `videomaker_assigned_id`, `videomaker_status: "scheduled"`,
    `videomaker_delegado_por: actor.id`, `videomaker_delegado_em: new Date().toISOString()`.
- Catch da exclusion constraint `no_videomaker_overlap` no insert → mensagem amigável
  (defesa em profundidade contra corrida).
- **Redirect:** como agora nasce `scheduled` (não pendente), redirecionar pra
  `/calendario` (e não mais pra `/audiovisual?tab=aguardando_videomaker`). O evento
  aparece direto na agenda.
- Notificação: o videomaker, sendo participante, já recebe a notificação padrão de
  participante (`notifyCalendarParticipants`). Sem código extra de notificação.

### 6. `updateEventAction`
- Ler `videomaker_assigned_id` → schema (obrigatório p/ videomakers via superRefine).
- Se mudou em relação ao `before.videomaker_assigned_id`:
  - Rodar `validateAndResolveVideomaker` com `excludeEventId: id`.
  - Sincronizar `participantes_ids` (remover o videomaker antigo se estava só pela
    atribuição; adicionar o novo), espelhando `updateDelegacaoAction`.
  - `updatePayload`: `videomaker_assigned_id`, `videomaker_status: "scheduled"`,
    `videomaker_delegado_por: actor.id`, `videomaker_delegado_em: now`.
- Se não mudou: persistir o mesmo `videomaker_assigned_id` (mantém o estado).
- Catch da constraint `no_videomaker_overlap` → mensagem amigável.

## O que NÃO muda

- Colunas do banco (já existem) → **sem migration**.
- `queries.ts` / cache key da semana → não tocamos (já resolvem
  `videomaker_assigned_nome`).
- Fluxo do coordenador (`coord-actions.ts`, dialogs) → intacto, só deixa de ser
  obrigatório.
- Mudanças locais não commitadas (videomaker_nomes em EventCell/queries) → ignoradas;
  trabalhamos a partir de `origin/main` num worktree limpo.

## Critérios de aceite

1. Criar gravação sem escolher videomaker → erro de validação, não salva.
2. Criar gravação com videomaker → evento nasce `scheduled`, `videomaker_assigned_id`
   preenchido, videomaker em `participantes_ids`, e **não** aparece em
   "aguardando videomaker"; redireciona pra `/calendario`.
3. Videomaker escolhido (≠ criador) recebe notificação.
4. Escolher videomaker com horário sobreposto a outra captação dele → erro amigável,
   não salva.
5. Editar gravação trocando o videomaker → reatribui, sincroniza participantes,
   notifica o novo; constraint de overlap respeitada.
6. Só perfis com `role = "videomaker"` e ativos aparecem na lista.
7. Tipos de evento não-gravação (agência/assessores/coordenadores) seguem sem exigir
   videomaker.
8. Eventos antigos em `pending_delegation` continuam abrindo; ao editar pelo form,
   passam a exigir um videomaker (resolvendo a pendência).
</content>
