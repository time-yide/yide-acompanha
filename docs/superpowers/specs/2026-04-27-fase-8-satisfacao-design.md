# Fase 8 — Satisfação + IA (Yide Digital) — Design

**Data:** 2026-04-27
**Status:** Aprovado pela usuária, aguardando plano de implementação
**Spec mãe:** [2026-04-26-sistema-acompanhamento-design.md](2026-04-26-sistema-acompanhamento-design.md), seção 5.6
**Fases anteriores:** Fundação, Clientes, Kanban, Calendário, Tarefas, Colaboradores, Notificações, Comissões (todas em produção)

---

## 1. Objetivo

Sistema de satisfação semanal de clientes com:
- **Avaliação manual** (cor verde/amarelo/vermelho + comentário) feita por Coord/Assessor/Audiovisual Chefe/Produtores toda segunda-feira
- **Síntese por IA** (Claude haiku-4-5 com prompt caching) que combina as avaliações + histórico de 4 semanas + dados do cliente em um score 0-10 + cor_final + resumo + ação sugerida
- **Trigger real-time** quando 2ª avaliação chega + **fallback quinta-feira** via cron daily existente para clientes com avaliação parcial
- **Ranking público** com Top 10 mais satisfeitos, Top 10 menos satisfeitos (atenção urgente), Demais clientes
- **Sparkline de 12 semanas** por cliente
- **Aba "Satisfação"** na pasta do cliente com histórico completo
- **Integração Fase 6**: notificação `satisfacao_pendente` toda segunda + `cliente_perto_churn` quando IA detecta vermelho por 2 semanas seguidas

**Princípios:**
- Avaliação leva ~5s/cliente (auto-save instantâneo, sem submit de form)
- IA é silenciosa em caso de erro (fallback retry na quinta-feira)
- Síntese é gerada uma vez por (cliente, semana) — edição posterior de avaliação não regenera
- Ranking público promove transparência sobre saúde dos clientes
- Custo IA ~$0.50/mês para 110 clientes/semana

**Fora do escopo:**
- Pesquisa de satisfação enviada diretamente ao cliente final (não-Yide) — futuro
- Comparação histórica entre coordenadores (ranking de quem tem clientes mais satisfeitos) — futuro
- Editar avaliação retroativa e regenerar síntese — futuro (por hora, edita só pra próxima semana)
- Resumo mensal de satisfação no dashboard — Fase 9
- Multi-cliente: avaliação por departamento dentro do cliente — fora do MVP

---

## 2. Modelo de dados

### Enum

```sql
create type public.satisfaction_color as enum ('verde', 'amarelo', 'vermelho');
```

### Tabela `satisfaction_entries` (avaliação manual)

Uma linha por **(cliente, avaliador, semana)**. Pode estar pendente (`cor IS NULL`) ou avaliada (`cor` preenchida).

| Coluna | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `client_id` | uuid | FK → clients on delete cascade, not null |
| `autor_id` | uuid | FK → profiles, not null |
| `papel_autor` | text | not null (`coordenador`/`assessor`/`videomaker`/`designer`/`editor`/`audiovisual_chefe`) |
| `semana_iso` | text | not null, formato `YYYY-Www` (ex: `2026-W17`) |
| `cor` | enum satisfaction_color | nullable (null = pendente) |
| `comentario` | text | nullable |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | default `now()` (trigger `set_updated_at`) |

**Índices:**
- Unique `(client_id, autor_id, semana_iso)` — 1 entry por avaliador/cliente/semana
- `(semana_iso, cor)` — query "todas avaliações da semana X que estão verde"
- `(autor_id, semana_iso)` — query "minhas avaliações desta semana"

**RLS:**
- `SELECT`: coord/sócio/adm leem todas; assessor lê próprias + as do mesmo cliente onde é assessor; produtores leem todas (pra ver contexto); comerciais não veem
- `UPDATE`: só `autor_id = auth.uid()` (cada um edita o seu)
- `INSERT`: cron via service-role (bootstrap pendentes); `autor_id = auth.uid()` (criar manualmente também OK)
- `DELETE`: só sócio (limpeza/erros)

### Tabela `satisfaction_synthesis` (síntese IA)

Uma linha por **(cliente, semana)**. Gerada quando avaliações chegam (real-time) ou pelo cron quinta (fallback).

