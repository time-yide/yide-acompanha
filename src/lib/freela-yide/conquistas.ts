// src/lib/freela-yide/conquistas.ts
// Definição das conquistas + detecção pura (sem IO). A gravação/notificação fica em
// verificar-conquistas.ts; a agregação de stats em queries.ts.

export type ConquistaCategoria = "pegar" | "fechar" | "pequenas" | "valor";

export interface ConquistaDef {
  key: string;
  titulo: string;
  descricao: string; // critério, ex: "Feche 10 freelas"
  icone: string;     // nome do ícone lucide (mapeado na UI)
  categoria: ConquistaCategoria;
  cor: string;       // classe tailwind da cor do ícone quando desbloqueada
  meta: number;      // limiar pra desbloquear
}

export interface ConquistaStats {
  pegas: number;             // total de freelas pegas (não deletadas)
  fechamentos: number;       // total de fechadas
  pequenasFechadas: number;  // fechadas com valor_comissao <= 100
  valorFechado: number;      // soma de valor_comissao das fechadas
}

// Marcos monotônicos (só sobem). key = identificador estável no banco.
export const CONQUISTAS: ConquistaDef[] = [
  { key: "estreia",      titulo: "Estreia",              descricao: "Pegue sua 1ª freela",                icone: "Rocket",   categoria: "pegar",    cor: "text-sky-400",     meta: 1 },
  { key: "pegador",      titulo: "Pegador",              descricao: "Pegue 10 freelas",                   icone: "Zap",      categoria: "pegar",    cor: "text-amber-400",   meta: 10 },
  { key: "formiga",      titulo: "Formiga",              descricao: "Pegue 30 freelas",                   icone: "Pickaxe",  categoria: "pegar",    cor: "text-orange-400",  meta: 30 },
  { key: "primeiro_gol", titulo: "Primeiro gol",         descricao: "Feche sua 1ª freela",                icone: "Target",   categoria: "fechar",   cor: "text-emerald-400", meta: 1 },
  { key: "matador",      titulo: "Matador",              descricao: "Feche 10 freelas",                   icone: "Swords",   categoria: "fechar",   cor: "text-red-400",     meta: 10 },
  { key: "closer",       titulo: "Closer",               descricao: "Feche 25 freelas",                   icone: "Flame",    categoria: "fechar",   cor: "text-rose-400",    meta: 25 },
  { key: "faxineiro",    titulo: "Faxineiro",            descricao: "Feche 5 freelas de até R$100",       icone: "Sparkles", categoria: "pequenas", cor: "text-cyan-400",    meta: 5 },
  { key: "heroi_miudas", titulo: "Herói das miúdas",     descricao: "Feche 15 freelas de até R$100",      icone: "Shield",   categoria: "pequenas", cor: "text-violet-400",  meta: 15 },
  { key: "provedor",     titulo: "Provedor",             descricao: "Some R$ 3.000 em freelas fechadas",  icone: "Gem",      categoria: "valor",    cor: "text-fuchsia-400", meta: 3000 },
  { key: "milionario",   titulo: "Milionário do freela", descricao: "Some R$ 10.000 em freelas fechadas", icone: "Crown",    categoria: "valor",    cor: "text-amber-300",   meta: 10000 },
];

/** Valor de progresso atual de uma conquista, dado os stats do colaborador. */
export function progressoDe(def: ConquistaDef, stats: ConquistaStats): number {
  switch (def.categoria) {
    case "pegar": return stats.pegas;
    case "fechar": return stats.fechamentos;
    case "pequenas": return stats.pequenasFechadas;
    case "valor": return stats.valorFechado;
  }
}

/** Keys das conquistas já atingidas (progresso >= meta). */
export function conquistasAtingidas(stats: ConquistaStats): string[] {
  return CONQUISTAS.filter((c) => progressoDe(c, stats) >= c.meta).map((c) => c.key);
}
