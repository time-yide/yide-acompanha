# PR 2 — Reestruturação Videomakers + Editores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever a "Visão da Equipe" do dashboard audiovisual: videomakers ganham 3 colunas (Próximas / Hoje / Concluídas) e editores ganham 3 colunas (Próximas / Em andamento / Concluídas), com semântica correta dos contadores e dialog detalhe seccionado.

**Architecture:** Mudança no data layer (`src/lib/dashboard/audiovisual.ts`) substitui shape antigo (`proximasGravacoes`/`concluidasNoPeriodo`/`pendentes`) pelo novo (`proximas`/`hoje`/`concluidas` pra videomaker; `proximas`/`emAndamento`/`concluidas` pro editor). Bump de cache key (shape mudou). Helpers de data (BRT-aware) e timestamp-finalizado extraídos. UI dos 3 componentes (`EquipeAudiovisualSection`, `MemberRow`, `MemberDetailDialog`) ajustada pra novo shape.

**Tech Stack:** Next.js (app router), Supabase JS client, `unstable_cache` + tag invalidation, TypeScript estrito, vitest pra tests.

**Spec de referência:** [`docs/superpowers/specs/2026-05-11-dashboard-audiovisual-revamp-design.md`](../specs/2026-05-11-dashboard-audiovisual-revamp-design.md) — PR 2.

---

## Task 0: Preparar branch isolada a partir de `main`

**Files:** nenhum — só operações git.

Spec + plano PR 1 já estão no PR #197 (não merged ainda). Pra PR 2 ser independente, branch nova a partir de origin/main com cherry-pick do spec + deste plano.

- [ ] **Step 1: Verificar working tree limpo**

```bash
git status
```

Expected: `working tree clean`. Se sujo, parar.

- [ ] **Step 2: Anotar hashes do spec e do plano PR 2 atual**

```bash
git log --oneline -10
```

Anotar:
- Hash do commit do spec doc (`docs(spec): revamp dashboard audiovisual em 4 PRs`)
- Hash do commit deste plano PR 2 (será o commit mais recente após salvar)

- [ ] **Step 3: Fetch + criar branch nova a partir da main**

```bash
git fetch origin main
git switch -c claude/audiovisual-reestruturacao-equipe origin/main
```

Expected: branch nova criada.

- [ ] **Step 4: Cherry-pick spec + plano PR 2**

```bash
git cherry-pick <spec_hash> <plano_pr2_hash>
```

Expected: dois commits aplicados, working tree limpo.

- [ ] **Step 5: Verificar**

```bash
git log --oneline origin/main..HEAD
```

Expected: 2 commits (spec + plano PR 2).

---

## Task 1: Helpers de data + timestamp finalizado

**Files:**
- Create: `src/lib/dashboard/audiovisual-helpers.ts`
- Create: `tests/unit/audiovisual-helpers.test.ts`

Funções puras pra: (a) calcular intervalos BRT pra "hoje" e "futuro" e (b) escolher o timestamp correto pra checar "concluído no período" dependendo do status da task. Testáveis isoladamente.

- [ ] **Step 1: Escrever testes failing**

Criar `tests/unit/audiovisual-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getHojeAndFuturoBRT, getTerminadoEm } from "@/lib/dashboard/audiovisual-helpers";

describe("getHojeAndFuturoBRT", () => {
  it("retorna intervalo de hoje em BRT (UTC-3) e futuro de amanhã em diante", () => {
    // Ref: 2026-05-11 12:00:00 UTC == 09:00 BRT
    const ref = new Date("2026-05-11T12:00:00.000Z");
    const r = getHojeAndFuturoBRT(2, ref);

    // hoje BRT = 11/05 00:00 BRT = 11/05 03:00 UTC
    expect(r.hojeFromIso).toBe("2026-05-11T03:00:00.000Z");
    // hoje BRT ends = 12/05 00:00 BRT = 12/05 03:00 UTC
    expect(r.hojeToIso).toBe("2026-05-12T03:00:00.000Z");
    // futuro from = hoje to (sem sobreposição)
    expect(r.futuroFromIso).toBe(r.hojeToIso);
    // futuro to = hoje + 14 dias (2 semanas)
    expect(r.futuroToIso).toBe("2026-05-25T03:00:00.000Z");
  });

  it("ref antes da meia-noite BRT ainda conta como mesmo dia", () => {
    // Ref: 2026-05-11 02:00:00 UTC == 23:00 BRT do dia 10/05
    const ref = new Date("2026-05-11T02:00:00.000Z");
    const r = getHojeAndFuturoBRT(2, ref);
    // hoje BRT deve ser 10/05 (não 11/05)
    expect(r.hojeFromIso).toBe("2026-05-10T03:00:00.000Z");
    expect(r.hojeToIso).toBe("2026-05-11T03:00:00.000Z");
  });

  it("default weeksAhead = 2", () => {
    const ref = new Date("2026-05-11T12:00:00.000Z");
    const r = getHojeAndFuturoBRT(undefined, ref);
    expect(r.futuroToIso).toBe("2026-05-25T03:00:00.000Z");
  });
});

describe("getTerminadoEm", () => {
  it("status concluida usa completed_at", () => {
    const t = { status: "concluida", completed_at: "2026-05-10T12:00:00Z", aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t)).toBe("2026-05-10T12:00:00Z");
  });

  it("status aprovada usa aprovada_em, fallback completed_at", () => {
    const t1 = { status: "aprovada", completed_at: null, aprovada_em: "2026-05-10T12:00:00Z", updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t1)).toBe("2026-05-10T12:00:00Z");
    const t2 = { status: "aprovada", completed_at: "2026-05-09T12:00:00Z", aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t2)).toBe("2026-05-09T12:00:00Z");
  });

  it("status postada usa completed_at, fallback aprovada_em", () => {
    const t1 = { status: "postada", completed_at: "2026-05-10T12:00:00Z", aprovada_em: "2026-05-09T12:00:00Z", updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t1)).toBe("2026-05-10T12:00:00Z");
    const t2 = { status: "postada", completed_at: null, aprovada_em: "2026-05-09T12:00:00Z", updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t2)).toBe("2026-05-09T12:00:00Z");
  });

  it("em_aprovacao e agendado usam updated_at", () => {
    const t1 = { status: "em_aprovacao", completed_at: null, aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t1)).toBe("2026-05-11T12:00:00Z");
    const t2 = { status: "agendado", completed_at: null, aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t2)).toBe("2026-05-11T12:00:00Z");
  });

  it("status desconhecido retorna null", () => {
    const t = { status: "qualquer", completed_at: null, aprovada_em: null, updated_at: "2026-05-11T12:00:00Z" };
    expect(getTerminadoEm(t)).toBe(null);
  });
});
```

