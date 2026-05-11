# Dashboard Audiovisual — Revamp

**Data:** 2026-05-11
**Status:** Em design
**Autor:** Yasmin (via Claude Code)

## Contexto

O dashboard do coordenador audiovisual (`DashboardAudiovisualChefe`) e a seção "Tarefas pendentes" (presente em todos os dashboards) têm 3 problemas operacionais:

1. **"Tarefas pendentes" mostra tudo** que não é `concluida` — inclui `em_aprovacao`, `aprovada`, `agendado`, `postada`, que já saíram do trabalho operacional. Gera confusão sobre o que realmente precisa de ação.
2. **Contadores da Visão da Equipe não refletem a operação real:**
   - "Próximas gravações" pega 2 semanas inteiras (incluindo dias da semana atual que já passaram) — mistura passado e futuro.
   - "Concluídas no período" do videomaker conta `tasks.status = "concluida"`, mas videomaker quase não tem tasks — número fica sempre 0 ou desatualizado.
3. **Não há visão consolidada da produção audiovisual recente** — quem coordena precisa olhar várias telas pra saber o que entregou nos últimos dias e em que pé tá cada entrega.

## Objetivo

Deixar o dashboard reflexo fiel da operação audiovisual:

- "Pendentes" mostra só ação operacional real.
- Visão da equipe separa "vai acontecer", "tá acontecendo agora" e "concluído" — pra videomakers e editores.
- Painel novo de captações recentes consolidado pra gestão.
- Estados intermediários (gravou mas não entregou; entregou mas não foi delegada) ganham abas próprias no `/audiovisual` em vez de poluir os contadores.

## Escopo

Dividido em **4 PRs sequenciais contra `main`** (cada um independente):

- **PR 1** — Filtro de pendentes (status: `aberta` + `em_andamento` + `alteracao`)
- **PR 2** — Reestruturação Videomakers + Editores (Próximas / Hoje / Concluídas)
- **PR 3** — Painel Audiovisual novo (captações últimos 3 dias)
- **PR 4** — Abas em `/audiovisual` (Pendente de entrega, Pendente de delegação)

## Padrões mantidos

- Server components com `unstable_cache` + tags
- Service-role client dentro do cache (sem context de cookie)
- Tags: `dashboard`, `tasks`, `calendar`, `AUDIOVISUAL_CAPTURAS_TAG`, `AUDIOVISUAL_PENDENTE_TAG`
- Dialogs do shadcn (componentes existentes)
- `next/cache` revalidate de 60s + invalidação via `revalidateTag` nas mutations
- Lock gate de captação atrasada continua existindo separadamente (sem mudanças)

---

## PR 1 — Filtro de Pendentes

### Mudança

Em 3 lugares, o filtro de "pendentes" passa a ser exclusivamente: `aberta`, `em_andamento`, `alteracao`. Todos os outros statuses (`em_aprovacao`, `aprovada`, `concluida`, `agendado`, `postada`) saem.

### Visibilidade

Mantém comportamento atual:
- Cada usuário vê só as próprias em `MinhasTarefasPendentes`
- Coordenador/assessor têm visão de equipe já existente em outras telas

### Arquivos

**`src/lib/dashboard/personal.ts`** — função `_getMinhasTarefasPendentesImpl`:

```diff
- .neq("status", "concluida")
+ .in("status", ["aberta", "em_andamento", "alteracao"])
```

**`src/lib/dashboard/audiovisual.ts`** — dentro de `_getEquipeAudiovisualImpl`, na construção de `pendentesList` por editor:

```diff
- t.status !== "concluida" &&
+ ["aberta", "em_andamento", "alteracao"].includes(t.status) &&
  (t.atribuido_a === p.id || (t.participantes_ids ?? []).includes(p.id))
```

**`src/components/dashboard/audiovisual/MemberDetailDialog.tsx`** — adicionar label faltando no `STATUS_LABEL`:

```diff
const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
+ alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  aprovada: "Aprovada",
  postada: "Postada",
};
```

### Test plan

