# Solicitação de bloqueio de agenda (videomaker → coordenador audiovisual)

**Data:** 2026-07-09
**Status:** Aprovado (aguardando plano de implementação)

## Problema

Videomakers não têm como avisar formalmente que estarão indisponíveis num
horário específico (consulta médica, compromisso pessoal etc.). Hoje o
coordenador audiovisual escolhe o videomaker e delega a gravação sem nenhum
sinal de indisponibilidade, então acaba marcando em cima de horários que o
videomaker não pode.

## Objetivo

Permitir que o videomaker **solicite um bloqueio de agenda** (um dia, faixa de
horário, com motivo). A solicitação cai para o **coordenador audiovisual**
(`audiovisual_chefe`) aprovar ou recusar. Uma vez aprovado, o bloqueio:

1. aparece na agenda do videomaker como "Indisponível";
2. **impede (com override)** que o coordenador delegue esse videomaker para uma
   gravação que colida com o horário bloqueado.

## Decisões de escopo (confirmadas com a usuária)

- **Formato:** apenas **1 dia com faixa de horário** (`data`, `hora_inicio`,
  `hora_fim`). Sem dia-inteiro, sem múltiplos dias, sem recorrência. (YAGNI)
- **Efeito da aprovação:** vira evento visível na agenda **E** alerta ao delegar.
- **Impedimento:** **hard block com "confirmar mesmo assim"** — quem é impedido é
  o **coordenador** (é ele quem escolhe o videomaker). Ele pode confirmar assim
  mesmo, porque também é a autoridade que aprovou o bloqueio.
- **Aprovador:** `audiovisual_chefe`; `adm`/`socio` como reserva.

### Não-objetivos (v1)

- Dia-inteiro / férias / períodos de vários dias / recorrência.
- Desmarcar retroativamente gravações já agendadas quando um bloqueio é aprovado
  depois. O aviso só age **no momento de delegar/atribuir** o videomaker.
- Bloqueio automático sem aprovação (todo bloqueio passa pelo coordenador).

## Arquitetura

### 1. Nova tabela `agenda_bloqueios`

```sql
create table public.agenda_bloqueios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),

  -- solicitante (videomaker)
  criado_por uuid not null references public.profiles(id),
  criado_por_nome text not null,        -- snapshot pra exibição

  -- detalhes do bloqueio (1 dia + faixa de horário)
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  motivo text not null,

  -- workflow de aprovação
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'rejeitada')),
  respondido_por uuid references public.profiles(id) on delete set null,
  respondido_em timestamptz,
  motivo_recusa text,                   -- obrigatório quando status='rejeitada'

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id),

  check (hora_fim > hora_inicio)
);

create index idx_agenda_bloqueios_criado_por on public.agenda_bloqueios(criado_por);
create index idx_agenda_bloqueios_status on public.agenda_bloqueios(status);
create index idx_agenda_bloqueios_data on public.agenda_bloqueios(data);
create index idx_agenda_bloqueios_deleted on public.agenda_bloqueios(deleted_at)
  where deleted_at is not null;

create trigger trg_agenda_bloqueios_updated_at
  before update on public.agenda_bloqueios
  for each row execute function public.set_updated_at();
```

**RLS:**

- `select`: `criado_por = auth.uid()` **ou**
  `current_user_role() in ('adm','socio','audiovisual_chefe','coordenador')`.
- `insert`: `criado_por = auth.uid()` (o próprio videomaker cria) **ou**
  `current_user_role() in ('adm','socio')`.
- `update`: `(criado_por = auth.uid() and status = 'pendente')` (dono edita/cancela
  enquanto pendente) **ou** `current_user_role() in ('audiovisual_chefe','adm','socio')`
  (aprova/recusa). Mesmo predicado em `with check`.
- `delete`: reservado — soft delete via `deleted_at` no app; RLS de delete físico
  só `('adm','socio')`.

> ⚠️ Migration aplicada **manualmente** no SQL Editor após o merge (convenção do
> projeto — Vercel não roda migrations).

### 2. Camada de dados

- `src/lib/audiovisual/bloqueios/schema.ts` — Zod:
  - `createBloqueioSchema` (`data`, `hora_inicio`, `hora_fim`, `motivo` obrigatórios;
    valida `hora_fim > hora_inicio`).
  - `rejeitarBloqueioSchema` (`id`, `motivo_recusa` obrigatório).
- `src/lib/audiovisual/bloqueios/queries.ts`:
  - `listMeusBloqueios(userId)` — os do videomaker logado.
  - `listBloqueiosPendentes()` — fila do coordenador.
  - `listBloqueiosAprovadosNaData(videomakerId, data)` — usado na checagem de colisão.
- `src/lib/audiovisual/bloqueios/actions.ts`:
  - `solicitarBloqueioAction` — videomaker cria (status `pendente`) → notifica coordenadores.
  - `aprovarBloqueioAction` — `audiovisual_chefe`/adm/socio → status `aprovada` → notifica videomaker.
  - `rejeitarBloqueioAction` — idem, exige `motivo_recusa` → status `rejeitada` → notifica videomaker.
  - `cancelarBloqueioAction` — dono cancela o próprio pendente (soft delete).

### 3. Integração com a delegação de videomaker

Ponto único: `validateVideomakerAssignment` em `src/lib/calendario/actions.ts`
(hoje já barra dupla-marcação). Chamado por `createEventAction` (linha ~183) e
`updateEventAction` (linha ~353).

