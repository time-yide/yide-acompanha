/** % mínimo assistido pra liberar baixar/aprovar/pedir alteração. */
export const PCT_MINIMO = 90;

export function destravado(pctMax: number): boolean {
  return pctMax >= PCT_MINIMO;
}
