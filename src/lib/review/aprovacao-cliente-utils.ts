// Pure helpers + tipos pro link público de aprovação do cliente.
// Kept separate from aprovacao-cliente.ts ("use server") because Next.js
// requires all exports from "use server" files to be async functions.

import type { ReviewStatus } from "./schema";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function tokenValido(token: string): boolean {
  return UUID.test(token);
}

export interface ComentarioCliente {
  id: string;
  autor_tipo: "time" | "cliente";
  autor_nome: string;
  tempo_seg: number;
  corpo: string;
  pos_x: number | null;
  pos_y: number | null;
  created_at: string;
}

/** Esconde os comentários internos da equipe — o cliente só vê os dele. */
export function soComentariosDoCliente<T extends { autor_tipo: "time" | "cliente" }>(cs: T[]): T[] {
  return cs.filter((c) => c.autor_tipo === "cliente");
}

export interface ReviewCliente {
  reviewId: string;
  titulo: string;
  status: ReviewStatus;
  clienteNome: string;
  versaoId: string | null;
  playlistUrl: string;
  thumbUrl: string;
  pronto: boolean;
  comentarios: ComentarioCliente[];
}
