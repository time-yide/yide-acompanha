# Dashboard Audiovisual Chefe — Plan

**Goal:** Substituir `StubGreeting` para `audiovisual_chefe` por dashboard com remuneração + visão da equipe (videomakers + editores).

**Spec:** [2026-05-05-dashboard-audiovisual-chefe-design.md](../specs/2026-05-05-dashboard-audiovisual-chefe-design.md)

**Branch:** `feat/dashboard-audiovisual-chefe` (baseado em `feat/dashboards-executores`/PR1; rebase em main após PR1 merge)

---

## Mapa de arquivos

**Criar:**
- `src/lib/dashboard/audiovisual.ts` — `getEquipeAudiovisual(periodo)` retorna `{ videomakers, editores, agregados }`
- `src/components/dashboard/personal/ComissaoCard.tsx` — KPI card chamando `calculateCommission`, link "Ver detalhes" pra `/comissoes`
- `src/components/dashboard/audiovisual/EquipeAudiovisualSection.tsx` — bloco de KPIs agregados + 2 tabelas
- `src/components/dashboard/DashboardAudiovisualChefe.tsx` — orquestrador
- `tests/unit/dashboard-audiovisual.test.ts` — testa agregação JS de equipe

**Modificar:**
- `src/app/(authed)/page.tsx` — adiciona branch `audiovisual_chefe`

---

## Tasks

### Task 1: Query module + testes

**File:** `src/lib/dashboard/audiovisual.ts`

```ts
// SERVER ONLY: do not import from client components
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolvePeriodo, type Periodo } from "./personal";

export interface VideomakerStat {
  id: string;
  nome: string;
  proximasGravacoes: number;
  concluidasNoPeriodo: number;
}

export interface EditorStat {
  id: string;
  nome: string;
  pendentes: number;
  concluidasNoPeriodo: number;
}

export interface EquipeAudiovisual {
  videomakers: VideomakerStat[];
  editores: EditorStat[];
  agregados: {
    totalGravacoesProximas: number;
    totalConcluidasNoPeriodo: number;
    totalPendentes: number;
  };
}

function getProximas14DiasBR(): { fromIso: string; toIso: string } {
  // Mesma lógica do DashboardVideomaker.getWeekRangeBR — segunda da semana atual → domingo da próxima em BRT
  const now = new Date();
  const brtOffsetMs = 3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() - brtOffsetMs);
  const day = brtNow.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  const monday = new Date(brtNow);
  monday.setUTCDate(brtNow.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sundayNextWeek = new Date(monday);
  sundayNextWeek.setUTCDate(monday.getUTCDate() + 13);
  sundayNextWeek.setUTCHours(23, 59, 59, 999);
  return {
    fromIso: new Date(monday.getTime() + brtOffsetMs).toISOString(),
    toIso: new Date(sundayNextWeek.getTime() + brtOffsetMs).toISOString(),
  };
}

async function _getEquipeAudiovisualImpl(periodo: Periodo): Promise<EquipeAudiovisual> {
  const supabase = createServiceRoleClient();
  const { fromIso: periodoFrom, toIso: periodoTo } = resolvePeriodo(periodo);
  const { fromIso: gravFrom, toIso: gravTo } = getProximas14DiasBR();

  // 1. Profiles ativos (videomaker + editor)
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, nome, role")
    .in("role", ["videomaker", "editor"])
    .eq("ativo", true)
    .order("nome");
  const profiles = ((profilesData ?? []) as Array<{ id: string; nome: string; role: string }>);
  if (profiles.length === 0) {
    return { videomakers: [], editores: [], agregados: { totalGravacoesProximas: 0, totalConcluidasNoPeriodo: 0, totalPendentes: 0 } };
  }
  const ids = profiles.map((p) => p.id);

  // 2. Em paralelo: tasks atribuídas (com participantes pra pendentes), gravações próximas
  const [tasksRes, gravRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, atribuido_a, participantes_ids, status, completed_at")
      .or(`atribuido_a.in.(${ids.join(",")}),participantes_ids.ov.{${ids.join(",")}}`),
    supabase
      .from("calendar_events")
      .select("id, participantes_ids, inicio")
      .eq("sub_calendar", "videomakers")
      .gte("inicio", gravFrom)
      .lte("inicio", gravTo),
  ]);

  const tasks = ((tasksRes.data ?? []) as Array<{
    id: string;
    atribuido_a: string | null;
    participantes_ids: string[] | null;
    status: string;
    completed_at: string | null;
  }>);
  const eventos = ((gravRes.data ?? []) as Array<{ id: string; participantes_ids: string[] | null; inicio: string }>);

  // 3. Agrega em JS
  const videomakers: VideomakerStat[] = profiles
    .filter((p) => p.role === "videomaker")
    .map((p) => {
      const proximasGravacoes = eventos.filter((e) => (e.participantes_ids ?? []).includes(p.id)).length;
      const concluidas = tasks.filter((t) =>
        t.atribuido_a === p.id &&
        t.status === "concluida" &&
        t.completed_at && t.completed_at >= periodoFrom && t.completed_at < periodoTo
      ).length;
      return { id: p.id, nome: p.nome, proximasGravacoes, concluidasNoPeriodo: concluidas };
    });

  const editores: EditorStat[] = profiles
    .filter((p) => p.role === "editor")
    .map((p) => {
      const pendentes = tasks.filter((t) =>
        t.status !== "concluida" &&
        (t.atribuido_a === p.id || (t.participantes_ids ?? []).includes(p.id))
      ).length;
      const concluidas = tasks.filter((t) =>
        t.atribuido_a === p.id &&
        t.status === "concluida" &&
        t.completed_at && t.completed_at >= periodoFrom && t.completed_at < periodoTo
      ).length;
      return { id: p.id, nome: p.nome, pendentes, concluidasNoPeriodo: concluidas };
    });

  return {
    videomakers,
    editores,
    agregados: {
      totalGravacoesProximas: videomakers.reduce((s, v) => s + v.proximasGravacoes, 0),
      totalConcluidasNoPeriodo: videomakers.reduce((s, v) => s + v.concluidasNoPeriodo, 0) + editores.reduce((s, e) => s + e.concluidasNoPeriodo, 0),
      totalPendentes: editores.reduce((s, e) => s + e.pendentes, 0),
    },
  };
}

export async function getEquipeAudiovisual(periodo: Periodo): Promise<EquipeAudiovisual> {
  const cached = unstable_cache(
    async (p: string) => _getEquipeAudiovisualImpl(p as Periodo),
    ["dashboard-audiovisual-equipe"],
    { revalidate: 60, tags: ["dashboard", "tasks", "calendar"] },
  );
  return cached(periodo);
}
```

