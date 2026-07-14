# Redesign do Painel Mensal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Painel Mensal (`/painel`) mais limpo e legível — remover a coluna Design, juntar Câmera+Mobile numa coluna "Gravação" com contagem, e tornar Reunião/Edição informativas (derivadas de dados reais) — e habilitar seleção de cliente (incl. avulso) no formulário de evento do calendário pra a Reunião amarrar no cliente.

**Architecture:** As colunas Gravação/Edição/Reunião viram derivadas na leitura (`getMonthlyChecklists`), sem mudar o modelo do checklist. A Reunião passa a filtrar `calendar_events.sub_calendar='assessores'`. A Gravação conta linhas de `audiovisual_capturas` por cliente/mês. O formulário de evento passa a mostrar o seletor de Cliente pra todos os tipos + campo avulso (texto livre, coluna nova `cliente_avulso`).

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (service-role reads em `unstable_cache`), Vitest, Tailwind.

**Fluxo de trabalho (por task):** branch a partir de `origin/main`; `npx tsc --noEmit` + `npx eslint <arquivos>` + `npx vitest run --exclude "**/.claude/**"` verdes; commit com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Migration (Task 9) é manual — não roda no deploy.

---

## Estrutura de arquivos

**Fase 1 — Painel (sem migration)**
- `src/lib/painel/pacote-matrix.ts` — remove `design` e `mobile` das colunas; `camera` vira a coluna "Gravação".
- `src/lib/painel/global-status.ts` — `COLUNA_STEP_KEY` perde design/mobile.
- `src/lib/painel/area-filter.ts` — remove referências a `design`/`mobile`.
- `src/lib/painel/queries.ts` — Reunião por `sub_calendar='assessores'`; contagem de gravação; `ChecklistRow.gravacao_count`.
- `src/components/painel/AreaFilter.tsx` — tira o chip "Design".
- `src/components/painel/cells/GravacaoCell.tsx` — **novo** (substitui CameraMobileCell nas colunas Câm/Mob).
- `src/components/painel/cells/ReuniaoCell.tsx` / `EdicaoCell.tsx` — viram read-only ("Agendada"/"Sem reunião", "Editado"/"Pendente").
- `src/components/painel/cells/DriveCell.tsx` — vira link de texto "Abrir".
- `src/components/painel/PainelTable.tsx` — colunas novas, cabeçalho, legenda, visual sóbrio.
- `src/components/painel/PainelCard.tsx` — espelha as colunas.

**Fase 2 — Formulário de evento (1 migration)**
- `supabase/migrations/20260714120000_calendar_cliente_avulso.sql` — **novo**.
- `src/lib/calendario/schema.ts` — campo `cliente_avulso`.
- `src/lib/calendario/actions.ts` — persiste `cliente_avulso`.
- `src/components/calendario/EventForm.tsx` — seletor de Cliente pra todos os tipos + "+" avulso.

---

## FASE 1 — Painel

### Task 1: Remover colunas Design e Mobile da matriz de pacotes

**Files:**
- Modify: `src/lib/painel/pacote-matrix.ts`

- [ ] **Step 1: Ler o arquivo atual** pra confirmar o shape (`COLUMN_KEYS`, `PACOTE_COLUMNS`, `NOTHING`).

- [ ] **Step 2: Remover `design` e `mobile` de `COLUMN_KEYS`**

Trocar o array (linhas 15-26) por:

```ts
export const COLUMN_KEYS = [
  "crono",
  "tpg",
  "tpm",
  "gmn",
  "camera",   // exibida como "Gravação"
  "edicao",
  "reuniao",
  "pacote_postados",
] as const;
```

- [ ] **Step 3: Remover `design` e `mobile` de `NOTHING` e de TODAS as entradas de `PACOTE_COLUMNS`**

Ex.: `NOTHING` vira `{ crono:0, tpg:0, tpm:0, gmn:0, camera:0, edicao:0, reuniao:0, pacote_postados:0 }`. Em cada pacote, apagar as chaves `design:` e `mobile:`. Exemplo `trafego_estrategia`:

