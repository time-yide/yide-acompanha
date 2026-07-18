# FreelaYide — Progressão & Pódio — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar níveis/XP acumulados, card do jogador, pódio do top 3 e linha de rivalidade ao FreelaYide, tudo derivado de dados já carregados.

**Architecture:** Duas funções puras (`niveis.ts`, `rivalidade.ts`) com testes; componentes presentacionais (`NivelBadge`, `Podio`); refactor do `FreelaHero` e do `RankingPainel`; fio no `page.tsx`. Sem migration, sem query nova.

**Tech Stack:** Next.js App Router (React Server + Client Components), Tailwind, lucide-react, vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-freelayide-progressao-podio-design.md`

---

## Convenções do projeto (ler antes)

- Testes unitários ficam em `tests/unit/`, usam `vitest` e o alias `@/` (ex: `import { x } from "@/lib/freela-yide/pontos"`).
- Rodar teste único: `npx vitest run --exclude '**/.claude/**' tests/unit/ARQUIVO.test.ts`
- Cores de selo seguem o padrão `border-COR/40 bg-COR/10 text-COR` (ver `src/lib/freela-yide/tipos.ts`).
- **Sem emoji na UI** — usar ícones `lucide-react`.
- `RankingEntry` (de `@/lib/freela-yide/queries`) tem: `user_id, nome, pontos, fechamentos, comissao` (obrigatórios) + `valorPego?, itens?` (opcionais).

---

### Task 1: Sistema de níveis (função pura)

**Files:**
- Create: `src/lib/freela-yide/niveis.ts`
- Test: `tests/unit/freelayide-niveis.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/unit/freelayide-niveis.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nivelDeXP } from "@/lib/freela-yide/niveis";

