// Pure validation schema for Studio composition saving.
// Kept separate from studio-actions.ts ("use server") because
// Next.js requires all exports from "use server" files to be async functions.

import { z } from "zod";

const uuid = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "UUID inválido",
);

export const salvarComposicaoSchema = z
  .object({
    clientId: uuid,
    arteId: uuid.nullable(),
    titulo: z.string().min(1, "Dê um título à arte"),
    formato: z.string().min(1),
    composicao: z.object({
      formato: z.string(),
      fundo: z.object({
        cor: z.string(),
        foto: z.any().nullable(),
        listras: z.boolean(),
      }),
      camadas: z.array(z.any()),
    }),
    // Cap pngBase64 size to 30 MB
    pngBase64: z.string().regex(/^data:image\/png;base64,/, "PNG inválido").max(30 * 1024 * 1024, "Imagem grande demais"),
  })
  .refine((v) => JSON.stringify(v.composicao).length <= 2_000_000, {
    message: "Composição grande demais",
    path: ["composicao"],
  });

export type SalvarComposicaoInput = z.infer<typeof salvarComposicaoSchema>;
