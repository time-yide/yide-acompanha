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

/**
 * SERVER. Acha o id do perfil do autor do dia na organização. Se não achar, tenta o outro
 * nome do rodízio; se nenhum existir, devolve null (o site mostra "Equipe Yide Digital").
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buscarAutorDoDia(sb: any, orgId: string, data = new Date()): Promise<string | null> {
  const primeiro = autorDoDia(data);
  const ordem = [primeiro, ...AUTORES_DO_BLOG.filter((n) => n !== primeiro)];
  for (const nome of ordem) {
    const { data: rows } = await sb
      .from("profiles")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("nome", `${nome}%`)
      .limit(1);
    const id = (rows as Array<{ id: string }> | null)?.[0]?.id;
    if (id) return id;
  }
  return null;
}