- Videomaker logado → "Tarefas pendentes" só com status `aberta`/`em_andamento`/`alteracao` próprios
- Audiovisual_chefe → coluna "Pendentes" e dialog batem com soma visível dos statuses permitidos
- Tarefa em `em_aprovacao`/`aprovada`/`concluida`/`agendado`/`postada` **não** aparece em nenhum lugar

### Risco

Baixo. Mudança pontual em 2 arquivos + 1 label.

### Nota de sequência

O label `alteracao: "Alteração"` adicionado em `MemberDetailDialog.tsx` será reescrito junto com toda a estrutura do dialog no PR 2 — mas precisa existir no PR 1 enquanto o dialog ainda tiver shape antigo, senão a UI exibe "alteracao" literal pro status filtrado.

---

## PR 2 — Reestruturação Videomakers + Editores

### Mudança

Tabela de "Visão da equipe" ganha estrutura nova:

- **Videomakers:** colunas `Próximas` / `Hoje` / `Concluídas`
- **Editores:** colunas `Próximas` / `Em andamento` / `Concluídas`

Dialog detalhe por membro mostra 3 seções com listas dentro.

### Definições

**Videomaker:**
- **Próximas** = `calendar_events` com `sub_calendar='videomakers'`, `participantes_ids` contém o id, `inicio > fim-de-hoje-BRT` (janela: até 2 semanas à frente)
- **Hoje** = mesmo, mas `inicio` entre `00:00 BRT` e `23:59 BRT` de hoje (mostra todas, mesmo que a hora já tenha passado)
- **Concluídas** = `audiovisual_capturas` onde `videomaker_id = p.id` AND `task_id IS NOT NULL` (já delegada pra edição). **Anchor temporal:** `created_at` da captura está dentro do período. (`created_at` é proxy de "quando delegou" — o coord delega quase imediatamente após o videomaker entregar; não há coluna `delegated_at`. Aceito como tradeoff: numa janela de período (semana/mês), a diferença é desprezível.)

**Editor:**
- **Próximas** = tasks com `status = "aberta"` onde `atribuido_a = p.id` ou `participantes_ids` contém
- **Em andamento** = tasks com `status IN ("em_andamento", "alteracao")` mesma regra de pertença
- **Concluídas** = tasks com `status IN ("concluida", "em_aprovacao", "aprovada", "agendado", "postada")` mesma regra de pertença. **Anchor temporal** (qual coluna usar pra checar "no período"):
  - `concluida` → `completed_at`
  - `aprovada` → `aprovada_em ?? completed_at`
  - `postada` → `completed_at ?? aprovada_em`
  - `em_aprovacao` / `agendado` → `updated_at` (não há coluna específica)
  - Helper: `getTerminadoEm(task)` retorna o primeiro dos campos acima que não for null.

### Tipos novos em `audiovisual.ts`

```ts
export interface CapturaItem {
  id: string;
  data_captacao: string;
  cliente_nome: string | null;
  task_titulo: string | null;
}

export interface VideomakerStat {
  id: string;
  nome: string;
  proximas: number;
  hoje: number;
  concluidas: number;
  proximasList: GravacaoItem[];
  hojeList: GravacaoItem[];
  concluidasList: CapturaItem[];
}

export interface EditorStat {
  id: string;
  nome: string;
  role: string;
  proximas: number;
  emAndamento: number;
  concluidas: number;
  proximasList: TaskItem[];
  emAndamentoList: TaskItem[];
  concluidasList: TaskItem[];
}

export interface EquipeAudiovisual {
  videomakers: VideomakerStat[];
  editores: EditorStat[];
  agregados: {
    totalGravacoesProximas: number;  // próximas + hoje (videomakers)
    totalEmAndamentoEdicao: number;  // em_andamento + alteracao (editores)
    totalConcluidasNoPeriodo: number; // capturas delegadas + tasks concluídas+ no período
  };
}
```

### Helper de datas

