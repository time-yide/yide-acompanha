// Autor dos artigos gerados pelo cron. O blog sai assinado por uma pessoa da Yide
// (EEAT: o Google valoriza conteúdo com autor real), alternando por dia.

/** Nomes (início do nome no perfil) que assinam os artigos, em rodízio diário. */
export const AUTORES_DO_BLOG = ["Yasmin", "Lucas"] as const;

/** PURA. Escolhe o nome do autor do dia (rodízio pelo dia do ano, fuso de Cuiabá). */
export function autorDoDia(data: Date, autores: readonly string[] = AUTORES_DO_BLOG): string {
  const cuiaba = new Date(data.getTime() - 4 * 60 * 60 * 1000);
  const inicioAno = Date.UTC(cuiaba.getUTCFullYear(), 0, 1);
  const dia = Math.floor((cuiaba.getTime() - inicioAno) / 86_400_000);
  return autores[dia % autores.length];
}

/** Perfis que podem assinar artigo: só sócios e administradores da Yide. */
const PAPEIS_AUTOR = ["socio", "adm"];

/**
 * SERVER. Acha o id do perfil do autor do dia. Prioridade:
 * 1) BLOG_AUTOR_IDS (UUIDs separados por vírgula, na ordem do rodízio), se definido;
 * 2) perfil de sócio/adm da organização cujo nome começa com o nome do dia, aceito só
 *    se houver exatamente 1 resultado (nome ambíguo não assina).
 * Sem match, devolve null (o site mostra "Equipe Yide Digital").
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buscarAutorDoDia(sb: any, orgId: string, data = new Date()): Promise<string | null> {
  const ids = (process.env.BLOG_AUTOR_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length > 0) {
    const id = autorDoDia(data, ids);
    const { data: rows } = await sb.from("profiles").select("id").eq("id", id).eq("organization_id", orgId).limit(1);
    return (rows as Array<{ id: string }> | null)?.[0]?.id ?? null;
  }
  const primeiro = autorDoDia(data);
  const ordem = [primeiro, ...AUTORES_DO_BLOG.filter((n) => n !== primeiro)];
  for (const nome of ordem) {
    const { data: rows } = await sb
      .from("profiles")
      .select("id")
      .eq("organization_id", orgId)
      .in("role", PAPEIS_AUTOR)
      .ilike("nome", `${nome}%`)
      .limit(2);
    const lista = (rows as Array<{ id: string }> | null) ?? [];
    if (lista.length === 1) return lista[0].id;
  }
  return null;
}
