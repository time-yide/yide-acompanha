# Fast Mídia — instrução por cliente na grade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Adicionar uma instrução (texto) por cliente na grade de stories do `/fast-media` — Fast Mídia lê; gestores (adm/sócio/coordenador) e o assessor do cliente editam.

**Architecture:** Nova coluna `clients.stories_instrucao` (nullable). SELECT da grade com fallback resiliente pra sobreviver ao gap deploy→migration. Uma server action nova (service-role) com gate próprio (gestores OU assessor-dono) + validação de unidade. UI: bloco de instrução no card + dialog de edição.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (service-role), Zod, React client components, sonner, Vitest.

---

## File Structure

- **Create:** `supabase/migrations/20260716000000_clients_stories_instrucao.sql`
- **Create:** `tests/unit/stories-instrucao-action.test.ts`
- **Modify:** `src/lib/painel/stories-queries.ts` — `StoriesGridRow` (+`stories_instrucao`,+`assessor_id`) e SELECT resiliente em `getStoriesGridForMonth`.
- **Modify:** `src/lib/painel/stories-actions.ts` — `updateClienteStoriesInstrucaoAction`.
- **Modify:** `src/components/fast-media/StoriesMonthGrid.tsx` — props `viewerId`/`canEditInstrucaoManager`, bloco de instrução + dialog.
- **Modify:** `src/app/(authed)/fast-media/page.tsx` — passa `viewerId`/`canEditInstrucaoManager`.

Reusa helpers já existentes em `stories-actions.ts`: `uuidLike`, `clienteNaUnidadeAtiva`, `requireAuth`, `createServiceRoleClient`.

---

## Task 1: Migration

**Files:**
- Create: `supabase/migrations/20260716000000_clients_stories_instrucao.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- Instrução/indicação por cliente pra Fast Mídia ler ao produzir stories.
-- Coluna additiva, nullable. Não referenciada por código existente.
alter table public.clients
  add column if not exists stories_instrucao text;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260716000000_clients_stories_instrucao.sql
git commit -m "feat(fast-media): migration coluna clients.stories_instrucao"
```

Nota: migration é aplicada manualmente no SQL Editor do Supabase (não roda no deploy).

---

## Task 2: Query — instrução + assessor_id no StoriesGridRow (SELECT resiliente)

**Files:**
- Modify: `src/lib/painel/stories-queries.ts`

- [ ] **Step 1: Adicionar campos ao `StoriesGridRow`**

Substitua:

```ts
export interface StoriesGridRow {
  client_id: string;
  client_nome: string;
  quantidade_diaria_stories: number;
  assessor_nome: string | null;
  dias: StoryDay[];
  postados: number;
  meta: number;
}
```

por:

```ts
export interface StoriesGridRow {
  client_id: string;
  client_nome: string;
  quantidade_diaria_stories: number;
  assessor_id: string | null;
  assessor_nome: string | null;
  stories_instrucao: string | null;
  dias: StoryDay[];
  postados: number;
  meta: number;
}
```

- [ ] **Step 2: SELECT resiliente em `getStoriesGridForMonth`**

Substitua este bloco:

```ts
  let clientsQuery = supabase
    .from("clients")
    .select("id, nome, quantidade_diaria_stories, assessor_id")
    .eq("status", "ativo")
    .eq("tem_stories", true);
  if (unitClientIds !== null) clientsQuery = clientsQuery.in("id", unitClientIds);

  const { data: clientsData, error: clientsError } = await clientsQuery.order("nome");
  if (clientsError) {
    console.error("[painel/stories-grid] erro ao listar clientes:", clientsError.message);
    return [];
  }
  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    quantidade_diaria_stories: number | null;
    assessor_id: string | null;
  }>;
```

por:

```ts
  // SELECT resiliente: tenta com stories_instrucao; se a coluna ainda não existe
  // (gap entre deploy e migration manual), refaz sem ela pra não esvaziar a grade.
  const buildClientsQuery = (cols: string) => {
    let q = supabase
      .from("clients")
      .select(cols)
      .eq("status", "ativo")
      .eq("tem_stories", true);
    if (unitClientIds !== null) q = q.in("id", unitClientIds);
    return q.order("nome");
  };

  const BASE_COLS = "id, nome, quantidade_diaria_stories, assessor_id";
  let { data: clientsData, error: clientsError } = await buildClientsQuery(
    `${BASE_COLS}, stories_instrucao`,
  );
  if (clientsError && /stories_instrucao|column|schema cache/i.test(clientsError.message ?? "")) {
    console.warn(
      "[painel/stories-grid] coluna stories_instrucao ainda não existe, usando fallback:",
      clientsError.message,
    );
    ({ data: clientsData, error: clientsError } = await buildClientsQuery(BASE_COLS));
  }
  if (clientsError) {
    console.error("[painel/stories-grid] erro ao listar clientes:", clientsError.message);
    return [];
  }
  const clients = (clientsData ?? []) as Array<{
    id: string;
    nome: string;
    quantidade_diaria_stories: number | null;
    assessor_id: string | null;
    stories_instrucao?: string | null;
  }>;
```

