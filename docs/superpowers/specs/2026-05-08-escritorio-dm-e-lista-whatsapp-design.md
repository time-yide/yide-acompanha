# Escritório virtual — DM 1-on-1 + lista estilo WhatsApp

**Status:** design aprovado, aguardando plano de implementação
**Data:** 2026-05-08

## Objetivo

Duas mudanças no `/escritorio` pra levar o feel do chat ao nível do WhatsApp:

1. **Sidebar de canais com info rica** — última mensagem (preview), hora da última msg, avatar circular, badge de não-lidas. Lista única misturando canais de grupo e DMs, ordenada por última atividade.
2. **DM 1-on-1** — qualquer pessoa do time pode iniciar conversa privada com qualquer outra. Botão "Nova conversa" no topo da sidebar abre modal com search + lista filtrável.

## Decisões fechadas

1. **Permissão DM:** any-to-any. Qualquer profile ativo pode DM qualquer outro profile ativo.
2. **Botão "Nova conversa":** topo da sidebar, abre modal com lista de pessoas + search.
3. **Layout:** lista única misturando canais de grupo + DMs, ordenada por `last_message_at DESC`. DMs aparecem com nome+avatar da OUTRA pessoa.
4. **Last message preview:** mostra autor + texto truncado. Se a última msg é sua, prefixa com "Você: ".
5. **Identidade do canal DM:** não tem `nome` próprio — o display name é calculado por viewer (sempre o outro membro). Isso evita migrar nomes duplicados.

## Arquitetura

### Mudanças no banco

**Migration A (enum value novo):**

```sql
ALTER TYPE channel_kind ADD VALUE IF NOT EXISTS 'direct';
```

**Migration B (coluna `member_ids` + index parcial pra DM):**

```sql
ALTER TABLE chat_channels
  ADD COLUMN IF NOT EXISTS member_ids UUID[];

-- Garante UM canal DM por par de usuários. Ordenamos os UUIDs antes de
-- comparar pra cobrir as duas direções (A→B é o mesmo que B→A).
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_channels_dm_unique
  ON chat_channels (
    LEAST((member_ids)[1], (member_ids)[2]),
    GREATEST((member_ids)[1], (member_ids)[2])
  )
  WHERE kind = 'direct';

-- Index pra listar DMs de um user. GIN suporta containment ops em arrays.
CREATE INDEX IF NOT EXISTS idx_chat_channels_member_ids_gin
  ON chat_channels USING GIN (member_ids)
  WHERE kind = 'direct';
```

**Sem migração de dados** — canais existentes (geral, etc.) continuam com `member_ids=NULL`. Aplicação trata `kind='direct'` como caso especial.

### Novo enum value e tipos

`src/lib/escritorio/types.ts`:

```ts
export type ChannelKind =
  | "geral"
  | "assessores_coordenadores"
  | "coordenadores_estrategico"
  | "audiovisual_geral"
  | "designers"
  | "comercial"
  | "administrativo"
  | "direct";  // NOVO

export interface Channel {
  id: string;
  kind: ChannelKind;
  nome: string;        // pra DM virá vazio/string; display calculado
  descricao: string | null;
  ordem: number;
  member_ids: string[] | null;   // NOVO — populado só quando kind='direct'
}

// canAccessChannel pra DM: user tem que estar em member_ids.
// Implementação fica em escritorio/types.ts:canAccessChannel — atualizar.
```

`canAccessChannel` ganha uma overload (ou nova função) que aceita o channel inteiro pra ver `member_ids`. A versão antiga (só com role) continua válida pros canais não-DM.

### Resolver display name + avatar de DM

```ts
// Helper: pra um Channel kind='direct', retorna o "outro" membro
// (pra display). Se member_ids tem só o próprio user (autodirect),
// retorna o próprio.
export function dmOtherMemberId(channel: Channel, viewerId: string): string {
  if (channel.kind !== "direct" || !channel.member_ids) return viewerId;
  return channel.member_ids.find((id) => id !== viewerId) ?? viewerId;
}
```

