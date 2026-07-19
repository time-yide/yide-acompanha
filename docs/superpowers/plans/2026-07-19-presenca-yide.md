# Presença da Yide (GMN + LinkedIn) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps com checkbox.

**Goal:** Painel `/programacao/presenca` (abas GMN + LinkedIn) com checklist de otimização e geração de posts por IA (SEO local).

**Architecture:** Reaproveita o motor de IA/keywords do blog/seo. Tabelas `presenca_posts` + `presenca_checklist` via service-role. Funções puras testadas. Client workspace com abas + server actions.

**Tech Stack:** Next.js 16, Supabase, Anthropic (`claude-haiku-4-5`), Tailwind, vitest.

**Reusar:** `@/lib/supabase/service-role`, `@/lib/ai/client` (`getAnthropicClient`), `@/lib/blog/texto` (`semTravessao`), `@/lib/blog/pipeline/gerar` (`extrairJson`), `@/lib/blog/pipeline/keywords` (`selecionarKeywordsAlvo`), `@/lib/blog/form` (`parseBoolCampo`), `@/lib/seo/config` (`YIDE_NAP`), `@/lib/auth/session`, `@/lib/gerador-leads/queries` (`getOrganizationId`), `@/lib/blog/acesso` (`podeGerenciarBlog`). Moldes UI: `src/components/seo/*`, `src/app/(authed)/programacao/seo/*`.

---

## Task 1: Migration

**Files:** Create `supabase/migrations/20260719070000_presenca.sql`

- [ ] **Step 1:**

```sql
-- Presença da Yide: posts gerados (GMN/LinkedIn) + estado do checklist por perfil.
create table if not exists public.presenca_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canal text not null check (canal in ('gmn','linkedin')),
  tema text not null default '',
  conteudo text not null,
  hashtags text[] not null default '{}',
  status text not null default 'rascunho' check (status in ('rascunho','usado','arquivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists presenca_posts_idx on public.presenca_posts (organization_id, canal, created_at desc);

create table if not exists public.presenca_checklist (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  canal text not null check (canal in ('gmn','linkedin')),
  feitos jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  unique (organization_id, canal)
);

alter table public.presenca_posts enable row level security;
alter table public.presenca_checklist enable row level security;
-- Sem policy: acesso só via service-role (painel interno).
```

- [ ] **Step 2: Commit** `feat(presenca): migration presenca_posts + presenca_checklist`

---

## Task 2: Config (checklists)

**Files:** Create `src/lib/presenca/config.ts`

- [ ] **Step 1:**

