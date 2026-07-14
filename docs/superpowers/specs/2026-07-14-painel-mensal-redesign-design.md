# Redesign do Painel Mensal — Design

**Data:** 2026-07-14
**Autor:** Yasmin + Claude
**Página:** `/painel` (aba "Painel Mensal" dentro de Estratégia/Social Media)

## Problema

O Painel Mensal é uma tabela densa de 11 colunas com abreviações sem legenda
(TPG, TPM, GMN, CÂM, MOB, ED, REU) e 98 clientes numa lista só. As duas dores
principais da coordenadora:

1. **Colunas confusas** — siglas sem explicação.
2. **Muita informação junta** — lista gigante, difícil achar o que importa.

Além disso, colunas hoje marcadas **na mão** deveriam refletir **dados reais**
que já existem no sistema.

## Direção validada (via mockups)

Visual **limpo e sóbrio**: sem emoji, quase sem cor. Cor forte só em "atrasado".
Concluído = "✓" neutro; pendente = cinza apagado. Legenda em texto explicando as
siglas. **Sem agrupamento** — a coordenadora usa o **filtro de assessor** que já
existe pra reduzir a lista.

## Mudanças de coluna

Conjunto novo de colunas (na ordem):

`Cliente | Pacote | Crono | TPG | TPM | GMN | Gravação | Edição | Reunião | Drive`

### 1. Design — REMOVIDA
A coluna Design sai do painel (o `DesignCell` deixa de ser renderizado). O passo
`design` e a delegação de design continuam existindo no banco/outros fluxos; só
não aparecem mais como coluna no painel.

### 2. Câmera + Mobile → "Gravação" (auto, contagem)
Uma coluna só. Deixa de ser marcação manual. Mostra:
- **"Gravado · N×"** quando há N gravações concluídas do cliente no mês.
- **"Não gravado"** quando N = 0.

Fonte: `audiovisual_capturas` — `COUNT(*)` por `client_id`, filtrando
`data_captacao` no mês e `concluida_em IS NOT NULL` (só gravações realizadas).
Não distingue tipo de videomaker (mobile não é rastreado à parte hoje). As
colunas `camera`/`mobile` manuais somem da UI.

### 3. Reunião → auto (do calendário, tipo "Assessores")
Deixa de ser marcação manual. Mostra:
- **"Agendada"** se há ≥1 `calendar_events` com **`sub_calendar = 'assessores'`**
  (tipo "Reunião de assessoria") ligado àquele cliente no mês.
- **"Sem reunião"** caso contrário.

Fonte: `calendar_events` — `sub_calendar = 'assessores'` + `client_id` + `inicio`
no mês. Usar o **tipo do evento** (não "quem criou") evita contar gravação
(`videomakers`) ou outros eventos como reunião. **Depende** de os eventos de
assessoria carregarem `client_id` — ver seção "Mudanças no formulário de evento".

### 4. Edição → auto (passou pelo time de edição)
Deixa de ser marcação manual. Mostra:
- **"Editado"** se há ≥1 task `tipo IN ('video','arte')` do cliente no mês que
  chegou em `status IN ('em_aprovacao','aprovada','agendado','postada')`.
- **"Pendente"** caso contrário.

Fonte: `tasks` (já usado hoje em `getDerivedDoneSet`).

## Mudanças no formulário de evento do calendário

Pra Reunião (e Gravação) aparecerem amarradas ao cliente, o formulário
"Novo evento" (`src/components/calendario/EventForm.tsx`) precisa:

1. **Mostrar o seletor de "Cliente" para todos os tipos** (hoje ele já existe,
   mas só aparece quando o tipo é Videomaker). Mover o campo pra seção geral do
   form, de modo que **Assessores** (e os demais) também possam escolher o
   cliente. Schema e insert já aceitam `client_id` — **sem migration**.