- [ ] **Step 2: Verificar que tests falham (módulo não existe)**

```bash
npx vitest run tests/unit/audiovisual-helpers.test.ts
```

Expected: FAIL com "Cannot find module '@/lib/dashboard/audiovisual-helpers'".

- [ ] **Step 3: Criar implementação**

Criar `src/lib/dashboard/audiovisual-helpers.ts`:

```ts
// SERVER ONLY: helpers puros pra cálculo de janelas BRT e timestamp de "concluído"

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // BRT = UTC-3

/**
 * Calcula intervalos pra "hoje BRT" e "futuro de amanhã até N semanas".
 * Retorna ISOs UTC. Os intervalos são contínuos: futuroFromIso == hojeToIso.
 */
export function getHojeAndFuturoBRT(
  weeksAhead = 2,
  reference: Date = new Date(),
): {
  hojeFromIso: string;
  hojeToIso: string;
  futuroFromIso: string;
  futuroToIso: string;
} {
  // Converte ref UTC pra "data BRT" subtraindo offset
  const brtNow = new Date(reference.getTime() - BRT_OFFSET_MS);
  // Início do dia BRT (00:00) — em data UTC, isso é dia BRT às 03:00 UTC
  const hojeFromUTC = new Date(Date.UTC(
    brtNow.getUTCFullYear(),
    brtNow.getUTCMonth(),
    brtNow.getUTCDate(),
    0, 0, 0, 0,
  ));
  // Adiciona offset pra converter pra UTC real
  const hojeFromMs = hojeFromUTC.getTime() + BRT_OFFSET_MS;
  const hojeToMs = hojeFromMs + 24 * 60 * 60 * 1000;
  const futuroToMs = hojeFromMs + (weeksAhead * 7 + 1) * 24 * 60 * 60 * 1000;

  return {
    hojeFromIso: new Date(hojeFromMs).toISOString(),
    hojeToIso: new Date(hojeToMs).toISOString(),
    futuroFromIso: new Date(hojeToMs).toISOString(),
    futuroToIso: new Date(futuroToMs).toISOString(),
  };
}

/**
 * Retorna o timestamp ISO que representa "quando a task foi finalizada",
 * dependendo do status. Usado pra filtrar "concluídas no período".
 *
 * Mapeamento:
 *   concluida  -> completed_at
 *   aprovada   -> aprovada_em ?? completed_at
 *   postada    -> completed_at ?? aprovada_em
 *   em_aprovacao / agendado -> updated_at
 *   outros -> null
 */
export function getTerminadoEm(task: {
  status: string;
  completed_at: string | null;
  aprovada_em: string | null;
  updated_at: string | null;
}): string | null {
  switch (task.status) {
    case "concluida":
      return task.completed_at;
    case "aprovada":
      return task.aprovada_em ?? task.completed_at;
    case "postada":
      return task.completed_at ?? task.aprovada_em;
    case "em_aprovacao":
    case "agendado":
      return task.updated_at;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Rodar testes**

```bash
npx vitest run tests/unit/audiovisual-helpers.test.ts
```

Expected: todos os 7 testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/audiovisual-helpers.ts tests/unit/audiovisual-helpers.test.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): helpers de data BRT + timestamp de task finalizada

getHojeAndFuturoBRT calcula intervalo "hoje BRT" e "futuro até 2 semanas"
considerando offset UTC-3. Sai do hack de UTC offset inline.

getTerminadoEm escolhe o timestamp certo pra checar "concluído no período"
por status — completed_at, aprovada_em ou updated_at com fallback.

Preparação pro PR 2 (reestruturação Videomakers/Editores).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Novo shape em audiovisual.ts (types + impl)

**Files:**
- Modify: `src/lib/dashboard/audiovisual.ts`

Reescreve `VideomakerStat`, `EditorStat`, `EquipeAudiovisual`. Adiciona query de capturas delegadas. Reescreve `_getEquipeAudiovisualImpl` pros novos buckets.

- [ ] **Step 1: Substituir o arquivo inteiro**

Reescrever `src/lib/dashboard/audiovisual.ts` com:

```ts
// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePeriodo, type Periodo } from "./personal";
import { getHojeAndFuturoBRT, getTerminadoEm } from "./audiovisual-helpers";
import { AUDIOVISUAL_CAPTURAS_TAG } from "@/lib/audiovisual/queries";

