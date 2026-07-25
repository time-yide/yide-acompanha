import { z } from "zod";

/** "Informações para contrato" que o cliente preenche no portal. Razão social e
 *  CNPJ/CPF obrigatórios; o resto é opcional (a agência complementa depois). */
export const contratoInfoSchema = z.object({
  razao_social: z.string().trim().min(1, "Informe a razão social / nome").max(200),
  cnpj_cpf: z.string().trim().min(1, "Informe o CNPJ / CPF").max(30),
  endereco: z.string().trim().max(400).optional().nullable(),
  email: z.string().trim().email("E-mail inválido").max(200).optional().or(z.literal("")),
  telefone: z.string().trim().max(40).optional().nullable(),
});

export type ContratoInfoInput = z.infer<typeof contratoInfoSchema>;
