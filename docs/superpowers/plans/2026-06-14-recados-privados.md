# Recados Privados (direcionados) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir recados privados direcionados a 1+ pessoas, visíveis só ao autor + destinatários + sócio (auditoria), com aba "Privados", notificação e bolinha pros destinatários.

**Architecture:** Reusa a tabela `recados` com uma coluna `privado` + tabela `recado_destinatarios`. Leitura via service-role (fura RLS) com filtro de visibilidade no código; RLS apertada como defesa em profundidade usando funções `security definer` pra evitar recursão. A bolinha do menu soma "mural não lido" + "privados não lidos pra mim".

**Tech Stack:** Next.js 16 (App Router, server actions, `unstable_cache`), Supabase (Postgres + RLS), Zod, Vitest, Tailwind/shadcn-style UI.

**Branch:** `feat/recados-privados` (já criada a partir de `origin/main`).

**Pré-requisitos de leitura (já mapeados, mas confirme se editar fora de ordem):**
- `src/lib/recados/queries.ts` — `listRecados(arquivado, unitProfileIds)` (cache `recados-list-v2`), `countRecadosNaoLidos(userId, unitProfileIds)` (cache `recados-count-nao-lidos-v2`), `RecadoRow`.
- `src/lib/recados/actions.ts` — `criarRecadoAction`, `resolveRecipientIds`, `dispatchNotification`, `isPrivileged`.
- `src/lib/recados/schema.ts` — `criarRecadoSchema`.
- `src/app/(authed)/recados/page.tsx` — abas `ativos | arquivados`.
- `src/components/recados/{NovoRecadoDialog,RecadoCard,RecadoFeed}.tsx`.
- `src/lib/escritorio/queries.ts` — `listMentionables(unitProfileIds)` retorna `{id, nome, role}[]` ativos na unidade (reusar pro seletor de pessoas).
- `dispatchNotification` args: `{ evento_tipo, titulo, mensagem, link?, user_ids_extras?, source_user_id? }`. Evento `recado_novo` já existe (migration `...23`).

---

## File Structure

**Criar:**
- `supabase/migrations/20260614000000_recados_privados.sql` — coluna `privado`, tabela `recado_destinatarios`, RLS, funções `security definer`.
- `src/lib/recados/privados.ts` — tipos `PrivadoRow`/`PrivadoDestinatario` + helpers puros de visibilidade/label (testáveis).
- `src/components/recados/PrivadoFeed.tsx` — render dos privados (com split "meus" vs "auditoria" pro sócio).
- `tests/unit/recados-privados.test.ts` — testes dos helpers puros.

**Modificar:**
- `src/lib/recados/schema.ts` — `criarRecadoSchema` ganha `privado` + `destinatarios`.
- `src/lib/recados/queries.ts` — `listRecados` filtra `privado=false`; novas `listPrivados` e `countPrivadosNaoLidos`; `countRecadosNaoLidos` soma privados + defensivo; bump cache keys.
- `src/lib/recados/actions.ts` — `criarRecadoAction` trata privado; nova `marcarPrivadosLidosAction`.
- `src/components/recados/NovoRecadoDialog.tsx` — toggle privado + seletor de pessoas.
- `src/components/recados/RecadoCard.tsx` — linha opcional "para: X".
- `src/app/(authed)/recados/page.tsx` — 3ª aba "Privados", busca privados, marca lido, passa pessoas ao dialog.
- `src/types/database.ts` — tipos da coluna + tabela novas.

**Sem mudança:** `(authed)/layout.tsx` — a bolinha já vem de `countRecadosNaoLidos`, que vamos somar internamente.

---

## Task 1: Migration (schema + RLS)

**Files:**
- Create: `supabase/migrations/20260614000000_recados_privados.sql`

- [ ] **Step 1: Escrever a migration completa**

```sql
-- supabase/migrations/20260614000000_recados_privados.sql
-- Recados privados (direcionados): coluna privado + tabela de destinatarios + RLS.

-- 1) Coluna privado em recados
alter table public.recados
  add column if not exists privado boolean not null default false;

create index if not exists idx_recados_privado
  on public.recados (privado, arquivado, criado_em desc);

-- 2) Destinatarios
create table if not exists public.recado_destinatarios (
  recado_id uuid not null references public.recados(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  lido_em   timestamptz null,
  criado_em timestamptz not null default now(),
  primary key (recado_id, user_id)
);

create index if not exists idx_recado_dest_user
  on public.recado_destinatarios (user_id, lido_em);
create index if not exists idx_recado_dest_recado
  on public.recado_destinatarios (recado_id);

-- 3) Funcoes security definer para quebrar recursao de RLS entre
--    recados <-> recado_destinatarios.
create or replace function public.recado_is_destinatario(p_recado uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recado_destinatarios d
    where d.recado_id = p_recado and d.user_id = p_user
  );
$$;

create or replace function public.recado_autor_is(p_recado uuid, p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.recados r
    where r.id = p_recado and r.autor_id = p_user
  );
$$;

grant execute on function public.recado_is_destinatario(uuid, uuid) to authenticated;
grant execute on function public.recado_autor_is(uuid, uuid) to authenticated;

-- 4) RLS recados: aperta SELECT (era using(true))
drop policy if exists "recados select all authenticated" on public.recados;

create policy "recados select visible"
  on public.recados for select to authenticated
  using (
    privado = false
    or autor_id = auth.uid()
    or public.current_user_role() = 'socio'
    or public.recado_is_destinatario(id, auth.uid())
  );

-- 5) RLS recado_destinatarios
alter table public.recado_destinatarios enable row level security;

create policy "recado_dest select visible"
  on public.recado_destinatarios for select to authenticated
  using (
    user_id = auth.uid()
    or public.current_user_role() = 'socio'
    or public.recado_autor_is(recado_id, auth.uid())
  );

create policy "recado_dest insert by author"
  on public.recado_destinatarios for insert to authenticated
  with check (public.recado_autor_is(recado_id, auth.uid()));

create policy "recado_dest update own lido"
  on public.recado_destinatarios for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "recado_dest delete by author"
  on public.recado_destinatarios for delete to authenticated
  using (public.recado_autor_is(recado_id, auth.uid()));
```

