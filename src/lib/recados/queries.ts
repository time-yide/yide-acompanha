import { unstable_cache } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { PrivadoRow } from "./privados";
import { filterPrivadosForUser } from "./privados";

export interface RecadoRow {
  id: string;
  autor_id: string | null;
  autor_role_snapshot: string;
  titulo: string;
  corpo: string;
  permanente: boolean;
  arquivado: boolean;
  privado: boolean;
  notif_scope: string;
  criado_em: string;
  atualizado_em: string;
  autor: { nome: string; avatar_url: string | null } | null;
  reacoes: Array<{ emoji: string; user_id: string }>;
}

async function _listRecadosImpl(
  arquivado: boolean,
  unitProfileIds: string[] | null,
): Promise<RecadoRow[]> {
  // Unidade nova sem profiles → ninguém pra ver autor de recado.
  // Mas recados sem autor_id (sistema/legado) podem aparecer ainda.
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("recados")
    .select(`
      id, autor_id, autor_role_snapshot, titulo, corpo, permanente, arquivado,
      privado, notif_scope, criado_em, atualizado_em,
      autor:profiles!recados_autor_id_fkey(nome, avatar_url),
      reacoes:recado_reacoes(emoji, user_id)
    `)
    .eq("arquivado", arquivado);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q = (q as any).eq("privado", false);

  // Multi-tenant: filtra recados pelo unit_id do AUTOR. Recados sem autor_id
  // (sistema/migrações antigas) seguem visíveis pra todos.
  if (unitProfileIds !== null) {
    if (unitProfileIds.length === 0) {
      q = q.is("autor_id", null);
    } else {
      q = q.or(`autor_id.in.(${unitProfileIds.join(",")}),autor_id.is.null`);
    }
  }

  const { data, error } = await q.order("criado_em", { ascending: false });

  if (error) {
    console.error("[recados/queries] listRecados error:", error.message);
    return [];
  }
  return (data ?? []) as unknown as RecadoRow[];
}

export async function listRecados(
  arquivado: boolean,
  unitProfileIds: string[] | null = null,
): Promise<RecadoRow[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { a, up } = JSON.parse(paramsJson) as { a: boolean; up: string[] | null };
      return _listRecadosImpl(a, up);
    },
    // v3: mural agora exclui privados
    ["recados-list-v3"],
    { revalidate: 60, tags: ["recados"] },
  );
  return cached(JSON.stringify({ a: arquivado, up: unitProfileIds }));
}

async function _countRecadosNaoLidosImpl(
  userId: string,
  unitProfileIds: string[] | null,
): Promise<number> {
  const supabase = createServiceRoleClient();

  const { data: vis } = await supabase
    .from("recado_visualizacoes")
    .select("last_seen_at")
    .eq("user_id", userId)
    .maybeSingle();

  const cutoff = vis?.last_seen_at ?? "1970-01-01T00:00:00Z";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("recados")
    .select("id", { count: "exact", head: true })
    .eq("arquivado", false)
    .eq("permanente", false)
    .gt("criado_em", cutoff);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q = (q as any).eq("privado", false);

  // Multi-tenant: só conta recados que esse user de fato veria na listagem.
  // Sem isso, badge do menu mostra novidades que ele não consegue clicar.
  if (unitProfileIds !== null && unitProfileIds.length > 0) {
    q = q.or(`autor_id.in.(${unitProfileIds.join(",")}),autor_id.is.null`);
  } else if (unitProfileIds !== null && unitProfileIds.length === 0) {
    // Unidade vazia: só conta recados sem autor (sistema)
    q = q.is("autor_id", null);
  }
  // Filtro de "não auto-postado": aplicado depois da regra de unit
  q = q.or(`autor_id.is.null,autor_id.neq.${userId}`);

  const { count, error } = await q;

  if (error) {
    console.error("[recados/queries] countRecadosNaoLidos error:", error.message);
    return 0;
  }
  const mural = count ?? 0;
  const privados = await _countPrivadosNaoLidosImpl(userId);
  return mural + privados;
}

