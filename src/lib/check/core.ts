// Check semanal — regras puras (client-safe): semana, permissões, status.

export type CheckStatus = "aberto" | "processando" | "em_revisao" | "liberado" | "fechado";
export type CheckOrigem = "ia" | "manual" | "semana_anterior";
export type CheckResultado = "feito" | "nao_feito";

export const STATUS_LABEL: Record<CheckStatus, string> = {
  aberto: "Check-in não feito",
  processando: "Transcrevendo",
  em_revisao: "Revisar itens",
  liberado: "Em andamento",
  fechado: "Semana fechada",
};

/** Quem conduz (grava, revisa, libera, fecha): sócio e adm. */
export const ROLES_CONDUZEM_CHECK = ["socio", "adm"] as const;
/** Quem enxerga o módulo. */
export const ROLES_VEEM_CHECK = ["socio", "adm", "assessor"] as const;

export function podeConduzirCheck(role: string): boolean {
  return (ROLES_CONDUZEM_CHECK as readonly string[]).includes(role);
}

export function podeVerModuloCheck(role: string): boolean {
  return (ROLES_VEEM_CHECK as readonly string[]).includes(role);
}

/** Assessor só vê o próprio check, e só depois de liberado. */
export function podeVerCheckDoAssessor(
  user: { id: string; role: string },
  assessorId: string,
  status: CheckStatus | null,
): boolean {
  if (podeConduzirCheck(user.role)) return true;
  if (user.id !== assessorId) return false;
  return status === "liberado" || status === "fechado";
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function ymdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Segunda-feira da semana de uma data "YYYY-MM-DD". */
export function segundaDaSemana(ymd: string): string {
  if (!YMD.test(ymd)) throw new Error(`Data inválida: ${ymd}`);
  const dt = ymdToUtc(ymd);
  const dow = dt.getUTCDay(); // 0=dom
  const voltar = (dow + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - voltar);
  return dt.toISOString().slice(0, 10);
}

export function somarDias(ymd: string, n: number): string {
  const dt = ymdToUtc(ymd);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Normaliza ?semana= (qualquer dia vira a segunda); inválido → semana de `hoje`. */
export function resolverSemana(param: string | null | undefined, hoje: string): string {
  return segundaDaSemana(param && YMD.test(param) ? param : hoje);
}

export function rotuloSemana(segunda: string): string {
  const qui = somarDias(segunda, 3);
  const fmt = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
  return `Semana de ${fmt(segunda)} (check-out ${fmt(qui)})`;
}

export interface ItemParaFechar {
  resultado: CheckResultado | null;
  motivo: string | null;
}

/** Fechar a semana exige tudo decidido e motivo em cada não feito. */
export function erroAoFechar(itens: ItemParaFechar[]): string | null {
  const pendentes = itens.filter((i) => !i.resultado).length;
  if (pendentes > 0) return `Falta marcar ${pendentes} item(ns) como Feito ou Não feito`;
  const semMotivo = itens.filter((i) => i.resultado === "nao_feito" && !i.motivo?.trim()).length;
  if (semMotivo > 0) return `Escreva o motivo de ${semMotivo} item(ns) não feito(s)`;
  return null;
}

/** Casa o nome de cliente que a IA devolveu com a carteira (sem acento/caixa). */
export function casarCliente(
  nome: string | null | undefined,
  clientes: Array<{ id: string; nome: string }>,
): string | null {
  if (!nome) return null;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const alvo = norm(nome);
  if (!alvo) return null;
  const exato = clientes.find((c) => norm(c.nome) === alvo);
  if (exato) return exato.id;
  const parcial = clientes.filter((c) => norm(c.nome).includes(alvo) || alvo.includes(norm(c.nome)));
  return parcial.length === 1 ? parcial[0].id : null;
}
