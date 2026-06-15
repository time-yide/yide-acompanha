# Escritório — Excluir DM e Canal (PR-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir excluir uma conversa de DM (hard delete, pra os dois participantes) e excluir um canal fixo (soft delete, só sócio, recuperável) no Escritório Virtual.

**Architecture:** As escritas de `chat_channels` já usam service-role + checagem no código (padrão do `dm-actions.ts`). DM = `DELETE` da linha (cascade apaga mensagens/leituras). Canal fixo = soft delete via colunas `deleted_at`/`deleted_by`, filtradas em todas as listagens, com seção "Canais excluídos" pro sócio restaurar. Permissão fica em helpers puros testáveis.

**Tech Stack:** Next.js (server actions + server components), Supabase (service-role), Zod, Vitest.

**Branch:** criar a partir de `origin/main` (ex.: `feat/escritorio-excluir`).

**Spec:** `docs/superpowers/specs/2026-06-15-escritorio-excluir-e-realtime-design.md` (Partes A e B).

**Regras do projeto a respeitar:**
- Migration **manual** (memória `project_supabase_migrations_manual`) — aplicar antes do merge (aditiva).
- Filtro em coluna nova precisa de **fallback pré-migration** (memória `feedback_calendar_fullselect_fallback`); há um padrão de fallback `unit_id` já em `_listChannelsWithUnreadImpl` pra copiar.
- Service-role + checagem no código é o padrão de escrita de canal aqui (não precisa RLS nova).

---

## File Structure

**Criar:**
- `supabase/migrations/20260615000001_escritorio_canal_soft_delete.sql` — colunas `deleted_at`/`deleted_by` em `chat_channels`.
- `src/lib/escritorio/channel-actions.ts` — `deleteChannelAction`, `restoreChannelAction`, `listDeletedChannels`.
- `tests/unit/escritorio-delete-permissions.test.ts` — testes dos helpers puros de permissão.

**Modificar:**
- `src/lib/escritorio/types.ts` — helpers puros `canDeleteDm`, `canDeleteChannel`.
- `src/lib/escritorio/dm-actions.ts` — `deleteDmAction`.
- `src/lib/escritorio/queries.ts` — filtrar `deleted_at is null` nas listagens de canal.
- `src/components/escritorio/ChannelSidebar.tsx` — botões de excluir (DM + canal p/ sócio) + seção "Canais excluídos".
- `src/app/(authed)/escritorio/[kind]/page.tsx`, `.../escritorio/dm/[id]/page.tsx`, `.../escritorio/page.tsx` — passar `viewerRole` + `deletedChannels` pro sidebar.
- `src/types/database.ts` — `chat_channels.deleted_at/deleted_by`.

---

## Task 1: Migration (soft delete de canal)

**Files:**
- Create: `supabase/migrations/20260615000001_escritorio_canal_soft_delete.sql`

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/20260615000001_escritorio_canal_soft_delete.sql
-- Soft delete de canais fixos do Escritório (DMs continuam hard delete).
alter table public.chat_channels
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id);

create index if not exists idx_chat_channels_deleted_at
  on public.chat_channels (deleted_at) where deleted_at is not null;
```

- [ ] **Step 2: Conferir lendo o arquivo.** Colunas aditivas, retrocompatíveis. NÃO aplicar via MCP/CLI; apply manual.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260615000001_escritorio_canal_soft_delete.sql
git commit -m "feat(escritorio): migration soft delete de canal"
```

---

## Task 2: Helpers puros de permissão (TDD)

**Files:**
- Modify: `src/lib/escritorio/types.ts`
- Test: `tests/unit/escritorio-delete-permissions.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// tests/unit/escritorio-delete-permissions.test.ts
import { describe, it, expect } from "vitest";
import { canDeleteDm, canDeleteChannel, type Channel } from "@/lib/escritorio/types";

function dm(memberIds: string[]): Channel {
  return { id: "c1", kind: "direct", nome: "", descricao: null, ordem: 0, member_ids: memberIds, icon_url: null };
}
function grupo(): Channel {
  return { id: "g1", kind: "geral", nome: "Geral", descricao: null, ordem: 0, member_ids: null, icon_url: null };
}

describe("canDeleteDm", () => {
  it("participante pode", () => {
    expect(canDeleteDm(dm(["a", "b"]), "a", "assessor")).toBe(true);
  });
  it("socio pode mesmo sem ser membro", () => {
    expect(canDeleteDm(dm(["a", "b"]), "x", "socio")).toBe(true);
  });
  it("adm pode mesmo sem ser membro", () => {
    expect(canDeleteDm(dm(["a", "b"]), "x", "adm")).toBe(true);
  });
  it("terceiro nao-membro nao pode", () => {
    expect(canDeleteDm(dm(["a", "b"]), "x", "assessor")).toBe(false);
  });
  it("nao se aplica a canal de grupo", () => {
    expect(canDeleteDm(grupo(), "a", "socio")).toBe(false);
  });
});

describe("canDeleteChannel", () => {
  it("socio pode excluir canal fixo", () => {
    expect(canDeleteChannel("socio", grupo())).toBe(true);
  });
  it("adm NAO pode (so socio)", () => {
    expect(canDeleteChannel("adm", grupo())).toBe(false);
  });
  it("assessor NAO pode", () => {
    expect(canDeleteChannel("assessor", grupo())).toBe(false);
  });
  it("nao se aplica a DM (use canDeleteDm)", () => {
    expect(canDeleteChannel("socio", dm(["a", "b"]))).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/escritorio-delete-permissions.test.ts`
