# Briefing & confirmação de gravação — design

**Data:** 2026-05-27
**Branch alvo:** `feat/briefing-gravacao`

## Problema

Hoje o evento de gravação em `/calendario` tem só um campo `link_roteiro` (URL). O videomaker abre o evento, vê o link, e... ninguém sabe se ele realmente abriu, leu, muito menos se imprimiu pra levar pro cliente. Resultado recorrente: videomaker chega na gravação sem ter lido o roteiro (improvisa, perde tempo no set) e sem o impresso (fica olhando celular na frente do cliente — imagem ruim). A nota `rating_execucao_roteiro` só existe **depois** da gravação, ou seja, não previne nada.

## Objetivo

Garantir que o videomaker designado pra uma gravação:
1. **Tenha lido o roteiro** antes de sair pra rodar
2. **Tenha imprimido** o roteiro + um briefing com dados da gravação (cliente, endereço, horário, observações)

Combinando **honor system** (checkboxes com timestamp), **atrito útil** (endereço/Maps bloqueados até confirmar leitura, botão dedicado pra gerar folha de impressão) e **cobrança escalonada** (notificações 24h/3h/2h antes da gravação pra videomaker, assessor que criou e coordenador audiovisual).

## Não-objetivo

- Renderizar o conteúdo do roteiro dentro do app (continua externo: link Google Docs OU PDF)
- Forçar scroll / quiz de leitura (roteiro é externo, só dá pra usar honor system + bloqueio de endereço)
- Concatenar PDF do roteiro com a capa do briefing num único arquivo (fica como Fase 2)
- Notificação por email/WhatsApp — só in-app por enquanto (módulo `/notificacoes` que já existe)
- Dashboard dedicado de "gravações pendentes" — badge no `/calendario` resolve
- Aplicar este fluxo pra eventos que **não** são gravação (`sub_calendar != 'videomakers'`)
- Substituir o `rating_execucao_roteiro` (continua existindo, mede outra coisa)

## Escopo

Aplica-se **somente** a eventos com `sub_calendar = 'videomakers'`. Eventos de outras agendas (agência, comercial, etc.) não mudam.

## Decisões de produto (consolidadas no brainstorming)

| Decisão | Escolha |
|---|---|
| Roteiro: link e PDF coexistem? | **Não, exclusivo** (toggle "Link / PDF") |
| Mecanismo de impressão | **Botão "Gerar folha pra imprimir"** abre página print-friendly com capa do briefing + link/botão pro roteiro. Registra timestamp ao clicar. Videomaker confirma checkbox "Imprimi" depois. |
| Bloqueio | Endereço, Maps e observações da gravação ficam ocultos até `videomaker_leu_em` ser preenchido |
| Cobrança | Notificações in-app escalonadas (24h, 3h, 2h) |
| Alerta de 2h | **Obrigatório:** assessor que criou o evento + `audiovisual_chefe`. **Opt-in:** adm/sócio (toggle em `/configuracoes`) |
| Quem pode marcar checkboxes | Videomaker designado; adm/sócio/`audiovisual_chefe` podem marcar em nome dele (com log) |
| Evento sem roteiro anexado | Endereço NÃO fica bloqueado (não é culpa do videomaker). Notificação extra pra produção 24h antes alertando que falta o roteiro. |
| Tipo de arquivo PDF | `application/pdf` apenas, máx 10MB |

## Arquitetura

### Reuso