```ts
export type Canal = "gmn" | "linkedin";
export interface ItemChecklist { key: string; titulo: string; dica: string }

export const CHECKLIST_GMN: ItemChecklist[] = [
  { key: "categoria", titulo: "Categoria principal correta", dica: "Ex.: Agência de marketing. É o que mais pesa pra aparecer nas buscas locais." },
  { key: "categorias_sec", titulo: "Categorias secundárias relevantes", dica: "Adicione todas que fizerem sentido (tráfego, criação de sites, etc.)." },
  { key: "descricao", titulo: "Descrição com palavras-chave locais", dica: "Cite serviços + cidades (Cuiabá, Várzea Grande, Salvador, Vila Velha)." },
  { key: "horario", titulo: "Horário de funcionamento completo", dica: "Preencha todos os dias, inclusive feriados especiais." },
  { key: "fotos", titulo: "Fotos atualizadas", dica: "Fachada, equipe, bastidores e trabalhos. Poste fotos com frequência." },
  { key: "servicos", titulo: "Produtos/serviços cadastrados", dica: "Liste cada serviço com descrição e valor (se aplicável)." },
  { key: "area", titulo: "Área de atendimento definida", dica: "Defina as praças que a Yide atende." },
  { key: "avaliacoes", titulo: "Responder todas as avaliações", dica: "Responda toda avaliação, positiva ou negativa. Peça avaliações aos clientes." },
  { key: "qa", titulo: "Perguntas e respostas (Q&A)", dica: "Crie perguntas frequentes e responda." },
  { key: "post_semanal", titulo: "Publicar post toda semana", dica: "Use o gerador de posts aqui do lado." },
  { key: "nap", titulo: "NAP consistente", dica: "Nome, telefone, endereço e site iguais em todos os lugares." },
  { key: "site", titulo: "Link do site oficial", dica: "Aponte pro yidedigital.com.br." },
];

export const CHECKLIST_LINKEDIN: ItemChecklist[] = [
  { key: "headline", titulo: "Headline com palavras-chave", dica: "Ex.: Agência de marketing e tecnologia em Cuiabá." },
  { key: "sobre", titulo: "Seção 'Sobre' otimizada", dica: "Descreva serviços e diferenciais com keywords locais." },
  { key: "logo", titulo: "Logo e capa atualizadas", dica: "Identidade visual da Yide na foto e na capa." },
  { key: "site", titulo: "Link do site no perfil", dica: "Adicione o yidedigital.com.br." },
  { key: "regular", titulo: "Publicar com regularidade", dica: "2 a 3 vezes por semana. Use o gerador ao lado." },
  { key: "funcionarios", titulo: "Funcionários vinculados", dica: "Peça ao time pra vincular a página nos perfis." },
  { key: "especialidades", titulo: "Especialidades preenchidas", dica: "Liste as áreas de atuação da Yide." },
  { key: "cta", titulo: "Botão de CTA configurado", dica: "Ex.: 'Visite o site' ou 'Fale conosco'." },
  { key: "local", titulo: "Localização e setor corretos", dica: "Cuiabá/MT e setor de marketing/publicidade." },
];

export function checklistDoCanal(canal: Canal): ItemChecklist[] {
  return canal === "gmn" ? CHECKLIST_GMN : CHECKLIST_LINKEDIN;
}
```

- [ ] **Step 2: Commit** `feat(presenca): config dos checklists`

---

## Task 3: Funções puras + testes

**Files:** Create `src/lib/presenca/core.ts`, Test `tests/unit/presenca-core.test.ts`

- [ ] **Step 1: Teste que falha**

```ts
import { describe, it, expect } from "vitest";
import { progressoChecklist, parsePostPresenca, montarPromptPresenca } from "@/lib/presenca/core";
import { CHECKLIST_GMN } from "@/lib/presenca/config";

describe("progressoChecklist", () => {
  it("calcula feitos/total/pct", () => {
    const r = progressoChecklist(CHECKLIST_GMN, ["categoria", "site", "inexistente"]);
    expect(r.total).toBe(CHECKLIST_GMN.length);
    expect(r.feitos).toBe(2); // ignora key inexistente
    expect(r.pct).toBe(Math.round((2 / CHECKLIST_GMN.length) * 100));
  });
  it("lista vazia = 0%", () => {
    expect(progressoChecklist(CHECKLIST_GMN, []).pct).toBe(0);
  });
});

describe("parsePostPresenca", () => {
  it("sanitiza travessão e limita hashtags", () => {
    const r = parsePostPresenca({ conteudo: "post — aqui", hashtags: ["#a", "#b", 1, "#c", "#d", "#e", "#f"] });
    expect(r).not.toBeNull();
    expect(r!.conteudo.includes("—")).toBe(false);
    expect(r!.hashtags.length).toBeLessThanOrEqual(5);
  });
  it("null sem conteúdo", () => {
    expect(parsePostPresenca({ conteudo: "" })).toBeNull();
    expect(parsePostPresenca(null)).toBeNull();
  });
});

describe("montarPromptPresenca", () => {
  it("GMN pede post curto; LinkedIn pede hashtags", () => {
    expect(montarPromptPresenca("gmn", "promoção", ["marketing em Cuiabá"])).toContain("Google Meu Negócio");
    expect(montarPromptPresenca("linkedin", "", ["marketing em Cuiabá"])).toContain("LinkedIn");
  });
});
```

- [ ] **Step 2: Falhar** — `npx vitest run tests/unit/presenca-core.test.ts --exclude '**/.claude/**'`

- [ ] **Step 3: Implementar**

