import { z } from "zod";

export const ROLES_PODEM_ACESSAR_CREDENCIAIS = ["socio", "adm", "assessor", "coordenador"] as const;
export type RolePodeAcessarCredenciais = (typeof ROLES_PODEM_ACESSAR_CREDENCIAIS)[number];

export const credentialFormSchema = z.object({
  service_name: z.string().min(1, "Nome do serviço é obrigatório").max(100),
  username: z.string().max(200).optional().nullable(),
  password: z.string().min(1, "Senha é obrigatória"),
  notes: z.string().max(2000).optional().nullable(),
});

export const editCredentialSchema = credentialFormSchema.extend({
  id: z.string().uuid(),
  // Senha é opcional na edição: undefined = manter atual; string não-vazia = trocar
  password: z.string().min(1).optional(),
});

export type CredentialFormInput = z.infer<typeof credentialFormSchema>;
export type EditCredentialInput = z.infer<typeof editCredentialSchema>;