| Coluna | Tipo | Restrição |
|---|---|---|
| `id` | uuid | PK |
| `client_id` | uuid | FK → clients on delete cascade, not null |
| `semana_iso` | text | not null |
| `score_final` | numeric(3,1) | not null (0.0 a 10.0) |
| `cor_final` | enum satisfaction_color | not null |
| `resumo_ia` | text | not null |
| `divergencia_detectada` | boolean | default false |
| `acao_sugerida` | text | nullable (null se cor=verde) |
| `ai_input_hash` | text | nullable (debug/cache) |
| `ai_tokens_used` | integer | nullable (monitoramento custo) |
| `created_at` | timestamptz | default `now()` |

**Índices:**
- Unique `(client_id, semana_iso)` — 1 síntese por cliente/semana (idempotência)
- `(semana_iso, cor_final)` — query "todas vermelhas da semana"
- `(semana_iso, score_final desc)` — ranking

**RLS:**
- `SELECT`: todos autenticados (transparência da agência)
- `UPDATE/INSERT`: só service-role
- `DELETE`: nenhum

### Quem avalia (matriz `feed:satisfaction`)

Permissão `feed:satisfaction` já está na matriz desde Fase 5. Estado atual:
- ✓ Coordenador (obrigatório)
- ✓ Assessor (obrigatório)
- ✓ Videomaker / Designer / Editor / Audiovisual Chefe (alimentam todos clientes)
- ✓ Sócio (opcional)
- ✗ Comercial / ADM

Sem mudança na matriz nesta fase.

---

## 3. UI da avaliação batch

### Página `/satisfacao/avaliar`

Server component. Coord/Assessor/Audiovisual Chefe/Produtores abrem toda segunda. Sócio também pode (raramente).

**Header:**
```
Satisfação semanal · Semana 2026-W17 (14-20 Abr)
Você avaliou 12 de 110 clientes esta semana.
[barra de progresso visual]
```

**Visibilidade de clientes (filtro):**
- **Coord:** todos clientes ativos
- **Assessor:** clients onde `assessor_id = me`
- **Audiovisual Chefe / Videomaker / Designer / Editor:** todos clientes ativos
- **Sócio:** todos clientes ativos (raro avaliar)

### Layout da linha (componente `<EvaluationRow>`)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [Avatar] Pizzaria Bella                  🟢  🟡  🔴   💬 [+ comentário] │
└──────────────────────────────────────────────────────────────────────┘
```

- **Avatar:** iniciais (ex: "PB"). Logo do cliente (futuro)
- **Nome:** link pra `/clientes/[id]`
- **3 botões grandes (cor):** click salva instantaneamente via `setSatisfactionColorAction(client_id, cor)`. Botão fica destacado depois de salvo (ex: `bg-green-500/30 ring-2 ring-green-500`)
- **💬 Botão:** expande textarea pra digitar comentário. Auto-save em blur (sai do foco) ou após 2s de typing pause. Action: `setSatisfactionCommentAction(client_id, comentario)`

### Componentes

```
src/components/satisfacao/
├── EvaluationRow.tsx              # client; 1 linha por cliente
├── ColorButtons.tsx               # client; 3 botões grandes (helper de EvaluationRow)
├── CommentBox.tsx                 # client; textarea expansível com auto-save
└── ProgressBar.tsx                # server; "X de Y avaliados"
```

### Server actions (`src/lib/satisfacao/actions.ts`)

```ts
export async function setSatisfactionColorAction(
  formData: FormData
): Promise<{ success: true; triggeredSynthesis: boolean } | { error: string }>;

// Salva cor (upsert por client_id + autor_id + semana_iso atual)
// Após salvar, conta entries com cor preenchida pra esse cliente/semana
// Se >= 2, dispara synthesizeClientSatisfaction (inline, await)
// Se 1ª avaliação, retorna triggeredSynthesis=false

export async function setSatisfactionCommentAction(
  formData: FormData
): Promise<{ success: true } | { error: string }>;

// Upsert do comentário (não dispara síntese)
```

### Page `/satisfacao/avaliar/page.tsx`

```ts
export default async function AvaliarPage() {
  const user = await requireAuth();
  if (!canAccess(user.role, "feed:satisfaction")) notFound();

  const weekIso = currentIsoWeek();
  const clients = await listClientsForUser(user.id, user.role);
  const myEntries = await listEntriesForUserWeek(user.id, weekIso);

  // Bootstrap: cria entries pendentes (cor=null) para clientes que ainda não tem
  await ensurePendingEntries(user.id, user.role, clients, weekIso);

  return ( ...rendering... );
}
```

---

## 4. IA — wrapper, prompt, síntese

### Setup
- `npm install @anthropic-ai/sdk`
- `ANTHROPIC_API_KEY` **opcional** no env schema (igual `CRON_SECRET`)

### Wrapper `src/lib/ai/client.ts`

```ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (!_client) _client = new Anthropic({ apiKey: key });
  return _client;
}

