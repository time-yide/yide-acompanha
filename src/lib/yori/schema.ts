import { z } from "zod";
import { BASE_TEMPLATES, FONT_FAMILIES, POSITIONS, ANIMATIONS } from "./tipos";

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Cor hex inválida (use #RRGGBB)");

// GUID-style UUID: aceita qualquer 8-4-4-4-12 hex.
// Usamos guid em vez do uuid() do Zod 4 porque os templates de sistema do Yori
// têm IDs fixos não-RFC (00000000-0000-0000-0000-00000000000X) por design.
const uuidString = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "UUID inválido",
  );

export const createTemplateSchema = z.object({
  nome: z.string().trim().min(2).max(60),
  base_template: z.enum(BASE_TEMPLATES),
  primary_color: hexColor,
  highlight_color: hexColor.nullable().optional(),
  font_family: z.enum(FONT_FAMILIES),
  font_size: z.coerce.number().int().min(24).max(80),
  position: z.enum(POSITIONS),
  position_y_offset: z.coerce.number().int().min(-200).max(200).default(0),
  has_shadow: z.coerce.boolean(),
  shadow_intensity: z.coerce.number().int().min(0).max(100).default(50),
  animation: z.enum(ANIMATIONS),
});
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = createTemplateSchema.extend({
  id: uuidString,
});
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

export const createJobSchema = z.object({
  template_id: uuidString,
  video_filename: z.string().min(1).max(200),
  video_duration_seconds: z.coerce
    .number()
    .int()
    .min(1)
    .max(90, "Vídeo deve ter no máximo 90 segundos"),
  video_size_bytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(200 * 1024 * 1024, "Arquivo maior que 200MB"),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const markDownloadSchema = z.object({
  jobId: uuidString,
  type: z.enum(["mp4", "srt", "txt"]),
});