- [ ] **Step 3: Mapear os novos campos no retorno**

Substitua:

```ts
      return {
        client_id: c.id,
        client_nome: c.nome,
        quantidade_diaria_stories: diaria,
        assessor_nome: c.assessor_id ? (assessorNomeById.get(c.assessor_id) ?? null) : null,
        dias: diasArr,
        postados,
        meta: diaria * dias,
      };
```

por:

```ts
      return {
        client_id: c.id,
        client_nome: c.nome,
        quantidade_diaria_stories: diaria,
        assessor_id: c.assessor_id,
        assessor_nome: c.assessor_id ? (assessorNomeById.get(c.assessor_id) ?? null) : null,
        stories_instrucao: c.stories_instrucao ?? null,
        dias: diasArr,
        postados,
        meta: diaria * dias,
      };
```

- [ ] **Step 4: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/painel/stories-queries.ts
git commit -m "feat(fast-media): stories_instrucao + assessor_id no StoriesGridRow (select resiliente)"
```

---

## Task 3: Server action — editar instrução

**Files:**
- Modify: `src/lib/painel/stories-actions.ts` (adicionar no fim do arquivo)

- [ ] **Step 1: Adicionar a action no fim do arquivo**

Adicione ao final de `src/lib/painel/stories-actions.ts` (reusa `uuidLike` e `clienteNaUnidadeAtiva` já definidos no arquivo):

```ts
// ── Instrução por cliente (Fast Mídia lê; gestores + assessor do cliente editam)
const EDIT_INSTRUCAO_ROLES = ["adm", "socio", "coordenador"] as const;

const updateInstrucaoSchema = z.object({
  client_id: uuidLike,
  instrucao: z.string().max(1000, "Instrução muito longa (máx. 1000)"),
});

/**
 * Define a instrução/indicação de um cliente na grade de stories. Editam:
 * gestores (adm/socio/coordenador) OU o assessor do próprio cliente. A Fast
 * Mídia só lê. Texto vazio limpa (grava null). Service-role + validação de
 * unidade (fast_midia não pode editar, por isso o gate é próprio, diferente do
 * ALLOWED_ROLES das outras actions).
 */
export async function updateClienteStoriesInstrucaoAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const actor = await requireAuth();

  const parsed = updateInstrucaoSchema.safeParse({
    client_id: formData.get("client_id"),
    instrucao: formData.get("instrucao") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { client_id, instrucao } = parsed.data;
  if (!(await clienteNaUnidadeAtiva(client_id))) {
    return { error: "Cliente fora da unidade ativa" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceRoleClient() as any;

  // Carrega o assessor do cliente pra decidir permissão de assessor-dono.
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("assessor_id")
    .eq("id", client_id)
    .single();
  if (clientError || !clientRow) return { error: "Cliente não encontrado" };

  const isManager = (EDIT_INSTRUCAO_ROLES as readonly string[]).includes(actor.role);
  const isAssessorDono = (clientRow as { assessor_id: string | null }).assessor_id === actor.id;
  if (!isManager && !isAssessorDono) return { error: "Sem permissão" };

  const texto = instrucao.trim();
  const { data, error } = await supabase
    .from("clients")
    .update({ stories_instrucao: texto.length > 0 ? texto : null })
    .eq("id", client_id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "Cliente não encontrado" };

  revalidatePath("/fast-media");
  return { success: true };
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/painel/stories-actions.ts
git commit -m "feat(fast-media): action editar instrução do cliente na grade"
```

---

## Task 4: Teste da action

**Files:**
- Create: `tests/unit/stories-instrucao-action.test.ts`

- [ ] **Step 1: Escrever o teste**

Crie `tests/unit/stories-instrucao-action.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.hoisted(() => vi.fn());
const requireAuthMock = vi.hoisted(() => vi.fn());
const unitIdsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient: () => ({ from: fromMock }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: fromMock }) }));
vi.mock("@/lib/units/filter-helpers", () => ({
  getClientIdsForActiveUnit: unitIdsMock,
  getProfileIdsForActiveUnit: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { updateClienteStoriesInstrucaoAction } from "@/lib/painel/stories-actions";

const CID = "1a9a33c5-afde-4df5-92c6-6784500e6d91";
const ASSESSOR = "a63d8245-dcad-4b7b-8c75-2d91bb4944e0";

function fd(obj: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

/**
 * Mock: clients.select("assessor_id").eq().single() -> { data: {assessor_id} }
 * e clients.update().eq().select("id") -> { data, error }.
 */
function mockClients(assessorId: string | null, updateResult: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue({ data: { assessor_id: assessorId }, error: null });
  const selectEq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq: selectEq }));
  // update chain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upChain: any = {};
  upChain.eq = vi.fn(() => upChain);
  upChain.select = vi.fn(() => Promise.resolve(updateResult));
  const update = vi.fn(() => upChain);
  fromMock.mockImplementation((t: string) => (t === "clients" ? { select, update } : {}));
  return { update, upChain };
}

beforeEach(() => {
  fromMock.mockReset();
  requireAuthMock.mockReset();
  unitIdsMock.mockReset().mockResolvedValue(null);
});

describe("updateClienteStoriesInstrucaoAction", () => {
  it("manager edita a instrução", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "coordenador" });
    const { update } = mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "Focar em bastidores" }));
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ stories_instrucao: "Focar em bastidores" });
  });

  it("assessor dono do cliente edita", async () => {
    requireAuthMock.mockResolvedValue({ id: ASSESSOR, role: "assessor" });
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "oi" }));
    expect(r.success).toBe(true);
  });

  it("outro assessor (não dono) é negado", async () => {
    requireAuthMock.mockResolvedValue({ id: "outro-assessor", role: "assessor" });
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "x" }));
    expect(r.error).toBe("Sem permissão");
  });

  it("fast_midia é negado", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "fast_midia" });
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "x" }));
    expect(r.error).toBe("Sem permissão");
  });

  it("texto vazio limpa (grava null)", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "adm" });
    const { update } = mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "   " }));
    expect(r.success).toBe(true);
    expect(update).toHaveBeenCalledWith({ stories_instrucao: null });
  });

  it("cliente fora da unidade é negado", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "adm" });
    unitIdsMock.mockResolvedValue(["outro-id"]);
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "x" }));
    expect(r.error).toBe("Cliente fora da unidade ativa");
  });

  it("texto > 1000 é rejeitado", async () => {
    requireAuthMock.mockResolvedValue({ id: "u1", role: "adm" });
    mockClients(ASSESSOR, { data: [{ id: CID }], error: null });
    const r = await updateClienteStoriesInstrucaoAction(fd({ client_id: CID, instrucao: "a".repeat(1001) }));
    expect(r.error).toBeTruthy();
    expect(r.success).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar o teste**

Run: `npx vitest run tests/unit/stories-instrucao-action.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 3: Commit**

```bash
git add tests/unit/stories-instrucao-action.test.ts
git commit -m "test(fast-media): action de instrução do cliente"
```

---

## Task 5: UI — bloco de instrução + dialog no StoriesMonthGrid

**Files:**
- Modify: `src/components/fast-media/StoriesMonthGrid.tsx`

- [ ] **Step 1: Imports**

Substitua:

```tsx
import { Minus, Plus, Check, Pencil, Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  setStoryDayCountAction,
  updateClienteDiariaStoriesAction,
  removeClienteStoriesAction,
} from "@/lib/painel/stories-actions";
```

por:

```tsx
import { Minus, Plus, Check, Pencil, Trash2, ExternalLink, StickyNote } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  setStoryDayCountAction,
  updateClienteDiariaStoriesAction,
  removeClienteStoriesAction,
  updateClienteStoriesInstrucaoAction,
} from "@/lib/painel/stories-actions";
```

- [ ] **Step 2: Props da grade + repasse pro row**

Substitua:

```tsx
interface Props {
  rows: StoriesGridRow[];
  canEdit: boolean;
  /** "YYYY-MM-DD" de hoje no fuso da app (server-provided, evita drift de TZ). */
  todayIso: string;
}

export function StoriesMonthGrid({ rows, canEdit, todayIso }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum cliente com stories ativado nesta unidade.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <ClientStoryRow key={r.client_id} row={r} canEdit={canEdit} todayIso={todayIso} />
      ))}
    </div>
  );
}

