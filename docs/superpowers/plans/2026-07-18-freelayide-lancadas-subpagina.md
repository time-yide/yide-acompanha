# FreelaYide — Subpágina "Todas lançadas" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover a seção "Todas lançadas" da página principal do FreelaYide pra uma subpágina `/freela-yide/lancadas`, deixando só um botão de acesso na principal.

**Architecture:** Extrair as listas de papéis pra `acesso.ts` (DRY); criar a rota nova reusando `ResumoSubidos`/`OportunidadesGrid`; enxugar a página principal. Sem migration, sem query nova.

**Tech Stack:** Next.js App Router (Server Components), Tailwind, lucide-react, next/link.

**Spec:** `docs/superpowers/specs/2026-07-18-freelayide-lancadas-subpagina-design.md`

---

## Convenções

- Não há teste unitário aqui (mudança de rota/layout, sem lógica pura nova). Verificação por `tsc` + `eslint`.
- Papéis atuais (hoje inline em `page.tsx`):
  - ALLOWED = `["adm", "socio", "comercial", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"]`
  - GESTAO = `["adm", "socio"]`
  - PODE_CRIAR = `["adm", "socio", "audiovisual_chefe", "assessor"]`

---

### Task 1: Extrair papéis pra módulo compartilhado

**Files:**
- Create: `src/lib/freela-yide/acesso.ts`
- Modify: `src/app/(authed)/freela-yide/page.tsx`

- [ ] **Step 1: Criar `acesso.ts`**

Create `src/lib/freela-yide/acesso.ts`:

```ts
// src/lib/freela-yide/acesso.ts
// Listas de papéis com acesso ao FreelaYide. Compartilhadas entre a página
// principal e a subpágina de lançadas.

export const ROLES_ALLOWED = [
  "adm", "socio", "comercial", "coordenador", "assessor",
  "designer", "videomaker", "editor", "audiovisual_chefe",
];

export const ROLES_GESTAO = ["adm", "socio"];

// Quem pode subir/criar freela: gestão + coordenador audiovisual + assessor.
export const ROLES_PODE_CRIAR = ["adm", "socio", "audiovisual_chefe", "assessor"];
```

- [ ] **Step 2: Usar os imports na página principal**

In `src/app/(authed)/freela-yide/page.tsx`, add to the imports (after the `DefinirMetaButton` import line):

```tsx
import { ROLES_ALLOWED, ROLES_GESTAO, ROLES_PODE_CRIAR } from "@/lib/freela-yide/acesso";
```

Then delete these three inline `const` lines:

```tsx
const ALLOWED = ["adm", "socio", "comercial", "coordenador", "assessor", "designer", "videomaker", "editor", "audiovisual_chefe"];
const GESTAO = ["adm", "socio"];
// Quem pode subir/criar freela: gestão + coordenador audiovisual + assessor.
const PODE_CRIAR = ["adm", "socio", "audiovisual_chefe", "assessor"];
```

And update their three usages inside the function:

- `if (!ALLOWED.includes(user.role)) notFound();` → `if (!ROLES_ALLOWED.includes(user.role)) notFound();`
- `const gestao = GESTAO.includes(user.role);` → `const gestao = ROLES_GESTAO.includes(user.role);`
- `const podeCriar = PODE_CRIAR.includes(user.role);` → `const podeCriar = ROLES_PODE_CRIAR.includes(user.role);`

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros (refactor puro, comportamento idêntico).

- [ ] **Step 4: Commit**

```bash
git add src/lib/freela-yide/acesso.ts "src/app/(authed)/freela-yide/page.tsx"
git commit -m "refactor(freela): extrai listas de papéis pra acesso.ts"
```

---

### Task 2: Criar a subpágina `/freela-yide/lancadas`

**Files:**
- Create: `src/app/(authed)/freela-yide/lancadas/page.tsx`

- [ ] **Step 1: Criar a rota**

Create `src/app/(authed)/freela-yide/lancadas/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId, listOportunidades } from "@/lib/freela-yide/queries";
import { ResumoSubidos } from "@/components/freela-yide/ResumoSubidos";
import { OportunidadesGrid } from "@/components/freela-yide/OportunidadesGrid";
import { ROLES_ALLOWED, ROLES_GESTAO, ROLES_PODE_CRIAR } from "@/lib/freela-yide/acesso";

export default async function LancadasPage() {
  const user = await requireAuth();
  if (!ROLES_ALLOWED.includes(user.role) || !ROLES_PODE_CRIAR.includes(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();

  const gestao = ROLES_GESTAO.includes(user.role);
  const podePegar = user.role !== "adm"; // adm não pega freela
  const todasLancadas = await listOportunidades(orgId, false);

  return (
    <div className="space-y-6">
      <Link href="/freela-yide" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Todas lançadas</h1>
        <p className="text-sm text-muted-foreground">Todas as oportunidades já lançadas, com status e resumo.</p>
      </div>
      <ResumoSubidos ops={todasLancadas} />
      <OportunidadesGrid ops={todasLancadas} gestao={gestao} podePegar={podePegar} />
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authed)/freela-yide/lancadas/page.tsx"
git commit -m "feat(freela): subpágina /freela-yide/lancadas"
```

