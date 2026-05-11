# PR 4 — Abas em /audiovisual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar `/audiovisual` em 3 abas: **Capturas** (atual), **Pendente de entrega** (gravações sem captura) e **Pendente de delegação** (capturas sem task, visível só pra coord+). Permite consultar estados intermediários da captação sem poluir os contadores do dashboard.

**Architecture:** Server-side tabs via `?tab=` URL param (sem state client-side). 2 queries novas (`listEventosSemCaptura`, `listCapturasSemDelegacao`) reutilizando tags existentes. Conteúdo atual da página extraído pra `CapturasAba.tsx` pra manter a `page.tsx` enxuta.

**Tech Stack:** Next.js (app router), Supabase JS client, `unstable_cache` + tag invalidation, TypeScript estrito.

**Spec de referência:** [`docs/superpowers/specs/2026-05-11-dashboard-audiovisual-revamp-design.md`](../specs/2026-05-11-dashboard-audiovisual-revamp-design.md) — PR 4.

---

## Task 0: Branch isolada

Already done in session — branch `claude/audiovisual-abas` from `origin/main`. Just commit this plan first.

- [ ] **Step 1: Commit do plano**

```bash
git add docs/superpowers/plans/2026-05-11-dashboard-audiovisual-pr4-abas.md
git commit -m "$(cat <<'EOF'
docs(plan): plano de implementação do PR 4 — abas em /audiovisual

4 tasks:
- Task 1: queries listEventosSemCaptura + listCapturasSemDelegacao
- Task 2: extract CapturasAba + componentes das 2 abas novas
- Task 3: restructure page.tsx com tabs server-side
- Task 4: push + PR

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: Queries novas em `src/lib/audiovisual/queries.ts`

**Files:**
- Modify: `src/lib/audiovisual/queries.ts`

Adicionar 2 funções server-side cacheadas:
- `listEventosSemCaptura({ videomakerId? })` — gravações passadas (sub_calendar='videomakers') sem captura entregue
- `listCapturasSemDelegacao()` — capturas com task_id NULL e concluida_em NULL

### Step 1: Adicionar tipo + função listEventosSemCaptura

Insira esses tipos e função após o tipo `PendenteEvento` existente (depois de `countOverdueParaVideomaker`):

```ts
export interface EventoSemCapturaRow {
  event_id: string;
  titulo: string;
  inicio: string;
  client_id: string | null;
  client_nome: string | null;
  videomaker_id: string;
  videomaker_nome: string | null;
  isOverdue: boolean;
}

/**
 * Lista eventos de gravação passados onde nenhuma captura foi entregue.
 * Quando `videomakerId` é passado, restringe pras gravações dele;
 * sem filtro, retorna de todos os videomakers ativos.
 *
 * Usado nas abas /audiovisual?tab=pendente_entrega.
 */
export async function listEventosSemCaptura(options: { videomakerId?: string } = {}): Promise<EventoSemCapturaRow[]> {
  const cached = unstable_cache(
    async (videomakerId: string | undefined) => _listEventosSemCapturaImpl({ videomakerId }),
    ["audiovisual-eventos-sem-captura-v1"],
    { revalidate: 30, tags: [AUDIOVISUAL_PENDENTE_TAG, AUDIOVISUAL_CAPTURAS_TAG] },
  );
  return cached(options.videomakerId);
}

