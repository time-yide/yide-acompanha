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

const HORARIO_RE = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

/**
 * Converte "HH:MM" ou "HH:MM:SS" (colunas time do Postgres) em minutos do dia.
 * Valor fora do formato retorna null — quem chama decide o fallback (nunca 0).
 */
export function parseHorario(valor: unknown): number | null {
  if (typeof valor !== "string") return null;
  const m = HORARIO_RE.exec(valor.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

interface Janela { inicio: number | null; fim: number | null }

function dentroDaJanela(now: Date, semana: Janela, fds: Janela): boolean {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const minutos = brt.getUTCHours() * 60 + brt.getUTCMinutes();
  const day = brt.getUTCDay();
  const janela = day >= 1 && day <= 5 ? semana : fds;
  // Fail closed: janela inválida (valor malformado ou fim <= início) nunca libera.
  if (janela.inicio === null || janela.fim === null || janela.fim <= janela.inicio) return false;
  return minutos >= janela.inicio && minutos < janela.fim;
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
    { inicio: parseHorario(config.horario_inicio), fim: parseHorario(config.horario_fim) },
    { inicio: parseHorario(config.horario_inicio_fds), fim: parseHorario(config.horario_fim_fds) },
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
  // Ausente ou malformado → janela padrão inteira (nunca mistura campo válido
  // com campo do padrão, pra não alargar a janela sem querer).
  const janela = (ini?: string | null, fim?: string | null, iniPad?: string, fimPad?: string): Janela => {
    const i = parseHorario(ini);
    const f = parseHorario(fim);
    if (i === null || f === null || f <= i) return { inicio: parseHorario(iniPad), fim: parseHorario(fimPad) };
    return { inicio: i, fim: f };
  };
  return dentroDaJanela(
    now,
    janela(config.horario_inicio_ligacao, config.horario_fim_ligacao, p.horario_inicio_ligacao, p.horario_fim_ligacao),
    janela(config.horario_inicio_ligacao_fds, config.horario_fim_ligacao_fds, p.horario_inicio_ligacao_fds, p.horario_fim_ligacao_fds),
  );
}

/** Limites absolutos pra ligação IA (o usuário não consegue configurar fora disso). */
export const LIGACAO_LIMITE_MIN = "08:00";
export const LIGACAO_LIMITE_MAX = "20:00";

/**
 * Valida uma janela de horário vinda do formulário. Retorna mensagem de erro
 * em português ou null se ok.
 */
export function validarJanelaHorario(
  rotulo: string,
  inicio: unknown,
  fim: unknown,
  limites?: { min: string; max: string },
): string | null {
  const i = parseHorario(inicio);
  const f = parseHorario(fim);
  if (i === null || f === null) return `${rotulo}: horário inválido (use HH:MM)`;
  if (f <= i) return `${rotulo}: o fim precisa ser depois do início`;
  if (limites) {
    const min = parseHorario(limites.min)!;
    const max = parseHorario(limites.max)!;
    if (i < min || f > max) {
      return `${rotulo}: precisa ficar entre ${limites.min} e ${limites.max}`;
    }
  }
  return null;
}

export function isDiaUtil(now: Date): boolean {
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const day = brt.getUTCDay();
  return day >= 1 && day <= 5;
}
