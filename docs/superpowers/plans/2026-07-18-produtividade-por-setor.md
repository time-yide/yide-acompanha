# Produtividade por setor — Implementation Plan (Sub-projeto 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Mostrar produtividade por cargo no /produtividade — uma coluna "Produtividade" com o número-chave do cargo (ligações/anúncios/% no prazo/artes) + um painel "Produtividade por setor", e esconder todo o financeiro do coordenador de audiovisual.

**Architecture:** Um módulo novo `setor-metricas.ts` com funções puras (role→setor, % no prazo, rótulo) + um fetch `getProdutividadeSetor(range)` que agrega as fontes existentes (ligacoes, anuncios_ecommerce, social_media_posts, design_artes, tasks). A página consome isso, injeta a coluna na tabela e renderiza o painel; um flag `mostrarFinanceiro` esconde as colunas/cards de dinheiro do audiovisual_chefe.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase service-role, vitest, Tailwind.

**Branch:** já criada — `feat/produtividade-por-setor` a partir de `origin/main`. Spec commitado. NÃO trocar de branch. Local main vive atrás; código real só em origin/main.

**Nota de testes:** SEMPRE `npx vitest run --exclude '**/.claude/**' <arquivo>`. Nunca a suíte inteira (worktrees stale geram ~148 falhas alheias).

**Datas/soft-delete (cuidado):** `social_media_posts` e `design_artes` usam `archived_at` (inglês); `ligacoes`/`anuncios_ecommerce` usam `arquivado_em`. `ligacoes.iniciada_em`, `social_media_posts.publicado_em`, `design_artes.aprovado_em`, `tasks.completed_at` são timestamptz (janela UTC); `anuncios_ecommerce.data` é date.

---

## File Structure

- **Create** `src/lib/produtividade/setor-metricas.ts` — tipos, puras, `getProdutividadeSetor`.
- **Create** `src/lib/produtividade/setor-metricas.test.ts` — testes das puras.
- **Create** `src/components/produtividade/ProdutividadeSetorSection.tsx` — painel por setor.
- **Modify** `src/lib/produtividade/queries.ts` — exportar `computeSince` (reuso da janela de datas).
- **Modify** `src/components/produtividade/ColaboradoresTable.tsx` — coluna Produtividade + prop `mostrarFinanceiro`.
- **Modify** `src/components/produtividade/ProdutividadeSummaryCards.tsx` — prop `mostrarFinanceiro`.
- **Modify** `src/app/(authed)/produtividade/page.tsx` — fetch, `mostrarFinanceiro`, render, gate do TimeAudiovisualCard.

---

## Task 1: Funções puras `setor-metricas` + testes (TDD)

**Files:**
- Create: `src/lib/produtividade/setor-metricas.ts`
- Test: `src/lib/produtividade/setor-metricas.test.ts`

- [ ] **Step 1: Escreve o teste que falha**