describe("nivelDeXP", () => {
  it("xp 0 => Novato nv1, faltam 100 pra Promessa, pct 0", () => {
    const n = nivelDeXP(0);
    expect(n.nivel).toBe(1);
    expect(n.titulo).toBe("Novato");
    expect(n.xpProximo).toBe(100);
    expect(n.proximoTitulo).toBe("Promessa");
    expect(n.faltam).toBe(100);
    expect(n.pct).toBe(0);
  });
  it("xp 50 => Novato, pct 50, faltam 50", () => {
    const n = nivelDeXP(50);
    expect(n.nivel).toBe(1);
    expect(n.pct).toBe(50);
    expect(n.faltam).toBe(50);
  });
  it("xp 100 => Promessa nv2, base 100, próximo 300", () => {
    const n = nivelDeXP(100);
    expect(n.nivel).toBe(2);
    expect(n.titulo).toBe("Promessa");
    expect(n.xpBase).toBe(100);
    expect(n.xpProximo).toBe(300);
    expect(n.faltam).toBe(200);
  });
  it("borda: xp 699 ainda é Craque, xp 700 vira Fera", () => {
    expect(nivelDeXP(699).titulo).toBe("Craque");
    expect(nivelDeXP(699).nivel).toBe(3);
    expect(nivelDeXP(700).titulo).toBe("Fera");
    expect(nivelDeXP(700).nivel).toBe(4);
  });
  it("xp 3500 => Mito nv6, nível máximo", () => {
    const n = nivelDeXP(3500);
    expect(n.nivel).toBe(6);
    expect(n.titulo).toBe("Mito");
    expect(n.xpProximo).toBeNull();
    expect(n.proximoTitulo).toBeNull();
    expect(n.faltam).toBe(0);
    expect(n.pct).toBe(100);
  });
  it("xp negativo é tratado como 0 (Novato)", () => {
    const n = nivelDeXP(-20);
    expect(n.nivel).toBe(1);
    expect(n.xpAtual).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/freelayide-niveis.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/freela-yide/niveis"` (arquivo não existe).

- [ ] **Step 3: Implementar `niveis.ts`**

Create `src/lib/freela-yide/niveis.ts`:

```ts
// src/lib/freela-yide/niveis.ts
// Sistema de níveis por XP acumulado (todos os tempos). Função pura, sem IO.
// XP = total de pontos de todos os tempos (o `pontos` da entrada em historico.geral).

export interface FaixaNivel {
  nivel: number;
  titulo: string;
  xpMin: number;
  cor: string; // classes tailwind pro selo
}

// Curva difícil: cada faixa alta custa mais que o dobro da anterior.
export const NIVEIS: FaixaNivel[] = [
  { nivel: 1, titulo: "Novato",   xpMin: 0,    cor: "border-zinc-400/40 bg-zinc-500/10 text-zinc-300" },
  { nivel: 2, titulo: "Promessa", xpMin: 100,  cor: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300" },
  { nivel: 3, titulo: "Craque",   xpMin: 300,  cor: "border-sky-400/40 bg-sky-500/15 text-sky-300" },
  { nivel: 4, titulo: "Fera",     xpMin: 700,  cor: "border-violet-400/50 bg-violet-500/15 text-violet-200" },
  { nivel: 5, titulo: "Lenda",    xpMin: 1500, cor: "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200" },
  { nivel: 6, titulo: "Mito",     xpMin: 3500, cor: "border-amber-400/50 bg-amber-500/15 text-amber-200" },
];

export interface Nivel {
  nivel: number;
  titulo: string;
  cor: string;
  xpAtual: number;
  xpBase: number;
  xpProximo: number | null;     // null no Mito (nível máximo)
  proximoTitulo: string | null; // null no Mito
  faltam: number;               // pts pro próximo nível; 0 no Mito
  pct: number;                  // 0..100 dentro do nível atual; 100 no Mito
}

export function nivelDeXP(xp: number): Nivel {
  const x = Math.max(0, Math.floor(xp));
  let idx = 0;
  for (let i = 0; i < NIVEIS.length; i++) {
    if (x >= NIVEIS[i].xpMin) idx = i;
  }
  const atual = NIVEIS[idx];
  const prox = NIVEIS[idx + 1] ?? null;
  if (!prox) {
    return {
      nivel: atual.nivel, titulo: atual.titulo, cor: atual.cor,
      xpAtual: x, xpBase: atual.xpMin, xpProximo: null, proximoTitulo: null, faltam: 0, pct: 100,
    };
  }
  const span = prox.xpMin - atual.xpMin;
  const dentro = x - atual.xpMin;
  const pct = Math.max(0, Math.min(100, Math.round((dentro / span) * 100)));
  return {
    nivel: atual.nivel, titulo: atual.titulo, cor: atual.cor,
    xpAtual: x, xpBase: atual.xpMin, xpProximo: prox.xpMin, proximoTitulo: prox.titulo,
    faltam: Math.max(0, prox.xpMin - x), pct,
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/freelayide-niveis.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/freela-yide/niveis.ts tests/unit/freelayide-niveis.test.ts
git commit -m "feat(freela): sistema de níveis por XP acumulado"
```

---

### Task 2: Rivalidade (função pura)

**Files:**
- Create: `src/lib/freela-yide/rivalidade.ts`
- Test: `tests/unit/freelayide-rivalidade.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/unit/freelayide-rivalidade.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcularRival } from "@/lib/freela-yide/rivalidade";
import type { RankingEntry } from "@/lib/freela-yide/queries";

const r = (user_id: string, nome: string, pontos: number): RankingEntry => ({
  user_id, nome, pontos, fechamentos: 0, comissao: 0,
});

describe("calcularRival", () => {
  it("1º lugar => lider", () => {
    const rank = [r("u1", "Ana", 100), r("u2", "Beto", 50)];
    expect(calcularRival(rank, "u1")).toEqual({ tipo: "lider" });
  });
  it("no meio => perseguindo o de cima, faltam = diff", () => {
    const rank = [r("u1", "Ana", 100), r("u2", "Beto", 70)];
    expect(calcularRival(rank, "u2")).toEqual({ tipo: "perseguindo", nome: "Ana", faltam: 30 });
  });
  it("empate com o de cima => perseguindo, faltam 0", () => {
    const rank = [r("u1", "Ana", 100), r("u2", "Beto", 100)];
    expect(calcularRival(rank, "u2")).toEqual({ tipo: "perseguindo", nome: "Ana", faltam: 0 });
  });
  it("ausente do ranking => foraDoRanking", () => {
    const rank = [r("u1", "Ana", 100)];
    expect(calcularRival(rank, "u9")).toEqual({ tipo: "foraDoRanking" });
  });
  it("ranking vazio => foraDoRanking", () => {
    expect(calcularRival([], "u1")).toEqual({ tipo: "foraDoRanking" });
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/freelayide-rivalidade.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/freela-yide/rivalidade"`.

- [ ] **Step 3: Implementar `rivalidade.ts`**

Create `src/lib/freela-yide/rivalidade.ts`:

```ts
// src/lib/freela-yide/rivalidade.ts
// Quem está logo acima de você no ranking do MÊS corrente. Função pura, sem IO.
import type { RankingEntry } from "./queries";

export type Rival =
  | { tipo: "lider" }
  | { tipo: "foraDoRanking" }
  | { tipo: "perseguindo"; nome: string; faltam: number };

/** `ranking` já vem ordenado por pontos desc (contrato do getRanking). Não reordena. */
export function calcularRival(ranking: RankingEntry[], meId: string): Rival {
  const idx = ranking.findIndex((r) => r.user_id === meId);
  if (idx < 0) return { tipo: "foraDoRanking" };
  if (idx === 0) return { tipo: "lider" };
  const acima = ranking[idx - 1];
  const eu = ranking[idx];
  return { tipo: "perseguindo", nome: acima.nome, faltam: Math.max(0, acima.pontos - eu.pontos) };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/freelayide-rivalidade.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/freela-yide/rivalidade.ts tests/unit/freelayide-rivalidade.test.ts
git commit -m "feat(freela): cálculo de rivalidade no ranking do mês"
```

---

### Task 3: NivelBadge (componente presentacional)

**Files:**
- Create: `src/components/freela-yide/NivelBadge.tsx`

Sem teste unitário (presentacional; validado por tsc/eslint e visualmente). Recebe o `Nivel` já calculado e a frase de rivalidade já formatada — sem lógica de negócio.

- [ ] **Step 1: Criar o componente**

Create `src/components/freela-yide/NivelBadge.tsx`:

```tsx
import { Sparkles, Target } from "lucide-react";
import type { Nivel } from "@/lib/freela-yide/niveis";

export function NivelBadge({ nivel, rival }: { nivel: Nivel; rival: string }) {
  const legenda = nivel.xpProximo === null
    ? "Nível máximo"
    : `${nivel.xpAtual.toLocaleString("pt-BR")} / ${nivel.xpProximo.toLocaleString("pt-BR")} pts · faltam ${nivel.faltam.toLocaleString("pt-BR")} pra ${nivel.proximoTitulo}`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-extrabold ${nivel.cor}`}>
          <Sparkles className="h-4 w-4" /> Nv {nivel.nivel} · {nivel.titulo}
        </span>
        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all" style={{ width: `${nivel.pct}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] tabular-nums text-white/60">{legenda}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/80 sm:max-w-[220px]">
        <Target className="h-3.5 w-3.5 shrink-0 text-cyan-300" /> <span className="min-w-0">{rival}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros (o componente ainda não é usado, mas deve compilar).

- [ ] **Step 3: Commit**

```bash
git add src/components/freela-yide/NivelBadge.tsx
git commit -m "feat(freela): componente NivelBadge (selo + barra de XP + rivalidade)"
```

---

### Task 4: Refatorar FreelaHero (card do jogador)

**Files:**
- Modify: `src/components/freela-yide/FreelaHero.tsx`

Novas props `xpTotal` e `rival`; calcula o nível, formata a frase de rivalidade, renderiza o `NivelBadge` acima da faixa de stats (que fica menor).

- [ ] **Step 1: Substituir o conteúdo do arquivo**

Replace the entire contents of `src/components/freela-yide/FreelaHero.tsx` with:

```tsx
import { fraseDoDia } from "@/lib/freela-yide/frases";
import type { FreelaStats } from "@/lib/freela-yide/queries";
import type { Rival } from "@/lib/freela-yide/rivalidade";
import { nivelDeXP } from "@/lib/freela-yide/niveis";
import { NivelBadge } from "./NivelBadge";

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-[10px] uppercase tracking-wider text-white/50">{label}</p>
      <p className="text-2xl font-extrabold tabular-nums text-white">{value}</p>
      <p className="text-[11px] text-white/60">{sub}</p>
    </div>
  );
}

function textoRival(rival: Rival): string {
  if (rival.tipo === "lider") return "Você lidera — segura o topo!";
  if (rival.tipo === "foraDoRanking") return "Pega uma freela pra entrar no ranking do mês";
  return `Faltam ${rival.faltam} pts pra passar ${rival.nome}`;
}

export function FreelaHero({ stats, xpTotal, rival }: { stats: FreelaStats; xpTotal: number; rival: Rival }) {
  const nivel = nivelDeXP(xpTotal);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-6"
      style={{ background: "radial-gradient(120% 140% at 0% 0%, rgba(124,58,237,.30), transparent 55%), radial-gradient(120% 140% at 100% 0%, rgba(34,211,238,.20), transparent 55%), linear-gradient(180deg,#0b0a14,#120e1f)" }}>
      <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-200">Oportunidades extras</div>
      <h1 className="mt-3 bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">FreelaYide</h1>
      <p className="mt-1 text-sm text-white/70">{fraseDoDia()}</p>

      <div className="mt-5">
        <NivelBadge nivel={nivel} rival={textoRival(rival)} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Disponíveis" value={String(stats.disponiveis)} sub="oportunidades" />
        <Stat label="Em jogo" value={`R$ ${stats.comissaoEmJogo.toLocaleString("pt-BR")}`} sub="valor potencial" />
        <Stat label="Você ganhou" value={`R$ ${stats.ganhoNoMes.toLocaleString("pt-BR")}`} sub="este mês" />
        <Stat label="Seu rank" value={stats.meuRank ? `#${stats.meuRank}` : "—"} sub={`${stats.meusPontos} pts no mês`} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: FAIL em `src/app/(authed)/freela-yide/page.tsx` — o `<FreelaHero stats={stats} />` agora exige `xpTotal` e `rival`. Isso será corrigido na Task 6. (Nenhum outro erro deve aparecer.)

- [ ] **Step 3: Commit**

```bash
git add src/components/freela-yide/FreelaHero.tsx
git commit -m "feat(freela): FreelaHero vira card do jogador (nível + rivalidade)"
```

---

### Task 5: Pódio no ranking do mês

**Files:**
- Create: `src/components/freela-yide/Podio.tsx`
- Modify: `src/components/freela-yide/RankingPainel.tsx`

- [ ] **Step 1: Criar o componente Podio**

Create `src/components/freela-yide/Podio.tsx`:

```tsx
import { Crown, Medal } from "lucide-react";
import type { RankingEntry } from "@/lib/freela-yide/queries";

// index 0 = 1º ouro, 1 = 2º prata, 2 = 3º bronze
const DEGRAUS = [
  { cor: "border-amber-400/50 bg-amber-500/15 text-amber-200",   altura: "h-24", ring: "ring-amber-400/50" },
  { cor: "border-slate-300/40 bg-slate-400/15 text-slate-200",   altura: "h-20", ring: "ring-slate-300/50" },
  { cor: "border-orange-400/40 bg-orange-500/15 text-orange-200", altura: "h-16", ring: "ring-orange-400/50" },
];

export function Podio({ top3, meId }: { top3: RankingEntry[]; meId: string }) {
  if (top3.length === 0) return null;
  // Ordem visual do pódio: 2º à esquerda, 1º no centro (maior), 3º à direita.
  const ordem: Array<{ pos: number; entry: RankingEntry }> = [];
  if (top3[1]) ordem.push({ pos: 2, entry: top3[1] });
  if (top3[0]) ordem.push({ pos: 1, entry: top3[0] });
  if (top3[2]) ordem.push({ pos: 3, entry: top3[2] });
  return (
    <div className="flex items-end justify-center gap-2 rounded-xl border bg-card p-3">
      {ordem.map(({ pos, entry }) => {
        const d = DEGRAUS[pos - 1];
        const ehVoce = entry.user_id === meId;
        return (
          <div key={entry.user_id} className="flex flex-1 flex-col items-center">
            {pos === 1
              ? <Crown className="mb-1 h-5 w-5 text-amber-300" />
              : <Medal className={`mb-1 h-4 w-4 ${pos === 2 ? "text-slate-300" : "text-orange-300"}`} />}
            <div className={`flex ${d.altura} w-full flex-col items-center justify-end rounded-lg border ${d.cor} px-2 py-2 ${ehVoce ? `ring-1 ${d.ring}` : ""}`}>
              <span className="text-lg font-extrabold tabular-nums">{pos}º</span>
            </div>
            <p className="mt-1 w-full truncate text-center text-xs font-semibold">
              {entry.nome}{ehVoce && <span className="text-violet-400"> (você)</span>}
            </p>
            <p className="text-[11px] tabular-nums text-muted-foreground">{entry.pontos} pts</p>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Integrar no RankingPainel (aba "Por mês")**

In `src/components/freela-yide/RankingPainel.tsx`, add the import near the other imports (after the `Card` import line):

```tsx
import { Podio } from "./Podio";
```

Then replace this block (the "Por mês" list rendering):

```tsx
          {!mesAtual || mesAtual.ranking.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Ninguém no ranking neste mês ainda.</Card>
          ) : (
            <div className="space-y-1.5">
              {mesAtual.ranking.map((r: RankingEntry, i) => (
                <LinhaRanking key={r.user_id} pos={i + 1} nome={r.nome} ehVoce={r.user_id === meId}
                  sub={`R$ ${(r.valorPego ?? 0).toLocaleString("pt-BR")} pego · ${r.fechamentos} fechada(s)`}
                  destaque={`${r.pontos} pts`} itens={r.itens} />
              ))}
            </div>
          )}
```

with:

```tsx
          {!mesAtual || mesAtual.ranking.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">Ninguém no ranking neste mês ainda.</Card>
          ) : (
            <div className="space-y-1.5">
              <Podio top3={mesAtual.ranking.slice(0, 3)} meId={meId} />
              {mesAtual.ranking.slice(3).map((r: RankingEntry, i) => (
                <LinhaRanking key={r.user_id} pos={i + 4} nome={r.nome} ehVoce={r.user_id === meId}
                  sub={`R$ ${(r.valorPego ?? 0).toLocaleString("pt-BR")} pego · ${r.fechamentos} fechada(s)`}
                  destaque={`${r.pontos} pts`} itens={r.itens} />
              ))}
            </div>
          )}
```

(A aba "Geral" NÃO muda.)

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: ainda FAIL só no `page.tsx` (Task 6). Nenhum erro novo em `RankingPainel.tsx` ou `Podio.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/freela-yide/Podio.tsx src/components/freela-yide/RankingPainel.tsx
git commit -m "feat(freela): pódio do top 3 no ranking do mês"
```

---

### Task 6: Fiar tudo no page.tsx

**Files:**
- Modify: `src/app/(authed)/freela-yide/page.tsx`

- [ ] **Step 1: Adicionar o import**

In `src/app/(authed)/freela-yide/page.tsx`, add after the existing `import { FreelaHero } ...` line:

```tsx
import { calcularRival } from "@/lib/freela-yide/rivalidade";
```

- [ ] **Step 2: Calcular xpTotal e rival**

After the `const [todas, minhas, todasLancadas, ranking, historico, meta, stats] = await Promise.all([...]);` block, add:

```tsx
  // XP do nível = pontos acumulados de todos os tempos (historico.geral). 0 se ainda não pontuou.
  const xpTotal = historico.geral.find((g) => g.user_id === user.id)?.pontos ?? 0;
  // Rivalidade: quem está logo acima no ranking do mês corrente.
  const rival = calcularRival(ranking, user.id);
```

- [ ] **Step 3: Passar as props pro FreelaHero**

Replace:

```tsx
      <FreelaHero stats={stats} />
```

with:

```tsx
      <FreelaHero stats={stats} xpTotal={xpTotal} rival={rival} />
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: PASS — sem erros.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authed)/freela-yide/page.tsx"
git commit -m "feat(freela): fiar nível + rivalidade no FreelaHero"
```

---

### Task 7: Verificação final

**Files:** nenhum (só checagem).

- [ ] **Step 1: Lint**

Run: `npx eslint src/lib/freela-yide/niveis.ts src/lib/freela-yide/rivalidade.ts src/components/freela-yide/NivelBadge.tsx src/components/freela-yide/Podio.tsx src/components/freela-yide/FreelaHero.tsx src/components/freela-yide/RankingPainel.tsx "src/app/(authed)/freela-yide/page.tsx"`
Expected: sem erros.

- [ ] **Step 2: Testes**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/freelayide-niveis.test.ts tests/unit/freelayide-rivalidade.test.ts`
Expected: PASS (11 testes: 6 + 5).

- [ ] **Step 3: Type-check completo**

Run: `npx tsc --noEmit`
Expected: sem erros.

---

## Self-review (feito na escrita do plano)

- **Cobertura do spec:** níveis (Task 1), rivalidade (Task 2), NivelBadge/card do jogador (Tasks 3-4), pódio (Task 5), fio de dados (Task 6). ✔
- **Sem placeholders:** todo passo tem código/comando/expected concretos. ✔
- **Consistência de tipos:** `Nivel`/`nivelDeXP` (Task 1) usados em NivelBadge (3) e FreelaHero (4); `Rival`/`calcularRival` (Task 2) usados em FreelaHero (4) e page (6); `RankingEntry` (queries) usado em rivalidade (2) e Podio (5). ✔
- **Sem emoji na UI:** ícones lucide (`Sparkles`, `Target`, `Crown`, `Medal`). ✔
- **Sem migration / query nova:** `xpTotal` de `historico.geral`, `rival` de `ranking`, ambos já carregados. ✔