```ts
function getHojeAndFuturoBRT(weeksAhead = 2): {
  hojeFromIso: string;
  hojeToIso: string;
  futuroFromIso: string;  // = hojeToIso (exclusivo no hoje, inclusivo daqui)
  futuroToIso: string;
}
```

Considera offset BRT = UTC-3.

### Query — adicionar ao Promise.all existente

Uma query nova: capturas delegadas dos videomakers no período. Junta-se ao `Promise.all` atual.

```ts
supabase
  .from("audiovisual_capturas")
  .select("id, videomaker_id, data_captacao, created_at, task_id, client_id, cliente:clients(nome), task:tasks!task_id(titulo)")
  .in("videomaker_id", videomakerIds)
  .not("task_id", "is", null)
  .gte("created_at", periodoFrom)
  .lt("created_at", periodoTo)
```

Para "Concluídas" do editor, a query de tasks já busca `completed_at`; precisará selecionar também `aprovada_em` e `updated_at` pra usar com `getTerminadoEm`.

### Cache

- Bump da key: `dashboard-audiovisual-equipe-v3` (mudou shape)
- Tags: `["dashboard", "tasks", "calendar", AUDIOVISUAL_CAPTURAS_TAG]`

### UI — `EquipeAudiovisualSection.tsx`

3 cards de agregado (continuam):
- "Próximas gravações" (próximas + hoje)
- "Em andamento (edição)" (em_andamento + alteracao dos editores)
- "Concluídas no período" (capturas delegadas + tasks concluídas+ no período)

Tabela Videomakers: `| Nome | Próximas | Hoje | Concluídas |`

Tabela Editores: `| Nome | Função | Próximas | Em andamento | Concluídas |`

### UI — `MemberDetailDialog.tsx`

Em vez de uma lista única, 3 seções dentro do scrollable:

**Videomaker:**
1. 📅 Próximas — lista de gravações futuras (clique → /calendario)
2. ⚡ Hoje — gravações de hoje
3. ✅ Concluídas no período — capturas delegadas (clique → /tarefas/<task_id>)

**Editor:**
1. 📋 Próximas (`aberta`) — clique → /tarefas/<id>
2. ⚙️ Em andamento (`em_andamento` + `alteracao`)
3. ✅ Concluídas no período

Cada seção tem contagem no header e é escondida se vazia.

### Test plan

- Videomaker com gravação amanhã + gravação hoje 9h + captura delegada essa semana → 1 / 1 / 1
- Editor com 2 tasks abertas + 1 em andamento + 1 alteracao + 3 concluídas no mês → 2 / 2 / 3
- Mudar status de task → revalida em ≤60s (ou imediato via tag)
- Dialog mostra listas corretas e empty states quando vazio
- Filtro de período (`semana_atual`, `mes_atual`, etc.) afeta "Concluídas" mas não "Próximas"/"Hoje"

### Risco

Médio. Reescreve `_getEquipeAudiovisualImpl` (shape novo) + UI das tabelas + dialog. Bump de cache key força invalidação no deploy.

---

## PR 3 — Painel Audiovisual

### Mudança

Painel novo no dashboard mostrando captações dos últimos 3 dias (pela `data_captacao`) com cliente, responsável, quantidade e status atual.

### Visibilidade

Visível em 5 dashboards:
- `DashboardAudiovisualChefe`
- `DashboardCoord`
- `DashboardAssessor`
- `DashboardAdm`
- `DashboardSocioAdm`

Mesmo componente em todos. Sem filtro por usuário — visão consolidada.

### Data layer — `src/lib/dashboard/audiovisual-painel.ts` (novo)

```ts
export interface CapturaPainelRow {
  id: string;
  data_captacao: string;
  cliente_nome: string;
  videomaker_nome: string;
  qtd_videos: number;
  qtd_fotos: number;
  statusAtual: "Concluída" | "Em edição" | "Aguardando delegação";
  statusDetalhe: string | null;  // ex.: "Em andamento" quando statusAtual="Em edição"
  taskId: string | null;
}

export async function getPainelAudiovisual(): Promise<CapturaPainelRow[]> { ... }
```

**Query:**

