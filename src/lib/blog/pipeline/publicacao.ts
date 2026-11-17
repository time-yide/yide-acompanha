// Sem revisão humana, artigo curto demais (resposta cortada da IA) fica de rascunho em vez de ir pro ar.
const MIN_CARACTERES_PARA_PUBLICAR = 800;

export function camposDePublicacao(conteudoMd: string, publicar: boolean, agora: string) {
  if (publicar && conteudoMd.trim().length >= MIN_CARACTERES_PARA_PUBLICAR) {
    return { status: "publicado", published_at: agora };
  }
  return { status: "rascunho" };
}
