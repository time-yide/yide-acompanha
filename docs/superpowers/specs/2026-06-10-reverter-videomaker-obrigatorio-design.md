# Reverter: gravação volta a cair na fila do coordenador

**Data:** 2026-06-10
**Status:** Aprovado (brainstorming)
**Base:** `origin/main` (HEAD `c5431a5`, #505)

## Problema

O PR #503 (commit `8f8ba90`, "escolher o videomaker na criação da gravação")
tornou **obrigatório** escolher o videomaker no formulário ao marcar uma
gravação (`sub_calendar = "videomakers"`). Com isso, o evento nasce já
`scheduled`/delegado e pula o coordenador.

A pessoa que agenda (assessor etc.) não quer ser obrigada a dizer quem grava.
O desejado é o fluxo **anterior ao #503**: só agendar a gravação e deixar que o
**coordenador do audiovisual** delegue quem vai gravar.

## Decisão (brainstorming)

- **Tirar de vez** a escolha de videomaker na criação/edição (não é "opcional"
  — é remover o campo). Toda gravação volta a nascer `pending_delegation` e cai
  na fila `/audiovisual?tab=aguardando_videomaker`.
- **Revert puro** do #503 via `git revert 8f8ba90` — inclui apagar os docs do
  #503 (spec + plano), coerente com desfazer a feature.
- **Sem teste novo** — antes do #503 não havia esse teste; o fluxo do
  coordenador já é coberto por `coord-actions`.
- **Observação pro coordenador (opcional):** reaproveita o campo existente
  `observacoes_gravacao`, que já é opcional e já é exibido ao coordenador na
  fila de delegação (`AguardandoVideomakerAba`). Só ajustamos a redação no form
  pra deixar claro que serve de recado pra escolha: rótulo "Observações pro
  coordenador (opcional)", placeholder com exemplo de sugestão de videomaker e
  um texto de ajuda. Sem campo novo e sem migration.

## Abordagem: `git revert 8f8ba90`

Nenhum commit posterior tocou os arquivos do #503, então o revert aplica limpo
(verificado). É mais seguro e completo que edição cirúrgica arquivo a arquivo.

Volta ao estado pré-#503:

1. **`EventForm.tsx`** — some o campo "Videomaker responsável", a prop
   `videomakers`, o estado `videomakerId` e o default.
2. **`schema.ts`** — sai `videomaker_assigned_id` do schema, o `refineVideomaker`
   (obrigatoriedade) e o helper `comParticipanteVideomaker` (sem outros
   consumidores).
3. **`actions.ts`** — `createEventAction` volta a inserir `videomaker_status:
   "pending_delegation"`, restaura o fallback de migration e o redirect pra
   `/audiovisual?tab=aguardando_videomaker&novo=<id>`. `updateEventAction` volta
   a não mexer em videomaker. Some `validateVideomakerAssignment`.
4. **Páginas** `calendario/novo/page.tsx` e `calendario/[id]/page.tsx` — removem
   `listVideomakersAtivos()` e a prop `videomakers`.
5. **Teste** `tests/unit/calendario-videomaker-criacao.test.ts` — removido.
6. **Docs** spec + plano do #503 — removidos.

## O que NÃO muda

- **Fluxo do coordenador** (`coord-actions.ts`, dialogs de delegar/trocar, fila
  "aguardando videomaker") — nunca foi tocado pelo #503; volta a ser o único
  caminho de atribuição.
- **`listVideomakersAtivos`** (em `coord-queries.ts`) — usada por outras telas
  do audiovisual; permanece.
- **Sem migration.** As colunas `videomaker_assigned_id`, `videomaker_status`,
  `videomaker_delegado_por`, `videomaker_delegado_em` continuam existindo.
- **Dados existentes:** gravações criadas entre 08 e 10/06 que nasceram
  `scheduled` com videomaker continuam válidas e agendadas; o revert só muda o
  comportamento das **novas**. Sem limpeza de dados.

## Critérios de aceite

0. O campo "Observações pro coordenador (opcional)" aparece no form e o
   coordenador continua lendo o conteúdo na fila de delegação.
1. Marcar gravação **não** pede mais videomaker (campo some do form).
2. Gravação criada nasce `pending_delegation` e aparece em
   `/audiovisual?tab=aguardando_videomaker`; redireciona pra lá.
3. Coordenador consegue delegar normalmente (fluxo intacto).
4. Editar uma gravação não exige nem mexe em videomaker.
5. `type-check` + `lint` + testes passam (o teste do #503 deixa de existir).