Create `src/lib/produtividade/setor-metricas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  roleParaSetor,
  isRoleAudiovisual,
  pctNoPrazo,
  resolveMetricaPessoa,
  type MetricaCrua,
} from "./setor-metricas";

describe("roleParaSetor", () => {
  it("mapeia cada cargo pro setor certo", () => {
    expect(roleParaSetor("comercial")).toBe("comercial");
    expect(roleParaSetor("assessor_ecommerce")).toBe("ecommerce");
    expect(roleParaSetor("assistente_ecommerce")).toBe("ecommerce");
    expect(roleParaSetor("assessor", "ecommerce")).toBe("ecommerce");
    expect(roleParaSetor("assessor", null)).toBe("assessoria");
    expect(roleParaSetor("assessor")).toBe("assessoria");
    expect(roleParaSetor("designer")).toBe("design");
    expect(roleParaSetor("videomaker")).toBe("audiovisual");
    expect(roleParaSetor("adm")).toBeNull();
    expect(roleParaSetor("socio")).toBeNull();
    expect(roleParaSetor("programacao")).toBeNull();
  });
});

describe("isRoleAudiovisual", () => {
  it("cobre a equipe de produção audiovisual", () => {
    expect(isRoleAudiovisual("videomaker")).toBe(true);
    expect(isRoleAudiovisual("editor")).toBe(true);
    expect(isRoleAudiovisual("fast_midia")).toBe(true);
    expect(isRoleAudiovisual("assessor")).toBe(false);
  });
});

describe("pctNoPrazo", () => {
  it("razão em % (0-100), null quando sem tarefas com prazo", () => {
    expect(pctNoPrazo(9, 10)).toBe(90);
    expect(pctNoPrazo(0, 4)).toBe(0);
    expect(pctNoPrazo(0, 0)).toBeNull();
  });
});

describe("resolveMetricaPessoa", () => {
  const crua = (over: Partial<MetricaCrua>): MetricaCrua => ({
    ligacoes_feitas: 0, ligacoes_atendidas: 0, anuncios: 0,
    tarefas_entregues: 0, tarefas_no_prazo: 0, tarefas_com_prazo: 0,
    tarefas_atrasadas: 0, postagens: 0, artes: 0, ...over,
  });

  it("comercial → ligações", () => {
    const m = resolveMetricaPessoa("comercial", null, crua({ ligacoes_feitas: 45 }));
    expect(m).toEqual({ setor: "comercial", valor: 45, unidade: "contagem", rotulo: "45 ligações" });
  });
  it("ecommerce → anúncios", () => {
    const m = resolveMetricaPessoa("assistente_ecommerce", null, crua({ anuncios: 320 }));
    expect(m.rotulo).toBe("320 anúncios");
    expect(m.valor).toBe(320);
  });
  it("assessoria → % no prazo", () => {
    const m = resolveMetricaPessoa("assessor", null, crua({ tarefas_no_prazo: 11, tarefas_com_prazo: 12 }));
    expect(m.unidade).toBe("percentual");
    expect(m.valor).toBeCloseTo(91.666, 1);
    expect(m.rotulo).toBe("92% no prazo");
  });
  it("assessoria sem tarefas com prazo → —", () => {
    const m = resolveMetricaPessoa("assessor", null, crua({}));
    expect(m.valor).toBeNull();
    expect(m.rotulo).toBe("—");
  });
  it("design → artes", () => {
    const m = resolveMetricaPessoa("designer", null, crua({ artes: 25 }));
    expect(m.rotulo).toBe("25 artes");
  });
  it("gestão (adm) → sem setor, —", () => {
    const m = resolveMetricaPessoa("adm", null, crua({}));
    expect(m.setor).toBeNull();
    expect(m.rotulo).toBe("—");
  });
  it("singular: 1 ligação / 1 arte / 1 anúncio", () => {
    expect(resolveMetricaPessoa("comercial", null, crua({ ligacoes_feitas: 1 })).rotulo).toBe("1 ligação");
    expect(resolveMetricaPessoa("designer", null, crua({ artes: 1 })).rotulo).toBe("1 arte");
    expect(resolveMetricaPessoa("assessor_ecommerce", null, crua({ anuncios: 1 })).rotulo).toBe("1 anúncio");
  });
});
```

- [ ] **Step 2: Roda e confirma falha**

Run: `npx vitest run --exclude '**/.claude/**' src/lib/produtividade/setor-metricas.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementa a parte pura (só as puras + tipos; o fetch vem na Task 2)**

Create `src/lib/produtividade/setor-metricas.ts`:

```ts
// A parte de cálculo/rotulagem é pura e testável. O fetch (getProdutividadeSetor)
// vive no fim, usa service-role.
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { formatIsoDate, getAppTimezoneOffsetMs } from "@/lib/datetime/timezone";
import { computeSince, type PeriodoRange } from "./queries";

export type Setor = "comercial" | "ecommerce" | "assessoria" | "design" | "audiovisual";

export interface MetricaCrua {
  ligacoes_feitas: number;
  ligacoes_atendidas: number;
  anuncios: number;
  tarefas_entregues: number;
  tarefas_no_prazo: number;
  tarefas_com_prazo: number;
  tarefas_atrasadas: number;
  postagens: number;
  artes: number;
}

export interface MetricaPessoa {
  setor: Setor | null;
  valor: number | null; // contagem, ou % (0-100); null = sem dado
  unidade: "contagem" | "percentual";
  rotulo: string; // "45 ligações" | "92% no prazo" | "—"
}