Pra display: query nome + avatar do outro membro (pode ser via join na hora de listar canais).

### `listChannelsWithUnread` — extensão

Hoje retorna canais com `unread_count`. Vamos estender pra retornar também:
- `last_message_at: string | null`
- `last_message_preview: { autor_id, autor_nome, conteudo } | null`
- Pra DMs: `dm_other: { id, nome, avatar_url } | null`

Query:
1. Lista todos os channels acessíveis pelo user:
   - Role-based: filtra por `canAccessChannel(role, kind)` (já existe)
   - DMs: `kind='direct' AND user_id = ANY(member_ids)`
2. Pra cada channel, busca última msg (subquery ou join lateral)
3. Pra DMs, busca o outro membro do `profiles`
4. Ordena por `last_message_at DESC NULLS LAST`

A função vira mais cara que hoje. Mantemos o cache `unstable_cache` com revalidate=15s e tag `chat-unread`.

### Server action: criar/abrir DM

Nova action: `src/lib/escritorio/dm-actions.ts`

```ts
"use server";

/**
 * Cria ou retorna o DM channel entre o actor e o targetUserId.
 * Idempotente: se já existe, retorna o existente. Caso contrário cria.
 *
 * Permissão: any-to-any. Mas valida que o target é profile ativo da
 * mesma org (defense in depth).
 */
export async function openOrCreateDmAction(
  targetUserId: string,
): Promise<{ channelId?: string; error?: string }> {
  const actor = await requireAuth();
  if (actor.id === targetUserId) {
    return { error: "Você não pode iniciar conversa com você mesmo" };
  }

  const supabase = createServiceRoleClient();
  const { data: target } = await supabase
    .from("profiles").select("id, ativo").eq("id", targetUserId).single();
  if (!target || !target.ativo) {
    return { error: "Usuário não encontrado ou inativo" };
  }

  // Tenta achar DM existente entre os 2 (em qualquer ordem)
  const { data: existing } = await supabase
    .from("chat_channels")
    .select("id, member_ids")
    .eq("kind", "direct")
    .contains("member_ids", [actor.id])
    .contains("member_ids", [targetUserId])
    .maybeSingle();
  if (existing) return { channelId: existing.id };

  // Cria novo
  const { data: created, error } = await supabase
    .from("chat_channels")
    .insert({
      kind: "direct",
      nome: "",
      descricao: null,
      ordem: 9999,
      member_ids: [actor.id, targetUserId],
    })
    .select("id").single();
  if (error || !created) return { error: error?.message ?? "Falha ao criar DM" };

  revalidateTag(ESCRITORIO_UNREAD_TAG);
  return { channelId: created.id };
}
```

A página de canal já recebe `kind` na URL. Pra DM, vamos usar uma rota nova: `/escritorio/dm/[id]` (id do channel, não kind). Isso evita esticar o `[kind]` route.

Alternativa: usar `/escritorio/[kind]` pra grupos e `/escritorio/dm/[id]` pra DMs. Mais limpo.

### Nova página `/escritorio/dm/[id]`

Estrutura espelha `/escritorio/[kind]`:
- Verifica auth
- Carrega channel via id
- Confirma `kind='direct' AND actor.id IN member_ids`
- Carrega messages, sidebar channels, mentionables
- Renderiza `<ChannelView>` (mesmo componente — recebe channel já com nome resolvido)

Antes de renderizar, resolvemos o display name:
```ts
const otherUserId = dmOtherMemberId(channel, user.id);
const { data: other } = await supabase
  .from("profiles").select("nome, avatar_url").eq("id", otherUserId).single();
const channelForDisplay = { ...channel, nome: other.nome };
```

### Componentes UI

**Sidebar (`ChannelSidebar.tsx`) — refatorar pro layout WhatsApp:**

