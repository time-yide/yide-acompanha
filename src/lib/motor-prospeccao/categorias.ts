const FDS_KEYWORDS = [
  "restaurante", "restaurant", "bar", "pub", "café", "cafe", "cafeteria",
  "lanchonete", "pizzaria", "hamburgueria", "sushi", "churrascaria",
  "padaria", "confeitaria", "sorveteria", "açaí", "acai",
  "salão", "salao", "barbearia", "beleza", "estética", "estetica",
  "nail", "cabelereiro", "cabeleireiro", "depilação", "depilacao",
  "academia", "gym", "fitness", "crossfit", "pilates", "yoga", "natação",
  "loja", "store", "shop", "varejo", "boutique", "outlet", "magazine",
  "hotel", "pousada", "hostel", "resort", "motel",
  "pet", "petshop", "veterinário", "veterinario", "banho e tosa",
  "farmácia", "farmacia", "drogaria",
  "mercado", "supermercado", "atacado", "atacarejo", "minimercado",
  "evento", "festa", "buffet", "decoração", "casamento",
  "auto", "lava", "posto", "mecânica", "mecanica", "borracharia",
  "conveniência", "conveniencia",
] as const;

export function funcionaNoFds(categoria: string | null): boolean {
  if (!categoria) return false;
  const lower = categoria.toLowerCase();
  return FDS_KEYWORDS.some((kw) => lower.includes(kw));
}

export function isHorarioComercial(now: Date, config: {
  horario_inicio: string;
  horario_fim: string;
  horario_inicio_fds: string;
  horario_fim_fds: string;
}): boolean {
  const brt = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const hhmm = brt.getUTCHours() * 100 + brt.getUTCMinutes();
  const day = brt.getUTCDay();
  const isWeekday = day >= 1 && day <= 5;

  const [iniH, iniM] = (isWeekday ? config.horario_inicio : config.horario_inicio_fds)
    .split(":").map(Number);
  const [fimH, fimM] = (isWeekday ? config.horario_fim : config.horario_fim_fds)
    .split(":").map(Number);

  const inicio = iniH * 100 + iniM;
  const fim = fimH * 100 + fimM;

  return hhmm >= inicio && hhmm < fim;
}

export function isDiaUtil(now: Date): boolean {
  const brt = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const day = brt.getUTCDay();
  return day >= 1 && day <= 5;
}
