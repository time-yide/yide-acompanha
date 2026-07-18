# Dashboard da Programação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Dar à programadora um dashboard de verdade (resumo do mês + últimos lançamentos + salário) no lugar do "oi" vazio, e uma página `/programacao/clientes` (cliente · assessor responsável) no menu dela.

**Architecture:** Novo componente de dashboard por cargo `DashboardProgramacao` (padrão dos outros: `HiddenValuesProvider` + `FixoCard`), reusando `listLancamentos`; função pura `resumoLancamentos` testável. Nova página `/programacao/clientes` + query `listClientesComAssessor` + item de menu.

**Tech Stack:** Next.js (App Router, Server Components), TypeScript, Supabase service-role, vitest, Tailwind, lucide-react.

**Branch:** já criada — `feat/dashboard-programacao` a partir de `origin/main`. Spec commitado. NÃO trocar de branch.

**Nota de testes:** SEMPRE `npx vitest run --exclude '**/.claude/**' <arquivo>`. `resumo.ts` é puro (sem imports server) → o teste roda liso.

---

## File Structure

- **Create** `src/lib/programacao/resumo.ts`, `src/lib/programacao/resumo.test.ts`
- **Create** `src/components/dashboard/DashboardProgramacao.tsx`
- **Create** `src/app/(authed)/programacao/clientes/page.tsx`
- **Modify** `src/lib/programacao/queries.ts` (`listClientesComAssessor`)
- **Modify** `src/app/(authed)/page.tsx` (caso do cargo)
- **Modify** `src/components/layout/nav-config.ts` (item "Clientes")

---

## Task 1: `resumoLancamentos` puro + teste (TDD)

**Files:** Create `src/lib/programacao/resumo.ts`, `src/lib/programacao/resumo.test.ts`.

- [ ] **Step 1: Teste que falha**

Create `src/lib/programacao/resumo.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resumoLancamentos } from "./resumo";

describe("resumoLancamentos", () => {
  it("soma quantidade por tipo + total", () => {
    const r = resumoLancamentos([
      { tipo: "crm_conectado", quantidade: 2 },
      { tipo: "usuario_criado", quantidade: 5 },
      { tipo: "sistema_feito", quantidade: 1 },
      { tipo: "crm_conectado", quantidade: 3 },
    ]);
    expect(r).toEqual({ crm: 5, usuarios: 5, sistemas: 1, total: 11 });
  });
  it("ignora tipo desconhecido no detalhe mas conta no total", () => {
    const r = resumoLancamentos([{ tipo: "outro", quantidade: 4 }]);
    expect(r).toEqual({ crm: 0, usuarios: 0, sistemas: 0, total: 4 });
  });
  it("vazio → tudo 0", () => {
    expect(resumoLancamentos([])).toEqual({ crm: 0, usuarios: 0, sistemas: 0, total: 0 });
  });
});
```
Run `npx vitest run --exclude '**/.claude/**' src/lib/programacao/resumo.test.ts` → FAIL (module not found).

- [ ] **Step 2: Implementa (puro, sem imports)**

Create `src/lib/programacao/resumo.ts`:
```ts
// Puro/client-safe — sem imports de server. Agrega lançamentos por tipo.
export interface ResumoLancamentos {
  crm: number;
  usuarios: number;
  sistemas: number;
  total: number;
}

export function resumoLancamentos(
  rows: Array<{ tipo: string; quantidade: number }>,
): ResumoLancamentos {
  const r: ResumoLancamentos = { crm: 0, usuarios: 0, sistemas: 0, total: 0 };
  for (const l of rows) {
    const q = Number(l.quantidade ?? 0);
    r.total += q;
    if (l.tipo === "crm_conectado") r.crm += q;
    else if (l.tipo === "usuario_criado") r.usuarios += q;
    else if (l.tipo === "sistema_feito") r.sistemas += q;
  }
  return r;
}
```
Run the test again → PASS.

- [ ] **Step 3: Commit**
```bash
git add src/lib/programacao/resumo.ts src/lib/programacao/resumo.test.ts
git commit -m "feat(programacao): resumoLancamentos puro + teste"
```

---

## Task 2: `listClientesComAssessor` na `queries.ts`

**Files:** Modify `src/lib/programacao/queries.ts`.

- [ ] **Step 1: Adiciona a query**

