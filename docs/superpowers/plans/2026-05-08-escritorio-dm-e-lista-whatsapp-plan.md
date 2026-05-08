# Escritório virtual DM + lista WhatsApp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as 2 mudanças do spec [2026-05-08-escritorio-dm-e-lista-whatsapp-design](../specs/2026-05-08-escritorio-dm-e-lista-whatsapp-design.md): sidebar com info rica estilo WhatsApp + DM 1-on-1 entre quaisquer 2 profiles ativos.

**Architecture:** Reutiliza a mesma tabela `chat_channels` adicionando enum value `direct` + coluna `member_ids UUID[]`. Unique index garante 1 DM por par. Nova rota `/escritorio/dm/[id]`. `canAccessChannel` ganha overload pra DM (member_ids based). `listChannelsWithUnread` retorna last_message + dm_other. `dispatchChatNotification` ganha branch pra DMs.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres), Zod, Tailwind, shadcn/ui Dialog.

**PR strategy:** 3 PRs sequenciais:
- **PR G:** Foundation (migrations + helpers + types do tipo Channel)
- **PR H:** Backend (queries enriquecidas + dm-actions + dispatch branch)
- **PR I:** UI (sidebar refactor + NovoDmModal + rota /dm/[id])

**Nota importante sobre types:** `chat_channels` e `channel_kind` NÃO estão em `src/types/database.ts` (são acessados via `(supabase as any).from("chat_channels")`). Por isso o plano não inclui patching desse arquivo pra DM — segue o padrão existente.

---

## PR G — Foundation: migrations + helpers

### Task G.1 — Migration A: enum value `direct`

**Files:**
- Create: `supabase/migrations/20260508140000_add_channel_kind_direct.sql`

- [ ] **Step 1: Criar migration**

```sql
-- Adiciona 'direct' ao enum channel_kind pra suportar DMs entre 2 users.
-- ALTER TYPE ... ADD VALUE precisa rodar isolada (regra Postgres).

ALTER TYPE channel_kind ADD VALUE IF NOT EXISTS 'direct';
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/20260508140000_add_channel_kind_direct.sql
git commit -m "feat(escritorio): adiciona channel_kind 'direct' pro DM 1-on-1"
```

### Task G.2 — Migration B: coluna `member_ids` + indexes

**Files:**
- Create: `supabase/migrations/20260508140100_chat_dm_member_ids.sql`

- [ ] **Step 1: Criar migration**

```sql
-- member_ids: array dos 2 user_ids participantes do DM. NULL pra canais
-- de grupo (kind != 'direct').
ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS member_ids UUID[];

-- Unique index parcial: garante 1 DM por par. LEAST/GREATEST normalizam
-- a ordem do par pra que [A,B] e [B,A] sejam tratados como o mesmo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_dm_unique
  ON chat_channels (
    LEAST((member_ids)[1], (member_ids)[2]),
    GREATEST((member_ids)[1], (member_ids)[2])
  )
  WHERE kind = 'direct';

-- GIN index pra listar DMs onde um user_id está em member_ids.
CREATE INDEX IF NOT EXISTS idx_chat_channels_member_ids_gin
  ON chat_channels USING GIN (member_ids)
  WHERE kind = 'direct';
```

- [ ] **Step 2: Commit**

```
git add supabase/migrations/20260508140100_chat_dm_member_ids.sql
git commit -m "feat(escritorio): coluna member_ids + unique/gin indexes pro DM"
```

### Task G.3 — Aplicar migrations no Supabase

Controller passa o SQL pra usuária colar no Dashboard SQL Editor (mesmo fluxo dos PRs anteriores).

Bloco 1 (migration A — query separada):
```sql
ALTER TYPE channel_kind ADD VALUE IF NOT EXISTS 'direct';
```

Bloco 2 (migration B — query separada após bloco 1 commitado):
```sql
ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS member_ids UUID[];

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_dm_unique
  ON chat_channels (
    LEAST((member_ids)[1], (member_ids)[2]),
    GREATEST((member_ids)[1], (member_ids)[2])
  )
  WHERE kind = 'direct';

CREATE INDEX IF NOT EXISTS idx_chat_channels_member_ids_gin
  ON chat_channels USING GIN (member_ids)
  WHERE kind = 'direct';
```

### Task G.4 — Atualizar `src/lib/escritorio/types.ts`

