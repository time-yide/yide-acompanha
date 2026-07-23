// Fonte única: quais agendas são "reunião a gravar" e onde cliente é obrigatório.

/** Agendas que disparam gravação + trava. */
export const AGENDAS_GRAVAR = ["assessores", "coordenadores", "comercial"] as const;
/** Agendas onde selecionar cliente é obrigatório (comercial é sem cliente). */
export const AGENDAS_CLIENTE_OBRIGATORIO = ["assessores", "coordenadores"] as const;

export function requerGravacao(subCalendar: string, origem: string = "manual"): boolean {
  return origem === "manual" && (AGENDAS_GRAVAR as readonly string[]).includes(subCalendar);
}

export function clienteObrigatorio(subCalendar: string): boolean {
  return (AGENDAS_CLIENTE_OBRIGATORIO as readonly string[]).includes(subCalendar);
}
