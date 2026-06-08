# 14 Batidas — Cadência Comercial (Rua + Ligação)

**Data:** 2026-06-07
**Status:** Aprovado (aguardando review do spec)

## Problema

O comercial — tanto de **rua** quanto de **ligação** — precisa tentar contato com cada
prospecto **até 14 vezes** ("14 batidas") antes de desistir. Hoje não existe nada no sistema
que cobre, conte ou mostre esse progresso, nem que force o comercial a registrar **como foi
cada tentativa**. O resultado é que prospectos são abandonados cedo demais e não há histórico
estruturado da cadência.

## Objetivo

Uma estrutura de **cadência de 14 batidas** que:

- Conta as tentativas de contato de **saída** por prospecto, somando os dois mundos
  (Comercial Rua + Comercial Ligação) num único contador.
- Mostra o progresso **X/14** de cada prospecto numa **tela nova dedicada**.
- Deixa o comercial **registrar como foi cada batida** (canal + resultado + observação),
  num **drawer** sem sair da tela.
- **Para de cobrar** quando o prospecto converte (agenda reunião / avança de etapa).
- Na **14ª batida sem sucesso**, avisa que esgotou e oferece **descartar / marcar perdido**.

## Decisões de produto (fechadas no brainstorm)

| Tema | Decisão |
|---|---|
| Tipo de cadência | **Contador livre** de 14 — comercial escolhe o canal de cada batida; sistema conta e cobra. |
| Escopo | **Fluxo unificado**: a cadência segue o prospecto de `leads_gerados` (topo do funil) até `leads` (Onboarding), somando tudo. |
| O que conta como batida | Só tentativas de **saída**. `sem_resposta` / ligação não atendida **contam**. Ligações de **entrada** aparecem na timeline mas **não contam**. |
| Visita conta? | **Sim** — a visita é a **batida #1** (presencial) do(s) prospecto(s) que ela gerou. |
| Fim do ciclo | Converteu/agendou em qualquer batida → **sucesso**, para de cobrar. Chegou a 14 sem sucesso → **esgotou**, sugere descartar. |
| Tela | **Item próprio no menu** ("14 Batidas"), visão geral de todos os prospectos em cadência. |
| Registro | **Direto na tela** (drawer ao clicar no prospecto). |
| Log de batida p/ `leads_gerados` | **Estender `lead_attempts`** pra aceitar `lead_gerado_id` (não criar tabela nova). |

## Modelo de entidades (identidade do "prospecto")

Um **prospecto** (sujeito da cadência) é uma entidade do mundo real que pode estar
representada por **uma ou duas linhas**:

- Uma linha em **`leads_gerados`** — topo do funil. Vem do **Gerador de Leads**
  (`fonte` outscraper/apify/manual → canal *ligação*) ou de uma **Visita**
  (`fonte='visita'`, `visita_id` preenchido → canal *rua*).
- E/ou uma linha em **`leads`** (Onboarding), com `canal` ('rua'|'ligacao') e `stage`.

O vínculo entre os dois é **`leads_gerados.lead_onboarding_id → leads.id`**.

Casos de identidade:

1. **Só `leads_gerados`** (ainda não entrou no Onboarding) → identidade = esse lead gerado.
2. **`leads_gerados` ligado a `leads`** → identidade abrange os dois; batidas somadas.
3. **Só `leads` de Onboarding** (criado direto no Onboarding, sem lead gerado) → identidade = esse lead.

Canal do prospecto (pra badge/filtro):
`rua` se `leads.canal='rua'` **ou** `leads_gerados.fonte='visita'`; senão `ligacao`.

## Regras de contagem (uma batida = uma tentativa de saída)

Fontes de batida, todas somadas dentro do grupo de identidade:

1. **`lead_attempts`** (estendida) — **toda** linha conta 1 batida, qualquer canal/resultado
   (inclusive `sem_resposta`). Liga-se ao prospecto via `lead_id` **ou** `lead_gerado_id`.