Cada item da lista vira um row mais alto com:
- **Avatar circular** (40x40):
  - Para canais de grupo: ícone `Hash` em círculo colorido
  - Para DMs: avatar do outro membro (foto OU iniciais)
- **Coluna texto**:
  - **Linha 1:** Nome (canal ou outro user) — bold
  - **Linha 2:** Preview da última msg ("Você: oi" / "Maria: blabla") truncado
- **Coluna direita**:
  - Hora da última msg (formato relativo: "agora", "10:30", "ontem", "12/05")
  - Badge de unread (se > 0)

Lista ordenada por `last_message_at DESC` (mais ativos no topo).

**Botão "Nova conversa"** no topo:
- Ícone `+ MessageSquarePlus` (lucide)
- Texto "Nova conversa"
- Abre `<NovoDmModal>` (novo componente client)

**`NovoDmModal.tsx` — novo:**

```tsx
"use client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lista de profiles ativos (do server) — pré-carregada no sidebar. */
  pessoas: Array<{ id: string; nome: string; role: string; avatar_url: string | null }>;
}

export function NovoDmModal({ open, onOpenChange, pessoas }: Props) {
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pessoas;
    return pessoas.filter((p) => p.nome.toLowerCase().includes(q));
  }, [pessoas, search]);

  async function open(targetId: string) {
    setPending(targetId);
    const r = await openOrCreateDmAction(targetId);
    setPending(null);
    if (r.error) {
      toast.error(r.error);
      return;
    }
    onOpenChange(false);
    setSearch("");
    router.push(`/escritorio/dm/${r.channelId}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
        </DialogHeader>
        <Input placeholder="Buscar pessoa..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        <div className="max-h-[60vh] overflow-y-auto">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => open(p.id)}
              disabled={pending === p.id}
              className="w-full flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted text-left"
            >
              <Avatar size="md" src={p.avatar_url} fallback={p.nome} />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{p.nome}</div>
                <div className="text-xs text-muted-foreground capitalize">{p.role.replaceAll("_", " ")}</div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Ninguém encontrado.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**`ChannelSidebar.tsx` — refatorar:**

```tsx
export function ChannelSidebar({ channels, currentKind, currentChannelId, viewerId, pessoas }) {
  const [novoOpen, setNovoOpen] = useState(false);
  return (
    <aside className="...">
      <div className="px-2 pb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase">Conversas</h2>
        <button onClick={() => setNovoOpen(true)}>
          <MessageSquarePlus className="h-4 w-4" />
        </button>
      </div>

      {channels.map((c) => {
        const isDm = c.kind === "direct";
        const displayName = isDm ? c.dm_other?.nome : c.nome;
        const avatarSrc = isDm ? c.dm_other?.avatar_url : null;
        const active = isDm
          ? c.id === currentChannelId
          : c.kind === currentKind;

        const href = isDm ? `/escritorio/dm/${c.id}` : `/escritorio/${c.kind}`;

        return (
          <Link key={c.id} href={href} className={cn("flex items-center gap-3 rounded-md px-2 py-2", active && "bg-primary/15")}>
            <Avatar size="md" src={avatarSrc} fallback={displayName} icon={!isDm ? "hash" : undefined} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{displayName}</span>
                {c.last_message_at && (
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">
                    {formatRelative(c.last_message_at)}
                  </span>
                )}
              </div>
              {c.last_message_preview && (
                <p className="text-xs text-muted-foreground truncate">
                  {c.last_message_preview.autor_id === viewerId ? "Você: " : ""}
                  {c.last_message_preview.conteudo}
                </p>
              )}
            </div>
            {c.unread_count > 0 && (
              <span className="badge unread">{c.unread_count}</span>
            )}
          </Link>
        );
      })}

      <NovoDmModal open={novoOpen} onOpenChange={setNovoOpen} pessoas={pessoas} />
    </aside>
  );
}
```

`formatRelative` retorna "agora" (<1 min), "HH:MM" (mesmo dia), "ontem", "DD/MM" (mais antigo).