export const SATISFACTION_MODEL = "claude-haiku-4-5";
```

### Função `synthesizeClientSatisfaction` (`src/lib/satisfacao/synthesizer.ts`)

```ts
interface SynthesisInput {
  client: { id: string; nome: string; valor_mensal: number; data_entrada: string; servico_contratado: string | null };
  current_week_iso: string;
  current_entries: Array<{ papel: string; cor: 'verde'|'amarelo'|'vermelho'; comentario: string | null }>;
  history_4_weeks: Array<{ semana_iso: string; cor_final: string; resumo_ia: string }>;
}

interface SynthesisOutput {
  score_final: number;
  cor_final: 'verde'|'amarelo'|'vermelho';
  resumo_ia: string;
  divergencia_detectada: boolean;
  acao_sugerida: string | null;
  ai_tokens_used: number;
}

export async function synthesizeClientSatisfaction(input: SynthesisInput): Promise<SynthesisOutput | null>
```

### Prompt

System (cached via `cache_control: { type: "ephemeral" }`):
```
Você é um analista de satisfação de clientes da Yide Digital.

Cliente: {nome}
Valor mensal: R$ {valor_mensal}
Tempo de casa: {months_count} meses (entrou em {data_entrada})
Serviço contratado: {servico_contratado}

Histórico das últimas 4 semanas (mais recente primeiro):
{history_4_weeks formatado}
```

User (não cached):
```
Avaliações desta semana ({current_week_iso}):
{current_entries formatado}

Sintetize a satisfação desta semana em JSON:
{
  "score_final": número 0-10,
  "cor_final": "verde" | "amarelo" | "vermelho",
  "resumo_ia": "1-2 parágrafos analisando a semana e tendência",
  "divergencia_detectada": true se coord e assessor deram cores diferentes,
  "acao_sugerida": null se cor_final=verde; texto curto sugerindo ação se amarelo/vermelho
}

Regras:
- Score 0-3 = vermelho, 4-7 = amarelo, 8-10 = verde
- Se só tem 1 avaliação (a outra falhou), divergencia_detectada=false, score baseado nela
- Resumo deve referenciar contexto histórico se houver tendência (ex: "3ª semana seguida em vermelho — ação urgente")
- Tom profissional, direto, em português

