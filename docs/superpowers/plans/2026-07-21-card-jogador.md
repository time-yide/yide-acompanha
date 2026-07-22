# Card do Jogador — Implementation Plan (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perfil estilo game por pessoa (`/perfil/[id]`) + grade do time (`/time`), com username, capa, bio, hobbies, "classe" (temperamento DISC sem números), Sinergia (trabalho + hobbies) e resultados de pesquisas — visível pra todo o time.

**Architecture:** Nova tabela `perfil_jogador` isolada de `profiles`. Escrita via server actions com service-role + checagem no código (padrão do app); RLS de leitura permissiva pra `authenticated`. Lógica pura (username, sinergia) testada com vitest; UI valida por type-check/lint + PR. Ícones lucide, sem emoji. Spec: `docs/superpowers/specs/2026-07-21-card-jogador-design.md`.

**Tech Stack:** Next.js (App Router, `(authed)`), Supabase (service-role client + Storage bucket `avatars` reaproveitado), vitest, Tailwind + componentes `ui/*`.

---

## File structure

- Create `supabase/migrations/20260722000000_perfil_jogador.sql` — tabela + RLS (aplicação MANUAL).
- Create `src/lib/perfil-jogador/schema.ts` — tipos `PerfilJogador`, `CardData`, `Classe`.
- Create `src/lib/perfil-jogador/username.ts` (+ `.test.ts`) — normaliza/valida username.
- Create `src/lib/perfil-jogador/classe.ts` — descrição por classe + `getTemperamentoDaPessoa`.
- Create `src/lib/perfil-jogador/sinergia.ts` (+ `.test.ts`) — matriz de compatibilidade + cálculo.
- Create `src/lib/perfil-jogador/queries.ts` — `getCard`, `listTime`.
- Create `src/lib/perfil-jogador/actions.ts` — `salvarCardAction`, `uploadCapaAction`.
- Create `src/components/perfil/PessoaLink.tsx` — nome/avatar clicável → card.
- Create `src/components/perfil/CardJogador.tsx` — card completo (apresentação).
- Create `src/components/perfil/MiniCard.tsx` — card resumido pra grade.
- Create `src/components/perfil/CapaUpload.tsx` — upload da capa.
- Create `src/components/perfil/EditarCardForm.tsx` — form do dono.
- Create `src/app/(authed)/perfil/[id]/page.tsx` — card.
- Create `src/app/(authed)/perfil/[id]/editar/page.tsx` — edição.
- Create `src/app/(authed)/time/page.tsx` — grade do time.
- Modify `src/components/layout/nav-config.ts` — item "Time".

---

## Task 1: Migration `perfil_jogador` (aplicação manual)

**Files:**
- Create: `supabase/migrations/20260722000000_perfil_jogador.sql`

- [ ] **Step 1: Escrever a migration**

```sql
-- Card do Jogador (Fase 1) — perfil social/gamificado, isolado dos dados de RH.
-- Aplicação MANUAL no SQL Editor após o merge (Vercel não roda migration no deploy).

create table public.perfil_jogador (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  username text unique,
  capa_url text,
  bio text,
  como_trabalho text,
  hobbies text[] not null default '{}',
  frase text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- username único case-insensitive (permite null enquanto não definido)
create unique index perfil_jogador_username_lower_idx
  on public.perfil_jogador (lower(username))
  where username is not null;

-- RLS: leitura pra qualquer autenticado (como os demais recursos internos).
-- Escrita roda via service-role no server action, com checagem no código.
alter table public.perfil_jogador enable row level security;
create policy perfil_jogador_read on public.perfil_jogador
  for select to authenticated using (true);
```

- [ ] **Step 2: Verificar sintaxe (dry parse local, opcional)**

Run: `grep -c "create" supabase/migrations/20260722000000_perfil_jogador.sql`
Expected: imprime `3` (table + 2 create index/policy… na verdade `create table`, `create unique index`, `create policy` = 3).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260722000000_perfil_jogador.sql
git commit -m "feat(card-jogador): migration perfil_jogador (aplicar manual)"
```

> **NOTA DE DEPLOY:** aplicar este SQL manualmente no Supabase SQL Editor após o merge, antes de usar as telas.

---

## Task 2: Tipos + validação de username (TDD)

**Files:**
- Create: `src/lib/perfil-jogador/schema.ts`
- Create: `src/lib/perfil-jogador/username.ts`
- Test: `src/lib/perfil-jogador/username.test.ts`

- [ ] **Step 1: Escrever os tipos**

`src/lib/perfil-jogador/schema.ts`:
```ts
export type Classe = "Colérico" | "Sanguíneo" | "Melancólico" | "Fleumático";

export interface PerfilJogador {
  user_id: string;
  username: string | null;
  capa_url: string | null;
  bio: string | null;
  como_trabalho: string | null;
  hobbies: string[];
  frase: string | null;
}

export interface SinergiaItem {
  userId: string;
  nome: string;
  avatarUrl: string | null;
  motivo: string; // ex.: "combina no trabalho" ou "curte: jogos, música"
}

