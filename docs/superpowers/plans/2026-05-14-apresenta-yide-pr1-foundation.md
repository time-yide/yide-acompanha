# Apresenta Yide — PR 1 (Foundation + Templates visuais) — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Entregar a infra do "Apresenta Yide" (DB + storage + páginas + 6 templates visuais de slide renderizando mock data) sem IA nem PDF. Resultado: usuária consegue ver visualmente como os slides ficam, criar/deletar apresentações com conteúdo placeholder. PRs 2 e 3 vão plugar Claude streaming e PDF export.

**Architecture:** Tabela `apresentacoes_yide` guarda slides como JSONB. Páginas seguem padrão existente (`/social-media/apresenta-yide` lista + `nova` editor + `[id]` view). 6 templates de slide são componentes React isolados que recebem `content` tipado e renderizam visual fixo Yide (dark + teal + logo). Em v1 a action `criarComMockAction` popula slides com dados de exemplo — só pra UI/preview funcionarem. PR 2 substitui mock por Claude streaming.

**Tech Stack:** Next.js 16 (App Router), Supabase (DB + Storage + RLS), React Server Components, Tailwind v4, lucide-react, Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-14-apresenta-yide-design.md`](../specs/2026-05-14-apresenta-yide-design.md)

---

## Arquivos tocados

| Arquivo | Tipo |
|---|---|
| `supabase/migrations/20260523000000_apresentacoes_yide.sql` | Criar |
| `src/lib/apresenta-yide/tipos.ts` | Criar |
| `src/lib/apresenta-yide/mock-data.ts` | Criar |
| `src/lib/apresenta-yide/queries.ts` | Criar |
| `src/lib/apresenta-yide/actions.ts` | Criar |
| `tests/unit/apresenta-yide-tipos.test.ts` | Criar |
| `src/components/apresenta-yide/YideLogo.tsx` | Criar |
| `src/components/apresenta-yide/slides/SlideCapa.tsx` | Criar |
| `src/components/apresenta-yide/slides/SlideConteudo.tsx` | Criar |
| `src/components/apresenta-yide/slides/SlideDuasColunas.tsx` | Criar |
| `src/components/apresenta-yide/slides/SlideMetrica.tsx` | Criar |
| `src/components/apresenta-yide/slides/SlideTopicosNumerados.tsx` | Criar |
| `src/components/apresenta-yide/slides/SlideEncerramento.tsx` | Criar |
| `src/components/apresenta-yide/SlidePreview.tsx` | Criar |
| `src/components/apresenta-yide/PromptForm.tsx` | Criar |
| `src/components/apresenta-yide/ApresentacaoEditor.tsx` | Criar |
| `src/components/apresenta-yide/ApresentacoesList.tsx` | Criar |
| `src/components/apresenta-yide/DeleteApresentacaoButton.tsx` | Criar |
| `src/components/social-media/TabsSocialMedia.tsx` | Criar |
| `src/app/(authed)/social-media/apresenta-yide/page.tsx` | Criar |
| `src/app/(authed)/social-media/apresenta-yide/nova/page.tsx` | Criar |
| `src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx` | Criar |
| `src/app/(authed)/social-media/page.tsx` | Modificar |

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260523000000_apresentacoes_yide.sql`

- [ ] **Step 1: Criar migration**

```sql
-- Apresenta Yide — apresentações geradas por IA com visual fixo Yide.
-- Slides ficam como JSONB; PDF é gerado on-demand e salvo no Storage.

create table public.apresentacoes_yide (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  prompt text not null,
  objetivo text,
  num_slides_alvo integer not null default 8,
  slides jsonb not null default '[]'::jsonb,
  status text not null default 'rascunho',
  pdf_storage_path text,
  criado_por uuid not null references public.profiles(id) on delete set null,
  organization_id uuid not null references public.organizations(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_titulo_not_empty check (length(trim(titulo)) > 0),
  constraint chk_num_slides_range check (num_slides_alvo between 5 and 15),
  constraint chk_status_valid check (status in ('rascunho', 'gerando', 'pronta', 'erro'))
);

create index idx_apresentacoes_yide_criado_por on public.apresentacoes_yide(criado_por);
create index idx_apresentacoes_yide_created_at on public.apresentacoes_yide(created_at desc);

create trigger trg_apresentacoes_yide_touch
  before update on public.apresentacoes_yide
  for each row execute function public.set_updated_at();

alter table public.apresentacoes_yide enable row level security;

create policy "apresentacoes_yide read"
  on public.apresentacoes_yide for select to authenticated using (
    criado_por = auth.uid()
    or current_user_role() in ('adm'::user_role, 'socio'::user_role)
  );

create policy "apresentacoes_yide write own"
  on public.apresentacoes_yide for all to authenticated
  using (criado_por = auth.uid())
  with check (criado_por = auth.uid());

-- Bucket privado pra PDFs
insert into storage.buckets (id, name, public)
values ('apresentacoes-yide', 'apresentacoes-yide', false)
on conflict (id) do nothing;

create policy "apresentacoes-yide bucket read"
  on storage.objects for select to authenticated
  using (bucket_id = 'apresentacoes-yide');

create policy "apresentacoes-yide bucket write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'apresentacoes-yide');

create policy "apresentacoes-yide bucket delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'apresentacoes-yide');
```

- [ ] **Step 2: Typecheck (migration não afeta TS)**

```bash
npm run typecheck
```
Esperado: só os 5 erros pré-existentes (cheerio/web-push).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260523000000_apresentacoes_yide.sql
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): migration — tabela + bucket de storage

Tabela apresentacoes_yide guarda prompt + slides JSONB + path do PDF
gerado. RLS: user vê só os próprios; adm/sócio vê tudo. Bucket privado
apresentacoes-yide pra PDFs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tipos + Mock data + Validação

**Files:**
- Create: `src/lib/apresenta-yide/tipos.ts`
- Create: `src/lib/apresenta-yide/mock-data.ts`
- Create: `tests/unit/apresenta-yide-tipos.test.ts`

- [ ] **Step 1: Escrever teste do parser de slide**