async function _listEventosSemCapturaImpl(options: { videomakerId?: string }): Promise<EventoSemCapturaRow[]> {
  const supabase = createServiceRoleClient();
  const now = new Date();

  // Eventos passados na agenda dos videomakers
  let q = supabase
    .from("calendar_events")
    .select("id, titulo, inicio, client_id, participantes_ids, cliente:clients(id, nome)")
    .eq("sub_calendar", "videomakers")
    .lt("inicio", now.toISOString())
    .order("inicio", { ascending: false })
    .limit(200);

  if (options.videomakerId) {
    q = q.contains("participantes_ids", [options.videomakerId]);
  }
  const { data: events, error } = await q;
  if (error || !events) return [];
  if (events.length === 0) return [];

  const eventIds = (events as Array<{ id: string }>).map((e) => e.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: capturas } = await sb
    .from("audiovisual_capturas")
    .select("event_id")
    .in("event_id", eventIds);
  const captured = new Set(((capturas ?? []) as Array<{ event_id: string | null }>).map((c) => c.event_id));

  // Pra montar nome dos videomakers em modo "todos", lookup batch nos participantes
  const profileIds = new Set<string>();
  for (const e of events as Array<{ participantes_ids: string[] | null }>) {
    for (const pid of e.participantes_ids ?? []) profileIds.add(pid);
  }
  let profilesMap = new Map<string, string>();
  if (profileIds.size > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nome")
      .in("id", Array.from(profileIds));
    profilesMap = new Map(((profiles ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]));
  }

  const rows: EventoSemCapturaRow[] = [];
  for (const e of events as Array<{
    id: string;
    titulo: string;
    inicio: string;
    client_id: string | null;
    participantes_ids: string[] | null;
    cliente: { id: string; nome: string } | null;
  }>) {
    if (captured.has(e.id)) continue;
    const partIds = e.participantes_ids ?? [];
    // Quando há múltiplos participantes, emite uma linha por videomaker
    // (cada um precisa entregar sua captura). Se options.videomakerId, filtra.
    for (const pid of partIds) {
      if (options.videomakerId && pid !== options.videomakerId) continue;
      rows.push({
        event_id: e.id,
        titulo: e.titulo,
        inicio: e.inicio,
        client_id: e.client_id,
        client_nome: e.cliente?.nome ?? null,
        videomaker_id: pid,
        videomaker_nome: profilesMap.get(pid) ?? null,
        isOverdue: now > getDeadline(e.inicio),
      });
    }
  }
  return rows;
}
```

### Step 2: Adicionar listCapturasSemDelegacao

Insira depois da listCapturas:

```ts
export interface CapturaSemDelegacaoRow {
  id: string;
  data_captacao: string;
  drive_url: string;
  qtd_videos: number;
  qtd_fotos: number;
  client_id: string;
  cliente_nome: string | null;
  videomaker_id: string;
  videomaker_nome: string | null;
}

/**
 * Lista capturas entregues que ainda não foram delegadas pra editor
 * (task_id IS NULL) e não foram marcadas como concluídas manualmente.
 *
 * Usado em /audiovisual?tab=pendente_delegacao (visível só pra coord+).
 */
export async function listCapturasSemDelegacao(): Promise<CapturaSemDelegacaoRow[]> {
  const cached = unstable_cache(
    async () => _listCapturasSemDelegacaoImpl(),
    ["audiovisual-sem-delegacao-v1"],
    { revalidate: 30, tags: [AUDIOVISUAL_CAPTURAS_TAG] },
  );
  return cached();
}

async function _listCapturasSemDelegacaoImpl(): Promise<CapturaSemDelegacaoRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("audiovisual_capturas")
    .select(`
      id, data_captacao, drive_url, qtd_videos, qtd_fotos, client_id, videomaker_id,
      cliente:clients(nome),
      videomaker:profiles!audiovisual_capturas_videomaker_id_fkey(nome)
    `)
    .is("task_id", null)
    .is("concluida_em", null)
    .order("data_captacao", { ascending: false })
    .limit(200);

  if (error || !data) return [];

  return (data as Array<{
    id: string;
    data_captacao: string;
    drive_url: string;
    qtd_videos: number | null;
    qtd_fotos: number | null;
    client_id: string;
    videomaker_id: string;
    cliente: { nome: string } | null;
    videomaker: { nome: string } | null;
  }>).map((c) => ({
    id: c.id,
    data_captacao: c.data_captacao,
    drive_url: c.drive_url,
    qtd_videos: c.qtd_videos ?? 0,
    qtd_fotos: c.qtd_fotos ?? 0,
    client_id: c.client_id,
    cliente_nome: c.cliente?.nome ?? null,
    videomaker_id: c.videomaker_id,
    videomaker_nome: c.videomaker?.nome ?? null,
  }));
}
```

### Step 3: Verificar lint + typecheck

```bash
npm run lint -- src/lib/audiovisual/queries.ts
npm run typecheck 2>&1 | grep -v "web-push" | grep "error TS" | head -5
```

Expected: clean.

### Step 4: Commit

```bash
git add src/lib/audiovisual/queries.ts
git commit -m "$(cat <<'EOF'
feat(audiovisual): queries pra abas Pendente entrega + Pendente delegação