- Estender a assinatura com `data`/hora e um flag `ignorarBloqueio?: boolean`.
- Após a checagem de dupla-marcação, buscar bloqueios **aprovados** do videomaker
  que colidam com `[inicioUtc, fimUtc]` (mesma data + sobreposição de horário,
  respeitando `APP_TIMEZONE`).
- Se colidir e `ignorarBloqueio` for falso, retornar um sinal distinto de erro
  comum — ex.: `{ blockWarning: "Fulano tem bloqueio aprovado das 14:00 às 15:00 (consulta médica)" }`.
- `createEventAction`/`updateEventAction` propagam esse sinal como um resultado
  especial (ex.: `{ blockWarning }`) em vez de erro fatal.
- O form de evento, ao receber `blockWarning`, mostra o alerta e um botão
  **"Confirmar mesmo assim"** que reenvia com o campo oculto `ignorar_bloqueio=true`.

Segue o padrão já usado em tarefas (`requiresDelivery`): a action devolve um
sinal, a UI decide.

### 4. UI

Tudo dentro do módulo **/audiovisual** (videomaker e `audiovisual_chefe` já têm
acesso). Sem novo item de navegação.

- **Videomaker:**
  - Botão **"Solicitar bloqueio de agenda"** → modal (`data`, `hora_inicio`,
    `hora_fim`, `motivo`).
  - Lista **"Meus bloqueios"** com status (pendente/aprovada/rejeitada; recusa
    mostra o motivo). Botão **"Cancelar"** nos pendentes.
- **Coordenador (`audiovisual_chefe`):**
  - Seção **"Solicitações de bloqueio"** com os pendentes → **Aprovar** / **Recusar**
    (recusar abre campo de motivo). Histórico dos já respondidos.
- **Agenda:** bloqueios aprovados aparecem no calendário interno (sub-agenda
  videomakers) como marcador **"🔒 Indisponível — {motivo}"**. Renderizados a
  partir de `agenda_bloqueios` (não viram linhas em `calendar_events`, pra evitar
  os CHECK constraints de eventos de gravação).

### 5. Notificações

Novos `notification_event`:

- `bloqueio_agenda_solicitado` — disparado em `solicitarBloqueioAction`;
  destinatários = `getCoordenadoresAudiovisualIds()` (+ regra padrão para
  `audiovisual_chefe`). Link → `/audiovisual` (seção de solicitações).
- `bloqueio_agenda_respondido` — disparado em aprovar/rejeitar; destinatário = o
  videomaker solicitante. Mensagem varia (aprovado / recusado + motivo).

Seed em `notification_rules` (mesma migration da tabela ou uma adjacente).

## Fluxo de dados

```
Videomaker → solicitarBloqueioAction → INSERT agenda_bloqueios (pendente)
                                     → dispatchNotification(bloqueio_agenda_solicitado → coordenadores)

Coordenador → aprovar/rejeitarBloqueioAction → UPDATE status + respondido_por/em
                                             → dispatchNotification(bloqueio_agenda_respondido → videomaker)

Coordenador cria/edita gravação com videomaker
   → validateVideomakerAssignment (dupla-marcação + colisão com bloqueio aprovado)
   → se colisão: { blockWarning } → UI mostra "Confirmar mesmo assim"
   → reenvio com ignorar_bloqueio=true → salva
```

## Tratamento de erros / casos de borda

- `hora_fim <= hora_inicio` → bloqueado no Zod e no CHECK.
- Recusar sem motivo → erro de validação.
- Videomaker tentando aprovar/recusar → barrado por RLS + checagem de role na action.
- Bloqueio aprovado depois de gravação já marcada → sem efeito retroativo (não-objetivo).
- Coordenador confirmando "mesmo assim" → grava normalmente; nenhum registro extra
  (a gravação simplesmente é criada; o bloqueio continua aprovado e visível).
- RLS silenciosa em UPDATE (padrão conhecido do projeto): as actions checam role
  explicitamente e usam `.select()` pós-update pra detectar 0 linhas quando fizer sentido.

## Testes

- **Unit (vitest):**
  - `validateVideomakerAssignment`: colisão com bloqueio aprovado → `blockWarning`;
    com `ignorarBloqueio=true` → passa; sem colisão → passa; bloqueio de outro
    videomaker/dia não afeta; bloqueio pendente/rejeitado não bloqueia.
  - actions: solicitar cria pendente + notifica; aprovar/rejeitar muda status +
    notifica; rejeitar sem motivo falha; cancelar só o próprio pendente.
- **Schema:** validações de horário e motivo.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/2026XXXX_agenda_bloqueios.sql` | nova tabela + RLS + notif rules (apply manual) |
| `src/lib/audiovisual/bloqueios/schema.ts` | novo |
| `src/lib/audiovisual/bloqueios/queries.ts` | novo |
| `src/lib/audiovisual/bloqueios/actions.ts` | novo |
| `src/lib/calendario/actions.ts` | `validateVideomakerAssignment` + create/update event: checagem de bloqueio + override |
| `src/lib/notificacoes/*` | novos evento_tipo |
| `src/app/(authed)/audiovisual/page.tsx` + componentes | UI videomaker + coordenador |
| componentes do calendário interno | render de "Indisponível" |
| `tests/unit/*` | cobertura |
```