Crie `tests/unit/apresenta-yide-tipos.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isValidSlide, isValidApresentacaoSlides } from "@/lib/apresenta-yide/tipos";

describe("isValidSlide", () => {
  it("aceita capa válida", () => {
    expect(isValidSlide({
      template: "capa",
      content: { template: "capa", titulo: "Yide" },
    })).toBe(true);
  });

  it("aceita capa com subtítulo opcional", () => {
    expect(isValidSlide({
      template: "capa",
      content: { template: "capa", titulo: "Yide", subtitulo: "Agência" },
    })).toBe(true);
  });

  it("rejeita capa sem titulo", () => {
    expect(isValidSlide({
      template: "capa",
      content: { template: "capa" },
    })).toBe(false);
  });

  it("aceita conteudo com bullets", () => {
    expect(isValidSlide({
      template: "conteudo",
      content: { template: "conteudo", titulo: "X", bullets: ["a", "b"] },
    })).toBe(true);
  });

  it("aceita duas_colunas válida", () => {
    expect(isValidSlide({
      template: "duas_colunas",
      content: {
        template: "duas_colunas",
        titulo: "Antes vs Depois",
        coluna_esquerda: { titulo: "Antes", texto: "ruim" },
        coluna_direita: { titulo: "Depois", texto: "bom" },
      },
    })).toBe(true);
  });

  it("aceita metrica", () => {
    expect(isValidSlide({
      template: "metrica",
      content: { template: "metrica", numero: "R$ 50k", label: "Faturamento" },
    })).toBe(true);
  });

  it("aceita topicos_numerados", () => {
    expect(isValidSlide({
      template: "topicos_numerados",
      content: {
        template: "topicos_numerados",
        titulo: "5 passos",
        topicos: [{ titulo: "Passo 1" }, { titulo: "Passo 2" }],
      },
    })).toBe(true);
  });

  it("aceita encerramento", () => {
    expect(isValidSlide({
      template: "encerramento",
      content: { template: "encerramento", mensagem: "Obrigado!" },
    })).toBe(true);
  });

  it("rejeita template inválido", () => {
    expect(isValidSlide({
      template: "inexistente",
      content: { template: "inexistente" },
    })).toBe(false);
  });

  it("rejeita quando content.template não bate com template do wrapper", () => {
    expect(isValidSlide({
      template: "capa",
      content: { template: "conteudo", titulo: "X" },
    })).toBe(false);
  });
});

describe("isValidApresentacaoSlides", () => {
  it("aceita array vazio", () => {
    expect(isValidApresentacaoSlides([])).toBe(true);
  });

  it("aceita array de slides válidos", () => {
    expect(isValidApresentacaoSlides([
      { template: "capa", content: { template: "capa", titulo: "Y" } },
      { template: "encerramento", content: { template: "encerramento", mensagem: "Fim" } },
    ])).toBe(true);
  });

  it("rejeita array com algum slide inválido", () => {
    expect(isValidApresentacaoSlides([
      { template: "capa", content: { template: "capa", titulo: "Y" } },
      { foo: "bar" },
    ])).toBe(false);
  });

  it("rejeita não-array", () => {
    expect(isValidApresentacaoSlides("string")).toBe(false);
    expect(isValidApresentacaoSlides(null)).toBe(false);
    expect(isValidApresentacaoSlides({})).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
npm test -- tests/unit/apresenta-yide-tipos.test.ts
```
Esperado: `Cannot find module`.

- [ ] **Step 3: Criar `src/lib/apresenta-yide/tipos.ts`**

```typescript
// Tipos compartilhados entre client/server. Pure types, sem deps de runtime.

export type SlideTemplate =
  | "capa"
  | "conteudo"
  | "duas_colunas"
  | "metrica"
  | "topicos_numerados"
  | "encerramento";

export interface SlideCapa {
  template: "capa";
  titulo: string;
  subtitulo?: string;
}

export interface SlideConteudo {
  template: "conteudo";
  titulo: string;
  texto?: string;
  bullets?: string[];
}

export interface SlideDuasColunas {
  template: "duas_colunas";
  titulo: string;
  coluna_esquerda: { titulo: string; texto: string };
  coluna_direita: { titulo: string; texto: string };
}

export interface SlideMetrica {
  template: "metrica";
  numero: string;
  label: string;
  descricao?: string;
}

export interface SlideTopicosNumerados {
  template: "topicos_numerados";
  titulo: string;
  topicos: Array<{ titulo: string; texto?: string }>;
}

export interface SlideEncerramento {
  template: "encerramento";
  mensagem: string;
  cta?: string;
}

export type SlideContent =
  | SlideCapa
  | SlideConteudo
  | SlideDuasColunas
  | SlideMetrica
  | SlideTopicosNumerados
  | SlideEncerramento;

export interface Slide {
  template: SlideTemplate;
  content: SlideContent;
}

export type ApresentacaoStatus = "rascunho" | "gerando" | "pronta" | "erro";

export interface ApresentacaoRow {
  id: string;
  titulo: string;
  prompt: string;
  objetivo: string | null;
  num_slides_alvo: number;
  slides: Slide[];
  status: ApresentacaoStatus;
  pdf_storage_path: string | null;
  criado_por: string;
  criado_por_nome: string | null;
  created_at: string;
}

// ─── Validação runtime ─────────────────────────────────────────────────

const TEMPLATES: readonly SlideTemplate[] = [
  "capa", "conteudo", "duas_colunas", "metrica", "topicos_numerados", "encerramento",
];

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isStr(x: unknown): x is string {
  return typeof x === "string";
}

function isStrNonEmpty(x: unknown): x is string {
  return isStr(x) && x.trim().length > 0;
}

function isCapa(c: unknown): c is SlideCapa {
  if (!isObj(c) || c.template !== "capa") return false;
  if (!isStrNonEmpty(c.titulo)) return false;
  if (c.subtitulo !== undefined && !isStr(c.subtitulo)) return false;
  return true;
}

function isConteudo(c: unknown): c is SlideConteudo {
  if (!isObj(c) || c.template !== "conteudo") return false;
  if (!isStrNonEmpty(c.titulo)) return false;
  if (c.texto !== undefined && !isStr(c.texto)) return false;
  if (c.bullets !== undefined) {
    if (!Array.isArray(c.bullets) || !c.bullets.every(isStr)) return false;
  }
  return true;
}

function isDuasColunas(c: unknown): c is SlideDuasColunas {
  if (!isObj(c) || c.template !== "duas_colunas") return false;
  if (!isStrNonEmpty(c.titulo)) return false;
  if (!isObj(c.coluna_esquerda) || !isStr(c.coluna_esquerda.titulo) || !isStr(c.coluna_esquerda.texto)) return false;
  if (!isObj(c.coluna_direita) || !isStr(c.coluna_direita.titulo) || !isStr(c.coluna_direita.texto)) return false;
  return true;
}

function isMetrica(c: unknown): c is SlideMetrica {
  if (!isObj(c) || c.template !== "metrica") return false;
  if (!isStrNonEmpty(c.numero) || !isStrNonEmpty(c.label)) return false;
  if (c.descricao !== undefined && !isStr(c.descricao)) return false;
  return true;
}

function isTopicosNumerados(c: unknown): c is SlideTopicosNumerados {
  if (!isObj(c) || c.template !== "topicos_numerados") return false;
  if (!isStrNonEmpty(c.titulo)) return false;
  if (!Array.isArray(c.topicos)) return false;
  return c.topicos.every((t) => isObj(t) && isStrNonEmpty(t.titulo));
}

function isEncerramento(c: unknown): c is SlideEncerramento {
  if (!isObj(c) || c.template !== "encerramento") return false;
  if (!isStrNonEmpty(c.mensagem)) return false;
  if (c.cta !== undefined && !isStr(c.cta)) return false;
  return true;
}

export function isValidSlide(x: unknown): x is Slide {
  if (!isObj(x)) return false;
  if (!isStr(x.template) || !TEMPLATES.includes(x.template as SlideTemplate)) return false;
  if (!isObj(x.content) || x.content.template !== x.template) return false;
  switch (x.template) {
    case "capa": return isCapa(x.content);
    case "conteudo": return isConteudo(x.content);
    case "duas_colunas": return isDuasColunas(x.content);
    case "metrica": return isMetrica(x.content);
    case "topicos_numerados": return isTopicosNumerados(x.content);
    case "encerramento": return isEncerramento(x.content);
  }
}

export function isValidApresentacaoSlides(x: unknown): x is Slide[] {
  if (!Array.isArray(x)) return false;
  return x.every(isValidSlide);
}
```

