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

function paraMinutos(hhmm: string): number {
  // Aceita "08:30" e "08:30:00" (colunas time do Postgres)
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function dentroDaJanela(
  now: Date,
  semana: { inicio: string; fim: string },
  fds: { inicio: string; fim: string },
): boolean {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const minutos = brt.getUTCHours() * 60 + brt.getUTCMinutes();
  const day = brt.getUTCDay();
  const janela = day >= 1 && day <= 5 ? semana : fds;
  return minutos >= paraMinutos(janela.inicio) && minutos < paraMinutos(janela.fim);
}

/** Janela em que o motor pode mandar WhatsApp. */
export function isHorarioComercial(now: Date, config: {
  horario_inicio: string;
  horario_fim: string;
  horario_inicio_fds: string;
  horario_fim_fds: string;
}): boolean {
  return dentroDaJanela(
    now,
    { inicio: config.horario_inicio, fim: config.horario_fim },
    { inicio: config.horario_inicio_fds, fim: config.horario_fim_fds },
  );
}

export const HORARIO_LIGACAO_PADRAO = {
  horario_inicio_ligacao: "08:30",
  horario_fim_ligacao: "19:00",
  horario_inicio_ligacao_fds: "09:00",
  horario_fim_ligacao_fds: "17:00",
} as const;

/**
 * Janela em que o motor pode disparar ligação IA. É separada da do WhatsApp:
 * ligar tarde incomoda, então por padrão as ligações param antes do WPP.
 * Campos ausentes (config antiga, migration não aplicada) caem no padrão.
 */
export function isHorarioLigacao(now: Date, config: {
  horario_inicio_ligacao?: string | null;
  horario_fim_ligacao?: string | null;
  horario_inicio_ligacao_fds?: string | null;
  horario_fim_ligacao_fds?: string | null;
}): boolean {
  const p = HORARIO_LIGACAO_PADRAO;
  return dentroDaJanela(
    now,
    {
      inicio: config.horario_inicio_ligacao || p.horario_inicio_ligacao,
      fim: config.horario_fim_ligacao || p.horario_fim_ligacao,
    },
    {
      inicio: config.horario_inicio_ligacao_fds || p.horario_inicio_ligacao_fds,
      fim: config.horario_fim_ligacao_fds || p.horario_fim_ligacao_fds,
    },
  );
}

export function isDiaUtil(now: Date): boolean {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const day = brt.getUTCDay();
  return day >= 1 && day <= 5;
}
