# Resultados públicos por pesquisa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Permitir marcar uma pesquisa como "resultados abertos ao time", fazendo o time inteiro ver uma visão só-agregada (sem nomes), enquanto as demais seguem só-gestão.

**Architecture:** Nova coluna `resultados_publicos` em `pesquisas` (espelha `anonima`). Toggle na criação. A tela de resultados ganha um modo "time" que renderiza só o agregado (componente extraído `PerguntasAgregadas`, reusado por gestão e time). Descoberta via seção na listagem.

**Tech Stack:** Next.js App Router (modificado — checar `node_modules/next/dist/docs/` p/ padrões novos), Supabase service-role, base-ui, Zod.

---

## File Structure
- Create: `supabase/migrations/20260725000000_pesquisas_resultados_publicos.sql`
- Modify: `src/lib/pesquisas/schema.ts` (createPesquisaSchema + PesquisaRow)
- Modify: `src/components/pesquisas/NovaPesquisaForm.tsx` (Switch)
- Modify: `src/lib/pesquisas/actions.ts` (create + update gravam o campo)
- Modify: `src/lib/pesquisas/queries.ts` (select + `listPesquisasPublicas`)
- Create: `src/components/pesquisas/PerguntasAgregadas.tsx` (extrai `Barra` + agregado)
- Modify: `src/components/pesquisas/ResultadosView.tsx` (usa o extraído)
- Create: `src/components/pesquisas/ResultadosPublicosView.tsx` (visão time)
- Modify: `src/app/(authed)/pesquisas/[id]/page.tsx` (acesso por modo)
- Modify: `src/app/(authed)/pesquisas/page.tsx` (seção "Resultados abertos ao time")

> Migration é aplicada manualmente pelo humano, na fase de deploy — NÃO rode contra o banco.

---

## Task 1: Migration

**Files:** Create `supabase/migrations/20260725000000_pesquisas_resultados_publicos.sql`

- [ ] **Step 1: Criar o arquivo**

```sql
-- Quando true, os resultados AGREGADOS (sem nomes) da pesquisa ficam visíveis pro
-- time todo. Default false = só a gestão (manage:pesquisas) vê, como hoje.
alter table public.pesquisas
  add column if not exists resultados_publicos boolean not null default false;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260725000000_pesquisas_resultados_publicos.sql
git commit -m "feat(pesquisas): coluna resultados_publicos (migration manual)"
```

---

## Task 2: Schema — flag no Zod e no tipo

**Files:** Modify `src/lib/pesquisas/schema.ts`

- [ ] **Step 1: Adicionar ao `createPesquisaSchema`**

Localize:
```ts
export const createPesquisaSchema = z.object({
  titulo: z.string().min(2, "Título muito curto"),
  descricao: z.string().optional().nullable(),
  anonima: z.coerce.boolean().default(false),
});
```
Substitua por:
```ts
export const createPesquisaSchema = z.object({
  titulo: z.string().min(2, "Título muito curto"),
  descricao: z.string().optional().nullable(),
  anonima: z.coerce.boolean().default(false),
  resultados_publicos: z.coerce.boolean().default(false),
});
```

- [ ] **Step 2: Adicionar ao `PesquisaRow`**

Localize a interface `PesquisaRow` e o campo `anonima: boolean;`:
```ts
export interface PesquisaRow {
  id: string;
  titulo: string;
  descricao: string | null;
  anonima: boolean;
  status: PesquisaStatus;
```
Substitua por (adiciona `resultados_publicos` logo após `anonima`):
```ts
export interface PesquisaRow {
  id: string;
  titulo: string;
  descricao: string | null;
  anonima: boolean;
  resultados_publicos: boolean;
  status: PesquisaStatus;
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pesquisas/schema.ts
git commit -m "feat(pesquisas): resultados_publicos no schema e no tipo PesquisaRow"
```

---

## Task 3: Toggle no formulário de criação

**Files:** Modify `src/components/pesquisas/NovaPesquisaForm.tsx`

- [ ] **Step 1: Estado**