### Páginas que recebem o sidebar

`/escritorio/[kind]/page.tsx` e `/escritorio/dm/[id]/page.tsx`:

Server-side, antes de renderizar `<ChannelSidebar>`, carrega adicional:
- `pessoas`: query `profiles WHERE ativo=true ORDER BY nome` (sem o próprio user)

Passa pro sidebar via props.

### Notificações pra DM

`dispatchChatNotification` (criado no PR #167) já trata canais via `canAccessChannel`. Pra DMs, a função de "destinatários" precisa ser ajustada:

- **Hoje:** filtra profiles ativos com `canAccessChannel(role, kind)`
- **Pra DM:** os destinatários são `member_ids` exceto o autor

A condição vira: se `kind === 'direct'`, recipients = `member_ids except author`. Se não, segue lógica existente.

Mudança em `src/lib/notificacoes/dispatch-chat.ts` — adicionar branch pra DM.

### Realtime (Supabase Realtime)

`useRealtimeMessages` já filtra mensagens pelo `channel_id`. DM funciona na mesma infraestrutura sem mudança.

## Edge cases

| Cenário | Comportamento |
|---|---|
| User tenta criar DM com user inativo | `openOrCreateDmAction` retorna erro "Usuário não encontrado ou inativo". |
| Race condition: 2 abas tentam criar DM ao mesmo tempo | Unique index garante 1 só. A 2ª abas falha → retry busca o existente. Ajustar a action pra catch + retry-find. |
| User deletado depois de criar DM | Channel continua. Display fallback: "Usuário removido". Mensagens antigas continuam visíveis pro outro participante. |
| User tenta acessar `/escritorio/dm/<id>` de DM que não é dele | Server retorna 404 (notFound). |
| User exclui sua própria conta de profiles ativos | DMs com ele permanecem mas viram "inacessíveis"; outro participante vê fallback. |
| DM sem mensagens (acabou de criar) | Aparece na sidebar com `last_message_at=null`, sem preview, ordenada por `created_at` do channel como fallback. |
| Canal com member_ids = [actor, actor] (autodirect) | Bloqueado em runtime: action retorna erro. |

## Mudanças de código resumidas

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<ts1>_add_channel_kind_direct.sql` | Migration A — enum |
| `supabase/migrations/<ts2>_chat_dm_member_ids.sql` | Migration B — coluna + indexes |
| `src/types/database.ts` | regen (enum + member_ids) |
| `src/lib/escritorio/types.ts` | ChannelKind + dmOtherMemberId helper + canAccessChannel pra DM |
| `src/lib/escritorio/queries.ts` | listChannelsWithUnread retorna last_message + dm_other |
| `src/lib/escritorio/dm-actions.ts` | NOVO — openOrCreateDmAction |
| `src/lib/notificacoes/dispatch-chat.ts` | branch pra kind='direct' (recipients=member_ids except author) |
| `src/components/escritorio/ChannelSidebar.tsx` | refactor full WhatsApp-style + integra modal |
| `src/components/escritorio/NovoDmModal.tsx` | NOVO |
| `src/app/(authed)/escritorio/dm/[id]/page.tsx` | NOVA rota |
| `src/app/(authed)/escritorio/[kind]/page.tsx` | passa `pessoas` pro sidebar |
| `src/components/escritorio/ChannelView.tsx` | header de DM mostra nome+avatar do outro membro (pequena tweak) |

## Não-objetivos

- Não vamos adicionar **DMs em grupo** (3+ pessoas) — só 1-on-1.
- Não vamos adicionar **status online/offline** dos contatos.
- Não vamos adicionar **typing indicator** ("digitando...").
- Não vamos adicionar **read receipts** (✓✓) — fora de escopo.
- Não vamos permitir **bloquear** outro user.
- Não vamos auto-deletar DMs sem mensagens — usuário pode "abrir e abandonar" um DM e ele fica vazio na lista. Aceitável por hora.