```ts
  trafego_estrategia: {
    crono: 1, tpg: 1, tpm: 1, gmn: 1,
    camera: 1, edicao: 1, reuniao: 1, pacote_postados: 1,
  },
```

Repetir removendo `design`/`mobile` de `trafego`, `estrategia`, `audiovisual`, `yide_360`, `ecommerce`. `site/ia/crm/crm_ia` continuam `{ ...NOTHING }`.

- [ ] **Step 4: Rodar o typecheck pra ver o estrago encadeado**

Run: `npx tsc --noEmit 2>&1 | grep -v "node_modules/.claude" | head -30`
Expected: erros em `global-status.ts`, `area-filter.ts`, `PainelTable.tsx`, `PainelCard.tsx` referenciando `design`/`mobile`. Serão corrigidos nas próximas tasks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/painel/pacote-matrix.ts
git commit -m "refactor(painel): remove colunas design e mobile da matriz"
```

---

### Task 2: Ajustar status global (sem design/mobile)

**Files:**
- Modify: `src/lib/painel/global-status.ts:6-13`

- [ ] **Step 1: Atualizar `COLUNA_STEP_KEY`** removendo design e mobile:

```ts
const COLUNA_STEP_KEY: Partial<Record<ColumnKey, string>> = {
  crono: "cronograma",
  camera: "camera",
  edicao: "edicao",
  reuniao: "reuniao",
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep global-status`
Expected: sem erros nesse arquivo.

- [ ] **Step 3: Rodar testes existentes de status** (se houver)

Run: `npx vitest run --exclude "**/.claude/**" -t "global-status" 2>&1 | tail -15` (ou `npx vitest run tests/unit/painel* --exclude "**/.claude/**"`)
Expected: PASS (ou "no tests"). Se algum teste fixava design/mobile como aplicável, atualizar a expectativa pra refletir que essas colunas saíram.

- [ ] **Step 4: Commit**

```bash
git add src/lib/painel/global-status.ts
git commit -m "refactor(painel): status global ignora design/mobile"
```

---

### Task 3: Ajustar filtro de Área (remove Design/Mobile)

**Files:**
- Modify: `src/lib/painel/area-filter.ts`
- Modify: `src/components/painel/AreaFilter.tsx`

- [ ] **Step 1: Ler `area-filter.ts`** e identificar onde `design`/`mobile`/`camera` são usados pra mapear áreas (a área "Design" olha a coluna `design`; a área "Audiovisual" olha `camera`/`mobile`).

- [ ] **Step 2: Remover a área "Design"** e trocar qualquer referência a `mobile` por só `camera`. A área "Audiovisual" passa a checar apenas `camera`. Remover a entrada de área `design` do mapa/união de tipos.

- [ ] **Step 3: Remover o chip "Design"** de `AreaFilter.tsx` (o botão/opção que passa `area=design`). As opções ficam: Todos, Tráfego, Estratégia, Audiovisual, Edição, Yide 360°.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "area-filter|AreaFilter"` — Expected: vazio.
Run: `npx eslint src/lib/painel/area-filter.ts "src/components/painel/AreaFilter.tsx"` — Expected: limpo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/painel/area-filter.ts "src/components/painel/AreaFilter.tsx"
git commit -m "refactor(painel): remove área/filtro Design"
```

---

### Task 4: Reunião por tipo 'assessores' + contagem de Gravação (queries)

**Files:**
- Modify: `src/lib/painel/queries.ts` (interface `ChecklistRow:38-66`, função `getDerivedDoneSet:398-464`, montagem do row `:329-345`)
- Test: `tests/unit/painel-gravacao-count.test.ts` (novo)

- [ ] **Step 1: Escrever teste da função pura de contagem**

Vamos extrair a agregação de gravação numa função pura testável. Criar o teste primeiro:

```ts
// tests/unit/painel-gravacao-count.test.ts
import { describe, it, expect } from "vitest";
import { countGravacoesByClient } from "@/lib/painel/queries";

describe("countGravacoesByClient", () => {
  it("conta capturas por cliente", () => {
    const rows = [
      { client_id: "a" }, { client_id: "a" }, { client_id: "b" }, { client_id: null },
    ];
    const map = countGravacoesByClient(rows);
    expect(map.get("a")).toBe(2);
    expect(map.get("b")).toBe(1);
    expect(map.has("null")).toBe(false);
  });

  it("retorna map vazio pra lista vazia", () => {
    expect(countGravacoesByClient([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar o teste (deve falhar)**

Run: `npx vitest run tests/unit/painel-gravacao-count.test.ts --exclude "**/.claude/**"`
Expected: FAIL — `countGravacoesByClient` não existe.

- [ ] **Step 3: Exportar a função pura em `queries.ts`** (perto de `getDerivedDoneSet`):

```ts
/** Conta capturas (gravações) por client_id. Ignora linhas sem cliente. */
export function countGravacoesByClient(
  rows: Array<{ client_id: string | null }>,
): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!r.client_id) continue;
    m.set(r.client_id, (m.get(r.client_id) ?? 0) + 1);
  }
  return m;
}
```

- [ ] **Step 4: Rodar o teste (deve passar)**

Run: `npx vitest run tests/unit/painel-gravacao-count.test.ts --exclude "**/.claude/**"`
Expected: PASS.

- [ ] **Step 5: Filtrar Reunião por `sub_calendar='assessores'`** em `getDerivedDoneSet` (a query de `calendar_events`, linhas ~423-428):

```ts
    // Reunião - só eventos do tipo "Assessores" com client_id no mês
    sb
      .from("calendar_events")
      .select("client_id")
      .eq("sub_calendar", "assessores")
      .in("client_id", clientIds)
      .gte("inicio", startIso)
      .lt("inicio", endIso),
```

- [ ] **Step 6: Fazer `getDerivedDoneSet` retornar também a contagem de gravação.** Mudar a assinatura pra devolver `{ done: Set<string>; gravacaoCount: Map<string, number> }`. Depois do bloco que popula `done` (linha ~461), adicionar:

```ts
  const gravacaoCount = countGravacoesByClient(
    (capturasRes.data ?? []) as Array<{ client_id: string | null }>,
  );

  return { done, gravacaoCount };
```

Trocar a linha final `return done;` por isso. Ajustar o tipo de retorno da função pra `Promise<{ done: Set<string>; gravacaoCount: Map<string, number> }>`.

- [ ] **Step 7: Atualizar o consumidor** em `getMonthlyChecklists` (linha ~294). Trocar:

```ts
  const { done: derivedDone, gravacaoCount } = await getDerivedDoneSet(supabase, mesReferencia, clientIds);
```

(o `derivedDone.add(...)` do cronograma nas linhas 297-301 continua igual, agora sobre `derivedDone`).

- [ ] **Step 8: Adicionar `gravacao_count` na interface `ChecklistRow`** (após `gmn_otimizado`, linha ~64):

```ts
  gravacao_count: number;
```

- [ ] **Step 9: Preencher `gravacao_count` no `.map` final** (montagem do ChecklistRow, linha ~329-345), dentro do objeto retornado:

```ts
      gravacao_count: gravacaoCount.get(c.id) ?? 0,
```

- [ ] **Step 10: Typecheck + testes**

Run: `npx tsc --noEmit 2>&1 | grep -v "node_modules/.claude" | grep painel` — Expected: vazio.
Run: `npx vitest run tests/unit/painel-gravacao-count.test.ts --exclude "**/.claude/**"` — Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/painel/queries.ts tests/unit/painel-gravacao-count.test.ts
git commit -m "feat(painel): reunião por tipo assessores + contagem de gravação"
```

---

### Task 5: Célula Gravação (nova, read-only com contagem)

**Files:**
- Create: `src/components/painel/cells/GravacaoCell.tsx`

- [ ] **Step 1: Criar o componente** (server component simples, sem interação):

```tsx
// src/components/painel/cells/GravacaoCell.tsx
export function GravacaoCell({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="text-[12px] text-muted-foreground/60">Não gravado</span>;
  }
  return (
    <span className="text-[12px] text-foreground/80">
      Gravado · {count}×
    </span>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npx eslint "src/components/painel/cells/GravacaoCell.tsx"`
Expected: limpo.

- [ ] **Step 3: Commit**

```bash
git add "src/components/painel/cells/GravacaoCell.tsx"
git commit -m "feat(painel): célula Gravação (contagem, read-only)"
```

---

### Task 6: Reunião, Edição e Drive read-only/texto

**Files:**
- Modify: `src/components/painel/cells/ReuniaoCell.tsx`
- Modify: `src/components/painel/cells/EdicaoCell.tsx`
- Modify: `src/components/painel/cells/DriveCell.tsx`

- [ ] **Step 1: `ReuniaoCell` vira read-only.** Ler o arquivo atual; remover o `onClick`/`markStepProntoAction`/`useTransition`. Renderizar por status derivado:

```tsx
export function ReuniaoCell({ status }: { status: string }) {
  if (status === "pronto") {
    return <span className="text-[12px] text-foreground/80">Agendada</span>;
  }
  return <span className="text-[12px] text-muted-foreground/60">Sem reunião</span>;
}
```

Manter a assinatura de props compatível com o que `PainelTable` passa (se hoje recebe `step`/`stepId`, adaptar pra ler `step.status`). Ajustar o call-site na Task 7.

- [ ] **Step 2: `EdicaoCell` vira read-only:**

```tsx
export function EdicaoCell({ status }: { status: string }) {
  if (status === "pronto") {
    return <span className="text-[12px] text-foreground/80">Editado</span>;
  }
  return <span className="text-[12px] text-muted-foreground/60">Pendente</span>;
}
```

- [ ] **Step 3: `DriveCell` vira link de texto "Abrir"** (sem ícone/emoji). Ler o arquivo; trocar o ícone de pasta por:

```tsx
export function DriveCell({ url }: { url: string | null }) {
  if (!url) return <span className="text-muted-foreground/40">–</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
       className="text-[12px] text-primary hover:underline">
      Abrir
    </a>
  );
}
```

(Manter o nome da prop igual ao que `PainelTable` já passa — se hoje é `driveUrl`, usar esse nome.)

- [ ] **Step 4: Lint**

Run: `npx eslint "src/components/painel/cells/ReuniaoCell.tsx" "src/components/painel/cells/EdicaoCell.tsx" "src/components/painel/cells/DriveCell.tsx"`
Expected: limpo (podem sobrar imports não usados — remover).

- [ ] **Step 5: Commit**

```bash
git add "src/components/painel/cells/ReuniaoCell.tsx" "src/components/painel/cells/EdicaoCell.tsx" "src/components/painel/cells/DriveCell.tsx"
git commit -m "feat(painel): reunião/edição read-only + drive como texto"
```

---

### Task 7: Tabela — colunas novas, legenda e visual sóbrio

**Files:**
- Modify: `src/components/painel/PainelTable.tsx`

- [ ] **Step 1: Ler `PainelTable.tsx` inteiro** pra entender como as colunas são definidas e como cada célula é escolhida por `ColumnKey`.

- [ ] **Step 2: Atualizar a lista/ordem de colunas** pra: `Cliente, Pacote, Crono, TPG, TPM, GMN, Gravação, Edição, Reunião, Drive`. Remover as entradas de `design` e `mobile`. A coluna `camera` passa a ter cabeçalho **"Gravação"**.

- [ ] **Step 3: Trocar os renderizadores de célula:**
  - `camera` → `<GravacaoCell count={row.gravacao_count} />` (importar de `./cells/GravacaoCell`). Remover `CameraMobileCell` das colunas Câm/Mob.
  - `reuniao` → `<ReuniaoCell status={reuniaoStep?.status ?? "pendente"} />`.
  - `edicao` → `<EdicaoCell status={edicaoStep?.status ?? "pendente"} />`.
  - `design` → remover a coluna.
  - `drive` → `<DriveCell url={row.client_drive_url} />`.

  Onde `reuniaoStep`/`edicaoStep` = `row.steps.find(s => s.step_key === "reuniao"|"edicao")`.

- [ ] **Step 4: Adicionar uma linha de legenda** logo acima da tabela (texto, sem emoji/cor):

```tsx
<div className="px-1 pb-2 text-[11.5px] text-muted-foreground">
  <b className="text-foreground/70">TPG</b> Tráfego Google ·{" "}
  <b className="text-foreground/70">TPM</b> Tráfego Meta ·{" "}
  <b className="text-foreground/70">GMN</b> Google Meu Negócio ·{" "}
  <b className="text-foreground/70">Gravação</b> nº de gravações no mês ·{" "}
  <b className="text-foreground/70">Edição</b> passou pelo time ·{" "}
  <b className="text-foreground/70">Reunião</b> agendada (tipo Assessores)
</div>
```

- [ ] **Step 5: Suavizar o visual** — garantir que "atrasado" seja o único destaque forte (vermelho); concluído/checks em tom neutro (`text-foreground/80`), pendências em `text-muted-foreground/60`. Não introduzir novas cores fortes.

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "node_modules/.claude" | grep PainelTable` — Expected: vazio.
Run: `npx eslint "src/components/painel/PainelTable.tsx"` — Expected: limpo.

- [ ] **Step 7: Commit**

```bash
git add "src/components/painel/PainelTable.tsx"
git commit -m "feat(painel): colunas novas + legenda + visual sóbrio (tabela)"
```

---

### Task 8: Cards — espelhar as mesmas colunas

**Files:**
- Modify: `src/components/painel/PainelCard.tsx`

- [ ] **Step 1: Ler `PainelCard.tsx`** e localizar onde renderiza os "IndicatorTile" por coluna.

- [ ] **Step 2: Aplicar as mesmas mudanças da Task 7:** remover Design e Mobile; `camera` vira "Gravação" com `<GravacaoCell count={row.gravacao_count} />`; Reunião/Edição usam as células read-only; Drive vira "Abrir". Sem emoji, cor só no atrasado.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "node_modules/.claude" | grep PainelCard` — Expected: vazio.
Run: `npx eslint "src/components/painel/PainelCard.tsx"` — Expected: limpo.

- [ ] **Step 4: Rodar a suíte inteira**

Run: `npx vitest run --exclude "**/.claude/**" 2>&1 | tail -6`
Expected: todos verdes.

- [ ] **Step 5: Commit**

```bash
git add "src/components/painel/PainelCard.tsx"
git commit -m "feat(painel): view Cards espelha colunas novas"
```

---

## FASE 2 — Formulário de evento

### Task 9: Migration — coluna cliente_avulso

**Files:**
- Create: `supabase/migrations/20260714120000_calendar_cliente_avulso.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- Cliente avulso (texto livre) em eventos do calendário.
-- Usado quando o cliente não está cadastrado — só rótulo no evento,
-- NÃO entra nas contagens do painel (que só olham client_id real).
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS cliente_avulso text;
```

- [ ] **Step 2: Commit** (aplicação é manual no SQL Editor após o merge)

```bash
git add supabase/migrations/20260714120000_calendar_cliente_avulso.sql
git commit -m "feat(calendario): migration cliente_avulso (aplicar manual)"
```

---

### Task 10: Schema + action aceitam cliente_avulso

**Files:**
- Modify: `src/lib/calendario/schema.ts:27-47` (baseEventFields)
- Modify: `src/lib/calendario/actions.ts:231-246` (basePayload)

- [ ] **Step 1: Adicionar `cliente_avulso` ao schema** (em `baseEventFields`, junto de `client_id`):

```ts
  cliente_avulso: z.string().trim().max(120).optional().nullable(),
```

- [ ] **Step 2: Persistir no insert** (`basePayload` em actions.ts, junto de `client_id`):

```ts
  cliente_avulso: parsed.data.cliente_avulso?.trim() || null,
```

- [ ] **Step 3: Graceful degradation pré-migration.** Se a coluna ainda não existir, o insert falha com erro mencionando `cliente_avulso`. Envolver o insert existente num fallback: em caso de erro cujo `message` inclui `"cliente_avulso"`, re-tentar o insert sem essa chave. (Seguir o padrão de fallback já usado no projeto — ler o insert atual e espelhar o try/fallback. Se o projeto aplica a migration antes do merge, esse fallback pode ser dispensado; incluir por segurança na janela deploy→migration.)

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "node_modules/.claude" | grep calendario` — Expected: vazio.
Run: `npx eslint src/lib/calendario/schema.ts src/lib/calendario/actions.ts` — Expected: limpo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calendario/schema.ts src/lib/calendario/actions.ts
git commit -m "feat(calendario): schema/action aceitam cliente_avulso"
```

---

### Task 11: Formulário — seletor de Cliente em todos os tipos + "+" avulso

**Files:**
- Modify: `src/components/calendario/EventForm.tsx` (bloco `{isVideomaker && (...)}` que hoje envolve o seletor de Cliente, ~linhas 148-250)

- [ ] **Step 1: Ler `EventForm.tsx`** e localizar o seletor de Cliente (`SearchableSelect` com `name="client_id"`, hoje dentro de `{isVideomaker && (...)}`).

- [ ] **Step 2: Mover o seletor de Cliente pra a seção geral do form** (fora do `{isVideomaker}`), de modo que apareça pra todos os tipos. Posicioná-lo depois de Descrição/antes de Participantes. Manter `name="client_id"` e a lista `clientes` já passada por prop. Rótulo: "Cliente (recomendado)".

- [ ] **Step 3: Adicionar a opção "+" cliente avulso.** Abaixo do seletor, um botão "+ Cliente avulso" que revela um `<input name="cliente_avulso" type="text" placeholder="Nome do cliente avulso" maxLength={120} />`. Estado local `const [avulsoOpen, setAvulsoOpen] = useState(false)`. Quando aberto, o seletor de `client_id` some (ou é limpo) — os dois são mutuamente exclusivos: ou escolhe cliente cadastrado, ou digita avulso.

```tsx
{!avulsoOpen ? (
  <button type="button" onClick={() => setAvulsoOpen(true)}
    className="text-[12px] text-primary hover:underline">
    + Cliente avulso (não cadastrado)
  </button>
) : (
  <div className="space-y-1">
    <input name="cliente_avulso" type="text" maxLength={120}
      placeholder="Nome do cliente avulso"
      className="w-full rounded-md border bg-background px-3 py-2 text-sm" />
    <button type="button" onClick={() => setAvulsoOpen(false)}
      className="text-[12px] text-muted-foreground hover:underline">
      Cancelar e escolher da lista
    </button>
  </div>
)}
```

- [ ] **Step 4: Garantir o mesmo no form de edição** (`src/app/(authed)/calendario/[id]/page.tsx` usa o mesmo `EventForm`? Confirmar; se sim, já herda. Se houver um editEventAction/schema separado, aplicar `cliente_avulso` lá também.)

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep -v "node_modules/.claude" | grep -i eventform` — Expected: vazio.
Run: `npx eslint "src/components/calendario/EventForm.tsx"` — Expected: limpo.

- [ ] **Step 6: Suíte inteira**

Run: `npx vitest run --exclude "**/.claude/**" 2>&1 | tail -6`
Expected: verdes.

- [ ] **Step 7: Commit**

```bash
git add "src/components/calendario/EventForm.tsx"
git commit -m "feat(calendario): cliente em todos os tipos + avulso no form de evento"
```

---

## Verificação final (antes do PR)

- [ ] `npx tsc --noEmit` limpo (fora `node_modules/.claude`).
- [ ] `npx eslint` limpo nos arquivos tocados.
- [ ] `npx vitest run --exclude "**/.claude/**"` — todos verdes.
- [ ] Abrir `/painel`: sem coluna Design; coluna "Gravação" com contagem; Reunião "Agendada/Sem reunião"; Edição "Editado/Pendente"; Drive "Abrir"; legenda visível; visual sóbrio.
- [ ] Abrir "Novo evento": seletor de Cliente aparece pra tipo Assessores; "+" avulso funciona.
- [ ] PR com nota: **migration manual** `20260714120000_calendar_cliente_avulso.sql` a aplicar no SQL Editor.

## Notas de risco (do spec)

- Reunião só enche quando o time começar a selecionar o cliente nos eventos de assessoria (eventos antigos não têm `client_id`). Esperado.
- Confirmar que remover a coluna Design no painel não quebra a delegação de design (que vive em outros fluxos, não no painel).