listEventosSemCaptura({ videomakerId? }): gravações passadas sem captura.
  - Sem filtro: todos os videomakers ativos
  - Com videomakerId: só dele
  - Emite linha por videomaker quando evento tem múltiplos participantes
  - Marca isOverdue se passou do prazo D+1 09h

listCapturasSemDelegacao(): capturas com task_id IS NULL e concluida_em IS NULL.
  - Pra coord delegar pendências de delegação

Ambas cacheadas 30s. Tags: AUDIOVISUAL_PENDENTE_TAG + AUDIOVISUAL_CAPTURAS_TAG.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Componentes das abas

**Files:**
- Create: `src/components/audiovisual/PendenteEntregaAba.tsx`
- Create: `src/components/audiovisual/PendenteDelegacaoAba.tsx`
- Create: `src/components/audiovisual/CapturasAba.tsx`

### Step 1: Criar `CapturasAba.tsx`

Extrai o conteúdo atual da `/audiovisual/page.tsx` (form + lista de capturas) — vira componente que recebe props já resolvidas.

```tsx
import { Suspense } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CapturaForm } from "./CapturaForm";
import { CapturasOrganizadas } from "./CapturasOrganizadas";
import { AudiovisualToastFlash } from "./AudiovisualToastFlash";
import type { CapturaRow } from "@/lib/audiovisual/captura-utils";
import type { PendenteEvento } from "@/lib/audiovisual/queries";

interface Props {
  isVideomaker: boolean;
  canDelegate: boolean;
  pendentes: PendenteEvento[];
  overdue: PendenteEvento[];
  clientes: Array<{ id: string; nome: string }>;
  capturas: CapturaRow[];
  editores: Array<{ id: string; nome: string }>;
}

export function CapturasAba({
  isVideomaker,
  canDelegate,
  pendentes,
  overdue,
  clientes,
  capturas,
  editores,
}: Props) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AudiovisualToastFlash />
      </Suspense>

      {isVideomaker && overdue.length > 0 && (
        <Card className="space-y-2 border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">
                Você tem {overdue.length} captação(ões) atrasada(s)
              </p>
              <p className="text-xs">
                O prazo é até 09h do dia seguinte à gravação. Enquanto não regularizar, seu acesso pode ser limitado em outras áreas do sistema.
              </p>
            </div>
          </div>
        </Card>
      )}

      {isVideomaker && pendentes.length > 0 && (
        <Card className="space-y-2 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4" />
            Gravações pendentes de entrega ({pendentes.length})
          </h2>
          <ul className="space-y-1.5 text-xs">
            {pendentes.map((p) => (
              <li key={p.event_id} className="flex flex-wrap items-center gap-2">
                <span className={p.isOverdue ? "font-semibold text-destructive" : "text-muted-foreground"}>
                  {new Date(p.inicio).toLocaleDateString("pt-BR")} · {p.titulo}
                  {p.client_nome ? ` · ${p.client_nome}` : ""}
                </span>
                {p.isOverdue && (
                  <span className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    ATRASADA
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isVideomaker && <CapturaForm clientes={clientes} pendentes={pendentes} />}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
          {isVideomaker ? "Minhas captações" : "Captações da equipe"}
          <span className="ml-1 text-xs font-normal text-muted-foreground">({capturas.length})</span>
        </h2>
        <CapturasOrganizadas
          capturas={capturas}
          showVideomaker={!isVideomaker}
          editores={editores}
          canDelegate={canDelegate}
        />
      </section>
    </div>
  );
}
```

### Step 2: Criar `PendenteEntregaAba.tsx`

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CapturaForm } from "./CapturaForm";
import type { EventoSemCapturaRow } from "@/lib/audiovisual/queries";

interface Props {
  rows: EventoSemCapturaRow[];
  /** Quando true, mostra coluna do videomaker. Pro próprio videomaker, oculta (é redundante). */
  showVideomaker: boolean;
  /** Quando true, clique abre dialog com CapturaForm pra entregar inline. */
  canDeliver: boolean;
  clientes: Array<{ id: string; nome: string }>;
}

function formatDateBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatTimeBR(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function PendenteEntregaAba({ rows, showVideomaker, canDeliver, clientes }: Props) {
  const [openEvent, setOpenEvent] = useState<EventoSemCapturaRow | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma gravação pendente de entrega. ✨
      </p>
    );
  }

  const overdueCount = rows.filter((r) => r.isOverdue).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
          Pendente de entrega
          <span className="ml-1 text-xs font-normal text-muted-foreground">({rows.length})</span>
        </h2>
        {overdueCount > 0 && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            {overdueCount} atrasada{overdueCount === 1 ? "" : "s"} (passou de D+1 09h)
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {rows.map((r, idx) => {
          const key = `${r.event_id}-${r.videomaker_id}-${idx}`;
          const content = (
            <div className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3 hover:bg-muted/40">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {formatDateBR(r.inicio)} · {formatTimeBR(r.inicio)}
                  </span>
                  {r.isOverdue && (
                    <span className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-destructive">
                      Atrasada
                    </span>
                  )}
                </div>
                <p className="truncate text-sm font-medium">{r.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {r.client_nome ?? "Cliente —"}
                  {showVideomaker && r.videomaker_nome && <> · {r.videomaker_nome}</>}
                </p>
              </div>
              {canDeliver && <Upload className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />}
            </div>
          );

          return (
            <li key={key}>
              {canDeliver ? (
                <button type="button" onClick={() => setOpenEvent(r)} className="block w-full text-left">
                  {content}
                </button>
              ) : (
                <Link href="/calendario" className="block">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {openEvent && (
        <Dialog open={openEvent !== null} onOpenChange={(o) => { if (!o) setOpenEvent(null); }}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Entregar captação</DialogTitle>
              <DialogDescription>
                {openEvent.titulo} · {formatDateBR(openEvent.inicio)}
                {openEvent.client_nome && ` · ${openEvent.client_nome}`}
              </DialogDescription>
            </DialogHeader>
            <CapturaForm
              clientes={clientes}
              pendentes={[{
                event_id: openEvent.event_id,
                titulo: openEvent.titulo,
                inicio: openEvent.inicio,
                client_id: openEvent.client_id,
                client_nome: openEvent.client_nome,
                videomaker_id: openEvent.videomaker_id,
                isOverdue: openEvent.isOverdue,
              }]}
              hidePendenteSelect
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
```

### Step 3: Criar `PendenteDelegacaoAba.tsx`

```tsx
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { DelegarCapturaButton } from "./DelegarCapturaButton";
import type { CapturaSemDelegacaoRow } from "@/lib/audiovisual/queries";

interface Props {
  rows: CapturaSemDelegacaoRow[];
  editores: Array<{ id: string; nome: string }>;
  canDelegate: boolean;
}

function formatDateBR(iso: string): string {
  const datePart = iso.length === 10 ? iso : iso.slice(0, 10);
  const [y, m, d] = datePart.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function PendenteDelegacaoAba({ rows, editores, canDelegate }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhuma captação aguardando delegação. ✨
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground/80">
        Pendente de delegação
        <span className="ml-1 text-xs font-normal text-muted-foreground">({rows.length})</span>
      </h2>
      <p className="text-xs text-muted-foreground">
        Capturas já entregues pelos videomakers que ainda precisam ser delegadas pra um editor.
      </p>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="space-y-2 rounded-lg border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums text-muted-foreground">
                  <span className="font-semibold">{formatDateBR(r.data_captacao)}</span>
                  <span>·</span>
                  <span>{r.qtd_videos}v · {r.qtd_fotos}f</span>
                </div>
                <p className="truncate text-sm font-medium">{r.cliente_nome ?? "Cliente —"}</p>
                <p className="text-xs text-muted-foreground">{r.videomaker_nome ?? "Videomaker —"}</p>
              </div>
              <Link
                href={r.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded border border-input bg-card px-2 py-1 text-xs hover:bg-muted/40"
              >
                Drive <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <DelegarCapturaButton
              capturaId={r.id}
              delegated={null}
              concluidaEm={null}
              editores={editores}
              canDelegate={canDelegate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Step 4: Verificar typecheck + lint

```bash
npm run lint -- src/components/audiovisual/CapturasAba.tsx src/components/audiovisual/PendenteEntregaAba.tsx src/components/audiovisual/PendenteDelegacaoAba.tsx
npm run typecheck 2>&1 | grep -v "web-push" | grep "error TS" | head -10
```

Expected: lint clean; typecheck pode reclamar de unused vars em /audiovisual/page.tsx (que vai ser reescrito na Task 3) — ignore.

### Step 5: Commit

```bash
git add src/components/audiovisual/CapturasAba.tsx src/components/audiovisual/PendenteEntregaAba.tsx src/components/audiovisual/PendenteDelegacaoAba.tsx
git commit -m "$(cat <<'EOF'
feat(audiovisual): componentes das 3 abas

CapturasAba: extrai conteúdo atual da /audiovisual (banner overdue,
pendentes, form, lista) pra ser reutilizável dentro do layout de tabs.

PendenteEntregaAba: lista de gravações sem captura, click abre dialog
com CapturaForm pra entregar inline. Quando !canDeliver (coord+), só
mostra read-only com link pra /calendario.

PendenteDelegacaoAba: lista de capturas com task_id NULL e concluida_em
NULL, reusa DelegarCapturaButton existente.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Reestruturar `page.tsx` com tabs

**Files:**
- Modify: `src/app/(authed)/audiovisual/page.tsx`

### Step 1: Reescrever `page.tsx`

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  listCapturas,
  listPendenteParaVideomaker,
  listEventosSemCaptura,
  listCapturasSemDelegacao,
} from "@/lib/audiovisual/queries";
import { CapturasAba } from "@/components/audiovisual/CapturasAba";
import { PendenteEntregaAba } from "@/components/audiovisual/PendenteEntregaAba";
import { PendenteDelegacaoAba } from "@/components/audiovisual/PendenteDelegacaoAba";
import { cn } from "@/lib/utils";

const ROLES_QUE_VEEM = ["videomaker", "audiovisual_chefe", "coordenador", "assessor", "adm", "socio"];
const ROLES_QUE_DELEGAM = ["audiovisual_chefe", "adm", "socio"];

type TabKey = "capturas" | "pendente_entrega" | "pendente_delegacao";

const TAB_LABELS: Record<TabKey, string> = {
  capturas: "Capturas",
  pendente_entrega: "Pendente de entrega",
  pendente_delegacao: "Pendente de delegação",
};

interface SearchParams { tab?: string; }

export default async function AudiovisualPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAuth();
  if (!ROLES_QUE_VEEM.includes(user.role)) notFound();

  const isVideomaker = user.role === "videomaker";
  const isAssessor = user.role === "assessor";
  const canDelegate = ROLES_QUE_DELEGAM.includes(user.role);
  // Pendente delegação só pra quem pode delegar (chefes audiovisual). Coord/assessor não.
  const canSeeDelegacao = canDelegate;

  const availableTabs: TabKey[] = ["capturas", "pendente_entrega"];
  if (canSeeDelegacao) availableTabs.push("pendente_delegacao");

  const { tab: tabParam } = await searchParams;
  const activeTab: TabKey = availableTabs.includes(tabParam as TabKey)
    ? (tabParam as TabKey)
    : "capturas";

  const supabase = await createClient();

  // Carrega dados conforme a aba ativa (lazy: aba inativa não dispara queries pesadas)
  let content: React.ReactNode = null;

  if (activeTab === "capturas") {
    const meusClientesPromise = isAssessor
      ? supabase.from("clients").select("id").eq("assessor_id", user.id).eq("status", "ativo")
      : Promise.resolve({ data: [] as Array<{ id: string }> });

    const editoresPromise = canDelegate
      ? supabase
          .from("profiles")
          .select("id, nome")
          .eq("role", "editor")
          .eq("ativo", true)
          .order("nome")
          .then((r) => ((r.data ?? []) as Array<{ id: string; nome: string }>))
      : Promise.resolve([] as Array<{ id: string; nome: string }>);

    const [{ data: clientesData = [] }, pendentes, editores, meusClientesRes] = await Promise.all([
      supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome"),
      isVideomaker ? listPendenteParaVideomaker(user.id) : Promise.resolve([]),
      editoresPromise,
      meusClientesPromise,
    ]);
    const clientes = (clientesData ?? []) as Array<{ id: string; nome: string }>;

    let capturas;
    if (isVideomaker) {
      capturas = await listCapturas({ videomakerId: user.id, limit: 50 });
    } else if (isAssessor) {
      const ids = (meusClientesRes.data ?? []).map((c) => (c as { id: string }).id);
      capturas = ids.length === 0 ? [] : await listCapturas({ clientIds: ids, limit: 100 });
    } else {
      capturas = await listCapturas({ limit: 100 });
    }

    const overdue = pendentes.filter((p) => p.isOverdue);

    content = (
      <CapturasAba
        isVideomaker={isVideomaker}
        canDelegate={canDelegate}
        pendentes={pendentes}
        overdue={overdue}
        clientes={clientes}
        capturas={capturas}
        editores={editores}
      />
    );
  } else if (activeTab === "pendente_entrega") {
    const [rows, { data: clientesData = [] }] = await Promise.all([
      listEventosSemCaptura(isVideomaker ? { videomakerId: user.id } : {}),
      isVideomaker
        ? supabase.from("clients").select("id, nome").eq("status", "ativo").order("nome")
        : Promise.resolve({ data: [] as Array<{ id: string; nome: string }> }),
    ]);
    const clientes = (clientesData ?? []) as Array<{ id: string; nome: string }>;
    content = (
      <PendenteEntregaAba
        rows={rows}
        showVideomaker={!isVideomaker}
        canDeliver={isVideomaker}
        clientes={clientes}
      />
    );
  } else if (activeTab === "pendente_delegacao") {
    const [rows, editoresData] = await Promise.all([
      listCapturasSemDelegacao(),
      supabase
        .from("profiles")
        .select("id, nome")
        .eq("role", "editor")
        .eq("ativo", true)
        .order("nome")
        .then((r) => ((r.data ?? []) as Array<{ id: string; nome: string }>)),
    ]);
    content = (
      <PendenteDelegacaoAba rows={rows} editores={editoresData} canDelegate={canDelegate} />
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Audiovisual</h1>
        <p className="text-sm text-muted-foreground">
          Entregas de captação, gravações pendentes e fila de delegação.
        </p>
      </header>

      {/* Tabs nav */}
      <div className="border-b">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Abas de audiovisual">
          {availableTabs.map((t) => {
            const active = t === activeTab;
            return (
              <Link
                key={t}
                href={t === "capturas" ? "/audiovisual" : `/audiovisual?tab=${t}`}
                className={cn(
                  "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground",
                )}
              >
                {TAB_LABELS[t]}
              </Link>
            );
          })}
        </nav>
      </div>

      {content}
    </div>
  );
}
```

### Step 2: Final verification

```bash
npm run typecheck 2>&1 | grep -v "web-push" | grep "error TS" | head -10
npm run lint -- src/app/\(authed\)/audiovisual/page.tsx src/components/audiovisual/*.tsx
```

Expected: typecheck clean, lint clean.

### Step 3: Commit

```bash
git add src/app/\(authed\)/audiovisual/page.tsx
git commit -m "$(cat <<'EOF'
refactor(audiovisual): reestrutura /audiovisual em 3 abas

Capturas (default) | Pendente entrega | Pendente delegação

Tabs server-side via ?tab= URL param. Cada aba carrega só os dados
que precisa (lazy).

Visibilidade:
  videomaker: Capturas + Pendente entrega (só dele)
  coord+:     Capturas + Pendente entrega (todos) + Pendente delegação

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

Expected: 4 commits (plan + queries + componentes + page.tsx).

- [ ] **Step 2: Push**

```bash
git push -u origin claude/audiovisual-abas
```

- [ ] **Step 3: Abrir PR**

```bash
gh pr create --base main --title "feat(audiovisual): abas Pendente entrega + Pendente delegação" --body "..."
```

(corpo do PR ver na execução)

---

## Notas operacionais

- **Sem state client-side pras tabs** — URL param (`?tab=`) controla qual aba renderiza. Deep-link funciona, refresh preserva aba, server pode pré-carregar só os dados da aba ativa.
- **Lazy data loading** — aba "pendente_entrega" não dispara query de capturas, e vice-versa. Cache de Next.js + tags continua invalidando corretamente.
- **PendenteEntregaAba só ganha dialog de entrega pro videomaker** — coord/assessor veem read-only.
- **PendenteDelegacaoAba** só pra coord+ (audiovisual_chefe, adm, sócio) — coordenador geral e assessor NÃO veem (decisão da spec).