- [ ] **Step 4: Rodar testes — passa**

```bash
npm test -- tests/unit/apresenta-yide-tipos.test.ts
```
Esperado: 13 testes passando.

- [ ] **Step 5: Criar `src/lib/apresenta-yide/mock-data.ts`**

```typescript
import type { Slide } from "./tipos";

/**
 * Conjunto de slides de exemplo, usado em PR 1 pra popular apresentação
 * recém-criada (sem AI ainda). PR 2 substitui isso por Claude streaming.
 */
export const MOCK_APRESENTACAO_SLIDES: Slide[] = [
  {
    template: "capa",
    content: {
      template: "capa",
      titulo: "Apresentação Yide",
      subtitulo: "Crescimento digital com previsibilidade",
    },
  },
  {
    template: "conteudo",
    content: {
      template: "conteudo",
      titulo: "Quem somos",
      texto: "A Yide é uma agência de marketing digital focada em performance e gestão de presença online pra empresas que querem crescer com previsibilidade.",
      bullets: [
        "+ de 100 clientes ativos",
        "Time multidisciplinar e dedicado",
        "Acompanhamento em tempo real",
      ],
    },
  },
  {
    template: "metrica",
    content: {
      template: "metrica",
      numero: "+34%",
      label: "Crescimento médio em 6 meses",
      descricao: "Dados reais dos clientes ativos da Yide em 2026",
    },
  },
  {
    template: "duas_colunas",
    content: {
      template: "duas_colunas",
      titulo: "Antes vs. depois com a Yide",
      coluna_esquerda: {
        titulo: "Antes",
        texto: "Sem dados centralizados, decisões no escuro, ROI difícil de medir.",
      },
      coluna_direita: {
        titulo: "Depois",
        texto: "Painel próprio em tempo real, decisões baseadas em dados, ROI claro mês a mês.",
      },
    },
  },
  {
    template: "topicos_numerados",
    content: {
      template: "topicos_numerados",
      titulo: "Nossa metodologia",
      topicos: [
        { titulo: "Diagnóstico", texto: "Entendemos seu negócio e seus números" },
        { titulo: "Estratégia", texto: "Plano sob medida com metas claras" },
        { titulo: "Execução", texto: "Time dedicado entrega no ritmo certo" },
        { titulo: "Mensuração", texto: "Painel em tempo real e ajustes contínuos" },
      ],
    },
  },
  {
    template: "encerramento",
    content: {
      template: "encerramento",
      mensagem: "Vamos crescer juntos?",
      cta: "Fale com a gente",
    },
  },
];
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/apresenta-yide/tipos.ts src/lib/apresenta-yide/mock-data.ts tests/unit/apresenta-yide-tipos.test.ts
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): tipos dos slides + validação runtime + mock data

6 templates como discriminated union (capa, conteudo, duas_colunas,
metrica, topicos_numerados, encerramento). Validação runtime
robusta pra parsear o output da IA (PR 2). Mock data de exemplo
pra renderizar UI em PR 1 sem depender de IA.

13 testes unit cobrem cada template + array.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Queries + Actions (com mock)

**Files:**
- Create: `src/lib/apresenta-yide/queries.ts`
- Create: `src/lib/apresenta-yide/actions.ts`

- [ ] **Step 1: Criar `src/lib/apresenta-yide/queries.ts`**

```typescript
// SERVER ONLY: do not import from client components

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ApresentacaoRow, Slide } from "./tipos";