Expected: FAIL (`canDeleteDm`/`canDeleteChannel` não existem).

- [ ] **Step 3: Implementar os helpers em `types.ts`**

Adicione ao fim de `src/lib/escritorio/types.ts`:

```ts
/**
 * Pode apagar o DM (hard delete, pros dois): participante do DM, ou sócio/adm.
 * Só vale pra kind='direct'.
 */
export function canDeleteDm(channel: Channel, userId: string, role: string): boolean {
  if (channel.kind !== "direct" || !channel.member_ids) return false;
  return channel.member_ids.includes(userId) || role === "socio" || role === "adm";
}

/**
 * Pode soft-deletar um canal fixo: só sócio, e nunca DM (DM usa canDeleteDm).
 */
export function canDeleteChannel(role: string, channel: Channel): boolean {
  return role === "socio" && channel.kind !== "direct";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/escritorio-delete-permissions.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**
```bash
git add src/lib/escritorio/types.ts tests/unit/escritorio-delete-permissions.test.ts
git commit -m "feat(escritorio): helpers puros canDeleteDm/canDeleteChannel"
```

---

## Task 3: `deleteDmAction` (hard delete pros dois)

**Files:**
- Modify: `src/lib/escritorio/dm-actions.ts`

- [ ] **Step 1: Ler `dm-actions.ts`** pra confirmar imports (`createServiceRoleClient`, `requireAuth`, `revalidateTag`, `ESCRITORIO_UNREAD_TAG`) e o padrão do `openOrCreateDmAction`.

- [ ] **Step 2: Adicionar a action**

Adicione no topo o import do helper (junto dos imports existentes):
```ts
import { canDeleteDm, type Channel } from "./types";
```
E adicione a função ao fim do arquivo:

```ts
/**
 * Apaga o DM pros dois participantes (hard delete). Mensagens e leituras
 * somem por cascade (on delete cascade no channel_id). Permissão:
 * participante do DM ou sócio/adm.
 */
export async function deleteDmAction(channelId: string): Promise<DmResult> {
  const actor = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: channel } = await sb
    .from("chat_channels")
    .select("id, kind, member_ids")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return { error: "Conversa não encontrada" };

  if (!canDeleteDm(channel as Channel, actor.id, actor.role)) {
    return { error: "Sem permissão" };
  }

  const { error } = await sb.from("chat_channels").delete().eq("id", channelId);
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  return { channelId };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "dm-actions" || echo "no dm-actions type errors"`
Expected: `no dm-actions type errors`

- [ ] **Step 4: Commit**
```bash
git add src/lib/escritorio/dm-actions.ts
git commit -m "feat(escritorio): deleteDmAction (hard delete pros dois)"
```

---

## Task 4: `channel-actions.ts` (soft delete + restore + listagem)

**Files:**
- Create: `src/lib/escritorio/channel-actions.ts`

- [ ] **Step 1: Criar o arquivo**

```ts
// src/lib/escritorio/channel-actions.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { ESCRITORIO_UNREAD_TAG } from "./queries";
import { canDeleteChannel, type Channel } from "./types";

interface ChannelActionResult {
  success?: boolean;
  error?: string;
}

export interface DeletedChannel {
  id: string;
  kind: string;
  nome: string;
  deleted_at: string;
}

