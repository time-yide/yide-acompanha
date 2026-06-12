# Serviço pontual encerra no fim do mês — PR 1 (lifecycle)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer um serviço pontual encerrar automaticamente no fim do mês em que entrou — virando um novo status `concluido`, saindo da Carteira/Clientes ativos, e aparecendo como "Concluído" na lista de clientes.

**Architecture:** A conclusão é ancorada em `data_churn = último dia do mês de entrada`, gravada no cadastro. Isso já tira o pontual das métricas baseadas em data (`isActiveOn`). Um cron diário vira o `status` pra `concluido` (etiqueta visível) quando o mês passa. Migration manual adiciona o valor ao enum e faz backfill dos pontuais existentes.

**Tech Stack:** Next.js (App Router, server actions), Supabase (Postgres enum `client_status`), Vercel Cron, vitest.

**Spec:** `docs/superpowers/specs/2026-06-12-pontuais-encerra-mes-design.md`

**Escopo deste PR:** lifecycle + lista. O dashboard (redefinição do KPI por mês de entrada) é o **PR 2**, plano separado.

---

## Arquivos tocados

- Create: `src/lib/clientes/pontual.ts` — helpers puros de data de conclusão.
- Create: `tests/unit/clientes-pontual.test.ts` — testes do helper.
- Create: `src/app/api/cron/pontuais-concluir/route.ts` — cron de transição.
- Create: `supabase/migrations/20260612000000_client_status_concluido.sql` — `ALTER TYPE`.
- Create: `supabase/migrations/20260612000001_pontuais_backfill_concluido.sql` — backfill.
- Modify: `src/lib/clientes/schema.ts` — `STATUSES` += `concluido`.
- Modify: `src/lib/clientes/actions.ts` — create/update gravam `data_churn` (e `status` se mês passou).
- Modify: `src/components/clientes/StatusBadge.tsx` — label/cor "Concluído".
- Modify: `src/components/clientes/StatusPopover.tsx` — exibe "Concluído".
- Modify: `src/app/(authed)/clientes/page.tsx` — aba/filtro "Concluídos".
- Modify: `vercel.json` — registra o cron.

---

## Task 1: Helper puro de conclusão do pontual

**Files:**
- Create: `src/lib/clientes/pontual.ts`
- Test: `tests/unit/clientes-pontual.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/unit/clientes-pontual.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { dataConclusaoPontual, pontualMesEncerrado } from "@/lib/clientes/pontual";

describe("dataConclusaoPontual", () => {
  it("retorna o último dia do mês de entrada", () => {
    expect(dataConclusaoPontual("2026-05-10")).toBe("2026-05-31");
    expect(dataConclusaoPontual("2026-02-03")).toBe("2026-02-28");
    expect(dataConclusaoPontual("2024-02-15")).toBe("2024-02-29"); // bissexto
    expect(dataConclusaoPontual("2026-06-30")).toBe("2026-06-30");
  });
});

describe("pontualMesEncerrado", () => {
  it("false durante o mês de entrada (inclui o último dia)", () => {
    expect(pontualMesEncerrado("2026-06-01", "2026-06-12")).toBe(false);
    expect(pontualMesEncerrado("2026-06-30", "2026-06-30")).toBe(false);
  });
  it("true a partir do 1º dia do mês seguinte", () => {
    expect(pontualMesEncerrado("2026-05-10", "2026-06-01")).toBe(true);
    expect(pontualMesEncerrado("2026-06-30", "2026-07-01")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/clientes-pontual.test.ts`
Expected: FAIL — `Cannot find module '@/lib/clientes/pontual'`.

- [ ] **Step 3: Implementar o helper**

Criar `src/lib/clientes/pontual.ts`:

```ts
// Helpers puros pra modalidade=pontual. Um pontual é um serviço único que
// "vale" pelo mês em que entrou e encerra no fim desse mês.
import { lastDayOfMonth } from "@/lib/dashboard/date-utils";

/** Data de conclusão de um pontual = último dia do mês de `data_entrada` (YYYY-MM-DD). */
export function dataConclusaoPontual(dataEntrada: string): string {
  return lastDayOfMonth(dataEntrada.slice(0, 7));
}

/**
 * `true` se o mês de entrada do pontual já terminou em relação a `hojeIso`
 * (ambos 'YYYY-MM-DD'). No último dia do mês ainda retorna `false` (vigente).
 */
export function pontualMesEncerrado(dataEntrada: string, hojeIso: string): boolean {
  return dataConclusaoPontual(dataEntrada) < hojeIso;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/clientes-pontual.test.ts`
