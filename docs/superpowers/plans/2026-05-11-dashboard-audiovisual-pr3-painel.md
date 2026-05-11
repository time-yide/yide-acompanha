# PR 3 — Painel Audiovisual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um painel novo "Audiovisual" no dashboard mostrando captações realizadas nos últimos 3 dias (pela `data_captacao`), com cliente, responsável, quantidade de vídeos/fotos e status atual derivado. Visível em 5 dashboards de gestão.

**Architecture:** Componente novo `PainelAudiovisualSection` (server component) consome `getPainelAudiovisual` (server-only, cacheada). Status derivado por função pura testada. Montado em 5 dashboards via uma linha de import + JSX.

**Tech Stack:** Next.js (app router), Supabase JS client, `unstable_cache` + tag invalidation, TypeScript estrito, vitest pra tests.

**Spec de referência:** [`docs/superpowers/specs/2026-05-11-dashboard-audiovisual-revamp-design.md`](../specs/2026-05-11-dashboard-audiovisual-revamp-design.md) — PR 3.

---

## Task 0: Preparar branch isolada a partir de `main`

**Files:** nenhum.

- [ ] **Step 1: Verificar working tree limpo + anotar hashes**

```bash
git status
git log --oneline -5
```

Anotar: hash do spec doc (commit `docs(spec): revamp dashboard audiovisual em 4 PRs`) e hash do plano PR 3 (este).

- [ ] **Step 2: Branch nova + cherry-pick**

```bash
git fetch origin main
git switch -c claude/audiovisual-painel origin/main
git cherry-pick <spec_hash> <plano_pr3_hash>
```

- [ ] **Step 3: Confirmar**

```bash
git log --oneline origin/main..HEAD
```

Expected: 2 commits (spec + plano PR 3).

---

## Task 1: Data layer + tests do `derivarStatusAtual`

**Files:**
- Create: `src/lib/dashboard/audiovisual-painel.ts`
- Create: `tests/unit/audiovisual-painel.test.ts`

`derivarStatusAtual` é função pura testável; `getPainelAudiovisual` faz query Supabase.

- [ ] **Step 1: Test failing pra função pura**

`tests/unit/audiovisual-painel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { derivarStatusAtual } from "@/lib/dashboard/audiovisual-painel";

describe("derivarStatusAtual", () => {
  it("concluida_em setado -> Concluída", () => {
    const r = derivarStatusAtual({ concluida_em: "2026-05-11T10:00:00Z", task: null });
    expect(r.statusAtual).toBe("Concluída");
    expect(r.statusDetalhe).toBe(null);
  });

  it("task em postada -> Concluída", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "postada" } });
    expect(r.statusAtual).toBe("Concluída");
    expect(r.statusDetalhe).toBe(null);
  });

  it("task em em_andamento -> Em edição: Em andamento", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "em_andamento" } });
    expect(r.statusAtual).toBe("Em edição");
    expect(r.statusDetalhe).toBe("Em andamento");
  });

  it("task em alteracao -> Em edição: Alteração", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "alteracao" } });
    expect(r.statusAtual).toBe("Em edição");
    expect(r.statusDetalhe).toBe("Alteração");
  });

  it("task em aberta -> Em edição: Aberta", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "aberta" } });
    expect(r.statusAtual).toBe("Em edição");
    expect(r.statusDetalhe).toBe("Aberta");
  });

  it("task em em_aprovacao -> Em edição: Em aprovação", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: { status: "em_aprovacao" } });
    expect(r.statusAtual).toBe("Em edição");
    expect(r.statusDetalhe).toBe("Em aprovação");
  });

  it("sem task -> Aguardando delegação", () => {
    const r = derivarStatusAtual({ concluida_em: null, task: null });
    expect(r.statusAtual).toBe("Aguardando delegação");
    expect(r.statusDetalhe).toBe(null);
  });

  it("concluida_em tem prioridade sobre task postada", () => {
    const r = derivarStatusAtual({ concluida_em: "2026-05-11T10:00:00Z", task: { status: "postada" } });
    expect(r.statusAtual).toBe("Concluída");
  });

  it("concluida_em tem prioridade sobre task em_andamento", () => {
    const r = derivarStatusAtual({ concluida_em: "2026-05-11T10:00:00Z", task: { status: "em_andamento" } });
    expect(r.statusAtual).toBe("Concluída");
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npx vitest run tests/unit/audiovisual-painel.test.ts
```