Localize:
```tsx
  const [anonima, setAnonima] = useState(false);
  const [pending, startTransition] = useTransition();
```
Substitua por:
```tsx
  const [anonima, setAnonima] = useState(false);
  const [resultadosPublicos, setResultadosPublicos] = useState(false);
  const [pending, startTransition] = useTransition();
```

- [ ] **Step 2: Enviar no FormData**

Localize:
```tsx
    fd.set("anonima", anonima ? "true" : "false");
```
Substitua por:
```tsx
    fd.set("anonima", anonima ? "true" : "false");
    fd.set("resultados_publicos", resultadosPublicos ? "true" : "false");
```

- [ ] **Step 3: Adicionar o Switch na UI**

Localize o bloco do switch de anônima:
```tsx
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Respostas anônimas</p>
          <p className="text-xs text-muted-foreground">Você vê só o resultado agregado, sem ligar a resposta à pessoa.</p>
        </div>
        <Switch checked={anonima} onCheckedChange={setAnonima} />
      </div>
```
Substitua por (mantém o de anônima e adiciona o novo logo abaixo):
```tsx
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Respostas anônimas</p>
          <p className="text-xs text-muted-foreground">Você vê só o resultado agregado, sem ligar a resposta à pessoa.</p>
        </div>
        <Switch checked={anonima} onCheckedChange={setAnonima} />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Liberar resultados pro time</p>
          <p className="text-xs text-muted-foreground">O time todo vê os resultados agregados (sem nomes). Desligado = só a gestão vê.</p>
        </div>
        <Switch checked={resultadosPublicos} onCheckedChange={setResultadosPublicos} />
      </div>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/pesquisas/NovaPesquisaForm.tsx
git commit -m "feat(pesquisas): toggle 'liberar resultados pro time' na criação"
```

---

## Task 4: Actions gravam o campo

**Files:** Modify `src/lib/pesquisas/actions.ts`

- [ ] **Step 1: `createPesquisaAction` — parse + insert**

Localize (parse):
```ts
  const parsed = createPesquisaSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    anonima: fd(formData, "anonima") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient() as SB;
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();
```
Substitua por:
```ts
  const parsed = createPesquisaSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    anonima: fd(formData, "anonima") === "true",
    resultados_publicos: fd(formData, "resultados_publicos") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient() as SB;
  const { data: org } = await sb.from("organizations").select("id").limit(1).single();
```

Localize (insert):
```ts
    .insert({
      organization_id: org.id,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      anonima: parsed.data.anonima,
      status: "rascunho",
      criado_por: actor.id,
    })
```
Substitua por:
```ts
    .insert({
      organization_id: org.id,
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      anonima: parsed.data.anonima,
      resultados_publicos: parsed.data.resultados_publicos,
      status: "rascunho",
      criado_por: actor.id,
    })
```

- [ ] **Step 2: `updatePesquisaAction` — parse + update (paridade com anonima)**

Localize (parse dentro de `updatePesquisaAction`):
```ts
  const parsed = createPesquisaSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    anonima: fd(formData, "anonima") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient() as SB;
  const { data: rows, error } = await sb
    .from("pesquisas")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      anonima: parsed.data.anonima,
      updated_at: new Date().toISOString(),
    })
```
Substitua por:
```ts
  const parsed = createPesquisaSchema.safeParse({
    titulo: fd(formData, "titulo"),
    descricao: fd(formData, "descricao"),
    anonima: fd(formData, "anonima") === "true",
    resultados_publicos: fd(formData, "resultados_publicos") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const sb = createServiceRoleClient() as SB;
  const { data: rows, error } = await sb
    .from("pesquisas")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao ?? null,
      anonima: parsed.data.anonima,
      resultados_publicos: parsed.data.resultados_publicos,
      updated_at: new Date().toISOString(),
    })
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pesquisas/actions.ts
git commit -m "feat(pesquisas): actions gravam resultados_publicos"
```

---

## Task 5: Queries — select + listagem de públicas

**Files:** Modify `src/lib/pesquisas/queries.ts`