export async function countRecadosNaoLidos(
  userId: string,
  unitProfileIds: string[] | null = null,
): Promise<number> {
  // Cacheado 30s - chamado em TODA página autenticada via layout.tsx.
  // Cache key inclui userId + unitProfileIds pra cada usuário+unidade ter cache próprio.
  // Mutations em recados (criar, marcar lido) chamam revalidateTag("recados").
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { uid, up } = JSON.parse(paramsJson) as { uid: string; up: string[] | null };
      return _countRecadosNaoLidosImpl(uid, up);
    },
    // v3: agora soma privados não lidos
    ["recados-count-nao-lidos-v3"],
    { revalidate: 30, tags: ["recados"] },
  );
  return cached(JSON.stringify({ uid: userId, up: unitProfileIds }));
}

async function _listPrivadosImpl(
  arquivado: boolean,
  unitProfileIds: string[] | null,
): Promise<PrivadoRow[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("recados")
    .select(`
      id, autor_id, autor_role_snapshot, titulo, corpo, permanente, arquivado,
      privado, notif_scope, criado_em, atualizado_em,
      autor:profiles!recados_autor_id_fkey(nome, avatar_url),
      reacoes:recado_reacoes(emoji, user_id),
      destinatarios:recado_destinatarios(
        user_id, lido_em,
        profile:profiles!recado_destinatarios_user_id_fkey(nome, avatar_url)
      )
    `)
    .eq("arquivado", arquivado);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q = (q as any).eq("privado", true);

  if (unitProfileIds !== null) {
    if (unitProfileIds.length === 0) {
      q = q.is("autor_id", null);
    } else {
      q = q.or(`autor_id.in.(${unitProfileIds.join(",")}),autor_id.is.null`);
    }
  }

  const { data, error } = await q.order("criado_em", { ascending: false });
  if (error) {
    // Janela deploy→migration (tabela/coluna ainda não existem): degrada pra vazio.
    console.error("[recados/queries] listPrivados error:", error.message);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    destinatarios: (r.destinatarios ?? []).map(
      (d: { user_id: string; lido_em: string | null; profile: { nome: string; avatar_url: string | null } | null }) => ({
        user_id: d.user_id,
        lido_em: d.lido_em,
        nome: d.profile?.nome ?? "Usuário removido",
        avatar_url: d.profile?.avatar_url ?? null,
      }),
    ),
  })) as PrivadoRow[];
}

export async function listPrivados(
  userId: string,
  role: string,
  arquivado: boolean,
  unitProfileIds: string[] | null = null,
): Promise<PrivadoRow[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { a, up } = JSON.parse(paramsJson) as { a: boolean; up: string[] | null };
      return _listPrivadosImpl(a, up);
    },
    ["recados-privados-list-v1"],
    { revalidate: 30, tags: ["recados"] },
  );
  const all = await cached(JSON.stringify({ a: arquivado, up: unitProfileIds }));
  // Visibilidade aplicada FORA do cache (depende de userId+role).
  return filterPrivadosForUser(all, userId, role);
}

async function _countPrivadosNaoLidosImpl(userId: string): Promise<number> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase as any)
    .from("recado_destinatarios")
    .select("recado_id, recados!inner(arquivado)", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("lido_em", null)
    .eq("recados.arquivado", false);
  if (error) {
    // Janela deploy→migration: tabela ainda não existe → 0 (não derruba o layout).
    console.error("[recados/queries] countPrivadosNaoLidos error:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function getMyLastSeen(userId: string): Promise<string | null> {
  // Não cacheado: usado pontualmente; valor exato muda muito.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recado_visualizacoes")
    .select("last_seen_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[recados/queries] getMyLastSeen error:", error.message);
    return null;
  }
  return data?.last_seen_at ?? null;
}