const AUDIOVISUAL = new Set(["videomaker", "editor", "fast_midia", "audiovisual_chefe"]);
const ECOMMERCE = new Set(["assessor_ecommerce", "assistente_ecommerce"]);

export function isRoleAudiovisual(role: string): boolean {
  return role === "videomaker" || role === "editor" || role === "fast_midia";
}

export function roleParaSetor(role: string, especialidade?: string | null): Setor | null {
  if (role === "comercial") return "comercial";
  if (ECOMMERCE.has(role)) return "ecommerce";
  if (role === "assessor") return especialidade === "ecommerce" ? "ecommerce" : "assessoria";
  if (role === "designer") return "design";
  if (AUDIOVISUAL.has(role)) return "audiovisual";
  return null;
}

export function pctNoPrazo(noPrazo: number, comPrazo: number): number | null {
  if (comPrazo <= 0) return null;
  return (noPrazo / comPrazo) * 100;
}

function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function resolveMetricaPessoa(
  role: string,
  especialidade: string | null,
  c: MetricaCrua,
): MetricaPessoa {
  const setor = roleParaSetor(role, especialidade);
  switch (setor) {
    case "comercial":
      return { setor, valor: c.ligacoes_feitas, unidade: "contagem", rotulo: plural(c.ligacoes_feitas, "ligação", "ligações") };
    case "ecommerce":
      return { setor, valor: c.anuncios, unidade: "contagem", rotulo: plural(c.anuncios, "anúncio", "anúncios") };
    case "assessoria": {
      const pct = pctNoPrazo(c.tarefas_no_prazo, c.tarefas_com_prazo);
      return {
        setor,
        valor: pct,
        unidade: "percentual",
        rotulo: pct === null ? "—" : `${Math.round(pct)}% no prazo`,
      };
    }
    case "design":
      return { setor, valor: c.artes, unidade: "contagem", rotulo: plural(c.artes, "arte", "artes") };
    default:
      // audiovisual usa "entregas" (renderizado na tabela via row.entregas_periodo);
      // gestão/programação/sem setor → "—".
      return { setor, valor: null, unidade: "contagem", rotulo: "—" };
  }
}
```

- [ ] **Step 4: Roda e confirma que passa**

Run: `npx vitest run --exclude '**/.claude/**' src/lib/produtividade/setor-metricas.test.ts`
Expected: PASS — todos verdes.

> Nota: `getProdutividadeSetor` (o fetch) ainda não existe — a Task 2 adiciona no mesmo arquivo. O `unstable_cache`/`createServiceRoleClient`/imports já estão declarados; se o linter reclamar de import não usado NESTE ponto, tudo bem — a Task 2 usa. (Se preferir manter verde: a Task 2 vem logo em seguida.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/produtividade/setor-metricas.ts src/lib/produtividade/setor-metricas.test.ts
git commit -m "feat(produtividade): setor-metricas puras (role→setor, % no prazo, rótulo) + testes"
```

---

## Task 2: Fetch `getProdutividadeSetor` + export `computeSince`

**Files:**
- Modify: `src/lib/produtividade/queries.ts` (exportar `computeSince`)
- Modify: `src/lib/produtividade/setor-metricas.ts` (adicionar fetch + tipos de saída)

- [ ] **Step 1: Exporta `computeSince` em queries.ts**

Em `src/lib/produtividade/queries.ts`, acha `function computeSince(range: PeriodoRange, todayIso: string): string {` e adiciona `export ` na frente:
```ts
export function computeSince(range: PeriodoRange, todayIso: string): string {
```

- [ ] **Step 2: Adiciona tipos de saída + o fetch ao fim de `setor-metricas.ts`**

Ao final de `src/lib/produtividade/setor-metricas.ts`, adiciona:

```ts
export interface PessoaSetor extends MetricaCrua {
  user_id: string;
  nome: string;
  role: string;
}

export interface BlocoSetor {
  setor: Setor;
  titulo: string;
  pessoas: PessoaSetor[]; // já ordenadas (maior métrica-chave primeiro)
}

export interface ProdutividadeSetorResult {
  /** métrica-chave por usuário, pra coluna da tabela. */
  porUsuario: Record<string, MetricaPessoa>;
  /** blocos pro painel (só setores com gente). */
  setores: BlocoSetor[];
}

const TITULO_SETOR: Record<Setor, string> = {
  comercial: "Comercial",
  ecommerce: "E-commerce",
  assessoria: "Assessoria",
  design: "Design",
  audiovisual: "Audiovisual",
};

// Setores mostrados no painel (audiovisual fica de fora — não pedido).
const SETORES_PAINEL: Setor[] = ["comercial", "ecommerce", "assessoria", "design"];

// Chave de ordenação DENTRO de um bloco — usa a métrica do setor do bloco
// (não re-resolve por cargo, senão assessor+ecommerce ordenaria errado).
function valorChaveSetor(setor: Setor, p: PessoaSetor): number {
  switch (setor) {
    case "comercial": return p.ligacoes_feitas;
    case "ecommerce": return p.anuncios;
    case "assessoria": return pctNoPrazo(p.tarefas_no_prazo, p.tarefas_com_prazo) ?? -1;
    case "design": return p.artes;
    default: return -1;
  }
}

async function _getProdutividadeSetorImpl(range: PeriodoRange): Promise<ProdutividadeSetorResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const today = formatIsoDate(new Date());
  const since = computeSince(range, today);
  const offsetHours = getAppTimezoneOffsetMs() / (60 * 60 * 1000);
  const sinceStartUtc = new Date(`${since}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();
  const tomorrowDate = new Date(`${today}T00:00:00.000Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrow = formatIsoDate(tomorrowDate);
  const tomorrowStartUtc = new Date(`${tomorrow}T${String(offsetHours).padStart(2, "0")}:00:00.000Z`).toISOString();

  const [
    { data: profilesData },
    { data: ligacoesData },
    { data: anunciosData },
    { data: entreguesData },
    { data: atrasadasData },
    { data: postagensData },
    { data: artesData },
  ] = await Promise.all([
    sb.from("profiles").select("id, nome, role, especialidade").eq("ativo", true).order("nome"),
    sb.from("ligacoes").select("colaborador_id, status, direcao")
      .is("arquivado_em", null).eq("direcao", "saida")
      .gte("iniciada_em", sinceStartUtc).lt("iniciada_em", tomorrowStartUtc)
      .not("colaborador_id", "is", null),
    sb.from("anuncios_ecommerce").select("colaborador_id, quantidade")
      .is("arquivado_em", null).gte("data", since).lte("data", today)
      .not("colaborador_id", "is", null),
    // Assessor: entregues (postada) no período — com/ sem prazo e no prazo.
    sb.from("tasks").select("atribuido_a, due_date, completed_at")
      .eq("status", "postada").gte("completed_at", sinceStartUtc).lt("completed_at", tomorrowStartUtc)
      .not("atribuido_a", "is", null),
    // Tarefas atrasadas atuais (prazo vencido, não postada, não deletada).
    sb.from("tasks").select("atribuido_a")
      .is("deleted_at", null).neq("status", "postada").lt("due_date", today)
      .not("atribuido_a", "is", null),
    sb.from("social_media_posts").select("criado_por")
      .is("archived_at", null).eq("status", "publicado")
      .gte("publicado_em", sinceStartUtc).lt("publicado_em", tomorrowStartUtc)
      .not("criado_por", "is", null),
    sb.from("design_artes").select("criado_por")
      .is("archived_at", null).eq("status", "aprovado")
      .gte("aprovado_em", sinceStartUtc).lt("aprovado_em", tomorrowStartUtc)
      .not("criado_por", "is", null),
  ]);

  const profiles = (profilesData ?? []) as Array<{ id: string; nome: string; role: string; especialidade: string | null }>;

  const zero = (): MetricaCrua => ({
    ligacoes_feitas: 0, ligacoes_atendidas: 0, anuncios: 0,
    tarefas_entregues: 0, tarefas_no_prazo: 0, tarefas_com_prazo: 0,
    tarefas_atrasadas: 0, postagens: 0, artes: 0,
  });
  const cruas = new Map<string, MetricaCrua>();
  const get = (id: string) => { let m = cruas.get(id); if (!m) { m = zero(); cruas.set(id, m); } return m; };

  for (const l of (ligacoesData ?? []) as Array<{ colaborador_id: string; status: string }>) {
    const m = get(l.colaborador_id); m.ligacoes_feitas++; if (l.status === "atendida") m.ligacoes_atendidas++;
  }
  for (const a of (anunciosData ?? []) as Array<{ colaborador_id: string; quantidade: number }>) {
    get(a.colaborador_id).anuncios += Number(a.quantidade ?? 0);
  }
  for (const t of (entreguesData ?? []) as Array<{ atribuido_a: string; due_date: string | null; completed_at: string | null }>) {
    const m = get(t.atribuido_a); m.tarefas_entregues++;
    if (t.due_date) {
      m.tarefas_com_prazo++;
      if (t.completed_at && t.completed_at.slice(0, 10) <= t.due_date) m.tarefas_no_prazo++;
    }
  }
  for (const t of (atrasadasData ?? []) as Array<{ atribuido_a: string }>) {
    get(t.atribuido_a).tarefas_atrasadas++;
  }
  for (const p of (postagensData ?? []) as Array<{ criado_por: string }>) {
    get(p.criado_por).postagens++;
  }
  for (const a of (artesData ?? []) as Array<{ criado_por: string }>) {
    get(a.criado_por).artes++;
  }

  const porUsuario: Record<string, MetricaPessoa> = {};
  const pessoasPorSetor = new Map<Setor, PessoaSetor[]>();
  for (const prof of profiles) {
    const crua = cruas.get(prof.id) ?? zero();
    const metrica = resolveMetricaPessoa(prof.role, prof.especialidade, crua);
    porUsuario[prof.id] = metrica;
    if (metrica.setor && SETORES_PAINEL.includes(metrica.setor)) {
      const arr = pessoasPorSetor.get(metrica.setor) ?? [];
      arr.push({ user_id: prof.id, nome: prof.nome, role: prof.role, ...crua });
      pessoasPorSetor.set(metrica.setor, arr);
    }
  }

  const setores: BlocoSetor[] = SETORES_PAINEL.filter((s) => pessoasPorSetor.has(s)).map((setor) => ({
    setor,
    titulo: TITULO_SETOR[setor],
    pessoas: (pessoasPorSetor.get(setor) ?? []).sort((a, b) => valorChaveSetor(setor, b) - valorChaveSetor(setor, a)),
  }));

  return { porUsuario, setores };
}

/** Produtividade por setor no período (cacheado 5min, tag dashboard). */
export async function getProdutividadeSetor(range: PeriodoRange = "dia"): Promise<ProdutividadeSetorResult> {
  const cached = unstable_cache(
    async (r: string) => _getProdutividadeSetorImpl(r as PeriodoRange),
    ["produtividade-setor-v1"],
    { revalidate: 300, tags: ["dashboard"] },
  );
  return cached(range);
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros em setor-metricas.ts nem queries.ts. (`especialidade` existe na tabela profiles; o `as any` no client cobre colunas fora dos tipos gerados.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/produtividade/queries.ts src/lib/produtividade/setor-metricas.ts
git commit -m "feat(produtividade): getProdutividadeSetor — agrega ligações/anúncios/tarefas/postagens/artes"
```

---

## Task 3: Painel `ProdutividadeSetorSection`

**Files:**
- Create: `src/components/produtividade/ProdutividadeSetorSection.tsx`

- [ ] **Step 1: Cria o componente**

Create `src/components/produtividade/ProdutividadeSetorSection.tsx`:

```tsx
import type { BlocoSetor, PessoaSetor } from "@/lib/produtividade/setor-metricas";

interface Coluna {
  titulo: string;
  valor: (p: PessoaSetor) => string | number;
}

const COLUNAS: Record<string, Coluna[]> = {
  comercial: [
    { titulo: "Ligações", valor: (p) => p.ligacoes_feitas },
    { titulo: "Atendidas", valor: (p) => p.ligacoes_atendidas },
  ],
  ecommerce: [
    { titulo: "Anúncios", valor: (p) => p.anuncios },
  ],
  assessoria: [
    { titulo: "No prazo", valor: (p) => (p.tarefas_com_prazo > 0 ? `${Math.round((p.tarefas_no_prazo / p.tarefas_com_prazo) * 100)}%` : "—") },
    { titulo: "Entregues", valor: (p) => p.tarefas_entregues },
    { titulo: "Atrasadas", valor: (p) => p.tarefas_atrasadas },
    { titulo: "Postagens", valor: (p) => p.postagens },
  ],
  design: [
    { titulo: "Artes", valor: (p) => p.artes },
    { titulo: "No prazo", valor: (p) => (p.tarefas_com_prazo > 0 ? `${Math.round((p.tarefas_no_prazo / p.tarefas_com_prazo) * 100)}%` : "—") },
  ],
};

export function ProdutividadeSetorSection({ setores }: { setores: BlocoSetor[] }) {
  if (setores.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Produtividade por setor
      </h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {setores.map((bloco) => {
          const cols = COLUNAS[bloco.setor] ?? [];
          return (
            <div key={bloco.setor} className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b bg-muted/30 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {bloco.titulo}
              </div>
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Pessoa</th>
                    {cols.map((c) => (
                      <th key={c.titulo} className="px-4 py-2 text-right font-medium">{c.titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bloco.pessoas.map((p) => (
                    <tr key={p.user_id} className="border-t last:border-b-0">
                      <td className="px-4 py-2 text-left truncate">{p.nome}</td>
                      {cols.map((c) => (
                        <td key={c.titulo} className="px-4 py-2 text-right tabular-nums">{c.valor(p)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/components/produtividade/ProdutividadeSetorSection.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/produtividade/ProdutividadeSetorSection.tsx
git commit -m "feat(produtividade): painel Produtividade por setor"
```

---

## Task 4: Coluna "Produtividade" + gate financeiro na `ColaboradoresTable`

**Files:**
- Modify: `src/components/produtividade/ColaboradoresTable.tsx`

- [ ] **Step 1: Imports + Props**

No topo, adiciona:
```ts
import type { MetricaPessoa } from "@/lib/produtividade/setor-metricas";
import { isRoleAudiovisual } from "@/lib/produtividade/setor-metricas";
```
Troca a interface `Props`:
```ts
interface Props {
  rows: ColaboradorStatusRow[];
  produtividade: Record<string, MetricaPessoa>;
  mostrarFinanceiro: boolean;
}
```
E a assinatura do componente:
```ts
export function ColaboradoresTable({ rows, produtividade, mostrarFinanceiro }: Props) {
```

- [ ] **Step 2: Helper de rótulo da produtividade (dentro do componente, antes do `return`)**

Adiciona:
```ts
  function rotuloProdutividade(r: ColaboradorStatusRow): string {
    const m = produtividade[r.user_id];
    if (m && m.rotulo !== "—") return m.rotulo;
    if (isRoleAudiovisual(r.role)) return `${r.entregas_periodo} ${r.entregas_periodo === 1 ? "entrega" : "entregas"}`;
    return "—";
  }
```

- [ ] **Step 3: Header "Produtividade" + esconder headers financeiros**

No `<thead>`, logo depois do `<th>` de "Atrasados", adiciona:
```tsx
              <th className="px-4 py-2.5 text-right">
                <SortBtn label="Produtividade" k="produtividade" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
              </th>
```
Envolve os `<th>` de "Custo/h", "Custo salário", "Receita" e "Lucro" com `{mostrarFinanceiro && ( ... )}`. Exemplo pro de Custo/h:
```tsx
              {mostrarFinanceiro && (
                <th className="px-4 py-2.5 text-right">
                  <SortBtn label="Custo/h" k="custo_hora" sortKey={sortKey} sortDir={sortDir} toggle={toggleSort} />
                </th>
              )}
```
Faz o mesmo pros headers de Custo salário (`custo_periodo`), Receita (`receita`), Lucro (`lucro`). O header de "Entregas" permanece sempre.

- [ ] **Step 4: Célula "Produtividade" + esconder células financeiras**

No `<tbody>`, na linha, logo após a `<td>` de Atrasados (o `AtrasadosBadge`), adiciona:
```tsx
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {rotuloProdutividade(r)}
                  </td>
```
Envolve as `<td>` de Custo/h, Custo salário, Receita e Lucro com `{mostrarFinanceiro && ( ... )}`.
Na `<td>` de Entregas (`<EntregasCell .../>`), passa a nova prop pra esconder o subtexto de R$: troca por:
```tsx
                  <td className="px-4 py-3 text-right tabular-nums">
                    <EntregasCell
                      entregas={r.entregas_periodo}
                      custoPorEntrega={mostrarFinanceiro ? r.custo_por_entrega : null}
                    />
                  </td>
```

- [ ] **Step 5: SortKey + ordenação da produtividade**

Troca o tipo `SortKey` pra incluir `"produtividade"`:
```ts
type SortKey = "nome" | "ativo" | "tempo" | "eventos" | "custo_periodo" | "custo_hora" | "atrasados" | "entregas" | "receita" | "lucro" | "produtividade";
```
No `switch (sortKey)` do `sorted`, adiciona um case (usa o `valor` da métrica; audiovisual usa entregas):
```ts
        case "produtividade": {
          const va = produtividade[a.user_id]?.valor ?? (isRoleAudiovisual(a.role) ? a.entregas_periodo : -1);
          const vb = produtividade[b.user_id]?.valor ?? (isRoleAudiovisual(b.role) ? b.entregas_periodo : -1);
          cmp = vb - va;
          break;
        }
```

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/components/produtividade/ColaboradoresTable.tsx`
Expected: sem erros novos em ColaboradoresTable.tsx. (page.tsx vai acusar por ainda não passar as props novas — corrigido na Task 6.)

- [ ] **Step 7: Commit**

```bash
git add src/components/produtividade/ColaboradoresTable.tsx
git commit -m "feat(produtividade): coluna Produtividade + esconde financeiro por prop"
```

---

## Task 5: Gate financeiro nos `ProdutividadeSummaryCards`

**Files:**
- Modify: `src/components/produtividade/ProdutividadeSummaryCards.tsx`

- [ ] **Step 1: Prop `mostrarFinanceiro` + filtro dos cards**

Troca a interface `Props`:
```ts
interface Props {
  summary: ProdutividadeSummary;
  periodoLabel?: string;
  mostrarFinanceiro?: boolean;
}
```
Marca os 4 cards financeiros no array `CARDS` adicionando `financeiro: true` a cada um deles ("Custo do período", "Custo por entrega", "Faturamento do período", "Lucro do time"). Ex.:
```ts
  {
    label: "Custo do período",
    icon: DollarSign,
    tone: "amber",
    financeiro: true,
    getValue: (s: ProdutividadeSummary) => formatBRL(s.custo_periodo_total),
    getHint: ...
  },
```
(Adiciona `financeiro: true` também em "Custo por entrega", "Faturamento do período" e "Lucro do time". Os 4 não-financeiros ficam sem a flag.)

Na função do componente, filtra:
```ts
export function ProdutividadeSummaryCards({ summary, periodoLabel, mostrarFinanceiro = true }: Props) {
```
E onde faz `{CARDS.map(...)}`, troca por `{CARDS.filter((c) => mostrarFinanceiro || !("financeiro" in c && c.financeiro)).map(...)}`.

> Como `CARDS` é `as const`, a propriedade opcional `financeiro` pode gerar erro de tipo no `.filter`. Se ocorrer, remove o `as const` do array `CARDS` (ele não é necessário pro funcionamento) OU tipa `financeiro?: boolean` explicitamente. Confirma com `tsc`.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/components/produtividade/ProdutividadeSummaryCards.tsx`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/produtividade/ProdutividadeSummaryCards.tsx
git commit -m "feat(produtividade): esconde cards financeiros quando mostrarFinanceiro=false"
```

---

## Task 6: Liga tudo na página + gate do audiovisual_chefe

**Files:**
- Modify: `src/app/(authed)/produtividade/page.tsx`

- [ ] **Step 1: Imports**

Adiciona:
```ts
import { getProdutividadeSetor } from "@/lib/produtividade/setor-metricas";
import { ProdutividadeSetorSection } from "@/components/produtividade/ProdutividadeSetorSection";
```

- [ ] **Step 2: Fetch + mostrarFinanceiro**

Troca o bloco do `Promise.all` pra incluir o setor e calcular `mostrarFinanceiro`:
```ts
  const [statusResult, entregaMaterial, events, setorResult] = await Promise.all([
    getColaboradoresStatus(range),
    getEntregaMaterialStats(range),
    listRecentEvents(30),
    getProdutividadeSetor(range),
  ]);
  const { rows, faturamento_periodo, time_audiovisual } = statusResult;
  const summary = summarizeStatus(rows, faturamento_periodo);
  // Coordenador de audiovisual não vê nada financeiro (custo/receita/lucro).
  const mostrarFinanceiro = user.role !== "audiovisual_chefe";
```

- [ ] **Step 3: Passa props / gate nos componentes**

- `ProdutividadeSummaryCards`:
```tsx
      <ProdutividadeSummaryCards summary={summary} periodoLabel={PERIODO_LABEL[range]} mostrarFinanceiro={mostrarFinanceiro} />
```
- `TimeAudiovisualCard` (esconde do audiovisual_chefe):
```tsx
      {mostrarFinanceiro && time_audiovisual && (
        <div className="mb-3">
          <TimeAudiovisualCard time={time_audiovisual} />
        </div>
      )}
```
- `ColaboradoresTable`:
```tsx
        <ColaboradoresTable rows={rows} produtividade={setorResult.porUsuario} mostrarFinanceiro={mostrarFinanceiro} />
```
- Adiciona a seção do painel logo após a seção da tabela (antes de `<EntregaMaterialSection ... />`):
```tsx
      <ProdutividadeSetorSection setores={setorResult.setores} />
```

- [ ] **Step 4: Type-check + lint (deve zerar)**

Run: `npx tsc --noEmit && npx eslint "src/app/(authed)/produtividade/page.tsx"`
Expected: ZERO erros no projeto.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authed)/produtividade/page.tsx"
git commit -m "feat(produtividade): produtividade por setor na página + esconde financeiro do coord audiovisual"
```

---

## Task 7: PR

- [ ] **Step 1: Verificação final**

Run: `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' src/lib/produtividade/setor-metricas.test.ts`
Expected: tsc limpo; testes verdes.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/produtividade-por-setor
gh pr create --base main --title "feat(produtividade): produtividade por setor + esconde financeiro do coord audiovisual" --body "$(cat <<'EOF'
## O que muda
- **Coluna "Produtividade"** por cargo: comercial = ligações, e-commerce = anúncios, assessor = % no prazo, design = artes, audiovisual = entregas. Cada linha na língua do cargo.
- **Painel "Produtividade por setor"**: blocos (Comercial / E-commerce / Assessoria / Design) com ranking interno e as métricas de cada setor.
- **Gate financeiro**: o coordenador de audiovisual (`audiovisual_chefe`) deixa de ver qualquer coisa de dinheiro (custo/salário, custo por entrega, receita, lucro, faturamento, card do Time Audiovisual). adm/sócio/coordenador geral continuam vendo tudo.

Reusa fontes existentes (ligacoes, anuncios_ecommerce, tasks, social_media_posts, design_artes). Não toca no cálculo de receita/lucro. Sem migration.

Spec: `docs/superpowers/specs/2026-07-18-produtividade-por-setor-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI verde → merge**

Espera o check `test` verde, então `gh pr merge --squash --delete-branch`.

---

## Notas de verificação manual (pós-deploy)

- Comercial mostra "N ligações"; e-commerce "N anúncios"; assessor "X% no prazo"; designer "N artes".
- Painel por setor aparece com os blocos que têm gente, ranking do maior pro menor.
- Logado como coordenador de audiovisual (Duxx): nenhuma coluna/card de dinheiro; produtividade e painel visíveis.
- adm/sócio/Lucas: tudo como antes + as novidades.

## Riscos / suposições

- `ligacoes` tem `organization_id`, mas a página de produtividade não escopa por org (nenhuma query escopa) — conto sem filtro de org, consistente com o resto.
- audiovisual (videomaker/editor/fast) não estava na lista → coluna usa `entregas_periodo` existente (fallback na tabela).
- `% no prazo` compara `completed_at::date <= due_date` só entre tarefas `postada` com `due_date`.