export interface GravacaoItem {
  id: string;
  titulo: string;
  inicio: string;
}

export interface TaskItem {
  id: string;
  titulo: string;
  status: string;
  due_date: string | null;
  prioridade: string | null;
}

export interface CapturaItem {
  id: string;
  data_captacao: string;
  cliente_nome: string | null;
  task_id: string | null;
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
  /** "editor" | "videomaker" | "audiovisual_chefe" — pra UI mostrar a função real. */
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
    totalGravacoesProximas: number;  // próximas + hoje
    totalEmAndamentoEdicao: number;   // em_andamento + alteracao dos editores
    totalConcluidasNoPeriodo: number; // capturas delegadas + tasks concluídas+ no período
  };
}

interface TaskMinimal {
  id: string;
  titulo: string;
  atribuido_a: string | null;
  participantes_ids: string[] | null;
  status: string;
  completed_at: string | null;
  aprovada_em: string | null;
  updated_at: string | null;
  due_date: string | null;
  prioridade: string | null;
}

interface CapturaDelegadaMinimal {
  id: string;
  videomaker_id: string;
  data_captacao: string;
  created_at: string;
  task_id: string | null;
  client_id: string | null;
  cliente: { nome: string } | null;
  task: { titulo: string } | null;
}

const STATUS_EM_ANDAMENTO = ["em_andamento", "alteracao"] as const;
const STATUS_CONCLUIDA = ["concluida", "em_aprovacao", "aprovada", "agendado", "postada"] as const;

