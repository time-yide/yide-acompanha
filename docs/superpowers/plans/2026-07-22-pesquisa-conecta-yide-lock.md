# Pesquisa Conecta Yide + Lock Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar a pesquisa de satisfação do evento "Conecta Yide" que trava a tela de todo o time até ser respondida, reaproveitando o módulo Pesquisas existente.

**Architecture:** Nova coluna `bloqueante` em `pesquisas`. Um lock server-side (`checkPesquisaLock`) espelhando `satisfacao/lock.ts` e um `PesquisaLockGate` (overlay em tela cheia) que reusa o `ResponderForm` existente, ligado no `layout.tsx` junto dos outros dois gates. A pesquisa em si é criada por um SQL seed (manual). Sem mexer na UI de criação.

**Tech Stack:** Next.js (App Router, versão modificada — checar `node_modules/next/dist/docs/` antes de padrões novos), Supabase (service-role + RLS), `unstable_cache`/`revalidateTag`, React Server Components, base-ui.

---

## File Structure

- Create: `supabase/migrations/20260724000000_pesquisas_bloqueante.sql` — coluna `bloqueante`.
- Create: `src/lib/pesquisas/lock.ts` — `checkPesquisaLock` + `PESQUISA_LOCK_TAG` + tipo `PesquisaLockState`.
- Create: `src/components/pesquisas/PesquisaLockGate.tsx` — overlay bloqueante.
- Create: `supabase/seeds/2026-07-22_conecta_yide.sql` — cria a pesquisa + perguntas + destinatários.
- Modify: `src/components/pesquisas/ResponderForm.tsx` — prop opcional `onSubmitted` pra o gate atualizar sozinho.
- Modify: `src/lib/pesquisas/actions.ts:287-288` — revalidar o lock ao responder.
- Modify: `src/app/(authed)/layout.tsx` — chamar `checkPesquisaLock` e renderizar o gate.

> **Convenção do projeto:** migrations e seeds NÃO rodam no deploy (Vercel). São aplicados à mão no SQL Editor do Supabase. Ver `project_supabase_migrations_manual`.

---

## Task 1: Migration — coluna `bloqueante`

**Files:**
- Create: `supabase/migrations/20260724000000_pesquisas_bloqueante.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- Marca uma pesquisa como bloqueante: quando true + status 'aberta', ela trava a
-- tela (lock gate) de todo destinatário que ainda não respondeu.
alter table public.pesquisas
  add column if not exists bloqueante boolean not null default false;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260724000000_pesquisas_bloqueante.sql
git commit -m "feat(pesquisas): coluna bloqueante em pesquisas (migration manual)"
```

> A aplicação no Supabase é manual (SQL Editor), feita na fase de deploy — não neste passo.

---

## Task 2: Lock server-side — `checkPesquisaLock`

**Files:**
- Create: `src/lib/pesquisas/lock.ts`

Espelha `src/lib/satisfacao/lock.ts`: service-role dentro de `unstable_cache`, TTL 30s, tag pra revalidação. Key do cache inclui o `userId` (dado per-usuário — ver `feedback_calendario_dados_per_usuario_fora_do_cache`).

- [ ] **Step 1: Criar o arquivo `src/lib/pesquisas/lock.ts`**

