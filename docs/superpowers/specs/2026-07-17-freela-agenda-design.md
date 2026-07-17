# Freela na agenda de quem pegou — Design

**Data:** 2026-07-17
**Branch:** `feat/freela-agenda`
**Módulos tocados:** FreelaYide (`src/lib/freela-yide`, `src/components/freela-yide`), Calendário (`src/lib/calendario`, `src/components/calendario`), Notificações (`src/lib/notificacoes`).

## Problema

Quando uma oportunidade do FreelaYide é criada e alguém do time **pega**, essa pessoa
não tem nenhuma reserva do horário na própria agenda. Ela pode marcar outra coisa em
cima. Queremos que, ao pegar um freela com horário definido, ele apareça na agenda
**dela** bloqueando aquele slot, com visual próprio (dá pra bater o olho e ver que é
freela, diferente de gravação e de bloqueio de videomaker), e que ela receba uma
notificação confirmando a reserva.

## Restrição de partida

Hoje `freela_oportunidades.horario` é **texto livre** (ex.: `"20/06 às 14h"`). Isso não
dá pra posicionar num slot de agenda de forma confiável. Precisamos de data+hora
estruturada.

## Decisões (validadas com a usuária)

1. **Data+hora estruturada, em todos os tipos** (captação/modelo/edição). Campo opcional.
   Só oportunidades com data+hora preenchida entram na agenda.
2. **Aparece só na agenda de quem pegou** (`pego_por`), não na agenda geral do time.
3. **Visual próprio, sem emoji** — bloco esmeralda (cor-tema do Freela), ícone lucide
   discreto (`Briefcase`), etiqueta "Freela — reservado" + horário. Edição urgente ganha
   o pontinho laranja já usado no padrão de urgência.
4. **Notificação ao pegar** — confirma pra própria pessoa que o horário foi reservado.
5. **Fechada continua aparecendo** naquele dia (registro histórico); **perdida some** da
   agenda. `disponivel` (ainda não pega) nunca aparece.

## Arquitetura

### 1. Dado: `data_hora` + `duracao_min`

Migration nova adiciona a `freela_oportunidades`:

```sql
alter table public.freela_oportunidades
  add column if not exists data_hora   timestamptz,
  add column if not exists duracao_min integer not null default 60;
```

- `data_hora` (nullable): instante de início, em UTC (mesma convenção de
  `prazo_entrega`). Fonte única do slot na agenda.
- `duracao_min` (default 60): tamanho do bloco, pra calcular o `fim`.

Índice parcial pra a query da agenda (busca por dono + janela de tempo):

```sql
create index if not exists freela_op_agenda_idx
  on public.freela_oportunidades (pego_por, data_hora)
  where data_hora is not null and deleted_at is null;
```

Migration é **manual** (aplicar via SQL Editor após merge — Vercel não roda migrations).

### 2. Schema + form

- `criarOportunidadeSchema` (em `src/lib/freela-yide/schema.ts`) ganha:
  - `data_hora`: string `datetime-local` (`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$`),
    opcional/nullable — mesmo padrão do `prazo_entrega`.
  - `duracao_min`: `z.coerce.number().int().min(15).max(600).default(60)`.
- Na action (`criar`/`editar`), converter `data_hora` de wall-clock Cuiabá pra ISO UTC
  com `brtInputToUtcIso` antes de gravar (helper já existe em
  `src/lib/calendario/timezone.ts`).
- `OportunidadeFormFields.tsx`: adicionar campo **Data e hora** (`datetime-local`,
  opcional, default via `utcIsoToBrtInputValue`) + campo **Duração (min)** ao lado.
  Vale para todos os tipos (fora do bloco de urgência, que continua só em edição).
- O campo texto **Horário** continua existindo pra não quebrar dados já cadastrados.

### 3. Fonte nova no calendário

`CalendarEvent.origem` ganha o valor `"freela"`. Em `src/lib/calendario/queries.ts`,
dentro de `_listEventsForWeekImpl`, adicionar a 6ª fonte:

- Query (via **service-role**, exigência do `unstable_cache` neste projeto):
  `freela_oportunidades` onde `pego_por = userId`, `data_hora` entre `weekStart`/`weekEnd`,
  `status not in ('disponivel','perdida')`, `deleted_at is null`.