async function _getEquipeAudiovisualImpl(periodo: Periodo): Promise<EquipeAudiovisual> {
  const supabase = createServiceRoleClient();
  const { fromIso: periodoFrom, toIso: periodoTo } = resolvePeriodo(periodo);
  const { hojeFromIso, hojeToIso, futuroFromIso, futuroToIso } = getHojeAndFuturoBRT(2);

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .in("role", ["videomaker", "editor", "audiovisual_chefe"])
    .eq("ativo", true)
    .order("nome");
  const profiles = (profilesData ?? []) as Array<{ id: string; nome: string; role: string }>;
  if (profiles.length === 0) {
    return {
      videomakers: [],
      editores: [],
      agregados: { totalGravacoesProximas: 0, totalEmAndamentoEdicao: 0, totalConcluidasNoPeriodo: 0 },
    };
  }
  const ids = profiles.map((p) => p.id);
  const videomakerIds = profiles.filter((p) => p.role === "videomaker").map((p) => p.id);

  // 4 queries em paralelo: tasks (atribuido + participantes), eventos (hoje + futuro), capturas delegadas
  const [tasksAtribuidoRes, tasksParticipantesRes, gravRes, capturasRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, titulo, atribuido_a, participantes_ids, status, completed_at, aprovada_em, updated_at, due_date, prioridade")
      .in("atribuido_a", ids),
    supabase
      .from("tasks")
      .select("id, titulo, atribuido_a, participantes_ids, status, completed_at, aprovada_em, updated_at, due_date, prioridade")
      .overlaps("participantes_ids", ids),
    supabase
      .from("calendar_events")
      .select("id, titulo, participantes_ids, inicio")
      .eq("sub_calendar", "videomakers")
      .gte("inicio", hojeFromIso)
      .lt("inicio", futuroToIso)
      .order("inicio", { ascending: true }),
    videomakerIds.length > 0
      ? supabase
          .from("audiovisual_capturas")
          .select("id, videomaker_id, data_captacao, created_at, task_id, client_id, cliente:clients(nome), task:tasks!task_id(titulo)")
          .in("videomaker_id", videomakerIds)
          .not("task_id", "is", null)
          .gte("created_at", periodoFrom)
          .lt("created_at", periodoTo)
      : Promise.resolve({ data: [] }),
  ]);

  const tasksAtribuido = (tasksAtribuidoRes.data ?? []) as unknown as TaskMinimal[];
  const tasksParticipantes = (tasksParticipantesRes.data ?? []) as unknown as TaskMinimal[];
  const tasksMap = new Map<string, TaskMinimal>();
  for (const t of [...tasksAtribuido, ...tasksParticipantes]) tasksMap.set(t.id, t);
  const tasks = [...tasksMap.values()];

  const eventos = (gravRes.data ?? []) as Array<{
    id: string;
    titulo: string;
    participantes_ids: string[] | null;
    inicio: string;
  }>;

  const capturas = (capturasRes.data ?? []) as unknown as CapturaDelegadaMinimal[];

  const inPeriod = (iso: string | null) => !!iso && iso >= periodoFrom && iso < periodoTo;

  const videomakers: VideomakerStat[] = profiles
    .filter((p) => p.role === "videomaker")
    .map((p) => {
      const proximasList = eventos
        .filter((e) => (e.participantes_ids ?? []).includes(p.id) && e.inicio >= futuroFromIso && e.inicio < futuroToIso)
        .map((e) => ({ id: e.id, titulo: e.titulo, inicio: e.inicio }));
      const hojeList = eventos
        .filter((e) => (e.participantes_ids ?? []).includes(p.id) && e.inicio >= hojeFromIso && e.inicio < hojeToIso)
        .map((e) => ({ id: e.id, titulo: e.titulo, inicio: e.inicio }));
      const concluidasList: CapturaItem[] = capturas
        .filter((c) => c.videomaker_id === p.id)
        .map((c) => ({
          id: c.id,
          data_captacao: c.data_captacao,
          cliente_nome: c.cliente?.nome ?? null,
          task_id: c.task_id,
          task_titulo: c.task?.titulo ?? null,
        }));
      return {
        id: p.id,
        nome: p.nome,
        proximas: proximasList.length,
        hoje: hojeList.length,
        concluidas: concluidasList.length,
        proximasList,
        hojeList,
        concluidasList,
      };
    });

  // Pertence: atribuído OU participante
  const pertence = (t: TaskMinimal, pid: string) =>
    t.atribuido_a === pid || (t.participantes_ids ?? []).includes(pid);

  const editores: EditorStat[] = profiles
    .map((p) => {
      const proximasList: TaskItem[] = tasks
        .filter((t) => t.status === "aberta" && pertence(t, p.id))
        .map((t) => ({ id: t.id, titulo: t.titulo, status: t.status, due_date: t.due_date, prioridade: t.prioridade }));

      const emAndamentoList: TaskItem[] = tasks
        .filter((t) => (STATUS_EM_ANDAMENTO as readonly string[]).includes(t.status) && pertence(t, p.id))
        .map((t) => ({ id: t.id, titulo: t.titulo, status: t.status, due_date: t.due_date, prioridade: t.prioridade }));

      const concluidasList: TaskItem[] = tasks
        .filter(
          (t) =>
            (STATUS_CONCLUIDA as readonly string[]).includes(t.status) &&
            pertence(t, p.id) &&
            inPeriod(getTerminadoEm(t)),
        )
        .map((t) => ({ id: t.id, titulo: t.titulo, status: t.status, due_date: t.due_date, prioridade: t.prioridade }));

      // Ordenação por due_date asc (sem prazo no fim) pras listas pendentes
      const sortByDue = (a: TaskItem, b: TaskItem) => {
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      };
      proximasList.sort(sortByDue);
      emAndamentoList.sort(sortByDue);

      return {
        id: p.id,
        nome: p.nome,
        role: p.role,
        proximas: proximasList.length,
        emAndamento: emAndamentoList.length,
        concluidas: concluidasList.length,
        proximasList,
        emAndamentoList,
        concluidasList,
      };
    })
    .filter((row) => {
      // Editor sempre aparece; videomaker/audiovisual_chefe só com alguma tarefa
      if (row.role === "editor") return true;
      return row.proximas + row.emAndamento + row.concluidas > 0;
    });

  const totalGravacoesProximas = videomakers.reduce((s, v) => s + v.proximas + v.hoje, 0);
  const totalEmAndamentoEdicao = editores.reduce((s, e) => s + e.emAndamento, 0);
  const totalConcluidasNoPeriodo =
    videomakers.reduce((s, v) => s + v.concluidas, 0) +
    editores.reduce((s, e) => s + e.concluidas, 0);

  return {
    videomakers,
    editores,
    agregados: { totalGravacoesProximas, totalEmAndamentoEdicao, totalConcluidasNoPeriodo },
  };
}