**Files:**
- Modify: `src/lib/escritorio/types.ts`

- [ ] **Step 1: Adicionar `direct` ao tipo `ChannelKind`**

Localizar:
```ts
export type ChannelKind =
  | "geral"
  | "assessores_coordenadores"
  | "coordenadores_estrategico"
  | "audiovisual_geral"
  | "designers"
  | "comercial"
  | "administrativo";
```

Adicionar `| "direct"` no final:
```ts
export type ChannelKind =
  | "geral"
  | "assessores_coordenadores"
  | "coordenadores_estrategico"
  | "audiovisual_geral"
  | "designers"
  | "comercial"
  | "administrativo"
  | "direct";
```

- [ ] **Step 2: Estender interface `Channel` com `member_ids`**

Localizar `export interface Channel { ... }` e adicionar:
```ts
  /** Populado só quando kind === 'direct'. Array com os 2 user_ids do DM. */
  member_ids: string[] | null;
```

- [ ] **Step 3: Atualizar `CHANNEL_KIND_TO_ROLES` pra incluir 'direct'**

Localizar `export const CHANNEL_KIND_TO_ROLES: Record<ChannelKind, readonly string[]> = { ... }` e adicionar:
```ts
  // 'direct' não usa role-based access — controle é via member_ids
  // (vide canAccessDmChannel). Mantemos vazio aqui pra satisfazer o
  // Record<ChannelKind, ...>.
  direct: [],
```

- [ ] **Step 4: Adicionar helper `dmOtherMemberId`**

No final do arquivo:
```ts
/**
 * Pra um DM (kind='direct'), retorna o ID do OUTRO membro a partir
 * do viewer. Se viewer é o único em member_ids (autodm — bloqueado
 * mas defensivo), retorna o próprio.
 */
export function dmOtherMemberId(channel: Channel, viewerId: string): string {
  if (channel.kind !== "direct" || !channel.member_ids) return viewerId;
  return channel.member_ids.find((id) => id !== viewerId) ?? viewerId;
}

/**
 * Permissão pra acessar um DM channel. User precisa estar em member_ids.
 * Não usa role — DM é per-user.
 */
export function canAccessDmChannel(channel: Channel, userId: string): boolean {
  if (channel.kind !== "direct" || !channel.member_ids) return false;
  return channel.member_ids.includes(userId);
}
```

- [ ] **Step 5: Typecheck**

Run: `npx --no-install tsc --noEmit`
Expected: limpo (filtra `web-push` se aparecer).

- [ ] **Step 6: Commit**

```
git add src/lib/escritorio/types.ts
git commit -m "feat(escritorio): ChannelKind ganha 'direct' + member_ids + helpers dmOtherMemberId/canAccessDmChannel"
```

### Task G.5 — Push branch

- [ ] **Step 1: Push**

```
git push -u origin feat/escritorio-dm-foundation
```

Não abrir PR — controller revisa e abre depois de aplicar migrations.

---

## PR H — Backend: queries + DM action + dispatch branch

### Task H.1 — Estender `listChannelsWithUnread` com last_message + dm_other

**Files:**
- Modify: `src/lib/escritorio/queries.ts`
- Modify: `src/lib/escritorio/types.ts` (extender ChannelWithUnread)

- [ ] **Step 1: Estender o type `ChannelWithUnread`**

Em `src/lib/escritorio/types.ts`, localizar `export interface ChannelWithUnread extends Channel { ... }` e adicionar:

```ts
export interface ChannelLastMessagePreview {
  autor_id: string;
  autor_nome: string;
  conteudo: string;
  created_at: string;
}

export interface ChannelDmOther {
  id: string;
  nome: string;
  avatar_url: string | null;
}

export interface ChannelWithUnread extends Channel {
  unread_count: number;
  // NOVOS:
  last_message_at: string | null;
  last_message: ChannelLastMessagePreview | null;
  /** Populado só pra DM. Outro membro (não o viewer). */
  dm_other: ChannelDmOther | null;
}
```

(Se o `ChannelWithUnread` já tinha `unread_count`, mantém — só adiciona os 3 novos campos.)

- [ ] **Step 2: Atualizar `_listChannelsWithUnreadImpl` em queries.ts**

Localizar a função `_listChannelsWithUnreadImpl` e estender:

```ts
async function _listChannelsWithUnreadImpl(userId: string, userRole: string): Promise<ChannelWithUnread[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // 1. Lista todos os channels do tipo: role-based acessíveis OU DMs do user
  // Role-based:
  const { data: roleChannels } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids")
    .neq("kind", "direct")
    .order("ordem", { ascending: true });

  const accessibleRoleChannels = ((roleChannels ?? []) as Channel[])
    .filter((c) => canAccessChannel(userRole, c.kind));

  // DMs onde o user está em member_ids:
  const { data: dmChannels } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids")
    .eq("kind", "direct")
    .contains("member_ids", [userId]);

  const allChannels = [...accessibleRoleChannels, ...((dmChannels ?? []) as Channel[])];
  if (allChannels.length === 0) return [];

  const channelIds = allChannels.map((c) => c.id);

  // 2. Reads (unread_count)
  const { data: readsData } = await sb
    .from("chat_reads")
    .select("channel_id, last_read_at")
    .eq("user_id", userId)
    .in("channel_id", channelIds);
  const readMap = new Map<string, string>();
  ((readsData ?? []) as Array<{ channel_id: string; last_read_at: string }>)
    .forEach((r) => readMap.set(r.channel_id, r.last_read_at));

  // 3. Última mensagem por canal — busca todas e agrupa em memória.
  // Pra escala maior, virar lateral join. Por enquanto (até ~50 canais) ok.
  const { data: lastMsgs } = await sb
    .from("chat_messages")
    .select("id, channel_id, autor_id, conteudo, created_at, autor:profiles!autor_id(nome)")
    .in("channel_id", channelIds)
    .order("created_at", { ascending: false })
    .limit(channelIds.length * 5); // safety: mais que necessário, fitra abaixo
  type LastMsgRow = { id: string; channel_id: string; autor_id: string; conteudo: string; created_at: string; autor: { nome: string } | null };
  const firstByChannel = new Map<string, LastMsgRow>();
  ((lastMsgs ?? []) as LastMsgRow[]).forEach((m) => {
    if (!firstByChannel.has(m.channel_id)) firstByChannel.set(m.channel_id, m);
  });

  // 4. Unread por canal (count msgs > last_read_at, exceto autor)
  // Mantém a contagem que já existe; pra simplicidade re-implementamos:
  const unreadByChannel = new Map<string, number>();
  for (const cid of channelIds) {
    const lastRead = readMap.get(cid);
    if (!lastRead) {
      const last = firstByChannel.get(cid);
      // Sem last_read e tem mensagem — conta como 1+ (aproximação ok)
      unreadByChannel.set(cid, last ? 1 : 0);
      continue;
    }
    const { count } = await sb
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", cid)
      .gt("created_at", lastRead)
      .neq("autor_id", userId);
    unreadByChannel.set(cid, count ?? 0);
  }

  // 5. Pra DMs, busca nome+avatar do "outro" user
  const dmIds = allChannels
    .filter((c) => c.kind === "direct")
    .map((c) => {
      const other = (c.member_ids ?? []).find((id) => id !== userId);
      return other ?? null;
    })
    .filter((id): id is string => id !== null);

  let otherProfiles = new Map<string, { id: string; nome: string; avatar_url: string | null }>();
  if (dmIds.length > 0) {
    const { data: profs } = await sb
      .from("profiles")
      .select("id, nome, avatar_url")
      .in("id", dmIds);
    ((profs ?? []) as Array<{ id: string; nome: string; avatar_url: string | null }>)
      .forEach((p) => otherProfiles.set(p.id, p));
  }

  // 6. Monta ChannelWithUnread[]
  const out: ChannelWithUnread[] = allChannels.map((c) => {
    const last = firstByChannel.get(c.id) ?? null;
    let dmOther: ChannelDmOther | null = null;
    if (c.kind === "direct") {
      const otherId = (c.member_ids ?? []).find((id) => id !== userId);
      if (otherId) {
        const p = otherProfiles.get(otherId);
        if (p) dmOther = { id: p.id, nome: p.nome, avatar_url: p.avatar_url };
        else dmOther = { id: otherId, nome: "Usuário removido", avatar_url: null };
      }
    }
    return {
      ...c,
      unread_count: unreadByChannel.get(c.id) ?? 0,
      last_message_at: last?.created_at ?? null,
      last_message: last
        ? { autor_id: last.autor_id, autor_nome: last.autor?.nome ?? "—", conteudo: last.conteudo, created_at: last.created_at }
        : null,
      dm_other: dmOther,
    };
  });

  // 7. Ordena por last_message_at DESC, com null no final por ordem original
  out.sort((a, b) => {
    if (a.last_message_at && b.last_message_at) return a.last_message_at < b.last_message_at ? 1 : -1;
    if (a.last_message_at) return -1;
    if (b.last_message_at) return 1;
    return a.ordem - b.ordem;
  });

  return out;
}
```

