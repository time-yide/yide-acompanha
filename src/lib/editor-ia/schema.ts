import { z } from "zod";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID inválido",
);

export const criarJobSchema = z.object({
  instrucao: z.string().trim().min(3).max(1000),
  video_duracao_segundos: z.coerce.number().int().min(1).max(1800),
});

const editSegmentSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  keep: z.boolean(),
});
const captionLineSchema = z.object({
  start: z.number().min(0),
  end: z.number().min(0),
  text: z.string().max(500),
});
export const editPlanSchema = z.object({
  segments: z.array(editSegmentSchema).max(2000),
  captions: z.array(captionLineSchema).max(5000),
});

export const salvarPlanoSchema = z.object({
  id: uuidLike,
  edit_plan: editPlanSchema,
});

export type CriarJobInput = z.infer<typeof criarJobSchema>;
export type SalvarPlanoInput = z.infer<typeof salvarPlanoSchema>;