Expected: PASS (2 suites, ok).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientes/pontual.ts tests/unit/clientes-pontual.test.ts
git commit -m "feat(clientes): helper de data de conclusão de pontual"
```

---

## Task 2: Novo status `concluido` no schema TS + badges

**Files:**
- Modify: `src/lib/clientes/schema.ts` (linha 47)
- Modify: `src/components/clientes/StatusBadge.tsx` (linhas 3-7)
- Modify: `src/components/clientes/StatusPopover.tsx` (linhas 17, 20-24, +branch)

- [ ] **Step 1: Adicionar `concluido` ao STATUSES**

Em `src/lib/clientes/schema.ts`, trocar:

```ts
export const STATUSES = ["ativo", "churn", "em_onboarding"] as const;
```

por:

```ts
export const STATUSES = ["ativo", "churn", "em_onboarding", "concluido"] as const;
```

- [ ] **Step 2: Label/cor "Concluído" no StatusBadge**

Em `src/components/clientes/StatusBadge.tsx`, no objeto `map`, adicionar a linha do `concluido` (cor slate, neutra — distinta de churn/rose):

```ts
const map: Record<string, { label: string; cls: string }> = {
  ativo: { label: "Ativo", cls: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" },
  churn: { label: "Churn", cls: "border-rose-500/40 text-rose-600 dark:text-rose-400" },
  em_onboarding: { label: "Onboarding", cls: "border-blue-500/40 text-blue-600 dark:text-blue-400" },
  concluido: { label: "Concluído", cls: "border-slate-500/40 text-slate-600 dark:text-slate-400" },
};
```

- [ ] **Step 3: StatusPopover exibe "Concluído"**

Em `src/components/clientes/StatusPopover.tsx`:

(a) Widen o tipo `current` (linha 17):

```ts
interface Props {
  clienteId: string;
  current: "ativo" | "churn" | "em_onboarding" | "concluido";
}
```

(b) Adicionar ao `BADGE` (após a linha do `em_onboarding`, linha 23):

```ts
  concluido: { label: "Concluído", cls: "border-slate-500/40 text-slate-600 dark:text-slate-400" },
```

(c) Adicionar um branch informativo logo após o bloco `current === "em_onboarding"` (depois da linha 158):

```tsx
        {current === "concluido" && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">Serviço pontual concluído</div>
            <p className="text-xs text-muted-foreground">
              Pontual encerra automaticamente no fim do mês de entrada. Pra reabrir,
              edite o cliente e mude a modalidade ou as datas.
            </p>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
```

- [ ] **Step 4: Type-check**

Run: `npm run typecheck`
Expected: exit 0 (sem erros — `Props["current"]` agora cobre `concluido`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientes/schema.ts src/components/clientes/StatusBadge.tsx src/components/clientes/StatusPopover.tsx
git commit -m "feat(clientes): status 'concluido' (badge + popover)"
```

---

## Task 3: Cadastro grava data de conclusão do pontual

**Files:**
- Modify: `src/lib/clientes/actions.ts` (createClienteAction ~66-87; updateClienteAction ~178-205; import no topo ~12)

Regra: ao salvar `modalidade='pontual'`, gravar `data_churn = dataConclusaoPontual(data_entrada)`. Se o mês de entrada já terminou (backdate), gravar também `status='concluido'`. Mensal não muda nada.

- [ ] **Step 1: Importar helpers**

No topo de `src/lib/clientes/actions.ts`, na linha 12 (`import { getTodayDate } ...`), trocar por:

```ts
import { getTodayDate } from "@/lib/datetime/timezone";
import { dataConclusaoPontual, pontualMesEncerrado } from "@/lib/clientes/pontual";
```

- [ ] **Step 2: createClienteAction — campos de pontual no payload**

Em `createClienteAction`, logo ANTES de `const insertPayload = {` (linha 66), inserir:

```ts
  // Pontual: serviço único que encerra no fim do mês de entrada.
  // Grava a data de conclusão já no cadastro (= último dia do mês de entrada);
  // se o mês já passou (backdate), nasce concluído.
  const dataEntradaResolvida = parsed.data.data_entrada || getTodayDate();
  const isPontual = (parsed.data.modalidade ?? "mensal") === "pontual";
  const pontualFields = isPontual
    ? {
        data_churn: dataConclusaoPontual(dataEntradaResolvida),
        ...(pontualMesEncerrado(dataEntradaResolvida, getTodayDate())
          ? { status: "concluido" as const }
          : {}),
      }
    : {};
```

Depois, no objeto `insertPayload`, trocar a linha `data_entrada: parsed.data.data_entrada || getTodayDate(),` (linha 75) por:

```ts
    data_entrada: dataEntradaResolvida,
```

E adicionar, como ÚLTIMA propriedade do objeto (após `modalidade: parsed.data.modalidade ?? "mensal",`, linha 86):

```ts
    ...pontualFields,
```

- [ ] **Step 3: updateClienteAction — mesmos campos**

Em `updateClienteAction`, ANTES de `const updatePayload = {` (linha 178), inserir:

```ts
  // Pontual: mantém a data de conclusão coerente com a data de entrada editada.
  const dataEntradaEdit = parsed.data.data_entrada || before.data_entrada;
  const isPontualEdit = (parsed.data.modalidade ?? "mensal") === "pontual";
  const pontualFieldsEdit = isPontualEdit
    ? {
        data_churn: dataConclusaoPontual(dataEntradaEdit),
        status: (pontualMesEncerrado(dataEntradaEdit, getTodayDate())
          ? "concluido"
          : "ativo") as "concluido" | "ativo",
      }
    : {};
```

No objeto `updatePayload`, trocar `data_entrada: parsed.data.data_entrada || before.data_entrada,` por:

```ts
    data_entrada: dataEntradaEdit,
```

E adicionar como ÚLTIMA propriedade (após `modalidade: parsed.data.modalidade ?? "mensal",`):

```ts
    ...pontualFieldsEdit,
```

> Nota: no update, se o cliente deixou de ser pontual (virou mensal), `pontualFieldsEdit` fica `{}` e NÃO mexe em status/data_churn — preserva o que estava. Reverter um concluído pra ativo é feito mudando a data de entrada pro mês corrente (recalcula status='ativo').

- [ ] **Step 4: Type-check**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clientes/actions.ts
git commit -m "feat(clientes): cadastro de pontual grava data de conclusão"
```

---

## Task 4: Cron diário de transição pra `concluido`

**Files:**
- Create: `src/app/api/cron/pontuais-concluir/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Criar a rota do cron**

Criar `src/app/api/cron/pontuais-concluir/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getTodayDate } from "@/lib/datetime/timezone";
import { dataConclusaoPontual, pontualMesEncerrado } from "@/lib/clientes/pontual";

export const dynamic = "force-dynamic";

/**
 * Cron: encerra serviços pontuais cujo mês de entrada já terminou.
 *
 * Um pontual (modalidade='pontual') vale pelo mês em que entrou. No 1º dia do
 * mês seguinte ele vira `status='concluido'` — sai da Carteira/Clientes ativos
 * (a saída já acontece pela data, este cron só atualiza a etiqueta visível).
 *
 * Idempotente: só pega `status='ativo'`. Schedule (vercel.json): diário.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const hoje = getTodayDate();

  // Candidatos: pontuais ainda ativos. Filtra app-side por mês encerrado
  // (mesma regra do cadastro, via helper compartilhado).
  const { data, error } = await sb
    .from("clients")
    .select("id, data_entrada, data_churn")
    .eq("modalidade", "pontual")
    .eq("status", "ativo")
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidatos = ((data ?? []) as Array<{ id: string; data_entrada: string; data_churn: string | null }>)
    .filter((c) => c.data_entrada && pontualMesEncerrado(c.data_entrada, hoje));

  let concluidos = 0;
  for (const c of candidatos) {
    const { error: upErr, data: upData } = await sb
      .from("clients")
      .update({
        status: "concluido",
        data_churn: c.data_churn ?? dataConclusaoPontual(c.data_entrada),
      })
      .eq("id", c.id)
      .eq("status", "ativo") // guarda contra corrida
      .select("id");
    if (!upErr && upData && upData.length > 0) concluidos += 1;
  }

  if (concluidos > 0) revalidateTag("dashboard", "default");

  return NextResponse.json({ candidatos: candidatos.length, concluidos });
}
```

> Por que `.select("id")` no update: RLS/serviço pode retornar `error:null` mesmo sem afetar linha — checar `upData.length` confirma a escrita (padrão do projeto pra updates).

- [ ] **Step 2: Registrar no vercel.json**

Em `vercel.json`, dentro do array `"crons"`, adicionar uma entrada (ex.: após a linha de `monthly-snapshot`):

```json
    { "path": "/api/cron/pontuais-concluir", "schedule": "0 5 * * *" },
```

(5h UTC = 1h Cuiabá; cuidar pra deixar vírgula correta entre os itens do array.)

- [ ] **Step 3: Type-check + lint**

Run: `npm run typecheck && npx eslint src/app/api/cron/pontuais-concluir/route.ts`
Expected: exit 0 nos dois.

- [ ] **Step 4: Validar JSON do vercel.json**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('vercel.json OK')"`
Expected: `vercel.json OK`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/pontuais-concluir/route.ts vercel.json
git commit -m "feat(cron): pontuais-concluir vira pontual em concluido no fim do mês"
```

---

## Task 5: Migrations (enum + backfill)

**Files:**
- Create: `supabase/migrations/20260612000000_client_status_concluido.sql`
- Create: `supabase/migrations/20260612000001_pontuais_backfill_concluido.sql`

> Aplicação MANUAL no SQL Editor do Supabase (Vercel não roda migrations no deploy).
> Rodar o arquivo `...000000` PRIMEIRO (commit do enum), DEPOIS o `...000001`.
> `ALTER TYPE ... ADD VALUE` não pode ser usado na mesma transação em que cria o valor — por isso dois arquivos separados.

- [ ] **Step 1: Migration do enum**

Criar `supabase/migrations/20260612000000_client_status_concluido.sql`:

```sql
-- Adiciona o status 'concluido' ao enum de status de clientes.
-- Usado por serviços pontuais (modalidade='pontual'), que encerram no fim do
-- mês de entrada sem virar churn.
--
-- IMPORTANTE: rodar este arquivo SOZINHO (em execução separada do backfill).
-- ALTER TYPE ADD VALUE não pode ser referenciado na mesma transação.
ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'concluido';
```

- [ ] **Step 2: Migration de backfill**

Criar `supabase/migrations/20260612000001_pontuais_backfill_concluido.sql`:

```sql
-- Backfill dos serviços pontuais existentes.
-- Roda DEPOIS de 20260612000000 (enum 'concluido' já commitado).
--
-- Regra de conclusão: data_churn = último dia do mês de data_entrada.
--   ( (date_trunc('month', data_entrada) + interval '1 month - 1 day')::date )

-- 1) Pontuais cujo mês de entrada JÁ terminou → concluido + data de conclusão.
update public.clients
set status = 'concluido',
    data_churn = coalesce(
      data_churn,
      (date_trunc('month', data_entrada) + interval '1 month - 1 day')::date
    )
where modalidade = 'pontual'
  and status = 'ativo'
  and deleted_at is null
  and (date_trunc('month', data_entrada) + interval '1 month')::date <= current_date;

-- 2) Pontuais do mês corrente (ainda ativos) → só grava a data de conclusão.
update public.clients
set data_churn = coalesce(
      data_churn,
      (date_trunc('month', data_entrada) + interval '1 month - 1 day')::date
    )
