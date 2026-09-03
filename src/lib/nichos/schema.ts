import { z } from "zod";

export const dataComemorativaSchema = z.object({
  data: z.string().regex(/^\d{2}-\d{2}$/, "Formato MM-DD"),
  nome: z.string().min(1).max(100),
});

export const nichoSchema = z.object({
  nome: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  datas_comemorativas: z.array(dataComemorativaSchema).default([]),
  palavras_chave: z.array(z.string().min(1)).default([]),
});

export type DataComemorativa = z.infer<typeof dataComemorativaSchema>;
export type NichoInput = z.infer<typeof nichoSchema>;

export interface NichoRow {
  id: string;
  organization_id: string;
  nome: string;
  slug: string;
  datas_comemorativas: DataComemorativa[];
  palavras_chave: string[];
  created_at: string;
}
