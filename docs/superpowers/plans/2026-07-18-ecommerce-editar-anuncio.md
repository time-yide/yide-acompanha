# E-commerce editar lançamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar um lançamento de anúncios em `/ecommerce` (formulário pré-preenchido reaproveitado do "Novo lançamento") e consertar o bug que bloqueia o Felipe (assessor+especialidade ecommerce) de criar/editar/arquivar.

**Architecture:** Extrai um `AnuncioFormModal` compartilhado (fonte única de criar e editar); `NovoAnuncioButton` e a edição na `AnunciosList` passam a usá-lo; a `actions.ts` troca a checagem `podeLancar` (que ignora especialidade) por `canAccessEcommerce`.

**Tech Stack:** Next.js (App Router, Server Actions, client islands), TypeScript, vitest, Tailwind, lucide-react.

**Branch:** já criada — `feat/ecommerce-editar-anuncio` a partir de `origin/main` (main local vive atrás; código-alvo só existe em origin/main). Spec commitado. NÃO trocar de branch.

**Nota de testes:** o repo tem worktrees stale em `.claude/worktrees/` que o vitest globa (~148 falhas alheias). SEMPRE rodar com `--exclude '**/.claude/**'` e só o arquivo alvo. Nunca a suíte inteira.

---

## File Structure

- **Create** `src/components/ecommerce/AnuncioFormModal.tsx` — modal+form compartilhado (criar/editar).
- **Create** `src/lib/ecommerce/access.test.ts` — trava o caso Felipe em `canAccessEcommerce`.
- **Modify** `src/lib/ecommerce/actions.ts` — `podeLancar` → `canAccessEcommerce`.
- **Modify** `src/components/ecommerce/NovoAnuncioButton.tsx` — usa o modal compartilhado.
- **Modify** `src/components/ecommerce/AnunciosList.tsx` — prop `clientes` + botão editar + modal.
- **Modify** `src/app/(authed)/ecommerce/page.tsx` — passa `clientes` à lista.

---

## Task 1: Fix permissão Felipe (`actions.ts`) + teste `canAccessEcommerce`

**Files:**
- Modify: `src/lib/ecommerce/actions.ts`
- Test: `src/lib/ecommerce/access.test.ts`

- [ ] **Step 1: Escreve o teste que trava o caso Felipe**

Create `src/lib/ecommerce/access.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { canAccessEcommerce } from "./access";

describe("canAccessEcommerce", () => {
  it("cargos dedicados de e-commerce entram", () => {
    expect(canAccessEcommerce("assessor_ecommerce")).toBe(true);
    expect(canAccessEcommerce("assistente_ecommerce")).toBe(true);
    expect(canAccessEcommerce("adm")).toBe(true);
    expect(canAccessEcommerce("socio")).toBe(true);
  });
  it("assessor comum entra só com especialidade ecommerce (caso Felipe)", () => {
    expect(canAccessEcommerce("assessor", "ecommerce")).toBe(true);
    expect(canAccessEcommerce("assessor", null)).toBe(false);
    expect(canAccessEcommerce("assessor")).toBe(false);
  });
  it("outros cargos não entram", () => {
    expect(canAccessEcommerce("videomaker")).toBe(false);
  });
});
```

- [ ] **Step 2: Roda e confirma que passa (já existe a função)**

Run: `npx vitest run --exclude '**/.claude/**' src/lib/ecommerce/access.test.ts`
Expected: PASS — `canAccessEcommerce` já existe e cobre esses casos. (Se algum falhar, PARE e reporte — significaria que a função não trata o caso; não é esperado.)

- [ ] **Step 3: Troca `podeLancar` por `canAccessEcommerce` em `actions.ts`**

Em `src/lib/ecommerce/actions.ts`:

Adiciona ao bloco de imports (após o import de `./schema`):
```ts
import { canAccessEcommerce } from "./access";
```

Remove estas linhas (a lista e o helper que ignoravam a especialidade):
```ts
const ROLES_LANCAM = ["adm", "socio", "assessor_ecommerce", "assistente_ecommerce"] as const;
function podeLancar(role: string) {
  return (ROLES_LANCAM as readonly string[]).includes(role);
}
```

