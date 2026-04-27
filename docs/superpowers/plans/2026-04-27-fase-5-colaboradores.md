# Fase 5 — Colaboradores (Yide Digital) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar Colaboradores (filtros + avatar + tests) e adicionar 4 papéis novos (videomaker, designer, editor, audiovisual_chefe) com permissões corretas — produtores ocultam R$ de clientes; Audiovisual Chefe é supervisor com % sobre carteira da agência.

**Architecture:** Refactor incremental. Boa parte do colaboradores já existe (lista, convite, edit, audit log). Adicionamos 4 valores ao enum `user_role`, atualizamos a matriz de permissões, refatoramos schema/queries para suportar produtores (% zerado automático), criamos upload de avatar (Supabase Storage), montamos filtros na lista, e auditamos as telas de cliente para garantir que produtores não veem R$.

**Tech Stack:** Next.js 16 + Supabase (Postgres + RLS + Storage) + Base UI + Tailwind + Zod + Vitest + Playwright. Sem novas dependências.

**Spec:** [docs/superpowers/specs/2026-04-27-fase-5-colaboradores-design.md](../specs/2026-04-27-fase-5-colaboradores-design.md)

**Plano anterior:** [Fase 4 — Tarefas](2026-04-27-fase-4-tarefas.md)

**Fora do escopo:**
- Notificação 3 dias antes do aniversário → Fase 6 (cron)
- Bulk import / bulk deactivate / exportar CSV → futuro
- Crop / resize de avatar → v1 só upload direto
- Cálculo de comissão do Audiovisual Chefe → Fase 7 (Comissões); aqui só guarda o `%` no perfil

**Estado atual no repositório (já existe, parte será refatorada):**
- `src/lib/auth/permissions.ts` — 5 roles atuais (adm, socio, comercial, coordenador, assessor)
- `src/lib/colaboradores/{schema,queries,actions}.ts` — convite + edit, audit log, sensitive field guards
- `src/components/colaboradores/{ColaboradoresTable,ColaboradorForm,ConviteForm}.tsx`
- `src/app/(authed)/colaboradores/{page,novo/page,[id]/page,[id]/editar/page}.tsx`
- Sidebar global já tem item "Colaboradores"
- `profiles.avatar_url text` (nullable) — campo já existe, só falta popular via UI

**Estrutura final esperada (delta sobre o que já existe):**

```
supabase/migrations/
├── 20260427000010_user_role_extend.sql            [NEW]
└── 20260427000011_avatars_storage.sql             [NEW]

src/
├── app/(authed)/
│   ├── colaboradores/
│   │   ├── page.tsx                               [MODIFY — montar filtros]
│   │   ├── novo/page.tsx                          [MODIFY — passa profiles 9 roles]
│   │   ├── [id]/page.tsx                          [MODIFY — avatar grande]
│   │   └── [id]/editar/page.tsx                   [MODIFY — render AvatarUpload]
│   └── clientes/
│       ├── page.tsx                               [MODIFY — guard view:client_money_all]
│       └── [id]/editar/page.tsx                   [AUDIT — pode já estar OK]
│
├── components/
│   ├── colaboradores/
│   │   ├── ColaboradoresTable.tsx                 [MODIFY — avatar + admissão]
│   │   ├── ColaboradoresFilters.tsx               [NEW — client]
│   │   ├── ColaboradorForm.tsx                    [MODIFY — 9 roles + aviso produtor]
│   │   ├── ConviteForm.tsx                        [MODIFY — 9 roles + aviso produtor]
│   │   └── AvatarUpload.tsx                       [NEW — client]
│   └── clientes/
│       └── (telas auditadas se exibem R$)         [AUDIT]
│
├── lib/
│   ├── auth/permissions.ts                        [MODIFY — 9 roles + matriz]
│   └── colaboradores/
│       ├── schema.ts                              [MODIFY — ROLES + transform produtor]
│       ├── queries.ts                             [MODIFY — admissionAfter + avatar_url]
│       ├── actions.ts                             [MODIFY — sem mudança grande]
│       └── avatar-actions.ts                      [NEW — uploadAvatarAction]
│
└── types/database.ts                              [REGENERATE]

tests/
├── unit/
│   ├── colaboradores-schema.test.ts               [NEW — 9 roles + transform]
│   └── colaboradores-queries.test.ts              [NEW — filtros]
└── e2e/
    └── colaboradores.spec.ts                      [NEW — auth-redirect das 4 rotas]
```

**Total estimado:** ~12 commits.

---

## Bloco A — Migrations

### Task A1: Estender enum `user_role`

**Files:**
- Create: `supabase/migrations/20260427000010_user_role_extend.sql`

- [ ] **Step A1.1: Escrever SQL**

```sql
-- supabase/migrations/20260427000010_user_role_extend.sql
-- Adiciona 4 valores ao enum user_role: 3 produtores audiovisuais + 1 supervisor.
alter type public.user_role add value 'videomaker';
alter type public.user_role add value 'designer';
alter type public.user_role add value 'editor';
alter type public.user_role add value 'audiovisual_chefe';
```

- [ ] **Step A1.2: Aplicar e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push
```

Esperar: `Applying migration 20260427000010_user_role_extend.sql...` sem erro.

```bash
git add supabase/migrations/20260427000010_user_role_extend.sql
git commit -m "feat(db): extend user_role enum with audiovisual roles"
```

---

### Task A2: Bucket `avatars` no Supabase Storage

**Files:**
- Create: `supabase/migrations/20260427000011_avatars_storage.sql`

- [ ] **Step A2.1: Escrever SQL**

```sql
-- supabase/migrations/20260427000011_avatars_storage.sql
-- Bucket público de avatares de colaboradores. Path: {user_id}/avatar.{ext}.
-- Policies: usuários atualizam seu próprio avatar; ADM/Sócio podem atualizar qualquer um.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "users upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "adm/socio upload any avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and public.current_user_role() in ('adm','socio'));