function ClientStoryRow({
  row,
  canEdit,
  todayIso,
}: {
  row: StoriesGridRow;
  canEdit: boolean;
  todayIso: string;
}) {
```

por:

```tsx
interface Props {
  rows: StoriesGridRow[];
  canEdit: boolean;
  /** "YYYY-MM-DD" de hoje no fuso da app (server-provided, evita drift de TZ). */
  todayIso: string;
  /** id do usuário logado (pra decidir se é o assessor-dono do cliente). */
  viewerId: string | null;
  /** true se o cargo edita instrução (adm/socio/coordenador). */
  canEditInstrucaoManager: boolean;
}

export function StoriesMonthGrid({ rows, canEdit, todayIso, viewerId, canEditInstrucaoManager }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Nenhum cliente com stories ativado nesta unidade.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <ClientStoryRow
          key={r.client_id}
          row={r}
          canEdit={canEdit}
          todayIso={todayIso}
          canEditInstrucao={canEditInstrucaoManager || (!!viewerId && r.assessor_id === viewerId)}
        />
      ))}
    </div>
  );
}

function ClientStoryRow({
  row,
  canEdit,
  todayIso,
  canEditInstrucao,
}: {
  row: StoriesGridRow;
  canEdit: boolean;
  todayIso: string;
  canEditInstrucao: boolean;
}) {
```

- [ ] **Step 3: Estado + handler da instrução**

Logo depois de `const [confirmRemove, setConfirmRemove] = useState(false);`, adicione:

```tsx
  const [editingInstrucao, setEditingInstrucao] = useState(false);
  const [instrucaoInput, setInstrucaoInput] = useState<string>(row.stories_instrucao ?? "");

  function saveInstrucao() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("client_id", row.client_id);
      fd.set("instrucao", instrucaoInput);
      const res = await updateClienteStoriesInstrucaoAction(fd);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Instrução salva");
      setEditingInstrucao(false);
      router.refresh();
    });
  }
```

- [ ] **Step 4: Bloco de instrução no card (após a barra de progresso)**

Substitua:

```tsx
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Strip de dias do mês */}
```

por:

```tsx
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Instrução do cliente (Fast Mídia lê; gestores/assessor editam) */}
      {(row.stories_instrucao || canEditInstrucao) && (
        <div className="mt-2.5">
          {row.stories_instrucao ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="min-w-0 flex-1 whitespace-pre-wrap text-xs text-foreground/90">
                {row.stories_instrucao}
              </p>
              {canEditInstrucao && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 text-muted-foreground"
                  onClick={() => {
                    setInstrucaoInput(row.stories_instrucao ?? "");
                    setEditingInstrucao(true);
                  }}
                  aria-label="Editar instrução"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          ) : (
            canEditInstrucao && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={() => {
                  setInstrucaoInput("");
                  setEditingInstrucao(true);
                }}
              >
                <StickyNote className="h-3.5 w-3.5" />
                Adicionar instrução
              </Button>
            )
          )}
        </div>
      )}

      {/* Strip de dias do mês */}
```

- [ ] **Step 5: Dialog de edição da instrução (antes do `</div>` final do row)**

Substitua o fechamento final:

```tsx
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setManaging(false)}>
              Fechar
            </Button>
            <Button type="button" disabled={pending} onClick={saveDiaria}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

por:

```tsx
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setManaging(false)}>
              Fechar
            </Button>
            <Button type="button" disabled={pending} onClick={saveDiaria}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instrução: dialog de edição */}
      <Dialog
        open={editingInstrucao}
        onOpenChange={(o) => {
          if (!o) setEditingInstrucao(false);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Instrução · {row.client_nome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5 py-1">
            <Label htmlFor={`instrucao-${row.client_id}`}>Instrução pra Fast Mídia</Label>
            <Textarea
              id={`instrucao-${row.client_id}`}
              rows={5}
              maxLength={1000}
              placeholder="Ex.: foco em bastidores, evitar promoções, sempre marcar @cliente..."
              value={instrucaoInput}
              onChange={(e) => setInstrucaoInput(e.target.value)}
              disabled={pending}
            />
            <p className="text-[11px] text-muted-foreground">{instrucaoInput.length}/1000</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setEditingInstrucao(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pending} onClick={saveInstrucao}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 6: Type-check + lint dos arquivos**

Run: `npm run typecheck && npx eslint src/components/fast-media/StoriesMonthGrid.tsx`
Expected: PASS, eslint exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/fast-media/StoriesMonthGrid.tsx
git commit -m "feat(fast-media): bloco de instrução + edição no card de stories"
```

---

## Task 6: Página — passar viewerId + canEditInstrucaoManager

**Files:**
- Modify: `src/app/(authed)/fast-media/page.tsx`

- [ ] **Step 1: Constante de cargos que editam instrução**

