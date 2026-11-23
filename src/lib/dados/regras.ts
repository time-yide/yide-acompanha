import type { ResultadoCanal } from "./tipos";
import { diasEntre } from "./periodo";

/** Limites ajustáveis — fonte única. */
export const LIMITES = {
  quedaFraco: 0.2,          // queda ≥ 20% vs período anterior
  sessoesMinimas: 100,      // site com menos que isso no período = fraco
  posicaoMaxima: 20,        // posição média no Google acima disso = fraco
  notaGmnMinima: 4.3,
  diasSemPost: 3,           // Instagram/Facebook: último post há mais de 3 dias = fraco
  semRespostaMax: 5,        // CRM: 5+ leads sem resposta há 24h = fraco
} as const;

const r = (status: ResultadoCanal["status"], motivo: string | null, metricas: ResultadoCanal["metricas"] = {}): ResultadoCanal =>
  ({ status, motivo, metricas });

/** Queda relativa (0..1). Sem base anterior = 0. */
export function queda(atual: number, anterior: number): number {
  if (anterior <= 0) return 0;
  return Math.max(0, (anterior - atual) / anterior);
}
const pct = (q: number) => `${Math.round(q * 100)}%`;

/** Situação do site no cadastro. `semSite` = confirmado que não tem (perda real). */
export interface EntradaSite { semSite: boolean; siteUrl: string | null }

export function avaliarSite(i: EntradaSite & { dados?: { sessoes: number; sessoesAnt: number } | null }): ResultadoCanal {
  if (i.semSite) return r("ausente", "Cliente não tem site");
  if (!i.dados) return r("sem_acesso", i.siteUrl ? "Google Analytics não conectado" : "Site não cadastrado");
  const m = { sessoes: i.dados.sessoes, sessoesAnt: i.dados.sessoesAnt };
  const q = queda(i.dados.sessoes, i.dados.sessoesAnt);
  if (q >= LIMITES.quedaFraco) return r("fraco", `Site perdeu ${pct(q)} das visitas`, m);
  if (i.dados.sessoes < LIMITES.sessoesMinimas) return r("fraco", `Site com só ${i.dados.sessoes} visitas no período`, m);
  return r("ok", null, m);
}

export function avaliarGoogle(i: EntradaSite & { dados?: { cliques: number; cliquesAnt: number; posicao: number | null } | null }): ResultadoCanal {
  if (i.semSite) return r("ausente", "Sem site, não aparece na busca do Google");
  if (!i.dados) return r("sem_acesso", i.siteUrl ? "Search Console não conectado" : "Site não cadastrado");
  const m = { cliques: i.dados.cliques, cliquesAnt: i.dados.cliquesAnt, posicao: i.dados.posicao };
  const q = queda(i.dados.cliques, i.dados.cliquesAnt);
  if (q >= LIMITES.quedaFraco) return r("fraco", `Cliques vindos do Google caíram ${pct(q)}`, m);
  if (i.dados.posicao != null && i.dados.posicao > LIMITES.posicaoMaxima)
    return r("fraco", `Posição média no Google: ${Math.round(i.dados.posicao)}ª (fora da 1ª página)`, m);
  return r("ok", null, m);
}

export function avaliarGmn(i: { temPerfil: boolean; nota: number | null; avaliacoes: number | null; avaliacoesAnt: number | null }): ResultadoCanal {
  // Campo vazio no cadastro = não conectado (cinza), nunca "não tem": não dá pra afirmar ausência.
  if (!i.temPerfil) return r("sem_acesso", "Google Meu Negócio não cadastrado");
  const m = { nota: i.nota, avaliacoes: i.avaliacoes, avaliacoesNovas: i.avaliacoes != null && i.avaliacoesAnt != null ? i.avaliacoes - i.avaliacoesAnt : null };
  if (i.nota != null && i.nota < LIMITES.notaGmnMinima) return r("fraco", `Nota no Google baixa (${i.nota.toFixed(1)})`, m);
  if (i.avaliacoes != null && i.avaliacoesAnt != null && i.avaliacoes <= i.avaliacoesAnt)
    return r("fraco", "Nenhuma avaliação nova no Google", m);
  return r("ok", null, m);
}