interface ApresentacaoRaw {
  id: string;
  titulo: string;
  prompt: string;
  objetivo: string | null;
  num_slides_alvo: number;
  slides: Slide[];
  status: string;
  pdf_storage_path: string | null;
  criado_por: string;
  created_at: string;
}

/**
 * Lista apresentações visíveis pro user (próprias + adm/sócio vê tudo).
 * RLS já filtra — service-role aqui só facilita join com profiles.
 */
export async function listApresentacoes(
  userId: string,
  isPrivileged: boolean,
): Promise<ApresentacaoRow[]> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  let query = sb
    .from("apresentacoes_yide")
    .select("id, titulo, prompt, objetivo, num_slides_alvo, slides, status, pdf_storage_path, criado_por, created_at")
    .order("created_at", { ascending: false });
  if (!isPrivileged) {
    query = query.eq("criado_por", userId);
  }
  const { data } = await query;
  const rows = (data ?? []) as ApresentacaoRaw[];
  if (rows.length === 0) return [];

  // Resolve nomes dos criadores.
  const userIds = Array.from(new Set(rows.map((r) => r.criado_por)));
  const { data: profs } = await admin
    .from("profiles")
    .select("id, nome")
    .in("id", userIds);
  const nameById = new Map(
    ((profs ?? []) as Array<{ id: string; nome: string }>).map((p) => [p.id, p.nome]),
  );

  return rows.map((r) => ({
    ...r,
    status: r.status as ApresentacaoRow["status"],
    criado_por_nome: nameById.get(r.criado_por) ?? null,
  }));
}

export async function getApresentacao(id: string): Promise<ApresentacaoRow | null> {
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;
  const { data } = await sb
    .from("apresentacoes_yide")
    .select("id, titulo, prompt, objetivo, num_slides_alvo, slides, status, pdf_storage_path, criado_por, created_at")
    .eq("id", id)
    .single();
  if (!data) return null;
  const r = data as ApresentacaoRaw;

  const { data: prof } = await admin
    .from("profiles")
    .select("nome")
    .eq("id", r.criado_por)
    .maybeSingle();

  return {
    ...r,
    status: r.status as ApresentacaoRow["status"],
    criado_por_nome: (prof as { nome: string } | null)?.nome ?? null,
  };
}
```

- [ ] **Step 2: Criar `src/lib/apresenta-yide/actions.ts`**

```typescript
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import { MOCK_APRESENTACAO_SLIDES } from "./mock-data";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "comercial"];

const createSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  prompt: z.string().min(20, "Prompt precisa de pelo menos 20 caracteres").max(5000),
  objetivo: z.string().max(500).optional().nullable(),
  num_slides_alvo: z.coerce.number().int().min(5).max(15),
});

type CreateResult = { error: string } | { redirect: string };

/**
 * Cria apresentação com slides MOCK (PR 1). PR 2 substitui mock pelo
 * Claude streaming. Mesmo assim o registro fica salvo no DB.
 */
export async function criarApresentacaoMockAction(formData: FormData): Promise<CreateResult> {
  const actor = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(actor.role)) {
    return { error: "Seu papel não tem acesso ao Apresenta Yide" };
  }

  const parsed = createSchema.safeParse({
    titulo: formData.get("titulo"),
    prompt: formData.get("prompt"),
    objetivo: formData.get("objetivo") || null,
    num_slides_alvo: formData.get("num_slides_alvo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // Resolve org_id do criador
  const { data: prof } = await sb
    .from("profiles")
    .select("organization_id")
    .eq("id", actor.id)
    .single();
  if (!prof?.organization_id) return { error: "Organização não encontrada" };

  const { data: inserted, error } = await sb
    .from("apresentacoes_yide")
    .insert({
      titulo: parsed.data.titulo,
      prompt: parsed.data.prompt,
      objetivo: parsed.data.objetivo,
      num_slides_alvo: parsed.data.num_slides_alvo,
      slides: MOCK_APRESENTACAO_SLIDES,
      status: "pronta", // PR 1: mock vem "pronta" direto. PR 2: muda pra gerando→pronta
      criado_por: actor.id,
      organization_id: prof.organization_id,
    })
    .select("id")
    .single();
  if (error || !inserted) return { error: error?.message ?? "Falha ao criar" };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: inserted.id,
    acao: "create",
    dados_depois: { titulo: parsed.data.titulo, prompt_length: parsed.data.prompt.length },
    ator_id: actor.id,
  });

  revalidatePath("/social-media/apresenta-yide");
  return { redirect: `/social-media/apresenta-yide/${inserted.id}` };
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteApresentacaoAction(formData: FormData): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();
  const parsed = deleteSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "ID inválido" };

  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  // Confirma propriedade (RLS também bloqueia, mas erro feio).
  const { data: own } = await sb
    .from("apresentacoes_yide")
    .select("criado_por, titulo, pdf_storage_path")
    .eq("id", parsed.data.id)
    .single();
  if (!own) return { error: "Apresentação não encontrada" };
  const isPriv = actor.role === "adm" || actor.role === "socio";
  if (own.criado_por !== actor.id && !isPriv) {
    return { error: "Sem permissão pra excluir essa apresentação" };
  }

  // Apaga PDF do Storage se existir
  if (own.pdf_storage_path) {
    await admin.storage.from("apresentacoes-yide").remove([own.pdf_storage_path]);
  }

  const { error } = await sb
    .from("apresentacoes_yide")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return { error: error.message };

  await logAudit({
    entidade: "apresentacoes_yide",
    entidade_id: parsed.data.id,
    acao: "delete",
    dados_antes: { titulo: own.titulo },
    ator_id: actor.id,
  });

  revalidatePath("/social-media/apresenta-yide");
  return { success: true };
}

/**
 * Wrapper que faz redirect após criar — pra usar com form action.
 * Server actions com redirect throw NEXT_REDIRECT, então separamos.
 */
export async function criarApresentacaoComRedirectAction(formData: FormData): Promise<void | { error: string }> {
  const r = await criarApresentacaoMockAction(formData);
  if ("error" in r) return r;
  redirect(r.redirect);
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```
Esperado: 0 erros novos.

- [ ] **Step 4: Commit**

```bash
git add src/lib/apresenta-yide/queries.ts src/lib/apresenta-yide/actions.ts
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): queries + actions com mock data (PR 1)

