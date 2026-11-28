import { z } from "zod";
import { CATEGORIAS_EQUIPAMENTO, STATUS_EQUIPAMENTO } from "./core";

const opcional = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const equipamentoSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(120),
  categoria: z.enum(CATEGORIAS_EQUIPAMENTO),
  marca: opcional(80),
  modelo: opcional(120),
  numero_serie: opcional(120),
  status: z.enum(STATUS_EQUIPAMENTO).default("ativo"),
  responsavel_id: z.string().uuid().optional().nullable().transform((v) => v ?? null),
  observacao: opcional(2000),
  // Caminho da foto (vem do upload). Ausente na edição = mantém a foto atual.
  foto_path: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
});

export const editarEquipamentoSchema = equipamentoSchema.extend({
  id: z.string().uuid(),
});

export const comprovacaoSchema = z.object({
  // Caminho no Storage, não URL: o servidor confere a pasta e monta a URL.
  fotoPath: z.string().trim().min(1, "Foto obrigatória").max(200),
  estado: z.enum(["ok", "defeito"]),
  observacao: opcional(500),
});

export type ComprovacaoInput = z.infer<typeof comprovacaoSchema>;

export type EquipamentoInput = z.infer<typeof equipamentoSchema>;