export interface CardData {
  userId: string;
  nome: string;
  cargoLabel: string;
  avatarUrl: string | null;
  tempoDeCasa: string | null; // ex.: "8 meses de casa"
  perfil: PerfilJogador | null;
  classe: Classe | null;
  classeDescricao: string | null;
  sinergiaTrabalho: SinergiaItem[];
  sinergiaHobbies: SinergiaItem[];
  pesquisasRespondidas: { id: string; titulo: string }[];
}
```

- [ ] **Step 2: Escrever o teste que falha**

`src/lib/perfil-jogador/username.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizarUsername, validarUsername } from "./username";

describe("normalizarUsername", () => {
  it("lower + trim + tira @", () => {
    expect(normalizarUsername("  @Yasmin_M ")).toBe("yasmin_m");
  });
});

describe("validarUsername", () => {
  it("aceita 3-20 de letras/números/._", () => {
    expect(validarUsername("yasmin_m")).toBeNull();
    expect(validarUsername("duxx.99")).toBeNull();
  });
  it("rejeita curto demais", () => {
    expect(validarUsername("ab")).toMatch(/3/);
  });
  it("rejeita caractere inválido", () => {
    expect(validarUsername("yas min")).toMatch(/letras/);
  });
  it("rejeita vazio", () => {
    expect(validarUsername("")).toMatch(/3/);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/perfil-jogador/username.test.ts --exclude '**/.claude/**'`
Expected: FAIL ("normalizarUsername is not a function" / módulo não encontrado).

- [ ] **Step 4: Implementar**

`src/lib/perfil-jogador/username.ts`:
```ts
/** Normaliza pra comparação/armazenamento: lower, sem @, sem espaços nas pontas. */
export function normalizarUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Devolve mensagem de erro ou null se válido. Espera valor já normalizado ou cru. */
export function validarUsername(raw: string): string | null {
  const u = normalizarUsername(raw);
  if (u.length < 3 || u.length > 20) return "Use de 3 a 20 caracteres.";
  if (!/^[a-z0-9_.]+$/.test(u)) return "Só letras, números, ponto e underline.";
  return null;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/perfil-jogador/username.test.ts --exclude '**/.claude/**'`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add src/lib/perfil-jogador/schema.ts src/lib/perfil-jogador/username.ts src/lib/perfil-jogador/username.test.ts
git commit -m "feat(card-jogador): tipos + validação de username"
```

---

## Task 3: Classe (descrição + temperamento da pessoa)

**Files:**
- Create: `src/lib/perfil-jogador/classe.ts`

- [ ] **Step 1: Implementar descrições + leitura do temperamento**

`src/lib/perfil-jogador/classe.ts`:
```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { calcularTemperamento, ehQuizTemperamento, LETRA_TEMPERAMENTO } from "@/lib/pesquisas/temperamento";
import type { Classe } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export const CLASSE_DESCRICAO: Record<Classe, string> = {
  Colérico: "Motor de execução: decidido, rápido e focado em resultado.",
  Sanguíneo: "Energia e relação: comunicativo, faz o time andar e engaja.",
  Melancólico: "Qualidade e profundidade: caprichoso, detalhista e planejador.",
  Fleumático: "Calma e estabilidade: paciente, harmonizador e confiável.",
};

/**
 * Temperamento predominante de UMA pessoa a partir da pesquisa DISC identificada
 * que ela respondeu. Retorna null se não houver quiz DISC ou ela não respondeu.
 */
export async function getTemperamentoDaPessoa(userId: string): Promise<Classe | null> {
  const sb = createServiceRoleClient() as SB;
  // Acha pesquisas identificadas (não anônimas) e detecta a de temperamento.
  const { data: pesquisas } = await sb
    .from("pesquisas")
    .select("id")
    .eq("anonima", false)
    .is("deleted_at", null);
  for (const p of (pesquisas ?? []) as Array<{ id: string }>) {
    const { data: perguntas } = await sb
      .from("pesquisa_perguntas")
      .select("tipo, opcoes")
      .eq("pesquisa_id", p.id);
    const lista = (perguntas ?? []) as Array<{ tipo: string; opcoes: string[] | null }>;
    if (lista.length === 0 || !ehQuizTemperamento(lista)) continue;
    const { data: respostas } = await sb
      .from("pesquisa_respostas")
      .select("valor")
      .eq("pesquisa_id", p.id)
      .eq("user_id", userId);
    const escolhas = ((respostas ?? []) as Array<{ valor: { escolha?: string } }>)
      .map((r) => r.valor?.escolha)
      .filter((e): e is string => typeof e === "string");
    if (escolhas.length === 0) continue;
    const { predominante } = calcularTemperamento(escolhas);
    if (predominante) return LETRA_TEMPERAMENTO[predominante] as Classe;
  }
  return null;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "perfil-jogador/classe" | head; echo done`
Expected: imprime só `done` (sem erros no arquivo).

- [ ] **Step 3: Commit**

```bash
git add src/lib/perfil-jogador/classe.ts
git commit -m "feat(card-jogador): classe (descrição + temperamento da pessoa)"
```

---

## Task 4: Sinergia (TDD — lógica pura)

**Files:**
- Create: `src/lib/perfil-jogador/sinergia.ts`
- Test: `src/lib/perfil-jogador/sinergia.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

`src/lib/perfil-jogador/sinergia.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { compatibilidade, rankSinergiaTrabalho, rankSinergiaHobbies } from "./sinergia";

describe("compatibilidade", () => {
  it("complementares dão 'ótimo' (2)", () => {
    expect(compatibilidade("Colérico", "Melancólico")).toBe(2);
    expect(compatibilidade("Sanguíneo", "Fleumático")).toBe(2);
  });
  it("mesma classe é neutro (0)", () => {
    expect(compatibilidade("Colérico", "Colérico")).toBe(0);
  });
});

describe("rankSinergiaTrabalho", () => {
  it("ordena por compatibilidade e limita", () => {
    const eu = { userId: "me", classe: "Colérico" as const };
    const outros = [
      { userId: "a", nome: "A", avatarUrl: null, classe: "Melancólico" as const },
      { userId: "b", nome: "B", avatarUrl: null, classe: "Colérico" as const },
      { userId: "c", nome: "C", avatarUrl: null, classe: "Sanguíneo" as const },
    ];
    const r = rankSinergiaTrabalho(eu, outros, 2);
    expect(r.map((x) => x.userId)).toEqual(["a", "c"]);
    expect(r[0].motivo).toMatch(/trabalho/i);
  });
  it("sem classe retorna vazio", () => {
    expect(rankSinergiaTrabalho({ userId: "me", classe: null }, [], 3)).toEqual([]);
  });
});

describe("rankSinergiaHobbies", () => {
  it("ordena por nº de hobbies em comum e mostra as tags", () => {
    const eu = { userId: "me", hobbies: ["jogos", "musica", "corrida"] };
    const outros = [
      { userId: "a", nome: "A", avatarUrl: null, hobbies: ["jogos", "musica"] },
      { userId: "b", nome: "B", avatarUrl: null, hobbies: ["musica"] },
      { userId: "c", nome: "C", avatarUrl: null, hobbies: ["leitura"] },
    ];
    const r = rankSinergiaHobbies(eu, outros, 3);
    expect(r.map((x) => x.userId)).toEqual(["a", "b"]);
    expect(r[0].motivo).toMatch(/jogos/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/perfil-jogador/sinergia.test.ts --exclude '**/.claude/**'`
Expected: FAIL (funções não existem).

- [ ] **Step 3: Implementar**

`src/lib/perfil-jogador/sinergia.ts`:
```ts
import type { Classe, SinergiaItem } from "./schema";

// Matriz de "combina no trabalho": 2 = ótimo (complementar), 1 = bom, 0 = neutro (igual).
const COMPLEMENTAR: Record<Classe, Classe> = {
  Colérico: "Melancólico",
  Melancólico: "Colérico",
  Sanguíneo: "Fleumático",
  Fleumático: "Sanguíneo",
};

export function compatibilidade(a: Classe, b: Classe): number {
  if (a === b) return 0;
  if (COMPLEMENTAR[a] === b) return 2;
  return 1;
}

interface Pessoa {
  userId: string;
  nome: string;
  avatarUrl: string | null;
  classe?: Classe | null;
  hobbies?: string[];
}

export function rankSinergiaTrabalho(
  eu: { userId: string; classe: Classe | null },
  outros: Pessoa[],
  limite: number,
): SinergiaItem[] {
  if (!eu.classe) return [];
  return outros
    .filter((p) => p.userId !== eu.userId && p.classe)
    .map((p) => ({ p, score: compatibilidade(eu.classe as Classe, p.classe as Classe) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.p.nome.localeCompare(y.p.nome, "pt-BR"))
    .slice(0, limite)
    .map(({ p }) => ({
      userId: p.userId,
      nome: p.nome,
      avatarUrl: p.avatarUrl,
      motivo: "combina no trabalho",
    }));
}

export function rankSinergiaHobbies(
  eu: { userId: string; hobbies: string[] },
  outros: Pessoa[],
  limite: number,
): SinergiaItem[] {
  const meus = new Set(eu.hobbies.map((h) => h.toLowerCase()));
  if (meus.size === 0) return [];
  return outros
    .filter((p) => p.userId !== eu.userId)
    .map((p) => {
      const comuns = (p.hobbies ?? []).filter((h) => meus.has(h.toLowerCase()));
      return { p, comuns };
    })
    .filter((x) => x.comuns.length > 0)
    .sort((x, y) => y.comuns.length - x.comuns.length || x.p.nome.localeCompare(y.p.nome, "pt-BR"))
    .slice(0, limite)
    .map(({ p, comuns }) => ({
      userId: p.userId,
      nome: p.nome,
      avatarUrl: p.avatarUrl,
      motivo: `curte: ${comuns.join(", ")}`,
    }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/perfil-jogador/sinergia.test.ts --exclude '**/.claude/**'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfil-jogador/sinergia.ts src/lib/perfil-jogador/sinergia.test.ts
git commit -m "feat(card-jogador): sinergia trabalho + hobbies"
```

---

## Task 5: Queries (`getCard`, `listTime`)

**Files:**
- Create: `src/lib/perfil-jogador/queries.ts`

- [ ] **Step 1: Implementar**

`src/lib/perfil-jogador/queries.ts`:
```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { roleLabel } from "@/lib/auth/permissions";
import { getTemperamentoDaPessoa, CLASSE_DESCRICAO } from "./classe";
import { rankSinergiaTrabalho, rankSinergiaHobbies } from "./sinergia";
import type { CardData, PerfilJogador, Classe } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

function tempoDeCasa(dataAdmissao: string | null): string | null {
  if (!dataAdmissao) return null;
  const inicio = new Date(dataAdmissao).getTime();
  const meses = Math.max(0, Math.floor((Date.now() - inicio) / (1000 * 60 * 60 * 24 * 30)));
  if (meses < 1) return "recém-chegado";
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"} de casa`;
  const anos = Math.floor(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"} de casa`;
}

interface ProfileRow {
  id: string;
  nome: string;
  role: string;
  avatar_url: string | null;
  data_admissao: string | null;
  ativo: boolean;
}

export async function listTime(): Promise<
  { userId: string; nome: string; cargoLabel: string; avatarUrl: string | null; username: string | null; classe: Classe | null }[]
> {
  const sb = createServiceRoleClient() as SB;
  const { data: profs } = await sb
    .from("profiles")
    .select("id, nome, role, avatar_url, data_admissao, ativo")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  const lista = (profs ?? []) as ProfileRow[];
  const { data: cards } = await sb.from("perfil_jogador").select("user_id, username");
  const userMap = new Map(
    ((cards ?? []) as Array<{ user_id: string; username: string | null }>).map((c) => [c.user_id, c.username]),
  );
  // Classe por pessoa (sequencial simples; base pequena).
  const out = [];
  for (const p of lista) {
    out.push({
      userId: p.id,
      nome: p.nome,
      cargoLabel: roleLabel(p.role),
      avatarUrl: p.avatar_url,
      username: userMap.get(p.id) ?? null,
      classe: await getTemperamentoDaPessoa(p.id),
    });
  }
  return out;
}

export async function getCard(userId: string): Promise<CardData | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: prof } = await sb
    .from("profiles")
    .select("id, nome, role, avatar_url, data_admissao, ativo")
    .eq("id", userId)
    .single();
  if (!prof) return null;
  const p = prof as ProfileRow;

  const { data: perfilRow } = await sb
    .from("perfil_jogador")
    .select("user_id, username, capa_url, bio, como_trabalho, hobbies, frase")
    .eq("user_id", userId)
    .maybeSingle();
  const perfil = (perfilRow as PerfilJogador | null) ?? null;

  const classe = await getTemperamentoDaPessoa(userId);

  // Pesquisas identificadas que a pessoa respondeu.
  const { data: dests } = await sb
    .from("pesquisa_destinatarios")
    .select("pesquisa_id")
    .eq("user_id", userId)
    .not("respondeu_em", "is", null);
  const ids = ((dests ?? []) as Array<{ pesquisa_id: string }>).map((d) => d.pesquisa_id);
  let pesquisasRespondidas: { id: string; titulo: string }[] = [];
  if (ids.length > 0) {
    const { data: ps } = await sb
      .from("pesquisas")
      .select("id, titulo")
      .in("id", ids)
      .eq("anonima", false)
      .is("deleted_at", null);
    pesquisasRespondidas = (ps ?? []) as { id: string; titulo: string }[];
  }

  // Sinergia: monta a lista de colegas (ativos) com classe + hobbies.
  const { data: profs } = await sb
    .from("profiles")
    .select("id, nome, avatar_url")
    .eq("ativo", true)
    .neq("id", userId);
  const colegas = (profs ?? []) as Array<{ id: string; nome: string; avatar_url: string | null }>;
  const { data: cards } = await sb.from("perfil_jogador").select("user_id, hobbies");
  const hobbiesMap = new Map(
    ((cards ?? []) as Array<{ user_id: string; hobbies: string[] }>).map((c) => [c.user_id, c.hobbies ?? []]),
  );
  const colegasFull = [];
  for (const c of colegas) {
    colegasFull.push({
      userId: c.id,
      nome: c.nome,
      avatarUrl: c.avatar_url,
      classe: await getTemperamentoDaPessoa(c.id),
      hobbies: hobbiesMap.get(c.id) ?? [],
    });
  }

  const sinergiaTrabalho = rankSinergiaTrabalho({ userId, classe }, colegasFull, 3);
  const sinergiaHobbies = rankSinergiaHobbies(
    { userId, hobbies: perfil?.hobbies ?? [] },
    colegasFull,
    3,
  );

  return {
    userId,
    nome: p.nome,
    cargoLabel: roleLabel(p.role),
    avatarUrl: p.avatar_url,
    tempoDeCasa: tempoDeCasa(p.data_admissao),
    perfil,
    classe,
    classeDescricao: classe ? CLASSE_DESCRICAO[classe] : null,
    sinergiaTrabalho,
    sinergiaHobbies,
    pesquisasRespondidas,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "perfil-jogador/queries" | head; echo done`
Expected: só `done`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/perfil-jogador/queries.ts
git commit -m "feat(card-jogador): queries getCard/listTime"
```

---

## Task 6: Actions (salvar card + upload de capa)

**Files:**
- Create: `src/lib/perfil-jogador/actions.ts`

- [ ] **Step 1: Implementar**

`src/lib/perfil-jogador/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { normalizarUsername, validarUsername } from "./username";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;
type Result = { error?: string; success?: boolean };

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function podeEditar(actor: { id: string; role: string }, alvo: string): boolean {
  return actor.id === alvo || canAccess(actor.role, "manage:users");
}

function tags(raw: string | undefined): string[] {
  if (!raw) return [];
  return [...new Set(
    raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
  )].slice(0, 12);
}

export async function salvarCardAction(targetUserId: string, formData: FormData): Promise<Result> {
  const actor = await requireAuth();
  if (!podeEditar(actor, targetUserId)) return { error: "Sem permissão" };

  const usernameRaw = String(formData.get("username") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const comoTrabalho = String(formData.get("como_trabalho") ?? "").trim() || null;
  const frase = String(formData.get("frase") ?? "").trim() || null;
  const hobbies = tags(String(formData.get("hobbies") ?? ""));

  const sb = createServiceRoleClient() as SB;

  let username: string | null = null;
  if (usernameRaw) {
    const erro = validarUsername(usernameRaw);
    if (erro) return { error: erro };
    username = normalizarUsername(usernameRaw);
    // Único (case-insensitive), ignorando o próprio.
    const { data: existente } = await sb
      .from("perfil_jogador")
      .select("user_id")
      .ilike("username", username)
      .neq("user_id", targetUserId)
      .maybeSingle();
    if (existente) return { error: "Esse username já está em uso." };
  }

  const { error } = await sb
    .from("perfil_jogador")
    .upsert(
      {
        user_id: targetUserId,
        username,
        bio,
        como_trabalho: comoTrabalho,
        frase,
        hobbies,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) return { error: error.message };

  revalidatePath(`/perfil/${targetUserId}`);
  revalidatePath("/time");
  return { success: true };
}

export async function uploadCapaAction(
  targetUserId: string,
  formData: FormData,
): Promise<{ error: string } | { success: true; capaUrl: string }> {
  const actor = await requireAuth();
  if (!podeEditar(actor, targetUserId)) return { error: "Sem permissão" };

  const file = formData.get("capa");
  if (!(file instanceof File)) return { error: "Arquivo inválido" };
  if (!ALLOWED.includes(file.type)) return { error: "Apenas JPEG, PNG ou WebP" };
  if (file.size > MAX_BYTES) return { error: "Máximo 4MB" };
  if (file.size === 0) return { error: "Arquivo vazio" };

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${targetUserId}/capa.${ext}`;
  const admin = createServiceRoleClient();
  // Reaproveita o bucket público "avatars" (evita criar bucket novo manualmente).
  const { error: upErr } = await admin.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return { error: upErr.message };
  const { data: { publicUrl } } = admin.storage.from("avatars").getPublicUrl(path);
  const capaUrl = `${publicUrl}?v=${Date.now()}`;

  const sb = createServiceRoleClient() as SB;
  const { error } = await sb
    .from("perfil_jogador")
    .upsert({ user_id: targetUserId, capa_url: capaUrl, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { error: error.message };

  revalidatePath(`/perfil/${targetUserId}`);
  return { success: true, capaUrl };
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/lib/perfil-jogador/actions.ts && echo OK`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/perfil-jogador/actions.ts
git commit -m "feat(card-jogador): actions salvar card + upload de capa"
```

---

## Task 7: `<PessoaLink>`

**Files:**
- Create: `src/components/perfil/PessoaLink.tsx`

- [ ] **Step 1: Implementar**

`src/components/perfil/PessoaLink.tsx`:
```tsx
import Link from "next/link";
import Image from "next/image";

function initials(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function PessoaLink({
  id,
  nome,
  avatarUrl = null,
  showAvatar = true,
  className = "",
}: {
  id: string;
  nome: string;
  avatarUrl?: string | null;
  showAvatar?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/perfil/${id}`}
      className={`inline-flex items-center gap-2 hover:underline ${className}`}
    >
      {showAvatar &&
        (avatarUrl ? (
          <Image src={avatarUrl} alt={nome} width={24} height={24} className="h-6 w-6 rounded-full object-cover" unoptimized />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
            {initials(nome)}
          </span>
        ))}
      <span className="truncate">{nome}</span>
    </Link>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "PessoaLink" | head; echo done`
Expected: só `done`.

- [ ] **Step 3: Commit**

```bash
git add src/components/perfil/PessoaLink.tsx
git commit -m "feat(card-jogador): componente PessoaLink"
```

---

## Task 8: `<CardJogador>` (apresentação)

**Files:**
- Create: `src/components/perfil/CardJogador.tsx`

- [ ] **Step 1: Implementar**

`src/components/perfil/CardJogador.tsx`:
```tsx
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PessoaLink } from "./PessoaLink";
import {
  Clock, Drama, BookOpen, Briefcase, Gamepad2, Handshake, Trophy, Zap, ClipboardList, Pencil,
} from "lucide-react";
import type { CardData } from "@/lib/perfil-jogador/schema";

function initials(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function Secao({ icon, titulo, children }: { icon: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-2 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">{icon}{titulo}</p>
      {children}
    </Card>
  );
}

export function CardJogador({ card, podeEditar }: { card: CardData; podeEditar: boolean }) {
  const { perfil } = card;
  return (
    <div className="space-y-4">
      {/* Capa + cabeçalho */}
      <Card className="overflow-hidden">
        <div className="relative h-32 w-full bg-muted sm:h-40">
          {perfil?.capa_url && (
            <Image src={perfil.capa_url} alt="capa" fill className="object-cover" unoptimized />
          )}
        </div>
        <div className="flex items-end justify-between gap-3 p-4">
          <div className="flex items-end gap-3">
            <div className="-mt-12">
              {card.avatarUrl ? (
                <Image src={card.avatarUrl} alt={card.nome} width={80} height={80} className="h-20 w-20 rounded-full border-4 border-background object-cover" unoptimized />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-background bg-muted text-2xl font-semibold text-muted-foreground">
                  {initials(card.nome)}
                </span>
              )}
            </div>
            <div className="pb-1">
              {perfil?.username && <p className="text-sm font-medium text-primary">@{perfil.username}</p>}
              <p className="text-lg font-bold leading-tight">{card.nome}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{card.cargoLabel}</span>
                {card.tempoDeCasa && (
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{card.tempoDeCasa}</span>
                )}
              </p>
              {perfil?.frase && <p className="mt-1 text-sm italic text-muted-foreground">“{perfil.frase}”</p>}
            </div>
          </div>
          {podeEditar && (
            <Link href={`/perfil/${card.userId}/editar`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="mr-2 h-4 w-4" />Editar
            </Link>
          )}
        </div>
      </Card>

      {/* Classe */}
      {card.classe && (
        <Secao icon={<Drama className="h-4 w-4" />} titulo="Classe">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">{card.classe}</Badge>
            <span className="text-xs text-muted-foreground">{card.classeDescricao}</span>
          </div>
        </Secao>
      )}

      {/* Sobre mim + Como trabalho */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Secao icon={<BookOpen className="h-4 w-4" />} titulo="Sobre mim">
          <p className="text-sm text-muted-foreground">{perfil?.bio || "Ainda não preencheu."}</p>
        </Secao>
        <Secao icon={<Briefcase className="h-4 w-4" />} titulo="Como gosto de trabalhar">
          <p className="text-sm text-muted-foreground">{perfil?.como_trabalho || "Ainda não preencheu."}</p>
        </Secao>
      </div>

      {/* Hobbies */}
      <Secao icon={<Gamepad2 className="h-4 w-4" />} titulo="Hobbies & interesses">
        {perfil?.hobbies && perfil.hobbies.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {perfil.hobbies.map((h) => <Badge key={h} variant="secondary">{h}</Badge>)}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Ainda não preencheu.</p>
        )}
      </Secao>

      {/* Sinergia */}
      {(card.sinergiaTrabalho.length > 0 || card.sinergiaHobbies.length > 0) && (
        <Secao icon={<Handshake className="h-4 w-4" />} titulo="Sinergia">
          {card.sinergiaTrabalho.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Combina no trabalho</p>
              <div className="flex flex-wrap gap-3">
                {card.sinergiaTrabalho.map((s) => (
                  <PessoaLink key={s.userId} id={s.userId} nome={s.nome} avatarUrl={s.avatarUrl} className="text-sm" />
                ))}
              </div>
            </div>
          )}
          {card.sinergiaHobbies.length > 0 && (
            <div className="space-y-1 pt-2">
              <p className="text-xs font-medium text-muted-foreground">Curte as mesmas coisas</p>
              <div className="flex flex-col gap-1">
                {card.sinergiaHobbies.map((s) => (
                  <span key={s.userId} className="flex items-center gap-2 text-sm">
                    <PessoaLink id={s.userId} nome={s.nome} avatarUrl={s.avatarUrl} />
                    <span className="text-xs text-muted-foreground">({s.motivo})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Secao>
      )}

      {/* Conquistas + Skills (bloqueados) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="space-y-1 p-4 opacity-60">
          <p className="flex items-center gap-2 text-sm font-medium"><Trophy className="h-4 w-4" />Conquistas</p>
          <p className="text-xs text-muted-foreground">Em breve.</p>
        </Card>
        <Card className="space-y-1 p-4 opacity-60">
          <p className="flex items-center gap-2 text-sm font-medium"><Zap className="h-4 w-4" />Skills</p>
          <p className="text-xs text-muted-foreground">Em breve.</p>
        </Card>
      </div>

      {/* Resultados de pesquisas */}
      <Secao icon={<ClipboardList className="h-4 w-4" />} titulo="Resultados de pesquisas">
        {card.pesquisasRespondidas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma pesquisa respondida ainda.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {card.pesquisasRespondidas.map((p) => (
              <Link key={p.id} href={`/pesquisas/${p.id}`} className="text-sm hover:underline">{p.titulo}</Link>
            ))}
          </div>
        )}
      </Secao>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "CardJogador" | head; echo done`
Expected: só `done`.

- [ ] **Step 3: Commit**

```bash
git add src/components/perfil/CardJogador.tsx
git commit -m "feat(card-jogador): componente CardJogador"
```

---

## Task 9: Página `/perfil/[id]`

**Files:**
- Create: `src/app/(authed)/perfil/[id]/page.tsx`

- [ ] **Step 1: Implementar**

`src/app/(authed)/perfil/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getCard } from "@/lib/perfil-jogador/queries";
import { CardJogador } from "@/components/perfil/CardJogador";

export default async function PerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const card = await getCard(id);
  if (!card) notFound();
  const podeEditar = user.id === id || canAccess(user.role, "manage:users");
  return (
    <div className="mx-auto max-w-2xl">
      <CardJogador card={card} podeEditar={podeEditar} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "perfil/\[id\]/page" | head; echo done`
Expected: só `done`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authed)/perfil/[id]/page.tsx"
git commit -m "feat(card-jogador): página /perfil/[id]"
```

---

## Task 10: Edição (CapaUpload + EditarCardForm + página)

**Files:**
- Create: `src/components/perfil/CapaUpload.tsx`
- Create: `src/components/perfil/EditarCardForm.tsx`
- Create: `src/app/(authed)/perfil/[id]/editar/page.tsx`

- [ ] **Step 1: CapaUpload** (mesmo padrão do AvatarUpload)

`src/components/perfil/CapaUpload.tsx`:
```tsx
"use client";

import { useState, useTransition, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ImageUp } from "lucide-react";
import { uploadCapaAction } from "@/lib/perfil-jogador/actions";

const MAX_BYTES = 4 * 1024 * 1024;

export function CapaUpload({ userId, currentUrl }: { userId: string; currentUrl: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const ref = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) return setError("Máximo 4MB");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return setError("JPEG, PNG ou WebP");
    const local = URL.createObjectURL(file);
    setPreview(local);
    const fd = new FormData();
    fd.set("capa", file);
    startTransition(async () => {
      const r = await uploadCapaAction(userId, fd);
      URL.revokeObjectURL(local);
      if ("error" in r) { setError(r.error); setPreview(currentUrl); return; }
      setPreview(r.capaUrl);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="relative h-28 w-full overflow-hidden rounded-md bg-muted">
        {preview && <Image src={preview} alt="capa" fill className="object-cover" unoptimized />}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPick} disabled={pending} />
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={pending}>
        <ImageUp className="mr-2 h-4 w-4" />{pending ? "Enviando..." : "Trocar capa"}
      </Button>
      <p className="text-[11px] text-muted-foreground">JPEG, PNG ou WebP. Máximo 4MB.</p>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: EditarCardForm**

`src/components/perfil/EditarCardForm.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { salvarCardAction } from "@/lib/perfil-jogador/actions";
import type { PerfilJogador } from "@/lib/perfil-jogador/schema";

export function EditarCardForm({ userId, perfil }: { userId: string; perfil: PerfilJogador | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await salvarCardAction(userId, fd);
      if (r?.error) { setErro(r.error); toast.error(r.error); return; }
      toast.success("Card salvo");
      router.push(`/perfil/${userId}`);
      router.refresh();
    });
  }

  const label = "block text-sm font-medium";
  const input = "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className={label} htmlFor="username">Username</label>
        <input id="username" name="username" defaultValue={perfil?.username ?? ""} placeholder="ex.: yasmin_m" className={input} />
        <p className="mt-1 text-[11px] text-muted-foreground">3–20 caracteres: letras, números, ponto e underline.</p>
      </div>
      <div>
        <label className={label} htmlFor="frase">Frase / lema</label>
        <input id="frase" name="frase" defaultValue={perfil?.frase ?? ""} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="bio">Sobre mim</label>
        <textarea id="bio" name="bio" defaultValue={perfil?.bio ?? ""} rows={3} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="como_trabalho">Como gosto de trabalhar</label>
        <textarea id="como_trabalho" name="como_trabalho" defaultValue={perfil?.como_trabalho ?? ""} rows={3} className={input} />
      </div>
      <div>
        <label className={label} htmlFor="hobbies">Hobbies & interesses</label>
        <input id="hobbies" name="hobbies" defaultValue={(perfil?.hobbies ?? []).join(", ")} placeholder="música, jogos, corrida" className={input} />
        <p className="mt-1 text-[11px] text-muted-foreground">Separe por vírgula.</p>
      </div>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>Cancelar</Button>
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Página de edição**

`src/app/(authed)/perfil/[id]/editar/page.tsx`:
```tsx
import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CapaUpload } from "@/components/perfil/CapaUpload";
import { EditarCardForm } from "@/components/perfil/EditarCardForm";
import type { PerfilJogador } from "@/lib/perfil-jogador/schema";

export default async function EditarPerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  if (user.id !== id && !canAccess(user.role, "manage:users")) redirect(`/perfil/${id}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createServiceRoleClient() as any;
  const { data: prof } = await sb.from("profiles").select("id, nome").eq("id", id).single();
  if (!prof) notFound();
  const { data: perfilRow } = await sb
    .from("perfil_jogador")
    .select("user_id, username, capa_url, bio, como_trabalho, hobbies, frase")
    .eq("user_id", id)
    .maybeSingle();
  const perfil = (perfilRow as PerfilJogador | null) ?? null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Editar card</h1>
        <p className="text-sm text-muted-foreground">{prof.nome}</p>
      </header>
      <CapaUpload userId={id} currentUrl={perfil?.capa_url ?? null} />
      <EditarCardForm userId={id} perfil={perfil} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/components/perfil "src/app/(authed)/perfil" && echo OK`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/components/perfil/CapaUpload.tsx src/components/perfil/EditarCardForm.tsx "src/app/(authed)/perfil/[id]/editar/page.tsx"
git commit -m "feat(card-jogador): edição do card (capa + form)"
```

---

## Task 11: Grade `/time` (MiniCard + página)

**Files:**
- Create: `src/components/perfil/MiniCard.tsx`
- Create: `src/app/(authed)/time/page.tsx`

- [ ] **Step 1: MiniCard**

`src/components/perfil/MiniCard.tsx`:
```tsx
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Classe } from "@/lib/perfil-jogador/schema";

function initials(nome: string): string {
  return nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function MiniCard({
  userId, nome, cargoLabel, avatarUrl, username, classe,
}: {
  userId: string; nome: string; cargoLabel: string; avatarUrl: string | null; username: string | null; classe: Classe | null;
}) {
  return (
    <Link href={`/perfil/${userId}`}>
      <Card className="flex flex-col items-center gap-2 p-4 text-center transition hover:border-primary/50 hover:bg-muted/30">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={nome} width={56} height={56} className="h-14 w-14 rounded-full object-cover" unoptimized />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">{initials(nome)}</span>
        )}
        <div>
          <p className="text-sm font-medium leading-tight">{nome}</p>
          {username && <p className="text-xs text-primary">@{username}</p>}
          <p className="text-xs text-muted-foreground">{cargoLabel}</p>
        </div>
        {classe && <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">{classe}</Badge>}
      </Card>
    </Link>
  );
}
```

- [ ] **Step 2: Página /time**

`src/app/(authed)/time/page.tsx`:
```tsx
import { requireAuth } from "@/lib/auth/session";
import { listTime } from "@/lib/perfil-jogador/queries";
import { MiniCard } from "@/components/perfil/MiniCard";

export default async function TimePage() {
  await requireAuth();
  const pessoas = await listTime();
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Time</h1>
        <p className="text-sm text-muted-foreground">Conheça o time — clique num card pra ver o perfil.</p>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {pessoas.map((p) => (
          <MiniCard key={p.userId} {...p} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/components/perfil/MiniCard.tsx "src/app/(authed)/time/page.tsx" && echo OK`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/components/perfil/MiniCard.tsx "src/app/(authed)/time/page.tsx"
git commit -m "feat(card-jogador): grade /time"
```

---

## Task 12: Item de menu "Time"

**Files:**
- Modify: `src/components/layout/nav-config.ts` (grupo "Interno", perto do item "Colaboradores")

- [ ] **Step 1: Importar o ícone**

No topo de `nav-config.ts`, adicionar `Gamepad2` à lista de imports de `lucide-react` (juntar ao import existente; NÃO criar linha de import nova duplicada).

- [ ] **Step 2: Adicionar o item**

Logo após a linha do item `/colaboradores` (grupo `id: "equipe"`, label "Interno"), inserir:
```ts
      { type: "link", href: "/time", icon: Gamepad2, label: "Time", roles: "all", badgeKey: null },
```

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc --noEmit -p tsconfig.json >/dev/null 2>&1 && npx eslint src/components/layout/nav-config.ts && echo OK`
Expected: `OK`.

- [ ] **Step 4: Rodar toda a suíte de testes do módulo**

Run: `npx vitest run src/lib/perfil-jogador --exclude '**/.claude/**'`
Expected: PASS (username + sinergia).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/nav-config.ts
git commit -m "feat(card-jogador): item de menu Time"
```

---

## Task 13: Abrir PR

- [ ] **Step 1: Push + PR**

```bash
git push -u origin feat/card-jogador
gh pr create --base main --head feat/card-jogador \
  --title "feat(card-jogador): perfil estilo game por pessoa (Fase 1)" \
  --body "Card do Jogador Fase 1: /time + /perfil/[id], username, capa, bio, hobbies, classe (DISC sem números), sinergia, resultados de pesquisas. Migration perfil_jogador MANUAL. Spec/plan em docs/superpowers/. Conquistas/Skills reservados (Fase 2/3)."
```

- [ ] **Step 2: Esperar CI verde e mergear**

Run: `gh pr checks <n> --watch` → depois `gh pr merge <n> --squash --delete-branch`

> **PÓS-MERGE (manual):** aplicar `supabase/migrations/20260722000000_perfil_jogador.sql` no SQL Editor.

---

## Self-review (cobertura do spec)

- Rotas `/time`, `/perfil/[id]`, `/perfil/[id]/editar` → Tasks 9, 10, 11 ✓
- Card com capa/username/cargo/tempo de casa/frase → Task 8 ✓
- Classe sem números + descrição → Tasks 3, 8 ✓
- Sobre mim / Como trabalho / Hobbies → Tasks 8, 10 ✓
- Sinergia (trabalho + hobbies) → Tasks 4, 5, 8 ✓
- Resultados de pesquisas extensíveis → Task 5 (getCard puxa por destinatário respondido) ✓
- Conquistas/Skills "em breve" → Task 8 ✓
- `<PessoaLink>` (clicar abre card) → Task 7 (aplicação ampla incremental; usado na Sinergia já) ✓
- Tabela isolada `perfil_jogador` + RLS → Task 1 ✓
- Só ícones (lucide), sem emoji → Tasks 8/11 usam lucide ✓
- Permissões (dono/adm-sócio edita; todos veem) → Tasks 6, 9, 10 ✓
- Item de menu "Time" `roles:"all"` → Task 12 ✓
- Migration manual → Task 1 + nota pós-merge ✓