- Mapear cada linha pra `CalendarEvent`:
  - `origem: "freela"`, `sub_calendar: "videomakers"` (ou um valor neutro — ver nota),
  - `inicio = data_hora`, `fim = data_hora + duracao_min`,
  - `titulo = titulo`, `link: "/freela-yide"`,
  - novo campo `freela` no `CalendarEvent` com `{ status, tipo, valor_comissao, urgente }`
    pra o `EventCell` renderizar o tratamento próprio (análogo ao objeto `bloqueio`).
- **Cache**: bumpar a key do `unstable_cache` de `listEventsForWeek` no mesmo PR (o shape
  do retorno mudou).

> Nota `sub_calendar`: o tipo `SubCalendar` é fechado. Como o freela é renderizado por
> um ramo dedicado no `EventCell` (via `event.freela`, igual ao `event.bloqueio`), o
> valor de `sub_calendar` não afeta a cor. Usar `"videomakers"` só pra satisfazer o tipo,
> ou (preferível) marcar como opcional/relaxar — decisão fica pro plano de implementação.

### 4. Visual (`EventCell.tsx`)

Novo ramo no topo do componente, análogo ao `if (event.bloqueio)`:

```tsx
if (event.freela) {
  // bloco esmeralda, borda-esquerda grossa, ícone <Briefcase/>,
  // "Freela — reservado" + formatBrtTime(inicio)
  // se event.freela.urgente → pontinho laranja
  // link pra /freela-yide
}
```

Classe base (light/dark, seguindo o padrão do arquivo):
`bg-emerald-100 text-emerald-950 dark:bg-emerald-500/20 dark:text-emerald-100 border-l-4 border-emerald-500 ring-1 ring-emerald-500/30`.
Sem emoji — só o ícone lucide `Briefcase` e texto.

### 5. Notificação ao pegar

- Migration: `alter type public.notification_event add value if not exists 'freela_reservada';`
  (evento novo) + seed em `notification_rules` (`ativo=true`, `mandatory=false`,
  `email_default=false`, `default_roles=[]` — é notificação pro próprio ator via
  `user_ids_extras`).
- Em `pegarOportunidadeAction` (`src/lib/freela-yide/actions.ts`), **após** o update com
  sucesso e **apenas se** `data_hora` estiver preenchido, chamar `dispatchNotification`:
  - `evento_tipo: "freela_reservada"`, `user_ids_extras: [actor.id]`,
  - título/mensagem: `"Você reservou {titulo} na sua agenda"` / `"{dia} às {hora}"`,
  - `link: "/calendario"`.
- Buscar `titulo`/`data_hora` no mesmo select da action (hoje seleciona só
  `status, pego_por`).

## Fluxo

```
Admin/sócio cria oportunidade (com data+hora)
        │
Pessoa do time clica "Pegar"  → pegarOportunidadeAction
        │  status=pega, pego_por=ela, pego_em=now
        │  (se data_hora) dispatchNotification(freela_reservada, [ela])
        ▼
/calendario dela  → listEventsForWeek inclui a 6ª fonte
        ▼
EventCell renderiza bloco esmeralda "Freela — reservado" no slot data_hora..+duracao
```

## O que NÃO entra (YAGNI)

- Parsing do texto livre `horario` (substituído pelo campo estruturado).
- Detecção de conflito/overbooking com outros eventos (só mostra o bloco; não impede
  marcar em cima — pode ser um follow-up).
- Aparecer na agenda de admin/coordenador ou em agenda compartilhada.
- E-mail/push dedicado além do in-app (rule já nasce só in-app).

## Testes

- Unit: mapeamento oportunidade→`CalendarEvent` (início/fim/urgente, filtro de status,
  filtro `data_hora is null`).
- Unit: `normalizeUrgencia` intacto; conversão `data_hora` BRT→UTC nos boundaries.
- Type-check + lint (o projeto pula teste manual de UI e vai direto pro PR).

## Migrations manuais (ordem)

1. `..._freela_data_hora.sql` (colunas + índice)
2. `..._notification_event_freela_reservada.sql` (add enum value — precisa vir antes do seed)
3. `..._notification_rules_freela_reservada_seed.sql` (seed da rule)