| Componente | Origem | Como usa |
|-----------|--------|---------|
| `events` table | já existe | Adiciona colunas de roteiro_tipo, timestamps de check e idempotência de notif |
| `events.link_roteiro` | já existe | Continua como URL quando `roteiro_tipo='link'`; vira nullable junto com `roteiro_pdf_path` |
| `events.sub_calendar='videomakers'` | já existe | Filtro pra aplicar toda a lógica nova |
| `EventForm` | `src/components/calendario/EventForm.tsx` | Modifica o campo de roteiro pra virar toggle Link/PDF |
| Card "Detalhes da gravação" | `src/app/(authed)/calendario/[id]/page.tsx` | Reescreve com bloqueio + checkboxes + botão briefing |
| Módulo `/notificacoes` | já existe | Cria notificações novas com tipo `gravacao_pendente` |
| Vercel cron | `src/app/api/cron/*` (segue padrão do Instagram snapshots) | Novo endpoint roda de 5 em 5 minutos |
| Supabase Storage | já configurado | Novo bucket `roteiros` privado |
| `profiles` table | já existe | Adiciona toggle de opt-in pra alerta 2h |
| Página `/configuracoes` | já existe | Adiciona seção "Notificações" com o toggle |
| `EventCell` (badge no calendário) | `src/components/calendario/EventCell.tsx` | Adiciona indicador 🔴/🟡/🟢 quando é gravação |

### Novo

```
src/
├── lib/briefing-gravacao/
│   ├── tipos.ts               # RoteiroTipo, StatusBriefing, CheckRecord
│   ├── status.ts              # computaStatus(event) → 'sem_roteiro' | 'pendente' | 'pronto'
│   ├── permissions.ts         # podeMarcarCheck(user, event), podeUploadRoteiro(user)
│   ├── storage.ts             # SERVER-ONLY. uploadRoteiroPdf, getSignedUrl, deleteRoteiroPdf
│   ├── queries.ts             # listGravacoesPendentes(janela), getBriefingData(eventId)
│   └── actions.ts             # marcarLeuAction, marcarImprimiuAction, registrarBriefingGeradoAction, uploadRoteiroPdfAction
│
├── app/(authed)/calendario/[id]/
│   ├── briefing/page.tsx      # Página print-friendly da capa do briefing
│   └── page.tsx               # MODIFICAR: bloqueio + checkboxes + botão briefing
│
├── app/api/cron/gravacoes-pendentes/route.ts   # Cron 5min: dispara notif 24h/3h/2h
│
├── components/calendario/
│   ├── EventForm.tsx                          # MODIFICAR: toggle Link/PDF
│   ├── RoteiroToggle.tsx                      # NOVO: toggle + upload + preview
│   ├── BriefingChecklist.tsx                  # NOVO: 2 checkboxes + botão "Gerar folha"
│   └── EventCell.tsx                          # MODIFICAR: badge 🔴🟡🟢
│
├── components/briefing/
│   └── BriefingPrintView.tsx                  # NOVO: layout print-friendly (capa+QR+link)
│
└── app/(authed)/configuracoes/
    └── NotificacoesSection.tsx                # NOVO: toggle opt-in alerta 2h

supabase/migrations/
└── 20260527000000_briefing_gravacao.sql
```

### Diagrama de dados

```
events
  ├── roteiro_tipo          'link' | 'pdf' | NULL
  ├── link_roteiro           text NULL  (preenchido quando tipo='link')
  ├── roteiro_pdf_path       text NULL  (path no bucket 'roteiros' quando tipo='pdf')
  │
  ├── videomaker_leu_em             timestamptz NULL
  ├── briefing_gerado_em            timestamptz NULL
  ├── videomaker_imprimiu_em        timestamptz NULL
  ├── confirmacao_marcada_por       uuid NULL → profiles.id
  │                                  (quem marcou; se ≠ videomaker designado, é override)
  │
  ├── notif_24h_enviada_em          timestamptz NULL    (idempotência)
  ├── notif_3h_enviada_em           timestamptz NULL
  ├── notif_2h_alert_enviada_em     timestamptz NULL
  └── notif_sem_roteiro_enviada_em  timestamptz NULL

profiles
  └── notif_alerta_gravacao_pendente boolean DEFAULT true

storage bucket 'roteiros' (privado)
  └── eventos/<event_id>/<uuid>.pdf
```