export async function getEquipeAudiovisual(periodo: Periodo): Promise<EquipeAudiovisual> {
  const cached = unstable_cache(
    async (p: string) => _getEquipeAudiovisualImpl(p as Periodo),
    // v3: shape mudou (videomaker proximas/hoje/concluidas, editor proximas/emAndamento/concluidas)
    ["dashboard-audiovisual-equipe-v3"],
    { revalidate: 60, tags: ["dashboard", "tasks", "calendar", AUDIOVISUAL_CAPTURAS_TAG] },
  );
  return cached(periodo);
}
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: erro em `EquipeAudiovisualSection.tsx`, `MemberRow.tsx`, `MemberDetailDialog.tsx` reclamando do shape novo. Esses arquivos são atualizados nas próximas tasks — esperado. Erro pré-existente em `web-push` segue presente.

Não consertar agora. Anotar quantos erros novos surgiram.

- [ ] **Step 3: Lint só do arquivo modificado**

```bash
npm run lint -- src/lib/dashboard/audiovisual.ts
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/dashboard/audiovisual.ts
git commit -m "$(cat <<'EOF'
refactor(dashboard): novo shape pra equipe audiovisual (videomakers/editores)

Videomaker:
  proximasGravacoes  ->  proximas + hoje (separados)
  concluidasNoPeriodo (tasks)  ->  concluidas (capturas delegadas)
  + proximasList, hojeList, concluidasList (CapturaItem)

Editor:
  pendentes (tudo != concluida)  ->  proximas (aberta) + emAndamento (em_andamento + alteracao)
  concluidasNoPeriodo (concluida só)  ->  concluidas (concluida + em_aprovacao + aprovada + agendado + postada)
  Anchor temporal: helper getTerminadoEm escolhe completed_at/aprovada_em/updated_at por status.

Adiciona query de capturas delegadas (task_id != null) no Promise.all.
Cache key: v2 -> v3 (shape mudou). Tag AUDIOVISUAL_CAPTURAS_TAG adicionada.

UI atualiza nos próximos commits (componentes vão quebrar até lá).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Atualizar `EquipeAudiovisualSection.tsx`

**Files:**
- Modify: `src/components/dashboard/audiovisual/EquipeAudiovisualSection.tsx`

3 cards de agregado novos + 3 colunas em cada tabela.

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
import { getEquipeAudiovisual } from "@/lib/dashboard/audiovisual";
import { PeriodoSelector } from "@/components/dashboard/personal/PeriodoSelector";
import type { Periodo } from "@/lib/dashboard/personal";
import { Video, CheckCircle2, Wrench } from "lucide-react";
import { MemberRow } from "./MemberRow";

interface Props {
  periodo: Periodo;
}

function roleLabel(role: string): string {
  if (role === "videomaker") return "Videomaker";
  if (role === "audiovisual_chefe") return "Coordenador audiovisual";
  if (role === "editor") return "Editor";
  return role;
}

export async function EquipeAudiovisualSection({ periodo }: Props) {
  const { videomakers, editores, agregados } = await getEquipeAudiovisual(periodo);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
          Visão da equipe
        </h2>
        <PeriodoSelector current={periodo} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Video className="h-3.5 w-3.5" /> Próximas gravações
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalGravacoesProximas}</p>
          <p className="text-xs text-muted-foreground">Hoje + futuro (2 semanas)</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Wrench className="h-3.5 w-3.5" /> Em andamento (edição)
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalEmAndamentoEdicao}</p>
          <p className="text-xs text-muted-foreground">Editores trabalhando agora</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluídas no período
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalConcluidasNoPeriodo}</p>
          <p className="text-xs text-muted-foreground">Capturas delegadas + edições finalizadas</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Videomakers</h3>
        {videomakers.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhum videomaker ativo na equipe.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-right font-medium">Próximas</th>
                  <th className="px-3 py-2 text-right font-medium">Hoje</th>
                  <th className="px-3 py-2 text-right font-medium">Concluídas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {videomakers.map((v) => (
                  <MemberRow
                    key={v.id}
                    variant="videomaker"
                    nome={v.nome}
                    proximas={v.proximas}
                    hoje={v.hoje}
                    concluidas={v.concluidas}
                    proximasList={v.proximasList}
                    hojeList={v.hojeList}
                    concluidasList={v.concluidasList}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Edição</h3>
        <p className="text-xs text-muted-foreground">
          Inclui editores, videomakers e coordenador audiovisual que estão fazendo edição em tarefas.
        </p>
        {editores.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Ninguém com tarefas de edição no momento.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-left font-medium">Função</th>
                  <th className="px-3 py-2 text-right font-medium">Próximas</th>
                  <th className="px-3 py-2 text-right font-medium">Em andamento</th>
                  <th className="px-3 py-2 text-right font-medium">Concluídas</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editores.map((e) => (
                  <MemberRow
                    key={e.id}
                    variant="edicao"
                    nome={e.nome}
                    funcao={roleLabel(e.role)}
                    proximas={e.proximas}
                    emAndamento={e.emAndamento}
                    concluidas={e.concluidas}
                    proximasList={e.proximasList}
                    emAndamentoList={e.emAndamentoList}
                    concluidasList={e.concluidasList}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- src/components/dashboard/audiovisual/EquipeAudiovisualSection.tsx
```

