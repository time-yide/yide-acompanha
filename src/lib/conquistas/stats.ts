import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getMetaComercial } from "@/lib/dashboard/comercial-queries";
import { getTemperamentoDaPessoa } from "@/lib/perfil-jogador/classe";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export interface StatsUsuario {
  mesesDeCasa: number;
  tarefasConcluidas: number;
  pesquisasRespondidas: number;
  entregasAudiovisual: number;
  ligacoesSaida: number;
  metaBatida: number;   // 0/1
  cardCompleto: number; // 0/1
  discFeito: number;    // 0/1
}

async function count(sb: SB, tabela: string, filtro: (q: SB) => SB): Promise<number> {
  let q = sb.from(tabela).select("*", { count: "exact", head: true });
  q = filtro(q);
  const { count: c } = await q;
  return c ?? 0;
}

export async function getStatsDoUsuario(userId: string, role: string): Promise<StatsUsuario> {
  const sb = createServiceRoleClient() as SB;

  const { data: prof } = await sb
    .from("profiles")
    .select("data_admissao")
    .eq("id", userId)
    .single();
  const mesesDeCasa = prof?.data_admissao
    ? Math.max(0, Math.floor((Date.now() - new Date(prof.data_admissao).getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : -1; // -1 = sem admissão → nem "novato"

  const [tarefasConcluidas, pesquisasRespondidas, entregasAudiovisual, ligacoesSaida] = await Promise.all([
    count(sb, "tasks", (q) => q.eq("atribuido_a", userId).eq("status", "concluida").is("deleted_at", null)),
    count(sb, "pesquisa_destinatarios", (q) => q.eq("user_id", userId).not("respondeu_em", "is", null)),
    count(sb, "audiovisual_capturas", (q) => q.eq("videomaker_id", userId)),
    count(sb, "ligacoes", (q) =>
      q.eq("colaborador_id", userId).eq("direcao", "saida").not("status", "in", "(cancelada,em_andamento)").is("arquivado_em", null),
    ),
  ]);

  // Meta comercial (só faz sentido pra comercial; erro/na não quebra).
  let metaBatida = 0;
  if (role === "comercial") {
    try {
      const meta = await getMetaComercial(userId);
      if (meta.pctMeta >= 100) metaBatida = 1;
    } catch {
      metaBatida = 0;
    }
  }

  // Card completo
  const { data: card } = await sb
    .from("perfil_jogador")
    .select("username, bio, como_trabalho, hobbies, frase, capa_url")
    .eq("user_id", userId)
    .maybeSingle();
  const cardCompleto =
    card && card.username && card.bio && card.como_trabalho && card.frase && card.capa_url && (card.hobbies?.length ?? 0) > 0
      ? 1 : 0;

  const discFeito = (await getTemperamentoDaPessoa(userId)) ? 1 : 0;

  return { mesesDeCasa, tarefasConcluidas, pesquisasRespondidas, entregasAudiovisual, ligacoesSaida, metaBatida, cardCompleto, discFeito };
}