- [ ] **Step 3: Atualizar imports no topo de `queries.ts`**

Garantir que `ChannelDmOther` está importado de `./types`:

```ts
import {
  canAccessChannel,
  type Channel,
  type ChannelKind,
  type ChannelWithUnread,
  type ChannelDmOther,
  type ChatMessage,
} from "./types";
```

- [ ] **Step 4: Typecheck + lint**

```
npx --no-install tsc --noEmit
npx --no-install eslint src/lib/escritorio/queries.ts src/lib/escritorio/types.ts
```
Expected: limpos.

- [ ] **Step 5: Commit**

```
git add src/lib/escritorio/queries.ts src/lib/escritorio/types.ts
git commit -m "feat(escritorio): listChannelsWithUnread retorna last_message + dm_other"
```

### Task H.2 — `dm-actions.ts`: openOrCreateDmAction

**Files:**
- Create: `src/lib/escritorio/dm-actions.ts`

- [ ] **Step 1: Criar arquivo**

```ts
"use server";

import { revalidateTag } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireAuth } from "@/lib/auth/session";
import { ESCRITORIO_UNREAD_TAG } from "./queries";

interface DmResult {
  channelId?: string;
  error?: string;
}

/**
 * Cria ou retorna o DM channel entre actor e targetUserId. Idempotente:
 * se já existe DM entre os 2, retorna o ID. Caso contrário cria.
 *
 * Permissão: any-to-any. Mas valida que target é profile ativo (defense
 * in depth).
 *
 * Race: 2 abas abrindo DM ao mesmo tempo. Unique index garante que só
 * 1 vence — se a segunda fal a no INSERT por conflito, busca o existente.
 */
export async function openOrCreateDmAction(targetUserId: string): Promise<DmResult> {
  const actor = await requireAuth();
  if (actor.id === targetUserId) {
    return { error: "Você não pode iniciar conversa com você mesmo" };
  }

  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Valida target ativo
  const { data: target } = await sb
    .from("profiles")
    .select("id, ativo")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!target || !target.ativo) {
    return { error: "Usuário não encontrado ou inativo" };
  }

  // Tenta achar DM existente — usa contains pros 2 IDs.
  const { data: existing } = await sb
    .from("chat_channels")
    .select("id")
    .eq("kind", "direct")
    .contains("member_ids", [actor.id])
    .contains("member_ids", [targetUserId])
    .maybeSingle();
  if (existing) return { channelId: existing.id };

  // Cria
  const { data: created, error } = await sb
    .from("chat_channels")
    .insert({
      kind: "direct",
      nome: "",
      descricao: null,
      ordem: 9999,
      member_ids: [actor.id, targetUserId],
    })
    .select("id")
    .single();

  if (error) {
    // Pode ser violação do unique index (race). Re-tenta buscar.
    const { data: retryExisting } = await sb
      .from("chat_channels")
      .select("id")
      .eq("kind", "direct")
      .contains("member_ids", [actor.id])
      .contains("member_ids", [targetUserId])
      .maybeSingle();
    if (retryExisting) return { channelId: retryExisting.id };
    return { error: error.message };
  }

  revalidateTag(ESCRITORIO_UNREAD_TAG, "default");
  return { channelId: created.id };
}
```

- [ ] **Step 2: Verificar export de `ESCRITORIO_UNREAD_TAG`**

Run:
```
grep -n "ESCRITORIO_UNREAD_TAG" src/lib/escritorio/queries.ts
```
Confirma que existe `export const ESCRITORIO_UNREAD_TAG = "..."`. Se não existir, adicionar (provavelmente já existe — vi antes).

- [ ] **Step 3: Typecheck**