Logo abaixo da linha `const ROLES_QUE_MARCAM = [...]` (perto do topo do arquivo, junto das outras consts de roles), adicione:

```tsx
const ROLES_QUE_EDITAM_INSTRUCAO = ["adm", "socio", "coordenador"];
```

- [ ] **Step 2: Passar os props ao `StoriesMonthGrid`**

Substitua:

```tsx
        <StoriesMonthGrid rows={storiesRows} canEdit={canEdit} todayIso={todayIso} />
```

por:

```tsx
        <StoriesMonthGrid
          rows={storiesRows}
          canEdit={canEdit}
          todayIso={todayIso}
          viewerId={user.id}
          canEditInstrucaoManager={ROLES_QUE_EDITAM_INSTRUCAO.includes(user.role)}
        />
```

- [ ] **Step 3: Type-check + lint**

Run: `npm run typecheck && npx eslint "src/app/(authed)/fast-media/page.tsx"`
Expected: PASS, eslint exit 0.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(authed)/fast-media/page.tsx"
git commit -m "feat(fast-media): grade recebe viewerId e permissão de editar instrução"
```

---

## Task 7: Verificação final e PR

- [ ] **Step 1: Suíte de verificação**

Run: `npm run typecheck && npx vitest run tests/unit/stories-instrucao-action.test.ts && npx eslint supabase/migrations/20260716000000_clients_stories_instrucao.sql src/lib/painel/stories-queries.ts src/lib/painel/stories-actions.ts src/components/fast-media/StoriesMonthGrid.tsx "src/app/(authed)/fast-media/page.tsx" tests/unit/stories-instrucao-action.test.ts`
Expected: typecheck PASS, testes PASS, eslint exit 0 (a migration .sql não é lintada por JS — remova-a do comando eslint se acusar parser; o importante é os arquivos .ts/.tsx).

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/fast-media-instrucao-cliente
gh pr create --title "feat(fast-media): instrução por cliente na grade de stories" --body "$(cat <<'EOF'
## O que faz
Cada cliente na grade de stories do /fast-media pode ter uma **instrução** (texto) que a Fast Mídia lê ao produzir.
- **Escrevem:** adm/sócio/coordenador ou o assessor do próprio cliente.
- **Leem:** todos que veem a grade (inclui fast_midia).
- Instrução única, fixa do cliente (independe do mês).

## Como funciona
- Nova coluna `clients.stories_instrucao` (nullable).
- SELECT da grade com **fallback resiliente**: se a coluna ainda não existe (gap deploy→migration), refaz sem ela — não esvazia a grade.
- Action via service-role com gate próprio (gestores OU assessor-dono) + validação de unidade. fast_midia NÃO edita.

## ⚠️ Migration manual
`supabase/migrations/20260716000000_clients_stories_instrucao.sql` — aplicar no SQL Editor do Supabase. Graças ao fallback, a ordem merge-vs-SQL não quebra a grade.

## Testes
`tests/unit/stories-instrucao-action.test.ts` (7 testes: manager, assessor-dono, outro-assessor negado, fast_midia negado, limpar, fora-da-unidade, texto>1000). typecheck + eslint limpos.

Spec: docs/superpowers/specs/2026-07-16-fast-media-instrucao-cliente-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: CI verde → merge**

Após o check `test` (ci.yml) ficar verde: `gh pr merge --squash --delete-branch`.
**Depois do merge: aplicar a migration manual no Supabase.** Avisar a Yasmin.

---

## Self-Review

**Spec coverage:**
- Coluna `stories_instrucao` → Task 1. ✓
- SELECT resiliente (gap deploy→migration) → Task 2. ✓
- Action com gate gestores/assessor-dono + unidade, fast_midia negado, limpar com vazio, cap 1000 → Task 3 + testes Task 4. ✓
- Bloco de instrução (leitura pra todos) + edição pra quem pode → Task 5. ✓
- Página passa viewerId + canEditInstrucaoManager → Task 6. ✓
- Migration manual documentada → Task 1 + Task 7. ✓

**Placeholder scan:** nenhum TBD; código completo em cada passo. ✓

**Type consistency:** `StoriesGridRow` ganha `assessor_id`/`stories_instrucao` (Task 2) usados na grade (Task 5); `updateClienteStoriesInstrucaoAction(FormData) → {error?,success?}` (Task 3) usado em Task 4/5; props `viewerId`/`canEditInstrucaoManager` (Task 5) passados em Task 6. `EDIT_INSTRUCAO_ROLES` (action) e `ROLES_QUE_EDITAM_INSTRUCAO` (página) são listas paralelas com os mesmos 3 cargos — coerentes. ✓
