import { z } from "zod";
import type { Database } from "@/types/database";
import { TIPOS_PACOTE } from "@/lib/painel/pacote-matrix";
import { TIPOS_RELACAO, MODALIDADES, CHURN_MOTIVO_SLUGS, CADENCIAS_REUNIAO } from "./constants";
export * from "./constants";

type TipoPacote = Database["public"]["Enums"]["tipo_pacote"];

const HAS_IA = /\bia\b/i;

/** Infere tipo_pacote a partir do campo livre servico_contratado.
 *  Mesma lógica da migration 20260502000031. */
export function inferTipoPacote(servico: string | null | undefined): TipoPacote {
  if (!servico) return "trafego_estrategia";
  const s = servico.toLowerCase();
  // E-commerce vem ANTES dos outros checks porque "e-commerce" pode ter
  // "comércio" que ainda contém "merc" — evita matchings esquisitos.
  if (s.includes("e-commerce") || s.includes("ecommerce") || s.includes("e commerce")) {
    return "ecommerce";
  }
  if (
    (s.includes("trafego") || s.includes("tráfego") || s.includes("trafégo")) &&
    s.includes("estrat")
  ) return "trafego_estrategia";
  if (s.includes("yide") && s.includes("360")) return "yide_360";
  if (s.includes("full") || s.includes("premium")) return "yide_360";
  if (s.includes("trafego") || s.includes("tráfego") || s.includes("trafégo")) return "trafego";
  if (s.includes("estrat")) return "estrategia";
  if (s.includes("audiovisual") || s.includes("video") || s.includes("vídeo")) return "audiovisual";
  if (s.includes("site")) return "site";
  if (s.includes("comercial") && HAS_IA.test(servico)) return "comercial_ai";
  if (s.includes("crm") && HAS_IA.test(servico)) return "crm_ia";
  if (s.includes("crm")) return "crm";
  if (HAS_IA.test(servico)) return "ia";
  return "trafego_estrategia";
}

export const createClienteSchema = z.object({
  nome: z.string().min(2, "Nome muito curto"),
  contato_principal: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().or(z.literal("")).nullable(),
  telefone: z.string().optional().nullable(),
  valor_mensal: z.coerce.number().min(0).default(0),
  servico_contratado: z.string().optional().nullable(),
  data_entrada: z.string().optional(),
  assessor_id: z.string().uuid().optional().nullable(),
  coordenador_id: z.string().uuid().optional().nullable(),
  data_aniversario_socio_cliente: z.string().optional().nullable(),
  tipo_pacote: z.enum(TIPOS_PACOTE).optional().nullable(),
  cadencia_reuniao: z.enum(CADENCIAS_REUNIAO).optional().nullable(),
  numero_unidades: z.coerce.number().int().min(1).default(1),
  valor_trafego_google: z.coerce.number().min(0).optional().nullable(),
  valor_trafego_meta: z.coerce.number().min(0).optional().nullable(),
  tipo_pacote_revisado: z.coerce.boolean().optional(),
  tipo_relacao: z.enum(TIPOS_RELACAO).default("comum"),
  modalidade: z.enum(MODALIDADES).default("mensal"),
});

export const editClienteSchema = createClienteSchema.extend({
  id: z.string().uuid(),
  designer_id: z.string().min(1).optional().nullable(),
  videomaker_id: z.string().min(1).optional().nullable(),
  editor_id: z.string().min(1).optional().nullable(),
  instagram_url: z.string().url().or(z.literal("")).optional().nullable(),
  gmn_url: z.string().url().or(z.literal("")).optional().nullable(),
  drive_url: z.string().url().or(z.literal("")).optional().nullable(),
  link_estrategia: z.string().url().or(z.literal("")).optional().nullable(),
  pacote_post_padrao: z.coerce.number().int().min(0).optional().nullable(),
  // Stories: checkbox posta "on" quando marcado e some quando desmarcado.
  tem_stories: z.preprocess(
    (v) => v === "on" || v === "true" || v === true,
    z.boolean(),
  ),
  quantidade_diaria_stories: z.coerce.number().int().min(0).default(0),
  grupo_wpp_jid: z.string().optional().nullable(),
});

export const churnClienteSchema = z.object({
  id: z.string().uuid(),
  // Categoria obrigatória (pro relatório). Detalhe de texto livre é opcional.
  motivo_churn_categoria: z.enum(CHURN_MOTIVO_SLUGS, {
    message: "Selecione o motivo do churn",
  }),
  motivo_churn: z.string().optional(),
  data_churn: z.string().optional(),
});

export type CreateClienteInput = z.infer<typeof createClienteSchema>;
export type EditClienteInput = z.infer<typeof editClienteSchema>;
export type ChurnClienteInput = z.infer<typeof churnClienteSchema>;
