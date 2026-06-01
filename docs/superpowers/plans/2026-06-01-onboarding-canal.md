# Onboarding por canal (Ligação / Rua) — Implementation Plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Separar o onboarding por **canal** (`ligacao`/`rua`) sem duplicar board: um campo `canal` no lead, o board filtra por canal, criar-lead escolhe o canal, e o menu tem "Onboarding Ligação" (Comercial Ligação) + "Onboarding Rua" (Comercial Rua).

**Architecture:** Migration adiciona `leads.canal`. `listLeadsByStage(unitProfileIds, canal?)` filtra (canal entra na cache key do `unstable_cache` — bump pra v3). Página `/onboarding` lê `?canal=`. Form de criar lead ganha campo `canal`. Nav: renomeia + adiciona item.

**Tech Stack:** Next.js (customizado — `unstable_cache`/`revalidateTag`, conferir `node_modules/next/dist/docs/`), TS, Zod, Supabase, Vitest. Migration manual pós-merge — **aplicar antes do deploy** (a query passa a ler `canal`).

**LER antes:** `src/lib/leads/{queries,schema,actions}.ts`, `src/app/(authed)/onboarding/{page,novo/page}.tsx`, o form de criar lead (provavelmente `src/components/onboarding/...`), `src/components/layout/nav-config.ts`.

---

## Task 1: Migration + leads layer (canal)

**Files:** Create `supabase/migrations/20260623000000_leads_canal.sql`; Modify `src/lib/leads/queries.ts`, `src/lib/leads/schema.ts`, `src/lib/leads/actions.ts`. Test: `tests/unit/leads-canal-schema.test.ts`.

- [ ] **Step 1: Migration**
```sql
-- supabase/migrations/20260623000000_leads_canal.sql
-- Canal de aquisição do lead pro onboarding (Comercial Ligação vs Rua).
alter table public.leads
  add column if not exists canal text not null default 'ligacao'
    check (canal in ('ligacao','rua'));
create index if not exists leads_canal_idx on public.leads(canal);
```

- [ ] **Step 2: schema canal (TDD)**
`tests/unit/leads-canal-schema.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { createLeadSchema } from "@/lib/leads/schema";
describe("createLeadSchema canal", () => {
  it("default ligacao quando ausente", () => {
    const r = createLeadSchema.safeParse({ nome_prospect: "Padaria X" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.canal).toBe("ligacao");
  });
  it("aceita rua", () => {
    const r = createLeadSchema.safeParse({ nome_prospect: "Padaria X", canal: "rua" });
    expect(r.success && r.data.canal).toBe("rua");
  });
  it("rejeita canal inválido", () => {
    expect(createLeadSchema.safeParse({ nome_prospect: "X", canal: "email" }).success).toBe(false);
  });
});
```
Run → FAIL.
Em `src/lib/leads/schema.ts`, dentro de `createLeadSchema`, adicionar: `canal: z.enum(["ligacao","rua"]).default("ligacao"),`. Run → PASS.

- [ ] **Step 3: queries — filtro por canal + cache key**
Em `src/lib/leads/queries.ts`:
- `LeadRow` ganha `canal: string;` (e adicionar `canal` ao `.select(...)` da impl).
- `_listLeadsByStageImpl(ids, canal?)`: receber `canal?: "ligacao" | "rua"`; quando definido, `.eq("canal", canal)` na query.
- `listLeadsByStage(unitProfileIds, canal?)`: passar canal pro cached. Como o `unstable_cache` varia pelos ARGUMENTOS, incluir canal no JSON do arg: `cached(JSON.stringify({ ids: unitProfileIds, canal: canal ?? null }))`, e a função interna faz `JSON.parse` e chama `_listLeadsByStageImpl(ids, canal ?? undefined)`. **Bumpar a key estática** `["leads-by-stage-v2"]` → `["leads-by-stage-v3"]` (mudou o shape do arg).

- [ ] **Step 4: actions — inserir canal**
Em `src/lib/leads/actions.ts`, no createLeadAction (ler o arquivo), ler `canal` do formData e incluir no insert (o schema já valida/default). Garantir que o parse usa `createLeadSchema` (canal entra junto).

