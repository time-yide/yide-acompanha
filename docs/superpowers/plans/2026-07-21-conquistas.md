# Conquistas (Fase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Trocar o placeholder "Conquistas — em breve" do card por conquistas automáticas desbloqueadas pela atividade real (tempo de casa, tarefas, pesquisas, entregas, ligações, metas).

**Architecture:** Catálogo no código + coletor de stats (service-role) + avaliação pura (testada) + tabela `conquista_desbloqueada` + sync-on-own-card-view com toast comemorativo. Só ícones lucide. Spec: `docs/superpowers/specs/2026-07-21-conquistas-design.md`.

**Tech Stack:** Next.js App Router, Supabase service-role, vitest, componentes `ui/*`, sonner (toast).

---

## File structure
- Create `supabase/migrations/20260723000000_conquista_desbloqueada.sql` (manual).
- Create `src/lib/conquistas/catalogo.ts` — tipos + catálogo.
- Create `src/lib/conquistas/avaliar.ts` (+ `.test.ts`) — avaliação pura.
- Create `src/lib/conquistas/stats.ts` — coletor de stats (I/O).
- Create `src/lib/conquistas/queries.ts` — `getConquistasDoUsuario`.
- Create `src/lib/conquistas/actions.ts` — `sincronizarConquistasAction`.
- Create `src/components/perfil/ConquistasSecao.tsx` — grade (apresentação).
- Create `src/components/perfil/ConquistaToast.tsx` — client toast.
- Modify `src/components/perfil/CardJogador.tsx` — renderizar a seção real.
- Modify `src/app/(authed)/perfil/[id]/page.tsx` — carregar conquistas + sync do dono.

---

## Task 1: Migration `conquista_desbloqueada` (manual)

**Files:** Create `supabase/migrations/20260723000000_conquista_desbloqueada.sql`

- [ ] **Step 1: Escrever**
```sql
-- Conquistas do Card do Jogador (Fase 2). Aplicação MANUAL no SQL Editor após o merge.
create table public.conquista_desbloqueada (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conquista_key text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, conquista_key)
);
create index conquista_desbloqueada_user_idx on public.conquista_desbloqueada(user_id);

alter table public.conquista_desbloqueada enable row level security;
create policy conquista_desbloqueada_read on public.conquista_desbloqueada
  for select to authenticated using (true);
```

- [ ] **Step 2: Commit**
```bash
git add supabase/migrations/20260723000000_conquista_desbloqueada.sql
git commit -m "feat(conquistas): migration conquista_desbloqueada (aplicar manual)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Catálogo + tipos

**Files:** Create `src/lib/conquistas/catalogo.ts`

- [ ] **Step 1: Escrever**
```ts
export type CategoriaConquista = "tempo" | "produtividade" | "engajamento" | "area";

export type StatKey =
  | "mesesDeCasa" | "tarefasConcluidas" | "pesquisasRespondidas"
  | "entregasAudiovisual" | "ligacoesSaida" | "metaBatida"
  | "cardCompleto" | "discFeito";

export interface Conquista {
  key: string;
  categoria: CategoriaConquista;
  titulo: string;
  descricao: string;
  icone: string;          // nome do ícone lucide
  fonte: StatKey;
  alvo: number;           // fontes booleanas usam alvo=1 (stat 0/1)
  aplicavelRoles?: string[]; // se definido, só aparece pra esses cargos
}

export const CATEGORIA_LABEL: Record<CategoriaConquista, string> = {
  tempo: "Tempo de casa",
  produtividade: "Produtividade",
  engajamento: "Engajamento",
  area: "Metas & área",
};

const AUDIOVISUAL = ["videomaker", "editor", "fast_midia", "designer", "audiovisual_chefe"];
const COMERCIALISH = ["comercial", "assessor", "coordenador", "socio", "adm"];