where modalidade = 'pontual'
  and status = 'ativo'
  and deleted_at is null
  and (date_trunc('month', data_entrada) + interval '1 month')::date > current_date;
```

- [ ] **Step 3: Commit (arquivos só; aplicação é manual depois do merge)**

```bash
git add supabase/migrations/20260612000000_client_status_concluido.sql supabase/migrations/20260612000001_pontuais_backfill_concluido.sql
git commit -m "feat(db): status 'concluido' + backfill dos pontuais existentes"
```

---

## Task 6: Lista de clientes — aba/filtro "Concluídos"

**Files:**
- Modify: `src/app/(authed)/clientes/page.tsx` (tipo do status ~14-37; abas ~161-163)

- [ ] **Step 1: Aceitar `concluido` no filtro de status**

Em `src/app/(authed)/clientes/page.tsx`, no bloco que resolve `status` (linhas 35-37), trocar:

```ts
  const status: "ativo" | "churn" | undefined = isMinhaCarteira
    ? "ativo"
    : ((params.status as "ativo" | "churn" | undefined) ?? undefined);
```

por:

```ts
  const status: "ativo" | "churn" | "concluido" | undefined = isMinhaCarteira
    ? "ativo"
    : ((params.status as "ativo" | "churn" | "concluido" | undefined) ?? undefined);
