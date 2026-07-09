import { z } from "zod";

const horaRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createBloqueioSchema = z
  .object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    hora_inicio: z.string().regex(horaRegex, "Hora início inválida"),
    hora_fim: z.string().regex(horaRegex, "Hora fim inválida"),
    motivo: z.string().trim().min(1, "Informe o motivo").max(500),
  })
  .refine((d) => d.hora_fim > d.hora_inicio, {
    message: "Hora fim deve ser depois da hora início",
    path: ["hora_fim"],
  });

export const rejeitarBloqueioSchema = z.object({
  id: z.string().uuid(),
  motivo_recusa: z.string().trim().min(1, "Informe o motivo da recusa").max(500),
});

export type CreateBloqueioInput = z.infer<typeof createBloqueioSchema>;