export const CATALOGO: Conquista[] = [
  // Tempo de casa
  { key: "casa_novato", categoria: "tempo", titulo: "Novato", descricao: "Entrou pro time.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 0 },
  { key: "casa_3m", categoria: "tempo", titulo: "3 meses de casa", descricao: "3 meses de jornada.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 3 },
  { key: "casa_6m", categoria: "tempo", titulo: "6 meses de casa", descricao: "Meio ano de time.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 6 },
  { key: "casa_1a", categoria: "tempo", titulo: "1 ano de casa", descricao: "Um ano junto!", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 12 },
  { key: "casa_2a", categoria: "tempo", titulo: "2 anos de casa", descricao: "Dois anos de estrada.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 24 },
  { key: "casa_3a", categoria: "tempo", titulo: "3 anos de casa", descricao: "Veterano do time.", icone: "CalendarClock", fonte: "mesesDeCasa", alvo: 36 },
  // Produtividade
  { key: "tarefa_1", categoria: "produtividade", titulo: "Primeira entrega", descricao: "Concluiu a 1ª tarefa.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 1 },
  { key: "tarefa_10", categoria: "produtividade", titulo: "10 tarefas", descricao: "10 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 10 },
  { key: "tarefa_50", categoria: "produtividade", titulo: "50 tarefas", descricao: "50 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 50 },
  { key: "tarefa_100", categoria: "produtividade", titulo: "100 tarefas", descricao: "100 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 100 },
  { key: "tarefa_250", categoria: "produtividade", titulo: "250 tarefas", descricao: "250 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 250 },
  { key: "tarefa_500", categoria: "produtividade", titulo: "500 tarefas", descricao: "500 tarefas concluídas.", icone: "ListChecks", fonte: "tarefasConcluidas", alvo: 500 },
  // Engajamento
  { key: "disc_feito", categoria: "engajamento", titulo: "Se conhece", descricao: "Respondeu o teste DISC.", icone: "Sparkles", fonte: "discFeito", alvo: 1 },
  { key: "pesquisa_3", categoria: "engajamento", titulo: "Participativo", descricao: "Respondeu 3 pesquisas.", icone: "Sparkles", fonte: "pesquisasRespondidas", alvo: 3 },
  { key: "pesquisa_10", categoria: "engajamento", titulo: "Voz ativa", descricao: "Respondeu 10 pesquisas.", icone: "Sparkles", fonte: "pesquisasRespondidas", alvo: 10 },
  { key: "card_completo", categoria: "engajamento", titulo: "Perfil completo", descricao: "Preencheu todo o card.", icone: "Sparkles", fonte: "cardCompleto", alvo: 1 },
  // Metas & área
  { key: "meta_mes", categoria: "area", titulo: "Meta do mês", descricao: "Bateu a meta do mês.", icone: "Target", fonte: "metaBatida", alvo: 1, aplicavelRoles: ["comercial"] },
  { key: "av_10", categoria: "area", titulo: "10 entregas", descricao: "10 entregas audiovisual.", icone: "Clapperboard", fonte: "entregasAudiovisual", alvo: 10, aplicavelRoles: AUDIOVISUAL },
  { key: "av_50", categoria: "area", titulo: "50 entregas", descricao: "50 entregas audiovisual.", icone: "Clapperboard", fonte: "entregasAudiovisual", alvo: 50, aplicavelRoles: AUDIOVISUAL },
  { key: "av_100", categoria: "area", titulo: "100 entregas", descricao: "100 entregas audiovisual.", icone: "Clapperboard", fonte: "entregasAudiovisual", alvo: 100, aplicavelRoles: AUDIOVISUAL },
  { key: "lig_50", categoria: "area", titulo: "50 ligações", descricao: "50 ligações feitas.", icone: "Phone", fonte: "ligacoesSaida", alvo: 50, aplicavelRoles: COMERCIALISH },
  { key: "lig_200", categoria: "area", titulo: "200 ligações", descricao: "200 ligações feitas.", icone: "Phone", fonte: "ligacoesSaida", alvo: 200, aplicavelRoles: COMERCIALISH },
  { key: "lig_500", categoria: "area", titulo: "500 ligações", descricao: "500 ligações feitas.", icone: "Phone", fonte: "ligacoesSaida", alvo: 500, aplicavelRoles: COMERCIALISH },
];
```

- [ ] **Step 2: Type-check**
Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "conquistas/catalogo"; echo done` → só `done`.

- [ ] **Step 3: Commit**
```bash
git add src/lib/conquistas/catalogo.ts
git commit -m "feat(conquistas): catálogo + tipos

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Avaliação pura (TDD)

**Files:** Create `src/lib/conquistas/avaliar.ts` + `.test.ts`

- [ ] **Step 1: Teste que falha** — `src/lib/conquistas/avaliar.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { avaliarConquistas } from "./avaliar";
import type { Conquista } from "./catalogo";
import type { StatsUsuario } from "./stats";

const stats: StatsUsuario = {
  mesesDeCasa: 7, tarefasConcluidas: 12, pesquisasRespondidas: 1,
  entregasAudiovisual: 0, ligacoesSaida: 60, metaBatida: 0,
  cardCompleto: 1, discFeito: 1,
};
const cat: Conquista[] = [
  { key: "casa_6m", categoria: "tempo", titulo: "", descricao: "", icone: "", fonte: "mesesDeCasa", alvo: 6 },
  { key: "casa_1a", categoria: "tempo", titulo: "", descricao: "", icone: "", fonte: "mesesDeCasa", alvo: 12 },
  { key: "lig_50", categoria: "area", titulo: "", descricao: "", icone: "", fonte: "ligacoesSaida", alvo: 50, aplicavelRoles: ["comercial"] },
  { key: "av_10", categoria: "area", titulo: "", descricao: "", icone: "", fonte: "entregasAudiovisual", alvo: 10, aplicavelRoles: ["videomaker"] },
];

describe("avaliarConquistas", () => {
  it("desbloqueia quando atual >= alvo", () => {
    const r = avaliarConquistas(cat, stats, "comercial");
    const m = Object.fromEntries(r.map((x) => [x.key, x]));
    expect(m.casa_6m.desbloqueada).toBe(true);
    expect(m.casa_1a.desbloqueada).toBe(false);
    expect(m.casa_1a.atual).toBe(7);
  });
  it("marca aplicavel conforme o cargo", () => {
    const r = avaliarConquistas(cat, stats, "comercial");
    const m = Object.fromEntries(r.map((x) => [x.key, x]));
    expect(m.lig_50.aplicavel).toBe(true);
    expect(m.av_10.aplicavel).toBe(false);
  });
  it("sem aplicavelRoles é sempre aplicável", () => {
    const r = avaliarConquistas([cat[0]], stats, "designer");
    expect(r[0].aplicavel).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**
Run: `npx vitest run src/lib/conquistas/avaliar.test.ts --exclude '**/.claude/**'` → FAIL.

- [ ] **Step 3: Implementar** — `src/lib/conquistas/avaliar.ts`
```ts
import type { Conquista } from "./catalogo";
import type { StatsUsuario } from "./stats";

export interface ConquistaAvaliada extends Conquista {
  atual: number;
  desbloqueada: boolean;
  aplicavel: boolean;
}

export function avaliarConquistas(
  catalogo: Conquista[],
  stats: StatsUsuario,
  role: string,
): ConquistaAvaliada[] {
  return catalogo.map((c) => {
    const atual = stats[c.fonte] ?? 0;
    const aplicavel = !c.aplicavelRoles || c.aplicavelRoles.includes(role);
    return { ...c, atual, desbloqueada: atual >= c.alvo, aplicavel };
  });
}
```

- [ ] **Step 4: Rodar e ver passar**
Run: `npx vitest run src/lib/conquistas/avaliar.test.ts --exclude '**/.claude/**'` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/conquistas/avaliar.ts src/lib/conquistas/avaliar.test.ts
git commit -m "feat(conquistas): avaliação pura (threshold + aplicabilidade)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Coletor de stats

**Files:** Create `src/lib/conquistas/stats.ts`

- [ ] **Step 1: Implementar**
```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getMetaComercial } from "@/lib/dashboard/comercial-queries";
import { getTemperamentoDaPessoa } from "@/lib/perfil-jogador/classe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface StatsUsuario {
  mesesDeCasa: number;
  tarefasConcluidas: number;
  pesquisasRespondidas: number;
  entregasAudiovisual: number;
  ligacoesSaida: number;
  metaBatida: number;   // 0/1
  cardCompleto: number; // 0/1
  discFeito: number;    // 0/1
}

async function count(sb: SB, tabela: string, filtro: (q: SB) => SB): Promise<number> {
  let q = sb.from(tabela).select("*", { count: "exact", head: true });
  q = filtro(q);
  const { count: c } = await q;
  return c ?? 0;
}

export async function getStatsDoUsuario(userId: string, role: string): Promise<StatsUsuario> {
  const sb = createServiceRoleClient() as SB;

  const { data: prof } = await sb
    .from("profiles")
    .select("data_admissao")
    .eq("id", userId)
    .single();
  const mesesDeCasa = prof?.data_admissao
    ? Math.max(0, Math.floor((Date.now() - new Date(prof.data_admissao).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : -1; // -1 = sem admissão → nem "novato"

  const [tarefasConcluidas, pesquisasRespondidas, entregasAudiovisual, ligacoesSaida] = await Promise.all([
    count(sb, "tasks", (q) => q.eq("atribuido_a", userId).eq("status", "concluida").is("deleted_at", null)),
    count(sb, "pesquisa_destinatarios", (q) => q.eq("user_id", userId).not("respondeu_em", "is", null)),
    count(sb, "audiovisual_capturas", (q) => q.eq("videomaker_id", userId)),
    count(sb, "ligacoes", (q) =>
      q.eq("colaborador_id", userId).eq("direcao", "saida").not("status", "in", "(cancelada,em_andamento)").is("arquivado_em", null),
    ),
  ]);

  // Meta comercial (só faz sentido pra comercial; erro/na não quebra).
  let metaBatida = 0;
  if (role === "comercial") {
    try {
      const meta = await getMetaComercial(userId);
      if (meta.pctMeta >= 100) metaBatida = 1;
    } catch {
      metaBatida = 0;
    }
  }

  // Card completo
  const { data: card } = await sb
    .from("perfil_jogador")
    .select("username, bio, como_trabalho, hobbies, frase, capa_url")
    .eq("user_id", userId)
    .maybeSingle();
  const cardCompleto =
    card && card.username && card.bio && card.como_trabalho && card.frase && card.capa_url && (card.hobbies?.length ?? 0) > 0
      ? 1 : 0;

  const discFeito = (await getTemperamentoDaPessoa(userId)) ? 1 : 0;

  return { mesesDeCasa, tarefasConcluidas, pesquisasRespondidas, entregasAudiovisual, ligacoesSaida, metaBatida, cardCompleto, discFeito };
}
```

- [ ] **Step 2: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/lib/conquistas/stats.ts && echo OK` → `OK`.

- [ ] **Step 3: Commit**
```bash
git add src/lib/conquistas/stats.ts
git commit -m "feat(conquistas): coletor de stats (dados reais)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Queries + action de sincronização

**Files:** Create `src/lib/conquistas/queries.ts` e `src/lib/conquistas/actions.ts`

- [ ] **Step 1: queries.ts**
```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CATALOGO } from "./catalogo";
import { avaliarConquistas, type ConquistaAvaliada } from "./avaliar";
import { getStatsDoUsuario } from "./stats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface ConquistaCard extends ConquistaAvaliada {
  unlockedAt: string | null;
}

/** Lista as conquistas aplicáveis do usuário, já cruzadas com o que está gravado. */
export async function getConquistasDoUsuario(userId: string, role: string): Promise<ConquistaCard[]> {
  const stats = await getStatsDoUsuario(userId, role);
  const avaliadas = avaliarConquistas(CATALOGO, stats, role).filter((c) => c.aplicavel);

  const sb = createServiceRoleClient() as SB;
  const { data: rows } = await sb
    .from("conquista_desbloqueada")
    .select("conquista_key, unlocked_at")
    .eq("user_id", userId);
  const when = new Map(
    ((rows ?? []) as Array<{ conquista_key: string; unlocked_at: string }>).map((r) => [r.conquista_key, r.unlocked_at]),
  );

  return avaliadas.map((c) => ({ ...c, unlockedAt: when.get(c.key) ?? null }));
}
```

- [ ] **Step 2: actions.ts**
```ts
"use server";

import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CATALOGO } from "./catalogo";
import { avaliarConquistas } from "./avaliar";
import { getStatsDoUsuario } from "./stats";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface ConquistaNova { key: string; titulo: string }

/**
 * Grava as conquistas recém-desbloqueadas do PRÓPRIO usuário e devolve as novas
 * (pra comemorar com toast). Só roda pro próprio (self).
 */
export async function sincronizarConquistasAction(userId: string): Promise<ConquistaNova[]> {
  const actor = await requireAuth();
  if (actor.id !== userId) return [];

  const stats = await getStatsDoUsuario(userId, actor.role);
  const desbloqueadas = avaliarConquistas(CATALOGO, stats, actor.role)
    .filter((c) => c.aplicavel && c.desbloqueada);

  const sb = createServiceRoleClient() as SB;
  const { data: rows } = await sb
    .from("conquista_desbloqueada")
    .select("conquista_key")
    .eq("user_id", userId);
  const jaTem = new Set(((rows ?? []) as Array<{ conquista_key: string }>).map((r) => r.conquista_key));

  const novas = desbloqueadas.filter((c) => !jaTem.has(c.key));
  if (novas.length > 0) {
    await sb
      .from("conquista_desbloqueada")
      .upsert(novas.map((c) => ({ user_id: userId, conquista_key: c.key })), { onConflict: "user_id,conquista_key", ignoreDuplicates: true });
  }
  return novas.map((c) => ({ key: c.key, titulo: c.titulo }));
}
```

- [ ] **Step 3: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/lib/conquistas/queries.ts src/lib/conquistas/actions.ts && echo OK` → `OK`.

- [ ] **Step 4: Commit**
```bash
git add src/lib/conquistas/queries.ts src/lib/conquistas/actions.ts
git commit -m "feat(conquistas): queries + sincronização

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Componentes (seção + toast)

**Files:** Create `src/components/perfil/ConquistasSecao.tsx` e `ConquistaToast.tsx`

- [ ] **Step 1: ConquistasSecao.tsx** (server, apresentação)
```tsx
import { Card } from "@/components/ui/card";
import { Trophy, CalendarClock, ListChecks, Sparkles, Target, Clapperboard, Phone, Lock } from "lucide-react";
import type { ConquistaCard } from "@/lib/conquistas/queries";
import { CATEGORIA_LABEL, type CategoriaConquista } from "@/lib/conquistas/catalogo";

const ICONES = { CalendarClock, ListChecks, Sparkles, Target, Clapperboard, Phone } as Record<string, React.ComponentType<{ className?: string }>>;
const ORDEM: CategoriaConquista[] = ["tempo", "produtividade", "engajamento", "area"];

function Medalha({ c }: { c: ConquistaCard }) {
  const Icon = ICONES[c.icone] ?? Trophy;
  const pct = c.alvo > 0 ? Math.min(100, Math.round((c.atual / c.alvo) * 100)) : (c.desbloqueada ? 100 : 0);
  return (
    <div className={`rounded-lg border p-3 ${c.desbloqueada ? "border-primary/40 bg-primary/5" : "opacity-70"}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${c.desbloqueada ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
          {c.desbloqueada ? <Icon className="h-4 w-4" /> : <Lock className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{c.titulo}</p>
          <p className="truncate text-[10px] text-muted-foreground">{c.descricao}</p>
        </div>
      </div>
      {!c.desbloqueada && c.alvo > 1 && (
        <div className="mt-2">
          <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <p className="mt-1 text-[10px] text-muted-foreground">{c.atual}/{c.alvo}</p>
        </div>
      )}
    </div>
  );
}

export function ConquistasSecao({ conquistas }: { conquistas: ConquistaCard[] }) {
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada).length;
  return (
    <Card className="space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Trophy className="h-4 w-4" />Conquistas
        <span className="ml-auto text-xs text-muted-foreground">{desbloqueadas}/{conquistas.length}</span>
      </p>
      {ORDEM.map((cat) => {
        const doGrupo = conquistas.filter((c) => c.categoria === cat);
        if (doGrupo.length === 0) return null;
        return (
          <div key={cat} className="space-y-2">
            <p className="text-[11px] font-medium text-muted-foreground">{CATEGORIA_LABEL[cat]}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {doGrupo.map((c) => <Medalha key={c.key} c={c} />)}
            </div>
          </div>
        );
      })}
    </Card>
  );
}
```

- [ ] **Step 2: ConquistaToast.tsx** (client)
```tsx
"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ConquistaNova } from "@/lib/conquistas/actions";

export function ConquistaToast({ novas }: { novas: ConquistaNova[] }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || novas.length === 0) return;
    done.current = true;
    for (const n of novas) {
      toast.success(`Conquista desbloqueada: ${n.titulo}!`, { icon: "🏆", duration: 6000 });
    }
  }, [novas]);
  return null;
}
```
> Obs: o `icon` do toast usa emoji só como enfeite do sonner (fora do card). Se preferir 100% sem emoji, remover a prop `icon`.

- [ ] **Step 3: Type-check + lint**
Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/components/perfil/ConquistasSecao.tsx src/components/perfil/ConquistaToast.tsx && echo OK` → `OK`.

- [ ] **Step 4: Commit**
```bash
git add src/components/perfil/ConquistasSecao.tsx src/components/perfil/ConquistaToast.tsx
git commit -m "feat(conquistas): seção de medalhas + toast

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Integrar no card

**Files:** Modify `src/components/perfil/CardJogador.tsx` e `src/app/(authed)/perfil/[id]/page.tsx`

- [ ] **Step 1: CardJogador aceita `conquistas` e troca o placeholder**
Em `src/components/perfil/CardJogador.tsx`:
1. Adicionar import: `import { ConquistasSecao } from "./ConquistasSecao";` e `import type { ConquistaCard } from "@/lib/conquistas/queries";`
2. Trocar a assinatura pra receber `conquistas`:
```tsx
export function CardJogador({ card, podeEditar, conquistas }: { card: CardData; podeEditar: boolean; conquistas: ConquistaCard[] }) {
```
3. Substituir o bloco atual do placeholder de Conquistas (o `<Card>` com `<Trophy/>` "Em breve") por:
```tsx
        <ConquistasSecao conquistas={conquistas} />
```
   Mantendo o placeholder de **Skills** como está (some na Fase 3). Ou seja, o grid `sm:grid-cols-2` que hoje tem Conquistas+Skills vira: a seção de Conquistas em largura cheia (fora do grid) + o card de Skills "Em breve" sozinho logo abaixo. Ajustar o JSX pra:
```tsx
      {/* Conquistas (Fase 2) */}
      <ConquistasSecao conquistas={conquistas} />

      {/* Skills (Fase 3 — em breve) */}
      <Card className="space-y-1 p-4 opacity-60">
        <p className="flex items-center gap-2 text-sm font-medium"><Zap className="h-4 w-4" />Skills</p>
        <p className="text-xs text-muted-foreground">Em breve.</p>
      </Card>
```
   (Remover do import o que não é mais usado se o `Trophy` deixar de ser referenciado aqui — `ConquistasSecao` já usa o seu próprio.)

- [ ] **Step 2: page.tsx carrega conquistas + sincroniza o dono**
Em `src/app/(authed)/perfil/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getCard } from "@/lib/perfil-jogador/queries";
import { getConquistasDoUsuario } from "@/lib/conquistas/queries";
import { sincronizarConquistasAction, type ConquistaNova } from "@/lib/conquistas/actions";
import { CardJogador } from "@/components/perfil/CardJogador";
import { ConquistaToast } from "@/components/perfil/ConquistaToast";

export default async function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const card = await getCard(id);
  if (!card) notFound();
  const podeEditar = user.id === id || canAccess(user.role, "manage:users");

  // Dono: sincroniza (grava novas) e comemora. Precisa do role do DONO (id), não do viewer.
  let novas: ConquistaNova[] = [];
  if (user.id === id) novas = await sincronizarConquistasAction(id);

  // Descobre o role do dono do card pra avaliar as conquistas certas.
  const conquistas = await getConquistasDoUsuario(id, card.roleDoUsuario);

  return (
    <div className="mx-auto max-w-2xl">
      {novas.length > 0 && <ConquistaToast novas={novas} />}
      <CardJogador card={card} podeEditar={podeEditar} conquistas={conquistas} />
    </div>
  );
}
```
> **Dependência:** `getConquistasDoUsuario` e o coletor precisam do **role do dono do card** (não do viewer). O `CardData` de Fase 1 não expõe o role. **Ajuste necessário:** em `src/lib/perfil-jogador/queries.ts`, adicionar `roleDoUsuario: string` ao `CardData` e preenchê-lo em `getCard` (já lê `profiles.role` via `roleLabel`; guardar também o `role` cru). Fazer esse ajuste neste passo:
> - Em `getCard`, o `prof` já traz `role`; adicionar ao retorno `roleDoUsuario: p.role`.
> - Em `src/lib/perfil-jogador/schema.ts`, adicionar `roleDoUsuario: string;` à interface `CardData`.

- [ ] **Step 3: Type-check + lint + testes**
Run:
```
npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && echo TYPECHECK_OK
npx eslint src/components/perfil "src/app/(authed)/perfil" src/lib/conquistas src/lib/perfil-jogador && echo LINT_OK
npx vitest run src/lib/conquistas src/lib/perfil-jogador --exclude '**/.claude/**'
```
Esperado: `TYPECHECK_OK`, `LINT_OK`, testes PASS.

- [ ] **Step 4: Commit**
```bash
git add src/components/perfil/CardJogador.tsx "src/app/(authed)/perfil/[id]/page.tsx" src/lib/perfil-jogador/queries.ts src/lib/perfil-jogador/schema.ts
git commit -m "feat(conquistas): integrar seção no card + sync do dono

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: PR

- [ ] Push + PR + esperar CI verde + merge:
```bash
git push -u origin feat/conquistas
gh pr create --base main --head feat/conquistas --title "feat(conquistas): Fase 2 do Card do Jogador" --body "Conquistas automáticas (tempo de casa, tarefas, engajamento, metas/área) no card. Migration conquista_desbloqueada MANUAL. Spec/plan em docs/superpowers/."
```
> **PÓS-MERGE (manual):** aplicar `supabase/migrations/20260723000000_conquista_desbloqueada.sql`.

---

## Self-review (cobertura do spec)
- Catálogo 4 categorias → Task 2 ✓
- Avaliação (threshold + aplicabilidade + progresso) → Task 3 ✓
- Stats de dados reais → Task 4 ✓
- Tabela + sync + recém-desbloqueadas → Tasks 1, 5 ✓
- Grade de medalhas (desbloqueada/bloqueada + progresso, área só pra quem aplica) → Task 6 ✓
- Toast comemorativo no próprio card → Tasks 6, 7 ✓
- Integração trocando o placeholder → Task 7 ✓
- Migration manual → Task 1 + nota ✓
- Só ícones (a única exceção é o `icon` opcional do toast sonner, sinalizada) ✓