Expected: FAIL com módulo inexistente.

- [ ] **Step 3: Criar `src/lib/dashboard/audiovisual-painel.ts`**

```ts
// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { AUDIOVISUAL_CAPTURAS_TAG } from "@/lib/audiovisual/queries";

export type StatusAtual = "Concluída" | "Em edição" | "Aguardando delegação";

export interface CapturaPainelRow {
  id: string;
  data_captacao: string;
  cliente_nome: string;
  videomaker_nome: string;
  qtd_videos: number;
  qtd_fotos: number;
  statusAtual: StatusAtual;
  statusDetalhe: string | null;
  taskId: string | null;
}

const TASK_STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  alteracao: "Alteração",
  em_aprovacao: "Em aprovação",
  concluida: "Concluída",
  aprovada: "Aprovada",
  agendado: "Agendado",
  postada: "Postada",
};

/**
 * Pure function: deriva o status visível na UI a partir da captura + task vinculada.
 *   concluida_em != null  -> "Concluída"
 *   task.status == postada -> "Concluída"
 *   task != null           -> "Em edição" + label do status da task
 *   sem task               -> "Aguardando delegação"
 */
export function derivarStatusAtual(input: {
  concluida_em: string | null;
  task: { status: string } | null;
}): { statusAtual: StatusAtual; statusDetalhe: string | null } {
  if (input.concluida_em) return { statusAtual: "Concluída", statusDetalhe: null };
  if (input.task?.status === "postada") return { statusAtual: "Concluída", statusDetalhe: null };
  if (input.task) {
    const label = TASK_STATUS_LABEL[input.task.status] ?? input.task.status;
    return { statusAtual: "Em edição", statusDetalhe: label };
  }
  return { statusAtual: "Aguardando delegação", statusDetalhe: null };
}

interface CapturaMinimal {
  id: string;
  data_captacao: string;
  qtd_videos: number | null;
  qtd_fotos: number | null;
  concluida_em: string | null;
  task_id: string | null;
  cliente: { nome: string } | null;
  videomaker: { nome: string } | null;
  task: { status: string } | null;
}

async function _getPainelAudiovisualImpl(): Promise<CapturaPainelRow[]> {
  const supabase = createServiceRoleClient();

  // 3 dias atrás em BRT: hoje BRT - 3 dias. Pra simplicidade, usa 4 dias no passado em UTC
  // (cobre fuso) e filtra por string YYYY-MM-DD do data_captacao.
  const ref = new Date();
  const brtNow = new Date(ref.getTime() - 3 * 60 * 60 * 1000);
  const cutoffDate = new Date(brtNow);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - 3);
  const cutoffStr = cutoffDate.toISOString().slice(0, 10); // YYYY-MM-DD

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("audiovisual_capturas")
    .select(`
      id, data_captacao, qtd_videos, qtd_fotos, concluida_em, task_id,
      cliente:clients(nome),
      videomaker:profiles!audiovisual_capturas_videomaker_id_fkey(nome),
      task:tasks!task_id(status)
    `)
    .gte("data_captacao", cutoffStr)
    .order("data_captacao", { ascending: false });

  if (error || !data) return [];

  return (data as CapturaMinimal[]).map((c) => {
    const { statusAtual, statusDetalhe } = derivarStatusAtual({
      concluida_em: c.concluida_em,
      task: c.task,
    });
    return {
      id: c.id,
      data_captacao: c.data_captacao,
      cliente_nome: c.cliente?.nome ?? "—",
      videomaker_nome: c.videomaker?.nome ?? "—",
      qtd_videos: c.qtd_videos ?? 0,
      qtd_fotos: c.qtd_fotos ?? 0,
      statusAtual,
      statusDetalhe,
      taskId: c.task_id,
    };
  });
}

export async function getPainelAudiovisual(): Promise<CapturaPainelRow[]> {
  const cached = unstable_cache(
    _getPainelAudiovisualImpl,
    ["dashboard-audiovisual-painel-v1"],
    { revalidate: 60, tags: ["dashboard", AUDIOVISUAL_CAPTURAS_TAG, "tasks"] },
  );
  return cached();
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/unit/audiovisual-painel.test.ts
```