Commit msg: `feat(dashboard): query getEquipeAudiovisual com agregados videomaker+editor`

### Task 2: ComissaoCard

**File:** `src/components/dashboard/personal/ComissaoCard.tsx`

```tsx
import Link from "next/link";
import { previewMyCommission } from "@/lib/comissoes/preview";

interface Props {
  userId: string;
}

function formatBRL(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function ComissaoCard({ userId }: Props) {
  const { result, monthRef } = await previewMyCommission(userId);
  const variavel = result?.snapshot.valor_variavel ?? 0;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Comissão estimada ({monthRef})
        </p>
        <Link href="/comissoes" className="text-xs text-primary hover:underline">
          Ver detalhes →
        </Link>
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums">{formatBRL(variavel)}</p>
    </div>
  );
}
```

Commit msg: `feat(dashboard): widget ComissaoCard com preview do mês`

### Task 3: EquipeAudiovisualSection

**File:** `src/components/dashboard/audiovisual/EquipeAudiovisualSection.tsx`

Section com:
- KPIs agregados (3 cards: gravações próximas / concluídas no período / pendentes da equipe)
- Header com `PeriodoSelector`
- Tabela "Videomakers" (Nome / Próximas gravações / Concluídas)
- Tabela "Editores" (Nome / Pendentes / Concluídas)

Implementação completa (resumida — segue padrão de tabela do projeto):

```tsx
import { getEquipeAudiovisual } from "@/lib/dashboard/audiovisual";
import { PeriodoSelector } from "@/components/dashboard/personal/PeriodoSelector";
import type { Periodo } from "@/lib/dashboard/personal";
import { Video, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  periodo: Periodo;
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
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" /> Concluídas no período
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalConcluidasNoPeriodo}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" /> Pendentes (editores)
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{agregados.totalPendentes}</p>
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
                  <th className="px-3 py-2 text-right font-medium">Próximas gravações</th>
                  <th className="px-3 py-2 text-right font-medium">Concluídas no período</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {videomakers.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{v.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.proximasGravacoes}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.concluidasNoPeriodo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground/70">Editores</h3>
        {editores.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            Nenhum editor ativo na equipe.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-right font-medium">Pendentes</th>
                  <th className="px-3 py-2 text-right font-medium">Concluídas no período</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {editores.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{e.nome}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.pendentes}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{e.concluidasNoPeriodo}</td>
                  </tr>
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

Commit msg: `feat(dashboard): EquipeAudiovisualSection com KPIs agregados + 2 tabelas`

### Task 4: DashboardAudiovisualChefe

**File:** `src/components/dashboard/DashboardAudiovisualChefe.tsx`

```tsx
import { FixoCard } from "./personal/FixoCard";
import { ComissaoCard } from "./personal/ComissaoCard";
import { EquipeAudiovisualSection } from "./audiovisual/EquipeAudiovisualSection";
import type { Periodo } from "@/lib/dashboard/personal";

interface Props {
  userId: string;
  nome: string;
  periodo?: Periodo;
}

export async function DashboardAudiovisualChefe({ userId, nome, periodo = "mes_atual" }: Props) {
  const primeiroNome = nome.split(" ")[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Olá, {primeiroNome}</h1>
        <p className="text-sm text-muted-foreground">Sua remuneração e a equipe audiovisual.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <FixoCard userId={userId} />
        <ComissaoCard userId={userId} />
      </div>

      <EquipeAudiovisualSection periodo={periodo} />
    </div>
  );
}
```

Commit msg: `feat(dashboard): DashboardAudiovisualChefe orquestrando widgets`

### Task 5: Roteamento

**File:** `src/app/(authed)/page.tsx`

Adicionar import de `DashboardAudiovisualChefe` e o branch antes do `StubGreeting`:

```tsx
if (user.role === "audiovisual_chefe") {
  return <DashboardAudiovisualChefe userId={user.id} nome={user.nome} periodo={periodo} />;
}
```

Commit msg: `feat(dashboard): rotear audiovisual_chefe pro dashboard novo`

### Task 6: Verificação + push + PR

- Typecheck: `npx tsc --noEmit`
- Push: `git push -u origin feat/dashboard-audiovisual-chefe`
- gh pr create — usar template do PR1 como referência

---

## Cuidado com rebase pós-merge do PR1

Quando PR1 (#73) for squash-merged em main, esta branch vai precisar:
1. `git fetch origin`
2. `git rebase origin/main` — vai descartar os 13 commits de PR1 (que viraram 1 squash em main) e manter só os de PR2
3. `git push --force-with-lease`

Alternativa: aguardar PR1 mergear, criar nova branch a partir de origin/main, copiar os arquivos novos pra ela.