- [ ] **Step 2: Conferir sintaxe lendo o arquivo**

Releia o arquivo inteiro. Confirme: `privado` tem default `false` (additivo, retrocompatível); as duas funções são `security definer`; a policy nova de SELECT cobre os 4 casos (mural / autor / socio / destinatario).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260614000000_recados_privados.sql
git commit -m "feat(recados): migration de recados privados (coluna + tabela + RLS)"
```

> **NÃO aplicar ainda em prod.** Ordem de deploy está na seção final ("Notas de deploy"): por ser additivo/retrocompatível, aplica-se a migration ANTES do merge pra eliminar a janela deploy→migration.

---

## Task 2: Schema (Zod)

**Files:**
- Modify: `src/lib/recados/schema.ts`
- Test: `tests/unit/recados-schema.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Acrescente ao fim de `tests/unit/recados-schema.test.ts` (mantém os imports/describe existentes; se o arquivo não importa `criarRecadoSchema`, adicione o import):

```ts
import { criarRecadoSchema } from "@/lib/recados/schema";

describe("criarRecadoSchema — privado", () => {
  const base = { titulo: "oi", corpo: "corpo", notif_scope: "nenhum" as const };

  it("privado exige ao menos 1 destinatario", () => {
    const r = criarRecadoSchema.safeParse({ ...base, privado: true, destinatarios: [] });
    expect(r.success).toBe(false);
  });

  it("privado com 1 destinatario passa", () => {
    const r = criarRecadoSchema.safeParse({
      ...base,
      privado: true,
      destinatarios: ["11111111-1111-1111-1111-111111111111"],
    });
    expect(r.success).toBe(true);
  });

  it("nao privado nao precisa de destinatarios", () => {
    const r = criarRecadoSchema.safeParse({ ...base, privado: false });
    expect(r.success).toBe(true);
  });

  it("rejeita destinatario que nao e uuid", () => {
    const r = criarRecadoSchema.safeParse({ ...base, privado: true, destinatarios: ["abc"] });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- recados-schema`
Expected: FAIL (schema ainda não tem `privado`/`destinatarios`).

- [ ] **Step 3: Implementar no schema**

Em `src/lib/recados/schema.ts`, substitua o `criarRecadoSchema` por:

```ts
export const criarRecadoSchema = z
  .object({
    titulo: z.string().min(1, "Título obrigatório").max(120, "Título muito longo"),
    corpo: z.string().min(1, "Corpo obrigatório").max(2000, "Corpo muito longo"),
    notif_scope: z.enum(NOTIF_SCOPES),
    permanente: z.boolean().default(false),
    privado: z.boolean().default(false),
    destinatarios: z.array(z.string().uuid("Destinatário inválido")).default([]),
  })
  .refine((d) => !d.privado || d.destinatarios.length >= 1, {
    message: "Selecione ao menos um destinatário",
    path: ["destinatarios"],
  });
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- recados-schema`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recados/schema.ts tests/unit/recados-schema.test.ts
git commit -m "feat(recados): schema aceita privado + destinatarios"
```

---

## Task 3: Helpers puros de privados

**Files:**
- Create: `src/lib/recados/privados.ts`
- Test: `tests/unit/recados-privados.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/unit/recados-privados.test.ts
import { describe, it, expect } from "vitest";
import {
  canSeePrivado,
  filterPrivadosForUser,
  isAuditoriaSomente,
  destinatariosLabel,
  meuLidoEm,
  type PrivadoRow,
} from "@/lib/recados/privados";

function row(over: Partial<PrivadoRow>): PrivadoRow {
  return {
    id: "r1",
    autor_id: "autor",
    autor_role_snapshot: "assessor",
    titulo: "t",
    corpo: "c",
    permanente: false,
    arquivado: false,
    notif_scope: "nenhum",
    privado: true,
    criado_em: "2026-06-14T00:00:00Z",
    atualizado_em: "2026-06-14T00:00:00Z",
    autor: { nome: "Autor", avatar_url: null },
    reacoes: [],
    destinatarios: [],
    ...over,
  };
}

