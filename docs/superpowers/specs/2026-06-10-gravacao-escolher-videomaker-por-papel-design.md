# Escolher quem grava na criação da gravação — por papel

**Data:** 2026-06-10
**Status:** Aprovado (brainstorming)
**Base:** `origin/main`

## Problema

Depois de reverter o #503 (PR #506), marcar gravação parou de pedir o videomaker
— toda captação cai na fila do coordenador. Mas quem de fato escolhe quem grava
é o **coordenador audiovisual** (e sócios/adm). Pra esses papéis faz sentido
escolher o videomaker já na criação, em vez de criar e depois delegar em outra
tela. Pros demais (assessor etc.), continua indo pra fila.

Além disso, a seção genérica "Participantes" não faz sentido na gravação — o
"participante" que importa é o videomaker.

## Decisão (brainstorming)

Seletor **"Videomaker responsável"** aparece na gravação **só pra quem pode
delegar** (`canRoleDelegateVideomaker`: `audiovisual_chefe`, `socio`, `adm`).

| Papel | Seletor aparece? | Obrigatório? | Escolheu | Em branco |
|---|---|---|---|---|
| `audiovisual_chefe` (Coordenador audiovisual) | Sim | **Sim** | nasce `scheduled` pra ele | erro (bloqueia) |
| `socio` / `adm` | Sim | Não | nasce `scheduled` pra ele | `pending_delegation` (fila) |
| `assessor` / `coordenador` / outros | Não | — | — | sempre `pending_delegation` |

- A seção genérica **"Participantes" some na gravação** (o videomaker é tratado
  pelo seletor). Demais eventos: continua, rotulada "(opcional)".
- Lista do seletor = **videomakers ativos** (`listVideomakersAtivos`). Ao
  escolher, valida `role=videomaker` + `ativo` + conflito de horário (espelha
  `delegateVideomakerAction`).
- **Servidor é a fonte da verdade:** papéis sem permissão têm o campo ignorado
  (vai pra fila), mesmo que forcem o POST. Obrigatoriedade é checada na action
  (o schema mantém o campo opcional, porque não conhece o papel).

## Arquivos

- `schema.ts` — campo `videomaker_assigned_id` (opcional) + helper
  `comParticipanteVideomaker`.
- `coord-roles.ts` — `isVideomakerObrigatorioParaRole(role)` (`audiovisual_chefe`).
- `EventForm.tsx` — props `videomakers`, `canDelegateVideomaker`,
  `videomakerRequired`; seletor condicional; "Participantes" escondido na
  gravação.
- `calendario/novo/page.tsx` e `calendario/[id]/page.tsx` — buscam
  `listVideomakersAtivos()` (só se pode delegar) e passam as props; edição passa
  `videomaker_assigned_id` nos defaults.
- `actions.ts`:
  - `validateVideomakerAssignment` (papel/ativo + overlap).
  - `createEventAction`: resolve videomaker por papel → `scheduled` ou
    `pending_delegation`; redireciona pra `/calendario` (agendado) ou
    `/audiovisual?tab=aguardando_videomaker` (fila). Fallback de migration +
    catch de `no_videomaker_overlap`.
  - `updateEventAction`: na gravação preserva `participantes_ids` do banco (UI
    escondida) e sincroniza o videomaker; troca/remoção pra quem delega;
    `.select()` + check de 0 linhas (RLS); catch de overlap.
- `tests/unit/calendario-videomaker-delegacao.test.ts` — helper + gating por papel.

## O que NÃO muda

- **Sem migration** — colunas `videomaker_*` já existem.
- Fluxo do coordenador no `/audiovisual` (delegar/trocar) intacto — segue como
  caminho principal de reatribuição.
- `canEdit` da página `[id]` não muda (audiovisual_chefe edita só o que criou;
  reatribuições gerais seguem pelo `/audiovisual`).

## Critérios de aceite

1. Coordenador audiovisual criando gravação **tem** que escolher o videomaker;
   nasce agendado pra ele e vai pra `/calendario`.
2. Sócio/adm: seletor opcional. Escolheu → agendado. Em branco → fila.
3. Assessor/coordenador: sem seletor; sempre fila.
4. Seção "Participantes" não aparece na gravação; editar gravação preserva os
   participantes existentes.
5. Escolher videomaker com horário sobreposto → erro amigável, não salva.
6. Quem não pode delegar não consegue agendar direto nem forçando o POST.
