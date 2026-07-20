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
  attachment_urls: string[];
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

  const fullSelect = `
      id, autor_id, autor_role_snapshot, titulo, corpo, permanente, arquivado,
      privado, notif_scope, criado_em, atualizado_em, attachment_urls,
      autor:profiles!recados_autor_id_fkey(nome, avatar_url),
      reacoes:recado_reacoes(emoji, user_id)
    `;
  // Fallback intermediário: coluna `attachment_urls` ainda não migrada, mas
  // `privado` sim. Mantém o filtro de privado (senão vazaria privado no mural
  // na janela deploy→migration). Sem attachment_urls.
  const noAttachSelect = `
      id, autor_id, autor_role_snapshot, titulo, corpo, permanente, arquivado,
      privado, notif_scope, criado_em, atualizado_em,
      autor:profiles!recados_autor_id_fkey(nome, avatar_url),
      reacoes:recado_reacoes(emoji, user_id)
    `;
  // Fallback pré-migration: a coluna `privado` ainda não existe nesse ambiente,
  // então o select acima dispara erro de coluna inexistente. Sem `privado`.
  const legacySelect = `
      id, autor_id, autor_role_snapshot, titulo, corpo, permanente, arquivado,
      notif_scope, criado_em, atualizado_em,
      autor:profiles!recados_autor_id_fkey(nome, avatar_url),
      reacoes:recado_reacoes(emoji, user_id)
    `;

  const build = (selectStr: string, filterPrivado: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from("recados").select(selectStr).eq("arquivado", arquivado);
    if (filterPrivado) q = q.eq("privado", false);
    // Multi-tenant: filtra recados pelo unit_id do AUTOR. Recados sem autor_id
    // (sistema/migrações antigas) seguem visíveis pra todos.
    if (unitProfileIds !== null) {
      if (unitProfileIds.length === 0) {
        q = q.is("autor_id", null);
      } else {
        q = q.or(`autor_id.in.(${unitProfileIds.join(",")}),autor_id.is.null`);
      }
    }
    return q.order("criado_em", { ascending: false });
  };

  let result = await build(fullSelect, true);
  if (result.error) {
    // Qualquer erro do fullSelect → degrada PRIMEIRO só sem attachment_urls,
    // mantendo o filtro de privado (nunca vaza privado no mural nesse passo).
    console.warn("[recados/queries] fallback sem attachment_urls:", result.error.message);
    result = await build(noAttachSelect, true);
    if (result.error) {
      const msg2 = String(result.error.message ?? "");
      // Só relaxa o filtro de privado se a própria coluna `privado` não existe
      // (ambiente pré-migration de privados — onde tudo é mural mesmo).
      if (msg2.includes("privado") || msg2.includes("schema cache")) {
        console.warn("[recados/queries] fallback pro select legacy (migration de privados não aplicada):", msg2);
        result = await build(legacySelect, false);
      }
    }
  }

  if (result.error) {
    console.error("[recados/queries] listRecados error:", result.error.message);
    return [];
  }
  // Defaults pra linhas legacy (pré-migration): privado=false, sem anexos.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((result.data ?? []) as any[]).map((r) => ({
    privado: false,
    attachment_urls: [],
    ...r,
  })) as unknown as RecadoRow[];
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

  const buildMural = (filterPrivado: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("recados")
      .select("id", { count: "exact", head: true })
      .eq("arquivado", false)
      .eq("permanente", false)
      .gt("criado_em", cutoff);
    if (filterPrivado) q = q.eq("privado", false);

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
    return q;
  };

  let { count, error } = await buildMural(true);
  if (error) {
    const msg = String(error.message ?? "");
    // Migration de privados ainda não aplicada: re-conta sem o filtro `privado`
    // (pré-migration todo recado é do mural) pra não zerar a badge.
    if (msg.includes("privado") || msg.includes("schema cache")) {
      ({ count, error } = await buildMural(false));
    }
  }

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
      privado, notif_scope, criado_em, atualizado_em, attachment_urls,
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
    attachment_urls: [],
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

/** Uma pessoa que viu um recado (mural: abriu o mural depois do post; privado: leu). */
export interface RecadoViewer {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  /** Quando viu (last_seen_at no mural, lido_em no privado). */
  visto_em: string;
}

interface SeenUser {
  user_id: string;
  last_seen_at: string;
  nome: string;
  avatar_url: string | null;
}

async function _listSeenUsersImpl(unitProfileIds: string[] | null): Promise<SeenUser[]> {
  const supabase = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("recado_visualizacoes")
    .select("user_id, last_seen_at, profile:profiles!recado_visualizacoes_user_id_fkey(nome, avatar_url)");
  // Só quem faz parte da audiência (unidade ativa). Recado do mural é por unidade,
  // então contar quem abriu de outra unidade seria "visto" falso.
  if (unitProfileIds !== null) {
    if (unitProfileIds.length === 0) return [];
    q = q.in("user_id", unitProfileIds);
  }
  const { data, error } = await q;
  if (error) {
    console.error("[recados/queries] listSeenUsers error:", error.message);
    return [];
  }
  type Row = { user_id: string; last_seen_at: string; profile: { nome: string; avatar_url: string | null } | null };
  return ((data ?? []) as Row[]).map((r) => ({
    user_id: r.user_id,
    last_seen_at: r.last_seen_at,
    nome: r.profile?.nome ?? "Alguém",
    avatar_url: r.profile?.avatar_url ?? null,
  }));
}

/**
 * Todos que já abriram o mural (com nome/avatar), pra derivar "quem viu" cada
 * recado por `last_seen_at >= criado_em`. Cacheado 30s + tag "recados".
 */
export async function listSeenUsers(unitProfileIds: string[] | null = null): Promise<SeenUser[]> {
  const cached = unstable_cache(
    async (paramsJson: string) => {
      const { up } = JSON.parse(paramsJson) as { up: string[] | null };
      return _listSeenUsersImpl(up);
    },
    ["recados-seen-users-v1"],
    { revalidate: 30, tags: ["recados"] },
  );
  return cached(JSON.stringify({ up: unitProfileIds }));
}

/**
 * Deriva a lista de quem viu um recado do mural: pessoas cujo último acesso ao
 * mural é >= a criação do recado. Exclui o autor (viu trivialmente). Comparação
 * por timestamp (getTime) pra evitar dependência do formato ISO do Postgres.
 */
export function muralViewers(seen: SeenUser[], criadoEm: string, autorId: string | null): RecadoViewer[] {
  const cutoff = new Date(criadoEm).getTime();
  return seen
    .filter((u) => u.user_id !== autorId && new Date(u.last_seen_at).getTime() >= cutoff)
    .map((u) => ({ user_id: u.user_id, nome: u.nome, avatar_url: u.avatar_url, visto_em: u.last_seen_at }))
    .sort((a, b) => (a.visto_em < b.visto_em ? 1 : -1));
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