Expected: clean.

(Type-check ainda vai falhar — esperado, MemberRow ainda tem props antigas.)

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/audiovisual/EquipeAudiovisualSection.tsx
git commit -m "$(cat <<'EOF'
refactor(dashboard): 3 colunas na Visão da Equipe (videomakers e editores)

Videomakers: Nome | Próximas | Hoje | Concluídas
Editores:    Nome | Função | Próximas | Em andamento | Concluídas

3 cards agregados:
  Próximas gravações (hoje + futuro)
  Em andamento (edição)
  Concluídas no período

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Atualizar `MemberRow.tsx`

**Files:**
- Modify: `src/components/dashboard/audiovisual/MemberRow.tsx`

3 valores por variant, passa todas as listas pro dialog.

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
"use client";

import { useState } from "react";
import { MemberDetailDialog } from "./MemberDetailDialog";
import type { GravacaoItem, TaskItem, CapturaItem } from "@/lib/dashboard/audiovisual";

interface VideomakerProps {
  variant: "videomaker";
  nome: string;
  proximas: number;
  hoje: number;
  concluidas: number;
  proximasList: GravacaoItem[];
  hojeList: GravacaoItem[];
  concluidasList: CapturaItem[];
}

interface EditorProps {
  variant: "edicao";
  nome: string;
  funcao: string;
  proximas: number;
  emAndamento: number;
  concluidas: number;
  proximasList: TaskItem[];
  emAndamentoList: TaskItem[];
  concluidasList: TaskItem[];
}

type Props = VideomakerProps | EditorProps;