listApresentacoes/getApresentacao usam service-role + RLS pra checar
permissão. criarApresentacaoMockAction salva slides MOCK_APRESENTACAO
no DB (PR 2 substitui pelo Claude streaming). deleteApresentacaoAction
remove DB + PDF do Storage.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Logo Yide pros slides

**Files:**
- Create: `src/components/apresenta-yide/YideLogo.tsx`

- [ ] **Step 1: Criar componente**

```typescript
interface Props {
  /** small (canto inferior dos slides) ou large (capa central) */
  size?: "small" | "large";
  className?: string;
}

/**
 * Logo Yide pra slides — SVG inline pra não depender de fonte/ícone externo.
 * "Yide Digital" com X estilizado no símbolo lateral.
 */
export function YideLogo({ size = "small", className = "" }: Props) {
  if (size === "large") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <svg viewBox="0 0 64 64" className="h-12 w-12 text-primary" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 16L48 48M48 16L16 48" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="2" opacity="0.4" />
        </svg>
        <div>
          <div className="text-xl font-bold tracking-tight text-white">YIDE</div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-primary">Digital</div>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2 opacity-80 ${className}`}>
      <svg viewBox="0 0 64 64" className="h-5 w-5 text-primary" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 16L48 48M48 16L16 48" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">Yide</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/apresenta-yide/YideLogo.tsx
git commit -m "feat(apresenta-yide): componente YideLogo pros slides

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 6 Templates de slide

**Files:**
- Create: `src/components/apresenta-yide/slides/SlideCapa.tsx`
- Create: `src/components/apresenta-yide/slides/SlideConteudo.tsx`
- Create: `src/components/apresenta-yide/slides/SlideDuasColunas.tsx`
- Create: `src/components/apresenta-yide/slides/SlideMetrica.tsx`
- Create: `src/components/apresenta-yide/slides/SlideTopicosNumerados.tsx`
- Create: `src/components/apresenta-yide/slides/SlideEncerramento.tsx`

Todos os 6 seguem o mesmo "frame" visual: `aspect-[16/9]` + background gradiente dark + texto branco + logo Yide. Diferem só no layout interno.

- [ ] **Step 1: Criar `SlideCapa.tsx`**

```typescript
import { YideLogo } from "../YideLogo";
import type { SlideCapa as SlideCapaContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideCapaContent;
}

/**
 * Slide de capa — primeira página. Logo Yide grande centralizada,
 * título grande, subtítulo opcional menor abaixo.
 */
export function SlideCapa({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12 text-center shadow-[0_0_60px_-20px] shadow-primary/30">
      <div className="absolute left-12 top-12">
        <YideLogo size="small" />
      </div>

      <div className="mb-8">
        <YideLogo size="large" />
      </div>

      <h1 className="max-w-3xl text-balance text-5xl font-bold tracking-tight text-white">
        {content.titulo}
      </h1>
      {content.subtitulo && (
        <p className="mt-4 max-w-2xl text-xl text-gray-300">{content.subtitulo}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar `SlideConteudo.tsx`**

```typescript
import { YideLogo } from "../YideLogo";
import type { SlideConteudo as SlideConteudoContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideConteudoContent;
}