Substitui as TRÊS ocorrências de:
```ts
  if (!podeLancar(actor.role)) return { error: "Sem permissão" };
```
por:
```ts
  if (!canAccessEcommerce(actor.role, actor.especialidade)) return { error: "Sem permissão" };
```
(Uma em `criarAnuncioAction`, uma em `updateAnuncioAction`, uma em `arquivarAnuncioAction`.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros (`actor.especialidade` existe em `CurrentUser` de `requireAuth`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ecommerce/actions.ts src/lib/ecommerce/access.test.ts
git commit -m "fix(ecommerce): criar/editar/arquivar usa canAccessEcommerce (destrava assessor+especialidade) + teste"
```

---

## Task 2: `AnuncioFormModal` compartilhado

**Files:**
- Create: `src/components/ecommerce/AnuncioFormModal.tsx`

- [ ] **Step 1: Cria o componente**

Create `src/components/ecommerce/AnuncioFormModal.tsx`:

```tsx
"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MARKETPLACES, MARKETPLACE_LABELS } from "@/lib/ecommerce/marketplaces";

export interface AnuncioInitial {
  id?: string;
  client_id?: string;
  data?: string; // YYYY-MM-DD
  quantidade?: number;
  marketplace?: string;
  observacao?: string | null;
}

interface Props {
  clientes: { id: string; nome: string }[];
  titulo: string;
  initial?: AnuncioInitial;
  action: (fd: FormData) => Promise<{ success: true } | { error: string }>;
  onClose: () => void;
  onDone: () => void;
}

export function AnuncioFormModal({ clientes, titulo, initial, action, onClose, onDone }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hoje = new Date().toISOString().slice(0, 10);

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await action(formData);
      if ("error" in r) { setError(r.error); return; }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <form
        action={submit}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anuncio-form-titulo"
        className="w-full max-w-md space-y-3 rounded-xl border bg-card p-5"
      >
        <h2 id="anuncio-form-titulo" className="font-semibold">{titulo}</h2>
        {initial?.id && <input type="hidden" name="id" value={initial.id} />}

        <div className="space-y-1.5">
          <Label htmlFor="client_id">Cliente (e-commerce)</Label>
          <select
            id="client_id"
            name="client_id"
            required
            defaultValue={initial?.client_id ?? ""}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione…</option>
            {clientes.map((c) => (<option key={c.id} value={c.id}>{c.nome}</option>))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="quantidade">Quantidade</Label>
            <Input id="quantidade" name="quantidade" type="number" min={1} required defaultValue={initial?.quantidade ?? 1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="data">Data</Label>
            <Input id="data" name="data" type="date" required defaultValue={initial?.data ?? hoje} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="marketplace">Marketplace</Label>
          <select
            id="marketplace"
            name="marketplace"
            required
            defaultValue={initial?.marketplace ?? MARKETPLACES[0]}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {MARKETPLACES.map((m) => (<option key={m} value={m}>{MARKETPLACE_LABELS[m]}</option>))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="observacao">Observação (opcional)</Label>
          <Textarea id="observacao" name="observacao" rows={2} maxLength={2000} defaultValue={initial?.observacao ?? ""} />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar"}</Button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/components/ecommerce/AnuncioFormModal.tsx`
Expected: sem erros. (Imports `@/components/ui/button|input|label|textarea` já existem — o `NovoAnuncioButton` atual usa todos.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ecommerce/AnuncioFormModal.tsx
git commit -m "feat(ecommerce): AnuncioFormModal — form compartilhado de criar/editar lançamento"
```

---

## Task 3: `NovoAnuncioButton` usa o modal compartilhado

**Files:**
- Modify: `src/components/ecommerce/NovoAnuncioButton.tsx`

- [ ] **Step 1: Substitui o conteúdo do arquivo**

Replace the ENTIRE contents of `src/components/ecommerce/NovoAnuncioButton.tsx` with:

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { criarAnuncioAction } from "@/lib/ecommerce/actions";
import { AnuncioFormModal } from "./AnuncioFormModal";

interface Props {
  clientes: { id: string; nome: string }[];
}

export function NovoAnuncioButton({ clientes }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const semClientes = clientes.length === 0;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={semClientes}>
        <Plus className="h-4 w-4" /> Novo lançamento
      </Button>
      {open && (
        <AnuncioFormModal
          clientes={clientes}
          titulo="Novo lançamento de anúncios"
          action={criarAnuncioAction}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); router.refresh(); }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/components/ecommerce/NovoAnuncioButton.tsx`
Expected: sem erros; sem imports órfãos (Input/Label/Textarea/MARKETPLACES saíram).

- [ ] **Step 3: Commit**

```bash
git add src/components/ecommerce/NovoAnuncioButton.tsx
git commit -m "refactor(ecommerce): NovoAnuncioButton usa AnuncioFormModal"
```

---

## Task 4: Botão editar na `AnunciosList`

**Files:**
- Modify: `src/components/ecommerce/AnunciosList.tsx`

- [ ] **Step 1: Substitui o conteúdo do arquivo**

Replace the ENTIRE contents of `src/components/ecommerce/AnunciosList.tsx` with:

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { arquivarAnuncioAction, updateAnuncioAction } from "@/lib/ecommerce/actions";
import { formatarDataBR } from "@/lib/ecommerce/format";
import { marketplaceLabel } from "@/lib/ecommerce/marketplaces";
import type { AnuncioRow } from "@/lib/ecommerce/queries";
import { AnuncioFormModal } from "./AnuncioFormModal";

interface Props {
  anuncios: AnuncioRow[];
  clientes: { id: string; nome: string }[];
  mostrarAssessor: boolean;
  podeArquivar: boolean;
}

export function AnunciosList({ anuncios, clientes, mostrarAssessor, podeArquivar }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editando, setEditando] = useState<AnuncioRow | null>(null);

  function arquivar(id: string) {
    if (!confirm("Arquivar este lançamento?")) return;
    start(async () => {
      const fd = new FormData();
      fd.set("id", id);
      const r = await arquivarAnuncioAction(fd);
      if ("error" in r) { alert(r.error); return; }
      router.refresh();
    });
  }

  if (anuncios.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum lançamento no período.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {anuncios.map((a) => (
        <div
          key={a.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-card p-3"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold truncate">
              {a.client_nome ?? "—"}
              <span className="ml-2 rounded-full border bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                {a.quantidade} {a.quantidade === 1 ? "anúncio" : "anúncios"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {formatarDataBR(a.data)} &middot; {marketplaceLabel(a.marketplace)}
              {mostrarAssessor && a.colaborador_nome ? (
                <span> &middot; {a.colaborador_nome}</span>
              ) : null}
            </p>
            {a.observacao ? (
              <p className="text-xs text-muted-foreground">{a.observacao}</p>
            ) : null}
          </div>
          {podeArquivar && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setEditando(a)}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={pending}
                onClick={() => arquivar(a.id)}
                aria-label="Arquivar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      ))}

      {editando && (
        <AnuncioFormModal
          clientes={clientes}
          titulo="Editar lançamento"
          initial={{
            id: editando.id,
            client_id: editando.client_id,
            data: editando.data,
            quantidade: editando.quantidade,
            marketplace: editando.marketplace,
            observacao: editando.observacao,
          }}
          action={updateAnuncioAction}
          onClose={() => setEditando(null)}
          onDone={() => { setEditando(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/components/ecommerce/AnunciosList.tsx`
Expected: sem erros. (`AnuncioRow` tem `client_id`, `data`, `quantidade`, `marketplace`, `observacao` — confirmado em `queries.ts`.) Vai acusar `page.tsx` só porque ainda não passa `clientes` — corrigido na Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/components/ecommerce/AnunciosList.tsx
git commit -m "feat(ecommerce): editar lançamento na lista (lápis abre AnuncioFormModal)"
```

---

## Task 5: `page.tsx` passa `clientes` à lista

**Files:**
- Modify: `src/app/(authed)/ecommerce/page.tsx`

- [ ] **Step 1: Passa a prop `clientes`**

Em `src/app/(authed)/ecommerce/page.tsx`, encontra:
```tsx
        <AnunciosList
          anuncios={anuncios}
          mostrarAssessor={chefia}
          podeArquivar={true}
        />
```
e troca por:
```tsx
        <AnunciosList
          anuncios={anuncios}
          clientes={clientes}
          mostrarAssessor={chefia}
          podeArquivar={true}
        />
```
(`clientes` já existe no escopo — vem de `listClientesEcommerce(orgId)` no `Promise.all`.)

- [ ] **Step 2: Type-check + lint (deve ficar tudo limpo agora)**

Run: `npx tsc --noEmit && npx eslint "src/app/(authed)/ecommerce/page.tsx"`
Expected: ZERO erros em todo o projeto.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authed)/ecommerce/page.tsx"
git commit -m "feat(ecommerce): passa clientes pra AnunciosList (habilita edição)"
```

---

## Task 6: PR

**Files:** nenhum.

- [ ] **Step 1: Verificação final**

Run: `npx tsc --noEmit && npx vitest run --exclude '**/.claude/**' src/lib/ecommerce/access.test.ts`
Expected: tsc limpo; teste verde.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/ecommerce-editar-anuncio
gh pr create --base main --title "feat(ecommerce): editar lançamento de anúncios + fix permissão (assessor e-commerce)" --body "$(cat <<'EOF'
## O que muda
- **Editar lançamento**: a lista de `/ecommerce` ganha um lápis por linha que abre o formulário pré-preenchido (cliente, quantidade, data, marketplace, observação) e salva via `updateAnuncioAction`.
- **Form compartilhado** `AnuncioFormModal`: fonte única de criar e editar (o `NovoAnuncioButton` passou a usá-lo) — sem duplicar/drift.
- **Fix permissão**: criar/editar/arquivar agora usa `canAccessEcommerce(role, especialidade)` em vez da lista de cargos que ignorava a especialidade. Desbloqueia o assessor comum com especialidade e-commerce (ex.: Felipe). Teste trava o caso.

Escopo já é seguro: `listAnuncios` filtra por colaborador pra quem não é chefia, então cada um só edita o que vê; o server reforça.

Sem migration.

Spec: `docs/superpowers/specs/2026-07-18-ecommerce-editar-anuncio-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI verde → merge**

Espera o check `test` verde, então `gh pr merge --squash --delete-branch`.

---

## Notas de verificação manual (pós-deploy)

- Kayke/Felipe: clicar no lápis abre o form preenchido; salvar altera a linha.
- Felipe (assessor+ecommerce) consegue criar, editar e arquivar (não mais "Sem permissão").
- Assessor só vê/edita os próprios; chefia edita todos.

## Riscos / suposições

- `AnuncioRow` expõe todos os campos do form (confirmado). O `data` é "YYYY-MM-DD" (compatível com `<input type=date>`).
- Extrair `AnuncioFormModal` altera o `NovoAnuncioButton` (funcionalidade idêntica) — evita duplicar 5 campos que iam divergir.