2. **`ligacoes`** — conta 1 batida por chamada com `direcao='saida'` e `arquivado_em is null`,
   ligada via `lead_id` **ou** `lead_gerado_id`. Chamadas de **entrada** entram na timeline
   mas **não contam**.
3. **`visitas`** — cada visita conta **1 batida presencial** para cada `leads_gerados` que ela
   gerou (`leads_gerados.visita_id`). É a "batida #1" da rua.

`total_batidas` = soma das três fontes no grupo de identidade.
`ultima_batida` = data máxima entre as fontes.

### Sucesso (encerra a cadência — para de cobrar)

`tem_sucesso = true` se **qualquer** uma:

- `leads_gerados.status` em (`reuniao_marcada`, `proposta_enviada`, `cliente`); **ou**
- `leads.stage` além de prospecção: (`reuniao_comercial`, `proposta_enviada`, `contrato`,
  `marco_zero`, `ativo`); **ou**
- alguma `lead_attempts.resultado = 'agendou'`.

### Descartado / fora de cadência

- `leads_gerados.status = 'descartado'` ou `arquivado_em` preenchido; **ou**
- `leads.motivo_perdido` preenchido.

### Esgotou (14ª sem sucesso)

`esgotou = total_batidas >= BATIDAS_META && !tem_sucesso && !descartado`.

### Em cadência (entra na lista por padrão)

Não convertido, não descartado, e (se `leads_gerados`) `status` em
(`novo`, `em_contato`, `qualificado`); (se `leads`) `stage` em (`leads_potencial`, `leads_ativos`).

## Arquitetura

### Migrations (aplicação **manual** via SQL Editor, como o resto do projeto)

**M1 — estender `lead_attempts` (aditiva):**

```sql
alter table public.lead_attempts
  alter column lead_id drop not null;

alter table public.lead_attempts
  add column lead_gerado_id uuid references public.leads_gerados(id) on delete cascade;

-- exatamente um alvo preenchido
alter table public.lead_attempts
  add constraint lead_attempts_target_chk
  check ((lead_id is not null)::int + (lead_gerado_id is not null)::int = 1);

create index idx_lead_attempts_lead_gerado
  on public.lead_attempts(lead_gerado_id, created_at desc)
  where lead_gerado_id is not null;
```

RLS de `lead_attempts` é baseada em `autor_id` (não em `lead_id`) — confirmado nas policies
existentes (`with check (autor_id = auth.uid())`). Tornar `lead_id` nullable e adicionar
`lead_gerado_id` **não quebra** nenhuma policy. Linhas existentes mantêm `lead_id`.

**M2 — view read-only da cadência:**

Uma view `v_prospecto_cadencia` (ou função RPC, decidir no plano) que resolve a identidade e
agrega as três fontes por prospecto, retornando uma linha por prospecto em cadência com:
`prospecto_key`, `lead_gerado_id`, `lead_id`, `organization_id`, `nome`, `canal`,
`responsavel_id`, `total_batidas`, `ultima_batida`, `tem_sucesso`, `descartado`, `status_cadencia`.

A view é consultada via **service-role dentro de `unstable_cache`** (padrão do projeto). O
filtro por organização e por responsável (papel) é feito na **app-layer** (igual
`comercial-queries.ts`), não dentro da view.

### Backend — `src/lib/batidas/`

- **`config.ts`** — `BATIDAS_META = 14`; conjuntos de status de sucesso/descarte; helpers
  `isSucesso()`, `isEsgotou()`, `canalDoProspecto()`.
- **`queries.ts`**
  - `getProspectosEmCadencia(filtros)` — lê a view via service-role + `unstable_cache`
    (tag `"batidas"`); filtra por org + responsável (comercial vê os seus; adm/sócio veem
    todos), por canal e por status (em cadência por padrão; toggle pra ver convertidos/esgotados).
  - `getBatidasTimeline(prospecto)` — junta `lead_attempts` (lead_id/lead_gerado_id) +
    `ligacoes` (saída e entrada) + `visitas` (do grupo), ordena por data, numera as batidas
    que contam, marca **entrada** como "não conta" e a **visita** como origem presencial.