/** Soft delete de canal fixo. Só sócio. Nunca DM. */
export async function deleteChannelAction(channelId: string): Promise<ChannelActionResult> {
  const actor = await requireAuth();
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  const { data: channel } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids, icon_url")
    .eq("id", channelId)
    .maybeSingle();
  if (!channel) return { error: "Canal não encontrado" };

  if (!canDeleteChannel(actor.role, channel as Channel)) {
    return { error: "Apenas sócio pode excluir canais" };
  }

  const { error } = await sb
    .from("chat_channels")
    .update({ deleted_at: new Date().toISOString(), deleted_by: actor.id })
    .eq("id", channelId)
    .is("deleted_at", null);
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/escritorio");
  return { success: true };
}

/** Restaura um canal soft-deletado. Só sócio. */
export async function restoreChannelAction(channelId: string): Promise<ChannelActionResult> {
  const actor = await requireAuth();
  if (actor.role !== "socio") return { error: "Apenas sócio pode restaurar canais" };

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { error } = await sb
    .from("chat_channels")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", channelId);
  if (error) return { error: error.message };

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  revalidatePath("/escritorio");
  return { success: true };
}

/** Lista canais soft-deletados (só pro sócio ver/restaurar). */
export async function listDeletedChannels(role: string): Promise<DeletedChannel[]> {
  if (role !== "socio") return [];
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("chat_channels")
    .select("id, kind, nome, deleted_at")
    .neq("kind", "direct")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) {
    // Pré-migration: coluna deleted_at não existe → sem canais excluídos.
    console.warn("[escritorio] listDeletedChannels:", error.message);
    return [];
  }
  return (data ?? []) as DeletedChannel[];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -E "channel-actions" || echo "no channel-actions type errors"`
Expected: `no channel-actions type errors`. (Se `chat_channels.deleted_at` não estiver nos tipos ainda, o `(sb as any)` já evita erro; a Task 8 adiciona o tipo.)

- [ ] **Step 3: Commit**
```bash
git add src/lib/escritorio/channel-actions.ts
git commit -m "feat(escritorio): channel-actions soft delete/restore/list"
```

---

## Task 5: Filtrar `deleted_at is null` nas listagens

**Files:**
- Modify: `src/lib/escritorio/queries.ts`

- [ ] **Step 1: Ler `queries.ts`** (funções `listChannels`, `_listChannelsWithUnreadImpl`, `_getChannelByKindImpl`). Note o padrão de fallback `unit_id` já existente em `_listChannelsWithUnreadImpl` — vamos imitar pra `deleted_at`.

- [ ] **Step 2: `listChannels` exclui deletados**

Em `listChannels`, adicione `.is("deleted_at", null)` na query e um fallback caso a coluna não exista. Substitua o corpo por:

```ts
export async function listChannels(): Promise<Channel[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data, error } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem")
    .is("deleted_at", null)
    .order("ordem", { ascending: true });
  if (error) {
    const msg = String(error.message ?? "");
    // Pré-migration: deleted_at não existe → lista sem o filtro.
    if (msg.includes("deleted_at") || msg.includes("schema cache")) {
      const fb = await sb
        .from("chat_channels")
        .select("id, kind, nome, descricao, ordem")
        .order("ordem", { ascending: true });
      return (fb.data ?? []) as Channel[];
    }
    throw error;
  }
  return (data ?? []) as Channel[];
}
```

- [ ] **Step 3: `_listChannelsWithUnreadImpl` exclui deletados**

Na query `roleChannelsQ`, adicione `.is("deleted_at", null)`. Localize:
```ts
  let roleChannelsQ: any = sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids, icon_url, unit_id")
    .neq("kind", "direct")
    .order("ordem", { ascending: true });
