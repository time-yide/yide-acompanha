// src/lib/trafego/relatorios/schema.ts
import { z } from "zod";

const uuid = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "ID inválido",
);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar em YYYY-MM-DD");

export const dadosTrafegoSchema = z.object({
  spend: z.coerce.number().min(0),
  impressoes: z.coerce.number().int().min(0).optional(),
  alcance: z.coerce.number().int().min(0).optional(),
  cliques: z.coerce.number().int().min(0).optional(),
  cpc: z.coerce.number().min(0).optional(),
  ctr: z.coerce.number().min(0).optional(),
  conversoes: z.coerce.number().int().min(0).optional(),
  custo_por_conversao: z.coerce.number().min(0).optional(),
  leads: z.coerce.number().int().min(0).optional(),
  custo_por_lead: z.coerce.number().min(0).optional(),
  top_campanhas: z.array(z.object({
    nome: z.string().max(200),
    spend: z.coerce.number().min(0),
    resultados: z.coerce.number().min(0).optional(),
  })).max(7).optional(),
  periodo_anterior: z.object({
    spend: z.coerce.number().min(0).optional(),
    cliques: z.coerce.number().int().min(0).optional(),
    conversoes: z.coerce.number().int().min(0).optional(),
    leads: z.coerce.number().int().min(0).optional(),
  }).optional(),
  serie_diaria: z.array(z.object({
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    spend: z.coerce.number().min(0),
    resultados: z.coerce.number().min(0).optional(),
  })).max(400).optional(),
});

export const criarRelatorioSchema = z.object({
  cliente_id: uuid,
  periodo_inicio: isoDate,
  periodo_fim: isoDate,
  objetivo: z.string().max(1000).optional().nullable(),
  dados_manuais: dadosTrafegoSchema.partial().optional().nullable(),
}).refine((d) => d.periodo_fim >= d.periodo_inicio, {
  message: "Data final deve ser >= inicial",
  path: ["periodo_fim"],
});

export const atualizarSlideSchema = z.object({
  id: uuid,
  index: z.coerce.number().int().min(0),
  slide: z.unknown(),
});

export const publicarRelatorioSchema = z.object({ id: uuid });
export const excluirRelatorioSchema = z.object({ id: uuid });

export type CriarRelatorioInput = z.infer<typeof criarRelatorioSchema>;
export type DadosTrafegoInput = z.infer<typeof dadosTrafegoSchema>;
