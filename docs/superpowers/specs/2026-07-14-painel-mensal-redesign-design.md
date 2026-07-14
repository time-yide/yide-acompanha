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

### 3. Reunião → auto (do calendário, pelo assessor)
Deixa de ser marcação manual. Mostra:
- **"Agendada"** se há ≥1 `calendar_events` do cliente no mês criado por um
  assessor (`criado_por` com `role = 'assessor'`).
- **"Sem reunião"** caso contrário.

Fonte: `calendar_events` — `client_id` + `inicio` no mês + `criado_por` é
assessor. **Ressalva:** o calendário não tem campo "tipo = reunião", então o
sinal é "evento criado pelo assessor pro cliente". É a leitura pretendida.

### 4. Edição → auto (passou pelo time de edição)
Deixa de ser marcação manual. Mostra:
- **"Editado"** se há ≥1 task `tipo IN ('video','arte')` do cliente no mês que
  chegou em `status IN ('em_aprovacao','aprovada','agendado','postada')`.
- **"Pendente"** caso contrário.

Fonte: `tasks` (já usado hoje em `getDerivedDoneSet`).

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

## Escopo

- **Inclui:** view Tabela (`PainelTable` + células) e a view Cards
  (`PainelCard`) espelhando o mesmo conjunto de colunas, pra não divergir.
- **Não inclui:** mudar o modelo de dados do checklist (as colunas viram
  derivadas na leitura; não removemos passos do banco). Sem migration nova
  esperada — tudo lê tabelas existentes (`audiovisual_capturas`,
  `calendar_events`, `tasks`).

## Riscos / pontos de atenção

- **Reunião sem tipo:** aproximação por "assessor criou evento pro cliente".
  Se aparecer falso-positivo (assessor criou outro tipo de evento), reavaliar
  depois (ex.: filtrar `sub_calendar`).
- **Design removida:** confirmar que nenhum fluxo dependia de delegar design
  *pelo painel* (a delegação existe em outros lugares).
- **KPIs:** revisar `global-status.ts` pra não contar passos manuais que saíram
  da UI.