```ts
supabase
  .from("audiovisual_capturas")
  .select(`
    id, data_captacao, qtd_videos, qtd_fotos, concluida_em, task_id,
    cliente:clients(nome),
    videomaker:profiles!audiovisual_capturas_videomaker_id_fkey(nome),
    task:tasks!task_id(status)
  `)
  .gte("data_captacao", threeDaysAgoIso)
  .order("data_captacao", { ascending: false })
```

`threeDaysAgoIso` = início do dia 3 dias atrás em BRT (incluindo hoje, então pega 4 datas: hoje, ontem, anteontem, antes-de-anteontem).

### Status derivado

```ts
if (row.concluida_em) {
  statusAtual = "Concluída";
  statusDetalhe = null;
} else if (row.task?.status === "postada") {
  statusAtual = "Concluída";
  statusDetalhe = null;
} else if (row.task) {
  statusAtual = "Em edição";
  statusDetalhe = STATUS_LABEL[row.task.status] ?? row.task.status;
} else {
  statusAtual = "Aguardando delegação";
  statusDetalhe = null;
}
```

### Cache

`unstable_cache` com revalidate 60s, key `"dashboard-audiovisual-painel-v1"`, tags `["dashboard", AUDIOVISUAL_CAPTURAS_TAG, "tasks"]`.

### UI — `PainelAudiovisualSection.tsx` (novo)

```
┌─ 📺 Audiovisual ─ Últimos 3 dias ──────────────────────────┐
│  N captações · X vídeos · Y fotos                          │
├────────────────────────────────────────────────────────────┤
│  Data    Cliente    Responsável  Quantidade        Status  │
│  10/05   Cliente A  Pedro         3v · 5f          🟡 Em edição: Em andamento
│  09/05   Cliente B  João          2v · 8f          🟢 Concluída
│  08/05   Cliente C  Maria         5v · 0f          🔴 Aguardando delegação
└────────────────────────────────────────────────────────────┘
```

- Header com totais
- Tabela `md:table` / mobile vira lista de cards (mesmo padrão de `CapturasOrganizadas`)
- Linha com `taskId` → `<Link href="/tarefas/<id>">`; sem task → `<Link href="/audiovisual?tab=pendente_delegacao">`
- Empty state: "Nenhuma captação nos últimos 3 dias"
- Badge de status com cores semânticas (verde / âmbar / vermelho)

### Montagem nos 5 dashboards

```tsx
import { PainelAudiovisualSection } from "@/components/dashboard/audiovisual/PainelAudiovisualSection";

// ... ao final do JSX existente:
<PainelAudiovisualSection />
```

Mesma linha em 5 arquivos. Sem refator dos dashboards.

### Test plan

- Criar captura → aparece "Aguardando delegação"
- Delegar pra editor → muda pra "Em edição: Aberta"
- Editor muda status pra `em_andamento` → "Em edição: Em andamento"
- Editor marca `postada` → "Concluída"
- `markCapturaConcluidaAction` (concluida_em) → "Concluída"
- Captura há 4 dias → não aparece
- Captura hoje → aparece

### Risco

Baixo-médio. Componente novo isolado, montado em 5 dashboards via 1 linha cada.

---

## PR 4 — Abas em /audiovisual

### Mudança

[`src/app/(authed)/audiovisual/page.tsx`](src/app/(authed)/audiovisual/page.tsx) vira página de abas. 2 abas novas pra estados intermediários da captação.

### Estrutura

```
┌─ Audiovisual ──────────────────────────────────────────────┐
│  [Banner de captação atrasada — sempre visível se houver]  │
│  [ Capturas ] [ Pendente de entrega ] [ Pendente delegação ]│
│  <conteúdo>                                                │
└────────────────────────────────────────────────────────────┘
```

### Visibilidade

| Aba | videomaker | audiovisual_chefe / coord / assessor / adm / sócio |
|---|---|---|
| Capturas | ✅ (form + minhas capturas) | ✅ (lista da equipe) |
| Pendente de entrega | ✅ (próprias) | ✅ (todas) |
| Pendente de delegação | ❌ não vê | ✅ (todas) |