```ts
import { semTravessao } from "@/lib/blog/texto";
import type { Canal, ItemChecklist } from "./config";

export function progressoChecklist(itens: ItemChecklist[], feitos: string[]): { feitos: number; total: number; pct: number } {
  const set = new Set(feitos);
  const n = itens.filter((i) => set.has(i.key)).length;
  const total = itens.length;
  return { feitos: n, total, pct: total ? Math.round((n / total) * 100) : 0 };
}

export interface PostPresenca { conteudo: string; hashtags: string[] }
export function parsePostPresenca(raw: Record<string, unknown> | null): PostPresenca | null {
  if (!raw || typeof raw.conteudo !== "string") return null;
  const conteudo = semTravessao(raw.conteudo.trim());
  if (!conteudo) return null;
  const hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags.filter((h): h is string => typeof h === "string" && h.trim() !== "").map((h) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 5)
    : [];
  return { conteudo, hashtags };
}

export function montarPromptPresenca(canal: Canal, tema: string, keywords: string[]): string {
  const kw = keywords.length ? `\nTrabalhe de forma NATURAL, quando couber, expressões de SEO local: ${keywords.join(", ")}.` : "";
  const temaTxt = tema.trim() ? `\nTema/assunto: ${tema.trim()}` : "\nEscolha um tema útil e atual sobre marketing, tecnologia ou os serviços da Yide.";
  const regra = "NUNCA use travessão nem meia-risca (use vírgula, dois-pontos, ponto ou parênteses).";
  if (canal === "gmn") {
    return `Você escreve para o Google Meu Negócio da Yide Digital (agência de marketing e programação, Cuiabá-MT). Escreva um POST curto (até ~1200 caracteres) em pt-br, com gancho local, valor pro cliente e um CTA claro. ${regra}${kw}${temaTxt}

Responda SOMENTE com JSON: {"conteudo": "texto do post", "hashtags": []}`;
  }
  return `Você escreve para o LinkedIn da Yide Digital (agência de marketing e programação, Cuiabá-MT). Escreva um POST profissional em pt-br (2 a 5 parágrafos curtos), tom de autoridade, com uma ideia útil e um CTA sutil. Ao final, sugira de 3 a 5 hashtags relevantes. ${regra}${kw}${temaTxt}

Responda SOMENTE com JSON: {"conteudo": "texto do post", "hashtags": ["#exemplo"]}`;
}
```

- [ ] **Step 4: Passar** · **Step 5: Commit** `feat(presenca): funções puras (progresso, parse, prompt) + testes`

---

## Task 4: Queries + pipeline + actions

**Files:** Create `src/lib/presenca/queries.ts`, `src/lib/presenca/pipeline.ts`, `src/lib/presenca/actions.ts`

- [ ] **Step 1: queries.ts**

```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { Canal } from "./config";

export interface PostRow { id: string; canal: string; tema: string; conteudo: string; hashtags: string[]; status: string; created_at: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }

export async function getOrgPadrao(): Promise<string | null> {
  const { data } = await sb().from("organizations").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}
export async function listPostsPresenca(orgId: string, canal: Canal): Promise<PostRow[]> {
  const { data } = await sb().from("presenca_posts").select("id, canal, tema, conteudo, hashtags, status, created_at")
    .eq("organization_id", orgId).eq("canal", canal).neq("status", "arquivado").order("created_at", { ascending: false });
  return (data ?? []) as PostRow[];
}
export async function getChecklistFeitos(orgId: string, canal: Canal): Promise<string[]> {
  const { data } = await sb().from("presenca_checklist").select("feitos").eq("organization_id", orgId).eq("canal", canal).maybeSingle();
  const f = (data as { feitos?: unknown } | null)?.feitos;
  return Array.isArray(f) ? f.filter((x): x is string => typeof x === "string") : [];
}
```

- [ ] **Step 2: pipeline.ts**

