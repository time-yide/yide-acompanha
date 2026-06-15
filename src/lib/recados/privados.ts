import type { RecadoRow } from "./queries";

export interface PrivadoDestinatario {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  lido_em: string | null;
}

export interface PrivadoRow extends RecadoRow {
  privado: boolean;
  destinatarios: PrivadoDestinatario[];
}

export function canSeePrivado(row: PrivadoRow, userId: string, role: string): boolean {
  if (role === "socio") return true;
  if (row.autor_id === userId) return true;
  return row.destinatarios.some((d) => d.user_id === userId);
}

export function filterPrivadosForUser(rows: PrivadoRow[], userId: string, role: string): PrivadoRow[] {
  return rows.filter((r) => canSeePrivado(r, userId, role));
}

/** True quando o usuário só enxerga por ser sócio (não é autor nem destinatário). */
export function isAuditoriaSomente(row: PrivadoRow, userId: string): boolean {
  if (row.autor_id === userId) return false;
  return !row.destinatarios.some((d) => d.user_id === userId);
}

export function destinatariosLabel(row: PrivadoRow): string {
  return "para: " + row.destinatarios.map((d) => d.nome).join(", ");
}

export function meuLidoEm(row: PrivadoRow, userId: string): string | null {
  return row.destinatarios.find((d) => d.user_id === userId)?.lido_em ?? null;
}