---

### Task 3: Enxugar a página principal + botão de acesso

**Files:**
- Modify: `src/app/(authed)/freela-yide/page.tsx`

- [ ] **Step 1: Adicionar imports do Link e do ícone**

In `src/app/(authed)/freela-yide/page.tsx`, add after the `import { notFound } from "next/navigation";` line:

```tsx
import Link from "next/link";
import { ArrowRight } from "lucide-react";
```

- [ ] **Step 2: Remover `ResumoSubidos` do import**

`ResumoSubidos` deixa de ser usado na principal. Remove this import line:

```tsx
import { ResumoSubidos } from "@/components/freela-yide/ResumoSubidos";
```

- [ ] **Step 3: Remover `todasLancadas` do carregamento**

Replace this block:

```tsx
  const [todas, minhas, todasLancadas, ranking, historico, meta, stats] = await Promise.all([
    listOportunidades(orgId, true),
    listMinhas(orgId, user.id),
    podeCriar ? listOportunidades(orgId, false) : Promise.resolve([]),
    getRanking(orgId),
    getHistorico(orgId),
    getMetaAtual(orgId),
    getStats(orgId, user.id),
  ]);
```

with:

```tsx
  const [todas, minhas, ranking, historico, meta, stats] = await Promise.all([
    listOportunidades(orgId, true),
    listMinhas(orgId, user.id),
    getRanking(orgId),
    getHistorico(orgId),
    getMetaAtual(orgId),
    getStats(orgId, user.id),
  ]);
```

- [ ] **Step 4: Botão "Todas lançadas →" ao lado do "Nova oportunidade"**

Replace this block:

```tsx
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Oportunidades disponíveis</h2>
              {podeCriar && <NovaOportunidadeButton />}
            </div>
            <OportunidadesGrid ops={todas} gestao={gestao} podePegar={podePegar} />
          </section>
```

with:

```tsx
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Oportunidades disponíveis</h2>
              {podeCriar && (
                <div className="flex items-center gap-2">
                  <Link href="/freela-yide/lancadas" className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground">
                    Todas lançadas <ArrowRight className="h-4 w-4" />
                  </Link>
                  <NovaOportunidadeButton />
                </div>
              )}
            </div>
            <OportunidadesGrid ops={todas} gestao={gestao} podePegar={podePegar} />
          </section>
```

- [ ] **Step 5: Remover a seção "Todas lançadas"**

Delete this entire block:

```tsx
          {podeCriar && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Todas lançadas</h2>
              <ResumoSubidos ops={todasLancadas} />
              <OportunidadesGrid ops={todasLancadas} gestao={gestao} podePegar={podePegar} />
            </section>
          )}
```

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Não pode sobrar referência a `todasLancadas` nem a `ResumoSubidos` no arquivo.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(authed)/freela-yide/page.tsx"
git commit -m "feat(freela): remove seção lançadas da principal, adiciona botão pra subpágina"
```

---

### Task 4: Verificação final

**Files:** nenhum.

- [ ] **Step 1: Lint**

Run: `npx eslint "src/app/(authed)/freela-yide/page.tsx" "src/app/(authed)/freela-yide/lancadas/page.tsx" src/lib/freela-yide/acesso.ts`
Expected: sem erros.

- [ ] **Step 2: Confirmar que a principal não referencia mais o que foi movido**

Run: `grep -nE "todasLancadas|ResumoSubidos" "src/app/(authed)/freela-yide/page.tsx"`
Expected: nenhuma linha (grep sem saída).

- [ ] **Step 3: Type-check completo**

Run: `npx tsc --noEmit`
Expected: sem erros.

---

## Self-review (feito na escrita do plano)

- **Cobertura do spec:** rota nova (Task 2), acesso só PODE_CRIAR (Task 2), remoção da seção + botão (Task 3), DRY dos papéis (Task 1). ✔
- **Sem placeholders:** todo passo tem código/comando/expected concretos. ✔
- **Consistência:** `ROLES_ALLOWED/GESTAO/PODE_CRIAR` definidos na Task 1 e usados nas Tasks 1-2; `todasLancadas`/`ResumoSubidos` removidos juntos na Task 3 (import + uso), grep na Task 4 garante. ✔
- **Sem migration / query nova:** reusa `listOportunidades(orgId, false)`. ✔
