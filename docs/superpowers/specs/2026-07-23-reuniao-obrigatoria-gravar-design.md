# Reunião obrigatória + trava pra gravar (design)

Data: 2026-07-23
Pedido: Yasmin
Status: aguardando aprovação

## Objetivo

Tornar a gravação de reunião um hábito automático, amarrado à agenda: ao marcar
uma reunião, o cliente vira obrigatório e o sistema cobra a gravação com
lembrete → notificação → e, na hora, uma **trava** ("Grave essa reunião agora")
que só sai gravando ou justificando. Liga a agenda ao módulo Reuniões já pronto.

## Decisões (do brainstorm)

1. **O que é "reunião a gravar":** eventos **manuais** nas agendas
   **Assessores**, **Coordenadores** e **Comercial**. Todas as outras (Agência,
   Onboarding, Programação, Videomaker, aniversários, bloqueio, freela) ficam de
   fora — sem cobrança, sem trava.
2. **Cliente obrigatório** ao marcar em **Assessores** e **Coordenadores**;
   **Comercial** é reunião a gravar mas **sem cliente**.
3. **Trava:** aparece pra **quem marcou** o evento. Só sai **gravando** OU
   **justificando** (cancelada / remarcada→nova data / não vou gravar→motivo).
   Justificativa fica registrada pro gestor.
4. **Notificações:** nos 3 momentos — ao marcar, ~10 min antes, e no início.

## Modelo de dados

Novas colunas em `public.calendar_events` (migration manual):
- `requer_gravacao boolean not null default false` — marca o evento como reunião a gravar.
- `gravacao_status text not null default 'pendente'` — `pendente | gravada | justificada`.
- `gravacao_meeting_id uuid references public.meetings(id)` — a gravação criada.
- `gravacao_justificativa text` — motivo quando justificada.
- `gravacao_motivo text` — `cancelada | remarcada | nao_vou_gravar` (categoria).
- `gravacao_resolvido_em timestamptz` — quando saiu de pendente.
- Controle de lembrete idempotente: `lembrete_gravar_criacao_em`,
  `lembrete_gravar_10min_em`, `lembrete_gravar_inicio_em` (timestamptz).

`requer_gravacao` é derivado na criação: `true` quando `origem='manual'` e
`sub_calendar in ('assessores','coordenadores','comercial')`. Cliente obrigatório
quando `sub_calendar in ('assessores','coordenadores')`; comercial sem cliente.

## Fluxo

### Fatia A — Cliente obrigatório + marcar o evento
- No `EventForm` + `createEventSchema`/`createEventAction`: se o evento é "a
  gravar" e `sub_calendar <> 'comercial'`, **cliente é obrigatório** (valida no
  form e na server action; erro claro).
- Ao criar, seta `requer_gravacao=true` e `gravacao_status='pendente'`.
- Notifica quem criou: "Reunião com [cliente] marcada — lembre de gravar."
  (via `dispatchNotification`, com link pro evento.)

### Fatia B — Lembretes (10 min antes + no início)
- Novo detector no cron (reusa o `/api/cron/event-reminders`, que já roda a cada
  5 min): pra eventos `requer_gravacao` e `gravacao_status='pendente'`:
  - 10 min antes do `inicio` → notifica o criador (idempotente via
    `lembrete_gravar_10min_em`).
  - no `inicio` (janela) → notifica o criador (via `lembrete_gravar_inicio_em`).

### Fatia C — A trava ("Gravar agora")
- Componente global (no layout autenticado) que, a cada navegação/carregamento,
  consulta: "há reunião que EU criei, `requer_gravacao`, `gravacao_status =
  pendente`, cujo `inicio` já passou (e é recente — ver janela)?"
  - Se sim, renderiza um **overlay bloqueante** (fixed inset-0, sem fechar):
    *"Grave essa reunião agora — [cliente/título]"* com:
    - **▶ Gravar agora** → abre o `GravadorReuniao` já com o cliente do evento
      (comercial = sem cliente). Ao terminar, cria a `meetings`, vincula
      `gravacao_meeting_id`, seta `gravacao_status='gravada'`, e a trava some.
    - **Justificar ▾** → `cancelada` / `remarcada` (escolhe nova data → move o
      `inicio` do evento e volta a pendente pra nova data) / `nao_vou_gravar`
      (campo obrigatório de motivo). Seta `gravacao_status='justificada'` +
      `gravacao_motivo` + `gravacao_justificativa` + `gravacao_resolvido_em`.
- **Janela de cobrança:** só bloqueia eventos cujo `inicio` está entre agora e
  ~24h atrás (evita, no lançamento, travar por eventos antigos). Pendências mais
  velhas viram só um aviso leve na lista, não bloqueio. (Ajustável.)
- **Comercial (sem cliente):** a gravação cria `meetings` com `client_id = null`
  (fonte `app_recording`); `criarReuniaoGravacaoAction` passa a aceitar
  `clientId` nulo quando o evento é comercial.

### Integração com o módulo Reuniões (já pronto)
- Gravar pela trava usa o mesmo `GravadorReuniao` + `registrar/transcrição/IA`.
- `registrarGravacaoAction` ganha um `calendarEventId?` opcional: quando vem da
  trava, além de registrar a gravação, resolve o evento (`gravada` + link).

## Componentes / arquivos (previsão)
- Migration: `calendar_events` + colunas.
- `src/lib/calendario/schema.ts` + `actions.ts` — validação de cliente + set de
  `requer_gravacao` + notificação de criação.
- `src/lib/calendario/gravacao-cobranca.ts` (novo) — query "minhas pendências de
  gravação a cobrar" + helpers de resolução (gravar/justificar).
- `src/lib/cron/detectors/reuniao-gravar-lembrete.ts` (novo) — 10min + início.
- `src/components/reunioes/TravaGravacao.tsx` (novo, client) — overlay bloqueante,
  colocado no layout autenticado.
- `src/lib/reunioes/gravacao-actions.ts` — `calendarEventId?` + cliente nulo
  (comercial); nova `justificarGravacaoEventoAction`.

## Permissões / segurança
- A trava só aparece pra quem criou o evento. Resolver (gravar/justificar) exige
  ser o criador. Gestão vê as justificativas (relatório simples — fase futura).

## Fora de escopo (agora)
- Relatório/painel de "reuniões não gravadas + justificativas" pro gestor
  (fica pra depois; os dados já ficam registrados).
- Trava pra participantes (só o criador, por decisão).
- Reagendamento inteligente / integração com Google Calendar.

## Plano de entrega (fatias)
- **A** — Cliente obrigatório + `requer_gravacao` + notificação ao criar. (base)
- **B** — Lembretes 10min + início (cron).
- **C** — A trava (overlay) + gravar/justificar + vínculo com a gravação.

## Riscos / pontos a validar
- Conjunto de agendas fechado: Assessores, Coordenadores, Comercial. Internos
  (Agência/Onboarding/Programação) e Videomaker ficam de fora.
- A trava é forte por design; a janela de 24h e o "justificar" evitam virar
  armadilha.
