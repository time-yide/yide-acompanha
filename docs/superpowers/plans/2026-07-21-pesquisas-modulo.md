# Módulo Pesquisas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo `/pesquisas` onde adm/sócio/coordenadores criam pesquisas internas (formulário com tipos variados), disparam pro time (público escolhido na hora, prazo opcional), o time responde no sistema, e o criador acompanha resultados ao vivo.

**Architecture:** Segue os padrões do repo — server actions em `src/lib/pesquisas/`, páginas em `src/app/(authed)/pesquisas/`, queries cacheadas com `unstable_cache` + `revalidateTag("pesquisas")`, permissões em `permissions.ts`, notificações via `dispatchNotification`. 4 tabelas novas + 1 migration manual (Vercel não roda migration no deploy).

**Tech Stack:** Next.js (App Router, este fork custom — ler `node_modules/next/dist/docs/` se necessário), Supabase (Postgres + RLS), Zod, TypeScript, Tailwind, shadcn/ui, vitest.

**Spec:** `docs/superpowers/specs/2026-07-21-pesquisas-design.md`

---

## File Structure

**Criar:**
- `supabase/migrations/20260721000000_pesquisas.sql` — schema + RLS
- `src/lib/pesquisas/schema.ts` — tipos, enums, Zod schemas, constantes
- `src/lib/pesquisas/schema.test.ts` — testes das validações puras
- `src/lib/pesquisas/aggregate.ts` — agregação de respostas (pura, testável)
- `src/lib/pesquisas/aggregate.test.ts`
- `src/lib/pesquisas/queries.ts` — leituras (lista, detalhe, resultados, pendentes)
- `src/lib/pesquisas/actions.ts` — mutations (criar/editar/disparar/responder/encerrar)
- `src/app/(authed)/pesquisas/page.tsx` — lista (abas Minhas / Responder)
- `src/app/(authed)/pesquisas/nova/page.tsx` — construtor (novo rascunho)
- `src/app/(authed)/pesquisas/[id]/page.tsx` — resultados
- `src/app/(authed)/pesquisas/[id]/editar/page.tsx` — editar rascunho
- `src/app/(authed)/pesquisas/[id]/responder/page.tsx` — responder
- `src/components/pesquisas/PesquisaBuilder.tsx` — builder de perguntas (client)
- `src/components/pesquisas/DispararModal.tsx` — modal de disparo (client)
- `src/components/pesquisas/ResponderForm.tsx` — form de resposta (client)
- `src/components/pesquisas/ResultadosView.tsx` — agregado por pergunta (client)
- `src/components/pesquisas/PesquisaCard.tsx` — card na lista

**Modificar:**
- `src/lib/auth/permissions.ts` — Action `manage:pesquisas` + grants
- `src/components/layout/nav-config.ts` — item "Pesquisas"
- `src/lib/notificacoes/` — evento `pesquisa_disparada` (localizar arquivo de tipos)

---

## Task 1: Migration (schema + RLS)