### Queries novas em `src/lib/audiovisual/queries.ts`

```ts
// Gravações passadas (sub_calendar='videomakers') sem captura entregue
export async function listEventosSemCaptura(options: {
  videomakerId?: string;  // sem filtro = todos
}): Promise<EventoSemCapturaRow[]>

// Capturas entregues mas sem task_id e sem concluida_em
export async function listCapturasSemDelegacao(): Promise<CapturaSemDelegacaoRow[]>
```

`listEventosSemCaptura` generaliza o que `listPendenteParaVideomaker` faz hoje (extrai o filtro de userId). Tag: `AUDIOVISUAL_PENDENTE_TAG`.

`listCapturasSemDelegacao` filtra `audiovisual_capturas` por `task_id IS NULL AND concluida_em IS NULL`. Tag: `AUDIOVISUAL_CAPTURAS_TAG`.

### Componentes novos

```
src/components/audiovisual/
  TabsAudiovisual.tsx           — wrapper de tabs com URL state (?tab=)
  PendenteEntregaAba.tsx        — lista de eventos sem captura
  PendenteDelegacaoAba.tsx      — lista de capturas sem task com botão "Delegar"
```

**PendenteEntregaAba:**
- Lista agrupada por data desc
- Cada item: data, título do evento, cliente, videomaker, badge "ATRASADA" se passou D+1 09h
- Pro videomaker: clicar abre `CapturaForm` em dialog (mesmo padrão de `CapturaPendenteLockGate`)
- Pro coord+: read-only (apenas visualização)

**PendenteDelegacaoAba:**
- Lista por `data_captacao` desc
- Cada item: data, cliente, videomaker, qtd vídeos/fotos, link do drive, botão "Delegar pra editor"
- Botão reusa `DelegarCapturaButton` existente

### URL state

`?tab=capturas|pendente_entrega|pendente_delegacao` (default: `capturas`). Permite deep-link.

### Refator de `page.tsx`

Conteúdo atual (form + lista) vai pra um sub-componente `CapturasAba.tsx`. O `page.tsx` faz:

1. Auth + verifica role
2. Calcula visibilidade das 3 abas
3. Renderiza `<TabsAudiovisual>` com children correspondentes
4. Banner de atrasada continua acima das abas

### Cache

Mutations já invalidam as tags necessárias — sem novas invalidações:
- `createCapturaAction` → invalida `AUDIOVISUAL_PENDENTE_TAG` + `AUDIOVISUAL_CAPTURAS_TAG`
- `delegateCapturaAction` → invalida `AUDIOVISUAL_CAPTURAS_TAG`

### Test plan

- Videomaker vê 3 abas? Não — só vê 2 (sem "Pendente delegação")
- Videomaker em "Pendente de entrega" só vê suas; coord vê todas
- Videomaker clica em pendência → abre form em dialog → entrega → some da aba
- Coord clica em captura sem delegação → delega → some da aba
- URL com `?tab=pendente_delegacao` abre na aba certa
- Videomaker tentando acessar `?tab=pendente_delegacao` → aba não existe pra ele, default vira `capturas`

### Risco

Médio. Refator de `page.tsx` (envelope em tabs) + 2 abas novas + 2 queries novas. Localizado, mas mexe na principal página de audiovisual.

---

## Ordem de implementação

PR 1 → PR 2 → PR 3 → PR 4, todos contra `main`, cada um independente.

Cada PR pode ser mergeado isoladamente. Se PR 2 quebrar, PR 1 continua válido. Se PR 3 ou 4 não passarem em review, os anteriores não revertem.

## Trabalho fora do escopo

- Realtime/SSE pros contadores (cache 60s + tag invalidation é suficiente pra UX atual)
- Filtro por videomaker/editor específico nos contadores agregados
- Export/relatório dos painéis
- Mudanças em outras visões de tarefa (`/tarefas`, painel mensal, etc.)
- Mudanças no lock gate de captação atrasada