```ts
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getAnthropicClient } from "@/lib/ai/client";
import { extrairJson } from "@/lib/blog/pipeline/gerar";
import { selecionarKeywordsAlvo } from "@/lib/blog/pipeline/keywords";
import { montarPromptPresenca, parsePostPresenca } from "./core";
import type { Canal } from "./config";

const MODEL = "claude-haiku-4-5";

export async function gerarPostPresenca(orgId: string, canal: Canal, tema: string): Promise<boolean> {
  const client = getAnthropicClient();
  if (!client) { console.error("[presenca] Anthropic não configurado"); return false; }
  try {
    const res = await client.messages.create({ model: MODEL, max_tokens: 1500,
      messages: [{ role: "user", content: montarPromptPresenca(canal, tema, selecionarKeywordsAlvo(4)) }] });
    const txt = res.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    const parsed = parsePostPresenca(extrairJson(txt));
    if (!parsed) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb: any = createServiceRoleClient();
    const { error } = await sb.from("presenca_posts").insert({
      organization_id: orgId, canal, tema: tema.trim(), conteudo: parsed.conteudo, hashtags: parsed.hashtags, status: "rascunho",
    });
    if (error) { console.error("[presenca] insert:", error.message); return false; }
    return true;
  } catch (e) { console.error("[presenca] gerarPostPresenca:", e); return false; }
}
```

- [ ] **Step 3: actions.ts**

```ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { parseBoolCampo } from "@/lib/blog/form";
import { getChecklistFeitos } from "./queries";
import { gerarPostPresenca } from "./pipeline";

interface Err { error: string }
type Result = { success: true } | Err;
const uuidLike = z.string().regex(/^[0-9a-fA-F-]{36}$/, "ID inválido");
const canalSchema = z.enum(["gmn", "linkedin"]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sb(): any { return createServiceRoleClient(); }
async function gate(): Promise<{ orgId: string } | Err> {
  const a = await requireAuth();
  if (!podeGerenciarBlog(a.role)) return { error: "Sem permissão" };
  const orgId = await getOrganizationId(a.id);
  if (!orgId) return { error: "Sem organização" };
  return { orgId };
}

export async function gerarPostPresencaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const canal = canalSchema.safeParse(formData.get("canal"));
  if (!canal.success) return { error: "Canal inválido" };
  const ok = await gerarPostPresenca(g.orgId, canal.data, String(formData.get("tema") ?? ""));
  revalidatePath("/programacao/presenca");
  return ok ? { success: true } : { error: "Não consegui gerar agora. Tente de novo." };
}

export async function marcarChecklistAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const canal = canalSchema.safeParse(formData.get("canal"));
  const key = String(formData.get("key") ?? "").trim();
  if (!canal.success || !key) return { error: "Dados inválidos" };
  const feito = parseBoolCampo(formData.get("feito"));
  const atuais = await getChecklistFeitos(g.orgId, canal.data);
  const set = new Set(atuais);
  if (feito) set.add(key); else set.delete(key);
  const { error } = await sb().from("presenca_checklist").upsert(
    { organization_id: g.orgId, canal: canal.data, feitos: [...set], updated_at: new Date().toISOString() },
    { onConflict: "organization_id,canal" });
  if (error) return { error: error.message };
  revalidatePath("/programacao/presenca");
  return { success: true };
}

export async function arquivarPostPresencaAction(formData: FormData): Promise<Result> {
  const g = await gate(); if ("error" in g) return g;
  const id = String(formData.get("id") ?? "");
  if (!uuidLike.safeParse(id).success) return { error: "ID inválido" };
  const { data, error } = await sb().from("presenca_posts")
    .update({ status: "arquivado", updated_at: new Date().toISOString() })
    .eq("id", id).eq("organization_id", g.orgId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Post não encontrado" };
  revalidatePath("/programacao/presenca");
  return { success: true };
}
```

- [ ] **Step 4: tsc + eslint src/lib/presenca** · **Step 5: Commit** `feat(presenca): queries, pipeline (IA) e actions`

---

## Task 5: UI — workspace + componentes

**Files:** Create `src/components/presenca/PresencaWorkspace.tsx` (client), `ChecklistItem.tsx`, `GerarPostButton.tsx`, `CopyButton.tsx`, `ArquivarPostButton.tsx`.

Dados (props do workspace):
```ts
interface CanalData { posts: PostRow[]; feitos: string[] }
interface Props { gmn: CanalData; linkedin: CanalData }
```