2. **Opção "+" de cliente avulso (texto livre)** — quando o cliente não está na
   lista, um "+" abre um campo de texto pra digitar um nome só pra aquele evento.
   Não vira cliente na base e **não entra nas contagens do painel**.
   - Requer **1 coluna nova**: `calendar_events.cliente_avulso text` (nullable).
   - **Migration manual** (Vercel não roda; aplicar no SQL Editor após o merge).

A criação de **captura de gravação** continua manual pelo videomaker (inalterado);
ela já herda o `client_id` do evento vinculado. Nenhuma mudança nesse fluxo.

### Colunas que continuam iguais
`Pacote` (barra de progresso postados/contratados), `Crono` (link do
cronograma), `TPG`/`TPM` (Ativo/Inativo), `GMN` (nota média). `Drive` vira um
link de texto **"Abrir"** (em vez de ícone de pasta), pra manter sem emoji.

### Aplicabilidade por pacote
Mantém a lógica atual (`PACOTE_COLUMNS`): cada tipo de pacote só mostra as
colunas que fazem sentido. Gravação/Edição/Reunião seguem aparecendo em pacotes
audiovisual/estratégia; onde não se aplica, mostra "–".

## Visual / layout

- **Sem emoji.** Paleta neutra (cinza-azulado). Único uso forte de cor: vermelho
  discreto para "atrasado" (no nome do cliente e na célula da etapa atrasada).
- **Legenda em texto** logo abaixo da barra de filtros, explicando as siglas.
- **Filtro de assessor** em destaque na barra do topo (já existe — só ganha
  proeminência visual). Nada de blocos/agrupamento.
- Concluído = "✓" neutro; pendente = cinza apagado; "–" para não se aplica.
- Mais respiro entre linhas; hover sutil.

## Consistência de KPIs e status global

Os cards do topo (Concluídos / Em produção / Atrasados / Sem início) e o status
global por cliente (`global-status.ts`) devem usar a **mesma derivação** das
colunas Gravação/Edição/Reunião (grande parte já vem de `getDerivedDoneSet`).
Ao tornar essas três read-only/derivadas, garantir que o cálculo de status não
dependa mais da marcação manual delas.

## Read-only vs. ação

Gravação, Edição e Reunião passam a ser **informativas (read-only)** — refletem
dados de outros módulos, não se clica pra marcar. Continuam clicáveis/acionáveis:
`Pacote` (editar contagem), `Crono` (add link), `TPG`/`TPM` (toggle), `GMN`
(editar nota), `Drive` (abrir).

## Escopo e fases

Como cresceu, dá pra entregar em fases (cada uma some sozinha):

- **Fase 1 — Painel (visual + colunas derivadas):** view Tabela (`PainelTable` +
  células) e Cards (`PainelCard`) com o novo conjunto de colunas, visual limpo,
  legenda, Drive como texto. Reunião/Gravação/Edição derivadas de dados
  existentes. Não precisa de migration.
- **Fase 2 — Formulário de evento:** mostrar o seletor de Cliente pra todos os
  tipos + "+" avulso. Precisa da migration `cliente_avulso`. É o que faz a
  coluna Reunião ficar precisa daqui pra frente (eventos de assessoria passam a
  carregar o cliente).

**Não inclui:** mudar o modelo do checklist (as colunas viram derivadas na
leitura; não removemos passos do banco); mudar o fluxo de criação de captura.

## Migration

- **Fase 2:** `ALTER TABLE calendar_events ADD COLUMN cliente_avulso text;`
  (nullable). Aplicar manualmente no SQL Editor após o merge.

## Riscos / pontos de atenção

- **Reunião depende do preenchimento:** eventos de assessoria antigos não têm
  `client_id` (o seletor não aparecia pra esse tipo). Até o time começar a
  selecionar o cliente, a coluna mostra "Sem reunião". É esperado — melhora com
  o uso. Por isso a Fase 2 (form) idealmente vem junto/antes.
- **Design removida:** confirmar que nenhum fluxo dependia de delegar design
  *pelo painel* (a delegação existe em outros lugares).
- **KPIs:** revisar `global-status.ts` pra não contar passos manuais que saíram
  da UI.