Expected: 9 testes passam.

- [ ] **Step 5: Lint**

```bash
npm run lint -- src/lib/dashboard/audiovisual-painel.ts tests/unit/audiovisual-painel.test.ts
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard/audiovisual-painel.ts tests/unit/audiovisual-painel.test.ts
git commit -m "$(cat <<'EOF'
feat(dashboard): query e helper do painel audiovisual

getPainelAudiovisual retorna capturas dos últimos 3 dias (pela
data_captacao) com cliente, videomaker, qtds e status derivado.

derivarStatusAtual é pura, testada com 9 casos:
  concluida_em -> Concluída (prioridade máxima)
  task.postada -> Concluída
  task.<outro> -> Em edição + label da task
  sem task     -> Aguardando delegação

Cache: 60s + tags [dashboard, AUDIOVISUAL_CAPTURAS_TAG, tasks].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Componente UI `PainelAudiovisualSection.tsx`

**Files:**
- Create: `src/components/dashboard/audiovisual/PainelAudiovisualSection.tsx`

Server component. Tabela responsiva. Linha clicável → /tarefas/<id> ou /audiovisual.

- [ ] **Step 1: Criar o arquivo**

```tsx
import Link from "next/link";
import { Film, CheckCircle2, Wrench, AlertCircle } from "lucide-react";
import { getPainelAudiovisual, type CapturaPainelRow, type StatusAtual } from "@/lib/dashboard/audiovisual-painel";