export function MemberRow(props: Props) {
  const [open, setOpen] = useState(false);
  const handleClick = () => setOpen(true);

  if (props.variant === "videomaker") {
    return (
      <>
        <tr onClick={handleClick} className="cursor-pointer hover:bg-muted/30">
          <td className="px-3 py-2 font-medium underline-offset-4 hover:underline">{props.nome}</td>
          <td className="px-3 py-2 text-right tabular-nums">{props.proximas}</td>
          <td className="px-3 py-2 text-right tabular-nums">{props.hoje}</td>
          <td className="px-3 py-2 text-right tabular-nums">{props.concluidas}</td>
        </tr>
        {open && (
          <MemberDetailDialog
            open={open}
            onOpenChange={setOpen}
            nome={props.nome}
            variant="videomaker"
            proximasList={props.proximasList}
            hojeList={props.hojeList}
            concluidasList={props.concluidasList}
          />
        )}
      </>
    );
  }

  return (
    <>
      <tr onClick={handleClick} className="cursor-pointer hover:bg-muted/30">
        <td className="px-3 py-2 font-medium underline-offset-4 hover:underline">{props.nome}</td>
        <td className="px-3 py-2 text-xs text-muted-foreground">{props.funcao}</td>
        <td className="px-3 py-2 text-right tabular-nums">{props.proximas}</td>
        <td className="px-3 py-2 text-right tabular-nums">{props.emAndamento}</td>
        <td className="px-3 py-2 text-right tabular-nums">{props.concluidas}</td>
      </tr>
      {open && (
        <MemberDetailDialog
          open={open}
          onOpenChange={setOpen}
          nome={props.nome}
          variant="edicao"
          proximasList={props.proximasList}
          emAndamentoList={props.emAndamentoList}
          concluidasList={props.concluidasList}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint -- src/components/dashboard/audiovisual/MemberRow.tsx
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/audiovisual/MemberRow.tsx
git commit -m "$(cat <<'EOF'
refactor(dashboard): MemberRow com 3 valores por variant

Videomaker: proximas, hoje, concluidas (+ 3 listas pro dialog).
Editor: proximas, emAndamento, concluidas (+ 3 listas pro dialog).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Atualizar `MemberDetailDialog.tsx`

**Files:**
- Modify: `src/components/dashboard/audiovisual/MemberDetailDialog.tsx`

3 seções pra cada variant. Adiciona labels faltando (`concluida`, `agendado`).

- [ ] **Step 1: Substituir o arquivo inteiro**

```tsx
"use client";

import Link from "next/link";
import { Calendar, Clock, ListTodo, ExternalLink, CheckCircle2, Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { GravacaoItem, TaskItem, CapturaItem } from "@/lib/dashboard/audiovisual";

interface VideomakerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome: string;
  variant: "videomaker";
  proximasList: GravacaoItem[];
  hojeList: GravacaoItem[];
  concluidasList: CapturaItem[];
}

interface EditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome: string;
  variant: "edicao";
  proximasList: TaskItem[];
  emAndamentoList: TaskItem[];
  concluidasList: TaskItem[];
}

type Props = VideomakerProps | EditorProps;

const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  concluida: "Concluída",
  aprovada: "Aprovada",
  agendado: "Agendado",
  postada: "Postada",
};

const PRIO_BADGE: Record<string, string> = {
  alta: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  media: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  baixa: "border-muted-foreground/30 text-muted-foreground",
};

function formatDateTimeBR(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

function formatDateOnlyBR(iso: string): string {
  // iso pode ser YYYY-MM-DD (sem hora) ou ISO completo
  const datePart = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

function formatDueDateBR(iso: string | null): string {
  if (!iso) return "Sem prazo";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

function GravacaoRow({ g }: { g: GravacaoItem }) {
  return (
    <Link
      href="/calendario"
      className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{g.titulo}</p>
        <p className="text-xs text-muted-foreground">{formatDateTimeBR(g.inicio)}</p>
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}

function CapturaRow({ c }: { c: CapturaItem }) {
  const href = c.task_id ? `/tarefas/${c.task_id}` : "/audiovisual";
  return (
    <Link
      href={href}
      className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">
          {c.cliente_nome ?? "Cliente —"}
          {c.task_titulo && <span className="ml-1 text-muted-foreground">· {c.task_titulo}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{formatDateOnlyBR(c.data_captacao)}</p>
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}

function TaskRow({ t }: { t: TaskItem }) {
  return (
    <Link
      href={`/tarefas/${t.id}`}
      className="flex items-start justify-between gap-2 rounded-lg border bg-card px-3 py-2 hover:bg-muted/40"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{t.titulo}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{STATUS_LABEL[t.status] ?? t.status}</span>
          <span>· Prazo {formatDueDateBR(t.due_date)}</span>
          {t.prioridade && (
            <span className={`rounded border px-1.5 py-0 text-[10px] uppercase ${PRIO_BADGE[t.prioridade] ?? ""}`}>
              {t.prioridade}
            </span>
          )}
        </div>
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}

function Section({
  icon,
  titulo,
  count,
  children,
}: {
  icon: React.ReactNode;
  titulo: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {titulo} ({count})
      </h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function MemberDetailDialog(props: Props) {
  const totalCount =
    props.variant === "videomaker"
      ? props.proximasList.length + props.hojeList.length + props.concluidasList.length
      : props.proximasList.length + props.emAndamentoList.length + props.concluidasList.length;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {props.variant === "videomaker" ? <Calendar className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />}
            {props.nome}
          </DialogTitle>
          <DialogDescription>
            {props.variant === "videomaker"
              ? "Gravações e capturas delegadas no período."
              : "Demandas de edição agrupadas por estado."}
          </DialogDescription>
        </DialogHeader>

        {totalCount === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nada pra mostrar no período.
          </p>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            {props.variant === "videomaker" ? (
              <>
                <Section icon={<Clock className="h-3.5 w-3.5" />} titulo="Hoje" count={props.hojeList.length}>
                  {props.hojeList.map((g) => <GravacaoRow key={g.id} g={g} />)}
                </Section>
                <Section icon={<Calendar className="h-3.5 w-3.5" />} titulo="Próximas" count={props.proximasList.length}>
                  {props.proximasList.map((g) => <GravacaoRow key={g.id} g={g} />)}
                </Section>
                <Section icon={<CheckCircle2 className="h-3.5 w-3.5" />} titulo="Concluídas no período" count={props.concluidasList.length}>
                  {props.concluidasList.map((c) => <CapturaRow key={c.id} c={c} />)}
                </Section>
              </>
            ) : (
              <>
                <Section icon={<ListTodo className="h-3.5 w-3.5" />} titulo="Próximas" count={props.proximasList.length}>
                  {props.proximasList.map((t) => <TaskRow key={t.id} t={t} />)}
                </Section>
                <Section icon={<Wrench className="h-3.5 w-3.5" />} titulo="Em andamento" count={props.emAndamentoList.length}>
                  {props.emAndamentoList.map((t) => <TaskRow key={t.id} t={t} />)}
                </Section>
                <Section icon={<CheckCircle2 className="h-3.5 w-3.5" />} titulo="Concluídas no período" count={props.concluidasList.length}>
                  {props.concluidasList.map((t) => <TaskRow key={t.id} t={t} />)}
                </Section>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check completo**

```bash
npm run typecheck
```

Expected: limpo (exceto pré-existente `web-push`).

- [ ] **Step 3: Lint dos 4 arquivos modificados**

```bash
npm run lint -- src/lib/dashboard/audiovisual.ts src/lib/dashboard/audiovisual-helpers.ts src/components/dashboard/audiovisual/EquipeAudiovisualSection.tsx src/components/dashboard/audiovisual/MemberRow.tsx src/components/dashboard/audiovisual/MemberDetailDialog.tsx
```

Expected: clean.

- [ ] **Step 4: Rodar testes existentes (sanity check de não-regressão)**

```bash
npx vitest run tests/unit/audiovisual-helpers.test.ts tests/unit/dashboard-personal.test.ts
```

Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/audiovisual/MemberDetailDialog.tsx
git commit -m "$(cat <<'EOF'
refactor(dashboard): dialog detalhe seccionado por estado

Videomaker: Hoje / Próximas / Concluídas no período (capturas delegadas).
Editor: Próximas / Em andamento / Concluídas no período.

CapturaRow linka pra /tarefas/<task_id> se delegada, senão /audiovisual.
TaskRow continua linkando pra /tarefas/<id>.

STATUS_LABEL ganha 'concluida' e 'agendado' que faltavam.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Push + abrir PR

- [ ] **Step 1: Verificar histórico**

```bash
git log --oneline origin/main..HEAD
```

Expected: 7 commits — 2 docs (spec + plano) + 5 fix (helpers + audiovisual.ts + section + row + dialog).

- [ ] **Step 2: Push**

```bash
git push -u origin claude/audiovisual-reestruturacao-equipe
```

Expected: nova branch no remote.

- [ ] **Step 3: Abrir PR**

```bash
gh pr create --base main --title "refactor(dashboard): Visão da Equipe com Próximas/Hoje/Concluídas + Em andamento" --body "$(cat <<'EOF'
## Problema

"Visão da Equipe" tinha 2 problemas semânticos:

1. **Videomaker "Concluídas no período" contava tasks** — mas videomaker quase não tem task, então o número ficava 0 ou desatualizado.
2. **"Próximas gravações" misturava passado e futuro** (filtro de 2 semanas pegava dias da semana atual que já passaram).

Editores também ganham granularidade (3 colunas em vez de 2).

## Mudança

**Videomakers — 3 colunas:**
- Próximas: gravações com \`inicio > fim-de-hoje-BRT\` (até 2 semanas)
- Hoje: gravações entre \`00:00\` e \`23:59\` BRT de hoje
- Concluídas: capturas com \`task_id != null\` (delegadas) no período do filtro

**Editores — 3 colunas:**
- Próximas: \`status = aberta\`
- Em andamento: \`status IN (em_andamento, alteracao)\`
- Concluídas: \`status IN (concluida, em_aprovacao, aprovada, agendado, postada)\` no período (anchor: \`completed_at\` / \`aprovada_em\` / \`updated_at\` com fallback via \`getTerminadoEm\`)

**Agregados do topo:**
- Próximas gravações (próximas + hoje)
- Em andamento (edição)
- Concluídas no período

**Dialog detalhe:** seccionado por estado com contagem, esconde seções vazias.

## Arquivos

- \`src/lib/dashboard/audiovisual-helpers.ts\` (novo) + tests
- \`src/lib/dashboard/audiovisual.ts\` (reescrito _impl + shape)
- \`src/components/dashboard/audiovisual/EquipeAudiovisualSection.tsx\` (3 colunas + 3 cards)
- \`src/components/dashboard/audiovisual/MemberRow.tsx\` (3 valores)
- \`src/components/dashboard/audiovisual/MemberDetailDialog.tsx\` (3 seções + labels)

## Cache

Bump key: \`dashboard-audiovisual-equipe-v2\` → \`v3\` (shape mudou). Tag \`AUDIOVISUAL_CAPTURAS_TAG\` adicionada — quando coord delega uma captura, a Visão atualiza.

## Test plan

- [ ] Videomaker com gravação amanhã + gravação hoje 9h + 1 captura delegada na semana → 1 / 1 / 1 na tabela
- [ ] Editor com 2 abertas + 1 em andamento + 1 alteracao + 3 concluídas no mês → 2 / 2 / 3
- [ ] Clique no membro abre dialog com seções e contagens corretas
- [ ] Mudar status de task em /tarefas → contadores atualizam em ≤60s (ou imediato via revalidateTag)
- [ ] Filtro de período (semana_atual, mes_atual, etc.) afeta "Concluídas" mas não "Próximas"/"Hoje"
- [ ] Empty state: videomaker sem nada → 0/0/0 + dialog mostra "Nada pra mostrar no período"

## Contexto

PR 2 de 4 do refactor "Dashboard Audiovisual — Revamp". Independente do PR #197 (filtro de pendentes).

Próximos:
- PR 3 — Painel Audiovisual novo (últimos 3 dias)
- PR 4 — Abas no /audiovisual (Pendente entrega + Pendente delegação)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: URL do PR retornada.

- [ ] **Step 4: Reportar URL pro usuário**

---

## Notas operacionais

**Bump de cache key.** `dashboard-audiovisual-equipe-v3` é necessário pq shape do retorno mudou. Sem bump, browsers/edge servers cached com o shape antigo serviriam dados que UI nova não consegue ler (TypeError em runtime). Seguindo a preferência registrada: cache key bump no MESMO PR que muda shape.

**Branch isolada (Task 0).** Branch nova a partir de `origin/main`, cherry-pick do spec + plano PR 2. PR independente do PR #197 (não empilhado).

**TDD pros helpers.** `audiovisual-helpers.ts` ganha testes unitários (date math é fácil de errar). O `_getEquipeAudiovisualImpl` não recebe teste unitário (depende de Supabase real); test plan manual cobre.

**Erro pré-existente.** `web-push` em `src/lib/push/server.ts` segue não-relacionado.