- [ ] **Step 1:** componentes client:
  - `ChecklistItem` — checkbox + título + dica; ao alternar, chama `marcarChecklistAction` (FormData canal/key/feito) e `router.refresh()`. Molde de padrão dos botões do blog (`useTransition`, `toast`).
  - `GerarPostButton` — campo de tema opcional (input) + botão "Gerar post com IA" (confirm), chama `gerarPostPresencaAction`. Toast + refresh.
  - `CopyButton` — copia o conteúdo (`navigator.clipboard.writeText`), toast "Copiado!".
  - `ArquivarPostButton` — chama `arquivarPostPresencaAction`.
- [ ] **Step 2:** `PresencaWorkspace` (client) — abas "Google Meu Negócio" / "LinkedIn" (estado `useState`). Em cada aba:
  - **Checklist**: barra de progresso (usa `progressoChecklist(checklistDoCanal(canal), feitos)` — importar de `@/lib/presenca/core` e `config`) + lista de `ChecklistItem`.
  - **Posts**: `GerarPostButton` + lista de rascunhos (conteúdo, hashtags, data) com `CopyButton` e `ArquivarPostButton`.
  - Aviso no GMN: "Cole no seu Google Meu Negócio" (semi-automático); no LinkedIn: "Copie e publique no LinkedIn (publicação automática em breve)".
- [ ] **Step 3: eslint src/components/presenca** · **Step 4: Commit** `feat(presenca): workspace com abas, checklist e posts`

---

## Task 6: Rota + menu

**Files:** Create `src/app/(authed)/programacao/presenca/page.tsx`; Modify menu da Programação.

- [ ] **Step 1: page** (`force-dynamic`, gate `podeGerenciarBlog`):

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { getOrganizationId } from "@/lib/gerador-leads/queries";
import { podeGerenciarBlog } from "@/lib/blog/acesso";
import { listPostsPresenca, getChecklistFeitos } from "@/lib/presenca/queries";
import { PresencaWorkspace } from "@/components/presenca/PresencaWorkspace";

export const dynamic = "force-dynamic";

export default async function PresencaPage() {
  const user = await requireAuth();
  if (!podeGerenciarBlog(user.role)) notFound();
  const orgId = await getOrganizationId(user.id);
  if (!orgId) notFound();
  const [gp, gf, lp, lf] = await Promise.all([
    listPostsPresenca(orgId, "gmn"), getChecklistFeitos(orgId, "gmn"),
    listPostsPresenca(orgId, "linkedin"), getChecklistFeitos(orgId, "linkedin"),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Presença &amp; Autoridade</h1>
        <p className="text-sm text-muted-foreground">Otimize o Google Meu Negócio e o LinkedIn da Yide pra ranquear melhor no Google e ser citada por IA.</p>
      </div>
      <PresencaWorkspace gmn={{ posts: gp, feitos: gf }} linkedin={{ posts: lp, feitos: lf }} />
    </div>
  );
}
```

- [ ] **Step 2:** adicionar link "Presença & Autoridade" no menu da Programação (`grep -rn "programacao/seo" "src/app/(authed)/programacao/page.tsx"` e seguir o mesmo padrão do item; ícone lucide `Megaphone` ou `Sparkles`, href `/programacao/presenca`).
- [ ] **Step 3: tsc + eslint + `npm run build`** (rotas `/programacao/presenca`). Reverter `public/sw.js` se mudar. · **Step 4: Commit** `feat(presenca): rota e link no menu`

---

## Task 7: PR + migration

- [ ] `git push -u origin feat/presenca-yide` → PR → CI verde → merge squash.
- [ ] Entregar SQL da migration; instruir: rodar no SQL Editor → abrir Programação → Presença & Autoridade → marcar checklist e gerar posts.

---

## Self-Review (feito)
- **Cobertura:** tabelas (T1); checklists (T2); puras+testes progresso/parse/prompt (T3); queries/pipeline/actions com parseBoolCampo (T4); UI abas+checklist+posts+copiar (T5); rota+menu (T6). ✓
- **Consistência:** `Canal`/`ItemChecklist` (T2) em T3/T4/T5; `PostPresenca`/`parsePostPresenca` (T3) em T4; `PostRow` (T4-queries) em T5/T6. `checklistDoCanal` (T2) usado no workspace.
- **Sem travessão** via `semTravessao` no parse.
- **Placeholders:** UI referencia moldes reais (blog/seo) com estrutura explícita.