create policy "anyone read avatars"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "users update own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "adm/socio update any avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and public.current_user_role() in ('adm','socio'));
```

- [ ] **Step A2.2: Aplicar e commit**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  npx supabase db push
```

Esperar: `Applying migration 20260427000011_avatars_storage.sql...` sem erro.

```bash
git add supabase/migrations/20260427000011_avatars_storage.sql
git commit -m "feat(db): avatars storage bucket with RLS policies"
```

---

### Task A3: Regenerar tipos do banco

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step A3.1: Regenerar (rodar do worktree)**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.env.local" | cut -d= -f2) \
  SUPABASE_PROJECT_ID=jelvhwbpipawghwufpbc \
  npm run db:types
npm run typecheck
```

Esperar: `Database["public"]["Enums"]["user_role"]` agora inclui os 4 valores novos. Typecheck OK.

- [ ] **Step A3.2: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(db): regenerate types after user_role enum extend"
```

---

## Bloco B — Backend

### Task B1: Atualizar matriz de permissões

**Files:**
- Modify: `src/lib/auth/permissions.ts`

- [ ] **Step B1.1: Substituir conteúdo inteiro**

```ts
export type Role =
  | "adm" | "socio" | "comercial" | "coordenador" | "assessor"
  | "videomaker" | "designer" | "editor" | "audiovisual_chefe";

export type Action =
  // Gestão de usuários
  | "manage:users"
  | "edit:commission_percent"
  | "edit:colaboradores"
  // Visualizações
  | "view:all_clients"
  | "view:client_money_all"
  | "view:financial_consolidated"
  | "view:own_commission"
  | "view:other_commissions"
  // Onboarding / Comercial
  | "access:prospeccao"
  | "kanban:move_prospeccao_to_comercial"
  | "kanban:move_comercial_to_contrato"
  | "kanban:move_contrato_to_marco_zero"
  | "kanban:move_marco_zero_to_ativo"
  // Aprovações
  | "approve:monthly_closing"
  // Tarefas e calendário
  | "create:tasks"
  | "create:calendar_event"
  | "customize:notification_recipients"
  // Satisfação
  | "feed:satisfaction"
  // Sistema
  | "system:support";

const matrix: Record<Role, Action[]> = {
  socio: [
    "manage:users", "edit:commission_percent", "edit:colaboradores",
    "view:all_clients", "view:client_money_all", "view:financial_consolidated",
    "view:own_commission", "view:other_commissions",
    "access:prospeccao",
    "kanban:move_prospeccao_to_comercial", "kanban:move_comercial_to_contrato",
    "kanban:move_contrato_to_marco_zero", "kanban:move_marco_zero_to_ativo",
    "approve:monthly_closing",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  adm: [
    "manage:users", "edit:colaboradores",
    "view:all_clients", "view:client_money_all", "view:financial_consolidated",
    "view:own_commission", "view:other_commissions",
    "access:prospeccao",
    "kanban:move_prospeccao_to_comercial", "kanban:move_comercial_to_contrato",
    "kanban:move_contrato_to_marco_zero", "kanban:move_marco_zero_to_ativo",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "system:support",
  ],
  comercial: [
    "view:all_clients",
    "view:own_commission",
    "access:prospeccao",
    "kanban:move_prospeccao_to_comercial", "kanban:move_comercial_to_contrato",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
  ],
  coordenador: [
    "view:all_clients",
    "view:own_commission",
    "kanban:move_marco_zero_to_ativo",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  assessor: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  videomaker: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  designer: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  editor: [
    "view:all_clients",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
  audiovisual_chefe: [
    "view:all_clients",
    "view:client_money_all",
    "view:own_commission",
    "create:tasks", "create:calendar_event", "customize:notification_recipients",
    "feed:satisfaction",
  ],
};

export function canAccess(role: Role | string, action: Action): boolean {
  const allowed = matrix[role as Role];
  if (!allowed) return false;
  return allowed.includes(action);
}
```

- [ ] **Step B1.2: Typecheck**

```bash
npm run typecheck
```

Esperar: clean. (Não há tests de permissions.ts pre-existentes que falhariam — caso haja, rodar `npm run test`.)

- [ ] **Step B1.3: Commit**

```bash
git add src/lib/auth/permissions.ts
git commit -m "feat(auth): add 4 audiovisual roles to permission matrix"
```

---

### Task B2: Refactor `colaboradores/schema.ts` com transform produtor

**Files:**
- Modify: `src/lib/colaboradores/schema.ts`
- Create: `tests/unit/colaboradores-schema.test.ts`

- [ ] **Step B2.1: Escrever testes (TDD)**