describe("canSeePrivado", () => {
  it("socio ve qualquer privado", () => {
    expect(canSeePrivado(row({}), "estranho", "socio")).toBe(true);
  });
  it("autor ve o proprio", () => {
    expect(canSeePrivado(row({ autor_id: "eu" }), "eu", "assessor")).toBe(true);
  });
  it("destinatario ve", () => {
    const r = row({ destinatarios: [{ user_id: "eu", nome: "Eu", avatar_url: null, lido_em: null }] });
    expect(canSeePrivado(r, "eu", "assessor")).toBe(true);
  });
  it("terceiro nao ve", () => {
    expect(canSeePrivado(row({}), "estranho", "assessor")).toBe(false);
  });
});

describe("filterPrivadosForUser", () => {
  it("filtra os que o usuario nao pode ver", () => {
    const visivel = row({ id: "a", destinatarios: [{ user_id: "eu", nome: "Eu", avatar_url: null, lido_em: null }] });
    const oculto = row({ id: "b" });
    const out = filterPrivadosForUser([visivel, oculto], "eu", "assessor");
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });
  it("socio mantem todos", () => {
    const out = filterPrivadosForUser([row({ id: "a" }), row({ id: "b" })], "socio-id", "socio");
    expect(out).toHaveLength(2);
  });
});

describe("isAuditoriaSomente", () => {
  it("true qdo socio nao e autor nem destinatario", () => {
    expect(isAuditoriaSomente(row({}), "socio-id")).toBe(true);
  });
  it("false qdo e autor", () => {
    expect(isAuditoriaSomente(row({ autor_id: "socio-id" }), "socio-id")).toBe(false);
  });
  it("false qdo e destinatario", () => {
    const r = row({ destinatarios: [{ user_id: "socio-id", nome: "S", avatar_url: null, lido_em: null }] });
    expect(isAuditoriaSomente(r, "socio-id")).toBe(false);
  });
});

describe("destinatariosLabel", () => {
  it("monta 'para: A, B'", () => {
    const r = row({
      destinatarios: [
        { user_id: "1", nome: "Ana", avatar_url: null, lido_em: null },
        { user_id: "2", nome: "Bia", avatar_url: null, lido_em: null },
      ],
    });
    expect(destinatariosLabel(r)).toBe("para: Ana, Bia");
  });
});

