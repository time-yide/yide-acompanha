// src/lib/briefing-gravacao/schema.ts
import { z } from "zod";

/**
 * Discriminated union: tipo='link' exige URL; tipo='pdf' exige path no storage;
 * null = sem roteiro anexado.
 */
export const roteiroSchema = z.discriminatedUnion("roteiro_tipo", [
  z.object({
    roteiro_tipo: z.literal("link"),
    link_roteiro: z.string().url("URL invalida").min(1, "URL obrigatoria"),
    roteiro_pdf_path: z.null(),
  }),
  z.object({
    roteiro_tipo: z.literal("pdf"),
    link_roteiro: z.null(),
    roteiro_pdf_path: z.string().min(1, "Path obrigatorio"),
  }),
  z.object({
    roteiro_tipo: z.null(),
    link_roteiro: z.null(),
    roteiro_pdf_path: z.null(),
  }),
]);

export type RoteiroPayload = z.infer<typeof roteiroSchema>;
