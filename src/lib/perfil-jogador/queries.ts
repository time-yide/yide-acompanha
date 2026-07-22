import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { roleLabel } from "@/lib/auth/permissions";
import { getTemperamentosDeVarios, CLASSE_DESCRICAO } from "./classe";
import { rankSinergiaTrabalho, rankSinergiaHobbies } from "./sinergia";
import type { CardData, PerfilJogador, Classe } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

function tempoDeCasa(dataAdmissao: string | null): string | null {
  if (!dataAdmissao) return null;
  const inicio = new Date(dataAdmissao).getTime();
  const meses = Math.max(0, Math.floor((Date.now() - inicio) / (1000 * 60 * 60 * 24 * 30)));
  if (meses < 1) return "recém-chegado";
  if (meses < 12) return `${meses} ${meses === 1 ? "mês" : "meses"} de casa`;
  const anos = Math.floor(meses / 12);
  return `${anos} ${anos === 1 ? "ano" : "anos"} de casa`;
}

interface ProfileRow {
  id: string;
  nome: string;
  role: string;
  avatar_url: string | null;
  data_admissao: string | null;
  ativo: boolean;
}

export async function listTime(): Promise<
  { userId: string; nome: string; cargoLabel: string; avatarUrl: string | null; username: string | null; classe: Classe | null }[]
> {
  const sb = createServiceRoleClient() as SB;
  const { data: profs } = await sb
    .from("profiles")
    .select("id, nome, role, avatar_url, data_admissao, ativo")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  const lista = (profs ?? []) as ProfileRow[];
  const { data: cards } = await sb.from("perfil_jogador").select("user_id, username");
  const userMap = new Map(
    ((cards ?? []) as Array<{ user_id: string; username: string | null }>).map((c) => [c.user_id, c.username]),
  );
  // Classe por pessoa (resolvida em lote: 1 query de respostas).
  const classes = await getTemperamentosDeVarios(lista.map((p) => p.id));
  const out = [];
  for (const p of lista) {
    out.push({
      userId: p.id,
      nome: p.nome,
      cargoLabel: roleLabel(p.role),
      avatarUrl: p.avatar_url,
      username: userMap.get(p.id) ?? null,
      classe: classes.get(p.id) ?? null,
    });
  }
  return out;
}

export async function getCard(userId: string): Promise<CardData | null> {
  const sb = createServiceRoleClient() as SB;
  const { data: prof } = await sb
    .from("profiles")
    .select("id, nome, role, avatar_url, data_admissao, ativo")
    .eq("id", userId)
    .single();
  if (!prof) return null;
  const p = prof as ProfileRow;

  const { data: perfilRow } = await sb
    .from("perfil_jogador")
    .select("user_id, username, capa_url, bio, como_trabalho, hobbies, frase")
    .eq("user_id", userId)
    .maybeSingle();
  const perfil = (perfilRow as PerfilJogador | null) ?? null;

  // Pesquisas identificadas que a pessoa respondeu.
  const { data: dests } = await sb
    .from("pesquisa_destinatarios")
    .select("pesquisa_id")
    .eq("user_id", userId)
    .not("respondeu_em", "is", null);
  const ids = ((dests ?? []) as Array<{ pesquisa_id: string }>).map((d) => d.pesquisa_id);
  let pesquisasRespondidas: { id: string; titulo: string }[] = [];
  if (ids.length > 0) {
    const { data: ps } = await sb
      .from("pesquisas")
      .select("id, titulo")
      .in("id", ids)
      .eq("anonima", false)
      .is("deleted_at", null);
    pesquisasRespondidas = (ps ?? []) as { id: string; titulo: string }[];
  }

  // Sinergia: monta a lista de colegas (ativos) com classe + hobbies.
  const { data: profs } = await sb
    .from("profiles")
    .select("id, nome, avatar_url")
    .eq("ativo", true)
    .neq("id", userId);
  const colegas = (profs ?? []) as Array<{ id: string; nome: string; avatar_url: string | null }>;
  const { data: cards } = await sb.from("perfil_jogador").select("user_id, hobbies");
  const hobbiesMap = new Map(
    ((cards ?? []) as Array<{ user_id: string; hobbies: string[] }>).map((c) => [c.user_id, c.hobbies ?? []]),
  );
  // Classe do sujeito + colegas resolvida em lote (1 query de respostas).
  const classes = await getTemperamentosDeVarios([userId, ...colegas.map((c) => c.id)]);
  const classe = classes.get(userId) ?? null;
  const colegasFull = [];
  for (const c of colegas) {
    colegasFull.push({
      userId: c.id,
      nome: c.nome,
      avatarUrl: c.avatar_url,
      classe: classes.get(c.id) ?? null,
      hobbies: hobbiesMap.get(c.id) ?? [],
    });
  }

  const sinergiaTrabalho = rankSinergiaTrabalho({ userId, classe }, colegasFull, 3);
  const sinergiaHobbies = rankSinergiaHobbies(
    { userId, hobbies: perfil?.hobbies ?? [] },
    colegasFull,
    3,
  );

  return {
    userId,
    nome: p.nome,
    roleDoUsuario: p.role,
    cargoLabel: roleLabel(p.role),
    avatarUrl: p.avatar_url,
    tempoDeCasa: tempoDeCasa(p.data_admissao),
    perfil,
    classe,
    classeDescricao: classe ? CLASSE_DESCRICAO[classe] : null,
    sinergiaTrabalho,
    sinergiaHobbies,
    pesquisasRespondidas,
  };
}