## Schema (migração SQL)

```sql
-- 1. Roteiro tipado
ALTER TABLE events
  ADD COLUMN roteiro_tipo text CHECK (roteiro_tipo IN ('link','pdf')),
  ADD COLUMN roteiro_pdf_path text;

-- Backfill: eventos existentes com link_roteiro preenchido viram tipo='link'
UPDATE events SET roteiro_tipo='link'
  WHERE link_roteiro IS NOT NULL AND link_roteiro <> '';

-- Garante consistência: se tipo='pdf', path obrigatório; se tipo='link', link obrigatório
ALTER TABLE events ADD CONSTRAINT events_roteiro_consistencia CHECK (
  roteiro_tipo IS NULL
  OR (roteiro_tipo='link' AND link_roteiro IS NOT NULL AND link_roteiro <> '')
  OR (roteiro_tipo='pdf'  AND roteiro_pdf_path IS NOT NULL)
);

-- 2. Timestamps de confirmação
ALTER TABLE events
  ADD COLUMN videomaker_leu_em       timestamptz,
  ADD COLUMN briefing_gerado_em      timestamptz,
  ADD COLUMN videomaker_imprimiu_em  timestamptz,
  ADD COLUMN confirmacao_marcada_por uuid REFERENCES profiles(id);

-- 3. Idempotência de notificações
ALTER TABLE events
  ADD COLUMN notif_24h_enviada_em         timestamptz,
  ADD COLUMN notif_3h_enviada_em          timestamptz,
  ADD COLUMN notif_2h_alert_enviada_em    timestamptz,
  ADD COLUMN notif_sem_roteiro_enviada_em timestamptz;

-- 4. Opt-in pra adm/sócio
ALTER TABLE profiles
  ADD COLUMN notif_alerta_gravacao_pendente boolean DEFAULT true;

-- 5. Bucket de storage
INSERT INTO storage.buckets (id, name, public) VALUES ('roteiros','roteiros', false)
  ON CONFLICT DO NOTHING;

-- RLS bucket: upload por roles autorizadas
CREATE POLICY "roteiros_upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'roteiros' AND
    (SELECT role FROM profiles WHERE id = auth.uid())
      IN ('assessor','coordenador','audiovisual_chefe','adm','socio')
  );

-- RLS bucket: leitura pelo videomaker designado + roles acima
-- (videomaker designado = participantes_ids contém auth.uid() no evento dono do path)
CREATE POLICY "roteiros_read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'roteiros' AND (
      (SELECT role FROM profiles WHERE id = auth.uid())
        IN ('assessor','coordenador','audiovisual_chefe','adm','socio')
      OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.roteiro_pdf_path = storage.objects.name
          AND auth.uid() = ANY(e.participantes_ids)
      )
    )
  );

CREATE POLICY "roteiros_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'roteiros' AND
    (SELECT role FROM profiles WHERE id = auth.uid())
      IN ('assessor','coordenador','audiovisual_chefe','adm','socio')
  );
```

## Fluxos

### Fluxo 1: Assessor anexa roteiro

1. Assessor abre `/calendario/novo` ou `/calendario/[id]` (modo edit)
2. No `EventForm`, escolhe `sub_calendar = videomakers`
3. Aparece o componente `RoteiroToggle`:
   - Radio "Link" (default) / "PDF"
   - Se Link: campo URL (igual hoje)
   - Se PDF: input file `accept="application/pdf"`, máx 10MB, mostra nome do arquivo após upload
4. Submit chama `updateEventAction` que valida (Zod): se `roteiro_tipo='pdf'`, faz upload via `uploadRoteiroPdfAction` antes de salvar `roteiro_pdf_path`
5. Trocar de tipo (link→pdf ou vice-versa): limpa o campo anterior e remove PDF antigo do storage se houver

### Fluxo 2: Videomaker abre o evento