- [ ] **Step 5: tsc + lint + testes**
`npx tsc --noEmit 2>&1 | grep -iE "leads/" || echo clean` ; `npx next lint 2>&1 | grep -iE "leads/" || echo "lint clean"` ; `npx vitest run tests/unit/leads-canal-schema.test.ts`

- [ ] **Step 6: commit**
```bash
git add supabase/migrations/20260623000000_leads_canal.sql src/lib/leads/ tests/unit/leads-canal-schema.test.ts
git commit -m "feat(onboarding): campo canal (ligacao/rua) + filtro no board

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Página filtra por canal + form de criar

**Files:** Modify `src/app/(authed)/onboarding/page.tsx`, `src/app/(authed)/onboarding/novo/page.tsx` + o form de criar lead.

- [ ] **Step 1: `/onboarding/page.tsx` lê `?canal=`**
Adicionar `searchParams: Promise<{ canal?: string }>` à assinatura; `const { canal: canalRaw } = await searchParams; const canal = canalRaw === "rua" || canalRaw === "ligacao" ? canalRaw : undefined;`. Passar `listLeadsByStage(unitProfileIds, canal)`. No header, mostrar o canal: ex. título "Onboarding" + um sub-rótulo "Canal: Rua/Ligação" quando `canal` definido (sem canal = "Todos"). Manter o resto (tabs, botões). O botão "Novo" deve preservar o canal: link `/onboarding/novo${canal ? \`?canal=${canal}\` : ""}`.

- [ ] **Step 2: `/onboarding/novo` + form com canal**
Ler `src/app/(authed)/onboarding/novo/page.tsx` e o componente de form. Adicionar um campo **Canal** (select Ligação/Rua) no form de criar lead, default = `?canal=` da URL (ou ligacao). Enviar `canal` no FormData pro `createLeadAction`. (Se o novo/page passa um default pro form, propagar o canal da query.)

- [ ] **Step 3: tsc + lint + build**
`npx tsc --noEmit 2>&1 | grep -iE "onboarding|leads/" | grep -v web-push || echo clean` ; `npx next lint 2>&1 | grep -iE "onboarding|leads" || echo "lint clean"` ; `npx next build 2>&1 | tail -15` (deps ausentes do worktree ok).

- [ ] **Step 4: commit**
```bash
git add "src/app/(authed)/onboarding/" src/components/onboarding/ 2>/dev/null
git commit -m "feat(onboarding): board filtra por canal + criar lead escolhe canal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Menu — Onboarding Ligação / Onboarding Rua

**Files:** Modify `src/components/layout/nav-config.ts`.

- [ ] **Step 1:** No grupo `comercial-ligacao`, o item Onboarding (`href: "/onboarding"`, label "Onboarding") vira: `href: "/onboarding?canal=ligacao"`, label **"Onboarding Ligação"**. No grupo `comercial-rua`, adicionar (depois de Visitas) um item: `{ type: "link", href: "/onboarding?canal=rua", icon: KanbanSquare, label: "Onboarding Rua", roles: ["adm","socio","comercial","assessor","coordenador","audiovisual_chefe"], badgeKey: null }`. (`KanbanSquare` já está importado.)
- [ ] **Step 2:** tsc/lint. Commit:
```bash
git add src/components/layout/nav-config.ts
git commit -m "feat(menu): Onboarding Ligação (Comercial Ligação) + Onboarding Rua (Comercial Rua)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final + PR
- [ ] tsc/lint/vitest verdes. push + PR. Corpo: migration `20260623000000_leads_canal.sql` (aplicar **antes do deploy** — a query passa a ler `canal`); descreve canal/filtro/menu.

## Notas
- **Cache key bumpada** (v3) porque o arg do `unstable_cache` mudou (inclui canal) — convenção do projeto.
- Sem `?canal=` → board mostra **todos** (compatível com quem acessa /onboarding direto).
- O `canal` da tabela `leads` é diferente do `canal` de `lead_attempts` (outra tabela).
- Aplicar a migration logo após o merge pra o board não quebrar (lê `canal`).