Ao FINAL de `src/lib/programacao/queries.ts`, adiciona:
```ts
export interface ClienteAssessorRow {
  id: string;
  nome: string;
  assessor_nome: string | null;
}

/** Clientes da org (não deletados) + nome do assessor responsável. Busca por nome. */
export async function listClientesComAssessor(
  orgId: string,
  q?: string | null,
): Promise<ClienteAssessorRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  let query = sb
    .from("clients")
    .select("id, nome, assessor:profiles!clients_assessor_id_fkey(nome)")
    .eq("organization_id", orgId)
    .is("deleted_at", null);
  if (q) query = query.ilike("nome", `%${q}%`);
  query = query.order("nome");
  const { data, error } = await query;
  if (error) {
    console.error("[programacao] listClientesComAssessor", error.message);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    nome: r.nome as string,
    assessor_nome: ((r.assessor as { nome?: string } | null) ?? null)?.nome ?? null,
  }));
}
```

- [ ] **Step 2: Type-check + commit**

Run `npx tsc --noEmit` (limpo).
```bash
git add src/lib/programacao/queries.ts
git commit -m "feat(programacao): listClientesComAssessor (cliente + assessor responsável)"
```

---

## Task 3: Componente `DashboardProgramacao`

**Files:** Create `src/components/dashboard/DashboardProgramacao.tsx`.

- [ ] **Step 1: Cria o componente**

Create `src/components/dashboard/DashboardProgramacao.tsx`:
```tsx
import Link from "next/link";
import { Plus, Database, UserPlus, Boxes, Layers } from "lucide-react";
import { FixoCard } from "./personal/FixoCard";
import { HiddenValuesProvider, HiddenValueToggle } from "./HiddenValuesContext";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { listLancamentos } from "@/lib/programacao/queries";
import { resumoLancamentos } from "@/lib/programacao/resumo";

interface Props {
  userId: string;
  nome: string;
}

function inicioDoMes(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}
function formatarDataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export async function DashboardProgramacao({ userId, nome }: Props) {
  const primeiroNome = nome.split(" ")[0];
  const orgId = await getOrganizationId(userId);
  const lancamentos = orgId
    ? await listLancamentos(orgId, "programacao", userId, { de: inicioDoMes(), ate: hoje() })
    : [];
  const resumo = resumoLancamentos(lancamentos);
  const recentes = lancamentos.slice(0, 5);

  const cards = [
    { label: "CRMs conectados", valor: resumo.crm, icon: Database },
    { label: "Usuários criados", valor: resumo.usuarios, icon: UserPlus },
    { label: "Sistemas feitos", valor: resumo.sistemas, icon: Boxes },
    { label: "Total", valor: resumo.total, icon: Layers },
  ];

  return (
    <HiddenValuesProvider>
      <div className="space-y-4 sm:space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {primeiroNome}</h1>
            <p className="text-sm text-muted-foreground">Seus lançamentos deste mês.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/programacao"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Registrar
            </Link>
            <HiddenValueToggle />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-xl border bg-card p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground sm:text-xs">{c.label}</p>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums sm:mt-2 sm:text-3xl">{c.valor}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FixoCard userId={userId} />
        </div>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Últimos lançamentos</h2>
            <Link href="/programacao" className="text-xs text-primary hover:underline">Ver todos</Link>
          </div>
          {recentes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento este mês.</p>
          ) : (
            <div className="space-y-2">
              {recentes.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 rounded-md border bg-card p-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{l.client_nome ?? "—"}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="rounded-full border bg-muted px-2 py-0.5 tabular-nums">{l.quantidade}× {l.tipo_label}</span>
                    <span className="tabular-nums">{formatarDataBR(l.data)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </HiddenValuesProvider>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run `npx tsc --noEmit && npx eslint src/components/dashboard/DashboardProgramacao.tsx`
Expected: sem erros. (`FixoCard`, `HiddenValuesProvider`, `HiddenValueToggle`, `getOrganizationId`, `listLancamentos`, `resumoLancamentos` já existem; ícones `Plus`/`Database`/`UserPlus`/`Boxes`/`Layers` são do lucide-react.)

- [ ] **Step 3: Commit**
```bash
git add src/components/dashboard/DashboardProgramacao.tsx
git commit -m "feat(dashboard): DashboardProgramacao (resumo do mês + últimos lançamentos + fixo)"
```

---

## Task 4: Wiring — page.tsx (dashboard) + página de clientes + menu

**Files:** Modify `src/app/(authed)/page.tsx`; Create `src/app/(authed)/programacao/clientes/page.tsx`; Modify `src/components/layout/nav-config.ts`.

- [ ] **Step 1: Caso do cargo no dashboard `page.tsx`**

Em `src/app/(authed)/page.tsx`:
- Adiciona o import (junto dos outros `Dashboard*`):
```ts
import { DashboardProgramacao } from "@/components/dashboard/DashboardProgramacao";
```
- Na função que despacha por cargo, adiciona ANTES da linha `return <StubGreeting nome={target.nome} />;`:
```tsx
  if (target.role === "programacao") {
    return <DashboardProgramacao userId={target.id} nome={target.nome} />;
  }