function formatDateBR(iso: string): string {
  const datePart = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function StatusBadge({ status, detalhe }: { status: StatusAtual; detalhe: string | null }) {
  const config: Record<StatusAtual, { className: string; icon: React.ReactNode; label: string }> = {
    "Concluída": {
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Concluída",
    },
    "Em edição": {
      className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      icon: <Wrench className="h-3 w-3" />,
      label: detalhe ? `Em edição: ${detalhe}` : "Em edição",
    },
    "Aguardando delegação": {
      className: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400",
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Aguardando delegação",
    },
  };
  const c = config[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.className}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

function RowLink({ row, children }: { row: CapturaPainelRow; children: React.ReactNode }) {
  const href = row.taskId ? `/tarefas/${row.taskId}` : "/audiovisual";
  return (
    <Link href={href} className="block hover:bg-muted/30">
      {children}
    </Link>
  );
}

export async function PainelAudiovisualSection() {
  const rows = await getPainelAudiovisual();

  const totalCount = rows.length;
  const totalVideos = rows.reduce((s, r) => s + r.qtd_videos, 0);
  const totalFotos = rows.reduce((s, r) => s + r.qtd_fotos, 0);

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-foreground/80">
            <Film className="h-4 w-4" /> Audiovisual — Últimos 3 dias
          </h2>
          {totalCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {totalCount} captação{totalCount === 1 ? "" : "ões"} · {totalVideos} vídeo{totalVideos === 1 ? "" : "s"} · {totalFotos} foto{totalFotos === 1 ? "" : "s"}
            </p>
          )}
        </div>
      </div>

      {totalCount === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Nenhuma captação nos últimos 3 dias.
        </p>
      ) : (
        <>
          {/* Mobile: lista de cards */}
          <div className="space-y-2 md:hidden">
            {rows.map((r) => (
              <RowLink key={r.id} row={r}>
                <div className="space-y-1 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">{formatDateBR(r.data_captacao)}</span>
                    <StatusBadge status={r.statusAtual} detalhe={r.statusDetalhe} />
                  </div>
                  <p className="truncate text-sm font-medium">{r.cliente_nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.videomaker_nome} · {r.qtd_videos}v · {r.qtd_fotos}f
                  </p>
                </div>
              </RowLink>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                  <th className="px-3 py-2 text-left font-medium">Cliente</th>
                  <th className="px-3 py-2 text-left font-medium">Responsável</th>
                  <th className="px-3 py-2 text-left font-medium">Quantidade</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 tabular-nums">
                      <RowLink row={r}><span className="block">{formatDateBR(r.data_captacao)}</span></RowLink>
                    </td>
                    <td className="px-3 py-2"><RowLink row={r}>{r.cliente_nome}</RowLink></td>
                    <td className="px-3 py-2 text-muted-foreground"><RowLink row={r}>{r.videomaker_nome}</RowLink></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground"><RowLink row={r}>{r.qtd_videos}v · {r.qtd_fotos}f</RowLink></td>
                    <td className="px-3 py-2"><RowLink row={r}><StatusBadge status={r.statusAtual} detalhe={r.statusDetalhe} /></RowLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Lint + typecheck**

```bash
npm run lint -- src/components/dashboard/audiovisual/PainelAudiovisualSection.tsx
npm run typecheck 2>&1 | grep -E "(error TS|PainelAudio)" | head -5
```

Expected: clean (apenas web-push pré-existente).

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/audiovisual/PainelAudiovisualSection.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): PainelAudiovisualSection — captações dos últimos 3 dias

Tabela desktop / cards mobile com:
  Data · Cliente · Responsável · Quantidade (Xv · Yf) · Status

StatusBadge com cores semânticas:
  verde Concluída · âmbar Em edição: <detalhe> · vermelho Aguardando delegação

Linha clicável -> /tarefas/<id> se delegada, /audiovisual senão.
Header tem totais agregados (capturas, vídeos, fotos).
Empty state quando 0 capturas.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Montar nos 5 dashboards de gestão

**Files:**
- Modify: `src/components/dashboard/DashboardAudiovisualChefe.tsx`
- Modify: `src/components/dashboard/DashboardCoord.tsx`
- Modify: `src/components/dashboard/DashboardAssessor.tsx`
- Modify: `src/components/dashboard/DashboardAdm.tsx`
- Modify: `src/components/dashboard/DashboardSocioAdm.tsx`

Em cada um, adicionar import + `<PainelAudiovisualSection />` antes do `</div>` final do JSX. Pra `DashboardSocioAdm` (que usa Suspense), envolver em `<Suspense fallback={...}>`.

- [ ] **Step 1: DashboardAudiovisualChefe**

Adicionar import depois do existente:
```tsx
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
```

Adicionar antes do `</div>` final (depois de `<EquipeAudiovisualSection ... />`):
```tsx
<PainelAudiovisualSection />
```

- [ ] **Step 2: DashboardCoord, DashboardAssessor, DashboardAdm**

Mesmo padrão: import + `<PainelAudiovisualSection />` antes do `</div>` final. Em cada arquivo, o caminho relativo do import é `./audiovisual/PainelAudiovisualSection`.

Verificar que cada arquivo existe e onde encaixar:

```bash
grep -n "</div>" src/components/dashboard/DashboardCoord.tsx | tail -3
grep -n "</div>" src/components/dashboard/DashboardAssessor.tsx | tail -3
grep -n "</div>" src/components/dashboard/DashboardAdm.tsx | tail -3
```

Posicionar como última seção, antes do `</HiddenValuesProvider>` ou `</div>` raiz.

- [ ] **Step 3: DashboardSocioAdm (com Suspense pra match com o padrão)**

Adicionar imports:
```tsx
import { PainelAudiovisualSection } from "./audiovisual/PainelAudiovisualSection";
import { ListSkeleton } from "./ui/ListSkeleton"; // se ainda não importado — provavelmente já é
```

Adicionar antes do `</div>` final raiz:
```tsx
<Suspense fallback={<ListSkeleton rows={4} />}>
  <PainelAudiovisualSection />
</Suspense>
```

Se `Suspense` ainda não estiver importado no arquivo, importar de `react`.

- [ ] **Step 4: Type-check + lint**

```bash
npm run typecheck 2>&1 | grep -E "error TS" | grep -v "web-push" | head -10
npm run lint -- src/components/dashboard/DashboardAudiovisualChefe.tsx src/components/dashboard/DashboardCoord.tsx src/components/dashboard/DashboardAssessor.tsx src/components/dashboard/DashboardAdm.tsx src/components/dashboard/DashboardSocioAdm.tsx
```

Expected: clean (apenas web-push pré-existente).

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/DashboardAudiovisualChefe.tsx src/components/dashboard/DashboardCoord.tsx src/components/dashboard/DashboardAssessor.tsx src/components/dashboard/DashboardAdm.tsx src/components/dashboard/DashboardSocioAdm.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): PainelAudiovisualSection em 5 dashboards de gestão

Audiovisual_chefe, Coord, Assessor, Adm e SocioAdm ganham o painel
de captações dos últimos 3 dias. Em SocioAdm, envolvido em Suspense
pra match com o padrão do arquivo.

Mesmo componente em todos — visão consolidada da operação audiovisual
recente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Push + abrir PR

- [ ] **Step 1: Verificar histórico**

```bash
git log --oneline origin/main..HEAD
```

Expected: 5 commits (2 docs + 1 data layer + 1 UI + 1 montagem).

- [ ] **Step 2: Push**

```bash
git push -u origin claude/audiovisual-painel
```

- [ ] **Step 3: Abrir PR**

```bash
gh pr create --base main --title "feat(dashboard): painel Audiovisual — captações dos últimos 3 dias" --body "$(cat <<'EOF'
## O que entrega

Painel novo no dashboard mostrando captações realizadas nos últimos 3 dias (pela `data_captacao`) com cliente, responsável, quantidade detalhada de vídeos/fotos e status atual derivado.

## Visibilidade

Mesmo componente em 5 dashboards de gestão:
- DashboardAudiovisualChefe
- DashboardCoord
- DashboardAssessor
- DashboardAdm
- DashboardSocioAdm

Sem filtro por usuário — visão consolidada da operação audiovisual recente.

## Status derivado

\`derivarStatusAtual\` (pura, testada):
- \`concluida_em != null\` → **Concluída** (verde)
- \`task.status == postada\` → **Concluída** (verde)
- \`task != null\` → **Em edição: \<label da task\>** (âmbar)
- sem task → **Aguardando delegação** (vermelho)

## UI

- Desktop: tabela com Data | Cliente | Responsável | Quantidade (Xv · Yf) | Status badge
- Mobile: lista de cards
- Linha clicável → /tarefas/<task_id> se delegada, /audiovisual senão
- Header com totais: N captações · X vídeos · Y fotos
- Empty state quando 0 capturas

## Cache

\`unstable_cache\` com revalidate 60s, key \`dashboard-audiovisual-painel-v1\`, tags \`[dashboard, AUDIOVISUAL_CAPTURAS_TAG, tasks]\`.

Invalidação automática quando:
- Videomaker entrega captura → \`createCapturaAction\` revalida \`AUDIOVISUAL_CAPTURAS_TAG\`
- Coord delega pra editor → \`delegateCapturaAction\` revalida \`AUDIOVISUAL_CAPTURAS_TAG\`
- Editor muda status de task → revalida tag \`tasks\`

## Test plan

- [ ] Criar captura nova → aparece com "Aguardando delegação"
- [ ] Delegar pra editor → muda pra "Em edição: Aberta"
- [ ] Editor muda status pra em_andamento → "Em edição: Em andamento"
- [ ] Editor marca postada → "Concluída"
- [ ] markCapturaConcluidaAction (concluida_em) → "Concluída"
- [ ] Captura há 4 dias → não aparece
- [ ] Captura de hoje → aparece
- [ ] Mobile: cards renderizam corretamente
- [ ] Desktop: tabela com 5 colunas
- [ ] Linha clicável navega corretamente

## Contexto

PR 3 de 4 do refactor "Dashboard Audiovisual — Revamp". Independente dos PRs #197 e #198.

Próximo:
- PR 4 — Abas no /audiovisual (Pendente entrega + Pendente delegação)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Notas operacionais

- **Cache key v1** — primeira versão do shape; bumps futuros se mudar.
- **Janela de "3 dias"** — implementada como `data_captacao >= hoje_BRT - 3 dias`, inclusiva. Hoje + 3 anteriores = 4 dias possíveis.
- **`as any` cast** — consistente com pattern em `audiovisual.ts` e `queries.ts` (Supabase JS client tem inferência limitada pra joins nested).
- **5 dashboards alterados** — todos com mesma linha simples; risk de regressão muito baixo.