Crie `tests/unit/colaboradores-schema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { inviteSchema, editColaboradorSchema, ROLES } from "@/lib/colaboradores/schema";

const VALID_UUID = "00000000-0000-0000-0000-000000000000";

describe("ROLES", () => {
  it("contém os 9 roles esperados", () => {
    expect(ROLES).toEqual([
      "adm", "socio", "comercial", "coordenador", "assessor",
      "videomaker", "designer", "editor", "audiovisual_chefe",
    ]);
  });
});

describe("inviteSchema", () => {
  it("aceita videomaker válido", () => {
    const r = inviteSchema.safeParse({
      nome: "João",
      email: "joao@yide.com",
      role: "videomaker",
      fixo_mensal: 3000,
      comissao_percent: 0,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
  });

  it("zera comissao_percent quando role é videomaker mesmo se enviar > 0", () => {
    const r = inviteSchema.safeParse({
      nome: "João",
      email: "joao@yide.com",
      role: "videomaker",
      fixo_mensal: 3000,
      comissao_percent: 5,
      comissao_primeiro_mes_percent: 10,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.comissao_percent).toBe(0);
      expect(r.data.comissao_primeiro_mes_percent).toBe(0);
    }
  });

  it("zera comissao_percent quando role é designer", () => {
    const r = inviteSchema.safeParse({
      nome: "Ana",
      email: "ana@yide.com",
      role: "designer",
      fixo_mensal: 2500,
      comissao_percent: 3,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(0);
  });

  it("zera comissao_percent quando role é editor", () => {
    const r = inviteSchema.safeParse({
      nome: "Bruno",
      email: "bruno@yide.com",
      role: "editor",
      fixo_mensal: 2200,
      comissao_percent: 2,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(0);
  });

  it("preserva comissao_percent quando role é audiovisual_chefe", () => {
    const r = inviteSchema.safeParse({
      nome: "Carla",
      email: "carla@yide.com",
      role: "audiovisual_chefe",
      fixo_mensal: 5000,
      comissao_percent: 2,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(2);
  });

  it("preserva comissao_percent quando role é coordenador", () => {
    const r = inviteSchema.safeParse({
      nome: "Diego",
      email: "diego@yide.com",
      role: "coordenador",
      fixo_mensal: 4500,
      comissao_percent: 3,
      comissao_primeiro_mes_percent: 0,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(3);
  });

  it("rejeita role inválido", () => {
    const r = inviteSchema.safeParse({
      nome: "Eva",
      email: "eva@yide.com",
      role: "fotografo",
      fixo_mensal: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita email mal-formado", () => {
    const r = inviteSchema.safeParse({
      nome: "Felipe",
      email: "nao-eh-email",
      role: "assessor",
      fixo_mensal: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita nome com 1 char", () => {
    const r = inviteSchema.safeParse({
      nome: "G",
      email: "g@yide.com",
      role: "assessor",
      fixo_mensal: 0,
    });
    expect(r.success).toBe(false);
  });
});

describe("editColaboradorSchema", () => {
  it("zera comissao_percent quando role muda para videomaker", () => {
    const r = editColaboradorSchema.safeParse({
      id: VALID_UUID,
      nome: "Helena",
      role: "videomaker",
      fixo_mensal: 3000,
      comissao_percent: 5,
      comissao_primeiro_mes_percent: 0,
      ativo: true,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.comissao_percent).toBe(0);
      expect(r.data.comissao_primeiro_mes_percent).toBe(0);
    }
  });

  it("preserva comissao_percent quando role é audiovisual_chefe", () => {
    const r = editColaboradorSchema.safeParse({
      id: VALID_UUID,
      nome: "Ivo",
      role: "audiovisual_chefe",
      fixo_mensal: 5000,
      comissao_percent: 2,
      comissao_primeiro_mes_percent: 0,
      ativo: true,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.comissao_percent).toBe(2);
  });
});
```

- [ ] **Step B2.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/colaboradores-schema.test.ts
```

Esperar: testes "zera comissao_percent..." falham porque o schema atual não tem o transform.

- [ ] **Step B2.3: Substituir `src/lib/colaboradores/schema.ts`**

```ts
import { z } from "zod";

export const ROLES = [
  "adm",
  "socio",
  "comercial",
  "coordenador",
  "assessor",
  "videomaker",
  "designer",
  "editor",
  "audiovisual_chefe",
] as const;
export type RoleEnum = typeof ROLES[number];

const PRODUCERS = ["videomaker", "designer", "editor"] as const;

function zeroPercentForProducers<T extends { role: string; comissao_percent: number; comissao_primeiro_mes_percent: number }>(
  data: T,
): T {
  if ((PRODUCERS as readonly string[]).includes(data.role)) {
    return { ...data, comissao_percent: 0, comissao_primeiro_mes_percent: 0 };
  }
  return data;
}

export const inviteSchema = z
  .object({
    nome: z.string().min(2, "Nome muito curto"),
    email: z.string().email("Email inválido"),
    role: z.enum(ROLES),
    fixo_mensal: z.coerce.number().min(0).default(0),
    comissao_percent: z.coerce.number().min(0).max(100).default(0),
    comissao_primeiro_mes_percent: z.coerce.number().min(0).max(100).default(0),
  })
  .transform(zeroPercentForProducers);

export const editColaboradorSchema = z
  .object({
    id: z.string().uuid(),
    nome: z.string().min(2),
    telefone: z.string().optional().nullable(),
    endereco: z.string().optional().nullable(),
    pix: z.string().optional().nullable(),
    data_nascimento: z.string().optional().nullable(),
    data_admissao: z.string().optional().nullable(),
    fixo_mensal: z.coerce.number().min(0),
    comissao_percent: z.coerce.number().min(0).max(100),
    comissao_primeiro_mes_percent: z.coerce.number().min(0).max(100),
    role: z.enum(ROLES),
    ativo: z.coerce.boolean(),
    justificativa: z.string().optional(),
  })
  .transform(zeroPercentForProducers);

export type InviteInput = z.infer<typeof inviteSchema>;
export type EditColaboradorInput = z.infer<typeof editColaboradorSchema>;
```

- [ ] **Step B2.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/colaboradores-schema.test.ts
npm run typecheck
```

Esperar: 11/11 testes passam, typecheck OK (consumers `actions.ts` continuam OK pois `InviteInput` e `EditColaboradorInput` mantêm shape).

- [ ] **Step B2.5: Commit**

```bash
git add src/lib/colaboradores/schema.ts tests/unit/colaboradores-schema.test.ts
git commit -m "feat(colaboradores): add 4 roles and zero-percent transform for producers"
```

---

### Task B3: Refactor `colaboradores/queries.ts` (filtro admissão + avatar_url)

**Files:**
- Modify: `src/lib/colaboradores/queries.ts`
- Create: `tests/unit/colaboradores-queries.test.ts`

- [ ] **Step B3.1: Escrever testes (TDD)**