```ts
// SERVER ONLY
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { PerguntaRow } from "./schema";

export const PESQUISA_LOCK_TAG = "pesquisa-lock";

export interface PesquisaLockState {
  blocked: boolean;
  pesquisa: { id: string; titulo: string; descricao: string | null } | null;
  perguntas: PerguntaRow[];
}

const EMPTY: PesquisaLockState = { blocked: false, pesquisa: null, perguntas: [] };

/**
 * Verifica se o usuário tem uma pesquisa BLOQUEANTE aberta ainda não respondida.
 * Layout authed chama a cada navegação — cacheado 30s por usuário; a action de
 * responder revalida a tag pra o gate sumir na hora.
 */
export async function checkPesquisaLock(userId: string): Promise<PesquisaLockState> {
  const cached = unstable_cache(
    async (uid: string) => _checkPesquisaLockImpl(uid),
    ["pesquisa-lock"],
    { revalidate: 30, tags: [PESQUISA_LOCK_TAG] },
  );
  return cached(userId);
}

async function _checkPesquisaLockImpl(userId: string): Promise<PesquisaLockState> {
  const admin = createServiceRoleClient();

  // 1) Destinatários pendentes do usuário, juntando a pesquisa (aberta + bloqueante).
  //    !inner garante que só volta linha se a pesquisa casar com os filtros.
  const { data: dests } = await admin
    .from("pesquisa_destinatarios")
    .select(
      "pesquisa_id, respondeu_em, pesquisas!inner(id, titulo, descricao, status, bloqueante, deleted_at, disparada_em)",
    )
    .eq("user_id", userId)
    .is("respondeu_em", null)
    .eq("pesquisas.status", "aberta")
    .eq("pesquisas.bloqueante", true)
    .is("pesquisas.deleted_at", null);

  type Row = {
    pesquisa_id: string;
    pesquisas: {
      id: string;
      titulo: string;
      descricao: string | null;
      disparada_em: string | null;
    };
  };
  const rows = (dests ?? []) as unknown as Row[];
  if (rows.length === 0) return EMPTY;

  // Mais antiga primeiro (disparada_em asc; null por último).
  rows.sort((a, b) => {
    const da = a.pesquisas.disparada_em ?? "9999";
    const db = b.pesquisas.disparada_em ?? "9999";
    return da < db ? -1 : da > db ? 1 : 0;
  });
  const alvo = rows[0].pesquisas;

  // 2) Carrega as perguntas na ordem.
  const { data: perguntasRaw } = await admin
    .from("pesquisa_perguntas")
    .select("id, pesquisa_id, ordem, tipo, enunciado, opcoes, escala_min, escala_max, obrigatoria")
    .eq("pesquisa_id", alvo.id)
    .order("ordem");

  const perguntas = (perguntasRaw ?? []) as PerguntaRow[];

  return {
    blocked: true,
    pesquisa: { id: alvo.id, titulo: alvo.titulo, descricao: alvo.descricao },
    perguntas,
  };
}
```

