import { z } from "zod";

export const NOTIF_SCOPES = ["todos", "meu_time", "nenhum"] as const;
export const REACAO_EMOJIS = ["👍", "❤️", "✅", "🎉"] as const;

export type NotifScope = (typeof NOTIF_SCOPES)[number];
export type ReacaoEmoji = (typeof REACAO_EMOJIS)[number];

export const criarRecadoSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(120, "Título muito longo"),
  corpo: z.string().min(1, "Corpo obrigatório").max(2000, "Corpo muito longo"),
  notif_scope: z.enum(NOTIF_SCOPES),
  permanente: z.boolean().default(false),
});

export const editarRecadoSchema = z.object({
  id: z.string().uuid("ID inválido"),
  titulo: z.string().min(1, "Título obrigatório").max(120, "Título muito longo"),
  corpo: z.string().min(1, "Corpo obrigatório").max(2000, "Corpo muito longo"),
});

export type CriarRecadoInput = z.infer<typeof criarRecadoSchema>;
export type EditarRecadoInput = z.infer<typeof editarRecadoSchema>;
