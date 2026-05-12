import { z } from "zod";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid UUID",
);

export const PLATAFORMAS_VALORES = ["meta", "google"] as const;
export const STATUS_VALORES = ["rascunho", "ativa", "pausada", "finalizada", "rejeitada"] as const;

export const createCampanhaSchema = z.object({
  client_id: uuidLike,
  plataforma: z.enum(PLATAFORMAS_VALORES),
  nome: z.string().trim().min(2, "Nome muito curto").max(200),
  objetivo: z.string().trim().max(50).optional().nullable(),
  status: z.enum(STATUS_VALORES).default("rascunho"),
  budget_diario: z.coerce.number().min(0).optional().nullable(),
  budget_total: z.coerce.number().min(0).optional().nullable(),
  link_destino: z.string().url("Link inválido").max(500).or(z.literal("")).optional().nullable(),
  copy: z.string().max(2000).optional().nullable(),
  publico_alvo: z.string().max(500).optional().nullable(),
  criativo_url: z.string().url("URL do criativo inválida").max(500).or(z.literal("")).optional().nullable(),
  data_inicio: z.string().optional().nullable(),
  data_fim: z.string().optional().nullable(),
  observacoes: z.string().max(2000).optional().nullable(),
  // IDs externos (preenchimento opcional já na Fase 1, usado pela Fase 2)
  external_account_id: z.string().max(80).optional().nullable(),
  external_campaign_id: z.string().max(80).optional().nullable(),
});

export const updateCampanhaSchema = createCampanhaSchema.extend({
  id: uuidLike,
});

export const archiveCampanhaSchema = z.object({
  id: uuidLike,
});

export const updateMetricasVisiveisSchema = z.object({
  metricas: z.array(z.string().max(80)).max(100),
});

export const updateClienteAdAccountsSchema = z.object({
  client_id: uuidLike,
  meta_ad_account_id: z.string().trim().max(80).optional().nullable(),
  google_ads_customer_id: z.string().trim().max(80).optional().nullable(),
});

export type CreateCampanhaInput = z.infer<typeof createCampanhaSchema>;
export type UpdateCampanhaInput = z.infer<typeof updateCampanhaSchema>;