- [ ] **Step 2: Type-check do arquivo isolado**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "pesquisas/lock" || echo "sem erros em lock.ts"`
Expected: `sem erros em lock.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/pesquisas/lock.ts
git commit -m "feat(pesquisas): checkPesquisaLock pra pesquisas bloqueantes"
```

---

## Task 3: `ResponderForm` avisa quando termina

Hoje, ao enviar, o `ResponderForm` seta `enviado=true` e mostra o card "Parabéns". Dentro do lock gate a gente precisa que, ao terminar, o layout re-renderize e o gate suma. Adiciona uma prop opcional `onSubmitted`: se passada, chama ela em vez de mostrar o card interno (comportamento default preservado nas telas normais).

**Files:**
- Modify: `src/components/pesquisas/ResponderForm.tsx`

- [ ] **Step 1: Adicionar a prop `onSubmitted` na assinatura**

Localize:

```tsx
export function ResponderForm({
  pesquisaId,
  titulo,
  descricao,
  perguntas,
}: {
  pesquisaId: string;
  titulo: string;
  descricao: string | null;
  perguntas: PerguntaRow[];
}) {
```

Substitua por:

```tsx
export function ResponderForm({
  pesquisaId,
  titulo,
  descricao,
  perguntas,
  onSubmitted,
}: {
  pesquisaId: string;
  titulo: string;
  descricao: string | null;
  perguntas: PerguntaRow[];
  /** Se passada, é chamada no sucesso em vez de mostrar o card interno de sucesso. */
  onSubmitted?: () => void;
}) {
```

- [ ] **Step 2: Chamar `onSubmitted` no sucesso**

Localize dentro de `submit`:

```tsx
    startTransition(async () => {
      const r = await responderPesquisaAction(fd);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      setEnviado(true);
    });
```

Substitua por:

```tsx
    startTransition(async () => {
      const r = await responderPesquisaAction(fd);
      if (r?.error) {
        toast.error(r.error);
        return;
      }
      if (onSubmitted) {
        onSubmitted();
        return;
      }
      setEnviado(true);
    });
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "ResponderForm" || echo "ok"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/components/pesquisas/ResponderForm.tsx
git commit -m "feat(pesquisas): ResponderForm aceita callback onSubmitted"
```

---

## Task 4: Componente `PesquisaLockGate`

**Files:**
- Create: `src/components/pesquisas/PesquisaLockGate.tsx`

Overlay `fixed inset-0 z-[100]` no mesmo estilo do `SatisfactionLockGate`, reusando o `ResponderForm`. Ao enviar, `router.refresh()` re-renderiza o layout (a action já terá revalidado a tag do lock na Task 6) e o gate some.

- [ ] **Step 1: Criar o arquivo**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle } from "lucide-react";
import { ResponderForm } from "./ResponderForm";
import type { PesquisaLockState } from "@/lib/pesquisas/lock";

interface Props {
  state: PesquisaLockState;
}

export function PesquisaLockGate({ state }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  if (!state.blocked || !state.pesquisa) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-md sm:p-8">
      <div className="my-auto w-full max-w-2xl space-y-5 rounded-2xl border border-amber-500/40 bg-card p-6 shadow-2xl ring-1 ring-amber-500/20 sm:p-8">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight">Pesquisa obrigatória</h2>
            <p className="text-sm text-muted-foreground">
              Responda pra liberar o sistema — leva menos de 3 minutinhos. 💛
            </p>
          </div>
        </div>

        {/* Aviso */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>Sua opinião importa.</strong>{" "}
            O sistema desbloqueia automaticamente assim que você enviar suas respostas.
          </div>
        </div>

        {/* Formulário (reusa o ResponderForm) */}
        <ResponderForm
          pesquisaId={state.pesquisa.id}
          titulo={state.pesquisa.titulo}
          descricao={state.pesquisa.descricao}
          perguntas={state.perguntas}
          onSubmitted={() => startTransition(() => router.refresh())}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "PesquisaLockGate" || echo "ok"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add src/components/pesquisas/PesquisaLockGate.tsx
git commit -m "feat(pesquisas): PesquisaLockGate (overlay bloqueante)"
```

---

## Task 5: Revalidar o lock ao responder

Sem isso, o `unstable_cache` do lock (TTL 30s) segura o gate mesmo depois de responder. Espelha o que `satisfacao/actions.ts` faz: `revalidatePath("/", "layout")` + `revalidateTag(TAG, "default")`.

**Files:**
- Modify: `src/lib/pesquisas/actions.ts`

- [ ] **Step 1: Importar a tag do lock**

Localize o bloco de imports do módulo (logo após os imports de `./schema`):

```ts
import {
  createPesquisaSchema,
  perguntaSchema,
  respostaValorSchema,
  type PerguntaInput,
  type PerguntaTipo,
} from "./schema";
```

Adicione **abaixo** desse bloco:

```ts
import { PESQUISA_LOCK_TAG } from "./lock";
```

- [ ] **Step 2: Revalidar o lock no fim de `responderPesquisaAction`**

Localize (fim da `responderPesquisaAction`, ~linha 287):

```ts
  revalidatePath("/pesquisas");
  revalidateTag("pesquisas", "default");
  return { success: true };
}
```

> Nota: esse é o `return` da `responderPesquisaAction`. Confirme pelo contexto — é o bloco que vem logo após o `update` de `respondeu_em`.

Substitua por:

```ts
  revalidatePath("/pesquisas");
  revalidatePath("/", "layout");
  revalidateTag("pesquisas", "default");
  revalidateTag(PESQUISA_LOCK_TAG, "default");
  return { success: true };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "pesquisas/actions" || echo "ok"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add src/lib/pesquisas/actions.ts
git commit -m "feat(pesquisas): revalidar lock gate ao responder"
```

---

## Task 6: Ligar o gate no layout autenticado

**Files:**
- Modify: `src/app/(authed)/layout.tsx`

- [ ] **Step 1: Adicionar os imports**

Localize:

```tsx
import { checkSatisfactionLock } from "@/lib/satisfacao/lock";
import { SatisfactionLockGate } from "@/components/satisfacao/SatisfactionLockGate";
```

Adicione **abaixo**:

```tsx
import { checkPesquisaLock } from "@/lib/pesquisas/lock";
import { PesquisaLockGate } from "@/components/pesquisas/PesquisaLockGate";
```

- [ ] **Step 2: Chamar `checkPesquisaLock` no `Promise.all`**

Localize o array de destructuring e o `Promise.all`:

```tsx
  const [recadosNaoLidos, lockState, audiovisualPendentes, escritorioUnread, unitContext, yoriProntos, solicitacoesAbertas] = await Promise.all([
    countRecadosNaoLidos(user.id, unitProfileIds),
    checkSatisfactionLock(user.id, user.role),
    isVideomaker ? listPendenteParaVideomaker(user.id) : Promise.resolve([]),
    countChannelsWithUnread(user.id, user.role, unitId).catch(() => 0),
    getUnitContext().catch(() => null),
    isYoriEnabled() ? countUndownloadedJobs(user.id).catch(() => 0) : Promise.resolve(0),
    veSolicitacoes ? countRequestsAbertas().catch(() => 0) : Promise.resolve(0),
  ]);
```

Substitua por (adiciona `pesquisaLock` no destructuring e `checkPesquisaLock` no array, na mesma posição):

```tsx
  const [recadosNaoLidos, lockState, audiovisualPendentes, escritorioUnread, unitContext, yoriProntos, solicitacoesAbertas, pesquisaLock] = await Promise.all([
    countRecadosNaoLidos(user.id, unitProfileIds),
    checkSatisfactionLock(user.id, user.role),
    isVideomaker ? listPendenteParaVideomaker(user.id) : Promise.resolve([]),
    countChannelsWithUnread(user.id, user.role, unitId).catch(() => 0),
    getUnitContext().catch(() => null),
    isYoriEnabled() ? countUndownloadedJobs(user.id).catch(() => 0) : Promise.resolve(0),
    veSolicitacoes ? countRequestsAbertas().catch(() => 0) : Promise.resolve(0),
    checkPesquisaLock(user.id).catch(() => ({ blocked: false as const, pesquisa: null, perguntas: [] })),
  ]);
```

- [ ] **Step 3: Renderizar o gate junto dos outros**

Localize:

```tsx
      <SatisfactionLockGate state={lockState} />
      <CapturaPendenteLockGate overdue={audiovisualOverdue} clientes={clientesAtivos} />
```

Substitua por:

```tsx
      <SatisfactionLockGate state={lockState} />
      <CapturaPendenteLockGate overdue={audiovisualOverdue} clientes={clientesAtivos} />
      <PesquisaLockGate state={pesquisaLock} />
```

- [ ] **Step 4: Type-check completo do projeto**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -20`
Expected: sem erros (nenhuma linha de erro; ou só warnings pré-existentes não relacionados).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authed)/layout.tsx"
git commit -m "feat(pesquisas): ligar PesquisaLockGate no layout autenticado"
```

---

## Task 7: SQL seed da pesquisa Conecta Yide

**Files:**
- Create: `supabase/seeds/2026-07-22_conecta_yide.sql`

Cria a pesquisa (bloqueante, aberta, identificada), as 6 perguntas e dispara pra todos os usuários ativos. Criador = um `socio`/`adm` ativo. Rodado à mão no SQL Editor **depois** da migration da Task 1 e do deploy do código.

- [ ] **Step 1: Criar o arquivo**

```sql
-- Seed manual: pesquisa "Conecta Yide". Rodar no SQL Editor do Supabase DEPOIS de
-- aplicar 20260724000000_pesquisas_bloqueante.sql e do deploy do código.
-- Idempotência: rode UMA vez. Rodar de novo cria uma segunda pesquisa.
with nova as (
  insert into public.pesquisas
    (organization_id, titulo, descricao, anonima, bloqueante, status, criado_por, disparada_em)
  select
    p.organization_id,
    'Conecta Yide — sua opinião conta 💛',
    'Queremos muito saber como foi o nosso Conecta Yide pra você! São só 2 minutinhos e sua resposta ajuda a gente a fazer os próximos ainda melhores.',
    false, true, 'aberta', p.id, now()
  from public.profiles p
  where p.role in ('socio', 'adm') and p.ativo = true
  order by (p.role = 'socio') desc
  limit 1
  returning id
),
perguntas as (
  insert into public.pesquisa_perguntas
    (pesquisa_id, ordem, tipo, enunciado, escala_min, escala_max, obrigatoria)
  select
    nova.id, v.ordem, v.tipo::public.pesquisa_pergunta_tipo, v.enunciado, v.escala_min, v.escala_max, true
  from nova, (values
    (1, 'escala',  'De 0 a 10, o quanto você gostou do Conecta Yide?', 0::int, 10::int),
    (2, 'sim_nao', 'Você gostaria que a gente fizesse o Conecta Yide com mais frequência?', null::int, null::int),
    (3, 'texto',   'O que você mais gostou?', null::int, null::int),
    (4, 'texto',   'O que você acha que a gente pode melhorar pra próxima?', null::int, null::int),
    (5, 'texto',   'Tem alguma ideia do que podemos fazer no próximo Conecta Yide?', null::int, null::int),
    (6, 'texto',   'Deixe algum feedback ou recado livre sobre esse momento.', null::int, null::int)
  ) as v(ordem, tipo, enunciado, escala_min, escala_max)
  returning 1
)
insert into public.pesquisa_destinatarios (pesquisa_id, user_id)
select nova.id, p.id
from nova, public.profiles p
where p.ativo = true;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/seeds/2026-07-22_conecta_yide.sql
git commit -m "feat(pesquisas): seed SQL da pesquisa Conecta Yide"
```

> Aplicação no Supabase é manual, na fase de deploy.

---

## Task 8: Lint, verificação e PR

**Files:** nenhum novo.

- [ ] **Step 1: Lint**

Run: `npm run lint 2>&1 | tail -20`
Expected: sem erros novos nos arquivos criados/modificados.

- [ ] **Step 2: Type-check final**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | tail -20`
Expected: sem erros.

- [ ] **Step 3: Testes do módulo pesquisas (regressão das funções puras)**

Run: `npx vitest run src/lib/pesquisas --exclude '**/.claude/**'`
Expected: os testes existentes (`aggregate.test.ts`, `temperamento.test.ts`) passam. (Ver `feedback_vitest_worktrees_phantom_fails` — sempre com `--exclude '**/.claude/**'`.)

- [ ] **Step 4: Abrir o PR**

```bash
git push -u origin feat/pesquisa-conecta-yide-lock
gh pr create --base main --title "feat(pesquisas): pesquisa Conecta Yide + lock gate obrigatório" --body "$(cat <<'EOF'
## O quê
- Nova coluna \`bloqueante\` em \`pesquisas\` (migration manual).
- \`checkPesquisaLock\` + \`PesquisaLockGate\`: pesquisa bloqueante trava a tela até responder (padrão dos locks de satisfação/captação).
- \`ResponderForm\` ganha callback \`onSubmitted\` pro gate atualizar sozinho.
- Seed SQL da pesquisa "Conecta Yide" (6 perguntas, time todo, identificada).

## Deploy manual (nesta ordem)
1. SQL Editor: aplicar \`supabase/migrations/20260724000000_pesquisas_bloqueante.sql\`.
2. Mergear este PR → esperar deploy Vercel.
3. SQL Editor: rodar \`supabase/seeds/2026-07-22_conecta_yide.sql\`.

Spec: \`docs/superpowers/specs/2026-07-22-pesquisa-conecta-yide-lock-design.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Aguardar CI verde e mergear**

Ver `feedback_auto_merge_apos_ci`: esperar `ci.yml` verde, depois:

```bash
gh pr merge --squash --delete-branch
```

Migrations/seeds continuam manuais (Steps de deploy acima).

---

## Verificação manual (pós-deploy)

Depois de aplicar migration → merge/deploy → seed:

1. Logar como um usuário comum → a tela trava mostrando o `PesquisaLockGate` com as 6 perguntas.
2. Responder tudo e enviar → o gate some sozinho (sem F5) e o sistema libera.
3. Recarregar → não trava mais pra quem já respondeu.
4. Confirmar que nenhuma pesquisa `bloqueante=false` (as antigas) trava — regressão do módulo.
5. Na tela `/pesquisas/<id>` (como criadora) → acompanhar respostas e quem falta.

## Notas de decisão

- **Sem checkbox na UI de criação** (YAGNI): `bloqueante` só é setado pelo seed. Se no futuro quiserem criar pesquisas obrigatórias pela UI, adicionar o toggle no `DispararModal` + `dispararPesquisaAction`.
- **Sem testes unitários novos**: `lock.ts` é integração com Supabase (service-role), igual `satisfacao/lock.ts`, que não tem teste unitário. Cobertura via type-check + verificação manual, consistente com o código existente.
- **Empilhamento de locks**: todos em `z-[100]`. Na prática o usuário vê um por vez; sem ordenação especial (YAGNI).
