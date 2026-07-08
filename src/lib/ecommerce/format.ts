/** Converte "YYYY-MM-DD" em "DD/MM/YYYY". */
export function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}