1. Videomaker designado abre `/calendario/[id]`
2. Renderiza card "Detalhes da gravação" com lógica condicional:
   - **Sem roteiro anexado**: mostra endereço + Maps + observações normalmente. Banner amarelo: *"Aguardando produção anexar o roteiro."* Sem checkboxes.
   - **Roteiro anexado, ainda não leu**: endereço/Maps/observações OCULTOS atrás de placeholder cinza. Bloco roxo: *"Leia o roteiro antes de ver os detalhes da gravação."* + botão grande **"Abrir roteiro"** (abre link/PDF em nova aba E chama `marcarLeuAction` que registra `videomaker_leu_em = now()`)
   - **Já leu, ainda não imprimiu**: tudo visível. Banner verde: *"Leitura confirmada."* Bloco "Próximo passo: gerar e imprimir a folha":
     - Botão **"Gerar folha pra imprimir"** → abre `/calendario/[id]/briefing` em nova aba + chama `registrarBriefingGeradoAction` (timestamp)
     - Checkbox **"Imprimi o roteiro + briefing"** → chama `marcarImprimiuAction`
   - **Leu + imprimiu**: tudo visível. Banner verde discreto: *"Pronto pra gravar ✅"*
3. Há também um link "Eu já tinha lido antes" que marca `videomaker_leu_em` sem abrir o roteiro (cobre casos legítimos onde leu pelo Drive)

### Fluxo 3: Página de briefing pra imprimir

URL: `/calendario/[id]/briefing`. Renderiza HTML otimizado pra impressão (A4, margens definidas via `@page` CSS):

```
┌──────────────────────────────────────────────┐
│  BRIEFING DE GRAVAÇÃO                        │
│  ──────────────────────────                  │
│                                              │
│  Cliente:       Dr. Eduardo Silva (Dentista) │
│  Data/Hora:     27/05/2026, 14:00 — 16:00    │
│  Endereço:      R. das Flores, 123, Cuiabá   │
│                                              │
│  [QR CODE Maps]    ← scaneia, abre rota      │
│                                              │
│  ─── OBSERVAÇÕES DA GRAVAÇÃO ───             │
│  Cliente prefere luz natural. Levar          │
│  rebatedor branco. Trazer adesivo do logo.   │
│                                              │
│  ─── ROTEIRO ───                             │
│  [Botão grande "Abrir roteiro"]              │
│  (na impressão vira: "Acesse: <url-curta>")  │
│                                              │
│  Gerado em 26/05/2026 18:42 por João Videomaker
└──────────────────────────────────────────────┘
```

- Estilo `@media print` esconde header/sidebar do app
- QR code do Maps gerado server-side como SVG via pacote `qrcode` (npm), inline no HTML (sem chamada externa — funciona offline e na impressão)
- Botão "Imprimir" no topo aciona `window.print()`
- Acesso: videomaker designado + assessor que criou + coordenador/audiovisual_chefe/adm/sócio

### Fluxo 4: Cron de notificações

`/api/cron/gravacoes-pendentes` roda de 5 em 5 min (Vercel cron). Lógica:

```pseudo
agora = now()
eventos = SELECT * FROM events
  WHERE sub_calendar='videomakers'
    AND inicio > agora
    AND inicio < agora + interval '25 hours'  -- buffer pra pegar 24h

para cada evento:
  videomaker_ids = participantes_ids (filtrando só role=videomaker)
  pronto = evento.videomaker_leu_em IS NOT NULL
        AND evento.videomaker_imprimiu_em IS NOT NULL

  # Notif 24h: videomaker se pendente
  se (inicio - agora) entre 23h55m e 24h05m
     E notif_24h_enviada_em IS NULL
     E NOT pronto:
       criar notif tipo='gravacao_pendente_24h' pra cada videomaker_id
       UPDATE events SET notif_24h_enviada_em = agora

  # Notif 3h: videomaker se pendente
  se (inicio - agora) entre 2h55m e 3h05m
     E notif_3h_enviada_em IS NULL
     E NOT pronto:
       criar notif pros videomaker_ids
       UPDATE

  # Notif 2h alerta: assessor + audiovisual_chefe + (adm/sócio opt-in)
  se (inicio - agora) entre 1h55m e 2h05m
     E notif_2h_alert_enviada_em IS NULL
     E NOT pronto:
       destinatarios = [evento.criado_por se role=assessor]
                     + [todos com role=audiovisual_chefe]
                     + [todos com role IN ('adm','socio') E notif_alerta_gravacao_pendente=true]
       criar notif tipo='gravacao_alerta_2h' pra cada
       UPDATE

  # Notif sem roteiro 24h: produção
  se (inicio - agora) entre 23h55m e 24h05m
     E notif_sem_roteiro_enviada_em IS NULL
     E evento.roteiro_tipo IS NULL:
       destinatarios = [evento.criado_por] + [todos com role=audiovisual_chefe]
       criar notif tipo='gravacao_sem_roteiro'
       UPDATE
```

Cada notificação leva `link='/calendario/{id}'` pra ação rápida.

### Fluxo 5: Sócio/adm desliga alerta 2h

1. Vai em `/configuracoes`
2. Seção "Notificações" nova
3. Toggle: *"Receber alerta quando faltam 2h pra gravação e videomaker ainda não confirmou"* (default ligado)
4. Salva via server action → `UPDATE profiles SET notif_alerta_gravacao_pendente=...`
5. Para roles **assessor** e **audiovisual_chefe** o toggle não aparece (recebem obrigatoriamente)

### Fluxo 6: Status visível pra produção

No `EventCell.tsx` (cada cartão de evento na grade do calendário), quando `sub_calendar='videomakers'`:

- 🔴 **Sem roteiro** — `roteiro_tipo IS NULL`
- 🟡 **Pendente** — roteiro anexado mas (`videomaker_leu_em IS NULL` OR `videomaker_imprimiu_em IS NULL`)
- 🟢 **Pronto** — `videomaker_leu_em IS NOT NULL` AND `videomaker_imprimiu_em IS NOT NULL`

Badge pequeno no canto do card. Tooltip com texto curto.

Status calculado por função pura `computaStatus(event)` em `lib/briefing-gravacao/status.ts` pra reuso entre EventCell, badge no detalhe e cron.

## Permissões

| Ação | Roles permitidas |
|---|---|
| Anexar/trocar roteiro (link ou PDF) | assessor, coordenador, audiovisual_chefe, adm, sócio |
| Marcar "li o roteiro" / "imprimi" | videomaker designado (participantes_ids), OU audiovisual_chefe/adm/sócio em nome dele |
| Acessar página `/briefing` | qualquer um com acesso ao evento (designado + criador + roles produção/adm) |
| Download PDF do roteiro | mesmo critério do briefing |
| Receber alerta 2h | assessor criador + audiovisual_chefe (obrigatório); adm/sócio (opt-in) |
| Configurar opt-in 2h | adm, sócio (campo invisível pras outras roles) |

## Validação (Zod)

`src/lib/calendario/schema.ts` (ou novo arquivo `lib/briefing-gravacao/schema.ts`):

```ts
const roteiroSchema = z.discriminatedUnion("roteiro_tipo", [
  z.object({
    roteiro_tipo: z.literal("link"),
    link_roteiro: z.string().url().min(1),
    roteiro_pdf_path: z.null().optional(),
  }),
  z.object({
    roteiro_tipo: z.literal("pdf"),
    roteiro_pdf_path: z.string().min(1),
    link_roteiro: z.null().optional(),
  }),
  z.object({
    roteiro_tipo: z.null(),
    link_roteiro: z.null().optional(),
    roteiro_pdf_path: z.null().optional(),
  }),
]);
```