- [ ] **Step 1: Incluir a coluna no select de `getPesquisaComPerguntas`**

Localize (dentro de `getPesquisaComPerguntas`, o select da pesquisa):
```ts
    .select("id, titulo, descricao, anonima, status, criado_por, disparada_em, prazo, encerrada_em, created_at")
```
Há VÁRIAS ocorrências dessa string no arquivo. Troque APENAS a que está dentro de
`getPesquisaComPerguntas` (a que é seguida por `.eq("id", ...)` e um `.single()` que
popula `pesquisa`). Substitua por:
```ts
    .select("id, titulo, descricao, anonima, resultados_publicos, status, criado_por, disparada_em, prazo, encerrada_em, created_at")
```
(As outras ocorrências — `listMinhasPesquisas`, `listPesquisasPendentes` — NÃO precisam
mudar; elas não usam `resultados_publicos`.)

- [ ] **Step 2: Nova query `listPesquisasPublicas`**

Adicione ao final do arquivo (usa os imports já presentes: `createServiceRoleClient`,
tipo `SB`, `PesquisaStatus` via `./schema`; se `PesquisaStatus` não estiver importado,
importe-o de `./schema`):
```ts
/**
 * Pesquisas com resultados abertos ao time (não-rascunho, não deletadas). Usada na
 * listagem pra qualquer usuário descobrir e abrir os resultados agregados.
 */
export async function listPesquisasPublicas(): Promise<
  Array<{ id: string; titulo: string; status: PesquisaStatus }>
> {
  const sb = createServiceRoleClient() as SB;
  const { data } = await sb
    .from("pesquisas")
    .select("id, titulo, status")
    .eq("resultados_publicos", true)
    .neq("status", "rascunho")
    .is("deleted_at", null)
    .order("disparada_em", { ascending: false });
  return (data ?? []) as Array<{ id: string; titulo: string; status: PesquisaStatus }>;
}
```
Verifique no topo do arquivo se `PesquisaStatus` está importado de `./schema`; se não,
adicione-o ao import de tipos existente (`import type { PesquisaRow, PerguntaRow, PesquisaStatus } from "./schema";`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/pesquisas/queries.ts
git commit -m "feat(pesquisas): select de resultados_publicos + listPesquisasPublicas"
```

---

## Task 6: Extrair `PerguntasAgregadas` (componente compartilhado)

**Files:** Create `src/components/pesquisas/PerguntasAgregadas.tsx`

Presentational puro (SEM `"use client"`), renderizável tanto no server quanto dentro
de um client component. Contém `Barra` (exportado) e `PerguntasAgregadas`.

- [ ] **Step 1: Criar o arquivo**

```tsx
import { Card } from "@/components/ui/card";
import type { ResultadoPergunta } from "@/lib/pesquisas/queries";

export function Barra({ label, valor, total }: { label: string; valor: number; total: number }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground">{valor} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Agregado por pergunta (sem nomes). Usado na visão de gestão e na visão do time. */
export function PerguntasAgregadas({ perguntas }: { perguntas: ResultadoPergunta[] }) {
  return (
    <>
      {perguntas.map(({ pergunta, agregacao }, i) => (
        <Card key={pergunta.id} className="space-y-3 p-4">
          <p className="text-sm font-medium">
            {i + 1}. {pergunta.enunciado}
            <span className="ml-2 text-xs text-muted-foreground">({agregacao.total} resposta{agregacao.total === 1 ? "" : "s"})</span>
          </p>

          {agregacao.tipo === "multipla_escolha" && (
            <div className="space-y-2">
              {Object.entries(agregacao.contagem).map(([opcao, n]) => (
                <Barra key={opcao} label={opcao} valor={n} total={agregacao.total} />
              ))}
            </div>
          )}

          {agregacao.tipo === "escala" && (
            <p className="text-2xl font-bold">
              {agregacao.media.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">média</span>
            </p>
          )}

          {agregacao.tipo === "sim_nao" && (
            <div className="space-y-2">
              <Barra label="Sim" valor={agregacao.sim} total={agregacao.total} />
              <Barra label="Não" valor={agregacao.nao} total={agregacao.total} />
            </div>
          )}

          {agregacao.tipo === "texto" && (
            <ul className="space-y-1.5">
              {agregacao.textos.length === 0 ? (
                <li className="text-xs text-muted-foreground">Sem respostas ainda.</li>
              ) : (
                agregacao.textos.map((t, ti) => (
                  <li key={ti} className="rounded-md border bg-muted/30 px-3 py-1.5 text-sm">{t}</li>
                ))
              )}
            </ul>
          )}
        </Card>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "PerguntasAgregadas" || echo ok`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/components/pesquisas/PerguntasAgregadas.tsx
git commit -m "feat(pesquisas): extrai PerguntasAgregadas (agregado sem nomes)"
```

---

## Task 7: `ResultadosView` usa o componente extraído

**Files:** Modify `src/components/pesquisas/ResultadosView.tsx`

- [ ] **Step 1: Remover o `Barra` local e importar do novo arquivo**

Localize e REMOVA a definição local de `Barra` (a função inteira no topo do arquivo):
```tsx
function Barra({ label, valor, total }: { label: string; valor: number; total: number }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground">{valor} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
```
E adicione o import (junto dos outros imports do topo, após o import de `type { Resultados }`):
```tsx
import { Barra, PerguntasAgregadas } from "./PerguntasAgregadas";
```

- [ ] **Step 2: Trocar o bloco final de agregado pelo componente**

Localize o bloco final (o último `.map`):
```tsx
      {(!isQuiz || aba === "perguntas") && perguntas.map(({ pergunta, agregacao }, i) => (
        <Card key={pergunta.id} className="space-y-3 p-4">
          <p className="text-sm font-medium">
            {i + 1}. {pergunta.enunciado}
            <span className="ml-2 text-xs text-muted-foreground">({agregacao.total} resposta{agregacao.total === 1 ? "" : "s"})</span>
          </p>

          {agregacao.tipo === "multipla_escolha" && (
            <div className="space-y-2">
              {Object.entries(agregacao.contagem).map(([opcao, n]) => (
                <Barra key={opcao} label={opcao} valor={n} total={agregacao.total} />
              ))}
            </div>
          )}

          {agregacao.tipo === "escala" && (
            <p className="text-2xl font-bold">
              {agregacao.media.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">média</span>
            </p>
          )}

          {agregacao.tipo === "sim_nao" && (
            <div className="space-y-2">
              <Barra label="Sim" valor={agregacao.sim} total={agregacao.total} />
              <Barra label="Não" valor={agregacao.nao} total={agregacao.total} />
            </div>
          )}

          {agregacao.tipo === "texto" && (
            <ul className="space-y-1.5">
              {agregacao.textos.length === 0 ? (
                <li className="text-xs text-muted-foreground">Sem respostas ainda.</li>
              ) : (
                agregacao.textos.map((t, ti) => (
                  <li key={ti} className="rounded-md border bg-muted/30 px-3 py-1.5 text-sm">{t}</li>
                ))
              )}
            </ul>
          )}
        </Card>
      ))}
```
Substitua por:
```tsx
      {(!isQuiz || aba === "perguntas") && <PerguntasAgregadas perguntas={perguntas} />}
```

- [ ] **Step 3: Type-check (Barra ainda é usado na seção de temperamento — deve resolver via import)**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "ResultadosView" || echo ok`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/components/pesquisas/ResultadosView.tsx
git commit -m "refactor(pesquisas): ResultadosView reusa PerguntasAgregadas"
```

---

## Task 8: `ResultadosPublicosView` (visão do time)

**Files:** Create `src/components/pesquisas/ResultadosPublicosView.tsx`

Server component (SEM `"use client"`). Só agregado, sem nomes.

- [ ] **Step 1: Criar o arquivo**

```tsx
import { PerguntasAgregadas } from "./PerguntasAgregadas";
import type { ResultadoPergunta } from "@/lib/pesquisas/queries";

export function ResultadosPublicosView({
  titulo,
  descricao,
  perguntas,
  totalRespondidos,
  totalDestinatarios,
  encerrada,
}: {
  titulo: string;
  descricao: string | null;
  perguntas: ResultadoPergunta[];
  totalRespondidos: number;
  totalDestinatarios: number;
  encerrada: boolean;
}) {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{titulo}</h1>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
        <p className="text-sm text-muted-foreground">
          {totalRespondidos}/{totalDestinatarios} responderam · {encerrada ? "Encerrada" : "Aberta"}
        </p>
      </header>
      <p className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-700 dark:text-sky-400">
        Visão do time — resultados agregados, sem identificar quem respondeu.
      </p>
      <PerguntasAgregadas perguntas={perguntas} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pesquisas/ResultadosPublicosView.tsx
git commit -m "feat(pesquisas): ResultadosPublicosView (visão só-agregada do time)"
```

---

## Task 9: Acesso na tela de resultados

**Files:** Modify `src/app/(authed)/pesquisas/[id]/page.tsx`

- [ ] **Step 1: Substituir a página inteira**

Substitua TODO o conteúdo do arquivo por:
```tsx
import { redirect, notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/permissions";
import { getResultados, listCandidatosAdicionar } from "@/lib/pesquisas/queries";
import { ResultadosView } from "@/components/pesquisas/ResultadosView";
import { ResultadosPublicosView } from "@/components/pesquisas/ResultadosPublicosView";

export default async function ResultadosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();
  const canManage = canAccess(user.role, "manage:pesquisas");

  const resultados = await getResultados(id);
  if (!resultados) notFound();

  // Rascunho: gestão vai pro editor; time não enxerga.
  if (resultados.pesquisa.status === "rascunho") {
    if (canManage) redirect(`/pesquisas/${id}/editar`);
    redirect("/pesquisas");
  }

  // Time (não-gestão): só entra se a pesquisa for pública, e vê só o agregado.
  if (!canManage) {
    if (!resultados.pesquisa.resultados_publicos) redirect("/pesquisas");
    return (
      <div className="mx-auto max-w-2xl">
        <ResultadosPublicosView
          titulo={resultados.pesquisa.titulo}
          descricao={resultados.pesquisa.descricao}
          perguntas={resultados.perguntas}
          totalRespondidos={resultados.total_respondidos}
          totalDestinatarios={resultados.total_destinatarios}
          encerrada={resultados.pesquisa.status === "encerrada"}
        />
      </div>
    );
  }

  // Gestão: visão completa (como hoje).
  const candidatos =
    resultados.pesquisa.status === "aberta" ? await listCandidatosAdicionar(id) : [];

  return (
    <div className="mx-auto max-w-2xl">
      <ResultadosView resultados={resultados} canManage={canManage} candidatos={candidatos} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "pesquisas/\[id\]/page|ResultadosPublicosView" || echo ok`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add "src/app/(authed)/pesquisas/[id]/page.tsx"
git commit -m "feat(pesquisas): tela de resultados com modo time (só-agregado)"
```

---

## Task 10: Descoberta — seção "Resultados abertos ao time" na listagem

**Files:** Modify `src/app/(authed)/pesquisas/page.tsx`

- [ ] **Step 1: Importar a query e o Link (Link já está importado)**

Localize:
```tsx
import { listMinhasPesquisas, listPesquisasPendentes } from "@/lib/pesquisas/queries";
```
Substitua por:
```tsx
import { listMinhasPesquisas, listPesquisasPendentes, listPesquisasPublicas } from "@/lib/pesquisas/queries";
```

- [ ] **Step 2: Carregar as públicas**

Localize:
```tsx
  const [minhas, pendentes] = await Promise.all([
    canManage ? listMinhasPesquisas(user.id) : Promise.resolve([]),
    listPesquisasPendentes(user.id),
  ]);
```
Substitua por:
```tsx
  const [minhas, pendentes, publicas] = await Promise.all([
    canManage ? listMinhasPesquisas(user.id) : Promise.resolve([]),
    listPesquisasPendentes(user.id),
    listPesquisasPublicas(),
  ]);
```

- [ ] **Step 3: Renderizar a seção após o bloco das abas**

Localize o fechamento do bloco condicional principal `{aba === "minhas" ? ( ... ) : ( ... )}`
— é o grande ternário que termina com:
```tsx
      )}
    </div>
  );
}

function TabLink(
```
Insira a nova seção logo ANTES do `</div>` que fecha o container principal (ou seja,
depois do fechamento do ternário `)}` e antes do `</div>` + `);`). O resultado deve ficar:
```tsx
      )}

      {publicas.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Resultados abertos ao time</h2>
          {publicas.map((p) => (
            <Link
              key={p.id}
              href={`/pesquisas/${p.id}`}
              className="flex items-center justify-between rounded-lg border bg-card p-4 hover:bg-muted/40"
            >
              <p className="truncate font-medium">{p.titulo}</p>
              <StatusBadge status={p.status} />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
```
> `StatusBadge` já existe no arquivo e aceita `status: "rascunho" | "aberta" | "encerrada"`.
> Como `listPesquisasPublicas` só traz não-rascunho, os valores são compatíveis.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "pesquisas/page" || echo ok`
Expected: `ok`

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authed)/pesquisas/page.tsx"
git commit -m "feat(pesquisas): seção 'Resultados abertos ao time' na listagem"
```

---

## Task 11: Verificação + PR

- [ ] **Step 1: Type-check completo**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -20`
Expected: sem erros.

- [ ] **Step 2: Lint dos arquivos tocados**

Run: `npx eslint src/lib/pesquisas/schema.ts src/lib/pesquisas/actions.ts src/lib/pesquisas/queries.ts src/components/pesquisas/NovaPesquisaForm.tsx src/components/pesquisas/PerguntasAgregadas.tsx src/components/pesquisas/ResultadosView.tsx src/components/pesquisas/ResultadosPublicosView.tsx "src/app/(authed)/pesquisas/[id]/page.tsx" "src/app/(authed)/pesquisas/page.tsx"`
Expected: exit 0.

- [ ] **Step 3: Testes do módulo**

Run: `npx vitest run src/lib/pesquisas --exclude '**/.claude/**'`
Expected: verdes.

- [ ] **Step 4: Push + PR**

```bash
git push -u origin feat/pesquisa-resultados-publicos
gh pr create --base main --title "feat(pesquisas): visibilidade de resultados por pesquisa (público ao time)" --body "$(cat <<'EOF'
## O quê
Controle por pesquisa de quem vê os resultados. Toggle "Liberar resultados pro time" na criação. Pesquisa pública → time todo vê a visão **agregada, sem nomes**; pesquisa normal → só gestão (como hoje). Conecta Yide fica só-gestão (default).

## ⚠️ Deploy manual — ORDEM IMPORTA
1. **PRIMEIRO** aplicar `supabase/migrations/20260725000000_pesquisas_resultados_publicos.sql` no SQL Editor.
2. **Depois** deixar este PR mergear/deployar (o select passa a referenciar a coluna).

## Test Plan
- [x] tsc / eslint / vitest src/lib/pesquisas
- [ ] Gestão vê tudo; cargo comum vê só-agregado numa pública e é redirecionado numa não-pública
- [ ] Textos aparecem sem nome pro time; nenhum nome vai no payload do time
- [ ] Conecta Yide continua só-gestão

Spec: `docs/superpowers/specs/2026-07-22-pesquisa-resultados-publicos-design.md`
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Aguardar CI verde e mergear** (`gh pr merge --squash --delete-branch`).

---

## Self-review notes
- Espelha `anonima` em todos os pontos (schema/form/create/update).
- `PerguntasAgregadas` é a única fonte do render agregado (DRY) — gestão e time usam o mesmo.
- Nomes (`porPessoa`/`faltamResponder`) nunca são passados ao `ResultadosPublicosView`.
- Ordem de deploy migration-first documentada (risco de select explícito).