```
npx --no-install tsc --noEmit
```

- [ ] **Step 4: Commit**

```
git add src/lib/escritorio/dm-actions.ts
git commit -m "feat(escritorio): openOrCreateDmAction (idempotente, retry no conflict)"
```

### Task H.3 — `dispatch-chat.ts`: branch pra DM

**Files:**
- Modify: `src/lib/notificacoes/dispatch-chat.ts`

- [ ] **Step 1: Localizar a função `dispatchChatNotification`**

Hoje resolve destinatários assim:
```ts
const recipientIds = profiles
  .filter((p) => p.id !== args.authorId)
  .filter((p) => canAccessChannel(p.role, args.channelKind))
  .map((p) => p.id);
```

- [ ] **Step 2: Adicionar branch pra DM antes desse filtro**

Substituir o trecho de resolução de destinatários por:

```ts
let recipientIds: string[];
if (args.channelKind === "direct") {
  // Pra DM: destinatários = member_ids exceto o autor.
  // Args precisam carregar member_ids — adicionado abaixo na assinatura.
  recipientIds = (args.memberIds ?? []).filter((id) => id !== args.authorId);
} else {
  // Role-based (lógica existente)
  const { data: profilesData } = await sb
    .from("profiles")
    .select("id, role, ativo")
    .eq("ativo", true);
  const profiles = (profilesData ?? []) as Array<{ id: string; role: string }>;
  recipientIds = profiles
    .filter((p) => p.id !== args.authorId)
    .filter((p) => canAccessChannel(p.role, args.channelKind))
    .map((p) => p.id);
}
```

- [ ] **Step 3: Estender a interface `DispatchArgs`**

Adicionar campo opcional:
```ts
interface DispatchArgs {
  messageId: string;
  channelId: string;
  authorId: string;
  authorName: string;
  channelKind: ChannelKind;
  channelName: string;
  conteudo: string;
  mentionedUserIds: string[];
  /** Pra DM: member_ids do channel. Ignorado pra outros kinds. */
  memberIds?: string[];
}
```

- [ ] **Step 4: Atualizar callers em `sendChatMessageAction`**

Em `src/lib/escritorio/actions.ts`, localizar a chamada `dispatchChatNotification({ ... })`. Estender com `memberIds`:

```ts
await dispatchChatNotification({
  messageId: created.id,
  channelId: parsed.data.channel_id,
  authorId: actor.id,
  authorName: actor.nome,
  channelKind: channel.kind as ChannelKind,
  channelName: channel.nome,
  conteudo: parsed.data.conteudo,
  mentionedUserIds: parsed.data.mentioned_user_ids.filter((id) => id !== actor.id),
  memberIds: channel.member_ids ?? undefined,
});
```

(O channel já é selecionado mais cedo na action — se ele não tem `member_ids` no SELECT, adicionar:)

```ts
const { data: channel } = await sb
  .from("chat_channels")
  .select("id, kind, nome, member_ids")  // adicionou member_ids
  .eq("id", parsed.data.channel_id)
  .maybeSingle();
```

- [ ] **Step 5: Typecheck**

```
npx --no-install tsc --noEmit
```

- [ ] **Step 6: Commit**

```
git add src/lib/notificacoes/dispatch-chat.ts src/lib/escritorio/actions.ts
git commit -m "feat(notif): dispatch-chat tem branch pra DM (recipients=member_ids except author)"
```

### Task H.4 — Push branch

- [ ] **Step 1: Push**

```
git push -u origin feat/escritorio-dm-backend
```

Não abrir PR — controller faz a review.

---

## PR I — UI: sidebar WhatsApp + modal + rota DM

Depende de PR G + H mergeados.

### Task I.1 — Helper `formatRelative` no sidebar

**Files:**
- Create: `src/lib/escritorio/format-relative.ts`

- [ ] **Step 1: Criar helper**

```ts
/**
 * Formata uma data ISO em estilo "lista de chats do WhatsApp":
 * - <1 min: "agora"
 * - mesmo dia: "10:30"
 * - ontem: "ontem"
 * - mais antigo: "12/05" (ou "12/05/24" se ano diferente)
 */
export function formatRelativeChatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = diffMs / 60_000;
  if (diffMin < 1) return "agora";

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return "ontem";

  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
```

- [ ] **Step 2: Commit**