- **`actions.ts`**
  - `registrarBatidaAction(formData)` — grava em `lead_attempts` com `lead_id` **ou**
    `lead_gerado_id` (schema estendido a partir de `addAttemptSchema`), `autor_id = auth.uid()`;
    `revalidateTag("batidas", "default")`.
  - `descartarProspectoAction(formData)` — se `leads_gerados`: `status='descartado'`;
    se `leads`: reusa `marcarPerdidoAction`. `revalidateTag("batidas", "default")`.
- **Invalidação cruzada:** adicionar `revalidateTag("batidas", "default")` nas actions que já
  gravam tentativa/ligação/visita (`prospeccao/actions.addLeadAttemptAction`,
  `ligacoes/actions`, `visitas/actions`) pra a contagem refletir na hora.

### Frontend

- **Rota** `src/app/(authed)/batidas/page.tsx`.
- **Menu** `src/components/layout/nav-config.ts` — novo link top-level **"14 Batidas"**
  (ícone Target/Crosshair), roles `["adm","socio","comercial","coordenador","assessor"]`.
- **`src/components/batidas/`**
  - **`ProspectosCadenciaTable`** — uma linha por prospecto: nome (empresa/contato),
    **badge de canal** (Rua/Ligação), responsável, **barra de progresso X/14**, última batida
    (+ "parado há N dias"), **badge de status** (em cadência / 🎉 convertido / ⚠️ esgotou).
    Filtros: canal, responsável, mostrar convertidos/esgotados. Ordenação: nº de batidas,
    mais parado.
  - **`BatidaDrawer`** — abre ao clicar na linha: topo com barra **X/14**; **timeline
    unificada numerada** (ícone por canal, resultado/status, observação, autor, data; entrada
    marcada "não conta"; visita marcada como origem/presencial); form **"Registrar batida"**
    (canal, resultado, observação, próximo passo). Em `esgotou`: alerta **"Esgotou as 14
    batidas"** + botão **Descartar/Marcar perdido**. Em `tem_sucesso`: banner 🎉.

### Permissões / escopo

Padrão atual: escopo por `organization_id`; comercial vê prospectos onde ele é responsável
(`leads_gerados.responsavel_id` / `leads.comercial_id`), adm/sócio/coordenador veem todos.
View consultada via service-role; filtro de papel na app-layer.

## Testes

`tests/unit/batidas.test.ts` cobrindo a lógica pura de contagem/identidade:

- saída conta, entrada não conta, `sem_resposta` conta;
- visita conta como 1 batida presencial do(s) lead(s) gerado(s);
- detecção de sucesso (status de `leads_gerados`, `stage` de `leads`, `resultado='agendou'`);
- `esgotou` aos 14;
- merge de identidade: batidas de um `leads_gerados` + do `leads` ligado somam no mesmo prospecto.

## Restrições de execução

- Trabalho feito na branch **`feat/14-batidas-cadencia`** (worktree a partir de `origin/main`).
  O `main` local está ~319 commits atrás e nem tem o módulo Ligações/Visitas.
- **Migrations manuais**: aplicar M1 e M2 via SQL Editor do Supabase após o merge do PR.
- **Cache**: `unstable_cache` **só com service-role** (nunca client com cookies). Se mudar o
  shape de algum dado cacheado, **bumpar a key no mesmo PR**.

## Fora de escopo (YAGNI)

- Disparar o discador Zenvia direto do drawer (foi descartado no brainstorm — registro é por
  formulário; ligações reais entram automático pelo módulo Ligações).
- Meta de batidas configurável por organização (constante `14` por enquanto).
- Cadência por cliente já fechado (a cadência é de aquisição, encerra ao converter).
- Sequência fixa/playbook de canais por batida (escolhido "contador livre").