**Files:**
- Create: `supabase/migrations/20260721000000_pesquisas.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Módulo Pesquisas: pesquisas internas com o time.
-- Enums
create type public.pesquisa_status as enum ('rascunho', 'aberta', 'encerrada');
create type public.pesquisa_pergunta_tipo as enum ('multipla_escolha', 'escala', 'sim_nao', 'texto');

-- Tabela principal
create table public.pesquisas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  titulo text not null,
  descricao text,
  anonima boolean not null default false,
  status public.pesquisa_status not null default 'rascunho',
  criado_por uuid references public.profiles(id),
  disparada_em timestamptz,
  prazo timestamptz,
  encerrada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index pesquisas_status_idx on public.pesquisas(status) where deleted_at is null;
create index pesquisas_criado_por_idx on public.pesquisas(criado_por);

-- Perguntas
create table public.pesquisa_perguntas (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisas(id) on delete cascade,
  ordem int not null,
  tipo public.pesquisa_pergunta_tipo not null,
  enunciado text not null,
  opcoes jsonb,
  escala_min int,
  escala_max int,
  obrigatoria boolean not null default true
);
create index pesquisa_perguntas_pesquisa_idx on public.pesquisa_perguntas(pesquisa_id);

-- Destinatários (quem foi alvo + se respondeu)
create table public.pesquisa_destinatarios (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisas(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  respondeu_em timestamptz,
  unique (pesquisa_id, user_id)
);
create index pesquisa_destinatarios_user_idx on public.pesquisa_destinatarios(user_id);

-- Respostas (user_id null quando anônima)
create table public.pesquisa_respostas (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references public.pesquisas(id) on delete cascade,
  pergunta_id uuid not null references public.pesquisa_perguntas(id) on delete cascade,
  user_id uuid references public.profiles(id),
  valor jsonb not null,
  created_at timestamptz not null default now()
);
create index pesquisa_respostas_pesquisa_idx on public.pesquisa_respostas(pesquisa_id);
create index pesquisa_respostas_pergunta_idx on public.pesquisa_respostas(pergunta_id);

-- RLS
alter table public.pesquisas enable row level security;
alter table public.pesquisa_perguntas enable row level security;
alter table public.pesquisa_destinatarios enable row level security;
alter table public.pesquisa_respostas enable row level security;

-- Leitura permissiva pra authenticated (as queries do módulo já rodam via
-- service-role dentro do unstable_cache; RLS aqui espelha o padrão do repo de
-- `using (true)` pra authenticated em recursos internos).
create policy pesquisas_read on public.pesquisas for select to authenticated using (true);
create policy perguntas_read on public.pesquisa_perguntas for select to authenticated using (true);
create policy destinatarios_read on public.pesquisa_destinatarios for select to authenticated using (true);
create policy respostas_read on public.pesquisa_respostas for select to authenticated using (true);

-- Escrita das respostas: o próprio destinatário. (Demais mutations rodam
-- via service-role nas server actions, com checagem de permissão no código.)
create policy respostas_insert on public.pesquisa_respostas for insert to authenticated
  with check (auth.uid() = user_id or user_id is null);
```

- [ ] **Step 2: Aplicar manualmente**

Migration é manual (memory do projeto). Após o merge do PR, aplicar via Supabase SQL Editor. Anotar no PR: "Migration manual: 20260721000000_pesquisas.sql".

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260721000000_pesquisas.sql
git commit -m "feat(pesquisas): migration (4 tabelas + enums + RLS)"
```

---

## Task 2: Schema, tipos e constantes

**Files:**
- Create: `src/lib/pesquisas/schema.ts`
- Test: `src/lib/pesquisas/schema.test.ts`

- [ ] **Step 1: Escrever os testes das validações**

```ts
import { describe, it, expect } from "vitest";
import { createPesquisaSchema, perguntaSchema, respostaValorSchema } from "./schema";

describe("createPesquisaSchema", () => {
  it("aceita título válido", () => {
    expect(createPesquisaSchema.safeParse({ titulo: "Clima", anonima: false }).success).toBe(true);
  });
  it("rejeita título curto", () => {
    expect(createPesquisaSchema.safeParse({ titulo: "", anonima: false }).success).toBe(false);
  });
});

describe("perguntaSchema", () => {
  it("múltipla escolha exige >=2 opções", () => {
    expect(perguntaSchema.safeParse({ tipo: "multipla_escolha", enunciado: "Q", opcoes: ["a"] }).success).toBe(false);
    expect(perguntaSchema.safeParse({ tipo: "multipla_escolha", enunciado: "Q", opcoes: ["a", "b"] }).success).toBe(true);
  });
  it("texto não precisa de opções", () => {
    expect(perguntaSchema.safeParse({ tipo: "texto", enunciado: "Comente" }).success).toBe(true);
  });
});

