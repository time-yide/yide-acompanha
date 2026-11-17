export interface Resultado { rotulo: string; valor: string }
export interface CasePublico {
  slug: string; cliente: string; segmento: string; localidade: string;
  desafio: string; solucao: string; conteudo_md: string;
  resultados: Resultado[]; depoimento_texto: string; depoimento_autor: string;
  cover_image_url: string | null; meta_title: string | null; meta_description: string | null;
}