```

(O `queries.ts` já aplica `query.eq("status", filters.status)` pra qualquer valor — não precisa mexer lá.)

- [ ] **Step 2: Adicionar a aba "Concluídos"**

No grupo de abas (linhas 161-163), após a aba de Churn, adicionar:

```tsx
<Link href="/clientes?status=churn" className={tabClass(activeTab === "churn")}>Churn</Link>
<span className="text-muted-foreground">·</span>
<Link href="/clientes?status=concluido" className={tabClass(activeTab === "concluido")}>Concluídos</Link>
```

- [ ] **Step 3: Ajustar o cálculo de `activeTab`**

Localizar onde `activeTab` é derivado (logo acima das abas, procurar por `activeTab =`). Garantir que cobre `concluido`. Se for algo como:

```ts
const activeTab = status === "churn" ? "churn" : status === "ativo" ? "ativos" : "todos";
```

trocar por:

```ts
const activeTab =
  status === "churn" ? "churn"
  : status === "concluido" ? "concluido"
  : status === "ativo" ? "ativos"
  : "todos";
```

> Se a derivação real do `activeTab` no arquivo for diferente, adaptar mantendo o mapeamento `status==='concluido' → 'concluido'`. Conferir lendo o trecho antes de editar.

- [ ] **Step 4: Type-check + lint**

Run: `npm run typecheck && npx eslint "src/app/(authed)/clientes/page.tsx"`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(authed)/clientes/page.tsx"
git commit -m "feat(clientes): aba 'Concluídos' na lista"
```