```
e adicione `.is("deleted_at", null)` logo após `.neq("kind", "direct")`. Faça o MESMO na query de fallback (a que roda quando `unit_id` não existe) — adicione `.is("deleted_at", null)` após o `.neq("kind", "direct")` dela. E estenda a condição do fallback existente pra também cobrir `deleted_at`: troque
```ts
    if (msg.includes("unit_id") || msg.includes("schema cache")) {
```
por
```ts
    if (msg.includes("unit_id") || msg.includes("deleted_at") || msg.includes("schema cache")) {
```
(DMs continuam sem filtro de `deleted_at` — são hard delete, então não existem soft-deletados.)

- [ ] **Step 4: `_getChannelByKindImpl` ignora canal deletado**

Em `_getChannelByKindImpl`, adicione `.is("deleted_at", null)` na query principal (a que filtra por `kind`), logo após `.eq("kind", kind)`. Se houver uma query de fallback dentro dessa função (sem `unit_id`), adicione `.is("deleted_at", null)` nela também. Assim um canal soft-deletado vira `null` → a page faz `notFound()` (comportamento já existente).

- [ ] **Step 5: Type-check + testes existentes**

Run: `npx tsc --noEmit 2>&1 | grep -E "escritorio/queries" || echo "no queries type errors"`
Expected: `no queries type errors`

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/escritorio-delete-permissions.test.ts`
Expected: PASS (não quebrou).

- [ ] **Step 6: Commit**
```bash
git add src/lib/escritorio/queries.ts
git commit -m "feat(escritorio): listagens de canal ignoram soft-deletados"
```

---

## Task 6: UI — botões de excluir + seção "Canais excluídos"

**Files:**
- Modify: `src/components/escritorio/ChannelSidebar.tsx`

- [ ] **Step 1: Ler `ChannelSidebar.tsx`** (já mapeado). Cada linha é um `<Link>`. Vamos: (a) envolver cada linha num container `relative group` com um botão de ação sobreposto (não dentro do `<Link>`), e (b) adicionar a seção de excluídos no rodapé.

- [ ] **Step 2: Estender Props + imports**

No topo, adicione imports:
```ts
import { useTransition } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import { deleteDmAction } from "@/lib/escritorio/dm-actions";
import { deleteChannelAction, restoreChannelAction, type DeletedChannel } from "@/lib/escritorio/channel-actions";
import { useRouter } from "next/navigation";
```
(Mantenha `useState` já importado; adicione `useTransition` ao import existente de `react`.)

Estenda `interface Props` com:
```ts
  viewerRole: string;
  deletedChannels: DeletedChannel[];
```

- [ ] **Step 3: Ação de excluir por linha**

Dentro do componente, adicione:
```ts
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDeleteDm(channelId: string, nome: string) {
    if (!confirm(`Apagar a conversa com ${nome} pra vocês dois? Não dá pra desfazer.`)) return;
    startTransition(async () => {
      const r = await deleteDmAction(channelId);
      if (r?.error) { alert(r.error); return; }
      if (currentChannelId === channelId) router.push("/escritorio");
      else router.refresh();
    });
  }

  function onDeleteChannel(channelId: string, kind: string, nome: string) {
    if (!confirm(`Excluir o canal ${nome}? Dá pra restaurar depois.`)) return;
    startTransition(async () => {
      const r = await deleteChannelAction(channelId);
      if (r?.error) { alert(r.error); return; }
      if (currentKind === kind) router.push("/escritorio");
      else router.refresh();
    });
  }

  function onRestore(channelId: string) {
    startTransition(async () => {
      const r = await restoreChannelAction(channelId);
      if (r?.error) { alert(r.error); return; }
      router.refresh();
    });
  }
```

- [ ] **Step 4: Botão de excluir sobreposto em cada linha**

Envolva cada linha numa `div relative group` e ponha o `<Link>` dentro, com um botão de lixeira absoluto à direita (aparece no hover). Substitua o `return (<Link ...> ... </Link>)` de cada item por:

```tsx
            const canDel = isDm
              ? (c.dm_other != null || viewerRole === "socio" || viewerRole === "adm")
              : viewerRole === "socio";

            return (
              <div key={c.id} className="group relative">
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 transition-colors",
                    active ? "bg-primary/10" : "hover:bg-muted/50",
                  )}
                >
                  {/* ...conteúdo da linha igual ao atual (Avatar + textos + badge)... */}
                </Link>
                {canDel && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      isDm
                        ? onDeleteDm(c.id, displayName)
                        : onDeleteChannel(c.id, c.kind, c.nome)
                    }
                    className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
                    aria-label={isDm ? "Excluir conversa" : "Excluir canal"}
                    title={isDm ? "Excluir conversa" : "Excluir canal"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
```
(Mantenha exatamente o conteúdo interno do `<Link>` que já existe — Avatar, nome, preview, badge de unread. Só mova-o pra dentro do novo wrapper e adicione o botão.)

- [ ] **Step 5: Seção "Canais excluídos" (só sócio)**

Antes do `<NovoDmModal ... />` (no fim do `<aside>`), adicione:

```tsx
      {viewerRole === "socio" && deletedChannels.length > 0 && (
        <div className="border-t px-2 py-2">
          <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Canais excluídos
          </p>
          <ul className="space-y-0.5">
            {deletedChannels.map((dc) => (
              <li key={dc.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm">
                <span className="truncate text-muted-foreground">{dc.nome}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onRestore(dc.id)}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-primary/10"
                  title="Restaurar canal"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 6: Type-check + lint**

Run: `npx tsc --noEmit 2>&1 | grep -E "ChannelSidebar" || echo "no sidebar type errors"`
Expected: `no sidebar type errors` exceto erros nos call-sites das pages que ainda não passam `viewerRole`/`deletedChannels` (Task 7).

Run: `npx eslint src/components/escritorio/ChannelSidebar.tsx`
Expected: sem erros.

- [ ] **Step 7: Commit**
```bash
git add src/components/escritorio/ChannelSidebar.tsx
git commit -m "feat(escritorio): botoes de excluir DM/canal + secao canais excluidos"
```

---

## Task 7: Passar dados pras pages do escritório

**Files:**
- Modify: `src/app/(authed)/escritorio/[kind]/page.tsx`
- Modify: `src/app/(authed)/escritorio/dm/[id]/page.tsx`
- Modify: `src/app/(authed)/escritorio/page.tsx`

- [ ] **Step 1: Ler as 3 pages** pra ver como cada uma renderiza `<ChannelSidebar ... />` hoje (props passadas) e de onde vem `user`. Cada `<ChannelSidebar>` precisa receber os 2 props novos.

- [ ] **Step 2: Em CADA page que renderiza `<ChannelSidebar>`**, importe e busque os canais excluídos e passe os props:

Adicione o import:
```ts
import { listDeletedChannels } from "@/lib/escritorio/channel-actions";
```
Onde a page já busca dados (ex.: dentro do `Promise.all` existente, ou numa linha própria), adicione:
```ts
  const deletedChannels = await listDeletedChannels(user.role);
```
E no JSX do `<ChannelSidebar ... />`, adicione os props:
```tsx
          viewerRole={user.role}
          deletedChannels={deletedChannels}
```
(Mantenha os props já existentes — `channels`, `currentKind`, `currentChannelId`, `pessoas`, `viewerId`.)

> Se alguma das 3 pages NÃO renderizar o `<ChannelSidebar>` diretamente (ex.: a `escritorio/page.tsx` raiz só redireciona), pule essa e ajuste só as que renderizam. Confirme lendo cada uma.

- [ ] **Step 3: Type-check geral do escritório**

Run: `npx tsc --noEmit 2>&1 | grep -E "escritorio" || echo "no escritorio type errors"`
Expected: `no escritorio type errors`

- [ ] **Step 4: Commit**
```bash
git add "src/app/(authed)/escritorio"
git commit -m "feat(escritorio): pages passam viewerRole + canais excluidos pro sidebar"
```

---

## Task 8: Tipos do banco + verificação final

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Adicionar `deleted_at`/`deleted_by` ao tipo `chat_channels`**

Em `src/types/database.ts`, no bloco `chat_channels:` (procure `      chat_channels: {`), adicione em `Row`, `Insert` e `Update` (ordem alfabética, perto de `created_at`):
- `Row`: `deleted_at: string | null` e `deleted_by: string | null`
- `Insert`: `deleted_at?: string | null` e `deleted_by?: string | null`
- `Update`: `deleted_at?: string | null` e `deleted_by?: string | null`

Se o bloco `Relationships` listar FKs, adicione (seguindo o formato dos itens existentes):
```ts
          {
            foreignKeyName: "chat_channels_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
```

- [ ] **Step 2: Verificação final (tsc + lint + testes)**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a escritório (erros pré-existentes de deps opcionais podem aparecer; nenhum em arquivos `escritorio`).

Run: `npx eslint src/lib/escritorio src/components/escritorio "src/app/(authed)/escritorio" 2>&1 | tail -20 || echo "lint ok"`
Expected: sem erros.

Run: `npx vitest run --exclude '**/.claude/**' tests/unit/escritorio-delete-permissions.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add src/types/database.ts
git commit -m "feat(escritorio): tipos do banco para chat_channels.deleted_at/by"
```

---

## Notas de deploy

- Migration `20260615000001` **manual**, aditiva — aplicar antes do merge (fallbacks cobrem a janela).
- `chat_channels` escreve via service-role + checagem no código; sem RLS nova.
- Regenerar/atualizar tipos no mesmo PR (Task 8).
- Branch a partir de `origin/main`.

## Self-Review (cobertura do spec — Partes A e B)

- DM hard delete pros dois, participante/sócio/adm → Task 2 (`canDeleteDm`) + Task 3 (`deleteDmAction`) + Task 6 (UI DM).
- Canal soft delete, só sócio, recuperável → Task 1 (migration) + Task 2 (`canDeleteChannel`) + Task 4 (delete/restore/list) + Task 5 (filtra deletados) + Task 6 (UI canal + seção excluídos).
- Filtro `deleted_at is null` em todas as listagens + fallback pré-migration → Task 5.
- Redirect ao excluir o canal/DM aberto → Task 6 (onDelete*).
- Tipos do banco → Task 8.
- Tests de permissão → Task 2.