Crie `tests/unit/colaboradores-queries.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { sortColaboradoresByName, filterColaboradoresByAdmissionAfter } from "@/lib/colaboradores/queries";

const baseColab = {
  id: "x",
  nome: "Zuzu",
  email: "zuzu@yide.com",
  role: "assessor" as const,
  ativo: true,
  fixo_mensal: 0,
  comissao_percent: 0,
  comissao_primeiro_mes_percent: 0,
  created_at: "2026-01-01T00:00:00Z",
  data_admissao: null as string | null,
  avatar_url: null as string | null,
};

describe("sortColaboradoresByName", () => {
  it("ordena alfabeticamente por nome ascendente", () => {
    const rows = [
      { ...baseColab, id: "a", nome: "Carlos" },
      { ...baseColab, id: "b", nome: "Ana" },
      { ...baseColab, id: "c", nome: "Beatriz" },
    ];
    const sorted = sortColaboradoresByName(rows);
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("trata acentos sem quebrar", () => {
    const rows = [
      { ...baseColab, id: "a", nome: "Ângela" },
      { ...baseColab, id: "b", nome: "Bruno" },
    ];
    const sorted = sortColaboradoresByName(rows);
    expect(sorted[0].id).toBe("a");
  });
});

describe("filterColaboradoresByAdmissionAfter", () => {
  it("retorna todos quando filtro é null/undefined", () => {
    const rows = [
      { ...baseColab, id: "a", data_admissao: "2025-01-01" },
      { ...baseColab, id: "b", data_admissao: null },
    ];
    expect(filterColaboradoresByAdmissionAfter(rows, undefined)).toHaveLength(2);
    expect(filterColaboradoresByAdmissionAfter(rows, null)).toHaveLength(2);
  });

  it("inclui apenas colaboradores admitidos depois da data", () => {
    const rows = [
      { ...baseColab, id: "a", data_admissao: "2025-01-01" },
      { ...baseColab, id: "b", data_admissao: "2026-04-01" },
      { ...baseColab, id: "c", data_admissao: null },
    ];
    expect(filterColaboradoresByAdmissionAfter(rows, "2026-01-01").map((r) => r.id)).toEqual(["b"]);
  });

  it("inclui colaboradores admitidos no mesmo dia (>=)", () => {
    const rows = [
      { ...baseColab, id: "a", data_admissao: "2026-01-01" },
      { ...baseColab, id: "b", data_admissao: "2025-12-31" },
    ];
    expect(filterColaboradoresByAdmissionAfter(rows, "2026-01-01").map((r) => r.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step B3.2: Rodar testes, esperar falhar**

```bash
npm run test -- tests/unit/colaboradores-queries.test.ts
```

Esperar: falha porque `sortColaboradoresByName` e `filterColaboradoresByAdmissionAfter` não existem.

- [ ] **Step B3.3: Substituir `src/lib/colaboradores/queries.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export interface ColaboradorRow {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
  created_at: string;
  data_admissao: string | null;
  avatar_url: string | null;
}

export interface ColaboradorFilters {
  ativo?: boolean;
  role?: string;
  admissionAfter?: string | null;
}

export function sortColaboradoresByName<T extends Pick<ColaboradorRow, "nome">>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function filterColaboradoresByAdmissionAfter<T extends Pick<ColaboradorRow, "data_admissao">>(
  rows: T[],
  admissionAfter: string | null | undefined,
): T[] {
  if (!admissionAfter) return rows;
  return rows.filter((r) => r.data_admissao !== null && r.data_admissao >= admissionAfter);
}

export async function listColaboradores(filters?: ColaboradorFilters): Promise<ColaboradorRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select(
      "id, nome, email, role, ativo, fixo_mensal, comissao_percent, comissao_primeiro_mes_percent, created_at, data_admissao, avatar_url",
    );

  if (typeof filters?.ativo === "boolean") query = query.eq("ativo", filters.ativo);
  if (filters?.role) {
    query = query.eq(
      "role",
      filters.role as
        | "adm"
        | "socio"
        | "comercial"
        | "coordenador"
        | "assessor"
        | "videomaker"
        | "designer"
        | "editor"
        | "audiovisual_chefe",
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  let rows = (data ?? []) as ColaboradorRow[];
  rows = sortColaboradoresByName(rows);
  rows = filterColaboradoresByAdmissionAfter(rows, filters?.admissionAfter);
  return rows;
}

export async function getColaboradorById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step B3.4: Rodar testes, esperar passar**

```bash
npm run test -- tests/unit/colaboradores-queries.test.ts
npm run typecheck
```

Esperar: 6/6 testes passam, typecheck OK.

- [ ] **Step B3.5: Commit**

```bash
git add src/lib/colaboradores/queries.ts tests/unit/colaboradores-queries.test.ts
git commit -m "refactor(colaboradores): add admission filter and avatar_url; export pure helpers"
```

---

### Task B4: Server action `uploadAvatarAction`

**Files:**
- Create: `src/lib/colaboradores/avatar-actions.ts`

- [ ] **Step B4.1: Criar arquivo**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function uploadAvatarAction(
  targetUserId: string,
  formData: FormData,
): Promise<{ error: string } | { success: true; avatarUrl: string }> {
  const actor = await requireAuth();

  const canEdit = actor.id === targetUserId || canAccess(actor.role, "edit:colaboradores");
  if (!canEdit) return { error: "Sem permissão" };

  const file = formData.get("avatar");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!ALLOWED.includes(file.type)) return { error: "Apenas JPEG, PNG ou WebP" };
  if (file.size > MAX_BYTES) return { error: "Máximo 2MB" };
  if (file.size === 0) return { error: "Arquivo vazio" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${targetUserId}/avatar.${ext}`;
  const admin = createServiceRoleClient();

  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadErr) return { error: uploadErr.message };

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(path);
  const urlWithBust = `${publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ avatar_url: urlWithBust })
    .eq("id", targetUserId);
  if (updateErr) return { error: updateErr.message };

  await logAudit({
    entidade: "profiles",
    entidade_id: targetUserId,
    acao: "update",
    dados_depois: { avatar_url: urlWithBust },
    ator_id: actor.id,
  });

  revalidatePath(`/colaboradores/${targetUserId}`);
  revalidatePath("/colaboradores");
  return { success: true, avatarUrl: urlWithBust };
}
```

- [ ] **Step B4.2: Typecheck**

```bash
npm run typecheck
```

Esperar: clean.

- [ ] **Step B4.3: Commit**

```bash
git add src/lib/colaboradores/avatar-actions.ts
git commit -m "feat(colaboradores): server action for avatar upload to Supabase Storage"
```

---

## Bloco C — UI

### Task C1: `<ColaboradoresFilters>` + refactor `/colaboradores/page.tsx`

**Files:**
- Create: `src/components/colaboradores/ColaboradoresFilters.tsx`
- Modify: `src/app/(authed)/colaboradores/page.tsx`

- [ ] **Step C1.1: Criar `ColaboradoresFilters.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const ROLE_OPTIONS = [
  { value: "qualquer", label: "Todos" },
  { value: "socio", label: "Sócio" },
  { value: "adm", label: "ADM" },
  { value: "comercial", label: "Comercial" },
  { value: "coordenador", label: "Coordenador" },
  { value: "assessor", label: "Assessor" },
  { value: "audiovisual_chefe", label: "Audiovisual Chefe" },
  { value: "videomaker", label: "Videomaker" },
  { value: "designer", label: "Designer" },
  { value: "editor", label: "Editor" },
];