```

- [ ] **Step 2: Página `/programacao/clientes`**

Create `src/app/(authed)/programacao/clientes/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { canAccessProgramacao } from "@/lib/programacao/access";
import { listClientesComAssessor } from "@/lib/programacao/queries";

export const dynamic = "force-dynamic";

export default async function ProgramacaoClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAuth();
  if (!canAccessProgramacao(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const clientes = await listClientesComAssessor(orgId, q || null);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">Cliente e assessor responsável.</p>
      </header>

      <form className="max-w-sm">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar cliente…"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
      </form>

      {clientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Cliente</th>
                <th className="px-4 py-2.5 text-left font-medium">Assessor responsável</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2.5 font-medium">{c.nome}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.assessor_nome ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```
> A busca é um `<form>` GET simples (server component, sem JS): submeter recarrega `?q=…`.

- [ ] **Step 3: Item de menu em `nav-config.ts`**

Em `src/components/layout/nav-config.ts`, no grupo `id: "operacao"`, imediatamente APÓS a linha do `/programacao` (`{ type: "link", href: "/programacao", ... }`), adiciona:
```ts
      { type: "link", href: "/programacao/clientes", icon: Users, label: "Clientes", roles: ["programacao"], badgeKey: null },
```
> `Users` já está importado. `roles: ["programacao"]` — só a programadora vê (adm/sócio têm o `/clientes` real). O gate `role === "programacao"` mostra links cujo `roles` inclui `"programacao"`.

- [ ] **Step 4: Type-check + lint**

Run `npx tsc --noEmit && npx eslint "src/app/(authed)/page.tsx" "src/app/(authed)/programacao/clientes/page.tsx" src/components/layout/nav-config.ts`
Expected: ZERO erros.

- [ ] **Step 5: Commit**
```bash
git add "src/app/(authed)/page.tsx" "src/app/(authed)/programacao/clientes/page.tsx" src/components/layout/nav-config.ts
git commit -m "feat(programacao): dashboard no roteador + página /programacao/clientes + menu"
```

---

## Task 5: PR

- [ ] **Step 1: Verificação final**

Run `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' src/lib/programacao/resumo.test.ts`
Expected: tsc limpo; teste verde.

- [ ] **Step 2: Push + PR**
```bash
git push -u origin feat/dashboard-programacao
gh pr create --base main --title "feat(programacao): dashboard da programadora + página de clientes/assessor" --body "$(cat <<'EOF'
## O que muda
- **Dashboard da programadora**: no lugar do "oi" vazio, um dashboard com **resumo do mês** (CRMs · Usuários · Sistemas · Total), **salário (FixoCard)**, **últimos lançamentos** e botão "Registrar" → /programacao.
- **Página `/programacao/clientes`** (item "Clientes" no menu dela): lista **cliente · assessor responsável**, com busca por nome, só-leitura (sem financeiro).

Reusa `listLancamentos`; cálculo puro testado. Sem migration.

Spec: `docs/superpowers/specs/2026-07-18-dashboard-programacao-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI verde → merge**

Espera `test` verde, então `gh pr merge --squash --delete-branch`.

---

## Notas de verificação manual (pós-deploy)

- Logada como programadora, a home mostra o dashboard (não o "oi" vazio).
- Resumo bate com os lançamentos do mês; "Ver todos"/"Registrar" levam pra /programacao.
- Menu tem "Clientes" → lista cliente + assessor; busca por nome funciona.

## Riscos / suposições

- Sem lançamentos/migration → dashboard mostra 0 e "nenhum lançamento" (não quebra).
- FK embed `clients_assessor_id_fkey` confirmado em `src/lib/clientes/queries.ts`.
- `resumo.ts` é puro (sem `server-only`) → seguro pra testar e pra qualquer import.