describe("meuLidoEm", () => {
  it("retorna lido_em do usuario atual", () => {
    const r = row({ destinatarios: [{ user_id: "eu", nome: "Eu", avatar_url: null, lido_em: "2026-06-14T01:00:00Z" }] });
    expect(meuLidoEm(r, "eu")).toBe("2026-06-14T01:00:00Z");
  });
  it("null se nao e destinatario", () => {
    expect(meuLidoEm(row({}), "eu")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- recados-privados`
Expected: FAIL ("Cannot find module '@/lib/recados/privados'").

- [ ] **Step 3: Implementar os helpers**

```ts
// src/lib/recados/privados.ts
import type { RecadoRow } from "./queries";

export interface PrivadoDestinatario {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  lido_em: string | null;
}

export interface PrivadoRow extends RecadoRow {
  privado: boolean;
  destinatarios: PrivadoDestinatario[];
}

export function canSeePrivado(row: PrivadoRow, userId: string, role: string): boolean {
  if (role === "socio") return true;
  if (row.autor_id === userId) return true;
  return row.destinatarios.some((d) => d.user_id === userId);
}

export function filterPrivadosForUser(rows: PrivadoRow[], userId: string, role: string): PrivadoRow[] {
  return rows.filter((r) => canSeePrivado(r, userId, role));
}

/** True quando o usuário só enxerga por ser sócio (não é autor nem destinatário). */
export function isAuditoriaSomente(row: PrivadoRow, userId: string): boolean {
  if (row.autor_id === userId) return false;
  return !row.destinatarios.some((d) => d.user_id === userId);
}

export function destinatariosLabel(row: PrivadoRow): string {
  return "para: " + row.destinatarios.map((d) => d.nome).join(", ");
}

export function meuLidoEm(row: PrivadoRow, userId: string): string | null {
  return row.destinatarios.find((d) => d.user_id === userId)?.lido_em ?? null;
}
```

> Nota: `RecadoRow` (em `queries.ts`) ainda não tem `privado`. A Task 4 adiciona `privado` ao `RecadoRow`. Até lá, `PrivadoRow` redeclara `privado` — ok. Se o type-check reclamar de override incompatível, é porque a Task 4 já rodou e adicionou `privado: boolean` ao `RecadoRow` (compatível).

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- recados-privados`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recados/privados.ts tests/unit/recados-privados.test.ts
git commit -m "feat(recados): helpers puros de visibilidade de privados"
```

---

## Task 4: Queries (listPrivados, contagem, filtro do mural)

**Files:**
- Modify: `src/lib/recados/queries.ts`

- [ ] **Step 1: Adicionar `privado` ao `RecadoRow`**

Em `src/lib/recados/queries.ts`, na interface `RecadoRow`, adicione o campo `privado` logo após `arquivado`:

```ts
  arquivado: boolean;
  privado: boolean;
  notif_scope: string;
```

- [ ] **Step 2: Mural só `privado=false`**

No `_listRecadosImpl`, adicione `privado` ao `select` e filtre. Substitua o trecho do `.select(...).eq("arquivado", arquivado);` por:

```ts
  let q: any = supabase
    .from("recados")
    .select(`
      id, autor_id, autor_role_snapshot, titulo, corpo, permanente, arquivado,
      privado, notif_scope, criado_em, atualizado_em,
      autor:profiles!recados_autor_id_fkey(nome, avatar_url),
      reacoes:recado_reacoes(emoji, user_id)
    `)
    .eq("arquivado", arquivado)
    .eq("privado", false);
```

E bump a cache key de `listRecados` (`recados-list-v2` → `recados-list-v3`):

```ts
    // v3: mural agora exclui privados (shape do conjunto mudou)
    ["recados-list-v3"],
```

- [ ] **Step 3: `listPrivados` + `countPrivadosNaoLidos`**

Adicione ao fim de `queries.ts` (antes de `getMyLastSeen` tudo bem):

```ts
import type { PrivadoRow } from "./privados";
import { filterPrivadosForUser } from "./privados";

async function _listPrivadosImpl(
  arquivado: boolean,
  unitProfileIds: string[] | null,
): Promise<PrivadoRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("recados")
    .select(`
      id, autor_id, autor_role_snapshot, titulo, corpo, permanente, arquivado,
      privado, notif_scope, criado_em, atualizado_em,
      autor:profiles!recados_autor_id_fkey(nome, avatar_url),
      reacoes:recado_reacoes(emoji, user_id),
      destinatarios:recado_destinatarios(
        user_id, lido_em,
        profile:profiles!recado_destinatarios_user_id_fkey(nome, avatar_url)
      )
    `)
    .eq("arquivado", arquivado)
    .eq("privado", true);

  if (unitProfileIds !== null) {
    if (unitProfileIds.length === 0) {
      q = q.is("autor_id", null);
    } else {
      q = q.or(`autor_id.in.(${unitProfileIds.join(",")}),autor_id.is.null`);
    }
  }

  const { data, error } = await q.order("criado_em", { ascending: false });
  if (error) {
    // Janela deploy→migration (tabela/coluna ainda não existem): degrada pra vazio.
    console.error("[recados/queries] listPrivados error:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    destinatarios: (r.destinatarios ?? []).map(
      (d: { user_id: string; lido_em: string | null; profile: { nome: string; avatar_url: string | null } | null }) => ({
        user_id: d.user_id,
        lido_em: d.lido_em,
        nome: d.profile?.nome ?? "Usuário removido",
        avatar_url: d.profile?.avatar_url ?? null,
      }),
    ),
  })) as PrivadoRow[];
}

export async function listPrivados(
  userId: string,
  role: string,
  arquivado: boolean,
  unitProfileIds: string[] | null = null,
): Promise<PrivadoRow[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { a, up } = JSON.parse(paramsJson) as { a: boolean; up: string[] | null };
      return _listPrivadosImpl(a, up);
    },
    ["recados-privados-list-v1"],
    { revalidate: 30, tags: ["recados"] },
  );
  const all = await cached(JSON.stringify({ a: arquivado, up: unitProfileIds }));
  // Visibilidade aplicada FORA do cache (depende de userId+role).
  return filterPrivadosForUser(all, userId, role);
}

