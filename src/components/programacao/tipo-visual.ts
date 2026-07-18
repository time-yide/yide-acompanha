import { Cog, Plug, UserPlus, type LucideIcon } from "lucide-react";
import type { TipoProgramacao } from "@/lib/programacao/tipos";

/** Ícone + cores por tipo de lançamento, compartilhado entre a lista e o resumo. */
export const TIPO_VISUAL: Record<TipoProgramacao, { icon: LucideIcon; cor: string; bar: string; pill: string }> = {
  crm_conectado:  { icon: Plug,     cor: "text-sky-400",     bar: "bg-sky-500",     pill: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300" },
  usuario_criado: { icon: UserPlus, cor: "text-emerald-400", bar: "bg-emerald-500", pill: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" },
  sistema_feito:  { icon: Cog,      cor: "text-violet-400",  bar: "bg-violet-500",  pill: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300" },
};

export function tipoVisual(tipo: string) {
  return TIPO_VISUAL[tipo as TipoProgramacao] ?? TIPO_VISUAL.sistema_feito;
}