Upload PDF valida `mimetype='application/pdf'` e `size <= 10*1024*1024`.

## Edge cases

| Caso | Comportamento |
|---|---|
| Videomaker designado tardiamente (ex: 1h antes) | Nenhuma notif 24h/3h fica retroativa. Notif 2h dispara se passar pela janela. Cron usa `inicio - agora` no momento atual; quem foi adicionado tarde não recebe notifs passadas. |
| Trocar de link pra PDF (ou vice-versa) depois que videomaker já leu | Mantém `videomaker_leu_em`/`imprimiu_em` (não invalida). Banner discreto: *"Roteiro foi atualizado em <data>. Confira se ainda está válido."* + botão "Marcar como precisa reler" que limpa os timestamps. |
| Evento marcado como pronto, depois cancelado/movido | Sem efeito — timestamps continuam. Se mudou data pra MAIS de 24h no futuro, limpa `notif_*_enviada_em` pra disparar de novo. |
| Múltiplos videomakers no mesmo evento | Flags ficam no evento (não por videomaker). Quem marcar primeiro libera pra todos. Trade-off do MVP — caso raro hoje; se virar problema vira Fase 4. |
| Evento sem participantes_ids (videomaker não designado ainda) | Sem notif 24h/3h (não há destinatário). Notif "sem roteiro" pra produção continua valendo. |
| Cron falha (Vercel down) | Próxima execução pega o que faltou — janela 23h55m–24h05m é estreita, mas se passar, simplesmente não envia (idempotência via timestamp). Tradeoff aceito (não vale a pena fila retry pra notificação não-crítica). |
| Storage indisponível ao gerar signed URL pra abrir PDF | Mostra erro inline com botão "tentar de novo". `marcarLeuAction` SÓ é chamado após sucesso da abertura. |

## Testing

Foco em testes de unidade pra lógica pura + alguns de integração:

- `computaStatus(event)` — 4 casos: sem roteiro, leu+imprimiu, só leu, nem leu
- `schema.roteiroSchema` — validação dos 3 ramos do discriminated union, rejeição de inputs inválidos
- `permissions.podeMarcarCheck` — combinações role × designado × override
- Cron endpoint — mock de `now()`, asserções: cria notif certa, marca idempotência, não duplica
- Server actions — `marcarLeuAction` (autorização, idempotência), `uploadRoteiroPdfAction` (validação MIME/tamanho)

Sem teste E2E na primeira iteração (UI será verificada manualmente em PR review).

## Migration de dados existentes

Eventos com `link_roteiro` preenchido viram `roteiro_tipo='link'` automático no migration (já incluído no SQL). Eventos passados não recebem timestamps de leitura/impressão (ficam `NULL` — apareceriam como 🔴/🟡 mas como `inicio < now()` o cron os ignora). Badge no calendário pode filtrar pra mostrar status só em eventos futuros.

## Não-regressão importante

- `link_roteiro` continua existindo e funcionando como antes — código que lê o campo direto não quebra
- `rating_execucao_roteiro` (audiovisual/avaliação pós-gravação) **não** se conecta com esses novos timestamps — são métricas separadas
- Cron diário do Instagram (já existe) segue o mesmo padrão de pasta; novo cron não conflita

## Roadmap futuro (fora deste PR)

- **Fase 2 — PDF concatenado**: gerar PDF único com capa do briefing + roteiro embed (quando roteiro for PDF). Requer biblioteca server-side de manipulação PDF.
- **Fase 3 — Email/WhatsApp**: integrar Resend (já no stack) pra reforço por email. WhatsApp via Twilio futuramente.
- **Fase 4 — Confirmação por videomaker individual**: hoje os flags são do evento; futuro: por videomaker designado.
- **Fase 5 — Métricas**: dashboard com "% de gravações entregues prontas no prazo" por videomaker pra integrar no `/painel`.