export function avaliarRede(
  nome: "Instagram" | "Facebook",
  i: { temPerfil: boolean; dados?: { ultimoPost: string | null; postsPeriodo: number } | null },
  agora: Date = new Date(),
): ResultadoCanal {
  if (!i.temPerfil) return r("sem_acesso", `${nome} não cadastrado`);
  if (!i.dados) return r("sem_acesso", `${nome} não conectado`);
  const m = { ultimoPost: i.dados.ultimoPost, postsPeriodo: i.dados.postsPeriodo };
  if (!i.dados.ultimoPost) return r("fraco", `Nenhum post no ${nome}`, m);
  const dias = diasEntre(new Date(i.dados.ultimoPost), agora);
  if (dias > LIMITES.diasSemPost) return r("fraco", `Sem post no ${nome} há ${dias} dias`, m);
  return r("ok", null, m);
}

export function avaliarAnuncios(i: { temConta: boolean; dados?: { gasto: number; gasto7d: number; cliques: number; impressoes: number } | null }): ResultadoCanal {
  if (!i.temConta) return r("sem_acesso", "Conta de anúncios não cadastrada");
  if (!i.dados) return r("sem_acesso", "Conta de anúncios sem acesso");
  const m = { ...i.dados };
  if (i.dados.gasto <= 0) return r("ausente", "Sem anúncios rodando", m);
  if (i.dados.gasto7d <= 0) return r("fraco", "Anúncios parados nos últimos 7 dias", m);
  return r("ok", null, m);
}

export function avaliarEcommerce(i: { aplica: boolean; dados: { anuncios: number; anunciosAnt: number } | null }): ResultadoCanal {
  if (!i.aplica) return r("nao_se_aplica", null);
  if (!i.dados) return r("sem_acesso", "Yide Ecom sem acesso");
  const m = { anuncios: i.dados.anuncios, anunciosAnt: i.dados.anunciosAnt };
  if (i.dados.anuncios === 0) return r("fraco", "Nenhum anúncio novo nos marketplaces", m);
  const q = queda(i.dados.anuncios, i.dados.anunciosAnt);
  if (q >= LIMITES.quedaFraco) return r("fraco", `Anúncios novos nos marketplaces caíram ${pct(q)}`, m);
  return r("ok", null, m);
}

export interface ResumoCrm {
  leadsNovos: number; vendas: number; valorVendas: number; conversao: number | null;
  semResposta24h: number | null; origens: Record<string, number>;
}

export function avaliarCrm(i: { crmTipo: string | null; dados?: { atual: ResumoCrm; anterior: ResumoCrm } | null }): ResultadoCanal {
  // "nenhum" é o padrão do formulário, não uma ausência confirmada: trata como não cadastrado.
  if (!i.crmTipo || i.crmTipo === "nenhum") return r("sem_acesso", "CRM não cadastrado");
  if (i.crmTipo !== "yide") return r("sem_acesso", "CRM fora do Lyide (sem leitura)");
  if (!i.dados) return r("sem_acesso", "Lyide não conectado");
  const { atual, anterior } = i.dados;
  const m = {
    leadsNovos: atual.leadsNovos, leadsNovosAnt: anterior.leadsNovos, vendas: atual.vendas,
    valorVendas: atual.valorVendas, conversao: atual.conversao, semResposta24h: atual.semResposta24h,
    origens: JSON.stringify(atual.origens),
  };
  if ((atual.semResposta24h ?? 0) >= LIMITES.semRespostaMax) return r("fraco", `${atual.semResposta24h} leads sem resposta há mais de 24h`, m);
  if (atual.leadsNovos === 0) return r("fraco", "Nenhum lead novo no período", m);
  const q = queda(atual.leadsNovos, anterior.leadsNovos);
  if (q >= LIMITES.quedaFraco) return r("fraco", `Leads novos caíram ${pct(q)}`, m);
  if (atual.vendas === 0) return r("fraco", "Nenhuma venda registrada no período", m);
  return r("ok", null, m);
}