export function ColaboradoresFilters() {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString());
    if (!value || value === "qualquer") sp.delete(key);
    else sp.set(key, value);
    router.push(`/colaboradores?${sp.toString()}`);
  }

  const role = params.get("role") ?? "qualquer";
  const status = params.get("status") ?? "ativos";
  const admissao = params.get("admissao") ?? "qualquer";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      <div className="space-y-1">
        <Label className="text-[11px]">Papel</Label>
        <Select value={role} onValueChange={(v) => setParam("role", v as string)}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Status</Label>
        <Select value={status} onValueChange={(v) => setParam("status", v as string)}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">Admissão</Label>
        <Select value={admissao} onValueChange={(v) => setParam("admissao", v as string)}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="qualquer">Qualquer</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="12m">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

- [ ] **Step C1.2: Refatorar `src/app/(authed)/colaboradores/page.tsx`**

```tsx
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { listColaboradores } from "@/lib/colaboradores/queries";
import { ColaboradoresTable } from "@/components/colaboradores/ColaboradoresTable";
import { ColaboradoresFilters } from "@/components/colaboradores/ColaboradoresFilters";
import { Plus } from "lucide-react";

interface SearchParams {
  role?: string;
  status?: string;
  admissao?: string;
}

function admissionAfterFromKey(key: string | undefined): string | null {
  const today = new Date();
  if (key === "30d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }
  if (key === "90d") {
    const d = new Date(today);
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  }
  if (key === "12m") {
    const d = new Date(today);
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export default async function ColaboradoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const user = await requireAuth();
  const canManage = canAccess(user.role, "manage:users");
  const canSeeFinance = canAccess(user.role, "view:other_commissions");

  const status = params.status ?? "ativos";
  const ativo = status === "todos" ? undefined : status === "inativos" ? false : true;
  const role = params.role && params.role !== "qualquer" ? params.role : undefined;
  const admissionAfter = admissionAfterFromKey(params.admissao);

  const rows = await listColaboradores({ ativo, role, admissionAfter });

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">{rows.length} resultado(s)</p>
        </div>
        {canManage && (
          <Link
            href="/colaboradores/novo"
            className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-primary text-primary-foreground text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-primary/80 h-8 gap-1.5 px-2.5"
          >
            <Plus className="h-4 w-4" />
            Novo colaborador
          </Link>
        )}
      </header>

      <ColaboradoresFilters />

      <div className="rounded-xl border bg-card">
        <ColaboradoresTable rows={rows} canSeeFinance={canSeeFinance} />
      </div>
    </div>
  );
}
```

- [ ] **Step C1.3: Typecheck**

```bash
npm run typecheck
```

Esperar: pode falhar em `ColaboradoresTable` porque o tipo de `rows` mudou (agora inclui `data_admissao` e `avatar_url`). Será resolvido na Task C2.

Se a falha for **só** em `ColaboradoresTable.tsx`, prosseguir.

- [ ] **Step C1.4: Commit**

```bash
git add src/components/colaboradores/ColaboradoresFilters.tsx "src/app/(authed)/colaboradores/page.tsx"
git commit -m "feat(colaboradores): rich filters (role, status, admissao) on list page"
```

---

### Task C2: Refatorar `<ColaboradoresTable>` (avatar + admissão)

**Files:**
- Modify: `src/components/colaboradores/ColaboradoresTable.tsx`

- [ ] **Step C2.1: Substituir conteúdo inteiro**

```tsx
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Row {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  fixo_mensal: number;
  comissao_percent: number;
  comissao_primeiro_mes_percent: number;
  data_admissao: string | null;
  avatar_url: string | null;
}

const roleLabels: Record<string, string> = {
  adm: "ADM",
  socio: "Sócio",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Audiovisual Chefe",
};

const PRODUCERS = new Set(["videomaker", "designer", "editor"]);

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ url, nome }: { url: string | null; nome: string }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={nome}
        width={32}
        height={32}
        className="h-8 w-8 rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
      {initials(nome)}
    </div>
  );
}

function commissionLabel(role: string, comissao: number, comissao1Mes: number): string {
  if (PRODUCERS.has(role)) return "—";
  if (role === "comercial") return `${comissao1Mes}%`;
  return `${comissao}%`;
}

export function ColaboradoresTable({ rows, canSeeFinance }: { rows: Row[]; canSeeFinance: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"></TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Papel</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Admissão</TableHead>
          <TableHead>Status</TableHead>
          {canSeeFinance && <TableHead className="text-right">Fixo</TableHead>}
          {canSeeFinance && <TableHead className="text-right">% Comissão</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} className="hover:bg-muted/40">
            <TableCell>
              <Avatar url={r.avatar_url} nome={r.nome} />
            </TableCell>
            <TableCell className="font-medium">
              <Link href={`/colaboradores/${r.id}`} className="hover:underline">
                {r.nome}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{roleLabels[r.role] ?? r.role}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.data_admissao ? new Date(r.data_admissao).toLocaleDateString("pt-BR") : "—"}
            </TableCell>
            <TableCell>
              {r.ativo ? (
                <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Inativo
                </Badge>
              )}
            </TableCell>
            {canSeeFinance && (
              <TableCell className="text-right tabular-nums">
                {Number(r.fixo_mensal).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </TableCell>
            )}
            {canSeeFinance && (
              <TableCell className="text-right tabular-nums">
                {commissionLabel(r.role, Number(r.comissao_percent), Number(r.comissao_primeiro_mes_percent))}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step C2.2: Typecheck**

```bash
npm run typecheck
```

Esperar: clean.

- [ ] **Step C2.3: Commit**

```bash
git add src/components/colaboradores/ColaboradoresTable.tsx
git commit -m "feat(colaboradores): table with avatar column, admission date, producer dash"
```

---

### Task C3: `<AvatarUpload>` + integração nas páginas

**Files:**
- Create: `src/components/colaboradores/AvatarUpload.tsx`
- Modify: `src/app/(authed)/colaboradores/[id]/page.tsx`
- Modify: `src/app/(authed)/colaboradores/[id]/editar/page.tsx`

- [ ] **Step C3.1: Criar `AvatarUpload.tsx`**

```tsx
"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { uploadAvatarAction } from "@/lib/colaboradores/avatar-actions";