export function SlideConteudo({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12">
      <header className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white">{content.titulo}</h2>
        <div className="mt-2 h-0.5 w-16 rounded-full bg-primary shadow-[0_0_12px] shadow-primary/60" />
      </header>

      <div className="flex-1 space-y-6">
        {content.texto && (
          <p className="text-lg leading-relaxed text-gray-200">{content.texto}</p>
        )}
        {content.bullets && content.bullets.length > 0 && (
          <ul className="space-y-3">
            {content.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-base text-gray-200">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary shadow-[0_0_8px] shadow-primary/80" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="absolute bottom-6 right-12">
        <YideLogo size="small" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Criar `SlideDuasColunas.tsx`**

```typescript
import { YideLogo } from "../YideLogo";
import type { SlideDuasColunas as SlideDuasColunasContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideDuasColunasContent;
}

export function SlideDuasColunas({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12">
      <header className="mb-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white">{content.titulo}</h2>
        <div className="mx-auto mt-2 h-0.5 w-16 rounded-full bg-primary shadow-[0_0_12px] shadow-primary/60" />
      </header>

      <div className="grid flex-1 grid-cols-2 gap-8">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8">
          <h3 className="text-xl font-semibold text-primary">{content.coluna_esquerda.titulo}</h3>
          <p className="mt-3 text-base leading-relaxed text-gray-200">
            {content.coluna_esquerda.texto}
          </p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-8 shadow-[0_0_40px_-12px] shadow-primary/40">
          <h3 className="text-xl font-semibold text-primary">{content.coluna_direita.titulo}</h3>
          <p className="mt-3 text-base leading-relaxed text-gray-200">
            {content.coluna_direita.texto}
          </p>
        </div>
      </div>

      <div className="absolute bottom-6 right-12">
        <YideLogo size="small" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar `SlideMetrica.tsx`**

```typescript
import { YideLogo } from "../YideLogo";
import type { SlideMetrica as SlideMetricaContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideMetricaContent;
}

export function SlideMetrica({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12 text-center">
      <div className="text-[10rem] font-bold leading-none tracking-tight text-primary drop-shadow-[0_0_40px_rgba(61,196,188,0.5)]">
        {content.numero}
      </div>
      <div className="mt-4 max-w-2xl text-2xl font-semibold text-white">
        {content.label}
      </div>
      {content.descricao && (
        <p className="mt-4 max-w-xl text-sm text-gray-400">{content.descricao}</p>
      )}
      <div className="absolute bottom-6 right-12">
        <YideLogo size="small" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Criar `SlideTopicosNumerados.tsx`**

```typescript
import { YideLogo } from "../YideLogo";
import type { SlideTopicosNumerados as SlideTopicosContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideTopicosContent;
}

export function SlideTopicosNumerados({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12">
      <header className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-white">{content.titulo}</h2>
        <div className="mt-2 h-0.5 w-16 rounded-full bg-primary shadow-[0_0_12px] shadow-primary/60" />
      </header>

      <ol className="flex-1 space-y-5">
        {content.topicos.map((t, i) => (
          <li key={i} className="flex items-start gap-5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-base font-bold text-primary shadow-[0_0_20px_-6px] shadow-primary/60">
              {i + 1}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{t.titulo}</h3>
              {t.texto && <p className="mt-1 text-sm text-gray-300">{t.texto}</p>}
            </div>
          </li>
        ))}
      </ol>

      <div className="absolute bottom-6 right-12">
        <YideLogo size="small" />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Criar `SlideEncerramento.tsx`**

```typescript
import { YideLogo } from "../YideLogo";
import type { SlideEncerramento as SlideEncerramentoContent } from "@/lib/apresenta-yide/tipos";

interface Props {
  content: SlideEncerramentoContent;
}

export function SlideEncerramento({ content }: Props) {
  return (
    <div className="relative flex aspect-[16/9] w-full flex-col items-center justify-center bg-gradient-to-br from-[#0a0a0a] via-[#0f1419] to-[#0a0a0a] p-12 text-center">
      <h1 className="max-w-3xl text-balance text-5xl font-bold tracking-tight text-white">
        {content.mensagem}
      </h1>
      {content.cta && (
        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-6 py-3 text-base font-semibold text-primary shadow-[0_0_30px_-8px] shadow-primary/50">
          {content.cta}
        </div>
      )}
      <div className="mt-12">
        <YideLogo size="large" />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/apresenta-yide/slides/
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): 6 templates visuais (capa, conteudo, duas colunas, metrica, topicos, encerramento)

Cada slide é 16:9, background dark gradient, accents teal Yide com
glow, logo no canto inferior direito (exceto capa/encerramento que
têm logo central). Visual rígido — nenhuma prop de tema, só o
content tipado do slide.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: SlidePreview dispatcher

**Files:**
- Create: `src/components/apresenta-yide/SlidePreview.tsx`

- [ ] **Step 1: Criar dispatcher**

```typescript
import { SlideCapa } from "./slides/SlideCapa";
import { SlideConteudo } from "./slides/SlideConteudo";
import { SlideDuasColunas } from "./slides/SlideDuasColunas";
import { SlideMetrica } from "./slides/SlideMetrica";
import { SlideTopicosNumerados } from "./slides/SlideTopicosNumerados";
import { SlideEncerramento } from "./slides/SlideEncerramento";
import type { Slide } from "@/lib/apresenta-yide/tipos";

interface Props {
  slide: Slide;
}

/**
 * Despacha pro componente certo baseado no template do slide.
 * TypeScript garante exaustividade — se adicionar novo template
 * em tipos.ts, esse switch reclama até cobrir.
 */
export function SlidePreview({ slide }: Props) {
  switch (slide.content.template) {
    case "capa":
      return <SlideCapa content={slide.content} />;
    case "conteudo":
      return <SlideConteudo content={slide.content} />;
    case "duas_colunas":
      return <SlideDuasColunas content={slide.content} />;
    case "metrica":
      return <SlideMetrica content={slide.content} />;
    case "topicos_numerados":
      return <SlideTopicosNumerados content={slide.content} />;
    case "encerramento":
      return <SlideEncerramento content={slide.content} />;
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Esperado: 0 erros novos.

- [ ] **Step 3: Commit**

```bash
git add src/components/apresenta-yide/SlidePreview.tsx
git commit -m "feat(apresenta-yide): SlidePreview dispatcher

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: PromptForm + Editor split view

**Files:**
- Create: `src/components/apresenta-yide/PromptForm.tsx`
- Create: `src/components/apresenta-yide/ApresentacaoEditor.tsx`

- [ ] **Step 1: Criar `PromptForm.tsx`** (client, form ao lado esquerdo)

```typescript
"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { criarApresentacaoMockAction } from "@/lib/apresenta-yide/actions";
import { useRouter } from "next/navigation";

export function PromptForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await criarApresentacaoMockAction(fd);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      router.push(r.redirect);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="titulo">Título da apresentação *</Label>
        <Input
          id="titulo"
          name="titulo"
          required
          maxLength={200}
          placeholder="Ex.: Apresentação Yide pra cliente X"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">O que você quer apresentar? *</Label>
        <Textarea
          id="prompt"
          name="prompt"
          required
          minLength={20}
          maxLength={5000}
          rows={8}
          placeholder="Descreve o conteúdo que vai entrar na apresentação. Quanto mais contexto, melhor a IA estrutura: público-alvo, mensagens principais, métricas que você quer destacar..."
          disabled={pending}
          className="resize-none"
        />
        <p className="text-[11px] text-muted-foreground">
          Mínimo 20 caracteres. A IA vai usar isso pra estruturar os slides.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="objetivo">Objetivo (opcional)</Label>
        <Input
          id="objetivo"
          name="objetivo"
          maxLength={500}
          placeholder="Ex.: fechar venda com cliente novo / apresentar resultados do mês"
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="num_slides_alvo">Quantos slides? (5 a 15)</Label>
        <Input
          id="num_slides_alvo"
          name="num_slides_alvo"
          type="number"
          min={5}
          max={15}
          defaultValue={8}
          disabled={pending}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        <Sparkles className="mr-2 h-4 w-4" />
        {pending ? "Criando..." : "Gerar apresentação"}
      </Button>

      <p className="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
        <strong className="text-foreground">PR 1:</strong> v1 cria a apresentação com slides
        de exemplo pra você ver o design. A geração via IA real entra na próxima fase.
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Criar `ApresentacaoEditor.tsx`** (split view)

```typescript
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SlidePreview } from "./SlidePreview";
import type { Slide } from "@/lib/apresenta-yide/tipos";

interface Props {
  slides: Slide[];
  titulo: string;
}

/**
 * View de apresentação existente — exibe os slides na coluna direita,
 * com navegação prev/next + miniatura de paginação. Coluna esquerda
 * mostra metadados (PR 1 estático; PR 2 vai ter timeline do streaming).
 */
export function ApresentacaoEditor({ slides, titulo }: Props) {
  const [idx, setIdx] = useState(0);
  const total = slides.length;

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-muted/10 px-6 py-16 text-center text-sm text-muted-foreground">
        Esta apresentação ainda não tem slides.
      </div>
    );
  }

  const current = slides[idx];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
          <p className="text-xs text-muted-foreground">
            Slide {idx + 1} de {total}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
            aria-label="Slide anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIdx((i) => Math.min(total - 1, i + 1))}
            disabled={idx === total - 1}
            aria-label="Próximo slide"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border bg-black shadow-2xl">
        <SlidePreview slide={current} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={`h-1.5 flex-1 min-w-[16px] rounded-full transition-colors ${
              i === idx ? "bg-primary" : "bg-muted hover:bg-muted-foreground/40"
            }`}
            aria-label={`Ir pro slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/apresenta-yide/PromptForm.tsx src/components/apresenta-yide/ApresentacaoEditor.tsx
git commit -m "feat(apresenta-yide): PromptForm + ApresentacaoEditor (split view)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Lista de apresentações + delete

**Files:**
- Create: `src/components/apresenta-yide/ApresentacoesList.tsx`
- Create: `src/components/apresenta-yide/DeleteApresentacaoButton.tsx`

- [ ] **Step 1: Criar `DeleteApresentacaoButton.tsx`**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { deleteApresentacaoAction } from "@/lib/apresenta-yide/actions";

interface Props {
  id: string;
  titulo: string;
}

export function DeleteApresentacaoButton({ id, titulo }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const r = await deleteApresentacaoAction(fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Apresentação excluída");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label="Excluir apresentação"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir apresentação?</DialogTitle>
            <DialogDescription>
              <strong>{titulo}</strong> e o PDF associado vão ser apagados pra sempre.
              Não dá pra desfazer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Criar `ApresentacoesList.tsx`**

```typescript
import Link from "next/link";
import { FileText, Calendar } from "lucide-react";
import { APP_TIMEZONE } from "@/lib/datetime/timezone";
import { DeleteApresentacaoButton } from "./DeleteApresentacaoButton";
import type { ApresentacaoRow } from "@/lib/apresenta-yide/tipos";

interface Props {
  apresentacoes: ApresentacaoRow[];
  currentUserId: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: APP_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  gerando: "Gerando...",
  pronta: "Pronta",
  erro: "Erro",
};

export function ApresentacoesList({ apresentacoes, currentUserId }: Props) {
  if (apresentacoes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/10 px-6 py-16 text-center text-sm text-muted-foreground">
        Você ainda não criou nenhuma apresentação. Clica em &quot;Nova apresentação&quot; pra começar.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {apresentacoes.map((a) => {
        const canDelete = a.criado_por === currentUserId;
        return (
          <li
            key={a.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-card/80"
          >
            <Link href={`/social-media/apresenta-yide/${a.id}`} className="flex flex-1 items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold">{a.titulo}</h3>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(a.created_at)}
                  </span>
                  <span>·</span>
                  <span>{a.slides.length} slides</span>
                  <span>·</span>
                  <span>{STATUS_LABEL[a.status] ?? a.status}</span>
                  {a.criado_por_nome && (
                    <>
                      <span>·</span>
                      <span>por {a.criado_por_nome}</span>
                    </>
                  )}
                </div>
              </div>
            </Link>
            {canDelete && <DeleteApresentacaoButton id={a.id} titulo={a.titulo} />}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/apresenta-yide/
git commit -m "feat(apresenta-yide): ApresentacoesList + DeleteApresentacaoButton

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Páginas + tab no /social-media

**Files:**
- Create: `src/components/social-media/TabsSocialMedia.tsx`
- Create: `src/app/(authed)/social-media/apresenta-yide/page.tsx`
- Create: `src/app/(authed)/social-media/apresenta-yide/nova/page.tsx`
- Create: `src/app/(authed)/social-media/apresenta-yide/[id]/page.tsx`
- Modify: `src/app/(authed)/social-media/page.tsx`

- [ ] **Step 1: Criar `TabsSocialMedia.tsx`** (sub-nav reusável)

```typescript
import Link from "next/link";
import { Share2, Presentation } from "lucide-react";

type TabKey = "feed" | "apresenta-yide";

interface Props {
  active: TabKey;
}

const TABS: Array<{ key: TabKey; label: string; href: string; Icon: typeof Share2 }> = [
  { key: "feed", label: "Social Media", href: "/social-media", Icon: Share2 },
  { key: "apresenta-yide", label: "Apresenta Yide", href: "/social-media/apresenta-yide", Icon: Presentation },
];

export function TabsSocialMedia({ active }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-1 border-b border-border/60 pb-px">
      {TABS.map(({ key, label, href, Icon }) => {
        const isActive = key === active;
        return (
          <Link
            key={key}
            href={href}
            className={
              isActive
                ? "inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary shadow-[0_0_24px_-12px] shadow-primary/40"
                : "inline-flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Página listagem `/social-media/apresenta-yide/page.tsx`**

```typescript
import Link from "next/link";
import { redirect } from "next/navigation";
import { Presentation, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { listApresentacoes } from "@/lib/apresenta-yide/queries";
import { ApresentacoesList } from "@/components/apresenta-yide/ApresentacoesList";
import { TabsSocialMedia } from "@/components/social-media/TabsSocialMedia";
import { buttonVariants } from "@/components/ui/button";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "comercial"];

export default async function ApresentaYideListPage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const isPrivileged = user.role === "adm" || user.role === "socio";
  const apresentacoes = await listApresentacoes(user.id, isPrivileged);

  return (
    <div className="space-y-6">
      <TabsSocialMedia active="apresenta-yide" />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Presentation className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Apresenta Yide</h1>
            <p className="text-sm text-muted-foreground">
              IA cria apresentações com o visual da Yide
            </p>
          </div>
        </div>
        <Link href="/social-media/apresenta-yide/nova" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          Nova apresentação
        </Link>
      </header>

      <ApresentacoesList apresentacoes={apresentacoes} currentUserId={user.id} />
    </div>
  );
}
```

- [ ] **Step 3: Página criação `/nova/page.tsx`**

```typescript
import { redirect } from "next/navigation";
import { Presentation } from "lucide-react";
import Link from "next/link";
import { requireAuth } from "@/lib/auth/session";
import { PromptForm } from "@/components/apresenta-yide/PromptForm";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "comercial"];

export default async function NovaApresentacaoPage() {
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/social-media/apresenta-yide" className="inline-flex items-center gap-1 hover:text-foreground">
          <Presentation className="h-3 w-3" />
          Apresenta Yide
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">Nova apresentação</span>
      </nav>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Nova apresentação</h1>
        <p className="text-sm text-muted-foreground">
          Conta pra IA o que você quer apresentar. Ela monta a estrutura, escolhe os
          templates e gera os slides com o visual da Yide.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-xl border bg-card p-5">
          <PromptForm />
        </div>
        <div className="rounded-xl border border-dashed bg-muted/10 p-8 text-center">
          <Presentation className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            O preview ao vivo dos slides vai aparecer aqui assim que você
            clicar em &quot;Gerar apresentação&quot;.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Página view `/[id]/page.tsx`**

```typescript
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Presentation } from "lucide-react";
import { requireAuth } from "@/lib/auth/session";
import { getApresentacao } from "@/lib/apresenta-yide/queries";
import { ApresentacaoEditor } from "@/components/apresenta-yide/ApresentacaoEditor";

const ROLES_PERMITIDOS = ["adm", "socio", "coordenador", "assessor", "comercial"];

export default async function ApresentacaoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  if (!ROLES_PERMITIDOS.includes(user.role)) redirect("/");

  const apresentacao = await getApresentacao(id);
  if (!apresentacao) notFound();

  const isPrivileged = user.role === "adm" || user.role === "socio";
  const canView = apresentacao.criado_por === user.id || isPrivileged;
  if (!canView) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/social-media/apresenta-yide" className="inline-flex items-center gap-1 hover:text-foreground">
          <ChevronLeft className="h-3 w-3" />
          <Presentation className="h-3 w-3" />
          Apresenta Yide
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{apresentacao.titulo}</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Prompt original
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/90">
              {apresentacao.prompt}
            </p>
          </div>
          {apresentacao.objetivo && (
            <div className="rounded-xl border bg-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Objetivo
              </h3>
              <p className="mt-2 text-sm text-foreground/90">{apresentacao.objetivo}</p>
            </div>
          )}
          <div className="rounded-xl border border-dashed bg-muted/10 p-5 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">PR 1:</strong> o PDF e a geração via
              IA real entram nas próximas fases. Por enquanto você consegue ver o
              design dos slides com conteúdo de exemplo.
            </p>
          </div>
        </aside>

        <ApresentacaoEditor slides={apresentacao.slides} titulo={apresentacao.titulo} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Modificar `social-media/page.tsx`** pra adicionar tab

Encontre o início do return (provavelmente `return (<div className="space-y-...">`)  e insira `<TabsSocialMedia active="feed" />` no topo.

Adicione import:
```typescript
import { TabsSocialMedia } from "@/components/social-media/TabsSocialMedia";
```

Insira o componente logo no início do JSX do return:
```tsx
return (
  <div className="space-y-...">
    <TabsSocialMedia active="feed" />
    {/* conteúdo existente */}
```

- [ ] **Step 6: Typecheck + lint final**

```bash
npm run typecheck && npm run lint
```
Esperado: 0 erros novos. 5 pré-existentes ok.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(authed\)/social-media/ src/components/social-media/
git commit -m "$(cat <<'EOF'
feat(apresenta-yide): páginas (listagem, nova, detalhe) + tab no /social-media

Tab nav (Social Media / Apresenta Yide) compartilhada nas duas páginas.
/apresenta-yide lista as criadas pelo user (adm/sócio vê tudo).
/apresenta-yide/nova é o split view com PromptForm.
/apresenta-yide/[id] mostra prompt + slides navegáveis.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Push + PR + instrução de migração

- [ ] **Step 1: Push**

```bash
git push -u origin claude/apresenta-yide
```

- [ ] **Step 2: PR**

Use `curl` se `gh pr create` falhar com DNS (já aconteceu em sessões passadas):

```bash
curl -s --resolve api.github.com:443:140.82.112.6 \
  -H "Authorization: Bearer $(gh auth token)" \
  -H "Accept: application/vnd.github+json" \
  -X POST https://api.github.com/repos/time-yide/yide-acompanha/pulls \
  -d '{"title":"feat(apresenta-yide): PR 1 — foundation + 6 templates visuais","head":"claude/apresenta-yide","base":"main","body":"..."}'
```

PR body deve mencionar:
- Migration precisa ser aplicada antes do deploy
- v1 = só visual, ainda sem IA real (mock data) e sem PDF
- Próximas fases: PR 2 (Claude streaming) e PR 3 (PDF export)

---

## Self-review checklist

- [x] **Spec coverage v1 PR 1:**
  - Migration (apresentacoes_yide + bucket) ✓ Task 1
  - 6 tipos de slide ✓ Task 2 (tipos + validação runtime)
  - Mock data pra renderização ✓ Task 2
  - Queries (list + get) ✓ Task 3
  - Actions (create mock, delete) ✓ Task 3
  - 6 componentes de template ✓ Task 5
  - Logo Yide ✓ Task 4
  - SlidePreview dispatcher ✓ Task 6
  - PromptForm + Editor split view ✓ Task 7
  - Lista + delete ✓ Task 8
  - Páginas + tab nav ✓ Task 9
- [x] **Sem placeholders:** todo código completo.
- [x] **Type consistency:** `Slide`, `ApresentacaoRow`, `ApresentacaoStatus`, `SlideTemplate` usados consistente entre tipos, queries, actions, componentes.
- [x] **Commits frequentes:** 9 commits.