```
git add src/lib/escritorio/format-relative.ts
git commit -m "feat(escritorio): helper formatRelativeChatTime (estilo WhatsApp)"
```

### Task I.2 — Componente `NovoDmModal`

**Files:**
- Create: `src/components/escritorio/NovoDmModal.tsx`

- [ ] **Step 1: Criar arquivo**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { openOrCreateDmAction } from "@/lib/escritorio/dm-actions";

function initials(nome: string | undefined | null): string {
  if (!nome) return "—";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Pessoa {
  id: string;
  nome: string;
  role: string;
  avatar_url: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pessoas: Pessoa[];
}

/**
 * Modal "Nova conversa": lista pessoas ativas com search. Click cria
 * (ou abre, se já existe) DM com a pessoa e navega pra ela.
 */
export function NovoDmModal({ open, onOpenChange, pessoas }: Props) {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pessoas;
    return pessoas.filter((p) => p.nome.toLowerCase().includes(q));
  }, [pessoas, search]);

  async function handlePick(targetId: string) {
    setPending(targetId);
    try {
      const r = await openOrCreateDmAction(targetId);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      onOpenChange(false);
      setSearch("");
      router.push(`/escritorio/dm/${r.channelId}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Buscar pessoa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="max-h-[60vh] overflow-y-auto -mx-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ninguém encontrado.
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePick(p.id)}
                disabled={pending === p.id}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted disabled:opacity-60"
              >
                <Avatar className="h-9 w-9">
                  {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.nome} /> : null}
                  <AvatarFallback className="text-xs">{initials(p.nome)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.nome}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {p.role.replaceAll("_", " ")}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar componentes shadcn**

```
ls src/components/ui/dialog.tsx src/components/ui/input.tsx src/components/ui/avatar.tsx
```
Expected: todos existem (vimos antes nesta sessão).

- [ ] **Step 3: Lint**

```
npx --no-install eslint src/components/escritorio/NovoDmModal.tsx
```

- [ ] **Step 4: Commit**

```
git add src/components/escritorio/NovoDmModal.tsx
git commit -m "feat(escritorio): NovoDmModal — search + click pra criar/abrir DM"
```

### Task I.3 — Refactor `ChannelSidebar` pro layout WhatsApp

**Files:**
- Modify: `src/components/escritorio/ChannelSidebar.tsx`

- [ ] **Step 1: Substituir o componente inteiro**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Hash, MessageSquarePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeChatTime } from "@/lib/escritorio/format-relative";
import { NovoDmModal } from "./NovoDmModal";
import type { ChannelWithUnread } from "@/lib/escritorio/types";

function initials(nome: string | undefined | null): string {
  if (!nome) return "—";
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Pessoa {
  id: string;
  nome: string;
  role: string;
  avatar_url: string | null;
}

interface Props {
  channels: ChannelWithUnread[];
  /** Pro highlight de canais não-DM (kind). null se a página ativa é um DM. */
  currentKind: string | null;
  /** Pro highlight do DM ativo (channel id). null se a página ativa é um canal de grupo. */
  currentChannelId?: string | null;
  /** Lista de profiles ativos pra abrir nova DM (inclui filtro do próprio user fora). */
  pessoas: Pessoa[];
  viewerId: string;
}

export function ChannelSidebar({ channels, currentKind, currentChannelId, pessoas, viewerId }: Props) {
  const [novoOpen, setNovoOpen] = useState(false);

  return (
    <aside className="flex w-full flex-col rounded-xl border bg-card md:w-72">
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Conversas
        </h2>
        <button
          type="button"
          onClick={() => setNovoOpen(true)}
          className="rounded-md p-1.5 text-primary hover:bg-primary/10"
          aria-label="Nova conversa"
          title="Nova conversa"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {channels.map((c) => {
          const isDm = c.kind === "direct";
          const displayName = isDm ? (c.dm_other?.nome ?? "Usuário removido") : c.nome;
          const avatarSrc = isDm ? c.dm_other?.avatar_url : null;
          const active = isDm
            ? c.id === currentChannelId
            : c.kind === currentKind;
          const href = isDm ? `/escritorio/dm/${c.id}` : `/escritorio/${c.kind}`;

          const preview = c.last_message;
          const previewText = preview
            ? `${preview.autor_id === viewerId ? "Você: " : ""}${preview.conteudo}`
            : null;

          return (
            <Link
              key={c.id}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 transition-colors",
                active ? "bg-primary/10" : "hover:bg-muted/50",
              )}
            >
              <Avatar className="h-10 w-10 flex-shrink-0">
                {avatarSrc ? <AvatarImage src={avatarSrc} alt={displayName} /> : null}
                <AvatarFallback className="text-xs">
                  {isDm ? initials(displayName) : <Hash className="h-4 w-4 text-muted-foreground" />}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm font-medium", active && "text-primary")}>
                    {displayName}
                  </span>
                  {c.last_message_at && (
                    <span className="flex-shrink-0 text-[11px] text-muted-foreground">
                      {formatRelativeChatTime(c.last_message_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {previewText ?? <span className="italic">sem mensagens</span>}
                  </p>
                  {c.unread_count > 0 && (
                    <span className="inline-flex h-5 min-w-[1.25rem] flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                      {c.unread_count > 99 ? "99+" : c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
        {channels.length === 0 && (
          <p className="px-3 py-6 text-center text-sm italic text-muted-foreground">
            Sem conversas ainda. Inicia uma com o botão acima.
          </p>
        )}
      </div>

      <NovoDmModal open={novoOpen} onOpenChange={setNovoOpen} pessoas={pessoas} />
    </aside>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

```
npx --no-install tsc --noEmit
npx --no-install eslint src/components/escritorio/ChannelSidebar.tsx
```

- [ ] **Step 3: Commit**

```
git add src/components/escritorio/ChannelSidebar.tsx
git commit -m "feat(escritorio): sidebar full WhatsApp (avatar+last msg+hora+unread+novo DM)"
```

### Task I.4 — Atualizar páginas pra passar `pessoas` e `viewerId`

**Files:**
- Modify: `src/app/(authed)/escritorio/[kind]/page.tsx`

- [ ] **Step 1: Adicionar query de profiles**

Localizar o `Promise.all` que carrega `[messages, sidebarChannels, mentionables]` e estender pra incluir `pessoas`:

```ts
const supabase = await createClient();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const [messages, sidebarChannels, mentionables, pessoasRes] = await Promise.all([
  listMessages(channel.id, 50),
  listChannelsWithUnread(user.id, user.role),
  listMentionables(),
  sb.from("profiles")
    .select("id, nome, role, avatar_url")
    .eq("ativo", true)
    .neq("id", user.id)
    .order("nome"),
]);
const pessoas = (pessoasRes.data ?? []) as Array<{ id: string; nome: string; role: string; avatar_url: string | null }>;
```

- [ ] **Step 2: Passar pro `<ChannelSidebar>`**

Localizar o uso atual `<ChannelSidebar channels={sidebarChannels} currentKind={kind} />` e estender:

```tsx
<ChannelSidebar
  channels={sidebarChannels}
  currentKind={kind}
  currentChannelId={null}
  pessoas={pessoas}
  viewerId={user.id}
/>
```

- [ ] **Step 3: Typecheck**

```
npx --no-install tsc --noEmit
```

- [ ] **Step 4: Commit**

```
git add 'src/app/(authed)/escritorio/[kind]/page.tsx'
git commit -m "feat(escritorio): página de canal passa pessoas+viewerId pro sidebar"
```

### Task I.5 — Nova rota `/escritorio/dm/[id]`

**Files:**
- Create: `src/app/(authed)/escritorio/dm/[id]/page.tsx`

- [ ] **Step 1: Criar página**

```tsx
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  listChannelsWithUnread,
  listMessages,
  listMentionables,
} from "@/lib/escritorio/queries";
import { canAccessDmChannel, type Channel } from "@/lib/escritorio/types";
import { ChannelSidebar } from "@/components/escritorio/ChannelSidebar";
import { ChannelView } from "@/components/escritorio/ChannelView";

export default async function DmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAuth();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;

  // Carrega o channel
  const { data: channelRow } = await sb
    .from("chat_channels")
    .select("id, kind, nome, descricao, ordem, member_ids")
    .eq("id", id)
    .maybeSingle();
  const channel = (channelRow ?? null) as Channel | null;
  if (!channel || !canAccessDmChannel(channel, user.id)) notFound();

  // Resolve display name + avatar do "outro" pra header
  const otherId = (channel.member_ids ?? []).find((mid) => mid !== user.id);
  let otherProfile: { nome: string; avatar_url: string | null } | null = null;
  if (otherId) {
    const { data: p } = await sb
      .from("profiles")
      .select("nome, avatar_url")
      .eq("id", otherId)
      .maybeSingle();
    otherProfile = (p ?? null) as { nome: string; avatar_url: string | null } | null;
  }
  const channelForDisplay: Channel = {
    ...channel,
    nome: otherProfile?.nome ?? "Usuário removido",
  };

  const [messages, sidebarChannels, mentionables, pessoasRes] = await Promise.all([
    listMessages(channel.id, 50),
    listChannelsWithUnread(user.id, user.role),
    listMentionables(),
    sb.from("profiles")
      .select("id, nome, role, avatar_url")
      .eq("ativo", true)
      .neq("id", user.id)
      .order("nome"),
  ]);
  const pessoas = (pessoasRes.data ?? []) as Array<{ id: string; nome: string; role: string; avatar_url: string | null }>;

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-0 flex-col gap-4 md:flex-row">
      <ChannelSidebar
        channels={sidebarChannels}
        currentKind={null}
        currentChannelId={channel.id}
        pessoas={pessoas}
        viewerId={user.id}
      />
      <ChannelView
        key={channel.id}
        channel={channelForDisplay}
        initialMessages={messages}
        currentUser={{ id: user.id, nome: user.nome, avatar_url: user.avatarUrl }}
        mentionables={mentionables}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```
npx --no-install tsc --noEmit
```

- [ ] **Step 3: Commit**

```
git add 'src/app/(authed)/escritorio/dm/[id]/page.tsx'
git commit -m "feat(escritorio): rota /escritorio/dm/[id] pra DM 1-on-1"
```

### Task I.6 — Push branch

- [ ] **Step 1: Push**

```
git push -u origin feat/escritorio-dm-ui
```

Não abrir PR — controller faz a review.

---

## Self-review

**Spec coverage:**
- ✅ Migration A enum 'direct' → G.1
- ✅ Migration B coluna + indexes → G.2
- ✅ ChannelKind expandido + Channel.member_ids → G.4
- ✅ Helpers `dmOtherMemberId` e `canAccessDmChannel` → G.4
- ✅ `listChannelsWithUnread` retorna last_message + dm_other → H.1
- ✅ `openOrCreateDmAction` idempotente com retry → H.2
- ✅ `dispatchChatNotification` branch pra DM → H.3
- ✅ `NovoDmModal` com search → I.2
- ✅ `ChannelSidebar` full WhatsApp (avatar + last msg + hora + unread + botão novo DM) → I.3
- ✅ Páginas passam `pessoas` + `viewerId` → I.4
- ✅ Rota `/escritorio/dm/[id]` → I.5
- ✅ DM display name calculado por viewer (channelForDisplay) → I.5

**Placeholder scan:** Sem TBD/TODO/etc. Códigos completos em cada step.

**Type consistency:**
- `ChannelWithUnread` extendido em H.1 com `last_message_at`, `last_message`, `dm_other` → consumido em I.3
- `Pessoa` interface duplicada em I.2 e I.3 (consciente — keeps the modal self-contained, mas vale extrair pra `types.ts` num PR futuro)
- `DispatchArgs.memberIds` adicionado em H.3 → caller atualizado em mesmo step
- `ESCRITORIO_UNREAD_TAG` exportado em queries.ts → confirmado existir em H.2

**Branch + PR strategy:**
- PR G: foundation (DDL, sem comportamento novo). Pode ser mergeado e ficar em prod sem riscos.
- PR H: backend funciona mas sem UI pra acessar (existing `/escritorio/[kind]` continua igual). Defensivo.
- PR I: UI completa. Após merge, feature plenamente acessível.

**Riscos identificados:**
- I.4: o `[kind]` page atualmente usa `await createClient()` cookie-based. Pra a query de `profiles` rodar em paralelo, ela precisa do `sb as any`. OK.
- H.1: a query de unread por canal faz N queries (1 por canal). Pra ~10 canais é ok; se a equipe crescer pra 50+ canais (improvável), virar uma query agregada com GROUP BY.
- I.3: `Pessoa` interface duplicada — aceitável.