const MAX_BYTES = 2 * 1024 * 1024;

interface Props {
  userId: string;
  nome: string;
  currentUrl: string | null;
}

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AvatarUpload({ userId, nome, currentUrl }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      setError("Máximo 2MB");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Apenas JPEG, PNG ou WebP");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);

    const fd = new FormData();
    fd.set("avatar", file);

    startTransition(async () => {
      const result = await uploadAvatarAction(userId, fd);
      URL.revokeObjectURL(localPreview);
      if ("error" in result) {
        setError(result.error);
        setPreviewUrl(currentUrl);
        return;
      }
      setPreviewUrl(result.avatarUrl);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4">
      {previewUrl ? (
        <Image
          src={previewUrl}
          alt={nome}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full object-cover"
          unoptimized
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-muted-foreground">
          {initials(nome)}
        </div>
      )}
      <div className="space-y-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onPick}
          disabled={pending}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
        >
          <Upload className="mr-2 h-4 w-4" />
          {pending ? "Enviando..." : "Trocar foto"}
        </Button>
        <p className="text-[11px] text-muted-foreground">JPEG, PNG ou WebP. Máximo 2MB.</p>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step C3.2: Atualizar `src/app/(authed)/colaboradores/[id]/page.tsx`**

Substituir conteúdo inteiro:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getColaboradorById } from "@/lib/colaboradores/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";

const roleLabels: Record<string, string> = {
  adm: "ADM",
  socio: "Sócio",
  comercial: "Comercial",
  coordenador: "Coordenador",
  assessor: "Assessor",
  videomaker: "Videomaker",
  designer: "Designer",
  editor: "Editor",
  audiovisual_chefe: "Audiovisual Chefe",
};

function initials(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function ColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const canEdit = canAccess(user.role, "edit:colaboradores");
  const canSeeFinance = canAccess(user.role, "view:other_commissions") || user.id === id;

  let colab;
  try {
    colab = await getColaboradorById(id);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {colab.avatar_url ? (
            <Image
              src={colab.avatar_url}
              alt={colab.nome}
              width={96}
              height={96}
              className="h-24 w-24 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-2xl font-semibold text-muted-foreground">
              {initials(colab.nome)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{colab.nome}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="secondary">{roleLabels[colab.role] ?? colab.role}</Badge>
              {colab.ativo ? (
                <Badge variant="outline" className="border-green-500/40 text-green-600 dark:text-green-400">
                  Ativo
                </Badge>
              ) : (
                <Badge variant="outline">Inativo</Badge>
              )}
            </div>
          </div>
        </div>
        {canEdit && (
          <Link
            href={`/colaboradores/${id}/editar`}
            className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-background text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground h-8 gap-1.5 px-2.5"
          >
            <Pencil className="h-4 w-4" />
            Editar
          </Link>
        )}
      </header>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Dados pessoais</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <Field label="Email" value={colab.email} />
          <Field label="Telefone" value={colab.telefone} />
          <Field label="Endereço" value={colab.endereco} className="md:col-span-2" />
          <Field
            label="Data de nascimento"
            value={colab.data_nascimento ? new Date(colab.data_nascimento).toLocaleDateString("pt-BR") : null}
          />
          <Field
            label="Data de admissão"
            value={colab.data_admissao ? new Date(colab.data_admissao).toLocaleDateString("pt-BR") : null}
          />
        </dl>
      </Card>

      {canSeeFinance && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Dados financeiros</h2>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <Field label="Pix" value={colab.pix} />
            <Field
              label="Fixo mensal"
              value={Number(colab.fixo_mensal).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            />
            <Field label="% Comissão (assessor/coord)" value={`${colab.comissao_percent}%`} />
            <Field label="% Comissão 1º mês (comercial)" value={`${colab.comissao_primeiro_mes_percent}%`} />
          </dl>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
```

- [ ] **Step C3.3: Atualizar `src/app/(authed)/colaboradores/[id]/editar/page.tsx`**

Adicionar `<AvatarUpload>` no topo da página. Substituir conteúdo inteiro:

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getColaboradorById } from "@/lib/colaboradores/queries";
import { ColaboradorForm } from "@/components/colaboradores/ColaboradorForm";
import { AvatarUpload } from "@/components/colaboradores/AvatarUpload";
import { Card } from "@/components/ui/card";

export default async function EditarColaboradorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (!canAccess(user.role, "edit:colaboradores") && user.id !== id) {
    notFound();
  }

  let colab;
  try {
    colab = await getColaboradorById(id);
  } catch {
    notFound();
  }

  const canEditFinance = user.role === "socio";
  const canEditRole = user.role === "socio";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Editar colaborador</h1>
      </header>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Foto</h2>
        <AvatarUpload userId={colab.id} nome={colab.nome} currentUrl={colab.avatar_url} />
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">Dados</h2>
        <ColaboradorForm
          data={{
            id: colab.id,
            nome: colab.nome,
            telefone: colab.telefone,
            endereco: colab.endereco,
            pix: colab.pix,
            data_nascimento: colab.data_nascimento,
            data_admissao: colab.data_admissao,
            fixo_mensal: colab.fixo_mensal,
            comissao_percent: colab.comissao_percent,
            comissao_primeiro_mes_percent: colab.comissao_primeiro_mes_percent,
            role: colab.role,
            ativo: colab.ativo,
          }}
          canEditFinance={canEditFinance}
          canEditRole={canEditRole}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step C3.4: Adicionar domínio do Supabase no `next.config.ts`**

`next/image` requer hosts permitidos. O Supabase Storage usa um domínio público; vamos liberar `*.supabase.co`.

Read first: `cat next.config.ts`

Atualizar pra incluir `images.remotePatterns`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
```

(Se o config atual já tiver outras opções, **mesclar** com as existentes — não substituir.)

- [ ] **Step C3.5: Typecheck e tests**

```bash
npm run typecheck
npm run test
```

Esperar: typecheck OK, tests verdes.

- [ ] **Step C3.6: Commit**

```bash
git add src/components/colaboradores/AvatarUpload.tsx \
  "src/app/(authed)/colaboradores/[id]/page.tsx" \
  "src/app/(authed)/colaboradores/[id]/editar/page.tsx" \
  next.config.ts
git commit -m "feat(colaboradores): avatar upload + display on detail and edit pages"
```

---

### Task C4: 9 roles em `<ColaboradorForm>` e `<ConviteForm>`

**Files:**
- Modify: `src/components/colaboradores/ColaboradorForm.tsx`
- Modify: `src/components/colaboradores/ConviteForm.tsx`
- Modify: `src/app/(authed)/colaboradores/novo/page.tsx`

- [ ] **Step C4.1: Atualizar `<ColaboradorForm>` (adicionar 4 SelectItem + aviso produtor)**

Read: `cat src/components/colaboradores/ColaboradorForm.tsx`

Substituir o bloco do `<Select name="role">` (atualmente com 5 itens) por:

```tsx
        <div className="space-y-2">
          <Label htmlFor="role">Papel</Label>
          <Select name="role" defaultValue={data.role} disabled={!canEditRole}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="adm">ADM</SelectItem>
              <SelectItem value="socio">Sócio</SelectItem>
              <SelectItem value="comercial">Comercial</SelectItem>
              <SelectItem value="coordenador">Coordenador</SelectItem>
              <SelectItem value="assessor">Assessor</SelectItem>
              <SelectItem value="audiovisual_chefe">Audiovisual Chefe</SelectItem>
              <SelectItem value="videomaker">Videomaker</SelectItem>
              <SelectItem value="designer">Designer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
            </SelectContent>
          </Select>
        </div>
```

E **logo abaixo dos campos de comissão** (depois do `comissao_primeiro_mes_percent`), adicionar o aviso quando role atual é produtor:

```tsx
        {(data.role === "videomaker" || data.role === "designer" || data.role === "editor") && (
          <p className="md:col-span-2 text-xs text-muted-foreground">
            Produtores audiovisuais (videomaker / designer / editor) recebem apenas fixo —
            os campos de % de comissão são zerados automaticamente ao salvar.
          </p>
        )}
```

- [ ] **Step C4.2: Atualizar `<ConviteForm>` (adicionar os 4 roles + aviso)**

Read: `cat src/components/colaboradores/ConviteForm.tsx`

Localizar o `<Select name="role">` e atualizar para os 9 itens (mesma lista da Task C4.1).

Adicionar aviso similar quando role selecionado no client é produtor — o `<ConviteForm>` provavelmente é client component; usar `useState` pra ler valor atual e renderizar nota condicional. Se for server component, exibir nota estática genérica.

(Se a estrutura atual não permitir client state, simplesmente adicionar uma nota genérica abaixo do form: "Produtores audiovisuais recebem apenas fixo. % de comissão será zerado automaticamente.")

- [ ] **Step C4.3: Verificar `/colaboradores/novo/page.tsx`**

Read: `cat "src/app/(authed)/colaboradores/novo/page.tsx"`

Não deve precisar mudar — apenas renderiza `<ConviteForm>`. Se não passa props relacionadas a role, segue como está.

- [ ] **Step C4.4: Typecheck e tests**

```bash
npm run typecheck
npm run test
```

Esperar: clean.

- [ ] **Step C4.5: Commit**

```bash
git add src/components/colaboradores/ColaboradorForm.tsx \
  src/components/colaboradores/ConviteForm.tsx
git commit -m "feat(colaboradores): 9 roles in form and invite UI with producer notice"
```

---

### Task C5: Auditoria — guard `view:client_money_all` nas telas de cliente

**Files (auditoria, mexer só onde precisa):**
- Audit: `src/app/(authed)/clientes/page.tsx`
- Audit: `src/app/(authed)/clientes/[id]/page.tsx`
- Audit: `src/app/(authed)/clientes/[id]/editar/page.tsx`
- Audit: `src/components/clientes/ClientesTable.tsx`

- [ ] **Step C5.1: Verificar `/clientes/page.tsx`**

Read: `cat "src/app/(authed)/clientes/page.tsx"`

Confirmar que existe variável `canSeeMoney` baseada em `canAccess(user.role, "view:client_money_all")` passada para `<ClientesTable canSeeMoney={canSeeMoney} />`. Se a variável existe mas usa permissão errada (ex: `view:financial_consolidated`), corrigir para `view:client_money_all`.

Se não existir, adicionar:

```tsx
const canSeeMoney = canAccess(user.role, "view:client_money_all");
```

E passar como prop para `<ClientesTable>`.

- [ ] **Step C5.2: Verificar `/clientes/[id]/page.tsx`**

Read: `cat "src/app/(authed)/clientes/[id]/page.tsx"`

Verificar se exibe `valor_mensal` ou outras cifras. Se sim, envolver com check `canAccess(user.role, "view:client_money_all")`. Se a página atual é só "visão geral" sem R$ (apenas notas, datas, tarefas), nada a mudar.

- [ ] **Step C5.3: Verificar `/clientes/[id]/editar/page.tsx`**

Read: `cat "src/app/(authed)/clientes/[id]/editar/page.tsx"`

Se permite edição de `valor_mensal`, bloquear o campo (disabled) ou esconder se `!canAccess(user.role, "view:client_money_all")`.

Se a página inteira já é restrita a quem tem `edit:clients` (que só sócio/adm têm), pode estar OK — mas garantir que produtores nunca chegam aqui (route guard) ou que campo de valor está oculto se chegarem.

- [ ] **Step C5.4: Typecheck e tests**

```bash
npm run typecheck
npm run test
```

- [ ] **Step C5.5: Commit (apenas se houve mudança)**

```bash
git add "src/app/(authed)/clientes/" src/components/clientes/
git commit -m "fix(clientes): tighten money visibility to view:client_money_all"
```

Se não houve mudança (todas as telas já usavam a permissão correta), pular este commit e adicionar nota no commit final D1.

---

## Bloco D — Tests E2E + push final

### Task D1: Tests e2e + push

**Files:**
- Create: `tests/e2e/colaboradores.spec.ts`

- [ ] **Step D1.1: Criar test**

```ts
import { test, expect } from "@playwright/test";

test("rota /colaboradores redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/colaboradores");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /colaboradores/novo redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/colaboradores/novo");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /colaboradores/[id] redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/colaboradores/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login/);
});

test("rota /colaboradores/[id]/editar redireciona para login quando não autenticado", async ({ page }) => {
  await page.goto("/colaboradores/00000000-0000-0000-0000-000000000000/editar");
  await expect(page).toHaveURL(/\/login/);
});
```

- [ ] **Step D1.2: Rodar tests + typecheck**

```bash
npm run test
npm run typecheck
```

Esperar: vitest 64+11+6 = 81 tests passam (10 schema + 8 queries + 2 trigger + 11 colaboradores-schema + 6 colaboradores-queries + 44 outros). Typecheck clean.

(Não rodar `npm run build` — falha em env vars locais; confiar no Vercel.)

- [ ] **Step D1.3: Commit**

```bash
git add tests/e2e/colaboradores.spec.ts
git commit -m "test(e2e): colaboradores auth-redirect tests"
```

- [ ] **Step D1.4: Push e abrir PR**

```bash
cd "/Users/yasminmonteiro/Documents/Sistema Acompanhamento/.claude/worktrees/frosty-jang-a815ff"
git push origin claude/frosty-jang-a815ff
```

```bash
/opt/homebrew/bin/gh pr create --base main --head claude/frosty-jang-a815ff \
  --title "feat: Fase 5 — Colaboradores (filtros, avatar, 4 papéis novos audiovisuais)" \
  --body "Implementa Fase 5 conforme spec docs/superpowers/specs/2026-04-27-fase-5-colaboradores-design.md"
```

- [ ] **Step D1.5: Verificar Production deploy depois do merge**

Após mergear o PR, verificar build:

```bash
/opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments --jq '.[0].id' \
  | xargs -I {} /opt/homebrew/bin/gh api repos/time-yide/yide-acompanha/deployments/{}/statuses
```

Esperar: `success`. Se falhar, ler logs com `npx vercel inspect <dpl_id> --logs`.

---

## Self-Review

### Cobertura do spec — seção 5.11 + extensão

| Spec | Coberto por |
|---|---|
| Página acessível pra Sócio/ADM | Já existe (`manage:users`) — preservado |
| Lista com filtros: papel, status, data admissão | Task C1 (`<ColaboradoresFilters>`) |
| Cadastro/edição com todos os campos | Já existe; Task C3 adiciona avatar |
| % comissão read-only para todos exceto sócio | Já existe |
| Avatar | Tasks A2 (bucket) + B4 (action) + C3 (`<AvatarUpload>`) |
| Aniversário gera evento no calendário | **Já funciona desde Fase 3** (read-time) |
| Notificação 3d antes do aniversário | **Fase 6** |
| 4 papéis novos (videomaker/designer/editor/audiovisual_chefe) | Tasks A1 (enum) + B1 (matriz) + B2 (schema) + C2/C4 (UI) |
| Produtores ocultam R$ dos clientes | Task C5 (auditoria) + matriz B1 |
| Audiovisual Chefe vê R$ + tem % | B1 (`view:client_money_all` na matriz) |

### Lacunas conhecidas (intencionais)

- Notificação 3 dias antes do aniversário → Fase 6 (cron)
- Cálculo de comissão do Audiovisual Chefe → Fase 7 (Comissões)
- Bulk import / bulk deactivate / exportar CSV → futuro
- Crop / resize de avatar → v2

---

## Resumo da entrega

Após executar:

- 4 papéis novos (videomaker, designer, editor, audiovisual_chefe) no enum `user_role` + matriz de permissões
- Produtores: só fixo; schema transform força `% = 0` mesmo se form enviar > 0
- Audiovisual Chefe: vê R$ + tem `comissao_percent` (modelo de cálculo virá na Fase 7)
- Lista de colaboradores com filtros: papel (10 opções), status (3 opções), admissão (4 opções)
- Tabela com avatar (32px, fallback iniciais), data de admissão, badge "—" pra % de produtor
- Avatar grande (96px) na página de detalhe + componente de upload na edição (Supabase Storage, max 2MB, JPEG/PNG/WebP, audit log)
- Telas de cliente auditadas: produtores nunca veem R$
- Tests: schema (11 cases), queries (6 cases), e2e (4 rotas)

Total: **~12 commits** (A1, A2, A3, B1, B2, B3, B4, C1, C2, C3, C4, C5 condicional, D1).
