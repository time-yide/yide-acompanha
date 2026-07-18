# Travar agenda do videomaker ao pegar freela

**Data:** 2026-07-18
**Módulo:** FreelaYide + Calendário/Audiovisual (`src/lib/freela-yide`, `src/lib/calendario`, `src/lib/audiovisual`, `src/components/calendario`).
**Fonte:** código vive em `origin/main` (main local vive atrás — branchar de `origin/main`).

## Contexto

Hoje, pegar um freela com `data_hora` faz ele **aparecer na agenda do próprio** (só do taker), mas **não trava nada**: o coordenador ainda consegue delegar uma gravação por cima, sem aviso. Nenhum dos caminhos de delegação checa freela (nem `validateVideomakerAssignment` nem `delegateVideomakerAction`; este último nem checa o bloqueio de agenda comum). O modelo de freela é single-day (`data_hora timestamptz` + `duracao_min integer`, status `disponivel/pega/em_negociacao/fechada/perdida`, `pego_por`).

Sub-projeto A de dois (o B — freela multi-dia — vem depois e estende este).

## Decisões (brainstorming)

- **Bloqueio total** (erro rígido, sem override) ao delegar gravação num horário que colide com freela pego do videomaker.
- **Freela vira "Indisponível" visível pro time** (o coord passa a ver), mas o **valor** só o dono vê.
- Escopo do bloqueio de time: freelas pegos por **videomaker/fast_midia** (é sobre delegar gravação). Freela de outros cargos continua privado ao taker.
- **Sem migration** — reusa `data_hora`/`duracao_min`/`status`/`pego_por`.

## Parte 1 — Bloqueio total na delegação

**Helper novo** `checarFreelaVideomaker(sb, { videomakerId, inicioUtc, fimUtc })` (em `src/lib/calendario` — junto do `bloqueio-check.ts`, mesmo padrão):
- Busca (service-role) freelas de `pego_por = videomakerId`, `status in ('pega','em_negociacao','fechada')`, `data_hora not null`, `deleted_at is null`, cujo intervalo `[data_hora, data_hora + duracao_min)` **sobreponha** `[inicioUtc, fimUtc)`.
- Retorna a 1ª colisão (`{ titulo, data_hora }`) ou `null`.

**Enforcement (erro rígido, sem override) em:**
1. `validateVideomakerAssignment` (`src/lib/calendario/actions.ts`) — usado por criar/editar evento com videomaker pré-atribuído. Adicionar a checagem de freela como **hard error** (igual ao conflito de calendar_events, não como warning).
2. `delegateVideomakerAction` (`src/lib/audiovisual/coord-actions.ts`) — coord delega da fila. Adicionar a mesma checagem como hard error.

Mensagem: `"{nome} tem um freela reservado nesse horário — não dá pra delegar."`

## Parte 2 — Freela reservado visível pro time

- **Query nova** `listFreelasReservadosNoPeriodo(sb, unitProfileIds, inicioUtc, fimUtc)` em `src/lib/calendario/queries.ts`: freelas com `data_hora` no período, `status in ('pega','em_negociacao','fechada')`, `deleted_at is null`, e `pego_por` **entre os videomakers/fast_midia da unidade** (`unitProfileIds` já filtrado por cargo, ou filtrar por role). Retorna `{ id, titulo, data_hora, duracao_min, status, tipo, valor_comissao, entrega_urgente, pego_por, pego_por_nome }`.
- **Mapper por-espectador** `freelaReservadoToEvents(rows, viewerId)` (estende/complementa `freela-events.ts`): pra cada linha —
  - se `pego_por === viewerId` → evento detalhado "Freela — reservado" (com valor), como hoje (`participantes_ids: [viewerId]`).
  - senão → evento "Indisponível — Freela" com `pego_por_nome` + horário, **sem** `valor_comissao` (bloco tipo bloqueio, sem detalhe financeiro).
- **Calendário** (`src/app/(authed)/calendario/page.tsx`): troca o merge de `listMeusFreelasNoPeriodo(userId,…)` por `listFreelasReservadosNoPeriodo(unitProfileIds,…)` + `freelaReservadoToEvents(rows, userId)`, pra o time todo ver (semana e mês).
- **`EventCell`/`MonthView`**: o ramo `event.freela` já renderiza o bloco emerald "Freela — reservado". Pro caso "não-dono" (sem valor), usar um flag no `freela` (ex.: `reservadoDeOutro: true`) que renderiza "Indisponível — Freela {nome}" sem o R$. (Ajuste pequeno no componente.)

## Casos de borda

- Videomaker sem freela no horário → delegação normal.
- Freela sem `data_hora` → não trava (não tem slot). Mantém o comportamento atual.
- Freela `disponivel`/`perdida` → não trava nem aparece como reservado.
- Editar um evento já atribuído a um videomaker que depois pegou freela: a checagem roda no update — se colidir, erro. (Aceito: o coord ajusta.)
- O `checarFreelaVideomaker` usa janela UTC (mesmo padrão do conflito de calendar_events), não wall-clock — freela e gravação já estão em UTC.

## Testes

- Unit (`checar-freela.test.ts` ou co-locado, vitest `--exclude '**/.claude/**'`): função pura de **sobreposição** de intervalos (freela [ini, ini+dur) × [inicioUtc, fimUtc)) — casos: colide, encosta (fim==início → não colide), sem colisão, freela sem data_hora.
- Mapper `freelaReservadoToEvents`: dono vê valor; outro não vê valor e vê nome.
- Enforcement (actions) verificado por type-check (hit em DB, sem teste de integração).

## Arquivos

- **Novos:** `src/lib/calendario/freela-check.ts` (helper + parte pura testável) + teste.
- **Editados:** `src/lib/calendario/queries.ts` (`listFreelasReservadosNoPeriodo`), `src/lib/calendario/freela-events.ts` (`freelaReservadoToEvents` por-viewer + flag no tipo), `src/lib/calendario/actions.ts` (`validateVideomakerAssignment`), `src/lib/audiovisual/coord-actions.ts` (`delegateVideomakerAction`), `src/app/(authed)/calendario/page.tsx` (merge), `src/components/calendario/EventCell.tsx` (+ `MonthView.tsx` se preciso) (bloco "Indisponível — Freela" sem valor).
- **Sem migration.**

## Fora de escopo

- Freela multi-dia (Sub-projeto B).
- Checagem do **bloqueio de agenda comum** dentro do `delegateVideomakerAction` (gap pré-existente) — registrado como follow-up, não entra aqui.
- Bloquear na direção inversa (impedir pegar freela se já tem gravação) — não pedido.