---

## Task 7: Verificação final + PR

- [ ] **Step 1: Suite completa + typecheck + lint**

Run:
```bash
npx vitest run tests/unit/clientes-pontual.test.ts
npm run typecheck
npm run lint
```
Expected: testes PASS, typecheck exit 0, lint exit 0.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/pontuais-encerra-mes
gh pr create --base main --head feat/pontuais-encerra-mes \
  --title "feat: serviço pontual encerra no fim do mês de entrada (PR 1 — lifecycle)" \
  --body "<descrever: novo status concluido, cadastro grava data de conclusão, cron diário, backfill manual. Apontar que migrations 20260612000000 e 20260612000001 são aplicadas manualmente no SQL Editor, nessa ordem.>"
```

- [ ] **Step 3: Aguardar CI verde e avisar Yasmin pra aplicar as migrations**

Após CI verde: instruir a aplicar `20260612000000` (enum) e depois `20260612000001` (backfill) no SQL Editor. Só então o status 'concluido' funciona em produção. Merge após validação.

---

## Self-review (cobertura do spec)

- Novo status `concluido` → Task 2 + Task 5. ✅
- Data de conclusão no cadastro → Task 3. ✅
- Cron de transição → Task 4. ✅
- Backfill → Task 5. ✅
- Selo + filtro na lista → Task 2 (badge) + Task 6 (filtro). ✅
- Churn não afetado → garantido por `ehMensal` no dashboard (sem mudança aqui) + cron não toca churn. ✅
- Dashboard (KPI por mês de entrada) → **fora deste PR** (PR 2). ✅
