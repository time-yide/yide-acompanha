export function slugPagina(slugServico: string, slugLocalidade: string): string {
  return `${slugServico}-${slugLocalidade}`;
}
export function caminhoPagina(slugServico: string, slugLocalidade: string): string {
  return `/servicos/${slugServico}/${slugLocalidade}`;
}