async function _countPrivadosNaoLidosImpl(userId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  const { count, error } = await supabase
    .from("recado_destinatarios")
    .select("recado_id, recados!inner(arquivado)", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("lido_em", null)
    .eq("recados.arquivado", false);
  if (error) {
    // Janela deploy→migration: tabela ainda não existe → 0 (não derruba o layout).
    console.error("[recados/queries] countPrivadosNaoLidos error:", error.message);
    return 0;
  }
  return count ?? 0;
}
```

- [ ] **Step 4: `countRecadosNaoLidos` soma privados + filtra mural**

No `_countRecadosNaoLidosImpl`, adicione `.eq("privado", false)` na query do mural (logo após `.eq("permanente", false)`):

```ts
  let q: any = supabase
    .from("recados")
    .select("id", { count: "exact", head: true })
    .eq("arquivado", false)
    .eq("permanente", false)
    .eq("privado", false)
    .gt("criado_em", cutoff);
```

E no fim da função, antes do `return count ?? 0;`, troque por:

```ts
  const mural = count ?? 0;
  const privados = await _countPrivadosNaoLidosImpl(userId);
  return mural + privados;
```

Bump a cache key de `countRecadosNaoLidos` (`recados-count-nao-lidos-v2` → `-v3`):

```ts
    // v3: agora soma privados não lidos pra mim
    ["recados-count-nao-lidos-v3"],
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros em `src/lib/recados/*`. (Erros em `page.tsx`/`NovoRecadoDialog`/`RecadoCard` por props ainda não atualizadas são esperados e resolvidos nas Tasks 6-8.)

> Se `tsc` global acusar muitos erros não relacionados, rode focado: `npx tsc --noEmit 2>&1 | grep recados`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recados/queries.ts
git commit -m "feat(recados): listPrivados, contagem de privados e mural sem privados"
```

---

## Task 5: Actions (criar privado + marcar lido)

**Files:**
- Modify: `src/lib/recados/actions.ts`
- Test: `tests/unit/recados-actions.test.ts`

- [ ] **Step 1: Escrever os testes que falham**

Acrescente ao fim de `tests/unit/recados-actions.test.ts` (reusa os mocks `requireAuthMock`, `fromMock`, `dispatchMock` já definidos no topo do arquivo):

```ts
describe("criarRecadoAction — privado", () => {
  it("rejeita privado sem destinatarios", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);
    const fd = new FormData();
    fd.set("titulo", "oi");
    fd.set("corpo", "corpo");
    fd.set("notif_scope", "nenhum");
    fd.set("privado", "true");
    fd.set("destinatarios", "[]");
    const r = await criarRecadoAction(fd);
    expect(r.error).toBeTruthy();
  });

  it("cria privado, grava destinatarios e notifica só eles", async () => {
    requireAuthMock.mockResolvedValue(ACTOR_ASSESSOR);

    const insertDestSelect = vi.fn().mockResolvedValue({
      data: [{ recado_id: "rec-1", user_id: "dest-1" }],
      error: null,
    });
    const destInsert = vi.fn(() => ({ select: insertDestSelect }));

    fromMock.mockImplementation((table: string) => {
      if (table === "recados") {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: "rec-1", titulo: "oi" }, error: null }),
            }),
          }),
        };
      }
      if (table === "recado_destinatarios") {
        return { insert: destInsert };
      }
      return {};
    });

    const fd = new FormData();
    fd.set("titulo", "oi");
    fd.set("corpo", "corpo");
    fd.set("notif_scope", "nenhum");
    fd.set("privado", "true");
    fd.set("destinatarios", JSON.stringify(["dest-1"]));

    const r = await criarRecadoAction(fd);
    expect(r.success).toBe(true);
    expect(destInsert).toHaveBeenCalledWith([{ recado_id: "rec-1", user_id: "dest-1" }]);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const arg = dispatchMock.mock.calls[0][0];
    expect(arg.user_ids_extras).toEqual(["dest-1"]);
    expect(arg.source_user_id).toBe(ACTOR_ASSESSOR.id);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- recados-actions`
Expected: FAIL (action ainda não trata `privado`/`destinatarios`).

- [ ] **Step 3: Implementar no action**

Em `src/lib/recados/actions.ts`, substitua o corpo de `criarRecadoAction` por:

```ts
export async function criarRecadoAction(formData: FormData) {
  const actor = await requireAuth();

  const wantsPermanente =
    formData.get("permanente") === "on" || formData.get("permanente") === "true";
  const wantsPrivado =
    formData.get("privado") === "on" || formData.get("privado") === "true";

  if (wantsPermanente && actor.role !== "socio") {
    return { error: "Apenas Sócio pode fixar recados como permanentes" };
  }

  let destinatarios: string[] = [];
  const rawDest = fd(formData, "destinatarios");
  if (rawDest) {
    try {
      const parsedDest = JSON.parse(rawDest);
      if (Array.isArray(parsedDest)) destinatarios = parsedDest.map(String);
    } catch {
      return { error: "Destinatários inválidos" };
    }
  }

  const parsed = criarRecadoSchema.safeParse({
    titulo: fd(formData, "titulo"),
    corpo: fd(formData, "corpo"),
    notif_scope: fd(formData, "notif_scope"),
    permanente: wantsPrivado ? false : wantsPermanente,
    privado: wantsPrivado,
    destinatarios,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("recados")
    .insert({
      autor_id: actor.id,
      autor_role_snapshot: actor.role,
      titulo: parsed.data.titulo,
      corpo: parsed.data.corpo,
      permanente: parsed.data.permanente,
      privado: parsed.data.privado,
      notif_scope: parsed.data.notif_scope,
    })
    .select("id, titulo")
    .single();

  if (error || !created) return { error: error?.message ?? "Falha ao criar recado" };

  if (parsed.data.privado) {
    const rows = parsed.data.destinatarios.map((uid) => ({
      recado_id: created.id,
      user_id: uid,
    }));
    const { data: insertedDest, error: destErr } = await supabase
      .from("recado_destinatarios")
      .insert(rows)
      .select("recado_id, user_id");
    // RLS em insert é silencioso (error:null + 0 rows). Checa length.
    if (destErr || !insertedDest || insertedDest.length !== rows.length) {
      // Rollback best-effort do recado órfão.
      await supabase.from("recados").delete().eq("id", created.id);
      return { error: destErr?.message ?? "Falha ao gravar destinatários" };
    }

    await dispatchNotification({
      evento_tipo: "recado_novo",
      titulo: `Recado privado de ${actor.nome}`,
      mensagem: created.titulo,
      link: `/recados?aba=privados#${created.id}`,
      user_ids_extras: parsed.data.destinatarios,
      source_user_id: actor.id,
    });
  } else if (parsed.data.notif_scope !== "nenhum") {
    const recipientIds = await resolveRecipientIds(parsed.data.notif_scope, actor.id);
    if (recipientIds.length > 0) {
      await dispatchNotification({
        evento_tipo: "recado_novo",
        titulo: `Novo recado de ${actor.nome}`,
        mensagem: created.titulo,
        link: `/recados#${created.id}`,
        user_ids_extras: recipientIds,
        source_user_id: actor.id,
      });
    }
  }

  revalidatePath("/recados");
  revalidateTag("recados", "default");
  revalidatePath("/", "layout");
  return { success: true, id: created.id };
}
```

- [ ] **Step 4: Adicionar `marcarPrivadosLidosAction`**

Adicione ao fim de `actions.ts`:

```ts
export async function marcarPrivadosLidosAction() {
  const actor = await requireAuth();
  const supabase = await createClient();
  const { error } = await supabase
    .from("recado_destinatarios")
    .update({ lido_em: new Date().toISOString() })
    .eq("user_id", actor.id)
    .is("lido_em", null);
  if (error) return { error: error.message };

  revalidateTag("recados", "default");
  revalidatePath("/", "layout");
  return { success: true };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test -- recados-actions`
Expected: PASS (novos testes + os antigos seguem verdes).

- [ ] **Step 6: Commit**

```bash
git add src/lib/recados/actions.ts tests/unit/recados-actions.test.ts
git commit -m "feat(recados): criar privado com destinatarios + marcar privados lidos"
```

---

## Task 6: NovoRecadoDialog (toggle + seletor de pessoas)

**Files:**
- Modify: `src/components/recados/NovoRecadoDialog.tsx`

- [ ] **Step 1: Aceitar a lista de pessoas via props**

Em `NovoRecadoDialog.tsx`, no tipo `Props`, adicione `people` ao ramo `create` (e deixe opcional no ramo `edit`):

```ts
type Person = { id: string; nome: string };

type Props =
  | {
      mode?: "create";
      currentUserRole: string;
      people: Person[];
      open?: undefined;
      onOpenChange?: undefined;
      recado?: undefined;
    }
  | {
      mode: "edit";
      currentUserRole: string;
      people?: undefined;
      open: boolean;
      onOpenChange: (open: boolean) => void;
      recado: { id: string; titulo: string; corpo: string };
    };
```

- [ ] **Step 2: Estado do privado + seleção**

Após `const [permanente, setPermanente] = useState(false);` adicione:

```ts
  const [privado, setPrivado] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const people = !isEdit ? props.people : [];

  function togglePerson(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
```

No `reset()`, adicione:

```ts
    setPrivado(false);
    setSelectedIds([]);
```

- [ ] **Step 3: Enviar privado no submit**

No `onSubmit`, dentro do ramo `else` (create), substitua o bloco que monta o FormData por:

```ts
        fd.set("titulo", titulo);
        fd.set("corpo", corpo);
        fd.set("notif_scope", privado ? "nenhum" : notifScope);
        fd.set("privado", privado ? "true" : "false");
        if (privado) fd.set("destinatarios", JSON.stringify(selectedIds));
        if (!privado && permanente) fd.set("permanente", "on");
        result = await criarRecadoAction(fd);
```

- [ ] **Step 4: UI do toggle + checkbox list**

No JSX do create (`{!isEdit && ...}`), antes do bloco de "Notificação", adicione o toggle e o seletor; e condicione Notificação/Permanente a `!privado`.

Adicione este bloco logo após o campo "Mensagem" (`</div>` do corpo) e ANTES do bloco de Notificação:

```tsx
          {!isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="recado-privado"
                checked={privado}
                onCheckedChange={(v) => setPrivado(!!v)}
              />
              <Label htmlFor="recado-privado" className="text-sm font-normal">
                Recado privado (só pra quem você escolher)
              </Label>
            </div>
          )}

          {!isEdit && privado && (
            <div className="space-y-2">
              <Label>Destinatários</Label>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {people.length === 0 && (
                  <p className="text-xs text-muted-foreground">Ninguém disponível.</p>
                )}
                {people.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={selectedIds.includes(p.id)}
                      onCheckedChange={() => togglePerson(p.id)}
                    />
                    {p.nome}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {selectedIds.length} selecionado(s)
              </p>
            </div>
          )}
```

Agora condicione os blocos existentes a `!privado`. Troque a abertura do bloco de Notificação:

```tsx
          {!isEdit && !privado && (
            <div className="space-y-2">
              <Label htmlFor="recado-notif">Notificação</Label>
```

E a do bloco de Permanente:

```tsx
          {!isEdit && !privado && props.currentUserRole === "socio" && (
```

- [ ] **Step 5: Type-check do componente**

Run: `npx tsc --noEmit 2>&1 | grep NovoRecadoDialog`
Expected: sem saída (ou só o erro esperado de quem ainda chama sem `people` — resolvido na Task 8). Confirme que o erro restante é só "missing prop `people`" nos call sites.

- [ ] **Step 6: Commit**

```bash
git add src/components/recados/NovoRecadoDialog.tsx
git commit -m "feat(recados): toggle de privado + seletor de pessoas no dialog"
```

---

## Task 7: RecadoCard (linha "para: X")

**Files:**
- Modify: `src/components/recados/RecadoCard.tsx`

- [ ] **Step 1: Aceitar label opcional**

Na interface `Props` de `RecadoCard.tsx`, adicione:

```ts
interface Props {
  recado: RecadoRow;
  currentUserId: string;
  currentUserRole: string;
  destinatariosLabel?: string;
}
```

E na desestruturação do componente:

```ts
export function RecadoCard({ recado, currentUserId, currentUserRole, destinatariosLabel }: Props) {
```

- [ ] **Step 2: Renderizar a linha**

Dentro do `<div className="space-y-1">` do corpo, antes do `<div className="font-semibold">{recado.titulo}</div>`, adicione:

```tsx
          {destinatariosLabel && (
            <div className="text-[11px] font-medium text-primary">{destinatariosLabel}</div>
          )}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep RecadoCard`
Expected: sem saída.

- [ ] **Step 4: Commit**

```bash
git add src/components/recados/RecadoCard.tsx
git commit -m "feat(recados): RecadoCard mostra 'para: X' quando privado"
```

---

## Task 8: PrivadoFeed + página (aba Privados)

**Files:**
- Create: `src/components/recados/PrivadoFeed.tsx`
- Modify: `src/app/(authed)/recados/page.tsx`

- [ ] **Step 1: Criar o PrivadoFeed**

```tsx
// src/components/recados/PrivadoFeed.tsx
import { ShieldAlert } from "lucide-react";
import { RecadoCard } from "./RecadoCard";
import type { PrivadoRow } from "@/lib/recados/privados";
import { destinatariosLabel, isAuditoriaSomente } from "@/lib/recados/privados";

interface Props {
  privados: PrivadoRow[];
  currentUserId: string;
  currentUserRole: string;
  emptyLabel: string;
}

export function PrivadoFeed({ privados, currentUserId, currentUserRole, emptyLabel }: Props) {
  if (privados.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  const isSocio = currentUserRole === "socio";
  const meus = privados.filter((r) => !isSocio || !isAuditoriaSomente(r, currentUserId));
  const auditoria = isSocio ? privados.filter((r) => isAuditoriaSomente(r, currentUserId)) : [];

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="grid gap-3">
          {meus.map((r) => (
            <RecadoCard
              key={r.id}
              recado={r}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              destinatariosLabel={destinatariosLabel(r)}
            />
          ))}
          {meus.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum recado privado seu.
            </p>
          )}
        </div>
      </section>

      {auditoria.length > 0 && (
        <section className="space-y-3">
          <header className="flex items-center gap-2 rounded-md bg-sky-900 px-3 py-2 text-sm font-semibold text-white">
            <ShieldAlert className="h-4 w-4" />
            Auditoria — todos os privados
          </header>
          <div className="grid gap-3">
            {auditoria.map((r) => (
              <RecadoCard
                key={r.id}
                recado={r}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                destinatariosLabel={destinatariosLabel(r)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Reescrever a página com a 3ª aba**

Substitua `src/app/(authed)/recados/page.tsx` inteiro por:

```tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listRecados, listPrivados } from "@/lib/recados/queries";
import { listMentionables } from "@/lib/escritorio/queries";
import { marcarPrivadosLidosAction } from "@/lib/recados/actions";
import { getProfileIdsForActiveUnit } from "@/lib/units/filter-helpers";
import { NovoRecadoDialog } from "@/components/recados/NovoRecadoDialog";
import { RecadoFeed } from "@/components/recados/RecadoFeed";
import { PrivadoFeed } from "@/components/recados/PrivadoFeed";
import { cn } from "@/lib/utils";

type Aba = "ativos" | "privados" | "arquivados";

interface SearchParams {
  aba?: string;
}

export default async function RecadosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireAuth();
  const aba: Aba =
    params.aba === "arquivados" ? "arquivados" : params.aba === "privados" ? "privados" : "ativos";

  const unitProfileIds = await getProfileIdsForActiveUnit();

  // Pessoas pro seletor de privados (ativos na unidade, menos eu).
  const mentionables = await listMentionables(unitProfileIds);
  const people = mentionables
    .filter((p) => p.id !== user.id)
    .map((p) => ({ id: p.id, nome: p.nome }));

  let recados: Awaited<ReturnType<typeof listRecados>> = [];
  let privados: Awaited<ReturnType<typeof listPrivados>> = [];

  if (aba === "privados") {
    privados = await listPrivados(user.id, user.role, false, unitProfileIds);
    await marcarPrivadosLidosAction();
  } else {
    recados = await listRecados(aba === "arquivados", unitProfileIds);
    if (aba === "ativos") {
      const supabase = await createClient();
      await supabase
        .from("recado_visualizacoes")
        .upsert(
          { user_id: user.id, last_seen_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
    }
  }

  function tabHref(slug: Aba) {
    if (slug === "ativos") return "/recados";
    return `/recados?aba=${slug}`;
  }

  const TABS: { slug: Aba; label: string }[] = [
    { slug: "ativos", label: "Mural" },
    { slug: "privados", label: "Privados" },
    { slug: "arquivados", label: "Arquivados" },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recados</h1>
          <p className="text-sm text-muted-foreground">Mural compartilhado da equipe.</p>
        </div>
        <NovoRecadoDialog currentUserRole={user.role} people={people} />
      </header>

      <nav className="flex gap-1 border-b">
        {TABS.map(({ slug, label }) => (
          <Link
            key={slug}
            href={tabHref(slug)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              aba === slug
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {aba === "privados" ? (
        <PrivadoFeed
          privados={privados}
          currentUserId={user.id}
          currentUserRole={user.role}
          emptyLabel="Nenhum recado privado."
        />
      ) : (
        <RecadoFeed
          recados={recados}
          currentUserId={user.id}
          currentUserRole={user.role}
          emptyLabel={aba === "ativos" ? "Nenhum recado ativo. Seja o primeiro!" : "Nenhum recado arquivado."}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check geral**

Run: `npx tsc --noEmit 2>&1 | grep -E "recados|Recado|Privado"`
Expected: sem saída.

- [ ] **Step 4: Commit**

```bash
git add src/components/recados/PrivadoFeed.tsx "src/app/(authed)/recados/page.tsx"
git commit -m "feat(recados): aba Privados com feed + seletor de pessoas na pagina"
```

---

## Task 9: Tipos do banco + verificação final

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Adicionar `privado` ao tipo `recados`**

Em `src/types/database.ts`, no bloco `recados:` (≈ linha 2069), adicione `privado: boolean` em `Row`, `privado?: boolean` em `Insert` e `privado?: boolean` em `Update` (ordem alfabética, logo após `permanente`):

```ts
        Row: {
          ...
          permanente: boolean
          privado: boolean
          titulo: string
        }
        Insert: {
          ...
          permanente?: boolean
          privado?: boolean
          titulo: string
        }
        Update: {
          ...
          permanente?: boolean
          privado?: boolean
          titulo?: string
        }
```

- [ ] **Step 2: Adicionar a tabela `recado_destinatarios`**

Logo antes do bloco `recado_reacoes:` (≈ linha 2010), adicione:

```ts
      recado_destinatarios: {
        Row: {
          criado_em: string
          lido_em: string | null
          recado_id: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          lido_em?: string | null
          recado_id: string
          user_id: string
        }
        Update: {
          criado_em?: string
          lido_em?: string | null
          recado_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recado_destinatarios_recado_id_fkey"
            columns: ["recado_id"]
            isOneToOne: false
            referencedRelation: "recados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recado_destinatarios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
```

- [ ] **Step 3: Type-check + lint + testes (verificação final)**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a recados.

Run: `npm run lint 2>&1 | grep -iE "recados|privado" || echo "lint ok"`
Expected: `lint ok` (ou sem erros nos arquivos tocados).

Run: `npm test -- recados`
Expected: PASS em `recados-schema`, `recados-actions`, `recados-privados`, `recados-tiers`.

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts
git commit -m "feat(recados): tipos do banco para privado + recado_destinatarios"
```

---

## Notas de deploy (CRÍTICO — ler antes de mergear)

1. **Ordem segura (migration ANTES do merge).** A migration é additiva e retrocompatível (coluna com default + tabela nova + RLS que não bloqueia o código atual, que lê via service-role). Aplique-a manualmente no SQL Editor do Supabase **antes de mergear o PR**. Assim não existe janela "deploy novo + tabela inexistente". As queries novas ainda têm `try/catch` que degrada pra vazio/0 como rede de segurança, mas a ordem certa evita o problema de origem.
   - Memórias relevantes: `project_supabase_migrations_manual`, `feedback_calendar_fullselect_fallback`.

2. **Cache keys bumpadas no mesmo PR** (`recados-list-v2→v3`, `recados-count-nao-lidos-v2→v3`, nova `recados-privados-list-v1`) — shape mudou (memória `feedback_cache_shape_changes`).

3. **`unstable_cache` só com service-role.** `listPrivados` cacheia só a parte service-role; o filtro por usuário/role roda FORA do cache. Nunca colocar cookie client dentro de `unstable_cache` (memória `feedback_unstable_cache_service_role_only`).

4. **RLS silencioso em insert.** `criarRecadoAction` confere `insertedDest.length` após inserir destinatários (memória `feedback_supabase_rls_silent_update`).

5. **Auto-merge:** abrir PR → esperar CI (`ci.yml`) verde → `gh pr merge --squash --delete-branch`. Migration permanece manual (aplicada no passo 1, antes do merge).

6. **`adm` não ganha auditoria de privados** (decisão do brainstorming): a visão geral é só `socio`. `adm` mantém editar/apagar/arquivar via `isPrivileged` no mural.

---

## Self-Review (cobertura do spec)

- Modelo de dados (`privado` + `recado_destinatarios` + `lido_em`) → Task 1, Task 9.
- Visibilidade autor+destinatários+sócio (RLS + app) → Task 1 (RLS), Task 3 (helpers), Task 4 (`listPrivados` aplica filtro).
- Aba "Privados" separada + bloco de auditoria do sócio → Task 8.
- Notificação + bolinha pros destinatários (sócio sem spam) → Task 4 (count soma privados do destinatário), Task 5 (dispatch só pros destinatários).
- Envio 1+ pessoas, multi-seleção → Task 2 (schema), Task 6 (UI).
- "para: X" no card → Task 7.
- Marcar privados lidos ao abrir a aba → Task 5 + Task 8.
- Migration manual + cache bump + retrocompat → Notas de deploy.