Retorne APENAS o JSON, sem texto antes ou depois.
```

### Parsing seguro

```ts
try {
  const json = JSON.parse(response);
  // valida shape com zod
  return parsed;
} catch {
  console.error("[synthesizer] failed to parse AI response");
  return null;
}
```

### Detector de churn

Após gravar síntese, se `cor_final === 'vermelho'`:

```ts
async function checkChurnAlert(clientId: string, weekIso: string, current: SynthesisOutput) {
  if (current.cor_final !== 'vermelho') return;
  const previousWeek = previousIsoWeek(weekIso);
  const previous = await getSynthesis(clientId, previousWeek);
  if (previous?.cor_final === 'vermelho') {
    await dispatchNotification({
      evento_tipo: "cliente_perto_churn",
      titulo: `Atenção: ${cliente.nome} em zona vermelha por 2 semanas`,
      mensagem: current.acao_sugerida ?? "Risco de churn — ação urgente",
      link: `/clientes/${clientId}/satisfacao`,
    });
  }
}
```

### Custo

Estimativa: 110 clientes × 4 semanas/mês = 440 sínteses, ~500 input tokens cached + 150 não-cached por chamada → **~$0.44/mês**.

---

## 5. Cron + triggers

### Trigger real-time (server action)

Em `setSatisfactionColorAction(...)`:
```ts
const filledCount = await countFilledEntries(clientId, weekIso);
if (filledCount >= 2) {
  // Dispara inline (await) — adiciona ~2-3s no save da 2ª avaliação
  const synthesis = await synthesizeAndStore(clientId, weekIso);
  if (synthesis) await checkChurnAlert(clientId, weekIso, synthesis);
}
```

**Por que inline:** Next.js server actions não tem job queue nativo. Trade-off aceitável vs complexidade.

### Detector `satisfacao-pendente.ts` (substitui stub Fase 6)

```ts
export async function detectSatisfacaoPendente(counters: { satisfacao_pendente: number }): Promise<void> {
  const supabase = createServiceRoleClient();
  const today = new Date();
  const dayOfWeek = today.getUTCDay();
  const weekIso = currentIsoWeek();

  // Segunda (1): cria entries pendentes pra todos clientes ativos × cada avaliador
  if (dayOfWeek === 1) {
    await bootstrapPendingEntries(supabase, weekIso);
    await dispatchNotification({
      evento_tipo: "satisfacao_pendente",
      titulo: "Avaliação de satisfação pendente",
      mensagem: "Avalie seus clientes esta semana em /satisfacao/avaliar",
      link: "/satisfacao/avaliar",
    });
    counters.satisfacao_pendente++;
  }

  // Quinta (4): roda síntese pra clientes que têm entries mas sem síntese
  if (dayOfWeek === 4) {
    const clients = await listClientsWithEntriesButNoSynthesis(supabase, weekIso);
    for (const c of clients) {
      const synthesis = await synthesizeAndStore(c.id, weekIso);
      if (synthesis) await checkChurnAlert(c.id, weekIso, synthesis);
    }
  }
}
```

`bootstrapPendingEntries` cria entries pendentes (cor=null) para cada cliente ativo × cada avaliador elegível (coord + assessor responsável + audiovisual chefe + produtores). Se já existe (unique index), ignora silenciosamente.

### Cron config

`vercel.json` — **sem mudança**. O detector roda dentro do `daily-digest` existente.

### Helper `currentIsoWeek` / `isoWeek(date)`

```ts
// src/lib/satisfacao/iso-week.ts
export function isoWeek(date: Date = new Date()): string {
  // Returns 'YYYY-Www' format following ISO 8601
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // monday = 0
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function currentIsoWeek(): string {
  return isoWeek(new Date());
}

export function previousIsoWeek(weekIso: string): string {
  const [year, week] = weekIso.split('-W').map(Number);
  const date = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  date.setUTCDate(date.getUTCDate() - 7);
  return isoWeek(date);
}
```

---

## 6. Página `/satisfacao` (ranking + consulta)

### Layout

**Header:**
```
Satisfação · Semana 2026-W17 (14-20 Abr)
[seletor de semana ▾]   [link "Avaliar esta semana →" se for coord/assessor/produtor]
```

### Top 10 mais satisfeitos (painel verde)

Card grande com fundo verde claro. Ordena por `score_final desc` filtrando `cor_final=verde`:
- Medalhas 🥇🥈🥉 nos 3 primeiros, números 4-10
- Cada card: nome, score, sparkline 12 semanas, coord+assessor responsáveis

### Top 10 menos satisfeitos (painel vermelho)

Card grande com fundo vermelho claro. Subtítulo: "Atenção urgente — risco de churn":
- Ordena por `score_final asc` (filtra prioridade vermelho > amarelo)
- Mesma estrutura, sparkline mostra tendência

### Demais clientes (lista rolável)

Tabela rolável com:
- Filtro de ordenação (alfabética / score / data de entrada)
- Cada linha: nome, score, cor da semana, sparkline mini
- Aparece quando passar dos 20 clientes (top + bottom)

### Sparkline (`<SatisfactionSparkline>`)

Server component. Carrega últimas 12 sínteses do cliente:
- SVG inline com 12 retângulos coloridos lado a lado
- Cor: verde / amarelo / vermelho / cinza-se-faltou-naquela-semana
- Tooltip on hover: semana + score

### Aba "Satisfação" na pasta do cliente

`src/app/(authed)/clientes/[id]/satisfacao/page.tsx`:
- Histórico semanal completo (todas sínteses, mais recente primeiro)
- Sparkline grande no topo
- Cada item:
  ```
  Semana 2026-W17 · 🟢 verde · score 9.2
  Coord: 🟢 — "Cliente muito satisfeito..."
  Assessor: 🟢 — "Sem nenhum problema reportado"
  Síntese IA: "Cliente em alta satisfação..."
  Ação sugerida: —
  ```

### Componentes

```
src/components/satisfacao/
├── (avaliação — Seção 3)
├── RankingCard.tsx                  # 1 cliente no top/bottom
├── TopRanking.tsx                   # container do top 10
├── BottomRanking.tsx                # container do bottom 10
├── OthersTable.tsx                  # client; tabela rolável com sort
├── SatisfactionSparkline.tsx        # server; SVG de 12 quadradinhos
├── WeeklySatisfactionDetail.tsx     # server; detalhe de 1 semana
└── WeekSelector.tsx                 # client; dropdown de semanas
```

### Queries (`src/lib/satisfacao/queries.ts`)

| Função | Para quê |
|---|---|
| `listClientsForUser(userId, role)` | Filtro de visibilidade pro avaliador |
| `listEntriesForUserWeek(userId, weekIso)` | Entries do user na semana (UI batch) |
| `listEntriesForClientWeek(clientId, weekIso)` | Todas avaliações de 1 cliente na semana |
| `getSynthesisForWeek(weekIso)` | Lista de sínteses pra ranking |
| `getSynthesisHistory(clientId, limit)` | Histórico pra sparkline |
| `getSynthesis(clientId, weekIso)` | 1 síntese específica |
| `currentIsoWeek()` | Helper de semana atual |
| `listMissingEntries(weekIso)` | Pra cron quinta saber quem ainda não avaliou |
| `countFilledEntries(clientId, weekIso)` | Pra trigger real-time |

---

## 7. Edge cases

| Caso | Comportamento |
|---|---|
| Cliente novo (zero histórico) | Síntese IA roda igual; `history_4_weeks` array vazio; prompt entende contexto |
| Apenas 1 avaliação chegou (outro avaliador esqueceu) | Síntese roda mesmo, com 1 input. `divergencia_detectada=false`. Quinta-feira força isso pra todos pendentes |
| `ANTHROPIC_API_KEY` não configurado | Wrapper retorna `null`. Síntese não acontece. Avaliação manual continua funcionando. Log de aviso |
| Cliente que recém saiu do `ativo` na semana | Síntese ignora (não é cliente ativo); sem reflexo no ranking |
| Semana atual ainda sem síntese pra ninguém | Página `/satisfacao` mostra a semana ANTERIOR como default |
| Race condition: 2 sínteses concorrentes pro mesmo (cliente, semana) | Unique index bloqueia; segunda chamada falha; log silencioso |
| IA retorna JSON malformado | Try/catch ao parse → null → cliente fica sem síntese; cron quinta tenta novamente |
| Coord/Assessor edita avaliação depois de síntese gerada | Síntese **não regenera automaticamente**. Edição reflete só na próxima semana. (Futuro: botão "regenerar síntese") |
| Semana iso de virada de ano (ex: 2026-W01 = 30 Dez 2025) | Helper `isoWeek()` segue ISO 8601 corretamente |
| Cron quinta detecta cliente com entries vazias (cor=null) | Skip — precisa de pelo menos 1 cor pra rodar IA |

---

## 8. Testes

### Unit (`tests/unit/`)

**`satisfacao-iso-week.test.ts`** (5 cases):
- `isoWeek()` retorna 'YYYY-Www' formato correto
- Semana 1 do ano (lunes 4-jan-26 → '2026-W01')
- Semana 53 (raro) — 2025 tinha; 2026 não
- `previousIsoWeek('2026-W01')` retorna '2025-W52' (ou W53 se aplicável)
- Virada de ano (semana corrente em 30/12 = W01 do ano seguinte)

**`satisfacao-synthesizer.test.ts`** (4 cases, mock Anthropic):
- Parse JSON válido → SynthesisOutput
- JSON inválido → retorna null + log error
- `getAnthropicClient` retorna null → `synthesizeClientSatisfaction` retorna null
- Divergência detectada quando coord=verde e assessor=vermelho

**`satisfacao-actions.test.ts`** (5 cases):
- `setSatisfactionColorAction` faz upsert (1ª chamada cria, 2ª atualiza)
- 1ª avaliação chegou (1 entry com cor) → `triggeredSynthesis=false`
- 2ª avaliação chegou → dispara síntese
- Idempotência: setSatisfactionColor chamado 2x não dispara síntese 2x se já existe synthesis
- `checkChurnAlert` dispatcha quando 2 vermelhos seguidos

**`satisfacao-detector.test.ts`** (3 cases):
- Segunda (`getUTCDay() === 1`): bootstrap entries + dispatch satisfacao_pendente
- Quinta (`getUTCDay() === 4`): roda síntese pra clientes pendentes
- Outros dias: no-op

### E2E (`tests/e2e/satisfacao.spec.ts`)

4 rotas auth-redirect:
- `/satisfacao`
- `/satisfacao/avaliar`
- `/clientes/[id]/satisfacao` (com UUID de teste)

---

## 9. Cobertura do spec — seção 5.6

| Spec | Coberto por |
|---|---|
| Toda segunda cria pendências | Detector segunda no daily-digest |
| Coord+assessor avaliam (cor + comentário) | UI batch + entries table |
| Síntese IA (haiku-4-5) com prompt caching | Wrapper + synthesizer (Seção 4) |
| Quinta-feira cron força síntese | Detector quinta no daily-digest |
| Real-time quando ambos avaliam | Server action dispara síntese |
| Score 0-10, cor_final, resumo, divergência, ação | Output schema |
| Top 10 + Bottom 10 + Demais | `/satisfacao` ranking |
| Sparkline 12 semanas | `<SatisfactionSparkline>` |
| Aba Satisfação na pasta do cliente | `/clientes/[id]/satisfacao` |
| Notificação `cliente_perto_churn` (2 vermelhos seguidos) | `checkChurnAlert` |
| Notificação `satisfacao_pendente` (toda segunda) | Detector segunda dispatcha |

---

## 10. Estrutura final esperada

```
supabase/migrations/
└── 20260427000016_satisfaction.sql                [NEW]

src/
├── app/(authed)/
│   ├── satisfacao/
│   │   ├── page.tsx                               [NEW — ranking principal]
│   │   └── avaliar/page.tsx                       [NEW — batch evaluation]
│   └── clientes/[id]/satisfacao/page.tsx          [NEW — aba do cliente]
│
├── components/satisfacao/                         [NEW]
│   ├── EvaluationRow.tsx
│   ├── ColorButtons.tsx
│   ├── CommentBox.tsx
│   ├── ProgressBar.tsx
│   ├── RankingCard.tsx
│   ├── TopRanking.tsx
│   ├── BottomRanking.tsx
│   ├── OthersTable.tsx
│   ├── SatisfactionSparkline.tsx
│   ├── WeeklySatisfactionDetail.tsx
│   └── WeekSelector.tsx
│
├── lib/
│   ├── ai/
│   │   └── client.ts                              [NEW — Anthropic wrapper]
│   ├── env.ts                                     [MODIFY — ANTHROPIC_API_KEY opcional]
│   └── satisfacao/                                [NEW]
│       ├── schema.ts
│       ├── iso-week.ts
│       ├── queries.ts
│       ├── actions.ts
│       └── synthesizer.ts
│
└── lib/cron/detectors/satisfacao-pendente.ts      [REPLACE — implementação real]

vercel.json                                        # sem mudança
package.json                                       [MODIFY — +@anthropic-ai/sdk]

tests/
├── unit/
│   ├── satisfacao-iso-week.test.ts                [NEW]
│   ├── satisfacao-synthesizer.test.ts             [NEW]
│   ├── satisfacao-actions.test.ts                 [NEW]
│   └── satisfacao-detector.test.ts                [NEW]
└── e2e/
    └── satisfacao.spec.ts                         [NEW]
```

---

## 11. Estimativa

- **~17 commits**
- **1 migration** (1 enum + 2 tabelas com RLS)
- **1 dependência nova** (`@anthropic-ai/sdk`)
- **3 páginas novas** + 11 componentes
- **5 server actions / queries / synthesizer / iso-week**
- **4 test suites unit + 1 e2e** = 17 unit + 4 e2e
- Sem dependências de cron extra (usa daily-digest existente)

---

## 12. Aprovação

Brainstorming concluído com a usuária em 2026-04-27. Decisões registradas:
- Fase 8 = Satisfação + IA (5.6) com escopo cheio
- `ANTHROPIC_API_KEY` configurado no Vercel pela usuária antes da implementação
- Trigger real-time + fallback quinta-feira
- UI batch com auto-save instantâneo (Opção A)
- Modelo `claude-haiku-4-5` com prompt caching
- Aprovação imutável da síntese (não regenera ao editar avaliação)
- Detecção de churn quando 2 vermelhos consecutivos

Próximo passo: skill `writing-plans` gera o plano detalhado de execução em `docs/superpowers/plans/2026-04-27-fase-8-satisfacao.md`.