describe("respostaValorSchema", () => {
  it("valida nota dentro da escala", () => {
    expect(respostaValorSchema("escala").safeParse({ nota: 3 }).success).toBe(true);
    expect(respostaValorSchema("texto").safeParse({ texto: "oi" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/pesquisas/schema.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `schema.ts`**

```ts
import { z } from "zod";

export const PESQUISA_STATUS = ["rascunho", "aberta", "encerrada"] as const;
export type PesquisaStatus = (typeof PESQUISA_STATUS)[number];

export const PERGUNTA_TIPOS = ["multipla_escolha", "escala", "sim_nao", "texto"] as const;
export type PerguntaTipo = (typeof PERGUNTA_TIPOS)[number];

export const PERGUNTA_TIPO_LABEL: Record<PerguntaTipo, string> = {
  multipla_escolha: "Múltipla escolha",
  escala: "Escala / nota",
  sim_nao: "Sim / Não",
  texto: "Texto aberto",
};

export const createPesquisaSchema = z.object({
  titulo: z.string().min(2, "Título muito curto"),
  descricao: z.string().optional().nullable(),
  anonima: z.coerce.boolean().default(false),
});

export const perguntaSchema = z
  .object({
    tipo: z.enum(PERGUNTA_TIPOS),
    enunciado: z.string().min(1, "Escreva a pergunta"),
    opcoes: z.array(z.string().min(1)).optional(),
    escala_min: z.coerce.number().int().optional(),
    escala_max: z.coerce.number().int().optional(),
    obrigatoria: z.coerce.boolean().default(true),
  })
  .refine((p) => p.tipo !== "multipla_escolha" || (p.opcoes?.length ?? 0) >= 2, {
    message: "Múltipla escolha precisa de ao menos 2 opções",
    path: ["opcoes"],
  });

export function respostaValorSchema(tipo: PerguntaTipo) {
  switch (tipo) {
    case "multipla_escolha": return z.object({ escolha: z.string().min(1) });
    case "escala": return z.object({ nota: z.coerce.number().int() });
    case "sim_nao": return z.object({ sim_nao: z.coerce.boolean() });
    case "texto": return z.object({ texto: z.string().min(1) });
  }
}

export interface PesquisaRow {
  id: string; titulo: string; descricao: string | null; anonima: boolean;
  status: PesquisaStatus; criado_por: string | null; disparada_em: string | null;
  prazo: string | null; encerrada_em: string | null; created_at: string;
}
export interface PerguntaRow {
  id: string; pesquisa_id: string; ordem: number; tipo: PerguntaTipo;
  enunciado: string; opcoes: string[] | null; escala_min: number | null;
  escala_max: number | null; obrigatoria: boolean;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/pesquisas/schema.test.ts` → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pesquisas/schema.ts src/lib/pesquisas/schema.test.ts
git commit -m "feat(pesquisas): schema, tipos e validações Zod"
```

---

## Task 3: Permissão `manage:pesquisas`

**Files:**
- Modify: `src/lib/auth/permissions.ts`

- [ ] **Step 1: Adicionar a Action ao union** (perto de `manage:trafego_relatorios`)

```ts
  | "manage:pesquisas"
```

- [ ] **Step 2: Conceder nos arrays** de `socio`, `adm`, `coordenador`, `audiovisual_chefe` — adicionar `"manage:pesquisas",` em cada.

- [ ] **Step 3: Verificar tipos**

Run: `npm run typecheck` → sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/permissions.ts
git commit -m "feat(pesquisas): permissão manage:pesquisas (adm/sócio/coord/coord-av)"
```

---

## Task 4: Agregação de respostas (pura)

**Files:**
- Create: `src/lib/pesquisas/aggregate.ts`
- Test: `src/lib/pesquisas/aggregate.test.ts`

- [ ] **Step 1: Testes**

```ts
import { describe, it, expect } from "vitest";
import { agregarPergunta } from "./aggregate";

describe("agregarPergunta", () => {
  it("conta escolhas de múltipla escolha", () => {
    const r = agregarPergunta(
      { tipo: "multipla_escolha", opcoes: ["A", "B"] },
      [{ escolha: "A" }, { escolha: "A" }, { escolha: "B" }],
    );
    expect(r).toEqual({ tipo: "multipla_escolha", contagem: { A: 2, B: 1 }, total: 3 });
  });
  it("média de escala", () => {
    const r = agregarPergunta({ tipo: "escala" }, [{ nota: 4 }, { nota: 2 }]);
    expect(r).toMatchObject({ tipo: "escala", media: 3, total: 2 });
  });
  it("lista textos", () => {
    const r = agregarPergunta({ tipo: "texto" }, [{ texto: "bom" }]);
    expect(r).toMatchObject({ tipo: "texto", textos: ["bom"], total: 1 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/pesquisas/aggregate.test.ts` → FAIL

- [ ] **Step 3: Implementar `aggregate.ts`**

```ts
import type { PerguntaTipo } from "./schema";

type Valor = Record<string, unknown>;

export function agregarPergunta(
  pergunta: { tipo: PerguntaTipo; opcoes?: string[] | null },
  valores: Valor[],
) {
  const total = valores.length;
  switch (pergunta.tipo) {
    case "multipla_escolha": {
      const contagem: Record<string, number> = {};
      for (const o of pergunta.opcoes ?? []) contagem[o] = 0;
      for (const v of valores) {
        const e = String(v.escolha ?? "");
        contagem[e] = (contagem[e] ?? 0) + 1;
      }
      return { tipo: "multipla_escolha" as const, contagem, total };
    }
    case "escala": {
      const notas = valores.map((v) => Number(v.nota)).filter((n) => !Number.isNaN(n));
      const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : 0;
      return { tipo: "escala" as const, media, total };
    }
    case "sim_nao": {
      let sim = 0, nao = 0;
      for (const v of valores) (v.sim_nao ? sim++ : nao++);
      return { tipo: "sim_nao" as const, sim, nao, total };
    }
    case "texto":
      return { tipo: "texto" as const, textos: valores.map((v) => String(v.texto ?? "")), total };
  }
}
```

- [ ] **Step 4: Rodar e ver passar** → PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/pesquisas/aggregate.ts src/lib/pesquisas/aggregate.test.ts
git commit -m "feat(pesquisas): agregação de respostas (pura, testada)"
```

---

## Task 5: Queries (leituras)

**Files:**
- Create: `src/lib/pesquisas/queries.ts`

Espelhar o padrão de `src/lib/tarefas/queries.ts` (service-role dentro de `unstable_cache`, tag `pesquisas`).

- [ ] **Step 1: Implementar** as funções (usar `createServiceRoleClient`, cast `any` no client como o resto do repo):
  - `listMinhasPesquisas(criadorId)`: pesquisas não-deletadas do criador + contagem de respondentes (join destinatarios) — cacheado tag `pesquisas`.
  - `listPesquisasPendentes(userId)`: pesquisas `aberta` onde o user é destinatário com `respondeu_em is null`. **Fora do cache** (per-usuário, mesmo tratamento de bloqueios do calendário — ver memory `feedback_calendario_dados_per_usuario_fora_do_cache`).
  - `getPesquisaComPerguntas(id)`: pesquisa + perguntas ordenadas.
  - `getResultados(id)`: perguntas + respostas agrupadas (aplica `agregarPergunta`). Se `anonima`, não retornar `user_id` das respostas.
  - `podeResponder(pesquisaId, userId)`: destinatário + status aberta + não respondeu.

- [ ] **Step 2: typecheck** → `npm run typecheck`

- [ ] **Step 3: Commit**

```bash
git add src/lib/pesquisas/queries.ts
git commit -m "feat(pesquisas): queries (lista, pendentes, detalhe, resultados)"
```

---

## Task 6: Notificação `pesquisa_disparada`

**Files:**
- Modify: arquivo de tipos de evento de notificação (localizar com `grep -rn "evento_calendario_marcado\|NotificationEvent" src/lib/notificacoes`)

- [ ] **Step 1: Adicionar** `"pesquisa_disparada"` ao tipo `NotificationEvent` (e à tabela `notification_preferences` se houver seed — senão o `dispatchNotification` já cai no default de enviar).

- [ ] **Step 2: typecheck** → ok

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(pesquisas): evento de notificação pesquisa_disparada"
```

---

## Task 7: Actions (mutations)

**Files:**
- Create: `src/lib/pesquisas/actions.ts`

Espelhar `src/lib/tarefas/actions.ts` (requireAuth, canAccess, service-role, revalidate). Todas as mutations de gestão exigem `canAccess(actor.role, "manage:pesquisas")`.

- [ ] **Step 1: Implementar**:
  - `createPesquisaAction(formData)`: cria rascunho (título/descrição/anônima) → redirect `/pesquisas/[id]/editar`.
  - `updatePesquisaAction(formData)`: edita rascunho (título/descrição/anônima). Bloqueia se status ≠ rascunho.
  - `savePerguntasAction(pesquisaId, perguntas[])`: substitui perguntas do rascunho (delete + insert em ordem). Valida com `perguntaSchema`. Bloqueia se ≠ rascunho.
  - `dispararPesquisaAction(formData)`: recebe público (modo: `todos` | `cargos` | `unidade` | `pessoas` + ids) + prazo opcional. Resolve `user_ids` (query em profiles ativos conforme o filtro), insere `pesquisa_destinatarios`, seta `status='aberta'`, `disparada_em=now`, `prazo`. Dispara `dispatchNotification({ evento_tipo: "pesquisa_disparada", user_ids_extras: userIds, link: '/pesquisas/[id]/responder' })`. Bloqueia se sem perguntas ou já disparada.
  - `responderPesquisaAction(formData)`: valida `podeResponder`; para cada pergunta valida `respostaValorSchema(tipo)`; insere `pesquisa_respostas` (user_id só se **não** anônima); marca `destinatarios.respondeu_em=now`. Idempotente (checa respondeu_em).
  - `encerrarPesquisaAction(id)`: seta `status='encerrada'`, `encerrada_em=now`. Exige `manage:pesquisas`.
  - Todas: `revalidatePath("/pesquisas")` + `revalidateTag("pesquisas")`.

- [ ] **Step 2: typecheck + lint** → ok

- [ ] **Step 3: Commit**

```bash
git add src/lib/pesquisas/actions.ts
git commit -m "feat(pesquisas): actions (criar/editar/perguntas/disparar/responder/encerrar)"
```

---

## Task 8: Nav + gate

**Files:**
- Modify: `src/components/layout/nav-config.ts` e o `isLinkVisible` correspondente (ver memory `feedback_programacao_nav_all_gate`)

- [ ] **Step 1:** Adicionar item `{ href: "/pesquisas", icon: ClipboardList, label: "Pesquisas", roles: [...] , badgeKey: "pesquisas" }`. Roles = quem tem `manage:pesquisas` (adm, socio, coordenador, audiovisual_chefe). Para os demais, liberar via gate especial quando há pendente (espelhar o padrão de whitelist já usado). MVP aceitável: mostrar só pra gestores e os demais acessam via link da notificação.

- [ ] **Step 2:** typecheck. Commit.

```bash
git commit -am "feat(pesquisas): item de navegação"
```

---

## Task 9: Lista `/pesquisas` (abas)

**Files:**
- Create: `src/app/(authed)/pesquisas/page.tsx`, `src/components/pesquisas/PesquisaCard.tsx`

- [ ] **Step 1:** Server component: `requireAuth`; se `canAccess(manage:pesquisas)` mostra aba "Minhas pesquisas" (`listMinhasPesquisas`); sempre mostra aba "Responder" (`listPesquisasPendentes`). Botão "Nova pesquisa" (gate manage). `PesquisaCard` mostra título, status (badge), contagem respondentes/total, link (resultados se gestor / responder se pendente).

- [ ] **Step 2:** typecheck + lint. Commit.

```bash
git commit -am "feat(pesquisas): página de lista com abas"
```

---

## Task 10: Construtor (nova + editar)

**Files:**
- Create: `src/app/(authed)/pesquisas/nova/page.tsx`, `src/app/(authed)/pesquisas/[id]/editar/page.tsx`, `src/components/pesquisas/PesquisaBuilder.tsx`

- [ ] **Step 1:** `nova/page.tsx`: form simples (título, descrição, toggle anônima) → `createPesquisaAction`. Gate `manage:pesquisas`.
- [ ] **Step 2:** `[id]/editar/page.tsx`: carrega rascunho + perguntas, renderiza `PesquisaBuilder`. Redireciona se status ≠ rascunho.
- [ ] **Step 3:** `PesquisaBuilder` (client): lista editável de perguntas (adicionar por tipo, editar enunciado, opções pra múltipla, min/max pra escala, obrigatória, reordenar, remover). Botão "Salvar perguntas" → `savePerguntasAction`. Botão "Disparar" abre `DispararModal`.
- [ ] **Step 4:** typecheck + lint. Commit.

```bash
git commit -am "feat(pesquisas): construtor de pesquisa (perguntas)"
```

---

## Task 11: Disparar (modal)

**Files:**
- Create: `src/components/pesquisas/DispararModal.tsx`

- [ ] **Step 1:** Client modal: seletor de público (radio: Time todo / Cargos / Unidade / Pessoas) com os controles conforme a opção (multi-select de cargos, select de unidade, multi-select de pessoas — reaproveitar options já carregadas na page). Campo de prazo opcional (datetime). Submit → `dispararPesquisaAction`. Passar as listas (cargos/unidades/pessoas) da server page.
- [ ] **Step 2:** typecheck + lint. Commit.

```bash
git commit -am "feat(pesquisas): modal de disparo (público + prazo)"
```

---

## Task 12: Responder

**Files:**
- Create: `src/app/(authed)/pesquisas/[id]/responder/page.tsx`, `src/components/pesquisas/ResponderForm.tsx`

- [ ] **Step 1:** Page: `requireAuth`; se `!podeResponder` mostra mensagem (encerrada / já respondeu / sem acesso). Senão renderiza `ResponderForm` com as perguntas.
- [ ] **Step 2:** `ResponderForm` (client): renderiza cada pergunta pelo tipo (radios pra múltipla, botões/estrelas pra escala, sim/não, textarea). Valida obrigatórias. Submit → `responderPesquisaAction` → tela de "Obrigado".
- [ ] **Step 3:** typecheck + lint. Commit.

```bash
git commit -am "feat(pesquisas): tela de responder"
```

---

## Task 13: Resultados

**Files:**
- Create: `src/app/(authed)/pesquisas/[id]/page.tsx`, `src/components/pesquisas/ResultadosView.tsx`

- [ ] **Step 1:** Page: gate `manage:pesquisas`; `getResultados(id)`. Header com status, progresso (X de N), botão Encerrar (`encerrarPesquisaAction`, se aberta).
- [ ] **Step 2:** `ResultadosView`: por pergunta, renderiza conforme agregação — barras (múltipla/escala/sim-não) e lista de textos. Se identificada, seção "Por pessoa" (quem respondeu o quê). Se anônima, só agregado + aviso "respostas anônimas".
- [ ] **Step 3:** typecheck + lint. Commit.

```bash
git commit -am "feat(pesquisas): tela de resultados ao vivo"
```

---

## Task 14: Fecho por prazo + verificação final

**Files:**
- Modify: `src/lib/pesquisas/queries.ts` (fecho on-read) ou cron existente

- [ ] **Step 1:** No `getResultados`/`listMinhasPesquisas`, se `prazo < now` e status `aberta`, tratar como encerrada (e opcionalmente persistir). MVP: encerrar on-read via update best-effort.
- [ ] **Step 2:** Rodar suíte: `npx vitest run src/lib/pesquisas --exclude '**/.claude/**'` (memory: worktrees geram fails fantasma).
- [ ] **Step 3:** `npm run typecheck` + `npx eslint src/lib/pesquisas src/components/pesquisas 'src/app/(authed)/pesquisas'`.
- [ ] **Step 4:** Commit + abrir PR (nota: migration manual pendente).

```bash
git commit -am "feat(pesquisas): fecho por prazo + ajustes finais"
```

---

## Notas de execução

- **Migration manual**: aplicar `20260721000000_pesquisas.sql` no Supabase SQL Editor após o merge (Vercel não roda migration).
- **Regenerar tipos**: rodar `npm run db:types` depois da migration; enquanto isso, usar cast `any` nos clients (padrão do repo).
- **Cache**: `listPesquisasPendentes` fica FORA do `unstable_cache` (per-usuário).
- **PR**: pode ficar grande — se preferir, quebrar em 2 (backend: tasks 1-8; frontend: 9-14).
